'use strict';

export default {

  // Reuse Income math directly — single source of truth
  _incomeStats() {
    const CFG = IncomeModule.CFG;
    try {
      const raw = localStorage.getItem('truos_schedule_v34');
      const weeks = raw ? JSON.parse(raw) : IncomeModule.emptyWeeks();
      if (!Array.isArray(weeks) || weeks.length !== 2) return { net: 0, hrs: 0, pct: 0, gap: CFG.target };
      const calcs  = weeks.map(w => IncomeModule.calcWeek(w));
      const gross  = calcs[0].totalGross + calcs[1].totalGross;
      const net    = IncomeModule.toNet(gross);
      const hrs    = calcs[0].totalHrs   + calcs[1].totalHrs;
      const pct    = Math.min(100, (net / CFG.target) * 100);
      const gap    = Math.max(0, CFG.target - net);
      return { net, hrs, pct, gap, target: CFG.target };
    } catch { return { net: 0, hrs: 0, pct: 0, gap: CFG.target, target: CFG.target }; }
  },

  _academicStats() {
    try {
      const raw  = localStorage.getItem('truos-academic');
      const data = raw ? JSON.parse(raw) : [];
      const now  = new Date();
      const in72 = new Date(now.getTime() + 72 * 36e5);
      const overdue  = data.filter(a => !a.done && new Date(a.due) < now);
      const urgent   = data.filter(a => !a.done && new Date(a.due) >= now && new Date(a.due) <= in72);
      const done     = data.filter(a => a.done).length;
      const total    = data.length;
      const upcoming = data
        .filter(a => !a.done && new Date(a.due) >= now)
        .sort((a, b) => new Date(a.due) - new Date(b.due));
      const next = upcoming[0] || null;
      return { overdue: overdue.length, urgent: urgent.length, done, total, next };
    } catch { return { overdue: 0, urgent: 0, done: 0, total: 0, next: null }; }
  },

  _tradingLocked(overdueCount) {
    return overdueCount > 0;
  },

  // Status line — reads the full system state and picks a message
  _statusLine(income, academic, tradingLocked) {
    const incomeGood   = income.pct  >= 100;
    const academicGood = academic.overdue === 0;

    if (incomeGood && academicGood)
      return { text: 'ALL SYSTEMS NOMINAL', color: 'var(--green)' };
    if (!academicGood && income.gap > 500)
      return { text: `DEBT ON TWO FRONTS · ${academic.overdue} OVERDUE · $${Math.round(income.gap)} GAP`, color: 'var(--red)' };
    if (!academicGood)
      return { text: `ACADEMIC DEBT DETECTED · ${academic.overdue} OVERDUE TASK${academic.overdue !== 1 ? 'S' : ''}`, color: 'var(--red)' };
    if (academic.total - academic.done > 5)
      return { text: 'WARNING: HIGH ACADEMIC LOAD', color: 'var(--amber)' };
    if (income.gap > 0)
      return { text: `$${Math.round(income.gap)} TO TARGET · SCHEDULE MORE SHIFTS`, color: 'var(--amber)' };
    return { text: 'INCOME SECURED · CLEAR BACKLOG TO UNLOCK TRADING', color: 'var(--blue)' };
  },

  init() {
    const income   = this._incomeStats();
    const academic = this._academicStats();
    const locked   = this._tradingLocked(academic.overdue);
    const status   = this._statusLine(income, academic, locked);

    const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // Income bar color
    const barColor = income.pct >= 100 ? 'var(--green)'
      : income.pct >= 60 ? 'var(--amber)' : 'var(--red)';

    // Academic badge — shows overdue first, then 72h warning, then clear
    const acBadge = academic.overdue > 0
      ? `<span class="dash-card-badge badge-warn">${academic.overdue} OVERDUE</span>`
      : academic.urgent > 0
        ? `<span class="dash-card-badge badge-warn" style="background:rgba(245,166,35,0.15);border-color:rgba(245,166,35,0.4);color:var(--amber)">${academic.urgent} DUE SOON</span>`
        : `<span class="dash-card-badge badge-ok">CLEAR</span>`;

    // Next due string
    const nextDueHTML = academic.next
      ? `<div class="dash-next-due">NEXT DUE → <strong>${esc(academic.next.title)}</strong> · ${new Date(academic.next.due).toLocaleDateString([],{month:'short',day:'numeric'})}</div>`
      : academic.total === 0
        ? `<div class="dash-next-due">NO TASKS LOGGED</div>`
        : `<div class="dash-next-due" style="color:var(--green)">NO UPCOMING TASKS</div>`;

    // Trading badge
    const tradeBadge = locked
      ? `<span class="dash-card-badge badge-locked">LOCKED</span>`
      : `<span class="dash-card-badge badge-clear">UNLOCKED</span>`;
    const tradeColor = locked ? 'var(--amber)' : 'var(--green)';
    const tradeText  = locked
      ? `Clear ${academic.overdue} overdue task${academic.overdue !== 1 ? 's' : ''} to unlock`
      : 'Academic backlog clear — terminal active';

    const c = nowClock();

    mount(`
      <header class="mod-header">
        <div>
          <span class="sys-label">TruOS · Dashboard</span>
          <h1 class="mod-title">System<br><em>Overview</em></h1>
        </div>
        <div style="text-align:right">
          <div class="sys-label" id="dash-date">${c.date}</div>
          <div style="font-family:var(--mono);font-size:18px;font-weight:700;" id="dash-time">${c.time}</div>
        </div>
      </header>

      <div class="dash-wrap">

        <!-- Status line -->
        <div class="dash-status">
          <div class="sys-label" style="text-align:center;margin-bottom:6px">System Status</div>
          <div class="dash-status-line" style="color:${status.color}">${status.text}</div>
        </div>

        <!-- Income card -->
        <div class="dash-card" onclick="Shell.switchTo('income')">
          <div class="dash-card-top">
            <span class="dash-card-label">Income · Biweekly</span>
            ${income.pct >= 100
              ? `<span class="dash-card-badge badge-ok">GOAL MET</span>`
              : `<span class="dash-card-badge badge-warn">$${fmt(income.gap)} GAP</span>`}
          </div>
          <div class="dash-val" style="color:${barColor}">$${fmt(income.net)}</div>
          <div class="dash-sub">of $${fmt(income.target)} target · ${income.hrs}H scheduled</div>
          <div class="dash-bar">
            <div class="dash-bar-fill" style="width:${income.pct}%;background:${barColor}"></div>
          </div>
          <div class="dash-sub">${income.pct.toFixed(1)}% complete</div>
          <div class="dash-tap-hint">TAP TO EDIT SCHEDULE →</div>
        </div>

        <!-- Academic card -->
        <div class="dash-card" onclick="Shell.switchTo('academic')">
          <div class="dash-card-top">
            <span class="dash-card-label">Academic · Tasks</span>
            ${acBadge}
          </div>
          <div style="display:flex;gap:16px;align-items:flex-end">
            <div>
              <div class="dash-val" style="color:${academic.overdue > 0 ? 'var(--red)' : 'var(--green)'}">
                ${academic.overdue}
              </div>
              <div class="dash-sub">overdue</div>
            </div>
            <div style="padding-bottom:2px">
              <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--muted)">${academic.done}/${academic.total}</div>
              <div class="dash-sub">completed</div>
            </div>
          </div>
          ${nextDueHTML}
          <div class="dash-tap-hint">TAP TO VIEW TASKS →</div>
        </div>

        <!-- Trading card -->
        <div class="dash-card" onclick="Shell.switchTo('trading')">
          <div class="dash-card-top">
            <span class="dash-card-label">Trading · Terminal</span>
            ${tradeBadge}
          </div>
          <div class="dash-val" style="color:${tradeColor};font-size:20px;margin-bottom:6px">
            ${locked ? '⚠ RESTRICTED' : '● OPERATIONAL'}
          </div>
          <div class="dash-sub">${tradeText}</div>
          <div class="dash-tap-hint">TAP TO OPEN TERMINAL →</div>
        </div>

      </div>
    `);
  },

  updateClock() {
    const c = nowClock();
    const te = document.getElementById('dash-time');
    const de = document.getElementById('dash-date');
    if (te) te.textContent = c.time;
    if (de) de.textContent = c.date;
  },

  teardown() {}
};

/* ═══════════════════════════════════════════
   MODULE 05 — FINANCE AUDIT v3.0
   Calendar Slice · Verified Forensic Engine
═══════════════════════════════════════════ */
