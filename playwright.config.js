const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3100', headless: true, channel: 'chrome' },
  webServer: { command: 'node backend/server.js', url: 'http://127.0.0.1:3100/api/health', env: { PORT: '3100', DB_PATH: '/tmp/devhub-browser-tests.db' }, reuseExistingServer: false },
});
