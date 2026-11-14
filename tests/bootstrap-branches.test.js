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

const auditMock = vi.hoisted(() => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('../src/js/modules/audit.js', () => auditMock);

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
        renderKPICharts: vi.fn(),
        renderEnterpriseCharts: vi.fn(),
        loadAuditLogs: vi.fn(),
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
    auditMock.logAudit.mockClear();
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
        // wadah ada tapi setiap kuncinya kosong → cabang `_appCharts[k]` false
        window._appCharts = {};
        expect(() => w.currentPage('logs', 'enterprise')).not.toThrow();

        // meninggalkan halaman enterprise saat wadah belum ada → cabang kiri false
        delete window._appCharts;
        expect(() => w.currentPage('logs', 'enterprise')).not.toThrow();
    });

    it('memuat log audit otomatis saat halaman audit dibuka', () => {
        const ctx = makeCtx();
        ctx.init();
        const w = watchers(ctx);

        w.currentPage('audit', 'dash');
        expect(ctx.loadAuditLogs).toHaveBeenCalledTimes(1);

        // halaman lain tidak ikut memicu fetch
        w.currentPage('logs', 'audit');
        expect(ctx.loadAuditLogs).toHaveBeenCalledTimes(1);
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
    it('mencatat "Login" SEKALI saat sesi pertama jadi aktif', async () => {
        const ctx = makeCtx();
        ctx.init();

        await ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' });

        expect(auditMock.logAudit).toHaveBeenCalledTimes(1);
        expect(auditMock.logAudit).toHaveBeenCalledWith('Login');
    });

    it('tidak mencatat "Login" kedua saat listener auth terpicu ulang (refresh token)', async () => {
        const ctx = makeCtx();
        ctx.init();

        await ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' });
        await ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' });

        expect(auditMock.logAudit).toHaveBeenCalledTimes(1);
    });

    it('mencatat "Login" lagi setelah sesi berakhir (logout → login)', async () => {
        const ctx = makeCtx();
        ctx.init();

        await ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' });
        ctx.isLoggedIn = false; // `main.js` mereset ini lewat cabang `!user`
        await ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' });

        expect(auditMock.logAudit).toHaveBeenCalledTimes(2);
    });

    it('kegagalan load modul audit tidak menjatuhkan boot', async () => {
        const ctx = makeCtx();
        ctx.init();

        await expect(ctx.onUser({ uid: 'u1', email: 'operator@cpm.co.id' })).resolves.toBeUndefined();
        expect(ctx.isLoggedIn).toBe(true);
    });

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
