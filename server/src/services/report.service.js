const PDFDocument = require('pdfkit');
const { sql, getPool } = require('../config/db');
const { todayLocal } = require('../lib/dates');
const periods = require('./periods.service');
const { formatRupiah } = require('../lib/format');
const transactions = require('./transactions.service');
const budgets = require('./budgets.service');
const people = require('./people.service');
const goals = require('./goals.service');

/** A one-page (or two) PDF summary of a month: totals, categories, biggest expenses, budgets, debts, goals. */

const C = {
  ink: '#14161c',
  muted: '#6b7080',
  line: '#e4e6eb',
  band: '#0b0d12',
  accent: '#c6f432',
  income: '#2f6fc0',
  expense: '#d95926',
};

const monthName = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
const shortDate = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** "26 Nov - 25 Dec 2026", or "... - today" while the period is open. */
function periodRange(period) {
  const end = period.end ? `${shortDate(period.lastDay)} ${period.lastDay.slice(0, 4)}` : 'today';
  return `${shortDate(period.start)} - ${end}`;
}

async function topExpenses(userId, { start, end }, limit = 8) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('start', sql.VarChar(10), start)
    .input('end', sql.VarChar(10), end)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) t.amount, t.description, c.name AS category, CONVERT(char(10), t.occurred_on, 23) AS occurredOn
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = @uid AND t.type = 'expense'
        AND t.occurred_on >= CAST(@start AS date) AND t.occurred_on < CAST(@end AS date)
      ORDER BY t.amount DESC, t.occurred_on
    `);
  return r.recordset.map((t) => ({ ...t, amount: Number(t.amount) }));
}

async function reportData(userId, month) {
  const period = await periods.get(userId, month);
  const days = period.daysElapsed;
  const [summary, stats, top, budgetRows, ppl, goalList] = await Promise.all([
    transactions.summary(userId, month),
    transactions.stats(userId, month),
    topExpenses(userId, { start: period.start, end: period.end || '9999-12-31' }),
    budgets.listForMonth(userId, month),
    people.list(userId),
    goals.list(userId),
  ]);
  return {
    month,
    period,
    summary,
    avgPerDay: days ? summary.expense / days : 0,
    categories: stats.expenseByCategory,
    top,
    budgets: budgetRows.filter((b) => b.budget),
    debts: ppl.filter((p) => p.balance !== 0),
    goals: goalList,
  };
}

// ---- Drawing ----

function heading(doc, text) {
  room(doc, 60); // a heading never sits alone at the bottom of a page
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  // Always from the left margin: rows leave doc.x wherever they last drew.
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.ink).text(text, left, doc.y + 16, { width });
  const y = doc.y + 4;
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.6).strokeColor(C.line).stroke();
  doc.y = y + 8;
}

/** Keeps a block of about `height` points on one page. */
function room(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function row(doc, left, right, { color = C.ink, bold = false, sub } = {}) {
  room(doc, 20);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(C.ink).text(left, x, y, { width: width - 130, lineBreak: false, ellipsis: true });
  doc.font('Helvetica-Bold').fillColor(color).text(right, x + width - 130, y, { width: 130, align: 'right' });
  if (sub) doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(sub, x, doc.y, { width: width - 130 });
  doc.y += 4;
}

function draw(doc, data, username) {
  const { left } = doc.page.margins;
  const width = doc.page.width - left - doc.page.margins.right;

  // Header band
  doc.rect(0, 0, doc.page.width, 96).fill(C.band);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.accent).text('SEE MY EX-PENSE · MONTHLY REPORT', left, 30);
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text(monthName(data.period.key), left, 46);
  doc.font('Helvetica').fontSize(9).fillColor('#a7abb8').text(periodRange(data.period), left, 74);
  doc.font('Helvetica').fontSize(9).fillColor('#a7abb8').text(username, left, 46, { width, align: 'right' });

  // Three totals, side by side and never netted.
  const boxes = [
    ['Income', formatRupiah(data.summary.income), C.income],
    ['Outcome', formatRupiah(data.summary.expense), C.expense],
    ['Avg outcome / day', formatRupiah(data.avgPerDay), C.ink],
  ];
  const gap = 10;
  const boxWidth = (width - gap * 2) / 3;
  boxes.forEach(([label, value, color], i) => {
    const x = left + i * (boxWidth + gap);
    doc.roundedRect(x, 116, boxWidth, 58, 8).lineWidth(0.8).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(label, x + 12, 128, { width: boxWidth - 24 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(color).text(value, x + 12, 144, { width: boxWidth - 24 });
  });
  doc.y = 186;

  // Spending by category
  heading(doc, 'Spending by category');
  if (!data.categories.length) doc.font('Helvetica').fontSize(10).fillColor(C.muted).text('No spending recorded.', left, doc.y, { width });
  const max = Math.max(1, ...data.categories.map((c) => c.total));
  for (const c of data.categories) {
    room(doc, 26);
    const y = doc.y;
    const share = data.summary.expense ? Math.round((c.total / data.summary.expense) * 100) : 0;
    doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(c.category, left, y, { width: 150, lineBreak: false, ellipsis: true });
    const barX = left + 160;
    const barWidth = width - 160 - 140;
    doc.roundedRect(barX, y + 2, barWidth, 7, 3.5).fill('#f1f2f5');
    doc.roundedRect(barX, y + 2, Math.max(4, (c.total / max) * barWidth), 7, 3.5).fill(C.expense);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(formatRupiah(c.total), left + width - 130, y, { width: 95, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(`${share}%`, left + width - 30, y + 1, { width: 30, align: 'right' });
    doc.y = y + 18;
  }

  // Biggest expenses
  if (data.top.length) {
    heading(doc, 'Biggest expenses');
    for (const t of data.top) {
      row(doc, `${shortDate(t.occurredOn)}   ${t.description || t.category || 'Expense'}`, formatRupiah(t.amount), {
        sub: t.description ? t.category : undefined,
      });
    }
  }

  // Budgets
  if (data.budgets.length) {
    heading(doc, 'Budgets');
    for (const b of data.budgets) {
      const pct = Math.round((b.spent / b.budget) * 100);
      const status = pct > 100 ? 'over' : pct >= 80 ? 'close' : 'on track';
      row(doc, `${b.category} · ${pct}% (${status})`, `${formatRupiah(b.spent)} / ${formatRupiah(b.budget)}`, {
        color: pct > 100 ? C.expense : C.ink,
      });
    }
  }

  // Debts
  if (data.debts.length) {
    heading(doc, 'Open debts');
    for (const p of data.debts) {
      row(doc, p.balance > 0 ? `${p.name} owes you` : `You owe ${p.name}`, formatRupiah(Math.abs(p.balance)), {
        color: p.balance > 0 ? C.income : C.expense,
      });
    }
  }

  // Goals
  if (data.goals.length) {
    heading(doc, 'Savings goals');
    for (const g of data.goals) {
      const sub = g.done
        ? 'Reached'
        : g.perMonth
          ? `${formatRupiah(g.perMonth)} a month to reach it by ${shortDate(g.deadline)} ${g.deadline.slice(0, 4)}`
          : `${formatRupiah(g.remaining)} to go`;
      row(doc, `${g.name} · ${g.percent}%`, `${formatRupiah(g.saved)} / ${formatRupiah(g.target)}`, { sub });
    }
  }

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(C.muted)
    .text(`Made by See My EX-pense on ${shortDate(todayLocal())} ${todayLocal().slice(0, 4)}`, left, doc.page.height - doc.page.margins.bottom - 10, {
      width,
      align: 'center',
      lineBreak: false,
    });
}

/** Builds the report as a PDF Buffer. */
async function monthlyReport(userId, month, username = '') {
  const data = await reportData(userId, month);
  const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 40, left: 48, right: 48 }, info: { Title: `See My EX-pense: ${monthName(month)}` } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  draw(doc, data, username);
  doc.end();
  return done;
}

const reportFileName = (month) => `see-my-expense-${month}.pdf`;

module.exports = { monthlyReport, reportFileName, monthName };
