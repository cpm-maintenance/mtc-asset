import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { E2E_CI_BUILD_ENV, E2E_CI_SEED_ENV, E2E_CI_STEPS } from '../e2e/run-ci.mjs';

/**
 * Parity CI ↔ lokal untuk E2E.
 *
 * `npm run test:e2e:ci` ada supaya jalur yang hanya berjalan di CI
 * (`E2E_PREVIEW=1` di atas `dist-e2e` ber-env emulator, termasuk 3 tes
 * `css-critical-path` yang di lokal selalu skip) bisa diulang di mesin ini.
 * Nilainya bergantung pada satu hal: env build lokal **identik** dengan step
 * "Build (E2E, emulator)" di `.github/workflows/test.yml`. Kalau keduanya
 * bergeser sendiri-sendiri, suite tetap hijau di satu sisi dan merah di sisi
 * lain tanpa sebab yang terlihat. Tes ini mengunci kesamaan itu.
 */

const NL = String.fromCharCode(10);
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

/** Ambil blok sebuah step di workflow (dipisah `- name:` berikutnya). */
function workflowStep(text, name) {
    const start = text.indexOf(`- name: ${name}`);
    if (start === -1) throw new Error(`step "${name}" tidak ada di workflow`);
    const next = text.indexOf(`${NL}      - name:`, start + 1);
    return text.slice(start, next === -1 ? undefined : next);
}

/** Pasangan KUNCI: nilai (kunci huruf besar semua) dari blok sebuah step. */
function envOf(block) {
    /** @type {Record<string, string>} */
    const env = {};
    // `line.trim()` lebih dulu: workflow ber-CRLF, dan `.` tidak pernah cocok
    // dengan `\r`, jadi `(.*)$` gagal pada baris yang masih membawa CR.
    const re = new RegExp('^([A-Z][A-Z0-9_]*):[ ]*(.*)$');
    for (const line of block.split(NL)) {
        const m = re.exec(line.trim());
        if (m) env[m[1]] = m[2].trim().replace(/^'(.*)'$/, '$1');
    }
    return env;
}

const workflow = read('.github/workflows/test.yml');
const seed = read('e2e/seed-emulator.mjs');
const spec = read('e2e/css-critical-path.spec.js');
const scripts = JSON.parse(read('package.json')).scripts;

describe('parity E2E lokal ↔ CI', () => {
    it('env build lokal sama dengan step "Build (E2E, emulator)" di CI', () => {
        expect(workflowStep(workflow, 'Build (E2E, emulator)')).toContain('npm run build:e2e');
        expect(E2E_CI_BUILD_ENV).toEqual(envOf(workflowStep(workflow, 'Build (E2E, emulator)')));
    });

    it('CI menjalankan suite dengan E2E_PREVIEW=1 satu worker, dan runner menirunya', () => {
        const e2e = workflowStep(workflow, 'E2E tests (full suite)');
        expect(envOf(e2e).E2E_PREVIEW).toBe('1');
        expect(e2e).toContain('npx playwright test --workers=1');

        expect(E2E_CI_STEPS.map((s) => s.cmd)).toEqual([
            'npx vite build --outDir dist-e2e',
            'npx playwright test --workers=1',
        ]);
        expect(E2E_CI_STEPS[0].env).toEqual(expect.objectContaining(E2E_CI_BUILD_ENV));
        expect(E2E_CI_STEPS[1].env.E2E_PREVIEW).toBe('1');
    });

    it('databaseURL memakai host = namespace emulator, bukan projectId', () => {
        const ns = new URL(E2E_CI_BUILD_ENV.VITE_FIREBASE_DATABASE_URL).hostname.split('.')[0];
        // Beda namespace = seed masuk ke tempat lain, app membaca kosong tanpa error.
        expect(ns).toBe(E2E_CI_SEED_ENV.E2E_RTDB_NS);
        expect(ns).toBe('mtc-asset-default-rtdb');
        expect(ns).not.toBe(E2E_CI_BUILD_ENV.VITE_FIREBASE_PROJECT_ID);
        // Default `E2E_RTDB_NS` di seed harus sama, kalau tidak runner harus tahu itu.
        expect(seed).toContain('process.env.E2E_RTDB_NS || nsFromEnv()');
        expect(seed).toContain(`return '${E2E_CI_SEED_ENV.E2E_RTDB_NS}'`);
    });

    it('jalur pengembangan tetap seperti sekarang (dev server, 3 tes CSS di-skip)', () => {
        expect(scripts['test:e2e']).toBe('playwright test');
        expect(scripts['test:e2e:ci']).toBe('node e2e/run-ci.mjs');
        expect(spec).toContain('test.skip(!process.env.E2E_PREVIEW');
    });
});
