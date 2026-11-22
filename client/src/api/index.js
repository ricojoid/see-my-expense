import { http, request } from './client';

/** Downloads a file from an authenticated endpoint and saves it under the server's file name. */
async function download(path, query, fallbackName) {
  const res = await request('GET', path, { query, raw: true });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const authApi = {
  login: (username, password) => request('POST', '/auth/login', { body: { username, password }, auth: false }),
  me: () => http.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => http.put('/auth/me/password', { currentPassword, newPassword }),
};

export const transactionsApi = {
  list: (filters) => http.get('/transactions', filters),
  summary: (month) => http.get('/transactions/summary', { month }),
  stats: (month) => http.get('/transactions/stats', { month }),
  weekly: () => http.get('/transactions/weekly'),
  create: (payload) => http.post('/transactions', payload),
  update: (id, payload) => http.put(`/transactions/${id}`, payload),
  remove: (id) => http.del(`/transactions/${id}`),
  import: (csv) => http.post('/transactions/import', { csv }),
  /** { transaction, split: { count, people } }: your share plus each person's, all at once. */
  split: (transaction, split) => http.post('/transactions/split', { transaction, split }),
  exportCsv: (filters) => download('/transactions/export', filters, 'transactions.csv'),
};

export const categoriesApi = {
  list: () => http.get('/categories'),
  create: (payload) => http.post('/categories', payload),
  update: (id, payload) => http.put(`/categories/${id}`, payload),
  remove: (id) => http.del(`/categories/${id}`),
  /** Keywords learned from corrections, for quick entry. */
  rules: () => http.get('/categories/rules'),
};

export const insightsApi = {
  projection: () => http.get('/insights/projection'),
  subscriptions: () => http.get('/insights/subscriptions'),
  downloadReport: (month) => download('/insights/report', { month }, `see-my-expense-${month}.pdf`),
};

export const goalsApi = {
  list: () => http.get('/goals'),
  create: (goal) => http.post('/goals', goal),
  update: (id, goal) => http.put(`/goals/${id}`, goal),
  remove: (id) => http.del(`/goals/${id}`),
  contribute: (id, payload) => http.post(`/goals/${id}/contributions`, payload),
  history: (id) => http.get(`/goals/${id}/contributions`),
};

export const accountsApi = {
  list: () => http.get('/accounts'),
  create: (name) => http.post('/accounts', { name }),
  rename: (id, name) => http.put(`/accounts/${id}`, { name }),
  remove: (id) => http.del(`/accounts/${id}`),
};

export const peopleApi = {
  list: () => http.get('/people'),
  rename: (id, name) => http.put(`/people/${id}`, { name }),
  remove: (id) => http.del(`/people/${id}`),
};

export const notificationsApi = {
  get: () => http.get('/notifications'),
  update: (settings) => http.put('/notifications', settings),
  subscribe: (subscription) => http.post('/notifications/subscriptions', { subscription }),
  unsubscribe: (endpoint) => http.del('/notifications/subscriptions', { endpoint }),
  test: () => http.post('/notifications/test'),
};

export const telegramApi = {
  status: () => http.get('/telegram'),
  link: () => http.post('/telegram/link'),
  unlink: () => http.del('/telegram/link'),
};

export const budgetsApi = {
  list: (month) => http.get('/budgets', { month }),
  set: (categoryId, amount) => http.put(`/budgets/${categoryId}`, { amount }),
};

export const recurringApi = {
  list: () => http.get('/recurring'),
  upcoming: () => http.get('/recurring/upcoming'),
  create: (payload) => http.post('/recurring', payload),
  setActive: (id, active) => http.patch(`/recurring/${id}`, { active }),
  remove: (id) => http.del(`/recurring/${id}`),
};

export const usersApi = {
  list: () => http.get('/users'),
  create: (payload) => http.post('/users', payload),
  resetPassword: (id, password) => http.put(`/users/${id}/password`, { password }),
  setRole: (id, role) => http.put(`/users/${id}/role`, { role }),
  remove: (id) => http.del(`/users/${id}`),
};
