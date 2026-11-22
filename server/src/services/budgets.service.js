const { sql, getPool } = require('../config/db');
const { badRequest, notFound } = require('../lib/http');
const periods = require('./periods.service');
const { validateAmount } = require('../lib/validate');

/** Every expense category with its monthly budget (null if unset) and what was spent in `month`. */
async function listForMonth(userId, month) {
  const { start, end } = await periods.range(userId, month);
  const pool = await getPool();
  const result = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('start', sql.VarChar(10), start)
    .input('end', sql.VarChar(10), end)
    .query(`
      SELECT c.id AS categoryId, c.name AS category, b.amount AS budget,
             ISNULL((SELECT SUM(t.amount) FROM transactions t
                     WHERE t.category_id = c.id
                       AND t.occurred_on >= CAST(@start AS date) AND t.occurred_on < CAST(@end AS date)), 0) AS spent
      FROM categories c
      LEFT JOIN budgets b ON b.category_id = c.id
      WHERE c.user_id = @uid AND c.type = 'expense'
      ORDER BY CASE WHEN b.amount IS NULL THEN 1 ELSE 0 END, c.name
    `);
  return result.recordset.map((r) => ({
    ...r,
    budget: r.budget == null ? null : Number(r.budget),
    spent: Number(r.spent),
  }));
}

/** One category's budget (null if unset) and what was spent on it in the period holding `date`. */
async function statusFor(userId, categoryId, date) {
  const { start, end } = await periods.rangeAt(userId, date);
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('cat', sql.Int, categoryId)
    .input('start', sql.VarChar(10), start)
    .input('end', sql.VarChar(10), end)
    .query(`
      SELECT c.name AS category, b.amount AS budget,
             ISNULL((SELECT SUM(t.amount) FROM transactions t
                     WHERE t.category_id = c.id AND t.type = 'expense'
                       AND t.occurred_on >= CAST(@start AS date) AND t.occurred_on < CAST(@end AS date)), 0) AS spent
      FROM categories c
      LEFT JOIN budgets b ON b.category_id = c.id
      WHERE c.id = @cat AND c.user_id = @uid
    `);
  const row = r.recordset[0];
  return row && { category: row.category, budget: row.budget == null ? null : Number(row.budget), spent: Number(row.spent) };
}

/** Sets the monthly budget; an amount of 0 / empty removes it. */
async function setBudget(userId, categoryId, rawAmount) {
  const pool = await getPool();
  const category = await pool
    .request()
    .input('id', sql.Int, categoryId)
    .input('uid', sql.Int, userId)
    .query(`SELECT type FROM categories WHERE id = @id AND user_id = @uid`);
  if (!category.recordset[0]) throw notFound('category not found');
  if (category.recordset[0].type !== 'expense') throw badRequest('budgets are for expense categories');

  if (rawAmount === null || rawAmount === '' || Number(rawAmount) === 0) {
    await pool.request().input('cat', sql.Int, categoryId).query('DELETE FROM budgets WHERE category_id = @cat');
    return;
  }

  const amount = validateAmount(rawAmount);
  if (amount.error) throw badRequest(amount.error);
  await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('cat', sql.Int, categoryId)
    .input('amount', sql.Decimal(14, 2), amount.value)
    .query(`
      MERGE budgets AS target
      USING (SELECT @cat AS category_id) AS src ON target.category_id = src.category_id
      WHEN MATCHED THEN UPDATE SET amount = @amount
      WHEN NOT MATCHED THEN INSERT (user_id, category_id, amount) VALUES (@uid, @cat, @amount);
    `);
}

module.exports = { listForMonth, statusFor, setBudget };
