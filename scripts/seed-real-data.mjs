/**
 * Seed data riil — Phase A1
 * Mengisi: PM_Schedule, HistoryLog (WO + breakdown), Performance
 * Data realistis berdasarkan 18 equipment nyata (crushing/grinding/recovery/tailing)
 * Cara pakai: node scripts/seed-real-data.mjs
 * SKIP jika data sudah ada (tidak overwrite).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Load .env manual (node tidak support import.meta.env) ──
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env tidak ditemukan');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const now = new Date();
const iso = d => d.toISOString().split('T')[0];

// Helper: tanggal n hari lalu
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

// ── DATA: PM tasks per equipment (taskName realistis) ──
const pmTemplates = [
  { taskName: 'Grease & Lube Check', frequency: 'weekly', basis: 'calendar', intervalHours: 168, priority: 'High', description: 'Lubrication titik grease, cek level oli' },
  { taskName: 'Bearing Vibration Inspection', frequency: 'monthly', basis: 'hours', intervalHours: 720, priority: 'High', description: 'Cek vibrasi bearing, thermal scan' },
  { taskName: 'Belt & Pulley Alignment', frequency: 'monthly', basis: 'calendar', intervalHours: 720, priority: 'Medium', description: 'Cek tension belt, alignment pulley' },
  { taskName: 'Hydraulic System Check', frequency: 'monthly', basis: 'hours', intervalHours: 500, priority: 'High', description: 'Cek tekanan, kebocoran, level oli hidrolik' },
  { taskName: 'Screen Deck Inspection', frequency: 'quarterly', basis: 'calendar', intervalHours: 2160, priority: 'Medium', description: 'Cek keausan screen, frame, rubber' },
  { taskName: 'Motor Overhaul Check', frequency: 'yearly', basis: 'hours', intervalHours: 8760, priority: 'Medium', description: 'Inspeksi motor, bearing, winding' },
];

// Peta task per tipe equipment (Crushing/Grinding/Recovery/Conveyor/Filtration/Pump)
const typePM = {
  Crushing: ['Grease & Lube Check', 'Jaw Plate Wear Check', 'Hydraulic System Check', 'Bearing Vibration Inspection'],
  Grinding: ['Grease & Lube Check', 'Liner Wear Inspection', 'Bearing Vibration Inspection', 'Motor Overhaul Check'],
  Recovery: ['Grease & Lube Check', 'Screen Deck Inspection', 'Belt & Pulley Alignment'],
  Conveyor: ['Belt & Pulley Alignment', 'Grease & Lube Check', 'Roller Inspection'],
  Filtration: ['Hydraulic System Check', 'Filter Cloth Replacement', 'Bearing Vibration Inspection'],
  Pump: ['Hydraulic System Check', 'Impeller Wear Check', 'Bearing Vibration Inspection', 'Mechanical Seal Check'],
};

// ── DATA: breakdown events realistis ──
const breakdowns = [
  { equip: '2220-CR-001', komponen: 'Jaw Plate', kategori: 'Mechanical', deskripsi: 'Jaw plate aus melebihi batas, retak di area crushing', bd: 6, cost: 8500000, rca: 'Abrasive wear berlebihan, material overfeed' },
  { equip: '2220-CR-001', komponen: 'Toggle Plate', kategori: 'Mechanical', deskripsi: 'Toggle plate patah saat material keras masuk', bd: 4, cost: 3200000, rca: 'Overload, metal tramp masuk crusher' },
  { equip: '2310-CV-003', komponen: 'Trunnion Bearing', kategori: 'Mechanical', deskripsi: 'Suhu bearing naik 85°C, alarm trip', bd: 8, cost: 15000000, rca: 'Pelumasan kurang, contamination' },
  { equip: '2320-CR-002', komponen: 'Mantle', kategori: 'Mechanical', deskripsi: 'Mantle retak, perlu ganti', bd: 10, cost: 12000000, rca: 'Fatigue, impact berlebih' },
  { equip: '2330-ML-002', komponen: 'Motor', kategori: 'Electrical', deskripsi: 'Motor trip overload, winding short', bd: 12, cost: 25000000, rca: 'Beban berlebih, pendinginan buruk' },
  { equip: '5060-PU-12', komponen: 'Mechanical Seal', kategori: 'Mechanical', deskripsi: 'Seal bocor deras, slurry keluar', bd: 5, cost: 4500000, rca: 'Keausan seal, abrasive slurry' },
  { equip: '5060-PU-15', komponen: 'Impeller', kategori: 'Mechanical', deskripsi: 'Impeller aus, kapasitas turun 30%', bd: 7, cost: 6800000, rca: 'Erosi partikel slurry' },
  { equip: '2810-CV-011', komponen: 'Belt', kategori: 'Mechanical', deskripsi: 'Belt sobek 2m, perlu splicing', bd: 6, cost: 5200000, rca: 'Sharp object, misalignment' },
  { equip: '2350-GC-001', komponen: 'Screen', kategori: 'Mechanical', deskripsi: 'Screen deck sobek, efisiensi turun', bd: 4, cost: 2800000, rca: 'Keausan material' },
  { equip: '5060-FP-02', komponen: 'Filter Cloth', kategori: 'Mechanical', deskripsi: 'Filter cloth sobek, cake basah', bd: 5, cost: 3800000, rca: 'Abrasi, umur pakai habis' },
];

// ── DATA: PM historis (3 bulan terakhir, complete) ──
const pmHistory = [];
const equipList = [
  { id: '2220-CR-001', tipe: 'Crushing', nama: 'Jaw Crusher' },
  { id: '2310-CV-003', tipe: 'Grinding', nama: 'Sag Mill' },
  { id: '2320-CR-002', tipe: 'Grinding', nama: 'Cone Crusher' },
  { id: '2330-ML-002', tipe: 'Grinding', nama: 'Ball Mill' },
  { id: '2350-GC-001', tipe: 'Recovery', nama: 'Gravity Concentrator 01' },
  { id: '2350-GC-002', tipe: 'Recovery', nama: 'Gravity Concentrator 02' },
  { id: '2810-CV-009', tipe: 'Conveyor', nama: 'OLC 01' },
  { id: '2810-CV-010', tipe: 'Conveyor', nama: 'OLC 02' },
  { id: '2810-CV-011', tipe: 'Conveyor', nama: 'OLC 03' },
  { id: '2810-CV-012', tipe: 'Conveyor', nama: 'OLC 04' },
  { id: '2810-CV-013', tipe: 'Conveyor', nama: 'OLC 05' },
  { id: '5060-FP-01', tipe: 'Filtration', nama: 'Filter Press 01' },
  { id: '5060-FP-02', tipe: 'Filtration', nama: 'Filter Press 02' },
  { id: '5060-FP-03', tipe: 'Filtration', nama: 'Filter Press 03' },
  { id: '5060-PU-12', tipe: 'Pump', nama: 'Feeding Pump PU 12' },
  { id: '5060-PU-13', tipe: 'Pump', nama: 'Feeding Pump PU 13' },
  { id: '5060-PU-14', tipe: 'Pump', nama: 'Feeding Pump PU 14' },
  { id: '5060-PU-15', tipe: 'Pump', nama: 'Feeding Pump PU 15' },
];

const teknisi = ['DhBF4lw6otV5aPu3xUl4pDvyA9u2', 'jtUxorQdOfcaY8cDnJsppVjRAE52']; // admin + supervisor

// Generate PM history: 3 bulan, tiap equipment 2-3 PM selesai
equipList.forEach((eq, ei) => {
  const tasks = typePM[eq.tipe] || ['Grease & Lube Check'];
  tasks.slice(0, 3).forEach((task, ti) => {
    // PM selesai di 90, 60, 30 hari lalu
    [90, 60, 30].forEach((ago, ai) => {
      pmHistory.push({
        pmId: `PM_${eq.id}_${ai}_${ei}_${ti}`,
        taskName: task,
        equipmentId: eq.id,
        description: `PM rutin ${task} untuk ${eq.nama}`,
        date: daysAgo(ago),
        frequency: 'monthly',
        basis: 'calendar',
        intervalHours: 720,
        assignedTo: teknisi[ai % 2],
        status: 'completed',
        priority: 'High',
        completionDate: daysAgo(ago - 1),
        completionNote: 'Selesai sesuai jadwal, tidak ada temuan mayor',
        createdBy: teknisi[0],
        createdAt: new Date(Date.now() - ago * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - (ago - 1) * 86400000).toISOString(),
      });
    });
  });
});

// PM pending: 5 task minggu ini
const pmPending = [
  { taskName: 'Grease & Lube Check', equipmentId: '2220-CR-001', frequency: 'weekly', basis: 'calendar', intervalHours: 168, priority: 'High', assignedTo: teknisi[0] },
  { taskName: 'Bearing Vibration Inspection', equipmentId: '2310-CV-003', frequency: 'monthly', basis: 'hours', intervalHours: 720, priority: 'High', assignedTo: teknisi[1] },
  { taskName: 'Belt & Pulley Alignment', equipmentId: '2810-CV-010', frequency: 'monthly', basis: 'calendar', intervalHours: 720, priority: 'Medium', assignedTo: teknisi[0] },
  { taskName: 'Filter Cloth Replacement', equipmentId: '5060-FP-01', frequency: 'monthly', basis: 'calendar', intervalHours: 720, priority: 'High', assignedTo: teknisi[1] },
  { taskName: 'Hydraulic System Check', equipmentId: '5060-PU-12', frequency: 'monthly', basis: 'hours', intervalHours: 500, priority: 'High', assignedTo: teknisi[0] },
];

// ── Performance data: 30 hari terakhir tiap equipment kritis ──
const criticalEquips = ['2220-CR-001', '2310-CV-003', '2320-CR-002', '2330-ML-002', '5060-PU-12', '5060-PU-15', '2810-CV-011', '5060-FP-02'];

// ── MAIN ──
async function main() {
  // Auth sebagai admin (rules: write butuh auth + role admin/supervisor)
  const auth = getAuth(app);
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@planner.com';
  const adminPass = process.env.SEED_ADMIN_PASS;
  if (!adminPass) {
    console.error('❌ Set SEED_ADMIN_PASS (password admin@planner.com) untuk seed');
    process.exit(1);
  }
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);
  console.log(`✓ Auth sebagai ${adminEmail}`);

  const rootRef = ref(db);
  const snap = await get(child(rootRef, 'PM_Schedule'));
  const existingPM = snap.exists() ? Object.keys(snap.val()) : [];
  const snapP = await get(child(rootRef, 'Performance'));
  const existingPerf = snapP.exists() ? Object.keys(snapP.val()) : [];

  console.log(`Existing: PM=${existingPM.length}, Performance=${existingPerf.length}`);

  // 1. PM history (hanya jika kosong)
  if (existingPM.length === 0) {
    console.log('Mengisi PM_Schedule...');
    const allPM = [...pmHistory, ...pmPending.map((p, i) => ({
      ...p,
      pmId: `PM_PEND_${i}`,
      description: `PM ${p.taskName} terjadwal`,
      date: iso(new Date(Date.now() + (i + 1) * 86400000)),
      status: 'pending',
      completionDate: '',
      completionNote: '',
      createdBy: teknisi[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))];
    for (const pm of allPM) {
      await set(ref(db, `PM_Schedule/${pm.pmId}`), pm);
    }
    console.log(`  ✓ ${allPM.length} PM disimpan`);
  } else {
    console.log('  PM sudah ada, skip');
  }

  // 2. HistoryLog — WO dari breakdowns + PM selesai (hanya jika < 5)
  const snapL = await get(child(rootRef, 'HistoryLog'));
  const existingLogs = snapL.exists() ? Object.keys(snapL.val()) : [];
  if (existingLogs.length < 5) {
    console.log('Mengisi HistoryLog...');
    const logs = [];
    // WO breakdown
    breakdowns.forEach((b, i) => {
      const date = daysAgo(5 + i * 3);
      logs.push({
        LogID: `LOG_BD_${i}`,
        Jenis: 'Breakdown',
        EquipmentID: b.equip,
        Deskripsi: b.deskripsi,
        Tanggal: date,
        Downtime: b.bd,
        Cost: b.cost,
        HM: String(8000 + i * 150),
        Catatan: b.rca,
        Technician: teknisi[i % 2],
        Status: 'Completed',
        woNumber: `WO-BD-${String(i + 1).padStart(3, '0')}`,
        woPriority: 'High',
        PartsUsed: [],
        rca: b.rca,
        actualHours: b.bd,
        estimatedHours: b.bd + 2,
        assignedTo: teknisi[i % 2],
        requestDate: date,
        requestSource: 'Breakdown',
        requestedBy: teknisi[0],
        createdAt: new Date(Date.now() - (5 + i * 3) * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - (5 + i * 3 - 1) * 86400000).toISOString(),
      });
    });
    // WO PM
    for (let i = 0; i < 5; i++) {
      const eq = equipList[i];
      const date = daysAgo(10 + i);
      logs.push({
        LogID: `LOG_PM_${i}`,
        Jenis: 'Preventive',
        EquipmentID: eq.id,
        Deskripsi: `PM rutin: ${(typePM[eq.tipe] || ['Grease'])[0]} — ${eq.nama}`,
        Tanggal: date,
        Downtime: 1,
        Cost: 1500000 + i * 250000,
        HM: String(7000 + i * 200),
        Catatan: 'PM selesai sesuai prosedur',
        Technician: teknisi[i % 2],
        Status: 'Completed',
        woNumber: `WO-PM-${String(i + 1).padStart(3, '0')}`,
        woPriority: 'Medium',
        PartsUsed: [],
        rca: '',
        actualHours: 1,
        estimatedHours: 1.5,
        assignedTo: teknisi[i % 2],
        requestDate: date,
        requestSource: 'PM_Schedule',
        requestedBy: teknisi[0],
        createdAt: new Date(Date.now() - (10 + i) * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - (10 + i - 1) * 86400000).toISOString(),
      });
    }
    for (const l of logs) await set(ref(db, `HistoryLog/${l.LogID}`), l);
    console.log(`  ✓ ${logs.length} log disimpan`);
  } else {
    console.log('  HistoryLog sudah ada, skip');
  }

  // 3. Performance — 30 hari tiap equipment kritis
  if (existingPerf.length < 10) {
    console.log('Mengisi Performance...');
    let count = 0;
    for (const eqId of criticalEquips) {
      for (let d = 0; d < 30; d += 3) {
        const date = daysAgo(d);
        // 1-2 breakdown event dalam 30 hari utk equipment tertentu
        const bdEvents = [];
        if (d % 10 === 0) {
          const bd = breakdowns.find(b => b.equip === eqId);
          if (bd) bdEvents.push({
            category: bd.kategori,
            component: bd.komponen,
            duration: bd.bd,
            description: bd.deskripsi,
          });
        }
        const totalBD = bdEvents.reduce((s, e) => s + (Number(e.duration) || 0), 0);
        const stb = d % 7 === 0 ? 3 : 0; // kadang standby
        const wh = Math.max(0, 24 - totalBD - stb);
        const perf = {
          id: `PERF_${eqId}_${d}`,
          equipmentId: eqId,
          date,
          area: equipList.find(e => e.id === eqId)?.tipe || 'Plant',
          wh: Number(wh.toFixed(1)),
          bd: totalBD,
          stb,
          freq: bdEvents.length,
          hm: 8000 + d * 24,
          events: bdEvents,
          paPlan: 90,
          type: bdEvents.length ? 'Unscheduled' : 'Scheduled',
          createdAt: new Date(Date.now() - d * 86400000).toISOString(),
          createdBy: teknisi[0],
          updatedAt: new Date().toISOString(),
        };
        await set(ref(db, `Performance/${perf.id}`), perf);
        count++;
      }
    }
    console.log(`  ✓ ${count} Performance disimpan`);
  } else {
    console.log('  Performance sudah ada, skip');
  }

  console.log('\n✅ Seed data selesai!');
  process.exit(0);
}

main().catch(e => { console.error('❌ Seed error:', e); process.exit(1); });
