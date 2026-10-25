// @vitest-environment jsdom
/**
 * Component tests — Alpine.js reactivity + store actions.
 *
 * Each test gets a *fresh* Alpine instance (via vi.resetModules + dynamic
 * import) so components can be mounted independently. The component is backed
 * by the project's real equipment / parts / logs / requisition modules, driven
 * through DOM events, asserting both Firebase calls and reactive DOM updates.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// ---------------------------------------------------------------------------
// Firebase surface mock
// ---------------------------------------------------------------------------
function setupFirebase() {
    const set = vi.fn(async () => {});
    const update = vi.fn(async () => {});
    const remove = vi.fn(async () => {});
    const runTransaction = vi.fn(async (_ref, fn) => fn(0));
    const get = vi.fn(async () => ({ val: () => null, exists: () => false }));
    window.db = { name: 'mock-db' };
    window.ref = vi.fn((_db, path) => ({ path }));
    window.query = vi.fn((ref, ...c) => ({ ref, c }));
    window.limitToLast = vi.fn((n) => ({ n }));
    window.endBefore = vi.fn((k) => ({ k }));
    window.orderByChild = vi.fn((f) => ({ f }));
    window.endAt = vi.fn((v) => ({ v }));
    window.equalTo = vi.fn((v) => ({ v }));
    window.onValue = vi.fn(() => vi.fn());
    window.onChildAdded = vi.fn(() => vi.fn());
    window.set = set;
    window.update = update;
    window.remove = remove;
    window.runTransaction = runTransaction;
    window.get = get;
    return { set, update, remove, runTransaction, get };
}

/** Shared reactive state that the modules expect on `this`. */
function baseState(overrides = {}) {
    return {
        isLoading: false,
        isOnline: true,
        isLoggedIn: true,
        user: { uid: 'uid-admin', email: 'admin@mtc.test' },
        userRole: 'admin',
        notifications: [],
        equipment: [],
        allParts: [],
        logs: [],
        requisitions: [],
        dashboardStats: { totalEquip: 0, overduePM: 0, lowStock: 0, totalDowntime: 0 },
        selectedEquip: null,
        currentPage: 'dash',
        activeTab: 'hist',
        showEquipModal: false,
        isEditingEquip: false,
        equipForm: null,
        tempEquipFile: null,
        showPartModal: false,
        isEditingPart: false,
        partForm: null,
        showReqModal: false,
        reqLoading: false,
        reqEditMode: false,
        reqEditId: '',
        reqLineItems: [],
        reqPriority: 'normal',
        reqNotes: '',
        reqWoId: '',
        reqWoNumber: '',
        showNotification: vi.fn(),
        confirmDelete: vi.fn(async () => true),
        saveToIndexedDB: vi.fn(async () => {}),
        queueOfflineOperation: vi.fn(async () => true),
        showCropModal: vi.fn(),
        uploadImage: vi.fn(async () => 'https://img.test/x.jpg'),
        ...overrides,
    };
}

let fb;

// alpinejs lives in node_modules and is not reset by vi.resetModules, so calling
// Alpine.start() for each fresh tree emits a cosmetic warning. Silence only that one.
const originalWarn = console.warn;
console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Alpine has already been initialized')) return;
    originalWarn(...args);
};

/**
 * Mount a fixture on a fresh Alpine instance and return the live reactive proxy.
 * @returns {Promise<any>} the Alpine reactive data object (proxy)
 */
async function mount(html, overrides = {}) {
    vi.resetModules();
    // Swallow Alpine's auto-start; we start the tree manually.
    window.deferLoadingAlpine = () => {};

    const Alpine = (await import('alpinejs')).default;
    const { equipmentModule } = await import('../src/js/modules/equipment.js');
    const { partsModule } = await import('../src/js/modules/parts.js');
    const { logsModule } = await import('../src/js/modules/logs.js');
    const { requisitionModule } = await import('../src/js/modules/requisition.js');

    window.Alpine = Alpine;

    const state = {
        ...equipmentModule,
        ...partsModule,
        ...logsModule,
        ...requisitionModule,
        ...baseState(),
        ...overrides,
    };
    // Derived role getters (mimic app.js) — resolved once for the test.
    state.isAdmin = state.userRole === 'admin';
    state.isAdminOrSupervisor = state.userRole === 'admin' || state.userRole === 'supervisor';

    Alpine.data('mtcTest', () => state);
    document.body.innerHTML = `<div x-data="mtcTest">${html}</div>`;
    Alpine.start();
    return document.body.firstElementChild._x_dataStack[0];
}

beforeEach(() => {
    fb = setupFirebase();
    delete window.app;
    delete window.appState;
});

