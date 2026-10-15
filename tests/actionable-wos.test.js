import { describe, it, expect } from 'vitest';
import { app } from '../src/js/app.js';

/**
 * C-3 · Actionable Work Orders Priority List.
 *
 * Menguji getter `actionableWOs`:
 * - Hanya menampilkan WO yang belum ditutup (Completed/Cancelled/Rejected).
 * - Mengurutkan berdasarkan urgensi: Breakdown/Emergency (5/4) > Urgent (3) > Normal (2) > Planned (1),
 *   lalu umur WO (paling lama terbuka di atas).
 * - Maksimal 5 item teratas.
 */
describe('C-3 · Actionable Work Orders Priority List', () => {
  it('menyaring WO tertutup dan mengurutkan berdasarkan skor prioritas', () => {
    const s = app();
    s.logs = [
      { LogID: '1', woNumber: 'WO-101', Status: 'Completed', woPriority: 'Emergency' },
      { LogID: '2', woNumber: 'WO-102', Status: 'Pending', woPriority: 'Normal', Tanggal: '2026-10-01' },
      { LogID: '3', woNumber: 'WO-103', Status: 'In Progress', woPriority: 'Emergency', Tanggal: '2026-10-05' },
      { LogID: '4', woNumber: 'WO-104', Status: 'Pending', Jenis: 'Breakdown', Tanggal: '2026-10-04' },
      { LogID: '5', woNumber: 'WO-105', Status: 'Pending', woPriority: 'Urgent', Tanggal: '2026-10-02' },
    ];

    const actions = s.actionableWOs;
    expect(actions).toHaveLength(4);
    // Breakdown (skor 5) harus pertama
    expect(actions[0].woNumber).toBe('WO-104');
    // Emergency (skor 4) harus kedua
    expect(actions[1].woNumber).toBe('WO-103');
    // Urgent (skor 3) harus ketiga
    expect(actions[2].woNumber).toBe('WO-105');
    // Normal (skor 2) harus keempat
    expect(actions[3].woNumber).toBe('WO-102');
  });

  it('membatasi hasil maksimal 5 item', () => {
    const s = app();
    s.logs = Array.from({ length: 10 }, (_, i) => ({
      LogID: String(i),
      woNumber: `WO-${i}`,
      Status: 'Pending',
      woPriority: 'Normal',
      Tanggal: '2026-10-01',
    }));

    expect(s.actionableWOs).toHaveLength(5);
  });
});
