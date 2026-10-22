// @ts-check
/**
 * critical-css-parity.mjs — bukti bahwa CSS kritis cukup untuk layar login.
 *
 * Membandingkan sidik jari computed style + kotak setiap elemen `body *` antara
 * dua muatan halaman:
 *   A. normal (CSS kritis inline + bundel penuh non-blocking)
 *   B. bundel penuh DIBLOKIR (`route.abort()` pada `assets/main-*.css`)
 *
 * Kalau subset kritis kehilangan satu kelas yang dipakai markup login, selisihnya
 * muncul sebagai baris `full=… crit=…` (background transparan, padding 0, font
 * jatuh ke default). Nol selisih = subset cukup, dan itu bukti yang tidak bisa
 * diberikan oleh tes sumber mana pun.
 *
 * Pakai: node scripts/critical-css-parity.mjs [url]     (default: vite preview)
 */
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4173/';

/** Dijalankan DI DALAM halaman. */
function fingerprint() {
  const doc = globalThis.document;
  const view = globalThis;
  return Array.from(doc.querySelectorAll('body *'))
    .slice(0, 400)
    .map((el, i) => {
      const s = view.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        i,
        tag: el.tagName,
        cls: (el.getAttribute('class') || '').slice(0, 60),
        d: s.display,
        pos: s.position,
        fs: s.fontSize,
        ff: s.fontFamily.slice(0, 18),
        c: s.color,
        bg: s.backgroundColor,
        p: `${s.paddingTop}/${s.paddingLeft}`,
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.x),
        y: Math.round(r.y),
      };
    });
}

const browser = await chromium.launch();

/** @param {boolean} blockCss */
async function collect(blockCss) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  if (blockCss) await ctx.route(/assets\/main-.*\.css/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(fingerprint);
  const fcp = await page.evaluate(() => {
    const e = performance.getEntriesByName('first-contentful-paint')[0];
    return e ? Math.round(e.startTime) : null;
  });
  await ctx.close();
  return { data, errors, fcp };
}

const full = await collect(false);
const crit = await collect(true);
await browser.close();

const diffs = [];
for (let i = 0; i < Math.min(full.data.length, crit.data.length); i++) {
  const a = full.data[i];
  const b = crit.data[i];
  for (const k of Object.keys(a)) {
    if (k === 'i') continue;
    if (a[k] !== b[k]) diffs.push(`${i} ${a.tag}.${a.cls} ${k}: full=${a[k]} crit=${b[k]}`);
  }
}

console.log(`url ${url}`);
console.log(`elemen: full=${full.data.length} kritis=${crit.data.length}`);
console.log(`FCP: full=${full.fcp} ms · kritis-saja=${crit.fcp} ms`);
console.log(`selisih: ${diffs.length}`);
for (const d of diffs.slice(0, 40)) console.log('  ' + d);
if (full.errors.length || crit.errors.length) {
  console.log('pageerror full=', full.errors, 'kritis=', crit.errors);
}
process.exitCode = diffs.length === 0 ? 0 : 1;
