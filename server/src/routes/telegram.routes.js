const express = require('express');
const telegram = require('../services/telegram.service');
const { asyncHandler, badRequest } = require('../lib/http');

const router = express.Router();

/** Is the bot configured on this server, and which chats are linked to me. */
router.get('/', asyncHandler(async (req, res) => res.json(await telegram.status(req.user.id))));

/** A one-time t.me link that connects the chat it's opened in to my account. */
router.post(
  '/link',
  asyncHandler(async (req, res) => {
    if (!telegram.isEnabled()) throw badRequest('the Telegram bot is not set up on this server');
    res.json(await telegram.createLinkCode(req.user.id));
  })
);

router.delete(
  '/link',
  asyncHandler(async (req, res) => {
    await telegram.unlinkAll(req.user.id);
    res.status(204).end();
  })
);

module.exports = router;
