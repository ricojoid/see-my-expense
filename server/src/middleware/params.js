const { toId } = require('../lib/validate');
const { isValidMonth } = require('../lib/dates');
const periods = require('../services/periods.service');
const { badRequest } = require('../lib/http');

/** Parses :id into req.id, or rejects with 400. */
function idParam(req, res, next) {
  const id = toId(req.params.id);
  if (!id) return next(badRequest('invalid id'));
  req.id = id;
  next();
}

/** Parses ?month=YYYY-MM (a book period's key) into req.month; defaults to the current period. */
function monthQuery(req, res, next) {
  const { month } = req.query;
  if (month && !isValidMonth(month)) return next(badRequest('month must be YYYY-MM'));
  if (month) {
    req.month = month;
    return next();
  }
  periods
    .current(req.user.id)
    .then((period) => {
      req.month = period.key;
      next();
    })
    .catch(next);
}

module.exports = { idParam, monthQuery };
