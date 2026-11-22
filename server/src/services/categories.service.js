const { sql, getPool } = require('../config/db');
const { badRequest, notFound, conflict } = require('../lib/http');
const { CATEGORY_TYPES, validateName } = require('../lib/validate');

const DUPLICATE = 'UQ_categories_user_name_type';

/** Most-used first within each type, so the quick-pick chips put favourites up front. */
async function list(userId) {
  const pool = await getPool();
  const result = await pool.request().input('uid', sql.Int, userId).query(`
    SELECT c.id, c.name, c.type,
           (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS usageCount
    FROM categories c
    WHERE c.user_id = @uid
    ORDER BY c.type, usageCount DESC, c.name
  `);
  return result.recordset;
}

function parse({ name, type }) {
  const checked = validateName(name, 'category name');
  if (checked.error) throw badRequest(checked.error);
  if (!CATEGORY_TYPES.includes(type)) throw badRequest('type must be income or expense');
  return { name: checked.value, type };
}

async function countUsage(pool, id) {
  const r = await pool.request().input('id', sql.Int, id).query(`
    SELECT (SELECT COUNT(*) FROM transactions WHERE category_id = @id)
         + (SELECT COUNT(*) FROM recurring_transactions WHERE category_id = @id) AS n
  `);
  return r.recordset[0].n;
}

async function create(userId, body) {
  const { name, type } = parse(body);
  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input('uid', sql.Int, userId)
      .input('name', sql.NVarChar(50), name)
      .input('type', sql.VarChar(10), type)
      .query(`
        INSERT INTO categories (user_id, name, type)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.type
        VALUES (@uid, @name, @type)
      `);
    return { ...result.recordset[0], usageCount: 0 };
  } catch (err) {
    if (String(err.message).includes(DUPLICATE)) throw conflict('you already have a category with that name');
    throw err;
  }
}

async function update(userId, id, body) {
  const { name, type } = parse(body);
  const pool = await getPool();
  const current = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .query('SELECT type FROM categories WHERE id = @id AND user_id = @uid');
  if (!current.recordset[0]) throw notFound('category not found');
  if (current.recordset[0].type !== type && (await countUsage(pool, id)) > 0) {
    throw conflict('this category is in use, so its type cannot change');
  }

  try {
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(50), name)
      .input('type', sql.VarChar(10), type)
      .query(`
        UPDATE categories SET name = @name, type = @type
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.type
        WHERE id = @id
      `);
    return result.recordset[0];
  } catch (err) {
    if (String(err.message).includes(DUPLICATE)) throw conflict('you already have a category with that name');
    throw err;
  }
}

/** Budgets on the category go with it (ON DELETE CASCADE); transactions block the delete. */
async function remove(userId, id) {
  const pool = await getPool();
  const owned = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .query('SELECT id FROM categories WHERE id = @id AND user_id = @uid');
  if (!owned.recordset[0]) throw notFound('category not found');
  if ((await countUsage(pool, id)) > 0) {
    throw conflict('this category still has transactions or recurring rules');
  }
  await pool.request().input('id', sql.Int, id).query('DELETE FROM categories WHERE id = @id');
}

module.exports = { list, create, update, remove };
