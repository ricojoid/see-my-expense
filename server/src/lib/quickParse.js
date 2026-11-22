/**
 * The quick-entry parser lives in /shared (ES module) so the web app and the
 * API use the same code. This loads it from CommonJS; the functions are async
 * only because the module loads on first use.
 */
let loaded = null;
const shared = () => {
  loaded = loaded || import('../../../shared/quickParse.js');
  return loaded;
};

const parseQuick = async (text, context) => (await shared()).parseQuick(text, context);
const matchCategory = async (text, categories, rules) => (await shared()).matchCategory(text, categories, rules);

module.exports = { parseQuick, matchCategory };
