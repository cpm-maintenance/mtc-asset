// @vitest-environment jsdom
/**
 * Integration tests for src/js/modules/data.js
 *
 * Covers:
 *  - safeProcessFirebaseData() pure transformation (edge cases)
 *  - dataModule methods with a mocked Firebase `window.*` surface
 *    (listeners, pagination, offline queue, conflict resolution, delete)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock side-effect modules so importing data.js has no network/IDB cost.
vi.mock('../src/js/modules/indexeddb.js', () => ({
    CAN_USE_IDB: true,
    idbManager: {
        db: { name: 'mock-idb' },
        getAll: vi.fn(async () => []),
        putBulk: vi.fn(async () => {}),
        getPendingOpsCount: vi.fn(async () => 0),
        getPendingOps: vi.fn(async () => []),
        addPendingOp: vi.fn(async () => {}),
        removePendingOp: vi.fn(async () => {}),
    },
}));

vi.mock('../src/js/modules/notification.js', () => ({
    sendBrowserNotification: vi.fn(),
}));

vi.mock('../src/js/modules/push-client.js', () => ({
    sendPushViaProxy: vi.fn(),
}));

import { safeProcessFirebaseData, dataModule } from '../src/js/modules/data.js';
import { idbManager } from '../src/js/modules/indexeddb.js';
import { sendBrowserNotification } from '../src/js/modules/notification.js';
import { sendPushViaProxy } from '../src/js/modules/push-client.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/** Install a fake Firebase surface on the jsdom `window`. */
function setupFirebaseMock(getImpl) {
    const set = vi.fn(async () => {});
    const remove = vi.fn(async () => {});
    const runTransaction = vi.fn(async (_ref, fn) => fn(0));
    const unsub = vi.fn();

    window.db = { name: 'mock-db' };
    window.ref = vi.fn((_db, path) => ({ path }));
    window.query = vi.fn((ref, ...constraints) => ({ ref, constraints }));
    window.limitToLast = vi.fn((n) => ({ type: 'limitToLast', n }));
    window.endBefore = vi.fn((k) => ({ type: 'endBefore', k }));
    window.orderByChild = vi.fn((f) => ({ type: 'orderByChild', f }));
    window.endAt = vi.fn((v) => ({ type: 'endAt', v }));
    window.equalTo = vi.fn((v) => ({ type: 'equalTo', v }));
    window.get = vi.fn(getImpl || (async () => ({ val: () => null, exists: () => false })));
    window.set = set;
    window.remove = remove;
    window.runTransaction = runTransaction;
    window.onValue = vi.fn(() => unsub);
    window.onChildAdded = vi.fn(() => unsub);
    window.Alpine = { raw: (x) => x };
    window._firebaseReadyResolve = null;

    return { set, remove, runTransaction, unsub };
}

/** Build a fresh dataModule-like context with the reactive state fields it touches.
 *  Uses Object.create so prototype getters (paginatedEquip/canLoadMoreEquip) stay live. */
