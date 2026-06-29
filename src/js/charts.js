/**
 * Charts Module — Dashboard & KPI chart rendering
 * Extracted from app.js to reduce file size
 */
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export const chartModule = {
    // Safe deep clone for Alpine proxy
    safeDeepClone(data) {
        if (!data) return [];
        try {
            const raw = window.Alpine.raw(data);
// ponytail: structuredClone native, faster than JSON.parse
            if (Array.isArray(raw)) return structuredClone(raw);
            return [];
        } catch (e) {
            console.warn('Deep clone failed:', e);
            return [];
        }
    },

    // Lazy load Chart.js
    async loadChartJS() {
        if (!window._chartJS) window._chartJS = Chart;
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

    // --- DASHBOARD CHARTS ---
    async renderDashboardCharts() {
        if (this.currentPage !== 'dash' || !this.isLoggedIn) return;

        // Destroy any remaining chart instances to prevent "Canvas already in use"
        Object.values(window._appCharts || {}).forEach(c => { 
            if(c) { try { c.destroy(); } catch(e) {} }
        });
        window._appCharts = { status: null, cost: null, downtime: null, reliability: null };

        try {
            const equipment = this.safeDeepClone(this.equipment);
            const performanceData = this.safeDeepClone(this.performanceData);
            const logs = this.safeDeepClone(this.logs);

            let totalEquip = equipment?.length || 0;
            let totalDowntime = 0;
            let overduePM = 0;
            let lowStock = 0;

            if (this.pmList && Array.isArray(this.pmList)) {
                const today = new Date().toISOString().split('T')[0];
                overduePM = this.pmList.filter(p => p.status === 'pending' && p.date < today).length;
            }
            if (performanceData && Array.isArray(performanceData)) {
                performanceData.forEach(p => { totalDowntime += Number(p.bd) || 0; });
            }
            if (this.allParts && Array.isArray(this.allParts)) {
                lowStock = this.allParts.filter(p => Number(p.Stok) <= Number(p.MinStock)).length;
            }

            this.dashboardStats = { totalEquip, overduePM, lowStock, totalDowntime: totalDowntime.toFixed(1) };

            if (!equipment || equipment.length === 0) return;

            const waitForCanvas = (id) => new Promise((resolve) => {
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
                const tc = this.darkMode ? '#8b9eb7' : '#64748b';
                const gc = this.darkMode ? 'rgba(0, 242, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

                const ctxStatus = await waitForCanvas('statusChart');
                if (this.currentPage !== 'dash') return;
                if (ctxStatus && equipment.length > 0) {
                    const counts = { 'Active': 0, 'In Maintenance': 0, 'Idle': 0, 'Decommissioned': 0 };
                    equipment.forEach(e => {
                        if (counts[e.Status] !== undefined) counts[e.Status]++;
                        else counts['Idle']++;
                    });
                    const activeLabels = Object.keys(counts).filter(k => counts[k] > 0);
                    const activeData = activeLabels.map(k => counts[k]);
                    window._appCharts = window._appCharts || {};
                    if (window._appCharts.status) {
                        try { window._appCharts.status.destroy(); } catch (e) { console.warn('Chart destroy failed', e); }
                    }
                    window._appCharts.status = await this.safeCreateChart(ctxStatus, {
                        type: 'doughnut',
                        data: { labels: activeLabels, datasets: [{ data: activeData, backgroundColor: ['#00f2ff', '#bc13fe', '#334155', '#64748b'] }] },
                        options: { animation: { duration: 1000, easing: 'easeOutQuart' }, maintainAspectRatio: false, responsive: true, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 10 } } } } }
                    });
                }

                const ctxRel = await waitForCanvas('reliabilityChart');
                if (this.currentPage !== 'dash') return;
                if (ctxRel && performanceData.length > 0) {
                    const dailyPA = {};
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
                        data: { labels: sorted, datasets: [{ label: 'PA %', data: avg, borderColor: '#00f2ff', tension: 0.3, fill: true, backgroundColor: 'rgba(0, 242, 255, 0.1)' }] },
                        options: { animation: { duration: 1200, easing: 'easeOutQuart' }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, min: 0, max: 100 } }, plugins: { legend: { display: false } } }
                    });
                }

                const ctxPM = await waitForCanvas('pmStatusChart');
                if (this.currentPage !== 'dash') return;
                if (ctxPM) {
                    const pmList = this.safeDeepClone(this.pmList) || [];
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
                            data: {
                                labels: ['Overdue', 'Pending', 'Completed', 'Cancelled'],
                                datasets: [{
                                    data: [overdue, pending, completed, cancelled],
                                    backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(6,182,212,0.7)', 'rgba(34,197,94,0.7)', 'rgba(100,116,139,0.5)'],
                                    borderColor: ['#ef4444', '#06b6d4', '#22c55e', '#64748b'],
                                    borderWidth: 1, borderRadius: 4,
                                }]
                            },
                            options: {
                                indexAxis: 'y', animation: { duration: 800, easing: 'easeOutQuart' },
                                maintainAspectRatio: false, responsive: true,
                                scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true }, y: { grid: { display: false }, ticks: { color: tc, font: { size: 10, weight: 'bold' } } } },
                                plugins: { legend: { display: false } }
                            }
                        });
                    }
                }
            };
            this.$nextTick(() => requestAnimationFrame(() => renderCharts().catch(e => console.error(e))));
        } catch (err) { console.error('renderDashboardCharts Error:', err); }
    },

    // --- KPI CHARTS ---
    async renderKPICharts() {
        if (this.currentPage !== 'kpi') return;

        // Destroy existing KPI chart instances
        Object.values(window._appKpiCharts || {}).forEach(c => { 
            if(c) { try { c.destroy(); } catch(e) {} }
        });
        window._appKpiCharts = {}

        console.log('[KPI] Starting chart render, perfData length:', this.performanceData?.length);
        const perfData = this.safeDeepClone(this.performanceData);

        try {
            const waitForCanvas = (id) => new Promise((resolve) => {
                let retries = 0;
                const maxRetries = 20;
                const check = () => {
                    const el = document.getElementById(id);
                    if (el && el.offsetParent !== null && el.clientHeight > 0) resolve(el);
                    else if (retries < maxRetries) { retries++; setTimeout(check, 100 * retries); }
                    else { console.log('[KPI] Canvas not found:', id); resolve(null); }
                };
                check();
            });

            const renderKPI = async () => {
                if (this.currentPage !== 'kpi') return;
                const tc = this.darkMode ? '#8b9eb7' : '#64748b';
                const gc = this.darkMode ? 'rgba(0, 242, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

                let filteredData = [];
                const filterDate = this.kpiFilterDate;
                const filterType = this.kpiFilter || 'yearly';
                if (filterType === 'yearly' || !filterDate) filteredData = perfData || [];
                else if (perfData && Array.isArray(perfData) && perfData.length > 0) {
                    filteredData = perfData.filter(p => {
                        if (!p || !p.date) return false;
                        const pDateStr = p.date.toString();
                        if (filterType === 'monthly') return pDateStr.startsWith(filterDate.substring(0, 7));
                        if (filterType === 'weekly') {
                            const pDate = new Date(p.date);
                            const fDate = new Date(filterDate);
                            if (isNaN(pDate.getTime()) || isNaN(fDate.getTime())) return false;
                            return Math.floor((fDate - pDate) / (1000 * 60 * 60 * 24)) >= -7;
                        }
                        return true;
                    });
                } else filteredData = perfData || [];

                const data = filteredData;

                // ponytail: chartOpts closure extracted inline per chart — keep DRY via opts factory
                const chartOpts = (type) => ({
                    animation: { duration: 1000, easing: 'easeOutQuart' },
                    maintainAspectRatio: false, responsive: true,
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
                        try { window._appKpiCharts[chartKey].destroy(); } catch (e) { console.warn('Chart destroy failed', e); }
                    }
                    if (!el) { console.log('[KPI] Canvas element not found for:', id); return; }
                    if (!chartData || !chartData.labels || chartData.labels.length === 0) {
                        chartData = { labels: ['No Data'], datasets: [{ label: 'Value', data: [0], backgroundColor: '#64748b' }] };
                    }
                    window._appKpiCharts[chartKey] = await this.safeCreateChart(el, { type, data: chartData, options: { ...chartOpts(type), ...extraOpts } });
                    console.log('[KPI] Chart rendered:', chartKey);
                };

                // PA Plan vs Actual
                const equipMap = {};
                if (data && data.length > 0) {
                    data.forEach(p => {
                        if (!p || !p.equipmentId) return;
                        const name = this._raw ? (this._raw(this.equipment) || []).find(e => e?.EquipmentID === p.equipmentId)?.Nama || p.equipmentId : p.equipmentId;
                        if (!equipMap[name]) equipMap[name] = { plans: [], actuals: [] };
                        const kpi = this.calculateKPI ? this.calculateKPI(p) : {};
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
                if (data && data.length > 0) {
                    data.forEach(p => {
                        if (!p || !p.area) return;
                        if (!areaMap[p.area]) areaMap[p.area] = { pa: [], count: 0 };
                        const kpi = this.calculateKPI ? this.calculateKPI(p) : {};
                        areaMap[p.area].pa.push(Number(kpi?.pa || 0));
                        areaMap[p.area].count++;
                    });
                }
                const areaLabels = Object.keys(areaMap);
                await safeRender('kpiAreaPa', 'areaPa', 'bar', {
                    labels: areaLabels.length > 0 ? areaLabels : ['No Data'],
                    datasets: areaLabels.length > 0 ? [{ label: 'Avg PA %', data: areaLabels.map(k => (areaMap[k].pa.reduce((a, b) => a + b, 0) / areaMap[k].pa.length).toFixed(1)), backgroundColor: '#f59e0b' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                });

                // Top 5 Events
                const eventList = [];
                if (data && data.length > 0) data.forEach(p => (p.events || []).forEach(ev => { if (ev && ev.problem) eventList.push({ label: ev.problem, duration: Number(ev.duration) || 0 }); }));
                eventList.sort((a, b) => b.duration - a.duration);
                const top5Ev = eventList.slice(0, 5);
                await safeRender('kpiTop5Events', 'top5Events', 'bar', {
                    labels: top5Ev.length > 0 ? top5Ev.map(e => e.label.substring(0, 20)) : ['No Events'],
                    datasets: top5Ev.length > 0 ? [{ label: 'Hours', data: top5Ev.map(e => e.duration), backgroundColor: '#ef4444' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                }, { indexAxis: 'y' });

                // Top 5 Components
                const compMap = {};
                if (data && data.length > 0) data.forEach(p => (p.events || []).forEach(ev => { if (ev && ev.component) { if (!compMap[ev.component]) compMap[ev.component] = 0; compMap[ev.component] += Number(ev.duration) || 0; } }));
                const compLabels = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 5);
                await safeRender('kpiTop5Components', 'top5Components', 'bar', {
                    labels: compLabels.length > 0 ? compLabels : ['No Components'],
                    datasets: compLabels.length > 0 ? [{ label: 'Hours', data: compLabels.map(c => compMap[c]), backgroundColor: '#00f2ff' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                }, { indexAxis: 'y' });

                // Scheduled vs Unscheduled
                const schedCounts = { Scheduled: 0, Unscheduled: 0 };
                if (data && data.length > 0) data.forEach(p => { if (p && p.type === 'Scheduled') schedCounts.Scheduled++; else schedCounts.Unscheduled++; });
                await safeRender('kpiSchedVsUnsched', 'schedVsUnsched', 'doughnut', {
                    labels: Object.keys(schedCounts),
                    datasets: [{ data: Object.values(schedCounts), backgroundColor: ['#10b981', '#f59e0b'] }]
                });

                // Mechanical vs Electrical
                const mechCounts = { Mechanical: 0, Electrical: 0, Operational: 0 };
                if (data && data.length > 0) data.forEach(p => (p.events || []).forEach(ev => { if (ev && ev.category && mechCounts[ev.category] !== undefined) mechCounts[ev.category]++; }));
                await safeRender('kpiMechVsElec', 'mechVsElec', 'doughnut', {
                    labels: Object.keys(mechCounts).filter(k => mechCounts[k] > 0),
                    datasets: [{ data: Object.values(mechCounts).filter(v => v > 0), backgroundColor: ['#00f2ff', '#bc13fe', '#f59e0b'] }]
                });

                // Pareto RCA
                const rcaMap = {};
                if (data && data.length > 0) data.forEach(p => (p.events || []).forEach(ev => { if (ev && ev.rca) { if (!rcaMap[ev.rca]) rcaMap[ev.rca] = 0; rcaMap[ev.rca] += Number(ev.duration) || 0; } }));
                const rcaLabels = Object.keys(rcaMap).sort((a, b) => rcaMap[b] - rcaMap[a]).slice(0, 10);
                await safeRender('kpiParetoRCA', 'paretoRCA', 'bar', {
                    labels: rcaLabels.length > 0 ? rcaLabels : ['No RCA Data'],
                    datasets: rcaLabels.length > 0 ? [{ label: 'Hours', data: rcaLabels.map(c => rcaMap[c]), backgroundColor: '#00f2ff' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
                }, { indexAxis: 'y' });

                console.log('[KPI] All charts rendered');
            };
            this.$nextTick(() => requestAnimationFrame(() => renderKPI().catch(e => console.error('KPI render error:', e))));
        } catch (err) {
            console.error('renderKPICharts Error:', err);
            this.showNotification('Failed to render KPI charts', 'error');
        }
    },
};
