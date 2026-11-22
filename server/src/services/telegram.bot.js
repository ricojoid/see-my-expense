const { sql, getPool } = require('../config/db');
const telegram = require('./telegram.service');
const notifications = require('./notifications.service');
const record = require('./telegram.record');
const books = require('./telegram.books');
const { COMMANDS, HELP, runCommand } = require('./telegram.commands');

/**
 * The Telegram bot: long-polls for updates and routes them. Linking lives in
 * telegram.service, recording and corrections in telegram.record, commands in
 * telegram.commands. Runs inside the API; one poller per bot token.
 */
const OFFSET_SETTING = 'telegram_offset';
const POLL_SECONDS = 50;
const log = (msg) => console.log(`[telegram] ${msg}`);
const html = telegram.escapeHtml;

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

// ---- Updates ----

async function link(msg, code) {
  const chatId = msg.chat.id;
  const name = [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ') || msg.chat.title || msg.chat.username;
  const userId = await telegram.redeemLinkCode(code, chatId, name);
  if (!userId) return telegram.sendMessage(chatId, 'That link has expired. Open the app → Settings → Telegram and tap Connect again.');
  await notifications.ensureSettings(userId);
  const user = await telegram.userForChat(chatId);
  return telegram.sendMessage(chatId, `🎉 Connected to <b>${html(user.username)}</b>.\n\n${HELP}`);
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return telegram.sendMessage(chatId, 'Send text, like <code>kopi 25k</code>.');

  const start = /^\/start(?:@\w+)?\s+(\S+)/.exec(text);
  if (start) return link(msg, start[1]);

  const user = await telegram.userForChat(chatId);
  if (!user) {
    return telegram.sendMessage(chatId, 'This chat is not connected yet. In the app, open Settings → Telegram and tap <b>Connect Telegram</b>.');
  }

  // Replying to one of the bot's messages corrects what it recorded.
  if (msg.reply_to_message?.from?.is_bot) return record.correct(user, chatId, msg.reply_to_message.message_id, text);

  if (books.isCloseRequest(text)) return books.askClose(user, chatId);
  // "saldo gopay 150k" (no slash needed) sets a balance; plain "saldo" lists them.
  const saldo = /^\s*(?:saldo|balance)\b\s*([\s\S]*)$/i.exec(text);
  if (saldo) return runCommand(user, chatId, 'saldo', saldo[1].trim());

  const command = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(text);
  if (command) return runCommand(user, chatId, command[1].toLowerCase(), command[2].trim());
  return record.recordMessage(user, chatId, text);
}

async function handleCallback(query) {
  const chatId = query.message?.chat?.id;
  const user = chatId && (await telegram.userForChat(chatId));
  if (user && (await books.handleCallback(user, query))) return null;
  if (!user || !/^undo(:\d+)?$/.test(query.data || '')) return telegram.api('answerCallbackQuery', { callback_query_id: query.id });

  const removed = await record.undoMessage(user, chatId, query.message.message_id);
  await telegram.api('answerCallbackQuery', { callback_query_id: query.id, text: removed ? 'Removed' : 'Already removed' });
  if (removed) {
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
        const chatId = update.message?.chat?.id;
        if (chatId) telegram.sendMessage(chatId, 'Something went wrong on my side. Please try again.').catch(() => {});
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
