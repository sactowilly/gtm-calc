import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/compat',
  reporter: 'line',
  workers: 5,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-safari', use: { ...devices['iPhone 13'] } }
  ],
  use: { baseURL: 'http://127.0.0.1:4173/gtm-calc/' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/gtm-calc/',
    reuseExistingServer: true,
    timeout: 120000
  }
});
