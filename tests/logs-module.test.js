// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/logs.js` (kartu A lanjutan, S25).
 *
 * Modul ini 9% karena hampir semua jalurnya menulis ke RTDB. Yang diuji di sini
 * adalah **aturan yang menentukan data**: transisi status WO (approve/reject/
 * start/complete), pemotongan stok saat approve, kalkulasi biaya downtime saat
 * complete, parsing `PartsUsed` dari tiga bentuk berbeda (string JSON, array,
 * objek hasil RTDB), dan cache `getLastHM`.
 *
 * `data.js` di-mock karena ia menarik `indexeddb.js` + `db.js` (Firebase nyata);
 * `utils.js` dipakai **asli** — helper murni itu justru bagian dari kontrak.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/js/modules/data.js', () => ({
    safeProcessFirebaseData: vi.fn((v) => Object.entries(v || {}).map(([k, x]) => ({ LogID: k, ...x }))),
}));

const { logsModule } = await import('../src/js/modules/logs.js');

function stubFirebase(overrides = {}) {
    const fns = {
        db: { name: 'db' },
        ref: vi.fn((db, path) => ({ path })),
        set: vi.fn(async () => {}),
        update: vi.fn(async () => {}),
        get: vi.fn(async () => ({ val: () => null })),
        runTransaction: vi.fn(async (ref, fn) => fn(10)),
        ...overrides,
    };
    for (const [k, v] of Object.entries(fns)) vi.stubGlobal(k, v);
    return fns;
}

