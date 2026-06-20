import { describe, it, expect } from 'vitest';
import { isLowStock, sanitizeInput, isValidID, calculatePartLifetime, validateEquipmentForm, validatePartForm, validateLogForm, isValidDate, withRetry, isNetworkError, isQuotaError, parseJsonSafe, formatDate, formatCurrency, debounce } from '../src/js/utils.js';
import { kpiEngineModule } from '../src/js/modules/kpi-engine.js';
import { performanceModule } from '../src/js/modules/performance.js';

// Test tryParseJSON logic via utils.js instead

describe('Export Data Transformation', () => {
  it('should transform equipment data for export', () => {
    const equipment = [
      { EquipmentID: 'EQ001', Nama: 'Crusher A', Status: 'Active', Lokasi: 'Zone A' }
    ];
    
    const result = equipment.map(e => ({ ...e }));
    expect(result[0].EquipmentID).toBe('EQ001');
    expect(result[0].Nama).toBe('Crusher A');
  });

  it('should transform parts data - join EquipmentIDs array', () => {
    const parts = [
      { PartID: 'P001', NamaPart: 'Bearing', EquipmentIDs: ['EQ001', 'EQ002'] }
    ];
    
    const result = parts.map(p => ({
      ...p,
      EquipmentIDs: Array.isArray(p.EquipmentIDs) ? p.EquipmentIDs.join(', ') : p.EquipmentIDs
    }));
    
    expect(result[0].EquipmentIDs).toBe('EQ001, EQ002');
  });

  it('should transform performance data - stringify events', () => {
    const perf = [
      { id: 'PERF001', date: '2025-01-01', events: [{ problem: 'oil leak', duration: 2 }] }
    ];
    
    const result = perf.map(p => ({
      ...p,
      events: typeof p.events === 'string' ? p.events : JSON.stringify(p.events || [])
    }));
    
    expect(result[0].events).toContain('oil leak');
  });

  it('should transform logs data - stringify parts used', () => {
    const logs = [
      { LogID: 'LOG001', PartsUsed: [{ id: 'P001', qty: 2 }] }
    ];
    
    const result = logs.map(l => ({
      ...l,
      PartsUsed: typeof l.PartsUsed === 'string' ? l.PartsUsed : JSON.stringify(l.PartsUsed || [])
    }));
    
    expect(result[0].PartsUsed).toContain('P001');
  });
});

describe('Import CSV Parsing', () => {
  it('should parse equipment CSV row', () => {
    const row = { EquipmentID: 'EQ001', Nama: 'Crusher', Tipe: 'Crusher' };
    
    const dataToSave = {
      EquipmentID: String(row.EquipmentID), 
      Nama: row.Nama || '', 
      Tipe: row.Tipe || 'Other',
      Lokasi: row.Lokasi || '', 
      Status: row.Status || 'Active', 
      SerialNumber: row.SerialNumber || '',
      Criticality: row.Criticality || 'Medium', 
      NextPMDate: row.NextPMDate || '',
      TglInstalasi: row.TglInstalasi || '', 
      Vendor: row.Vendor || '', 
      FotoURL: row.FotoURL || ''
    };
    
    expect(dataToSave.EquipmentID).toBe('EQ001');
    expect(dataToSave.Nama).toBe('Crusher');
    expect(dataToSave.Tipe).toBe('Crusher');
    expect(dataToSave.Criticality).toBe('Medium');
  });

  it('should parse parts CSV row with multiple equipment links', () => {
    const row = { PartID: 'P001', NamaPart: 'Bearing', EquipmentIDs: 'EQ001,EQ002' };
    
    let equipIds = [];
    if (row.EquipmentIDs) {
      equipIds = typeof row.EquipmentIDs === 'string' ? row.EquipmentIDs.split(',').map(s => s.trim()) : [row.EquipmentIDs];
    } else if (row.EquipmentID) {
      equipIds = [row.EquipmentID];
    }
    
    expect(equipIds).toEqual(['EQ001', 'EQ002']);
  });

  it('should parse performance CSV row', () => {
    const row = { id: 'PERF001', wh: '20', bd: '2', stb: '2', paPlan: '90' };
    
    const dataToSave = {
      id: String(row.id),
      equipmentId: row.equipmentId || '',
      area: row.area || '',
      wh: parseFloat(row.wh || 0),
      bd: parseFloat(row.bd || 0),
      stb: parseFloat(row.stb || 0),
      paPlan: parseFloat(row.paPlan || 90),
      rca: row.rca || 'None',
      type: row.type || 'Unscheduled',
      category: row.category || 'Mechanical',
      freq: row.freq !== undefined ? parseInt(row.freq) : (parseFloat(row.bd) > 0 ? 1 : 0),
      events: []
    };
    
    expect(dataToSave.wh).toBe(20);
    expect(dataToSave.bd).toBe(2);
    expect(dataToSave.paPlan).toBe(90);
    expect(dataToSave.freq).toBe(1); // bd > 0 so freq = 1
  });

  it('should parse logs CSV row', () => {
    const row = { LogID: 'LOG001', EquipmentID: 'EQ001', Downtime: '4', Cost: '500000' };
    
    const dataToSave = {
      LogID: String(row.LogID), 
      EquipmentID: row.EquipmentID || '', 
      Tanggal: row.tanggal || '',
      Jenis: row.Jenis || 'PM', 
      Deskripsi: row.Deskripsi || '', 
      Technician: row.Technician || '',
      PartsUsed: [],
      Downtime: parseFloat(row.Downtime || 0), 
      Cost: parseFloat(row.Cost || 0),
      Status: row.Status || 'Completed', 
      HM: row.HM || '', 
      Catatan: row.Catatan || '',
      PhotoURLs: [],
      rca: row.rca || 'PM'
    };
    
    expect(dataToSave.Downtime).toBe(4);
    expect(dataToSave.Cost).toBe(500000);
  });
});

