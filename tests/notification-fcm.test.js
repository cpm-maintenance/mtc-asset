// @vitest-environment jsdom
/**
 * Unit tests untuk jalur FCM di `src/js/modules/notification.js`
 * (registerFCMToken / saveFCMToken / removeFCMToken / setupForegroundListener).
 *
 * `firebase/messaging` di-mock seluruhnya: yang diuji adalah logika modul
 * (kapan token disimpan, kapan dilewati, bagaimana error ditelan), bukan SDK.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({ app: 'mock' })),
  getToken: vi.fn(),
  onMessage: vi.fn(),
}));

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import {
  registerFCMToken,
  removeFCMToken,
  setupForegroundListener,
  resetNotifBlocker,
  checkAllNotifications,
} from '../src/js/modules/notification.js';

function stubNotification(permission = 'granted') {
  const Ctor = vi.fn();
  Ctor.permission = permission;
  vi.stubGlobal('Notification', Ctor);
  return Ctor;
}

describe('notification.js: registerFCMToken', () => {
  it('izin belum granted: null tanpa memanggil getToken', async () => {
    stubNotification('default');

    await expect(registerFCMToken()).resolves.toBeNull();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('token didapat: disimpan ke Users/{uid}/fcmToken dan _fcmTokens/{uid}', async () => {
    stubNotification('granted');
    getToken.mockResolvedValue('tok-abcdefghijklmnopqrstuvwxyz');
    window.db = {};
    window.app = { user: { uid: 'u1', email: 'op@plant.id' } };

    const token = await registerFCMToken();

    expect(token).toBe('tok-abcdefghijklmnopqrstuvwxyz');
    expect(window.set).toHaveBeenCalledTimes(2);
    const paths = window.set.mock.calls.map(c => c[0].path);
    expect(paths).toEqual(['Users/u1/fcmToken', '_fcmTokens/u1']);
    expect(window.set.mock.calls[0][1]).toMatchObject({ token, userAgent: expect.any(String) });
    expect(window.set.mock.calls[1][1]).toMatchObject({ token, email: 'op@plant.id' });
  });

  it('getToken mengembalikan string kosong: null, tidak menyimpan', async () => {
    stubNotification('granted');
    getToken.mockResolvedValue('');
    window.db = {};
    window.app = { user: { uid: 'u1' } };

    await expect(registerFCMToken()).resolves.toBeNull();
    expect(window.set).not.toHaveBeenCalled();
  });

  it('SDK melempar: ditelan jadi null + console.warn', async () => {
    stubNotification('granted');
    getToken.mockRejectedValue(new Error('messaging unsupported'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(registerFCMToken()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[FCM] Token error:', 'messaging unsupported', '- non-critical, browser notifs still work');
  });

  it('tanpa window.db / user: token tidak disimpan tapi tetap dikembalikan', async () => {
    stubNotification('granted');
    getToken.mockResolvedValue('tok-1');
    window.db = null;
    window.app = {};

    await expect(registerFCMToken()).resolves.toBe('tok-1');
    expect(window.set).not.toHaveBeenCalled();
  });

  it('penyimpanan gagal: ditelan, token tetap dikembalikan', async () => {
    stubNotification('granted');
    getToken.mockResolvedValue('tok-1');
    window.db = {};
    window.app = { user: { uid: 'u1' } };
    window.set.mockRejectedValue(new Error('permission_denied'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(registerFCMToken()).resolves.toBe('tok-1');
    expect(warn).toHaveBeenCalledWith('[FCM] Save token error:', 'permission_denied');
  });
});

describe('notification.js: removeFCMToken', () => {
  it('tanpa window.db / user: tidak melakukan apa pun', async () => {
    window.db = null;
    window.app = {};

    await removeFCMToken();

    expect(window.remove).not.toHaveBeenCalled();
  });

  it('menghapus kedua path token', async () => {
    window.db = {};
    window.app = { user: { uid: 'u1' } };

    await removeFCMToken();

    expect(window.remove).toHaveBeenCalledTimes(2);
    expect(window.remove.mock.calls.map(c => c[0].path)).toEqual(['Users/u1/fcmToken', '_fcmTokens/u1']);
  });

  it('penghapusan gagal: ditelan + console.warn', async () => {
    window.db = {};
    window.app = { user: { uid: 'u1' } };
    window.remove.mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(removeFCMToken()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[FCM] Remove token error:', 'offline');
  });
});

describe('notification.js: setupForegroundListener', () => {
  it('pesan masuk dengan payload.notification tampil sebagai notifikasi in-app', () => {
    window.app = { showNotification: vi.fn() };

    setupForegroundListener();

    expect(onMessage).toHaveBeenCalledTimes(1);
    const handler = onMessage.mock.calls[0][1];
    handler({ notification: { title: 'WO Baru', body: 'WO-9 dibuat' } });

    expect(window.app.showNotification).toHaveBeenCalledWith('WO Baru: WO-9 dibuat', 'info');
  });

  it('payload tanpa notification: tidak memanggil showNotification', () => {
    window.app = { showNotification: vi.fn() };
    setupForegroundListener();

    onMessage.mock.calls[0][1]({ data: { x: '1' } });

    expect(window.app.showNotification).not.toHaveBeenCalled();
  });

  it('aplikasi global tidak punya showNotification: tidak melempar', () => {
    window.app = {};
    setupForegroundListener();

    expect(() => onMessage.mock.calls[0][1]({ notification: { title: 'a', body: 'b' } })).not.toThrow();
  });

  it('getMessaging melempar: ditelan + console.warn', () => {
    getMessaging.mockImplementationOnce(() => { throw new Error('no sw'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setupForegroundListener();

    expect(warn).toHaveBeenCalledWith('[FCM] Foreground listener error:', 'no sw');
  });
});

describe('notification.js: checkAllNotifications — auto-reorder', () => {
  it('admin/supervisor: autoReorderLowStock dipanggil', () => {
    const autoReorder = vi.fn().mockResolvedValue(undefined);
    window.app = { notifications: [], autoReorderLowStock: autoReorder, isAdminOrSupervisor: true };
    resetNotifBlocker();

    checkAllNotifications();

    expect(autoReorder).toHaveBeenCalledTimes(1);
  });

  it('bukan admin: autoReorderLowStock tidak dipanggil', () => {
    const autoReorder = vi.fn().mockResolvedValue(undefined);
    window.app = { notifications: [], autoReorderLowStock: autoReorder, isAdminOrSupervisor: false };
    resetNotifBlocker();

    checkAllNotifications();

    expect(autoReorder).not.toHaveBeenCalled();
  });

  it('autoReorder menolak: ditangkap, tidak jadi unhandled rejection', async () => {
    const autoReorder = vi.fn().mockRejectedValue(new Error('RTDB down'));
    window.app = { notifications: [], autoReorderLowStock: autoReorder, isAdminOrSupervisor: true };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetNotifBlocker();

    checkAllNotifications();
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith('[Notif] Auto-reorder:', 'RTDB down');
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  getMessaging.mockImplementation(() => ({ app: 'mock' }));
  stubNotification('granted');
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ showNotification: vi.fn() }) },
    configurable: true,
  });
  window.db = {};
  window.set = vi.fn().mockResolvedValue(undefined);
  window.remove = vi.fn().mockResolvedValue(undefined);
  window.ref = vi.fn((_db, path) => ({ path }));
  window.app = { user: { uid: 'u1', email: 'op@plant.id' }, notifications: [] };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
