/**
 * Export & Import module
 */
import { generateProfessionalWOPDF } from './wo-pdf-template.js';

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

async function loadXLSX() {
    return await import('xlsx');
}

let jsPDFInstance = null;

async function loadJsPDF() {
    if (jsPDFInstance) return jsPDFInstance;
    const { jsPDF } = await import('jspdf');
    jsPDFInstance = jsPDF;
    return jsPDF;
}

async function exportTableToPDF(elementId, title) {
    try {
        const { jsPDF } = await import('jspdf');
        const element = document.getElementById(elementId);
        if (!element) throw new Error('Table element not found');

        // Get table data manually
        const rows = [];
        const headers = [];
        const thead = element.querySelector('thead');
        if (thead) {
            thead.querySelectorAll('th').forEach(th => headers.push(th.textContent.trim()));
        }
        const tbody = element.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const row = [];
                tr.querySelectorAll('td').forEach(td => row.push(td.textContent.trim()));
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
        headers.forEach((h, i) => pdf.text(h.substring(0, 12), 15 + i * cellWidth, yPos + 6));

        // Draw rows
        yPos += cellHeight;
        pdf.setTextColor(0, 0, 0);
        rows.slice(0, 15).forEach((row, rowIndex) => {
            if (rowIndex % 2 === 0) {
                pdf.setFillColor(240, 240, 240);
                pdf.rect(14, yPos, 270, cellHeight, 'F');
            }
            row.forEach((cell, i) => {
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

async function loadJsPDFAutotable() {
    // Now handled in loadJsPDF() - just return true for compatibility
    return true;
}

// ========================================
// WORK ORDER PDF EXPORT
// ========================================

async function generateWOPDF(log, equipment, parts) {
    const jsPDF = await loadJsPDF();

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const primaryColor = [15, 23, 42];
    const secondaryColor = [71, 85, 105];
    const accentColor = [234, 88, 12];
    const darkColor = [15, 23, 42];
    const grayColor = [100, 116, 139];
    const lightGray = [241, 245, 249];
    const white = [255, 255, 255];
    const greenColor = [22, 163, 74];
    const redColor = [220, 38, 38];
    const blueColor = [37, 99, 235];
    
    const priorityColors = {
        'Emergency': [220, 38, 38],
        'Urgent': [234, 88, 12],
        'Normal': [202, 138, 4],
        'Planned': [22, 163, 74]
    };
    const priority = log.woPriority || 'Normal';
    const priorityColor = priorityColors[priority] || [202, 138, 4];
    const isExternal = log.equipmentId === 'EXTERNAL';
    
    let yPos = 20;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Header Background
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Logo/Brand
    doc.setTextColor(...white);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('WORK ORDER', margin, yPos + 5);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('MTC Maintenance Technical Center', margin, yPos + 12);
    
    // WO Number - Right side
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(log.woNumber || '-', pageWidth - margin, yPos + 5, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Nomor WO', pageWidth - margin, yPos + 11, { align: 'right' });
    
    // Company info
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('PT. Citra Palu Minerals', pageWidth - margin, yPos + 17, { align: 'right' });
    
    yPos = 52;
    
    // Priority & Status badges - lebih lebar spacing
    doc.setFillColor(...priorityColor);
    doc.roundedRect(margin, yPos, 30, 10, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(priority.toUpperCase(), margin + 15, yPos + 6.5, { align: 'center' });
    
    const statusColors = {
        'Pending': [234, 179, 8],
        'In Progress': [37, 99, 235],
        'Completed': [22, 163, 74],
        'Cancelled': [107, 114, 128],
        'Approved': [6, 182, 212],
        'Draft': [126, 34, 196]
    };
    const status = log.Status || 'Pending';
    const statusColor = statusColors[status] || [107, 114, 128];
    doc.setFillColor(...statusColor);
    doc.roundedRect(margin + 35, yPos, 35, 10, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(status.toUpperCase(), margin + 52.5, yPos + 6.5, { align: 'center' });
    
    if (isExternal) {
        doc.setFillColor(...accentColor);
        doc.roundedRect(margin + 75, yPos, 32, 10, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('EXTERNAL', margin + 91, yPos + 6.5, { align: 'center' });
    }
    
    yPos = 70;
    
    // Section 1: Asset Information
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSET INFORMATION', margin + 3, yPos + 7);
    
    yPos += 15;
    doc.setTextColor(...grayColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    if (isExternal) {
        doc.text('Asset Name', margin, yPos);
        doc.setTextColor(...darkColor);
        doc.setFont('helvetica', 'bold');
        doc.text(log.externalEquipName || 'External Asset', margin + 35, yPos);
        
        doc.setTextColor(...grayColor);
        doc.setFont('helvetica', 'normal');
        doc.text('Request Source', margin + 100, yPos);
        doc.setTextColor(...accentColor);
        doc.setFont('helvetica', 'bold');
        doc.text('EXTERNAL', pageWidth - margin, yPos, { align: 'right' });
    } else {
        doc.text('Equipment', margin, yPos);
        doc.setTextColor(...darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text((equipment?.Nama || '-') + ' (' + (equipment?.EquipmentID || '-') + ')', margin + 35, yPos);
        doc.setFontSize(9);
        
        yPos += 8;
        doc.setTextColor(...grayColor);
        doc.setFont('helvetica', 'normal');
        doc.text('Location', margin, yPos);
        doc.setTextColor(...darkColor);
        doc.setFont('helvetica', 'bold');
        doc.text(equipment?.Lokasi || '-', margin + 35, yPos);
        
        doc.setTextColor(...grayColor);
        doc.setFont('helvetica', 'normal');
        doc.text('Status', margin + 100, yPos);
        doc.setTextColor(...greenColor);
        doc.setFont('helvetica', 'bold');
        doc.text(equipment?.Status || '-', pageWidth - margin, yPos, { align: 'right' });
    }
    
    yPos += 15;
    
    // Section 2: Work Details
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('WORK DETAILS', margin + 3, yPos + 7);
    
    yPos += 15;
    doc.setTextColor(...grayColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Work Type', margin, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.Jenis || 'PM', margin + 35, yPos);
    
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Date', margin + 100, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.Tanggal || '-', pageWidth - margin, yPos, { align: 'right' });
    
    yPos += 8;
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Technician', margin, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.Technician || '-', margin + 35, yPos);
    
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Assigned To', margin + 100, yPos);
    doc.setTextColor(...blueColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.assignedTo || '-', pageWidth - margin, yPos, { align: 'right' });
    
    yPos += 8;
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Category', margin, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.rca || 'PM', margin + 35, yPos);
    
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('HM', margin + 100, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.HM || '-', pageWidth - margin, yPos, { align: 'right' });
    
    yPos += 8;
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Est. Hours', margin, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(String(log.estimatedHours || 0), margin + 35, yPos);
    
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Actual Hours', margin + 100, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(String(log.actualHours || 0), pageWidth - margin, yPos, { align: 'right' });
    
    if (log.dueDate) {
        yPos += 8;
        doc.setTextColor(...grayColor);
        doc.setFont('helvetica', 'normal');
        doc.text('Due Date', margin, yPos);
        doc.setTextColor(...accentColor);
        doc.setFont('helvetica', 'bold');
        doc.text(log.dueDate, margin + 35, yPos);
    }
    
    yPos += 15;
    
    // Section 3: Request Information
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUEST INFORMATION', margin + 3, yPos + 7);
    
    yPos += 15;
    doc.setTextColor(...grayColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Department', margin, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.requestSource || '-', margin + 35, yPos);
    
    yPos += 8;
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text('Requested By', margin, yPos);
    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.text(log.requestedBy || '-', margin + 35, yPos);
    
    if (log.requestDate) {
        doc.setTextColor(...grayColor);
        doc.setFont('helvetica', 'normal');
        doc.text('Request Date', margin + 100, yPos);
        doc.setTextColor(...darkColor);
        doc.setFont('helvetica', 'bold');
        doc.text(log.requestDate, pageWidth - margin, yPos, { align: 'right' });
    }
    
    if (log.approvedBy) {
        yPos += 8;
        doc.setTextColor(...grayColor);
        doc.setFont('helvetica', 'normal');
        doc.text('Approved By', margin, yPos);
        doc.setTextColor(...greenColor);
        doc.setFont('helvetica', 'bold');
        doc.text(log.approvedBy, margin + 35, yPos);
        
        if (log.approvalDate) {
            doc.setTextColor(...grayColor);
            doc.setFont('helvetica', 'normal');
            doc.text('Approval Date', margin + 100, yPos);
            doc.setTextColor(...darkColor);
            doc.setFont('helvetica', 'bold');
            doc.text(log.approvalDate, pageWidth - margin, yPos, { align: 'right' });
        }
    }
    
    yPos += 15;
    
    // Section 4: Work Description
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('WORK DESCRIPTION', margin + 3, yPos + 7);
    
    yPos += 15;
    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(log.Deskripsi || '-', contentWidth);
    doc.text(descLines, margin, yPos);
    yPos += descLines.length * 6 + 5;
    
    if (log.Catatan) {
        doc.setFillColor(...lightGray);
        doc.rect(margin, yPos, contentWidth, 10, 'F');
        doc.setTextColor(...darkColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('NOTES', margin + 3, yPos + 7);
        
        yPos += 15;
        doc.setTextColor(...grayColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        const notesLines = doc.splitTextToSize(log.Catatan, contentWidth);
        doc.text(notesLines, margin, yPos);
        yPos += notesLines.length * 6 + 5;
    }
    
    const partsList = tryParseJSON(log.PartsUsed, []);
    if (partsList && partsList.length > 0) {
        if (yPos > pageHeight - 80) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFillColor(...primaryColor);
        doc.rect(margin, yPos, contentWidth, 10, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('MATERIALS / PARTS USED', margin + 3, yPos + 7);
        
        yPos += 15;
        
        const tableData = partsList.map((p, i) => {
            const part = parts?.find(x => x.PartID === p.id);
            return [
                i + 1,
                part?.PartID || p.id || '-',
                part?.NamaPart || part?.NamaSingkat || '-',
                p.qty || 0,
                'Rp ' + String((part?.Harga || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
                'Rp ' + String((p.qty || 0) * (part?.Harga || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            ];
        });
        
        doc.autoTable({
            startY: yPos,
            head: [['No', 'Part Number', 'Description', 'Qty', 'Unit Price', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                3: { cellWidth: 15, halign: 'center' },
                4: { cellWidth: 30, halign: 'right' },
                5: { cellWidth: 35, halign: 'right' }
            },
            margin: { left: margin, right: margin }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
    }
    
    if (log.Downtime || log.Cost) {
        if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFillColor(...lightGray);
        doc.rect(margin, yPos, contentWidth, 10, 'F');
        doc.setTextColor(...darkColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('COST SUMMARY', margin + 3, yPos + 7);
        
        yPos += 15;
        doc.setTextColor(...grayColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        if (log.Downtime) {
            doc.text('Downtime (Hours)', margin, yPos);
            doc.setTextColor(...redColor);
            doc.setFont('helvetica', 'bold');
            doc.text(String(log.Downtime), margin + 35, yPos);
        }
        
        if (log.Cost) {
            doc.setTextColor(...grayColor);
            doc.setFont('helvetica', 'normal');
            doc.text('Total Cost', margin + 100, yPos);
            doc.setTextColor(...darkColor);
            doc.setFont('helvetica', 'bold');
            doc.text('Rp ' + String(log.Cost).replace(/\B(?=(\d{3})+(?!\d))/g, ','), pageWidth - margin, yPos, { align: 'right' });
        }
    }
    
    // Footer
    yPos = pageHeight - 20;
    
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    
    yPos += 8;
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated: ' + new Date().toLocaleDateString('id-ID', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    }), margin, yPos);
    
    doc.text('MTC Maintenance System', pageWidth - margin, yPos, { align: 'right' });
    
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
}

export const exportModule = {
    async downloadTemplate(type) {
        const XLSX = await loadXLSX();
        let data = [], file = "";
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

    async exportData(type, format) {
        const XLSX = await loadXLSX();
        let data = [], file = "";
        
        // Deep clone to avoid Alpine proxy issues with XLSX
        const logsRaw = window.Alpine?.raw ? window.Alpine.raw(this.logs || []) : this.logs || [];
        const equipRaw = window.Alpine?.raw ? window.Alpine.raw(this.equipment || []) : this.equipment || [];
        const partsRaw = window.Alpine?.raw ? window.Alpine.raw(this.allParts || []) : this.allParts || [];
        const perfRaw = window.Alpine?.raw ? window.Alpine.raw(this.performanceData || []) : this.performanceData || [];
        
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
            this.showNotification("Failed to export PDF: " + (e.message || 'Unknown error'), "error");
        }
    },

    async exportWOToPDF(logId) {
        if (!logId) {
            this.showNotification("No work order selected", "error");
            return;
        }

        try {
            // Deep clone data to avoid Alpine proxy issues with jsPDF
            const logsRaw = window.Alpine?.raw ? window.Alpine.raw(this.logs || []) : this.logs || [];
            const equipRaw = window.Alpine?.raw ? window.Alpine.raw(this.equipment || []) : this.equipment || [];
            const partsRaw = window.Alpine?.raw ? window.Alpine.raw(this.allParts || []) : this.allParts || [];
            
            const log = logsRaw?.find(l => l.LogID === logId);
            if (!log) {
                this.showNotification("Work order not found", "error");
                return;
            }

            const equipment = equipRaw?.find(e => e.EquipmentID === log.EquipmentID);
            const parts = partsRaw;

            await generateProfessionalWOPDF(log, equipment, parts);
            this.showNotification('Work Order PDF exported');
        } catch (e) {
            console.error('WO PDF Export Error:', e);
            this.showNotification("Failed to export WO PDF: " + (e.message || 'Unknown error'), "error");
        }
    },

    async exportPMSchedulePDF() {
        this.isLoading = true;
        try {
            const jsPDF = await loadJsPDF();
            const list = structuredClone(this.pmList || []);
            if (!list.length) {
                this.showNotification('No PM tasks to export', 'warning');
                return;
            }

            // Sort: overdue first, then by date
            const today = new Date().toISOString().split('T')[0];
            list.sort((a, b) => {
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
            list.forEach((pm, i) => {
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
            this.showNotification('Failed to export PDF: ' + (e.message || 'Unknown error'), 'error');
        } finally {
            this.isLoading = false;
        }
    },

    async exportToPDF(equip) {
        if (!equip || !equip.EquipmentID) {
            this.showNotification("No equipment selected", "error");
            return;
        }
        this.isLoading = true;
        try {
            const jsPDF = await loadJsPDF();
            await import('jspdf-autotable');
            
            const equipData = structuredClone(equip);
            const logsData = structuredClone(this.logs || []);
            const pmData = structuredClone(this.pmList || []);
            const partsData = structuredClone(this.allParts || []);
            
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            
            // Helper
            const line = (y) => { doc.setDrawColor(0, 242, 255); doc.setLineWidth(0.3); doc.line(20, y, pageW - 20, y); };
            const section = (title, y) => { doc.setFontSize(13); doc.setTextColor(0, 242, 255); doc.text(title, 20, y); return y + 7; };
            
            // --- HEADER ---
            doc.setFontSize(22); doc.setTextColor(255, 255, 255);
            doc.text(`MTC-ASSET REPORT`, pageW / 2, 18, { align: 'center' });
            doc.setFontSize(8); doc.setTextColor(140, 158, 183);
            doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 25, { align: 'center' });
            line(30);
            
            // --- EQUIPMENT INFO ---
            let y = section('EQUIPMENT INFO', 38);
            const fields = [
                ['Name', equipData.Nama || '-'], ['ID', equipData.EquipmentID],
                ['Location', equipData.Lokasi || '-'], ['Status', equipData.Status || '-'],
                ['Type', equipData.Tipe || '-'], ['Serial', equipData.SerialNumber || '-'],
                ['Vendor', equipData.Vendor || '-'], ['Criticality', equipData.Criticality || '-'],
                ['Next PM', equipData.NextPMDate || '-'], ['Install Date', equipData.InstallDate || '-'],
            ];
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
            const equipParts = partsData.filter(p => 
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
            this.showNotification("Failed to export PDF: " + (e.message || 'Unknown error'), "error");
        } finally { 
            this.isLoading = false; 
        }
    },

    async importCSV(event, type) {
        const XLSX = await loadXLSX();
        const file = event.target.files[0];
        if (!file) return;
        this.isLoading = true;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const bstr = e.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);

                this.importProgress = 0;
                let count = 0;
                const total = data.length;

                for (let i = 0; i < total; i++) {
                    const row = data[i];
                    const id = row.EquipmentID || row.PartID || row.LogID || row.id || row.ID || (type.toUpperCase() + "-" + Date.now());
                    
                    let dataToSave = {};
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
                        let equipIds = [];
                        if (row.EquipmentIDs) {
                            equipIds = typeof row.EquipmentIDs === 'string' ? row.EquipmentIDs.split(',').map(s => s.trim()) : [row.EquipmentIDs];
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
                this.showNotification("Import failed: " + err.message, "error");
            } finally {
                this.isLoading = false;
                event.target.value = "";
                // Reset progress after a short delay if it's stuck
                if (this.importProgress >= 100) {
                    setTimeout(() => { this.importProgress = 0; }, 2000);
                } else {
                    this.importProgress = 0;
                }
            }
        };
        reader.readAsBinaryString(file);
    }
};
