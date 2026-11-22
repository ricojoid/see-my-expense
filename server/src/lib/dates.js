// Date helpers that work on plain 'YYYY-MM-DD' / 'YYYY-MM' strings so nothing
// is ever shifted by the server's or the browser's timezone.

const pad = (n) => String(n).padStart(2, '0');

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today in the server's local timezone (set TZ, e.g. Asia/Jakarta). */
function todayLocal(now = new Date()) {
  return formatDate(now);
}

function daysInMonth(year, month1) {
  return new Date(year, month1, 0).getDate();
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

function isValidMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Half-open range [start, end) so the query can use an index on occurred_on. */
function monthRange(month) {
  return { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` };
}

/** The given month's day, clamped to the month's length (31 -> 30 / 28 ...). */
function dateInMonth(month, dayOfMonth) {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(Math.min(dayOfMonth, daysInMonth(y, m)))}`;
}

/**
 * For a monthly rule whose next run is `nextRunOn`, list every run date up to
 * and including `today`, and the next run after those.
 */
function dueRuns(nextRunOn, dayOfMonth, today, limit = 120) {
  const dates = [];
  let next = nextRunOn;
  while (next <= today && dates.length < limit) {
    dates.push(next);
    next = dateInMonth(shiftMonth(next.slice(0, 7), 1), dayOfMonth);
  }
  return { dates, next };
}

module.exports = {
  formatDate,
  todayLocal,
  isValidDate,
  isValidMonth,
  shiftMonth,
  monthRange,
  dateInMonth,
  dueRuns,
};
