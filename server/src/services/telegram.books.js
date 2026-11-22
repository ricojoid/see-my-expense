const { addDays, todayLocal } = require('../lib/dates');
const { formatRupiah } = require('../lib/format');
const telegram = require('./telegram.service');
const periods = require('./periods.service');
const transactions = require('./transactions.service');
const report = require('./report.service');
const accounts = require('./accounts.service');

/**
 * "Tutup buku" from Telegram: asks whether the books close today (new period
 * from tomorrow) or yesterday (new period from today), then closes them.
 * Buttons carry the new period's first day, so an old button can't close the
 * wrong day.
 */
const html = telegram.escapeHtml;
const CLOSE_RE = /^\s*\/?(tutup\s*buku|close\s*(the\s*)?books?)\b/i;
const isCloseRequest = (text) => CLOSE_RE.test(text);

const short = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

async function askClose(user, chatId, today = todayLocal()) {
  const current = await periods.current(user.id, today);
  const text = [
    `📕 Close the books for <b>${html(report.monthName(current.key))}</b> (since ${short(current.start)})?`,
    '',
    '<b>Today</b>: today still counts in this period; the new one starts tomorrow.',
    '<b>Yesterday</b>: today already counts in the new period.',
  ].join('\n');
  return telegram.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Today (new from tomorrow)', callback_data: `close:${addDays(today, 1)}` },
          { text: 'Yesterday (new from today)', callback_data: `close:${today}` },
        ],
        [{ text: 'Cancel', callback_data: 'close:cancel' }],
      ],
    },
  });
}

const edit = (query, text, buttons) =>
  telegram.api('editMessageText', {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    text,
    parse_mode: 'HTML',
    ...(buttons ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
  });

/** After closing: start the balances afresh, or keep them? */
async function askResetBalances(chatId, userId) {
  const list = await accounts.list(userId);
  const lines = [
    '💳 Start the balances afresh too?',
    ...list.map((a) => `${html(a.name)}: ${formatRupiah(a.balance)}`),
    '',
    'Reset sets every account to 0; then send what is really left, e.g. <code>saldo cash 200k</code>.',
  ];
  return telegram.sendMessage(chatId, lines.join('\n'), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Reset to 0', callback_data: 'balances:reset' },
          { text: 'Keep them', callback_data: 'balances:keep' },
        ],
      ],
    },
  });
}

/** Handles close:<date>, close:cancel, reopen and balances:*. Returns false for other buttons. */
async function handleCallback(user, query, today = todayLocal()) {
  const data = query.data || '';
  const answer = (text) => telegram.api('answerCallbackQuery', { callback_query_id: query.id, ...(text ? { text } : {}) });

  if (data === 'close:cancel') {
    await answer();
    await edit(query, 'Okay, the books stay open.');
    return true;
  }
  if (data === 'balances:keep') {
    await answer();
    await edit(query, '💳 Balances kept as they are.');
    return true;
  }
  if (data === 'balances:reset') {
    const list = await accounts.list(user.id);
    await accounts.setBalances(user.id, list.map((a) => [a.id, 0]));
    await answer('Balances reset');
    await edit(query, '💳 All balances are 0 now. Send what is really left, one per message:\n<code>saldo cash 200k</code>\n<code>saldo gopay 150k</code>');
    return true;
  }
  if (data === 'reopen') {
    const period = await periods.undoLast(user.id, today);
    await answer(period ? 'Undone' : 'Nothing to undo');
    if (period) await edit(query, `↩️ Close undone. You're in <b>${html(report.monthName(period.key))}</b> again (since ${short(period.start)}).`);
    return true;
  }
  const close = /^close:(\d{4}-\d{2}-\d{2})$/.exec(data);
  if (!close) return false;

  const start = close[1];
  const when = start === today ? 'yesterday' : start === addDays(today, 1) ? 'today' : null;
  if (!when) {
    await answer('That button has expired');
    await edit(query, 'That question has expired. Send <code>tutup buku</code> again.');
    return true;
  }
  const { closed, opened } = await periods.close(user.id, when, today);
  const totals = await transactions.totalsBetween(user.id, closed.start, closed.end);
  await answer('Books closed');
  const lines = [
    `📕 <b>${html(report.monthName(closed.key))}</b> closed: ${short(closed.start)} - ${short(closed.lastDay)}.`,
    `Spent <b>${formatRupiah(totals.expense)}</b>${totals.income ? ` · income ${formatRupiah(totals.income)}` : ''}.`,
    '',
    `📗 <b>${html(report.monthName(opened.key))}</b> starts ${opened.start === today ? 'today' : 'tomorrow'} (${short(opened.start)}).`,
  ];
  await edit(query, lines.join('\n'), [{ text: '↩️ Undo', callback_data: 'reopen' }]);
  await askResetBalances(query.message.chat.id, user.id);
  return true;
}

module.exports = { isCloseRequest, askClose, handleCallback };
