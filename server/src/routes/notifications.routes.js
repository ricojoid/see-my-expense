const express = require('express');
const notifications = require('../services/notifications.service');
const push = require('../services/push.service');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

/** Everything the settings screen needs: the server's push key and the user's preferences. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [publicKey, settings] = await Promise.all([push.publicKey(), notifications.getSettings(req.user.id)]);
    res.json({ publicKey, settings });
  })
);

router.put('/', asyncHandler(async (req, res) => res.json(await notifications.updateSettings(req.user.id, req.body || {}))));

router.post(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    await push.subscribe(req.user.id, req.body?.subscription);
    await notifications.ensureSettings(req.user.id);
    res.status(204).end();
  })
);

router.delete(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    await push.unsubscribe(req.user.id, req.body?.endpoint);
    res.status(204).end();
  })
);

router.post('/test', asyncHandler(async (req, res) => res.json({ sent: await notifications.sendTest(req.user.id) })));

module.exports = router;
