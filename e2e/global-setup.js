import fs from 'node:fs';
import crypto from 'node:crypto';
import { request } from '@playwright/test';

/** Creates a throwaway user for the run (deleted in global-teardown). */
export const STATE_FILE = new URL('./.e2e-user.json', import.meta.url);

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  const admin = { username: process.env.E2E_ADMIN_USERNAME || 'admin', password: process.env.E2E_ADMIN_PASSWORD };
  if (!admin.password) throw new Error('Set E2E_ADMIN_PASSWORD (an admin of the app under test).');

  const api = await request.newContext({ baseURL });
  const login = await api.post('/api/auth/login', { data: admin });
  if (!login.ok()) throw new Error(`admin login failed: ${login.status()} ${await login.text()}`);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };

  const user = { username: `e2e_${crypto.randomBytes(4).toString('hex')}`, password: `E2e-${crypto.randomBytes(9).toString('base64url')}` };
  const created = await api.post('/api/users', { headers, data: { ...user, role: 'user' } });
  if (!created.ok()) throw new Error(`creating the test user failed: ${created.status()} ${await created.text()}`);
  const { id } = await created.json();

  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...user, id, adminToken: token }));
  await api.dispose();
}
