import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    {
      name: 'tablet',
      use: {
        viewport: { width: 1194, height: 834 },
        hasTouch: true,
        isMobile: false,
        deviceScaleFactor: 1,
      },
    },
  ],
});
