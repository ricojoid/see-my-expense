import { authHeader, deleteRow, expect, goTo, quickAdd, test } from './fixtures.js';

/**
 * Account balances: set the bank's real balance, top up an e-wallet from it,
 * pay with the e-wallet. Desktop and phone share one user, so the e-wallet
 * carries the run's tag and everything is removed at the end.
 */
test('top up an e-wallet from the bank, then pay with it', async ({ page }, info) => {
  const wallet = info.project.name === 'phone' ? 'Ovop' : 'Ovod';
  const headers = await authHeader(page);
  const created = await page.request.post('/api/accounts', { headers, data: { name: wallet } });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  await page.reload();

  const balances = page.getByRole('main').locator('section', { has: page.getByRole('heading', { name: 'Balances' }) });
  const row = (name) => balances.getByRole('button', { name: new RegExp(`^${name}:`) });

  // The bank's real balance, set without adding a transaction.
  await row('Bank').click();
  const sheet = page.getByRole('dialog', { name: 'Bank balance' });
  await sheet.getByLabel('Balance').fill('5000000');
  await sheet.getByRole('button', { name: 'Set balance' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row('Bank')).toContainText('Rp 5.000.000');

  // "isi ovo 1jt": a transfer, Bank -> wallet. Income and outcome don't move.
  await quickAdd(page, `isi ${wallet.toLowerCase()} 1jt`);
  await expect(row('Bank')).toContainText('Rp 4.000.000');
  await expect(row(wallet)).toContainText('Rp 1.000.000');

  // Paying with the wallet lowers the wallet only.
  await quickAdd(page, `makan 30k pake ${wallet.toLowerCase()}`);
  await expect(row(wallet)).toContainText('Rp 970.000');
  await expect(row('Bank')).toContainText('Rp 4.000.000');

  // Clean up: both transactions, the wallet, the bank's balance.
  await goTo(page, 'Activity');
  await deleteRow(page, page.getByRole('main').getByRole('button', { name: /Makan/ }).first());
  await deleteRow(page, page.getByRole('main').getByRole('button', { name: new RegExp(`Bank → ${wallet}`) }).first());
  expect((await page.request.delete(`/api/accounts/${id}`, { headers })).ok()).toBeTruthy();
  const accounts = await (await page.request.get('/api/accounts', { headers })).json();
  const bank = accounts.find((a) => a.name === 'Bank');
  await page.request.put(`/api/accounts/${bank.id}/balance`, { headers, data: { balance: 0 } });
});
