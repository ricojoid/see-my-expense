/** Spent and earned in a list of transactions, kept apart (never netted). Transfers count for neither. */
export function totalsByType(items) {
  const totals = { expense: 0, income: 0 };
  for (const t of items) if (t.type in totals) totals[t.type] += t.amount;
  return totals;
}
