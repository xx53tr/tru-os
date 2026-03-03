# TruOS — Project README
*Handoff document for new conversation*

---

## What is TruOS?

A personal operating system built as a single self-contained HTML file. Designed for Tru — a CNA at Corewell Health working midnight shifts, taking college courses (MAT 151, PSY 101), and building toward real estate and trading goals.

The entire app lives in one file: `index.html`. No frameworks, no build step, no server. Open it in a browser and it runs.

---

## Live Deployment

**`tru-os.vercel.app`** — live production URL

### How the stack works
- **GitHub** — stores the code. Every commit to `main` auto-triggers a deploy.
- **Vercel** — serves the app live on the internet. Watches GitHub and deploys automatically.
- **Firebase Realtime Database** — stores all user data (assignments, schedule, portfolio, watchlist). Syncs across devices in real time.

```
Code change → GitHub (main) → Vercel auto-deploy → tru-os.vercel.app
User data → Firebase Realtime Database → synced to all devices instantly
```

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

> **Warning:** Clearing Safari browser data or switching browsers on a device creates a new UID. If locked out, repeat the steps above.

### TruDB Sync Layer
All modules read/write through `TruDB` instead of raw localStorage:
- `TruDB.get(key)` — reads from localStorage cache (instant, works offline)
- `TruDB.set(key, value)` — writes to localStorage AND Firebase simultaneously
- `TruDB.on(key, cb)` — real-time listener, fires when another device updates data
- `TruDB.off(key)` / `TruDB.offAll()` — cleans up listeners on module switch

Sync badge (top-right corner):
- `● SYNCED` green — Firebase connected
- `↑ SYNCING` amber — write in progress
- `○ OFFLINE` gray — no Firebase connection (still works on localStorage)

---

## Architecture

### Shell
- Central router — `Shell.switchTo(name)` mounts modules
- Toast notifications via `Shell.toast(msg)`
- Clock interval managed per-module
- `Shell.exportState()` — serializes all localStorage into a portable HTML file
- Calls `TruDB.offAll()` on every module switch to clean up Firebase listeners

### Module 00 — Dashboard (`DashboardModule`)
- Reads all storage keys fresh via `TruDB.get()` on every mount
- **Auto-refreshes every 30s** while sitting on the tab — badges stay live
- **Real-time Firebase listener** — re-renders instantly when any device updates tasks or schedule
- Shows income progress, academic status, trading lock state
- Academic badge: red = overdue, amber = due within 72h, green = clear
- Status line reflects combined system health

