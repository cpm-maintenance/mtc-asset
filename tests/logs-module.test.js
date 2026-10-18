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
