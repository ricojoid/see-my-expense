const { toId } = require('../lib/validate');
const { isValidMonth, todayLocal } = require('../lib/dates');
const { badRequest } = require('../lib/http');

/** Parses :id into req.id, or rejects with 400. */
function idParam(req, res, next) {
  const id = toId(req.params.id);
  if (!id) return next(badRequest('invalid id'));
  req.id = id;
  next();
}

/** Parses ?month=YYYY-MM into req.month (defaults to the current month). */
function monthQuery(req, res, next) {
  const { month } = req.query;
  if (month && !isValidMonth(month)) return next(badRequest('month must be YYYY-MM'));
  req.month = month || todayLocal().slice(0, 7);
  next();
}

module.exports = { idParam, monthQuery };
