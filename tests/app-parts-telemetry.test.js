// @vitest-environment jsdom
/**
 * Tests untuk blok telemetri Spare Parts + helper PM di `src/js/app.js`
 * (baris ~1723-1917): `partKpi`, `partStatusTac`, `partMarkerTac`,
 * `pmStatusTac`, `pmPriorityTac`, `filteredAllParts`, `canLoadMoreParts`,
 * `filteredAllPartsCount`, `loadMoreParts`.
 */
import { describe, it, expect } from 'vitest';
import { makeApp } from './helpers/app-harness.js';

const part = (extra = {}) => ({
  PartID: 'P1', NamaPart: 'Bearing 6205', NamaSingkat: 'BRG', PartNumber: 'PN-1',
  Lokasi: 'Gudang A', Stok: 10, MinStock: 5, Harga: 1000, EquipmentIDs: ['EQ-1'], ...extra,
});

const isoDay = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('app.js: partKpi', () => {
  it('kosong saat belum ada part (healthRate 100)', () => {
    const s = makeApp();
    s.allParts = [];
    expect(s.partKpi).toEqual({
      total: 0, totalValuation: 0, lowCount: 0, criticalCount: 0, optimalCount: 0, healthRate: 100,
    });
  });

  it('menghitung valuasi, stok rendah, kritis, dan optimal', () => {
    const s = makeApp();
    s.allParts = [
      part({ PartID: 'P1', Stok: 10, MinStock: 5, Harga: 1000 }),   // optimal
      part({ PartID: 'P2', Stok: 5, MinStock: 5, Harga: 100 }),     // low (<= min)
      part({ PartID: 'P3', Stok: 0, MinStock: 2, Harga: 50 }),      // low + critical
      part({ PartID: 'P4', Stok: 3, MinStock: 0, Harga: 10 }),      // tanpa min → optimal
      null,                                                          // diabaikan
    ];
    const kpi = s.partKpi;
    expect(kpi.total).toBe(5);
    expect(kpi.totalValuation).toBe(10 * 1000 + 5 * 100 + 0 * 50 + 3 * 10);
    expect(kpi.lowCount).toBe(2);
    expect(kpi.criticalCount).toBe(1);
    expect(kpi.optimalCount).toBe(2);
    expect(kpi.healthRate).toBe(40);
  });

  it('menoleransi field angka berupa string dan kosong', () => {
    const s = makeApp();
    s.allParts = [{ PartID: 'P1', Stok: '4', MinStock: '4', Harga: '250' }];
    const kpi = s.partKpi;
    expect(kpi.totalValuation).toBe(1000);
    expect(kpi.lowCount).toBe(1);
  });
});

describe('app.js: partStatusTac + partMarkerTac', () => {
  it('partStatusTac membedakan standby / emergency / repair / operational', () => {
    const s = makeApp();
    expect(s.partStatusTac(null)).toContain('status-standby');
    expect(s.partStatusTac(part({ Stok: 0, MinStock: 2 }))).toContain('emergency');
    expect(s.partStatusTac(part({ Stok: 2, MinStock: 2 }))).toContain('repair');
    expect(s.partStatusTac(part({ Stok: 9, MinStock: 2 }))).toContain('operational');
    expect(s.partStatusTac(part({ Stok: 0, MinStock: 0 }))).toContain('operational');
  });

  it('partMarkerTac mengembalikan kelas marker sesuai status', () => {
    const s = makeApp();
    expect(s.partMarkerTac(null)).toBe('bg-tac-status-standby');
    expect(s.partMarkerTac(part({ Stok: 0, MinStock: 2 }))).toBe('bg-tac-status-emergency');
    expect(s.partMarkerTac(part({ Stok: 2, MinStock: 2 }))).toBe('bg-tac-status-repair');
    expect(s.partMarkerTac(part({ Stok: 9, MinStock: 2 }))).toBe('bg-tac-status-operational');
  });
});

describe('app.js: pmStatusTac + pmPriorityTac', () => {
  it('pmStatusTac mengembalikan UNKNOWN tanpa data', () => {
    const s = makeApp();
    expect(s.pmStatusTac(null)).toEqual({
      label: 'UNKNOWN',
      badge: 'bg-tac-surface-recessed text-tac-on-surface-variant border-tac-border-subtle',
      marker: 'bg-tac-status-standby',
      icon: 'help',
    });
  });

  it('pmStatusTac menandai OVERDUE untuk pending yang lewat tanggal', () => {
    const s = makeApp();
    const res = s.pmStatusTac({ status: 'pending', date: isoDay(-3) });
    expect(res.label).toBe('OVERDUE');
    expect(res.icon).toBe('warning');
    expect(res.marker).toBe('bg-tac-status-emergency');
  });

  it('pmStatusTac menandai PENDING untuk tanggal mendatang', () => {
    const s = makeApp();
    const res = s.pmStatusTac({ status: 'pending', date: isoDay(3) });
    expect(res.label).toBe('PENDING');
    expect(res.icon).toBe('schedule');
  });

  it('pmStatusTac menandai COMPLETED dan CANCELLED', () => {
    const s = makeApp();
    expect(s.pmStatusTac({ status: 'completed', date: isoDay(-1) }).label).toBe('COMPLETED');
    expect(s.pmStatusTac({ status: 'completed', date: isoDay(-1) }).icon).toBe('check_circle');
    expect(s.pmStatusTac({ status: 'lain', date: isoDay(1) }).label).toBe('CANCELLED');
    expect(s.pmStatusTac({ status: 'lain', date: isoDay(1) }).icon).toBe('block');
  });

  it('pmPriorityTac memetakan high / low / default', () => {
    const s = makeApp();
    expect(s.pmPriorityTac('High').label).toBe('HIGH');
    expect(s.pmPriorityTac('HIGH').badge).toContain('emergency');
    expect(s.pmPriorityTac('low').label).toBe('LOW');
    expect(s.pmPriorityTac('').label).toBe('MED');
    expect(s.pmPriorityTac(undefined).label).toBe('MED');
  });
});

