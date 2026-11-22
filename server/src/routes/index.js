const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', require('./auth.routes'));
router.use('/users', requireAuth, requireAdmin, require('./users.routes'));
router.use('/categories', requireAuth, require('./categories.routes'));
router.use('/accounts', requireAuth, require('./accounts.routes'));
router.use('/budgets', requireAuth, require('./budgets.routes'));
router.use('/recurring', requireAuth, require('./recurring.routes'));
router.use('/people', requireAuth, require('./people.routes'));
router.use('/transactions', requireAuth, require('./transactions.routes'));

module.exports = router;
