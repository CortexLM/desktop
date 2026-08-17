import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Cortex IDE (Electron)
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  
  // Timeout configuration
  timeout: 60000,
  expect: {
    timeout: 10000
  },

  // Run tests in parallel
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  
  // Retry configuration
  retries: process.env.CI ? 2 : 0,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],

  // Global setup/teardown
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  use: {
    // Base URL for the app (not used for Electron but kept for consistency)
    baseURL: 'http://localhost:5173',
    
    // Capture screenshots and videos on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Viewport (overridden by Electron window size)
    viewport: { width: 1400, height: 900 }
  },

  // Projects for test organization
  projects: [
    {
      name: 'electron-main',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],

  // Output directory
  outputDir: 'test-results/artifacts'
});
