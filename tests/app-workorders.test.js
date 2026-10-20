// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

/**
 * Tes untuk method `app.js` baris 460–950:
 * helper Tactical Slate (perfGapTac, mpStatusTac, mpStatusMarkerTac),
 * navigasi sidebar (showUID, toggleSidebarGroup, navigateTo, setAnalyticsTab,
 * openMenuItem, isMenuActive), umur WO (woAgeDays/Bucket/Color/Class, woSectorOf),
 * serta Work Orders Ledger (loadMoreWO, partsMap, woParts, woPhotos).
 */

const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();

const wo = (i, extra = {}) => ({
  LogID: `L${i}`,
  woNumber: `WO-${i}`,
  Status: 'Pending',
  Jenis: 'Repair',
  Tanggal: daysAgo(0.5),
  ...extra,
});

beforeEach(() => {
  stubFirebase();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Tactical Slate · helper status', () => {
  it('perfGapTac memakai warna emergency untuk gap negatif', () => {
    const s = makeApp();
    expect(s.perfGapTac(-0.1)).toBe('bg-tac-status-emergency');
    expect(s.perfGapTac('-5')).toBe('bg-tac-status-emergency');
  });

  it('perfGapTac memakai warna operational untuk gap nol, positif, dan null', () => {
    const s = makeApp();
    expect(s.perfGapTac(0)).toBe('bg-tac-status-operational');
    expect(s.perfGapTac(3)).toBe('bg-tac-status-operational');
    expect(s.perfGapTac(null)).toBe('bg-tac-status-operational');
  });

  it('mpStatusTac memetakan status completed/cancelled/in progress ke token berbeda', () => {
    const s = makeApp();
    expect(s.mpStatusTac('Completed')).toContain('bg-tac-status-operational/15');
    expect(s.mpStatusTac('CANCELLED')).toContain('bg-tac-surface-container-highest');
    expect(s.mpStatusTac('In Progress')).toContain('bg-tac-sync-cyan/15');
  });

  it('mpStatusTac jatuh ke warna repair untuk status lain dan tanpa argumen', () => {
    const s = makeApp();
    expect(s.mpStatusTac('Pending')).toContain('bg-tac-status-repair/15');
    expect(s.mpStatusTac()).toContain('bg-tac-status-repair/15');
    expect(s.mpStatusTac(null)).toContain('bg-tac-status-repair/15');
  });

  it('mpStatusMarkerTac memetakan status ke satu kelas warna penanda', () => {
    const s = makeApp();
    expect(s.mpStatusMarkerTac('completed')).toBe('bg-tac-status-operational');
    expect(s.mpStatusMarkerTac('Cancelled')).toBe('bg-tac-status-standby');
    expect(s.mpStatusMarkerTac('in progress')).toBe('bg-tac-sync-cyan');
    expect(s.mpStatusMarkerTac('whatever')).toBe('bg-tac-status-repair');
  });

  it('mpStatusMarkerTac menganggap status kosong sebagai pending', () => {
    const s = makeApp();
    expect(s.mpStatusMarkerTac()).toBe('bg-tac-status-repair');
    expect(s.mpStatusMarkerTac('')).toBe('bg-tac-status-repair');
  });
});

