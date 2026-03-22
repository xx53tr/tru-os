# CLAUDE.md — TruOS Project Instructions
> Last updated: 2026-03-22 · Single source of truth for every session.

---

## 1. PURPOSE

TruOS is Truquan's personal operating system — a single-file web app that consolidates income optimization, academic tracking, paper trading, and forensic bank auditing into one offline-capable tool. It runs entirely in the browser with no backend. Data lives in `localStorage`. The goal is financial clarity and scheduling discipline on a CNA midnight-shift income.

**[ADDED]** Tru works midnight shifts at Corewell Health (6:30 PM – 7:00 AM) and is enrolled in MAT 151 and PSY 101. Sessions are often short and between shifts — context must load fast.

---

## 2. REPO MAP

```
/
├── index.html          ← Entry point (modular split — pending deploy)
├── shell.js            ← Shell object, loadModule(), boot sequence
├── TruOS-Unified.html  ← Active working file (single-file version)
└── modules/
    ├── dashboard.js    ← Home screen, cross-module summary badges
    ├── income.js       ← Shift scheduler, CFG (base $17.31, differentials, OT logic)
    ├── academic.js     ← Canvas ICS import, urgency tiers, overdue detection
    ├── trading.js      ← Paper portfolio, live Yahoo Finance prices, academic gate
    └── finance.js      ← Dual-account audit, Calendar Slice schema, AI PDF upload
```

**[ADDED]** Live URL: `tru-os.vercel.app` · Deploy: GitHub main → Vercel auto-deploy (~30 seconds) · Repo: private on GitHub (confirm — was briefly public).

---

## 3. KEY CONSTANTS

```
Income base rate:      $17.83/hr  (3% raise effective 2026-04-10)
Afternoon diff:        +$2.50/hr
Midnight diff:         +$2.75/hr
Weekend diff:          +$2.00/hr
Tax rate:              19.2% effective
Net per 12hr shift:    $172.86
Biweekly net target:   $2,000

Accounts:
  nfcu   Navy Federal Credit Union   (teal)
  wf     Wells Fargo                 (purple · #9e61ff)

localStorage schema version:  3
Period key format:             YYYY-MM-CAL
```

**[ADDED]** OT logic: Sequential — calculated block-by-block chronologically. OT kicks in after 40 total hours in the week. Differentials stay flat at OT — they do NOT multiply at 1.5x. Do not calculate OT proportionally.

**[ADDED]** Limits: 100 assignment ceiling · 10 shift max per 2-week period.

---

## 4. HOW WE WORK — NON-NEGOTIABLE RULES

### 4.1 Plan Mode (default for all non-trivial tasks)
Stop. Write the plan. Get confirmation. Then build. If something breaks mid-build, stop and re-plan before continuing.

**[ADDED — detail]** The plan must include: what changes, what files are affected, what the expected output is, and what could break. Tru approves before a single line of code is written.

**[ADDED]** Trivial exceptions (no plan required): typo fixes, color changes, copy edits, one-liner patches with no side effects on other modules.

### 4.2 [ADDED] Stop-and-Replan Protocol
If something breaks mid-session — stop immediately. Do not patch on top of a broken state. Do not guess. Write a new plan, explain what broke and why, get approval before continuing. Shipping working code slowly beats shipping broken code fast.

### 4.3 Code Standards
- Vanilla JS only — no frameworks, no build step
- `'use strict'` in every module file
- No logic changes when refactoring structure
- Confirm dialogs required for all destructive actions (see Section 6.2 for implementation)

### 4.4 [ADDED] Minimal Code Impact
Change the minimum amount of code required to accomplish the task. Do not refactor things that weren't asked. Do not silently improve things. If a bug or smell is noticed while working — flag it in a comment at the end of the session. Don't fix it without asking.

### 4.5 [ADDED] No Feature Creep
Build exactly what was spec'd. If something would be a great addition — say so after the task is done. Never add it silently.

### 4.6 [ADDED] Verify Before Done
After every build: syntax check, logic check, confirm the feature works as described. State explicitly when something is verified vs. assumed. Don't mark something complete because it should work — confirm it does.

---

## 5. DATA RULES

- Never auto-commit parsed data — always show a review step first
- Net same-amount back-and-forth Zelle flows before reporting spend
- Accuracy over speed — verify figures before writing any code that touches stored data

**[ADDED]** Never touch stored data without a plan-mode step. Schema version is `3` — if a migration is required, write the migration script separately, show it, get approval, then run it.

---

## 6. HARD TECHNICAL CONSTRAINTS

These are non-negotiable. Every session, every change. All of these are bugs that have actually been hit in production.

### 6.1 [ADDED] No Optional Chaining
Safari (iOS) rejects optional chaining syntax and silently fails the entire script — no error, just a blank screen.
```javascript
// ❌ NEVER
this._active?.teardown()

// ✅ ALWAYS
this._active && this._active.teardown()
```

### 6.2 No Browser Dialogs → Custom Modal
```javascript
// ❌ NEVER — Safari suppresses after first dismissal
if (confirm("Delete this?")) { ... }

// ✅ ALWAYS — use TruOS custom modal
TruOS.modal.confirm("Delete this?", () => { ... });
```
This covers all destructive actions referenced in Section 4.3.

