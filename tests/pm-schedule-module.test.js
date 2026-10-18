// @vitest-environment jsdom
/**
 * Unit test logika penjadwalan PM: src/js/modules/pm-schedule.js
 *
 * Fokus pada bagian yang menentukan tanggal/angka di layar: filter, overdue
 * (termasuk basis HM), kalender, statistik, dan Gantt. `submitPM` belum
 * disentuh (butuh RTDB + confirm) — lihat SESSION_NOTES S26.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pmScheduleModule } from '../src/js/modules/pm-schedule.js';

const TODAY = new Date('2026-10-18T00:00:00Z');
const iso = (offsetDays = 0) =>
    new Date(TODAY.getTime() + offsetDays * 86400000).toISOString().slice(0, 10);

function makeCtx(overrides = {}) {
    const ctx = Object.create(pmScheduleModule);
    return Object.assign(ctx, {
        pmList: [],
        pmForm: {},
        isEditingPM: false,
        pmFilterStatus: '',
        pmFilterEquip: '',
        pmFilterPriority: '',
        pmSearch: '',
        pmMonthOffset: 0,
        pmGanttScroll: 0,
        pmLoading: true,
        pmSelectedIds: [],
        equipment: [],
        logs: [],
        user: { uid: 'uid-1' },
        showPMModal: false,
        _pmHM: null,
        _pmHMRef: null,
        _pmHMEqRef: null,
        _ganttEqMap: null,
        _ganttEqRef: null,
        ...overrides,
    });
}

function stubFirebase(impl) {
    window.db = { name: 'db' };
    window.ref = vi.fn((_db, path) => ({ path }));
    window.get = vi.fn(impl);
    window.set = vi.fn(async () => {});
    window.remove = vi.fn(async () => {});
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFirebase(async () => ({ exists: () => false, val: () => null }));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.db;
    delete window.app;
});

describe('pmScheduleModule.openPMModal', () => {
    it('starts a blank form dated today', () => {
        const ctx = makeCtx();
        ctx.openPMModal();
        expect(ctx.isEditingPM).toBe(false);
        expect(ctx.showPMModal).toBe(true);
        expect(ctx.pmForm.date).toBe(iso(0));
        expect(ctx.pmForm.frequency).toBe('none');
    });

    it('maps an existing record with sane defaults', () => {
        const ctx = makeCtx();
        ctx.openPMModal(true, { pmId: 'PM-1', taskName: 'Ganti Oli' });
        expect(ctx.isEditingPM).toBe(true);
        expect(ctx.pmForm).toMatchObject({
            pmId: 'PM-1',
            taskName: 'Ganti Oli',
            equipmentId: '',
            frequency: 'none',
            basis: 'calendar',
            intervalHours: 0,
            assignedTo: 'Maintenance Team',
            status: 'pending',
            priority: 'Medium',
            completionDate: '',
            completionNote: '',
        });
    });

    it('keeps every provided field when editing', () => {
        const ctx = makeCtx();
        ctx.openPMModal(true, {
            pmId: 'PM-2',
            taskName: 'Greasing',
            equipmentId: 'EQ1',
            description: 'desc',
            date: '2026-11-01',
            frequency: 'monthly',
            basis: 'hours',
            intervalHours: 250,
            assignedTo: 'Tim A',
            status: 'completed',
            priority: 'High',
            completionDate: '2026-10-01',
            completionNote: 'ok',
        });
        expect(ctx.pmForm).toMatchObject({
            frequency: 'monthly',
            basis: 'hours',
            intervalHours: 250,
            assignedTo: 'Tim A',
            status: 'completed',
            priority: 'High',
        });
    });

    it('ignores edit data when isEdit is false', () => {
        const ctx = makeCtx();
        ctx.openPMModal(false, { taskName: 'diabaikan' });
        expect(ctx.pmForm.taskName).not.toBe('diabaikan');
    });
});

describe('pmScheduleModule.loadPMSchedule', () => {
    it('returns early without a database handle', async () => {
        delete window.db;
        const ctx = makeCtx({ pmLoading: true });
        await ctx.loadPMSchedule();
        expect(window.get).not.toHaveBeenCalled();
        expect(ctx.pmLoading).toBe(true);
    });

    it('maps snapshot keys to pmId and clears the loading flag', async () => {
        stubFirebase(async () => ({
            exists: () => true,
            val: () => ({ 'PM-1': { taskName: 'A' }, 'PM-2': { taskName: 'B' } }),
        }));
        const ctx = makeCtx();
        await ctx.loadPMSchedule();
        expect(ctx.pmList).toEqual([
            { pmId: 'PM-1', taskName: 'A' },
            { pmId: 'PM-2', taskName: 'B' },
        ]);
        expect(ctx.pmLoading).toBe(false);
    });

    it('empties the list when the snapshot does not exist', async () => {
        const ctx = makeCtx({ pmList: [{ pmId: 'OLD' }] });
        await ctx.loadPMSchedule();
        expect(ctx.pmList).toEqual([]);
    });

    it('auto-generates the next PM for a recent completed recurring task', async () => {
        stubFirebase(async () => ({
            exists: () => true,
            val: () => ({
                'PM-1': {
                    taskName: 'Ganti Oli',
                    equipmentId: 'EQ1',
                    date: '2026-10-10',
                    frequency: 'monthly',
                    status: 'completed',
                    completionDate: '2026-10-11',
                },
            }),
        }));
        const ctx = makeCtx();
        const gen = vi.spyOn(ctx, 'generateNextPM').mockResolvedValue();
        await ctx.loadPMSchedule();
        expect(gen).toHaveBeenCalledOnce();
        expect(gen.mock.calls[0][0]).toMatchObject({ pmId: 'PM-1' });
    });

    it('skips generation when a pending task already covers the next date', async () => {
        stubFirebase(async () => ({
            exists: () => true,
            val: () => ({
                'PM-1': {
                    taskName: 'Ganti Oli',
                    equipmentId: 'EQ1',
                    date: '2026-10-10',
                    frequency: 'monthly',
                    status: 'completed',
                    completionDate: '2026-10-11',
                },
                'PM-2': {
                    taskName: 'Ganti Oli',
                    equipmentId: 'EQ1',
                    date: iso(22),
                    frequency: 'monthly',
                    status: 'pending',
                },
            }),
        }));
        const ctx = makeCtx();
        const gen = vi.spyOn(ctx, 'generateNextPM').mockResolvedValue();
        await ctx.loadPMSchedule();
        expect(gen).not.toHaveBeenCalled();
    });

    it('ignores non-recurring, old, and unknown-frequency completions', async () => {
        stubFirebase(async () => ({
            exists: () => true,
            val: () => ({
                A: { taskName: 'a', frequency: 'none', status: 'completed', date: '2026-10-01' },
                B: { taskName: 'b', frequency: 'monthly', status: 'completed', completionDate: '2026-01-01', date: '2026-01-01' },
                C: { taskName: 'c', frequency: 'harian', status: 'completed', date: '2026-10-01' },
                D: { taskName: 'd', frequency: 'weekly', status: 'pending', date: '2026-10-01' },
            }),
        }));
        const ctx = makeCtx();
        const gen = vi.spyOn(ctx, 'generateNextPM').mockResolvedValue();
        await ctx.loadPMSchedule();
        expect(gen).not.toHaveBeenCalled();
    });

    it('does not auto-generate without a logged-in user', async () => {
        stubFirebase(async () => ({
            exists: () => true,
            val: () => ({
                A: { taskName: 'a', frequency: 'monthly', status: 'completed', date: '2026-10-01' },
            }),
        }));
        const ctx = makeCtx({ user: null });
        const gen = vi.spyOn(ctx, 'generateNextPM').mockResolvedValue();
        await ctx.loadPMSchedule();
        expect(gen).not.toHaveBeenCalled();
    });

    it('warns but finishes when auto-generate throws', async () => {
        stubFirebase(async () => ({
            exists: () => true,
            val: () => ({
                A: { taskName: 'a', frequency: 'monthly', status: 'completed', date: '2026-10-01' },
            }),
        }));
        const ctx = makeCtx();
        vi.spyOn(ctx, 'generateNextPM').mockRejectedValue(new Error('rtdb down'));
        await ctx.loadPMSchedule();
        expect(console.warn).toHaveBeenCalledWith('[PM] Auto-generate error:', 'rtdb down');
        expect(ctx.pmLoading).toBe(false);
    });

    it('warns and clears loading when the read fails', async () => {
        stubFirebase(async () => {
            throw new Error('permission denied');
        });
        const ctx = makeCtx();
        await ctx.loadPMSchedule();
        expect(console.warn).toHaveBeenCalledWith('[PM] Load error:', 'permission denied');
        expect(ctx.pmLoading).toBe(false);
    });
});

describe('pmScheduleModule filters', () => {
    const rows = [
        { pmId: '1', taskName: 'Ganti Oli', equipmentId: 'EQ1', description: 'mesin', assignedTo: 'Budi', date: iso(5), status: 'pending', priority: 'High' },
        { pmId: '2', taskName: 'Greasing', equipmentId: 'EQ2', date: iso(-2), status: 'pending' },
        { pmId: '3', taskName: 'Inspeksi', equipmentId: 'EQ1', date: iso(-10), status: 'completed', priority: 'Low' },
    ];

    it('searches across task, equipment, description and assignee', () => {
        expect(makeCtx({ pmList: rows, pmSearch: 'greas' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['2']);
        expect(makeCtx({ pmList: rows, pmSearch: 'eq1' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['3', '1']);
        expect(makeCtx({ pmList: rows, pmSearch: 'mesin' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['1']);
        expect(makeCtx({ pmList: rows, pmSearch: 'budi' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['1']);
    });

    it('drops null rows and applies equipment/status/priority filters', () => {
        const list = [null, ...rows];
        expect(makeCtx({ pmList: list, pmSearch: 'a' }).pmGetFilteredList()).not.toContain(null);
        expect(makeCtx({ pmList: rows, pmFilterEquip: 'EQ1' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['3', '1']);
        expect(makeCtx({ pmList: rows, pmFilterStatus: 'completed' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['3']);
        expect(makeCtx({ pmList: rows, pmFilterPriority: 'High' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['1']);
        // priority default 'Medium' ketika field kosong
        expect(makeCtx({ pmList: rows, pmFilterPriority: 'Medium' }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['2']);
    });

    it('sorts overdue pending rows first, then by date', () => {
        // 2 = pending overdue → paling atas; sisanya urut tanggal (3 lebih awal dari 1)
        expect(makeCtx({ pmList: rows }).pmGetFilteredList().map((p) => p.pmId)).toEqual(['2', '3', '1']);
    });

    it('pmUpcomingList keeps only pending rows, overdue first', () => {
        const upcoming = makeCtx({ pmList: rows }).pmUpcomingList;
        expect(upcoming.map((p) => p.pmId)).toEqual(['2', '1']);
    });

    it('pmOverdueCount counts date-based and hour-based overdue rows', () => {
        const ctx = makeCtx({
            pmList: [
                { pmId: '1', status: 'pending', date: iso(-1) },
                { pmId: '2', status: 'pending', date: iso(3) },
                { pmId: '3', status: 'completed', date: iso(-9) },
                { pmId: '4', status: 'pending', basis: 'hours', targetHM: 100, equipmentId: 'EQ1' },
            ],
            equipment: [{ EquipmentID: 'EQ1', CurrentHM: 150 }],
        });
        expect(ctx.pmOverdueCount).toBe(2);
    });
});

describe('pmScheduleModule overdue & HM helpers', () => {
    it('prefers the equipment meter over the last log HM', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1', CurrentHM: 500 }],
            logs: [{ EquipmentID: 'EQ1', HM: 400, Tanggal: '2026-10-01' }],
        });
        expect(ctx.pmCurrentHM('EQ1')).toBe(500);
    });

    it('falls back to the newest log HM when the meter is empty', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1', CurrentHM: 0 }],
            logs: [
                { EquipmentID: 'EQ1', HM: 100, Tanggal: '2026-09-01' },
                { EquipmentID: 'EQ1', HM: 300, Tanggal: '2026-10-01' },
                { EquipmentID: 'EQ1', HM: 50, Tanggal: '2026-08-01' },
            ],
        });
        expect(ctx.pmCurrentHM('EQ1')).toBe(300);
    });

    it('ignores logs without equipment, without a positive HM, and unknown ids', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1' }, null],
            logs: [{ HM: 999 }, { EquipmentID: 'EQ1', HM: 0 }, { EquipmentID: 'EQ9', HM: 50 }],
        });
        expect(ctx.pmCurrentHM('EQ1')).toBe(0);
        expect(ctx.pmCurrentHM('EQ9')).toBe(0);
        expect(ctx.pmCurrentHM('')).toBe(0);
    });

    it('caches the HM map until logs or equipment references change', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1', CurrentHM: 10 }],
            logs: [{ EquipmentID: 'EQ1', HM: 5, Tanggal: '2026-10-01' }],
        });
        const first = ctx._pmHMMap();
        expect(ctx._pmHMMap()).toBe(first);
        ctx.logs = [{ EquipmentID: 'EQ1', HM: 77, Tanggal: '2026-10-02' }];
        expect(ctx._pmHMMap()).not.toBe(first);
        expect(ctx.pmCurrentHM('EQ1')).toBe(10);
    });

    it('isPMOverdue honours status, hours basis and dates', () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1', CurrentHM: 120 }],
        });
        expect(ctx.isPMOverdue({ status: 'completed', date: iso(-5) })).toBe(false);
        expect(ctx.isPMOverdue({ status: 'pending', date: iso(-1) })).toBe(true);
        expect(ctx.isPMOverdue({ status: 'pending', date: iso(1) })).toBe(false);
        expect(ctx.isPMOverdue({ status: 'pending', basis: 'hours', targetHM: 100, equipmentId: 'EQ1' })).toBe(true);
        expect(ctx.isPMOverdue({ status: 'pending', basis: 'hours', targetHM: 200, equipmentId: 'EQ1' })).toBe(false);
        // targetHM 0 → jatuh ke perbandingan tanggal
        expect(ctx.isPMOverdue({ status: 'pending', basis: 'hours', targetHM: 0, date: iso(2) })).toBe(false);
    });

    it('isPMDueSoon covers today through +3 days for pending rows', () => {
        const ctx = makeCtx();
        expect(ctx.isPMDueSoon({ status: 'pending', date: iso(0) })).toBe(true);
        expect(ctx.isPMDueSoon({ status: 'pending', date: iso(3) })).toBe(true);
        expect(ctx.isPMDueSoon({ status: 'pending', date: iso(4) })).toBe(false);
        expect(ctx.isPMDueSoon({ status: 'pending', date: iso(-1) })).toBe(false);
        expect(ctx.isPMDueSoon({ status: 'completed', date: iso(1) })).toBe(false);
    });
});

describe('pmScheduleModule calendar', () => {
    it('pmGetMonthLabel follows pmMonthOffset', () => {
        expect(makeCtx().pmGetMonthLabel()).toBe('October 2026');
        expect(makeCtx({ pmMonthOffset: 1 }).pmGetMonthLabel()).toBe('November 2026');
        expect(makeCtx({ pmMonthOffset: -2 }).pmGetMonthLabel()).toBe('August 2026');
    });

    it('pmGetCalendarEvents groups by date with overdue/due-soon/completed flags', () => {
        const ctx = makeCtx({
            pmList: [
                { pmId: '1', taskName: 'A', equipmentId: 'EQ1', date: iso(-2), status: 'pending' },
                { pmId: '2', taskName: 'B', equipmentId: 'EQ1', date: iso(2), status: 'pending' },
                { pmId: '3', taskName: 'C', equipmentId: 'EQ2', date: iso(0), status: 'completed' },
                { pmId: '4', taskName: 'D', equipmentId: 'EQ2' },
            ],
        });
        const events = ctx.pmGetCalendarEvents();
        expect(Object.keys(events)).toHaveLength(3);
        expect(events[iso(-2)][0]).toMatchObject({ id: '1', isOverdue: true, isDueSoon: false, priority: 'Medium', frequency: 'none' });
        expect(events[iso(2)][0]).toMatchObject({ isOverdue: false, isDueSoon: true });
        expect(events[iso(0)][0]).toMatchObject({ isCompleted: true, isDueSoon: false });
    });

    it('pmGetCalendarEvents honours the equipment filter', () => {
        const ctx = makeCtx({
            pmList: [
                { pmId: '1', equipmentId: 'EQ1', date: iso(1) },
                { pmId: '2', equipmentId: 'EQ2', date: iso(2) },
            ],
            pmFilterEquip: 'EQ2',
        });
        expect(Object.keys(ctx.pmGetCalendarEvents())).toEqual([iso(2)]);
    });

    it('pmGetCalendarDays returns whole weeks with today, weekend and events marked', () => {
        const ctx = makeCtx({
            pmList: [{ pmId: '1', taskName: 'A', equipmentId: 'EQ1', date: iso(0), status: 'pending' }],
        });
        const days = ctx.pmGetCalendarDays();
        expect(days.length % 7).toBe(0);
        const today = days.find((d) => d.dateStr === iso(0));
        expect(today.isToday).toBe(true);
        expect(today.events).toHaveLength(1);
        expect(days.some((d) => d.isWeekend)).toBe(true);
        expect(days.some((d) => d.isOtherMonth)).toBe(true);
    });

    it('pmGetCalendarDays shifts with pmMonthOffset', () => {
        const current = makeCtx().pmGetCalendarDays();
        const next = makeCtx({ pmMonthOffset: 1 }).pmGetCalendarDays();
        expect(next[10].dateStr).not.toBe(current[10].dateStr);
        expect(next.some((d) => d.dateStr.startsWith('2026-11'))).toBe(true);
    });
});

describe('pmScheduleModule stats & gantt', () => {
    it('pmGetStats splits overdue, this month, 30 days and completed', () => {
        const ctx = makeCtx({
            pmList: [
                { date: iso(-3), status: 'pending' },
                { date: iso(2), status: 'pending' },
                { date: iso(20), status: 'pending' },
                { date: iso(-30), status: 'completed' },
                { status: 'pending' },
            ],
        });
        const stats = ctx.pmGetStats();
        expect(stats.overdue).toBe(1);
        expect(stats.completed).toBe(1);
        expect(stats.dueThisMonth).toBe(1);
        expect(stats.upcoming).toBe(2);
    });

    it('pmGetGanttMonths spans -2..+4 months', () => {
        const months = makeCtx().pmGetGanttMonths();
        expect(months.map((m) => m.offset)).toEqual([-2, -1, 0, 1, 2, 3, 4]);
        expect(months[2].label).toBe('Oct 2026');
    });

    it('pmGetGanttDays covers the window and marks today/weekends', () => {
        const days = makeCtx().pmGetGanttDays();
        expect(days.length).toBeGreaterThan(100);
        expect(days.some((d) => d.isToday)).toBe(true);
        expect(days.some((d) => d.isWeekend)).toBe(true);
        expect(days[0].label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
        expect(days[0].dayName).toHaveLength(2);
    });

    it('pmGetGanttDays shifts with pmGanttScroll', () => {
        const base = makeCtx().pmGetGanttDays();
        const shifted = makeCtx({ pmGanttScroll: 1 }).pmGetGanttDays();
        expect(shifted[0].dateStr > base[0].dateStr).toBe(true);
    });

    it('pmGetGanttRows groups events per equipment with status rollup', () => {
        window.app = { equipment: [{ EquipmentID: 'EQ1', Nama: 'Excavator' }] };
        const ctx = makeCtx({
            pmList: [
                { pmId: '1', taskName: 'A', equipmentId: 'EQ1', date: iso(-2), status: 'pending' },
                { pmId: '2', taskName: 'B', equipmentId: 'EQ1', date: iso(1), status: 'pending' },
                { pmId: '3', taskName: 'C', equipmentId: 'EQ2', date: iso(1), status: 'pending' },
                { pmId: '4', taskName: 'D', equipmentId: 'EQ3', date: iso(1), status: 'completed' },
                { pmId: '5', taskName: 'E', equipmentId: 'EQ3' },
                { pmId: '6', taskName: 'F', equipmentId: 'EQ4', date: iso(400), status: 'pending' },
            ],
        });
        const rows = ctx.pmGetGanttRows();
        const byId = Object.fromEntries(rows.map((r) => [r.equipId, r]));
        expect(Object.keys(byId).sort()).toEqual(['EQ1', 'EQ2', 'EQ3']);
        expect(byId.EQ1.status).toBe('Overdue');
        expect(byId.EQ1.name).toBe('Excavator');
        expect(byId.EQ1.events[0]).toMatchObject({ id: '1', width: 38, isOverdue: true });
        expect(byId.EQ2.status).toBe('Due Soon');
        expect(byId.EQ2.name).toBe('EQ2'); // tanpa entri di window.app → fallback id
        expect(byId.EQ3.status).toBe('Scheduled');
    });

    it('pmGetGanttRows honours the equipment filter and the cached name map', () => {
        window.app = { equipment: [{ EquipmentID: 'EQ2', Nama: 'Pompa' }] };
        const ctx = makeCtx({
            pmList: [
                { pmId: '1', equipmentId: 'EQ1', date: iso(1), status: 'pending' },
                { pmId: '2', equipmentId: 'EQ2', date: iso(1), status: 'pending' },
            ],
            pmFilterEquip: 'EQ2',
        });
        const rows = ctx.pmGetGanttRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Pompa');
        expect(ctx._ganttEqMap).toBeInstanceOf(Map);
        // panggilan kedua memakai cache yang sama
        const cache = ctx._ganttEqMap;
        ctx.pmGetGanttRows();
        expect(ctx._ganttEqMap).toBe(cache);
    });

    it('pmGetGanttRows returns [] when the day window is empty', () => {
        const ctx = makeCtx({ pmList: [{ pmId: '1', equipmentId: 'EQ1', date: iso(1) }] });
        ctx.pmGetGanttDays = () => [];
        expect(ctx.pmGetGanttRows()).toEqual([]);
    });
});
