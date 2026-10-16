// @ts-check
import { logger } from '../logger.js';
/** @typedef {import('../appstate').AppState} AppState */
/**
 * UI & Utility module for MTC.NEXUS
 */
// Lazy-load qrcode (only used for QR modal — keeps it out of initial bundle)
import { CONSTANTS } from '../constants';

// Cloudinary unsigned uploads. An unsigned preset is *designed* to be used from the
// browser, so there is no API secret anywhere in the client — nothing to leak, nothing
// to revoke. Hardcoded on purpose: VITE_* vars are inlined into the bundle anyway, so an
// env var here would add indirection without adding safety.
// Fill these from the Cloudinary dashboard (Settings → Upload → Upload presets).
const CLOUDINARY_CLOUD = 'g3lkh1pu';
const CLOUDINARY_PRESET = 'mtc-asset-unsigned';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

export const uiModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    // QR scanner: nilai input "Manual ID Entry" (fallback tanpa kamera)
    manualScanId: '',
    // Dashboard 'Tactical Slate': filter WO di Maintenance Activity Protocol + drawer MTC AI
    dashWoFilter: '',
    aiDrawerOpen: false,

    setTheme(t) {
        if (!['night', 'navy', 'purple', 'light'].includes(t)) t = 'night';
        this.themeMode = t;
        localStorage.setItem('themeMode', t);
        this.applyTheme();
    },

    applyTheme() {
        const isDark = this.themeMode !== 'light';
        const attr = this.themeMode === 'night' ? 'dark' : this.themeMode;
        document.documentElement.setAttribute('data-theme', attr);
        document.documentElement.classList.toggle('dark', isDark);
        this.darkMode = isDark;
    },

    showNotification(message, type = 'success', duration = 4500) {
        const id = Date.now() + Math.random();
        const config = /** @type {Record<string, any>} */ ({
            success: { icon: 'check_circle', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400', glow: 'shadow-emerald-500/20', bar: 'bg-emerald-400' },
            error: { icon: 'cancel', color: 'border-rose-500/40 bg-rose-500/10 text-rose-400', glow: 'shadow-rose-500/20', bar: 'bg-rose-400' },
            warning: { icon: 'warning', color: 'border-amber-500/40 bg-amber-500/10 text-amber-400', glow: 'shadow-amber-500/20', bar: 'bg-amber-400' },
            info: { icon: 'info', color: 'border-amber-500/40 bg-amber-500/10 text-amber-400', glow: 'shadow-amber-500/20', bar: 'bg-amber-400' },
        });
        const c = config[type] || config.info;
        this.notifications.push({
            id,
            message,
            type,
            icon: c.icon,
            color: c.color,
            bar: c.bar,
            glow: c.glow,
            exiting: false,
            progress: 100,
            _start: Date.now(),
            _duration: duration,
        });

        // Animate progress bar
        const interval = setInterval(() => {
            const n = this.notifications.find(x => x.id === id);
            if (!n || n.exiting) { clearInterval(interval); return; }
            const elapsed = Date.now() - n._start;
            n.progress = Math.max(0, 100 - (elapsed / n._duration) * 100);
        }, 50);

        // Auto remove
        setTimeout(() => {
            clearInterval(interval);
            const n = this.notifications.find(x => x.id === id);
            if (n) {
                n.exiting = true;
                setTimeout(() => {
                    this.notifications = this.notifications.filter(x => x.id !== id);
                }, 400);
            }
        }, duration);
    },

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
                    (/** @type {string} */ errorMessage) => { }
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
            const QRCode = (await import('qrcode')).default;
            const url = await QRCode.toDataURL(id, {
                width: 400,
                margin: 2,
                color: { dark: '#0B0F1A', light: '#FFFFFF' }
            });
            this.qrCodeDataUrl = url;
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
            const qrSize = 36;
            let idx = 0;

            for (const eq of list) {
                const id = eq.EquipmentID || '-1';
                const name = (eq.Nama || id).substring(0, 24);
                const qr = await QRCode.toDataURL(id, { width: 240, margin: 1, color: { dark: '#0B0F1A', light: '#FFFFFF' } });

                const col = idx % cols, row = Math.floor(idx / cols) % rows;
                const cx = col * cellW + cellW / 2, cy = row * cellH + cellH / 2;

                // QR centered slightly above middle
                doc.addImage(qr, 'PNG', cx - qrSize / 2, cy - qrSize / 2, qrSize, qrSize);
                // Label below
                doc.setFontSize(8); doc.setTextColor(30, 30, 30);
                doc.text(id, cx, cy + qrSize / 2 + 4, { align: 'center' });
                doc.setFontSize(6); doc.setTextColor(120, 120, 120);
                doc.text(name, cx, cy + qrSize / 2 + 9, { align: 'center' });

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
            'Active': 'text-emerald-400 border border-emerald-500/30 bg-emerald-500/10',
            'In Maintenance': 'text-amber-400 border border-amber-500/30 bg-amber-500/10',
            'Decommissioned': 'text-slate-400 border border-slate-500/30 bg-slate-500/10'
        });
        return colors[s] || 'text-rose-400 border border-rose-500/30 bg-rose-500/10';
    },

    critColor(c) {
        return c === 'High' ? 'text-rose-400 font-bold' : c === 'Medium' ? 'text-amber-400' : 'text-emerald-400';
    },

    logColor(type) {
        const colors = /** @type {Record<string, string>} */ ({
            'PM': 'border-green-500',
            'Repair': 'border-blue-500',
            'Inspection': 'border-yellow-500',
            'Breakdown': 'border-red-500'
        });
        return colors[type] || 'border-blue-500';
    },

    logStatusColor(status) {
        const colors = /** @type {Record<string, string>} */ ({
            'Completed': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
            'In Progress': 'border-blue-500/20 text-blue-400 bg-blue-500/5',
            'Pending': 'border-amber-500/20 text-amber-400 bg-amber-500/5',
            'Cancelled': 'border-slate-500/20 text-slate-400 bg-slate-500/5',
            'Approved': 'border-teal-500/20 text-teal-400 bg-teal-500/5',
            'Draft': 'border-purple-500/20 text-purple-400 bg-purple-500/5'
        });
        return colors[status] || 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5';
    },

    woPriorityColor(priority) {
        const colors = /** @type {Record<string, string>} */ ({
            'Emergency': 'border-rose-500/20 text-rose-400 bg-rose-500/10',
            'Urgent': 'border-orange-500/20 text-orange-400 bg-orange-500/10',
            'Normal': 'border-amber-500/20 text-amber-400 bg-amber-500/10',
            'Planned': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'
        });
        return colors[priority] || 'border-slate-500/20 text-slate-400';
    },

    getStatColor(c) {
        const mapping = /** @type {Record<string, string>} */ ({
            'border-blue-500': '#3B82F6',
            'border-red-500': '#EF4444',
            'border-yellow-500': '#F59E0B',
            'border-green-500': '#10B981'
        });
        return mapping[c] || '#D4AF37';
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
        if (!confirm("⚠️ CAUTION: This will perform a DEEP RESET of the application cache, unregister service workers, and logout. This resolves sync or performance issues. Proceed?")) return;
        
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
