// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/ai.js`.
 *
 * Cakupan (Q-1):
 *  - prompt builder murni: `formatKPIForPrompt`, `buildSmartPrompt`, `buildAnalysisPrompt`
 *  - ekstraksi KPI dari state: `getKPIContext`
 *  - manajemen API key: `init`, `setApiKey`, `clearApiKey`, `rotateApiKey`,
 *    getter `activeApiKey`, `loadAISettings`
 *  - dispatch provider + normalisasi error: `callAI` / `callOpenAI` / `callClaude` / `callOpenRouter`
 *  - alur `analyzeKPI` (tanpa key, sukses, custom prompt, rate-limit → rotate, semua gagal)
 *  - `getAIRecommendations`, `sendAIChat`, `updateModelOptions`, `clearAIChat`
 *
 * Catatan desain: `aiModule` adalah objek state Alpine tunggal. Test memakai
 * `Object.create(aiModule)` supaya metode + getter tetap hidup (spread akan
 * membekukan getter) tetapi setiap test punya state sendiri → tidak bocor.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { aiModule } from '../src/js/modules/ai.js';

function makeCtx(overrides = {}) {
    const ctx = Object.create(aiModule);
    ctx.aiApiKeys = [];
    ctx.activeKeyIndex = 0;
    ctx.apiKey = '';
    ctx.aiProvider = 'openrouter';
    ctx.aiModel = '';
    ctx.customPrompt = '';
    ctx.equipment = [];
    ctx.logs = [];
    ctx.allParts = [];
    ctx.performanceData = [];
    ctx.aiChatHistory = [];
    ctx.aiChatInput = '';
    ctx.aiIsAnalyzing = false;
    ctx.isAnalyzing = false;
    ctx.analysisResult = null;
    ctx.user = null;
    ctx.isAdmin = false;
    ctx.showNotification = vi.fn();
    return Object.assign(ctx, overrides);
}

const okJson = (payload) => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
});

const failJson = (payload, status = 400) => ({
    ok: false,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
});

const KPI = {
    totalEquipment: 12,
    activeEquipment: 9,
    maintenanceEquipment: 3,
    totalWO: 40,
    completedWO: 30,
    pendingWO: 6,
    inProgressWO: 4,
    approvedWO: 2,
    rejectedWO: 1,
    completionRate: 75,
    avgResponseDays: 3.2,
    totalDowntime: 50,
    avgDowntime: 5,
    downtimeCount: 10,
    lowStockParts: 2,
    criticalParts: 1,
    topLowStock: [{ name: 'Bearing 6205', stock: 1, minStock: 5 }],
    topRCA: [
        { rca: 'wear', count: 4 },
        { rca: 'fatigue', count: 2 },
    ],
};

beforeEach(() => {
    localStorage.clear();
    delete window.app;
    delete window.appState;
    vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ai.js — prompt builders', () => {
    it('formatKPIForPrompt menulis semua metrik + daftar RCA', () => {
        const ctx = makeCtx();
        const out = ctx.formatKPIForPrompt(KPI);

        expect(out).toContain('- Total: 12 | Active: 9 | Maintenance: 3');
        expect(out).toContain('- Completion Rate: 75%');
        expect(out).toContain('- Total: 50 hrs | Avg: 5 hrs per incident');
        expect(out).toContain('Low Stock: 2 | Critical: 1');
        expect(out).toContain('wear(4), fatigue(2)');
    });

    it('formatKPIForPrompt memakai N/A kalau topRCA kosong', () => {
        const ctx = makeCtx();
        expect(ctx.formatKPIForPrompt({ ...KPI, topRCA: [] })).toContain('*Top RCA:* N/A');
    });

    it('buildSmartPrompt menyertakan top low stock + RCA saat data ada', () => {
        const ctx = makeCtx();
        const out = ctx.buildSmartPrompt(KPI);

        expect(out).toContain('Top Low Stock: Bearing 6205(1/5)');
        expect(out).toContain('- wear: 4 cases');
        expect(out).toContain('- fatigue: 2 cases');
        expect(out).toContain('Total Incidents: 10');
    });

    it('buildSmartPrompt membuang baris top low stock + menandai RCA kosong', () => {
        const ctx = makeCtx();
        const out = ctx.buildSmartPrompt({ ...KPI, topLowStock: [], topRCA: [] });

        expect(out).not.toContain('Top Low Stock');
        expect(out).toContain('- No RCA data');
    });

    it('buildAnalysisPrompt memakai totalWorkOrders + daftar topLowStock', () => {
        const ctx = makeCtx();
        const out = ctx.buildAnalysisPrompt({ ...KPI, totalWorkOrders: 40 });

        expect(out).toContain('- Work Orders: 40 (30 completed, 6 pending, 4 in progress)');
        expect(out).toContain('- Bearing 6205: 1/5');
    });
});

