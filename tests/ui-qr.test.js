// @vitest-environment jsdom
/**
 * Tests untuk fitur QR (P3-5):
 *  - generateQR  → data URL + modal preview
 *  - downloadQR  → unduh PNG
 *  - downloadAllQRs → PDF QR sheet A4 landscape grid 3×5 untuk semua equipment
 *
 * `qrcode` & `jspdf` di-mock karena keduanya di-import dinamis (lazy) dan
 * menghasilkan output biner yang tidak perlu diuji di sini.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock dynamic imports ---
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (text) => `data:image/png;base64,MOCK:${text}`),
  },
}));

const pdfCalls = { addImage: [], addPage: 0, save: [], text: [], frame: [] };
const h2c = vi.hoisted(() => ({
  fn: vi.fn(async () => ({ toDataURL: () => 'data:image/png;base64,CARD' })),
}));
vi.mock('html2canvas', () => ({ default: h2c.fn }));

vi.mock('jspdf', () => ({
  jsPDF: class {
    addImage(...args) { pdfCalls.addImage.push(args); }
    addPage() { pdfCalls.addPage++; }
    save(name) { pdfCalls.save.push(name); }
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setFont() {}
    roundedRect(...args) { pdfCalls.frame.push(args); }
    text(...args) { pdfCalls.text.push(args); }
  },
}));

import { uiModule } from '../src/js/modules/ui.js';

function makeCtx(overrides = {}) {
  return Object.assign(
    {
      equipment: [],
      selectedEquip: null,
      isLoading: false,
      qrCodeDataUrl: '',
      showQRPreviewModal: false,
      showNotification: vi.fn(),
    },
    overrides
  );
}

beforeEach(() => {
  pdfCalls.addImage.length = 0;
  pdfCalls.text.length = 0;
  pdfCalls.save.length = 0;
  pdfCalls.frame.length = 0;
  pdfCalls.addPage = 0;
});

describe('QR — generateQR / downloadQR', () => {
  it('generateQR menghasilkan data URL dan membuka modal preview', async () => {
    const ctx = makeCtx();
    await uiModule.generateQR.call(ctx, 'EQ-123');
    expect(ctx.qrCodeDataUrl).toContain('equip=EQ-123');
    expect(ctx.showQRPreviewModal).toBe(true);
    expect(ctx.isLoading).toBe(false);
  });

  it('downloadQR tidak error jika belum ada QR', () => {
    const ctx = makeCtx({ qrCodeDataUrl: '' });
    expect(() => uiModule.downloadQR.call(ctx)).not.toThrow();
  });

  it('downloadQR tanpa kartu: jatuh ke PNG QR', async () => {
    const ctx = makeCtx({ qrCodeDataUrl: 'data:image/png;base64,X', selectedEquip: { EquipmentID: 'EQ-1' } });
    const clicks = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function () {
        clicks.push(this.download);
      });
    await uiModule.downloadQR.call(ctx);
    expect(clicks).toEqual(['QR_EQ-1.png']);
    clickSpy.mockRestore();
  });

  it('downloadQR memotret kartu tag utuh (bukan QR telanjang)', async () => {
    document.body.innerHTML = '<div data-testid="asset-tag"><img src="data:image/png;base64,QR"></div>';
    const ctx = makeCtx({ qrCodeDataUrl: 'data:image/png;base64,QR', selectedEquip: { EquipmentID: 'EQ-7' } });
    const clicks = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function () {
        clicks.push({ name: this.download, href: this.href });
      });

    await uiModule.downloadQR.call(ctx);

    expect(h2c.fn).toHaveBeenCalled();
    expect(clicks[0].name).toBe('TAG_EQ-7.png');
    expect(clicks[0].href).toContain('base64,CARD');
    clickSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('html2canvas gagal → tetap mengunduh QR, tidak melempar', async () => {
    document.body.innerHTML = '<div data-testid="asset-tag"></div>';
    h2c.fn.mockRejectedValueOnce(new Error('boom'));
    const ctx = makeCtx({ qrCodeDataUrl: 'data:image/png;base64,QR', selectedEquip: { EquipmentID: 'EQ-9' } });
    const clicks = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function () {
        clicks.push(this.download);
      });

    await expect(uiModule.downloadQR.call(ctx)).resolves.toBeUndefined();
    expect(clicks).toEqual(['QR_EQ-9.png']);
    clickSpy.mockRestore();
    document.body.innerHTML = '';
  });
});

describe('QR — downloadAllQRs (bulk PDF)', () => {
  it('menolak saat tidak ada equipment', async () => {
    const ctx = makeCtx({ equipment: [] });
    await uiModule.downloadAllQRs.call(ctx);
    expect(ctx.showNotification).toHaveBeenCalledWith('No equipment to export', 'error');
    expect(pdfCalls.save).toHaveLength(0);
  });

  it('membuat PDF dengan 1 gambar QR per equipment', async () => {
    const ctx = makeCtx({
      equipment: [
        { EquipmentID: 'EQ-1', Nama: 'Crusher' },
        { EquipmentID: 'EQ-2', Nama: 'Conveyor' },
        { EquipmentID: 'EQ-3', Nama: 'Pump' },
      ],
    });
    await uiModule.downloadAllQRs.call(ctx);
    expect(pdfCalls.addImage).toHaveLength(3);
    expect(pdfCalls.save).toHaveLength(1);
    expect(pdfCalls.save[0]).toMatch(/^QR_All_Equipment_/);
    expect(ctx.showNotification).toHaveBeenCalledWith('Exported 3 QR codes');

    // Setiap label = kartu tag: bingkai emas + kata "SCAN ME" + ID aset.
    expect(pdfCalls.frame).toHaveLength(3);
    const labels = pdfCalls.text.map((c) => c[0]);
    expect(labels.filter((t) => t === 'SCAN ME')).toHaveLength(3);
    expect(labels).toEqual(expect.arrayContaining(['EQ-1', 'CRUSHER']));
  });

  it('menambah halaman baru setiap kelipatan 15 label (grid 3×5)', async () => {
    const equipment = Array.from({ length: 16 }, (_, i) => ({ EquipmentID: `EQ-${i}`, Nama: `N${i}` }));
    const ctx = makeCtx({ equipment });
    await uiModule.downloadAllQRs.call(ctx);
    // 16 item → 1 kali addPage (setelah item ke-15)
    expect(pdfCalls.addPage).toBe(1);
    expect(pdfCalls.addImage).toHaveLength(16);
  });

  it('tidak menambah halaman saat tepat 15 item', async () => {
    const equipment = Array.from({ length: 15 }, (_, i) => ({ EquipmentID: `EQ-${i}` }));
    const ctx = makeCtx({ equipment });
    await uiModule.downloadAllQRs.call(ctx);
    expect(pdfCalls.addPage).toBe(0);
    expect(pdfCalls.addImage).toHaveLength(15);
  });

  it('menangani error QR dengan notifikasi error', async () => {
    const QRCode = (await import('qrcode')).default;
    const spy = vi.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(new Error('boom'));
    const ctx = makeCtx({ equipment: [{ EquipmentID: 'EQ-1' }] });
    await uiModule.downloadAllQRs.call(ctx);
    expect(ctx.showNotification).toHaveBeenCalledWith(expect.stringContaining('Failed to export QR PDF'), 'error');
    expect(ctx.isLoading).toBe(false);
    spy.mockRestore();
  });
});

describe('QR — handleScanResult / submitManualScan (S-5 scanner wiring)', () => {
  function scannerCtx(equipment = []) {
    return Object.assign(makeCtx({ equipment }), {
      goToDetail: vi.fn(),
      stopScanner: vi.fn(),
      manualScanId: '',
      // submitManualScan memanggil method saudaranya di app object yang sama;
      // di unit test objek context dibuat manual, jadi harus di-bind eksplisit.
      handleScanResult: uiModule.handleScanResult,
    });
  }

  it('handleScanResult menutup scanner, membuka unit, dan menotifikasi nama unit', () => {
    const ctx = scannerCtx([{ EquipmentID: 'EX-001', Nama: 'Hydraulic Press' }]);
    uiModule.handleScanResult.call(ctx, 'EX-001');
    expect(ctx.stopScanner).toHaveBeenCalled();
    expect(ctx.goToDetail).toHaveBeenCalledWith('EX-001');
    expect(ctx.showNotification).toHaveBeenCalledWith('Asset Found: Hydraulic Press');
  });

  it('handleScanResult menormalisasi spasi & huruf kecil dari hasil decode', () => {
    const ctx = scannerCtx([{ EquipmentID: 'EX-001', Nama: 'Pump' }]);
    uiModule.handleScanResult.call(ctx, '  ex-001 \n');
    expect(ctx.goToDetail).toHaveBeenCalledWith('EX-001');
  });

  it('handleScanResult memberi error bila ID tidak ada di registry', () => {
    const ctx = scannerCtx([{ EquipmentID: 'EX-001' }]);
    uiModule.handleScanResult.call(ctx, 'NOPE-9');
    expect(ctx.goToDetail).not.toHaveBeenCalled();
    expect(ctx.showNotification).toHaveBeenCalledWith(
      'QR Scanned: NOPE-9 (Not found in database)',
      'error'
    );
  });

  it('handleScanResult mengabaikan input kosong (tetap menutup scanner)', () => {
    const ctx = scannerCtx([{ EquipmentID: 'EX-001' }]);
    uiModule.handleScanResult.call(ctx, '   ');
    expect(ctx.showNotification).not.toHaveBeenCalled();
    expect(ctx.goToDetail).not.toHaveBeenCalled();
  });

  it('submitManualScan memakai jalur hasil yang sama lalu mengosongkan input', () => {
    const ctx = scannerCtx([{ EquipmentID: 'EX-002', Nama: 'Conveyor' }]);
    ctx.manualScanId = 'ex-002';
    uiModule.submitManualScan.call(ctx);
    expect(ctx.goToDetail).toHaveBeenCalledWith('EX-002');
    expect(ctx.manualScanId).toBe('');
  });

  it('submitManualScan tidak melakukan apa pun saat input kosong', () => {
    const ctx = scannerCtx([{ EquipmentID: 'EX-002' }]);
    ctx.manualScanId = '  ';
    uiModule.submitManualScan.call(ctx);
    expect(ctx.stopScanner).not.toHaveBeenCalled();
    expect(ctx.showNotification).not.toHaveBeenCalled();
  });
});

describe('QR — printTag (cetak hanya kartu)', () => {
  const DATA = 'data:image/png;base64,QR';

  function mountCard() {
    document.body.innerHTML = `
      <div data-testid="asset-tag" :class="x" x-show="open">
        <img :src="qrCodeDataUrl" src="${DATA}" alt="Asset QR code">
        <p x-text="selectedEquip?.Nama">POMPA</p>
      </div>`;
    return document.querySelector('[data-testid="asset-tag"]');
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    window.print = vi.fn();
  });

  it('tanpa kartu: langsung mencetak, tanpa #print-root', () => {
    uiModule.printTag.call(makeCtx());
    expect(window.print).toHaveBeenCalled();
    expect(document.getElementById('print-root')).toBeNull();
  });

  it('mengkloning kartu ke #print-root dan membuang binding Alpine', () => {
    mountCard();
    uiModule.printTag.call(makeCtx());

    const root = document.getElementById('print-root');
    expect(root).not.toBeNull();
    const clone = root.querySelector('[data-testid="asset-tag"]');
    expect(clone).not.toBeNull();
    // Binding Alpine tidak boleh ikut: klon tidak punya scope.
    expect(clone.hasAttribute(':class')).toBe(false);
    expect(clone.hasAttribute('x-show')).toBe(false);
    expect(clone.querySelector('img').hasAttribute(':src')).toBe(false);
    // …tapi gambarnya harus tetap punya src.
    expect(clone.querySelector('img').getAttribute('src')).toBe(DATA);
    expect(window.print).toHaveBeenCalled();
  });

  it('afterprint membersihkan #print-root', () => {
    mountCard();
    uiModule.printTag.call(makeCtx());
    expect(document.getElementById('print-root')).not.toBeNull();

    window.dispatchEvent(new Event('afterprint'));
    expect(document.getElementById('print-root')).toBeNull();
  });
});
