import fs from 'node:fs';
import { request } from '@playwright/test';
import { STATE_FILE } from './global-setup.js';

/** Deletes the throwaway user and everything it created. */
export default async function globalTeardown(config) {
  if (!fs.existsSync(STATE_FILE)) return;
  const { id, adminToken } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const api = await request.newContext({ baseURL: config.projects[0].use.baseURL });
  await api.delete(`/api/users/${id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  await api.dispose();
  fs.rmSync(STATE_FILE);
}
