// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` klaster All Logs / parts / planning / workload:
 * filteredAllLogsAll (1998-2022), filteredParts (2100-2103),
 * filteredPartsForLog (2105-2121), planningTechList (2135-2139),
 * twActiveWOs / twTechList / twTotalHours / twOverloadCount / twFilteredTechs (2305-2349).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

const LOGS = [
  { LogID: 'L1', EquipmentID: 'EQ-1', Jenis: 'Repair', Tanggal: '2026-01-05' },
  { LogID: 'L2', EquipmentID: 'EQ-2', Jenis: 'Breakdown', Tanggal: '2026-01-20' },
  { LogID: 'L3', EquipmentID: 'EXTERNAL', Jenis: 'Repair', Tanggal: '2026-01-10' },
  { LogID: 'L4', Jenis: 'Repair', Tanggal: '2026-01-11' },
  { LogID: 'L5', EquipmentID: 'EQ-1', Jenis: 'Repair' },
];

const WO = [
  { LogID: 'W1', woNumber: 'WO-1', Status: 'Pending', assignedTo: 'Budi', estimatedHours: 30, Tanggal: '2026-01-05' },
  { LogID: 'W2', woNumber: 'WO-2', Status: 'In Progress', assignedTo: 'Budi', estimatedHours: 20, Tanggal: '2026-01-20' },
  { LogID: 'W3', woNumber: 'WO-3', Status: 'Approved', assignedTo: 'Sari', estimatedHours: 12, Tanggal: '2026-02-01' },
  { LogID: 'W4', woNumber: 'WO-4', Status: 'Completed', assignedTo: 'Sari', estimatedHours: 99, Tanggal: '2026-01-06' },
  { LogID: 'W5', woNumber: 'WO-5', Status: 'Pending', estimatedHours: 5, Tanggal: '2026-01-07' },
];

beforeEach(() => {
  stubFirebase();
});

describe('filteredAllLogsAll', () => {
  it('hanya log equipment nyata (bukan EXTERNAL / tanpa EquipmentID)', () => {
    const s = makeApp({ logs: LOGS });

    expect(s.filteredAllLogsAll.map((/** @type {any} */ l) => l.LogID)).toEqual(['L1', 'L2', 'L5']);
  });

  it('filter tanggal from/to diterapkan', () => {
    const s = makeApp({ logs: LOGS, filterDateFrom: '2026-01-10', filterDateTo: '2026-01-20' });

    expect(s.filteredAllLogsAll.map((/** @type {any} */ l) => l.LogID)).toEqual(['L2']);
  });

  it('log tanpa Tanggal dibuang saat filter tanggal aktif', () => {
    const s = makeApp({ logs: LOGS, filterDateFrom: '2026-01-01' });

    expect(s.filteredAllLogsAll.map((/** @type {any} */ l) => l.LogID)).toEqual(['L1', 'L2']);
  });

  it('filter jenis log', () => {
    const s = makeApp({ logs: LOGS, allLogsJenisFilter: 'Breakdown' });

    expect(s.filteredAllLogsAll.map((/** @type {any} */ l) => l.LogID)).toEqual(['L2']);
  });

  it('logs bukan array: array kosong', () => {
    expect(makeApp({ logs: null }).filteredAllLogsAll).toEqual([]);
  });
});

describe('filteredParts', () => {
  const parts = [
    { PartID: 'P1', EquipmentID: 'EQ-1' },
    { PartID: 'P2', EquipmentID: 'EQ-2' },
    { PartID: 'P3', EquipmentID: 'EQ-1' },
  ];

  it('menyaring part milik equipment terpilih', () => {
    const s = makeApp({ allParts: parts, selectedEquip: { EquipmentID: 'EQ-1' } });

    expect(s.filteredParts.map((/** @type {any} */ p) => p.PartID)).toEqual(['P1', 'P3']);
  });

  it('tanpa equipment terpilih: tidak ada yang cocok', () => {
    expect(makeApp({ allParts: parts, selectedEquip: null }).filteredParts).toEqual([]);
  });

  it('allParts bukan array: array kosong', () => {
    expect(makeApp({ allParts: null }).filteredParts).toEqual([]);
  });
});

