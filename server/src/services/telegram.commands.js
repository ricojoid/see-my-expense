const { matchCategory } = require('../lib/quickParse');
const { addDays, monthRange, shiftMonth, todayLocal, weekday } = require('../lib/dates');
const { formatRupiah } = require('../lib/format');
const telegram = require('./telegram.service');
const transactions = require('./transactions.service');
const people = require('./people.service');
const goals = require('./goals.service');
const insights = require('./insights.service');
const report = require('./report.service');
const { debtLine, dayLabel, loadContext, undoLast } = require('./telegram.record');

/** Bot commands and questions: totals, "/spent makan bulan ini", debts, goals, reports. */
const html = telegram.escapeHtml;

const COMMANDS = [
  { command: 'today', description: "Today's spending" },
  { command: 'week', description: "This week's spending" },
  { command: 'month', description: 'This month so far, and where it is heading' },
  { command: 'spent', description: 'e.g. /spent makan bulan ini' },
  { command: 'debts', description: 'Who owes whom' },
  { command: 'goals', description: 'Savings goals' },
  { command: 'report', description: 'PDF report (add "bulan lalu" for last month)' },
  { command: 'undo', description: 'Remove what you sent last' },
  { command: 'help', description: 'How to write transactions' },
];

const HELP = [
  'Send what you spent (one per line, several lines are fine):',
  '<code>kopi 25k</code>',
  '<code>makan siang 35rb gopay</code>',
  '<code>10 november lupa bayar makan 35k</code>',
  '<code>gaji 8jt bca</code>  (income)',
  '',
  'Debts and shared bills:',
  '<code>ngutangin budi 50rb</code>  ·  <code>budi udah balikin 50rb</code>',
  '<code>utang ke budi 100k</code>  ·  <code>bayar utang ke budi 50k</code>',
  '<code>makan 300k bagi 3 sama budi sari</code>',
  '',
  'Savings: <code>nabung laptop 500k</code>',
  '',
  'Reply to my ✅ message to fix it: <code>30k</code>, <code>kemarin</code>, <code>gopay</code>, <code>food</code> or <code>hapus</code>.',
  '',
  'Ask: /spent makan bulan ini · /debts · /budi · /goals · /report',
].join('\n');

function totalsText(title, totals) {
  const lines = [`<b>${title}</b>`, `Spent: <b>${formatRupiah(totals.expense)}</b> (${totals.expenseCount} expense${totals.expenseCount === 1 ? '' : 's'})`];
  if (totals.income) lines.push(`Income: ${formatRupiah(totals.income)}`);
  return lines.join('\n');
}

const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
};

/** A period named in the text ("bulan lalu", "minggu ini", ...), this month by default. */
function periodFrom(text, today) {
  const lower = ` ${text.toLowerCase()} `;
  const tomorrow = addDays(today, 1);
  const monday = addDays(today, -weekday(today));
  const month = today.slice(0, 7);
  const periods = [
    [/\b(hari ini|today)\b/, 'today', today, tomorrow],
    [/\b(kemarin|yesterday)\b/, 'yesterday', addDays(today, -1), today],
    [/\b(minggu lalu|last week)\b/, 'last week', addDays(monday, -7), monday],
    [/\b(minggu ini|this week|seminggu)\b/, 'this week', monday, tomorrow],
    [/\b(bulan lalu|last month)\b/, monthLabel(shiftMonth(month, -1)), monthRange(shiftMonth(month, -1)).start, monthRange(month).start],
    [/\b(tahun ini|this year)\b/, `${today.slice(0, 4)}`, `${today.slice(0, 4)}-01-01`, tomorrow],
    [/\b(bulan ini|this month)\b/, 'this month', monthRange(month).start, tomorrow],
  ];
  for (const [pattern, label, start, end] of periods) {
    if (pattern.test(lower)) return { label, start, end, rest: lower.replace(pattern, ' ').trim() };
  }
  return { label: 'this month', start: monthRange(month).start, end: tomorrow, rest: lower.trim() };
}

async function spent(user, chatId, args) {
  const today = todayLocal();
  const period = periodFrom(args, today);
  const ctx = await loadContext(user.id);
  const category = period.rest ? await matchCategory(period.rest, ctx.parserContext.categories.filter((c) => c.type === 'expense'), ctx.learned) : null;
  if (period.rest && !category) {
    return telegram.sendMessage(chatId, `I don't know a category for "${html(period.rest)}". Try /spent makan, /spent transport minggu ini.`);
  }
  const totals = await transactions.totalsBetween(user.id, period.start, period.end, { categoryId: category?.id });
  const what = category ? html(category.name) : 'Spent';
  return telegram.sendMessage(chatId, `${what} ${period.label}: <b>${formatRupiah(totals.expense)}</b> (${totals.expenseCount} expense${totals.expenseCount === 1 ? '' : 's'})`);
}

