import { callStitchTool } from './stitch-bridge.js';
import fs from 'fs';
import path from 'path';

// Reference design assets live OUTSIDE public/ so they are never bundled
// into the deployed PWA (they are authoring references, not app assets).
const OUT_DIR = path.resolve('design/stitch');

// Dua project Stitch MTC dipegang akun Google yang berbeda, dan tiap akun butuh
// quota project miliknya sendiri. Grup di bawah menyetel STITCH_ACCOUNT +
// STITCH_QUOTA_PROJECT sebelum memanggil API (lihat scripts/stitch-bridge.js).
const PROJECTS = [
    {
        projectId: '15538611438628478374',
        title: 'Mine Equipment History PWA',
        account: 'adhymlb01@gmail.com',
        quota: 'mtc-asset',
        screens: [
            { key: 'parts-desktop', id: 'c86f14958c2a4921bb09a6a48bbd5fb4' },
            { key: 'parts-mobile', id: '8d4589ea4e8142ab9e1f9d5bbedb559c' },
            { key: 'history-card', id: '92ed9d8def9d4e8c9647f18a3a550f2f' },
            { key: 'log-maintenance', id: '6c03d888402b4489b1a1fddf8796febf' },
            { key: 'scanner-dashboard', id: '08b84ff3fdeb40ac900c971f9b7c19f0' },
        ],
    },
    {
        projectId: '2861085646384681595',
        title: 'MTC ASSET - Industrial Operations & Maintenance PWA',
        account: 'adhymlb@gmail.com',
        quota: 'gen-lang-client-0051799821',
        screens: [
            { key: 'dashboard', id: 'f88b02d0cbb14d00ab8bcc88879eccfd' },
            { key: 'dashboard-img1', id: '9dfd9b5d3aca46549168f688a2c5b671' },
            { key: 'dashboard-img2', id: '12f33e58f8474193a1e80396f2c7e781' },
            { key: 'dashboard-compact', id: 'bf9715ab0c7049399b3b8b304aa66826' },
            { key: 'work-order-protocol', id: '6a6d2c8122ca4583be03a2267527157d' },
            { key: 'spare-parts-ledger', id: '69d4db0759d74a15ae1b9ade430099ef' },
            { key: 'asset-registration', id: '69366740c55b4847a5a50109fded01bb' },
            { key: 'field-technician-mobile', id: 'ba9b9aa1b0c646b5b9557b7bd9673522' },
        ],
    },
];

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const project of PROJECTS) {
        process.env.STITCH_ACCOUNT = project.account;
        process.env.STITCH_QUOTA_PROJECT = project.quota;
        console.log(`# ${project.projectId} — ${project.title} (as ${project.account})`);

        for (const screen of project.screens) {
            const res = await callStitchTool('get_screen', {
                name: `projects/${project.projectId}/screens/${screen.id}`,
            });
            const url = res.htmlCode?.downloadUrl;
            if (!url) {
                console.warn(`  skip ${screen.key}: no htmlCode.downloadUrl`);
                continue;
            }
            const html = await (await fetch(url)).text();
            const file = path.join(OUT_DIR, `stitch-${screen.key}.html`);
            fs.writeFileSync(file, html, 'utf-8');
            console.log(`  saved stitch-${screen.key}.html (${html.length} bytes)`);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
