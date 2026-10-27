import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak markup multi-select: Spare Parts, Work Orders, Request Part.
 *
 * Tiap menu punya: checkbox per baris (terikat ke array seleksi), kontrol
 * PILIH SEMUA, dan tombol hapus massal yang hanya tampil untuk
 * admin/supervisor. Tombol hapus massal wajib menyebut jumlah terpilih supaya
 * tidak ada penghapusan "buta".
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const MENUS = [
  {
    page: 'public/pages/SpareParts.html',
    select: 'partSelectedIds',
    all: 'toggleSelectAllParts()',
    del: 'bulkDeleteParts()',
  },
  {
    page: 'public/pages/WorkOrders.html',
    select: 'woSelectedIds',
    all: 'toggleSelectAllWOs()',
    del: 'bulkDeleteWOs()',
  },
  {
    page: 'public/pages/RequestPart.html',
    select: 'reqSelectedIds',
    all: 'toggleSelectAllRequisitions()',
    del: 'bulkDeleteRequisitions()',
  },
];

describe('multi-select & hapus massal — markup tiga menu', () => {
  it.each(MENUS)('$page: checkbox baris terikat ke $select', ({ page, select }) => {
    const html = read(page);
    expect(html).toContain(`x-model="${select}"`);
    expect(html).toMatch(/type="checkbox"/);
  });

  it.each(MENUS)('$page: ada kontrol $all', ({ page, all }) => {
    expect(read(page)).toContain(`@click="${all}"`);
  });

  it.each(MENUS)('$page: tombol $del hanya untuk admin/supervisor dan menyebut jumlah', ({ page, del, select }) => {
    const html = read(page);
    const at = html.indexOf(`@click="${del}"`);
    expect(at, `tombol ${del} tidak ada di ${page}`).toBeGreaterThan(-1);
    const button = html.slice(html.lastIndexOf('<button', at), html.indexOf('</button>', at));
    expect(button).toContain('isAdminOrSupervisor');
    expect(button).toContain(`${select}.length`);
  });
});

describe('Request Part — checkbox terlihat di tiap baris (setara Spare Parts)', () => {
  it('checkbox baris ada di header baris, bukan hanya di panel detail', () => {
    const html = read('public/pages/RequestPart.html');
    // Header baris dipakai untuk buka/tutup detail, jadi checkbox-nya wajib
    // `@click.stop` supaya mencentang tidak sekaligus membuka detail.
    const rowCheckbox = html.match(/<input[^>]*@click\.stop[^>]*x-model="reqSelectedIds"[^>]*>/);
    expect(rowCheckbox, 'checkbox baris Request Part tidak ada di header baris').not.toBeNull();

    // Checkbox baris harus muncul sebelum blok detail (daftar item request).
    const firstCheckbox = html.indexOf('x-model="reqSelectedIds"');
    const detailItems = html.indexOf('req.items');
    expect(detailItems).toBeGreaterThan(-1);
    expect(firstCheckbox).toBeLessThan(detailItems);
  });
});
