import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const fp = path.join(ROOT, 'src', 'js', 'modules', 'kpi-engine.js');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

let ok = 0;

// 1. Tambah _breakdownEvents: gabung breakdown dari logs + Performance (freq>0/events)
const addHelper = `    // Gabungkan breakdown dari HistoryLog + Performance (events/freq>0)
    // Setiap event: { Tanggal, HM } — HM dari log.HM atau performance.hm
    _breakdownEvents(equipId) {
        const logs = this._raw(this.logs) || [];
        const perf = this._raw(this.performanceData) || [];
        const out = [];

        for (const l of logs) {
            if (l && l.EquipmentID === equipId && l.Jenis === 'Breakdown') {
                out.push({ Tanggal: l.Tanggal, HM: Number(l.HM) || 0, src: 'log' });
            }
        }
        for (const p of perf) {
            if (!p || (p.equipmentId || p.EquipmentID) !== equipId) continue;
            const freq = (p.events && p.events.length > 0) ? p.events.length : (Number(p.freq) || 0);
            if (freq > 0) {
                // 1 record Performance = 1+ breakdown; gunakan hm cumulative akhir periode
                for (let i = 0; i < freq; i++) {
                    out.push({ Tanggal: p.date, HM: Number(p.hm) || 0, src: 'perf' });
                }
            }
        }

        return out.sort((a, b) => {
            if (!a.Tanggal || !b.Tanggal) return 0;
            return new Date(a.Tanggal) - new Date(b.Tanggal);
        });
    },

    calculateMTBF(equipId) {`;

if (s.includes('    calculateMTBF(equipId) {')) {
  s = s.replace('    calculateMTBF(equipId) {', addHelper);
  ok++;
  console.log('✓ _breakdownEvents added');
} else {
  console.log('✗ calculateMTBF anchor NOT found');
}

// 2. Ganti isi calculateMTBF: pakai _breakdownEvents
const oldCalc = `        const breakdowns = logs
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
        return result;`;

const newCalc = `        const breakdowns = this._breakdownEvents(equipId);
        
        if (breakdowns.length < 2) return 0;

        let totalInterval = 0;
        let withHM = 0;
        for (let i = 1; i < breakdowns.length; i++) {
            const iv = this._hmIntervalHours(breakdowns[i-1], breakdowns[i]);
            totalInterval += iv;
            if (breakdowns[i-1].HM > 0 && breakdowns[i].HM > 0) withHM++;
        }
        // Fallback kalender bila tak ada pasangan HM (data lama)
        const result = (totalInterval / (breakdowns.length - 1)).toFixed(1);
        this._kpiCache.m.set(equipId, result);
        return result;`;

if (s.includes(oldCalc)) {
  s = s.replace(oldCalc, newCalc);
  ok++;
  console.log('✓ calculateMTBF uses _breakdownEvents + HM delta');
} else {
  console.log('✗ calculateMTBF body NOT found — cek manual');
}

// 3. _hmIntervalHours — terima performance hm juga (sudah via HM field, ok)
//    tapi pastikan Number() handle string

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log(`kpi-engine.js saved (${ok}/2)`);
