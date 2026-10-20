// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` klaster Work Orders Ledger:
 * backlogAging (800-805), woSectorOf/woSectorOptions (810-822),
 * woFiltered cabang sektor (825-838), woVisible/canLoadMoreWO/loadMoreWO (850-858),
 * woSelected (868-873), woNextInQueue (876-879), woCounts (882-893),
 * woKpi (896-933), woDowntimeSpark (1006-1014).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

const daysAgo = (/** @type {number} */ n) =>
  new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

const LOGS = [
  {
    LogID: 'L1', woNumber: 'WO-1', Status: 'Pending', Jenis: 'Repair', EquipmentID: 'EQ-1',
    Tanggal: daysAgo(10), Downtime: 4, Cost: 1000, dueDate: '2020-01-01', woPriority: 'Emergency',
    PartsUsed: [{ id: 'P1', qty: 2 }, { id: 'P2', qty: 1 }],
  },
  { LogID: 'L2', woNumber: 'WO-2', Status: 'Completed', Jenis: 'Breakdown', EquipmentID: 'EQ-2', Tanggal: daysAgo(2), Downtime: 2, Cost: 500 },
  { LogID: 'L3', woNumber: 'WO-3', Status: 'In Progress', Jenis: 'Repair', EquipmentID: 'EXTERNAL', Tanggal: daysAgo(5), Downtime: 3 },
  { LogID: 'L4', woNumber: 'WO-4', Status: 'Approved', Tanggal: daysAgo(0) },
  { LogID: 'L5', Status: 'Pending', Jenis: 'Repair' },
  { LogID: 'L6', Jenis: 'Inspection' },
];

const EQUIPMENT = [
  { EquipmentID: 'EQ-1', Lokasi: 'Mill' },
  { EquipmentID: 'EQ-2', Lokasi: 'Crusher' },
  { EquipmentID: 'EQ-3' },
];

const PARTS = [
  { PartID: 'P1', Harga: 500 },
  { PartID: 'P2', Harga: 100 },
];

/** @param {Record<string, any>} extra */
const woApp = (extra = {}) =>
  makeApp({ logs: LOGS, equipment: EQUIPMENT, allParts: PARTS, activeWorkOrders: [], ...extra });

beforeEach(() => {
  stubFirebase();
});

describe('backlogAging', () => {
  it('mengelompokkan umur WO ke empat bucket', () => {
    const s = woApp();

    expect(s.backlogAging).toEqual({ '0-1d': 2, '1-3d': 1, '3-7d': 1, '7d+': 1 });
  });

  it('logs kosong: semua bucket nol', () => {
    expect(woApp({ logs: [] }).backlogAging).toEqual({ '0-1d': 0, '1-3d': 0, '3-7d': 0, '7d+': 0 });
  });
});

describe('woSectorOf / woSectorOptions', () => {
  it('memetakan equipment ke Lokasi, plus UNASSIGNED dan EXTERNAL', () => {
    const s = woApp();

    expect(s.woSectorOf('EQ-1')).toBe('Mill');
    expect(s.woSectorOf('EQ-3')).toBe('UNASSIGNED');
    expect(s.woSectorOf('')).toBe('UNASSIGNED');
    expect(s.woSectorOf('EXTERNAL')).toBe('EXTERNAL');
    expect(s.woSectorOf('EQ-404')).toBe('UNASSIGNED');
  });

  it('daftar sektor unik dan terurut', () => {
    expect(woApp().woSectorOptions).toEqual(['Crusher', 'Mill']);
  });
});