### Module 01 — Income Optimizer (`IncomeModule`) v3.4
**CFG values (do not change without Tru's input):**
```
baseRate:    $17.31/hr  (Corewell Health CNA rate)
diffs:       afternoon +$2.50 | midnight +$2.75 | weekend +$2.00
tax:         19.2% effective rate
otThreshold: 40hrs/week
target:      $2,000 net biweekly
```
- 2-week biweekly schedule (matches Corewell pay periods)
- Overtime calculated chronologically within each week
- Saves via `TruDB.set()` — syncs to all devices
- Real-time listener updates schedule if another device makes changes
- localStorage key: `truos_schedule_v34`

### Module 02 — Academic Tracker (`AcademicModule`) v2 "Mental Clarity"
- Canvas ICS import — handles Canvas's `DTSTART;VALUE=DATE;VALUE=DATE:` double-tag format
- **ICS reimport logic:**
  - Same title + class, different due date → **updates due date in place**, preserves `done` state
  - Same title + class + due date → skipped (true duplicate)
  - New title → added as new entry
  - Completed assignments **never reset** on reimport
- Dedup logic: title + cls must match to be considered same assignment
- Week grouping: Week 1, Week 2... anchored to earliest due date in dataset
- **Fallback:** if week grouping fails for any reason, renders flat list instead of error
- Per-week progress bar showing overall completion %
- Urgency tiers: overdue (red) | within 72h (amber) | upcoming (default)
- Completed section: collapsed at bottom, tap to expand, Purge button inside
- Real-time listener — marking done on phone instantly updates desktop
- localStorage key: `truos-academic` | filter key: `truos-ac-filter`

**Current dataset:** MAT 151 + PSY 101, Mar 4 – Apr 25, 2026

### Module 03 — Trading Terminal (`TradingModule`)
- **Locked** when any assignment is overdue — reads `truos-academic` fresh on mount
- Lock check uses `TruDB.get()` so it always reflects latest synced state

**When unlocked:**
- Watchlist with live prices via Yahoo Finance quote API
- Default tickers: SPY, QQQ, AAPL, NVDA, TSLA
- Add/remove tickers — persisted and synced via Firebase
- **Price refresh: every 15s during market hours** (9:30am–4:00pm ET, weekdays)
- Manual refresh button always available
- **Stale price handling:** if fetch fails, shows last known price with age stamp (e.g. `2m ago`) instead of blocking
- Market open/closed indicator

**Paper portfolio:**
- Starts with $10,000 virtual cash
- Buy/sell at real market prices
- Tracks shares, average cost basis, real-time P/L per position
- Stats bar: Day P/L, Total P/L, portfolio value
- Cash balance can never go negative (buy blocked if insufficient funds)
- Short selling blocked (sell blocked if insufficient shares)
- Reset button (confirm dialog required)
- Portfolio and watchlist synced via Firebase

---

## localStorage / Firebase Keys
| Key | Module | Contents |
|-----|--------|----------|
| `truos_schedule_v34` | Income | 2-week shift schedule array |
| `truos-academic` | Academic | Array of assignment objects |
| `truos-ac-filter` | Academic | Active filter pill (all/c1/c2) |
| `truos-trading-portfolio` | Trading | Cash balance, positions, trade history |
| `truos-trading-watchlist` | Trading | Array of ticker symbols |
| `truos-owner-uid` | Shell | Firebase UID for this device |

**To clear academic data:**
```javascript
localStorage.removeItem('truos-academic'); location.reload();
```

---

## CSS Design System
```
--bg:     #08090a       (near-black background)
--amber:  #f5a623       (primary accent / CTA)
--green:  #2ed573       (success / income)
--red:    #ff4757       (overdue / danger)
--blue:   #1e90ff       (info)
--purple: #9e61ff       (available, unused)
--muted:  rgba(255,255,255,0.45)
--mono:   Space Mono    (data / labels)
--sans:   Syne          (headings / body)
```
Glass morphism cards: `background: var(--glass)` with `backdrop-filter: blur(12px)`

---

## Hardening Spec (agreed boundaries)

| Parameter | Value |
|-----------|-------|
| Max shifts per 2-week period | 10 (5/week) |
| Max single shift length | 12H |
| Max assignments supported | 100 (this semester) |
| UX mode | Strict — confirm dialog before any destructive action |
| Trading: failed price fetch | Show last known price + age stamp |
| Trading: refresh interval | 15s during market hours |
| Academic: week grouping failure | Flat list fallback |
| Dashboard: auto-refresh | Every 30s |
| ICS reimport: rescheduled assignment | Update in place |
| ICS reimport: completed assignment | Stays done |
| Device: primary | iPhone + Safari |

### Confirm dialogs required for:
- Delete all completed assignments
- Clear full 2-week schedule
- Reset paper trading portfolio

---

## What's Built vs What's Next

### ✅ Done
- Shell routing with clock management
- Income Optimizer v3.4 with full Corewell payroll math
- Academic Tracker v2 with Canvas ICS import, week grouping, update-in-place reimport
- Trading Terminal v1 — live prices, paper portfolio, watchlist, 15s refresh, stale price stamps
- Dashboard with live cross-module stats, 30s auto-refresh
- Trading lock system (overdue = locked)
- Firebase Realtime Database sync across all modules
- Anonymous auth with UID-locked security rules
- TruDB sync layer (localStorage + Firebase, offline-safe)
- Sync badge with connection status
- Export State button (portable HTML with embedded data)

### 🔲 Next Up (in priority order)
1. **Study planner** — cross-reference shifts with assignment due dates, flag "you work the night before this is due"
2. **Grade tracker** — add point values to assignments, running GPA calculator
3. **Dashboard v2** — wire week progress from Academic into Dashboard card
4. **Trading Terminal v2** — expanded market data, watchlist notes, trade history log

---

## Key Decisions Made (don't re-litigate without reason)
- Single HTML file — intentional, enables Export State portability
- No frameworks — intentional, zero dependencies
- Firebase compat SDK (v9 compat) — works via CDN script tag, no build step required
- Anonymous auth + UID allowlist — personal app, no password needed, locked to known devices
- `truos_schedule_v34` key — versioned to avoid stale data on schema changes
- Dedup on title + cls — fixed bug where MAT 151 + PSY 101 same-named tasks were collapsed
- Week anchor = `min(due date)` in dataset — semester-synced, not import-date-dependent
- Tax rate 19.2% — verified against Tru's actual paystubs
- OT threshold 40hrs/week — Corewell standard, calculated chronologically
- ICS update-in-place — rescheduled assignments update rather than duplicate
- Done state sacred — reimport never resets a completed assignment

---

*Updated: March 3, 2026*
