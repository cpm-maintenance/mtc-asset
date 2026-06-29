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

import { DEFAULT_PM_FORM } from '../constants.js';

export const pmScheduleModule = {
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
  pmLoading: true,
  pmSelectedIds: [],

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
    } catch (e) {
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
        assignedTo: data.assignedTo || 'Maintenance Team',
        status: data.status || 'pending',
        priority: data.priority || 'Medium',
        completionDate: data.completionDate || '',
        completionNote: data.completionNote || '',
      };
    } else {
      this.pmForm = DEFAULT_PM_FORM();
      // Pre-fill today
      this.pmForm.date = new Date().toISOString().split('T')[0];
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
      const dataToSave = {
        taskName: this.pmForm.taskName,
        equipmentId: this.pmForm.equipmentId,
        description: this.pmForm.description || '',
        date: this.pmForm.date,
        frequency: this.pmForm.frequency || 'none',
        assignedTo: this.pmForm.assignedTo || 'Maintenance Team',
        status: this.pmForm.status || 'pending',
        priority: this.pmForm.priority || 'Medium',
        completionDate: this.pmForm.completionDate || '',
        completionNote: this.pmForm.completionNote || '',
        updatedAt: new Date().toISOString(),
      };

      if (!this.isEditingPM) {
        dataToSave.createdBy = this.user?.uid || 'unknown';
        dataToSave.createdAt = new Date().toISOString();

        // Generate ID: PM + timestamp
        const pmId = `PM_${Date.now()}`;
        dataToSave.pmId = pmId;

        await window.set(window.ref(window.db, `PM_Schedule/${pmId}`), dataToSave);
        this.pmList.unshift(dataToSave);
        this.showNotification('PM Task created!');
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
      }

      this.showPMModal = false;
    } catch (e) {
      console.error('[PM] Submit error:', e);
      this.showNotification('Error: ' + e.message, 'error');
    } finally {
      this.pmLoading = false;
    }
  },

  async completePM(pmId, note = '') {
    try {
      const now = new Date().toISOString();
      await window.update(window.ref(window.db, `PM_Schedule/${pmId}`), {
        status: 'completed',
        completionDate: now.split('T')[0],
        completionNote: note || '',
        updatedAt: now,
      });

      const idx = this.pmList.findIndex(p => p.pmId === pmId);
      if (idx >= 0) {
        this.pmList[idx].status = 'completed';
        this.pmList[idx].completionDate = now.split('T')[0];
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
    } catch (e) {
      console.error('[PM] Complete error:', e);
      this.showNotification('Error: ' + e.message, 'error');
    }
  },

  async generateNextPM(pm) {
    const freqMap = {
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365,
    };
    const days = freqMap[pm.frequency];
    if (!days) return;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    // Check if next already exists
    const exists = this.pmList.some(
      p => p.taskName === pm.taskName && p.equipmentId === pm.equipmentId && p.date === nextDateStr
    );
    if (exists) return;

    const pmId = `PM_${Date.now()}`;
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
    if (!confirm('Delete this PM task?')) return;

    try {
      await window.remove(window.ref(window.db, `PM_Schedule/${pmId}`));
      this.pmList = this.pmList.filter(p => p.pmId !== pmId);
      this.showNotification('PM task deleted');
    } catch (e) {
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
    const filtered = this.pmGetFilteredList().filter(p => p.status === 'pending');
    const allSelected = filtered.every(p => this.pmSelectedIds.includes(p.pmId));
    if (allSelected) {
      this.pmSelectedIds = this.pmSelectedIds.filter(id => !filtered.some(p => p.pmId === id));
    } else {
      filtered.forEach(p => {
        if (!this.pmSelectedIds.includes(p.pmId)) this.pmSelectedIds.push(p.pmId);
      });
    }
  },

  async bulkCompletePM() {
    const ids = this.pmSelectedIds;
    if (!ids.length) return this.showNotification('No tasks selected', 'error');
    if (!confirm(`Complete ${ids.length} selected PM tasks?`)) return;

    this.pmLoading = true;
    try {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
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
    } catch (e) {
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
  pmGetFilteredList() {
    let list = this.pmList || [];

    if (this.pmFilterEquip) {
      list = list.filter(p => p.equipmentId === this.pmFilterEquip);
    }
    if (this.pmFilterStatus) {
      list = list.filter(p => p.status === this.pmFilterStatus);
    }

    // Sort: overdue first, then by date
    const today = new Date().toISOString().split('T')[0];
    return [...list].sort((a, b) => {
      const aOverdue = a.status === 'pending' && a.date < today ? 1 : 0;
      const bOverdue = b.status === 'pending' && b.date < today ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return (a.date || '').localeCompare(b.date || '');
    });
  },

  // --- DASHBOARD HELPERS ---
  /** Pending tasks sorted: overdue first, then by date */
  get pmUpcomingList() {
    const today = new Date().toISOString().split('T')[0];
    return (this.pmList || [])
      .filter(p => p.status === 'pending')
      .sort((a, b) => {
        const aOverdue = a.date < today ? 1 : 0;
        const bOverdue = b.date < today ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        return (a.date || '').localeCompare(b.date || '');
      });
  },
  isPMOverdue(pm) {
    const today = new Date().toISOString().split('T')[0];
    return pm.status === 'pending' && pm.date < today;
  },
  isPMDueSoon(pm) {
    const today = new Date().toISOString().split('T')[0];
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    return pm.status === 'pending' && pm.date >= today && pm.date <= threeDays.toISOString().split('T')[0];
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
    const todayStr = today.toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const eventsByDate = {};
    const list = this.pmFilterEquip
      ? (this.pmList || []).filter(p => p.equipmentId === this.pmFilterEquip)
      : (this.pmList || []);

    // Build events lookup
    list.forEach(pm => {
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
    const todayStr = today.toISOString().split('T')[0];
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
      const dateStr = date.toISOString().split('T')[0];
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
    const todayStr = today.toISOString().split('T')[0];
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const endMonthStr = endMonth.toISOString().split('T')[0];
    const end30 = new Date(today);
    end30.setDate(today.getDate() + 30);
    const end30Str = end30.toISOString().split('T')[0];

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
    const todayStr = today.toISOString().split('T')[0];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
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

  pmGetGanttRows() {
    const days = this.pmGetGanttDays();
    if (days.length === 0) return [];

    const dayWidth = 20;
    const firstDateStr = days[0]?.dateStr || '';
    const lastDateStr = days[days.length - 1]?.dateStr || '';
    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const daysSinceEpoch = (dateStr) => Math.floor(new Date(dateStr).getTime() / 86400000);
    const day0 = daysSinceEpoch(firstDateStr);

    // Group by equipment
    const equipMap = {};
    const list = this.pmFilterEquip
      ? (this.pmList || []).filter(p => p.equipmentId === this.pmFilterEquip)
      : (this.pmList || []);

    list.forEach(pm => {
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

      if (!equipMap[pm.equipmentId]) {
        equipMap[pm.equipmentId] = { equipId: pm.equipmentId, events: [] };
      }
      equipMap[pm.equipmentId].events.push(evt);
    });

    return Object.values(equipMap).map(eq => {
      const status = eq.events.some(e => e.isOverdue) ? 'Overdue'
        : eq.events.some(e => e.isDueSoon) ? 'Due Soon'
        : 'Scheduled';

      const equip = window.app?.equipment?.find(e => e.EquipmentID === eq.equipId);
      return {
        equipId: eq.equipId,
        name: equip?.Nama || eq.equipId,
        status,
        events: eq.events,
      };
    });
  },
};
