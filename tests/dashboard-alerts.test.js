import { describe, it, expect } from 'vitest';
import { app } from '../src/js/app.js';

/**
 * U-4 · Banner Live Breakdown / Critical Downtime di Dashboard.
 *
 * Menguji getter `criticalDowntimeList` (sumber data banner) beserta
 * `criticalDowntimeCount` dan `criticalDowntimeLabel`.
 *
 * Aturan bisnis: WO dianggap kritis bila belum ditutup (bukan Completed/
 * Cancelled/Rejected) DAN prioritasnya Emergency/Urgent atau jenisnya Breakdown.
 */
describe('U-4 · Critical downtime banner', () => {
  const build = (logs, equipment = []) => {
    const s = app();
    s.logs = logs;
    s.equipment = equipment;
    return s;
  };

  it('menangkap WO Emergency yang belum selesai', () => {
    const s = build([
      { LogID: 'L1', woNumber: 'MTC-001', Status: 'Pending', woPriority: 'Emergency', EquipmentID: 'EQ1', Jenis: 'Repair' },
    ]);
    expect(s.criticalDowntimeCount).toBe(1);
    expect(s.criticalDowntimeList[0].priority).toBe('Emergency');
    expect(s.criticalDowntimeList[0].isEmergency).toBe(true);
  });

  it('menangkap WO jenis Breakdown walau prioritasnya Normal', () => {
    const s = build([
      { LogID: 'L1', woNumber: 'MTC-002', Status: 'In Progress', woPriority: 'Normal', Jenis: 'Breakdown', EquipmentID: 'EQ1' },
    ]);
    expect(s.criticalDowntimeCount).toBe(1);
    expect(s.criticalDowntimeList[0].isEmergency).toBe(true);
    expect(s.criticalDowntimeList[0].priority).toBe('Normal');
  });

  it('mengabaikan WO yang sudah ditutup (Completed/Cancelled/Rejected)', () => {
    const s = build([
      { LogID: 'L1', Status: 'Completed', woPriority: 'Emergency', Jenis: 'Breakdown' },
      { LogID: 'L2', Status: 'Cancelled', woPriority: 'Emergency', Jenis: 'Breakdown' },
      { LogID: 'L3', Status: 'Rejected', woPriority: 'Emergency', Jenis: 'Breakdown' },
    ]);
    expect(s.criticalDowntimeCount).toBe(0);
    expect(s.criticalDowntimeLabel).toBe('');
  });

  it('mengabaikan WO rutin (PM / Normal)', () => {
    const s = build([
      { LogID: 'L1', Status: 'Pending', woPriority: 'Normal', Jenis: 'PM' },
      { LogID: 'L2', Status: 'Pending', woPriority: 'Planned', Jenis: 'Service' },
    ]);
    expect(s.criticalDowntimeCount).toBe(0);
  });

  it('memakai nama equipment dari master data, fallback ke EquipmentID lalu externalEquipName', () => {
    const s = build(
      [
        { LogID: 'L1', Status: 'Pending', woPriority: 'Emergency', EquipmentID: 'EQ1' },
        { LogID: 'L2', Status: 'Pending', woPriority: 'Emergency', EquipmentID: 'EQ-MISSING' },
        { LogID: 'L3', Status: 'Pending', woPriority: 'Emergency', EquipmentID: '', externalEquipName: 'Pump Vendor X' },
      ],
      [{ EquipmentID: 'EQ1', Nama: 'Ball Mill 01' }],
    );
    const names = s.criticalDowntimeList.map(x => x.equipName).sort();
    expect(names).toContain('Ball Mill 01');
    expect(names).toContain('EQ-MISSING');
    expect(names).toContain('Pump Vendor X');
  });

  it('mengurutkan yang Emergency di atas Urgent, lalu yang paling lama terbuka', () => {
    const s = build([
      { LogID: 'L1', Status: 'Pending', woPriority: 'Urgent', Jenis: 'Repair', Tanggal: '2000-01-01' },
      { LogID: 'L2', Status: 'Pending', woPriority: 'Emergency', Jenis: 'Repair', Tanggal: '2999-01-01' },
    ]);
    expect(s.criticalDowntimeList[0].priority).toBe('Emergency');
    expect(s.criticalDowntimeList[1].priority).toBe('Urgent');
  });

  it('menghitung umur WO dalam hari', () => {
    const s = build([
      { LogID: 'L1', Status: 'Pending', woPriority: 'Emergency', Jenis: 'Repair', Tanggal: '2000-01-01' },
    ]);
    expect(s.criticalDowntimeList[0].ageDays).toBeGreaterThan(365);
  });

  it('label aksesibel memakai bentuk tunggal dan jamak yang benar', () => {
    const one = build([{ LogID: 'L1', Status: 'Pending', woPriority: 'Emergency' }]);
    expect(one.criticalDowntimeLabel).toBe('1 unit needs immediate attention');

    const two = build([
      { LogID: 'L1', Status: 'Pending', woPriority: 'Emergency' },
      { LogID: 'L2', Status: 'Pending', woPriority: 'Urgent' },
    ]);
    expect(two.criticalDowntimeLabel).toBe('2 units need immediate attention');
  });

  it('aman ketika logs belum termuat', () => {
    const s = app();
    s.logs = undefined;
    expect(s.criticalDowntimeCount).toBe(0);
    expect(s.criticalDowntimeList).toEqual([]);
  });
});
