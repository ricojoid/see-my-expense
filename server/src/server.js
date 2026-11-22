const env = require('./config/env');
const { createApp } = require('./app');
const { startScheduler } = require('./services/scheduler');

// Fail fast on a missing secret instead of on the first login.
void env.jwtSecret;

createApp().listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
  startScheduler();
});
