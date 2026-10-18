// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/performance.js` (kartu A lanjutan, S25).
 *
 * Yang diuji adalah **aritmetika yang dipakai KPI di layar**, bukan Firebase-nya:
 * `updatePerfHours` (wh = 24 − bd − stb, event Operational masuk ke stb),
 * `calculateKPI` (MA/PA/UA/MTBF/MTTR/gap), `getFilteredPerfData` (filter
 * equipment/area + daily/weekly/monthly/yearly), dan guard tulis
 * `submitPerformance` (validasi → hak akses → jalur offline vs RTDB).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceModule } from '../src/js/modules/performance.js';

function stubFirebase(overrides = {}) {
    const fns = {
        db: { name: 'db' },
        ref: vi.fn((db, path) => ({ path })),
        set: vi.fn(async () => {}),
        update: vi.fn(async () => {}),
        ...overrides,
    };
    for (const [k, v] of Object.entries(fns)) vi.stubGlobal(k, v);
    return fns;
}

function makeCtx(overrides = {}) {
    const ctx = Object.create(performanceModule);
    ctx.performanceData = [];
    ctx.equipment = [];
    ctx.logs = [];
    ctx.performanceForm = null;
    ctx.isEditingPerformance = false;
    ctx.showPerformanceModal = false;
    ctx.isLoading = false;
    ctx.isOnline = true;
    ctx.isAdmin = false;
    ctx.isAdminOrSupervisor = false;
    ctx.user = { uid: 'u1' };
    ctx.queueOfflineOperation = vi.fn(async () => true);
    ctx.saveToIndexedDB = vi.fn(async () => {});
    ctx.showNotification = vi.fn();
    delete window.app;
    delete window.auditModule;
    return Object.assign(ctx, overrides);
}

const validForm = (over = {}) => ({
    id: '',
    equipmentId: 'EQ-1',
    date: '2026-10-18',
    wh: '20.00',
    bd: '4.00',
    stb: '0.00',
    hm: '',
    freq: 1,
    type: 'Unscheduled',
    area: 'Plant 2',
    paPlan: 90,
    remarks: '',
    rca: 'None',
    category: 'Mechanical',
    events: [],
    ...over,
});

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('openPerformanceModal', () => {
    it('mode baru: form default 24 jam penuh, tanggal hari ini', () => {
        const ctx = makeCtx();
        ctx.openPerformanceModal();
        expect(ctx.isEditingPerformance).toBe(false);
        expect(ctx.showPerformanceModal).toBe(true);
        expect(ctx.performanceForm).toMatchObject({ wh: '24.00', bd: '0.00', stb: '0.00', freq: 0, paPlan: 90, events: [] });
        expect(ctx.performanceForm.date).toBe(new Date().toISOString().split('T')[0]);
    });

    it('mode edit: menyalin data dan menormalkan events non-array', () => {
        const ctx = makeCtx();
        ctx.openPerformanceModal(true, { id: 'PERF-1', wh: '10.00', events: 'rusak' });
        expect(ctx.isEditingPerformance).toBe(true);
        expect(ctx.performanceForm).toMatchObject({ id: 'PERF-1', wh: '10.00', events: [] });
    });
});

describe('onPerfEquipChange', () => {
    it('mengisi HM dari CurrentHM/HM equipment', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1', CurrentHM: 1234.56 }],
            performanceForm: { equipmentId: 'EQ-1', hm: '' },
        });
        ctx.onPerfEquipChange();
        expect(ctx.performanceForm.hm).toBe('1234.6');
    });

    it('HM manual yang lebih besar tidak ditimpa', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1', HM: 100 }],
            performanceForm: { equipmentId: 'EQ-1', hm: '500' },
        });
        ctx.onPerfEquipChange();
        expect(ctx.performanceForm.hm).toBe('500');
    });

    it('equipment tanpa HM / tidak ditemukan → form tidak berubah', () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ-1' }], performanceForm: { equipmentId: 'EQ-1', hm: '' } });
        ctx.onPerfEquipChange();
        expect(ctx.performanceForm.hm).toBe('');
        ctx.performanceForm.equipmentId = 'GHOST';
        ctx.onPerfEquipChange();
        expect(ctx.performanceForm.hm).toBe('');
    });
});