describe('Navigasi sidebar', () => {
  it('showUID menampilkan prompt berisi uid user aktif', () => {
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);
    const s = makeApp({ user: { uid: 'u-123', email: 'a@b.c' } });
    s.showUID();
    expect(prompt).toHaveBeenCalledWith('Copy your UID below:', 'u-123');
  });

  it('showUID tidak melakukan apa pun saat belum login', () => {
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);
    const s = makeApp({ user: null });
    s.showUID();
    expect(prompt).not.toHaveBeenCalled();
  });

  it('toggleSidebarGroup membalik status grup dan menyimpannya ke localStorage', () => {
    const s = makeApp();
    s.sidebarExpandedGroups = { Maintenance: false, 'Logs & Reports': false };

    s.toggleSidebarGroup('Maintenance');

    expect(s.sidebarExpandedGroups.Maintenance).toBe(true);
    expect(JSON.parse(localStorage.getItem('sidebarGroups'))).toEqual({
      Maintenance: true,
      'Logs & Reports': false,
    });
  });

  it('toggleSidebarGroup membuka lalu menutup grup yang sama', () => {
    const s = makeApp();
    s.sidebarExpandedGroups = { Maintenance: true };
    s.toggleSidebarGroup('Maintenance');
    expect(s.sidebarExpandedGroups.Maintenance).toBe(false);
  });

  it('toggleSidebarGroup tidak melempar saat localStorage menolak penulisan', () => {
    const s = makeApp();
    s.sidebarExpandedGroups = { Maintenance: false };
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => s.toggleSidebarGroup('Maintenance')).not.toThrow();
    expect(s.sidebarExpandedGroups.Maintenance).toBe(true);
    spy.mockRestore();
  });

  it('navigateTo berpindah halaman bila menu boleh diakses', () => {
    const s = makeApp({ userRole: 'user', currentPage: 'dash' });
    s.navigateTo('wo');
    expect(s.currentPage).toBe('wo');
  });

  it('navigateTo menolak halaman yang butuh role lebih tinggi', () => {
    const showNotification = vi.fn();
    const s = makeApp({ userRole: 'user', isAdmin: false, currentPage: 'dash', showNotification });
    s.navigateTo('audit');
    expect(showNotification).toHaveBeenCalledWith('Access denied', 'error');
    expect(s.currentPage).toBe('dash');
  });

  it('navigateTo mengizinkan halaman admin untuk role admin', () => {
    const s = makeApp({ userRole: 'admin', currentPage: 'dash' });
    s.navigateTo('audit');
    expect(s.currentPage).toBe('audit');
  });

  it('navigateTo tetap berpindah untuk id yang tidak ada di menuItems', () => {
    const s = makeApp({ userRole: 'user', currentPage: 'dash' });
    s.navigateTo('tidak-ada');
    expect(s.currentPage).toBe('tidak-ada');
  });

  it('setAnalyticsTab memindahkan sub-tab dan halaman aktif untuk supervisor', () => {
    const s = makeApp({ userRole: 'supervisor', currentPage: 'dash' });
    s.setAnalyticsTab('mtbfmttr');
    expect(s.analyticsTab).toBe('mtbfmttr');
    expect(s.currentPage).toBe('mtbfmttr');
  });

  it('setAnalyticsTab menolak sub-tab di luar role dan tidak mengubah state', () => {
    const showNotification = vi.fn();
    const s = makeApp({ userRole: 'supervisor', isAdmin: false, currentPage: 'dash', showNotification });
    s.setAnalyticsTab('kpi');
    expect(showNotification).toHaveBeenCalledWith('Access denied', 'error');
    expect(s.analyticsTab).toBe('perf');
    expect(s.currentPage).toBe('dash');
  });

  it('setAnalyticsTab menolak semua sub-tab untuk user biasa', () => {
    const showNotification = vi.fn();
    const s = makeApp({ userRole: 'user', currentPage: 'dash', showNotification });
    s.setAnalyticsTab('perf');
    expect(showNotification).toHaveBeenCalledWith('Access denied', 'error');
    expect(s.currentPage).toBe('dash');
  });

  it('openMenuItem meneruskan id non-analytics ke navigateTo', () => {
    const s = makeApp({ userRole: 'user', currentPage: 'dash' });
    s.openMenuItem('parts');
    expect(s.currentPage).toBe('parts');
  });

  it('openMenuItem "analytics" membuka sub-tab terakhir yang diizinkan', () => {
    const s = makeApp({
      userRole: 'supervisor',
      currentPage: 'dash',
      analyticsTab: 'mtbfmttr',
    });
    s.openMenuItem('analytics');
    expect(s.analyticsTab).toBe('mtbfmttr');
    expect(s.currentPage).toBe('mtbfmttr');
  });

  it('openMenuItem "analytics" memakai sub-tab pertama bila tab tersimpan tidak diizinkan', () => {
    const s = makeApp({
      userRole: 'supervisor',
      isAdmin: false,
      currentPage: 'dash',
      analyticsTab: 'ai',
    });
    s.openMenuItem('analytics');
    expect(s.analyticsTab).toBe('perf');
    expect(s.currentPage).toBe('perf');
  });

  it('openMenuItem "analytics" menolak saat role tidak punya sub-tab', () => {
    const showNotification = vi.fn();
    const s = makeApp({ userRole: 'user', isAdmin: false, currentPage: 'dash', showNotification });
    s.openMenuItem('analytics');
    expect(showNotification).toHaveBeenCalledWith('Access denied', 'error');
    expect(s.currentPage).toBe('dash');
  });

  it('isMenuActive menandai entri Analytics Hub aktif di semua sub-view-nya', () => {
    const s = makeApp({ currentPage: 'enterprise' });
    expect(s.isMenuActive('analytics')).toBe(true);
    expect(s.isMenuActive('perf')).toBe(false);
  });

  it('isMenuActive membandingkan langsung untuk menu biasa', () => {
    const s = makeApp({ currentPage: 'wo' });
    expect(s.isMenuActive('wo')).toBe(true);
    expect(s.isMenuActive('parts')).toBe(false);
  });
});

