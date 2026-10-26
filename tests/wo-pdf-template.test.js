// @vitest-environment jsdom
/**
 * Kontrak template PDF Work Order (S41 — desain premium).
 *
 * Yang dijaga di sini adalah **isi dan keputusan layout**, bukan piksel:
 *  · dokumen A4 portrait, nama berkas dari nomor WO
 *  · pita meta (ISSUED/DUE/PRIORITY/STATUS) + warna tone per prioritas/status
 *  · seksi EQUIPMENT / WORK DETAILS / REQUEST / DESCRIPTION / PARTS USED
 *  · deskripsi **tidak** dipotong (dulu maksimum 4 baris)
 *  · tabel parts memuat **semua** baris + baris TOTAL ITEMS (dulu `slice(0, 5)`)
 *  · blok biaya (DOWNTIME / MAN HOURS / TOTAL COST) dan page-break saat isi panjang
 *  · tiga kolom tanda tangan + footer bernomor halaman
 *
 * `jspdf` di-mock (library, bukan modulnya) supaya setiap `doc.text(...)`
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
        setCharSpace: vi.fn(),
        setLineWidth: vi.fn(),
        text: vi.fn(),
        rect: vi.fn(),
        roundedRect: vi.fn(),
        circle: vi.fn(),
        line: vi.fn(),
        addPage: vi.fn(),
        setPage: vi.fn(),
        getNumberOfPages: vi.fn(() => 1),
        getTextWidth: vi.fn((s) => String(s).length * 1.6),
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
    jsPDF.doc.getNumberOfPages.mockReturnValue(1);
});

describe('dokumen dasar', () => {
    it('A4 portrait, nama berkas dari nomor WO, kop lengkap', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);

        expect(jsPDF.ctor).toHaveBeenCalledWith('p', 'mm', 'a4');
        expect(jsPDF.doc.save).toHaveBeenCalledWith('WorkOrder_WO-2026-0042.pdf');
        const t = texts();
        expect(t).toContain('PT. CITRA PALU MINERALS');
        expect(t).toContain('MAINTENANCE TECHNICAL CENTER');
        expect(t).toContain('WORK ORDER');
        expect(t).toContain('WO-2026-0042');
    });

    it('WO tanpa nomor: WO-0000 dan berkas DRAFT', async () => {
        await generateProfessionalWOPDF({}, null, []);
        expect(texts()).toContain('WO-0000');
        expect(jsPDF.doc.save).toHaveBeenCalledWith('WorkOrder_DRAFT.pdf');
        expect(texts()).toEqual(expect.arrayContaining(['-', 'PM']));
    });
});

describe('pita meta', () => {
    it('empat sel: ISSUED, DUE, PRIORITY, STATUS', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        const t = texts();
        expect(t).toEqual(expect.arrayContaining(['ISSUED', 'DUE', 'PRIORITY', 'STATUS']));
    });

    it('tanggal diformat jadi 18 Oct 2026', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        expect(texts()).toContain('18 Oct 2026');
    });

    it('DUE hanya terisi kalau dueDate ada', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        expect(texts()).toContain('—');

        await generateProfessionalWOPDF({ ...WO, dueDate: '2026-10-25' }, EQUIP, []);
        expect(texts()).toContain('25 Oct 2026');
    });

    it.each([
        ['Emergency', '185,28,28'],
        ['Urgent', '180,83,9'],
        ['Planned', '5,150,105'],
        ['Normal', '191,155,90'],
    ])('prioritas %s → titik tone %s', async (priority, rgb) => {
        await generateProfessionalWOPDF({ ...WO, woPriority: priority }, EQUIP, []);
        expect(colors()).toContain(rgb);
        expect(texts()).toContain(priority.toUpperCase());
    });

    it.each([
        ['Completed', '5,150,105'],
        ['In Progress', '37,99,235'],
        ['Pending', '180,83,9'],
        ['On Hold', '71,85,105'],
    ])('status %s → titik tone %s', async (status, rgb) => {
        await generateProfessionalWOPDF({ ...WO, Status: status }, EQUIP, []);
        expect(colors()).toContain(rgb);
        expect(texts()).toContain(status.toUpperCase());
    });
});

describe('seksi data', () => {
    it('equipment internal: ID · nama, lokasi, status aset', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        const t = texts();
        expect(t).toContain('EQ-1 · Pompa Slurry');
        expect(t).toContain('Plant 2');
        expect(t).toContain('Running');
        expect(t).toContain('LOCATION');
    });

    it('equipment EXTERNAL: nama aset + sumber, tanpa baris equipment internal', async () => {
        await generateProfessionalWOPDF(
            { ...WO, equipmentId: 'EXTERNAL', externalEquipName: 'Genset kontraktor', requestSource: 'Vendor' },
            EQUIP,
            [],
        );
        const t = texts();
        expect(t).toContain('Genset kontraktor');
        expect(t).toContain('Vendor');
        expect(t).toContain('EXTERNAL ASSET');
        expect(t).not.toContain('EQ-1 · Pompa Slurry');
    });

    it('assignedTo berupa larik dirangkai rapi', async () => {
        await generateProfessionalWOPDF({ ...WO, assignedTo: ['Yuli', 'Gunawan', 'Maruf M'] }, EQUIP, []);
        expect(texts()).toContain('Yuli, Gunawan, Maruf M');
    });

    it('assignedTo kosong jadi UNASSIGNED', async () => {
        await generateProfessionalWOPDF({ ...WO, assignedTo: '' }, EQUIP, []);
        expect(texts()).toContain('UNASSIGNED');
    });
});

describe('deskripsi tidak dipotong', () => {
    it('semua baris hasil wrap dirender, bukan empat baris pertama', async () => {
        jsPDF.doc.splitTextToSize.mockReturnValueOnce(['a', 'b', 'c', 'd', 'e', 'f']);
        await generateProfessionalWOPDF({ ...WO, Deskripsi: 'panjang' }, EQUIP, []);

        // Kolom kiri 106 mm, teks menjorok 5 mm dari rail emas.
        expect(jsPDF.doc.splitTextToSize).toHaveBeenCalledWith('panjang', 101);
        const rendered = jsPDF.doc.text.mock.calls
            .filter((c) => Array.isArray(c[0]))
            .map((c) => c[0]);
        expect(rendered).toEqual([]);
        const t = texts();
        for (const line of ['a', 'b', 'c', 'd', 'e', 'f']) expect(t).toContain(line);
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

    it('string JSON di-parse dan SEMUA baris dirender', async () => {
        await generateProfessionalWOPDF({ ...WO, PartsUsed: JSON.stringify(parts) }, EQUIP, []);
        const t = texts();
        expect(t).toContain('PARTS USED');
        expect(t).toContain('SP-1');
        expect(t).toContain('SP-6');
        expect(t).toContain('TOTAL ITEMS');
        expect(t).toContain('24');
    });

    it('nama part dipakai kalau ada', async () => {
        await generateProfessionalWOPDF(
            { ...WO, PartsUsed: [{ id: 'SP-9', qty: 3, name: 'Bearing 6312' }] },
            EQUIP,
            [],
        );
        expect(texts()).toContain('Bearing 6312');
    });

    it('array langsung juga diterima', async () => {
        await generateProfessionalWOPDF({ ...WO, PartsUsed: [{ id: 'SP-9', qty: 3 }] }, EQUIP, []);
        expect(texts()).toContain('SP-9');
    });

    it('JSON rusak → tanpa tabel parts, tidak melempar', async () => {
        await expect(generateProfessionalWOPDF({ ...WO, PartsUsed: '{rusak' }, EQUIP, [])).resolves.toBeUndefined();
        expect(texts()).not.toContain('PARTS USED');
        expect(jsPDF.doc.save).toHaveBeenCalled();
    });

    it('array kosong → tanpa tabel parts', async () => {
        await generateProfessionalWOPDF({ ...WO, PartsUsed: [] }, EQUIP, []);
        expect(texts()).not.toContain('PARTS USED');
    });
});

describe('ringkasan biaya', () => {
    it('downtime, man hours, dan total cost diformat', async () => {
        await generateProfessionalWOPDF(
            { ...WO, Downtime: 6, Cost: 1500000, estimatedHours: 6, actualHours: 5.5 },
            EQUIP,
            [],
        );
        const t = texts();
        expect(t).toContain('DOWNTIME');
        expect(t).toContain('6 hrs');
        expect(t).toContain('EST. HOURS');
        expect(t).toContain('ACTUAL HOURS');
        expect(t).toContain('6 h');
        expect(t).toContain('5,5 h');
        expect(t).toContain('TOTAL COST');
        expect(t).toContain('Rp 1.500.000');
    });

    it('Cost string "0" → "Rp 0" (bukan dilewati)', async () => {
        await generateProfessionalWOPDF({ ...WO, Cost: '0' }, EQUIP, []);
        expect(texts()).toContain('Rp 0');
    });

    it('tanpa downtime, cost, dan jam: tanpa blok ringkasan', async () => {
        await generateProfessionalWOPDF(WO, EQUIP, []);
        const t = texts();
        expect(t).not.toContain('DOWNTIME');
        expect(t).not.toContain('TOTAL COST');
    });

    it('WO wajar (6 parts + biaya) muat satu halaman', async () => {
        const six = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `SP-${n}`, qty: n }));
        await generateProfessionalWOPDF({ ...WO, PartsUsed: six, Downtime: 2, Cost: 1000 }, EQUIP, []);
        expect(jsPDF.doc.addPage).not.toHaveBeenCalled();
    });

    it('parts sangat banyak → halaman lanjutan', async () => {
        const many = Array.from({ length: 40 }, (_, i) => ({ id: `SP-${i + 1}`, qty: 1 }));
        await generateProfessionalWOPDF({ ...WO, PartsUsed: many, Downtime: 2, Cost: 1000 }, EQUIP, []);
        expect(jsPDF.doc.addPage).toHaveBeenCalled();
    });
});

describe('tanda tangan & footer', () => {
    it('tiga kolom tanda tangan + footer bernomor halaman', async () => {
        jsPDF.doc.getNumberOfPages.mockReturnValue(2);
        await generateProfessionalWOPDF(WO, EQUIP, []);
        const t = texts();
        expect(t).toContain('REQUESTED BY');
        expect(t).toContain('APPROVED BY');
        expect(t).toContain('EXECUTED BY');
        expect(t.filter((x) => x === 'Name / Position')).toHaveLength(3);
        expect(t.some((x) => x.startsWith('MTC System v2.0  ·  Form MTC-WO-01  ·  Printed '))).toBe(true);
        expect(t).toContain('Page 1 of 2');
        expect(t).toContain('Page 2 of 2');
        expect(jsPDF.doc.setPage).toHaveBeenCalledWith(2);
    });
});
