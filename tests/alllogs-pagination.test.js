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