function makeCtx(overrides = {}) {
    const ctx = Object.create(logsModule);
    ctx.logs = [];
    ctx.allParts = [];
    ctx.performanceData = [];
    ctx.equipment = [];
    ctx.notifications = [];
    ctx.user = { email: 'supervisor@x.id' };
    ctx.isAdmin = false;
    ctx.isAdminOrSupervisor = true;
    ctx.isEditingLog = false;
    ctx.isLogDetailView = false;
    ctx.showLogModal = false;
    ctx.isLoading = false;
    ctx.selectedEquip = null;
    ctx.oldLogParts = [];
    ctx.logForm = { parts: [], photos: [] };
    ctx._lastHM = null;
    ctx._lastHMLogsRef = null;
    ctx.showNotification = vi.fn();
    ctx.showCropModal = vi.fn();
    delete window.app;
    delete window.appState;
    return Object.assign(ctx, overrides);
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('parsePartsUsed', () => {
    it('string JSON valid di-parse, JSON rusak → []', () => {
        const ctx = makeCtx();
        expect(ctx.parsePartsUsed('[{"id":"P1","qty":2}]')).toEqual([{ id: 'P1', qty: 2 }]);
        expect(ctx.parsePartsUsed('{rusak')).toEqual([]);
    });

    it('array dikembalikan apa adanya; tipe lain → []', () => {
        const ctx = makeCtx();
        const arr = [{ id: 'P1', qty: 1 }];
        expect(ctx.parsePartsUsed(arr)).toBe(arr);
        expect(ctx.parsePartsUsed(null)).toEqual([]);
        expect(ctx.parsePartsUsed(42)).toEqual([]);
        expect(ctx.parsePartsUsed(undefined)).toEqual([]);
    });
});

describe('woAvailability / woShortageSummary', () => {
    const parts = [
        { PartID: 'P1', Stok: 5 },
        { PartID: 'P2', Stok: 1 },
    ];

    it('cukup → ok true, shortage 0', () => {
        const ctx = makeCtx({ allParts: parts });
        const wo = { PartsUsed: JSON.stringify([{ id: 'P1', qty: 3 }]) };
        expect(ctx.woAvailability(wo)).toEqual([{ partId: 'P1', quantity: 3, available: 5, ok: true, shortage: 0 }]);
        expect(ctx.woShortageSummary(wo)).toEqual({ ok: true, total: 0, count: 0 });
    });

    it('kurang → shortage dihitung, summary menjumlahkan', () => {
        const ctx = makeCtx({ allParts: parts });
        const wo = { PartsUsed: [{ id: 'P1', qty: 8 }, { id: 'P2', qty: 4 }] };
        expect(ctx.woShortageSummary(wo)).toEqual({ ok: false, total: 6, count: 2 });
    });

    it('part tak dikenal dianggap stok 0; part tanpa id selalu ok', () => {
        const ctx = makeCtx({ allParts: parts });
        const res = ctx.woAvailability({ PartsUsed: [{ id: 'GHOST', qty: 2 }, { qty: 9 }] });
        expect(res[0]).toMatchObject({ available: 0, ok: false, shortage: 2 });
        expect(res[1]).toMatchObject({ ok: true, available: null });
    });

    it('WO tanpa PartsUsed → daftar kosong', () => {
        const ctx = makeCtx({ allParts: parts });
        expect(ctx.woAvailability(null)).toEqual([]);
        expect(ctx.woShortageSummary({})).toEqual({ ok: true, total: 0, count: 0 });
    });
});

describe('openLogModal — mode buat baru', () => {
    it('nomor WO berikutnya dari log MTC-xxx yang ada', () => {
        const ctx = makeCtx({ logs: [{ woNumber: 'MTC-001' }, { woNumber: 'MTC-007' }, { woNumber: 'MTC-abc' }] });
        ctx.openLogModal();
        expect(ctx.logForm.woNumber).toBe('MTC-008');
        expect(ctx.showLogModal).toBe(true);
        expect(ctx.isEditingLog).toBe(false);
    });

    it('tanpa log MTC → MTC-001; fromDetail mengisi equipment dari selectedEquip', () => {
        const ctx = makeCtx({ logs: [{ woNumber: 'WO-9' }], selectedEquip: { EquipmentID: 'EQ-7' } });
        ctx.openLogModal(false, null, true);
        expect(ctx.logForm.woNumber).toBe('MTC-001');
        expect(ctx.logForm.equipmentId).toBe('EQ-7');
        expect(ctx.isLogDetailView).toBe(true);
    });
});

describe('openLogModal — mode edit', () => {
    const base = {
        LogID: 'L1',
        Jenis: 'Breakdown',
        Deskripsi: 'Bearing aus',
        Downtime: 4,
        Cost: 1000,
        EquipmentID: 'EQ-1',
        Tanggal: '2026-10-18',
        Technician: 'Andi',
        Status: 'Approved',
        HM: 1234,
        Catatan: 'catatan',
        rca: 'Mechanical',
        woPriority: 'Urgent',
        woNumber: 'MTC-004',
    };

    it('memetakan field log → logForm', () => {
        const ctx = makeCtx();
        ctx.openLogModal(true, base);
        expect(ctx.logForm).toMatchObject({
            logId: 'L1',
            type: 'Breakdown',
            desc: 'Bearing aus',
            downtime: 4,
            cost: 1000,
            equipmentId: 'EQ-1',
            tech: 'Andi',
            status: 'Approved',
            hm: 1234,
            woPriority: 'Urgent',
            woNumber: 'MTC-004',
            requestSource: 'Production',
        });
        expect(ctx.isEditingLog).toBe(true);
        expect(ctx.isLogDetailView).toBe(false);
    });

    it('PartsUsed string JSON → array bersih {id, qty}', () => {
        const ctx = makeCtx();
        ctx.openLogModal(true, { ...base, PartsUsed: '[{"id":"P1","qty":2},{"PartID":"P2"}]' });
        expect(ctx.logForm.parts).toEqual([{ id: 'P1', qty: 2 }, { id: 'P2', qty: 1 }]);
        expect(ctx.oldLogParts).toEqual(ctx.logForm.parts);
        expect(ctx.oldLogParts).not.toBe(ctx.logForm.parts); // salinan, bukan referensi
    });

    it('PartsUsed array dan objek hasil RTDB sama-sama diterima', () => {
        const arr = makeCtx();
        arr.openLogModal(true, { ...base, PartsUsed: [{ id: 'P1', qty: 3 }] });
        expect(arr.logForm.parts).toEqual([{ id: 'P1', qty: 3 }]);

        const obj = makeCtx();
        obj.openLogModal(true, { ...base, PartsUsed: { a: { id: 'P9', qty: 5 }, b: { id: 'P8', qty: 1 } } });
        expect(obj.logForm.parts).toEqual([{ id: 'P9', qty: 5 }, { id: 'P8', qty: 1 }]);
    });

    it('PartsUsed rusak → parts kosong, tidak melempar', () => {
        const ctx = makeCtx();
        ctx.openLogModal(true, { ...base, PartsUsed: '{rusak' });
        expect(ctx.logForm.parts).toEqual([]);
    });

    it('foto: JSON string, array, dan PhotoURL tunggal', () => {
        const fromJson = makeCtx();
        fromJson.openLogModal(true, { ...base, PhotoURLs: '["u1","u2"]' });
        expect(fromJson.logForm.photos).toEqual([
            { file: null, preview: 'u1', base64: 'u1' },
            { file: null, preview: 'u2', base64: 'u2' },
        ]);

        const fromArr = makeCtx();
        fromArr.openLogModal(true, { ...base, PhotoURLs: ['u3'] });
        expect(fromArr.logForm.photos).toEqual([{ file: null, preview: 'u3', base64: 'u3' }]);

        const fromSingle = makeCtx();
        fromSingle.openLogModal(true, { ...base, PhotoURL: 'u4' });
        expect(fromSingle.logForm.photos).toEqual([{ file: null, preview: 'u4', base64: 'u4' }]);
    });

    it('PhotoURLs bukan JSON → dipakai sebagai satu URL apa adanya', () => {
        const ctx = makeCtx();
        ctx.openLogModal(true, { ...base, PhotoURLs: 'bukan-json' });
        expect(ctx.logForm.photos).toEqual([{ file: null, preview: 'bukan-json', base64: 'bukan-json' }]);
    });
});

describe('handleLogPhoto', () => {
    const file = (name) => ({ name });

    beforeEach(() => {
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn((f) => `blob:${f?.name ?? 'cropped'}`) });
    });

    it('lebih dari 4 foto ditolak', () => {
        const ctx = makeCtx({ logForm: { photos: [1, 2, 3], parts: [] } });
        ctx.handleLogPhoto({ target: { files: [file('a'), file('b')] } });
        expect(ctx.showNotification).toHaveBeenCalledWith('Maximum 4 photos allowed.', 'error');
        expect(ctx.logForm.photos).toHaveLength(3);
    });

    it('file pertama membuka crop modal, sisanya langsung masuk', () => {
        const ctx = makeCtx({ logForm: { photos: [], parts: [] } });
        ctx.handleLogPhoto({ target: { files: [file('a'), file('b'), file('c')] } });
        expect(ctx.showCropModal).toHaveBeenCalledTimes(1);
        expect(ctx.logForm.photos.map((p) => p.file.name)).toEqual(['b', 'c']);
    });

    it('callback crop menambah foto hasil crop dan berhenti di 4', () => {
        const ctx = makeCtx({ logForm: { photos: [], parts: [] } });
        ctx.handleLogPhoto({ target: { files: [file('a')] } });
        const cb = ctx.showCropModal.mock.calls[0][1];

        cb({ name: 'cropped' });
        expect(ctx.logForm.photos).toHaveLength(1);
        expect(ctx.logForm.photos[0]).toMatchObject({ preview: 'blob:cropped', base64: null });

        ctx.logForm.photos = [1, 2, 3, 4];
        cb({ name: 'cropped2' });
        expect(ctx.logForm.photos).toHaveLength(4);
    });

    it('photos bukan array → direset dulu', () => {
        const ctx = makeCtx({ logForm: { photos: 'rusak', parts: [] } });
        ctx.handleLogPhoto({ target: { files: [file('a'), file('b')] } });
        expect(Array.isArray(ctx.logForm.photos)).toBe(true);
        expect(ctx.logForm.photos).toHaveLength(1);
    });
});

