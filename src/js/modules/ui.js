// @ts-check
import { logger } from '../logger.js';
/** @typedef {import('../appstate').AppState} AppState */
/**
 * UI & Utility module for MTC.NEXUS
 */
// Lazy-load qrcode (only used for QR modal — keeps it out of initial bundle)
import { CONSTANTS } from '../constants';
import { uiCore, readThemeMode } from './ui-core.js';
import { askConfirm } from './confirm-dialog.js';

// Cloudinary unsigned uploads. An unsigned preset is *designed* to be used from the
// browser, so there is no API secret anywhere in the client — nothing to leak, nothing
// to revoke. Hardcoded on purpose: VITE_* vars are inlined into the bundle anyway, so an
// env var here would add indirection without adding safety.
// Fill these from the Cloudinary dashboard (Settings → Upload → Upload presets).
const CLOUDINARY_CLOUD = 'g3lkh1pu';
const CLOUDINARY_PRESET = 'mtc-asset-unsigned';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

/**
 * Tema tersimpan, dengan migrasi kunci lama `darkMode` → `themeMode`.
 * Satu sumber untuk `app()` dan layar login — layar login hidup di chunk eager
 * dan tidak boleh mengimpor `app.js` hanya untuk membaca satu nilai localStorage.
 * @returns {'night'|'navy'|'purple'|'light'|string}
 */
export { readThemeMode };

/**
 * QR aset + badge tengah "MTC" — dipakai modal preview dan unduhan PNG.
 *
 * `errorCorrectionLevel: 'H'` (30 % redundansi) yang membuat badge tengah aman:
 * badge menutup ±3 % luas, jauh di bawah batas toleransi, jadi scanner murah
 * tetap membaca. Kalau canvas tidak tersedia (jsdom, WebView aneh), fungsi ini
 * mengembalikan QR polos — bukan melempar, karena QR polos tetap berfungsi.
 * @param {string} text
 * @returns {Promise<string>} data URL PNG
 */
async function buildAssetTagImage(text) {
    const QRCode = (await import('qrcode')).default;
    const plain = await QRCode.toDataURL(text, {
        width: 640,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#0F172A', light: '#FFFFFF' },
    });
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        if (!ctx) return plain;

        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = plain;
        });
        ctx.drawImage(img, 0, 0, 640, 640);

        // Badge tengah: plat putih dengan radius yang sama dengan bingkai kartu,
        // plus cincin putih 8 px supaya quiet zone QR di sekelilingnya tetap utuh.
        // Radius cincin = 1 modul QR (±24 px pada 640 px untuk payload pendek):
        // tanpa halo selebar satu modul, badge terbaca "ditempel" dan beberapa
        // scanner kehilangan sinkronisasi walau ECC H.
        const size = 108;
        const x = (640 - size) / 2;
        const y = (640 - size) / 2;
        const r = 26;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2 + 24, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + size, y, x + size, y + size, r);
        ctx.arcTo(x + size, y + size, x, y + size, r);
        ctx.arcTo(x, y + size, x, y, r);
        ctx.arcTo(x, y, x + size, y, r);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#BF9B5A';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 36px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MTC', 320, 322);
        return canvas.toDataURL('image/png');
    } catch {
        return plain;
    }
}

