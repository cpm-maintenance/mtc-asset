// @vitest-environment jsdom
/**
 * S38: cabang sisa `src/js/modules/requisition.js`.
 *
 * Fokus pada sisi yang belum pernah dieksekusi: state kosong (`this.logs`,
 * `this.allParts`, `this.requisitions` undefined), fallback nama peminta/item,
 * pembatalan `confirm()`, record yang tidak ada di state, dan segar-ulang
 * `selectedRequisition`. Empat cabang sengaja tidak dikejar karena mustahil
 * dijangkau: `validItems[0]?.itemName || …` (189/214) dan `Number(i.quantity || 0)`
 * (191/216) — filter `itemName && quantity > 0` sudah menjamin keduanya terisi,
 * dan `openWOs` (442) menyaring `woNumber` sebelum comparator-nya jalan.
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
    sendPushViaProxy: vi.fn().mockResolvedValue(undefined),
}));

import { requisitionModule } from '../src/js/modules/requisition.js';

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

let handler;

beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    handler = null;
    window.db = {};
    window.ref = vi.fn((_db, path) => path);
    window.set = vi.fn(async () => {});
    window.update = vi.fn(async () => {});
    window.remove = vi.fn(async () => {});
    window.onValue = vi.fn((_ref, cb) => {
        handler = cb;
        return vi.fn();
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.db;
    delete window.ref;
    delete window.set;
    delete window.update;
    delete window.remove;
    delete window.onValue;
});

function snapshot(value) {
    return { exists: () => value !== undefined, val: () => value };
}

describe('requisition.js — listener state kosong', () => {
    it('menyemai _reqPrevStatuses bila hanya _reqSeenIds yang tersisa', () => {
        const self = makeCtx({ _reqPrevStatuses: undefined, _reqSeenIds: new Set(['R1']) });

        self.setupRequisitionsListener();
        handler(snapshot({ R1: { status: 'pending' } }));

        expect(self._reqPrevStatuses).toEqual({ R1: 'pending' });
    });

    it('memberi label default saat peminta dan nama item tidak ada', () => {
        const self = makeCtx({ _reqSeenIds: new Set(), _reqPrevStatuses: {} });

        self.setupRequisitionsListener();
        handler(snapshot({ R9: { status: 'pending', items: [{ itemName: 'Bearing' }] } }));

        expect(self.showNotification).toHaveBeenCalledWith('📦 Someone requested: Item', 'info');
    });
});

describe('requisition.js — openRequisitionModal', () => {
    it('mengisi nama item kosong untuk record lama tanpa itemName', () => {
        const self = makeCtx();

        self.openRequisitionModal({ id: 'R1' });

        expect(self.reqLineItems[0].itemName).toBe('');
        expect(self.reqLineItems[0].itemType).toBe('part');
        expect(self.reqEditMode).toBe(true);
    });
});

describe('requisition.js — submitRequisition (edit)', () => {
    it('memakai default itemType/priority/notes dan aman bila record tidak ada di state', async () => {
        const self = makeCtx({
            reqEditMode: true,
            reqEditId: 'R-missing',
            reqLineItems: [{ itemName: 'Seal', quantity: 2 }],
            reqPriority: '',
            reqNotes: '',
            requisitions: [],
        });

        await self.submitRequisition();

        expect(window.update).toHaveBeenCalledWith(
            'Requisitions/R-missing',
            expect.objectContaining({ itemType: 'part', priority: 'normal', notes: '' })
        );
        expect(self.requisitions).toHaveLength(0);
    });

    it('menyegarkan record di state dan selectedRequisition saat yang diedit sedang dibuka', async () => {
        const rec = { id: 'R1', status: 'pending' };
        const self = makeCtx({
            reqEditMode: true,
            reqEditId: 'R1',
            reqLineItems: [{ itemName: 'Seal', quantity: 2 }],
            requisitions: [rec],
            selectedRequisition: { id: 'R1' },
        });

        await self.submitRequisition();

        expect(self.requisitions[0].itemName).toBe('Seal');
        expect(self.selectedRequisition.itemName).toBe('Seal');
    });
});

describe('requisition.js — submitRequisition (baru)', () => {
    it('mengisi default saat user, prioritas, dan woNumber belum tersedia', async () => {
        const self = makeCtx({
            user: null,
            reqPriority: '',
            reqWoId: 'WO1',
            reqWoNumber: '',
            logs: [{ LogID: 'WO1', woNumber: 'WO-777' }],
            reqLineItems: [{ itemName: 'Seal', quantity: 3 }],
        });

        await self.submitRequisition();

        const rec = self.requisitions[0];
        expect(rec.priority).toBe('normal');
        expect(rec.woNumber).toBe('WO-777');
        expect(rec.requesterName).toBe('Unknown');
        expect(rec.createdBy).toBe('unknown');
    });

    it('menulis backlink WO walau daftar log belum ada', async () => {
        const self = makeCtx({
            logs: undefined,
            reqWoId: 'WO1',
            reqLineItems: [{ itemName: 'Seal', quantity: 1 }],
        });

        await self.submitRequisition();

        expect(window.update).toHaveBeenCalledWith('HistoryLog/WO1', {
            reqIds: [expect.stringMatching(/^REQ_/)],
        });
    });

    it('menyegarkan reqIds pada WO yang ditemukan di state', async () => {
        const wo = { LogID: 'WO1', reqIds: [] };
        const self = makeCtx({
            logs: [wo],
            reqWoId: 'WO1',
            reqLineItems: [{ itemName: 'Seal', quantity: 1 }],
        });

        await self.submitRequisition();

        expect(wo.reqIds).toHaveLength(1);
        expect(wo.reqIds[0]).toBe(self.requisitions[0].id);
    });
});

describe('requisition.js — autoReorderLowStock state kosong', () => {
    it('aman saat allParts dan requisitions belum terisi', async () => {
        const self = makeCtx({ allParts: undefined, requisitions: undefined });

        await expect(self.autoReorderLowStock()).resolves.toBe(0);
    });

    it('mengabaikan requisition pending tanpa daftar items saat dedupe', async () => {
        const self = makeCtx({
            requisitions: [{ id: 'R1', status: 'pending' }],
            allParts: [{ PartID: 'P1', NamaPart: 'Seal', Stok: 0, MinStock: 2 }],
        });

        await expect(self.autoReorderLowStock()).resolves.toBe(1);
    });

    it('mendeteksi part pending lewat itemName saat partId tidak diisi', async () => {
        const self = makeCtx({
            requisitions: [
                { id: 'R1', status: 'pending', items: [{ itemName: 'Seal', quantity: 2 }] },
            ],
            allParts: [{ PartID: 'Seal', NamaPart: 'Seal', Stok: 0, MinStock: 2 }],
        });

        await expect(self.autoReorderLowStock()).resolves.toBe(0);
    });
});

describe('requisition.js — approveRequisition cabang sisa', () => {
    it('memakai approvedBy Admin tanpa user dan aman bila record tidak ada', async () => {
        const self = makeCtx({ user: null, requisitions: [] });

        await self.approveRequisition('R9');

        expect(window.update).toHaveBeenCalledWith(
            'Requisitions/R9',
            expect.objectContaining({ approvedBy: 'Admin' })
        );
    });

    it('menyegarkan selectedRequisition setelah approve', async () => {
        const rec = { id: 'R1' };
        const self = makeCtx({ requisitions: [rec], selectedRequisition: { id: 'R1' } });

        await self.approveRequisition('R1');

        expect(rec.status).toBe('approved');
        expect(self.selectedRequisition.status).toBe('approved');
    });
});

describe('requisition.js — markArrived cabang sisa', () => {
    it('berhenti bila user membatalkan confirm', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        const self = makeCtx();

        await self.markArrived('R1');

        expect(window.update).not.toHaveBeenCalled();
    });

    it('tidak menulis stok saat record tidak ada di state', async () => {
        const self = makeCtx({ requisitions: [] });

        await self.markArrived('R9');

        expect(window.update).toHaveBeenCalledTimes(1);
        expect(window.update).toHaveBeenCalledWith('Requisitions/R9', expect.anything());
    });

    it('menambah stok part tanpa Stok/NamaPart dan menyegarkan selectedRequisition', async () => {
        const part = { PartID: 'P1' };
        const req = { id: 'R1', itemType: 'part', partId: 'P1', quantity: 5 };
        const self = makeCtx({
            requisitions: [req],
            allParts: [part],
            selectedRequisition: { id: 'R1' },
        });

        await self.markArrived('R1');

        expect(part.Stok).toBe(5);
        expect(self.selectedRequisition.status).toBe('arrived');
        expect(self.showNotification).toHaveBeenCalledWith('📦 Stok P1 bertambah +5');
    });

    it('tidak menyentuh stok saat partId tidak ada di daftar part', async () => {
        const req = { id: 'R1', itemType: 'part', partId: 'P-missing', quantity: 4 };
        const self = makeCtx({ requisitions: [req], allParts: [{ PartID: 'P1', Stok: 9 }] });

        await self.markArrived('R1');

        expect(window.update).toHaveBeenCalledTimes(1);
        expect(self.showNotification).toHaveBeenCalledWith('✅ Barang ditandai sudah tiba');
    });
});

describe('requisition.js — closeRequisition cabang sisa', () => {
    it('berhenti bila user membatalkan confirm', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        const self = makeCtx();

        await self.closeRequisition('R1');

        expect(window.update).not.toHaveBeenCalled();
    });

    it('aman bila record tidak ada di state', async () => {
        const self = makeCtx({ requisitions: [] });

        await self.closeRequisition('R9');

        expect(self.reqShowDetail).toBe(false);
    });

    it('menyegarkan record dan selectedRequisition', async () => {
        const rec = { id: 'R1' };
        const self = makeCtx({ requisitions: [rec], selectedRequisition: { id: 'R1' } });

        await self.closeRequisition('R1');

        expect(rec.status).toBe('closed');
        expect(self.selectedRequisition.status).toBe('closed');
    });
});

describe('requisition.js — bulkApproveRequisitions cabang sisa', () => {
    it('berhenti bila user membatalkan confirm', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        const self = makeCtx({ reqSelectedIds: ['R1'], requisitions: [{ id: 'R1', status: 'pending' }] });

        await self.bulkApproveRequisitions();

        expect(window.update).not.toHaveBeenCalled();
    });

    it('memakai approvedBy unknown tanpa user', async () => {
        const self = makeCtx({
            user: null,
            reqSelectedIds: ['R1'],
            requisitions: [{ id: 'R1', status: 'pending' }],
        });

        await self.bulkApproveRequisitions();

        expect(window.update).toHaveBeenCalledWith(
            'Requisitions/R1',
            expect.objectContaining({ approvedBy: 'unknown' })
        );
    });
});

describe('requisition.js — deleteRequisition cabang sisa', () => {
    it('berhenti bila user membatalkan confirm', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        const self = makeCtx({ requisitions: [{ id: 'R1' }] });

        await self.deleteRequisition('R1');

        expect(window.remove).not.toHaveBeenCalled();
    });
});

describe('requisition.js — helper state kosong', () => {
    it('itemAvail aman saat allParts belum ada', () => {
        const self = makeCtx({ allParts: undefined });

        const res = self.itemAvail({ partId: 'P1', quantity: 2 });

        expect(res.ok).toBe(false);
        expect(res.available).toBe(0);
    });

    it('reqGetFilteredList mengurutkan record tanpa createdAt sebagai string kosong', () => {
        const self = makeCtx({
            requisitions: [{ id: 'A' }, { id: 'B', createdAt: '2026-01-01T00:00:00.000Z' }],
        });

        expect(self.reqGetFilteredList().map((r) => r.id)).toEqual(['B', 'A']);
    });

    it('reqGetFilteredList aman saat kedua record tidak punya createdAt', () => {
        const self = makeCtx({ requisitions: [{ id: 'A' }, { id: 'B' }] });

        expect(self.reqGetFilteredList().map((r) => r.id)).toEqual(['A', 'B']);
    });
});
