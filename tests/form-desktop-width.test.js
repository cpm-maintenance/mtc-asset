import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak lebar form di desktop (D16).
 *
 * `.form-grid` sudah container-driven (1 → 2 → 3 kolom menurut lebar wadah),
 * tapi tidak pernah punya tier 4 kolom, dan wadah panel modal dibatasi
 * `max-w-4xl` (848 px) sehingga di layar 1920 px pun field tetap ~245 px.
 *
 * Yang dikunci di sini:
 *   1. ada tier 4 kolom `@container (min-width: 900px)` (+ cadangan media query
 *      di blok `@supports not selector(:has(*))`);
 *   2. varian `form-grid--two` TETAP maksimum 2 kolom — seksi 2-field tidak
 *      boleh jadi 4 kolom dengan dua lubang;
 *   3. panel modal berform naik `max-w` di `lg:` (bukan hanya `max-w` tetap);
 *   4. tidak ada panel yang punya DUA scrollport (`max-h-[calc(100dvh-2rem)]`
 *      bersamaan `max-h-[90vh]`) — itu yang membuat footer sticky menumpuk teks
 *      "2 FIELD BELUM VALID";
 *   5. invarian lama utuh: base `minmax(0, 1fr)`, `container-type` di induk
 *      lewat `:has()`, dan `.form-grid` sendiri tanpa `container-type`.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const css = read('src/css/style.css');

/**
 * Kelas panel dari baris pertama SETELAH `needle` yang memuat
 * `bg-tac-surface-card` — anchor biasanya komentar judul modal atau
 * `<template x-if>` yang belum membawa kelas panel.
 */
const panelAt = (rel, needle) => {
  const lines = read(rel).split(/\r?\n/);
  const i = lines.findIndex((l) => l.includes(needle));
  expect(i, `${rel}: "${needle}" tidak ditemukan`).toBeGreaterThan(-1);
  for (let j = i; j < lines.length; j++) {
    const m = lines[j].match(/class="([^"]*)"/);
    if (m && m[1].includes('bg-tac-surface-card')) return m[1].split(/\s+/);
  }
  throw new Error(`${rel}: panel ber-class bg-tac-surface-card setelah "${needle}" tidak ditemukan`);
};

/** Semua balok `<template x-if="...modal...">` yang memuat `<form>`. */
const modalFormPanels = () => {
  const SHELL = read('public/pages/app-shell.html');
  const out = [];
  const tag = /<template\b|<\/template>/g;
  for (const open of SHELL.matchAll(/<template x-if="([a-zA-Z]*[Mm]odal[a-zA-Z]*)">/g)) {
    tag.lastIndex = open.index;
    let depth = 0;
    let end = -1;
    for (let m = tag.exec(SHELL); m; m = tag.exec(SHELL)) {
      depth += m[0][1] === '/' ? -1 : 1;
      if (depth === 0) {
        end = m.index;
        break;
      }
    }
    if (end < 0) throw new Error(`blok ${open[1]} tidak tertutup`);
    const block = SHELL.slice(open.index, end);
    if (!block.includes('<form')) continue;
    const line = SHELL.slice(0, open.index).split('\n').length;
    const panel = block.slice(block.indexOf('bg-tac-surface-card/95'), block.indexOf('<form'));
    out.push({ flag: open[1], line, panel });
  }
  return out;
};