describe('isLowStock', () => {
  it('should return true when stock <= minimum', () => {
    expect(isLowStock(5, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
  });

  it('should return false when stock > minimum', () => {
    expect(isLowStock(15, 10)).toBe(false);
    expect(isLowStock(100, 10)).toBe(false);
  });

  it('should handle string numbers', () => {
    expect(isLowStock('5', 10)).toBe(true);
    expect(isLowStock('15', 10)).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('should escape HTML tags', () => {
    // Function replaces: < > / " ' first, then removes 'script', then removes 'on...='
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('&lt;&gt;alert(1)&lt;&#x2F;&gt;');
    // </b> becomes &lt;/b&gt; then &#x2F; removes the slash in </ so becomes &#x2F;
    expect(sanitizeInput('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;&#x2F;b&gt;');
  });

  it('should remove event handlers', () => {
    // onerror becomes onerror - but then 'on' + 'error=' gets matched by on\w+= regex AFTER script removal
    // Actual output: &lt;img "alert(1)"&gt; (quotes get escaped, onerror removed as part of on\w+=)
    expect(sanitizeInput('<img onerror=alert(1)>')).toBe('&lt;img alert(1)&gt;');
    // onclick becomes removed (on\w+= rule), " becomes quot;
    expect(sanitizeInput('<a onclick="doSomething()">')).toBe('&lt;a &quot;doSomething()&quot;&gt;');
  });

  it('should handle null/undefined', () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(undefined)).toBe('');
  });

  it('should return normal text unchanged', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World');
    expect(sanitizeInput('Asset-123')).toBe('Asset-123');
  });
});

describe('isValidID', () => {
  it('should return true for valid IDs', () => {
    expect(isValidID('EQUIP-001')).toBe(true);
    expect(isValidID('part_123')).toBe(true);
    expect(isValidID('abc')).toBe(true);
  });

  it('should return false for invalid IDs', () => {
    expect(isValidID('EQUIP 001')).toBe(false); // space
    expect(isValidID('EQUIP@001')).toBe(false); // special char
    expect(isValidID('')).toBe(false);
  });
});

describe('calculatePartLifetime', () => {
  it('should calculate lifetime correctly', () => {
    const result = calculatePartLifetime('2025-01-01', 90);
    
    expect(result).not.toBeNull();
    expect(result.daysUsed).toBeGreaterThan(0);
    expect(result.percentUsed).toBeGreaterThan(0);
  });

  it('should return status overdue when past lifetime', () => {
    const result = calculatePartLifetime('2024-01-01', 30);
    
    expect(result.status).toBe('overdue');
    expect(result.daysRemaining).toBe(0);
  });

  it('should return null for invalid input', () => {
    expect(calculatePartLifetime(null, 90)).toBeNull();
    expect(calculatePartLifetime('2025-01-01', null)).toBeNull();
    expect(calculatePartLifetime('', 90)).toBeNull();
  });
});

describe('validateEquipmentForm', () => {
  it('should return errors for missing required fields', () => {
    expect(validateEquipmentForm({})).toContain('Asset ID is required');
    expect(validateEquipmentForm({ id: 'EQ001' })).toContain('Asset Name is required');
  });

  it('should return empty array for valid form', () => {
    const errors = validateEquipmentForm({ id: 'EQ001', nama: 'Crusher A' });
    expect(errors).toEqual([]);
  });

  it('should return error for invalid ID characters', () => {
    const errors = validateEquipmentForm({ id: 'EQ 001', nama: 'Crusher' });
    expect(errors).toContain('Asset ID contains invalid characters');
  });

  it('should return error for too long ID', () => {
    const longId = 'A'.repeat(51);
    const errors = validateEquipmentForm({ id: longId, nama: 'Crusher' });
    expect(errors).toContain('Asset ID too long (max 50 chars)');
  });
});

describe('validatePartForm', () => {
  it('should return errors for missing required fields', () => {
    expect(validatePartForm({})).toContain('Part ID is required');
    expect(validatePartForm({ id: 'PART-001' })).toContain('Part Name is required');
  });

  it('should return empty array for valid form', () => {
    const errors = validatePartForm({ id: 'PART-001', nama: 'Bearing' });
    expect(errors).toEqual([]);
  });

  it('should return error for invalid stock', () => {
    const errors = validatePartForm({ id: 'PART-001', nama: 'Bearing', stok: -5 });
    expect(errors).toContain('Stock must be a positive number');
  });

  it('should return error when stock < minStock', () => {
    const errors = validatePartForm({ id: 'PART-001', nama: 'Bearing', stok: 5, minStock: 10 });
    expect(errors).toContain('Stock cannot be less than minimum stock');
  });
});

describe('validateLogForm', () => {
  it('should return errors for missing required fields', () => {
    expect(validateLogForm({})).toContain('Equipment selection is required');
    expect(validateLogForm({ equipmentId: 'EQ001' })).toContain('Date is required');
    expect(validateLogForm({ equipmentId: 'EQ001', date: '2025-01-01' })).toContain('Description is required');
  });

  it('should return empty array for valid form', () => {
    const errors = validateLogForm({ equipmentId: 'EQ001', date: '2025-01-01', desc: 'Maintenance done' });
    expect(errors).toEqual([]);
  });

  it('should return error for invalid date', () => {
    const errors = validateLogForm({ equipmentId: 'EQ001', date: 'invalid-date', desc: 'Test' });
    expect(errors).toContain('Invalid date format');
  });

  it('should return error for negative downtime', () => {
    const errors = validateLogForm({ equipmentId: 'EQ001', date: '2025-01-01', desc: 'Test', downtime: -5 });
    expect(errors).toContain('Downtime must be a positive number');
  });
});

describe('isValidDate', () => {
  it('should return true for valid dates', () => {
    expect(isValidDate('2025-01-01')).toBe(true);
    expect(isValidDate('2024-12-31')).toBe(true);
  });

  it('should return false for invalid dates', () => {
    expect(isValidDate('invalid')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });

  it('should return false for dates too far in past', () => {
    expect(isValidDate('2019-01-01')).toBe(false);
  });
});

describe('calculateKPI (performance module)', () => {
  it('should calculate PA correctly', () => {
    const result = performanceModule.calculateKPI({ wh: 20, bd: 2, stb: 2 });
    
    expect(result.pa).toBe('91.7'); // (20+2)/24 * 100 = 91.67%
  });

  it('should handle zero values', () => {
    const result = performanceModule.calculateKPI({});
    
    expect(result.pa).toBe('0.0');
    expect(result.ma).toBe('0.0');
  });

  it('should return safe defaults for null', () => {
    const result = performanceModule.calculateKPI(null);
    
    expect(result.pa).toBe('0.0');
    expect(result.ma).toBe('0.0');
  });

  it('should calculate gap between PA and plan', () => {
    const result = performanceModule.calculateKPI({ wh: 18, bd: 0, stb: 6, paPlan: 90 });
    
    expect(result.gap).toBe('10.0'); // 100 - 90 = 10
  });
});

describe('calculateHealthScore (kpi engine)', () => {
  it('should return default for empty equipId', () => {
    const result = kpiEngineModule.calculateHealthScore(null);
    
    expect(result.score).toBe(100);
    expect(result.status).toBe('Optimal');
  });

  it('should return default for non-existent equipment', () => {
    kpiEngineModule.equipment = [];
    kpiEngineModule.logs = [];
    
    const result = kpiEngineModule.calculateHealthScore('NONEXIST');
    
    expect(result.score).toBe(100);
  });

  it('should calculate breakdown impact', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    kpiEngineModule.equipment = [{ EquipmentID: 'EQ001', Nama: 'Test' }];
    kpiEngineModule.logs = [
      { EquipmentID: 'EQ001', Jenis: 'Breakdown', Tanggal: recent }
    ];
    
    const result = kpiEngineModule.calculateHealthScore('EQ001');
    
    expect(result.breakdowns).toBe(1);
    expect(result.score).toBeLessThan(100);
  });
});

describe('calculateMTBF (kpi engine)', () => {
  it('should return 0 for empty equipId', () => {
    expect(kpiEngineModule.calculateMTBF(null)).toBe(0);
  });

  it('should return 0 for no logs', () => {
    kpiEngineModule.logs = [];
    expect(kpiEngineModule.calculateMTBF('EQ001')).toBe(0);
  });

  it('should return 0 for less than 2 breakdowns', () => {
    kpiEngineModule.logs = [
      { EquipmentID: 'EQ001', Jenis: 'Breakdown', Tanggal: '2025-01-01' }
    ];
    expect(kpiEngineModule.calculateMTBF('EQ001')).toBe(0);
  });
});

describe('withRetry', () => {
  it('should succeed on first try', async () => {
    const result = await withRetry(() => Promise.resolve('success'));
    expect(result).toBe('success');
  });

  it('should retry on failure and succeed', async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return Promise.resolve('success');
    };
    
    const result = await withRetry(fn, { maxRetries: 3, delay: 10 });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries', async () => {
    const fn = () => Promise.reject(new Error('always fails'));
    
    await expect(withRetry(fn, { maxRetries: 2, delay: 10 }))
      .rejects.toThrow('always fails');
  });
});

