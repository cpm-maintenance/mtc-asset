// Generate WebP turunan untuk latar login. Jalankan: node scripts/build-login-image.mjs
// Sumber tunggal tetap JPG (fallback untuk browser tanpa WebP).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve(process.cwd(), 'public/img');
const SRC = path.join(DIR, 'login-mill-1600.jpg');
const WIDTHS = [800, 1600];

if (!fs.existsSync(SRC)) {
  console.error('[images] sumber tidak ada:', SRC);
  process.exit(1);
}

const meta = await sharp(SRC).metadata();
console.log('[images] sumber', path.basename(SRC), fs.statSync(SRC).size, 'byte', meta.width + 'x' + meta.height);

for (const w of WIDTHS) {
  const out = path.join(DIR, `login-mill-${w}.webp`);
  await sharp(SRC).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(out);
  console.log('[images]', path.basename(out), fs.statSync(out).size, 'byte');
}
