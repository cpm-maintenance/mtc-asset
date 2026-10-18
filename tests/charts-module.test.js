// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * C-1 · unit test `src/js/charts.js` (kartu t_4dc085bd).
 *
 * Chart.js di-mock di level **library** (bukan modulnya), jadi seluruh
 * perhitungan data — MTBF/MTTR, availability, reliability, Pareto, cost,
 * health/WO/PM trend — benar-benar dieksekusi dan konfigurasi yang sampai ke
 * `new Chart()` bisa diperiksa.
 *
 * Catatan lingkungan (jsdom tidak punya layout):
 *  - `offsetParent` selalu null & `clientHeight` 0 → `waitForCanvas()` akan
 *    retry selamanya. Kanvas palsu disuntik lewat `document.getElementById`.
 *  - `getComputedStyle()` tidak memuat `tactical.css`, jadi `chartColor()`
 *    mengembalikan abu-abu netral (`rgb(128, 128, 128)`). Itu perilaku yang
 *    benar (lihat chart-palette.js), bukan kegagalan tes.
 */

const chartMock = vi.hoisted(() => {
    /** @type {any[]} */
    const instances = [];
    class Chart {
        constructor(ctx, config) {
            this.ctx = ctx;
            this.config = config;
            this.destroyed = false;
            instances.push(this);
        }
        destroy() {
            this.destroyed = true;
        }
    }
    Chart.register = vi.fn();
    Chart.getChart = vi.fn(() => null);
    return { Chart, instances, registerables: [{ id: 'registerable' }] };
});

vi.mock('chart.js', () => ({
    Chart: chartMock.Chart,
    registerables: chartMock.registerables,
}));

const { chartModule } = await import('../src/js/charts.js');

/** @param {Record<string, any>} [overrides] */
function makeCtx(overrides = {}) {
    const ctx = /** @type {any} */ (Object.create(chartModule));
    ctx.currentPage = 'dash';
    ctx.isLoggedIn = true;
    ctx.equipment = [];
    ctx.performanceData = [];
    ctx.logs = [];
    ctx.pmList = [];
    ctx.allParts = [];
    ctx.dashboardDateFrom = '';
    ctx.dashboardDateTo = '';
    ctx.showNotification = vi.fn();
    ctx.$nextTick = (/** @type {() => void} */ fn) => fn();
    return Object.assign(ctx, overrides);
}

/** Kanvas palsu yang lolos syarat `offsetParent !== null && clientHeight > 0`. */
function fakeCanvas(/** @type {string} */ id) {
    return { id, offsetParent: {}, clientHeight: 120, parentElement: null, style: {}, tagName: 'CANVAS' };
}

/**
 * @param {string[]} ids
 * @param {(id: string, seen: Map<string, number>) => void} [onGet]
 */
function stubCanvases(ids, onGet) {
    const map = new Map(ids.map((id) => [id, fakeCanvas(id)]));
    const seen = new Map();
    const spy = vi.spyOn(document, 'getElementById').mockImplementation((/** @type {any} */ id) => {
        const n = (seen.get(id) || 0) + 1;
        seen.set(id, n);
        onGet?.(id, seen);
        return map.get(id) ?? null;
    });
    return { map, seen, spy };
}

const DASH_CANVASES = ['reliabilityChart', 'pmStatusChart', 'woCompletionChart', 'costTrendChart'];
const KPI_CANVASES = [
    'mtbfChart', 'mttrChart', 'availabilityChart', 'reliabilityChartKPI',
    'top5Components', 'schedVsUnsched', 'failureTypeChart', 'costChart', 'paretoChart',
];
const ENT_CANVASES = ['eHealthChart', 'woStatusChart', 'pmTrendChart', 'downtimeTrendChart', 'costTrendChart', 'abcChart'];

let scheduled = /** @type {any} */ (null);

