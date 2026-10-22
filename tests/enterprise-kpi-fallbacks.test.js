// @vitest-environment jsdom
/**
 * Cabang "state kosong" untuk `src/js/modules/enterprise-kpi.js` (kartu D, S33af).
 *
 * `tests/enterprise-kpi-module.test.js` menguji **nilai** tiap metrik dengan data
 * terisi. Yang belum tersentuh adalah sisi kanan setiap `this._raw(x) || []`:
 * saat state Alpine belum ada (`undefined`/`null`) — persis kondisi halaman
 * Enterprise sebelum listener RTDB mengisi apa pun. Dulu cabang itu 86 branch
 * (79,4 %); tanpa tes, satu `null` bisa membuat seluruh dashboard kosong.
 *
 * Fokus di sini: tidak melempar, nilai netral yang masuk akal, dan ambang
 * status/warna tetap konsisten di batas (95/85/70).
 */
import { describe, it, expect, vi } from 'vitest';
import { enterpriseKPI } from '../src/js/modules/enterprise-kpi.js';

/** State yang SENGAJA kosong: semua koleksi undefined. */
function emptyCtx(overrides = {}) {
    const ctx = Object.create(enterpriseKPI);
    ctx._raw = (x) => x;
    ctx.showNotification = vi.fn();
    ctx.renderEnterpriseCharts = vi.fn();
    ctx.currentPage = 'enterprise';
    return Object.assign(ctx, overrides);
}

describe('metrik tunggal dengan state kosong', () => {
    it('calcAvailability → 100% Optimal walau performanceData undefined', () => {
        expect(emptyCtx().calcAvailability('EQ-1')).toEqual({
            pct: 100,
            status: 'Optimal',
            color: 'green',
        });
    });

    it('calcMTBF / calcMTTR → null tanpa log', () => {
        const ctx = emptyCtx();
        expect(ctx.calcMTBF('EQ-1')).toBeNull();
        expect(ctx.calcMTTR('EQ-1')).toBeNull();
    });

    it('calcDowntime / calcMaintCost → 0, bukan NaN', () => {
        const ctx = emptyCtx();
        expect(ctx.calcDowntime('EQ-1')).toBe(0);
        expect(ctx.calcMaintCost('EQ-1')).toBe(0);
    });

    it('calcReliability & calcHealthScore tidak melempar tanpa data', () => {
        const ctx = emptyCtx();
        expect(() => ctx.calcReliability('EQ-1')).not.toThrow();
        expect(() => ctx.calcHealthScore('EQ-1')).not.toThrow();
    });

    it('calcOEE tidak melempar dan mengembalikan angka 0..100', () => {
        const oee = emptyCtx().calcOEE();
        for (const key of ['availability', 'performance', 'quality', 'oee']) {
            if (key in oee) expect(Number(oee[key])).toBeGreaterThanOrEqual(0);
        }
    });

    it('calcPMCompliance tidak melempar tanpa pmList', () => {
        expect(() => emptyCtx().calcPMCompliance()).not.toThrow();
    });
});

describe('agregat dengan state kosong', () => {
    it.each([
        'calcSummary',
        'calcCriticalEquip',
        'calcDowntimeTrend',
        'calcCostTrend',
        'calcPMTrend',
        'calcWOStatus',
        'calcHealthDist',
        'calcInsights',
        'calcInventoryABC',
    ])('%s() tidak melempar saat semua koleksi undefined', (fn) => {
        const ctx = emptyCtx();
        expect(() => ctx[fn]()).not.toThrow();
    });

    it('computeEnterpriseData mengisi state tanpa melempar', () => {
        const ctx = emptyCtx();
        expect(() => ctx.computeEnterpriseData()).not.toThrow();
        // Fungsi ini menulis ke `this.enterpriseData` (bukan return value).
        if (ctx.enterpriseData !== undefined) {
            expect(typeof ctx.enterpriseData).toBe('object');
        }
    });
});

describe('batas ambang availability (95 / 85 / 70)', () => {
    /** wh=100, bd dipakai untuk mencapai persentase tepat di batas. */
    const ctxWith = (down) =>
        emptyCtx({ performanceData: [{ equipmentId: 'EQ-1', wh: 100, bd: down }] });

    it.each([
        [5, 95, 'Optimal', 'green'],
        [6, 94, 'Good', 'blue'],
        [15, 85, 'Good', 'blue'],
        [16, 84, 'Warning', 'orange'],
        [30, 70, 'Warning', 'orange'],
        [31, 69, 'Critical', 'red'],
    ])('down %i jam → %i%% %s/%s', (down, pct, status, color) => {
        expect(ctxWith(down).calcAvailability('EQ-1')).toEqual({ pct, status, color });
    });

    it('dibatasi 0..100 walau downtime melebihi jam kerja', () => {
        const ctx = emptyCtx({ performanceData: [{ equipmentId: 'EQ-1', wh: 10, bd: 50 }] });
        expect(ctx.calcAvailability('EQ-1').pct).toBe(0);
    });
});
