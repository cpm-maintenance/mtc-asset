// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` rentang ~2290-2520:
 * getter Monthly Plan (mpPMTasks/mpOpenWOs/mpTotalItems/mpTotalHours),
 * helper mpEquipName & mpPriorityColor, mpRefresh, mtbfResult,
 * calcMTBFMTTR (cabang performance + fallback HistoryLog), dan mtbfRefresh.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

beforeEach(() => {
  stubFirebase();
  delete window._appCharts;
});

/** `_raw` bawaan (kpi-engine) mengembalikan data apa adanya — tak perlu override. */
describe('Monthly Plan — mpEquipName', () => {
  it('mengembalikan Nama equipment dari daftar', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', Nama: 'Pompa Sentrifugal' }] });
    expect(a.mpEquipName('EQ1')).toBe('Pompa Sentrifugal');
  });

  it('memakai EquipmentID bila Nama kosong', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', Nama: '' }] });
    expect(a.mpEquipName('EQ1')).toBe('EQ1');
  });

  it('mengembalikan id apa adanya bila equipment tidak ditemukan', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', Nama: 'Pompa' }] });
    expect(a.mpEquipName('EQ9')).toBe('EQ9');
  });

  it('mengembalikan id apa adanya bila id falsy', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', Nama: 'Pompa' }] });
    expect(a.mpEquipName('')).toBe('');
    expect(a.mpEquipName(undefined)).toBeUndefined();
  });

  it('mengembalikan id apa adanya bila daftar equipment belum dimuat', () => {
    const a = makeApp({ equipment: undefined });
    expect(a.mpEquipName('EQ1')).toBe('EQ1');
  });
});

describe('Monthly Plan — mpPriorityColor', () => {
  it('memetakan tiap prioritas ke kelas tac yang sesuai', () => {
    const a = makeApp();
    expect(a.mpPriorityColor('Emergency')).toContain('tac-status-emergency');
    expect(a.mpPriorityColor('Urgent')).toContain('tac-status-repair');
    expect(a.mpPriorityColor('Normal')).toContain('tac-sync-cyan');
    expect(a.mpPriorityColor('Planned')).toContain('tac-status-operational');
  });

  it('memakai warna standby untuk prioritas tak dikenal', () => {
    const a = makeApp();
    expect(a.mpPriorityColor('Whatever')).toBe('bg-tac-status-standby/20 text-tac-status-standby');
    expect(a.mpPriorityColor(undefined)).toBe('bg-tac-status-standby/20 text-tac-status-standby');
  });
});

describe('Monthly Plan — getter agregat', () => {
  it('mpPMTasks hanya mengambil task pada bulan & tahun terpilih', () => {
    const a = makeApp({
      mpMonth: 0,
      mpYear: 2026,
      pmList: [
        { taskName: 'A', date: '2026-01-05' },
        { taskName: 'B', date: '2026-02-05' },
        { taskName: 'C', date: '2025-01-05' },
      ],
    });
    expect(a.mpPMTasks.map((t) => t.taskName)).toEqual(['A']);
  });

  it('mpPMTasks melewati task tanpa tanggal atau format tanggal rusak', () => {
    const a = makeApp({
      mpMonth: 0,
      mpYear: 2026,
      pmList: [{ date: '' }, { date: '2026' }, { date: '2026-01-09' }],
    });
    expect(a.mpPMTasks).toHaveLength(1);
  });

  it('mpPMTasks mengembalikan array kosong bila pmList kosong', () => {
    expect(makeApp({ pmList: [] }).mpPMTasks).toEqual([]);
  });

  it('mpOpenWOs membuang WO Completed/Cancelled dan di luar bulan', () => {
    const a = makeApp({
      mpMonth: 0,
      mpYear: 2026,
      activeWorkOrders: [
        { LogID: 'W1', dueDate: '2026-01-10', Status: 'Open' },
        { LogID: 'W2', dueDate: '2026-01-10', Status: 'Completed' },
        { LogID: 'W3', dueDate: '2026-01-10', Status: 'Cancelled' },
        { LogID: 'W4', dueDate: '2026-03-10', Status: 'Open' },
        { LogID: 'W5', Tanggal: '2026-01-20', Status: 'In Progress' },
      ],
    });
    expect(a.mpOpenWOs.map((w) => w.LogID)).toEqual(['W1', 'W5']);
  });

  it('mpOpenWOs mengembalikan array kosong bila tak ada WO aktif', () => {
    expect(makeApp({ activeWorkOrders: [] }).mpOpenWOs).toEqual([]);
  });

  it('mpTotalItems menjumlahkan PM task dan WO terbuka', () => {
    const a = makeApp({ mpPMTasks: [{}, {}], mpOpenWOs: [{}] });
    expect(a.mpTotalItems).toBe(3);
  });

  it('mpTotalHours menjumlahkan estimasi jam PM + WO, angka string ikut dihitung', () => {
    const a = makeApp({
      mpPMTasks: [{ estimatedHours: '2.5' }, { estimatedHours: 1 }],
      mpOpenWOs: [{ estimatedHours: 4 }, { estimatedHours: 'x' }],
    });
    expect(a.mpTotalHours).toBe(7.5);
  });

  it('mpRefresh memicu loadPMSchedule', () => {
    const loadPMSchedule = vi.fn();
    makeApp({ loadPMSchedule }).mpRefresh();
    expect(loadPMSchedule).toHaveBeenCalledTimes(1);
  });
});

