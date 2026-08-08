import { authModule } from './modules/auth.js';
import { uiModule } from './modules/ui.js';
import { dataModule } from './modules/data.js';
import { equipmentModule } from './modules/equipment.js';
import { partsModule } from './modules/parts.js';
import { logsModule } from './modules/logs.js';
import { performanceModule } from './modules/performance.js';
import { exportModule } from './modules/export.js';
import { kpiEngineModule } from './modules/kpi-engine.js';
import { aiModule } from './modules/ai.js';
import { pmScheduleModule } from './modules/pm-schedule.js';
import { requisitionModule } from './modules/requisition.js';
import { chartModule } from './charts.js';
import { enterpriseKPI } from './modules/enterprise-kpi.js';
import { errorHandlerModule } from './error-handler.js';
import { bootstrapModule } from './bootstrap.js';
import { CONSTANTS, DEFAULT_EQUIP_FORM, DEFAULT_PART_FORM, DEFAULT_LOG_FORM, DEFAULT_PERF_FORM, DEFAULT_PM_FORM } from './constants.js';
import { isLowStock, calculatePartLifetime, getLifetimeColor, getLifetimeBgColor } from './utils.js';

export function app() {
    return {
        // --- APP STATE ---
        currentPage: 'dash', sidebarCollapsed: false, activeTab: 'hist', search: '', searchPart: '', partFilterEquip: '',
        installPromptEvent: null, showInstallButton: false,
        async installApp() {
          if (!this.installPromptEvent) return;
          this.installPromptEvent.prompt();
          const result = await this.installPromptEvent.userChoice;
          this.installPromptEvent = null;
          this.showInstallButton = false;
          console.log('[PWA] Install result:', result.outcome);
        },
        // Work Order filters
        searchWO: '', filterWOStatus: '', filterWOPriority: '', filterDateFrom: '', filterDateTo: '', sortByScore: false,
        selectedWODetail: null,

        // Dashboard date range filter
        dashboardDateFrom: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
        dashboardDateTo: new Date().toISOString().split('T')[0],
        
        // Audit trail
        auditLogs: [],
        auditLoading: false,
        auditFilter: '',
        auditActionFilter: '',
        auditShowAll: false,
        auditLimit: 100,

        // ponytail: AI state + methods (clearAIChat, rotateApiKey, sendAIChat, updateModelOptions,
        // loadAISettings, loadAIFromFirebase, saveAIWithCustomModel, saveAIToFirebase,
        // activeApiKey, apiKey, isAnalyzing, isGenerating, analysisResult, getAIRecommendations)
        // merged into ai.js module
        
        showEquipModal: false, showPartModal: false, showLogModal: false, showScanner: false, showQRPreviewModal: false, showNotifications: false, showMoreMenu: false,
        isLogDetailView: false, isEditingEquip: false, isEditingPart: false, isEditingLog: false,
        selectedEquip: null, notifications: [], isLoading: true, html5QrCode: null, qrCodeDataUrl: '',
        isOnline: navigator.onLine,
        themeMode: (() => { try { const m = localStorage.getItem('themeMode'); if (m) return m; const old = localStorage.getItem('darkMode'); if (old !== null) { const v = old === 'true' ? 'night' : 'light'; localStorage.setItem('themeMode', v); localStorage.removeItem('darkMode'); return v; } return 'night'; } catch(e) { return 'night'; } })(),
        isLoggedIn: false, user: null,
        sidebarExpandedGroups: (() => {
            try {
                const saved = JSON.parse(localStorage.getItem('sidebarGroups') || 'null');
                if (saved && typeof saved === 'object') return saved;
            } catch(e) {}
            // Default: dense groups collapsed so Dashboard (Monitoring) is first view
            return { Maintenance: false, 'Logs & Reports': false };
        })(),
        userRole: 'user', // 'admin' or 'user'
        loginForm: { email: '', password: '' },
        loginform: { email: '', password: '' }, // Alias for cached versions
        
        // Delete confirmation modal
        showDeleteConfirm: false,
        deleteConfirmCallback: null,
        
        // Reject modal
        showRejectModal: false,
        activeRejectId: null,
        rejectReason: '',

        // Usage History
        closeUsageHistory() { this.showUsageHistory = false; },

        // History Card state
        historyEquipId: 'all',
        historySearch: '',
        historyFilterType: '',
        historyFilterStatus: '',
        historyDateFrom: '',
        historyDateTo: '',
        historySortField: 'Tanggal',
        historySortDir: 'desc',
        historyPage: 1,
        historyPerPage: 20,

        get historySelectedEquip() {
            if (!this.historyEquipId || this.historyEquipId === 'all') return null;
            return this.equipment?.find(e => e.EquipmentID === this.historyEquipId) || null;
        },

        get historyFilteredLogs() {
            let logs = [...(this.logs || [])];

            // Filter by equipment
            if (this.historyEquipId && this.historyEquipId !== 'all') {
                logs = logs.filter(l => l.EquipmentID === this.historyEquipId);
            }

            // Date range
            if (this.historyDateFrom) logs = logs.filter(l => (l.Tanggal || '') >= this.historyDateFrom);
            if (this.historyDateTo) logs = logs.filter(l => (l.Tanggal || '') <= this.historyDateTo);

            // Maintenance type
            if (this.historyFilterType) logs = logs.filter(l => l.Jenis === this.historyFilterType);

            // Status
            if (this.historyFilterStatus) logs = logs.filter(l => l.Status === this.historyFilterStatus);

            // Text search
            const q = (this.historySearch || '').toLowerCase().trim();
            if (q) {
                logs = logs.filter(l => {
                    const woNum = (l.woNumber || '').toLowerCase();
                    const desc = (l.Deskripsi || '').toLowerCase();
                    const tech = (l.Technician || '').toLowerCase();
                    const equipId = (l.EquipmentID || '').toLowerCase();
                    const parts = this.historyGetParts(l);
                    const partMatch = Array.isArray(parts) && parts.some(p => {
                        const part = (this.allParts || []).find(a => a.PartID === p.id);
                        return part && (
                            (part.NamaPart || '').toLowerCase().includes(q) ||
                            (part.PartNumber || '').toLowerCase().includes(q)
                        );
                    });
                    return woNum.includes(q) || desc.includes(q) || tech.includes(q) || equipId.includes(q) || partMatch;
                });
            }

            // Sort
            const field = this.historySortField || 'Tanggal';
            const dir = this.historySortDir === 'asc' ? 1 : -1;
            logs.sort((a, b) => {
                let va = a[field] || '';
                let vb = b[field] || '';
                if (field === 'Downtime' || field === 'Cost') {
                    va = Number(va); vb = Number(vb);
                } else {
                    va = String(va); vb = String(vb);
                }
                return va < vb ? -dir : va > vb ? dir : 0;
            });

            return logs;
        },

        get historyTotalPages() {
            return Math.ceil(this.historyFilteredLogs.length / (this.historyPerPage || 20));
        },

        get historyCurrentPageLogs() {
            const start = (this.historyPage - 1) * (this.historyPerPage || 20);
            return this.historyFilteredLogs.slice(start, start + (this.historyPerPage || 20));
        },

        // Flatten logs into per-part rows (each part = separate row)
        get historyPartRows() {
            const rows = [];
            for (const log of this.historyCurrentPageLogs) {
                const parts = this.historyGetParts(log);
                if (parts.length === 0) {
                    rows.push({ log, part: null });
                } else {
                    for (const part of parts) {
                        rows.push({ log, part });
                    }
                }
            }
            return rows;
        },

        _partMap() {
            if (!this._partLookup || this._partLookupRef !== this.allParts) {
                const byId = new Map();
                (this.allParts || []).forEach(p => { if (p) byId.set(p.PartID, p); });
                this._partLookup = byId;
                this._partLookupRef = this.allParts;
            }
            return this._partLookup;
        },
        historyGetPartName(partId) {
            if (!partId) return partId;
            const p = this._partMap().get(partId);
            return p ? (p.NamaPart || partId) : partId;
        },

        historyGetPartNumber(partId) {
            if (!partId) return '';
            const p = this._partMap().get(partId);
            return p ? (p.PartNumber || '') : '';
        },

        historyGetParts(log) {
            if (!log) return [];
            try {
                // Unwrap Alpine Proxy first
                let raw = log.PartsUsed;
                if (typeof raw === 'object' && window.Alpine?.raw) {
                    raw = window.Alpine.raw(raw);
                }
                if (!raw) return [];
                if (Array.isArray(raw)) return raw;
                if (typeof raw === 'string') {
                    const trimmed = raw.trim();
                    if (!trimmed) return [];
                    if (trimmed.startsWith('[')) {
                        const parsed = JSON.parse(trimmed);
                        return Array.isArray(parsed) ? parsed : [];
                    }
                }
                // Handle Firebase object format {key: {id: ..., qty: ...}}
                if (typeof raw === 'object') {
                    const vals = Object.values(raw);
                    if (vals.length > 0 && vals[0] && vals[0].id !== undefined) return vals;
                }
            } catch (e) {}
            return [];
        },

        historySetSort(field) {
            if (this.historySortField === field) {
                this.historySortDir = this.historySortDir === 'asc' ? 'desc' : 'asc';
            } else {
                this.historySortField = field;
                this.historySortDir = 'desc';
            }
        },

        historyPrevPage() { if (this.historyPage > 1) this.historyPage--; },
        historyNextPage() { if (this.historyPage < this.historyTotalPages) this.historyPage++; },

        historyExportPDF() {
            if (!this.historyEquipId || this.historyEquipId === 'all') {
                this.showNotification('Select an equipment first', 'warning');
                return;
            }
            if (window.exportModule?.exportHistoryPDF) {
                window.exportModule.exportHistoryPDF(this.historyFilteredLogs, this.historySelectedEquip);
            } else {
                this.showNotification('Export module not ready', 'error');
            }
        },

        historyExportExcel() {
            if (window.exportModule?.exportHistoryExcel) {
                window.exportModule.exportHistoryExcel(this.historyFilteredLogs, this.historySelectedEquip);
            } else {
                window.exportHistoryFallback?.();
            }
        },

        historyPrint() { window.print(); },

        get usageHistoryLogs() {
            if (!this.usageHistoryPartId || !this.logs) return [];
            return this.logs.filter(l => {
                if (!l.PartsUsed) return false;
                const parts = typeof l.PartsUsed === 'string' ? JSON.parse(l.PartsUsed) : l.PartsUsed;
                return Array.isArray(parts) && parts.some(p => p.id === this.usageHistoryPartId);
            });
        },

        // --- DATA STATE (Explicitly initialized to avoid undefined errors) ---
        equipment: [],
        allParts: [],
        logs: [],
        performanceData: [],
        equipPage: 1,
        equipLimit: 30,

        // --- PM SCHEDULE STATE ---
        pmView: 'calendar',
        pmMonthOffset: 0,
        pmFilterEquip: '',
        pmShowDetail: false,
        selectedPM: null,
        pmGanttScroll: 0,
        selectedPMDate: '',
        showPMModal: false,

        // --- PLANNING BOARD STATE ---
        planningView: 'kanban',
        planningSearch: '',
        planningFilterTech: '',
        planningFilterPriority: '',
        planningDragging: null,
        planningDragOver: null,
        planningDetailWO: null,
        planningGanttScroll: 0,

        // --- TECHNICIAN WORKLOAD STATE ---
        twSearch: '',
        twDateFrom: '',
        twDateTo: '',
        twHideZero: false,

        // --- MONTHLY PLAN STATE ---
        mpMonth: new Date().getMonth(),
        mpYear: new Date().getFullYear(),
        mpLoading: false,

        // --- MTBF/MTTR STATE ---
        mtbfFilterEquip: '',

        // --- CROP MODAL STATE ---
        showCropModalOpen: false,
        cropImageSrc: '',
        cropCallback: null,
        // ─── AUDIT TRAIL ───
        async loadAuditLogs() {
            if (!this.isAdmin) return;
            this.auditLoading = true;
            try {
                const Audit = (await import('./modules/audit.js'));
                const { ref, query, orderByChild, limitToLast, get, db } = await import('./db.js');
                const auditRef = ref(db, 'AuditTrail');
                const snap = await get(query(auditRef, limitToLast(500)));
                if (snap.exists()) {
                    const data = snap.val();
                    this.auditLogs = Object.keys(data).map(k => ({ _key: k, ...data[k] }))
                        .filter(e => e.action)
                        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                } else {
                    this.auditLogs = [];
                }
            } catch (e) {
                console.warn('[Audit] Load error:', e.message);
                this.auditLogs = [];
            }
            this.auditLoading = false;
        },
        get filteredAudit() {
            let result = this.auditLogs;
            if (this.auditActionFilter) {
                result = result.filter(e => e.action === this.auditActionFilter);
            }
            if (this.auditFilter) {
                const q = this.auditFilter.toLowerCase();
                result = result.filter(e =>
                    (e.action || '').toLowerCase().includes(q) ||
                    (e.email || '').toLowerCase().includes(q) ||
                    (e.details || '').toLowerCase().includes(q) ||
                    (e.uid || '').toLowerCase().includes(q)
                );
            }
            return result.slice(0, this.auditLimit);
        },
        formatAuditTime(dateStr) {
            if (!dateStr) return '-';
            try {
                const d = new Date(dateStr);
                return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
            } catch(e) { return dateStr?.substring(0, 10) || '-'; }
        },

        async login() {
            const form = this.loginform.email ? this.loginform : this.loginForm;
            if (!form.email || !form.password) {
                this.showNotification("Please enter email and password", "error");
                return;
            }
            this.isLoading = true;
            try {
                await window.setPersistence(window.auth, window.browserSessionPersistence);
                await window.signInWithEmailAndPassword(window.auth, form.email, form.password);
                this.showNotification("Welcome back!");
            } catch (error) {
                console.error(error);
                this.showNotification("Login failed: " + error.message, "error");
            } finally {
                this.isLoading = false;
            }
        },

        async logout() {
if (confirm('Are you sure you want to logout?')) {
                    this.isLoading = true;
                    try {
                        await window.signOut(window.auth);
                        this.isLoggedIn = false;
                        this.user = null;
                        this.userRole = 'user';
                        this.showNotification("Logged out successfully", "info");
                } catch (error) {
                    this.showNotification("Error logging out: " + error.message, "error");
                } finally {
                    this.isLoading = false;
                }
            }
        },

        showUID() {
            if (this.user) {
                prompt("Copy your UID below:", this.user.uid);
            }
        },

        // Error Handling State
        hasError: false,
        errorMessage: '',
        errorDetails: '',

        // Lazy Loading State
        chartLoaded: false,
        modalsLoaded: false,

        importProgress: 0,
        dashboardStats: { totalEquip: 0, overduePM: 0, lowStock: 0, totalDowntime: 0 },
        
        // Pagination State
        equipPage: 1,
        equipLimit: 30,

        // --- FORMS ---
        equipForm: DEFAULT_EQUIP_FORM(),
        partForm: DEFAULT_PART_FORM(),
        logForm: DEFAULT_LOG_FORM(),
        performanceForm: DEFAULT_PERF_FORM(),

        // --- TEMP STORAGE ---
        oldLogParts: [],
        tempEquipFile: null,

        // --- KPI & CHARTS STATE ---
        showPerformanceModal: false,
        isEditingPerformance: false,
        kpiFilter: 'yearly',
        kpiFilterDate: new Date().getFullYear().toString(),
        enterpriseSummary: {},
        enterpriseKPIList: [],
        enterpriseCritical: [],
        enterpriseUpcomingPM: [],
        enterpriseCriticalWO: [],
        enterpriseLowStock: [],
        enterpriseInsights: [],
        enterpriseOEE: { oee: 0, status: 'N/A', availability: 0, performance: 0, quality: 0, hexColor: '#6b7280' },
        expandedEquip: null,
        plantFilter: '', deptFilter: '', kpiDateFrom: '', kpiDateTo: '',
        aiLoading: false,

        menuItems: [
            // --- MONITORING ---
            { id: 'dash', name: 'Dashboard', short: 'Home', icon: 'fas fa-chart-pie', mobile: true, group: 'Monitoring' },

            // --- MAINTENANCE ---
            { id: 'wo', name: 'Work Orders', short: 'WO', icon: 'fas fa-clipboard-list', mobile: true, group: 'Maintenance' },
            { id: 'pms', name: 'PM Schedule', short: 'PM', icon: 'fas fa-calendar-alt', mobile: true, allowedRole: 'supervisor', group: 'Maintenance' },
            { id: 'equip', name: 'Equipment', short: 'Assets', icon: 'fas fa-tools', mobile: true, group: 'Maintenance' },

            // --- PLANNING ---
            { id: 'planning', name: 'Planning Board', short: 'Plan', icon: 'fas fa-columns', mobile: true, allowedRole: 'supervisor', group: 'Planning' },
            { id: 'monthlyplan', name: 'Monthly Plan', short: 'Monthly', icon: 'fas fa-file-alt', mobile: true, allowedRole: 'supervisor', group: 'Planning' },
            { id: 'workload', name: 'Workload', short: 'Load', icon: 'fas fa-user-hard-hat', mobile: true, allowedRole: 'supervisor', group: 'Planning' },

            // --- LOGS & REPORTS ---
            { id: 'hist', name: 'All Logs', short: 'Logs', icon: 'fas fa-history', mobile: true, group: 'Logs & Reports' },
            { id: 'history', name: 'History Card', short: 'History', icon: 'fas fa-clipboard-check', mobile: true, group: 'Logs & Reports' },
            { id: 'audit', name: 'Audit Trail', short: 'Audit', icon: 'fas fa-scroll', mobile: false, allowedRole: 'admin', group: 'Logs & Reports' },

            // --- INVENTORY ---
            { id: 'parts', name: 'Spare Parts', short: 'Parts', icon: 'fas fa-box', mobile: true, group: 'Inventory' },
            { id: 'request', name: 'Request Part', short: 'Request', icon: 'fas fa-shopping-cart', mobile: true, group: 'Inventory' },

            // --- ANALYTICS ---
            { id: 'perf', name: 'Performance', short: 'Perf', icon: 'fas fa-chart-simple', mobile: true, allowedRole: 'supervisor', group: 'Analytics' },
            { id: 'mtbfmttr', name: 'MTBF/MTTR', short: 'MTBF', icon: 'fas fa-chart-line', mobile: true, allowedRole: 'supervisor', group: 'Analytics' },
            { id: 'enterprise', name: 'Enterprise KPI', short: 'Ent KPI', icon: 'fas fa-industry', mobile: true, allowedRole: 'admin', group: 'Analytics' },
            { id: 'kpi', name: 'KPI Analytics', short: 'KPI', icon: 'fas fa-brain', mobile: true, allowedRole: 'admin', group: 'Analytics' },
            { id: 'ai', name: 'AI Analysis', short: 'AI', icon: 'fas fa-robot', mobile: false, allowedRole: 'admin', group: 'Analytics' },
        ],

        // --- MOBILE PRIMARY NAV (5 slots + More) ---
        get mobilePrimaryItems() {
            const ids = ['dash', 'wo', 'equip', 'parts'];
            return ids.map(id => this.menuItems.find(m => m.id === id)).filter(Boolean);
        },

        // --- ROLE-BASED NAVIGATION ---
        get menuGroups() {
            const groups = {};
            this.menuItems.filter(m => this.canAccess(m)).forEach(item => {
                const g = item.group || 'Other';
                if (!groups[g]) groups[g] = { name: g, items: [] };
                groups[g].items.push(item);
            });
            const order = ['Monitoring', 'Maintenance', 'Planning', 'Logs & Reports', 'Inventory', 'Analytics'];
            return order.filter(k => groups[k]).map(k => groups[k]);
        },
        toggleSidebarGroup(name) {
            const val = !this.sidebarExpandedGroups[name];
            this.sidebarExpandedGroups[name] = val;
            try { localStorage.setItem('sidebarGroups', JSON.stringify(this.sidebarExpandedGroups)); } catch(e) {}
        },
        navigateTo(pageId) {
            const page = this.menuItems.find(m => m.id === pageId);
            if (page && !this.canAccess(page)) {
                this.showNotification("Access denied", "error");
                return;
            }
            this.currentPage = pageId;
        },

        // --- SIDEBAR BADGE COUNTS ---
        get openWOCount() {
            return (this.logs || []).filter(l => l.Status && l.Status !== 'Completed').length;
        },

        // ── WO Age / Backlog Aging (R1) ──
        woAgeDays(log) {
            if (!log || !log.Tanggal) return 0;
            const t = new Date(log.Tanggal);
            if (isNaN(t)) return 0;
            return Math.floor((Date.now() - t.getTime()) / 86400000);
        },
        woAgeBucket(days) {
            if (days <= 1) return '0-1d';
            if (days <= 3) return '1-3d';
            if (days <= 7) return '3-7d';
            return '7d+';
        },
        woAgeColor(days) {
            if (days <= 1) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            if (days <= 3) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            if (days <= 7) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        },
        woAgeClass(days) {
            if (days <= 1) return 'border-l-emerald-500';
            if (days <= 3) return 'border-l-amber-500';
            if (days <= 7) return 'border-l-orange-500';
            return 'border-l-rose-500';
        },
        get backlogAging() {
            const wos = (this.logs || []).filter(l => l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Approved' || l.Status === 'In Progress'));
            const buckets = { '0-1d': 0, '1-3d': 0, '3-7d': 0, '7d+': 0 };
            wos.forEach(l => { const d = this.woAgeDays(l); if (d >= 0) buckets[this.woAgeBucket(d)]++; });
            return buckets;
        },
        // ── Priority Scoring Matrix (R2) ──
        // Score = WO priority (0-3) + asset criticality (0-3) + health risk (0-3) → 0-9
        woPrioScore(wo) {
            const map = { 'Emergency': 3, 'Urgent': 2.5, 'High': 2, 'Normal': 1, 'Low': 0.5, 'Planned': 0.5 };
            return map[(wo.woPriority || wo.priority || 'Normal')] ?? 1;
        },
        criticalityScore(equipId) {
            // Map lookup instead of .find() per call (O(1) vs O(n))
            if (!this._critMap || this._critMapRef !== this.equipment) {
                const map = new Map();
                (this.equipment || []).forEach(e => { if (e) map.set(e.EquipmentID, e.criticality); });
                this._critMap = map;
                this._critMapRef = this.equipment;
            }
            const map = { 'High': 3, 'Medium': 2, 'Low': 1 };
            return map[this._critMap.get(equipId)] ?? 1;
        },
        healthRiskScore(equipId) {
            const h = this.calculateHealthScore ? this.calculateHealthScore(equipId) : null;
            if (!h || !h.score) return 0;
            if (h.score < 50) return 3;
            if (h.score < 80) return 1.5;
            return 0;
        },
        backlogScore(wo) {
            if (!wo || !wo.EquipmentID) return this.woPrioScore(wo);
            return Math.min(9, Math.round(this.woPrioScore(wo) + this.criticalityScore(wo.EquipmentID) + this.healthRiskScore(wo.EquipmentID)));
        },
        backlogScoreColor(score) {
            if (score >= 7) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            if (score >= 4) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
        },
        // ── R7: MTTR per technician ──
        mttrByTech() {
            if (this._mttrCache && this._mttrCacheRef === this.logs) return this._mttrCache.list;
            const map = {};
            (this.logs || []).forEach(l => {
                if (!l || !l.assignedTo) return;
                const dt = Number(l.Downtime) || Number(l.downtime) || 0;
                if (dt <= 0) return;
                if (!map[l.assignedTo]) map[l.assignedTo] = { repairs: 0, totalDown: 0, breakdowns: 0 };
                map[l.assignedTo].repairs++;
                map[l.assignedTo].totalDown += dt;
                if (l.Jenis === 'Breakdown') map[l.assignedTo].breakdowns++;
            });
            const list = Object.entries(map).map(([name, d]) => ({
                name,
                mttr: d.repairs > 0 ? Math.round(d.totalDown / d.repairs * 10) / 10 : 0,
                breakdowns: d.breakdowns,
            }));
            this._mttrCache = { list, byName: new Map(list.map(t => [t.name, t])) };
            this._mttrCacheRef = this.logs;
            return list;
        },
        _tech(t) {
            if (!this._mttrCache || this._mttrCacheRef !== this.logs) this.mttrByTech();
            return this._mttrCache.byName.get(t);
        },
        techMttr(name) {
            return this._tech(name)?.mttr || 0;
        },
        techBreakdowns(name) {
            return this._tech(name)?.breakdowns || 0;
        },

        // ── R4: PM Effectiveness (RCM-lite) ──
        // Failures within X days after a PM on same equipment → PM likely ineffective
        pmEffectiveness(daysWindow = 14) {
            const results = [];
            (this.pmList || []).forEach(pm => {
                if (!pm || !pm.equipmentId || !pm.date || pm.status !== 'completed') return;
                const pmDate = new Date(pm.date);
                if (isNaN(pmDate)) return;
                const failures = (this.logs || []).filter(l =>
                    l && l.EquipmentID === pm.equipmentId && l.Jenis === 'Breakdown' &&
                    l.Tanggal && (() => {
                        const d = new Date(l.Tanggal);
                        const diff = (d - pmDate) / 86400000;
                        return diff >= 0 && diff <= daysWindow;
                    })()
                );
                if (failures.length > 0) {
                    results.push({
                        pmId: pm.pmId, taskName: pm.taskName, equipmentId: pm.equipmentId,
                        failures: failures.length, window: daysWindow,
                    });
                }
            });
            return results.sort((a, b) => b.failures - a.failures).slice(0, 10);
        },

        get sortedByPriority() {
            return this.filteredWorkOrders
                .map(l => ({ ...l, _score: this.backlogScore(l) }))
                .sort((a, b) => b._score - a._score);
        },

        get topOverdueWO() {
            return (this.logs || [])
                .filter(l => l && (l.woNumber || l.Status === 'Pending') && l.Status !== 'Completed')
                .map(l => ({ ...l, _age: this.woAgeDays(l) }))
                .filter(x => x._age > 3)
                .sort((a, b) => b._age - a._age)
                .slice(0, 5);
        },
        get lowStockCount() {
            return (this.allParts || []).filter(p => p.isLowStock).length;
        },
        get pendingReqCount() {
            return (this.requisitions || []).filter(r => r.status === 'pending').length;
        },
        badgeCount(itemId) {
            const map = { wo: this.openWOCount, parts: this.lowStockCount, request: this.pendingReqCount };
            const c = map[itemId] || 0;
            return c > 0 ? c : '';
        },

                // --- MODULE INJECTION ---
        ...authModule,
        ...uiModule,
        ...dataModule,
        ...equipmentModule,
        ...partsModule,
        ...logsModule,
        ...performanceModule,
        ...exportModule,
        ...kpiEngineModule,
        ...aiModule,
        ...pmScheduleModule,
        ...requisitionModule,
        ...chartModule,
        ...errorHandlerModule,
        ...bootstrapModule,
        ...enterpriseKPI,

        // --- CALCULATED PROPERTIES (GETTERS) ---
        // ponytail: init, loadModalsCSS, checkUserRole extracted to bootstrap.js
        get isAdmin() { return this.userRole === 'admin'; },
        get isSupervisor() { return this.userRole === 'supervisor'; },
        get isAdminOrSupervisor() { return this.userRole === 'admin' || this.userRole === 'supervisor'; },
        // allowedRole: undefined=all, 'admin'=admin only, 'supervisor'=admin+supervisor
        canAccess(menuItem) {
            if (!menuItem.allowedRole) return true;
            if (menuItem.allowedRole === 'admin') return this.isAdmin;
            if (menuItem.allowedRole === 'supervisor') return this.isAdminOrSupervisor;
            return true;
        },

        // Dashboard date range helpers
        applyDashboardFilter() {
            // Reset chart cache so renderDashboardCharts rebuilds
            Object.values(window._appCharts || {}).forEach(c => { if(c) { try { c.destroy(); } catch(e) {} } });
            window._appCharts = { status: null, cost: null, downtime: null, reliability: null, woCompletion: null };
            if (this.currentPage === 'dash') this.renderDashboardCharts();
        },
        setDashboardPreset(days) {
            if (days === 0) {
                this.dashboardDateFrom = '';
                this.dashboardDateTo = '';
            } else {
                this.dashboardDateFrom = new Date(Date.now() - days*24*60*60*1000).toISOString().split('T')[0];
                this.dashboardDateTo = new Date().toISOString().split('T')[0];
            }
            this.applyDashboardFilter();
        },

        get calculatedStats() {
            // Date-range filter for stats
            const from = this.dashboardDateFrom || '';
            const to = this.dashboardDateTo || '';
            const inRange = (d) => !d || ((!from || d >= from) && (!to || d <= to));

            // WO completion rate (filtered by date)
            const wos = (this.logs || []).filter(l => (l.woNumber || l.Status === 'Pending' || l.Status === 'Approved') && inRange(l.Tanggal));
            const woTotal = wos.length;
            const woDone = wos.filter(l => l.Status === 'Completed').length;
            const woRate = woTotal > 0 ? Math.round((woDone / woTotal) * 100) : 0;
            // Avg health score
            let healthSum = 0, healthCount = 0;
            const equips = this.equipment || [];
            equips.forEach(e => {
                if (this.calculateHealthScore) {
                    const h = this.calculateHealthScore(e.EquipmentID);
                    if (h && h.score) { healthSum += h.score; healthCount++; }
                }
            });
            const avgHealth = healthCount > 0 ? Math.round(healthSum / healthCount) : 0;
            return {
                totalEquip: { label: 'Total Assets', value: equips.length || 0, color: 'border-blue-500' },
                woCompletionRate: { label: 'WO Completion', value: woRate + '%', color: 'border-emerald-500' },
                avgHealthScore: { label: 'Avg Health Score', value: avgHealth + '%', color: 'border-cyan-500' },
                lowStock: { label: 'Low Stock Parts', value: this.dashboardStats.lowStock || 0, color: 'border-yellow-500' },
                pmCompliance: { label: 'PM Compliance', value: this.calcPMCompliance?.().pct + '%' || '0%', color: 'border-purple-500' },
            };
        },

        // Predictive Maintenance alerts for dashboard widget
        get predictiveAlerts() {
            const parts = this.allParts || [];
            return parts.filter(p => {
                const lifetime = Number(p.avgLifetimeDays) || 0;
                const usage = Number(p.usageHours) || 0;
                if (lifetime <= 0) return false;
                return usage > lifetime * 24 * 0.8;
            }).map(p => {
                const lifetime = Number(p.avgLifetimeDays) || 365;
                const usage = Number(p.usageHours) || 0;
                const lifetimeHours = lifetime * 24;
                const ratio = Math.round(usage / lifetimeHours * 100);
                let eta = null, confidence = 0;
                if (p.firstUsedDate || p.installedDate) {
                    const start = new Date(p.firstUsedDate || p.installedDate);
                    if (!isNaN(start)) {
                        const daysUsed = Math.max(1, (Date.now() - start.getTime()) / 86400000);
                        const usagePerDay = usage / daysUsed;
                        if (usagePerDay > 0) {
                            const remaining = lifetimeHours - usage;
                            const daysLeft = Math.max(0, remaining / usagePerDay);
                            eta = new Date(Date.now() + daysLeft * 86400000).toISOString().split('T')[0];
                            confidence = Math.min(95, Math.round(70 + ratio * 0.25));
                        }
                    }
                }
                return {
                    partId: p.PartID,
                    partName: p.NamaPart || p.PartID,
                    usageHours: usage,
                    lifetimeDays: lifetime,
                    ratio,
                    eta,
                    confidence,
                };
            });
        },

        
        get filteredEquip() {
            if (!this.equipment || !Array.isArray(this.equipment)) return [];
            let result = this.equipment.filter(e =>
                (e.Nama || '').toLowerCase().includes(this.search.toLowerCase()) ||
                (e.EquipmentID || '').toLowerCase().includes(this.search.toLowerCase())
            );
            
            // Apply pagination when not searching
            if (!this.search && result.length > 0) {
                result = result.slice(0, this.equipPage * this.equipLimit);
            }
            
            return result;
        },
        
        get canLoadMoreEquip() {
            if (!this.equipment || !Array.isArray(this.equipment)) return false;
            if (!this.search) {
                return this.equipment.length > (this.equipPage * this.equipLimit);
            }
            return false; // Disable pagination during search
        },

        loadMoreEquipment() {
            if (this.canLoadMoreEquip) {
                this.equipPage++;
            }
        },

        // Utility functions for templates
        isLowStock(current, minimum) {
            return isLowStock(current, minimum);
        },

        // Modern delete confirmation
        confirmDelete(node, id) {
            return new Promise((resolve) => {
                this.deleteConfirmCallback = {
                    confirm: () => {
                        resolve(true);
                        this.deleteConfirmCallback = null;
                    },
                    cancel: () => {
                        resolve(false);
                        this.deleteConfirmCallback = null;
                    }
                };
                this.showDeleteConfirm = true;
            });
        },

        // Clean URL from encoding issues (HTML entities + URL encoding)
        cleanUrl(url) {
            if (!url || typeof url !== 'string') return '';
            try {
                let decoded = url.replace(/&#[xX](\w+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                         .replace(/&(\w+);/g, (match, entity) => {
                    const entities = { 'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'nbsp': ' ' };
                    return entities[entity] || match;
                });
                return decodeURIComponent(decoded);
            } catch (e) {
                return url;
            }
        },

        // Safe parse PartsUsed from logs
        safeParseLogParts(partsUsed) {
            if (!partsUsed) return [];
            try {
                if (Array.isArray(partsUsed)) return partsUsed;
                if (typeof partsUsed === 'string') {
                    if (partsUsed.trim() === '') return [];
                    return JSON.parse(partsUsed);
                }
                return [];
            } catch (e) {
                console.warn('safeParseLogParts error:', e);
                return [];
            }
        },

        // Force refresh data arrays for Alpine reactivity
        forceRefreshLogs() {
            // Trigger Alpine reactivity by creating new array reference
            // This forces Alpine to re-evaluate computed properties like filteredWorkOrders
            const currentLogs = this.logs ? [...this.logs] : [];
            this.logs = [];
            setTimeout(() => {
                this.logs = currentLogs;
            }, 50);
        },
        
        refreshData() {
            this.isLoading = true;
            this.showNotification("Syncing data...", "info");
            try {
                if (this.setupFirebaseListeners && typeof this.setupFirebaseListeners === 'function') {
                    this.setupFirebaseListeners();
                }
                setTimeout(() => {
                    this.isLoading = false;
                    this.showNotification("Data refreshed", "success");
                }, 500);
            } catch(e) {
                this.isLoading = false;
                this.showNotification("Refresh failed: " + e.message, "error");
            }
        },

        // ── Phase 2: Migrate legacy base64 ImageUploads → ImgBB URLs ──
        // Run from browser console: await window.app.migrateLegacyImages()
        async migrateLegacyImages() {
            const results = { migrated: 0, failed: 0, skipped: 0 };
            const snap = await window.get(window.ref(window.db, 'ImageUploads'));
            const uploads = snap.val() || {};
            const ids = Object.keys(uploads);
            if (!ids.length) {
                console.log('[Migrate] No ImageUploads — continuing with inline base64 (Equipment/Logs)');
            } else {
                console.log('[Migrate] Found', ids.length, 'legacy images');
            }

            // Load equipment + logs to map references
            const eqSnap = await window.get(window.ref(window.db, 'Equipment'));
            const equipment = eqSnap.val() || {};
            const logSnap = await window.get(window.ref(window.db, 'HistoryLog'));
            const logs = logSnap.val() || {};

            for (const id of ids) {
                const entry = uploads[id];
                const data = entry?.data || entry?.dataUrl || '';
                if (!data || !data.startsWith('data:')) { results.skipped++; continue; }
                try {
                    const rawB64 = data.split('base64,')[1] || data;
                    const form = new FormData();
                    form.append('key', import.meta.env.VITE_IMGBB_API_KEY);
                    form.append('image', rawB64);
                    form.append('name', id);
                    const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
                    const j = await r.json();
                    if (!j.success) throw new Error(j.error?.message || 'ImgBB fail');
                    const url = j.data.url;
                    console.log('[Migrate]', id, '→', url);

                    const updates = {};
                    const prefix = data.slice(0, 100);
                    for (const [eqId, eq] of Object.entries(equipment)) {
                        if (eq.FotoURL && String(eq.FotoURL).includes(prefix)) {
                            updates['Equipment/' + eqId + '/FotoURL'] = url;
                        }
                    }
                    for (const [logId, log] of Object.entries(logs)) {
                        const urls = log.PhotoURLs;
                        const asStr = typeof urls === 'string' ? urls : JSON.stringify(urls || []);
                        if (asStr.includes(prefix)) {
                            if (Array.isArray(urls)) {
                                updates['HistoryLog/' + logId + '/PhotoURLs'] = urls.map(u => u === data ? url : u);
                            } else {
                                updates['HistoryLog/' + logId + '/PhotoURLs'] = [url];
                            }
                        }
                    }
                    updates['ImageUploads/' + id] = null;
                    await window.update(window.ref(window.db), updates);
                    results.migrated++;
                } catch (e) {
                    results.failed++;
                    console.error('[Migrate]', id, 'failed:', e.message);
                }
            }
            // Also migrate Equipment.FotoURL fields that still hold inline base64
            const eqSnap2 = await window.get(window.ref(window.db, 'Equipment'));
            const equipment2 = eqSnap2.val() || {};
            for (const [eqId, eq] of Object.entries(equipment2)) {
                const foto = eq.FotoURL;
                if (!foto || !String(foto).startsWith('data:')) continue;
                try {
                    const rawB64 = String(foto).split('base64,')[1] || String(foto);
                    const form = new FormData();
                    form.append('key', import.meta.env.VITE_IMGBB_API_KEY);
                    form.append('image', rawB64);
                    form.append('name', 'eq_' + eqId);
                    const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
                    const j = await r.json();
                    if (!j.success) throw new Error(j.error?.message || 'ImgBB fail');
                    await window.update(window.ref(window.db), { ['Equipment/' + eqId + '/FotoURL']: j.data.url });
                    results.migrated++;
                    console.log('[Migrate] Equipment', eqId, 'FotoURL →', j.data.url);
                } catch (e) {
                    results.failed++;
                    console.error('[Migrate] Equipment', eqId, 'failed:', e.message);
                }
            }
            // Logs PhotoURLs that are still inline base64
            const logSnap2 = await window.get(window.ref(window.db, 'HistoryLog'));
            const logs2 = logSnap2.val() || {};
            for (const [logId, log] of Object.entries(logs2)) {
                const urls = log.PhotoURLs;
                const list = Array.isArray(urls) ? urls : (typeof urls === 'string' ? (() => { try { return JSON.parse(urls); } catch { return []; } })() : []);
                if (!list.some(u => typeof u === 'string' && u.startsWith('data:'))) continue;
                const newUrls = [];
                for (const u of list) {
                    if (typeof u === 'string' && u.startsWith('data:')) {
                        try {
                            const rawB64 = u.split('base64,')[1] || u;
                            const form = new FormData();
                            form.append('key', import.meta.env.VITE_IMGBB_API_KEY);
                            form.append('image', rawB64);
                            form.append('name', 'log_' + logId);
                            const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
                            const j = await r.json();
                            if (!j.success) throw new Error(j.error?.message || 'ImgBB fail');
                            newUrls.push(j.data.url);
                            results.migrated++;
                        } catch (e) {
                            results.failed++;
                            console.error('[Migrate] Log', logId, 'photo failed:', e.message);
                            newUrls.push(u); // keep original
                        }
                    } else {
                        newUrls.push(u);
                    }
                }
                await window.update(window.ref(window.db), { ['HistoryLog/' + logId + '/PhotoURLs']: newUrls });
            }

            console.log('[Migrate] Done:', JSON.stringify(results));
            this.showNotification('Migrated ' + results.migrated + ' images to ImgBB', 'success');
            return results;
        },

                get filteredAllParts() {
            if (!this.allParts || !Array.isArray(this.allParts)) {
                return [];
            }
            
            const searchLower = (this.searchPart || '').toLowerCase().trim();
            const filterEquip = this.partFilterEquip;
            
            const hasFilter = searchLower || filterEquip;
            
            if (!hasFilter && this.allParts.length > 20) {
                return [];
            }
            
            const filtered = this.allParts.filter(p => {
                if (!p) return false;
                
                const name = (p.NamaPart || '').toString().toLowerCase();
                const id = (p.PartID || '').toString().toLowerCase();
                const shortName = (p.NamaSingkat || '').toString().toLowerCase();
                const partNum = (p.PartNumber || '').toString().toLowerCase();

                const matchesSearch = !searchLower || 
                    name.includes(searchLower) ||
                    id.includes(searchLower) ||
                    shortName.includes(searchLower) ||
                    partNum.includes(searchLower);
                
                let linkedIds = [];
                if (Array.isArray(p.EquipmentIDs)) {
                    linkedIds = p.EquipmentIDs;
                } else if (p.EquipmentIDs && typeof p.EquipmentIDs === 'string') {
                    linkedIds = [p.EquipmentIDs];
                } else if (p.EquipmentID) {
                    linkedIds = [p.EquipmentID];
                }

                const matchesEquip = !filterEquip || linkedIds.includes(filterEquip);
                return matchesSearch && matchesEquip;
            });

            return filtered;
        },

        get filteredPerformanceData() {
            return this.getFilteredPerfData ? this.getFilteredPerfData() : this.performanceData;
        },

        detailLogLimit: 50,

        get filteredLogs() {
            if (!this.logs || !Array.isArray(this.logs)) return [];
            return this.logs.filter(l => l.EquipmentID === this.selectedEquip?.EquipmentID);
        },

        get visibleEquipLogs() {
            const f = this.filteredLogs;
            return f.slice(0, this.detailLogLimit || 50);
        },

        get detailLogsHasMore() {
            return this.filteredLogs.length > (this.detailLogLimit || 50);
        },

        loadMoreDetailLogs() {
            this.detailLogLimit = (this.detailLogLimit || 50) + 50;
        },

        // ponytail: pmMonthLabel, pmCalendarDays, pmStats, pmGanttMonths, pmGanttDays, pmGanttRows
        // extracted to pm-schedule.js (as pmGetMonthLabel, pmGetCalendarDays, pmGetStats, etc.)

        get filteredWorkOrders() {
            // Guard: if logs is undefined/null, return empty
            if (!this.logs || !Array.isArray(this.logs)) {
                return [];
            }
            
            // Use pre-filtered activeWorkOrders if available (faster)
            // Falls back to filtering all logs if activeWorkOrders is empty but logs exist
            const source = (this.activeWorkOrders && this.activeWorkOrders.length > 0)
                ? this.activeWorkOrders
                : this.logs.filter(l => l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Draft' || l.Status === 'Approved'));
            
            let result = source.filter(l => l.Jenis || l.Deskripsi || l.woNumber || l.EquipmentID);
            
            // Apply filters
            const hasFilters = this.searchWO || this.filterWOStatus || this.filterWOPriority || this.filterDateFrom || this.filterDateTo;
            
            if (hasFilters) {
                // ...existing WO filters...
                if (this.searchWO) {
                    const s = this.searchWO.toLowerCase();
                    result = result.filter(l => 
                        (l.woNumber && l.woNumber.toLowerCase().includes(s)) ||
                        (l.Deskripsi && l.Deskripsi.toLowerCase().includes(s)) ||
                        (l.requestedBy && l.requestedBy.toLowerCase().includes(s)) ||
                        (l.externalEquipName && l.externalEquipName.toLowerCase().includes(s))
                    );
                }
                
                if (this.filterWOStatus) {
                    result = result.filter(l => l.Status === this.filterWOStatus);
                }
                
                if (this.filterWOPriority) {
                    result = result.filter(l => l.woPriority === this.filterWOPriority);
                }
                
                // Date range filter
                if (this.filterDateFrom) {
                    const from = this.filterDateFrom;
                    result = result.filter(l => l.Tanggal && l.Tanggal >= from);
                }
                if (this.filterDateTo) {
                    const to = this.filterDateTo;
                    result = result.filter(l => l.Tanggal && l.Tanggal <= to);
                }
            }
            
            return result;
        },

        get filteredAllLogs() {
            if (!this.logs || !Array.isArray(this.logs)) return [];
            
            // All Logs: only real equipment logs (non-EXTERNAL)
            let result = this.logs.filter(l => 
                l.EquipmentID && 
                l.EquipmentID !== 'EXTERNAL'
            );
            
            // Date range filter
            if (this.filterDateFrom) {
                const from = this.filterDateFrom;
                result = result.filter(l => l.Tanggal && l.Tanggal >= from);
            }
            if (this.filterDateTo) {
                const to = this.filterDateTo;
                result = result.filter(l => l.Tanggal && l.Tanggal <= to);
            }
            
            return result;
        },

        get filteredParts() {
            if (!this.allParts || !Array.isArray(this.allParts)) return [];
            return this.allParts.filter(p => p.EquipmentID === this.selectedEquip?.EquipmentID);
        },

        get filteredPartsForLog() {
            if (!this.allParts || !Array.isArray(this.allParts)) return [];
            const equipId = this.logForm?.equipmentId;
            if (!equipId) return this.allParts;
            return this.allParts.filter(p => {
                if (!p) return false;
                let linkedIds = [];
                if (Array.isArray(p.EquipmentIDs)) {
                    linkedIds = p.EquipmentIDs;
                } else if (p.EquipmentIDs && typeof p.EquipmentIDs === 'string') {
                    linkedIds = p.EquipmentIDs.split(',').map(s => s.trim());
                } else if (p.EquipmentID) {
                    linkedIds = [p.EquipmentID];
                }
                return linkedIds.includes(equipId);
            });
        },



        // ponytail: chart methods (safeDeepClone, loadChartJS, safeCreateChart,
        // renderDashboardCharts, renderKPICharts) extracted to charts.js

        // --- PLANNING BOARD GETTERS & METHODS ---
        get planningWOs() {
            const wos = (this.activeWorkOrders && this.activeWorkOrders.length > 0)
                ? this.activeWorkOrders
                : (this.logs || []).filter(l => l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Draft' || l.Status === 'Approved'));
            return wos;
        },
        get planningTechList() {
            const techs = new Set();
            (this.planningWOs || []).forEach(w => { if (w.assignedTo) techs.add(w.assignedTo); });
            return Array.from(techs).sort();
        },
        get planningFilteredWOs() {
            let wos = this.planningWOs.filter(l => l.Jenis || l.Deskripsi || l.woNumber || l.EquipmentID);
            if (this.planningSearch) {
                const q = this.planningSearch.toLowerCase();
                wos = wos.filter(w => (w.woNumber||'').toLowerCase().includes(q) || (w.Deskripsi||'').toLowerCase().includes(q) || (w.assignedTo||'').toLowerCase().includes(q) || (w.EquipmentID||'').toLowerCase().includes(q));
            }
            if (this.planningFilterTech) wos = wos.filter(w => w.assignedTo === this.planningFilterTech);
            if (this.planningFilterPriority) wos = wos.filter(w => (w.woPriority || 'Normal') === this.planningFilterPriority);
            return wos;
        },
        planningFilteredByColumn(...statuses) {
            return (this.planningFilteredWOs || []).filter(w => statuses.includes(w.Status));
        },
        planningEquipName(id) {
            if (!id || !this.equipment) return id || '';
            const e = this.equipment.find(eq => eq.EquipmentID === id);
            return e ? (e.Nama || id) : id;
        },
        planningPriorityColor(priority) {
            const map = { 'Emergency': 'bg-red-500/20 text-red-400', 'Urgent': 'bg-orange-500/20 text-orange-400', 'Normal': 'bg-yellow-500/20 text-yellow-400', 'Planned': 'bg-emerald-500/20 text-emerald-400' };
            return map[priority] || 'bg-slate-500/20 text-slate-400';
        },
        planningDragStart(id) { this.planningDragging = id; },
        planningDragEnd() { this.planningDragging = null; this.planningDragOver = null; },
        planningDrop(newStatus) {
            if (!this.planningDragging) return;
            this.updateLogStatus(this.planningDragging, newStatus);
            this.planningDragging = null;
            this.planningDragOver = null;
        },
        planningMoveTo(wo, newStatus) {
            if (!wo || !wo.LogID) return;
            this.updateLogStatus(wo.LogID, newStatus);
            this.planningDetailWO = null;
        },
        updateLogStatus(logId, newStatus) {
            if (!logId || !newStatus) return;
            const log = (this.logs || []).find(l => l.LogID === logId);
            if (!log) return;
            const oldStatus = log.Status;
            log.Status = newStatus;
            // Optimistic update: update activeWorkOrders too
            const woIdx = (this.activeWorkOrders || []).findIndex(w => w.LogID === logId);
            if (woIdx >= 0) this.activeWorkOrders[woIdx].Status = newStatus;
            // Persist to Firebase
            try {
                window.update(window.ref(window.db, 'HistoryLog/' + logId), { Status: newStatus });
            } catch(e) {
                console.warn('Status update error:', e);
                log.Status = oldStatus; // rollback
                if (woIdx >= 0) this.activeWorkOrders[woIdx].Status = oldStatus;
            }
        },
        planningShowDetail(wo) { this.planningDetailWO = wo; },
        get planningMonths() {
            const months = [];
            const now = new Date();
            for (let i = -1; i <= 3; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                months.push({ label: d.toLocaleDateString('en-US', { month:'short', year:'numeric' }), month: d.getMonth(), year: d.getFullYear() });
            }
            return months;
        },
        get planningGanttDays() {
            const days = [];
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() + this.planningGanttScroll - 1, 1);
            const end = new Date(start.getFullYear(), start.getMonth() + 2, 0); // 2 months range
            for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
                const dateStr = d.toISOString().split('T')[0];
                days.push({
                    dateStr, date: d.getDate(), dayName: d.toLocaleDateString('en-US', { weekday:'narrow' }),
                    label: d.toLocaleDateString('en-US', { month:'short', day:'numeric' }),
                    isToday: dateStr === new Date().toISOString().split('T')[0],
                    isWeekend: d.getDay() === 0 || d.getDay() === 6
                });
            }
            return days;
        },
        planningGanttBar(wo) {
            // Calculate bar position based on Tanggal (start) and dueDate (end), or just Tanggal
            if (!wo.Tanggal && !wo.dueDate) return null;
            const days = this.planningGanttDays;
            if (!days || days.length === 0) return null;
            const dayW = 20; // width per day in px
            const startDate = wo.Tanggal || wo.dueDate;
            const endDate = wo.dueDate || wo.Tanggal || startDate;
            const startIdx = days.findIndex(d => d.dateStr === startDate);
            const endIdx = days.findIndex(d => d.dateStr === endDate);
            if (startIdx === -1 && endIdx === -1) return null;
            const left = Math.max(0, (startIdx >= 0 ? startIdx : 0)) * dayW;
            const end = (endIdx >= 0 ? endIdx : days.length - 1);
            const width = Math.max(dayW, (end - (startIdx >= 0 ? startIdx : 0) + 1) * dayW);
            return { left, width };
        },

        // --- TECHNICIAN WORKLOAD GETTERS ---
        get twActiveWOs() {
            return (this.activeWorkOrders && this.activeWorkOrders.length > 0 ? this.activeWorkOrders : [])
                .filter(w => w.Status !== 'Completed' && w.Status !== 'Cancelled');
        },
        get twTechList() {
            const techs = new Set();
            this.twActiveWOs.forEach(w => { if (w.assignedTo) techs.add(w.assignedTo); });
            return Array.from(techs).sort();
        },
        get twTotalHours() {
            return this.twFilteredTechs.reduce((sum, t) => sum + t.totalHours, 0);
        },
        get twOverloadCount() {
            return this.twFilteredTechs.filter(t => t.totalHours > 40).length;
        },
        get twFilteredTechs() {
            const from = this.twDateFrom || '';
            const to = this.twDateTo || '';
            // Filter WOs by date range
            const wos = this.twActiveWOs.filter(w => {
                const d = w.Tanggal || w.dueDate || '';
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            });
            // Group by technician
            const map = {};
            wos.forEach(w => {
                const name = w.assignedTo || 'Unassigned';
                if (!map[name]) map[name] = { name, wos: [], totalHours: 0 };
                map[name].wos.push(w);
                map[name].totalHours += Number(w.estimatedHours) || 0;
            });
            let result = Object.values(map);
            // Search filter
            if (this.twSearch) {
                const q = this.twSearch.toLowerCase();
                result = result.filter(t => t.name.toLowerCase().includes(q));
            }
            // Hide idle
            if (this.twHideZero) result = result.filter(t => t.wos.length > 0);
            result.sort((a, b) => (b.totalHours > 40 ? 1 : 0) - (a.totalHours > 40 ? 1 : 0) || b.totalHours - a.totalHours);
            return result;
        },

        // --- MONTHLY PLAN GETTERS ---
        get mpPMTasks() {
            const pm = this.pmList || [];
            if (!pm.length) return [];
            const monthStr = String(this.mpMonth + 1).padStart(2, '0');
            const yearStr = String(this.mpYear);
            return pm.filter(t => {
                if (!t.date) return false;
                const parts = t.date.split('-');
                if (parts.length < 2) return false;
                return parts[0] === yearStr && parts[1] === monthStr;
            }).slice(0, 200);
        },
        get mpOpenWOs() {
            const wos = (this.activeWorkOrders && this.activeWorkOrders.length > 0 ? this.activeWorkOrders : [])
                .filter(w => w.Status !== 'Completed' && w.Status !== 'Cancelled');
            if (!wos.length) return [];
            const monthStr = String(this.mpMonth + 1).padStart(2, '0');
            const yearStr = String(this.mpYear);
            return wos.filter(w => {
                const date = w.dueDate || w.Tanggal;
                if (!date) return false;
                const parts = date.split('-');
                if (parts.length < 2) return false;
                return parts[0] === yearStr && parts[1] === monthStr;
            }).slice(0, 200);
        },
        get mpTotalItems() { return this.mpPMTasks.length + this.mpOpenWOs.length; },
        get mpTotalHours() {
            const pmHrs = this.mpPMTasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
            const woHrs = this.mpOpenWOs.reduce((s, w) => s + (Number(w.estimatedHours) || 0), 0);
            return pmHrs + woHrs;
        },
        mpRefresh() { this.loadPMSchedule?.(); },
        mpEquipName(id) {
            if (!id || !this.equipment) return id;
            const eq = this.equipment.find(e => e.EquipmentID === id);
            return eq ? (eq.Nama || eq.EquipmentID) : id;
        },
        mpPriorityColor(priority) {
            const map = { Emergency: 'bg-rose-500/20 text-rose-400', Urgent: 'bg-orange-500/20 text-orange-400', Normal: 'bg-blue-500/20 text-blue-400', Planned: 'bg-emerald-500/20 text-emerald-400' };
            return map[priority] || 'bg-slate-500/20 text-slate-400';
        },
        async mpExportPDF() {
            this.mpLoading = true;
            try {
                const { jsPDF } = await import('jspdf');
                await import('jspdf-autotable');
                const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][this.mpMonth];
                const doc = new jsPDF('l', 'mm', 'a4');
                const pageW = doc.internal.pageSize.getWidth();

                // Header
                doc.setFillColor(225, 29, 72);
                doc.rect(0, 0, pageW, 30, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text(`MONTHLY MAINTENANCE PLAN - ${monthName} ${this.mpYear}`, 20, 18);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 25);
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.text(`PM Tasks: ${this.mpPMTasks.length}  |  Open WOs: ${this.mpOpenWOs.length}  |  Total Hours: ${this.mpTotalHours.toFixed(0)}`, pageW - 20, 25, { align: 'right' });

                // PM Tasks Table
                if (this.mpPMTasks.length > 0) {
                    doc.setFillColor(245, 158, 11);
                    doc.rect(18, 34, pageW - 36, 8, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.text('PM TASKS', 20, 40);

                    const pmBody = this.mpPMTasks.map((t, i) => [
                        i + 1, t.taskName || t.description || '-', this.mpEquipName(t.equipmentId),
                        t.date || '-', t.assignedTo || '-', t.status || 'pending', t.priority || 'Medium'
                    ]);
                    doc.autoTable({
                        startY: 44,
                        head: [['#', 'Task', 'Equipment', 'Date', 'Assigned To', 'Status', 'Priority']],
                        body: pmBody,
                        theme: 'grid',
                        headStyles: { fillColor: [55, 65, 81], fontSize: 7 },
                        bodyStyles: { fontSize: 6 },
                        margin: { left: 18, right: 18 },
                    });
                }

                // Open WOs Table
                const woStartY = this.mpPMTasks.length > 0 ? doc.lastAutoTable.finalY + 10 : 38;
                if (this.mpOpenWOs.length > 0) {
                    doc.setFillColor(8, 145, 178);
                    doc.rect(18, woStartY, pageW - 36, 8, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.text('OPEN WORK ORDERS', 20, woStartY + 6);

                    const woBody = this.mpOpenWOs.map((w, i) => [
                        i + 1, w.woNumber || w.LogID?.slice(0,8) || '-', this.mpEquipName(w.EquipmentID),
                        w.Deskripsi || w.Jenis || '-', w.dueDate || w.Tanggal || '-', w.assignedTo || '-',
                        w.woPriority || 'Normal'
                    ]);
                    doc.autoTable({
                        startY: woStartY + 10,
                        head: [['#', 'WO#', 'Equipment', 'Description', 'Due Date', 'Assigned To', 'Priority']],
                        body: woBody,
                        theme: 'grid',
                        headStyles: { fillColor: [55, 65, 81], fontSize: 7 },
                        bodyStyles: { fontSize: 6 },
                        margin: { left: 18, right: 18 },
                    });
                }

                doc.save(`Monthly_Plan_${monthName}_${this.mpYear}.pdf`);
                this.showNotification('Monthly Plan PDF exported!');
            } catch (e) {
                console.error('Export PDF error:', e);
                this.showNotification('Error exporting PDF: ' + e.message, 'error');
            } finally {
                this.mpLoading = false;
            }
        },

        // --- MTBF/MTTR GETTERS ---
        get mtbfResult() {
            if (!this.mtbfFilterEquip) return null;
            return this.calcMTBFMTTR?.(this.mtbfFilterEquip) || null;
        },
        mtbfRefresh() {
            this.mtbfFilterEquip = '';
            if (window._appCharts?.mtbfChart) { try { window._appCharts.mtbfChart.destroy(); } catch(e) {} }
            this.$nextTick(() => this.renderMTBFMTTRChart?.());
        },

        // --- LIFETIME HELPERS ---
        getPartLifetimeInfo(part) {
            if (!part) return null;
            return calculatePartLifetime(part.lastReplaceDate, part.avgLifetimeDays);
        },
        getLifetimeColorLabel(status) {
            return getLifetimeColor(status);
        },
        getLifetimeBgColorLabel(status) {
            return getLifetimeBgColor(status);
        },
        getPartStock(partId) {
            if (!partId || !this.allParts) return 0;
            const part = this.allParts.find(p => p.PartID === partId);
            return part ? Number(part.Stok) || 0 : 0;
        },
        // --- CROP ---
        showCropModal(imageSrc, cb) {
            this.cropImageSrc = imageSrc;
            this.cropCallback = cb;
            this.showCropModalOpen = true;
            this.$nextTick(() => {
                const img = document.getElementById('cropImage');
                if (!img) return;
                if (this._cropper) this._cropper.destroy();
                this._cropper = new Cropper(img, {
                    aspectRatio: NaN, viewMode: 1, autoCropArea: 1,
                    responsive: true, background: false,
                });
            });
        },
        applyCrop() {
            if (!this._cropper) return;
            this._cropper.getCroppedCanvas().toBlob((blob) => {
                if (this.cropCallback) this.cropCallback(blob);
                this._cropper.destroy();
                this._cropper = null;
                this.showCropModalOpen = false;
            }, 'image/jpeg', 0.92);
        },
        handleLogPhotoDrop(file) {
            if (!file || !file.type.startsWith('image/')) return;
            const max = 4 - (this.logForm.photos?.length || 0);
            if (max <= 0) { this.showNotification('Max 4 photos', 'error'); return; }
            const preview = URL.createObjectURL(file);
            this.showCropModal(preview, (croppedBlob) => {
                if (!this.logForm.photos) this.logForm.photos = [];
                if (this.logForm.photos.length >= 4) return;
                this.logForm.photos.push({ file: croppedBlob, preview: URL.createObjectURL(croppedBlob), base64: null });
            });
        },
    };
}
