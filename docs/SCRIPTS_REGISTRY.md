# Scripts Registry

Every file in `scripts/` is registered here per [Law 15 (scripts must justify)](../CLAUDE.md#law-15--scripts-must-justify). New entries are added in the same PR that adds the script. Pre-commit hook checks this (warn-only in Phase 5).

## Format

```
### <relative-path>

- **Purpose:** one-line description
- **Lifetime:** `one-shot` | `ongoing`
- **Author:** <name>, <YYYY-MM-DD>
- **Deletion criteria:** for one-shots, what condition triggers removal. For ongoing, "permanent".
- **Justification:** why this is a script and not a feature / admin action / test / npm script.
```

---

## Grandfathered (pre-Law-15)

**All scripts in `scripts/` as of commit `cd746f2` (2026-06-26)** are grandfathered. The bulk inventory + cull plan lives at [`inventory/SCRIPTS.md`](inventory/SCRIPTS.md). They will be culled in Phase 4 of [BUILD_PLAN.md](BUILD_PLAN.md) — target ≤ 15 files.

Grandfathered scripts do **NOT** need individual entries in this registry. They are tracked via the SCRIPTS.md census instead, which categorises each as `archive-delete` / `promote-feature` / `promote-test` / `promote-npm-script` / `keep-as-is`.

## New entries (post-Law-15)

### scripts/inventory/components.ts

- **Purpose:** Walks `components/` and emits `docs/inventory/COMPONENTS.md` classifying each component as `canonical` / `to-extract` / `domain-specific` / `outlier-grandfathered` per the catalog.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 1), 2026-06-26
- **Deletion criteria:** permanent. Re-run during the quarterly catalog review.
- **Justification:** generates a docs artifact that powers the catalog acceptance gate. Not a feature, not a test, not user-facing. Belongs in `scripts/` as a maintenance tool.

### scripts/flag-test-agencies-internal.ts

- **Purpose:** Flag test/experiment agencies (e.g. "EXP - DB") as `isInternal = true` so they stop tripping Command Centre signal detectors and polluting metrics.
- **Lifetime:** `one-shot`
- **Author:** CC (Command Centre review — Briefing page), 2026-08-28
- **Deletion criteria:** delete once the target test agencies are flagged internal on both staging and production (tracked in ELLIS_MANUAL_TODO).
- **Justification:** a rare data-hygiene correction, dry-run-guarded, run by the founder against the chosen env. Not a recurring feature; an admin toggle would be over-engineering for a one-off.

### scripts/backfill-property-photos.ts

- **Purpose:** Repair property-photo drift — set `photoStoragePath` on files whose image is in the `property-photos/` storage bucket but whose DB field was never persisted (agent two-step upload missing step 2), so the photo shows again everywhere.
- **Lifetime:** `one-shot`
- **Author:** CC (Command Centre review — Files page), 2026-08-28
- **Deletion criteria:** delete once run on staging + production and the root-cause fix (agent upload persists the field in-request) has shipped.
- **Justification:** a data-repair reconciliation between storage and DB, dry-run-guarded, run by the founder per env. Not a recurring feature.

### scripts/inventory/scripts.ts

- **Purpose:** Walks `scripts/` and emits `docs/inventory/SCRIPTS.md` classifying each script per the cull categories (`archive-delete` / `promote-feature` / `promote-test` / `promote-npm-script` / `keep-as-is`).
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 1), 2026-06-26
- **Deletion criteria:** permanent. Re-run during Phase 4 culls and quarterly thereafter.
- **Justification:** same as components inventory — a maintenance tool that powers a docs artifact.

### scripts/reset-domain-auth-records.ts

- **Purpose:** Reset a PENDING domain authentication onto TSP's collision-resistant return path (`tsp.<domain>`) and DKIM selector (`tsp._domainkey.<domain>`), for domains whose default `em`/`s1`/`s2` records collided with an existing SendGrid account on the same domain (e.g. `expuk.com`). Delete-and-recreates the SendGrid whitelabel domain (the only way to change its subdomain/selector) and updates the `VerifiedDomain` row with the fresh records.
- **Lifetime:** `one-shot`
- **Author:** CC (SendGrid domain-auth collision fix), 2026-09-04
- **Deletion criteria:** delete once the known collided pending domains (`expuk.com` and any others surfaced) have been reset on production and the new-authentication fix (`subdomain`/`custom_dkim_selector` = `tsp` in `lib/services/sendgrid.ts`) is confirmed live so no future creation collides.
- **Justification:** a rare, destructive SendGrid reconciliation gated behind dry-run + APPLY and two guards that refuse any verified/live authentication. Not a recurring feature — a Command Centre "regenerate records" button is the durable home if the collision recurs often; flagged as follow-up rather than built now to keep this change scoped to the reported incident.

### scripts/seed-overdue-exchange-demo.ts

- **Purpose:** STAGING demo for the exchange-date work (Note 1 of docs/active/three-notes-distilled-2026-08-26.md). Backfills expectedExchangeDate from the live prediction on every active file, seeds one "moving" file (self-adjusting date) and one "stuck" file (overdue + quiet) so the hub amber item + file revise-banner can be walked through.
- **Lifetime:** `one-shot`
- **Author:** CC, 2026-08-27
- **Deletion criteria:** delete after Ellis has walked the demo and the seeded demo files are removed from staging.
- **Justification:** a throwaway walk-through seeder, staging-only (refuses to run against the prod DB host before any write). Not a feature or test — it fabricates demo state that must never ship to real users (Law 20 keeps demo strings in seed files like this).