describe('removeLogPhoto / addPartToLog / removePartFromLog', () => {
    it('menghapus foto & part berdasarkan index', () => {
        const ctx = makeCtx({ logForm: { photos: ['a', 'b'], parts: [{ id: 'P1' }, { id: 'P2' }] } });
        ctx.removeLogPhoto(0);
        expect(ctx.logForm.photos).toEqual(['b']);
        ctx.removePartFromLog(1);
        expect(ctx.logForm.parts).toEqual([{ id: 'P1' }]);
    });

    it('addPartToLog menambah baris kosong qty 1', () => {
        const ctx = makeCtx({ logForm: { photos: [], parts: [] } });
        ctx.addPartToLog();
        expect(ctx.logForm.parts).toEqual([{ id: '', qty: 1 }]);
    });

    it('field bukan array → direset ke [] tanpa melempar', () => {
        const ctx = makeCtx({ logForm: { photos: 'x', parts: 'y' } });
        ctx.removeLogPhoto(0);
        ctx.removePartFromLog(0);
        expect(ctx.logForm.photos).toEqual([]);
        expect(ctx.logForm.parts).toEqual([]);
    });
});

describe('getLastHM', () => {
    it('tanpa equipId / tanpa log HM → "-"', () => {
        const ctx = makeCtx();
        expect(ctx.getLastHM('')).toBe('-');
        expect(ctx.getLastHM('EQ-1')).toBe('-');
    });

    it('mengambil HM terbaru berdasarkan Tanggal dan memformat ribuan', () => {
        const ctx = makeCtx({
            logs: [
                { EquipmentID: 'EQ-1', HM: 1000, Tanggal: '2026-01-01' },
                { EquipmentID: 'EQ-1', HM: 2500, Tanggal: '2026-03-01' },
                { EquipmentID: 'EQ-1', HM: 1500, Tanggal: '2026-02-01' },
                { EquipmentID: 'EQ-2', HM: 9999, Tanggal: '2026-05-01' },
            ],
        });
        expect(ctx.getLastHM('EQ-1')).toBe((2500).toLocaleString());
    });

    it('cache dipakai ulang selama referensi this.logs sama', () => {
        const ctx = makeCtx({ logs: [{ EquipmentID: 'EQ-1', HM: 10, Tanggal: '2026-01-01' }] });
        expect(ctx.getLastHM('EQ-1')).toBe('10');
        ctx.logs.push({ EquipmentID: 'EQ-1', HM: 20, Tanggal: '2026-02-01' }); // mutasi, referensi sama
        expect(ctx.getLastHM('EQ-1')).toBe('10');
        ctx.logs = [...ctx.logs]; // referensi baru → cache dibuang
        expect(ctx.getLastHM('EQ-1')).toBe('20');
    });
});

describe('syncPerformanceBD', () => {
    it('tanpa equipId / tanpa db → tidak menulis', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx();
        await ctx.syncPerformanceBD('', '2026-10-18');
        vi.stubGlobal('db', undefined);
        await ctx.syncPerformanceBD('EQ-1', '2026-10-18');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('tanpa record Performance untuk tanggal itu → dibiarkan (entri manual tidak ditimpa)', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ performanceData: [{ EquipmentID: 'EQ-1', date: '2026-10-17' }] });
        await ctx.syncPerformanceBD('EQ-1', '2026-10-18');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('menulis bd dari log Breakdown + freq, lalu memperbarui objek lokal', async () => {
        const fb = stubFirebase();
        const perf = { Id: 'PERF1', EquipmentID: 'EQ-1', date: '2026-10-18' };
        const ctx = makeCtx({
            performanceData: [perf],
            logs: [
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-10-18', Downtime: 2.5 },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-10-18', Downtime: 1 },
                { EquipmentID: 'EQ-1', Jenis: 'PM', Tanggal: '2026-10-18', Downtime: 99 },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-10-17', Downtime: 7 },
            ],
        });

        await ctx.syncPerformanceBD('EQ-1', '2026-10-18');

        expect(fb.ref).toHaveBeenCalledWith(fb.db, 'Performance/PERF1');
        const [, updates] = fb.update.mock.calls[0];
        expect(updates).toMatchObject({ bd: 3.5, freq: 2, bdSource: 'wo' });
        expect(perf.bd).toBe(3.5);
    });

    it('kegagalan tulis hanya di-warn', async () => {
        stubFirebase({ update: vi.fn(async () => { throw new Error('offline'); }) });
        const ctx = makeCtx({ performanceData: [{ id: 'P', EquipmentID: 'EQ-1', date: '2026-10-18' }] });
        await expect(ctx.syncPerformanceBD('EQ-1', '2026-10-18')).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalled();
    });
});