function makeCtx(overrides = {}) {
    const ctx = Object.create(dataModule);
    return Object.assign(ctx, {
        _listeners: [],
        isLoggedIn: true,
        isOnline: true,
        isLoading: false,
        user: { uid: 'uid-user' },
        userRole: 'user',
        notifications: [],
        equipment: [],
        allParts: [],
        logs: [],
        performanceData: [],
        activeWorkOrders: [],
        dashboardStats: { totalEquip: 0, overduePM: 0, lowStock: 0, totalDowntime: 0 },
        search: '',
        filteredEquip: [],
        selectedEquip: null,
        currentPage: 'dash',
        confirmDelete: vi.fn(async () => true),
        showNotification: vi.fn(),
        ...overrides,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    idbManager.getAll.mockResolvedValue([]);
    idbManager.getPendingOps.mockResolvedValue([]);
    idbManager.getPendingOpsCount.mockResolvedValue(0);
    delete window.app;
    delete window.appState;
    setupFirebaseMock();
});

// ---------------------------------------------------------------------------
// safeProcessFirebaseData()
// ---------------------------------------------------------------------------

describe('safeProcessFirebaseData', () => {
    it('returns [] for null/undefined input', () => {
        expect(safeProcessFirebaseData(null)).toEqual([]);
        expect(safeProcessFirebaseData(undefined)).toEqual([]);
    });

    it('converts a keyed object into an array of values', () => {
        const out = safeProcessFirebaseData({
            a: { LogID: 'L1', Deskripsi: 'one' },
            b: { LogID: 'L2', Deskripsi: 'two' },
        });
        expect(out).toHaveLength(2);
        expect(out.map((x) => x.LogID).sort()).toEqual(['L1', 'L2']);
    });

    it('parses PartsUsed when stored as a JSON string', () => {
        const out = safeProcessFirebaseData({
            a: { LogID: 'L1', PartsUsed: '[{"id":"P1","qty":2}]' },
        });
        expect(Array.isArray(out[0].PartsUsed)).toBe(true);
        expect(out[0].PartsUsed[0]).toEqual({ id: 'P1', qty: 2 });
    });

    it('recovers PartsUsed corrupted with HTML entities', () => {
        const out = safeProcessFirebaseData({
            a: { LogID: 'L1', PartsUsed: '[{&quot;id&quot;:&quot;P1&quot;,&quot;qty&quot;:3}]' },
        });
        expect(Array.isArray(out[0].PartsUsed)).toBe(true);
        expect(out[0].PartsUsed[0]).toEqual({ id: 'P1', qty: 3 });
    });

    it('falls back to [] for unparseable PartsUsed', () => {
        const out = safeProcessFirebaseData({ a: { LogID: 'L1', PartsUsed: 'not-json' } });
        expect(out[0].PartsUsed).toEqual([]);
    });

    it('keeps PartsUsed when it is already an array', () => {
        const parts = [{ id: 'P1', qty: 1 }];
        const out = safeProcessFirebaseData({ a: { LogID: 'L1', PartsUsed: parts } });
        expect(out[0].PartsUsed).toEqual(parts);
    });

    it('parses PhotoURLs JSON string and cleans encoded slashes', () => {
        const out = safeProcessFirebaseData({
            a: { LogID: 'L1', PhotoURLs: '["https:\\/\\/x.com&#x2F;a.jpg"]' },
        });
        expect(out[0].PhotoURLs).toEqual(['https://x.com/a.jpg']);
    });

    it('promotes singular PhotoURL to a PhotoURLs array', () => {
        const out = safeProcessFirebaseData({ a: { LogID: 'L1', PhotoURL: 'https://x.com/b.jpg' } });
        expect(out[0].PhotoURLs).toEqual(['https://x.com/b.jpg']);
    });

    it('decodes %2F percent-encoding inside PhotoURLs array', () => {
        const out = safeProcessFirebaseData({ a: { LogID: 'L1', PhotoURLs: ['https://x.com%2Fc.jpg'] } });
        expect(out[0].PhotoURLs).toEqual(['https://x.com/c.jpg']);
    });

    it('parses events JSON string into an array', () => {
        const out = safeProcessFirebaseData({ a: { id: 'PERF1', events: '[{"type":"oil"}]' } });
        expect(out[0].events).toEqual([{ type: 'oil' }]);
    });

    it('does not mutate the original item object', () => {
        const original = { LogID: 'L1', PartsUsed: '[{"id":"P1","qty":1}]' };
        safeProcessFirebaseData({ a: original });
        expect(typeof original.PartsUsed).toBe('string');
    });
});

// ---------------------------------------------------------------------------
// checkPendingWorkOrders()
// ---------------------------------------------------------------------------

describe('dataModule.checkPendingWorkOrders', () => {
    it('pushes a notification when pending WOs exist', async () => {
        const ctx = makeCtx();
        window.get = vi.fn(async () => ({
            val: () => ({
                L1: { Status: 'Pending', woNumber: 'WO-1', Jenis: 'Repair' },
                L2: { Status: 'Draft', woNumber: 'WO-2', Jenis: 'PM' },
                L3: { Status: 'Done', woNumber: 'WO-3', Jenis: 'PM' },
            }),
        }));

        await ctx.checkPendingWorkOrders();

        expect(ctx.notifications).toHaveLength(1);
        expect(ctx.notifications[0].message).toContain('2 Work Orders');
    });

    it('does nothing when no pending WOs exist', async () => {
        const ctx = makeCtx();
        window.get = vi.fn(async () => ({ val: () => ({ L1: { Status: 'Done', woNumber: 'WO-1', Jenis: 'PM' } }) }));
        await ctx.checkPendingWorkOrders();
        expect(ctx.notifications).toHaveLength(0);
    });

    it('also mirrors the notification onto window.app when present', async () => {
        const ctx = makeCtx();
        window.app = { notifications: [] };
        window.get = vi.fn(async () => ({ val: () => ({ L1: { Status: 'Pending', woNumber: 'WO-1', Jenis: 'Repair' } }) }));
        await ctx.checkPendingWorkOrders();
        expect(window.app.notifications).toHaveLength(1);
    });

    it('swallows errors from Firebase', async () => {
        const ctx = makeCtx();
        window.get = vi.fn(async () => {
            throw new Error('permission denied');
        });
        await expect(ctx.checkPendingWorkOrders()).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('dataModule pagination', () => {
    it('loadMoreLogs(reset) replaces logs and sorts by LogID desc', async () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L0' }] });
        window.get = vi.fn(async () => ({
            val: () => ({ a: { LogID: 'L2' }, b: { LogID: 'L5' }, c: { LogID: 'L1' } }),
        }));

        await ctx.loadMoreLogs(true);

        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L5', 'L2', 'L1']);
        expect(ctx.logsHasMore).toBe(false); // only 3 items < logsLimit(200)
    });

    it('loadMoreLogs without reset appends only unseen logs', async () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L5' }] });
        window.get = vi.fn(async () => ({ val: () => ({ a: { LogID: 'L5' }, b: { LogID: 'L3' } }) }));

        await ctx.loadMoreLogs();

        const ids = ctx.logs.map((l) => l.LogID);
        expect(ids.filter((x) => x === 'L5')).toHaveLength(1);
        expect(ids).toContain('L3');
    });

    it('paginatedEquip slices to page * limit when not searching', () => {
        const equipment = Array.from({ length: 50 }, (_, i) => ({ EquipmentID: 'EQ' + i }));
        const ctx = makeCtx({ equipment, search: '', equipPage: 1, equipLimit: 30 });
        expect(ctx.paginatedEquip).toHaveLength(30);
    });

    it('canLoadMoreEquip is true when more rows than the current page', () => {
        const equipment = Array.from({ length: 50 }, (_, i) => ({ EquipmentID: 'EQ' + i }));
        const ctx = makeCtx({ equipment, search: '', equipPage: 1, equipLimit: 30 });
        expect(ctx.canLoadMoreEquip).toBe(true);
    });

    it('canLoadMoreEquip is false when everything fits on one page', () => {
        const equipment = Array.from({ length: 10 }, (_, i) => ({ EquipmentID: 'EQ' + i }));
        const ctx = makeCtx({ equipment, search: '', equipPage: 1, equipLimit: 30 });
        expect(ctx.canLoadMoreEquip).toBe(false);
    });

    it('loadMoreEquipment flips equipHasMore when next page is short', async () => {
        const equipment = Array.from({ length: 10 }, (_, i) => ({ EquipmentID: 'EQ' + i }));
        const ctx = makeCtx({ equipment, filteredEquip: equipment.slice(0, 10), equipLimit: 30, equipHasMore: true });
        await ctx.loadMoreEquipment();
        expect(ctx.equipHasMore).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Offline queue + conflict resolution
// ---------------------------------------------------------------------------

describe('dataModule offline queue & sync', () => {
    it('queueOfflineOperation returns false while online (no queueing)', async () => {
        const ctx = makeCtx({ isOnline: true });
        const result = await ctx.queueOfflineOperation('equipment', { EquipmentID: 'EQ1' });
        expect(result).toBe(false);
        expect(idbManager.addPendingOp).not.toHaveBeenCalled();
    });

    it('queueOfflineOperation queues while offline', async () => {
        const ctx = makeCtx({ isOnline: false });
        const result = await ctx.queueOfflineOperation('equipment', { EquipmentID: 'EQ1' });
        expect(result).toBe(true);
        expect(idbManager.addPendingOp).toHaveBeenCalledOnce();
    });

    it('syncPendingOperations skips when offline', async () => {
        const ctx = makeCtx({ isOnline: false });
        await ctx.syncPendingOperations();
        expect(idbManager.getPendingOps).not.toHaveBeenCalled();
    });

    it('applies a pending op when it is newer than the server record', async () => {
        const { set } = setupFirebaseMock();
        const ctx = makeCtx();
        idbManager.getPendingOps.mockResolvedValue([
            { id: 1, type: 'equipment', data: { EquipmentID: 'EQ1', updatedAt: '2026-06-01T00:00:00Z' } },
        ]);
        window.get = vi.fn(async () => ({ exists: () => true, val: () => ({ updatedAt: '2025-01-01T00:00:00Z' }) }));

        await ctx.syncPendingOperations();

        expect(set).toHaveBeenCalledOnce();
        expect(idbManager.removePendingOp).toHaveBeenCalledWith(1);
    });

    it('skips a pending op when the server record is newer (last-write-wins)', async () => {
        const { set } = setupFirebaseMock();
        const ctx = makeCtx();
        idbManager.getPendingOps.mockResolvedValue([
            { id: 2, type: 'equipment', data: { EquipmentID: 'EQ1', updatedAt: '2025-01-01T00:00:00Z' } },
        ]);
        window.get = vi.fn(async () => ({ exists: () => true, val: () => ({ updatedAt: '2026-06-01T00:00:00Z' }) }));

        await ctx.syncPendingOperations();

        expect(set).not.toHaveBeenCalled();
        expect(idbManager.removePendingOp).toHaveBeenCalledWith(2);
    });

    it('applies a pending op when no server record exists yet', async () => {
        const { set } = setupFirebaseMock();
        const ctx = makeCtx();
        idbManager.getPendingOps.mockResolvedValue([
            { id: 3, type: 'parts', data: { PartID: 'P1', updatedAt: '2026-01-01T00:00:00Z' } },
        ]);
        window.get = vi.fn(async () => ({ exists: () => false, val: () => null }));

        await ctx.syncPendingOperations();

        expect(set).toHaveBeenCalledOnce();
    });

    it('dispatches delete-type ops via window.remove', async () => {
        const { remove } = setupFirebaseMock();
        const ctx = makeCtx();
        idbManager.getPendingOps.mockResolvedValue([
            { id: 4, type: 'delete', data: { node: 'Equipment', id: 'EQ9' } },
        ]);
        window.get = vi.fn(async () => ({ exists: () => false, val: () => null }));

        await ctx.syncPendingOperations();

        expect(remove).toHaveBeenCalledOnce();
        expect(idbManager.removePendingOp).toHaveBeenCalledWith(4);
    });
});

// ---------------------------------------------------------------------------
// deleteItem()
// ---------------------------------------------------------------------------

describe('dataModule.deleteItem', () => {
    it('removes an equipment row locally and decrements Stats.totalEquip', async () => {
        const { remove, runTransaction } = setupFirebaseMock();
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1' }, { EquipmentID: 'EQ2' }],
        });

        await ctx.deleteItem('Equipment', 'EQ1');

        expect(remove).toHaveBeenCalledOnce();
        expect(ctx.equipment.map((e) => e.EquipmentID)).toEqual(['EQ2']);
        expect(runTransaction).toHaveBeenCalled(); // Stats/totalEquip decrement
    });

    it('restores spare-part stock when deleting a log that used parts', async () => {
        const { remove, runTransaction } = setupFirebaseMock();
        const ctx = makeCtx({ logs: [{ LogID: 'L1' }] });
        window.get = vi.fn(async () => ({
            val: () => ({ LogID: 'L1', PartsUsed: '[{"id":"P1","qty":4}]' }),
            exists: () => true,
        }));

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(remove).toHaveBeenCalledOnce();
        // One transaction restores part stock, another decrements downtime when present.
        expect(runTransaction).toHaveBeenCalled();
        expect(ctx.logs.find((l) => l.LogID === 'L1')).toBeUndefined();
    });

    it('does nothing when the user cancels confirmation', async () => {
        const { remove } = setupFirebaseMock();
        const ctx = makeCtx({ confirmDelete: vi.fn(async () => false) });

        await ctx.deleteItem('Equipment', 'EQ1');

        expect(remove).not.toHaveBeenCalled();
    });

    it('queues the delete locally when offline', async () => {
        const ctx = makeCtx({
            isOnline: false,
            equipment: [{ EquipmentID: 'EQ1' }, { EquipmentID: 'EQ2' }],
        });

        await ctx.deleteItem('Equipment', 'EQ1');

        expect(idbManager.addPendingOp).toHaveBeenCalledOnce();
        expect(ctx.equipment.map((e) => e.EquipmentID)).toEqual(['EQ2']);
    });
});

// ---------------------------------------------------------------------------
// loadFromIndexedDB() — cache fallback
// ---------------------------------------------------------------------------

describe('dataModule.loadFromIndexedDB', () => {
    it('hydrates state from the IDB layer', async () => {
        const ctx = makeCtx();
        idbManager.getAll.mockImplementation(async (store) => {
            if (store === 'equipment') return [{ EquipmentID: 'EQ1' }];
            if (store === 'logs') return [{ LogID: 'L1' }, { LogID: 'L2' }];
            return [];
        });

        await ctx.loadFromIndexedDB();

        expect(ctx.equipment).toEqual([{ EquipmentID: 'EQ1' }]);
        // logs are sorted descending by LogID
        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L2', 'L1']);
    });

    it('notifies when pending operations are found', async () => {
        const ctx = makeCtx();
        idbManager.getPendingOpsCount.mockResolvedValue(3);
        await ctx.loadFromIndexedDB();
        expect(ctx.showNotification).toHaveBeenCalledWith(expect.stringContaining('3 pending'), 'info');
    });
});

// ---------------------------------------------------------------------------
// setupFirebaseListeners() — listener wiring & payload handling
// ---------------------------------------------------------------------------

const pathOf = (ref) => ref?.path ?? ref?.ref?.path;

/** Replace the Firebase stubs with recorders so callbacks can be invoked by hand. */
function captureListeners() {
    const values = [];
    const children = [];
    window.onValue = vi.fn((ref, cb, err) => {
        values.push({ path: pathOf(ref), cb, err });
        return vi.fn();
    });
    window.onChildAdded = vi.fn((ref, cb, err) => {
        children.push({ path: pathOf(ref), cb, err });
        return vi.fn();
    });
    return {
        values,
        children,
        first: (path) => values.filter((v) => v.path === path)[0],
        last: (path) => values.filter((v) => v.path === path).slice(-1)[0],
        child: (path) => children.find((c) => c.path === path),
    };
}

describe('dataModule.setupFirebaseListeners', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does nothing when the user is not logged in', () => {
        const ctx = makeCtx({ isLoggedIn: false });
        const load = vi.spyOn(ctx, 'loadFromIndexedDB');
        ctx.setupFirebaseListeners();
        expect(load).not.toHaveBeenCalled();
        expect(window.onValue).not.toHaveBeenCalled();
    });

    it('resets pagination, hydrates from IDB and checks pending work', () => {
        const ctx = makeCtx({
            logsPage: 5,
            equipPage: 3,
            logsHasMore: false,
            equipHasMore: false,
            logsLastKey: 'x',
            equipLastKey: 'y',
        });
        const load = vi.spyOn(ctx, 'loadFromIndexedDB').mockResolvedValue();
        const pending = vi.spyOn(ctx, 'checkPendingWorkOrders').mockResolvedValue();
        const ops = vi.spyOn(ctx, 'checkPendingOperations').mockResolvedValue();
        captureListeners();

        ctx.setupFirebaseListeners();

        expect([ctx.logsPage, ctx.equipPage]).toEqual([1, 1]);
        expect([ctx.logsHasMore, ctx.equipHasMore]).toEqual([true, true]);
        expect([ctx.logsLastKey, ctx.equipLastKey]).toEqual([null, null]);
        expect(load).toHaveBeenCalledOnce();
        expect(pending).toHaveBeenCalledOnce();
        expect(ops).toHaveBeenCalledOnce();
    });

    it('forces isLoading=false after the 10s safety timeout', () => {
        const ctx = makeCtx({ isLoading: true });
        captureListeners();
        ctx.setupFirebaseListeners();
        expect(ctx.isLoading).toBe(true);
        vi.advanceTimersByTime(10000);
        expect(ctx.isLoading).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('loading timeout'));
    });

    it('registers a listener for every data node', () => {
        const ctx = makeCtx();
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        expect(l.values.map((v) => v.path)).toEqual([
            'Users/uid-user',
            '.info/connected',
            'Equipment',
            'HistoryLog',
            'Stats',
            'Equipment',
            'SpareParts',
        ]);
        expect(l.children.map((c) => c.path)).toEqual([
            'SpareParts',
            'HistoryLog',
            'Performance',
        ]);
    });

    it('derives userRole from the Users node, defaulting to user', () => {
        const ctx = makeCtx();
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        const { cb, err } = l.first('Users/uid-user');
        cb({ val: () => ({ role: 'admin' }) });
        expect(ctx.userRole).toBe('admin');
        cb({ val: () => null });
        expect(ctx.userRole).toBe('user');
        err(new Error('denied'));
        expect(console.error).toHaveBeenCalledWith('User Role Listener:', expect.any(Error));
    });

    it('tracks the RTDB connection state', () => {
        const ctx = makeCtx();
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        const { cb } = l.first('.info/connected');
        cb({ val: () => true });
        expect(ctx.isOnline).toBe(true);
        cb({ val: () => false });
        expect(ctx.isOnline).toBe(false);
    });

    it('maps Equipment snapshots, cleans photo URLs and refreshes the selection', async () => {
        const ctx = makeCtx({ equipLimit: 1, selectedEquip: { EquipmentID: 'EQ1', nama: 'old' } });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        const ready = vi.fn();
        window._firebaseReadyResolve = ready;

        l.first('Equipment').cb({
            val: () => ({
                EQ1: { nama: 'new', FotoURL: 'https://x.com%2Fa.jpg' },
                EQ2: { EquipmentID: 'EQ-2' },
            }),
        });

        expect(ctx.equipment).toEqual([
            { nama: 'new', FotoURL: 'https://x.com/a.jpg', EquipmentID: 'EQ1' },
            { EquipmentID: 'EQ-2', FotoURL: '' },
        ]);
        expect(ctx.equipHasMore).toBe(true);
        expect(ctx.selectedEquip).toEqual(ctx.equipment[0]);
        expect(ready).toHaveBeenCalledOnce();
        expect(window._firebaseReadyResolve).toBeNull();

        await vi.advanceTimersByTimeAsync(250);
        expect(idbManager.putBulk).toHaveBeenCalledWith('equipment', expect.any(Array));
    });

    it('handles an empty Equipment snapshot', () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'OLD' }] });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        l.first('Equipment').cb({ val: () => null });
        expect(ctx.equipment).toEqual([]);
    });

    it('falls back to localStorage when the IDB cache write fails', async () => {
        const ctx = makeCtx();
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        idbManager.putBulk.mockRejectedValueOnce(new Error('idb down'));
        l.first('Equipment').cb({ val: () => ({ EQ1: { EquipmentID: 'EQ1' } }) });
        await vi.advanceTimersByTimeAsync(250);
        expect(localStorage.getItem('cache_equipment')).toContain('EQ1');
    });

    it('falls back to localStorage when putBulk throws synchronously', async () => {
        const ctx = makeCtx();
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        idbManager.putBulk.mockImplementationOnce(() => {
            throw new Error('sync boom');
        });
        l.first('Equipment').cb({ val: () => ({ EQ1: { EquipmentID: 'EQ1' } }) });
        await vi.advanceTimersByTimeAsync(250);
        expect(localStorage.getItem('cache_equipment')).toContain('EQ1');
    });

    it('prepends new parts and updates existing ones in place', () => {
        const ctx = makeCtx({ allParts: [{ PartID: 'P1', Nama: 'lama' }] });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        const { cb, err } = l.child('SpareParts');

        cb({ val: () => null, key: 'k0' });
        cb({ val: () => ({ PartID: 'P2' }), key: 'k2' });
        expect(ctx.allParts.map((p) => p.PartID)).toEqual(['P2', 'P1']);

        cb({ val: () => ({ PartID: 'P1', Nama: 'baru' }), key: 'k1' });
        expect(ctx.allParts.map((p) => p.Nama ?? null)).toEqual([null, 'baru']);

        cb({ val: () => ({ Nama: 'tanpa id' }), key: 'k9' });
        expect(ctx.allParts[0].PartID).toBe('k9');

        err(new Error('denied'));
        expect(console.error).toHaveBeenCalledWith('Spare Parts Listener Error:', expect.any(Error));
    });

    it('seeds _woSeenIds from cached logs', () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L1' }, { LogID: null }] });
        captureListeners();
        ctx.setupFirebaseListeners();
        expect([...ctx._woSeenIds]).toEqual(['L1']);
    });

    it('applies HistoryLog children, sorts them and clears the loading flag', () => {
        const ctx = makeCtx({ logs: [], isLoading: true });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        const { cb } = l.child('HistoryLog');

        cb({ val: () => null });
        cb({ val: () => ({ Deskripsi: 'tanpa LogID' }) });
        cb({ val: () => ({ LogID: 'L2', woNumber: 'WO-2' }) });
        cb({ val: () => ({ LogID: 'L5', woNumber: 'WO-5' }) });

        expect(ctx.logs.map((x) => x.LogID)).toEqual(['L5', 'L2']);
        expect(ctx.activeWorkOrders).toHaveLength(2);
        expect(ctx.logsHasMore).toBe(false);
        expect(ctx.isLoading).toBe(false);
    });

    it('notifies once for a new unapproved work order after the initial load', async () => {
        const ctx = makeCtx();
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        const { cb } = l.child('HistoryLog');

        await vi.advanceTimersByTimeAsync(1500);
        cb({ val: () => ({ LogID: 'L9', woNumber: 'WO-9', Status: 'Pending', Technician: 'Budi' }) });

        expect(sendBrowserNotification).toHaveBeenCalledWith(
            '🔧 New Work Order',
            expect.stringContaining('Budi')
        );
        expect(sendPushViaProxy).toHaveBeenCalledOnce();
        expect(ctx.showNotification).toHaveBeenCalledWith(
            expect.stringContaining('created WO'),
            'info'
        );

        cb({ val: () => ({ LogID: 'L9', woNumber: 'WO-9', Status: 'Pending' }) });
        expect(sendBrowserNotification).toHaveBeenCalledOnce();
    });

    it('does not notify for work orders already in the seen set', async () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L1' }] });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        await vi.advanceTimersByTimeAsync(1500);
        l.child('HistoryLog').cb({
            val: () => ({ LogID: 'L1', woNumber: 'WO-1', Status: 'Pending' }),
        });
        expect(sendBrowserNotification).not.toHaveBeenCalled();
    });

    it('clears logs when the HistoryLog listener errors', () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L1' }], activeWorkOrders: [{ LogID: 'L1' }] });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        l.child('HistoryLog').err(new Error('permission denied'));
        expect(ctx.logs).toEqual([]);
        expect(ctx.activeWorkOrders).toEqual([]);
    });

    it('normalises Performance children (events JSON, id fallback, cap 200)', () => {
        const prev = Array.from({ length: 200 }, (_, i) => ({
            id: 'P' + i,
            date: '2026-01-' + String((i % 28) + 1).padStart(2, '0'),
        }));
        const ctx = makeCtx({ performanceData: prev });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        const { cb, err } = l.child('Performance');

        cb({ val: () => null, key: 'k0' });
        cb({ val: () => ({ date: '2026-12-31', events: '[{"type":"oil"}]' }), key: 'PERF-NEW' });
        expect(ctx.performanceData).toHaveLength(200);
        expect(ctx.performanceData[0].id).toBe('PERF-NEW');
        expect(ctx.performanceData[0].events).toEqual([{ type: 'oil' }]);

        err(new Error('denied'));
        expect(console.error).toHaveBeenCalledWith('Performance Listener:', expect.any(Error));
    });

    it('falls back to [] when a Performance events string is not JSON', () => {
        const ctx = makeCtx({ performanceData: [] });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        l.child('Performance').cb({ val: () => ({ id: 'X', events: 'not-json' }), key: 'k' });
        expect(ctx.performanceData[0].events).toEqual([]);
    });

    it('updates Stats, overdue PM count and low-stock count', () => {
        const ctx = makeCtx();
        const l = captureListeners();
        ctx.setupFirebaseListeners();

        l.first('Stats').cb({ val: () => ({ totalEquip: 7, totalDowntime: 12 }) });
        expect(ctx.dashboardStats).toMatchObject({ totalEquip: 7, totalDowntime: 12 });
        l.first('Stats').cb({ val: () => null });
        expect(ctx.dashboardStats).toMatchObject({ totalEquip: 0, totalDowntime: 0 });

        const overdue = l.last('Equipment');
        overdue.cb({
            forEach: (fn) => {
                [{ NextPMDate: '2026-01-01' }, { NextPMDate: '' }, {}].forEach((v) =>
                    fn({ val: () => v })
                );
            },
        });
        expect(ctx.dashboardStats.overduePM).toBe(1);

        const lowStock = l.first('SpareParts');
        lowStock.cb({ exists: () => true, size: 4 });
        expect(ctx.dashboardStats.lowStock).toBe(4);
        lowStock.cb({ exists: () => false, size: 0 });
        expect(ctx.dashboardStats.lowStock).toBe(0);
    });

    it('skips dashboard updates when dashboardStats is absent', () => {
        const ctx = makeCtx({ dashboardStats: null });
        const l = captureListeners();
        ctx.setupFirebaseListeners();
        expect(() => l.first('Stats').cb({ val: () => ({ totalEquip: 1 }) })).not.toThrow();
        expect(() => l.last('Equipment').cb({ forEach: () => {} })).not.toThrow();
        expect(() => l.first('SpareParts').cb({ exists: () => false, size: 0 })).not.toThrow();
    });

    it('re-syncs pending operations when the browser goes online', () => {
        const ctx = makeCtx();
        const sync = vi.spyOn(ctx, 'syncPendingOperations').mockResolvedValue();
        const addEventListener = vi.spyOn(window, 'addEventListener');
        captureListeners();
        ctx.setupFirebaseListeners();

        const onlineCall = addEventListener.mock.calls.find((c) => c[0] === 'online');
        expect(onlineCall).toBeTruthy();
        onlineCall[1]();
        expect(sync).toHaveBeenCalledOnce();
    });

    it('surfaces a notification when listener setup throws', () => {
        const ctx = makeCtx();
        captureListeners();
        window.ref = vi.fn(() => {
            throw new Error('bad db');
        });
        ctx.setupFirebaseListeners();
        expect(console.error).toHaveBeenCalledWith(
            'Firebase listeners setup error:',
            expect.any(Error)
        );
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Error loading data, please refresh',
            'error'
        );
    });
});

