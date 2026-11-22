const { addDays, dateInMonth, shiftMonth } = require('./dates');

/**
 * Book periods ("tutup buku"): a user closes the books on payday, and a new
 * period starts the day after (or the same day when the close is dated
 * yesterday). Before the first close, periods are calendar months.
 *
 * A period is named by a month key 'YYYY-MM', so everything that takes
 * ?month= keeps working: a close starting 26 Nov is "December" (most of its
 * days fall there), one starting 10 Nov is "November". Keys always increase:
 * a close that would reuse the previous key takes the next month instead.
 *
 * Every function here is pure; `closings` is the user's list of
 * { start, key }, sorted by start.
 */

const FAR_FUTURE = '9999-12-31';

/** The month most of a period starting on `start` falls in. */
const keyOf = (start) => (Number(start.slice(8, 10)) > 15 ? shiftMonth(start.slice(0, 7), 1) : start.slice(0, 7));

/** The key a new close starting on `start` gets, after `previous` (the last close kept, or undefined). */
const keyAfter = (start, previous) => {
  const key = keyOf(start);
  if (!previous) return key;
  const next = shiftMonth(previous.key, 1);
  return key > next ? key : next;
};

/** The month a calendar period ends: the next 1st, or the first close for the one just before it. */
function calendarPeriod(key, closings) {
  const first = closings[0];
  const nextKey = shiftMonth(key, 1);
  const end = first && nextKey >= first.key ? first.start : `${nextKey}-01`;
  return { key, start: `${key}-01`, end, booked: false, prevKey: shiftMonth(key, -1), nextKey: first && nextKey >= first.key ? first.key : nextKey };
}

function bookedPeriod(closings, i) {
  const c = closings[i];
  const next = closings[i + 1];
  return {
    key: c.key,
    start: c.start,
    end: next ? next.start : null, // still open: runs until the next close
    booked: true,
    prevKey: i > 0 ? closings[i - 1].key : shiftMonth(c.key, -1),
    nextKey: next ? next.key : null,
  };
}

/** The period that holds `date`. */
function periodAt(closings, date) {
  if (!closings.length || date < closings[0].start) {
    let key = date.slice(0, 7);
    // The last calendar month runs up to the first close (e.g. 1 Oct - 9 Nov).
    if (closings.length && key >= closings[0].key) key = shiftMonth(closings[0].key, -1);
    return calendarPeriod(key, closings);
  }
  let i = closings.length - 1;
  while (closings[i].start > date) i--;
  return bookedPeriod(closings, i);
}

/** The period named `key`; for a key that no close produced, the period around the middle of that month. */
function periodByKey(closings, key) {
  if (!closings.length || key < closings[0].key) return calendarPeriod(key, closings);
  const i = closings.findIndex((c) => c.key === key);
  return i >= 0 ? bookedPeriod(closings, i) : periodAt(closings, `${key}-15`);
}

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/**
 * Adds what pages need: whether it's the current period, the expected end of an
 * open one (a month after it started, or tomorrow if that has passed), days in
 * it and days gone, and the last day. `nextKey` is dropped for periods that
 * haven't started yet, so the app can't move into the future.
 */
function describe(period, closings, today) {
  const tomorrow = addDays(today, 1);
  const startDay = Number(period.start.slice(8, 10));
  let expectedEnd = period.end || dateInMonth(shiftMonth(period.start.slice(0, 7), 1), startDay);
  if (!period.end && expectedEnd <= today) expectedEnd = tomorrow;

  const current = period.start <= today && (!period.end || today < period.end);
  const next = period.nextKey && periodByKey(closings, period.nextKey);
  const elapsedEnd = period.end && period.end < tomorrow ? period.end : tomorrow;
  return {
    ...period,
    nextKey: next && next.start <= today ? period.nextKey : null,
    current,
    upcoming: period.start > today,
    expectedEnd,
    lastDay: addDays(period.end || expectedEnd, -1),
    days: daysBetween(period.start, expectedEnd),
    daysElapsed: Math.max(0, daysBetween(period.start, elapsedEnd)),
  };
}

/** Half-open date range for SQL; an open period reaches into the future. */
const rangeOf = (period) => ({ start: period.start, end: period.end || FAR_FUTURE });

/** The `count` periods ending at `period`, oldest first. */
function periodsBefore(closings, period, count) {
  const list = [period];
  while (list.length < count) list.unshift(periodByKey(closings, list[0].prevKey));
  return list;
}

module.exports = { keyOf, keyAfter, periodAt, periodByKey, describe, rangeOf, periodsBefore, FAR_FUTURE };
