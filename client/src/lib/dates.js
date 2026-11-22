const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (never UTC, so no off-by-one before 7am in WIB). */
export function toDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const today = () => toDateString();

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

export const currentMonth = () => today().slice(0, 7);

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Parses YYYY-MM-DD as a local date. */
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};

export const formatMonth = (month, style = 'long') =>
  parse(month).toLocaleDateString('en-GB', { month: style, year: 'numeric' });

export const formatMonthShort = (month) => parse(month).toLocaleDateString('en-GB', { month: 'short' });

/** "Today", "Yesterday" or "Mon, 17 Nov". */
export function formatDay(dateString) {
  if (dateString === today()) return 'Today';
  if (dateString === daysAgo(1)) return 'Yesterday';
  return parse(dateString).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const formatDateLong = (dateString) =>
  parse(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Days of `month` that have passed: today's date for the current month, all days for past ones, 0 for future ones. */
export function daysElapsed(month) {
  const current = currentMonth();
  if (month > current) return 0;
  if (month === current) return new Date().getDate();
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
