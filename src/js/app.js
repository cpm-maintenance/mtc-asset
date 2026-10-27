// @ts-check
import { logger } from './logger.js';
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
import { chartToken } from './chart-palette.js';
import { enterpriseKPI } from './modules/enterprise-kpi.js';
import { errorHandlerModule } from './error-handler.js';
import { bootstrapModule } from './bootstrap.js';
import { whatsappModule } from './modules/whatsapp.js';
import { DEFAULT_EQUIP_FORM, DEFAULT_PART_FORM, DEFAULT_PERF_FORM } from './constants';
import { isLowStock, calculatePartLifetime, getLifetimeColor, getLifetimeBgColor, localDateStr } from './utils.js';

/** @typedef {import("./appstate").AppState} AppState */
/**
 * Object spread memanggil getter, sehingga setiap getter yang dideklarasikan di dalam
 * file modul (mis. `pmUpcomingList`, `pmOverdueCount`) ikut "membeku" menjadi nilai
 * statis saat `app()` dipanggil — nilainya tidak pernah berubah lagi setelah data
 * termuat (mis. `pmUpcomingList` selalu `[]`).
 *
 * Helper ini menyalin ulang accessor (get/set) dari modul-modul ke objek state akhir
 * sebagai accessor hidup, supaya Alpine tetap reaktif.
 *
 * @param {Record<string, any>} target Objek state hasil komposisi.
 * @param {Array<Record<string, any>>} sources Modul-modul yang di-spread.
 */
function reattachModuleGetters(target, sources) {
    for (const src of sources) {
        if (!src) continue;
        for (const key of Object.getOwnPropertyNames(src)) {
            const desc = Object.getOwnPropertyDescriptor(src, key);
            if (!desc || (!desc.get && !desc.set)) continue;
            Object.defineProperty(target, key, {
                get: desc.get,
                set: desc.set,
                enumerable: true,
                configurable: true,
            });
        }
    }
}

/**
 * Root Alpine app factory.
 * @returns {AppState} The composed app state (APP_STATE members + mixins).
 */
