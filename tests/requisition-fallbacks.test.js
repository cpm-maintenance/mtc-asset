// @vitest-environment jsdom
/**
 * Cabang fallback `src/js/modules/requisition.js` (kartu D, S33af).
 *
 * `tests/requisition-module.test.js` menguji alur normal (semua field terisi).
 * Yang tersisa 76 branch adalah sisi kanan `||` dan jalur "data lama":
 *  - `openRequisitionModal()` tanpa argumen, dan dengan record yang tidak punya
 *    `items` (permintaan era sebelum multi-item) → line item dibangun dari field
 *    tunggal dengan default;
 *  - clone line item tidak boleh berbagi referensi dengan record asli;
 *  - `autoReorderLowStock()` dengan `PartID` / `partId` / `NamaPart`, part yang
 *    sudah diajukan (pending/approved), part dengan `MinStock` 0;
 *  - backlink WO: `reqIds` belum ada → dibuat, sudah berisi → tidak dobel.
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

function makeCtx(overrides = {}) {
    const ctx = Object.create(requisitionModule);
    Object.assign(ctx, {
        requisitions: [],
        reqLineItems: [],
        reqPriority: 'normal',
        reqNotes: '',
        reqEditMode: false,
        reqEditId: null,
        reqWoId: '',
        reqWoNumber: '',
        reqLoading: false,
        reqSelectedIds: [],
        allParts: [],
        logs: [],
        user: { email: 'andi@cpm.co.id', uid: 'uid-1' },
        showNotification: vi.fn(),
    });
    return Object.assign(ctx, overrides);
}

beforeEach(() => {
    window.db = {};
    window.ref = vi.fn((_db, path) => path);
    window.set = vi.fn(async () => {});
    window.update = vi.fn(async () => {});
    window.remove = vi.fn(async () => {});
    window.confirm = vi.fn(() => true);
    window.auditModule = { logAudit: vi.fn() };
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('openRequisitionModal — data lama & default', () => {
    it('tanpa argumen: mode baru dengan satu baris kosong', () => {
        const ctx = makeCtx();
        ctx.openRequisitionModal();
        expect(ctx.reqEditMode).toBe(false);
        expect(ctx.reqEditId).toBeNull();
        expect(ctx.reqLineItems).toHaveLength(1);
        expect(ctx.showReqModal).toBe(true);
    });

    it('record tanpa items → line item dibangun dari field tunggal + default', () => {
        const ctx = makeCtx();
        ctx.openRequisitionModal({ id: 'REQ-1', itemName: 'Bearing', quantity: 3 });
        expect(ctx.reqEditMode).toBe(true);
        expect(ctx.reqEditId).toBe('REQ-1');
        expect(ctx.reqLineItems).toEqual([
            {
                itemType: 'part',
                itemName: 'Bearing',
                partId: '',
                quantity: 3,
                unit: 'pcs',
                equipmentId: '',
                noResv: '',
            },
        ]);
        expect(ctx.reqPriority).toBe('normal');
        expect(ctx.reqNotes).toBe('');
    });

    it('quantity 0/kosong jatuh ke 1 (bukan 0)', () => {
        const ctx = makeCtx();
        ctx.openRequisitionModal({ id: 'REQ-2', itemName: 'Seal', quantity: 0 });
        expect(ctx.reqLineItems[0].quantity).toBe(1);
    });

    it('record ber-items di-clone, bukan dibagi referensinya', () => {
        const source = { id: 'REQ-3', items: [{ itemName: 'V-Belt', quantity: 2 }] };
        const ctx = makeCtx();
        ctx.openRequisitionModal(source);
        ctx.reqLineItems[0].quantity = 99;
        expect(source.items[0].quantity).toBe(2);
    });
});

describe('autoReorderLowStock — varian nama field & dedupe', () => {
    it('memakai PartID, partId, atau NamaPart sebagai identitas', async () => {
        const ctx = makeCtx({
            allParts: [
                { PartID: 'P-1', NamaPart: 'Bearing', Stok: 1, MinStock: 5 },
                { partId: 'P-2', NamaPart: 'Seal', Stok: 0, MinStock: 2 },
                { NamaPart: 'V-Belt', Stok: 1, MinStock: 3 },
            ],
        });
        await ctx.autoReorderLowStock();
        const ids = window.set.mock.calls.map((c) => c[1].items[0].partId);
        expect(ids).toEqual(['P-1', 'P-2', 'V-Belt']);
    });

    it('melewati part yang sudah punya permintaan pending/approved', async () => {
        const ctx = makeCtx({
            allParts: [{ PartID: 'P-1', NamaPart: 'Bearing', Stok: 0, MinStock: 4 }],
            requisitions: [{ id: 'R', status: 'pending', items: [{ partId: 'P-1' }] }],
        });
        await ctx.autoReorderLowStock();
        expect(window.set).not.toHaveBeenCalled();
    });

    it('melewati requisition tanpa items dan part dengan MinStock 0', async () => {
        const ctx = makeCtx({
            allParts: [{ PartID: 'P-9', NamaPart: 'X', Stok: 0, MinStock: 0 }],
            requisitions: [{ id: 'R', status: 'approved' }],
        });
        await ctx.autoReorderLowStock();
        expect(window.set).not.toHaveBeenCalled();
    });
});

describe('submitRequisition — backlink reqIds ke WO', () => {
    const lineItem = { itemName: 'Bearing', quantity: 2, partId: 'P-1' };

    it('WO tanpa reqIds → dibuat array baru berisi id', async () => {
        const wo = { LogID: 'WO-1' };
        const ctx = makeCtx({ reqLineItems: [lineItem], reqWoId: 'WO-1', logs: [wo] });
        await ctx.submitRequisition();
        expect(window.update).toHaveBeenCalledWith('HistoryLog/WO-1', {
            reqIds: [expect.any(String)],
        });
        expect(Array.isArray(wo.reqIds)).toBe(true);
    });

    it('WO yang sudah memuat id tidak diduplikasi (id deterministik)', async () => {
        // Id requisition = `REQ_${Date.now()}_${random36}`; distub supaya id-nya
        // bisa di-seed ke `reqIds` dan cabang `cur.includes(id)` benar-benar dieksekusi.
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
        const rndSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const id = `REQ_1700000000000_${(0.5).toString(36).substring(2, 9)}`;

        const wo = { LogID: 'WO-1', reqIds: [id] };
        const ctx = makeCtx({ reqLineItems: [lineItem], reqWoId: 'WO-1', logs: [wo] });
        await ctx.submitRequisition();

        expect(window.update).toHaveBeenCalledWith('HistoryLog/WO-1', { reqIds: [id] });
        expect(wo.reqIds).toEqual([id]);

        nowSpy.mockRestore();
        rndSpy.mockRestore();
    });

    it('WO yang sudah punya id lain tetap ditambahi', async () => {
        const wo = { LogID: 'WO-1', reqIds: ['REQ_OLD'] };
        const ctx = makeCtx({ reqLineItems: [lineItem], reqWoId: 'WO-1', logs: [wo] });
        await ctx.submitRequisition();
        expect(wo.reqIds).toHaveLength(2);
        expect(wo.reqIds[0]).toBe('REQ_OLD');
    });

    it('kegagalan backlink tidak menggagalkan submit', async () => {
        window.update = vi.fn(async () => {
            throw new Error('offline');
        });
        const ctx = makeCtx({
            reqLineItems: [lineItem],
            reqWoId: 'WO-1',
            logs: [{ LogID: 'WO-1' }],
        });
        await expect(ctx.submitRequisition()).resolves.toBeUndefined();
        expect(ctx.reqLoading).toBe(false);
    });
});