describe('tier desktop untuk .form-grid', () => {
  it('punya tier 4 kolom di container >= 900px, bukan berhenti di 3', () => {
    expect(css).toMatch(/@container \(min-width: 900px\)/);
    const i = css.indexOf('@container (min-width: 900px)');
    const block = css.slice(i, i + 200);
    expect(block, 'tier 900px tanpa 4 kolom').toMatch(
      /\.form-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    );
  });

  it('punya cadangan media query 4 kolom bila :has() tidak didukung', () => {
    const i = css.indexOf('@supports not selector(:has(*))');
    expect(i).toBeGreaterThan(-1);
    const tail = css.slice(i);
    expect(tail).toMatch(/@media \(min-width: 1280px\)/);
    const j = tail.indexOf('@media (min-width: 1280px)');
    expect(tail.slice(j, j + 200)).toMatch(/\.form-grid\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('varian form-grid--two tetap maksimum 2 kolom, tidak ikut 4', () => {
    for (const m of css.matchAll(/\.form-grid--two\s*\{[^}]*grid-template-columns:\s*([^;}]+)/g)) {
      expect(m[1], 'seksi 2-field tidak boleh jadi 4 kolom').not.toMatch(/repeat\(4/);
    }
    expect(css).toMatch(/\.form-grid--two\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('tanpa !important di aturan .form-grid (larangan blanket)', () => {
    for (const m of css.matchAll(/\.form-grid[^{}]*\{([^}]*)\}/g)) {
      expect(m[1], '.form-grid memakai !important').not.toContain('!important');
    }
  });
});

describe('invarian .form-grid yang sudah benar — jangan rusak', () => {
  it('base 1 kolom minmax(0, 1fr) dan anak boleh menyusut', () => {
    expect(css).toMatch(/\.form-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/\.form-grid\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
  });

  it('container-type dipasang di induk lewat :has(), bukan di grid itu sendiri', () => {
    expect(css).toMatch(/:has\(> \.form-grid\)\s*\{\s*container-type: inline-size/);
    expect(css).not.toMatch(/\.form-grid\s*\{[^}]*container-type/);
  });

  it('tier 2 dan 3 kolom lama tetap ada', () => {
    expect(css).toMatch(/@container \(min-width: 400px\)/);
    expect(css).toMatch(/@container \(min-width: 640px\)/);
  });
});

describe('panel modal berform melebar di desktop (lg:)', () => {
  it('modal log (New System Entry) punya max-w-4xl lg:max-w-6xl', () => {
    const cls = panelAt('public/pages/app-shell.html', 'x-if="showLogModal"');
    expect(cls).toContain('max-w-4xl');
    expect(cls).toContain('lg:max-w-6xl');
  });

  it('modal performance punya max-w-4xl lg:max-w-6xl', () => {
    const cls = panelAt('public/pages/app-shell.html', 'x-if="showPerformanceModal"');
    expect(cls).toContain('max-w-4xl');
    expect(cls).toContain('lg:max-w-6xl');
  });

  it('modal request multi-item punya max-w-4xl lg:max-w-6xl', () => {
    const cls = panelAt('public/pages/RequestPart.html', 'NEW REQUEST MODAL (Multi-Item)');
    expect(cls).toContain('max-w-4xl');
    expect(cls).toContain('lg:max-w-6xl');
  });

  it('modal equipment punya max-w-2xl lg:max-w-4xl', () => {
    const cls = panelAt('public/pages/app-shell.html', 'MODAL: ASSET CONFIGURATION');
    expect(cls).toContain('max-w-2xl');
    expect(cls).toContain('lg:max-w-4xl');
  });

  it('modal spare part, PM, dan detail WO punya max-w-lg lg:max-w-3xl', () => {
    const targets = [
      ['public/pages/app-shell.html', 'x-if="showPartModal"'],
      ['public/pages/PMSchedule.html', 'CRUD MODAL (Tactical Slate)'],
      ['public/pages/PlanningBoard.html', 'WO DETAIL MODAL'],
    ];
    for (const [file, needle] of targets) {
      const cls = panelAt(file, needle);
      expect(cls, `${file}: ${needle}`).toContain('max-w-lg');
      expect(cls, `${file}: ${needle}`).toContain('lg:max-w-3xl');
    }
  });
});

describe('satu scrollport per panel modal berform', () => {
  const modals = modalFormPanels();

  it('ada modal berform yang diperiksa', () => {
    expect(modals.length).toBeGreaterThan(0);
  });

  it.each(modals.map((m) => [m.flag, m]))(
    '%s: panel tidak memasang max-h-[90vh] di atas max-h-[calc(100dvh-2rem)]',
    (_flag, m) => {
      expect(m.panel, `baris ${m.line}`).toContain('max-h-[calc(100dvh-2rem)]');
      expect(m.panel, `baris ${m.line}: dua scrollport → footer sticky menumpuk`).not.toContain(
        'max-h-[90vh]',
      );
      // Panel tetap flex column (kontrak modal-scroll-contract.test.js).
      expect(m.panel, `baris ${m.line}`).toContain('flex flex-col');
    },
  );

  it('tidak ada panel berform yang lagi-lagi membawa overflow-y-auto + max-h viewport di panel', () => {
    const bad = [];
    for (const m of modals) {
      if (m.panel.includes('max-h-[90vh]') && m.panel.includes('overflow-y-auto')) {
        bad.push(`${m.flag} (baris ${m.line})`);
      }
    }
    expect(bad, `panel dengan dua scrollport:\n${bad.join('\n')}`).toEqual([]);
  });
});
