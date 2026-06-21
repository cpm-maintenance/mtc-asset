/**
 * UI & Utility module for MTC.NEXUS
 */
import QRCode from 'qrcode';
import { CONSTANTS } from '../constants.js';

export const uiModule = {
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
        this.applyTheme();
    },

    applyTheme() {
        const theme = this.darkMode ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        if (this.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },

    showNotification(message, type = 'success') {
        const id = Date.now();
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        const colors = {
            success: 'border-emerald-500 bg-emerald-500/20 text-emerald-400',
            error: 'border-rose-500 bg-rose-500/20 text-rose-400',
            warning: 'border-amber-500 bg-amber-500/20 text-amber-400',
            info: 'border-blue-500 bg-blue-500/20 text-blue-400'
        };
        this.notifications.push({ id, message, type, icon: icons[type], color: colors[type] });
        
        // Auto remove with animation
        setTimeout(() => {
            const notif = this.notifications.find(n => n.id === id);
            if (notif) {
                notif.exiting = true;
                setTimeout(() => {
                    this.notifications = this.notifications.filter(n => n.id !== id);
                }, 300);
            }
        }, 4000);
    },

    // QR Scanner
    async openQR() {
        this.showScanner = true;
        this.$nextTick(async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                this.html5QrCode = new Html5Qrcode("reader");
                const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                await this.html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        this.stopScanner();
                        const cleanId = decodedText.trim().toUpperCase();
                        const e = this.equipment.find(x => String(x.EquipmentID).toUpperCase() === cleanId);
                        if (e) {
                            this.goToDetail(e.EquipmentID);
                            this.showNotification("Asset Found: " + e.Nama);
                        } else {
                            this.showNotification("QR Scanned: " + cleanId + " (Not found in database)", "error");
                        }
                    },
                    (errorMessage) => { }
                );
            } catch (err) {
                console.error('QR Scanner Error:', err);
                this.showNotification("Failed to access camera", "error");
                this.showScanner = false;
            }
        });
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

    // Helpers
    statusColor(s) {
        const colors = {
            'Active': 'text-emerald-400 border border-emerald-500/30 bg-emerald-500/10',
            'In Maintenance': 'text-amber-400 border border-amber-500/30 bg-amber-500/10',
            'Decommissioned': 'text-slate-400 border border-slate-500/30 bg-slate-500/10'
        };
        return colors[s] || 'text-rose-400 border border-rose-500/30 bg-rose-500/10';
    },

    critColor(c) {
        return c === 'High' ? 'text-rose-400 font-bold' : c === 'Medium' ? 'text-amber-400' : 'text-emerald-400';
    },

    logColor(type) {
        const colors = {
            'PM': 'border-green-500',
            'Repair': 'border-blue-500',
            'Inspection': 'border-yellow-500',
            'Breakdown': 'border-red-500'
        };
        return colors[type] || 'border-blue-500';
    },

    logStatusColor(status) {
        const colors = {
            'Completed': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
            'In Progress': 'border-blue-500/20 text-blue-400 bg-blue-500/5',
            'Pending': 'border-amber-500/20 text-amber-400 bg-amber-500/5',
            'Cancelled': 'border-slate-500/20 text-slate-400 bg-slate-500/5',
            'Approved': 'border-cyan-500/20 text-cyan-400 bg-cyan-500/5',
            'Draft': 'border-purple-500/20 text-purple-400 bg-purple-500/5'
        };
        return colors[status] || 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5';
    },

    woPriorityColor(priority) {
        const colors = {
            'Emergency': 'border-rose-500/20 text-rose-400 bg-rose-500/10',
            'Urgent': 'border-orange-500/20 text-orange-400 bg-orange-500/10',
            'Normal': 'border-amber-500/20 text-amber-400 bg-amber-500/10',
            'Planned': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'
        };
        return colors[priority] || 'border-slate-500/20 text-slate-400';
    },

    getStatColor(c) {
        const mapping = {
            'border-blue-500': '#3B82F6',
            'border-red-500': '#EF4444',
            'border-yellow-500': '#F59E0B',
            'border-green-500': '#10B981'
        };
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
                img.src = event.target.result;
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
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', CONSTANTS.IMAGE_QUALITY || 0.7);
                };
                img.onerror = () => resolve(null);
            };
            reader.onerror = () => resolve(null);
        });
    },

    // Upload image - store directly in Firebase Database (no external storage needed)
    async uploadToImgBB(file) {
        if (!file) return null;
        
        try {
            this.showNotification('Uploading image...', 'info');
            console.log('Starting image upload, file:', file.name, file.size);
            
            const compressed = await this.compressImage(file);
            console.log('Compression result:', compressed ? compressed.size : 'failed');
            if (!compressed) {
                this.showNotification('Image compression failed', 'error');
                return null;
            }
            
            // Convert to base64
            const base64 = await this.blobToBase64(compressed);
            const dataUrl = `data:${compressed.type || 'image/jpeg'};base64,${base64.split(',')[1]}`;
            
            // Store directly in Firebase Database
            const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const truncatedData = dataUrl.substring(0, 400000); // Limit size for Firebase
            
            await window.set(window.ref(window.db, `ImageUploads/${imageId}`), {
                data: truncatedData,
                type: compressed.type || 'image/jpeg',
                created: Date.now()
            });
            
            console.log('Image saved to Firebase Database');
            this.showNotification('Image uploaded successfully', 'success');
            
            // Return as data URL so it can be displayed immediately
            return truncatedData;
            
        } catch (e) {
            console.error('Image Upload Error:', e);
            this.showNotification('Image upload failed - will save without image', 'warning');
            return null;
        }
    },
    
    // Fallback: convert to data URL and store in Firebase Database
    async uploadAsDataURL(file) {
        try {
            const compressed = await this.compressImage(file);
            if (!compressed) return null;
            
            const base64 = await this.blobToBase64(compressed);
            // Store as data URL format
            const dataUrl = `data:${compressed.type || 'image/jpeg'};base64,${base64.split(',')[1]}`;
            
            // Save to Firebase Database under a special node
            const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await window.set(window.ref(window.db, `ImageUploads/${imageId}`), {
                data: dataUrl.substring(0, 500000), // limit size
                created: Date.now()
            });
            
            this.showNotification('Image uploaded (database mode)', 'success');
            return dataUrl;
        } catch (e) {
            console.error('DataURL upload error:', e);
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
            setTimeout(() => window.location.reload(true), 1500);
        } catch (e) {
            console.error('System Reset Error:', e);
            window.location.reload(true);
        }
    }
};
