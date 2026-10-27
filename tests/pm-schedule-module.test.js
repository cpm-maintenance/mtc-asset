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
/** Tanggal LOKAL dari sebuah Date — `toISOString()` memberi tanggal UTC. */
const isoLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const iso = (offsetDays = 0) => isoLocal(new Date(TODAY.getTime() + offsetDays * 86400000));

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
        pmShowDetail: false,
        logForm: {},
        showLogModal: false,
        showNotification: vi.fn(),
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
    window.update = vi.fn(async () => {});
    window.remove = vi.fn(async () => {});
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFirebase(async () => ({ exists: () => false, val: () => null }));
    vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.db;
    delete window.app;
    delete window.auditModule;
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

describe('pmScheduleModule.submitPM', () => {
    const form = (over = {}) => ({
        taskName: 'Ganti Oli',
        equipmentId: 'EQ1',
        date: iso(0),
        ...over,
    });

    it('rejects an empty task name', async () => {
        const ctx = makeCtx({ pmForm: form({ taskName: '' }) });
        await ctx.submitPM();
        expect(ctx.showNotification).toHaveBeenCalledWith('Task name required', 'error');
        expect(window.set).not.toHaveBeenCalled();
    });

    it('rejects a missing equipment and a missing date', async () => {
        const noEquip = makeCtx({ pmForm: form({ equipmentId: '' }) });
        await noEquip.submitPM();
        expect(noEquip.showNotification).toHaveBeenCalledWith('Select equipment', 'error');

        const noDate = makeCtx({ pmForm: form({ date: '' }) });
        await noDate.submitPM();
        expect(noDate.showNotification).toHaveBeenCalledWith('PM date required', 'error');
        expect(window.set).not.toHaveBeenCalled();
    });

    it('creates a task with generated id, defaults and audit entry', async () => {
        const ctx = makeCtx({ pmForm: form(), pmList: [] });
        const logAudit = vi.fn();
        window.auditModule = { logAudit };

        await ctx.submitPM();

        const [ref, saved] = window.set.mock.calls[0];
        expect(ref.path).toMatch(/^PM_Schedule\/PM_\d+_[a-z0-9]{1,7}$/);
        expect(saved).toMatchObject({
            taskName: 'Ganti Oli',
            equipmentId: 'EQ1',
            description: '',
            frequency: 'none',
            basis: 'calendar',
            intervalHours: 0,
            assignedTo: 'Maintenance Team',
            status: 'pending',
            priority: 'Medium',
            completionDate: '',
            completionNote: '',
            createdBy: 'uid-1',
        });
        expect(typeof saved.createdAt).toBe('string');
        expect(ctx.pmList[0]).toBe(saved);
        expect(ctx.showNotification).toHaveBeenCalledWith('PM Task created!');
        expect(logAudit).toHaveBeenCalledWith('Create PM Task', expect.objectContaining({ equip: 'EQ1' }));
        expect(ctx.showPMModal).toBe(false);
        expect(ctx.pmLoading).toBe(false);
    });

    it('falls back to unknown/0 when optional inputs are missing', async () => {
        const ctx = makeCtx({
            pmForm: { taskName: 'A', equipmentId: 'EQ1', date: iso(0), intervalHours: 'abc' },
            user: null,
        });
        await ctx.submitPM();
        const saved = window.set.mock.calls[0][1];
        expect(saved.createdBy).toBe('unknown');
        expect(saved.intervalHours).toBe(0);
    });

    it('survives an audit module that throws', async () => {
        const ctx = makeCtx({ pmForm: form() });
        window.auditModule = {
            logAudit() {
                throw new Error('audit down');
            },
        };
        await expect(ctx.submitPM()).resolves.toBeUndefined();
        expect(ctx.showNotification).toHaveBeenCalledWith('PM Task created!');
    });

    it('updates an existing task and preserves createdAt/createdBy', async () => {
        const ctx = makeCtx({
            isEditingPM: true,
            pmForm: form({ pmId: 'PM-1' }),
            pmList: [{ pmId: 'PM-1', createdBy: 'admin', createdAt: '2026-01-01T00:00:00Z', taskName: 'lama' }],
        });
        const logAudit = vi.fn();
        window.auditModule = { logAudit };

        await ctx.submitPM();

        const [ref, saved] = window.update.mock.calls[0];
        expect(ref.path).toBe('PM_Schedule/PM-1');
        expect(saved).toMatchObject({ createdBy: 'admin', createdAt: '2026-01-01T00:00:00Z', pmId: 'PM-1' });
        expect(ctx.pmList[0].taskName).toBe('Ganti Oli');
        expect(ctx.showNotification).toHaveBeenCalledWith('PM Task updated!');
        expect(logAudit).toHaveBeenCalledWith('Update PM Task', expect.objectContaining({ id: 'PM-1' }));
    });

    it('reports a missing PM id when editing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ isEditingPM: true, pmForm: form({ pmId: '' }) });
        await ctx.submitPM();
        expect(console.error).toHaveBeenCalledWith('[PM] Submit error:', expect.any(Error));
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: Missing PM ID', 'error');
        expect(window.update).not.toHaveBeenCalled();
    });

    it('reports a failed write', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ pmForm: form() });
        window.set.mockRejectedValueOnce(new Error('permission denied'));
        await ctx.submitPM();
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: permission denied', 'error');
        expect(ctx.pmLoading).toBe(false);
    });
});

