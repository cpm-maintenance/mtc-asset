// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/export.js` (Q-1).
 *
 * Modul ini sebelumnya **0.46%** coverage karena seluruh jalurnya menabrak
 * XLSX/jsPDF/DOM. Test di sini mem-stub tiga hal itu (`xlsx`, `jspdf`,
 * `wo-pdf-template`) supaya logika pemetaan data — bagian yang benar-benar
 * berisiko — bisa diuji tanpa jaringan/DOM nyata:
 *
 *  - `exportData`: normalisasi kolom array/objek sebelum masuk sheet
 *  - `downloadTemplate`: bentuk baris template per tipe
 *  - `exportKPIToPDF` / `exportWOToPDF`: guard + orkestrasi + notifikasi
 *  - `importCSV`: pemetaan tiap baris spreadsheet → record RTDB per tipe,
 *    termasuk pemisahan `EquipmentIDs` dan parse `PartsUsed`/`events`
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const xlsx = vi.hoisted(() => ({
    utils: {
        json_to_sheet: vi.fn((data) => ({ rows: data })),
        sheet_to_csv: vi.fn(() => 'kolom1,kolom2'),
        sheet_to_json: vi.fn(() => []),
    },
    read: vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: { '!ref': 'A1:B2' } } })),
}));

const jsPDF = vi.hoisted(() => {
    const doc = {
        setFontSize: vi.fn(),
        setFillColor: vi.fn(),
        setTextColor: vi.fn(),
        setLineWidth: vi.fn(),
        text: vi.fn(),
        rect: vi.fn(),
        line: vi.fn(),
        addPage: vi.fn(),
        splitTextToSize: vi.fn((s) => [s]),
        getTextWidth: vi.fn(() => 10),
        save: vi.fn(),
        internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    };
    return { doc, ctor: vi.fn(function jsPDFStub() { return doc; }) };
});

vi.mock('xlsx', () => xlsx);
vi.mock('jspdf', () => ({ jsPDF: jsPDF.ctor }));
vi.mock('../src/js/modules/wo-pdf-template.js', () => ({ generateProfessionalWOPDF: vi.fn(async () => {}) }));

import { exportModule } from '../src/js/modules/export.js';
import { generateProfessionalWOPDF } from '../src/js/modules/wo-pdf-template.js';

/** State bersih dengan rantai prototype ke modul. */
function makeCtx(overrides = {}) {
    const ctx = Object.create(exportModule);
    ctx.logs = [];
    ctx.equipment = [];
    ctx.allParts = [];
    ctx.performanceData = [];
    ctx.pmList = [];
    ctx.requisitions = [];
    ctx.isLoading = false;
    ctx.importProgress = 0;
    ctx.showNotification = vi.fn();
    return Object.assign(ctx, overrides);
}

/** `json_to_sheet` dipanggil dengan data hasil pemetaan → ambil baris pertama. */
function sheetRows() {
    return xlsx.utils.json_to_sheet.mock.calls.at(-1)[0];
}

/** Nama file unduhan terakhir (`a.download`). */
function lastDownloadName() {
    return HTMLAnchorElement.prototype.click.mock.instances.at(-1)?.download;
}

beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(() => 'blob:mock'),
        configurable: true,
        writable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    xlsx.utils.json_to_sheet.mockClear();
    xlsx.utils.sheet_to_csv.mockClear();
    xlsx.utils.sheet_to_json.mockReset().mockReturnValue([]);
    xlsx.read.mockClear();
    jsPDF.ctor.mockClear();
    generateProfessionalWOPDF.mockClear();
    delete window.Alpine;
});

afterEach(() => {
    vi.restoreAllMocks();
    delete window.db;
    delete window.ref;
    delete window.set;
    delete window.Alpine;
});

