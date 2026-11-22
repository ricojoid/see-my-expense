const { sql, getPool, withTransaction } = require('../config/db');
const { badRequest, notFound } = require('../lib/http');
const { lastWeek, monthRange, shiftMonth, todayLocal } = require('../lib/dates');
const { percentChange } = require('../lib/format');
const { parseCsv, toCsv, mapImportRows } = require('../lib/csv');
const { TX_TYPES, toId } = require('../lib/validate');
const { assertTransactionRefs } = require('./ownership.service');
const { resolveDebt } = require('./people.service');

const SELECT_TX = `
  SELECT t.id, t.type, t.amount, t.description,
         CONVERT(char(10), t.occurred_on, 23) AS occurredOn,
         t.category_id AS categoryId, c.name AS category,
         t.account_id AS accountId, a.name AS account,
         t.to_account_id AS toAccountId, a2.name AS toAccount,
         t.recurring_id AS recurringId,
         t.person_id AS personId, p.name AS person
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts a2 ON a2.id = t.to_account_id
  LEFT JOIN people p ON p.id = t.person_id
`;

const toTx = (row) => ({ ...row, amount: Number(row.amount) });
const escapeLike = (s) => s.replace(/[\\%_[]/g, (ch) => `\\${ch}`);

/** Builds the WHERE clause shared by list and export. */
function buildFilters(request, userId, filters) {
  const where = ['t.user_id = @uid'];
  request.input('uid', sql.Int, userId);

  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    where.push('t.occurred_on >= CAST(@start AS date) AND t.occurred_on < CAST(@end AS date)');
    request.input('start', sql.VarChar(10), start).input('end', sql.VarChar(10), end);
  }
  if (filters.type && TX_TYPES.includes(filters.type)) {
    where.push('t.type = @type');
    request.input('type', sql.VarChar(10), filters.type);
  }
  const accountId = toId(filters.accountId);
  if (accountId) {
    where.push('(t.account_id = @acc OR t.to_account_id = @acc)');
    request.input('acc', sql.Int, accountId);
  }
  const categoryId = toId(filters.categoryId);
  if (categoryId) {
    where.push('t.category_id = @cat');
    request.input('cat', sql.Int, categoryId);
  }
  const personId = toId(filters.personId);
  if (personId) {
    where.push('t.person_id = @person');
    request.input('person', sql.Int, personId);
  }
  const q = String(filters.q || '').trim().slice(0, 100);
  if (q) {
    where.push(
      `(t.description LIKE @q ESCAPE '\\' OR c.name LIKE @q ESCAPE '\\' OR a.name LIKE @q ESCAPE '\\' OR p.name LIKE @q ESCAPE '\\')`
    );
    request.input('q', sql.NVarChar(110), `%${escapeLike(q)}%`);
  }
  return `WHERE ${where.join(' AND ')}`;
}

