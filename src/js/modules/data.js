/**
 * Data module for MTC.NEXUS - Firebase Listeners and Sync
 */
import { withRetry, isNetworkError } from '../utils.js';
import { idbManager, CAN_USE_IDB } from './indexeddb.js';
import { sendBrowserNotification } from './notification.js';
import { sendPushViaProxy } from './onesignal.js';

// Clean URL from encoding issues (e.g., &#x2F; -> /, %2F -> /)
function cleanFirebaseUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
        // First decode HTML entities (&#x2F; -> /, &amp; -> &)
        let decoded = url.replace(/&#[xX](\w+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                         .replace(/&(\w+);/g, (match, entity) => {
            const entities = { 'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'nbsp': ' ' };
            return entities[entity] || match;
        });
        // Then decode URL encoding (%2F -> /)
        return decodeURIComponent(decoded);
    } catch (e) {
        return url;
    }
}

// Safe parse JSON string field from Firebase data
function safeParseJSONField(data, fieldName, fallback = []) {
    try {
        if (data && typeof data[fieldName] === 'string') {
            let str = data[fieldName].trim();
            if (!str || str.length < 2) return fallback;
            // Fix: unescape HTML entities from sanitizeInput corruption
            str = str.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            // Only parse if starts with [ or { 
            if (str.startsWith('[') || str.startsWith('{')) {
                const parsed = JSON.parse(str);
                return Array.isArray(parsed) ? parsed : fallback;
            }
            // Try parsing even without brackets
            try {
                const parsed = JSON.parse(str);
                return Array.isArray(parsed) ? parsed : fallback;
            } catch(e2) {
                return fallback;
            }
        } else if (Array.isArray(data[fieldName])) {
            return data[fieldName];
        }
        return data[fieldName] || fallback;
    } catch (e) {
        return fallback;
    }
}

// Safely process Firebase data object to array
export function safeProcessFirebaseData(data) {
    if (!data) return [];
    try {
        const values = Object.values(data);
        return values.map(item => {
            const processed = { ...item };
            if (typeof processed.PartsUsed === 'string') {
                processed.PartsUsed = safeParseJSONField(item, 'PartsUsed', []);
            }
            if (typeof processed.PhotoURLs === 'string') {
                const parsed = safeParseJSONField(item, 'PhotoURLs', []);
                processed.PhotoURLs = Array.isArray(parsed) ? parsed.map(url => cleanFirebaseUrl(url)) : [];
            }
            // Handle singular PhotoURL field - convert to array
            if (processed.PhotoURL && !processed.PhotoURLs) {
                processed.PhotoURLs = [cleanFirebaseUrl(processed.PhotoURL)];
            } else if (processed.PhotoURLs && typeof processed.PhotoURLs[0] === 'string') {
                processed.PhotoURLs = processed.PhotoURLs.map(url => cleanFirebaseUrl(url));
            }
            if (typeof processed.events === 'string') {
                processed.events = safeParseJSONField(item, 'events', []);
            }
            return processed;
        });
    } catch (e) {
        console.warn('Failed to process Firebase data:', e);
        return [];
    }
}

