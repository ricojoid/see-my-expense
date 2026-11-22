import { transactionsApi } from '../api';

/**
 * Transactions saved while offline. They live in localStorage, tagged with
 * the user who made them, and are sent oldest first once the server is reachable.
 */
const KEY = 'sme_outbox';
const EVENT = 'sme-outbox';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

function write(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { count: items.length } }));
}

export const outboxCount = (userId) => read().filter((x) => x.userId === userId).length;

export function enqueue(userId, payload) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  write([...read(), { id, userId, payload, queuedAt: new Date().toISOString() }]);
}

/** Subscribes to queue changes; returns the unsubscribe function. */
export function onOutboxChange(listener) {
  const handler = (e) => listener(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

let flushing = null;

/**
 * Sends everything queued. Stops at the first network failure (still offline)
 * and keeps the rest; drops items the server rejects (e.g. a deleted account),
 * reporting them. Returns { sent, rejected }.
 */
export function flushOutbox(userId) {
  if (!flushing) {
    flushing = (async () => {
      let sent = 0;
      const rejected = [];
      for (const item of read().filter((x) => x.userId === userId)) {
        try {
          await transactionsApi.create(item.payload);
          sent++;
        } catch (err) {
          if (err.status === 0) break;
          if (err.status === 401) break; // session expired: keep it for after sign-in
          rejected.push({ item, error: err.message });
        }
        write(read().filter((x) => x.id !== item.id));
      }
      return { sent, rejected };
    })().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}
