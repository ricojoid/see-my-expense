const { sql, getPool } = require('../config/db');
const { parseQuick } = require('../lib/quickParse');
const { validateTransaction } = require('../lib/validate');
const { addDays, monthRange, todayLocal, weekday } = require('../lib/dates');
const { formatRupiah } = require('../lib/format');
const telegram = require('./telegram.service');
const transactions = require('./transactions.service');
const categories = require('./categories.service');
const accounts = require('./accounts.service');
const people = require('./people.service');
const notifications = require('./notifications.service');
const { DEBT_CATEGORY } = require('./seed.service');

/**
 * The Telegram bot: long-polls for messages and records them as transactions
 * ("kopi 25k gopay" -> an expense), with a few commands. Runs inside the API
 * process; only one instance per bot token may poll at a time.
 */
const OFFSET_SETTING = 'telegram_offset';
const POLL_SECONDS = 50;
const log = (msg) => console.log(`[telegram] ${msg}`);
const html = telegram.escapeHtml;

const COMMANDS = [
  { command: 'today', description: "Today's spending" },
  { command: 'week', description: "This week's spending" },
  { command: 'month', description: "This month's spending and income" },
  { command: 'undo', description: 'Remove the last transaction you sent' },
  { command: 'help', description: 'How to write transactions' },
];

const HELP = [
  'Send what you spent, one per message:',
  '<code>kopi 25k</code>',
  '<code>makan siang 35rb gopay</code>',
  '<code>grab 22k kemarin</code>',
  '<code>gaji 8jt bca</code>  (income)',
  '',
  'Debts:',
  '<code>ngutangin budi 50rb</code>  ·  <code>budi udah balikin 50rb</code>',
  '<code>utang ke budi 100k</code>  ·  <code>bayar utang ke budi 50k</code>',
  '',
  'Amounts: 25k, 35rb, 1,5jt, 25.000.',
  'Dates: kemarin, 2 hari lalu, senin, 10 november, tgl 5, 12/11.',
  '<code>10 november lupa bayar makan 35k</code>',
  'Name an account (gopay, bca, cash) or the last one you used is taken.',
  '',
  '/today /week /month: totals · /undo: remove the last one',
].join('\n');

/** The last transaction each chat recorded, for /undo. */
const lastByChat = new Map();

// ---- Poll offset, kept in the database so a restart never re-records a message ----

async function loadOffset() {
  const pool = await getPool();
  const r = await pool.request().input('name', sql.VarChar(50), OFFSET_SETTING).query('SELECT value FROM app_settings WHERE name = @name');
  return Number(r.recordset[0]?.value) || 0;
}

async function saveOffset(offset) {
  const pool = await getPool();
  await pool
    .request()
    .input('name', sql.VarChar(50), OFFSET_SETTING)
    .input('value', sql.NVarChar(50), String(offset))
    .query(`
      MERGE app_settings AS target USING (SELECT @name AS name) AS src ON target.name = src.name
      WHEN MATCHED THEN UPDATE SET value = @value
      WHEN NOT MATCHED THEN INSERT (name, value) VALUES (@name, @value);
    `);
}

// ---- Formatting ----

