import { callStitchTool } from './stitch-bridge.js';
import fs from 'fs';
import path from 'path';

// Reference design assets live OUTSIDE public/ so they are never bundled
// into the deployed PWA (they are authoring references, not app assets).
const OUT_DIR = path.resolve('design/stitch');

const SCREENS = [
    { key: 'parts-desktop', id: 'c86f14958c2a4921bb09a6a48bbd5fb4' },
    { key: 'parts-mobile', id: '8d4589ea4e8142ab9e1f9d5bbedb559c' },
    { key: 'history-card', id: '92ed9d8def9d4e8c9647f18a3a550f2f' },
    { key: 'log-maintenance', id: '6c03d888402b4489b1a1fddf8796febf' },
    { key: 'scanner-dashboard', id: '08b84ff3fdeb40ac900c971f9b7c19f0' },
];

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const screen of SCREENS) {
        const res = await callStitchTool('get_screen', {
            name: `projects/15538611438628478374/screens/${screen.id}`,
        });
        const url = res.htmlCode?.downloadUrl;
        if (!url) {
            console.warn(`skip ${screen.key}: no htmlCode.downloadUrl`);
            continue;
        }
        const html = await (await fetch(url)).text();
        const file = path.join(OUT_DIR, `stitch-${screen.key}.html`);
        fs.writeFileSync(file, html, 'utf-8');
        console.log(`saved ${file} (${html.length} bytes)`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
