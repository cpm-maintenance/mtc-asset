// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/enterprise-kpi.js` (kartu A lanjutan, S25).
 *
 * Modul ini 4% karena seluruh metriknya butuh state Alpine + `_raw()` dari
 * `app.js`. Semua fungsi di sini **murni terhadap state** — tidak ada DOM,
 * tidak ada Firebase — jadi `_raw: (x) => x` cukup.
 *
 * Yang dikunci: ambang status/warna tiap metrik (Optimal/Good/Warning/Critical),
 * definisi downtime (R6: `bd` saja, `stb` bukan breakdown), `mtbf/mttr` yang
 * mengembalikan `null` saat data kurang, dan `toneColor` yang harus berupa
 * ekspresi token `rgb(var(--tac-chart-…))` — bukan hex (dijaga juga oleh
 * `tests/legacy-palette.test.js`).
 */
import { describe, it, expect, vi } from 'vitest';
import { enterpriseKPI } from '../src/js/modules/enterprise-kpi.js';

const DAY = 86400000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const ymd = (offsetDays = 0) => iso(offsetDays).slice(0, 10);

function makeCtx(overrides = {}) {
    const ctx = Object.create(enterpriseKPI);
    ctx._raw = (x) => x;
    ctx.equipment = [];
    ctx.logs = [];
    ctx.performanceData = [];
    ctx.pmList = [];
    ctx.allParts = [];
    ctx.currentPage = 'enterprise';
    ctx.showNotification = vi.fn();
    ctx.renderEnterpriseCharts = vi.fn();
    return Object.assign(ctx, overrides);
}

describe('calcAvailability', () => {
    it('tanpa data perf → 100% Optimal (bukan 0%)', () => {
        expect(makeCtx().calcAvailability('EQ-1')).toEqual({ pct: 100, status: 'Optimal', color: 'green' });
    });

    it('menghitung (wh - bd - stb) / wh', () => {
        const ctx = makeCtx({ performanceData: [{ equipmentId: 'EQ-1', wh: 100, bd: 5, stb: 5 }] });
        expect(ctx.calcAvailability('EQ-1')).toMatchObject({ pct: 90, status: 'Good', color: 'blue' });
    });

    it('wh kosong dihitung 24 jam per baris (fallback)', () => {
        const ctx = makeCtx({ performanceData: [{ EquipmentID: 'EQ-1', bd: 12 }] });
        expect(ctx.calcAvailability('EQ-1').pct).toBe(50);
    });

    it.each([
        [95, 'Optimal', 'green'],
        [94, 'Good', 'blue'],
        [85, 'Good', 'blue'],
        [84, 'Warning', 'orange'],
        [70, 'Warning', 'orange'],
        [69, 'Critical', 'red'],
    ])('ambang %s%% → %s', (pct, status, color) => {
        const ctx = makeCtx({ performanceData: [{ equipmentId: 'E', wh: 100, bd: 100 - pct }] });
        expect(ctx.calcAvailability('E')).toMatchObject({ pct, status, color });
    });

    it('hasil negatif dijepit ke 0 (downtime > total jam)', () => {
        const ctx = makeCtx({ performanceData: [{ equipmentId: 'E', wh: 1, bd: 50, stb: 50 }] });
        expect(ctx.calcAvailability('E').pct).toBe(0);
    });

    it('baris equipment lain diabaikan', () => {
        const ctx = makeCtx({ performanceData: [{ equipmentId: 'OTHER', wh: 1, bd: 99 }] });
        expect(ctx.calcAvailability('EQ-1').pct).toBe(100);
    });
});

