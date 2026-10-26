// Render contoh Work Order PDF ke berkas, untuk meninjau hasil layout tanpa app.
// Pakai: node scripts/render-wo-pdf.mjs   → menghasilkan WorkOrder_<no>.pdf di cwd.
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateProfessionalWOPDF } from '../src/js/modules/wo-pdf-template.js';

const WO = {
    LogID: 'LOG-SAMPLE-001',
    woNumber: 'MTC-0142',
    woPriority: 'Urgent',
    Status: 'In Progress',
    Tanggal: '2026-10-18',
    dueDate: '2026-10-25',
    Jenis: 'Corrective',
    rca: 'Mechanical',
    Technician: 'Sardi',
    assignedTo: ['Yuli', 'Gunawan', 'Maruf M'],
    Deskripsi:
        'Kebocoran pada mechanical seal pompa slurry P-204 terdeteksi saat inspeksi rutin shift pagi. ' +
        'Tekanan discharge turun dari 6,2 bar ke 4,8 bar dan suhu bearing naik 12 derajat di atas baseline. ' +
        'Pompa diisolasi, line dikuras, seal diganti berikut sleeve yang aus, lalu alignment diulang ' +
        'dan pompa diuji beban bertahap sampai 100 persen kapasitas.',
    requestSource: 'Production',
    requestedBy: 'Budi Santoso',
    requestDate: '2026-10-17',
    approvedBy: 'Ir. Fahmi',
    equipmentId: 'EQ-P204',
    estimatedHours: 6,
    actualHours: 5.5,
    Downtime: 4.5,
    Cost: 12750000,
    PartsUsed: [
        { id: '2810-CV-009', qty: 2, name: 'Mechanical seal cartridge 45 mm' },
        { id: '2810-CV-010', qty: 1, name: 'Sleeve pompa slurry' },
        { id: '2810-BR-114', qty: 4, name: 'Bearing 6312 C3' },
        { id: '2810-GK-021', qty: 2, name: 'Gasket spiral wound 4 in' },
        { id: '2810-LB-007', qty: 1, name: 'Pelumas Shell Gadus S2' },
        { id: '2810-OR-233', qty: 6, name: 'O-ring viton 90 mm' },
    ],
};

const EQUIP = {
    EquipmentID: 'EQ-P204',
    Nama: 'Pompa Slurry P-204',
    Lokasi: 'Plant 2 - Area Thickener',
    Status: 'Running',
};

await generateProfessionalWOPDF(WO, EQUIP, []);

const file = resolve(process.cwd(), 'WorkOrder_MTC-0142.pdf');
console.log('[render] ' + file + ' (' + statSync(file).size + ' bytes)');
