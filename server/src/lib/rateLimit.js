/** Tiny in-memory limiter for failed login attempts. */
function createLimiter({ max = 5, windowMs = 15 * 60 * 1000, now = () => Date.now() } = {}) {
  const hits = new Map();

  function prune(key) {
    const entry = hits.get(key);
    if (entry && now() - entry.first >= windowMs) hits.delete(key);
    return hits.get(key);
  }

  return {
    /** Seconds until the key may try again, or 0 if it is not blocked. */
    retryAfter(key) {
      const entry = prune(key);
      if (!entry || entry.count < max) return 0;
      return Math.ceil((entry.first + windowMs - now()) / 1000);
    },
    fail(key) {
      const entry = prune(key);
      if (entry) entry.count++;
      else hits.set(key, { count: 1, first: now() });
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

module.exports = { createLimiter };
