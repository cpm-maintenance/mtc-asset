/**
 * requisition.js — Modul Request Part / Material General
 * 
 * Data disimpan di Firebase: Requisitions/{reqId}
 * 
 * Fields:
 *   - id: "REQ_1234567890_abc1234"
 *   - itemName: "Bearing SKF 6205"
 *   - itemType: "part" | "material"
 *   - partId: "P001" (opsional, untuk tipe spare part)
 *   - quantity: 5
 *   - unit: "pcs"
 *   - equipmentId: "EQ001" (opsional)
 *   - priority: "normal" | "urgent"
 *   - notes: "..."
 *   - status: "pending" | "approved" | "arrived" | "closed"
 *   - requesterName: "Admin User"
 *   - createdBy: uid
 *   - requestDate: "2026-07-03"
 *   - approvedBy, approvedAt, arrivedDate, closedAt
 *   - createdAt, updatedAt
 */

import { sendBrowserNotification } from './notification.js';
import { sendPushViaProxy } from './onesignal.js';

const NEW_LINE_ITEM = () => ({
    itemType: 'part',
    itemName: '',
    partId: '',
    quantity: 1,
    unit: 'pcs',
    equipmentId: '',
    noResv: '',
});

export const requisitionModule = {
    // --- STATE ---
    requisitions: [],
    reqLineItems: [],
    reqPriority: 'normal',
    reqNotes: '',
    reqFilterStatus: '',
    reqFilterType: '',
    selectedRequisition: null,
    reqShowDetail: false,
    showReqModal: false,
    reqLoading: true,
    reqEditMode: false,
    reqEditId: null,
    reqSelectedIds: [],
    _reqUnsubscribe: null,
    _reqPrevStatuses: {},  // { reqId: 'pending' } for transition detection

    // --- FIREBASE REALTIME LISTENER ---
    setupRequisitionsListener() {
        if (!window.db) return;
        // Cleanup existing listener
        if (this._reqUnsubscribe) {
            this._reqUnsubscribe();
            this._reqUnsubscribe = null;
        }
        this.reqLoading = true;
        const ref = window.ref(window.db, 'Requisitions');
        this._reqUnsubscribe = window.onValue(ref, (snapshot) => {
            try {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const entries = Object.keys(data).map(id => ({ id, ...data[id] }));
                    
                    // Detect status transitions & new items
                    if (!this._reqPrevStatuses) this._reqPrevStatuses = {};
                    if (!this._reqSeenIds) this._reqSeenIds = new Set(Object.keys(this._reqPrevStatuses));
                    entries.forEach(req => {
                        // --- NEW REQUEST DETECTION ---
                        if (this._reqSeenIds.size > 0 && !this._reqSeenIds.has(req.id)) {
                            const requester = req.requesterName || req.createdBy || 'Someone';
                            const itemLabel = req.items && req.items.length > 1
                                ? `${req.items[0].itemName} +${req.items.length -1} others`
                                : (req.itemName || 'Item');
                            sendBrowserNotification('📦 New Request Part', `${requester} requested: ${itemLabel}`);
                            sendPushViaProxy('📦 Request Part Baru', `${requester} meminta: ${itemLabel}`);
                            this.showNotification(`📦 ${requester} requested: ${itemLabel}`, 'info');
                        }
                        this._reqSeenIds.add(req.id);

                        // --- STATUS TRANSITION DETECTION ---
                        const prev = this._reqPrevStatuses[req.id];
                        const cur = req.status;
                        if (prev && prev !== cur) {
                            if (prev === 'pending' && cur === 'approved') {
                                sendBrowserNotification('✅ Request Approved', `${req.itemName} was approved`);
                                sendPushViaProxy('✅ Request Disetujui', `${req.itemName} telah disetujui`);
                                this.showNotification(`📋 ${req.itemName} approved!`, 'success');
                            } else if (prev === 'approved' && cur === 'arrived') {
                                sendBrowserNotification('📦 Request Arrived', `${req.itemName} — stock has arrived`);
                                sendPushViaProxy('📦 Barang Tiba', `${req.itemName} sudah sampai`);
                                this.showNotification(`📦 ${req.itemName} arrived!`, 'success');
                            } else if (prev === 'arrived' && cur === 'closed') {
                                sendBrowserNotification('🔒 Request Closed', `${req.itemName} — request closed`);
                                sendPushViaProxy('🔒 Request Ditutup', `${req.itemName} selesai`);
                                this.showNotification(`🔒 ${req.itemName} closed`, 'info');
                            }
                        }
                        this._reqPrevStatuses[req.id] = cur;
                    });
                    
                    this.requisitions = entries;
                } else {
                    this.requisitions = [];
                }
            } catch (e) {
                console.warn('[Requisition] Listener error:', e.message);
            } finally {
                this.reqLoading = false;
            }
        }, (error) => {
            console.error('[Requisition] Listener error:', error);
            this.reqLoading = false;
        });
    },

    // --- MODAL ---
    openRequisitionModal(req) {
        this.reqLineItems = [NEW_LINE_ITEM()];
        this.reqPriority = 'normal';
        this.reqNotes = '';
        this.reqEditMode = false;
        this.reqEditId = null;
        if (req) {
            this.reqEditMode = true;
            this.reqEditId = req.id;
            this.reqLineItems = req.items && req.items.length ? req.items.map(i => ({...i})) : [{
                itemType: req.itemType || 'part',
                itemName: req.itemName || '',
                partId: req.partId || '',
                quantity: Number(req.quantity) || 1,
                unit: req.unit || 'pcs',
                equipmentId: req.equipmentId || '',
                noResv: req.noResv || '',
            }];
            this.reqPriority = req.priority || 'normal';
            this.reqNotes = req.notes || '';
        }
        this.showReqModal = true;
    },

    reqAddLineItem() {
        this.reqLineItems.push(NEW_LINE_ITEM());
    },

    reqRemoveLineItem(idx) {
        if (this.reqLineItems.length <= 1) return;
        this.reqLineItems.splice(idx, 1);
    },

    // --- CRUD ---
    async submitRequisition() {
        const validItems = this.reqLineItems.filter(item => item.itemName && item.quantity > 0);
        if (!validItems.length) {
            this.showNotification('Minimal 1 item dengan nama dan jumlah valid', 'error');
            return;
        }

        this.reqLoading = true;
        try {
            const now = new Date().toISOString();
            const today = now.split('T')[0];

            if (this.reqEditMode && this.reqEditId) {
                // --- UPDATE EXISTING (all statuses) ---
                const item = validItems[0];
                const updates = {
                    items: validItems,
                    itemName: validItems[0]?.itemName || item.itemName,
                    itemType: validItems[0]?.itemType || 'part',
                    quantity: validItems.reduce((s, i) => s + Number(i.quantity || 0), 0),
                    priority: this.reqPriority || 'normal',
                    notes: this.reqNotes || '',
                    updatedAt: now,
                };
                await window.update(window.ref(window.db, `Requisitions/${this.reqEditId}`), updates);
                const idx = this.requisitions.findIndex(r => r.id === this.reqEditId);
                if (idx >= 0) Object.assign(this.requisitions[idx], updates);
                if (this.selectedRequisition?.id === this.reqEditId) Object.assign(this.selectedRequisition, updates);
                this.showNotification('✅ Permintaan diupdate');
            } else {
                // --- NEW: single record with items array ---
                const id = `REQ_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                const record = {
                    id,
                    items: validItems,
                    itemName: validItems[0]?.itemName || '',
                    itemType: validItems[0]?.itemType || 'part',
                    quantity: validItems.reduce((s, i) => s + Number(i.quantity || 0), 0),
                    priority: this.reqPriority || 'normal',
                    notes: this.reqNotes || '',
                    status: 'pending',
                    requesterName: this.user?.email || 'Unknown',
                    createdBy: this.user?.uid || 'unknown',
                    requestDate: today,
                    createdAt: now,
                    updatedAt: now,
                };
                await window.set(window.ref(window.db, `Requisitions/${id}`), record);
                this.requisitions.unshift(record);
                this.showNotification(`✅ ${validItems.length} item berhasil diajukan dalam 1 permintaan`);
            }

            this.showReqModal = false;
        } catch (e) {
            console.error('[Requisition] Submit error:', e);
            this.showNotification('Error: ' + e.message, 'error');
        } finally {
            this.reqLoading = false;
        }
    },

    async approveRequisition(reqId) {
        if (!confirm('Setujui dan proses pemesanan permintaan ini?')) return;
        try {
            const now = new Date().toISOString();
            const updates = {
                status: 'approved',
                approvedBy: this.user?.email || 'Admin',
                approvedAt: now.split('T')[0],
                updatedAt: now,
            };
            await window.update(window.ref(window.db, `Requisitions/${reqId}`), updates);

            const idx = this.requisitions.findIndex(r => r.id === reqId);
            if (idx >= 0) Object.assign(this.requisitions[idx], updates);
            if (this.selectedRequisition?.id === reqId) Object.assign(this.selectedRequisition, updates);

            this.showNotification('✅ Permintaan disetujui & diproses');
        } catch (e) {
            this.showNotification('Error: ' + e.message, 'error');
        }
    },

    async markArrived(reqId) {
        if (!confirm('Tandai barang sudah tiba?')) return;
        try {
            const now = new Date().toISOString();
            const today = now.split('T')[0];
            const updates = {
                status: 'arrived',
                arrivedDate: today,
                updatedAt: now,
            };
            await window.update(window.ref(window.db, `Requisitions/${reqId}`), updates);

            const req = this.requisitions.find(r => r.id === reqId);
            if (req) Object.assign(req, updates);
            if (this.selectedRequisition?.id === reqId) Object.assign(this.selectedRequisition, updates);

            // Auto-update stok spare part jika tipe = part dan partId ada
            if (req && req.itemType === 'part' && req.partId) {
                const part = this.allParts.find(p => p.PartID === req.partId);
                if (part) {
                    const newStok = (Number(part.Stok) || 0) + Number(req.quantity);
                    await window.update(window.ref(window.db, `SpareParts/${req.partId}`), {
                        Stok: newStok,
                    });
                    part.Stok = newStok;
                    this.showNotification(`📦 Stok ${part.NamaPart || req.partId} bertambah +${req.quantity}`);
                }
            }

            this.showNotification('✅ Barang ditandai sudah tiba');
        } catch (e) {
            this.showNotification('Error: ' + e.message, 'error');
        }
    },

    async closeRequisition(reqId) {
        if (!confirm('Tutup permintaan ini?')) return;
        try {
            const now = new Date().toISOString();
            const updates = {
                status: 'closed',
                closedAt: now.split('T')[0],
                updatedAt: now,
            };
            await window.update(window.ref(window.db, `Requisitions/${reqId}`), updates);

            const idx = this.requisitions.findIndex(r => r.id === reqId);
            if (idx >= 0) Object.assign(this.requisitions[idx], updates);
            if (this.selectedRequisition?.id === reqId) Object.assign(this.selectedRequisition, updates);

            this.reqShowDetail = false;
            this.showNotification('✅ Permintaan ditutup');
        } catch (e) {
            this.showNotification('Error: ' + e.message, 'error');
        }
    },

    async bulkApproveRequisitions() {
        const ids = [...this.reqSelectedIds];
        if (!ids.length) return;
        if (!confirm(`Approve ${ids.length} request(s)? This will update stock.`)) return;
        
        const now = new Date().toISOString();
        const today = now.split('T')[0];
        let success = 0;
        let errors = 0;
        
        for (const id of ids) {
            const req = this.requisitions.find(r => r.id === id);
            if (!req || req.status !== 'pending') continue;
            
            try {
                const updates = {
                    status: 'approved',
                    approvedBy: this.currentUser?.email || 'unknown',
                    approvedAt: now,
                    updatedAt: now,
                };
                await window.update(window.ref(window.db, `Requisitions/${id}`), updates);
                Object.assign(req, updates);
                success++;
            } catch (e) {
                console.error(`[Requisition] bulk approve fail for ${id}:`, e);
                errors++;
            }
        }
        
        this.reqSelectedIds = [];
        this.showNotification(`✅ ${success} approved${errors ? ', ' + errors + ' failed' : ''}`);
    },

    async deleteRequisition(reqId) {
        if (!confirm('Hapus permintaan ini?')) return;
        try {
            await window.remove(window.ref(window.db, `Requisitions/${reqId}`));
            this.requisitions = this.requisitions.filter(r => r.id !== reqId);
            this.reqShowDetail = false;
            this.showNotification('Permintaan dihapus');
        } catch (e) {
            this.showNotification('Error: ' + e.message, 'error');
        }
    },

    // --- FILTER ---
    reqGetFilteredList() {
        let list = this.requisitions || [];
        if (this.reqFilterStatus) list = list.filter(r => r.status === this.reqFilterStatus);
        if (this.reqFilterType) list = list.filter(r => r.itemType === this.reqFilterType);
        return [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },
};
