/**
 * Kontrak offline-first (Q-2).
 *
 * Test ini menjaga janji "PWA benar-benar bisa dipakai di site tambang tanpa
 * sinyal" pada level SUMBER — tidak butuh `dist/`, jadi ikut jalan di
 * `npm run test:run` biasa. Yang dijaga adalah hal-hal yang pernah salah dan
 * gagal SENYAP (tidak ada error, cuma rusak saat offline):
 *
 *  - `offline.html` dulu memakai ligatur Material Symbols + Google Fonts,
 *    padahal halaman itu sendiri dilayani SAAT OFFLINE → ikon tampil sebagai
 *    teks ("wifi_off") dan font tidak pernah termuat.
 *  - `offline.html` dulu ter-precache tapi TIDAK PERNAH dilayani: fallback
 *    navigasi hanya menunjuk `/index.html`.
 *  - Rantai fallback `caches.match('/index.html') || caches.match('/')` tidak
 *    pernah mengevaluasi cabang kedua (promise selalu truthy).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf-8');

const sw = read('sw.js');
const offline = read('public/offline.html');
const viteConfig = read('vite.config.js');
const pkg = JSON.parse(read('package.json'));

/** Buang komentar supaya pemeriksaan "tidak ada aset eksternal" tidak salah alarm. */
function stripComments(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Sama, untuk sumber JS: buang baris komentar `//` dan blok `/* *\/`. */
function stripJsComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const offlineCode = stripComments(offline);
/** sw.js tanpa komentar — dipakai untuk asersi NEGATIF, karena komentar di
 *  file itu memang menyebut pola lama & domain Firebase sebagai penjelasan. */
const swCode = stripJsComments(sw);

describe('offline-first — service worker (sw.js)', () => {
  it('CACHE_NAME memakai satu konstanta berversi', () => {
    const m = sw.match(/const CACHE_NAME = '([^']+)'/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/^mtc-asset-v\d+$/);
  });

  it('app shell di-precache lengkap (root, index, manifest, offline)', () => {
    for (const url of ["'/'", "'/index.html'", "'/manifest.json'", "'/offline.html'"]) {
      expect(sw).toContain(url);
    }
  });

  it('menarik daftar aset build dari manifest Workbox', () => {
    expect(sw).toContain('self.__WB_MANIFEST');
    expect(sw).toMatch(/PRECACHE_ASSETS/);
  });

  it('install tidak dibatalkan oleh satu aset gagal (allSettled)', () => {
    expect(sw).toContain('Promise.allSettled');
  });

  it('precache memakai cache: reload supaya fragment basi tidak ikut tersimpan', () => {
    expect(sw).toMatch(/cache: 'reload'/);
  });

  it('navigasi offline punya rantai fallback berurutan sampai offline.html', () => {
    expect(sw).toContain("const OFFLINE_URL = '/offline.html'");
    // Urutan: index.html → '/' → offline.html
    const chain = swCode.match(/match\('\/index\.html'\)[\s\S]{0,400}?match\(OFFLINE_URL\)/);
    expect(chain).not.toBeNull();
    // Bentuk lama yang salah: promise di-`||` sehingga cabang kedua mati.
    expect(swCode).not.toMatch(/match\('\/index\.html'\)\s*\|\|/);
  });

  it('fragment /pages/ tetap network-first dengan no-store', () => {
    expect(sw).toMatch(/url\.includes\('\/pages\/'\)\s*&&\s*url\.endsWith\('\.html'\)/);
    expect(sw).toContain("cache: 'no-store'");
  });

  it('aset ber-hash dilayani cache-first (hemat bandwidth link tambang)', () => {
    expect(sw).toMatch(/const HASHED_ASSET = \/\^\\\/\(assets\|fonts\|icons\)/);
    const at = swCode.indexOf('HASHED_ASSET.test(');
    expect(at).toBeGreaterThan(-1);
    // cache-first: cache dulu, baru jaringan.
    expect(swCode.slice(at, at + 400)).toMatch(
      /caches\.match\(event\.request\)\.then\(\(cached\) => cached \|\| fetch/,
    );
  });

  it('TIDAK menambahkan runtime cache untuk Firebase RTDB (SDK sudah offline-capable)', () => {
    // RTDB lewat WebSocket, bukan fetch → aturan cache di sini hanya dead code,
    // dan menaruh data terautentikasi di Cache Storage itu salah.
    expect(swCode).not.toMatch(/firebasedatabase\.app|firebaseio\.com/);
    expect(sw).toContain('CATATAN AUDIT (Q-2)');
  });
});

describe('offline-first — halaman offline (public/offline.html)', () => {
  it('tidak menarik aset eksternal apa pun', () => {
    expect(offlineCode).not.toMatch(/https?:\/\//);
    expect(offlineCode).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdnjs|unpkg|jsdelivr/);
  });

  it('tidak memakai ligatur Material Symbols (ikon wajib inline SVG)', () => {
    expect(offlineCode).not.toMatch(/material-symbols-outlined/);
    expect(offlineCode).toContain('<svg');
  });

  it('punya gaya & skrip inline (self-contained)', () => {
    expect(offlineCode).toMatch(/<style>/);
    expect(offlineCode).toMatch(/<script>/);
    expect(offlineCode).not.toMatch(/<script[^>]+src=/);
    expect(offlineCode).not.toMatch(/<link[^>]+stylesheet[^>]+href=["']http/);
  });

  it('berbahasa Indonesia seperti sisa aplikasi', () => {
    expect(offline).toContain('lang="id"');
    expect(offline).toContain('Anda sedang offline');
  });

  it('memberi jalan keluar: tombol coba lagi + auto-kembali saat koneksi pulih', () => {
    expect(offline).toContain('id="retry"');
    expect(offline).toContain('id="back"');
    expect(offline).toMatch(/addEventListener\('online'/);
  });

  it('menghormati prefers-reduced-motion', () => {
    expect(offline).toContain('prefers-reduced-motion');
  });

  it('membedakan "tidak ada sinyal" dari "server tidak terjangkau"', () => {
    // navigator.onLine bisa true padahal server mati — halaman harus jujur
    // soal mana yang bermasalah, bukan sekadar bilang "online".
    expect(offline).toContain('id="hint"');
    expect(offline).toContain('Jaringan aktif');
    expect(offline).toContain('tidak bisa dijangkau');
  });

  it('status koneksi diumumkan ke pembaca layar', () => {
    expect(offline).toMatch(/role="status"/);
    expect(offline).toMatch(/aria-live="polite"/);
  });
});

describe('offline-first — konfigurasi build & penjaga precache', () => {
  it('vite.config.js membundel font & ikon lokal lewat includeAssets', () => {
    expect(viteConfig).toContain("includeAssets:");
    expect(viteConfig).toMatch(/fonts\/\*\.woff2/);
    expect(viteConfig).toMatch(/icons\/\*\.png/);
  });

  it('manifest PWA tetap dimiliki public/manifest.json (tidak dobel)', () => {
    expect(viteConfig).toMatch(/manifest:\s*false/);
  });

  it('precache di-precheck otomatis setelah build', () => {
    expect(pkg.scripts.postbuild).toBe('node scripts/verify-precache.mjs');
    expect(pkg.scripts['verify:precache']).toBe('node scripts/verify-precache.mjs');
    expect(fs.existsSync(path.join(root, 'scripts/verify-precache.mjs'))).toBe(true);
  });

  it('penjaga precache mengaudit bundle, font, ikon, halaman, dan komponen', () => {
    const guard = read('scripts/verify-precache.mjs');
    for (const dir of ['assets', 'fonts', 'icons', 'pages', 'components']) {
      expect(guard).toContain(`'${dir}'`);
    }
    expect(guard).toContain("'offline.html'");
    expect(guard).toContain("'manifest.json'");
  });
});
