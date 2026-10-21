// Ukur muatan jalur kritis login: apakah chunk `prod-*.js` (Sentry) ikut terunduh
// sebelum interaksi pertama? Pakai: node probe-sentry-login.mjs [url]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const page = await ctx.newPage();

const reqs = [];
page.on('request', (r) => reqs.push(r.url()));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const before = reqs.filter((u) => /prod-[\w-]+\.js/.test(u));
const jsBefore = reqs.filter((u) => u.endsWith('.js'));

// interaksi pertama → armSentry harus menyala
await page.mouse.click(200, 400);
await page.waitForTimeout(3000);
const after = reqs.filter((u) => /prod-[\w-]+\.js/.test(u));

const sentryInit = await page.evaluate(() => ({
  sentryGlobal: typeof globalThis.Sentry,
  hasApp: typeof globalThis.Alpine !== 'undefined',
}));

console.log(JSON.stringify({
  url,
  jsRequestsBeforeInteraction: jsBefore.length,
  prodChunkBeforeInteraction: before,
  prodChunkAfterInteraction: after,
  sentryGlobalAfter: sentryInit.sentryGlobal,
  alpineLoaded: sentryInit.hasApp,
  pageErrors: errors,
}, null, 2));

await browser.close();
