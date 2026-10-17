import fs from 'node:fs';
import path from 'node:path';

const patterns = [
  /<span class="material-symbols-outlined[^"]*">([^<]+)<\/span>/g,
  /ms:\s*['"]([a-z0-9_]+)['"]/g
];

const filesToScan = [
  'index.html',
  'public/offline.html',
  ...fs.readdirSync('public/pages').filter(f => f.endsWith('.html')).map(f => `public/pages/${f}`),
  'src/js/app.js',
];
const icons = new Set();
for (const file of filesToScan) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf-8');
  for (const p of patterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      const name = m[1].trim();
      if (/^[a-z0-9_]+$/.test(name)) icons.add(name);
    }
  }
}

// Allowlist ligatur di-commit di src/css/icon-subset.txt — sumber kebenaran
// subset font lokal. Kalau ada ikon baru dipakai, skrip ini GAGAL dan menyebut
// namanya, supaya tidak ada ikon yang diam-diam tampil sebagai teks.
const allowPath = 'src/css/icon-subset.txt';
const allow = new Set(
  fs.readFileSync(allowPath, 'utf-8').split('\n').map(s => s.trim()).filter(Boolean)
);

const unknown = [...icons].filter(i => !allow.has(i)).sort();
if (unknown.length) {
  console.error(`Ikon ini belum terdaftar di ${allowPath}:`);
  console.error('  ' + unknown.join('\n  '));
  console.error('Tambahkan ke allowlist, lalu jalankan ulang skrip ini.');
  process.exit(1);
}

const sortedIcons = [...icons].sort();
const textChars = Array.from(new Set(sortedIcons.join(''))).sort().join('');
const textParam = encodeURIComponent(sortedIcons.join(' '));
const cssUrl = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&text=${textParam}`;

console.log(`Collected ${icons.size} unique icon names.`);
console.log('Fetching CSS from Google Fonts...');

const res = await fetch(cssUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

const css = await res.text();
// Ambil URL font (biasanya format truetype saat disubset dengan param &text)
const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('([^']+)'\)/);
if (!match) {
  console.error('Could not find font URL in response:\n', css);
  process.exit(1);
}

const fontUrl = match[1];
const format = match[2];
console.log(`Found font URL (${format}):`, fontUrl);

const fontRes = await fetch(fontUrl);
const fontBuffer = Buffer.from(await fontRes.arrayBuffer());

const outDir = path.resolve(process.cwd(), 'public/fonts');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const ext = format === 'woff2' ? 'woff2' : 'ttf';
const fontFilename = `material-symbols-subset.${ext}`;
const fontPath = path.join(outDir, fontFilename);

fs.writeFileSync(fontPath, fontBuffer);
console.log(`Successfully saved ${fontFilename} (${(fontBuffer.length / 1024).toFixed(1)} KB)`);

// Generate css rule
const cssRule = `@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 100 700;
  font-display: block;
  src: url('/fonts/${fontFilename}') format('${format}');
}
`;
fs.writeFileSync(path.join(outDir, 'material-symbols-local.css'), cssRule);
console.log('Generated material-symbols-local.css');
