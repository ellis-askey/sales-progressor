# Phase 3 · Surface 2 · Agent Hub · Remediation Plan

**Companion to:** [BASELINE.md](BASELINE.md) and [AUDIT.md](AUDIT.md).
**Status:** awaiting founder sign-off. **No code changes until this doc is approved.**
**Drafted:** 2026-06-30.

This is the hard gate per [Law 17](../../../CLAUDE.md#law-17--behavioural-baseline-before-remediation). Once you sign off, code lands. The Surface 2 scope is much narrower than Surface 1 because the embedded widgets (AttentionListView, UnassignedFilesView, NewBuyersToAcknowledgeView, ChainSetupPendingView, ExpiredHoldsCard) defer to their own surfaces (BASELINE §11).

---

## TL;DR

The hub is **already mostly DoD-compliant**. Voice is clean. The interactive states are right. No modals owned by this surface. The remaining work is **one judgment call about chrome** plus **a small Skeleton swap**.

**One decision needed:** how to handle the `agent-glass*` chrome.

---

## The chrome question (read this first)

The hub uses three custom glass utilities on every card:
- `agent-glass` (~7 cards on the page)
- `agent-glass-strong` (ghost attention)
- `agent-glass-light` (activity ribbon — intentionally lighter)

Card primitive's `variant="glass"` maps to `glass-card`. They are **not the same utility**:

| | `glass-card` (Card primitive) | `agent-glass` (hub today) |
|---|---|---|
| Blur | 40px saturate 200% brightness 1.06 | 24px saturate 180% |
| Background | hand-tuned gradient (white 0.56 → 0.44, then 135deg gradient overlay) | `var(--agent-glass-bg)` token |
| Border | transparent + gradient mask | 0.5px solid theme border, brighter top edge |
| Shadow | 5-stack shadow inc. inner highlights | theme-token shadow |
| Border-radius | 12px | `var(--agent-radius-lg)` = 14px |
| Use across app | file-detail cards, modals, drawers, sidebar | hub-only chrome (deliberately distinct treatment) |

So `<Card variant="glass">` here would visibly shift the hub's chrome. Different blur depth, different background, different shadow. Not class-equivalent.

**Three options:**

### Option A — extend the Card primitive (recommended if you want full canonicalisation)

Add `variant="agent-glass" | "agent-glass-strong" | "agent-glass-light"` to the Card primitive, keep the chrome identical, swap all 15 instances on the hub. **Visual byte-equivalent. Primitive surface grows.** Pattern matches MODAL_DRAWER_SYSTEM's "one primitive, multiple variants" model.

Adds ~6 lines to [components/ui/Card.tsx](../../../components/ui/Card.tsx); no new file. 1 small PR for the primitive extension + 1 PR for the hub swap. Loading skeleton also benefits.

### Option B — grandfather the hub chrome (recommended if you want minimum risk)

Hub keeps `agent-glass*` utilities. Surface 2 ships **just the Skeleton primitive swap** in loading.tsx. File 1 grandfather entry in POLISH_TBD: "Hub agent-glass surfaces — pending Card primitive `variant="agent-glass"` extension".

**1 PR.** No visible change to anything on the surface. Surface 2 closes in a single session.

### Option C — accept the canonical-shift (pattern from Wave B)

Swap `agent-glass*` → `<Card variant="glass">`. Accept the visible chrome shift (different blur, different background). The hub's cards now look identical to file-detail's cards. **Pattern: same as the Modal-chrome canonical shifts we did in B1-B9.**

1 PR. The hub's distinctive look becomes the canonical look. Direct consequence: hub looks more uniform with the rest of the app.

---

## My recommendation

**Option B — grandfather the hub chrome for this surface.** Reasoning:

1. The hub is the daily landing page for every director. Visible chrome shifts here are higher-stakes than the modals we shifted in Wave B (modals are infrequent, ephemeral).
2. Option A is the right long-term path but it grows the Card primitive surface. Best done deliberately when a SECOND consumer of `agent-glass` shows up, not on Surface 2 in isolation (Law 14).
3. Surface 2 is supposed to be a 1-week surface. Option B lands in one PR. Option A lands in two. Option C carries the highest immediate-visible-regression risk.

If you disagree, Options A or C work. **Decide here.**

---

## What we ship (assuming Option B — chrome grandfather)

### PR scope: `phase-3(D1): hub loading skeleton Bar → Skeleton primitive`

**Touches:**
- [app/agent/hub/loading.tsx](../../../app/agent/hub/loading.tsx) — extract a `Bar` helper that calls `<Skeleton variant="block">`. All inner `<div className="agent-skeleton">` instances swap to the helper. Mirror the [components/transaction/PanelSkeletons.tsx](../../../components/transaction/PanelSkeletons.tsx) pattern from Wave A4.
- [docs/POLISH_TBD.md](../../POLISH_TBD.md) — 1 grandfather row for the agent-glass chrome.

**Does not touch:**
- The 3 button `<Link>` instances (waiting on ButtonLink primitive; existing POLISH_TBD entry)
- The 4 inline empty states (verdict: grandfather per AUDIT)
- Any embedded widget
- Voice (already clean)

**Verification:**
- `npx tsc --noEmit` clean
- `npx jest __tests__/multi-tenant` 26/26
- `npx playwright test e2e/surface-agent-hub.spec.ts` (when creds set; auto-skips otherwise)
- Visual check: hub loading.tsx triggers via DevTools throttle to verify the pulse animation still matches

### Per-PR workflow

Same template as Surface 1:
1. Pre-flight: read the file
2. Migration: hand-rolled, no bulk regex
3. tsc clean
4. Local visual check
5. Behavioural check (does the skeleton still pulse, are the bar sizes the same)
6. E2E sentinel
7. Multi-tenant safety
8. Commit + push master + merge to staging + push staging
9. Brief PR report

---

## Exit criteria for Surface 2

Surface 2 is **done** when ALL of these are true:
1. **PR D1 shipped** (loading skeleton swap)
2. **POLISH_TBD updated** with the agent-glass chrome grandfather
3. **tsc + multi-tenant green**
4. **Founder walk** — open `/agent/hub` on staging, refresh hard to see the loading skeleton, confirm nothing feels different
5. **BUILD_PLAN marked DONE** for Surface 2

If you pick Option A: add a PR D0 (Card primitive extension) before D1, and D2 swaps the 15 page-level `agent-glass*` instances. Three PRs total.

If you pick Option C: PR D1 also swaps the 15 instances at the same time. Single PR but bigger diff and visible chrome shift.

---

## What I need from you before code lands

A single decision:

**Chrome option: A (extend primitive) / B (grandfather) / C (accept shift)?**

I recommend B. Tell me your call and I ship.
