import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrak: request spare part TIDAK dibuat otomatis.
 *
 * Dulu `checkAllNotifications()` (jalan 5 detik setelah login + tiap 5 menit)
 * memanggil `window.app.autoReorderLowStock()` untuk admin/supervisor. Efeknya
 * di menu Request Part muncul permintaan sendiri untuk setiap part yang
 * `Stok <= MinStock` — pengguna tidak pernah menekan apa pun.
 *
 * Sekarang pembuatannya manual: fungsinya tetap ada, tapi hanya jalan kalau
 * admin/supervisor menekan tombol AUTO-REORDER di toolbar Request Part.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('request spare part — manual, bukan otomatis', () => {
  it('checkAllNotifications tidak lagi memanggil autoReorderLowStock', () => {
    const notif = read('src/js/modules/notification.js');
    expect(notif).not.toMatch(/autoReorderLowStock/);
    expect(notif).toContain('checkLowStockParts()');
  });

  it('menu Request Part punya pemicu manual untuk admin/supervisor', () => {
    const page = read('public/pages/RequestPart.html');
    expect(page).toContain('@click="autoReorderLowStock()"');
    expect(page).toMatch(/x-show="isAdminOrSupervisor"[^>]*@click="autoReorderLowStock\(\)"|@click="autoReorderLowStock\(\)"[^>]*/);
  });

  it('fungsinya masih tersedia (dipanggil manual, bukan dihapus)', () => {
    const req = read('src/js/modules/requisition.js');
    expect(req).toContain('async autoReorderLowStock()');
  });
});
