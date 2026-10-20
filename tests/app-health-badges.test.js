// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` rentang 950-1230:
 * helper pill/marker WO (woStatusTac, woPriorityTac, woMarkerTac, woElapsed),
 * format rupiah (rp, rpShort), Priority Scoring Matrix (woPrioScore,
 * criticalityScore, healthRiskScore, backlogScore, backlogScoreColor),
 * MTTR per teknisi (mttrByTech, _tech, techMttr, techBreakdowns),
 * badge sidebar (badgeCount, badgeClass, badgeLabel), dan canAccess.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

beforeEach(() => {
  stubFirebase();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('woStatusTac', () => {
  it('Completed memakai token operational', () => {
    expect(makeApp().woStatusTac('Completed')).toBe('bg-tac-status-operational/15 text-tac-status-operational');
  });

  it('In Progress memakai token sync-cyan', () => {
    expect(makeApp().woStatusTac('In Progress')).toBe('bg-tac-sync-cyan/15 text-tac-sync-cyan');
  });

  it('Approved memakai token secondary', () => {
    expect(makeApp().woStatusTac('Approved')).toBe('bg-tac-secondary/15 text-tac-secondary');
  });

  it('Cancelled dan Rejected memakai token emergency', () => {
    const a = makeApp();
    expect(a.woStatusTac('Cancelled')).toBe('bg-tac-status-emergency/15 text-tac-status-emergency');
    expect(a.woStatusTac('Rejected')).toBe('bg-tac-status-emergency/15 text-tac-status-emergency');
  });

  it('status kosong atau tak dikenal jatuh ke token repair', () => {
    const a = makeApp();
    expect(a.woStatusTac('Pending')).toBe('bg-tac-status-repair/15 text-tac-status-repair');
    expect(a.woStatusTac('')).toBe('bg-tac-status-repair/15 text-tac-status-repair');
    expect(a.woStatusTac(undefined)).toBe('bg-tac-status-repair/15 text-tac-status-repair');
    expect(a.woStatusTac('Aneh')).toBe('bg-tac-status-repair/15 text-tac-status-repair');
  });
});

describe('woPriorityTac', () => {
  it('Emergency memakai token emergency dengan opasitas 20', () => {
    expect(makeApp().woPriorityTac('Emergency')).toBe('bg-tac-status-emergency/20 text-tac-status-emergency');
  });

  it('Urgent memakai token repair', () => {
    expect(makeApp().woPriorityTac('Urgent')).toBe('bg-tac-status-repair/20 text-tac-status-repair');
  });

  it('Planned memakai token secondary', () => {
    expect(makeApp().woPriorityTac('Planned')).toBe('bg-tac-secondary/15 text-tac-secondary');
  });

  it('Normal dan nilai kosong memakai token surface netral', () => {
    const a = makeApp();
    expect(a.woPriorityTac('Normal')).toBe('bg-tac-surface-container-highest text-tac-on-surface-variant');
    expect(a.woPriorityTac(undefined)).toBe('bg-tac-surface-container-highest text-tac-on-surface-variant');
  });
});

describe('woMarkerTac', () => {
  it('Completed menang atas prioritas Emergency', () => {
    const a = makeApp();
    expect(a.woMarkerTac({ Status: 'Completed', woPriority: 'Emergency' })).toBe('bg-tac-status-operational');
  });

  it('Cancelled dan Rejected memakai marker standby', () => {
    const a = makeApp();
    expect(a.woMarkerTac({ Status: 'Cancelled' })).toBe('bg-tac-status-standby');
    expect(a.woMarkerTac({ Status: 'Rejected' })).toBe('bg-tac-status-standby');
  });

  it('prioritas Emergency memakai marker emergency', () => {
    expect(makeApp().woMarkerTac({ Status: 'Pending', woPriority: 'Emergency' })).toBe('bg-tac-status-emergency');
  });

  it('Jenis Breakdown memakai marker emergency', () => {
    expect(makeApp().woMarkerTac({ Status: 'Pending', Jenis: 'Breakdown' })).toBe('bg-tac-status-emergency');
  });

  it('In Progress memakai marker sync-cyan', () => {
    expect(makeApp().woMarkerTac({ Status: 'In Progress' })).toBe('bg-tac-sync-cyan');
  });

  it('prioritas Urgent memakai marker repair', () => {
    expect(makeApp().woMarkerTac({ Status: 'Pending', woPriority: 'Urgent' })).toBe('bg-tac-status-repair');
  });

  it('WO tanpa data memakai marker standby', () => {
    const a = makeApp();
    expect(a.woMarkerTac({ Status: 'Pending', woPriority: 'Normal' })).toBe('bg-tac-status-standby');
    expect(a.woMarkerTac(null)).toBe('bg-tac-status-standby');
  });
});

describe('woElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  });

  it('mengembalikan "-" bila log atau Tanggal kosong', () => {
    const a = makeApp();
    expect(a.woElapsed(null)).toBe('-');
    expect(a.woElapsed({})).toBe('-');
  });

  it('mengembalikan "-" bila Tanggal tidak valid', () => {
    expect(makeApp().woElapsed({ Tanggal: 'bukan-tanggal' })).toBe('-');
  });

  it('memakai format hari + jam untuk WO lebih dari sehari', () => {
    expect(makeApp().woElapsed({ Tanggal: '2026-10-17T09:00:00Z' })).toBe('3d 3h');
  });

  it('memakai format jam + menit untuk WO kurang dari sehari', () => {
    expect(makeApp().woElapsed({ Tanggal: '2026-10-20T06:40:00Z' })).toBe('5h 20m');
  });

  it('membatasi umur negatif menjadi nol', () => {
    expect(makeApp().woElapsed({ Tanggal: '2026-10-22T12:00:00Z' })).toBe('0h 0m');
  });
});

describe('rp', () => {
  it('memformat ribuan dengan pemisah titik gaya id-ID', () => {
    expect(makeApp().rp(1234567)).toBe('Rp 1.234.567');
  });

  it('membulatkan nilai pecahan dan string numerik', () => {
    const a = makeApp();
    expect(a.rp(1500.6)).toBe('Rp 1.501');
    expect(a.rp('2500')).toBe('Rp 2.500');
  });

  it('mengembalikan Rp 0 untuk nilai kosong atau tidak valid', () => {
    const a = makeApp();
    expect(a.rp(null)).toBe('Rp 0');
    expect(a.rp(undefined)).toBe('Rp 0');
    expect(a.rp('abc')).toBe('Rp 0');
  });
});

describe('rpShort', () => {
  it('memakai satuan T untuk triliunan', () => {
    expect(makeApp().rpShort(1.25e12)).toBe('Rp 1,3 T');
  });

  it('memakai satuan M untuk miliaran', () => {
    expect(makeApp().rpShort(2.5e9)).toBe('Rp 2,5 M');
  });

  it('memakai satuan jt untuk jutaan', () => {
    expect(makeApp().rpShort(1.5e6)).toBe('Rp 1,5 jt');
  });

  it('memakai satuan rb untuk ribuan', () => {
    expect(makeApp().rpShort(1500)).toBe('Rp 2 rb');
  });

  it('menampilkan nilai apa adanya di bawah seribu', () => {
    expect(makeApp().rpShort(999)).toBe('Rp 999');
  });

  it('memakai nilai absolut untuk angka negatif', () => {
    expect(makeApp().rpShort(-2.5e9)).toBe('Rp 2,5 M');
  });
});

describe('woPrioScore', () => {
  it('memetakan seluruh prioritas WO ke bobot matriks', () => {
    const a = makeApp();
    expect(a.woPrioScore({ woPriority: 'Emergency' })).toBe(3);
    expect(a.woPrioScore({ woPriority: 'Urgent' })).toBe(2.5);
    expect(a.woPrioScore({ woPriority: 'High' })).toBe(2);
    expect(a.woPrioScore({ woPriority: 'Normal' })).toBe(1);
    expect(a.woPrioScore({ woPriority: 'Low' })).toBe(0.5);
    expect(a.woPrioScore({ woPriority: 'Planned' })).toBe(0.5);
  });

  it('memakai field priority bila woPriority tidak ada', () => {
    expect(makeApp().woPrioScore({ priority: 'Urgent' })).toBe(2.5);
  });

  it('jatuh ke bobot Normal bila prioritas kosong', () => {
    expect(makeApp().woPrioScore({})).toBe(1);
  });

  it('jatuh ke 1 untuk prioritas tak dikenal', () => {
    expect(makeApp().woPrioScore({ woPriority: 'Entah' })).toBe(1);
  });
});

describe('criticalityScore', () => {
  it('memetakan criticality equipment ke skor 3/2/1', () => {
    const a = makeApp({
      equipment: [
        { EquipmentID: 'EQ-H', criticality: 'High' },
        { EquipmentID: 'EQ-M', criticality: 'Medium' },
        { EquipmentID: 'EQ-L', criticality: 'Low' },
      ],
    });
    expect(a.criticalityScore('EQ-H')).toBe(3);
    expect(a.criticalityScore('EQ-M')).toBe(2);
    expect(a.criticalityScore('EQ-L')).toBe(1);
  });

  it('mengembalikan 1 bila equipment tidak ditemukan atau daftar kosong', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ-H', criticality: 'High' }] });
    expect(a.criticalityScore('EQ-X')).toBe(1);
    expect(makeApp({ equipment: [] }).criticalityScore('EQ-H')).toBe(1);
    expect(makeApp({ equipment: undefined }).criticalityScore('EQ-H')).toBe(1);
  });

  it('memakai ulang cache selama referensi equipment tidak berubah', () => {
    const eq = [{ EquipmentID: 'EQ1', criticality: 'High' }];
    const a = makeApp({ equipment: eq });
    expect(a.criticalityScore('EQ1')).toBe(3);
    eq.push({ EquipmentID: 'EQ2', criticality: 'Medium' });
    // cache lama masih dipakai → EQ2 belum terlihat
    expect(a.criticalityScore('EQ2')).toBe(1);
    a.equipment = [...eq];
    expect(a.criticalityScore('EQ2')).toBe(2);
  });
});

