/* ============================================================
   RENEWA — Charts & Dashboard Logic (Enhanced)
   ============================================================ */

// ── Color palette ─────────────────────────────────────────────
const C = {
  primary:   'hsl(152,76%,40%)',
  primary2:  'hsl(152,76%,55%)',
  blue:      'hsl(213,93%,55%)',
  yellow:    'hsl(45,93%,47%)',
  purple:    'hsl(270,60%,60%)',
  red:       'hsl(0,72%,55%)',
  muted:     'hsl(140,20%,85%)',
  border:    'hsl(140,20%,85%)',
  fg:        'hsl(160,50%,10%)',
  fgMuted:   'hsl(160,20%,40%)',
};

// ── Helpers ───────────────────────────────────────────────────
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function makeTooltip(id) {
  return `<div class="chart-tooltip" id="${id}"></div>`;
}

function showTip(tipId, container, cx, cy, html) {
  const tip = document.getElementById(tipId);
  if (!tip) return;
  tip.innerHTML = html;
  tip.style.display = 'block';
  const cRect = container.getBoundingClientRect();
  const left = cx - tip.offsetWidth / 2;
  tip.style.left = left + 'px';
  tip.style.top  = (cy - 44) + 'px';
}

function hideTip(tipId) {
  const tip = document.getElementById(tipId);
  if (tip) tip.style.display = 'none';
}

// ── Area Chart ────────────────────────────────────────────────
function drawAreaChart(containerId, data, yKey, color, tipId, formatVal) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const W = container.clientWidth || 560;
  const H = 260;
  const padL = 46, padR = 20, padT = 16, padB = 36;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const values = data.map(d => d[yKey]);
  const maxVal = Math.max(...values) * 1.15;

  const xS = i => padL + (i / (data.length - 1)) * cW;
  const yS = v => padT + cH - (v / maxVal) * cH;

  const pts = data.map((d, i) => [xS(i), yS(d[yKey])]);
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${xS(data.length - 1).toFixed(1)},${(padT + cH).toFixed(1)} L${xS(0).toFixed(1)},${(padT + cH).toFixed(1)} Z`;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = Math.round((maxVal / ticks) * i);
    const y = yS(val);
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="chart-grid-line"/>
      <text x="${padL - 7}" y="${(y + 4).toFixed(1)}" class="chart-y-label">${(formatVal || (v => v))(val)}</text>`;
  }).join('');

  const xLabels = data.map((d, i) =>
    `<text x="${xS(i).toFixed(1)}" y="${H - 6}" class="chart-x-label">${d.name}</text>`
  ).join('');

  const dots = pts.map((p, i) => `
    <circle class="chart-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5"
      fill="${color}" stroke="white" stroke-width="2"
      data-x="${p[0]}" data-y="${p[1]}" data-val="${data[i][yKey]}" data-name="${data[i].name}"/>`
  ).join('');

  const gradId = `grad_${containerId}`;
  container.innerHTML = `
    ${makeTooltip(tipId)}
    <svg viewBox="0 0 ${W} ${H}" class="area-chart-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      ${gridLines}
      ${xLabels}
      <path d="${areaPath}" fill="url(#${gradId})"/>
      <path d="${linePath}" stroke="${color}" class="chart-line-path" stroke-width="2.5"/>
      ${dots}
    </svg>`;

  container.querySelectorAll('.chart-dot').forEach(dot => {
    dot.addEventListener('mouseenter', e => {
      const val = e.target.dataset.val;
      const name = e.target.dataset.name;
      const x = parseFloat(e.target.dataset.x);
      const y = parseFloat(e.target.dataset.y);
      showTip(tipId, container, x, y, `<strong>${name}</strong><br>${(formatVal || (v => v))(val)}`);
    });
    dot.addEventListener('mouseleave', () => hideTip(tipId));
  });
}

// ── Bar Chart ─────────────────────────────────────────────────
function drawBarChart(containerId, data, yKey, colors, tipId, formatVal) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const W = container.clientWidth || 560;
  const H = 240;
  const padL = 46, padR = 16, padT = 16, padB = 36;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const values = data.map(d => d[yKey]);
  const maxVal = Math.max(...values) * 1.2;

  const barW = (cW / data.length) * 0.55;
  const xS = i => padL + (i + 0.5) * (cW / data.length);
  const yS = v => padT + cH - (v / maxVal) * cH;
  const bH = v => (v / maxVal) * cH;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = Math.round((maxVal / ticks) * i);
    const y = yS(val);
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="chart-grid-line"/>
      <text x="${padL - 7}" y="${(y + 4).toFixed(1)}" class="chart-y-label">${(formatVal || (v => v))(val)}</text>`;
  }).join('');

  const xLabels = data.map((d, i) =>
    `<text x="${xS(i).toFixed(1)}" y="${H - 6}" class="chart-x-label">${d.name}</text>`
  ).join('');

  const bars = data.map((d, i) => {
    const col = Array.isArray(colors) ? colors[i % colors.length] : colors;
    const x = (xS(i) - barW / 2).toFixed(1);
    const y = yS(d[yKey]).toFixed(1);
    const h = bH(d[yKey]).toFixed(1);
    return `
      <rect class="chart-bar" x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${h}"
        fill="${col}" rx="4" opacity="0.85"
        data-x="${xS(i)}" data-y="${y}" data-val="${d[yKey]}" data-name="${d.name}"/>`;
  }).join('');

  const gradId = `bgrad_${containerId}`;
  container.innerHTML = `
    ${makeTooltip(tipId)}
    <svg viewBox="0 0 ${W} ${H}" class="area-chart-svg" xmlns="http://www.w3.org/2000/svg">
      ${gridLines}
      ${xLabels}
      ${bars}
    </svg>`;

  container.querySelectorAll('.chart-bar').forEach(bar => {
    bar.addEventListener('mouseenter', e => {
      const val = e.target.dataset.val;
      const name = e.target.dataset.name;
      const x = parseFloat(e.target.dataset.x);
      const y = parseFloat(e.target.dataset.y);
      showTip(tipId, container, x, y, `<strong>${name}</strong><br>${(formatVal || (v => v))(val)}`);
    });
    bar.addEventListener('mouseleave', () => hideTip(tipId));
  });
}

// ── Donut Chart ───────────────────────────────────────────────
function renderDonutChart() {
  const container = document.getElementById('donutChart');
  if (!container) return;
  const mixData = [
    { name: 'Solar',   value: 65, color: C.yellow },
    { name: 'Wind',    value: 25, color: C.blue },
    { name: 'Biomass', value: 10, color: C.primary },
  ];
  const R = 88, r = 60, cx = 110, cy = 110, gap = 3, size = 220;
  let startAngle = -90;
  const slices = mixData.map(item => {
    const angle = (item.value / 100) * 360;
    const s = polarToCartesian(cx, cy, R, startAngle + gap / 2);
    const e = polarToCartesian(cx, cy, R, startAngle + angle - gap / 2);
    const si = polarToCartesian(cx, cy, r, startAngle + gap / 2);
    const ei = polarToCartesian(cx, cy, r, startAngle + angle - gap / 2);
    const large = angle - gap > 180 ? 1 : 0;
    startAngle += angle;
    return `<path d="M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${r} ${r} 0 ${large} 0 ${si.x} ${si.y} Z" fill="${item.color}" opacity="0.85" style="cursor:pointer;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.85"/>`;
  });
  container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${slices.join('')}</svg>`;
}

// ── CO2 Arc Meter ─────────────────────────────────────────────
function renderCo2Meter(containerId, value, maxValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const pct = Math.min(value / maxValue, 1);
  const R = 70, cx = 90, cy = 90;
  const startAngle = 210, sweepAngle = 300;
  const endAngle = startAngle + sweepAngle * pct;
  const s = polarToCartesian(cx, cy, R, startAngle);
  const e = polarToCartesian(cx, cy, R, endAngle);
  const sFull = polarToCartesian(cx, cy, R, startAngle);
  const eFull = polarToCartesian(cx, cy, R, startAngle + sweepAngle);
  const large = sweepAngle * pct > 180 ? 1 : 0;
  const largeFull = sweepAngle > 180 ? 1 : 0;

  container.innerHTML = `
    <svg viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg" style="width:180px;height:120px">
      <path d="M ${sFull.x} ${sFull.y} A ${R} ${R} 0 ${largeFull} 1 ${eFull.x} ${eFull.y}"
        fill="none" stroke="hsl(140,20%,88%)" stroke-width="10" stroke-linecap="round"/>
      <path d="M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}"
        fill="none" stroke="hsl(152,76%,40%)" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="none" style="transition:all 1.2s ease"/>
    </svg>`;
}

