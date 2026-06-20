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
    calculateHealthScore(equipId) {
        // Guard - safe defaults
        if (!equipId) return { score: 100, color: 'text-emerald-500', status: 'Optimal', breakdowns: 0 };
        
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
        
        return { score, color, status, breakdowns: breakdowns.length };
    },

    calculateMTBF(equipId) {
        // Guard
        if (!equipId) return 0;
        
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
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                const diff = dateA - dateB;
                totalInterval += (diff / (1000 * 60 * 60)); // in hours
            }
        }
        return (totalInterval / (breakdowns.length - 1)).toFixed(1);
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
