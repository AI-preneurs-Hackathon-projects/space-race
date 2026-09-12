import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 210000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    headless: true,
    viewport: { width: 1440, height: 980 },
    launchOptions: {
      // Use Playwright's Chromium by default; allow a locally installed browser.
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    },
    screenshot: 'only-on-failure',
  },
  outputDir: 'outputs/test-results',
});