describe('calcMTBF / calcMTTR', () => {
    const failures = (n, equip = 'EQ-1') =>
        Array.from({ length: n }, () => ({ EquipmentID: equip, Jenis: 'Breakdown' }));

    it('MTBF null kalau kegagalan < 2', () => {
        expect(makeCtx({ logs: failures(1) }).calcMTBF('EQ-1')).toBeNull();
        expect(makeCtx({ logs: [] }).calcMTBF('EQ-1')).toBeNull();
    });

    it('MTBF = total jam / (kegagalan - 1)', () => {
        const ctx = makeCtx({
            logs: failures(3),
            performanceData: [{ equipmentId: 'EQ-1', wh: 100 }, { equipmentId: 'EQ-1', wh: 20 }],
        });
        expect(ctx.calcMTBF('EQ-1')).toBe(60); // 120 / 2
    });

    it('Jenis Repair ikut dihitung sebagai kegagalan; jenis lain tidak', () => {
        const ctx = makeCtx({
            logs: [{ EquipmentID: 'EQ-1', Jenis: 'Repair' }, { EquipmentID: 'EQ-1', Jenis: 'PM' }, { EquipmentID: 'EQ-1', Jenis: 'Repair' }],
            performanceData: [{ equipmentId: 'EQ-1', wh: 40 }],
        });
        expect(ctx.calcMTBF('EQ-1')).toBe(40);
    });

    it('MTTR null tanpa log kegagalan, dan = bd/kegagalan (1 desimal)', () => {
        expect(makeCtx().calcMTTR('EQ-1')).toBeNull();
        const ctx = makeCtx({
            logs: failures(2),
            performanceData: [{ equipmentId: 'EQ-1', wh: 10, bd: 5 }, { equipmentId: 'EQ-1', bd: 2 }],
        });
        expect(ctx.calcMTTR('EQ-1')).toBe(3.5);
    });

    it('MTTR hanya memakai bd (stb diabaikan — R6)', () => {
        const ctx = makeCtx({ logs: failures(1), performanceData: [{ equipmentId: 'EQ-1', bd: 4, stb: 96 }] });
        expect(ctx.calcMTTR('EQ-1')).toBe(4);
    });
});

describe('calcReliability', () => {
    it('tanpa MTBF → 100% Optimal', () => {
        expect(makeCtx().calcReliability('EQ-1')).toEqual({ pct: 100, status: 'Optimal', color: 'green' });
    });

    it('R(720) = e^(-720/MTBF)', () => {
        const ctx = makeCtx({
            logs: [
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown' },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown' },
            ],
            performanceData: [{ equipmentId: 'EQ-1', wh: 720 }],
        });
        // MTBF 720 → e^-1 = 0.3679 → 37%
        expect(ctx.calcReliability('EQ-1')).toMatchObject({ pct: 37, status: 'Critical', color: 'red' });
    });
});

describe('calcOEE', () => {
    it('tanpa data sama sekali: availability 0, performance 85, quality 95 → 0', () => {
        const oee = makeCtx().calcOEE();
        expect(oee).toMatchObject({ availability: 0, performance: 85, quality: 95, oee: 0, status: 'Critical' });
    });

    it('menghitung availability rata-rata, performance dari wh/planned, quality dari rework', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1', Status: 'Running' }],
            performanceData: [{ equipmentId: 'EQ-1', wh: 75, bd: 25, stb: 0 }],
            logs: [
                { EquipmentID: 'EQ-1', Status: 'Completed', Jenis: 'PM' },
                { EquipmentID: 'EQ-1', Status: 'Completed', Jenis: 'PM' },
                { EquipmentID: 'EQ-1', Status: 'Completed', Jenis: 'Repair' },
                { EquipmentID: 'EQ-1', Status: 'Completed', Jenis: 'Breakdown' },
            ],
        });
        const oee = ctx.calcOEE();
        expect(oee).toMatchObject({ availability: 67, performance: 75, quality: 50 });
        expect(oee.oee).toBe(25); // round(67 * 75 * 50 / 10000)
        expect(oee.status).toBe('Critical');
    });

    it('toneColor memakai token chart, bukan hex', () => {
        const { toneColor } = makeCtx().calcOEE();
        expect(toneColor).toBe('rgb(var(--tac-chart-crit))');
    });

    it('OEE tinggi → Optimal + token green', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1' }],
            performanceData: [{ equipmentId: 'EQ-1', wh: 100, bd: 0, stb: 0 }],
            logs: [{ EquipmentID: 'EQ-1', Status: 'Completed', Jenis: 'PM' }],
        });
        const oee = ctx.calcOEE();
        expect(oee).toMatchObject({ oee: 100, status: 'Optimal', color: 'green' });
        expect(oee.toneColor).toBe('rgb(var(--tac-chart-good))');
    });
});

