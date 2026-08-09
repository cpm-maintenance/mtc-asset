import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'public', 'pages', 'Performance.html');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

// Tambah filter bar di bawah header, sebelum table
const anchor = `  <!-- Performance Table -->`;

const filters = `  <!-- Filter Bar -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 glass p-4 rounded-2xl border-nexus-accent/10">
    <div>
      <label class="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-2">Equipment</label>
      <select x-model="perfFilterEquip" class="w-full p-2.5 glass text-xs font-bold">
        <option value="">-- Semua Equipment --</option>
        <template x-for="e in equipment" :key="e.EquipmentID">
          <option :value="e.EquipmentID" x-text="e.Nama"></option>
        </template>
      </select>
    </div>
    <div>
      <label class="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-2">Area</label>
      <select x-model="perfFilterArea" class="w-full p-2.5 glass text-xs font-bold">
        <option value="">-- Semua Area --</option>
        <template x-for="area in [...new Set(performanceData.map(p => p.area).filter(Boolean))]" :key="area">
          <option :value="area" x-text="area"></option>
        </template>
      </select>
    </div>
    <div>
      <label class="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-2">Periode</label>
      <select x-model="kpiFilter" class="w-full p-2.5 glass text-xs font-bold">
        <option value="yearly">Yearly</option>
        <option value="monthly">Monthly</option>
        <option value="weekly">Weekly</option>
        <option value="daily">Daily</option>
      </select>
    </div>
    <div>
      <label class="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-2">Tanggal</label>
      <input type="date" x-model="kpiFilterDate" class="w-full p-2.5 glass text-xs font-bold text-white">
    </div>
  </div>

  <!-- Performance Table -->`;

if (s.includes(anchor)) {
  s = s.replace(anchor, filters);
  console.log('✓ Performance.html: filter bar added');
} else {
  console.log('✗ anchor NOT found');
}

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log('Performance.html saved');
