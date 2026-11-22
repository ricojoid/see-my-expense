const { sql, getPool } = require('../config/db');
const { badRequest, notFound, conflict } = require('../lib/http');
const { validateName } = require('../lib/validate');
const { findOwned } = require('./ownership.service');
const { DEBT_CATEGORY } = require('./seed.service');

const DUPLICATE = 'UQ_people_user_name';

/**
 * A person's balance is what changed hands with them:
 * money you gave (expense) counts up, money you got (income) counts down.
 * Positive: they owe you. Negative: you owe them.
 */
async function list(userId) {
  const pool = await getPool();
  const result = await pool.request().input('uid', sql.Int, userId).query(`
    SELECT p.id, p.name,
           ISNULL(SUM(CASE t.type WHEN 'expense' THEN t.amount WHEN 'income' THEN -t.amount END), 0) AS balance,
           ISNULL(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) AS given,
           ISNULL(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) AS received,
           COUNT(t.id) AS count,
           CONVERT(char(10), MAX(t.occurred_on), 23) AS lastOn
    FROM people p
    LEFT JOIN transactions t ON t.person_id = p.id
    WHERE p.user_id = @uid
    GROUP BY p.id, p.name
    ORDER BY MAX(t.occurred_on) DESC, p.name
  `);
  return result.recordset.map((r) => ({
    ...r,
    balance: Number(r.balance),
    given: Number(r.given),
    received: Number(r.received),
  }));
}

function parseName(name) {
  const checked = validateName(name, 'name');
  if (checked.error) throw badRequest(checked.error);
  return checked.value;
}

const duplicateGuard = (err) => {
  if (String(err.message).includes(DUPLICATE)) throw conflict('you already have someone with that name');
  throw err;
};

async function rename(userId, id, { name }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .input('name', sql.NVarChar(50), parseName(name))
    .query('UPDATE people SET name = @name OUTPUT INSERTED.id, INSERTED.name WHERE id = @id AND user_id = @uid')
    .catch(duplicateGuard);
  if (!result.recordset[0]) throw notFound('person not found');
  return result.recordset[0];
}

/** Removes the person; their transactions stay (unlinked) so balances and history are unchanged. */
async function remove(userId, id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .query('DELETE FROM people WHERE id = @id AND user_id = @uid');
  if (result.rowsAffected[0] === 0) throw notFound('person not found');
}

async function findOrCreateByName(newRequest, userId, name) {
  const found = await newRequest()
    .input('uid', sql.Int, userId)
    .input('name', sql.NVarChar(50), name)
    .query('SELECT id FROM people WHERE user_id = @uid AND LOWER(name) = LOWER(@name)'); // "budi" finds "Budi"
  if (found.recordset[0]) return found.recordset[0].id;
  const created = await newRequest()
    .input('uid', sql.Int, userId)
    .input('name', sql.NVarChar(50), name)
    .query('INSERT INTO people (user_id, name) OUTPUT INSERTED.id VALUES (@uid, @name)')
    .catch(duplicateGuard);
  return created.recordset[0].id;
}

async function debtCategoryId(newRequest, userId, type) {
  const params = () =>
    newRequest().input('uid', sql.Int, userId).input('name', sql.NVarChar(50), DEBT_CATEGORY).input('type', sql.VarChar(10), type);
  const found = await params().query('SELECT id FROM categories WHERE user_id = @uid AND name = @name AND type = @type');
  if (found.recordset[0]) return found.recordset[0].id;
  const created = await params().query('INSERT INTO categories (user_id, name, type) OUTPUT INSERTED.id VALUES (@uid, @name, @type)');
  return created.recordset[0].id;
}

/**
 * For a validated transaction linked to a person: checks or creates the person
 * and files it under the debt category. Other transactions pass through.
 */
async function resolveDebt(newRequest, userId, tx) {
  if (!tx.personId && !tx.personName) return { ...tx, personId: null };

  let { personId } = tx;
  if (personId) {
    if (!(await findOwned(newRequest, 'people', personId, userId))) throw badRequest('person not found');
  } else {
    personId = await findOrCreateByName(newRequest, userId, tx.personName);
  }
  return { ...tx, personId, categoryId: await debtCategoryId(newRequest, userId, tx.type) };
}

module.exports = { list, rename, remove, resolveDebt, DEBT_CATEGORY };