describe('calcHealthScore', () => {
    it('tanpa equipId / equipment tidak dikenal → 100 Optimal', () => {
        expect(makeCtx().calcHealthScore('')).toEqual({ score: 100, status: 'Optimal', color: 'green' });
        expect(makeCtx().calcHealthScore('GHOST')).toEqual({ score: 100, status: 'Optimal', color: 'green' });
    });

    it('breakdown 90 hari terakhir memotong 15 poin per kejadian', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1' }],
            logs: [
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: ymd(-10) },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: ymd(-20) },
            ],
        });
        expect(ctx.calcHealthScore('EQ-1')).toMatchObject({ score: 70, status: 'Warning', color: 'orange', breakdowns: 2 });
    });

    it('breakdown lebih tua dari 90 hari tidak dihitung', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1' }],
            logs: [{ EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: ymd(-200) }],
        });
        expect(ctx.calcHealthScore('EQ-1')).toMatchObject({ score: 100, breakdowns: 0 });
    });

    it('PM overdue memotong 2 poin/hari, maksimum 30', () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ-1', NextPMDate: ymd(-5) }] });
        expect(ctx.calcHealthScore('EQ-1').score).toBe(90);

        const longOverdue = makeCtx({ equipment: [{ EquipmentID: 'EQ-1', NextPMDate: ymd(-365) }] });
        expect(longOverdue.calcHealthScore('EQ-1').score).toBe(70); // 100 - 30
    });

    it('NextPMDate tidak valid / di masa depan tidak memotong', () => {
        expect(makeCtx({ equipment: [{ EquipmentID: 'EQ-1', NextPMDate: 'bukan-tanggal' }] }).calcHealthScore('EQ-1').score).toBe(100);
        expect(makeCtx({ equipment: [{ EquipmentID: 'EQ-1', NextPMDate: ymd(30) }] }).calcHealthScore('EQ-1').score).toBe(100);
    });

    it('MTBF < 168 jam memotong 10 poin lagi', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1' }],
            logs: [
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown' },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown' },
            ],
            performanceData: [{ equipmentId: 'EQ-1', wh: 100 }],
        });
        // MTBF = 100 (<168) → -10
        expect(ctx.calcHealthScore('EQ-1').score).toBe(90);
    });

    it('skor dijepit 0..100 dan status mengikuti ambang', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1', NextPMDate: ymd(-30) }],
            logs: Array.from({ length: 10 }, () => ({ EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: ymd(-1) })),
        });
        const h = ctx.calcHealthScore('EQ-1');
        expect(h.score).toBe(0);
        expect(h).toMatchObject({ status: 'Critical', color: 'red' });
    });
});

describe('calcDowntime / calcMaintCost', () => {
    it('downtime hanya bd, dibatasi jendela bulan', () => {
        const ctx = makeCtx({
            performanceData: [
                { equipmentId: 'EQ-1', bd: 5, stb: 100, date: ymd(-10) },
                { equipmentId: 'EQ-1', bd: 3, date: ymd(-400) },
                { equipmentId: 'EQ-2', bd: 7, date: ymd(-10) },
            ],
        });
        expect(ctx.calcDowntime('EQ-1')).toBe(5);
        expect(ctx.calcDowntime()).toBe(12); // semua equipment
    });

    it('maint cost menjumlah cost dalam jendela, mengabaikan yang tanpa tanggal', () => {
        const ctx = makeCtx({
            logs: [
                { EquipmentID: 'EQ-1', cost: 1000, Tanggal: ymd(-5) },
                { EquipmentID: 'EQ-1', cost: 250, Tanggal: ymd(-400) },
                { EquipmentID: 'EQ-1', cost: 999 },
                { EquipmentID: 'EQ-2', cost: 500, Tanggal: ymd(-5) },
            ],
        });
        expect(ctx.calcMaintCost('EQ-1')).toBe(1000);
        expect(ctx.calcMaintCost()).toBe(1500);
    });
});

