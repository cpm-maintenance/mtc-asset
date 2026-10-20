import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config.
 *
 * Alur login → WO → PDF dijalankan terhadap **Firebase Emulator** (auth 9099,
 * database 9000): tes tidak menyentuh produksi dan tidak butuh kredensial asli.
 * Data uji di-seed otomatis oleh e2e/seed-emulator.mjs dari dalam spec.
 * Dev server diberi VITE_USE_EMULATORS=1 sehingga src/js/db.js menyambung ke
 * emulator, bukan ke RTDB produksi.
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
    webServer: [
        {
            command:
                // `npx` wajib: di runner CI `firebase` tidak ada di PATH (hanya
                // node_modules/.bin), jadi perintah telanjang gagal "not found"
                // dan webServer mati sebelum sempat listen.
                'npx firebase emulators:start --only auth,database --config e2e/firebase.e2e.json --project mtc-asset',
            url: 'http://127.0.0.1:9000',
            reuseExistingServer: true,
            timeout: 120_000,
            stdout: 'ignore',
            stderr: 'pipe',
        },
        {
            command: process.env.CI ? 'npm run preview -- --port 3000' : 'npm run dev',
            url: 'http://localhost:3000',
            reuseExistingServer: true,
            timeout: 60_000,
            env: { VITE_USE_EMULATORS: '1' },
        },
    ],
});