### scripts/upload-demo-house-photo.ts

- **Purpose:** Uploads Images/House.png into the `transaction-documents` bucket at `demo/house.png` (the path `DEMO_PRESET.photoStoragePath` points at) so the demo showcase hero shows the property photo instead of the empty "Add photo" state. The asset existed on prod storage but not staging, so demos on staging rendered photo-less.
- **Lifetime:** `one-shot`
- **Author:** CC (demo guided-experience), 2026-09-02
- **Deletion criteria:** delete once demo storage assets (house / mos / agent avatar) are seeded into every environment as part of the demo build, so no manual upload is needed.
- **Justification:** a one-off asset upload to whichever Supabase the env points at; idempotent (upsert). Not a feature or test — it provisions a static demo asset. Related to [[demo-sale]].

### scripts/seed-playwright-director.ts

- **Purpose:** Creates or refreshes a dedicated staging director user (`playwright-baseline@thesalesprogressor.test`) with a known password matching `TEST_PASSWORD`. Used by `e2e/baseline-file-detail.spec.ts` for autonomous Playwright screenshot capture and surface-1 E2E coverage.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 3 Step 1), 2026-06-29
- **Deletion criteria:** delete only if Phase 3 surface remediation is complete AND the autonomous capture spec is also deleted.
- **Justification:** seeds an idempotent, scoped test user. Refuses to run against prod DB at runtime (checks `DATABASE_URL` host before any write). Not a feature, not an npm script — proper one-shot/ongoing staging-only seeder.

### scripts/point-staging-alias.mjs

- **Purpose:** Points `salesprogressor-git-staging-….vercel.app` at the newest Ready staging deployment (`npm run staging:alias`). Vercel's automatic branch aliasing is broken for this project (perf audit F3, root-caused 2026-10-12): staging builds go Ready correctly tagged but the branch URL never follows, so manual testing silently lands on weeks-old code. Run after every staging push until the dashboard-side cause is fixed.
- **Lifetime:** `ongoing`
- **Author:** CC (perf audit wrap-up), 2026-10-12
- **Deletion criteria:** delete + deregister once Vercel automatic branch aliasing demonstrably works again (push to staging, confirm the branch URL repoints with no manual step).
- **Justification:** operational tool wrapping the Vercel CLI; not a feature or test. npm-script-wrapped (`staging:alias`) but the logic (newest-staging lookup, Ready wait, alias) warrants a script file.

### scripts/inventory/surfaces.ts

- **Purpose:** Walks `app/` for `page.tsx` files and emits `docs/inventory/SURFACES.md` listing every route with audience role and rough complexity score.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 1), 2026-06-26
- **Deletion criteria:** permanent. Re-run when adding new routes or when re-ordering the Phase 3 queue.
- **Justification:** powers the Phase 3 surface queue in BUILD_PLAN.

### scripts/backfill-mode-profile.ts

- **Purpose:** Exports `backfillModeProfiles()` used by the daily cron at `/api/cron/backfill-mode-profile`. The script file is effectively a shared library that the cron route imports.
- **Lifetime:** `ongoing`
- **Author:** promoted-to-keep during Phase 4 K1 cull, 2026-07-01
- **Deletion criteria:** delete only if the cron at `app/api/cron/backfill-mode-profile/route.ts` is also removed or refactored to inline the logic.
- **Justification:** the census heuristic flagged this as `archive-delete` (looked like a one-shot backfill from the filename), but the tsc check caught the live import. Better to reclassify as ongoing than to promote to `lib/services/`, which would spread the module without behaviour change. Future refactor: move into `lib/services/` alongside other services, delete the script.

### scripts/vercel-db-deploy.mjs

- **Purpose:** Runs `prisma migrate deploy` conditionally on `VERCEL_ENV=production`. Called by `npm run build`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered — established build-time hook.
- **Deletion criteria:** delete only if Vercel replaces or removes the build-time hook path.
- **Justification:** live build-time dependency; cannot be replaced with an npm script alone because of the conditional VERCEL_ENV branch.

### scripts/migrate-prod.mjs

- **Purpose:** Wrapper for `npm run db:migrate:prod`. Applies Prisma migrations to the production DB with confirmation prompts.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when the equivalent workflow moves to a `/command/*` admin action.
- **Justification:** critical production tool. Cannot be a plain npm script because of confirmation flow.

### scripts/seed-demo.ts

- **Purpose:** Seeds the demo dataset for local + staging via `npm run demo:seed`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when demo dataset seeding moves into a first-party CLI or is retired.
- **Justification:** referenced by `demo:seed` in package.json; still active dev flow.

### scripts/reset-demo.ts

- **Purpose:** Resets the demo dataset via `npm run demo:reset`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** paired with seed-demo — same criteria.
- **Justification:** live npm script.

### scripts/demo-verify.ts

- **Purpose:** Verifies demo dataset state via `npm run demo:verify`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** paired with seed-demo — same criteria.
- **Justification:** live npm script.

### scripts/reset-db.ts

- **Purpose:** Development utility to reset the local DB.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete only if replaced by a first-party CLI.
- **Justification:** local dev utility, not surface-eligible.

### scripts/health-audit-prod.mjs

- **Purpose:** Recurring production health audit; scanned during quarterly reviews.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when health surfaces move to a `/command/insights` dashboard.
- **Justification:** recurring maintenance tool; not user-facing.

### scripts/install-gitleaks-hook.sh

