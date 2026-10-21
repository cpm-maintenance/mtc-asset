// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` klaster auth & navigasi:
 * installApp, filteredMenuGroups, mobilePrimaryItems, isSupervisor via canAccess.
 *
 * `login`/`logout`/`showUID` **tidak lagi** didefinisikan di `app.js` (S33y):
 * salinan di sana selalu kalah oleh spread `...authModule`, jadi yang diuji di
 * sini adalah versi `src/js/modules/auth.js` lewat komposisi `makeApp()`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

beforeEach(() => {
  stubFirebase();
  window.setPersistence = vi.fn().mockResolvedValue(undefined);
  window.browserSessionPersistence = 'session';
  window.signInWithEmailAndPassword = vi.fn().mockResolvedValue({ user: { uid: 'u1' } });
  window.signOut = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('installApp', () => {
  it('tanpa installPromptEvent: tidak memanggil prompt()', async () => {
    const s = makeApp({ installPromptEvent: null, showInstallButton: true });

    await s.installApp();

    expect(s.showInstallButton).toBe(true);
  });

  it('dengan prompt tersedia: panggil prompt, tangkap outcome, reset state', async () => {
    const prompt = vi.fn();
    const s = makeApp({
      installPromptEvent: { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) },
      showInstallButton: true,
    });

    await s.installApp();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(s.installPromptEvent).toBeNull();
    expect(s.showInstallButton).toBe(false);
  });
});

describe('login', () => {
  it('email/kosong: notifikasi error, tidak menyentuh Firebase', async () => {
    const s = makeApp({ loginForm: { email: '', password: 'x' } });

    await s.login();

    expect(s.showNotification).toHaveBeenCalledWith('Please enter email and password', 'error');
    expect(window.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('kredensial valid: setPersistence lalu signIn, isLoading kembali false', async () => {
    const s = makeApp({ loginForm: { email: 'a@b.c', password: 'rahasia' }, isLoading: false });

    await s.login();

    expect(window.setPersistence).toHaveBeenCalledWith(window.auth, 'session');
    expect(window.signInWithEmailAndPassword).toHaveBeenCalledWith(window.auth, 'a@b.c', 'rahasia');
    expect(s.showNotification).toHaveBeenCalledWith('Welcome back!');
    expect(s.isLoading).toBe(false);
  });

  it('kredensial ditolak: pesan error diteruskan, isLoading tetap direset', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.signInWithEmailAndPassword = vi.fn().mockRejectedValue(new Error('wrong-password'));
    const s = makeApp({ loginForm: { email: 'a@b.c', password: 'salah' }, isLoading: false });

    await s.login();

    expect(err).toHaveBeenCalled();
    expect(s.showNotification).toHaveBeenCalledWith('Login failed: wrong-password', 'error');
    expect(s.isLoading).toBe(false);
  });
});

describe('logout', () => {
  it('dibatalkan: signOut tidak dipanggil', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const s = makeApp({ isLoading: false });

    await s.logout();

    expect(window.signOut).not.toHaveBeenCalled();
    expect(s.isLoading).toBe(false);
  });

  it('dikonfirmasi: signOut, state user dibersihkan, notifikasi info', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const s = makeApp({ isLoading: false });

    await s.logout();

    expect(window.signOut).toHaveBeenCalledWith(window.auth);
    expect(s.isLoggedIn).toBe(false);
    expect(s.user).toBeNull();
    expect(s.userRole).toBe('user');
    expect(s.showNotification).toHaveBeenCalledWith('Logged out successfully', 'info');
    expect(s.isLoading).toBe(false);
  });

  it('signOut gagal: notifikasi error, isLoading tetap direset', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    window.signOut = vi.fn().mockRejectedValue(new Error('network'));
    const s = makeApp({ isLoading: false });

    await s.logout();

    expect(s.showNotification).toHaveBeenCalledWith('Error logging out: network', 'error');
    expect(s.isLoading).toBe(false);
  });
});

describe('showUID', () => {
  it('ada user: prompt berisi uid', () => {
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);
    const s = makeApp({ user: { uid: 'UID-123' } });

    s.showUID();

    expect(prompt).toHaveBeenCalledWith('Copy your UID below:', 'UID-123');
  });

  it('tanpa user: prompt tidak dipanggil', () => {
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);

    makeApp({ user: null }).showUID();

    expect(prompt).not.toHaveBeenCalled();
  });
});

