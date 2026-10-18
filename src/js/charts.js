// @ts-check
import { logger } from './logger.js';
import { chartColor } from './chart-palette.js';
/** @typedef {import('./appstate').AppState} AppState */
export const chartModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    // Safe deep clone helper
    safeDeepClone(data) {
        try { return JSON.parse(JSON.stringify(data)); }
        catch (e) { return Array.isArray(data) ? [...data] : data || {}; }
    },

    // Lazy load Chart.js — dynamic import (198KB, only when dashboard renders)
    async loadChartJS() {
        if (!window._chartJS) {
            const { Chart, registerables } = await import('chart.js');
            Chart.register(...registerables);
            window._chartJS = Chart;
        }
        return window._chartJS;
    },

    // Resolve accent color per theme (gold/navy/purple/blue)
    // Warna chart dibaca dari token `--tac-chart-*` (lihat src/js/chart-palette.js).
    // Sebelumnya keempat tema ditulis sebagai hex/`rgba()` di sini: hex tidak ikut
    // tema saat paint, dan menambah tema berarti menambah satu tabel lagi.
    themeAccent() { return this.chartColor('accent'); },
    themeAccentSoft() { return this.chartColor('accent-soft', 0.1); },
    themeGrid() { return this.chartColor('grid', 0.05); },
    /** @param {string} name @param {number} [alpha] */
    chartColor(name, alpha) { return chartColor(name, alpha); },
    // Safe Chart creation with error boundary — auto-destroy existing chart on same canvas
    async safeCreateChart(ctx, config) {
        try {
            const Chart = await this.loadChartJS();
            if (!Chart) return null;
            // Destroy existing chart on this canvas (handles concurrent renderDashboardCharts)
            const existing = Chart.getChart(ctx);
            if (existing) existing.destroy();
            return new Chart(ctx, config);
        } catch (e) {
            console.error('Chart creation failed:', e);
            this.showNotification('Chart render failed', 'error');
            return null;
        }
    },

    _monthKey(d) { return d && !isNaN(new Date(d).getTime()) ? new Date(d).toISOString().slice(0, 7) : ''; },

    // --- MTBF/MTTR TREND CHART (MTBFMTTR page) ---
    async renderMTBFMTTRChart() {
        const equipId = this.mtbfFilterEquip;
        if (!equipId) return;
        const canvas = document.getElementById('mtbfChart');
        if (!canvas) return;
        try {
            const allLogs = /** @type {any[]} */ (this._raw?.(this.logs) || []);
            const eqLogs = allLogs.filter(l => l && l.EquipmentID === equipId);
            if (!eqLogs.length) return;
            const allPerf = /** @type {any[]} */ (this._raw?.(this.performanceData) || []);
            // ⚠️ Performance pakai equipmentId (lowercase)
            const eqPerf = allPerf.filter(p => p && (p.equipmentId || p.EquipmentID) === equipId);

            const monthSet = new Set();
            eqLogs.forEach(l => { const y = this._monthKey(l.Tanggal); if (y) monthSet.add(y); });
            eqPerf.forEach(p => { const y = this._monthKey(p.date || p.Tanggal); if (y) monthSet.add(y); });

            const labels = /** @type {any[]} */ ([]), mtbfValues = /** @type {any[]} */ ([]), mttrValues = /** @type {any[]} */ ([]);
            [...monthSet].sort().forEach(y => {
                const ms = eqLogs.filter(l => this._monthKey(l.Tanggal) === y);
                const logFailures = ms.filter(l => l.Jenis === 'Breakdown').length;
                const repairs = ms.filter(l => l.Jenis === 'Repair').length;
                const perfMonth = eqPerf.filter(p => this._monthKey(p.date || p.Tanggal) === y);
                const wh = perfMonth.reduce((s, p) => s + (Number(p.wh) || 0), 0);
                const bd = perfMonth.reduce((s, p) => s + (Number(p.bd) || 0), 0);
                const perfFreq = perfMonth.reduce((s, p) => s + (Number(p.freq) || 0), 0);
                const perfEvents = perfMonth.reduce((s, p) => s + ((p.events && p.events.length) || 0), 0);
                const failures = perfFreq || perfEvents || logFailures;
                labels.push(y);
                mtbfValues.push(failures > 0 && wh > 0 ? Number((wh / failures).toFixed(1)) : 0);
                mttrValues.push(repairs > 0 && bd > 0 ? Number((bd / failures).toFixed(1)) : 0);
            });

            const tc = this.chartColor('tick');
            const config = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'MTBF (hrs)', data: mtbfValues, borderColor: this.themeAccent(), tension: 0.35, yAxisID: 'y' },
                        { label: 'MTTR (hrs)', data: mttrValues, borderColor: this.chartColor('warn'), tension: 0.35, yAxisID: 'y' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
                    scales: { y: { beginAtZero: true, grid: { color: this.themeGrid() }, ticks: { color: tc } }, x: { ticks: { color: tc } } },
                    plugins: { legend: { labels: { color: tc, font: { size: 10 } } } }
                }
            };
            const Chart = await this.loadChartJS();
            const existing = Chart.getChart(canvas);
            if (existing) existing.destroy();
            window._appCharts = window._appCharts || {};
            window._appCharts.mtbfChart = await this.safeCreateChart(canvas, config);
        } catch (e) {
            console.error('MTBF/MTTR chart render failed:', e);
        }
    },

    // --- CHART EMPTY / OFFLINE / ERROR STATE ---
    /**
     * Tampilkan pesan status eksplisit di atas kanvas chart supaya chart tidak
     * pernah "blank senyap" saat data kosong atau koneksi offline.
     * @param {string} canvasId
     * @param {'empty'|'offline'|'error'} kind
     * @param {string} message
     */
    setChartState(canvasId, kind, message) {
        const canvas = document.getElementById(canvasId);
        const host = canvas && canvas.parentElement;
        if (!host || !canvas) return;

        host.querySelectorAll('[data-chart-state]').forEach((el) => el.remove());

        const presets = /** @type {Record<string, {icon: string, tone: string}>} */ ({
            offline: { icon: 'wifi_off', tone: 'text-tac-status-repair' },
            error: { icon: 'warning', tone: 'text-tac-status-emergency' },
            empty: { icon: 'show_chart', tone: 'text-tac-on-surface-variant' },
        });
        const cfg = presets[kind] || presets.empty;

        const box = document.createElement('div');
        box.setAttribute('data-chart-state', kind);
        box.setAttribute('role', 'status');
        box.setAttribute('aria-live', 'polite');
        box.className = 'absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-4 text-center pointer-events-none';

        const ic = document.createElement('i');
        ic.className = `material-symbols-outlined icon-22 ${cfg.tone}`;
        ic.textContent = cfg.icon;
        ic.setAttribute('aria-hidden', 'true');

        const p = document.createElement('p');
        p.className = 'text-[11px] font-bold text-tac-on-surface-variant max-w-[22ch] leading-snug';
        p.textContent = message;

        box.appendChild(ic);
        box.appendChild(p);
        host.appendChild(box);

        // Sembunyikan kanvas kosong agar pesan jadi fokus utama.
        canvas.style.visibility = 'hidden';
    },

    /**
     * Hapus overlay status chart & tampilkan kembali kanvas.
     * @param {string} canvasId
     */
    clearChartState(canvasId) {
        const canvas = document.getElementById(canvasId);
        const host = canvas && canvas.parentElement;
        if (!host || !canvas) return;
        host.querySelectorAll('[data-chart-state]').forEach((el) => el.remove());
        canvas.style.visibility = '';
    },

    /** @returns {'offline'|'empty'} */
    _chartIdleKind() {
        return (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'offline' : 'empty';
    },

    // --- DASHBOARD CHARTS ---
    async renderDashboardCharts() {
        if (this.currentPage !== 'dash' || !this.isLoggedIn) return;

        // Destroy any remaining chart instances to prevent "Canvas already in use"
        Object.values(window._appCharts || {}).forEach(c => { 
            if(c) { try { c.destroy(); } catch(e) {} }
        });
        window._appCharts = { status: null, cost: null, downtime: null, reliability: null, woCompletion: null };

        try {
            const equipment = /** @type {any[]} */ (this.safeDeepClone(this.equipment));
            const performanceData = /** @type {any[]} */ (this.safeDeepClone(this.performanceData));
            const logs = /** @type {any[]} */ (this.safeDeepClone(this.logs));

            let totalEquip = equipment?.length || 0;
            let totalDowntime = 0;
            let overduePM = 0;
            let lowStock = 0;

            if (this.pmList && Array.isArray(this.pmList)) {
                const today = new Date().toISOString().split('T')[0];
                overduePM = this.pmList.filter(p => p.status === 'pending' && !!p.date && p.date < today).length;
            }
            if (performanceData && Array.isArray(performanceData)) {
                performanceData.forEach(p => { totalDowntime += Number(p.bd) || 0; });
            }
            if (this.allParts && Array.isArray(this.allParts)) {
                lowStock = this.allParts.filter(p => Number(p.Stok) <= Number(p.MinStock)).length;
            }

            this.dashboardStats = { totalEquip, overduePM, lowStock, totalDowntime: totalDowntime.toFixed(1) };

            if (!equipment || equipment.length === 0) {
                const kind = this._chartIdleKind();
                const msg = kind === 'offline' ? 'Offline — no cached data' : 'No data for this range';
                ['reliabilityChart', 'pmStatusChart', 'woCompletionChart', 'costTrendChart']
                    .forEach((id) => this.setChartState(id, kind, msg));
                return;
            }

            const waitForCanvas = (/** @type {string} */ id) => new Promise((resolve) => {
                let retries = 0;
                const check = () => {
                    const el = document.getElementById(id);
                    if (el && el.offsetParent !== null && el.clientHeight > 0) resolve(el);
                    else if (retries < 5) { retries++; setTimeout(check, 100 * retries); }
                    else resolve(null);
                };
                check();
            });

            const renderCharts = async () => {
                const tc = this.chartColor('tick');
                const gc = this.themeGrid();

                // Bersihkan overlay status lama sebelum render ulang.
                ['reliabilityChart', 'pmStatusChart', 'woCompletionChart', 'costTrendChart']
                    .forEach((id) => this.clearChartState(id));

                const ctxRel = await waitForCanvas('reliabilityChart');
                if (this.currentPage !== 'dash') return;
                if (ctxRel && performanceData.length > 0) {
                    const dailyPA = /** @type {Record<string, number[]>} */ ({});
                    performanceData.forEach(p => {
                        if (!p.date) return;
                        if (!dailyPA[p.date]) dailyPA[p.date] = [];
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
                        return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
                    });
                    window._appCharts = window._appCharts || {};
                    if (window._appCharts.reliability) {
                        try { window._appCharts.reliability.destroy(); } catch (e) { console.warn('Chart destroy failed', e); }
                    }
                    window._appCharts.reliability = await this.safeCreateChart(ctxRel, {
                        type: 'line',
                        data: { labels: sorted, datasets: [{ label: 'PA %', data: avg, borderColor: this.themeAccent(), tension: 0.3, fill: true, backgroundColor: this.themeAccentSoft() }] },
                        options: { animation: { duration: 1200, easing: 'easeOutQuart' }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, min: 0, max: 100 } }, plugins: { legend: { display: false } } }
                    });
                } else if (ctxRel) {
                    this.setChartState('reliabilityChart', this._chartIdleKind(), 'No performance data for this range');
                }

                const ctxPM = await waitForCanvas('pmStatusChart');
                if (this.currentPage !== 'dash') return;
                if (ctxPM) {
                    const pmList = /** @type {any[]} */ (this.safeDeepClone(this.pmList) || []);
                    const today = new Date().toISOString().split('T')[0];
                    let pending = 0, overdue = 0, completed = 0, cancelled = 0;
                    pmList.forEach(pm => {
                        if (pm.status === 'completed') completed++;
                        else if (pm.status === 'cancelled') cancelled++;
                        else if (pm.status === 'pending' && pm.date < today) overdue++;
                        else pending++;
                    });
                    window._appCharts = window._appCharts || {};
                    if (window._appCharts.pmStatus) {
                        try { window._appCharts.pmStatus.destroy(); } catch (e) { console.warn('Chart destroy failed', e); }
                    }
                    if (overdue + pending + completed + cancelled > 0) {
                        window._appCharts.pmStatus = await this.safeCreateChart(ctxPM, {
                            type: 'bar',
                            data: { labels: ['Overdue', 'Pending', 'Completed', 'Cancelled'], datasets: [{ data: [overdue, pending, completed, cancelled], backgroundColor: [this.chartColor('crit', 0.7), this.themeAccentSoft(), this.chartColor('good', 0.7), this.chartColor('muted', 0.5)], borderColor: [this.chartColor('crit'), this.themeAccent(), this.chartColor('good'), this.chartColor('muted')], borderWidth: 1, borderRadius: 4 }] },
                            options: { indexAxis: 'y', animation: { duration: 800, easing: 'easeOutQuart' }, maintainAspectRatio: false, responsive: true, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true }, y: { grid: { display: false }, ticks: { color: tc, font: { size: 10, weight: 'bold' } } } }, plugins: { legend: { display: false } } }
                        });
                    } else {
                        this.setChartState('pmStatusChart', this._chartIdleKind(), 'No PM tasks for this range');
                    }
                }

                // WO Completion Rate (donut)
                const ctxWo = await waitForCanvas('woCompletionChart');
                if (this.currentPage !== 'dash') return;
                if (ctxWo) {
                    const from = this.dashboardDateFrom || '';
                    const to = this.dashboardDateTo || '';
                    const inRange = (/** @type {any} */ d) => !d || ((!from || d >= from) && (!to || d <= to));
                    const wos = (this.logs || []).filter(l => l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Approved' || l.Status === 'Completed' || l.Status === 'In Progress') && inRange(l.Tanggal));
                    const woCompleted = wos.filter(l => l.Status === 'Completed').length;
                    const woInProgress = wos.filter(l => l.Status === 'In Progress').length;
                    const woPending = wos.filter(l => l.Status !== 'Completed' && l.Status !== 'In Progress').length;
                    if (wos.length > 0) {
                        if (window._appCharts.woCompletion) { try { window._appCharts.woCompletion.destroy(); } catch(e) {} }
                        window._appCharts.woCompletion = await this.safeCreateChart(ctxWo, {
                            type: 'doughnut', data: { labels: ['Completed', 'In Progress', 'Pending'], datasets: [{ data: [woCompleted, woInProgress, woPending], backgroundColor: [this.chartColor('good'), this.chartColor('info'), this.chartColor('warn')] }] },
                            options: { animation: { duration: 1000, easing: 'easeOutQuart' }, maintainAspectRatio: false, responsive: true, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 10 } } } } }
                        });
                    } else {
                        this.setChartState('woCompletionChart', this._chartIdleKind(), 'No work orders in this range');
                    }
                }

                // Cost Trend (P1) — reuse calcCostTrend
                const ctxCost = await waitForCanvas('costTrendChart');
                if (this.currentPage !== 'dash') return;
                if (ctxCost) {
                    const ct = /** @type {any[]} */ (this.calcCostTrend ? this.calcCostTrend() : []);
                    if (ct.length > 0) {
                        if (window._appCharts.costTrend) { try { window._appCharts.costTrend.destroy(); } catch(e) {} }
                        window._appCharts.costTrend = await this.safeCreateChart(ctxCost, {
                            type: 'line',
                            data: { labels: ct.map(c => c.month.substring(5)), datasets: [{ label: 'Cost (Rp)', data: ct.map(c => c.cost), borderColor: this.chartColor('emerald'), backgroundColor: this.chartColor('emerald', 0.1), fill: true, tension: 0.3 }] },
                            options: { animation: { duration: 1000 }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true } }, plugins: { legend: { display: false } } }
                        });
                    } else {
                        this.setChartState('costTrendChart', this._chartIdleKind(), 'No cost data for this range');
                    }
                }
            };
            this.$nextTick(() => requestAnimationFrame(() => renderCharts().catch(e => console.error(e))));
        } catch (err) { console.error('renderDashboardCharts Error:', err); }
    },

    // Gradient fill modern (per theme accent)
    _gradFill(/** @type {any} */ ctx, /** @type {string} */ color, from = 0.45, to = 0.02) {
        const g = ctx.createLinearGradient(0, 0, 0, 300);
        g.addColorStop(0, this._rgba(color, from));
        g.addColorStop(1, this._rgba(color, to));
        return g;
    },
    _rgba(/** @type {string} */ hex, /** @type {number} */ a) {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    },
    // Konversi EquipmentID → Nama (fallback: ID)
    _equipLabel(id) {
        const name = this.getEquipName?.(id);
        return name && name !== id && name !== 'Unknown Asset' ? name : id;
    },

    // --- KPI CHARTS ---
    async renderKPICharts() {
        if (this.currentPage !== 'kpi') return;

        Object.values(window._appKpiCharts || {}).forEach(c => { 
            if(c) { try { c.destroy(); } catch(e) {} }
        });
        window._appKpiCharts = {}

        logger.debug('[KPI] Starting chart render, perfData length:', this.performanceData?.length);
        const perfData = /** @type {any[]} */ (this.safeDeepClone(this.performanceData));

        try {
            const waitForCanvas = (/** @type {string} */ id) => new Promise((resolve) => {
                let retries = 0;
                const check = () => {
                    const el = document.getElementById(id);
                    if (el && el.offsetParent !== null && el.clientHeight > 0) resolve(el);
                    else if (retries < 10) { retries++; setTimeout(check, 100 * retries); }
                    else { console.warn('[KPI] Canvas not found:', id); resolve(null); }
                };
                check();
            });

            const tc = this.chartColor('tick');
            const gc = this.themeGrid();

            const safeRender = async (/** @type {string} */ chartKey, /** @type {string} */ canvasId, /** @type {any} */ type, /** @type {any} */ data, /** @type {any} */ opts = {}) => {
                const ctx = await waitForCanvas(canvasId);
                if (this.currentPage !== 'kpi') return;
                if (!ctx) return;
                if (window._appKpiCharts[chartKey]) {
                    try { window._appKpiCharts[chartKey].destroy(); } catch(e) {}
                }
                window._appKpiCharts[chartKey] = await this.safeCreateChart(ctx, {
                    type, data,
                    options: { maintainAspectRatio: false, responsive: true, animation: { duration: 1000 }, ...opts }
                });
            };

            // MTBF Chart
            const mtbfData = /** @type {Record<string, { dates: string[], bd: number[] }>} */ ({});
            if (perfData && perfData.length > 0) {
                perfData.forEach(p => {
                    if (!(p.equipmentId || p.EquipmentID) || !p.date) return;
                    if (!mtbfData[(p.equipmentId || p.EquipmentID)]) mtbfData[(p.equipmentId || p.EquipmentID)] = { dates: [], bd: [] };
                    mtbfData[(p.equipmentId || p.EquipmentID)].dates.push(p.date);
                    mtbfData[(p.equipmentId || p.EquipmentID)].bd.push(Number(p.bd) || 0);
                });
            }
            const mtbfAverages = Object.keys(mtbfData).slice(0, 10).map(eid => {
                const d = mtbfData[eid];
                if (d.bd.length < 2) return { equip: eid, mtbf: 0 };
                const failures = d.bd.filter(v => v > 0).length;
                const totalHours = d.bd.length * 24;
                return { equip: eid, mtbf: failures > 0 ? Math.round(totalHours / failures) : totalHours };
            }).filter(e => e.mtbf > 0).sort((a, b) => a.mtbf - b.mtbf);
            
            const mtbfLabels = mtbfAverages.map(e => this._equipLabel(e.equip));
            const mtbfValues = mtbfAverages.map(e => e.mtbf);
            await safeRender('mtbfChart', 'mtbfChart', 'bar', {
                labels: mtbfLabels.length > 0 ? mtbfLabels : ['No Data'],
                datasets: [{ label: 'MTBF (hours)', data: mtbfValues.length > 0 ? mtbfValues : [0], backgroundColor: mtbfValues.length > 0 ? this.themeAccent() : this.chartColor('muted'), borderRadius: 10, borderSkipped: false, maxBarThickness: 34 }]
            }, { indexAxis: 'y', scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { display: false }, ticks: { color: tc } } }, plugins: { legend: { display: false } } });

            // MTTR Chart
            const mttrAverages = Object.keys(mtbfData).slice(0, 10).map(eid => {
                const d = mtbfData[eid];
                const failures = d.bd.filter(v => v > 0).length;
                const totalDown = d.bd.reduce((s, v) => s + v, 0);
                return { equip: eid, mttr: failures > 0 ? Math.round((totalDown / failures) * 10) / 10 : 0 };
            }).filter(e => e.mttr > 0).sort((a, b) => b.mttr - a.mttr);
            
            const mttrLabels = mttrAverages.map(e => this._equipLabel(e.equip));
            const mttrValues = mttrAverages.map(e => e.mttr);
            await safeRender('mttrChart', 'mttrChart', 'bar', {
                labels: mttrLabels.length > 0 ? mttrLabels : ['No Data'],
                datasets: [{ label: 'MTTR (hours)', data: mttrValues.length > 0 ? mttrValues : [0], backgroundColor: mttrValues.length > 0 ? this.chartColor('warn') : this.chartColor('muted'), borderRadius: 10, borderSkipped: false, maxBarThickness: 34 }]
            }, { indexAxis: 'y', scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { display: false }, ticks: { color: tc } } }, plugins: { legend: { display: false } } });

            // Availability Chart
            const availData = /** @type {Record<string, { total: number, down: number }>} */ ({});
            if (perfData && perfData.length > 0) {
                perfData.forEach(p => {
                    if (!p.date) return;
                    const month = p.date.substring(0, 7);
                    if (!availData[month]) availData[month] = { total: 0, down: 0 };
                    availData[month].total += Number(p.wh) || 24;
                    availData[month].down += (Number(p.bd) || 0) + (Number(p.stb) || 0);
                });
            }
            const availMonths = Object.keys(availData).sort().slice(-12);
            const availChart = availMonths.map(m => {
                const d = availData[m];
                return d.total > 0 ? Math.round(((d.total - d.down) / d.total) * 100) : 0;
            });
            await safeRender('availabilityChart', 'availabilityChart', 'line', {
                labels: availMonths.length > 0 ? availMonths.map(m => m.substring(5)) : ['-'],
                datasets: [{ label: 'Availability %', data: availChart.length > 0 ? availChart : [0], borderColor: this.chartColor('emerald'), backgroundColor: (/** @type {any} */ ctx) => this._gradFill(ctx.chart.ctx, this.chartColor('emerald')), fill: true, tension: 0.45, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 }]
            }, { scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, min: 0, max: 100 } }, plugins: { legend: { display: false } } });

            // Reliability Chart (R = e^(-t/MTBF))
            const allMtbf = Object.keys(mtbfData).map(eid => {
                const d = mtbfData[eid];
                if (d.bd.length < 2) return 0;
                const failures = d.bd.filter(v => v > 0).length;
                return failures > 0 ? (d.bd.length * 24) / failures : 0;
            }).filter(v => v > 0);
            const avgM = allMtbf.length > 0 ? allMtbf.reduce((s, v) => s + v, 0) / allMtbf.length : 720;
            const relTrend = availMonths.map((_, i) => {
                const t = (i + 1) * 720;
                const r = Math.exp(-t / avgM);
                return Math.round(r * 100);
            });
            await safeRender('reliabilityChartKPI', 'reliabilityChartKPI', 'line', {
                labels: availMonths.length > 0 ? availMonths.map(m => m.substring(5)) : ['-'],
                datasets: [{ label: 'Reliability %', data: relTrend.length > 0 ? relTrend : [0], borderColor: this.chartColor('violet'), backgroundColor: (/** @type {any} */ ctx) => this._gradFill(ctx.chart.ctx, this.chartColor('violet')), fill: true, tension: 0.45, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 }]
            }, { scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, min: 0, max: 100 } }, plugins: { legend: { display: false } } });

            // Top 5 Components by Downtime (Pareto)
            const compMap = /** @type {Record<string, number>} */ ({});
            if (perfData && perfData.length > 0) {
                perfData.forEach(p => {
                    if (!(p.equipmentId || p.EquipmentID)) return;
                    if (!compMap[(p.equipmentId || p.EquipmentID)]) compMap[(p.equipmentId || p.EquipmentID)] = 0;
                    compMap[(p.equipmentId || p.EquipmentID)] += (Number(p.bd) || 0) + (Number(p.stb) || 0);
                });
            }
            const compLabels = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 5);
            const compLabelNames = compLabels.map(c => this._equipLabel(c));
            await safeRender('kpiTop5Components', 'top5Components', 'bar', {
                labels: compLabelNames.length > 0 ? compLabelNames : ['No Components'],
                datasets: compLabels.length > 0 ? [{ label: 'Hours', data: compLabels.map(c => compMap[c]), backgroundColor: (/** @type {any} */ ctx) => this._gradFill(ctx.chart.ctx, this.themeAccent()), borderRadius: 10, borderSkipped: false, maxBarThickness: 30 }] : [{ label: 'Value', data: [0], backgroundColor: this.chartColor('muted') }]
            }, { indexAxis: 'y' });

            const schedCounts = /** @type {Record<string, number>} */ ({ Scheduled: 0, Unscheduled: 0 });
            if (perfData && perfData.length > 0) perfData.forEach(p => { if (p && p.type === 'Scheduled') schedCounts.Scheduled++; else schedCounts.Unscheduled++; });
            await safeRender('kpiSchedVsUnsched', 'schedVsUnsched', 'doughnut', {
                labels: Object.keys(schedCounts), datasets: [{ data: Object.values(schedCounts), backgroundColor: [this.chartColor('emerald'), this.chartColor('warn')] }]
            });

            const mechCounts = /** @type {Record<string, number>} */ ({ Mechanical: 0, Electrical: 0, Operational: 0 });
            const equip = /** @type {any[]} */ (this.safeDeepClone(this.equipment) || []);
            perfData?.forEach(p => {
                if (!(p.equipmentId || p.EquipmentID)) return;
                const e = equip.find(eq => eq.EquipmentID === (p.equipmentId || p.EquipmentID));
                if (e && e.Tipe) {
                    const t = e.Tipe;
                    if (t.toLowerCase().includes('mechanic') || t === 'Mechanical') mechCounts.Mechanical++;
                    else if (t.toLowerCase().includes('electric') || t === 'Electrical') mechCounts.Electrical++;
                    else mechCounts.Operational++;
                } else mechCounts.Operational++;
            });
            await safeRender('kpiFailureType', 'failureTypeChart', 'doughnut', {
                labels: Object.keys(mechCounts), datasets: [{ data: Object.values(mechCounts), backgroundColor: [this.themeAccent(), this.chartColor('magenta'), this.chartColor('deep')] }]
            });

            // Cost Data
            const logs = /** @type {any[]} */ (this.safeDeepClone(this.logs) || []);
            const costByMonth = /** @type {Record<string, number>} */ ({});
            logs.forEach(l => {
                if (!l.Tanggal || !l.cost) return;
                const m = l.Tanggal.substring(0, 7);
                if (!costByMonth[m]) costByMonth[m] = 0;
                costByMonth[m] += Number(l.cost);
            });
            const costMonths = Object.keys(costByMonth).sort().slice(-12);
            const costValues = costMonths.map(m => Math.round(costByMonth[m] / 1e6));
            await safeRender('kpiCostChart', 'costChart', 'line', {
                labels: costMonths.length > 0 ? costMonths.map(m => m.substring(5)) : ['-'],
                datasets: [{ label: 'Cost (Rp M)', data: costValues.length > 0 ? costValues : [0], borderColor: this.themeAccent(), backgroundColor: (/** @type {any} */ ctx) => this._gradFill(ctx.chart.ctx, this.themeAccent()), fill: true, tension: 0.45, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 }]
            }, { scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, beginAtZero: true } }, plugins: { legend: { display: false } } });

            // Reliability Pareto
            const paretoData = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 8);
            const paretoValues = paretoData.map(k => compMap[k]);
            const totalDown = paretoValues.reduce((s, v) => s + v, 0);
            let cumSum = 0;
            const paretoCum = paretoValues.map(v => { cumSum += v; return totalDown > 0 ? Math.round((cumSum / totalDown) * 100) : 0; });
            await safeRender('kpiParetoChart', 'paretoChart', 'bar', {
                labels: paretoData.length > 0 ? paretoData.map(k => this._equipLabel(k)) : ['No data'],
                datasets: [
                    { label: 'Downtime (hrs)', data: paretoValues.length > 0 ? paretoValues : [0], backgroundColor: (/** @type {any} */ ctx) => this._gradFill(ctx.chart.ctx, this.themeAccent()), borderRadius: 8, borderSkipped: false, yAxisID: 'y', maxBarThickness: 36 },
                    { label: 'Cumulative %', data: paretoCum.length > 0 ? paretoCum : [0], type: 'line', borderColor: this.themeAccent(), backgroundColor: 'transparent', tension: 0.45, pointRadius: 3, yAxisID: 'y1', borderWidth: 2 }
                ]
            }, { scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc }, beginAtZero: true }, y1: { position: 'right', grid: { display: false }, ticks: { color: tc }, min: 0, max: 100 } }, plugins: { legend: { position: 'top', labels: { color: tc, font: { size: 9 } } } } });

        } catch (err) {
            console.error('renderKPICharts Error:', err);
            this.showNotification('Failed to render KPI charts', 'error');
        }
    },

    // ─── ENTERPRISE DASHBOARD CHARTS ───
    async renderEnterpriseCharts() {
        if (this.currentPage !== 'enterprise') return;
        const tc = this.chartColor('tick');
        const gc = this.themeGrid();
        // Shared custom tooltip styling
        const tooltipStyle = {
            backgroundColor: this.chartColor('tooltip', 0.95),
            titleColor: this.chartColor('title'),
            bodyColor: this.chartColor('tick'),
            borderColor: this.themeAccent(),
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            titleFont: { weight: '700', size: 11 },
            bodyFont: { size: 11 },
        };
        const wait = (/** @type {string} */ id) => new Promise(res => { let r = 0; const c = () => { const e = document.getElementById(id); if (e && e.offsetParent !== null) res(e); else if (r < 5) { r++; setTimeout(c, 100 * r); } else res(null); }; c(); });
        let ctx;
        ctx = await wait('eHealthChart');
        if (ctx) { if (window._appCharts.eHealth) { try { window._appCharts.eHealth.destroy(); } catch(e) {} } const hd = this.calcHealthDist(); const has = hd.excellent || hd.good || hd.warning || hd.critical; window._appCharts.eHealth = await this.safeCreateChart(ctx, { type: 'doughnut', data: { labels: ['Excellent','Good','Warning','Critical'], datasets: [{ data: has ? [hd.excellent,hd.good,hd.warning,hd.critical] : [1], backgroundColor: has ? [this.chartColor('good'),this.chartColor('info'),this.chartColor('warn'),this.chartColor('crit')] : [this.chartColor('muted')] }] }, options: { cutout: '70%', animation: { duration: 1000 }, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 9 } } }, tooltip: tooltipStyle } } }); }
        ctx = await wait('woStatusChart');
        if (ctx) { if (window._appCharts.woStatus) { try { window._appCharts.woStatus.destroy(); } catch(e) {} } const ws = this.calcWOStatus(); const has = ws.completed || ws.inProgress || ws.waitingMaterial || ws.pending || ws.cancelled; window._appCharts.woStatus = await this.safeCreateChart(ctx, { type: 'doughnut', data: { labels: ['Completed','In Progress','Waiting Mat.','Pending','Cancelled'], datasets: [{ data: has ? [ws.completed,ws.inProgress,ws.waitingMaterial,ws.pending,ws.cancelled] : [1], backgroundColor: has ? [this.chartColor('good'),this.chartColor('info'),this.chartColor('warn'),this.chartColor('violet'),this.chartColor('muted')] : [this.chartColor('muted')] }] }, options: { cutout: '70%', animation: { duration: 1000 }, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 9 } } }, tooltip: tooltipStyle } } }); }
        ctx = await wait('pmTrendChart');
        if (ctx) { if (window._appCharts.pmTrend) { try { window._appCharts.pmTrend.destroy(); } catch(e) {} } const trend = /** @type {any[]} */ (this.calcPMTrend()); window._appCharts.pmTrend = await this.safeCreateChart(ctx, { type: 'bar', data: { labels: trend.length ? trend.map(t => t.month.substring(5)) : ['-'], datasets: [{ label: 'Compliance %', data: trend.length ? trend.map(t => t.pct) : [0], backgroundColor: this.chartColor('warn'), borderRadius: 4 }] }, options: { animation: { duration: 800 }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: tooltipStyle } } }); }
        ctx = await wait('downtimeTrendChart');
        if (ctx) { if (window._appCharts.downtimeTrend) { try { window._appCharts.downtimeTrend.destroy(); } catch(e) {} } const dt = /** @type {any[]} */ (this.calcDowntimeTrend()); window._appCharts.downtimeTrend = await this.safeCreateChart(ctx, { type: 'line', data: { labels: dt.length ? dt.map(d => d.month.substring(5)) : ['-'], datasets: [{ label: 'Downtime (hrs)', data: dt.length ? dt.map(d => d.hours) : [0], borderColor: this.chartColor('crit'), backgroundColor: this.chartColor('crit', 0.1), fill: true, tension: 0.3 }] }, options: { animation: { duration: 1000 }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true } }, plugins: { legend: { display: false }, tooltip: tooltipStyle } } }); }
        ctx = await wait('costTrendChart');
        if (ctx) { if (window._appCharts.costTrend) { try { window._appCharts.costTrend.destroy(); } catch(e) {} } const ct = /** @type {any[]} */ (this.calcCostTrend()); window._appCharts.costTrend = await this.safeCreateChart(ctx, { type: 'line', data: { labels: ct.length ? ct.map(c => c.month.substring(5)) : ['-'], datasets: [{ label: 'Cost', data: ct.length ? ct.map(c => c.cost) : [0], borderColor: this.themeAccent(), backgroundColor: this.chartColor('warn', 0.1), fill: true, tension: 0.3 }] }, options: { animation: { duration: 1000 }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true } }, plugins: { legend: { display: false }, tooltip: tooltipStyle } } }); }
        ctx = await wait('abcChart');
        if (ctx) { if (window._appCharts.abcChart) { try { window._appCharts.abcChart.destroy(); } catch(e) {} } const abc = /** @type {any[]} */ (this.calcInventoryABC()); const a = abc.filter(p => p.category === 'A').length; const b = abc.filter(p => p.category === 'B').length; const c = abc.filter(p => p.category === 'C').length; window._appCharts.abcChart = await this.safeCreateChart(ctx, { type: 'doughnut', data: { labels: ['A (High Value)','B (Medium)','C (Low)'], datasets: [{ data: [a||1,b||1,c||1], backgroundColor: [this.chartColor('crit'),this.chartColor('warn'),this.chartColor('cyan')] }] }, options: { cutout: '65%', animation: { duration: 800 }, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 9 } } }, tooltip: tooltipStyle } } }); }
    },
});
