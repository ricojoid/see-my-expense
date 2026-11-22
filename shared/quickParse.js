/**
 * Shared by the web app (quick entry) and the API (Telegram bot).
 *
 * Turns a quick note like "kopi 25k gopay kemarin" into transaction fields.
 * Pure: everything it needs comes in, so it is easy to test.
 *
 *   parseQuick(text, { categories, accounts, people, today })
 *     -> { type?, amount?, categoryId?, accountId?, occurredOn?, description,
 *          debt?, personId?, personName? }
 *
 * Debts ("ngutangin budi 50rb", "budi udah balikin 50rb") come back with
 * debt: true and the person: a known one by id (names match in any case),
 * or a new name.
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

const MONTHS = [
  ['januari', 'january', 'jan'],
  ['februari', 'february', 'feb', 'pebruari'],
  ['maret', 'march', 'mar'],
  ['april', 'apr'],
  ['mei', 'may'],
  ['juni', 'june', 'jun'],
  ['juli', 'july', 'jul'],
  ['agustus', 'august', 'agu', 'agt', 'ags', 'aug'],
  ['september', 'sept', 'sep'],
  ['oktober', 'october', 'okt', 'oct'],
  ['november', 'nopember', 'nov', 'nop'],
  ['desember', 'december', 'des', 'dec'],
];
const MONTH_WORDS = MONTHS.flat().sort((a, b) => b.length - a.length).join('|');
const monthNumber = (word) => MONTHS.findIndex((names) => names.includes(word)) + 1;

/**
 * Day / month (and maybe year) as a date that isn't in the future: without a
 * year it is the most recent one ("30 desember" typed in November = last year).
 * Null when the day doesn't exist or a given year puts it in the future.
 */
function pastDate(today, day, month, year) {
  const thisYear = Number(today.slice(0, 4));
  const make = (y) => {
    const d = new Date(y, month - 1, day);
    return d.getMonth() === month - 1 && d.getDate() === day ? toDate(d) : null;
  };
  if (year) {
    const date = make(year);
    return date && date <= today ? date : null;
  }
  const date = make(thisYear);
  if (!date) return null;
  return date <= today ? date : make(thisYear - 1);
}

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
  // "10 november", "10 nov 2025", "tgl 10"
  m = new RegExp(String.raw`\b(\d{1,2})\s+(${MONTH_WORDS})\b(?:\s+(\d{4}))?`).exec(lower);
  if (m) {
    const date = pastDate(today, Number(m[1]), monthNumber(m[2]), m[3] && Number(m[3]));
    if (date) return { date, phrase: m[0] };
  }
  // "tgl 5": this month, or last month if that day hasn't come yet
  m = /\b(?:tgl|tanggal)\.?\s*(\d{1,2})\b/.exec(lower);
  if (m) {
    const [y, mo] = today.split('-').map(Number);
    const thisMonth = pastDate(today, Number(m[1]), mo, y);
    const lastMonth = mo === 1 ? pastDate(today, Number(m[1]), 12, y - 1) : pastDate(today, Number(m[1]), mo - 1, y);
    const date = thisMonth || lastMonth;
    if (date) return { date, phrase: m[0] };
  }
  // "12/11", "12/11/2026"
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(lower);
  if (m) {
    const year = m[3] && (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]));
    const date = pastDate(today, Number(m[1]), Number(m[2]), year);
    if (date) return { date, phrase: m[0] };
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

const INCOME_WORDS = /\b(gaji|gajian|salary|dapat|dapet|terima|diterima|masuk|income|bonus|thr|dibayar|refund|cashback|freelance|komisi|fee|honor|upah|jualan|dividen|hadiah)\b/i;

/**
 * Everyday words -> the category they usually belong to (matched against the
 * user's category names). Checked in order, so more specific lists come first.
 */
