const express = require('express');
const periods = require('../services/periods.service');
const accounts = require('../services/accounts.service');
const { isValidMonth } = require('../lib/dates');
const { asyncHandler, badRequest } = require('../lib/http');

/** Book periods: which dates a "month" covers, and closing the books on payday. */
const router = express.Router();

/** The period for ?month=YYYY-MM, or the current one. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { month } = req.query;
    if (month && !isValidMonth(month)) throw badRequest('month must be YYYY-MM');
    res.json(await periods.get(req.user.id, month || null));
  })
);

/**
 * Closes the books: { when: 'today' } starts the new period tomorrow,
 * 'yesterday' starts it today. Optional `balances` ({ accountId: amount })
 * starts the accounts afresh with what's really left (0 to empty one).
 */
router.post(
  '/close',
  asyncHandler(async (req, res) => {
    const { when, balances } = req.body || {};
    const checked = balances === undefined ? null : await accounts.checkBalances(req.user.id, balances);
    const result = await periods.close(req.user.id, when);
    const accountList = checked ? await accounts.setBalances(req.user.id, checked) : undefined;
    res.status(201).json({ ...result, accounts: accountList });
  })
);

/** Takes back the latest close. */
router.delete(
  '/close',
  asyncHandler(async (req, res) => {
    const period = await periods.undoLast(req.user.id);
    if (!period) throw badRequest('there is no close to undo');
    res.json(period);
  })
);

module.exports = router;
