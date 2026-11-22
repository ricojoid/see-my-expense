const express = require('express');
const { sql, getPool } = require('../db');

const router = express.Router();

function isValidType(type) {
  return type === 'income' || type === 'expense';
}

// GET /api/categories?type=
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const pool = await getPool();
    const request = pool.request();

    let where = '';
    if (type && isValidType(type)) {
      where = 'WHERE type = @type';
      request.input('type', sql.VarChar, type);
    }

    const result = await request.query(
      `SELECT id, name, type, created_at AS createdAt
       FROM categories
       ${where}
       ORDER BY type, name`
    );

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories
router.post('/', async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!isValidType(type)) {
      return res.status(400).json({ error: 'type must be "income" or "expense"' });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('name', sql.NVarChar, name.trim())
      .input('type', sql.VarChar, type)
      .query(`
        INSERT INTO categories (name, type)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.type, INSERTED.created_at AS createdAt
        VALUES (@name, @type)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    if (err.message && err.message.includes('UQ_categories_name_type')) {
      return res.status(409).json({ error: 'a category with that name and type already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'invalid id' });
    }

    const { name, type } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!isValidType(type)) {
      return res.status(400).json({ error: 'type must be "income" or "expense"' });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name.trim())
      .input('type', sql.VarChar, type)
      .query(`
        UPDATE categories
        SET name = @name, type = @type
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.type, INSERTED.created_at AS createdAt
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'category not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    if (err.message && err.message.includes('UQ_categories_name_type')) {
      return res.status(409).json({ error: 'a category with that name and type already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id
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
      .query('DELETE FROM categories WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'category not found' });
    }

    res.status(204).send();
  } catch (err) {
    if (err.message && (err.message.includes('REFERENCE') || err.message.includes('FK_transactions_category'))) {
      return res.status(409).json({ error: 'category is in use by existing transactions' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
