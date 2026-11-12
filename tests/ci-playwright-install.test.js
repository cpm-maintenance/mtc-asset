import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak langkah pemasangan Playwright di CI.
 *
 * Flag deps bawaan `playwright install` mencampur dua hal berbeda dalam satu
 * langkah: mengunduh browser dari CDN Playwright (jarang gagal), dan
 * `apt-get install` paket font/lib dari mirror Ubuntu (sering gagal).
 *
 * Runner GitHub Actions dua kali berturut-turut mati di langkah itu dengan
 * `Temporary failure resolving 'archive.ubuntu.com'` lalu
 * `E: Unable to fetch some archives` (exit 100) padahal seluruh langkah kode
 * (lint, typecheck, unit, coverage, build) hijau.
 *
 * Yang dikunci: unduhan browser dipisah dari pemasangan system deps, dan
 * bagian apt punya percobaan ulang.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = fs
  .readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8')
  .replace(/\r\n/g, '\n');
const LINES = WORKFLOW.split('\n');

/** Baris isi step `- name: <name>` (sampai indentasi kembali ke level step). */
function stepBody(name) {
  const at = LINES.findIndex((l) => l.trim() === '- name: ' + name);
  if (at < 0) return null;

  const stepPad = LINES[at].length - LINES[at].trimStart().length;
  const body = [];

  for (let i = at + 1; i < LINES.length; i += 1) {
    const line = LINES[i];
    if (line.trim() === '') {
      body.push('');
      continue;
    }
    const pad = line.length - line.trimStart().length;
    if (pad <= stepPad) break;
    body.push(line);
  }

  return body.join('\n');
}

describe('CI — pemasangan Playwright tahan flaky apt', () => {
  it('tidak lagi memakai flag deps bawaan (apt + unduh tercampur 1 langkah)', () => {
    expect(WORKFLOW).not.toMatch(/playwright install\s+--with-deps/);
  });

  it('unduhan browser dan pemasangan system deps dipisah', () => {
    const download = stepBody('Install Playwright browser');
    const deps = stepBody('Install Playwright system deps');

    expect(download, 'step unduhan browser tidak ditemukan').not.toBeNull();
    expect(deps, 'step system deps tidak ditemukan').not.toBeNull();
    expect(download).toContain('npx playwright install chromium');
    expect(deps).toContain('npx playwright install-deps chromium');
  });

  it('pemasangan system deps dicoba ulang minimal 3 kali', () => {
    const deps = stepBody('Install Playwright system deps');
    expect(deps).not.toBeNull();
    expect(deps).toMatch(/for \w+ in 1 2 3/);
    expect(deps).toMatch(/sleep \d+/);
  });
});
