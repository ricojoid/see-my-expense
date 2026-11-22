/**
 * Creates or migrates the database. Safe to re-run: every step checks what
 * already exists. Data from the single-user version is kept and assigned to
 * the first admin account.
 *
 *   npm run setup-db
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, buildConfig, server, database, useSqlAuth } = require('../src/config/db');
const { validateUsername, validatePassword } = require('../src/lib/validate');
const { seedUserDefaults, DEFAULT_ACCOUNTS } = require('../src/services/seed.service');

const log = (msg) => console.log(`[setup] ${msg}`);

/** SQL Server in a fresh container takes a while to accept logins: retry for up to ~2 minutes. */
async function connectWithRetry(config, attempts = Number(process.env.DB_CONNECT_RETRIES) || 40) {
  for (let i = 1; ; i++) {
    try {
      return await new sql.ConnectionPool(config).connect();
    } catch (err) {
      if (i >= attempts) throw err;
      log(`database not ready (${err.message.split('\n')[0]}), retrying ${i}/${attempts}...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function ensureDatabase() {
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_DATABASE may only contain letters, digits and _');
  const pool = await connectWithRetry(buildConfig('master'));
  try {
    await pool.request().batch(`IF DB_ID('${database}') IS NULL CREATE DATABASE [${database}];`);
  } finally {
    await pool.close();
  }
}

function helpers(pool) {
  const q = (text) => pool.request().query(text);
  const scalar = async (text) => Object.values((await q(text)).recordset[0] || { v: null })[0];
  return {
    q,
    tableExists: async (t) => Boolean(await scalar(`SELECT OBJECT_ID('${t}', 'U')`)),
    columnExists: async (t, c) =>
      Boolean(await scalar(`SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('${t}') AND name = '${c}'`)),
    objectExists: async (name) => Boolean(await scalar(`SELECT OBJECT_ID('${name}')`)),
    indexExists: async (t, name) =>
      Boolean(await scalar(`SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('${t}') AND name = '${name}'`)),
    columnNullable: async (t, c) =>
      Boolean(await scalar(`SELECT is_nullable FROM sys.columns WHERE object_id = OBJECT_ID('${t}') AND name = '${c}'`)),
  };
}

async function ensureUsers(pool, h) {
  if (!(await h.tableExists('users'))) {
    await h.q(`
      CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(30) NOT NULL CONSTRAINT UQ_users_username UNIQUE,
        password_hash VARCHAR(100) NOT NULL,
        role VARCHAR(10) NOT NULL CONSTRAINT CK_users_role CHECK (role IN ('admin', 'user')) DEFAULT 'user',
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    `);
    log('created table users');
  }

  const existing = await h.q(`SELECT TOP 1 id FROM users WHERE role = 'admin' ORDER BY id`);
  if (existing.recordset[0]) return { adminId: existing.recordset[0].id, created: false };

  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const invalid = validateUsername(username) || validatePassword(password);
  if (invalid) throw new Error(`ADMIN_USERNAME / ADMIN_PASSWORD in .env: ${invalid}`);

  const r = await pool
    .request()
    .input('username', sql.NVarChar(30), username)
    .input('hash', sql.VarChar(100), await bcrypt.hash(password, 10))
    .query(`INSERT INTO users (username, password_hash, role) OUTPUT INSERTED.id VALUES (@username, @hash, 'admin')`);
  log(`created admin account "${username}"`);
  return { adminId: r.recordset[0].id, created: true };
}

async function ensureCategories(h, adminId) {
  if (!(await h.tableExists('categories'))) {
    await h.q(`
      CREATE TABLE categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_categories_user REFERENCES users(id),
        name NVARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL CONSTRAINT CK_categories_type CHECK (type IN ('income', 'expense')),
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_categories_user_name_type UNIQUE (user_id, name, type)
      );
    `);
    log('created table categories');
    return;
  }

  if (!(await h.columnExists('categories', 'user_id'))) {
    await h.q('ALTER TABLE categories ADD user_id INT NULL;');
    await h.q(`UPDATE categories SET user_id = ${adminId} WHERE user_id IS NULL;`);
    await h.q('ALTER TABLE categories ALTER COLUMN user_id INT NOT NULL;');
    await h.q('ALTER TABLE categories ADD CONSTRAINT FK_categories_user FOREIGN KEY (user_id) REFERENCES users(id);');
    log('categories: added user_id (existing rows -> admin)');
  }
  if (await h.objectExists('UQ_categories_name_type')) {
    await h.q('ALTER TABLE categories DROP CONSTRAINT UQ_categories_name_type;');
  }
  if (!(await h.objectExists('UQ_categories_user_name_type'))) {
    await h.q('ALTER TABLE categories ADD CONSTRAINT UQ_categories_user_name_type UNIQUE (user_id, name, type);');
    log('categories: names are now unique per user');
  }
}

async function ensureAccounts(pool, h, adminId) {
  if (!(await h.tableExists('accounts'))) {
    await h.q(`
      CREATE TABLE accounts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_accounts_user REFERENCES users(id),
        name NVARCHAR(50) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_accounts_user_name UNIQUE (user_id, name)
      );
    `);
    log('created table accounts');
  }
  const has = await h.q(`SELECT COUNT(*) AS n FROM accounts WHERE user_id = ${adminId}`);
  if (has.recordset[0].n === 0 && (await h.columnExists('categories', 'user_id'))) {
    const cats = await h.q(`SELECT COUNT(*) AS n FROM categories WHERE user_id = ${adminId}`);
    // Users with categories but no accounts are migrated users: give them the default accounts.
    if (cats.recordset[0].n > 0) {
      for (const name of DEFAULT_ACCOUNTS) {
        await pool.request().input('name', sql.NVarChar(50), name).query(`INSERT INTO accounts (user_id, name) VALUES (${adminId}, @name)`);
      }
      log('admin: added default accounts');
    }
  }
}

async function ensureRecurring(h) {
  if (await h.tableExists('recurring_transactions')) return;
  await h.q(`
    CREATE TABLE recurring_transactions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL CONSTRAINT FK_recurring_user REFERENCES users(id),
      type VARCHAR(10) NOT NULL CONSTRAINT CK_recurring_type CHECK (type IN ('income', 'expense')),
      category_id INT NOT NULL CONSTRAINT FK_recurring_category REFERENCES categories(id),
      account_id INT NOT NULL CONSTRAINT FK_recurring_account REFERENCES accounts(id),
      amount DECIMAL(14,2) NOT NULL CONSTRAINT CK_recurring_amount CHECK (amount > 0),
      description NVARCHAR(255) NULL,
      day_of_month TINYINT NOT NULL CONSTRAINT CK_recurring_day CHECK (day_of_month BETWEEN 1 AND 31),
      next_run_on DATE NOT NULL,
      active BIT NOT NULL DEFAULT 1,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
  `);
  log('created table recurring_transactions');
}

/** People you lend to or borrow from. Their transactions carry person_id. */
async function ensurePeople(h) {
  if (await h.tableExists('people')) return;
  await h.q(`
    CREATE TABLE people (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL CONSTRAINT FK_people_user REFERENCES users(id),
      name NVARCHAR(50) NOT NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      CONSTRAINT UQ_people_user_name UNIQUE (user_id, name)
    );
  `);
  log('created table people');
}

const TX_PERSON = `
  CONSTRAINT CK_transactions_person CHECK (person_id IS NULL OR type <> 'transfer')`;

const TX_SHAPE = `
  CONSTRAINT CK_transactions_shape CHECK (
    (type = 'transfer' AND to_account_id IS NOT NULL AND category_id IS NULL AND to_account_id <> account_id)
    OR (type <> 'transfer' AND category_id IS NOT NULL AND to_account_id IS NULL)
  )`;

async function ensureTransactions(h, adminId) {
  if (!(await h.tableExists('transactions'))) {
    await h.q(`
      CREATE TABLE transactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_transactions_user REFERENCES users(id),
        type VARCHAR(10) NOT NULL CONSTRAINT CK_transactions_type CHECK (type IN ('income', 'expense', 'transfer')),
        category_id INT NULL CONSTRAINT FK_transactions_category REFERENCES categories(id),
        account_id INT NOT NULL CONSTRAINT FK_transactions_account REFERENCES accounts(id),
        to_account_id INT NULL CONSTRAINT FK_transactions_to_account REFERENCES accounts(id),
        recurring_id INT NULL CONSTRAINT FK_transactions_recurring REFERENCES recurring_transactions(id) ON DELETE SET NULL,
        person_id INT NULL CONSTRAINT FK_transactions_person REFERENCES people(id) ON DELETE SET NULL,
        amount DECIMAL(14,2) NOT NULL CONSTRAINT CK_transactions_amount CHECK (amount > 0),
        description NVARCHAR(255) NULL,
        occurred_on DATE NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        ${TX_SHAPE},
        ${TX_PERSON}
      );
    `);
    log('created table transactions');
  } else {
    await migrateTransactions(h, adminId);
  }

  if (!(await h.indexExists('transactions', 'IX_transactions_user_date'))) {
    await h.q('CREATE INDEX IX_transactions_user_date ON transactions (user_id, occurred_on DESC) INCLUDE (type, amount, category_id);');
    log('transactions: added index on (user_id, occurred_on)');
  }
  if (!(await h.indexExists('transactions', 'IX_transactions_person'))) {
    await h.q('CREATE INDEX IX_transactions_person ON transactions (person_id) INCLUDE (type, amount, occurred_on);');
  }
}

async function migrateTransactions(h, adminId) {
  if (!(await h.columnExists('transactions', 'user_id'))) {
    await h.q('ALTER TABLE transactions ADD user_id INT NULL;');
    await h.q(`UPDATE transactions SET user_id = ${adminId};`);
    await h.q('ALTER TABLE transactions ALTER COLUMN user_id INT NOT NULL;');
    await h.q('ALTER TABLE transactions ADD CONSTRAINT FK_transactions_user FOREIGN KEY (user_id) REFERENCES users(id);');
    log('transactions: added user_id (existing rows -> admin)');
  }
  if (!(await h.columnExists('transactions', 'account_id'))) {
    await h.q('ALTER TABLE transactions ADD account_id INT NULL;');
    await h.q(`
      UPDATE t SET account_id = (SELECT TOP 1 a.id FROM accounts a WHERE a.user_id = t.user_id ORDER BY a.id)
      FROM transactions t;
    `);
    await h.q('ALTER TABLE transactions ALTER COLUMN account_id INT NOT NULL;');
    await h.q('ALTER TABLE transactions ADD CONSTRAINT FK_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id);');
    log('transactions: added account_id (existing rows -> first account)');
  }
  if (!(await h.columnExists('transactions', 'to_account_id'))) {
    await h.q('ALTER TABLE transactions ADD to_account_id INT NULL CONSTRAINT FK_transactions_to_account REFERENCES accounts(id);');
  }
  if (!(await h.columnExists('transactions', 'recurring_id'))) {
    await h.q(`
      ALTER TABLE transactions ADD recurring_id INT NULL
        CONSTRAINT FK_transactions_recurring REFERENCES recurring_transactions(id) ON DELETE SET NULL;
    `);
  }
  if (!(await h.columnNullable('transactions', 'category_id'))) {
    await h.q('ALTER TABLE transactions ALTER COLUMN category_id INT NULL;');
  }

  // Replace the auto-named type CHECK from v1 with one that allows transfers.
  if (!(await h.objectExists('CK_transactions_type'))) {
    const old = await h.q(`
      SELECT name FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID('transactions') AND definition LIKE '%type%'
    `);
    for (const { name } of old.recordset) await h.q(`ALTER TABLE transactions DROP CONSTRAINT [${name}];`);
    await h.q(`ALTER TABLE transactions ADD CONSTRAINT CK_transactions_type CHECK (type IN ('income', 'expense', 'transfer'));`);
    log('transactions: type now allows transfer');
  }
  if (!(await h.objectExists('CK_transactions_shape'))) {
    await h.q(`ALTER TABLE transactions ADD ${TX_SHAPE};`);
  }
  if (!(await h.columnExists('transactions', 'person_id'))) {
    await h.q(`
      ALTER TABLE transactions ADD person_id INT NULL
        CONSTRAINT FK_transactions_person REFERENCES people(id) ON DELETE SET NULL;
    `);
    log('transactions: added person_id (debts)');
  }
  if (!(await h.objectExists('CK_transactions_person'))) {
    await h.q(`ALTER TABLE transactions ADD ${TX_PERSON};`);
  }
}

async function ensureBudgets(h) {
  if (await h.tableExists('budgets')) return;
  await h.q(`
    CREATE TABLE budgets (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL CONSTRAINT FK_budgets_user REFERENCES users(id),
      category_id INT NOT NULL CONSTRAINT FK_budgets_category REFERENCES categories(id) ON DELETE CASCADE,
      amount DECIMAL(14,2) NOT NULL CONSTRAINT CK_budgets_amount CHECK (amount > 0),
      CONSTRAINT UQ_budgets_category UNIQUE (category_id)
    );
  `);
  log('created table budgets');
}

/** Push notifications: app-wide keys, per-device subscriptions, per-user preferences. */
async function ensureNotifications(h) {
  if (!(await h.tableExists('app_settings'))) {
    await h.q(`
      CREATE TABLE app_settings (
        name VARCHAR(50) NOT NULL PRIMARY KEY,
        value NVARCHAR(MAX) NOT NULL
      );
    `);
    log('created table app_settings');
  }
  if (!(await h.tableExists('push_subscriptions'))) {
    await h.q(`
      CREATE TABLE push_subscriptions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_push_user REFERENCES users(id),
        endpoint VARCHAR(800) NOT NULL CONSTRAINT UQ_push_endpoint UNIQUE,
        p256dh VARCHAR(200) NOT NULL,
        auth VARCHAR(100) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    `);
    log('created table push_subscriptions');
  }
  if (!(await h.tableExists('user_settings'))) {
    await h.q(`
      CREATE TABLE user_settings (
        user_id INT NOT NULL PRIMARY KEY CONSTRAINT FK_user_settings_user REFERENCES users(id),
        reminder_enabled BIT NOT NULL DEFAULT 0,
        reminder_time CHAR(5) NOT NULL DEFAULT '21:00',
        budget_alerts BIT NOT NULL DEFAULT 1,
        weekly_summary BIT NOT NULL DEFAULT 1,
        last_reminder_on DATE NULL,
        last_weekly_on DATE NULL,
        telegram_notify BIT NOT NULL DEFAULT 1
      );
    `);
    log('created table user_settings');
  }
  if (!(await h.columnExists('user_settings', 'telegram_notify'))) {
    await h.q('ALTER TABLE user_settings ADD telegram_notify BIT NOT NULL CONSTRAINT DF_user_settings_telegram DEFAULT 1;');
  }
  if (!(await h.columnExists('user_settings', 'monthly_report'))) {
    await h.q(`
      ALTER TABLE user_settings ADD
        monthly_report BIT NOT NULL CONSTRAINT DF_user_settings_report DEFAULT 1,
        last_report_month CHAR(7) NULL;
    `);
    log('user_settings: added monthly report');
  }
}

/** Keywords learned from category corrections ("indomaret" -> Groceries). */
async function ensureCategoryRules(h) {
  if (await h.tableExists('category_rules')) return;
  await h.q(`
    CREATE TABLE category_rules (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL CONSTRAINT FK_category_rules_user REFERENCES users(id),
      keyword NVARCHAR(60) NOT NULL,
      category_id INT NOT NULL CONSTRAINT FK_category_rules_category REFERENCES categories(id) ON DELETE CASCADE,
      updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
      CONSTRAINT UQ_category_rules_user_keyword UNIQUE (user_id, keyword)
    );
  `);
  log('created table category_rules');
}

/** Savings goals and the money put towards them (not spending, so not transactions). */
async function ensureGoals(h) {
  if (!(await h.tableExists('goals'))) {
    await h.q(`
      CREATE TABLE goals (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_goals_user REFERENCES users(id),
        name NVARCHAR(60) NOT NULL,
        target DECIMAL(14,2) NOT NULL CONSTRAINT CK_goals_target CHECK (target > 0),
        deadline DATE NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    `);
    log('created table goals');
  }
  if (!(await h.tableExists('goal_contributions'))) {
    await h.q(`
      CREATE TABLE goal_contributions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        goal_id INT NOT NULL CONSTRAINT FK_goal_contributions_goal REFERENCES goals(id) ON DELETE CASCADE,
        amount DECIMAL(14,2) NOT NULL CONSTRAINT CK_goal_contributions_amount CHECK (amount <> 0),
        occurred_on DATE NOT NULL,
        note NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    `);
    log('created table goal_contributions');
  }
}

/** Telegram chats linked to accounts, and the one-time codes that link them. */
async function ensureTelegram(h) {
  if (!(await h.tableExists('telegram_messages'))) {
    // Which transactions a bot reply was about, so replying to it can correct them.
    await h.q(`
      CREATE TABLE telegram_messages (
        chat_id BIGINT NOT NULL,
        message_id INT NOT NULL,
        transaction_id INT NOT NULL CONSTRAINT FK_telegram_messages_tx REFERENCES transactions(id) ON DELETE CASCADE,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_telegram_messages PRIMARY KEY (chat_id, message_id, transaction_id)
      );
    `);
    log('created table telegram_messages');
  }
  if (!(await h.tableExists('telegram_links'))) {
    await h.q(`
      CREATE TABLE telegram_links (
        chat_id BIGINT NOT NULL PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_telegram_links_user REFERENCES users(id),
        chat_name NVARCHAR(100) NULL,
        linked_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    `);
    log('created table telegram_links');
  }
  if (!(await h.tableExists('telegram_link_codes'))) {
    await h.q(`
      CREATE TABLE telegram_link_codes (
        code VARCHAR(32) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL CONSTRAINT FK_telegram_codes_user REFERENCES users(id),
        expires_at DATETIME2 NOT NULL
      );
    `);
    log('created table telegram_link_codes');
  }
}

async function main() {
  log(`connecting to ${server} (${useSqlAuth ? 'SQL auth' : 'Windows auth'})...`);
  await ensureDatabase();

  const pool = await new sql.ConnectionPool(buildConfig()).connect();
  const h = helpers(pool);
  try {
    const { adminId } = await ensureUsers(pool, h);
    await ensureCategories(h, adminId);
    await ensureAccounts(pool, h, adminId);
    await ensureRecurring(h);
    await ensurePeople(h);
    await ensureTransactions(h, adminId);
    await ensureBudgets(h);
    await ensureNotifications(h);
    await ensureTelegram(h);
    await ensureCategoryRules(h);
    await ensureGoals(h);

    const cats = await h.q(`SELECT COUNT(*) AS n FROM categories WHERE user_id = ${adminId}`);
    if (cats.recordset[0].n === 0) {
      await seedUserDefaults(sql, () => pool.request(), adminId);
      log('admin: seeded default categories and accounts');
    }
    log(`database "${database}" is ready.`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[setup] failed:', err.message);
  process.exit(1);
});
