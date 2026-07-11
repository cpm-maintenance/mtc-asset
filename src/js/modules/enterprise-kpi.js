/**
 * Enterprise KPI Engine — Decision Support Analytics
 * Industry standards: ISO 14224, SAE JA1011, SMRP
 */
export const enterpriseKPI = {
  // ─── Availability ───
  calcAvailability(equipId) {
    const logs = this._raw(this.logs) || [];
    const perf = this._raw(this.performanceData) || [];
    const elogs = logs.filter(l => l && l.EquipmentID === equipId);
    const eperf = perf.filter(p => p && p.EquipmentID === equipId);
    const totalHrs = eperf.reduce((s, p) => s + (Number(p.wh) || 24), 0);
    const downHrs = eperf.reduce((s, p) => s + (Number(p.bd) || 0) + (Number(p.stb) || 0), 0);
    if (!totalHrs) return { pct: 100, status: 'Optimal', color: 'green' };
    const avail = Math.round(((totalHrs - downHrs) / totalHrs) * 100);
    return {
      pct: Math.max(0, Math.min(100, avail)),
      status: avail >= 95 ? 'Optimal' : avail >= 85 ? 'Good' : avail >= 70 ? 'Warning' : 'Critical',
      color: avail >= 95 ? 'green' : avail >= 85 ? 'blue' : avail >= 70 ? 'orange' : 'red',
    };
  },

  // ─── MTBF (Mean Time Between Failures) ───
  calcMTBF(equipId) {
    const logs = this._raw(this.logs) || [];
    const elogs = logs.filter(l => l && l.EquipmentID === equipId && (l.Jenis === 'Breakdown' || l.Jenis === 'Repair'));
    if (elogs.length < 2) return null;
    const perf = this._raw(this.performanceData) || [];
    const eperf = perf.filter(p => p && p.EquipmentID === equipId);
    const totalHrs = eperf.reduce((s, p) => s + (Number(p.wh) || 24), 0);
    const failureCount = elogs.length - 1;
    return failureCount > 0 ? Math.round(totalHrs / failureCount) : null;
  },

  // ─── MTTR (Mean Time To Repair) ───
  calcMTTR(equipId) {
    const logs = this._raw(this.logs) || [];
    const elogs = logs.filter(l => l && l.EquipmentID === equipId && (l.Jenis === 'Breakdown' || l.Jenis === 'Repair'));
    if (elogs.length < 1) return null;
    const perf = this._raw(this.performanceData) || [];
    const eperf = perf.filter(p => p && p.EquipmentID === equipId);
    const downHrs = eperf.reduce((s, p) => s + (Number(p.bd) || 0), 0);
    const failureCount = elogs.length;
    return failureCount > 0 ? Math.round((downHrs / failureCount) * 10) / 10 : null;
  },

  // ─── Reliability (R(t) = e^(-t/MTBF)) ───
  calcReliability(equipId) {
    const mtbf = this.calcMTBF(equipId);
    if (!mtbf || mtbf <= 0) return { pct: 100, status: 'Optimal', color: 'green' };
    const t = 720;
    const r = Math.exp(-t / mtbf);
    const pct = Math.round(r * 100);
    return {
      pct: Math.max(0, Math.min(100, pct)),
      status: pct >= 90 ? 'Optimal' : pct >= 70 ? 'Good' : pct >= 50 ? 'Warning' : 'Critical',
      color: pct >= 90 ? 'green' : pct >= 70 ? 'blue' : pct >= 50 ? 'orange' : 'red',
    };
  },

  // ─── OEE (Overall Equipment Effectiveness) ───
  calcOEE() {
    const equip = this._raw(this.equipment) || [];
    const perf = this._raw(this.performanceData) || [];
    const logs = this._raw(this.logs) || [];
    let availSum = 0, count = 0;
    equip.forEach(e => { const a = this.calcAvailability(e.EquipmentID); availSum += a.pct; count++; });
    const availability = count > 0 ? availSum / count : 0;

    // Performance: actual run hrs / planned hrs from perf data
    let perfSum = 0, perfCount = 0;
    const perfMap = {};
    perf.forEach(p => { if (p.EquipmentID) {
      const wh = Number(p.wh) || 0;
      const bd = Number(p.bd) || 0;
      const stb = Number(p.stb) || 0;
      const planned = wh + bd + stb;
      if (planned > 0) { perfMap[p.EquipmentID] = (perfMap[p.EquipmentID] || 0) + (wh / planned); perfCount++; }
    }});
    const performance = perfCount > 0 ? (Object.values(perfMap).reduce((s, v) => s + v, 0) / perfCount) * 100 : 85;

    // Quality: WO completed vs total with rework flags
    const completedWO = logs.filter(l => l.Status === 'Completed');
    const reworkWO = logs.filter(l => l.Status === 'Completed' && (l.Jenis === 'Repair' || l.Jenis === 'Breakdown'));
    const quality = completedWO.length > 0 ? ((completedWO.length - reworkWO.length) / completedWO.length) * 100 : 95;

    const oee = Math.round((availability * performance * quality) / 10000);
    const status = oee >= 85 ? 'Optimal' : oee >= 70 ? 'Good' : oee >= 50 ? 'Warning' : 'Critical';
    const color = oee >= 85 ? 'green' : oee >= 70 ? 'blue' : oee >= 50 ? 'orange' : 'red';
    const hexColor = oee >= 85 ? '#22c55e' : oee >= 70 ? '#3b82f6' : oee >= 50 ? '#f59e0b' : '#ef4444';
    return {
      oee, status, color, hexColor,
      availability: Math.round(availability),
      performance: Math.round(performance),
      quality: Math.round(quality),
    };
  },

  // ─── Health Score ───
  calcHealthScore(equipId) {
    if (!equipId) return { score: 100, status: 'Optimal', color: 'green' };
    let score = 100;
    const logs = this._raw(this.logs) || [];
    const elogs = logs.filter(l => l && l.EquipmentID === equipId);
    const equipment = this._raw(this.equipment) || [];
    const asset = equipment.find(e => e && e.EquipmentID === equipId);
    if (!asset) return { score: 100, status: 'Optimal', color: 'green' };
    const now = new Date();
    const d90 = new Date(now - 90 * 86400000);
    const breakdowns = elogs.filter(l => l.Jenis === 'Breakdown' && l.Tanggal && new Date(l.Tanggal) > d90);
    score -= breakdowns.length * 15;
    if (asset.NextPMDate) {
      const pmd = new Date(asset.NextPMDate);
      if (!isNaN(pmd) && pmd < now) {
        const days = Math.floor((now - pmd) / 86400000);
        score -= Math.min(days * 2, 30);
      }
    }
    const mtbf = this.calcMTBF(equipId);
    if (mtbf && mtbf < 168) score -= 10;
    score = Math.max(0, Math.min(100, score));
    const status = score > 80 ? 'Optimal' : score > 50 ? 'Warning' : 'Critical';
    const color = score > 80 ? 'green' : score > 50 ? 'orange' : 'red';
    return { score, status, color, breakdowns: breakdowns.length };
  },

  // ─── Downtime (hours) ───
  calcDowntime(equipId, months = 12) {
    const perf = this._raw(this.performanceData) || [];
    const data = perf.filter(p => equipId ? p.EquipmentID === equipId : true);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const filtered = data.filter(p => p.date && new Date(p.date) > cutoff);
    return filtered.reduce((s, p) => s + (Number(p.bd) || 0) + (Number(p.stb) || 0), 0);
  },

  // ─── Maintenance Cost ───
  calcMaintCost(equipId, months = 12) {
    const logs = this._raw(this.logs) || [];
    const data = logs.filter(l => equipId ? l.EquipmentID === equipId : true);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const filtered = data.filter(l => l.Tanggal && new Date(l.Tanggal) > cutoff);
    return filtered.reduce((s, l) => s + (Number(l.cost) || 0), 0);
  },

  // ─── PM Compliance ───
  calcPMCompliance() {
    const pm = this._raw(this.pmList) || [];
    if (!pm.length) return { pct: 100, completed: 0, total: 0, overdue: 0, status: 'N/A', color: 'gray' };
    const completed = pm.filter(p => p.status === 'completed').length;
    const total = pm.length;
    const now = new Date().toISOString().split('T')[0];
    const overdue = pm.filter(p => p.status === 'pending' && p.date < now).length;
    const pct = Math.round((completed / total) * 100);
    return {
      pct, completed, total, overdue,
      status: pct >= 90 ? 'Excellent' : pct >= 70 ? 'Good' : pct >= 50 ? 'Warning' : 'Critical',
      color: pct >= 90 ? 'green' : pct >= 70 ? 'blue' : pct >= 50 ? 'orange' : 'red',
    };
  },

  // ─── Summary KPIs ───
  calcSummary() {
    const equip = this._raw(this.equipment) || [];
    const logs = this._raw(this.logs) || [];
    const perf = this._raw(this.performanceData) || [];
    const pm = this._raw(this.pmList) || [];
    const parts = this._raw(this.allParts) || [];
    const totalAssets = equip.length;
    const running = equip.filter(e => e.Status === 'Active' || e.Status === 'Running').length;
    const breakdown = equip.filter(e => e.Status === 'Breakdown' || e.Status === 'In Maintenance').length;
    const pmc = this.calcPMCompliance();
    const wos = logs.filter(l => l.woNumber || l.Status === 'Pending' || l.Status === 'Approved');
    const openWO = wos.filter(l => l.Status === 'Pending' || l.Status === 'Draft').length;
    const completedWO = wos.filter(l => l.Status === 'Completed').length;
    const overduePM = pm.filter(p => p.status === 'pending' && p.date < new Date().toISOString().split('T')[0]).length;
    const backlogWO = wos.filter(l => l.Status !== 'Completed' && l.Status !== 'Cancelled').length;
    let mtbfSum = 0, mtbfCount = 0;
    equip.forEach(e => { const m = this.calcMTBF(e.EquipmentID); if (m) { mtbfSum += m; mtbfCount++; } });
    const avgMTBF = mtbfCount > 0 ? Math.round(mtbfSum / mtbfCount) : 0;
    let mttrSum = 0, mttrCount = 0;
    equip.forEach(e => { const m = this.calcMTTR(e.EquipmentID); if (m) { mttrSum += m; mttrCount++; } });
    const avgMTTR = mttrCount > 0 ? Math.round((mttrSum / mttrCount) * 10) / 10 : 0;
    let availSum = 0, availCount = 0;
    equip.forEach(e => { const a = this.calcAvailability(e.EquipmentID); availSum += a.pct; availCount++; });
    const avgAvail = availCount > 0 ? Math.round(availSum / availCount) : 100;
    let relSum = 0, relCount = 0;
    equip.forEach(e => { const r = this.calcReliability(e.EquipmentID); relSum += r.pct; relCount++; });
    const avgRel = relCount > 0 ? Math.round(relSum / relCount) : 100;
    let hlthSum = 0, hlthCount = 0;
    equip.forEach(e => { const h = this.calcHealthScore(e.EquipmentID); hlthSum += h.score; hlthCount++; });
    const avgHealth = hlthCount > 0 ? Math.round(hlthSum / hlthCount) : 100;
    const downtime = perf.reduce((s, p) => s + (Number(p.bd) || 0) + (Number(p.stb) || 0), 0);
    const maintCost = logs.reduce((s, l) => s + (Number(l.cost) || 0), 0);
    const invValue = parts.reduce((s, p) => s + (Number(p.Stok) || 0) * (Number(p.Harga) || 0), 0);
    const criticalParts = parts.filter(p => p.Criticality === 'Critical' || p.Criticality === 'High').length;
    const lowStock = parts.filter(p => Number(p.Stok) <= Number(p.MinStock)).length;
    return {
      totalAssets, running, breakdown, pmc, openWO, completedWO, overduePM, backlogWO,
      avgMTBF, avgMTTR, avgAvail, avgRel, avgHealth, downtime: Math.round(downtime * 10) / 10,
      maintCost: Math.round(maintCost), invValue: Math.round(invValue), criticalParts, lowStock,
    };
  },

  // ─── Top Critical Equipment ───
  calcCriticalEquip(limit = 10) {
    const equip = this._raw(this.equipment) || [];
    return equip.map(e => {
      const h = this.calcHealthScore(e.EquipmentID);
      const mtbf = this.calcMTBF(e.EquipmentID);
      const mttr = this.calcMTTR(e.EquipmentID);
      const logs = this._raw(this.logs) || [];
      const lastFail = logs.filter(l => l.EquipmentID === e.EquipmentID && l.Jenis === 'Breakdown')
        .sort((a, b) => (b.Tanggal || '').localeCompare(a.Tanggal || ''));
      const runningHrs = (this._raw(this.performanceData) || [])
        .filter(p => p.EquipmentID === e.EquipmentID)
        .reduce((s, p) => s + (Number(p.wh) || 0), 0);
      return {
        ...e,
        score: h.score, healthStatus: h.status, healthColor: h.color,
        mtbf: mtbf || '-', mttr: mttr || '-',
        lastFailure: lastFail[0]?.Tanggal || '-',
        runningHrs,
        priority: h.score <= 50 ? 'Critical' : h.score <= 70 ? 'High' : h.score <= 85 ? 'Medium' : 'Low',
      };
    }).sort((a, b) => a.score - b.score).slice(0, limit);
  },

  // ─── Downtime Trend ───
  calcDowntimeTrend() {
    const perf = this._raw(this.performanceData) || [];
    const months = {};
    perf.forEach(p => {
      if (!p.date) return;
      const m = p.date.substring(0, 7);
      if (!months[m]) months[m] = 0;
      months[m] += (Number(p.bd) || 0) + (Number(p.stb) || 0);
    });
    return Object.keys(months).sort().slice(-12).map(m => ({ month: m, hours: Math.round(months[m] * 10) / 10 }));
  },

  // ─── Cost Trend ───
  calcCostTrend() {
    const logs = this._raw(this.logs) || [];
    const months = {};
    logs.forEach(l => {
      if (!l.Tanggal || !l.cost) return;
      const m = l.Tanggal.substring(0, 7);
      if (!months[m]) months[m] = 0;
      months[m] += Number(l.cost);
    });
    return Object.keys(months).sort().slice(-12).map(m => ({ month: m, cost: Math.round(months[m]) }));
  },

  // ─── PM Compliance Trend ───
  calcPMTrend() {
    const pm = this._raw(this.pmList) || [];
    const months = {};
    pm.forEach(p => {
      if (!p.date) return;
      const m = p.date.substring(0, 7);
      if (!months[m]) months[m] = { total: 0, done: 0 };
      months[m].total++;
      if (p.status === 'completed') months[m].done++;
    });
    return Object.keys(months).sort().slice(-12).map(m => ({
      month: m, pct: months[m].total > 0 ? Math.round((months[m].done / months[m].total) * 100) : 0,
    }));
  },

  // ─── WO Status Counts ───
  calcWOStatus() {
    const logs = this._raw(this.logs) || [];
    const wos = logs.filter(l => l.woNumber || l.Status === 'Pending' || l.Status === 'Approved');
    return {
      completed: wos.filter(l => l.Status === 'Completed').length,
      inProgress: wos.filter(l => l.Status === 'In Progress').length,
      waitingMaterial: wos.filter(l => l.Status === 'Approved').length,
      pending: wos.filter(l => l.Status === 'Pending' || l.Status === 'Draft').length,
      cancelled: wos.filter(l => l.Status === 'Cancelled').length,
      overdue: wos.filter(l => l.Status === 'Pending' && l.Tanggal && l.Tanggal < new Date().toISOString().split('T')[0]).length,
    };
  },

  // ─── Health Distribution ───
  calcHealthDist() {
    const equip = this._raw(this.equipment) || [];
    const dist = { excellent: 0, good: 0, warning: 0, critical: 0 };
    equip.forEach(e => {
      const h = this.calcHealthScore(e.EquipmentID);
      if (h.score >= 85) dist.excellent++;
      else if (h.score >= 65) dist.good++;
      else if (h.score >= 40) dist.warning++;
      else dist.critical++;
    });
    return dist;
  },

  // ─── AI Insights ───
  calcInsights() {
    const ins = [];
    const summary = this.calcSummary();
    if (summary.pmc.pct < 90) {
      ins.push({ type: 'warning', icon: 'fa-calendar-check', msg: `PM Compliance ${summary.pmc.pct}% — turun vs target 90%. ${summary.overduePM} PM tasks overdue.` });
    } else {
      ins.push({ type: 'success', icon: 'fa-calendar-check', msg: `PM Compliance ${summary.pmc.pct}% — on track.` });
    }
    if (summary.backlogWO > 10) {
      ins.push({ type: 'critical', icon: 'fa-wrench', msg: `${summary.backlogWO} Work Orders in backlog. Prioritaskan review.` });
    }
    if (summary.lowStock > 0) {
      ins.push({ type: 'warning', icon: 'fa-boxes', msg: `${summary.lowStock} spare parts below minimum stock. Risk of stockout.` });
    }
    const critical = this.calcCriticalEquip(5);
    critical.forEach(e => {
      if (e.score < 40) {
        const logs = this._raw(this.logs) || [];
        const breakdowns = logs.filter(l => l.EquipmentID === e.EquipmentID && l.Jenis === 'Breakdown');
        if (breakdowns.length >= 3) {
          ins.push({ type: 'critical', icon: 'fa-biohazard', msg: `${e.Nama || e.EquipmentID} — ${breakdowns.length} breakdowns. Disarankan RCA.` });
        }
      }
    });
    if (summary.avgMTBF > 0 && summary.avgMTBF < 200) {
      ins.push({ type: 'warning', icon: 'fa-chart-line', msg: `Avg MTBF ${summary.avgMTBF}h — di bawah threshold 200h. Review maintenance strategy.` });
    }
    if (summary.avgAvail < 90) {
      ins.push({ type: 'critical', icon: 'fa-heartbeat', msg: `Availability ${summary.avgAvail}% — di bawah target 90%. Immediate action required.` });
    }
    return ins.slice(0, 6);
  },

  // ─── Inventory ABC Analysis ───
  calcInventoryABC() {
    const parts = this._raw(this.allParts) || [];
    const withVal = parts.filter(p => p.PartID && (Number(p.Stok) || 0) > 0);
    const sorted = withVal.sort((a, b) => ((Number(b.Stok) || 0) * (Number(b.Harga) || 0)) - ((Number(a.Stok) || 0) * (Number(a.Harga) || 0)));
    const totalVal = sorted.reduce((s, p) => s + (Number(p.Stok) || 0) * (Number(p.Harga) || 0), 0);
    let cum = 0;
    return sorted.map(p => {
      const val = (Number(p.Stok) || 0) * (Number(p.Harga) || 0);
      cum += val;
      const pct = totalVal > 0 ? cum / totalVal : 0;
      return { ...p, value: val, category: pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C' };
    });
  },

  // ─── Compute all enterprise dashboard data ───
  computeEnterpriseData() {
    if (this.currentPage !== 'enterprise') return;
    const s = this.calcSummary();
    this.enterpriseSummary = s;
    this.enterpriseOEE = this.calcOEE();
    this.enterpriseCritical = this.calcCriticalEquip(10);
    this.enterpriseInsights = this.calcInsights();
    this.enterpriseKPIList = [
      { key: 'totalAssets', label: 'Total Assets', value: s.totalAssets, icon: 'fa-industry', color: '#3b82f6', trend: 0 },
      { key: 'running', label: 'Running', value: s.running, icon: 'fa-play-circle', color: '#22c55e', trend: 0 },
      { key: 'breakdown', label: 'Breakdown', value: s.breakdown, icon: 'fa-exclamation-triangle', color: '#ef4444', trend: 0 },
      { key: 'pmc', label: 'PM Compliance', value: s.pmc.pct + '%', icon: 'fa-clipboard-check', color: s.pmc.color === 'green' ? '#22c55e' : '#f59e0b', trend: s.pmc.pct },
      { key: 'openWO', label: 'Open WO', value: s.openWO, icon: 'fa-wrench', color: '#f59e0b', trend: 0 },
      { key: 'completedWO', label: 'Completed WO', value: s.completedWO, icon: 'fa-check-circle', color: '#22c55e', trend: 0 },
      { key: 'avgAvail', label: 'Availability', value: s.avgAvail + '%', icon: 'fa-heartbeat', color: s.avgAvail >= 95 ? '#22c55e' : '#f59e0b', trend: s.avgAvail },
      { key: 'avgHealth', label: 'Health Index', value: s.avgHealth + '%', icon: 'fa-shield-alt', color: s.avgHealth >= 80 ? '#22c55e' : '#f59e0b', trend: s.avgHealth },
    ];
    const pm = this._raw(this.pmList) || [];
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    this.enterpriseUpcomingPM = pm.filter(p => p.status !== 'completed' && p.status !== 'cancelled' && p.date)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 15)
      .map(p => ({ ...p, due: p.date === today ? 'today' : p.date === tomorrow ? 'tomorrow' : p.date }));
    const wos = this._raw(this.logs) || [];
    this.enterpriseCriticalWO = wos.filter(l => l && (l.woNumber || l.Status === 'Pending') && l.Status !== 'Completed' && l.Status !== 'Cancelled')
      .sort((a, b) => { const pa = (a.woPriority === 'Emergency' ? 0 : a.woPriority === 'Urgent' ? 1 : 2); const pb = (b.woPriority === 'Emergency' ? 0 : b.woPriority === 'Urgent' ? 1 : 2); return pa - pb; }).slice(0, 10);
    const parts = this._raw(this.allParts) || [];
    this.enterpriseLowStock = parts.filter(p => p.PartID && Number(p.Stok) <= Number(p.MinStock)).slice(0, 10);
  },

  // ─── Refresh ───
  refreshDashboard() {
    this.computeEnterpriseData();
    this.renderEnterpriseCharts();
    this.showNotification('Dashboard refreshed', 'info');
  },

  // ─── KPI click ───
  kpiClick(key) {
    const map = { totalAssets: 'equip', running: 'equip', breakdown: 'equip', pmc: 'pms', openWO: 'wo', completedWO: 'wo', avgAvail: 'kpi', avgHealth: 'equip' };
    if (map[key]) this.currentPage = map[key];
  },

  // ─── Expandable equipment detail ───
  toggleEquipDetail(eqId) {
    if (this.expandedEquip === eqId) { this.expandedEquip = null; return; }
    this.expandedEquip = eqId;
  },
};
