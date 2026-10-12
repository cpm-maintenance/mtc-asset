// @ts-check
/** @typedef {import('../appstate').AppState} AppState */
/**
 * @file Export & Import module.
 *
 * Menangani ekspor Excel/CSV/PDF (Excel full multi-sheet, template, KPI,
 * Work Order, PM schedule, laporan per-asset) serta impor CSV/Excel.
 * Modul ini di-mix ke dalam komponen Alpine sehingga metode dapat membaca
 * state (`this.logs`, `this.equipment`, `this.allParts`, `this.pmList`,
 * `this.performanceData`, `this.requisitions`) dan memanggil
 * `this.showNotification`.
 *
 * Catatan: PDF memakai jsPDF yang di-import secara lazy; aset gambar
 * (logo) tidak di-embed agar bundle tetap ringan.
 */
/**
 * Export & Import module
 */
import { generateProfessionalWOPDF } from './wo-pdf-template.js';

/**
 * Parse JSON dengan aman; bila gagal mengembalikan `fallback`.
 *
 * @param {string} str - String JSON.
 * @param {Array<any>} [fallback=[]] - Nilai pengganti saat parse gagal.
 * @returns {Array<any>} Array hasil parse, atau `fallback`.
 */
function tryParseJSON(str, fallback = []) {
    if (!str || typeof str !== 'string') return fallback;
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        console.warn('JSON parse failed:', e);
        return fallback;
    }
}

/**
 * Import dinamis library `xlsx` (lazy).
 *
 * @returns {Promise<*>} Modul XLSX.
 */
async function loadXLSX() {
    return await import('xlsx');
}

/** @type {object|null} Cache instance jsPDF agar tidak di-import berulang. */
let jsPDFInstance = null;

/**
 * Ambil (dan cache) constructor jsPDF via dynamic import.
 *
 * @returns {Promise<any>} Constructor jsPDF.
 */
async function loadJsPDF() {
    if (jsPDFInstance) return jsPDFInstance;
    const { jsPDF } = await import('jspdf');
    jsPDFInstance = jsPDF;
    return jsPDF;
}

/**
 * Ekspor isi tabel HTML (berdasarkan `elementId`) menjadi PDF landscape sederhana.
 *
 * @param {string} elementId - Id elemen tabel sumber.
 * @param {string} title - Judul yang dicetak di atas tabel.
 * @returns {Promise<boolean>} `true` bila PDF tersimpan.
 */
