import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak skala tipografi nama part.
 *
 * Nama part pernah dirender dengan `text-headline-md` (18px) di dalam tabel
 * & kartu Spare Parts — lebih besar dari seluruh isi baris lain, sehingga nama
 * panjang seperti "Filter Press Feeding Pump Pemo AISI Seal Spare Part" terpotong
 * ellipsis padahal kolomnya masih luas. Sekarang nama part memakai skala body
 * (`text-body-md`, 14px) supaya sebaris dengan Part Number dan label lain.
 *
 * Aturan: setiap elemen yang merender `p.NamaPart` tidak boleh memakai skala
 * headline — nama part di daftar mana pun setinggi-tingginya skala body.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = path.join(ROOT, 'public', 'pages');

const nameCells = () => {
  const hits = [];
  for (const file of fs.readdirSync(PAGES_DIR)) {
    if (!file.endsWith('.html')) continue;
    const lines = fs.readFileSync(path.join(PAGES_DIR, file), 'utf-8').split('\n');
    lines.forEach((line, i) => {
      if (!line.includes('p.NamaPart')) return;
      // Kelas elemen bisa berada di baris sebelumnya saat atributnya dipisah baris.
      const window = lines.slice(Math.max(0, i - 1), i + 2).join(' ');
      hits.push({ file, line: i + 1, text: window });
    });
  }
  return hits;
};

describe('nama part — skala tipografi tabel & kartu', () => {
  it('tidak ada render p.NamaPart yang memakai skala headline', () => {
    const hits = nameCells();
    expect(hits.length).toBeGreaterThan(0);
    for (const { file, line, text } of hits) {
      expect(text, `${file}:${line}`).not.toMatch(/text-headline-(?:sm|md|lg)/);
    }
  });
});
