/**
 * Unduh webfont (Outfit · Space Grotesk · Inter · JetBrains Mono) ke /public/fonts
 * dan tulis `src/css/fonts.css` — supaya halaman login tidak lagi menyentuh
 * fonts.googleapis.com / fonts.gstatic.com (2 origin + 1 CSS hop di jalur kritis).
 *
 * Jalankan: node scripts/download-webfonts.mjs
 *
 * ## Kenapa `&text=` (subset server-side), bukan "latin" penuh
 *
 * Diukur (S33n, byte transfer nyata): subset "latin" Google membawa seluruh
 * Latin-1 + Latin Extended-A yang tidak pernah dipakai aplikasi berbahasa
 * Indonesia. Yang benar-benar dipakai UI ini = ASCII + segelintir tanda baca
 * (© · – — • … → ± ×). Mengirim daftar karakter itu sebagai `text=` memberi:
 *
 *   Inter          48.256 → 33.592 B
 *   JetBrains Mono 31.432 → 26.868 B
 *   (Outfit & Space Grotesk ikut turun; keduanya hanya dipakai setelah login)
 *
 * Total dua webfont layar login turun ~19 KB (24%) — bayar ini nyata di 1,6 Mbps
 * (≈95 ms) dan di setiap install PWA (precache ikut menyimpan woff2).
 *
 * Konsekuensi yang diterima: karakter di luar daftar (mis. huruf beraksen Latin-1
 * yang ditempel pengguna) dirender font berikutnya di stack — glyph per glyph,
 * bukan tofu. Tambahkan ke EXTRA kalau UI benar-benar memakai karakter baru;
 * `tests/webfont-subset.test.js` akan gagal kalau ada karakter teks baru yang
 * tidak tercover.
 *
 * Kalau ada @font-face yang hilang setelah menambah keluarga font baru, tambahkan
 * di FAMILIES — skrip ini satu-satunya sumber `src/css/fonts.css` dan berkas woff2.
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

// ASCII printable: seluruh teks UI berbahasa Indonesia.
let ASCII = '';
for (let c = 0x20; c <= 0x7e; c++) ASCII += String.fromCharCode(c);

// Tanda baca / simbol yang benar-benar muncul di markup & string UI
// (index.html, public/pages/**, src/**) — bukan tebakan.
const EXTRA = '\u00a9\u00b1\u00b7\u00d7\u2013\u2014\u2022\u2026\u2192';

// Piktograf (emoji) & glyph non-teks sengaja TIDAK diminta: tidak ada di keempat
// webfont ini (⏳⏰⏱ di teks notifikasi, ⚡⚠✂✏ di ikon status), dirender font emoji
// sistem — sama seperti sebelum perubahan. Rentang di bawah juga memuat
// box-drawing (─ ═ dipakai sebagai pemisah di komentar), CJK (hanya di komentar
// berbahasa Mandarin), dan variation selector. Semuanya dikecualikan dari
// peringatan cakupan.
const NON_TEXT_RANGES = [
  [0x1f000, 0x1faff], // emoji
  [0x2300, 0x27bf], // simbol teknis & dingbat (⏳ ⏰ ⏱ ⚡ ⚠ ✂ ✏ ✅)
  [0x2b00, 0x2bff], // panah/simbol tambahan
  [0x2500, 0x257f], // box drawing (─ ═)
  [0x4e00, 0x9fff], // CJK
  [0xfe0f, 0xfe0f], // variation selector-16
];
const isNonText = (cp) => NON_TEXT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);

const CHARSET = [...new Set((ASCII + EXTRA).split(''))].join('');

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_FONTS = path.join(ROOT, 'public', 'fonts');
const OUT_CSS = path.join(ROOT, 'src', 'css', 'fonts.css');
const STALE = ['outfit-latin.woff2', 'space-grotesk-latin.woff2', 'inter-latin.woff2', 'jetbrains-mono-latin.woff2'];

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

/** Karakter non-ASCII di berkas teks repo yang tidak ikut diminta ke subset. */
async function unrequestedChars() {
  const dirs = ['src', 'public'];
  const exts = new Set(['.js', '.mjs', '.html', '.css', '.md', '.json', '.txt']);
  const files = [path.join(ROOT, 'index.html')];
  for (const dir of dirs) {
    const walk = async (d) => {
      for (const entry of await fs.readdir(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) await walk(p);
        else if (exts.has(path.extname(entry.name))) files.push(p);
      }
    };
    await walk(path.join(ROOT, dir));
  }
  const found = new Set();
  for (const f of files) {
    const text = await fs.readFile(f, 'utf-8').catch(() => null);
    if (text === null) continue;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp > 0x7e && !CHARSET.includes(ch) && !isNonText(cp)) {
        found.add(`${ch} (${f.slice(ROOT.length + 1)})`);
      }
    }
  }
  return [...found];
}

