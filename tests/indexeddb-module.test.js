// @vitest-environment jsdom
/**
 * Unit test lapisan persistensi offline: src/js/modules/indexeddb.js
 *
 * jsdom tidak menyediakan IndexedDB, jadi harness di bawah meniru API yang
 * dipakai modul (open → request, db.transaction → tx, store.* → request) dan
 * bisa disuntik gagal per operasi. `CAN_USE_IDB` dihitung sekali saat import,
 * karena itu setiap kelompok tes meng-import ulang modul lewat vi.resetModules().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const STORES = ['equipment', 'parts', 'logs', 'performance', 'pendingOps'];

function makeRequest(result, error = null) {
    const request = { result, error, onsuccess: null, onerror: null };
    queueMicrotask(() => {
        if (error) request.onerror?.();
        else request.onsuccess?.();
    });
    return request;
}

// vitest jsdom: `window` bukan `globalThis` — stub harus dipasang di keduanya,
// karena modul membaca `window.indexedDB` lalu memanggil `indexedDB.open` polos.
function stubOnWindow(name, value) {
    vi.stubGlobal(name, value);
    Object.defineProperty(window, name, { value, configurable: true, writable: true });
}

function createHarness() {    const calls = [];
    const created = [];
    const existing = new Set();
    const rows = new Map();
    const faults = {};

    const table = (name) => {
        if (!rows.has(name)) rows.set(name, new Map());
        return rows.get(name);
    };

    const respond = (op, result) => {
        const fault = faults[op];
        if (fault === 'throw') throw new Error(`boom-${op}`);
        if (fault === 'error') return makeRequest(undefined, new Error(`err-${op}`));
        return makeRequest(result);
    };

    const keyOf = (value) => value?.id ?? value?.LogID ?? value?.PartID ?? value?.EquipmentID;

    const storeFor = (name) => {
        const map = table(name);
        return {
            put: (value) => {
                calls.push(['put', name, value]);
                map.set(keyOf(value), value);
                return respond('put', value);
            },
            add: (value) => {
                calls.push(['add', name, value]);
                map.set(value?.id, value);
                return respond('add', value);
            },
            get: (key) => {
                calls.push(['get', name, key]);
                return respond('get', map.get(key));
            },
            getAll: () => {
                calls.push(['getAll', name]);
                return respond('getAll', [...map.values()]);
            },
            delete: (key) => {
                calls.push(['delete', name, key]);
                map.delete(key);
                return respond('delete', undefined);
            },
            clear: () => {
                calls.push(['clear', name]);
                map.clear();
                return respond('clear', undefined);
            },
            index: (indexName) => {
                calls.push(['index', name, indexName]);
                return { getAll: () => respond('indexGetAll', [...map.values()]) };
            },
            createIndex: (indexName, path, options) => {
                created.push(`index:${name}.${indexName}:${path}:${options?.unique}`);
            },
        };
    };

    const db = {
        objectStoreNames: { contains: (name) => existing.has(name) },
        createObjectStore(name, options) {
            created.push(`store:${name}:${options?.keyPath}:${options?.autoIncrement === true}`);
            existing.add(name);
            return storeFor(name);
        },
        transaction(name, mode) {
            calls.push(['transaction', name, mode]);
            if (faults.transaction === 'throw') throw new Error('boom-transaction');
            if (faults.transaction === 'null') return null;
            const tx = { objectStore: (n) => storeFor(n), oncomplete: null, onerror: null };
            queueMicrotask(() => {
                if (faults.transaction === 'error') tx.onerror?.();
                else tx.oncomplete?.();
            });
            return tx;
        },
    };

    const indexedDB = {
        open(name, version) {
            calls.push(['open', name, version]);
            const request = {
                result: db,
                error: null,
                onsuccess: null,
                onerror: null,
                onupgradeneeded: null,
            };
            queueMicrotask(() => {
                if (faults.open === 'error') {
                    request.error = new Error('open-fail');
                    request.onerror?.();
                    return;
                }
                if (faults.upgrade !== false) {
                    request.onupgradeneeded?.({ target: { result: db } });
                }
                request.onsuccess?.();
            });
            return request;
        },
    };

    return {
        db,
        indexedDB,
        calls,
        created,
        existing,
        faults,
        seed: (name, items) => items.forEach((item) => table(name).set(keyOf(item), item)),
        table,
    };
}

async function loadWithIDB() {
    const harness = createHarness();
    stubOnWindow('indexedDB', harness.indexedDB);
    vi.resetModules();
    const mod = await import('../src/js/modules/indexeddb.js');
    await mod.idbManager.dbReady;
    return { harness, mod, manager: mod.idbManager };
}

async function loadWithoutIDB() {
    stubOnWindow('indexedDB', undefined);
    vi.resetModules();
    const mod = await import('../src/js/modules/indexeddb.js');
    await mod.idbManager.dbReady;
    return { mod, manager: mod.idbManager };
}

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.indexedDB;
    delete window.localStorage;
});

describe('indexeddb tanpa dukungan IndexedDB', () => {
    it('CAN_USE_IDB false dan initDB mengembalikan null', async () => {
        const { mod, manager } = await loadWithoutIDB();
        expect(mod.CAN_USE_IDB).toBe(false);
        await expect(manager.initDB()).resolves.toBeNull();
    });

    it('ensureReady mengembalikan null dan memberi peringatan', async () => {
        const { manager } = await loadWithoutIDB();
        await expect(manager.ensureReady()).resolves.toBeNull();
        expect(console.warn).toHaveBeenCalledWith('IndexedDB not available');
    });

    it('semua pembacaan mengembalikan nilai kosong', async () => {
        const { manager } = await loadWithoutIDB();
        await expect(manager.getAll('equipment')).resolves.toEqual([]);
        await expect(manager.get('equipment', 'EQ-1')).resolves.toBeNull();
        await expect(manager.getPendingOps()).resolves.toEqual([]);
        await expect(manager.getPendingOpsCount()).resolves.toBe(0);
    });

    it('semua penulisan tidak melempar dan tidak menyentuh indexedDB', async () => {
        const { manager } = await loadWithoutIDB();
        await expect(manager.put('equipment', { id: 'EQ-1' })).resolves.toBeUndefined();
        await expect(manager.putBulk('equipment', [{ id: 'EQ-1' }])).resolves.toBeUndefined();
        await expect(manager.delete('equipment', 'EQ-1')).resolves.toBeUndefined();
        await expect(manager.clear('equipment')).resolves.toBeUndefined();
        await expect(manager.addPendingOp({ type: 'wo' })).resolves.toBeUndefined();
        await expect(manager.removePendingOp(1)).resolves.toBeUndefined();
    });

    it('localStorage yang menolak akses tidak menjatuhkan modul', async () => {
        stubOnWindow('indexedDB', undefined);
        stubOnWindow('localStorage', {
            setItem() {
                throw new Error('denied');
            },
            removeItem() {},
        });
        vi.resetModules();
        const mod = await import('../src/js/modules/indexeddb.js');
        expect(mod.CAN_USE_IDB).toBe(false);
        await expect(mod.idbManager.getAll('equipment')).resolves.toEqual([]);
    });
});

describe('indexeddb initDB & skema', () => {
    it('membuka database mtc-nexus-db versi 1', async () => {
        const { harness, mod } = await loadWithIDB();
        expect(mod.CAN_USE_IDB).toBe(true);
        expect(harness.calls.filter((c) => c[0] === 'open')).toEqual([
            ['open', 'mtc-nexus-db', 1],
        ]);
    });

    it('membuat 5 object store dengan keyPath yang benar', async () => {
        const { harness } = await loadWithIDB();
        expect(harness.created).toEqual([
            'store:equipment:EquipmentID:false',
            'store:parts:PartID:false',
            'store:logs:LogID:false',
            'index:logs.EquipmentID:EquipmentID:false',
            'store:performance:id:false',
            'store:pendingOps:id:true',
            'index:pendingOps.type:type:false',
            'index:pendingOps.timestamp:timestamp:false',
        ]);
    });

    it('store yang sudah ada tidak dibuat ulang', async () => {
        const harness = createHarness();
        STORES.forEach((name) => harness.existing.add(name));
        stubOnWindow('indexedDB', harness.indexedDB);
        vi.resetModules();
        const mod = await import('../src/js/modules/indexeddb.js');
        await mod.idbManager.dbReady;
        expect(harness.created).toEqual([]);
    });

    it('kegagalan open menolak dbReady dengan error aslinya', async () => {
        const harness = createHarness();
        harness.faults.open = 'error';
        stubOnWindow('indexedDB', harness.indexedDB);
        vi.resetModules();
        const mod = await import('../src/js/modules/indexeddb.js');
        await expect(mod.idbManager.dbReady).rejects.toThrow('open-fail');
    });

    it('ensureReady mengembalikan db setelah siap', async () => {
        const { harness, manager } = await loadWithIDB();
        await expect(manager.ensureReady()).resolves.toBe(harness.db);
    });

    it('ensureReady membuka ulang bila object store hilang', async () => {
        const { harness, manager } = await loadWithIDB();
        manager.db = {
            objectStoreNames: { contains: () => false },
            transaction: harness.db.transaction,
        };
        const spy = vi.spyOn(manager, 'initDB').mockResolvedValue(null);
        await expect(manager.ensureReady()).resolves.toBe(manager.db);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
            'IndexedDB stores not initialized, reopening...'
        );
    });
});

describe('indexeddb CRUD', () => {
    it('getAll mengembalikan isi store', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.seed('equipment', [{ id: 'EQ-1' }, { id: 'EQ-2' }]);
        await expect(manager.getAll('equipment')).resolves.toEqual([
            { id: 'EQ-1' },
            { id: 'EQ-2' },
        ]);
    });

    it('getAll mengembalikan array kosong saat request gagal', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.getAll = 'error';
        await expect(manager.getAll('equipment')).resolves.toEqual([]);
    });

    // TEMUAN: `db.transaction()` dipanggil DI DALAM executor `new Promise`, jadi
    // lemparannya berubah menjadi rejection promise — blok `catch` di sekitarnya
    // tidak pernah tercapai untuk jalur ini (kode mati, sengaja tidak diubah).
    it('getAll menolak promise saat transaksi melempar', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.transaction = 'throw';
        await expect(manager.getAll('equipment')).rejects.toThrow('boom-transaction');
    });

    it('getAll mengembalikan array kosong saat transaksi null', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.transaction = 'null';
        await expect(manager.getAll('equipment')).resolves.toEqual([]);
    });

    it('get mengembalikan record atau null', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.seed('equipment', [{ id: 'EQ-1', nama: 'Excavator' }]);
        await expect(manager.get('equipment', 'EQ-1')).resolves.toEqual({
            id: 'EQ-1',
            nama: 'Excavator',
        });
        await expect(manager.get('equipment', 'EQ-9')).resolves.toBeUndefined();
    });

    it('get menelan kegagalan request dan transaksi null', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.get = 'error';
        await expect(manager.get('equipment', 'EQ-1')).resolves.toBeNull();

        harness.faults.get = undefined;
        harness.faults.transaction = 'null';
        await expect(manager.get('equipment', 'EQ-1')).resolves.toBeNull();
    });

    it('get menolak promise saat transaksi melempar', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.transaction = 'throw';
        await expect(manager.get('equipment', 'EQ-1')).rejects.toThrow('boom-transaction');
    });

    it('put menulis record dan menelan kegagalan', async () => {
        const { harness, manager } = await loadWithIDB();
        await manager.put('equipment', { id: 'EQ-3' });
        expect(harness.calls).toContainEqual(['put', 'equipment', { id: 'EQ-3' }]);

        harness.faults.put = 'error';
        await expect(manager.put('equipment', { id: 'EQ-4' })).resolves.toBeUndefined();

        harness.faults.put = undefined;
        harness.faults.transaction = 'throw';
        await expect(manager.put('equipment', { id: 'EQ-5' })).rejects.toThrow(
            'boom-transaction'
        );
    });

    it('put tidak membuka transaksi saat db tidak siap', async () => {
        const { harness, manager } = await loadWithIDB();
        manager.db = null;
        manager.dbReady = Promise.resolve(null);
        await expect(manager.put('equipment', { id: 'EQ-6' })).resolves.toBeUndefined();
        expect(harness.calls.filter((c) => c[0] === 'transaction')).toHaveLength(0);
    });

    it('putBulk melewati daftar kosong tanpa transaksi', async () => {
        const { harness, manager } = await loadWithIDB();
        await manager.putBulk('equipment', []);
        await manager.putBulk('equipment', undefined);
        expect(harness.calls.filter((c) => c[0] === 'transaction')).toHaveLength(0);
    });

    it('putBulk menulis semua item lalu selesai saat transaksi complete', async () => {
        const { harness, manager } = await loadWithIDB();
        await manager.putBulk('equipment', [{ id: 'EQ-1' }, { id: 'EQ-2' }]);
        expect(harness.table('equipment').size).toBe(2);
        expect(harness.calls.filter((c) => c[0] === 'put')).toHaveLength(2);
    });

    it('putBulk menelan kegagalan transaksi dan menolak saat transaksi melempar', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.transaction = 'error';
        await expect(manager.putBulk('equipment', [{ id: 'EQ-1' }])).resolves.toBeUndefined();

        harness.faults.transaction = 'throw';
        await expect(manager.putBulk('equipment', [{ id: 'EQ-1' }])).rejects.toThrow(
            'boom-transaction'
        );
    });

    it('delete menghapus record dan menelan kegagalan', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.seed('equipment', [{ id: 'EQ-1' }]);
        await manager.delete('equipment', 'EQ-1');
        expect(harness.table('equipment').size).toBe(0);

        harness.faults.delete = 'error';
        await expect(manager.delete('equipment', 'EQ-1')).resolves.toBeUndefined();

        harness.faults.delete = undefined;
        harness.faults.transaction = 'throw';
        await expect(manager.delete('equipment', 'EQ-1')).rejects.toThrow('boom-transaction');
    });

    it('clear mengosongkan store dan menelan kegagalan', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.seed('equipment', [{ id: 'EQ-1' }, { id: 'EQ-2' }]);
        await manager.clear('equipment');
        expect(harness.table('equipment').size).toBe(0);

        harness.faults.transaction = 'error';
        await expect(manager.clear('equipment')).resolves.toBeUndefined();

        harness.faults.transaction = 'throw';
        await expect(manager.clear('equipment')).rejects.toThrow('boom-transaction');
    });
});

describe('indexeddb antrean operasi offline', () => {
    it('addPendingOp menambahkan timestamp dan retries 0', async () => {
        const { harness, manager } = await loadWithIDB();
        await manager.addPendingOp({ type: 'wo', data: { id: 'WO-1' }, status: 'pending' });
        const add = harness.calls.find((c) => c[0] === 'add');
        expect(add[1]).toBe('pendingOps');
        expect(add[2]).toMatchObject({
            type: 'wo',
            data: { id: 'WO-1' },
            status: 'pending',
            retries: 0,
        });
        expect(typeof add[2].timestamp).toBe('number');
    });

    it('addPendingOp tidak menulis saat transaksi null atau melempar', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.transaction = 'null';
        await expect(manager.addPendingOp({ type: 'wo' })).resolves.toBeUndefined();
        expect(harness.calls.filter((c) => c[0] === 'add')).toHaveLength(0);

        harness.faults.transaction = 'throw';
        await expect(manager.addPendingOp({ type: 'wo' })).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith('IDB addPendingOp error:', expect.any(Error));
    });

    it('getPendingOps membaca index timestamp', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.seed('pendingOps', [
            { id: 1, type: 'wo' },
            { id: 2, type: 'log' },
        ]);
        await expect(manager.getPendingOps()).resolves.toEqual([
            { id: 1, type: 'wo' },
            { id: 2, type: 'log' },
        ]);
        expect(harness.calls).toContainEqual(['index', 'pendingOps', 'timestamp']);
    });

    it('getPendingOps mengembalikan array kosong pada semua jalur gagal', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.indexGetAll = 'null';
        await expect(manager.getPendingOps()).resolves.toEqual([]);

        harness.faults.indexGetAll = 'error';
        await expect(manager.getPendingOps()).resolves.toEqual([]);

        harness.faults.indexGetAll = undefined;
        harness.faults.transaction = 'null';
        await expect(manager.getPendingOps()).resolves.toEqual([]);

        harness.faults.transaction = 'throw';
        await expect(manager.getPendingOps()).rejects.toThrow('boom-transaction');
    });

    it('removePendingOp menghapus berdasarkan id', async () => {
        const { harness, manager } = await loadWithIDB();
        await manager.removePendingOp(7);
        expect(harness.calls).toContainEqual(['delete', 'pendingOps', 7]);
    });

    it('removePendingOp tidak menulis saat transaksi null atau melempar', async () => {
        const { harness, manager } = await loadWithIDB();
        harness.faults.transaction = 'null';
        await expect(manager.removePendingOp(7)).resolves.toBeUndefined();
        expect(harness.calls.filter((c) => c[0] === 'delete')).toHaveLength(0);

        harness.faults.transaction = 'throw';
        await expect(manager.removePendingOp(7)).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith('IDB removePendingOp error:', expect.any(Error));
    });

    it('getPendingOpsCount menghitung antrean', async () => {
        const { harness, manager } = await loadWithIDB();
        await expect(manager.getPendingOpsCount()).resolves.toBe(0);
        harness.seed('pendingOps', [{ id: 1 }, { id: 2 }, { id: 3 }]);
        await expect(manager.getPendingOpsCount()).resolves.toBe(3);
    });
});
