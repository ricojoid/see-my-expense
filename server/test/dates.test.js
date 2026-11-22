const test = require('node:test');
const assert = require('node:assert/strict');
const { todayLocal, isValidDate, isValidMonth, shiftMonth, monthRange, dateInMonth, dueRuns } = require('../src/lib/dates');

test('todayLocal uses local calendar date, not UTC', () => {
  // 00:30 local time on 1 March: toISOString() would say 28/29 Feb in UTC+7.
  assert.equal(todayLocal(new Date(2026, 2, 1, 0, 30)), '2026-03-01');
});

test('isValidDate rejects impossible dates', () => {
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isValidDate('2026-13-01'), false);
  assert.equal(isValidDate('2026-1-01'), false);
  assert.equal(isValidDate(undefined), false);
});

test('isValidMonth', () => {
  assert.equal(isValidMonth('2026-11'), true);
  assert.equal(isValidMonth('2026-00'), false);
  assert.equal(isValidMonth('2026-1'), false);
});

test('shiftMonth crosses year boundaries', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-06', -18), '2024-12');
});

test('monthRange is half-open', () => {
  assert.deepEqual(monthRange('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
});

test('dateInMonth clamps to the end of short months', () => {
  assert.equal(dateInMonth('2026-02', 31), '2026-02-28');
  assert.equal(dateInMonth('2026-04', 31), '2026-04-30');
  assert.equal(dateInMonth('2026-05', 31), '2026-05-31');
});

test('dueRuns lists every missed month and keeps the original day', () => {
  const { dates, next } = dueRuns('2026-01-31', 31, '2026-04-15');
  assert.deepEqual(dates, ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(next, '2026-04-30');
});

test('dueRuns returns nothing when the next run is in the future', () => {
  assert.deepEqual(dueRuns('2026-12-01', 1, '2026-11-22'), { dates: [], next: '2026-12-01' });
});

test('dueRuns includes a run due today', () => {
  assert.deepEqual(dueRuns('2026-11-22', 22, '2026-11-22').dates, ['2026-11-22']);
});
