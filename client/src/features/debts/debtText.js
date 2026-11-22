import { formatCurrency } from '../../lib/format';

/** Must match DEBT_CATEGORY on the server. */
export const DEBT_CATEGORY = 'Debts & Loans';

/**
 * A person's balance: positive means they owe you, negative means you owe them.
 * Returns { tone, text } for one-line display. Pass useMoney()'s formatter to respect "hide amounts".
 */
export function describeBalance(person, money = formatCurrency) {
  const amount = money(Math.abs(person.balance));
  if (person.balance > 0) return { tone: 'owed', text: `${person.name} owes you ${amount}` };
  if (person.balance < 0) return { tone: 'owe', text: `You owe ${person.name} ${amount}` };
  return { tone: 'settled', text: `All settled with ${person.name}` };
}

/** What a debt transaction means, from its type: money out = gave, money in = got. */
export const debtVerb = (type, person) => (type === 'expense' ? `To ${person}` : `From ${person}`);

export const TONE_CLASS = {
  owed: 'text-income',
  owe: 'text-expense',
  settled: 'text-ink-3',
};
