// @ts-check
/** @typedef {import('../appstate').AppState} AppState */
import { localDateStr } from '../utils.js';
/**
 * pm-schedule.js — PM Schedule Module (Standalone Data Structure)
 * 
 * Each equipment can have MULTIPLE PM tasks (ganti oli, greasing, dll.)
 * Data stored in Firebase: PM_Schedule/{pmId}
 * 
 * Fields:
 *   - taskName: "Ganti Oli"
 *   - equipmentId: "EQ001"
 *   - description: "..."
 *   - date: "2026-07-15"
 *   - frequency: "none" | "weekly" | "monthly" | "quarterly" | "yearly"
 *   - assignedTo: "Maintenance Team"
 *   - status: "pending" | "completed" | "cancelled"
 *   - priority: "High" | "Medium" | "Low"
 *   - completionDate: "..."
 *   - completionNote: "..."
 *   - createdBy, createdAt, updatedAt
 */

import { DEFAULT_PM_FORM } from '../constants';
import { askConfirm } from './confirm-dialog.js';

export const pmScheduleModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
  // --- STATE ---
  pmList: [],
  pmForm: DEFAULT_PM_FORM(),
  isEditingPM: false,
  pmFilterStatus: '',
  pmFilterEquip: '',
  selectedPM: null,
  pmShowDetail: false,
  pmView: 'calendar',
  pmMonthOffset: 0,
  pmGanttScroll: 0,
  pmGanttZoom: 'day',
  pmGanttShowDeps: true,
  pmGanttShowCritical: true,
  pmLoading: true,
  pmSelectedIds: [],
  _pmHM: null, _pmHMRef: null, _pmHMEqRef: null,
  _ganttEqMap: null, _ganttEqFullMap: null, _ganttEqRef: null, _inGanttRows: false,

  // --- INIT ---
  /** Load PM_Schedule from Firebase */
  async loadPMSchedule() {
    if (!window.db) return;
    this.pmLoading = true;

    try {
      const snapshot = await window.get(window.ref(window.db, 'PM_Schedule'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        this.pmList = Object.keys(data).map(pmId => ({
          pmId,
          ...data[pmId],
        }));
      } else {
        this.pmList = [];
      }

      // Auto-generate next PM untuk task completed yang belum punya next (Phase B2)
      // Hanya jika user login (generateNextPM butuh this.user.uid)
      if (this.user?.uid && this.pmList.length > 0) {
        try {
          const completed = this.pmList.filter(p => p.status === 'completed' && p.frequency && p.frequency !== 'none'
            && (!p.completionDate || (Date.now() - new Date(p.completionDate).getTime()) < 30 * 86400000));
          const nextDates = new Set(
            this.pmList.filter(p => p.status === 'pending').map(p => `${p.taskName}|${p.equipmentId}|${p.date}`)
          );
          for (const pm of completed) {
            // Generate next jika belum ada pending dgn task+equip+date berikutnya
            const freqMap = /** @type {Record<string, number>} */ ({ weekly: 7, monthly: 30, quarterly: 90, yearly: 365 });
            const days = freqMap[pm.frequency || ''];
            if (!days) continue;
            const nextDate = new Date(pm.date || Date.now());
            nextDate.setDate(nextDate.getDate() + days);
            const nextDateStr = localDateStr(nextDate);
            const key = `${pm.taskName}|${pm.equipmentId}|${nextDateStr}`;
            if (!nextDates.has(key)) {
              await this.generateNextPM(pm);
              nextDates.add(key);
            }
          }
        } catch (/** @type {any} */ e) {
          console.warn('[PM] Auto-generate error:', e.message);
        }
      }
    } catch (/** @type {any} */ e) {
      console.warn('[PM] Load error:', e.message);
    } finally {
      this.pmLoading = false;
    }
  },

  // --- CRUD ---
  openPMModal(isEdit = false, data = null) {
    this.isEditingPM = isEdit;
    if (isEdit && data) {
      this.pmForm = {
        pmId: data.pmId || '',
        taskName: data.taskName || '',
        equipmentId: data.equipmentId || '',
        description: data.description || '',
        date: data.date || '',
        frequency: data.frequency || 'none',
        basis: data.basis || 'calendar',
        intervalHours: data.intervalHours || 0,
        assignedTo: data.assignedTo || 'Maintenance Team',
        status: data.status || 'pending',
        priority: data.priority || 'Medium',
        completionDate: data.completionDate || '',
        completionNote: data.completionNote || '',
      };
    } else {
      this.pmForm = DEFAULT_PM_FORM();
      // Pre-fill today
      this.pmForm.date = localDateStr();
    }
    this.showPMModal = true;
  },

  async submitPM() {
    // Validate
    if (!this.pmForm.taskName) {
      this.showNotification('Task name required', 'error');
      return;
    }
    if (!this.pmForm.equipmentId) {
      this.showNotification('Select equipment', 'error');
      return;
    }
    if (!this.pmForm.date) {
      this.showNotification('PM date required', 'error');
      return;
    }

    this.pmLoading = true;
    try {
      const dataToSave = /** @type {any} */ ({
        taskName: this.pmForm.taskName,
        equipmentId: this.pmForm.equipmentId,
        description: this.pmForm.description || '',
        date: this.pmForm.date,
        frequency: this.pmForm.frequency || 'none',
        basis: this.pmForm.basis || 'calendar',
        intervalHours: Number(this.pmForm.intervalHours) || 0,
        assignedTo: this.pmForm.assignedTo || 'Maintenance Team',
        status: this.pmForm.status || 'pending',
        priority: this.pmForm.priority || 'Medium',
        completionDate: this.pmForm.completionDate || '',
        completionNote: this.pmForm.completionNote || '',
        updatedAt: new Date().toISOString(),
      });

      if (!this.isEditingPM) {
        dataToSave.createdBy = this.user?.uid || 'unknown';
        dataToSave.createdAt = new Date().toISOString();

        // Generate ID: PM + timestamp + random suffix
        const pmId = `PM_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        dataToSave.pmId = pmId;

        await window.set(window.ref(window.db, `PM_Schedule/${pmId}`), dataToSave);
        this.pmList.unshift(dataToSave);
        this.showNotification('PM Task created!');
            // C3: Audit trail
            try {
                window.auditModule?.logAudit?.('Create PM Task', { id: pmId, task: this.pmForm.taskName, equip: this.pmForm.equipmentId });
            } catch { /* silent */ }

      } else {
        const pmId = this.pmForm.pmId;
        if (!pmId) throw new Error('Missing PM ID');

        // Preserve createdAt
        const existing = this.pmList.find(p => p.pmId === pmId);
        if (existing) {
          dataToSave.createdBy = existing.createdBy;
          dataToSave.createdAt = existing.createdAt;
        }
        dataToSave.pmId = pmId;

        await window.update(window.ref(window.db, `PM_Schedule/${pmId}`), dataToSave);

        const idx = this.pmList.findIndex(p => p.pmId === pmId);
        if (idx >= 0) this.pmList[idx] = { ...this.pmList[idx], ...dataToSave };
        this.showNotification('PM Task updated!');
            // C3: Audit trail
            try {
                window.auditModule?.logAudit?.('Update PM Task', { id: pmId, task: this.pmForm.taskName });
            } catch { /* silent */ }

      }

      this.showPMModal = false;
    } catch (/** @type {any} */ e) {
      console.error('[PM] Submit error:', e);
      this.showNotification('Error: ' + e.message, 'error');
    } finally {
      this.pmLoading = false;
    }
  },

  async completePM(pmId, note = '') {
    try {
      const now = new Date().toISOString();
      const completionDate = localDateStr();
      await window.update(window.ref(window.db, `PM_Schedule/${pmId}`), {
        status: 'completed',
        completionDate,
        completionNote: note || '',
        updatedAt: now,
      });

      const idx = this.pmList.findIndex(p => p.pmId === pmId);
      if (idx >= 0) {
        this.pmList[idx].status = 'completed';
        this.pmList[idx].completionDate = completionDate;
        this.pmList[idx].completionNote = note || '';
        this.pmList[idx].updatedAt = now;
      }

      this.showNotification('✅ PM marked completed');

      // If has frequency, auto-generate next PM
      const pm = this.pmList.find(p => p.pmId === pmId);
      if (pm && pm.frequency && pm.frequency !== 'none') {
        await this.generateNextPM(pm);
      }

      this.pmShowDetail = false;
    } catch (/** @type {any} */ e) {
      console.error('[PM] Complete error:', e);
      this.showNotification('Error: ' + e.message, 'error');
    }
  },

  async generateNextPM(pm) {
    const freqMap = /** @type {Record<string, number>} */ ({
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365,
    });
    const days = freqMap[pm.frequency];
    if (!days) return;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    const nextDateStr = localDateStr(nextDate);

    // For hours-based PM, annotate the target meter reading (nextHM threshold)
    let targetHM = null;
    if (pm.basis === 'hours' && pm.intervalHours > 0 && pm.equipmentId) {
      const lastLog = (this.logs || []).filter(l => l && l.EquipmentID === pm.equipmentId && Number(l.HM) > 0)
        .sort((a, b) => (a.Tanggal || '').localeCompare(b.Tanggal || ''))
        .pop();
      const lastHM = Number(lastLog?.HM) || 0;
      const equipHM = Number(this.equipment?.find(e => e.EquipmentID === pm.equipmentId)?.CurrentHM) || 0;
      targetHM = Math.max(lastHM, equipHM) + pm.intervalHours;
    }

    // Check if next already exists
    const exists = this.pmList.some(
      p => p.taskName === pm.taskName && p.equipmentId === pm.equipmentId && p.date === nextDateStr
    );
    if (exists) return;

    const pmId = `PM_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const newPM = {
      pmId,
      taskName: pm.taskName,
      equipmentId: pm.equipmentId,
      description: pm.description || '',
      date: nextDateStr,
      frequency: pm.frequency,
      assignedTo: pm.assignedTo || 'Maintenance Team',
      status: 'pending',
      priority: pm.priority || 'Medium',
      basis: pm.basis || 'calendar',
      intervalHours: pm.intervalHours || 0,
      targetHM: targetHM,
      completionDate: '',
      completionNote: '',
      createdBy: this.user?.uid || 'unknown',
      createdAt: now,
      updatedAt: now,
    };

    await window.set(window.ref(window.db, `PM_Schedule/${pmId}`), newPM);
    this.pmList.unshift(newPM);
  },

  async deletePM(pmId) {
    if (!(await askConfirm('Tugas PM ini dihapus dari jadwal dan tidak bisa dikembalikan.', { title: 'Hapus tugas PM', confirmLabel: 'Hapus', tone: 'danger' }))) return;

    try {
      await window.remove(window.ref(window.db, `PM_Schedule/${pmId}`));
      this.pmList = this.pmList.filter(p => p.pmId !== pmId);
      this.showNotification('PM task deleted');
    } catch (/** @type {any} */ e) {
      console.error('[PM] Delete error:', e);
      this.showNotification('Error: ' + e.message, 'error');
    }
  },

  // --- BULK ACTIONS ---
  pmToggleSelect(pmId) {
    const idx = this.pmSelectedIds.indexOf(pmId);
    if (idx >= 0) this.pmSelectedIds.splice(idx, 1);
    else this.pmSelectedIds.push(pmId);
  },

  pmToggleSelectAll() {
    const filtered = this.pmGetFilteredList().filter((/** @type {any} */ p) => p.status === 'pending');
    const allSelected = filtered.every((/** @type {any} */ p) => this.pmSelectedIds.includes(p.pmId));
    if (allSelected) {
      this.pmSelectedIds = this.pmSelectedIds.filter((/** @type {any} */ id) => !filtered.some((/** @type {any} */ p) => p.pmId === id));
    } else {
      filtered.forEach((/** @type {any} */ p) => {
        if (!this.pmSelectedIds.includes(p.pmId)) this.pmSelectedIds.push(p.pmId);
      });
    }
  },

  async bulkCompletePM() {
    const ids = this.pmSelectedIds;
    if (!ids.length) return this.showNotification('No tasks selected', 'error');
    if (!(await askConfirm(`${ids.length} tugas PM terpilih akan ditandai selesai.`, { title: 'Selesaikan tugas PM', confirmLabel: 'Tandai selesai' }))) return;

    this.pmLoading = true;
    try {
      const now = new Date().toISOString();
      const today = localDateStr();
      const promises = ids.map(pmId => {
        const pm = this.pmList.find(p => p.pmId === pmId);
        if (!pm || pm.status === 'completed') return;

        const updates = {
          status: 'completed',
          completionDate: today,
          completionNote: 'Bulk completed',
          updatedAt: now,
        };
        Object.assign(pm, updates);
        const savePromise = window.update(window.ref(window.db, `PM_Schedule/${pmId}`), updates);

        // Auto-generate next if has frequency
        if (pm.frequency && pm.frequency !== 'none') {
          return savePromise.then(() => this.generateNextPM(pm));
        }
        return savePromise;
      });

      await Promise.all(promises);
      this.pmList = [...this.pmList];
      this.pmSelectedIds = [];
      this.showNotification(`✅ ${ids.length} PM tasks completed`);
    } catch (/** @type {any} */ e) {
      console.error('[PM] Bulk complete error:', e);
      this.showNotification('Error: ' + e.message, 'error');
    } finally {
      this.pmLoading = false;
    }
  },

  /** Complete PM + open log form pre-filled from this PM task */
  logPMFromSchedule(pm) {
    if (!pm) return;
    this.completePM(pm.pmId);
    // Set logForm directly for new entry
    this.logForm.equipmentId = pm.equipmentId;
    this.logForm.type = 'PM';
    this.logForm.desc = (pm.taskName || '') + (pm.description ? ' - ' + pm.description : '');
    this.logForm.tech = pm.assignedTo || 'Maintenance Team';
    this.showLogModal = true;
  },

  // --- FILTERS ---
  pmSearch: '',
  pmFilterPriority: '',

  pmGetFilteredList() {
    let list = this.pmList || [];

    if (this.pmSearch) {
      const q = this.pmSearch.toLowerCase().trim();
      list = list.filter(p => {
        if (!p) return false;
        const task = (p.taskName || '').toLowerCase();
        const eqId = (p.equipmentId || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const assign = (p.assignedTo || '').toLowerCase();
        return task.includes(q) || eqId.includes(q) || desc.includes(q) || assign.includes(q);
      });
    }
    if (this.pmFilterEquip) {
      list = list.filter(p => p.equipmentId === this.pmFilterEquip);
    }
    if (this.pmFilterStatus) {
      list = list.filter(p => p.status === this.pmFilterStatus);
    }
    if (this.pmFilterPriority) {
      list = list.filter(p => (p.priority || 'Medium') === this.pmFilterPriority);
    }

    // Sort: overdue first, then by date
    const today = localDateStr();
    return [...list].sort((/** @type {any} */ a, /** @type {any} */ b) => {
      const aOverdue = a.status === 'pending' && a.date < today ? 1 : 0;
      const bOverdue = b.status === 'pending' && b.date < today ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return (a.date || '').localeCompare(b.date || '');
    });
  },

  // --- DASHBOARD HELPERS ---
  /** Pending tasks sorted: overdue first, then by date */
  get pmUpcomingList() {
    const today = localDateStr();
    return (this.pmList || [])
      .filter((/** @type {any} */ p) => p.status === 'pending')
      .sort((/** @type {any} */ a, /** @type {any} */ b) => {
        const aOverdue = a.date < today ? 1 : 0;
        const bOverdue = b.date < today ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        return (a.date || '').localeCompare(b.date || '');
      });
  },
  /** U-1: jumlah PM pending yang sudah overdue (tanggal lewat atau HM terlampaui) */
  get pmOverdueCount() {
    return (this.pmList || []).filter((/** @type {any} */ p) => this.isPMOverdue(p)).length;
  },
  /** Cached per-equip HM: meter if set, else last log HM. Rebuilt when logs/equipment change. */
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
  /** Current HM for an equipment (meter or last log), 0 if none */
  pmCurrentHM(equipId) {
    if (!equipId) return 0;
    return this._pmHMMap().get(equipId) || 0;
  },

  isPMOverdue(pm) {
    if (pm.status !== 'pending') return false;
    // Hours-based PM: overdue when meter reading passes target
    if (pm.basis === 'hours' && pm.targetHM > 0) {
      return this.pmCurrentHM(pm.equipmentId) >= pm.targetHM;
    }
    const today = localDateStr();
    return pm.date < today;
  },
  isPMDueSoon(pm) {
    const today = localDateStr();
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    return pm.status === 'pending' && pm.date >= today && pm.date <= localDateStr(threeDays);
  },

  // --- COMPUTED HELPERS (regular methods, not getters - keeps Alpine reactivity) ---
  pmGetMonthLabel() {
    const d = new Date();
    d.setMonth(d.getMonth() + (this.pmMonthOffset || 0));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  /** Build calendar events from pmList */
  pmGetCalendarEvents() {
    const today = new Date();
    const todayStr = localDateStr(today);
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = localDateStr(nextWeek);

    const eventsByDate = /** @type {Record<string, any[]>} */ ({});
    const list = this.pmFilterEquip
      ? (this.pmList || []).filter((/** @type {any} */ p) => p.equipmentId === this.pmFilterEquip)
      : (this.pmList || []);

    // Build events lookup
    list.forEach((/** @type {any} */ pm) => {
      if (!pm.date) return;
      const isOverdue = pm.date < todayStr && pm.status === 'pending';
      const isDueSoon = !isOverdue && pm.date <= nextWeekStr && pm.status === 'pending';

      const evt = {
        id: pm.pmId,
        name: pm.taskName,
        equipId: pm.equipmentId,
        date: pm.date,
        dateISO: pm.date,
        isOverdue,
        isDueSoon,
        isCompleted: pm.status === 'completed',
        priority: pm.priority || 'Medium',
        frequency: pm.frequency || 'none',
        tooltip: `${pm.taskName} - ${pm.equipmentId} (${pm.date})`,
      };

      if (!eventsByDate[pm.date]) eventsByDate[pm.date] = [];
      eventsByDate[pm.date].push(evt);
    });

    return eventsByDate;
  },

  /** Build calendar grid days */
  pmGetCalendarDays() {
    const today = new Date();
    const todayStr = localDateStr(today);
    const offset = this.pmMonthOffset || 0;
    const year = today.getFullYear();
    const month = today.getMonth() + offset;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();

    const eventsByDate = this.pmGetCalendarEvents();

    const days = [];
    const totalDays = startPad + lastDay.getDate();
    const rows = Math.ceil(totalDays / 7);

    for (let i = 0; i < rows * 7; i++) {
      const dayNum = i - startPad + 1;
      const date = new Date(year, month, dayNum);
      const dateStr = localDateStr(date);
      const isOtherMonth = date.getMonth() !== month;

      days.push({
        date,
        dateStr,
        isToday: dateStr === todayStr,
        isOtherMonth,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        events: eventsByDate[dateStr] || [],
      });
    }

    return days;
  },

  /** PM Statistics */
  pmGetStats() {
    const today = new Date();
    const todayStr = localDateStr(today);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const endMonthStr = localDateStr(endMonth);
    const end30 = new Date(today);
    end30.setDate(today.getDate() + 30);
    const end30Str = localDateStr(end30);

    const list = this.pmList || [];
    let overdue = 0, dueThisMonth = 0, upcoming = 0, completed = 0;

    list.forEach(pm => {
      if (!pm.date) return;
      if (pm.status === 'completed') {
        completed++;
        return;
      }
      if (pm.date < todayStr) overdue++;
      else if (pm.date <= endMonthStr) dueThisMonth++;
      if (pm.date > todayStr && pm.date <= end30Str) upcoming++;
    });

    return { overdue, dueThisMonth, upcoming, completed };
  },

  // Gantt chart
  pmGetGanttMonths() {
    const months = [];
    for (let i = -2; i <= 4; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        offset: i,
      });
    }
    return months;
  },

  pmGetGanttDays() {
    const days = [];
    const scrollOffset = this.pmGanttScroll || 0;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 2 + scrollOffset);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 4);
    endDate.setDate(0);

    const today = new Date();
    const todayStr = localDateStr(today);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = localDateStr(d);
      days.push({
        date: d.getDate(),
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2),
        isToday: dateStr === todayStr,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return days;
  },

  /**
   * Window 1 bulan aktif (default bulan berjalan, offset pmGanttScroll).
   * Menghasilkan slice hari dari pmGetGanttDays() dan offset koordinat.
   * ponytail: hari diambil dari pmGetGanttDays() agar koordinat identik.
   */
  pmGanttMonthWindow() {
    const scrollOffset = this.pmGanttScroll || 0;
    const target = new Date();
    target.setDate(1);
    target.setMonth(target.getMonth() + scrollOffset);
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    const label = target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const allDays = this.pmGetGanttDays();
    const days = allDays.filter((/** @type {any} */ d) => {
      const parts = d.dateStr.split('-');
      return Number(parts[0]) === targetYear && Number(parts[1]) === (targetMonth + 1);
    });

    const firstDateStr = days[0]?.dateStr || '';
    const start = allDays.findIndex((/** @type {any} */ d) => d.dateStr === firstDateStr);
    const dayWidth = this.pmGetGanttDayWidth();
    const offsetX = (start >= 0 ? start : 0) * dayWidth;
    const width = days.length * dayWidth;

    return { days, label, start, offsetX, width };
  },

  /**
   * @param {any} evt
   * @returns {boolean}
   */
  pmGanttVisible(evt) {
    if (!evt || typeof evt.left !== 'number') return false;
    const w = this.pmGanttMonthWindow();
    return evt.left >= w.offsetX && evt.left < w.offsetX + w.width;
  },

  /**
   * @param {any} evt
   * @returns {number}
   */
  pmGanttBarLeft(evt) {
    if (!evt || typeof evt.left !== 'number') return 0;
    return evt.left - this.pmGanttMonthWindow().offsetX;
  },

  pmGetGanttRows() {
    const days = this.pmGetGanttDays();
    if (days.length === 0) return [];

    const dayWidth = this.pmGetGanttDayWidth();
    const firstDateStr = days[0]?.dateStr || '';
    const lastDateStr = days[days.length - 1]?.dateStr || '';
    const todayStr = localDateStr();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = localDateStr(nextWeek);

    const daysSinceEpoch = (/** @type {string} */ dateStr) => Math.floor(new Date(dateStr).getTime() / 86400000);
    const day0 = daysSinceEpoch(firstDateStr);

    // Group by equipment
    const equipMap = /** @type {Record<string, any>} */ ({});
    const list = this.pmFilterEquip
      ? (this.pmList || []).filter((/** @type {any} */ p) => p.equipmentId === this.pmFilterEquip)
      : (this.pmList || []);

    list.forEach((/** @type {any} */ pm) => {
      if (!pm.date) return;
      const pmDate = pm.date;
      if (pmDate < firstDateStr || pmDate > lastDateStr) return;

      const isOverdue = pmDate < todayStr && pm.status === 'pending';
      const isDueSoon = !isOverdue && pmDate <= nextWeekStr && pm.status === 'pending';
      const isCompleted = pm.status === 'completed';

      const evtDay = daysSinceEpoch(pmDate) - day0;
      const left = evtDay * dayWidth;
      const width = dayWidth * 2 - 2;

      const evt = {
        id: pm.pmId,
        name: pm.taskName,
        equipId: pm.equipmentId,
        date: pmDate,
        isOverdue,
        isDueSoon,
        isCompleted,
        left,
        width,
        tooltip: `${pm.taskName} - ${pm.equipmentId} (${pmDate})`,
        status: pm.status,
        priority: pm.priority || 'Medium',
      };

      const eqKey = /** @type {string} */ (pm.equipmentId);
      if (!equipMap[eqKey]) {
        equipMap[eqKey] = { equipId: eqKey, events: [] };
      }
      equipMap[eqKey].events.push(evt);
    });

    // Guard against circular recursion when called from pmGetCriticalPath
    if (this._inGanttRows) {
      return Object.values(equipMap).map(eq => ({
        equipId: eq.equipId,
        name: eq.equipId,
        status: 'Scheduled',
        events: eq.events,
      }));
    }

    /** @type {string[]} */
    let criticalEquipIds = [];
    this._inGanttRows = true;
    try {
      criticalEquipIds = typeof this.pmGetCriticalPath === 'function'
        ? (this.pmGetCriticalPath().equipIds || [])
        : [];
    } finally {
      this._inGanttRows = false;
    }

    return Object.values(equipMap).map(eq => {
      const status = eq.events.some((/** @type {any} */ e) => e.isOverdue) ? 'Overdue'
        : eq.events.some((/** @type {any} */ e) => e.isDueSoon) ? 'Due Soon'
        : 'Scheduled';

      const eqList = window.app?.equipment || [];
      if (!this._ganttEqMap || this._ganttEqRef !== eqList) {
        this._ganttEqMap = new Map(eqList.map((/** @type {any} */ e) => [e && e.EquipmentID, e && e.Nama]));
        this._ganttEqFullMap = new Map(eqList.map((/** @type {any} */ e) => [e && e.EquipmentID, e]));
        this._ganttEqRef = eqList;
      }
      const eqRecord = this._ganttEqFullMap ? this._ganttEqFullMap.get(eq.equipId) : null;
      const tipe = eqRecord ? eqRecord.Tipe : undefined;
      const hm = typeof this.pmCurrentHM === 'function' ? (this.pmCurrentHM(eq.equipId) || 0) : 0;
      const hmLabel = hm + 'h';
      const iconMap = /** @type {Record<string, string>} */ ({
        crusher: 'factory',
        pump: 'engineering',
        mechanical: 'settings',
        electrical: 'precision_manufacturing',
        operational: 'precision_manufacturing',
        centrifugal: 'engineering',
        jaw: 'factory',
      });
      const icon = (tipe && iconMap[String(tipe).toLowerCase()]) || 'precision_manufacturing';
      const critical = criticalEquipIds.includes(eq.equipId);
      const statusLabel = String(status).toUpperCase();

      return {
        equipId: eq.equipId,
        name: this._ganttEqMap.get(eq.equipId) || eq.equipId,
        status,
        events: eq.events,
        tipe,
        hm,
        hmLabel,
        icon,
        critical,
        statusLabel,
      };
    });
  },
  pmGetGanttDayWidth() {
    const widths = /** @type {Record<string, number>} */ ({ day: 32, week: 20, month: 10 });
    return widths[/** @type {string} */ (this.pmGanttZoom)] || 32;
  },

  pmGanttWidth() {
    return this.pmGetGanttDays().length * this.pmGetGanttDayWidth();
  },

  pmToggleDeps() {
    this.pmGanttShowDeps = !this.pmGanttShowDeps;
  },

  pmToggleCritical() {
    this.pmGanttShowCritical = !this.pmGanttShowCritical;
  },

  /**
   * Pecah deskripsi PM jadi langkah bersih (buang bullet & penomoran).
   * @param {any} pm
   * @returns {string[]}
   */
  pmGetChecklist(pm) {
    const raw = pm && typeof pm.description === 'string' ? pm.description : '';
    return raw
      .split('\n')
      .map((/** @type {string} */ line) => line.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim())
      .filter((/** @type {string} */ line) => line.length > 0);
  },

  /**
   * Pasangan event berurutan (urut tanggal) dalam satu baris equipment.
   * ponytail: heuristik chain — PM se-equipment yang berurutan tanggal
   * dianggap bergantung; ganti ke field dependsOn kalau data nyata ada.
   * @param {any} row
   * @returns {any[][]}
   */
  pmGanttEventPairs(row) {
    const events = [...((row && row.events) || [])].sort((/** @type {any} */ a, /** @type {any} */ b) =>
      String(a.date).localeCompare(String(b.date)));
    const pairs = [];
    for (let i = 0; i + 1 < events.length; i++) pairs.push([events[i], events[i + 1]]);
    return pairs;
  },

  pmGetGanttLinks() {
    return this.pmGetGanttRows().flatMap((/** @type {any} */ row) =>
      this.pmGanttEventPairs(row).map((/** @type {any[]} */ p) => ({
        key: p[0].id + '-' + p[1].id,
        equipId: row.equipId,
        from: p[0].id,
        to: p[1].id,
        critical: this.pmGanttIsCritical(row.equipId),
      })));
  },

  /**
   * chain critical = equip dengan PM overdue DAN PM terakhir <= 7 hari ke depan.
   * ponytail: O(rows) per render karena dipanggil dari pmGanttIsCritical.
   * @returns {{ ids: string[], equipIds: string[] }}
   */
  pmGetCriticalPath() {
    const ids = /** @type {string[]} */ ([]);
    const equipIds = /** @type {string[]} */ ([]);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const endStr = localDateStr(end);

    this.pmGetGanttRows().forEach((/** @type {any} */ row) => {
      const events = [...(row.events || [])].sort((/** @type {any} */ a, /** @type {any} */ b) =>
        String(a.date).localeCompare(String(b.date)));
      if (events.length < 2) return;
      const hasOverdue = events.some((/** @type {any} */ e) => e.isOverdue);
      if (!hasOverdue) return;
      if (!(String(events[events.length - 1].date) <= endStr)) return;
      equipIds.push(row.equipId);
      events.forEach((/** @type {any} */ e) => ids.push(e.id));
    });

    return { ids, equipIds };
  },

  /**
   * @param {string} equipId
   * @returns {boolean}
   */
  pmGanttIsCritical(equipId) {
    return this.pmGetCriticalPath().equipIds.includes(equipId);
  },

  /**
   * Elbow SVG antar event se-baris (koordinat viewBox 0 0 pmGanttWidth() 100).
   * @param {any} row
   * @returns {{ critical: boolean, d: string }[]}
   */
  pmGanttRowLinks(row) {
    const equipId = row && row.equipId;
    return this.pmGanttEventPairs(row).map((/** @type {any[]} */ p) => {
      const critical = this.pmGanttIsCritical(equipId);
      return {
        critical,
        d: 'M ' + (p[0].left + p[0].width) + ' 50 V 78 H ' + p[1].left + ' V 50',
      };
    });
  },

  /**
   * @param {any} row
   * @returns {string}
   */
  pmGanttRowSvg(row) {
    if (!this.pmGanttShowDeps) return '';
    const links = this.pmGanttRowLinks(row);
    if (links.length === 0) return '';
    return links
      .map((/** @type {{ critical: boolean, d: string }} */ l) => {
        const stroke = l.critical ? 'rgb(var(--tac-status-emergency))' : 'rgb(var(--tac-sync-cyan))';
        const dash = l.critical ? '0' : '4 3';
        return '<path d="' + l.d + '" fill="none" stroke="' + stroke +
          '" stroke-width="2" stroke-dasharray="' + dash + '" />';
      })
      .join('');
  },
});
