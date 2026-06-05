# Demo Runbook — Sales Progressor

**For:** the Monday client demo
**Demo agency:** Fairview Estates (staging)
**Total runtime, golden path only:** ~12 minutes. With Q&A detours: 20–25.

> Print to PDF from any browser: Ctrl/Cmd + P → Save as PDF.

---

## Before the demo (5 minutes)

### T-15 minutes — reset

Pick one:

- **CLI:** `DEMO_SEED_ALLOWED=true npm run demo:reset` (terminal pointed at the project)
- **UI:** Log in as superadmin → Command Centre → Admin → **Reset Demo** → type `RESET` → click "Tear down + reseed". Fresh logins appear on the page.

The reset takes ~5 minutes. **Don't run it again after this** unless something goes wrong — every reset regenerates portal tokens, which means your prepared portal URLs go stale.

### T-10 — smoke-check (90 seconds)

From terminal: `npm run demo:verify`. Confirm at the bottom that:
- Status counts: 11 active / 2 completed / 1 on_hold / 1 withdrawn
- Work queue buckets: 4 overdue / 1 due today / 2 coming up / 2 escalated
- 15 transactions listed
- Hero file portal URLs printed at the end — **copy Tom Clarke's URL into a separate incognito tab now** (you'll need it in Act 5).

### T-5 — set up the browser

Three tabs/windows side by side:

1. **Main browser:** logged in as `demo-director@fairview.test` / `FairviewDemo1!`. Open `/agent/hub`.
2. **Incognito (1):** Tom Clarke's portal URL from `demo:verify` output. Don't click anything — just have it loaded on `/portal/<token>`.
3. **Incognito (2):** Same Tom Clarke URL but appended with `/respond`. This is where the live "respond as the buyer" moment happens in Act 5.

Verify: hub shows "Pipeline health" stats > 0, "Today's diary" has at least one entry (today is exchange day for one file), and "Needs your attention" lists escalated items in red.

---

## Golden-path click sequence

### Act 1 — The morning view (Hub) — 90 seconds

**Where:** `/agent/hub`

**The story:** "This is what an estate agent sees when they sit down with their coffee. Two big questions every morning: *what needs me today, and how's the pipeline?*"

**Click sequence:**
1. **Top right** — Greeting + "Send a note to our team" button (skip clicking, just point at it: "agents can flag anything to our support team from any page").
2. **Today's diary card** — point at the entries. "These two files have exchange or completion happening today. Click on one to jump straight in."
3. **Needs your attention** — coloured pills. "Red = escalated chases, where we've chased the same milestone repeatedly and now want a human to call. Amber = overdue."
4. **Pipeline health** (4-tile strip) — "Active files, exchanging soon, needs attention, pipeline value. Each is a link — click 'Exchanging soon' and it filters the file list."
5. **Stalled-files row** — "Anything where nothing's been logged in 14+ days. Stops files quietly dying."
6. **Service split donut** (right side) — "How many files you manage vs how many our team is doing for you. The orange slice is files our progression team handles end-to-end — that's the bit that saves agents about 2 hours per file."
7. **Momentum ring** — "Exchanges this month vs last month. Coral when you're behind, green when you're ahead."

**Transition:** "Let's follow that 'needs your attention' pill." Click **Work queue** in the sidebar (or the red pill on the hub).

---

### Act 2 — Work Queue — 90 seconds

**Where:** `/agent/work-queue`

**The story:** "Everything that needs chasing, grouped by urgency. The agent's daily to-do list."

**Click sequence:**
1. **Header pills** — "4 overdue, 1 due today, 2 coming up. These mirror what you saw on the hub."
2. **File alerts strip** (top) — "Files where the whole transaction is stalled, not just a single chase."
3. **Overdue group** — point at the escalated row (red highlight). "This one's been chased twice already and the client hasn't responded. We flag it for a human call."
4. **Chase button** on any row — "One click sends the chase. We pre-draft the email, you approve and send."

**Transition:** "Let's open one of these files." Click into **42 Hawthorn Road** (the hero file).

---

### Act 3 — File detail: the centrepiece — 3–4 minutes

**Where:** `/agent/transactions/<hero>` — 42 Hawthorn Road, Bristol

**The story:** "This is where agents spend most of their day. Everything about a file in one place."

**Click sequence:**

1. **Hero strip** — point at:
   - Address + agency
   - Price (£525,000)
   - Predicted exchange date + "on track" ring
   - Service-type badge (Self-managed)
   - **Chain badge (⛓)** — "This file is part of a 3-link chain. Click for the chain view."

