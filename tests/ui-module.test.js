// @vitest-environment jsdom
/**
 * Unit test untuk sisa `src/js/modules/ui.js` (S30).
 *
 * `tests/ui-qr.test.js` sudah menutup jalur QR (generateQR/downloadQR/
 * downloadAllQRs/handleScanResult/submitManualScan). Berkas ini menutup sisanya:
 * tema, notifikasi + timer, scanner kamera, helper warna, kompresi gambar,
 * upload Cloudinary, dan `systemReset`.
 *
 * Catatan pola (lihat HANDOFF S30 §4):
 *  - `vi.mock` di-hoist → state yang dipakai factory harus lewat `vi.hoisted`.
 *  - `window.location.reload` tidak bisa di-`spyOn` (properti non-configurable
 *    per-anak), tapi `window.location` sendiri configurable → ganti objeknya.
 *  - `img.onload` dipasang SETELAH `img.src = …`, jadi setter `src` harus
 *    menunda callback ke microtask supaya handler sempat terpasang.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { qrState } = vi.hoisted(() => ({
  qrState: { failCtor: false, failStart: false, instances: [] },
}));

const { qrEncode } = vi.hoisted(() => ({ qrEncode: { fail: false } }));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (text) => {
      if (qrEncode.fail) throw new Error('encoding failed');
      return `data:image/png;base64,MOCK:${text}`;
    }),
  },
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor(id) {
      if (qrState.failCtor) throw new Error('camera unavailable');
      this.id = id;
      this.start = vi.fn(async () => {
        if (qrState.failStart) throw new Error('start rejected');
      });
      this.stop = vi.fn(async () => {});
      qrState.instances.push(this);
    }
  },
}));

vi.mock('../src/js/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { uiModule } from '../src/js/modules/ui.js';

const REAL_LOCATION = window.location;

/** ctx minimum; override diterapkan SETELAH default supaya tidak tertimpa. */
function makeCtx(overrides = {}) {
  return Object.assign(
    {
      themeMode: 'night',
      darkMode: false,
      notifications: [],
      isLoading: false,
      showScanner: false,
      manualScanId: '',
      html5QrCode: null,
      equipment: [],
      showNotification: vi.fn(),
      applyTheme: vi.fn(),
    },
    overrides
  );
}

beforeEach(() => {
  qrState.failCtor = false;
  qrState.failStart = false;
  qrState.instances.length = 0;
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', {
    value: REAL_LOCATION,
    configurable: true,
    writable: true,
  });
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
});

// ─────────────────────────────────────────────────────────────── tema
describe('ui — setTheme / applyTheme', () => {
  it('setTheme menyimpan tema valid ke localStorage lalu menerapkannya', () => {
    const ctx = makeCtx();
    uiModule.setTheme.call(ctx, 'light');
    expect(ctx.themeMode).toBe('light');
    expect(localStorage.getItem('themeMode')).toBe('light');
    expect(ctx.applyTheme).toHaveBeenCalledTimes(1);
  });

  it('setTheme menjatuhkan tema tak dikenal ke night', () => {
    const ctx = makeCtx({ themeMode: 'light' });
    uiModule.setTheme.call(ctx, 'neon');
    expect(ctx.themeMode).toBe('night');
    expect(localStorage.getItem('themeMode')).toBe('night');
  });

  it('applyTheme: night → atribut dark + kelas dark + darkMode true', () => {
    const ctx = makeCtx({ themeMode: 'night' });
    uiModule.applyTheme.call(ctx);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(ctx.darkMode).toBe(true);
  });

  it('applyTheme: navy → atribut navy, tetap gelap', () => {
    const ctx = makeCtx({ themeMode: 'navy' });
    uiModule.applyTheme.call(ctx);
    expect(document.documentElement.getAttribute('data-theme')).toBe('navy');
    expect(ctx.darkMode).toBe(true);
  });

  it('applyTheme: light → atribut light, kelas dark dilepas', () => {
    document.documentElement.classList.add('dark');
    const ctx = makeCtx({ themeMode: 'light' });
    uiModule.applyTheme.call(ctx);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(ctx.darkMode).toBe(false);
  });
});

