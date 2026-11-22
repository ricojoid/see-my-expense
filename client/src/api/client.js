const TOKEN_KEY = 'sme_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let onUnauthorized = () => {};
/** Lets the auth context sign the user out when any call returns 401. */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

/**
 * fetch wrapper: JSON in/out, bearer token, consistent errors.
 * `raw: true` returns the Response (for file downloads).
 */
export async function request(method, path, { body, query, raw = false, auth = true } = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  const token = tokenStore.get();

  let res;
  try {
    res = await fetch(`/api${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(auth && token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  if (res.status === 401 && auth) {
    tokenStore.clear();
    onUnauthorized();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.details);
  }
  if (raw) return res;
  if (res.status === 204) return null;
  return res.json();
}

export const http = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
};
