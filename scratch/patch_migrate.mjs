import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/app.js';
let s = readFileSync(p, 'utf8');

// Insert migration method after refreshData() getter block (before filteredAllParts)
const anchor = `        get filteredAllParts() {`;
const code = `        // ── Phase 2: Migrate legacy base64 ImageUploads → ImgBB URLs ──
        // Run from browser console: await window.app.migrateLegacyImages()
        async migrateLegacyImages() {
            const results = { migrated: 0, failed: 0, skipped: 0 };
            const snap = await window.get(window.ref(window.db, 'ImageUploads'));
            const uploads = snap.val() || {};
            const ids = Object.keys(uploads);
            if (!ids.length) { console.log('[Migrate] No ImageUploads found'); return results; }
            console.log('[Migrate] Found', ids.length, 'legacy images');

            // Load equipment + logs to map references
            const eqSnap = await window.get(window.ref(window.db, 'Equipment'));
            const equipment = eqSnap.val() || {};
            const logSnap = await window.get(window.ref(window.db, 'HistoryLog'));
            const logs = logSnap.val() || {};

            for (const id of ids) {
                const entry = uploads[id];
                const data = entry?.data || entry?.dataUrl || '';
                if (!data || !data.startsWith('data:')) { results.skipped++; continue; }
                try {
                    const rawB64 = data.split('base64,')[1] || data;
                    const form = new FormData();
                    form.append('key', import.meta.env.VITE_IMGBB_API_KEY);
                    form.append('image', rawB64);
                    form.append('name', id);
                    const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
                    const j = await r.json();
                    if (!j.success) throw new Error(j.error?.message || 'ImgBB fail');
                    const url = j.data.url;
                    console.log('[Migrate]', id, '→', url);

                    const updates = {};
                    const prefix = data.slice(0, 100);
                    for (const [eqId, eq] of Object.entries(equipment)) {
                        if (eq.FotoURL && String(eq.FotoURL).includes(prefix)) {
                            updates['Equipment/' + eqId + '/FotoURL'] = url;
                        }
                    }
                    for (const [logId, log] of Object.entries(logs)) {
                        const urls = log.PhotoURLs;
                        const asStr = typeof urls === 'string' ? urls : JSON.stringify(urls || []);
                        if (asStr.includes(prefix)) {
                            if (Array.isArray(urls)) {
                                updates['HistoryLog/' + logId + '/PhotoURLs'] = urls.map(u => u === data ? url : u);
                            } else {
                                updates['HistoryLog/' + logId + '/PhotoURLs'] = [url];
                            }
                        }
                    }
                    updates['ImageUploads/' + id] = null;
                    await window.update(window.ref(window.db), updates);
                    results.migrated++;
                } catch (e) {
                    results.failed++;
                    console.error('[Migrate]', id, 'failed:', e.message);
                }
            }
            console.log('[Migrate] Done:', JSON.stringify(results));
            this.showNotification('Migrated ' + results.migrated + ' images to ImgBB', 'success');
            return results;
        },

        `;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(anchor)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
t = t.replace(anchor, code + anchor);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: migrateLegacyImages added to app.js');