describe('healthRiskScore', () => {
  it('mengembalikan 0 bila calculateHealthScore tidak tersedia', () => {
    const a = makeApp({ calculateHealthScore: undefined });
    expect(a.healthRiskScore('EQ1')).toBe(0);
  });

  it('mengembalikan 0 bila skor health null atau nol', () => {
    expect(makeApp({ calculateHealthScore: () => null }).healthRiskScore('EQ1')).toBe(0);
    expect(makeApp({ calculateHealthScore: () => ({ score: 0 }) }).healthRiskScore('EQ1')).toBe(0);
  });

  it('memetakan skor health < 50 ke risiko 3', () => {
    expect(makeApp({ calculateHealthScore: () => ({ score: 40 }) }).healthRiskScore('EQ1')).toBe(3);
  });

  it('memetakan skor health 50-79 ke risiko 1.5', () => {
    expect(makeApp({ calculateHealthScore: () => ({ score: 50 }) }).healthRiskScore('EQ1')).toBe(1.5);
    expect(makeApp({ calculateHealthScore: () => ({ score: 79 }) }).healthRiskScore('EQ1')).toBe(1.5);
  });

  it('memetakan skor health >= 80 ke risiko 0', () => {
    expect(makeApp({ calculateHealthScore: () => ({ score: 80 }) }).healthRiskScore('EQ1')).toBe(0);
  });
});

