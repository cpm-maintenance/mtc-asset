/**
 * Work Order PDF — premium maintenance form, revisi 2 (S41b).
 *
 * Perubahan dari revisi 1: dokumen tidak lagi berupa deretan baris rata kiri.
 *  · Masthead **ink full-bleed** 27 mm dengan aksen emas — titik masuk mata,
 *    sekaligus membawa identitas (monogram, perusahaan, jenis dokumen, nomor WO).
 *  · Pita statistik di bawah masthead: ISSUED / DUE / PRIORITY / STATUS, tone
 *    berupa pil berwarna + teks, jadi tetap terbaca saat dicetak hitam-putih.
 *  · Badan dua kolom: kiri untuk aset + deskripsi, kanan **panel JOB CARD**
 *    berisi seluruh metadata pekerjaan. Panel inilah yang membuat halaman
 *    terbaca "dirancang", bukan daftar baris.
 *  · Seksi bernomor (01…04) supaya alur baca jelas: aset → lingkup → parts →
 *    tanda tangan.
 *  · TOTAL COST adalah jangkar angka terbesar; tanda tangan memakai panel
 *    bertanda tangan basah dengan catatan keabsahan.
 *
 * Prinsip yang dijaga: tidak ada isi yang dipotong diam-diam (deskripsi penuh,
 * semua baris parts), dan tidak ada koordinat yang dipaku ke dasar halaman.
 */
const PW = 210;
const PH = 297;
const M = 14;
const CW = PW - M * 2;
const BOTTOM = PH - 22;

const C = {
    ink: [15, 23, 42],
    ink2: [30, 41, 59],
    slate: [100, 116, 139],
    mute: [148, 163, 184],
    line: [226, 232, 240],
    paper: [248, 250, 252],
    gold: [191, 155, 90],
    goldSoft: [246, 240, 226],
    white: [255, 255, 255],
    danger: [185, 28, 28],
    success: [5, 150, 105],
    info: [37, 99, 235],
    warn: [180, 83, 9],
    neutral: [71, 85, 105],
};

