const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN = process.env.AUTH_TOKEN || 'sme-dev-token-2026';

function checkCredentials(username, password) {
  return username === USERNAME && password === PASSWORD;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token || token !== TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  next();
}

module.exports = { checkCredentials, requireAuth, TOKEN };
