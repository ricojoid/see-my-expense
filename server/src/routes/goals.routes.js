const express = require('express');
const goals = require('../services/goals.service');
const { idParam } = require('../middleware/params');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => res.json(await goals.list(req.user.id))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await goals.create(req.user.id, req.body))));
router.put('/:id', idParam, asyncHandler(async (req, res) => res.json(await goals.update(req.user.id, req.id, req.body))));
router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    await goals.remove(req.user.id, req.id);
    res.status(204).end();
  })
);

/** Money in (or out, with withdraw: true). */
router.post('/:id/contributions', idParam, asyncHandler(async (req, res) => res.status(201).json(await goals.contribute(req.user.id, req.id, req.body))));
router.get('/:id/contributions', idParam, asyncHandler(async (req, res) => res.json(await goals.history(req.user.id, req.id))));

module.exports = router;
