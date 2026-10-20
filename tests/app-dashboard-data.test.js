// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

describe('applyDashboardFilter', () => {
  beforeEach(() => {
    delete window._appCharts;
  });

  it('menghancurkan chart lama dan mereset cache chart', () => {
    const destroy = vi.fn();
    window._appCharts = { status: { destroy }, cost: null };
    const s = makeApp({ currentPage: 'equip', renderDashboardCharts: vi.fn() });

    s.applyDashboardFilter();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(window._appCharts).toEqual({
      status: null, cost: null, downtime: null, reliability: null, woCompletion: null,
    });
  });

  it('membangun ulang chart saat halaman aktif adalah dashboard', () => {
    const render = vi.fn();
    const s = makeApp({ currentPage: 'dash', renderDashboardCharts: render });

    s.applyDashboardFilter();

    expect(render).toHaveBeenCalledTimes(1);
  });

  it('tidak membangun ulang chart saat halaman aktif bukan dashboard', () => {
    const render = vi.fn();
    const s = makeApp({ currentPage: 'logs', renderDashboardCharts: render });

    s.applyDashboardFilter();

    expect(render).not.toHaveBeenCalled();
  });

  it('tetap aman saat belum ada cache chart', () => {
    const s = makeApp({ currentPage: 'dash', renderDashboardCharts: vi.fn() });

    expect(() => s.applyDashboardFilter()).not.toThrow();
  });
});

