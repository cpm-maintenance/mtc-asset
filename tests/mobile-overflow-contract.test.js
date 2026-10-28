import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak tata letak mobile (viewport 390px): halaman tidak boleh bisa digeser
 * ke samping.
 *
 * Audit 2026-10 (emulasi 390x844, dpr 3, mobile+touch) menemukan 6 halaman yang
 * melebarkan dokumen: baris filter berisi `<select>`/chip, grid kalender
 * `min-w-[560px]`, dan tabel di dalam flex/grid item yang tidak bisa menyusut.
 * Akarnya dua pola:
 *
 *   1. baris filter `flex` tanpa `min-w-0` — anak dengan lebar intrinsial
 *      (select dengan opsi panjang, input tanggal) mendorong lebar halaman;
 *   2. kontainer `overflow-x-auto` di dalam flex/grid item tanpa `min-w-0` —
 *      kontainer tidak pernah menyusut, jadi tabel/grid melebarkan dokumen
 *      alih-alih menggulir sendiri.
 *
 * Kontrak yang dikunci di sini:
 *   - setiap kelompok filter punya `min-w-0` (dan `max-w-full` pada anak select);
 *   - setiap pembungkus `overflow-x-auto` boleh menyusut (`min-w-0`);
 *   - grid kalender PM dibungkus scroller, bukan melebarkan halaman;
 *   - rail tab Analytics menggulir horizontal, tidak melipat dua baris.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = (name) => fs.readFileSync(path.join(ROOT, 'public', 'pages', `${name}.html`), 'utf-8');

/** Kelas dari elemen yang memuat `anchor` (anchor boleh di atribut mana pun). */
const classOfAnchor = (src, anchor) => {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor tidak ditemukan: ${anchor}`);
  const start = src.lastIndexOf('<', i);
  const end = src.indexOf('>', i);
  const tag = src.slice(start, end);
  const m = tag.match(/class="([^"]*)"/);
  return m ? m[1].split(/\s+/) : [];
};

/** Kelas dari elemen pembuka terdekat SEBELUM elemen yang memuat `anchor`. */
const classOfPrevElement = (src, anchor) => {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor tidak ditemukan: ${anchor}`);
  const ownStart = src.lastIndexOf('<', i);
  const prevStart = src.lastIndexOf('<', ownStart - 1);
  const end = src.indexOf('>', prevStart);
  const tag = src.slice(prevStart, end + 1);
  const m = tag.match(/class="([^"]*)"/);
  return m ? m[1].split(/\s+/) : [];
};

/** Kelas dari `<div>` leluhur terdekat yang memuat `anchor`. */
const classOfParentDiv = (src, anchor) => {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor tidak ditemukan: ${anchor}`);
  const j = src.lastIndexOf('<div', i);
  const end = src.indexOf('>', j);
  const m = src.slice(j, end + 1).match(/class="([^"]*)"/);
  return m ? m[1].split(/\s+/) : [];
};

/** Kelas dari elemen pertama bertipe `tagName` SETELAH `anchor`. */
const classOfNextElement = (src, anchor, tagName = '<button') => {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor tidak ditemukan: ${anchor}`);
  const j = src.indexOf(tagName, i);
  const end = src.indexOf('>', j);
  const tag = src.slice(j, end + 1);
  const m = tag.match(/(?<![:\w-])class="([^"]*)"/);
  return m ? m[1].split(/\s+/) : [];
};

