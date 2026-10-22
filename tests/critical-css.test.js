/**
 * CSS kritis layar login (kartu `t_4c952280`).
 *
 * `index.html` dulu memuat satu bundel CSS 96,5 KB (16,6 KB gzip) lewat
 * `<link rel="stylesheet">` — render-blocking. Diukur di live dengan
 * `--blocked-url-patterns='*assets/main-*.css'`: FCP 2374 → 1785 ms (median 3
 * run devtools). Perbaikannya: subset Tailwind yang hanya memuat utilitas
 * `index.html` (= markup layar login, fragmen shell belum ada di DOM) digabung
 * dengan token/ikon/font lalu di-inline ke `<head>` oleh plugin build.
 *
 * Tes ini menjaga dua hal yang bisa rusak tanpa error:
 *   1. subset benar-benar memuat kelas layar login (kalau `theme.extend` hilang
 *      karena objek config tidak di-spread, Tailwind mengemit nol utilitas dan
 *      layar login tampil tanpa gaya — tanpa satu pun pesan),
 *   2. subset benar-benar *subset* (kalau `content` tidak terpasang, seluruh
 *      bundel ikut inline dan tes byte tidak berguna lagi).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { buildCriticalCss } from '../scripts/critical-css.mjs';

const ROOT = process.cwd();
const SHELL_FRAGMENT = path.join(ROOT, 'public/pages/app-shell.html');

/** @type {string} */
let critical = '';

beforeAll(async () => {
    critical = await buildCriticalCss();
}, 120_000);

describe('CSS kritis layar login', () => {
    it('memuat utilitas yang dipakai markup login', () => {
        // Kelas dari baris pertama overlay login + header HUD.
        expect(critical).toContain('.bg-tac-surface-base');
        expect(critical).toContain('.px-gutter-desktop');
        expect(critical).toContain('.font-label-mono-md');
        // Anti-flash Alpine dan font ikon ikut, kalau tidak blok x-cloak tampil
        // sebelum Alpine hidup.
        expect(critical).toContain('[x-cloak]');
        expect(critical).toContain('@font-face');
    });

    it('membuang utilitas yang hanya dipakai fragmen shell', () => {
        // Prasyarat: kelas ini memang ada di fragmen shell (jadi tes tidak lulus
        // hanya karena kelasnya tidak dipakai di mana pun).
        expect(fs.readFileSync(SHELL_FRAGMENT, 'utf-8')).toContain('animate-bounce');
        expect(critical).not.toContain('.animate-bounce');
        expect(critical).not.toContain('.backdrop-blur-xl');
    });
});

describe('plugin build', () => {
    const config = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8');

    it('memasang inlineCriticalCssPlugin di daftar plugin', () => {
        expect(config).toMatch(/plugins:\s*\[[^\]]*inlineCriticalCssPlugin\(\)/);
    });

    it('mengubah tautan CSS jadi non-blocking, bukan menghapusnya', () => {
        // media="print" + onload: bundel penuh tetap diunduh (aturan yang tidak
        // masuk subset pulih), tapi tidak lagi menahan paint pertama.
        expect(config).toContain('media="print"');
        expect(config).toContain('onload="this.media=');
        // Tanpa JS (dan untuk crawler) bundel penuh harus tetap ada.
        expect(config).toContain('<noscript>');
    });
});
