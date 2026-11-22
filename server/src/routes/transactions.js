const express = require('express');
const { sql, getPool } = require('../db');

const router = express.Router();

function isValidType(type) {
  return type === 'income' || type === 'expense';
}

// GET /api/transactions?type=&month=YYYY-MM
router.get('/', async (req, res) => {
  try {
    const { type, month } = req.query;
    const pool = await getPool();
    const request = pool.request();

    const conditions = [];
    if (type && isValidType(type)) {
      conditions.push('t.type = @type');
      request.input('type', sql.VarChar, type);
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      conditions.push('FORMAT(t.occurred_on, \'yyyy-MM\') = @month');
      request.input('month', sql.VarChar, month);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await request.query(
      `SELECT t.id, t.type, t.category_id AS categoryId, c.name AS category, t.description,
              t.amount, t.occurred_on AS occurredOn, t.created_at AS createdAt
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       ${where}
       ORDER BY t.occurred_on DESC, t.id DESC`
    );

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/summary
router.get('/summary', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT type, SUM(amount) AS total FROM transactions GROUP BY type`
    );

    const totals = { income: 0, expense: 0 };
    for (const row of result.recordset) {
      totals[row.type] = Number(row.total);
    }

    res.json({
      income: totals.income,
      expense: totals.expense,
      balance: totals.income - totals.expense,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { type, categoryId, description, amount, occurredOn } = req.body;

    if (!isValidType(type)) {
      return res.status(400).json({ error: 'type must be "income" or "expense"' });
    }
    const numericCategoryId = Number(categoryId);
    if (!Number.isInteger(numericCategoryId)) {
      return res.status(400).json({ error: 'categoryId is required' });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (!occurredOn || Number.isNaN(Date.parse(occurredOn))) {
      return res.status(400).json({ error: 'occurredOn must be a valid date' });
    }

    const pool = await getPool();

    const categoryCheck = await pool
      .request()
      .input('categoryId', sql.Int, numericCategoryId)
      .input('type', sql.VarChar, type)
      .query('SELECT id FROM categories WHERE id = @categoryId AND type = @type');

    if (categoryCheck.recordset.length === 0) {
      return res.status(400).json({ error: 'categoryId does not match a category of that type' });
    }

    const result = await pool
      .request()
      .input('type', sql.VarChar, type)
      .input('categoryId', sql.Int, numericCategoryId)
      .input('description', sql.NVarChar, description || null)
      .input('amount', sql.Decimal(12, 2), numericAmount)
      .input('occurredOn', sql.Date, occurredOn)
      .query(`
        INSERT INTO transactions (type, category_id, description, amount, occurred_on)
        OUTPUT INSERTED.id
        VALUES (@type, @categoryId, @description, @amount, @occurredOn)
      `);

    const insertedId = result.recordset[0].id;

    const created = await pool
      .request()
      .input('id', sql.Int, insertedId)
      .query(`
        SELECT t.id, t.type, t.category_id AS categoryId, c.name AS category, t.description,
               t.amount, t.occurred_on AS occurredOn, t.created_at AS createdAt
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.id = @id
      `);

    res.status(201).json(created.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'invalid id' });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM transactions WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'transaction not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
