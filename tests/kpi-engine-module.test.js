// @vitest-environment jsdom
/**
 * Unit test untuk `src/js/modules/kpi-engine.js` (kartu C-3 lanjutan, S29).
 *
 * Modul ini murni aritmetika (health score, MTBF, prediksi kegagalan) tapi
 * sebelumnya cuma tersentuh 43,92% karena `tests/utils.test.js` hanya menguji
 * tiga jalur guard. Yang diuji di sini: cache `_kpiCache`, pemilihan interval
 * HM vs kalender, penggabungan event `HistoryLog` + `Performance`, dan semua
 * cabang string hasil `predictNextFailure`.
 *
 * Harness: `Object.create(kpiEngineModule)` per tes — modul ini di-mix ke
 * komponen Alpine dan membaca state lewat `this`, jadi prototype chain memberi
 * isolasi tanpa membekukan getter (spread `{...module}` akan membekukan).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { kpiEngineModule } from '../src/js/modules/kpi-engine.js';

const DAY = 24 * 60 * 60 * 1000;

/** ISO date `n` hari lalu (aman untuk perbandingan 90 hari). */
function daysAgo(n) {
  return new Date(Date.now() - n * DAY).toISOString().split('T')[0];
}

/**
 * Engine baru dengan state bersih. Override diterapkan SETELAH default supaya
 * override tidak menimpa dirinya sendiri.
 */
function makeEngine(overrides = {}) {
  const ctx = Object.create(kpiEngineModule);
  ctx.logs = [];
  ctx.equipment = [];
  ctx.performanceData = [];
  ctx._kpiCache = null;
  for (const [k, v] of Object.entries(overrides)) ctx[k] = v;
  return ctx;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.Alpine;
});

describe('kpi-engine: _raw', () => {
  it('memakai Alpine.raw bila tersedia', () => {
    const raw = { a: 1 };
    const spy = vi.fn(() => raw);
    window.Alpine = { raw: spy };

    expect(makeEngine()._raw(raw)).toBe(raw);
    expect(spy).toHaveBeenCalledWith(raw);
  });

  it('membuka __v_raw tanpa Alpine', () => {
    const inner = [1, 2];
    expect(makeEngine()._raw({ __v_raw: inner })).toBe(inner);
  });

  it('mengembalikan nilai apa adanya bila bukan objek proxy', () => {
    const arr = [1, 2, 3];
    expect(makeEngine()._raw(arr)).toBe(arr);
    expect(makeEngine()._raw(null)).toBe(null);
  });

  it('menyalin array saat Alpine.raw melempar', () => {
    window.Alpine = { raw: () => { throw new Error('proxy mati'); } };
    const arr = [{ id: 1 }];
    const out = makeEngine()._raw(arr);

    expect(out).toEqual(arr);
    expect(out).not.toBe(arr);
  });

  it('mengembalikan objek apa adanya saat unwrap gagal', () => {
    window.Alpine = { raw: () => { throw new Error('proxy mati'); } };
    const obj = { id: 1 };
    expect(makeEngine()._raw(obj)).toBe(obj);
  });
});

describe('kpi-engine: _kpiKey', () => {
  it('menggabungkan panjang logs, equipment, dan suffix', () => {
    const ctx = makeEngine({ logs: [1, 2], equipment: [1] });
    expect(ctx._kpiKey('hEQ1')).toBe('2|1|hEQ1');
  });

  it('memakai string kosong bila logs/equipment/extra tidak ada', () => {
    const ctx = makeEngine({ logs: null, equipment: undefined });
    expect(ctx._kpiKey()).toBe('0|0|');
  });
});

