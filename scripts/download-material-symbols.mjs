import fs from 'node:fs';
import path from 'node:path';

const patterns = [
  /<span class="material-symbols-outlined[^"]*">([^<]+)<\/span>/g,
  /ms:\s*['"]([a-z0-9_]+)['"]/g
];

const filesToScan = [
  'index.html',
  'src/js/app.js',
  'public/pages/Dashboard.html',
  'public/pages/WorkOrders.html',
  'public/pages/SpareParts.html',
  'public/pages/HistoryCard.html',
  'public/pages/Equipment.html',
  'public/pages/EquipmentDetail.html',
  'public/components/modals/QRScannerModal.html'
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

// Tambah icon umum agar tidak ada yang terlewat
[
  'chevron_left', 'chevron_right', 'check_circle', 'error', 'info', 'warning',
  'schedule', 'check', 'close', 'menu', 'more_vert', 'refresh', 'sync',
  'account_circle', 'settings', 'help', 'search', 'home'
].forEach(i => icons.add(i));

const sortedIcons = Array.from(icons).sort();
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
