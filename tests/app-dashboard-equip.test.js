// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` klaster dashboard & equipment:
 * pmEffectiveness (1101-1123), sortedByPriority (1126-1129), topOverdueWO (1132-1137),
 * dashAlerts (1311-1318), dashKPIs (1326-1344), calculatedStats (1347-1367),
 * predictiveAlerts (1378-1413), filteredEquip (1417-1456), canLoadMoreEquip (1459-1464),
 * equipCounts (1468-1477), equipKpi (1480-1491), equipmentTree (1511-1522).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

const isoDaysAgo = (/** @type {number} */ n) =>
  new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
const today = () => new Date().toISOString().split('T')[0];

const EQUIP = [
  { EquipmentID: 'EQ-1', Nama: 'Pump A', Lokasi: 'Mill', Tipe: 'Pump', Status: 'Active', Kritikalitas: 'High', NextPMDate: '2026-02-01' },
  { EquipmentID: 'EQ-2', Nama: 'Crusher B', Lokasi: 'Crusher', Tipe: 'Crusher', Status: 'In Maintenance', Kritikalitas: 'Medium', NextPMDate: '2026-01-15' },
  { EquipmentID: 'EQ-3', Nama: 'Belt C', Kritikalitas: 'Low' },
  null,
];
/** Tanpa entri null: getter dashboard/equipment tidak menjaga `e.EquipmentID`. */
const EQUIP_VALID = EQUIP.filter(Boolean);

beforeEach(() => {
  stubFirebase();
});