describe('pmScheduleModule.completePM', () => {
    it('marks the task completed and generates the next occurrence', async () => {
        const ctx = makeCtx({
            pmList: [{ pmId: 'PM-1', taskName: 'A', equipmentId: 'EQ1', frequency: 'monthly', status: 'pending' }],
            pmShowDetail: true,
        });
        const gen = vi.spyOn(ctx, 'generateNextPM').mockResolvedValue();

        await ctx.completePM('PM-1', 'selesai');

        expect(window.update).toHaveBeenCalledWith(expect.objectContaining({ path: 'PM_Schedule/PM-1' }), {
            status: 'completed',
            completionDate: iso(0),
            completionNote: 'selesai',
            updatedAt: expect.any(String),
        });
        expect(ctx.pmList[0]).toMatchObject({ status: 'completed', completionNote: 'selesai' });
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ PM marked completed');
        expect(gen).toHaveBeenCalledOnce();
        expect(ctx.pmShowDetail).toBe(false);
    });

    it('skips generation for non-recurring tasks and unknown ids', async () => {
        const ctx = makeCtx({
            pmList: [{ pmId: 'PM-1', taskName: 'A', frequency: 'none', status: 'pending' }],
        });
        const gen = vi.spyOn(ctx, 'generateNextPM').mockResolvedValue();
        await ctx.completePM('PM-1');
        await ctx.completePM('PM-404');
        expect(gen).not.toHaveBeenCalled();
    });

    it('reports a failed update', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ pmList: [] });
        window.update.mockRejectedValueOnce(new Error('offline'));
        await ctx.completePM('PM-1');
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: offline', 'error');
    });
});

describe('pmScheduleModule.generateNextPM', () => {
    it('ignores unknown frequencies', async () => {
        const ctx = makeCtx();
        await ctx.generateNextPM({ taskName: 'A', equipmentId: 'EQ1', frequency: 'harian' });
        expect(window.set).not.toHaveBeenCalled();
    });

    it('creates the next calendar occurrence', async () => {
        const ctx = makeCtx({ pmList: [] });
        await ctx.generateNextPM({
            taskName: 'A',
            equipmentId: 'EQ1',
            frequency: 'weekly',
            priority: 'High',
            assignedTo: 'Tim B',
        });

        const saved = window.set.mock.calls[0][1];
        expect(saved).toMatchObject({
            taskName: 'A',
            equipmentId: 'EQ1',
            date: iso(7),
            frequency: 'weekly',
            status: 'pending',
            priority: 'High',
            assignedTo: 'Tim B',
            basis: 'calendar',
            intervalHours: 0,
            targetHM: null,
            createdBy: 'uid-1',
        });
        expect(ctx.pmList[0]).toBe(saved);
    });

    it('skips when the next occurrence already exists', async () => {
        const ctx = makeCtx({
            pmList: [{ taskName: 'A', equipmentId: 'EQ1', date: iso(7), status: 'pending' }],
        });
        await ctx.generateNextPM({ taskName: 'A', equipmentId: 'EQ1', frequency: 'weekly' });
        expect(window.set).not.toHaveBeenCalled();
    });

    it('annotates targetHM for hours-based PM from meter and log', async () => {
        const ctx = makeCtx({
            equipment: [{ EquipmentID: 'EQ1', CurrentHM: 900 }],
            logs: [
                { EquipmentID: 'EQ1', HM: 800, Tanggal: '2026-09-01' },
                { EquipmentID: 'EQ1', HM: 1200, Tanggal: '2026-10-01' },
                { EquipmentID: 'EQ2', HM: 9999, Tanggal: '2026-10-02' },
            ],
        });
        await ctx.generateNextPM({
            taskName: 'Ganti Oli',
            equipmentId: 'EQ1',
            frequency: 'monthly',
            basis: 'hours',
            intervalHours: 250,
        });
        expect(window.set.mock.calls[0][1].targetHM).toBe(1450);
    });

    it('uses the equipment meter when there is no log history', async () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ1', CurrentHM: 100 }], logs: [] });
        await ctx.generateNextPM({
            taskName: 'A',
            equipmentId: 'EQ1',
            frequency: 'monthly',
            basis: 'hours',
            intervalHours: 50,
        });
        expect(window.set.mock.calls[0][1].targetHM).toBe(150);
    });

    it('propagates a failed write', async () => {
        const ctx = makeCtx();
        window.set.mockRejectedValueOnce(new Error('denied'));
        await expect(
            ctx.generateNextPM({ taskName: 'A', equipmentId: 'EQ1', frequency: 'weekly' })
        ).rejects.toThrow('denied');
        expect(ctx.pmList).toEqual([]);
    });
});

