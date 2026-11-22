/**
 * Turns a quick note like "kopi 25k gopay kemarin" into transaction fields.
 * Pure: everything it needs comes in, so it is easy to test.
 *
 *   parseQuick(text, { categories, accounts, today })
 *     -> { type?, amount?, categoryId?, accountId?, occurredOn?, description }
 *
 * Only fields it is confident about are returned; the form keeps the rest.
 */

const pad = (n) => String(n).padStart(2, '0');
const toDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (today, n) => {
  const d = parseDate(today);
  d.setDate(d.getDate() + n);
  return toDate(d);
};

const MULTIPLIERS = { k: 1e3, rb: 1e3, ribu: 1e3, jt: 1e6, juta: 1e6 };
// "25k", "35rb", "1,5jt", "25.000", "25000", "2.5 juta"
const AMOUNT_RE = /(?:^|\s)(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta)?(?=\s|$)/i;

function readAmount(text) {
  const m = AMOUNT_RE.exec(text);
  if (!m) return null;
  const [token, digits, unit] = m;
  let value;
  if (/^\d{1,3}(\.\d{3})+$/.test(digits) && !unit) value = Number(digits.replace(/\./g, ''));
  else value = Number(digits.replace(',', '.'));
  if (unit) value *= MULTIPLIERS[unit.toLowerCase()];
  else if (value < 1000) value *= 1000; // "kopi 25" means 25 thousand
  return { amount: Math.round(value), token: token.trim() };
}

const DAY_NAMES = [
  ['senin', 'monday', 'mon'],
  ['selasa', 'tuesday', 'tue'],
  ['rabu', 'wednesday', 'wed'],
  ['kamis', 'thursday', 'thu'],
  ['jumat', "jum'at", 'friday', 'fri'],
  ['sabtu', 'saturday', 'sat'],
  ['minggu', 'sunday', 'sun'],
];

/** Finds a date phrase; returns { date, phrase } or null. Dates never go into the future. */
function readDate(text, today) {
  const lower = text.toLowerCase();
  let m = /\b(kemarin lusa|kemaren lusa)\b/.exec(lower);
  if (m) return { date: addDays(today, -2), phrase: m[0] };
  m = /\b(kemarin|kemaren|yesterday)\b/.exec(lower);
  if (m) return { date: addDays(today, -1), phrase: m[0] };
  m = /\b(hari ini|today|tadi)\b/.exec(lower);
  if (m) return { date: today, phrase: m[0] };
  m = /\b(\d{1,2}) (hari lalu|hari yang lalu|days? ago)\b/.exec(lower);
  if (m) return { date: addDays(today, -Number(m[1])), phrase: m[0] };
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(lower);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (d.getDate() === Number(m[1]) && toDate(d) <= today) return { date: toDate(d), phrase: m[0] };
  }
  const todayIndex = (parseDate(today).getDay() + 6) % 7; // 0 = Monday
  for (let i = 0; i < DAY_NAMES.length; i++) {
    for (const name of DAY_NAMES[i]) {
      const found = new RegExp(`\\b${name.replace("'", "\\'")}\\b`).exec(lower);
      if (found) return { date: addDays(today, -((todayIndex - i + 7) % 7)), phrase: found[0] };
    }
  }
  return null;
}

const INCOME_WORDS = /\b(gaji|gajian|salary|dapat|dapet|terima|diterima|masuk|income|bonus|thr|dibayar|refund|cashback|freelance)\b/i;

