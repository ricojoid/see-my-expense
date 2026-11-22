const { verifyToken, findUserById } = require('../services/auth.service');
const { HttpError } = require('../lib/http');

/** Verifies the bearer token and loads the user, so deletions and role changes apply at once. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token && verifyToken(token);
    if (!payload) throw new HttpError(401, 'session expired, please sign in again');

    const user = await findUserById(Number(payload.sub));
    if (!user) throw new HttpError(401, 'this account no longer exists');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'admins only'));
  next();
}

module.exports = { requireAuth, requireAdmin };