describe('export.js — exportData', () => {
    it('menggabungkan EquipmentIDs array jadi string berkoma', async () => {
        const ctx = makeCtx({
            allParts: [{ PartID: 'P1', NamaPart: 'Bearing', EquipmentIDs: ['EQ-1', 'EQ-2'] }],
        });

        await ctx.exportData('parts', 'csv');

        expect(sheetRows()[0].EquipmentIDs).toBe('EQ-1, EQ-2');
        expect(xlsx.utils.json_to_sheet).toHaveBeenCalledTimes(1);
    });

    it('membiarkan EquipmentIDs yang sudah berupa string', async () => {
        const ctx = makeCtx({ allParts: [{ PartID: 'P1', EquipmentIDs: 'EQ-1, EQ-2' }] });

        await ctx.exportData('parts', 'csv');

        expect(sheetRows()[0].EquipmentIDs).toBe('EQ-1, EQ-2');
    });

    it('men-serialisasi PartsUsed dan PhotoURLs pada log', async () => {
        const ctx = makeCtx({
            logs: [{ LogID: 'L1', PartsUsed: [{ partId: 'P1', qty: 2 }], PhotoURLs: ['a.jpg'] }],
        });

        await ctx.exportData('logs', 'csv');

        expect(sheetRows()[0].PartsUsed).toBe('[{"partId":"P1","qty":2}]');
        expect(sheetRows()[0].PhotoURLs).toBe('["a.jpg"]');
    });

    it('membiarkan PartsUsed yang sudah string', async () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L1', PartsUsed: '[]', PhotoURLs: '[]' }] });

        await ctx.exportData('logs', 'csv');

        expect(sheetRows()[0].PartsUsed).toBe('[]');
    });

    it('men-serialisasi events pada performance', async () => {
        const ctx = makeCtx({ performanceData: [{ id: 'PF1', events: [{ t: 'bd' }] }] });

        await ctx.exportData('perf', 'csv');

        expect(sheetRows()[0].events).toBe('[{"t":"bd"}]');
    });

    it('meneruskan equipment apa adanya', async () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ-1', Nama: 'Crusher' }] });

        await ctx.exportData('equip', 'csv');

        expect(sheetRows()).toEqual([{ EquipmentID: 'EQ-1', Nama: 'Crusher' }]);
    });

    it('memakai window.Alpine.raw untuk melepas proxy Alpine', async () => {
        const raw = vi.fn((arr) => arr.map((x) => ({ ...x, diraw: true })));
        window.Alpine = { raw };
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ-1' }] });

        await ctx.exportData('equip', 'csv');

        expect(raw).toHaveBeenCalledTimes(4);
        expect(sheetRows()[0].diraw).toBe(true);
    });

    it('menulis file CSV dengan nama bertipe data', async () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ-1' }] });

        await ctx.exportData('equip', 'csv');

        expect(lastDownloadName()).toMatch(/^Equipment_Export_\d+\.csv$/);
        expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('memakai nama file berbeda per tipe', async () => {
        await makeCtx({ performanceData: [] }).exportData('perf', 'csv');
        expect(lastDownloadName()).toMatch(/^Performance_Export_/);

        await makeCtx({ allParts: [] }).exportData('parts', 'csv');
        expect(lastDownloadName()).toMatch(/^SpareParts_Export_/);

        await makeCtx({ logs: [] }).exportData('logs', 'csv');
        expect(lastDownloadName()).toMatch(/^HistoryLogs_Export_/);
    });
});

describe('export.js — downloadTemplate', () => {
    it('mengunduh template equipment dengan contoh baris', async () => {
        await makeCtx().downloadTemplate('equip');

        expect(sheetRows()[0].EquipmentID).toBe('EQ-001');
        expect(lastDownloadName()).toBe('Template_Equipment.csv');
    });

    it('mengunduh template spare part dengan EquipmentIDs berkoma', async () => {
        await makeCtx().downloadTemplate('parts');

        expect(sheetRows()[0].EquipmentIDs).toBe('EQ-001, EQ-002');
        expect(lastDownloadName()).toBe('Template_SpareParts.csv');
    });

    it('mengunduh template history log', async () => {
        await makeCtx().downloadTemplate('logs');

        expect(sheetRows()[0].LogID).toBe('LOG-001');
        expect(lastDownloadName()).toBe('Template_HistoryLogs.csv');
    });

    it('mengunduh template performance', async () => {
        await makeCtx().downloadTemplate('perf');

        expect(sheetRows()[0].id).toBe('PERF-001');
        expect(lastDownloadName()).toBe('Template_Performance.csv');
    });

    it('mengirim sheet kosong untuk tipe tak dikenal', async () => {
        await makeCtx().downloadTemplate('entah');

        expect(sheetRows()).toEqual([]);
        expect(lastDownloadName()).toBe('.csv');
    });
});

