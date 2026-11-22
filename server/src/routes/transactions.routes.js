const express = require('express');
const transactions = require('../services/transactions.service');
const recurring = require('../services/recurring.service');
const notifications = require('../services/notifications.service');
const { idParam, monthQuery } = require('../middleware/params');
const { isValidMonth } = require('../lib/dates');
const { validateTransaction } = require('../lib/validate');
const { asyncHandler, badRequest } = require('../lib/http');

const router = express.Router();

/** Recurring rules book what they owe before any read, so reads are never stale. */
const bookRecurring = asyncHandler(async (req, res, next) => {
  await recurring.materialize(req.user.id);
  next();
});

function readFilters(query) {
  const { month, type, accountId, categoryId, personId, q, page, pageSize } = query;
  if (month && !isValidMonth(month)) throw badRequest('month must be YYYY-MM');
  return { month, type, accountId, categoryId, personId, q, page, pageSize };
}

function readBody(body) {
  const { value, error } = validateTransaction(body);
  if (error) throw badRequest(error);
  return value;
}

router.get(
  '/',
  bookRecurring,
  asyncHandler(async (req, res) => res.json(await transactions.list(req.user.id, readFilters(req.query))))
);

router.get(
  '/summary',
  bookRecurring,
  monthQuery,
  asyncHandler(async (req, res) => res.json(await transactions.summary(req.user.id, req.month)))
);

router.get(
  '/stats',
  bookRecurring,
  monthQuery,
  asyncHandler(async (req, res) => res.json(await transactions.stats(req.user.id, req.month)))
);

router.get(
  '/weekly',
  bookRecurring,
  asyncHandler(async (req, res) => res.json(await transactions.weeklyRecap(req.user.id)))
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const filters = readFilters(req.query);
    const csv = await transactions.exportCsv(req.user.id, filters);
    const name = `transactions-${filters.month || 'all'}.csv`;
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${name}"`);
    res.send(csv);
  })
);

router.post(
  '/import',
  asyncHandler(async (req, res) => {
    if (typeof req.body?.csv !== 'string' || !req.body.csv.trim()) throw badRequest('csv text is required');
    res.status(201).json(await transactions.importCsv(req.user.id, req.body.csv));
  })
);

/** A new expense may cross a budget line: the alert rides along with the created transaction. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const tx = await transactions.create(req.user.id, readBody(req.body));
    const budgetAlert = await notifications.checkBudget(req.user.id, tx).catch(() => null);
    res.status(201).json({ ...tx, budgetAlert });
  })
);

router.put(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => res.json(await transactions.update(req.user.id, req.id, readBody(req.body))))
);

router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    await transactions.remove(req.user.id, req.id);
    res.status(204).end();
  })
);

module.exports = router;