describe('ai.js — getKPIContext', () => {
    const equipment = [
        { Status: 'Active' },
        { Status: 'Active' },
        { Status: 'In Maintenance' },
        { Status: 'Retired' },
    ];
    const logs = [
        {
            woNumber: 'WO-1',
            Status: 'Completed',
            Jenis: 'PM',
            woPriority: 'High',
            Downtime: 4,
            rca: 'Wear',
            createdAt: '2026-01-01',
            approvalDate: '2026-01-03',
        },
        { woNumber: 'WO-2', Status: 'Pending', Jenis: 'Repair', woPriority: 'Urgent', Downtime: 0 },
        { woNumber: 'WO-3', Status: 'In Progress', Jenis: 'PM', woPriority: 'Normal', Downtime: 6, rca: 'Fatigue' },
        { woNumber: 'WO-4', Status: 'Approved', Jenis: 'Repair' },
        { woNumber: 'WO-5', Status: 'Rejected', Jenis: 'Repair' },
        { Status: 'Completed' }, // log non-WO: tidak dihitung
    ];
    const allParts = [
        { Nama: 'A', stock: 1, minStock: 5 },
        { Nama: 'B', stock: 20, minStock: 5 },
        { Nama: 'C', stock: 3 },
    ];

    it('menghitung seluruh statistik dari state mentah', () => {
        const ctx = makeCtx({ equipment, logs, allParts });
        const kpi = ctx.getKPIContext();

        expect(kpi.totalEquipment).toBe(4);
        expect(kpi.activeEquipment).toBe(2);
        expect(kpi.maintenanceEquipment).toBe(1);

        // Hanya log dengan woNumber yang dianggap work order
        expect(kpi.totalWO).toBe(5);
        expect(kpi.completedWO).toBe(1);
        expect(kpi.pendingWO).toBe(1);
        expect(kpi.inProgressWO).toBe(1);
        expect(kpi.approvedWO).toBe(1);
        expect(kpi.rejectedWO).toBe(1);
        expect(kpi.completionRate).toBe('20.0');

        expect(kpi.woByType).toEqual({ PM: 2, Repair: 3 });
        expect(kpi.woByPriority).toEqual({ High: 1, Urgent: 1, Normal: 3 });

        expect(kpi.totalDowntime).toBe(10);
        expect(kpi.downtimeCount).toBe(2);
        expect(kpi.avgDowntime).toBe('5.0');

        expect(kpi.topRCA).toEqual([
            { rca: 'wear', count: 1 },
            { rca: 'fatigue', count: 1 },
        ]);

        expect(kpi.lowStockParts).toBe(2);
        expect(kpi.criticalParts).toBe(2);
        expect(kpi.topLowStock).toEqual([
            { name: 'A', stock: 1, minStock: 5 },
            { name: 'C', stock: 3, minStock: undefined },
        ]);

        // 2026-01-01 → 2026-01-03 = 2 hari
        expect(kpi.avgResponseDays).toBe('2.0');
    });

    it('aman saat state masih kosong', () => {
        const ctx = makeCtx();
        const kpi = ctx.getKPIContext();

        expect(kpi.totalEquipment).toBe(0);
        expect(kpi.totalWO).toBe(0);
        expect(kpi.completionRate).toBe(0);
        expect(kpi.avgDowntime).toBe(0);
        expect(kpi.avgResponseDays).toBe(0);
        expect(kpi.topRCA).toEqual([]);
    });
});

