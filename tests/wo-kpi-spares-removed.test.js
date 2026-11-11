import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kartu KPI "Staged Spares & Kits" dihapus.
 *
 * Namanya menyesatkan: tidak ada reservasi stok di aplikasi ini. Angkanya cuma
 * agregat `PartsUsed` dari WO terbuka — duplikat informasi yang sudah ada di
 * kartu WO masing-masing. Grid KPI menyusut 4 → 3 kolom supaya tidak ada slot
 * kosong di desktop.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('KPI Work Orders — kartu Staged Spares dihapus', () => {
  const WO = read('public/pages/WorkOrders.html');
  const APP = read('src/js/app.js');

  it('markup kartu "Staged Spares & Kits" hilang', () => {
    expect(WO).not.toContain('Staged Spares');
    expect(WO).not.toContain('woKpi.partsQty');
    expect(WO).not.toContain('woKpi.partsValue');
    expect(WO).not.toContain('woKpi.partsCount');
  });

  it('grid KPI jadi 3 kolom di layar lebar, bukan 4', () => {
    const i = WO.indexOf('aria-label="KPI work order"');
    expect(i).toBeGreaterThan(-1);
    const tag = WO.slice(i, WO.indexOf('>', i));
    expect(tag).toContain('xl:grid-cols-3');
    expect(tag).not.toContain('xl:grid-cols-4');
  });

  it('tiga kartu KPI tersisa utuh (aktif, MTTR, downtime cost)', () => {
    const start = WO.indexOf('aria-label="KPI work order"');
    const end = WO.indexOf('</section>', start);
    const block = WO.slice(start, end);
    expect(block.match(/<!-- KPI \d/g) || []).toHaveLength(3);
    expect(block).toContain('woKpi.open');
    expect(block).toContain('woKpi.mttr');
    expect(block).toContain('woKpi.cost');
  });

  it('getter woKpi tidak lagi menghitung agregat part', () => {
    expect(APP).not.toContain('partsQty');
    expect(APP).not.toContain('partsValue');
    expect(APP).not.toContain('partsCount');
  });
});
