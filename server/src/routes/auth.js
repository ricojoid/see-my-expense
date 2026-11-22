const express = require('express');
const { checkCredentials, TOKEN } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (checkCredentials(username, password)) {
    return res.json({ token: TOKEN });
  }

  res.status(401).json({ error: 'invalid username or password' });
});

module.exports = router;
