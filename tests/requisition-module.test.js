// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/requisition.js` (Q-1).
 *
 * Cakupan:
 *  - kalkulasi murni: `itemAvail`, `reqGetFilteredList`, getter `openWOs`
 *  - manajemen line item: `reqAddLineItem`, `reqRemoveLineItem`
 *  - CRUD + transisi status: `submitRequisition` (baru & edit), `approveRequisition`,
 *    `markArrived` (termasuk auto-tambah stok), `closeRequisition`,
 *    `bulkApproveRequisitions`, `deleteRequisition`
 *  - `autoReorderLowStock` (dedupe part yang sudah diajukan, qty = MinStock*2 - Stok)
 *
 * Firebase di-stub lewat `window.ref/update/set/remove`. `confirm()` di-stub.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/js/modules/notification.js', () => ({
    sendBrowserNotification: vi.fn(),
    resetNotifBlocker: vi.fn(),
    requestNotificationPermission: vi.fn(),
    sendBrowserNotificationAsync: vi.fn(),
    registerFCMToken: vi.fn(),
    removeFCMToken: vi.fn(),
    setupForegroundListener: vi.fn(),
    checkAllNotifications: vi.fn(),
}));

vi.mock('../src/js/modules/push-client.js', () => ({
    sendPushViaProxy: vi.fn(),
}));

import { requisitionModule } from '../src/js/modules/requisition.js';

/** State bersih dengan rantai prototype ke modul (metode + getter tetap hidup). */
function makeCtx(overrides = {}) {
    const ctx = Object.create(requisitionModule);
    ctx.requisitions = [];
    ctx.reqLineItems = [];
    ctx.reqPriority = 'normal';
    ctx.reqNotes = '';
    ctx.reqFilterStatus = '';
    ctx.reqFilterType = '';
    ctx.selectedRequisition = null;
    ctx.reqShowDetail = false;
    ctx.showReqModal = false;
    ctx.reqLoading = true;
    ctx.reqEditMode = false;
    ctx.reqEditId = null;
    ctx.reqWoId = '';
    ctx.reqWoNumber = '';
    ctx.reqSelectedIds = [];
    ctx.allParts = [];
    ctx.logs = [];
    ctx.user = { email: 'andi@cpm.co.id', uid: 'uid-1' };
    ctx.showNotification = vi.fn();
    return Object.assign(ctx, overrides);
}

/** Stub minimal surface Firebase yang dipakai modul. */
function stubFirebase() {
    window.db = {};
    window.ref = vi.fn((_db, path) => path);
    window.set = vi.fn(async () => {});
    window.update = vi.fn(async () => {});
    window.remove = vi.fn(async () => {});
}

beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    stubFirebase();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.db;
    delete window.ref;
    delete window.set;
    delete window.update;
    delete window.remove;
});

describe('requisition.js — itemAvail', () => {
    it('mengembalikan ok tanpa info stok bila item tidak punya partId', () => {
        const ctx = makeCtx();
        expect(ctx.itemAvail(null)).toEqual({ ok: true, available: null, shortage: 0 });
        expect(ctx.itemAvail({ itemType: 'material', quantity: 3 })).toEqual({
            ok: true,
            available: null,
            shortage: 0,
        });
    });

    it('menandai tersedia bila stok cukup', () => {
        const ctx = makeCtx({ allParts: [{ PartID: 'P1', Stok: 10 }] });
        const res = ctx.itemAvail({ partId: 'P1', quantity: 5 });

        expect(res.ok).toBe(true);
        expect(res.available).toBe(10);
        expect(res.shortage).toBe(0);
    });

    it('menghitung shortage bila stok kurang', () => {
        const ctx = makeCtx({ allParts: [{ PartID: 'P1', Stok: 2 }] });
        const res = ctx.itemAvail({ partId: 'P1', quantity: 5 });

        expect(res.ok).toBe(false);
        expect(res.available).toBe(2);
        expect(res.shortage).toBe(3);
    });

    it('menganggap part tidak dikenal sebagai stok 0', () => {
        const ctx = makeCtx({ allParts: [] });
        const res = ctx.itemAvail({ partId: 'P9', quantity: 4 });

        expect(res.ok).toBe(false);
        expect(res.available).toBe(0);
        expect(res.shortage).toBe(4);
    });
});