describe('pmScheduleModule.deletePM & selection', () => {
    it('does nothing when the confirmation is dismissed', async () => {
        confirm.mockReturnValue(false);
        const ctx = makeCtx({ pmList: [{ pmId: 'PM-1' }] });
        await ctx.deletePM('PM-1');
        expect(window.remove).not.toHaveBeenCalled();
        expect(ctx.pmList).toHaveLength(1);
    });

    it('removes the task from RTDB and from the list', async () => {
        const ctx = makeCtx({ pmList: [{ pmId: 'PM-1' }, { pmId: 'PM-2' }] });
        await ctx.deletePM('PM-1');
        expect(window.remove).toHaveBeenCalledWith({ path: 'PM_Schedule/PM-1' });
        expect(ctx.pmList.map((p) => p.pmId)).toEqual(['PM-2']);
        expect(ctx.showNotification).toHaveBeenCalledWith('PM task deleted');
    });

    it('reports a failed delete', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ pmList: [{ pmId: 'PM-1' }] });
        window.remove.mockRejectedValueOnce(new Error('denied'));
        await ctx.deletePM('PM-1');
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: denied', 'error');
    });

    it('pmToggleSelect adds then removes the id', () => {
        const ctx = makeCtx();
        ctx.pmToggleSelect('PM-1');
        expect(ctx.pmSelectedIds).toEqual(['PM-1']);
        ctx.pmToggleSelect('PM-1');
        expect(ctx.pmSelectedIds).toEqual([]);
    });

    it('pmToggleSelectAll selects every pending row, then clears them', () => {
        const ctx = makeCtx({
            pmList: [
                { pmId: 'PM-1', status: 'pending', date: iso(1) },
                { pmId: 'PM-2', status: 'pending', date: iso(2) },
                { pmId: 'PM-3', status: 'completed', date: iso(3) },
            ],
            pmSelectedIds: ['PM-3'],
        });
        ctx.pmToggleSelectAll();
        expect(ctx.pmSelectedIds.sort()).toEqual(['PM-1', 'PM-2', 'PM-3']);
        ctx.pmToggleSelectAll();
        expect(ctx.pmSelectedIds).toEqual(['PM-3']);
    });
});

describe('pmScheduleModule.bulkCompletePM', () => {
    it('warns when nothing is selected', async () => {
        const ctx = makeCtx({ pmSelectedIds: [] });
        await ctx.bulkCompletePM();
        expect(ctx.showNotification).toHaveBeenCalledWith('No tasks selected', 'error');
        expect(confirm).not.toHaveBeenCalled();
    });

    it('returns early when the confirmation is dismissed', async () => {
        confirm.mockReturnValue(false);
        const ctx = makeCtx({ pmList: [{ pmId: 'PM-1', status: 'pending' }], pmSelectedIds: ['PM-1'] });
        await ctx.bulkCompletePM();
        expect(window.update).not.toHaveBeenCalled();
    });

    it('completes selected rows, regenerates recurring ones and clears the selection', async () => {
        const ctx = makeCtx({
            pmList: [
                { pmId: 'PM-1', taskName: 'A', equipmentId: 'EQ1', status: 'pending', frequency: 'monthly' },
                { pmId: 'PM-2', taskName: 'B', equipmentId: 'EQ2', status: 'pending', frequency: 'none' },
                { pmId: 'PM-3', taskName: 'C', equipmentId: 'EQ3', status: 'completed' },
            ],
            pmSelectedIds: ['PM-1', 'PM-2', 'PM-3', 'PM-404'],
        });
        const gen = vi.spyOn(ctx, 'generateNextPM').mockResolvedValue();
        const before = ctx.pmList;

        await ctx.bulkCompletePM();

        expect(window.update).toHaveBeenCalledTimes(2); // PM-3 completed & PM-404 unknown dilewati
        expect(gen).toHaveBeenCalledOnce(); // hanya PM-1 yang berfrekuensi
        expect(ctx.pmList).not.toBe(before); // referensi baru → Alpine re-render
        expect(ctx.pmList[0]).toMatchObject({ status: 'completed', completionNote: 'Bulk completed' });
        expect(ctx.pmSelectedIds).toEqual([]);
        expect(ctx.showNotification).toHaveBeenCalledWith('✅ 4 PM tasks completed');
        expect(ctx.pmLoading).toBe(false);
    });

    it('reports a failed bulk update', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({
            pmList: [{ pmId: 'PM-1', taskName: 'A', equipmentId: 'EQ1', status: 'pending' }],
            pmSelectedIds: ['PM-1'],
        });
        window.update.mockRejectedValueOnce(new Error('denied'));
        await ctx.bulkCompletePM();
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: denied', 'error');
        expect(ctx.pmLoading).toBe(false);
    });
});

