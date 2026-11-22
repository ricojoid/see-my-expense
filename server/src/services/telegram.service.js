const crypto = require('node:crypto');
const { sql, getPool } = require('../config/db');

/**
 * Telegram Bot API access, account linking and sending messages to a user's
 * linked chats. The bot itself (reading messages) is in telegram.bot.js.
 *
 * Enabled when TELEGRAM_BOT_TOKEN is set. TELEGRAM_API_BASE exists for tests.
 */
const token = () => process.env.TELEGRAM_BOT_TOKEN || '';
const apiBase = () => process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const isEnabled = () => Boolean(token());

const LINK_CODE_MINUTES = 10;
let botUsername = null;

class TelegramError extends Error {
  constructor(method, status, description) {
    super(`telegram ${method}: ${status} ${description}`);
    this.status = status;
  }
}

/** Calls a Bot API method; returns `result` or throws TelegramError. */
async function api(method, body = {}, { timeoutMs = 15000 } = {}) {
  const res = await fetch(`${apiBase()}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new TelegramError(method, res.status, data.description || 'request failed');
  return data.result;
}

async function getBotUsername() {
  if (!botUsername) botUsername = (await api('getMe')).username;
  return botUsername;
}

/** Escapes text for parse_mode HTML. */
const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sendMessage = (chatId, text, extra = {}) =>
  api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

/** Uploads a file (e.g. the monthly PDF) to a chat. */
async function sendDocument(chatId, buffer, filename, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('document', new Blob([buffer], { type: 'application/pdf' }), filename);
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }
  const res = await fetch(`${apiBase()}/bot${token()}/sendDocument`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new TelegramError('sendDocument', res.status, data.description || 'request failed');
  return data.result;
}

// ---- Linking ----

/** A one-time code and the t.me link that hands it to the bot. */
async function createLinkCode(userId) {
  const code = crypto.randomBytes(12).toString('base64url');
  const pool = await getPool();
  await pool
    .request()
    .input('code', sql.VarChar(32), code)
    .input('uid', sql.Int, userId)
    .input('minutes', sql.Int, LINK_CODE_MINUTES)
    .query(`
      DELETE FROM telegram_link_codes WHERE expires_at < SYSDATETIME() OR user_id = @uid;
      INSERT INTO telegram_link_codes (code, user_id, expires_at) VALUES (@code, @uid, DATEADD(MINUTE, @minutes, SYSDATETIME()));
    `);
  return { url: `https://t.me/${await getBotUsername()}?start=${code}`, expiresInMinutes: LINK_CODE_MINUTES };
}

/** Uses up a code: links the chat to its user. Returns the user id, or null if the code is unknown / expired. */
async function redeemLinkCode(code, chatId, chatName) {
  const pool = await getPool();
  // Claim the code atomically (DELETE ... OUTPUT) so it works once only, then link the chat.
  const claimed = await pool
    .request()
    .input('code', sql.VarChar(32), String(code).slice(0, 32))
    .query('DELETE FROM telegram_link_codes OUTPUT DELETED.user_id AS userId WHERE code = @code AND expires_at >= SYSDATETIME()');
  const userId = claimed.recordset[0]?.userId;
  if (!userId) return null;
  await pool
    .request()
    .input('chat', sql.BigInt, chatId)
    .input('uid', sql.Int, userId)
    .input('name', sql.NVarChar(100), (chatName || '').slice(0, 100) || null)
    .query(`
      MERGE telegram_links AS target
      USING (SELECT @chat AS chat_id) AS src ON target.chat_id = src.chat_id
      WHEN MATCHED THEN UPDATE SET user_id = @uid, chat_name = @name, linked_at = SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT (chat_id, user_id, chat_name) VALUES (@chat, @uid, @name);
    `);
  return userId;
}

async function userForChat(chatId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('chat', sql.BigInt, chatId)
    .query('SELECT l.user_id AS id, u.username FROM telegram_links l JOIN users u ON u.id = l.user_id WHERE l.chat_id = @chat');
  return r.recordset[0] || null;
}

/** The chats linked to a user. */
async function linksOf(userId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('uid', sql.Int, userId)
    .query('SELECT chat_id AS chatId, chat_name AS name, linked_at AS linkedAt FROM telegram_links WHERE user_id = @uid ORDER BY linked_at');
  return r.recordset.map((l) => ({ ...l, chatId: String(l.chatId) }));
}

async function unlinkAll(userId) {
  const pool = await getPool();
  await pool.request().input('uid', sql.Int, userId).query('DELETE FROM telegram_links WHERE user_id = @uid');
}

async function unlinkChat(chatId) {
  const pool = await getPool();
  await pool.request().input('chat', sql.BigInt, chatId).query('DELETE FROM telegram_links WHERE chat_id = @chat');
}

/** For the settings screen. */
async function status(userId) {
  if (!isEnabled()) return { enabled: false, links: [] };
  let username = null;
  try {
    username = await getBotUsername();
  } catch (err) {
    console.error(`[telegram] ${err.message}`);
  }
  return { enabled: true, botUsername: username, links: await linksOf(userId) };
}

/**
 * Sends `text` (HTML) to every chat the user linked. Chats that blocked the
 * bot or no longer exist are unlinked. Returns how many got it.
 */
async function sendToUser(userId, text, extra) {
  if (!isEnabled()) return 0;
  let sent = 0;
  for (const link of await linksOf(userId)) {
    try {
      await sendMessage(link.chatId, text, extra);
      sent++;
    } catch (err) {
      if (err.status === 403 || err.status === 400) await unlinkChat(link.chatId);
      else console.error(`[telegram] user ${userId}: ${err.message}`);
    }
  }
  return sent;
}

module.exports = {
  isEnabled,
  api,
  escapeHtml,
  sendMessage,
  sendDocument,
  linksOf,
  getBotUsername,
  createLinkCode,
  redeemLinkCode,
  userForChat,
  unlinkAll,
  unlinkChat,
  status,
  sendToUser,
};
