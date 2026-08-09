import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fp = path.join(__dirname, '..', 'public', 'pages', 'KPI.html');
let s = fs.readFileSync(fp, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');

// ── Ganti semua grid chart (dari line 44) dengan 9 card sesuai renderer charts.js ──
const start = s.indexOf('  <!-- Chart Grid 1');
const end = s.indexOf('</div>\n</div>', start) + '</div>'.length;

const chartsHtml = `  <!-- Chart Grid 1: MTBF + MTTR -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-crosshairs text-amber-400"></i> MTBF by Equipment
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="mtbfChart"></canvas></div>
    </div>
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-wrench text-amber-400"></i> MTTR by Equipment
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="mttrChart"></canvas></div>
    </div>
  </div>

  <!-- Chart Grid 2: Availability + Reliability -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-heartbeat text-emerald-400"></i> Availability Trend
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="availabilityChart"></canvas></div>
    </div>
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-shield-alt text-purple-400"></i> Reliability R(t)
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="reliabilityChartKPI"></canvas></div>
    </div>
  </div>

  <!-- Chart Grid 3: Top Components + Sched vs Unsched -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-cogs text-amber-400"></i> Top 5 Downtime by Equipment
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="top5Components"></canvas></div>
    </div>
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-calendar-check text-emerald-400"></i> Scheduled vs Unscheduled
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="schedVsUnsched"></canvas></div>
    </div>
  </div>

  <!-- Chart Grid 4: Failure Type + Cost -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-fire text-rose-400"></i> Mechanical vs Electrical
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="failureTypeChart"></canvas></div>
    </div>
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-4 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-dollar-sign text-amber-400"></i> Maintenance Cost Trend (Rp M)
      </h3>
      <div class="flex-1 relative min-h-[260px]"><canvas id="costChart"></canvas></div>
    </div>
  </div>

  <!-- Chart Grid 5: Pareto RCA -->
  <div class="grid grid-cols-1 gap-6">
    <div class="card-modern p-6 border-nexus-accent/10 flex flex-col">
      <h3 class="font-bold mb-6 text-white flex items-center gap-3 text-xs uppercase tracking-widest">
        <i class="fas fa-chart-bar text-amber-400"></i> Pareto RCA Analysis <span class="text-slate-500 ml-auto text-[11px] normal-case tracking-normal">80/20 Rule - Major Failure Causes</span>
      </h3>
      <div class="flex-1 relative min-h-[350px]"><canvas id="paretoChart"></canvas></div>
    </div>
  </div>`;

s = s.slice(0, start) + chartsHtml + s.slice(end);

fs.writeFileSync(fp, s.split('\n').join(eol));
console.log('KPI.html: chart grids disinkronkan 1:1 ke renderer charts.js (9 canvas)');
