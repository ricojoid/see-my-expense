const { sql, getPool } = require('../config/db');
const { badRequest } = require('../lib/http');
const { timeLocal, todayLocal, weekday } = require('../lib/dates');
const { budgetCrossing, formatRupiah } = require('../lib/format');
const push = require('./push.service');
const budgets = require('./budgets.service');
const transactions = require('./transactions.service');

const DEFAULTS = { reminderEnabled: false, reminderTime: '21:00', budgetAlerts: true, weeklySummary: true };
const WEEKLY_TIME = '08:00';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const log = (msg) => console.log(`[notify] ${msg}`);

async function getSettings(userId) {
  const pool = await getPool();
  const r = await pool.request().input('uid', sql.Int, userId).query(`
    SELECT CAST(reminder_enabled AS bit) AS reminderEnabled, reminder_time AS reminderTime,
           CAST(budget_alerts AS bit) AS budgetAlerts, CAST(weekly_summary AS bit) AS weeklySummary
    FROM user_settings WHERE user_id = @uid
  `);
  const row = r.recordset[0];
  if (!row) return { ...DEFAULTS };
  return {
    reminderEnabled: Boolean(row.reminderEnabled),
    reminderTime: row.reminderTime,
    budgetAlerts: Boolean(row.budgetAlerts),
    weeklySummary: Boolean(row.weeklySummary),
  };
}

function parseSettings(body, current) {
  const next = { ...current };
  for (const key of ['reminderEnabled', 'budgetAlerts', 'weeklySummary']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') throw badRequest(`${key} must be true or false`);
      next[key] = body[key];
    }
  }
  if (body.reminderTime !== undefined) {
    if (typeof body.reminderTime !== 'string' || !TIME_RE.test(body.reminderTime)) throw badRequest('reminder time must be HH:MM');
    next.reminderTime = body.reminderTime;
  }
  return next;
}

async function updateSettings(userId, body = {}) {
  const next = parseSettings(body, await getSettings(userId));
  const today = todayLocal();
  // A reminder time that already passed today starts tomorrow, instead of firing right away.
  const skipToday = next.reminderTime <= timeLocal();
  const pool = await getPool();
  await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('enabled', sql.Bit, next.reminderEnabled)
    .input('time', sql.Char(5), next.reminderTime)
    .input('budget', sql.Bit, next.budgetAlerts)
    .input('weekly', sql.Bit, next.weeklySummary)
    .input('skip', sql.VarChar(10), skipToday ? today : null)
    .query(`
      MERGE user_settings AS target
      USING (SELECT @uid AS user_id) AS src ON target.user_id = src.user_id
      WHEN MATCHED THEN UPDATE SET reminder_enabled = @enabled, reminder_time = @time, budget_alerts = @budget,
        weekly_summary = @weekly, last_reminder_on = COALESCE(CAST(@skip AS date), last_reminder_on)
      WHEN NOT MATCHED THEN INSERT (user_id, reminder_enabled, reminder_time, budget_alerts, weekly_summary, last_reminder_on)
        VALUES (@uid, @enabled, @time, @budget, @weekly, CAST(@skip AS date));
    `);
  return next;
}

/** Creates the user's settings row with defaults, so scheduled notifications can find them. */
async function ensureSettings(userId) {
  const pool = await getPool();
  await pool.request().input('uid', sql.Int, userId).query(`
    IF NOT EXISTS (SELECT 1 FROM user_settings WHERE user_id = @uid)
      INSERT INTO user_settings (user_id) VALUES (@uid)
  `);
}

/**
 * After an expense is saved: did it push its category past 80% or 100% of the
 * monthly budget? Returns the alert for the app to show, and pushes it to the
 * user's other devices too when budget alerts are on.
 */
async function checkBudget(userId, tx) {
  if (tx.type !== 'expense' || !tx.categoryId) return null;
  const status = await budgets.statusFor(userId, tx.categoryId, tx.occurredOn.slice(0, 7));
  if (!status?.budget) return null;
  const level = budgetCrossing(status.spent - tx.amount, status.spent, status.budget);
  if (!level) return null;

  const percent = Math.round((status.spent / status.budget) * 100);
  const alert = {
    level,
    category: status.category,
    spent: status.spent,
    budget: status.budget,
    message:
      level === 'over'
        ? `${status.category} is over budget by ${formatRupiah(status.spent - status.budget)}`
        : `${status.category}: ${percent}% of this month's budget used`,
  };

  const settings = await getSettings(userId);
  if (settings.budgetAlerts) {
    push
      .sendToUser(userId, { title: level === 'over' ? 'Over budget' : 'Budget almost used', body: alert.message, url: '/', tag: `budget-${tx.categoryId}` })
      .catch((err) => log(`budget alert failed: ${err.message}`));
  }
  return alert;
}

async function weeklyMessage(userId) {
  const recap = await transactions.weeklyRecap(userId);
  if (!recap.total && !recap.previousTotal) return null;
  const parts = [];
  if (recap.topCategory) parts.push(`Top: ${recap.topCategory.name} ${formatRupiah(recap.topCategory.total)}`);
  if (recap.changePct !== null) {
    parts.push(recap.changePct <= 0 ? `${-recap.changePct}% less than the week before` : `${recap.changePct}% more than the week before`);
  }
  return { title: `Last week you spent ${formatRupiah(recap.total)}`, body: parts.join(' · ') || 'Tap to see the details.', url: '/', tag: 'weekly' };
}

/**
 * Claims today's run for each user due (compare-and-set on the "last sent"
 * date, so a restart or a second instance never sends twice) and returns their ids.
 */
async function claimDue(column, whereSql, inputs) {
  const pool = await getPool();
  const request = pool.request();
  for (const [name, type, value] of inputs) request.input(name, type, value);
  const r = await request.query(`
    UPDATE s SET ${column} = CAST(@today AS date)
    OUTPUT INSERTED.user_id AS userId
    FROM user_settings s
    WHERE (s.${column} IS NULL OR s.${column} < CAST(@today AS date))
      AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = s.user_id)
      AND ${whereSql}
  `);
  return r.recordset.map((row) => row.userId);
}

async function sendDailyReminders(today, now) {
  const due = await claimDue('last_reminder_on', 's.reminder_enabled = 1 AND s.reminder_time <= @now', [
    ['today', sql.VarChar(10), today],
    ['now', sql.Char(5), now],
  ]);
  for (const userId of due) {
    // Only nudge people who haven't logged anything today.
    if ((await transactions.countOn(userId, today)) > 0) continue;
    await push.sendToUser(userId, {
      title: "Logged today's spending?",
      body: 'Take ten seconds to add what you spent today.',
      url: '/?add=expense',
      tag: 'daily-reminder',
    });
  }
}

async function sendWeeklySummaries(today, now) {
  if (weekday(today) !== 0 || now < WEEKLY_TIME) return;
  const due = await claimDue('last_weekly_on', 's.weekly_summary = 1', [['today', sql.VarChar(10), today]]);
  for (const userId of due) {
    const message = await weeklyMessage(userId);
    if (message) await push.sendToUser(userId, message);
  }
}

/** Runs every minute from the scheduler. */
async function tick(date = new Date()) {
  const today = todayLocal(date);
  const now = timeLocal(date);
  await sendDailyReminders(today, now);
  await sendWeeklySummaries(today, now);
}

async function sendTest(userId) {
  return push.sendToUser(userId, { title: 'Notifications are on', body: "You'll get reminders and alerts here.", url: '/', tag: 'test' });
}

module.exports = { getSettings, updateSettings, ensureSettings, checkBudget, tick, sendTest, weeklyMessage };