2. **Sidebar (right)** — point at:
   - Price & fees
   - Exchange forecast + completion date
   - **Reassign owner** dropdown — "Director-only. Reassigns the file to a different negotiator."

3. **Tabs:** Overview → Steps → Reminders → To-Do → Activity

4. **Steps tab** (the milestones engine) —
   - "Two columns: Vendor side and Purchaser side. Every milestone in the journey, in order."
   - Scroll down — show complete (green), available (next to click), locked (greyed).
   - **Point at an exchange-gate row** (VM18 or PM25) — "These are the gates. They unlock automatically when everything before them is done."

5. **Activity tab** —
   - Day-grouped messages: email, phone, SMS, voicemail, WhatsApp, internal notes.
   - "This is the audit trail. Every interaction the agent or our team has had with anyone on the file."

6. **Reminders tab** — "Per-file chase reminders. Each one shows what triggers it, when it's due, and whether the client has been chased."

**Transition to the confetti moment:** "Let me show you something. There's a file that's right on the edge of exchange."
- Back to `/agent/transactions`.
- Click into **8 Elmwood Crescent, Bath**.

---

### Act 4 — The confetti moment — 90 seconds

**Where:** `/agent/transactions/<8-elmwood>`

**The story:** "Both sides have done everything they need to. The exchange itself is the one click that's left."

**Click sequence:**

1. **Steps tab** — point at the vendor and purchaser columns. "Look at the gates: both confirmed. Only thing left on each side is 'contracts exchanged'."

2. **Click Confirm on VM19** (vendor side — Contracts Exchanged). A reconciliation drawer opens. Confirm again with today's date.

3. **Confetti animation fires.** Both sides flip to complete simultaneously (VM19 + PM26 are bilateral — confirming one auto-confirms the other).

4. **Hero strip updates** — "Look — the file is now exchanged. The predicted-exchange ring is gone, the chase clock for these milestones has stopped, and the file moves out of the active pipeline."

**If anything looks off:** if the page errors, see "If something goes wrong" at the bottom of this doc.

**Transition:** "Let me show you what happens to the file after exchange." Back to the list, click into **14 Acacia Close** (already exchanged, awaiting completion).

---

### Act 5 — The buyer/seller portal — 2 minutes

**The story:** "Every buyer and seller gets their own portal. No login, no app to install — they get a link in their email. This is what they see."

**Switch to incognito tab #1** — Tom Clarke's portal home (`/portal/<token>`).

**Click sequence:**

1. **Portal hero** — name, sale address, progress ring. "Tom can see how far through his purchase is, with no jargon."
2. **Next action card** — "This is what he needs to do next. We tell him in his words, not estate-agent words."
3. **Coming up + key dates** — "Predicted exchange, predicted completion. He's not chasing the agent for an update — it's right here."
4. **Stage tips** — "Tailored to where he is in the journey. At survey stage we tell him what to expect, at exchange we tell him what'll happen on the day."

**Switch to incognito tab #2** — Tom Clarke's respond page (`/portal/<token>/respond`).

5. **Two milestones to respond to** — "These are things we need from him. Two clicks: confirm, set a date, or leave a note."
6. **Click 'Confirm' on one of them.** "That confirmation flows straight back to the agent — they don't have to chase him for it."

**Switch back to main browser → 42 Hawthorn Road → Activity tab** to show the client confirmation has landed in the agent's view.

---

### Act 6 — Analytics (the director close) — 2 minutes

**Where:** `/agent/analytics` (logged in as director)

**The story:** "All the visibility a director needs to run the agency."

**Click sequence:**

1. **Period filter** (Week / Month / Year / All) — toggle month → year. "See how the agency is performing over time."
2. **Pipeline funnel** — "Active → exchanged → completed. Where you're losing files and how fast they move."
3. **Speed to exchange** — "Median days, week by week. If this number creeps up, something's broken."
4. **Solicitor exchange stats** — "Which firms move the fastest, which slow you down. Hartwell did 3 exchanges, average 78 days. Useful when you're choosing who to recommend."
5. **Referral income** (director-only widget) — "Recommended-solicitor referrals + broker referrals, totalled for the period."
6. **Files at risk** — "Files predicted to miss their target exchange date. Click to drill in."
7. **No-fee files** — "Active files where the agent hasn't entered the commission yet. Plug the leaks."
8. **Export CSV** — "All of this exports for board reports."

---

### Act 7 — Edge cases (only if asked, ~30 seconds each)