export const uiModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    // QR scanner: nilai input "Manual ID Entry" (fallback tanpa kamera)
    manualScanId: '',
    // Dashboard 'Tactical Slate': filter WO di Maintenance Activity Protocol + drawer MTC AI
    dashWoFilter: '',
    aiDrawerOpen: false,

    ...uiCore,

    // QR Scanner
    async openQR() {
        this.showScanner = true;
        this.manualScanId = '';
        this.$nextTick(async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                this.html5QrCode = new Html5Qrcode("reader");
                const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                await this.html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (/** @type {string} */ decodedText) => this.handleScanResult(decodedText),
                    (/** @type {string} */ _errorMessage) => { }
                );
            } catch (err) {
                console.error('QR Scanner Error:', err);
                this.showNotification("Failed to access camera", "error");
                this.showScanner = false;
            }
        });
    },

    /**
     * Titik masuk tunggal untuk hasil pembacaan kode: dipakai oleh stream kamera
     * html5-qrcode maupun oleh entri ID manual. Menutup scanner lalu membuka unit
     * yang cocok, atau memberi notifikasi error bila tidak ada di database.
     *
     * @param {string} decodedText - Isi QR / ID yang diketik operator.
     */
    handleScanResult(decodedText) {
        const cleanId = String(decodedText || '').trim().toUpperCase();
        this.stopScanner();
        if (!cleanId) return;
        const e = (this.equipment || []).find(x => String(x.EquipmentID).toUpperCase() === cleanId);
        if (e) {
            this.goToDetail(e.EquipmentID);
            this.showNotification("Asset Found: " + e.Nama);
        } else {
            this.showNotification("QR Scanned: " + cleanId + " (Not found in database)", "error");
        }
    },

    /**
     * Fallback tanpa kamera (izin ditolak / unit tanpa lensa): operator mengetik
     * Equipment ID langsung. Memakai jalur hasil yang sama dengan scanner optik.
     */
    submitManualScan() {
        const id = String(this.manualScanId || '').trim();
        if (!id) return;
        this.handleScanResult(id);
        this.manualScanId = '';
    },

    async stopScanner() {
        if (this.html5QrCode) {
            try {
                await this.html5QrCode.stop();
                this.html5QrCode = null;
            } catch (e) {
                console.warn('Stop Scanner:', e);
            }
        }
        this.showScanner = false;
    },

    async generateQR(id) {
        this.isLoading = true;
        try {
            this.qrCodeDataUrl = await buildAssetTagImage(id);
            this.showQRPreviewModal = true;
        } catch (err) {
            console.error('QR Generation Error:', err);
            this.showNotification("Failed to generate QR Code", "error");
        } finally {
            this.isLoading = false;
        }
    },

    downloadQR() {
        if (!this.qrCodeDataUrl) return;
        const link = document.createElement('a');
        link.download = `QR_${this.selectedEquip?.EquipmentID || 'asset'}.png`;
        link.href = this.qrCodeDataUrl;
        link.click();
    },

    // Bulk: generate QR for ALL equipment → single PDF (A4 grid 3×5)
    async downloadAllQRs() {
        const list = this.equipment || [];
        if (!list.length) {
            this.showNotification('No equipment to export', 'error');
            return;
        }
        this.isLoading = true;
        try {
            const QRCode = (await import('qrcode')).default;
            const { jsPDF } = await import('jspdf');

            const doc = new jsPDF('l', 'mm', 'a4'); // landscape: 297×210mm
            const cols = 3, rows = 5, perPage = cols * rows;
            const cellW = 297 / cols, cellH = 210 / rows;
            let idx = 0;

            for (const eq of list) {
                const id = eq.EquipmentID || '-1';
                const name = (eq.Nama || id).substring(0, 24);
                const qr = await QRCode.toDataURL(id, { width: 240, margin: 1, color: { dark: '#0B0F1A', light: '#FFFFFF' } });

                const col = idx % cols, row = Math.floor(idx / cols) % rows;
                const x0 = col * cellW + 7;
                const y0 = row * cellH + 5;
                const tagW = cellW - 14;
                const tagH = cellH - 10;
                const qrSize = 16;

                // Kartu tag: bingkai emas tipis + QR + "SCAN ME" + identitas aset.
                // Label polos tanpa bingkai tidak bisa dipotong rapi dan terbaca
                // seperti stiker sementara, bukan penanda aset.
                doc.setDrawColor(191, 155, 90);
                doc.setLineWidth(0.3);
                doc.roundedRect(x0, y0, tagW, tagH, 3, 3, 'S');

                doc.addImage(qr, 'PNG', x0 + (tagW - qrSize) / 2, y0 + 3, qrSize, qrSize);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(5.4);
                doc.setTextColor(191, 155, 90);
                doc.text('SCAN ME', x0 + tagW / 2, y0 + 22, { align: 'center' });

                doc.setFontSize(7.4);
                doc.setTextColor(15, 23, 42);
                doc.text(id, x0 + tagW / 2, y0 + 26, { align: 'center' });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5.6);
                doc.setTextColor(100, 116, 139);
                doc.text(name, x0 + tagW / 2, y0 + 29.5, { align: 'center' });

                idx++;
                if (idx % perPage === 0 && idx < list.length) {
                    doc.addPage();
                }
            }

            doc.save(`QR_All_Equipment_${new Date().toISOString().split('T')[0]}.pdf`);
            this.showNotification(`Exported ${list.length} QR codes`);
        } catch (err) {
            console.error('Bulk QR Export Error:', err);
            this.showNotification('Failed to export QR PDF: ' + (/** @type {any} */ (err).message || 'Unknown error'), 'error');
        } finally {
            this.isLoading = false;
        }
    },

    // Helpers
    statusColor(s) {
        const colors = /** @type {Record<string, string>} */ ({
            'Active': 'text-tac-status-operational border border-tac-status-operational/30 bg-tac-status-operational/10',
            'In Maintenance': 'text-tac-status-repair border border-tac-status-repair/30 bg-tac-status-repair/10',
            'Decommissioned': 'text-tac-status-standby border border-tac-status-standby/30 bg-tac-status-standby/10'
        });
        return colors[s] || 'text-tac-status-emergency border border-tac-status-emergency/30 bg-tac-status-emergency/10';
    },

    critColor(c) {
        return c === 'High' ? 'text-tac-status-emergency font-bold' : c === 'Medium' ? 'text-tac-status-repair' : 'text-tac-status-operational';
    },

    logColor(type) {
        const colors = /** @type {Record<string, string>} */ ({
            'PM': 'border-tac-status-operational',
            'Repair': 'border-tac-sync-cyan',
            'Inspection': 'border-tac-status-repair',
            'Breakdown': 'border-tac-status-emergency'
        });
        return colors[type] || 'border-tac-sync-cyan';
    },

    logStatusColor(status) {
        const colors = /** @type {Record<string, string>} */ ({
            'Completed': 'border-tac-status-operational/20 text-tac-status-operational bg-tac-status-operational/5',
            'In Progress': 'border-tac-sync-cyan/20 text-tac-sync-cyan bg-tac-sync-cyan/5',
            'Pending': 'border-tac-status-repair/20 text-tac-status-repair bg-tac-status-repair/5',
            'Cancelled': 'border-tac-status-standby/20 text-tac-status-standby bg-tac-status-standby/5',
            'Approved': 'border-tac-status-operational/20 text-tac-status-operational bg-tac-status-operational/5',
            'Draft': 'border-tac-border-tactical text-tac-on-surface-variant bg-tac-surface-container-low'
        });
        return colors[status] || 'border-tac-status-operational/20 text-tac-status-operational bg-tac-status-operational/5';
    },

    woPriorityColor(priority) {
        const colors = /** @type {Record<string, string>} */ ({
            'Emergency': 'border-tac-status-emergency/20 text-tac-status-emergency bg-tac-status-emergency/10',
            'Urgent': 'border-tac-status-repair/20 text-tac-status-repair bg-tac-status-repair/10',
            'Normal': 'border-tac-sync-cyan/20 text-tac-sync-cyan bg-tac-sync-cyan/10',
            'Planned': 'border-tac-status-operational/20 text-tac-status-operational bg-tac-status-operational/10'
        });
        return colors[priority] || 'border-tac-status-standby/20 text-tac-status-standby';
    },

    getStatColor(c) {
        const mapping = /** @type {Record<string, string>} */ ({
            'border-tac-status-operational': 'rgb(var(--tac-status-operational))',
            'border-tac-status-repair': 'rgb(var(--tac-status-repair))',
            'border-tac-status-emergency': 'rgb(var(--tac-status-emergency))',
            'border-tac-status-standby': 'rgb(var(--tac-status-standby))',
            'border-tac-sync-cyan': 'rgb(var(--tac-sync-cyan))',
            'border-tac-secondary': 'rgb(var(--tac-secondary))',
        });
        return mapping[c] || 'rgb(var(--tac-gold-bright))';
    },

    // Image Compression Helper
    async compressImage(file) {
        if (!file || file.size === 0) return null;
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = /** @type {string} */ (/** @type {any} */ (event.target).result);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    const max = CONSTANTS.MAX_IMAGE_SIZE || 800;
                    if (w > h) {
                        if (w > max) { h *= max / w; w = max; }
                    } else {
                        if (h > max) { w *= max / h; h = max; }
                    }
                    canvas.width = w; canvas.height = h;
                    /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', CONSTANTS.IMAGE_QUALITY || 0.7);
                };
                img.onerror = () => resolve(null);
            };
            reader.onerror = () => resolve(null);
        });
    },

    // POST a base64 image to Cloudinary via an unsigned preset. Returns the hosted URL, or null on failure.
    async uploadBase64Image(base64) {
        if (!base64) return null;
        if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
            console.error('[Cloudinary] CLOUDINARY_CLOUD / CLOUDINARY_PRESET not configured (src/js/modules/ui.js)');
            return null;
        }
        try {
            const form = new FormData();
            form.append('file', base64);
            form.append('upload_preset', CLOUDINARY_PRESET);
            // No public_id on purpose: the preset already sets the Asset folder and
            // auto-generates an unguessable ID. Sending our own risks doubling the
            // folder prefix (mtc-asset/mtc-asset/...) and can collide on re-uploads.
            const r = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: form });
            const j = await r.json();
            if (!r.ok) {
                console.warn('[Cloudinary] upload failed:', j?.error?.message || `HTTP ${r.status}`);
                return null;
            }
            return j.secure_url || null;
        } catch (e) {
            console.warn('[Cloudinary] network error:', /** @type {any} */ (e).message);
            return null;
        }
    },

    // Compress a File, then upload it to Cloudinary. Returns the hosted URL, or null.
    async uploadImage(file) {
        if (!file) return null;

        try {
            this.showNotification('Uploading image...', 'info');
            logger.debug('Starting image upload, file:', file.name, file.size);

            const compressed = await this.compressImage(file);
            logger.debug('Compression result:', compressed ? compressed.size : 'failed');
            if (!compressed) {
                this.showNotification('Image compression failed', 'error');
                return null;
            }

            const base64 = await this.blobToBase64(compressed);
            const url = await this.uploadBase64Image(base64);
            if (url) {
                logger.debug('Image uploaded to Cloudinary:', url);
                this.showNotification('Image uploaded successfully', 'success');
                return url;
            }

            // No base64 fallback: writing image bytes into the DB bloats every client's sync
            // and the record itself. Fail loudly instead — the caller keeps the previous image.
            this.showNotification('Image upload failed — coba lagi', 'error');
            return null;

        } catch (e) {
            console.error('Image Upload Error:', e);
            this.showNotification('Image upload failed - will save without image', 'warning');
            return null;
        }
    },
    
    async blobToBase64(blob) {
        if (!blob) return '';
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    },

    async systemReset() {
        if (!(await askConfirm(
            'Cache aplikasi, service worker, dan sesi login akan dihapus, lalu halaman dimuat ulang. Pakai ini kalau data tidak sinkron atau aplikasi terasa lambat.',
            { title: 'Deep reset aplikasi', confirmLabel: 'Reset sekarang', tone: 'danger' }
        ))) return;
        
        this.isLoading = true;
        try {
            // Clear Storage
            localStorage.clear();
            sessionStorage.clear();

            // Unregister Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }

            // Clear Cache Storage
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }

            this.showNotification("System purged. Reloading...", "info");
            setTimeout(() => /** @type {any} */ (window.location).reload(true), 1500);
        } catch (e) {
            console.error('System Reset Error:', e);
            /** @type {any} */ (window.location).reload(true);
        }
    }
});