/** Kelas dari `tagName` terdekat SEBELUM `anchor` (mis. <button> pembungkus span label). */
const classOfPrevTag = (src, anchor, tagName) => {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor tidak ditemukan: ${anchor}`);
  const j = src.lastIndexOf(tagName, i);
  const end = src.indexOf('>', j);
  const m = src.slice(j, end + 1).match(/(?<![:\w-])class="([^"]*)"/);
  return m ? m[1].split(/\s+/) : [];
};

const has = (tokens, ...need) => need.every((n) => tokens.includes(n));

describe('kontrak layout mobile — baris filter', () => {
  it('WorkOrders: kelompok filter status bisa menyusut dan menggulir', () => {
    const t = classOfAnchor(page('WorkOrders'), 'aria-label="Filter status"');
    expect(has(t, 'min-w-0', 'overflow-x-auto')).toBe(true);
  });

  it('Performance: kelompok filter equipment menyusut, select dibatasi', () => {
    const src = page('Performance');
    const group = classOfParentDiv(src, 'x-model="perfFilterEquip"');
    expect(group).toContain('min-w-0');
    const select = classOfAnchor(src, 'x-model="perfFilterEquip"');
    expect(has(select, 'max-w-full', 'min-w-0')).toBe(true);
  });

  it('HistoryCard: baris periode membungkus, input tanggal dibatasi', () => {
    const src = page('HistoryCard');
    const group = classOfParentDiv(src, 'x-model="historyDateFrom"');
    expect(has(group, 'min-w-0', 'flex-wrap')).toBe(true);
    const from = classOfAnchor(src, 'x-model="historyDateFrom"');
    expect(has(from, 'min-w-0', 'max-w-[150px]')).toBe(true);
  });

  it('MTBFMTTR: kelompok filter equipment menyusut, select dibatasi', () => {
    const src = page('MTBFMTTR');
    const group = classOfParentDiv(src, 'aria-label="Filter equipment MTBF"');
    expect(group).toContain('min-w-0');
    const select = classOfAnchor(src, 'aria-label="Filter equipment MTBF"');
    expect(select).toContain('max-w-full');
  });
});

describe('kontrak layout mobile — scroller & grid', () => {
  it('PMSchedule: grid kalender memakai scroller yang bisa menyusut', () => {
    const src = page('PMSchedule');
    const card = classOfPrevElement(src, 'min-w-[560px]');
    expect(has(card, 'overflow-x-auto', 'min-w-0')).toBe(true);
  });

  it('EnterpriseDashboard: pembungkus tabel bisa menyusut', () => {
    const src = page('EnterpriseDashboard');
    const wrap = classOfPrevElement(src, '<table');
    expect(has(wrap, 'overflow-x-auto', 'min-w-0')).toBe(true);
  });

  it('SpareParts: setiap baris flex-wrap kartu bisa menyusut', () => {
    const src = page('SpareParts');
    const rows = [...src.matchAll(/class="([^"]*flex items-center gap-space-sm flex-wrap[^"]*)"/g)].map((m) =>
      m[1].split(/\s+/)
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect(r).toContain('min-w-0'));
  });

  it('app-shell: rail tab Analytics menggulir horizontal, tombol tidak menyusut', () => {
    const src = page('app-shell');
    const rail = classOfAnchor(src, 'aria-label="Analytics views"');
    expect(rail).toContain('overflow-x-auto');
    expect(rail).not.toContain('flex-wrap');
    const tab = classOfNextElement(src, 'x-for="tab in availableAnalyticsTabs"');
    expect(tab).toContain('shrink-0');
  });
});

describe('kontrak tap target (pointer kasar)', () => {
  it('style.css memuat blok 44px untuk header/nav, tombol ikon, checkbox, input tanggal', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src', 'css', 'style.css'), 'utf-8');
    const i = css.indexOf('@media (pointer: coarse)');
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, i + 1200);
    expect(block).toMatch(/header button/);
    expect(block).toMatch(/nav button/);
    expect(block).toMatch(/label:has\(> input\[type='checkbox'\]\)/);
    expect(block).toMatch(/input\[type='date'\]/);
    expect((block.match(/min-(width|height): 44px/g) || []).length).toBeGreaterThanOrEqual(4);
    // tombol di konten wajib 44x44: utilitas `w-7`/`min-w-6` sempat mengalahkan min-width
    expect(block).toMatch(/main button\[class\] \{[^}]*min-height: 44px;[^}]*min-width: 44px;/);
  });
});

describe('kontrak P3 — chrome mobile', () => {
  it('app-shell: <main> menyisakan ruang bottom nav 57px + safe-area', () => {
    const src = page('app-shell');
    expect(src).toContain('pb-[calc(4.5rem_+_env(safe-area-inset-bottom))]');
  });

  it('app-shell: <header> menghormati safe-area kiri/kanan', () => {
    const src = page('app-shell');
    const header = src.slice(src.indexOf('<header'), src.indexOf('>', src.indexOf('<header')) + 1);
    expect(header).toMatch(/safe-area-inset-left/);
    expect(header).toMatch(/safe-area-inset-right/);
  });

  it('WorkOrders: tombol aksi penuh lebar di mobile', () => {
    const t = classOfPrevTag(page('WorkOrders'), 'CREATE NEW WO', '<button');
    expect(has(t, 'w-full', 'sm:w-auto')).toBe(true);
  });

  it('WorkOrders: baris breadcrumb membungkus', () => {
    const src = page('WorkOrders');
    const row = classOfParentDiv(src, '>MTC-ASSET<');
    expect(has(row, 'flex-wrap', 'min-w-0')).toBe(true);
  });

  it('Dashboard: baris statistik armada membungkus', () => {
    const src = page('Dashboard');
    const row = classOfParentDiv(src, "'Repair: ' +");
    expect(has(row, 'flex-wrap', 'min-w-0')).toBe(true);
  });
});

describe('kontrak P3 — FAB di atas bottom nav', () => {
  it('FAB AllLogs/Equipment/WorkOrders tidak tertutup bottom nav', () => {
    for (const f of ['AllLogs', 'Equipment', 'WorkOrders']) {
      const src = page(f);
      expect(src).not.toMatch(/fixed bottom-12\b/);
      expect(src).toContain('bottom-[calc(4rem_+_env(safe-area-inset-bottom))]');
    }
  });
});

describe('kontrak P2 lanjutan — checkbox & tombol teks', () => {
  it('setiap checkbox dibungkus <label> supaya hit area 44px', () => {
    const files = ['PMSchedule', 'RequestPart', 'SpareParts', 'TechnicianWorkload', 'WorkOrders', 'app-shell'];
    for (const f of files) {
      const src = page(f);
      const tags = [...src.matchAll(/<input\b(?=[^>]*type="checkbox")[^>]*>/g)];
      expect(tags.length).toBeGreaterThan(0);
      for (const m of tags) {
        expect(src.slice(Math.max(0, m.index - 8), m.index)).toContain('<label>');
      }
    }
  });

  it('tombol teks PDF di WorkOrders minimal 44px lebar', () => {
    const src = page('WorkOrders');
    const hits = [...src.matchAll(/>PDF</g)];
    expect(hits.length).toBeGreaterThan(0);
    for (let i = 0; i < hits.length; i++) {
      const cls = classOfPrevTag(src, '>PDF<', '<button');
      expect(cls).toContain('min-w-11');
    }
  });
});

describe('kontrak layout 360px (Android mid) & landscape', () => {
  it('Equipment: setiap select bisa menyusut, baris filternya min-w-0', () => {
    const src = page('Equipment');
    const selects = [...src.matchAll(/<select\b[^>]*>/g)];
    expect(selects.length).toBeGreaterThan(0);
    for (const m of selects) {
      const cls = (m[0].match(/(?<![:\w-])class="([^"]*)"/) || ['', ''])[1].split(/\s+/);
      expect(cls).toContain('min-w-0');
      expect(cls).toContain('max-w-full');
    }
    const rows = [...src.matchAll(/<div class="([^"]*flex items-center gap-space-sm flex-wrap[^"]*)"/g)].map((m) =>
      m[1].split(/\s+/)
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect(r).toContain('min-w-0'));
  });

  it('PMSchedule: grid ringkasan 1 kolom di bawah 380px, kartu boleh menyusut', () => {
    const src = page('PMSchedule');
    expect(src).toContain('grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-4 gap-space-md [&>*]:min-w-0');
  });
});