// ---------------------------------------------------------------------------
// Remaining pagination / cache / sync branches
// ---------------------------------------------------------------------------

describe('dataModule — cabang cache dan payload legacy S48', () => {
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('menolak JSON non-array dan membersihkan entitas URL tanpa mengubah input', () => {
        const input = {
            a: { PartsUsed: ' ', events: '1', PhotoURLs: '[null,42,"x&amp;y&unknown;"]' },
            b: { PartsUsed: '{}', events: 'true' },
        };
        expect(safeProcessFirebaseData(input)).toEqual([
            { PartsUsed: [], events: [], PhotoURLs: ['', '', 'x&y&unknown;'] },
            { PartsUsed: [], events: [] },
        ]);
        expect(input.a.PartsUsed).toBe(' ');
    });

    it('notifikasi global tidak menduplikasi pesan WO yang sama', async () => {
        window.get.mockResolvedValue({ val: () => ({ L: { Status: 'Pending', woNumber: 'W', Jenis: 'PM' } }) });
        window.app = { notifications: [
            { type: 'Other', message: 'x' },
            { type: 'Work Order', message: 'old' },
            { type: 'Work Order', message: '1 Work Order waiting for approval' },
        ] };
        await makeCtx().checkPendingWorkOrders();
        expect(window.app.notifications).toHaveLength(3);
    });

    it('listener menangani state kosong, event non-WO, dan snapshot cap 500', async () => {
        vi.useFakeTimers();
        const removed = {};
        window.onChildRemoved = vi.fn((ref, cb) => { removed[pathOf(ref)] = cb; return vi.fn(); });
        const l = captureListeners();
        const ctx = makeCtx({ logs: undefined, allParts: undefined, performanceData: undefined,
            activeWorkOrders: undefined, selectedEquip: { EquipmentID: 'missing' } });
        vi.spyOn(ctx, 'loadFromIndexedDB').mockResolvedValue();
        vi.spyOn(ctx, 'checkPendingWorkOrders').mockResolvedValue();
        vi.spyOn(ctx, 'checkPendingOperations').mockResolvedValue();
        ctx.setupFirebaseListeners({ fromCache: false });
        ctx.setupFirebaseListeners({ fromCache: false });
        expect(ctx.loadFromIndexedDB).not.toHaveBeenCalled();
        l.first('Users/uid-user').cb({ val: () => ({}) });
        expect(ctx.userRole).toBe('user');
        l.first('Equipment').cb({ val: () => ({ E: {} }) });
        expect(ctx.selectedEquip.EquipmentID).toBe('missing');
        l.child('SpareParts').cb({ key: 'P', val: () => ({}) });
        expect(ctx.allParts).toEqual([{ PartID: 'P' }]);
        l.child('Performance').cb({ key: 'A', val: () => ({}) });
        l.child('Performance').cb({ key: 'B', val: () => ({}) });
        expect(ctx.performanceData.map(p => p.id)).toEqual(['B', 'A']);
        await vi.advanceTimersByTimeAsync(1500);
        for (const [i, Jenis] of ['Inspect', 'Repair', 'Breakdown', 'PM', 'Service'].entries()) {
            l.child('HistoryLog').cb({ val: () => ({ LogID: `L${i}`, Jenis, Status: 'Pending' }) });
        }
        expect(ctx.logs).toHaveLength(5);
        expect(ctx._woSeenIds.has('L0')).toBe(false);
        expect(ctx._woSeenIds.has('L4')).toBe(true);
        expect(ctx.showNotification).toHaveBeenCalledWith(expect.stringContaining('Unknown'), 'info');
        const before = ctx.logs;
        l.first('HistoryLog').cb({ val: () => Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`K${i}`, {}])) });
        expect(ctx.logs).toBe(before);
        l.first('HistoryLog').cb({ val: () => null });
        expect(ctx.logs).toEqual([]);
        for (const node of ['SpareParts', 'Performance', 'HistoryLog']) {
            removed[node]({});
        }
        ctx.allParts = undefined;
        ctx.performanceData = undefined;
        ctx.logs = undefined;
        removed.SpareParts({ key: 'P' });
        removed.Performance({ key: 'A' });
        removed.HistoryLog({ val: () => ({ LogID: 'L' }) });
        expect(ctx.allParts).toEqual([]);
        expect(ctx.performanceData).toEqual([]);
        expect(ctx.logs).toEqual([]);
        expect(ctx.activeWorkOrders).toEqual([]);
        ctx._cacheWriter('custom', undefined);
        await vi.advanceTimersByTimeAsync(10000);
        expect(ctx.isLoading).toBe(false);
    });

    it('antrean kosong tidak menulis dan timestamp legacy tetap tersinkron', async () => {
        const ctx = makeCtx();
        await ctx.syncPendingOperations();
        expect(window.set).not.toHaveBeenCalled();
        idbManager.getPendingOps.mockResolvedValue([
            { id: 1, type: 'equipment', data: { EquipmentID: 'E', createdAt: '2026-01-01' } },
            { id: 2, type: 'parts', data: { PartID: 'P' } },
        ]);
        window.get.mockResolvedValue({ exists: () => true, val: () => ({}) });
        await ctx.syncPendingOperations();
        expect(window.set).toHaveBeenCalledTimes(2);
        expect(idbManager.removePendingOp).toHaveBeenCalledWith(2);
    });

    it.each(['SpareParts', 'Performance'])('hapus offline %s membersihkan state tanpa request server', async node => {
        const ctx = makeCtx({ isOnline: false, allParts: [{ PartID: 'X' }], performanceData: [{ id: 'X' }] });
        await ctx.deleteItem(node, 'X');
        expect(node === 'SpareParts' ? ctx.allParts : ctx.performanceData).toEqual([]);
        expect(window.remove).not.toHaveBeenCalled();
    });
});

