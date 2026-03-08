'use strict';

export default {

  /* ── Exact CONFIG from v3.4 ── */
  CFG: {
    baseRate:    17.31,
    diffs:       { afternoon: 2.50, midnight: 2.75, weekend: 2.00 },
    tax:         0.192,
    otThreshold: 40,
    target:      2000
  },

  DAYS: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],

  state: {
    weeks:      null,  // hydrated in init()
    activeWeek: 0
  },

  /* ── Core math — exact port from v3.4 ── */
  calculateShiftGross(isWeekend, cumHrsBefore, duration) {
    const { baseRate, diffs, otThreshold } = this.CFG;
    const wknd = isWeekend ? diffs.weekend : 0;
    const blockAHrs = Math.min(duration, 4.5);
    const blockBHrs = Math.max(0, duration - blockAHrs);

    const blocks = [
      { hrs: blockAHrs, rate: baseRate + diffs.afternoon + wknd },
      { hrs: blockBHrs, rate: baseRate + diffs.midnight  + wknd }
    ];

    let shiftTotal = 0;
    let runningCumHrs = cumHrsBefore;

    blocks.forEach(block => {
      if (block.hrs <= 0) return;
      const regInBlock = Math.min(block.hrs, Math.max(0, otThreshold - runningCumHrs));
      const otInBlock  = block.hrs - regInBlock;
      shiftTotal      += (regInBlock * block.rate) + (otInBlock * block.rate * 1.5);
      runningCumHrs   += block.hrs;
    });
    return shiftTotal;
  },

  toNet(gross) { return gross * (1 - this.CFG.tax); },

  emptyWeeks() {
    return [0,1].map(() =>
      this.DAYS.reduce((acc, d) => ({ ...acc, [d]: { type: 'off', hrs: 12 } }), {})
    );
  },

  /* ── Replaces React's useMemo weekCalcs ── */
  calcWeek(week) {
    let totalGross = 0, cumHrs = 0;
    const days = {};
    this.DAYS.forEach(day => {
      const s = week[day];
      if (s.type === 'off') { days[day] = { ...s, gross: 0, net: 0, otHrs: 0 }; return; }
      const gross   = this.calculateShiftGross(s.type === 'wknd', cumHrs, s.hrs);
      const otTotal = Math.max(0, (cumHrs + s.hrs) - this.CFG.otThreshold);
      const shiftOT = Math.min(s.hrs, otTotal);
      days[day]     = { ...s, gross, net: this.toNet(gross), otHrs: shiftOT };
      totalGross   += gross;
      cumHrs       += s.hrs;
    });
    return { days, totalGross, totalNet: this.toNet(totalGross), totalHrs: cumHrs };
  },

  getCombined(weekCalcs) {
    const gross = weekCalcs[0].totalGross + weekCalcs[1].totalGross;
    return { gross, net: this.toNet(gross), hrs: weekCalcs[0].totalHrs + weekCalcs[1].totalHrs };
  },

  fmt(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

  /* ── Storage ── */
  init() {
    // Hydrate fresh each mount — no stale IIFE state
    try {
      const raw = localStorage.getItem('truos_schedule_v34');
      this.state.weeks = raw ? JSON.parse(raw) : this.emptyWeeks();
      // Validate shape
      if (!Array.isArray(this.state.weeks) || this.state.weeks.length !== 2) {
        this.state.weeks = this.emptyWeeks();
      }
    } catch {
      this.state.weeks = this.emptyWeeks();
      localStorage.removeItem('truos_schedule_v34');
    }
    this.state.activeWeek = 0;
    this.render();
    this.bindEvents();
  },

  save() {
    try { localStorage.setItem('truos_schedule_v34', JSON.stringify(this.state.weeks)); } catch(e) {}
  },

  updateDay(wi, day, type, hrs) {
    this.state.weeks[wi] = { ...this.state.weeks[wi], [day]: { type, hrs } };
    this.save();
    this.render();
    this.bindEvents();
  },

  updateClock() {
    const c = nowClock();
    const te = document.getElementById('inc-time');
    const de = document.getElementById('inc-date');
    if (te) te.textContent = c.time;
    if (de) de.textContent = c.date;
  },

  /* ── Render ── */
  render() {
    const weekCalcs  = this.state.weeks.map(w => this.calcWeek(w));
    const combined   = this.getCombined(weekCalcs);
    const remaining  = Math.max(0, this.CFG.target - combined.net);
    const pct        = Math.min(100, (combined.net / this.CFG.target) * 100);
    const aw         = this.state.activeWeek;
    const wc         = weekCalcs[aw];

    /* Week tabs */
    const tabsHTML = [0,1].map(wi => `
      <div class="week-tab${aw === wi ? ' active' : ''}" data-action="week-tab" data-wi="${wi}">
        WEEK ${wi+1} · ${weekCalcs[wi].totalHrs}H
      </div>`).join('');

    /* Day rows */
    const daysHTML = this.DAYS.map(day => {
      const s   = wc.days[day];
      const isOn = s.type !== 'off';
      const tagType = s.type === 'wknd' ? 'wknd' : s.type === 'base' ? 'base' : 'pickup';

      const typeChips = ['base','pickup','wknd'].map(t => {
        const active = s.type === t;
        const cls = active ? (t === 'wknd' ? 'chip active-w' : 'chip active') : 'chip';
        return `<button class="${cls}" data-action="set-type" data-day="${day}" data-type="${t}" data-hrs="${s.hrs}">${t[0].toUpperCase()}</button>`;
      }).join('');

      const hrsChips = isOn ? [8,12].map(h =>
        `<button class="chip${s.hrs===h?' active':''}" data-action="set-hrs" data-day="${day}" data-type="${s.type}" data-hrs="${h}">${h}H</button>`
      ).join('') : '';

      const removeBtn = isOn
        ? `<button class="chip-remove" data-action="remove-day" data-day="${day}">✕</button>`
        : '';

      return `
        <div class="day-row">
          <div>
            <div class="day-name${isOn ? ' on' : ''}">${day.substring(0,3).toUpperCase()}</div>
            ${isOn ? `<div class="tag-row">
              <span class="tag tag-${tagType}">${s.hrs}H ${s.type}</span>
              ${s.otHrs > 0 ? `<span class="tag tag-ot">${s.otHrs}H OT</span>` : ''}
            </div>` : ''}
          </div>
          <div>
            <div class="chip-row">${typeChips}${removeBtn}</div>
            ${isOn ? `<div class="chip-row">${hrsChips}</div>` : ''}
          </div>
          <div class="day-earn${isOn ? ' on' : ''}">
            ${isOn ? `$${Math.round(s.net)}` : '—'}
          </div>
        </div>`;
    }).join('');

    const gapColor = remaining > 0 ? 'var(--red)' : 'var(--green)';
    const gapText  = remaining > 0 ? `GAP: -$${this.fmt(remaining)}` : '✓ GOAL REACHED';

    mount(`
      <header class="mod-header">
        <div>
          <span class="sys-label">TruOS · Module 01</span>
          <h1 class="mod-title">Income<br><em>Optimizer</em></h1>
        </div>
        <div style="text-align:right">
          <div class="sys-label" id="inc-date"></div>
          <div style="font-family:var(--mono);font-size:18px;font-weight:700;" id="inc-time"></div>
        </div>
      </header>

      <div class="inc-wrap">

        <!-- Progress card -->
        <div class="progress-card">
          <div class="pc-top">
            <div>
              <div class="sys-label" style="margin-bottom:5px">Biweekly Net</div>
              <div class="pc-net"><sup>$</sup>${this.fmt(combined.net)}</div>
            </div>
            <div class="pc-target">
              <div class="pc-target-val">$${this.CFG.target}</div>
              <div class="sys-label" style="margin-top:2px">target</div>
            </div>
          </div>
          <div class="v-bar"><div class="v-fill" style="width:${pct}%"></div></div>
          <div class="v-meta">
            <span>${pct.toFixed(1)}% complete · ${combined.hrs}H scheduled</span>
            <span style="color:${gapColor}">${gapText}</span>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-bar" style="padding:0 0 16px">
          <div class="stat">
            <span class="stat-val" style="color:var(--green)">$${Math.round(combined.net)}</span>
            <span class="stat-sub">Net Pay</span>
          </div>
          <div class="stat">
            <span class="stat-val" style="color:var(--amber)">$${Math.round(combined.gross)}</span>
            <span class="stat-sub">Gross</span>
          </div>
          <div class="stat">
            <span class="stat-val" style="color:var(--muted)">${combined.hrs}H</span>
            <span class="stat-sub">Hours</span>
          </div>
        </div>

        <!-- Week tabs + clear -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="sys-label">Schedule Builder</div>
          <button class="clear-btn" data-action="clear-all">CLEAR</button>
        </div>
        <div class="week-tabs">${tabsHTML}</div>

        <!-- Day rows -->
        <div id="days-grid">${daysHTML}</div>

      </div>
    `);

    this.updateClock();
  },

  bindEvents() {
    const wrap = document.getElementById('main-content');
    if (!wrap || wrap._incBound) return;
    wrap._incBound = true;

    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, wi, day, type, hrs } = btn.dataset;
      const aw = this.state.activeWeek;

      if (action === 'week-tab') {
        this.state.activeWeek = +wi;
        this.render(); this.bindEvents(); return;
      }
      if (action === 'clear-all') {
        if (confirm('Clear both weeks?')) {
          this.state.weeks = this.emptyWeeks();
          this.save(); this.render(); this.bindEvents();
        }
        return;
      }
      if (action === 'set-type') {
        this.updateDay(aw, day, type, +hrs); return;
      }
      if (action === 'set-hrs') {
        this.updateDay(aw, day, type, +hrs); return;
      }
      if (action === 'remove-day') {
        this.updateDay(aw, day, 'off', 12); return;
      }
    });
  },

  teardown() {
    const wrap = document.getElementById('main-content');
    if (wrap) wrap._incBound = false;
  }
};

/* ═══════════════════════════════════════════
   MODULE 02 — ACADEMIC TRACKER (Canvas Optimized)
═══════════════════════════════════════════ */
