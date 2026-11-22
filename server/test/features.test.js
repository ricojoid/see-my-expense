const test = require('node:test');
const assert = require('node:assert/strict');
const { monthsLeft, withProgress } = require('../src/services/goals.service');
const { keywordFrom } = require('../src/services/rules.service');
const { periodFrom } = require('../src/services/telegram.commands');

test('goals: months left counts the current month, at least 1', () => {
  assert.equal(monthsLeft('2026-11-22', '2026-11-30'), 1);
  assert.equal(monthsLeft('2026-11-22', '2027-06-30'), 8);
  assert.equal(monthsLeft('2026-11-22', '2026-01-01'), 1);
});

test('goals: progress, monthly amount and overdue', () => {
  const g = withProgress({ id: 1, name: 'Laptop', target: '15000000', saved: '3000000', deadline: '2027-06-30' }, '2026-11-22');
  assert.equal(g.percent, 20);
  assert.equal(g.remaining, 12000000);
  assert.equal(g.perMonth, 1500000);
  assert.equal(g.done, false);
  const done = withProgress({ id: 2, name: 'Trip', target: '100', saved: '150', deadline: null }, '2026-11-22');
  assert.equal(done.percent, 100);
  assert.equal(done.done, true);
  assert.equal(done.perMonth, null);
  const late = withProgress({ id: 3, name: 'Old', target: '100', saved: '40', deadline: '2026-10-01' }, '2026-11-22');
  assert.equal(late.overdue, true);
  assert.equal(late.perMonth, 60);
});

test('rules: notes become clean keywords', () => {
  assert.equal(keywordFrom('  Indomaret   Point '), 'indomaret point');
  assert.equal(keywordFrom('Kopi!!'), 'kopi');
  assert.equal(keywordFrom('ab'), null);
  assert.equal(keywordFrom('12345'), null);
  assert.equal(keywordFrom(null), null);
});

test('/spent periods', () => {
  const today = '2026-11-22'; // Sunday
  assert.deepEqual(periodFrom('makan bulan ini', today), { label: 'this month', start: '2026-11-01', end: '2026-11-23', rest: 'makan' });
  assert.deepEqual(periodFrom('transport minggu ini', today), { label: 'this week', start: '2026-11-16', end: '2026-11-23', rest: 'transport' });
  assert.equal(periodFrom('bulan lalu', today).start, '2026-10-01');
  assert.equal(periodFrom('bulan lalu', today).end, '2026-11-01');
  assert.equal(periodFrom('makan', today).label, 'this month');
  assert.equal(periodFrom('kemarin', today).start, '2026-11-21');
});
