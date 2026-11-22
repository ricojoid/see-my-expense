const express = require('express');
const auth = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth');
const { createLimiter } = require('../lib/rateLimit');
const { asyncHandler, HttpError } = require('../lib/http');

const router = express.Router();
const loginLimiter = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const key = `${req.ip}|${username.toLowerCase()}`;

    const wait = loginLimiter.retryAfter(key);
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      throw new HttpError(429, `too many failed attempts, try again in ${Math.ceil(wait / 60)} min`);
    }

    try {
      const session = await auth.login(username, password);
      loginLimiter.reset(key);
      res.json(session);
    } catch (err) {
      if (err.status === 401) loginLimiter.fail(key);
      throw err;
    }
  })
);

router.get('/me', requireAuth, (req, res) => res.json(req.user));

router.put(
  '/me/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    await auth.changePassword(req.user.id, req.body?.currentPassword, req.body?.newPassword);
    res.status(204).end();
  })
);

module.exports = router;
