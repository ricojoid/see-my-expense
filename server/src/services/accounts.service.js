const { sql, getPool } = require('../config/db');
const { badRequest, notFound, conflict } = require('../lib/http');
const { validateName } = require('../lib/validate');

const DUPLICATE = 'UQ_accounts_user_name';

/** Signed effect of a transaction on account `a`. */
const BALANCE_DELTA = `
  CASE
    WHEN t.account_id = a.id AND t.type = 'income' THEN t.amount
    WHEN t.account_id = a.id THEN -t.amount
    WHEN t.to_account_id = a.id THEN t.amount
    ELSE 0
  END
`;

async function list(userId) {
  const pool = await getPool();
  const result = await pool.request().input('uid', sql.Int, userId).query(`
    SELECT a.id, a.name, ISNULL(SUM(${BALANCE_DELTA}), 0) AS balance, COUNT(t.id) AS usageCount
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id OR t.to_account_id = a.id
    WHERE a.user_id = @uid
    GROUP BY a.id, a.name
    ORDER BY a.id
  `);
  return result.recordset.map((r) => ({ ...r, balance: Number(r.balance) }));
}

function parseName(name) {
  const checked = validateName(name, 'account name');
  if (checked.error) throw badRequest(checked.error);
  return checked.value;
}

async function create(userId, { name }) {
  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input('uid', sql.Int, userId)
      .input('name', sql.NVarChar(50), parseName(name))
      .query('INSERT INTO accounts (user_id, name) OUTPUT INSERTED.id, INSERTED.name VALUES (@uid, @name)');
    return { ...result.recordset[0], balance: 0, usageCount: 0 };
  } catch (err) {
    if (String(err.message).includes(DUPLICATE)) throw conflict('you already have an account with that name');
    throw err;
  }
}

async function rename(userId, id, { name }) {
  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('uid', sql.Int, userId)
      .input('name', sql.NVarChar(50), parseName(name))
      .query('UPDATE accounts SET name = @name OUTPUT INSERTED.id, INSERTED.name WHERE id = @id AND user_id = @uid');
    if (!result.recordset[0]) throw notFound('account not found');
    return result.recordset[0];
  } catch (err) {
    if (String(err.message).includes(DUPLICATE)) throw conflict('you already have an account with that name');
    throw err;
  }
}

async function remove(userId, id) {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, id).input('uid', sql.Int, userId).query(`
    SELECT
      (SELECT COUNT(*) FROM accounts WHERE id = @id AND user_id = @uid) AS owned,
      (SELECT COUNT(*) FROM accounts WHERE user_id = @uid) AS total,
      (SELECT COUNT(*) FROM transactions WHERE account_id = @id OR to_account_id = @id)
        + (SELECT COUNT(*) FROM recurring_transactions WHERE account_id = @id) AS used
  `);
  const { owned, total, used } = r.recordset[0];
  if (!owned) throw notFound('account not found');
  if (total <= 1) throw conflict('you need at least one account');
  if (used > 0) throw conflict('this account still has transactions or recurring rules');
  await pool.request().input('id', sql.Int, id).query('DELETE FROM accounts WHERE id = @id');
}

module.exports = { list, create, rename, remove };
