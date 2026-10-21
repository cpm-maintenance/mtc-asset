// Seed Firebase Emulator (auth + RTDB) untuk E2E — tanpa kredensial produksi.
// Dipakai otomatis oleh e2e/workorder-pdf.spec.js saat E2E_USE_EMULATORS=1.
/* global fetch, setTimeout, URL, process */
import { readFileSync } from 'node:fs';

const AUTH = 'http://127.0.0.1:9099';
const DB = 'http://127.0.0.1:9000';
const API_KEY = 'fake-api-key';
// Namespace RTDB emulator harus sama dengan host databaseURL aplikasi
// (mis. mtc-asset-default-rtdb.asia-southeast1... -> ns "mtc-asset-default-rtdb").
// Kalau beda, seed masuk ke namespace lain dan aplikasi membaca data kosong.
function nsFromEnv() {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const m = /^VITE_FIREBASE_DATABASE_URL=(\S+)/m.exec(env);
    if (m) return new URL(m[1]).hostname.split('.')[0];
  } catch {
    /* .env tidak ada -> pakai default */
  }
  return 'mtc-asset-default-rtdb';
}
const NS = process.env.E2E_RTDB_NS || nsFromEnv();

export const E2E_USER = {
  email: process.env.E2E_EMAIL || 'e2e@mtc.local',
  password: process.env.E2E_PASSWORD || 'e2e-password-123',
};

const WO_ID = 'WO-E2E-001';
const EQ_ID = 'EQ-E2E-001';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${text.slice(0, 120)}`);
  return text ? JSON.parse(text) : {};
}

async function put(path, value) {
  const res = await fetch(`${DB}/${path}.json?ns=${NS}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`PUT ${path} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
}

/** Tunggu emulator auth siap (bisa lebih lambat dari database saat cold start). */
async function waitForAuth(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${AUTH}/`, { method: 'GET' });
      if (res.status > 0) return;
    } catch {
      /* belum siap */
    }
    if (Date.now() > deadline) throw new Error(`Auth emulator tidak siap di ${AUTH} setelah ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Buat user uji; kalau sudah ada (run kedua), login saja. */
async function ensureUser() {
  const payload = { email: E2E_USER.email, password: E2E_USER.password, returnSecureToken: true };
  try {
    return await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, payload);
  } catch (err) {
    if (!String(err.message).includes('EMAIL_EXISTS')) throw err;
    return await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, payload);
  }
}

/** Buat user uji + data minimal yang dibutuhkan alur login → WO → PDF. */
export async function seedEmulator() {
  // Cetak namespace: kalau seed dan build memakai namespace berbeda, aplikasi
  // membaca data kosong tanpa error apa pun (gejala: poll `window.app.logs`
  // selalu 0). Satu baris ini membuat penyebabnya terlihat di log CI.
  console.log(`[seed] RTDB namespace = ${NS}`);
  await waitForAuth();
  const signUp = await ensureUser();

  const uid = signUp.localId;
  await put(`Users/${uid}`, {
    email: E2E_USER.email,
    role: 'admin',
    uid,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  });

  await put(`Equipment/${EQ_ID}`, {
    EquipmentID: EQ_ID,
    Nama: 'Pompa E2E',
    Lokasi: 'Area E2E',
    Kategori: 'Pump',
    Status: 'Operational',
    FotoURL: '',
  });

  await put(`HistoryLog/${WO_ID}`, {
    LogID: WO_ID,
    woNumber: WO_ID,
    EquipmentID: EQ_ID,
    externalEquipName: '',
    Jenis: 'Corrective',
    Deskripsi: 'Perbaikan seal pompa (data uji E2E)',
    Status: 'Completed',
    woPriority: 'High',
    Tanggal: '2026-10-20',
    Technician: 'Teknisi E2E',
    assignedTo: 'Teknisi E2E',
    createdBy: E2E_USER.email,
    requestDate: '2026-10-19',
    dueDate: '2026-10-21',
    approvalDate: '2026-10-20',
    approvedBy: 'Supervisor E2E',
    estimatedHours: 4,
    actualHours: 3.5,
    Downtime: 2,
    Cost: 150000,
    HM: '1200',
    Catatan: 'Seed E2E',
    rca: 'Seal aus',
    PartsUsed: [],
    PhotoURLs: [],
  });

  return { uid, woId: WO_ID, email: E2E_USER.email };
}
