import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/modules/data.js';
let s = readFileSync(p, 'utf8');
let t = s.replace(/\r\n/g, '\n');
const orig = t;
const log = [];
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };

// ── 1. HistoryLog: onValue full → onChildAdded + limitToLast ──
const oldHist = `        // Load ALL HistoryLog with real-time listener (replaces paginated load)
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
                        sendBrowserNotification('🔧 New Work Order', \`\${requester}: \${(log.Deskripsi || log.Jenis || 'WO').substring(0, 60)}\`);
                        sendPushViaProxy('🔧 Work Order Baru', \`\${requester}: \${(log.Deskripsi || log.Jenis || 'WO').substring(0, 80)}\`);
                        this.showNotification(\`🔧 \${requester} created WO: \${(log.Deskripsi || log.Jenis || '').substring(0, 40)}\`, 'info');
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
        }));`;

const newHist = `        // HistoryLog: incremental onChildAdded + limitToLast (delta-only, no full re-download per write)
        // ponytail: cap 500 — naikkan bila dataset riil > 500 logs
        const histRef = window.query(window.ref(window.db, 'HistoryLog'), window.limitToLast(500));
        let _firebaseLogsLoaded = false;
        this._listeners.push(window.onChildAdded(histRef, (snapshot) => {
            try {
                const item = snapshot.val();
                if (!item || typeof item !== 'object' || !item.LogID) return;
                const processed = safeProcessFirebaseData({ [item.LogID]: item })[0];
                if (!processed) return;

                if (!this._woSeenIds) this._woSeenIds = new Set();
                const isWO = Boolean(processed.woNumber || (processed.Jenis && (processed.Jenis === 'Repair' || processed.Jenis === 'Breakdown' || processed.Jenis === 'PM' || processed.Jenis === 'Service')));
                if (isWO) {
                    if (this._woSeenIds.size > 0 && !this._woSeenIds.has(processed.LogID)) {
                        const requester = processed.requestedBy || processed.createdBy || processed.Technician || 'Unknown';
                        sendBrowserNotification('🔧 New Work Order', \`\${requester}: \${(processed.Deskripsi || processed.Jenis || 'WO').substring(0, 60)}\`);
                        sendPushViaProxy('🔧 Work Order Baru', \`\${requester}: \${(processed.Deskripsi || processed.Jenis || 'WO').substring(0, 80)}\`);
                        this.showNotification(\`🔧 \${requester} created WO: \${(processed.Deskripsi || processed.Jenis || '').substring(0, 40)}\`, 'info');
                    }
                    this._woSeenIds.add(processed.LogID);
                }

                if (this.logs) {
                    this.logs = [processed, ...this.logs.filter(l => l && l.LogID !== processed.LogID)]
                        .sort((a, b) => String(b.LogID).localeCompare(String(a.LogID)));
                } else {
                    this.logs = [processed];
                }
                this.logsHasMore = false;
                this.activeWorkOrders = this.logs.filter(l => l.woNumber);
                saveCache('logs', this.logs);

                if (!_firebaseLogsLoaded) {
                    _firebaseLogsLoaded = true;
                    this.isLoading = false;
                }
            } catch (e) {
                console.error('HistoryLog Listener Error:', e);
            }
        }, (error) => {
            console.error('HistoryLog Listener Error:', error);
            this.logs = [];
            this.activeWorkOrders = [];
        }));`;

if (!t.includes(oldHist)) fail('HISTORYLOG PATTERN');
t = t.replace(oldHist, newHist); log.push('HistoryLog → onChildAdded + limitToLast(500)');

// ── 2. SpareParts: onValue full → onChildAdded + limitToLast(500) ──
const oldSp = `        // Spare Parts (Full data) - direct ref for reliability
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
        }));`;

const newSpare = `        // SpareParts: incremental onChildAdded + limitToLast (delta sync)
        const spRef = window.query(window.ref(window.db, 'SpareParts'), window.limitToLast(500));
        this._listeners.push(window.onChildAdded(spRef, (snapshot) => {
            try {
                const item = snapshot.val();
                if (!item || typeof item !== 'object') return;
                const partId = item.PartID || snapshot.key;
                const processed = { ...item, PartID: partId };
                const prev = this.allParts || [];
                const idx = prev.findIndex(p => p && p.PartID === partId);
                const next = idx >= 0 ? [...prev.slice(0, idx), processed, ...prev.slice(idx + 1)] : [processed, ...prev];
                this.allParts = next;
                saveCache('allParts', next);
            } catch (e) {
                console.error('Spare Parts Listener Error:', e);
            }
        }, (error) => {
            console.error('Spare Parts Listener Error:', error);
        }));`;

if (!t.includes(oldSp)) { fail('SPARE PATTERN'); }
t = t.replace(oldSp, newSpare); log.push('SpareParts listener → onChildAdded');

// ── 3. Performance: onValue full → onChildAdded + limitToLast(200) ──
const oldPerf = `// Performance Data - use direct ref without query for reliability
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
        }, (error) => console.error('Performance Listener:', error)));`;

const newPerf = `        // Performance: incremental onChildAdded + limitToLast(200)
        const perfRef = window.query(window.ref(window.db, 'Performance'), window.limitToLast(200));
        this._listeners.push(window.onChildAdded(perfRef, (snapshot) => {
            try {
                const item = snapshot.val();
                if (!item || typeof item !== 'object') return;
                const p = { ...item, id: item.id || snapshot.key };
                if (typeof p.events === 'string') {
                    try { p.events = JSON.parse(p.events); } catch { p.events = []; }
                }
                const prev = this.performanceData || [];
                this.performanceData = [p, ...prev.filter(x => x && x.id !== p.id)]
                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                    .slice(0, 200);
                saveCache('performanceData', this.performanceData);
            } catch (e) {
                console.error('Performance Listener Error:', e);
            }
        }, (error) => console.error('Performance Listener:', error)));`;

if (!t.includes(oldPerf)) fail('PERFORMANCE PATTERN');
t = t.replace(oldPerf, newPerf); log.push('Performance → onChildAdded + limitToLast(200)');

writeFileSync(p, t.replace(/\n/g, '\r\n'));
console.log('OK:', log.join('; '));
