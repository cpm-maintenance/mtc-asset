import { describe, it, expect } from 'vitest';
import { app } from '../src/js/app.js';

/**
 * U-3 · Analytics Hub — konsolidasi 5 menu analytics menjadi satu entri sidebar.
 *
 * Menguji:
 *  - `menuGroups` menyembunyikan sub-view (`hidden: true`) sehingga sidebar hanya
 *    punya SATU entri analytics.
 *  - `availableAnalyticsTabs` menghormati `allowedRole` (supervisor vs admin).
 *  - `setAnalyticsTab` / `openMenuItem` memindahkan `currentPage` ke id halaman lama
 *    (supaya watcher chart `kpi`/`enterprise` tetap berjalan).
 *  - `isMenuActive` & `currentPageName` memperlakukan semua sub-view sebagai satu entri.
 */
describe('U-3 · Analytics Hub', () => {
  /** State dengan role tertentu dan notifikasi yang tidak menyentuh DOM. */
  const withRole = (role) => {
    const s = app();
    s.userRole = role;
    /** @type {any[]} */
    s._denied = [];
    s.showNotification = (msg) => s._denied.push(msg);
    return s;
  };

  const analyticsGroup = (s) => s.menuGroups.find(g => g.name === 'Analytics');

  describe('konsolidasi menu sidebar', () => {
    it('hanya menampilkan satu entri Analytics Hub untuk admin', () => {
      const s = withRole('admin');
      const items = analyticsGroup(s).items;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('analytics');
      expect(items[0].name).toBe('Analytics Hub');
    });

    it('hanya menampilkan satu entri Analytics Hub untuk supervisor', () => {
      const s = withRole('supervisor');
      expect(analyticsGroup(s).items.map(i => i.id)).toEqual(['analytics']);
    });

    it('tidak menampilkan grup Analytics untuk role user biasa', () => {
      const s = withRole('user');
      expect(analyticsGroup(s)).toBeUndefined();
    });

    it('sub-view lama tetap terdaftar di menuItems (guard akses & deep-link tetap jalan)', () => {
      const s = withRole('admin');
      const ids = s.menuItems.map(m => m.id);
      for (const id of ['perf', 'mtbfmttr', 'kpi', 'enterprise', 'ai']) {
        expect(ids).toContain(id);
      }
      // ...tetapi semuanya bertanda hidden.
      const legacy = s.menuItems.filter(m => ['perf', 'mtbfmttr', 'kpi', 'enterprise', 'ai'].includes(m.id));
      expect(legacy.every(m => m.hidden === true)).toBe(true);
    });
  });

  describe('availableAnalyticsTabs (hormati allowedRole)', () => {
    it('admin melihat kelima sub-view', () => {
      const s = withRole('admin');
      expect(s.availableAnalyticsTabs.map(t => t.id)).toEqual(['perf', 'mtbfmttr', 'kpi', 'enterprise', 'ai']);
    });

    it('supervisor hanya melihat Performance dan MTBF/MTTR', () => {
      const s = withRole('supervisor');
      expect(s.availableAnalyticsTabs.map(t => t.id)).toEqual(['perf', 'mtbfmttr']);
    });

    it('role user tidak melihat sub-view apa pun', () => {
      const s = withRole('user');
      expect(s.availableAnalyticsTabs).toHaveLength(0);
    });
  });

  describe('setAnalyticsTab', () => {
    it('memindahkan currentPage ke id halaman lama', () => {
      const s = withRole('admin');
      s.setAnalyticsTab('kpi');
      expect(s.currentPage).toBe('kpi');
      expect(s.analyticsTab).toBe('kpi');
    });

    it('menolak sub-view yang tidak diizinkan role', () => {
      const s = withRole('supervisor');
      s.setAnalyticsTab('enterprise');
      expect(s.currentPage).not.toBe('enterprise');
      expect(s._denied).toContain('Access denied');
    });
  });

  describe('openMenuItem', () => {
    it('membuka sub-view terakhir yang dipakai', () => {
      const s = withRole('admin');
      s.setAnalyticsTab('enterprise');
      s.currentPage = 'dash';
      s.openMenuItem('analytics');
      expect(s.currentPage).toBe('enterprise');
    });

    it('jatuh ke sub-view pertama yang diizinkan bila tab terakhir tidak boleh diakses', () => {
      const s = withRole('admin');
      s.setAnalyticsTab('enterprise');   // analyticsTab = 'enterprise'
      s.userRole = 'supervisor';         // role turun -> enterprise tidak diizinkan
      s.currentPage = 'dash';
      s.openMenuItem('analytics');
      expect(s.currentPage).toBe('perf');
    });

    it('meneruskan navigasi biasa untuk menu non-analytics', () => {
      const s = withRole('admin');
      s.openMenuItem('dash');
      expect(s.currentPage).toBe('dash');
    });
  });

  describe('isMenuActive & currentPageName', () => {
    it('entri Analytics Hub tetap aktif di semua sub-view', () => {
      const s = withRole('admin');
      for (const id of ['perf', 'mtbfmttr', 'kpi', 'enterprise', 'ai']) {
        s.currentPage = id;
        expect(s.isMenuActive('analytics')).toBe(true);
        expect(s.isAnalyticsPage).toBe(true);
      }
      s.currentPage = 'dash';
      expect(s.isMenuActive('analytics')).toBe(false);
      expect(s.isMenuActive('dash')).toBe(true);
    });

    it('judul header menampilkan "Analytics Hub" untuk setiap sub-view', () => {
      const s = withRole('admin');
      s.currentPage = 'kpi';
      expect(s.currentPageName).toBe('Analytics Hub');
      s.currentPage = 'wo';
      expect(s.currentPageName).toBe('Work Orders');
    });
  });
});
