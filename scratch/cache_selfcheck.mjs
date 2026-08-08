// Self-check: cache invalidation logic mirrors (uses plain objects to simulate Alpine proxy-less behavior)
// Verify: caches invalidate on array ref change, keyed lookups return correct values.

function makeCacheHolder() {
  return {
    _lastHM: null, _lastHMLogsRef: null,
    logs: [],
    getLastHM(equipId) {
      if (!equipId) return '-';
      if (this._lastHM !== null && this._lastHMLogsRef === this.logs) {
        if (this._lastHM.has(equipId)) return this._lastHM.get(equipId);
      }
      const logs = (this.logs || []).filter(l => l && l.EquipmentID === equipId && Number(l.HM) > 0);
      if (!logs.length) return '-';
      logs.sort((a, b) => (a.Tanggal || '').localeCompare(b.Tanggal || ''));
      const val = Number(logs[logs.length - 1].HM).toLocaleString();
      if (this._lastHM === null) this._lastHM = new Map();
      this._lastHM.set(equipId, val);
      this._lastHMLogsRef = this.logs;
      return val;
    },
    _kpiCache: null,
    equipment: [],
    _raw(x) { return x; },
    _kpiKey(extra) { return (this.logs || []).length + '|' + (this.equipment || []).length + '|' + (extra || ''); },
    calculateHealthScore(equipId) {
      if (!equipId) return { score: 100 };
      const key = this._kpiKey('h' + equipId);
      if (this._kpiCache && this._kpiCache.key === key && this._kpiCache.h.has(equipId)) {
        return this._kpiCache.h.get(equipId);
      }
      if (!this._kpiCache || this._kpiCache.key !== key) {
        this._kpiCache = { key, h: new Map(), m: new Map() };
      }
      const logs = this._raw(this.logs) || [];
      const equipment = this._raw(this.equipment) || [];
      const assetLogs = logs.filter(l => l && l.EquipmentID === equipId);
      const asset = equipment.find(e => e && e.EquipmentID === equipId);
      if (!asset) return { score: 100 };
      const breakdowns = assetLogs.filter(l => l && l.Jenis === 'Breakdown');
      const result = { score: 100 - breakdowns.length * 15, breakdowns: breakdowns.length };
      this._kpiCache.h.set(equipId, result);
      return result;
    },
    _pmHM: null, _pmHMRef: null, _pmHMEqRef: null,
    _pmHMMap() {
      if (!this._pmHM || this._pmHMRef !== this.logs || this._pmHMEqRef !== this.equipment) {
        const map = new Map();
        const eqMap = new Map((this.equipment || []).map(e => [e && e.EquipmentID, Number(e && e.CurrentHM) || 0]));
        const lastHM = new Map();
        (this.logs || []).forEach(l => {
          if (!l || !l.EquipmentID) return;
          const hm = Number(l.HM);
          if (hm <= 0) return;
          const prev = lastHM.get(l.EquipmentID);
          if (!prev || (l.Tanggal || '') > prev.date) lastHM.set(l.EquipmentID, { date: l.Tanggal || '', hm });
        });
        (this.equipment || []).forEach(e => {
          if (!e) return;
          const id = e.EquipmentID;
          const eqHM = eqMap.get(id) || 0;
          const last = lastHM.get(id);
          map.set(id, eqHM > 0 ? eqHM : (last ? last.hm : 0));
        });
        this._pmHM = map;
        this._pmHMRef = this.logs;
        this._pmHMEqRef = this.equipment;
      }
      return this._pmHM;
    },
    pmCurrentHM(equipId) { if (!equipId) return 0; return this._pmHMMap().get(equipId) || 0; },
  };
}

let pass = 0, fail = 0;
const eq = (a, b, msg) => { if (a === b) pass++; else { fail++; console.error('FAIL:', msg, 'got', a, 'want', b); } };

// --- getLastHM cache ---
const a = makeCacheHolder();
a.logs = [
  { EquipmentID: 'E1', HM: 100, Tanggal: '2026-01-01' },
  { EquipmentID: 'E1', HM: 250, Tanggal: '2026-02-01' },
  { EquipmentID: 'E2', HM: 50, Tanggal: '2026-01-01' },
];
eq(a.getLastHM('E1'), '250', 'getLastHM E1');
eq(a.getLastHM('E2'), '50', 'getLastHM E2');
eq(a.getLastHM('E1'), '250', 'getLastHM E1 cached');
a.logs = [...a.logs, { EquipmentID: 'E1', HM: 300, Tanggal: '2026-03-01' }];
eq(a.getLastHM('E1'), '300', 'getLastHM invalidated on new logs');

// --- health score cache ---
const b = makeCacheHolder();
b.equipment = [{ EquipmentID: 'E1', criticality: 'High' }];
b.logs = [
  { EquipmentID: 'E1', Jenis: 'Breakdown' },
  { EquipmentID: 'E1', Jenis: 'Breakdown' },
  { EquipmentID: 'E1', Jenis: 'PM' },
];
eq(b.calculateHealthScore('E1').score, 70, 'health score 2 breakdowns');
eq(b.calculateHealthScore('E1').score, 70, 'health score cached');
b.logs = [...b.logs, { EquipmentID: 'E1', Jenis: 'Breakdown' }];
eq(b.calculateHealthScore('E1').score, 55, 'health score invalidated');

// --- pmCurrentHM cache ---
const c = makeCacheHolder();
c.equipment = [{ EquipmentID: 'E1', CurrentHM: 0 }];
c.logs = [
  { EquipmentID: 'E1', HM: 120, Tanggal: '2026-01-01' },
  { EquipmentID: 'E1', HM: 180, Tanggal: '2026-02-01' },
];
eq(c.pmCurrentHM('E1'), 180, 'pmCurrentHM last log');
c.equipment = [{ EquipmentID: 'E1', CurrentHM: 500 }];
eq(c.pmCurrentHM('E1'), 500, 'pmCurrentHM meter wins');
c.equipment = [{ EquipmentID: 'E1', CurrentHM: 0 }];
c.logs = [...c.logs, { EquipmentID: 'E1', HM: 220, Tanggal: '2026-03-01' }];
eq(c.pmCurrentHM('E1'), 220, 'pmCurrentHM invalidated');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
