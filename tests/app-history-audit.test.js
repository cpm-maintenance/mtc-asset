// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeApp } from './helpers/app-harness.js';

const h = vi.hoisted(() => ({
  state: { snap: { exists: () => false, val: () => ({}) }, calls: [] },
}));

vi.mock('../src/js/db.js', () => ({
  db: {},
  ref: (...args) => { h.state.calls.push(['ref', ...args]); return { __ref: args }; },
  query: (r) => r,
  orderByChild: (f) => ({ f }),
  limitToLast: (n) => ({ n }),
  get: async () => h.state.snap,
}));

beforeEach(() => {
  h.state.calls = [];
  h.state.snap = { exists: () => false, val: () => ({}) };
});

const log = (extra = {}) => ({
  woNumber: 'WO-001', Deskripsi: 'Ganti bearing', Technician: 'Budi',
  EquipmentID: 'EQ-1', Tanggal: '2026-10-10', Jenis: 'Corrective', Status: 'Complete',
  Downtime: 2, Cost: 100, PartsUsed: '', ...extra,
});

describe('app.js: usage history + part lookup', () => {
  it('closeUsageHistory menutup panel', () => {
    const s = makeApp();
    s.showUsageHistory = true;
    s.closeUsageHistory();
    expect(s.showUsageHistory).toBe(false);
  });

  it('historySelectedEquip null saat filter "all"', () => {
    const s = makeApp();
    s.equipment = [{ EquipmentID: 'EQ-1' }];
    expect(s.historySelectedEquip).toBe(null);
    s.historyEquipId = 'all';
    expect(s.historySelectedEquip).toBe(null);
  });

  it('historySelectedEquip menemukan unit berdasarkan EquipmentID', () => {
    const s = makeApp();
    s.equipment = [{ EquipmentID: 'EQ-1', Nama: 'Pump' }, { EquipmentID: 'EQ-2' }];
    s.historyEquipId = 'EQ-2';
    expect(s.historySelectedEquip).toEqual({ EquipmentID: 'EQ-2' });
    s.historyEquipId = 'EQ-X';
    expect(s.historySelectedEquip).toBe(null);
  });

  it('_partMap memetakan PartID dan meng-invalidasi cache saat allParts diganti', () => {
    const s = makeApp();
    s.allParts = [{ PartID: 'P1', NamaPart: 'Bearing' }];
    expect(s._partMap().get('P1').NamaPart).toBe('Bearing');
    s.allParts = [{ PartID: 'P2', NamaPart: 'Seal' }];
    expect(s._partMap().get('P1')).toBeUndefined();
    expect(s._partMap().get('P2').NamaPart).toBe('Seal');
  });

  it('historyGetPartName / historyGetPartNumber menangani id kosong dan tidak dikenal', () => {
    const s = makeApp();
    s.allParts = [{ PartID: 'P1', NamaPart: 'Bearing', PartNumber: 'BRG-1' }];
    expect(s.historyGetPartName('')).toBe('');
    expect(s.historyGetPartName('P1')).toBe('Bearing');
    expect(s.historyGetPartName('P9')).toBe('P9');
    expect(s.historyGetPartNumber('')).toBe('');
    expect(s.historyGetPartNumber('P1')).toBe('BRG-1');
    expect(s.historyGetPartNumber('P9')).toBe('');
  });

  it('historyGetPartName jatuh ke PartID saat NamaPart kosong', () => {
    const s = makeApp();
    s.allParts = [{ PartID: 'P1' }];
    expect(s.historyGetPartName('P1')).toBe('P1');
  });
});