describe('Umur WO (backlog aging)', () => {
  it('woAgeDays menghitung selisih hari dibulatkan ke bawah', () => {
    const s = makeApp();
    expect(s.woAgeDays({ Tanggal: daysAgo(3.5) })).toBe(3);
    expect(s.woAgeDays({ Tanggal: daysAgo(0.2) })).toBe(0);
  });

  it('woAgeDays mengembalikan 0 untuk log kosong, tanpa Tanggal, atau tanggal invalid', () => {
    const s = makeApp();
    expect(s.woAgeDays(null)).toBe(0);
    expect(s.woAgeDays({})).toBe(0);
    expect(s.woAgeDays({ Tanggal: 'bukan-tanggal' })).toBe(0);
  });

  it('woAgeBucket membagi umur ke empat ember', () => {
    const s = makeApp();
    expect(s.woAgeBucket(0)).toBe('0-1d');
    expect(s.woAgeBucket(1)).toBe('0-1d');
    expect(s.woAgeBucket(2)).toBe('1-3d');
    expect(s.woAgeBucket(3)).toBe('1-3d');
    expect(s.woAgeBucket(4)).toBe('3-7d');
    expect(s.woAgeBucket(7)).toBe('3-7d');
    expect(s.woAgeBucket(8)).toBe('7d+');
  });

  it('woAgeColor memilih tingkat warna sesuai umur', () => {
    const s = makeApp();
    expect(s.woAgeColor(1)).toContain('text-tac-status-operational');
    expect(s.woAgeColor(2)).toContain('bg-tac-status-repair/10');
    expect(s.woAgeColor(5)).toContain('bg-tac-status-repair/20');
    expect(s.woAgeColor(30)).toContain('text-tac-status-emergency');
  });

  it('woAgeClass memilih border kiri sesuai umur', () => {
    const s = makeApp();
    expect(s.woAgeClass(0)).toBe('border-l-tac-status-operational');
    expect(s.woAgeClass(2)).toBe('border-l-tac-status-repair');
    expect(s.woAgeClass(6)).toBe('border-l-tac-status-repair');
    expect(s.woAgeClass(9)).toBe('border-l-tac-status-emergency');
  });

  it('woSectorOf mengambil Lokasi equipment sebagai sektor', () => {
    const s = makeApp({ equipment: [{ EquipmentID: 'E1', Lokasi: 'Plant A' }] });
    expect(s.woSectorOf('E1')).toBe('Plant A');
  });

  it('woSectorOf memakai penanda khusus untuk kosong, EXTERNAL, dan unit tak dikenal', () => {
    const s = makeApp({ equipment: [{ EquipmentID: 'E1', Lokasi: 'Plant A' }] });
    expect(s.woSectorOf(null)).toBe('UNASSIGNED');
    expect(s.woSectorOf('')).toBe('UNASSIGNED');
    expect(s.woSectorOf('EXTERNAL')).toBe('EXTERNAL');
    expect(s.woSectorOf('E9')).toBe('UNASSIGNED');
  });

  it('woSectorOf memberi UNASSIGNED bila equipment tidak punya Lokasi', () => {
    const s = makeApp({ equipment: [{ EquipmentID: 'E2' }] });
    expect(s.woSectorOf('E2')).toBe('UNASSIGNED');
  });

  it('woSectorOf membangun ulang peta saat referensi equipment berganti', () => {
    const s = makeApp({ equipment: [{ EquipmentID: 'E1', Lokasi: 'Plant A' }] });
    expect(s.woSectorOf('E1')).toBe('Plant A');
    s.equipment = [{ EquipmentID: 'E1', Lokasi: 'Plant B' }];
    expect(s.woSectorOf('E1')).toBe('Plant B');
  });
});

