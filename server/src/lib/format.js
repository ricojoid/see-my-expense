const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

/** "Rp 1.250.000" (non-breaking space replaced so notifications render it plainly). */
const formatRupiah = (value) => rupiah.format(Math.round(value || 0)).replace(/\s/g, ' ');

/** Percentage change from `previous` to `current`, rounded; null when there is nothing to compare. */
function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Which budget line a new expense crossed: 'over' (100%), 'near' (80%) or null.
 * Only fires on the transaction that crosses the line, not on every one after it.
 */
function budgetCrossing(spentBefore, spentAfter, budget) {
  if (!budget || budget <= 0) return null;
  if (spentBefore <= budget && spentAfter > budget) return 'over';
  if (spentBefore < budget * 0.8 && spentAfter >= budget * 0.8 && spentAfter <= budget) return 'near';
  return null;
}

module.exports = { formatRupiah, percentChange, budgetCrossing };
