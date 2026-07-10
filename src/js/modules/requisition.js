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

const NEW_LINE_ITEM = () => ({
    itemType: 'part',
    itemName: '',
    partId: '',
    quantity: 1,
    unit: 'pcs',
    equipmentId: '',
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
    _reqUnsubscribe: null,

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
                    this.requisitions = Object.keys(data).map(id => ({ id, ...data[id] }));
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
            this.reqLineItems = [{
                itemType: req.itemType || 'part',
                itemName: req.itemName || '',
                partId: req.partId || '',
                quantity: Number(req.quantity) || 1,
                unit: req.unit || 'pcs',
                equipmentId: req.equipmentId || '',
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
                // --- UPDATE EXISTING (pending only) ---
                const existing = this.requisitions.find(r => r.id === this.reqEditId);
                if (existing && existing.status !== 'pending') {
                    this.showNotification('Can only edit pending requests', 'error');
                    this.showReqModal = false;
                    return;
                }
                const item = validItems[0];
                const updates = {
                    itemName: item.itemName,
                    itemType: item.itemType || 'part',
                    partId: item.partId || '',
                    quantity: Number(item.quantity),
                    unit: item.unit || 'pcs',
                    equipmentId: item.equipmentId || '',
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
                // --- NEW ---
                const promises = validItems.map(item => {
                    const id = `REQ_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    const record = {
                        id,
                        itemName: item.itemName,
                        itemType: item.itemType || 'part',
                        partId: item.partId || '',
                        quantity: Number(item.quantity),
                        unit: item.unit || 'pcs',
                        equipmentId: item.equipmentId || '',
                        priority: this.reqPriority || 'normal',
                        notes: this.reqNotes || '',
                        status: 'pending',
                        requesterName: this.user?.email || 'Unknown',
                        createdBy: this.user?.uid || 'unknown',
                        requestDate: today,
                        createdAt: now,
                        updatedAt: now,
                        batchGroup: `${Date.now()}`,
                    };
                    return window.set(window.ref(window.db, `Requisitions/${id}`), record)
                        .then(() => { this.requisitions.unshift(record); });
                });
                await Promise.all(promises);
                this.showNotification(`✅ ${validItems.length} permintaan berhasil diajukan`);
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

    async deleteRequisition(reqId) {
        const existing = this.requisitions.find(r => r.id === reqId);
        if (existing && existing.status !== 'pending') {
            this.showNotification('Can only delete pending requests', 'error');
            return;
        }
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
