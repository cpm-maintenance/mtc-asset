// @vitest-environment jsdom
/**
 * S45c — bug lapangan: WO dihapus, lalu tombol **Muat ulang data** membuatnya
 * kembali.
 *
 * Sebabnya dua lapis, keduanya di cache IndexedDB:
 *  1. `refreshData()` memanggil ulang `setupFirebaseListeners()`, dan fungsi itu
 *     memuat IndexedDB (`loadFromIndexedDB()`) ke `this.logs`. Cache masih
 *     menyimpan record yang sudah dihapus → record hidup lagi.
 *  2. Jalur hapus **tidak pernah menulis** cache, jadi record tetap ada di
 *     IndexedDB sampai ada listener lain yang kebetulan menimpanya.
 *
 * Kontrak yang dijaga di sini: refresh tidak membaca cache, hapus langsung
 * memangkas cache, dan rekonsiliasi `onValue` juga memangkas saat server kosong.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const appSrc = readFileSync(resolve(process.cwd(), 'src/js/app.js'), 'utf8');
const dataSrc = readFileSync(resolve(process.cwd(), 'src/js/modules/data.js'), 'utf8');

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
        logs: [
            { LogID: 'L1', woNumber: 'WO-1', Downtime: 2 },
            { LogID: 'L2', woNumber: 'WO-2', Downtime: 0 },
        ],
        performanceData: [],
        activeWorkOrders: [
            { LogID: 'L1', woNumber: 'WO-1' },
            { LogID: 'L2', woNumber: 'WO-2' },
        ],
        _woSeenIds: new Set(['L1', 'L2']),
        currentPage: 'wo',
        confirmDelete: vi.fn(async () => true),
        showNotification: vi.fn(),
        _cacheWriter: vi.fn(),
        ...overrides,
    });
}

function stubFirebase() {
    window.db = { name: 'mock-db' };
    window.ref = vi.fn((_db, path) => ({ path }));
    window.get = vi.fn(async () => ({ val: () => ({ LogID: 'L1', PartsUsed: '' }) }));
    window.remove = vi.fn(async () => {});
    window.runTransaction = vi.fn(async (_ref, fn) => fn(0));
}

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFirebase();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('deleteItem — cache ikut dipangkas', () => {
    it('jalur online: _cacheWriter menerima daftar tanpa WO yang dihapus', async () => {
        const ctx = makeCtx();

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L2']);
        expect(ctx.activeWorkOrders.map((l) => l.LogID)).toEqual(['L2']);
        expect(ctx._woSeenIds.has('L1')).toBe(false);
        expect(ctx._cacheWriter).toHaveBeenCalledWith('logs', [{ LogID: 'L2', woNumber: 'WO-2', Downtime: 0 }]);
    });

    it('jalur offline (delete masuk antrean): cache tetap dipangkas', async () => {
        const ctx = makeCtx({
            isOnline: false,
            queueOfflineOperation: vi.fn(async () => true),
        });

        await ctx.deleteItem('HistoryLog', 'L1');

        expect(ctx.logs.map((l) => l.LogID)).toEqual(['L2']);
        expect(ctx._cacheWriter).toHaveBeenCalledWith('logs', [{ LogID: 'L2', woNumber: 'WO-2', Downtime: 0 }]);
    });

    it('tanpa _cacheWriter (belum boot penuh) tidak melempar', async () => {
        const ctx = makeCtx({ _cacheWriter: undefined });
        await expect(ctx.deleteItem('HistoryLog', 'L1')).resolves.toBeUndefined();
    });
});

describe('refresh tidak membaca cache', () => {
    it('refreshData memanggil setupFirebaseListeners dengan fromCache: false', () => {
        expect(appSrc).toMatch(/setupFirebaseListeners\(\{\s*fromCache:\s*false\s*\}\)/);
    });

    it('loadFromIndexedDB hanya dijalankan saat fromCache', () => {
        expect(dataSrc).toContain('if (fromCache) this.loadFromIndexedDB();');
        expect(dataSrc).not.toMatch(/^\s{8}this\.loadFromIndexedDB\(\);/m);
    });

    it('parameter fromCache default true (boot tetap memakai cache)', () => {
        expect(dataSrc).toContain('const { fromCache = true } = options;');
    });
});

describe('rekonsiliasi onValue memangkas cache walau server kosong', () => {
    it('tidak lagi mensyaratkan ids.size > 0', () => {
        expect(dataSrc).toContain('if (ids.size < 500 && Array.isArray(this.logs)) {');
        expect(dataSrc).not.toContain('ids.size > 0 && ids.size < 500');
    });
});
