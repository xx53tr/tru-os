'use strict';
import { esc, mount, nowClock } from '../utils.js';

export default {
  CFG: { class1: "MAT 151 (Math)", class2: "PSY 101 (Psych)" },
  state: { assignments: [], filter: 'all' },

  init() {
    try {
      const raw = localStorage.getItem('truos-academic');
      this.state.assignments = raw ? JSON.parse(raw) : [];
    } catch { 
      this.state.assignments = []; 
    }
    this.state.filter = localStorage.getItem('truos-ac-filter') || 'all';
    this.render();
    this.bindEvents();
  },

  importICS(text) {
    const events = [];
    const blocks = text.split('BEGIN:VEVENT');
    blocks.shift();

    blocks.forEach(block => {
      const titleMatch = block.match(/SUMMARY:(.*(?:\r?\n\s.*)*)/);
      let fullTitle = titleMatch ? titleMatch[1].replace(/\r?\n\s/g, '').trim() : "Untitled";
      let displayTitle = fullTitle.split('[')[0].trim();

      const dateMatch = block.match(/DTSTART[:;].*?(\d{8})/);
      let dueStr = "";
      if (dateMatch) {
        const d = dateMatch[1];
        dueStr = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T23:59:00`;
      }

      const cls = fullTitle.includes("MAT 151") ? "c1" : "c2";

      if (dueStr && !fullTitle.includes("OFFICE HOURS")) {
        events.push({
          id: 'ac-' + Math.random().toString(36).substr(2, 9),
          title: displayTitle,
          due: dueStr,
          cls: cls,
          done: false
        });
      }
    });

    const existing = JSON.parse(localStorage.getItem('truos-academic') || '[]');
    const combined = [...existing, ...events].reduce((acc, current) => {
      const isDup = acc.find(item => item.title === current.title && item.due === current.due && item.cls === current.cls);
      if (!isDup) acc.push(current);
      return acc;
    }, []);

    this.state.assignments = combined;
    this.save();
    Shell.toast(`SYNCED: ${events.length} CANVAS TASKS`);
  },

  save() {
    localStorage.setItem('truos-academic', JSON.stringify(this.state.assignments));
    localStorage.setItem('truos-ac-filter', this.state.filter);
    this.render();
    this.bindEvents();
  },

  urgency(due, done) {
    if (done) return 'done';
    const hours = (new Date(due) - new Date()) / 36e5;
    if (hours < 0) return 'overdue';
    if (hours < 24) return 'today';
    if (hours < 72) return 'soon';
    return 'upcoming';
  },

  // Returns week number (1-based) relative to the earliest due date in dataset
  _weekNum(dueDate, minDate) {
    return Math.floor((new Date(dueDate) - minDate) / (7 * 24 * 36e5)) + 1;
  },

  // Build a single card HTML string
  _card(a) {
    const u  = this.urgency(a.due, a.done);
    const dt = new Date(a.due).toLocaleDateString([], {month:'short', day:'numeric'});
    return `
      <div class="card ${a.done ? 'done' : u}">
        <div class="checkbox ${a.done ? 'checked' : ''}" onclick="AcademicModule.toggle('${a.id}')">${a.done ? '✓' : ''}</div>
        <div class="card-body">
          <div class="card-title">${esc(a.title)}</div>
          <div class="card-meta">${a.cls === 'c1' ? 'MAT 151' : 'PSY 101'} · Due ${dt}</div>
        </div>
        <button class="btn-del" onclick="AcademicModule.remove('${a.id}')">✕</button>
      </div>`;
  },

  render() {
    const all = this.state.assignments;

    // Determine anchor date (earliest due in full dataset, ignoring filter)
    const dates = all.map(a => new Date(a.due)).filter(d => !isNaN(d));
    const minDate = dates.length ? new Date(Math.min(...dates)) : new Date();

    // Apply class filter for display
    const visible = all.filter(a => {
      if (this.state.filter === 'c1') return a.cls === 'c1';
      if (this.state.filter === 'c2') return a.cls === 'c2';
      return true;
    });

    // Split pending vs done
    const pending = visible.filter(a => !a.done).sort((a,b) => new Date(a.due) - new Date(b.due));
    const done    = visible.filter(a => a.done).sort((a,b) => new Date(a.due) - new Date(b.due));

    // Group pending by week number
    const weekMap = new Map();
    pending.forEach(a => {
      const wk = this._weekNum(a.due, minDate);
      if (!weekMap.has(wk)) weekMap.set(wk, []);
      weekMap.get(wk).push(a);
    });

    // Build week progress denominator from ALL (not just filtered) per week
    const weekTotals = new Map();
    all.forEach(a => {
      const wk = this._weekNum(a.due, minDate);
      if (!weekTotals.has(wk)) weekTotals.set(wk, { total: 0, done: 0 });
      weekTotals.get(wk).total++;
      if (a.done) weekTotals.get(wk).done++;
    });

    // Header
    let html = `
      <header class="mod-header">
        <div>
          <span class="sys-label">TruOS · Module 02</span>
          <h1 class="mod-title">Academic<br><em>Tracker</em></h1>
        </div>
      </header>
      <div class="pill-row">
        <button class="pill ${this.state.filter==='all'?'active':''}" onclick="AcademicModule.setFilter('all')">ALL</button>
        <button class="pill ${this.state.filter==='c1'?'active':''}" onclick="AcademicModule.setFilter('c1')">MATH</button>
        <button class="pill ${this.state.filter==='c2'?'active':''}" onclick="AcademicModule.setFilter('c2')">PSYCH</button>
        <button class="pill p-amber" onclick="document.getElementById('ics-input').click()">+ IMPORT ICS</button>
        <input type="file" id="ics-input" hidden onchange="AcademicModule.handleFile(this)">
      </div>
      <div class="list-area">`;

    if (pending.length === 0 && done.length === 0) {
      html += `<div class="empty-state">NO ASSIGNMENTS FOUND</div>`;
    }

    // Render week groups
    const sortedWeeks = [...weekMap.keys()].sort((a,b) => a - b);
    sortedWeeks.forEach(wk => {
      const items  = weekMap.get(wk);
      const totals = weekTotals.get(wk) || { total: items.length, done: 0 };
      const pct    = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;
      const barW   = Math.min(100, pct);
      const barColor = pct === 100 ? 'background:var(--green)' : '';

      html += `
        <div class="week-header">
          <div class="week-label">
            <span>Week ${wk}</span>
            <span style="color:var(--muted);font-size:9px">${totals.done}/${totals.total} done</span>
          </div>
          <div class="week-progress-row">
            <div class="week-bar-track">
              <div class="week-bar-fill" style="width:${barW}%;${barColor}"></div>
            </div>
            <span class="week-bar-label">${pct}%</span>
          </div>
        </div>`;

      items.forEach(a => { html += this._card(a); });
    });

    // Completed section
    if (done.length > 0) {
      const isOpen = this.state.completedOpen || false;
      html += `
        <div class="completed-toggle" onclick="AcademicModule.toggleCompleted()">
          <span class="completed-caret ${isOpen ? 'open' : ''}">▶</span>
          COMPLETED (${done.length})
          <button class="clear-btn" style="margin-left:auto" onclick="event.stopPropagation();AcademicModule.purgeCompleted()">PURGE</button>
        </div>`;
      if (isOpen) {
        html += `<div class="completed-list">`;
        done.forEach(a => { html += this._card(a); });
        html += `</div>`;
      }
    }

    html += `</div>`;
    mount(html);
  },

  toggleCompleted() {
    this.state.completedOpen = !this.state.completedOpen;
    this.render();
  },

  purgeCompleted() {
    if (!confirm('Remove all completed assignments?')) return;
    this.state.assignments = this.state.assignments.filter(a => !a.done);
    this.state.completedOpen = false;
    this.save();
    Shell.toast('COMPLETED TASKS PURGED');
  },

  setFilter(f) { this.state.filter = f; localStorage.setItem('truos-ac-filter', f); this.render(); },
  toggle(id) {
    const a = this.state.assignments.find(x => x.id === id);
    if (a) a.done = !a.done;
    this.save();
  },
  remove(id) {
    this.state.assignments = this.state.assignments.filter(x => x.id !== id);
    this.save();
  },
  handleFile(input) {
    const reader = new FileReader();
    reader.onload = (e) => this.importICS(e.target.result);
    reader.readAsText(input.files[0]);
  },
  bindEvents() {},
  updateClock() {},
  teardown() { document.querySelectorAll('#ac-panel, #ac-fab').forEach(el => el.remove()); }
};


/* ═══════════════════════════════════════════
   MODULE 03 — TRADING TERMINAL
   Locked until Academic backlog is clear.
   Reads truos-academic directly from storage
   so state is always fresh on tab switch.
═══════════════════════════════════════════ */
