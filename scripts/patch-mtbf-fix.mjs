import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Fix 1: charts.js — tambah renderMTBFMTTRChart + _monthKey ---
const chartsPath = path.join(__dirname, '..', 'src', 'js', 'charts.js');
let charts = fs.readFileSync(chartsPath, 'utf8');

const marker = '// --- DASHBOARD CHARTS ---';
if (!charts.includes('renderMTBFMTTRChart')) {
  const insert = `_monthKey(d) { return d && !isNaN(new Date(d)) ? new Date(d).toISOString().slice(0, 7) : ''; },

    // --- MTBF/MTTR TREND CHART (MTBFMTTR page) ---
    async renderMTBFMTTRChart() {
        const equipId = this.mtbfFilterEquip;
        if (!equipId) return;
        const canvas = document.getElementById('mtbfChart');
        if (!canvas) return;
        try {
            const allLogs = this._raw?.(this.logs) || [];
            const eqLogs = allLogs.filter(l => l && l.EquipmentID === equipId);
            if (!eqLogs.length) return;
            const allPerf = this._raw?.(this.performanceData) || [];
            const eqPerf = allPerf.filter(p => p && p.EquipmentID === equipId);

            const monthSet = new Set();
            eqLogs.forEach(l => { const y = this._monthKey(l.Tanggal); if (y) monthSet.add(y); });
            eqPerf.forEach(p => { const y = this._monthKey(p.date || p.Tanggal); if (y) monthSet.add(y); });

            const labels = [], mtbfValues = [], mttrValues = [];
            [...monthSet].sort().forEach(y => {
                const ms = eqLogs.filter(l => this._monthKey(l.Tanggal) === y);
                const failures = ms.filter(l => l.Jenis === 'Breakdown').length;
                const repairs = ms.filter(l => l.Jenis === 'Repair').length;
                const perfMonth = eqPerf.filter(p => this._monthKey(p.date || p.Tanggal) === y);
                const wh = perfMonth.reduce((s, p) => s + (Number(p.wh) || 0), 0);
                const bd = perfMonth.reduce((s, p) => s + (Number(p.bd) || 0), 0);
                labels.push(y);
                mtbfValues.push(failures > 0 && wh > 0 ? Number((wh / failures).toFixed(1)) : 0);
                mttrValues.push(repairs > 0 && bd > 0 ? Number((bd / repairs).toFixed(1)) : 0);
            });

            const tc = this.darkMode ? '#8b9eb7' : '#64748b';
            const config = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'MTBF (hrs)', data: mtbfValues, borderColor: this.themeAccent(), tension: 0.35, yAxisID: 'y' },
                        { label: 'MTTR (hrs)', data: mttrValues, borderColor: '#f59e0b', tension: 0.35, yAxisID: 'y' }
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

    `;
  charts = charts.replace(marker, insert + marker);
  fs.writeFileSync(chartsPath, charts);
  console.log('charts.js: renderMTBFMTTRChart added');
} else {
  console.log('charts.js: already has renderMTBFMTTRChart');
}

// --- Fix 2: app.js — calcMTBFMTTR getter, mtbfRefresh cleanup, cleanUrl validation ---
const appFile = path.join(__dirname, '..', 'src', 'js', 'app.js');
let app = fs.readFileSync(appFile, 'utf8');

// Normalize CRLF → LF untuk pattern matching (files pakai CRLF, literal script LF)
const eol = app.includes('\r\n') ? '\r\n' : '\n';
app = app.replace(/\r\n/g, '\n');

// 2a. Add calcMTBFMTTR method + wire mtbfResult
const oldGetter = `        // --- MTBF/MTTR GETTERS ---
        get mtbfResult() {
            if (!this.mtbfFilterEquip) return null;
            return this.calcMTBFMTTR?.(this.mtbfFilterEquip) || null;
        },
        mtbfRefresh() {
            this.mtbfFilterEquip = '';
            if (window._appCharts?.mtbfChart) { try { window._appCharts.mtbfChart.destroy(); } catch(e) {} }
            this.$nextTick(() => this.renderMTBFMTTRChart?.());
        },`;

const newGetter = `        // --- MTBF/MTTR GETTERS ---
        get mtbfResult() {
            if (!this.mtbfFilterEquip) return null;
            return this.calcMTBFMTTR(this.mtbfFilterEquip) || null;
        },
        calcMTBFMTTR(equipId) {
            if (!equipId) return null;
            const logs = this._raw?.(this.logs) || [];
            const eqLogs = logs.filter(l => l && l.EquipmentID === equipId);
            if (!eqLogs.length) return null;
            const perf = this._raw?.(this.performanceData) || [];
            const eqPerf = perf.filter(p => p && p.EquipmentID === equipId);
            const wh = eqPerf.reduce((s, p) => s + (Number(p.wh) || 0), 0);
            const bd = eqPerf.reduce((s, p) => s + (Number(p.bd) || 0), 0);
            const failures = eqLogs.filter(l => l.Jenis === 'Breakdown').length;
            const repairs = eqLogs.filter(l => l.Jenis === 'Repair').length;
            return {
                mtbfDays: failures > 0 ? Number(((wh / failures) / 24).toFixed(1)) : 0,
                mttrHours: repairs > 0 ? Number((bd / repairs).toFixed(1)) : 0,
                totalEvents: eqLogs.length
            };
        },
        mtbfRefresh() {
            this.mtbfFilterEquip = '';
            if (window._appCharts?.mtbfChart) { try { window._appCharts.mtbfChart.destroy(); } catch(e) {} }
            this.$nextTick(() => this.renderMTBFMTTRChart());
        },`;

if (app.includes(oldGetter)) {
  app = app.replace(oldGetter, newGetter);
  console.log('app.js: calcMTBFMTTR added');
} else {
  console.log('app.js: getter block pattern NOT found (check manually)');
}

// 2b. cleanUrl validation — reject invalid/non-URL strings
const oldClean = `                return decodeURIComponent(decoded);
            } catch (e) {
                return url;
            }
        },`;

const newClean = `                decoded = decodeURIComponent(decoded);
                if (!/^(https?:\\/\\/|data:image\\/|blob:)/.test(decoded) || /[\\[\\]{}<>]/.test(decoded)) return '';
                return decoded;
            } catch (e) {
                return '';
            }
        },`;

if (app.includes(oldClean)) {
  app = app.replace(oldClean, newClean);
  console.log('app.js: cleanUrl validation added');
} else {
  console.log('app.js: cleanUrl pattern NOT found (check manually)');
}

fs.writeFileSync(appFile, app.split('\n').join(eol));
console.log('app.js saved (eol: ' + (eol === '\r\n' ? 'CRLF preserved' : 'LF') + ')');
