// @vitest-environment jsdom
/**
 * Tests untuk method `src/js/app.js` rentang 1620-2100: migrasi gambar legacy,
 * pagination detail log, filter All Logs/Work Order, helper badge Tactical Slate,
 * dan `planningFilteredByColumn`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

beforeEach(() => {
  stubFirebase();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const log = (extra = {}) => ({
  LogID: 'L1',
  EquipmentID: 'EQ1',
  Tanggal: '2026-10-10',
  Jenis: 'Repair',
  Status: 'Pending',
  ...extra,
});

describe('migrateLegacyImages', () => {
  it('melewati entri yang bukan data URL dan mencatat skipped', async () => {
    const a = makeApp();
    window.get = vi.fn()
      .mockResolvedValueOnce({ val: () => ({ i1: { data: 'https://x/y.png' } }) })
      .mockResolvedValueOnce({ val: () => ({}) })
      .mockResolvedValueOnce({ val: () => ({}) })
      .mockResolvedValueOnce({ val: () => ({}) })
      .mockResolvedValueOnce({ val: () => ({}) });

    const res = await a.migrateLegacyImages();

    expect(res).toEqual({ migrated: 0, failed: 0, skipped: 1 });
    expect(window.update).not.toHaveBeenCalled();
    expect(a.showNotification).toHaveBeenCalledWith('Migrated 0 images', 'success');
  });

  it('mengunggah base64, menulis URL ke Equipment, dan menghapus node ImageUploads', async () => {
    const a = makeApp({ uploadBase64Image: vi.fn().mockResolvedValue('https://cdn/foto.png') });
    const data = 'data:image/png;base64,AAAA';
    window.get = vi.fn()
      .mockResolvedValueOnce({ val: () => ({ i1: { data } }) })
      .mockResolvedValueOnce({ val: () => ({ EQ1: { FotoURL: data } }) })
      .mockResolvedValueOnce({ val: () => ({}) })
      .mockResolvedValueOnce({ val: () => ({ EQ1: { FotoURL: 'https://cdn/foto.png' } }) })
      .mockResolvedValueOnce({ val: () => ({}) });

    const res = await a.migrateLegacyImages();

    expect(res.migrated).toBe(1);
    const updates = window.update.mock.calls[0][1];
    expect(updates['Equipment/EQ1/FotoURL']).toBe('https://cdn/foto.png');
    expect(updates['ImageUploads/i1']).toBeNull();
    expect(a.showNotification).toHaveBeenCalledWith('Migrated 1 images', 'success');
  });

  it('menghitung failed saat unggah mengembalikan null', async () => {
    const a = makeApp({ uploadBase64Image: vi.fn().mockResolvedValue(null) });
    const data = 'data:image/png;base64,BBBB';
    window.get = vi.fn()
      .mockResolvedValueOnce({ val: () => ({ i1: { data } }) })
      .mockResolvedValueOnce({ val: () => ({}) })
      .mockResolvedValueOnce({ val: () => ({}) })
      .mockResolvedValueOnce({ val: () => ({}) })
      .mockResolvedValueOnce({ val: () => ({}) });

    const res = await a.migrateLegacyImages();

    expect(res).toEqual({ migrated: 0, failed: 1, skipped: 0 });
    expect(console.error).toHaveBeenCalled();
    expect(window.update).not.toHaveBeenCalled();
  });
});

describe('helper badge Tactical Slate — logStatusTac', () => {
  it('memetakan setiap status ke kelas tac yang sesuai', () => {
    const a = makeApp();
    expect(a.logStatusTac('Completed')).toBe('bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/30');
    expect(a.logStatusTac('In Progress')).toBe('bg-tac-sync-cyan/15 text-tac-sync-cyan border-tac-sync-cyan/30');
    expect(a.logStatusTac('Approved')).toBe('bg-tac-primary/15 text-tac-primary border-tac-primary/30');
    expect(a.logStatusTac('Cancelled')).toBe('bg-tac-surface-container-highest text-tac-on-surface-variant border-tac-border-subtle');
  });

  it('memakai gaya repair untuk Pending, status tak dikenal, dan argumen kosong', () => {
    const a = makeApp();
    const repair = 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/30';
    expect(a.logStatusTac('Pending')).toBe(repair);
    expect(a.logStatusTac('Entah')).toBe(repair);
    expect(a.logStatusTac()).toBe(repair);
    expect(a.logStatusTac(null)).toBe(repair);
  });
});

describe('helper badge Tactical Slate — logMarkerTac', () => {
  it('memetakan jenis ke warna marker', () => {
    const a = makeApp();
    expect(a.logMarkerTac('Breakdown')).toBe('bg-tac-status-emergency');
    expect(a.logMarkerTac('Repair')).toBe('bg-tac-status-repair');
    expect(a.logMarkerTac('PM')).toBe('bg-tac-status-operational');
    expect(a.logMarkerTac('Inspection')).toBe('bg-tac-primary');
  });

  it('jatuh ke standby untuk jenis kosong/tak dikenal', () => {
    const a = makeApp();
    expect(a.logMarkerTac('')).toBe('bg-tac-status-standby');
    expect(a.logMarkerTac('Lainnya')).toBe('bg-tac-status-standby');
    expect(a.logMarkerTac()).toBe('bg-tac-status-standby');
  });
});

describe('helper badge Tactical Slate — logIconTac', () => {
  it('memetakan jenis ke nama ikon material', () => {
    const a = makeApp();
    expect(a.logIconTac('Breakdown')).toBe('warning');
    expect(a.logIconTac('Repair')).toBe('engineering');
    expect(a.logIconTac('PM')).toBe('event_busy');
    expect(a.logIconTac('Inspection')).toBe('fact_check');
  });

  it('jatuh ke ikon history untuk jenis kosong/tak dikenal', () => {
    const a = makeApp();
    expect(a.logIconTac('')).toBe('history');
    expect(a.logIconTac('Lainnya')).toBe('history');
    expect(a.logIconTac()).toBe('history');
  });
});

describe('helper badge Tactical Slate — logPriorityTac', () => {
  it('memetakan prioritas ke kelas warna', () => {
    const a = makeApp();
    expect(a.logPriorityTac('Emergency')).toBe('bg-tac-status-emergency/20 text-tac-status-emergency');
    expect(a.logPriorityTac('Urgent')).toBe('bg-tac-status-repair/20 text-tac-status-repair');
    expect(a.logPriorityTac('Planned')).toBe('bg-tac-status-operational/20 text-tac-status-operational');
  });

  it('memakai warna primary untuk Normal dan nilai kosong', () => {
    const a = makeApp();
    expect(a.logPriorityTac('Normal')).toBe('bg-tac-primary/15 text-tac-primary');
    expect(a.logPriorityTac()).toBe('bg-tac-primary/15 text-tac-primary');
  });
});

describe('loadMoreAllLogs', () => {
  it('menambah limit 30 saat masih ada sisa log', () => {
    const a = makeApp({ logs: Array.from({ length: 45 }, (_, i) => log({ LogID: `L${i}`, EquipmentID: `EQ${i}` })) });
    a.allLogsLimit = 30;
    a.loadMoreAllLogs();
    expect(a.allLogsLimit).toBe(60);
    expect(a.filteredAllLogs).toHaveLength(45);
  });

  it('tidak mengubah limit saat semua log sudah tampil', () => {
    const a = makeApp({ logs: [log(), log({ LogID: 'L2', EquipmentID: 'EQ2' })] });
    a.allLogsLimit = 30;
    a.loadMoreAllLogs();
    expect(a.allLogsLimit).toBe(30);
  });

  it('memakai basis 30 saat limit belum di-set', () => {
    const a = makeApp({ logs: Array.from({ length: 40 }, (_, i) => log({ LogID: `L${i}`, EquipmentID: `EQ${i}` })) });
    a.allLogsLimit = 0;
    expect(a.filteredAllLogs).toHaveLength(30);
    a.loadMoreAllLogs();
    expect(a.allLogsLimit).toBe(60);
  });
});

describe('getter detail log per equipment', () => {
  const logs = [
    log({ LogID: 'L1', EquipmentID: 'EQ1' }),
    log({ LogID: 'L2', EquipmentID: 'EQ2' }),
    log({ LogID: 'L3', EquipmentID: 'EQ1' }),
  ];

  it('filteredLogs hanya mengembalikan log equipment terpilih', () => {
    const a = makeApp({ logs, selectedEquip: { EquipmentID: 'EQ1' } });
    expect(a.filteredLogs.map(l => l.LogID)).toEqual(['L1', 'L3']);
  });

  it('filteredLogs aman saat logs bukan array', () => {
    const a = makeApp({ logs: null });
    expect(a.filteredLogs).toEqual([]);
  });

  it('visibleEquipLogs memotong sesuai detailLogLimit', () => {
    const a = makeApp({ logs, selectedEquip: { EquipmentID: 'EQ1' } });
    a.detailLogLimit = 1;
    expect(a.visibleEquipLogs.map(l => l.LogID)).toEqual(['L1']);
    expect(a.detailLogsHasMore).toBe(true);
  });

  it('detailLogsHasMore false saat seluruh log muat', () => {
    const a = makeApp({ logs, selectedEquip: { EquipmentID: 'EQ1' } });
    a.detailLogLimit = 50;
    expect(a.detailLogsHasMore).toBe(false);
  });

  it('loadMoreDetailLogs menambah limit 50', () => {
    const a = makeApp();
    a.detailLogLimit = 50;
    a.loadMoreDetailLogs();
    expect(a.detailLogLimit).toBe(100);
  });
});

describe('filteredWorkOrders', () => {
  it('memakai activeWorkOrders bila tersedia', () => {
    const a = makeApp({
      logs: [log({ LogID: 'IGNORED' })],
      activeWorkOrders: [log({ LogID: 'WO1', woNumber: 'WO-1' })],
    });
    expect(a.filteredWorkOrders.map(l => l.LogID)).toEqual(['WO1']);
  });

  it('jatuh ke logs saat activeWorkOrders kosong', () => {
    const a = makeApp({
      activeWorkOrders: [],
      logs: [
        log({ LogID: 'A', Status: 'Pending' }),
        log({ LogID: 'B', Status: 'Draft' }),
        log({ LogID: 'C', Status: 'Approved' }),
        log({ LogID: 'D', Status: 'Completed', woNumber: 'WO-9' }),
        log({ LogID: 'E', Status: 'Completed' }),
      ],
    });
    expect(a.filteredWorkOrders.map(l => l.LogID)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('mengembalikan array kosong saat logs bukan array', () => {
    const a = makeApp({ logs: undefined });
    expect(a.filteredWorkOrders).toEqual([]);
  });

  it('memfilter berdasarkan kata kunci searchWO', () => {
    const a = makeApp({
      activeWorkOrders: [
        log({ LogID: 'A', Deskripsi: 'Ganti bearing' }),
        log({ LogID: 'B', Deskripsi: 'Kalibrasi valve' }),
      ],
    });
    a.searchWO = 'bearing';
    expect(a.filteredWorkOrders.map(l => l.LogID)).toEqual(['A']);
  });

  it('memfilter status, prioritas, dan rentang tanggal sekaligus', () => {
    const a = makeApp({
      activeWorkOrders: [
        log({ LogID: 'A', Status: 'Pending', woPriority: 'Urgent', Tanggal: '2026-10-05' }),
        log({ LogID: 'B', Status: 'Pending', woPriority: 'Normal', Tanggal: '2026-10-05' }),
        log({ LogID: 'C', Status: 'Draft', woPriority: 'Urgent', Tanggal: '2026-10-05' }),
        log({ LogID: 'D', Status: 'Pending', woPriority: 'Urgent', Tanggal: '2026-12-01' }),
      ],
    });
    a.filterWOStatus = 'Pending';
    a.filterWOPriority = 'Urgent';
    a.filterDateFrom = '2026-10-01';
    a.filterDateTo = '2026-10-31';
    expect(a.filteredWorkOrders.map(l => l.LogID)).toEqual(['A']);
  });
});

describe('filteredPerformanceData', () => {
  it('mendelegasikan ke getFilteredPerfData bila ada', () => {
    const a = makeApp({ getFilteredPerfData: vi.fn().mockReturnValue([{ id: 1 }]) });
    expect(a.filteredPerformanceData).toEqual([{ id: 1 }]);
  });

  it('memakai performanceData mentah bila tidak ada delegate', () => {
    const a = makeApp({ getFilteredPerfData: undefined, performanceData: [{ id: 2 }] });
    expect(a.filteredPerformanceData).toEqual([{ id: 2 }]);
  });
});

describe('planningFilteredByColumn', () => {
  const wos = [
    log({ LogID: 'A', woNumber: 'WO-A', Status: 'Pending' }),
    log({ LogID: 'B', woNumber: 'WO-B', Status: 'Draft' }),
    log({ LogID: 'C', woNumber: 'WO-C', Status: 'Approved' }),
  ];

  it('mengembalikan WO dengan satu status', () => {
    const a = makeApp({ activeWorkOrders: wos });
    expect(a.planningFilteredByColumn('Pending').map(w => w.LogID)).toEqual(['A']);
  });

  it('menggabungkan beberapa status dalam satu kolom', () => {
    const a = makeApp({ activeWorkOrders: wos });
    expect(a.planningFilteredByColumn('Draft', 'Approved').map(w => w.LogID)).toEqual(['B', 'C']);
  });

  it('mengembalikan array kosong tanpa argumen status', () => {
    const a = makeApp({ activeWorkOrders: wos });
    expect(a.planningFilteredByColumn()).toEqual([]);
  });

  it('mengembalikan array kosong saat tidak ada WO', () => {
    const a = makeApp({ activeWorkOrders: [], logs: [] });
    expect(a.planningFilteredByColumn('Pending')).toEqual([]);
  });
});
