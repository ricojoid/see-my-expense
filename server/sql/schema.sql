IF DB_ID('expense_tracker') IS NULL
BEGIN
    CREATE DATABASE expense_tracker;
END
GO

USE expense_tracker;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
BEGIN
    CREATE TABLE categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_categories_name_type UNIQUE (name, type)
    );
END
GO

IF NOT EXISTS (SELECT * FROM categories)
BEGIN
    INSERT INTO categories (name, type) VALUES
        ('Salary', 'income'),
        ('Freelance', 'income'),
        ('Gift', 'income'),
        ('Investment', 'income'),
        ('Other Income', 'income'),
        ('Food & Groceries', 'expense'),
        ('Transportation', 'expense'),
        ('Housing', 'expense'),
        ('Utilities', 'expense'),
        ('Entertainment', 'expense'),
        ('Health', 'expense'),
        ('Shopping', 'expense'),
        ('Education', 'expense'),
        ('Other Expense', 'expense');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'transactions')
BEGIN
    CREATE TABLE transactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        category_id INT NOT NULL REFERENCES categories(id),
        description NVARCHAR(255) NULL,
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        occurred_on DATE NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO
