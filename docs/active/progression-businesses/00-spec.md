# Progression businesses — canonical spec

**Status:** Phase 1 (schema foundation) in progress, 2026-09-30. Feature ships DARK behind `PROGRESSION_BUSINESSES_ENABLED`.

## Mental model

TSP already runs a sales-progression business inside the platform; today it is an implicit singleton. We are generalising that capability so **other progression businesses can run their own bounded version**, while TSP remains the platform operator.

- TSP = progression business #1 (`isTsp = true`) **and** the platform operator (keeps global/admin powers).
- Sarah's business = progression business #2 (bounded, no platform powers).
- Future companies = #3, #4, …

"Replicated" means generalising what TSP already does — not a second application.

## The access boundary (non-negotiable)

**The transaction is the boundary.** A progression-business member can access a file only when `PropertyTransaction.progressionBusinessId` matches their business. A business↔agency client relationship (`ProgressionBusinessClient`) is **client management only and NEVER grants transaction access.**

- `progressionBusinessId = null` means **TSP** (legacy/existing files are NOT backfilled). See `lib/progression/business.ts`.
- External businesses always carry an explicit `progressionBusinessId`. Null must never resolve to an external business.

## Six distinct concepts on a transaction

| Concept | Field | Meaning |
|---|---|---|
| Owning agency | `agencyId` | tenancy root (the client agent's agency) |
| Client estate agent | `agentUserId` | the agent who owns the client relationship; keeps normal agency visibility |
| Progression business | `progressionBusinessId` | **which business is responsible — the access boundary** |
| Assigned progressor | `assignedUserId` | which individual inside that business is responsible (NOT an access grant) |
| Buyer / seller | `Contact` rows | portal-token identities |
| Client-facing contact | resolved via `getProgressionBusinessForTransaction` | the progressor shown to buyer/seller |

## Access scopes

- TSP platform admin (`admin`/`superadmin`/hybrid) → `{kind:"all"}` (unchanged).
- TSP progressor (`sales_progressor`, no external business) → `{kind:"assigned"}` (unchanged).
- External business member → `{kind:"business", businessId}` → `where { progressionBusinessId: businessId }`. All members see the whole business book in V1; `assignedUserId` powers "my files" only.
- Client agent (Donna) → `{kind:"agency"}` (unchanged).
- Buyer/seller → portal token (unchanged).

TSP internal members keep `progressionBusinessId = null` (resolve to TSP implicitly), so "non-null progressionBusinessId" cleanly identifies an external member.

## Roles

Reuse `sales_progressor` — it carries no platform power today (all TSP-only power comes from `admin`/`superadmin` and the hybrid-email allow-list). Business administration (owner vs progressor) is a per-business role (`User.progressionBusinessRole`), not a global role.

## Client-facing identity

`serviceType = "outsourced"` stays meaning "professionally progressed". The TSP-hardcoded bits (WhatsApp `+447508862929`, sender `@thesalesprogressor.co.uk`, org "The Sales Progressor", invoice identity) move onto the `ProgressionBusiness` row and are resolved per transaction, defaulting to the TSP row for null files (identical output for TSP/legacy files).

## V1 target scenario

Sarah (owner, `sales_progressor`, business=Sarah) adds Donna as a client (Donna = her own single-director Agency), creates a sale for Donna (`agencyId=Donna`, `agentUserId=Donna`, `progressionBusinessId=Sarah`, `assignedUserId=Sarah`, outsourced). Sarah sees it via business scope; Donna via agency scope; TSP and other businesses cannot; buyer/seller see Sarah; Sarah can write business-private notes Donna cannot see. No automated billing yet.

## Phases

1. **Schema foundation** (this phase) — additive `ProgressionBusiness`, `ProgressionBusinessClient`, `ProgressionBusinessRole`, nullable `progressionBusinessId` on `User`/`PropertyTransaction`, null=TSP resolver, feature flag, TSP row seed. No behaviour change.
2. **Access boundary + hardening** — `{kind:"business"}` scope; fix single-object guards; document routes → scope helper; chain internal-role set business-aware; `assignUserAction` isolation guard; thread `progressionBusinessId` through the session.
3. **TSP identity generalisation** — resolve WhatsApp/sender/org per business; narrow TSP human work-pools to null-or-TSP.
4. **Client management** — add/invite client agencies (zero access grant).
5. **Create-sale-for-client** — non-admin progressor create path.
6. **Notes visibility** — three audiences (business-only / agent-visible / client-visible).
7. **Progression-business UI** — Sarah's bounded pipeline/hub/file experience.
8. **E2E pilot verification** — fixture + isolation tests + regression.

## Migration safety

Additive + nullable everywhere; no `PropertyTransaction` backfill. Old app instances write null (= TSP) safely. Production gets the TSP row from the Phase 1 migration's idempotent INSERT; staging/local run `scripts/seed-progression-tsp.ts` (db push skips the migration). Fail-closed: a session without `progressionBusinessId` behaves as today.

## Rollback

Flag off halts new external onboarding; scope/identity are data-driven so already-created external data stays consistent and accessible. Additive columns can remain harmlessly.