describe('ai.js — API key management', () => {
    it('init memuat konfigurasi dari localStorage', async () => {
        localStorage.setItem('ai_api_key', 'sk-init');
        localStorage.setItem('ai_provider', 'claude');
        localStorage.setItem('ai_model', 'claude-3-haiku-20240307');
        localStorage.setItem('ai_custom_prompt', 'prompt tersimpan');

        const ctx = makeCtx();
        await ctx.init();

        expect(ctx.apiKey).toBe('sk-init');
        expect(ctx.apiProvider).toBe('claude');
        expect(ctx.apiModel).toBe('claude-3-haiku-20240307');
        expect(ctx.customPrompt).toBe('prompt tersimpan');
    });

    it('init jatuh ke default openai saat localStorage kosong', async () => {
        const ctx = makeCtx();
        await ctx.init();

        expect(ctx.apiKey).toBe('');
        expect(ctx.apiProvider).toBe('openai');
        expect(ctx.apiModel).toBe('');
    });

    it('setApiKey menyimpan key/provider/model + custom prompt dan memberi notifikasi', () => {
        window.app = { showNotification: vi.fn() };
        const ctx = makeCtx({ customPrompt: 'prompt saya' });

        ctx.setApiKey('sk-baru', 'claude', 'claude-3-haiku-20240307');

        expect(ctx.apiKey).toBe('sk-baru');
        expect(ctx.apiProvider).toBe('claude');
        expect(ctx.apiModel).toBe('claude-3-haiku-20240307');
        expect(localStorage.getItem('ai_api_key')).toBe('sk-baru');
        expect(localStorage.getItem('ai_provider')).toBe('claude');
        expect(localStorage.getItem('ai_model')).toBe('claude-3-haiku-20240307');
        expect(localStorage.getItem('ai_custom_prompt')).toBe('prompt saya');
        expect(window.app.showNotification).toHaveBeenCalledWith('API key and settings saved!', 'success');
    });

    it('setApiKey tidak gagal saat tidak ada window.app', () => {
        const ctx = makeCtx();
        expect(() => ctx.setApiKey('sk-x')).not.toThrow();
        expect(localStorage.getItem('ai_provider')).toBe('openai');
    });

    it('clearApiKey mengosongkan state + localStorage', () => {
        window.app = { showNotification: vi.fn() };
        localStorage.setItem('ai_api_key', 'sk-lama');
        localStorage.setItem('ai_provider', 'claude');
        localStorage.setItem('ai_model', 'm');
        localStorage.setItem('ai_custom_prompt', 'c');

        const ctx = makeCtx({ apiKey: 'sk-lama', apiModel: 'm', customPrompt: 'c' });
        ctx.clearApiKey();

        expect(ctx.apiKey).toBe('');
        expect(ctx.apiModel).toBe('');
        expect(ctx.customPrompt).toBe('');
        expect(localStorage.getItem('ai_api_key')).toBeNull();
        expect(localStorage.getItem('ai_provider')).toBeNull();
        expect(localStorage.getItem('ai_model')).toBeNull();
        expect(localStorage.getItem('ai_custom_prompt')).toBeNull();
        expect(window.app.showNotification).toHaveBeenCalledWith('API key cleared', 'info');
    });

    it('getter activeApiKey memakai key pada activeKeyIndex', () => {
        const ctx = makeCtx({ aiApiKeys: ['a', 'b'], activeKeyIndex: 1 });
        expect(ctx.activeApiKey).toBe('b');
    });

    it('getter activeApiKey jatuh ke localStorage ai_api_key_N lalu ai_api_key', () => {
        const ctx = makeCtx();
        expect(ctx.activeApiKey).toBe('');

        localStorage.setItem('ai_api_key_2', 'sk-slot-2');
        expect(ctx.activeApiKey).toBe('sk-slot-2');

        localStorage.removeItem('ai_api_key_2');
        localStorage.setItem('ai_api_key', 'sk-legacy');
        expect(ctx.activeApiKey).toBe('sk-legacy');
    });

    it('rotateApiKey melewati slot kosong dan menyimpan indeks baru', () => {
        const ctx = makeCtx({ aiApiKeys: ['k0', '   ', 'k2'], activeKeyIndex: 0 });

        expect(ctx.rotateApiKey()).toBe('k2');
        expect(ctx.activeKeyIndex).toBe(2);
        expect(localStorage.getItem('ai_active_key_index')).toBe('2');
    });

    it('rotateApiKey mengembalikan null kalau hanya ada satu key efektif', () => {
        const ctx = makeCtx({ aiApiKeys: ['k0'], activeKeyIndex: 0 });
        expect(ctx.rotateApiKey()).toBeNull();
    });

    it('rotateApiKey menarik key tambahan dari localStorage tanpa duplikat', () => {
        localStorage.setItem('ai_api_keys_count', '3');
        localStorage.setItem('ai_api_key_0', 'k0');
        localStorage.setItem('ai_api_key_1', 'k1');
        localStorage.setItem('ai_api_key_2', 'k2');

        const ctx = makeCtx({ aiApiKeys: ['k0'], activeKeyIndex: 0 });
        expect(ctx.rotateApiKey()).toBe('k1');
        expect(ctx.aiApiKeys).toEqual(['k0', 'k1', 'k2']);
    });

    it('loadAISettings memuat key non-kosong dari localStorage', async () => {
        localStorage.setItem('ai_api_keys_count', '3');
        localStorage.setItem('ai_api_key_0', 'sk-0');
        localStorage.setItem('ai_api_key_1', '   ');
        localStorage.setItem('ai_api_key_2', 'sk-2');
        localStorage.setItem('ai_provider', 'claude');
        localStorage.setItem('ai_model', 'claude-3-opus-20240229');
        localStorage.setItem('ai_active_key_index', '1');

        const ctx = makeCtx();
        ctx.loadAISettings();

        await vi.waitFor(() => expect(ctx.aiApiKeys.length).toBeGreaterThan(0));

        expect(ctx.aiApiKeys).toEqual(['sk-0', 'sk-2']);
        expect(ctx.aiApiKeyInput1).toBe('sk-0');
        expect(ctx.aiApiKeyInput2).toBe('   ');
        expect(ctx.aiApiKeyInput3).toBe('sk-2');
        expect(ctx.aiApiKeyInput4).toBe('');
        expect(ctx.aiProvider).toBe('claude');
        expect(ctx.aiModel).toBe('claude-3-opus-20240229');
        expect(ctx.activeKeyIndex).toBe(1);
        expect(ctx.aiModelOptions.map((o) => o.value)).toContain('claude-3-opus-20240229');
    });

    it('memakai model tersimpan dari localStorage, bukan default provider', async () => {
        localStorage.setItem('ai_provider', 'openrouter');
        localStorage.setItem('ai_model', 'vendor/model-x');

        const ctx = makeCtx();
        ctx.loadAISettings();

        await vi.waitFor(() => expect(ctx.aiModelOptions.length).toBeGreaterThan(0));

        expect(ctx.aiModel).toBe('vendor/model-x');
        expect(ctx.aiModelOptions.at(-1)).toEqual({ value: 'vendor/model-x', label: 'Custom: vendor/model-x' });
    });

    it('jatuh ke opsi pertama provider bila ai_model kosong', async () => {
        localStorage.setItem('ai_provider', 'openrouter');

        const ctx = makeCtx();
        ctx.loadAISettings();

        await vi.waitFor(() => expect(ctx.aiModelOptions.length).toBeGreaterThan(0));

        expect(ctx.aiModel).toBe('google/gemma-4-26b-a4b-it:free');
        expect(ctx.aiModelOptions.some((o) => o.label.startsWith('Custom:'))).toBe(false);
    });
});

