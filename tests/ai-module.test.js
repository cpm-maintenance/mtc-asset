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

    /**
     * ⚠️ KNOWN DEFECT (belum diperbaiki — menunggu keputusan user).
     *
     * `loadAISettings()` membaca `ai_model` dari localStorage, lalu memanggil
     * `updateModelOptions()` yang **menimpa** `this.aiModel` dengan opsi pertama
     * provider. Akibatnya: (a) model yang tersimpan hilang saat reload, dan
     * (b) cabang `Custom: <model>` di bawahnya **tidak pernah tercapai** karena
     * `this.aiModel` sudah pasti ada di `aiModelOptions`.
     *
     * Test ini mengunci perilaku SEKARANG. Kalau diperbaiki (mis. pindahkan
     * `updateModelOptions()` sebelum pembacaan `ai_model`), ubah test ini.
     */
    it('KNOWN DEFECT: model tersimpan dari localStorage tertimpa opsi pertama provider', async () => {
        localStorage.setItem('ai_provider', 'openrouter');
        localStorage.setItem('ai_model', 'vendor/model-x');

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
