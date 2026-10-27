// Jalankan SELURUH suite E2E seperti CI (`.github/workflows/test.yml`).
//
// CI bukan sekadar `playwright test`: ia lebih dulu membangun `dist-e2e` dengan
// `VITE_USE_EMULATORS=1` (aplikasi bicara ke Firebase Emulator, bukan ke RTDB
// sungguhan), lalu menjalankan suite dengan `E2E_PREVIEW=1` — `vite preview`
// atas `dist-e2e` — satu worker.
//
// Tanpa env build itu, login tidak pernah sampai ke emulator. Tanpa
// `E2E_PREVIEW`, tiga tes `e2e/css-critical-path.spec.js` ikut di-skip sehingga
// jalur CSS kritis tidak pernah diuji di mesin ini, padahal itu yang menentukan
// FCP layar login.
//
// `npm run test:e2e` tetap jalur pengembangan (dev server: 16 passed · 3 skipped).
/* global console, process */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Env build yang harus identik dengan step "Build (E2E, emulator)" di CI.
 * Kunci kesamaan itu dikunci `tests/e2e-ci-parity.test.js`.
 */
export const E2E_CI_BUILD_ENV = {
    VITE_USE_EMULATORS: '1',
    VITE_FIREBASE_API_KEY: 'demo-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'demo-mtc-asset.firebaseapp.com',
    // Host = namespace RTDB emulator, BUKAN projectId. Harus sama dengan
    // `E2E_RTDB_NS` di `e2e/seed-emulator.mjs`: beda namespace membuat seed masuk
    // ke tempat lain dan aplikasi membaca data kosong tanpa satu pun error.
    VITE_FIREBASE_DATABASE_URL: 'https://mtc-asset-default-rtdb.firebaseio.com',
    VITE_FIREBASE_PROJECT_ID: 'demo-mtc-asset',
    VITE_FIREBASE_STORAGE_BUCKET: 'demo-mtc-asset.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '400206066339',
    VITE_FIREBASE_APP_ID: '1:400206066339:web:demo',
    VITE_FIREBASE_MEASUREMENT_ID: 'G-DEMO',
};

/**
 * Namespace seed dikunci eksplisit: `e2e/seed-emulator.mjs` menurunkannya dari
 * `.env` lokal, dan `.env` yang menunjuk project lain akan menggeser namespace
 * seed menjauh dari namespace yang dipakai build.
 */
export const E2E_CI_SEED_ENV = { E2E_RTDB_NS: 'mtc-asset-default-rtdb' };

export const E2E_CI_STEPS = [
    {
        label: 'build dist-e2e (env emulator)',
        cmd: 'npx vite build --outDir dist-e2e',
        env: { ...E2E_CI_BUILD_ENV, ...E2E_CI_SEED_ENV },
    },
    {
        label: 'playwright test --workers=1 (E2E_PREVIEW=1)',
        cmd: 'npx playwright test --workers=1',
        env: { ...E2E_CI_SEED_ENV, E2E_PREVIEW: '1' },
    },
];

function main() {
    for (const step of E2E_CI_STEPS) {
        console.log(`\n[e2e:ci] ${step.label}\n[e2e:ci] $ ${step.cmd}`);
        const { status } = spawnSync(step.cmd, {
            stdio: 'inherit',
            shell: true, // `npx`/`.cmd` di Windows hanya resolve lewat shell
            env: { ...process.env, ...step.env },
        });
        if (status !== 0) {
            console.error(`[e2e:ci] gagal: ${step.cmd} (exit ${status ?? 'null'})`);
            process.exit(status ?? 1);
        }
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();