describe('calcMTBFMTTR — cabang performance', () => {
  it('mengembalikan null bila equipId kosong', () => {
    const a = makeApp({});
    expect(a.calcMTBFMTTR('')).toBeNull();
    expect(a.calcMTBFMTTR(undefined)).toBeNull();
  });

  it('menghitung MTBF/MTTR dari total wh, bd, dan freq', () => {
    const a = makeApp({
      performanceData: [
        { equipmentId: 'EQ1', wh: 480, bd: 24, freq: 2 },
        { EquipmentID: 'EQ1', wh: 240, bd: 12, freq: 1 },
        { equipmentId: 'EQ2', wh: 999, bd: 999, freq: 9 },
      ],
    });
    expect(a.calcMTBFMTTR('EQ1')).toEqual({ mtbfDays: 10, mttrHours: 12, totalEvents: 2 });
  });

  it('memakai jumlah events bila freq tidak diisi', () => {
    const a = makeApp({
      performanceData: [{ equipmentId: 'EQ1', wh: 96, bd: 8, events: [{}, {}] }],
    });
    expect(a.calcMTBFMTTR('EQ1')).toEqual({ mtbfDays: 2, mttrHours: 4, totalEvents: 1 });
  });

  it('membulatkan hasil ke satu desimal', () => {
    const a = makeApp({
      performanceData: [{ equipmentId: 'EQ1', wh: 100, bd: 10, freq: 3 }],
    });
    expect(a.calcMTBFMTTR('EQ1')).toEqual({ mtbfDays: 1.4, mttrHours: 3.3, totalEvents: 1 });
  });

  it('jatuh ke fallback HistoryLog bila performance ada tapi tanpa kegagalan', () => {
    const a = makeApp({
      performanceData: [{ equipmentId: 'EQ1', wh: 500, bd: 0, freq: 0, events: [] }],
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2026-01-01' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2026-01-11' },
      ],
    });
    expect(a.calcMTBFMTTR('EQ1')).toEqual({ mtbfDays: 10, mttrHours: 0, totalEvents: 2 });
  });

  it('mengabaikan baris performance milik equipment lain', () => {
    const a = makeApp({
      performanceData: [{ equipmentId: 'EQ2', wh: 480, bd: 24, freq: 2 }],
    });
    expect(a.calcMTBFMTTR('EQ1')).toBeNull();
  });

  it('memakai performanceData apa adanya tanpa butuh Alpine.raw', () => {
    const a = makeApp({ performanceData: [{ equipmentId: 'EQ1', wh: 48, bd: 6, freq: 2 }] });
    expect(a.calcMTBFMTTR('EQ1')).toEqual({ mtbfDays: 1, mttrHours: 3, totalEvents: 1 });
  });
});