const faces = [];
const before = new Map();

for (const { family, axis, slug } of FAMILIES) {
  const base = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${axis}&display=swap`;
  const css = await get(`${base}&text=${encodeURIComponent(CHARSET)}`);
  const block = css.split('@font-face').slice(1)[0] || '';
  if (!block) throw new Error(`@font-face tidak ada di respons Google untuk ${family}`);

  const src = /url\((https:\/\/[^)]+)\)/.exec(block)?.[1];
  if (!src) throw new Error(`url woff2 tidak ada di respons Google untuk ${family}`);
  const weight = /font-weight: ([^;]+);/.exec(block)?.[1]?.trim() || '400';
  const style = /font-style: ([^;]+);/.exec(block)?.[1]?.trim() || 'normal';
  // `text=` membuat Google mengirim satu blok dengan unicode-range sempit —
  // itu sumber kebenaran cakupan subset, jangan ditulis tangan.
  const range = /unicode-range: ([^;]+);/.exec(block)?.[1]?.trim() || '';
  if (!range) throw new Error(`unicode-range tidak ada di respons Google untuk ${family}`);

  const file = `${slug}-subset.woff2`;
  const target = path.join(OUT_FONTS, file);
  const oldName = `${slug}-latin.woff2`;
  try {
    before.set(file, (await fs.stat(path.join(OUT_FONTS, oldName))).size);
  } catch {
    /* berkas lama tidak ada (generasi pertama) */
  }

  await fs.writeFile(target, await get(src, true));
  const bytes = (await fs.stat(target)).size;
  faces.push({ family, weight, style, file, range, bytes });
  console.log(
    `  ${file.padEnd(26)} ${String(bytes).padStart(6)} B` +
      (before.has(file) ? `  (sebelumnya ${String(before.get(file)).padStart(6)} B)` : '')
  );
}

for (const stale of STALE) {
  await fs.rm(path.join(OUT_FONTS, stale), { force: true });
}

const css = [
  '/* Di-generate oleh scripts/download-webfonts.mjs — jangan diedit tangan.',
  ' * Font di-self-host supaya jalur kritis login tidak melewati fonts.googleapis.com',
  ' * (CSS lintas-origin + 2 preconnect) dan fonts.gstatic.com. `font-display: swap`',
  ' * membuat teks login langsung tercatak dengan font fallback.',
  ` * Subset: ASCII + ${EXTRA.length} tanda baca yang dipakai UI (dikirim ke Google`,
  ' * sebagai `text=`), jadi berkasnya ~24% lebih kecil dari subset "latin" penuh. */',
  '',
  ...faces.map(
    (f) =>
      `@font-face {\n  font-family: '${f.family}';\n  font-style: ${f.style};\n  font-weight: ${f.weight};\n  font-display: swap;\n  src: url('/fonts/${f.file}') format('woff2');\n  unicode-range: ${f.range};\n}\n`
  ),
].join('\n');

await fs.writeFile(OUT_CSS, css);
const total = faces.reduce((s, f) => s + f.bytes, 0);
const totalBefore = [...before.values()].reduce((s, b) => s + b, 0);
console.log(
  `\n${faces.length} @font-face · ${total} B (${(total / 1024).toFixed(1)} KiB)` +
    (totalBefore ? ` · sebelumnya ${totalBefore} B (${(totalBefore / 1024).toFixed(1)} KiB)` : '') +
    ` → ${path.relative(ROOT, OUT_CSS)}`
);

const missing = await unrequestedChars();
if (missing.length) {
  console.log(`\n⚠️  ${missing.length} karakter non-ASCII di repo TIDAK diminta ke subset:`);
  for (const m of missing.slice(0, 20)) console.log(`   ${m}`);
  console.log('   Kalau karakter itu muncul di teks UI, tambahkan ke EXTRA lalu jalankan ulang.');
}
