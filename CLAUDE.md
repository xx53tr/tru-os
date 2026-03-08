# CLAUDE.md — TruOS Project Instructions
> Senior developer context file. Load this before every session. Last updated: March 2026.

---

## 1. WHO I AM

**Name:** Truquan Raheem (Tru)  
**Location:** Bloomfield Hills, Michigan  
**Work:** CNA at Corewell Health — midnight shifts, 6:30 PM – 7:00 AM  
**School:** College student — currently enrolled in MAT 151 and PSY 101  
**Deployment context:** I build and maintain TruOS between shifts, during breaks, and on off days. Sessions are often short. Context must load fast.

---

## 2. HOW WE WORK — NON-NEGOTIABLE RULES

These apply to every session, every task, no exceptions.

### 2.1 Plan Mode First
- **For any non-trivial task:** Write the full plan BEFORE touching any code.
- "Non-trivial" = anything that touches more than one function, modifies existing logic, adds a new module, or has side effects on other parts of the app.
- The plan must include: what changes, what files are affected, what the expected output is, and what could break.
- I approve the plan before you write a single line of code.
- **Trivial exceptions** (no plan required): typo fixes, color changes, copy edits, one-liner patches with no side effects.

### 2.2 Stop-and-Replan Protocol
- If something breaks mid-session, **stop immediately.**
- Do not patch on top of a broken state. Do not guess.
- Write a new plan. Explain what broke and why. Get my approval before continuing.
- Shipping working code slowly is better than shipping broken code fast.

### 2.3 No Assumptions
- If something is ambiguous — ask. One question, clearly stated.
- Do not infer what I want and build it anyway. Do not fill in gaps with guesses.
- Especially for: schema changes, module interactions, anything touching Firebase, and any UX flow change.

### 2.4 Minimal Code Impact
- Change the minimum amount of code required to accomplish the task.
- Do not refactor things I didn't ask you to refactor.
- Do not improve things I didn't ask you to improve.
- If you notice a bug or smell while working — flag it in a comment at the end of the session. Don't fix it silently.

### 2.5 Verify Before Done
- After every build: syntax check, logic check, confirm the feature works as described.
- If you can run a validation — run it. Don't mark something complete because you think it should work.
- State explicitly when something is verified vs. when it's assumed.

### 2.6 No Feature Creep
- Build exactly what was spec'd. No extras.
- If you think something would be a great addition — say so after the task is done. Never add it silently.

---

## 3. TRUOS — PROJECT OVERVIEW

TruOS is my personal operating system. It is a single self-contained HTML file — no frameworks, no build tools, no dependencies, no backend. Everything is vanilla JavaScript and CSS, stored in localStorage, with Firebase Realtime Database for cross-device sync.

**Live URL:** `tru-os.vercel.app`  
**Deploy pipeline:** Local file → GitHub (main branch) → Vercel auto-deploy → Global CDN  
**Primary file:** `TruOS-Unified.html`  
**Repo:** Private on GitHub  
**Sync layer:** Firebase Realtime Database (project: `realtime-database-ebc45`)

### Core constraints — never violate these:
- ❌ No frameworks (no React, no Vue, no Alpine)
- ❌ No build steps (no webpack, no Vite, no npm)
- ❌ No external scripts loaded at runtime (except Firebase SDK via CDN)
- ❌ No backend — Firebase is the only remote service
- ✅ Single HTML file — everything inline (CSS + JS + HTML)
- ✅ localStorage for primary persistence
- ✅ Firebase TruDB layer for cross-device sync
- ✅ Works offline (degrades gracefully if Firebase is unreachable)

---

## 4. ARCHITECTURE

### 4.1 Module Registry

| Tab # | Module Name | Accent Color | Status |
|-------|-------------|--------------|--------|
| 1 | Dashboard | — (aggregates all) | Stable |
| 2 | Income Optimizer | Amber | Stable |
| 3 | Academic Tracker | Purple | Stable (post-v2 redesign) |
| 4 | Trading Terminal | Red | Stable (locked behind overdue check) |
| 5 | Finance Audit | Blue | In progress — period alignment pending |

### 4.2 Navigation
```css
/* Nav grid — must stay repeat(5, 1fr) for 5 tabs */
.nav-grid { display: grid; grid-template-columns: repeat(5, 1fr); }
```
If a 6th tab is added in the future, update to `repeat(6, 1fr)`.

### 4.3 Design Token System
```css
/* Color system — each module has an assigned accent */
--amber:   income / financial positive states
--purple:  academic / study
--red:     trading / alerts / overdue
--green:   positive outcomes / savings / complete
--blue:    finance audit / banking

/* Background: dark glass aesthetic — deep navy/charcoal base */
/* Text: near-white on dark — never pure black backgrounds */
```

### 4.4 TruDB Sync Layer
- Custom abstraction over Firebase Realtime Database
- All reads/writes go through TruDB — never call Firebase directly from module logic
- Writes simultaneously to localStorage (instant) and Firebase (async)
- Real-time listeners push changes across devices
- Sync badge in top-right corner shows connection status (green = live, gray = offline)
- Anonymous auth — two registered device UIDs in Firebase security rules

