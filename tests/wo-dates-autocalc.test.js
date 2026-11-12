/**
 * Kontrak Start/End Date + downtime & cost otomatis (D19).
 *
 * Sebelum ini `Downtime` dan `Cost` hanya bisa diisi manual, dan tidak ada
 * field rentang waktu sama sekali — modal Work Order cuma punya satu
 * "Timeline Date". Sekarang:
 *
 *   1. ada field `startDate` + `endDate` (`datetime-local`, `YYYY-MM-DDTHH:mm`);
 *   2. `downtime` terisi otomatis = selisih jam (1 desimal, `step="0.1"`);
 *   3. `cost` terisi otomatis = Σ(qty × Harga) dari spare part di form.
 *
 * Auto-isi bersifat *prefill*, bukan read-only: nilai yang sudah dihitung
 * masih boleh ditimpa manual. Karena itu `recalcLogAuto()` hanya menulis ke
 * `logForm.downtime` / `logForm.cost` saat dipanggil (perubahan tanggal atau
 * part), bukan getter yang dipakai langsung oleh input.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOG_FORM } from '../src/js/constants.ts';
import { logsModule } from '../src/js/modules/logs.js';
import { computeDowntimeHours, computePartsCost } from '../src/js/utils.js';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const APP_SHELL = read('public/pages/app-shell.html');
const WORK_ORDERS = read('public/pages/WorkOrders.html');

const makeCtx = (logForm, allParts = []) =>
  Object.assign(Object.create(logsModule), {
    logForm,
    logFormErrors: {},
    allParts,
    showNotification: () => {},
  });

describe('computeDowntimeHours — selisih hari × 24 jam', () => {
  it('dua hari penuh = 48 jam', () => {
    expect(computeDowntimeHours('2026-11-01', '2026-11-03')).toBe(48);
  });

  it('rentang setengah hari (tanggal sama) = 0 jam, bukan error', () => {
    expect(computeDowntimeHours('2026-11-01', '2026-11-01')).toBe(0);
  });

  it('rentang terbalik tidak menghasilkan angka negatif: null', () => {
    expect(computeDowntimeHours('2026-11-03', '2026-11-01')).toBeNull();
  });

  it('field kosong / tidak valid → null, bukan 0', () => {
    expect(computeDowntimeHours('', '2026-11-03')).toBeNull();
    expect(computeDowntimeHours('2026-11-01', '')).toBeNull();
    expect(computeDowntimeHours('bukan-tanggal', '2026-11-03')).toBeNull();
    expect(computeDowntimeHours(undefined, undefined)).toBeNull();
  });

  it('lintas bulan & tahun dihitung benar', () => {
    expect(computeDowntimeHours('2026-10-31', '2026-11-02')).toBe(48);
    expect(computeDowntimeHours('2026-12-31', '2027-01-01')).toBe(24);
  });
});

describe('computePartsCost — Σ(qty × Harga)', () => {
  const catalog = [
    { PartID: 'P-1', Harga: 1500 },
    { PartID: 'P-2', Harga: 250_000 },
    { PartID: 'P-3', Harga: 0 },
  ];

  it('menjumlahkan qty × Harga tiap part', () => {
    expect(computePartsCost([{ id: 'P-1', qty: 2 }, { id: 'P-2', qty: 1 }], catalog)).toBe(253_000);
  });

  it('daftar part kosong → 0', () => {
    expect(computePartsCost([], catalog)).toBe(0);
  });

  it('part tak dikenal / tanpa harga dihitung 0, tidak NaN', () => {
    expect(computePartsCost([{ id: 'TIDAK-ADA', qty: 5 }, { id: 'P-3', qty: 2 }], catalog)).toBe(0);
  });

  it('qty tidak valid dianggap 1 supaya part terpilih tetap terhitung', () => {
    expect(computePartsCost([{ id: 'P-1', qty: 0 }], catalog)).toBe(0);
    expect(computePartsCost([{ id: 'P-1', qty: '' }], catalog)).toBe(1500);
  });

  it('input bukan array → 0', () => {
    expect(computePartsCost(null, catalog)).toBe(0);
    expect(computePartsCost(undefined, catalog)).toBe(0);
  });
});

describe('DEFAULT_LOG_FORM memuat startDate & endDate', () => {
  it('keduanya dideklarasikan sebagai string kosong', () => {
    const form = DEFAULT_LOG_FORM();
    expect(form).toHaveProperty('startDate', '');
    expect(form).toHaveProperty('endDate', '');
  });
});

describe('getter auto-hitung di modul logs', () => {
  it('logAutoDowntime mengikuti startDate/endDate', () => {
    const ctx = makeCtx({ startDate: '2026-11-01', endDate: '2026-11-04' });
    expect(ctx.logAutoDowntime).toBe(72);
  });

  it('logAutoDowntime null bila rentang belum lengkap', () => {
    expect(makeCtx({ startDate: '2026-11-01', endDate: '' }).logAutoDowntime).toBeNull();
  });

  it('logAutoCost memakai katalog allParts', () => {
    const ctx = makeCtx({ parts: [{ id: 'P-2', qty: 3 }] }, [{ PartID: 'P-2', Harga: 1000 }]);
    expect(ctx.logAutoCost).toBe(3000);
  });
});

describe('recalcLogAuto — prefill, bukan kunci', () => {
  it('mengisi downtime dan cost ke logForm', () => {
    const ctx = makeCtx(
      { startDate: '2026-11-01', endDate: '2026-11-02', parts: [{ id: 'P-1', qty: 2 }], downtime: '', cost: '' },
      [{ PartID: 'P-1', Harga: 500 }],
    );
    ctx.recalcLogAuto();
    expect(ctx.logForm.downtime).toBe(24);
    expect(ctx.logForm.cost).toBe(1000);
  });

  it('biarkan manual saat rentang belum lengkap (tidak menimpa jadi kosong)', () => {
    const ctx = makeCtx({ startDate: '', endDate: '', parts: [], downtime: 9, cost: 77 });
    ctx.recalcLogAuto();
    expect(ctx.logForm.downtime).toBe(9);
    expect(ctx.logForm.cost).toBe(77);
  });
});

describe('validasi rentang: endDate tidak boleh mendahului startDate', () => {
  it('rentang terbalik ditolak dengan pesan di field endDate', () => {
    const ctx = makeCtx({ equipmentId: 'EQ-1', date: '2026-11-01', desc: 'x', startDate: '2026-11-05', endDate: '2026-11-02' });
    expect(ctx.syncLogFormErrors()).toBe(false);
    expect(ctx.logFormErrors.endDate).toBeTruthy();
  });

  it('rentang wajar lolos', () => {
    const ctx = makeCtx({ equipmentId: 'EQ-1', date: '2026-11-01', desc: 'x', startDate: '2026-11-01', endDate: '2026-11-03' });
    expect(ctx.syncLogFormErrors()).toBe(true);
    expect(ctx.logFormErrors.endDate).toBeUndefined();
  });

  it('kedua field kosong tidak dianggap error (opsional)', () => {
    const ctx = makeCtx({ equipmentId: 'EQ-1', date: '2026-11-01', desc: 'x', startDate: '', endDate: '' });
    expect(ctx.syncLogFormErrors()).toBe(true);
  });
});

describe('markup: kedua form punya input rentang + pemicu recalc', () => {
  it('WorkOrders console punya input startDate & endDate', () => {
    expect(WORK_ORDERS).toContain('x-model="logForm.startDate"');
    expect(WORK_ORDERS).toContain('x-model="logForm.endDate"');
  });

  it('modal New System Entry punya input startDate & endDate', () => {
    expect(APP_SHELL).toContain('x-model="logForm.startDate"');
    expect(APP_SHELL).toContain('x-model="logForm.endDate"');
  });

  it('perubahan tanggal memicu recalcLogAuto()', () => {
    for (const [name, markup] of [['WorkOrders', WORK_ORDERS], ['app-shell', APP_SHELL]]) {
      const at = markup.indexOf('x-model="logForm.startDate"');
      expect(at, `${name}: input startDate tidak ditemukan`).toBeGreaterThan(-1);
      expect(markup.slice(at, at + 300), `${name}: tidak ada @change recalc`).toContain('recalcLogAuto()');
    }
  });
});

describe('D20 — datetime-local & downtime jam pecahan', () => {
  it('selisih jam pecahan dibulatkan 1 desimal', () => {
    expect(computeDowntimeHours('2026-11-01T08:00', '2026-11-01T08:06')).toBe(0.1);
    expect(computeDowntimeHours('2026-11-01T00:00', '2026-11-02T08:00')).toBe(32);
  });

  it('format lama date-only tetap terbaca sebagai 00:00 lokal', () => {
    expect(computeDowntimeHours('2026-11-01', '2026-11-02')).toBe(24);
    expect(computeDowntimeHours('2026-11-01', '2026-11-03')).toBe(48);
  });

  it('start/end kosong atau undefined -> null, bukan NaN', () => {
    expect(computeDowntimeHours(undefined, '2026-11-01T00:00')).toBeNull();
    expect(computeDowntimeHours('2026-11-01T00:00', undefined)).toBeNull();
    expect(computeDowntimeHours(null, '2026-11-01T00:00')).toBeNull();
  });

  it('start === end -> 0 jam', () => {
    expect(computeDowntimeHours('2026-11-01T08:00', '2026-11-01T08:00')).toBe(0);
  });

  it('recalcLogAuto menulis jam pecahan ke logForm.downtime', () => {
    const ctx = makeCtx({ startDate: '2026-11-01T08:00', endDate: '2026-11-01T08:30' });
    ctx.recalcLogAuto();
    expect(ctx.logForm.downtime).toBe(0.5);
  });

  it('markup: input startDate/endDate bertipe datetime-local', () => {
    for (const [name, markup] of [['WorkOrders', WORK_ORDERS], ['app-shell', APP_SHELL]]) {
      const at = markup.indexOf('x-model="logForm.startDate"');
      expect(at, `${name}: input startDate tidak ditemukan`).toBeGreaterThan(-1);
      const near = markup.slice(Math.max(0, at - 200), at + 200);
      expect(near, `${name}: bukan datetime-local`).toContain('type="datetime-local"');

      const et = markup.indexOf('x-model="logForm.endDate"');
      expect(et, `${name}: input endDate tidak ditemukan`).toBeGreaterThan(-1);
      expect(markup.slice(Math.max(0, et - 200), et + 200), `${name}: end bukan datetime-local`)
        .toContain('type="datetime-local"');
    }
  });
});
