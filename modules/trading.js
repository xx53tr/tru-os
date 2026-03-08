'use strict';
import { esc, mount, nowClock } from '../utils.js';

export default {
  init() {
    try {
      const acData = JSON.parse(localStorage.getItem('truos-academic') || '[]');
      const now    = new Date();
      const overdue = acData.filter(a => !a.done && new Date(a.due) < now);
      overdue.length > 0 ? this.renderLocked(overdue.length) : this.renderActive();
    } catch {
      this.renderActive(); // fail open
    }
  },

  renderLocked(count) {
    mount(`
      <header class="mod-header">
        <div>
          <span class="sys-label">TruOS · Module 03</span>
          <h1 class="mod-title">Trading<br><em>Terminal</em></h1>
        </div>
      </header>
      <div class="locked-wrap">
        <div class="locked-icon">⚠️</div>
        <div class="locked-title">TERMINAL RESTRICTED</div>
        <div class="locked-sub">
          ACADEMIC DEBT DETECTED<br>
          <span style="color:var(--red);font-size:13px;font-weight:700">${count} OVERDUE TASK${count !== 1 ? 'S' : ''}</span><br><br>
          PROTOCOL REQUIRES ZERO BACKLOG<br>
          FOR TRADING ACCESS
        </div>
        <button class="pill p-amber" style="margin-top:24px;padding:12px 28px"
                onclick="Shell.switchTo('academic')">
          RESOLVE ACADEMIC LOGS →
        </button>
      </div>`);
  },

  renderActive() {
    mount(`
      <header class="mod-header">
        <div>
          <span class="sys-label">TruOS · Module 03</span>
          <h1 class="mod-title">Trading<br><em>Terminal</em></h1>
        </div>
        <div style="text-align:right">
          <div class="sys-label">STATUS</div>
          <div style="font-family:var(--mono);font-size:13px;color:var(--green);margin-top:2px">● CLEAR</div>
        </div>
      </header>
      <div class="stats-bar">
        <div class="stat"><span class="stat-val" style="color:var(--green)">$0.00</span><span class="stat-sub">P/L Day</span></div>
        <div class="stat"><span class="stat-val" style="color:var(--muted)">0.0%</span><span class="stat-sub">Daily Chg</span></div>
        <div class="stat"><span class="stat-val" style="color:var(--muted)">0</span><span class="stat-sub">Positions</span></div>
      </div>
      <div class="empty-state">TERMINAL ACTIVE<br>MARKET MODULE AWAITING BUILD</div>`);
  },

  updateClock() {},
  teardown() {}
}