describe('app.js: historyGetParts', () => {
  it('mengembalikan [] untuk log kosong / tanpa PartsUsed', () => {
    const s = makeApp();
    expect(s.historyGetParts(null)).toEqual([]);
    expect(s.historyGetParts({})).toEqual([]);
    expect(s.historyGetParts({ PartsUsed: '' })).toEqual([]);
    expect(s.historyGetParts({ PartsUsed: '   ' })).toEqual([]);
  });

  it('meneruskan array apa adanya', () => {
    const s = makeApp();
    const parts = [{ id: 'P1', qty: 2 }];
    expect(s.historyGetParts({ PartsUsed: parts })).toBe(parts);
  });

  it('mem-parse string JSON', () => {
    const s = makeApp();
    expect(s.historyGetParts({ PartsUsed: '[{"id":"P1","qty":1}]' })).toEqual([{ id: 'P1', qty: 1 }]);
  });

  it('JSON non-array dan JSON rusak menghasilkan []', () => {
    const s = makeApp();
    expect(s.historyGetParts({ PartsUsed: '{"a":1}' })).toEqual([]);
    expect(s.historyGetParts({ PartsUsed: '[rusak' })).toEqual([]);
  });

  it('membuka format objek Firebase {key:{id,qty}}', () => {
    const s = makeApp();
    const raw = { k1: { id: 'P1', qty: 1 }, k2: { id: 'P2', qty: 3 } };
    expect(s.historyGetParts({ PartsUsed: raw })).toEqual([{ id: 'P1', qty: 1 }, { id: 'P2', qty: 3 }]);
  });

  it('objek tanpa field id menghasilkan []', () => {
    const s = makeApp();
    expect(s.historyGetParts({ PartsUsed: { k1: { nama: 'x' } } })).toEqual([]);
    expect(s.historyGetParts({ PartsUsed: {} })).toEqual([]);
  });

  it('membuka Alpine Proxy lewat window.Alpine.raw', () => {
    const s = makeApp();
    window.Alpine = { raw: () => [{ id: 'P9', qty: 1 }] };
    expect(s.historyGetParts({ PartsUsed: { k1: { id: 'P9', qty: 1 } } })).toEqual([{ id: 'P9', qty: 1 }]);
    delete window.Alpine;
  });
});

