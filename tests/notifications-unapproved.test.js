// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/js/modules/indexeddb.js', () => ({
    CAN_USE_IDB: true,
    idbManager: {
        db: { name: 'mock-idb' },
        getAll: vi.fn(async () => []),
        putBulk: vi.fn(async () => {}),
        getPendingOpsCount: vi.fn(async () => 0),
        getPendingOps: vi.fn(async () => []),
        addPendingOp: vi.fn(async () => {}),
        removePendingOp: vi.fn(async () => {}),
    },
}));

vi.mock('../src/js/modules/push-client.js', () => ({
    sendPushViaProxy: vi.fn(),
}));

import { dataModule } from '../src/js/modules/data.js';
import { checkAllNotifications, resetNotifBlocker } from '../src/js/modules/notification.js';

describe('Unapproved Work Order Notifications', () => {
    beforeEach(() => {
        resetNotifBlocker();
        window.app = { notifications: [], logs: [], allParts: [], pmList: [] };
    });

    describe('dataModule.checkPendingWorkOrders', () => {
        it('hanya menghitung WO yang belum di-approve (Pending atau Draft)', async () => {
            const ctx = {
                notifications: [],
                checkPendingWorkOrders: dataModule.checkPendingWorkOrders,
            };

            window.db = {};
            window.ref = vi.fn();
            window.query = vi.fn();
            window.limitToLast = vi.fn();
            window.get = vi.fn(async () => ({
                val: () => ({
                    L1: { Status: 'Pending', woNumber: 'MTC-001', Jenis: 'Repair' },
                    L2: { Status: 'Draft', woNumber: 'MTC-002', Jenis: 'PM' },
                    L3: { Status: 'Approved', woNumber: 'MTC-003', Jenis: 'Repair' },
                    L4: { Status: 'Completed', woNumber: 'MTC-004', Jenis: 'Breakdown' },
                    L5: { Status: 'Cancelled', woNumber: 'MTC-005', Jenis: 'Service' },
                }),
            }));

            await ctx.checkPendingWorkOrders();

            expect(ctx.notifications).toHaveLength(1);
            expect(ctx.notifications[0].message).toBe('2 Work Orders waiting for approval');
        });

        it('tidak menambah duplikat jika notifikasi sudah ada', async () => {
            const ctx = {
                notifications: [
                    { id: 1, type: 'Work Order', message: '1 Work Order waiting for approval' }
                ],
                checkPendingWorkOrders: dataModule.checkPendingWorkOrders,
            };

            window.db = {};
            window.ref = vi.fn();
            window.query = vi.fn();
            window.limitToLast = vi.fn();
            window.get = vi.fn(async () => ({
                val: () => ({
                    L1: { Status: 'Pending', woNumber: 'MTC-001', Jenis: 'Repair' },
                }),
            }));

            await ctx.checkPendingWorkOrders();

            expect(ctx.notifications).toHaveLength(1);
        });
    });

    describe('notification.js aging WO check', () => {
        it('tidak memasukkan WO yang sudah Approved ke dalam WO aging pending', () => {
            const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0];

            window.app.logs = [
                // Pending > 3 hari (harus kena alert)
                { LogID: '1', woNumber: 'MTC-101', Status: 'Pending', Tanggal: fourDaysAgo },
                // Approved > 3 hari (sudah disetujui supervisor, tidak boleh masuk aging pending)
                { LogID: '2', woNumber: 'MTC-102', Status: 'Approved', Tanggal: fourDaysAgo },
                // Completed > 3 hari (sudah selesai, tidak boleh masuk aging pending)
                { LogID: '3', woNumber: 'MTC-103', Status: 'Completed', Tanggal: fourDaysAgo },
            ];

            checkAllNotifications();

            const agingNotif = window.app.notifications.find(n => n.type === 'WO Aging');
            expect(agingNotif).toBeDefined();
            // Hanya 1 WO (MTC-101) yang pending > 3 hari
            expect(agingNotif.message).toContain('1 WO pending > 3 hari');
            expect(agingNotif.message).toContain('#MTC-101');
            expect(agingNotif.message).not.toContain('MTC-102');
        });
    });
});