/** Angka gaya Indonesia: 4.5 → `4,5`. */
function num(value) {
    return String(value).replace('.', ',');
}

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

    // ── primitif tipografi ──────────────────────────────────────────────────
    const ink = () => doc.setTextColor(...C.ink);
    const slate = () => doc.setTextColor(...C.slate);

    function hairline(x1, x2, yTop, color = C.line, width = 0.2) {
        doc.setDrawColor(...color);
        doc.setLineWidth(width);
        doc.line(x1, yTop, x2, yTop);
    }

    /** Label kecil huruf besar berspasi. */
    function label(text, x, yTop, color = C.slate, size = 5.9) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size);
        doc.setCharSpace(0.4);
        doc.setTextColor(...color);
        doc.text(String(text).toUpperCase(), x, yTop);
        doc.setCharSpace(0);
    }

    /** Judul seksi bernomor: `01` emas + judul + garis. */
    function sectionTitle(index, text, yTop, x = M, right = PW - M) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setCharSpace(0.2);
        doc.setTextColor(...C.gold);
        doc.text(String(index).padStart(2, '0'), x, yTop);
        doc.setCharSpace(0.7);
        ink();
        doc.text(String(text).toUpperCase(), x + 7.4, yTop);
        const w = doc.getTextWidth(String(text).toUpperCase());
        doc.setCharSpace(0);
        hairline(x + 9.6 + w, right, yTop - 0.9, C.line, 0.25);
    }

    function truncate(text, maxWidth) {
        const s = String(text);
        if (doc.getTextWidth(s) <= maxWidth) return s;
        let cut = s;
        while (cut.length > 1 && doc.getTextWidth(cut + '…') > maxWidth) cut = cut.slice(0, -1);
        return cut + '…';
    }

    function value(text, x, yTop, size = 9) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size);
        ink();
        doc.text(String(text), x, yTop);
    }

    /** Pil berwarna + teks putih; lebar mengikuti isi. */
    function pill(text, x, yTop, fill) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setCharSpace(0.4);
        const w = doc.getTextWidth(text) + 7;
        doc.setFillColor(...fill);
        doc.roundedRect(x, yTop, w, 5.6, 1.2, 1.2, 'F');
        doc.setTextColor(...C.white);
        doc.text(text, x + w / 2, yTop + 3.9, { align: 'center' });
        doc.setCharSpace(0);
        return w;
    }

    // ── masthead ────────────────────────────────────────────────────────────
    function masthead() {
        doc.setFillColor(...C.ink);
        doc.rect(0, 0, PW, 27, 'F');
        doc.setFillColor(...C.gold);
        doc.rect(0, 27, PW, 1.4, 'F');

        // Monogram: kotak bergaris emas, huruf emas.
        doc.setDrawColor(...C.gold);
        doc.setLineWidth(0.45);
        doc.roundedRect(M, 7.5, 13, 13, 2.4, 2.4, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setCharSpace(0.6);
        doc.setTextColor(...C.gold);
        doc.text('MTC', M + 6.5, 15.8, { align: 'center' });
        doc.setCharSpace(0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12.4);
        doc.setTextColor(...C.white);
        doc.text('PT. CITRA PALU MINERALS', M + 17.5, 13.4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setCharSpace(0.55);
        doc.setTextColor(148, 163, 184);
        doc.text('MAINTENANCE TECHNICAL CENTER', M + 17.5, 18.4);
        doc.setCharSpace(0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15.6);
        doc.setCharSpace(0.6);
        doc.setTextColor(...C.white);
        doc.text('WORK ORDER', PW - M, 13.4, { align: 'right' });
        doc.setCharSpace(0);

        doc.setFont('courier', 'bold');
        doc.setFontSize(9.6);
        doc.setCharSpace(0.4);
        doc.setTextColor(...C.gold);
        doc.text(woNumber, PW - M, 19.6, { align: 'right' });
        doc.setCharSpace(0);
    }

    /** Header tipis untuk halaman lanjutan. */
    function continuationHeader() {
        doc.setFillColor(...C.ink);
        doc.rect(0, 0, PW, 13, 'F');
        doc.setFillColor(...C.gold);
        doc.rect(0, 13, PW, 1.2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.4);
        doc.setTextColor(...C.white);
        doc.text('PT. CITRA PALU MINERALS', M, 8.6);
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.gold);
        doc.text('WORK ORDER · ' + woNumber, PW - M, 8.6, { align: 'right' });
        y = 21;
    }

    function newPage() {
        doc.addPage();
        continuationHeader();
    }

    function ensure(height) {
        if (y + height > BOTTOM) newPage();
    }

    // ── masthead + pita statistik ───────────────────────────────────────────
    masthead();

    const stats = [
        { key: 'Issued', value: formatDate(log.Tanggal) },
        { key: 'Due', value: log.dueDate ? formatDate(log.dueDate) : '—' },
        { key: 'Department', value: truncate(log.requestSource || '-', 30) },
        { key: 'Priority', value: String(priority).toUpperCase(), tone: priorityTone(priority) },
        { key: 'Status', value: String(status).toUpperCase(), tone: statusTone(status) },
    ];
    const statW = CW / stats.length;
    stats.forEach((cell, i) => {
        const x = M + i * statW;
        label(cell.key, x, 35.5);
        if (cell.tone) pill(cell.value, x, 39.2, cell.tone);
        else value(cell.value, x, 43, 9.4);
        if (i > 0) {
            doc.setDrawColor(...C.line);
            doc.setLineWidth(0.2);
            doc.line(x - 4.5, 34, x - 4.5, 44);
        }
    });
    hairline(M, PW - M, 49);

    // ── badan dua kolom ─────────────────────────────────────────────────────
    const leftX = M;
    const leftW = 106;
    const rightX = M + 114;
    const rightW = CW - 114;

    const bodyTop = 58;
    const GAP = 10;

    // Kolom kiri diukur lebih dulu, lalu **diseimbangkan** terhadap tinggi panel:
    // tanpa ini, deskripsi pendek menyisakan lubang 15–20 mm di bawah kolom kiri
    // sementara panel kanan berakhir jauh lebih rendah.
    const descLines = doc.splitTextToSize(String(log.Deskripsi || '-'), leftW - 5);
    const leftH = 39 + descLines.length * 4.4;

    const cardRows = [
        ['Type', log.Jenis || 'PM'],
        ['Category', log.rca || 'PM'],
        ['Technician', log.Technician || '-'],
        ['Assigned To', formatAssignees(log.assignedTo)],
        ['Requested By', log.requestedBy || '-'],
        ['Request Date', formatDate(log.requestDate)],
        ['Approved By', log.approvedBy || '-'],
    ];
    // Panel mulai di ketinggian huruf kapital judul seksi (baseline − 2,4 mm),
    // bukan di baseline-nya, supaya tepi atas kedua kolom benar-benar sejajar.
    const cardTop = bodyTop - 2.4;
    const cardRowH = 8.4;
    // Panel dan kolom kiri berbagi tinggi yang sama: tepi atas sejajar, tepi bawah
    // sejajar. Kelebihan ruang (kalau deskripsi pendek) masuk ke jarak **sebelum**
    // seksi 02, bukan menumpuk sebagai lubang di dasar kolom.
    const cardH = Math.max(11 + cardRows.length * cardRowH, leftH + 2.4);
    const slack = Math.max(0, cardH - leftH - 2.4);

    y = bodyTop;

    // Kiri: aset
    sectionTitle(1, 'Equipment / Asset', y, leftX, leftX + leftW);
    y += 8.6;
    if (isExternal) {
        label('External Asset', leftX, y);
        value(truncate(log.externalEquipName || '-', leftW), leftX, y + 4.8, 9.6);
        y += 12;
        label('Source', leftX, y);
        value(truncate(log.requestSource || '-', leftW), leftX, y + 4.8);
    } else {
        label('Equipment', leftX, y);
        value(truncate((equipment?.EquipmentID || '-') + ' · ' + (equipment?.Nama || '-'), leftW), leftX, y + 4.8, 9.6);
        y += 12;
        label('Location', leftX, y);
        value(truncate(equipment?.Lokasi || '-', leftW * 0.62), leftX, y + 4.8);
        label('Asset Status', leftX + leftW * 0.66, y);
        value(truncate(equipment?.Status || '-', leftW * 0.34), leftX + leftW * 0.66, y + 4.8);
    }
    y += GAP + slack;

    // Kiri: deskripsi
    sectionTitle(2, 'Description', y, leftX, leftX + leftW);
    y += 8.4;
    const descTop = y - 3.4;
    for (const line of descLines) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        ink();
        doc.text(line, leftX + 5, y);
        y += 4.4;
    }
    doc.setFillColor(...C.gold);
    doc.rect(leftX, descTop, 1.2, Math.max(4, y - descTop - 1.6), 'F');
    const leftBottom = y;

    // Kanan: panel JOB CARD (tingginya sendiri; kolom kiri yang menyesuaikan)
    doc.setFillColor(...C.paper);
    doc.roundedRect(rightX, cardTop, rightW, cardH, 1.8, 1.8, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(rightX, cardTop, 1.4, cardH, 'F');
    label('Work Details', rightX + 6, cardTop + 7, C.ink2, 6.4);
    hairline(rightX + 6, rightX + rightW - 5, cardTop + 9.4, C.line, 0.2);
    let cy = cardTop + 16;
    for (const [key, val] of cardRows) {
        label(key, rightX + 6, cy, C.slate, 5.9);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.7);
        ink();
        doc.text(truncate(val, rightW - 12), rightX + 6, cy + 4.3);
        cy += cardRowH;
    }

    y = Math.max(leftBottom, cardTop + cardH) + GAP;

    // ── parts ───────────────────────────────────────────────────────────────
    if (parseParts.length > 0) {
        ensure(26);
        sectionTitle(3, 'Parts Used', y);
        y += 6.4;

        const colNo = M + 3;
        const colPart = M + 16;
        const colDesc = M + 66;
        const colQtyRight = PW - M - 5;
        const descMax = colQtyRight - colDesc - 20;

        const tableHead = () => {
            doc.setFillColor(...C.ink);
            doc.rect(M, y, CW, 6.4, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.9);
            doc.setCharSpace(0.45);
            doc.setTextColor(...C.white);
            doc.text('NO', colNo, y + 4.2, { align: 'center' });
            doc.text('PART NUMBER', colPart, y + 4.2);
            doc.text('DESCRIPTION', colDesc, y + 4.2);
            doc.text('QTY', colQtyRight, y + 4.2, { align: 'right' });
            doc.setCharSpace(0);
            y += 6.4;
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
            if (i % 2 === 1) {
                doc.setFillColor(...C.paper);
                doc.rect(M, y, CW, 5.6, 'F');
            }
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...C.mute);
            doc.text(String(i + 1).padStart(2, '0'), colNo, y + 4, { align: 'center' });
            doc.setFont('courier', 'bold');
            doc.setFontSize(7.4);
            ink();
            doc.text(truncate(part?.id || part?.PartID || '-', colDesc - colPart - 6), colPart, y + 4);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.4);
            doc.setTextColor(...C.ink2);
            doc.text(truncate(part?.name || part?.NamaPart || '-', descMax), colDesc, y + 4);
            doc.setFont('helvetica', 'bold');
            ink();
            doc.text(String(qty), colQtyRight, y + 4, { align: 'right' });
            hairline(M, PW - M, y + 5.6, C.line, 0.15);
            y += 5.6;
        });

        // Baris total: jeda putih 1,2 mm + latar krem + garis emas tegas, angka
        // sejajar kolom QTY — supaya terbaca sebagai penutup tabel, bukan baris ke-7.
        ensure(10);
        y += 1.2;
        doc.setFillColor(...C.ink2);
        doc.rect(M, y, CW, 7.4, 'F');
        doc.setFillColor(...C.gold);
        doc.rect(M, y, CW, 0.7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.4);
        doc.setCharSpace(0.45);
        doc.setTextColor(...C.white);
        doc.text('TOTAL ITEMS', colDesc, y + 5);
        doc.setCharSpace(0);
        doc.setFontSize(8.8);
        doc.setTextColor(...C.white);
        doc.text(String(totalQty), colQtyRight, y + 5.1);
        y += 14;
    }

    // ── ringkasan biaya ─────────────────────────────────────────────────────
    const hasHours = log.estimatedHours || log.actualHours;
    if (log.Downtime || log.Cost || hasHours) {
        ensure(22);
        doc.setFillColor(...C.goldSoft);
        doc.roundedRect(M, y, CW, 17, 1.8, 1.8, 'F');
        doc.setFillColor(...C.gold);
        doc.rect(M, y, 1.4, 17, 'F');

        const cells = [{ key: 'Downtime', value: log.Downtime ? num(log.Downtime) + ' hrs' : '—' }];
        if (hasHours) {
            cells.push({ key: 'Est. Hours', value: log.estimatedHours ? num(log.estimatedHours) + ' h' : '—' });
            cells.push({ key: 'Actual Hours', value: log.actualHours ? num(log.actualHours) + ' h' : '—' });
        }
        cells.push({ key: 'Total Cost', value: formatCurrency(log.Cost), accent: true });

        const w = CW / cells.length;
        cells.forEach((cell, i) => {
            const x = M + 9 + i * w;
            label(cell.key, x, y + 5.6, C.slate, 5.8);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(cell.accent ? 13.4 : 10.6);
            ink();
            doc.text(cell.value, x, y + 12.4);
            if (cell.accent) hairline(x, x + doc.getTextWidth(cell.value), y + 13.6, C.gold, 0.6);
        });
        y += 23;
    }

    // ── tanda tangan ────────────────────────────────────────────────────────
    ensure(32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...C.mute);
    doc.text('Valid only with original signatures.', M, y);
    y += 5;

    const sigW = (CW - 12) / 3;
    ['Requested By', 'Approved By', 'Executed By'].forEach((title, i) => {
        const x = M + i * (sigW + 6);
        label(title, x, y, C.ink2, 6.2);
        hairline(x, x + sigW, y + 14, C.ink, 0.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...C.slate);
        doc.text('Name / Position', x, y + 18);
        doc.text('Date & Time', x, y + 21.5);
    });

    // ── footer semua halaman ────────────────────────────────────────────────
    const total = doc.getNumberOfPages();
    const now = new Date();
    const stamp = formatDate(now.toISOString().slice(0, 10)) + ' · ' + now.toTimeString().slice(0, 5);
    for (let page = 1; page <= total; page++) {
        doc.setPage(page);
        hairline(M, PW - M, PH - 16, C.line, 0.25);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...C.slate);
        doc.text('MTC System v2.0  ·  Form MTC-WO-01  ·  Printed ' + stamp + '  ·  ' + woNumber, M, PH - 11);
        doc.text('Page ' + page + ' of ' + total, PW - M, PH - 11, { align: 'right' });
        doc.setFont('helvetica', 'normal');
    }

    doc.save('WorkOrder_' + (log.woNumber || 'DRAFT') + '.pdf');
}