describe('app.js: historyFilteredLogs + paging', () => {
  it('memfilter berdasarkan unit, jenis, status, dan rentang tanggal', () => {
    const s = makeApp();
    s.logs = [log(), log({ EquipmentID: 'EQ-2', Jenis: 'Preventive', Status: 'Pending', Tanggal: '2026-09-01' })];
    s.historyEquipId = 'EQ-1';
    expect(s.historyFilteredLogs).toHaveLength(1);
    s.historyEquipId = 'all';
    s.historyFilterType = 'Preventive';
    expect(s.historyFilteredLogs).toHaveLength(1);
    s.historyFilterType = '';
    s.historyFilterStatus = 'Complete';
    expect(s.historyFilteredLogs).toHaveLength(1);
    s.historyFilterStatus = '';
    s.historyDateFrom = '2026-10-01';
    expect(s.historyFilteredLogs).toHaveLength(1);
    s.historyDateFrom = '';
    s.historyDateTo = '2026-09-15';
    expect(s.historyFilteredLogs).toHaveLength(1);
  });

  it('pencarian teks mencakup woNumber, deskripsi, teknisi, dan EquipmentID', () => {
    const s = makeApp();
    s.logs = [log(), log({ woNumber: 'WO-777', Deskripsi: 'Kalibrasi', Technician: 'Sari', EquipmentID: 'EQ-9' })];
    for (const q of ['WO-777', 'kalibrasi', 'sari', 'eq-9']) {
      s.historySearch = q;
      expect(s.historyFilteredLogs).toHaveLength(1);
    }
    s.historySearch = 'tidak-ada';
    expect(s.historyFilteredLogs).toHaveLength(0);
  });

  it('pencarian mencocokkan nama part dan part number', () => {
    const s = makeApp();
    s.allParts = [{ PartID: 'P1', NamaPart: 'Bearing', PartNumber: 'BRG-77' }];
    s.logs = [log({ PartsUsed: [{ id: 'P1', qty: 1 }] })];
    s.historySearch = 'bearing';
    expect(s.historyFilteredLogs).toHaveLength(1);
    s.historySearch = 'brg-77';
    expect(s.historyFilteredLogs).toHaveLength(1);
  });

  it('mengurutkan numerik untuk Downtime dan Cost', () => {
    const s = makeApp();
    s.logs = [log({ Downtime: 1, Cost: 900 }), log({ Downtime: 5, Cost: 100 })];
    s.historySortField = 'Downtime';
    s.historySortDir = 'desc';
    expect(s.historyFilteredLogs.map(l => l.Downtime)).toEqual([5, 1]);
    s.historySortField = 'Cost';
    s.historySortDir = 'asc';
    expect(s.historyFilteredLogs.map(l => l.Cost)).toEqual([100, 900]);
  });

  it('mengurutkan teks dan menangani field kosong', () => {
    const s = makeApp();
    s.logs = [log({ woNumber: 'B' }), log({ woNumber: 'A' }), log({ woNumber: undefined })];
    s.historySortField = 'woNumber';
    s.historySortDir = 'asc';
    expect(s.historyFilteredLogs.map(l => l.woNumber)).toEqual([undefined, 'A', 'B']);
  });

  it('historyTotalPages + historyCurrentPageLogs memotong per halaman', () => {
    const s = makeApp();
    s.logs = Array.from({ length: 25 }, (_, i) => log({ woNumber: `WO-${i}` }));
    s.historyPerPage = 10;
    s.historyPage = 1;
    expect(s.historyTotalPages).toBe(3);
    expect(s.historyCurrentPageLogs).toHaveLength(10);
    s.historyPage = 3;
    expect(s.historyCurrentPageLogs).toHaveLength(5);
  });

  it('historyPartRows memecah log per part dan menyisipkan baris tanpa part', () => {
    const s = makeApp();
    s.historyPerPage = 10;
    s.logs = [
      log({ woNumber: 'WO-A', PartsUsed: [{ id: 'P1' }, { id: 'P2' }] }),
      log({ woNumber: 'WO-B', PartsUsed: '' }),
    ];
    const rows = s.historyPartRows;
    expect(rows).toHaveLength(3);
    expect(rows[0].part).toEqual({ id: 'P1' });
    expect(rows[2].part).toBe(null);
  });

  it('historySetSort membalik arah pada field yang sama', () => {
    const s = makeApp();
    s.historySetSort('Cost');
    expect(s.historySortField).toBe('Cost');
    expect(s.historySortDir).toBe('desc');
    s.historySetSort('Cost');
    expect(s.historySortDir).toBe('asc');
    s.historySetSort('Tanggal');
    expect(s.historySortDir).toBe('desc');
  });

  it('historyPrevPage / historyNextPage menghormati batas', () => {
    const s = makeApp();
    s.logs = Array.from({ length: 25 }, (_, i) => log({ woNumber: `WO-${i}` }));
    s.historyPerPage = 10;
    s.historyPage = 1;
    s.historyPrevPage();
    expect(s.historyPage).toBe(1);
    s.historyNextPage();
    expect(s.historyPage).toBe(2);
    s.historyPage = 3;
    s.historyNextPage();
    expect(s.historyPage).toBe(3);
  });
});

