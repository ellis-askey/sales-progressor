# TSP Admin — Progression Company Account Workspace (implementation plan)

**Status:** plan for review. **Not implemented.** No code to be written until the structure — and the read-only-vs-operate decision in §8 — is approved.

**Date:** 2026-11-20. Grounded against current HEAD (progression-company surface mapped fresh).
**Reads with:** [`00-AUDIT-AND-ARCHITECTURE.md`](00-AUDIT-AND-ARCHITECTURE.md) §B, [`03-CUSTOMER-ACCOUNT-WORKSPACE.md`](03-CUSTOMER-ACCOUNT-WORKSPACE.md) (the agency account — the shared *pattern*, not a template to copy).

---

## 0. The decisive finding — this account is read-only today

The agency account had real write controls to reorganise (fee editor, automation toggles, GDPR danger zone). **The progression-company surface in the Command Centre has none.** `app/command/(protected)/businesses/[id]/page.tsx` is **entirely observational** — no forms, no server actions, no mutations; only navigation links.

**All** business management — team, client agencies, billing, identity, settings — lives in the business owner's **own self-serve surface**: `app/actions/progression-clients.ts` (server actions) → `lib/services/progression-clients.ts`, revalidating `/agent/clients`, `/agent/team`, `/agent/settings/*`. Every action is **owner-gated** (`assertOwnerOfClient` / `resolveBusinessOwner`) and flag-gated (`progressionBusinessesEnabled()`), and **assumes the acting user *is* the business owner** — so none can be reused for a superadmin operating on another business.

**Consequence:** the first progression-company slice is a **read-only tabbed reorganisation** of the existing observational detail page (mirroring the agency *shell* move, minus write controls — because there are none to move). Any founder *write* capability in the CC is **genuinely new, superadmin-gated work** and a product decision (§8), not a preservation task. Do not copy the agency account's write affordances onto a model that doesn't have them.

---

## 1. Proposed workspace route

Evolve **`/command/businesses/[id]`** in place with a `?tab=` parameter (the same `ParamTabs` pattern the agency account and the Boardwalk trial cockpit already use). No new route; the existing deep link, the list→detail link, and the agency-file "Progression managed by" links all keep working.

---

## 2. Final tab structure (5 tabs)

Matches the approved starting point; the existing read-only sections distribute cleanly into it, so no adjustment is warranted.

