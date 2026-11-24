# Agent demo — interactive, send-to-an-agent example

**Status:** spec for sign-off (no code yet). Mirrors the shipped client-portal example (`docs/active/portal-preview/SPEC.md`) but aimed at the agent / sales-progression side.

## What this is

A shareable, branded link an external sales-progression business sends to a prospective estate agent. It drops the agent into the **real agent property file**, fully interactive, on a realistic fictional sale. They can move around, confirm milestones, open and fire (fake) chases, and watch it respond. Nothing is real, nothing sends, nothing can bleed into any real data, and each agent gets their own private copy.

## Locked decisions (from founder, 2026-11-24)

1. **Fully interactive ("click and it ticks").** Not read-only. Confirming a milestone ticks it; firing a chase opens and "sends" it. Everything responds.
2. **Per-business, branded link.** Each sales-progression business has its own stable link carrying their logo and colours. Reuses the per-business pattern the portal example already has.
3. **The demo badge STAYS VISIBLE.** Unlike the portal example (which hides any demo marker), the agent demo keeps a clear "Example" marker on screen. It must never be mistaken for, or pose as, a real sale. This is a safety feature, not a blemish.
4. **AI stays live but rate-limited.** "Generate a chase" calls the real model, capped per sandbox (and globally) so a busy demo can't run up cost.
5. **Sandbox lifetime:** resumes if the same agent refreshes within a few hours, expires after idle, swept nightly, with a "start over" control.

## Non-negotiable constraints

### A. Byte-for-byte with the real file (no fork)

The demo renders `app/agent/transactions/[id]` and its **real components**, unchanged. There is **no duplicated, cloned, or parallel demo file view**. A demo visitor is a scoped guest session viewing a demo transaction through the identical UI an agent uses.

**Consequence (the point):** when the property file is canonicalised or changed later, those changes appear in the demo automatically. No one ever updates the demo file UI separately. Any future PR that would fork the file view for the demo is a violation of this spec.

### B. 100% no bleed — a visitor is sealed in a disposable bubble

Five layers, four of which already exist:

1. **File-level quarantine (`isDemo`, exists).** Every demo transaction is `isDemo:true`, which already excludes it from billing, chase crons, analytics, adoption metrics, the business's real book, search, and every real list (100+ call sites).
2. **Send-proof recipients (`@example.com`, exists).** Every demo contact uses an unsendable address that `lib/email.ts` drops before SendGrid on every path. Even a missed guard cannot physically send.
3. **Visible "Example" marker (decision 3).** The file always signals it is a demo.
4. **Per-visitor isolation (new, see below).** Each visitor's writes land only in their own sandbox.
5. **Tight demo access-scope (new, the main hardening).** The guest session is access-scoped to its sandbox's transaction id(s) ONLY. Every read and write already routes through `lib/security/access-scope.ts` (Law 7); we add a `demo` scope shape that matches nothing but the sandbox. A visitor cannot reach another demo, let alone a real file, even by guessing an id.

## Isolation model — per-visitor, not per-business

The portal example uses *one shared example per org, reset nightly*. That would let agent B see agent A's clicks until the reset — unacceptable here. Instead:

- The business has **one stable launcher link** (branded).
- On open, the launcher **provisions a fresh, isolated sandbox** seeded from the golden template (`createDemoSale()` chain, star file 14 Beaumont Rise, rebranded to the business), bound to the visitor's session via a demo cookie, and redirects into the real file page.
- Agent A → sandbox A. Agent B opens the same link → brand-new sandbox B. They never intersect.
- **Always fresh for each new visitor.** Agent B can never see agent A's progress.
- Refresh within the TTL resumes the same sandbox; a new visitor or an expired session gets a clean one; "start over" wipes and reseeds.

## Architecture

```
[per-business launcher link]  /agent-demo/launch/<businessToken>
        │  (public, no login — middleware bypass like /portal)
        ▼
  provision sandbox:
    - createDemoSale(demoKind:"agent_demo", ownerDemoAgency = businessDemoAgency, branding = business)
    - mint ephemeral demo guest User (isDemo), access-scoped to THIS sandbox only
    - set demo session cookie (signed), demoExpiresAt = now + idle TTL
        ▼
  redirect → /agent/transactions/<sandboxTxId>   (THE REAL FILE PAGE)
        - resolveAgentSession() resolves the demo guest principal
        - getAccessScope(session) → { kind: "demo", transactionIds: [...] }
        - DemoTourController auto-starts (exists, fires on isDemo files)
        - visible "Example" marker (DemoFileMarker, reworded)
        - all writes allowed, scoped to sandbox; all outbound suppressed (isDemo guards)
        - AI endpoints rate-limited per sandbox
```

### Pieces we reuse (mostly existing)

- `lib/services/demo-sale.ts` — the golden chain generator. Add `demoKind:"agent_demo"` + per-sandbox ownership + business branding.
- `app/actions/portal-preview.ts` — copy the find-or-create / per-business / regenerate-link / daily-reset shape for the launcher.
- `isDemo` side-effect guards (`app/actions/milestones.ts`, `lib/services/portal.ts:1355`) + `@example.com` backstop (`lib/email.ts`) — the "nothing sends" guarantee, already enforced.
- `components/transaction/demo-tour/DemoTourController.tsx` — guided narration, already fires on demo files.
- Token-gating pattern (`app/portal/[token]` + `middleware.ts` bypass list) — for the public launcher route.
- `lib/security/access-scope.ts` — extend with the `demo` scope.

