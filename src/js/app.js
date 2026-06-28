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
import { CONSTANTS, DEFAULT_EQUIP_FORM, DEFAULT_PART_FORM, DEFAULT_LOG_FORM, DEFAULT_PERF_FORM, DEFAULT_PM_FORM } from './constants.js';
import { isLowStock, calculatePartLifetime, getLifetimeColor, getLifetimeBgColor } from './utils.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export function app() {
    return {
        // --- APP STATE ---
        currentPage: 'dash', sidebarCollapsed: false, activeTab: 'hist', search: '', searchPart: '', partFilterEquip: '',
        // Work Order filters
        searchWO: '', filterWOStatus: '', filterWOPriority: '',
        selectedWODetail: null,
        
        // AI State - Multiple API Keys
        aiApiKeys: [],
        aiApiKeyInput1: '', aiApiKeyInput2: '', aiApiKeyInput3: '', aiApiKeyInput4: '', aiApiKeyInput5: '',
        activeKeyIndex: 0,
        aiProvider: 'openrouter', aiModel: '', customModelInput: '',
        aiModelOptions: [],
        showAPISettings: false,
        showCustomPrompt: false,
        customPrompt: '',
aiIsAnalyzing: false,
        aiIsGenerating: false,
        aiAnalysisResult: null,
        aiChatInput: '',
        aiChatHistory: [],
        
        clearAIChat() {
            this.aiChatHistory = [];
        },
        
        // Switch to next available key
        rotateApiKey() {
            // First, ensure we have multiple keys - load from localStorage if needed
            if (this.aiApiKeys.length <= 1) {
                const count = parseInt(localStorage.getItem('ai_api_keys_count') || '0');
                for (let i = 0; i < count; i++) {
                    const key = localStorage.getItem('ai_api_key_' + i);
                    if (key && key.trim() && !this.aiApiKeys.includes(key.trim())) {
                        this.aiApiKeys.push(key.trim());
                    }
                }
                console.log('[AI] Loaded', this.aiApiKeys.length, 'keys from localStorage');
            }
            
            if (this.aiApiKeys.length <= 1) {
                console.log('[AI] No more keys to rotate, have:', this.aiApiKeys.length);
                return null;
            }
            
            // Try next key
            for (let i = 1; i < this.aiApiKeys.length; i++) {
                const idx = (this.activeKeyIndex + i) % this.aiApiKeys.length;
                if (this.aiApiKeys[idx] && this.aiApiKeys[idx].trim()) {
                    this.activeKeyIndex = idx;
                    localStorage.setItem('ai_active_key_index', String(idx));
                    console.log('[AI] Switched to key #' + (idx + 1));
                    return this.aiApiKeys[idx];
                }
            }
            return null;
        },

        async sendAIChat() {
            if (!this.aiChatInput?.trim()) return;
            
            // Get key from activeApiKey getter
            const apiKey = this.activeApiKey;
            console.log('[Chat] activeApiKey:', apiKey ? 'FOUND' : 'NOT FOUND');
            
            if (!apiKey) {
                this.showNotification("Silakan setting API key dulu", "error");
                return;
            }
            if (this.aiIsAnalyzing) return;
            
            this.aiIsAnalyzing = true;
            const question = this.aiChatInput;
            this.aiChatInput = '';
            
            // Add user question to chat history
            this.aiChatHistory.push({ role: 'user', text: question });
            
            try {
                const prompt = `Anda adalah asisten maintenance yang helpful. Jawab singkat dalam bahasa Indonesia.\n\nPertanyaan: ${question}`;
                
                const result = await this.callAI(prompt, apiKey);
                console.log('[Chat] AI result:', result?.substring(0, 100) || 'EMPTY');
                
                // Add AI response to chat history
                if (result) {
                    this.aiChatHistory.push({ role: 'ai', text: result });
                } else {
                    this.aiChatHistory.push({ role: 'ai', text: 'Tidak ada response dari AI' });
                }
            } catch (e) {
                console.log('[Chat] Error:', e.message);
                this.showNotification("Error: " + e.message, "error");
                this.aiChatHistory.push({ role: 'ai', text: 'Error: ' + e.message });
            } finally {
                this.aiIsAnalyzing = false;
            }
        },
        
        updateModelOptions() {
            const provider = this.aiProvider;
            if (provider === 'openai') {
                this.aiModelOptions = [
                    { value: 'gpt-4o', label: 'GPT-4o' },
                    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
                ];
            } else if (provider === 'claude') {
                this.aiModelOptions = [
                    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
                    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
                    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
                ];
            } else if (provider === 'openrouter') {
                this.aiModelOptions = [
                    { value: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 (Free)' },
                    { value: 'minimax/minimax-m2.5:free', label: 'MiniMax M2.5 (Free)' },
                    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (Paid)' },
                    { value: 'openai/gpt-4o', label: 'GPT-4o (Paid)' },
                    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 (Paid)' },
                    { value: 'z-ai/glm-4.5-air:free', label: 'GLM-4.5 Air (Free)' },
                    { value: '__custom__', label: 'Custom Model...' }
                ];
            }
            this.aiModel = this.aiModelOptions[0]?.value || '';
        },
        
        loadAISettings() {
            console.log('[AI] loadAISettings: isAdmin =', this.isAdmin, 'userRole =', this.userRole, 'user =', this.user?.email);
            
            // Try Firebase first, but also try localStorage as backup
            this.loadAIFromFirebase().then(firebaseLoaded => {
                if (firebaseLoaded) {
                    console.log('[AI] Loaded from Firebase, keys:', this.aiApiKeys.length);
                } else {
                    // Always also try to load from localStorage as backup
                    console.log('[AI] Trying localStorage fallback');
                    const storedCount = parseInt(localStorage.getItem('ai_api_keys_count') || '0');
                    if (storedCount > 0) {
                        this.aiApiKeys = [];
                        for (let i = 0; i < storedCount; i++) {
                            const key = localStorage.getItem('ai_api_key_' + i) || '';
                            if (key.trim()) {
                                this.aiApiKeys.push(key);
                            }
                        }
                    }
                    this.aiApiKeyInput1 = localStorage.getItem('ai_api_key_0') || '';
                    this.aiApiKeyInput2 = localStorage.getItem('ai_api_key_1') || '';
                    this.aiApiKeyInput3 = localStorage.getItem('ai_api_key_2') || '';
                    this.aiApiKeyInput4 = localStorage.getItem('ai_api_key_3') || '';
                    this.aiApiKeyInput5 = localStorage.getItem('ai_api_key_4') || '';
                    console.log('[AI] Loaded from localStorage, keys:', this.aiApiKeys.length);
                }
                
                this.aiProvider = localStorage.getItem('ai_provider') || this.aiProvider || 'openrouter';
                this.aiModel = localStorage.getItem('ai_model') || this.aiModel || '';
                this.customPrompt = localStorage.getItem('ai_custom_prompt') || this.customPrompt || '';
                this.activeKeyIndex = parseInt(localStorage.getItem('ai_active_key_index') || '0');
                this.updateModelOptions();
                
                if (this.aiModel && !this.aiModelOptions.find(o => o.value === this.aiModel)) {
                    this.aiModelOptions.push({ value: this.aiModel, label: 'Custom: ' + this.aiModel });
                }
                
                console.log('[App] AI settings loaded:', { keysCount: this.aiApiKeys.length, activeIndex: this.activeKeyIndex });
            });
        },
        
        async loadAIFromFirebase() {
            // Load API key from Firebase secure storage
            if (!window.db || !this.user || !this.isAdmin) return false;
            
            try {
                const snapshot = await window.get(window.ref(window.db, 'AI_Settings/admin'));
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    if (data.apiKey) {
                        // Load all keys if available, otherwise just the first one
                        if (data.apiKeys && Array.isArray(data.apiKeys)) {
                            this.aiApiKeys = data.apiKeys;
                        } else {
                            this.aiApiKeys = [data.apiKey];
                        }
                        this.aiApiKeyInput1 = data.apiKey;
                        // Also populate input fields 2-5 if available
                        if (data.apiKeys && Array.isArray(data.apiKeys) && data.apiKeys.length > 1) {
                            this.aiApiKeyInput2 = data.apiKeys[1] || '';
                            this.aiApiKeyInput3 = data.apiKeys[2] || '';
                            this.aiApiKeyInput4 = data.apiKeys[3] || '';
                            this.aiApiKeyInput5 = data.apiKeys[4] || '';
                        }
                        this.aiProvider = data.provider || 'openrouter';
                        this.aiModel = data.model || '';
                        this.customPrompt = data.customPrompt || '';
                        console.log('[AI] Loaded from Firebase, keys:', this.aiApiKeys.length);
                        return true;
                    }
                }
            } catch(e) {
                console.log('[AI] Firebase load error:', e.message);
            }
            return false;
        },
        
        saveAIWithCustomModel() {
            // Collect all non-empty keys from inputs
            const keys = [];
            const keyInputs = [this.aiApiKeyInput1, this.aiApiKeyInput2, this.aiApiKeyInput3, this.aiApiKeyInput4, this.aiApiKeyInput5];
            
            for (let i = 0; i < keyInputs.length; i++) {
                if (keyInputs[i] && keyInputs[i].trim()) {
                    keys.push(keyInputs[i].trim());
                }
            }
            
            this.aiApiKeys = keys;
            this.activeKeyIndex = 0;
            localStorage.setItem('ai_active_key_index', '0');
            localStorage.setItem('ai_api_keys_count', String(keys.length));
            
            // Also save each key individually to localStorage for backup
            for (let i = 0; i < keys.length; i++) {
                localStorage.setItem('ai_api_key_' + i, keys[i]);
            }
            
            // Use custom model input if provided
            let modelToSave = this.aiModel;
            if (this.aiModel === '__custom__' && this.customModelInput && this.customModelInput.trim()) {
                modelToSave = this.customModelInput.trim();
            }
            
            this.aiModel = modelToSave;
            localStorage.setItem('ai_provider', this.aiProvider);
            localStorage.setItem('ai_model', modelToSave);
            localStorage.setItem('ai_custom_prompt', this.customPrompt || '');
            
            console.log('[App] AI settings saved to localStorage:', { provider: this.aiProvider, model: modelToSave, keyCount: keys.length });
            
            // Save to Firebase (secure storage) - only for admin
            this.saveAIToFirebase(keys[0], modelToSave);
            
            this.showAPISettings = false;
        },
        
        async saveAIToFirebase(apiKey, model) {
            // Save API keys to Firebase - only admin can do this
            if (!window.db || !this.isAdmin) return;
            
            try {
                // Save all keys in one field as JSON
                const data = {
                    apiKey: apiKey,
                    apiKeys: this.aiApiKeys, // Save array of all keys
                    provider: this.aiProvider,
                    model: model || '',
                    customPrompt: this.customPrompt || '',
                    updatedAt: new Date().toISOString(),
                    updatedBy: this.user?.email || 'admin'
                };
                await window.set(window.ref(window.db, 'AI_Settings/admin'), data);
                console.log('[AI] Saved to Firebase, keys:', this.aiApiKeys.length);
            } catch(e) {
                console.log('[AI] Firebase save error:', e.message);
            }
        },
        
        // Aliases for AI module (backward compatibility)
        get activeApiKey() {
            // Return key from aiApiKeys array at activeKeyIndex
            if (this.aiApiKeys && this.aiApiKeys.length > 0 && this.aiApiKeys[this.activeKeyIndex]) {
                return this.aiApiKeys[this.activeKeyIndex];
            }
            // Fallback: check localStorage directly
            for (let i = 0; i < 10; i++) {
                const key = localStorage.getItem('ai_api_key_' + i);
                if (key && key.trim()) return key;
            }
            return localStorage.getItem('ai_api_key') || '';
        },
        get apiKey() { return this.activeApiKey; },
        get isAnalyzing() { return this.aiIsAnalyzing; },
        get isGenerating() { return this.aiIsGenerating || false; },
        get analysisResult() { return this.aiAnalysisResult || null; },
        
        async getAIRecommendations() {
            if (!this.activeApiKey) {
                this.showNotification("Silakan setting API key dulu", "error");
                return;
            }
            
            if (this.aiIsAnalyzing) return;
            this.showNotification("Menghasilkan rekomendasi...", "info");
            
            try {
                const recommendations = await this.generateRecommendations();
                if (recommendations && recommendations.length > 0) {
                    this.showNotification("Berhasil! " + recommendations.length + " rekomendasi ditemukan", "success");
                    console.log('[App] Recommendations:', recommendations);
                } else {
                    this.showNotification("Tidak ada rekomendasi", "warning");
                }
            } catch (e) {
                this.showNotification("Error: " + e.message, "error");
            }
        },
        
        // Direct access to key inputs for UI binding
        get aiApiKey() { 
            return this.aiApiKeys[0] || localStorage.getItem('ai_api_key_0') || ''; 
        },
        set aiApiKey(v) { 
            if (!this.aiApiKeys[0]) this.aiApiKeys[0] = v;
            localStorage.setItem('ai_api_key_input_0', v);
        },
        
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
            { id: 'pms', name: 'PM Schedule', icon: 'fas fa-calendar-alt', mobile: true },
            { id: 'perf', name: 'Performance', icon: 'fas fa-chart-line', mobile: true },
            { id: 'kpi', name: 'KPI Analytics', icon: 'fas fa-brain', mobile: true },
            { id: 'ai', name: 'AI Analysis', icon: 'fas fa-robot', mobile: false },
        ],

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

        // --- CORE METHODS ---
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

        handleError(error, context = '') {
            console.error(`Error in ${context}:`, error);
            this.hasError = true;
            this.errorMessage = this.getUserFriendlyError(error);
            this.errorDetails = error?.message || String(error);
            this.showNotification(this.errorMessage, 'error');
            
            // Send to Sentry
            try {
                if (window.Sentry) {
                    window.Sentry.captureException(error, {
                        tags: { context: context || 'unknown' },
                        extra: { userRole: this.userRole, page: this.currentPage }
                    });
                }
            } catch (sentryError) {
                console.warn('[Sentry] Failed to capture error:', sentryError);
            }
        },

        getUserFriendlyError(error) {
            if (!error) return 'An unexpected error occurred';
            
            const message = String(error.message || error).toLowerCase();
            
            if (message.includes('network') || message.includes('fetch')) {
                return 'Network error. Please check your connection.';
            }
            if (message.includes('permission') || message.includes('denied')) {
                return 'Access denied. Admin privileges required.';
            }
            if (message.includes('quota') || message.includes('limit')) {
                return 'Rate limit exceeded. Please try again later.';
            }
            if (message.includes('not found') || message.includes('null')) {
                return 'Data not found. Please refresh the page.';
            }
            if (message.includes('auth') || message.includes('login')) {
                return 'Authentication error. Please login again.';
            }
            
            return 'An error occurred. Please try again.';
        },

        clearError() {
            this.hasError = false;
            this.errorMessage = '';
            this.errorDetails = '';
        },

        checkUserRole(uid) {
            // Role sudah di-set oleh Firebase listener di data.js (Users/$uid/role)
            // Hanya fallback ke 'user' jika listener belum selesai
            if (!this.userRole || this.userRole === 'user') {
                // Coba baca dari Firebase sekali sebagai fallback
                window.get(window.ref(window.db, `Users/${uid}/role`))
                    .then(snap => {
                        if (snap.exists()) {
                            this.userRole = snap.val();
                            console.log('User role from Firebase:', this.userRole);
                        }
                    })
                    .catch(() => {});
            }
        },

        // --- CALCULATED PROPERTIES (GETTERS) ---
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

        // --- PM SCHEDULE COMPUTED GETTERS ---

        /** Month label for calendar navigation */
        get pmMonthLabel() {
            const d = new Date();
            d.setMonth(d.getMonth() + (this.pmMonthOffset || 0));
            return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        },

        /** Build calendar grid days */
        get pmCalendarDays() {
            const today = new Date();
            const offset = this.pmMonthOffset || 0;
            const year = today.getFullYear();
            const month = today.getMonth() + offset;

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startPad = firstDay.getDay(); // 0=Sun

            // Build events lookup: dateStr -> events[]
            const eventsByDate = {};
            const equipList = this.pmFilterEquip
                ? this.equipment.filter(e => e.EquipmentID === this.pmFilterEquip)
                : this.equipment || [];

            const logs = this.logs || [];
            const todayStr = today.toISOString().split('T')[0];
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];

            equipList.forEach(eq => {
                if (!eq.NextPMDate) return;

                const pmDate = eq.NextPMDate;
                const isOverdue = pmDate < todayStr;
                const isDueSoon = !isOverdue && pmDate <= nextWeekStr;
                const isCompleted = logs.some(l =>
                    l.EquipmentID === eq.EquipmentID &&
                    l.Jenis === 'PM' &&
                    l.Tanggal === pmDate &&
                    l.Status === 'Completed'
                );

                const evt = {
                    id: `pm_${eq.EquipmentID}_${pmDate}`,
                    name: eq.Nama || eq.EquipmentID,
                    equipId: eq.EquipmentID,
                    date: pmDate,
                    dateISO: pmDate,
                    isOverdue,
                    isDueSoon,
                    isCompleted,
                    criticality: eq.Criticality || 'Medium',
                    location: eq.Lokasi || '',
                };

                if (!eventsByDate[pmDate]) eventsByDate[pmDate] = [];
                eventsByDate[pmDate].push(evt);
            });

            // Build days array
            const days = [];
            const totalDays = startPad + lastDay.getDate();
            const rows = Math.ceil(totalDays / 7);

            for (let i = 0; i < rows * 7; i++) {
                const dayNum = i - startPad + 1;
                const date = new Date(year, month, dayNum);
                const dateStr = date.toISOString().split('T')[0];
                const isOtherMonth = date.getMonth() !== month;
                const isToday = dateStr === todayStr;

                days.push({
                    date,
                    dateStr,
                    isToday,
                    isOtherMonth,
                    isWeekend: date.getDay() === 0 || date.getDay() === 6,
                    events: eventsByDate[dateStr] || [],
                });
            }

            return days;
        },

        /** PM Statistics */
        get pmStats() {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const endMonthStr = endMonth.toISOString().split('T')[0];
            const end30 = new Date(today);
            end30.setDate(today.getDate() + 30);
            const end30Str = end30.toISOString().split('T')[0];

            const logs = this.logs || [];
            const equipList = this.equipment || [];

            let overdue = 0, dueThisMonth = 0, upcoming = 0, completed = 0;

            equipList.forEach(eq => {
                if (!eq.NextPMDate) return;
                const pmDate = eq.NextPMDate;

                if (pmDate < todayStr) overdue++;
                else if (pmDate <= endMonthStr) dueThisMonth++;
                if (pmDate > todayStr && pmDate <= end30Str) upcoming++;

                const hasCompletion = logs.some(l =>
                    l.EquipmentID === eq.EquipmentID &&
                    l.Jenis === 'PM' &&
                    l.Status === 'Completed' &&
                    l.Tanggal >= todayStr
                );
                if (hasCompletion) completed++;
            });

            return { overdue, dueThisMonth, upcoming, completed };
        },

        // --- GANTT CHART GETTERS ---

        /** Months for Gantt scroll */
        get pmGanttMonths() {
            const months = [];
            for (let i = -2; i <= 4; i++) {
                const d = new Date();
                d.setMonth(d.getMonth() + i);
                months.push({
                    label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    offset: i,
                });
            }
            return months;
        },

        /** Day columns for Gantt (6 months worth) */
        get pmGanttDays() {
            const days = [];
            const scrollOffset = this.pmGanttScroll || 0;
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 2 + scrollOffset);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 4);
            endDate.setDate(0); // last day of previous month = end of range

            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                days.push({
                    date: d.getDate(),
                    dateStr,
                    dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2),
                    isToday: dateStr === todayStr,
                    isWeekend: d.getDay() === 0 || d.getDay() === 6,
                    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                });
            }

            return days;
        },

        /** Equipment rows for Gantt with event bars */
        get pmGanttRows() {
            const days = this.pmGanttDays;
            if (days.length === 0) return [];

            const dayWidth = 20; // px
            const daysTotal = days.length;
            const firstDateStr = days[0]?.dateStr || '';
            const lastDateStr = days[days.length - 1]?.dateStr || '';
            const logs = this.logs || [];
            const todayStr = new Date().toISOString().split('T')[0];
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];

            const daysSinceEpoch = (dateStr) => {
                return Math.floor(new Date(dateStr).getTime() / 86400000);
            };

            const day0 = daysSinceEpoch(firstDateStr);

            const equipList = this.pmFilterEquip
                ? this.equipment.filter(e => e.EquipmentID === this.pmFilterEquip)
                : this.equipment || [];

            const rows = [];

            equipList.forEach(eq => {
                if (!eq.NextPMDate) return;

                const pmDate = eq.NextPMDate;
                if (pmDate < firstDateStr || pmDate > lastDateStr) return;

                const isOverdue = pmDate < todayStr;
                const isDueSoon = !isOverdue && pmDate <= nextWeekStr;
                const isCompleted = logs.some(l =>
                    l.EquipmentID === eq.EquipmentID &&
                    l.Jenis === 'PM' &&
                    l.Tanggal === pmDate &&
                    l.Status === 'Completed'
                );

                const evtDay = daysSinceEpoch(pmDate) - day0;
                const left = evtDay * dayWidth;
                const width = dayWidth * 2 - 2; // 2-day span

                const events = [{
                    id: `pm_${eq.EquipmentID}_${pmDate}`,
                    name: 'PM',
                    equipId: eq.EquipmentID,
                    date: pmDate,
                    isOverdue,
                    isDueSoon,
                    isCompleted,
                    left,
                    width,
                    tooltip: `${eq.Nama || eq.EquipmentID} - PM: ${pmDate}`,
                    criticality: eq.Criticality || 'Medium',
                    location: eq.Lokasi || '',
                }];

                let status = 'Scheduled';
                if (isOverdue) status = 'Overdue';
                else if (isDueSoon) status = 'Due Soon';
                else if (isCompleted) status = 'Completed';

                rows.push({
                    equipId: eq.EquipmentID,
                    name: eq.Nama || eq.EquipmentID,
                    status,
                    events,
                });
            });

            return rows;
        },

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



        // Safe deep clone for external libraries
        safeDeepClone(data) {
            if (!data) return [];
            try {
                const raw = window.Alpine.raw(data);
                if (Array.isArray(raw)) {
                    return JSON.parse(JSON.stringify(raw));
                }
                return [];
            } catch (e) {
                console.warn('Deep clone failed:', e);
                return [];
            }
        },

        // Lazy load Chart.js - already statically imported
        async loadChartJS() {
            if (!window._chartJS) {
                window._chartJS = Chart;
            }
            return window._chartJS;
        },

        // Safe Chart creation with error boundary
        async safeCreateChart(ctx, config) {
            if (!ctx || !config) return null;
            try {
                const Chart = await this.loadChartJS();
                if (!Chart) return null;
                return new Chart(ctx, config);
            } catch (e) {
                console.error('Chart creation failed:', e);
                this.showNotification('Chart render failed', 'error');
                return null;
            }
        },

        // --- CHART RENDERING ---
        async renderDashboardCharts() {
            if (this.currentPage !== 'dash' || !this.isLoggedIn) return;
            
            try {
                // Use safe deep clone to avoid Alpine proxy issues
                const equipment = this.safeDeepClone(this.equipment);
                const performanceData = this.safeDeepClone(this.performanceData);
                const logs = this.safeDeepClone(this.logs);
                
                // Calculate stats dynamically from data
                let totalEquip = equipment?.length || 0;
                let totalDowntime = 0;
                let overduePM = 0;
                let lowStock = 0;
                
                // Equipment stats
                if (equipment && Array.isArray(equipment)) {
                    const today = new Date().toISOString().split('T')[0];
                    equipment.forEach(e => {
                        // Overdue PM check
                        if (e.NextPMDate && e.NextPMDate < today && e.NextPMDate !== '') {
                            overduePM++;
                        }
                    });
                }
                
                // Calculate total downtime from Performance data
                if (performanceData && Array.isArray(performanceData)) {
                    performanceData.forEach(p => {
                        totalDowntime += Number(p.bd) || 0; // Break downtime hours
                    });
                }
                
                // Low stock from allParts
                if (this.allParts && Array.isArray(this.allParts)) {
                    lowStock = this.allParts.filter(p => Number(p.Stok) <= Number(p.MinStock)).length;
                }
                
                // Update dashboard stats
                this.dashboardStats = {
                    totalEquip,
                    overduePM,
                    lowStock,
                    totalDowntime: totalDowntime.toFixed(1)
                };
                
                if (!equipment || equipment.length === 0) {
                    console.log('No equipment data for charts');
                    return;
                }
                
                const waitForCanvas = (id) => new Promise((resolve) => {
                    let retries = 0;
                    const check = () => {
                        const el = document.getElementById(id);
                        if (el && el.offsetParent !== null && el.clientHeight > 0) {
                            resolve(el);
                        } else if (retries < 5) {
                            retries++;
                            setTimeout(check, 100 * retries);
                        } else {
                            resolve(null);
                        }
                    };
                    check();
                });
                
                const renderCharts = async () => {
                    const tc = this.darkMode ? '#8b9eb7' : '#64748b';
                    const gc = this.darkMode ? 'rgba(0, 242, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

                    const ctxStatus = await waitForCanvas('statusChart');
                    if (this.currentPage !== 'dash') return;
                    if (ctxStatus && equipment.length > 0) {
                        const counts = { 'Active': 0, 'In Maintenance': 0, 'Idle': 0, 'Decommissioned': 0 };
                        equipment.forEach(e => { 
                            if (counts[e.Status] !== undefined) counts[e.Status]++; 
                            else counts['Idle']++; // default for unknown status
                        });
                        // Filter out zero values
                        const activeLabels = Object.keys(counts).filter(k => counts[k] > 0);
                        const activeData = activeLabels.map(k => counts[k]);
                        window._appCharts = window._appCharts || {};
                        if (window._appCharts.status) {
                            try { window._appCharts.status.destroy(); } catch(e) { console.warn('Chart destroy failed', e); }
                        }
                        const statusConfig = {
                            type: 'doughnut',
                            data: {
                                labels: activeLabels,
                                datasets: [{ data: activeData, backgroundColor: ['#00f2ff', '#bc13fe', '#334155', '#64748b'] }]
                            },
                            options: { 
                                animation: { duration: 1000, easing: 'easeOutQuart' }, 
                                maintainAspectRatio: false, 
                                responsive: true,
                                plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 10 } } } }
                            }
                        };
                        window._appCharts.status = await this.safeCreateChart(ctxStatus, statusConfig);
                    }

                    const ctxRel = await waitForCanvas('reliabilityChart');
                    if (this.currentPage !== 'dash') return;
                    if (ctxRel && performanceData.length > 0) {
                        const dailyPA = {};
                        performanceData.forEach(p => {
                            if (!p.date) return;
                            if (!dailyPA[p.date]) dailyPA[p.date] = [];
                            // Calculate PA: ((WH - BD - STB) / WH) * 100
                            const wh = Number(p.wh) || 24;
                            const bd = Number(p.bd) || 0;
                            const stb = Number(p.stb) || 0;
                            const pa = wh > 0 ? ((wh - bd - stb) / wh) * 100 : 0;
                            dailyPA[p.date].push(Math.max(0, Math.min(100, pa)));
                        });
                        const sorted = Object.keys(dailyPA).sort().slice(-7);
                        const avg = sorted.map(d => {
                            const arr = dailyPA[d];
                            if (!arr.length) return 0;
                            const sum = arr.reduce((a, b) => a + b, 0);
                            return (sum / arr.length).toFixed(1);
                        });
                        window._appCharts = window._appCharts || {};
                        if (window._appCharts.reliability) {
                            try { window._appCharts.reliability.destroy(); } catch(e) { console.warn('Chart destroy failed', e); }
                        }
                        const relConfig = {
                            type: 'line',
                            data: { labels: sorted, datasets: [{ label: 'PA %', data: avg, borderColor: '#00f2ff', tension: 0.3, fill: true, backgroundColor: 'rgba(0, 242, 255, 0.1)' }] },
                            options: {
                                animation: { duration: 1200, easing: 'easeOutQuart' }, 
                                maintainAspectRatio: false,
                                scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, min: 0, max: 100 } },
                                plugins: { legend: { display: false } }
                            }
                        };
                        window._appCharts.reliability = await this.safeCreateChart(ctxRel, relConfig);
                    }
                }
                this.$nextTick(() => {
                    requestAnimationFrame(() => renderCharts().catch(e => console.error(e)));
                });
            } catch (err) {
                console.error('renderDashboardCharts Error:', err);
            }
        },

        async renderKPICharts() {
            if (this.currentPage !== 'kpi') return;
            
            console.log('[KPI] Starting chart render, perfData length:', this.performanceData?.length);
            
            // Use safe deep clone to avoid Alpine proxy issues
            const perfData = this.safeDeepClone(this.performanceData);
            
            // Even if no data, try to render - will show empty state
            if (!perfData || perfData.length === 0) {
                console.log('[KPI] No performance data, will render empty state');
                // Still try to render to show empty state message
            }
            
            try {
                const waitForCanvas = (id) => new Promise((resolve) => {
                    let retries = 0;
                    const maxRetries = 20;
                    const check = () => {
                        const el = document.getElementById(id);
                        if (el && el.offsetParent !== null && el.clientHeight > 0) {
                            resolve(el);
                        } else if (retries < maxRetries) {
                            retries++;
                            setTimeout(check, 100 * retries);
                        } else {
                            console.log('[KPI] Canvas not found:', id);
                            resolve(null);
                        }
                    };
                    check();
                });
                
                const renderKPI = async () => {
                    if (this.currentPage !== 'kpi') return;
                    
                    const tc = this.darkMode ? '#8b9eb7' : '#64748b';
                    const gc = this.darkMode ? 'rgba(0, 242, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                    
                    // Filter by date based on kpiFilter
                    let filteredData = [];
                    const filterDate = this.kpiFilterDate;
                    const filterType = this.kpiFilter || 'yearly';
                    
                    // Always show all data if filter is yearly (default) or if no filter date
                    if (filterType === 'yearly' || !filterDate) {
                        filteredData = perfData || [];
                    } else if (perfData && Array.isArray(perfData) && perfData.length > 0) {
                        filteredData = perfData.filter(p => {
                            if (!p || !p.date) return false;
                            const pDateStr = p.date.toString();
                            
                            if (filterType === 'monthly') {
                                // Match YYYY-MM format
                                return pDateStr.startsWith(filterDate.substring(0, 7));
                            } else if (filterType === 'weekly') {
                                const pDate = new Date(p.date);
                                const fDate = new Date(filterDate);
                                if (isNaN(pDate.getTime()) || isNaN(fDate.getTime())) return false;
                                const diffDays = Math.floor((fDate - pDate) / (1000 * 60 * 60 * 24));
                                return diffDays >= -7 && diffDays <= 0;
                            }
                            return true;
                        });
                    } else {
                        filteredData = perfData || [];
                    }
                    
                    console.log('[KPI] Filtered data length:', filteredData.length);
                    const data = filteredData;

                    const chartOpts = (type) => ({
                        animation: { duration: 1000, easing: 'easeOutQuart' }, 
                        maintainAspectRatio: false, 
                        responsive: true,
                        scales: (type !== 'doughnut' && type !== 'pie') ? {
                            x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } },
                            y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true }
                        } : undefined,
                        plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 10 } } } }
                    });

                    const safeRender = async (id, chartKey, type, chartData, extraOpts = {}) => {
                        const el = await waitForCanvas(id);
                        if (this.currentPage !== 'kpi') return;
                        
                        window._appKpiCharts = window._appKpiCharts || {};
                        if (window._appKpiCharts[chartKey]) {
                            try { window._appKpiCharts[chartKey].destroy(); } catch(e) { console.warn('Chart destroy failed', e); }
                        }
                        
                        if (!el) {
                            console.log('[KPI] Canvas element not found for:', id);
                            return;
                        }
                        
                        // Always render chart, even with empty data
                        if (!chartData || !chartData.labels || chartData.labels.length === 0) {
                            // Render empty chart with placeholder
                            chartData = {
                                labels: ['No Data'],
                                datasets: [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                            };
                        }
                        
                        const kpiConfig = { type, data: chartData, options: { ...chartOpts(type), ...extraOpts } };
                        window._appKpiCharts[chartKey] = await this.safeCreateChart(el, kpiConfig);
                        console.log('[KPI] Chart rendered:', chartKey);
                    };

                    // PA Plan vs Actual by Equipment
                    const equipMap = {};
                    if (data && Array.isArray(data) && data.length > 0) {
                        data.forEach(p => {
                            if (!p || !p.equipmentId) return;
                            const name = this.getEquipName(p.equipmentId);
                            if (!equipMap[name]) equipMap[name] = { plans: [], actuals: [] };
                            const kpi = this.calculateKPI(p);
                            equipMap[name].plans.push(Number(p.paPlan) || 90);
                            equipMap[name].actuals.push(Number(kpi?.pa || 0));
                        });
                    }
                    const eqLabels = Object.keys(equipMap);
                    await safeRender('kpiPaVsActual', 'paVsActual', 'bar', {
                        labels: eqLabels.length > 0 ? eqLabels.map(l => l.length > 12 ? l.substring(0, 12) + '..' : l) : ['No Equipment'],
                        datasets: eqLabels.length > 0 ? [
                            { label: 'PA Plan %', data: eqLabels.map(k => (equipMap[k].plans.reduce((a, b) => a + b, 0) / equipMap[k].plans.length).toFixed(1)), backgroundColor: '#00f2ff' },
                            { label: 'PA Actual %', data: eqLabels.map(k => (equipMap[k].actuals.reduce((a, b) => a + b, 0) / equipMap[k].actuals.length).toFixed(1)), backgroundColor: '#bc13fe' }
                        ] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                    });

                    // PA by Area
                    const areaMap = {};
                    if (data && Array.isArray(data) && data.length > 0) {
                        data.forEach(p => {
                            if (!p || !p.area) return;
                            if (!areaMap[p.area]) areaMap[p.area] = { pa: [], count: 0 };
                            const kpi = this.calculateKPI(p);
                            areaMap[p.area].pa.push(Number(kpi?.pa || 0));
                            areaMap[p.area].count++;
                        });
                    }
                    const areaLabels = Object.keys(areaMap);
                    await safeRender('kpiAreaPa', 'areaPa', 'bar', {
                        labels: areaLabels.length > 0 ? areaLabels : ['No Data'],
                        datasets: areaLabels.length > 0 ? [{
                            label: 'Avg PA %',
                            data: areaLabels.map(k => (areaMap[k].pa.reduce((a, b) => a + b, 0) / areaMap[k].pa.length).toFixed(1)),
                            backgroundColor: '#f59e0b'
                        }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                    });

                    // Top 5 Events
                    const eventList = [];
                    if (data && Array.isArray(data) && data.length > 0) {
                        data.forEach(p => (p.events || []).forEach(ev => {
                            if (ev && ev.problem) {
                                eventList.push({ label: ev.problem, duration: Number(ev.duration) || 0 });
                            }
                        }));
                    }
                    eventList.sort((a, b) => b.duration - a.duration);
                    const top5Ev = eventList.slice(0, 5);
                    await safeRender('kpiTop5Events', 'top5Events', 'bar', {
                        labels: top5Ev.length > 0 ? top5Ev.map(e => e.label.substring(0, 20)) : ['No Events'],
                        datasets: top5Ev.length > 0 ? [{ label: 'Hours', data: top5Ev.map(e => e.duration), backgroundColor: '#ef4444' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                    }, { indexAxis: 'y' });

                    // Top 5 Components
                    const compMap = {};
                    if (data && Array.isArray(data) && data.length > 0) {
                        data.forEach(p => (p.events || []).forEach(ev => {
                            if (ev && ev.component) {
                                if (!compMap[ev.component]) compMap[ev.component] = 0;
                                compMap[ev.component] += Number(ev.duration) || 0;
                            }
                        }));
                    }
                    const compLabels = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 5);
                    await safeRender('kpiTop5Components', 'top5Components', 'bar', {
                        labels: compLabels.length > 0 ? compLabels : ['No Components'],
                        datasets: compLabels.length > 0 ? [{ label: 'Hours', data: compLabels.map(c => compMap[c]), backgroundColor: '#00f2ff' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                    }, { indexAxis: 'y' });

                    // Scheduled vs Unscheduled
                    const schedCounts = { Scheduled: 0, Unscheduled: 0 };
                    if (data && Array.isArray(data) && data.length > 0) {
                        data.forEach(p => {
                            if (p && p.type === 'Scheduled') schedCounts.Scheduled++;
                            else schedCounts.Unscheduled++;
                        });
                    }
                    await safeRender('kpiSchedVsUnsched', 'schedVsUnsched', 'doughnut', {
                        labels: Object.keys(schedCounts),
                        datasets: [{ data: Object.values(schedCounts), backgroundColor: ['#10b981', '#f59e0b'] }]
                    });

                    // Mechanical vs Electrical
                    const mechCounts = { Mechanical: 0, Electrical: 0, Operational: 0 };
                    if (data && Array.isArray(data) && data.length > 0) {
                        data.forEach(p => (p.events || []).forEach(ev => {
                            if (ev && ev.category) {
                                if (mechCounts[ev.category] !== undefined) mechCounts[ev.category]++;
                            }
                        }));
                    }
                    await safeRender('kpiMechVsElec', 'mechVsElec', 'doughnut', {
                        labels: Object.keys(mechCounts).filter(k => mechCounts[k] > 0),
                        datasets: [{ data: Object.values(mechCounts).filter(v => v > 0), backgroundColor: ['#00f2ff', '#bc13fe', '#f59e0b'] }]
                    });

                    // Pareto RCA
                    const rcaMap = {};
                    if (data && Array.isArray(data) && data.length > 0) {
                        data.forEach(p => (p.events || []).forEach(ev => {
                            if (ev && ev.rca) {
                                if (!rcaMap[ev.rca]) rcaMap[ev.rca] = 0;
                                rcaMap[ev.rca] += Number(ev.duration) || 0;
                            }
                        }));
                    }
                    const rcaLabels = Object.keys(rcaMap).sort((a, b) => rcaMap[b] - rcaMap[a]).slice(0, 10);
                    await safeRender('kpiParetoRCA', 'paretoRCA', 'bar', {
                        labels: rcaLabels.length > 0 ? rcaLabels : ['No RCA Data'],
                        datasets: rcaLabels.length > 0 ? [{ label: 'Hours', data: rcaLabels.map(c => rcaMap[c]), backgroundColor: '#00f2ff' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                    }, { indexAxis: 'y' });

                    console.log('[KPI] All charts rendered');
                };
                
                this.$nextTick(() => {
                    requestAnimationFrame(() => renderKPI().catch(e => console.error('KPI render error:', e)));
                });
            } catch (err) {
                console.error('renderKPICharts Error:', err);
                this.showNotification('Failed to render KPI charts', 'error');
            }
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
        }
    };
}
