/**
 * Performance & KPI module
 */
import { validatePerformanceForm, withRetry, isNetworkError, sanitizeDataForFirebase } from '../utils.js';

export const performanceModule = {
    openPerformanceModal(edit = false, data = null) {
        this.isEditingPerformance = edit;
        if (edit && data) {
            this.performanceForm = { 
                ...data, 
                events: (data.events && Array.isArray(data.events)) ? data.events : [] 
            };
        } else {
            this.performanceForm = {
                id: '', equipmentId: '', date: new Date().toISOString().split('T')[0],
                wh: "24.00", bd: "0.00", stb: "0.00", freq: 0, type: 'Unscheduled', 
                area: '', paPlan: 90, remarks: '',
                rca: 'None', category: 'Mechanical', events: []
            };
        }
        this.showPerformanceModal = true;
    },

    addBDEvent() {
        // Ensure events array exists
        if (!this.performanceForm.events) {
            this.performanceForm.events = [];
        }
        this.performanceForm.events.push({ 
            category: 'Mechanical', component: '', duration: 0, problem: '', rca: 'Operational Misuse' 
        });
    },

    removeBDEvent(index) {
        // Ensure events array exists
        if (!this.performanceForm.events || !Array.isArray(this.performanceForm.events)) {
            return;
        }
        this.performanceForm.events.splice(index, 1);
        this.updatePerfHours('bd');
    },

    updatePerfHours(field) {
        // Guard against undefined form
        if (!this.performanceForm || !this.performanceForm.events) return;
        
        let mechanicalBD = 0;
        let operationalSTB = 0;
        
        this.performanceForm.events.forEach(ev => {
            if (!ev) return;
            const dur = Number(ev.duration) || 0;
            if (ev.category === 'Operational') {
                operationalSTB += dur;
            } else {
                mechanicalBD += dur;
            }
        });
        
        this.performanceForm.bd = mechanicalBD.toFixed(2);
        this.performanceForm.freq = (this.performanceForm.events || []).filter(e => e && e.category !== 'Operational').length;

        let wh = Number(this.performanceForm.wh) || 0;
        let bd = mechanicalBD;
        let stb = operationalSTB;

        if (field === 'wh') {
            let newStb = 24 - wh - bd;
            if (newStb < 0) { 
                newStb = 0; wh = 24 - bd; 
                this.performanceForm.wh = Math.max(0, wh).toFixed(2); 
            }
            this.performanceForm.stb = Math.max(0, newStb).toFixed(2);
        } else if (field === 'stb') {
            let newWh = 24 - stb - bd;
            if (newWh < 0) { 
                newWh = 0; stb = 24 - bd; 
                this.performanceForm.stb = Math.max(0, stb).toFixed(2); 
            }
            this.performanceForm.wh = Math.max(0, newWh).toFixed(2);
        } else if (field === 'bd') {
            let newWh = 24 - bd - stb;
            if (newWh < 0) {
                newWh = 0;
                let newStb = 24 - bd;
                this.performanceForm.stb = Math.max(0, newStb).toFixed(2);
            }
            this.performanceForm.wh = Math.max(0, newWh).toFixed(2);
        }
    },

    async submitPerformance() {
        // Guard against undefined form
        if (!this.performanceForm) {
            this.showNotification("Form not initialized", "error");
            return;
        }

        const errors = validatePerformanceForm(this.performanceForm);
        if (errors.length > 0) {
            this.showNotification(errors[0], "error");
            return;
        }
        
        if (!this.isEditingPerformance && !this.isAdmin) {
            this.showNotification("Admin access required to create performance records", "error");
            return;
        }
        
        this.isLoading = true;
        try {
            const perfId = this.isEditingPerformance ? (this.performanceForm.id || '') : ("PERF-" + Date.now());
            
            const events = this.performanceForm.events || [];
            const totalBD = events.reduce((acc, curr) => acc + Number(curr?.duration || 0), 0);
            const data = { 
                ...this.performanceForm, 
                id: perfId,
                bd: totalBD,
                freq: events.length,
                updatedBy: this.user?.uid || 'unknown',
                updatedAt: new Date().toISOString()
            };
            
            if (!this.isEditingPerformance) {
                data.createdBy = this.user?.uid || 'unknown';
            } else if (this.performanceData && Array.isArray(this.performanceData)) {
                const existing = this.performanceData.find(p => p && p.id === perfId);
                if (existing && existing.createdBy) {
                    data.createdBy = existing.createdBy;
                }
            }

            data.wh = Number(data.wh) || 0; 
            data.stb = Number(data.stb) || 0;
            data.paPlan = Number(data.paPlan) || 90;

            // Sanitize data before saving
            const sanitizedData = sanitizeDataForFirebase(data);

            // If offline, queue the operation
            if (!this.isOnline) {
                const queued = await this.queueOfflineOperation('performance', sanitizedData);
                if (queued) {
                    const perfData = this.performanceData || [];
                    const idx = perfData.findIndex(p => p && p.id === perfId);
                    if (idx >= 0) {
                        this.performanceData[idx] = sanitizedData;
                    } else {
                        this.performanceData.unshift(sanitizedData);
                    }
                    await this.saveToIndexedDB();
                    this.showNotification("Performance data saved offline, will sync when online");
                    this.showPerformanceModal = false;
                    this.isLoading = false;
                    return;
                }
            }

            await withRetry(async () => {
                await window.set(window.ref(window.db, 'Performance/' + perfId), sanitizedData);
            }, {
                maxRetries: 3,
                delay: 1000,
                backoff: 2,
                onRetry: (attempt, error, delay) => {
                    if (isNetworkError(error)) {
                        this.showNotification("Network error, retrying...", "info");
                    }
                }
            });
            this.showNotification("KPI metrics successfully synced!");
            
            // Add to local array immediately for instant UI update
            const perfData = this.performanceData || [];
            const existingIdx = perfData.findIndex(p => p && p.id === sanitizedData.id);
            if (existingIdx >= 0) {
                this.performanceData[existingIdx] = sanitizedData;
            } else {
                this.performanceData.unshift(sanitizedData);
            }
            
            this.showPerformanceModal = false;
        } catch (e) {
            console.error('Submit Performance Error:', e);
            this.showNotification("Error: " + (e?.message || "Unknown error"), "error");
        } finally {
            this.isLoading = false;
        }
    },

    calculateKPI(p) {
        // Guard - return safe defaults
        if (!p) return { ma: '0.0', pa: '0.0', ua: '0.0', mtbf: '0.0', mttr: '0.0', gap: '0.0' };
        
        const wh = Number(p.wh) || 0;
        const bd = Number(p.bd) || 0;
        const stb = Number(p.stb) || 0;
        const events = p.events;
        const freq = (events && Array.isArray(events) && events.length > 0) ? events.length : (Number(p.freq) || 0);
        
        const total = 24, avail = wh + stb;
        const MA = (avail + bd) > 0 ? (avail / (avail + bd)) * 100 : 0;
        const PA = (avail / total) * 100;
        const UA = avail > 0 ? (wh / avail) * 100 : 0;
        const MTBF = freq > 0 ? wh / freq : wh;
        const MTTR = freq > 0 ? bd / freq : 0;
        const paPlan = Number(p.paPlan) || 90;
        const gap = PA - paPlan;
        
        return { 
            ma: MA.toFixed(1), 
            pa: PA.toFixed(1), 
            ua: UA.toFixed(1), 
            mtbf: MTBF.toFixed(1), 
            mttr: MTTR.toFixed(1), 
            gap: gap.toFixed(1) 
        };
    },

    getFilteredPerfData() {
        // Guard - return empty array safely
        const perfData = this.performanceData;
        if (!perfData || !Array.isArray(perfData)) return [];

        // If no filter date, return all data
        const ref = this.kpiFilterDate;
        if (!ref) return perfData;

        // Validate date string
        const refDate = new Date(ref);
        if (isNaN(refDate.getTime())) return perfData;

        const filter = this.kpiFilter || 'yearly';

        // yearly - return all data from that year
        if (filter === 'yearly') {
            return perfData.filter(p => {
                if (!p || !p.date) return false;
                const d = new Date(p.date);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === refDate.getFullYear();
            });
        }

        return perfData.filter(p => {
            if (!p || !p.date) return false;
            const d = new Date(p.date);
            if (isNaN(d.getTime())) return false;

            if (filter === 'daily') return p.date === ref;
            if (filter === 'weekly') {
                const dayOfWeek = refDate.getDay();
                const weekStart = new Date(refDate); weekStart.setDate(refDate.getDate() - dayOfWeek);
                weekStart.setHours(0,0,0,0);
                const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23,59,59,999);
                return d >= weekStart && d <= weekEnd;
            }
            // monthly
            return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
        });
    }
};
