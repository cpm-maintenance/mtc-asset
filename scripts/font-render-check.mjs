// Cek glyph mana yang BENAR-BENAR dipakai browser untuk merender teks layar
// login — bukan cek "font-family: Inter" di CSS (itu selalu bilang Inter walau
// glyph-nya jatuh ke font fallback). Pakai CDP `CSS.getPlatformFontsForNode`,
// yang melaporkan font platform nyata per node.
//
// Pakai: node scripts/font-render-check.mjs [url]
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://mtc-asset.web.app/';
const PROBES = [
  ['judul HUD', 'header span.font-label-mono-md', 'JetBrains Mono'],
  ['label form', 'label.font-body-sm', 'Inter'],
  ['teks body', 'p.font-body-sm', 'Inter'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => globalThis.document.fonts.ready);

const cdp = await ctx.newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument', { depth: -1 });

let bad = 0;
for (const [name, selector, expected] of PROBES) {
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) {
    console.log(`  ${name.padEnd(12)} selector tidak ada: ${selector}`);
    continue;
  }
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  const used = fonts.map((f) => `${f.familyName}(${f.glyphCount})`).join(' ');
  const ok = fonts.some((f) => f.familyName === expected);
  if (!ok) bad++;
  console.log(`  ${name.padEnd(12)} ${ok ? 'OK  ' : 'FALLBACK'} ${used}  [harap ${expected}]`);
}
console.log(
  `${url} → ${bad === 0 ? 'SEMUA teks login dirender webfont sendiri' : `${bad} teks jatuh ke font fallback`}`
);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
