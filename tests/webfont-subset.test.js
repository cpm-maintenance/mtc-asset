/**
 * Kontrak subset webfont (S33n).
 *
 * Diukur (byte transfer nyata, sebelum → sesudah):
 *   outfit        32.292 → 24.088 B
 *   space-grotesk 22.288 → 15.720 B
 *   inter         48.256 → 32.612 B
 *   jetbrains     31.432 → 26.560 B
 *   total        131,1 KiB → 96,7 KiB (−34,4 KiB)
 *
 * Yang dikunci tes ini:
 *   1. setiap @font-face meng-cover ASCII printable + 9 tanda baca yang dipakai
 *      UI (© · – — • … → ± ×) — kalau charset generator berubah sembarangan,
 *      teks UI bisa diam-diam jatuh ke font fallback;
 *   2. berkasnya tetap di bawah plafon ukuran (regresi "latin penuh" ketahuan);
 *   3. nama berkas lama `*-latin.woff2` tidak kembali (kalau kembali, berarti
 *      dist ikut membawa dua salinan webfont yang sama).
 *
 * Piktograf (⏳ ⏰ ⏱ ⚡ ⚠ ✂ ✏ …) memang di luar subset: tidak ada di keempat
 * webfont ini dan dirender font emoji sistem — sama seperti sebelum S33n.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const css = fs.readFileSync(path.join(ROOT, 'src/css/fonts.css'), 'utf-8');
const generator = fs.readFileSync(path.join(ROOT, 'scripts/download-webfonts.mjs'), 'utf-8');

/** @returns {{family:string,file:string,range:string}[]} */
function faces() {
  return css
    .split('@font-face')
    .slice(1)
    // Hanya @font-face yang memuat berkas subset. Sejak S33p generator juga
    // menulis "fallback metrik" (`src: local(...)`, tanpa unicode-range) yang
    // tidak punya berkas dan tidak perlu meng-cover charset.
    .filter((block) => block.includes("url('/fonts/"))
    .map((block) => ({
      family: /font-family: '([^']+)'/.exec(block)?.[1] || '',
      file: /url\('\/fonts\/([^']+)'\)/.exec(block)?.[1] || '',
      range: /unicode-range: ([^;]+);/.exec(block)?.[1]?.trim() || '',
      weight: /font-weight: ([^;]+);/.exec(block)?.[1]?.trim() || '',
      display: /font-display: ([^;]+);/.exec(block)?.[1]?.trim() || '',
    }));
}

function rangeCovers(range, text) {
  const spans = range.split(',').map((raw) => {
    const [a, b] = raw.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
  return [...text].every((ch) => {
    const cp = ch.codePointAt(0);
    return spans.some(([lo, hi]) => cp >= lo && cp <= hi);
  });
}

const REQUIRED = (() => {
  let ascii = '';
  for (let c = 0x20; c <= 0x7e; c++) ascii += String.fromCharCode(c);
  return ascii + '\u00a9\u00b1\u00b7\u00d7\u2013\u2014\u2022\u2026\u2192';
})();

const LOGIN_FONTS = ['inter-subset.woff2', 'jetbrains-mono-subset.woff2'];
const CEILING_KB = 36;
const TOTAL_CEILING_KB = 100;

describe('subset webfont', () => {
  it('empat @font-face ada, semuanya subset bernama `-subset.woff2` dan font-display: swap', () => {
    const f = faces();
    expect(f.map((x) => x.family).sort()).toEqual(['Inter', 'JetBrains Mono', 'Outfit', 'Space Grotesk']);
    for (const x of f) {
      expect(x.file, `${x.family} masih memakai berkas subset lama`).toMatch(/-subset\.woff2$/);
      expect(x.display).toBe('swap');
    }
  });

  it('setiap subset meng-cover ASCII + tanda baca yang dipakai UI', () => {
    for (const x of faces()) {
      expect(rangeCovers(x.range, REQUIRED), `${x.family} tidak meng-cover charset wajib: ${x.range}`).toBe(true);
    }
  });

  it('berkas font ada dan tetap di bawah plafon ukuran', () => {
    let total = 0;
    for (const x of faces()) {
      const p = path.join(ROOT, 'public/fonts', x.file);
      expect(fs.existsSync(p), `berkas hilang: ${x.file}`).toBe(true);
      const kb = fs.statSync(p).size / 1024;
      total += kb;
      expect(kb, `${x.file} ${kb.toFixed(1)} KiB — di atas plafon ${CEILING_KB} KiB`).toBeLessThan(CEILING_KB);
    }
    expect(total).toBeLessThan(TOTAL_CEILING_KB);
  });

  it('dua webfont layar login yang dihemat (Inter 48→33 KB, JetBrains 31→27 KB)', () => {
    for (const name of LOGIN_FONTS) {
      expect(fs.existsSync(path.join(ROOT, 'public/fonts', name)), `${name} hilang`).toBe(true);
    }
    expect(fs.statSync(path.join(ROOT, 'public/fonts/inter-subset.woff2')).size).toBeLessThan(34 * 1024);
    expect(fs.statSync(path.join(ROOT, 'public/fonts/jetbrains-mono-subset.woff2')).size).toBeLessThan(28 * 1024);
  });

  it('subset "latin" penuh tidak kembali diam-diam', () => {
    for (const stale of [
      'outfit-latin.woff2',
      'space-grotesk-latin.woff2',
      'inter-latin.woff2',
      'jetbrains-mono-latin.woff2',
    ]) {
      expect(fs.existsSync(path.join(ROOT, 'public/fonts', stale)), `${stale} kembali ada`).toBe(false);
    }
    // generator wajib memakai subset server-side (`text=`), bukan blok latin penuh
    expect(generator).toMatch(/&text=\$\{encodeURIComponent\(CHARSET\)\}/);
    expect(generator).not.toMatch(/LATIN = \/U\\+0000-00FF\//);
  });
});