const CATEGORY_WORDS = [
  [
    /transport|kendaraan|vehicle/i,
    'grab gojek ojek ojol maxim indrive gocar grabcar taxi taksi bluebird bus busway transjakarta krl kereta commuter mrt lrt ' +
      'pesawat tiket travel bensin pertalite pertamax solar spbu shell bbm parkir parkiran tol etoll e-toll ' +
      'bengkel servis service ganti oli oli ban tambal cuci motor mobil sparepart aki stnk sim pajak kendaraan',
  ],
  [
    /food|makan|drink|minum|kuliner|meal/i,
    'makan makanan maksi makan siang sarapan breakfast lunch dinner brunch kopi coffee ngopi cafe kafe resto restoran warteg warung ' +
      'padang nasi bakso mie mi indomie ayam geprek sate soto seblak martabak gorengan bubur pecel nasgor burger pizza kfc mcd mcdonalds ' +
      'jajan jajanan snack cemilan camilan roti kue es teh minum minuman boba jus susu gofood grabfood shopeefood',
  ],
  [
    /grocer|belanja\s*dapur|dapur|kebutuhan/i,
    'belanja bulanan groceries grocery sayur sayuran buah daging telur beras minyak gula indomaret alfamart alfamidi superindo ' +
      'hypermart transmart supermarket pasar sabun sampo odol tisu deterjen galon gas elpiji lpg',
  ],
  [
    /bill|utilit|tagihan|listrik/i,
    'listrik pln token pdam air internet wifi indihome biznet myrepublic firstmedia pulsa kuota paket data telkomsel xl indosat ' +
      'tri smartfren tagihan iuran ipl bpjs asuransi cicilan kredit paylater',
  ],
  [/hous|rumah|kos|sewa|rent|tempat tinggal/i, 'kos kost kosan kontrakan sewa rent apartemen apart renovasi tukang perabot furniture'],
  [/health|sehat|medis|kesehatan/i, 'obat dokter apotek apotik klinik rs sakit puskesmas vitamin suplemen gigi dental cek lab periksa masker'],
  [
    /entertain|hiburan|langganan|subscri|leisure/i,
    'nonton bioskop cgv xxi film netflix spotify youtube disney vidio prime game steam topup top up diamond konser karaoke ' +
      'liburan wisata hotel staycation main hiburan hobi',
  ],
  [
    /shop|belanja/i,
    'baju kaos kemeja celana jaket sepatu sandal tas jam aksesoris skincare makeup kosmetik parfum shopee tokopedia tokped ' +
      'lazada tiktokshop blibli zalora uniqlo gadget hp charger casing elektronik',
  ],
  [/educ|pendidikan|sekolah|belajar/i, 'buku kursus kuliah course les bimbel ukt spp sekolah seminar workshop sertifikasi udemy'],
  [/gift|hadiah|donat|sedekah|sosial|charity/i, 'kado hadiah gift sedekah infaq zakat donasi sumbangan kondangan amplop arisan'],
  [/pet|hewan|peliharaan/i, 'kucing anjing pet whiskas royal canin pasir vet grooming'],
  [/salary|gaji/i, 'gaji gajian salary payroll'],
  [/freelance|proyek|project|side/i, 'freelance project proyek client klien job fee komisi honor'],
  [/bonus|thr/i, 'bonus thr insentif'],
  [/invest|saham|dividen|bunga/i, 'dividen bunga saham reksadana crypto kripto profit cuan'],
];

const wordsPattern = (list) => new RegExp(`\\b(?:${list.trim().split(/\s+/).map((w) => w.replace(/[-]/g, '\\-')).join('|')})\\b`, 'i');
const CATEGORY_HINTS = CATEGORY_WORDS.map(([categoryPattern, list]) => [wordsPattern(list), categoryPattern]);

/** "Other Expense" / "Lain-lain" ...: where a transaction goes when nothing else fits. */
const OTHER_CATEGORY = /^(other|others|lain|lainnya|lain-lain|misc|etc)\b/i;

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// ---- Debts ----

const WHO = String.raw`(?:si\s+)?([a-z][a-z0-9'.-]*)`;
const NOT_A_NAME = new Set([
  'gw', 'gue', 'gua', 'guwe', 'aku', 'saya', 'ane', 'w', 'i', 'me', 'kita', 'kami',
  'ke', 'dari', 'sama', 'ama', 'sm', 'oleh', 'udah', 'sudah', 'dah', 'utang', 'hutang', 'yang', 'buat', 'untuk',
]);
const re = (source) => new RegExp(source);

/**
 * Tried in order. 'expense' = money left you (you lent it, or paid a debt
 * back); 'income' = money came in (you borrowed it, or were paid back).
 * The person's balance follows from that.
 */
