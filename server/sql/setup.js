require('dotenv').config();
const sql = require('mssql/msnodesqlv8');

const server = process.env.DB_SERVER || 'DESKTOP-8IN7U4N\\SQLEXPRESS';
const database = process.env.DB_DATABASE || 'expense_tracker';

const masterConfig = {
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=master;Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
};

const dbConfig = {
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
};

const SEED_CATEGORIES = [
  ['Salary', 'income'],
  ['Freelance', 'income'],
  ['Gift', 'income'],
  ['Investment', 'income'],
  ['Other Income', 'income'],
  ['Food & Groceries', 'expense'],
  ['Transportation', 'expense'],
  ['Housing', 'expense'],
  ['Utilities', 'expense'],
  ['Entertainment', 'expense'],
  ['Health', 'expense'],
  ['Shopping', 'expense'],
  ['Education', 'expense'],
  ['Other Expense', 'expense'],
];

async function ensureDatabase() {
  const pool = await new sql.ConnectionPool(masterConfig).connect();
  try {
    await pool.request().batch(
      `IF DB_ID('${database}') IS NULL CREATE DATABASE ${database};`
    );
  } finally {
    await pool.close();
  }
}

async function ensureCategories(pool) {
  const exists = await pool.request().query(
    `SELECT * FROM sys.tables WHERE name = 'categories'`
  );
  if (exists.recordset.length === 0) {
    await pool.request().batch(`
      CREATE TABLE categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_categories_name_type UNIQUE (name, type)
      );
    `);
    console.log('[setup] created table "categories"');
  }

  const countResult = await pool.request().query('SELECT COUNT(*) AS cnt FROM categories');
  if (countResult.recordset[0].cnt === 0) {
    const request = pool.request();
    const valuesSql = SEED_CATEGORIES.map(([name, type], i) => {
      request.input(`name${i}`, sql.NVarChar, name);
      request.input(`type${i}`, sql.VarChar, type);
      return `(@name${i}, @type${i})`;
    }).join(', ');
    await request.query(`INSERT INTO categories (name, type) VALUES ${valuesSql}`);
    console.log(`[setup] seeded ${SEED_CATEGORIES.length} default categories`);
  }
}

async function ensureTransactions(pool) {
  const exists = await pool.request().query(
    `SELECT * FROM sys.tables WHERE name = 'transactions'`
  );

  const createFresh = async () => {
    await pool.request().batch(`
      CREATE TABLE transactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        category_id INT NOT NULL REFERENCES categories(id),
        description NVARCHAR(255) NULL,
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        occurred_on DATE NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    `);
    console.log('[setup] created table "transactions" (with category_id)');
  };

  if (exists.recordset.length === 0) {
    await createFresh();
    return;
  }

  const colCheck = await pool.request().query(
    `SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('transactions') AND name = 'category_id'`
  );
  if (colCheck.recordset.length > 0) {
    console.log('[setup] table "transactions" already up to date');
    return;
  }

  const countResult = await pool.request().query('SELECT COUNT(*) AS cnt FROM transactions');
  if (countResult.recordset[0].cnt === 0) {
    await pool.request().batch('DROP TABLE transactions;');
    console.log('[setup] dropped empty legacy "transactions" table');
    await createFresh();
    return;
  }

  console.log('[setup] migrating legacy "transactions" table (text category -> category_id)...');

  const distinctCategories = await pool.request().query(
    `SELECT DISTINCT category, type FROM transactions`
  );

  for (const row of distinctCategories.recordset) {
    await pool
      .request()
      .input('name', sql.NVarChar, row.category)
      .input('type', sql.VarChar, row.type)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM categories WHERE name = @name AND type = @type)
          INSERT INTO categories (name, type) VALUES (@name, @type);
      `);
  }
  console.log(`[setup] ensured ${distinctCategories.recordset.length} categories from existing transactions`);

  await pool.request().batch(`ALTER TABLE transactions ADD category_id INT NULL;`);
  await pool.request().batch(`
    UPDATE t
    SET t.category_id = c.id
    FROM transactions t
    INNER JOIN categories c ON c.name = t.category AND c.type = t.type;
  `);

  const unmatched = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM transactions WHERE category_id IS NULL`
  );
  if (unmatched.recordset[0].cnt > 0) {
    throw new Error(
      `${unmatched.recordset[0].cnt} transaction(s) could not be matched to a category during migration.`
    );
  }

  await pool.request().batch(`ALTER TABLE transactions ALTER COLUMN category_id INT NOT NULL;`);
  await pool.request().batch(`
    ALTER TABLE transactions
    ADD CONSTRAINT FK_transactions_category FOREIGN KEY (category_id) REFERENCES categories(id);
  `);
  await pool.request().batch(`ALTER TABLE transactions DROP COLUMN category;`);

  console.log('[setup] migration complete: transactions now uses category_id');
}

async function main() {
  console.log(`[setup] connecting to ${server} (Windows Authentication)...`);
  await ensureDatabase();

  const pool = await new sql.ConnectionPool(dbConfig).connect();
  try {
    await ensureCategories(pool);
    await ensureTransactions(pool);
    console.log(`[setup] database "${database}" is ready.`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[setup] failed:', err.message);
  process.exit(1);
});