describe('filteredMenuGroups', () => {
  const groups = [
    { name: 'Monitoring', items: [{ name: 'Dashboard' }, { name: 'Work Orders' }] },
    { name: 'Inventory', items: [{ name: 'Spare Parts' }] },
  ];

  it('query kosong: seluruh grup dikembalikan apa adanya', () => {
    const s = makeApp({ menuGroups: groups, menuSearch: '   ' });

    expect(s.filteredMenuGroups).toHaveLength(2);
    expect(s.filteredMenuGroups[0].items).toHaveLength(2);
  });

  it('query mencocokkan nama item dan membuang grup kosong', () => {
    const s = makeApp({ menuGroups: groups, menuSearch: '  WORK ' });

    expect(s.filteredMenuGroups).toHaveLength(1);
    expect(s.filteredMenuGroups[0].name).toBe('Monitoring');
    expect(s.filteredMenuGroups[0].items).toEqual([{ name: 'Work Orders' }]);
  });

  it('query tanpa hasil: array kosong', () => {
    const s = makeApp({ menuGroups: groups, menuSearch: 'zzz' });

    expect(s.filteredMenuGroups).toEqual([]);
  });
});

describe('mobilePrimaryItems', () => {
  it('mengambil 4 slot utama dari menuItems', () => {
    const s = makeApp();

    expect(s.mobilePrimaryItems.map((/** @type {any} */ i) => i.id)).toEqual(['dash', 'wo', 'equip', 'parts']);
  });
});

describe('isSupervisor / canAccess', () => {
  it('userRole supervisor: isSupervisor true, menu supervisor boleh diakses', () => {
    // isAdmin di-harness di-default true (defineProperty statis), jadi di-set false
    // agar rantai `canAccess → isAdminOrSupervisor` benar-benar diuji.
    const s = makeApp({ userRole: 'supervisor', isAdmin: false });

    expect(s.isSupervisor).toBe(true);
    expect(s.canAccess({ allowedRole: 'supervisor' })).toBe(true);
    expect(s.canAccess({ allowedRole: 'admin' })).toBe(false);
  });

  it('userRole user: isSupervisor false, menu supervisor ditolak, menu bebas tetap boleh', () => {
    const s = makeApp({ userRole: 'user', isAdmin: false });

    expect(s.isSupervisor).toBe(false);
    expect(s.canAccess({ allowedRole: 'supervisor' })).toBe(false);
    expect(s.canAccess({ name: 'Dashboard' })).toBe(true);
  });
});

// Kartu t_a9ec2a2d: `login()`/`logout()`/`showUID()` di `app.js` selalu kalah
// oleh spread `...authModule` (modul di-spread SESUDAH literal), jadi salinan
// itu tidak pernah bisa dieksekusi. Yang menutup regresi bukan angka byte
// (keduanya sudah di chunk malas), melainkan satu sumber kebenaran.
describe('sumber tunggal auth', () => {
  const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');

  it('app.js tidak lagi punya salinan login/logout/showUID', () => {
    const appSrc = read('src/js/app.js');
    expect(appSrc).not.toMatch(/^\s+async login\(\)/m);
    expect(appSrc).not.toMatch(/^\s+async logout\(\)/m);
    expect(appSrc).not.toMatch(/^\s+showUID\(\)/m);
    // Versi yang sah tetap ada di modul auth.
    const authSrc = read('src/js/modules/auth.js');
    expect(authSrc).toMatch(/^\s+async login\(\)/m);
    expect(authSrc).toMatch(/^\s+async logout\(\)/m);
    expect(authSrc).toMatch(/^\s+showUID\(\)/m);
  });

  it('main.js tidak menugaskan window.Sentry ke dirinya sendiri', () => {
    // `Sentry` resolve ke `window.Sentry` (stub yang dipasang di atas berkas),
    // jadi baris itu no-op dan hanya menambah kebingungan saat membaca boot.
    expect(read('src/main.js')).not.toMatch(/window\.Sentry = Sentry/);
  });

  it('index.html tidak lagi membawa fallback window.login → window.appData', () => {
    // `window.appData` tidak pernah didefinisikan di mana pun; blok itu selalu
    // jatuh ke cabang `alert()` + `location.reload()`.
    const html = read('index.html');
    expect(html).not.toMatch(/window\.appData/);
    expect(html).not.toMatch(/System still initializing/);
  });
});
