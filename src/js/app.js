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
import { errorHandlerModule } from './error-handler.js';
import { bootstrapModule } from './bootstrap.js';
import { CONSTANTS, DEFAULT_EQUIP_FORM, DEFAULT_PART_FORM, DEFAULT_LOG_FORM, DEFAULT_PERF_FORM, DEFAULT_PM_FORM } from './constants.js';
import { isLowStock, calculatePartLifetime, getLifetimeColor, getLifetimeBgColor } from './utils.js';

export function app() {
    return {
        // --- APP STATE ---
        currentPage: 'dash', sidebarCollapsed: false, activeTab: 'hist', search: '', searchPart: '', partFilterEquip: '',
        // Work Order filters
        searchWO: '', filterWOStatus: '', filterWOPriority: '',
        selectedWODetail: null,
        
        // ponytail: AI state + methods (clearAIChat, rotateApiKey, sendAIChat, updateModelOptions,
        // loadAISettings, loadAIFromFirebase, saveAIWithCustomModel, saveAIToFirebase,
        // activeApiKey, apiKey, isAnalyzing, isGenerating, analysisResult, getAIRecommendations)
        // merged into ai.js module
        
        showEquipModal: false, showPartModal: false, showLogModal: false, showScanner: false, showQRPreviewModal: false, showNotifications: false,
        isLogDetailView: false, isEditingEquip: false, isEditingPart: false, isEditingLog: false,
        selectedEquip: null, notifications: [], isLoading: true, html5QrCode: null, qrCodeDataUrl: '',
        isOnline: navigator.onLine,
        darkMode: (() => { try { const v = localStorage.getItem('darkMode'); return v === null ? true : v === 'true'; } catch(e) { return true; } })(),
        isLoggedIn: false, user: null,
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

        // --- AUTH METHODS (Moved from module for stability) ---
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

        menuItems: [
            { id: 'dash', name: 'Dashboard', icon: 'fas fa-chart-pie', mobile: true },
            { id: 'equip', name: 'Equipment', icon: 'fas fa-tools', mobile: true },
            { id: 'parts', name: 'Spare Parts', icon: 'fas fa-box', mobile: true },
            { id: 'hist', name: 'All Logs', icon: 'fas fa-history', mobile: true },
            { id: 'wo', name: 'Work Orders', icon: 'fas fa-clipboard-list', mobile: true },
            { id: 'pms', name: 'PM Schedule', icon: 'fas fa-calendar-alt', mobile: true, allowedRole: 'admin' },
            { id: 'perf', name: 'Performance', icon: 'fas fa-chart-line', mobile: true, allowedRole: 'admin' },
            { id: 'kpi', name: 'KPI Analytics', icon: 'fas fa-brain', mobile: true, allowedRole: 'admin' },
            { id: 'ai', name: 'AI Analysis', icon: 'fas fa-robot', mobile: false, allowedRole: 'admin' },
            { id: 'request', name: 'Request Part', icon: 'fas fa-shopping-cart', mobile: true },
        ],

        // --- ROLE-BASED NAVIGATION ---
        navigateTo(pageId) {
            const page = this.menuItems.find(m => m.id === pageId);
            if (page?.allowedRole && page.allowedRole === 'admin' && !this.isAdmin) {
                this.showNotification("Access denied: admin only", "error");
                return;
            }
            this.currentPage = pageId;
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

        // --- CALCULATED PROPERTIES (GETTERS) ---
        // ponytail: init, loadModalsCSS, checkUserRole extracted to bootstrap.js
        get isAdmin() { return this.userRole === 'admin'; },

        get calculatedStats() {
            return {
                totalEquip: { label: 'Total Assets', value: this.dashboardStats.totalEquip || 0, color: 'border-blue-500' },
                overduePM: { label: 'Overdue PM', value: this.dashboardStats.overduePM || 0, color: 'border-red-500' },
                lowStock: { label: 'Low Stock Parts', value: this.dashboardStats.lowStock || 0, color: 'border-yellow-500' },
                totalDowntime: { label: 'Total Down Hrs', value: parseFloat(this.dashboardStats.totalDowntime || 0).toFixed(1), color: 'border-green-500' }
            };
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

        get filteredLogs() {
            if (!this.logs || !Array.isArray(this.logs)) return [];
            return this.logs.filter(l => l.EquipmentID === this.selectedEquip?.EquipmentID);
        },

        // ponytail: pmMonthLabel, pmCalendarDays, pmStats, pmGanttMonths, pmGanttDays, pmGanttRows
        // extracted to pm-schedule.js (as pmGetMonthLabel, pmGetCalendarDays, pmGetStats, etc.)

        get filteredWorkOrders() {
            // Guard: if logs is undefined/null, return empty to avoid crash
            if (!this.logs || !Array.isArray(this.logs)) {
                console.log('[filteredWorkOrders] logs not ready yet, returning []');
                return [];
            }
            
            // Show loading state when logs are empty but isLoading is true
            if (this.logs.length === 0 && this.isLoading) {
                return [];
            }
            
            // Ensure we're tracking reactivity through this.logs (not activeWorkOrders)
            // This ensures Alpine re-evaluates when logs change
            const logsSnapshot = [...this.logs];
            
            // Filter only items that have work order characteristics
            let logsArray = logsSnapshot.filter(l => 
                l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Draft' || l.Status === 'Approved')
            );
            
            console.log('[filteredWorkOrders] total logs:', logsSnapshot.length, 'filtered WOs:', logsArray.length);
            
            // Filter out corrupt entries
            logsArray = logsArray.filter(l => l.Jenis || l.Deskripsi || l.woNumber || l.EquipmentID);
            
            let result = logsArray;
            
            // Apply filters
            const hasFilters = this.searchWO || this.filterWOStatus || this.filterWOPriority;
            
            if (hasFilters) {
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
            }
            
            return result;
        },

        get filteredAllLogs() {
            if (!this.logs || !Array.isArray(this.logs)) return [];
            
            // All Logs: only real equipment logs (non-EXTERNAL)
            return this.logs.filter(l => 
                l.EquipmentID && 
                l.EquipmentID !== 'EXTERNAL'
            );
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
        }
    };
}