// ---------------------------------------------------------------------------
// Equipment CRUD
// ---------------------------------------------------------------------------
describe('Alpine component — Equipment CRUD', () => {
    it('opens the add form with defaults when "add" is clicked', async () => {
        const ctx = await mount('<button @click="openEquipModal(false)">add</button>');

        fireEvent.click(screen.getByText('add'));

        await waitFor(() => expect(ctx.showEquipModal).toBe(true));
        expect(ctx.isEditingEquip).toBe(false);
        expect(ctx.equipForm).toBeTruthy();
        expect(ctx.equipForm.id).toBe('');
    });

    it('prefills the form from the clicked row (edit)', async () => {
        const row = { EquipmentID: 'EQ1', Nama: 'Crusher', Tipe: 'Crusher', Criticality: 'High' };
        const ctx = await mount('<button @click="openEquipModal(true, row)">edit</button>', { row });

        fireEvent.click(screen.getByText('edit'));

        await waitFor(() => expect(ctx.showEquipModal).toBe(true));
        expect(ctx.isEditingEquip).toBe(true);
        expect(ctx.equipForm.id).toBe('EQ1');
        expect(ctx.equipForm.nama).toBe('Crusher');
        expect(ctx.equipForm.criticality).toBe('High');
    });

    it('submits a new equipment and writes to Firebase + updates local list', async () => {
        const ctx = await mount('<button @click="submitEquipment()">save</button>', {
            equipForm: { id: 'EQ9', nama: 'Pump', tipe: 'Pump', lokasi: 'Z', status: 'Active', sn: '', current: 0, tglInstalasi: '', vendor: '', foto: '', nextPM: '', criticality: 'Low' },
        });

        fireEvent.click(screen.getByText('save'));

        await waitFor(() => expect(fb.set).toHaveBeenCalled());
        const [ref, payload] = fb.set.mock.calls[0];
        expect(ref.path).toBe('Equipment/EQ9');
        expect(payload.Nama).toBe('Pump');
        expect(payload.createdBy).toBe('uid-admin');
        await waitFor(() => expect(ctx.equipment.some((e) => e.EquipmentID === 'EQ9')).toBe(true));
    });

    it('reactively renders the equipment count in the DOM', async () => {
        const ctx = await mount('<span id="count" x-text="equipment.length"></span>');
        expect(document.getElementById('count').textContent).toBe('0');

        ctx.equipment.push({ EquipmentID: 'EQ1' });

        await waitFor(() => expect(document.getElementById('count').textContent).toBe('1'));
    });
});

// ---------------------------------------------------------------------------
// Spare parts CRUD
// ---------------------------------------------------------------------------
describe('Alpine component — Spare parts CRUD', () => {
    it('opens the add-part form with empty defaults', async () => {
        const ctx = await mount('<button @click="openPartModal(false)">addPart</button>');
        fireEvent.click(screen.getByText('addPart'));
        await waitFor(() => expect(ctx.showPartModal).toBe(true));
        expect(ctx.partForm.id).toBe('');
        expect(ctx.partForm.stok).toBe(0);
    });

    it('prefills from an existing part and normalises EquipmentIDs array', async () => {
        const part = { PartID: 'P1', NamaPart: 'Bearing', EquipmentIDs: ['EQ1', 'EQ2'], Stok: 5, MinStock: 1 };
        const ctx = await mount('<button @click="openPartModal(true, part)">editPart</button>', { part });
        fireEvent.click(screen.getByText('editPart'));
        await waitFor(() => expect(ctx.showPartModal).toBe(true));
        expect(ctx.partForm.id).toBe('P1');
        expect(ctx.partForm.equipIds).toEqual(['EQ1', 'EQ2']);
        expect(ctx.partForm.stok).toBe(5);
    });

    it('blocks non-admin users from submitting a part', async () => {
        const ctx = await mount('<button @click="submitSparePart()">savePart</button>', {
            userRole: 'user',
            partForm: { id: 'P1', nama: 'Bearing', equipIds: [], stok: 5, minStock: 1, harga: 100 },
        });

        fireEvent.click(screen.getByText('savePart'));

        await waitFor(() => expect(ctx.showNotification).toHaveBeenCalledWith(expect.stringContaining('Admin'), 'error'));
        expect(fb.set).not.toHaveBeenCalled();
    });

    it('submits a valid part as admin and flags low stock', async () => {
        const ctx = await mount('<button @click="submitSparePart()">savePart</button>', {
            partForm: { id: 'P2', nama: 'Seal', namaSingkat: '', partNumber: '', equipIds: ['EQ1'], stok: 5, minStock: 5, lokasi: '', vendor: '', harga: 50, foto: '', lastReplaceDate: '', avgLifetimeDays: '', avgLifetimeHours: '', usageHours: '' },
        });

        fireEvent.click(screen.getByText('savePart'));

        await waitFor(() => expect(fb.set).toHaveBeenCalled());
        const [, payload] = fb.set.mock.calls[0];
        expect(payload.PartID).toBe('P2');
        expect(payload.isLowStock).toBe(true);
        expect(payload.EquipmentID).toBe('EQ1');
        await waitFor(() => expect(ctx.allParts.some((p) => p.PartID === 'P2')).toBe(true));
    });
});

