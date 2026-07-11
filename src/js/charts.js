/**
 * Charts Module - Dashboard & KPI chart rendering
 */
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export const chartModule = {
    // Safe deep clone helper
    safeDeepClone(data) {
        try { return JSON.parse(JSON.stringify(data)); }
        catch (e) { return Array.isArray(data) ? [...data] : data || {}; }
    },

    // Lazy load Chart.js
    async loadChartJS() {
        if (!window._chartJS) window._chartJS = Chart;
        return window._chartJS;
    },

    // Safe Chart creation with error boundary
    async safeCreateChart(ctx, config) {
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
                            data: { labels: ['Overdue', 'Pending', 'Completed', 'Cancelled'], datasets: [{ data: [overdue, pending, completed, cancelled], backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(6,182,212,0.7)', 'rgba(34,197,94,0.7)', 'rgba(100,116,139,0.5)'], borderColor: ['#ef4444', '#06b6d4', '#22c55e', '#64748b'], borderWidth: 1, borderRadius: 4 }] },
                            options: { indexAxis: 'y', animation: { duration: 800, easing: 'easeOutQuart' }, maintainAspectRatio: false, responsive: true, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true }, y: { grid: { display: false }, ticks: { color: tc, font: { size: 10, weight: 'bold' } } } }, plugins: { legend: { display: false } } }
                        });
                    }
                }

                // WO Completion Rate (donut)
                const ctxWo = await waitForCanvas('woCompletionChart');
                if (this.currentPage !== 'dash') return;
                if (ctxWo) {
                    const wos = (this.logs || []).filter(l => l && (l.woNumber || l.Status === 'Pending' || l.Status === 'Approved'));
                    const woCompleted = wos.filter(l => l.Status === 'Completed').length;
                    const woInProgress = wos.filter(l => l.Status === 'In Progress').length;
                    const woPending = wos.filter(l => l.Status !== 'Completed' && l.Status !== 'In Progress').length;
                    if (wos.length > 0) {
                        if (window._appCharts.woCompletion) { try { window._appCharts.woCompletion.destroy(); } catch(e) {} }
                        window._appCharts.woCompletion = await this.safeCreateChart(ctxWo, {
                            type: 'doughnut', data: { labels: ['Completed', 'In Progress', 'Pending'], datasets: [{ data: [woCompleted, woInProgress, woPending], backgroundColor: ['#22c55e', '#06b6d4', '#f59e0b'] }] },
                            options: { animation: { duration: 1000, easing: 'easeOutQuart' }, maintainAspectRatio: false, responsive: true, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 10 } } } } }
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

        Object.values(window._appKpiCharts || {}).forEach(c => { 
            if(c) { try { c.destroy(); } catch(e) {} }
        });
        window._appKpiCharts = {}

        console.log('[KPI] Starting chart render, perfData length:', this.performanceData?.length);
        const perfData = this.safeDeepClone(this.performanceData);

        try {
            const waitForCanvas = (id) => new Promise((resolve) => {
                let retries = 0;
                const check = () => {
                    const el = document.getElementById(id);
                    if (el && el.offsetParent !== null && el.clientHeight > 0) resolve(el);
                    else if (retries < 10) { retries++; setTimeout(check, 100 * retries); }
                    else { console.warn('[KPI] Canvas not found:', id); resolve(null); }
                };
                check();
            });

            const tc = this.darkMode ? '#8b9eb7' : '#64748b';
            const gc = this.darkMode ? 'rgba(0, 242, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

            const safeRender = async (chartKey, canvasId, type, data, opts = {}) => {
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
            const mtbfData = {};
            if (perfData && perfData.length > 0) {
                perfData.forEach(p => {
                    if (!p.EquipmentID || !p.date) return;
                    if (!mtbfData[p.EquipmentID]) mtbfData[p.EquipmentID] = { dates: [], bd: [] };
                    mtbfData[p.EquipmentID].dates.push(p.date);
                    mtbfData[p.EquipmentID].bd.push(Number(p.bd) || 0);
                });
            }
            const mtbfAverages = Object.keys(mtbfData).slice(0, 10).map(eid => {
                const d = mtbfData[eid];
                if (d.bd.length < 2) return { equip: eid, mtbf: 0 };
                const failures = d.bd.filter(v => v > 0).length;
                const totalHours = d.bd.length * 24;
                return { equip: eid, mtbf: failures > 0 ? Math.round(totalHours / failures) : totalHours };
            }).filter(e => e.mtbf > 0).sort((a, b) => a.mtbf - b.mtbf);
            
            const mtbfLabels = mtbfAverages.map(e => e.equip.length > 8 ? e.equip.substring(0, 8) + '..' : e.equip);
            const mtbfValues = mtbfAverages.map(e => e.mtbf);
            await safeRender('mtbfChart', 'mtbfChart', 'bar', {
                labels: mtbfLabels.length > 0 ? mtbfLabels : ['No Data'],
                datasets: [{ label: 'MTBF (hours)', data: mtbfValues.length > 0 ? mtbfValues : [0], backgroundColor: mtbfValues.length > 0 ? '#00f2ff' : '#64748b', borderRadius: 4 }]
            }, { indexAxis: 'y', scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { display: false }, ticks: { color: tc } } }, plugins: { legend: { display: false } } });

            // MTTR Chart
            const mttrAverages = Object.keys(mtbfData).slice(0, 10).map(eid => {
                const d = mtbfData[eid];
                const failures = d.bd.filter(v => v > 0).length;
                const totalDown = d.bd.reduce((s, v) => s + v, 0);
                return { equip: eid, mttr: failures > 0 ? Math.round((totalDown / failures) * 10) / 10 : 0 };
            }).filter(e => e.mttr > 0).sort((a, b) => b.mttr - a.mttr);
            
            const mttrLabels = mttrAverages.map(e => e.equip.length > 8 ? e.equip.substring(0, 8) + '..' : e.equip);
            const mttrValues = mttrAverages.map(e => e.mttr);
            await safeRender('mttrChart', 'mttrChart', 'bar', {
                labels: mttrLabels.length > 0 ? mttrLabels : ['No Data'],
                datasets: [{ label: 'MTTR (hours)', data: mttrValues.length > 0 ? mttrValues : [0], backgroundColor: mttrValues.length > 0 ? '#f59e0b' : '#64748b', borderRadius: 4 }]
            }, { indexAxis: 'y', scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { display: false }, ticks: { color: tc } } }, plugins: { legend: { display: false } } });

            // Availability Chart
            const availData = {};
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
                datasets: [{ label: 'Availability %', data: availChart.length > 0 ? availChart : [0], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }]
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
                datasets: [{ label: 'Reliability %', data: relTrend.length > 0 ? relTrend : [0], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.3 }]
            }, { scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, min: 0, max: 100 } }, plugins: { legend: { display: false } } });

            // Top 5 Components by Downtime (Pareto)
            const compMap = {};
            if (perfData && perfData.length > 0) {
                perfData.forEach(p => {
                    if (!p.EquipmentID) return;
                    if (!compMap[p.EquipmentID]) compMap[p.EquipmentID] = 0;
                    compMap[p.EquipmentID] += (Number(p.bd) || 0) + (Number(p.stb) || 0);
                });
            }
            const compLabels = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 5);
            await safeRender('kpiTop5Components', 'top5Components', 'bar', {
                labels: compLabels.length > 0 ? compLabels : ['No Components'],
                datasets: compLabels.length > 0 ? [{ label: 'Hours', data: compLabels.map(c => compMap[c]), backgroundColor: '#00f2ff' }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]
            }, { indexAxis: 'y' });

            const schedCounts = { Scheduled: 0, Unscheduled: 0 };
            if (perfData && perfData.length > 0) perfData.forEach(p => { if (p && p.type === 'Scheduled') schedCounts.Scheduled++; else schedCounts.Unscheduled++; });
            await safeRender('kpiSchedVsUnsched', 'schedVsUnsched', 'doughnut', {
                labels: Object.keys(schedCounts), datasets: [{ data: Object.values(schedCounts), backgroundColor: ['#10b981', '#f59e0b'] }]
            });

            const mechCounts = { Mechanical: 0, Electrical: 0, Operational: 0 };
            const equip = this.safeDeepClone(this.equipment) || [];
            perfData?.forEach(p => {
                if (!p.EquipmentID) return;
                const e = equip.find(eq => eq.EquipmentID === p.EquipmentID);
                if (e && e.Tipe) {
                    const t = e.Tipe;
                    if (t.toLowerCase().includes('mechanic') || t === 'Mechanical') mechCounts.Mechanical++;
                    else if (t.toLowerCase().includes('electric') || t === 'Electrical') mechCounts.Electrical++;
                    else mechCounts.Operational++;
                } else mechCounts.Operational++;
            });
            await safeRender('kpiFailureType', 'failureTypeChart', 'doughnut', {
                labels: Object.keys(mechCounts), datasets: [{ data: Object.values(mechCounts), backgroundColor: ['#00f2ff', '#bc13fe', '#334155'] }]
            });

            // Cost Data
            const logs = this.safeDeepClone(this.logs) || [];
            const costByMonth = {};
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
                datasets: [{ label: 'Cost (Rp M)', data: costValues.length > 0 ? costValues : [0], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: true, tension: 0.3 }]
            }, { scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc }, beginAtZero: true } }, plugins: { legend: { display: false } } });

            // Reliability Pareto
            const paretoData = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 8);
            const paretoValues = paretoData.map(k => compMap[k]);
            const totalDown = paretoValues.reduce((s, v) => s + v, 0);
            let cumSum = 0;
            const paretoCum = paretoValues.map(v => { cumSum += v; return totalDown > 0 ? Math.round((cumSum / totalDown) * 100) : 0; });
            await safeRender('kpiParetoChart', 'paretoChart', 'bar', {
                labels: paretoData.length > 0 ? paretoData : ['No data'],
                datasets: [
                    { label: 'Downtime (hrs)', data: paretoValues.length > 0 ? paretoValues : [0], backgroundColor: '#00f2ff', borderRadius: 4, yAxisID: 'y' },
                    { label: 'Cumulative %', data: paretoCum.length > 0 ? paretoCum : [0], type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, yAxisID: 'y1' }
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
        const tc = this.darkMode ? '#8b9eb7' : '#64748b';
        const gc = this.darkMode ? 'rgba(245, 158, 11, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        // Shared custom tooltip styling
        const tooltipStyle = {
            backgroundColor: this.darkMode ? 'rgba(13,17,23,0.95)' : 'rgba(255,255,255,0.95)',
            titleColor: this.darkMode ? '#f5f5f5' : '#0f172a',
            bodyColor: this.darkMode ? '#8b9eb7' : '#64748b',
            borderColor: '#f59e0b',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            titleFont: { weight: '700', size: 11 },
            bodyFont: { size: 11 },
        };
        const wait = (id) => new Promise(res => { let r = 0; const c = () => { const e = document.getElementById(id); if (e && e.offsetParent !== null) res(e); else if (r < 5) { r++; setTimeout(c, 100 * r); } else res(null); }; c(); });
        let ctx;
        ctx = await wait('eHealthChart');
        if (ctx) { if (window._appCharts.eHealth) { try { window._appCharts.eHealth.destroy(); } catch(e) {} } const hd = this.calcHealthDist(); const has = hd.excellent || hd.good || hd.warning || hd.critical; window._appCharts.eHealth = await this.safeCreateChart(ctx, { type: 'doughnut', data: { labels: ['Excellent','Good','Warning','Critical'], datasets: [{ data: has ? [hd.excellent,hd.good,hd.warning,hd.critical] : [1], backgroundColor: has ? ['#22c55e','#3b82f6','#f59e0b','#ef4444'] : ['#64748b'] }] }, options: { cutout: '70%', animation: { duration: 1000 }, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 9 } } }, tooltip: tooltipStyle } } }); }
        ctx = await wait('woStatusChart');
        if (ctx) { if (window._appCharts.woStatus) { try { window._appCharts.woStatus.destroy(); } catch(e) {} } const ws = this.calcWOStatus(); const has = ws.completed || ws.inProgress || ws.waitingMaterial || ws.pending || ws.cancelled; window._appCharts.woStatus = await this.safeCreateChart(ctx, { type: 'doughnut', data: { labels: ['Completed','In Progress','Waiting Mat.','Pending','Cancelled'], datasets: [{ data: has ? [ws.completed,ws.inProgress,ws.waitingMaterial,ws.pending,ws.cancelled] : [1], backgroundColor: has ? ['#22c55e','#3b82f6','#f59e0b','#8b5cf6','#64748b'] : ['#64748b'] }] }, options: { cutout: '70%', animation: { duration: 1000 }, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 9 } } }, tooltip: tooltipStyle } } }); }
        ctx = await wait('pmTrendChart');
        if (ctx) { if (window._appCharts.pmTrend) { try { window._appCharts.pmTrend.destroy(); } catch(e) {} } const trend = this.calcPMTrend(); window._appCharts.pmTrend = await this.safeCreateChart(ctx, { type: 'bar', data: { labels: trend.length ? trend.map(t => t.month.substring(5)) : ['-'], datasets: [{ label: 'Compliance %', data: trend.length ? trend.map(t => t.pct) : [0], backgroundColor: '#f59e0b', borderRadius: 4 }] }, options: { animation: { duration: 800 }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, min: 0, max: 100 } }, plugins: { legend: { display: false }, tooltip: tooltipStyle } } }); }
        ctx = await wait('downtimeTrendChart');
        if (ctx) { if (window._appCharts.downtimeTrend) { try { window._appCharts.downtimeTrend.destroy(); } catch(e) {} } const dt = this.calcDowntimeTrend(); window._appCharts.downtimeTrend = await this.safeCreateChart(ctx, { type: 'line', data: { labels: dt.length ? dt.map(d => d.month.substring(5)) : ['-'], datasets: [{ label: 'Downtime (hrs)', data: dt.length ? dt.map(d => d.hours) : [0], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }] }, options: { animation: { duration: 1000 }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true } }, plugins: { legend: { display: false }, tooltip: tooltipStyle } } }); }
        ctx = await wait('costTrendChart');
        if (ctx) { if (window._appCharts.costTrend) { try { window._appCharts.costTrend.destroy(); } catch(e) {} } const ct = this.calcCostTrend(); window._appCharts.costTrend = await this.safeCreateChart(ctx, { type: 'line', data: { labels: ct.length ? ct.map(c => c.month.substring(5)) : ['-'], datasets: [{ label: 'Cost', data: ct.length ? ct.map(c => c.cost) : [0], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3 }] }, options: { animation: { duration: 1000 }, maintainAspectRatio: false, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 9 } }, beginAtZero: true } }, plugins: { legend: { display: false }, tooltip: tooltipStyle } } }); }
        ctx = await wait('abcChart');
        if (ctx) { if (window._appCharts.abcChart) { try { window._appCharts.abcChart.destroy(); } catch(e) {} } const abc = this.calcInventoryABC(); const a = abc.filter(p => p.category === 'A').length; const b = abc.filter(p => p.category === 'B').length; const c = abc.filter(p => p.category === 'C').length; window._appCharts.abcChart = await this.safeCreateChart(ctx, { type: 'doughnut', data: { labels: ['A (High Value)','B (Medium)','C (Low)'], datasets: [{ data: [a||1,b||1,c||1], backgroundColor: ['#ef4444','#f59e0b','#06b6d4'] }] }, options: { cutout: '65%', animation: { duration: 800 }, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 9 } } }, tooltip: tooltipStyle } } }); }
    },
};