describe('ai.js — callAI dispatch', () => {
    it('merutekan ke OpenAI saat provider = openai', async () => {
        localStorage.setItem('ai_provider', 'openai');
        localStorage.setItem('ai_api_key', 'sk-openai');
        const fetchMock = vi.fn(async () => okJson({ choices: [{ message: { content: 'dari-openai' } }] }));
        vi.stubGlobal('fetch', fetchMock);

        const out = await makeCtx().callAI('halo');

        expect(out).toBe('dari-openai');
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
        const init = fetchMock.mock.calls[0][1];
        expect(init.headers.Authorization).toBe('Bearer sk-openai');
        expect(JSON.parse(init.body).model).toBe('gpt-4o-mini');
    });

    it('merutekan ke Claude saat provider = claude', async () => {
        localStorage.setItem('ai_provider', 'claude');
        localStorage.setItem('ai_api_key', 'sk-ant');
        const fetchMock = vi.fn(async () => okJson({ content: [{ text: 'dari-claude' }] }));
        vi.stubGlobal('fetch', fetchMock);

        const out = await makeCtx().callAI('halo');

        expect(out).toBe('dari-claude');
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
        expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('sk-ant');
    });

    it('jatuh ke OpenRouter sebagai default', async () => {
        localStorage.setItem('ai_api_key', 'sk-or');
        const fetchMock = vi.fn(async () => okJson({ choices: [{ message: { content: 'dari-or' } }] }));
        vi.stubGlobal('fetch', fetchMock);

        const out = await makeCtx().callAI('halo');

        expect(out).toBe('dari-or');
        expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('openai/gpt-4o-mini');
    });

    it('memakai key eksplisit + provider/model dari window.app', async () => {
        localStorage.setItem('ai_provider', 'claude');
        window.app = { aiProvider: 'openai', aiModel: 'gpt-4o', showNotification: vi.fn() };
        const fetchMock = vi.fn(async () => okJson({ choices: [{ message: { content: 'ok' } }] }));
        vi.stubGlobal('fetch', fetchMock);

        const ctx = makeCtx();
        await ctx.callAI('halo', 'sk-eksplisit');

        expect(ctx.apiKey).toBe('sk-eksplisit');
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('gpt-4o');
    });

    it('memakai key pertama dari app.aiApiKeys saat ada', async () => {
        localStorage.setItem('ai_provider', 'claude');
        window.app = { aiApiKeys: ['sk-app-1'], showNotification: vi.fn() };
        const fetchMock = vi.fn(async () => okJson({ content: [{ text: 'ok' }] }));
        vi.stubGlobal('fetch', fetchMock);

        await makeCtx().callAI('halo');

        expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('sk-app-1');
    });

    it('meneruskan pesan error dari body provider', async () => {
        localStorage.setItem('ai_provider', 'openai');
        localStorage.setItem('ai_api_key', 'sk-salah');
        vi.stubGlobal('fetch', vi.fn(async () => failJson({ error: { message: 'Invalid API key' } }, 401)));

        await expect(makeCtx().callAI('halo')).rejects.toThrow('Invalid API key');
    });

    it('melempar error teks mentah saat body OpenRouter bukan JSON', async () => {
        localStorage.setItem('ai_api_key', 'sk-or');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: false, status: 502, text: async () => 'Bad Gateway' })),
        );

        await expect(makeCtx().callAI('halo')).rejects.toThrow('Bad Gateway');
    });
});

describe('ai.js — analyzeKPI', () => {
    it('menolak jalan tanpa API key', async () => {
        const ctx = makeCtx();
        const out = await ctx.analyzeKPI();

        expect(out).toBeNull();
        expect(ctx.showNotification).toHaveBeenCalledWith('Please set API key first', 'error');
    });

    it('menyimpan hasil analisis dan menandai sukses', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        vi.stubGlobal('fetch', vi.fn(async () => okJson({ choices: [{ message: { content: 'ANALISIS' } }] })));

        const ctx = makeCtx({ apiKey: 'sk-test', logs: [{ woNumber: 'WO-1', Status: 'Pending' }] });
        const out = await ctx.analyzeKPI();

        expect(out).toBe('ANALISIS');
        expect(ctx.analysisResult).toBe('ANALISIS');
        expect(ctx.isAnalyzing).toBe(false);
        expect(ctx.showNotification).toHaveBeenCalledWith('Analysis complete!', 'success');
    });

    it('mengganti placeholder pada custom prompt sebelum dikirim', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        const fetchMock = vi.fn(async () => okJson({ choices: [{ message: { content: 'ok' } }] }));
        vi.stubGlobal('fetch', fetchMock);

        const ctx = makeCtx({
            apiKey: 'sk-test',
            customPrompt: 'Eq {equipment} WO {workorders} P {pending} D {downtime} Parts {parts}',
            logs: [
                { woNumber: 'WO-1', Status: 'Pending', Downtime: 7 },
                { woNumber: 'WO-2', Status: 'Completed' },
            ],
        });
        await ctx.analyzeKPI();

        const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
        expect(sent).toContain('Eq 0 WO 2 P 1 D 7 Parts 0');
        expect(sent).toContain('*Data Overview:*');
    });

    it('merotasi API key saat kena rate limit lalu mencoba lagi', async () => {
        localStorage.setItem('ai_api_key', 'sk-1');
        window.app = {
            activeApiKey: 'sk-2',
            rotateApiKey: vi.fn(),
            showNotification: vi.fn(),
        };
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(failJson({ error: { message: 'rate limit exceeded' } }, 429))
            .mockResolvedValueOnce(okJson({ choices: [{ message: { content: 'SUKSES-KEDUA' } }] }));
        vi.stubGlobal('fetch', fetchMock);

        const ctx = makeCtx();
        const out = await ctx.analyzeKPI();

        expect(out).toBe('SUKSES-KEDUA');
        expect(window.app.rotateApiKey).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('melaporkan "All API keys failed" saat semua percobaan gagal', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        vi.stubGlobal('fetch', vi.fn(async () => failJson({ error: { message: 'boom' } }, 500)));

        const ctx = makeCtx({ apiKey: 'sk-test' });
        const out = await ctx.analyzeKPI();

        expect(out).toBeNull();
        expect(ctx.showNotification).toHaveBeenCalledWith('All API keys failed', 'error');
        expect(ctx.isAnalyzing).toBe(false);
    });
});

