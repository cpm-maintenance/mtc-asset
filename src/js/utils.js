import { CONSTANTS } from './constants.js';

// ========================================
// INPUT VALIDATION & SANITIZATION
// ========================================

// XSS Prevention - Remove dangerous HTML/script tags
export function sanitizeInput(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/script/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

// Sanitize for display (allow some HTML tags)
export function sanitizeForDisplay(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// Validate numeric input - must be positive number
export function isValidPositiveNumber(value, allowZero = false) {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (allowZero) return num >= 0;
  return num > 0;
}

// Validate integer input
export function isValidInteger(value, min = 0, max = null) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return false;
  if (num < min) return false;
  if (max !== null && num > max) return false;
  return true;
}

// Validate date format (YYYY-MM-DD)
export function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  // Check if date is not too far in past/future
  const now = new Date();
  const minDate = new Date('2020-01-01');
  return date >= minDate && date <= now;
}

// Validate date range
export function isValidDateRange(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
  return new Date(startDate) <= new Date(endDate);
}

// Validate ID format (no special characters)
export function isValidID(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// Validate phone number
export function isValidPhone(phone) {
  if (!phone) return false;
  return /^[+]?[\d\s()-]{8,20}$/.test(phone);
}

// Validate URL
export function isValidURL(url) {
  if (!url) return true; // URL is optional
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Length validation
export function isValidLength(str, min, max) {
  if (!str) return false;
  const len = str.toString().length;
  return len >= min && len <= max;
}

// ========================================
// EXISTING VALIDATION FUNCTIONS
// ========================================

export function validateEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateForm(form, rules) {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const value = form[field];
    if (rule.required && !value) errors.push(`${field} is required`);
    if (rule.min !== undefined && value < rule.min) errors.push(`${field} must be at least ${rule.min}`);
    if (rule.max !== undefined && value > rule.max) errors.push(`${field} must not exceed ${rule.max}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateEquipmentForm(form) {
  const errors = [];
  if (!form.id?.trim()) errors.push('Asset ID is required');
  if (!form.nama?.trim()) errors.push('Asset Name is required');
  if (form.id && !isValidID(form.id)) errors.push('Asset ID contains invalid characters');
  if (form.id && form.id.length > 50) errors.push('Asset ID too long (max 50 chars)');
  if (form.nama && form.nama.length > 100) errors.push('Asset Name too long (max 100 chars)');
  if (form.serialNumber && !isValidLength(form.serialNumber, 0, 50)) errors.push('Serial number too long');
  return errors;
}

export function validatePartForm(form) {
  const errors = [];
  if (!form.id?.trim()) errors.push('Part ID is required');
  if (!form.nama?.trim()) errors.push('Part Name is required');
  if (form.id && !isValidID(form.id)) errors.push('Part ID contains invalid characters');
  if (form.stok !== undefined && !isValidInteger(form.stok, 0)) errors.push('Stock must be a positive number');
  if (form.minStock !== undefined && !isValidInteger(form.minStock, 0)) errors.push('Minimum stock must be a positive number');
  if (form.harga !== undefined && !isValidPositiveNumber(form.harga, true)) errors.push('Price must be a positive number');
  if (form.stok && form.stok < form.minStock) errors.push('Stock cannot be less than minimum stock');
  return errors;
}

export function validateLogForm(form) {
  const errors = [];
  if (!form.equipmentId?.trim()) errors.push('Equipment selection is required');
  if (!form.date?.trim()) errors.push('Date is required');
  if (form.date && !isValidDate(form.date)) errors.push('Invalid date format');
  if (!form.desc?.trim()) errors.push('Description is required');
  if (form.desc && form.desc.length > 500) errors.push('Description too long (max 500 chars)');
  if (form.downtime !== undefined && !isValidPositiveNumber(form.downtime, true)) errors.push('Downtime must be a positive number');
  if (form.cost !== undefined && !isValidPositiveNumber(form.cost, true)) errors.push('Cost must be a positive number');
  if (form.hm && !isValidPositiveNumber(form.hm, true)) errors.push('HM must be a positive number');
  if (form.photos?.length > CONSTANTS.MAX_PHOTOS) errors.push(`Maximum ${CONSTANTS.MAX_PHOTOS} photos allowed`);
  return errors;
}

export function validatePerformanceForm(form) {
  const errors = [];
  if (!form.equipmentId?.trim()) errors.push('Equipment selection is required');
  if (!form.date?.trim()) errors.push('Date is required');
  if (form.date && !isValidDate(form.date)) errors.push('Invalid date format');
  
  // Validate hours (WH, BD, STB)
  const wh = parseFloat(form.wh) || 0;
  const bd = parseFloat(form.bd) || 0;
  const stb = parseFloat(form.stb) || 0;
  if (!isValidPositiveNumber(form.wh, true)) errors.push('Working Hours must be a positive number');
  if (!isValidPositiveNumber(form.bd, true)) errors.push('Breakdown Hours must be a positive number');
  if (!isValidPositiveNumber(form.stb, true)) errors.push('Standby Hours must be a positive number');
  
  const total = wh + bd + stb;
  if (Math.abs(total - CONSTANTS.HOURS_IN_DAY) > 0.01) errors.push(`Total hours must equal ${CONSTANTS.HOURS_IN_DAY} (current: ${total.toFixed(2)})`);
  
  // Validate PA Plan
  if (form.paPlan && (form.paPlan < 0 || form.paPlan > 100)) errors.push('PA Plan must be between 0-100');
  
  return errors;
}

// Sanitize data object before saving to Firebase
export function sanitizeDataForFirebase(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch (e) {}
  return '';
}

export function formatDateForInput(dateStr) {
  return formatDate(dateStr);
}

export function formatCurrency(num) {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function generateId(prefix = 'ID') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function parseJsonSafe(str, fallback = []) {
  try {
    if (!str || typeof str !== 'string') return fallback;
    if (str.trim() === '') return fallback;
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(formatDate(dateStr));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function isLowStock(current, minimum) {
  return Number(current) <= Number(minimum);
}

export function calculateStats(equipment, parts, logs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let overdueCount = 0;
  equipment.forEach(e => {
    if (e.NextPMDate && isOverdue(e.NextPMDate)) overdueCount++;
  });
  const lowStockCount = parts.filter(p => isLowStock(p.Stok, p.MinStock)).length;
  const totalDown = logs.reduce((acc, curr) => acc + Number(curr.Downtime || 0), 0);
  return { overdueCount, lowStockCount, totalDown };
}

export async function withRetry(fn, options = {}) {
  const { 
    maxRetries = 3, 
    delay = 1000, 
    backoff = 2,
    onRetry = null 
  } = options;
  
  let lastError;
  let currentDelay = delay;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (onRetry) onRetry(attempt, error, currentDelay);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoff;
      }
    }
  }
  
  throw lastError;
}

export function isNetworkError(error) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    error.code === 'NETWORK_ERROR' ||
    error.code === 'ECONNABORTED'
  );
}

export function isQuotaError(error) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    error.code === 'QUOTA_EXCEEDED' ||
    error.code === 'TOO_MANY_REQUESTS'
  );
}

// ========================================
// PART LIFETIME CALCULATIONS
// ========================================

export function calculatePartLifetime(lastReplaceDate, avgLifetimeDays) {
  if (!lastReplaceDate || !avgLifetimeDays) return null;
  
  const replaceDate = new Date(lastReplaceDate);
  const now = new Date();
  const daysUsed = Math.floor((now - replaceDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = avgLifetimeDays - daysUsed;
  const percentUsed = avgLifetimeDays > 0 ? (daysUsed / avgLifetimeDays) * 100 : 0;
  
  return {
    daysUsed,
    daysRemaining: Math.max(0, daysRemaining),
    percentUsed: Math.min(100, percentUsed),
    isOverdue: daysRemaining < 0,
    isWarning: daysRemaining > 0 && daysRemaining <= 30,
    status: daysRemaining < 0 ? 'overdue' : daysRemaining <= 30 ? 'warning' : 'ok'
  };
}

export function getLifetimeColor(status) {
  if (!status) return 'text-emerald-500';
  switch (status) {
    case 'overdue': return 'text-rose-500';
    case 'warning': return 'text-amber-500';
    default: return 'text-emerald-500';
  }
}

export function getLifetimeBgColor(status) {
  if (!status) return 'bg-emerald-500/20 border-emerald-500';
  switch (status) {
    case 'overdue': return 'bg-rose-500/20 border-rose-500';
    case 'warning': return 'bg-amber-500/20 border-amber-500';
    default: return 'bg-emerald-500/20 border-emerald-500';
  }
}