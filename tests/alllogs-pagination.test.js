// @vitest-environment jsdom
/**
 * Tests untuk getter/method pagination All Logs (P3-3).
 *
 * `app()` mengembalikan object Alpine reactive; kita panggil langsung tanpa
 * mount Alpine karena getter ini murni derived state.
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
  state.logs = [];
  state.filterDateFrom = '';
  state.filterDateTo = '';
  state.allLogsLimit = 30;
  return Object.assign(state, overrides);
}

function makeLogs(n, { startId = 0, equip = 'EQ' } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    LogID: `L${startId + i}`,
    EquipmentID: `${equip}${startId + i}`,
    Tanggal: '2026-10-01',
  }));
}

describe('All Logs pagination (P3-3)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('filteredAllLogsAll mengembalikan seluruh log non-EXTERNAL', async () => {
    const a = await makeApp();
    a.logs = [...makeLogs(75), { LogID: 'EXT', EquipmentID: 'EXTERNAL' }];
    expect(a.filteredAllLogsAll).toHaveLength(75);
  });

  it('filteredAllLogs membatasi render ke allLogsLimit', async () => {
    const a = await makeApp();
    a.logs = makeLogs(75);
    expect(a.filteredAllLogs).toHaveLength(30);
    expect(a.canLoadMoreAllLogs).toBe(true);
  });

  it('loadMoreAllLogs menambah 30 item tiap panggilan', async () => {
    const a = await makeApp();
    a.logs = makeLogs(75);
    a.loadMoreAllLogs();
    expect(a.filteredAllLogs).toHaveLength(60);
    a.loadMoreAllLogs();
    expect(a.filteredAllLogs).toHaveLength(75);
    expect(a.canLoadMoreAllLogs).toBe(false);
  });

  it('canLoadMoreAllLogs false saat data <= limit', async () => {
    const a = await makeApp();
    a.logs = makeLogs(10);
    expect(a.filteredAllLogs).toHaveLength(10);
    expect(a.canLoadMoreAllLogs).toBe(false);
  });

  it('loadMoreAllLogs tidak menambah saat tidak ada lagi', async () => {
    const a = await makeApp();
    a.logs = makeLogs(10);
    a.loadMoreAllLogs();
    expect(a.allLogsLimit).toBe(30);
  });

  it('filter tanggal diterapkan sebelum pagination', async () => {
    const a = await makeApp();
    a.logs = [
      ...makeLogs(40).map((l) => ({ ...l, Tanggal: '2026-09-01' })),
      ...makeLogs(40, { startId: 100 }).map((l) => ({ ...l, Tanggal: '2026-10-15' })),
    ];
    a.filterDateFrom = '2026-10-01';
    expect(a.filteredAllLogsAll).toHaveLength(40);
    expect(a.filteredAllLogs).toHaveLength(30);
    expect(a.canLoadMoreAllLogs).toBe(true);
  });

  it('log EXTERNAL tidak ikut dihitung', async () => {
    const a = await makeApp();
    a.logs = [
      { LogID: 'E1', EquipmentID: 'EXTERNAL' },
      { LogID: 'E2', EquipmentID: 'EXTERNAL' },
      ...makeLogs(5),
    ];
    expect(a.filteredAllLogsAll).toHaveLength(5);
  });
});

describe('All Logs — filter jenis & telemetri Tactical Slate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('allLogsJenisFilter menyaring sebelum pagination', async () => {
    const a = await makeApp();
    a.logs = [
      ...makeLogs(5).map((l) => ({ ...l, Jenis: 'Breakdown' })),
      ...makeLogs(5, { startId: 50 }).map((l) => ({ ...l, Jenis: 'PM' })),
    ];
    a.allLogsJenisFilter = 'Breakdown';
    expect(a.filteredAllLogsAll).toHaveLength(5);
    expect(a.filteredAllLogs.every((l) => l.Jenis === 'Breakdown')).toBe(true);
  });

  it('logJenisOptions unik & terurut dari data nyata', async () => {
    const a = await makeApp();
    a.logs = [
      { LogID: '1', EquipmentID: 'E1', Jenis: 'PM' },
      { LogID: '2', EquipmentID: 'E2', Jenis: 'Breakdown' },
      { LogID: '3', EquipmentID: 'E3', Jenis: 'PM' },
    ];
    expect(a.logJenisOptions).toEqual(['Breakdown', 'PM']);
  });

  it('logKpi menghitung downtime, MTTR breakdown, closure, unit', async () => {
    const a = await makeApp();
    a.logs = [
      { LogID: '1', EquipmentID: 'E1', Jenis: 'Breakdown', Status: 'Completed', Downtime: 4, Cost: 1000000 },
      { LogID: '2', EquipmentID: 'E1', Jenis: 'Breakdown', Status: 'Pending', Downtime: 6, Cost: 500000 },
      { LogID: '3', EquipmentID: 'E2', Jenis: 'PM', Status: 'In Progress', Downtime: 0, Cost: 0 },
      { LogID: '4', EquipmentID: 'E2', Jenis: 'PM', Status: 'Completed' },
    ];
    const k = a.logKpi;
    expect(k.total).toBe(4);
    expect(k.pending).toBe(1);
    expect(k.active).toBe(1);
    expect(k.done).toBe(2);
    expect(k.breakdown).toBe(2);
    expect(k.downtime).toBe(10);
    expect(k.cost).toBe(1500000);
    expect(k.mttr).toBe(5);
    expect(k.closure).toBe(50);
    expect(k.units).toBe(2);
  });

  it('logKpi aman saat tidak ada log (tanpa NaN/Infinity)', async () => {
    const a = await makeApp();
    const k = a.logKpi;
    expect(k.total).toBe(0);
    expect(k.mttr).toBe(0);
    expect(k.closure).toBe(0);
    expect(k.units).toBe(0);
  });

  it('helper badge mengembalikan kelas tac-* untuk tiap status/jenis', async () => {
    const a = await makeApp();
    expect(a.logStatusTac('Completed')).toContain('tac-status-operational');
    expect(a.logStatusTac('In Progress')).toContain('tac-sync-cyan');
    expect(a.logMarkerTac('Breakdown')).toBe('bg-tac-status-emergency');
    expect(a.logMarkerTac('PM')).toBe('bg-tac-status-operational');
    expect(a.logIconTac('Repair')).toBe('engineering');
    expect(a.logPriorityTac('Emergency')).toContain('tac-status-emergency');
  });
});