describe('ai.js — rekomendasi & chat', () => {
    it('getAIRecommendations menolak tanpa API key', async () => {
        const ctx = makeCtx();
        await ctx.getAIRecommendations();

        expect(ctx.showNotification).toHaveBeenCalledWith('Silakan setting API key dulu', 'error');
    });

    it('getAIRecommendations melaporkan jumlah rekomendasi', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        const ctx = makeCtx();
        ctx.generateRecommendations = vi.fn(async () => [{ title: 'A' }, { title: 'B' }]);

        await ctx.getAIRecommendations();

        expect(ctx.showNotification).toHaveBeenCalledWith('Berhasil! 2 rekomendasi ditemukan', 'success');
    });

    it('getAIRecommendations melaporkan hasil kosong', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        const ctx = makeCtx();
        ctx.generateRecommendations = vi.fn(async () => []);

        await ctx.getAIRecommendations();

        expect(ctx.showNotification).toHaveBeenCalledWith('Tidak ada rekomendasi', 'warning');
    });

    it('getAIRecommendations menangkap error', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        const ctx = makeCtx();
        ctx.generateRecommendations = vi.fn(async () => {
            throw new Error('kuota habis');
        });

        await ctx.getAIRecommendations();

        expect(ctx.showNotification).toHaveBeenCalledWith('Error: kuota habis', 'error');
    });

    it('generateRecommendations mengembalikan [] bila window.app tidak ada', async () => {
        const ctx = makeCtx();
        await expect(ctx.generateRecommendations()).resolves.toEqual([]);
    });

    it('generateRecommendations mem-parse JSON array dari callAI', async () => {
        window.app = { showNotification: vi.fn() };
        const payload = [{ equipment: 'EQ1', title: 'Ganti bearing', priority: 'High' }];
        const ctx = makeCtx();
        ctx.callAI = vi.fn(async () => JSON.stringify(payload));

        await expect(ctx.generateRecommendations()).resolves.toEqual(payload);
        expect(ctx.callAI).toHaveBeenCalledTimes(1);
    });

    it('sendAIChat tidak melakukan apa-apa saat input kosong', async () => {
        const ctx = makeCtx({ aiChatInput: '   ' });
        await ctx.sendAIChat();

        expect(ctx.aiChatHistory).toEqual([]);
        expect(ctx.showNotification).not.toHaveBeenCalled();
    });

    it('sendAIChat meminta API key bila belum diset', async () => {
        const ctx = makeCtx({ aiChatInput: 'cek pompa' });
        await ctx.sendAIChat();

        expect(ctx.showNotification).toHaveBeenCalledWith('Silakan setting API key dulu', 'error');
        expect(ctx.aiChatHistory).toEqual([]);
    });

    it('sendAIChat menyimpan pertanyaan + jawaban ke riwayat', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        const ctx = makeCtx({ aiChatInput: 'cek pompa' });
        ctx.callAI = vi.fn(async () => 'pompa aman');

        await ctx.sendAIChat();

        expect(ctx.aiChatHistory).toEqual([
            { role: 'user', text: 'cek pompa' },
            { role: 'ai', text: 'pompa aman' },
        ]);
        expect(ctx.aiChatInput).toBe('');
        expect(ctx.aiIsAnalyzing).toBe(false);
    });

    it('sendAIChat mencatat error ke riwayat', async () => {
        localStorage.setItem('ai_api_key', 'sk-test');
        const ctx = makeCtx({ aiChatInput: 'cek pompa' });
        ctx.callAI = vi.fn(async () => {
            throw new Error('jaringan mati');
        });

        await ctx.sendAIChat();

        expect(ctx.aiChatHistory[1]).toEqual({ role: 'ai', text: 'Error: jaringan mati' });
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: jaringan mati', 'error');
    });

    it('clearAIChat mengosongkan riwayat', () => {
        const ctx = makeCtx({ aiChatHistory: [{ role: 'user', text: 'x' }] });
        ctx.clearAIChat();
        expect(ctx.aiChatHistory).toEqual([]);
    });
});