async function exportTableToPDF(elementId, title) {
    try {
        const { jsPDF } = await import('jspdf');
        const element = document.getElementById(elementId);
        if (!element) throw new Error('Table element not found');

        // Get table data manually
        const rows = /** @type {any[][]} */ ([]);
        const headers = /** @type {string[]} */ ([]);
        const thead = element.querySelector('thead');
        if (thead) {
            thead.querySelectorAll('th').forEach(th => headers.push((th.textContent || '').trim()));
        }
        const tbody = element.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const row = /** @type {string[]} */ ([]);
                tr.querySelectorAll('td').forEach(td => row.push((td.textContent || '').trim()));
                if (row.length > 0) rows.push(row);
            });
        }

        // Create simple PDF without autoTable
        const pdf = new jsPDF('l', 'mm', 'a4');
        pdf.setFontSize(16);
        pdf.text(title, 14, 20);
        pdf.setFontSize(10);
        pdf.text('Generated: ' + new Date().toLocaleString(), 14, 28);

        let yPos = 40;
        const cellWidth = 25;
        const cellHeight = 8;

        // Draw headers
        pdf.setFontSize(9);
        pdf.setFillColor(5, 11, 24);
        pdf.rect(14, yPos, 270, cellHeight, 'F');
        pdf.setTextColor(255, 255, 255);
        headers.forEach((/** @type {string} */ h, /** @type {number} */ i) => pdf.text(h.substring(0, 12), 15 + i * cellWidth, yPos + 6));

        // Draw rows
        yPos += cellHeight;
        pdf.setTextColor(0, 0, 0);
        rows.slice(0, 15).forEach((/** @type {string[]} */ row, /** @type {number} */ rowIndex) => {
            if (rowIndex % 2 === 0) {
                pdf.setFillColor(240, 240, 240);
                pdf.rect(14, yPos, 270, cellHeight, 'F');
            }
            row.forEach((/** @type {string} */ cell, /** @type {number} */ i) => {
                pdf.text(cell.substring(0, 15), 15 + i * cellWidth, yPos + 6);
            });
            yPos += cellHeight;
            if (yPos > 180) return;
        });

        pdf.save(`${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
        return true;
    } catch (e) {
        console.error('PDF export error:', e);
        throw e;
    }
}

/**
 * @file Export/Import module (mixin Alpine).
 * Semua metode memakai `this.*` dari komponen induk dan memicu unduhan file di browser.
 */
export const exportModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({

    // D1: Export Excel lengkap — multi-sheet (Equipment, SpareParts, Logs, Performance, PM, Requisitions)
/**
 * Ekspor Excel lengkap multi-sheet (Equipment, SpareParts, HistoryLog,
 * Performance, PM_Schedule, Requisitions) + sheet Summary.
 *
 * @returns {Promise<void>} Memicu unduhan `.xlsx` dan notifikasi.
 */
    async exportExcelFull() {
        const XLSX = await loadXLSX();
        const raw = (/** @type {any[]} */ arr) => /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(arr || []) : (arr || []));
        const wb = XLSX.utils.book_new();

        const sheets = /** @type {any[][]} */ ([
            ['Equipment', raw(this.equipment)],
            ['SpareParts', raw(this.allParts).map(p => ({ ...p, EquipmentIDs: Array.isArray(p.EquipmentIDs) ? p.EquipmentIDs.join(', ') : p.EquipmentIDs }))],
            ['HistoryLog', raw(this.logs).map(l => ({ ...l, PartsUsed: typeof l.PartsUsed === 'string' ? l.PartsUsed : JSON.stringify(l.PartsUsed || []) }))],
            ['Performance', raw(this.performanceData).map(p => ({ ...p, events: typeof p.events === 'string' ? p.events : JSON.stringify(p.events || []) }))],
            ['PM_Schedule', raw(this.pmList)],
            ['Requisitions', raw(this.requisitions)],
        ]);

        for (const [name, data] of sheets) {
            const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
            XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
        }

        // Summary sheet
        const logs = /** @type {any[]} */ (raw(this.logs));
        const totalCost = logs.reduce((s, l) => s + (Number(l.Cost) || 0), 0);
        const totalDowntime = logs.reduce((s, l) => s + (Number(l.Downtime) || 0), 0);
        const summary = [
            ['MTC-Asset Export', new Date().toISOString()],
            [],
            ['Total Equipment', raw(this.equipment).length],
            ['Total SpareParts', raw(this.allParts).length],
            ['Total Logs/WO', logs.length],
            ['Total Performance', raw(this.performanceData).length],
            ['Total PM Schedule', raw(this.pmList).length],
            ['Total Requisitions', raw(this.requisitions).length],
            [],
            ['Total Maintenance Cost', totalCost],
            ['Total Downtime (hrs)', totalDowntime],
        ];
        const wsSum = XLSX.utils.aoa_to_sheet(summary);
        XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');

        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'MTC_Asset_Full_' + new Date().toISOString().split('T')[0] + '.xlsx';
        a.click();
        this.showNotification?.('Excel lengkap diekspor');
    },

/**
 * Unduh file template CSV untuk tipe data tertentu.
 *
 * @param {('equip'|'parts'|'logs'|'perf')} type - Jenis template.
 * @returns {Promise<void>} Memicu unduhan `.csv`.
 */
    async downloadTemplate(type) {
        const XLSX = await loadXLSX();
        let data = /** @type {any[]} */ ([]), file = "";
        if (type === 'equip') { 
            data = [{ 
                EquipmentID: "EQ-001", Nama: "Crusher 01", Tipe: "Crusher", Status: "Active", 
                Lokasi: "Zone A", SerialNumber: "SN123", Criticality: "High", 
                NextPMDate: "2024-12-01", TglInstalasi: "2023-01-01", Vendor: "Metso", FotoURL: "" 
            }]; 
            file = "Template_Equipment"; 
        } else if (type === 'parts') {
            data = [{ 
                PartID: "P-001", NamaPart: "Bearing 22222", NamaSingkat: "BRG-22", 
                PartNumber: "SKF-22222", EquipmentIDs: "EQ-001, EQ-002", EquipmentID: "EQ-001", 
                Stok: 10, MinStock: 2, Lokasi: "Warehouse 1", Vendor: "SKF", Harga: 500000, FotoURL: "" 
            }];
            file = "Template_SpareParts";
        } else if (type === 'logs') {
            data = [{ 
                LogID: "LOG-001", EquipmentID: "EQ-001", Tanggal: "2024-01-01", Jenis: "PM", 
                Deskripsi: "Monthly Maintenance", Technician: "John Doe", Downtime: 2, 
                Cost: 0, Status: "Completed", HM: "12500", Catatan: "All clear", rca: "PM",
                PartsUsed: "[]", PhotoURLs: "[]"
            }];
            file = "Template_HistoryLogs";
        } else if (type === 'perf') {
            data = [{ 
                id: "PERF-001", date: "2024-01-01", equipmentId: "EQ-001", area: "Zone A", 
                wh: 20, bd: 2, stb: 2, freq: 1, type: "Unscheduled", 
                paPlan: 90, category: "Mechanical", rca: "None", remarks: "", events: "[]" 
            }];
            file = "Template_Performance";
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${file}.csv`; a.click();
    },

/**
 * Ekspor data satu tipe ke format Excel atau CSV.
 *
 * @param {('perf'|'equip'|'parts'|'logs')} type - Jenis data.
 * @param {('excel'|'csv')} format - Format keluaran.
 * @returns {Promise<void>} Memicu unduhan file.
 */
    async exportData(type, format) {
        const XLSX = await loadXLSX();
        let data = /** @type {any[]} */ ([]), file = "";
        
        // Deep clone to avoid Alpine proxy issues with XLSX
        const logsRaw = /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(this.logs || []) : this.logs || []);
        const equipRaw = /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(this.equipment || []) : this.equipment || []);
        const partsRaw = /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(this.allParts || []) : this.allParts || []);
        const perfRaw = /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(this.performanceData || []) : this.performanceData || []);
        
        if (type === 'perf') {
            data = perfRaw.map(p => ({
                ...p,
                events: typeof p.events === 'string' ? p.events : JSON.stringify(p.events || [])
            }));
            file = "Performance_Export";
        } else if (type === 'equip') {
            data = equipRaw;
            file = "Equipment_Export";
        } else if (type === 'parts') {
            data = partsRaw.map(p => ({
                ...p,
                EquipmentIDs: Array.isArray(p.EquipmentIDs) ? p.EquipmentIDs.join(', ') : p.EquipmentIDs
            }));
            file = "SpareParts_Export";
        } else if (type === 'logs') {
            data = logsRaw.map(l => ({
                ...l,
                PartsUsed: typeof l.PartsUsed === 'string' ? l.PartsUsed : JSON.stringify(l.PartsUsed || []),
                PhotoURLs: typeof l.PhotoURLs === 'string' ? l.PhotoURLs : JSON.stringify(l.PhotoURLs || [])
            }));
            file = "HistoryLogs_Export";
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${file}_${Date.now()}.csv`; a.click();
    },

/**
 * Ekspor tabel KPI performance ke PDF (memerlukan `#perfTable`).
 *
 * @returns {Promise<void>} Memicu unduhan PDF dan notifikasi.
 */
    async exportKPIToPDF() {
        if (!this.performanceData || this.performanceData.length === 0) {
            this.showNotification("No performance data to export", "error");
            return;
        }

        try {
            this.showNotification("Generating PDF... Please wait.", "info");
            await exportTableToPDF('perfTable', 'Performance KPI Report');
            this.showNotification('PDF exported successfully');
        } catch (e) {
            console.error('PDF Export Error:', e);
            this.showNotification("Failed to export PDF: " + (/** @type {any} */ (e).message || 'Unknown error'), "error");
        }
    },

/**
 * Ekspor satu Work Order (berdasarkan `logId`) menjadi PDF profesional.
 *
 * @param {string} logId - Id work order (`LogID`).
 * @returns {Promise<void>} Memicu unduhan PDF dan notifikasi.
 */
    async exportWOToPDF(logId) {
        if (!logId) {
            this.showNotification("No work order selected", "error");
            return;
        }

        try {
            // Deep clone data to avoid Alpine proxy issues with jsPDF
            const logsRaw = /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(this.logs || []) : this.logs || []);
            const equipRaw = /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(this.equipment || []) : this.equipment || []);
            const partsRaw = /** @type {any[]} */ (window.Alpine?.raw ? window.Alpine.raw(this.allParts || []) : this.allParts || []);
            
            const log = logsRaw?.find((/** @type {any} */ l) => l.LogID === logId);
            if (!log) {
                this.showNotification("Work order not found", "error");
                return;
            }

            const equipment = equipRaw?.find((/** @type {any} */ e) => e.EquipmentID === log.EquipmentID);
            const parts = partsRaw;

            await generateProfessionalWOPDF(log, equipment, parts);
            this.showNotification('Work Order PDF exported');
        } catch (e) {
            console.error('WO PDF Export Error:', e);
            this.showNotification("Failed to export WO PDF: " + (/** @type {any} */ (e).message || 'Unknown error'), "error");
        }
    },