describe('dataModule listener cleanup', () => {
    it('calls every unsubscribe and swallows its errors', () => {
        const ctx = makeCtx({ _listeners: [vi.fn(), () => { throw new Error('x'); }] });
        ctx._cleanupFirebaseListeners();
        expect(ctx._listeners).toEqual([]);
    });
});

describe('dataModule pagination guards', () => {
    it('loadMoreLogs returns early while another page is loading', async () => {
        const ctx = makeCtx({ logsLoadingMore: true });
        await ctx.loadMoreLogs();
        expect(window.get).not.toHaveBeenCalled();
    });

    it('loadMoreLogs resets the flag when logs is not an array', async () => {
        const ctx = makeCtx({ logs: null });
        await ctx.loadMoreLogs();
        expect(ctx.logsLoadingMore).toBe(false);
        expect(window.get).not.toHaveBeenCalled();
    });

    it('loadMoreLogs pages with endBefore when a cursor exists', async () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L9' }], logsLastKey: 'L9' });
        window.get = vi.fn(async () => ({ val: () => null }));
        await ctx.loadMoreLogs();
        expect(window.endBefore).toHaveBeenCalledWith('L9');
        expect(ctx.logsHasMore).toBe(false);
        expect(ctx.isLoading).toBe(false);
    });

    it('loadMoreLogs reports a failure and clears the loading flag', async () => {
        const ctx = makeCtx({ logs: [] });
        window.get = vi.fn(async () => {
            throw new Error('offline');
        });
        await ctx.loadMoreLogs();
        expect(ctx.logsLoadingMore).toBe(false);
        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to load more logs', 'error');
    });

    it('loadMoreEquipment ignores calls while loading, exhausted, or without data', async () => {
        const loading = makeCtx({ equipLoadingMore: true });
        await loading.loadMoreEquipment();
        const exhausted = makeCtx({ equipHasMore: false });
        await exhausted.loadMoreEquipment();
        const noData = makeCtx({ equipment: null });
        await noData.loadMoreEquipment();
        expect(loading.equipLastKey).toBeNull();
        expect(exhausted.equipLastKey).toBeNull();
        expect(noData.equipLastKey).toBeNull();
    });

    // TEMUAN: `filteredEquip.slice(currentLength, currentLength + equipLimit)` selalu
    // kosong karena currentLength = filteredEquip.length → cabang `else` praktis mati
    // selama equipLimit >= 1 (semua pemanggilan nyata). Dikunci lewat equipLimit 0.
    it('loadMoreEquipment only takes the cursor branch when the page is not short', async () => {
        const equipment = Array.from({ length: 5 }, (_, i) => ({ EquipmentID: 'EQ' + i }));
        const ctx = makeCtx({
            equipment,
            filteredEquip: equipment.slice(0, 3),
            equipLimit: 0,
            equipHasMore: true,
        });
        await ctx.loadMoreEquipment();
        expect(ctx.equipLastKey).toBeUndefined();
        expect(ctx.equipHasMore).toBe(true);
        expect(ctx.equipLoadingMore).toBe(false);
    });

    it('paginatedEquip and canLoadMoreEquip tolerate missing data', () => {
        expect(makeCtx({ equipment: null }).paginatedEquip).toEqual([]);
        expect(makeCtx({ equipment: null }).canLoadMoreEquip).toBe(false);
        const searching = makeCtx({ equipment: [], search: 'pump', filteredEquip: [{ EquipmentID: 'EQ1' }] });
        expect(searching.paginatedEquip).toEqual([{ EquipmentID: 'EQ1' }]);
        expect(searching.canLoadMoreEquip).toBe(false);
    });
});