describe('calcPMCompliance', () => {
    it('daftar kosong → status N/A', () => {
        expect(makeCtx().calcPMCompliance()).toEqual({ pct: 100, completed: 0, total: 0, overdue: 0, status: 'N/A', color: 'gray' });
    });

    it('menghitung persentase selesai + overdue (pending dengan tanggal lampau)', () => {
        const ctx = makeCtx({
            pmList: [
                { status: 'completed', date: ymd(-1) },
                { status: 'completed', date: ymd(-2) },
                { status: 'pending', date: ymd(-10) },
                { status: 'pending', date: ymd(10) },
            ],
        });
        expect(ctx.calcPMCompliance()).toMatchObject({ pct: 50, completed: 2, total: 4, overdue: 1, status: 'Warning', color: 'orange' });
    });

    it.each([
        [100, 'Excellent', 'green'],
        [90, 'Excellent', 'green'],
        [89, 'Good', 'blue'],
        [70, 'Good', 'blue'],
        [69, 'Warning', 'orange'],
        [50, 'Warning', 'orange'],
        [49, 'Critical', 'red'],
    ])('%s%% → %s', (pct, status, color) => {
        const done = pct;
        const pmList = [
            ...Array.from({ length: done }, () => ({ status: 'completed' })),
            ...Array.from({ length: 100 - done }, () => ({ status: 'pending' })),
        ];
        const res = makeCtx({ pmList }).calcPMCompliance();
        expect(res).toMatchObject({ status, color });
        expect(res.pct).toBe(pct);
    });
});

describe('calcSummary', () => {
    const ctx = () => makeCtx({
        equipment: [
            { EquipmentID: 'EQ-1', Status: 'Running' },
            { EquipmentID: 'EQ-2', Status: 'Active' },
            { EquipmentID: 'EQ-3', Status: 'Breakdown' },
            { EquipmentID: 'EQ-4', Status: 'In Maintenance' },
        ],
        performanceData: [{ equipmentId: 'EQ-1', wh: 100, bd: 4, stb: 1, date: ymd(-1) }],
        logs: [
            { EquipmentID: 'EQ-1', woNumber: 'WO-1', Status: 'Completed', cost: 100, Tanggal: ymd(-1) },
            { EquipmentID: 'EQ-1', woNumber: 'WO-2', Status: 'Pending', cost: 50, Tanggal: ymd(-1) },
            { EquipmentID: 'EQ-1', Status: 'Draft' },
            { EquipmentID: 'EQ-1', Status: 'Cancelled' },
            { EquipmentID: 'EQ-1', Status: 'In Progress' },
        ],
        pmList: [{ status: 'completed', date: ymd(-5) }, { status: 'pending', date: ymd(-5) }],
        allParts: [
            { PartID: 'P1', Stok: 2, Harga: 1000, MinStock: 5, Criticality: 'Critical' },
            { PartID: 'P2', Stok: 10, Harga: 100, MinStock: 1, Criticality: 'High' },
            { PartID: 'P3', Stok: 5, Harga: 10, MinStock: 5, Criticality: 'Low' },
        ],
    });

    it('menghitung aset, WO, PM, biaya, dan nilai inventori dari data nyata', () => {
        const s = ctx().calcSummary();
        expect(s).toMatchObject({
            totalAssets: 4,
            running: 2,
            breakdown: 2,
            openWO: 1, // Pending (Draft/In Progress tidak masuk filter WO)
            completedWO: 1,
            overduePM: 1,
            backlogWO: 1, // WO-2 Pending
            downtime: 5, // bd + stb
            maintCost: 150,
            invValue: 2000 + 1000 + 50,
            criticalParts: 2,
            lowStock: 2, // P1 (2<=5) dan P3 (5<=5)
        });
        expect(s.pmc).toMatchObject({ pct: 50, total: 2 });
        expect(s.avgAvail).toBe(99); // (95 + 100 + 100 + 100) / 4 — hanya EQ-1 punya perf
        expect(s.avgHealth).toBe(100);
    });

    it('state kosong tetap menghasilkan angka netral, bukan NaN', () => {
        const s = makeCtx().calcSummary();
        expect(s).toMatchObject({ totalAssets: 0, avgMTBF: 0, avgMTTR: 0, avgAvail: 100, avgRel: 100, avgHealth: 100, downtime: 0, maintCost: 0, invValue: 0 });
    });
});