describe('backlogScore', () => {
  it('tanpa EquipmentID hanya memakai skor prioritas', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', criticality: 'High' }] });
    expect(a.backlogScore({})).toBe(1);
    expect(a.backlogScore({ woPriority: 'Emergency' })).toBe(3);
  });

  it('menjumlahkan prioritas + criticality + risiko health', () => {
    const a = makeApp({
      equipment: [{ EquipmentID: 'EQ1', criticality: 'High' }],
      calculateHealthScore: () => ({ score: 30 }),
    });
    expect(a.backlogScore({ woPriority: 'Urgent', EquipmentID: 'EQ1' })).toBe(9);
  });

  it('membulatkan hasil penjumlahan pecahan', () => {
    const a = makeApp({
      equipment: [{ EquipmentID: 'EQ1', criticality: 'Medium' }],
      calculateHealthScore: () => ({ score: 60 }),
    });
    // 2.5 + 2 + 1.5 = 6
    expect(a.backlogScore({ woPriority: 'Urgent', EquipmentID: 'EQ1' })).toBe(6);
    // 0.5 + 2 + 1.5 = 4 → dibulatkan dari 4
    expect(a.backlogScore({ woPriority: 'Low', EquipmentID: 'EQ1' })).toBe(4);
  });
});

describe('backlogScoreColor', () => {
  it('skor >= 7 memakai token emergency', () => {
    expect(makeApp().backlogScoreColor(7)).toBe(
      'bg-tac-status-emergency/20 text-tac-status-emergency border-tac-status-emergency/30',
    );
  });

  it('skor 4-6 memakai token repair', () => {
    const a = makeApp();
    expect(a.backlogScoreColor(4)).toBe('bg-tac-status-repair/20 text-tac-status-repair border-tac-status-repair/30');
    expect(a.backlogScoreColor(6)).toBe('bg-tac-status-repair/20 text-tac-status-repair border-tac-status-repair/30');
  });

  it('skor < 4 memakai token standby', () => {
    expect(makeApp().backlogScoreColor(3)).toBe(
      'bg-tac-status-standby/15 text-tac-status-standby border-tac-status-standby/20',
    );
  });
});

