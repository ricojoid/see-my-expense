const { sql, getPool } = require('../config/db');
const { addDays, dateInMonth, monthRange, shiftMonth, todayLocal } = require('../lib/dates');
const transactions = require('./transactions.service');
const recurring = require('./recurring.service');

const daysIn = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/**
 * Where this month's spending is heading: what's spent, plus the usual daily
 * spending for the days left (recurring bills left out of that rate), plus the
 * recurring bills still to come. Compared with the sum of monthly budgets.
 */
async function projection(userId, today = todayLocal()) {
  const month = today.slice(0, 7);
  const { start } = monthRange(month);
  const tomorrow = addDays(today, 1);
  const elapsed = Number(today.slice(8, 10));
  const total = daysIn(month);

  await recurring.materialize(userId);
  const [all, everyday, upcomingRules, budgetRow] = await Promise.all([
    transactions.totalsBetween(userId, start, tomorrow),
    transactions.totalsBetween(userId, start, tomorrow, { recurring: false }),
    recurring.upcoming(userId, today),
    getPool().then((pool) =>
      pool.request().input('uid', sql.Int, userId).query('SELECT ISNULL(SUM(amount), 0) AS total FROM budgets WHERE user_id = @uid')
    ),
  ]);

  const dailyRate = everyday.expense / elapsed;
  const upcoming = upcomingRules.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const projected = Math.round(all.expense + dailyRate * (total - elapsed) + upcoming);
  const budget = Number(budgetRow.recordset[0].total) || null;
  return {
    month,
    spent: all.expense,
    projected,
    dailyRate: Math.round(dailyRate),
    upcoming,
    daysLeft: total - elapsed,
    budget,
    overBudgetBy: budget && projected > budget ? projected - budget : 0,
    early: elapsed < 5, // a rough guess in the first days
  };
}

/**
 * Expenses that look like subscriptions: the same note and amount in at least
 * two of the last few months, seen recently, and not already a recurring rule.
 */
async function subscriptionSuggestions(userId, today = todayLocal()) {
  const since = monthRange(shiftMonth(today.slice(0, 7), -3)).start;
  const recent = addDays(today, -45);
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('since', sql.VarChar(10), since)
    .input('recent', sql.VarChar(10), recent)
    .query(`
      SELECT MAX(t.description) AS description, t.amount, t.category_id AS categoryId, c.name AS category,
             t.account_id AS accountId, a.name AS account,
             COUNT(DISTINCT CONVERT(char(7), t.occurred_on, 126)) AS months,
             CONVERT(char(10), MAX(t.occurred_on), 23) AS lastOn
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      JOIN accounts a ON a.id = t.account_id
      WHERE t.user_id = @uid AND t.type = 'expense' AND t.recurring_id IS NULL AND t.person_id IS NULL
        AND t.description IS NOT NULL AND t.occurred_on >= CAST(@since AS date)
        AND NOT EXISTS (
          SELECT 1 FROM recurring_transactions rt
          WHERE rt.user_id = @uid AND rt.active = 1 AND LOWER(rt.description) = LOWER(t.description)
        )
      GROUP BY LOWER(t.description), t.amount, t.category_id, c.name, t.account_id, a.name
      HAVING COUNT(DISTINCT CONVERT(char(7), t.occurred_on, 126)) >= 2 AND MAX(t.occurred_on) >= CAST(@recent AS date)
      ORDER BY t.amount DESC
    `);

  return r.recordset.map((s) => {
    const day = Number(s.lastOn.slice(8, 10));
    // The first run is the next one after today, so making it recurring never books a payment twice.
    let next = dateInMonth(shiftMonth(s.lastOn.slice(0, 7), 1), day);
    while (next <= today) next = dateInMonth(shiftMonth(next.slice(0, 7), 1), day);
    return { ...s, amount: Number(s.amount), dayOfMonth: day, nextOn: next };
  });
}

module.exports = { projection, subscriptionSuggestions };
