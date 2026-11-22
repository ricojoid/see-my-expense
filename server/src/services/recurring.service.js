const { sql, getPool, withTransaction } = require('../config/db');
const { todayLocal, dueRuns } = require('../lib/dates');
const { notFound } = require('../lib/http');
const { assertTransactionRefs } = require('./ownership.service');

const SELECT_RULE = `
  SELECT r.id, r.type, r.category_id AS categoryId, c.name AS category,
         r.account_id AS accountId, a.name AS account, r.amount, r.description,
         r.day_of_month AS dayOfMonth, CONVERT(char(10), r.next_run_on, 23) AS nextRunOn,
         CAST(r.active AS bit) AS active
  FROM recurring_transactions r
  JOIN categories c ON c.id = r.category_id
  JOIN accounts a ON a.id = r.account_id
`;

const toRule = (row) => ({ ...row, amount: Number(row.amount), active: Boolean(row.active) });

async function list(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('uid', sql.Int, userId)
    .query(`${SELECT_RULE} WHERE r.user_id = @uid ORDER BY r.active DESC, r.day_of_month, r.id`);
  return result.recordset.map(toRule);
}

/** `tx` is a validated income/expense payload; its date becomes the first run. */
async function create(userId, tx) {
  const pool = await getPool();
  const newRequest = () => pool.request();
  await assertTransactionRefs(newRequest, tx, userId);

  const result = await newRequest()
    .input('uid', sql.Int, userId)
    .input('type', sql.VarChar(10), tx.type)
    .input('cat', sql.Int, tx.categoryId)
    .input('acc', sql.Int, tx.accountId)
    .input('amount', sql.Decimal(14, 2), tx.amount)
    .input('desc', sql.NVarChar(255), tx.description)
    .input('day', sql.TinyInt, Number(tx.occurredOn.slice(8, 10)))
    .input('start', sql.VarChar(10), tx.occurredOn)
    .query(`
      INSERT INTO recurring_transactions (user_id, type, category_id, account_id, amount, description, day_of_month, next_run_on)
      OUTPUT INSERTED.id
      VALUES (@uid, @type, @cat, @acc, @amount, @desc, @day, CAST(@start AS date))
    `);

  await materialize(userId);
  const row = await newRequest()
    .input('id', sql.Int, result.recordset[0].id)
    .query(`${SELECT_RULE} WHERE r.id = @id`);
  return toRule(row.recordset[0]);
}

async function setActive(userId, id, active) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .input('active', sql.Bit, active ? 1 : 0)
    .query('UPDATE recurring_transactions SET active = @active WHERE id = @id AND user_id = @uid');
  if (result.rowsAffected[0] === 0) throw notFound('recurring rule not found');
  if (active) await materialize(userId);
}

/** Deleting a rule keeps the transactions it already created. */
async function remove(userId, id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .query('DELETE FROM recurring_transactions WHERE id = @id AND user_id = @uid');
  if (result.rowsAffected[0] === 0) throw notFound('recurring rule not found');
}

const running = new Map();

/**
 * Books the transactions that active rules owe up to today. Each rule is
 * advanced with a compare-and-set on next_run_on inside a SQL transaction, so
 * concurrent calls can never book the same run twice.
 */
function materialize(userId) {
  if (!running.has(userId)) {
    running.set(userId, bookDueRuns(userId).finally(() => running.delete(userId)));
  }
  return running.get(userId);
}

async function bookDueRuns(userId) {
  const pool = await getPool();
  const today = todayLocal();
  const due = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('today', sql.VarChar(10), today)
    .query(`
      SELECT id, type, category_id AS categoryId, account_id AS accountId, amount, description,
             day_of_month AS dayOfMonth, CONVERT(char(10), next_run_on, 23) AS nextRunOn
      FROM recurring_transactions
      WHERE user_id = @uid AND active = 1 AND next_run_on <= CAST(@today AS date)
    `);

  let booked = 0;
  for (const rule of due.recordset) {
    const { dates, next } = dueRuns(rule.nextRunOn, rule.dayOfMonth, today);
    if (!dates.length) continue;

    booked += await withTransaction(async (newRequest) => {
      const claim = await newRequest()
        .input('id', sql.Int, rule.id)
        .input('old', sql.VarChar(10), rule.nextRunOn)
        .input('next', sql.VarChar(10), next)
        .query(`
          UPDATE recurring_transactions SET next_run_on = CAST(@next AS date)
          WHERE id = @id AND next_run_on = CAST(@old AS date)
        `);
      if (claim.rowsAffected[0] !== 1) return 0;

      for (const date of dates) {
        await newRequest()
          .input('uid', sql.Int, userId)
          .input('type', sql.VarChar(10), rule.type)
          .input('cat', sql.Int, rule.categoryId)
          .input('acc', sql.Int, rule.accountId)
          .input('amount', sql.Decimal(14, 2), rule.amount)
          .input('desc', sql.NVarChar(255), rule.description)
          .input('date', sql.VarChar(10), date)
          .input('rid', sql.Int, rule.id)
          .query(`
            INSERT INTO transactions (user_id, type, category_id, account_id, amount, description, occurred_on, recurring_id)
            VALUES (@uid, @type, @cat, @acc, @amount, @desc, CAST(@date AS date), @rid)
          `);
      }
      return dates.length;
    });
  }
  return booked;
}

module.exports = { list, create, setActive, remove, materialize };
