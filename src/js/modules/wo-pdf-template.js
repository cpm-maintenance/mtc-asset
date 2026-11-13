// @ts-check
/**
 * Work Order PDF — Template Form Grid Korporat (Gaya TemplateLab / Corporate CPM).
 *
 * Mengikuti standar formulir kerja formal industri pertambangan:
 *  · Kop bersih: Banner nama PT. CITRA PALU MINERALS + blok judul MAINTENANCE WORK ORDER.
 *  · Metadata Grid 2-Kolom: Kolom kiri informasi alat (Equipment, Lokasi, Status, Dept, Tipe),
 *    kolom kanan informasi order (Order Number, Issued, Priority, Due, Status, Requestor).
 *  · Lingkup & Deskripsi Pekerjaan (Terms & Work Description) tersusun dalam baris tabel berbingkai.
 *  · Tabel Parts / Material: Header biru solid, baris belang (zebra), dan rekap Total Items.
 *  · Blok Bawah Terbagi: Kolom tanda tangan 3-pihak di kiri dan rekap Jam & Biaya di kanan.
 *  · Dukungan multi-halaman jika item parts panjang tanpa memotong teks atau menabrak footer.
 */

const PW = 210;
const PH = 297;
const M = 12;
const CW = PW - M * 2; // 186 mm
const BOTTOM = PH - 24;

/**
 * Palet dokumen.
 * @typedef {object} Palette
 * @property {[number, number, number]} blue
 * @property {[number, number, number]} darkBlue
 * @property {[number, number, number]} lightBlue
 * @property {[number, number, number]} zebra
 * @property {[number, number, number]} line
 * @property {[number, number, number]} text
 * @property {[number, number, number]} slate
 * @property {[number, number, number]} mute
 * @property {[number, number, number]} white
 * @property {[number, number, number]} gold
 * @property {[number, number, number]} danger
 * @property {[number, number, number]} success
 * @property {[number, number, number]} info
 * @property {[number, number, number]} warn
 * @property {[number, number, number]} neutral
 */
/** @type {Palette} */
const C = {
    blue: [27, 85, 155],        // Biru Korporat TemplateLab
    darkBlue: [18, 58, 110],    // Biru Tua / Header Aksen
    lightBlue: [238, 244, 252], // Biru Es Lembut
    zebra: [248, 250, 254],     // Baris Belang
    line: [185, 200, 218],      // Garis Tabel
    text: [25, 30, 40],         // Teks Utama Gelap
    slate: [95, 110, 130],      // Teks Redup
    mute: [145, 155, 170],      // Teks Keterangan
    white: [255, 255, 255],
    gold: [191, 155, 90],
    danger: [185, 28, 28],
    warn: [180, 83, 9],
    success: [5, 150, 105],
    info: [37, 99, 235],
    neutral: [71, 85, 105],
};

/** @param {any} value @returns {string} */
function num(value) {
    return String(value).replace('.', ',');
}