/**
 * Ekspor jadwal PM ke PDF (landscape, dikelompokkan per status/tanggal).
 *
 * @returns {Promise<void>} Memicu unduhan PDF; men-set `this.isLoading`.
 */
    async exportPMSchedulePDF() {
        this.isLoading = true;
        try {
            const jsPDF = await loadJsPDF();
            const list = /** @type {any[]} */ (JSON.parse(JSON.stringify(this.pmList || [])));
            if (!list.length) {
                this.showNotification('No PM tasks to export', 'warning');
                return;
            }

            // Sort: overdue first, then by date
            const today = new Date().toISOString().split('T')[0];
            list.sort((/** @type {any} */ a, /** @type {any} */ b) => {
                const aO = a.status === 'pending' && a.date < today ? 1 : 0;
                const bO = b.status === 'pending' && b.date < today ? 1 : 0;
                if (aO !== bO) return bO - aO;
                return (a.date || '').localeCompare(b.date || '');
            });

            const doc = new jsPDF('l', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();

            // Header
            doc.setFillColor(6, 182, 212);
            doc.rect(0, 0, pageW, 30, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('PM SCHEDULE REPORT', 20, 18);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 25);

            // Stats summary
            const total = list.length;
            const pending = list.filter(p => p.status === 'pending').length;
            const completed = list.filter(p => p.status === 'completed').length;
            const overdue = list.filter(p => p.status === 'pending' && p.date < today).length;
            doc.setTextColor(107, 114, 128);
            doc.setFontSize(9);
            doc.text(`Total: ${total}  |  Pending: ${pending}  |  Completed: ${completed}  |  Overdue: ${overdue}`, pageW - 20, 25, { align: 'right' });

            // Table header
            const col = [
                { label: '#', x: 20, w: 12 },
                { label: 'Task', x: 32, w: 50 },
                { label: 'Equipment', x: 82, w: 40 },
                { label: 'Date', x: 122, w: 28 },
                { label: 'Status', x: 150, w: 22 },
                { label: 'Priority', x: 172, w: 20 },
                { label: 'Repeat', x: 192, w: 22 },
                { label: 'Equipment ID', x: 214, w: 30 },
            ];
            let y = 38;
            doc.setFillColor(55, 65, 81);
            doc.rect(18, y - 4, pageW - 36, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            col.forEach(c => doc.text(c.label, c.x, y, { align: c.label === '#' ? 'center' : 'left' }));

            // Rows
            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            list.forEach((/** @type {any} */ pm, /** @type {number} */ i) => {
                // Page break
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                    // Repeat header
                    doc.setFillColor(55, 65, 81);
                    doc.rect(18, y - 4, pageW - 36, 8, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    col.forEach(c => doc.text(c.label, c.x, y, { align: c.label === '#' ? 'center' : 'left' }));
                    y += 6;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6);
                }

                // Zebra
                if (i % 2 === 0) {
                    doc.setFillColor(249, 250, 251);
                    doc.rect(18, y - 3, pageW - 36, 5.5, 'F');
                }

                const equipName = this.equipment?.find(e => e.EquipmentID === pm.equipmentId)?.Nama || pm.equipmentId || '-';
                const status = pm.status === 'pending' && pm.date < today ? 'Overdue' : (pm.status || 'pending');
                const statusColor = status === 'Overdue' ? [220, 38, 38] : status === 'completed' ? [22, 163, 74] : status === 'pending' ? [6, 182, 212] : [107, 114, 128];
                doc.setTextColor(...statusColor);
                doc.setFont('helvetica', 'bold');

                doc.text((i + 1).toString(), 20, y, { align: 'center' });
                doc.text(pm.taskName || '-', 32, y);
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                doc.text(equipName, 82, y);
                doc.setTextColor(107, 114, 128);
                doc.text(pm.date || '-', 122, y);
                doc.setTextColor(...statusColor);
                doc.text(status.charAt(0).toUpperCase() + status.slice(1), 150, y);
                doc.setTextColor(0, 0, 0);
                doc.text(pm.priority || 'Medium', 172, y);
                doc.setTextColor(107, 114, 128);
                doc.text(pm.frequency === 'none' ? '—' : (pm.frequency || '—'), 192, y);
                doc.text(pm.equipmentId || '', 214, y);

                // Reset
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                y += 6;
            });

            // Footer
            doc.setFontSize(7);
            doc.setTextColor(156, 163, 175);
            doc.text(`MTC-ASSET · PM Schedule · Page ${doc.internal.getNumberOfPages()}`, 20, y + 6);

            doc.save(`PM_Schedule_${new Date().toISOString().split('T')[0]}.pdf`);
            this.showNotification('PM Schedule PDF exported');
        } catch (e) {
            console.error('PM Schedule PDF Export Error:', e);
            this.showNotification('Failed to export PDF: ' + (/** @type {any} */ (e).message || 'Unknown error'), 'error');
        } finally {
            this.isLoading = false;
        }
    },

/**
 * Ekspor laporan lengkap satu asset (info, health/MTBF, log, PM, parts) ke PDF.
 *
 * @param {any} equip - Data equipment (harus punya `EquipmentID`).
 * @returns {Promise<void>} Memicu unduhan PDF; men-set `this.isLoading`.
 */
    async exportToPDF(equip) {
        if (!equip || !equip.EquipmentID) {
            this.showNotification("No equipment selected", "error");
            return;
        }
        this.isLoading = true;
        try {
            const jsPDF = await loadJsPDF();
            await import('jspdf-autotable');
            
            const equipData = /** @type {any} */ (JSON.parse(JSON.stringify(equip)));
            const logsData = /** @type {any[]} */ (JSON.parse(JSON.stringify(this.logs || [])));
            const pmData = /** @type {any[]} */ (JSON.parse(JSON.stringify(this.pmList || [])));
            const partsData = /** @type {any[]} */ (JSON.parse(JSON.stringify(this.allParts || [])));
            
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            
            // Helper
            const line = (/** @type {number} */ y) => { doc.setDrawColor(0, 242, 255); doc.setLineWidth(0.3); doc.line(20, y, pageW - 20, y); };
            const section = (/** @type {string} */ title, /** @type {number} */ y) => { doc.setFontSize(13); doc.setTextColor(0, 242, 255); doc.text(title, 20, y); return y + 7; };
            
            // --- HEADER ---
            doc.setFontSize(22); doc.setTextColor(255, 255, 255);
            doc.text(`MTC-ASSET REPORT`, pageW / 2, 18, { align: 'center' });
            doc.setFontSize(8); doc.setTextColor(140, 158, 183);
            doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 25, { align: 'center' });
            line(30);
            
            // --- EQUIPMENT INFO ---
            let y = section('EQUIPMENT INFO', 38);
            const fields = /** @type {any[][]} */ ([
                ['Name', equipData.Nama || '-'], ['ID', equipData.EquipmentID],
                ['Location', equipData.Lokasi || '-'], ['Status', equipData.Status || '-'],
                ['Type', equipData.Tipe || '-'], ['Serial', equipData.SerialNumber || '-'],
                ['Vendor', equipData.Vendor || '-'], ['Criticality', equipData.Criticality || '-'],
                ['Next PM', equipData.NextPMDate || '-'], ['Install Date', equipData.InstallDate || '-'],
            ]);
            doc.setFontSize(9); doc.setTextColor(200, 210, 220);
            let col = 0, xStart = 20;
            fields.forEach(([k, v], i) => {
                const x = xStart + col * 90;
                doc.setFont('helvetica', 'bold'); doc.text(k + ':', x, y);
                doc.setFont('helvetica', 'normal'); const w = doc.getTextWidth(k + ':  ' + v);
                if (x + w + 10 > xStart + 90) { doc.text(v.length > 25 ? v.substring(0, 25) + '…' : v, x, y + 4); }
                else { doc.text(v, x + doc.getTextWidth(k + ':  '), y); }
                col++;
                if (col > 1) { col = 0; y += 6; }
            });
            y += 4; line(y); y += 5;
            
            // --- HEALTH SCORE ---
            const hScore = this.calculateHealthScore ? this.calculateHealthScore(equipData.EquipmentID) : null;
            y = section('HEALTH & RELIABILITY', y);
            doc.setFontSize(9); doc.setTextColor(200, 210, 220);
            doc.setFont('helvetica', 'bold'); doc.text(`Health Score: `, 20, y);
            doc.setFont('helvetica', 'normal'); doc.text(`${hScore?.score || 'N/A'}% - ${hScore?.status || '-'}`, 20 + doc.getTextWidth('Health Score: '), y);
            doc.setFont('helvetica', 'bold');
            doc.text(`MTBF: `, 90, y);
            doc.setFont('helvetica', 'normal'); doc.text(`${this.calculateMTBF ? this.calculateMTBF(equipData.EquipmentID) : 'N/A'} hrs`, 90 + doc.getTextWidth('MTBF: '), y);
            doc.setFont('helvetica', 'bold');
            doc.text(`Failure Est: `, 150, y);
            doc.setFont('helvetica', 'normal'); doc.text(`${this.predictNextFailure ? this.predictNextFailure(equipData.EquipmentID) : 'N/A'}`, 150 + doc.getTextWidth('Failure Est: '), y);
            y += 8; line(y); y += 5;
            
            // --- LOG HISTORY ---
            const equipLogs = logsData.filter(l => l.EquipmentID === equipData.EquipmentID);
            y = section('MAINTENANCE LOGS', y);
            if (equipLogs.length > 0) {
                const logRows = equipLogs.slice(0, 50).map(l => [
                    l.Tanggal || '-', l.Jenis || '-',
                    (l.Deskripsi || '').substring(0, 40),
                    l.Status || '-', l.HM || '-'
                ]);
                doc.autoTable({
                    startY: y, margin: { left: 20 },
                    headStyles: { fillColor: [0, 242, 255], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
                    alternateRowStyles: { fillColor: [240, 245, 250] },
                    head: [['Date', 'Type', 'Description', 'Status', 'HM']],
                    body: logRows,
                });
                y = doc.lastAutoTable.finalY + 6;
            } else {
                doc.setFontSize(9); doc.setTextColor(140, 158, 183);
                doc.text('No maintenance logs recorded', 20, y); y += 7;
            }
            line(y); y += 5;
            
            // --- PM SCHEDULE ---
            const equipPM = pmData.filter(p => p.equipmentId === equipData.EquipmentID);
            y = section('PM SCHEDULE', y);
            if (equipPM.length > 0) {
                const pmRows = equipPM.map(p => [p.date || '-', (p.taskName || '').substring(0, 35), p.status || '-']);
                doc.autoTable({
                    startY: y, margin: { left: 20 },
                    headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
                    alternateRowStyles: { fillColor: [240, 245, 250] },
                    head: [['Date', 'Task', 'Status']],
                    body: pmRows,
                });
                y = doc.lastAutoTable.finalY + 6;
            } else {
                doc.setFontSize(9); doc.setTextColor(140, 158, 183);
                doc.text('No PM schedule for this equipment', 20, y); y += 7;
            }
            line(y); y += 5;
            
            // --- PARTS ---
            const equipParts = partsData.filter((/** @type {any} */ p) => 
                (p.EquipmentIDs && p.EquipmentIDs.includes(equipData.EquipmentID)) || 
                p.EquipmentID === equipData.EquipmentID
            );
            y = section('LINKED PARTS', y);
            if (equipParts.length > 0) {
                const partRows = equipParts.map(p => [
                    p.PartID || '-', (p.NamaPart || '').substring(0, 25),
                    String(p.Stok || 0), String(p.MinStock || 0),
                    Number(p.Stok) <= Number(p.MinStock) ? '⚠️ LOW' : 'OK'
                ]);
                doc.autoTable({
                    startY: y, margin: { left: 20 },
                    headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
                    alternateRowStyles: { fillColor: [240, 245, 250] },
                    head: [['Part ID', 'Name', 'Stock', 'Min', 'Status']],
                    body: partRows,
                });
                y = doc.lastAutoTable.finalY;
            } else {
                doc.setFontSize(9); doc.setTextColor(140, 158, 183);
                doc.text('No parts linked to this equipment', 20, y); y += 7;
            }
            
            // Footer
            doc.setFontSize(7); doc.setTextColor(180, 190, 200);
            doc.text(`MTC-ASSET v1.2 | Page 1`, pageW / 2, 290, { align: 'center' });
            
            doc.save(`Asset_${equipData.EquipmentID}.pdf`);
            this.showNotification('✅ Asset report exported');
        } catch (e) { 
            console.error('Asset PDF Export Error:', e);
            this.showNotification("Failed to export PDF: " + (/** @type {any} */ (e).message || 'Unknown error'), "error");
        } finally { 
            this.isLoading = false; 
        }
    },

/**
 * Impor data dari file CSV/Excel yang dipilih user, lalu tulis ke RTDB per node.
 *
 * @param {Event} event - Event `change` dari `<input type="file">`.
 * @param {('perf'|'equip'|'parts'|'logs')} type - Jenis data yang diimpor.
 * @returns {Promise<void>} Memperbarui `this.importProgress` dan notifikasi.
 */
    async importCSV(event, type) {
        const XLSX = await loadXLSX();
        const file = /** @type {any} */ (event.target).files[0];
        if (!file) return;
        this.isLoading = true;
        const reader = new FileReader();
        reader.onload = async (/** @type {any} */ e) => {
            try {
                const bstr = /** @type {any} */ (e.target).result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = /** @type {any[]} */ (XLSX.utils.sheet_to_json(ws));

                this.importProgress = 0;
                let count = 0;
                const total = data.length;

                for (let i = 0; i < total; i++) {
                    const row = data[i];
                    const id = row.EquipmentID || row.PartID || row.LogID || row.id || row.ID || (type.toUpperCase() + "-" + Date.now());
                    
                    let dataToSave = /** @type {Record<string, any>} */ ({});
                    if (type === 'perf') {
                        dataToSave = {
                            id: String(id),
                            date: row.date || row.Date || new Date().toISOString().split('T')[0],
                            equipmentId: row.equipmentId || row.AssetID || '',
                            area: row.area || row.Area || '',
                            wh: parseFloat(row.wh || 0),
                            bd: parseFloat(row.bd || 0),
                            stb: parseFloat(row.stb || 0),
                            paPlan: parseFloat(row.paPlan || 90),
                            rca: row.rca || 'None',
                            type: row.type || 'Unscheduled',
                            category: row.category || 'Mechanical',
                            freq: row.freq !== undefined ? parseInt(row.freq) : (parseFloat(row.bd) > 0 ? 1 : 0),
                            remarks: row.remarks || '',
                            events: row.events ? (typeof row.events === 'string' ? (tryParseJSON(row.events) || []) : row.events) : []
                        };
                    } else if (type === 'equip') {
                        dataToSave = {
                            EquipmentID: String(id), Nama: row.Nama || '', Tipe: row.Tipe || 'Other',
                            Lokasi: row.Lokasi || '', Status: row.Status || 'Active', SerialNumber: row.SerialNumber || '',
                            Criticality: row.Criticality || 'Medium', NextPMDate: row.NextPMDate || '',
                            TglInstalasi: row.TglInstalasi || '', Vendor: row.Vendor || '', FotoURL: row.FotoURL || ''
                        };
                    } else if (type === 'parts') {
                        // Multi-link support in CSV: EquipmentIDs can be comma separated string
                        let equipIds = /** @type {string[]} */ ([]);
                        if (row.EquipmentIDs) {
                            equipIds = typeof row.EquipmentIDs === 'string' ? row.EquipmentIDs.split(',').map((/** @type {string} */ s) => s.trim()) : [row.EquipmentIDs];
                        } else if (row.EquipmentID) {
                            equipIds = [row.EquipmentID];
                        }

                        dataToSave = {
                            PartID: String(id), NamaPart: row.NamaPart || '', NamaSingkat: row.NamaSingkat || '',
                            PartNumber: row.PartNumber || '', EquipmentIDs: equipIds,
                            EquipmentID: equipIds.length > 0 ? equipIds[0] : (row.EquipmentID || ''), 
                            Stok: parseFloat(row.Stok || 0), MinStock: parseFloat(row.MinStock || 0),
                            Lokasi: row.Lokasi || '', Vendor: row.Vendor || '', Harga: parseFloat(row.Harga || 0), FotoURL: row.FotoURL || ''
                        };
                    } else if (type === 'logs') {
                        dataToSave = {
                            LogID: String(id), EquipmentID: row.EquipmentID || '', Tanggal: row.Tanggal || '',
                            Jenis: row.Jenis || 'PM', Deskripsi: row.Deskripsi || '', Technician: row.Technician || '',
                            PartsUsed: row.PartsUsed ? (typeof row.PartsUsed === 'string' ? tryParseJSON(row.PartsUsed, []) : row.PartsUsed) : [],
                            Downtime: parseFloat(row.Downtime || 0), Cost: parseFloat(row.Cost || 0),
                            Status: row.Status || 'Completed', HM: row.HM || '', Catatan: row.Catatan || '',
                            PhotoURLs: row.PhotoURLs ? (typeof row.PhotoURLs === 'string' ? tryParseJSON(row.PhotoURLs, []) : row.PhotoURLs) : [],
                            rca: row.rca || 'PM'
                        };
                    }
                    
                    const node = type === 'perf' ? 'Performance' : type === 'equip' ? 'Equipment' : type === 'parts' ? 'SpareParts' : 'HistoryLog';
                    await window.set(window.ref(window.db, `${node}/${id}`), dataToSave);
                    count++;
                    this.importProgress = Math.round(((i + 1) / total) * 100);
                }
                this.showNotification(`Successfully processed ${count} records`);
                setTimeout(() => { this.importProgress = 0; }, 2000);
            } catch (err) {
                console.error('Import Error:', err);
                this.showNotification("Import failed: " + /** @type {any} */ (err).message, "error");
            } finally {
                this.isLoading = false;
                /** @type {any} */ (event.target).value = "";
                // Reset progress after a short delay if it's stuck
                if ((this.importProgress || 0) >= 100) {
                    setTimeout(() => { this.importProgress = 0; }, 2000);
                } else {
                    this.importProgress = 0;
                }
            }
        };
        reader.readAsBinaryString(file);
    }
});
