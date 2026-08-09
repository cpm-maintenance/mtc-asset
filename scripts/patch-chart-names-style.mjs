import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'src', 'js', 'renderKPICharts-orig.js');
const target = path.join(__dirname, '..', 'src', 'js', 'charts.js');

// Backup target
fs.copyFileSync(target, fp);
let s = fs.readFileSync(fp, 'utf8');

const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

// 1. Helper gradient — tambah sebelum renderKPICharts
const helperAnchor = '    // --- KPI CHARTS ---';
const helper = `    // Gradient fill modern (per theme accent)
    _gradFill(ctx, color, from = 0.45, to = 0.02) {
        const g = ctx.createLinearGradient(0, 0, 0, 300);
        g.addColorStop(0, this._rgba(color, from));
        g.addColorStop(1, this._rgba(color, to));
        return g;
    },
    _rgba(hex, a) {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return \`rgba(\${(n >> 16) & 255}, \${(n >> 8) & 255}, \${n & 255}, \${a})\`;
    },
    // Konversi EquipmentID → Nama (fallback: ID)
    _equipLabel(id) {
        const name = this.getEquipName?.(id);
        return name && name !== id && name !== 'Unknown Asset' ? name : id;
    },

    // --- KPI CHARTS ---`;

if (!s.includes('_equipLabel')) {
  s = s.replace(helperAnchor, helper);
}

// 2. Labels: ganti e.equip → nama di mtbf/mttr
s = s.replace(
  `const mtbfLabels = mtbfAverages.map(e => e.equip.length > 8 ? e.equip.substring(0, 8) + '..' : e.equip);`,
  `const mtbfLabels = mtbfAverages.map(e => this._equipLabel(e.equip));`
);
s = s.replace(
  `const mttrLabels = mttrAverages.map(e => e.equip.length > 8 ? e.equip.substring(0, 8) + '..' : e.equip);`,
  `const mttrLabels = mttrAverages.map(e => this._equipLabel(e.equip));`
);
// Top5 components labels
s = s.replace(
  `const compLabels = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 5);`,
  `const compLabels = Object.keys(compMap).sort((a, b) => compMap[b] - compMap[a]).slice(0, 5);
            const compLabelNames = compLabels.map(c => this._equipLabel(c));`
);
// compLabels → nama di dataset
s = s.replace(
  `labels: compLabels.length > 0 ? compLabels : ['No Components'],`,
  `labels: compLabelNames.length > 0 ? compLabelNames : ['No Components'],`
);
// PareTo labels
s = s.replace(
  `labels: paretoData.length > 0 ? paretoData : ['No data'],`,
  `labels: paretoData.length > 0 ? paretoData.map(k => this._equipLabel(k)) : ['No data'],`
);

// 3. Modern style: gradient fills, rounded, tooltip, font
// MTBF bars
s = s.replace(
  `backgroundColor: mtbfValues.length > 0 ? this.themeAccent() : '#64748b', borderRadius: 4 }`,
  `backgroundColor: mtbfValues.length > 0 ? this.themeAccent() : '#64748b', borderRadius: 10, borderSkipped: false, maxBarThickness: 34 }`
);
// MTTR bars
s = s.replace(
  `backgroundColor: mttrValues.length > 0 ? '#f59e0b' : '#64748b', borderRadius: 4 }`,
  `backgroundColor: mttrValues.length > 0 ? '#f59e0b' : '#64748b', borderRadius: 10, borderSkipped: false, maxBarThickness: 34 }`
);
// Availability + Reliability + Cost line: gradient fill
s = s.replace(
  `borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }`,
  `borderColor: '#10b981', backgroundColor: (ctx) => this._gradFill(ctx.chart.ctx, '#10b981'), fill: true, tension: 0.45, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 }`
);
s = s.replace(
  `borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.3 }`,
  `borderColor: '#8b5cf6', backgroundColor: (ctx) => this._gradFill(ctx.chart.ctx, '#8b5cf6'), fill: true, tension: 0.45, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 }`
);
s = s.replace(
  `borderColor: this.themeAccent(), backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: true, tension: 0.3 }`,
  `borderColor: this.themeAccent(), backgroundColor: (ctx) => this._gradFill(ctx.chart.ctx, this.themeAccent()), fill: true, tension: 0.45, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 }`
);
// Top5 bars gradient
s = s.replace(
  `labels: compLabelNames.length > 0 ? compLabelNames : ['No Components'],
                datasets: compLabels.length > 0 ? [{ label: 'Hours', data: compLabels.map(c => compMap[c]), backgroundColor: this.themeAccent() }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]`,
  `labels: compLabelNames.length > 0 ? compLabelNames : ['No Components'],
                datasets: compLabels.length > 0 ? [{ label: 'Hours', data: compLabels.map(c => compMap[c]), backgroundColor: (ctx) => this._gradFill(ctx.chart.ctx, this.themeAccent()), borderRadius: 10, borderSkipped: false, maxBarThickness: 30 }] : [{ label: 'Value', data: [0], backgroundColor: '#64748b' }]`
);
// Pareto bars gradient
s = s.replace(
  `{ label: 'Downtime (hrs)', data: paretoValues.length > 0 ? paretoValues : [0], backgroundColor: this.themeAccent(), borderRadius: 4, yAxisID: 'y' },`,
  `{ label: 'Downtime (hrs)', data: paretoValues.length > 0 ? paretoValues : [0], backgroundColor: (ctx) => ({ backgroundColor: this._gradFill(ctx.chart.ctx, this.themeAccent()) }), borderRadius: 8, borderSkipped: false, yAxisID: 'y', maxBarThickness: 36 },`
);
s = s.replace(
  `{ label: 'Cumulative %', data: paretoCum.length > 0 ? paretoCum : [0], type: 'line', borderColor: this.themeAccent(), backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, yAxisID: 'y1' }`,
  `{ label: 'Cumulative %', data: paretoCum.length > 0 ? paretoCum : [0], type: 'line', borderColor: this.themeAccent(), backgroundColor: 'transparent', tension: 0.45, pointRadius: 3, yAxisID: 'y1', borderWidth: 2 }`
);

fs.writeFileSync(target, s.split('\n').join(eol));
console.log('charts.js: label nama + modern style patched (backup: renderKPICharts-orig.js)');
