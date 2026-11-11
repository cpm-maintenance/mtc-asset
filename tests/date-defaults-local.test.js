// @vitest-environment jsdom
/**
 * Tanggal default form (D12) — kelas cacat yang sama dengan `app-local-day.test.js`:
 * nilai awal `date`/`requestDate`/`dueDate` diambil lewat `toISOString()` (UTC)
 * lalu dibandingkan dengan tanggal ber-semantik lokal (`pm.date`, `dueDate` WO,
 * input operator). Di WIB (UTC+8) itu menggeser satu hari pada 00:00–08:00 —
 * tepat saat shift pagi membuka form. Jam 01:00 lokal dipakai supaya
 * pergeserannya terlihat; di zona barat UTC tesnya tetap hijau (tidak salah lapor).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_DUE_DATE, DEFAULT_LOG_FORM, DEFAULT_PERF_FORM, DEFAULT_PM_FORM } from '../src/js/constants.ts';
import { performanceModule } from '../src/js/modules/performance.js';

const EARLY = new Date(2026, 9, 18, 1, 0, 0); // 18 Okt 2026, 01:00 waktu lokal
const localISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = localISO(EARLY);
const IN_7_DAYS = localISO(new Date(2026, 9, 25, 1, 0, 0));

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(EARLY);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('tanggal default form memakai hari kalender lokal (D12)', () => {
    it('DEFAULT_LOG_FORM: date & requestDate = hari ini lokal', () => {
        const form = DEFAULT_LOG_FORM();
        expect(form.date).toBe(TODAY);
        expect(form.requestDate).toBe(TODAY);
    });

    it('DEFAULT_DUE_DATE = hari ini + 7 hari lokal', () => {
        expect(DEFAULT_DUE_DATE()).toBe(IN_7_DAYS);
        expect(DEFAULT_LOG_FORM().dueDate).toBe(IN_7_DAYS);
    });

    it('DEFAULT_PERF_FORM & DEFAULT_PM_FORM memakai hari ini lokal', () => {
        expect(DEFAULT_PERF_FORM().date).toBe(TODAY);
        expect(DEFAULT_PM_FORM().date).toBe(TODAY);
    });

    it('openPerformanceModal mengisi tanggal lokal, bukan UTC', () => {
        const ctx = Object.assign(Object.create(performanceModule), {
            performanceForm: null,
            isEditingPerformance: false,
            showPerformanceModal: false,
        });
        ctx.openPerformanceModal();
        expect(ctx.performanceForm.date).toBe(TODAY);
    });
});
