const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { sql, getPool } = require('../config/db');
const { HttpError, badRequest } = require('../lib/http');
const { validatePassword } = require('../lib/validate');

const BCRYPT_ROUNDS = 10;
// Comparing against a throwaway hash keeps the response time the same
// whether or not the username exists.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);
const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.tokenTtl });
}

/** Returns the token payload, or null when it is invalid or expired. */
function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

async function findUserById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT id, username, role FROM users WHERE id = @id');
  return result.recordset[0] || null;
}

/** Returns { token, user } or throws 401. */
async function login(username, password) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('username', sql.NVarChar(30), username)
    .query('SELECT id, username, role, password_hash AS hash FROM users WHERE username = @username');
  const row = result.recordset[0];

  const ok = await verifyPassword(password, row ? row.hash : DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, 'wrong username or password');

  const user = { id: row.id, username: row.username, role: row.role };
  return { token: signToken(user), user };
}

async function changePassword(userId, currentPassword, newPassword) {
  const invalid = validatePassword(newPassword);
  if (invalid) throw badRequest(invalid);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, userId)
    .query('SELECT password_hash AS hash FROM users WHERE id = @id');
  if (!(await verifyPassword(String(currentPassword || ''), result.recordset[0].hash))) {
    throw badRequest('current password is wrong');
  }

  await pool
    .request()
    .input('id', sql.Int, userId)
    .input('hash', sql.VarChar(100), await hashPassword(newPassword))
    .query('UPDATE users SET password_hash = @hash WHERE id = @id');
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, findUserById, login, changePassword };