// ── Realtime Simulation ───────────────────────────────────────
let realtimeInterval = null;
let realtimeBars = [];
let realtimeCurrent = 78;

function startRealtimeSimulation() {
  const valueEl = document.getElementById('realtimeValue');
  const barsContainer = document.getElementById('realtimeBars');
  if (!valueEl || !barsContainer) return;

  // Init bars
  realtimeBars = Array.from({ length: 20 }, () => Math.random() * 60 + 30);
  renderRealtimeBars(barsContainer);

  clearInterval(realtimeInterval);
  realtimeInterval = setInterval(() => {
    const delta = (Math.random() - 0.45) * 8;
    realtimeCurrent = Math.max(30, Math.min(150, realtimeCurrent + delta));
    valueEl.textContent = realtimeCurrent.toFixed(1);

    realtimeBars.shift();
    realtimeBars.push(realtimeCurrent);
    renderRealtimeBars(barsContainer);
  }, 1200);
}

function renderRealtimeBars(container) {
  const max = Math.max(...realtimeBars);
  container.innerHTML = realtimeBars.map((v, i) => {
    const pct = (v / max) * 100;
    const isActive = i === realtimeBars.length - 1;
    return `<div class="realtime-bar ${isActive ? 'active' : ''}" style="height:${pct}%;background:${isActive ? C.primary : C.muted}"></div>`;
  }).join('');
}

// ── Producer Chart Data ───────────────────────────────────────
const dailyEnergyData = [
  { name: 'Mon', energy: 380 }, { name: 'Tue', energy: 295 },
  { name: 'Wed', energy: 540 }, { name: 'Thu', energy: 475 },
  { name: 'Fri', energy: 610 }, { name: 'Sat', energy: 705 },
  { name: 'Sun', energy: 660 },
];
const monthlyRevenueData = [
  { name: 'Aug', revenue: 780 }, { name: 'Sep', revenue: 920 },
  { name: 'Oct', revenue: 1100 },{ name: 'Nov', revenue: 960 },
  { name: 'Dec', revenue: 1350 },{ name: 'Jan', revenue: 1480 },
  { name: 'Feb', revenue: 1240 },
];
const demandTrendsData = [
  { name: '6am', demand: 35 }, { name: '8am', demand: 62 },
  { name: '10am', demand: 88 }, { name: 'Noon', demand: 74 },
  { name: '2pm', demand: 95 }, { name: '4pm', demand: 110 },
  { name: '6pm', demand: 98 }, { name: '8pm', demand: 70 },
];
const consumerUsageData = [
  { name: 'Mon', kwh: 28 }, { name: 'Tue', kwh: 34 },
  { name: 'Wed', kwh: 22 }, { name: 'Thu', kwh: 41 },
  { name: 'Fri', kwh: 38 }, { name: 'Sat', kwh: 52 },
  { name: 'Sun', kwh: 45 },
];
const consumerMonthlyCost = [
  { name: 'Aug', cost: 85 }, { name: 'Sep', cost: 92 },
  { name: 'Oct', cost: 78 }, { name: 'Nov', cost: 110 },
  { name: 'Dec', cost: 98 }, { name: 'Jan', cost: 105 },
  { name: 'Feb', cost: 88 },
];
const investorRoiData = [
  { name: 'Q1\'24', roi: 2.1 }, { name: 'Q2\'24', roi: 3.8 },
  { name: 'Q3\'24', roi: 5.2 }, { name: 'Q4\'24', roi: 6.9 },
  { name: 'Q1\'25', roi: 8.5 }, { name: 'Q2\'25', roi: 7.8 },
  { name: 'Q3\'25', roi: 9.2 },
];

function renderProducerCharts() {
  drawAreaChart('chartDailyEnergy', dailyEnergyData, 'energy', C.yellow, 'tip_daily', v => v + ' kWh');
  drawAreaChart('chartMonthlyRevenue', monthlyRevenueData, 'revenue', C.primary, 'tip_revenue', v => '$' + v);
  drawBarChart('chartDemandTrends', demandTrendsData, 'demand', [C.blue, C.primary, C.yellow, C.purple, C.blue, C.primary, C.yellow, C.purple], 'tip_demand', v => v + ' units');
}

