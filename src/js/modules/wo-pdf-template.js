/**
 * Work Order PDF Template - Simple Professional
 */
function formatCurrency(num) {
    if (!num) return 'Rp 0';
    return 'Rp ' + String(num || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export async function generateProfessionalWOPDF(log, equipment, parts) {
    const { jsPDF } = await import('jspdf');
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    const colors = {
        primary: [30, 41, 59],
        secondary: [100, 116, 139],
        accent: [245, 158, 11],
        success: [16, 185, 129],
        warning: [234, 179, 8],
        danger: [220, 38, 38],
        info: [59, 130, 246],
        light: [248, 250, 252],
        white: [255, 255, 255]
    };

    const priority = log.woPriority || 'Normal';
    const status = log.Status || 'Pending';
    const isExternal = log.equipmentId === 'EXTERNAL';
    
    let parseParts = [];
    try {
        parseParts = typeof log.PartsUsed === 'string' ? JSON.parse(log.PartsUsed || '[]') : (log.PartsUsed || []);
    } catch(e) { parseParts = []; }

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PT. CITRA PALU MINERALS', margin, 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('MAINTENANCE TECHNICAL CENTER', margin, 21);

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11);
    doc.text('WORK ORDER', pageWidth - margin, 15, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Maintenance Request Form', pageWidth - margin, 21, { align: 'right' });

    doc.setFillColor(45, 55, 72);
    doc.rect(pageWidth - margin - 45, 25, 45, 10, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    doc.text(log.woNumber || 'WO-0000', pageWidth - margin - 22.5, 31, { align: 'center' });

    let yPos = 48;

    // Status badges
    const pColor = priority === 'Emergency' ? [220,38,38] : priority === 'Urgent' ? [234,179,8] : priority === 'Planned' ? [16,185,129] : [202,138,4];
    doc.setFillColor(...pColor);
    doc.rect(margin, yPos, 22, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(priority.toUpperCase(), margin + 11, yPos + 5.5, { align: 'center' });

    const sColor = status === 'Completed' ? [16,185,129] : status === 'In Progress' ? [59,130,246] : status === 'Pending' ? [234,179,8] : [107,114,128];
    doc.setFillColor(...sColor);
    doc.rect(margin + 25, yPos, 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(status.toUpperCase(), margin + 39, yPos + 5.5, { align: 'center' });

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Created: ' + (log.Tanggal || '-'), pageWidth - margin, yPos + 2, { align: 'right' });
    if (log.dueDate) {
        doc.setTextColor(245, 158, 11);
        doc.text('Due: ' + log.dueDate, pageWidth - margin, yPos + 7, { align: 'right' });
    }

    yPos = 60;

    // Equipment
    doc.setFillColor(...colors.primary);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(...colors.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('EQUIPMENT / ASSET', margin + 3, yPos + 5.5);

    yPos += 10;
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPos, contentWidth, 25, 'F');

    if (isExternal) {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Asset:', margin + 3, yPos + 6);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(log.externalEquipName || '-', margin + 25, yPos + 6);
        
        doc.setTextColor(100, 116, 139);
        doc.text('Source:', margin + 3, yPos + 14);
        doc.setTextColor(139, 92, 246);
        doc.setFont('helvetica', 'bold');
        doc.text(log.requestSource || '-', margin + 25, yPos + 14);
    } else {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Equipment:', margin + 3, yPos + 6);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text((equipment?.EquipmentID || '-') + ' - ' + (equipment?.Nama || '-'), margin + 25, yPos + 6);

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Location:', margin + 3, yPos + 14);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(equipment?.Lokasi || '-', margin + 25, yPos + 14);
        
        doc.setTextColor(100, 116, 139);
        doc.text('Status:', margin + 85, yPos + 14);
        doc.setTextColor(16, 185, 129);
        doc.text(equipment?.Status || '-', margin + 105, yPos + 14);
    }

    yPos += 30;

    // Work Details
    doc.setFillColor(...colors.primary);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(...colors.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('WORK DETAILS', margin + 3, yPos + 5.5);

    yPos += 10;
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPos, contentWidth, 25, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Type:', margin + 3, yPos + 6);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(log.Jenis || 'PM', margin + 25, yPos + 6);

    doc.setTextColor(100, 116, 139);
    doc.text('Category:', margin + 85, yPos + 6);
    doc.setTextColor(30, 41, 59);
    doc.text(log.rca || 'PM', margin + 110, yPos + 6);

    doc.setTextColor(100, 116, 139);
    doc.text('Technician:', margin + 3, yPos + 14);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(log.Technician || '-', margin + 25, yPos + 14);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Assigned:', margin + 85, yPos + 14);
    doc.setTextColor(59, 130, 246);
    doc.setFont('helvetica', 'bold');
    doc.text(log.assignedTo || '-', margin + 110, yPos + 14);

    yPos += 30;

    // Request Info
    doc.setFillColor(...colors.primary);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(...colors.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUEST', margin + 3, yPos + 5.5);

    yPos += 10;
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPos, contentWidth, 18, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Dept:', margin + 3, yPos + 5);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(log.requestSource || '-', margin + 25, yPos + 5);

    doc.setTextColor(100, 116, 139);
    doc.text('Requested By:', margin + 85, yPos + 5);
    doc.setTextColor(30, 41, 59);
    doc.text(log.requestedBy || '-', margin + 115, yPos + 5);

    yPos += 20;

    // Description
    doc.setFillColor(...colors.primary);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(...colors.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', margin + 3, yPos + 5.5);

    yPos += 10;
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPos, contentWidth, 25, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const descText = log.Deskripsi || '-';
    const lines = doc.splitTextToSize(descText, contentWidth - 6);
    doc.text(lines.slice(0, 4), margin + 3, yPos + 5);

    yPos += 28;

    // Parts list (manual table)
    if (parseParts && parseParts.length > 0) {
        doc.setFillColor(...colors.primary);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setTextColor(...colors.white);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PARTS USED', margin + 3, yPos + 5.5);
        
        yPos += 10;
        
        // Header
        doc.setFillColor(200, 200, 200);
        doc.rect(margin, yPos, contentWidth, 6, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('No', margin + 3, yPos + 4);
        doc.text('Part Number', margin + 15, yPos + 4);
        doc.text('Description', margin + 50, yPos + 4);
        doc.text('Qty', margin + 110, yPos + 4);
        
        yPos += 7;
        
        // Rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        parseParts.slice(0, 5).forEach((p, i) => {
            if (i % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos, contentWidth, 5, 'F');
            }
            doc.setTextColor(30, 41, 59);
            doc.text(String(i + 1), margin + 3, yPos + 3.5);
            doc.text(p.id || '-', margin + 15, yPos + 3.5);
            doc.text('-', margin + 50, yPos + 3.5);
            doc.text(String(p.qty || 0), margin + 110, yPos + 3.5);
            yPos += 5;
        });
        
        yPos += 5;
    }

    // Cost
    if (log.Downtime || log.Cost) {
        if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFillColor(254, 243, 199);
        doc.rect(margin, yPos, contentWidth, 18, 'F');
        
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        
        if (log.Downtime) {
            doc.text('Downtime:', margin + 3, yPos + 6);
            doc.setTextColor(220, 38, 38);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(String(log.Downtime) + ' hrs', margin + 30, yPos + 6);
        }
        
        if (log.Cost) {
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Cost:', margin + 80, yPos + 6);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(formatCurrency(log.Cost), margin + 105, yPos + 6);
        }
    }

    // ============ SIGNATURES ============
    yPos = pageHeight - 55;
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    
    yPos += 5;
    
    // Requested By signature box
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, 55, 25, 'F');
    doc.setDrawColor(30, 41, 59);
    doc.rect(margin, yPos, 55, 25, 'S');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUESTED BY', margin + 2, yPos + 3);
    
    // Signature line
    doc.setDrawColor(30, 41, 59);
    doc.line(margin + 3, yPos + 17, margin + 50, yPos + 17);
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Name', margin + 2, yPos + 20);
    doc.text('Date', margin + 30, yPos + 20);
    
    // Approved By signature box
    doc.setFillColor(245, 245, 245);
    doc.rect(margin + 60, yPos, 55, 25, 'F');
    doc.setDrawColor(30, 41, 59);
    doc.rect(margin + 60, yPos, 55, 25, 'S');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVED BY', margin + 62, yPos + 3);
    
    // Signature line
    doc.setDrawColor(30, 41, 59);
    doc.line(margin + 63, yPos + 17, margin + 110, yPos + 17);
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Name', margin + 62, yPos + 20);
    doc.text('Date', margin + 90, yPos + 20);
    
    // Executed By signature box
    doc.setFillColor(245, 245, 245);
    doc.rect(pageWidth - margin - 55, yPos, 55, 25, 'F');
    doc.setDrawColor(30, 41, 59);
    doc.rect(pageWidth - margin - 55, yPos, 55, 25, 'S');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTED BY', pageWidth - margin - 53, yPos + 3);
    
    // Signature line
    doc.setDrawColor(30, 41, 59);
    doc.line(pageWidth - margin - 52, yPos + 17, pageWidth - margin - 5, yPos + 17);
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Name', pageWidth - margin - 53, yPos + 20);
    doc.text('Date', pageWidth - margin - 25, yPos + 20);

    // Footer timestamp
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated: ' + new Date().toLocaleDateString('id-ID'), margin, pageHeight - 10);
    doc.text('MTC System v2.0', pageWidth - margin, pageHeight - 10, { align: 'right' });

    doc.save('WorkOrder_' + (log.woNumber || 'DRAFT') + '.pdf');
}