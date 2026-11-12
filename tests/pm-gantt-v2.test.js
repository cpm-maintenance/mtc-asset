// @vitest-environment jsdom
/**
 * Unit test GANTT v2 (D22): window 1 bulan + kolom kiri + bar berlabel.
 * Lanjutan D21 (tests/pm-gantt-view.test.js).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { pmScheduleModule } from '../src/js/modules/pm-schedule.js';

const TODAY = new Date('2026-10-18T00:00:00Z');
const iso = (offsetDays = 0) => {
  const d = new Date(TODAY.getTime() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function makeCtx(over = {}) {
  return Object.assign(Object.create(pmScheduleModule), {
    pmList: [],
    pmForm: {},
    pmView: 'gantt',
    pmGanttScroll: 0,
    pmFilterEquip: '',
    pmFilterStatus: '',
    pmFilterPriority: '',
    pmSearch: '',
    _ganttEqMap: null,
    _ganttEqRef: null,
  }, over);
}

const PAGE = readFileSync('public/pages/PMSchedule.html', 'utf8');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('window bulan aktif', () => {
  it('default = bulan berjalan, penuh 1 bulan', () => {
    const ctx = makeCtx();
    const w = ctx.pmGanttMonthWindow();
    expect(w.days).toHaveLength(31);
    expect(w.days[0].dateStr).toBe('2026-10-01');
    expect(w.days[30].dateStr).toBe('2026-10-31');
    expect(w.label).toBe('October 2026');
    expect(w.start).toBe(ctx.pmGetGanttDays().findIndex((d) => d.dateStr === '2026-10-01'));
    expect(w.offsetX).toBe(w.start * 32);
    expect(w.width).toBe(31 * 32);
  });

  it('tab bulan lain menggeser window', () => {
    const w = makeCtx({ pmGanttScroll: 4 }).pmGanttMonthWindow();
    expect(w.days[0].dateStr).toBe('2027-02-01');
    expect(w.days[27].dateStr).toBe('2027-02-28');
  });

  it('pmGanttVisible hanya true di dalam bulan aktif', () => {
    const ctx = makeCtx({
      pmList: [
        { pmId: 'in', equipmentId: 'EQ1', date: iso(0), status: 'pending' },
        { pmId: 'out', equipmentId: 'EQ1', date: iso(-40), status: 'pending' },
      ],
    });
    const evs = ctx.pmGetGanttRows()[0].events;
    const inEvt = evs.find((e) => e.id === 'in');
    const outEvt = evs.find((e) => e.id === 'out');
    expect(ctx.pmGanttVisible(inEvt)).toBe(true);
    expect(ctx.pmGanttVisible(outEvt)).toBe(false);
  });

  it('pmGanttBarLeft relatif terhadap bulan aktif', () => {
    const ctx = makeCtx({ pmList: [{ pmId: '1', equipmentId: 'EQ1', date: iso(0), status: 'pending' }] });
    const e = ctx.pmGetGanttRows()[0].events[0];
    expect(ctx.pmGanttBarLeft(e)).toBe(e.left - ctx.pmGanttMonthWindow().offsetX);
  });
});

describe('kolom kiri: tipe, HM, critical', () => {
  it('row membawa tipe, HM mesin, label, dan penanda critical', () => {
    window.app = { equipment: [{ EquipmentID: 'EQ1', Nama: 'Excavator', Tipe: 'Crusher' }] };
    const ctx = makeCtx({
      pmList: [{ pmId: '1', equipmentId: 'EQ1', date: iso(10), status: 'pending' }],
      pmCurrentHM: () => 250,
    });
    const row = ctx.pmGetGanttRows()[0];
    expect(row.tipe).toBe('Crusher');
    expect(row.hm).toBe(250);
    expect(row.hmLabel).toBe('250h');
    expect(row.icon).toBeTruthy();
    expect(row.critical).toBe(false);
    expect(row.statusLabel).toBe('SCHEDULED');
  });

  it('HM 0 dan label tetap ada tanpa data mesin', () => {
    const ctx = makeCtx({
      pmList: [{ pmId: '1', equipmentId: 'EQ1', date: iso(0), status: 'pending' }],
      pmCurrentHM: () => 0,
    });
    expect(ctx.pmGetGanttRows()[0].hmLabel).toBe('0h');
  });

  it('rollup status jadi label uppercase', () => {
    const ctx = makeCtx({
      pmList: [{ pmId: '1', equipmentId: 'EQ1', date: iso(-3), status: 'pending' }],
    });
    expect(ctx.pmGetGanttRows()[0].statusLabel).toBe('OVERDUE');
  });
});

describe('kontrak markup v2', () => {
  it('strip hari memakai window bulan aktif', () => {
    expect(PAGE).toContain('pmGanttMonthWindow()');
    expect(PAGE).toContain('pmGanttVisible(evt)');
    expect(PAGE).toContain('pmGanttBarLeft(evt)');
  });

  it('navigasi bulan + TODAY ada', () => {
    expect(PAGE).toContain('>TODAY<');
    expect(PAGE).toContain('pmGanttScroll = idx - 2');
    expect(PAGE).toContain('pmGanttScroll = 0');
  });

  it('bar berlabel permanen, bukan hover-only', () => {
    expect(PAGE).toContain('min-w-[96px]');
    expect(PAGE).not.toContain('opacity-0 hover:opacity-100');
  });

  it('badge HM, chip CP, footer SHOWING ada', () => {
    expect(PAGE).toContain('row.hmLabel');
    expect(PAGE).toContain('>CP<');
    expect(PAGE).toContain('SHOWING');
    expect(PAGE).toContain('SCHEDULED UNITS');
  });

  it('tanpa CDN Tailwind dan tanpa grid-cols-2 di dalam <form>', () => {
    expect(PAGE).not.toContain('cdn.tailwindcss');
    const forms = [...PAGE.matchAll(/<form\b[\s\S]*?<\/form>/g)];
    expect(forms.length).toBeGreaterThan(0);
    forms.forEach((m) => expect(m[0]).not.toContain('grid-cols-2'));
  });
});

