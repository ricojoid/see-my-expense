const { sql, getPool } = require('../config/db');
const { badRequest, notFound } = require('../lib/http');
const { isValidDate, todayLocal } = require('../lib/dates');
const { validateAmount, validateName } = require('../lib/validate');

/**
 * Savings goals ("Laptop, Rp 15.000.000 by June 2027") and the money put
 * towards them. Saving isn't spending, so these aren't transactions.
 */

/** Whole months from `today` until `deadline`, at least 1 (the current month counts). */
function monthsLeft(today, deadline) {
  const [ty, tm] = today.split('-').map(Number);
  const [dy, dm] = deadline.split('-').map(Number);
  return Math.max(1, (dy - ty) * 12 + (dm - tm) + 1);
}

function withProgress(row, today = todayLocal()) {
  const target = Number(row.target);
  const saved = Number(row.saved);
  const remaining = Math.max(0, target - saved);
  const goal = {
    id: row.id,
    name: row.name,
    target,
    saved,
    remaining,
    percent: Math.min(100, Math.round((saved / target) * 100)),
    deadline: row.deadline,
    done: saved >= target,
    perMonth: null,
    overdue: false,
  };
  if (row.deadline && !goal.done) {
    goal.overdue = row.deadline < today;
    goal.perMonth = goal.overdue ? remaining : Math.ceil(remaining / monthsLeft(today, row.deadline));
  }
  return goal;
}

const SELECT = `
  SELECT g.id, g.name, g.target, CONVERT(char(10), g.deadline, 23) AS deadline,
         ISNULL((SELECT SUM(c.amount) FROM goal_contributions c WHERE c.goal_id = g.id), 0) AS saved
  FROM goals g
`;

async function list(userId) {
  const pool = await getPool();
  const r = await pool.request().input('uid', sql.Int, userId).query(`${SELECT} WHERE g.user_id = @uid ORDER BY g.created_at`);
  return r.recordset.map((row) => withProgress(row));
}

async function get(userId, id) {
  const pool = await getPool();
  const r = await pool.request().input('uid', sql.Int, userId).input('id', sql.Int, id).query(`${SELECT} WHERE g.user_id = @uid AND g.id = @id`);
  if (!r.recordset[0]) throw notFound('goal not found');
  return withProgress(r.recordset[0]);
}

function parseGoal({ name, target, deadline }) {
  const checkedName = validateName(name, 'goal name');
  if (checkedName.error) throw badRequest(checkedName.error);
  const checkedTarget = validateAmount(target);
  if (checkedTarget.error) throw badRequest(checkedTarget.error.replace('amount', 'target'));
  if (deadline != null && deadline !== '' && !isValidDate(deadline)) throw badRequest('deadline must be YYYY-MM-DD');
  return { name: checkedName.value, target: checkedTarget.value, deadline: deadline || null };
}

async function create(userId, body = {}) {
  const goal = parseGoal(body);
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('name', sql.NVarChar(60), goal.name)
    .input('target', sql.Decimal(14, 2), goal.target)
    .input('deadline', sql.VarChar(10), goal.deadline)
    .query('INSERT INTO goals (user_id, name, target, deadline) OUTPUT INSERTED.id VALUES (@uid, @name, @target, CAST(@deadline AS date))');
  return get(userId, r.recordset[0].id);
}

async function update(userId, id, body = {}) {
  const goal = parseGoal(body);
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(60), goal.name)
    .input('target', sql.Decimal(14, 2), goal.target)
    .input('deadline', sql.VarChar(10), goal.deadline)
    .query('UPDATE goals SET name = @name, target = @target, deadline = CAST(@deadline AS date) WHERE id = @id AND user_id = @uid');
  if (!r.rowsAffected[0]) throw notFound('goal not found');
  return get(userId, id);
}

async function remove(userId, id) {
  const pool = await getPool();
  const r = await pool.request().input('uid', sql.Int, userId).input('id', sql.Int, id).query('DELETE FROM goals WHERE id = @id AND user_id = @uid');
  if (!r.rowsAffected[0]) throw notFound('goal not found');
}

/** Puts money towards a goal (`withdraw: true` takes it back out). Returns the updated goal. */
async function contribute(userId, id, { amount, withdraw = false, note, occurredOn } = {}) {
  const checked = validateAmount(amount);
  if (checked.error) throw badRequest(checked.error);
  const date = occurredOn || todayLocal();
  if (!isValidDate(date)) throw badRequest('date must be YYYY-MM-DD');
  const goal = await get(userId, id);
  if (withdraw && checked.value > goal.saved) throw badRequest('you can withdraw at most what is saved');
  const pool = await getPool();
  await pool
    .request()
    .input('goal', sql.Int, id)
    .input('amount', sql.Decimal(14, 2), withdraw ? -checked.value : checked.value)
    .input('date', sql.VarChar(10), date)
    .input('note', sql.NVarChar(100), typeof note === 'string' && note.trim() ? note.trim().slice(0, 100) : null)
    .query('INSERT INTO goal_contributions (goal_id, amount, occurred_on, note) VALUES (@goal, @amount, CAST(@date AS date), @note)');
  return get(userId, id);
}

async function history(userId, id) {
  await get(userId, id); // ownership
  const pool = await getPool();
  const r = await pool
    .request()
    .input('goal', sql.Int, id)
    .query(`
      SELECT id, amount, CONVERT(char(10), occurred_on, 23) AS occurredOn, note
      FROM goal_contributions WHERE goal_id = @goal ORDER BY occurred_on DESC, id DESC
    `);
  return r.recordset.map((c) => ({ ...c, amount: Number(c.amount) }));
}

/** A goal whose name contains `text` (case-insensitive), for "nabung laptop 500k". */
async function findByName(userId, text) {
  const needle = String(text || '').toLowerCase().trim();
  if (!needle) return null;
  const goals = await list(userId);
  return goals.find((g) => g.name.toLowerCase() === needle) || goals.find((g) => g.name.toLowerCase().includes(needle)) || null;
}

module.exports = { list, get, create, update, remove, contribute, history, findByName, monthsLeft, withProgress };