describe('dataModule cache & sync branches', () => {
    it('loadFromIndexedDB reads IDB when available and falls back to localStorage', async () => {
        const ctx = makeCtx();
        idbManager.getAll.mockImplementation(async (store) => {
            if (store === 'performance') return [{ id: 'P1', date: '2026-01-02' }, { id: 'P2', date: '2026-01-05' }];
            return [];
        });
        localStorage.setItem('cache_equipment', JSON.stringify([{ EquipmentID: 'CACHED' }]));
        localStorage.setItem('cache_parts', JSON.stringify([{ PartID: 'P1' }]));
        localStorage.setItem('cache_logs', JSON.stringify([{ LogID: 'L1' }, { LogID: 'L3' }]));
        localStorage.setItem('cache_performance', JSON.stringify([{ id: 'OLD', date: '2025-01-01' }]));

        await ctx.loadFromIndexedDB();

        expect(ctx.equipment).toEqual([{ EquipmentID: 'CACHED' }]);
        expect(ctx.allParts).toEqual([{ PartID: 'P1' }]);
        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L3', 'L1']);
        expect(ctx.performanceData.map((p) => p.id)).toEqual(['P2', 'P1']);
        expect(localStorage.getItem('cache_equipment')).not.toBeNull();
    });

    it('loadFromIndexedDB swallows IDB errors', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx();
        idbManager.getAll.mockRejectedValue(new Error('idb broken'));
        await expect(ctx.loadFromIndexedDB()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith('IndexedDB Load Error:', expect.any(Error));
        vi.restoreAllMocks();
    });

    it('saveToIndexedDB persists all four stores via Alpine.raw', async () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1' }],
            allParts: [{ PartID: 'P1' }],
            logs: [{ LogID: 'L1' }],
            performanceData: [{ id: 'PF1' }],
        });
        await ctx.saveToIndexedDB();
        expect(idbManager.putBulk).toHaveBeenCalledWith('equipment', ctx.equipment);
        expect(idbManager.putBulk).toHaveBeenCalledWith('parts', ctx.allParts);
        expect(idbManager.putBulk).toHaveBeenCalledWith('logs', ctx.logs);
        expect(idbManager.putBulk).toHaveBeenCalledWith('performance', ctx.performanceData);
    });

    it('saveToIndexedDB swallows failures', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx();
        idbManager.putBulk.mockRejectedValue(new Error('quota'));
        await expect(ctx.saveToIndexedDB()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith('IndexedDB Save Error:', expect.any(Error));
        vi.restoreAllMocks();
    });

    it('queueOfflineOperation returns false when the IDB write fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ isOnline: false });
        idbManager.addPendingOp.mockRejectedValueOnce(new Error('idb down'));
        await expect(ctx.queueOfflineOperation('equipment', { EquipmentID: 'EQ1' })).resolves.toBe(false);
        expect(console.error).toHaveBeenCalledWith('Queue Error:', expect.any(Error));
        vi.restoreAllMocks();
    });

    it('checkPendingOperations syncs only when online with a queue', async () => {
        const ctx = makeCtx();
        const sync = vi.spyOn(ctx, 'syncPendingOperations').mockResolvedValue();
        idbManager.getPendingOps.mockResolvedValueOnce([]);
        await ctx.checkPendingOperations();
        expect(sync).not.toHaveBeenCalled();

        idbManager.getPendingOps.mockResolvedValueOnce([{ id: 1 }]);
        await ctx.checkPendingOperations();
        expect(sync).toHaveBeenCalledOnce();

        const offline = makeCtx({ isOnline: false });
        const syncOffline = vi.spyOn(offline, 'syncPendingOperations').mockResolvedValue();
        idbManager.getPendingOps.mockResolvedValueOnce([{ id: 2 }]);
        await offline.checkPendingOperations();
        expect(syncOffline).not.toHaveBeenCalled();
    });

    it('syncPendingOperations dispatches logs, performance and unknown types', async () => {
        const { set } = setupFirebaseMock();
        const ctx = makeCtx();
        idbManager.getPendingOps.mockResolvedValue([
            { id: 10, type: 'logs', data: { LogID: 'L1' } },
            { id: 11, type: 'performance', data: { id: 'PF1' } },
            { id: 12, type: 'mystery', data: {} },
        ]);
        window.get = vi.fn(async () => ({ exists: () => false, val: () => null }));

        await ctx.syncPendingOperations();

        expect(set).toHaveBeenCalledTimes(2);
        expect(idbManager.removePendingOp).toHaveBeenCalledTimes(3);
        expect(ctx.showNotification).toHaveBeenCalledWith('All pending operations synced!', 'success');
    });

    it('syncPendingOperations keeps going when one op throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { set } = setupFirebaseMock();
        const ctx = makeCtx();
        idbManager.getPendingOps.mockResolvedValue([
            { id: 20, type: 'equipment', data: { EquipmentID: 'EQ1' } },
            { id: 21, type: 'parts', data: { PartID: 'P1' } },
        ]);
        window.get = vi.fn(async () => {
            throw new Error('network');
        });

        await ctx.syncPendingOperations();

        // Conflict check gagal → op dilewati (tidak ditulis, tidak dihapus dari antrean)
        expect(set).not.toHaveBeenCalled();
        expect(idbManager.removePendingOp).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledTimes(2);
        vi.restoreAllMocks();
    });
});

