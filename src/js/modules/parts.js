/**
 * Spare parts management module
 */
import { validatePartForm, withRetry, isNetworkError, sanitizeDataForFirebase } from '../utils.js';

export const partsModule = {
openPartModal(isEdit = false, data = null) {
        this.isEditingPart = isEdit;
        this.showPartModal = true;
        
        // Guard - ensure form object exists
        if (!this.partForm) {
            this.partForm = { 
                id: '', nama: '', namaSingkat: '', partNumber: '', equipIds: [], 
                stok: 0, minStock: 0, lokasi: '', vendor: '', harga: 0, foto: '',
                lastReplaceDate: '', avgLifetimeDays: '', usageHours: ''
            };
        }
        
        if (isEdit && data) {
            // Handle legacy single EquipmentID or new EquipmentIDs array
            let equipIds = [];
            if (data.EquipmentIDs) {
                equipIds = Array.isArray(data.EquipmentIDs) ? data.EquipmentIDs : [data.EquipmentIDs];
            } else if (data.EquipmentID) {
                equipIds = [data.EquipmentID];
            }

            this.partForm = {
                id: data?.PartID || '', 
                nama: data?.NamaPart || '', 
                namaSingkat: data?.NamaSingkat || '',
                partNumber: data?.PartNumber || '', 
                equipIds: equipIds || [],
                stok: data?.Stok ?? 0, 
                minStock: data?.MinStock ?? 0,
                lokasi: data?.Lokasi || '',
                vendor: data?.Vendor || '', 
                harga: data?.Harga ?? 0, 
                foto: data?.FotoURL || '',
                lastReplaceDate: data?.lastReplaceDate || '',
                avgLifetimeDays: data?.avgLifetimeDays || '',
                usageHours: data?.usageHours || ''
            };
        } else {
            this.partForm = { 
                id: '', nama: '', namaSingkat: '', partNumber: '', equipIds: [], 
                stok: 0, minStock: 0, lokasi: '', vendor: '', harga: 0, foto: '',
                lastReplaceDate: '', avgLifetimeDays: '', usageHours: ''
            };
        }
    },

    async submitSparePart() {
        // Validate form exists
        if (!this.partForm) {
            this.showNotification("Form not initialized", "error");
            return;
        }

        const errors = validatePartForm(this.partForm);
        if (errors.length > 0) {
            this.showNotification(errors[0], "error");
            return;
        }
        
        if (!this.isAdmin) {
            this.showNotification("Admin access required for this operation", "error");
            return;
        }
        
        this.isLoading = true;
        try {
            const dataToSave = {
                PartID: this.partForm.id || '', 
                NamaPart: this.partForm.nama || '', 
                NamaSingkat: this.partForm.namaSingkat || '',
                PartNumber: this.partForm.partNumber || '', 
                EquipmentIDs: this.partForm.equipIds || [],
                EquipmentID: (this.partForm.equipIds && this.partForm.equipIds.length > 0) ? this.partForm.equipIds[0] : '', 
                Stok: Number(this.partForm.stok) || 0, 
                MinStock: Number(this.partForm.minStock) || 0,
                isLowStock: Number(this.partForm.stok) <= Number(this.partForm.minStock),
                Lokasi: this.partForm.lokasi || '', 
                Vendor: this.partForm.vendor || '', 
                Harga: Number(this.partForm.harga) || 0, 
                FotoURL: this.partForm.foto || '',
                lastReplaceDate: this.partForm.lastReplaceDate || '',
                avgLifetimeDays: this.partForm.avgLifetimeDays || '',
                usageHours: this.partForm.usageHours || '',
                updatedBy: this.user?.uid || 'unknown',
                updatedAt: new Date().toISOString()
            };
            
            // Sanitize data before saving
            const sanitizedData = sanitizeDataForFirebase(dataToSave);
            
            if (!this.isEditingPart) {
                sanitizedData.createdBy = this.user?.uid || 'unknown';
            } else {
                const existing = this.allParts.find(p => p.PartID === this.partForm.id);
                if (existing && existing.createdBy) {
                    sanitizedData.createdBy = existing.createdBy;
                }
            }
            
            // If offline, queue the operation
            if (!this.isOnline) {
                const queued = await this.queueOfflineOperation('parts', sanitizedData);
                if (queued) {
                    const idx = this.allParts.findIndex(p => p.PartID === sanitizedData.PartID);
                    if (idx >= 0) {
                        this.allParts[idx] = sanitizedData;
                    } else {
                        this.allParts.push(sanitizedData);
                    }
                    await this.saveToIndexedDB();
                    this.showNotification("Part saved offline, will sync when online");
                    this.showPartModal = false;
                    this.isLoading = false;
                    return;
                }
            }
            
            await withRetry(async () => {
                await window.set(window.ref(window.db, 'SpareParts/' + this.partForm.id), sanitizedData);
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
            this.showNotification("Spare part data synchronized!");
            
            // Add to local array immediately for instant UI update
            const existingIdx = this.allParts.findIndex(p => p.PartID === sanitizedData.PartID);
            if (existingIdx >= 0) {
                this.allParts[existingIdx] = sanitizedData;
            } else {
                this.allParts.unshift(sanitizedData);
            }
            
            this.showPartModal = false;
        } catch (e) {
            console.error('Submit Spare Part Error:', e);
            this.showNotification("Sync Error: " + e.message, "error");
        } finally {
            this.isLoading = false;
        }
    }
};