describe('filteredPartsForLog', () => {
  const parts = [
    { PartID: 'P-ARR', EquipmentIDs: ['EQ-1', 'EQ-2'] },
    { PartID: 'P-STR', EquipmentIDs: 'EQ-1, EQ-3' },
    { PartID: 'P-ONE', EquipmentID: 'EQ-3' },
    { PartID: 'P-NONE' },
    null,
  ];

  it('tanpa equipmentId di form: seluruh part dikembalikan', () => {
    const s = makeApp({ allParts: parts, logForm: {} });

    expect(s.filteredPartsForLog).toHaveLength(5);
  });

  it('mendukung EquipmentIDs array, string CSV, dan EquipmentID tunggal', () => {
    const s = makeApp({ allParts: parts, logForm: { equipmentId: 'EQ-3' } });

    expect(s.filteredPartsForLog.map((/** @type {any} */ p) => p.PartID)).toEqual(['P-STR', 'P-ONE']);
  });

  it('equipmentId cocok dengan array EquipmentIDs', () => {
    const s = makeApp({ allParts: parts, logForm: { equipmentId: 'EQ-2' } });

    expect(s.filteredPartsForLog.map((/** @type {any} */ p) => p.PartID)).toEqual(['P-ARR']);
  });

  it('logForm tidak ada: seluruh part dikembalikan', () => {
    const s = makeApp({ allParts: parts, logForm: undefined });

    expect(s.filteredPartsForLog).toHaveLength(5);
  });

  it('allParts bukan array: array kosong', () => {
    expect(makeApp({ allParts: 'x' }).filteredPartsForLog).toEqual([]);
  });
});

describe('planningWOs / planningTechList', () => {
  it('memakai logs bila activeWorkOrders kosong, lalu mendaftar teknisi unik terurut', () => {
    const s = makeApp({ logs: WO, activeWorkOrders: [] });

    expect(s.planningWOs).toHaveLength(5);
    expect(s.planningTechList).toEqual(['Budi', 'Sari']);
  });

  it('memakai activeWorkOrders bila tersedia', () => {
    const s = makeApp({ logs: [], activeWorkOrders: [WO[0]] });

    expect(s.planningTechList).toEqual(['Budi']);
  });

  it('tanpa WO: daftar teknisi kosong', () => {
    expect(makeApp({ logs: [], activeWorkOrders: [] }).planningTechList).toEqual([]);
  });
});

describe('twActiveWOs / twTechList', () => {
  it('menyaring WO selesai & batal', () => {
    const s = makeApp({ activeWorkOrders: [...WO, { LogID: 'W6', Status: 'Cancelled', assignedTo: 'Andi' }] });

    expect(s.twActiveWOs.map((/** @type {any} */ w) => w.LogID)).toEqual(['W1', 'W2', 'W3', 'W5']);
    expect(s.twTechList).toEqual(['Budi', 'Sari']);
  });

  it('tanpa activeWorkOrders: kosong (tidak memakai logs)', () => {
    const s = makeApp({ logs: WO, activeWorkOrders: [] });

    expect(s.twActiveWOs).toEqual([]);
    expect(s.twTechList).toEqual([]);
  });
});

describe('twFilteredTechs', () => {
  it('mengelompokkan jam per teknisi, Unassigned untuk WO tanpa teknisi', () => {
    const s = makeApp({ activeWorkOrders: WO });

    expect(s.twFilteredTechs).toEqual([
      { name: 'Budi', wos: [WO[0], WO[1]], totalHours: 50 },
      { name: 'Sari', wos: [WO[2]], totalHours: 12 },
      { name: 'Unassigned', wos: [WO[4]], totalHours: 5 },
    ]);
  });

  it('filter tanggal memotong WO di luar rentang', () => {
    const s = makeApp({ activeWorkOrders: WO, twDateFrom: '2026-01-01', twDateTo: '2026-01-31' });

    expect(s.twFilteredTechs.map((/** @type {any} */ t) => t.name)).toEqual(['Budi', 'Unassigned']);
  });

  it('pencarian nama teknisi tidak peka huruf besar/kecil', () => {
    const s = makeApp({ activeWorkOrders: WO, twSearch: 'SAR' });

    expect(s.twFilteredTechs.map((/** @type {any} */ t) => t.name)).toEqual(['Sari']);
  });

  it('twHideZero membuang teknisi tanpa WO (praktis: hanya grup kosong)', () => {
    const s = makeApp({ activeWorkOrders: WO, twHideZero: true, twSearch: 'zzz' });

    expect(s.twFilteredTechs).toEqual([]);
  });

  it('estimatedHours bukan angka dihitung 0', () => {
    const s = makeApp({ activeWorkOrders: [{ LogID: 'X', Status: 'Pending', assignedTo: 'Budi', estimatedHours: 'abc' }] });

    expect(s.twFilteredTechs[0].totalHours).toBe(0);
  });

  it('teknisi overload (>40 jam) diurutkan lebih dulu', () => {
    const s = makeApp({ activeWorkOrders: WO });

    expect(s.twFilteredTechs[0].name).toBe('Budi');
  });
});

describe('twTotalHours / twOverloadCount', () => {
  it('menjumlahkan jam dan menghitung teknisi di atas 40 jam', () => {
    const s = makeApp({ activeWorkOrders: WO });

    expect(s.twTotalHours).toBe(67);
    expect(s.twOverloadCount).toBe(1);
  });

  it('tanpa WO: nol', () => {
    const s = makeApp({ activeWorkOrders: [] });

    expect(s.twTotalHours).toBe(0);
    expect(s.twOverloadCount).toBe(0);
  });
});
