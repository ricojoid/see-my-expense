const express = require('express');
const users = require('../services/users.service');
const { idParam } = require('../middleware/params');
const { asyncHandler } = require('../lib/http');

// Mounted behind requireAuth + requireAdmin.
const router = express.Router();

router.get('/', asyncHandler(async (req, res) => res.json(await users.list())));

router.post('/', asyncHandler(async (req, res) => res.status(201).json(await users.create(req.body || {}))));

router.put(
  '/:id/password',
  idParam,
  asyncHandler(async (req, res) => {
    await users.resetPassword(req.id, req.body?.password);
    res.status(204).end();
  })
);

router.put(
  '/:id/role',
  idParam,
  asyncHandler(async (req, res) => {
    await users.setRole(req.user.id, req.id, req.body?.role);
    res.status(204).end();
  })
);

router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    await users.remove(req.user.id, req.id);
    res.status(204).end();
  })
);

module.exports = router;
