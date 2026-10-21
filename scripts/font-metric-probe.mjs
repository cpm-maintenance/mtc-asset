// Kalibrasi fallback metrik (@font-face `size-adjust` + ascent/descent override).
//
// Kenapa: `font-display: swap` membuat teks login tercatak lebih dulu dengan
// font sistem, lalu di-swap ke webfont. Kalau metrik keduanya beda, jumlah
// baris berubah → tiap blok teks tumbuh/menyusut → layout shift TERUKUR
// (CLS 0,027 cache dingin; 0,000 di cache hangat, karena swap tidak terjadi).
// `size-adjust` menormalkan lebar advance fallback, `ascent/descent-override`
// menormalkan tinggi barisnya — hasilnya swap yang tidak menggeser apa pun.
//
// Pakai: node scripts/font-metric-probe.mjs [url]
//
// Keluarannya blok CSS siap tempel (dipakai `src/css/fonts.css`). Angka HARUS
// diukur, jangan dikira-kira: tiap keluarga punya fallback sistem berbeda-beda
// per OS, dan Chromium di tiap platform memilihnya sendiri.
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://mtc-asset.web.app/';

/** Webfont aplikasi (ada di /fonts/*.woff2) → fallback sistem kandidat. */
const TARGETS = [
  { family: 'Inter', slug: 'inter', fallbacks: ['Segoe UI', 'Roboto', 'Arial', 'Helvetica', 'Liberation Sans', 'sans-serif'] },
  { family: 'JetBrains Mono', slug: 'jetbrains-mono', fallbacks: ['Consolas', 'Roboto Mono', 'Courier New', 'ui-monospace', 'monospace'] },
  { family: 'Outfit', slug: 'outfit', fallbacks: ['Segoe UI', 'Roboto', 'Arial', 'sans-serif'] },
  { family: 'Space Grotesk', slug: 'space-grotesk', fallbacks: ['Segoe UI', 'Roboto', 'Arial', 'sans-serif'] },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async (targets) => {
  const doc = globalThis.document;
  // Pastikan semua @font-face aplikasi benar-benar terunduh sebelum diukur.
  for (const t of targets) {
    try {
      await doc.fonts.load(`100px "${t.family}"`);
    } catch { /* keluarga tanpa glyph → biarkan, hasilnya akan NaN */ }
  }
  await doc.fonts.ready;

  const ctx = doc.createElement('canvas').getContext('2d');
  // Korpus: seluruh ASCII yang bisa dicetak — bobot seragam, jadi rasionya
  // mencerminkan advance rata-rata, bukan satu kata kebetulan.
  const CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');

  const measure = (stack) => {
    ctx.font = `400 100px ${stack}`;
    const t = ctx.measureText(CHARS);
    return {
      width: t.width,
      ascent: t.fontBoundingBoxAscent,
      descent: t.fontBoundingBoxDescent,
    };
  };

  const res = {};
  for (const t of targets) {
    const own = measure(`"${t.family}"`);
    if (!own.width) continue;
    const rows = [];
    for (const fb of t.fallbacks) {
      const m = measure(`"${fb}"`);
      if (!m.width) continue;
      rows.push({
        fallback: fb,
        // size-adjust: lebar fallback disetel agar advance-nya sama dengan webfont.
        sizeAdjust: (own.width / m.width) * 100,
        // Override dinyatakan sebagai pecahan em SETELAH size-adjust → bagi lagi.
        ascent: own.ascent / 100 / (own.width / m.width),
        descent: own.descent / 100 / (own.width / m.width),
      });
    }
    res[t.family] = { slug: t.slug, own, rows };
  }
  return res;
}, TARGETS);

await browser.close();

console.log('/* Fallback metrik — diukur oleh scripts/font-metric-probe.mjs');
console.log(' * ui= lebar advance, a/d= tinggi/kedalaman em setelah size-adjust. */\n');
for (const [family, data] of Object.entries(out)) {
  console.log(`/* ${family}: width=${data.own.width.toFixed(1)} ascent=${data.own.ascent} descent=${data.own.descent} */`);
  for (const r of data.rows) {
    console.log(
      `${r.fallback.padEnd(16)} size-adjust: ${r.sizeAdjust.toFixed(2)}%  ` +
        `ascent-override: ${(r.ascent * 100).toFixed(2)}%  descent-override: ${(r.descent * 100).toFixed(2)}%`
    );
  }
  console.log('');
}