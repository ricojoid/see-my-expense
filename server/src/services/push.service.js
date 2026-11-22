const webpush = require('web-push');
const { sql, getPool } = require('../config/db');
const { badRequest } = require('../lib/http');

const VAPID_SETTING = 'vapid_keys';

/**
 * VAPID keys identify this server to browsers' push services. They come from
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY if set, otherwise they are generated
 * once and kept in the database, so a deploy needs no extra configuration.
 */
let vapidReady = null;
function vapid() {
  if (!vapidReady) {
    vapidReady = loadVapid().catch((err) => {
      vapidReady = null;
      throw err;
    });
  }
  return vapidReady;
}

async function loadVapid() {
  let keys =
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
      ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
      : await storedKeys();
  if (!keys) {
    const generated = webpush.generateVAPIDKeys();
    const pool = await getPool();
    // Two instances starting together: only the first insert wins, both then read it back.
    await pool
      .request()
      .input('name', sql.VarChar(50), VAPID_SETTING)
      .input('value', sql.NVarChar(sql.MAX), JSON.stringify(generated))
      .query(`
        IF NOT EXISTS (SELECT 1 FROM app_settings WHERE name = @name)
          INSERT INTO app_settings (name, value) VALUES (@name, @value)
      `);
    keys = await storedKeys();
  }
  // Apple rejects "localhost" subjects, so default to a neutral address.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@see-my-expense.app', keys.publicKey, keys.privateKey);
  return keys;
}

async function storedKeys() {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('name', sql.VarChar(50), VAPID_SETTING)
    .query('SELECT value FROM app_settings WHERE name = @name');
  return r.recordset[0] ? JSON.parse(r.recordset[0].value) : null;
}

async function publicKey() {
  return (await vapid()).publicKey;
}

function parseSubscription(sub) {
  const endpoint = sub?.endpoint;
  const { p256dh, auth } = sub?.keys || {};
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 800) {
    throw badRequest('invalid push subscription');
  }
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) {
    throw badRequest('invalid push subscription keys');
  }
  return { endpoint, p256dh, auth };
}

/** Saves this device's subscription for the user (a device that changes user is moved over). */
async function subscribe(userId, subscription) {
  const { endpoint, p256dh, auth } = parseSubscription(subscription);
  const pool = await getPool();
  await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('endpoint', sql.VarChar(800), endpoint)
    .input('p256dh', sql.VarChar(200), p256dh)
    .input('auth', sql.VarChar(100), auth)
    .query(`
      MERGE push_subscriptions AS target
      USING (SELECT @endpoint AS endpoint) AS src ON target.endpoint = src.endpoint
      WHEN MATCHED THEN UPDATE SET user_id = @uid, p256dh = @p256dh, auth = @auth
      WHEN NOT MATCHED THEN INSERT (user_id, endpoint, p256dh, auth) VALUES (@uid, @endpoint, @p256dh, @auth);
    `);
}

async function unsubscribe(userId, endpoint) {
  const pool = await getPool();
  await pool
    .request()
    .input('uid', sql.Int, userId)
    .input('endpoint', sql.VarChar(800), String(endpoint || ''))
    .query('DELETE FROM push_subscriptions WHERE user_id = @uid AND endpoint = @endpoint');
}

async function hasSubscription(userId) {
  const pool = await getPool();
  const r = await pool.request().input('uid', sql.Int, userId).query('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = @uid');
  return r.recordset[0].n > 0;
}

/**
 * Sends `{ title, body, url, tag }` to every device of the user. Subscriptions
 * the push service reports as gone (404 / 410) are removed. Returns how many got it.
 */
async function sendToUser(userId, payload) {
  await vapid();
  const pool = await getPool();
  const subs = (
    await pool.request().input('uid', sql.Int, userId).query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = @uid')
  ).recordset;

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        TTL: 6 * 3600,
      });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.request().input('id', sql.Int, s.id).query('DELETE FROM push_subscriptions WHERE id = @id');
      } else {
        console.error(`[push] user ${userId}: ${err.statusCode || ''} ${err.message}`);
      }
    }
  }
  return sent;
}

module.exports = { publicKey, subscribe, unsubscribe, hasSubscription, sendToUser };
