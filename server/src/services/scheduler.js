const notifications = require('./notifications.service');

const EVERY_MINUTE = 60 * 1000;

/** Runs time-based jobs (reminders, weekly summaries) once a minute. */
function startScheduler() {
  let running = false;
  const run = async () => {
    if (running) return; // a slow run never overlaps the next one
    running = true;
    try {
      await notifications.tick();
    } catch (err) {
      console.error('[scheduler]', err.message);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 10 * 1000);
  return setInterval(run, EVERY_MINUTE);
}

module.exports = { startScheduler };