export const dataModule = {
    // Pagination state
    logsPage: 1,
    logsLimit: 200,
    logsHasMore: true,
    logsLastKey: null,
    logsLoadingMore: false,
    activeWorkOrders: [],
    
    equipPage: 1,
    equipLimit: 30,
    equipHasMore: true,
    equipLastKey: null,
    equipLoadingMore: false,

    // Firebase listener tracking — cleanup to prevent listener leaks
    _listeners: [],
    _cleanupFirebaseListeners() {
        this._listeners.forEach(unsub => { try { unsub(); } catch(e) {} });
        this._listeners = [];
    },

    async checkPendingWorkOrders() {
        try {
            const logRef = window.ref(window.db, 'HistoryLog');
            const snapshot = await window.get(window.query(logRef, window.limitToLast(50)));
            const data = snapshot.val();
            
            if (data) {
                const allLogs = Object.values(data);
                const pendingCount = allLogs.filter(l => 
                    l && (l.Status === 'Pending' || l.Status === 'Draft') && 
                    l.woNumber && l.Jenis
                ).length;
                
                if (pendingCount > 0) {
                    const msg = `${pendingCount} Work Order${pendingCount > 1 ? 's' : ''} waiting for approval`;
                    this.notifications.push({
                        id: Date.now(),
                        type: 'Work Order',
                        message: msg,
                        icon: 'fa-clock',
                        color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                        exiting: false
                    });
                    
                    const globalApp = window.app || window.appState;
                    if (globalApp) {
                        globalApp.notifications = globalApp.notifications || [];
                        globalApp.notifications.push({
                            id: Date.now(),
                            type: 'Work Order',
                            message: msg,
                            icon: 'fa-clock',
                            color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                            exiting: false
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Check pending WO error:', e);
        }
    },

    setupFirebaseListeners() {
        if (!this.isLoggedIn) return;

        // 🔥 Cleanup old listeners before re-attaching (prevent listener leak)
        this._cleanupFirebaseListeners();

        try {
        // Reset pagination state
        this.logsPage = 1;
        this.logsHasMore = true;
        this.logsLastKey = null;
        this.equipPage = 1;
        this.equipHasMore = true;
        this.equipLastKey = null;

        // Check for pending Work Orders on login
        this.checkPendingWorkOrders();

        // Load from IndexedDB first for instant UI
        this.loadFromIndexedDB();

        // Safety timeout: if Firebase never responds (permission error, etc), 
        // force isLoading=false after 10s so the UI is not stuck forever
        if (this._loadingTimeout) clearTimeout(this._loadingTimeout);
        this._loadingTimeout = setTimeout(() => {
            if (this.isLoading) {
                console.warn('[Data] Firebase loading timeout - forcing isLoading=false');
                this.isLoading = false;
            }
        }, 10000);

        const saveCache = async (key, data) => {
            try {
                const rawData = window.Alpine ? window.Alpine.raw(data) : data;
                const plainData = structuredClone(rawData);
                const storeName = { 'equipment': 'equipment', 'allParts': 'parts', 'logs': 'logs', 'performanceData': 'performance' }[key] || key;
                try {
                    await idbManager.putBulk(storeName, plainData);
                } catch (idbErr) {
                    localStorage.setItem(`cache_${key}`, JSON.stringify(plainData));
                }
            } catch (e) { console.warn('Cache Save Failed:', e); }
        };

        // Listen for online/offline to sync pending operations
        window.addEventListener('online', () => this.syncPendingOperations());
        
        // Check pending ops on startup
        this.checkPendingOperations();

        // User Role
        const userRef = window.ref(window.db, `Users/${this.user.uid}`);
        this._listeners.push(window.onValue(userRef, (snap) => {
            const data = snap.val();
            this.userRole = data ? (data.role || 'user') : 'user';
        }, (error) => console.error('User Role Listener:', error)));

        // Connection State
        const connectedRef = window.ref(window.db, ".info/connected");
        this._listeners.push(window.onValue(connectedRef, (snap) => {
            this.isOnline = snap.val() === true;
        }));

        // Equipment (Full data for reference, pagination for display handled in filteredEquip)
        const eqRef = window.ref(window.db, 'Equipment');
        this._listeners.push(window.onValue(eqRef, (snapshot) => {
            const data = snapshot.val();
            let equipList = [];
            if (data && typeof data === 'object') {
                equipList = Object.entries(data).map(([id, val]) => ({
                    ...val,
                    EquipmentID: val.EquipmentID || id
                }));
            }
            // Clean FotoURL encoding issues
            this.equipment = equipList.map(e => ({
                ...e,
                FotoURL: e.FotoURL ? cleanFirebaseUrl(e.FotoURL) : ''
            }));
            this.equipHasMore = this.equipment.length > this.equipLimit;
            saveCache('equipment', this.equipment);
            if (this.selectedEquip) {
                const updated = this.equipment.find(e => e.EquipmentID === this.selectedEquip.EquipmentID);
                if (updated) this.selectedEquip = updated;
            }
            
            // Signal that initial Firebase data has been loaded
            if (window._firebaseReadyResolve) {
                window._firebaseReadyResolve();
                window._firebaseReadyResolve = null; // Ensure it runs only once
            }
        }, (error) => console.error('Equipment Listener:', error)));

        // Spare Parts (Full data) - direct ref for reliability
        console.log('[DEBUG] Setting up SpareParts listener...');
        const spRef = window.ref(window.db, 'SpareParts');
        this._listeners.push(window.onValue(spRef, (snapshot) => {
            try {
                console.log('[DEBUG] SpareParts exists:', snapshot.exists());
                const data = snapshot.val();
                let newParts = [];
                if (data && typeof data === 'object') {
                    newParts = Object.entries(data).map(([id, val]) => ({
                        ...val,
                        PartID: val.PartID || id
                    }));
                }
                console.log('[DEBUG] SpareParts loaded count:', newParts.length);

                // Direct assignment to trigger reactivity
                this.allParts = [...newParts];
                console.log('[DEBUG] allParts assigned, count:', newParts.length);

                saveCache('allParts', newParts);
            } catch (e) {
                console.error('Spare Parts Listener Error:', e);
                this.allParts = [];
            }
        }, (error) => {
            console.error('Spare Parts Listener Error:', error);
            this.allParts = [];
        }));

        // Load ALL HistoryLog with real-time listener (replaces paginated load)
        const histRef = window.ref(window.db, 'HistoryLog');
        let _firebaseLogsLoaded = false;
        this._listeners.push(window.onValue(histRef, (snapshot) => {
            try {
                const data = snapshot.val();
                let allLogs = safeProcessFirebaseData(data);
                
                // Sort by LogID descending
                allLogs = allLogs.sort((a, b) => String(b.LogID).localeCompare(String(a.LogID)));

                // --- NEW WO DETECTION ---
                if (!this._woSeenIds) this._woSeenIds = new Set();
                const woLogs = allLogs.filter(l => l.woNumber || (l.Jenis && (l.Jenis === 'Repair' || l.Jenis === 'Breakdown' || l.Jenis === 'PM' || l.Jenis === 'Service')));
                woLogs.forEach(log => {
                    if (this._woSeenIds.size > 0 && !this._woSeenIds.has(log.LogID)) {
                        const requester = log.requestedBy || log.createdBy || log.Technician || 'Someone';
                        sendBrowserNotification('🔧 New Work Order', `${requester}: ${(log.Deskripsi || log.Jenis || 'WO').substring(0, 60)}`);
                        sendPushViaProxy('🔧 Work Order Baru', `${requester}: ${(log.Deskripsi || log.Jenis || 'WO').substring(0, 80)}`);
                        this.showNotification(`🔧 ${requester} created WO: ${(log.Deskripsi || log.Jenis || '').substring(0, 40)}`, 'info');
                    }
                    this._woSeenIds.add(log.LogID);
                });

                this.logs = [...allLogs];
                this.logsHasMore = false;
                
                // Populate activeWorkOrders separately for WO view performance
                this.activeWorkOrders = allLogs.filter(l => l.woNumber);
                
                saveCache('logs', allLogs);
                
                // Only set isLoading=false when Firebase data has been received
                if (!_firebaseLogsLoaded) {
                    _firebaseLogsLoaded = true;
                    this.isLoading = false;
                }
            } catch (e) {
                console.error('HistoryLog Listener Error:', e);
                this.logs = [];
                this.activeWorkOrders = [];
            }
        }, (error) => {
            console.error('HistoryLog Listener Error:', error);
            this.logs = [];
            this.activeWorkOrders = [];
        }));

// Performance Data - use direct ref without query for reliability
        const perfRef = window.ref(window.db, 'Performance');
        this._listeners.push(window.onValue(perfRef, (snapshot) => {
            try {
                const data = snapshot.val();
                let rawData = [];
                if (data && typeof data === 'object') {
                    rawData = Object.entries(data).map(([id, val]) => ({
                        ...val,
                        id: val.id || id
                    }));
                }
                const processed = rawData.map(item => {
                    const p = { ...item };
                    if (typeof p.events === 'string') {
                        try { p.events = JSON.parse(p.events); } catch { p.events = []; }
                    }
                    return p;
                }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                
                // Trigger reactivity with new array reference
                this.performanceData = [...processed.slice(0, 200)];
                saveCache('performanceData', processed.slice(0, 200));
            } catch (e) {
                console.error('Performance Listener Error:', e);
                this.performanceData = [];
            }
        }, (error) => console.error('Performance Listener:', error)));

        // 1. Listen to static Stats node
        this._listeners.push(window.onValue(window.ref(window.db, 'Stats'), (snap) => {
            const val = snap.val() || {};
            if (this.dashboardStats) {
                this.dashboardStats.totalEquip = val.totalEquip || 0;
                this.dashboardStats.totalDowntime = val.totalDowntime || 0;
            }
        }));

        // 2. Query Overdue PM (only fetch overdue items, highly efficient)
        const todayStr = new Date().toISOString().split('T')[0];
        const overdueQuery = window.query(window.ref(window.db, 'Equipment'), window.orderByChild('NextPMDate'), window.endAt(todayStr));
        this._listeners.push(window.onValue(overdueQuery, (snap) => {
            let count = 0;
            snap.forEach((child) => {
                if (child.val().NextPMDate && child.val().NextPMDate !== '') count++;
            });
            if (this.dashboardStats) this.dashboardStats.overduePM = count;
        }));

        // 3. Query Low Stock Parts
        const lowStockQuery = window.query(window.ref(window.db, 'SpareParts'), window.orderByChild('isLowStock'), window.equalTo(true));
        this._listeners.push(window.onValue(lowStockQuery, (snap) => {
            if (this.dashboardStats) this.dashboardStats.lowStock = snap.exists() ? snap.size : 0;
        }));
        } catch (e) {
            console.error('Firebase listeners setup error:', e);
            this.showNotification('Error loading data, please refresh', 'error');
        }
    },

    async loadMoreLogs(reset = false) {
        if (this.logsLoadingMore) return;
        if (!this.logs || !Array.isArray(this.logs)) {
            this.logsLoadingMore = false;
            return;
        }
        
        if (reset) {
            this.logsPage = 1;
            this.logsLastKey = null;
        }

        this.logsLoadingMore = true;
        
        try {
            const logRef = window.ref(window.db, 'HistoryLog');
            let queryConstraints = [window.limitToLast(this.logsLimit)];
            
            if (this.logsLastKey) {
                queryConstraints.push(window.endBefore(this.logsLastKey));
            }

            const snapshot = await window.get(window.query(logRef, ...queryConstraints));
            const data = snapshot.val();
            
            if (data) {
                const newLogs = safeProcessFirebaseData(data);
                
                if (reset) {
                    this.logs = newLogs.sort((a, b) => String(b.LogID).localeCompare(String(a.LogID)));
                } else {
                    const existingIds = new Set(this.logs.map(l => l.LogID));
                    const uniqueNew = newLogs.filter(l => !existingIds.has(l.LogID));
                    this.logs = [...this.logs, ...uniqueNew].sort((a, b) => String(b.LogID).localeCompare(String(a.LogID)));
                }

                // Check if there are more to load
                this.logsLastKey = newLogs.length > 0 ? newLogs[newLogs.length - 1].LogID : null;
                this.logsHasMore = newLogs.length === this.logsLimit;
            } else {
                this.logsHasMore = false;
            }
            
            this.isLoading = false;
        } catch (e) {
            console.error('Load More Logs Error:', e);
            this.showNotification("Failed to load more logs", "error");
        } finally {
            this.logsLoadingMore = false;
        }
    },

    async loadMoreEquipment() {
        if (this.equipLoadingMore || !this.equipHasMore) return;
        if (!this.equipment || !Array.isArray(this.equipment)) return;
        
        this.equipLoadingMore = true;
        
        try {
            const currentLength = (this.filteredEquip || []).length;
            const nextPage = (this.filteredEquip || []).slice(currentLength, currentLength + this.equipLimit);
            
            if (nextPage.length < this.equipLimit) {
                this.equipHasMore = false;
            } else {
                this.equipLastKey = nextPage[nextPage.length - 1]?.EquipmentID;
                this.equipHasMore = this.equipment.length > ((this.filteredEquip || []).length + this.equipLimit);
            }
        } catch (e) {
            console.error('Load More Equipment Error:', e);
        } finally {
            this.equipLoadingMore = false;
        }
    },

    // Get paginated equipment based on current search/filter
    get paginatedEquip() {
        if (!this.equipment || !Array.isArray(this.equipment)) return [];
        if (!this.search) {
            return this.equipment.slice(0, this.equipPage * this.equipLimit);
        }
        return this.filteredEquip || [];
    },

    // Check if more equipment can be loaded
    get canLoadMoreEquip() {
        if (!this.equipment || !Array.isArray(this.equipment)) return false;
        if (!this.search) {
            return this.equipment.length > (this.equipPage * this.equipLimit);
        }
        return (this.filteredEquip?.length || 0) > (this.equipPage * this.equipLimit);
    },

    // IndexedDB Methods
    async loadFromIndexedDB() {
        try {
            let equip = [], parts = [], logs = [], perf = [];
            
            // Try IndexedDB first
            if (CAN_USE_IDB && idbManager.db) {
                [equip, parts, logs, perf] = await Promise.all([
                    idbManager.getAll('equipment'),
                    idbManager.getAll('parts'),
                    idbManager.getAll('logs'),
                    idbManager.getAll('performance')
                ]);
            }
            
            // Fallback to localStorage
            if (equip.length === 0) {
                const cachedEquip = localStorage.getItem('cache_equipment');
                if (cachedEquip) equip = JSON.parse(cachedEquip);
            }
            if (parts.length === 0) {
                const cachedParts = localStorage.getItem('cache_parts');
                if (cachedParts) parts = JSON.parse(cachedParts);
            }
            if (logs.length === 0) {
                const cachedLogs = localStorage.getItem('cache_logs');
                if (cachedLogs) logs = JSON.parse(cachedLogs);
            }
            if (perf.length === 0) {
                const cachedPerf = localStorage.getItem('cache_performance');
                if (cachedPerf) perf = JSON.parse(cachedPerf);
            }

            if (equip.length > 0) this.equipment = equip;
            if (parts.length > 0) this.allParts = parts;
            if (logs.length > 0) this.logs = logs.sort((a, b) => String(b.LogID).localeCompare(String(a.LogID)));
            if (perf.length > 0) this.performanceData = perf.sort((a, b) => b.date.localeCompare(a.date));

            if (equip.length > 0 || parts.length > 0) {
                // Charts disabled - Alpine Proxy causes errors
            }

            // Check for pending operations
            const pendingCount = await idbManager.getPendingOpsCount();
            if (pendingCount > 0) {
                this.showNotification(`${pendingCount} pending operations to sync`, "info");
            }
        } catch (e) {
            console.error('IndexedDB Load Error:', e);
        }
    },

    async saveToIndexedDB() {
        try {
            // Use Alpine.raw to extract original object without cloning overhead
            const eq = window.Alpine.raw(this.equipment || []);
            const pt = window.Alpine.raw(this.allParts || []);
            const lg = window.Alpine.raw(this.logs || []);
            const pf = window.Alpine.raw(this.performanceData || []);
            await Promise.all([
                idbManager.putBulk('equipment', eq),
                idbManager.putBulk('parts', pt),
                idbManager.putBulk('logs', lg),
                idbManager.putBulk('performance', pf)
            ]);
        } catch (e) {
            console.error('IndexedDB Save Error:', e);
        }
    },

    async queueOfflineOperation(type, data) {
        if (this.isOnline) return false;
        
        try {
            await idbManager.addPendingOp({ type, data, status: 'pending' });
            this.showNotification("Operation queued for sync when online", "info");
            return true;
        } catch (e) {
            console.error('Queue Error:', e);
            return false;
        }
    },

    async checkPendingOperations() {
        const pending = await idbManager.getPendingOps();
        if (pending.length > 0 && this.isOnline) {
            await this.syncPendingOperations();
        }
    },

    async syncPendingOperations() {
        if (!this.isOnline) {
            this.showNotification("Offline - pending operations will sync when online", "info");
            return;
        }

        const pending = await idbManager.getPendingOps();
        if (pending.length === 0) return;

        this.showNotification(`Syncing ${pending.length} pending operations...`, "info");

        for (const op of pending) {
            try {
                switch (op.type) {
                    case 'equipment':
                        await window.set(window.ref(window.db, 'Equipment/' + op.data.EquipmentID), op.data);
                        break;
                    case 'parts':
                        await window.set(window.ref(window.db, 'SpareParts/' + op.data.PartID), op.data);
                        break;
                    case 'logs':
                        await window.set(window.ref(window.db, 'HistoryLog/' + op.data.LogID), op.data);
                        break;
                    case 'performance':
                        await window.set(window.ref(window.db, 'Performance/' + op.data.id), op.data);
                        break;
                    case 'delete':
                        await window.remove(window.ref(window.db, `${op.data.node}/${op.data.id}`));
                        break;
                }
                await idbManager.removePendingOp(op.id);
            } catch (e) {
                console.error('Sync Error:', e);
            }
        }

        this.showNotification("All pending operations synced!", "success");
    },

    async deleteItem(node, id) {
        const confirmed = await this.confirmDelete(node, id);
        if (!confirmed) return;
        
        // If offline, queue the operation
        if (!this.isOnline) {
            const queued = await this.queueOfflineOperation('delete', { node, id });
            if (queued) {
                // Remove from local state
                if (node === 'Equipment') {
                    this.equipment = this.equipment.filter(e => e.EquipmentID !== id);
                } else if (node === 'SpareParts') {
                    this.allParts = this.allParts.filter(p => p.PartID !== id);
                } else if (node === 'HistoryLog') {
                    this.logs = this.logs.filter(l => l.LogID !== id);
                } else if (node === 'Performance') {
                    this.performanceData = this.performanceData.filter(p => p.id !== id);
                }
                this.showNotification("Delete queued for sync when online");
                return;
            }
        }
        
        this.isLoading = true;
        try {
            // Always fetch fresh from Firebase and get raw data
            let logToDelete = null;
            if (node === 'HistoryLog') {
                try {
                    const snapshot = await window.get(window.ref(window.db, 'HistoryLog/' + id));
                    const rawData = snapshot.val();
                    // Deep clone to get rid of any proxies
                    if (rawData) {
                        logToDelete = structuredClone(rawData);
                        console.log('[DeleteLog] Raw from Firebase - PartsUsed:', logToDelete.PartsUsed);
                    }
                } catch(e) {
                    console.log('[DeleteLog] Error fetching:', e);
                }
            }
            
            await withRetry(async () => {
                await window.remove(window.ref(window.db, `${node}/${id}`));
                
                // Restore spare parts stock if deleting a log with parts
                if (logToDelete && logToDelete.PartsUsed) {
                    try {
                        let usedParts = [];
                        const raw = logToDelete.PartsUsed;
                        console.log('[DeleteLog] Raw PartsUsed:', raw, 'Type:', typeof raw);
                        
                        // Safe parse - handle all edge cases including double-encoded JSON
                        try {
                            if (!raw) {
                                usedParts = [];
                            } else if (typeof raw === 'string') {
                                let str = raw.trim();
                                if (str === '' || str === '[]') {
                                    usedParts = [];
                                } else if (str.startsWith('[')) {
                                    try {
                                        usedParts = JSON.parse(str);
                                    } catch(e1) {
                                        // Try unescape double-encoded
                                        try {
                                            const unescaped = str.replace(/\\"/g, '"');
                                            usedParts = JSON.parse(unescaped);
                                        } catch(e2) {
                                            // Try decodeHTMLEntities
                                            const txt = document.createElement('textarea');
                                            txt.innerHTML = str;
                                            const decoded = txt.value;
                                            usedParts = JSON.parse(decoded);
                                        }
                                    }
                                } else {
                                    usedParts = [];
                                }
                            } else if (Array.isArray(raw)) {
                                usedParts = raw;
                            }
                        } catch(parseErr) {
                            console.log('[DeleteLog] Parse error:', parseErr.message);
                            usedParts = [];
                        }
                        
                        console.log('[DeleteLog] Parsed parts:', usedParts);
                        if (Array.isArray(usedParts) && usedParts.length > 0) {
                            for (const p of usedParts) {
                                if (p.id && p.qty) {
                                    await window.runTransaction(
                                        window.ref(window.db, 'SpareParts/' + p.id + '/Stok'), 
                                        (curr) => (curr || 0) + Number(p.qty)
                                    );
                                    console.log('[DeleteLog] Restored stock:', p.id, '+' + p.qty);
                                }
                            }
                        }
                    } catch(e) {
                        console.warn('Restore parts stock error:', e);
                    }
                }
                
                // Update aggregate stats transactionally on delete
                if (node === 'Equipment') {
                    await window.runTransaction(window.ref(window.db, 'Stats/totalEquip'), (curr) => Math.max(0, (curr || 0) - 1));
                } else if (node === 'HistoryLog') {
                    const log = this.logs.find(l => l.LogID === id);
                    if (log && log.Downtime) {
                        await window.runTransaction(window.ref(window.db, 'Stats/totalDowntime'), (curr) => Math.max(0, (curr || 0) - Number(log.Downtime)));
                    }
                }
            }, {
                maxRetries: 3,
                delay: 1000,
                backoff: 2,
                onRetry: (attempt, error, delay) => {
                    console.log(`Delete retry ${attempt} after ${delay}ms:`, error.message);
                    if (isNetworkError(error)) {
                        this.showNotification("Network error, retrying...", "info");
                    }
                }
            });
            
            // Remove from local array immediately for instant UI update
            if (node === 'Equipment') {
                this.equipment = this.equipment.filter(e => e.EquipmentID !== id);
            } else if (node === 'SpareParts') {
                this.allParts = this.allParts.filter(p => p.PartID !== id);
            } else if (node === 'HistoryLog') {
                this.logs = this.logs.filter(l => l.LogID !== id);
            } else if (node === 'Performance') {
                this.performanceData = this.performanceData.filter(p => p.id !== id);
            }
            
            this.showNotification("Record successfully deleted");
            if (node === 'Equipment' && this.currentPage === 'detail') {
                this.currentPage = 'equip';
            }
        } catch (e) {
            console.error('Delete Item Error:', e);
            this.showNotification("Failed to delete: " + e.message, "error");
        } finally {
            this.isLoading = false;
        }
    }
};