function dayLabel(date, today) {
  if (date === today) return 'today';
  if (date === addDays(today, -1)) return 'yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Budi owes you Rp 50.000" / "You owe Budi ..." / "All settled with Budi". */
function debtLine(person) {
  if (person.balance > 0) return `${person.name} owes you ${formatRupiah(person.balance)}`;
  if (person.balance < 0) return `You owe ${person.name} ${formatRupiah(-person.balance)}`;
  return `All settled with ${person.name}`;
}

function totalsText(title, totals) {
  const lines = [`<b>${title}</b>`, `Spent: <b>${formatRupiah(totals.expense)}</b> (${totals.expenseCount} expense${totals.expenseCount === 1 ? '' : 's'})`];
  if (totals.income) lines.push(`Income: ${formatRupiah(totals.income)}`);
  return lines.join('\n');
}

// ---- Recording a transaction from a message ----

/** "Other Expense" / "Other Income" if the user has it, else their most used category of that type. */
function fallbackCategory(list, type) {
  const ofType = list.filter((c) => c.type === type && c.name !== DEBT_CATEGORY);
  return ofType.find((c) => /^other/i.test(c.name)) || ofType[0] || null;
}

async function record(user, chatId, text) {
  const today = todayLocal();
  const [cats, accs, ppl] = await Promise.all([categories.list(user.id), accounts.list(user.id), people.list(user.id)]);
  const parsed = await parseQuick(text, {
    categories: cats.filter((c) => c.name !== DEBT_CATEGORY),
    accounts: accs,
    people: ppl,
    today,
  });
  if (!parsed.amount) {
    return telegram.sendMessage(chatId, "I couldn't find an amount in that. Try <code>kopi 25k</code>, or /help.");
  }

  const category = parsed.debt ? null : cats.find((c) => c.id === parsed.categoryId) || fallbackCategory(cats, parsed.type);
  const lastId = await transactions.lastAccountId(user.id);
  const account = accs.find((a) => a.id === parsed.accountId) || accs.find((a) => a.id === lastId) || accs[0];
  const { value, error } = validateTransaction({
    type: parsed.type,
    amount: parsed.amount,
    occurredOn: parsed.occurredOn || today,
    accountId: account?.id,
    categoryId: category?.id,
    personId: parsed.personId,
    personName: parsed.personName,
    description: parsed.description || null,
  });
  if (error) return telegram.sendMessage(chatId, `Couldn't save it: ${html(error)}.`);

  const tx = await transactions.create(user.id, value);
  lastByChat.set(chatId, tx.id);
  const alert = await notifications.checkBudget(user.id, tx, { telegramToo: false }).catch(() => null);

  const sign = tx.type === 'income' ? '+' : '−';
  const lines = [
    `✅ <b>${sign}${formatRupiah(tx.amount)}</b> · ${html(tx.category)} · ${html(tx.account)} · ${dayLabel(tx.occurredOn, today)}`,
  ];
  if (tx.personId) {
    const person = (await people.list(user.id)).find((p) => p.id === tx.personId);
    if (person) lines.push(`🤝 ${html(debtLine(person))}`);
  }
  if (tx.description) lines.push(`📝 ${html(tx.description)}`);
  if (alert) lines.push(`${alert.level === 'over' ? '🚨' : '⚠️'} ${html(alert.message)}`);

  const buttons = [{ text: '↩️ Undo', callback_data: `undo:${tx.id}` }];
  if (process.env.APP_URL) buttons.push({ text: 'Open app', url: process.env.APP_URL });
  return telegram.sendMessage(chatId, lines.join('\n'), { reply_markup: { inline_keyboard: [buttons] } });
}

async function undo(user, chatId, txId) {
  try {
    await transactions.remove(user.id, txId);
    if (lastByChat.get(chatId) === txId) lastByChat.delete(chatId);
    return true;
  } catch {
    return false; // already gone, or not theirs
  }
}

// ---- Commands ----

async function handleCommand(user, chatId, command) {
  const today = todayLocal();
  const tomorrow = addDays(today, 1);
  switch (command) {
    case '/help':
    case '/start':
      return telegram.sendMessage(chatId, HELP);
    case '/today':
      return telegram.sendMessage(chatId, totalsText('Today', await transactions.totalsBetween(user.id, today, tomorrow)));
    case '/week': {
      const monday = addDays(today, -weekday(today));
      return telegram.sendMessage(chatId, totalsText(`This week (since ${dayLabel(monday, today)})`, await transactions.totalsBetween(user.id, monday, tomorrow)));
    }
    case '/month': {
      const { start } = monthRange(today.slice(0, 7));
      const [y, m] = today.split('-').map(Number);
      const name = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
      return telegram.sendMessage(chatId, totalsText(name, await transactions.totalsBetween(user.id, start, tomorrow)));
    }
    case '/undo': {
      const id = lastByChat.get(chatId);
      if (!id || !(await undo(user, chatId, id))) return telegram.sendMessage(chatId, 'Nothing to undo.');
      return telegram.sendMessage(chatId, '↩️ Removed the last transaction.');
    }
    case '/disconnect':
      await telegram.unlinkChat(chatId);
      return telegram.sendMessage(chatId, 'Disconnected. Connect again from the app: Settings → Telegram.');
    default:
      return telegram.sendMessage(chatId, 'Unknown command. See /help.');
  }
}

// ---- Updates ----

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return telegram.sendMessage(chatId, 'Send text, like <code>kopi 25k</code>.');

  // "/start <code>" from the app's Connect link.
  const start = /^\/start(?:@\w+)?\s+(\S+)/.exec(text);
  if (start) {
    const name = [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ') || msg.chat.title || msg.chat.username;
    const userId = await telegram.redeemLinkCode(start[1], chatId, name);
    if (!userId) return telegram.sendMessage(chatId, 'That link has expired. Open the app → Settings → Telegram and tap Connect again.');
    await notifications.ensureSettings(userId);
    const user = await telegram.userForChat(chatId);
    return telegram.sendMessage(chatId, `🎉 Connected to <b>${html(user.username)}</b>.\n\n${HELP}`);
  }

  const user = await telegram.userForChat(chatId);
  if (!user) {
    return telegram.sendMessage(chatId, 'This chat is not connected yet. In the app, open Settings → Telegram and tap <b>Connect Telegram</b>.');
  }

  const command = /^\/(\w+)/.exec(text);
  if (command) return handleCommand(user, chatId, `/${command[1].toLowerCase()}`);
  return record(user, chatId, text);
}

async function handleCallback(query) {
  const chatId = query.message?.chat?.id;
  const match = /^undo:(\d+)$/.exec(query.data || '');
  const user = chatId && (await telegram.userForChat(chatId));
  if (!match || !user) return telegram.api('answerCallbackQuery', { callback_query_id: query.id });

  const done = await undo(user, chatId, Number(match[1]));
  await telegram.api('answerCallbackQuery', { callback_query_id: query.id, text: done ? 'Removed' : 'Already removed' });
  if (done) {
    await telegram.api('editMessageText', {
      chat_id: chatId,
      message_id: query.message.message_id,
      text: `<s>${html(query.message.text || '')}</s>\n↩️ Undone`,
      parse_mode: 'HTML',
    });
  }
}

async function handleUpdate(update) {
  if (update.message) return handleMessage(update.message);
  if (update.callback_query) return handleCallback(update.callback_query);
  return null;
}

// ---- Polling loop ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll() {
  let offset = await loadOffset();
  for (;;) {
    let updates;
    try {
      updates = await telegram.api(
        'getUpdates',
        { offset, timeout: POLL_SECONDS, allowed_updates: ['message', 'callback_query'] },
        { timeoutMs: (POLL_SECONDS + 15) * 1000 }
      );
    } catch (err) {
      // 409: another process polls with the same token (e.g. a local dev server).
      log(err.status === 409 ? 'another instance is using this bot token; retrying in 30s' : err.message);
      await sleep(err.status === 409 ? 30000 : 5000);
      continue;
    }
    for (const update of updates) {
      try {
        await handleUpdate(update);
      } catch (err) {
        log(`update ${update.update_id} failed: ${err.message}`);
      }
      offset = update.update_id + 1;
      await saveOffset(offset);
    }
  }
}

/** Starts the bot if TELEGRAM_BOT_TOKEN is set. Never throws: the API keeps running without it. */
async function startBot() {
  if (!telegram.isEnabled()) return;
  for (let attempt = 1; ; attempt++) {
    try {
      await telegram.api('deleteWebhook'); // polling and webhooks are exclusive
      await telegram.api('setMyCommands', { commands: COMMANDS });
      log(`@${await telegram.getBotUsername()} is running`);
      break;
    } catch (err) {
      log(`can't start (${err.message}), retrying in 30s`);
      await sleep(30000 * Math.min(attempt, 10));
    }
  }
  poll().catch((err) => log(`stopped: ${err.message}`));
}

module.exports = { startBot, handleUpdate };
