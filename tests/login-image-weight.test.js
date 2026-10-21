/**
 * Kontrak bobot halaman login: gambar yang tersembunyi di mobile tidak boleh
 * ikut terunduh.
 *
 * Lighthouse live mobile (S33f) mencatat `offscreen-images` 77 KiB —
 * `login-mill-800.webp` (61,1 KiB) + `logo.png` (16,0 KiB) — padahal kedua
 * elemen itu berada di dalam panel `hidden lg:*` sehingga tidak pernah terlihat
 * di layar kecil. Tanpa `loading="lazy"` browser tetap mengunduhnya.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
// Logo sidebar tinggal di fragmen shell (index.html hanya layar login).
const shell = fs.readFileSync(path.join(ROOT, 'public/pages/app-shell.html'), 'utf-8');
const markup = `${index}\n${shell}`;

/** Ambil tag <img ...> yang memuat `src` tertentu. */
function imgTagWith(src) {
  const tags = markup.match(/<img\b[^>]*>/g) || [];
  const tag = tags.find((t) => t.includes(`src="${src}"`));
  expect(tag, `img ${src} tidak ditemukan`).toBeTruthy();
  return tag;
}

describe('halaman login — gambar panel desktop tidak diunduh di mobile', () => {
  it('hero mill memakai loading="lazy" + fetchpriority rendah', () => {
    const tag = imgTagWith('/img/login-mill-1600.jpg');

    expect(tag).toContain('loading="lazy"');
    expect(tag).toMatch(/fetchpriority="low"/);
  });

  it('logo sidebar memakai loading="lazy"', () => {
    const tag = imgTagWith('/logo.png');

    expect(tag).toContain('loading="lazy"');
  });

  it('hero tetap dekoratif (alt kosong + aria-hidden) supaya a11y tidak berubah', () => {
    const tag = imgTagWith('/img/login-mill-1600.jpg');

    expect(tag).toContain('alt=""');
    expect(tag).toContain('aria-hidden="true"');
  });
});