describe('ai.js — updateModelOptions', () => {
    it('menyediakan opsi OpenAI', () => {
        const ctx = makeCtx({ aiProvider: 'openai' });
        ctx.updateModelOptions();

        expect(ctx.aiModelOptions.map((o) => o.value)).toEqual(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']);
        expect(ctx.aiModel).toBe('gpt-4o');
    });

    it('menyediakan opsi Claude', () => {
        const ctx = makeCtx({ aiProvider: 'claude' });
        ctx.updateModelOptions();

        expect(ctx.aiModelOptions.map((o) => o.value)).toContain('claude-3-opus-20240229');
        expect(ctx.aiModel).toBe('claude-3-opus-20240229');
    });

    it('menyediakan opsi OpenRouter termasuk entri Custom Model', () => {
        const ctx = makeCtx({ aiProvider: 'openrouter' });
        ctx.updateModelOptions();

        expect(ctx.aiModelOptions.at(-1)).toEqual({ value: '__custom__', label: 'Custom Model...' });
        expect(ctx.aiModel).toBe('google/gemma-4-26b-a4b-it:free');
    });
});

// ───────────────────────────────────────────────────────────────────────────
// S30 lanjutan — sisa jalur yang belum tersentuh: error luar analyzeKPI,
// rotate pada generateRecommendations, error HTTP Claude, body OpenRouter
// bukan JSON, generatePPT + laporan cetak, siklus simpan/muat Firebase, dan
// setter `aiApiKey`.
// ───────────────────────────────────────────────────────────────────────────

/** Stub RTDB minimal: `window.db/ref/get/set`. */
function stubFirebase({ exists = true, data = null, throws = false } = {}) {
    window.db = { fake: true };
    window.ref = vi.fn((db, path) => ({ path }));
    const set = vi.fn(async () => {});
    window.set = set;
    window.get = vi.fn(async () => {
        if (throws) throw new Error('rtdb down');
        return { exists: () => exists, val: () => data };
    });
    return { set };
}

describe('ai.js — jalur error & cabang tersisa', () => {
    afterEach(() => {
        delete window.db;
        delete window.ref;
        delete window.get;
        delete window.set;
    });

    it('analyzeKPI menangkap kegagalan getKPIContext di catch luar', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({ apiKey: 'sk-test' });
        ctx.getKPIContext = () => {
            throw new Error('kpi rusak');
        };

        await expect(ctx.analyzeKPI()).resolves.toBeNull();

        expect(errSpy).toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('Error: kpi rusak', 'error');
        expect(ctx.isAnalyzing).toBe(false);
    });

    it('generateRecommendations merotasi key saat rate limit lalu menyerah dengan []', async () => {
        window.app = { rotateApiKey: vi.fn(), activeApiKey: 'sk-kedua', showNotification: vi.fn() };
        const ctx = makeCtx({ logs: [{ woNumber: 'WO-1', rca: 'Wear' }] });
        ctx.callAI = vi.fn(async () => {
            throw new Error('Rate Limit reached');
        });

        await expect(ctx.generateRecommendations()).resolves.toEqual([]);

        expect(ctx.callAI).toHaveBeenCalledTimes(5);
        expect(window.app.rotateApiKey).toHaveBeenCalledTimes(5);
        expect(ctx.apiKey).toBe('sk-kedua');
    });

    it('generateRecommendations aman saat app tidak punya rotateApiKey', async () => {
        window.app = { showNotification: vi.fn() };
        const ctx = makeCtx();
        ctx.callAI = vi.fn(async () => {
            throw new Error('quota exceeded');
        });

        await expect(ctx.generateRecommendations()).resolves.toEqual([]);
        expect(ctx.callAI).toHaveBeenCalledTimes(5);
    });

    it('generateRecommendations mengabaikan hasil yang bukan array berisi', async () => {
        window.app = { showNotification: vi.fn() };
        const ctx = makeCtx();
        ctx.callAI = vi.fn(async () => '{}');

        await expect(ctx.generateRecommendations()).resolves.toEqual([]);
        expect(ctx.callAI).toHaveBeenCalledTimes(5);
    });

    it('generateRecommendations menangkap kegagalan di dalam catch (rotate melempar)', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        window.app = {
            rotateApiKey: () => {
                throw new Error('rotate broken');
            },
            showNotification: vi.fn(),
        };
        const ctx = makeCtx();
        ctx.callAI = vi.fn(async () => {
            throw new Error('quota exceeded');
        });

        await expect(ctx.generateRecommendations()).resolves.toEqual([]);
        expect(errSpy).toHaveBeenCalled();
    });

    it('callAI memakai provider dari localStorage saat key eksplisit tanpa window.app', async () => {
        localStorage.setItem('ai_provider', 'openai');
        localStorage.setItem('ai_model', 'gpt-4o');
        const fetchMock = vi.fn(async () => okJson({ choices: [{ message: { content: 'ok' } }] }));
        vi.stubGlobal('fetch', fetchMock);

        const ctx = makeCtx();
        await expect(ctx.callAI('halo', 'sk-explicit')).resolves.toBe('ok');

        expect(ctx.apiProvider).toBe('openai');
        expect(fetchMock.mock.calls[0][0]).toContain('api.openai.com');
    });

    it('callClaude meneruskan pesan error dari body provider', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => failJson({ error: { message: 'claude down' } }, 500)));
        const ctx = makeCtx({ apiProvider: 'claude', apiKey: 'sk-claude' });

        await expect(ctx.callClaude('hi')).rejects.toThrow('claude down');
    });

    it('callOpenRouter melempar error saat body sukses bukan JSON', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: true, status: 200, text: async () => 'bukan json' }))
        );
        const ctx = makeCtx({ apiProvider: 'openrouter', apiKey: 'sk-test' });

        await expect(ctx.callOpenRouter('hi')).rejects.toThrow('Invalid response: bukan json');
    });

    it('rotateApiKey mengembalikan null saat semua slot lain kosong', () => {
        const ctx = makeCtx({ aiApiKeys: ['sk-a', '   ', ''], activeKeyIndex: 0 });
        expect(ctx.rotateApiKey()).toBeNull();
        expect(ctx.activeKeyIndex).toBe(0);
    });
});