describe('calcCriticalEquip', () => {
    it('mengurutkan skor terendah dulu dan menghormati limit', () => {
        const ctx = makeCtx({
            equipment: [
                { EquipmentID: 'SEHAT', Nama: 'Sehat' },
                { EquipmentID: 'RUSAK', Nama: 'Rusak' },
            ],
            logs: [
                { EquipmentID: 'RUSAK', Jenis: 'Breakdown', Tanggal: ymd(-1) },
                { EquipmentID: 'RUSAK', Jenis: 'Breakdown', Tanggal: ymd(-2) },
                { EquipmentID: 'RUSAK', Jenis: 'Breakdown', Tanggal: ymd(-3) },
            ],
        });
        const list = ctx.calcCriticalEquip(1);
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ EquipmentID: 'RUSAK', score: 55, priority: 'High', lastFailure: ymd(-1).slice(0, 10) });
    });

    it('tanpa kegagalan: mtbf/mttr/lastFailure jadi "-", priority dari skor', () => {
        const list = makeCtx({ equipment: [{ EquipmentID: 'EQ-1' }] }).calcCriticalEquip();
        expect(list[0]).toMatchObject({ mtbf: '-', mttr: '-', lastFailure: '-', priority: 'Low', runningHrs: 0 });
    });

    it('runningHrs menjumlah wh', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1' }],
            performanceData: [{ equipmentId: 'EQ-1', wh: 30 }, { EquipmentID: 'EQ-1', wh: 12 }],
        });
        expect(ctx.calcCriticalEquip()[0].runningHrs).toBe(42);
    });
});

describe('tren & hitungan', () => {
    it('calcDowntimeTrend: agregat per bulan, urut, maksimum 12 bulan', () => {
        const ctx = makeCtx({
            performanceData: [
                { date: '2026-01-15', bd: 2, stb: 1 },
                { date: '2026-01-20', bd: 3 },
                { date: '2026-02-01', bd: 4 },
                { bd: 99 },
            ],
        });
        expect(ctx.calcDowntimeTrend()).toEqual([
            { month: '2026-01', hours: 6 },
            { month: '2026-02', hours: 4 },
        ]);
    });

    it('calcCostTrend: lewati baris tanpa tanggal/cost', () => {
        const ctx = makeCtx({
            logs: [
                { Tanggal: '2026-03-01', cost: 1000 },
                { Tanggal: '2026-03-05', cost: 500 },
                { Tanggal: '2026-03-06', cost: 0 },
                { cost: 700 },
            ],
        });
        expect(ctx.calcCostTrend()).toEqual([{ month: '2026-03', cost: 1500 }]);
    });

    it('calcPMTrend: total vs selesai per bulan', () => {
        const ctx = makeCtx({
            pmList: [
                { date: '2026-01-01', status: 'completed' },
                { date: '2026-01-09', status: 'pending' },
                { date: '2026-02-01', status: 'completed' },
                { status: 'completed' },
            ],
        });
        expect(ctx.calcPMTrend()).toEqual([
            { month: '2026-01', pct: 50 },
            { month: '2026-02', pct: 100 },
        ]);
    });

    it('calcWOStatus menghitung tiap status', () => {
        const ctx = makeCtx({
            logs: [
                { woNumber: 'W1', Status: 'Completed' },
                { woNumber: 'W2', Status: 'In Progress' },
                { woNumber: 'W3', Status: 'Approved' },
                { Status: 'Pending', Tanggal: ymd(-3) },
                { Status: 'Draft' },
                { woNumber: 'W4', Status: 'Cancelled' },
                { Status: 'Pending', Tanggal: ymd(3) },
                { Status: 'PM' }, // bukan WO (tanpa woNumber)
            ],
        });
        expect(ctx.calcWOStatus()).toEqual({
            completed: 1,
            inProgress: 1,
            waitingMaterial: 1,
            pending: 2, // Pending + Draft
            cancelled: 1,
            overdue: 1,
        });
    });

    it('calcHealthDist mengelompokkan skor ke 4 ember', () => {
        const bd = (n) => Array.from({ length: n }, () => ({ EquipmentID: 'X', Jenis: 'Breakdown', Tanggal: ymd(-1) }));
        const ctx = makeCtx({
            equipment: [
                { EquipmentID: 'A' }, // 100 → excellent
                { EquipmentID: 'B' }, // 100-30 = 70 → good
                { EquipmentID: 'C' }, // 100-60 = 40 → warning
                { EquipmentID: 'D' }, // 100-75 = 25 → critical
            ],
            logs: [
                ...bd(2).map((l) => ({ ...l, EquipmentID: 'B' })),
                ...bd(4).map((l) => ({ ...l, EquipmentID: 'C' })),
                ...bd(5).map((l) => ({ ...l, EquipmentID: 'D' })),
            ],
        });
        expect(ctx.calcHealthDist()).toEqual({ excellent: 1, good: 1, warning: 1, critical: 1 });
    });
});

