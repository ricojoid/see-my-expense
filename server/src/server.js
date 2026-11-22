require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./auth');
const authRouter = require('./routes/auth');
const transactionsRouter = require('./routes/transactions');
const categoriesRouter = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/categories', requireAuth, categoriesRouter);

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
