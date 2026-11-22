const { sql, getPool, withTransaction } = require('../config/db');
const { badRequest } = require('../lib/http');
const { addDays, todayLocal } = require('../lib/dates');
const P = require('../lib/periods');

/** Book periods per user, stored as closings. The period maths is in lib/periods. */

async function closings(userId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .query(`SELECT CONVERT(char(10), starts_on, 23) AS start, period_key AS [key]
            FROM book_closings WHERE user_id = @uid ORDER BY starts_on`);
  return r.recordset;
}

/** The period named `key` (the current one when empty), described for pages. */
async function get(userId, key, today = todayLocal()) {
  const list = await closings(userId);
  const period = key ? P.periodByKey(list, key) : P.periodAt(list, today);
  return P.describe(period, list, today);
}

const current = (userId, today = todayLocal()) => get(userId, null, today);

/** The period holding `date`. */
async function at(userId, date, today = todayLocal()) {
  const list = await closings(userId);
  return P.describe(P.periodAt(list, date), list, today);
}

/** Half-open date range of the period named `key`, for queries. */
async function range(userId, key) {
  return P.rangeOf(P.periodByKey(await closings(userId), key));
}

/** Half-open date range of the period holding `date`. */
async function rangeAt(userId, date) {
  return P.rangeOf(P.periodAt(await closings(userId), date));
}

/** The `count` periods up to and including `key`, oldest first, as ranges with their key. */
async function history(userId, key, count) {
  const list = await closings(userId);
  return P.periodsBefore(list, P.periodByKey(list, key), count).map((p) => ({ key: p.key, ...P.rangeOf(p) }));
}

/**
 * Closes the books. `when` is 'today' (the new period starts tomorrow) or
 * 'yesterday' (it starts today). Closing again moves a boundary set for today
 * or later. Returns the period that closed and the one that starts.
 */
async function close(userId, when, today = todayLocal()) {
  if (when !== 'today' && when !== 'yesterday') throw badRequest("when must be 'today' or 'yesterday'");
  const start = when === 'today' ? addDays(today, 1) : today;

  await withTransaction(async (newRequest) => {
    const req = () => newRequest().input('uid', sql.Int, userId).input('start', sql.VarChar(10), start);
    await req().query('DELETE FROM book_closings WHERE user_id = @uid AND starts_on >= CAST(@start AS date)');
    const prev = await req().query(`
      SELECT TOP 1 CONVERT(char(10), starts_on, 23) AS start, period_key AS [key]
      FROM book_closings WHERE user_id = @uid ORDER BY starts_on DESC
    `);
    const key = P.keyAfter(start, prev.recordset[0]);
    await req()
      .input('key', sql.Char(7), key)
      .query('INSERT INTO book_closings (user_id, starts_on, period_key) VALUES (@uid, CAST(@start AS date), @key)');
  });

  const list = await closings(userId);
  return {
    closed: P.describe(P.periodAt(list, addDays(start, -1)), list, today),
    opened: P.describe(P.periodAt(list, start), list, today),
  };
}

/** Removes the latest close, so its period joins the one before. Returns the restored period, or null. */
async function undoLast(userId, today = todayLocal()) {
  const pool = await getPool();
  const r = await pool.request().input('uid', sql.Int, userId).query(`
    DELETE FROM book_closings OUTPUT DELETED.id
    WHERE id = (SELECT TOP 1 id FROM book_closings WHERE user_id = @uid ORDER BY starts_on DESC)
  `);
  if (!r.recordset.length) return null;
  return current(userId, today);
}

module.exports = { closings, get, current, at, range, rangeAt, history, close, undoLast };
