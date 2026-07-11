/**
 * Router / Bootstrap Module
 * App initialization, watchers, and lifecycle management
 * Extracted from app.js
 */

export const bootstrapModule = {
    init() {
        try {
            // Global error handler for uncaught errors
            window.addEventListener('error', (e) => {
                const msg = e.message || '';
                if (msg.includes('Alpine') || msg.includes('proxy') || msg.includes('cannot clone')) {
                    console.warn('Alpine reactivity issue:', msg);
                    this.showNotification('Data sync issue detected, refreshing...', 'warning');
                }
            });
            
            // Global unhandled promise rejection handler
            window.addEventListener('unhandledrejection', (e) => {
                console.error('Unhandled rejection:', e.reason);
                if (e.reason?.message?.includes('proxy') || e.reason?.message?.includes('clone')) {
                    this.showNotification('Data sync issue, please refresh', 'warning');
                }
            });
            
            // Monitor Auth State
            window.onAuthStateChanged(window.auth, (user) => {
                if (!user) {
                    this.isLoggedIn = false;
                    this.user = null;
                    this.isLoading = false;
                } else {
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

                    // Request notification permission after login
                    setTimeout(() => {
                        if (window.notificationAPI?.requestNotificationPermission) {
                            window.notificationAPI.requestNotificationPermission();
                            window.notificationAPI.registerFCMToken();
                            // Run initial notification check after data loads
                            setTimeout(() => window.notificationAPI?.checkAllNotifications?.(), 6000);
                        }
                    }, 3000);
                }
            });

            this.applyTheme();

            // Load AI settings on init (before login)
            this.loadAISettings();

            // Global error handlers
            window.addEventListener('error', (e) => {
                if (e.message && e.message.includes('JSON')) {
                    console.warn('JSON parse error intercepted:', e.message);
                    e.preventDefault();
                }
            });
            
            window.addEventListener('unhandledrejection', (e) => {
                if (e.reason && typeof e.reason === 'string' && e.reason.includes('JSON')) {
                    console.warn('JSON rejection intercepted:', e.reason);
                    e.preventDefault();
                }
            });

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
            this.$watch('currentPage', (val, oldVal) => {
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
            this.$watch('showEquipModal', (val) => { if (val) this.loadModalsCSS(); });
            this.$watch('showPartModal', (val) => { if (val) this.loadModalsCSS(); });
            this.$watch('showLogModal', (val) => { if (val) this.loadModalsCSS(); });
            this.$watch('showPerformanceModal', (val) => { if (val) this.loadModalsCSS(); });

            // Initial Render - DISABLED to prevent undefined errors, charts only render on page navigation
        } catch (e) {
            this.handleError(e, 'App Init');
        }
    },

    // Lazy load modal CSS/styles trigger
    loadModalsCSS() {
        if (this.modalsLoaded) return;
        this.modalsLoaded = true;
        console.log('Modals ready');
    },

    checkUserRole(uid) {
        window.get(window.ref(window.db, `Users/${uid}/role`))
            .then(snap => {
                if (snap.exists()) {
                    this.userRole = snap.val();
                    console.log('User role from Firebase:', this.userRole);
                }
            })
            .catch(() => {});
    },
};
