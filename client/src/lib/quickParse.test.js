import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick } from './quickParse.js';

const categories = [
  { id: 1, name: 'Food & Drinks', type: 'expense' },
  { id: 2, name: 'Transport', type: 'expense' },
  { id: 3, name: 'Bills & Utilities', type: 'expense' },
  { id: 4, name: 'Groceries', type: 'expense' },
  { id: 5, name: 'Salary', type: 'income' },
  { id: 6, name: 'Freelance', type: 'income' },
];
const accounts = [
  { id: 10, name: 'Cash' },
  { id: 11, name: 'GoPay' },
  { id: 12, name: 'Bank BCA' },
];
const ctx = { categories, accounts, today: '2026-11-22' }; // a Sunday
const parse = (text) => parseQuick(text, ctx);

test('amount units: k, rb, jt, dotted thousands, bare small numbers', () => {
  assert.equal(parse('kopi 25k').amount, 25000);
  assert.equal(parse('makan 35rb').amount, 35000);
  assert.equal(parse('laptop 1,5jt').amount, 1500000);
  assert.equal(parse('sewa 2.5 juta').amount, 2500000);
  assert.equal(parse('belanja 125.000').amount, 125000);
  assert.equal(parse('kopi 25').amount, 25000);
  assert.equal(parse('bayar 150000').amount, 150000);
  assert.equal(parse('rp 20.000 parkir').amount, 20000);
});

test('categories from names and everyday words', () => {
  assert.equal(parse('kopi 25k').categoryId, 1);
  assert.equal(parse('grab 22k').categoryId, 2);
  assert.equal(parse('token listrik 100k').categoryId, 3);
  assert.equal(parse('groceries 80k').categoryId, 4);
  assert.equal(parse('random thing 10k').categoryId, undefined);
});

test('income words switch the type and the categories searched', () => {
  const r = parse('gaji 8jt bca');
  assert.equal(r.type, 'income');
  assert.equal(r.categoryId, 5);
  assert.equal(r.accountId, 12);
  assert.equal(parse('kopi 25k').type, 'expense');
});

test('accounts by name, removed from the note', () => {
  const r = parse('kopi 25k gopay');
  assert.equal(r.accountId, 11);
  assert.equal(r.description, 'Kopi');
});

test('dates: kemarin, n hari lalu, day names, dd/mm, never in the future', () => {
  assert.equal(parse('makan 20k kemarin').occurredOn, '2026-11-21');
  assert.equal(parse('makan 20k kemarin lusa').occurredOn, '2026-11-20');
  assert.equal(parse('makan 20k 3 hari lalu').occurredOn, '2026-11-19');
  assert.equal(parse('makan 20k jumat').occurredOn, '2026-11-20');
  assert.equal(parse('makan 20k minggu').occurredOn, '2026-11-22');
  assert.equal(parse('makan 20k 12/11').occurredOn, '2026-11-12');
  assert.equal(parse('makan 20k 30/12').occurredOn, undefined);
  assert.equal(parse('makan 20k').occurredOn, undefined);
});

test('the note keeps the words that are left', () => {
  assert.equal(parse('nasi padang 35rb kemarin cash').description, 'Nasi padang');
  assert.equal(parse('').description, undefined);
});
