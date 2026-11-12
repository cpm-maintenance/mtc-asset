// @vitest-environment jsdom
/**
 * Unit test tampilan Gantt PM Schedule (D21): src/js/modules/pm-schedule.js
 * + kontrak markup public/pages/PMSchedule.html.
 *
 * Cakupan: zoom DAY/WEEK/MONTH, lebar bar mengikuti zoom, link dependency
 * heuristik (PM se-equipment berurutan tanggal), critical path, checklist
 * prosedur, dan kontrak markup tab Gantt (tanpa CDN Tailwind, tanpa
 * `grid-cols-2` di dalam `<form>`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { pmScheduleModule } from '../src/js/modules/pm-schedule.js';

const TODAY = new Date('2026-10-18T00:00:00Z');
/** Tanggal LOKAL dari sebuah Date — `toISOString()` memberi tanggal UTC. */
const iso = (offsetDays = 0) => {
  const d = new Date(TODAY.getTime() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function makeCtx(over = {}) {
  const ctx = Object.create(pmScheduleModule);
  return Object.assign(ctx, {
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

describe('gantt zoom & geometri bar', () => {
  it('default DAY dan lebar px per tingkat zoom', () => {
    const ctx = makeCtx();
    expect(ctx.pmGanttZoom).toBe('day');
    expect(ctx.pmGetGanttDayWidth()).toBe(32);
    ctx.pmGanttZoom = 'week';
    expect(ctx.pmGetGanttDayWidth()).toBe(20);
    ctx.pmGanttZoom = 'month';
    expect(ctx.pmGetGanttDayWidth()).toBe(10);
    ctx.pmGanttZoom = 'aneh';
    expect(ctx.pmGetGanttDayWidth()).toBe(32);
  });

  it('pmGanttWidth = jumlah hari x lebar hari', () => {
    const ctx = makeCtx();
    expect(ctx.pmGanttWidth()).toBe(ctx.pmGetGanttDays().length * 32);
  });

  it('left & width bar mengikuti lebar hari zoom aktif', () => {
    const ctx = makeCtx({
      pmList: [{ pmId: '1', equipmentId: 'EQ1', date: iso(-2), status: 'pending', taskName: 'Oli' }],
    });
    const evt = ctx.pmGetGanttRows()[0].events[0];
    const idx = ctx.pmGetGanttDays().findIndex((d) => d.dateStr === iso(-2));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(evt.left).toBe(idx * 32);
    expect(evt.width).toBe(62);
  });
});

describe('dependency & critical path (heuristik se-equipment)', () => {
  const chain = () => makeCtx({
    pmList: [
      { pmId: '1', equipmentId: 'EQ1', date: iso(-2), status: 'pending', taskName: 'A' },
      { pmId: '2', equipmentId: 'EQ1', date: iso(1), status: 'pending', taskName: 'B' },
      { pmId: '3', equipmentId: 'EQ2', date: iso(3), status: 'pending', taskName: 'C' },
    ],
  });

  it('PM se-equipment berurutan tanggal jadi satu link', () => {
    const links = chain().pmGetGanttLinks();
    expect(links).toHaveLength(1);
    expect(links[0].key).toBe('1-2');
  });

  it('satu PM per equipment tidak menghasilkan link', () => {
    const ctx = makeCtx({ pmList: [{ pmId: '9', equipmentId: 'EQ9', date: iso(1), status: 'pending' }] });
    expect(ctx.pmGetGanttLinks()).toEqual([]);
  });

  it('critical path = chain dengan overdue, berakhir <= 7 hari', () => {
    const cp = chain().pmGetCriticalPath();
    expect(cp.equipIds).toEqual(['EQ1']);
    expect([...cp.ids].sort()).toEqual(['1', '2']);
  });

  it('chain tanpa overdue bukan critical path', () => {
    const ctx = makeCtx({
      pmList: [
        { pmId: '1', equipmentId: 'EQ1', date: iso(1), status: 'pending' },
        { pmId: '2', equipmentId: 'EQ1', date: iso(2), status: 'pending' },
      ],
    });
    expect(ctx.pmGetCriticalPath().equipIds).toEqual([]);
  });

  it('pmGanttRowLinks memberi elbow SVG + penanda critical', () => {
    const ctx = chain();
    const row = ctx.pmGetGanttRows().find((r) => r.equipId === 'EQ1');
    const links = ctx.pmGanttRowLinks(row);
    expect(links).toHaveLength(1);
    expect(links[0].critical).toBe(true);
    expect(links[0].d).toMatch(/^M [\d.]+ 50 V 78 H [\d.]+ V 50$/);
    expect(ctx.pmGanttRowSvg(row)).toContain('<path');
  });

  it('pmGanttRowSvg kosong saat dependency dimatikan', () => {
    const ctx = chain();
    const row = ctx.pmGetGanttRows().find((r) => r.equipId === 'EQ1');
    ctx.pmGanttShowDeps = false;
    expect(ctx.pmGanttRowSvg(row)).toBe('');
  });

  it('toggle dependencies & critical path', () => {
    const ctx = makeCtx();
    expect(ctx.pmGanttShowDeps).toBe(true);
    expect(ctx.pmGanttShowCritical).toBe(true);
    ctx.pmToggleDeps();
    ctx.pmToggleCritical();
    expect(ctx.pmGanttShowDeps).toBe(false);
    expect(ctx.pmGanttShowCritical).toBe(false);
  });
});

describe('checklist prosedur', () => {
  it('memecah deskripsi jadi langkah bersih', () => {
    const ctx = makeCtx();
    expect(ctx.pmGetChecklist({ description: '1. Cek oli\n- Ganti filter\n\n' })).toEqual(['Cek oli', 'Ganti filter']);
    expect(ctx.pmGetChecklist(null)).toEqual([]);
  });
});

describe('kontrak markup tab Gantt', () => {
  it('tidak memuat CDN Tailwind', () => {
    expect(PAGE).not.toContain('cdn.tailwindcss');
  });

  it('kontrol zoom + toggle overlay ada', () => {
    expect(PAGE).toContain("['day', 'week', 'month']");
    expect(PAGE).toContain('pmGanttZoom = z');
    expect(PAGE).toContain('pmToggleDeps()');
    expect(PAGE).toContain('pmToggleCritical()');
  });

  it('kartu KPI ke-3 memakai UPCOMING 30D', () => {
    expect(PAGE).toContain('UPCOMING 30D');
  });

  it('overlay dependency digambar sebagai svg per baris', () => {
    expect(PAGE).toContain('pmGanttRowSvg(');
    expect(PAGE).toContain('preserveAspectRatio="none"');
  });

  it('tidak ada grid-cols-2 di dalam <form>', () => {
    const forms = [...PAGE.matchAll(/<form\b[\s\S]*?<\/form>/g)];
    expect(forms.length).toBeGreaterThan(0);
    forms.forEach((m) => expect(m[0]).not.toContain('grid-cols-2'));
  });
});