describe('approveWO', () => {
    const log = { LogID: 'L1', woNumber: 'MTC-002', PartsUsed: '[{"id":"P1","qty":2}]' };

    it('WO tidak ditemukan / bukan supervisor → tidak menulis', async () => {
        const fb = stubFirebase();
        await makeCtx().approveWO('GHOST');
        expect(makeCtx().showNotification).toBeTruthy();

        const notSup = makeCtx({ logs: [log], isAdminOrSupervisor: false });
        await notSup.approveWO('L1');
        expect(notSup.showNotification).toHaveBeenCalledWith('Only supervisor can approve Work Order', 'error');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('stok kurang + dibatalkan → tidak ada approve', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => false));
        const ctx = makeCtx({ logs: [log], allParts: [{ PartID: 'P1', Stok: 0 }] });

        await ctx.approveWO('L1');

        expect(confirm).toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('Approve dibatalkan — stok kurang', 'info');
        expect(fb.update).not.toHaveBeenCalled();
        expect(fb.runTransaction).not.toHaveBeenCalled();
    });

    it('stok kurang + tetap approve → tetap memotong stok & meng-update status', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => true));
        const ctx = makeCtx({ logs: [log], allParts: [{ PartID: 'P1', Stok: 1 }] });

        await ctx.approveWO('L1');

        expect(fb.runTransaction).toHaveBeenCalledTimes(1);
        expect(fb.runTransaction.mock.calls[0][0]).toEqual({ path: 'SpareParts/P1/Stok' });
        expect(fb.update).toHaveBeenCalledTimes(1);
        const [, updates] = fb.update.mock.calls[0];
        expect(updates).toMatchObject({ Status: 'Approved', approvedBy: 'supervisor@x.id', rejectedBy: '' });
        expect(ctx.logs[0].Status).toBe('Approved');
        expect(ctx.notifications[0]).toMatchObject({ type: 'Work Order', icon: 'check_circle' });
    });

    it('memotong stok tiap part, melewati part tanpa id', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({
            logs: [{ ...log, PartsUsed: [{ id: 'P1', qty: 2 }, { qty: 5 }, { id: 'P2', qty: 1 }] }],
            allParts: [{ PartID: 'P1', Stok: 10 }, { PartID: 'P2', Stok: 10 }],
        });
        await ctx.approveWO('L1');
        expect(fb.runTransaction).toHaveBeenCalledTimes(2);
        expect(fb.runTransaction.mock.calls.map((c) => c[0].path)).toEqual(['SpareParts/P1/Stok', 'SpareParts/P2/Stok']);
    });

    it('sinkron ke window.app bila ada, dan error ditangkap', async () => {
        const fb = stubFirebase({ update: vi.fn(async () => { throw new Error('denied'); }) });
        window.app = { logs: [{ LogID: 'L1' }], notifications: [] };
        const ctx = makeCtx({ logs: [log], allParts: [{ PartID: 'P1', Stok: 99 }] });

        await ctx.approveWO('L1');

        expect(ctx.showNotification).toHaveBeenCalledWith('Error: denied', 'error');
        expect(fb.update).toHaveBeenCalled();
    });

    it('sukses juga memperbarui salinan log di window.app', async () => {
        stubFirebase();
        const ctx = makeCtx({ logs: [{ ...log, Status: 'Pending' }], allParts: [{ PartID: 'P1', Stok: 9 }] });
        window.app = { logs: [{ LogID: 'L1', Status: 'Pending' }], notifications: [] };

        await ctx.approveWO('L1');

        expect(window.app.logs[0].Status).toBe('Approved');
        expect(window.app.notifications).toHaveLength(1);
    });

    it('transaksi stok tidak pernah negatif, abort saat null, dan kegagalan part tidak memblokir update WO', async () => {
        let capturedCallback = null;
        const fb = stubFirebase({
            runTransaction: vi.fn(async (_ref, cb) => {
                capturedCallback = cb;
                throw new Error('permission_denied on part');
            }),
        });
        const longDesc = 'D'.repeat(600);
        const legacyLog = {
            ...log,
            Downtime: '1.5',
            Cost: '500',
            HM: 1234,
            Deskripsi: longDesc,
            PartsUsed: [{ id: 'P_DEFICIT', qty: 5 }],
        };
        const ctx = makeCtx({ logs: [legacyLog], allParts: [{ PartID: 'P_DEFICIT', Stok: 0 }] });
        vi.stubGlobal('confirm', vi.fn(() => true));

        await ctx.approveWO('L1');

        // Pastikan callback transaksi stok aman:
        expect(capturedCallback).toBeTypeOf('function');
        // Saat stok di DB 1 dan qty 5 -> tidak pernah negatif (-4), diklem ke 0
        expect(capturedCallback(1)).toBe(0);
        // Saat part belum ada di DB (null) -> return undefined (abort transaction)
        expect(capturedCallback(null)).toBeUndefined();
        expect(capturedCallback(undefined)).toBeUndefined();

        // Walau transaksi part melempar error, WO tetap berhasil di-update ke Approved
        expect(fb.update).toHaveBeenCalledTimes(1);
        const [, updates] = fb.update.mock.calls[0];
        expect(updates.Status).toBe('Approved');
        expect(updates.Downtime).toBe(1.5);
        expect(updates.Cost).toBe(500);
        expect(updates.HM).toBe('1234');
        expect(updates.Deskripsi).toHaveLength(500);
        expect(ctx.logs[0].Status).toBe('Approved');
        expect(ctx.showNotification).toHaveBeenCalledWith('Work Order Approved!');
    });
});

describe('rejectWO', () => {
    const log = { LogID: 'L1', woNumber: 'MTC-002' };

    it('guard: tidak ada WO / bukan supervisor / alasan kosong', async () => {
        const fb = stubFirebase();
        const missing = makeCtx();
        await missing.rejectWO('GHOST');

        const notSup = makeCtx({ logs: [log], isAdminOrSupervisor: false });
        await notSup.rejectWO('L1', 'rusak');

        const noReason = makeCtx({ logs: [log] });
        await noReason.rejectWO('L1', '   ');

        expect(noReason.showNotification).toHaveBeenCalledWith('Rejection reason is required', 'error');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('sukses: status Rejected + alasan + notifikasi block', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ logs: [log] });
        window.app = { logs: [{ LogID: 'L1' }] };

        await ctx.rejectWO('L1', 'Spare part tidak tersedia');

        const [, updates] = fb.update.mock.calls[0];
        expect(updates).toMatchObject({
            Status: 'Rejected',
            rejectionReason: 'Spare part tidak tersedia',
            approvedBy: '',
            approvalDate: '',
        });
        expect(ctx.notifications[0]).toMatchObject({ icon: 'block' });
        expect(ctx.showNotification).toHaveBeenCalledWith('Work Order Rejected');
    });

    it('error tulis ditangkap', async () => {
        stubFirebase({ update: vi.fn(async () => { throw new Error('offline'); }) });
        const ctx = makeCtx({ logs: [log] });
        await ctx.rejectWO('L1', 'alasan');
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: offline', 'error');
    });
});

describe('startWO', () => {
    const log = { LogID: 'L1', woNumber: 'MTC-002', Status: 'Approved' };

    it('WO tidak ditemukan → notifikasi, tanpa tulis', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx();
        await ctx.startWO('GHOST');
        expect(ctx.showNotification).toHaveBeenCalledWith('Work Order not found', 'error');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('sukses: Status In Progress + notifikasi play_arrow + sinkron global', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ logs: [{ ...log }] });
        window.app = { logs: [{ LogID: 'L1', Status: 'Approved' }], notifications: [] };

        await ctx.startWO('L1');

        expect(fb.update.mock.calls[0][1]).toEqual({ Status: 'In Progress' });
        expect(ctx.logs[0].Status).toBe('In Progress');
        expect(window.app.logs[0].Status).toBe('In Progress');
        expect(ctx.notifications[0]).toMatchObject({ icon: 'play_arrow' });
        expect(ctx.showNotification).toHaveBeenCalledWith('Work Order Started');
    });

    it('error tulis ditangkap', async () => {
        stubFirebase({ update: vi.fn(async () => { throw new Error('denied'); }) });
        const ctx = makeCtx({ logs: [{ ...log }] });
        await ctx.startWO('L1');
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: denied', 'error');
    });
});

