import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/source-pages',
  outputDir: './test-results/source-pages',
  reporter: 'line',
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4174/gtm-calc/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/helpers/static-server.mjs --root . --port 4174 --base gtm-calc',
    url: 'http://127.0.0.1:4174/gtm-calc/',
    reuseExistingServer: false,
    timeout: 30000
  }
});