describe('ai.js — generatePPT & laporan cetak', () => {
    it('generatePPT menolak saat belum ada hasil analisis', async () => {
        const ctx = makeCtx();
        await ctx.generatePPT();

        expect(ctx.showNotification).toHaveBeenCalledWith('Please analyze KPI first', 'error');
        expect(ctx.isGenerating).toBe(false);
    });

    it('generatePPT mendelegasikan ke exportModule.generateKPIPPT', async () => {
        const generateKPIPPT = vi.fn(async () => {});
        const ctx = makeCtx({ analysisResult: 'HASIL', exportModule: { generateKPIPPT } });

        await ctx.generatePPT();

        expect(generateKPIPPT).toHaveBeenCalledWith('HASIL', expect.objectContaining({ totalEquipment: 0 }));
        expect(ctx.showNotification).toHaveBeenCalledWith('PPT Generated!', 'success');
        expect(ctx.isGenerating).toBe(false);
    });

    it('generatePPT jatuh ke laporan sederhana saat exportModule tidak tersedia', async () => {
        const ctx = makeCtx({ analysisResult: 'HASIL' });
        ctx.generateSimpleReport = vi.fn(async () => {});

        await ctx.generatePPT();

        expect(ctx.generateSimpleReport).toHaveBeenCalledTimes(1);
        expect(ctx.isGenerating).toBe(false);
    });

    it('generatePPT menangkap kegagalan export', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = makeCtx({
            analysisResult: 'HASIL',
            exportModule: {
                generateKPIPPT: async () => {
                    throw new Error('ppt boom');
                },
            },
        });

        await ctx.generatePPT();

        expect(errSpy).toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to generate PPT', 'error');
        expect(ctx.isGenerating).toBe(false);
    });

    it('generateSimpleReport menulis HTML ke jendela cetak lalu mencetak saat onload', async () => {
        const write = vi.fn();
        const close = vi.fn();
        const print = vi.fn();
        const fakeWin = { document: { write, close }, print, onload: null };
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin);

        const ctx = makeCtx({
            analysisResult: 'HASIL AI',
            logs: [{ woNumber: 'WO-1', Status: 'Pending', Downtime: 4 }],
        });
        await ctx.generateSimpleReport();

        expect(openSpy).toHaveBeenCalledWith('', '_blank');
        const html = write.mock.calls[0][0];
        expect(html).toContain('KPI Analysis Report');
        expect(html).toContain('HASIL AI');
        expect(html).toContain('Total Downtime</td><td class="metric">4 hrs');
        expect(close).toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Report generated! Press Ctrl+P to save as PDF',
            'success'
        );

        fakeWin.onload();
        expect(print).toHaveBeenCalledTimes(1);
    });
});