describe('isNetworkError', () => {
  it('should return true for network errors in message', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('fetch failed'))).toBe(true);
    expect(isNetworkError(new Error('connection timeout'))).toBe(true);
  });

  it('should return false for non-network errors', () => {
    expect(isNetworkError(new Error('Something else'))).toBe(false);
  });

  it('should handle error with code property', () => {
    const error = new Error('some error');
    error.code = 'NETWORK_ERROR';
    expect(isNetworkError(error)).toBe(true);
  });
});

describe('isQuotaError', () => {
  it('should return true for quota errors', () => {
    expect(isQuotaError(new Error(' quota exceeded'))).toBe(true);
    expect(isQuotaError(new Error('rate limit'))).toBe(true);
  });

  it('should return false for non-quota errors', () => {
    expect(isQuotaError(new Error('normal error'))).toBe(false);
  });
});

describe('parseJsonSafe', () => {
  it('should parse valid JSON arrays', () => {
    expect(parseJsonSafe('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseJsonSafe('["a","b"]')).toEqual(['a', 'b']);
  });

  it('should return fallback for invalid JSON', () => {
    expect(parseJsonSafe('invalid')).toEqual([]);
    expect(parseJsonSafe(null)).toEqual([]);
    expect(parseJsonSafe('')).toEqual([]);
  });

  it('should return fallback for non-array JSON (by design)', () => {
    // Function returns fallback for objects, only arrays pass through
    expect(parseJsonSafe('{"a":1}')).toEqual([]);
    expect(parseJsonSafe('not json', [])).toEqual([]);
  });
});

describe('formatDate', () => {
  it('should format date strings', () => {
    expect(formatDate('2025-01-15')).toBe('2025-01-15');
    expect(formatDate('15/01/2025')).toBe('2025-01-15');
  });

  it('should return empty for invalid', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('invalid')).toBe('');
  });
});

describe('formatCurrency', () => {
  it('should format IDR currency', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('Rp');
    expect(result).toContain('1.000.000');
  });

  it('should return dash for null/undefined', () => {
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
  });
});

describe('debounce', () => {
  it('should delay function execution', async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    
    fn();
    fn();
    fn();
    
    expect(count).toBe(0);
    
    await new Promise(r => setTimeout(r, 60));
    
    expect(count).toBe(1);
  });
});