function renderConsumerCharts() {
  drawBarChart('chartUsage', consumerUsageData, 'kwh', C.primary, 'tip_usage', v => v + ' kWh');
  drawAreaChart('chartMonthlyCost', consumerMonthlyCost, 'cost', C.blue, 'tip_cost', v => '$' + v);
  renderDonutChart();
  renderCo2Meter('co2Arc', 2450, 5000);
  initHBarAnimations();
}

function renderInvestorCharts() {
  drawAreaChart('chartROI', investorRoiData, 'roi', C.primary, 'tip_roi', v => v + '%');
  renderProjects();
}

function initHBarAnimations() {
  setTimeout(() => {
    document.querySelectorAll('.mini-hbar-fill').forEach(el => {
      const w = el.dataset.width;
      if (w) el.style.width = w;
    });
  }, 300);
}

// ── Investor Projects ─────────────────────────────────────────
const projects = [
  {
    id: 1,
    title: 'Apex Solar Array',
    location: 'Arizona Desert, USA',
    roi: '8.5%',
    goal: 2500000, raised: 1850000,
    term: '5 Years',
    capacity: '12 MW',
    impact: '8,400t CO₂/yr',
    status: 'Funding',
    bg: 'linear-gradient(135deg, hsl(35,60%,25%) 0%, hsl(38,80%,48%) 100%)',
  },
  {
    id: 2,
    title: 'North Sea Offshore Wind',
    location: 'North Sea, UK',
    roi: '10.2%',
    goal: 5000000, raised: 4200000,
    term: '10 Years',
    capacity: '50 MW',
    impact: '35,000t CO₂/yr',
    status: 'Funding',
    bg: 'linear-gradient(135deg, hsl(210,55%,20%) 0%, hsl(213,75%,48%) 100%)',
  },
  {
    id: 3,
    title: 'Sahara Biomass Plant',
    location: 'Morocco, Africa',
    roi: '7.8%',
    goal: 1800000, raised: 720000,
    term: '7 Years',
    capacity: '8 MW',
    impact: '5,200t CO₂/yr',
    status: 'Funding',
    bg: 'linear-gradient(135deg, hsl(152,40%,18%) 0%, hsl(152,65%,38%) 100%)',
  },
  {
    id: 4,
    title: 'Pacific Tidal Energy',
    location: 'Oregon Coast, USA',
    roi: '11.5%',
    goal: 8000000, raised: 2400000,
    term: '15 Years',
    capacity: '30 MW',
    impact: '22,000t CO₂/yr',
    status: 'New',
    bg: 'linear-gradient(135deg, hsl(190,60%,18%) 0%, hsl(195,80%,42%) 100%)',
  },
  {
    id: 5,
    title: 'Alpine Wind Corridor',
    location: 'Swiss Alps, Europe',
    roi: '9.0%',
    goal: 3500000, raised: 3150000,
    term: '8 Years',
    capacity: '25 MW',
    impact: '18,500t CO₂/yr',
    status: 'Closing',
    bg: 'linear-gradient(135deg, hsl(250,35%,22%) 0%, hsl(260,60%,52%) 100%)',
  },
  {
    id: 6,
    title: 'Gujarat Solar Mega Park',
    location: 'Gujarat, India',
    roi: '12.1%',
    goal: 10000000, raised: 3200000,
    term: '20 Years',
    capacity: '100 MW',
    impact: '72,000t CO₂/yr',
    status: 'Funding',
    bg: 'linear-gradient(135deg, hsl(25,60%,22%) 0%, hsl(30,90%,52%) 100%)',
  },
];

const statusColors = { Funding: C.primary, New: C.blue, Closing: C.yellow };

