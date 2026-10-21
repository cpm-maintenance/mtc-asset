/**
 * Kontrak jalur kritis halaman login: hanya yang dibutuhkan untuk paint pertama
 * yang boleh ikut terunduh.
 *
 * Diukur (Lighthouse preview mobile, kartu `t_bea98211`): halaman login menarik
 * `prod-*.js` (Sentry, 28 KiB) karena `requestIdleCallback(..., {timeout: 3000})`
 * selalu kalah cepat dari render halaman login. Sentry hanya telemetry — pindahkan
 * pemicunya ke interaksi pertama pengguna (plus jaring pengaman 30 s) dan chunk itu
 * keluar dari muatan login (terverifikasi: item hilang di 3/3 run Lighthouse).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const mainjs = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf-8');

describe('jalur kritis halaman login', () => {
  it('Sentry tidak dimuat di awal — dipicu interaksi pertama, bukan requestIdleCallback 3 detik', () => {
    expect(mainjs).not.toMatch(/requestIdleCallback\(\s*initSentry/);
    expect(mainjs).not.toMatch(/setTimeout\(\s*initSentry\s*,/);
  });

  it('Sentry tetap punya jalur muat cadangan supaya telemetry sesi pasif tidak hilang', () => {
    expect(mainjs).toMatch(/armSentry/);
    expect(mainjs).toMatch(/'pointerdown', 'keydown', 'touchstart'/);
    expect(mainjs).toMatch(/addEventListener\(ev, armSentry/);
    expect(mainjs).toMatch(/setTimeout\(armSentry/);
  });

  // Diukur live (Lighthouse mobile, 3 run): `getAuth(app)` membawa
  // `popupRedirectResolver` bawaan, dan di browser mobile resolver itu memuat
  // `__/auth/iframe.js` (93 KB, 2,2 s) + `apis.google.com/js/api.js` (35 KB,
  // 1,4 s) saat boot. `initializeAuth` tanpa resolver memindahkan keduanya ke
  // jalur SSO saja.
  it('auth boot tanpa popupRedirectResolver — iframe auth tidak ikut di layar login', () => {
    const dbjs = fs.readFileSync(path.join(ROOT, 'src/js/firebase-core.js'), 'utf-8');
    expect(dbjs).toMatch(/initializeAuth\(app,/);
    expect(dbjs).not.toMatch(/\bgetAuth\(app\)/);
    // hanya larang sebagai dependensi; komentar penjelasan boleh menyebutnya
    expect(dbjs).not.toMatch(/popupRedirectResolver\s*:/);

    const authjs = fs.readFileSync(path.join(ROOT, 'src/js/modules/auth.js'), 'utf-8');
    expect(authjs).toMatch(/browserPopupRedirectResolver/);
    expect(authjs).toMatch(/signInWithPopup\(\s*window\.auth,\s*provider,\s*browserPopupRedirectResolver\s*\)/);
  });

  // `notification-*.js` = 8,1 KiB gzip dan tidak melakukan apa pun yang berguna
  // sebelum ada user, tapi dulu ikut `modulepreload` (13,5% dari muatan login).
  it('modul notifikasi tidak ikut muatan login — dimuat lewat __loadNotifications', () => {
    expect(mainjs).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+'\.\/js\/modules\/notification\.js'/m);
    expect(mainjs).toMatch(/window\.__loadNotifications\s*=/);
    expect(mainjs).toMatch(/import\('\.\/js\/modules\/notification\.js'\)/);
    // FCM + sapuan periodik tidak boleh dijadwalkan dari boot layar login.
    expect(mainjs).not.toMatch(/setInterval\(\s*checkAllNotifications/);
    expect(mainjs).not.toMatch(/setTimeout\(\s*checkAllNotifications/);
  });
});