describe('app.js: history export', () => {
  it('historyExportPDF memperingatkan saat unit belum dipilih', () => {
    const s = makeApp();
    s.historyExportPDF();
    expect(s.showNotification).toHaveBeenCalledWith('Select an equipment first', 'warning');
  });

  it('historyExportPDF memanggil window.exportModule bila tersedia', () => {
    const s = makeApp();
    s.historyEquipId = 'EQ-1';
    s.equipment = [{ EquipmentID: 'EQ-1' }];
    s.logs = [log()];
    const exportHistoryPDF = vi.fn();
    window.exportModule = { exportHistoryPDF };
    s.historyExportPDF();
    expect(exportHistoryPDF).toHaveBeenCalledWith(s.historyFilteredLogs, { EquipmentID: 'EQ-1' });
    delete window.exportModule;
  });

  it('historyExportPDF memberi error saat modul export tidak ada', () => {
    const s = makeApp();
    s.historyEquipId = 'EQ-1';
    s.historyExportPDF();
    expect(s.showNotification).toHaveBeenCalledWith('Export module not ready', 'error');
  });

  it('historyExportExcel memakai modul atau fallback global', () => {
    const s = makeApp();
    s.historyEquipId = 'EQ-1';
    s.logs = [log()];
    const exportHistoryExcel = vi.fn();
    window.exportModule = { exportHistoryExcel };
    s.historyExportExcel();
    expect(exportHistoryExcel).toHaveBeenCalled();
    delete window.exportModule;

    const fallback = vi.fn();
    window.exportHistoryFallback = fallback;
    s.historyExportExcel();
    expect(fallback).toHaveBeenCalled();
    delete window.exportHistoryFallback;
  });

  it('historyPrint memanggil window.print', () => {
    const s = makeApp();
    const print = vi.fn();
    window.print = print;
    s.historyPrint();
    expect(print).toHaveBeenCalled();
  });
});

describe('app.js: usageHistoryLogs', () => {
  it('kosong tanpa part terpilih atau tanpa logs', () => {
    const s = makeApp();
    expect(s.usageHistoryLogs).toEqual([]);
    s.usageHistoryPartId = 'P1';
    s.logs = null;
    expect(s.usageHistoryLogs).toEqual([]);
  });

  it('memfilter log yang memakai part tertentu (array maupun string JSON)', () => {
    const s = makeApp();
    s.usageHistoryPartId = 'P1';
    s.logs = [
      log({ woNumber: 'WO-1', PartsUsed: [{ id: 'P1' }] }),
      log({ woNumber: 'WO-2', PartsUsed: '[{"id":"P1"}]' }),
      log({ woNumber: 'WO-3', PartsUsed: [{ id: 'P2' }] }),
      log({ woNumber: 'WO-4', PartsUsed: null }),
    ];
    expect(s.usageHistoryLogs.map(l => l.woNumber)).toEqual(['WO-1', 'WO-2']);
  });
});