// ─────────────────────────────────────────────────────── notifikasi
describe('ui — showNotification', () => {
  it('mendorong notifikasi dengan konfigurasi per tipe', () => {
    const ctx = makeCtx();
    uiModule.showNotification.call(ctx, 'Saved', 'error', 100);
    expect(ctx.notifications).toHaveLength(1);
    const n = ctx.notifications[0];
    expect(n).toMatchObject({
      message: 'Saved',
      type: 'error',
      icon: 'error',
      exiting: false,
      progress: 100,
      _duration: 100,
    });
    expect(n.bar).toContain('bg-tac-status-emergency');
    expect(n.glow).toContain('shadow-tac-status-emergency');
  });

  it('tipe tak dikenal memakai konfigurasi info', () => {
    const ctx = makeCtx();
    uiModule.showNotification.call(ctx, 'note', 'bogus', 100);
    expect(ctx.notifications[0].icon).toBe('info');
    expect(ctx.notifications[0].type).toBe('bogus');
  });

  it('durasi default 4500 ms saat argumen ketiga dihilangkan', () => {
    const ctx = makeCtx();
    uiModule.showNotification.call(ctx, 'hello');
    expect(ctx.notifications[0]._duration).toBe(4500);
    expect(ctx.notifications[0].type).toBe('success');
  });

  it('progress menyusut lalu notifikasi ditandai exiting dan dibuang', () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    uiModule.showNotification.call(ctx, 'tick', 'success', 200);

    vi.advanceTimersByTime(100);
    expect(ctx.notifications[0].progress).toBeCloseTo(50, 5);

    vi.advanceTimersByTime(100);
    expect(ctx.notifications[0].exiting).toBe(true);

    vi.advanceTimersByTime(400);
    expect(ctx.notifications).toHaveLength(0);
  });

  it('interval berhenti saat notifikasi hilang dari daftar', () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    uiModule.showNotification.call(ctx, 'gone', 'info', 1000);
    ctx.notifications.length = 0;
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
    expect(ctx.notifications).toHaveLength(0);
  });

  it('interval berhenti saat notifikasi sedang exiting', () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    uiModule.showNotification.call(ctx, 'exit', 'info', 1000);
    ctx.notifications[0].exiting = true;
    vi.advanceTimersByTime(200);
    expect(ctx.notifications[0].progress).toBe(100);
  });

  it('auto-remove tidak melakukan apa pun bila notifikasi sudah dibuang', () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    uiModule.showNotification.call(ctx, 'vanished', 'info', 100);
    ctx.notifications.length = 0;
    vi.advanceTimersByTime(100);
    expect(ctx.notifications).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────── kamera / QR
describe('ui — openQR / stopScanner', () => {
  it('openQR membuka scanner, membuat Html5Qrcode, dan meneruskan hasil decode', async () => {
    const ctx = makeCtx({ manualScanId: 'stale' });
    let pending;
    ctx.$nextTick = (cb) => {
      pending = cb();
    };
    ctx.handleScanResult = vi.fn();

    await uiModule.openQR.call(ctx);
    expect(ctx.showScanner).toBe(true);
    expect(ctx.manualScanId).toBe('');
    await pending;

    const inst = qrState.instances[0];
    expect(inst.id).toBe('reader');
    expect(ctx.html5QrCode).toBe(inst);
    expect(inst.start).toHaveBeenCalledTimes(1);

    const [camera, config, onDecoded, onError] = inst.start.mock.calls[0];
    expect(camera).toEqual({ facingMode: 'environment' });
    expect(config).toEqual({ fps: 10, qrbox: { width: 250, height: 250 } });
    onDecoded('EQ-9');
    expect(ctx.handleScanResult).toHaveBeenCalledWith('EQ-9');
    expect(() => onError('scan failed')).not.toThrow();
  });

  it('openQR menutup scanner + notifikasi error saat kamera tak bisa dibuat', async () => {
    qrState.failCtor = true;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx();
    let pending;
    ctx.$nextTick = (cb) => {
      pending = cb();
    };

    await uiModule.openQR.call(ctx);
    await pending;

    expect(ctx.showScanner).toBe(false);
    expect(ctx.showNotification).toHaveBeenCalledWith('Failed to access camera', 'error');
    expect(errSpy).toHaveBeenCalled();
  });

  it('openQR menangkap penolakan dari start()', async () => {
    qrState.failStart = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx();
    let pending;
    ctx.$nextTick = (cb) => {
      pending = cb();
    };

    await uiModule.openQR.call(ctx);
    await pending;

    expect(ctx.showNotification).toHaveBeenCalledWith('Failed to access camera', 'error');
    expect(ctx.showScanner).toBe(false);
  });

  it('stopScanner tanpa instance hanya menutup panel', async () => {
    const ctx = makeCtx({ showScanner: true, html5QrCode: null });
    await uiModule.stopScanner.call(ctx);
    expect(ctx.showScanner).toBe(false);
    expect(ctx.html5QrCode).toBeNull();
  });

  it('stopScanner menghentikan stream lalu melepas instance', async () => {
    const stop = vi.fn(async () => {});
    const ctx = makeCtx({ showScanner: true, html5QrCode: { stop } });
    await uiModule.stopScanner.call(ctx);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(ctx.html5QrCode).toBeNull();
    expect(ctx.showScanner).toBe(false);
  });

  it('stopScanner tetap menutup panel saat stop() melempar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inst = {
      stop: vi.fn(async () => {
        throw new Error('not running');
      }),
    };
    const ctx = makeCtx({ showScanner: true, html5QrCode: inst });
    await uiModule.stopScanner.call(ctx);
    expect(warn).toHaveBeenCalled();
    expect(ctx.html5QrCode).toBe(inst);
    expect(ctx.showScanner).toBe(false);
  });
});

