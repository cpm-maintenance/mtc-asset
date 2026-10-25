// @vitest-environment jsdom
/**
 * S38f: pemulihan stok saat Work Order dihapus.
 *
 * Bug lapangan: `Restore parts stock error: Error: permission_denied`.
 * Penyebabnya transaksi menulis `SpareParts/<id>/Stok` untuk part yang **tidak
 * ada** (id menggantung di `PartsUsed`), sehingga `.validate` node part
 * (`hasChildren(['NamaPart','Stok','MinStock'])`) gagal dan Firebase melaporkan
 * `permission_denied`. Transaksi harus **dibatalkan** (`undefined`) untuk part
 * yang tidak ada / qty rusak, bukan menulis sebagian.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

vi.mock('../src/js/modules/notification.js', () => ({ sendBrowserNotification: vi.fn() }));
vi.mock('../src/js/modules/push-client.js', () => ({ sendPushViaProxy: vi.fn() }));

import { dataModule } from '../src/js/modules/data.js';

function makeCtx(overrides = {}) {
    const ctx = Object.create(dataModule);
    return Object.assign(ctx, {
        _listeners: [],
        isLoggedIn: true,
        isOnline: true,
        isLoading: false,
        user: { uid: 'uid-user' },
        userRole: 'admin',
        notifications: [],
        equipment: [],
        allParts: [],
        logs: [{ LogID: 'L1', Downtime: 0 }],
        performanceData: [],
        activeWorkOrders: [],
        dashboardStats: { totalEquip: 0, overduePM: 0, lowStock: 0, totalDowntime: 0 },
        search: '',
        filteredEquip: [],
        selectedEquip: null,
        currentPage: 'wo',
        confirmDelete: vi.fn(async () => true),
        showNotification: vi.fn(),
        ...overrides,
    });
}

let transactionCb;

function stubFirebase(partsUsed) {
    transactionCb = null;
    window.db = { name: 'mock-db' };
    window.ref = vi.fn((_db, path) => ({ path }));
    window.get = vi.fn(async () => ({ val: () => ({ LogID: 'L1', PartsUsed: partsUsed }) }));
    window.set = vi.fn(async () => {});
    window.remove = vi.fn(async () => {});
    window.runTransaction = vi.fn(async (ref, fn) => {
        if (String(ref.path).startsWith('SpareParts/')) transactionCb = fn;
        return fn(10);
    });
}

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    for (const k of ['db', 'ref', 'get', 'set', 'remove', 'runTransaction']) delete window[k];
});

describe('deleteItem — pemulihan stok SpareParts', () => {
    it('membatalkan transaksi saat part tidak ada (Stok saja akan ditolak rules)', async () => {
        stubFirebase([{ id: 'P-GHOST', qty: 2 }]);
        const ctx = makeCtx();

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(transactionCb).toBeTypeOf('function');
        expect(transactionCb(null)).toBeUndefined();
        expect(transactionCb(5)).toBe(7);
    });

    it('membatalkan transaksi saat qty bukan angka positif', async () => {
        stubFirebase([{ id: 'P1', qty: 'abc' }]);
        const ctx = makeCtx();

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(transactionCb(5)).toBeUndefined();
    });

    it('tidak pernah menghasilkan stok negatif', async () => {
        stubFirebase([{ id: 'P1', qty: -3 }]);
        const ctx = makeCtx();

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(transactionCb(5)).toBeUndefined();
    });
});
