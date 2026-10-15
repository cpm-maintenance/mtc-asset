import { describe, it, expect } from 'vitest';
import { app } from '../src/js/app.js';

/**
 * U-1 · Badge counter dinamis di menu sidebar.
 *
 * Menguji logika hitung badge (openWOCount, pmOverdueCount, lowStockCount) beserta
 * pemetaan ke kelas warna & label aksesibilitas yang dipakai markup sidebar,
 * bottom-nav mobile, dan sheet "All Menu".
 *
 * `app()` mengembalikan objek state baru tanpa efek samping, sehingga tiap test
 * cukup menimpa field data lalu membaca getter-nya.
 */
describe('U-1 · Sidebar badge counters', () => {
  describe('openWOCount', () => {
    it('hanya menghitung WO yang belum Completed dan punya Status', () => {
      const s = app();
      s.logs = [
        { Status: 'Pending' },
        { Status: 'In Progress' },
        { Status: 'Completed' },
        { Status: '' },
        {},
      ];
      expect(s.openWOCount).toBe(2);
    });

    it('aman ketika logs belum termuat', () => {
      const s = app();
      s.logs = undefined;
      expect(s.openWOCount).toBe(0);
    });
  });

  describe('pmOverdueCount', () => {
    it('menghitung PM pending yang tanggalnya sudah lewat', () => {
      const s = app();
      s.pmList = [
        { pmId: 'A', status: 'pending', basis: 'date', date: '2000-01-01' },
        { pmId: 'B', status: 'pending', basis: 'date', date: '2999-01-01' },
        { pmId: 'C', status: 'done', basis: 'date', date: '2000-01-01' },
      ];
      expect(s.pmOverdueCount).toBe(1);
    });

    it('menghitung PM berbasis jam mesin yang target HM-nya terlampaui', () => {
      const s = app();
      s.equipment = [{ EquipmentID: 'EQ1', CurrentHM: 1200 }];
      s.logs = [];
      s.pmList = [
        { pmId: 'H1', status: 'pending', basis: 'hours', targetHM: 1000, equipmentId: 'EQ1' },
        { pmId: 'H2', status: 'pending', basis: 'hours', targetHM: 1500, equipmentId: 'EQ1' },
      ];
      expect(s.pmOverdueCount).toBe(1);
    });

    it('nol ketika tidak ada PM overdue', () => {
      const s = app();
      s.pmList = [{ pmId: 'A', status: 'pending', basis: 'date', date: '2999-01-01' }];
      expect(s.pmOverdueCount).toBe(0);
    });
  });

  describe('lowStockCount', () => {
    it('menghitung part dengan MinStock > 0 dan stok <= minimum', () => {
      const s = app();
      s.allParts = [
        { PartID: 'P1', Stok: 2, MinStock: 5 },   // low
        { PartID: 'P2', Stok: 5, MinStock: 5 },   // low (batas)
        { PartID: 'P3', Stok: 50, MinStock: 5 },  // aman
      ];
      expect(s.lowStockCount).toBe(2);
    });

    it('mengabaikan part tanpa MinStock (0) walau stoknya 0', () => {
      const s = app();
      s.allParts = [{ PartID: 'P1', Stok: 0, MinStock: 0 }];
      expect(s.lowStockCount).toBe(0);
    });

    it('fallback ke flag isLowStock tersimpan bila MinStock tidak ada', () => {
      const s = app();
      s.allParts = [
        { PartID: 'P1', isLowStock: true },
        { PartID: 'P2', isLowStock: false },
      ];
      expect(s.lowStockCount).toBe(1);
    });
  });

  describe('badgeCount / badgeClass / badgeLabel', () => {
    it('badgeCount mengembalikan string kosong saat nol (agar badge tak dirender)', () => {
      const s = app();
      s.logs = [];
      expect(s.badgeCount('wo')).toBe('');
    });

    it('badgeCount mengembalikan angka saat ada isi, termasuk menu PM', () => {
      const s = app();
      s.logs = [{ Status: 'Pending' }, { Status: 'Pending' }];
      s.pmList = [{ pmId: 'A', status: 'pending', basis: 'date', date: '2000-01-01' }];
      expect(s.badgeCount('wo')).toBe(2);
      expect(s.badgeCount('pms')).toBe(1);
    });

    it('badgeClass: merah untuk PM overdue, rose untuk stok kritis, amber untuk beban kerja biasa', () => {
      const s = app();
      s.pmList = [{ pmId: 'A', status: 'pending', basis: 'date', date: '2000-01-01' }];
      s.logs = [{ Status: 'Pending' }];
      s.allParts = [{ PartID: 'P1', Stok: 1, MinStock: 5 }];
      expect(s.badgeClass('pms')).toContain('red');
      expect(s.badgeClass('parts')).toContain('rose');
      expect(s.badgeClass('wo')).toContain('amber');
    });

    it('badgeClass kosong ketika tidak ada badge', () => {
      const s = app();
      s.logs = [];
      expect(s.badgeClass('wo')).toBe('');
    });

    it('badgeLabel memakai bentuk tunggal/jamak yang benar', () => {
      const s = app();
      s.logs = [{ Status: 'Pending' }];
      expect(s.badgeLabel('wo')).toBe('1 open work order');
      s.logs = [{ Status: 'Pending' }, { Status: 'Pending' }];
      expect(s.badgeLabel('wo')).toBe('2 open work orders');
      expect(s.badgeLabel('pms')).toBe('');
    });
  });
});
