// @vitest-environment jsdom
/**
 * S38: cabang yang masih mati di `src/js/bootstrap.js`.
 *
 * Harness sama dengan `tests/bootstrap-module.test.js` — `init()` menyentuh
 * banyak permukaan global, jadi handler dan watcher dipanggil manual dari sini.
 * Fokus: pesan error kosong, rantai `&&` watcher `logs`, fallback wadah chart
 * yang belum ada, dan watcher filter/modal yang belum pernah dipicu.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootstrapModule } from '../src/js/bootstrap.js';

function makeCtx(overrides = {}) {
    const ctx = Object.create(bootstrapModule);
    return Object.assign(ctx, {
        isLoggedIn: false,
        user: null,
        isLoading: true,
        isOnline: true,
        currentPage: 'dash',
        equipment: [],
        logs: [],
        performanceData: [],
        menuItems: [],
        userRole: 'user',
        modalsLoaded: false,
        chartLoaded: false,
        showNotification: vi.fn(),
        applyTheme: vi.fn(),
        loadAISettings: vi.fn(),
        loadPMSchedule: vi.fn(),
        setupFirebaseListeners: vi.fn(),
        setupRequisitionsListener: vi.fn(),
        checkUserRole: vi.fn(),
        computeEnterpriseData: vi.fn(),
        renderDashboardCharts: vi.fn(),
        renderKPICharts: vi.fn(),
        renderEnterpriseCharts: vi.fn(),
        handleError: vi.fn(),
        canAccess: vi.fn(() => true),
        $watch: vi.fn(),
        ...overrides,
    });
}

let listeners;

function stubWindow() {
    listeners = {};
    window.addEventListener = vi.fn((type, fn) => {
        (listeners[type] ||= []).push(fn);
    });
    window.auth = { name: 'auth' };
    window.onAuthStateChanged = vi.fn();
    window.Sentry = { setUser: vi.fn() };
    window.notificationAPI = { checkAllNotifications: vi.fn() };
    window._appCharts = {};
    window._appKpiCharts = {};
    window.db = { name: 'db' };
    window.ref = vi.fn((_db, path) => ({ path }));
    window.get = vi.fn(async () => ({ exists: () => false, val: () => null }));
}

function watchers(ctx) {
    return Object.fromEntries(ctx.$watch.mock.calls.map(([key, fn]) => [key, fn]));
}

beforeEach(() => {
    vi.useFakeTimers();
    stubWindow();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.auth;
    delete window.onAuthStateChanged;
    delete window.Sentry;
    delete window.notificationAPI;
    delete window._appCharts;
    delete window._appKpiCharts;
    delete window.db;
    delete window.ref;
    delete window.get;
    delete window.__loadNotifications;
});

describe('bootstrap.js — handler global', () => {
    it('menerima error tanpa pesan tanpa memicu notifikasi', () => {
        const ctx = makeCtx();
        ctx.init();

        listeners.error[0]({ message: undefined, preventDefault: vi.fn() });

        expect(ctx.showNotification).not.toHaveBeenCalled();
    });
});

describe('bootstrap.js — watcher logs', () => {
    it('hanya menjadwalkan chart saat halaman dash dan log terisi', () => {
        const ctx = makeCtx({ currentPage: 'dash' });
        ctx.init();
        const w = watchers(ctx);

        w.logs(); // logs kosong
        ctx.logs = null;
        w.logs(); // logs null
        ctx.logs = [{ LogID: 'L1' }];
        w.logs(); // rantai penuh
        vi.advanceTimersByTime(500);

        expect(ctx.renderDashboardCharts).toHaveBeenCalledOnce();
        expect(ctx.chartLoaded).toBe(true);
    });
});

describe('bootstrap.js — guard navigasi', () => {
    it('kembali ke dash saat halaman terlarang dibuka dari state kosong', () => {
        const ctx = makeCtx({
            menuItems: [{ id: 'admin', allowedRole: 'admin' }],
            canAccess: vi.fn(() => false),
        });
        ctx.init();

        watchers(ctx).currentPage('admin', undefined);

        expect(ctx.showNotification).toHaveBeenCalledWith('Access denied', 'error');
        expect(ctx.currentPage).toBe('dash');
    });
});

describe('bootstrap.js — pembersihan chart', () => {
    it('membersihkan chart dashboard walau wadah belum pernah dibuat', () => {
        delete window._appCharts;
        const ctx = makeCtx();
        ctx.init();

        expect(() => watchers(ctx).currentPage('logs', 'dash')).not.toThrow();
        expect(window._appCharts).toEqual({
            status: null,
            cost: null,
            downtime: null,
            reliability: null,
        });
    });

    it('membuat wadah chart KPI baru walau belum ada', () => {
        delete window._appKpiCharts;
        const ctx = makeCtx();
        ctx.init();

        watchers(ctx).currentPage('logs', 'kpi');

        expect(window._appKpiCharts).toEqual({
            paVsActual: null,
            top5Events: null,
            top5Components: null,
            schedVsUnsched: null,
            mechVsElec: null,
            areaPa: null,
            paretoRCA: null,
        });
    });

    it('melewati entri chart KPI yang null', () => {
        window._appKpiCharts = { paVsActual: null, dead: null };
        const ctx = makeCtx();
        ctx.init();

        expect(() => watchers(ctx).currentPage('logs', 'kpi')).not.toThrow();
    });

    it('membersihkan chart enterprise tanpa melempar saat wadah kosong', () => {
        const ctx = makeCtx();
        ctx.init();
        const w = watchers(ctx);

        delete window._appCharts;
        expect(() => w.currentPage('logs', 'dash')).not.toThrow();
        // blok `oldVal === 'dash'` membuat wadah baru
        expect(window._appCharts).toEqual({
            status: null,
            cost: null,
            downtime: null,
            reliability: null,
        });
        // wadah ada tapi setiap kuncinya kosong → cabang `_appCharts[k]` false
        window._appCharts = {};
        expect(() => w.currentPage('logs', 'enterprise')).not.toThrow();

        // meninggalkan halaman enterprise saat wadah belum ada → cabang kiri false
        delete window._appCharts;
        expect(() => w.currentPage('logs', 'enterprise')).not.toThrow();
    });
});

describe('bootstrap.js — watcher filter & modal', () => {
    it('menjadwalkan chart KPI dari filter, tanggal, dan data performa', () => {
        const ctx = makeCtx({ currentPage: 'kpi' });
        ctx.init();
        const w = watchers(ctx);

        w.kpiFilter();
        w.kpiFilterDate();
        w.performanceData();
        vi.advanceTimersByTime(500);

        // debounce: tiga pemicu, satu render
        expect(ctx.renderKPICharts).toHaveBeenCalledOnce();
    });

    it('tidak menjadwalkan chart KPI saat halaman aktif bukan kpi', () => {
        const ctx = makeCtx({ currentPage: 'logs' });
        ctx.init();
        const w = watchers(ctx);

        w.kpiFilter();
        w.kpiFilterDate();
        w.performanceData();
        vi.advanceTimersByTime(500);

        expect(ctx.renderKPICharts).not.toHaveBeenCalled();
    });

    it('memuat CSS modal untuk setiap modal yang dibuka', () => {
        const ctx = makeCtx();
        ctx.init();
        const w = watchers(ctx);

        w.showPartModal(true);
        w.showLogModal(true);
        w.showPerformanceModal(true);

        expect(ctx.modalsLoaded).toBe(true);
    });

    it('tidak memuat CSS modal saat modal ditutup', () => {
        const ctx = makeCtx();
        ctx.init();
        const w = watchers(ctx);

        w.showPartModal(false);
        w.showLogModal(false);
        w.showPerformanceModal(false);

        expect(ctx.modalsLoaded).toBe(false);
    });
});

describe('bootstrap.js — onUser', () => {
    it('tidak memanggil loader notifikasi bila belum tersedia', async () => {
        delete window.__loadNotifications;
        const ctx = makeCtx();
        ctx.init();

        await ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' });

        expect(window.notificationAPI.checkAllNotifications).not.toHaveBeenCalled();
        expect(ctx.isLoggedIn).toBe(true);
    });

    it('memuat modul notifikasi tanpa menunggu dan menelan kegagalannya', async () => {
        window.__loadNotifications = vi.fn(() => Promise.reject(new Error('chunk gagal')));
        const ctx = makeCtx();
        ctx.init();

        await ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' });

        expect(window.__loadNotifications).toHaveBeenCalledOnce();
        expect(ctx.isLoggedIn).toBe(true);
    });
});
