const TOKEN_KEY = 'sme_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

async function handle(res) {
  if (res.status === 401) {
    clearToken();
    throw new AuthError('session expired -- please log in again');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function handleLogin(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return body;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function login(username, password) {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(handleLogin);
}

export function fetchTransactions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.month) params.set('month', filters.month);
  const qs = params.toString();
  return fetch(`/api/transactions${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  }).then(handle);
}

export function fetchSummary() {
  return fetch('/api/transactions/summary', { headers: authHeaders() }).then(handle);
}

export function createTransaction(payload) {
  return fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function deleteTransaction(id) {
  return fetch(`/api/transactions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).then(handle);
}

export function fetchCategories(filters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  const qs = params.toString();
  return fetch(`/api/categories${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  }).then(handle);
}

export function createCategory(payload) {
  return fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function updateCategory(id, payload) {
  return fetch(`/api/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function deleteCategory(id) {
  return fetch(`/api/categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).then(handle);
}
