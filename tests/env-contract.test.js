/**
 * Kontrak `.env.example` ↔ kode.
 *
 * `.env.example` adalah satu-satunya berkas env yang di-commit, jadi ia satu-
 * satunya sumber kebenaran yang bisa diperiksa mesin. Masalah yang pernah
 * terjadi (S53): `VITE_PUSH_PROXY_URL` dipakai `push-client.js` tetapi tidak
 * terdokumentasi, sementara `VITE_ONESIGNAL_APP_ID` masih terdaftar padahal
 * modul OneSignal sudah dihapus — push rusak untuk developer baru tanpa gejala
 * apa pun selain "tidak ada notifikasi".
 *
 * Tes ini mengunci dua arah:
 *  1. setiap `import.meta.env.VITE_*` di `src/**` wajib ada di `.env.example`
 *  2. setiap `VITE_*` di `.env.example` wajib dipakai di `src/**`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = new URL('../', import.meta.url);

/** @param {string} dir @param {string[]} [acc] @returns {string[]} */
function walk(dir, acc = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, acc);
        else if (extname(p) === '.js') acc.push(p);
    }
    return acc;
}

/** Key VITE_* yang benar-benar dibaca kode di `src/`. */
function keysUsedInSrc() {
    const dir = new URL('src/', root).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const used = new Set();
    for (const file of walk(dir)) {
        const text = readFileSync(file, 'utf8');
        for (const m of text.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) used.add(m[1]);
    }
    return used;
}

/** Key yang dideklarasikan di `.env.example`. */
function keysDocumented() {
    const text = readFileSync(new URL('.env.example', root), 'utf8').replace(/\r\n/g, '\n');
    const keys = new Set();
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const m = t.match(/^(VITE_[A-Z0-9_]+)\s*=/);
        if (m) keys.add(m[1]);
    }
    return keys;
}

describe('.env.example — kontrak dengan src/**', () => {
    it('setiap VITE_* yang dipakai kode terdokumentasi di .env.example', () => {
        const used = keysUsedInSrc();
        const documented = keysDocumented();
        const missing = [...used].filter((k) => !documented.has(k)).sort();

        expect(used.size).toBeGreaterThan(0);
        expect(missing).toEqual([]);
    });

    it('setiap VITE_* di .env.example benar-benar dipakai kode', () => {
        const used = keysUsedInSrc();
        const orphan = [...keysDocumented()].filter((k) => !used.has(k)).sort();

        expect(orphan).toEqual([]);
    });

    it('tidak ada lagi key OneSignal (modulnya sudah dihapus)', () => {
        expect([...keysUsedInSrc()].filter((k) => /ONESIGNAL/i.test(k))).toEqual([]);
        expect([...keysDocumented()].filter((k) => /ONESIGNAL/i.test(k))).toEqual([]);
    });

    it('VITE_PUSH_PROXY_URL terdokumentasi (dipakai push-client.js)', () => {
        expect([...keysDocumented()]).toContain('VITE_PUSH_PROXY_URL');
    });

    it('VITE_USE_EMULATORS terdokumentasi (dipakai data-layer.js + firebase-core.js)', () => {
        expect([...keysDocumented()]).toContain('VITE_USE_EMULATORS');
    });
});
