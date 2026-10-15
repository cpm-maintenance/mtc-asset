import { callStitchTool } from './stitch-bridge.js';
import fs from 'fs';

async function fetchProject() {
    const p = await callStitchTool('get_project', { name: 'projects/15538611438628478374' });
    if (p.designTheme?.designMd) {
        fs.writeFileSync('public/DESIGN-STITCH.md', p.designTheme.designMd, 'utf-8');
        console.log('Saved public/DESIGN-STITCH.md, bytes:', p.designTheme.designMd.length);
    }
}

fetchProject().catch(e => {
    console.error(e);
    process.exit(1);
});
