const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind nginx / a reverse proxy in Docker, so req.ip is the real client.
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