describe('completeWO — kalkulator biaya downtime', () => {
    const log = { LogID: 'L1', EquipmentID: 'EQ-1', Downtime: 5, Cost: 100, estimatedHours: 3 };

    it('WO tidak ditemukan → notifikasi, tanpa tulis', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx();
        await ctx.completeWO('GHOST');
        expect(ctx.showNotification).toHaveBeenCalledWith('Work Order not found', 'error');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('downtime × DowntimeCostPerHour menggantikan Cost lama', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({
            logs: [{ ...log }],
            equipment: [{ EquipmentID: 'EQ-1', DowntimeCostPerHour: 250000 }],
        });

        await ctx.completeWO('L1');

        const [, updates] = fb.update.mock.calls[0];
        expect(updates).toMatchObject({ Status: 'Completed', Cost: 1250000, actualHours: 3 });
        expect(ctx.logs[0].Cost).toBe(1250000);
        expect(ctx.showNotification).toHaveBeenCalledWith('Work Order Completed — Cost: $1250000');
    });

    it('tarif tidak ada / 0 → Cost lama dipertahankan', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ logs: [{ ...log }], equipment: [{ EquipmentID: 'EQ-1' }] });
        await ctx.completeWO('L1');
        expect(fb.update.mock.calls[0][1].Cost).toBe(100);
    });

    it('tanpa downtime → Cost lama; actualHours jatuh ke actualHours sebelumnya', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ logs: [{ LogID: 'L1', Cost: 50, actualHours: 7 }] });
        await ctx.completeWO('L1');
        expect(fb.update.mock.calls[0][1]).toMatchObject({ Cost: 50, actualHours: 7 });
    });

    it('error tulis ditangkap', async () => {
        stubFirebase({ update: vi.fn(async () => { throw new Error('offline'); }) });
        const ctx = makeCtx({ logs: [{ ...log }] });
        await ctx.completeWO('L1');
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: offline', 'error');
    });
});

describe('submitLog — guard sebelum menulis', () => {
    it('form tidak valid: error pertama dari validateLogForm dipakai', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ logForm: { equipmentId: '', date: '', desc: '', parts: [], photos: [] } });
        await ctx.submitLog();
        expect(ctx.showNotification).toHaveBeenCalledWith('Equipment selection is required', 'error');
        expect(ctx.isLoading).toBe(false);
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('buat log baru butuh admin/supervisor', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({
            isEditingLog: false,
            isAdminOrSupervisor: false,
            logForm: { equipmentId: 'EQ-1', date: '2026-10-18', desc: 'ok', downtime: 0, cost: 0, parts: [], photos: [] },
        });
        await ctx.submitLog();
        expect(ctx.showNotification).toHaveBeenCalledWith('Admin access required to create logs', 'error');
        expect(fb.update).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════════════════
// C-2 (S28): badan `submitLog` — logs.js 305–517
//
// Yang dijaga di sini bukan "modal tertutup", tapi **apa yang benar-benar
// ditulis**: payload yang sudah disanitasi (kecuali dua field JSON yang
// sengaja dikembalikan mentah), diff downtime yang masuk transaksi Stats,
// pemotongan stok yang hanya terjadi sekali per part ber-id, jalur offline
// yang tidak menyentuh RTDB, dan refresh 500 ms setelah tulis.
// ══════════════════════════════════════════════════════════════════════════

function baseForm(overrides = {}) {
    return {
        equipmentId: 'EQ-1',
        date: '2026-10-01',
        type: 'Corrective',
        desc: 'ganti bearing',
        tech: 'Andi',
        downtime: 0,
        cost: 0,
        status: 'Completed',
        hm: '',
        catatan: '',
        rca: '',
        parts: [],
        photos: [],
        ...overrides,
    };
}

function submitCtx(overrides = {}) {
    const ctx = makeCtx({ logForm: baseForm(), ...overrides });
    ctx.isOnline = overrides.isOnline ?? true;
    ctx.queueOfflineOperation = vi.fn(async () => true);
    ctx.saveToIndexedDB = vi.fn(async () => {});
    ctx.syncPerformanceBD = vi.fn(async () => {});
    return ctx;
}

/** Jalankan submitLog sambil memutar timer (retry 1 s/2 s + refresh 500 ms). */
async function runSubmit(ctx) {
    const p = ctx.submitLog();
    let settled = false;
    p.then(() => { settled = true; }, () => { settled = true; });
    for (let i = 0; i < 25 && !settled; i++) await vi.advanceTimersByTimeAsync(500);
    return p;
}

const writtenPayload = (fb) => fb.set.mock.calls[0][1];
const refPaths = (fb) => fb.runTransaction.mock.calls.map(([r]) => r.path);

describe('submitLog — jalur online: payload, Equipment, Stats', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('menulis HistoryLog/LOG-*, menutup modal, dan menaruh log di daftar lokal', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ user: { uid: 'U1' } });
        await runSubmit(ctx);

        expect(fb.set).toHaveBeenCalledTimes(1);
        expect(fb.set.mock.calls[0][0].path).toMatch(/^HistoryLog\/LOG-\d+$/);
        const payload = writtenPayload(fb);
        expect(payload).toMatchObject({
            EquipmentID: 'EQ-1',
            Tanggal: '2026-10-01',
            Jenis: 'Corrective',
            Deskripsi: 'ganti bearing',
            Technician: 'Andi',
            Downtime: 0,
            Cost: 0,
            PartsUsed: '[]',
            PhotoURLs: '[]',
            createdBy: 'U1',
            updatedBy: 'U1',
        });
        expect(typeof payload.createdAt).toBe('string');
        expect(ctx.showNotification).toHaveBeenCalledWith('Log entry successfully saved!');
        expect(ctx.showLogModal).toBe(false);
        expect(ctx.isLoading).toBe(false);
        expect(ctx.logs[0].LogID).toBe(payload.LogID);
    });

    it('downtime > 0 → transaksi Stats/totalDowntime dengan selisihnya', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ downtime: 5 }) });
        await runSubmit(ctx);

        const call = fb.runTransaction.mock.calls.find(([r]) => r.path === 'Stats/totalDowntime');
        expect(call).toBeTruthy();
        expect(call[1](3)).toBe(8);
        expect(call[1](undefined)).toBe(5);   // `curr || 0`
        expect(call[1](-10)).toBe(0);         // Math.max(0, …)
    });

    it('downtime 0 → tidak ada transaksi Stats', async () => {
        const fb = stubFirebase();
        await runSubmit(submitCtx());
        expect(refPaths(fb)).not.toContain('Stats/totalDowntime');
    });

    it('Status Completed → Equipment Active, HM ikut jadi LastHM', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ status: 'Completed', hm: '1234.5' }) });
        await runSubmit(ctx);
        expect(fb.update).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'Equipment/EQ-1' }),
            { Status: 'Active', LastHM: '1234.5' },
        );
    });

    it('Status lain → In Maintenance', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ status: 'In Progress' }) });
        await runSubmit(ctx);
        expect(fb.update).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'Equipment/EQ-1' }),
            { Status: 'In Maintenance' },
        );
    });

    it('equipment EXTERNAL → Equipment tidak disentuh', async () => {
        const fb = stubFirebase();
        await runSubmit(submitCtx({ logForm: baseForm({ equipmentId: 'EXTERNAL' }) }));
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('potong stok sekali per part ber-id, entri tanpa id dilewati', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            logForm: baseForm({ parts: [{ id: 'P1', qty: 2 }, { id: '', qty: 1 }, { id: 'P2', qty: 3 }] }),
        });
        await runSubmit(ctx);

        expect(refPaths(fb)).toEqual(['SpareParts/P1/Stok', 'SpareParts/P2/Stok']);
        expect(fb.runTransaction.mock.calls[0][1](10)).toBe(8);
        expect(fb.runTransaction.mock.calls[1][1](undefined)).toBe(-3);
    });

    it('woNumber ada → stok tidak dipotong (dipotong saat approve)', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            logForm: baseForm({ woNumber: 'WO-7', parts: [{ id: 'P1', qty: 2 }] }),
        });
        await runSubmit(ctx);
        expect(refPaths(fb).filter((p) => p.startsWith('SpareParts/'))).toEqual([]);
    });

    it('edit log → stok tidak dipotong', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            isEditingLog: true,
            logs: [{ LogID: 'LOG-9', Downtime: 0 }],
            logForm: baseForm({ logId: 'LOG-9', parts: [{ id: 'P1', qty: 2 }] }),
        });
        await runSubmit(ctx);
        expect(refPaths(fb).filter((p) => p.startsWith('SpareParts/'))).toEqual([]);
    });

    it('satu transaksi stok gagal → part berikutnya tetap diproses', async () => {
        const fb = stubFirebase({
            runTransaction: vi.fn(async (ref, fn) => {
                if (ref.path === 'SpareParts/P1/Stok') throw new Error('stok beku');
                return fn(10);
            }),
        });
        const ctx = submitCtx({
            logForm: baseForm({ parts: [{ id: 'P1', qty: 1 }, { id: 'P2', qty: 1 }] }),
        });
        await runSubmit(ctx);

        expect(refPaths(fb)).toEqual(['SpareParts/P1/Stok', 'SpareParts/P2/Stok']);
        expect(console.error).toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('Log entry successfully saved!');
    });

    it('Breakdown → syncPerformanceBD(equip, tanggal)', async () => {
        stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ type: 'Breakdown' }) });
        await runSubmit(ctx);
        expect(ctx.syncPerformanceBD).toHaveBeenCalledWith('EQ-1', '2026-10-01');
    });

    it('bukan Breakdown → syncPerformanceBD dilewati', async () => {
        stubFirebase();
        const ctx = submitCtx();
        await runSubmit(ctx);
        expect(ctx.syncPerformanceBD).not.toHaveBeenCalled();
    });
});

