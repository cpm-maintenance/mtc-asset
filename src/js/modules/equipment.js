/**
 * Equipment management module
 */
import { DEFAULT_EQUIP_FORM } from '../constants.js';
import { validateEquipmentForm, formatDateForInput, withRetry, isNetworkError, sanitizeDataForFirebase } from '../utils.js';

export const equipmentModule = {
    openEquipModal(isEdit = false, data = null) {
        this.isEditingEquip = isEdit;
        if (isEdit && data) {
            this.equipForm = {
                id: data.EquipmentID || '', 
                nama: data.Nama || '', 
                tipe: data.Tipe || 'Crusher',
                lokasi: data.Lokasi || '', 
                status: data.Status || 'Active', 
                sn: data.SerialNumber || '',
                tglInstalasi: data.TglInstalasi || '', 
                vendor: data.Vendor || '', 
                foto: data.FotoURL || '',
                nextPM: formatDateForInput(data.NextPMDate), 
                criticality: data.Criticality || 'Medium'
            };
        } else {
            this.equipForm = DEFAULT_EQUIP_FORM();
        }
        this.showEquipModal = true;
        this.tempEquipFile = null;
    },

    async handleEquipPhoto(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.tempEquipFile = file;
        this.equipForm.foto = URL.createObjectURL(file);
        // Open crop modal
        this.showCropModal(this.equipForm.foto, (croppedBlob) => {
            this.tempEquipFile = croppedBlob;
            this.equipForm.foto = URL.createObjectURL(croppedBlob);
        });
    },

    async submitEquipment() {
        const errors = validateEquipmentForm(this.equipForm);
        if (errors.length > 0) {
            this.showNotification(errors[0], "error");
            return;
        }
        this.isLoading = true;
        try {
            let finalFotoURL = this.equipForm.foto || '';
            if (this.tempEquipFile) {
                console.log('Uploading image file:', this.tempEquipFile.name, this.tempEquipFile.size);
                const imgbbUrl = await this.uploadToImgBB(this.tempEquipFile);
                console.log('ImgBB URL result:', imgbbUrl);
                finalFotoURL = imgbbUrl ? decodeURIComponent(imgbbUrl) : this.equipForm.foto || '';
            }
            console.log('Final FotoURL:', finalFotoURL);
            if (!finalFotoURL || finalFotoURL === 'null') finalFotoURL = '';
            
            const dataToSave = {
                EquipmentID: this.equipForm.id, 
                Nama: this.equipForm.nama, 
                Tipe: this.equipForm.tipe,
                Lokasi: this.equipForm.lokasi, 
                Status: this.equipForm.status, 
                SerialNumber: this.equipForm.sn,
                Criticality: this.equipForm.criticality, 
                NextPMDate: this.equipForm.nextPM,
                TglInstalasi: this.equipForm.tglInstalasi, 
                Vendor: this.equipForm.vendor, 
                FotoURL: finalFotoURL,
                updatedBy: this.user?.uid || 'unknown',
                updatedAt: new Date().toISOString()
            };
            
            // Sanitize data before saving to prevent XSS
            const sanitizedData = sanitizeDataForFirebase(dataToSave);
            
if (!this.isEditingEquip) {
                sanitizedData.createdBy = this.user?.uid || 'unknown';
            } else {
                const existing = this.equipment.find(e => e.EquipmentID === this.equipForm.id);
                if (existing && existing.createdBy) {
                    sanitizedData.createdBy = existing.createdBy;
                }
            }
            
            // If offline, queue the operation
            if (!this.isOnline) {
                const queued = await this.queueOfflineOperation('equipment', sanitizedData);
                if (queued) {
                    // Update local state
                    const idx = this.equipment.findIndex(e => e.EquipmentID === sanitizedData.EquipmentID);
                    if (idx >= 0) {
                        this.equipment[idx] = sanitizedData;
                    } else {
                        this.equipment.push(sanitizedData);
                    }
                    await this.saveToIndexedDB();
                    this.showNotification("Asset saved offline, will sync when online");
                    this.showEquipModal = false;
                    this.isLoading = false;
                    return;
                }
            }
            
            this.isLoading = true;
            await withRetry(async () => {
                await window.set(window.ref(window.db, 'Equipment/' + this.equipForm.id), sanitizedData);
                if (!this.isEditingEquip) {
                    await window.runTransaction(window.ref(window.db, 'Stats/totalEquip'), (curr) => (curr || 0) + 1);
                }
            }, {
                maxRetries: 3,
                delay: 1000,
                backoff: 2,
                onRetry: (attempt, error, delay) => {
                    if (isNetworkError(error)) {
                        this.showNotification("Network error, retrying...", "info");
                    }
                }
            });
            this.showNotification("Asset saved successfully!");
            
            // Add to local array immediately for instant UI update
            const existingIdx = this.equipment.findIndex(e => e.EquipmentID === sanitizedData.EquipmentID);
            if (existingIdx >= 0) {
                this.equipment[existingIdx] = sanitizedData;
            } else {
                this.equipment.unshift(sanitizedData);
            }
            
            // Update selectedEquip with new data if viewing same equipment
            if (this.selectedEquip && this.selectedEquip.EquipmentID === this.equipForm.id) {
                this.selectedEquip = { ...this.selectedEquip, ...sanitizedData };
            }
            
            this.showEquipModal = false;
        } catch (e) {
            console.error('Submit Equipment Error:', e);
            this.showNotification("Error: " + e.message, "error");
        } finally {
            this.isLoading = false;
        }
    },

    goToDetail(id) {
        this.selectedEquip = this.equipment.find(e => e.EquipmentID === id);
        if (this.selectedEquip) {
            this.currentPage = 'detail';
            this.activeTab = 'hist';
            window.scrollTo(0, 0);
        } else {
            this.showNotification("Asset not found in database", "error");
        }
    }
};
