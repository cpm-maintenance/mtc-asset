import { describe, it, expect } from 'vitest';
import { app } from '../src/js/app.js';

/**
 * C-1 · Hero Metrics HUD unit tests.
 *
 * Verifikasi 4 kartu komposit:
 * 1. Plant Availability (PA %) + target + status optimal/warning/critical
 * 2. Reliability Core (MTBF & MTTR) dengan satuan hrs
 * 3. Work Order Health (Total, Done, In Progress, Pending, Rate %)
 * 4. PM Compliance & Overdue Risk
 */
describe('C-1 · Hero Metrics HUD', () => {
  it('menghitung rata-rata PA dan status target dengan benar', () => {
    const s = app();
    s.performanceData = [
      { wh: 24, bd: 2.4, stb: 0 }, // PA = 90%
      { wh: 24, bd: 0, stb: 0 },   // PA = 100%
    ];
    expect(s.heroHUD.pa.val).toBe(95);
    expect(s.heroHUD.pa.status).toBe('Optimal');
    expect(s.heroHUD.pa.color).toBe('emerald');
  });

  it('menghitung MTTR dan breakdown count dari log breakdown', () => {
    const s = app();
    s.logs = [
      { Jenis: 'Breakdown', Downtime: 4 },
      { Jenis: 'Breakdown', Downtime: 6 },
      { Jenis: 'PM', Downtime: 2 },
    ];
    expect(s.heroHUD.reliability.breakdowns).toBe(2);
    expect(s.heroHUD.reliability.mttr).toBe('5.0');
  });

  it('menghitung status WO health dan completion rate secara akurat', () => {
    const s = app();
    s.logs = [
      { woNumber: 'WO-1', Status: 'Completed' },
      { woNumber: 'WO-2', Status: 'Completed' },
      { woNumber: 'WO-3', Status: 'In Progress' },
      { woNumber: 'WO-4', Status: 'Pending' },
    ];
    expect(s.heroHUD.wo.total).toBe(4);
    expect(s.heroHUD.wo.done).toBe(2);
    expect(s.heroHUD.wo.inProgress).toBe(1);
    expect(s.heroHUD.wo.pending).toBe(1);
    expect(s.heroHUD.wo.rate).toBe(50);
  });

  it('menghubungkan PM compliance dan overdue risk', () => {
    const s = app();
    s.pmList = [
      { pmId: 'PM-1', status: 'completed' },
      { pmId: 'PM-2', status: 'pending', date: '2000-01-01' }, // overdue
    ];
    expect(s.heroHUD.pm.total).toBe(2);
    expect(s.heroHUD.pm.overdue).toBeGreaterThanOrEqual(1);
  });
});