describe('submitLog — sanitasi & metadata audit data', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('Deskripsi di-escape, PartsUsed & PhotoURLs dikembalikan mentah', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            logForm: baseForm({
                desc: '<script>alert(1)</script>',
                parts: [{ id: 'P1', qty: 2 }],
                photos: [{ preview: 'https://cdn/a.jpg' }],
            }),
        });
        await runSubmit(ctx);

        const payload = writtenPayload(fb);
        // sanitizeInput: escape `< > " ' /`, buang kata "script" & `on…=`
        expect(payload.Deskripsi).not.toContain('<');
        expect(payload.Deskripsi).not.toMatch(/script/i);
        expect(payload.Deskripsi).toContain('&lt;&gt;alert(1)&lt;');
        expect(payload.PartsUsed).toBe('[{"id":"P1","qty":2}]');
        expect(payload.PhotoURLs).toBe('["https://cdn/a.jpg"]');
    });

    it('buat baru tanpa user → createdBy/updatedBy "unknown"', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ user: null });
        await runSubmit(ctx);
        const payload = writtenPayload(fb);
        expect(payload.createdBy).toBe('unknown');
        expect(payload.updatedBy).toBe('unknown');
    });

    it('edit: createdBy/createdAt lama dipertahankan, diff downtime dikurangi downtime lama', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            isEditingLog: true,
            logs: [{ LogID: 'LOG-9', Downtime: 4, createdBy: 'U9', createdAt: '2020-01-01T00:00:00.000Z' }],
            logForm: baseForm({ logId: 'LOG-9', downtime: 6 }),
        });
        await runSubmit(ctx);

        const payload = writtenPayload(fb);
        expect(payload.createdBy).toBe('U9');
        expect(payload.createdAt).toBe('2020-01-01T00:00:00.000Z');
        const call = fb.runTransaction.mock.calls.find(([r]) => r.path === 'Stats/totalDowntime');
        expect(call[1](0)).toBe(2);
        expect(payload.updatedBy).toBe('unknown');
    });

    it('edit tanpa log lama → createdBy tidak diisi', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            isEditingLog: true,
            logs: [],
            logForm: baseForm({ logId: 'LOG-X', downtime: 3 }),
        });
        await runSubmit(ctx);

        const payload = writtenPayload(fb);
        expect('createdBy' in payload).toBe(false);
        const call = fb.runTransaction.mock.calls.find(([r]) => r.path === 'Stats/totalDowntime');
        expect(call[1](0)).toBe(3);
    });

    it('field opsional kosong memakai nilai default', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            logForm: baseForm({ woNumber: '', woPriority: '', estimatedHours: 'x', actualHours: null }),
        });
        await runSubmit(ctx);

        const payload = writtenPayload(fb);
        expect(payload.woPriority).toBe('Normal');
        expect(payload.requestSource).toBe('Production');
        expect(payload.estimatedHours).toBe(0);
        expect(payload.actualHours).toBe(0);
        expect(payload.externalEquipName).toBe('');
    });

    it('parts bukan array → PartsUsed "[]"', async () => {
        const fb = stubFirebase();
        await runSubmit(submitCtx({ logForm: baseForm({ parts: 'rusak' }) }));
        expect(writtenPayload(fb).PartsUsed).toBe('[]');
    });

    it('qty bukan angka → 1; Alpine.raw melempar → pakai objek apa adanya', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('Alpine', { raw: vi.fn(() => { throw new Error('proxy'); }) });
        const ctx = submitCtx({
            logForm: baseForm({ parts: [{ id: 'P1', qty: 'abc' }, { id: 'P2', qty: '4' }] }),
        });
        await runSubmit(ctx);

        expect(writtenPayload(fb).PartsUsed).toBe('[{"id":"P1","qty":1},{"id":"P2","qty":4}]');
    });
});

