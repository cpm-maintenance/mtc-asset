// Jejak paint pertama halaman login dalam kondisi nyata (bukan simulasi Lantern).
//
// Pakai: node scripts/login-paint-probe.mjs [url]
//
// Menjawab satu pertanyaan: apa yang menahan FCP/LCP pertama di jalur login?
//   - paint timing entries (first-paint / first-contentful-paint)
//   - entri LCP (waktu + elemen + ukuran)
//   - resource timing untuk CSS + font (mulai/selesai relatif navigasi)
//   - long task selama 3 s pertama
//   - isi teks pertama yang benar-benar terlihat pada saat FCP
//
// Throttle: CPU x4 + slow-4G (1,6 Mbps / 150 ms RTT) lewat CDP, jadi angka
// di sini adalah jam dinding, bukan estimasi Lighthouse.
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://mtc-asset.web.app/';
const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  userAgent: UA,
});
// Dua kali muat: run pertama sering melar karena Chromium baru start (bukan
// karakteristik halaman), run kedua yang dipakai untuk membaca jalur kritis.
for (const pass of [1, 2]) {
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
    w.__paint = { paints: [], lcp: [], long: [] };
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) w.__paint.paints.push({ name: e.name, t: Math.round(e.startTime) });
      }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          const el = /** @type {any} */ (e).element;
          w.__paint.lcp.push({
            t: Math.round(e.startTime),
            size: /** @type {any} */ (e).size,
            tag: el?.tagName || null,
            cls: (el?.className || '').toString().slice(0, 60),
            text: (el?.textContent || '').trim().slice(0, 40),
          });
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          w.__paint.long.push({ t: Math.round(e.startTime), d: Math.round(/** @type {any} */ (e).duration) });
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* observer tidak didukung */
    }
  });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const out = await page.evaluate(() => {
    /** @type {any} */ const w = globalThis;
    const nav = performance.getEntriesByType('navigation')[0];
    const navT = nav
      ? {
          ttfb: Math.round(nav.responseStart),
          htmlEnd: Math.round(nav.responseEnd),
          dcl: Math.round(nav.domContentLoadedEventEnd),
          load: Math.round(nav.loadEventEnd),
        }
      : null;
    const res = performance.getEntriesByType('resource').map((r) => ({
      name: /** @type {any} */ (r).name.split('/').pop(),
      type: /** @type {any} */ (r).initiatorType,
      start: Math.round(r.startTime),
      end: Math.round(r.responseEnd),
      size: /** @type {any} */ (r).transferSize,
    }));
    const first = w.__paint.lcp[0];
    let visibleText = null;
    if (first?.tag) {
      visibleText = globalThis.document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 80);
    }
    return {
      paints: w.__paint.paints,
      nav: navT,
      lcp: w.__paint.lcp,
      long: w.__paint.long,
      res: res.filter((r) => /\.css$|\.woff2$|^main-|\/$/.test(r.name) || r.name === 'app-shell.html'),
      loginVisible: (() => {
        const el = globalThis.document.querySelector('[x-show="!isLoggedIn"]');
        if (!el) return 'missing';
        const cs = globalThis.getComputedStyle(el);
        return `${cs.display}/${cs.visibility}`;
      })(),
      visibleText,
      alpine: typeof w.Alpine,
      isLoggedIn: w.isLoggedIn,
    };
  });

  const fcpEntry = out.paints.find((e) => e.name === 'first-contentful-paint');
  const lastLcp = out.lcp[out.lcp.length - 1];
  console.log(
    `SUMMARY pass=${pass} FCP=${fcpEntry ? fcpEntry.t : '?'} LCP=${lastLcp ? lastLcp.t : '?'} ` +
      `ttfb=${out.nav?.ttfb} css=${(out.res.find((r) => /\.css$/.test(r.name)) || {}).end ?? '?'} ` +
      `fonts=${out.res
        .filter((r) => r.name.endsWith('.woff2'))
        .map((r) => `${r.name.split('-')[0]}:${r.end}`)
        .join(',')} ` +
      `longtask=${out.long.filter((l) => l.d > 50).length}`
  );
  console.log(`pass ${pass} · url ${url}  (wall ${Date.now() - t0} ms, CPU x4 + slow-4G)`);
  console.log('nav     ', out.nav);
  console.log('paints  ', out.paints);
  console.log('lcp     ', out.lcp.slice(0, 4));
  console.log('longtask', out.long.filter((l) => l.d > 50).slice(0, 6));
  console.log('login   ', out.loginVisible, '| alpine', out.alpine, '| isLoggedIn', out.isLoggedIn);
  console.log('text    ', JSON.stringify(out.visibleText));
  for (const r of out.res)
    console.log(
      `  net ${String(r.start).padStart(5)}→${String(r.end).padStart(5)} ${String(r.size).padStart(7)}B ${r.type.padEnd(10)} ${r.name}`
    );
  await page.close();
}
await browser.close();
