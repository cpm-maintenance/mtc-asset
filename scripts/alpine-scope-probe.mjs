// Probe: bisakah sebuah elemen host mendapat scope `x-data` miliknya SENDIRI
// sebelum isinya di-inject? Ini akar kegagalan S33q — `Alpine.initTree(host)`
// tidak meng-init `x-data` pada `host` itu sendiri, jadi node fragmen mencari
// scope terdekat dan menemukan `<body x-data="login()">` (gejalanya di aplikasi:
// `sidebarCollapsed is not defined`, `showNotifications is not defined`).
//
// Pakai: node scripts/alpine-scope-probe.mjs
//
// Empat varian dijalankan di halaman terpisah, semuanya meniru bentuk nyata:
//   <body x-data="login()">  →  <div id="host">  →  <span x-text="probeValue">
// Lulus = teks anak menjadi "SCOPE-OK" (artinya ia membaca `app()`, bukan `login()`).
// Catatan keamanan: `innerHTML` di sini hanya memuat string literal milik probe
// sendiri di halaman kosong (setContent), bukan masukan pengguna.
import { chromium } from 'playwright';
import path from 'node:path';

const ALPINE = path.join(process.cwd(), 'node_modules/alpinejs/dist/cdn.min.js');

const PAGE = `<!DOCTYPE html><html><body x-data="login()">
  <div id="host"></div>
</body></html>`;

const VARIANTS = ['control', 'a', 'b', 'c'];

const browser = await chromium.launch();
const rows = [];

for (const variant of VARIANTS) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (/Expression Error|is not defined/.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 60));
  });
  page.on('pageerror', (e) => errors.push('PE:' + String(e).slice(0, 60)));

  await page.setContent(PAGE);
  // `addInitScript` tidak berlaku untuk `setContent` (bukan navigasi), jadi
  // hook ditanam langsung di konteks halaman sebelum skrip Alpine dimuat.
  await page.evaluate(() => {
    // Alpine CDN memanggil `start()` sendiri; `alpine:init` adalah satu-satunya
    // titik untuk mendaftarkan komponen sebelum DOM dievaluasi.
    document.addEventListener('alpine:init', () => {
      /** @type {any} */ const A = globalThis.Alpine;
      A.data('login', () => ({ loginFlag: 1 }));
      A.data('app', () => ({ probeValue: 'SCOPE-OK' }));
    });
  });
  await page.addScriptTag({ path: ALPINE });
  await page.waitForFunction(() => !!globalThis.Alpine?.version);

  const out = await page.evaluate((name) => {
    /** @type {any} */ const A = globalThis.Alpine;
    const host = document.getElementById('host');
    // Markup fragmen: satu node yang hanya bisa di-resolve oleh scope `app()`.
    const CHILD = '<span id="child" x-text="probeValue"></span>';

    if (name === 'control') {
      // Urutan yang dipakai di S33q dan GAGAL: atribut → innerHTML → initTree.
      host.setAttribute('x-data', 'app()');
      host.innerHTML = CHILD;
      A.initTree(host);
    } else if (name === 'a') {
      // Buat scope di host kosong dulu, baru isi.
      host.setAttribute('x-data', 'app()');
      A.initTree(host);
      host.innerHTML = CHILD;
      A.initTree(host);
    } else if (name === 'b') {
      // initTree(document.body) supaya `initNode(host)` ikut jalan.
      host.setAttribute('x-data', 'app()');
      A.initTree(document.body);
      host.innerHTML = CHILD;
      A.initTree(host);
    } else {
      // Tanpa atribut di host; fragmen membawa root `x-data` sendiri.
      host.innerHTML = '<div x-data="app()">' + CHILD + '</div>';
      A.initTree(host);
    }

    return { hostScope: host.getAttribute('x-data') };
  }, variant);

  await page.waitForTimeout(150);
  const text = await page.evaluate(() => (document.getElementById('child')?.textContent || '').trim());
  rows.push({ variant, text, ok: text === 'SCOPE-OK', scope: out.hostScope, errors: errors.slice(0, 1) });
  await page.close();
}

await browser.close();

console.log('| varian | teks anak | scope host terpakai | error |');
console.log('|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.variant} | ${r.text || '(kosong)'} | ${r.ok ? '**YA**' : 'tidak'} | ${r.errors[0] || '-'} |`);
}

const winners = rows.filter((r) => r.ok).map((r) => r.variant);
console.log(winners.length ? `\nLULUS: ${winners.join(', ')}` : '\nGAGAL: tidak ada varian yang memberi scope host');