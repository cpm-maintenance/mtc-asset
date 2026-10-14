/**
 * Security Rules Unit Tests — Realtime Database
 * ------------------------------------------------------------
 * Menguji database.rules.json di Firebase Emulator.
 * Fokus: menutup celah otorisasi (P0-1) yang ditemukan pada analisa sistem.
 *
 * Jalankan dengan emulator:
 *   npm run test:rules
 *
 * Catatan: file ini di-exclude dari `npm run test:run` biasa karena
 * butuh Firebase Emulator (Java) — lihat vitest.config.js.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(__dirname, '../../database.rules.json'), 'utf8');

const PROJECT_ID = 'demo-mtc-asset';

let testEnv;

// UID + role untuk seeding
const ADMIN = { uid: 'uid-admin', role: 'admin' };
const SUPERVISOR = { uid: 'uid-supervisor', role: 'supervisor' };
const USER = { uid: 'uid-user', role: 'user' };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules: RULES },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearDatabase();
  // Seed roles tanpa aturan (bypass rules)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref(`Users/${ADMIN.uid}`).set({ role: 'admin', email: 'admin@planner.com' });
    await db.ref(`Users/${SUPERVISOR.uid}`).set({ role: 'supervisor', email: 'sup@planner.com' });
    await db.ref(`Users/${USER.uid}`).set({ role: 'user', email: 'user@planner.com' });
  });
});

const validPerformance = {
  equipmentId: 'EQ-001',
  date: '2026-10-11',
  bd: 0,
  freq: 0,
};

const validImageUpload = {
  data: 'data:image/jpeg;base64,AAAA',
  type: 'image/jpeg',
  created: 1,
};

const validAudit = {
  timestamp: Date.now(),
  date: new Date().toISOString(),
  uid: USER.uid,
  email: 'user@planner.com',
  role: 'user',
  action: 'Login',
  page: 'dash',
  details: '{}',
};

describe('Baseline — akses tidak terautentikasi', () => {
  it('menolak read Equipment tanpa login', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(db.ref('Equipment').get());
  });

  it('menolak write Performance tanpa login', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(db.ref('Performance/perf-1').set(validPerformance));
  });
});

describe('Read — user terautentikasi boleh baca data operasional', () => {
  it('user boleh read Equipment', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertSucceeds(db.ref('Equipment').get());
  });

  it('user boleh read Performance', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertSucceeds(db.ref('Performance').get());
  });
});

describe('P0-1 · Performance — hanya admin/supervisor boleh menulis', () => {
  it('USER biasa DITOLAK menulis Performance', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('Performance/perf-1').set(validPerformance));
  });

  it('USER biasa DITOLAK menghapus Performance', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('Performance/perf-seed').set(validPerformance);
    });
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('Performance/perf-seed').remove());
  });

  it('SUPERVISOR boleh menulis Performance', async () => {
    const db = testEnv.authenticatedContext(SUPERVISOR.uid).database();
    await assertSucceeds(db.ref('Performance/perf-2').set(validPerformance));
  });

  it('ADMIN boleh menulis Performance', async () => {
    const db = testEnv.authenticatedContext(ADMIN.uid).database();
    await assertSucceeds(db.ref('Performance/perf-3').set(validPerformance));
  });
});

describe('P0-1 · ImageUploads — hanya admin/supervisor boleh menulis', () => {
  it('USER biasa DITOLAK menulis ImageUploads', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('ImageUploads/img-1').set(validImageUpload));
  });

  it('SUPERVISOR boleh menulis ImageUploads', async () => {
    const db = testEnv.authenticatedContext(SUPERVISOR.uid).database();
    await assertSucceeds(db.ref('ImageUploads/img-2').set(validImageUpload));
  });

  it('USER masih boleh READ ImageUploads (foto tetap tampil)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('ImageUploads/img-seed').set(validImageUpload);
    });
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertSucceeds(db.ref('ImageUploads/img-seed').get());
  });
});

describe('P0-1 · AuditTrail — append-only (semua role boleh create, larang update/delete)', () => {
  it('USER boleh CREATE entri audit baru', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertSucceeds(db.ref('AuditTrail/entry-1').set(validAudit));
  });

  it('SUPERVISOR boleh CREATE entri audit baru', async () => {
    const db = testEnv.authenticatedContext(SUPERVISOR.uid).database();
    await assertSucceeds(db.ref('AuditTrail/entry-2').set(validAudit));
  });

  it('USER DITOLAK mengubah entri audit yang sudah ada', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('AuditTrail/entry-seed').set(validAudit);
    });
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(
      db.ref('AuditTrail/entry-seed').update({ action: 'Tampered' })
    );
  });

  it('ADMIN pun DITOLAK mengubah entri audit (immutable)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('AuditTrail/entry-seed2').set(validAudit);
    });
    const db = testEnv.authenticatedContext(ADMIN.uid).database();
    await assertFails(
      db.ref('AuditTrail/entry-seed2').update({ action: 'Tampered' })
    );
  });

  it('USER DITOLAK menghapus entri audit', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('AuditTrail/entry-seed3').set(validAudit);
    });
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('AuditTrail/entry-seed3').remove());
  });

  it('ADMIN pun DITOLAK menghapus entri audit', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('AuditTrail/entry-seed4').set(validAudit);
    });
    const db = testEnv.authenticatedContext(ADMIN.uid).database();
    await assertFails(db.ref('AuditTrail/entry-seed4').remove());
  });

  it('admin/supervisor boleh READ AuditTrail', async () => {
    const db = testEnv.authenticatedContext(SUPERVISOR.uid).database();
    await assertSucceeds(db.ref('AuditTrail').get());
  });

  it('USER biasa DITOLAK read AuditTrail', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('AuditTrail').get());
  });
});

describe('Regresi — node lain tetap sesuai desain', () => {
  it('USER DITOLAK menulis Equipment (hanya admin/supervisor)', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(
      db.ref('Equipment/EQ-1').set({ EquipmentID: 'EQ-1', Nama: 'Test', Lokasi: 'Site' })
    );
  });

  it('SUPERVISOR boleh menulis Equipment valid', async () => {
    const db = testEnv.authenticatedContext(SUPERVISOR.uid).database();
    await assertSucceeds(
      db.ref('Equipment/EQ-1').set({ EquipmentID: 'EQ-1', Nama: 'Test', Lokasi: 'Site' })
    );
  });

  it('USER DITOLAK menulis Users/{uid lain}/role', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref(`Users/${ADMIN.uid}/role`).set('admin'));
  });

  it('USER DITOLAK menulis Users/{uid sendiri}/role (privilege escalation)', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref(`Users/${USER.uid}/role`).set('admin'));
  });

  it('USER biasa DITOLAK update profile dengan menyisipkan role admin', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref(`Users/${USER.uid}`).update({ role: 'admin', lastLogin: '2026-10-14' }));
  });

  it('USER biasa BOLEH update profile miliknya tanpa mengubah role', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertSucceeds(db.ref(`Users/${USER.uid}`).update({ lastLogin: '2026-10-14' }));
  });

  it('USER baru BOLEH set profile awal tanpa field role', async () => {
    const newUid = 'new-user-123';
    const db = testEnv.authenticatedContext(newUid).database();
    await assertSucceeds(db.ref(`Users/${newUid}`).set({ uid: newUid, email: 'new@planner.com', lastLogin: '2026-10-14' }));
  });

  it('USER baru DITOLAK set profile awal dengan field role admin', async () => {
    const newUid = 'new-user-456';
    const db = testEnv.authenticatedContext(newUid).database();
    await assertFails(db.ref(`Users/${newUid}`).set({ uid: newUid, email: 'new@planner.com', role: 'admin' }));
  });

  it('ADMIN BOLEH mengubah role user lain', async () => {
    const db = testEnv.authenticatedContext(ADMIN.uid).database();
    await assertSucceeds(db.ref(`Users/${USER.uid}/role`).set('supervisor'));
  });
});

describe('P0-3 · Requisitions — user boleh create pending, hanya admin/supervisor update/delete', () => {
  const validReq = (createdBy, status = 'pending') => ({
    id: 'REQ_1',
    items: [{ itemName: 'Bearing', quantity: 1, itemType: 'part' }],
    itemName: 'Bearing',
    itemType: 'part',
    quantity: 1,
    status,
    createdBy,
    requesterName: 'tester',
    requestDate: '2026-10-11',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('USER biasa BOLEH create requisition pending miliknya', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertSucceeds(db.ref('Requisitions/REQ_1').set(validReq(USER.uid)));
  });

  it('USER biasa DITOLAK create dengan status approved (privilege escalation)', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('Requisitions/REQ_1').set(validReq(USER.uid, 'approved')));
  });

  it('USER biasa DITOLAK create atas nama user lain (createdBy spoofing)', async () => {
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('Requisitions/REQ_1').set(validReq(ADMIN.uid)));
  });

  it('USER biasa DITOLAK mengubah requisition (approve sendiri)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('Requisitions/REQ_seed').set(validReq(USER.uid));
    });
    const db = testEnv.authenticatedContext(USER.uid).database();
    await assertFails(db.ref('Requisitions/REQ_seed').update({ status: 'approved' }));
  });

  it('SUPERVISOR boleh approve requisition', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('Requisitions/REQ_seed').set(validReq(USER.uid));
    });
    const db = testEnv.authenticatedContext(SUPERVISOR.uid).database();
    await assertSucceeds(db.ref('Requisitions/REQ_seed').update({ status: 'approved' }));
  });

  it('ADMIN boleh delete requisition', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('Requisitions/REQ_seed').set(validReq(USER.uid));
    });
    const db = testEnv.authenticatedContext(ADMIN.uid).database();
    await assertSucceeds(db.ref('Requisitions/REQ_seed').remove());
  });
});