describe('mttrByTech', () => {
  it('mengagregasi jumlah repair, total downtime, dan breakdown per teknisi', () => {
    const a = makeApp({
      logs: [
        { assignedTo: 'Budi', Downtime: 10, Jenis: 'Breakdown' },
        { assignedTo: 'Budi', Downtime: 20, Jenis: 'Preventive' },
        { assignedTo: 'Sari', Downtime: 5, Jenis: 'Breakdown' },
      ],
    });
    const list = a.mttrByTech();
    expect(list).toHaveLength(2);
    const budi = list.find((t) => t.name === 'Budi');
    expect(budi).toEqual({ name: 'Budi', mttr: 15, breakdowns: 1 });
    const sari = list.find((t) => t.name === 'Sari');
    expect(sari).toEqual({ name: 'Sari', mttr: 5, breakdowns: 1 });
  });

  it('melewati log tanpa teknisi atau tanpa downtime', () => {
    const a = makeApp({
      logs: [
        { Downtime: 10 },
        { assignedTo: 'Budi', Downtime: 0 },
        { assignedTo: 'Budi' },
        null,
      ],
    });
    expect(a.mttrByTech()).toEqual([]);
  });

  it('membulatkan MTTR satu desimal', () => {
    const a = makeApp({
      logs: [
        { assignedTo: 'Budi', Downtime: 10 },
        { assignedTo: 'Budi', Downtime: 20 },
        { assignedTo: 'Budi', Downtime: 31 },
      ],
    });
    expect(a.mttrByTech()[0].mttr).toBe(20.3);
  });

  it('memakai ulang cache selama referensi logs tidak berubah', () => {
    const logs = [{ assignedTo: 'Budi', Downtime: 10 }];
    const a = makeApp({ logs });
    const first = a.mttrByTech();
    expect(a.mttrByTech()).toBe(first);
    logs.push({ assignedTo: 'Sari', Downtime: 4 });
    expect(a.mttrByTech()).toBe(first);
  });

  it('membangun ulang cache saat logs diganti', () => {
    const a = makeApp({ logs: [{ assignedTo: 'Budi', Downtime: 10 }] });
    expect(a.mttrByTech().map((t) => t.name)).toEqual(['Budi']);
    a.logs = [{ assignedTo: 'Sari', Downtime: 4 }];
    expect(a.mttrByTech().map((t) => t.name)).toEqual(['Sari']);
  });
});

describe('_tech, techMttr, techBreakdowns', () => {
  it('mengembalikan entri teknisi dari cache', () => {
    const a = makeApp({ logs: [{ assignedTo: 'Budi', Downtime: 10, Jenis: 'Breakdown' }] });
    expect(a._tech('Budi')).toEqual({ name: 'Budi', mttr: 10, breakdowns: 1 });
  });

  it('mengembalikan undefined untuk teknisi tak dikenal', () => {
    expect(makeApp({ logs: [] })._tech('Tidak Ada')).toBeUndefined();
  });

  it('techMttr mengembalikan 0 untuk teknisi tak dikenal', () => {
    const a = makeApp({ logs: [{ assignedTo: 'Budi', Downtime: 12 }] });
    expect(a.techMttr('Budi')).toBe(12);
    expect(a.techMttr('Tidak Ada')).toBe(0);
  });

  it('techBreakdowns mengembalikan jumlah breakdown teknisi', () => {
    const a = makeApp({
      logs: [
        { assignedTo: 'Budi', Downtime: 4, Jenis: 'Breakdown' },
        { assignedTo: 'Budi', Downtime: 6, Jenis: 'Breakdown' },
      ],
    });
    expect(a.techBreakdowns('Budi')).toBe(2);
    expect(a.techBreakdowns('Tidak Ada')).toBe(0);
  });

  it('membangun cache lebih dulu bila logs berubah', () => {
    const a = makeApp({ logs: [{ assignedTo: 'Budi', Downtime: 10 }] });
    expect(a.techMttr('Budi')).toBe(10);
    a.logs = [{ assignedTo: 'Sari', Downtime: 7, Jenis: 'Breakdown' }];
    expect(a.techMttr('Sari')).toBe(7);
    expect(a.techBreakdowns('Sari')).toBe(1);
  });
});