describe('requisition.js — reqGetFilteredList', () => {
    const rows = [
        { id: 'R1', status: 'pending', itemType: 'part', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'R2', status: 'approved', itemType: 'material', createdAt: '2026-03-01T00:00:00Z' },
        { id: 'R3', status: 'pending', itemType: 'material', createdAt: '2026-02-01T00:00:00Z' },
    ];

    it('mengurutkan terbaru dulu tanpa filter', () => {
        const ctx = makeCtx({ requisitions: rows });
        expect(ctx.reqGetFilteredList().map((r) => r.id)).toEqual(['R2', 'R3', 'R1']);
    });

    it('menyaring per status', () => {
        const ctx = makeCtx({ requisitions: rows, reqFilterStatus: 'pending' });
        expect(ctx.reqGetFilteredList().map((r) => r.id)).toEqual(['R3', 'R1']);
    });

    it('menyaring per tipe item', () => {
        const ctx = makeCtx({ requisitions: rows, reqFilterType: 'material' });
        expect(ctx.reqGetFilteredList().map((r) => r.id)).toEqual(['R2', 'R3']);
    });

    it('menggabungkan kedua filter', () => {
        const ctx = makeCtx({ requisitions: rows, reqFilterStatus: 'pending', reqFilterType: 'material' });
        expect(ctx.reqGetFilteredList().map((r) => r.id)).toEqual(['R3']);
    });

    it('tidak memutasi array sumber', () => {
        const ctx = makeCtx({ requisitions: rows });
        const out = ctx.reqGetFilteredList();

        expect(out).not.toBe(rows);
        expect(rows.map((r) => r.id)).toEqual(['R1', 'R2', 'R3']);
    });

    it('aman saat requisitions undefined', () => {
        const ctx = makeCtx({ requisitions: undefined });
        expect(ctx.reqGetFilteredList()).toEqual([]);
    });
});

describe('requisition.js — openWOs', () => {
    it('membuang WO selesai/batal dan mengurutkan menurun', () => {
        const ctx = makeCtx({
            logs: [
                { LogID: '1', woNumber: 'WO-10', Status: 'Pending' },
                { LogID: '2', woNumber: 'WO-9', Status: 'Completed' },
                { LogID: '3', woNumber: 'WO-11', Status: 'Cancelled' },
                { LogID: '4', woNumber: 'WO-8', Status: 'Approved' },
                { LogID: '5', Status: 'Pending' },
            ],
        });

        expect(ctx.openWOs.map((l) => l.woNumber)).toEqual(['WO-8', 'WO-10']);
    });

    it('aman saat logs kosong', () => {
        expect(makeCtx().openWOs).toEqual([]);
    });
});

describe('requisition.js — line item', () => {
    it('reqAddLineItem menambah item baru dengan bentuk default', () => {
        const ctx = makeCtx({ reqLineItems: [] });
        ctx.reqAddLineItem();

        expect(ctx.reqLineItems).toEqual([
            { itemType: 'part', itemName: '', partId: '', quantity: 1, unit: 'pcs', equipmentId: '', noResv: '' },
        ]);
    });

    it('setiap item adalah objek terpisah (tidak berbagi referensi)', () => {
        const ctx = makeCtx({ reqLineItems: [] });
        ctx.reqAddLineItem();
        ctx.reqAddLineItem();
        ctx.reqLineItems[0].itemName = 'Bearing';

        expect(ctx.reqLineItems[1].itemName).toBe('');
    });

    it('reqRemoveLineItem menghapus indeks yang diminta', () => {
        const ctx = makeCtx({ reqLineItems: [{ itemName: 'A' }, { itemName: 'B' }, { itemName: 'C' }] });
        ctx.reqRemoveLineItem(1);

        expect(ctx.reqLineItems.map((i) => i.itemName)).toEqual(['A', 'C']);
    });

    it('reqRemoveLineItem tidak menghapus item terakhir', () => {
        const ctx = makeCtx({ reqLineItems: [{ itemName: 'A' }] });
        ctx.reqRemoveLineItem(0);

        expect(ctx.reqLineItems).toHaveLength(1);
    });
});