function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  grid.innerHTML = projects.map(p => {
    const pct = Math.round((p.raised / p.goal) * 100);
    const raisedM = (p.raised / 1e6).toFixed(2);
    const goalM   = (p.goal   / 1e6).toFixed(2);
    const sc = statusColors[p.status] || C.primary;

    return `
      <div class="project-card">
        <div class="project-image-wrap" style="background:${p.bg}">
          <div class="project-img-overlay"></div>
          <span class="project-status-badge" style="background:${sc}">${p.status}</span>
          <div class="project-title-area">
            <h3>${p.title}</h3>
            <div class="project-location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${p.location}
            </div>
          </div>
        </div>
        <div class="project-body">
          <div class="project-metrics">
            <div class="metric-box">
              <div class="metric-label">ROI</div>
              <div class="metric-value metric-roi">${p.roi}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Term</div>
              <div class="metric-value">${p.term}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Capacity</div>
              <div class="metric-value metric-impact">${p.capacity}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="hsl(152,76%,40%)" stroke-width="2.5" stroke-linecap="round"><path d="M17 8C8 10 5.9 16.17 3.82 22h0A15.63 15.63 0 0 1 2 17c0-5.52 3.71-10.56 9.44-13.75A15.56 15.56 0 0 1 20 2c0 3-1.31 6.24-3 8z"/></svg>
            <span style="font-size:0.72rem;font-weight:700;color:var(--primary)">${p.impact}</span>
          </div>
          <div class="funding-amounts">
            <span>$${raisedM}M Raised</span>
            <span class="funding-goal-text">Goal: $${goalM}M</span>
          </div>
          <div class="progress"><div class="progress-fill" style="width:0%" data-width="${pct}%"></div></div>
          <div class="funding-pct">${pct}% Funded</div>
          <button class="btn-invest" onclick="showToast('Investment Submitted 🎉', 'Your investment in ${p.title} is being processed.')">
            Invest Now
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  // Animate progress bars
  setTimeout(() => {
    document.querySelectorAll('.project-card .progress-fill').forEach(el => {
      const w = el.dataset.width;
      if (w) el.style.width = w;
    });
  }, 200);
}

// ── Energy listings ────────────────────────────────────────────
const listings = [
  { id: 1, name: 'Solar Panel Array A', type: 'Solar', available: 850, price: 0.11, status: 'Active' },
  { id: 2, name: 'Rooftop Solar B',     type: 'Solar', available: 320, price: 0.12, status: 'Active' },
  { id: 3, name: 'Wind Turbine W1',     type: 'Wind',  available: 1200, price: 0.10, status: 'Active' },
  { id: 4, name: 'Bio Generator BG1',   type: 'Biomass', available: 400, price: 0.13, status: 'Paused' },
];

function renderListingsTable() {
  const tbody = document.getElementById('listingsBody');
  if (!tbody) return;
  const typeColors = { Solar: C.yellow, Wind: C.blue, Biomass: C.primary };
  tbody.innerHTML = listings.map(l => `
    <tr>
      <td style="font-weight:700">${l.name}</td>
      <td><span class="badge" style="background:${typeColors[l.type]}20;color:${typeColors[l.type]};border:1px solid ${typeColors[l.type]}40">${l.type}</span></td>
      <td>${l.available.toLocaleString()} kWh</td>
      <td>$${l.price.toFixed(3)}/kWh</td>
      <td><span class="badge ${l.status === 'Active' ? 'badge-emerald' : 'badge-secondary'}">${l.status}</span></td>
      <td>
        <div class="listing-actions">
          <button class="btn-icon-sm" title="Edit" onclick="showToast('Edit Listing', 'Opening editor for ${l.name}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon-sm" title="Toggle" onclick="showToast('Status Updated', '${l.name} status toggled')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Page render orchestration ─────────────────────────────────
function renderProducerPage() {
  renderProducerCharts();
  renderListingsTable();
  startRealtimeSimulation();
  setTimeout(initHBarAnimations, 400);
}
function renderConsumerPage() {
  renderConsumerCharts();
}
function renderInvestorPage() {
  renderInvestorCharts();
}

// ── Resize ────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const path = window.location.pathname;
    if (path.includes('producer')) renderProducerCharts();
    else if (path.includes('consumer')) renderConsumerCharts();
    else if (path.includes('investor')) renderInvestorCharts();
  }, 200);
});

// ── Auto-init based on page ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('producer')) renderProducerPage();
  else if (path.includes('consumer')) renderConsumerPage();
  else if (path.includes('investor')) renderInvestorPage();
});
