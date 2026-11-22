// Picks an emoji for a category from keywords in its name, so user-made
// categories get a sensible icon without an icon picker.
const RULES = [
  [/salary|gaji|payroll|wage/i, '💼'],
  [/freelance|side|project|proyek/i, '🧑‍💻'],
  [/gift|hadiah|bonus|thr/i, '🎁'],
  [/invest|saham|stock|crypto|dividen|interest|bunga/i, '📈'],
  [/refund|cashback/i, '↩️'],
  [/\bpets?\b|kucing|anjing|\bcat\b|\bdog\b/i, '🐾'],
  [/coffee|kopi|cafe/i, '☕'],
  [/food|makan|drink|minum|resto|snack|meal|lunch|dinner/i, '🍜'],
  [/grocer|belanja harian|market|pasar/i, '🛒'],
  [/transport|ojek|gojek|grab|fuel|bensin|parkir|parking|toll|\btol\b|\bcar\b|motor|bus|train|kereta/i, '🛵'],
  [/house|housing|rent|kos|kost|sewa|rumah/i, '🏠'],
  [/bill|utilit|listrik|electric|water|pdam|internet|wifi|pulsa|phone|token/i, '💡'],
  [/subscri|langganan|netflix|spotify/i, '🔁'],
  [/entertain|movie|film|game|hiburan|fun|nonton/i, '🎮'],
  [/health|sehat|doctor|dokter|medic|obat|pharma|gym|fitness/i, '💊'],
  [/shop|belanja|fashion|cloth|baju/i, '🛍️'],
  [/educat|school|sekolah|kuliah|course|kursus|book|buku/i, '📚'],
  [/travel|holiday|liburan|trip|hotel|flight|pesawat/i, '✈️'],
  [/charity|donat|sedekah|zakat|infaq/i, '🤲'],
  [/family|keluarga|kids|anak|parent|ortu/i, '👨‍👩‍👧'],
  [/beauty|salon|skincare|barber|cukur/i, '💅'],
  [/insurance|asuransi/i, '🛡️'],
  [/debt|loan|hutang|utang|pinjam/i, '🤝'],
  [/cicilan|credit|kredit/i, '💳'],
  [/saving|tabung/i, '🐷'],
];

export function categoryIcon(name, type) {
  const match = RULES.find(([re]) => re.test(name || ''));
  if (match) return match[1];
  if (type === 'income') return '💰';
  if (type === 'transfer') return '🔄';
  return '💸';
}

const ACCOUNT_RULES = [
  [/cash|tunai|dompet|wallet/i, '👛'],
  [/gopay|ovo|dana|shopee|linkaja|e-?wallet/i, '📱'],
  [/sav|tabung/i, '🐷'],
  [/invest|saham|reksa/i, '📈'],
  [/card|kartu|credit/i, '💳'],
];

export function accountIcon(name) {
  const match = ACCOUNT_RULES.find(([re]) => re.test(name || ''));
  return match ? match[1] : '🏦';
}