describe('pmScheduleModule.logPMFromSchedule', () => {
    it('ignores a missing task', () => {
        const ctx = makeCtx();
        ctx.logPMFromSchedule(null);
        expect(ctx.showLogModal).toBe(false);
    });

    it('completes the PM and pre-fills the log form', async () => {
        const ctx = makeCtx({ logForm: {}, showLogModal: false });
        const complete = vi.spyOn(ctx, 'completePM').mockResolvedValue();

        ctx.logPMFromSchedule({
            pmId: 'PM-1',
            equipmentId: 'EQ1',
            taskName: 'Ganti Oli',
            description: 'mesin 1',
            assignedTo: 'Tim A',
        });

        expect(complete).toHaveBeenCalledWith('PM-1');
        expect(ctx.logForm).toEqual({
            equipmentId: 'EQ1',
            type: 'PM',
            desc: 'Ganti Oli - mesin 1',
            tech: 'Tim A',
        });
        expect(ctx.showLogModal).toBe(true);
    });

    it('omits the description suffix and falls back to the default team', async () => {
        const ctx = makeCtx({ logForm: {}, showLogModal: false });
        vi.spyOn(ctx, 'completePM').mockResolvedValue();
        ctx.logPMFromSchedule({ pmId: 'PM-2', equipmentId: 'EQ2', taskName: 'Inspeksi' });
        expect(ctx.logForm.desc).toBe('Inspeksi');
        expect(ctx.logForm.tech).toBe('Maintenance Team');
    });
});

describe('PM Schedule — hari lokal, bukan UTC (S45i)', () => {
    // 18 Okt 2026 pukul 01:00 waktu lokal: di WIB (UTC+8) tanggal UTC masih
    // 17 Okt, jadi setiap pergeseran UTC/lokal langsung terlihat.
    const EARLY = new Date(2026, 9, 18, 1, 0, 0);
    const localISO = isoLocal;

    it('dateStr tiap sel kalender memakai tanggal lokal', () => {
        vi.setSystemTime(EARLY);
        const days = makeCtx({ pmMonthOffset: 0 }).pmGetCalendarDays();
        expect(days.length).toBeGreaterThan(27);
        for (const d of days) expect(d.dateStr).toBe(localISO(d.date));
    });

    it('isToday menandai sel hari ini menurut waktu lokal', () => {
        vi.setSystemTime(EARLY);
        const days = makeCtx({ pmMonthOffset: 0 }).pmGetCalendarDays();
        const flagged = days.filter((d) => d.isToday);
        expect(flagged).toHaveLength(1);
        expect(flagged[0].dateStr).toBe(localISO(EARLY));
    });

    it('event PM tampil di sel tanggal lokalnya sendiri', () => {
        vi.setSystemTime(EARLY);
        const key = localISO(EARLY);
        const ctx = makeCtx({
            pmMonthOffset: 0,
            pmList: [{ pmId: '1', taskName: 'Ganti Oli', equipmentId: 'EQ1', date: key, status: 'pending' }],
        });
        const cell = ctx.pmGetCalendarDays().find((d) => d.dateStr === key);
        expect(cell).toBeDefined();
        expect(cell.events).toHaveLength(1);
        expect(cell.isToday).toBe(true);
    });

    it('isOverdue memakai hari lokal saat UTC masih hari sebelumnya', () => {
        vi.setSystemTime(EARLY);
        const yesterday = localISO(new Date(2026, 9, 17));
        const ctx = makeCtx({
            pmList: [{ pmId: '1', taskName: 'A', equipmentId: 'EQ1', date: yesterday, status: 'pending' }],
        });
        expect(ctx.pmGetCalendarEvents()[yesterday][0].isOverdue).toBe(true);
    });

    it('pmIsDueSoon memakai hari lokal untuk batas tiga hari', () => {
        vi.setSystemTime(EARLY);
        const inThreeDays = localISO(new Date(2026, 9, 21));
        const ctx = makeCtx({
            pmList: [{ pmId: '1', taskName: 'A', equipmentId: 'EQ1', date: inThreeDays, status: 'pending' }],
        });
        expect(ctx.isPMDueSoon(ctx.pmList[0])).toBe(true);
    });
});
