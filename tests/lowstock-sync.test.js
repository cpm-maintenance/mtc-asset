import { describe, it, expect } from 'vitest';
import { app } from '../src/js/app.js';

/**
 * C-2 · Eliminasi duplikasi Low Stock & sinkronkan sumber data.
 *
 * Menguji bahwa seluruh metrik stok kritis di sistem menggunakan
 * Single Source of Truth (`lowStockCount`), sehingga:
 * - `lowStockCount`
 * - `dashAlerts.lowStock`
 * - `calculatedStats.lowStock.value`
 * - `heroHUD.pm (Part Low Stock)`
 * Semuanya menghasilkan angka yang 100% konsisten dan identik.
 */
describe('C-2 · Single source of truth for low stock', () => {
  it('semua komponen pembaca metrik stok kritis menghasilkan nilai yang sama persis', () => {
    const s = app();
    s.allParts = [
      { PartID: 'P1', Stok: 2, MinStock: 5 },   // low
      { PartID: 'P2', Stok: 4, MinStock: 4 },   // low
      { PartID: 'P3', Stok: 10, MinStock: 5 },  // normal
      { PartID: 'P4', Stok: 0, MinStock: 0 },   // no min stock
    ];

    const count = s.lowStockCount;
    expect(count).toBe(2);
    expect(s.dashAlerts.lowStock).toBe(count);
    expect(s.calculatedStats.lowStock.value).toBe(count);
    expect(s.badgeCount('parts')).toBe(count);
  });
});