async function month(user, chatId) {
  const today = todayLocal();
  const totals = await transactions.totalsBetween(user.id, monthRange(today.slice(0, 7)).start, addDays(today, 1));
  const p = await insights.projection(user.id, today);
  const lines = [totalsText(monthLabel(today.slice(0, 7)), totals)];
  if (p.daysLeft > 0) {
    lines.push(`Heading for about <b>${formatRupiah(p.projected)}</b> by the end of the month${p.early ? ' (early guess)' : ''}.`);
    if (p.budget) lines.push(p.overBudgetBy ? `⚠️ ${formatRupiah(p.overBudgetBy)} over your budgets.` : `Within your budgets (${formatRupiah(p.budget)}).`);
  }
  return telegram.sendMessage(chatId, lines.join('\n'));
}

async function debts(user, chatId) {
  const open = (await people.list(user.id)).filter((p) => p.balance !== 0);
  if (!open.length) return telegram.sendMessage(chatId, 'No open debts. 🎉');
  const owed = open.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const owe = open.filter((p) => p.balance < 0).reduce((s, p) => s - p.balance, 0);
  const lines = ['<b>Debts</b>', ...open.map((p) => `• ${html(debtLine(p))}`), '', `Owed to you: ${formatRupiah(owed)} · You owe: ${formatRupiah(owe)}`];
  return telegram.sendMessage(chatId, lines.join('\n'));
}

async function personDetail(user, chatId, person) {
  const recent = await transactions.list(user.id, { personId: person.id, pageSize: 5 });
  const lines = [`<b>${html(person.name)}</b>`, html(debtLine(person))];
  if (recent.items.length) {
    lines.push('');
    for (const t of recent.items) lines.push(`${dayLabel(t.occurredOn)}: ${t.type === 'expense' ? 'you gave' : 'you got'} ${formatRupiah(t.amount)}`);
  }
  return telegram.sendMessage(chatId, lines.join('\n'));
}

async function goalsList(user, chatId) {
  const list = await goals.list(user.id);
  if (!list.length) return telegram.sendMessage(chatId, 'No savings goals yet. Create one in the app (Goals), then save with <code>nabung laptop 500k</code>.');
  const lines = ['<b>Savings goals</b>'];
  for (const g of list) {
    const extra = g.done ? ' ✅' : g.perMonth ? ` · ${formatRupiah(g.perMonth)}/month to make it` : '';
    lines.push(`• ${html(g.name)}: ${formatRupiah(g.saved)} / ${formatRupiah(g.target)} (${g.percent}%)${extra}`);
  }
  return telegram.sendMessage(chatId, lines.join('\n'));
}

async function sendReport(user, chatId, args) {
  const today = todayLocal();
  const which = /\b(bulan lalu|last month|lalu|last)\b/i.test(args) ? shiftMonth(today.slice(0, 7), -1) : today.slice(0, 7);
  await telegram.api('sendChatAction', { chat_id: chatId, action: 'upload_document' }).catch(() => {});
  const pdf = await report.monthlyReport(user.id, which, user.username);
  return telegram.sendDocument(chatId, pdf, report.reportFileName(which), `📊 <b>${html(report.monthName(which))}</b>${which === today.slice(0, 7) ? ' so far' : ''}`);
}

/** Runs "/name args". Returns false when it isn't a command we know (the caller decides what then). */
async function runCommand(user, chatId, name, args) {
  const today = todayLocal();
  const tomorrow = addDays(today, 1);
  switch (name) {
    case 'help':
    case 'start':
      return telegram.sendMessage(chatId, HELP);
    case 'today':
      return telegram.sendMessage(chatId, totalsText('Today', await transactions.totalsBetween(user.id, today, tomorrow)));
    case 'week': {
      const monday = addDays(today, -weekday(today));
      return telegram.sendMessage(chatId, totalsText(`This week (since ${dayLabel(monday, today)})`, await transactions.totalsBetween(user.id, monday, tomorrow)));
    }
    case 'month':
      return month(user, chatId);
    case 'spent':
      return spent(user, chatId, args);
    case 'debts':
    case 'utang':
    case 'hutang':
      return debts(user, chatId);
    case 'goals':
    case 'tabungan':
      return goalsList(user, chatId);
    case 'report':
    case 'laporan':
      return sendReport(user, chatId, args);
    case 'undo': {
      const removed = await undoLast(user, chatId);
      return telegram.sendMessage(chatId, removed ? `↩️ Removed ${removed > 1 ? `the last ${removed} transactions` : 'the last transaction'}.` : 'Nothing to undo.');
    }
    case 'disconnect':
      await telegram.unlinkChat(chatId);
      return telegram.sendMessage(chatId, 'Disconnected. Connect again from the app: Settings → Telegram.');
    default: {
      // "/budi": a person's debt
      const person = (await people.list(user.id)).find((p) => p.name.toLowerCase() === `${name} ${args}`.trim().toLowerCase() || p.name.toLowerCase() === name);
      if (person) return personDetail(user, chatId, person);
      return telegram.sendMessage(chatId, 'Unknown command. See /help.');
    }
  }
}

module.exports = { COMMANDS, HELP, runCommand, periodFrom };