describe('pmEffectiveness', () => {
  const pmList = [
    { pmId: 'PM-1', taskName: 'Ganti oli', equipmentId: 'EQ-1', date: '2026-01-01', status: 'completed' },
    { pmId: 'PM-2', taskName: 'Cek belt', equipmentId: 'EQ-2', date: '2026-01-01', status: 'pending' },
    { pmId: 'PM-3', taskName: 'Tanpa tanggal', equipmentId: 'EQ-1', status: 'completed' },
    { pmId: 'PM-4', taskName: 'Tanggal rusak', equipmentId: 'EQ-1', date: 'bogus', status: 'completed' },
    null,
  ];
  const logs = [
    { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-01-05' },
    { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-01-08' },
    { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2025-12-20' }, // sebelum PM: diabaikan
    { EquipmentID: 'EQ-1', Jenis: 'Repair', Tanggal: '2026-01-06' }, // bukan breakdown
    { EquipmentID: 'EQ-2', Jenis: 'Breakdown', Tanggal: '2026-01-06' }, // equipment lain
    { EquipmentID: 'EQ-1', Jenis: 'Breakdown' }, // tanpa tanggal
  ];

  it('menghitung breakdown dalam jendela setelah PM selesai', () => {
    const s = makeApp({ pmList, logs });

    expect(s.pmEffectiveness()).toEqual([
      { pmId: 'PM-1', taskName: 'Ganti oli', equipmentId: 'EQ-1', failures: 2, window: 14 },
    ]);
  });

  it('jendela hari bisa dipersempit', () => {
    const s = makeApp({ pmList, logs });

    expect(s.pmEffectiveness(5)).toEqual([
      { pmId: 'PM-1', taskName: 'Ganti oli', equipmentId: 'EQ-1', failures: 1, window: 5 },
    ]);
  });

  it('hasil dibatasi 10 teratas dan diurutkan menurun', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      pmId: 'PM-' + i, equipmentId: 'EQ-' + i, date: '2026-01-01', status: 'completed',
    }));
    const manyLogs = [
      { EquipmentID: 'EQ-0', Jenis: 'Breakdown', Tanggal: '2026-01-02' },
      ...Array.from({ length: 11 }, (_, i) => ({ EquipmentID: 'EQ-' + (i + 1), Jenis: 'Breakdown', Tanggal: '2026-01-02' })),
  
    ];
    manyLogs.push({ EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-01-03' });
    const s = makeApp({ pmList: many, logs: manyLogs });

    const out = s.pmEffectiveness();

    expect(out).toHaveLength(10);
    expect(out[0].pmId).toBe('PM-1');
    expect(out[0].failures).toBe(2);
    expect(out[1].failures).toBe(1);
  });

  it('data kosong: array kosong', () => {
    expect(makeApp({ pmList: [], logs: [] }).pmEffectiveness()).toEqual([]);
  });
});

describe('sortedByPriority / topOverdueWO', () => {
  it('mengurutkan WO menurut backlog score menurun', () => {
    const logs = [
      { LogID: 'A', woNumber: 'WO-A', Status: 'Pending', Jenis: 'Repair', woPriority: 'Low', Tanggal: isoDaysAgo(1) },
      { LogID: 'B', woNumber: 'WO-B', Status: 'Pending', Jenis: 'Breakdown', woPriority: 'Emergency', Tanggal: isoDaysAgo(30) },
    ];
    const s = makeApp({ logs, activeWorkOrders: [] });

    const out = s.sortedByPriority;

    expect(out).toHaveLength(2);
    expect(out[0]._score).toBeGreaterThanOrEqual(out[1]._score);
    expect(out.every((/** @type {any} */ w) => typeof w._score === 'number')).toBe(true);
  });

  it('topOverdueWO hanya WO belum selesai berumur lebih dari 3 hari', () => {
    const logs = [
      { LogID: 'A', woNumber: 'WO-A', Status: 'Pending', Tanggal: isoDaysAgo(10) },
      { LogID: 'B', woNumber: 'WO-B', Status: 'Completed', Tanggal: isoDaysAgo(20) },
      { LogID: 'C', Status: 'Pending', Tanggal: isoDaysAgo(1) },
      { LogID: 'D', woNumber: 'WO-D', Status: 'Approved', Tanggal: isoDaysAgo(5) },
    ];
    const s = makeApp({ logs });

    expect(s.topOverdueWO.map((/** @type {any} */ w) => w.LogID)).toEqual(['A', 'D']);
    expect(s.topOverdueWO[0]._age).toBeGreaterThan(s.topOverdueWO[1]._age);
  });
});

describe('dashAlerts', () => {
  it('menghitung PM telat, WO aging, dan stok rendah', () => {
    const s = makeApp({
      pmList: [
        { status: 'pending', date: '2020-01-01' },
        { status: 'pending', date: '2999-01-01' },
        { status: 'completed', date: '2020-01-01' },
      ],
      logs: [
        { Status: 'Pending', Tanggal: isoDaysAgo(9) },
        { Status: 'Draft', Tanggal: isoDaysAgo(4) },
        { Status: 'Pending', Tanggal: isoDaysAgo(1) },
        { Status: 'Pending', Tanggal: 'bogus' },
        { Status: 'Pending' },
        { Status: 'Completed', Tanggal: isoDaysAgo(9) },
      ],
      allParts: [
        { MinStock: 5, Stok: 2 },
        { MinStock: 0, isLowStock: true },
        { MinStock: 0, Stok: 1 },
        null,
      ],
    });

    expect(s.dashAlerts).toEqual({ overduePM: 1, agingWO: 2, lowStock: 2 });
  });
});

describe('dashKPIs', () => {
  it('MTTR dari rata-rata downtime breakdown, MTBF dari engine, PA dari performance', () => {
    const s = makeApp({
      logs: [
        { Jenis: 'Breakdown', Downtime: 4 },
        { Jenis: 'Breakdown', Downtime: '6' },
        { Jenis: 'Repair', Downtime: 9 },
      ],
      equipment: EQUIP_VALID,
      // wh 0 / kosong jatuh ke default 24, jadi cabang nol diuji lewat bd+stb penuh
      performanceData: [{ wh: 24, bd: 2, stb: 2 }, { wh: 24, bd: 12, stb: 12 }],
      calculateMTBF: (/** @type {string} */ id) => (id === 'EQ-1' ? 60 : 0),
    });

    expect(s.dashKPIs).toEqual({ mtbf: '60.0', mttr: '5.0', avgPA: '41.7', breakdowns: 2 });
  });

  it('tanpa data: semua tanda hubung', () => {
    const s = makeApp({ logs: [], equipment: [], performanceData: [], calculateMTBF: () => 0 });

    expect(s.dashKPIs).toEqual({ mtbf: '—', mttr: '—', avgPA: '—', breakdowns: 0 });
  });

  it('calculateMTBF tidak tersedia: mtbf tetap tanda hubung', () => {
    const s = makeApp({ logs: [], equipment: EQUIP_VALID, performanceData: [], calculateMTBF: undefined });

    expect(s.dashKPIs.mtbf).toBe('—');
  });
});

describe('calculatedStats', () => {
  const logs = [
    { woNumber: 'W1', Status: 'Completed', Tanggal: '2026-01-05' },
    { woNumber: 'W2', Status: 'Pending', Tanggal: '2026-01-20' },
    { Status: 'Repair', Tanggal: '2026-01-25' },
    { woNumber: 'W3', Status: 'Completed', Tanggal: '2026-02-02' },
  ];

  it('menghitung completion rate dalam rentang tanggal', () => {
    const s = makeApp({
      logs,
      equipment: EQUIP_VALID,
      dashboardDateFrom: '2026-01-01',
      dashboardDateTo: '2026-01-31',
      calculateHealthScore: () => ({ score: 80 }),
    });

    const st = s.calculatedStats;

    expect(st.totalEquip).toMatchObject({ value: 3, pct: 100 });
    expect(st.woCompletionRate).toMatchObject({ value: '50%', pct: 50 });
    expect(st.avgHealthScore).toMatchObject({ value: '80%', pct: 80 });
  });

  it('skor kesehatan 0 tidak dihitung rata-rata (tetap 0%)', () => {
    const s = makeApp({ logs: [], equipment: EQUIP_VALID, calculateHealthScore: () => ({ score: 0 }) });

    expect(s.calculatedStats.avgHealthScore).toMatchObject({ value: '0%', pct: 0 });
    expect(s.calculatedStats.woCompletionRate).toMatchObject({ value: '0%', pct: 0 });
  });
});

describe('predictiveAlerts', () => {
  it('hanya part yang pemakaiannya di atas 80% lifetime, lengkap dengan ETA', () => {
    const s = makeApp({
      allParts: [
        { PartID: 'P1', NamaPart: 'Seal', avgLifetimeDays: 10, usageHours: 250, firstUsedDate: isoDaysAgo(20) },
        { PartID: 'P2', avgLifetimeDays: 0, usageHours: 999 },
        { PartID: 'P3', avgLifetimeDays: 5, usageHours: 10 },
      ],
    });

    const out = s.predictiveAlerts;

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ partId: 'P1', partName: 'Seal', usageHours: 250, lifetimeDays: 10, ratio: 104, confidence: 95 });
    expect(out[0].eta).toBe(today());
  });

  it('tanpa tanggal pakai: eta null dan confidence 0', () => {
    const s = makeApp({ allParts: [{ PartID: 'P1', avgLifetimeDays: 10, usageHours: 250 }] });

    expect(s.predictiveAlerts[0]).toMatchObject({ eta: null, confidence: 0 });
  });

  it('tanggal pakai rusak: eta null', () => {
    const s = makeApp({ allParts: [{ PartID: 'P1', avgLifetimeDays: 10, usageHours: 250, installedDate: 'bogus' }] });

    expect(s.predictiveAlerts[0].eta).toBeNull();
  });

  it('pakai installedDate bila firstUsedDate tidak ada', () => {
    const s = makeApp({ allParts: [{ PartID: 'P1', avgLifetimeDays: 10, usageHours: 300, installedDate: isoDaysAgo(40) }] });

    expect(s.predictiveAlerts[0].eta).toBe(today());
  });
});