describe('submitLog — foto', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('URL remote dipertahankan tanpa upload', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ photos: [{ preview: 'https://cdn/a.jpg' }] }) });
        ctx.uploadImage = vi.fn(async () => 'https://cdn/baru.jpg');
        await runSubmit(ctx);

        expect(ctx.uploadImage).not.toHaveBeenCalled();
        expect(writtenPayload(fb).PhotoURLs).toBe('["https://cdn/a.jpg"]');
        expect(ctx.showNotification).toHaveBeenCalledWith('Uploading photos...', 'info');
    });

    it('blob + file → uploadImage dipanggil, URL hasilnya disimpan', async () => {
        const fb = stubFirebase();
        const file = { name: 'a.jpg' };
        const ctx = submitCtx({ logForm: baseForm({ photos: [{ preview: 'blob:x', file }] }) });
        ctx.uploadImage = vi.fn(async () => 'https://cdn/hasil.jpg');
        await runSubmit(ctx);

        expect(ctx.uploadImage).toHaveBeenCalledWith(file);
        expect(writtenPayload(fb).PhotoURLs).toBe('["https://cdn/hasil.jpg"]');
    });

    it('base64 legacy tanpa file → disimpan apa adanya', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            logForm: baseForm({ photos: [{ base64: 'data:image/png;base64,AAA' }] }),
        });
        ctx.uploadImage = vi.fn(async () => 'https://cdn/x.jpg');
        await runSubmit(ctx);

        expect(ctx.uploadImage).not.toHaveBeenCalled();
        expect(writtenPayload(fb).PhotoURLs).toBe('["data:image/png;base64,AAA"]');
    });

    it('upload melempar → foto dibuang + peringatan, log tetap tersimpan', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ photos: [{ preview: 'blob:x', file: { name: 'a' } }] }) });
        ctx.uploadImage = vi.fn(async () => { throw new Error('cloudinary down'); });
        await runSubmit(ctx);

        expect(writtenPayload(fb).PhotoURLs).toBe('[]');
        expect(ctx.showNotification).toHaveBeenCalledWith('Sebagian foto gagal diupload — coba lagi', 'warning');
        expect(console.warn).toHaveBeenCalledWith('[SubmitLog] photo upload failed:', 'cloudinary down');
        expect(ctx.showNotification).toHaveBeenCalledWith('Log entry successfully saved!');
    });

    it('upload mengembalikan string kosong → foto baru dibuang', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({
            logForm: baseForm({ photos: [{ base64: 'data:image/png;base64,AAA', file: { name: 'a' } }] }),
        });
        ctx.uploadImage = vi.fn(async () => '');
        await runSubmit(ctx);

        expect(writtenPayload(fb).PhotoURLs).toBe('[]');
        expect(ctx.showNotification).toHaveBeenCalledWith('Sebagian foto gagal diupload — coba lagi', 'warning');
    });

    it('uploadImage bukan fungsi → foto baru dibuang', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ photos: [{ base64: 'data:image/png;base64,AAA', file: {} }] }) });
        delete ctx.uploadImage;
        await runSubmit(ctx);

        expect(writtenPayload(fb).PhotoURLs).toBe('[]');
    });

    it('entri null dilewati tanpa melempar', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ photos: [null, { preview: 'https://cdn/b.jpg' }] }) });
        await runSubmit(ctx);
        expect(writtenPayload(fb).PhotoURLs).toBe('["https://cdn/b.jpg"]');
    });

    it('photos berupa objek Alpine → di-unwrap lewat Alpine.raw', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('Alpine', { raw: vi.fn((o) => o.list) });
        const ctx = submitCtx({ logForm: baseForm({ photos: { list: [{ preview: 'https://cdn/c.jpg' }] } }) });
        await runSubmit(ctx);

        expect(writtenPayload(fb).PhotoURLs).toBe('["https://cdn/c.jpg"]');
    });

    it('photos objek tapi Alpine.raw tidak tersedia → daftar kosong', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ logForm: baseForm({ photos: { list: [{ preview: 'https://cdn/c.jpg' }] } }) });
        await runSubmit(ctx);

        expect(writtenPayload(fb).PhotoURLs).toBe('[]');
        expect(ctx.showNotification).not.toHaveBeenCalledWith('Uploading photos...', 'info');
    });
});

