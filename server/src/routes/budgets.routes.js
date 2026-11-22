const express = require('express');
const budgets = require('../services/budgets.service');
const { monthQuery } = require('../middleware/params');
const { toId } = require('../lib/validate');
const { asyncHandler, badRequest } = require('../lib/http');

const router = express.Router();

router.get('/', monthQuery, asyncHandler(async (req, res) => res.json(await budgets.listForMonth(req.user.id, req.month))));

router.put(
  '/:categoryId',
  asyncHandler(async (req, res) => {
    const categoryId = toId(req.params.categoryId);
    if (!categoryId) throw badRequest('invalid category id');
    await budgets.setBudget(req.user.id, categoryId, req.body?.amount ?? null);
    res.status(204).end();
  })
);

module.exports = router;