describe('dataModule.deleteItem branches', () => {
    it('removes rows locally for parts, logs and performance', async () => {
        const ctx = makeCtx({
            allParts: [{ PartID: 'P1' }, { PartID: 'P2' }],
            logs: [{ LogID: 'L1' }, { LogID: 'L2' }],
            performanceData: [{ id: 'PF1' }, { id: 'PF2' }],
        });
        await ctx.deleteItem('SpareParts', 'P1');
        await ctx.deleteItem('HistoryLog', 'L1');
        await ctx.deleteItem('Performance', 'PF1');
        expect(ctx.allParts.map((p) => p.PartID)).toEqual(['P2']);
        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L2']);
        expect(ctx.performanceData.map((p) => p.id)).toEqual(['PF2']);
    });

    it('returns to the equipment list after deleting the open detail', async () => {
        const ctx = makeCtx({ currentPage: 'detail', equipment: [{ EquipmentID: 'EQ1' }] });
        await ctx.deleteItem('Equipment', 'EQ1');
        expect(ctx.currentPage).toBe('equip');
    });

    it('falls through to the online path when the offline queue write fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { remove } = setupFirebaseMock();
        const ctx = makeCtx({ isOnline: false, equipment: [{ EquipmentID: 'EQ1' }] });
        idbManager.addPendingOp.mockRejectedValueOnce(new Error('idb down'));

        await ctx.deleteItem('Equipment', 'EQ1');

        expect(remove).toHaveBeenCalledOnce();
        expect(ctx.equipment).toEqual([]);
        vi.restoreAllMocks();
    });

    it('still deletes when fetching the log snapshot fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { remove } = setupFirebaseMock();
        const ctx = makeCtx({ logs: [{ LogID: 'L1' }] });
        window.get = vi.fn(async () => {
            throw new Error('permission denied');
        });

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(remove).toHaveBeenCalledOnce();
        expect(ctx.logs).toEqual([]);
        vi.restoreAllMocks();
    });

    it('parses every PartsUsed shape when restoring stock', async () => {
        const shapes = [
            { raw: '[]', parts: 0 },
            { raw: '', parts: 0 },
            { raw: 'bukan-json', parts: 0 },
            { raw: [{ id: 'P1', qty: 2 }], parts: 1 },
            { raw: '[{\\"id\\":\\"P1\\",\\"qty\\":3}]', parts: 1 },
            { raw: '[{&quot;id&quot;:&quot;P1&quot;,&quot;qty&quot;:4}]', parts: 1 },
            { raw: '[{rusak', parts: 0 },
        ];

        for (const shape of shapes) {
            vi.clearAllMocks();
            const { runTransaction } = setupFirebaseMock();
            const ctx = makeCtx({ logs: [{ LogID: 'L1' }] });
            window.get = vi.fn(async () => ({ val: () => ({ LogID: 'L1', PartsUsed: shape.raw }) }));
            await ctx.deleteItem('HistoryLog', 'L1');
            expect(runTransaction).toHaveBeenCalledTimes(shape.parts);
        }
    });

    it('decrements total downtime when the deleted log has Downtime', async () => {
        const { runTransaction } = setupFirebaseMock();
        const ctx = makeCtx({ logs: [{ LogID: 'L1', Downtime: 5 }] });
        window.get = vi.fn(async () => ({ val: () => ({ LogID: 'L1', PartsUsed: '[]' }) }));

        await ctx.deleteItem('HistoryLog', 'L1');

        const paths = window.ref.mock.calls.map((c) => c[1]);
        expect(paths).toContain('Stats/totalDowntime');
        expect(runTransaction).toHaveBeenCalled();
    });

    it('reports a failure when remove keeps throwing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { remove } = setupFirebaseMock();
        remove.mockRejectedValue(new Error('denied'));
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ1' }] });

        await ctx.deleteItem('Equipment', 'EQ1');

        expect(ctx.isLoading).toBe(false);
        expect(ctx.showNotification).toHaveBeenCalledWith(
            expect.stringContaining('Failed to delete'),
            'error'
        );
        vi.restoreAllMocks();
    });
});