describe('submitLog — jalur offline (queue + IndexedDB)', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('queue berhasil → RTDB tidak disentuh, log masuk daftar lokal', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ isOnline: false });
        await runSubmit(ctx);

        expect(fb.set).not.toHaveBeenCalled();
        expect(fb.update).not.toHaveBeenCalled();
        expect(ctx.queueOfflineOperation).toHaveBeenCalledWith('logs', expect.objectContaining({ EquipmentID: 'EQ-1' }));
        expect(ctx.saveToIndexedDB).toHaveBeenCalledTimes(1);
        expect(ctx.logs).toHaveLength(1);
        expect(ctx.showNotification).toHaveBeenCalledWith('Log saved offline, will sync when online');
        expect(ctx.showLogModal).toBe(false);
        expect(ctx.isLoading).toBe(false);
    });

    it('queue berhasil saat edit → baris lama diganti di tempat', async () => {
        const ctx = submitCtx({
            isOnline: false,
            isEditingLog: true,
            logs: [{ LogID: 'LOG-9', Deskripsi: 'lama' }, { LogID: 'LOG-8' }],
            logForm: baseForm({ logId: 'LOG-9', desc: 'baru' }),
        });
        await runSubmit(ctx);

        expect(ctx.logs).toHaveLength(2);
        expect(ctx.logs[0].LogID).toBe('LOG-9');
        expect(ctx.logs[0].Deskripsi).toBe('baru');
    });

    it('queue gagal → jatuh ke jalur online', async () => {
        const fb = stubFirebase();
        const ctx = submitCtx({ isOnline: false });
        ctx.queueOfflineOperation = vi.fn(async () => false);
        await runSubmit(ctx);

        expect(fb.set).toHaveBeenCalledTimes(1);
        expect(ctx.saveToIndexedDB).not.toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('Log entry successfully saved!');
    });

    it('saveToIndexedDB melempar → error ditangkap, isLoading kembali false', async () => {
        const ctx = submitCtx({ isOnline: false });
        ctx.saveToIndexedDB = vi.fn(async () => { throw new Error('idb penuh'); });
        await runSubmit(ctx);

        expect(ctx.showNotification).toHaveBeenCalledWith('Error: idb penuh', 'error');
        expect(ctx.isLoading).toBe(false);
    });
});

describe('submitLog — retry, audit trail, refresh 500 ms', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('gagal sekali karena jaringan → notifikasi retrying lalu sukses', async () => {
        const fb = stubFirebase({
            set: vi.fn()
                .mockRejectedValueOnce(new Error('network timeout'))
                .mockResolvedValueOnce(undefined),
        });
        const ctx = submitCtx();
        await runSubmit(ctx);

        expect(fb.set).toHaveBeenCalledTimes(2);
        expect(ctx.showNotification).toHaveBeenCalledWith('Network error, retrying...', 'info');
        expect(ctx.showNotification).toHaveBeenCalledWith('Log entry successfully saved!');
    });

    it('gagal sekali karena error non-jaringan → tanpa notifikasi retrying', async () => {
        const fb = stubFirebase({
            set: vi.fn()
                .mockRejectedValueOnce(new Error('permission denied'))
                .mockResolvedValueOnce(undefined),
        });
        const ctx = submitCtx();
        await runSubmit(ctx);

        expect(fb.set).toHaveBeenCalledTimes(2);
        expect(ctx.showNotification).not.toHaveBeenCalledWith('Network error, retrying...', 'info');
    });

    it('tiga percobaan gagal → notifikasi Error, modal tetap terbuka', async () => {
        const fb = stubFirebase({ set: vi.fn(async () => { throw new Error('boom'); }) });
        const ctx = submitCtx({ showLogModal: true });
        await runSubmit(ctx);

        expect(fb.set).toHaveBeenCalledTimes(3);
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: boom', 'error');
        expect(ctx.showLogModal).toBe(true);
        expect(ctx.isLoading).toBe(false);
    });

    it('audit "Create Log/WO" dipanggil dengan id/equip/jenis', async () => {
        stubFirebase();
        const logAudit = vi.fn();
        vi.stubGlobal('auditModule', { logAudit });
        const ctx = submitCtx();
        await runSubmit(ctx);

        expect(logAudit).toHaveBeenCalledWith('Create Log/WO', {
            id: expect.stringMatching(/^LOG-\d+$/),
            equip: 'EQ-1',
            jenis: 'Corrective',
        });
    });

    it('audit "Update Log/WO" saat edit', async () => {
        stubFirebase();
        const logAudit = vi.fn();
        vi.stubGlobal('auditModule', { logAudit });
        const ctx = submitCtx({
            isEditingLog: true,
            logs: [{ LogID: 'LOG-9' }],
            logForm: baseForm({ logId: 'LOG-9' }),
        });
        await runSubmit(ctx);

        expect(logAudit.mock.calls[0][0]).toBe('Update Log/WO');
    });

    it('audit melempar → diabaikan, log tetap tersimpan', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('auditModule', { logAudit: vi.fn(() => { throw new Error('audit mati'); }) });
        const ctx = submitCtx();
        await runSubmit(ctx);

        expect(fb.set).toHaveBeenCalledTimes(1);
        expect(ctx.showNotification).toHaveBeenCalledWith('Log entry successfully saved!');
    });

    it('auditModule tidak ada → tidak melempar', async () => {
        stubFirebase();
        const ctx = submitCtx();
        await runSubmit(ctx);
        expect(ctx.showNotification).toHaveBeenCalledWith('Log entry successfully saved!');
    });

    it('refresh 500 ms mengganti daftar log dengan hasil RTDB terurut menurun', async () => {
        const fb = stubFirebase({
            get: vi.fn(async () => ({
                val: () => ({
                    'LOG-1': { EquipmentID: 'EQ-1' },
                    'LOG-2': { EquipmentID: 'EQ-1' },
                }),
            })),
        });
        const ctx = submitCtx();
        await runSubmit(ctx);
        await vi.advanceTimersByTimeAsync(1000);

        expect(fb.get).toHaveBeenCalledWith(expect.objectContaining({ path: 'HistoryLog' }));
        expect(ctx.logs.map((l) => l.LogID)).toEqual(['LOG-2', 'LOG-1']);
    });

    it('refresh: snapshot kosong → daftar lokal tidak berubah', async () => {
        stubFirebase({ get: vi.fn(async () => ({ val: () => null })) });
        const ctx = submitCtx();
        await runSubmit(ctx);
        await vi.advanceTimersByTimeAsync(1000);

        expect(ctx.logs).toHaveLength(1);
    });

    it('refresh: get melempar → diabaikan tanpa mengubah daftar', async () => {
        stubFirebase({ get: vi.fn(async () => { throw new Error('rtdb putus'); }) });
        const ctx = submitCtx();
        await runSubmit(ctx);
        await vi.advanceTimersByTimeAsync(1000);

        expect(ctx.logs).toHaveLength(1);
        expect(ctx.showLogModal).toBe(false);
    });
});
