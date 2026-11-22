const express = require('express');
const people = require('../services/people.service');
const { idParam } = require('../middleware/params');
const { asyncHandler } = require('../lib/http');

// People are created when a debt transaction names someone new (see transactions).
const router = express.Router();

router.get('/', asyncHandler(async (req, res) => res.json(await people.list(req.user.id))));

router.put(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => res.json(await people.rename(req.user.id, req.id, req.body || {})))
);

router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    await people.remove(req.user.id, req.id);
    res.status(204).end();
  })
);

module.exports = router;
