#!/usr/bin/env node
// @ts-check
/**
 * verify-precache.mjs — penjaga offline-first (Q-2).
 *
 * Memastikan SETIAP berkas hasil build yang harus tersedia offline benar-benar
 * ada di daftar precache `dist/sw.js`. Tanpa penjaga ini, chunk lazy baru
 * (mis. `xlsx-*.js`, `jspdf-*.js`) bisa lolos dari precache tanpa error apa pun
 * — aplikasi cuma "blank" saat teknisi membuka halaman itu di site tanpa sinyal.
 *
 * Dijalankan otomatis lewat `postbuild`, atau manual:
 *   npm run build && node scripts/verify-precache.mjs
 *
 * Exit code 1 + daftar berkas yang hilang kalau ada yang tidak ter-precache.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.cwd(), 'dist');
const SW = path.join(DIST, 'sw.js');

if (!fs.existsSync(SW)) {
  console.error('[verify-precache] dist/sw.js tidak ada — jalankan `npm run build` dulu.');
  process.exit(1);
}

const sw = fs.readFileSync(SW, 'utf-8');

/**
 * Cek satu URL ada di sumber sw.js (sebagai string literal apa pun bentuk
 * kutipnya). Cara ini tahan terhadap perbedaan format hasil minify.
 *
 * Entri `__WB_MANIFEST` dari Workbox ditulis RELATIF (`assets/main-X.js`,
 * `pages/X.html`) sedangkan daftar app shell di sw.js ditulis absolut
 * (`/index.html`). Keduanya sah — `new Request(<relatif>)` di dalam service
 * worker di-resolve terhadap URL /sw.js, jadi hasilnya URL absolut yang sama.
 * Karena itu kedua bentuk diterima.
 * @param {string} url
 */
function precached(url) {
  const rel = url.replace(/^\//, '');
  return [url, rel].some((u) => [`"${u}"`, `'${u}'`, '`' + u + '`'].some((lit) => sw.includes(lit)));
}

/** @param {string} dir @param {(f: string) => boolean} [filter] */
function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (!filter || filter(full)) out.push(full);
  }
  return out;
}

/** @param {string} abs */
const toUrl = (abs) => '/' + path.relative(DIST, abs).split(path.sep).join('/');

const targets = [
  // Bundle JS/CSS hasil build — inti dari kartu Q-2.
  ...walk(path.join(DIST, 'assets')),
  // Font ikon lokal: tanpa ini ikon jadi teks saat offline.
  ...walk(path.join(DIST, 'fonts')),
  ...walk(path.join(DIST, 'icons')),
  // App shell + fragment halaman + komponen modal.
  ...walk(path.join(DIST, 'pages')),
  ...walk(path.join(DIST, 'components')),
  path.join(DIST, 'index.html'),
  path.join(DIST, 'offline.html'),
  path.join(DIST, 'manifest.json'),
  path.join(DIST, 'logo.png'),
  path.join(DIST, 'logo.webp'),
  path.join(DIST, 'registerSW.js'),
  path.join(DIST, 'firebase-messaging-sw.js'),
].filter((abs) => fs.existsSync(abs));

const missing = targets.map(toUrl).filter((url) => !precached(url));

if (missing.length > 0) {
  console.error(`[verify-precache] ${missing.length} berkas TIDAK ada di precache dist/sw.js:`);
  for (const url of missing.sort()) console.error('  - ' + url);
  console.error('\nPerbaiki globPatterns/includeAssets di vite.config.js atau daftar app shell di sw.js.');
  process.exit(1);
}

/**
 * Penjaga tautan gantung. `inlineCriticalCssPlugin.generateBundle()` mengganti
 * nama bundel CSS; kalau ada berkas yang masih menyebut nama lama, preload helper
 * mem-intip URL yang tidak ada, hosting SPA membalas `index.html` (`text/html`),
 * dan `import()` dinamis yang bergantung padanya REJECT — fiturnya mati senyap.
 * Kejadian nyata: AuditTrail tidak bisa dibaca maupun ditulis (S53).
 */
const assetNames = new Set(fs.readdirSync(path.join(DIST, 'assets')));
const dangling = {};
for (const abs of walk(DIST, (f) => /\.(?:js|mjs|html|json)$/.test(f))) {
  const src = fs.readFileSync(abs, 'utf-8');
  for (const m of src.matchAll(/assets\/[A-Za-z0-9_.-]+\.(?:css|js)/g)) {
    const name = m[0].slice('assets/'.length);
    if (!assetNames.has(name)) (dangling[m[0]] ||= new Set()).add(path.relative(DIST, abs));
  }
}

if (Object.keys(dangling).length > 0) {
  console.error('[verify-precache] tautan gantung ke aset yang tidak ada di dist:');
  for (const [url, files] of Object.entries(dangling)) {
    console.error(`  - ${url}  ←  ${[...files].join(', ')}`);
  }
  console.error('\n`inlineCriticalCssPlugin` harus menambal nama CSS baru di SEMUA berkas');
  console.error('teks (chunk JS + .html) DAN hook `generateBundle`-nya harus `order: \'post\'`,');
  console.error('kalau tidak Vite menyuntik `__vite__mapDeps` setelah hook kita jalan.');
  process.exit(1);
}

console.log(`[verify-precache] OK — ${targets.length} berkas build semuanya ter-precache.`);
