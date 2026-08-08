/**
 * KPI Engine Module for Neural Prediction and Analytics
 */
export const kpiEngineModule = {
    // Helper: unwrap Alpine proxy safely
    _raw(data) {
        try {
            if (window.Alpine?.raw) return window.Alpine.raw(data);
            if (data && typeof data === 'object' && data.__v_raw) return data.__v_raw;
            return data;
        } catch (e) {
            return Array.isArray(data) ? [...data] : data;
        }
    },

    // --- NEURAL PREDICTION ENGINE ---
    // Cache results; invalidated when this.logs/this.equipment reference changes.
    _kpiKey(extra) {
        return (this.logs || []).length + '|' + (this.equipment || []).length + '|' + (extra || '');
    },
    calculateHealthScore(equipId) {
        // Guard - safe defaults
        if (!equipId) return { score: 100, color: 'text-emerald-500', status: 'Optimal', breakdowns: 0 };
        
        const key = this._kpiKey('h' + equipId);
        if (this._kpiCache && this._kpiCache.key === key && this._kpiCache.h.has(equipId)) {
            return this._kpiCache.h.get(equipId);
        }
        if (!this._kpiCache || this._kpiCache.key !== key) {
            this._kpiCache = { key, h: new Map(), m: new Map() };
        }

        const logs = this._raw(this.logs) || [];
        const equipment = this._raw(this.equipment) || [];
        
        // Guard - validate equipment array
        if (!Array.isArray(equipment)) return { score: 100, color: 'text-emerald-500', status: 'Optimal', breakdowns: 0 };
        
        const assetLogs = logs.filter(l => l && l.EquipmentID === equipId);
        const asset = equipment.find(e => e && e.EquipmentID === equipId);
        if (!asset) return { score: 100, color: 'text-emerald-500', status: 'Optimal', breakdowns: 0 };

        let score = 100;
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

        // 1. Breakdown Impact (Last 90 Days)
        const breakdowns = assetLogs.filter(l => l && l.Jenis === 'Breakdown' && l.Tanggal && new Date(l.Tanggal) > ninetyDaysAgo);
        score -= (breakdowns.length * 15);

        // 2. PM Compliance
        if (asset.NextPMDate) {
            const pmDate = new Date(asset.NextPMDate);
            if (!isNaN(pmDate.getTime())) {
                if (pmDate < now) {
                    const daysOverdue = Math.floor((now - pmDate) / (1000 * 60 * 60 * 24));
                    score -= Math.min(daysOverdue * 2, 30); // Max 30 point penalty
                }
            }
        }

        // 3. Reliability Factor (MTBF Analysis)
        const mtbf = this.calculateMTBF(equipId);
        if (mtbf > 0 && mtbf < 168) score -= 10; // Less than a week MTBF is critical

        score = Math.max(0, Math.min(100, score));
        const color = score > 80 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-rose-500';
        const status = score > 80 ? 'Optimal' : score > 50 ? 'Warning' : 'Critical';
        
        const result = { score, color, status, breakdowns: breakdowns.length };
        this._kpiCache.h.set(equipId, result);
        return result;
    },


    // HM-aware interval: prefer meter delta if both logs have HM, else calendar hours
    _hmIntervalHours(a, b) {
        const hmA = Number(a?.HM); const hmB = Number(b?.HM);
        if (hmA > 0 && hmB > 0) return Math.max(0, hmB - hmA);
        const dA = new Date(a?.Tanggal), dB = new Date(b?.Tanggal);
        if (!isNaN(dA) && !isNaN(dB)) return Math.max(0, (dB - dA) / (1000 * 60 * 60));
        return 0;
    },

    calculateMTBF(equipId) {
        // Guard
        if (!equipId) return 0;
        
        const key = this._kpiKey('m' + equipId);
        if (this._kpiCache && this._kpiCache.key === key && this._kpiCache.m.has(equipId)) {
            return this._kpiCache.m.get(equipId);
        }
        if (!this._kpiCache || this._kpiCache.key !== key) {
            this._kpiCache = { key, h: new Map(), m: new Map() };
        }

        const logs = this._raw(this.logs);
        if (!logs || !Array.isArray(logs)) return 0;
        
        const breakdowns = logs
            .filter(l => l && l.EquipmentID === equipId && l.Jenis === 'Breakdown')
            .sort((a, b) => {
                if (!a.Tanggal || !b.Tanggal) return 0;
                return new Date(a.Tanggal) - new Date(b.Tanggal);
            });
        
        if (breakdowns.length < 2) return 0;

        let totalInterval = 0;
        for (let i = 1; i < breakdowns.length; i++) {
            const dateA = new Date(breakdowns[i].Tanggal);
            const dateB = new Date(breakdowns[i-1].Tanggal);
            totalInterval += this._hmIntervalHours(breakdowns[i-1], breakdowns[i]);
        }
        const result = (totalInterval / (breakdowns.length - 1)).toFixed(1);
        this._kpiCache.m.set(equipId, result);
        return result;
    },

    predictNextFailure(equipId) {
        // Guard
        if (!equipId) return 'N/A';
        
        const mtbf = parseFloat(this.calculateMTBF(equipId));
        if (mtbf <= 0) return 'Insufficient Data';

        const logs = this._raw(this.logs);
        if (!logs || !Array.isArray(logs)) return 'Insufficient Data';
        
        const lastBreakdown = logs
            .filter(l => l && l.EquipmentID === equipId && l.Jenis === 'Breakdown')
            .sort((a, b) => {
                if (!a.Tanggal || !b.Tanggal) return 0;
                return new Date(b.Tanggal) - new Date(a.Tanggal);
            })[0];
        
        if (!lastBreakdown || !lastBreakdown.Tanggal) return 'No failures recorded';

        const lastDate = new Date(lastBreakdown.Tanggal);
        if (isNaN(lastDate.getTime())) return 'Invalid date data';

        const nextDate = new Date(lastDate.getTime() + (mtbf * 60 * 60 * 1000));
        return nextDate.toLocaleDateString();
    },

    getEquipName(id) {
        if (!id) return "Unknown Asset";
        console.log('[getEquipName] looking for id:', id);
        
        const equipment = this._raw(this.equipment);
        if (!equipment || !Array.isArray(equipment)) {
            console.log('[getEquipName] equipment not array or empty');
            return id;
        }
        
        // Try exact match first
        let e = equipment.find(x => x && x.EquipmentID === id);
        if (e) {
            console.log('[getEquipName] found:', e.Nama);
            return e.Nama;
        }
        
        // Try case-insensitive
        e = equipment.find(x => x && x.EquipmentID && x.EquipmentID.toLowerCase() === id.toLowerCase());
        if (e) {
            console.log('[getEquipName] found (case-ins):', e.Nama);
            return e.Nama;
        }
        
        console.log('[getEquipName] NOT FOUND');
        return "Unknown Asset";
    }
};