**Firebase config:**
```javascript
apiKey: "AIzaSyCNAzcnmXuuPkUQljum0p8GEAPe-YBh2bU"
projectId: "realtime-database-ebc45"
databaseURL: "https://realtime-database-ebc45-default-rtdb.firebaseio.com"
```

---

## 5. MODULE SPECS

### 5.1 Module 01 — Dashboard
- Aggregates data from all other modules
- Shows: income gap to target, upcoming assignments with urgency badges, account balances summary, trading terminal status
- Badge counts: overdue assignments (red) + within-72hr assignments (amber) — pulled from Academic module
- No data entry here — read-only aggregate view

### 5.2 Module 02 — Income Optimizer (Payroll Grade)

**Corewell Health Pay Structure:**
```
Base rate:           $17.31/hr
Afternoon diff:      +$2.50/hr   (shifts overlapping afternoon window)
Midnight diff:       +$2.75/hr   (shifts overlapping midnight window)
Weekend diff:        +$2.00/hr   (Sat/Sun shifts)
Sitter pay:         (tracked separately — ask for current rate)
Overtime:           Sequential — OT kicks in after 40 total hours in the week
                    NOT proportional — calculated block-by-block chronologically
OT multiplier:       1.5x base rate (differentials stay flat — they do NOT multiply)
Net target:         $2,000 biweekly
Tax rate estimate:   ~20% effective (for shift-to-cost translator in Finance module)
```

**Shift types:**
```
8-hour shift  vs  12-hour shift (toggle in UI)
My actual shift: 6:30 PM – 7:00 AM (12.5 hours)
```

**Key logic note:** OT must be calculated chronologically across the biweekly period — add shifts in time order, apply regular rate until 40 hours are hit, then switch to OT rate for remaining hours. Do not calculate OT proportionally.

### 5.3 Module 03 — Academic Tracker

**Current courses:**
- MAT 151 (Math)
- PSY 101 (Psychology)

**Data source:** Canvas LMS — ICS file import (`.ics` format)

**Deduplication rule:** An assignment is a duplicate only if ALL THREE match:
```javascript
item.title === current.title &&
item.dueDate === current.dueDate &&
item.cls === current.cls   // ← class must also match — different classes can share assignment names
```

**Week grouping formula:**
```javascript
weekNumber = Math.floor((dueDate - minDate) / 7) + 1
// minDate = earliest due date in the entire dataset
// Groups labeled: "Week 1", "Week 2", etc.
```

**Urgency tiers:**
```
Overdue:      red     — past due date
Within 72hr:  amber   — due within next 72 hours
Upcoming:     default — everything else
```

**Completed section:** Collapsed by default at bottom. Has a "Purge" button to clear completed items. Purge requires custom modal confirmation — never use `window.confirm()`.

**Dashboard badge:** Shows combined count of (overdue + within-72hr) items.

### 5.4 Module 04 — Trading Terminal

**Gate check:** On `TradingModule.init()`, check if any Academic assignments are overdue. If yes — lock the terminal with a message. Must complete overdue work before accessing trading.

```javascript
// Lock gate — do not remove or comment out
if (AcademicModule.hasOverdue()) {
  TradingModule.showLock("Complete overdue assignments to unlock trading.");
  return;
}
```

This is intentional accountability design. Do not bypass it even if I ask casually.

### 5.5 Module 05 — Finance Audit (🚧 In Progress)

**Purpose:** Forensic multi-account banking analysis. Tracks real spending, nets cross-account transfers, flags anomalies, and translates dining spend into Corewell shift equivalents.

**Account schema:**
```
acct_a:  NFCU (Navy Federal Credit Union) — primary checking
acct_b:  Wells Fargo — secondary checking
```

**⚠️ OPEN ARCHITECTURAL DECISION — resolve before writing any cross-account code:**
Period alignment between NFCU and Wells Fargo statement cycles is not aligned. Three options were presented — decision is pending. Options:

1. **Separate keys** — store each account's data under its own statement period key. No cross-account math. Cleanest isolation.
2. **Calendar month buckets** — normalize all transactions to calendar month (Jan, Feb, etc.) regardless of statement period. Enables cross-account math. Recommended.
3. **Standalone WF view** — display Wells Fargo as its own audit with no cross-account aggregation.

**Ask me which option to use before writing any schema or data model code.**

**Features already built:**
- Phase 1 account strips (compact header lines above category bars)
- Quick Add interface (3-field fast entry with Advanced toggle)
- Cross-account Zelle transfer netting (transfers between my own accounts net to zero)
- Income-based pace indicator formula:
  ```
  spendPct = currentSpend / totalMonthlyIncome
  dayPct   = currentDay / daysInMonth
  pace     = spendPct vs dayPct  (over/under pace)
  ```
- Shift-to-cost translator:
  ```
  netPerShift = baseRate × 12hrs × (1 - taxRate)
  // Uses values from IncomeModule.CFG — do not hardcode
  // taxRate pulled from Income module config, not hardcoded
  diningShifts = diningSpend / netPerShift
  ```
