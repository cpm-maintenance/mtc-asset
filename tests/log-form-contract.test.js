/**
 * Kontrak form log maintenance + aksesibilitas viewport.
 *
 * Dua hal di sini pernah salah dan gagal SENYAP:
 *
 * 1. `index.html` memakai `maximum-scale=1, user-scalable=no` → pinch-zoom mati,
 *    melanggar WCAG 1.4.4 (Resize Text) dan menggagalkan audit Lighthouse
 *    `meta-viewport`.
 * 2. Field `logForm.actualHours` dan `logForm.completedDate` **ada di state dan
 *    ikut tersimpan** (`constants.ts` + `logs.js` submit) tetapi modal log inline
 *    tidak punya input-nya — nilainya selalu `0` / `''`. Input-nya dulu hanya
 *    ada di fragment mati `public/components/modals/LogModal.html` (dihapus di
 *    Q-3). Sekarang sudah dipindah ke `index.html`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOG_FORM } from '../src/js/constants.ts';

const ROOT = process.cwd();
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
// Modal form log tinggal di fragmen shell (index.html hanya layar login).
const shell = fs.readFileSync(path.join(ROOT, 'public/pages/app-shell.html'), 'utf-8');
const markup = `${index}\n${shell}`;

describe('viewport — zoom tidak boleh diblokir (WCAG 1.4.4)', () => {
  it('meta viewport tidak mematikan pinch-zoom', () => {
    const m = index.match(/<meta name="viewport" content="([^"]+)"/);
    expect(m).not.toBeNull();
    const content = m[1];

    expect(content).toContain('width=device-width');
    expect(content).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(content).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
  });
});

describe('form log — field yang disubmit punya input di UI', () => {
  it('DEFAULT_LOG_FORM mendeklarasikan actualHours dan completedDate', () => {
    const form = DEFAULT_LOG_FORM();

    // Tanpa deklarasi ini `x-model` mengikat ke properti undefined dan nilai
    // awalnya tidak pernah ter-reset saat modal dibuka ulang.
    // Nilai awal numerik sengaja string kosong: field baru harus tampil kosong
    // dengan placeholder, bukan "0" yang terbaca seperti data terisi.
    // `submitLog` menormalkan dengan Number(...) || 0, jadi simpanan tetap angka.
    expect(form).toHaveProperty('actualHours', '');
    expect(form).toHaveProperty('estimatedHours', '');
    expect(form).toHaveProperty('downtime', '');
    expect(form).toHaveProperty('cost', '');
    expect(form).toHaveProperty('completedDate', '');
  });

  it('modal log inline punya input Actual Hours', () => {
    expect(markup).toContain('x-model="logForm.actualHours"');
    expect(markup).toMatch(/x-model="logForm\.actualHours"[^>]*step="0\.1"/);
  });

  it('modal log inline punya input Completed Date yang dibatasi hari ini', () => {
    expect(markup).toContain('x-model="logForm.completedDate"');
    expect(markup).toMatch(/x-model="logForm\.completedDate"[^>]*:max="new Date\(\)\.toISOString\(\)/);
  });

  it('Completed Date hanya muncul saat status Completed', () => {
    const at = markup.indexOf('x-model="logForm.completedDate"');
    expect(at).toBeGreaterThan(-1);
    // `x-show` berada di pembungkus <div> sebelum input-nya.
    const wrapper = markup.slice(Math.max(0, at - 400), at);
    expect(wrapper).toContain(`x-show="logForm.status === 'Completed'"`);
  });

  it('memilih status Completed mengisi completedDate otomatis', () => {
    const at = markup.indexOf('x-model="logForm.status"');
    expect(at).toBeGreaterThan(-1);
    const tag = markup.slice(at, markup.indexOf('>', at));
    expect(tag).toContain('@change=');
    expect(tag).toMatch(/logForm\.completedDate\s*=/);
  });

  it('field ini benar-benar ikut tersimpan saat submit', () => {
    const logs = fs.readFileSync(path.join(ROOT, 'src/js/modules/logs.js'), 'utf-8');
    expect(logs).toMatch(/actualHours:\s*Number\(this\.logForm\.actualHours\)/);
    expect(logs).toMatch(/completedDate:\s*this\.logForm\.completedDate/);
  });
});
