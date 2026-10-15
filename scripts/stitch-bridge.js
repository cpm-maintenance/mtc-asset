/**
 * Google Stitch MCP Bridge Client
 * Langsung terhubung ke Google Stitch API menggunakan gcloud OAuth token milik akun aktif.
 */
import { execSync } from 'child_process';

const ENDPOINT = 'https://stitch.googleapis.com/mcp';
const GCLOUD_CMD = 'C:/Users/andi.supriadi/.stitch-mcp/google-cloud-sdk/bin/gcloud.cmd';
const GCLOUD_CONFIG = 'C:/Users/andi.supriadi/.stitch-mcp/config';
const PROJECT_ID = 'mtc-asset';

function getAccessToken() {
    try {
        const token = execSync(`"${GCLOUD_CMD}" auth print-access-token`, {
            env: { ...process.env, CLOUDSDK_CONFIG: GCLOUD_CONFIG },
            shell: 'cmd.exe',
            encoding: 'utf-8',
        }).trim();
        return token;
    } catch (e) {
        throw new Error('Gagal mengambil access token dari gcloud.', { cause: e });
    }
}

export async function callStitchTool(toolName, args = {}) {
    const token = getAccessToken();
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Goog-User-Project': PROJECT_ID,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: args,
            },
        }),
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    if (json.error) {
        throw new Error(`JSON-RPC Error: ${json.error.message}`);
    }
    const content = json.result?.content?.[0]?.text;
    try {
        return JSON.parse(content);
    } catch {
        return content;
    }
}

async function main() {
    const [action, ...params] = process.argv.slice(2);

    if (action === 'projects') {
        const data = await callStitchTool('list_projects', {});
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    if (action === 'screens') {
        const projectId = params[0] || 'projects/15538611438628478374';
        const data = await callStitchTool('list_screens', { projectId });
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    if (action === 'screen') {
        const [projectId, screenId] = params;
        const data = await callStitchTool('get_screen', {
            name: `${projectId}/screens/${screenId}`,
        });
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    console.log('Commands: projects | screens [projectId] | screen <projectId> <screenId>');
}

if (process.argv[1]?.endsWith('stitch-bridge.js')) {
    main().catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
}
