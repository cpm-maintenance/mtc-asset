/**
 * Helper client untuk langsung berinteraksi dengan Google Stitch MCP Endpoint.
 * Endpoint: https://stitch.googleapis.com/mcp
 *
 * Pemakaian:
 *   node scripts/stitch-client.js list
 *   node scripts/stitch-client.js create "Judul Project"
 *   node scripts/stitch-client.js call <toolName> '{"param": "val"}'
 */

const API_KEY = process.env.STITCH_API_KEY || '[REDACTED]';
const ENDPOINT = 'https://stitch.googleapis.com/mcp';

async function mcpCall(method, params = {}) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
        }),
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    if (json.error) {
        throw new Error(`JSON-RPC Error [${json.error.code}]: ${json.error.message}`);
    }
    return json.result;
}

async function main() {
    const [action, ...args] = process.argv.slice(2);

    if (!action || action === 'list') {
        const result = await mcpCall('tools/list');
        console.log(`\n=== STITCH MCP TOOLS (${result.tools.length}) ===\n`);
        result.tools.forEach((t) => {
            console.log(`• ${t.name}: ${t.description.split('\n')[0]}`);
        });
        return;
    }

    if (action === 'call') {
        const [toolName, jsonArg] = args;
        if (!toolName) {
            console.error('Usage: node stitch-client.js call <toolName> [jsonArgs]');
            process.exit(1);
        }
        const parsedArgs = jsonArg ? JSON.parse(jsonArg) : {};
        const result = await mcpCall('tools/call', {
            name: toolName,
            arguments: parsedArgs,
        });
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    console.log(`Unknown action: ${action}`);
}

main().catch((err) => {
    console.error('Stitch MCP Error:', err.message);
    process.exit(1);
});