describe('filteredEquip', () => {
  it('default: urut nama, null dibuang', () => {
    expect(makeApp({ equipment: EQUIP }).filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-3', 'EQ-2', 'EQ-1']);
  });

  it('pencarian menyaring Nama atau EquipmentID', () => {
    const s = makeApp({ equipment: EQUIP, search: 'PUMP' });

    expect(s.filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-1']);
  });

  it('filter sektor, tipe, dan status', () => {
    expect(makeApp({ equipment: EQUIP, equipSectorFilter: 'Mill' }).filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-1']);
    expect(makeApp({ equipment: EQUIP, equipTypeFilter: 'Crusher' }).filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-2']);
    // EQ-3 tanpa Status dianggap Active
    expect(makeApp({ equipment: EQUIP, equipStatusFilter: 'Active' }).filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-3', 'EQ-1']);
  });

  it('sorting critical / health / date', () => {
    expect(makeApp({ equipment: EQUIP, equipSortBy: 'critical' }).filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-1', 'EQ-2', 'EQ-3']);

    const healthScores = { 'EQ-1': 50, 'EQ-2': 90, 'EQ-3': 70 };
    const sHealth = makeApp({
      equipment: EQUIP,
      equipSortBy: 'health',
      calculateHealthScore: (/** @type {string} */ id) => ({ score: healthScores[id] ?? 100 }),
    });
    expect(sHealth.filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-1', 'EQ-3', 'EQ-2']);

    expect(makeApp({ equipment: EQUIP, equipSortBy: 'date' }).filteredEquip.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-3', 'EQ-2', 'EQ-1']);
  });

  it('pagination hanya saat tidak mencari', () => {
    const s = makeApp({ equipment: EQUIP, equipPage: 1, equipLimit: 2 });

    expect(s.filteredEquip).toHaveLength(2);
  });

  it('equipment bukan array: array kosong', () => {
    expect(makeApp({ equipment: null }).filteredEquip).toEqual([]);
  });
});

describe('canLoadMoreEquip', () => {
  it('true saat masih ada sisa halaman', () => {
    expect(makeApp({ equipment: EQUIP, equipPage: 1, equipLimit: 2 }).canLoadMoreEquip).toBe(true);
  });

  it('false saat semua sudah tampil', () => {
    expect(makeApp({ equipment: EQUIP, equipPage: 2, equipLimit: 2 }).canLoadMoreEquip).toBe(false);
  });

  it('false saat sedang mencari', () => {
    expect(makeApp({ equipment: EQUIP, search: 'pump', equipPage: 1, equipLimit: 2 }).canLoadMoreEquip).toBe(false);
  });

  it('false saat equipment bukan array', () => {
    expect(makeApp({ equipment: undefined }).canLoadMoreEquip).toBe(false);
  });
});

describe('equipCounts / equipKpi', () => {
  it('menghitung per status dan membuang entri null', () => {
    expect(makeApp({ equipment: EQUIP }).equipCounts).toEqual({
      total: 3, Active: 2, 'In Maintenance': 1, Decommissioned: 0, Idle: 0,
    });
  });

  it('KPI: total, aktif, maintenance, kritikalitas tinggi, rata-rata health', () => {
    const s = makeApp({ equipment: EQUIP_VALID, calculateHealthScore: () => ({ score: 60 }) });

    expect(s.equipKpi).toEqual({ total: 3, active: 1, maint: 1, highCrit: 1, avgHealth: 60 });
  });

  it('tanpa calculateHealthScore: health dianggap 100', () => {
    expect(makeApp({ equipment: EQUIP_VALID, calculateHealthScore: undefined }).equipKpi.avgHealth).toBe(100);
  });

  it('tanpa equipment: total 0 dan health 100', () => {
    expect(makeApp({ equipment: [] }).equipKpi).toEqual({ total: 0, active: 0, maint: 0, highCrit: 0, avgHealth: 100 });
  });
});

describe('equipmentTree', () => {
  it('mengelompokkan area → tipe → unit, dengan fallback Unassigned/Other', () => {
    const tree = makeApp({ equipment: EQUIP_VALID }).equipmentTree;

    expect(Object.keys(tree).sort()).toEqual(['Crusher', 'Mill', 'Unassigned']);
    expect(tree.Mill.Pump.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-1']);
    expect(tree.Unassigned.Other.map((/** @type {any} */ e) => e.EquipmentID)).toEqual(['EQ-3']);
  });
});
