import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/modules/logs.js';
let s = readFileSync(p, 'utf8');

const old = `            // Handle photos - get URLs from photos array - handle Alpine Proxy
            let photoUrls = [];
            const rawPhotos = this.logForm?.photos;
            if (Array.isArray(rawPhotos)) {
                photoUrls = rawPhotos.filter(p => p && p.preview).map(p => p.preview);
            } else if (rawPhotos && typeof rawPhotos === 'object') {
                try {
                    const unwrapped = window.Alpine?.raw?.(rawPhotos);
                    if (Array.isArray(unwrapped)) {
                        photoUrls = unwrapped.filter(p => p && p.preview).map(p => p.preview);
                    }
                } catch(e) {}
            }`;

const repl = `            // Handle photos - upload NEW photos (file/base64) to ImgBB, keep existing URLs
            let photoUrls = [];
            const rawPhotos = this.logForm?.photos;
            let photoList = [];
            if (Array.isArray(rawPhotos)) {
                photoList = rawPhotos;
            } else if (rawPhotos && typeof rawPhotos === 'object') {
                try {
                    const unwrapped = window.Alpine?.raw?.(rawPhotos);
                    if (Array.isArray(unwrapped)) photoList = unwrapped;
                } catch(e) {}
            }
            if (photoList.length) {
                this.showNotification('Uploading photos...', 'info');
                for (const ph of photoList) {
                    if (!ph) continue;
                    // Already a remote URL (existing photo or previously uploaded) - keep as-is
                    const src = ph.preview || ph.base64 || '';
                    if (src && !src.startsWith('blob:') && !src.startsWith('data:')) {
                        photoUrls.push(src);
                        continue;
                    }
                    // New photo: upload via ImgBB (fallback base64)
                    const file = ph.file;
                    if (file && typeof this.uploadToImgBB === 'function') {
                        try {
                            const url = await this.uploadToImgBB(file);
                            if (url) { photoUrls.push(url); continue; }
                        } catch(e) { console.warn('[SubmitLog] photo upload failed:', e.message); }
                    }
                    // Fallback: keep base64 data URL if available
                    if (src && src.startsWith('data:')) photoUrls.push(src);
                }
            }`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(old)) { console.error('PATTERN NOT FOUND'); process.exit(1); }
t = t.replace(old, repl);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: log photo upload patched');
