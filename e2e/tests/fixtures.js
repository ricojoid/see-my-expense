import fs from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { STATE_FILE } from '../global-setup.js';

export const user = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
export const isPhone = (page) => (page.viewportSize()?.width ?? 1400) < 1024;

/** A page that is signed in as the throwaway user. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const { username, password } = user();
    await page.goto('/');
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Outcome').first()).toBeVisible();
    await use(page);
  },
});

/** Opens the add sheet (sidebar on desktop, + button on phones). */
export async function openNewTransaction(page) {
  await page.getByRole('button', { name: 'New transaction' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible();
}

/** Types a quick-entry line and saves; waits until the sheet is gone. */
export async function quickAdd(page, line) {
  await openNewTransaction(page);
  const dialog = page.getByRole('dialog', { name: 'New transaction' });
  await dialog.getByLabel('Quick entry').fill(line);
  await dialog.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Navigates and waits for the page's heading, so nothing from the previous page is matched. */
export async function goTo(page, name) {
  if (isPhone(page) && name === 'Settings') await page.getByRole('button', { name: 'Settings' }).click();
  else if (isPhone(page) && name === 'Goals') await page.getByRole('button', { name: /^(See all|Set one)$/ }).last().click();
  else {
    const nav = isPhone(page) ? page.locator('nav').last() : page.locator('aside nav');
    await nav.getByRole('button', { name, exact: true }).click();
  }
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Deletes a transaction from its row (first tap arms, second confirms). */
export async function deleteRow(page, row) {
  await row.click();
  const editor = page.getByRole('dialog', { name: 'Edit transaction' });
  await editor.getByRole('button', { name: 'Delete' }).click();
  await editor.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(editor).toHaveCount(0);
}

/** On the Debts page: deletes a person's transactions, then the person. */
export async function removePerson(page, name) {
  await page.getByRole('main').getByRole('button', { name: new RegExp(name, 'i') }).first().click();
  const sheet = page.getByRole('dialog', { name: new RegExp(name, 'i') });
  const rows = sheet.getByRole('button', { name: /(To|From) / });
  await expect(rows.first()).toBeVisible();
  for (let n = await rows.count(); n > 0; n--) await deleteRow(page, rows.first());
  await sheet.getByRole('button', { name: 'Remove' }).click();
  await sheet.getByRole('button', { name: 'Confirm remove' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export { expect };
