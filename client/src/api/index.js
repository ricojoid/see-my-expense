import { http, request } from './client';

export const authApi = {
  login: (username, password) => request('POST', '/auth/login', { body: { username, password }, auth: false }),
  me: () => http.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => http.put('/auth/me/password', { currentPassword, newPassword }),
};

export const transactionsApi = {
  list: (filters) => http.get('/transactions', filters),
  summary: (month) => http.get('/transactions/summary', { month }),
  stats: (month) => http.get('/transactions/stats', { month }),
  create: (payload) => http.post('/transactions', payload),
  update: (id, payload) => http.put(`/transactions/${id}`, payload),
  remove: (id) => http.del(`/transactions/${id}`),
  import: (csv) => http.post('/transactions/import', { csv }),
  /** Downloads the CSV through the authenticated API and saves it. */
  async exportCsv(filters) {
    const res = await request('GET', '/transactions/export', { query: filters, raw: true });
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'transactions.csv';
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const categoriesApi = {
  list: () => http.get('/categories'),
  create: (payload) => http.post('/categories', payload),
  update: (id, payload) => http.put(`/categories/${id}`, payload),
  remove: (id) => http.del(`/categories/${id}`),
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

export const budgetsApi = {
  list: (month) => http.get('/budgets', { month }),
  set: (categoryId, amount) => http.put(`/budgets/${categoryId}`, { amount }),
};

export const recurringApi = {
  list: () => http.get('/recurring'),
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