beforeEach(() => {
    delete (/** @type {any} */ (window)._chartJS);
    /** @type {any} */ (window)._appCharts = {};
    /** @type {any} */ (window)._appKpiCharts = {};
    chartMock.instances.length = 0;
    chartMock.Chart.getChart.mockReset();
    chartMock.Chart.getChart.mockImplementation(() => null);
    chartMock.Chart.register.mockReset();
    scheduled = null;
    vi.stubGlobal('requestAnimationFrame', (/** @type {any} */ fn) => {
        scheduled = fn();
        return 1;
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('helper murni', () => {
    it('safeDeepClone menyalin dalam (bukan referensi)', () => {
        const ctx = makeCtx();
        const src = { a: 1, nested: { b: [1, 2] } };
        const out = ctx.safeDeepClone(src);
        expect(out).toEqual(src);
        expect(out).not.toBe(src);
        expect(out.nested).not.toBe(src.nested);
    });

    it('safeDeepClone jatuh ke salinan dangkal saat data tidak bisa di-JSON-kan', () => {
        const ctx = makeCtx();
        const circular = /** @type {any} */ ({ a: 1 });
        circular.self = circular;
        expect(ctx.safeDeepClone(circular)).toEqual({ a: 1, self: circular });

        const arr = [1, 2, 3];
        const cloned = ctx.safeDeepClone(arr);
        expect(cloned).toEqual(arr);
        expect(cloned).not.toBe(arr);
    });

    it('safeDeepClone mengembalikan {} untuk nilai falsy yang gagal', () => {
        const ctx = makeCtx();
        const bad = { toJSON() { throw new Error('nope'); } };
        expect(ctx.safeDeepClone(bad)).toEqual(bad);
        // `undefined` → JSON.parse(undefined) melempar → fallback `{}`.
        expect(ctx.safeDeepClone(undefined)).toEqual({});
        // `null` justru LOLOS jalur sukses (JSON.parse('null') = null).
        expect(ctx.safeDeepClone(null)).toBeNull();
    });

    it('_monthKey memotong ke YYYY-MM dan menolak tanggal tak valid', () => {
        const ctx = makeCtx();
        expect(ctx._monthKey('2026-10-18')).toBe('2026-10');
        expect(ctx._monthKey('2026-10-18T22:10:00Z')).toBe('2026-10');
        expect(ctx._monthKey('bukan tanggal')).toBe('');
        expect(ctx._monthKey(null)).toBe('');
        expect(ctx._monthKey('')).toBe('');
    });

    it('_rgba menangani hex 6 digit dan 3 digit', () => {
        const ctx = makeCtx();
        expect(ctx._rgba('#ff8c1a', 0.5)).toBe('rgba(255, 140, 26, 0.5)');
        expect(ctx._rgba('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
    });

    it('_gradFill membuat gradien vertikal dari dua stop alpha', () => {
        const ctx = makeCtx();
        const addColorStop = vi.fn();
        const createLinearGradient = vi.fn(() => ({ addColorStop }));
        const g = ctx._gradFill({ createLinearGradient }, '#ff8c1a');
        expect(createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 300);
        expect(addColorStop).toHaveBeenCalledTimes(2);
        expect(addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgba(255, 140, 26, 0.45)');
        expect(addColorStop).toHaveBeenNthCalledWith(2, 1, 'rgba(255, 140, 26, 0.02)');
        expect(g).toBeTruthy();

        const g2 = ctx._gradFill({ createLinearGradient }, '#ff8c1a', 0.8, 0.1);
        expect(addColorStop).toHaveBeenNthCalledWith(3, 0, 'rgba(255, 140, 26, 0.8)');
        expect(addColorStop).toHaveBeenNthCalledWith(4, 1, 'rgba(255, 140, 26, 0.1)');
        expect(g2).toBeTruthy();
    });

    it('_equipLabel memakai nama, dengan fallback ke id', () => {
        expect(makeCtx({ getEquipName: () => 'Belt Conveyor CV-104' })._equipLabel('EQ-1')).toBe('Belt Conveyor CV-104');
        expect(makeCtx({ getEquipName: () => 'EQ-1' })._equipLabel('EQ-1')).toBe('EQ-1');
        expect(makeCtx({ getEquipName: () => 'Unknown Asset' })._equipLabel('EQ-1')).toBe('EQ-1');
        expect(makeCtx({ getEquipName: () => undefined })._equipLabel('EQ-9')).toBe('EQ-9');
        expect(makeCtx()._equipLabel('EQ-7')).toBe('EQ-7');
    });

    it('_chartIdleKind membedakan offline dan empty', () => {
        const ctx = makeCtx();
        const orig = navigator.onLine;
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        expect(ctx._chartIdleKind()).toBe('offline');
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        expect(ctx._chartIdleKind()).toBe('empty');
        Object.defineProperty(navigator, 'onLine', { value: orig, configurable: true });
    });
});

describe('palet tema', () => {
    it('themeAccent/themeAccentSoft/themeGrid memakai chartColor', () => {
        const ctx = makeCtx();
        expect(ctx.themeAccent()).toMatch(/^rgb\(/);
        expect(ctx.themeAccentSoft()).toMatch(/^rgba\(.*0\.1\)$/);
        expect(ctx.themeGrid()).toMatch(/^rgba\(.*0\.05\)$/);
    });

    it('chartColor meneruskan nama seri dan alpha', () => {
        const ctx = makeCtx();
        expect(ctx.chartColor('warn')).toMatch(/^rgb\(/);
        expect(ctx.chartColor('crit', 0.7)).toMatch(/^rgba\(.*0\.7\)$/);
    });
});

describe('loadChartJS & safeCreateChart', () => {
    it('loadChartJS mengimpor sekali lalu memakai cache window._chartJS', async () => {
        const ctx = makeCtx();
        const Chart = await ctx.loadChartJS();
        expect(Chart).toBe(chartMock.Chart);
        expect(chartMock.Chart.register).toHaveBeenCalledWith(...chartMock.registerables);
        expect(/** @type {any} */ (window)._chartJS).toBe(chartMock.Chart);

        const again = await ctx.loadChartJS();
        expect(again).toBe(chartMock.Chart);
        expect(chartMock.Chart.register).toHaveBeenCalledTimes(1);
    });

    it('safeCreateChart membuat instance baru', async () => {
        const ctx = makeCtx();
        const canvas = fakeCanvas('x');
        const chart = await ctx.safeCreateChart(canvas, { type: 'line' });
        expect(chart).toBe(chartMock.instances[0]);
        expect(chart.config.type).toBe('line');
        expect(chart.ctx).toBe(canvas);
    });

    it('safeCreateChart menghancurkan chart lama di kanvas yang sama', async () => {
        const ctx = makeCtx();
        const destroy = vi.fn();
        chartMock.Chart.getChart.mockImplementation(() => ({ destroy }));
        await ctx.safeCreateChart(fakeCanvas('x'), { type: 'bar' });
        expect(chartMock.Chart.getChart).toHaveBeenCalled();
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('safeCreateChart mengembalikan null kalau Chart.js tidak tersedia', async () => {
        const ctx = makeCtx({ loadChartJS: async () => null });
        expect(await ctx.safeCreateChart(fakeCanvas('x'), {})).toBeNull();
        expect(chartMock.instances.length).toBe(0);
    });

    it('safeCreateChart menangkap error dan memberi notifikasi', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx();
        chartMock.Chart.getChart.mockImplementation(() => {
            throw new Error('canvas rusak');
        });
        const out = await ctx.safeCreateChart(fakeCanvas('x'), {});
        expect(out).toBeNull();
        expect(err).toHaveBeenCalledWith('Chart creation failed:', expect.any(Error));
        expect(ctx.showNotification).toHaveBeenCalledWith('Chart render failed', 'error');
    });
});

describe('setChartState / clearChartState', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="relative"><canvas id="reliabilityChart"></canvas></div>
            <canvas id="tanpaHost"></canvas>
        `;
        // `tanpaHost` dibuat tanpa parent untuk menguji jalur host kosong.
        const orphan = document.getElementById('tanpaHost');
        if (orphan) orphan.remove();
    });

    it('memakai preset ikon per jenis status', () => {
        const ctx = makeCtx();
        const cases = [
            ['offline', 'wifi_off', 'text-tac-status-repair'],
            ['error', 'warning', 'text-tac-status-emergency'],
            ['empty', 'show_chart', 'text-tac-on-surface-variant'],
        ];
        for (const [kind, icon, tone] of cases) {
            ctx.setChartState('reliabilityChart', kind, `pesan ${kind}`);
            const box = /** @type {HTMLElement} */ (document.querySelector('[data-chart-state]'));
            expect(box.getAttribute('data-chart-state')).toBe(kind);
            const ic = /** @type {HTMLElement} */ (box.querySelector('i'));
            expect(ic.textContent).toBe(icon);
            expect(ic.className).toContain(tone);
            expect(ic.getAttribute('aria-hidden')).toBe('true');
        }
    });

    it('jenis tak dikenal jatuh ke preset empty', () => {
        const ctx = makeCtx();
        ctx.setChartState('reliabilityChart', 'ngawur', 'x');
        const box = /** @type {HTMLElement} */ (document.querySelector('[data-chart-state]'));
        expect(box.getAttribute('data-chart-state')).toBe('ngawur');
        expect(/** @type {HTMLElement} */ (box.querySelector('i')).textContent).toBe('show_chart');
    });

    it('tidak melempar saat kanvas tidak ada', () => {
        const ctx = makeCtx();
        expect(() => ctx.setChartState('tidakAda', 'empty', 'x')).not.toThrow();
        expect(() => ctx.clearChartState('tidakAda')).not.toThrow();
    });

    it('clearChartState mengembalikan visibilitas kanvas', () => {
        const ctx = makeCtx();
        ctx.setChartState('reliabilityChart', 'empty', 'x');
        expect(/** @type {HTMLElement} */ (document.getElementById('reliabilityChart')).style.visibility).toBe('hidden');
        ctx.clearChartState('reliabilityChart');
        expect(/** @type {HTMLElement} */ (document.getElementById('reliabilityChart')).style.visibility).toBe('');
        expect(document.querySelector('[data-chart-state]')).toBeNull();
    });
});

describe('renderMTBFMTTRChart', () => {
    const logs = [
        { EquipmentID: 'EQ-1', Tanggal: '2026-09-02', Jenis: 'Breakdown' },
        { EquipmentID: 'EQ-1', Tanggal: '2026-09-10', Jenis: 'Repair' },
        { EquipmentID: 'EQ-1', Tanggal: '2026-10-01', Jenis: 'Breakdown' },
        { EquipmentID: 'EQ-2', Tanggal: '2026-10-01', Jenis: 'Breakdown' },
    ];
    const perf = [
        { equipmentId: 'EQ-1', date: '2026-09-02', wh: 24, bd: 6, freq: 2 },
        { equipmentId: 'EQ-1', date: '2026-10-01', wh: 20, bd: 4, events: ['a', 'b', 'c'] },
    ];

    it('berhenti tanpa filter equipment', async () => {
        const ctx = makeCtx({ mtbfFilterEquip: '', _raw: (x) => x, logs, performanceData: perf });
        stubCanvases(['mtbfChart']);
        await ctx.renderMTBFMTTRChart();
        expect(chartMock.instances.length).toBe(0);
    });

    it('berhenti kalau kanvas tidak ada', async () => {
        const ctx = makeCtx({ mtbfFilterEquip: 'EQ-1', _raw: (x) => x, logs, performanceData: perf });
        stubCanvases([]);
        await ctx.renderMTBFMTTRChart();
        expect(chartMock.instances.length).toBe(0);
    });

    it('berhenti kalau equipment tanpa log', async () => {
        const ctx = makeCtx({ mtbfFilterEquip: 'EQ-9', _raw: (x) => x, logs, performanceData: perf });
        stubCanvases(['mtbfChart']);
        await ctx.renderMTBFMTTRChart();
        expect(chartMock.instances.length).toBe(0);
    });

    it('menghitung MTBF/MTTR per bulan dari log + performance', async () => {
        const ctx = makeCtx({ mtbfFilterEquip: 'EQ-1', _raw: (x) => x, logs, performanceData: perf });
        stubCanvases(['mtbfChart']);
        await ctx.renderMTBFMTTRChart();

        const chart = chartMock.instances[0];
        expect(chart).toBeTruthy();
        expect(chart.config.type).toBe('line');
        expect(chart.config.data.labels).toEqual(['2026-09', '2026-10']);
        // Sep: wh 24 / freq 2 = 12 ; Okt: wh 20 / 3 event = 6.7
        expect(chart.config.data.datasets[0].data).toEqual([12, 6.7]);
        // MTTR hanya dihitung saat ada Repair DAN downtime: Sep 6/2 = 3, Okt tanpa Repair = 0.
        expect(chart.config.data.datasets[1].data).toEqual([3, 0]);
        expect(/** @type {any} */ (window)._appCharts.mtbfChart).toBe(chart);
    });

    it('menghancurkan chart lama sebelum render ulang', async () => {
        const destroy = vi.fn();
        chartMock.Chart.getChart.mockImplementation(() => ({ destroy }));
        const ctx = makeCtx({ mtbfFilterEquip: 'EQ-1', _raw: (x) => x, logs, performanceData: perf });
        stubCanvases(['mtbfChart']);
        await ctx.renderMTBFMTTRChart();
        // Dua kali: guard lokal di renderMTBFMTTRChart + guard di safeCreateChart.
        expect(destroy).toHaveBeenCalledTimes(2);
    });

    it('menangkap error pembacaan data', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({
            mtbfFilterEquip: 'EQ-1',
            _raw: () => {
                throw new Error('state rusak');
            },
            logs,
            performanceData: perf,
        });
        stubCanvases(['mtbfChart']);
        await ctx.renderMTBFMTTRChart();
        expect(err).toHaveBeenCalledWith('MTBF/MTTR chart render failed:', expect.any(Error));
        expect(chartMock.instances.length).toBe(0);
    });
});

describe('renderDashboardCharts', () => {
    const equipment = [
        { EquipmentID: 'EQ-1', Tipe: 'Mechanical' },
        { EquipmentID: 'EQ-2', Tipe: 'Electrical' },
    ];
    const performanceData = [
        { date: '2026-10-01', wh: 24, bd: 4, stb: 2 },
        { date: '2026-10-02', wh: 24, bd: 0, stb: 0 },
    ];
    const logs = [
        { woNumber: 'MTC-001', Status: 'Completed', Tanggal: '2026-10-01' },
        { woNumber: 'MTC-002', Status: 'In Progress', Tanggal: '2026-10-02' },
        { woNumber: 'MTC-003', Status: 'Pending', Tanggal: '2026-10-03' },
    ];
    const pmList = [
        { status: 'completed', date: '2026-09-01' },
        { status: 'cancelled', date: '2026-09-02' },
        { status: 'pending', date: '2020-01-01' },
        { status: 'pending', date: '2099-01-01' },
    ];

    /** @param {Record<string, any>} [over] */
    const base = (over = {}) =>
        makeCtx({
            equipment,
            performanceData,
            logs,
            pmList,
            allParts: [{ Stok: 1, MinStock: 5 }, { Stok: 9, MinStock: 5 }],
            calcCostTrend: () => [{ month: '2026-09', cost: 1500000 }, { month: '2026-10', cost: 2500000 }],
            ...over,
        });

    it('berhenti kalau bukan halaman dashboard', async () => {
        const ctx = base({ currentPage: 'kpi' });
        stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        expect(chartMock.instances.length).toBe(0);
    });

    it('berhenti kalau belum login', async () => {
        const ctx = base({ isLoggedIn: false });
        stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        expect(chartMock.instances.length).toBe(0);
    });

    it('menghancurkan chart sisa (termasuk yang destroy-nya melempar)', async () => {
        /** @type {any} */ (window)._appCharts = {
            a: { destroy: () => { throw new Error('x'); } },
            b: { destroy: vi.fn() },
            c: null,
        };
        const ctx = base({ equipment: [] });
        stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        expect(/** @type {any} */ (window)._appCharts).toEqual({
            status: null, cost: null, downtime: null, reliability: null, woCompletion: null,
        });
    });

    it('tanpa equipment: mengisi dashboardStats dan 4 overlay status', async () => {
        const ctx = base({ equipment: [] });
        const { spy } = stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        expect(ctx.dashboardStats).toEqual({ totalEquip: 0, overduePM: 1, lowStock: 1, totalDowntime: '4.0' });
        // 4 panggilan setChartState → masing-masing memanggil getElementById.
        expect(spy).toHaveBeenCalled();
        expect(chartMock.instances.length).toBe(0);
    });

    it('merender keempat chart dashboard dengan data nyata', async () => {
        const ctx = base();
        stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        expect(scheduled).toBeTruthy();
        await scheduled;

        const byType = chartMock.instances.map((c) => c.config.type);
        expect(byType).toEqual(['line', 'bar', 'doughnut', 'line']);

        const rel = chartMock.instances[0];
        expect(rel.config.data.labels).toEqual(['2026-10-01', '2026-10-02']);
        // (24-4-2)/24*100 = 75 ; (24-0-0)/24*100 = 100
        expect(rel.config.data.datasets[0].data).toEqual(['75.0', '100.0']);

        const pm = chartMock.instances[1];
        expect(pm.config.data.datasets[0].data).toEqual([1, 1, 1, 1]);

        const wo = chartMock.instances[2];
        expect(wo.config.data.datasets[0].data).toEqual([1, 1, 1]);

        const cost = chartMock.instances[3];
        expect(cost.config.data.labels).toEqual(['09', '10']);
        expect(cost.config.data.datasets[0].data).toEqual([1500000, 2500000]);
    });

    it('memakai label kosong saat data PM/WO/cost tidak ada', async () => {
        const ctx = base({
            pmList: [],
            logs: [],
            performanceData: [],
            calcCostTrend: () => [],
        });
        const { spy } = stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        await scheduled;
        expect(chartMock.instances.length).toBe(0);
        expect(spy).toHaveBeenCalled();
    });

    it('menghormati rentang tanggal dashboard saat menghitung WO', async () => {
        const ctx = base({ dashboardDateFrom: '2026-10-02', dashboardDateTo: '2026-10-03' });
        stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        await scheduled;
        const wo = chartMock.instances.find((c) => c.config.type === 'doughnut');
        expect(wo.config.data.datasets[0].data).toEqual([0, 1, 1]);
    });

    it.each([
        ['reliabilityChart', 0],
        ['pmStatusChart', 1],
        ['woCompletionChart', 2],
        ['costTrendChart', 3],
    ])('berhenti di tengah render kalau halaman berpindah (%s)', async (flipId, expectedRendered) => {
        const ctx = base();
        stubCanvases(DASH_CANVASES, (id, seen) => {
            if (id === flipId && seen.get(id) === 2) ctx.currentPage = 'kpi';
        });
        await ctx.renderDashboardCharts();
        await scheduled;
        expect(chartMock.instances.length).toBe(expectedRendered);
    });

    it('retry 5x lalu menyerah kalau kanvas tidak pernah muncul', async () => {
        vi.useFakeTimers();
        try {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const ctx = base();
            stubCanvases([]);
            await ctx.renderDashboardCharts();
            await vi.advanceTimersByTimeAsync(20000);
            await scheduled;
            expect(chartMock.instances.length).toBe(0);
            // setChartState juga tidak menemukan kanvas → tidak melempar.
            expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('Chart destroy'), expect.anything());
        } finally {
            vi.useRealTimers();
        }
    });

    it('menangkap error state (getter melempar)', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = base();
        Object.defineProperty(ctx, 'pmList', {
            get() { throw new Error('state rusak'); },
            configurable: true,
        });
        stubCanvases(DASH_CANVASES);
        await ctx.renderDashboardCharts();
        expect(err).toHaveBeenCalledWith('renderDashboardCharts Error:', expect.any(Error));
    });
});

describe('renderKPICharts', () => {
    const equipment = [
        { EquipmentID: 'EQ-1', Tipe: 'Mechanical' },
        { EquipmentID: 'EQ-2', Tipe: 'Electrical' },
        { EquipmentID: 'EQ-3', Tipe: 'Operational' },
    ];
    const performanceData = [
        { equipmentId: 'EQ-1', date: '2026-09-01', bd: 4, stb: 2, wh: 24, type: 'Scheduled' },
        { equipmentId: 'EQ-1', date: '2026-09-02', bd: 0, stb: 0, wh: 24, type: 'Unscheduled' },
        { EquipmentID: 'EQ-2', date: '2026-10-01', bd: 8, wh: 20, type: 'Scheduled' },
        { equipmentId: 'EQ-3', date: '2026-10-02', bd: 2, wh: 24, type: 'Unscheduled' },
        { date: '2026-10-03', bd: 5, wh: 24, type: 'Scheduled' },
    ];
    const logs = [
        { Tanggal: '2026-09-01', cost: 2000000 },
        { Tanggal: '2026-10-01', cost: 3500000 },
        { Tanggal: '2026-10-02', cost: 500000 },
        { Tanggal: '2026-10-03' },
        { cost: 1000 },
    ];

    const base = (/** @type {Record<string, any>} */ over = {}) =>
        makeCtx({
            currentPage: 'kpi',
            equipment,
            performanceData,
            logs,
            getEquipName: (/** @type {string} */ id) => `Aset ${id}`,
            ...over,
        });

    it('berhenti kalau bukan halaman KPI', async () => {
        const ctx = base({ currentPage: 'dash' });
        stubCanvases(KPI_CANVASES);
        await ctx.renderKPICharts();
        expect(chartMock.instances.length).toBe(0);
    });

    it('merender 9 chart KPI dengan angka dari data nyata', async () => {
        const ctx = base();
        stubCanvases(KPI_CANVASES);
        await ctx.renderKPICharts();

        expect(chartMock.instances.length).toBe(9);
        const charts = /** @type {any} */ (window)._appKpiCharts;
        expect(Object.keys(charts).sort()).toEqual([
            'availabilityChart', 'kpiCostChart', 'kpiFailureType', 'kpiParetoChart',
            'kpiSchedVsUnsched', 'kpiTop5Components', 'mtbfChart', 'mttrChart', 'reliabilityChartKPI',
        ]);

        const mtbf = charts.mtbfChart.config;
        // EQ-1: 2 hari, 1 kegagalan → 48 jam ; EQ-2/EQ-3 hanya 1 titik → dibuang.
        expect(mtbf.data.labels).toEqual(['Aset EQ-1']);
        expect(mtbf.data.datasets[0].data).toEqual([48]);
        expect(mtbf.type).toBe('bar');

        const mttr = charts.mttrChart.config;
        // MTTR diurut menurun: EQ-2 8 jam, EQ-1 4 jam, EQ-3 2 jam.
        expect(mttr.data.labels).toEqual(['Aset EQ-2', 'Aset EQ-1', 'Aset EQ-3']);
        expect(mttr.data.datasets[0].data).toEqual([8, 4, 2]);

        const avail = charts.availabilityChart.config;
        expect(avail.data.labels).toEqual(['09', '10']);
        // Sep: (48-6)/48 = 87.5 → 88 ; Okt: (68-15)/68 = 77.9 → 78
        expect(avail.data.datasets[0].data).toEqual([88, 78]);

        const top5 = charts.kpiTop5Components.config;
        expect(top5.data.labels[0]).toBe('Aset EQ-2');

        const sched = charts.kpiSchedVsUnsched.config;
        expect(sched.data.datasets[0].data).toEqual([3, 2]);

        const failure = charts.kpiFailureType.config;
        expect(failure.data.datasets[0].data).toEqual([2, 1, 1]);

        const cost = charts.kpiCostChart.config;
        expect(cost.data.labels).toEqual(['09', '10']);
        expect(cost.data.datasets[0].data).toEqual([2, 4]);

        const pareto = charts.kpiParetoChart.config;
        expect(pareto.data.datasets[1].data.slice(-1)).toEqual([100]);
    });

    it('memakai label fallback saat data kosong', async () => {
        const ctx = base({ performanceData: [], logs: [], equipment: [] });
        stubCanvases(KPI_CANVASES);
        await ctx.renderKPICharts();

        const charts = /** @type {any} */ (window)._appKpiCharts;
        expect(chartMock.instances.length).toBe(9);
        expect(charts.mtbfChart.config.data.labels).toEqual(['No Data']);
        expect(charts.mttrChart.config.data.labels).toEqual(['No Data']);
        expect(charts.kpiTop5Components.config.data.labels).toEqual(['No Components']);
        expect(charts.kpiParetoChart.config.data.labels).toEqual(['No data']);
        expect(charts.kpiCostChart.config.data.labels).toEqual(['-']);
        expect(charts.kpiCostChart.config.data.datasets[0].data).toEqual([0]);
        expect(charts.kpiFailureType.config.data.datasets[0].data).toEqual([0, 0, 0]);
    });

    it('melewati chart yang kanvasnya tidak muncul (retry 10x)', async () => {
        vi.useFakeTimers();
        try {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const ctx = base();
            stubCanvases(['mtbfChart']);
            const p = ctx.renderKPICharts();
            await vi.advanceTimersByTimeAsync(120000);
            await p;
            expect(chartMock.instances.length).toBe(1);
            expect(warn).toHaveBeenCalledWith('[KPI] Canvas not found:', 'mttrChart');
        } finally {
            vi.useRealTimers();
        }
    });

    it('menangkap error dan memberi notifikasi', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = base();
        Object.defineProperty(ctx, 'logs', {
            get() { throw new Error('state rusak'); },
            configurable: true,
        });
        stubCanvases(KPI_CANVASES);
        await ctx.renderKPICharts();
        expect(err).toHaveBeenCalledWith('renderKPICharts Error:', expect.any(Error));
        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to render KPI charts', 'error');
    });
});

describe('renderEnterpriseCharts', () => {
    const base = (/** @type {Record<string, any>} */ over = {}) =>
        makeCtx({
            currentPage: 'enterprise',
            calcHealthDist: () => ({ excellent: 2, good: 3, warning: 1, critical: 0 }),
            calcWOStatus: () => ({ completed: 4, inProgress: 2, waitingMaterial: 1, pending: 3, cancelled: 1 }),
            calcPMTrend: () => [{ month: '2026-09', pct: 90 }, { month: '2026-10', pct: 75 }],
            calcDowntimeTrend: () => [{ month: '2026-09', hours: 12 }, { month: '2026-10', hours: 5 }],
            calcCostTrend: () => [{ month: '2026-09', cost: 3000000 }],
            calcInventoryABC: () => [
                { category: 'A' }, { category: 'A' }, { category: 'B' }, { category: 'C' },
            ],
            ...over,
        });

    it('berhenti kalau bukan halaman enterprise', async () => {
        const ctx = base({ currentPage: 'dash' });
        stubCanvases(ENT_CANVASES);
        await ctx.renderEnterpriseCharts();
        expect(chartMock.instances.length).toBe(0);
    });

    it('merender 6 chart enterprise dengan tooltip bertoken', async () => {
        const ctx = base();
        stubCanvases(ENT_CANVASES);
        await ctx.renderEnterpriseCharts();

        const charts = /** @type {any} */ (window)._appCharts;
        expect(Object.keys(charts).sort()).toEqual([
            'abcChart', 'costTrend', 'downtimeTrend', 'eHealth', 'pmTrend', 'woStatus',
        ]);
        expect(charts.eHealth.config.data.datasets[0].data).toEqual([2, 3, 1, 0]);
        expect(charts.woStatus.config.data.datasets[0].data).toEqual([4, 2, 1, 3, 1]);
        expect(charts.pmTrend.config.data.datasets[0].data).toEqual([90, 75]);
        expect(charts.downtimeTrend.config.data.datasets[0].data).toEqual([12, 5]);
        expect(charts.costTrend.config.data.datasets[0].data).toEqual([3000000]);
        expect(charts.abcChart.config.data.datasets[0].data).toEqual([2, 1, 1]);

        const tooltip = charts.eHealth.config.options.plugins.tooltip;
        expect(tooltip.borderWidth).toBe(1);
        expect(tooltip.cornerRadius).toBe(10);
        expect(tooltip.titleFont.weight).toBe('700');
        expect(typeof tooltip.backgroundColor).toBe('string');
    });

    it('memakai nilai netral saat semua kalkulasi kosong', async () => {
        const ctx = base({
            calcHealthDist: () => ({ excellent: 0, good: 0, warning: 0, critical: 0 }),
            calcWOStatus: () => ({ completed: 0, inProgress: 0, waitingMaterial: 0, pending: 0, cancelled: 0 }),
            calcPMTrend: () => [],
            calcDowntimeTrend: () => [],
            calcCostTrend: () => [],
            calcInventoryABC: () => [],
        });
        stubCanvases(ENT_CANVASES);
        await ctx.renderEnterpriseCharts();

        const charts = /** @type {any} */ (window)._appCharts;
        expect(charts.eHealth.config.data.datasets[0].data).toEqual([1]);
        expect(charts.woStatus.config.data.datasets[0].data).toEqual([1]);
        expect(charts.pmTrend.config.data.labels).toEqual(['-']);
        expect(charts.downtimeTrend.config.data.labels).toEqual(['-']);
        expect(charts.costTrend.config.data.labels).toEqual(['-']);
        // a||1, b||1, c||1 → ketiganya 1 walau kosong.
        expect(charts.abcChart.config.data.datasets[0].data).toEqual([1, 1, 1]);
    });

    it('menghancurkan chart lama, termasuk yang destroy-nya melempar', async () => {
        const destroyWo = vi.fn();
        const destroyAbc = vi.fn();
        const prev = {
            eHealth: { destroy: () => { throw new Error('x'); } },
            woStatus: { destroy: destroyWo },
            pmTrend: { destroy: vi.fn() },
            downtimeTrend: { destroy: vi.fn() },
            costTrend: { destroy: vi.fn() },
            abcChart: { destroy: destroyAbc },
        };
        /** @type {any} */ (window)._appCharts = prev;
        const ctx = base();
        stubCanvases(ENT_CANVASES);
        await ctx.renderEnterpriseCharts();
        // `destroy` yang melempar ditelan; yang normal tetap dipanggil sebelum diganti.
        expect(destroyWo).toHaveBeenCalled();
        expect(destroyAbc).toHaveBeenCalled();
        expect(/** @type {any} */ (window)._appCharts.eHealth).toBeInstanceOf(chartMock.Chart);
    });

    it('melewati kanvas yang tidak muncul tanpa melempar', async () => {
        vi.useFakeTimers();
        try {
            const ctx = base();
            stubCanvases([]);
            const p = ctx.renderEnterpriseCharts();
            await vi.advanceTimersByTimeAsync(10000);
            await p;
            expect(chartMock.instances.length).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
});