describe('dataModule — checkPendingWorkOrders (notifikasi global)', () => {
    it('membuat larik notifikasi sendiri dan menyalin ke appState', async () => {
        setupFirebaseMock(async () => ({
            val: () => ({ L1: { Status: 'Pending', woNumber: 'WO-1', Jenis: 'Repair' } }),
        }));
        window.appState = {};
        const ctx = makeCtx({ notifications: undefined });

        await ctx.checkPendingWorkOrders();

        expect(ctx.notifications).toHaveLength(1);
        expect(ctx.notifications[0]).toMatchObject({ type: 'Work Order', icon: 'schedule' });
        expect(window.appState.notifications).toHaveLength(1);
    });
});

describe('dataModule — loadMoreEquipment state kosong', () => {
    it('aman saat filteredEquip belum ada', async () => {
        const ctx = makeCtx({
            filteredEquip: undefined,
            equipment: [{ EquipmentID: 'A' }],
            equipHasMore: true,
            equipLoadingMore: false,
            equipLimit: 2,
        });

        await ctx.loadMoreEquipment();

        expect(ctx.equipHasMore).toBe(false);
        expect(ctx.equipLoadingMore).toBe(false);
    });

    it('paginatedEquip memakai larik kosong saat filteredEquip belum ada', () => {
        const ctx = makeCtx({ search: 'pump', filteredEquip: undefined });

        expect(ctx.paginatedEquip).toEqual([]);
    });
});

