// Kontrak CLS login: blok mode yang tidak aktif harus di-cloak SEBELUM Alpine boot,
// kalau tidak ketiga blok (email+pin+sso) ikut ter-render dan section mengempis
// 267 px saat Alpine jalan — itu sumber CLS 0,24 di mobile.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

/** Potongan HTML antara dua penanda (penanda awal ikut disertakan). */
function between(startMark, endMark) {
  const start = html.indexOf(startMark);
  const end = html.indexOf(endMark, start);
  return html.slice(start, end);
}

/** Kumpulkan tag pembuka yang memuat `needle` (default: seluruh berkas). */
function tagsWith(needle, scope = html) {
  const out = [];
  let i = 0;
  while ((i = scope.indexOf(needle, i)) !== -1) {
    const start = scope.lastIndexOf('<', i);
    const end = scope.indexOf('>', i);
    out.push(scope.slice(start, end + 1));
    i = end;
  }
  return out;
}

const loginForm = between('<form @submit.prevent="submitLogin()"', '</form>');

describe('login: cloak sebelum Alpine boot', () => {
  it('blok PIN dan SSO punya x-cloak (default email tetap terlihat)', () => {
    const pin = tagsWith('x-show="loginMode === \'pin\'"');
    const sso = tagsWith('x-show="loginMode === \'sso\'"');
    expect(pin).toHaveLength(1);
    expect(sso).toHaveLength(1);
    expect(pin[0]).toContain('x-cloak');
    expect(sso[0]).toContain('x-cloak');
  });

  it('blok default (email) TIDAK di-cloak supaya form langsung terlihat', () => {
    const email = tagsWith('x-show="loginMode === \'email\'"');
    expect(email).toHaveLength(1);
    expect(email[0]).not.toContain('x-cloak');
  });

  it('spinner isLoading di CTA login di-cloak supaya tombol tidak menggelembung', () => {
    const spinner = tagsWith('x-show="isLoading"', loginForm);
    expect(spinner).toHaveLength(1);
    expect(spinner[0]).toContain('x-cloak');
  });
});
