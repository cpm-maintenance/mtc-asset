import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function patch(file, pairs) {
  const fp = path.join(ROOT, file);
  let src = fs.readFileSync(fp, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  src = src.replace(/\r\n/g, '\n');
  for (const [from, to] of pairs) {
    if (!src.includes(from)) { console.log(`✗ ${file}: pattern NOT found:\n${from.slice(0, 120)}`); continue; }
    src = src.replace(from, to);
    console.log(`✓ ${file}: patched`);
  }
  fs.writeFileSync(fp, src.split('\n').join(eol));
}

// ============ app.js: calcMTBFMTTR pakai Performance (equipmentId) ============
const appOld = `        calcMTBFMTTR(equipId) {
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
        },`;

const appCalcNew = `        calcMTBFMTTR(equipId) {
            if (!equipId) return null;
            const perf = this._raw?.(this.performanceData) || [];
            // ⚠️ Performance pakai field equipmentId (lowercase), bukan EquipmentID
            const eqPerf = perf.filter(p => p && (p.equipmentId || p.EquipmentID) === equipId);
            if (eqPerf.length) {
                const wh = eqPerf.reduce((s, p) => s + (Number(p.wh) || 0), 0);
                const bd = eqPerf.reduce((s, p) => s + (Number(p.bd) || 0), 0);
                const freq = eqPerf.reduce((s, p) => s + (Number(p.freq) || 0), 0);
                const events = eqPerf.reduce((s, p) => s + ((p.events && p.events.length) || 0), 0);
                const failures = freq || events;
                if (failures > 0) {
                    return {
                        mtbfDays: Number((wh / failures / 24).toFixed(1)),
                        mttrHours: Number((bd / failures).toFixed(1)),
                        totalEvents: eqPerf.length
                    };
                }
            }
            // Fallback: hitung dari HistoryLog
            const logs = this._raw?.(this.logs) || [];
            const eqLogs = logs.filter(l => l && l.EquipmentID === equipId);
            if (!eqLogs.length) return null;
            const BreakdownLogs = eqLogs.filter(l => l.Jenis === 'Breakdown');
            const Failures = BreakdownLogs.length;
            const days = BreakdownLogs.length >= 2 ? Math.max(0, (new Date(BreakdownLogs[BreakdownLogs.length-1].Tanggal) - new Date(BreakdownLogs[0].Tanggal)) / 86400000) : 0;
            const repairLogs = eqLogs.filter(l => l.Jenis === 'Repair');
            const avgRepairHrs = repairLogs.length ? repairLogs.reduce((s, l) => s + (Number(l.actualHours) || Number(l.Downtime) || 0), 0) / repairLogs.length : 0;
            return {
                mtbfDays: Failures >= 2 ? Number((days / (Failures - 1)).toFixed(1)) : 0,
                mttrHours: Number(avgRepairHrs.toFixed(1)),
                totalEvents: eqLogs.length
            };
        },`;

// ============ charts.js: renderMTBFMTTRChart pakai Performance ============
const chartOld = `            const allPerf = this._raw?.(this.performanceData) || [];
            const eqPerf = allPerf.filter(p => p && p.EquipmentID === equipId);

            const monthSet = new Set();`;

const chartFix = `            const allPerf = this._raw?.(this.performanceData) || [];
            // ⚠️ Performance pakai equipmentId (lowercase)
            const eqPerf = allPerf.filter(p => p && (p.equipmentId || p.EquipmentID) === equipId);

            const monthSet = new Set();`;

const chartLoopOld = `                const ms = eqLogs.filter(l => this._monthKey(l.Tanggal) === y);
                const failures = ms.filter(l => l.Jenis === 'Breakdown').length;
                const repairs = ms.filter(l => l.Jenis === 'Repair').length;
                const perfMonth = eqPerf.filter(p => this._monthKey(p.date || p.Tanggal) === y);
                const wh = perfMonth.reduce((s, p) => s + (Number(p.wh) || 0), 0);
                const bd = perfMonth.reduce((s, p) => s + (Number(p.bd) || 0), 0);
                labels.push(y);
                mtbfValues.push(failures > 0 && wh > 0 ? Number((wh / failures).toFixed(1)) : 0);
                mttrValues.push(repairs > 0 && bd > 0 ? Number((bd / repairs).toFixed(1)) : 0);`;

const chartLoopFixed = `                const ms = eqLogs.filter(l => this._monthKey(l.Tanggal) === y);
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
                mttrValues.push(repairs > 0 && bd > 0 ? Number((bd / failures).toFixed(1)) : 0);`;

patch('src/js/app.js', [[appOld, appCalcNew]]);
patch('src/js/charts.js', [[chartOld, chartFix], [chartLoopOld, chartLoopFixed]]);