export function app() {
    const state = /** @type {AppState} */ ({
        // --- APP STATE ---
        currentPage: 'dash', sidebarCollapsed: false, activeTab: 'hist', search: '', searchPart: '', partFilterEquip: '',
        installPromptEvent: null, showInstallButton: false,
        async installApp() {
          if (!this.installPromptEvent) return;
          this.installPromptEvent.prompt();
          const result = await this.installPromptEvent.userChoice;
          this.installPromptEvent = null;
          this.showInstallButton = false;
          logger.debug('[PWA] Install result:', result.outcome);
        },
        // Work Order filters
        searchWO: '', filterWOStatus: '', filterWOPriority: '', filterDateFrom: '', filterDateTo: '', sortByScore: false,
        selectedWODetail: null,
        // Halaman Work Orders (design Stitch 'Work Orders Ledger', Tactical Slate):
        // mode tampilan ledger/kanban + filter sektor (Lokasi unit).
        woView: 'ledger', woSectorFilter: '', woLimit: 30,
        // Halaman Equipment (Tactical Slate): filter tipe, status, sektor, pagination & kpi
        equipSectorFilter: '', equipTypeFilter: '', equipStatusFilter: '', equipSortBy: 'name',
        // Halaman Spare Parts (Tactical Slate): filter status stock, sorting, limit pagination
        partStatusFilter: '', partSortBy: 'name', partLimit: 30,
        // Versi rilis untuk footer status strip. Di-inject vite.config `define`
        // (sumber: package.json); fallback 'dev' kalau dijalankan di luar Vite (vitest).
        appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',

        // Dashboard date range filter
        dashboardDateFrom: localDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        dashboardDateTo: localDateStr(),
        
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
        isEditingEquip: false, isEditingPart: false, isEditingLog: false,
        notifications: [], isLoading: true, html5QrCode: null, qrCodeDataUrl: '',
        themeMode: (() => { try { const m = localStorage.getItem('themeMode'); if (m) return m; const old = localStorage.getItem('darkMode'); if (old !== null) { const v = old === 'true' ? 'night' : 'light'; localStorage.setItem('themeMode', v); localStorage.removeItem('darkMode'); return v; } return 'night'; } catch { return 'night'; } })(),
        isLoggedIn: false, user: null,
        sidebarExpandedGroups: (() => {
            try {
                const saved = JSON.parse(localStorage.getItem('sidebarGroups') || 'null');
                if (saved && typeof saved === 'object') return saved;
            } catch {}
            // Default: dense groups collapsed so Dashboard (Monitoring) is first view
            return { Maintenance: false, 'Logs & Reports': false };
        })(),
        userRole: 'user', // 'admin' or 'user'
        
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
            } catch {}
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
        allLogsLimit: 30,
        allLogsJenisFilter: '',

        // --- PM SCHEDULE STATE ---
        pmView: 'calendar',
        pmMonthOffset: 0,
        pmFilterEquip: '',
        pmFilterStatus: '',
        pmSearch: '',
        pmFilterPriority: '',
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
                await import('./modules/audit.js');
                const { ref, query, limitToLast, get, db } = await import('./db.js');
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
            } catch (/** @type {any} */ e) {
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
            } catch { return dateStr?.substring(0, 10) || '-'; }
        },

        // ── Tactical Slate — Audit Trail telemetry & helper ─────────────────
        get auditKpi() {
            const rows = this.auditLogs || [];
            const count = (/** @type {string} */ kw) => rows.filter((/** @type {any} */ e) => (e.action || '').includes(kw)).length;
            const total = rows.length;
            const actors = new Set(rows.map((/** @type {any} */ e) => e.email || e.uid).filter(Boolean)).size;
            const admins = rows.filter((/** @type {any} */ e) => e.role === 'admin').length;
            return {
                total,
                actors,
                admins,
                shown: (this.filteredAudit || []).length,
                logins: count('Login'),
                creates: count('Create'),
                edits: count('Edit') + count('Update'),
                deletes: count('Delete'),
                approvals: count('Approve') + count('Complete'),
            };
        },

        auditActionTac(action) {
            const a = action || '';
            if (a.includes('Delete') || a.includes('Reject') || a.includes('Cancel')) return 'bg-tac-status-emergency/15 text-tac-status-emergency border-tac-status-emergency/30';
            if (a.includes('Create') || a === 'Login' || a.includes('Approve') || a.includes('Complete')) return 'bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/30';
            if (a.includes('Edit') || a.includes('Update')) return 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/30';
            return 'bg-tac-surface-container-highest text-tac-on-surface-variant border-tac-border-subtle';
        },

        auditMarkerTac(action) {
            const a = action || '';
            if (a.includes('Delete') || a.includes('Reject') || a.includes('Cancel')) return 'bg-tac-status-emergency';
            if (a.includes('Create') || a === 'Login' || a.includes('Approve') || a.includes('Complete')) return 'bg-tac-status-operational';
            if (a.includes('Edit') || a.includes('Update')) return 'bg-tac-status-repair';
            return 'bg-tac-status-standby';
        },

        auditIconTac(action) {
            const a = action || '';
            if (a.includes('Delete') || a.includes('Reject') || a.includes('Cancel')) return 'block';
            if (a === 'Login') return 'logout';
            if (a.includes('Create')) return 'add_circle';
            if (a.includes('Edit') || a.includes('Update')) return 'edit_note';
            if (a.includes('Approve') || a.includes('Complete')) return 'check_circle';
            return 'history';
        },

        auditRoleTac(role) {
            if (role === 'admin') return 'bg-tac-status-emergency/15 text-tac-status-emergency border-tac-status-emergency/30';
            if (role === 'supervisor') return 'bg-tac-primary/15 text-tac-primary border-tac-primary/30';
            return 'bg-tac-surface-container-highest text-tac-on-surface-variant border-tac-border-subtle';
        },

        // ── Tactical Slate — Performance telemetry ──────────────────────────
        get perfKpi() {
            const rows = this.getFilteredPerfData() || [];
            const total = rows.length;
            const sum = (/** @type {(p: any) => number} */ fn) =>
                rows.reduce((/** @type {number} */ a, /** @type {any} */ p) => a + fn(p), 0);
            const round1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
            const kpiOf = (/** @type {any} */ p) => this.calculateKPI(p) || { ma: 0, pa: 0, gap: 0 };
            return {
                total,
                bd: round1(sum((/** @type {any} */ p) => Number(p.bd || 0))),
                events: sum((/** @type {any} */ p) => (p.events ? p.events.length : 0)),
                autoBd: rows.filter((/** @type {any} */ p) => p.bdSource === 'wo').length,
                avgMa: total ? round1(sum((/** @type {any} */ p) => Number(kpiOf(p).ma)) / total) : 0,
                avgPa: total ? round1(sum((/** @type {any} */ p) => Number(kpiOf(p).pa)) / total) : 0,
                avgGap: total ? round1(sum((/** @type {any} */ p) => Number(kpiOf(p).gap)) / total) : 0,
            };
        },

        perfGapTac(gap) {
            return Number(gap) < 0 ? 'bg-tac-status-emergency' : 'bg-tac-status-operational';
        },

        // ── Tactical Slate — Monthly Plan helper ────────────────────────────
        get mpMonthName() {
            const names = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
            return names[Number(this.mpMonth)] || '-';
        },

        mpStatusTac(status) {
            const s = (status || 'pending').toLowerCase();
            if (s === 'completed') return 'bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/30';
            if (s === 'cancelled') return 'bg-tac-surface-container-highest text-tac-on-surface-variant border-tac-border-subtle';
            if (s === 'in progress') return 'bg-tac-sync-cyan/15 text-tac-sync-cyan border-tac-sync-cyan/30';
            return 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/30';
        },

        mpStatusMarkerTac(status) {
            const s = (status || 'pending').toLowerCase();
            if (s === 'completed') return 'bg-tac-status-operational';
            if (s === 'cancelled') return 'bg-tac-status-standby';
            if (s === 'in progress') return 'bg-tac-sync-cyan';
            return 'bg-tac-status-repair';
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
        
        // --- FORMS ---
        equipForm: DEFAULT_EQUIP_FORM(),
        partForm: DEFAULT_PART_FORM(),
        performanceForm: DEFAULT_PERF_FORM(),

        // --- TEMP STORAGE ---
        oldLogParts: [],
        tempEquipFile: null,

        // --- KPI & CHARTS STATE ---
        showPerformanceModal: false,
        isEditingPerformance: false,
        kpiFilter: 'yearly',
        kpiFilterDate: new Date().getFullYear().toString(),
        perfFilterEquip: '',
        perfFilterArea: '',
        // HM monotonik: cek saat submit di performance.js (via validate)
        perfPrevHM: {},
        enterpriseSummary: {},
        enterpriseKPIList: [],
        enterpriseCritical: [],
        enterpriseUpcomingPM: [],
        enterpriseCriticalWO: [],
        enterpriseLowStock: [],
        enterpriseInsights: [],
        enterpriseOEE: { oee: 0, status: 'N/A', availability: 0, performance: 0, quality: 0, toneColor: chartToken('neutral') },
        expandedEquip: null,
        plantFilter: '', deptFilter: '', kpiDateFrom: '', kpiDateTo: '',
        aiLoading: false,

        menuItems: [
            // `icon` = FontAwesome (dipakai nav mobile + drawer), `ms` = Material Symbols
            // (ikon design system Stitch, dipakai sidebar desktop). Nama `ms` harus
            // sama persis dengan nama ikon di fonts.google.com/icons.
            // --- MONITORING ---
            { id: 'dash', name: 'Dashboard', short: 'Home', ms: 'dashboard', mobile: true, group: 'Monitoring' },

            // --- MAINTENANCE ---
            { id: 'wo', name: 'Work Orders', short: 'WO', ms: 'engineering', mobile: true, group: 'Maintenance' },
            { id: 'pms', name: 'PM Schedule', short: 'PM', ms: 'calendar_month', mobile: true, allowedRole: 'supervisor', group: 'Maintenance' },
            { id: 'equip', name: 'Equipment', short: 'Assets', ms: 'precision_manufacturing', mobile: true, group: 'Maintenance' },

            // --- PLANNING ---
            { id: 'planning', name: 'Planning Board', short: 'Plan', ms: 'view_kanban', mobile: true, allowedRole: 'supervisor', group: 'Planning' },
            { id: 'monthlyplan', name: 'Monthly Plan', short: 'Monthly', ms: 'description', mobile: true, allowedRole: 'supervisor', group: 'Planning' },
            { id: 'workload', name: 'Workload', short: 'Load', ms: 'group_work', mobile: true, allowedRole: 'supervisor', group: 'Planning' },

            // --- LOGS & REPORTS ---
            { id: 'hist', name: 'All Logs', short: 'Logs', ms: 'history', mobile: true, group: 'Logs & Reports' },
            { id: 'history', name: 'History Card', short: 'History', ms: 'fact_check', mobile: true, group: 'Logs & Reports' },
            { id: 'audit', name: 'Audit Trail', short: 'Audit', ms: 'receipt_long', mobile: false, allowedRole: 'admin', group: 'Logs & Reports' },

            // --- INVENTORY ---
            { id: 'parts', name: 'Spare Parts', short: 'Parts', ms: 'inventory_2', mobile: true, group: 'Inventory' },
            { id: 'request', name: 'Request Part', short: 'Request', ms: 'shopping_cart', mobile: true, group: 'Inventory' },

            // --- ANALYTICS (U-3: dikonsolidasi menjadi satu entri "Analytics Hub") ---
            { id: 'analytics', name: 'Analytics Hub', short: 'Analytics', ms: 'monitoring', mobile: true, allowedRole: 'supervisor', group: 'Analytics' },
            // Sub-view lama tetap terdaftar sebagai `hidden` supaya deep-link, guard akses,
            // dan watcher chart per-halaman (kpi/enterprise) tetap berfungsi apa adanya.
            { id: 'perf', name: 'Performance', short: 'Perf', ms: 'trending_up', mobile: false, hidden: true, allowedRole: 'supervisor', group: 'Analytics' },
            { id: 'mtbfmttr', name: 'MTBF/MTTR', short: 'MTBF', ms: 'show_chart', mobile: false, hidden: true, allowedRole: 'supervisor', group: 'Analytics' },
            { id: 'enterprise', name: 'Enterprise KPI', short: 'Ent KPI', ms: 'factory', mobile: false, hidden: true, allowedRole: 'admin', group: 'Analytics' },
            { id: 'kpi', name: 'KPI Analytics', short: 'KPI', ms: 'psychology', mobile: false, hidden: true, allowedRole: 'admin', group: 'Analytics' },
            { id: 'ai', name: 'AI Analysis', short: 'AI', ms: 'neurology', mobile: false, hidden: true, allowedRole: 'admin', group: 'Analytics' },
        ],

        // Pencarian menu di header (design Stitch) — memfilter daftar menu sidebar.
        // Ctrl+K memfokuskan input ini (lihat header di index.html).
        menuSearch: '',

        get filteredMenuGroups() {
            const q = (this.menuSearch || '').trim().toLowerCase();
            const groups = this.menuGroups || [];
            if (!q) return groups;
            return groups
                .map((/** @type {any} */ g) => ({ ...g, items: (g.items || []).filter((/** @type {any} */ i) => (i.name || '').toLowerCase().includes(q)) }))
                .filter((/** @type {any} */ g) => g.items.length > 0);
        },

        // --- MOBILE PRIMARY NAV (5 slots + More) ---
        get mobilePrimaryItems() {
            const ids = ['dash', 'wo', 'equip', 'parts'];
            return ids.map(id => this.menuItems.find(m => m.id === id)).filter(Boolean);
        },

        // --- ROLE-BASED NAVIGATION ---
        get menuGroups() {
            /** @type {Record<string, {name: string, items: any[]}>} */
            const groups = {};
            this.menuItems.filter(m => !m.hidden && this.canAccess(m)).forEach(item => {
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
            try { localStorage.setItem('sidebarGroups', JSON.stringify(this.sidebarExpandedGroups)); } catch {}
        },
        navigateTo(pageId) {
            const page = this.menuItems.find(m => m.id === pageId);
            if (page && !this.canAccess(page)) {
                this.showNotification("Access denied", "error");
                return;
            }
            this.currentPage = pageId;
        },

        // ── U-3: ANALYTICS HUB (konsolidasi 5 menu analytics) ──
        /** Sub-view Analytics Hub; `id` = id halaman lama agar watcher chart tetap jalan. */
        analyticsTabs: [
            { id: 'perf', name: 'Performance', short: 'Perf', ms: 'trending_up', allowedRole: 'supervisor' },
            { id: 'mtbfmttr', name: 'MTBF / MTTR', short: 'MTBF', ms: 'show_chart', allowedRole: 'supervisor' },
            { id: 'kpi', name: 'KPI Analytics', short: 'KPI', ms: 'psychology', allowedRole: 'admin' },
            { id: 'enterprise', name: 'Enterprise KPI', short: 'Ent KPI', ms: 'factory', allowedRole: 'admin' },
            { id: 'ai', name: 'AI Advisor', short: 'AI', ms: 'neurology', allowedRole: 'admin' },
        ],
        /** Sub-view terakhir yang dibuka (dipakai saat klik entri "Analytics Hub"). */
        analyticsTab: 'perf',
        get legacyAnalyticsIds() {
            return this.analyticsTabs.map(t => t.id);
        },
        /** true bila halaman aktif adalah salah satu sub-view Analytics Hub. */
        get isAnalyticsPage() {
            return this.legacyAnalyticsIds.includes(this.currentPage);
        },
        /** Sub-view yang boleh diakses role aktif (user biasa tidak dapat analytics sama sekali). */
        get availableAnalyticsTabs() {
            return this.analyticsTabs.filter(t => this.canAccess(t));
        },
        /** Pindah sub-tab Analytics Hub. */
        setAnalyticsTab(tabId) {
            const tab = this.availableAnalyticsTabs.find(t => t.id === tabId);
            if (!tab) {
                this.showNotification('Access denied', 'error');
                return;
            }
            this.analyticsTab = tabId;
            this.navigateTo(tabId);
        },
        /** Klik entri sidebar: "Analytics Hub" membuka sub-view terakhir yang diizinkan. */
        openMenuItem(itemId) {
            if (itemId !== 'analytics') return this.navigateTo(itemId);
            const tabs = this.availableAnalyticsTabs;
            if (!tabs.length) {
                this.showNotification('Access denied', 'error');
                return;
            }
            const last = tabs.find(t => t.id === this.analyticsTab) || tabs[0];
            this.analyticsTab = last.id;
            this.navigateTo(last.id);
        },
        /** Highlight sidebar: entri "Analytics Hub" tetap aktif di semua sub-view-nya. */
        isMenuActive(itemId) {
            if (itemId === 'analytics') return this.isAnalyticsPage;
            return this.currentPage === itemId;
        },
        /** Judul header — semua sub-view Analytics Hub tampil sebagai "Analytics Hub". */
        get currentPageName() {
            if (this.isAnalyticsPage) return 'Analytics Hub';
            const m = this.menuItems.find(i => i.id === this.currentPage);
            return m ? m.name : '';
        },

        // --- SIDEBAR BADGE COUNTS ---
        get openWOCount() {
            return (this.logs || []).filter(l => l.Status && l.Status !== 'Completed').length;
        },

        /**
         * U-4: WO yang menandakan unit sedang stop / kritis dan belum ditutup.
         * Dipakai banner darurat di paling atas Dashboard.
         * Kriteria: prioritas Emergency/Urgent, atau jenis pekerjaan Breakdown.
         */
        get criticalDowntimeList() {
            const CLOSED = ['Completed', 'Cancelled', 'Rejected'];
            return (this.logs || [])
                .filter(l => l && !CLOSED.includes(l.Status))
                .filter(l => l.woPriority === 'Emergency' || l.woPriority === 'Urgent' || l.Jenis === 'Breakdown')
                .map(l => {
                    const eq = (this.equipment || []).find(e => e && e.EquipmentID === l.EquipmentID);
                    const isEmergency = l.woPriority === 'Emergency' || l.Jenis === 'Breakdown';
                    return {
                        log: l,
                        woNumber: l.woNumber || l.LogID || '-',
                        equipName: (eq && eq.Nama) || l.externalEquipName || l.EquipmentID || 'Unknown unit',
                        priority: l.woPriority || (l.Jenis === 'Breakdown' ? 'Emergency' : 'Urgent'),
                        isEmergency,
                        ageDays: this.woAgeDays(l),
                        downtime: Number(l.Downtime) || 0,
                    };
                })
                .sort((a, b) => (Number(b.isEmergency) - Number(a.isEmergency)) || (b.ageDays - a.ageDays));
        },
        get criticalDowntimeCount() {
            return this.criticalDowntimeList.length;
        },
        /** U-4: label aksesibel, mis. "2 units need immediate attention" */
        get criticalDowntimeLabel() {
            const n = this.criticalDowntimeCount;
            if (!n) return '';
            return n + (n === 1 ? ' unit needs immediate attention' : ' units need immediate attention');
        },

        // ── WO Age / Backlog Aging (R1) ──
        woAgeDays(log) {
            if (!log || !log.Tanggal) return 0;
            const t = new Date(log.Tanggal);
            if (isNaN(t.getTime())) return 0;
            return Math.floor((Date.now() - t.getTime()) / 86400000);
        },
        woAgeBucket(days) {
            if (days <= 1) return '0-1d';
            if (days <= 3) return '1-3d';
            if (days <= 7) return '3-7d';
            return '7d+';
        },
        woAgeColor(days) {
            if (days <= 1) return 'text-tac-status-operational bg-tac-status-operational/10 border-tac-status-operational/20';
            if (days <= 3) return 'text-tac-status-repair bg-tac-status-repair/10 border-tac-status-repair/20';
            if (days <= 7) return 'text-tac-status-repair bg-tac-status-repair/20 border-tac-status-repair/40';
            return 'text-tac-status-emergency bg-tac-status-emergency/10 border-tac-status-emergency/20';
        },
        woAgeClass(days) {
            if (days <= 1) return 'border-l-tac-status-operational';
            if (days <= 3) return 'border-l-tac-status-repair';
            if (days <= 7) return 'border-l-tac-status-repair';
            return 'border-l-tac-status-emergency';
        },
        get backlogAging() {
            const wos = (this.logs || []).filter(l => l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Approved' || l.Status === 'In Progress'));
            /** @type {Record<string, number>} */
            const buckets = { '0-1d': 0, '1-3d': 0, '3-7d': 0, '7d+': 0 };
            wos.forEach(l => { const d = this.woAgeDays(l); if (d >= 0) buckets[this.woAgeBucket(d)]++; });
            return buckets;
        },
        // ══ Work Orders Ledger (design Stitch 'Work Orders Ledger', Tactical Slate) ══
        // Semua angka di halaman Work Orders diambil dari sini — tidak ada nilai contoh.
        /** Sektor unit = `Lokasi` equipment; dipakai filter sektor + badge kartu. */
        woSectorOf(equipId) {
            if (!equipId) return 'UNASSIGNED';
            if (equipId === 'EXTERNAL') return 'EXTERNAL';
            if (!this._sectorMap || this._sectorMapRef !== this.equipment) {
                this._sectorMap = new Map((this.equipment || []).map(e => [e.EquipmentID, e.Lokasi || 'UNASSIGNED']));
                this._sectorMapRef = this.equipment;
            }
            return this._sectorMap.get(equipId) || 'UNASSIGNED';
        },
        get woSectorOptions() {
            const set = new Set();
            (this.equipment || []).forEach(e => { if (e && e.Lokasi) set.add(e.Lokasi); });
            return [...set].sort();
        },
        /** WO setelah semua filter (search/status/prioritas/tanggal + sektor). Hasil di-cache. */
        get woFiltered() {
            // Alpine mengevaluasi getter berulang tiap render (dan `woKanbanColumns`,
            // `woSelected`, `woNextInQueue`, `woVisible` semuanya memanggil ini) —
            // tanpa cache, satu render = puluhan kali filter+sort atas seluruh `logs`.
            const key = [
                this.searchWO, this.filterWOStatus, this.filterWOPriority,
                this.filterDateFrom, this.filterDateTo, this.sortByScore, this.woSectorFilter,
            ].join('\u0001');
            if (this._woFilterCache && this._woFilterKey === key && this._woFilterLogsRef === this.logs) {
                return this._woFilterCache;
            }
            const list = this.sortByScore ? this.sortedByPriority : this.filteredWorkOrders;
            const out = this.woSectorFilter
                ? list.filter((/** @type {any} */ l) => this.woSectorOf(l.EquipmentID) === this.woSectorFilter)
                : list;
            this._woFilterKey = key;
            this._woFilterLogsRef = this.logs;
            this._woFilterCache = out;
            return out;
        },
        /**
         * Potongan yang benar-benar dirender (P1 — batas render).
         * Tanpa ini, 200 WO = ±13.800 node DOM dan ±8 s di CPU mobile 4×.
         * Pola sama seperti `filteredAllLogs` + `allLogsLimit` di All Logs.
         */
        // --- Multi-select: Work Orders (pilih banyak, hapus massal) ---
        /** @param {string} id */
        toggleWOSelect(id) {
            if (!Array.isArray(this.woSelectedIds)) this.woSelectedIds = [];
            const i = this.woSelectedIds.indexOf(id);
            if (i >= 0) this.woSelectedIds.splice(i, 1);
            else this.woSelectedIds.push(id);
        },
        get woAllVisibleSelected() {
            const rows = this.woVisible || [];
            return rows.length > 0 && rows.every((/** @type {any} */ r) => (this.woSelectedIds || []).includes(r.LogID));
        },
        toggleSelectAllWOs() {
            const rows = this.woVisible || [];
            if (!Array.isArray(this.woSelectedIds)) this.woSelectedIds = [];
            const all = rows.length > 0 && rows.every((/** @type {any} */ r) => this.woSelectedIds.includes(r.LogID));
            this.woSelectedIds = all ? [] : rows.map((/** @type {any} */ r) => r.LogID);
        },
        async bulkDeleteWOs() {
            await this.bulkDeleteItems('HistoryLog', this.woSelectedIds || [], 'work order');
            this.woSelectedIds = [];
        },

        woSelectedIds: [],
        get woVisible() {
            return this.woFiltered.slice(0, this.woLimit || 30);
        },
        get canLoadMoreWO() {
            return this.woFiltered.length > this.woVisible.length;
        },
        loadMoreWO() {
            if (this.canLoadMoreWO) this.woLimit = (this.woLimit || 30) + 30;
        },
        /** Kanban Stack: WO dikelompokkan per status workflow. */
        get woKanbanColumns() {
            const visible = this.woVisible;
            return ['Pending', 'Approved', 'In Progress', 'Completed'].map(status => ({
                status,
                items: visible.filter((/** @type {any} */ l) => (l.Status || 'Pending') === status),
            }));
        },
        /** WO yang sedang dibuka di inspector kanan. */
        get woSelected() {
            const id = this.selectedWODetail;
            if (!id) return null;
            return this.woFiltered.find((/** @type {any} */ l) => l.LogID === id)
                || (this.logs || []).find((/** @type {any} */ l) => l.LogID === id)
                || null;
        },
        /** Antrian berikutnya (kartu 'NEXT IN QUEUE'). */
        get woNextInQueue() {
            const id = this.selectedWODetail;
            const list = this.woFiltered.filter((/** @type {any} */ l) => l.LogID !== id && l.Status !== 'Completed' && l.Status !== 'Cancelled');
            return list.length ? list[0] : null;
        },
        /** Jumlah WO per status (seluruh ledger, bukan hasil filter). Hasil di-cache. */
        get woCounts() {
            if (this._woCountsCache && this._woCountsLogsRef === this.logs) return this._woCountsCache;
            const out = { all: 0, Draft: 0, Pending: 0, Approved: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
            (this.logs || []).forEach(l => {
                if (!l || !l.woNumber) return;
                out.all++;
                const s = l.Status || 'Pending';
                if (s in out) (/** @type {Record<string, number>} */ (out))[s]++;
            });
            this._woCountsLogsRef = this.logs;
            this._woCountsCache = out;
            return out;
        },
        /** KPI deck Work Orders. MTTR/biaya/downtime/spares — semua dari data nyata. Hasil di-cache. */
        get woKpi() {
            if (this._woKpiCache && this._woKpiLogsRef === this.logs && this._woKpiPartsRef === this.allParts) {
                return this._woKpiCache;
            }
            const logs = (this.logs || []).filter(l => l && l.woNumber);
            const open = logs.filter(l => l.Status !== 'Completed' && l.Status !== 'Cancelled');
            const byStatus = (/** @type {string} */ s) => logs.filter(l => (l.Status || 'Pending') === s).length;
            const repairs = (this.logs || []).filter(l => l && (l.Jenis === 'Breakdown' || l.Jenis === 'Repair'));
            const downSum = repairs.reduce((s, l) => s + (Number(l.Downtime) || 0), 0);
            const partMap = this.partsMap();
            const partIds = new Set();
            let partsQty = 0, partsValue = 0;
            open.forEach(l => this.parsePartsUsed(l.PartsUsed).forEach((/** @type {any} */ p) => {
                const q = Number(p.qty) || 0;
                partsQty += q;
                partIds.add(p.id);
                const pr = partMap.get(p.id);
                if (pr) partsValue += q * (Number(pr.Harga) || 0);
            }));
            const today = localDateStr();
            const result = {
                total: logs.length,
                open: open.length,
                inProgress: byStatus('In Progress'),
                pending: byStatus('Pending') + byStatus('Draft'),
                completed: byStatus('Completed'),
                emergency: open.filter(l => l.woPriority === 'Emergency' || l.Jenis === 'Breakdown').length,
                overdue: open.filter(l => l.dueDate && l.dueDate < today).length,
                aging: open.filter(l => this.woAgeDays(l) > 3).length,
                mttr: repairs.length ? Math.round((downSum / repairs.length) * 10) / 10 : 0,
                downtimeOpen: open.reduce((s, l) => s + (Number(l.Downtime) || 0), 0),
                cost: logs.reduce((s, l) => s + (Number(l.Cost) || 0), 0),
                partsQty, partsValue, partsCount: partIds.size,
            };
            this._woKpiLogsRef = this.logs;
            this._woKpiPartsRef = this.allParts;
            this._woKpiCache = result;
            return result;
        },
        /** Map PartID → part. Di-cache; dibangun ulang hanya kalau `allParts` berganti referensi. */
        partsMap() {
            if (!this._partsMap || this._partsMapRef !== this.allParts) {
                this._partsMap = new Map((this.allParts || []).map(p => [p.PartID, p]));
                this._partsMapRef = this.allParts;
            }
            return this._partsMap;
        },
        /** Parts yang dipakai satu WO + status stoknya (inspector). */
        woParts(log) {
            const map = this.partsMap();
            return this.parsePartsUsed(log && log.PartsUsed).map((/** @type {any} */ p) => {
                const pr = map.get(p.id);
                const stok = pr ? Number(pr.Stok) || 0 : 0;
                return {
                    id: p.id,
                    qty: p.qty,
                    name: (pr && (pr.NamaSingkat || pr.NamaPart)) || p.id,
                    stok,
                    ok: stok >= p.qty,
                };
            });
        },
        /** Foto bukti lapangan satu WO (maks 4). */
        woPhotos(log) {
            if (!log) return [];
            let raw = log.PhotoURLs;
            if (typeof raw === 'string' && raw.trim()) {
                try { raw = JSON.parse(raw); } catch { raw = [raw]; }
            }
            if (!Array.isArray(raw)) raw = log.PhotoURL ? [log.PhotoURL] : [];
            return raw.filter(Boolean).slice(0, 4);
        },
        /** Kelas token `tac` untuk pill status WO. */
        woStatusTac(status) {
            const s = status || 'Pending';
            if (s === 'Completed') return 'bg-tac-status-operational/15 text-tac-status-operational';
            if (s === 'In Progress') return 'bg-tac-sync-cyan/15 text-tac-sync-cyan';
            if (s === 'Approved') return 'bg-tac-secondary/15 text-tac-secondary';
            if (s === 'Cancelled' || s === 'Rejected') return 'bg-tac-status-emergency/15 text-tac-status-emergency';
            return 'bg-tac-status-repair/15 text-tac-status-repair';
        },
        /** Kelas token `tac` untuk pill prioritas WO. */
        woPriorityTac(prio) {
            const p = prio || 'Normal';
            if (p === 'Emergency') return 'bg-tac-status-emergency/20 text-tac-status-emergency';
            if (p === 'Urgent') return 'bg-tac-status-repair/20 text-tac-status-repair';
            if (p === 'Planned') return 'bg-tac-secondary/15 text-tac-secondary';
            return 'bg-tac-surface-container-highest text-tac-on-surface-variant';
        },
        /** Bar penanda kiri kartu ledger. */
        woMarkerTac(log) {
            const s = (log && log.Status) || 'Pending';
            const p = (log && log.woPriority) || 'Normal';
            if (s === 'Completed') return 'bg-tac-status-operational';
            if (s === 'Cancelled' || s === 'Rejected') return 'bg-tac-status-standby';
            if (p === 'Emergency' || (log && log.Jenis === 'Breakdown')) return 'bg-tac-status-emergency';
            if (s === 'In Progress') return 'bg-tac-sync-cyan';
            if (p === 'Urgent') return 'bg-tac-status-repair';
            return 'bg-tac-status-standby';
        },
        /** Umur WO sejak `Tanggal` → "3d 4h" / "5h 20m". */
        woElapsed(log) {
            if (!log || !log.Tanggal) return '-';
            const t = new Date(log.Tanggal);
            if (isNaN(t.getTime())) return '-';
            const mins = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
            const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60);
            return d > 0 ? d + 'd ' + h + 'h' : h + 'h ' + (mins % 60) + 'm';
        },
        /** Sparkline downtime (path SVG 160×20) dari 14 catatan performance terakhir. */
        get woDowntimeSpark() {
            const perf = (this.performanceData || []).slice(-14);
            if (perf.length < 2) return '';
            const vals = perf.map(p => (Number(p.bd) || 0) + (Number(p.stb) || 0));
            const max = Math.max(...vals, 1);
            const step = 160 / (vals.length - 1);
            return vals
                .map((v, i) => `${i === 0 ? 'M' : 'L'}${Math.round(i * step)} ${Math.round(18 - (v / max) * 16)}`)
                .join(' ');
        },
        /** Format rupiah ringkas. */
        rp(n) {
            return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
        },
        /** Format rupiah padat (jt/M/T) supaya angka besar tidak meluber dari kartu KPI. */
        rpShort(n) {
            const v = Math.abs(Number(n) || 0);
            if (v >= 1e12) return 'Rp ' + (v / 1e12).toFixed(1).replace('.', ',') + ' T';
            if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(1).replace('.', ',') + ' M';
            if (v >= 1e6) return 'Rp ' + (v / 1e6).toFixed(1).replace('.', ',') + ' jt';
            if (v >= 1e3) return 'Rp ' + Math.round(v / 1e3) + ' rb';
            return 'Rp ' + Math.round(v);
        },

        // ── Priority Scoring Matrix (R2) ──
        // Score = WO priority (0-3) + asset criticality (0-3) + health risk (0-3) → 0-9
        woPrioScore(wo) {
            /** @type {Record<string, number>} */
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
            /** @type {Record<string, number>} */
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
            if (score >= 7) return 'bg-tac-status-emergency/20 text-tac-status-emergency border-tac-status-emergency/30';
            if (score >= 4) return 'bg-tac-status-repair/20 text-tac-status-repair border-tac-status-repair/30';
            return 'bg-tac-status-standby/15 text-tac-status-standby border-tac-status-standby/20';
        },
        // ── R7: MTTR per technician ──
        mttrByTech() {
            if (this._mttrCache && this._mttrCacheRef === this.logs) return this._mttrCache.list;
            /** @type {Record<string, {repairs: number, totalDown: number, breakdowns: number}>} */
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
            /** @type {any[]} */
            const results = [];
            (this.pmList || []).forEach(pm => {
                if (!pm || !pm.equipmentId || !pm.date || pm.status !== 'completed') return;
                const pmDate = new Date(pm.date);
                if (isNaN(pmDate.getTime())) return;
                const failures = (this.logs || []).filter(l =>
                    l && l.EquipmentID === pm.equipmentId && l.Jenis === 'Breakdown' &&
                    l.Tanggal && (() => {
                        const d = new Date(l.Tanggal);
                        const diff = (d.getTime() - pmDate.getTime()) / 86400000;
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
                .map((/** @type {any} */ l) => ({ ...l, _score: this.backlogScore(l) }))
                .sort((/** @type {any} */ a, /** @type {any} */ b) => b._score - a._score);
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
            // U-1: samakan semantik dengan alert dashboard — hitung hanya part yang
            // punya MinStock > 0 dan stok <= MinStock; fallback ke flag tersimpan.
            return (this.allParts || []).filter(p => {
                if (!p) return false;
                const min = Number(p.MinStock);
                if (min > 0) return Number(p.Stok) <= min;
                return p.isLowStock === true;
            }).length;
        },
        get pendingReqCount() {
            return (this.requisitions || []).filter(r => r.status === 'pending').length;
        },
        badgeCount(itemId) {
            /** @type {Record<string, any>} */
            const map = {
                wo: this.openWOCount,
                pms: this.pmOverdueCount,
                parts: this.lowStockCount,
                request: this.pendingReqCount,
            };
            const c = Number(map[itemId]) || 0;
            return c > 0 ? c : '';
        },
        /**
         * U-1: warna badge per menu — `error-container` untuk yang benar-benar mendesak
         * (PM overdue & stok kritis), `primary-container` untuk beban kerja biasa.
         *
         * Pasangan container/on-container dipakai, bukan `bg-tac-status-emergency` solid +
         * teks terang: pasangan itu lolos AA di keempat tema (7,2:1 night · 6,9:1 light),
         * sedangkan teks terang di atas #ef4444 hanya ~3,8:1.
         */
        badgeClass(itemId) {
            if (!this.badgeCount(itemId)) return '';
            if (itemId === 'pms' || itemId === 'parts') return 'bg-tac-error-container text-tac-on-error-container';
            return 'bg-tac-primary-container text-tac-on-primary-container';
        },
        /** U-1: label aksesibel, mis. "3 open work orders" */
        badgeLabel(itemId, itemName) {
            const c = this.badgeCount(itemId);
            if (!c) return '';
            const noun = /** @type {Record<string, string>} */ ({
                wo: 'open work order',
                pms: 'overdue PM task',
                parts: 'low stock part',
                request: 'pending part request',
            })[itemId] || (itemName ? String(itemName).toLowerCase() : 'item');
            return c + ' ' + noun + (Number(c) === 1 ? '' : 's');
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
        ...whatsappModule,
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
            Object.values(window._appCharts || {}).forEach(c => { if(c) { try { c.destroy(); } catch {} } });
            window._appCharts = { status: null, cost: null, downtime: null, reliability: null, woCompletion: null };
            if (this.currentPage === 'dash') this.renderDashboardCharts();
        },
        setDashboardPreset(days) {
            if (days === 0) {
                this.dashboardDateFrom = '';
                this.dashboardDateTo = '';
            } else {
                this.dashboardDateFrom = localDateStr(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
                this.dashboardDateTo = localDateStr();
            }
            this.applyDashboardFilter();
        },

        get heroHUD() {
            const from = this.dashboardDateFrom || '';
            const to = this.dashboardDateTo || '';
            const inRange = (/** @type {any} */ d) => !d || ((!from || d >= from) && (!to || d <= to));

            // 1. Plant Availability (PA %) & Overall Health
            const perf = this.performanceData || [];
            const avgPA = perf.length > 0
                ? Number((perf.reduce((s, p) => {
                    const wh = Number(p.wh) || 24, bd = Number(p.bd) || 0, stb = Number(p.stb) || 0;
                    return s + (wh > 0 ? ((wh - bd - stb) / wh) * 100 : 0);
                }, 0) / perf.length).toFixed(1))
                : 90.0;
            const paTarget = 90.0;
            const paStatus = avgPA >= paTarget ? 'Optimal' : (avgPA >= 80 ? 'Warning' : 'Critical');
            const paColor = avgPA >= paTarget ? 'emerald' : (avgPA >= 80 ? 'amber' : 'rose');

            // 2. Reliability Core: MTBF & MTTR
            /** @type {any[]} */
            const logs = this.logs || [];
            const breakdowns = logs.filter(l => l && l.Jenis === 'Breakdown');
            const totalBD = breakdowns.length;
            const totalBDHrs = breakdowns.reduce((s, l) => s + (Number(l.Downtime) || 0), 0);
            const equipIds = [...new Set((this.equipment || []).map(e => e.EquipmentID))];
            const mtbfs = equipIds.map(id => Number(this.calculateMTBF?.(id))).filter(v => v > 0);
            const mtbfVal = mtbfs.length > 0 ? (mtbfs.reduce((a, b) => a + b, 0) / mtbfs.length).toFixed(1) : '—';
            const mttrVal = totalBD > 0 ? (totalBDHrs / totalBD).toFixed(1) : '0.0';

            // 3. Work Order Health & Execution
            const wos = (this.logs || []).filter(l => l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Approved' || l.Status === 'Completed' || l.Status === 'In Progress') && inRange(l.Tanggal));
            const woTotal = wos.length;
            const woDone = wos.filter(l => l.Status === 'Completed').length;
            const woInProgress = wos.filter(l => l.Status === 'In Progress').length;
            const woPending = wos.filter(l => l.Status !== 'Completed' && l.Status !== 'In Progress').length;
            const woRate = woTotal > 0 ? Math.round((woDone / woTotal) * 100) : 0;

            // 4. PM Compliance & Overdue Risk
            const pmc = this.calcPMCompliance ? this.calcPMCompliance() : { pct: 100, overdue: 0, total: 0 };
            const overduePM = this.dashAlerts?.overduePM ?? pmc.overdue;

            return {
                pa: { val: avgPA, status: paStatus, color: paColor, target: paTarget },
                reliability: { mtbf: mtbfVal, mttr: mttrVal, breakdowns: totalBD },
                wo: { total: woTotal, done: woDone, inProgress: woInProgress, pending: woPending, rate: woRate },
                pm: { pct: pmc.pct, overdue: overduePM, total: pmc.total }
            };
        },

        get actionableWOs() {
            const CLOSED = ['Completed', 'Cancelled', 'Rejected'];
            return (this.logs || [])
                .filter(l => l && (l.woNumber || l.Jenis) && !CLOSED.includes(l.Status))
                .map(l => {
                    const eq = (this.equipment || []).find(e => e && e.EquipmentID === l.EquipmentID);
                    const prioScore = l.woPriority === 'Emergency' ? 4 : (l.woPriority === 'Urgent' ? 3 : (l.woPriority === 'Normal' ? 2 : 1));
                    const isBD = l.Jenis === 'Breakdown';
                    return {
                        log: l,
                        woNumber: l.woNumber || l.LogID || '-',
                        equipName: (eq && eq.Nama) || l.externalEquipName || l.EquipmentID || 'General Asset',
                        desc: l.Deskripsi || l.Jenis || 'Maintenance Task',
                        priority: l.woPriority || (isBD ? 'Emergency' : 'Normal'),
                        status: l.Status || 'Pending',
                        ageDays: this.woAgeDays(l),
                        prioScore: isBD ? 5 : prioScore,
                    };
                })
                .sort((a, b) => (b.prioScore - a.prioScore) || (b.ageDays - a.ageDays))
                .slice(0, 5);
        },

        // Dashboard alert zone (P1)
        get dashAlerts() {
            const today = localDateStr();
            const overduePM = (this.pmList || []).filter(pm => pm.status === 'pending' && pm.date && pm.date < today).length;
            const agingWO = (this.logs || []).filter(l => {
                if (!(l.Status === 'Pending' || l.Status === 'Draft')) return false;
                if (!l.Tanggal) return false;
                const d = new Date(l.Tanggal);
                return !isNaN(d.getTime()) && (new Date(today).getTime() - d.getTime()) / 86400000 > 3;
            }).length;
            // C-2: Single source of truth via lowStockCount
            const lowStock = this.lowStockCount;
            return { overduePM, agingWO, lowStock };
        },

        // Dashboard KPI row (P1)
        get dashKPIs() {
            /** @type {any[]} */
            const logs = this.logs || [];
            const breakdowns = logs.filter(l => l && l.Jenis === 'Breakdown');
            const totalBD = breakdowns.length;
            const totalBDHrs = breakdowns.reduce((s, l) => s + (Number(l.Downtime) || 0), 0);
            // MTBF akurat dari kpi-engine (delta HM antar breakdown, gabung logs+Performance)
            const equipIds = [...new Set((this.equipment || []).map(e => e.EquipmentID))];
            const mtbfs = equipIds.map(id => Number(this.calculateMTBF?.(id))).filter(v => v > 0);
            const mtbf = mtbfs.length > 0 ? (mtbfs.reduce((a, b) => a + b, 0) / mtbfs.length).toFixed(1) : '—';
            const mttr = totalBD > 0 ? (totalBDHrs / totalBD).toFixed(1) : '—';
            const perf = this.performanceData || [];
            const avgPA = perf.length > 0
                ? (perf.reduce((s, p) => {
                    const wh = Number(p.wh) || 24, bd = Number(p.bd) || 0, stb = Number(p.stb) || 0;
                    return s + (wh > 0 ? ((wh - bd - stb) / wh) * 100 : 0);
                }, 0) / perf.length).toFixed(1)
                : '—';
            return { mtbf, mttr, avgPA, breakdowns: totalBD };
        },

        get calculatedStats() {
            // Date-range filter for stats
            const from = this.dashboardDateFrom || '';
            const to = this.dashboardDateTo || '';
            const inRange = (/** @type {any} */ d) => !d || ((!from || d >= from) && (!to || d <= to));

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
                totalEquip: { label: 'Total Assets', value: equips.length || 0, ms: 'factory', pct: 100 },
                woCompletionRate: { label: 'WO Completion', value: woRate + '%', ms: 'check_circle', pct: woRate },
                avgHealthScore: { label: 'Avg Health', value: avgHealth + '%', ms: 'monitoring', pct: avgHealth },
                lowStock: { label: 'Low Stock', value: this.lowStockCount, ms: 'inventory_2', pct: 70 },
                pmCompliance: { label: 'PM Compliance', value: (this.calcPMCompliance?.().pct ?? 0) + '%', ms: 'fact_check', pct: this.calcPMCompliance?.().pct ?? 0 },
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
                    if (!isNaN(start.getTime())) {
                        const daysUsed = Math.max(1, (Date.now() - start.getTime()) / 86400000);
                        const usagePerDay = usage / daysUsed;
                        if (usagePerDay > 0) {
                            const remaining = lifetimeHours - usage;
                            const daysLeft = Math.max(0, remaining / usagePerDay);
                            eta = localDateStr(new Date(Date.now() + daysLeft * 86400000));
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
            const q = (this.search || '').trim().toLowerCase();
            const sector = this.equipSectorFilter || '';
            const type = this.equipTypeFilter || '';
            const status = this.equipStatusFilter || '';

            let result = this.equipment.filter(e => {
                if (!e) return false;
                if (q && !(e.Nama || '').toLowerCase().includes(q) && !(e.EquipmentID || '').toLowerCase().includes(q)) {
                    return false;
                }
                if (sector && (e.Lokasi || 'UNASSIGNED') !== sector) return false;
                if (type && (e.Tipe || 'Other') !== type) return false;
                if (status && (e.Status || 'Active') !== status) return false;
                return true;
            });

            // Sorting
            if (this.equipSortBy === 'critical') {
                const critOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
                result = [...result].sort((a, b) => (critOrder[/** @type {keyof typeof critOrder} */ (b.Kritikalitas)] || 0) - (critOrder[/** @type {keyof typeof critOrder} */ (a.Kritikalitas)] || 0));
            } else if (this.equipSortBy === 'health') {
                result = [...result].sort((a, b) => {
                    const sa = this.calculateHealthScore ? (this.calculateHealthScore(a.EquipmentID)?.score ?? 100) : 100;
                    const sb = this.calculateHealthScore ? (this.calculateHealthScore(b.EquipmentID)?.score ?? 100) : 100;
                    return sa - sb; // lowest health first
                });
            } else if (this.equipSortBy === 'date') {
                result = [...result].sort((a, b) => new Date(a.NextPMDate || 0).getTime() - new Date(b.NextPMDate || 0).getTime());
            } else {
                result = [...result].sort((a, b) => (a.Nama || '').localeCompare(b.Nama || ''));
            }

            // Apply pagination when not searching
            if (!this.search && result.length > 0) {
                result = result.slice(0, this.equipPage * (this.equipLimit || 30));
            }

            return result;
        },

        get canLoadMoreEquip() {
            if (!this.equipment || !Array.isArray(this.equipment)) return false;
            if (!this.search) {
                return this.equipment.length > (this.equipPage * (this.equipLimit || 30));
            }
            return false; // Disable pagination during search
        },

        // Tactical Slate Equipment Helpers & Telemetry
        get equipCounts() {
            /** @type {Record<string, number>} */
            const out = { total: 0, Active: 0, 'In Maintenance': 0, Decommissioned: 0, Idle: 0 };
            (this.equipment || []).forEach(e => {
                if (!e) return;
                out.total++;
                const s = e.Status || 'Active';
                if (s in out) out[s]++;
            });
            return out;
        },

        get equipKpi() {
            const eq = this.equipment || [];
            const total = eq.length;
            const active = eq.filter(e => e.Status === 'Active').length;
            const maint = eq.filter(e => e.Status === 'In Maintenance').length;
            const highCrit = eq.filter(e => e.Kritikalitas === 'High').length;
            const healthSum = eq.reduce((acc, e) => {
                const s = this.calculateHealthScore ? (this.calculateHealthScore(e.EquipmentID)?.score ?? 100) : 100;
                return acc + s;
            }, 0);
            const avgHealth = total > 0 ? Math.round(healthSum / total) : 100;
            return { total, active, maint, highCrit, avgHealth };
        },

        equipStatusTac(status) {
            const s = status || 'Active';
            if (s === 'Active') return 'bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/30';
            if (s === 'In Maintenance') return 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/30';
            if (s === 'Decommissioned') return 'bg-tac-status-emergency/15 text-tac-status-emergency border-tac-status-emergency/30';
            return 'bg-tac-surface-container-highest text-tac-on-surface-variant border-tac-border-subtle';
        },

        equipMarkerTac(item) {
            const s = (item && item.Status) || 'Active';
            if (s === 'Active') return 'bg-tac-status-operational';
            if (s === 'In Maintenance') return 'bg-tac-status-repair';
            if (s === 'Decommissioned') return 'bg-tac-status-emergency';
            return 'bg-tac-status-standby';
        },

        // D4: Equipment hierarchy — group by Lokasi (area) → Tipe
        get equipmentTree() {
            const eq = this.equipment || [];
            /** @type {Record<string, Record<string, any[]>>} */
            const areas = {};
            for (const e of eq) {
                const area = e.Lokasi || 'Unassigned';
                const tipe = e.Tipe || 'Other';
                if (!areas[area]) areas[area] = {};
                if (!areas[area][tipe]) areas[area][tipe] = [];
                areas[area][tipe].push(e);
            }
            return areas;
        },

        // D4: toggle hierarchy view
        showEquipTree: false,

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
        confirmDelete(_node, _id) {
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
                    /** @type {Record<string, string>} */
                    const entities = { 'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'nbsp': ' ' };
                    return entities[entity] || match;
                });
                decoded = decodeURIComponent(decoded);
                if (!/^(https?:\/\/|data:image\/|blob:)/.test(decoded) || /[[\]{}<>]/.test(decoded)) return '';
                return decoded;
            } catch {
                return '';
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
                    // `fromCache: false`: refresh menarik dari server. Memuat
                    // IndexedDB di sini menghidupkan kembali record yang sudah
                    // dihapus (bug lapangan: WO balik setelah "Muat ulang data").
                    this.setupFirebaseListeners({ fromCache: false });
                }
                setTimeout(() => {
                    this.isLoading = false;
                    this.showNotification("Data refreshed", "success");
                }, 500);
            } catch (/** @type {any} */ e) {
                this.isLoading = false;
                this.showNotification("Refresh failed: " + e.message, "error");
            }
        },

        // ── Phase 2: Migrate legacy base64 ImageUploads → hosted URLs ──
        // Run from browser console: await window.app.migrateLegacyImages()
        async migrateLegacyImages() {
            const results = { migrated: 0, failed: 0, skipped: 0 };
            const snap = await window.get(window.ref(window.db, 'ImageUploads'));
            const uploads = snap.val() || {};
            const ids = Object.keys(uploads);
            if (!ids.length) {
                logger.debug('[Migrate] No ImageUploads — continuing with inline base64 (Equipment/Logs)');
            } else {
                logger.debug('[Migrate] Found', ids.length, 'legacy images');
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
                    const url = await this.uploadBase64Image(data);
                    if (!url) throw new Error('Image upload failed');
                    logger.debug('[Migrate]', id, '→', url);

                    /** @type {Record<string, any>} */
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
                } catch (/** @type {any} */ e) {
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
                    const url = await this.uploadBase64Image(String(foto));
                    if (!url) throw new Error('Image upload failed');
                    await window.update(window.ref(window.db), { ['Equipment/' + eqId + '/FotoURL']: url });
                    results.migrated++;
                    logger.debug('[Migrate] Equipment', eqId, 'FotoURL →', url);
                } catch (/** @type {any} */ e) {
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
                if (!list.some((/** @type {any} */ u) => typeof u === 'string' && u.startsWith('data:'))) continue;
                const newUrls = [];
                for (const u of list) {
                    if (typeof u === 'string' && u.startsWith('data:')) {
                        try {
                            const url = await this.uploadBase64Image(u);
                            if (!url) throw new Error('Image upload failed');
                            newUrls.push(url);
                            results.migrated++;
                        } catch (/** @type {any} */ e) {
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

            logger.debug('[Migrate] Done:', JSON.stringify(results));
            this.showNotification('Migrated ' + results.migrated + ' images', 'success');
            return results;
        },

                // Tactical Slate Spare Parts Helpers & Telemetry
                get partKpi() {
                    const parts = this.allParts || [];
                    const total = parts.length;
                    let totalValuation = 0;
                    let lowCount = 0;
                    let optimalCount = 0;
                    let criticalCount = 0;

                    parts.forEach(p => {
                        if (!p) return;
                        const stok = Number(p.Stok) || 0;
                        const min = Number(p.MinStock) || 0;
                        const harga = Number(p.Harga) || 0;
                        totalValuation += stok * harga;

                        if (min > 0 && stok <= min) {
                            lowCount++;
                            if (stok === 0) criticalCount++;
                        } else {
                            optimalCount++;
                        }
                    });

                    return {
                        total,
                        totalValuation,
                        lowCount,
                        criticalCount,
                        optimalCount,
                        healthRate: total > 0 ? Math.round((optimalCount / total) * 100) : 100
                    };
                },

                partStatusTac(p) {
                    if (!p) return 'border-tac-border-subtle text-tac-status-standby bg-tac-surface-recessed';
                    const stok = Number(p.Stok) || 0;
                    const min = Number(p.MinStock) || 0;
                    if (min > 0 && stok === 0) {
                        return 'border-tac-status-emergency/40 text-tac-status-emergency bg-tac-status-emergency/10';
                    }
                    if (min > 0 && stok <= min) {
                        return 'border-tac-status-repair/40 text-tac-status-repair bg-tac-status-repair/10';
                    }
                    return 'border-tac-status-operational/40 text-tac-status-operational bg-tac-status-operational/10';
                },

                partMarkerTac(p) {
                    if (!p) return 'bg-tac-status-standby';
                    const stok = Number(p.Stok) || 0;
                    const min = Number(p.MinStock) || 0;
                    if (min > 0 && stok === 0) return 'bg-tac-status-emergency';
                    if (min > 0 && stok <= min) return 'bg-tac-status-repair';
                    return 'bg-tac-status-operational';
                },

                // Tactical Slate Helpers for PM Schedule
                pmStatusTac(pm) {
                    if (!pm) return { label: 'UNKNOWN', badge: 'bg-tac-surface-recessed text-tac-on-surface-variant border-tac-border-subtle', marker: 'bg-tac-status-standby', icon: 'help' };
                    const today = localDateStr();
                    if (pm.status === 'pending' && pm.date < today) {
                        return { label: 'OVERDUE', badge: 'bg-tac-status-emergency/15 text-tac-status-emergency border-tac-status-emergency/40', marker: 'bg-tac-status-emergency', icon: 'warning' };
                    }
                    if (pm.status === 'pending') {
                        return { label: 'PENDING', badge: 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/30', marker: 'bg-tac-status-repair', icon: 'schedule' };
                    }
                    if (pm.status === 'completed') {
                        return { label: 'COMPLETED', badge: 'bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/40', marker: 'bg-tac-status-operational', icon: 'check_circle' };
                    }
                    return { label: 'CANCELLED', badge: 'bg-tac-surface-recessed text-tac-on-surface-variant border-tac-border-subtle', marker: 'bg-tac-status-standby', icon: 'block' };
                },

                pmPriorityTac(priority) {
                    const p = (priority || 'Medium').toLowerCase();
                    if (p === 'high') return { label: 'HIGH', badge: 'bg-tac-status-emergency/15 text-tac-status-emergency border-tac-status-emergency/40' };
                    if (p === 'low') return { label: 'LOW', badge: 'bg-tac-surface-recessed text-tac-on-surface-variant border-tac-border-subtle' };
                    return { label: 'MED', badge: 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/40' };
                },

                // --- Multi-select: Spare Parts (pilih banyak, hapus massal) ---
                /** @param {string} id */
                togglePartSelect(id) {
                    if (!Array.isArray(this.partSelectedIds)) this.partSelectedIds = [];
                    const i = this.partSelectedIds.indexOf(id);
                    if (i >= 0) this.partSelectedIds.splice(i, 1);
                    else this.partSelectedIds.push(id);
                },
                get partAllVisibleSelected() {
                    const rows = this.filteredAllParts || [];
                    return rows.length > 0 && rows.every((/** @type {any} */ p) => (this.partSelectedIds || []).includes(p.PartID));
                },
                toggleSelectAllParts() {
                    const rows = this.filteredAllParts || [];
                    if (!Array.isArray(this.partSelectedIds)) this.partSelectedIds = [];
                    const all = rows.length > 0 && rows.every((/** @type {any} */ p) => this.partSelectedIds.includes(p.PartID));
                    this.partSelectedIds = all ? [] : rows.map((/** @type {any} */ p) => p.PartID);
                },
                async bulkDeleteParts() {
                    await this.bulkDeleteItems('SpareParts', this.partSelectedIds || [], 'part');
                    this.partSelectedIds = [];
                },

                partSelectedIds: [],
                get filteredAllParts() {
                    if (!this.allParts || !Array.isArray(this.allParts)) {
                        return [];
                    }
            
                    const searchLower = (this.searchPart || '').toLowerCase().trim();
                    const filterEquip = this.partFilterEquip;
                    const filterStatus = this.partStatusFilter;
            
                    let result = this.allParts.filter(p => {
                        if (!p) return false;
                
                        const name = (p.NamaPart || '').toString().toLowerCase();
                        const id = (p.PartID || '').toString().toLowerCase();
                        const shortName = (p.NamaSingkat || '').toString().toLowerCase();
                        const partNum = (p.PartNumber || '').toString().toLowerCase();
                        const lokasi = (p.Lokasi || '').toString().toLowerCase();

                        const matchesSearch = !searchLower || 
                            name.includes(searchLower) ||
                            id.includes(searchLower) ||
                            shortName.includes(searchLower) ||
                            partNum.includes(searchLower) ||
                            lokasi.includes(searchLower);
                
                        let linkedIds = [];
                        if (Array.isArray(p.EquipmentIDs)) {
                            linkedIds = p.EquipmentIDs;
                        } else if (p.EquipmentIDs && typeof p.EquipmentIDs === 'string') {
                            linkedIds = [p.EquipmentIDs];
                        } else if (p.EquipmentID) {
                            linkedIds = [p.EquipmentID];
                        }

                        const matchesEquip = !filterEquip || linkedIds.includes(filterEquip);
                        if (!matchesSearch || !matchesEquip) return false;

                        const stok = Number(p.Stok) || 0;
                        const min = Number(p.MinStock) || 0;
                        if (filterStatus === 'low') {
                            return min > 0 && stok <= min;
                        }
                        if (filterStatus === 'zero') {
                            return stok === 0;
                        }
                        if (filterStatus === 'optimal') {
                            return min === 0 || stok > min;
                        }
                        return true;
                    });

                    // Sorting
                    if (this.partSortBy === 'stock_asc') {
                        result = [...result].sort((a, b) => (Number(a.Stok) || 0) - (Number(b.Stok) || 0));
                    } else if (this.partSortBy === 'stock_desc') {
                        result = [...result].sort((a, b) => (Number(b.Stok) || 0) - (Number(a.Stok) || 0));
                    } else if (this.partSortBy === 'value') {
                        result = [...result].sort((a, b) => ((Number(b.Stok) || 0) * (Number(b.Harga) || 0)) - ((Number(a.Stok) || 0) * (Number(a.Harga) || 0)));
                    } else {
                        result = [...result].sort((a, b) => (a.NamaPart || '').localeCompare(b.NamaPart || ''));
                    }

                    // Pagination slice
                    const limit = this.partLimit || 30;
                    return result.slice(0, limit);
                },

                get canLoadMoreParts() {
                    if (!this.allParts || !Array.isArray(this.allParts)) return false;
                    return (this.filteredAllPartsCount || 0) > (this.partLimit || 30);
                },

                get filteredAllPartsCount() {
                    if (!this.allParts || !Array.isArray(this.allParts)) return 0;
                    const searchLower = (this.searchPart || '').toLowerCase().trim();
                    const filterEquip = this.partFilterEquip;
                    const filterStatus = this.partStatusFilter;
            
                    return this.allParts.filter(p => {
                        if (!p) return false;
                        const name = (p.NamaPart || '').toString().toLowerCase();
                        const id = (p.PartID || '').toString().toLowerCase();
                        const shortName = (p.NamaSingkat || '').toString().toLowerCase();
                        const partNum = (p.PartNumber || '').toString().toLowerCase();
                        const lokasi = (p.Lokasi || '').toString().toLowerCase();

                        const matchesSearch = !searchLower || 
                            name.includes(searchLower) ||
                            id.includes(searchLower) ||
                            shortName.includes(searchLower) ||
                            partNum.includes(searchLower) ||
                            lokasi.includes(searchLower);
                
                        let linkedIds = [];
                        if (Array.isArray(p.EquipmentIDs)) {
                            linkedIds = p.EquipmentIDs;
                        } else if (p.EquipmentIDs && typeof p.EquipmentIDs === 'string') {
                            linkedIds = [p.EquipmentIDs];
                        } else if (p.EquipmentID) {
                            linkedIds = [p.EquipmentID];
                        }

                        const matchesEquip = !filterEquip || linkedIds.includes(filterEquip);
                        if (!matchesSearch || !matchesEquip) return false;

                        const stok = Number(p.Stok) || 0;
                        const min = Number(p.MinStock) || 0;
                        if (filterStatus === 'low') return min > 0 && stok <= min;
                        if (filterStatus === 'zero') return stok === 0;
                        if (filterStatus === 'optimal') return min === 0 || stok > min;
                        return true;
                    }).length;
                },

                loadMoreParts() {
                    this.partLimit = (this.partLimit || 30) + 30;
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

        // P3-3: daftar All Logs penuh (belum dipotong) — sumber untuk hitung total.
        get filteredAllLogsAll() {
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

            // Jenis filter (Tactical filter matrix — All Logs)
            if (this.allLogsJenisFilter) {
                result = result.filter(l => l.Jenis === this.allLogsJenisFilter);
            }

            return result;
        },

        // P3-3: slice bertahap untuk render — hindari render ratusan kartu sekaligus.
        get filteredAllLogs() {
            return this.filteredAllLogsAll.slice(0, this.allLogsLimit || 30);
        },

        get canLoadMoreAllLogs() {
            return this.filteredAllLogsAll.length > (this.allLogsLimit || 30);
        },

        loadMoreAllLogs() {
            if (this.canLoadMoreAllLogs) {
                this.allLogsLimit = (this.allLogsLimit || 30) + 30;
            }
        },

        // ── Tactical Slate — All Logs telemetry & helper ────────────────────
        get logKpi() {
            const rows = this.filteredAllLogsAll || [];
            const total = rows.length;
            const pending = rows.filter((/** @type {any} */ l) => (l.Status || 'Pending') === 'Pending').length;
            const active = rows.filter((/** @type {any} */ l) => l.Status === 'In Progress').length;
            const done = rows.filter((/** @type {any} */ l) => l.Status === 'Completed').length;
            const bdRows = rows.filter((/** @type {any} */ l) => l.Jenis === 'Breakdown');
            const breakdown = bdRows.length;
            const downtime = rows.reduce((/** @type {number} */ s, /** @type {any} */ l) => s + (Number(l.Downtime) || 0), 0);
            const cost = rows.reduce((/** @type {number} */ s, /** @type {any} */ l) => s + (Number(l.Cost) || 0), 0);
            const mttr = breakdown > 0
                ? Math.round(bdRows.reduce((/** @type {number} */ s, /** @type {any} */ l) => s + (Number(l.Downtime) || 0), 0) / breakdown * 10) / 10
                : 0;
            const closure = total > 0 ? Math.round(done / total * 100) : 0;
            const units = new Set(rows.map((/** @type {any} */ l) => l.EquipmentID).filter(Boolean)).size;
            return { total, pending, active, done, breakdown, downtime, cost, mttr, closure, units };
        },

        get logJenisOptions() {
            const set = new Set();
            (this.logs || []).forEach(l => { if (l && l.Jenis) set.add(l.Jenis); });
            return Array.from(set).sort();
        },

        logStatusTac(status) {
            const s = status || 'Pending';
            if (s === 'Completed') return 'bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/30';
            if (s === 'In Progress') return 'bg-tac-sync-cyan/15 text-tac-sync-cyan border-tac-sync-cyan/30';
            if (s === 'Approved') return 'bg-tac-primary/15 text-tac-primary border-tac-primary/30';
            if (s === 'Cancelled') return 'bg-tac-surface-container-highest text-tac-on-surface-variant border-tac-border-subtle';
            return 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/30';
        },

        logMarkerTac(jenis) {
            const j = jenis || '';
            if (j === 'Breakdown') return 'bg-tac-status-emergency';
            if (j === 'Repair') return 'bg-tac-status-repair';
            if (j === 'PM') return 'bg-tac-status-operational';
            if (j === 'Inspection') return 'bg-tac-primary';
            return 'bg-tac-status-standby';
        },

        logIconTac(jenis) {
            const j = jenis || '';
            if (j === 'Breakdown') return 'warning';
            if (j === 'Repair') return 'engineering';
            if (j === 'PM') return 'event_busy';
            if (j === 'Inspection') return 'fact_check';
            return 'history';
        },

        logPriorityTac(priority) {
            const p = priority || '';
            if (p === 'Emergency') return 'bg-tac-status-emergency/20 text-tac-status-emergency';
            if (p === 'Urgent') return 'bg-tac-status-repair/20 text-tac-status-repair';
            if (p === 'Planned') return 'bg-tac-status-operational/20 text-tac-status-operational';
            return 'bg-tac-primary/15 text-tac-primary';
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
            (this.planningWOs || []).forEach((/** @type {any} */ w) => { if (w.assignedTo) techs.add(w.assignedTo); });
            return Array.from(techs).sort();
        },
        get planningFilteredWOs() {
            let wos = this.planningWOs.filter((/** @type {any} */ l) => l.Jenis || l.Deskripsi || l.woNumber || l.EquipmentID);
            if (this.planningSearch) {
                const q = this.planningSearch.toLowerCase();
                wos = wos.filter((/** @type {any} */ w) => (w.woNumber||'').toLowerCase().includes(q) || (w.Deskripsi||'').toLowerCase().includes(q) || (w.assignedTo||'').toLowerCase().includes(q) || (w.EquipmentID||'').toLowerCase().includes(q));
            }
            if (this.planningFilterTech) wos = wos.filter((/** @type {any} */ w) => w.assignedTo === this.planningFilterTech);
            if (this.planningFilterPriority) wos = wos.filter((/** @type {any} */ w) => (w.woPriority || 'Normal') === this.planningFilterPriority);
            return wos;
        },
        planningFilteredByColumn(...statuses) {
            return (this.planningFilteredWOs || []).filter((/** @type {any} */ w) => statuses.includes(w.Status));
        },
        planningEquipName(id) {
            if (!id || !this.equipment) return id || '';
            const e = this.equipment.find(eq => eq.EquipmentID === id);
            return e ? (e.Nama || id) : id;
        },
        planningPriorityColor(priority) {
            /** @type {Record<string, string>} */
            const map = { 'Emergency': 'bg-tac-status-emergency/20 text-tac-status-emergency', 'Urgent': 'bg-tac-status-repair/20 text-tac-status-repair', 'Normal': 'bg-tac-sync-cyan/20 text-tac-sync-cyan', 'Planned': 'bg-tac-status-operational/20 text-tac-status-operational' };
            return map[priority] || 'bg-tac-status-standby/20 text-tac-status-standby';
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

        // ── Tactical Slate — Planning Board telemetry & helper ──────────────
        get planningKpi() {
            const wos = (this.planningWOs || []).filter(Boolean);
            const today = localDateStr();
            const open = wos.filter((/** @type {any} */ w) => w.Status === 'Pending' || w.Status === 'Draft').length;
            const approved = wos.filter((/** @type {any} */ w) => w.Status === 'Approved').length;
            const inProgress = wos.filter((/** @type {any} */ w) => w.Status === 'In Progress').length;
            const completed = wos.filter((/** @type {any} */ w) => w.Status === 'Completed').length;
            const overdue = wos.filter((/** @type {any} */ w) => w.dueDate && w.dueDate < today && w.Status !== 'Completed' && w.Status !== 'Cancelled').length;
            const unassigned = wos.filter((/** @type {any} */ w) => !w.assignedTo && w.Status !== 'Completed' && w.Status !== 'Cancelled').length;
            const hours = wos
                .filter((/** @type {any} */ w) => w.Status !== 'Completed' && w.Status !== 'Cancelled')
                .reduce((/** @type {number} */ s, /** @type {any} */ w) => s + (Number(w.estimatedHours) || 0), 0);
            const total = wos.length;
            const doneRate = total > 0 ? Math.round(completed / total * 100) : 0;
            return { total, open, approved, inProgress, completed, overdue, unassigned, hours, doneRate };
        },

        get planningColumns() {
            const meta = [
                { key: 'open', label: 'OPEN', statuses: ['Pending', 'Draft'], drop: 'Pending', icon: 'assignment_late', dot: 'bg-tac-status-repair', text: 'text-tac-status-repair' },
                { key: 'approved', label: 'APPROVED', statuses: ['Approved'], drop: 'Approved', icon: 'verified_user', dot: 'bg-tac-primary', text: 'text-tac-primary' },
                { key: 'progress', label: 'IN PROGRESS', statuses: ['In Progress'], drop: 'In Progress', icon: 'engineering', dot: 'bg-tac-sync-cyan', text: 'text-tac-sync-cyan' },
                { key: 'completed', label: 'COMPLETED', statuses: ['Completed'], drop: 'Completed', icon: 'task_alt', dot: 'bg-tac-status-operational', text: 'text-tac-status-operational' },
            ];
            const rows = this.planningFilteredWOs || [];
            return meta.map(c => Object.assign({}, c, {
                items: rows.filter((/** @type {any} */ w) => c.statuses.includes(w.Status)),
            }));
        },

        planningStatusTac(status) {
            const s = status || 'Pending';
            if (s === 'Completed') return 'bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/30';
            if (s === 'In Progress') return 'bg-tac-sync-cyan/15 text-tac-sync-cyan border-tac-sync-cyan/30';
            if (s === 'Approved') return 'bg-tac-primary/15 text-tac-primary border-tac-primary/30';
            if (s === 'Cancelled') return 'bg-tac-surface-container-highest text-tac-on-surface-variant border-tac-border-subtle';
            return 'bg-tac-status-repair/15 text-tac-status-repair border-tac-status-repair/30';
        },

        planningMarkerTac(status) {
            const s = status || 'Pending';
            if (s === 'Completed') return 'bg-tac-status-operational';
            if (s === 'In Progress') return 'bg-tac-sync-cyan';
            if (s === 'Approved') return 'bg-tac-primary';
            if (s === 'Cancelled') return 'bg-tac-status-standby';
            return 'bg-tac-status-repair';
        },

        planningPriorityTac(priority) {
            const p = priority || 'Normal';
            if (p === 'Emergency') return 'bg-tac-status-emergency/20 text-tac-status-emergency border-tac-status-emergency/30';
            if (p === 'Urgent') return 'bg-tac-status-repair/20 text-tac-status-repair border-tac-status-repair/30';
            if (p === 'Planned') return 'bg-tac-status-operational/20 text-tac-status-operational border-tac-status-operational/30';
            return 'bg-tac-primary/15 text-tac-primary border-tac-primary/30';
        },

        planningBarTac(status) {
            const s = status || 'Pending';
            if (s === 'Completed') return 'bg-tac-status-operational/40 border-tac-status-operational/60';
            if (s === 'In Progress') return 'bg-tac-sync-cyan/40 border-tac-sync-cyan/60';
            if (s === 'Approved') return 'bg-tac-primary/40 border-tac-primary/60';
            if (s === 'Cancelled') return 'bg-tac-status-standby/40 border-tac-status-standby/60';
            return 'bg-tac-status-repair/40 border-tac-status-repair/60';
        },

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
            const todayStr = localDateStr(now);
            for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
                const dateStr = localDateStr(d);
                days.push({
                    dateStr, date: d.getDate(), dayName: d.toLocaleDateString('en-US', { weekday:'narrow' }),
                    label: d.toLocaleDateString('en-US', { month:'short', day:'numeric' }),
                    isToday: dateStr === todayStr,
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
            const startIdx = days.findIndex((/** @type {any} */ d) => d.dateStr === startDate);
            const endIdx = days.findIndex((/** @type {any} */ d) => d.dateStr === endDate);
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
            this.twActiveWOs.forEach((/** @type {any} */ w) => { if (w.assignedTo) techs.add(w.assignedTo); });
            return Array.from(techs).sort();
        },
        get twTotalHours() {
            return this.twFilteredTechs.reduce((/** @type {any} */ sum, /** @type {any} */ t) => sum + t.totalHours, 0);
        },
        get twOverloadCount() {
            return this.twFilteredTechs.filter((/** @type {any} */ t) => t.totalHours > 40).length;
        },
        get twFilteredTechs() {
            const from = this.twDateFrom || '';
            const to = this.twDateTo || '';
            // Filter WOs by date range
            const wos = this.twActiveWOs.filter((/** @type {any} */ w) => {
                const d = w.Tanggal || w.dueDate || '';
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            });
            // Group by technician
            /** @type {Record<string, {name: string, wos: any[], totalHours: number}>} */
            const map = {};
            wos.forEach((/** @type {any} */ w) => {
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
            const pmHrs = this.mpPMTasks.reduce((/** @type {any} */ s, /** @type {any} */ t) => s + (Number(t.estimatedHours) || 0), 0);
            const woHrs = this.mpOpenWOs.reduce((/** @type {any} */ s, /** @type {any} */ w) => s + (Number(w.estimatedHours) || 0), 0);
            return pmHrs + woHrs;
        },
        mpRefresh() { this.loadPMSchedule?.(); },
        mpEquipName(id) {
            if (!id || !this.equipment) return id;
            const eq = this.equipment.find(e => e.EquipmentID === id);
            return eq ? (eq.Nama || eq.EquipmentID) : id;
        },
        mpPriorityColor(priority) {
            /** @type {Record<string, string>} */
            const map = { Emergency: 'bg-tac-status-emergency/20 text-tac-status-emergency', Urgent: 'bg-tac-status-repair/20 text-tac-status-repair', Normal: 'bg-tac-sync-cyan/20 text-tac-sync-cyan', Planned: 'bg-tac-status-operational/20 text-tac-status-operational' };
            return map[priority] || 'bg-tac-status-standby/20 text-tac-status-standby';
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

                    const pmBody = this.mpPMTasks.map((/** @type {any} */ t, /** @type {any} */ i) => [
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

                    const woBody = this.mpOpenWOs.map((/** @type {any} */ w, /** @type {any} */ i) => [
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
            } catch (/** @type {any} */ e) {
                console.error('Export PDF error:', e);
                this.showNotification('Error exporting PDF: ' + e.message, 'error');
            } finally {
                this.mpLoading = false;
            }
        },

        // --- MTBF/MTTR GETTERS ---
        get mtbfResult() {
            if (!this.mtbfFilterEquip) return null;
            return this.calcMTBFMTTR(this.mtbfFilterEquip) || null;
        },
        calcMTBFMTTR(equipId) {
            if (!equipId) return null;
            const perf = this._raw?.(this.performanceData) || [];
            // ⚠️ Performance pakai field equipmentId (lowercase), bukan EquipmentID
            const eqPerf = perf.filter(p => p && (p.equipmentId || p.EquipmentID) === equipId);
            if (eqPerf.length) {
                const wh = eqPerf.reduce((s, p) => s + (Number(p.wh) || 0), 0);
                const bd = eqPerf.reduce((s, p) => s + (Number(p.bd) || 0), 0);
                const freq = eqPerf.reduce((s, p) => s + (Number(p.freq) || 0), 0);
                const events = eqPerf.reduce((s, p) => s + ((p.events && p.events.length) || 0), 0);
                const failures = freq || events;
                if (failures > 0) {
                    return {
                        mtbfDays: Number((wh / failures / 24).toFixed(1)),
                        mttrHours: Number((bd / failures).toFixed(1)),
                        totalEvents: eqPerf.length
                    };
                }
            }
            // Fallback: hitung dari HistoryLog
            const logs = this._raw?.(this.logs) || [];
            const eqLogs = logs.filter(l => l && l.EquipmentID === equipId);
            if (!eqLogs.length) return null;
            const BreakdownLogs = eqLogs.filter(l => l.Jenis === 'Breakdown');
            const Failures = BreakdownLogs.length;
            const days = BreakdownLogs.length >= 2 ? Math.max(0, (new Date(BreakdownLogs[BreakdownLogs.length-1].Tanggal).getTime() - new Date(BreakdownLogs[0].Tanggal).getTime()) / 86400000) : 0;
            const repairLogs = eqLogs.filter(l => l.Jenis === 'Repair');
            const avgRepairHrs = repairLogs.length ? repairLogs.reduce((s, l) => s + (Number(l.actualHours) || Number(l.Downtime) || 0), 0) / repairLogs.length : 0;
            return {
                mtbfDays: Failures >= 2 ? Number((days / (Failures - 1)).toFixed(1)) : 0,
                mttrHours: Number(avgRepairHrs.toFixed(1)),
                totalEvents: eqLogs.length
            };
        },
        mtbfRefresh() {
            this.mtbfFilterEquip = '';
            if (window._appCharts?.mtbfChart) { try { window._appCharts.mtbfChart.destroy(); } catch {} }
            this.$nextTick(() => this.renderMTBFMTTRChart());
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
                const ensureCropper = () => {
                    if (this._cropper) this._cropper.destroy();
                    this._cropper = new Cropper(img, {
                        aspectRatio: NaN, viewMode: 1, autoCropArea: 1,
                        responsive: true, background: false,
                    });
                };
                if (window.Cropper) { ensureCropper(); return; }
                // Lazy-load cropperjs (previously render-blocking CDN in head)
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css';
                css.integrity = 'sha384-6LFfkTKLRlzFtgx8xsWyBdKGpcMMQTkv+dB7rAbugeJAu1Ym2q1Aji1cjHBG12Xh';
                css.crossOrigin = 'anonymous';
                document.head.appendChild(css);
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js';
                script.integrity = 'sha384-jrOgQzBlDeUNdmQn3rUt/PZD+pdcRBdWd/HWRqRo+n2OR2QtGyjSaJC0GiCeH+ir';
                script.crossOrigin = 'anonymous';
                script.onload = ensureCropper;
                script.onerror = () => {
                    this.showCropModalOpen = false;
                    this.showNotification('Failed to load image editor', 'error');
                };
                document.head.appendChild(script);
            });
        },
        applyCrop() {
            if (!this._cropper) return;
            this._cropper.getCroppedCanvas().toBlob((/** @type {any} */ blob) => {
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
            this.showCropModal(preview, (/** @type {any} */ croppedBlob) => {
                if (!this.logForm.photos) this.logForm.photos = [];
                if (this.logForm.photos.length >= 4) return;
                this.logForm.photos.push({ file: croppedBlob, preview: URL.createObjectURL(croppedBlob), base64: null });
            });
        },
    });

    reattachModuleGetters(state, [
        authModule, uiModule, dataModule, equipmentModule, partsModule, logsModule,
        performanceModule, exportModule, kpiEngineModule, aiModule, pmScheduleModule,
        requisitionModule, chartModule, errorHandlerModule, bootstrapModule,
    ]);

    return state;
}