describe('kpi-engine: calculateHealthScore', () => {
  it('mengembalikan default untuk equipId kosong', () => {
    const r = makeEngine().calculateHealthScore('');
    expect(r).toEqual({
      score: 100,
      color: 'text-tac-status-operational',
      status: 'Optimal',
      breakdowns: 0,
    });
  });

  it('mengembalikan default bila equipment bukan array', () => {
    const ctx = makeEngine({ equipment: { rusak: true } });
    expect(ctx.calculateHealthScore('EQ1').score).toBe(100);
  });

  it('mengembalikan default bila aset tidak ditemukan', () => {
    const ctx = makeEngine({ equipment: [{ EquipmentID: 'EQ2' }] });
    expect(ctx.calculateHealthScore('EQ1').status).toBe('Optimal');
  });

  it('memotong 15 poin per breakdown dalam 90 hari dan memberi status Warning', () => {
    const ctx = makeEngine({
      equipment: [{ EquipmentID: 'EQ1', Nama: 'Pompa' }],
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: daysAgo(5) },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: daysAgo(20) },
      ],
    });

    const r = ctx.calculateHealthScore('EQ1');
    expect(r.breakdowns).toBe(2);
    expect(r.score).toBe(70);
    expect(r.status).toBe('Warning');
    expect(r.color).toBe('text-tac-status-repair');
  });

  it('mengabaikan breakdown lebih dari 90 hari, tanpa tanggal, dan log aset lain', () => {
    const ctx = makeEngine({
      equipment: [{ EquipmentID: 'EQ1' }],
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: daysAgo(120) },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown' },
        { EquipmentID: 'EQ2', Jenis: 'Breakdown', Tanggal: daysAgo(1) },
        { EquipmentID: 'EQ1', Jenis: 'Corrective', Tanggal: daysAgo(1) },
        null,
      ],
    });

    expect(ctx.calculateHealthScore('EQ1').breakdowns).toBe(0);
  });

  it('memotong 2 poin per hari PM terlambat', () => {
    const ctx = makeEngine({
      equipment: [{ EquipmentID: 'EQ1', NextPMDate: daysAgo(10) }],
    });

    expect(ctx.calculateHealthScore('EQ1').score).toBe(80);
  });

  it('membatasi denda PM maksimal 30 poin', () => {
    const ctx = makeEngine({
      equipment: [{ EquipmentID: 'EQ1', NextPMDate: daysAgo(60) }],
    });

    expect(ctx.calculateHealthScore('EQ1').score).toBe(70);
  });

  it('tidak mendenda PM yang belum jatuh tempo atau tanggalnya tidak valid', () => {
    const future = makeEngine({
      equipment: [{ EquipmentID: 'EQ1', NextPMDate: daysAgo(-10) }],
    });
    const invalid = makeEngine({
      equipment: [{ EquipmentID: 'EQ1', NextPMDate: 'bukan-tanggal' }],
    });

    expect(future.calculateHealthScore('EQ1').score).toBe(100);
    expect(invalid.calculateHealthScore('EQ1').score).toBe(100);
  });

  it('memotong 10 poin bila MTBF di bawah 168 jam', () => {
    const ctx = makeEngine({
      equipment: [{ EquipmentID: 'EQ1' }],
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: daysAgo(200), HM: 10 },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: daysAgo(190), HM: 20 },
      ],
    });

    const r = ctx.calculateHealthScore('EQ1');
    expect(r.score).toBe(90);
    expect(r.breakdowns).toBe(0);
  });

  it('menjepit skor di 0 dan memberi status Critical', () => {
    const logs = Array.from({ length: 8 }, (_, i) => ({
      EquipmentID: 'EQ1',
      Jenis: 'Breakdown',
      Tanggal: daysAgo(i + 1),
    }));

    const r = makeEngine({ equipment: [{ EquipmentID: 'EQ1' }], logs }).calculateHealthScore('EQ1');
    expect(r.score).toBe(0);
    expect(r.status).toBe('Critical');
    expect(r.color).toBe('text-tac-status-emergency');
  });

  it('memberi status Critical untuk skor <= 50', () => {
    const logs = Array.from({ length: 4 }, (_, i) => ({
      EquipmentID: 'EQ1',
      Jenis: 'Breakdown',
      Tanggal: daysAgo(i + 1),
    }));

    const r = makeEngine({ equipment: [{ EquipmentID: 'EQ1' }], logs }).calculateHealthScore('EQ1');
    // 100 - 4×15 - 10 (MTBF harian < 168 jam)
    expect(r.score).toBe(30);
    expect(r.status).toBe('Critical');
  });

  it('mengembalikan hasil cache bila entri untuk aset itu sudah ada', () => {
    const ctx = makeEngine({ equipment: [{ EquipmentID: 'EQ1' }] });
    const cached = { score: 55, color: 'text-tac-status-repair', status: 'Warning', breakdowns: 3 };
    ctx._kpiCache = { key: ctx._kpiKey('hEQ1'), h: new Map([['EQ1', cached]]), m: new Map() };

    expect(ctx.calculateHealthScore('EQ1')).toBe(cached);
  });

  it('menghitung ulang pada panggilan kedua karena calculateMTBF memakai slot cache yang sama', () => {
    // Catatan perilaku (bukan yang diharapkan): `_kpiCache` hanya punya satu
    // `key`, jadi panggilan calculateMTBF di dalam calculateHealthScore selalu
    // mengganti key ke 'm<id>' dan cache health score tak pernah kena.
    const ctx = makeEngine({ equipment: [{ EquipmentID: 'EQ1' }] });

    const first = ctx.calculateHealthScore('EQ1');
    const second = ctx.calculateHealthScore('EQ1');

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(ctx._kpiCache.key).toBe(ctx._kpiKey('mEQ1'));
  });

  it('membangun ulang cache saat panjang data berubah', () => {
    const ctx = makeEngine({ equipment: [{ EquipmentID: 'EQ1' }] });
    const first = ctx.calculateHealthScore('EQ1');

    ctx.logs = [{ EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: daysAgo(2) }];
    const second = ctx.calculateHealthScore('EQ1');

    expect(second).not.toBe(first);
    expect(second.score).toBe(85);
  });
});

