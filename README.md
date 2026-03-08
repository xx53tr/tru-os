# TruOS — Project README
*Handoff document for new conversation. Read this before touching any code.*

---

## What is TruOS?

A personal operating system built as a single self-contained HTML file. Designed for Tru — a CNA at Corewell Health working midnight shifts (6:30 PM – 7:00 AM), taking college courses (MAT 151, PSY 101), and building toward real estate and trading goals.

The entire app lives in one file: `index.html`. No frameworks, no build step, no server. Open it in a browser and it runs. A modular split version exists (`shell.js` + `modules/`) — architecture is finalized but deploy is blocked pending GitHub access. Do not re-architect or regenerate the split — just push when ready and point Vercel at `index.html`.

---

## Live Deployment

**`tru-os.vercel.app`** — live production URL

### How the stack works
- **GitHub** — stores the code. Every commit to `main` auto-triggers a deploy.
- **Vercel** — serves the app live. Watches GitHub and deploys automatically (~30 seconds).
- **Firebase Realtime Database** — stores all user data. Syncs across devices in real time.

```
Code change → GitHub (main) → Vercel auto-deploy → tru-os.vercel.app
User data → Firebase Realtime Database → synced to all devices instantly
```

> ⚠️ Repo is currently public. Verify Firebase credentials are not exposed in plaintext inside `index.html` before pushing sensitive changes.

---

## Firebase Setup

### Project
- **Project:** `realtime-database-ebc45`
- **Database URL:** `https://realtime-database-ebc45-default-rtdb.firebaseio.com`
- **Auth:** Anonymous auth enabled

### Security Rules
Data is locked to specific device UIDs. Only whitelisted UIDs can read/write.

```json
{
  "rules": {
    ".read": "auth != null && (auth.uid == 'DESKTOP_UID' || auth.uid == 'PHONE_UID')",
    ".write": "auth != null && (auth.uid == 'DESKTOP_UID' || auth.uid == 'PHONE_UID')"
  }
}
```

### Adding a new device
1. Open `tru-os.vercel.app` on the new device
2. Tap **⚠ COPY UID** in the top-right corner
3. Go to Firebase Console → Realtime Database → Rules
4. Add the new UID to both `.read` and `.write` conditions
5. Publish

> **Warning:** Clearing Safari browser data or switching browsers creates a new UID. If locked out, repeat the steps above.

### TruDB Sync Layer
All modules read/write through `TruDB` — never call Firebase directly from module logic.

- `TruDB.get(key)` — reads from localStorage cache (instant, works offline)
- `TruDB.set(key, value)` — writes to localStorage AND Firebase simultaneously
- `TruDB.on(key, cb)` — real-time listener, fires when another device updates data
- `TruDB.off(key)` / `TruDB.offAll()` — cleans up listeners on module switch

Sync badge (top-right corner):
- `● SYNCED` green — Firebase connected
- `↑ SYNCING` amber — write in progress
- `○ OFFLINE` gray — no Firebase connection (still works on localStorage)

---

## Repo Map

```
/
├── index.html              ← Entry point (modular split — pending deploy)
├── shell.js                ← Shell object, loadModule(), boot sequence
├── TruOS-Unified.html      ← Active working file (single-file version)
├── CLAUDE.md               ← AI session instructions (load before every dev session)
├── README.md               ← This file
└── modules/
    ├── dashboard.js        ← Home screen, cross-module summary badges
    ├── income.js           ← Shift scheduler, CFG, OT logic
    ├── academic.js         ← Canvas ICS import, urgency tiers, overdue detection
    ├── trading.js          ← Paper portfolio, live Yahoo Finance prices, academic gate
    └── finance.js          ← Dual-account audit, Calendar Slice schema, AI PDF upload
```

---

## Architecture

### Shell
- Central router — `Shell.switchTo(name)` mounts modules
- Toast notifications via `Shell.toast(msg)`
- Clock interval managed per-module
- `Shell.exportState()` — serializes all localStorage into a portable HTML file
- Calls `TruDB.offAll()` on every module switch to clean up Firebase listeners

---

### Module 00 — Dashboard (`DashboardModule`)
- Reads all storage keys fresh via `TruDB.get()` on every mount
- **Auto-refreshes every 30s** — badges stay live without user action
- **Real-time Firebase listener** — re-renders instantly when any device updates data
- Shows: income gap to $2k target, academic urgency badge, trading lock state, Finance account balances
- Academic badge: red = overdue · amber = due within 72h · green = clear
- Status line reflects combined system health across all modules

