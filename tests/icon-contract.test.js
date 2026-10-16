import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../src/js/app.js';

/**
 * Kontrak ikon & design system.
 *
 * Dua hal yang pernah rusak diam-diam di repo ini, dan tes ini menjaganya:
 *
 *  1. **Ligatur di luar subset font lokal** — ikon Material Symbols yang tidak ada
 *     di `src/css/icon-subset.txt` tidak punya glyph di `material-symbols-subset.woff2`,
 *     jadi yang tampil adalah TEKS namanya (mis. "build" bukan ikon). Tidak ada error,
 *     tidak ada test yang gagal — cuma salah tampil. Contoh nyata: `build` di
 *     `Equipment.html`, dan `circle` sebagai fallback `item.ms`.
 *
 *  2. **Sisa design system `stitch-*` / FontAwesome** — sudah tidak dipakai di
 *     halaman mana pun, tapi token & dependensinya masih hidup dan ikut ke bundle.
 *
 * Sumber kebenaran allowlist: `src/css/icon-subset.txt` (di-commit; dikonsumsi
 * `scripts/download-material-symbols.mjs` untuk membangun font subset lokal).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const SUBSET = new Set(
  read('src/css/icon-subset.txt').split('\n').map((s) => s.trim()).filter(Boolean)
);

/** Halaman + komponen yang ikut di-bundle. */
const htmlFiles = [
  'index.html',
  'public/offline.html',
  ...fs.readdirSync(path.join(ROOT, 'public/pages'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => `public/pages/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'public/components/modals'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => `public/components/modals/${f}`),
];

/** Semua nama ligatur yang benar-benar dirender dari sebuah berkas HTML. */
function ligaturesIn(html) {
  const out = new Set();
  for (const m of html.matchAll(/<span class="material-symbols-outlined[^"]*">([^<]+)<\/span>/g)) {
    out.add(m[1].trim());
  }
  return out;
}

describe('kontrak ikon — subset font lokal', () => {
  it('allowlist subset ada dan berisi ligatur', () => {
    expect(SUBSET.size).toBeGreaterThan(50);
    expect([...SUBSET].every((n) => /^[a-z0-9_]+$/.test(n))).toBe(true);
  });

  it('setiap ligatur di halaman/komponen ada di subset lokal', () => {
    const missing = [];
    for (const f of htmlFiles) {
      for (const name of ligaturesIn(read(f))) {
        if (!SUBSET.has(name)) missing.push(`${f}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('setiap entri menu sidebar punya `ms` dari subset lokal', () => {
    const s = app();
    expect(s.menuItems.length).toBeGreaterThan(10);
    for (const item of s.menuItems) {
      expect(item.ms, `menuItems[${item.id}] tanpa ms`).toMatch(/^[a-z0-9_]+$/);
      expect(SUBSET.has(item.ms), `menuItems[${item.id}].ms = ${item.ms}`).toBe(true);
    }
  });

  it('setiap tab Analytics Hub punya `ms` dari subset lokal', () => {
    const s = app();
    expect(s.analyticsTabs.length).toBe(5);
    for (const tab of s.analyticsTabs) {
      expect(tab.ms, `analyticsTabs[${tab.id}] tanpa ms`).toMatch(/^[a-z0-9_]+$/);
      expect(SUBSET.has(tab.ms), `analyticsTabs[${tab.id}].ms = ${tab.ms}`).toBe(true);
    }
  });

  it('fallback `item.ms` di markup juga memakai ligatur yang ada di subset', () => {
    for (const f of htmlFiles) {
      for (const m of read(f).matchAll(/\.ms\s*\|\|\s*'([a-z0-9_]+)'/g)) {
        expect(SUBSET.has(m[1]), `${f}: fallback '${m[1]}' tidak ada di subset`).toBe(true);
      }
    }
  });
});

describe('kontrak ikon — tidak ada sisa FontAwesome', () => {
  const scanned = [...htmlFiles, 'src/js/app.js', 'src/main.js', 'package.json'];

  it('tidak ada tag <i class="fas fa-*"> di halaman/komponen', () => {
    const hits = [];
    for (const f of htmlFiles) {
      for (const m of read(f).matchAll(/<i\s+class="[^"]*\bfa[rsbl]\s+fa-[a-z0-9-]+/g)) {
        hits.push(`${f}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('tidak ada binding `\'fas \' + ...` yang tersisa', () => {
    const hits = htmlFiles.filter((f) => read(f).includes("'fas '"));
    expect(hits).toEqual([]);
  });

  it('tidak ada nilai ikon `fa-*` di sumber JS', () => {
    const hits = [];
    for (const f of scanned.filter((x) => x.endsWith('.js'))) {
      for (const m of read(f).matchAll(/'fa[srbl]?\s+fa-[a-z0-9-]+'|'fa-[a-z0-9-]+'/g)) {
        hits.push(`${f}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('paket @fortawesome tidak lagi jadi dependensi dan tidak di-import', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.dependencies?.['@fortawesome/fontawesome-free']).toBeUndefined();
    expect(pkg.devDependencies?.['@fortawesome/fontawesome-free']).toBeUndefined();
    expect(read('src/main.js')).not.toMatch(/fontawesome/i);
  });
});

describe('kontrak design system — tidak ada sisa `stitch-*`', () => {
  it('namespace `stitch` sudah hilang dari tailwind.config.js', () => {
    // `/\bstitch[-:]/` — token/namespace saja; komentar "Google Stitch project" bukan token.
    expect(read('tailwind.config.js')).not.toMatch(/\bstitch[-:]/i);
  });

  it('token & utility `stitch-*` sudah hilang dari style.css', () => {
    expect(read('src/css/style.css')).not.toMatch(/stitch-/);
  });

  it('tidak ada kelas `stitch-*` yang tersisa di halaman/komponen', () => {
    const hits = [];
    for (const f of htmlFiles) {
      const m = read(f).match(/[\w:/[\]-]*stitch-[a-z0-9-]+/g);
      if (m) hits.push(`${f}: ${[...new Set(m)].join(', ')}`);
    }
    expect(hits).toEqual([]);
  });
});
