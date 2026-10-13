import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config.
 *
 * Starts the Vite dev server automatically and runs against http://localhost:3000.
 * Full login/WO/PDF flows need real Firebase credentials — set E2E_EMAIL /
 * E2E_PASSWORD; those specs self-skip when the env vars are absent so CI stays green.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: process.env.CI ? 'npm run preview -- --port 3000' : 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