### Pieces that are new

1. **`demo` access-scope shape** (the main safety work) — hard-limits the guest to its sandbox's ids. Covered by the multi-tenant test suite.
2. **Demo guest session** — ephemeral `isDemo` principal, minted at launch, torn down on sweep. Excluded from every real system.
3. **Launcher route + per-business launcher token** — public, provisions the sandbox, redirects into the real file.
4. **Per-sandbox AI rate-limit** — a lightweight counter (Upstash is currently flagged off, so likely an in-DB/edge counter) + a global ceiling.
5. **Lifecycle** — idle TTL, nightly sweep (extend `cleanupExpiredDemos()`), per-business concurrent-sandbox cap, "start over".
6. **Business branding applied to the sandbox** — the demo agency carries the business's colours/logo.
7. **Command-centre control** — the SP business gets/regenerates its launcher link (mirror the portal-preview action).

## Phased plan

- **Phase 0** — this spec + sign-off. **← we are here.**
- **Phase 1 — Isolation core (safety first, no UI).** `demo` access-scope + ephemeral demo guest session + provisioning of an isolated sandbox. Extend the multi-tenant access-scope test suite to prove a demo session can read/write ONLY its sandbox and nothing else. Nothing shippable yet; this is the foundation everything else stands on.
- **Phase 2 — Launcher + real file render.** Public per-business launcher route; provisions a sandbox; redirects into the real `/agent/transactions/[id]`. Byte-for-byte file renders for a guest. Visible "Example" marker. Read-first (writes still blocked) to validate the seal.
- **Phase 3 — Fully interactive.** Open writes scoped to the sandbox (confirm milestones, fake chases, notes), every one already side-effect-suppressed by `isDemo`; audit every write path to confirm. Rate-limited AI.
- **Phase 4 — Guided tour + branding.** DemoTourController on the demo file; business colours/logo applied.
- **Phase 5 — Lifecycle.** Idle TTL, nightly sweep, per-business cap, "start over".
- **Phase 6 — Command-centre control.** SP-business owner gets/regenerates their branded link.
- **Hardening pass** — abuse/load test: id-guessing, concurrent sandboxes, AI-cost ceiling, sweep correctness, no demo row in any real list/metric/billing.

## Defaults to confirm (not blockers)

- Idle TTL: **3 hours** resume window, swept nightly.
- Per-business concurrent sandbox cap: **~100** (tune after real usage).
- AI: **5 generates per sandbox**, plus a global daily ceiling.
- Launcher surface: v1 drops straight into the **file** (the hero). A demo hub/pipeline can follow if wanted.

## Build status (2026-11-24)

- **P1 (isolation core) — built + unit-verified.** `demo` access-scope, `getAccessScope` detects it first (can't escalate), every helper + 7 call sites bounded; isolation test suite proves a demo session only ever touches its sandbox. All multi-tenant/progression tests still pass.
- **P1b (session + provisioning) — built, type-clean.** `createAgentDemoSandbox` (per-visitor ephemeral agency + agent + chain, `agent_demo`, short TTL) + `touch`/`remove` + nightly sweep of empty ephemeral agencies; demo guest session encode/decode + session-callback propagation.
- **P2 (launcher + confinement) — built, type-clean.** Signed per-business launch token (`lib/security/demo-launch-token.ts`, tested), public launcher + start-over routes (`app/agent-demo/*`), middleware bypass + file-only confinement.
- **NOT yet live-verified:** the end-to-end cookie→session→redirect→render flow and middleware confinement need a smoke test against the running app + DB. The isolation is unit-proven; the session plumbing is not.
- **P3–P6 — built, type-clean (2026-11-24, second pass):**
  - AI cost cap per sandbox (middleware soft limiter, 5/hr; Upstash would make it hard/global).
  - Edge hardening: demo sessions blocked from invite/refer mutations (non-file page server actions already blocked by the confinement).
  - Link control: `getBusinessAgentDemoUrl` action + `AgentDemoLink` button on the business owner's client-portal settings.
  - Badge reworded to "Example" (kept visible) + "Start over" on the demo; per-visitor sandboxes tagged with the businessId for a per-business cap (100, evict-oldest); nightly `demo-cleanup` cron already runs `cleanupExpiredDemos` (extended to sweep empty ephemeral agencies).
- **Still outstanding:**
  - **Colour/logo branding** — only the business NAME brands the sandbox today (it's in the ephemeral agency name). Full colour/logo theming needs a brand field on `ProgressionBusiness` (none exists) + a UI, so it's a genuine follow-up.
  - **Live smoke test** — the cookie→session→render→confine flow still needs exercising against the running app (isolation is unit-proven; the session plumbing is not).
  - **Prod asset upload** — the demo house photo + agent avatar must exist in prod image storage (see docs/active/ELLIS_MANUAL_TODO.md).

## Open / manual

- Confirm whether the demo should also expose a demo **hub/pipeline**, or stay file-only for v1.
- New integration surface? No new third parties. Rate-limit counter: decide in-DB vs enabling Upstash (currently flagged off) — note in `docs/active/ELLIS_MANUAL_TODO.md` if Upstash is chosen.