const DEBT_PATTERNS = [
  // you paid back: "bayar utang ke budi", "balikin ke budi", "lunasin ke budi"
  // (before "utang ke", which it contains)
  [re(String.raw`\b(?:bayar|balikin|kembaliin|ngembaliin|lunasin|nyicil)(?:\s+(?:utang|hutang))?\s+(?:ke|sama|ama|sm)\s+` + WHO), 'expense'],
  // you borrowed: "utang ke budi", "pinjam dari budi", "minjem sama budi"
  [re(String.raw`\b(?:ngutang|utang|hutang|pinjam|pinjem|minjem|minjam)\s+(?:ke|dari|sama|ama|sm)\s+` + WHO), 'income'],
  // you lent: "ngutangin budi", "pinjemin budi", "minjemin budi"
  [re(String.raw`\b(?:ngutangin|ngutangi|minjemin|pinjemin|minjamin|pinjamin|pinjamkan|meminjamkan)\s+` + WHO), 'expense'],
  // you were paid back: "dibalikin sama budi"
  [re(String.raw`\b(?:dibalikin|dikembaliin|dibayar)\s+(?:sama|ama|sm|oleh)\s+` + WHO), 'income'],
  // you were paid back: "budi balikin", "si a udah balikin", "budi bayar utang"
  [re(String.raw`\b` + WHO + String.raw`\s+(?:udah\s+|sudah\s+|dah\s+|baru\s+)?(?:balikin|ngembaliin|mengembalikan|nyicil|lunasin|bayar\s+(?:utang|hutang))\b`), 'income'],
  // they borrowed from you: "budi ngutang", "budi minjem"
  [re(String.raw`\b` + WHO + String.raw`\s+(?:udah\s+|sudah\s+)?(?:ngutang|minjem|pinjem|pinjam|minjam|berutang|berhutang)\b`), 'expense'],
];

const titleCase = (name) => name.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Finds a debt phrase: { type, person: { id } | { name }, remove: [phrases] }, or null. */
function readDebt(text, people) {
  const lower = text.toLowerCase();
  for (const [pattern, type] of DEBT_PATTERNS) {
    const m = pattern.exec(lower);
    if (!m || NOT_A_NAME.has(m[1])) continue;
    const first = m[1];
    // A known person, matched in any case; a longer known name wins ("budi santoso").
    const known =
      people.find((p) => {
        const name = p.name.toLowerCase();
        return name.split(/\s+/)[0] === first && name.includes(' ') && re(String.raw`\b` + escapeRe(name) + String.raw`\b`).test(lower);
      }) || people.find((p) => p.name.toLowerCase() === first);
    return { type, person: known ? { id: known.id } : { name: titleCase(first) }, remove: [m[0], known ? known.name : first] };
  }
  return null;
}

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

export function parseQuick(text, { categories = [], accounts = [], people = [], today }) {
  const result = {};
  let rest = ` ${text.trim()} `;
  if (!rest.trim()) return result;

  const date = readDate(rest, today);
  if (date) {
    result.occurredOn = date.date;
    rest = rest.replace(new RegExp(escapeRe(date.phrase), 'i'), ' ');
  }

  const amount = readAmount(rest);
  if (amount) {
    result.amount = amount.amount;
    rest = rest.replace(amount.token, ' ');
  }

  const debt = readDebt(rest, people);
  if (debt) {
    result.type = debt.type;
    result.debt = true;
    if (debt.person.id) result.personId = debt.person.id;
    else result.personName = debt.person.name;
    for (const phrase of debt.remove) rest = rest.replace(new RegExp(escapeRe(phrase), 'i'), ' ');
  } else {
    const type = INCOME_WORDS.test(rest) ? 'income' : 'expense';
    result.type = type;
    // Unsure? File it under "Other ..." rather than guessing.
    const ofType = categories.filter((c) => c.type === type);
    const category = findCategory(rest, ofType) || ofType.find((c) => OTHER_CATEGORY.test(c.name));
    if (category) result.categoryId = category.id;
  }

  const account = findAccount(rest, accounts);
  if (account) {
    result.accountId = account.id;
    for (const w of words(account.name)) rest = rest.replace(new RegExp(`\\b${w}\\b`, 'i'), ' ');
  }

  const description = rest.replace(/\s+/g, ' ').trim();
  result.description = description ? description[0].toUpperCase() + description.slice(1) : '';
  return result;
}