describe('app.js: audit trail', () => {
  it('formatAuditTime mengembalikan "-" untuk nilai kosong', () => {
    const s = makeApp();
    expect(s.formatAuditTime('')).toBe('-');
    expect(s.formatAuditTime(null)).toBe('-');
  });

  it('formatAuditTime memformat tanggal valid dan tidak melempar untuk input rusak', () => {
    const s = makeApp();
    expect(typeof s.formatAuditTime('2026-10-19T03:00:00Z')).toBe('string');
    expect(s.formatAuditTime('2026-10-19T03:00:00Z')).not.toBe('-');
    // jalur catch: formatter melempar → potong 10 karakter pertama
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(() => { throw new Error('x'); });
    expect(s.formatAuditTime('2026-10-19T03:00:00Z')).toBe('2026-10-19');
    spy.mockRestore();
  });

  it('auditActionTac / auditMarkerTac / auditIconTac memetakan tiap kategori aksi', () => {
    const s = makeApp();
    expect(s.auditActionTac('Delete WO')).toContain('emergency');
    expect(s.auditActionTac('Create WO')).toContain('operational');
    expect(s.auditActionTac('Login')).toContain('operational');
    expect(s.auditActionTac('Update WO')).toContain('repair');
    expect(s.auditActionTac('')).toContain('surface-container-highest');

    expect(s.auditMarkerTac('Reject')).toBe('bg-tac-status-emergency');
    expect(s.auditMarkerTac('Complete')).toBe('bg-tac-status-operational');
    expect(s.auditMarkerTac('Edit')).toBe('bg-tac-status-repair');
    expect(s.auditMarkerTac('Lain')).toBe('bg-tac-status-standby');

    expect(s.auditIconTac('Cancel')).toBe('block');
    expect(s.auditIconTac('Login')).toBe('logout');
    expect(s.auditIconTac('Create WO')).toBe('add_circle');
    expect(s.auditIconTac('Update')).toBe('edit_note');
    expect(s.auditIconTac('Approve')).toBe('check_circle');
    expect(s.auditIconTac('Lain')).toBe('history');
  });

  it('auditRoleTac membedakan admin, supervisor, dan lainnya', () => {
    const s = makeApp();
    expect(s.auditRoleTac('admin')).toContain('emergency');
    expect(s.auditRoleTac('supervisor')).toContain('primary');
    expect(s.auditRoleTac('user')).toContain('surface-container-highest');
  });

  it('filteredAudit memfilter aksi, teks, dan memotong auditLimit', () => {
    const s = makeApp();
    s.auditLogs = [
      { action: 'Create WO', email: 'a@b.c', details: 'WO-1', uid: 'u1' },
      { action: 'Delete WO', email: 'x@y.z', details: 'WO-2', uid: 'u2' },
    ];
    s.auditLimit = 10;
    expect(s.filteredAudit).toHaveLength(2);
    s.auditActionFilter = 'Create WO';
    expect(s.filteredAudit).toHaveLength(1);
    s.auditActionFilter = '';
    s.auditFilter = 'u2';
    expect(s.filteredAudit).toHaveLength(1);
    s.auditFilter = 'x@y.z';
    expect(s.filteredAudit).toHaveLength(1);
    s.auditFilter = 'wo-2';
    expect(s.filteredAudit).toHaveLength(1);
    s.auditFilter = '';
    s.auditLimit = 1;
    expect(s.filteredAudit).toHaveLength(1);
  });

  it('auditKpi menghitung total, aktor, admin, dan kategori aksi', () => {
    const s = makeApp();
    s.auditLimit = 100;
    s.auditLogs = [
      { action: 'Login', email: 'a@b.c', role: 'admin' },
      { action: 'Create WO', email: 'a@b.c' },
      { action: 'Update WO', uid: 'u2' },
      { action: 'Delete WO', email: 'c@d.e' },
      { action: 'Approve WO', email: 'c@d.e' },
    ];
    const kpi = s.auditKpi;
    expect(kpi.total).toBe(5);
    expect(kpi.actors).toBe(3);
    expect(kpi.admins).toBe(1);
    expect(kpi.logins).toBe(1);
    expect(kpi.creates).toBe(1);
    expect(kpi.edits).toBe(1);
    expect(kpi.deletes).toBe(1);
    expect(kpi.approvals).toBe(1);
    expect(kpi.shown).toBe(5);
  });

  it('loadAuditLogs keluar lebih awal untuk non-admin', async () => {
    const s = makeApp();
    s.isAdmin = false;
    await s.loadAuditLogs();
    expect(h.state.calls).toHaveLength(0);
    expect(s.auditLoading).toBe(false);
  });

  it('loadAuditLogs memuat, memfilter aksi kosong, dan mengurutkan terbaru dulu', async () => {
    h.state.snap = {
      exists: () => true,
      val: () => ({
        k1: { action: 'Login', timestamp: 10 },
        k2: { action: '', timestamp: 99 },
        k3: { action: 'Delete', timestamp: 5 },
      }),
    };
    const s = makeApp();
    s.isAdmin = true;
    await s.loadAuditLogs();
    expect(s.auditLogs.map(e => e._key)).toEqual(['k1', 'k3']);
    expect(s.auditLoading).toBe(false);
  });

  it('loadAuditLogs mengosongkan daftar saat snapshot tidak ada', async () => {
    const s = makeApp();
    s.isAdmin = true;
    s.auditLogs = [{ action: 'lama' }];
    await s.loadAuditLogs();
    expect(s.auditLogs).toEqual([]);
  });

  it('loadAuditLogs menangani error pembacaan', async () => {
    h.state.snap = { exists: () => { throw new Error('rtdb down'); } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = makeApp();
    s.isAdmin = true;
    s.auditLogs = [{ action: 'lama' }];
    await s.loadAuditLogs();
    expect(s.auditLogs).toEqual([]);
    expect(s.auditLoading).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
