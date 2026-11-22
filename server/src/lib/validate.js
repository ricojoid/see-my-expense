const { isValidDate } = require('./dates');

const TX_TYPES = ['income', 'expense', 'transfer'];
const CATEGORY_TYPES = ['income', 'expense'];
const MAX_AMOUNT = 999999999999; // fits DECIMAL(14,2)

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateUsername(username) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())) {
    return 'username must be 3-30 characters (letters, digits, _ . -)';
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'password must be at least 8 characters';
  if (password.length > 128) return 'password must be at most 128 characters';
  return null;
}

function validateName(name, label = 'name') {
  if (typeof name !== 'string' || !name.trim()) return { error: `${label} is required` };
  if (name.trim().length > 50) return { error: `${label} must be at most 50 characters` };
  return { value: name.trim() };
}

function validateAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return { error: 'amount must be greater than 0' };
  if (n > MAX_AMOUNT) return { error: 'amount is too large' };
  return { value: Math.round(n * 100) / 100 };
}

/** Shape validation for a transaction payload (ownership is checked against the DB later). */
function validateTransaction(body = {}) {
  const { type, description, occurredOn } = body;
  if (!TX_TYPES.includes(type)) return { error: 'type must be income, expense or transfer' };

  const amount = validateAmount(body.amount);
  if (amount.error) return amount;

  if (!isValidDate(occurredOn)) return { error: 'date must be a valid YYYY-MM-DD' };

  const accountId = toId(body.accountId);
  if (!accountId) return { error: 'account is required' };

  // Debts: money given to (expense) or received from (income) a person, picked by id or named new.
  let personId = null;
  let personName = null;
  const linksPerson = body.personId != null || (typeof body.personName === 'string' && body.personName.trim());
  if (linksPerson) {
    if (type === 'transfer') return { error: 'a transfer cannot be linked to a person' };
    personId = toId(body.personId);
    if (!personId) {
      const name = validateName(body.personName, 'person name');
      if (name.error) return name;
      personName = name.value;
    }
  }

  let categoryId = null;
  let toAccountId = null;
  if (type === 'transfer') {
    toAccountId = toId(body.toAccountId);
    if (!toAccountId) return { error: 'destination account is required' };
    if (toAccountId === accountId) return { error: 'source and destination accounts must differ' };
  } else if (!linksPerson) {
    // Debt transactions always use the "Debts & Loans" category, set by the service.
    categoryId = toId(body.categoryId);
    if (!categoryId) return { error: 'category is required' };
  }

  if (description != null && typeof description !== 'string') return { error: 'invalid note' };
  const desc = description ? description.trim().slice(0, 255) : null;

  return {
    value: {
      type,
      amount: amount.value,
      occurredOn,
      accountId,
      toAccountId,
      categoryId,
      personId,
      personName,
      description: desc || null,
    },
  };
}

module.exports = {
  TX_TYPES,
  CATEGORY_TYPES,
  toId,
  validateUsername,
  validatePassword,
  validateName,
  validateAmount,
  validateTransaction,
};
