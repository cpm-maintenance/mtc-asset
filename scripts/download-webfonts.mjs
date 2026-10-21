/**
 * Unduh webfont (Outfit · Space Grotesk · Inter · JetBrains Mono) ke /public/fonts
 * dan tulis `src/css/fonts.css` — supaya halaman login tidak lagi menyentuh
 * fonts.googleapis.com / fonts.gstatic.com (2 origin + 1 CSS hop di jalur kritis).
 *
 * Jalankan: node scripts/download-webfonts.mjs
 * Subset yang diambil: latin + latin-ext saja (aplikasi berbahasa Indonesia/Inggris).
 * Kalau ada @font-face yang hilang setelah menambah keluarga font baru, tambahkan
 * di FAMILIES — skrip ini satu-satunya sumber `src/css/fonts.css`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** @type {{family: string, axis: string, slug: string}[]} */
const FAMILIES = [
  { family: 'Outfit', axis: 'wght@300..800', slug: 'outfit' },
  { family: 'Space Grotesk', axis: 'wght@300..700', slug: 'space-grotesk' },
  { family: 'Inter', axis: 'wght@400..700', slug: 'inter' },
  { family: 'JetBrains Mono', axis: 'wght@400..600', slug: 'jetbrains-mono' },
];

// Subset yang disimpan: hanya blok unicode-range latin. latin-ext/cyrillic/greek
// dibuang — aplikasi berbahasa Indonesia, tidak ada glyph di luar latin dasar,
// dan tiap subset ikut masuk precache SW (offline) sehingga byte-nya nyata.
const LATIN = /U\+0000-00FF/;

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_FONTS = path.join(ROOT, 'public', 'fonts');
const OUT_CSS = path.join(ROOT, 'src', 'css', 'fonts.css');

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

const faces = [];

for (const { family, axis, slug } of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${axis}&display=swap`;
  const css = await get(url);
  const blocks = css.split('@font-face').slice(1);

  for (const block of blocks) {
    const range = /unicode-range: ([^;]+);/.exec(block)?.[1] || '';
    const subset = LATIN.test(range) ? 'latin' : null;
    if (!subset) continue;

    const src = /url\((https:\/\/[^)]+\.woff2)\)/.exec(block)?.[1];
    if (!src) continue;
    const weight = /font-weight: ([^;]+);/.exec(block)?.[1]?.trim() || '400';
    const style = /font-style: ([^;]+);/.exec(block)?.[1]?.trim() || 'normal';

    const file = `${slug}-${subset}.woff2`;
    await fs.writeFile(path.join(OUT_FONTS, file), await get(src, true));
    const bytes = (await fs.stat(path.join(OUT_FONTS, file))).size;
    faces.push({ family, weight, style, file, range, bytes });
    console.log(`  ${file.padEnd(32)} ${String(bytes).padStart(6)} B  ${family} ${weight} ${subset}`);
  }
}

const css = [
  '/* Di-generate oleh scripts/download-webfonts.mjs — jangan diedit tangan.',
  ' * Font di-self-host supaya jalur kritis login tidak melewati fonts.googleapis.com',
  ' * (CSS lintas-origin + 2 preconnect) dan fonts.gstatic.com. `font-display: swap`',
  ' * membuat teks login langsung tercatak dengan font fallback. */',
  '',
  ...faces.map(
    (f) =>
      `@font-face {\n  font-family: '${f.family}';\n  font-style: ${f.style};\n  font-weight: ${f.weight};\n  font-display: swap;\n  src: url('/fonts/${f.file}') format('woff2');\n  unicode-range: ${f.range};\n}\n`
  ),
].join('\n');

await fs.writeFile(OUT_CSS, css);
const total = faces.reduce((s, f) => s + f.bytes, 0);
console.log(`\n${faces.length} @font-face · ${total} B (${(total / 1024).toFixed(1)} KiB) → ${path.relative(ROOT, OUT_CSS)}`);
