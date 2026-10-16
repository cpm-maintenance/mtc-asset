// @vitest-environment jsdom
/**
 * Tests untuk getter/helper halaman Tactical Slate tahap H-3 lanjutan:
 * Audit Trail (auditKpi), Performance (perfKpi), Monthly Plan (mpMonthName).
 *
 * `app()` mengembalikan object Alpine reactive; getter ini murni derived state
 * sehingga bisa dipanggil langsung tanpa mount Alpine.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function stubFirebaseGlobals() {
  window.db = { name: 'mock-db' };
  window.ref = vi.fn(() => ({}));
  window.query = vi.fn(() => ({}));
  window.limitToLast = vi.fn(() => ({}));
  window.orderByChild = vi.fn(() => ({}));
  window.onValue = vi.fn(() => vi.fn());
  window.onChildAdded = vi.fn(() => vi.fn());
  window.get = vi.fn(async () => ({ val: () => null, exists: () => false }));
}

async function makeApp(overrides = {}) {
  stubFirebaseGlobals();
  const { app } = await import('../src/js/app.js');
  const state = app();
  state.auditLogs = [];
  state.auditFilter = '';
  state.auditActionFilter = '';
  state.auditLimit = 200;
  state.performanceData = [];
  state.perfFilterEquip = '';
  state.perfFilterArea = '';
  return Object.assign(state, overrides);
}

describe('Audit Trail — telemetri Tactical Slate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('auditKpi menghitung per-aksi, actor unik, dan admin', async () => {
    const a = await makeApp();
    a.auditLogs = [
      { action: 'Login', email: 'andi@x.id', role: 'admin' },
      { action: 'Create', email: 'andi@x.id', role: 'admin' },
      { action: 'Edit', email: 'budi@x.id', role: 'user' },
      { action: 'Delete', email: 'budi@x.id', role: 'user' },
      { action: 'Approve', email: 'cucuk@x.id', role: 'supervisor' },
      { action: 'Complete', email: 'cucuk@x.id', role: 'supervisor' },
    ];

    const k = a.auditKpi;
    expect(k.total).toBe(6);
    expect(k.actors).toBe(3);
    expect(k.admins).toBe(2);
    expect(k.logins).toBe(1);
    expect(k.creates).toBe(1);
    expect(k.edits).toBe(1);
    expect(k.deletes).toBe(1);
    expect(k.approvals).toBe(2);
    expect(k.shown).toBe(6);
  });

  it('auditKpi memakai filteredAudit untuk kolom "tampil sekarang"', async () => {
    const a = await makeApp();
    a.auditLogs = [
      { action: 'Login', email: 'a@x.id' },
      { action: 'Delete', email: 'b@x.id' },
    ];
    a.auditActionFilter = 'Delete';
    expect(a.auditKpi.total).toBe(2);
    expect(a.auditKpi.shown).toBe(1);
  });

  it('auditKpi aman saat kosong', async () => {
    const a = await makeApp();
    const k = a.auditKpi;
    expect(k.total).toBe(0);
    expect(k.actors).toBe(0);
    expect(k.shown).toBe(0);
  });

  it('helper badge/marker/ikon audit mengembalikan nilai tac-*', async () => {
    const a = await makeApp();
    expect(a.auditActionTac('Delete Log')).toContain('tac-status-emergency');
    expect(a.auditActionTac('Create')).toContain('tac-status-operational');
    expect(a.auditActionTac('Edit')).toContain('tac-status-repair');
    expect(a.auditMarkerTac('Login')).toBe('bg-tac-status-operational');
    expect(a.auditIconTac('Delete')).toBe('block');
    expect(a.auditIconTac('Login')).toBe('logout');
    expect(a.auditRoleTac('admin')).toContain('tac-status-emergency');
    expect(a.auditRoleTac('user')).toContain('tac-surface-container-highest');
  });
});

describe('Performance — telemetri Tactical Slate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('perfKpi menjumlahkan BD, event, dan rata-rata MA/PA/GAP', async () => {
    const a = await makeApp();
    a.performanceData = [
      { id: 'p1', bd: 4, events: [1, 2], bdSource: 'wo' },
      { id: 'p2', bd: 6, events: [1] },
    ];
    a.getFilteredPerfData = () => a.performanceData;
    a.calculateKPI = () => ({ ma: 90, pa: 80, gap: 10 });

    const k = a.perfKpi;
    expect(k.total).toBe(2);
    expect(k.bd).toBe(10);
    expect(k.events).toBe(3);
    expect(k.autoBd).toBe(1);
    expect(k.avgMa).toBe(90);
    expect(k.avgPa).toBe(80);
    expect(k.avgGap).toBe(10);
  });

  it('perfKpi aman saat kosong (tanpa NaN)', async () => {
    const a = await makeApp();
    a.getFilteredPerfData = () => [];
    const k = a.perfKpi;
    expect(k.total).toBe(0);
    expect(k.bd).toBe(0);
    expect(k.avgMa).toBe(0);
    expect(k.avgGap).toBe(0);
  });

  it('perfGapTac merah saat gap negatif', async () => {
    const a = await makeApp();
    expect(a.perfGapTac(-3)).toBe('bg-tac-status-emergency');
    expect(a.perfGapTac(3)).toBe('bg-tac-status-operational');
  });
});

describe('Monthly Plan — helper Tactical Slate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('mpMonthName menerjemahkan indeks bulan', async () => {
    const a = await makeApp();
    a.mpMonth = 0;
    expect(a.mpMonthName).toBe('JANUARY');
    a.mpMonth = '9';
    expect(a.mpMonthName).toBe('OCTOBER');
    a.mpMonth = 11;
    expect(a.mpMonthName).toBe('DECEMBER');
  });

  it('mpMonthName aman untuk nilai tak dikenal', async () => {
    const a = await makeApp();
    a.mpMonth = 99;
    expect(a.mpMonthName).toBe('-');
  });

  it('mpStatusTac / mpStatusMarkerTac mengembalikan nilai tac-*', async () => {
    const a = await makeApp();
    expect(a.mpStatusTac('completed')).toContain('tac-status-operational');
    expect(a.mpStatusTac('cancelled')).toContain('tac-surface-container-highest');
    expect(a.mpStatusTac('pending')).toContain('tac-status-repair');
    expect(a.mpStatusMarkerTac('completed')).toBe('bg-tac-status-operational');
    expect(a.mpStatusMarkerTac('cancelled')).toBe('bg-tac-status-standby');
  });
});
