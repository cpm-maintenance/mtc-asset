// @ts-check
import { logger } from './logger.js';
/** @typedef {import('./appstate').AppState} AppState */
/**
 * Router / Bootstrap Module
 * App initialization, watchers, and lifecycle management
 * Extracted from app.js
 */

 

export const bootstrapModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    init() {
        try {
            // Global error handler for uncaught errors
            window.addEventListener('error', (e) => {
                const msg = e.message || '';
                if (msg.includes('JSON')) {
                    console.warn('JSON parse error intercepted:', msg);
                    e.preventDefault();
                    return;
                }
                if (msg.includes('Alpine') || msg.includes('proxy') || msg.includes('cannot clone')) {
                    console.warn('Alpine reactivity issue:', msg);
                    this.showNotification('Data sync issue detected, refreshing...', 'warning');
                }
            });
            
            // Global unhandled promise rejection handler
            window.addEventListener('unhandledrejection', (e) => {
                const reason = e.reason;
                if (typeof reason === 'string' && reason.includes('JSON')) {
                    console.warn('JSON rejection intercepted:', reason);
                    e.preventDefault();
                    return;
                }
                console.error('Unhandled rejection:', reason);
                if (reason?.message?.includes('proxy') || reason?.message?.includes('clone')) {
                    this.showNotification('Data sync issue, please refresh', 'warning');
                }
            });
            
            // Monitor Auth State
            window.onAuthStateChanged(window.auth, async (/** @type {any} */ user) => {
                if (!user) {
                    this.isLoggedIn = false;
                    this.user = null;
                    this.isLoading = false;
                    return;
                }

                // Shell aplikasi (sidebar · main · footer · modal) hidup di
                // fragmen /pages/app-shell.html — index.html hanya layar login.
                // Muat & init dulu sebelum gate dibuka, supaya x-page dan
                // x-show di dalam shell sudah punya target saat data mengalir.
                if (typeof window.__loadAppShell === 'function') {
                    try {
                        await window.__loadAppShell();
                    } catch (e) {
                        logger.warn('[auth] app shell gagal dimuat:', e);
                    }
                }

                this.isLoggedIn = true;
                this.user = user;
                // Set Sentry user context
                if (window.Sentry) {
                    window.Sentry.setUser({ id: user.uid, email: user.email });
                }
                // Check if user is admin
                this.checkUserRole(user.uid);
                this.setupFirebaseListeners();
                this.loadAISettings();
                this.loadPMSchedule();
                this.setupRequisitionsListener();

                setTimeout(() => {
                    if (window.notificationAPI?.checkAllNotifications) {
                        setTimeout(() => window.notificationAPI?.checkAllNotifications?.(), 6000);
                    }
                }, 3000);
            });

            this.applyTheme();

            // Load AI settings on init (before login)
            this.loadAISettings();

            // Browser online/offline status
            window.addEventListener('online', () => this.isOnline = true);
            window.addEventListener('offline', () => this.isOnline = false);

            // Debounced Chart Renders (lazy load chart.js)
            const debouncedDash = () => {
                clearTimeout(this._dashTimeout);
                this._dashTimeout = setTimeout(() => {
                    this.chartLoaded = true;
                    this.renderDashboardCharts();
                }, 500);
            };
            const debouncedKPI = () => {
                clearTimeout(this._kpiTimeout);
                this._kpiTimeout = setTimeout(() => {
                    this.chartLoaded = true;
                    this.renderKPICharts();
                }, 500);
            };

            // Watchers - with data ready checks
            this.$watch('equipment', () => { 
                if (this.currentPage === 'dash' && this.equipment && this.equipment.length > 0) debouncedDash(); 
            });
            this.$watch('logs', () => { 
                if (this.currentPage === 'dash' && this.logs && this.logs.length > 0) debouncedDash(); 
            });
            this.$watch('currentPage', (/** @type {any} */ val, /** @type {any} */ oldVal) => {
                // Guard: block restricted pages for unauthorized users
                const page = this.menuItems.find(m => m.id === val);
                if (page && !this.canAccess(page)) {
                    console.warn('[Access] Blocked direct navigation to', val);
                    this.showNotification('Access denied', 'error');
                    this.currentPage = oldVal || 'dash';
                    return;
                }
                if (oldVal === 'dash') {
                    Object.values(window._appCharts || {}).forEach(c => { 
                        if(c) { try { c.destroy(); } catch(e) { console.warn('Chart destroy error', e); } }
                    });
                    window._appCharts = { status: null, cost: null, downtime: null, reliability: null };
                }
                if (oldVal === 'kpi') {
                    Object.values(window._appKpiCharts || {}).forEach(c => { 
                        if(c) { try { c.destroy(); } catch(e) { console.warn('KPI Chart destroy error', e); } }
                    });
                    window._appKpiCharts = { paVsActual: null, top5Events: null, top5Components: null, schedVsUnsched: null, mechVsElec: null, areaPa: null, paretoRCA: null };
                }
                if (val === 'dash' && this.equipment && this.equipment.length > 0) debouncedDash();
                // Trigger KPI charts with delay to ensure DOM is ready - render regardless of data length
                if (val === 'kpi') {
                    setTimeout(() => this.renderKPICharts(), 1000);
                }
                // Destroy enterprise charts when navigating away
                if (oldVal === 'enterprise') {
                    ['eHealth','woStatus','pmTrend','downtimeTrend','costTrend','abc'].forEach(k => {
                        if (window._appCharts && window._appCharts[k]) { try { window._appCharts[k].destroy(); } catch(e) {} }
                    });
                }
                // Trigger enterprise dashboard compute + charts
                if (val === 'enterprise') {
                    this.computeEnterpriseData();
                    setTimeout(() => this.renderEnterpriseCharts(), 800);
                }
            });
            this.$watch('kpiFilter', () => { if (this.currentPage === 'kpi') debouncedKPI(); });
            this.$watch('kpiFilterDate', () => { if (this.currentPage === 'kpi') debouncedKPI(); });
            this.$watch('performanceData', () => { if (this.currentPage === 'kpi') debouncedKPI(); });

            // Lazy load modals when needed
            this.$watch('showEquipModal', (/** @type {any} */ val) => { if (val) this.loadModalsCSS(); });
            this.$watch('showPartModal', (/** @type {any} */ val) => { if (val) this.loadModalsCSS(); });
            this.$watch('showLogModal', (/** @type {any} */ val) => { if (val) this.loadModalsCSS(); });
            this.$watch('showPerformanceModal', (/** @type {any} */ val) => { if (val) this.loadModalsCSS(); });

            // Initial Render - DISABLED to prevent undefined errors, charts only render on page navigation
        } catch (e) {
            this.handleError(e, 'App Init');
        }
    },

    // Lazy load modal CSS/styles trigger
    loadModalsCSS() {
        if (this.modalsLoaded) return;
        this.modalsLoaded = true;
        logger.debug('Modals ready');
    },

    checkUserRole(uid) {
        window.get(window.ref(window.db, `Users/${uid}/role`))
            .then((/** @type {any} */ snap) => {
                if (snap.exists()) {
                    this.userRole = snap.val();
                    logger.debug('User role from Firebase:', this.userRole);
                }
            })
            .catch(() => {});
    },
});
