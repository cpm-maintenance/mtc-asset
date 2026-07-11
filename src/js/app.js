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
        // Work Order filters
        searchWO: '', filterWOStatus: '', filterWOPriority: '', filterDateFrom: '', filterDateTo: '',
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

        // --- CROP MODAL STATE ---
        showCropModalOpen: false,
        cropImageSrc: '',
        cropCallback: null,
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
            { id: 'dash', name: 'Dashboard', icon: 'fas fa-chart-pie', mobile: true, group: 'Monitoring' },
            { id: 'enterprise', name: 'Enterprise KPI', icon: 'fas fa-industry', mobile: true, allowedRole: 'admin', group: 'Monitoring' },

            // --- MAINTENANCE ---
            { id: 'wo', name: 'Work Orders', icon: 'fas fa-clipboard-list', mobile: true, group: 'Maintenance' },
            { id: 'pms', name: 'PM Schedule', icon: 'fas fa-calendar-alt', mobile: true, allowedRole: 'supervisor', group: 'Maintenance' },
            { id: 'perf', name: 'Performance', icon: 'fas fa-chart-line', mobile: true, allowedRole: 'supervisor', group: 'Maintenance' },
            { id: 'equip', name: 'Equipment', icon: 'fas fa-tools', mobile: true, group: 'Maintenance' },
            { id: 'hist', name: 'All Logs', icon: 'fas fa-history', mobile: true, group: 'Maintenance' },

            // --- INVENTORY ---
            { id: 'parts', name: 'Spare Parts', icon: 'fas fa-box', mobile: true, group: 'Inventory' },
            { id: 'request', name: 'Request Part', icon: 'fas fa-shopping-cart', mobile: true, group: 'Inventory' },

            // --- ANALYTICS ---
            { id: 'kpi', name: 'KPI Analytics', icon: 'fas fa-brain', mobile: true, allowedRole: 'admin', group: 'Analytics' },
            { id: 'ai', name: 'AI Analysis', icon: 'fas fa-robot', mobile: false, allowedRole: 'admin', group: 'Analytics' },
        ],

        // --- ROLE-BASED NAVIGATION ---
        get menuGroups() {
            const groups = {};
            this.menuItems.filter(m => this.canAccess(m)).forEach(item => {
                const g = item.group || 'Other';
                if (!groups[g]) groups[g] = { name: g, items: [] };
                groups[g].items.push(item);
            });
            const order = ['Monitoring', 'Maintenance', 'Inventory', 'Analytics', 'Other'];
            return order.filter(k => groups[k]).map(k => groups[k]);
        },
        navigateTo(pageId) {
            const page = this.menuItems.find(m => m.id === pageId);
            if (page && !this.canAccess(page)) {
                this.showNotification("Access denied", "error");
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

        get calculatedStats() {
            // WO completion rate
            const wos = (this.logs || []).filter(l => l.woNumber || l.Status === 'Pending' || l.Status === 'Approved');
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
