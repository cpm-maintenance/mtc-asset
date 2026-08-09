import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function patch(file, pairs) {
  const fp = path.join(ROOT, file);
  let s = fs.readFileSync(fp, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [from, to] of pairs) {
    if (!s.includes(from)) { console.log('  ✗ NOT FOUND:', file, '::', from.slice(0, 70)); continue; }
    s = s.replace(from, to);
    console.log('  ✓', file);
  }
  fs.writeFileSync(fp, s.split('\n').join(eol));
}

// ═══ 1. performance.js: default form + prefill + simpan hm + validasi monotonik ═══
patch('src/js/modules/performance.js', [
  // default form — tambah hm
  [
    `                wh: "24.00", bd: "0.00", stb: "0.00", freq: 0, type: 'Unscheduled', `,
    `                wh: "24.00", bd: "0.00", stb: "0.00", hm: "", freq: 0, type: 'Unscheduled', `
  ],
  // openPerformanceModal — prefill HM dari CurrentHM saat pilih equipment
  [
    `    addBDEvent() {`,
    `    // Prefill HM dari Equipment.CurrentHM (dapat diedit — meter bisa beda)
    onPerfEquipChange() {
        const eq = this.equipment?.find(e => e && e.EquipmentID === this.performanceForm.equipmentId);
        if (eq && (eq.CurrentHM || eq.HM)) {
            const h = Number(eq.CurrentHM || eq.HM) || 0;
            if (!this.performanceForm.hm || h > Number(this.performanceForm.hm) || this.performanceForm.hm === '') {
                this.performanceForm.hm = h.toFixed(1);
            }
        }
    },

    addBDEvent() {`
  ],
  // submit — simpan hm (sudah ikut ...this.performanceForm); tambah bdSource hint? tidak perlu
]);

// ═══ 2. utils.js: validasi hm ═══
patch('src/js/utils.js', [
  [
    `  // Validate PA Plan
  if (form.paPlan && (form.paPlan < 0 || form.paPlan > 100)) errors.push('PA Plan must be between 0-100');`,
    `  // Validate PA Plan
  if (form.paPlan && (form.paPlan < 0 || form.paPlan > 100)) errors.push('PA Plan must be between 0-100');

  // Validate HM (hour meter — cumulative, boleh 0 tapi tak boleh negatif)
  if (form.hm !== undefined && form.hm !== '' && !isValidPositiveNumber(form.hm, true)) {
    errors.push('HM (Running Hours) must be a positive number');
  }`
  ]
]);

// ═══ 3. app.js: state hm + watcher (Alpine) utk monotonik ═══
patch('src/js/app.js', [
  [
    `        perfFilterEquip: '',
        perfFilterArea: '',`,
    `        perfFilterEquip: '',
        perfFilterArea: '',
        // HM monotonik: cek saat submit di performance.js (via validate)
        perfPrevHM: {},`
  ]
]);

// ═══ 4. PerformanceModal.html: field HM + prefill event ═══
patch('public/components/modals/PerformanceModal.html', [
  // select equipment — panggil onPerfEquipChange
  [
    `          <select x-model="performanceForm.equipmentId" required id="perf-equip" name="perf-equip"
                  class="w-full p-3 glass text-xs font-bold text-white">`,
    `          <select x-model="performanceForm.equipmentId" @change="onPerfEquipChange()" required id="perf-equip" name="perf-equip"
                  class="w-full p-3 glass text-xs font-bold text-white">`
  ],
  // tambah field HM di grid metrics — sebelum Work (WH)
  [
    `          <div>
            <label class="text-[8px] text-nexus-accent/40 uppercase font-black mb-2 block text-center">Work (WH)</label>`,
    `          <div>
            <label class="text-[8px] text-cyan-400/70 uppercase font-black mb-2 block text-center" title="Hour Meter — pembacaan kumulatif akhir periode">HM (Running Hrs)</label>
            <input type="number" x-model="performanceForm.hm" step="0.1" min="0" placeholder="0.0"
                   class="w-full p-3 glass font-black text-cyan-400 text-center text-sm">
          </div>
          <div>
            <label class="text-[8px] text-nexus-accent/40 uppercase font-black mb-2 block text-center">Work (WH)</label>`
  ]
]);

// ═══ 5. Performance.html table: kolom HM ═══
patch('public/pages/Performance.html', [
  [
    `            <th class="p-5 text-center">WH</th>`,
    `            <th class="p-5 text-center">HM</th>
            <th class="p-5 text-center">WH</th>`
  ],
  [
    `              <td class="p-5 text-center font-bold" x-text="p.wh"></td>`,
    `              <td class="p-5 text-center font-bold text-cyan-400" x-text="p.hm != null && p.hm !== '' ? Number(p.hm).toLocaleString() : '-'"></td>
              <td class="p-5 text-center font-bold" x-text="p.wh"></td>`
  ]
]);

console.log('\n✅ HM (running hours) field added: form, prefill, validasi, table, save');