describe('ui — generateQR (jalur gagal)', () => {
  it('encoder melempar → notifikasi error, modal tidak dibuka, isLoading balik false', async () => {
    qrEncode.fail = true;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx();
    try {
      await uiModule.generateQR.call(ctx, 'EQ-1');
      expect(ctx.showQRPreviewModal).toBeUndefined();
      expect(ctx.showNotification).toHaveBeenCalledWith('Failed to generate QR Code', 'error');
      expect(ctx.isLoading).toBe(false);
      expect(errSpy).toHaveBeenCalled();
    } finally {
      qrEncode.fail = false;
    }
  });

  it('encoder sukses menyimpan data URL ke state', async () => {
    const ctx = makeCtx();
    await uiModule.generateQR.call(ctx, 'EQ-7');
    expect(ctx.qrCodeDataUrl).toContain('equip=EQ-7');
    expect(ctx.showQRPreviewModal).toBe(true);
    expect(ctx.isLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────── helper warna
describe('ui — helper warna', () => {
  it('statusColor memetakan tiga status dan fallback emergency', () => {
    expect(uiModule.statusColor('Active')).toContain('text-tac-status-operational');
    expect(uiModule.statusColor('In Maintenance')).toContain('text-tac-status-repair');
    expect(uiModule.statusColor('Decommissioned')).toContain('text-tac-status-standby');
    expect(uiModule.statusColor('Ghost')).toContain('text-tac-status-emergency');
  });

  it('critColor: High / Medium / lainnya', () => {
    expect(uiModule.critColor('High')).toBe('text-tac-status-emergency font-bold');
    expect(uiModule.critColor('Medium')).toBe('text-tac-status-repair');
    expect(uiModule.critColor('Low')).toBe('text-tac-status-operational');
    expect(uiModule.critColor(undefined)).toBe('text-tac-status-operational');
  });

  it('logColor memetakan tipe log dan fallback sync-cyan', () => {
    expect(uiModule.logColor('PM')).toBe('border-tac-status-operational');
    expect(uiModule.logColor('Repair')).toBe('border-tac-sync-cyan');
    expect(uiModule.logColor('Inspection')).toBe('border-tac-status-repair');
    expect(uiModule.logColor('Breakdown')).toBe('border-tac-status-emergency');
    expect(uiModule.logColor('Other')).toBe('border-tac-sync-cyan');
  });

  it('logStatusColor memetakan semua status dan fallback operational', () => {
    expect(uiModule.logStatusColor('Completed')).toContain('text-tac-status-operational');
    expect(uiModule.logStatusColor('In Progress')).toContain('text-tac-sync-cyan');
    expect(uiModule.logStatusColor('Pending')).toContain('text-tac-status-repair');
    expect(uiModule.logStatusColor('Cancelled')).toContain('text-tac-status-standby');
    expect(uiModule.logStatusColor('Approved')).toContain('text-tac-status-operational');
    expect(uiModule.logStatusColor('Draft')).toContain('bg-tac-surface-container-low');
    expect(uiModule.logStatusColor('Unknown')).toContain('text-tac-status-operational');
  });

  it('woPriorityColor memetakan prioritas dan fallback standby', () => {
    expect(uiModule.woPriorityColor('Emergency')).toContain('text-tac-status-emergency');
    expect(uiModule.woPriorityColor('Urgent')).toContain('text-tac-status-repair');
    expect(uiModule.woPriorityColor('Normal')).toContain('text-tac-sync-cyan');
    expect(uiModule.woPriorityColor('Planned')).toContain('text-tac-status-operational');
    expect(uiModule.woPriorityColor('Later')).toBe('border-tac-status-standby/20 text-tac-status-standby');
  });

  it('getStatColor memetakan kelas border ke token CSS dan fallback gold', () => {
    expect(uiModule.getStatColor('border-tac-status-operational')).toBe('rgb(var(--tac-status-operational))');
    expect(uiModule.getStatColor('border-tac-status-repair')).toBe('rgb(var(--tac-status-repair))');
    expect(uiModule.getStatColor('border-tac-status-emergency')).toBe('rgb(var(--tac-status-emergency))');
    expect(uiModule.getStatColor('border-tac-status-standby')).toBe('rgb(var(--tac-status-standby))');
    expect(uiModule.getStatColor('border-tac-sync-cyan')).toBe('rgb(var(--tac-sync-cyan))');
    expect(uiModule.getStatColor('border-tac-secondary')).toBe('rgb(var(--tac-secondary))');
    expect(uiModule.getStatColor('border-unknown')).toBe('rgb(var(--tac-gold-bright))');
  });
});

// ─────────────────────────────────────────────────── kompresi gambar
/** FileReader palsu; callback ditunda ke microtask karena `onload` dipasang setelah `readAsDataURL`. */
function stubFileReader({ fail = false } = {}) {
  class FakeFileReader {
    readAsDataURL() {
      queueMicrotask(() => {
        if (fail) {
          this.onerror && this.onerror();
          return;
        }
        this.result = 'data:image/png;base64,AAAA';
        this.onload && this.onload({ target: { result: this.result } });
      });
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader);
}

/** `Image` palsu; callback ditunda ke microtask karena `onload` dipasang setelah `src`. */
function stubImage({ w = 1000, h = 500, fail = false } = {}) {
  class FakeImage {
    constructor() {
      this.width = w;
      this.height = h;
    }
    set src(v) {
      this._src = v;
      queueMicrotask(() => {
        if (fail) this.onerror && this.onerror();
        else this.onload && this.onload();
      });
    }
    get src() {
      return this._src;
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

function stubCanvas() {
  const drawImage = vi.fn();
  const toBlob = vi.fn(function (cb) {
    cb(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob);
  return { drawImage, toBlob };
}

describe('ui — compressImage', () => {
  it('file kosong / null langsung menghasilkan null', async () => {
    expect(await uiModule.compressImage.call(makeCtx(), null)).toBeNull();
    expect(await uiModule.compressImage.call(makeCtx(), { size: 0 })).toBeNull();
  });

  it('landscape melebihi batas diskalakan ke MAX_IMAGE_SIZE (600)', async () => {
    stubFileReader();
    stubImage({ w: 1200, h: 600 });
    const { drawImage, toBlob } = stubCanvas();
    const blob = await uiModule.compressImage.call(makeCtx(), { size: 10 });
    expect(blob).toBeInstanceOf(Blob);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 600, 300);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.5);
  });

  it('landscape di bawah batas dibiarkan apa adanya', async () => {
    stubFileReader();
    stubImage({ w: 500, h: 250 });
    const { drawImage } = stubCanvas();
    await uiModule.compressImage.call(makeCtx(), { size: 10 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 500, 250);
  });

  it('portrait melebihi batas diskalakan pada sisi tinggi', async () => {
    stubFileReader();
    stubImage({ w: 300, h: 1200 });
    const { drawImage } = stubCanvas();
    await uiModule.compressImage.call(makeCtx(), { size: 10 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 150, 600);
  });

  it('portrait di bawah batas dibiarkan apa adanya', async () => {
    stubFileReader();
    stubImage({ w: 200, h: 400 });
    const { drawImage } = stubCanvas();
    await uiModule.compressImage.call(makeCtx(), { size: 10 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 200, 400);
  });

  it('gambar gagal dimuat → null', async () => {
    stubFileReader();
    stubImage({ fail: true });
    stubCanvas();
    expect(await uiModule.compressImage.call(makeCtx(), { size: 10 })).toBeNull();
  });

  it('pembacaan file gagal → null', async () => {
    stubFileReader({ fail: true });
    stubImage();
    stubCanvas();
    expect(await uiModule.compressImage.call(makeCtx(), { size: 10 })).toBeNull();
  });
});

// ─────────────────────────────────────────────────── upload Cloudinary
describe('ui — uploadBase64Image', () => {
  it('base64 kosong → null tanpa fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await uiModule.uploadBase64Image.call(makeCtx(), '')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('unggahan sukses mengembalikan secure_url', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secure_url: 'https://cdn.test/img.jpg' }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const url = await uiModule.uploadBase64Image.call(makeCtx(), 'data:image/jpeg;base64,AA');
    expect(url).toBe('https://cdn.test/img.jpg');

    const [endpoint, opts] = fetchSpy.mock.calls[0];
    expect(endpoint).toBe('https://api.cloudinary.com/v1_1/g3lkh1pu/image/upload');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get('upload_preset')).toBe('mtc-asset-unsigned');
    expect(opts.body.get('file')).toBe('data:image/jpeg;base64,AA');
  });

  it('respons tanpa secure_url → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    expect(await uiModule.uploadBase64Image.call(makeCtx(), 'data:x')).toBeNull();
  });

  it('HTTP gagal → null + pesan error dari body', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'preset not found' } }),
      }))
    );
    expect(await uiModule.uploadBase64Image.call(makeCtx(), 'data:x')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[Cloudinary] upload failed:', 'preset not found');
  });

  it('HTTP gagal tanpa body error → pesan memakai status', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    expect(await uiModule.uploadBase64Image.call(makeCtx(), 'data:x')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[Cloudinary] upload failed:', 'HTTP 500');
  });

  it('jaringan melempar → null + peringatan network error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    expect(await uiModule.uploadBase64Image.call(makeCtx(), 'data:x')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[Cloudinary] network error:', 'offline');
  });
});

