import { authHeader, deleteRow, expect, goTo, isPhone, openNewTransaction, quickAdd, removePerson, test } from './fixtures.js';

/**
 * The main flows, on desktop and on a phone. Both runs share one throwaway
 * user, so names carry the run's tag, and each test removes what it adds.
 */
const tag = (info) => (info.project.name === 'phone' ? 'p' : 'd');

test('home shows income and outcome separately, and fits the screen', async ({ page }) => {
  await expect(page.getByText('Income').first()).toBeVisible();
  await expect(page.getByText('Outcome').first()).toBeVisible();
  await expect(page.getByText('Avg outcome / day')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (isPhone(page)) await expect(page.getByRole('button', { name: 'New transaction' })).toBeVisible();
});

test('quick entry saves, the sheet closes and the page stays usable', async ({ page }) => {
  await openNewTransaction(page);
  const dialog = page.getByRole('dialog', { name: 'New transaction' });
  await dialog.getByLabel('Quick entry').fill('tadi bengkel 50 rb');
  await expect(dialog.getByRole('button', { name: /Transport/, pressed: true })).toBeVisible();
  await expect(dialog.getByLabel('Amount')).toHaveValue('50.000');
  await dialog.getByRole('button', { name: /^Save$/ }).click();

  // The bug we never want back: an invisible layer left over after closing.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await goTo(page, 'Activity');
  const row = page.getByRole('main').getByRole('button', { name: /Transport/ }).first();
  await expect(row).toBeVisible();
  await deleteRow(page, row);
  await expect(page.getByText('Transaction deleted')).toBeVisible();
});

test('debts from a sentence, then settle up', async ({ page }, info) => {
  const name = `Tester${tag(info)}`;
  await quickAdd(page, `ngutangin ${name.toLowerCase()} 10k`);
  await goTo(page, 'Debts');
  const person = page.getByRole('main').getByRole('button', { name: new RegExp(name) });
  await expect(person).toContainText('Rp 10.000');
  await expect(person).toContainText('owes you');

  await person.click();
  const sheet = page.getByRole('dialog', { name });
  await sheet.getByRole('button', { name: 'Mark as settled' }).click();
  await sheet.getByRole('button', { name: /Settle Rp/ }).click();
  await expect(sheet.getByText(`All settled with ${name}`)).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Settled people are folded away.
  await page.getByRole('button', { name: /^Settled/ }).click();
  await removePerson(page, name);
});

test('split bill shows the shares and records the debts', async ({ page }, info) => {
  const [a, b] = [`Ani${tag(info)}`, `Beni${tag(info)}`];
  await openNewTransaction(page);
  const dialog = page.getByRole('dialog', { name: 'New transaction' });
  await dialog.getByLabel('Quick entry').fill(`pizza 90k bagi 3 sama ${a.toLowerCase()} ${b.toLowerCase()}`);
  await expect(dialog.getByText('Split 3 ways')).toBeVisible();
  await expect(dialog.getByText(`${a} owes you`)).toBeVisible();
  await dialog.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Split 3 ways: you Rp/)).toBeVisible();

  await goTo(page, 'Debts');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: new RegExp(a) })).toContainText('Rp 30.000');
  await expect(main.getByRole('button', { name: new RegExp(b) })).toContainText('Rp 30.000');

  // Clean up: both people, then your share.
  await removePerson(page, a);
  await removePerson(page, b);
  await goTo(page, 'Activity');
  await deleteRow(page, page.getByRole('main').getByRole('button', { name: /Pizza/ }).first());
});

test('savings goal: create it and put money in', async ({ page }, info) => {
  const name = `E2E Laptop ${tag(info)}`;
  await goTo(page, 'Goals');
  await page.getByRole('button', { name: /^(New goal|New)$/ }).first().click();
  const form = page.getByRole('dialog', { name: 'New goal' });
  await form.getByLabel('What for').fill(name);
  await form.getByLabel('Amount').fill('1000000');
  await form.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const card = page.locator('li', { hasText: name });
  await card.getByRole('button', { name: 'Add money' }).click();
  const sheet = page.getByRole('dialog', { name });
  await sheet.getByLabel('Amount').fill('250000');
  await sheet.getByRole('button', { name: 'Add to savings' }).click();
  await expect(card).toContainText('25%');

  // Clean up
  await card.getByRole('button', { name: new RegExp(name) }).click();
  const edit = page.getByRole('dialog', { name: 'Edit goal' });
  await edit.getByRole('button', { name: 'Delete' }).click();
  await edit.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(card).toHaveCount(0);
});

test('the eye button hides every amount', async ({ page }) => {
  await page.getByRole('button', { name: 'Hide amounts' }).click();
  await expect(page.getByText('Rp •••••').first()).toBeVisible();
  expect(await page.getByRole('main').innerText()).not.toMatch(/Rp\s?\d/);
  await page.getByRole('button', { name: 'Show amounts' }).click();
});

test('insights: switching to Earned and then leaving keeps the next page visible', async ({ page }) => {
  await quickAdd(page, 'bonus e2e 1jt');
  await goTo(page, 'Insights');
  await page.getByRole('tab', { name: 'Earned' }).click();
  await expect(page.getByRole('main').getByText('Other Income').first()).toBeVisible();
  await goTo(page, 'Activity'); // used to leave a blank screen
  const row = page.getByRole('main').getByRole('button', { name: /Bonus/ }).first();
  await expect(row).toBeVisible();
  await deleteRow(page, row);
});

test('close the books on payday, then undo', async ({ page }) => {
  // The desktop and phone runs share one account: start from no closes.
  await page.request.delete('/api/periods/close', { headers: await authHeader(page) }).catch(() => {});
  await page.reload();
  await expect(page.getByText('Outcome').first()).toBeVisible();

  await page.getByRole('button', { name: 'Close books' }).click();
  const sheet = page.getByRole('dialog', { name: 'Close the books' });
  await sheet.getByRole('radio', { name: /Yesterday/ }).click();
  // Start the balances afresh: Cash has 200rb left, the rest is empty.
  await sheet.getByText('Start balances afresh').click();
  await sheet.getByLabel('Cash balance').fill('200000');
  await sheet.getByRole('button', { name: /^Close / }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Books closed\. .* starts today\./)).toBeVisible();

  // The new period started today: its range shows, and the one before is a step back.
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  await expect(page.getByRole('main').getByText(`${today} - today`)).toBeVisible();

  const balances = page.getByRole('main').locator('section', { has: page.getByRole('heading', { name: 'Balances' }) });
  await expect(balances.getByRole('button', { name: /^Cash:/ })).toContainText('Rp 200.000');
  await expect(balances.getByRole('button', { name: /^Bank:/ })).toContainText('Rp 0');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Close undone')).toBeVisible();
  await expect(page.getByRole('main').getByText(`${today} - today`)).toHaveCount(0);

  // Clean up the balance for the other run.
  const headers = await authHeader(page);
  const cash = (await (await page.request.get('/api/accounts', { headers })).json()).find((a) => a.name === 'Cash');
  await page.request.put(`/api/accounts/${cash.id}/balance`, { headers, data: { balance: 0 } });
});