describe('woFiltered', () => {
  it('tanpa filter sektor: seluruh WO aktif', () => {
    expect(woApp().woFiltered.map((/** @type {any} */ l) => l.LogID)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
  });

  it('filter sektor menyaring berdasarkan Lokasi equipment', () => {
    const s = woApp({ woSectorFilter: 'Mill' });

    expect(s.woFiltered.map((/** @type {any} */ l) => l.LogID)).toEqual(['L1']);
  });

  it('filter sektor EXTERNAL mengambil WO equipment eksternal', () => {
    const s = woApp({ woSectorFilter: 'EXTERNAL' });

    expect(s.woFiltered.map((/** @type {any} */ l) => l.LogID)).toEqual(['L3']);
  });

  it('hasil di-cache per referensi logs + kunci filter', () => {
    const s = woApp();
    const first = s.woFiltered;
    expect(s.woFiltered).toBe(first);

    s.woSectorFilter = 'Mill';
    expect(s.woFiltered.map((/** @type {any} */ l) => l.LogID)).toEqual(['L1']);
  });
});

describe('woVisible / canLoadMoreWO / loadMoreWO', () => {
  it('memotong sesuai woLimit dan menandai masih ada sisa', () => {
    const s = woApp({ woLimit: 2 });

    expect(s.woVisible).toHaveLength(2);
    expect(s.canLoadMoreWO).toBe(true);

    s.loadMoreWO();
    expect(s.woLimit).toBe(32);
    expect(s.canLoadMoreWO).toBe(false);
  });

  it('loadMoreWO tidak menambah limit saat sudah habis', () => {
    const s = woApp({ woLimit: 99 });

    s.loadMoreWO();

    expect(s.woLimit).toBe(99);
  });

  it('woLimit 0 memakai default 30', () => {
    expect(woApp({ woLimit: 0 }).woVisible).toHaveLength(5);
  });
});

describe('woSelected / woNextInQueue', () => {
  it('tanpa seleksi: null', () => {
    const s = woApp();

    expect(s.woSelected).toBeNull();
  });

  it('WO terpilih dicari di hasil filter', () => {
    expect(woApp({ selectedWODetail: 'L3' }).woSelected.LogID).toBe('L3');
  });

  it('WO di luar hasil filter dicari ulang di seluruh logs', () => {
    expect(woApp({ selectedWODetail: 'L6' }).woSelected.LogID).toBe('L6');
  });

  it('id tak dikenal: null', () => {
    expect(woApp({ selectedWODetail: 'ZZ' }).woSelected).toBeNull();
  });

  it('antrian berikutnya melewati WO terpilih dan yang selesai/batal', () => {
    expect(woApp({ selectedWODetail: 'L1' }).woNextInQueue.LogID).toBe('L3');
  });

  it('antrian kosong: null', () => {
    expect(woApp({ logs: [{ ...LOGS[1] }] }).woNextInQueue).toBeNull();
  });
});

describe('woCounts', () => {
  it('menghitung per status dan mengabaikan log tanpa woNumber', () => {
    const s = woApp();

    expect(s.woCounts).toEqual({ all: 4, Draft: 0, Pending: 1, Approved: 1, 'In Progress': 1, Completed: 1, Cancelled: 0 });
  });

  it('hasil di-cache selama referensi logs tidak berubah', () => {
    const s = woApp();
    const first = s.woCounts;

    expect(s.woCounts).toBe(first);

    s.logs = [...LOGS];
    expect(s.woCounts).not.toBe(first);
  });

  it('lokasi status tak dikenal tetap dihitung di all', () => {
    const s = woApp({ logs: [{ LogID: 'X', woNumber: 'WO-X', Status: 'Archived' }] });

    expect(s.woCounts).toEqual({ all: 1, Draft: 0, Pending: 0, Approved: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 });
  });
});

describe('woKpi', () => {
  it('menghitung MTTR, biaya, downtime, dan pemakaian spare part', () => {
    const s = woApp();

    const kpi = s.woKpi;

    expect(kpi.total).toBe(4);
    expect(kpi.open).toBe(3);
    expect(kpi.inProgress).toBe(1);
    expect(kpi.pending).toBe(1);
    expect(kpi.completed).toBe(1);
    expect(kpi.emergency).toBe(1);
    expect(kpi.overdue).toBe(1);
    expect(kpi.aging).toBe(2);
    // repairs dihitung dari SELURUH logs (termasuk L5 tanpa woNumber): 9 jam / 4 = 2,25 → 2,3
    expect(kpi.mttr).toBe(2.3);
    expect(kpi.downtimeOpen).toBe(7);
    expect(kpi.cost).toBe(1500);
    expect(kpi.partsQty).toBe(3);
    expect(kpi.partsCount).toBe(2);
    expect(kpi.partsValue).toBe(1100);
  });

  it('tanpa data: seluruh angka nol, mttr 0 (bukan NaN)', () => {
    const s = woApp({ logs: [], allParts: [] });

    expect(s.woKpi).toMatchObject({ total: 0, open: 0, mttr: 0, cost: 0, partsQty: 0, partsValue: 0, partsCount: 0 });
  });

  it('hasil di-cache; ganti referensi allParts membangun ulang', () => {
    const s = woApp();
    const first = s.woKpi;

    expect(s.woKpi).toBe(first);

    s.allParts = [...PARTS];
    expect(s.woKpi).not.toBe(first);
  });

  it('spare part dengan PartID tak dikenal tidak menambah nilai', () => {
    const s = woApp({
      logs: [{ LogID: 'L1', woNumber: 'WO-1', Status: 'Pending', Jenis: 'Repair', PartsUsed: [{ id: 'PX', qty: 5 }] }],
      allParts: [],
    });

    expect(s.woKpi.partsQty).toBe(5);
    expect(s.woKpi.partsValue).toBe(0);
  });
});

describe('woDowntimeSpark', () => {
  it('kurang dari 2 titik: string kosong', () => {
    expect(woApp({ performanceData: [{ bd: 1 }] }).woDowntimeSpark).toBe('');
  });

  it('membangun path SVG dari bd + stb empat belas catatan terakhir', () => {
    const perf = [{ bd: 1, stb: 0 }, { bd: 0, stb: 2 }, { bd: 3, stb: 0 }];

    expect(woApp({ performanceData: perf }).woDowntimeSpark).toBe('M0 13 L80 7 L160 2');
  });

  it('nilai kosong dianggap nol, skala minimum 1', () => {
    const perf = [{}, {}];

    expect(woApp({ performanceData: perf }).woDowntimeSpark).toBe('M0 18 L160 18');
  });
});

describe('regresi', () => {
  it('log null tidak membuat getter melempar', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = woApp({ logs: [null, undefined, LOGS[0]] });

    expect(() => [s.backlogAging, s.woCounts, s.woKpi]).not.toThrow();

    err.mockRestore();
  });
});