---

### Module 01 — Income Optimizer (`IncomeModule`) v3.4

**CFG values — do not change without Tru's input:**
```
baseRate:      $17.31/hr   (Corewell Health CNA base)
afternoon:     +$2.50/hr
midnight:      +$2.75/hr
weekend:       +$2.00/hr
tax:           19.2%       (verified against actual paystubs)
otThreshold:   40hrs/week
netPerShift:   $167.84     (12hr shift after tax — used by Finance module)
target:        $2,000 net biweekly
```

**OT logic:** Calculated chronologically within each week — block by block in time order. OT kicks in after 40 total hours. Differentials stay flat at OT, they do NOT multiply at 1.5x. Never calculate OT proportionally.

- 2-week biweekly schedule matching Corewell pay periods
- Saves via `TruDB.set()` — syncs to all devices
- Real-time listener updates schedule if another device makes changes
- localStorage key: `truos_schedule_v34`

---

### Module 02 — Academic Tracker (`AcademicModule`) v2 "Mental Clarity"

**ICS import:**
- Handles Canvas's `DTSTART;VALUE=DATE;VALUE=DATE:` double-tag format
- Same title + class, different due date → updates due date in place, preserves `done` state
- Same title + class + due date → skipped (true duplicate)
- New title → added as new entry
- Completed assignments **never reset** on reimport — done state is sacred

**Dedup rule — all three must match to be a true duplicate:**
```javascript
item.title === current.title &&
item.dueDate === current.dueDate &&
item.cls === current.cls   // different classes can share assignment names
```

**Display logic:**
- Week grouping: `Math.floor((dueDate - minDate) / 7) + 1` anchored to earliest due date in dataset
- Fallback: if week grouping fails for any reason → flat list instead of error
- Per-week progress bar showing completion %
- Urgency tiers: `overdue` red · `within 72h` amber · `upcoming` default
- Completed section: collapsed at bottom, tap to expand, Purge button inside (confirm dialog required)
- Real-time listener — marking done on phone instantly updates desktop

**Storage:**
- localStorage key: `truos-academic`
- Filter key: `truos-ac-filter`
- To clear: `localStorage.removeItem('truos-academic'); location.reload();`

