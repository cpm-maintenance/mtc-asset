// @vitest-environment jsdom
/**
 * Harness untuk menguji `src/js/app.js` tanpa menjalankan Alpine.
 *
 * `app()` mengembalikan objek state gabungan (state inline + spread modul).
 * Modul asli ikut ter-spread, jadi Firebase disuntik sebagai stub di `window`
 * (bukan `vi.mock` modul) — sama seperti tes modul lain di repo ini.
 */
import { vi } from 'vitest';
import { app } from '../../src/js/app.js';

/** Stub Firebase RTDB/auth di `window`; kembalikan handle untuk diperiksa. */
export function stubFirebase() {
  const snap = (value) => ({ val: () => value, exists: () => value != null });
  const ref = vi.fn(() => ({
    onValue: vi.fn((cb) => { cb(snap(null)); return vi.fn(); }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    push: vi.fn(() => ({ key: 'k1', set: vi.fn().mockResolvedValue(undefined) })),
    once: vi.fn().mockResolvedValue(snap(null)),
  }));
  window.ref = ref;
  window.get = vi.fn().mockResolvedValue(snap(null));
  window.set = vi.fn().mockResolvedValue(undefined);
  window.update = vi.fn().mockResolvedValue(undefined);
  window.remove = vi.fn().mockResolvedValue(undefined);
  window.db = { ref };
  window.auth = { currentUser: { uid: 'u1', email: 'a@b.c' }, signOut: vi.fn() };
  return { ref, snap };
}

/**
 * `app()` + default yang membuat method app.js aman dipanggil.
 * Override memakai defineProperty supaya accessor hasil `reattachModuleGetters`
 * (getter tanpa setter) tetap bisa ditimpa.
 */
export function makeApp(overrides = {}) {
  const s = app();
  const defaults = {
    showNotification: vi.fn(),
    queueOfflineOperation: vi.fn(),
    saveToIndexedDB: vi.fn().mockResolvedValue(undefined),
    user: { uid: 'u1', email: 'a@b.c' },
    isOnline: true,
    isLoading: false,
    isAdmin: true,
    userRole: 'admin',
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    Object.defineProperty(s, k, { value: v, writable: true, configurable: true, enumerable: true });
  }
  return s;
}