| If they ask… | Show them |
|---|---|
| "What if a sale falls through?" | 55 Hazel Crescent (withdrawn pre-exchange) — relist banner with one-click rebuild |
| "What if a sale goes on hold?" | 38 Poplar Road (on_hold) — `OnHoldBanner` at top, hold-period dates in sidebar |
| "How do chains work?" | Hero file (42 Hawthorn Road) → click the ⛓ badge — 3-link chain view with stub agencies |
| "What about completed sales?" | 19 Sycamore Avenue (completed) — full post-completion view |
| "How do you automate emails?" | `/agent/automated-emails` — Pending / Sent (30d) / Errored / Upcoming (14d) tabs |
| "How does the agency configure chase rules?" | `/agent/settings/automation` (director-only) — per-milestone grace days + repeat days |
| "Who are your partners?" | `/agent/partners` — solicitor directory + preferred broker setting |
| "Do you have help docs?" | `/help` — searchable, in-app |

---

## Credentials

| Role | Email | Password |
|---|---|---|
| **Director** | `demo-director@fairview.test` | `FairviewDemo1!` |
| Negotiator | `demo-negotiator@fairview.test` | `FairviewDemo2!` |

Use the **director** account for the demo — they see everything (all files, analytics, settings). Only switch to negotiator if asked "what does a less-senior team member see?"

---

## Tab/window cheat-sheet

```
┌──────────────────────────────────────────────────────────────┐
│  Main browser                                                │
│   - Logged in as demo-director@fairview.test                 │
│   - Starts on /agent/hub                                     │
│                                                              │
│  Incognito 1                                                 │
│   - Tom Clarke portal home (/portal/<token>)                 │
│                                                              │
│  Incognito 2                                                 │
│   - Tom Clarke respond page (/portal/<token>/respond)        │
└──────────────────────────────────────────────────────────────┘
```

The Tom Clarke portal URLs change on every reset. Get the current ones from the bottom of `npm run demo:verify` output, or from [docs/DEMO_FIXTURES.md](docs/DEMO_FIXTURES.md).

---

## If something goes wrong

### "Server Components render" error or any "Transaction not found" on a page

**Cause:** the agency was reseeded since you opened that tab — every transaction id changed, the URL in your tab now points at a deleted record. **Fix:** close the tab, re-open the file via `/agent/transactions`.

### A page is stuck loading or shows skeleton

**Cause:** likely a transient staging cold-start. **Fix:** hard refresh (Ctrl+Shift+R). If still stuck after 10 seconds, fall back to a different file from the list.

### Confetti didn't fire on VM19/PM26 confirm

**Cause:** the milestone was already confirmed (probably from a previous demo). **Fix:** pivot to the exchange-ready file fresh after a reset, or show a pre-exchanged file (14 Acacia Close) and say "imagine the confetti just fired here a minute ago."

### Live confirm in Act 4 errors out

**Plan B:** stay on 8 Elmwood and walk the state visually ("both sides ready, this is the one click left"), then pivot to a pre-exchanged file (14 Acacia Close, 27 Ivy Terrace) and say "and once that confirmation lands, this is what the file looks like next."

### A widget shows zero values where you expected data

**Cause:** if you reseeded VERY recently, some derived data is async (e.g. evaluateTransactionReminders runs after a delay). **Fix:** wait 30 seconds and refresh, or skip to the next surface.

### You need to reset mid-demo (everything is on fire)

Take the conversational hit, pivot to a screen-share of `docs/DEMO_FIXTURES.md` if needed, and either:
- Refresh against the existing data and continue from a different starting point
- Or run the Reset Demo button live (takes ~3 min) — narrate it as "let me show you how easy it is to wipe and rebuild a demo environment"

---

## After the demo

- Reset is **not** required if you're done. The data persists.
- If you're handing the staging environment to someone else for their own demo: run the reset to give them a known-clean state.
- The Reset Demo page (`/command/admin/demo`) shows the safety status and is the safest way to do this — the typed `RESET` confirmation prevents accidental clicks.

---

**Source of truth for fixture details:** [docs/DEMO_FIXTURES.md](docs/DEMO_FIXTURES.md) — every address, what it demonstrates, supporting fixtures (solicitor firms, brokers, etc.).

**Source of truth for the seed/reset scripts:** [scripts/seed-demo.ts](scripts/seed-demo.ts), [scripts/reset-demo.ts](scripts/reset-demo.ts).

**Source of truth for what's reachable in the app:** [docs/DEMO_FEATURE_INVENTORY.md](docs/DEMO_FEATURE_INVENTORY.md).