- Audit flags — permanent (no dismiss button — accountability is by design)
- Account rename — settings cog modal in module header only (not inline on card)

**Forensic patterns to flag automatically:**
- Circular Zelle patterns (same amount out and in with same contact)
- Large one-time inflows (flag as non-recurring — don't let them inflate savings rate)
- Single merchant appearing across both accounts in same period
- Dining spend exceeding X shifts worth of net pay (threshold TBD — ask me)

---

## 6. HARD TECHNICAL CONSTRAINTS

These are non-negotiable. Every session, every change.

### 6.1 No Optional Chaining
Safari (iOS) rejects optional chaining syntax and silently fails the entire script.
```javascript
// ❌ NEVER — breaks Safari
this._active?.teardown()

// ✅ ALWAYS
this._active && this._active.teardown()
```

### 6.2 No Browser Dialogs
Safari can suppress `confirm()`, `alert()`, and `prompt()` after first dismissal.
```javascript
// ❌ NEVER
if (confirm("Delete this?")) { ... }

// ✅ ALWAYS — use TruOS custom modal
TruOS.modal.confirm("Delete this?", () => { ... });
```

### 6.3 XSS Safety
All user-facing string output must be escaped:
```javascript
// ❌ NEVER
element.innerHTML = userInput;

// ✅ ALWAYS use the esc() utility
element.innerHTML = esc(userInput);
```

### 6.4 No Direct Firebase Calls from Modules
All Firebase reads/writes must go through the TruDB layer:
```javascript
// ❌ NEVER — bypasses sync layer
firebase.database().ref('path').set(data);

// ✅ ALWAYS
TruDB.set('path', data);
TruDB.get('path', callback);
```

### 6.5 Persist to Both Stores
Every write must hit both localStorage and Firebase:
```javascript
// TruDB handles this internally — but verify when debugging sync issues
// localStorage = instant local state
// Firebase = cross-device sync
```

---

## 7. DEPLOYMENT WORKFLOW

```
1. Edit TruOS-Unified.html locally
2. git add TruOS-Unified.html
3. git commit -m "descriptive message"
4. git push origin main
5. Vercel auto-deploys — live in ~30 seconds at tru-os.vercel.app
```

**Never:**
- Upload directly through Vercel UI (loses version history)
- Push broken code to main (it goes live immediately)
- Commit Firebase credentials in plaintext comments or console logs

**Before every push — verify:**
- [ ] No optional chaining (`?.`)
- [ ] No `window.confirm()` / `window.alert()` / `window.prompt()`
- [ ] No raw `innerHTML` with unescaped user input
- [ ] TruDB layer intact (sync badge renders, Firebase listeners attached)
- [ ] Trading terminal lock gate present in `TradingModule.init()`
- [ ] Nav grid column count matches tab count

---

## 8. SESSION HANDOFF PROTOCOL

When a session is ending and work isn't complete:

1. Summarize: what was accomplished, what's pending, what decisions are open
2. State explicitly: what the next session needs to know to pick up cleanly
3. If there's an open architectural decision — document the options clearly so I can decide between sessions
4. Export or paste the current working file state if there were significant changes

At the START of a new session, I may paste this file or a summary. Read it before doing anything. Then ask: "What are we working on today?"

---

## 9. THINGS I'M BUILDING TOWARD

Context for strategic suggestions — don't build these unless I ask, but know they're coming:

- **Paystub Log module** — upload paystub, auto-parse against template, update running average, flag gap to $2k target
- **Real Estate Monitor** — Michigan foreclosures under $100k, track price drops + days on market
- **Finance Agent** — automated monthly forensic summary from bank statement uploads
- **Academic Deadline Agent** — Canvas ICS watcher with urgency-tier push notifications

**Business ventures (research phase, not TruOS):**
- Dual-track NEMT + medical cleaning business (Michigan market)
- Smoke shop partnership in LA (content/brand play — not ownership)
- Fix-and-flip real estate (Michigan auctions, sub-$100k)

**Career trajectory:**
- Current: CNA → BSN track → Clinical Informatics (target: 4 years)
- AI literacy plan in progress (Phase 3 — portfolio building)
- Corewell Health background = competitive advantage for health system informatics roles

---

## 10. COMMUNICATION PREFERENCES

- **Direct and concise.** No filler. No excessive affirmations.
- **Senior dev tone.** Talk to me like a peer, not a student.
- **Short responses for small tasks.** Match response length to task complexity.
- **Plan mode is not optional.** Even if I say "just do it quick" — if the task is non-trivial, write the plan first. Push back if needed.
- **Flag issues, don't hide them.** If you see a problem while working — say so. Don't silently let it go.
- **Don't repeat yourself.** If you said it once, don't re-explain it in the same response.
- **Voice prompts get longer responses** — I sometimes use voice input. Match depth to what I'm actually asking, not how long the message is.

---

*This file lives at the root of the TruOS GitHub repo. Update it when architecture changes, new modules are added, or working agreements change. It is the single source of truth for every Claude session on this project.*
