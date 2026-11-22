const { sql, getPool } = require('../config/db');

/**
 * Category rules learned from corrections: when a transaction described as
 * "Indomaret" is moved to Groceries, "indomaret" means Groceries from then on.
 * The quick-entry parser checks them before its built-in word lists.
 */
const MAX_KEYWORD = 60;

/** The note as a keyword: lower case, single spaces; null if too short or just numbers. */
function keywordFrom(description) {
  const keyword = String(description || '')
    .toLowerCase()
    .replace(/[^a-z0-9 &'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_KEYWORD);
  return keyword.length >= 3 && /[a-z]/.test(keyword) ? keyword : null;
}

async function list(userId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .query('SELECT keyword, category_id AS categoryId FROM category_rules WHERE user_id = @uid ORDER BY LEN(keyword) DESC');
  return r.recordset;
}

/** Remembers that `description` belongs in `categoryId` (the latest correction wins). */
async function learn(userId, description, categoryId) {
  const keyword = keywordFrom(description);
  if (!keyword || !categoryId) return null;
  const pool = await getPool();
  await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('keyword', sql.NVarChar(MAX_KEYWORD), keyword)
    .input('cat', sql.Int, categoryId)
    .query(`
      IF EXISTS (SELECT 1 FROM categories WHERE id = @cat AND user_id = @uid)
        MERGE category_rules AS target
        USING (SELECT @uid AS user_id, @keyword AS keyword) AS src
          ON target.user_id = src.user_id AND target.keyword = src.keyword
        WHEN MATCHED THEN UPDATE SET category_id = @cat, updated_at = SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (user_id, keyword, category_id) VALUES (@uid, @keyword, @cat);
    `);
  return keyword;
}

module.exports = { list, learn, keywordFrom };
