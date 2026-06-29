// 🏪 Store — Pure state defaults for Alpine component
// Extracted from app.js to reduce file size

export const DEFAULT_STORE = {
    // --- APP STATE ---
    currentPage: 'dash', sidebarCollapsed: false, activeTab: 'hist', search: '', searchPart: '', partFilterEquip: '',
    searchWO: '', filterWOStatus: '', filterWOPriority: '',
    selectedWODetail: null,
    
    // --- MODALS ---
    showEquipModal: false, showPartModal: false, showLogModal: false,
    showScanner: false, showQRPreviewModal: false, showNotifications: false,
    isLogDetailView: false, isEditingEquip: false, isEditingPart: false, isEditingLog: false,
    selectedEquip: null, notifications: [], isLoading: true, html5QrCode: null, qrCodeDataUrl: '',
    isOnline: navigator.onLine,
    darkMode: (() => { try { const v = localStorage.getItem('darkMode'); return v === null ? true : v === 'true'; } catch(e) { return true; } })(),
    isLoggedIn: false, user: null, userRole: 'user',
    loginForm: { email: '', password: '' },
    loginform: { email: '', password: '' },

    // --- DELETE CONFIRM ---
    showDeleteConfirm: false, deleteConfirmCallback: null,
    showRejectModal: false, activeRejectId: null, rejectReason: '',

    // --- DATA ---
    equipment: [], allParts: [], logs: [], performanceData: [],
    equipPage: 1, equipLimit: 30,

    // --- PM SCHEDULE ---
    pmView: 'calendar', pmMonthOffset: 0, pmFilterEquip: '',
    pmFilterStatus: '', pmShowDetail: false, selectedPM: null,
    pmGanttScroll: 0, selectedPMDate: '', showPMModal: false,
    pmSelectedIds: [], pmLoading: false, isEditingPM: false,
    pmList: [],

    // --- ERROR ---
    hasError: false, errorMessage: '', errorDetails: '',

    // --- LAZY LOADING ---
    chartLoaded: false, modalsLoaded: false,
    importProgress: 0,
    dashboardStats: { totalEquip: 0, overduePM: 0, lowStock: 0, totalDowntime: 0 },
    equipPage: 1, equipLimit: 30,

    // --- FORMS ---
    equipForm: null, partForm: null, logForm: null, performanceForm: null, pmForm: null,

    // --- TEMP ---
    oldLogParts: [], tempEquipFile: null,

    // --- KPI ---
    showPerformanceModal: false, isEditingPerformance: false,
    kpiFilter: 'yearly', kpiFilterDate: new Date().getFullYear().toString(),
};
