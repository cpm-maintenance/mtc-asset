/**
 * Kontrak a11y chip filter status di `public/pages/WorkOrders.html`.
 *
 * Dua cacat yang pernah ada di fragmen ini:
 * 1. Nama tombol HANYA berasal dari `x-text` — kalau Alpine belum/gagal boot,
 *    tombol jadi tanpa nama (axe: `link-name`/`button-name`), dan pembaca layar
 *    tidak tahu apa yang difilter.
 * 2. Tinggi tombol di bawah 24 px (`py-1` + teks 10 px) → gagal target-size
 *    WCAG 2.2 (2.5.8).
 *
 * Tes ini mengunci keduanya: label statis + status pressed + ukuran minimum.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fragment = fs.readFileSync(path.join(ROOT, 'public/pages/WorkOrders.html'), 'utf-8');

/** Potongan grup filter status (role="group" aria-label="Filter status"). */
const groupStart = fragment.indexOf('aria-label="Filter status"');
const group = fragment.slice(groupStart, fragment.indexOf('</div>', fragment.indexOf('CANCELLED', groupStart)));

/** Semua <button ...> di dalam grup. */
const buttons = group.match(/<button\b[\s\S]*?>/g) || [];

describe('chip filter status — nama tombol statis', () => {
  it('grup filter status ditemukan', () => {
    expect(groupStart).toBeGreaterThan(-1);
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });

  it('setiap tombol punya aria-label statis (tidak bergantung Alpine)', () => {
    for (const tag of buttons) {
      const m = tag.match(/aria-label="([^"]*)"/);
      expect(m, `tombol tanpa aria-label: ${tag.slice(0, 80)}`).not.toBeNull();
      expect(m[1].trim().length).toBeGreaterThan(0);
    }
  });

  it('setiap tombol mengekspos status terpilih lewat aria-pressed', () => {
    for (const tag of buttons) {
      expect(tag, `tombol tanpa aria-pressed: ${tag.slice(0, 80)}`).toMatch(/:aria-pressed="[^"]+"/);
    }
  });
});

describe('chip filter status — target size >= 24 px (WCAG 2.2 2.5.8)', () => {
  it('setiap tombol membawa min-h-6 dan min-w-6', () => {
    for (const tag of buttons) {
      expect(tag, `tombol terlalu kecil: ${tag.slice(0, 80)}`).toContain('min-h-6');
      expect(tag, `tombol terlalu kecil: ${tag.slice(0, 80)}`).toContain('min-w-6');
    }
  });
});
