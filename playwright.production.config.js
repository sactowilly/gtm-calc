import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/production',
  outputDir: './test-results/production',
  reporter: 'line',
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4175/gtm-calc/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/helpers/static-server.mjs --root dist --port 4175 --base gtm-calc',
    url: 'http://127.0.0.1:4175/gtm-calc/',
    reuseExistingServer: false,
    timeout: 30000
  }
});
