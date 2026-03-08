'use strict';

import { esc, mount, nowClock } from './utils.js';

/* ── Module registry ── */
window.__truos_modules = {};

const _loaded = {};

async function loadModule(name) {
  if (_loaded[name]) return _loaded[name];
  const mod = await import(`./modules/${name}.js`);
  if (!mod || !mod.default) throw new Error(`Module failed to load: ${name}`);
  _loaded[name] = mod.default;
  window.__truos_modules[name] = mod.default;
  return mod.default;
}

export const Shell = {
  _active:        null,
  _clockInterval: null,
  _activeKey:     null,

  async switchTo(name) {
    let mod;
    try {
      mod = await loadModule(name);
    } catch(err) {
      console.error(err);
      document.getElementById('main-content').innerHTML =
        `<div style="padding:40px 20px;font-family:monospace;color:#ff4757;font-size:12px">
          MODULE ERROR<br>${err.message}
        </div>`;
      return;
    }

    if (this._active?.teardown) this._active.teardown();
    if (this._clockInterval) { clearInterval(this._clockInterval); this._clockInterval = null; }

    document.querySelectorAll('.nav-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.mod === name)
    );
    document.querySelectorAll('.slide-panel, .fab').forEach(el => el.remove());

    this._active    = mod;
    this._activeKey = name;

    if (!mod._initialized) {
      mod.init();
      mod._initialized = true;
    } else {
      mod.init();
    }

    if (mod.updateClock) {
      mod.updateClock();
      this._clockInterval = setInterval(() => mod.updateClock(), 1000);
    }
  },

  exportState() {
    const state = {
      'truos-academic':     localStorage.getItem('truos-academic')     || '[]',
      'truos-ac-filter':    localStorage.getItem('truos-ac-filter')    || 'all',
      'truos_schedule_v34': localStorage.getItem('truos_schedule_v34') || 'null',
      'truos-finance':      localStorage.getItem('truos-finance')      || 'null',
    };

    const html = document.documentElement.outerHTML;
    const bootstrap = `
<script id="truos-state-bootstrap">
(function(){
  const state = ${JSON.stringify(state)};
  Object.entries(state).forEach(([k,v]) => { if(v && v !== 'null') localStorage.setItem(k,v); });
  document.getElementById('truos-state-bootstrap').remove();
})();
<\/script>`;

    const parts    = html.split('<\/body>');
    const exported = parts[0] + bootstrap + '\n<\/body>' + (parts[1] || '');
    const blob = new Blob([exported], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'TruOS-Unified.html'; a.click();
    URL.revokeObjectURL(url);
    Shell.toast('STATE EXPORTED — OPEN ON ANY DEVICE');
  },

  toast(msg, isErr = false) {
    const t = document.getElementById('shell-toast');
    t.textContent = msg;
    t.className   = 'show' + (isErr ? ' err' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = '', 2400);
  }
};

/* ── expose globally for modules that call Shell.toast/switchTo ── */
window.Shell = Shell;

/* ── Boot ── */
document.getElementById('shell-nav').addEventListener('click', e => {
  const tab = e.target.closest('[data-mod]');
  if (tab) Shell.switchTo(tab.dataset.mod);
});

Shell.switchTo('dashboard');
