const express = require('express');
const categories = require('../services/categories.service');
const rules = require('../services/rules.service');
const { idParam } = require('../middleware/params');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => res.json(await categories.list(req.user.id))));

/** Keywords learned from corrections, for the quick-entry parser. */
router.get('/rules', asyncHandler(async (req, res) => res.json(await rules.list(req.user.id))));

router.post(
  '/',
  asyncHandler(async (req, res) => res.status(201).json(await categories.create(req.user.id, req.body || {})))
);

router.put(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => res.json(await categories.update(req.user.id, req.id, req.body || {})))
);

router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    await categories.remove(req.user.id, req.id);
    res.status(204).end();
  })
);

module.exports = router;
