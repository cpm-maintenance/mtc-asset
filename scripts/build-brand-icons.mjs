// Bangun seluruh aset brand MTC-Asset dari SATU sumber mark.
//
// Pakai: node scripts/build-brand-icons.mjs <sumber.png>
//
// Sumber: PNG dengan latar transparan (idealnya >= 512 px; kalau lebih kecil,
// ikon 512 px akan diperbesar dan terlihat lebih lembut).
//
// Hasil:
//   public/logo.png / logo.webp ................ 192 px, transparan (sidebar, log)
//   public/icons/favicon-196.png ............... 196 px, transparan
//   public/icons/apple-icon-180.png ............ 180 px, latar gelap (iOS tidak suka alpha)
//   public/icons/manifest-icon-192.maskable.png  192 px, latar gelap, mark 60%
//   public/icons/manifest-icon-512.maskable.png  512 px, latar gelap, mark 60%
//   public/icons/mstile-icon-{128,270,558}.png . latar gelap, mark 70%
//
// Warna latar memakai `background_color` manifest (#05070a) supaya ikon
// maskable menyatu dengan splash screen Android.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) {
    console.error('Pakai: node scripts/build-brand-icons.mjs <sumber.png>');
    process.exit(1);
}

const ROOT = process.cwd();
const ICONS = path.join(ROOT, 'public', 'icons');
const BG = { r: 5, g: 7, b: 10, alpha: 1 }; // #05070a — sama dengan manifest
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

mkdirSync(ICONS, { recursive: true });

/** Mark dirapikan tepinya lalu ditempatkan di tengah kanvas persegi. */
const trimmed = await sharp(SRC).trim({ threshold: 1 }).png().toBuffer();
const meta = await sharp(trimmed).metadata();
console.log(`[brand] sumber dirapikan: ${meta.width}x${meta.height}`);

const outputs = [
    ['logo.png', 192, 0.96, CLEAR],
    ['icons/favicon-196.png', 196, 0.98, CLEAR],
    ['icons/apple-icon-180.png', 180, 0.8, BG],
    ['icons/manifest-icon-192.maskable.png', 192, 0.6, BG],
    ['icons/manifest-icon-512.maskable.png', 512, 0.6, BG],
    ['icons/mstile-icon-128.png', 128, 0.7, BG],
    ['icons/mstile-icon-270.png', 270, 0.7, BG],
    ['icons/mstile-icon-558.png', 558, 0.7, BG],
];

for (const [rel, size, ratio, background] of outputs) {
    const inner = Math.max(1, Math.round(size * ratio));
    const mark = await sharp(trimmed)
        .resize(inner, inner, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })
        .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background } })
        .composite([{ input: mark, gravity: 'center' }])
        .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0.6, effort: 10 })
                .toFile(path.join(ROOT, 'public', rel));
}

// WebP untuk sidebar (HTML memakai <source srcset="/logo.webp">).
const webp = await sharp(path.join(ROOT, 'public', 'logo.png')).webp({ quality: 82, effort: 6 }).toBuffer();
writeFileSync(path.join(ROOT, 'public', 'logo.webp'), webp);

// mstile 558x270 (wide) — kanvas lebar, mark di tengah.
const wide = await sharp(trimmed)
    .resize(270, 270, { fit: 'contain', background: CLEAR })
    .toBuffer();
await sharp({ create: { width: 558, height: 270, channels: 4, background: BG } })
    .composite([{ input: wide, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, colours: 256, effort: 10 })
    .toFile(path.join(ICONS, 'mstile-icon-558-270.png'));

console.log(`[brand] ${outputs.length} ikon + logo.webp + mstile lebar ditulis.`);
