// Cari jalur kode yang memicu `__/auth/iframe.js` + gapi di halaman login.
// Pakai: node scripts/auth-iframe-probe.mjs [url]
//
// UA mobile WAJIB: Firebase hanya menginisialisasi iframe auth di browser mobile.
// Dengan UA desktop request itu tidak muncul sama sekali — probe yang memakai UA
// default akan menyimpulkan "bersih" secara palsu (pelajaran S33j).
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://mtc-asset.web.app/';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: MOBILE_UA,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');

const hits = [];
cdp.on('Network.requestWillBeSent', (e) => {
  const u = e.request.url;
  if (!/__\/auth\/iframe|apis\.google\.com\/js\/api\.js|gapi/.test(u)) return;
  const st = e.initiator?.stack?.callFrames || [];
  hits.push({
    url: u.split('?')[0].slice(0, 100),
    type: e.initiator?.type,
    stack: st.slice(0, 5).map((f) => `${f.functionName || '(anon)'} @ ${(f.url || '').split('/').pop()}:${f.lineNumber}`),
  });
});

const js = [];
page.on('request', (r) => {
  if (r.url().endsWith('.js')) js.push(r.url().split('/').pop());
});

const t0 = Date.now();
await page.goto(url, { waitUntil: 'networkidle' });
const networkidleMs = Date.now() - t0;
const globals = await page.evaluate(() => ({ alpine: typeof globalThis.Alpine, sentry: typeof globalThis.Sentry }));

console.log(
  JSON.stringify(
    {
      url,
      networkidleMs,
      jsRequests: js.length,
      prodChunk: js.filter((u) => /^prod-/.test(u)),
      authIframeGapiHits: hits.length,
      hits,
      globals,
    },
    null,
    2,
  ),
);
await browser.close();