describe('badgeCount', () => {
  it('mengembalikan string kosong bila hitungan nol', () => {
    const a = makeApp({ openWOCount: 0, pmOverdueCount: 0, lowStockCount: 0, pendingReqCount: 0 });
    expect(a.badgeCount('wo')).toBe('');
    expect(a.badgeCount('pms')).toBe('');
  });

  it('memakai sumber hitungan yang tepat per item menu', () => {
    const a = makeApp({ openWOCount: 3, pmOverdueCount: 4, lowStockCount: 5, pendingReqCount: 6 });
    expect(a.badgeCount('wo')).toBe(3);
    expect(a.badgeCount('pms')).toBe(4);
    expect(a.badgeCount('parts')).toBe(5);
    expect(a.badgeCount('request')).toBe(6);
  });

  it('mengembalikan string kosong untuk item tak dikenal atau nilai tidak valid', () => {
    const a = makeApp({ openWOCount: 2 });
    expect(a.badgeCount('lainnya')).toBe('');
    expect(makeApp({ openWOCount: 'abc' }).badgeCount('wo')).toBe('');
  });
});

describe('badgeClass', () => {
  it('mengembalikan string kosong bila badge tidak perlu tampil', () => {
    expect(makeApp({ openWOCount: 0 }).badgeClass('wo')).toBe('');
  });

  it('memakai error-container untuk PM overdue dan stok kritis', () => {
    const a = makeApp({ pmOverdueCount: 2, lowStockCount: 1 });
    expect(a.badgeClass('pms')).toBe('bg-tac-error-container text-tac-on-error-container');
    expect(a.badgeClass('parts')).toBe('bg-tac-error-container text-tac-on-error-container');
  });

  it('memakai primary-container untuk beban kerja WO dan request', () => {
    const a = makeApp({ openWOCount: 2, pendingReqCount: 1 });
    expect(a.badgeClass('wo')).toBe('bg-tac-primary-container text-tac-on-primary-container');
    expect(a.badgeClass('request')).toBe('bg-tac-primary-container text-tac-on-primary-container');
  });
});

describe('badgeLabel', () => {
  it('mengembalikan string kosong bila hitungan nol', () => {
    expect(makeApp({ pmOverdueCount: 0 }).badgeLabel('pms', 'PM')).toBe('');
  });

  it('memakai bentuk tunggal untuk hitungan 1', () => {
    const a = makeApp({ openWOCount: 1, pmOverdueCount: 1, lowStockCount: 1, pendingReqCount: 1 });
    expect(a.badgeLabel('wo')).toBe('1 open work order');
    expect(a.badgeLabel('pms')).toBe('1 overdue PM task');
    expect(a.badgeLabel('parts')).toBe('1 low stock part');
    expect(a.badgeLabel('request')).toBe('1 pending part request');
  });

  it('memakai bentuk jamak untuk hitungan lebih dari 1', () => {
    const a = makeApp({ openWOCount: 3, pmOverdueCount: 2, lowStockCount: 4, pendingReqCount: 5 });
    expect(a.badgeLabel('wo')).toBe('3 open work orders');
    expect(a.badgeLabel('pms')).toBe('2 overdue PM tasks');
    expect(a.badgeLabel('parts')).toBe('4 low stock parts');
    expect(a.badgeLabel('request')).toBe('5 pending part requests');
  });

  it('mengembalikan string kosong untuk item tak dikenal', () => {
    const a = makeApp({ openWOCount: 2 });
    expect(a.badgeLabel('lainnya', 'Laporan')).toBe('');
    expect(a.badgeLabel('lainnya')).toBe('');
  });
});

describe('canAccess', () => {
  it('mengizinkan menu tanpa allowedRole untuk semua peran', () => {
    expect(makeApp({ userRole: 'technician' }).canAccess({})).toBe(true);
  });

  it('menu admin hanya untuk admin', () => {
    expect(makeApp({ isAdmin: true }).canAccess({ allowedRole: 'admin' })).toBe(true);
    expect(makeApp({ isAdmin: false }).canAccess({ allowedRole: 'admin' })).toBe(false);
  });

  it('menu supervisor untuk admin dan supervisor', () => {
    const item = { allowedRole: 'supervisor' };
    expect(makeApp({ isAdminOrSupervisor: true }).canAccess(item)).toBe(true);
    expect(makeApp({ isAdminOrSupervisor: false }).canAccess(item)).toBe(false);
  });

  it('allowedRole tak dikenal tetap diizinkan', () => {
    expect(makeApp({ userRole: 'technician' }).canAccess({ allowedRole: 'lainnya' })).toBe(true);
  });
});