describe('dataModule — saveToIndexedDB state kosong', () => {
    it('menulis empat koleksi kosong saat state belum terisi', async () => {
        const ctx = makeCtx({
            equipment: undefined,
            allParts: undefined,
            logs: undefined,
            performanceData: undefined,
        });

        await ctx.saveToIndexedDB();

        expect(idbManager.putBulk).toHaveBeenCalledTimes(4);
        expect(idbManager.putBulk).toHaveBeenCalledWith('equipment', []);
    });
});

// ---------------------------------------------------------------------------
// Sinkronisasi hapus WO (S39c)
// ---------------------------------------------------------------------------

describe('dataModule — hapus WO ikut membersihkan daftar Work Orders', () => {
    it('deleteItem(HistoryLog) membuang record dari logs DAN activeWorkOrders', async () => {
        const { remove } = setupFirebaseMock();
        const ctx = makeCtx({
            logs: [
                { LogID: 'L1', woNumber: 'WO-1' },
                { LogID: 'L2', woNumber: 'WO-2' },
            ],
            activeWorkOrders: [
                { LogID: 'L1', woNumber: 'WO-1' },
                { LogID: 'L2', woNumber: 'WO-2' },
            ],
            _woSeenIds: new Set(['L1', 'L2']),
        });
        window.get = vi.fn(async () => ({
            val: () => ({ LogID: 'L1', PartsUsed: '[]' }),
            exists: () => true,
        }));

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(remove).toHaveBeenCalledOnce();
        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L2']);
        // `filteredWorkOrders` membaca activeWorkOrders lebih dulu; kalau larik
        // ini tidak dibersihkan, WO yang sudah dihapus tetap tampil di menu.
        expect(ctx.activeWorkOrders.map((l) => l.LogID)).toEqual(['L2']);
        expect(ctx._woSeenIds.has('L1')).toBe(false);
    });

    it('jalur offline juga membersihkan activeWorkOrders', async () => {
        setupFirebaseMock();
        const ctx = makeCtx({
            isOnline: false,
            logs: [{ LogID: 'L1', woNumber: 'WO-1' }],
            activeWorkOrders: [{ LogID: 'L1', woNumber: 'WO-1' }],
        });

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(ctx.logs).toEqual([]);
        expect(ctx.activeWorkOrders).toEqual([]);
    });

    it('listener onChildRemoved terdaftar dan memakai SDK yang diekspor data-layer', () => {
        const read = (/** @type {string} */ p) => readFileSync(resolve(process.cwd(), p), 'utf8');
        const data = read('src/js/modules/data.js');
        const bridge = read('src/js/firebase-config.js');
        const layer = read('src/js/data-layer.js');

        // Tanpa listener ini, penghapusan dari tab/perangkat lain tidak pernah
        // sampai ke state: `onChildAdded` hanya menambah.
        expect(data).toContain("window.onChildRemoved(histRef");
        expect(data).toContain("window.onChildRemoved(spRef");
        expect(data).toContain("window.onChildRemoved(perfRef");
        expect(data).toContain("this.activeWorkOrders = (this.activeWorkOrders || []).filter(l => l && l.LogID !== id)");
        expect(bridge).toContain('window.onChildRemoved = m.onChildRemoved');
        expect(layer).toMatch(/export \{[^}]*onChildRemoved/);
    });
});

describe('dataModule.setupFirebaseListeners — hapus WO lintas perangkat (S39c)', () => {
    it('onChildRemoved membuang WO dari logs + activeWorkOrders dan menyimpan cache', async () => {
        setupFirebaseMock();
        let removeCb = null;
        window.onChildRemoved = vi.fn((ref, cb) => {
            // Ada listener lain (SpareParts/Performance); ambil yang HistoryLog.
            if (JSON.stringify(ref).includes('HistoryLog')) removeCb = cb;
            return vi.fn();
        });

        const ctx = makeCtx({
            logs: [
                { LogID: 'L1', woNumber: 'WO-1' },
                { LogID: 'L2', woNumber: 'WO-2' },
            ],
            activeWorkOrders: [
                { LogID: 'L1', woNumber: 'WO-1' },
                { LogID: 'L2', woNumber: 'WO-2' },
            ],
            _woSeenIds: new Set(['L1', 'L2']),
        });

        ctx.setupFirebaseListeners();

        expect(window.onChildRemoved).toHaveBeenCalled();
        expect(typeof removeCb).toBe('function');

        removeCb({ key: 'L1' });

        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L2']);
        expect(ctx.activeWorkOrders.map((l) => l.LogID)).toEqual(['L2']);
        expect(ctx._woSeenIds.has('L1')).toBe(false);
    });

    it('snapshot awal memangkas WO yang sudah tidak ada di server', async () => {
        setupFirebaseMock();
        const valueCbs = [];
        window.onValue = vi.fn((ref, cb) => {
            valueCbs.push({ ref, cb });
            return vi.fn();
        });

        const ctx = makeCtx({
            logs: [
                { LogID: 'L1', woNumber: 'WO-1' },
                { LogID: 'GHOST', woNumber: 'WO-GHOST' },
            ],
            activeWorkOrders: [
                { LogID: 'L1', woNumber: 'WO-1' },
                { LogID: 'GHOST', woNumber: 'WO-GHOST' },
            ],
        });

        ctx.setupFirebaseListeners();
        // Listener HistoryLog dikenali dari constraint limitToLast(500).
        const hist = valueCbs.find((v) => JSON.stringify(v.ref).includes('"n":500'));
        expect(hist, 'listener HistoryLog tidak terdaftar').toBeTruthy();

        // Server hanya punya L1 — GHOST hidup lagi dari cache IndexedDB.
        hist.cb({ val: () => ({ L1: { LogID: 'L1' } }) });

        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L1']);
        expect(ctx.activeWorkOrders.map((l) => l.LogID)).toEqual(['L1']);
    });

    it('onChildRemoved juga membersihkan SpareParts dan Performance', () => {
        setupFirebaseMock();
        const cbs = {};
        window.onChildRemoved = vi.fn((ref, cb) => {
            const s = JSON.stringify(ref);
            if (s.includes('SpareParts')) cbs.parts = cb;
            else if (s.includes('Performance')) cbs.perf = cb;
            return vi.fn();
        });

        const ctx = makeCtx({
            allParts: [{ PartID: 'P1' }, { PartID: 'P2' }],
            performanceData: [{ id: 'PF1' }, { id: 'PF2' }],
        });

        ctx.setupFirebaseListeners();
        expect(typeof cbs.parts).toBe('function');
        expect(typeof cbs.perf).toBe('function');

        cbs.parts({ key: 'P1' });
        cbs.perf({ key: 'PF1' });

        expect(ctx.allParts.map((p) => p.PartID)).toEqual(['P2']);
        expect(ctx.performanceData.map((p) => p.id)).toEqual(['PF2']);
    });
});
