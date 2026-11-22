const { sql } = require('../config/db');
const { badRequest } = require('../lib/http');

const OWNED_TABLES = ['accounts', 'categories', 'transactions', 'recurring_transactions', 'people'];

/** Returns the row's columns if it exists and belongs to the user, else null. */
async function findOwned(newRequest, table, id, userId, columns = 'id') {
  if (!OWNED_TABLES.includes(table)) throw new Error(`not an owned table: ${table}`);
  const result = await newRequest()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .query(`SELECT ${columns} FROM ${table} WHERE id = @id AND user_id = @uid`);
  return result.recordset[0] || null;
}

/** Throws 400 unless the category / account(s) referenced by a transaction belong to the user. */
async function assertTransactionRefs(newRequest, tx, userId) {
  if (!(await findOwned(newRequest, 'accounts', tx.accountId, userId))) throw badRequest('account not found');

  if (tx.type === 'transfer') {
    if (!(await findOwned(newRequest, 'accounts', tx.toAccountId, userId))) {
      throw badRequest('destination account not found');
    }
    return;
  }

  const category = await findOwned(newRequest, 'categories', tx.categoryId, userId, 'type');
  if (!category || category.type !== tx.type) throw badRequest(`${tx.type} category not found`);
}

module.exports = { findOwned, assertTransactionRefs };
