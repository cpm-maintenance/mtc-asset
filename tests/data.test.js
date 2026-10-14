// @vitest-environment jsdom
/**
 * Integration tests for src/js/modules/data.js
 *
 * Covers:
 *  - safeProcessFirebaseData() pure transformation (edge cases)
 *  - dataModule methods with a mocked Firebase `window.*` surface
 *    (listeners, pagination, offline queue, conflict resolution, delete)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
