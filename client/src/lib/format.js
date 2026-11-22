const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** Rp 1.250.000 */
export const formatCurrency = (value) => rupiah.format(value || 0).replace(/ /g, ' ');

/** Rp 1.3M, for tight spaces like chart axes. */
export const formatCompact = (value) => `Rp ${compact.format(value || 0)}`;

/** 1.250.000 (no currency), for the amount field. */
export const formatGrouped = (value) => (value ? grouped.format(value) : '');

/** Keeps only digits from user input and returns a number (0 when empty). */
export const parseDigits = (text) => Number(String(text).replace(/\D/g, '').slice(0, 13)) || 0;

export const signFor = (type) => (type === 'income' ? '+' : type === 'expense' ? '−' : '');