describe('kpi-engine: _hmIntervalHours', () => {
  const ctx = makeEngine();

  it('memakai delta HM bila keduanya > 0', () => {
    expect(ctx._hmIntervalHours({ HM: 100 }, { HM: 250 })).toBe(150);
  });

  it('mengembalikan 0 bila HM mundur', () => {
    expect(ctx._hmIntervalHours({ HM: 250 }, { HM: 100 })).toBe(0);
  });

  it('jatuh ke selisih jam kalender bila HM tidak ada', () => {
    const a = { Tanggal: '2025-01-01T00:00:00Z' };
    const b = { Tanggal: '2025-01-02T12:00:00Z' };
    expect(ctx._hmIntervalHours(a, b)).toBe(36);
  });

  it('mengembalikan 0 untuk tanggal tidak valid atau input kosong', () => {
    expect(ctx._hmIntervalHours({ Tanggal: 'x' }, { Tanggal: 'y' })).toBe(0);
    expect(ctx._hmIntervalHours(null, undefined)).toBe(0);
  });
});

describe('kpi-engine: _breakdownEvents', () => {
  it('mengambil breakdown dari logs dan menormalkan HM', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-02', HM: '42' },
        { EquipmentID: 'EQ1', Jenis: 'Corrective', Tanggal: '2025-01-03' },
        { EquipmentID: 'EQ2', Jenis: 'Breakdown', Tanggal: '2025-01-04' },
      ],
    });

    const out = ctx._breakdownEvents('EQ1');
    expect(out).toEqual([{ Tanggal: '2025-01-02', HM: 42, src: 'log' }]);
  });

  it('memecah record Performance menjadi satu event per kegagalan', () => {
    const ctx = makeEngine({
      performanceData: [
        { equipmentId: 'EQ1', events: [{}, {}, {}], date: '2025-02-01', hm: 500 },
        { EquipmentID: 'EQ1', freq: 2, date: '2025-02-02', hm: 600 },
        { equipmentId: 'EQ1', freq: 0, date: '2025-02-03', hm: 700 },
        { equipmentId: 'EQ2', freq: 5, date: '2025-02-04' },
        null,
      ],
    });

    const out = ctx._breakdownEvents('EQ1');
    expect(out).toHaveLength(5);
    expect(out.filter(e => e.src === 'perf')).toHaveLength(5);
    expect(out.every(e => e.Tanggal)).toBe(true);
  });

  it('mengurutkan event bertanggal secara menaik', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-03-05' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-03-01' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-03-03' },
      ],
    });

    expect(ctx._breakdownEvents('EQ1').map(e => e.Tanggal)).toEqual([
      '2025-03-01',
      '2025-03-03',
      '2025-03-05',
    ]);
  });

  it('berhenti mengurutkan begitu ada event tanpa tanggal', () => {
    // Perilaku apa adanya: comparator mengembalikan 0 kalau salah satu sisi
    // tanpa `Tanggal`, jadi pasangan bertanggal di sekitarnya tidak pernah
    // dibandingkan dan urutannya tetap seperti input.
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-03-05' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-03-01' },
      ],
    });

    const out = ctx._breakdownEvents('EQ1');
    expect(out).toHaveLength(3);
    expect(out.map(e => e.Tanggal)).toEqual(['2025-03-05', undefined, '2025-03-01']);
  });

  it('memakai logs/perf kosong bila state belum siap', () => {
    const ctx = makeEngine({ logs: null, performanceData: null });
    expect(ctx._breakdownEvents('EQ1')).toEqual([]);
  });
});