describe('updatePerfHours — wh = 24 − bd − stb', () => {
    it('event Mechanical masuk bd, Operational masuk stb', () => {
        const ctx = makeCtx({
            performanceForm: {
                stb: '0.00',
                events: [
                    { category: 'Mechanical', duration: 2 },
                    { category: 'Electrical', duration: 1 },
                    { category: 'Operational', duration: 3 },
                ],
            },
        });
        ctx.updatePerfHours('bd');
        expect(ctx.performanceForm).toMatchObject({ bd: '3.00', freq: 2, stb: '3.00', wh: '18.00' });
    });

    it('field "stb": input manual standby dihormati apa adanya', () => {
        const ctx = makeCtx({
            performanceForm: { stb: '5', events: [{ category: 'Operational', duration: 3 }, { category: 'Mechanical', duration: 2 }] },
        });
        ctx.updatePerfHours('stb');
        expect(ctx.performanceForm).toMatchObject({ bd: '2.00', stb: '5.00', wh: '17.00' });
    });

    it('tanpa event Operational: stb manual dipakai', () => {
        const ctx = makeCtx({ performanceForm: { stb: '4', events: [] } });
        ctx.updatePerfHours('bd');
        expect(ctx.performanceForm).toMatchObject({ bd: '0.00', freq: 0, stb: '4.00', wh: '20.00' });
    });

    it('total melebihi 24 jam: wh dijepit 0 dan stb disisakan', () => {
        const ctx = makeCtx({ performanceForm: { stb: '0', events: [{ category: 'Mechanical', duration: 30 }] } });
        ctx.updatePerfHours('bd');
        expect(ctx.performanceForm).toMatchObject({ bd: '30.00', wh: '0.00', stb: '0.00' });
    });

    it('form belum ada → tidak melempar', () => {
        const ctx = makeCtx();
        expect(() => ctx.updatePerfHours('bd')).not.toThrow();
    });
});

describe('addBDEvent / removeBDEvent', () => {
    it('add menambah baris default, remove menghapus lalu menghitung ulang jam', () => {
        const ctx = makeCtx({ performanceForm: { stb: '0', events: [] } });
        ctx.addBDEvent();
        expect(ctx.performanceForm.events).toHaveLength(1);
        expect(ctx.performanceForm.events[0]).toMatchObject({ category: 'Mechanical', duration: 0, rca: 'Operational Misuse' });

        ctx.performanceForm.events[0].duration = 6;
        ctx.removeBDEvent(0);
        expect(ctx.performanceForm.events).toHaveLength(0);
        expect(ctx.performanceForm).toMatchObject({ bd: '0.00', wh: '24.00' });
    });

    it('events bukan array → remove tidak melakukan apa pun', () => {
        const ctx = makeCtx({ performanceForm: { events: 'rusak' } });
        expect(() => ctx.removeBDEvent(0)).not.toThrow();
    });
});

describe('calculateKPI', () => {
    it('tanpa data → semua 0.0', () => {
        expect(makeCtx().calculateKPI(null)).toEqual({ ma: '0.0', pa: '0.0', ua: '0.0', mtbf: '0.0', mttr: '0.0', gap: '0.0' });
    });

    it('menghitung MA/PA/UA/MTBF/MTTR/gap dari wh/bd/stb/freq', () => {
        const kpi = makeCtx().calculateKPI({ wh: 20, bd: 4, stb: 0, freq: 2, paPlan: 90 });
        expect(kpi).toEqual({ ma: '83.3', pa: '83.3', ua: '100.0', mtbf: '10.0', mttr: '2.0', gap: '-6.7' });
    });

    it('events lebih diutamakan daripada freq tersimpan', () => {
        const kpi = makeCtx().calculateKPI({ wh: 20, bd: 4, stb: 0, freq: 99, events: [{}, {}], paPlan: 80 });
        expect(kpi.mtbf).toBe('10.0'); // 20 / 2, bukan 20 / 99
        expect(kpi.gap).toBe('3.3');
    });

    it('tanpa kegagalan: MTBF = wh dan MTTR = 0', () => {
        const kpi = makeCtx().calculateKPI({ wh: 24, bd: 0, stb: 0, freq: 0, paPlan: 90 });
        expect(kpi).toMatchObject({ ma: '100.0', pa: '100.0', ua: '100.0', mtbf: '24.0', mttr: '0.0', gap: '10.0' });
    });

    it('semua nol → pembagian aman, tidak NaN', () => {
        const kpi = makeCtx().calculateKPI({ wh: 0, bd: 0, stb: 0, freq: 0 });
        expect(kpi).toEqual({ ma: '0.0', pa: '0.0', ua: '0.0', mtbf: '0.0', mttr: '0.0', gap: '-90.0' });
    });

    it('standby ikut dihitung sebagai waktu tersedia', () => {
        const kpi = makeCtx().calculateKPI({ wh: 18, bd: 2, stb: 4, freq: 1, paPlan: 90 });
        // avail 22, MA 22/24 = 91.7, PA 91.7, UA 18/22 = 81.8
        expect(kpi).toMatchObject({ ma: '91.7', pa: '91.7', ua: '81.8', mtbf: '18.0', mttr: '2.0', gap: '1.7' });
    });
});

