import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const fp = path.join(ROOT, 'index.html');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

let ok = 0;

// 1. Select equipment — tambah @change prefill HM
const selOld = `            <select x-model="performanceForm.equipmentId" required id="perf-equip" name="perf-equip"
              class="w-full p-3 glass text-xs font-bold text-white">`;
const selNew = `            <select x-model="performanceForm.equipmentId" @change="onPerfEquipChange()" required id="perf-equip" name="perf-equip"
              class="w-full p-3 glass text-xs font-bold text-white">`;
if (s.includes(selOld)) { s = s.replace(selOld, selNew); ok++; console.log('✓ index.html: @change prefill'); }
else console.log('✗ select pattern NOT found');

// 2. Field HM — sebelum Work (WH) di section Operational Metrics
const hmOld = `          <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label class="text-[8px] text-nexus-accent/40 uppercase font-black mb-2 block text-center">Work (WH)</label>`;
const hmNew = `          <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label class="text-[8px] text-cyan-400/70 uppercase font-black mb-2 block text-center" title="Hour Meter — pembacaan kumulatif akhir periode">HM (Running Hrs)</label>
              <input type="number" x-model="performanceForm.hm" step="0.1" min="0" placeholder="0.0"
                class="w-full p-3 glass font-black text-cyan-400 text-center text-sm">
            </div>
            <div>
              <label class="text-[8px] text-nexus-accent/40 uppercase font-black mb-2 block text-center">Work (WH)</label>`;
if (s.includes(hmOld)) { s = s.replace(hmOld, hmNew); ok++; console.log('✓ index.html: HM field added'); }
else console.log('✗ HM pattern NOT found');

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log(`index.html saved (${ok}/2 patches)`);