describe('export.js — exportKPIToPDF', () => {
    it('menolak jalan tanpa data performance', async () => {
        const ctx = makeCtx({ performanceData: [] });

        await ctx.exportKPIToPDF();

        expect(ctx.showNotification).toHaveBeenCalledWith('No performance data to export', 'error');
        expect(jsPDF.ctor).not.toHaveBeenCalled();
    });

    it('membangun tabel PDF dari #perfTable dan melaporkan sukses', async () => {
        // Fixture statis (literal, bukan input user) — aman untuk innerHTML.
        document.body.innerHTML = `
            <table id="perfTable">
                <thead><tr><th>Equipment</th><th>Downtime</th></tr></thead>
                <tbody>
                    <tr><td>EQ-1</td><td>4</td></tr>
                    <tr><td>EQ-2</td><td>6</td></tr>
                </tbody>
            </table>`;
        const ctx = makeCtx({ performanceData: [{ id: 'PF1' }] });

        await ctx.exportKPIToPDF();

        expect(jsPDF.ctor).toHaveBeenCalledWith('l', 'mm', 'a4');
        expect(jsPDF.doc.save).toHaveBeenCalledWith(expect.stringMatching(/^Performance_KPI_Report_\d+\.pdf$/));
        expect(ctx.showNotification).toHaveBeenCalledWith('Generating PDF... Please wait.', 'info');
        expect(ctx.showNotification).toHaveBeenCalledWith('PDF exported successfully');
    });

    it('melaporkan gagal bila elemen tabel tidak ada', async () => {
        document.body.innerHTML = '';
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ performanceData: [{ id: 'PF1' }] });

        await ctx.exportKPIToPDF();

        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Failed to export PDF: Table element not found',
            'error',
        );
    });
});

describe('export.js — exportWOToPDF', () => {
    it('menolak tanpa logId', async () => {
        const ctx = makeCtx();

        await ctx.exportWOToPDF('');

        expect(ctx.showNotification).toHaveBeenCalledWith('No work order selected', 'error');
        expect(generateProfessionalWOPDF).not.toHaveBeenCalled();
    });

    it('melaporkan bila Work Order tidak ditemukan', async () => {
        const ctx = makeCtx({ logs: [{ LogID: 'L1' }] });

        await ctx.exportWOToPDF('L404');

        expect(ctx.showNotification).toHaveBeenCalledWith('Work order not found', 'error');
    });

    it('meneruskan log + equipment + daftar part ke generator PDF', async () => {
        const log = { LogID: 'L1', EquipmentID: 'EQ-1', woNumber: 'WO-1' };
        const equipment = { EquipmentID: 'EQ-1', Nama: 'Crusher' };
        const parts = [{ PartID: 'P1' }];
        const ctx = makeCtx({ logs: [log], equipment: [equipment], allParts: parts });

        await ctx.exportWOToPDF('L1');

        expect(generateProfessionalWOPDF).toHaveBeenCalledWith(log, equipment, parts);
        expect(ctx.showNotification).toHaveBeenCalledWith('Work Order PDF exported');
    });

    it('menangkap error generator PDF', async () => {
        generateProfessionalWOPDF.mockRejectedValueOnce(new Error('jsPDF mati'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ logs: [{ LogID: 'L1' }] });

        await ctx.exportWOToPDF('L1');

        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to export WO PDF: jsPDF mati', 'error');
    });
});

