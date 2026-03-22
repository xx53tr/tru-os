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

    if (this._active && this._active.teardown) this._active.teardown();
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

  confirm(msg, onOk) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center';
    overlay.innerHTML =
      '<div style="background:#0a0a0c;border-radius:24px 24px 0 0;padding:28px 20px 48px;width:100%;max-width:480px;border-top:1px solid rgba(255,255,255,0.12)">'
      + '<div style="font-family:\'Space Mono\',monospace;font-size:13px;color:#fff;margin-bottom:20px;letter-spacing:0.5px">' + esc(msg) + '</div>'
      + '<button id="_truos-ok" style="width:100%;padding:14px;background:#ff4757;color:#fff;border:none;border-radius:14px;font-family:\'Space Mono\',monospace;font-weight:700;font-size:12px;letter-spacing:2px;cursor:pointer;margin-bottom:8px">CONFIRM</button>'
      + '<button id="_truos-cancel" style="width:100%;padding:12px;background:transparent;border:none;color:rgba(255,255,255,0.45);font-family:\'Space Mono\',monospace;font-size:10px;cursor:pointer">CANCEL</button>'
      + '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#_truos-ok').addEventListener('click', function() {
      document.body.removeChild(overlay);
      onOk();
    });
    overlay.querySelector('#_truos-cancel').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });
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
