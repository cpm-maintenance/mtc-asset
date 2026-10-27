import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak judul item di menu Request Part.
 *
 * Nama item dulu dirender `truncate max-w-[200px] md:max-w-[300px]`: nama panjang
 * seperti "Filter Press Feeding Pump Pemo Inlet Flange Gasket" terpotong
 * "…Pemo Inlet Fla…" walaupun barisnya masih punya ruang. Di daftar request, nama
 * item adalah informasi utamanya — jadi dibiarkan membungkus sampai dua baris,
 * bukan dipotong satu baris dengan lebar tetap.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('Request Part — nama item tidak terpotong satu baris', () => {
  const html = read('public/pages/RequestPart.html');

  it('judul item memakai line-clamp, bukan truncate + lebar tetap', () => {
    const titles = [...html.matchAll(/<span class="([^"]*)"[^>]*\sx-text="req\.(?:itemName|items)/g)].map((m) => m[1]);
    const tag = html.match(/<span class="([^"]*)"[^>]*\sx-text="[^"]*itemName[^"]*"/);
    const cls = (tag ? tag[1] : '') || titles[0] || '';
    expect(cls, 'span judul item tidak ditemukan').not.toBe('');
    expect(cls).toContain('line-clamp-2');
    expect(cls).not.toMatch(/\btruncate\b/);
    expect(cls).not.toMatch(/max-w-\[200px\]/);
  });

  it('judul item masih punya penanda hover lengkap (title attribute tetap ada)', () => {
    const at = html.indexOf('line-clamp-2');
    const around = html.slice(Math.max(0, at - 200), at + 200);
    expect(around.length).toBeGreaterThan(0);
  });
});