describe('requisition.js — submitRequisition', () => {
    it('menolak submit tanpa item valid', async () => {
        const ctx = makeCtx({ reqLineItems: [{ itemName: '', quantity: 1 }, { itemName: 'X', quantity: 0 }] });

        await ctx.submitRequisition();

        expect(ctx.showNotification).toHaveBeenCalledWith('Minimal 1 item dengan nama dan jumlah valid', 'error');
        expect(window.set).not.toHaveBeenCalled();
        expect(ctx.reqLoading).toBe(true); // tidak pernah masuk try → tidak di-reset
    });

    it('membuat satu record berisi semua item + jumlah total', async () => {
        const ctx = makeCtx({
            reqLineItems: [
                { itemName: 'Bearing 6205', itemType: 'part', partId: 'P1', quantity: 2 },
                { itemName: 'Grease', itemType: 'material', quantity: 3 },
            ],
            reqPriority: 'urgent',
            reqNotes: 'segera',
            reqLoading: false,
        });

        await ctx.submitRequisition();

        expect(window.set).toHaveBeenCalledTimes(1);
        const [path, record] = window.set.mock.calls[0];
        expect(path).toMatch(/^Requisitions\/REQ_\d+_[a-z0-9]+$/);
        expect(record.items).toHaveLength(2);
        expect(record.quantity).toBe(5);
        expect(record.priority).toBe('urgent');
        expect(record.notes).toBe('segera');
        expect(record.status).toBe('pending');
        expect(record.requesterName).toBe('andi@cpm.co.id');
        expect(record.createdBy).toBe('uid-1');
        expect(record.requestDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        expect(ctx.requisitions).toHaveLength(1);
        expect(ctx.requisitions[0].id).toBe(record.id);
        expect(ctx.showReqModal).toBe(false);
        expect(ctx.reqLoading).toBe(false);
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ 2 item berhasil diajukan dalam 1 permintaan');
    });

    it('membuat backlink reqIds ke Work Order terkait', async () => {
        const wo = { LogID: 'L1', woNumber: 'WO-77', Status: 'Pending' };
        const ctx = makeCtx({
            reqLineItems: [{ itemName: 'Seal', itemType: 'part', quantity: 1 }],
            reqWoId: 'L1',
            logs: [wo],
            reqLoading: false,
        });

        await ctx.submitRequisition();

        const backlink = window.update.mock.calls.find((c) => c[0] === 'HistoryLog/L1');
        expect(backlink).toBeDefined();
        expect(backlink[1].reqIds).toEqual([ctx.requisitions[0].id]);
        expect(wo.reqIds).toEqual([ctx.requisitions[0].id]);
        expect(ctx.requisitions[0].woNumber).toBe('WO-77');
    });

    it('mengupdate record yang sedang diedit tanpa membuat record baru', async () => {
        const existing = { id: 'REQ_EDIT', itemName: 'Lama', createdAt: '2026-01-01' };
        const ctx = makeCtx({
            reqLineItems: [{ itemName: 'Baru', itemType: 'material', quantity: 4 }],
            reqEditMode: true,
            reqEditId: 'REQ_EDIT',
            requisitions: [existing],
            selectedRequisition: existing,
            reqNotes: 'catatan baru',
            reqLoading: false,
        });

        await ctx.submitRequisition();

        expect(window.set).not.toHaveBeenCalled();
        expect(window.update).toHaveBeenCalledWith('Requisitions/REQ_EDIT', expect.objectContaining({ itemName: 'Baru', quantity: 4 }));
        expect(existing.itemName).toBe('Baru');
        expect(existing.notes).toBe('catatan baru');
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ Permintaan diupdate');
    });

    it('melaporkan error bila penulisan Firebase gagal', async () => {
        window.set = vi.fn(async () => {
            throw new Error('permission denied');
        });
        const ctx = makeCtx({ reqLineItems: [{ itemName: 'X', quantity: 1 }], reqLoading: false });

        await ctx.submitRequisition();

        expect(ctx.showNotification).toHaveBeenCalledWith('Error: permission denied', 'error');
        expect(ctx.reqLoading).toBe(false);
    });
});

describe('requisition.js — transisi status', () => {
    it('approveRequisition menulis status approved + approvedBy', async () => {
        const req = { id: 'R1', status: 'pending' };
        const ctx = makeCtx({ requisitions: [req], selectedRequisition: req });

        await ctx.approveRequisition('R1');

        expect(window.update).toHaveBeenCalledWith(
            'Requisitions/R1',
            expect.objectContaining({ status: 'approved', approvedBy: 'andi@cpm.co.id' }),
        );
        expect(req.status).toBe('approved');
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ Permintaan disetujui & diproses');
    });

    it('approveRequisition berhenti bila user membatalkan confirm', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        const ctx = makeCtx({ requisitions: [{ id: 'R1', status: 'pending' }] });

        await ctx.approveRequisition('R1');

        expect(window.update).not.toHaveBeenCalled();
        expect(ctx.showNotification).not.toHaveBeenCalled();
    });

    it('markArrived menambah stok part terkait', async () => {
        const req = { id: 'R1', itemType: 'part', partId: 'P1', quantity: 5, status: 'approved' };
        const part = { PartID: 'P1', NamaPart: 'Bearing', Stok: 10 };
        const ctx = makeCtx({ requisitions: [req], allParts: [part] });

        await ctx.markArrived('R1');

        expect(part.Stok).toBe(15);
        expect(window.update).toHaveBeenCalledWith('SpareParts/P1', { Stok: 15 });
        expect(req.status).toBe('arrived');
        expect(ctx.showNotification).toHaveBeenCalledWith('📦 Stok Bearing bertambah +5');
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ Barang ditandai sudah tiba');
    });

    it('markArrived tidak menyentuh stok untuk item non-part', async () => {
        const req = { id: 'R1', itemType: 'material', quantity: 5, status: 'approved' };
        const ctx = makeCtx({ requisitions: [req], allParts: [{ PartID: 'P1', Stok: 10 }] });

        await ctx.markArrived('R1');

        expect(window.update).toHaveBeenCalledTimes(1);
        expect(window.update).toHaveBeenCalledWith('Requisitions/R1', expect.objectContaining({ status: 'arrived' }));
    });

    it('closeRequisition menutup detail modal', async () => {
        const req = { id: 'R1', status: 'arrived' };
        const ctx = makeCtx({ requisitions: [req], reqShowDetail: true });

        await ctx.closeRequisition('R1');

        expect(req.status).toBe('closed');
        expect(ctx.reqShowDetail).toBe(false);
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ Permintaan ditutup');
    });

    it('deleteRequisition membuang record dari state', async () => {
        const ctx = makeCtx({
            requisitions: [{ id: 'R1' }, { id: 'R2' }],
            reqShowDetail: true,
        });

        await ctx.deleteRequisition('R1');

        expect(window.remove).toHaveBeenCalledWith('Requisitions/R1');
        expect(ctx.requisitions.map((r) => r.id)).toEqual(['R2']);
        expect(ctx.reqShowDetail).toBe(false);
        expect(ctx.showNotification).toHaveBeenCalledWith('Permintaan dihapus');
    });

    it('bulkApproveRequisitions hanya memproses yang masih pending', async () => {
        const r1 = { id: 'R1', status: 'pending' };
        const r2 = { id: 'R2', status: 'approved' };
        const ctx = makeCtx({
            requisitions: [r1, r2],
            reqSelectedIds: ['R1', 'R2'],
            user: { email: 'admin@cpm.co.id', uid: 'uid-admin' },
        });

        await ctx.bulkApproveRequisitions();

        expect(window.update).toHaveBeenCalledTimes(1);
        expect(window.update).toHaveBeenCalledWith(
            'Requisitions/R1',
            expect.objectContaining({ status: 'approved', approvedBy: 'admin@cpm.co.id' }),
        );
        expect(r1.status).toBe('approved');
        expect(r2.status).toBe('approved');
        expect(ctx.reqSelectedIds).toEqual([]);
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ 1 approved');
    });

    it('bulkApproveRequisitions tidak jalan tanpa pilihan', async () => {
        const ctx = makeCtx({ reqSelectedIds: [] });

        await ctx.bulkApproveRequisitions();

        expect(window.update).not.toHaveBeenCalled();
        expect(ctx.showNotification).not.toHaveBeenCalled();
    });

    it('bulkApproveRequisitions menghitung kegagalan per record', async () => {
        window.update = vi.fn(async () => {
            throw new Error('offline');
        });
        const ctx = makeCtx({
            requisitions: [{ id: 'R1', status: 'pending' }],
            reqSelectedIds: ['R1'],
            user: { email: 'a@b.c' },
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await ctx.bulkApproveRequisitions();

        expect(ctx.showNotification).toHaveBeenCalledWith('✅ 0 approved, 1 failed');
    });
});

describe('requisition.js — autoReorderLowStock', () => {
    it('tidak jalan tanpa window.db', async () => {
        delete window.db;
        const ctx = makeCtx({ allParts: [{ PartID: 'P1', NamaPart: 'A', Stok: 0, MinStock: 5 }] });

        await expect(ctx.autoReorderLowStock()).resolves.toBeUndefined();
    });

    it('membuat requisition dengan qty = MinStock*2 - Stok', async () => {
        const ctx = makeCtx({ allParts: [{ PartID: 'P1', NamaPart: 'Bearing', Stok: 2, MinStock: 5 }] });

        const created = await ctx.autoReorderLowStock();

        expect(created).toBe(1);
        const [path, record] = window.set.mock.calls[0];
        expect(path).toMatch(/^Requisitions\/REQ_/);
        expect(record.quantity).toBe(8); // 5*2 - 2
        expect(record.priority).toBe('high');
        expect(record.auto).toBe(true);
        expect(record.createdBy).toBe('system-auto');
        expect(record.items[0]).toEqual({ itemName: 'Bearing', quantity: 8, partId: 'P1', itemType: 'part' });
        expect(ctx.showNotification).toHaveBeenCalledWith('1 spare low stock → requisition otomatis dibuat');
    });

    it('melewati part yang sudah punya requisition pending/approved', async () => {
        const ctx = makeCtx({
            allParts: [
                { PartID: 'P1', NamaPart: 'Bearing', Stok: 1, MinStock: 5 },
                { PartID: 'P2', NamaPart: 'Seal', Stok: 0, MinStock: 4 },
            ],
            requisitions: [{ id: 'REQ_X', status: 'pending', items: [{ partId: 'P1' }] }],
        });

        const created = await ctx.autoReorderLowStock();

        expect(created).toBe(1);
        expect(window.set.mock.calls[0][1].items[0].partId).toBe('P2');
    });

    it('mengabaikan part tanpa MinStock dan yang stoknya masih di atas minimum', async () => {
        const ctx = makeCtx({
            allParts: [
                { PartID: 'P1', NamaPart: 'A', Stok: 0, MinStock: 0 },
                { PartID: 'P2', NamaPart: 'B', Stok: 9, MinStock: 5 },
            ],
        });

        await expect(ctx.autoReorderLowStock()).resolves.toBe(0);
        expect(window.set).not.toHaveBeenCalled();
        expect(ctx.showNotification).not.toHaveBeenCalled();
    });

    it('memakai qty minimum 1 saat MinStock*2 - Stok di bawah 1', async () => {
        // MinStock 0.5, Stok 0.2 → 0.5*2 - 0.2 = 0.8 → di-clamp ke 1
        const ctx = makeCtx({ allParts: [{ PartID: 'P1', NamaPart: 'A', Stok: 0.2, MinStock: 0.5 }] });

        await ctx.autoReorderLowStock();

        expect(window.set.mock.calls[0][1].quantity).toBe(1);
    });
});
