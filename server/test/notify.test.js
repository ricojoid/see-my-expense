const test = require('node:test');
const assert = require('node:assert/strict');
const { addDays, weekday, lastWeek, timeLocal } = require('../src/lib/dates');
const { formatRupiah, percentChange, budgetCrossing } = require('../src/lib/format');

test('addDays and weekday handle month and year edges', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(weekday('2026-11-23'), 0); // Monday
  assert.equal(weekday('2026-11-22'), 6); // Sunday
});

test('lastWeek is the previous Monday-Sunday, half-open', () => {
  assert.deepEqual(lastWeek('2026-11-23'), { start: '2026-11-16', end: '2026-11-23', previousStart: '2026-11-09' });
  assert.deepEqual(lastWeek('2026-11-22'), { start: '2026-11-09', end: '2026-11-16', previousStart: '2026-11-02' });
});

test('timeLocal pads hours and minutes', () => {
  assert.equal(timeLocal(new Date(2026, 0, 1, 8, 5)), '08:05');
});

test('formatRupiah and percentChange', () => {
  assert.equal(formatRupiah(1250000), 'Rp 1.250.000');
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(50, 0), null);
});

test('budgetCrossing fires once per line', () => {
  assert.equal(budgetCrossing(700, 850, 1000), 'near');
  assert.equal(budgetCrossing(850, 900, 1000), null);
  assert.equal(budgetCrossing(900, 1100, 1000), 'over');
  assert.equal(budgetCrossing(700, 1100, 1000), 'over');
  assert.equal(budgetCrossing(1100, 1200, 1000), null);
  assert.equal(budgetCrossing(0, 500, null), null);
});