**Current dataset:** MAT 151 + PSY 101 · Mar 4 – Apr 25, 2026
*(Update this line each semester — it's the only thing here that changes regularly)*

---

### Module 03 — Trading Terminal (`TradingModule`)

**Academic gate — do not remove under any circumstances:**
```javascript
// In TradingModule.init() — intentional accountability design
if (AcademicModule.hasOverdue()) {
  TradingModule.showLock("Complete overdue assignments to unlock trading.");
  return;
}
```
Lock check uses `TruDB.get()` so it always reflects latest synced state. Do not bypass even if asked casually.

**When unlocked:**
- Watchlist with live prices via Yahoo Finance quote API
- Default tickers: SPY, QQQ, AAPL, NVDA, TSLA
- Add/remove tickers — persisted and synced via Firebase
- Price refresh: every 15s during market hours (9:30am–4:00pm ET, weekdays)
- Manual refresh always available
- Stale price handling: failed fetch shows last known price with age stamp (e.g. `2m ago`)
- Market open/closed indicator

**Paper portfolio:**
- Starts with $10,000 virtual cash
- Buy/sell at real market prices
- Tracks shares, average cost basis, real-time P/L per position
- Stats bar: Day P/L, Total P/L, portfolio value
- Cash can never go negative — buy blocked if insufficient funds
- Short selling blocked — sell blocked if insufficient shares
- Reset button requires confirm dialog
- Portfolio and watchlist synced via Firebase

---

### Module 04 — Finance Audit (`FinanceModule`)

**Purpose:** Forensic dual-account banking analysis. Tracks real spending patterns, nets cross-account transfers, flags anomalies, and translates dining spend into Corewell shift equivalents for accountability.

**Accounts:**
```
nfcu   Navy Federal Credit Union   teal
wf     Wells Fargo                 purple (#9e61ff)
```

**Schema:** Calendar Slice — period key format `YYYY-MM-CAL`
All transactions normalized to calendar month regardless of bank statement cycle. This was the resolved period-alignment decision — do not reopen.

**Pace indicator formula:**
```
spendPct = currentSpend / totalMonthlyIncome
dayPct   = currentDay / daysInMonth
status   = spendPct vs dayPct  →  over / on / under pace
```

**Shift-to-cost translator:**
```
netPerShift  = $167.84  (always pulled from IncomeModule.CFG — never hardcode)
diningShifts = diningSpend / netPerShift
```

**Forensic flags (auto-detected, permanent — no dismiss button):**
- Circular Zelle patterns — same amount out + in with same contact
- Large one-time inflows — flagged as non-recurring so they don't inflate savings rate
- Single merchant appearing across both accounts in same period
- Cross-account Zelle transfers — netted automatically before spend is reported (internal transfers ≠ spending)

**Audit flag rule:** Flags are permanent. No dismiss button. This is intentional accountability design. Do not add a dismiss button even if asked.

**UI decisions:**
- Quick Add interface — 3 fields visible by default, Advanced toggle for full entry
- Account rename — settings cog modal in module header only, not inline on card
- Phase 1 account strips — compact header lines above category bars
- Netting pill replaced with inline transfer label

**AI PDF Upload:**
- User uploads bank statement PDF → parsed by Claude API
- API key stored in `sessionStorage` only — never `localStorage`, never committed to code
- Mismatch detection: user-picked account vs Claude-detected bank header → orange warning shown
- Parsed result held in `_uploadParsed` until user taps COMMIT — never auto-committed
- Review step is mandatory before any data writes

**Storage keys:**
- `truos-finance-v1` — transaction ledger (Calendar Slice schema, version 1)
- `truos-finance-accounts` — account metadata

---

## localStorage / Firebase Key Registry

| Key | Module | Contents |
|-----|--------|----------|
| `truos_schedule_v34` | Income | 2-week shift schedule array |
| `truos-academic` | Academic | Array of assignment objects |
| `truos-ac-filter` | Academic | Active filter pill (all/c1/c2) |
| `truos-trading-portfolio` | Trading | Cash balance, positions, trade history |
| `truos-trading-watchlist` | Trading | Array of ticker symbols |
| `truos-finance-v1` | Finance | Transaction ledger (Calendar Slice schema) |
| `truos-finance-accounts` | Finance | Account metadata (nfcu, wf) |
| `truos-owner-uid` | Shell | Firebase UID for this device |

**Schema versioning:** Key names are versioned (e.g. `_v34`, `_v1`) to avoid stale data on schema changes. When a schema changes, bump the version in the key name and write a migration script — never silently overwrite.

---

## CSS Design System

```
--bg:     #08090a          near-black background
--amber:  #f5a623          primary accent / CTA / income
--green:  #2ed573          success / positive states
--red:    #ff4757          overdue / danger / trading
--blue:   #1e90ff          info / dashboard
--purple: #9e61ff          Finance module / Wells Fargo account
--muted:  rgba(255,255,255,0.45)
--mono:   Space Mono       data / labels / numbers
--sans:   Syne             headings / body
```

Glass morphism cards: `background: var(--glass)` with `backdrop-filter: blur(12px)`

**Module color assignments:**
- Dashboard — no accent (aggregates all)
- Income — amber
- Academic — no dedicated accent (uses urgency colors: red/amber/default)
- Trading — red
- Finance — purple / teal per account

---

## Hardening Spec

These boundaries are agreed and locked. Do not change without explicit discussion.

| Parameter | Value |
|-----------|-------|
| Max shifts per 2-week period | 10 (5/week) |
| Max single shift length | 12H |
| Max assignments supported | 100 |
| UX mode | Strict — confirm dialog before any destructive action |
| Trading: failed price fetch | Show last known price + age stamp |
| Trading: refresh interval | 15s during market hours |
| Academic: week grouping failure | Flat list fallback |
| Dashboard: auto-refresh | Every 30s |
| ICS reimport: rescheduled assignment | Update in place |
| ICS reimport: completed assignment | Stays done — never reset |
| Finance: audit flags | Permanent — no dismiss |
| Finance: parsed upload | Held in `_uploadParsed` until COMMIT |
| Device: primary | iPhone + Safari |

### Confirm dialogs required for:
- Delete all completed assignments
- Clear full 2-week schedule
- Reset paper trading portfolio
- Commit parsed Finance upload
- Any Finance data purge

---

## Technical Constraints (all production bugs — never reintroduce)

**No optional chaining** — Safari (iOS) silently fails the entire script:
```javascript
// ❌  this._active?.teardown()
// ✅  this._active && this._active.teardown()
```

**No browser dialogs** — Safari suppresses after first dismissal:
```javascript
// ❌  confirm() / alert() / prompt()
// ✅  TruOS.modal.confirm("msg", callback)
```

**XSS safety** — always escape before writing to DOM:
```javascript
// ❌  element.innerHTML = userInput
// ✅  element.innerHTML = esc(userInput)
```

**No direct Firebase calls** — always go through TruDB:
```javascript
// ❌  firebase.database().ref('path').set(data)
// ✅  TruDB.set('path', data)
```

---

## What's Built

- Shell routing with clock management and Export State
- Income Optimizer v3.4 — full Corewell payroll math, chronological OT
- Academic Tracker v2 "Mental Clarity" — Canvas ICS import, week grouping, update-in-place reimport
- Trading Terminal v1 — live prices, paper portfolio, watchlist, 15s refresh, stale price stamps, academic lock
- Finance Audit Module — dual-account forensic view, Calendar Slice schema, pace indicator, shift-to-cost translator, AI PDF upload, cross-account Zelle netting
- Dashboard — live cross-module stats, 30s auto-refresh, real-time Firebase listener
- Firebase Realtime Database sync across all modules
- Anonymous auth with UID-locked security rules
- TruDB sync layer (localStorage + Firebase, offline-safe)
- Sync badge with connection status
- Modular split architecture (generated, deploy pending)

---

## What's Next (in priority order)

1. **Modular split deploy** — push `shell.js` + `modules/` to GitHub, point Vercel at `index.html`. No logic changes needed — just deploy.
2. **Finance module stabilization** — Calendar Slice schema is set, continue building out transaction entry, category tagging, and monthly summary view.
3. **Paystub log** — upload paystub PDF, auto-parse against Income CFG template, update running biweekly average, flag gap to $2k target.
4. **Study planner** — cross-reference shift schedule with assignment due dates. Flag: "you work the night before this is due."
5. **Grade tracker** — add point values to assignments, running GPA calculator per course.
6. **Dashboard v2** — wire Finance account balances and week progress from Academic into Dashboard summary cards.
7. **Trading Terminal v2** — watchlist notes, expanded market data, full trade history log.

---

## Key Decisions (don't re-litigate without reason)

- **Single HTML file** — intentional, enables Export State portability. Modular split is a parallel track, not a replacement until deployed.
- **No frameworks** — intentional, zero dependencies
- **Firebase compat SDK (v9 compat)** — works via CDN script tag, no build step
- **Anonymous auth + UID allowlist** — personal app, no password needed, locked to known devices
- **`truos_schedule_v34` key** — versioned to avoid stale data on schema changes
- **Dedup on title + cls** — fixed bug where MAT 151 + PSY 101 same-named tasks were collapsed
- **Week anchor = min(due date)** — semester-synced, not import-date-dependent
- **Tax rate 19.2%** — verified against Tru's actual paystubs, not estimated
- **OT calculated chronologically** — not proportionally; block-by-block within each week
- **ICS update-in-place** — rescheduled assignments update rather than duplicate
- **Done state sacred** — reimport never resets a completed assignment
- **Calendar Slice schema** — Finance period key `YYYY-MM-CAL` resolves NFCU vs Wells Fargo statement cycle misalignment by normalizing to calendar month
- **Finance audit flags permanent** — no dismiss; accountability by design
- **AI upload review step mandatory** — `_uploadParsed` held until COMMIT; never auto-commit parsed bank data
- **API key in sessionStorage only** — Finance AI upload key never persisted to localStorage or committed to code
- **`--purple: #9e61ff`** — assigned to Finance module / Wells Fargo account (not unused)

---

## How to Update This File

This README is written to minimize how often it needs updating. The only sections that should change regularly:

| Section | When to update |
|---------|---------------|
| **Current dataset** (Academic) | Each semester — update course names and date range |
| **What's Built** | When a feature ships |
| **What's Next** | When priorities shift or items complete |
| **Key Decisions** | When a new architectural decision is made |
| **localStorage Key Registry** | When a new key is added or schema version bumps |
| **Firebase Security Rules** | When a new device is added |

Everything else — architecture, hardening spec, technical constraints, CSS system, OT logic — is stable and should not need touching unless the underlying system changes.

---

*Updated: March 2026*
