// @vitest-environment jsdom
/**
 * Tests untuk getter/helper Planning Board (porting Tactical Slate).
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
  state.logs = [];
  state.activeWorkOrders = [];
  state.equipment = [];
  state.planningSearch = '';
  state.planningFilterTech = '';
  state.planningFilterPriority = '';
  return Object.assign(state, overrides);
}

describe('Planning Board — telemetri & kolom (Tactical Slate)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('planningKpi menghitung status, overdue, unassigned, backlog hours', async () => {
    const a = await makeApp();
    const past = '2020-01-01';
    const future = '2099-12-31';
    a.logs = [
      { LogID: '1', woNumber: 'WO-1', Status: 'Pending', dueDate: past, estimatedHours: 4, assignedTo: 'Andi' },
      { LogID: '2', woNumber: 'WO-2', Status: 'Draft', dueDate: future, estimatedHours: 2 },
      { LogID: '3', woNumber: 'WO-3', Status: 'Approved', dueDate: future, estimatedHours: 3, assignedTo: 'Budi' },
      { LogID: '4', woNumber: 'WO-4', Status: 'In Progress', dueDate: future, estimatedHours: 5, assignedTo: 'Budi' },
      { LogID: '5', woNumber: 'WO-5', Status: 'Completed', dueDate: past, estimatedHours: 9, assignedTo: 'Budi' },
    ];

    const k = a.planningKpi;
    expect(k.total).toBe(5);
    expect(k.open).toBe(2);
    expect(k.approved).toBe(1);
    expect(k.inProgress).toBe(1);
    expect(k.completed).toBe(1);
    expect(k.overdue).toBe(1); // hanya #1 — open + lewat due date
    expect(k.unassigned).toBe(1); // hanya #2
    expect(k.hours).toBe(14); // 4+2+3+5 — Completed dikecualikan
    expect(k.doneRate).toBe(20);
  });

  it('planningKpi aman saat belum ada data (tanpa NaN)', async () => {
    const a = await makeApp();
    const k = a.planningKpi;
    expect(k.total).toBe(0);
    expect(k.hours).toBe(0);
    expect(k.doneRate).toBe(0);
  });

  it('planningColumns membagi WO ke 4 kolom sesuai status', async () => {
    const a = await makeApp();
    a.logs = [
      { LogID: '1', woNumber: 'WO-1', Status: 'Pending' },
      { LogID: '2', woNumber: 'WO-2', Status: 'Draft' },
      { LogID: '3', woNumber: 'WO-3', Status: 'Approved' },
      { LogID: '4', woNumber: 'WO-4', Status: 'In Progress' },
      { LogID: '5', woNumber: 'WO-5', Status: 'Completed' },
    ];

    const cols = a.planningColumns;
    expect(cols.map((c) => c.key)).toEqual(['open', 'approved', 'progress', 'completed']);
    expect(cols.map((c) => c.items.length)).toEqual([2, 1, 1, 1]);
    expect(cols[0].drop).toBe('Pending'); // Pending + Draft jatuh ke kolom OPEN
  });

  it('filter teknisi, prioritas, dan search menyempitkan kolom', async () => {
    const a = await makeApp();
    a.logs = [
      {
        LogID: '1',
        woNumber: 'WO-1',
        Status: 'Pending',
        Deskripsi: 'Pump seal leak',
        assignedTo: 'Andi',
        woPriority: 'Urgent',
      },
      {
        LogID: '2',
        woNumber: 'WO-2',
        Status: 'Pending',
        Deskripsi: 'Belt splice',
        assignedTo: 'Budi',
        woPriority: 'Normal',
      },
    ];

    a.planningFilterTech = 'Andi';
    expect(a.planningFilteredWOs).toHaveLength(1);

    a.planningFilterTech = '';
    a.planningFilterPriority = 'Normal';
    expect(a.planningFilteredWOs).toHaveLength(1);

    a.planningFilterPriority = '';
    a.planningSearch = 'belt';
    expect(a.planningFilteredWOs).toHaveLength(1);
    expect(a.planningColumns[0].items).toHaveLength(1);
  });

  it('helper badge planning mengembalikan kelas tac-*', async () => {
    const a = await makeApp();
    expect(a.planningStatusTac('Completed')).toContain('tac-status-operational');
    expect(a.planningStatusTac('In Progress')).toContain('tac-sync-cyan');
    expect(a.planningMarkerTac('In Progress')).toBe('bg-tac-sync-cyan');
    expect(a.planningPriorityTac('Emergency')).toContain('tac-status-emergency');
    expect(a.planningBarTac('Approved')).toContain('bg-tac-primary/40');
  });
});
