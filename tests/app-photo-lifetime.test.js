// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeApp } from './helpers/app-harness.js';
import { calculatePartLifetime, getLifetimeColor, getLifetimeBgColor } from '../src/js/utils.js';

let urlSeq = 0;

beforeEach(() => {
  urlSeq = 0;
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:mock-${++urlSeq}`),
    revokeObjectURL: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.Cropper;
  delete window.Cropper;
  document.getElementById('cropImage')?.remove();
  document.head.querySelectorAll('script[src*="cropperjs"], link[href*="cropperjs"]').forEach(n => n.remove());
});

/** State dengan $nextTick sinkron supaya jalur crop bisa diuji tanpa Alpine. */
function appWithTick(overrides = {}) {
  return makeApp({ $nextTick: (fn) => fn(), ...overrides });
}

function mountCropImage() {
  const img = document.createElement('img');
  img.id = 'cropImage';
  document.body.appendChild(img);
  return img;
}

describe('app.js: lifetime helpers', () => {
  it('getPartLifetimeInfo null untuk part kosong', () => {
    const s = makeApp();
    expect(s.getPartLifetimeInfo(null)).toBe(null);
  });

  it('getPartLifetimeInfo meneruskan ke calculatePartLifetime', () => {
    const s = makeApp();
    const part = { lastReplaceDate: '2026-09-01', avgLifetimeDays: 30 };
    expect(s.getPartLifetimeInfo(part)).toEqual(
      calculatePartLifetime(part.lastReplaceDate, part.avgLifetimeDays),
    );
  });

  it('getLifetimeColorLabel dan getLifetimeBgColorLabel meneruskan status ke utils', () => {
    const s = makeApp();
    for (const status of ['ok', 'warning', 'critical', 'unknown']) {
      expect(s.getLifetimeColorLabel(status)).toBe(getLifetimeColor(status));
      expect(s.getLifetimeBgColorLabel(status)).toBe(getLifetimeBgColor(status));
    }
  });

  it('getPartStock mengembalikan 0 untuk input kosong atau part tak dikenal', () => {
    const s = makeApp();
    expect(s.getPartStock('')).toBe(0);
    s.allParts = null;
    expect(s.getPartStock('P1')).toBe(0);
    s.allParts = [];
    expect(s.getPartStock('P1')).toBe(0);
  });

  it('getPartStock mengubah Stok jadi angka dan menoleransi nilai rusak', () => {
    const s = makeApp();
    s.allParts = [{ PartID: 'P1', Stok: '12' }, { PartID: 'P2', Stok: 'abc' }, { PartID: 'P3' }];
    expect(s.getPartStock('P1')).toBe(12);
    expect(s.getPartStock('P2')).toBe(0);
    expect(s.getPartStock('P3')).toBe(0);
  });
});

describe('app.js: crop modal', () => {
  it('showCropModal menyimpan src + callback lalu membuka modal', () => {
    const s = appWithTick();
    const cb = vi.fn();
    s.showCropModal('blob:img', cb);
    expect(s.cropImageSrc).toBe('blob:img');
    expect(s.cropCallback).toBe(cb);
    expect(s.showCropModalOpen).toBe(true);
  });

  it('showCropModal tidak melakukan apa pun saat elemen #cropImage belum ada', () => {
    const s = appWithTick();
    globalThis.Cropper = vi.fn();
    s.showCropModal('blob:img', vi.fn());
    expect(globalThis.Cropper).not.toHaveBeenCalled();
  });

  it('showCropModal memakai Cropper yang sudah tersedia dan menghancurkan instance lama', () => {
    mountCropImage();
    const destroy = vi.fn();
    globalThis.Cropper = vi.fn(function () { return { destroy }; });
    window.Cropper = globalThis.Cropper;
    const s = appWithTick();
    s._cropper = { destroy };
    s.showCropModal('blob:img', vi.fn());
    expect(destroy).toHaveBeenCalled();
    expect(globalThis.Cropper).toHaveBeenCalledTimes(1);
    expect(s._cropper).toBeTruthy();
  });

  it('showCropModal memuat CSS + script cropperjs lalu membuat instance saat onload', () => {
    mountCropImage();
    const s = appWithTick();
    s.showCropModal('blob:img', vi.fn());
    const script = document.head.querySelector('script[src*="cropperjs"]');
    expect(script).toBeTruthy();
    expect(document.head.querySelector('link[href*="cropperjs"]')).toBeTruthy();
    globalThis.Cropper = vi.fn(function () { return { destroy: vi.fn() }; });
    script.onload();
    expect(globalThis.Cropper).toHaveBeenCalledTimes(1);
  });

  it('showCropModal menutup modal + memberi notifikasi saat script gagal dimuat', () => {
    mountCropImage();
    const s = appWithTick();
    s.showCropModal('blob:img', vi.fn());
    document.head.querySelector('script[src*="cropperjs"]').onerror();
    expect(s.showCropModalOpen).toBe(false);
    expect(s.showNotification).toHaveBeenCalledWith('Failed to load image editor', 'error');
  });

  it('applyCrop tidak melakukan apa pun tanpa instance cropper', () => {
    const s = makeApp();
    s.applyCrop();
    expect(s.showCropModalOpen).toBe(false);
  });

  it('applyCrop memanggil callback dengan blob lalu membersihkan state', () => {
    const s = makeApp();
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const destroy = vi.fn();
    const cb = vi.fn();
    s._cropper = { getCroppedCanvas: () => ({ toBlob: (fn, type, q) => { expect(type).toBe('image/jpeg'); expect(q).toBe(0.92); fn(blob); } }), destroy };
    s.cropCallback = cb;
    s.showCropModalOpen = true;
    s.applyCrop();
    expect(cb).toHaveBeenCalledWith(blob);
    expect(destroy).toHaveBeenCalled();
    expect(s._cropper).toBe(null);
    expect(s.showCropModalOpen).toBe(false);
  });
});

describe('app.js: handleLogPhotoDrop', () => {
  const imgFile = (name = 'a.jpg') => new File(['x'], name, { type: 'image/jpeg' });

  it('mengabaikan file non-image', () => {
    const s = makeApp();
    s.logForm = { photos: [] };
    s.handleLogPhotoDrop(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    s.handleLogPhotoDrop(null);
    expect(s.logForm.photos).toEqual([]);
  });

  it('menolak saat kuota 4 foto sudah penuh', () => {
    const s = makeApp();
    s.logForm = { photos: [1, 2, 3, 4] };
    s.handleLogPhotoDrop(imgFile());
    expect(s.showNotification).toHaveBeenCalledWith('Max 4 photos', 'error');
  });

  it('membuka crop modal dan menambahkan hasil crop ke logForm.photos', () => {
    const s = makeApp();
    s.logForm = { photos: [] };
    const spy = vi.fn();
    s.showCropModal = spy;
    s.handleLogPhotoDrop(imgFile());
    expect(spy).toHaveBeenCalled();
    const [src, cb] = spy.mock.calls[0];
    expect(src).toMatch(/^blob:mock-/);

    const cropped = new Blob(['y'], { type: 'image/jpeg' });
    cb(cropped);
    expect(s.logForm.photos).toHaveLength(1);
    expect(s.logForm.photos[0].file).toBe(cropped);
    expect(s.logForm.photos[0].base64).toBe(null);
    expect(s.logForm.photos[0].preview).toMatch(/^blob:mock-/);
  });

  it('membuat array photos bila belum ada dan berhenti saat kuota penuh di callback', () => {
    const s = makeApp();
    s.logForm = {};
    const spy = vi.fn();
    s.showCropModal = spy;
    s.handleLogPhotoDrop(imgFile());
    const [, cb] = spy.mock.calls[0];
    s.logForm.photos = [1, 2, 3, 4];
    cb(new Blob(['y']));
    expect(s.logForm.photos).toHaveLength(4);
  });
});
