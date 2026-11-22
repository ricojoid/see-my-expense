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
  { id: 7, name: 'Other Expense', type: 'expense' },
  { id: 8, name: 'Health', type: 'expense' },
  { id: 9, name: 'Other Income', type: 'income' },
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
  assert.equal(parse('random thing 10k').categoryId, 7); // unsure -> Other Expense
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
  assert.equal(parse('makan 20k 30/12').occurredOn, '2025-12-30'); // no year + future -> last year
  assert.equal(parse('makan 20k 30/12/2026').occurredOn, undefined); // explicitly in the future
  assert.equal(parse('makan 20k').occurredOn, undefined);
});

test('the note keeps the words that are left', () => {
  assert.equal(parse('nasi padang 35rb kemarin cash').description, 'Nasi padang');
  assert.equal(parse('').description, undefined);
});

const people = [
  { id: 20, name: 'Budi' },
  { id: 21, name: 'Sari Dewi' },
];
const debt = (text) => parseQuick(text, { ...ctx, people });

test('debts: lending and being paid back', () => {
  assert.deepEqual(pick(debt('ngutangin budi 50rb')), { type: 'expense', debt: true, personId: 20, amount: 50000 });
  assert.deepEqual(pick(debt('pinjemin BUDI 50k')), { type: 'expense', debt: true, personId: 20, amount: 50000 });
  assert.deepEqual(pick(debt('budi ngutang 20rb')), { type: 'expense', debt: true, personId: 20, amount: 20000 });
  assert.deepEqual(pick(debt('si budi udah balikin 50rb')), { type: 'income', debt: true, personId: 20, amount: 50000 });
  assert.deepEqual(pick(debt('Budi bayar utang 10k')), { type: 'income', debt: true, personId: 20, amount: 10000 });
  assert.deepEqual(pick(debt('dibalikin sama budi 5k')), { type: 'income', debt: true, personId: 20, amount: 5000 });
});

test('debts: borrowing and paying back', () => {
  assert.deepEqual(pick(debt('utang ke budi 100k')), { type: 'income', debt: true, personId: 20, amount: 100000 });
  assert.deepEqual(pick(debt('pinjam dari budi 1jt')), { type: 'income', debt: true, personId: 20, amount: 1000000 });
  assert.deepEqual(pick(debt('bayar utang ke budi 50k')), { type: 'expense', debt: true, personId: 20, amount: 50000 });
  assert.deepEqual(pick(debt('balikin ke budi 20rb')), { type: 'expense', debt: true, personId: 20, amount: 20000 });
  assert.deepEqual(pick(debt('gw ngutang ke budi 30k')), { type: 'income', debt: true, personId: 20, amount: 30000 });
});

test('debts: new people get a capitalised name, known ones match in any case', () => {
  assert.equal(debt('ngutangin andi 50rb').personName, 'Andi');
  assert.equal(debt('ngutangin andi 50rb').personId, undefined);
  assert.equal(debt('si a udah balikin 50rb').personName, 'A');
  assert.equal(debt('ngutangin sari dewi 75k').personId, 21);
  assert.equal(debt('SARI ngutang 10k').personName, 'Sari'); // "Sari" alone is not "Sari Dewi"
});

test('debts: everyday sentences are not debts', () => {
  assert.equal(debt('bayar listrik 200k').debt, undefined);
  assert.equal(debt('bayar listrik 200k').categoryId, 3);
  assert.equal(debt('gw ngutang 50k').debt, undefined); // nobody named
  assert.equal(debt('kopi 25k').debt, undefined);
});

test('debts: the note keeps only what is left, dates still work', () => {
  const r = debt('ngutangin budi 50rb kemarin buat makan');
  assert.equal(r.occurredOn, '2026-11-21');
  assert.equal(r.description, 'Buat makan');
});

function pick(r) {
  const out = { type: r.type, debt: r.debt, amount: r.amount };
  if (r.personId) out.personId = r.personId;
  if (r.personName) out.personName = r.personName;
  return Object.fromEntries(Object.entries({ type: out.type, debt: out.debt, personId: out.personId, personName: out.personName, amount: out.amount }).filter(([, v]) => v !== undefined));
}

test('everyday words pick the category; unknown ones go to Other', () => {
  assert.equal(parse('tadi bengkel 50 rb').categoryId, 2);
  assert.equal(parse('tadi bengkel 50 rb').amount, 50000);
  assert.equal(parse('tadi bengkel 50 rb').occurredOn, '2026-11-22');
  assert.equal(parse('ganti oli 85k').categoryId, 2);
  assert.equal(parse('tambal ban 15rb').categoryId, 2);
  assert.equal(parse('es teh 5k').categoryId, 1);
  assert.equal(parse('rumah sakit 200k').categoryId, 8);
  assert.equal(parse('beli sabun indomaret 30k').categoryId, 4);
  assert.equal(parse('wifi 300k').categoryId, 3);
  assert.equal(parse('sesuatu 10k').categoryId, 7);
  assert.equal(parse('dapet duit 50k').categoryId, 9); // income, unsure -> Other Income
});

test('dates by month name and "tgl"', () => {
  const r = parse('10 november lupa bayar makan 35k');
  assert.equal(r.occurredOn, '2026-11-10');
  assert.equal(r.amount, 35000);
  assert.equal(r.categoryId, 1);
  assert.equal(r.description, 'Lupa bayar makan');
  assert.equal(parse('makan 20k 10 nov').occurredOn, '2026-11-10');
  assert.equal(parse('makan 20k 3 Oktober').occurredOn, '2026-10-03');
  assert.equal(parse('makan 20k 17 agustus 2025').occurredOn, '2025-08-17');
  assert.equal(parse('makan 20k 30 desember').occurredOn, '2025-12-30');
  assert.equal(parse('makan 20k tgl 5').occurredOn, '2026-11-05');
  assert.equal(parse('makan 20k tanggal 30').occurredOn, '2026-10-30'); // the 30th hasn't come yet: last month
  assert.equal(parse('makan 20k 31 februari').occurredOn, undefined);
  assert.equal(parse('kopi 25 mei').amount, undefined); // "25 mei" is a date, not an amount
});
