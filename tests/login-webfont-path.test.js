/**
 * Kontrak jalur kritis webfont login (S33n).
 *
 * Diukur live (Lighthouse mobile, URL produksi, median 3 run per pola,
 * `--blocked-url-patterns`): audit `critical-request-chains` menaruh jalur paint
 * pertama halaman login sebagai
 *   `main-*.css` (12,9 KB) -> `jetbrains-mono-latin.woff2` (31,7 KB) -> `inter-latin.woff2` (48,6 KB)
 * - 80 KB berurutan + 2 RTT sesudah CSS, sebelum teks login boleh dicat.
 * Harga terukurnya: memblokir kedua webfont menaikkan FCP 170-250 ms,
 * sedangkan memblokir CSS-nya sendiri hanya 69 ms.
 *
 * Perbaikan yang dikunci tes ini: kedua berkas font di-`preload` dari
 * `index.html` supaya diambil PARALEL dengan CSS, bukan sesudahnya. Hasil di
 * kanal preview (6 run): FCP 2269 -> 1965 ms, LCP 3076 -> 2484 ms, perf 91 -> 94,5,
 * byte tetap 260 KiB.
 *
 * Yang SENGAJA tidak dipakai (sudah diukur, 3 run per varian): memindahkan
 * `@font-face` keluar dari bundel CSS lalu memasangnya setelah
 * first-contentful-paint. FCP-nya sama (-330 ms) tapi LCP tidak ikut turun
 * (3065 ms vs 2484 ms preload) dan menambah kedipan font di layar login.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const index = read('index.html');
const mainJs = read('src/main.js');
const fontsCss = read('src/css/fonts.css');

describe('webfont login diambil paralel dengan CSS, bukan sesudahnya', () => {
  it('kedua webfont dipakai layar login dan tetap di-preload dari index.html', () => {
    expect(index).toMatch(
      /<link rel="preload" href="\/fonts\/jetbrains-mono-latin\.woff2" as="font" type="font\/woff2" crossorigin>/
    );
    expect(index).toMatch(
      /<link rel="preload" href="\/fonts\/inter-latin\.woff2" as="font" type="font\/woff2" crossorigin>/
    );
    // preload tanpa crossorigin = unduhan ganda, bukan penghematan
    for (const line of index.match(/<link rel="preload"[^>]*as="font"[^>]*>/g) || []) {
      expect(line, `preload font tanpa crossorigin: ${line}`).toContain('crossorigin');
    }
  });

  it('@font-face tetap satu sumber: src/css/fonts.css di bundel CSS awal', () => {
    expect(mainJs).toMatch(/^import '\.\/css\/fonts\.css';$/m);
    expect(fontsCss).toContain("font-family: 'Inter'");
    expect(fontsCss).toContain("font-family: 'JetBrains Mono'");
    expect(fontsCss).toContain('font-display: swap');
  });

  it('tidak ada varian penundaan @font-face (diukur: LCP tidak turun, kedipan font bertambah)', () => {
    expect(mainJs).not.toMatch(/lazy-font-faces|applyFontFaces/);
    expect(fs.existsSync(path.join(ROOT, 'src/js/lazy-font-faces.js'))).toBe(false);
  });
});
