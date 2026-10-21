// Gerbang CLS NYATA untuk jalur login (S33p).
//
// Kenapa probe sendiri: mode `simulate` Lighthouse (Lantern) melaporkan
// CLS 0,000–0,013 pada build ini, sementara Chrome dengan throttle sungguhan
// mencatat 0,058–0,073 — jadi angka yang dilacak selama ini adalah versi model,
// bukan versi perangkat. Probe ini mengukur jam dinding: CPU x4 + slow-4G
// lewat CDP, lalu mencatat SETIAP `layout-shift` beserta node penyebabnya.
//
// Pakai:
//   node scripts/cls-probe.mjs [url] [passes] [threshold]
//   default: https://mtc-asset.web.app/  3  0.02
//
// Keluar dengan kode 1 kalau median CLS melewati ambang (dipakai sebagai gate).
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://mtc-asset.web.app/';
const passes = Number(process.argv[3] || 3);
const threshold = Number(process.argv[4] || 0.02);

const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

/** @type {{cls:number, shifts:any[], errors:string[]}[]} */
const results = [];

// Cache HTTP dibagi antar-tab dalam satu browser, jadi pass ke-2 dst hanya
// melihat shift kalau font benar-benar diunduh lagi. CLS yang dilaporkan
// Lighthouse selalu cache DINGIN (profil Chrome baru per run) — probe ini
// menirunya: satu browser baru per pass.
for (let pass = 1; pass <= passes; pass++) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent: UA,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.addInitScript(() => {
    /** @type {any} */ const w = globalThis;
    w.__cls = { shifts: [], errors: [] };
    // Rect dinormalkan jadi angka; node disimpan sebagai deskriptor teks supaya
    // hasilnya bisa dibaca tanpa membawa referensi DOM kembali ke Node.
    const describe = (node) => {
      if (!node) return '(shadow/none)';
      const el = /** @type {any} */ (node.nodeType === 3 ? node.parentElement : node);
      if (!el) return '(text node)';
      const cls = (el.className || '').toString().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      const id = el.id ? `#${el.id}` : '';
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34);
      return `${el.tagName}${id}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`;
    };
    const rect = (r) => (r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : '?');
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          w.__cls.shifts.push({
            t: Math.round(e.startTime),
            v: Number(e.value.toFixed(4)),
            input: e.hadRecentInput,
            sources: (e.sources || []).map((s) => ({
              node: describe(s.node),
              from: rect(s.previousRect),
              to: rect(s.currentRect),
            })),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
      // Korelasi: apa yang SELESAI tepat sebelum shift (font swap, fragmen
      // shell 129 KB, dsb). Tanpa ini, penyebab shift hanya bisa ditebak.
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          const name = e.name.split('/').pop().slice(0, 46);
          w.__cls.jobs.push({
            end: Math.round(e.responseEnd || e.startTime),
            start: Math.round(e.startTime),
            size: e.transferSize || 0,
            name,
          });
        }
      }).observe({ type: 'resource' });
    } catch (err) {
      w.__cls.errors.push(String(err));
    }
    w.__cls.jobs = [];
    w.addEventListener('error', (e) => w.__cls.errors.push(String(e.message)));
  });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'networkidle' });
  // Jeda 3 s: `requestIdleCallback`/prefetch baseline baru jalan setelah itu,
  // tanpa jeda shift yang datang belakangan tidak terlihat.
  await page.waitForTimeout(3000);

  const out = await page.evaluate(() => {
    /** @type {any} */ const w = globalThis;
    const counted = w.__cls.shifts.filter((/** @type {any} */ s) => !s.input);
    return {
      shifts: w.__cls.shifts,
      jobs: w.__cls.jobs,
      cls: Number(counted.reduce((a, /** @type {any} */ s) => a + s.v, 0).toFixed(4)),
      errors: w.__cls.errors,
    };
  });

  results.push(out);
  console.log(`\n=== pass ${pass} · CLS ${out.cls.toFixed(3)} · ${out.shifts.length} shift (wall ${Date.now() - t0} ms)`);
  const top = [...out.shifts].filter((s) => !s.input).sort((a, b) => b.v - a.v).slice(0, 8);
  for (const s of top) {
    console.log(`  t=${String(s.t).padStart(5)}ms  v=${s.v.toFixed(4)}`);
    for (const src of s.sources) console.log(`      ${src.node}\n        ${src.from}  ->  ${src.to}`);
    // Sumber daya yang selesai dalam 1,5 s sebelum shift = kandidat penyebab.
    const near = out.jobs.filter((j) => j.end <= s.t && s.t - j.end < 1500);
    for (const j of near) console.log(`      <- ${String(j.end).padStart(5)}ms ${String(j.size).padStart(7)}B ${j.name}`);
  }
  if (out.errors.length) console.log('  console errors:', out.errors.slice(0, 3));
  await page.close();
  await browser.close();
}

const vals = results.map((r) => r.cls).sort((a, b) => a - b);
const median = vals[Math.floor(vals.length / 2)];
console.log(`\nurl ${url} · CPU x4 + slow-4G nyata · ${passes} pass`);
console.log(`| pass | ${results.map((_, i) => i + 1).join(' | ')} | median | ambang |`);
console.log(`|---|---|---|---|---|`);
console.log(
  `| CLS | ${results.map((r) => r.cls.toFixed(3)).join(' | ')} | **${median.toFixed(3)}** | ${threshold} |`
);

if (median > threshold) {
  console.log(`\nGAGAL: median CLS ${median.toFixed(3)} > ambang ${threshold}`);
  process.exit(1);
}
console.log(`\nLULUS: median CLS ${median.toFixed(3)} <= ambang ${threshold}`);