// @vitest-environment jsdom
/**
 * S53: part yang sudah dihapus hidup lagi setelah reload.
 *
 * Akar masalah: cache IndexedDB ditulis sebagai *upsert* (`putBulk`) tetapi
 * dibaca sebagai kebenaran penuh (`getAll` → `this.allParts = parts`).
 * Jalur hapus `SpareParts` memangkas state di memori tetapi **tidak** menulis
 * cache dan **tidak** menghapus baris IDB, jadi boot/refresh berikutnya
 * menghidupkan part itu lagi. `HistoryLog` sudah menyelesaikan kelas cacat ini
 * (S39c/S45c: prune cache di jalur hapus + rekonsiliasi `onValue` + evict IDB);
 * SpareParts melewatkan ketiganya. Tiga tes di bawah mengunci ketiganya.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/js/modules/indexeddb.js', () => ({
    CAN_USE_IDB: true,
    idbManager: {
        db: { name: 'mock-idb' },
        getAll: vi.fn(async () => []),
        putBulk: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
        getPendingOpsCount: vi.fn(async () => 0),
        getPendingOps: vi.fn(async () => []),
        addPendingOp: vi.fn(async () => {}),
        removePendingOp: vi.fn(async () => {}),
    },
}));

vi.mock('../src/js/modules/notification.js', () => ({ sendBrowserNotification: vi.fn() }));
vi.mock('../src/js/modules/push-client.js', () => ({ sendPushViaProxy: vi.fn() }));

import { dataModule } from '../src/js/modules/data.js';
import { idbManager } from '../src/js/modules/indexeddb.js';

function setupFirebaseMock() {
    const unsub = vi.fn();
    window.db = { name: 'mock-db' };
    window.ref = vi.fn((_db, path) => ({ path }));
    window.query = vi.fn((ref, ...constraints) => ({ ref, constraints }));
    window.limitToLast = vi.fn((n) => ({ type: 'limitToLast', n }));
    window.get = vi.fn(async () => ({ val: () => null, exists: () => false }));
    window.set = vi.fn(async () => {});
    window.remove = vi.fn(async () => {});
    window.runTransaction = vi.fn(async (_ref, fn) => fn(0));
    window.onValue = vi.fn(() => unsub);
    window.onChildAdded = vi.fn(() => unsub);
    window.onChildRemoved = vi.fn(() => unsub);
    window.Alpine = { raw: (x) => x };
    window._firebaseReadyResolve = null;
    return { unsub };
}

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
        logs: [],
        performanceData: [],
        activeWorkOrders: [],
        search: '',
        filteredEquip: [],
        selectedEquip: null,
        currentPage: 'parts',
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

afterEach(() => {
    vi.restoreAllMocks();
});

describe('S53 — hapus SpareParts tidak boleh hidup lagi dari cache', () => {
    it('deleteItem memangkas cache allParts (bukan hanya state memori)', async () => {
        const ctx = makeCtx({
            allParts: [{ PartID: 'P1' }, { PartID: 'P2' }],
            _cacheWriter: vi.fn(),
        });

        await ctx.deleteItem('SpareParts', 'P1', { skipConfirm: true });

        expect(ctx.allParts.map((p) => p.PartID)).toEqual(['P2']);
        // Tanpa baris ini `loadFromIndexedDB()` menaruh P1 kembali setelah reload.
        expect(ctx._cacheWriter).toHaveBeenCalledWith('allParts', [{ PartID: 'P2' }]);
    });

    it('deleteItem meng-evict baris IndexedDB part yang dihapus', async () => {
        const ctx = makeCtx({
            allParts: [{ PartID: 'P1' }, { PartID: 'P2' }],
            _cacheWriter: vi.fn(),
        });

        await ctx.deleteItem('SpareParts', 'P1', { skipConfirm: true });

        // putBulk hanya upsert — baris lama harus dihapus eksplisit.
        expect(idbManager.delete).toHaveBeenCalledWith('parts', 'P1');
    });

    it('snapshot onValue SpareParts membuang part yang tidak ada di server', async () => {
        const valueCbs = [];
        window.onValue = vi.fn((ref, cb) => {
            valueCbs.push({ ref, cb });
            return vi.fn();
        });

        const ctx = makeCtx({
            allParts: [{ PartID: 'P1' }, { PartID: 'GHOST' }],
            _cacheWriter: vi.fn(),
        });

        ctx.setupFirebaseListeners({ fromCache: false });

        // `setupFirebaseListeners()` menugaskan ulang `_cacheWriter`; pasang
        // spy setelahnya agar yang diamati adalah writer yang benar-benar dipakai.
        const writeSpy = vi.spyOn(ctx, '_cacheWriter');

        const parts = valueCbs.find((v) => JSON.stringify(v.ref).includes('SpareParts'));
        expect(parts, 'listener onValue SpareParts tidak terdaftar').toBeTruthy();

        // Server hanya punya P1 — GHOST hidup lagi dari cache IndexedDB.
        parts.cb({ val: () => ({ P1: { PartID: 'P1' } }) });

        expect(ctx.allParts.map((p) => p.PartID)).toEqual(['P1']);
        expect(writeSpy).toHaveBeenCalledWith('allParts', [{ PartID: 'P1' }]);
    });
});

