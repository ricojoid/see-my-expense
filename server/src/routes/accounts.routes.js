const express = require('express');
const accounts = require('../services/accounts.service');
const { idParam } = require('../middleware/params');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => res.json(await accounts.list(req.user.id))));

router.post(
  '/',
  asyncHandler(async (req, res) => res.status(201).json(await accounts.create(req.user.id, req.body || {})))
);

router.put(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => res.json(await accounts.rename(req.user.id, req.id, req.body || {})))
);

router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    await accounts.remove(req.user.id, req.id);
    res.status(204).end();
  })
);

module.exports = router;
