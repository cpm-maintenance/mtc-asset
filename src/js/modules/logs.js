/**
 * History log management module
 */
import { validateLogForm, formatDateForInput, withRetry, isNetworkError, sanitizeDataForFirebase } from '../utils.js';
import { DEFAULT_LOG_FORM } from '../constants.js';
import { safeProcessFirebaseData } from './data.js';

export const logsModule = {
    // State flags
    isEditingLog: false,
    isLogDetailView: false,
    showLogModal: false,
    isLoading: false,
    isOnline: true,
    isAdmin: false,
    user: null,
    selectedEquip: null,
    logForm: DEFAULT_LOG_FORM(),
    
    // NOTE: logs tidak didefinisikan di sini!
    // Semua akses ke logs harus melalui this.logs yang berasal dari dataModule
    // (karena dataModule di-spread sebelum logsModule di app.js)
    
    openLogModal(isEdit = false, data = null, fromDetail = false) {
        this.isEditingLog = isEdit;
        this.isLogDetailView = fromDetail && !isEdit;
        this.oldLogParts = [];

        if (isEdit && data) {
            // ════════════════════════════════════════════
            // DIAGNOSTIC: Trace what data looks like
            // ════════════════════════════════════════════
            console.log('[DIAG] openLogModal EDIT', {
                isAlpineRaw: typeof window.Alpine?.raw,
                dataType: typeof data,
                dataIsArray: Array.isArray(data),
                dataKeys: data ? Object.keys(data) : 'null',
                dataLogID: data?.LogID,
                dataEquipID: data?.EquipmentID,
                dataPartsUsed: data?.PartsUsed,
                dataPartsUsedType: typeof data?.PartsUsed,
                dataPartsUsedIsArray: Array.isArray(data?.PartsUsed),
                dataPartsUsedStr: data?.PartsUsed ? JSON.stringify(data?.PartsUsed).slice(0,200) : 'empty',
            });
            // ════════════════════════════════════════════

            let parsedParts = [];
            try {
                // Step 1: unwrap entire data object from Alpine Proxy
                let rawData = data;
                if (window.Alpine?.raw) {
                    try { rawData = window.Alpine.raw(data); } catch(e) {}
                }
                // Step 2: get PartsUsed value
                let rawParts = rawData?.PartsUsed ?? data?.PartsUsed;
                // Step 3: unwrap if still proxy
                if (rawParts && window.Alpine?.raw) {
                    try { rawParts = window.Alpine.raw(rawParts); } catch(e) {}
                }
                // Step 4: parse based on type
                if (typeof rawParts === 'string' && rawParts.trim()) {
                    parsedParts = JSON.parse(rawParts);
                } else if (Array.isArray(rawParts)) {
                    parsedParts = rawParts;
                } else if (rawParts && typeof rawParts === 'object') {
                    // Firebase object format {key: {id, qty}}
                    const vals = Object.values(rawParts);
                    if (vals.length > 0 && vals[0]?.id !== undefined) {
                        parsedParts = vals;
                    }
                }
                if (!Array.isArray(parsedParts)) parsedParts = [];
                // Step 5: deep-clean each part object to remove any Proxy
                parsedParts = parsedParts.map(p => {
                    const clean = window.Alpine?.raw ? (() => { try { return window.Alpine.raw(p); } catch(e) { return p; }})() : p;
                    return { id: clean.id || clean.PartID || '', qty: Number(clean.qty) || 1 };
                });
            } catch (e) {
                console.warn('[openLogModal] PartsUsed parse error:', e);
            }

// ponytail: JSON.parse/stringify instead of structuredClone — Alpine Proxy not clonable
            this.oldLogParts = JSON.parse(JSON.stringify(parsedParts));

            let existingPhotos = [];
            if (typeof data.PhotoURLs === 'string' && data.PhotoURLs) {
                try {
                    const parsed = JSON.parse(data.PhotoURLs);
                    existingPhotos = (Array.isArray(parsed) ? parsed : []).map(url => ({ file: null, preview: url, base64: url }));
                } catch (e) {
                    existingPhotos = [{ file: null, preview: data.PhotoURLs, base64: data.PhotoURLs }];
                }
            } else if (Array.isArray(data.PhotoURLs)) {
                existingPhotos = data.PhotoURLs.map(url => ({ file: null, preview: url, base64: url }));
            } else if (data.PhotoURL) {
                existingPhotos = [{ file: null, preview: data.PhotoURL, base64: data.PhotoURL }];
            }

            this.logForm = {
                logId: data.LogID, 
                type: data.Jenis || 'PM', 
                desc: data.Deskripsi || '',
                downtime: data.Downtime || 0, 
                cost: data.Cost || 0, 
                equipmentId: data.EquipmentID || '',
                date: formatDateForInput(data.Tanggal), 
                tech: data.Technician || '',
                parts: parsedParts, 
                status: data.Status || 'Pending',
                hm: data.HM || '', 
                catatan: data.Catatan || '',
                photos: existingPhotos, 
                rca: data.rca || 'PM',
                // Work Order fields
                woPriority: data.woPriority || 'Normal',
                woNumber: data.woNumber || '',
                assignedTo: data.assignedTo || '',
                dueDate: data.dueDate || '',
                estimatedHours: data.estimatedHours || 0,
                actualHours: data.actualHours || 0,
                // Department Request fields
                requestSource: data.requestSource || 'Production',
                requestedBy: data.requestedBy || '',
                requestDate: data.requestDate || '',
                approvedBy: data.approvedBy || '',
                approvalDate: data.approvalDate || '',
                // External fields
                externalEquipName: data.externalEquipName || ''
            };

            // ════════════════════════════════════════════
            // DIAGNOSTIC: Check logForm after assignment
            // ════════════════════════════════════════════
            console.log('[DIAG] logForm AFTER assignment', {
                equipId: this.logForm.equipmentId,
                partsLen: Array.isArray(this.logForm.parts) ? this.logForm.parts.length : 'NOT_ARRAY',
                partsVal: this.logForm.parts,
                partsStr: JSON.stringify(this.logForm.parts).slice(0,200),
                logFormKeys: Object.keys(this.logForm),
            });
            // ════════════════════════════════════════════

        } else {
            // Generate WO number: MTC-001 format
            const existingWOs = this.logs.filter(l => l.woNumber && l.woNumber.startsWith('MTC-')).map(l => l.woNumber);
            let woNum = 'MTC-001';
            if (existingWOs.length > 0) {
                const nums = existingWOs.map(w => {
                    const match = w.match(/MTC-(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                });
                const maxNum = Math.max(...nums);
                woNum = 'MTC-' + String(maxNum + 1).padStart(3, '0');
            }
            
            this.logForm = {
                logId: '', 
                type: 'PM', 
                desc: '', 
                downtime: 0, 
                cost: 0,
                equipmentId: fromDetail ? (this.selectedEquip?.EquipmentID || '') : '',
                date: new Date().toISOString().split('T')[0], 
                tech: 'Maintenance Team',
                parts: [], 
                status: 'Pending', 
                hm: '', 
                catatan: '',
                photos: [], 
                rca: 'PM',
                // Work Order fields
                woPriority: 'Normal',
                woNumber: woNum,
                assignedTo: '',
                dueDate: '',
                estimatedHours: 0,
                actualHours: 0,
                // Department Request fields
                requestSource: 'Production',
                requestedBy: '',
                requestDate: new Date().toISOString().split('T')[0],
                approvedBy: '',
                approvalDate: '',
                // External fields
                externalEquipName: ''
            };
        }
        this.showLogModal = true;
    },

    handleLogPhoto(e) {
        const files = Array.from(e.target.files);
        if (!this.logForm.photos || !Array.isArray(this.logForm.photos)) {
            this.logForm.photos = [];
        }
        if (this.logForm.photos.length + files.length > 4) {
            this.showNotification("Maximum 4 photos allowed.", "error");
            return;
        }
        files.forEach((file, i) => {
            const preview = URL.createObjectURL(file);
            // Only open crop for first new file
            if (i === 0) {
                this.showCropModal(preview, (croppedBlob) => {
                    if (!this.logForm.photos) this.logForm.photos = [];
                    if (this.logForm.photos.length >= 4) return;
                    this.logForm.photos.push({ file: croppedBlob, preview: URL.createObjectURL(croppedBlob), base64: null });
                });
            } else {
                this.logForm.photos.push({ file, preview, base64: null });
            }
        });
    },

    removeLogPhoto(index) {
        if (!this.logForm.photos || !Array.isArray(this.logForm.photos)) {
            this.logForm.photos = [];
            return;
        }
        this.logForm.photos.splice(index, 1);
    },

    addPartToLog() {
        if (!this.logForm.parts || !Array.isArray(this.logForm.parts)) {
            this.logForm.parts = [];
        }
        this.logForm.parts.push({ id: '', qty: 1 });
    },

    removePartFromLog(index) {
        if (!this.logForm.parts || !Array.isArray(this.logForm.parts)) {
            this.logForm.parts = [];
            return;
        }
        this.logForm.parts.splice(index, 1);
    },

    async submitLog() {
        const errors = validateLogForm(this.logForm);
        if (errors.length > 0) {
            this.showNotification(errors[0], "error");
            return;
        }
        
        if (!this.isEditingLog && !this.isAdminOrSupervisor) {
            this.showNotification("Admin access required to create logs", "error");
            return;
        }
        
        this.isLoading = true;
        try {
            // First, ensure logForm.parts is a plain array - handle Alpine Proxy
            let plainParts = [];
            try {
                let rawParts = this.logForm?.parts;
                if (rawParts && window.Alpine?.raw) {
                    try { rawParts = window.Alpine.raw(rawParts); } catch(e) {}
                }
                if (Array.isArray(rawParts)) {
                    plainParts = rawParts.map(p => {
                        let clean = p;
                        if (clean && window.Alpine?.raw) {
                            try { clean = window.Alpine.raw(p); } catch(e) {}
                        }
                        return { id: clean?.id || '', qty: Number(clean?.qty) || 1 };
                    });
                }
            } catch(e) {
                console.warn('[SubmitLog] Parts extraction error:', e);
            }
            console.log('[SubmitLog] Parts to save:', plainParts);
            
            const logId = this.isEditingLog ? this.logForm.logId : "LOG-" + Date.now();
            
            // Handle photos - get URLs from photos array - handle Alpine Proxy
            let photoUrls = [];
            const rawPhotos = this.logForm?.photos;
            if (Array.isArray(rawPhotos)) {
                photoUrls = rawPhotos.filter(p => p && p.preview).map(p => p.preview);
            } else if (rawPhotos && typeof rawPhotos === 'object') {
                try {
                    const unwrapped = window.Alpine?.raw?.(rawPhotos);
                    if (Array.isArray(unwrapped)) {
                        photoUrls = unwrapped.filter(p => p && p.preview).map(p => p.preview);
                    }
                } catch(e) {}
            }
            
            const logDataToSave = {
                LogID: logId, 
                EquipmentID: this.logForm.equipmentId, 
                Tanggal: this.logForm.date,
                Jenis: this.logForm.type, 
                Deskripsi: this.logForm.desc, 
                Technician: this.logForm.tech,
                PartsUsed: JSON.stringify(plainParts),
                Downtime: Number(this.logForm.downtime),
                Cost: Number(this.logForm.cost), 
                Status: this.logForm.status, 
                HM: this.logForm.hm,
                Catatan: this.logForm.catatan, 
                PhotoURLs: JSON.stringify(photoUrls), 
                rca: this.logForm.rca,
                // Work Order fields
                woNumber: this.logForm.woNumber || this.logForm.woNumber || '',
                woPriority: this.logForm.woPriority || 'Normal',
                assignedTo: this.logForm.assignedTo || '',
                dueDate: this.logForm.dueDate || '',
                estimatedHours: Number(this.logForm.estimatedHours) || 0,
                actualHours: Number(this.logForm.actualHours) || 0,
                // Department Request fields
                requestSource: this.logForm.requestSource || 'Production',
                requestedBy: this.logForm.requestedBy || '',
                requestDate: this.logForm.requestDate || '',
                approvedBy: this.logForm.approvedBy || '',
                approvalDate: this.logForm.approvalDate || '',
                rejectedBy: this.logForm.rejectedBy || '',
                rejectionDate: this.logForm.rejectionDate || '',
                rejectionReason: this.logForm.rejectionReason || '',
                // External fields
                externalEquipName: this.logForm.externalEquipName || ''
            };
            
            if (!this.isEditingLog) {
                logDataToSave.createdBy = this.user?.uid || 'unknown';
                logDataToSave.createdAt = new Date().toISOString();
            } else {
                const existing = this.logs.find(l => l.LogID === logId);
                if (existing) {
                    if (existing.createdBy) logDataToSave.createdBy = existing.createdBy;
                    if (existing.createdAt) logDataToSave.createdAt = existing.createdAt;
                }
            }
            logDataToSave.updatedBy = this.user?.uid || 'unknown';
            logDataToSave.updatedAt = new Date().toISOString();

            // Sanitize data before saving
            const sanitizedLogData = sanitizeDataForFirebase(logDataToSave);
            // Restore pre-stringified fields — sanitizeInput corrupts JSON (replaces " → &quot;, / → &#x2F;)
            sanitizedLogData.PartsUsed = logDataToSave.PartsUsed;
            sanitizedLogData.PhotoURLs = logDataToSave.PhotoURLs;

            let downtimeDiff = Number(this.logForm.downtime) || 0;
            if (this.isEditingLog) {
                const existing = this.logs.find(l => l.LogID === logId);
                if (existing) {
                    downtimeDiff -= (Number(existing.Downtime) || 0);
                }
            }

            // If offline, queue the operation
            if (!this.isOnline) {
                const queued = await this.queueOfflineOperation('logs', sanitizedLogData);
                if (queued) {
                    const idx = this.logs.findIndex(l => l.LogID === logId);
                    if (idx >= 0) {
                        this.logs[idx] = sanitizedLogData;
                    } else {
                        this.logs.unshift(sanitizedLogData);
                    }
                    await this.saveToIndexedDB();
                    this.showNotification("Log saved offline, will sync when online");
                    this.showLogModal = false;
                    this.isLoading = false;
                    return;
                }
            }

            await withRetry(async () => {
                await window.set(window.ref(window.db, 'HistoryLog/' + logId), sanitizedLogData);
                if (downtimeDiff !== 0) {
                    await window.runTransaction(window.ref(window.db, 'Stats/totalDowntime'), (curr) => Math.max(0, (curr || 0) + downtimeDiff));
                }
            }, {
                maxRetries: 3,
                delay: 1000,
                backoff: 2,
                onRetry: (attempt, error, delay) => {
                    if (isNetworkError(error)) {
                        this.showNotification("Network error, retrying...", "info");
                    }
                }
            });
            
            // Update Equipment Status & HM (skip for EXTERNAL)
            if (sanitizedLogData.EquipmentID && sanitizedLogData.EquipmentID !== 'EXTERNAL') {
                const eqRef = window.ref(window.db, 'Equipment/' + sanitizedLogData.EquipmentID);
                const updates = {
                    Status: logDataToSave.Status === 'Completed' ? 'Active' : 'In Maintenance'
                };
                if (logDataToSave.HM) updates.LastHM = logDataToSave.HM;
                await window.update(eqRef, updates);
            }

            // Deduct Stock (only for new logs)
            if (!this.isEditingLog && this.logForm.parts && this.logForm.parts.length > 0) {
                for (const p of this.logForm.parts) {
                    if (!p.id) {
                        console.log('[DeductStock] Skipping - no part id');
                        continue;
                    }
                    console.log('[DeductStock] Deducting:', p.id, 'qty:', p.qty);
                    try {
                        await window.runTransaction(window.ref(window.db, 'SpareParts/' + p.id + '/Stok'), (curr) => {
                            const newVal = (curr || 0) - Number(p.qty);
                            console.log('[DeductStock] Transaction:', curr, '->', newVal);
                            return newVal;
                        });
                    } catch(e) {
                        console.error('[DeductStock] Error:', e);
                    }
                }
            }
            
            this.showNotification("Log entry successfully saved!");
            
            // Add to local array immediately for instant UI update
            const existingIdx = this.logs.findIndex(l => l.LogID === sanitizedLogData.LogID);
            if (existingIdx >= 0) {
                this.logs[existingIdx] = sanitizedLogData;
            } else {
                this.logs.unshift(sanitizedLogData);
            }
            
            // Force refresh logs from Firebase after short delay
            setTimeout(async () => {
                try {
                    const snapshot = await window.get(window.ref(window.db, 'HistoryLog'));
                    if (snapshot.val()) {
                        const fromFirebase = safeProcessFirebaseData(snapshot.val());
                        this.logs = fromFirebase.sort((a, b) => String(b.LogID).localeCompare(String(a.LogID)));
                    }
                } catch(e) { console.log('Refresh logs error:', e); }
            }, 500);
            
            this.showLogModal = false;
        } catch (e) {
            console.error('Submit Log Error:', e);
            this.showNotification("Error: " + e.message, "error");
        } finally {
            this.isLoading = false;
        }
    },

async approveWO(logId) {
        const log = this.logs.find(l => l.LogID === logId);
        if (!log) {
            this.showNotification("Work Order not found", "error");
            return;
        }

        if (!this.isAdminOrSupervisor) {
            this.showNotification("Only supervisor can approve Work Order", "error");
            return;
        }

        try {
            const updates = {
                Status: 'Approved',
                approvedBy: this.user?.email || 'supervisor',
                approvalDate: new Date().toISOString().split('T')[0],
                rejectedBy: '',
                rejectionDate: '',
                rejectionReason: ''
            };
            
            await window.update(window.ref(window.db, 'HistoryLog/' + logId), updates);
            this.showNotification("Work Order Approved!");
            
            // Add notification
            const notifyMsg = `Your WO #${log.woNumber || logId} has been approved`;
            this.notifications.push({
                id: Date.now(),
                type: 'Work Order',
                message: notifyMsg,
                icon: 'fa-check-circle',
                color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                exiting: false
            });
            
            // Sync to global
            const globalApp = window.app || window.appState;
            if (globalApp) {
                globalApp.notifications = globalApp.notifications || [];
                globalApp.notifications.push({
                    id: Date.now(),
                    type: 'Work Order',
                    message: notifyMsg,
                    icon: 'fa-check-circle',
                    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                    exiting: false
                });
            }
            
            const logIdx = this.logs.findIndex(l => l.LogID === logId);
            if (logIdx >= 0) {
                this.logs[logIdx] = { ...this.logs[logIdx], ...updates };
                this.logs = [...this.logs];
            }
            
            if (globalApp && globalApp.logs) {
                const idx = globalApp.logs.findIndex(l => l.LogID === logId);
                if (idx >= 0) {
                    globalApp.logs[idx] = { ...globalApp.logs[idx], ...updates };
                    globalApp.logs = [...globalApp.logs];
                }
            }
        } catch (e) {
            console.error('Approve WO Error:', e);
            this.showNotification("Error: " + e.message, "error");
        }
    },

    async rejectWO(logId, reason) {
        const log = this.logs.find(l => l.LogID === logId);
        if (!log) {
            this.showNotification("Work Order not found", "error");
            return;
        }

        if (!this.isAdminOrSupervisor) {
            this.showNotification("Only supervisor can reject Work Order", "error");
            return;
        }

        if (!reason || reason.trim() === '') {
            this.showNotification("Rejection reason is required", "error");
            return;
        }

        try {
            const updates = {
                Status: 'Rejected',
                rejectedBy: this.user?.email || 'supervisor',
                rejectionDate: new Date().toISOString().split('T')[0],
                rejectionReason: reason,
                approvedBy: '',
                approvalDate: ''
            };
            
            await window.update(window.ref(window.db, 'HistoryLog/' + logId), updates);
            this.showNotification("Work Order Rejected");
            
            const globalApp = window.app || window.appState;
            
            // Add notification for rejected
            const notifyMsg = `Your WO #${log.woNumber || logId} has been rejected`;
            this.notifications.push({
                id: Date.now(),
                type: 'Work Order',
                message: notifyMsg,
                icon: 'fa-times-circle',
                color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                exiting: false
            });
            if (globalApp && globalApp.logs) {
                const idx = globalApp.logs.findIndex(l => l.LogID === logId);
                if (idx >= 0) {
                    globalApp.logs[idx] = { ...globalApp.logs[idx], ...updates };
                    globalApp.logs = [...globalApp.logs];
                }
            }
        } catch (e) {
            console.error('Reject WO Error:', e);
            this.showNotification("Error: " + e.message, "error");
        }
    },

    async startWO(logId) {
        const log = this.logs.find(l => l.LogID === logId);
        if (!log) {
            this.showNotification("Work Order not found", "error");
            return;
        }

        try {
            const updates = {
                Status: 'In Progress'
            };
            
            await window.update(window.ref(window.db, 'HistoryLog/' + logId), updates);
            this.showNotification("Work Order Started");
            
            const globalApp = window.app || window.appState;
            
            // Add notification for started
            const notifyMsg = `WO #${log.woNumber || logId} has been started`;
            this.notifications.push({
                id: Date.now(),
                type: 'Work Order',
                message: notifyMsg,
                icon: 'fa-play',
                color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                exiting: false
            });
            
            // Sync to global
            if (globalApp) {
                globalApp.notifications = globalApp.notifications || [];
                globalApp.notifications.push({
                    id: Date.now(),
                    type: 'Work Order',
                    message: notifyMsg,
                    icon: 'fa-play',
                    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                    exiting: false
                });
            }
            
            // Update local state for immediate UI reaction
            const logIdx = this.logs.findIndex(l => l.LogID === logId);
            if (logIdx >= 0) {
                this.logs[logIdx] = { ...this.logs[logIdx], ...updates };
                this.logs = [...this.logs];
            }
            
            // Also update global app logs
            if (globalApp && globalApp.logs) {
                const idx = globalApp.logs.findIndex(l => l.LogID === logId);
                if (idx >= 0) {
                    globalApp.logs[idx] = { ...globalApp.logs[idx], ...updates };
                    globalApp.logs = [...globalApp.logs];
                }
            }
        } catch (e) {
            console.error('Start WO Error:', e);
            this.showNotification("Error: " + e.message, "error");
        }
    },

    async completeWO(logId) {
        const log = this.logs.find(l => l.LogID === logId);
        if (!log) {
            this.showNotification("Work Order not found", "error");
            return;
        }

        try {
            const updates = {
                Status: 'Completed'
            };
            
            // Use update() instead of set() to preserve existing data
            await window.update(window.ref(window.db, 'HistoryLog/' + logId), updates);
            this.showNotification("Work Order Completed");
            
            // Update local state for immediate UI 反应
            const logIdx = this.logs.findIndex(l => l.LogID === logId);
            if (logIdx >= 0) {
                this.logs[logIdx] = { ...this.logs[logIdx], ...updates };
                this.logs = [...this.logs];
            }
            
            // Also update global app
            const globalApp = window.app || window.appState;
            if (globalApp && globalApp.logs) {
                const idx = globalApp.logs.findIndex(l => l.LogID === logId);
                if (idx >= 0) {
                    globalApp.logs[idx] = { ...globalApp.logs[idx], ...updates };
                    globalApp.logs = [...globalApp.logs];
                }
            }
        } catch (e) {
            console.error('Complete WO Error:', e);
            this.showNotification("Error: " + e.message, "error");
        }
    }
};