describe('ai.js — simpan/muat Firebase', () => {
    afterEach(() => {
        delete window.db;
        delete window.ref;
        delete window.get;
        delete window.set;
    });

    it('loadAIFromFirebase menolak jalan tanpa admin / tanpa db', async () => {
        const ctx = makeCtx({ isAdmin: false, user: { email: 'x@y' } });
        await expect(ctx.loadAIFromFirebase()).resolves.toBe(false);

        window.db = {};
        ctx.isAdmin = true;
        ctx.user = null;
        await expect(ctx.loadAIFromFirebase()).resolves.toBe(false);
    });

    it('loadAIFromFirebase memuat beberapa key + provider/model/prompt', async () => {
        stubFirebase({
            data: {
                apiKey: 'k1',
                apiKeys: ['k1', 'k2', 'k3', 'k4', 'k5'],
                provider: 'claude',
                model: 'claude-3-haiku-20240307',
                customPrompt: 'prompt admin',
            },
        });
        const ctx = makeCtx({ isAdmin: true, user: { email: 'admin@x' } });

        await expect(ctx.loadAIFromFirebase()).resolves.toBe(true);

        expect(ctx.aiApiKeys).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
        expect(ctx.aiApiKeyInput1).toBe('k1');
        expect(ctx.aiApiKeyInput2).toBe('k2');
        expect(ctx.aiApiKeyInput5).toBe('k5');
        expect(ctx.aiProvider).toBe('claude');
        expect(ctx.aiModel).toBe('claude-3-haiku-20240307');
        expect(ctx.customPrompt).toBe('prompt admin');
        expect(window.ref).toHaveBeenCalledWith(window.db, 'AI_Settings/admin');
    });

    it('loadAIFromFirebase membungkus satu key tunggal jadi array', async () => {
        stubFirebase({ data: { apiKey: 'solo' } });
        const ctx = makeCtx({ isAdmin: true, user: {} });

        await expect(ctx.loadAIFromFirebase()).resolves.toBe(true);

        expect(ctx.aiApiKeys).toEqual(['solo']);
        expect(ctx.aiApiKeyInput1).toBe('solo');
        expect(ctx.aiApiKeyInput2).toBe('');
        expect(ctx.aiProvider).toBe('openrouter');
        expect(ctx.aiModel).toBe('');
    });

    it('loadAIFromFirebase mengembalikan false saat snapshot kosong', async () => {
        stubFirebase({ exists: false });
        const ctx = makeCtx({ isAdmin: true, user: {} });

        await expect(ctx.loadAIFromFirebase()).resolves.toBe(false);
    });

    it('loadAIFromFirebase menelan error RTDB', async () => {
        stubFirebase({ throws: true });
        const ctx = makeCtx({ isAdmin: true, user: {} });

        await expect(ctx.loadAIFromFirebase()).resolves.toBe(false);
    });

    it('saveAIToFirebase menulis payload lengkap sebagai admin', async () => {
        const { set } = stubFirebase();
        const ctx = makeCtx({
            isAdmin: true,
            user: { email: 'admin@x' },
            aiApiKeys: ['k1'],
            aiProvider: 'openai',
            customPrompt: 'cp',
        });

        await ctx.saveAIToFirebase('k1', 'gpt-4o');

        expect(set).toHaveBeenCalledTimes(1);
        const payload = set.mock.calls[0][1];
        expect(payload).toMatchObject({
            apiKey: 'k1',
            apiKeys: ['k1'],
            provider: 'openai',
            model: 'gpt-4o',
            customPrompt: 'cp',
            updatedBy: 'admin@x',
        });
        expect(typeof payload.updatedAt).toBe('string');
    });

    it('saveAIToFirebase memakai updatedBy admin saat user tanpa email', async () => {
        const { set } = stubFirebase();
        const ctx = makeCtx({ isAdmin: true, user: {}, aiApiKeys: [], customPrompt: '' });

        await ctx.saveAIToFirebase('k1', '');

        expect(set.mock.calls[0][1]).toMatchObject({ updatedBy: 'admin', model: '', customPrompt: '' });
    });

    it('saveAIToFirebase tidak menulis tanpa db atau tanpa admin', async () => {
        const ctx = makeCtx({ isAdmin: false });
        await expect(ctx.saveAIToFirebase('k', 'm')).resolves.toBeUndefined();

        const { set } = stubFirebase();
        ctx.isAdmin = false;
        await ctx.saveAIToFirebase('k', 'm');
        expect(set).not.toHaveBeenCalled();
    });

    it('saveAIToFirebase menelan error RTDB', async () => {
        const { set } = stubFirebase();
        set.mockImplementation(async () => {
            throw new Error('permission denied');
        });
        const ctx = makeCtx({ isAdmin: true, user: { email: 'a@b' }, aiApiKeys: [] });

        await expect(ctx.saveAIToFirebase('k', 'm')).resolves.toBeUndefined();
    });

    it('saveAIWithCustomModel menyaring input kosong dan memakai model custom', () => {
        const ctx = makeCtx({
            aiApiKeyInput1: ' k1 ',
            aiApiKeyInput2: '',
            aiApiKeyInput3: 'k2',
            aiApiKeyInput4: '   ',
            aiApiKeyInput5: 'k3',
            aiModel: '__custom__',
            customModelInput: ' my/custom-model ',
            aiProvider: 'openrouter',
            customPrompt: 'cp',
        });
        ctx.saveAIToFirebase = vi.fn();

        ctx.saveAIWithCustomModel();

        expect(ctx.aiApiKeys).toEqual(['k1', 'k2', 'k3']);
        expect(ctx.activeKeyIndex).toBe(0);
        expect(ctx.aiModel).toBe('my/custom-model');
        expect(localStorage.getItem('ai_api_keys_count')).toBe('3');
        expect(localStorage.getItem('ai_api_key_0')).toBe('k1');
        expect(localStorage.getItem('ai_api_key_2')).toBe('k3');
        expect(localStorage.getItem('ai_model')).toBe('my/custom-model');
        expect(localStorage.getItem('ai_provider')).toBe('openrouter');
        expect(localStorage.getItem('ai_custom_prompt')).toBe('cp');
        expect(localStorage.getItem('ai_active_key_index')).toBe('0');
        expect(ctx.saveAIToFirebase).toHaveBeenCalledWith('k1', 'my/custom-model');
        expect(ctx.showAPISettings).toBe(false);
    });

    it('saveAIWithCustomModel membiarkan model non-custom apa adanya', () => {
        const ctx = makeCtx({ aiApiKeyInput1: 'k1', aiModel: 'gpt-4o', aiProvider: 'openai' });
        ctx.saveAIToFirebase = vi.fn();

        ctx.saveAIWithCustomModel();

        expect(ctx.aiModel).toBe('gpt-4o');
        expect(ctx.aiApiKeys).toEqual(['k1']);
        expect(ctx.saveAIToFirebase).toHaveBeenCalledWith('k1', 'gpt-4o');
    });
});

describe('ai.js — setter aiApiKey', () => {
    it('mengisi slot pertama bila kosong dan menyimpan input', () => {
        const ctx = makeCtx({ aiApiKeys: [] });

        ctx.aiApiKey = 'sk-baru';

        expect(ctx.aiApiKeys[0]).toBe('sk-baru');
        expect(localStorage.getItem('ai_api_key_input_0')).toBe('sk-baru');
    });

    it('tidak menimpa slot pertama yang sudah terisi', () => {
        const ctx = makeCtx({ aiApiKeys: ['sk-lama'] });

        ctx.aiApiKey = 'sk-baru';

        expect(ctx.aiApiKeys[0]).toBe('sk-lama');
        expect(localStorage.getItem('ai_api_key_input_0')).toBe('sk-baru');
    });
});
