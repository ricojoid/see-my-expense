const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTransaction, validateUsername, validatePassword, toId } = require('../src/lib/validate');
const { createLimiter } = require('../src/lib/rateLimit');

const base = { type: 'expense', amount: 15000, occurredOn: '2026-11-22', accountId: 1, categoryId: 3 };

test('validateTransaction accepts a normal expense and trims the note', () => {
  const { value, error } = validateTransaction({ ...base, description: '  coffee  ' });
  assert.equal(error, undefined);
  assert.equal(value.description, 'coffee');
  assert.equal(value.toAccountId, null);
});

test('validateTransaction rejects bad amounts, dates and types', () => {
  assert.ok(validateTransaction({ ...base, amount: 0 }).error);
  assert.ok(validateTransaction({ ...base, amount: 'abc' }).error);
  assert.ok(validateTransaction({ ...base, occurredOn: '2026-02-30' }).error);
  assert.ok(validateTransaction({ ...base, type: 'gift' }).error);
  assert.ok(validateTransaction({ ...base, categoryId: undefined }).error);
});

test('validateTransaction: transfers need two different accounts and no category', () => {
  const transfer = { ...base, type: 'transfer', toAccountId: 2 };
  assert.equal(validateTransaction(transfer).value.categoryId, null);
  assert.ok(validateTransaction({ ...transfer, toAccountId: 1 }).error);
  assert.ok(validateTransaction({ ...transfer, toAccountId: undefined }).error);
});

test('username and password rules', () => {
  assert.equal(validateUsername('rico_dev'), null);
  assert.ok(validateUsername('ab'));
  assert.ok(validateUsername('has space'));
  assert.equal(validatePassword('longenough'), null);
  assert.ok(validatePassword('short'));
});

test('toId', () => {
  assert.equal(toId('7'), 7);
  assert.equal(toId('0'), null);
  assert.equal(toId('1.5'), null);
  assert.equal(toId('x'), null);
});

test('login limiter blocks after max failures and resets after the window', () => {
  let now = 0;
  const limiter = createLimiter({ max: 3, windowMs: 1000, now: () => now });
  for (let i = 0; i < 3; i++) limiter.fail('k');
  assert.ok(limiter.retryAfter('k') > 0);
  assert.equal(limiter.retryAfter('other'), 0);
  now = 1000;
  assert.equal(limiter.retryAfter('k'), 0);
});

test('login limiter reset clears failures', () => {
  const limiter = createLimiter({ max: 1 });
  limiter.fail('k');
  limiter.reset('k');
  assert.equal(limiter.retryAfter('k'), 0);
});

test('validateTransaction links debts to a person by id or new name, without needing a category', () => {
  const byId = validateTransaction({ ...base, categoryId: undefined, personId: 7 });
  assert.equal(byId.error, undefined);
  assert.equal(byId.value.personId, 7);
  assert.equal(byId.value.categoryId, null);

  const byName = validateTransaction({ ...base, type: 'income', categoryId: undefined, personName: '  Budi ' });
  assert.equal(byName.value.personName, 'Budi');
  assert.equal(byName.value.personId, null);

  const plain = validateTransaction(base);
  assert.equal(plain.value.personId, null);
  assert.equal(plain.value.personName, null);
});

test('validateTransaction rejects debt links on transfers and blank person names', () => {
  const transfer = { ...base, type: 'transfer', toAccountId: 2, categoryId: undefined };
  assert.ok(validateTransaction({ ...transfer, personName: 'Budi' }).error);
  assert.ok(validateTransaction({ ...base, categoryId: undefined, personId: 'x' }).error);
  assert.ok(validateTransaction({ ...base, categoryId: undefined, personName: '   ' }).error);
});
