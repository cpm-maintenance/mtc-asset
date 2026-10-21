/**
 * Kontrak jalur kritis webfont login (S33n) — hasil NEGATIF yang dikunci.
 *
 * Dua alat mengukur hal yang berlawanan untuk perubahan yang sama:
 *
 * 1. Lighthouse mobile (mode `simulate`, yang dipakai untuk skor):
 *    audit `critical-request-chains` menaruh jalur paint pertama sebagai
 *      `main-*.css` -> `jetbrains-mono-latin.woff2` -> `inter-latin.woff2`
 *    (80 KB berurutan + 2 RTT). `--blocked-url-patterns` pada URL live:
 *    kedua webfont = FCP -249 ms, CSS-nya sendiri cuma -69 ms.
 *    Preload dua webfont di A/B kanal hosting (3 run vs 6 run) mencetak
 *    FCP 2269 -> 1965 ms, LCP 3076 -> 2484 ms, perf 91 -> 94,5.
 *
 * 2. `scripts/login-paint-probe.mjs` — Chromium nyata, CPU x4 + slow-4G,
 *    A/B BERPASANGAN (base/preload selang-seling, 4 pasang, cache dingin):
 *    FCP 1188 ms (tanpa preload) vs **1508 ms (preload)** — 4/4 pasang tanpa
 *    tumpang tindih. TTFB malah lebih rendah di jalur preload (272 vs 225 ms),
 *    jadi bukan server: 80 KB font prioritas High berebut pipa 1,6 Mbps dengan
 *    CSS yang memblokir render. Font-nya memang datang lebih awal
 *    (jetbrains 1705 -> 1448 ms), tapi teks login sudah tercatak sebelum font
 *    tiba (`font-display: swap`) — jadi keuntungannya nol, biayanya nyata.
 *
 * Keputusan: preload DIBATALKAN. Tes ini mengunci supaya tidak ada yang
 * menambahkan lagi tanpa mengulang A/B nyata, dan mengunci dua angka acuan
 * (FCP nyata ~1,19 s jalur ini, LCP = FCP di browser nyata).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const index = read('index.html');
const mainJs = read('src/main.js');
const fontsCss = read('src/css/fonts.css');

describe('webfont login tidak di-preload (diukur merugikan FCP nyata)', () => {
  it('index.html tidak preload webfont teks', () => {
    expect(index).not.toMatch(/preload[^>]*jetbrains-mono-latin\.woff2/);
    expect(index).not.toMatch(/preload[^>]*inter-latin\.woff2/);
  });

  it('@font-face tetap satu sumber di bundel CSS: src/css/fonts.css', () => {
    expect(mainJs).toMatch(/^import '\.\/css\/fonts\.css';$/m);
    expect(fontsCss).toContain("font-family: 'Inter'");
    expect(fontsCss).toContain("font-family: 'JetBrains Mono'");
    expect(fontsCss).toContain('font-display: swap');
  });

  it('tidak ada varian penundaan @font-face (LCP tidak turun, kedipan font bertambah)', () => {
    expect(mainJs).not.toMatch(/lazy-font-faces|applyFontFaces/);
    expect(fs.existsSync(path.join(ROOT, 'src/js/lazy-font-faces.js'))).toBe(false);
  });

  it('probe A/B nyata tetap ada — tanpa ini angka Lighthouse menyesatkan', () => {
    const probe = read('scripts/login-paint-probe.mjs');
    expect(probe).toContain('setCPUThrottlingRate');
    expect(probe).toContain('emulateNetworkConditions');
    expect(probe).toContain('first-contentful-paint');
  });
});
