// @vitest-environment jsdom
/**
 * Tests untuk method Planning Board / Main Planning di `src/js/app.js`
 * (rentang 2100-2290): drag & drop kolom, ubah status WO, helper badge tac,
 * dan geometri bar Gantt.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

beforeEach(() => {
  stubFirebase();
});

describe('Planning Board — nama equipment & warna prioritas', () => {
  it('planningEquipName mengembalikan Nama equipment dari daftar', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', Nama: 'Pompa Sentrifugal' }] });
    expect(a.planningEquipName('EQ1')).toBe('Pompa Sentrifugal');
  });

  it('planningEquipName memakai EquipmentID bila Nama kosong', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', Nama: '' }] });
    expect(a.planningEquipName('EQ1')).toBe('EQ1');
  });

  it('planningEquipName mengembalikan id apa adanya bila tidak ditemukan', () => {
    const a = makeApp({ equipment: [{ EquipmentID: 'EQ1', Nama: 'Pompa' }] });
    expect(a.planningEquipName('EQ9')).toBe('EQ9');
  });

  it('planningEquipName mengembalikan string kosong saat id kosong', () => {
    const a = makeApp({ equipment: [] });
    expect(a.planningEquipName(null)).toBe('');
    expect(a.planningEquipName('')).toBe('');
  });

  it('planningEquipName mengembalikan id saat equipment belum dimuat', () => {
    const a = makeApp({ equipment: null });
    expect(a.planningEquipName('EQ1')).toBe('EQ1');
  });

  it('planningPriorityColor memetakan tiap prioritas ke kelas tac-*', () => {
    const a = makeApp();
    expect(a.planningPriorityColor('Emergency')).toContain('tac-status-emergency');
    expect(a.planningPriorityColor('Urgent')).toContain('tac-status-repair');
    expect(a.planningPriorityColor('Normal')).toContain('tac-sync-cyan');
    expect(a.planningPriorityColor('Planned')).toContain('tac-status-operational');
  });

  it('planningPriorityColor memakai warna standby untuk prioritas tak dikenal', () => {
    const a = makeApp();
    expect(a.planningPriorityColor('Whatever')).toBe('bg-tac-status-standby/20 text-tac-status-standby');
    expect(a.planningPriorityColor(undefined)).toBe('bg-tac-status-standby/20 text-tac-status-standby');
  });
});

describe('Planning Board — drag & drop kartu WO', () => {
  it('planningDragStart menyimpan id yang sedang di-drag', () => {
    const a = makeApp();
    a.planningDragStart('L1');
    expect(a.planningDragging).toBe('L1');
  });

  it('planningDragEnd membersihkan state drag', () => {
    const a = makeApp();
    a.planningDragging = 'L1';
    a.planningDragOver = 'Approved';
    a.planningDragEnd();
    expect(a.planningDragging).toBeNull();
    expect(a.planningDragOver).toBeNull();
  });

  it('planningDrop tidak melakukan apa pun saat tidak ada kartu di-drag', () => {
    const a = makeApp();
    const spy = vi.spyOn(a, 'updateLogStatus');
    a.planningDrop('Approved');
    expect(spy).not.toHaveBeenCalled();
  });

  it('planningDrop memindahkan WO ke status kolom tujuan lalu mereset drag', () => {
    const a = makeApp();
    const spy = vi.spyOn(a, 'updateLogStatus');
    a.planningDragging = 'L1';
    a.planningDragOver = 'Approved';
    a.planningDrop('Approved');
    expect(spy).toHaveBeenCalledWith('L1', 'Approved');
    expect(a.planningDragging).toBeNull();
    expect(a.planningDragOver).toBeNull();
  });

  it('planningMoveTo mengubah status WO dan menutup panel detail', () => {
    const a = makeApp();
    const spy = vi.spyOn(a, 'updateLogStatus');
    a.planningDetailWO = { LogID: 'L1' };
    a.planningMoveTo({ LogID: 'L1' }, 'In Progress');
    expect(spy).toHaveBeenCalledWith('L1', 'In Progress');
    expect(a.planningDetailWO).toBeNull();
  });

  it('planningMoveTo mengabaikan WO tanpa LogID', () => {
    const a = makeApp();
    const spy = vi.spyOn(a, 'updateLogStatus');
    a.planningMoveTo(null, 'Approved');
    a.planningMoveTo({ woNumber: 'WO-1' }, 'Approved');
    expect(spy).not.toHaveBeenCalled();
  });

  it('planningShowDetail menyimpan WO yang dibuka', () => {
    const a = makeApp();
    const wo = { LogID: 'L1', woNumber: 'WO-1' };
    a.planningShowDetail(wo);
    expect(a.planningDetailWO).toBe(wo);
  });
});

describe('Planning Board — updateLogStatus', () => {
  it('mengubah status di logs + activeWorkOrders dan menyimpannya ke Firebase', () => {
    const a = makeApp({
      logs: [{ LogID: 'L1', Status: 'Pending' }],
      activeWorkOrders: [{ LogID: 'L1', Status: 'Pending' }],
    });
    a.updateLogStatus('L1', 'Approved');
    expect(a.logs[0].Status).toBe('Approved');
    expect(a.activeWorkOrders[0].Status).toBe('Approved');
    expect(window.ref).toHaveBeenCalledWith(window.db, 'HistoryLog/L1');
    expect(window.update).toHaveBeenCalledWith(expect.anything(), { Status: 'Approved' });
  });

  it('mengabaikan argumen kosong', () => {
    const a = makeApp({ logs: [{ LogID: 'L1', Status: 'Pending' }] });
    a.updateLogStatus('', 'Approved');
    a.updateLogStatus('L1', '');
    expect(a.logs[0].Status).toBe('Pending');
    expect(window.update).not.toHaveBeenCalled();
  });

  it('mengabaikan LogID yang tidak ada di logs', () => {
    const a = makeApp({ logs: [{ LogID: 'L1', Status: 'Pending' }] });
    a.updateLogStatus('L9', 'Approved');
    expect(window.update).not.toHaveBeenCalled();
  });

  it('tetap jalan saat activeWorkOrders kosong (tanpa error)', () => {
    const a = makeApp({ logs: [{ LogID: 'L1', Status: 'Pending' }], activeWorkOrders: [] });
    a.updateLogStatus('L1', 'Completed');
    expect(a.logs[0].Status).toBe('Completed');
    expect(window.update).toHaveBeenCalled();
  });

  it('rollback status saat penyimpanan Firebase gagal', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.update = vi.fn(() => {
      throw new Error('offline');
    });
    const a = makeApp({
      logs: [{ LogID: 'L1', Status: 'Pending' }],
      activeWorkOrders: [{ LogID: 'L1', Status: 'Pending' }],
    });
    a.updateLogStatus('L1', 'Approved');
    expect(a.logs[0].Status).toBe('Pending');
    expect(a.activeWorkOrders[0].Status).toBe('Pending');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('Planning Board — helper badge Tactical Slate', () => {
  it('planningStatusTac memetakan status ke kelas badge', () => {
    const a = makeApp();
    expect(a.planningStatusTac('Completed')).toBe(
      'bg-tac-status-operational/15 text-tac-status-operational border-tac-status-operational/30',
    );
    expect(a.planningStatusTac('In Progress')).toContain('tac-sync-cyan/15');
    expect(a.planningStatusTac('Approved')).toContain('tac-primary/15');
    expect(a.planningStatusTac('Cancelled')).toContain('bg-tac-surface-container-highest');
  });

  it('planningStatusTac memakai gaya repair sebagai default', () => {
    const a = makeApp();
    expect(a.planningStatusTac('Pending')).toContain('tac-status-repair/15');
    expect(a.planningStatusTac()).toContain('tac-status-repair/15');
  });

  it('planningMarkerTac memetakan status ke warna titik', () => {
    const a = makeApp();
    expect(a.planningMarkerTac('Completed')).toBe('bg-tac-status-operational');
    expect(a.planningMarkerTac('In Progress')).toBe('bg-tac-sync-cyan');
    expect(a.planningMarkerTac('Approved')).toBe('bg-tac-primary');
    expect(a.planningMarkerTac('Cancelled')).toBe('bg-tac-status-standby');
  });

  it('planningMarkerTac default ke repair', () => {
    const a = makeApp();
    expect(a.planningMarkerTac('Pending')).toBe('bg-tac-status-repair');
    expect(a.planningMarkerTac()).toBe('bg-tac-status-repair');
  });

  it('planningPriorityTac memetakan prioritas ke kelas badge', () => {
    const a = makeApp();
    expect(a.planningPriorityTac('Emergency')).toBe(
      'bg-tac-status-emergency/20 text-tac-status-emergency border-tac-status-emergency/30',
    );
    expect(a.planningPriorityTac('Urgent')).toContain('tac-status-repair/20');
    expect(a.planningPriorityTac('Planned')).toContain('tac-status-operational/20');
    expect(a.planningPriorityTac('Normal')).toContain('tac-primary/15');
    expect(a.planningPriorityTac()).toContain('tac-primary/15');
  });

  it('planningBarTac memetakan status ke kelas bar Gantt', () => {
    const a = makeApp();
    expect(a.planningBarTac('Completed')).toBe(
      'bg-tac-status-operational/40 border-tac-status-operational/60',
    );
    expect(a.planningBarTac('In Progress')).toBe('bg-tac-sync-cyan/40 border-tac-sync-cyan/60');
    expect(a.planningBarTac('Approved')).toBe('bg-tac-primary/40 border-tac-primary/60');
    expect(a.planningBarTac('Cancelled')).toBe('bg-tac-status-standby/40 border-tac-status-standby/60');
    expect(a.planningBarTac('Pending')).toBe('bg-tac-status-repair/40 border-tac-status-repair/60');
    expect(a.planningBarTac()).toBe('bg-tac-status-repair/40 border-tac-status-repair/60');
  });
});

describe('Planning Board — kalender & bar Gantt', () => {
  it('planningMonths mengembalikan 5 bulan: bulan lalu sampai 3 bulan ke depan', () => {
    const a = makeApp();
    const months = a.planningMonths;
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    expect(months).toHaveLength(5);
    expect(months[0].month).toBe(prev.getMonth());
    expect(months[0].year).toBe(prev.getFullYear());
    expect(months[4].month).toBe(new Date(now.getFullYear(), now.getMonth() + 3, 1).getMonth());
  });

  it('planningGanttDays mencakup hari ini dan menandai akhir pekan', () => {
    const a = makeApp();
    const days = a.planningGanttDays;
    const today = new Date().toISOString().split('T')[0];
    expect(days.length).toBeGreaterThan(50);
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
    expect(days.find((d) => d.dateStr === today).isToday).toBe(true);
    expect(days.some((d) => d.isWeekend)).toBe(true);
  });

  it('planningGanttBar mengembalikan null tanpa Tanggal/dueDate', () => {
    const a = makeApp();
    expect(a.planningGanttBar({ LogID: 'L1' })).toBeNull();
  });

  it('planningGanttBar mengembalikan null bila tanggal di luar rentang kalender', () => {
    const a = makeApp();
    expect(a.planningGanttBar({ Tanggal: '1999-01-01', dueDate: '1999-01-05' })).toBeNull();
  });

  it('planningGanttBar menghitung left/width untuk WO satu hari', () => {
    const a = makeApp();
    const days = a.planningGanttDays;
    const today = new Date().toISOString().split('T')[0];
    const idx = days.findIndex((d) => d.dateStr === today);
    const bar = a.planningGanttBar({ Tanggal: today });
    expect(bar).toEqual({ left: idx * 20, width: 20 });
  });

  it('planningGanttBar melebarkan bar sesuai rentang Tanggal→dueDate', () => {
    const a = makeApp();
    const days = a.planningGanttDays;
    const today = new Date().toISOString().split('T')[0];
    const idx = days.findIndex((d) => d.dateStr === today);
    const end = days[idx + 4].dateStr;
    const bar = a.planningGanttBar({ Tanggal: today, dueDate: end });
    expect(bar).toEqual({ left: idx * 20, width: 5 * 20 });
  });

  it('planningGanttBar memakai dueDate sebagai awal bila Tanggal kosong', () => {
    const a = makeApp();
    const days = a.planningGanttDays;
    const today = new Date().toISOString().split('T')[0];
    const idx = days.findIndex((d) => d.dateStr === today);
    expect(a.planningGanttBar({ dueDate: today })).toEqual({ left: idx * 20, width: 20 });
  });

  it('planningGanttBar menjepit bar yang mulai sebelum rentang kalender', () => {
    const a = makeApp();
    const days = a.planningGanttDays;
    const endIdx = days.findIndex((d) => d.dateStr === new Date().toISOString().split('T')[0]);
    const bar = a.planningGanttBar({ Tanggal: '1999-01-01', dueDate: days[endIdx].dateStr });
    expect(bar.left).toBe(0);
    expect(bar.width).toBe((endIdx + 1) * 20);
  });
});

describe('Main Planning — mpRefresh', () => {
  it('mpRefresh memuat ulang jadwal PM', () => {
    const load = vi.fn();
    const a = makeApp({ loadPMSchedule: load });
    a.mpRefresh();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('mpRefresh tidak melempar error saat loadPMSchedule belum ada', () => {
    const a = makeApp({ loadPMSchedule: undefined });
    expect(() => a.mpRefresh()).not.toThrow();
  });
});
