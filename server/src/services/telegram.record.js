const { sql, getPool } = require('../config/db');
const { parseQuick, matchCategory } = require('../lib/quickParse');
const { validateTransaction } = require('../lib/validate');
const { addDays, todayLocal } = require('../lib/dates');
const { formatRupiah } = require('../lib/format');
const telegram = require('./telegram.service');
const transactions = require('./transactions.service');
const categories = require('./categories.service');
const accounts = require('./accounts.service');
const people = require('./people.service');
const rules = require('./rules.service');
const goals = require('./goals.service');
const notifications = require('./notifications.service');
const { DEBT_CATEGORY } = require('./seed.service');

/**
 * Turning chat messages into transactions: one per line, split bills, savings,
 * and corrections by replying to the bot. Every bot reply is linked to the
 * transactions it reports (telegram_messages), so Undo and replies keep working
 * after a restart.
 */
const html = telegram.escapeHtml;
const MAX_LINES = 20;

// ---- Which transactions a bot message was about ----

async function remember(chatId, messageId, txIds) {
  const pool = await getPool();
  for (const id of txIds) {
    await pool
      .request()
      .input('chat', sql.BigInt, chatId)
      .input('msg', sql.Int, messageId)
      .input('tx', sql.Int, id)
      .query('INSERT INTO telegram_messages (chat_id, message_id, transaction_id) VALUES (@chat, @msg, @tx)');
  }
}

async function txIdsFor(chatId, messageId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('chat', sql.BigInt, chatId)
    .input('msg', sql.Int, messageId)
    .query('SELECT transaction_id AS id FROM telegram_messages WHERE chat_id = @chat AND message_id = @msg');
  return r.recordset.map((x) => x.id);
}

async function lastMessageId(chatId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('chat', sql.BigInt, chatId)
    .query('SELECT TOP 1 message_id AS id FROM telegram_messages WHERE chat_id = @chat ORDER BY created_at DESC, message_id DESC');
  return r.recordset[0]?.id ?? null;
}

/** Sends `text` with an Undo button and remembers which transactions it's about. */
async function replyAbout(chatId, text, txIds) {
  const buttons = txIds.length ? [{ text: txIds.length > 1 ? `↩️ Undo all ${txIds.length}` : '↩️ Undo', callback_data: 'undo' }] : [];
  if (process.env.APP_URL) buttons.push({ text: 'Open app', url: process.env.APP_URL });
  const sent = await telegram.sendMessage(chatId, text, buttons.length ? { reply_markup: { inline_keyboard: [buttons] } } : {});
  if (txIds.length) await remember(chatId, sent.message_id, txIds);
  return sent;
}

// ---- Formatting ----

function dayLabel(date, today = todayLocal()) {
  if (date === today) return 'today';
  if (date === addDays(today, -1)) return 'yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function debtLine(person) {
  if (person.balance > 0) return `${person.name} owes you ${formatRupiah(person.balance)}`;
  if (person.balance < 0) return `You owe ${person.name} ${formatRupiah(-person.balance)}`;
  return `All settled with ${person.name}`;
}

function txLine(tx) {
  const sign = tx.type === 'income' ? '+' : '−';
  const what = tx.personId ? `${tx.type === 'expense' ? 'To' : 'From'} ${tx.person}` : tx.category;
  const note = tx.description ? ` · ${html(tx.description)}` : '';
  return `<b>${sign}${formatRupiah(tx.amount)}</b> · ${html(what)} · ${html(tx.account)} · ${dayLabel(tx.occurredOn)}${note}`;
}

// ---- Context for the parser ----

async function loadContext(userId) {
  const [cats, accs, ppl, learned] = await Promise.all([categories.list(userId), accounts.list(userId), people.list(userId), rules.list(userId)]);
  return { cats, accs, ppl, learned, parserContext: { categories: cats.filter((c) => c.name !== DEBT_CATEGORY), accounts: accs, people: ppl, rules: learned, today: todayLocal() } };
}

/** "Other Expense" / "Other Income" if the user has it, else their most used category of that type. */
function fallbackCategory(cats, type) {
  const ofType = cats.filter((c) => c.type === type && c.name !== DEBT_CATEGORY);
  return ofType.find((c) => /^other/i.test(c.name)) || ofType[0] || null;
}

