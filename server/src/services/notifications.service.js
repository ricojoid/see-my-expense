const { sql, getPool } = require('../config/db');
const { badRequest } = require('../lib/http');
const { shiftMonth, timeLocal, todayLocal, weekday } = require('../lib/dates');
const { budgetCrossing, formatRupiah } = require('../lib/format');
const push = require('./push.service');
const telegram = require('./telegram.service');
const report = require('./report.service');
const budgets = require('./budgets.service');
const transactions = require('./transactions.service');

const DEFAULTS = {
  reminderEnabled: false,
  reminderTime: '21:00',
  budgetAlerts: true,
  weeklySummary: true,
  telegramNotify: true,
  monthlyReport: true,
};
const FLAGS = ['reminderEnabled', 'budgetAlerts', 'weeklySummary', 'telegramNotify', 'monthlyReport'];
const MONTHLY_TIME = '08:00';
const WEEKLY_TIME = '08:00';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const log = (msg) => console.log(`[notify] ${msg}`);

async function getSettings(userId) {
  const pool = await getPool();
  const r = await pool.request().input('uid', sql.Int, userId).query(`
    SELECT CAST(reminder_enabled AS bit) AS reminderEnabled, reminder_time AS reminderTime,
           CAST(budget_alerts AS bit) AS budgetAlerts, CAST(weekly_summary AS bit) AS weeklySummary,
           CAST(telegram_notify AS bit) AS telegramNotify, CAST(monthly_report AS bit) AS monthlyReport
    FROM user_settings WHERE user_id = @uid
  `);
  const row = r.recordset[0];
  if (!row) return { ...DEFAULTS };
  const settings = { reminderTime: row.reminderTime };
  for (const key of FLAGS) settings[key] = Boolean(row[key]);
  return settings;
}

function parseSettings(body, current) {
  const next = { ...current };
  for (const key of FLAGS) {
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
    .input('telegram', sql.Bit, next.telegramNotify)
    .input('report', sql.Bit, next.monthlyReport)
    .input('skip', sql.VarChar(10), skipToday ? today : null)
    .query(`
      MERGE user_settings AS target
      USING (SELECT @uid AS user_id) AS src ON target.user_id = src.user_id
      WHEN MATCHED THEN UPDATE SET reminder_enabled = @enabled, reminder_time = @time, budget_alerts = @budget,
        weekly_summary = @weekly, telegram_notify = @telegram, monthly_report = @report,
        last_reminder_on = COALESCE(CAST(@skip AS date), last_reminder_on)
      WHEN NOT MATCHED THEN INSERT (user_id, reminder_enabled, reminder_time, budget_alerts, weekly_summary, telegram_notify, monthly_report, last_reminder_on)
        VALUES (@uid, @enabled, @time, @budget, @weekly, @telegram, @report, CAST(@skip AS date));
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
 * Delivers a notification on every channel the user has: push on their devices,
 * and their linked Telegram chats (unless they turned that off, or it came from Telegram).
 */
async function deliver(userId, message, { telegramToo = true } = {}) {
  const sent = await push.sendToUser(userId, message);
  if (!telegramToo || !telegram.isEnabled() || !(await getSettings(userId)).telegramNotify) return sent;
  const text = `<b>${telegram.escapeHtml(message.title)}</b>
${telegram.escapeHtml(message.body)}`;
  return sent + (await telegram.sendToUser(userId, text));
}

/**
 * After an expense is saved: did it push its category past 80% or 100% of the
 * monthly budget? Returns the alert for the caller to show, and sends it to the
 * user's other channels too when budget alerts are on.
 */
async function checkBudget(userId, tx, { telegramToo = true } = {}) {
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
    const message = { title: level === 'over' ? 'Over budget' : 'Budget almost used', body: alert.message, url: '/', tag: `budget-${tx.categoryId}` };
    deliver(userId, message, { telegramToo }).catch((err) => log(`budget alert failed: ${err.message}`));
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
      AND (EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = s.user_id)
           OR (s.telegram_notify = 1 AND EXISTS (SELECT 1 FROM telegram_links t WHERE t.user_id = s.user_id)))
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
    await deliver(userId, {
      title: "Logged today's spending?",
      body: 'Take ten seconds to add what you spent today. On Telegram, just reply with it, e.g. "makan 35k".',
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
    if (message) await deliver(userId, message);
  }
}

/** Sends one user's report for `month` as a PDF to their Telegram chats. Returns how many got it. */
async function sendMonthlyReport(userId, month, username) {
  const pdf = await report.monthlyReport(userId, month, username);
  const caption = `📊 Your <b>${telegram.escapeHtml(report.monthName(month))}</b> report`;
  let sent = 0;
  for (const link of await telegram.linksOf(userId)) {
    try {
      await telegram.sendDocument(link.chatId, pdf, report.reportFileName(month), caption);
      sent++;
    } catch (err) {
      log(`monthly report to user ${userId} failed: ${err.message}`);
    }
  }
  return sent;
}

/** On the 1st, last month's PDF report goes to everyone with Telegram linked (once). */
async function sendMonthlyReports(today, now) {
  if (today.slice(8, 10) !== '01' || now < MONTHLY_TIME || !telegram.isEnabled()) return;
  const month = shiftMonth(today.slice(0, 7), -1);
  const pool = await getPool();
  const due = await pool
    .request()
    .input('month', sql.Char(7), month)
    .query(`
      UPDATE s SET last_report_month = @month
      OUTPUT INSERTED.user_id AS userId
      FROM user_settings s
      WHERE s.monthly_report = 1 AND (s.last_report_month IS NULL OR s.last_report_month < @month)
        AND EXISTS (SELECT 1 FROM telegram_links t WHERE t.user_id = s.user_id)
    `);
  for (const { userId } of due.recordset) {
    const user = await pool.request().input('id', sql.Int, userId).query('SELECT username FROM users WHERE id = @id');
    await sendMonthlyReport(userId, month, user.recordset[0]?.username || '');
  }
}

/** Runs every minute from the scheduler. */
async function tick(date = new Date()) {
  const today = todayLocal(date);
  const now = timeLocal(date);
  await sendDailyReminders(today, now);
  await sendWeeklySummaries(today, now);
  await sendMonthlyReports(today, now);
}

async function sendTest(userId) {
  return deliver(userId, { title: 'Notifications are on', body: "You'll get reminders and alerts here.", url: '/', tag: 'test' });
}

module.exports = { getSettings, updateSettings, ensureSettings, sendMonthlyReport, checkBudget, tick, sendTest, weeklyMessage };
