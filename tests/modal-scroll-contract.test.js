import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak tata letak modal: semua modal yang memuat `<form>`.
 *
 * Modal di app-shell memakai `p-5 sm:p-8 lg:p-10` tanpa batas tinggi. Di layar
 * pendek (laptop 768p, zoom 80%, atau jendela DevTools terbuka) isinya lebih
 * tinggi dari viewport: seksi paling bawah dan tombol submit terpotong tanpa
 * cara menjangkaunya — tidak ada scroll di dalam modal. Dulu yang bocor hanya
 * form Register Part; sekarang kontraknya berlaku untuk semua modal berisi form.
 *
 * Kontrak per modal:
 *   1. panel dibatasi tinggi viewport  → `max-h-[calc(100dvh-2rem)]`
 *   2. panel bertumpuk                 → `flex flex-col`
 *   3. badan form yang scroll          → `flex-1 min-h-0 overflow-y-auto`
 *   4. tombol submit menempel di bawah → `sticky bottom-0`
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = fs.readFileSync(path.join(ROOT, 'public', 'pages', 'app-shell.html'), 'utf-8');

/** Semua balok `<template x-if="…Modal…">` yang memuat form, lengkap dengan nomor baris. */
const modalForms = () => {
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
    out.push({ flag: open[1], line: SHELL.slice(0, open.index).split('\n').length, block });
  }
  return out;
};

/** Balok satu modal berdasarkan flag-nya. */
const modalBlock = (flag) => {
  const start = SHELL.indexOf(`<template x-if="${flag}">`);
  expect(start, `template x-if="${flag}" tidak ditemukan`).toBeGreaterThan(-1);
  const tag = /<template\b|<\/template>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let m = tag.exec(SHELL); m; m = tag.exec(SHELL)) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return SHELL.slice(start, m.index);
  }
  throw new Error(`blok ${flag} tidak tertutup`);
};

const modals = modalForms();

describe('modal berform — muat di layar pendek', () => {
  it('ada modal berform yang diperiksa', () => {
    expect(modals.length).toBeGreaterThan(0);
  });

  it.each(modals.map((m) => [m.flag, m]))('%s: panel dibatasi tinggi + flex column', (_flag, m) => {
    const panel = m.block.slice(m.block.indexOf('bg-tac-surface-card/95'), m.block.indexOf('<form'));
    expect(panel, `baris ${m.line}`).toContain('max-h-[calc(100dvh-2rem)]');
    expect(panel, `baris ${m.line}`).toContain('flex flex-col');
  });

  it.each(modals.map((m) => [m.flag, m]))('%s: badan form yang scroll', (_flag, m) => {
    const form = m.block.slice(m.block.indexOf('<form'), m.block.indexOf('</form>'));
    expect(form, `baris ${m.line}`).toContain('overflow-y-auto');
    expect(form, `baris ${m.line}`).toContain('min-h-0');
  });

  it.each(modals.map((m) => [m.flag, m]))('%s: tombol aksi menempel di bawah', (_flag, m) => {
    const form = m.block.slice(m.block.indexOf('<form'), m.block.indexOf('</form>'));
    // Tombol submit sendiri yang sticky, atau terbungkus footer sticky (modal log).
    const at = form.lastIndexOf('sticky bottom-0');
    expect(at, `baris ${m.line}`).toBeGreaterThan(-1);
    expect(at / form.length, `baris ${m.line}`).toBeGreaterThan(0.8);
  });

  it.each(modals.map((m) => [m.flag, m]))('%s: header modal tidak ikut ter-scroll', (_flag, m) => {
    const header = m.block.slice(m.block.indexOf('flex justify-between'), m.block.indexOf('<form'));
    expect(header, `baris ${m.line}`).toContain('shrink-0');
  });

  it('modal QR preview tanpa form pun dibatasi tinggi layar', () => {
    // Kartu tag 628 px + padding: tanpa batas tinggi, panelnya terpotong atas-bawah
    // di layar 600 px (DevTools terbuka). Panelnya sendiri yang jadi area scroll.
    const block = modalBlock('showQRPreviewModal');
    const panel = block.slice(block.indexOf('bg-tac-surface-card/95'));
    expect(panel).toContain('max-h-[calc(100dvh-2rem)]');
    expect(panel).toContain('overflow-y-auto');
  });
});
