'use strict';
import { esc, mount, nowClock } from '../utils.js';

export default {

  STORAGE_KEY: 'truos-finance',
  SCHEMA_VER: 3,

  CATS: ['Dining','Groceries','Transport','Medical','Subscriptions','Personal Care','Entertainment','P2P','Other'],
  CAT_COLORS: {
    'Dining':'#ff6b81','Groceries':'#2ed573','Transport':'#1e90ff',
    'Medical':'#a29bfe','Subscriptions':'#fd79a8','Personal Care':'#fdcb6e',
    'Entertainment':'#e17055','P2P':'#636e72','Other':'#b2bec3'
  },
  ACCTS: {
    nfcu: { label: 'Navy Federal', color: '#f5a623' },
    wf:   { label: 'Wells Fargo',  color: '#9e61ff' }
  },

  /* ── Storage ── */
  _load() {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return this._seed();
      var p = JSON.parse(raw);
      if (p.schemaVer === 3) return p;
      if (p.schemaVer === 2) return this._migrateV2toV3(p);
      return this._migrateV1toV3(p);
    } catch(e) { return this._seed(); }
  },
  _save(d) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(d)); },

  /* ── Migration v2 → v3 ── */
  _migrateV2toV3(v2) {
    var v3 = this._emptyStore();
    var FM = this;
    Object.keys(v2.statements || {}).forEach(function(k) {
      var s = v2.statements[k];
      var nfcu = s.nfcu || null;
      var ref = nfcu || s.acct_b || null;
      var label = ref ? (ref.meta && ref.meta.period ? ref.meta.period : k) : k;
      // derive cal key from existing key
      var calKey = k.match(/^\d{4}-\d{2}$/) ? k + '-CAL' : k;
      v3.statements[calKey] = {
        nfcu: nfcu ? FM._upgradeAcct(nfcu, label) : null,
        wf:   null
      };
      if (v2.accountNames && v2.accountNames.acct_b) {
        v3.accountNames.wf = v2.accountNames.acct_b;
      }
    });
    this._save(v3);
    return v3;
  },
  _upgradeAcct(a, label) {
    if (a.meta && a.meta.cal_start) return a;
    var m = label.toLowerCase();
    var months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    var parts = m.split(' ');
    var mIdx = months.indexOf(parts[0]);
    var yr = parseInt(parts[1] || '2026');
    var calStart = '', calEnd = '';
    if (mIdx >= 0) {
      var lastDay = new Date(yr, mIdx + 1, 0).getDate();
      calStart = yr + '-' + String(mIdx+1).padStart(2,'0') + '-01';
      calEnd   = yr + '-' + String(mIdx+1).padStart(2,'0') + '-' + String(lastDay).padStart(2,'0');
    }
    a.meta = Object.assign({}, a.meta, { cal_start: calStart, cal_end: calEnd, stmt_start: '', stmt_end: '' });
    return a;
  },
  _migrateV1toV3(v1) { return this._seed(); },

  _emptyStore() {
    return { schemaVer: 3, accountNames: { nfcu: 'Navy Federal', wf: 'Wells Fargo' }, statements: {} };
  },

  /* ── Seed — verified forensic data ── */
  _seed() {
    var data = this._emptyStore();

    // ── JANUARY 2026-01-CAL ──
    // NFCU Jan: verified $247.73 income, $402.58 total spend
    // Category breakdown best-effort from session notes; $72.10 in Other (gap)
    data.statements['2026-01-CAL'] = {
      nfcu: {
        income: 247.73, startBal: 161.85, endBal: 7.00, fees: 2.00,
        transfersOut: 0, transfersIn: 0,
        spending: {
          'Dining': 70.21, 'Groceries': 7.21, 'Transport': 2.40,
          'Medical': 10.56, 'Subscriptions': 0, 'Personal Care': 31.82,
          'Entertainment': 0, 'P2P': 162.78, 'Other': 72.10
        },
        meta: { period: 'January 2026', cal_start: '2026-01-01', cal_end: '2026-01-31',
                stmt_start: '2025-12-22', stmt_end: '2026-01-21', days: 31,
                note: 'Category breakdown partial — $72.10 unidentified (statement not uploaded)' }
      },
      // WF Jan calendar slice: $3,487.58 income, $0 spend (all WF Jan withdrawals posted 2/5-2/6)
      wf: {
        income: 3487.58, startBal: 25.00, endBal: 2086.08, fees: 0,
        transfersOut: 0, transfersIn: 0,
        spending: {
          'Dining': 0, 'Groceries': 0, 'Transport': 0,
          'Medical': 0, 'Subscriptions': 0, 'Personal Care': 0,
          'Entertainment': 0, 'P2P': 0, 'Other': 0
        },
        meta: { period: 'January 2026', cal_start: '2026-01-01', cal_end: '2026-01-31',
                stmt_start: '2026-01-09', stmt_end: '2026-02-06', days: 31,
                note: 'WF Jan = pure accumulation. All withdrawals posted 2/5-2/6 → Feb slice.' }
      }
    };

    // ── FEBRUARY 2026-02-CAL ──
    // All figures verified to the penny against both statements
    data.statements['2026-02-CAL'] = {
      nfcu: {
        income: 720.00, startBal: 7.00, endBal: 50.04, fees: 0,
        transfersOut: 0, transfersIn: 720.00,
        spending: {
          'Dining': 330.41, 'Groceries': 87.57, 'Transport': 15.57,
          'Medical': 9.52, 'Subscriptions': 20.00, 'Personal Care': 43.33,
          'Entertainment': 80.74, 'P2P': 89.82, 'Other': 0
        },
        zelleSelf: { received: 720.00, txnCount: 13, avgAmt: 55.38 },
        meta: { period: 'February 2026', cal_start: '2026-02-01', cal_end: '2026-02-28',
                stmt_start: '2026-01-22', stmt_end: '2026-02-21', days: 28,
                note: 'Income = WF transfers received. Quran $500 pass-through (same-day $500 ATM out) zeroed.' }
      },
      wf: {
        // Income: Corewell $1553.53 + Corewell $1868.22 = $3421.75 recurring
        // McKayla $1000 one-time stored separately in meta
        // Lennox $93.06 return nets with Lenny send (already in P2P)
        income: 3421.75, startBal: 2086.08, endBal: 3923.43, fees: 3.00,
        transfersOut: 820.00, transfersIn: 0,
        spending: {
          'Dining': 416.11, 'Groceries': 80.31, 'Transport': 132.34,
          'Medical': 26.05, 'Subscriptions': 0, 'Personal Care': 82.47,
          'Entertainment': 499.76, 'P2P': 173.06, 'Other': 37.80
        },
        zelleSelf: {
          sent: 820.00, txnCount: 15, avgAmt: 54.67,
          // breakdown by date for tracker
          transfers: [
            { date: '2/7',  amt: 100 }, { date: '2/7',  amt: 20 },
            { date: '2/10', amt: 20  }, { date: '2/10', amt: 10 },
            { date: '2/11', amt: 40  }, { date: '2/12', amt: 30 },
            { date: '2/13', amt: 80  }, { date: '2/14', amt: 20 },
            { date: '2/14', amt: 100 }, { date: '2/14', amt: 100 },
            { date: '2/14', amt: 100 }, { date: '2/16', amt: 20 },
            { date: '2/20', amt: 40  }, { date: '2/20', amt: 40 },
            { date: '2/25', amt: 100 }
          ]
        },
        meta: {
          period: 'February 2026', cal_start: '2026-02-01', cal_end: '2026-02-28',
          stmt_start: '2026-02-07', stmt_end: '2026-03-06', days: 28,
          incomeOneTime: 1000.00, incomeOneTimeSource: 'Bass McKayla — source unverified',
          note: 'transfersOut $820: $720 received by NFCU Feb, $100 received by NFCU Mar (2/25 timing).'
        }
      }
    };

    this._save(data);
    return data;
  },

  /* ── Netting Engine ── */
  _netTransfers(stmt) {
    var accts = Object.values(stmt).filter(Boolean);
    var out = accts.reduce(function(s,a){ return s+(a.transfersOut||0); }, 0);
    var ins = accts.reduce(function(s,a){ return s+(a.transfersIn||0); }, 0);
    return { out: out, ins: ins, netted: Math.min(out, ins) };
  },

  /* ── Period Stats — income-based ── */
  _periodStats(stmt) {
    var FM = this;
    var accts = Object.values(stmt).filter(Boolean);
    var netting = this._netTransfers(stmt);
    var totalIncome = 0, totalFees = 0;
    var unifiedCats = {};
    this.CATS.forEach(function(c){ unifiedCats[c] = 0; });
    accts.forEach(function(a){
      totalIncome += (a.income || 0);
      totalFees   += (a.fees   || 0);
      FM.CATS.forEach(function(c){ unifiedCats[c] += (a.spending[c] || 0); });
    });
    // True income = income minus transfers received (avoid double count)
    var trueIncome = totalIncome - netting.ins;
    var totalSpend = Object.values(unifiedCats).reduce(function(s,v){ return s+v; },0) + totalFees;
    var days = (accts[0] && accts[0].meta && accts[0].meta.days) || 30;
    var net = trueIncome - totalSpend;
    var burnRate = totalSpend / days;
    var savingsRate = trueIncome > 0 ? (net / trueIncome) * 100 : 0;
    return { trueIncome: trueIncome, totalSpend: totalSpend, totalFees: totalFees,
             net: net, burnRate: burnRate, savingsRate: savingsRate,
             unifiedCats: unifiedCats, netting: netting, days: days };
  },

  /* ── Calendar overlap detection ── */
  _activeZone(stmt) {
    var accts = Object.values(stmt).filter(Boolean);
    if (accts.length < 2) return null;
    var starts = accts.map(function(a){ return a.meta && a.meta.stmt_start ? a.meta.stmt_start : ''; }).filter(Boolean);
    var ends   = accts.map(function(a){ return a.meta && a.meta.stmt_end   ? a.meta.stmt_end   : ''; }).filter(Boolean);
    if (starts.length < 2 || ends.length < 2) return null;
    var overlapStart = starts.reduce(function(a,b){ return a>b?a:b; });
    var overlapEnd   = ends.reduce(function(a,b){ return a<b?a:b; });
    if (overlapStart >= overlapEnd) return null;
    var ms = new Date(overlapEnd) - new Date(overlapStart);
    var days = Math.round(ms / 86400000) + 1;
    return { start: overlapStart, end: overlapEnd, days: days };
  },

  /* ── Income-based Pace (current month only) ── */
  _pace(stats, periodKey) {
    var stmt = this._load().statements[periodKey];
    var ref  = stmt && (stmt.nfcu || stmt.wf);
    if (!ref || !ref.meta || !ref.meta.cal_start) return null;
    var now      = new Date();
    var calEnd   = new Date(ref.meta.cal_end);
    var calStart = new Date(ref.meta.cal_start);
    // Only show live pace if today is within the calendar window
    if (now < calStart || now > calEnd) return null;
    var totalDays = ref.meta.days || 28;
    var elapsed   = Math.min(now.getDate(), totalDays);
    var dayPct    = (elapsed / totalDays) * 100;
    var spendPct  = stats.trueIncome > 0 ? (stats.totalSpend / stats.trueIncome) * 100 : 0;
    var delta     = spendPct - dayPct;
    var status    = delta > 10 ? 'overpace' : delta > 0 ? 'watch' : 'ontrack';
    return { dayPct: dayPct, spendPct: spendPct, delta: delta, status: status };
  },

  /* ── Shift-to-Cost (net per 12hr base shift) ── */
  _netPerShift() {
    // Fallback constant — IncomeModule.CFG values: baseRate 17.31, tax 0.192
    // Resolved lazily at call time if IncomeModule is already in cache
    try {
      const inc = window.__truos_modules && window.__truos_modules['income'];
      if (inc && inc.CFG) return inc.CFG.baseRate * 12 * (1 - inc.CFG.tax);
    } catch(e) {}
    return 167.84; // 17.31 * 12 * (1 - 0.192)
  },

  /* ── Zelle-to-Self data for tracker ── */
  _zelleData(stmt) {
    var wf = stmt.wf;
    if (!wf || !wf.zelleSelf) return null;
    return wf.zelleSelf;
  },

  /* ── MoM Spike Flags ── */
  _spikeFlags(data, key) {
    var keys = Object.keys(data.statements).sort();
    var idx  = keys.indexOf(key);
    if (idx < 1) return [];
    var prev = this._periodStats(data.statements[keys[idx-1]]);
    var curr = this._periodStats(data.statements[key]);
    var flags = [];
    this.CATS.forEach(function(cat) {
      var p = prev.unifiedCats[cat], c = curr.unifiedCats[cat];
      if (p > 5 && c > p * 1.20) {
        var pct = (((c-p)/p)*100).toFixed(0);
        flags.push({ type:'amber', icon:'📈', title: cat.toUpperCase()+' SPIKE +'+pct+'%',
          detail: 'Was $'+p.toFixed(2)+' → now $'+c.toFixed(2)+'. Extra: $'+(c-p).toFixed(2)+'.' });
      }
    });
    return flags;
  },

  /* ── Subscription Creep ── */
  _subFlags(data, key) {
    var keys = Object.keys(data.statements).sort();
    var idx  = keys.indexOf(key);
    if (idx < 1) return [];
    var curr = data.statements[key];
    var prev = data.statements[keys[idx-1]];
    var cs = Object.values(curr).filter(Boolean).reduce(function(s,a){ return s+(a.spending['Subscriptions']||0); },0);
    var ps = Object.values(prev).filter(Boolean).reduce(function(s,a){ return s+(a.spending['Subscriptions']||0); },0);
    if (cs > 0 && ps > 0)
      return [{ type:'blue', icon:'🔁', title:'RECURRING SUBSCRIPTIONS · $'+cs.toFixed(2)+'/mo',
        detail:'Charged 2+ consecutive periods. Review each line: still needed?' }];
    return [];
  },

  /* ── Full Flag Suite ── */
  _allFlags(data, key, stats, pace) {
    var flags = [];
    var netPerShift = this._netPerShift();

    // Savings rate
    if (stats.savingsRate < 0)
      flags.push({ type:'red',   icon:'🔴', title:'DEFICIT PERIOD',
        detail:'Spent $'+Math.abs(stats.net).toFixed(2)+' more than earned. Immediate action required.' });
    else if (stats.savingsRate < 10)
      flags.push({ type:'red',   icon:'🔴', title:'LOW SAVINGS · '+stats.savingsRate.toFixed(1)+'%',
        detail:'Floor is 10%. You are below it.' });
    else if (stats.savingsRate < 20)
      flags.push({ type:'amber', icon:'🟡', title:'SAVINGS BELOW TARGET · '+stats.savingsRate.toFixed(1)+'%',
        detail:'Target is 20%+. Push harder.' });
    else
      flags.push({ type:'green', icon:'✅', title:'SAVINGS HEALTHY · '+stats.savingsRate.toFixed(1)+'%',
        detail:'Above the 20% target. Strong execution.' });

    // Pace
    if (pace) {
      if (pace.status === 'overpace')
        flags.push({ type:'red',   icon:'🚨', title:'OVERPACING · '+pace.spendPct.toFixed(1)+'% SPENT vs '+pace.dayPct.toFixed(1)+'% OF MONTH',
          detail:'You are '+Math.abs(pace.delta).toFixed(1)+' points ahead of pace. Slow down.' });
      else if (pace.status === 'watch')
        flags.push({ type:'amber', icon:'⚠️', title:'WATCH PACE · '+pace.spendPct.toFixed(1)+'% SPENT vs '+pace.dayPct.toFixed(1)+'% OF MONTH',
          detail:'Slightly ahead of income-based spend curve. Monitor.' });
      else
        flags.push({ type:'green', icon:'🟢', title:'PACE ON TRACK · '+pace.spendPct.toFixed(1)+'% SPENT vs '+pace.dayPct.toFixed(1)+'% OF MONTH',
          detail:'Spending is in line with how far through the month you are.' });
    }

    // Dining + shift cost
    var dining = stats.unifiedCats['Dining'] || 0;
    if (dining > 0) {
      var shiftsUsed = (dining / netPerShift).toFixed(1);
      var diningPct  = stats.totalSpend > 0 ? (dining / stats.totalSpend) * 100 : 0;
      flags.push({ type: diningPct > 25 ? 'amber' : 'blue', icon:'🍽️',
        title: diningPct > 25 ? 'DINING OVER 25% · '+diningPct.toFixed(1)+'% OF SPEND' : 'DINING · '+diningPct.toFixed(1)+'% OF SPEND',
        detail: '$'+dining.toFixed(2)+' on dining. Cut 50% = +$'+(dining*0.5).toFixed(0)+'/mo recovered.',
        shiftCost: '🏥 Cost: '+shiftsUsed+' Corewell 12hr shifts ($'+netPerShift.toFixed(2)+' net/shift)' });
    }

    // Fees
    if (stats.totalFees > 0)
      flags.push({ type:'red', icon:'💸', title:'BANK FEES · $'+stats.totalFees.toFixed(2),
        detail:'ATM charges or transaction fees. 100% avoidable.' });

    // Netting info
    if (stats.netting.netted > 0)
      flags.push({ type:'blue', icon:'🔀', title:'TRANSFER NETTING · $'+stats.netting.netted.toFixed(2)+' ZEROED',
        detail:'Cross-account flows removed. Figures reflect true discretionary spend.' });

    // Burn rate
    flags.push({ type:'blue', icon:'📊', title:'DAILY BURN · $'+stats.burnRate.toFixed(2)+'/day',
      detail:'Daily operational cost × 30 = $'+(stats.burnRate*30).toFixed(0)+' projected monthly.' });

    return flags.concat(this._spikeFlags(data, key)).concat(this._subFlags(data, key));
  },

  _activePeriod: null,
  _panelOpen: false,
  _addAcct: 'nfcu',
  _cogOpen: false,
  _advancedOpen: false,

  init() {
    var FM   = this;
    var data = this._load();
    var keys = Object.keys(data.statements).sort();
    if (!this._activePeriod || !data.statements[this._activePeriod])
      this._activePeriod = keys[keys.length - 1];

    var stmt  = data.statements[this._activePeriod];
    var stats = this._periodStats(stmt);
    var pace  = this._pace(stats, this._activePeriod);
    var flags = this._allFlags(data, this._activePeriod, stats, pace);
    var zone  = this._activeZone(stmt);
    var zts   = this._zelleData(stmt);
    var netPerShift = this._netPerShift();

    var netColor  = stats.net >= 0 ? 'var(--green)' : 'var(--red)';
    var srColor   = stats.savingsRate >= 20 ? 'var(--green)' : stats.savingsRate >= 10 ? 'var(--amber)' : 'var(--red)';
    var burnColor = pace ? (pace.status==='overpace' ? 'var(--red)' : pace.status==='watch' ? 'var(--amber)' : 'var(--green)') : 'var(--amber)';
    var paceLabel = pace ? (pace.status==='overpace' ? ' ⚠ OVERPACE' : pace.status==='watch' ? ' ▲ WATCH' : ' ✓ ON TRACK') : '';

    // Period pills
    var periodPills = keys.map(function(k) {
      var ref = data.statements[k].nfcu || data.statements[k].wf;
      var lbl = ref && ref.meta && ref.meta.period ? ref.meta.period.replace(' 2026','') : k;
      return '<div class="pill'+(k===FM._activePeriod?' active':'')+'" onclick="FinanceModule._setPeriod(\''+k+'\')">'+lbl+'</div>';
    }).join('');

    // Compact account header lines
    var acctLines = Object.entries(this.ACCTS).map(function(entry) {
      var id = entry[0], def = entry[1];
      var a  = stmt[id];
      var name = (data.accountNames && data.accountNames[id]) || def.label;
      if (!a) return '<div class="fin-acct-line"><span class="fin-acct-line-name" style="color:'+def.color+'40">'+name+'</span><span class="fin-acct-line-detail">no data</span></div>';
      var spent = FM.CATS.reduce(function(s,c){ return s+(a.spending[c]||0); },0) + (a.fees||0);
      return '<div class="fin-acct-line"><span class="fin-acct-line-name" style="color:'+def.color+'">'+name+'</span><span class="fin-acct-line-detail">$'+(a.startBal||0).toFixed(0)+' → $'+(a.endBal||0).toFixed(0)+' &nbsp;·&nbsp; +$'+a.income.toFixed(0)+' in &nbsp;·&nbsp; −$'+spent.toFixed(0)+' out</span></div>';
    }).join('');
    var nettedLine = stats.netting.netted > 0 ? '<div class="fin-acct-netted">⇌ $'+stats.netting.netted.toFixed(2)+' transfers netted</div>' : '';
    var zoneLabel  = zone ? '<div class="fin-active-zone">ACTIVE ZONE '+zone.start+' → '+zone.end+' · '+zone.days+' days</div>' : '';

    // Pace bar
    var paceBarHTML = '';
    if (pace) {
      var sw = Math.min(pace.spendPct,100).toFixed(1);
      var dw = Math.min(pace.dayPct,100).toFixed(1);
      var bc = pace.status==='overpace' ? 'var(--red)' : pace.status==='watch' ? 'var(--amber)' : 'var(--green)';
      paceBarHTML = '<div class="fin-pace-label"><span style="color:'+bc+'">SPEND '+pace.spendPct.toFixed(1)+'%</span><span style="color:var(--muted)">DAY '+pace.dayPct.toFixed(1)+'% OF MONTH</span></div><div class="fin-pace-bar"><div class="fin-pace-spend" style="width:'+sw+'%;background:'+bc+'"></div><div class="fin-pace-day-marker" style="left:'+dw+'%"></div></div>';
    }

    // Category bars
    var maxSpend = Math.max.apply(null, Object.values(stats.unifiedCats).concat([1]));
    var catRows = this.CATS.map(function(cat) {
      var total = stats.unifiedCats[cat] || 0;
      if (total === 0) return '';
      var color   = FM.CAT_COLORS[cat];
      var pctMax  = (total / maxSpend) * 100;
      var subBars = Object.entries(FM.ACCTS).map(function(entry) {
        var id = entry[0], def = entry[1];
        var a  = stmt[id];
        if (!a) return '';
        var av = a.spending[cat] || 0;
        if (av === 0) return '';
        return '<div class="fin-cat-bar-track" title="'+(( data.accountNames && data.accountNames[id]) || def.label)+': $'+av.toFixed(2)+'"><div class="fin-cat-bar-fill" style="width:'+((av/maxSpend)*100).toFixed(1)+'%;background:'+def.color+';opacity:0.55"></div></div>';
      }).filter(Boolean).join('');
      return '<div class="fin-cat-row"><div class="fin-cat-top"><div class="fin-cat-name">'+cat+'</div><div class="fin-cat-dual-bar"><div class="fin-cat-bar-track"><div class="fin-cat-bar-fill" style="width:'+pctMax.toFixed(1)+'%;background:'+color+'"></div></div>'+subBars+'</div><div class="fin-cat-amt" style="color:'+color+'">$'+total.toFixed(0)+'</div></div></div>';
    }).filter(Boolean).join('');

    // Flags HTML
    var flagsHTML = flags.length ? flags.map(function(f) {
      var sc = f.shiftCost ? '<div class="fin-shift-cost">'+f.shiftCost+'</div>' : '';
      return '<div class="fin-flag flag-'+f.type+'"><span class="fin-flag-icon">'+f.icon+'</span><div class="fin-flag-body"><div class="fin-flag-title">'+f.title+'</div><div class="fin-flag-detail">'+f.detail+sc+'</div></div></div>';
    }).join('') : '<div class="empty-state">ALL CLEAR</div>';

    // Zelle-to-self tracker
    var ztsHTML = '';
    if (zts && zts.transfers && zts.transfers.length) {
      var maxAmt = Math.max.apply(null, zts.transfers.map(function(t){ return t.amt; }));
      var rows = zts.transfers.map(function(t) {
        var pct = (t.amt / maxAmt * 100).toFixed(0);
        return '<div class="fin-zts-row"><span class="fin-zts-label">'+t.date+'</span><div class="fin-zts-bar-track"><div class="fin-zts-bar-fill" style="width:'+pct+'%"></div></div><span class="fin-zts-amt">$'+t.amt.toFixed(0)+'</span></div>';
      }).join('');
      var totalSent = zts.sent || zts.received || 0;
      var count     = zts.transfers.length;
      var avgAmt    = (totalSent / count).toFixed(2);
      var freq      = (28 / count).toFixed(1);
      ztsHTML = '<div class="fin-zts-wrap">'+rows+'<div class="fin-zts-summary">'+count+' transfers · $'+totalSent.toFixed(2)+' total · avg $'+avgAmt+' · every '+freq+' days<br><span class="fin-zts-warning">⚠ Reactive pattern detected.</span> 1 weekly transfer of ~$'+Math.ceil(totalSent/4)+' replaces '+count+' micro-transfers.</div></div>';
    }

    // 3-month compare bars
    var recent3 = keys.slice(-3);
    var maxNet  = Math.max.apply(null, recent3.map(function(k){ return Math.abs(FM._periodStats(data.statements[k]).net); }).concat([1]));
    var compareBars = recent3.map(function(k) {
      var s   = FM._periodStats(data.statements[k]);
      var ht  = (Math.abs(s.net) / maxNet * 100);
      var col = s.net >= 0 ? 'var(--green)' : 'var(--red)';
      var ref = data.statements[k].nfcu || data.statements[k].wf;
      var lbl = ref && ref.meta && ref.meta.period ? ref.meta.period.replace(' 2026','').substring(0,3).toUpperCase() : k;
      return '<div class="fin-cbar-wrap"><div class="fin-cbar-amt" style="color:'+col+'">'+(s.net>=0?'+':'')+'$'+Math.abs(s.net).toFixed(0)+'</div><div class="fin-cbar" style="height:'+ht+'%;background:'+col+';opacity:0.75"></div><div class="fin-cbar-label">'+lbl+'</div></div>';
    }).join('');

    // Quick Add panel cat inputs
    var catInputs = this.CATS.map(function(c) {
      return '<div class="fin-cat-input-row"><div class="fin-cat-input-label">'+c+'</div><input type="number" id="fin-cat-'+c.replace(/[\s\/]/g,'_')+'" placeholder="0.00" /></div>';
    }).join('');

    var ref = stmt.nfcu || stmt.wf;
    var periodLabel = ref && ref.meta ? ref.meta.period : this._activePeriod;

    mount(
      '<header class="mod-header">'+
        '<div><span class="sys-label">TruOS · Module 05</span><h1 class="mod-title">Finance<br><em>Audit</em></h1></div>'+
        '<div style="display:flex;align-items:flex-start;gap:10px">'+
          '<div style="text-align:right">'+
            '<div class="sys-label" style="margin-bottom:4px">Burn Rate</div>'+
            '<div style="font-family:var(--mono);font-size:18px;font-weight:700;color:'+burnColor+'">$'+stats.burnRate.toFixed(2)+'<span style="font-size:9px;color:'+burnColor+'">'+paceLabel+'</span></div>'+
          '</div>'+
          '<button class="fin-cog-btn" onclick="FinanceModule._openCog()">⚙</button>'+
        '</div>'+
      '</header>'+
      '<div class="fin-wrap">'+
        '<div class="fin-period-row">'+periodPills+'<div class="pill" onclick="FinanceModule._openPanel(\'nfcu\')">+ Add</div></div>'+
        '<div class="fin-acct-header-bar">'+acctLines+nettedLine+zoneLabel+'</div>'+
        paceBarHTML+
        '<div class="fin-phase-head">Spend Breakdown · <span>'+periodLabel+'</span></div>'+
        '<div class="fin-cats">'+catRows+'</div>'+
        '<div class="fin-phase-head">Phase 3 · <span>Audit Flags</span></div>'+
        '<div class="fin-flags">'+flagsHTML+'</div>'+
        (ztsHTML ? '<div class="fin-phase-head">Zelle-to-Self · <span>WF → NFCU Flow</span></div>'+ztsHTML : '')+
        '<div class="fin-phase-head">3-Month Net Trend</div>'+
        '<div class="fin-compare-bars">'+compareBars+'</div>'+
      '</div>'+
      '<div class="fin-p4-sticky">'+
        '<div class="fin-p4-metric"><span class="fin-p4-val" style="color:'+srColor+'">'+stats.savingsRate.toFixed(1)+'%</span><span class="fin-p4-sub">Savings Rate</span></div>'+
        '<div class="fin-p4-metric"><span class="fin-p4-val" style="color:'+burnColor+'">$'+stats.burnRate.toFixed(2)+'</span><span class="fin-p4-sub">Burn / Day</span></div>'+
        '<div class="fin-p4-metric"><span class="fin-p4-val" style="color:'+netColor+';font-size:13px">'+(stats.net>=0?'+':'')+'$'+Math.abs(stats.net).toFixed(0)+'</span><span class="fin-p4-sub">Net Period</span></div>'+
      '</div>'+
      '<div class="slide-panel" id="fin-panel">'+
        '<div class="fin-panel-title">+ Quick <span>Statement</span></div>'+
        '<div class="fin-section-head">Account</div>'+
        '<div class="fin-acct-select">'+
          '<div class="fin-acct-opt'+(this._addAcct==='nfcu'?' selected':'')+'" onclick="FinanceModule._setAddAcct(\'nfcu\')">Navy Federal</div>'+
          '<div class="fin-acct-opt'+(this._addAcct==='wf'?' selected':'')+'" onclick="FinanceModule._setAddAcct(\'wf\')">Wells Fargo</div>'+
        '</div>'+
        '<input id="fin-period-label" placeholder="e.g. March 2026" />'+
        '<input id="fin-cal-start" placeholder="Cal Start (YYYY-MM-DD)" />'+
        '<input id="fin-cal-end"   placeholder="Cal End   (YYYY-MM-DD)" />'+
        '<input id="fin-income" type="number" placeholder="Total Income ($)" />'+
        '<input id="fin-total-spend" type="number" placeholder="Total Spend ($)" />'+
        '<input id="fin-dining-quick" type="number" placeholder="Dining ($)" />'+
        '<button class="fin-advanced-toggle" onclick="FinanceModule._toggleAdvanced()">▸ Advanced breakdown</button>'+
        '<div class="fin-advanced-section'+(this._advancedOpen?' open':'')+'" id="fin-advanced">'+
          '<div style="display:flex;gap:8px"><input id="fin-fees" type="number" placeholder="Fees ($)" style="flex:1" /><input id="fin-start-bal" type="number" placeholder="Start Bal ($)" style="flex:1" /></div>'+
          '<div style="display:flex;gap:8px"><input id="fin-end-bal" type="number" placeholder="End Bal ($)" style="flex:1" /><input id="fin-xfer-out" type="number" placeholder="Transfers Out ($)" style="flex:1" /></div>'+
          '<input id="fin-xfer-in" type="number" placeholder="Transfers In ($)" />'+
          '<div class="fin-section-head">Per Category</div>'+
          '<div class="fin-cat-inputs">'+catInputs+'</div>'+
        '</div>'+
        '<button class="fin-save-btn" onclick="FinanceModule._saveStatement()">SAVE STATEMENT</button>'+
      '</div>'
    );
  },

  _setPeriod(k) { this._activePeriod = k; this.init(); },
  _setAddAcct(id) { this._addAcct = id; this.init(); setTimeout(function(){ FinanceModule._openPanel(id); },50); },
  _toggleAdvanced() {
    this._advancedOpen = !this._advancedOpen;
    var el  = document.getElementById('fin-advanced');
    var btn = document.querySelector('.fin-advanced-toggle');
    if (el)  el.classList.toggle('open', this._advancedOpen);
    if (btn) btn.textContent = (this._advancedOpen ? '▾ ' : '▸ ') + 'Advanced breakdown';
  },
  _openPanel(id) {
    if (id) this._addAcct = id;
    this._panelOpen = true;
    var el = document.getElementById('fin-panel');
    if (el) el.classList.add('open');
  },
  _closePanel() {
    this._panelOpen = false;
    var el = document.getElementById('fin-panel');
    if (el) el.classList.remove('open');
  },

  /* ── Settings Cog ── */
  _openCog() {
    this._cogOpen = true;
    var data = this._load();
    var names = data.accountNames || {};
    var modal = document.createElement('div');
    modal.className = 'fin-cog-modal'; modal.id = 'fin-cog-modal';
    modal.innerHTML =
      '<div class="fin-cog-inner">'+
        '<div class="fin-cog-title">⚙ ACCOUNT SETTINGS</div>'+
        '<div class="fin-cog-row"><div class="fin-cog-label">Navy Federal Label</div><input id="fin-cog-nfcu" value="'+(names.nfcu||'Navy Federal')+'" /></div>'+
        '<div class="fin-cog-row"><div class="fin-cog-label">Wells Fargo Label</div><input id="fin-cog-wf" value="'+(names.wf||'Wells Fargo')+'" /></div>'+
        '<button class="fin-cog-save" onclick="FinanceModule._saveCog()">SAVE CHANGES</button>'+
        '<button class="fin-cog-close" onclick="FinanceModule._closeCog()">Cancel</button>'+
      '</div>';
    document.body.appendChild(modal);
  },
  _saveCog() {
    var data = this._load();
    if (!data.accountNames) data.accountNames = {};
    var n = document.getElementById('fin-cog-nfcu');
    var w = document.getElementById('fin-cog-wf');
    if (n && n.value.trim()) data.accountNames.nfcu = n.value.trim();
    if (w && w.value.trim()) data.accountNames.wf   = w.value.trim();
    this._save(data); this._closeCog(); Shell.toast('Settings saved'); this.init();
  },
  _closeCog() {
    var el = document.getElementById('fin-cog-modal');
    if (el) el.parentNode.removeChild(el);
    this._cogOpen = false;
  },

  /* ── Save Statement ── */
  _saveStatement() {
    var label    = (document.getElementById('fin-period-label') || {}).value || '';
    label = label.trim();
    if (!label) { Shell.toast('Enter a period label', true); return; }

    var calStart = ((document.getElementById('fin-cal-start') || {}).value || '').trim();
    var calEnd   = ((document.getElementById('fin-cal-end')   || {}).value || '').trim();
    var income   = parseFloat((document.getElementById('fin-income')       || {}).value) || 0;
    var totSpend = parseFloat((document.getElementById('fin-total-spend')  || {}).value) || 0;
    var dining   = parseFloat((document.getElementById('fin-dining-quick') || {}).value) || 0;
    var fees     = parseFloat((document.getElementById('fin-fees')         || {}).value) || 0;
    var startBal = parseFloat((document.getElementById('fin-start-bal')    || {}).value) || 0;
    var endBal   = parseFloat((document.getElementById('fin-end-bal')      || {}).value) || 0;
    var xferOut  = parseFloat((document.getElementById('fin-xfer-out')     || {}).value) || 0;
    var xferIn   = parseFloat((document.getElementById('fin-xfer-in')      || {}).value) || 0;

    var months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    var parts  = label.toLowerCase().split(' ');
    var mIdx   = months.indexOf(parts[0]);
    var yr     = parts[1] || '2026';
    var key    = mIdx >= 0 ? (yr + '-' + String(mIdx+1).padStart(2,'0') + '-CAL') : label.replace(/\s+/g,'-').toLowerCase();

    // Derive cal dates if not provided
    if (!calStart && mIdx >= 0) calStart = yr + '-' + String(mIdx+1).padStart(2,'0') + '-01';
    if (!calEnd   && mIdx >= 0) { var ld = new Date(parseInt(yr), mIdx+1, 0).getDate(); calEnd = yr + '-' + String(mIdx+1).padStart(2,'0') + '-' + String(ld).padStart(2,'0'); }
    var days = calStart && calEnd ? Math.round((new Date(calEnd)-new Date(calStart))/86400000)+1 : 30;

    var spending = {};
    var FM = this;
    this.CATS.forEach(function(c){ spending[c] = 0; });
    if (this._advancedOpen) {
      this.CATS.forEach(function(c) {
        var el = document.getElementById('fin-cat-'+c.replace(/[\s\/]/g,'_'));
        spending[c] = parseFloat((el||{}).value) || 0;
      });
    } else {
      spending['Dining'] = dining;
      spending['Other']  = Math.max(0, totSpend - dining - fees);
    }

    var data = this._load();
    if (!data.statements[key]) data.statements[key] = { nfcu: null, wf: null };
    data.statements[key][this._addAcct] = {
      income: income, startBal: startBal, endBal: endBal,
      transfersOut: xferOut, transfersIn: xferIn, fees: fees,
      spending: spending,
      meta: { period: label, cal_start: calStart, cal_end: calEnd, stmt_start: '', stmt_end: '', days: days }
    };
    this._save(data);
    this._activePeriod = key;
    this._advancedOpen = false;
    this._closePanel();
    Shell.toast('Statement saved');
    this.init();
  },

  stats() {
    var data = this._load();
    var keys = Object.keys(data.statements).sort();
    if (!keys.length) return null;
    var latest = data.statements[keys[keys.length-1]];
    var s = this._periodStats(latest);
    var ref = latest.nfcu || latest.wf;
    return Object.assign({}, s, { period: ref && ref.meta ? ref.meta.period : keys[keys.length-1] });
  },

  teardown() { this._panelOpen = false; if (this._cogOpen) this._closeCog(); }
}

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
