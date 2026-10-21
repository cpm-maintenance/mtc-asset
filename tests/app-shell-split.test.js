/**
 * Kontrak pemisahan shell (S33m).
 *
 * index.html sengaja hanya membawa layar login + toast stack; sidebar, <main>,
 * footer, nav mobile, dan seluruh modal tinggal di fragmen
 * `public/pages/app-shell.html` yang dimuat `__loadAppShell()` setelah login.
 *
 * Alasannya terukur: 128 KB markup shell yang ikut diparse/di-style/di-layout
 * sebelum paint pertama menahan LCP. Tes ini mengunci pemisahan itu supaya
 * markup tidak diam-diam disalin kembali ke index.html.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const index = read('index.html');
const shell = read('public/pages/app-shell.html');
const mainJs = read('src/main.js');

/** Penanda markup yang hanya boleh hidup di fragmen shell. */
const SHELL_MARKERS = [
  '<main x-show="isLoggedIn"',
  '<footer x-show="isLoggedIn"',
  'x-show="showNotifications"',
  'x-show="showRejectModal"',
  'x-show="showUserManagement"',
  'x-if="showLogModal"',
  'x-if="showCropModalOpen"',
  'x-page=',
];

describe('app shell dipisah dari index.html', () => {
  it('index.html punya placeholder #app-shell', () => {
    expect(index).toContain('<div id="app-shell"></div>');
  });

  it('index.html tidak lagi memuat markup shell', () => {
    const leaked = SHELL_MARKERS.filter((m) => index.includes(m));
    expect(leaked, 'markup shell disalin balik ke index.html').toEqual([]);
  });

  it('index.html tetap memuat layar login + toast stack', () => {
    expect(index).toContain('x-show="!isLoggedIn"');
    expect(index).toContain('id="login-id"');
    expect(index).toContain('id="login-key"');
    // Toast harus hidup sebelum login (dipakai untuk pesan gagal login).
    expect(index).toMatch(/fixed top-5 right-5 z-\[100\]/);
  });

  it('index.html tetap jauh lebih kecil dari fragmen shell', () => {
    const indexKb = Buffer.byteLength(index) / 1024;
    const shellKb = Buffer.byteLength(shell) / 1024;
    expect(shellKb).toBeGreaterThan(80);
    // Plafon: kalau markup shell disalin balik, angkanya langsung melewati ini.
    expect(indexKb).toBeLessThan(60);
    expect(indexKb).toBeLessThan(shellKb / 2);
  });

  it('fragmen shell memuat sidebar, main, footer, nav mobile, dan modal', () => {
    for (const marker of SHELL_MARKERS) {
      expect(shell, `penanda hilang dari fragmen: ${marker}`).toContain(marker);
    }
  });

  it('main.js memuat fragmen lalu meng-init dengan Alpine.initTree', () => {
    expect(mainJs).toContain("const APP_SHELL_URL = '/pages/app-shell.html'");
    expect(mainJs).toContain('window.__loadAppShell');
    expect(mainJs).toContain("document.getElementById('app-shell')");
    expect(mainJs).toContain('Alpine.initTree(host)');
    // Prefetch dipicu interaksi, bukan requestIdleCallback/timeout: kunjungan
    // pasif ke layar login tidak boleh membayar 128 KB fragmen ini.
    expect(mainJs).toContain("['pointerdown', 'keydown', 'touchstart', 'focusin']");
  });

  // Sejak S33u urutan boot pasca-login pindah ke `main.js`: `bootstrap.js` ikut
  // chunk `app-*.js` yang malas, jadi listener auth di sana tidak pernah
  // terpasang pada layar login.
  it('main.js menunggu shell (dan initTree) sebelum membuka gate login', () => {
    const shellAt = mainJs.indexOf('await window.__loadAppShell()');
    const gateAt = mainJs.indexOf('loginScreen.isLoggedIn = true');
    expect(shellAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(-1);
    expect(shellAt, 'shell harus dimuat sebelum gate dibuka').toBeLessThan(gateAt);
    // Wrapper fragmen memanggil `Alpine.data('app')`, jadi chunk app wajib lebih dulu.
    const appAt = mainJs.indexOf('await window.__loadApp()');
    expect(appAt).toBeGreaterThan(-1);
    expect(appAt, 'chunk app harus terdaftar sebelum initTree fragmen').toBeLessThan(shellAt);
  });

  it('fragmen shell membawa wrapper x-data="app()" (satu-satunya bentuk yang jadi scope)', () => {
    expect(shell).toContain('<div x-data="app()"');
    // Direktif di elemen host akan terikat ke scope `login()`.
    expect(index).not.toContain('<div id="app-shell" x-data');
  });
});