describe('export.js — importCSV', () => {
    /** Event `change` palsu dengan satu File. */
    function fileEvent() {
        return { target: { files: [new File(['dummy'], 'data.csv', { type: 'text/csv' })], value: 'data.csv' } };
    }

    function stubFirebase() {
        window.db = {};
        window.ref = vi.fn((_db, path) => path);
        window.set = vi.fn(async () => {});
    }

    beforeEach(() => {
        stubFirebase();
    });

    it('tidak melakukan apa pun bila tidak ada file terpilih', async () => {
        const ctx = makeCtx();

        await ctx.importCSV({ target: { files: [], value: '' } }, 'equip');

        expect(xlsx.read).not.toHaveBeenCalled();
        expect(window.set).not.toHaveBeenCalled();
    });

    it('memetakan baris equipment dengan default aman', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([{ EquipmentID: 'EQ-9' }, { Nama: 'Pompa' }]);
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'equip');
        await vi.waitFor(() => expect(window.set).toHaveBeenCalledTimes(2));

        const [path, record] = window.set.mock.calls[0];
        expect(path).toBe('Equipment/EQ-9');
        expect(record).toMatchObject({
            EquipmentID: 'EQ-9',
            Nama: '',
            Tipe: 'Other',
            Status: 'Active',
            Criticality: 'Medium',
        });
        // Baris tanpa ID apa pun → id fallback `EQUIP-<timestamp>`
        expect(window.set.mock.calls[1][0]).toMatch(/^Equipment\/EQUIP-\d+$/);
        expect(ctx.showNotification).toHaveBeenCalledWith('Successfully processed 2 records');
    });

    it('memisahkan EquipmentIDs berkoma pada import spare part', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            { PartID: 'P-1', NamaPart: 'Bearing', EquipmentIDs: 'EQ-1, EQ-2', Stok: '7' },
        ]);
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'parts');
        await vi.waitFor(() => expect(window.set).toHaveBeenCalledTimes(1));

        const [path, record] = window.set.mock.calls[0];
        expect(path).toBe('SpareParts/P-1');
        expect(record.EquipmentIDs).toEqual(['EQ-1', 'EQ-2']);
        expect(record.EquipmentID).toBe('EQ-1');
        expect(record.Stok).toBe(7);
    });

    it('memakai EquipmentID tunggal bila EquipmentIDs tidak ada', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([{ PartID: 'P-2', EquipmentID: 'EQ-7' }]);
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'parts');
        await vi.waitFor(() => expect(window.set).toHaveBeenCalledTimes(1));

        expect(window.set.mock.calls[0][1].EquipmentIDs).toEqual(['EQ-7']);
    });

    it('mengisi default performance dan menurunkan freq dari bd', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            { id: 'PF-1', bd: '3' },
            { id: 'PF-2', bd: '0', freq: '5' },
        ]);
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'perf');
        await vi.waitFor(() => expect(window.set).toHaveBeenCalledTimes(2));

        const first = window.set.mock.calls[0][1];
        expect(window.set.mock.calls[0][0]).toBe('Performance/PF-1');
        expect(first).toMatchObject({ rca: 'None', type: 'Unscheduled', category: 'Mechanical', paPlan: 90 });
        expect(first.freq).toBe(1); // bd > 0 → 1
        expect(first.events).toEqual([]);
        expect(window.set.mock.calls[1][1].freq).toBe(5);
    });

    it('mem-parse events JSON pada import performance', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([{ id: 'PF-3', events: '[{"t":"bd"}]' }]);
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'perf');
        await vi.waitFor(() => expect(window.set).toHaveBeenCalledTimes(1));

        expect(window.set.mock.calls[0][1].events).toEqual([{ t: 'bd' }]);
    });

    it('mem-parse PartsUsed/PhotoURLs JSON pada import log', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([
            {
                LogID: 'LG-1',
                PartsUsed: '[{"partId":"P1","qty":2}]',
                PhotoURLs: '["a.jpg"]',
                Downtime: '4',
                Cost: '1500',
            },
        ]);
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'logs');
        await vi.waitFor(() => expect(window.set).toHaveBeenCalledTimes(1));

        const [path, record] = window.set.mock.calls[0];
        expect(path).toBe('HistoryLog/LG-1');
        expect(record.PartsUsed).toEqual([{ partId: 'P1', qty: 2 }]);
        expect(record.PhotoURLs).toEqual(['a.jpg']);
        expect(record.Downtime).toBe(4);
        expect(record.Cost).toBe(1500);
        expect(record.Jenis).toBe('PM');
        expect(record.Status).toBe('Completed');
    });

    it('membiarkan PartsUsed non-JSON sebagai array kosong', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([{ LogID: 'LG-2', PartsUsed: 'bukan-json' }]);
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'logs');
        await vi.waitFor(() => expect(window.set).toHaveBeenCalledTimes(1));

        expect(window.set.mock.calls[0][1].PartsUsed).toEqual([]);
    });

    it('melaporkan kegagalan import dan mengosongkan progress', async () => {
        xlsx.utils.sheet_to_json.mockReturnValue([{ EquipmentID: 'EQ-1' }]);
        window.set = vi.fn(async () => {
            throw new Error('permission denied');
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx();

        await ctx.importCSV(fileEvent(), 'equip');
        await vi.waitFor(() => expect(ctx.showNotification).toHaveBeenCalledWith('Import failed: permission denied', 'error'));

        expect(ctx.isLoading).toBe(false);
        expect(ctx.importProgress).toBe(0);
    });
});
