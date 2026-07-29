# Playwright — coverage + frozen migration spec

**Owner:** Ellis (approves + runs the baseline)
**Written:** 2026-07-28
**Status:** Draft spec ready. Awaiting green baseline run.

## Rules of engagement (per Ellis, 2026-07-28)

a. **Assertions target only user-visible, structure-independent things**: visible text, ARIA roles, accessible names, `data-testid`. Never CSS classes, DOM nesting, or element position. The component split during Phase 2 will legitimately change all of those, and a spec that breaks on structure gets edited into uselessness.

b. **Legacy hub testids allowed only under the exception rule**: every testid added is listed below **before it lands in the code**. The set must be minimal.

c. **Cover the role-variant matrix** across all 5 roles + the 3 quirks (hybrid SP-admin, viewer, superadmin), plus every empty / loading / error branch from [01-audit.md](01-audit.md).

d. **Run against the current legacy hub until green.** Record the passing run below.

e. **After green, the spec is FROZEN.** Any later edit requires an explicit reason logged here. "It failed after the migration" is a finding, not a licence to edit the spec.

---

## What already exists

[`e2e/surface-agent-hub.spec.ts`](../../../e2e/surface-agent-hub.spec.ts) — 3 tests, mount sentinel only:
1. `login → /agent/hub renders without error boundary`
2. `either full-hub stat cells OR empty-state CTA is visible`
3. `New sale Link points to the new-v2 wizard`

**Verdict:** thin. Passes as long as the page mounts. Kept as-is — this spec is scoped to migration verification, not general hub regression.

## What we're adding

[`e2e/surface-agent-hub-migration.spec.ts`](../../../e2e/surface-agent-hub-migration.spec.ts) — the frozen migration sentinel. Must pass against `/agent/hub` (baseline) AND `/agent/hub-preview` (after Phase 2).

---

## Testid inventory (locked before any code lands)

Only 5 testids added to legacy hub, plus 4 ARIA label additions. Pipeline stage circles already carry `role="button" aria-label="{Stage}: {count}"` — reused as-is.

### data-testid additions

