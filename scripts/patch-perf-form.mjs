import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'src', 'js', 'modules', 'performance.js');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

// 1. updatePerfHours — stb manual dihormati, event Op jadi sumber stb otomatis, wh auto
const oldFn = `    updatePerfHours(field) {
        // Guard against undefined form
        if (!this.performanceForm || !this.performanceForm.events) return;
        
        let mechanicalBD = 0;
        let operationalSTB = 0;
        
        this.performanceForm.events.forEach(ev => {
            if (!ev) return;
            const dur = Number(ev.duration) || 0;
            if (ev.category === 'Operational') {
                operationalSTB += dur;
            } else {
                mechanicalBD += dur;
            }
        });
        
        this.performanceForm.bd = mechanicalBD.toFixed(2);
        this.performanceForm.freq = (this.performanceForm.events || []).filter(e => e && e.category !== 'Operational').length;

        let wh = Number(this.performanceForm.wh) || 0;
        let bd = mechanicalBD;
        let stb = operationalSTB;

        if (field === 'wh') {
            let newStb = 24 - wh - bd;
            if (newStb < 0) { 
                newStb = 0; wh = 24 - bd; 
                this.performanceForm.wh = Math.max(0, wh).toFixed(2); 
            }
            this.performanceForm.stb = Math.max(0, newStb).toFixed(2);
        } else if (field === 'stb') {
            let newWh = 24 - stb - bd;
            if (newWh < 0) { 
                newWh = 0; stb = 24 - bd; 
                this.performanceForm.stb = Math.max(0, stb).toFixed(2); 
            }
            this.performanceForm.wh = Math.max(0, newWh).toFixed(2);
        } else if (field === 'bd') {
            let newWh = 24 - bd - stb;
            if (newWh < 0) {
                newWh = 0;
                let newStb = 24 - bd;
                this.performanceForm.stb = Math.max(0, newStb).toFixed(2);
            }
            this.performanceForm.wh = Math.max(0, newWh).toFixed(2);
        }
    },`;

const newFn = `    updatePerfHours(field) {
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
            stb = opSTB > 0 ? opSTB : (Number(this.performanceForm.stb) || 0);
        }

        // wh selalu auto: 1 hari (24h) - breakdown - standby
        let wh = 24 - mechanicalBD - stb;
        if (wh < 0) {
            wh = 0;
            stb = Math.max(0, 24 - mechanicalBD);
        }

        this.performanceForm.wh = wh.toFixed(2);
        this.performanceForm.stb = stb.toFixed(2);
    },`;

const opSTB = 'operationalSTB'; // var di scope — dipakai di atas, ganti nama yang benar
const newFnFixed = newFn.replace('opSTB > 0 ? opSTB', 'operationalSTB > 0 ? operationalSTB');

if (!s.includes(oldFn)) { console.log('✗ updatePerfHours pattern NOT found'); }
else {
  s = s.replace(oldFn, newFnFixed);
  console.log('✓ updatePerfHours patched');
}

// 2. submitPerformance — bd = non-Op, freq = non-Op, stb dihormati
const submitOld = `            const events = this.performanceForm.events || [];
            const totalBD = events.reduce((acc, curr) => acc + Number(curr?.duration || 0), 0);
            const data = { 
                ...this.performanceForm, 
                id: perfId,
                bd: totalBD,
                freq: events.length,
                updatedBy: this.user?.uid || 'unknown',
                updatedAt: new Date().toISOString()
            };`;

const newSubmit = `            const events = this.performanceForm.events || [];
            // bd hanya breakdown non-Operational; Operational = standby (stb)
            const mechBD = events.reduce((acc, curr) => acc + ((curr && curr.category !== 'Operational') ? (Number(curr?.duration) || 0) : 0), 0);
            const data = { 
                ...this.performanceForm, 
                id: perfId,
                bd: mechBD,
                freq: events.filter(e => e && e.category !== 'Operational').length,
                updatedBy: this.user?.uid || 'unknown',
                updatedAt: new Date().toISOString()
            };`;

if (!s.includes(submitOld)) { console.log('✗ submitPerformance pattern NOT found'); }
else {
  s = s.replace(submitOld, newSubmit);
  console.log('✓ submitPerformance patched');
}

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log('performance.js saved');
