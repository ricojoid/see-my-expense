const { sql, getPool, withTransaction } = require('../config/db');
const { badRequest, notFound, conflict } = require('../lib/http');
const { validateUsername, validatePassword } = require('../lib/validate');
const { hashPassword } = require('./auth.service');
const { seedUserDefaults } = require('./seed.service');

const ROLES = ['admin', 'user'];
// Children first, so foreign keys never block the delete.
// Order matters: children before what they reference.
const USER_OWNED_TABLES = [
  'category_rules',
  'book_closings',
  'goals', // goal_contributions go with them (ON DELETE CASCADE)
  'transactions', // telegram_messages go with them
  'recurring_transactions',
  'budgets',
  'categories',
  'accounts',
  'people',
  'push_subscriptions',
  'user_settings',
  'telegram_links',
  'telegram_link_codes',
];

async function list() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.id, u.username, u.role, u.created_at AS createdAt,
           (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS transactionCount
    FROM users u
    ORDER BY CASE u.role WHEN 'admin' THEN 0 ELSE 1 END, u.username
  `);
  return result.recordset;
}

async function create({ username, password, role = 'user' }) {
  const name = String(username || '').trim();
  const invalid = validateUsername(name) || validatePassword(password);
  if (invalid) throw badRequest(invalid);
  if (!ROLES.includes(role)) throw badRequest('role must be admin or user');

  const hash = await hashPassword(password);
  try {
    return await withTransaction(async (newRequest) => {
      const inserted = await newRequest()
        .input('username', sql.NVarChar(30), name)
        .input('hash', sql.VarChar(100), hash)
        .input('role', sql.VarChar(10), role)
        .query(`
          INSERT INTO users (username, password_hash, role)
          OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.created_at AS createdAt
          VALUES (@username, @hash, @role)
        `);
      const user = inserted.recordset[0];
      await seedUserDefaults(sql, newRequest, user.id);
      return { ...user, transactionCount: 0 };
    });
  } catch (err) {
    if (String(err.message).includes('UQ_users_username')) throw conflict('that username is already taken');
    throw err;
  }
}

async function findRole(pool, id) {
  const r = await pool.request().input('id', sql.Int, id).query('SELECT role FROM users WHERE id = @id');
  if (!r.recordset[0]) throw notFound('user not found');
  return r.recordset[0].role;
}

async function assertNotLastAdmin(pool, id) {
  if ((await findRole(pool, id)) !== 'admin') return;
  const r = await pool.request().query(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`);
  if (r.recordset[0].n <= 1) throw badRequest('there must always be at least one admin');
}

async function resetPassword(id, password) {
  const invalid = validatePassword(password);
  if (invalid) throw badRequest(invalid);
  const pool = await getPool();
  await findRole(pool, id);
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('hash', sql.VarChar(100), await hashPassword(password))
    .query('UPDATE users SET password_hash = @hash WHERE id = @id');
}

async function setRole(actorId, id, role) {
  if (!ROLES.includes(role)) throw badRequest('role must be admin or user');
  if (id === actorId) throw badRequest('you cannot change your own role');
  const pool = await getPool();
  if (role !== 'admin') await assertNotLastAdmin(pool, id);
  else await findRole(pool, id);
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('role', sql.VarChar(10), role)
    .query('UPDATE users SET role = @role WHERE id = @id');
}

async function remove(actorId, id) {
  if (id === actorId) throw badRequest('you cannot delete your own account');
  const pool = await getPool();
  await assertNotLastAdmin(pool, id);
  await withTransaction(async (newRequest) => {
    for (const table of USER_OWNED_TABLES) {
      await newRequest().input('id', sql.Int, id).query(`DELETE FROM ${table} WHERE user_id = @id`);
    }
    await newRequest().input('id', sql.Int, id).query('DELETE FROM users WHERE id = @id');
  });
}

module.exports = { ROLES, list, create, resetPassword, setRole, remove };