describe('calcMTBFMTTR — fallback HistoryLog', () => {
  it('mengembalikan null bila tidak ada log untuk equipment', () => {
    const a = makeApp({ logs: [{ EquipmentID: 'EQ2', Jenis: 'Breakdown' }] });
    expect(a.calcMTBFMTTR('EQ1')).toBeNull();
  });

  it('MTBF 0 bila breakdown kurang dari dua, MTTR dari rata-rata Repair', () => {
    const a = makeApp({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2026-01-01' },
        { EquipmentID: 'EQ1', Jenis: 'Repair', actualHours: 4 },
        { EquipmentID: 'EQ1', Jenis: 'Repair', Downtime: 2 },
      ],
    });
    expect(a.calcMTBFMTTR('EQ1')).toEqual({ mtbfDays: 0, mttrHours: 3, totalEvents: 3 });
  });

  it('MTBF memakai jarak hari breakdown pertama-terakhir dibagi (Failures - 1)', () => {
    const a = makeApp({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2026-01-01' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2026-01-06' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2026-01-11' },
        { EquipmentID: 'EQ1', Jenis: 'Repair', actualHours: 5 },
      ],
    });
    expect(a.calcMTBFMTTR('EQ1')).toEqual({ mtbfDays: 5, mttrHours: 5, totalEvents: 4 });
  });

  it('MTTR 0 bila tidak ada log Repair', () => {
    const a = makeApp({
      logs: [{ EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2026-01-01' }],
    });
    expect(a.calcMTBFMTTR('EQ1').mttrHours).toBe(0);
  });

  it('memakai Downtime bila actualHours nol', () => {
    const a = makeApp({
      logs: [{ EquipmentID: 'EQ1', Jenis: 'Repair', actualHours: 0, Downtime: 6 }],
    });
    expect(a.calcMTBFMTTR('EQ1').mttrHours).toBe(6);
  });
});

describe('mtbfResult & mtbfRefresh', () => {
  it('mtbfResult null bila filter equipment kosong', () => {
    const a = makeApp({ mtbfFilterEquip: '' });
    expect(a.mtbfResult).toBeNull();
  });

  it('mtbfResult memakai calcMTBFMTTR untuk equipment terpilih', () => {
    const a = makeApp({
      mtbfFilterEquip: 'EQ1',
      performanceData: [{ equipmentId: 'EQ1', wh: 240, bd: 12, freq: 1 }],
    });
    expect(a.mtbfResult).toEqual({ mtbfDays: 10, mttrHours: 12, totalEvents: 1 });
  });

  it('mtbfResult null bila equipment tidak punya data', () => {
    const a = makeApp({ mtbfFilterEquip: 'EQ1' });
    expect(a.mtbfResult).toBeNull();
  });

  it('mtbfRefresh mengosongkan filter, menghancurkan chart, lalu render ulang', () => {
    const destroy = vi.fn();
    window._appCharts = { mtbfChart: { destroy } };
    const renderMTBFMTTRChart = vi.fn();
    const a = makeApp({
      mtbfFilterEquip: 'EQ1',
      renderMTBFMTTRChart,
      $nextTick: (cb) => cb(),
    });
    a.mtbfRefresh();
    expect(a.mtbfFilterEquip).toBe('');
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(renderMTBFMTTRChart).toHaveBeenCalledTimes(1);
  });

  it('mtbfRefresh tetap jalan walau chart lama tidak ada', () => {
    const renderMTBFMTTRChart = vi.fn();
    const a = makeApp({ renderMTBFMTTRChart, $nextTick: (cb) => cb() });
    expect(() => a.mtbfRefresh()).not.toThrow();
    expect(renderMTBFMTTRChart).toHaveBeenCalledTimes(1);
  });

  it('mtbfRefresh tidak gagal bila chart destroy melempar error', () => {
    window._appCharts = { mtbfChart: { destroy: () => { throw new Error('boom'); } } };
    const renderMTBFMTTRChart = vi.fn();
    const a = makeApp({ renderMTBFMTTRChart, $nextTick: (cb) => cb() });
    expect(() => a.mtbfRefresh()).not.toThrow();
    expect(renderMTBFMTTRChart).toHaveBeenCalledTimes(1);
  });
});