describe('calcInsights', () => {
    it('state kosong: PM on track, tanpa backlog/lowstock/MTBF/avail', () => {
        const ins = makeCtx().calcInsights();
        expect(ins).toHaveLength(1);
        expect(ins[0]).toMatchObject({ type: 'success', ms: 'event' });
    });

    it('memunculkan warning PM, backlog, low stock, MTBF, dan availability', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1', Status: 'Breakdown' }],
            performanceData: [{ equipmentId: 'EQ-1', wh: 10, bd: 30 }],
            logs: [
                { EquipmentID: 'EQ-1', woNumber: 'W1', Status: 'Pending' },
                ...Array.from({ length: 12 }, (_, i) => ({ EquipmentID: 'EQ-1', woNumber: `X${i}`, Status: 'Pending' })),
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown' },
                { EquipmentID: 'EQ-1', Jenis: 'Breakdown' },
            ],
            pmList: [{ status: 'pending', date: ymd(-5) }],
            allParts: [{ PartID: 'P1', Stok: 0, MinStock: 1 }],
        });
        const types = ctx.calcInsights().map((i) => i.type);
        expect(types).toContain('warning');
        expect(types).toContain('critical');
        expect(ctx.calcInsights().length).toBeLessThanOrEqual(6);
    });

    it('insight breakdown muncul kalau skor < 40 dan >= 3 breakdown', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1', Nama: 'Pompa' }],
            logs: Array.from({ length: 5 }, () => ({ EquipmentID: 'EQ-1', Jenis: 'Breakdown', Tanggal: ymd(-1) })),
        });
        expect(ctx.calcInsights().some((i) => i.msg.includes('Pompa') && i.msg.includes('RCA'))).toBe(true);
    });
});

describe('calcInventoryABC', () => {
    it('mengurutkan nilai turun dan memetakan kumulatif ke A/B/C', () => {
        const ctx = makeCtx({
            allParts: [
                { PartID: 'KECIL', Stok: 1, Harga: 10 },
                { PartID: 'BESAR', Stok: 7, Harga: 10 },
                { PartID: 'TENGAH', Stok: 2, Harga: 10 },
                { Stok: 100, Harga: 100 }, // tanpa PartID → diabaikan
                { PartID: 'STOK-0', Stok: 0, Harga: 100 }, // stok 0 → diabaikan
            ],
        });
        const abc = ctx.calcInventoryABC();
        expect(abc.map((p) => p.PartID)).toEqual(['BESAR', 'TENGAH', 'KECIL']);
        expect(abc.map((p) => p.category)).toEqual(['A', 'B', 'C']);
        expect(abc[0].value).toBe(70);
    });
});

