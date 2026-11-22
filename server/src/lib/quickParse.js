/**
 * The quick-entry parser lives in /shared (ES module) so the web app and the
 * API use the same code. This loads it from CommonJS.
 */
let loaded = null;

async function parseQuick(text, context) {
  loaded = loaded || import('../../../shared/quickParse.js');
  return (await loaded).parseQuick(text, context);
}

module.exports = { parseQuick };
