// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` rentang 1620-1720: `migrateLegacyImages`.
 *
 * Tiga fase yang diuji terpisah:
 * 1. bucket `ImageUploads` (base64 lama) → upload → tulis ulang referensi
 *    di `Equipment.FotoURL` + `HistoryLog.PhotoURLs`, lalu hapus entri bucket.
 * 2. `Equipment.FotoURL` yang masih inline base64.
 * 3. `HistoryLog.PhotoURLs` yang masih inline base64 (array / string JSON).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

const B64 = 'data:image/png;base64,AAAA';
const B64B = 'data:image/jpeg;base64,BBBB';

/**
 * Stub RTDB berbasis path: `window.get(ref)` mengembalikan nilai per path.
 * @param {Record<string, any>} pathMap
 */
function stubDb(pathMap) {
  window.ref = vi.fn((/** @type {any} */ db, /** @type {string} */ path) => ({ path }));
  window.get = vi.fn((/** @type {any} */ r) =>
    Promise.resolve({
      val: () => (r.path in pathMap ? pathMap[r.path] : null),
      exists: () => r.path in pathMap,
    })
  );
  window.update = vi.fn().mockResolvedValue(undefined);
  return { get: window.get, update: window.update };
}

beforeEach(() => {
  stubFirebase();
});

describe('migrateLegacyImages — bucket ImageUploads kosong', () => {
  it('tidak ada ImageUploads: tidak ada update, migrasi 0, tetap lanjut ke Equipment/Logs', async () => {
    const { update } = stubDb({ ImageUploads: null, Equipment: null, HistoryLog: null });
    const s = makeApp({ uploadBase64Image: vi.fn() });

    const res = await s.migrateLegacyImages();

    expect(res).toEqual({ migrated: 0, failed: 0, skipped: 0 });
    expect(update).not.toHaveBeenCalled();
    expect(s.uploadBase64Image).not.toHaveBeenCalled();
    expect(s.showNotification).toHaveBeenCalledWith('Migrated 0 images', 'success');
  });
});

