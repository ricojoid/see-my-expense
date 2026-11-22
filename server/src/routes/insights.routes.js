const express = require('express');
const insights = require('../services/insights.service');
const report = require('../services/report.service');
const { monthQuery } = require('../middleware/params');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

/** Where this month's spending is heading. */
router.get('/projection', asyncHandler(async (req, res) => res.json(await insights.projection(req.user.id))));

/** Expenses that look like subscriptions and could become recurring rules. */
router.get('/subscriptions', asyncHandler(async (req, res) => res.json(await insights.subscriptionSuggestions(req.user.id))));

/** The month as a PDF report. */
router.get(
  '/report',
  monthQuery,
  asyncHandler(async (req, res) => {
    const pdf = await report.monthlyReport(req.user.id, req.month, req.user.username);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${report.reportFileName(req.month)}"`);
    res.send(pdf);
  })
);

module.exports = router;
