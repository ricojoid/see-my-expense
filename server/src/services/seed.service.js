const DEFAULT_CATEGORIES = [
  ['Salary', 'income'],
  ['Freelance', 'income'],
  ['Gift', 'income'],
  ['Investment', 'income'],
  ['Other Income', 'income'],
  ['Food & Drinks', 'expense'],
  ['Groceries', 'expense'],
  ['Transport', 'expense'],
  ['Housing', 'expense'],
  ['Bills & Utilities', 'expense'],
  ['Entertainment', 'expense'],
  ['Health', 'expense'],
  ['Shopping', 'expense'],
  ['Education', 'expense'],
  ['Other Expense', 'expense'],
];

const DEFAULT_ACCOUNTS = ['Cash', 'Bank'];

/** Category every debt transaction is filed under (one per type, created on first use). */
const DEBT_CATEGORY = 'Debts & Loans';

/**
 * Gives a new user a starter set of categories and accounts.
 * `newRequest` returns a fresh mssql Request (bound to a pool or a transaction).
 */
async function seedUserDefaults(sql, newRequest, userId) {
  const catReq = newRequest().input('uid', sql.Int, userId);
  const catValues = DEFAULT_CATEGORIES.map(([name, type], i) => {
    catReq.input(`n${i}`, sql.NVarChar(50), name);
    catReq.input(`t${i}`, sql.VarChar(10), type);
    return `(@uid, @n${i}, @t${i})`;
  });
  await catReq.query(`INSERT INTO categories (user_id, name, type) VALUES ${catValues.join(', ')}`);

  const accReq = newRequest().input('uid', sql.Int, userId);
  const accValues = DEFAULT_ACCOUNTS.map((name, i) => {
    accReq.input(`a${i}`, sql.NVarChar(50), name);
    return `(@uid, @a${i})`;
  });
  await accReq.query(`INSERT INTO accounts (user_id, name) VALUES ${accValues.join(', ')}`);
}

module.exports = { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, seedUserDefaults, DEBT_CATEGORY };