describe('getFilteredPerfData', () => {
    const rows = [
        { id: 'A', date: '2026-10-18', equipmentId: 'EQ-1', area: 'Plant 2' },
        { id: 'B', date: '2026-10-05', equipmentId: 'EQ-1', area: 'Plant 2' },
        { id: 'C', date: '2026-09-30', equipmentId: 'EQ-2', area: 'Plant 1' },
        { id: 'D', date: '2025-12-31', EquipmentID: 'EQ-1' },
        { id: 'E', date: 'bukan-tanggal', equipmentId: 'EQ-1' },
        { id: 'F' },
    ];
    const ctx = (over = {}) => makeCtx({ performanceData: rows, ...over });

    it('data bukan array → []', () => {
        expect(makeCtx({ performanceData: null }).getFilteredPerfData()).toEqual([]);
        expect(makeCtx({ performanceData: 'x' }).getFilteredPerfData()).toEqual([]);
    });

    it('tanpa filter tanggal: semua data (setelah filter equipment/area)', () => {
        expect(ctx().getFilteredPerfData()).toHaveLength(6);
        expect(ctx({ perfFilterEquip: 'EQ-1' }).getFilteredPerfData().map((p) => p.id)).toEqual(['A', 'B', 'D', 'E']);
        expect(ctx({ perfFilterArea: 'Plant 1' }).getFilteredPerfData().map((p) => p.id)).toEqual(['C']);
        expect(ctx({ perfFilterEquip: 'EQ-1', perfFilterArea: 'Plant 2' }).getFilteredPerfData().map((p) => p.id)).toEqual(['A', 'B']);
    });

    it('filter tanggal tidak valid → data dikembalikan tanpa filter tanggal', () => {
        expect(ctx({ kpiFilterDate: 'bukan-tanggal' }).getFilteredPerfData()).toHaveLength(6);
    });

    it('yearly: satu tahun penuh, baris tanpa tanggal/tanggal rusak dibuang', () => {
        const ids = ctx({ kpiFilterDate: '2026-06-01', kpiFilter: 'yearly' }).getFilteredPerfData().map((p) => p.id);
        expect(ids).toEqual(['A', 'B', 'C']);
    });

    it('daily: hanya tanggal yang sama persis', () => {
        const ids = ctx({ kpiFilterDate: '2026-10-18', kpiFilter: 'daily' }).getFilteredPerfData().map((p) => p.id);
        expect(ids).toEqual(['A']);
    });

    it('monthly: bulan & tahun sama', () => {
        const ids = ctx({ kpiFilterDate: '2026-10-01', kpiFilter: 'monthly' }).getFilteredPerfData().map((p) => p.id);
        expect(ids).toEqual(['A', 'B']);
    });

    it('weekly: rentang Senin–Minggu dari tanggal acuan', () => {
        // 2026-10-18 = Minggu → minggu 12–18 Okt
        const ids = ctx({ kpiFilterDate: '2026-10-18', kpiFilter: 'weekly' }).getFilteredPerfData().map((p) => p.id);
        expect(ids).toEqual(['A']);
    });

    it('filter tak dikenal diperlakukan sebagai monthly', () => {
        const ids = ctx({ kpiFilterDate: '2026-09-15', kpiFilter: 'entah' }).getFilteredPerfData().map((p) => p.id);
        expect(ids).toEqual(['C']);
    });
});

describe('submitPerformance — guard', () => {
    it('form belum diinisialisasi → notifikasi', async () => {
        const ctx = makeCtx();
        await ctx.submitPerformance();
        expect(ctx.showNotification).toHaveBeenCalledWith('Form not initialized', 'error');
    });

    it('form tidak valid: error pertama validatePerformanceForm', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ performanceForm: validForm({ equipmentId: '', date: '' }), isAdmin: true });
        await ctx.submitPerformance();
        expect(ctx.showNotification).toHaveBeenCalledWith('Equipment selection is required', 'error');
        expect(fb.set).not.toHaveBeenCalled();
    });

    it('buat record baru butuh admin', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ performanceForm: validForm(), isAdmin: false, isEditingPerformance: false });
        await ctx.submitPerformance();
        expect(ctx.showNotification).toHaveBeenCalledWith('Admin access required to create performance records', 'error');
        expect(fb.set).not.toHaveBeenCalled();
    });
});

