/**
 * Work Order PDF — premium maintenance form (S41).
 *
 * Prinsip desain:
 *  · Kertas putih, tinta slate, satu aksen emas. Tidak ada blok abu-abu besar;
 *    pemisah memakai hairline, bukan slab, supaya dokumen terbaca seperti
 *    formulir teknis profesional — bukan tangkapan layar.
 *  · Setiap seksi punya penanda (kotak emas + label berspasi), bukan bar gelap
 *    yang memakan 8 mm per seksi.
 *  · Isi tidak pernah dipotong diam-diam: deskripsi dibungkus penuh, tabel parts
 *    memuat semua baris, dan blok yang tidak muat pindah halaman utuh.
 *  · Tanda tangan tidak lagi dipaku ke dasar halaman (dulu `yPos = pageHeight -
 *    55`, sehingga isi panjang menabraknya) — blok tanda tangan mengalir setelah
 *    isi, dan baru "didorong" ke bawah kalau memang ada ruang.
 */
const PW = 210;
const PH = 297;
const M = 14;
const CW = PW - M * 2;
const BOTTOM = PH - 22; // batas isi; di bawahnya zona footer

const C = {
    ink: [17, 24, 39],
    ink2: [31, 41, 55],
    slate: [100, 116, 139],
    mute: [148, 163, 184],
    line: [226, 232, 240],
    paper: [248, 250, 252],
    gold: [198, 152, 58],
    white: [255, 255, 255],
    danger: [185, 28, 28],
    success: [5, 150, 105],
    info: [37, 99, 235],
    warn: [180, 83, 9],
    neutral: [71, 85, 105],
};

