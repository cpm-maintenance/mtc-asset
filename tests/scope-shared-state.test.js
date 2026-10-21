// @vitest-environment jsdom
/**
 * Kontrak state bersama antar dua scope Alpine (kartu `t_dcef9e80`).
 *
 * S33u memecah satu root Alpine (`<body x-data="app()">`) menjadi dua:
 * `<body x-data="login()">` + wrapper `<div x-data="app()">` di fragmen shell.
 * Yang ikut pecah bukan cuma markup — **state bersama** juga. Kasus nyata yang
 * lolos ke produksi: toast stack tinggal di `index.html` (scope `login()`),
 * `showNotification()` pasca-login dipanggil dari instance `app()` → dua larik,
 * satu renderer, semua notifikasi setelah login hilang (`4aa993f`).
 *
 * Berkas ini mengunci dua hal:
 *  1. Irisan kunci yang dipakai KEDUA markup harus sama dengan daftar keputusan
 *     di bawah. Kunci irisan baru = tes merah = keputusan harus ditulis dulu.
 *  2. Untuk kunci yang diputuskan "dibagi", penghapusan isinya harus DI TEMPAT
 *     (`splice`), bukan penugasan array baru — penugasan memutus referensi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createLoginScreen } from '../src/js/modules/login.js';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const index = read('index.html');
const shell = read('public/pages/app-shell.html');
const mainJs = read('src/main.js');
const bootstrapJs = read('src/js/bootstrap.js');

const ALPINE_ATTR = /(\bx-[a-z]+(?:[:.][a-z-]+)*|\bx-on:[a-z]+|@[a-zA-Z.:-]+|:[a-zA-Z.-]+)\s*=\s*"([^"]*)"/g;
/** Atribut yang isinya CSS, bukan ekspresi. */
const CSS_ONLY_ATTR = /^x-(transition|cloak|ignore|teleport|id)/;
const JS_KEYWORDS = new Set(
  `if else return true false null undefined new typeof const let var function document window
   Math Date JSON Number String Boolean Array Object console setTimeout setInterval clearInterval
   clearTimeout localStorage parseInt parseFloat isNaN event of in this async await try catch
   throw void delete instanceof`
    .split(/\s+/)
    .filter(Boolean)
);

/**
 * Identifier yang dipakai markup Alpine.
 *
 * Komentar HTML dibuang lebih dulu: tanpa itu `x-data="app()"` di komentar
 * kepala fragmen ikut terhitung sebagai pemakaian nyata.
 */
