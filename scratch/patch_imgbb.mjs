import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/modules/ui.js';
let s = readFileSync(p, 'utf8');

const old = `    // Upload image - store directly in Firebase Database (no external storage needed)
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
            const dataUrl = \`data:\${compressed.type || 'image/jpeg'};base64,\${base64.split(',')[1]}\`;
            
            // Store directly in Firebase Database
            const imageId = \`img_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
            const truncatedData = dataUrl.substring(0, 400000); // Limit size for Firebase
            
            await window.set(window.ref(window.db, \`ImageUploads/\${imageId}\`), {
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
    },`;

const repl = `    // Upload image to ImgBB (URL) with fallback to Firebase DB base64 if ImgBB fails.
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
            
            const base64 = await this.blobToBase64(compressed);
            const rawB64 = base64.split(',')[1] || base64;
            
            // Try ImgBB first (stores URL, keeps DB small)
            const imgbbKey = import.meta.env.VITE_IMGBB_API_KEY;
            if (imgbbKey) {
                try {
                    const form = new FormData();
                    form.append('key', imgbbKey);
                    form.append('image', rawB64);
                    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
                    const json = await res.json();
                    if (json.success && json.data?.url) {
                        console.log('Image uploaded to ImgBB:', json.data.url);
                        this.showNotification('Image uploaded successfully', 'success');
                        return json.data.url;
                    }
                    console.warn('[ImgBB] Upload failed, falling back to DB:', json.error?.message || 'unknown');
                } catch (e) {
                    console.warn('[ImgBB] Network error, falling back to DB:', e.message);
                }
            }
            
            // Fallback: store base64 in Firebase Database (legacy behavior)
            const dataUrl = \`data:\${compressed.type || 'image/jpeg'};base64,\${rawB64}\`;
            const imageId = \`img_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
            const truncatedData = dataUrl.substring(0, 400000);
            
            await window.set(window.ref(window.db, \`ImageUploads/\${imageId}\`), {
                data: truncatedData,
                type: compressed.type || 'image/jpeg',
                created: Date.now()
            });
            
            console.log('Image saved to Firebase Database (fallback)');
            this.showNotification('Image uploaded (database mode)', 'success');
            return truncatedData;
            
        } catch (e) {
            console.error('Image Upload Error:', e);
            this.showNotification('Image upload failed - will save without image', 'warning');
            return null;
        }
    },`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(old)) { console.error('PATTERN NOT FOUND'); process.exit(1); }
t = t.replace(old, repl);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: uploadToImgBB patched');
