const { isValidDate } = require('./dates');

const pad = (n) => String(n).padStart(2, '0');

/** Parses CSV text. Detects ',', ';' or tab from the header line; handles quotes. */
function parseCsv(text) {
  const input = String(text || '').replace(/^﻿/, '');
  const firstLine = input.split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function escapeCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

/**
 * Accepts "50000", "50.000", "Rp 1.250.000", "1.250.000,50", "1,250,000.50", "12.5".
 * Returns a positive number or NaN.
 */
function parseAmount(raw) {
  let s = String(raw ?? '').replace(/rp/i, '').replace(/\s/g, '');
  if (!s) return NaN;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // whichever separator comes last is the decimal one
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY and DD-MM-YYYY. Returns 'YYYY-MM-DD' or null. */
function parseDateFlexible(raw) {
  const s = String(raw ?? '').trim();
  let out = null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    out = `${y}-${pad(m)}-${pad(d)}`;
  } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) {
    const [d, m, y] = s.split(/[/-]/);
    out = `${y}-${pad(m)}-${pad(d)}`;
  }
  return out && isValidDate(out) ? out : null;
}

const HEADER_ALIASES = {
  date: ['date', 'tanggal', 'tgl'],
  type: ['type', 'jenis', 'tipe'],
  category: ['category', 'kategori'],
  amount: ['amount', 'jumlah', 'nominal', 'nilai'],
  description: ['description', 'catatan', 'keterangan', 'note', 'deskripsi'],
  account: ['account', 'akun', 'dompet', 'from_account'],
  toAccount: ['to_account', 'ke_akun', 'tujuan'],
};

const TYPE_ALIASES = {
  income: ['income', 'pemasukan', 'masuk', 'in'],
  expense: ['expense', 'pengeluaran', 'keluar', 'out'],
  transfer: ['transfer', 'pindah'],
};

function normalizeType(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  return Object.keys(TYPE_ALIASES).find((t) => TYPE_ALIASES[t].includes(s)) || null;
}

/**
 * Maps parsed CSV rows (first row = header) to import records.
 * Returns { records, errors } where errors reference 1-based CSV line numbers.
 */
function mapImportRows(rows) {
  if (rows.length < 2) return { records: [], errors: [{ line: 1, error: 'file is empty or only has a header' }] };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const index = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    index[key] = header.findIndex((h) => aliases.includes(h));
  }
  const missing = ['date', 'type', 'amount'].filter((k) => index[k] === -1);
  if (missing.length) {
    return { records: [], errors: [{ line: 1, error: `missing required column(s): ${missing.join(', ')}` }] };
  }

  const records = [];
  const errors = [];
  const cell = (r, key) => (index[key] === -1 ? '' : String(r[index[key]] ?? '').trim());

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const type = normalizeType(cell(r, 'type'));
    const occurredOn = parseDateFlexible(cell(r, 'date'));
    const amount = parseAmount(cell(r, 'amount'));
    const category = cell(r, 'category');
    const account = cell(r, 'account');
    const toAccount = cell(r, 'toAccount');

    if (!type) return errors.push({ line, error: 'type must be income / expense / transfer' });
    if (!occurredOn) return errors.push({ line, error: 'invalid date' });
    if (!(amount > 0)) return errors.push({ line, error: 'amount must be a number > 0' });
    if (type !== 'transfer' && !category) return errors.push({ line, error: 'category is required' });
    if (type === 'transfer' && !toAccount) return errors.push({ line, error: 'transfer needs a to_account column' });

    records.push({
      line,
      type,
      occurredOn,
      amount,
      category: type === 'transfer' ? null : category.slice(0, 50),
      description: cell(r, 'description').slice(0, 255) || null,
      account: account.slice(0, 50) || null,
      toAccount: type === 'transfer' ? toAccount.slice(0, 50) : null,
    });
  });

  return { records, errors };
}

module.exports = { parseCsv, toCsv, parseAmount, parseDateFlexible, mapImportRows, normalizeType };