function formatCurrency(num) {
    if (!num) return 'Rp 0';
    return 'Rp ' + String(num || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `2026-10-18` → `18 Oct 2026`; bentuk lain dikembalikan apa adanya. */
function formatDate(value) {
    const s = String(value || '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return s || '-';
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = Number(m[2]) - 1;
    return `${m[3]} ${bulan[idx] || m[2]} ${m[1]}`;
}

function priorityTone(priority) {
    if (priority === 'Emergency') return C.danger;
    if (priority === 'Urgent') return C.warn;
    if (priority === 'Planned') return C.success;
    return C.gold;
}

function statusTone(status) {
    if (status === 'Completed') return C.success;
    if (status === 'In Progress') return C.info;
    if (status === 'Pending') return C.warn;
    return C.neutral;
}

/**
 * `assignedTo` di RTDB bisa berupa larik (multi-teknisi). Disalin lokal, bukan
 * diimpor dari `utils.js`, supaya modul PDF tetap daun — tanpa rantai
 * `utils → constants` yang membuatnya tidak bisa dirender di luar Vite.
 * Perilakunya sama dengan `formatAssignee()` di `src/js/utils.js`.
 */
function formatAssignees(value) {
    if (Array.isArray(value)) {
        const names = value.map((v) => String(v ?? '').trim()).filter(Boolean);
        return names.length ? names.join(', ') : 'UNASSIGNED';
    }
    if (typeof value === 'string') return value.trim() || 'UNASSIGNED';
    return 'UNASSIGNED';
}

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

    // ── primitif ────────────────────────────────────────────────────────────
    const ink = () => doc.setTextColor(...C.ink);
    const slate = () => doc.setTextColor(...C.slate);

    function hairline(x1, x2, yTop, color = C.line, width = 0.2) {
        doc.setDrawColor(...color);
        doc.setLineWidth(width);
        doc.line(x1, yTop, x2, yTop);
    }

    function label(text, x, yTop, color = C.slate) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setCharSpace(0.35);
        doc.setTextColor(...color);
        doc.text(String(text).toUpperCase(), x, yTop);
        doc.setCharSpace(0);
    }

    function truncate(text, maxWidth) {
        const s = String(text);
        if (doc.getTextWidth(s) <= maxWidth) return s;
        let cut = s;
        while (cut.length > 1 && doc.getTextWidth(cut + '…') > maxWidth) cut = cut.slice(0, -1);
        return cut + '…';
    }

    function sectionTitle(text, yTop) {
        doc.setFillColor(...C.gold);
        doc.rect(M, yTop - 2.4, 2.2, 2.2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setCharSpace(0.55);
        ink();
        doc.text(text.toUpperCase(), M + 5, yTop);
        const w = doc.getTextWidth(text.toUpperCase());
        doc.setCharSpace(0);
        hairline(M + 8 + w, PW - M, yTop - 0.9, C.line, 0.25);
    }

    function pair(x, yTop, key, value, width) {
        label(key, x, yTop);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.2);
        ink();
        const shown = value === '' || value === null || value === undefined ? '-' : value;
        doc.text(truncate(shown, width), x, yTop + 5);
    }

    function twoCol(yTop, left, right) {
        const half = (CW - 6) / 2;
        pair(M, yTop, left[0], left[1], half - 4);
        pair(M + half + 6, yTop, right[0], right[1], half - 4);
    }

    // ── header halaman 1 ────────────────────────────────────────────────────
    function masthead() {
        doc.setFillColor(...C.gold);
        doc.rect(0, 0, PW, 1.8, 'F');

        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.gold);
        doc.setLineWidth(0.5);
        doc.roundedRect(M, 10, 13, 13, 2.2, 2.2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setCharSpace(0.5);
        ink();
        doc.text('MTC', M + 6.5, 18.2, { align: 'center' });
        doc.setCharSpace(0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12.6);
        ink();
        doc.text('PT. CITRA PALU MINERALS', M + 17, 15.4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.4);
        doc.setCharSpace(0.5);
        slate();
        doc.text('MAINTENANCE TECHNICAL CENTER', M + 17, 20.2);
        doc.setCharSpace(0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15.4);
        ink();
        doc.text('WORK ORDER', PW - M, 15.4, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.4);
        doc.setCharSpace(0.5);
        slate();
        doc.text('MAINTENANCE REQUEST FORM', PW - M, 20.2, { align: 'right' });
        doc.setCharSpace(0);

        // Nomor WO sebagai "stub" bergaris emas — identitas dokumen.
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.4);
        const woW = doc.getTextWidth(woNumber) + 9;
        const woX = PW - M - woW;
        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.gold);
        doc.setLineWidth(0.35);
        doc.roundedRect(woX, 24, woW, 7.6, 1.2, 1.2, 'FD');
        ink();
        doc.text(woNumber, woX + woW / 2, 29.1, { align: 'center' });

        hairline(M, PW - M, 33);
        y = 38;
    }

    /** Header tipis untuk halaman lanjutan. */
    function continuationHeader() {
        doc.setFillColor(...C.gold);
        doc.rect(0, 0, PW, 1.8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.6);
        ink();
        doc.text('PT. CITRA PALU MINERALS', M, 11.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.4);
        slate();
        doc.text('WORK ORDER · ' + woNumber, PW - M, 11.5, { align: 'right' });
        hairline(M, PW - M, 15.5);
    }

    function newPage() {
        doc.addPage();
        continuationHeader();
        y = 23;
    }

    function ensure(height) {
        if (y + height > BOTTOM) newPage();
    }

    // ── masthead + pita meta ────────────────────────────────────────────────
    masthead();

    const metaCells = [
        { key: 'Issued', value: formatDate(log.Tanggal) },
        { key: 'Due', value: log.dueDate ? formatDate(log.dueDate) : '—' },
        { key: 'Priority', value: String(priority).toUpperCase(), tone: priorityTone(priority) },
        { key: 'Status', value: String(status).toUpperCase(), tone: statusTone(status) },
    ];
    const cellW = CW / metaCells.length;
    metaCells.forEach((cell, i) => {
        const x = M + i * cellW;
        label(cell.key, x, y - 2);
        if (cell.tone) {
            doc.setFillColor(...cell.tone);
            doc.circle(x + 1.5, y + 3.1, 1.4, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.8);
            doc.setTextColor(...cell.tone);
            doc.text(cell.value, x + 5, y + 5);
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.4);
            ink();
            doc.text(cell.value, x, y + 5);
        }
        if (i > 0) {
            doc.setDrawColor(...C.line);
            doc.setLineWidth(0.2);
            doc.line(x - 4, y - 4, x - 4, y + 6);
        }
    });
    y += 11;
    hairline(M, PW - M, y);

    // ── equipment / work details / request ──────────────────────────────────
    // ROW = jarak label→label berikutnya (6 pt label + 9,2 pt nilai butuh >=10,5 mm);
    // GAP = jarak antar seksi. Dua nilai berbeda — menyamakannya membuat label
    // baris kedua menabrak nilai baris pertama.
    const ROW = 11;
    const GAP = 8;

    y += 8;
    sectionTitle('Equipment / Asset', y);
    y += 8;
    if (isExternal) {
        pair(M, y, 'External Asset', log.externalEquipName || '-', CW);
        y += ROW;
        twoCol(y, ['Source', log.requestSource || '-'], ['Location', equipment?.Lokasi || '-']);
    } else {
        pair(M, y, 'Equipment', (equipment?.EquipmentID || '-') + ' · ' + (equipment?.Nama || '-'), CW);
        y += ROW;
        twoCol(y, ['Location', equipment?.Lokasi || '-'], ['Asset Status', equipment?.Status || '-']);
    }
    y += GAP;

    ensure(34);
    sectionTitle('Work Details', y);
    y += 8;
    twoCol(y, ['Type', log.Jenis || 'PM'], ['Category', log.rca || 'PM']);
    y += ROW;
    twoCol(y, ['Technician', log.Technician || '-'], ['Assigned To', formatAssignees(log.assignedTo)]);
    y += GAP;

    ensure(30);
    sectionTitle('Request', y);
    y += 8;
    twoCol(y, ['Department', log.requestSource || '-'], ['Requested By', log.requestedBy || '-']);
    y += ROW;
    twoCol(y, ['Request Date', formatDate(log.requestDate)], ['Approved By', log.approvedBy || '-']);
    y += GAP;

    // ── description (penuh, tidak dipotong) ─────────────────────────────────
    ensure(28);
    sectionTitle('Description', y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    ink();
    const descTop = y - 3.4;
    const descLines = doc.splitTextToSize(String(log.Deskripsi || '-'), CW - 5);
    for (const line of descLines) {
        ensure(6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.2);
        ink();
        doc.text(line, M + 5, y);
        y += 4.5;
    }
    doc.setFillColor(...C.gold);
    doc.rect(M, descTop, 1.2, y - descTop - 1.6, 'F');
    y += 6;

    // ── parts ───────────────────────────────────────────────────────────────
    if (parseParts.length > 0) {
        ensure(22);
        sectionTitle('Parts Used', y);
        y += 6;

        const colNo = M + 2;
        const colPart = M + 14;
        const colDesc = M + 64;
        const colQtyRight = PW - M - 4;
        const descMax = colQtyRight - colDesc - 22;

        const tableHead = () => {
            doc.setFillColor(...C.ink);
            doc.roundedRect(M, y, CW, 6, 0.8, 0.8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setCharSpace(0.45);
            doc.setTextColor(...C.white);
            doc.text('NO', colNo + 3, y + 4.3, { align: 'center' });
            doc.text('PART NUMBER', colPart, y + 4.3);
            doc.text('DESCRIPTION', colDesc, y + 4.3);
            doc.text('QTY', colQtyRight, y + 4.3, { align: 'right' });
            doc.setCharSpace(0);
            y += 6;
        };
        tableHead();

        let totalQty = 0;
        parseParts.forEach((part, i) => {
            if (y + 5.4 > BOTTOM) {
                newPage();
                tableHead();
            }
            const qty = Number(part?.qty ?? part?.Qty ?? 0) || 0;
            totalQty += qty;
            if (i % 2 === 1) {
                doc.setFillColor(...C.paper);
                doc.rect(M, y, CW, 5.4, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.4);
            doc.setTextColor(...C.mute);
            doc.text(String(i + 1).padStart(2, '0'), colNo + 3, y + 4.2, { align: 'center' });
            doc.setFont('courier', 'bold');
            doc.setFontSize(7.6);
            ink();
            doc.text(truncate(part?.id || part?.PartID || '-', colDesc - colPart - 6), colPart, y + 4.2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.4);
            doc.setTextColor(...C.ink2);
            doc.text(truncate(part?.name || part?.NamaPart || '-', descMax), colDesc, y + 4.2);
            doc.setFont('helvetica', 'bold');
            ink();
            doc.text(String(qty), colQtyRight, y + 4.2, { align: 'right' });
            hairline(M, PW - M, y + 5.4, C.line, 0.15);
            y += 5.4;
        });

        ensure(8);
        hairline(M, PW - M, y, C.gold, 0.3);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.6);
        doc.setCharSpace(0.4);
        slate();
        doc.text('TOTAL ITEMS', colPart, y + 4.6);
        doc.setCharSpace(0);
        ink();
        doc.setFontSize(8);
        doc.text(String(totalQty), colQtyRight, y + 4.6, { align: 'right' });
        y += 8;
    }

    // ── ringkasan biaya ─────────────────────────────────────────────────────
    const hasHours = log.estimatedHours || log.actualHours;
    if (log.Downtime || log.Cost || hasHours) {
        ensure(20);
        doc.setFillColor(...C.paper);
        doc.roundedRect(M, y, CW, 16, 1.6, 1.6, 'F');
        doc.setFillColor(...C.gold);
        doc.rect(M, y, 1.6, 16, 'F');

        const cells = [{ key: 'Downtime', value: log.Downtime ? String(log.Downtime) + ' hrs' : '—' }];
        if (hasHours) {
            cells.push({
                key: 'Man Hours',
                value:
                    (log.estimatedHours ? String(log.estimatedHours) : '—') +
                    ' h est · ' +
                    (log.actualHours ? String(log.actualHours) : '—') +
                    ' h act',
            });
        }
        cells.push({ key: 'Total Cost', value: formatCurrency(log.Cost), accent: true });

        const w = CW / cells.length;
        cells.forEach((cell, i) => {
            const x = M + 8 + i * w;
            label(cell.key, x, y + 5.4);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(cell.accent ? 13 : 11);
            ink();
            doc.text(cell.value, x, y + (cell.accent ? 12.4 : 11.6));
            if (cell.accent) hairline(x, x + doc.getTextWidth(cell.value), y + 13.2, C.gold, 0.4);
        });
        y += 20;
    }

    // ── tanda tangan ────────────────────────────────────────────────────────
    ensure(24);
    // Kalau ruang sisa lega, dorong blok tanda tangan ke bawah halaman supaya
    // formulir terlihat seimbang — tanpa memaku ke koordinat tetap.
    if (BOTTOM - y > 34) y = BOTTOM - 26;

    const sigW = (CW - 12) / 3;
    ['Requested By', 'Approved By', 'Executed By'].forEach((title, i) => {
        const x = M + i * (sigW + 6);
        label(title, x, y);
        hairline(x, x + sigW, y + 13, C.ink, 0.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(...C.mute);
        doc.text('Name / Position', x, y + 17);
        doc.text('Date & Time', x, y + 20.5);
    });

    // ── footer semua halaman ────────────────────────────────────────────────
    const total = doc.getNumberOfPages();
    const now = new Date();
    const stamp = formatDate(now.toISOString().slice(0, 10)) + ' · ' + now.toTimeString().slice(0, 5);
    for (let page = 1; page <= total; page++) {
        doc.setPage(page);
        hairline(M, PW - M, PH - 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...C.slate);
        doc.text('MTC System v2.0  ·  Printed ' + stamp + '  ·  ' + woNumber, M, PH - 11);
        doc.text('Page ' + page + ' of ' + total, PW - M, PH - 11, { align: 'right' });
    }

    doc.save('WorkOrder_' + (log.woNumber || 'DRAFT') + '.pdf');
}
