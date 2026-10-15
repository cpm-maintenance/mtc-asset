import { callStitchTool } from './stitch-bridge.js';
import fs from 'fs';

async function downloadScreens() {
    const desktop = await callStitchTool('get_screen', {
        name: 'projects/15538611438628478374/screens/c86f14958c2a4921bb09a6a48bbd5fb4',
    });
    const desktopUrl = desktop.htmlCode?.downloadUrl;
    if (desktopUrl) {
        const res = await fetch(desktopUrl);
        const text = await res.text();
        fs.writeFileSync('public/stitch-parts-desktop.html', text, 'utf-8');
        console.log('Saved public/stitch-parts-desktop.html (bytes:', text.length, ')');
    }

    const mobile = await callStitchTool('get_screen', {
        name: 'projects/15538611438628478374/screens/8d4589ea4e8142ab9e1f9d5bbedb559c',
    });
    const mobileUrl = mobile.htmlCode?.downloadUrl;
    if (mobileUrl) {
        const res = await fetch(mobileUrl);
        const text = await res.text();
        fs.writeFileSync('public/stitch-parts-mobile.html', text, 'utf-8');
        console.log('Saved public/stitch-parts-mobile.html (bytes:', text.length, ')');
    }
}

downloadScreens().catch(e => {
    console.error(e);
    process.exit(1);
});
