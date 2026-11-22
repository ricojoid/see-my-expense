const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/periods');

const closings = [
  { start: '2026-10-26', key: '2026-11' }, // closed on payday, 25 Oct
  { start: '2026-11-26', key: '2026-12' },
];

test('a close names its period by the month most of it falls in', () => {
  assert.equal(P.keyOf('2026-11-26'), '2026-12');
  assert.equal(P.keyOf('2026-11-10'), '2026-11');
  assert.equal(P.keyAfter('2026-12-15', { key: '2026-12' }), '2027-01'); // never reuses a key
  assert.equal(P.keyAfter('2026-11-26'), '2026-12');
});

test('without closings periods are calendar months', () => {
  const p = P.periodAt([], '2026-11-22');
  assert.deepEqual([p.key, p.start, p.end], ['2026-11', '2026-11-01', '2026-12-01']);
});

test('booked periods run from one close to the next; the last stays open', () => {
  const nov = P.periodByKey(closings, '2026-11');
  assert.deepEqual([nov.start, nov.end, nov.prevKey, nov.nextKey], ['2026-10-26', '2026-11-26', '2026-10', '2026-12']);
  const dec = P.periodAt(closings, '2026-12-20');
  assert.deepEqual([dec.key, dec.start, dec.end], ['2026-12', '2026-11-26', null]);
  assert.deepEqual(P.rangeOf(dec), { start: '2026-11-26', end: P.FAR_FUTURE });
});

test('the calendar month before the first close ends at it', () => {
  const oct = P.periodByKey(closings, '2026-10');
  assert.deepEqual([oct.start, oct.end, oct.nextKey], ['2026-10-01', '2026-10-26', '2026-11']);
  const early = [{ start: '2026-11-10', key: '2026-11' }];
  const before = P.periodAt(early, '2026-11-05');
  assert.deepEqual([before.key, before.start, before.end], ['2026-10', '2026-10-01', '2026-11-10']);
});

test('closing today keeps today in the old period; the new one is upcoming', () => {
  const list = [{ start: '2026-11-23', key: '2026-12' }];
  const today = '2026-11-22';
  const current = P.describe(P.periodAt(list, today), list, today);
  assert.equal(current.key, '2026-11');
  assert.equal(current.end, '2026-11-23');
  assert.equal(current.nextKey, null); // the new period hasn't started
  assert.equal(current.daysElapsed, 22);
});

test('describe: an open period is expected to last a month', () => {
  const d = P.describe(P.periodAt(closings, '2026-12-01'), closings, '2026-12-01');
  assert.equal(d.current, true);
  assert.equal(d.expectedEnd, '2026-12-26');
  assert.equal(d.lastDay, '2026-12-25');
  assert.equal(d.days, 30);
  assert.equal(d.daysElapsed, 6);
  // Forgot to close: it simply runs on.
  const late = P.describe(P.periodAt(closings, '2027-01-03'), closings, '2027-01-03');
  assert.equal(late.expectedEnd, '2027-01-04');
});

test('periodsBefore walks back across booked and calendar periods', () => {
  const keys = P.periodsBefore(closings, P.periodByKey(closings, '2026-12'), 4).map((p) => p.key);
  assert.deepEqual(keys, ['2026-09', '2026-10', '2026-11', '2026-12']);
});