async function defaultAccount(userId, accs, parsedId) {
  if (parsedId) return accs.find((a) => a.id === parsedId);
  const last = await transactions.lastAccountId(userId);
  return accs.find((a) => a.id === last) || accs[0];
}

// ---- Recording ----

const SAVE_RE = /^\s*(?:nabung|tabung|nyimpen|simpan|save)\s+(?:buat\s+|untuk\s+|for\s+)?/i;

/** "nabung laptop 500k": money towards a goal. Not a transaction. */
async function saveTowardsGoal(user, line, ctx) {
  const parsed = await parseQuick(line.replace(SAVE_RE, ''), ctx.parserContext);
  if (!parsed.amount) return { error: `No amount in "${html(line.trim())}".` };
  const goal = await goals.findByName(user.id, parsed.description);
  if (!goal) return { error: `No goal called "${html(parsed.description || '?')}". Create it in the app (Goals), or see /goals.` };
  const updated = await goals.contribute(user.id, goal.id, { amount: parsed.amount, occurredOn: parsed.occurredOn });
  return {
    lines: [`🎯 <b>${html(updated.name)}</b>: +${formatRupiah(parsed.amount)} · ${updated.percent}% (${formatRupiah(updated.saved)} / ${formatRupiah(updated.target)})`],
    txIds: [],
  };
}

/** Records one line. Returns { lines, txIds, newPerson } or { error }. */
async function recordLine(user, line, ctx) {
  if (SAVE_RE.test(line)) return saveTowardsGoal(user, line, ctx);

  const parsed = await parseQuick(line, ctx.parserContext);
  if (!parsed.amount) return { error: `No amount in "${html(line.trim())}". Try <code>kopi 25k</code>.` };

  const category = parsed.debt ? null : ctx.cats.find((c) => c.id === parsed.categoryId) || fallbackCategory(ctx.cats, parsed.type);
  const account = await defaultAccount(user.id, ctx.accs, parsed.accountId);
  const { value, error } = validateTransaction({
    type: parsed.type,
    amount: parsed.amount,
    occurredOn: parsed.occurredOn || ctx.parserContext.today,
    accountId: account?.id,
    categoryId: category?.id,
    personId: parsed.personId,
    personName: parsed.personName,
    description: parsed.description || null,
  });
  if (error) return { error: `Couldn't save "${html(line.trim())}": ${html(error)}.` };

  if (parsed.split) {
    const result = await transactions.createSplit(user.id, value, parsed.split);
    const [mine, ...theirs] = result.transactions;
    const ppl = await people.list(user.id);
    const lines = [
      `✅ <b>−${formatRupiah(value.amount)}</b> · ${html(mine.category)} · ${html(mine.account)} · ${dayLabel(mine.occurredOn)} · split ${parsed.split.count} ways`,
      `   You ${formatRupiah(result.yours)}`,
      ...theirs.map((t) => `   🤝 ${html(debtLine(ppl.find((p) => p.id === t.personId)))}`),
    ];
    const alert = await notifications.checkBudget(user.id, mine, { telegramToo: false }).catch(() => null);
    if (alert) lines.push(`${alert.level === 'over' ? '🚨' : '⚠️'} ${html(alert.message)}`);
    return { lines, txIds: result.transactions.map((t) => t.id), newPerson: true };
  }

  const tx = await transactions.create(user.id, value);
  const lines = [`✅ ${txLine(tx)}`];
  if (parsed.categoryFallback) lines.push('   <i>Not sure of the category: reply with one to fix it (e.g. "food").</i>');
  if (tx.personId) {
    const person = (await people.list(user.id)).find((p) => p.id === tx.personId);
    if (person) lines.push(`   🤝 ${html(debtLine(person))}`);
  }
  const alert = await notifications.checkBudget(user.id, tx, { telegramToo: false }).catch(() => null);
  if (alert) lines.push(`${alert.level === 'over' ? '🚨' : '⚠️'} ${html(alert.message)}`);
  return { lines, txIds: [tx.id], newPerson: Boolean(parsed.personName || parsed.split) };
}

