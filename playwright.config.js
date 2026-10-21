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
    // Di CI dev server masih dingin: tes pertama men-transform seluruh modul
    // (terukur 22,3 s lokal). Runner lebih lambat, jadi beri 60 s di CI.
    timeout: process.env.CI ? 60_000 : 30_000,
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
            // Dua jalur, dua tujuan:
            //  · default (lokal)  → `npm run dev`: transform on-demand, cepat dipakai
            //    sambil mengembangkan tes. Menghormati VITE_USE_EMULATORS=1.
            //  · E2E_PREVIEW=1 (CI) → `vite preview` atas **dist-e2e**, yaitu build
            //    terpisah yang dibangun dengan VITE_USE_EMULATORS=1 (lihat script
            //    `build:e2e` + step CI-nya). Static, deterministik, dan tidak
            //    menabrak timeout seperti dev server dingin di runner.
            //    `vite preview` atas `dist` biasa TIDAK bisa dipakai: dist itu
            //    dibangun dengan env demo, jadi login tidak pernah ke emulator.
            // `stdout/stderr: 'pipe'` supaya kalau server mati, log Playwright
            // memuat pesan aslinya, bukan cuma "webServer was not able to start".
            command: process.env.E2E_PREVIEW
                ? 'npx vite preview --outDir dist-e2e --port 3000 --strictPort'
                : 'npm run dev -- --port 3000',
            url: 'http://localhost:3000',
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
            stdout: 'pipe',
            stderr: 'pipe',
            env: { VITE_USE_EMULATORS: '1' },
        },
    ],
});