/** Everyday words -> a pattern for the category name they usually belong to. */
const CATEGORY_HINTS = [
  [/\b(makan|kopi|coffee|nasi|bakso|mie|mi|ayam|sarapan|lunch|dinner|breakfast|jajan|snack|resto|cafe|warteg|padang|minum|boba|teh|martabak|sate|seblak|gofood|grabfood)\b/i, /food|makan|drink|minum|kuliner/i],
  [/\b(belanja|sayur|indomaret|alfamart|supermarket|groceries|grocery|pasar)\b/i, /grocer|belanja|dapur/i],
  [/\b(grab|gojek|ojek|ojol|bensin|parkir|tol|kereta|krl|mrt|lrt|busway|transjakarta|taxi|taksi|bus|pertalite|pertamax|maxim)\b/i, /transport|kendaraan/i],
  [/\b(listrik|pln|pdam|internet|wifi|indihome|pulsa|kuota|token|tagihan)\b/i, /bill|utilit|tagihan|listrik/i],
  [/\b(kos|kost|kontrakan|sewa|rent)\b/i, /hous|rumah|kos|sewa|rent/i],
  [/\b(nonton|bioskop|netflix|spotify|youtube|game|steam|konser|hiburan)\b/i, /entertain|hiburan|langganan|subscri/i],
  [/\b(obat|dokter|apotek|klinik|rs|vitamin|bpjs)\b/i, /health|sehat|medis/i],
  [/\b(baju|sepatu|celana|shopee|tokopedia|tokped|lazada|tiktokshop)\b/i, /shop|belanja/i],
  [/\b(buku|kursus|kuliah|course|les|ukt|spp)\b/i, /educ|pendidikan|sekolah/i],
  [/\b(gaji|gajian|salary)\b/i, /salary|gaji/i],
  [/\b(freelance|project|proyek|client|klien)\b/i, /freelance|proyek|project/i],
  [/\b(bonus|thr)\b/i, /bonus|gift|hadiah/i],
];

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const GENERIC_ACCOUNT_WORDS = new Set(['bank', 'wallet', 'ewallet', 'account', 'card', 'kartu', 'rekening', 'dompet', 'my']);

/** An account whose full name is in the text, else one whose distinctive word is ("bca" -> "Bank BCA"). */
function findAccount(text, accounts) {
  const tokens = new Set(words(text));
  const full = accounts.find((a) => {
    const name = words(a.name);
    return name.length > 0 && name.every((w) => tokens.has(w));
  });
  if (full) return full;
  return accounts.find((a) => words(a.name).some((w) => !GENERIC_ACCOUNT_WORDS.has(w) && w.length >= 3 && tokens.has(w)));
}

function findCategory(text, categories) {
  const tokens = new Set(words(text));
  // 1. The category's own name ("transport 15k").
  const direct = categories.find((c) => words(c.name).some((w) => w.length >= 4 && tokens.has(w)));
  if (direct) return direct;
  // 2. Everyday words ("grab 22k" -> Transport).
  for (const [hint, categoryPattern] of CATEGORY_HINTS) {
    if (!hint.test(text)) continue;
    const match = categories.find((c) => categoryPattern.test(c.name));
    if (match) return match;
  }
  return null;
}

export function parseQuick(text, { categories = [], accounts = [], today }) {
  const result = {};
  let rest = ` ${text.trim()} `;
  if (!rest.trim()) return result;

  const date = readDate(rest, today);
  if (date) {
    result.occurredOn = date.date;
    rest = rest.replace(new RegExp(date.phrase.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'), ' ');
  }

  const amount = readAmount(rest);
  if (amount) {
    result.amount = amount.amount;
    rest = rest.replace(amount.token, ' ');
  }

  const type = INCOME_WORDS.test(rest) ? 'income' : 'expense';
  result.type = type;

  const category = findCategory(rest, categories.filter((c) => c.type === type));
  if (category) result.categoryId = category.id;

  const account = findAccount(rest, accounts);
  if (account) {
    result.accountId = account.id;
    for (const w of words(account.name)) rest = rest.replace(new RegExp(`\\b${w}\\b`, 'i'), ' ');
  }

  const description = rest.replace(/\s+/g, ' ').trim();
  result.description = description ? description[0].toUpperCase() + description.slice(1) : '';
  return result;
}