- **Purpose:** Installs the gitleaks pre-commit hook for local dev.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when the hook is bundled into a first-party tool.
- **Justification:** dev-machine setup script; runs once per clone.

### scripts/seed-test-accounts.ts

- **Purpose:** Seeds test accounts used by the Playwright E2E suite (referenced in `e2e/README-package-d.md`).
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when the E2E suite is retired or migrates to a self-seeding fixture pattern.
- **Justification:** paired with the E2E harness; alternative would be per-test seeding which is more expensive.

### scripts/hooks/pre-commit

- **Purpose:** Phase 5 MVP pre-commit hook. Runs 3 checks against staged files: `tsc --noEmit` (Law 2), em-dash sweep in double-quoted strings (Law 21), SCRIPTS_REGISTRY entry required for any new `scripts/` file (Law 15).
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 5 MVP), 2026-07-01
- **Deletion criteria:** delete when replaced by a more comprehensive Phase 5.5 hook or a Husky-based flow.
- **Justification:** enforcement of Laws that would otherwise depend on the committer remembering. Warn-only until 2026-07-15 then flips to block. Installed opt-in via `install.sh`; not part of `npm install` flow.

### scripts/hooks/install.sh

- **Purpose:** Idempotent installer that symlinks (or copies on Windows) `scripts/hooks/pre-commit` into `.git/hooks/pre-commit`.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 5 MVP), 2026-07-01
- **Deletion criteria:** paired with pre-commit hook.
- **Justification:** local dev-machine setup script; runs once per clone.

### scripts/hooks/uninstall.sh

- **Purpose:** Removes the Phase 5 pre-commit hook. Emergency escape hatch if the hook misbehaves.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 5 MVP), 2026-07-01
- **Deletion criteria:** paired with pre-commit hook.
- **Justification:** critical fallback; complements install.sh.

### scripts/audit-broken-postcodes.mjs

- **Purpose:** Read-only audit that finds every `PropertyTransaction.propertyAddress` (and `ChainLink.stubPropertyAddress`) where the UK postcode segment matches the postcode regex but isn't already uppercase. Prints the list; makes no writes.
- **Lifetime:** `one-shot`
- **Author:** CC (postcode normalisation, hub polish arc), 2026-07-03
- **Deletion criteria:** delete once `fix-broken-postcodes.mjs` has run against prod and the audit returns zero rows for two consecutive runs.
- **Justification:** paired with the runtime fix (normaliser at every write path — `createTransaction`, `stubFields`, claim-signup route). Retro-audit needs raw SQL against prod, not a first-party admin action.

### scripts/fix-broken-postcodes.mjs

- **Purpose:** One-shot retroactive fix that uppercases mixed-case postcode segments in existing `PropertyTransaction.propertyAddress` and `ChainLink.stubPropertyAddress` rows. Dry-run by default; `--commit` to write.
- **Lifetime:** `one-shot`
- **Author:** CC (postcode normalisation, hub polish arc), 2026-07-03
- **Deletion criteria:** delete after the audit (see above) returns zero rows across staging + prod for two consecutive runs.
- **Justification:** legacy row backfill. Runtime writes are now normalised, so this only cleans up historical data. Not surface-eligible.

### scripts/seed-billy-hub-preview.ts

- **Purpose:** Seeds the `ellisaskey+billy@googlemail.com` account on staging with ~20 test transactions spread across the five pipeline-at-a-glance stages (new/legals/ready/exchanging/completed) plus expected exchange dates that populate the diary + forecast. Powers the hub-polish PR 1 + PR 2 preview.
- **Lifetime:** `one-shot`
- **Author:** CC (hub polish preview), 2026-07-02
- **Deletion criteria:** delete once Billy has viewed the polished hub and confirmed direction. Ideally within 2 weeks.
- **Justification:** required exactly-once data population for a specific test account on staging. Refuses to run against prod DB at runtime. Idempotent — safe to re-run.

### scripts/backfill-completed-status.mjs

