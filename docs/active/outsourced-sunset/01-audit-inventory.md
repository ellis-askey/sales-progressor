# Outsourced sunset — audit inventory (Week 1)

**Status:** complete (6 of 6 mappers in, 2026-11-12). The classified map of every
"outsourced" surface. See `00-decision-and-plan.md` for the decision + plan.
Nothing shipped — this is the Week-1 map. Weeks 2+ build against it.

**Classification tags:**
- **GATE** — agent-facing intake / outsourced marketing the master switch must hide when OFF.
- **KEEP** — internal servicing of EXISTING outsourced files; stays live to ~Feb.
- **DATA** — the model / determination logic (stays; intake gated).
- **BILLING** — pricing/charging tied to outsourced.
- **COPY** — user-facing strings mentioning outsourced / TSP-progression.
- **FLAG/DOC** — feature flags/env; docs to update.

> **Terminology trap flagged by the audit:** `inHouseProgressionEnabled` /
> `isInHouseProgressor` (Boardwalk's self-managed second-owner pool) is a DIFFERENT
> concept from outsourcing-to-TSP. Do not conflate the two when gating.

---

## §1 — Data model & "what counts as outsourced" (mapper 1 ✓)

### Enums (prisma/schema.prisma)
- `710-713` — DATA — `enum ServiceType { self_managed, outsourced }` — THE core discriminator.
- `233-237` — DATA — `enum AgencyModeProfile { self_progressed, progressor_managed, mixed }` — agency rollup; drives CC segmentation + intake defaults.
- `715-718` — DATA — `enum ProgressedBy { progressor, agent }` — intake choice; `progressor`→outsourced, `agent`→self_managed.
- `460-463` — DATA — `enum ProgressionBusinessRole { owner, progressor }`.
- `5700-5705` — BILLING — `enum InvoiceLineKind { in_house_fee, outsourced_fee, credit_applied, intro_credit }`.
- `5708-5712` — BILLING — `enum FreeReason { permanent_free_self, first_outsourced_free, legacy_trial }`.

### Agency model
- `19-20` — DATA — `modeProfile` + `modeProfileComputedAt` (nightly recompute).
- `30` — DATA — `inHouseProgressionEnabled` — **Boardwalk in-house pool, NOT TSP outsourcing (don't conflate)**.
- `165` — COPY — `signupTier String? // "self" | "outsourced"` — marketing attribution to re-point.
- `82-86` — GATE — `autoInviteClientsOnAdd` — gates "adding an outsourced sale emails buyer+seller the intro".
- `191-192` — BILLING — `feeTier` + `legacyOutsourcedFeePence` (overrides £250/£300/£350 scale).
- `201` — BILLING — `firstOutsourcedFreeEligible` — first-outsourced-free giveaway.
- `225-229` — KEEP/DATA — chaseRuleOverrides (self-managed only); progressionBusinessClients link; `@@index([modeProfile])`.

### ProgressionBusiness & links
- `246-362` — DATA — `model ProgressionBusiness` — **TSP is row #1 (`isTsp`); external businesses are ordinary rows**.
- `256` — DATA — `isTsp Boolean` — fallback identity for null-`progressionBusinessId` (TSP) files.
- `376-421` — DATA — `ProgressionBusinessClient` (business↔agency client link, management only).
- `434-453` — DATA — `ProgressionConnectionRequest` — progressor→agency connect requests (**marketplace/intro plumbing already exists**).
- `2395-2414` — KEEP — per-business chase override.
- `4081-4111` / `4157-4174` — DATA — milestone-copy + email-template layers keyed by `progressionBusinessId`.

### User model
- `496-497` — DATA — `progressionBusinessId` + `progressionBusinessRole` — external-business access key (null for agency staff AND TSP internal).
- `513` — DATA — `canViewAllFiles` (business see-all grant).
- `518` — DATA — `isInHouseProgressor` — Boardwalk pool (self-managed), not TSP outsourcing.
- `556` — DATA — `assignedTransactions @relation("AssignedUser")` — the TSP progressor's book.

### PropertyTransaction model
- `758` — DATA — `serviceType @default(self_managed)` — per-file truth.
- `757` — DATA — `progressedBy @default(progressor)`.
- `756` — DATA — `progressionBusinessId` — access boundary; null = TSP (no legacy backfill).
- `735` — DATA — `assignedUserId` — individual TSP progressor; internal-servicing key.
- `763` — DATA/KEEP — `outsourcedAt` — SP unassigned-waiting clock.
- `1138` — BILLING — `serviceTypeAtExchange` — frozen fee basis at exchange.
- `1145,1153` — BILLING — `freeReason`, `firstOutsourcedFree`.
- `1230,1236,1240` — DATA — indexes `[serviceType,createdAt]`, `[assignedUserId,status]`, `[progressionBusinessId,status]`.

### Access scope (lib/security/access-scope.ts)
- `19-27` — DATA — `AccessScope` = agency | business | assigned | all | platform.
- `40-42` — GATE/KEEP — `TSP_ONLY_TX_WHERE` (`progressionBusinessId null OR isTsp`) — walls external businesses off TSP lists.
- `46-91` — DATA — `getAccessScope(session)` — scope from role + progressionBusinessId + canViewAllFiles.
- `140-149` — **KEEP (critical)** — "all"/"platform" everyday lists limited to `serviceType:"outsourced" OR assignedUserId=self` — **how internal staff SEE the book they service**.
- `150-230` — KEEP — assigned→assignedUserId; business→progressionBusinessId; the ownership/chase/reminder guards + `canReadTransaction`.

### Determination helpers
- `lib/services/transactions.ts:1121,1230-1231` — **DATA (primary birth of serviceType)** — `progressedBy==="agent" ? self_managed : outsourced`.
- `lib/services/transactions.ts:1237,1241,1219,1225,1136-1170` — BILLING/DATA/GATE — freeReason, outsourcedAt, progressionBusinessId + £5/sale accrual, isTspBusiness payment-block, `shouldHoldAgentIntake`.
- `lib/services/transactions.ts:47-91,571-737,852` — KEEP — list/forecast/hub queries force `serviceType:"outsourced"` for internal scope.
- `lib/agency/default-progressed-by.ts:16-37` — GATE — `deriveDefaultProgressedBy` — intake default toggle + hard-coded `LEGACY_PROGRESSOR_AGENCIES`.
- `lib/agent/outsourcing.ts:10-18` — GATE — `agencyHasActiveOutsourcedFile` — gates "our team / your progressor" controls.
- `lib/progression/business.ts:22-71` — DATA — `getTspBusiness` / `getProgressionBusinessForTransaction` (null→TSP) / `isTspBusiness`.
- `lib/progression/flags.ts:10-21` — **FLAG** — `progressionBusinessesEnabled()` (`PROGRESSION_BUSINESSES_ENABLED`) + `progressionBillingCollectEnabled()` (`PROGRESSION_BILLING_COLLECT`) — **the dark-ship flag pattern the master switch should mirror**.
- `lib/progression/business-sale-gate.ts`, `outsourcing-mix.ts`, `lib/agent/self-managed-nav.ts:25-46`, `scripts/backfill-mode-profile.ts`, `lib/agent-session.ts:158,190` — GATE/DATA — sale gate, single-direction rule, self-managed nav gate, serviceType→modeProfile mapping, session exposure.

### Intake actions & billing forks
- `app/actions/transactions.ts:129,202,521-529` — **GATE (intake entry)** — `createTransactionAction` resolvedProgressedBy.
- `app/actions/transactions.ts:2862,2932-2934,3020-3022` — DATA — draft create/promote recompute serviceType.
- `app/actions/transactions.ts:1913-2104` — **GATE + KEEP** — `switchServiceTypeAction`: director→outsourced (gate, 1930-31); SPB-owner hand-back (keep); writes at 2085-2104.
- `app/actions/transactions.ts:4796,4815-4926` — KEEP — outsourced-assignment acknowledgement (internal servicing).
- `lib/billing/fee.ts`, `lib/services/billing-trigger.ts:128-189`, `lib/billing/accrual.ts`, `running-total.ts`, `lifetime.ts`, `lib/services/fees.ts`, `lib/services/retention.ts` — BILLING — fee bands, exchange-time fork on `serviceType==="outsourced"` + firstOutsourcedFree, invoice lines, giveaway celebration.
- `components/transactions-v2/NewSaleFlow.tsx:85,163,329-372,548-550` — **GATE (primary intake UI)** — the self-progress/send-to-us toggle.
- `lib/emails/send-outsource-intro.ts`, `outsource-intro-template.ts`, `lib/emails/first-exchange.ts:26-43`, `lib/outreach/voice-guide.ts:44` — COPY/GATE — outsourced client intro + "first outsourced free" + cold-outreach "hand it to us" language.

### ★ Chokepoints the master switch hinges on (mapper 1)
1. **`lib/services/transactions.ts:1230-1231`** (+ `app/actions/transactions.ts:202`, draft paths) — the ONLY place serviceType is born. Gate = force `progressedBy="agent"` / block the outsourced branch here.
2. **`components/transactions-v2/NewSaleFlow.tsx:548-550` + `lib/agency/default-progressed-by.ts`** — the visible intake toggle + default to hide.
3. **`app/actions/transactions.ts:1913-2104` (`switchServiceTypeAction`)** — the other route into outsourced (director flips existing file); gate the →outsourced direction, keep hand-BACK open.
4. **`lib/security/access-scope.ts:140-149`** — the `serviceType:"outsourced" OR assignedUserId=self` that lets internal staff SEE the serviced book. **KEEP** (servicing to Feb).
5. **`lib/services/billing-trigger.ts:128-189`** — exchange-time billing fork; existing outsourced files still bill here during the tail; the new £50/exchange agent model branches off the self_managed path.
6. **`lib/progression/business.ts` (null=TSP) + `lib/progression/flags.ts`** — model the reversible master switch on the existing `PROGRESSION_BUSINESSES_ENABLED` flag pattern; TSP-vs-external is the seam between winding down TSP's book and the external seat model.

### Early signal for the plan
- **The marketplace/intro already has schema plumbing** (`ProgressionConnectionRequest`, `ProgressionBusinessClient`) — Workstream B may be less greenfield than feared.

---

## §2 — Agent-app intake & flows (mapper 2 ✓)

### The 5 agent-app intake chokepoints (what the switch must close)
1. **New-sale "Send to us" toggle** — `components/transactions-v2/SaleHeroEditable.tsx:309-316` (the "Progressed by" chip group), gated by `NewSaleFlow.tsx:1582` `canOutsource={!clientAgencyId && !isProgressorCreate}`. **Primary.** Switch should force `canOutsource=false` for agencies → toggle disappears, file silently stays self-progress. Label to remove = `:314` "Send to us" (TSP).
2. **File-page "Switch to TSP" / "Hand over" pill** — `components/transaction/PropertyHero.tsx:408-469` + `:1008-1016`, enabled by `app/agent/transactions/[id]/layout.tsx:245-246` (`canAgentHandOver = director && serviceType==="self_managed" && active`) → `SwitchServiceTypeModal` (toTSP branch) → `switchServiceTypeAction`. **Secondary** (converts existing self-managed → TSP). Gate the →outsourced direction; KEEP hand-BACK.
3. **Default-to-outsourced routing** — `lib/agency/default-progressed-by.ts:16-37` (`LEGACY_PROGRESSOR_AGENCIES` + `progressor_managed` default to `"progressor"`) + `app/agent/transactions/new/page.tsx:82-101`. Force `"agent"` for new intake; keep legacy servicing agencies until ~Feb.
4. **Onboarding nudges to outsource** — `components/agent/WelcomeModal.tsx:182-186` ("Add it and {progressor} will progress it"), `TourSlides.tsx:9-45` (slides 2 & 4 outsourced framing when `mode==="progressor_managed"`).
5. **First-outsourced-free promotion** — `components/transactions-v2/EarningsBuilder.tsx:178-183` ("Your first sale is on us") + `new/page.tsx:102-114` config.

### Supporting intake UI (GATE/COPY)
- `components/transactions-v2/form/OutsourcedBanner.tsx:13-55` — "{Our team / Your progressor} is handling this sale."
- `components/transactions-v2/NewSaleFlow.tsx:271-293,1502-1504` — `OutsourcedHintCard`; `:1041-1067,1206-1245` outsourced-only submit validation + button text (harmless once toggle hidden; only fires when `isOutsourced`).
- `components/transaction/SwitchServiceTypeModal.tsx:46-99` — toTSP confirm copy (`:92` calls action). `!toTSP` branch = KEEP.
- `app/actions/transactions.ts:122-202` — server backstop: reject new agent→TSP `progressor` create; leave internal/migration/SPB creation working. `:323-357` handover readiness + one-route-per-agency mix guard (KEEP).

### Servicing surfaces shaped by "outsourced" (KEEP — fade naturally as book clears)
- `lib/agent/outsourcing.ts:10-18` (`agencyHasActiveOutsourcedFile`); `components/transactions/segments.ts:15,26,54` ("Outsourced" list lens); `components/transaction/AgentFileSidebar.tsx:301,308,646-664,840-850`; `SidebarPanel.tsx:355,372,401`; `ToDoPanel.tsx:61`; `AgentTodoList.tsx:97-331` ("With your progressor" tab); `lib/agent/self-managed-nav.ts:25-46`; `app/agent/hub/hub-view.tsx:252,287-289`.
- **Not intake:** `components/transactions-v2/MigrateSaleFlow.tsx:50` (Boardwalk self-managed import, not TSP outsourcing — leave).

---

## §3 — Billing & pricing (mapper 3 ✓)

### The three money paths (only path #1 is killed by the pivot)
1. **Agency outsourced per-exchange (THE path the pivot retires):** `lib/services/billing-trigger.ts:177-189` stamps `billedAtExchange` at VM19/PM26 → `lib/billing/accrual.ts` writes `InvoiceLine` via `computeFee` (£250/£300/£350 bands in `lib/billing/fee.ts:25-27`) → `lib/billing/issuance.ts` creates the Stripe invoice (gated by `BILLING_AUTO_ISSUE_ENABLED`). Self-managed already £0 (`fee.ts:21-24,72-76`; `billing-trigger.ts:104`).
2. **External business → TSP (KEEP — the new model, LIVE in prod):** £5/sale stamped at ADD (`transactions.ts:1224-1227`) + £59 base/£39 seat subscription in `lib/progression/business-stripe.ts` (`STRIPE_PRICE_BUSINESS_*`), gated by `PROGRESSION_BILLING_COLLECT`. Constants in `lib/progression/business-billing.ts:18-20`.
3. **Business → its client agency (KEEP, outside TSP):** off-Stripe rate-card PDF (`lib/progression/business-client-invoice.ts` + `client-fees.ts`).

### Fee sources of truth
- `lib/billing/fee.ts:25-29,67-140` — BILLING — outsourced bands + thresholds + `grossFee`/`computeFee`. **No £50-flat concept exists** — that's where the agent £50/exchange lands.
- `lib/services/fees.ts:47-156` — BILLING — `calculateOurFee` / `calculateProgressionFeePence` / `calculateFileFeesPence` (net income math).
- `lib/billing/pricing-version.ts:8` — DATA — `CURRENT_PRICING_VERSION="2026-08_free_self"` stamped per sale. **Bump this on the pivot so in-flight sales keep old pricing.**
- `lib/services/billing-reversal.ts:38-130`, `lib/billing/accrual.ts:39-207`, `running-total.ts:62-173`, `issuance.ts:36-174`, `lifetime.ts:32-81`, `period.ts:40-82` — BILLING — the reversal/accrual/issuance/metrics pipeline reading `serviceType`/`computeFee`. Must KEEP for the servicing tail (existing files still bill).

### The "free" mechanisms (none is an editable allowance)
- `billing-trigger.ts:128-172` — **`firstOutsourcedFree`** — a hard-coded **count-of-1** giveaway (`priorOutsourcedExchanged===0`). Closest existing thing, but not a dial.
- `PropertyTransaction.freeOnExchange` (per-row), `Agency.feeTier="free"` (comped-everything, editable via `saveAgencyFeeAction`), `Agency.firstOutsourcedFreeEligible` (boolean).
- **No stored, CC-editable numeric "N free sales granted" exists → NEW.** Boardwalk's 41 needs this.

### The CC-editable pattern to clone
- `app/actions/agency-fees.ts:9-50` (`saveAgencyFeeAction`) + `components/command/agency-file/AgencyFeeEditor.tsx:18-126` — **the exact template** (superadmin-gated write to an `Agency` column + retroactive sweep) for the new free-sales-allowance editor.

### Stripe plumbing / crons (KEEP)
- `lib/stripe.ts`, `lib/billing/stripe-webhook.ts:48-159` (routes BOTH agency per-exchange + business subscription invoices), `app/api/webhooks/stripe/route.ts`, setup-intent routes, `app/api/cron/{issue-invoices,accrue-invoices,business-billing,check-failed-payments}/route.ts`, `lib/billing/{acknowledgement,payment-block,payment-method-state}.ts`.
- `lib/progression/{business-dunning,business-sale-gate,card-nudge}.ts` — external-business payment states (KEEP).

### Agent-facing pricing PRESENTATION (GATE — changes materially under the pivot)
- `app/(account)/agent/account/billing/page.tsx:19-30,65-70,101-109,236,278-279` — the director billing page showing the £250/£300/£350 story + running outsourced count.
- `components/billing/v2/PlanTermsCollapsed.tsx:70-93` — hard-codes "£250 / £300 / £350 by band" + "First sale free".
- `components/billing/v2/MetricsStrip.tsx:103-130` — "outsourced exchange(s)" / "given free" cards.
- `app/agent/transactions/new/page.tsx:86,107-114,315-317` — `withinTrial` "your next outsourced sale is free" presentation.
- `components/billing/{TrialExpiredModal,PaymentMethodNudge}.tsx` — trial largely retired; verify copy.
- `app/billing-terms/page.tsx` + `lib/billing/terms-sections.ts:78-108` — public billing terms ("free self-progress + free first outsourced"). **New TermsVersion + acknowledgement copy required (Christmas).**

### NEW to build vs already exists
- **NEW:** (1) £50 flat agent per-exchange fee in `fee.ts`; (2) retire/short-circuit the agency outsourced bill path (`billing-trigger.ts:177-189` + accrual/issuance) so TSP stops charging agencies; (3) per-agency editable numeric **free-sales allowance** (new `Agency` column + consumption counter in `billing-trigger.ts` + CC editor cloned from `AgencyFeeEditor`); (4) reversible master switch env flag; (5) new `TermsVersion` + `pricing-version.ts` bump.
- **REUSABLE:** the whole £59/£39/£5 business seat model (LIVE); `computeFee`+VAT split; the `pricingVersion` stamp; the flag pattern; the `saveAgencyFeeAction`+`AgencyFeeEditor` template.

---

## §4 — Portal & client-facing (mapper 4 ✓)

**Headline:** the portal is already white-labelled to the **agency** everywhere — buyer/seller/solicitor never see "The Sales Progressor" as a brand. The outsourced branch only flips presentation details, almost all **KEEP-until-Feb** (existing serviced files still render their progressor). The one true client-facing GATE is the creation-time intro email.

### Core resolver (`lib/services/portal.ts`)
- `:742` — KEEP — `isOutsourced = tx.serviceType !== "self_managed"` — master branch for the Team card.
- `:746,772` — KEEP/COPY — named person = assigned progressor; `roleLabel: isOutsourced||cm ? "Your progressor" : "Your agent"`. New self-managed intake already reads "Your agent".
- `:764,773` — KEEP — `whatsappUrl` only on outsourced (from progression business; null→TSP `+447508862929`).
- `:655-689` — KEEP — `resolveManagingEmail` routes outsourced "Email your progressor"/solicitor-CC through the white-label ladder.
- `:891-914` — KEEP — vCard: org always = agency ("progression business stays behind the scenes").
- `components/portal/PortalTeamCard.tsx:207-232` renders the above (no literal serviceType — branching is upstream).

### TSP broker fallback (GATE — a TSP-monetised placement)
- `lib/services/broker-card.ts:6-11,38-59` — GATE — on `serviceType!=="self_managed"` AND `isTspBusiness`, buyer shown **TSP's own default mortgage broker**; referral routes to TSP. Agent-set brokers unaffected. Candidate to hide once TSP stops taking referrals.
- `components/portal/PortalBrokerCard.tsx:352-362` — the suppressed "Recommended by {agency}" line for the `tsp` source.

### Client-email sender/branding (KEEP-until-Feb)
- `lib/email/agency-sender.ts:141-256` — `serviceType==="outsourced"` branch splits TSP-run vs external-business ladder; display name always "{progressor} at {Agency}". `:28-33` `SP_FROM/REPLY_TO/NOREPLY` = `updates@`/`noreply@thesalesprogressor.co.uk` (deliverability fallback only — the only TSP-domain leak).
- `lib/progression/sender.ts:32-196` + `identity.ts:39-115` — white-label ladder + `TSP_IDENTITY` (orgName "The Sales Progressor", WhatsApp, `ellis@`/`updates@`). Outsourced-only; KEEP for serviced files.
- `lib/services/progressing-team.ts:21-32` — `isSameProgressingTeam` (both-outsourced → onward-portal mirror). KEEP.

### The one creation-time client GATE
- `lib/emails/send-outsource-intro.ts:1-316` — GATE — "Getting your sale moving" intro to buyer+seller, fires only on outsourced creation (`:138` early-return; `:147` skips migrated). Stop firing when new outsourced creation is gated; existing files already received it (one-send guard → safe).

### Solicitor / advisor portals
- `app/s/[token]/PointOfContactCard.tsx:68` — "Progressing this sale · {agencyName}" (white-labelled); `(portal)/page.tsx:83,88`; `actions.ts:23-27,239` notify progressor (KEEP). `app/a/[token]/actions.ts:18` notify progressor (KEEP).

### Generic "your sales progressor" product copy (NOT serviceType-branched — product-naming, low priority)
- `PortalWelcomeSheet.tsx:80`, `PortalInformationTab.tsx:87-88,309-312`, `PortalMessageCompose.tsx:35`, `PortalMenuDrawer.tsx:931-939`, `app/portal/not-found.tsx:11`, `app/portal/[token]/error.tsx:33`, `app/api/portal/calendar-export/[token]/route.ts:60,69,82` (`.ics` PRODID carries TSP brand on ALL files).
- `lib/services/client-weekly-update.ts:39-97` — KEEP — per-file weekly-update gating (external business's own toggle).

---

## §5 — Command Centre (mapper 5 ✓)

**Headline:** the CC has **no outsourced-intake surface, no progressor-pool assignment, no "market outsourcing" CTA.** `modeProfile`/`serviceType` are **read everywhere, written nowhere** (except the fee editor). So this slice is **almost entirely KEEP** (servicing/reporting/billing the existing book). The gating mechanism is NOT located here. ("Claim/reconciliation" in the CC = chain-invite claims + content-AI, not outsourced-file claims.)

### KEEP — scope/reporting/servicing
- `lib/command/scope.ts:24-57` (`serviceTypeScope`/`modeProfileScope`/`cohortModeFilter` — the SP/PM/All toggle, read-side).
- `lib/command/files.ts:26-266` (outsourced-file servicing list + photo queue); `lib/command/agency-file.ts:56-500` (live sales, chase health, reachability, email log, `legacyOutsourcedFeePence`).
- `lib/command/revenue.ts:38-1043` (banked/pipeline by serviceType, `outsourced_fee` lines) — billing the book to Feb.
- Pages: `overview/page.tsx:234-268` (self/tsp/biz populations), `agencies/page.tsx:105-477` (Self/TSP/Mixed column), `agency/[agencyId]/page.tsx:66-293` (`AgencyFeeEditor`), `files/page.tsx:113-382` ("Outsourced" filter), `revenue/*`, `activity|activation|growth` (PM cohorts), `email-senders/page.tsx`.
- `components/command/CommandSidebar.tsx:64-213` (nav + SP/PM/All toggle), `AgencyControlsMatrix`/`AgencyFeeEditor`/`AgencyDataControls`, `ReadinessDetail`.
- **`proposals/page.tsx:7-171`** — the AI shadow-agent review inbox (confirm/reconcile on files TSP progresses) — the closest thing to active TSP-progression tooling; KEEP to service the book.

### KEEP — but SEPARATE product line (flag for the founder, see Decisions)
- `lib/command/businesses.ts`, `trials.ts`, `trial-cockpit.ts` + `businesses/*` + `trials/[slug]/page.tsx` + `ManagedByTag`/`StatusPill`/`trials/*` tabs — the **external-business platform** (Boardwalk etc.). This is the model the pivot KEEPS and GROWS, not what's being sunset.

### COPY (internal superadmin text; optional post-sunset tidy, low priority)
- `agencies/page.tsx:448-451` InfoTip "TSP (our team, outsourced)"; `overview/page.tsx:245` "TSP — our team · outsourced sales we progress"; `agency/[agencyId]/page.tsx:265-269` "Progressor-managed". Can stay while the book is serviced.

---

## §6 — Copy / emails / flags / docs (mapper 6 ✓)

### A. Public marketing / intake (the literal "submit to TSP" front door — GATE)
- `app/outsource/page.tsx:1-75` — the cold-email landing ("We'll progress your sales", "£250 to £350 per sale", "Hand us your first file") + metadata.
- `app/outsource/OutsourceIntakeForm.tsx:39-50` + `app/outsource/actions.ts` (`submitOutsourceLead`) — lead-capture form + plumbing.
- `middleware.ts:174,199-200,255,267` — `/outsource` + `outsourced-terms` in the public/agent allow-lists.

### B. Welcome / retention email copy (highest reach — fires on every signup)
- `lib/emails/retention/index.ts:276-284,331-333,478-486` — **"Your first outsourced sale is on us / Let our team run it for you"** in `buildActivationDay1` + `buildSaleConnected`. `:9` `send_to_us_drop_21d` re-engagement. `:353-432` `buildProgressionWelcome` = KEEP (new model).
- `lib/emails/send-welcome.ts:19,55` — fires `buildActivationDay1` to every new agent.
- `lib/emails/send-outsource-intro.ts` + `outsource-intro-template.ts` — the client intro (see §4; gate for new intake, keep for servicing).

### C. Onboarding modals / tour (COPY)
- `components/agent/WelcomeModal.tsx:158-209`, `SelfManagedWelcomeModal.tsx:228-236`, `TourSlides.tsx:13-40`. `ProgressorWelcomeModal.tsx` = KEEP (external owner).

### D. New-sale service-type toggle copy (GATE — the in-app intake, overlaps §2)
- `Stage1Fields.tsx:140-151` ("Send to us / Our team takes it from here"), `SaleHeroEditable.tsx:313-314`, `OutsourcedBanner.tsx:18-52`, `NewSaleFlow.tsx:271-293,550,1017-1067`, `EarningsBuilder.tsx:116-131,178-183`, `SwitchServiceTypeModal.tsx:62-81`, `app/agent/transactions/new/page.tsx:73-98`.

### E. Settings / billing / account copy
- `app/(account)/agent/account/billing/page.tsx:69,204,266,269` — **"You'll only need to add a card if you choose to send a sale to TSP's own progression team."** (explicit paid-TSP promise). `billing-hub-v2/page.tsx:108`.
- `account/emails/page.tsx:71-72`, `account/chasing/page.tsx:45` — "a progression company uses their wording/settings instead."
- `app/agent/transactions/(list)/page.tsx:89-96` ("Send a note to our team"), `AgentTodoList.tsx:266,320,688`.
- `app/register/RegisterForm.tsx:44,71-73,354-361,390-523` — progression-business "side door" signup (KEEP — external path).

### F. Flags / ENV the master switch must coordinate with
- `lib/progression/flags.ts:10-21` — `PROGRESSION_BUSINESSES_ENABLED` + `PROGRESSION_BILLING_COLLECT` (**both ON in prod; KEEP** — external is the new model). **The new master switch is a NEW, separate gate — do NOT reuse/flip these.** No such flag exists in code yet (only the plan doc describes it).
- `lib/agency-features/migrate-sale.ts:20-36` — `MIGRATE_SALE_AGENCY_IDS` allowlist (Boardwalk) — precedent for an env-driven, agency-scoped, revert-by-flag gate.
- `BILLING_AUTO_ISSUE_ENABLED` (`app/api/cron/issue-invoices/route.ts:26`) — gates whether agencies are charged at all; the £50/exchange collection interacts here.
- `STRIPE_PRICE_BUSINESS_*` (business price IDs, KEEP).
- Per-agency DATA fields `Agency.{feeTier,legacyOutsourcedFeePence,firstOutsourcedFreeEligible}` — where the CC-editable free-sales allowance belongs.
- `lib/agent/outsourcing.ts` — the switch must NOT suppress this (drives servicing-era UI).

### G. Docs that go stale (highest first)
1. **`docs/PRODUCT_TRUTH.md`** §1/§2 (pricing — no £50/exchange yet), §6 (flag table), §9 (business types) — top priority ("read first").
2. **`app/outsourced-terms/page.tsx`** + **`app/billing-terms/page.tsx`** + `lib/billing/terms-sections.ts` — legal terms for the retiring model (**Christmas hard deadline**). `provider-terms`/`progression-business-terms` = KEEP (new model).
3. **`market-position/artifact.html`** + `data/market-data.js` — positioning collateral on the outsourced model.
4. `docs/active/progression-businesses/*`, `docs/active/in-house-progression/00-spec.md` — new-model specs; keep but cross-reference the pivot.
5. Historical: `docs/done/package-d/scope.md`, `docs/audits/full-audit-2026-10/*`, `PRODUCT_INVENTORY_2026-10-03.md` — mark pre-pivot.

---

## SYNTHESIS

### GATE master-list — what the master switch wraps (flag OFF hides; flag ON = byte-identical to today)

**Server determination (the spine — gate here and the rest follows):**
- `lib/services/transactions.ts:1230-1231` — the birth of `serviceType`. When gated, force `progressedBy="agent"` for agency intake (never block internal/migration/SPB creation).
- `app/actions/transactions.ts:122-202` (`createTransactionAction`) + draft paths `2862,2932-2934,3020-3022` — server backstop.
- `app/actions/transactions.ts:1913-2062` (`switchServiceTypeAction`, agent→TSP direction only; `:1930-1931`).
- `lib/agency/default-progressed-by.ts:16-37` — force `"agent"` default (keep legacy servicing agencies until ~Feb).

**Agent-app intake UI:**
- `SaleHeroEditable.tsx:309-316` toggle (via `NewSaleFlow.tsx:1582` `canOutsource`); `OutsourcedBanner.tsx`; `OutsourcedHintCard`; `EarningsBuilder.tsx:178-183` ("first sale on us").
- `PropertyHero.tsx:408-469,1008-1016` + `layout.tsx:245-246` "Switch to TSP"/"Hand over" pill; `SwitchServiceTypeModal.tsx:46-99` toTSP branch.
- Onboarding: `WelcomeModal.tsx:182-186`, `TourSlides.tsx:9-45` outsourced slides.

**Public marketing + copy:**
- `app/outsource/*` (landing + form + action) + `middleware.ts` allow-lists.
- Welcome/retention emails: `retention/index.ts:276-284,331-333,478-486`, `send-welcome.ts`.
- `send-outsource-intro.ts` (new sends only).
- Billing presentation: `billing/page.tsx` (esp. `:269`), `PlanTermsCollapsed.tsx:70-93`, `MetricsStrip.tsx:103-130`, `new/page.tsx` `withinTrial`.

**Monetised placement:**
- `lib/services/broker-card.ts:38-59` TSP default broker on TSP-outsourced files.

### KEEP master-list — stays fully live for servicing the existing book to ~Feb
- Access scope `lib/security/access-scope.ts:140-230` (the `serviceType:"outsourced" OR assignedUserId=self` that lets staff SEE the book).
- The whole billing read/accrual/issuance/reversal pipeline (existing outsourced files still bill at exchange).
- Portal presentation (`portal.ts` Team card, sender ladder, WhatsApp, vCard, onward mirror).
- The entire Command Centre slice (reporting, files, agency-file, revenue, **proposals review inbox**, fee editor).
- `lib/agent/outsourcing.ts` + all `hasOutsourced`-gated servicing UI (fades naturally as files close).
- The external-business platform (`businesses`/`trials`/seat billing) — KEEP **and grow** (the new model).
- Hand-BACK direction of `switchServiceTypeAction` (SPB owner → agency).

### Flags/env the switch coordinates with (but does NOT reuse)
- NEW: one superadmin-flippable server flag, mirroring the `=== "true"` env pattern of `lib/progression/flags.ts`. Default ON (today's behaviour). Website/terms = separate Vercel deploy, aligned manually.
- Coexists with: `PROGRESSION_BUSINESSES_ENABLED`, `PROGRESSION_BILLING_COLLECT` (stay ON), `BILLING_AUTO_ISSUE_ENABLED`, `MIGRATE_SALE_AGENCY_IDS`.

### Docs to update on flip
`PRODUCT_TRUTH.md` (§1/§2/§6/§9) · `outsourced-terms` + `billing-terms` + `terms-sections.ts` (Christmas) · `market-position/*` · cross-reference `progression-businesses/*`; mark `package-d` + 2026-10 audits historical.

### NEW-to-build (confirmed by the audit — nothing of this exists yet)
1. The reversible master switch flag + gating wire-up at the chokepoints above.
2. £50 flat agent per-exchange fee (`fee.ts`) + retire the agency outsourced bill path.
3. Per-agency **editable numeric free-sales allowance** (`Agency` column + consumption counter in `billing-trigger.ts` + CC editor cloned from `saveAgencyFeeAction`/`AgencyFeeEditor`). Boardwalk = 41.
4. New `TermsVersion` + `pricing-version.ts` bump.
5. Marketplace/intro (Workstream B) — plumbing partly exists (`ProgressionConnectionRequest`, `ProgressionBusinessClient`).

---

## ★ Decisions — RESOLVED by founder 2026-11-12

1. **£50/exchange — FLAT and UNIVERSAL.** Every agent exchange = £50, no tiers, no
   bands, no automatic free. **Build impact:** change the self_managed £0 hard-coding
   (`fee.ts:21-24,72-76`, `billing-trigger.ts:104`) to a flat £50 on the go-forward
   model (bump `pricing-version.ts` so in-flight sales keep their stamped price). The
   £250–£350 outsourced bands are **gated off, not deleted**; the **existing outsourced
   tail keeps billing at current rates until the book is cleared (~Feb).** New intake
   never reaches the bands.
2. **External-business / trials platform — OUT of scope. Keep and grow.** TSP's own
   done-for-you service is what's sunset. Forward idea (Workstream B, not Week 2): give
   external businesses useful TSP plumbing — e.g. the "sale added" holding email
   (`send-outsource-intro.ts`).
3. **Broker fallback — keep current rules.** Agency's own broker if set, else
   recommended TSP (`broker-card.ts:38-59` stays as-is through the servicing tail).
   New-year focus shifts to provider/surveyor/mortgage referrals.
4. **Free sales = manual per-sale grant** (reuse `PropertyTransaction.freeOnExchange`
   via a CC "mark this exchange free" control; optional bulk helper for Boardwalk's 41)
   — **not** a numeric per-agency allowance. No new core schema needed for the grant.