describe('migrateLegacyImages — bucket ImageUploads berisi data', () => {
  it('entri tanpa data base64 dilewati (skipped)', async () => {
    const { update } = stubDb({
      ImageUploads: { a: { data: 'https://cdn/x.png' }, b: { dataUrl: '' } },
      Equipment: null,
      HistoryLog: null,
    });
    const s = makeApp({ uploadBase64Image: vi.fn() });

    const res = await s.migrateLegacyImages();

    expect(res).toEqual({ migrated: 0, failed: 0, skipped: 2 });
    expect(s.uploadBase64Image).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('memetakan Equipment.FotoURL + HistoryLog.PhotoURLs (array & string) lalu menghapus entri bucket', async () => {
    const prefix = B64.slice(0, 100);
    const { update } = stubDb({
      ImageUploads: { u1: { data: B64 } },
      Equipment: {
        'EQ-1': { FotoURL: 'xx' + prefix + 'yy' },
        'EQ-2': { FotoURL: 'https://cdn/other.png' },
      },
      HistoryLog: {
        L1: { PhotoURLs: [B64, 'https://cdn/keep.png'] },
        L2: { PhotoURLs: JSON.stringify([B64]) },
        L3: { PhotoURLs: ['https://cdn/none.png'] },
      },
    });
    const s = makeApp({ uploadBase64Image: vi.fn().mockResolvedValue('https://cdn/new.png') });

    const res = await s.migrateLegacyImages();

    // 1 dari bucket + 2 dari fase HistoryLog (L1 & L2 masih memuat base64 di map stub)
    expect(res).toEqual({ migrated: 3, failed: 0, skipped: 0 });
    const payload = update.mock.calls[0][1];
    expect(payload['Equipment/EQ-1/FotoURL']).toBe('https://cdn/new.png');
    expect(payload['Equipment/EQ-2/FotoURL']).toBeUndefined();
    expect(payload['HistoryLog/L1/PhotoURLs']).toEqual(['https://cdn/new.png', 'https://cdn/keep.png']);
    expect(payload['HistoryLog/L2/PhotoURLs']).toEqual(['https://cdn/new.png']);
    expect(payload['HistoryLog/L3/PhotoURLs']).toBeUndefined();
    expect(payload['ImageUploads/u1']).toBeNull();
  });

  it('upload melempar → failed bertambah, update tidak dipanggil', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { update } = stubDb({
      ImageUploads: { u1: { data: B64 } },
      Equipment: null,
      HistoryLog: null,
    });
    const s = makeApp({ uploadBase64Image: vi.fn().mockRejectedValue(new Error('boom')) });

    const res = await s.migrateLegacyImages();

    expect(res).toEqual({ migrated: 0, failed: 1, skipped: 0 });
    expect(update).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('upload mengembalikan null → dianggap gagal (throw internal)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubDb({ ImageUploads: { u1: { dataUrl: B64 } }, Equipment: null, HistoryLog: null });
    const s = makeApp({ uploadBase64Image: vi.fn().mockResolvedValue(null) });

    const res = await s.migrateLegacyImages();

    expect(res.failed).toBe(1);
    expect(res.migrated).toBe(0);
    err.mockRestore();
  });
});

describe('migrateLegacyImages — Equipment.FotoURL inline base64', () => {
  it('inline base64 diunggah dan ditulis balik per equipment', async () => {
    const { update } = stubDb({
      ImageUploads: null,
      Equipment: { 'EQ-9': { FotoURL: B64B }, 'EQ-10': { FotoURL: 'https://cdn/ok.png' } },
      HistoryLog: null,
    });
    const s = makeApp({ uploadBase64Image: vi.fn().mockResolvedValue('https://cdn/eq9.png') });

    const res = await s.migrateLegacyImages();

    expect(res).toEqual({ migrated: 1, failed: 0, skipped: 0 });
    expect(update).toHaveBeenCalledWith(expect.anything(), { 'Equipment/EQ-9/FotoURL': 'https://cdn/eq9.png' });
  });

  it('upload Equipment gagal → failed bertambah, tidak ada update', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { update } = stubDb({
      ImageUploads: null,
      Equipment: { 'EQ-9': { FotoURL: B64 } },
      HistoryLog: null,
    });
    const s = makeApp({ uploadBase64Image: vi.fn().mockRejectedValue(new Error('nope')) });

    const res = await s.migrateLegacyImages();

    expect(res.failed).toBe(1);
    expect(update).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('migrateLegacyImages — HistoryLog.PhotoURLs inline base64', () => {
  it('array campuran: yang berhasil diganti URL, yang gagal dipertahankan, non-string tetap', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { update } = stubDb({
      ImageUploads: null,
      Equipment: null,
      HistoryLog: {
        L1: { PhotoURLs: [B64, B64B, 'https://cdn/keep.png', 42] },
      },
    });
    const upload = vi
      .fn()
      .mockResolvedValueOnce('https://cdn/one.png')
      .mockRejectedValueOnce(new Error('fail'));
    const s = makeApp({ uploadBase64Image: upload });

    const res = await s.migrateLegacyImages();

    expect(res.migrated).toBe(1);
    expect(res.failed).toBe(1);
    expect(update).toHaveBeenCalledWith(expect.anything(), {
      'HistoryLog/L1/PhotoURLs': ['https://cdn/one.png', B64B, 'https://cdn/keep.png', 42],
    });
    err.mockRestore();
  });

  it('PhotoURLs berupa string JSON di-parse; string rusak jadi array kosong', async () => {
    const { update } = stubDb({
      ImageUploads: null,
      Equipment: null,
      HistoryLog: {
        L1: { PhotoURLs: JSON.stringify([B64]) },
        L2: { PhotoURLs: '{bukan json' },
        L3: { PhotoURLs: 7 },
      },
    });
    const s = makeApp({ uploadBase64Image: vi.fn().mockResolvedValue('https://cdn/one.png') });

    const res = await s.migrateLegacyImages();

    expect(res.migrated).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.anything(), {
      'HistoryLog/L1/PhotoURLs': ['https://cdn/one.png'],
    });
  });

  it('upload balik null pada log → failed, URL asli dipertahankan', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { update } = stubDb({
      ImageUploads: null,
      Equipment: null,
      HistoryLog: { L1: { PhotoURLs: [B64] } },
    });
    const s = makeApp({ uploadBase64Image: vi.fn().mockResolvedValue(null) });

    const res = await s.migrateLegacyImages();

    expect(res.failed).toBe(1);
    expect(update).toHaveBeenCalledWith(expect.anything(), { 'HistoryLog/L1/PhotoURLs': [B64] });
    err.mockRestore();
  });
});
