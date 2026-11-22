const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, toCsv, parseAmount, parseDateFlexible, mapImportRows } = require('../src/lib/csv');

test('parseCsv handles quotes, escaped quotes and CRLF', () => {
  const rows = parseCsv('a,b,c\r\n1,"hello, world","say ""hi"""\r\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['1', 'hello, world', 'say "hi"'],
  ]);
});

test('parseCsv detects semicolons (Excel in Indonesian locale) and strips the BOM', () => {
  assert.deepEqual(parseCsv('﻿date;amount\n2026-11-01;50.000'), [
    ['date', 'amount'],
    ['2026-11-01', '50.000'],
  ]);
});

test('parseCsv skips blank lines', () => {
  assert.equal(parseCsv('a,b\n\n1,2\n\n').length, 2);
});

test('toCsv round-trips through parseCsv', () => {
  const rows = [['x', 'note, with comma', 'quote " here'], ['1', '', 'line\nbreak']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test('parseAmount understands Indonesian and international formats', () => {
  assert.equal(parseAmount('50000'), 50000);
  assert.equal(parseAmount('50.000'), 50000);
  assert.equal(parseAmount('Rp 1.250.000'), 1250000);
  assert.equal(parseAmount('1.250.000,50'), 1250000.5);
  assert.equal(parseAmount('1,250,000.50'), 1250000.5);
  assert.equal(parseAmount('12.5'), 12.5);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.ok(Number.isNaN(parseAmount('')));
  assert.ok(Number.isNaN(parseAmount('-5')));
});

test('parseDateFlexible', () => {
  assert.equal(parseDateFlexible('2026-11-05'), '2026-11-05');
  assert.equal(parseDateFlexible('5/11/2026'), '2026-11-05');
  assert.equal(parseDateFlexible('05-11-2026'), '2026-11-05');
  assert.equal(parseDateFlexible('31/02/2026'), null);
  assert.equal(parseDateFlexible('yesterday'), null);
});

test('mapImportRows maps aliases and reports bad lines with line numbers', () => {
  const rows = parseCsv(
    [
      'Tanggal,Jenis,Kategori,Jumlah,Catatan,Akun',
      '01/11/2026,pengeluaran,Food,25.000,Lunch,Cash',
      '2026-11-02,income,Salary,"10.000.000",,',
      '2026-11-03,expense,,5000,,',
      'bad-date,expense,Food,5000,,',
    ].join('\n')
  );
  const { records, errors } = mapImportRows(rows);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    line: 2,
    type: 'expense',
    occurredOn: '2026-11-01',
    amount: 25000,
    category: 'Food',
    description: 'Lunch',
    account: 'Cash',
    toAccount: null,
  });
  assert.equal(records[1].amount, 10000000);
  assert.deepEqual(errors.map((e) => e.line), [4, 5]);
});

test('mapImportRows requires date, type and amount columns', () => {
  const { errors } = mapImportRows([['date', 'category'], ['2026-11-01', 'Food']]);
  assert.match(errors[0].error, /type, amount/);
});

test('mapImportRows accepts transfers with a destination account', () => {
  const { records, errors } = mapImportRows(
    parseCsv('date,type,amount,account,to_account\n2026-11-01,transfer,100000,Bank,Cash')
  );
  assert.equal(errors.length, 0);
  assert.equal(records[0].category, null);
  assert.equal(records[0].toAccount, 'Cash');
});