- **Purpose:** One-shot data fix. (1) Flip to `status='completed'` the outsourced files that have a completion milestone (VM20 or PM27) confirmed but were left stuck on `active` because the old inline gate required BOTH sides to trigger the flip. (2) Null out the one Contact whose `email` field holds a phone number (Emma O'Connell, 20 Williamson Way — phone already lives in `.phone`). Prints before/after evidence; writes run inside one transaction.
- **Lifetime:** `one-shot`
- **Author:** CC (completion auto-flip refactor + safety-net cron), 2026-07-28
- **Deletion criteria:** delete once the 2026-07-28 backfill has run against prod and the nightly `completion-safety-net` cron has been live for one week with a clean sweep.
- **Justification:** legacy row backfill for files that were completed under the old single-path gate. The runtime fix (shared `maybeAutoCompleteTransaction` helper + nightly cron) prevents new instances of this state, so this script only cleans up historical data.

### scripts/annual-leave-name-check.mjs

- **Purpose:** Read-only. Builds the recipient list for the 2026 annual-leave notice (every vendor/purchaser contact on an active outsourced file that has an email and is not unsubscribed) and prints a name-approval table: raw stored name → proposed "Hi ___" greeting → flags on anything that looks wrong (title + surname only, company name, joint parties, missing name, comma format). Writes `docs/annual-leave-name-check-2026.md`.
- **Lifetime:** `one-shot`
- **Author:** CC (annual-leave 2026-07-30 send), 2026-07-27
- **Deletion criteria:** delete once the 2026 annual-leave send is completed and signed off.
- **Justification:** name-quality QA gate that has to look at prod contact rows before the send goes out. Not surface-eligible: it is a one-time operator step, not an ongoing agency-facing action.

### scripts/generate-annual-leave-emails.mjs

- **Purpose:** One-shot generator. Pulls every active outsourced transaction from prod, produces two annual-leave notification emails per file (vendor + purchaser), writes `docs/annual-leave-emails-2026-07-30.md` for review before send.
- **Lifetime:** `one-shot`
- **Author:** CC (annual-leave 2026-07-30 send), 2026-07-27
- **Deletion criteria:** delete once the 2026 annual-leave send is completed.
- **Justification:** preview step so the drafts can be reviewed as a single document before the send script goes live.

### scripts/annual-leave-send.mjs

- **Purpose:** Sends the 2026 annual-leave notice to every buyer/seller on an active outsourced file. Three modes: default = preview (writes `docs/annual-leave-emails-final.md`, sends nothing); `--test` = representative samples to `ellisaskey@googlemail.com`; `--send` = full batch to real recipients (guarded).
- **Lifetime:** `one-shot`
- **Author:** CC (annual-leave 2026-07-30 send), 2026-07-28
- **Deletion criteria:** delete once the 2026 annual-leave send is completed.
- **Justification:** one-off notice tied to a specific date range (30 July - 10 August 2026). Not surface-eligible: template + recipient shape are specific to this event and would rot if kept as a general feature.

### scripts/backfill-stuck-completions-2026-08-08.mjs

- **Purpose:** One-shot backfill for four files (18 Commissioner Rd, 17 Bushy Ave, 29 Sears Dr, 54 Launcelot Rd) that Ellis confirmed via the reconciliation modal on 2026-08-08 but which stayed in Active because `confirmExchangeReconciliationAction` was missing the auto-flip call. Root cause fixed in the same PR (`app/actions/milestones.ts` + `app/actions/tasks.ts`); this script writes the same status flip + activity note + audit event that the runtime helper would have written.
- **Lifetime:** `one-shot`
- **Author:** CC (auto-flip bugfix 2026-08-08), 2026-08-08
- **Deletion criteria:** delete after the run confirms all four files flipped (target 2026-08-15).
- **Justification:** past-tense data repair. The runtime fix in the same PR prevents this happening again; the four already-confirmed files can't be rescued by a code fix so a one-shot backfill is the correct shape.

---

## Footnotes

- Companion docs: [CLAUDE.md Law 15](../CLAUDE.md#law-15--scripts-must-justify), [BUILD_PLAN.md Phase 4](BUILD_PLAN.md#phase-4--scripts-cull-interleaved-from-week-8).
- Last updated: 2026-08-08.

### scripts/seed-emily-countdown-sdlt.ts

- **Purpose:** Additively creates one exchanged-purchase demo file on Emily's account (£650k, completing in 14 days) so Ellis can view the completion countdown + stamp-duty estimate on one portal link.
- **Lifetime:** `one-shot`
- **Author:** Claude, 2026-08-16
- **Deletion criteria:** delete once the completion-countdown + SDLT features are signed off by Ellis.
- **Justification:** demo data seeding, not a feature/test/npm-script. Additive and idempotent-safe (creates only), guarded to Emily's account.

### scripts/seed-portal-batch-aug17.ts

- **Purpose:** Additively creates two demo files on Emily's account (one exchanged, one pre-exchange) so Ellis can view the 2026-08-17 portal batch: Save-contact vCard, new-since-last-visit markers, and add-expected-exchange-to-calendar. Also sets the agency sender email + Emily's phone + an own-side conveyancer with email/phone so the buttons have data.
- **Lifetime:** `one-shot`
- **Author:** Claude, 2026-08-17
- **Deletion criteria:** delete once the Aug-17 portal batch is signed off by Ellis.
- **Justification:** demo data seeding, not a feature/test/npm-script. Staging-only (refuses prod) because it mutates shared rows (agency sender, Emily's phone); file creation is additive.

### scripts/backfill-solicitor-summaries.ts

- **Purpose:** Re-render the stored `summaryText` on existing solicitor-confirmed `MilestoneCompletion` rows to the approved sentence form ("{firm} confirmed they have ordered the searches"). Read-time surfaces already regenerate; this fixes the stored text shown on the hub + file activity timeline so past confirms read identically to new ones.
- **Lifetime:** `one-shot`
- **Author:** Claude, 2026-08-25
- **Deletion criteria:** delete once it has run on production.
- **Justification:** one-off data backfill of a display string on solicitor-confirmed rows; not a feature/test/npm-script. Idempotent (only rewrites rows whose text differs).

### seed-pricing-verification.ts
- **Purpose:** one-shot Phase-1 pricing verification seed — fresh agency + 3 exchanged sales (self £0 / first outsourced free / second billed) via the real billing paths.
- **Lifetime:** one-shot (throwaway). Staging-guarded (refuses non-staging DB).
- **Author/date:** pricing migration, 2026-08-31.
- **Deletion criteria:** delete the "Pricing Verification Co" agency + this script once Phase 1 is verified.

### seed-tim-billing-demo.ts
- **Purpose:** additive billing demo data for Tim Branston (agency "William H Brown") so /agent/account/billing shows populated states during the Account redesign review — this-month building invoice, invoice history (Paid/Issued/Failed), given-free + billed-lifetime figures, acknowledged terms. Never touches his real files; demo rows are tagged "(demo)" / "demo_tim_".
- **Lifetime:** one-shot (throwaway). Staging-guarded (refuses non-staging DB). Re-runnable.
- **Author/date:** Claude, 2026-08-31.
- **Deletion criteria:** delete this script + the demo rows (transactions tagged "(demo)", invoices with stripeInvoiceId prefix "demo_tim_") once the Account/billing redesign review is done.

### seed-vm7-chase-test.ts
- **Purpose:** one-shot staging test file for the "chase the draft contract pack (VM7)" bug report. Stands up a real self-managed sale on Emily Chen's agency (Hartwell & Partners), completes VM7's prerequisites (VM1/3/4/5/6, backdated), leaves VM7 "draft contract pack issued" available/unconfirmed, and runs the real reminder engine so a due VM7 chase task exists to click Chase on. Also resets the agent's password to a known value for login.
- **Lifetime:** one-shot (throwaway). Staging-guarded (refuses production DB).
- **Author/date:** Claude, 2026-09-07.
- **Deletion criteria:** delete this script + this entry (and remove the seeded transaction) once the VM7 chase behaviour has been verified.

### seed-portal-cards.ts
- **Purpose:** review seed for Portal Engagement v2 (item B) — one clean, labelled portal file per "Something you can do" card (Information Walk / Stamp Duty Rise / Completion Court, all ", Cardview"), attached to Emily Chen's self-managed agency, so each prompt can be reviewed in isolation.
- **Lifetime:** one-shot (throwaway). Idempotent (deletes its own ", Cardview" files then recreates); additive otherwise.
- **Author/date:** Claude, 2026-09-12.
- **Deletion criteria:** delete this script + this entry once the portal "cards" arc (item B) is signed off.

### seed-providers-card.ts
- **Purpose:** review seed for the provider/survey/broker card audit fixes. Up to seven buyer files, one per behaviour: providers card local copy (covered), hidden (uncovered, no broker), broker card via agency's own broker (uncovered + broker on file), survey opt-out (quote card gone, providers shows), quote-requested ("Request another quote" link), agent-typed surveyor name (#7, "Survey booked with AVB Surveyors" via the acronym-safe formatter), and — when a TSP-default broker exists — broker card via our default (no "Recommended by" line). Upserts a demo surveyor ("Provcard Surveys") + BS1 coverage + a demo broker firm.
- **Lifetime:** one-shot (throwaway). Idempotent (wipes its own "Provcard" files then recreates); staging-guarded (refuses production DB).
- **Author/date:** Claude, 2026-09-14.
- **Deletion criteria:** delete this script + this entry (and the "Provcard" files + "Provcard Surveys"/"Provcard Mortgages" firms + coverage) once the provider card audit is signed off.

### seed-chain-far-side.ts
- **Purpose:** walkable demo for the chain far-side feature. On the first non-internal agency, stands up a file "12 Chain Demo Road" in the middle of a 3-link chain (onward stub "2 Evans Way" above, related stub "8 Brambling Crescent" below) and populates all four trackers (onward_purchase, onward_purchase_seller, related_sale, related_sale_buyer) with a few reported steps, so the near/far toggle and both far sides show real data. See docs/active/chain-far-side/WALKTHROUGH.md.
- **Lifetime:** one-shot (throwaway). Idempotent-ish (reuses the demo file + chain; already-reported steps are skipped by the service).
- **Author/date:** Claude, 2026-09-14.
- **Deletion criteria:** delete this script + this entry (and the "12 Chain Demo Road" file + its chain + trackers) once the chain far-side feature is signed off.

### seed-onward-broker-demo.ts
- **Purpose:** demo for the seller's onward broker (Phase 2). Applies the onward-broker columns to staging idempotently via the pooler (local can't run prisma migrate — direct DB host unreachable), then seeds four Hartwell & Partners files (", Onward Demo") covering the Professionals card, Fees card, completions, analytics, and the revenue-at-risk warning.
- **Lifetime:** one-shot (throwaway). Idempotent (wipes its own ", Onward Demo" files then recreates); staging-guarded.
- **Author/date:** Claude, 2026-09-15.
- **Deletion criteria:** delete this script + this entry (and the ", Onward Demo" files + "Onward Finance (demo)" firm) once the onward broker feature is signed off.

### cleanup-portal-confirm-dupes.ts
- **Purpose:** one-shot data cleanup. Removes the redundant "X confirmed \"...\" via the client portal" internal_note rows created on portal milestone confirmations. These duplicated the "Confirmed by client" milestone-completion entry in the activity timeline and were mis-stamped with the file agent's id (so they wore the agent's photo). The write that produced them was removed from lib/services/portal.ts on 2026-09-16. Targets ONLY confirm notes (type internal_note, content contains `confirmed "` and ends with `via the client portal`); the other portal internal_notes (expected-date, left-a-note) do not match. Dry-run by default; `--apply` deletes.
- **Lifetime:** one-shot (throwaway).
- **Author/date:** Claude, 2026-09-16.
- **Deletion criteria:** delete this script + this entry once run on staging + prod and confirmed.

### backfill-reclean-inbound.ts
- **Purpose:** one-shot data backfill. Re-cleans the displayed text (`content`) of inbound emails synced before the Phase A cleaning improvements. Cleaning only runs at ingest and re-syncs de-dupe rather than re-clean, so older emails still show signatures / quoted trails the current cleaner strips. Re-runs `cleanIngestedEmail` over the preserved `providerWebhookData.raw` and updates `content` where it differs. Safe + reversible (raw untouched; re-runnable). Targets inbound email rows only. Dry-run by default; `--apply` writes; `--prod` targets PROD_DATABASE_URL.
- **Lifetime:** one-shot (throwaway).
- **Author/date:** Claude, 2026-09-16.
- **Deletion criteria:** delete this script + this entry once run on staging + prod and confirmed.

### cleanup-noise-pending-emails.ts
- **Purpose:** one-shot data cleanup. Dismisses "Needs filing" tray rows (`PendingInboundEmail`) that have NO candidate file — newsletters, billing, build alerts, test mail, and other inbox noise the tray used to keep for every unmatched inbound email. The ingest fix (lib/integrations/mail/ingest.ts, 2026-09-17) now drops zero-candidate emails at source; this clears the ~574 already queued on prod. Dismisses (status='dismissed', reversible), never deletes; targets only OPEN rows with an empty candidates array. Dry-run by default; `--apply` writes; `--prod` targets prod.
- **Lifetime:** one-shot (throwaway).
- **Author/date:** Claude, 2026-09-17.
- **Deletion criteria:** delete this script + this entry once run on staging + prod and confirmed.

### migrate-chain-notes-to-entries.mjs
- **Purpose:** one-shot data migration for b1ey9l. Converts the legacy single `ChainLink.chainNotes` blob into dated `ChainLinkEntry` rows: splits on newlines, extracts a leading UK-format date (DD.MM.YYYY / DD/MM/YYYY / DD:MM:YYYY) as the entry timestamp and strips it from the body; undated lines fall back to the link's `lastChainCheckAt` (else `createdAt`). Nulls `chainNotes` after creating entries so the note isn't shown twice. Idempotent (skips links that already have entries; tolerates the entries table not existing yet for a pre-deploy dry-run). Dry-run by default; `--apply` writes; `--prod` targets PROD_DATABASE_URL. Validated against the 17 live prod notes (→ 21 entries) 2026-09-26.
- **Lifetime:** one-shot (throwaway).
- **Author/date:** Claude, 2026-09-26.
- **Deletion criteria:** delete this script + this entry once run on prod (post-deploy) and confirmed.

### backfill-referral-ledger.mjs
- **Purpose:** one-shot data backfill for the referral-ledger arc (docs/active/referral-ledger/00-spec.md, Phase 2). Turns the legacy file-level referral columns into `Referral` rows: buyer-broker → `buyer_broker` on the active round; onward-broker → `onward_broker` (file-level); solicitor → `buyer_solicitor`/`seller_solicitor` with the side INFERRED by matching `referredFirmId` to the file's purchaser/vendor solicitor (genuine no-match defaults to `seller_solicitor` and is flagged in `notes` for manual classification). Idempotent (skips a transaction+kind that already has a row). Staging-only unless `ALLOW_PROD=1`. Ran on staging 2026-09-28: 21 files → 23 rows (16 buyer_broker, 3 onward_broker, 4 seller_solicitor, 0 flagged).
- **Lifetime:** one-shot (throwaway).
- **Author/date:** Claude, 2026-09-28.
- **Deletion criteria:** delete this script + this entry once run on prod (post-deploy) and confirmed.

### seed-emily-chen-referral.ts
- **Purpose:** one-off STAGING demo seed for the referral-ledger arc. Creates an on-hold self-managed file (buyer "Emily Chen") with a £450 broker referral that is EARNED (PM5 complete), attached to the busiest non-internal agency's agent, so the founder can see the "Add new buyer" reassurance note and the preserved referral in the archived-sale drawer in practice. Idempotent (skips if the demo address already exists). Refuses PROD. Run via the demo:seed-style ts-node invocation.
- **Lifetime:** one-shot (throwaway, staging demo).
- **Author/date:** Claude, 2026-09-28.
- **Deletion criteria:** delete this script + this entry once the referral-ledger demo has been reviewed and the seeded staging file is no longer needed.

### seed-progression-tsp.ts
- **Purpose:** seed progression business #1 (The Sales Progressor, the platform operator) — the single `ProgressionBusiness` row with `isTsp = true`. It is the fallback identity for every transaction whose `progressionBusinessId` is null (docs/active/progression-businesses/, Phase 1; see lib/progression/business.ts). Needed on staging/local because those sync the schema via `prisma db push`, which skips the Phase 1 migration's INSERT; production gets the row from the migration. Idempotent (skips if an `isTsp` row already exists). Safe against any environment.
- **Lifetime:** ongoing (permanent — the row is required wherever the app runs; the script is the staging/local seeding path and stays alongside the migration).
- **Author/date:** Claude, 2026-09-30.
- **Deletion criteria:** permanent while the progression-business model exists; remove only if the model is retired.
- **Justification:** one-time environment bootstrap of a required singleton that db-push cannot create (raw-migration INSERT is skipped on staging/local); not a feature/admin action because it seeds infrastructure state, and it mirrors the migration + `prisma/seed.ts`.

### seed-progression-pilot.ts
- **Purpose:** staging/local pilot seed for the progression-businesses feature (docs/active/progression-businesses/, Phase 4). Creates "Sarah's Progression Co" + an owner login (sarah@sarahprogression.co.uk) so the founder can log in as a progression-business owner and proof-see the /agent/clients screen. Idempotent (skip/update by natural key). Refuses production.
- **Lifetime:** one-shot (throwaway, pilot proof-see data).
- **Author/date:** Claude, 2026-09-30.
- **Deletion criteria:** delete this script + this entry once the real pilot progression business is onboarded and the seeded test data is no longer needed.
- **Justification:** disposable demo/proof-see data for a not-yet-self-serve onboarding path; belongs in a seed script, not a feature, until self-serve business onboarding exists.

### seed-progression-fixture.ts
- **Purpose:** deterministic isolation fixture for the progression-businesses feature (docs/active/progression-businesses/, Phase 8). Builds the 3-business / 7-transaction matrix (Sarah + Other businesses, Donna/James/Unrelated/Other agencies, their users, and 7 tagged " - PBFIX" transactions) so the isolation rules can be walked manually and by e2e/progression-isolation.spec.ts. Idempotent (natural keys). Refuses production.
- **Lifetime:** one-shot (throwaway, staging/local isolation testing).
- **Author/date:** Claude, 2026-09-30.
- **Deletion criteria:** delete this script + this entry once the progression-businesses isolation testing is settled and the seeded fixture data is no longer needed on staging.
- **Justification:** disposable multi-entity test data that backs an e2e spec; belongs in a seed script (Law 20 keeps fabricated names in seeds), not a feature or a unit test.

### provision-form-tenant.ts
- **Purpose:** provision (or reset credentials for) a Boardwalk Forms tenant + owner account (`FormTenant` / `FormTenantUser`) with a one-time temporary password, printed once and stored only as a bcrypt hash; the account is flagged `mustChangePassword` so the user chooses their own password on first sign-in at /boardwalk. Refuses the prod project id unless `PROVISION_ON_PROD=yes`.
- **Lifetime:** ongoing (permanent — the provisioning path for every new form-platform tenant until self-serve onboarding exists).
- **Author/date:** Claude, 2026-10-12.
- **Deletion criteria:** permanent while the Boardwalk Forms platform exists without self-serve tenant onboarding; fold into an admin action if/when the platform gets a Command Centre onboarding surface.
- **Justification:** credentials bootstrap requires a human-run, secret-printing step that must not be a web endpoint; there is no admin surface for form tenants yet, and a feature would be premature for a single tenant.

### seed-boardwalk-demo.ts
- **Purpose:** PRODUCTION demo seed for the 2026-10-15 research demo with Boardwalk Property Co (Bristol estate agency). Creates the agency "Boardwalk Property Co" white-labelled to their real brand (charcoal #404648 app accent via agentPreferences.brandColor, charcoal/stone client-email emailTheme, their wordmark logo incl. B-Corp badge uploaded to the agency-logos bucket), a director login (millie@boardwalkpropertyco.com / "password"), and 6 fictional Bristol transactions across the pipeline (one with a paused portal contact on ellisaskey+boardwalk@googlemail.com). Engineered for TOTAL email silence — welcomeEmailSentAt + retentionEmailOptOut + all notifications off on the director; contact/file chase paused; no OutboundEmailQueue rows; nothing flagged isDemo (so demo-cleanup can't delete it). Guard REFUSES any non-prod DATABASE_URL; connects via DIRECT_URL. Idempotent + self-healing (repairs a partially-written file). `--dry-run` and `--verify` modes.
- **Lifetime:** one-shot (throwaway demo data on production).
- **Author/date:** Claude, 2026-10-14.
- **Deletion criteria:** delete this script + this entry AND remove the seeded prod account (agency cmv8n3aj20000g1h3hzetvaj2 + Millie + the 6 files + the logo object) once the Boardwalk demo is done and the account is no longer needed, OR once Boardwalk becomes a real self-serve signup.
- **Justification:** disposable, fabricated demo data for a single sales call that must be white-labelled and completely silent; belongs in a guarded one-shot seed, not a feature or admin action.

### enrich-boardwalk-demo.ts
- **Purpose:** flesh out the Boardwalk prod demo files (run after seed-boardwalk-demo.ts): property photos (Boardwalk's own listing exteriors) as portal heroes, fake vendor/purchaser contacts (every email a +boardwalk variation of ellisaskey@googlemail.com, every contact chase-paused), vendor/purchaser solicitors, realistic activity threads (OutboundMessage, status "sent" = historical, no send), varied milestone confirmers, checkpoints, and to-dos — scaled to each file's stage. Switches the agency's solicitor/enquiry/weekly chase streams OFF for silence. PROD-only guard; DIRECT_URL; idempotent.
- **Lifetime:** one-shot (throwaway demo data on production).
- **Author/date:** Claude, 2026-10-14.
- **Deletion criteria:** delete with seed-boardwalk-demo.ts and the seeded account after the demo.
- **Justification:** demo-dressing for a single sales call; one-shot seed, not a feature.

### fix-boardwalk-milestones.ts
- **Purpose:** set each Boardwalk prod demo file to its TRUE stage so the milestone progress (stepper + % + hub bucket) matches the activity narrative, and fill tenure + purchase type. Re-initialises each file's milestones for its tenure/method (inline replica of initializeMilestoneCompletions, to avoid the server-only import chain) and completes the right steps with spread dates + varied confirmers (agent / solicitor / client-via-portal). Writes only MilestoneCompletion + tx tenure/purchaseType/status. PROD-only guard; DIRECT_URL; idempotent.
- **Lifetime:** one-shot (throwaway demo data on production).
- **Author/date:** Claude, 2026-10-14.
- **Deletion criteria:** delete with seed-boardwalk-demo.ts and the seeded account after the demo.
- **Justification:** corrects demo stage data for a single sales call; one-shot seed, not a feature.

### enrich-boardwalk-fees.ts
- **Purpose:** add the "well-run operation" layer to the Boardwalk prod demo: agency commission on every file (agentFeePercent + VAT), a recommended-solicitor panel (AgencyRecommendedSolicitor, 4 fictional Bristol firms with default referral fees), per-file solicitor referral income (referredFirmId + referralFee, received on exchanged/completed, pending otherwise), and a mortgage broker (BrokerFirm + BrokerContact, +boardwalk email) with a broker referral fee on every file. Populates the file Fees card (commission + referrals + net income + VAT). PROD-only guard; DIRECT_URL; idempotent. No emails.
- **Lifetime:** one-shot (throwaway demo data on production).
- **Author/date:** Claude, 2026-10-15.
- **Deletion criteria:** delete with the other boardwalk-demo scripts; data is removed by delete-boardwalk-demo.ts.
- **Justification:** demo-dressing for a single sales call; one-shot seed, not a feature.

### enrich-boardwalk-chains.ts
- **Purpose:** populate the Chains workspace for the Boardwalk prod demo — 2 chains (Chandos, Cotham) each with a neighbour link above + below (unclaimed stubs = other Bristol agents) so files land in "In chains", the stubs show as "Check-ins", Chandos (ready to exchange) shows in "Push to exchange", Fernbank is marked not-buying-onward + first-time buyer + confirmed into "No chain", and Bedminster + Ashton stay in "Needs chain setup". SILENT: all stub agent emails are +boardwalk variations of ellisaskey@ and all stub links are inviteStatus NOT_SENT (never touched by the invite nudge/reminder crons). PROD-only guard; DIRECT_URL; idempotent.
- **Lifetime:** one-shot (throwaway demo data on production).
- **Author/date:** Claude, 2026-10-15.
- **Deletion criteria:** delete with the other boardwalk-demo scripts; data removed by delete-boardwalk-demo.ts (chains cleanup added).
- **Justification:** demo-dressing for a single sales call; one-shot seed, not a feature.

### enrich-boardwalk-team.ts
- **Purpose:** give the Boardwalk prod demo a team so the analytics leaderboard compares agents, and put sales on the enquiries tracker. Creates 2 negotiators (Tom Hartley, Sophie Clarke, silenced like Millie), a per-agent 2026 book of business (completed+exchanged files with varied timeframes + a few withdrawn, so the leaderboard shows Submitted/Exchanged/Conversion/Pipeline/Avg fee and avg-days-to-exchange differs), and 2 EnquiryTracker rows (Cotham = awaiting pack, Ashton = partial replies). Historical files are completed/withdrawn only, so they never clutter the active pipeline/hub/chains boards. Exchanged = VM19 milestone complete. PROD-only guard; DIRECT_URL; idempotent; no emails.
- **Lifetime:** one-shot (throwaway demo data on production).
- **Author/date:** Claude, 2026-10-15.
- **Deletion criteria:** delete with the other boardwalk-demo scripts; data removed by delete-boardwalk-demo.ts (users now deleted by agencyId).
- **Justification:** demo-dressing for a single sales call; one-shot seed, not a feature.

### delete-boardwalk-demo.ts
- **Purpose:** complete TEARDOWN for the Boardwalk prod demo. Removes the agency, the director (millie@boardwalkpropertyco.com), all 6 files and every child row (milestones, contacts, comms, checkpoints, to-dos, plus any reminder/chase/file-time rows the crons added), the fictional solicitor firms, and the uploaded logo + property photos from storage. SAFE BY DEFAULT (dry-run / counts); pass `--confirm` to delete. PROD-only guard; DIRECT_URL; generic over all transaction-FK child models (two-pass, FK-order-safe).
- **Lifetime:** one-shot (the wipe button for the demo).
- **Author/date:** Claude, 2026-10-15.
- **Deletion criteria:** delete this script together with the other four boardwalk-demo scripts once the demo account has been torn down and is no longer needed.
- **Justification:** the demo is throwaway prod data that must be cleanly removable in one command; a guarded one-shot teardown, not a feature.

### convert-chase-timings-to-working-days.ts
- **Purpose:** one-time conversion of every chase timing value from calendar days to working days (critique #281 step 3, founder-approved table 2026-10-20): all ReminderRule grace/repeat values, agency + business override rows, and every per-file chaseRuleSnapshot JSON. Dry-run by default (prints full before→after table); `--confirm` to apply; `--restore <backup>` replays the timestamped JSON backup it writes before any change. Double-run guarded by an inactive marker ReminderRule row.
- **Lifetime:** one-shot (staging first, then production; keep until both conversions are verified).
- **Author/date:** Claude, 2026-10-20.
- **Deletion criteria:** delete together with diff-reminder-due-dates.ts once the production conversion has run clean and two cron mornings have been verified. Keep the backups directory contents until then.
- **Justification:** a data migration coupled to a code-semantics change; must be reversible and rehearsable, which rules out a plain Prisma migration.

### diff-reminder-due-dates.ts
- **Purpose:** rehearsal harness for the working-days conversion. `--snapshot <file>` captures every active reminder's due date; `--run-engine` executes the real reminder engine (same code path as the cron); `--diff <file>` prints per-reminder before→after deltas worst-first with a summary. Produces the founder-reviewed evidence that the conversion moved nothing unexpectedly.
- **Lifetime:** one-shot (used for the staging rehearsal and the production verification).
- **Author/date:** Claude, 2026-10-20.
- **Deletion criteria:** delete together with convert-chase-timings-to-working-days.ts once production is verified.
- **Justification:** the founder-gated safety check for a live-engine change; read-only apart from the deliberate engine run.