describe('submitPerformance — tulis', () => {
    it('sukses: id PERF-*, bd/freq dari events, createdBy, audit, modal ditutup', async () => {
        const fb = stubFirebase();
        const logAudit = vi.fn();
        const ctx = makeCtx({
            isAdmin: true,
            performanceData: [],
            performanceForm: validForm({
                events: [{ category: 'Mechanical', duration: 2 }, { category: 'Operational', duration: 3 }],
            }),
        });
        window.auditModule = { logAudit };

        await ctx.submitPerformance();

        expect(fb.set).toHaveBeenCalledTimes(1);
        const [refArg, payload] = fb.set.mock.calls[0];
        expect(refArg.path).toMatch(/^Performance\/PERF-\d+$/);
        expect(payload).toMatchObject({ bd: 2, freq: 1, createdBy: 'u1', updatedBy: 'u1', paPlan: 90 });
        expect(payload.wh).toBe(20);
        expect(payload.stb).toBe(0);
        expect(ctx.performanceData[0]).toEqual(payload);
        expect(ctx.showPerformanceModal).toBe(false);
        expect(ctx.showNotification).toHaveBeenCalledWith('KPI metrics successfully synced!');
        expect(logAudit).toHaveBeenCalledWith('Create Performance', expect.objectContaining({ equip: 'EQ-1' }));
        expect(ctx.isLoading).toBe(false);
    });

    it('edit: id dipertahankan dan createdBy lama disalin', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({
            isEditingPerformance: true,
            performanceData: [{ id: 'PERF-9', createdBy: 'admin-lama' }],
            performanceForm: validForm({ id: 'PERF-9', events: [] }),
        });

        await ctx.submitPerformance();

        expect(fb.set.mock.calls[0][0].path).toBe('Performance/PERF-9');
        expect(fb.set.mock.calls[0][1]).toMatchObject({ createdBy: 'admin-lama' });
        expect(ctx.performanceData[0].id).toBe('PERF-9');
    });

    it('offline: masuk antrean, disimpan ke IndexedDB, tidak menyentuh RTDB', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ isAdmin: true, isOnline: false, performanceForm: validForm() });

        await ctx.submitPerformance();

        expect(ctx.queueOfflineOperation).toHaveBeenCalledWith('performance', expect.objectContaining({ equipmentId: 'EQ-1' }));
        expect(ctx.saveToIndexedDB).toHaveBeenCalled();
        expect(fb.set).not.toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('Performance data saved offline, will sync when online');
        expect(ctx.performanceData).toHaveLength(1);
    });

    it('offline tapi antrean gagal → tetap mencoba RTDB', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({
            isAdmin: true,
            isOnline: false,
            queueOfflineOperation: vi.fn(async () => false),
            performanceForm: validForm(),
        });
        await ctx.submitPerformance();
        expect(fb.set).toHaveBeenCalledTimes(1);
    });

    it('gagal tulis: notifikasi error, isLoading direset', async () => {
        stubFirebase({ set: vi.fn(async () => { throw new Error('permission_denied'); }) });
        const ctx = makeCtx({ isAdmin: true, performanceForm: validForm() });
        await ctx.submitPerformance();
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: permission_denied', 'error');
        expect(ctx.isLoading).toBe(false);
        expect(ctx.showPerformanceModal).toBe(false);
    });
});

describe('recomputeBD', () => {
    it('bukan admin/supervisor → ditolak', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx();
        await ctx.recomputeBD();
        expect(ctx.showNotification).toHaveBeenCalledWith('Admin access required', 'error');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('tanpa data Performance → info, tanpa tulis', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ isAdminOrSupervisor: true, performanceData: [] });
        await ctx.recomputeBD();
        expect(ctx.showNotification).toHaveBeenCalledWith('Tidak ada data Performance', 'info');
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('menghitung bd/freq dari log Breakdown per equipment+tanggal', async () => {
        const fb = stubFirebase();
        const row = { id: 'PERF-1', EquipmentID: 'EQ-1', date: '2026-10-18', bd: 99 };
        const ctx = makeCtx({
            isAdminOrSupervisor: true,
            performanceData: [row],
            logs: [
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-10-18', Downtime: 2.25 },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-10-18', Downtime: 1 },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: '2026-10-17', Downtime: 5 },
            ],
        });

        await ctx.recomputeBD();

        expect(fb.update.mock.calls[0][0].path).toBe('Performance/PERF-1');
        expect(fb.update.mock.calls[0][1]).toMatchObject({ bd: 3.25, freq: 2, bdSource: 'wo' });
        expect(row.bd).toBe(3.25);
        expect(ctx.showNotification).toHaveBeenCalledWith('BD disinkronkan dari WO: 1 record', 'success');
    });

    it('satu record gagal ditulis: record lain tetap jalan', async () => {
        const fb = stubFirebase({
            update: vi.fn(async (ref) => {
                if (ref.path.endsWith('BAD')) throw new Error('denied');
            }),
        });
        const ctx = makeCtx({
            isAdminOrSupervisor: true,
            performanceData: [{ id: 'BAD', EquipmentID: 'EQ-1', date: '2026-10-18' }, { id: 'OK', EquipmentID: 'EQ-1', date: '2026-10-18' }],
            logs: [],
        });
        await ctx.recomputeBD();
        expect(fb.update).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('BD disinkronkan dari WO: 1 record', 'success');
    });
});
