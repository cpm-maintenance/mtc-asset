/**
 * IndexedDB Manager for Offline Support
 */

const DB_NAME = 'mtc-nexus-db';
const DB_VERSION = 1;

// Check if storage is available
function isStorageAvailable(type) {
    try {
        if (type === 'indexedDB') {
            return !!window.indexedDB;
        }
        const test = '__storage_test__';
        window[type].setItem(test, test);
        window[type].removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

const CAN_USE_STORAGE = isStorageAvailable('localStorage');
const CAN_USE_IDB = isStorageAvailable('indexedDB');

export { CAN_USE_IDB };

class IndexedDBManager {
    constructor() {
        this.db = null;
        this.dbReady = CAN_USE_IDB ? this.initDB() : Promise.resolve(null);
    }

    async initDB() {
        if (!CAN_USE_IDB) return null;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Equipment store
                if (!db.objectStoreNames.contains('equipment')) {
                    db.createObjectStore('equipment', { keyPath: 'EquipmentID' });
                }
                
                // Parts store
                if (!db.objectStoreNames.contains('parts')) {
                    db.createObjectStore('parts', { keyPath: 'PartID' });
                }
                
                // Logs store
                if (!db.objectStoreNames.contains('logs')) {
                    const logStore = db.createObjectStore('logs', { keyPath: 'LogID' });
                    logStore.createIndex('EquipmentID', 'EquipmentID', { unique: false });
                }
                
                // Performance store
                if (!db.objectStoreNames.contains('performance')) {
                    db.createObjectStore('performance', { keyPath: 'id' });
                }
                
                // Pending operations queue
                if (!db.objectStoreNames.contains('pendingOps')) {
                    const opStore = db.createObjectStore('pendingOps', { keyPath: 'id', autoIncrement: true });
                    opStore.createIndex('type', 'type', { unique: false });
                    opStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async ensureReady() {
        if (!this.db) {
            await this.dbReady;
        }
        if (!this.db) {
            console.warn('IndexedDB not available');
            return null;
        }
        if (!this.db.objectStoreNames.contains('equipment') && 
            !this.db.objectStoreNames.contains('parts') &&
            !this.db.objectStoreNames.contains('logs')) {
            console.warn('IndexedDB stores not initialized, reopening...');
            await this.initDB();
        }
        return this.db;
    }

    // Generic CRUD
    async getAll(storeName) {
        const db = await this.ensureReady();
        if (!db) return [];
        try {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                if (!tx) {
                    resolve([]);
                    return;
                }
                const store = tx.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        } catch (e) {
            console.warn('IDB getAll error:', e);
            return [];
        }
    }

    async get(storeName, key) {
        const db = await this.ensureReady();
        if (!db) return null;
        try {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                if (!tx) {
                    resolve(null);
                    return;
                }
                const store = tx.objectStore(storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            console.warn('IDB get error:', e);
            return null;
        }
    }

    async put(storeName, data) {
        const db = await this.ensureReady();
        if (!db) return;
        try {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                if (!tx) {
                    resolve();
                    return;
                }
                const store = tx.objectStore(storeName);
                const request = store.put(data);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
            });
        } catch (e) {
            console.warn('IDB put error:', e);
        }
    }

    async putBulk(storeName, items) {
        const db = await this.ensureReady();
        if (!db || !items || items.length === 0) return;
        try {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                if (!tx) {
                    resolve();
                    return;
                }
                const store = tx.objectStore(storeName);
                items.forEach(item => store.put(item));
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        } catch (e) {
            console.warn('IDB putBulk error:', e);
        }
    }

    async delete(storeName, key) {
        const db = await this.ensureReady();
        if (!db) return;
        try {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                if (!tx) {
                    resolve();
                    return;
                }
                const store = tx.objectStore(storeName);
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
            });
        } catch (e) {
            console.warn('IDB delete error:', e);
        }
    }

    async clear(storeName) {
        const db = await this.ensureReady();
        if (!db) return;
        try {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                if (!tx) {
                    resolve();
                    return;
                }
                const store = tx.objectStore(storeName);
                store.clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        } catch (e) {
            console.warn('IDB clear error:', e);
        }
    }

    // Pending Operations Queue
    async addPendingOp(operation) {
        const db = await this.ensureReady();
        if (!db) return;
        try {
            const tx = db.transaction('pendingOps', 'readwrite');
            if (!tx) return;
            const store = tx.objectStore('pendingOps');
            const op = { ...operation, timestamp: Date.now(), retries: 0 };
            store.add(op);
        } catch (e) {
            console.warn('IDB addPendingOp error:', e);
        }
    }

    async getPendingOps() {
        const db = await this.ensureReady();
        if (!db) return [];
        try {
            return new Promise((resolve) => {
                const tx = db.transaction('pendingOps', 'readonly');
                if (!tx) { resolve([]); return; }
                const store = tx.objectStore('pendingOps');
                const index = store.index('timestamp');
                const request = index.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        } catch (e) {
            console.warn('IDB getPendingOps error:', e);
            return [];
        }
    }

    async removePendingOp(id) {
        const db = await this.ensureReady();
        if (!db) return;
        try {
            const tx = db.transaction('pendingOps', 'readwrite');
            if (!tx) return;
            const store = tx.objectStore('pendingOps');
            store.delete(id);
        } catch (e) {
            console.warn('IDB removePendingOp error:', e);
        }
    }

    async getPendingOpsCount() {
        const ops = await this.getPendingOps();
        return ops ? ops.length : 0;
    }
}

export const idbManager = new IndexedDBManager();