describe('setDashboardPreset', () => {
  it('preset 0 mengosongkan rentang tanggal', () => {
    const apply = vi.fn();
    const s = makeApp({ applyDashboardFilter: apply, dashboardDateFrom: '2026-01-01', dashboardDateTo: '2026-01-31' });

    s.setDashboardPreset(0);

    expect(s.dashboardDateFrom).toBe('');
    expect(s.dashboardDateTo).toBe('');
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('preset N hari mengisi tanggal dari N hari lalu sampai hari ini', () => {
    const apply = vi.fn();
    const s = makeApp({ applyDashboardFilter: apply });

    s.setDashboardPreset(7);

    const today = new Date().toISOString().split('T')[0];
    const expectedFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(s.dashboardDateTo).toBe(today);
    expect(s.dashboardDateFrom).toBe(expectedFrom);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

describe('equipStatusTac', () => {
  const s = makeApp();

  it('Active memakai palet operational', () => {
    expect(s.equipStatusTac('Active')).toContain('bg-tac-status-operational/15');
  });

  it('In Maintenance memakai palet repair', () => {
    expect(s.equipStatusTac('In Maintenance')).toContain('bg-tac-status-repair/15');
  });

  it('Decommissioned memakai palet emergency', () => {
    expect(s.equipStatusTac('Decommissioned')).toContain('bg-tac-status-emergency/15');
  });

  it('status lain memakai palet netral', () => {
    expect(s.equipStatusTac('Idle')).toContain('bg-tac-surface-container-highest');
  });

  it('status kosong dianggap Active', () => {
    expect(s.equipStatusTac(undefined)).toBe(s.equipStatusTac('Active'));
  });
});

describe('equipMarkerTac', () => {
  const s = makeApp();

  it('memetakan status equipment ke warna marker', () => {
    expect(s.equipMarkerTac({ Status: 'Active' })).toBe('bg-tac-status-operational');
    expect(s.equipMarkerTac({ Status: 'In Maintenance' })).toBe('bg-tac-status-repair');
    expect(s.equipMarkerTac({ Status: 'Decommissioned' })).toBe('bg-tac-status-emergency');
  });

  it('status tak dikenal memakai warna standby', () => {
    expect(s.equipMarkerTac({ Status: 'Idle' })).toBe('bg-tac-status-standby');
  });

  it('item null dianggap Active', () => {
    expect(s.equipMarkerTac(null)).toBe('bg-tac-status-operational');
  });
});

describe('loadMoreEquipment', () => {
  it('menambah equipPage saat masih ada data', () => {
    const equipment = Array.from({ length: 40 }, (_, i) => ({ EquipmentID: 'E' + i }));
    const s = makeApp({ equipment, equipPage: 1, equipLimit: 30 });

    s.loadMoreEquipment();

    expect(s.equipPage).toBe(2);
  });

  it('tidak menambah equipPage saat data sudah habis', () => {
    const s = makeApp({ equipment: [{ EquipmentID: 'E1' }], equipPage: 1, equipLimit: 30 });

    s.loadMoreEquipment();

    expect(s.equipPage).toBe(1);
  });

  it('tidak menambah equipPage saat sedang mencari', () => {
    const equipment = Array.from({ length: 40 }, (_, i) => ({ EquipmentID: 'E' + i }));
    const s = makeApp({ equipment, equipPage: 1, equipLimit: 30, search: 'pump' });

    s.loadMoreEquipment();

    expect(s.equipPage).toBe(1);
  });
});

describe('isLowStock', () => {
  const s = makeApp();

  it('stok sama dengan minimum dianggap low', () => {
    expect(s.isLowStock(5, 5)).toBe(true);
  });

  it('stok di bawah minimum dianggap low', () => {
    expect(s.isLowStock(2, 10)).toBe(true);
  });

  it('stok di atas minimum tidak dianggap low', () => {
    expect(s.isLowStock(11, 10)).toBe(false);
  });

  it('membandingkan nilai string sebagai angka', () => {
    expect(s.isLowStock('3', '10')).toBe(true);
  });
});

describe('confirmDelete', () => {
  it('membuka dialog dan menyelesaikan true saat dikonfirmasi', async () => {
    const s = makeApp();

    const p = s.confirmDelete({}, 'L1');
    expect(s.showDeleteConfirm).toBe(true);
    expect(typeof s.deleteConfirmCallback.confirm).toBe('function');

    s.deleteConfirmCallback.confirm();

    await expect(p).resolves.toBe(true);
    expect(s.deleteConfirmCallback).toBeNull();
  });

  it('menyelesaikan false saat dibatalkan', async () => {
    const s = makeApp();

    const p = s.confirmDelete({}, 'L1');
    s.deleteConfirmCallback.cancel();

    await expect(p).resolves.toBe(false);
    expect(s.deleteConfirmCallback).toBeNull();
  });
});

describe('cleanUrl', () => {
  const s = makeApp();

  it('mengembalikan string kosong untuk input bukan string', () => {
    expect(s.cleanUrl(null)).toBe('');
    expect(s.cleanUrl(undefined)).toBe('');
    expect(s.cleanUrl(42)).toBe('');
    expect(s.cleanUrl('')).toBe('');
  });

  it('meloloskan URL https apa adanya', () => {
    expect(s.cleanUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('mendekode entitas HTML dan percent-encoding', () => {
    expect(s.cleanUrl('https://cdn.example.com/a.jpg?x=1&amp;y=2')).toBe('https://cdn.example.com/a.jpg?x=1&y=2');
    expect(s.cleanUrl('https://cdn.example.com/a%20b.jpg')).toBe('https://cdn.example.com/a b.jpg');
  });

  it('mendekode entitas hex', () => {
    expect(s.cleanUrl('https://cdn.example.com/&#x41;.jpg')).toBe('https://cdn.example.com/A.jpg');
  });

  it('menolak skema selain http/data/blob', () => {
    expect(s.cleanUrl('javascript:alert(1)')).toBe('');
    expect(s.cleanUrl('ftp://example.com/a.jpg')).toBe('');
  });

  it('menolak URL berisi karakter berbahaya', () => {
    expect(s.cleanUrl('https://cdn.example.com/<script>.jpg')).toBe('');
    expect(s.cleanUrl('https://cdn.example.com/{a}.jpg')).toBe('');
  });

  it('mengembalikan string kosong saat percent-decoding gagal', () => {
    expect(s.cleanUrl('https://cdn.example.com/%E0%A4%A')).toBe('');
  });
});

describe('safeParseLogParts', () => {
  it('mengembalikan array kosong untuk nilai kosong', () => {
    const s = makeApp();
    expect(s.safeParseLogParts(null)).toEqual([]);
    expect(s.safeParseLogParts(undefined)).toEqual([]);
    expect(s.safeParseLogParts('')).toEqual([]);
    expect(s.safeParseLogParts('   ')).toEqual([]);
  });

  it('mengembalikan array apa adanya', () => {
    const s = makeApp();
    const arr = [{ PartID: 'P1', Qty: 2 }];
    expect(s.safeParseLogParts(arr)).toBe(arr);
  });

  it('mengurai string JSON menjadi array', () => {
    const s = makeApp();
    expect(s.safeParseLogParts('[{"PartID":"P1","Qty":2}]')).toEqual([{ PartID: 'P1', Qty: 2 }]);
  });

  it('mengembalikan array kosong untuk JSON rusak dan mencatat warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = makeApp();

    expect(s.safeParseLogParts('{bukan json')).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('mengembalikan array kosong untuk tipe yang tidak didukung', () => {
    const s = makeApp();
    expect(s.safeParseLogParts(123)).toEqual([]);
    expect(s.safeParseLogParts({ PartID: 'P1' })).toEqual([]);
  });
});

describe('forceRefreshLogs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mengosongkan logs lalu memulihkannya sebagai referensi baru setelah 50 ms', () => {
    const original = [{ LogID: 'L1' }];
    const s = makeApp({ logs: original });

    s.forceRefreshLogs();
    expect(s.logs).toEqual([]);

    vi.advanceTimersByTime(50);
    expect(s.logs).toEqual([{ LogID: 'L1' }]);
    expect(s.logs).not.toBe(original);
  });

  it('aman saat logs belum ada', () => {
    const s = makeApp({ logs: undefined });

    expect(() => s.forceRefreshLogs()).not.toThrow();
    vi.advanceTimersByTime(50);
    expect(s.logs).toEqual([]);
  });
});

describe('refreshData', () => {
  beforeEach(() => {
    stubFirebase();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('menyinkronkan ulang lalu memberi notifikasi sukses', () => {
    const setup = vi.fn();
    const s = makeApp({ setupFirebaseListeners: setup });

    s.refreshData();

    expect(s.isLoading).toBe(true);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(s.showNotification).toHaveBeenCalledWith('Syncing data...', 'info');

    vi.advanceTimersByTime(500);

    expect(s.isLoading).toBe(false);
    expect(s.showNotification).toHaveBeenCalledWith('Data refreshed', 'success');
  });

  it('melaporkan kegagalan saat setup listener melempar error', () => {
    const setup = vi.fn(() => { throw new Error('boom'); });
    const s = makeApp({ setupFirebaseListeners: setup });

    s.refreshData();

    expect(s.isLoading).toBe(false);
    expect(s.showNotification).toHaveBeenCalledWith('Refresh failed: boom', 'error');
  });

  it('tetap berjalan saat setupFirebaseListeners tidak tersedia', () => {
    const s = makeApp({ setupFirebaseListeners: undefined });

    expect(() => s.refreshData()).not.toThrow();
    vi.advanceTimersByTime(500);
    expect(s.showNotification).toHaveBeenCalledWith('Data refreshed', 'success');
  });
});

describe('loadMoreDetailLogs', () => {
  it('menambah limit 50 dari nilai awal', () => {
    const s = makeApp({ detailLogLimit: 50 });

    s.loadMoreDetailLogs();

    expect(s.detailLogLimit).toBe(100);
  });

  it('memakai 50 sebagai default saat limit belum diisi', () => {
    const s = makeApp({ detailLogLimit: undefined });

    s.loadMoreDetailLogs();

    expect(s.detailLogLimit).toBe(100);
  });
});
