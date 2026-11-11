import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Daftar spare part di kartu daftar Work Order memakan 4–6 baris teks per kartu
 * (nama part + qty digabung satu paragraf) sehingga satu kartu menghabiskan
 * separuh layar. Daftarnya dipindah ke modal detail (tombol PROOF), yang memang
 * tempat melihat rincian.
 *
 * Yang dikunci:
 *   1. kartu daftar tidak lagi merender daftar spares;
 *   2. modal detail tetap punya seksi "Spares terpakai";
 *   3. badge peringatan kekurangan stok TETAP di kartu — itu alarm, bukan daftar.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WO = fs.readFileSync(path.join(ROOT, 'public', 'pages', 'WorkOrders.html'), 'utf-8');

/** Blok kartu daftar: `<article>` pertama di dalam template x-for log. */
const cardBlock = () => {
  const start = WO.indexOf('<article');
  const end = WO.indexOf('</article>', start);
  expect(start, '<article> kartu tidak ditemukan').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return WO.slice(start, end);
};

describe('kartu Work Order — daftar spares dihapus', () => {
  it('kartu tidak lagi merender daftar "Spares: ..."', () => {
    expect(cardBlock()).not.toContain('Spares: ');
    expect(cardBlock()).not.toContain('woParts(log)');
  });

  it('ikon inventory_2 milik baris spares ikut hilang dari kartu', () => {
    expect(cardBlock()).not.toContain('inventory_2');
  });

  it('tidak ada sisa pemakaian woParts(log) di seluruh halaman', () => {
    expect(WO).not.toContain('woParts(log)');
  });
});

describe('modal detail (PROOF) — rincian spares tetap ada', () => {
  it('seksi "Spares terpakai" masih dirender dari woSelected', () => {
    const i = WO.indexOf('Spares terpakai');
    expect(i, 'seksi Spares terpakai hilang').toBeGreaterThan(-1);
    const block = WO.slice(i, i + 900);
    expect(block).toContain('woParts(woSelected)');
    expect(block).toContain('part.qty');
  });
});

describe('alarm kekurangan stok tetap di kartu', () => {
  it('badge "⚠ -N PARTS" masih ada di kartu daftar', () => {
    const card = cardBlock();
    expect(card).toContain('woShortageSummary(log).count > 0');
    expect(card).toMatch(/'⚠ -' \+ woShortageSummary\(log\)\.total \+ ' PARTS'/);
  });
});
