// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/wo-pdf-template.js` (kartu A, S24).
 *
 * Berkas ini 0% karena seluruh isinya menabrak `jsPDF` + canvas PDF nyata.
 * Yang diuji: logika template — pemilihan warna badge, cabang equipment
 * internal/EXTERNAL, parse `PartsUsed` (string JSON / array / rusak), batas
 * 5 baris parts, blok biaya + page-break, dan nama berkas unduhan.
 *
 * `jspdf` di-mock (library, bukan modulnya) supaya semua `doc.text(...)`
 * tetap tereksekusi dan bisa diperiksa.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const jsPDF = vi.hoisted(() => {
    const doc = {
        setFillColor: vi.fn(),
        setDrawColor: vi.fn(),
        setTextColor: vi.fn(),
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        text: vi.fn(),
        rect: vi.fn(),
        line: vi.fn(),
        addPage: vi.fn(),
        splitTextToSize: vi.fn((text) => [String(text)]),
        save: vi.fn(),
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    };
    return { doc, ctor: vi.fn(function jsPDFStub() { return doc; }) };
});

vi.mock('jspdf', () => ({ jsPDF: jsPDF.ctor }));

const { generateProfessionalWOPDF } = await import('../src/js/modules/wo-pdf-template.js');

/** Semua string yang pernah dikirim ke doc.text(), diratakan. */
function texts() {
    return jsPDF.doc.text.mock.calls.map((c) => c[0]).flat(Infinity).map(String);
}

function colors() {
    return jsPDF.doc.setFillColor.mock.calls.map((c) => c.join(','));
}

const WO = {
    woNumber: 'WO-2026-0042',
    woPriority: 'Urgent',
    Status: 'In Progress',
    Tanggal: '2026-10-18',
    Jenis: 'CM',
    rca: 'Mechanical',
    Technician: 'Andi',
    assignedTo: 'Andi',
    Deskripsi: 'Bearing pompa aus',
    requestSource: 'Produksi',
    requestedBy: 'Budi',
    equipmentId: 'EQ-1',
};

const EQUIP = { EquipmentID: 'EQ-1', Nama: 'Pompa Slurry', Lokasi: 'Plant 2', Status: 'Running' };

beforeEach(() => {
    for (const fn of Object.values(jsPDF.doc)) {
        if (typeof fn === 'function' && fn.mockClear) fn.mockClear();
    }
    jsPDF.ctor.mockClear();
});

describe('generateProfessionalWOPDF — dokumen dasar', () => {
    it('membuat dokumen A4 portrait dan menyimpannya dengan nomor WO', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);

        expect(jsPDF.ctor).toHaveBeenCalledWith('p', 'mm', 'a4');
        expect(jsPDF.doc.save).toHaveBeenCalledWith('WorkOrder_WO-2026-0042.pdf');
        const t = texts();
        expect(t).toContain('PT. CITRA PALU MINERALS');
        expect(t).toContain('MAINTENANCE TECHNICAL CENTER');
        expect(t).toContain('WORK ORDER');
        expect(t).toContain('WO-2026-0042');
        expect(t).toContain('WORK DETAILS');
        expect(t).toContain('DESCRIPTION');
    });

    it('WO tanpa nomor: badge WO-0000 dan berkas DRAFT', async () => {
        await generateProfessionalWOPDF({}, null, []);
        expect(texts()).toContain('WO-0000');
        expect(jsPDF.doc.save).toHaveBeenCalledWith('WorkOrder_DRAFT.pdf');
        // field kosong jatuh ke placeholder
        expect(texts()).toEqual(expect.arrayContaining(['-', 'PM']));
    });

    it('deskripsi dipecah lalu dipotong maksimum 4 baris', async () => {
        jsPDF.doc.splitTextToSize.mockReturnValueOnce(['a', 'b', 'c', 'd', 'e', 'f']);
        await generateProfessionalWOPDF({ ...WO, Deskripsi: 'panjang' }, EQUIP, []);
        expect(jsPDF.doc.splitTextToSize).toHaveBeenCalledWith('panjang', 174);
        const call = jsPDF.doc.text.mock.calls.find((c) => Array.isArray(c[0]));
        expect(call[0]).toEqual(['a', 'b', 'c', 'd']);
    });
});

describe('badge prioritas & status', () => {
    it.each([
        ['Emergency', '220,38,38'],
        ['Urgent', '234,179,8'],
        ['Planned', '16,185,129'],
        ['Normal', '202,138,4'],
    ])('prioritas %s → fill %s', async (priority, rgb) => {
        await generateProfessionalWOPDF({ ...WO, woPriority: priority }, EQUIP, []);
        expect(colors()).toContain(rgb);
        expect(texts()).toContain(priority.toUpperCase());
    });

    it.each([
        ['Completed', '16,185,129'],
        ['In Progress', '59,130,246'],
        ['Pending', '234,179,8'],
        ['On Hold', '107,114,128'],
    ])('status %s → fill %s', async (status, rgb) => {
        await generateProfessionalWOPDF({ ...WO, Status: status }, EQUIP, []);
        expect(colors()).toContain(rgb);
        expect(texts()).toContain(status.toUpperCase());
    });

    it('dueDate hanya dirender kalau ada', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        expect(texts().some((t) => t.startsWith('Due:'))).toBe(false);

        await generateProfessionalWOPDF({ ...WO, dueDate: '2026-10-25' }, EQUIP, []);
        expect(texts()).toContain('Due: 2026-10-25');
    });
});

