const { HttpError } = require('../lib/http');

function notFoundHandler(req, res) {
  res.status(404).json({ error: `no route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'request is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON body' });

  console.error('[error]', err);
  res.status(500).json({ error: 'something went wrong on the server' });
}

module.exports = { notFoundHandler, errorHandler };
