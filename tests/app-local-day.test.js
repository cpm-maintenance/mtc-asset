// @vitest-environment jsdom
/**
 * Satu kelas cacat: "hari ini" diambil lewat `toISOString()` (UTC), padahal
 * dibandingkan dengan tanggal ber-semantik **lokal** (dueDate WO, `pm.date`,
 * input tanggal operator). Di WIB (UTC+8) itu salah pada 00:00–08:00 — tepat
 * jendela waktu shift pagi, saat dashboard pertama dibuka.
 *
 * Tes di bawah memakai jam 01:00 waktu lokal supaya pergeseran UTC/lokal
 * terlihat; kalau dijalankan di zona barat UTC, tanggal UTC = tanggal lokal
 * dan tesnya tetap hijau (tidak salah lapor).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

const EARLY = new Date(2026, 9, 18, 1, 0, 0); // 18 Okt 2026, 01:00 waktu lokal
const localISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = localISO(EARLY);
const YESTERDAY = localISO(new Date(2026, 9, 17));
const WEEK_AGO = localISO(new Date(2026, 9, 11));

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(EARLY);
    stubFirebase();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('MTC-Asset — hari kalender lokal, bukan UTC (S45j)', () => {
    it('dashAlerts menghitung PM overdue dengan hari lokal', () => {
        const a = makeApp({
            pmList: [{ pmId: 'PM-1', status: 'pending', date: YESTERDAY }],
            allParts: [],
        });
        expect(a.dashAlerts.overduePM).toBe(1);
    });

    it('pmStatusTac memberi badge OVERDUE menurut hari lokal', () => {
        const a = makeApp();
        expect(a.pmStatusTac({ status: 'pending', date: YESTERDAY }).label).toBe('OVERDUE');
    });

    it('planningKpi menghitung WO overdue dengan hari lokal', () => {
        const a = makeApp({
            logs: [
                {
                    LogID: '1',
                    woNumber: 'WO-1',
                    Status: 'Pending',
                    dueDate: YESTERDAY,
                    estimatedHours: 2,
                    assignedTo: 'Andi',
                },
            ],
        });
        expect(a.planningKpi.overdue).toBe(1);
    });

    it('woKpi menghitung WO overdue dengan hari lokal', () => {
        const a = makeApp({
            logs: [
                {
                    LogID: '1',
                    woNumber: 'WO-1',
                    Status: 'Pending',
                    dueDate: YESTERDAY,
                    Jenis: 'Corrective',
                    Downtime: 0,
                },
            ],
            allParts: [],
        });
        expect(a.woKpi.overdue).toBe(1);
    });

    it('setDashboardPreset menutup rentang di hari lokal', () => {
        const a = makeApp();
        a.setDashboardPreset(7);
        expect(a.dashboardDateTo).toBe(TODAY);
        expect(a.dashboardDateFrom).toBe(WEEK_AGO);
    });

    it('default dashboardDateTo/From memakai hari lokal', () => {
        const a = makeApp();
        expect(a.dashboardDateTo).toBe(TODAY);
        expect(a.dashboardDateFrom).toBe(WEEK_AGO);
    });
});
