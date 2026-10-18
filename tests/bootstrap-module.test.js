// @vitest-environment jsdom
/**
 * Unit test bootstrap/router: src/js/bootstrap.js
 *
 * `init()` menyentuh banyak permukaan global (error handler, auth state, $watch,
 * timer debounce), jadi semuanya di-stub dan handler-nya dipanggil manual.
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
let authCallback;

function stubWindow() {
    listeners = {};
    authCallback = null;
    window.addEventListener = vi.fn((type, fn) => {
        (listeners[type] ||= []).push(fn);
    });
    window.auth = { name: 'auth' };
    window.onAuthStateChanged = vi.fn((_auth, cb) => {
        authCallback = cb;
    });
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
});

describe('bootstrapModule.init — wiring', () => {
    it('registers the global error, rejection and connectivity handlers', () => {
        const ctx = makeCtx();
        ctx.init();
        expect(Object.keys(listeners).sort()).toEqual([
            'error',
            'offline',
            'online',
            'unhandledrejection',
        ]);
        expect(window.onAuthStateChanged).toHaveBeenCalledWith(window.auth, expect.any(Function));
        expect(ctx.applyTheme).toHaveBeenCalledOnce();
        expect(ctx.loadAISettings).toHaveBeenCalledOnce();
    });

    it('registers every watcher used by the dashboard and modals', () => {
        const ctx = makeCtx();
        ctx.init();
        expect(ctx.$watch.mock.calls.map((c) => c[0])).toEqual([
            'equipment',
            'logs',
            'currentPage',
            'kpiFilter',
            'kpiFilterDate',
            'performanceData',
            'showEquipModal',
            'showPartModal',
            'showLogModal',
            'showPerformanceModal',
        ]);
    });

    it('routes a throwing wiring into handleError', () => {
        const ctx = makeCtx();
        window.addEventListener = vi.fn(() => {
            throw new Error('boom');
        });
        ctx.init();
        expect(ctx.handleError).toHaveBeenCalledWith(expect.any(Error), 'App Init');
    });

    it('toggles isOnline from the browser connectivity events', () => {
        const ctx = makeCtx();
        ctx.init();
        listeners.offline[0]();
        expect(ctx.isOnline).toBe(false);
        listeners.online[0]();
        expect(ctx.isOnline).toBe(true);
    });
});

describe('bootstrapModule.init — global error handlers', () => {
    it('swallows JSON parse errors', () => {
        const ctx = makeCtx();
        ctx.init();
        const event = { message: 'Unexpected token JSON', preventDefault: vi.fn() };
        listeners.error[0](event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(console.warn).toHaveBeenCalledWith(
            'JSON parse error intercepted:',
            'Unexpected token JSON'
        );
        expect(ctx.showNotification).not.toHaveBeenCalled();
    });

    it('warns about Alpine reactivity problems', () => {
        const ctx = makeCtx();
        ctx.init();
        listeners.error[0]({ message: 'Alpine proxy cannot clone', preventDefault: vi.fn() });
        expect(console.warn).toHaveBeenCalledWith(
            'Alpine reactivity issue:',
            'Alpine proxy cannot clone'
        );
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Data sync issue detected, refreshing...',
            'warning'
        );
    });

    it('ignores unrelated runtime errors', () => {
        const ctx = makeCtx();
        ctx.init();
        listeners.error[0]({ message: 'Something else', preventDefault: vi.fn() });
        expect(ctx.showNotification).not.toHaveBeenCalled();
    });

    it('handles unhandled rejections: JSON string, proxy message, plain reason', () => {
        const ctx = makeCtx();
        ctx.init();

        const jsonEvent = { reason: 'bad JSON payload', preventDefault: vi.fn() };
        listeners.unhandledrejection[0](jsonEvent);
        expect(jsonEvent.preventDefault).toHaveBeenCalledOnce();

        listeners.unhandledrejection[0]({ reason: new Error('cannot clone proxy') });
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Data sync issue, please refresh',
            'warning'
        );

        listeners.unhandledrejection[0]({ reason: 'network down' });
        expect(console.error).toHaveBeenCalledWith('Unhandled rejection:', 'network down');
    });
});

describe('bootstrapModule.init — auth state', () => {
    it('clears the session when the user signs out', () => {
        const ctx = makeCtx({ isLoggedIn: true, user: { uid: 'x' }, isLoading: true });
        ctx.init();
        authCallback(null);
        expect(ctx.isLoggedIn).toBe(false);
        expect(ctx.user).toBeNull();
        expect(ctx.isLoading).toBe(false);
    });

    it('hydrates every store and schedules the notification sweep on login', () => {
        const ctx = makeCtx();
        ctx.init();
        authCallback({ uid: 'uid-1', email: 'a@b.c' });

        expect(ctx.isLoggedIn).toBe(true);
        expect(ctx.user).toEqual({ uid: 'uid-1', email: 'a@b.c' });
        expect(window.Sentry.setUser).toHaveBeenCalledWith({ id: 'uid-1', email: 'a@b.c' });
        expect(ctx.checkUserRole).toHaveBeenCalledWith('uid-1');
        expect(ctx.setupFirebaseListeners).toHaveBeenCalledOnce();
        expect(ctx.loadPMSchedule).toHaveBeenCalledOnce();
        expect(ctx.setupRequisitionsListener).toHaveBeenCalledOnce();

        vi.advanceTimersByTime(3000);
        vi.advanceTimersByTime(6000);
        expect(window.notificationAPI.checkAllNotifications).toHaveBeenCalledOnce();
    });

    it('works without Sentry or the notification API', () => {
        delete window.Sentry;
        delete window.notificationAPI;
        const ctx = makeCtx();
        ctx.init();
        expect(() => authCallback({ uid: 'uid-2' })).not.toThrow();
        expect(() => vi.advanceTimersByTime(9000)).not.toThrow();
    });
});

describe('bootstrapModule watchers', () => {
    it('debounces the dashboard render for equipment/logs on the dashboard', () => {
        const ctx = makeCtx({ currentPage: 'dash', equipment: [{ EquipmentID: 'EQ1' }] });
        ctx.init();
        const w = watchers(ctx);

        w.equipment();
        vi.advanceTimersByTime(500);
        expect(ctx.chartLoaded).toBe(true);
        expect(ctx.renderDashboardCharts).toHaveBeenCalledOnce();

        ctx.currentPage = 'kpi';
        w.logs();
        vi.advanceTimersByTime(500);
        expect(ctx.renderDashboardCharts).toHaveBeenCalledOnce(); // halaman bukan dash

        ctx.currentPage = 'dash';
        ctx.equipment = [];
        w.equipment();
        vi.advanceTimersByTime(500);
        expect(ctx.renderDashboardCharts).toHaveBeenCalledOnce(); // data kosong
    });

    it('debounces the KPI render for the three KPI watchers', () => {
        const ctx = makeCtx({ currentPage: 'kpi' });
        ctx.init();
        const w = watchers(ctx);

        w.kpiFilter();
        vi.advanceTimersByTime(500);
        w.kpiFilterDate();
        vi.advanceTimersByTime(500);
        w.performanceData();
        vi.advanceTimersByTime(500);
        expect(ctx.renderKPICharts).toHaveBeenCalledTimes(3);

        ctx.currentPage = 'dash';
        w.kpiFilter();
        vi.advanceTimersByTime(500);
        expect(ctx.renderKPICharts).toHaveBeenCalledTimes(3);
    });

    it('lazy-loads modal styles only when a modal opens', () => {
        const ctx = makeCtx();
        const load = vi.spyOn(ctx, 'loadModalsCSS');
        ctx.init();
        const w = watchers(ctx);

        w.showEquipModal(false);
        expect(load).not.toHaveBeenCalled();
        w.showEquipModal(true);
        w.showPartModal(true);
        w.showLogModal(true);
        w.showPerformanceModal(true);
        expect(load).toHaveBeenCalledTimes(4);
    });

    it('blocks navigation to a restricted page', () => {
        const ctx = makeCtx({
            menuItems: [{ id: 'kpi' }],
            canAccess: vi.fn(() => false),
            currentPage: 'kpi',
        });
        ctx.init();
        const nav = watchers(ctx).currentPage;

        nav('kpi', 'dash');
        expect(console.warn).toHaveBeenCalledWith('[Access] Blocked direct navigation to', 'kpi');
        expect(ctx.showNotification).toHaveBeenCalledWith('Access denied', 'error');
        expect(ctx.currentPage).toBe('dash');
    });

    it('destroys dashboard charts when leaving the dashboard', () => {
        const destroy = vi.fn();
        window._appCharts = { status: { destroy }, cost: null };
        const ctx = makeCtx();
        ctx.init();

        watchers(ctx).currentPage('wo', 'dash');

        expect(destroy).toHaveBeenCalledOnce();
        expect(window._appCharts).toEqual({
            status: null,
            cost: null,
            downtime: null,
            reliability: null,
        });
    });

    it('survives a chart whose destroy throws', () => {
        window._appCharts = {
            status: {
                destroy() {
                    throw new Error('already gone');
                },
            },
        };
        const ctx = makeCtx();
        ctx.init();
        watchers(ctx).currentPage('wo', 'dash');
        expect(console.warn).toHaveBeenCalledWith('Chart destroy error', expect.any(Error));
    });

    it('resets the KPI chart map when leaving the KPI page', () => {
        window._appKpiCharts = { paVsActual: { destroy: vi.fn() } };
        const ctx = makeCtx();
        ctx.init();
        watchers(ctx).currentPage('dash', 'kpi');
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

    it('renders dashboard and KPI charts when navigating in', () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ1' }] });
        ctx.init();
        const nav = watchers(ctx).currentPage;

        nav('dash', 'wo');
        vi.advanceTimersByTime(500);
        expect(ctx.renderDashboardCharts).toHaveBeenCalledOnce();

        nav('kpi', 'dash');
        vi.advanceTimersByTime(1000);
        expect(ctx.renderKPICharts).toHaveBeenCalledOnce();
    });

    it('computes and renders the enterprise dashboard, then destroys it on exit', () => {
        const destroy = vi.fn();
        window._appCharts = { eHealth: { destroy } };
        const ctx = makeCtx();
        ctx.init();
        const nav = watchers(ctx).currentPage;

        nav('enterprise', 'dash');
        expect(ctx.computeEnterpriseData).toHaveBeenCalledOnce();
        vi.advanceTimersByTime(800);
        expect(ctx.renderEnterpriseCharts).toHaveBeenCalledOnce();

        nav('wo', 'enterprise');
        expect(destroy).toHaveBeenCalledOnce();
    });
});

describe('bootstrapModule helpers', () => {
    it('loadModalsCSS runs once', () => {
        const ctx = makeCtx();
        ctx.loadModalsCSS();
        expect(ctx.modalsLoaded).toBe(true);
        ctx.loadModalsCSS();
        expect(ctx.modalsLoaded).toBe(true);
    });

    it('checkUserRole reads the role node and stores it', async () => {
        const ctx = makeCtx();
        delete ctx.checkUserRole; // pakai method asli, bukan stub dari makeCtx
        window.get = vi.fn(async () => ({ exists: () => true, val: () => 'admin' }));
        ctx.checkUserRole('uid-1');
        await Promise.resolve();
        await Promise.resolve();
        expect(ctx.userRole).toBe('admin');
        expect(window.ref).toHaveBeenCalledWith(window.db, 'Users/uid-1/role');
    });

    it('checkUserRole keeps the current role when the node is missing or fails', async () => {
        const ctx = makeCtx({ userRole: 'user' });
        delete ctx.checkUserRole;
        window.get = vi.fn(async () => ({ exists: () => false, val: () => null }));
        ctx.checkUserRole('uid-1');
        await Promise.resolve();
        await Promise.resolve();
        expect(window.get).toHaveBeenCalledTimes(1);
        expect(ctx.userRole).toBe('user');

        window.get = vi.fn(async () => {
            throw new Error('denied');
        });
        expect(() => ctx.checkUserRole('uid-2')).not.toThrow();
        await Promise.resolve();
        await Promise.resolve();
        expect(window.get).toHaveBeenCalledTimes(1);
        expect(ctx.userRole).toBe('user');
    });
});