describe('kpi-engine: calculateMTBF', () => {
  it('mengembalikan 0 untuk equipId kosong', () => {
    expect(makeEngine().calculateMTBF(null)).toBe(0);
  });

  it('mengembalikan 0 bila logs bukan array', () => {
    expect(makeEngine({ logs: null }).calculateMTBF('EQ1')).toBe(0);
  });

  it('mengembalikan 0 bila event kurang dari dua', () => {
    const ctx = makeEngine({
      logs: [{ EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-01', HM: 10 }],
    });
    expect(ctx.calculateMTBF('EQ1')).toBe(0);
  });

  it('memakai delta HM antar breakdown', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-01', HM: 100 },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-09', HM: 268 },
      ],
    });
    expect(ctx.calculateMTBF('EQ1')).toBe('168.0');
  });

  it('merata-ratakan beberapa interval dan jatuh ke kalender tanpa HM', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-01T00:00:00Z' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-02T00:00:00Z' },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-05T00:00:00Z' },
      ],
    });
    // 24 jam lalu 72 jam → rata-rata 48
    expect(ctx.calculateMTBF('EQ1')).toBe('48.0');
  });

  it('memakai cache pada panggilan kedua', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-01', HM: 10 },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-02', HM: 20 },
      ],
    });

    expect(ctx.calculateMTBF('EQ1')).toBe('10.0');
    const cached = ctx.calculateMTBF('EQ1');
    expect(cached).toBe('10.0');
    expect(ctx._kpiCache.m.get('EQ1')).toBe('10.0');
  });

  it('membangun ulang cache saat key berubah', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-01', HM: 10 },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-02', HM: 20 },
      ],
    });
    ctx.calculateMTBF('EQ1');

    ctx.equipment = [{ EquipmentID: 'EQ1' }];
    ctx.calculateMTBF('EQ1');
    expect(ctx._kpiCache.key).toBe(ctx._kpiKey('mEQ1'));
  });
});

describe('kpi-engine: predictNextFailure', () => {
  it('mengembalikan N/A untuk equipId kosong', () => {
    expect(makeEngine().predictNextFailure('')).toBe('N/A');
  });

  it('mengembalikan Insufficient Data bila MTBF 0', () => {
    expect(makeEngine().predictNextFailure('EQ1')).toBe('Insufficient Data');
  });

  it('mengembalikan Insufficient Data bila logs bukan array walau MTBF ter-cache', () => {
    const ctx = makeEngine({ logs: 'rusak' });
    ctx._kpiCache = { key: ctx._kpiKey('mEQ1'), h: new Map(), m: new Map([['EQ1', '50.0']]) };

    expect(ctx.predictNextFailure('EQ1')).toBe('Insufficient Data');
  });

  it('mengembalikan No failures recorded bila MTBF berasal dari Performance saja', () => {
    const ctx = makeEngine({
      performanceData: [
        { equipmentId: 'EQ1', freq: 1, date: '2025-02-01', hm: 10 },
        { equipmentId: 'EQ1', freq: 1, date: '2025-02-03', hm: 60 },
      ],
    });
    expect(ctx.predictNextFailure('EQ1')).toBe('No failures recorded');
  });

  it('mengembalikan No failures recorded bila breakdown tanpa tanggal', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', HM: 10 },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', HM: 20 },
      ],
    });
    expect(ctx.predictNextFailure('EQ1')).toBe('No failures recorded');
  });

  it('mengembalikan Invalid date data untuk tanggal tak terparse', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: 'bukan-tanggal', HM: 10 },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-05', HM: 110 },
      ],
    });
    expect(ctx.predictNextFailure('EQ1')).toBe('Invalid date data');
  });

  it('menambahkan MTBF ke breakdown terakhir', () => {
    const ctx = makeEngine({
      logs: [
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-01', HM: 10 },
        { EquipmentID: 'EQ1', Jenis: 'Breakdown', Tanggal: '2025-01-05', HM: 34 },
      ],
    });

    const expected = new Date(new Date('2025-01-05').getTime() + 24 * 60 * 60 * 1000)
      .toLocaleDateString();
    expect(ctx.predictNextFailure('EQ1')).toBe(expected);
  });
});

describe('kpi-engine: getEquipName', () => {
  it('mengembalikan Unknown Asset untuk id kosong', () => {
    expect(makeEngine().getEquipName('')).toBe('Unknown Asset');
  });

  it('mengembalikan id bila daftar equipment belum siap', () => {
    expect(makeEngine({ equipment: null }).getEquipName('EQ1')).toBe('EQ1');
  });

  it('mencari exact match lebih dulu', () => {
    const ctx = makeEngine({
      equipment: [
        { EquipmentID: 'eq1', Nama: 'Huruf Kecil' },
        { EquipmentID: 'EQ1', Nama: 'Pompa Lumpur' },
      ],
    });
    expect(ctx.getEquipName('EQ1')).toBe('Pompa Lumpur');
  });

  it('jatuh ke pencarian case-insensitive', () => {
    const ctx = makeEngine({ equipment: [{ EquipmentID: 'eq1', Nama: 'Pompa Lumpur' }] });
    expect(ctx.getEquipName('EQ1')).toBe('Pompa Lumpur');
  });

  it('mengembalikan Unknown Asset bila tidak ada yang cocok', () => {
    const ctx = makeEngine({ equipment: [{ EquipmentID: 'EQ9' }, null] });
    expect(ctx.getEquipName('EQ1')).toBe('Unknown Asset');
  });
});