function alpineIdentifiers(html) {
    const clean = html.replace(/<!--[\s\S]*?-->/g, '');
    const found = new Set();
    for (const m of clean.matchAll(ALPINE_ATTR)) {
        const [, name, value] = m;
        if (CSS_ONLY_ATTR.test(name)) continue;
        const stripped = value
            .replace(/'[^']*'/g, "''")
            .replace(/"[^"]*"/g, '""')
            .replace(/`[^`]*`/g, '``');
        for (const t of stripped.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
            const word = t[0];
            if (JS_KEYWORDS.has(word) || word.startsWith('$')) continue;
            if (stripped.slice(0, t.index).endsWith('.')) continue;
            found.add(word);
        }
    }
    return found;
}

/**
 * Kunci yang muncul di kedua markup, sudah disaring ke kunci yang benar-benar
 * dimiliki objek komponennya — jadi variabel lokal di dalam ekspresi
 * (`note`, `i`, `n` pada `x-for`/lambda) tidak ikut terhitung.
 */
let SHARED = [];
let loginKeys = new Set();
let appKeys = new Set();

beforeAll(() => {
    stubFirebase();
    loginKeys = new Set(Object.keys(createLoginScreen()));
    appKeys = new Set(Object.keys(makeApp()));
    const loginScope = [...alpineIdentifiers(index)].filter((k) => loginKeys.has(k));
    const appScope = [...alpineIdentifiers(shell)].filter((k) => appKeys.has(k));
    SHARED = loginScope.filter((k) => appScope.includes(k)).sort();
});

afterAll(() => {
    vi.restoreAllMocks();
});

/**
 * Keputusan untuk setiap kunci yang hidup di dua scope.
 *
 * - `shared`  : satu referensi, dibagi oleh `__loadApp()` di `main.js`.
 * - `both`    : dua nilai terpisah, TAPI `main.js` wajib menulis keduanya.
 * - `separate`: dua nilai terpisah dengan tugas berbeda — jangan disatukan.
 */
const DECISIONS = {
    notifications: 'shared',
    isLoading: 'both',
    isLoggedIn: 'separate',
};

describe('irisan kunci antar dua scope', () => {
    it('setiap kunci yang dipakai kedua markup punya keputusan', () => {
        const undecided = SHARED.filter((k) => !(k in DECISIONS));
        expect(undecided, 'kunci irisan baru — putuskan dulu: shared / both / separate').toEqual([]);
    });

    it('daftar kunci irisan sama dengan daftar keputusan', () => {
        expect(SHARED).toEqual(Object.keys(DECISIONS).sort());
    });
});

describe('kunci "shared" benar-benar dibagi', () => {
    it('main.js membagi larik notifikasi ke instance app', () => {
        expect(mainJs).toMatch(/loginScreen\.notifications\s*=\s*instance\.notifications;/);
    });

    // Penghapusan yang menugaskan array baru memutus referensi bersama itu, dan
    // gejalanya sama persis dengan bug aslinya: toast berhenti tampil.
    it('ui-core menghapus entri dengan splice, bukan penugasan array baru', () => {
        const uiCore = read('src/js/modules/ui-core.js');
        expect(uiCore).toMatch(/notifications\.splice\(/);
        expect(uiCore).not.toMatch(/this\.notifications\s*=\s*this\.notifications\.filter/);
    });

    it('handler dismiss di index.html juga memakai splice', () => {
        expect(index).toMatch(/notifications\.splice\(/);
        expect(index).not.toMatch(/notifications\s*=\s*notifications\.filter/);
    });

    it('larik yang dibagi tetap satu objek setelah notifikasi kedaluwarsa', () => {
        vi.useFakeTimers();
        try {
            const login = createLoginScreen();
            // Simulasi persis baris di main.js.
            const app = { notifications: login.notifications, showNotification: login.showNotification };
            app.showNotification('kontrak', 'info', 20);
            expect(login.notifications).toHaveLength(1);

            vi.advanceTimersByTime(600);
            expect(app.notifications, 'referensi bersama putus').toBe(login.notifications);
            expect(login.notifications).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('kunci "both" ditulis di kedua sisi', () => {
    it('isLoading ditulis untuk layar login dan untuk instance app', () => {
        expect(mainJs).toMatch(/loginScreen\.isLoading\s*=/);
        expect(bootstrapJs).toMatch(/this\.isLoading\s*=/);
    });
});

describe('kunci "separate" tetap ditulis eksplisit', () => {
    // Dua gate dengan tugas berbeda: overlay login vs shell. Kalau salah satu
    // lupa ditulis saat logout, layar tertinggal di keadaan setengah terbuka.
    it('logout menutup gate login DAN gate shell', () => {
        expect(mainJs).toMatch(/loginScreen\.isLoggedIn\s*=\s*false/);
        expect(mainJs).toMatch(/window\.app\.isLoggedIn\s*=\s*false/);
    });

    it('login membuka gate login setelah shell ter-init', () => {
        const shellAt = mainJs.indexOf('await window.__loadAppShell()');
        const gateAt = mainJs.indexOf('loginScreen.isLoggedIn = true');
        expect(shellAt).toBeGreaterThan(-1);
        expect(gateAt).toBeGreaterThan(-1);
        expect(shellAt).toBeLessThan(gateAt);
    });
});
