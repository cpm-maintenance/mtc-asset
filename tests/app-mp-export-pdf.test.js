// @vitest-environment jsdom
/**
 * Tests untuk `src/js/app.js` rentang 2395-2476: `mpExportPDF`.
 *
 * `jspdf` + `jspdf-autotable` di-mock (library, bukan modul yang diuji).
 * Yang diperiksa: header, dua tabel opsional (PM & Open WO), offset `startY`
 * saat tabel PM kosong, nama berkas, dan jalur error/finally.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

const calls = {
  text: /** @type {any[][]} */ ([]),
  autoTable: /** @type {any[]} */ ([]),
  save: /** @type {any[][]} */ ([]),
  fill: /** @type {any[][]} */ ([]),
};

class MockJsPDF {
  constructor(...args) {
    this.args = args;
    this.internal = { pageSize: { getWidth: () => 297 } };
    this.lastAutoTable = { finalY: 100 };
  }
  setFillColor(...a) { calls.fill.push(a); }
  rect() {}
  setTextColor() {}
  setFontSize() {}
  setFont() {}
  text(...a) { calls.text.push(a); }
  autoTable(opts) { calls.autoTable.push(opts); }
  save(...a) { calls.save.push(a); }
}

vi.mock('jspdf', () => ({ jsPDF: MockJsPDF }));
vi.mock('jspdf-autotable', () => ({ default: () => {} }));

beforeEach(() => {
  stubFirebase();
  calls.text.length = 0;
  calls.autoTable.length = 0;
  calls.save.length = 0;
  calls.fill.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PM = [
  { taskName: 'Ganti oli', equipmentId: 'EQ-1', date: '2026-03-02', assignedTo: 'Budi', status: 'pending', priority: 'High' },
  { description: 'Cek belt', equipmentId: 'EQ-2' },
];
const WO = [
  { woNumber: 'WO-77', EquipmentID: 'EQ-1', Deskripsi: 'Bearing aus', dueDate: '2026-03-09', assignedTo: 'Sari', woPriority: 'Urgent' },
  { LogID: 'abcdef123456', EquipmentID: 'EQ-2', Jenis: 'Repair', Tanggal: '2026-03-10' },
];

/** @param {Record<string, any>} extra */
function appWith(extra = {}) {
  return makeApp({ mpMonth: 2, mpYear: 2026, mpLoading: false, ...extra });
}

describe('mpExportPDF — kedua tabel terisi', () => {
  it('menggambar header, dua autoTable, lalu menyimpan berkas bernama bulan-tahun', async () => {
    const s = appWith({ mpPMTasks: PM, mpOpenWOs: WO, mpTotalHours: 12.4 });

    await s.mpExportPDF();

    expect(calls.text[0][0]).toContain('MONTHLY MAINTENANCE PLAN - March 2026');
    expect(calls.text[2][0]).toContain('PM Tasks: 2  |  Open WOs: 2  |  Total Hours: 12');
    expect(calls.autoTable).toHaveLength(2);
    // Tabel PM mulai 44; tabel WO = finalY + 10 + 10
    expect(calls.autoTable[0].startY).toBe(44);
    expect(calls.autoTable[1].startY).toBe(120);
    expect(calls.autoTable[0].body[0]).toEqual([1, 'Ganti oli', 'EQ-1', '2026-03-02', 'Budi', 'pending', 'High']);
    expect(calls.autoTable[0].body[1]).toEqual([2, 'Cek belt', 'EQ-2', '-', '-', 'pending', 'Medium']);
    expect(calls.autoTable[1].body[0]).toEqual([1, 'WO-77', 'EQ-1', 'Bearing aus', '2026-03-09', 'Sari', 'Urgent']);
    expect(calls.autoTable[1].body[1]).toEqual([2, 'abcdef12', 'EQ-2', 'Repair', '2026-03-10', '-', 'Normal']);
    expect(calls.save[0][0]).toBe('Monthly_Plan_March_2026.pdf');
    expect(s.showNotification).toHaveBeenCalledWith('Monthly Plan PDF exported!');
    expect(s.mpLoading).toBe(false);
  });
});

describe('mpExportPDF — tabel kosong', () => {
  it('PM & WO kosong: tanpa autoTable, tetap simpan', async () => {
    const s = appWith({ mpPMTasks: [], mpOpenWOs: [], mpTotalHours: 0 });

    await s.mpExportPDF();

    expect(calls.autoTable).toHaveLength(0);
    expect(calls.save[0][0]).toBe('Monthly_Plan_March_2026.pdf');
    expect(s.mpLoading).toBe(false);
  });

  it('PM kosong tapi WO ada: tabel WO mulai di 38 + 10', async () => {
    const s = appWith({ mpPMTasks: [], mpOpenWOs: WO, mpTotalHours: 3 });

    await s.mpExportPDF();

    expect(calls.autoTable).toHaveLength(1);
    expect(calls.autoTable[0].startY).toBe(48);
  });

  it('PM ada tapi WO kosong: hanya satu autoTable', async () => {
    const s = appWith({ mpPMTasks: PM, mpOpenWOs: [], mpTotalHours: 1 });

    await s.mpExportPDF();

    expect(calls.autoTable).toHaveLength(1);
    expect(calls.save).toHaveLength(1);
  });
});

describe('mpExportPDF — jalur error', () => {
  it('kegagalan render: notifikasi error, mpLoading tetap direset', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = appWith({
      mpPMTasks: PM,
      mpOpenWOs: WO,
      mpTotalHours: 1,
      mpEquipName: vi.fn(() => { throw new Error('equip map rusak'); }),
    });

    await s.mpExportPDF();

    expect(err).toHaveBeenCalled();
    expect(s.showNotification).toHaveBeenCalledWith('Error exporting PDF: equip map rusak', 'error');
    expect(calls.save).toHaveLength(0);
    expect(s.mpLoading).toBe(false);
  });
});