async function list(userId, filters) {
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 20, 1), 100);
  const page = Math.max(Number(filters.page) || 1, 1);

  const pool = await getPool();
  const request = pool.request();
  const where = buildFilters(request, userId, filters);
  request.input('offset', sql.Int, (page - 1) * pageSize).input('limit', sql.Int, pageSize);

  const result = await request.query(`
    SELECT COUNT(*) AS total
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN people p ON p.id = t.person_id
    ${where};

    ${SELECT_TX}
    ${where}
    ORDER BY t.occurred_on DESC, t.id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);

  return {
    items: result.recordsets[1].map(toTx),
    total: result.recordsets[0][0].total,
    page,
    pageSize,
  };
}

/** Income / expense / net for the month, plus the all-time balance across accounts. */
async function summary(userId, month) {
  const { start, end } = monthRange(month);
  const pool = await getPool();
  const result = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('start', sql.VarChar(10), start)
    .input('end', sql.VarChar(10), end)
    .query(`
      SELECT
        ISNULL(SUM(CASE WHEN type = 'income'  AND occurred_on >= CAST(@start AS date) AND occurred_on < CAST(@end AS date) THEN amount END), 0) AS income,
        ISNULL(SUM(CASE WHEN type = 'expense' AND occurred_on >= CAST(@start AS date) AND occurred_on < CAST(@end AS date) THEN amount END), 0) AS expense,
        ISNULL(SUM(CASE type WHEN 'income' THEN amount WHEN 'expense' THEN -amount ELSE 0 END), 0) AS balance
      FROM transactions
      WHERE user_id = @uid
    `);
  const row = result.recordset[0];
  const income = Number(row.income);
  const expense = Number(row.expense);
  return { month, income, expense, net: income - expense, balance: Number(row.balance) };
}

/** Spending by category for `month`, and a 6-month income/expense trend ending at it. */
async function stats(userId, month, trendMonths = 6) {
  const { start, end } = monthRange(month);
  const trendStart = monthRange(shiftMonth(month, -(trendMonths - 1))).start;
  const pool = await getPool();
  const result = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('start', sql.VarChar(10), start)
    .input('end', sql.VarChar(10), end)
    .input('trendStart', sql.VarChar(10), trendStart)
    .query(`
      SELECT c.id AS categoryId, c.name AS category, t.type, SUM(t.amount) AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = @uid AND t.occurred_on >= CAST(@start AS date) AND t.occurred_on < CAST(@end AS date)
      GROUP BY c.id, c.name, t.type
      ORDER BY total DESC;

      SELECT CONVERT(char(7), occurred_on, 126) AS month, type, SUM(amount) AS total
      FROM transactions
      WHERE user_id = @uid AND type <> 'transfer'
        AND occurred_on >= CAST(@trendStart AS date) AND occurred_on < CAST(@end AS date)
      GROUP BY CONVERT(char(7), occurred_on, 126), type;
    `);

  const [byCategory, trendRows] = result.recordsets;
  const trend = Array.from({ length: trendMonths }, (_, i) => ({
    month: shiftMonth(month, i - (trendMonths - 1)),
    income: 0,
    expense: 0,
  }));
  for (const row of trendRows) {
    const bucket = trend.find((b) => b.month === row.month);
    if (bucket) bucket[row.type] = Number(row.total);
  }

  const pick = (type) =>
    byCategory
      .filter((r) => r.type === type)
      .map((r) => ({ categoryId: r.categoryId, category: r.category, total: Number(r.total) }));

  return { month, expenseByCategory: pick('expense'), incomeByCategory: pick('income'), trend };
}

/**
 * Spending in the last full Monday-Sunday week before `today`: total, the week
 * before for comparison, the top category and the number of expenses.
 */
async function weeklyRecap(userId, today = todayLocal()) {
  const { start, end, previousStart } = lastWeek(today);
  const pool = await getPool();
  const result = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('start', sql.VarChar(10), start)
    .input('end', sql.VarChar(10), end)
    .input('prev', sql.VarChar(10), previousStart)
    .query(`
      SELECT
        ISNULL(SUM(CASE WHEN occurred_on >= CAST(@start AS date) THEN amount END), 0) AS total,
        ISNULL(SUM(CASE WHEN occurred_on < CAST(@start AS date) THEN amount END), 0) AS previousTotal,
        COUNT(CASE WHEN occurred_on >= CAST(@start AS date) THEN 1 END) AS count
      FROM transactions
      WHERE user_id = @uid AND type = 'expense'
        AND occurred_on >= CAST(@prev AS date) AND occurred_on < CAST(@end AS date);

      SELECT TOP 1 c.name AS category, SUM(t.amount) AS total
      FROM transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = @uid AND t.type = 'expense'
        AND t.occurred_on >= CAST(@start AS date) AND t.occurred_on < CAST(@end AS date)
      GROUP BY c.name
      ORDER BY SUM(t.amount) DESC;
    `);
  const [totals, top] = result.recordsets;
  const total = Number(totals[0].total);
  const previousTotal = Number(totals[0].previousTotal);
  return {
    start,
    end,
    total,
    previousTotal,
    changePct: percentChange(total, previousTotal),
    count: totals[0].count,
    topCategory: top[0] ? { name: top[0].category, total: Number(top[0].total) } : null,
  };
}

/** Spent and earned in [start, end), kept apart, plus the number of expenses. */
async function totalsBetween(userId, start, end) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('start', sql.VarChar(10), start)
    .input('end', sql.VarChar(10), end)
    .query(`
      SELECT ISNULL(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense,
             ISNULL(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
             COUNT(CASE WHEN type = 'expense' THEN 1 END) AS expenseCount
      FROM transactions
      WHERE user_id = @uid AND occurred_on >= CAST(@start AS date) AND occurred_on < CAST(@end AS date)
    `);
  const row = r.recordset[0];
  return { expense: Number(row.expense), income: Number(row.income), expenseCount: row.expenseCount };
}

/** The account the user paid with most recently (a sensible default), or null. */
async function lastAccountId(userId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .query('SELECT TOP 1 account_id AS id FROM transactions WHERE user_id = @uid ORDER BY created_at DESC, id DESC');
  return r.recordset[0]?.id ?? null;
}

async function countOn(userId, date) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('date', sql.VarChar(10), date)
    .query('SELECT COUNT(*) AS n FROM transactions WHERE user_id = @uid AND occurred_on = CAST(@date AS date)');
  return r.recordset[0].n;
}

async function findById(userId, id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .query(`${SELECT_TX} WHERE t.id = @id AND t.user_id = @uid`);
  if (!result.recordset[0]) throw notFound('transaction not found');
  return toTx(result.recordset[0]);
}

function bindTx(request, tx) {
  return request
    .input('type', sql.VarChar(10), tx.type)
    .input('cat', sql.Int, tx.categoryId)
    .input('acc', sql.Int, tx.accountId)
    .input('toAcc', sql.Int, tx.toAccountId)
    .input('amount', sql.Decimal(14, 2), tx.amount)
    .input('desc', sql.NVarChar(255), tx.description)
    .input('date', sql.VarChar(10), tx.occurredOn)
    .input('person', sql.Int, tx.personId ?? null);
}

/** `tx` is the output of validateTransaction(). Debt links are resolved in the same DB transaction. */
async function create(userId, tx) {
  const id = await withTransaction(async (newRequest) => {
    const resolved = await resolveDebt(newRequest, userId, tx);
    await assertTransactionRefs(newRequest, resolved, userId);
    const result = await bindTx(newRequest().input('uid', sql.Int, userId), resolved).query(`
      INSERT INTO transactions (user_id, type, category_id, account_id, to_account_id, person_id, amount, description, occurred_on)
      OUTPUT INSERTED.id
      VALUES (@uid, @type, @cat, @acc, @toAcc, @person, @amount, @desc, CAST(@date AS date))
    `);
    return result.recordset[0].id;
  });
  return findById(userId, id);
}

async function update(userId, id, tx) {
  await withTransaction(async (newRequest) => {
    const resolved = await resolveDebt(newRequest, userId, tx);
    await assertTransactionRefs(newRequest, resolved, userId);
    const result = await bindTx(newRequest().input('id', sql.Int, id).input('uid', sql.Int, userId), resolved).query(`
      UPDATE transactions
      SET type = @type, category_id = @cat, account_id = @acc, to_account_id = @toAcc, person_id = @person,
          amount = @amount, description = @desc, occurred_on = CAST(@date AS date)
      WHERE id = @id AND user_id = @uid
    `);
    if (result.rowsAffected[0] === 0) throw notFound('transaction not found');
  });
  return findById(userId, id);
}

async function remove(userId, id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.Int, userId)
    .query('DELETE FROM transactions WHERE id = @id AND user_id = @uid');
  if (result.rowsAffected[0] === 0) throw notFound('transaction not found');
}

const CSV_HEADER = ['date', 'type', 'category', 'amount', 'description', 'account', 'to_account'];

async function exportCsv(userId, filters) {
  const pool = await getPool();
  const request = pool.request();
  const where = buildFilters(request, userId, filters);
  const result = await request.query(`${SELECT_TX} ${where} ORDER BY t.occurred_on, t.id`);
  const rows = result.recordset.map((t) => [
    t.occurredOn,
    t.type,
    t.category || '',
    Number(t.amount),
    t.description || '',
    t.account,
    t.toAccount || '',
  ]);
  // BOM so Excel opens UTF-8 correctly.
  return `﻿${toCsv([CSV_HEADER, ...rows])}`;
}

/**
 * Imports CSV text all-or-nothing. Unknown categories and accounts are
 * created on the fly. Returns { imported, createdCategories, createdAccounts }.
 */
async function importCsv(userId, text) {
  const { records, errors } = mapImportRows(parseCsv(text));
  if (errors.length) throw Object.assign(badRequest('the file has errors, nothing was imported'), { details: errors.slice(0, 50) });
  if (!records.length) throw badRequest('no rows to import');
  if (records.length > 5000) throw badRequest('import at most 5000 rows at a time');

  return withTransaction(async (newRequest) => {
    const uid = () => newRequest().input('uid', sql.Int, userId);
    const cats = (await uid().query('SELECT id, name, type FROM categories WHERE user_id = @uid')).recordset;
    const accs = (await uid().query('SELECT id, name FROM accounts WHERE user_id = @uid ORDER BY id')).recordset;
    const key = (s) => s.trim().toLowerCase();
    const catMap = new Map(cats.map((c) => [`${c.type}|${key(c.name)}`, c.id]));
    const accMap = new Map(accs.map((a) => [key(a.name), a.id]));
    let createdCategories = 0;
    let createdAccounts = 0;

    const categoryId = async (name, type) => {
      const k = `${type}|${key(name)}`;
      if (!catMap.has(k)) {
        const r = await uid()
          .input('name', sql.NVarChar(50), name)
          .input('type', sql.VarChar(10), type)
          .query('INSERT INTO categories (user_id, name, type) OUTPUT INSERTED.id VALUES (@uid, @name, @type)');
        catMap.set(k, r.recordset[0].id);
        createdCategories++;
      }
      return catMap.get(k);
    };
    const accountId = async (name) => {
      if (!name) return accs[0].id;
      if (!accMap.has(key(name))) {
        const r = await uid()
          .input('name', sql.NVarChar(50), name)
          .query('INSERT INTO accounts (user_id, name) OUTPUT INSERTED.id VALUES (@uid, @name)');
        accMap.set(key(name), r.recordset[0].id);
        createdAccounts++;
      }
      return accMap.get(key(name));
    };

    for (const rec of records) {
      const tx = {
        type: rec.type,
        amount: rec.amount,
        occurredOn: rec.occurredOn,
        description: rec.description,
        categoryId: rec.type === 'transfer' ? null : await categoryId(rec.category, rec.type),
        accountId: await accountId(rec.account),
        toAccountId: rec.type === 'transfer' ? await accountId(rec.toAccount) : null,
      };
      if (tx.type === 'transfer' && tx.accountId === tx.toAccountId) {
        throw Object.assign(badRequest('the file has errors, nothing was imported'), {
          details: [{ line: rec.line, error: 'source and destination accounts must differ' }],
        });
      }
      await bindTx(uid(), tx).query(`
        INSERT INTO transactions (user_id, type, category_id, account_id, to_account_id, amount, description, occurred_on)
        VALUES (@uid, @type, @cat, @acc, @toAcc, @amount, @desc, CAST(@date AS date))
      `);
    }
    return { imported: records.length, createdCategories, createdAccounts };
  });
}

module.exports = { list, summary, stats, weeklyRecap, totalsBetween, lastAccountId, countOn, findById, create, update, remove, exportCsv, importCsv };