describe('Work Orders Ledger', () => {
  it('loadMoreWO menambah batas render 30 WO saat masih ada sisa', () => {
    const s = makeApp({ logs: Array.from({ length: 40 }, (_, i) => wo(i)), woLimit: 30 });
    expect(s.woVisible).toHaveLength(30);
    s.loadMoreWO();
    expect(s.woLimit).toBe(60);
    expect(s.woVisible).toHaveLength(40);
  });

  it('loadMoreWO tidak mengubah batas saat semua WO sudah tampil', () => {
    const s = makeApp({ logs: [wo(1), wo(2)], woLimit: 30 });
    expect(s.canLoadMoreWO).toBe(false);
    s.loadMoreWO();
    expect(s.woLimit).toBe(30);
  });

  it('partsMap memetakan PartID ke data part', () => {
    const s = makeApp({ allParts: [{ PartID: 'P1', NamaPart: 'Bearing' }] });
    const map = s.partsMap();
    expect(map.get('P1')).toEqual({ PartID: 'P1', NamaPart: 'Bearing' });
  });

  it('partsMap memakai ulang peta selama allParts tidak berganti referensi', () => {
    const s = makeApp({ allParts: [{ PartID: 'P1' }] });
    const first = s.partsMap();
    expect(s.partsMap()).toBe(first);
    s.allParts = [{ PartID: 'P2' }];
    const second = s.partsMap();
    expect(second).not.toBe(first);
    expect(second.has('P2')).toBe(true);
  });

  it('partsMap mengembalikan Map kosong tanpa allParts', () => {
    const s = makeApp({ allParts: undefined });
    expect(s.partsMap().size).toBe(0);
  });

  it('woParts menandai part yang stoknya cukup', () => {
    const s = makeApp({
      allParts: [{ PartID: 'P1', NamaSingkat: 'BRG', Stok: 5 }],
    });
    const log = { PartsUsed: JSON.stringify([{ id: 'P1', qty: 3 }, { id: 'P9', qty: 1 }]) };
    expect(s.woParts(log)).toEqual([
      { id: 'P1', qty: 3, name: 'BRG', stok: 5, ok: true },
      { id: 'P9', qty: 1, name: 'P9', stok: 0, ok: false },
    ]);
  });

  it('woParts memakai NamaPart bila NamaSingkat kosong dan menandai stok kurang', () => {
    const s = makeApp({ allParts: [{ PartID: 'P1', NamaPart: 'Bearing', Stok: 1 }] });
    expect(s.woParts({ PartsUsed: [{ id: 'P1', qty: 2 }] })).toEqual([
      { id: 'P1', qty: 2, name: 'Bearing', stok: 1, ok: false },
    ]);
  });

  it('woParts mengembalikan array kosong tanpa PartsUsed', () => {
    const s = makeApp({ allParts: [] });
    expect(s.woParts({})).toEqual([]);
    expect(s.woParts(null)).toEqual([]);
  });

  it('woPhotos mengembalikan array apa adanya', () => {
    const s = makeApp();
    expect(s.woPhotos({ PhotoURLs: ['a.jpg', 'b.jpg'] })).toEqual(['a.jpg', 'b.jpg']);
  });

  it('woPhotos mem-parse PhotoURLs berbentuk string JSON', () => {
    const s = makeApp();
    expect(s.woPhotos({ PhotoURLs: '["x.jpg","y.jpg"]' })).toEqual(['x.jpg', 'y.jpg']);
  });

  it('woPhotos memperlakukan string non-JSON sebagai satu foto', () => {
    const s = makeApp();
    expect(s.woPhotos({ PhotoURLs: 'https://cdn/x.jpg' })).toEqual(['https://cdn/x.jpg']);
  });

  it('woPhotos jatuh ke PhotoURL tunggal bila PhotoURLs bukan array', () => {
    const s = makeApp();
    expect(s.woPhotos({ PhotoURL: 'solo.jpg' })).toEqual(['solo.jpg']);
  });

  it('woPhotos membatasi maksimal 4 foto dan membuang nilai kosong', () => {
    const s = makeApp();
    expect(s.woPhotos({ PhotoURLs: ['1', '', null, '2', '3', '4', '5'] })).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('woPhotos mengembalikan array kosong untuk log kosong', () => {
    const s = makeApp();
    expect(s.woPhotos(null)).toEqual([]);
    expect(s.woPhotos({})).toEqual([]);
  });
});
