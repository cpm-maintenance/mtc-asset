import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/src/js/app.js';
let s = readFileSync(p, 'utf8');

const old = `            console.log('[Migrate] Done:', JSON.stringify(results));
            this.showNotification('Migrated ' + results.migrated + ' images to ImgBB', 'success');
            return results;
        },`;

const repl = `            // Also migrate Equipment.FotoURL fields that still hold inline base64
            const eqSnap2 = await window.get(window.ref(window.db, 'Equipment'));
            const equipment2 = eqSnap2.val() || {};
            for (const [eqId, eq] of Object.entries(equipment2)) {
                const foto = eq.FotoURL;
                if (!foto || !String(foto).startsWith('data:')) continue;
                try {
                    const rawB64 = String(foto).split('base64,')[1] || String(foto);
                    const form = new FormData();
                    form.append('key', import.meta.env.VITE_IMGBB_API_KEY);
                    form.append('image', rawB64);
                    form.append('name', 'eq_' + eqId);
                    const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
                    const j = await r.json();
                    if (!j.success) throw new Error(j.error?.message || 'ImgBB fail');
                    await window.update(window.ref(window.db), { ['Equipment/' + eqId + '/FotoURL']: j.data.url });
                    results.migrated++;
                    console.log('[Migrate] Equipment', eqId, 'FotoURL →', j.data.url);
                } catch (e) {
                    results.failed++;
                    console.error('[Migrate] Equipment', eqId, 'failed:', e.message);
                }
            }
            // Logs PhotoURLs that are still inline base64
            const logSnap2 = await window.get(window.ref(window.db, 'HistoryLog'));
            const logs2 = logSnap2.val() || {};
            for (const [logId, log] of Object.entries(logs2)) {
                const urls = log.PhotoURLs;
                const list = Array.isArray(urls) ? urls : (typeof urls === 'string' ? (() => { try { return JSON.parse(urls); } catch { return []; } })() : []);
                if (!list.some(u => typeof u === 'string' && u.startsWith('data:'))) continue;
                const newUrls = [];
                for (const u of list) {
                    if (typeof u === 'string' && u.startsWith('data:')) {
                        try {
                            const rawB64 = u.split('base64,')[1] || u;
                            const form = new FormData();
                            form.append('key', import.meta.env.VITE_IMGBB_API_KEY);
                            form.append('image', rawB64);
                            form.append('name', 'log_' + logId);
                            const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
                            const j = await r.json();
                            if (!j.success) throw new Error(j.error?.message || 'ImgBB fail');
                            newUrls.push(j.data.url);
                            results.migrated++;
                        } catch (e) {
                            results.failed++;
                            console.error('[Migrate] Log', logId, 'photo failed:', e.message);
                            newUrls.push(u); // keep original
                        }
                    } else {
                        newUrls.push(u);
                    }
                }
                await window.update(window.ref(window.db), { ['HistoryLog/' + logId + '/PhotoURLs']: newUrls });
            }

            console.log('[Migrate] Done:', JSON.stringify(results));
            this.showNotification('Migrated ' + results.migrated + ' images to ImgBB', 'success');
            return results;
        },`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(old)) { console.error('PATTERN NOT FOUND'); process.exit(1); }
t = t.replace(old, repl);
s = t.replace(/\n/g, '\r\n');
writeFileSync(p, s);
console.log('OK: migrateLegacyImages extended (equipment + logs)');
