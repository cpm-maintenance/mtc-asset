/**
 * Performance & KPI module
 */
import { validatePerformanceForm, withRetry, isNetworkError, sanitizeDataForFirebase, computeBDFromLogs } from '../utils.js';

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
        if (!this.performanceForm) return;

        const events = this.performanceForm.events || [];
        let mechanicalBD = 0;
        let operationalSTB = 0;

        events.forEach(ev => {
            if (!ev) return;
            const dur = Number(ev.duration) || 0;
            if (ev.category === 'Operational') operationalSTB += dur;
            else mechanicalBD += dur;
        });

        // bd & freq: hanya event non-Operational (breakdown mekanik/elektrik)
        this.performanceForm.bd = mechanicalBD.toFixed(2);
        this.performanceForm.freq = events.filter(e => e && e.category !== 'Operational').length;

        let stb;
        if (field === 'stb') {
            // Manual input standby — dihormati apa adanya
            stb = Number(this.performanceForm.stb) || 0;
        } else {
            // Event Operational = sumber stb otomatis (override manual saat event diubah)
            stb = operationalSTB > 0 ? operationalSTB : (Number(this.performanceForm.stb) || 0);
        }

        // wh selalu auto: 1 hari (24h) - breakdown - standby
        let wh = 24 - mechanicalBD - stb;
        if (wh < 0) {
            wh = 0;
            stb = Math.max(0, 24 - mechanicalBD);
        }

        this.performanceForm.wh = wh.toFixed(2);
        this.performanceForm.stb = stb.toFixed(2);
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
            // bd hanya breakdown non-Operational; Operational = standby (stb)
            const mechBD = events.reduce((acc, curr) => acc + ((curr && curr.category !== 'Operational') ? (Number(curr?.duration) || 0) : 0), 0);
            const data = { 
                ...this.performanceForm, 
                id: perfId,
                bd: mechBD,
                freq: events.filter(e => e && e.category !== 'Operational').length,
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

    // R6: recompute bd for all Performance records from WO breakdown logs
    async recomputeBD() {
        if (!this.isAdminOrSupervisor) {
            this.showNotification('Admin access required', 'error');
            return;
        }
        if (!window.db) return;
        const perf = (this.performanceData || []).filter(p => p && p.EquipmentID);
        if (!perf.length) { this.showNotification('Tidak ada data Performance', 'info'); return; }
        let updated = 0;
        for (const p of perf) {
            try {
                const bd = computeBDFromLogs(this.logs, p.EquipmentID, p.date);
                const freq = (this.logs || []).filter(l => l && l.EquipmentID === p.EquipmentID
                    && l.Jenis === 'Breakdown' && l.Tanggal === p.date).length;
                const updates = { bd: Number(bd.toFixed(2)), freq, bdSource: 'wo', updatedAt: new Date().toISOString() };
                await window.update(window.ref(window.db, 'Performance/' + (p.id || p.Id)), updates);
                Object.assign(p, updates);
                updated++;
            } catch (e) { console.warn('[R6] recomputeBD fail:', p.id, e.message); }
        }
        this.showNotification('BD disinkronkan dari WO: ' + updated + ' record', 'success');
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
