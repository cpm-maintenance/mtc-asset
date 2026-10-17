// @ts-check
/**
 * Regenerasi subset font Material Symbols lokal (offline-first).
 *
 * Kenapa subset: font penuh Material Symbols ~3-4 MB. Yang di-commit hanya
 * ligatur yang benar-benar dipakai aplikasi (`src/css/icon-subset.txt`), jadi
 * yang ikut ter-precache service worker kecil.
 *
 * Kenapa instance TUNGGAL: aplikasi hanya memakai satu instance —
 * `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`
 * (lihat src/css/tactical-icons.css, dan tidak ada satu pun pemakaian
 * 'FILL' 1 di repo). Diminta sebagai RENTANG 4 sumbu
 * (`opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`), Google mengirim font
 * variabel penuh.
 *
 * Kenapa `icon_names=` dan bukan `text=`: `text=` mensubset per KARAKTER, jadi
 * Google tetap mengirim ribuan glyph ikon — 343 KB (variabel) / 276 KB
 * (dipin). `icon_names=` mengirim hanya glyph yang diminta: 10 KB. Ligatur
 * tetap jalan (diverifikasi di browser: 84/84 render, hash piksel unik).
 *
 * Jalankan: `node scripts/download-material-symbols.mjs`
 * Output  : `public/fonts/material-symbols-outlined.woff2` (berkas yang benar-
 *           benar dimuat `src/css/tactical-icons.css`).
 *
 * Kalau ada ikon baru dipakai tapi belum terdaftar di allowlist, skrip ini
 * GAGAL dan menyebut namanya — supaya tidak ada ikon yang diam-diam tampil
 * sebagai teks (tidak ada error, cuma salah tampil).
 */
import fs from 'node:fs';
import path from 'node:path';

const ALLOW_PATH = 'src/css/icon-subset.txt';
const OUT_DIR = path.resolve(process.cwd(), 'public/fonts');
const OUT_FILE = 'material-symbols-outlined.woff2';

// Instance yang benar-benar dipakai UI. Harus sama dengan font-variation-settings
// di src/css/tactical-icons.css — kalau salah satu berubah, ubah keduanya.
const INSTANCE = { opsz: 24, wght: 400, FILL: 0, GRAD: 0 };

const patterns = [
  /<span class="material-symbols-outlined[^"]*">([^<]+)<\/span>/g,
  /ms:\s*['"]([a-z0-9_]+)['"]/g,
];

const filesToScan = [
  'index.html',
  'public/offline.html',
  ...fs.readdirSync('public/pages').filter((f) => f.endsWith('.html')).map((f) => `public/pages/${f}`),
  // Seluruh JS: menu sidebar/analytics memakai field `ms: 'icon_name'` di
  // modul selain app.js, jadi memindai app.js saja membuat ikon itu "tidak
  // terdeteksi" padahal dipakai.
  ...fs
    .readdirSync('src/js', { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.js'))
    .map((f) => `src/js/${f}`),
];

const used = new Set();
for (const file of filesToScan) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf-8');
  for (const p of patterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      const name = m[1].trim();
      if (/^[a-z0-9_]+$/.test(name)) used.add(name);
    }
  }
}

const allow = new Set(
  fs.readFileSync(ALLOW_PATH, 'utf-8').split('\n').map((s) => s.trim()).filter(Boolean),
);

// Penjaga: ikon yang dipakai tapi belum terdaftar = ikon akan tampil sebagai teks.
const unknown = [...used].filter((i) => !allow.has(i)).sort();
if (unknown.length) {
  console.error(`Ikon ini dipakai tapi belum terdaftar di ${ALLOW_PATH}:`);
  console.error('  ' + unknown.join('\n  '));
  console.error('Tambahkan ke allowlist, lalu jalankan ulang skrip ini.');
  process.exit(1);
}

const unused = [...allow].filter((i) => !used.has(i)).sort();
if (unused.length) {
  console.warn(`Catatan: ${unused.length} ligatur di allowlist tidak terdeteksi di sumber:`);
  console.warn('  ' + unused.join(', '));
}

// Font dibangun dari ALLOWLIST (sumber kebenaran yang di-commit), bukan dari
// hasil deteksi — supaya setiap ligatur yang diizinkan dijamin punya glyph.
const icons = [...allow].sort();
const axisParam = `${INSTANCE.opsz},${INSTANCE.wght},${INSTANCE.FILL},${INSTANCE.GRAD}`;
// `icon_names=` — BUKAN `text=`. Ini pengungkit ukuran yang sebenarnya:
// `text=` mensubset berdasarkan KARAKTER, jadi Google tetap mengirim ribuan
// glyph ikon (3.645 glyph / 276 KB untuk 84 ikon). `icon_names=` mengirim
// hanya glyph yang diminta — 112 glyph (84 ikon + 25 huruf + 3 lain) / 10 KB —
// dan ligatur tetap utuh. Diverifikasi di browser: 84/84 nama render sebagai
// ikon, 84 hash piksel unik, 0 tofu.
const cssUrl =
  `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined` +
  `:opsz,wght,FILL,GRAD@${axisParam}&icon_names=${icons.join(',')}`;

console.log(`Allowlist: ${icons.length} ligatur. Instance: @${axisParam}`);
console.log('Fetching CSS from Google Fonts...');

const res = await fetch(cssUrl, {
  // UA lengkap (dengan `Chrome/…`) WAJIB: tanpa itu Google Fonts mengirim
  // `truetype`, bukan woff2 — padahal @font-face di repo ini mendeklarasikan woff2.
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
});
if (!res.ok) {
  console.error(`Google Fonts menolak: HTTP ${res.status}`);
  process.exit(1);
}

const css = await res.text();
const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('([^']+)'\)/);
if (!match) {
  console.error('Tidak menemukan URL font di respons:\n', css.slice(0, 800));
  process.exit(1);
}

const [, fontUrl, format] = match;
if (format !== 'woff2') {
  console.error(`Format yang dikirim '${format}', bukan woff2 — periksa User-Agent.`);
  process.exit(1);
}

const fontBuffer = Buffer.from(await (await fetch(fontUrl)).arrayBuffer());
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const fontPath = path.join(OUT_DIR, OUT_FILE);
const before = fs.existsSync(fontPath) ? fs.statSync(fontPath).size : 0;
fs.writeFileSync(fontPath, fontBuffer);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`Ditulis ${OUT_FILE}: ${kb(fontBuffer.length)}`);
if (before) {
  const delta = fontBuffer.length - before;
  console.log(`  sebelumnya ${kb(before)} → ${delta <= 0 ? '−' : '+'}${kb(Math.abs(delta))}`);
}

// @font-face-nya di-maintain manual di src/css/tactical-icons.css (satu sumber
// dengan utility .icon-*). Skrip ini sengaja TIDAK menulis CSS terpisah: dulu
// ia menghasilkan `material-symbols-local.css` yang tidak pernah dimuat siapa pun.
if (before && fontBuffer.length >= before) {
  console.warn('\nPERINGATAN: font baru tidak lebih kecil. Cek apakah sumbu variabel benar-benar dipin.');
}
console.log('\nLangkah berikut: pastikan src/css/tactical-icons.css memakai font-weight: 400 (statis),');
console.log('lalu jalankan `npm run build` + `node scripts/verify-precache.mjs`.');