// ───────────────────────────────────────────────────── uploadImage
describe('ui — uploadImage', () => {
  it('tanpa file → null dan tidak ada notifikasi', async () => {
    const ctx = makeCtx();
    expect(await uiModule.uploadImage.call(ctx, null)).toBeNull();
    expect(ctx.showNotification).not.toHaveBeenCalled();
  });

  it('kompresi → base64 → upload, mengembalikan URL', async () => {
    const blob = new Blob(['x']);
    const ctx = makeCtx({
      compressImage: vi.fn(async () => blob),
      blobToBase64: vi.fn(async () => 'data:image/jpeg;base64,ZZ'),
      uploadBase64Image: vi.fn(async () => 'https://cdn.test/ok.jpg'),
    });
    const url = await uiModule.uploadImage.call(ctx, { name: 'a.png', size: 42 });
    expect(url).toBe('https://cdn.test/ok.jpg');
    expect(ctx.blobToBase64).toHaveBeenCalledWith(blob);
    expect(ctx.uploadBase64Image).toHaveBeenCalledWith('data:image/jpeg;base64,ZZ');
    expect(ctx.showNotification).toHaveBeenNthCalledWith(1, 'Uploading image...', 'info');
    expect(ctx.showNotification).toHaveBeenCalledWith('Image uploaded successfully', 'success');
  });

  it('kompresi gagal → notifikasi error dan null', async () => {
    const ctx = makeCtx({ compressImage: vi.fn(async () => null) });
    expect(await uiModule.uploadImage.call(ctx, { name: 'a.png', size: 42 })).toBeNull();
    expect(ctx.showNotification).toHaveBeenCalledWith('Image compression failed', 'error');
  });

  it('upload ditolak → notifikasi error dan null (tanpa fallback base64)', async () => {
    const ctx = makeCtx({
      compressImage: vi.fn(async () => new Blob(['x'])),
      blobToBase64: vi.fn(async () => 'data:x'),
      uploadBase64Image: vi.fn(async () => null),
    });
    expect(await uiModule.uploadImage.call(ctx, { name: 'a.png', size: 42 })).toBeNull();
    expect(ctx.showNotification).toHaveBeenCalledWith('Image upload failed — coba lagi', 'error');
  });

  it('exception di tengah jalan → notifikasi warning dan null', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx({
      compressImage: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    expect(await uiModule.uploadImage.call(ctx, { name: 'a.png', size: 42 })).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    expect(ctx.showNotification).toHaveBeenCalledWith(
      'Image upload failed - will save without image',
      'warning'
    );
  });
});

// ──────────────────────────────────────────────────── blobToBase64
describe('ui — blobToBase64', () => {
  it('blob kosong → string kosong', async () => {
    expect(await uiModule.blobToBase64.call(makeCtx(), null)).toBe('');
  });

  it('membaca blob menjadi data URL', async () => {
    class FakeFileReader {
      readAsDataURL() {
        queueMicrotask(() => {
          this.result = 'data:image/jpeg;base64,QQ';
          this.onloadend && this.onloadend();
        });
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);
    expect(await uiModule.blobToBase64.call(makeCtx(), new Blob(['q']))).toBe(
      'data:image/jpeg;base64,QQ'
    );
  });

  it('pembacaan gagal → string kosong', async () => {
    class FakeFileReader {
      readAsDataURL() {
        queueMicrotask(() => {
          this.onerror && this.onerror();
        });
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);
    expect(await uiModule.blobToBase64.call(makeCtx(), new Blob(['q']))).toBe('');
  });
});

// ───────────────────────────────────────────────────── systemReset
describe('ui — systemReset', () => {
  function stubLocation() {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload },
      configurable: true,
      writable: true,
    });
    return reload;
  }

  it('dibatalkan saat konfirmasi ditolak', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const ctx = makeCtx();
    await uiModule.systemReset.call(ctx);
    expect(ctx.isLoading).toBe(false);
    expect(ctx.showNotification).not.toHaveBeenCalled();
  });

  it('membersihkan storage lalu reload setelah 1,5 detik', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('confirm', vi.fn(() => true));
    const reload = stubLocation();
    localStorage.setItem('a', '1');
    sessionStorage.setItem('b', '2');
    const ctx = makeCtx();

    await uiModule.systemReset.call(ctx);

    expect(localStorage.getItem('a')).toBeNull();
    expect(sessionStorage.getItem('b')).toBeNull();
    expect(ctx.showNotification).toHaveBeenCalledWith('System purged. Reloading...', 'info');
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(reload).toHaveBeenCalledWith(true);
  });

  it('membatalkan registrasi service worker dan menghapus cache storage', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('confirm', vi.fn(() => true));
    const reload = stubLocation();

    const unregisterA = vi.fn(async () => true);
    const unregisterB = vi.fn(async () => true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn(async () => [{ unregister: unregisterA }, { unregister: unregisterB }]) },
      configurable: true,
    });
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { keys: vi.fn(async () => ['mtc-asset-v15', 'mtc-asset-v14']), delete: del });

    const ctx = makeCtx();
    await uiModule.systemReset.call(ctx);

    expect(unregisterA).toHaveBeenCalledTimes(1);
    expect(unregisterB).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('mtc-asset-v15');
    expect(del).toHaveBeenCalledWith('mtc-asset-v14');
    vi.advanceTimersByTime(1500);
    expect(reload).toHaveBeenCalledWith(true);
  });

  it('kegagalan di tengah reset tetap reload dan mencatat error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('confirm', vi.fn(() => true));
    const reload = stubLocation();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: vi.fn(async () => {
          throw new Error('sw broken');
        }),
      },
      configurable: true,
    });

    const ctx = makeCtx();
    await uiModule.systemReset.call(ctx);

    expect(errSpy).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledWith(true);
    expect(ctx.showNotification).not.toHaveBeenCalled();
  });
});