describe('app.js: filteredAllParts + turunannya', () => {
  it('mengembalikan [] untuk allParts yang bukan array', () => {
    const s = makeApp();
    s.allParts = null;
    expect(s.filteredAllParts).toEqual([]);
    s.allParts = { a: 1 };
    expect(s.filteredAllParts).toEqual([]);
    expect(s.filteredAllPartsCount).toBe(0);
    expect(s.canLoadMoreParts).toBe(false);
  });

  it('mencari pada nama, id, nama singkat, part number, dan lokasi', () => {
    const s = makeApp();
    s.allParts = [
      part({ PartID: 'P1', NamaPart: 'Bearing', NamaSingkat: 'BRG', PartNumber: 'PN-1', Lokasi: 'Gudang A' }),
      part({ PartID: 'P2', NamaPart: 'Seal', NamaSingkat: 'SL', PartNumber: 'PN-2', Lokasi: 'Rak B' }),
      null,
    ];
    for (const q of ['bearing', 'p1', 'brg', 'pn-1', 'gudang']) {
      s.searchPart = q;
      expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P1']);
    }
    s.searchPart = '';
    expect(s.filteredAllParts).toHaveLength(2);
  });

  it('memfilter per unit lewat EquipmentIDs array, string tunggal, atau EquipmentID', () => {
    const s = makeApp();
    s.allParts = [
      part({ PartID: 'P1', EquipmentIDs: ['EQ-1', 'EQ-2'] }),
      part({ PartID: 'P2', EquipmentIDs: 'EQ-2' }),
      part({ PartID: 'P3', EquipmentIDs: undefined, EquipmentID: 'EQ-2' }),
      part({ PartID: 'P4' }),
    ];
    s.partFilterEquip = 'EQ-2';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P1', 'P2', 'P3']);
    expect(s.filteredAllPartsCount).toBe(3);
  });

  it('memfilter status low / zero / optimal', () => {
    const s = makeApp();
    s.allParts = [
      part({ PartID: 'P1', Stok: 10, MinStock: 5 }),
      part({ PartID: 'P2', Stok: 5, MinStock: 5 }),
      part({ PartID: 'P3', Stok: 0, MinStock: 2 }),
      part({ PartID: 'P4', Stok: 3, MinStock: 0 }),
    ];
    s.partStatusFilter = 'low';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P2', 'P3']);
    s.partStatusFilter = 'zero';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P3']);
    s.partStatusFilter = 'optimal';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P1', 'P4']);
    s.partStatusFilter = '';
    expect(s.filteredAllParts).toHaveLength(4);
  });

  it('mengurutkan stock_asc, stock_desc, value, dan nama', () => {
    const s = makeApp();
    s.allParts = [
      part({ PartID: 'P1', NamaPart: 'Beta', Stok: 5, Harga: 100 }),
      part({ PartID: 'P2', NamaPart: 'Alpha', Stok: 20, Harga: 10 }),
      part({ PartID: 'P3', NamaPart: 'Gamma', Stok: 1, Harga: 900 }),
    ];
    s.partSortBy = 'stock_asc';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P3', 'P1', 'P2']);
    s.partSortBy = 'stock_desc';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P2', 'P1', 'P3']);
    s.partSortBy = 'value';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P3', 'P1', 'P2']);
    s.partSortBy = 'name';
    expect(s.filteredAllParts.map(p => p.PartID)).toEqual(['P2', 'P1', 'P3']);
  });

  it('memotong hasil sesuai partLimit dan canLoadMoreParts memakai jumlah total', () => {
    const s = makeApp();
    s.allParts = Array.from({ length: 45 }, (_, i) => part({ PartID: `P${i}`, NamaPart: `Part ${i}` }));
    s.partLimit = 30;
    expect(s.filteredAllParts).toHaveLength(30);
    expect(s.filteredAllPartsCount).toBe(45);
    expect(s.canLoadMoreParts).toBe(true);
    s.loadMoreParts();
    expect(s.partLimit).toBe(60);
    expect(s.filteredAllParts).toHaveLength(45);
    expect(s.canLoadMoreParts).toBe(false);
  });

  it('partLimit 0 jatuh ke default 30', () => {
    const s = makeApp();
    s.allParts = Array.from({ length: 45 }, (_, i) => part({ PartID: `P${i}` }));
    s.partLimit = 0;
    expect(s.filteredAllParts).toHaveLength(30);
  });
});