/** A message: one transaction per line, one reply for all of them. */
async function recordMessage(user, chatId, text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_LINES) return telegram.sendMessage(chatId, `That's a lot! Send at most ${MAX_LINES} lines at a time.`);

  let ctx = await loadContext(user.id);
  const out = [];
  const txIds = [];
  for (const line of lines) {
    try {
      const result = await recordLine(user, line, ctx);
      if (result.error) out.push(`❓ ${result.error}`);
      else {
        out.push(...result.lines);
        txIds.push(...result.txIds);
        if (result.newPerson) ctx = await loadContext(user.id); // the next line may name them again
      }
    } catch (err) {
      out.push(`❓ Couldn't save "${html(line)}": ${html(err.message)}.`);
    }
  }
  if (lines.length > 1 && txIds.length) out.unshift(`Saved ${txIds.length} of ${lines.length}:`);
  return replyAbout(chatId, out.join('\n'), txIds);
}

// ---- Undo ----

/** Removes the transactions a bot message was about. Returns how many were removed. */
async function undoMessage(user, chatId, messageId) {
  let removed = 0;
  for (const id of await txIdsFor(chatId, messageId)) {
    try {
      await transactions.remove(user.id, id);
      removed++;
    } catch {
      // already gone, or not theirs
    }
  }
  return removed;
}

async function undoLast(user, chatId) {
  const messageId = await lastMessageId(chatId);
  return messageId ? undoMessage(user, chatId, messageId) : 0;
}

// ---- Corrections: replying to one of the bot's messages ----

const DELETE_RE = /^(hapus|delete|batal|cancel|undo|remove|hapus aja)$/i;
const CORRECTION_HELP =
  'Reply with what to change: an amount (<code>30k</code>), a date (<code>kemarin</code>), an account (<code>gopay</code>) or a category (<code>food</code>). Or <code>hapus</code> to delete it.';

async function correct(user, chatId, replyToId, text) {
  const ids = await txIdsFor(chatId, replyToId);
  if (!ids.length) return telegram.sendMessage(chatId, 'Reply to one of my ✅ messages to change it.');

  if (DELETE_RE.test(text.trim())) {
    const removed = await undoMessage(user, chatId, replyToId);
    return telegram.sendMessage(chatId, removed ? `🗑 Deleted ${removed > 1 ? `${removed} transactions` : 'it'}.` : 'Already deleted.');
  }
  if (ids.length > 1) {
    return telegram.sendMessage(chatId, 'That message has several transactions: change them in the app, or reply <code>hapus</code> to delete them all.');
  }

  let tx;
  try {
    tx = await transactions.findById(user.id, ids[0]);
  } catch {
    return telegram.sendMessage(chatId, 'That transaction was deleted.');
  }
  const ctx = await loadContext(user.id);
  const parsed = await parseQuick(text, ctx.parserContext);
  const changes = {};
  if (parsed.amount) changes.amount = parsed.amount;
  if (parsed.occurredOn) changes.occurredOn = parsed.occurredOn;
  if (parsed.accountId) changes.accountId = parsed.accountId;
  if (!tx.personId && tx.type !== 'transfer') {
    const category = await matchCategory(text, ctx.parserContext.categories.filter((c) => c.type === tx.type), ctx.learned);
    if (category && category.id !== tx.categoryId) changes.categoryId = category.id;
  }
  if (!Object.keys(changes).length) return telegram.sendMessage(chatId, CORRECTION_HELP);

  const { value, error } = validateTransaction({
    type: tx.type,
    amount: tx.amount,
    occurredOn: tx.occurredOn,
    accountId: tx.accountId,
    toAccountId: tx.toAccountId,
    categoryId: tx.categoryId,
    personId: tx.personId,
    description: tx.description,
    ...changes,
  });
  if (error) return telegram.sendMessage(chatId, `Couldn't change it: ${html(error)}.`);
  const updated = await transactions.update(user.id, tx.id, value);
  const learnedKeyword = changes.categoryId ? await rules.learn(user.id, tx.description, changes.categoryId) : null;

  const lines = [`✏️ ${txLine(updated)}`];
  if (learnedKeyword) lines.push(`   <i>Got it: "${html(learnedKeyword)}" goes to ${html(updated.category)} from now on.</i>`);
  return replyAbout(chatId, lines.join('\n'), [updated.id]);
}

module.exports = { recordMessage, correct, undoMessage, undoLast, debtLine, dayLabel, loadContext };
