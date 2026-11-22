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

/** Accounts with their balance: the opening balance plus every transaction in or out. */
async function list(userId) {
  const pool = await getPool();
  const result = await pool.request().input('uid', sql.Int, userId).query(`
    SELECT a.id, a.name, a.opening_balance + ISNULL(SUM(${BALANCE_DELTA}), 0) AS balance, COUNT(t.id) AS usageCount
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id OR t.to_account_id = a.id
    WHERE a.user_id = @uid
    GROUP BY a.id, a.name, a.opening_balance
    ORDER BY a.id
  `);
  return result.recordset.map((r) => ({ ...r, balance: Number(r.balance) }));
}

/**
 * Makes the balance read `rawBalance` today (what the bank or e-wallet app
 * shows) by moving the opening balance. Adds no transaction, so it never
 * counts as income or spending.
 */
async function setBalance(userId, id, rawBalance) {
  const balance = Number(rawBalance);
  if (!Number.isFinite(balance) || Math.abs(balance) > 999999999999) throw badRequest('balance must be a number');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .input('balance', sql.Decimal(14, 2), Math.round(balance))
    .query(`
      DECLARE @moved DECIMAL(14,2) = (
        SELECT ISNULL(SUM(CASE
          WHEN t.account_id = @id AND t.type = 'income' THEN t.amount
          WHEN t.account_id = @id THEN -t.amount
          ELSE t.amount -- in by transfer
        END), 0)
        FROM transactions t WHERE t.user_id = @uid AND (t.account_id = @id OR t.to_account_id = @id)
      );
      UPDATE accounts SET opening_balance = @balance - @moved WHERE id = @id AND user_id = @uid
    `);
  if (!result.rowsAffected[0]) throw notFound('account not found');
  return (await list(userId)).find((a) => a.id === id);
}

function parseName(name) {
  const checked = validateName(name, 'account name');
  if (checked.error) throw badRequest(checked.error);
  return checked.value;
}

/** `balance` (optional): what it holds today. */
/**
 * Checks { accountId: amount } (e.g. { 3: 200000, 4: 0 } when closing the
 * books) and returns it as [[id, amount]]; throws before anything changes.
 */
async function checkBalances(userId, balances) {
  if (typeof balances !== 'object' || balances === null || Array.isArray(balances)) throw badRequest('balances must be { accountId: amount }');
  const owned = new Set((await list(userId)).map((a) => a.id));
  return Object.entries(balances).map(([id, raw]) => {
    const balance = Number(raw);
    if (!owned.has(Number(id))) throw badRequest('unknown account');
    if (!Number.isFinite(balance) || Math.abs(balance) > 999999999999) throw badRequest('balance must be a number');
    return [Number(id), balance];
  });
}

/** Sets balances checked by checkBalances. */
async function setBalances(userId, checked) {
  for (const [id, balance] of checked) await setBalance(userId, id, balance);
  return list(userId);
}

async function create(userId, { name, balance }) {
  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input('uid', sql.Int, userId)
      .input('name', sql.NVarChar(50), parseName(name))
      .query('INSERT INTO accounts (user_id, name) OUTPUT INSERTED.id, INSERTED.name VALUES (@uid, @name)');
    const account = { ...result.recordset[0], balance: 0, usageCount: 0 };
    return balance ? setBalance(userId, account.id, balance) : account;
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

module.exports = { list, setBalance, checkBalances, setBalances, create, rename, remove };
