# Founder Command Centre — Doc Set

This is the spec for the founder-only command centre, surfaced at `/command`. Eleven docs, designed to be implemented in phases by Claude Code.

**Note:** The existing `/admin` route is the internal progressor admin (different surface, different scope). The command centre is a separate, parallel surface that does not touch any existing admin code.

## Status — post-discovery (2026-05-01)

ADMIN_00 discovery completed. Key findings that affected the docs:
- SP/PM distinction lives at transaction level (`PropertyTransaction.serviceType`), not agency level. ADMIN_02 §2 rewritten around transaction-level truth + derived agency `modeProfile` because mixed agencies are real.
- `superadmin` role does not currently exist. ADMIN_02 §9 migration #1 adds it.
- `app/admin/` is taken by the existing internal admin. New code lives at `app/command/` and `lib/command/`. Routes at `/command/*`.
- `CommunicationRecord.transactionId` is currently NOT NULL. ADMIN_02 §4 migration drops the constraint and adds a CHECK + `purpose` enum.
- Recharts already installed; no charting package decisions.
- PostHog, Sentry, Vercel Analytics all absent — Health and Friction tabs gated on adding the relevant infra.

## Read order

1. **`ADMIN_00_DISCOVERY_PROMPT.md`** — already run; report is in `docs/admin/ADMIN_00_DISCOVERY_REPORT.md`. Reference only now.
2. **`ADMIN_01_SPEC.md`** — product spec. The four-questions principle, the SP/PM lens, all 14 tabs.
3. **`ADMIN_02_DATA_MODEL.md`** — schema deltas (post-discovery, final).
4. **`ADMIN_03_METRICS_CATALOGUE.md`** — every metric defined precisely. SP/PM split now specifies which dimension.
5. **`ADMIN_04_OUTBOUND_LOG.md`** — unified email/social/AI message log.
6. **`ADMIN_05_LINKEDIN_AUTOMATION.md`** — LinkedIn modes + data-to-content pipeline.
7. **`ADMIN_06_ACCESS_AND_SECURITY.md`** — auth, audit, perf gates.
8. **`ADMIN_07_INSIGHT_ENGINE.md`** — daily/weekly AI-narrated insights with confidence scoring.
9. **`ADMIN_08_EXPERIMENT_LAB.md`** — change log + hypothesis + outcome + playbook.
10. **`ADMIN_09_AUTOMATION_BRAIN.md`** — IF/THEN rule engine. Includes a discovery prompt for existing emails.
11. **`ADMIN_10_FRICTION_DETECTION.md`** — PostHog instrumentation for behavioural friction.

## Implementation order (different from read order)

Per ADMIN_01 §7:

1. ADMIN_00 — discovery (✓ done)
2. **ADMIN_02 — schema migrations** (next ticket)
3. ADMIN_03 — metrics + rollup jobs
4. ADMIN_06 — auth + audit
5. ADMIN_10 — PostHog + cookie consent
6. ADMIN_07 — Insight Engine (early; benefits every other tab)
7. ADMIN_08 — Experiment Lab (small but loop-closing)
8. ADMIN_01 Overview + Insights + Activation + Activity tabs
9. ADMIN_01 Growth + Retention + Friction + Health tabs
10. ADMIN_04 Outbound Log
11. ADMIN_09 Automation Brain (after CC discovery + your channel decisions)
12. ADMIN_05 LinkedIn (largest external dependency)
13. ADMIN_01 Audit tab
14. ADMIN_01 Revenue tab when billing exists

## Decisions required from you

Tracked in the docs themselves. Search for `[DECISION REQUIRED]`. Most important:

- ADMIN_01 §8 — definitional defaults + voice samples for Insight Engine
- ADMIN_03 §10 — confirmation checklist before any UI implementation
- ADMIN_05 §3 — LinkedIn API path (A: official / B: third-party scheduler)
- ADMIN_05 §10 — full LinkedIn config decisions
- ADMIN_07 §10 — Insight Engine voice + thresholds
- ADMIN_08 §10 — experiment defaults
- ADMIN_09 §11 — automation channel decisions (after CC inventory)
- ADMIN_10 §9 — PostHog DPA + cookie banner copy

## Conventions

- All schema changes use Prisma migrations applied to staging first
- All command-centre code lives under `lib/command/` and `app/command/`
- All command-centre queries use `db.command` (separate Prisma client per ADMIN_06 §4)
- All meaningful command-centre actions write to `AdminAuditLog`
- Every metric is defined in ADMIN_03 before it appears on the page
- Every automation rule starts in shadow mode (ADMIN_09 §7)
- Every insight signal carries confidence (ADMIN_07 §5)
- Every experiment has a primary metric and guardrails (ADMIN_08)
- The `superadmin` role gates `/command/*`; existing `admin` role unchanged

## The compounding loop

The Insight Engine (07), Experiment Lab (08), and Friction Detection (10) form a tight loop:

```
PostHog friction signals (10)
        │
        ▼
Insight Engine signals (07)
        │
        ▼
Daily / weekly brief
        │
        ▼
"Promote to experiment"
        │
        ▼
Experiment Lab (08)
        │
        ▼
Outcome fed back into next cycle
        │
        └──► back to Insight Engine
```

This is the unfair-advantage layer. Friction signals feed insights, insights become experiments, experiment outcomes feed back into next-cycle insights. Each cycle the engine knows more about what works for your business specifically.
