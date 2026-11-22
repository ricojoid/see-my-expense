import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against a running app (API + web).
 *
 *   E2E_BASE_URL       the web app, default http://localhost:5173 (Vite dev, proxies /api)
 *   E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD   an admin, used to create a throwaway user
 *   PW_CHANNEL=chrome  use the installed Chrome instead of Playwright's Chromium
 */
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',
  fullyParallel: false, // one throwaway user: keep its data predictable
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block', // tests should hit the network, not a cached shell
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1400, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel } },
  ],
});