### 6.3 [ADDED] XSS Safety
All user-facing string output must be escaped before writing to the DOM:
```javascript
// ❌ NEVER
element.innerHTML = userInput;

// ✅ ALWAYS
element.innerHTML = esc(userInput);
```

### 6.4 [ADDED] Firebase / TruDB Rules
All Firebase reads/writes go through the TruDB layer — never call Firebase directly from module logic:
```javascript
// ❌ NEVER
firebase.database().ref('path').set(data);

// ✅ ALWAYS
TruDB.set('path', data);
TruDB.get('path', callback);
```

---

## 7. MODULE SPECS

### Dashboard
Aggregates data from all other modules. Shows: income gap to target, upcoming assignments with urgency badges, account balance summary, trading terminal status. Badge count = overdue (red) + within-72hr (amber) assignments. Read-only — no data entry.

### Income (`income.js`)
Shift scheduler pulling from `IncomeModule.CFG`. OT calculated sequentially (see Section 3). Net per shift used by Finance module shift-to-cost translator — always pull from CFG, never hardcode. **Wired to Firebase via TruDB** — shift data syncs cross-device.

### Academic (`academic.js`)
Canvas ICS import. Deduplication rule — all three must match to be a duplicate:
```javascript
item.title === current.title &&
item.dueDate === current.dueDate &&
item.cls === current.cls  // ← class must match — different classes can share assignment names
```
Urgency tiers: `overdue` = red · `within 72hr` = amber · `upcoming` = default.
Week grouping: `Math.floor((dueDate - minDate) / 7) + 1` anchored to earliest due date.
Completed section: collapsed by default, Purge button requires custom modal confirmation. **Wired to Firebase via TruDB** — assignments sync cross-device.

### Trading (`trading.js`)
Paper portfolio with live Yahoo Finance prices. **Academic gate — do not remove:**
```javascript
// Lock gate in TradingModule.init() — intentional accountability design
if (AcademicModule.hasOverdue()) {
  TradingModule.showLock("Complete overdue assignments to unlock trading.");
  return;
}
```
Do not bypass this even if asked casually.

### Finance (`finance.js`)
Dual-account forensic audit. Calendar Slice schema — period key format `YYYY-MM-CAL`.

**Accounts:** `nfcu` (teal) · `wf` (Wells Fargo, purple `#9e61ff`)

**Pace indicator formula:**
```
spendPct = currentSpend / totalMonthlyIncome
dayPct   = currentDay / daysInMonth
pace     = spendPct vs dayPct
```

**Shift-to-cost translator:**
```
netPerShift = $172.86  (pulled from IncomeModule.CFG — never hardcode)
diningShifts = diningSpend / netPerShift
```

**Forensic flags (auto-detect):**
- Circular Zelle patterns (same amount out + in with same contact)
- Large one-time inflows (flag as non-recurring — don't inflate savings rate)
- Single merchant appearing across both accounts in same period

**[ADDED]** Audit flags are permanent — no dismiss button. Accountability is by design. Do not add a dismiss button even if asked.

---

## 8. AI UPLOAD (Finance Module)

- API key stored in `sessionStorage` only — never `localStorage`
- Mismatch detection: user-picked account vs Claude-detected bank header → orange warning
- Parsed result held in `_uploadParsed` until user taps COMMIT
- Never auto-commit — review step is mandatory (see Section 5)

---

## 9. DEPLOY WORKFLOW

```
1. Edit locally (TruOS-Unified.html or module files)
2. git add .
3. git commit -m "descriptive message"
4. git push origin main
5. Vercel auto-deploys — live in ~30 seconds
```

**[ADDED] Pre-push checklist — verify before every push:**
- [ ] No optional chaining (`?.`) anywhere in the file
- [ ] No `window.confirm()` / `window.alert()` / `window.prompt()`
- [ ] No raw `innerHTML` with unescaped user input
- [ ] TruDB layer intact (sync badge renders, Firebase listeners attached)
- [ ] Trading terminal lock gate present in `TradingModule.init()`
- [ ] Nav grid column count matches tab count
- [ ] No Firebase credentials in console logs or comments

---

## 10. MODULAR SPLIT STATUS

Architecture finalized, files generated (`truos-modular.zip`), deploy blocked pending GitHub access. Resume when ready — no logic changes required, just push and point Vercel at `index.html`. Do not re-architect or re-generate — the split is done.

---

## 11b. BOOTSTRAP DATA

February transaction/shift data is baked into a bootstrap script in `index.html`. Do not re-import or overwrite February data — it is already seeded. Any migration or data touch affecting February requires explicit approval.

---

## 11. [ADDED] COMMUNICATION PREFERENCES

- **Direct and concise.** No filler, no excessive affirmations.
- **Senior dev tone.** Peer, not teacher.
- **Match response length to task complexity.** Short task = short response.
- **Plan mode is not optional.** Even if Tru says "just do it quick" — if the task is non-trivial, write the plan first. Push back if needed.
- **Flag issues, don't hide them.** If a problem is spotted while working — say so at the end. Don't silently ignore it.
- **One question at a time.** If something is ambiguous, ask one clear question. Don't build on assumptions.
- **Voice input note.** Tru sometimes uses voice prompts — messages may be short but intent runs deep. Match depth to what's actually being asked.

---

*This file lives at the root of the TruOS GitHub repo. Update it when architecture changes, new modules are added, or working agreements change.*