// ---------------------------------------------------------------------------
// Work Order approval
// ---------------------------------------------------------------------------
describe('Alpine component — Work Order approval', () => {
    const wo = { LogID: 'L1', woNumber: 'WO-1', PartsUsed: '[]', Status: 'Pending' };

    it('approves a WO as admin/supervisor and writes status to Firebase', async () => {
        const ctx = await mount('<button @click="approveWO(\'L1\')">approve</button>', { logs: [{ ...wo }] });
        // Guard S39: approveWO memeriksa dulu apakah node-nya masih ada.
        fb.get.mockResolvedValue({ val: () => ({ LogID: 'L1' }), exists: () => true });

        fireEvent.click(screen.getByText('approve'));

        await waitFor(() => expect(fb.update).toHaveBeenCalled());
        const [ref, payload] = fb.update.mock.calls[0];
        expect(ref.path).toBe('HistoryLog/L1');
        expect(payload.Status).toBe('Approved');
        expect(ctx.logs.find((l) => l.LogID === 'L1').Status).toBe('Approved');
    });

    it('refuses to approve when the user is not admin/supervisor', async () => {
        const ctx = await mount('<button @click="approveWO(\'L1\')">approve</button>', {
            userRole: 'user',
            logs: [{ ...wo }],
        });

        fireEvent.click(screen.getByText('approve'));

        await waitFor(() => expect(ctx.showNotification).toHaveBeenCalledWith(expect.stringContaining('supervisor'), 'error'));
        expect(fb.update).not.toHaveBeenCalled();
    });

    it('deducts spare-part stock on approve via transaction', async () => {
        await mount('<button @click="approveWO(\'L2\')">approve</button>', {
            logs: [{ LogID: 'L2', woNumber: 'WO-2', Status: 'Pending', PartsUsed: '[{"id":"P1","qty":2}]' }],
            allParts: [{ PartID: 'P1', Stok: 10 }],
        });

        // Guard S39: node WO harus ada supaya approve lanjut memotong stok.
        fb.get.mockResolvedValue({ val: () => ({ LogID: 'L2' }), exists: () => true });

        fireEvent.click(screen.getByText('approve'));

        await waitFor(() => expect(fb.runTransaction).toHaveBeenCalled());
        expect(fb.runTransaction.mock.calls[0][0].path).toBe('SpareParts/P1/Stok');
    });

    it('renders the approve button only for privileged roles', async () => {
        await mount('<template x-if="userRole === \'admin\' || userRole === \'supervisor\'"><button>approve-ui</button></template>', {
            userRole: 'admin',
        });
        await waitFor(() => expect(screen.queryByText('approve-ui')).toBeTruthy());
    });
});

// ---------------------------------------------------------------------------
// Requisition flow
// ---------------------------------------------------------------------------
describe('Alpine component — Requisition flow', () => {
    it('rejects submit when no valid line items exist', async () => {
        const ctx = await mount('<button @click="submitRequisition()">req</button>', {
            reqLineItems: [{ itemName: '', quantity: 0 }],
        });

        fireEvent.click(screen.getByText('req'));

        await waitFor(() => expect(ctx.showNotification).toHaveBeenCalledWith(expect.stringContaining('Minimal 1 item'), 'error'));
        expect(fb.set).not.toHaveBeenCalled();
    });

    it('creates a pending requisition owned by the current user', async () => {
        const ctx = await mount('<button @click="submitRequisition()">req</button>', {
            reqLineItems: [{ itemName: 'Bearing', itemType: 'part', quantity: 3 }],
            reqPriority: 'high',
        });

        fireEvent.click(screen.getByText('req'));

        await waitFor(() => expect(fb.set).toHaveBeenCalled());
        const [ref, payload] = fb.set.mock.calls[0];
        expect(ref.path).toMatch(/^Requisitions\/REQ_/);
        expect(payload.status).toBe('pending');
        expect(payload.createdBy).toBe('uid-admin');
        expect(payload.quantity).toBe(3);
        await waitFor(() => expect(ctx.requisitions).toHaveLength(1));
    });

    it('adds a line item through the UI action', async () => {
        const ctx = await mount('<button @click="reqAddLineItem()">addline</button>', {
            reqLineItems: [{ itemName: 'x', itemType: 'part', quantity: 1 }],
        });
        fireEvent.click(screen.getByText('addline'));
        await waitFor(() => expect(ctx.reqLineItems.length).toBe(2));
    });
});
