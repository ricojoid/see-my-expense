const express = require('express');
const recurring = require('../services/recurring.service');
const { idParam } = require('../middleware/params');
const { validateTransaction } = require('../lib/validate');
const { asyncHandler, badRequest } = require('../lib/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => res.json(await recurring.list(req.user.id))));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { value, error } = validateTransaction(req.body);
    if (error) throw badRequest(error);
    if (value.type === 'transfer') throw badRequest('recurring transfers are not supported');
    res.status(201).json(await recurring.create(req.user.id, value));
  })
);

router.patch(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    if (typeof req.body?.active !== 'boolean') throw badRequest('active must be true or false');
    await recurring.setActive(req.user.id, req.id, req.body.active);
    res.status(204).end();
  })
);

router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    await recurring.remove(req.user.id, req.id);
    res.status(204).end();
  })
);

module.exports = router;