/** @param {any} val @returns {string} */
function formatCurrency(val) {
    if (val === 0 || val === '0') return 'Rp 0';
    if (!val) return 'Rp 0';
    return 'Rp ' + String(val).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** @param {any} value @returns {string} */
function formatDate(value) {
    const s = String(value || '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return s || '-';
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = Number(m[2]) - 1;
    return `${m[3]} ${bulan[idx] || m[2]} ${m[1]}`;
}

/** @param {any} value @returns {string} */
function formatAssignees(value) {
    if (Array.isArray(value)) {
        const names = value.map((v) => String(v ?? '').trim()).filter(Boolean);
        return names.length ? names.join(', ') : 'UNASSIGNED';
    }
    if (typeof value === 'string') return value.trim() || 'UNASSIGNED';
    return 'UNASSIGNED';
}

/** @param {Date} [d] @returns {string} */
function localDay(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** @param {string} priority @returns {[number, number, number]} */
function priorityTone(priority) {
    if (priority === 'Emergency') return C.danger;
    if (priority === 'Urgent') return C.warn;
    if (priority === 'Planned') return C.success;
    return C.gold;
}

/** @param {string} status @returns {[number, number, number]} */
function statusTone(status) {
    if (status === 'Completed') return C.success;
    if (status === 'In Progress') return C.info;
    if (status === 'Pending') return C.warn;
    return C.neutral;
}

/**
 * @param {any} log
 * @param {any} equipment
 * @param {any} _parts
 * @returns {Promise<void>}
 */
export async function generateProfessionalWOPDF(log, equipment, _parts) {
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF('p', 'mm', 'a4');

    const woNumber = log.woNumber || 'WO-0000';
    const priority = log.woPriority || 'Normal';
    const status = log.Status || 'Pending';
    const isExternal = log.equipmentId === 'EXTERNAL';

    let parseParts;
    try {
        parseParts = typeof log.PartsUsed === 'string' ? JSON.parse(log.PartsUsed || '[]') : log.PartsUsed || [];
    } catch {
        parseParts = [];
    }
    if (!Array.isArray(parseParts)) parseParts = [];

    let y = 0;

    /** @param {any} text @param {number} maxWidth @returns {string} */
    function truncate(text, maxWidth) {
        const s = String(text ?? '-');
        if (doc.getTextWidth(s) <= maxWidth) return s;
        let cut = s;
        while (cut.length > 1 && doc.getTextWidth(cut + '…') > maxWidth) cut = cut.slice(0, -1);
        return cut + '…';
    }

    /**
     * Gambar sel header (latar biru, teks putih).
     * @param {number} x
     * @param {number} yTop
     * @param {number} w
     * @param {number} h
     * @param {string} text
     * @param {'left'|'center'|'right'} [align]
     * @param {number} [fontSize]
     */
    function cellHeader(x, yTop, w, h, text, align = 'left', fontSize = 6.2) {
        doc.setFillColor(...C.blue);
        doc.rect(x, yTop, w, h, 'F');
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.2);
        doc.rect(x, yTop, w, h, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize);
        doc.setTextColor(...C.white);
        doc.setCharSpace(0.3);

        const textY = yTop + h / 2 + 1.2;
        if (align === 'center') {
            doc.text(String(text).toUpperCase(), x + w / 2, textY, { align: 'center' });
        } else if (align === 'right') {
            doc.text(String(text).toUpperCase(), x + w - 2.5, textY, { align: 'right' });
        } else {
            doc.text(String(text).toUpperCase(), x + 2.5, textY);
        }
        doc.setCharSpace(0);
    }

    /**
     * Gambar sel nilai data (latar putih, border garis, teks gelap).
     * @param {number} x
     * @param {number} yTop
     * @param {number} w
     * @param {number} h
     * @param {string} text
     * @param {'left'|'center'|'right'} [align]
     * @param {boolean} [bold]
     * @param {number} [fontSize]
     * @param {[number, number, number]} [fill]
     */
    function cellValue(x, yTop, w, h, text, align = 'left', bold = true, fontSize = 7.2, fill = C.white) {
        doc.setFillColor(...fill);
        doc.rect(x, yTop, w, h, 'F');
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.2);
        doc.rect(x, yTop, w, h, 'S');

        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(...C.text);

        const textY = yTop + h / 2 + 1.2;
        const textVal = truncate(text, w - 5);
        if (align === 'center') {
            doc.text(textVal, x + w / 2, textY, { align: 'center' });
        } else if (align === 'right') {
            doc.text(textVal, x + w - 2.5, textY, { align: 'right' });
        } else {
            doc.text(textVal, x + 2.5, textY);
        }
    }

    // ── KOP / HEADER DOKUMEN ───────────────────────────────────────────────
    function headerBanner() {
        // Blok Identitas Perusahaan (Kiri)
        const leftBoxW = 86;
        doc.setFillColor(...C.blue);
        doc.rect(M, 12, leftBoxW, 8.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...C.white);
        doc.text('PT. CITRA PALU MINERALS', M + 3, 17.8);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(...C.darkBlue);
        doc.text('MAINTENANCE TECHNICAL CENTER', M, 24.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...C.slate);
        doc.text('Poboya Gold Mine Project · Palu, Sulawesi Tengah', M, 28.5);
        doc.text('Indonesia · Tel: +62 451 4012800 · www.citrapalu.com', M, 32.2);

        // Banner Judul Dokumen (Kanan)
        const bannerW = 92;
        const bannerX = PW - M - bannerW;
        doc.setFillColor(...C.darkBlue);
        doc.roundedRect(bannerX, 12, bannerW, 21.5, 1.2, 1.2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(...C.white);
        doc.setCharSpace(1.8);
        doc.text('MAINTENANCE', bannerX + bannerW / 2, 18.5, { align: 'center' });

        doc.setFontSize(14.5);
        doc.setCharSpace(1.2);
        doc.text('WORK ORDER', bannerX + bannerW / 2, 26.5, { align: 'center' });
        doc.setCharSpace(0);

        // Sub-strip nomor WO di dalam banner
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.4);
        doc.setTextColor(...C.white);
        doc.text(woNumber, bannerX + bannerW / 2, 31, { align: 'center' });
    }

    /** Header halaman lanjutan (jika tabel parts panjang) */
    function continuationHeader() {
        doc.setFillColor(...C.darkBlue);
        doc.rect(M, 10, CW, 11, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(...C.white);
        doc.text('PT. CITRA PALU MINERALS', M + 4, 17);
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.2);
        doc.text('WORK ORDER · ' + woNumber, PW - M - 4, 17, { align: 'right' });
        y = 25;
    }

    function newPage() {
        doc.addPage();
        continuationHeader();
    }

    /** @param {number} height */
    function ensure(height) {
        if (y + height > BOTTOM) newPage();
    }

    // ── RENDER HALAMAN UTAMA ────────────────────────────────────────────────
    headerBanner();
    y = 37;

    // ── METADATA GRID (Tabel 2-Kolom Berbingkai) ────────────────────────────
    const leftW = 100;
    const labelW = 34;
    const valW = leftW - labelW; // 66 mm
    const rowH = 6.2;

    const leftRows = isExternal
        ? [
              ['EXTERNAL ASSET', log.externalEquipName || '-'],
              ['SOURCE', log.requestSource || '-'],
              ['DEPARTMENT', log.requestSource || 'Production'],
              ['MAINTENANCE TYPE', log.Jenis || 'PM'],
              ['LOCATION', log.Lokasi || 'Plant Site'],
              ['ASSIGNED TO', formatAssignees(log.assignedTo)],
          ]
        : [
              ['EQUIPMENT', (equipment?.EquipmentID || '-') + ' · ' + (equipment?.Nama || '-')],
              ['LOCATION', equipment?.Lokasi || '-'],
              ['ASSET STATUS', equipment?.Status || '-'],
              ['DEPARTMENT', log.requestSource || 'Production'],
              ['MAINTENANCE TYPE', log.Jenis || 'PM'],
              ['ASSIGNED TO', formatAssignees(log.assignedTo)],
          ];

    leftRows.forEach(([lbl, val], idx) => {
        const ry = y + idx * rowH;
        cellHeader(M, ry, labelW, rowH, lbl);
        cellValue(M + labelW, ry, valW, rowH, val);
    });

    // Kolom Kanan: 3 Baris Pasangan (Header Atas, Nilai Bawah)
    const rightX = M + leftW + 3;
    const rightW = CW - leftW - 3; // 83 mm
    const halfW = rightW / 2; // 41.5 mm
    const headH = 5.0;
    const dataH = 7.4;
    const tierH = headH + dataH; // 12.4 mm

    // Tier 1: ORDER NUMBER & ISSUED
    const t1Y = y;
    cellHeader(rightX, t1Y, halfW, headH, 'ORDER NUMBER');
    cellHeader(rightX + halfW, t1Y, halfW, headH, 'ISSUED');
    cellValue(rightX, t1Y + headH, halfW, dataH, woNumber, 'left', true, 7.8);
    cellValue(rightX + halfW, t1Y + headH, halfW, dataH, formatDate(log.Tanggal), 'left', true, 7.8);

    // Tier 2: PRIORITY & DUE
    const t2Y = y + tierH;
    cellHeader(rightX, t2Y, halfW, headH, 'PRIORITY');
    cellHeader(rightX + halfW, t2Y, halfW, headH, 'DUE');

    // Nilai Priority dengan Badge Tone Warna
    doc.setFillColor(...C.white);
    doc.rect(rightX, t2Y + headH, halfW, dataH, 'F');
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.rect(rightX, t2Y + headH, halfW, dataH, 'S');

    const prioTone = priorityTone(priority);
    doc.setFillColor(...prioTone);
    doc.roundedRect(rightX + 3, t2Y + headH + 1.2, halfW - 6, 5.0, 1.0, 1.0, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(...C.white);
    doc.text(String(priority).toUpperCase(), rightX + halfW / 2, t2Y + headH + 4.4, { align: 'center' });

    // Nilai Due Date
    const dueStr = log.dueDate ? formatDate(log.dueDate) : '—';
    cellValue(rightX + halfW, t2Y + headH, halfW, dataH, dueStr, 'left', true, 7.8);

    // Tier 3: STATUS & REQUESTED BY
    const t3Y = y + tierH * 2;
    cellHeader(rightX, t3Y, halfW, headH, 'STATUS');
    cellHeader(rightX + halfW, t3Y, halfW, headH, 'REQUESTED BY');

    // Nilai Status dengan Badge Tone Warna
    doc.setFillColor(...C.white);
    doc.rect(rightX, t3Y + headH, halfW, dataH, 'F');
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.rect(rightX, t3Y + headH, halfW, dataH, 'S');

    const statCol = statusTone(status);
    doc.setFillColor(...statCol);
    doc.roundedRect(rightX + 3, t3Y + headH + 1.2, halfW - 6, 5.0, 1.0, 1.0, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(...C.white);
    doc.text(String(status).toUpperCase(), rightX + halfW / 2, t3Y + headH + 4.4, { align: 'center' });

    // Nilai Requested By
    cellValue(rightX + halfW, t3Y + headH, halfW, dataH, log.requestedBy || '-', 'left', true, 7.4);

    y += leftRows.length * rowH + 3.5;

    // ── LINGKUP & DESKRIPSI PEKERJAAN (TERMS & WORK SCOPE) ─────────────────
    const descLabelW = 38;
    const descValW = CW - descLabelW; // 148 mm
    const textWrapW = 140;            // 140 mm (lebar aman dengan margin 4 mm)

    // Baris 1: TERMS OF SERVICE / SCOPE
    const termsH = 6.2;
    cellHeader(M, y, descLabelW, termsH, 'TERMS OF SERVICE');
    cellValue(
        M + descLabelW,
        y,
        descValW,
        termsH,
        `Class A Mining Service Agreement. Category: ${log.rca || 'PM'} · Dept: ${log.requestSource || 'Production'}`,
        'left',
        false,
        6.8,
    );
    y += termsH;

    // Baris 2: BRIEF WORK DESCRIPTION
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const descLines = doc.splitTextToSize(String(log.Deskripsi || '-'), textWrapW);
    const descBoxH = Math.max(8.5, descLines.length * 4.0 + 4.0);

    doc.setFillColor(...C.blue);
    doc.rect(M, y, descLabelW, descBoxH, 'F');
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.rect(M, y, descLabelW, descBoxH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...C.white);
    doc.setCharSpace(0.3);
    doc.text('BRIEF WORK DESCRIPTION', M + 2.5, y + 5.2);
    doc.setCharSpace(0);

    doc.setFillColor(...C.white);
    doc.rect(M + descLabelW, y, descValW, descBoxH, 'F');
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.rect(M + descLabelW, y, descValW, descBoxH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...C.text);
    let lineY = y + 4.4;
    for (const line of descLines) {
        doc.text(line, M + descLabelW + 3.5, lineY);
        lineY += 4.0;
    }
    y += descBoxH;

    // Baris 3: SPECIAL NOTES
    const notesH = 6.2;
    cellHeader(M, y, descLabelW, notesH, 'SPECIAL NOTES');
    cellValue(
        M + descLabelW,
        y,
        descValW,
        notesH,
        'Ensure work complies with CPM safety protocols, mandatory LOTO, and appropriate PPE.',
        'left',
        false,
        6.8,
    );
    y += notesH + 4.5;

    // ── TABEL MATERIAL & PARTS USED ─────────────────────────────────────────
    if (parseParts.length > 0) {
        ensure(28);

        const colNo = 12;
        const colPart = 36;
        const colDesc = 92;
        const colQty = 23;
        const colUom = 23;

        const tableHead = () => {
            // Header Seksi Bersih Bergaris
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.0);
            doc.setTextColor(...C.darkBlue);
            doc.text('PARTS USED', M, y + 3.2);

            doc.setDrawColor(...C.line);
            doc.setLineWidth(0.25);
            doc.line(M + 24, y + 2.5, PW - M, y + 2.5);
            y += 5.5;

            // Baris Kolom Tabel
            cellHeader(M, y, colNo, 6.0, 'NO', 'center');
            cellHeader(M + colNo, y, colPart, 6.0, 'PART NUMBER', 'left');
            cellHeader(M + colNo + colPart, y, colDesc, 6.0, 'MATERIAL DESCRIPTION', 'left');
            cellHeader(M + colNo + colPart + colDesc, y, colQty, 6.0, 'QUANTITY', 'right');
            cellHeader(M + colNo + colPart + colDesc + colQty, y, colUom, 6.0, 'UOM', 'center');
            y += 6.0;
        };

        tableHead();

        let totalQty = 0;
        parseParts.forEach((part, i) => {
            if (y + 5.6 > BOTTOM) {
                newPage();
                tableHead();
            }

            const qty = Number(part?.qty ?? part?.Qty ?? 0) || 0;
            totalQty += qty;
            const rowFill = i % 2 === 1 ? C.zebra : C.white;
            const rH = 5.6;

            const partId = String(part?.id || part?.PartID || '-');
            const partName = String(part?.name || part?.NamaPart || '-');
            const partUom = String(part?.uom || part?.UOM || 'pcs');

            cellValue(M, y, colNo, rH, String(i + 1).padStart(2, '0'), 'center', false, 7.0, rowFill);
            cellValue(M + colNo, y, colPart, rH, partId, 'left', true, 7.2, rowFill);
            cellValue(M + colNo + colPart, y, colDesc, rH, partName, 'left', false, 7.2, rowFill);
            cellValue(M + colNo + colPart + colDesc, y, colQty, rH, String(qty), 'right', true, 7.4, rowFill);
            cellValue(M + colNo + colPart + colDesc + colQty, y, colUom, rH, partUom, 'center', false, 7.0, rowFill);

            y += rH;
        });

        // Baris MATERIAL TOTAL / TOTAL ITEMS
        ensure(8);
        const totW = colQty + colUom; // 46 mm
        const totX = PW - M - totW;
        doc.setFillColor(...C.darkBlue);
        doc.rect(totX, y, totW, 6.4, 'F');
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.2);
        doc.rect(totX, y, totW, 6.4, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.4);
        doc.setTextColor(...C.white);
        doc.text('TOTAL ITEMS', totX + 3, y + 4.3);

        doc.setFontSize(8.4);
        doc.text(String(totalQty), PW - M - 3, y + 4.4, { align: 'right' });
        y += 10.5;
    }

    // ── BLOK BAWAH: TANDA TANGAN & REKAP BIAYA ──────────────────────────────
    ensure(38);

    const hasHours = Boolean(log.estimatedHours || log.actualHours);
    const hasCostBlock = Boolean(log.Downtime || log.Cost || hasHours);

    // Kiri: Tanda Tangan 3 Kolom
    const sigSectionW = hasCostBlock ? 104 : CW;
    const sigColW = (sigSectionW - 4) / 3;

    const signatures = [
        { role: 'REQUESTED BY', name: log.requestedBy || '-' },
        { role: 'APPROVED BY', name: log.approvedBy || '-' },
        { role: 'EXECUTED BY', name: formatAssignees(log.assignedTo) },
    ];

    const boxH = 21.8; // Menyelaraskan tinggi dengan tabel ringkasan 4 baris * 6.7 mm

    signatures.forEach((sig, i) => {
        const sx = M + i * (sigColW + 2);
        // Header Tanda Tangan
        cellHeader(sx, y, sigColW, 5.0, sig.role, 'center', 5.6);

        // Kotak Tanda Tangan
        doc.setFillColor(...C.white);
        doc.rect(sx, y + 5.0, sigColW, boxH, 'F');
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.2);
        doc.rect(sx, y + 5.0, sigColW, boxH, 'S');

        // Nama & Jabatan
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(...C.text);
        doc.text(truncate(sig.name, sigColW - 4), sx + sigColW / 2, y + 10.5, { align: 'center' });

        // Garis Tanda Tangan Basah
        doc.setDrawColor(...C.slate);
        doc.setLineWidth(0.2);
        doc.line(sx + 3, y + 19, sx + sigColW - 3, y + 19);

        // Keterangan Bawah
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(...C.slate);
        doc.text('Name / Position', sx + sigColW / 2, y + 22.5, { align: 'center' });
        doc.text('Date & Time', sx + sigColW / 2, y + 25.5, { align: 'center' });
    });

    // Kanan: Tabel Rekap Jam & Biaya
    if (hasCostBlock) {
        const costX = M + sigSectionW + 3;
        const costW = CW - sigSectionW - 3; // 79 mm
        const costLblW = 38;
        const costValW = costW - costLblW; // 41 mm
        const cH = 6.7; // 4 * 6.7 = 26.8 mm (sama persis dengan 5.0 + 21.8 mm tanda tangan)

        const costRows = [
            ['DOWNTIME', log.Downtime ? num(log.Downtime) + ' hrs' : '—', false],
            ['EST. HOURS', log.estimatedHours ? num(log.estimatedHours) + ' h' : '—', false],
            ['ACTUAL HOURS', log.actualHours ? num(log.actualHours) + ' h' : '—', false],
            ['TOTAL COST', formatCurrency(log.Cost), true],
        ];

        costRows.forEach(([lbl, val, isTotal], idx) => {
            const cy = y + idx * cH;
            if (isTotal) {
                cellHeader(costX, cy, costLblW, cH, String(lbl), 'left', 6.4);
                cellValue(costX + costLblW, cy, costValW, cH, String(val), 'right', true, 8.4, C.lightBlue);
            } else {
                cellHeader(costX, cy, costLblW, cH, String(lbl), 'left', 5.8);
                cellValue(costX + costLblW, cy, costValW, cH, String(val), 'right', true, 7.4);
            }
        });
    }

    y += 5.0 + boxH + 2.5;

    // Keterangan Validitas
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.6);
    doc.setTextColor(...C.mute);
    doc.text('Valid only with original signatures.', M, y);
    y += 5;

    // ── FOOTER SEMUA HALAMAN ────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    const now = new Date();
    const stamp = formatDate(localDay(now)) + ' · ' + now.toTimeString().slice(0, 5);

    for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);

        // Paragraf Deklarasi Standar CPM
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(...C.slate);
        doc.text(
            'Under CPM Technical Standards, this Work Order certifies that all maintenance tasks, parts replacement, and quality inspections comply with OEM specifications and site safety protocols.',
            M,
            PH - 16.5,
        );

        // Garis Pembatas Footer
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.25);
        doc.line(M, PH - 13.5, PW - M, PH - 13.5);

        // Meta Footer
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.4);
        doc.setTextColor(...C.slate);
        doc.text(
            'MTC System v2.0  ·  Form MTC-WO-01  ·  Printed ' + stamp + '  ·  ' + woNumber,
            M,
            PH - 9.0,
        );
        doc.text('Page ' + page + ' of ' + totalPages, PW - M, PH - 9.0, { align: 'right' });
    }

    doc.save('WorkOrder_' + (log.woNumber || 'DRAFT') + '.pdf');
}
