# Phase 3 · Surface 3 · Reminders / Work Queue · Remediation Plan

**Companion to:** [BASELINE.md](BASELINE.md) and [AUDIT.md](AUDIT.md).
**Status:** awaiting founder sign-off.
**Drafted:** 2026-06-30.

---

## TL;DR

Single PR ("E1"). Three clean swap categories + four grandfathers in POLISH_TBD. Mirrors the Surface 2 (Hub) D1 model with one extra swap category (buttons + voice).

**One decision needed:** chrome — same `agent-glass*` question as Surface 2. My recommendation = grandfather (consistency with Surface 2).

---

## What we ship — PR E1: `phase-3(E1): reminders surface clean swaps`

### Files touched
- `app/agent/work-queue/page.tsx` — Skeleton primitive swap on the ghost preview rows
- `components/reminders/AgentRemindersList.tsx` — 4 `agent-btn` → `<Button>` swaps + 3 voice-sweep strings
- `docs/POLISH_TBD.md` — extend Surface 2 chrome entry to cover Surface 3 files; new entries for 2 accordion patterns + 1 popover gap

### Files NOT touched
- `components/reminders/ReminderCard.tsx` (only agent-glass-strong + popovers — both grandfather decisions)
- `components/reminders/FileAlertsStrip.tsx` (only agent-glass-strong + accordion — both grandfather)

### Specific changes

**Voice sweep** (3 strings in `AgentRemindersList.tsx`):

```ts
// L55
- "Client chased automatically, then opted out. Now manual — please follow up."
+ "We chased the client, then they opted out. Follow up manually."

// L61
- "Can't chase automatically — the client contact has no email address. Manual chase needed."
+ "We can't chase this client: no email on file. Follow up manually."

// L63
- "Can't chase automatically — the client contact has no portal access. Manual chase needed."
+ "We can't chase this client: no portal access. Follow up manually."
```

**Button swaps** (4 in `AgentRemindersList.tsx`):

```tsx
// L171: snooze trigger (row)
<button className="agent-btn agent-btn-sm agent-btn-ghost" ...>
// →
<Button variant="ghost" size="sm" ...>

// L257: snooze trigger (bulk)
<button className="agent-btn agent-btn-sm agent-btn-secondary" ...>
// →
<Button variant="secondary" size="sm" ...>

// L483: "Mark as chased" — STAYS RAW (ghost-bordered variant grandfathered)

// L493: secondary action
<button className="agent-btn agent-btn-sm agent-btn-secondary" ...>
// →
<Button variant="secondary" size="sm" ...>

// L536: "Chase" button — opens ChaseDrawer
<button className="agent-btn agent-btn-sm agent-btn-primary" ...>
// →
<Button size="sm" ...>
```

**Skeleton swap** (work-queue page empty ghost preview): introduce a small `Bar` helper at the top of `app/agent/work-queue/page.tsx` that wraps `<Skeleton variant="block">`, mirroring the pattern from Surface 2 D1's hub `loading.tsx`. Swap the ~6 `agent-skeleton` divs.

### Grandfathers added to POLISH_TBD

1. **`agent-glass-strong` chrome on 7 cards across this surface** — extend the Surface 2 entry to include Surface 3 files (`app/agent/work-queue/page.tsx`, `AgentRemindersList`, `ReminderCard`, `FileAlertsStrip`). Same `variant="agent-glass"` extension pending.
2. **`AgentRemindersList` group section accordion** — two-zone header (label + count badge), same Accordion.Header layout collision as Wave A3/A4 group accordions.
3. **`FileAlertsStrip` strip body accordion** — same pattern.
4. **Snooze + escalate popovers (4 createPortal calls)** — no canonical `<Popover>` primitive exists. Currently only the reminders surface uses this pattern (< 3 consumers per Law 14 trigger). Defer primitive creation until a second consumer surfaces.

---

## Verification gates

- `npx tsc --noEmit` clean
- `npx jest __tests__/multi-tenant` 26/26
- `npx playwright test e2e/surface-agent-reminders.spec.ts` (auto-skips on missing creds)
- Local visual check: open `/agent/work-queue` on dev server; verify chip tooltips show new voice + buttons render at same visual weight

---

## Exit criteria for Surface 3

1. **PR E1 shipped** (single PR, the 3 swap categories above)
2. **POLISH_TBD updated** with 4 grandfather entries
3. **tsc + multi-tenant green**
4. **Founder walk** — load `/agent/work-queue`, confirm nothing feels different
5. **BUILD_PLAN marked DONE** for Surface 3

---

## What I need from you before code lands

**Chrome decision: A / B / C (same as Surface 2)?**

- **A** — extend Card primitive with `variant="agent-glass"` to support both Surface 2 and Surface 3 chrome (now with a second consumer per Law 14, this is more defensible than at Surface 2).
- **B** — grandfather chrome on Surface 3 too (extend Surface 2's POLISH entry). **Recommended for consistency.**
- **C** — accept the canonical-shift (swap to `<Card variant="glass">` on all 7 cards).

**My recommendation: B.** Same reasoning as Surface 2: chrome shifts on high-traffic daily-use pages are higher-stakes than on modals. The Card-primitive extension is now slightly more defensible (Surface 3 = second consumer of agent-glass), but it's still a primitive-surface change worth doing deliberately, not as a side-effect of Surface 3.

If you sign off on Option B, PR E1 ships in the next session.
