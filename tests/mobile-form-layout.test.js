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

it('select compact memiliki padding kanan dan min-width/max-width adaptif', () => {
  const css = fs.readFileSync('src/css/style.css', 'utf8');
  expect(css).toMatch(/:is\(select\.field-compact[^}]*padding-right:\s*24px/);
  expect(css).toMatch(/:is\(select\.field-compact[^}]*min-width:\s*0/);
});

it('grid form dan anaknya bisa menyusut tanpa intrinsic overflow', () => {
  const css = fs.readFileSync('src/css/style.css', 'utf8');
  expect(css).toMatch(/\.form-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  expect(css).toMatch(/\.form-grid\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
});

it('WorkOrders status filter buttons memakai shrink-0 dan whitespace-nowrap', () => {
  const src = fs.readFileSync('public/pages/WorkOrders.html', 'utf8');
  expect(src).toMatch(/role="group" aria-label="Filter status"[\s\S]*?whitespace-nowrap shrink-0/);
});

it('Mobile font controls tidak memaksa 16px pada field compact', () => {
  const css = fs.readFileSync('src/css/style.css', 'utf8');
  expect(css).toMatch(/@media \(max-width:\s*767px\)/);
  expect(css).toMatch(/:is\(input, select, textarea\)\s*\{\s*font-size:\s*14px;/);
  expect(css).toMatch(/select\.field-compact[^}]*font-size:\s*12px !important;/);
});

it('seluruh binding direktif Alpine tidak memuat tag penutup HTML nyasar seperti </label>', () => {
  const dir = 'public/pages';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  for (const file of files) {
    const content = fs.readFileSync(`${dir}/${file}`, 'utf8');
    const broken = content.match(/(:[a-zA-Z0-9_\-.]+|@[a-zA-Z0-9_\-.]+|x-[a-zA-Z0-9_\-.]+)\s*=\s*"[^"]*<\/[a-zA-Z]+>[^"]*"/g);
    expect(broken || [], `Tag HTML nyasar di dalam atribut Alpine pada ${file}`).toEqual([]);
  }
});

it('PMSchedule header select-all checkbox tidak memuat tag HTML di dalam ekspresi :checked', () => {
  const src = fs.readFileSync('public/pages/PMSchedule.html', 'utf8');
  expect(src).not.toMatch(/:checked="[^"]*<\/label>[^"]*"/);
  expect(src).toMatch(/:checked="pmGetFilteredList\(\)\.filter\(p => p\.status==='pending'\)/);
});
