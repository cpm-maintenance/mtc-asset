import { describe, it, expect, vi } from 'vitest';
import { makeApp } from './helpers/app-harness.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Read a repo file from the tests directory. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (/** @type {string} */ rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('Kanban Work Orders — multi-select checkbox', () => {
  it('markup: kartu kanban punya checkbox terikat ke woSelectedIds + marker pilihan', () => {
    const html = read('public/pages/WorkOrders.html');
    const kanban = html.split('<!-- View: KANBAN STACK -->')[1];
    expect(kanban).toContain('x-model="woSelectedIds" :value="log.LogID"');
    expect(kanban).toContain('@click.stop');
    expect(kanban).toContain('woSelectedIds.includes(log.LogID)');
    expect(kanban).toContain('check_circle');
  });

  it('state: toggleWOSelect menambah / menghapus id sesuai keadaan', () => {
    const s = makeApp({
      logs: Array.from({ length: 5 }, (_, i) => ({ LogID: `L${i}`, Status: 'Pending' })),
    });
    expect(s.woSelectedIds).toEqual([]);
    s.toggleWOSelect('L1');
    expect(s.woSelectedIds).toEqual(['L1']);
    s.toggleWOSelect('L1');
    expect(s.woSelectedIds).toEqual([]);
    s.toggleWOSelect('L2');
    s.toggleWOSelect('L3');
    expect(s.woSelectedIds).toEqual(['L2', 'L3']);
  });

  it('state: woAllVisibleSelected / toggleSelectAllWOs mengambil/tabling filter tampilan', () => {
    const s = makeApp({
      logs: Array.from({ length: 5 }, (_, i) => ({ LogID: `L${i}`, Status: 'Pending', Jenis: 'Repair' })),
    });
    // Belum ada yang terpilih
    expect(s.woAllVisibleSelected).toBe(false);

    s.toggleWOSelect('L1');
    expect(s.woAllVisibleSelected).toBe(false);

    s.toggleSelectAllWOs();
    expect(s.woAllVisibleSelected).toBe(true);
    expect(s.woSelectedIds).toEqual(['L0', 'L1', 'L2', 'L3', 'L4']);
  });

  it('state: bulkDeleteWOs menghapus node lalu membersihkan seleksi', async () => {
    const bulkDeleteItems = vi.fn(async () => 3);
    const s = makeApp({
      logs: Array.from({ length: 5 }, (_, i) => ({ LogID: `L${i}`, Status: 'Pending' })),
      bulkDeleteItems,
    });
    s.woSelectedIds = ['L1', 'L3'];
    await s.bulkDeleteWOs();
    expect(bulkDeleteItems).toHaveBeenCalledWith('HistoryLog', ['L1', 'L3'], 'work order');
    expect(s.woSelectedIds).toEqual([]);
  });
});