1. **Overview** — identity, status, this-month money headline, activity, friction signals.
2. **Team** — directors & members, roles, access (read-only view of the self-serve team).
3. **Clients** — connected estate-agency clients (+ cross-link to each one's agency account).
4. **Billing** — subscription, seats, per-sale charges, payment/dunning state, cancel schedule.
5. **Setup & settings** — onboarding scorecard, sending identity, and the business's configured preferences.

Header (name + verified badge + `BusinessStatusPill`) and any payment/blocked alert stay **above** the tabs, mirroring the agency account.

---

## 3. Existing functionality & data sources per tab

All loaders are in `lib/command/businesses.ts` (pure reads via `commandDb`); all exist today and feed the current detail page. Fetch **lazily per active tab** (the Event-rail loaders — `getBusinessWatch`, `getBusinessFriction` — do real work).

| Tab | Existing content | Data sources (all current) |
|---|---|---|
| **Overview** | Fact strip (subscription, card, payment, cancellation, "sends as", clients·team), this-month money headline, recent activity, friction signals | `getBusinessDetail(id, now)`, `getBusinessWatch(detail, now)` (feed), `getBusinessFriction(id, now)`, `getBusinessBillingSummary` (via detail) |
| **Team** | Members list (name, role owner/progressor, deactivated), team vitals | `getBusinessDetail` → `members`; `getBusinessWatch` → vitals |
| **Clients** | Client agencies (feeModel, removed/active), per-client sender | `getBusinessDetail` → `clients`; `getBusinessSendingIdentity(id)` |
| **Billing** | MRR/statement (base £59 + seats £39 + per-sale £5), payment state, cancel schedule | `getBusinessBillingSummary`, `getBusinessPaymentState` (dunning), `getBusinessPlanSchedule(id)` (live-Stripe read) |
| **Setup & settings** | "Getting set up" scorecard, sending identity per agency, configured prefs (chase/portal/VAT/billing-point) | `getBusinessWatch` (setup checks), `getBusinessSendingIdentity`, `getBusinessDetail` (ProgressionBusiness setting fields) |

**Cross-link worth adding:** each client row is an `Agency` (`ProgressionBusinessClient.agencyId`) — link it to `/command/agency/[agencyId]` so the two account types connect (the client link never grants file access; it's navigation only).

---

## 4. Existing pages to consolidate

| Existing | Becomes | Treatment |
|---|---|---|
| `/command/businesses/[id]` | the tabbed account (in place) | Reorganise its read-only sections into the 5 tabs |
| `/command/businesses` (list) | unchanged; row opens the account | Retain |
| Business figures in `/command/revenue` + `revenue/breakdown?metric=business` | unchanged | Retain (platform-wide revenue view; distinct from one business's Billing tab — like the agency Revenue/Billing split) |

No standalone business sub-pages to fold in (unlike the agency account's `revenue/[agencyId]`); the detail page is already the single surface. So this slice is purely the in-place tab reorganisation.

---

## 5. Shared components / patterns to reuse

- **`ParamTabs`** + the `components/command/ui/primitives.tsx` kit (`Section`, `KpiCard`, `TableShell`/`Tr`/`Td`, `CardEmpty`) — the **Boardwalk trial cockpit already composes exactly these into a tabbed CC workspace**, so it's the proven template (closer than the agency account, which uses older inline helpers).
- **`BusinessStatusPill`** (`components/command/businesses/StatusPill.tsx`), `formatGBP`/`formatShortDate`/`formatMonthLabel` (`lib/command/revenue.ts`), `eventLabel` (`lib/command/event-labels.ts`) — reuse as-is.
- The detail page's **inline helpers** (`Fact`, `SectionCard`, `Metric`, `StatementLine`, `SenderMethodBadge`, `SetupCheckRow`) move with their sections into the tabs; where a primitive already covers one (`Section`, `TableShell`, `KpiCard`), prefer the primitive for consistency.
- **Do NOT force a shared "account shell" abstraction** between the agency and business accounts yet. They share *primitives*, not structure (different headers, alerts, tabs, data). Extract a shared shell only if/when a third account type appears — premature abstraction now would couple two genuinely different models.

---

## 6. Billing & tenant-isolation considerations

**Billing (verified in code):** `lib/progression/business-billing.ts` — base **£59** (`BUSINESS_BASE_PENCE=5900`), **£39**/extra member (`BUSINESS_PER_MEMBER_PENCE=3900`, `extraMembers = members − 1`), **£5**/sale (`BUSINESS_PER_SALE_PENCE=500`; organic on-add, migrated on-exchange). This is **LIVE Stripe, real money** (`acct_1UNqo0FJibD43diI`), driven by self-serve owner actions + the daily `business-billing` cron; gated by `progressionBillingCollectEnabled()`.
- The Billing tab is a **read-only view** of `getBusinessBillingSummary` + `getBusinessPaymentState` + `getBusinessPlanSchedule`. **No new billing calculations, no commercial rules, no writes** — as instructed.
- Any founder billing *action* (cancel/reactivate a sub, refund, credit, adjust seats) is **new, superadmin-gated** work — the owner-gated self-serve actions can't be reused for a superadmin acting on another business — and must carry the finance-safety bar (step-up per Slice 2, confirmation, idempotency, `AdminAuditLog`, Stripe-reconciled). Out of scope here; see §8.

**Tenant isolation:** the CC reads businesses only through `commandDb` (full-access, Law 8) behind the superadmin layout gate. It must **not** adopt the `business` access scope or the owner-gated actions. The access boundary for business data remains `PropertyTransaction.progressionBusinessId`; the `ProgressionBusinessClient` link is management-only and never grants file access — the account must preserve that (client cross-links are navigation, not access grants).

---

## 7. Safe implementation sequence

1. **Tabbed shell (read-only reorg).** Add `?tab=` + `ParamTabs` to `businesses/[id]`; distribute the existing sections into Overview/Team/Clients/Billing/Setup, header + alert above the tabs. Lazy per-tab fetch of the existing loaders. Pure reorganisation of observational content — the safest first step (mirrors the agency shell slice).
2. **Primitive alignment + Clients cross-links.** Where the inline helpers duplicate a primitive, adopt `Section`/`TableShell`/`KpiCard`; add client→`/command/agency/[id]` links.
3. **(Only if approved in §8) founder write actions.** New superadmin-gated server actions, one capability at a time, each with audit + (for billing) the finance-safety bar. Separate slice(s), staging-first, ideally after Slice 2 step-up lands.

Each step is independently reviewable; no route moves; deep links and the self-serve owner surface are untouched throughout.

---

## 8. Product decisions requiring your input

1. **Read-only vs operate (the big one).** Today the CC progression-company view is purely observational, and all management is the owner's self-serve surface. Do you want this account to **stay read-only** (understand/support) for now — or to gain **founder write actions** (manage team, adjust/cancel billing, edit identity on a business's behalf)? The latter is new superadmin-gated work (owner-gated actions can't be reused) and, for billing, needs the finance-safety bar — I'd recommend shipping the **read-only tabbed account first**, then adding specific operate actions as separate, approved slices.
2. **If/when write actions:** which first — team (invite/remove/reinstate), identity/settings, or billing (cancel/reactivate/refund)? Billing writes are highest-risk (live money) and should wait for Slice 2 step-up + audit.
3. **Support affordances short of writes:** would a few safe, high-value **read/ops helpers** be useful now — e.g. "view the owner's self-serve screen", resend a team invite, or a Stripe deep-link — without building full CC-side management? (Some, like resend-invite, still need a new superadmin-safe action.)
4. **Clients cross-link direction:** confirm linking a business's client agency to its `/command/agency/[id]` account (navigation only; the link never grants file access) is wanted.
5. **Shared shell abstraction:** agreed to keep the agency and business accounts composing shared *primitives* rather than a forced shared shell for now?
