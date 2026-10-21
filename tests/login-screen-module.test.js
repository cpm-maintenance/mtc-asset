// @vitest-environment jsdom
/**
 * Unit test komponen layar login: src/js/modules/login.js
 *
 * Komponen ini eager (ikut muatan login) dan menggantikan `app()` di
 * `<body x-data="login()">`. Dua hal yang mudah rusak tanpa terlihat:
 *   1. spread dari `auth.js`/`ui.js` — kalau salah satu modul berhenti
 *      diekspor, markup login kehilangan metode tanpa error build;
 *   2. `init()` — satu-satunya tempat tema dipasang sebelum paint pertama
 *      sekarang, karena `bootstrap.init()` ikut chunk yang malas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLoginScreen } from '../src/js/modules/login.js';
import { readThemeMode } from '../src/js/modules/ui.js';

beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
});

describe('createLoginScreen — bentuk state', () => {
    it('membawa state sesi yang ditulis dari main.js', () => {
        const s = createLoginScreen();
        expect(s.isLoggedIn).toBe(false);
        expect(s.isLoading).toBe(true);
        expect(s.user).toBeNull();
        expect(s.notifications).toEqual([]);
        expect(s.userRole).toBe('user');
    });

    it('memuat seluruh binding yang dipakai markup login', () => {
        const s = createLoginScreen();
        // index.html: x-model loginForm.*, setLoginMode, submitLogin,
        // rememberedEmail, showLoginKey, isLoading, notifications.
        for (const key of [
            'loginForm',
            'loginMode',
            'setLoginMode',
            'submitLogin',
            'login',
            'logout',
            'rememberedEmail',
            'showLoginKey',
            'notifications',
            'showNotification',
            'applyTheme',
        ]) {
            expect(s[key], `binding hilang dari komponen login: ${key}`).toBeDefined();
        }
    });

    it('tidak membawa permukaan milik chunk app', () => {
        const s = createLoginScreen();
        // Kalau `bootstrapModule` ikut ter-spread, `init()` akan menimpa init
        // milik layar login dan memanggil $watch di luar scope Alpine.
        expect(s.onUser).toBeUndefined();
        expect(s.checkUserRole).toBeUndefined();
        expect(s.$watch).toBeUndefined();
    });
});

describe('createLoginScreen — init()', () => {
    it('memasang tema tersimpan sebelum paint pertama', () => {
        localStorage.setItem('themeMode', 'light');
        const s = createLoginScreen();
        s.init();
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(s.darkMode).toBe(false);
    });

    it('default night → atribut data-theme="dark"', () => {
        const s = createLoginScreen();
        s.init();
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});

describe('readThemeMode', () => {
    it('memakai themeMode yang tersimpan', () => {
        localStorage.setItem('themeMode', 'navy');
        expect(readThemeMode()).toBe('navy');
    });

    it('migrasi kunci lama darkMode → themeMode', () => {
        localStorage.setItem('darkMode', 'false');
        expect(readThemeMode()).toBe('light');
        expect(localStorage.getItem('themeMode')).toBe('light');
        expect(localStorage.getItem('darkMode')).toBeNull();
    });

    it('jatuh ke night kalau localStorage melempar', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(readThemeMode()).toBe('night');
        spy.mockRestore();
    });
});