| Testid | Element | Reason (why text/ARIA alone won't work) |
|---|---|---|
| `hub-empty-state` | Root `<div>` of the isEmpty branch (legacy-hub.tsx line 194) | The `<h1>` greeting is identical between empty and full branches — need a wrapper anchor to differentiate |
| `hub-full-state` | Root `<div>` of the full-hub branch (legacy-hub.tsx line 332) | Same reason as above |
| `hub-expired-holds-extender` | Inline extender wrapper (`ExpiredHoldsCard.tsx` line 193, `showExtenderFor === item.transactionId`) | The extender's date input + Set/Indefinitely/Cancel buttons have no unique visible text or accessible name to anchor to |
| `hub-service-split` | Root `<div>` of the service-split card (legacy-hub.tsx line 757) | Card is hidden for pure progressor. Negated existence assertion via testid is cleaner + more robust than copy-based query |
| `hub-pro-tip` | Root `<div>` of the pro-tip banner (legacy-hub.tsx line 1012) | Cascade fires 5 different variants; testid gives us a stable anchor to then read the copy for tier verification |

### aria-label additions

| ARIA label | Element | Reason |
|---|---|---|
| `aria-label="Active files"` | Stat tile 1 in Pipeline health card (legacy-hub.tsx line ~455) | Formalises the accessible name so we can `getByLabel("Active files")` and read the delta subtext inside |
| `aria-label="Exchanging soon"` | Stat tile 2 (line ~465) | Same |
| `aria-label="Need attention"` | Stat tile 3 (line ~475) | Same — also needed to test colour flip (escalated vs primary) — we assert on a wrapper attribute we'd add anyway |
| `aria-label="Pipeline value"` | Stat tile 4 (line ~490) | Same |

**No other legacy hub changes. No CSS. No behaviour. No structure.** Every addition here is a leaf attribute.

---

## Role account requirements

The spec parameterises across 5 roles + 3 quirks. Each requires a staging login.

Env vars the spec reads (all optional — tests skip when missing):

| Env var | Account | Role | Notes |
|---|---|---|---|
| `TEST_DIRECTOR_PASSWORD` | `emily@hartwellpartners.co.uk` | director | Exists in current staging |
| `TEST_ADMIN_PASSWORD` | `ellisaskey@googlemail.com` | admin | Exists |
| `TEST_SP_HYBRID_PASSWORD` | `ellis@thesalesprogressor.co.uk` | sales_progressor + hybrid-admin allowlist | Exists; hybrid quirk. Verify Ellis is on `isHybridAdminEmail` |
| `TEST_NEGOTIATOR_PASSWORD` | e.g. `negotiator@hartwellpartners.co.uk` | negotiator | **NOT YET SEEDED — fixture gap** |
| `TEST_SP_PURE_PASSWORD` | e.g. `progressor@thesalesprogressor.co.uk` (non-hybrid) | sales_progressor (not hybrid) | **NOT YET SEEDED — fixture gap** |
| `TEST_VIEWER_PASSWORD` | e.g. `viewer@thesalesprogressor.co.uk` | viewer | **NOT YET SEEDED — fixture gap** |
| `TEST_SUPERADMIN_PASSWORD` | e.g. `superadmin@thesalesprogressor.co.uk` | superadmin | **NOT YET SEEDED — fixture gap** |

Tests without an env var skip with a clear reason. Missing role accounts are called out in [03-fixtures.md](03-fixtures.md) — the `scripts/seed-hub-fixtures.ts` script should create them.

Test data assumption: staging must have `seed-demo.ts` populated for the director + admin cases to hit meaningful pipeline data. Empty-state tests require a fresh account with 0 files (see fixture note below).

---

## What the spec covers (the map back to the audit)

Each test case cites the audit conditional IDs it exercises. If a conditional isn't cited anywhere in the spec, it becomes a blind spot in [07-coverage-map.md](07-coverage-map.md).

### Empty state (director, 0 files)
- test: `director sees empty-state welcome + ghost cards + gated CTAs`
  - Covers: C1, C2, C3, C4, C6, no payment banners
  - Asserts: `hub-empty-state` visible, `hub-full-state` NOT visible; "Add your first sale…" text present; "New sale" `Link` with correct href; "Send a note" button visible

### Empty state (sales_progressor)
- test: `sales_progressor sees empty-state assigned copy, no create CTA`
  - Covers: C1, C4, C5, C6 (negated)

### Populated hub (director)
- test: `director sees full hub — greeting, pipeline health, coming-up, forecast, service split`
  - Covers: C36, C37, C39, C41, C42, C45, C46/C47, C48 (grid = 1fr 1fr for director), C49, C50/C51/C52, C55 (visible), C56 (title = "Who's managing"), C57
  - Anchors: `hub-full-state`, aria-labels on 4 stat tiles, `hub-service-split` visible, text "Who's managing"
- test: `director does not see admin-only sections`
  - Covers: C26 (UnassignedFiles hidden), C30 (NewBuyers hidden)
- test: `director attention list — populated + first 3 items + "All reminders" link`
  - Covers: C22, C23, C25
- test: `director stat tile deltas render correctly`
  - Covers: C38, C40, C43, C44
- test: `director pro tip fires correct healthy tier`
  - Covers: C67 (agent branch), C69 (Link wrapper when href)

### Populated hub (admin)
- test: `admin sees platform-wide subtitle + Service split "Service split" title`
  - Covers: C36 (admin variant), C49 (admin), C56 (admin), C58 (admin copy), C60 (admin plural)
- test: `admin sees UnassignedFiles when fixture present`
  - Covers: C26 (visible for admin_all)
- test: `admin sees NewBuyers when fixture present`
  - Covers: C30 (visible for admin_all)
- test: `admin pro tip healthy tier links to analytics`
  - Covers: C67 (admin branch)

### Populated hub (hybrid SP-admin — Ellis)
- test: `hybrid SP-admin sees Service split with admin labels + no "New sale" button`
  - Covers: role-quirk row from audit — admin copy but no canCreateSale
  - Asserts: `hub-service-split` visible, text "Service split" (admin title), no "New sale" link

### Populated hub (pure sales_progressor)
- test: `pure SP has no Service split card`
  - Covers: C48 (grid drops to 1fr), C55 (card hidden)
  - Asserts: `hub-service-split` NOT visible

### Populated hub (viewer)
- test: `viewer sees hub with no create-sale, no send-note, no admin copy`
  - Covers: role-quirk row from audit
  - Asserts: no "New sale", no "Send a note", subtitle uses generic (not progressor, not admin) variants

### Populated hub (superadmin)
- test: `superadmin renders without error and lands on hub`
  - Covers: role-quirk minimum coverage — superadmin quirk is documented as latent; not enforcing beyond mount

### Niche controls (director)
- test: `expired holds — take-off-hold modal opens with two options`
  - Covers: C19 (card visible), C20 (extender toggle if extended)
- test: `expired holds — extender opens with date input + Set/Indefinitely/Cancel`
  - Covers: C20 (`hub-expired-holds-extender` testid), C21 not asserted (validation) — but existence yes
- test: `chain setup pending — "Mark as done" fires`
  - Covers: C31 (card exists when data), acknowledges control renders

### Banners
- test: `PaymentBlockBanner absent when no payment issue`
  - Covers: C7 (mount) + C8/C9 (variants — only if fixture provides)
- test: `PaymentMethodNudge absent for pre-trial-elapsed accounts`
  - Covers: C10, C14

### Multi-tenant safety (Law 7)
- test: `director @ Hartwell only sees Hartwell files in attention list`
  - Loose assertion — asserts no attention-item addresses match a known non-Hartwell address from fixtures

---

## Baseline run — record the green

**Instructions to run:**
```
# Ensure staging dev server up + fixtures seeded
export TEST_DIRECTOR_PASSWORD=<from-password-manager>
export TEST_ADMIN_PASSWORD=<from-password-manager>
export TEST_SP_HYBRID_PASSWORD=<from-password-manager>
# ... other role env vars once accounts exist
npx playwright test e2e/surface-agent-hub-migration.spec.ts --reporter=list
```

Tests without an env var will skip with an explanatory `test.skip()` reason. Only fail = a real regression.

### Green baseline record

| Field | Value |
|---|---|
| Date of green run | _TBD — Ellis to record_ |
| Commit SHA (git rev-parse HEAD) | _TBD_ |
| Test file SHA (sha256sum of the spec) | _TBD_ |
| Ran by | _TBD_ |
| Total passed | _TBD_ |
| Total skipped | _TBD_ (list which — expected: negotiator, viewer, superadmin, pure-SP if accounts not seeded) |
| Total failed | 0 (must be) |

After that ↑ is recorded with green, the spec is FROZEN. Any edit requires a reason line here.

### Local dry run — 2026-07-28 (NOT the green baseline)

First run against local dev + `.env.test.local` produced 21 failed / 7 skipped / 3 passed. All 21 failures were `page.waitForURL` timeouts at login — my initial spec chained `TEST_DIRECTOR_PASSWORD ?? TEST_PASSWORD ?? ""` so the shared `TEST_PASSWORD` from `.env.test.local` fired against director/admin/hybrid-SP emails and Playwright interpreted the wrong-password redirect failure as a test failure rather than a skip.

**Fix (applied before spec freezes):** removed the `TEST_PASSWORD` fallback. Each role now requires its OWN env var (`TEST_DIRECTOR_PASSWORD`, `TEST_ADMIN_PASSWORD`, `TEST_SP_HYBRID_PASSWORD`, etc.). Missing → skip. Present but wrong → still counts as a failure — but at least the failure means "wrong password for this role's specific env var" not "leaked from a shared password".

This dry run does **not** count as the green baseline. Green baseline is Ellis's staging run with correctly-set per-role env vars.

### Frozen changelog

_Empty. Every future entry: date, commit SHA, one-line reason. Anything else is a policy violation._

---

## Fixture dependencies for a full green run

Blocking fixture gaps for a fully-covered baseline (subset OK for initial green — skipped tests don't fail):

- **Fresh empty-state director** — the current staging seed populates emily's agency; we need either (a) a second director with zero files, or (b) a way to drop emily's files temporarily. Owned by `scripts/seed-hub-fixtures.ts`.
- **Pure (non-hybrid) sales_progressor** — Ellis's SP account is likely on hybrid allowlist. Need a plain SP account.
- **Negotiator account in Hartwell** — enables negotiator tests.
- **Viewer account** — enables viewer test.
- **Superadmin account** — enables superadmin test. (Prod has one; staging may not.)
- **Payment-block / payment-nudge states** — for banner variant tests. Both need synthetic billing states.

For initial green: OK to run with only director + admin + hybrid-SP; skipped tests noted.
For pre-Phase-2 sign-off: all fixtures ideally present, but skipped tests are acceptable if flagged in the coverage map.

## Wire into CI (deferred until after green)

After the green baseline lands, wire into `.github/workflows/*.yml`:
- Run on every PR that touches `app/agent/hub/*`, `components/hub/*`, `components/hub-preview/*`, `lib/services/hub.ts`, or `lib/services/agent.ts`
- Requires the env vars to be set as GitHub Actions secrets