describe('computeEnterpriseData & UI', () => {
    it('tidak menghitung apa pun kalau halaman bukan enterprise', () => {
        const ctx = makeCtx({ currentPage: 'dashboard' });
        ctx.computeEnterpriseData();
        expect(ctx.enterpriseSummary).toBeUndefined();
    });

    it('mengisi summary, OEE, critical, insights, 8 kartu KPI, PM/WO/stock', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ-1', Status: 'Running' }],
            logs: [
                { EquipmentID: 'EQ-1', woNumber: 'W1', Status: 'Pending', woPriority: 'Urgent', Tanggal: ymd(-1) },
                { EquipmentID: 'EQ-1', woNumber: 'W2', Status: 'Pending', woPriority: 'Emergency' },
                { EquipmentID: 'EQ-1', woNumber: 'W3', Status: 'Completed' },
            ],
            pmList: [
                { status: 'pending', date: ymd(0) },
                { status: 'pending', date: ymd(1) },
                { status: 'completed', date: ymd(5) },
            ],
            allParts: [{ PartID: 'P1', Stok: 1, MinStock: 5 }],
        });

        ctx.computeEnterpriseData();

        expect(ctx.enterpriseSummary.totalAssets).toBe(1);
        expect(ctx.enterpriseOEE).toHaveProperty('oee');
        expect(ctx.enterpriseCritical).toHaveLength(1);
        expect(ctx.enterpriseInsights.length).toBeGreaterThan(0);
        expect(ctx.enterpriseKPIList).toHaveLength(8);
        expect(ctx.enterpriseKPIList.map((k) => k.key)).toEqual([
            'totalAssets', 'running', 'breakdown', 'pmc', 'openWO', 'completedWO', 'avgAvail', 'avgHealth',
        ]);
        expect(ctx.enterpriseKPIList.every((k) => k.color.startsWith('rgb(var(--tac-chart-'))).toBe(true);
        // PM hari ini & besok diberi label relatif
        expect(ctx.enterpriseUpcomingPM.map((p) => p.due)).toEqual(['today', 'tomorrow']);
        // WO kritis: Emergency dulu, Completed tidak ikut
        expect(ctx.enterpriseCriticalWO.map((w) => w.woNumber)).toEqual(['W2', 'W1']);
        expect(ctx.enterpriseLowStock.map((p) => p.PartID)).toEqual(['P1']);
    });

    it('refreshDashboard memicu compute + render + notifikasi', () => {
        const ctx = makeCtx();
        ctx.refreshDashboard();
        expect(ctx.renderEnterpriseCharts).toHaveBeenCalledTimes(1);
        expect(ctx.showNotification).toHaveBeenCalledWith('Dashboard refreshed', 'info');
    });

    it('kpiClick memetakan kartu ke halaman, kunci tak dikenal diabaikan', () => {
        const ctx = makeCtx({ currentPage: 'enterprise' });
        ctx.kpiClick('pmc');
        expect(ctx.currentPage).toBe('pms');
        ctx.kpiClick('avgAvail');
        expect(ctx.currentPage).toBe('kpi');
        ctx.kpiClick('tidak-ada');
        expect(ctx.currentPage).toBe('kpi');
    });

    it('toggleEquipDetail membuka lalu menutup baris yang sama', () => {
        const ctx = makeCtx({ expandedEquip: null });
        ctx.toggleEquipDetail('EQ-1');
        expect(ctx.expandedEquip).toBe('EQ-1');
        ctx.toggleEquipDetail('EQ-1');
        expect(ctx.expandedEquip).toBeNull();
        ctx.toggleEquipDetail('EQ-1');
        ctx.toggleEquipDetail('EQ-2');
        expect(ctx.expandedEquip).toBe('EQ-2');
    });
});
