// @vitest-environment jsdom
import { it, expect } from 'vitest';
import fs from 'node:fs';

it('Request Part tidak membuat kolom implisit lewat span desktop pada grid responsif', () => {
  const host = document.createElement('div');
  host.innerHTML = fs.readFileSync('public/pages/RequestPart.html', 'utf8');
  const template = host.querySelector('template[x-for="(item, idx) in reqLineItems"]');
  const fields = template.content.querySelector('.form-grid');
  expect([...fields.children].map((el) => el.className).filter((c) => /\bcol-span-[23]\b/.test(c))).toEqual([]);
});

it('Performance tidak membuat kolom implisit untuk Target PA', () => {
  const host = document.createElement('div');
  host.innerHTML = fs.readFileSync('public/pages/app-shell.html', 'utf8');
  const template = host.querySelector('template[x-if="showPerformanceModal"]');
  const input = template.content.querySelector('[aria-label="PA plan"]');
  expect(input.parentElement.classList.contains('col-span-2')).toBe(false);
});

it('Request Part tidak memuat string path SVG bocor', () => {
  const src = fs.readFileSync('public/pages/RequestPart.html', 'utf8');
  expect(src).not.toMatch(/<\/svg>-8\.24/);
});

it('select compact memiliki padding kanan dan min-width max-content', () => {
  const css = fs.readFileSync('src/css/style.css', 'utf8');
  expect(css).toMatch(/:is\(select\.field-compact[^}]*padding-right:\s*28px/);
  expect(css).toMatch(/:is\(select\.field-compact[^}]*min-width:\s*max-content/);
});

it('grid form dan anaknya bisa menyusut tanpa intrinsic overflow', () => {
  const css = fs.readFileSync('src/css/style.css', 'utf8');
  expect(css).toMatch(/\.form-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  expect(css).toMatch(/\.form-grid\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
});