describe('blok equipment', () => {
    it('internal: ID + nama, lokasi, status dari objek equipment', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        const t = texts();
        expect(t).toContain('EQ-1 - Pompa Slurry');
        expect(t).toContain('Plant 2');
        expect(t).toContain('Running');
        expect(t).toContain('Location:');
    });

    it('equipmentId EXTERNAL: pakai externalEquipName + requestSource', async () => {
        await generateProfessionalWOPDF(
            { ...WO, equipmentId: 'EXTERNAL', externalEquipName: 'Genset kontraktor', requestSource: 'Vendor' },
            EQUIP,
            [],
        );
        const t = texts();
        expect(t).toContain('Genset kontraktor');
        expect(t).toContain('Vendor');
        expect(t).toContain('Asset:');
        expect(t).not.toContain('EQ-1 - Pompa Slurry');
    });
});

describe('parts used', () => {
    const parts = [
        { id: 'SP-1', qty: 2 },
        { id: 'SP-2', qty: 1 },
        { id: 'SP-3', qty: 4 },
        { id: 'SP-4', qty: 1 },
        { id: 'SP-5', qty: 9 },
        { id: 'SP-6', qty: 7 },
    ];

    it('string JSON di-parse dan dibatasi 5 baris', async () => {
        await generateProfessionalWOPDF({ ...WO, PartsUsed: JSON.stringify(parts) }, EQUIP, []);
        const t = texts();
        expect(t).toContain('PARTS USED');
        expect(t).toContain('SP-1');
        expect(t).toContain('SP-5');
        expect(t).not.toContain('SP-6');
        expect(t).toContain('2');
        expect(t).toContain('9');
    });

    it('array langsung juga diterima', async () => {
        await generateProfessionalWOPDF({ ...WO, PartsUsed: [{ id: 'SP-9', qty: 3 }] }, EQUIP, []);
        expect(texts()).toContain('SP-9');
    });

    it('JSON rusak → dianggap tanpa parts, tidak melempar', async () => {
        await expect(generateProfessionalWOPDF({ ...WO, PartsUsed: '{rusak' }, EQUIP, [])).resolves.toBeUndefined();
        expect(texts()).not.toContain('PARTS USED');
        expect(jsPDF.doc.save).toHaveBeenCalled();
    });

    it('array kosong → tanpa tabel parts', async () => {
        await generateProfessionalWOPDF({ ...WO, PartsUsed: [] }, EQUIP, []);
        expect(texts()).not.toContain('PARTS USED');
    });
});

describe('blok biaya', () => {
    it('Downtime + Cost diformat ribuan dan dipisah titik', async () => {
        await generateProfessionalWOPDF({ ...WO, Downtime: 6, Cost: 1500000 }, EQUIP, []);
        const t = texts();
        expect(t).toContain('Downtime:');
        expect(t).toContain('6 hrs');
        expect(t).toContain('Cost:');
        expect(t).toContain('Rp 1.500.000');
    });

    it('Cost string "0" → "Rp 0" (bukan dilewati)', async () => {
        await generateProfessionalWOPDF({ ...WO, Cost: '0' }, EQUIP, []);
        expect(texts()).toContain('Rp 0');
    });

    it('tanpa downtime & cost: tidak ada blok biaya', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        expect(texts()).not.toContain('Downtime:');
        expect(texts()).not.toContain('Cost:');
    });

    it('parts 5 baris + biaya mendorong yPos melewati batas → addPage', async () => {
        const five = [1, 2, 3, 4, 5].map((n) => ({ id: `SP-${n}`, qty: n }));
        await generateProfessionalWOPDF({ ...WO, PartsUsed: five, Downtime: 2, Cost: 1000 }, EQUIP, []);
        expect(jsPDF.doc.addPage).toHaveBeenCalledTimes(1);
    });

    it('tanpa parts & biaya: satu halaman saja', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        expect(jsPDF.doc.addPage).not.toHaveBeenCalled();
    });
});

describe('tanda tangan & footer', () => {
    it('tiga kotak tanda tangan + footer timestamp', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        const t = texts();
        expect(t).toContain('REQUESTED BY');
        expect(t).toContain('APPROVED BY');
        expect(t).toContain('EXECUTED BY');
        expect(t).toContain('MTC System v2.0');
        expect(t.some((x) => x.startsWith('Generated: '))).toBe(true);
        expect(t.filter((x) => x === 'Name')).toHaveLength(3);
    });
});
