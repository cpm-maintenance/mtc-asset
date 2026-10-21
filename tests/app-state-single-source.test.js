// @vitest-environment jsdom
/**
 * Satu sumber untuk setiap kunci state `app()` (kartu `t_cee197a5`).
 *
 * `app()` adalah literal objek yang diakhiri spread 16 modul (`...authModule`,
 * `...logsModule`, …). Object spread: kunci yang datang **belakangan** menang.
 * Jadi setiap kunci yang dideklarasikan di literal DAN di modul membuat
 * deklarasi literal itu **tidak pernah terbaca** — bukan bug yang kelihatan,
 * tapi jebakan: orang berikutnya akan mengubah nilai di literal dan bingung
 * kenapa tidak berefek.
 *
 * S33y membuang tiga duplikat metode (`login`/`logout`/`showUID`); sisa tujuh
 * duplikat state dibuang di kartu ini. Dibuktikan netral lewat snapshot 630
 * kunci `app()` sebelum/sesudah: nol kunci berubah, nol nilai berubah.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const APP_JS = path.join(ROOT, 'src/js/app.js');
const MODULE_DIR = path.join(ROOT, 'src/js/modules');

/** Kata kunci yang ikut tertangkap regex "kunci objek" kalau tidak disaring. */
const NOT_A_KEY = new Set([
    'if', 'for', 'while', 'switch', 'return', 'catch', 'try', 'function',
    'await', 'const', 'let', 'var', 'else', 'do', 'throw',
]);

/** Kunci tingkat-objek: indentasi 4 spasi, lalu `nama:` atau `nama(`. */
const KEY_LINE = /^ {4}(?:async\s+)?(?:get\s+)?([A-Za-z_$][\w$]*)\s*[:(]/gm;
/** Kunci di literal `app()`: indentasi 8 spasi. */
const LITERAL_KEY_LINE = /^ {8}(?:async\s+)?(?:get\s+)?([A-Za-z_$][\w$]*)\s*[:(]/gm;

function keysOf(source, pattern) {
    const out = new Set();
    for (const m of source.matchAll(pattern)) {
        if (!NOT_A_KEY.has(m[1])) out.add(m[1]);
    }
    return out;
}

function moduleKeys() {
    const all = new Map();
    for (const file of fs.readdirSync(MODULE_DIR)) {
        if (!file.endsWith('.js')) continue;
        const keys = keysOf(fs.readFileSync(path.join(MODULE_DIR, file), 'utf-8'), KEY_LINE);
        for (const k of keys) {
            if (!all.has(k)) all.set(k, []);
            all.get(k).push(file);
        }
    }
    // Dua modul di luar folder modules/ juga ikut di-spread oleh app().
    for (const rel of ['src/js/charts.js', 'src/js/error-handler.js']) {
        const keys = keysOf(fs.readFileSync(path.join(ROOT, rel), 'utf-8'), KEY_LINE);
        for (const k of keys) {
            if (!all.has(k)) all.set(k, []);
            all.get(k).push(path.basename(rel));
        }
    }
    return all;
}

describe('literal app() tidak mendeklarasikan ulang kunci milik modul', () => {
    const appSrc = fs.readFileSync(APP_JS, 'utf-8');
    const injectionAt = appSrc.indexOf('// --- MODULE INJECTION ---');

    it('blok MODULE INJECTION masih ada (penanda batas literal)', () => {
        expect(injectionAt).toBeGreaterThan(-1);
    });

    it('setiap kunci literal sebelum MODULE INJECTION tidak dimiliki modul mana pun', () => {
        const literal = keysOf(appSrc.slice(0, injectionAt), LITERAL_KEY_LINE);
        const modules = moduleKeys();
        const duplicates = [...literal]
            .filter((k) => modules.has(k))
            .map((k) => `${k} (literal) vs ${modules.get(k).join(', ')}`)
            .sort();
        expect(duplicates, 'kunci ini dideklarasikan di literal DAN di modul — literalnya mati').toEqual([]);
    });

    it('tujuh kunci yang dibersihkan tidak kembali ke literal', () => {
        const literal = appSrc.slice(0, injectionAt);
        for (const k of [
            'isLogDetailView',
            'selectedEquip',
            'isOnline',
            'loginForm',
            'equipPage',
            'equipLimit',
            'logForm',
        ]) {
            expect(literal, `${k} kembali dideklarasikan di literal app.js`).not.toMatch(
                new RegExp(`^ {8}${k}\\s*[:(]`, 'm')
            );
        }
    });
});
