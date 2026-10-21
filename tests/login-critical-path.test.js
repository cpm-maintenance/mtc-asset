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
});