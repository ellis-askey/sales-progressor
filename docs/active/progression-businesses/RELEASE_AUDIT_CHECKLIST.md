# External Sales-Progression Business — Release Audit Checklist

Source: five-part release audit, 2026-10-04 (completeness, leakage, billing/fees, deferred backlog, core flows/access). Work top-down. Tick as shipped.

Legend: `[ ]` to do · `[~]` in progress · `[x]` done (note commit + "pending prod deploy" until pushed).

---

## 🔁 Second-pass audit (2026-10-05)

A deeper verification pass (five audits: TSP-coupling bug-class sweep, owner/team-member completeness, invited-agent side, full lifecycle + edge transitions, adversarial regression check). Verdict: NOT yet release-ready — real issues found, all contained. Money/billing/per-file-email/retention/analytics layers verified correct.

### Blockers — DONE (built, pending prod deploy)
- [x] **SP-B1 — External business members had platform-wide chain powers.** Role `sales_progressor` was treated as TSP-internal, and the by-chain-id routes didn't re-scope → an external member could view/edit/delete another tenant's chain. Fixed: scoped to chains their own sales are in (delete requires creator). `0a80a7bf`.
- [x] **SP-B2 — Admin global search leaked external files + under-scoped owners.** admin search used an empty filter (returned every business's files/contacts + inflated solicitor counts); owner/see-all search was under-scoped. Fixed: TSP-only for admins, whole-book for owners. `c8a756d1`.
- [x] **SP-B3 — Owner couldn't add a 2nd sale through the UI.** No durable "Add a sale" affordance after the first sale. Fixed: button on the client Sales tab + empty state, and on each clients-list row. `81057fc6`.
- [x] **SP-C2b-regression — VAT breakdown leaked onto TSP→agency invoices.** My C2b change to the shared renderer fired for VAT-registered agencies. Fixed: gate on issuer VAT number. No live impact (0 prod agencies VAT-registered). `d9b66853`.

### Should-fix — PENDING (items 4–12, next batch)
- [ ] **SP-4 — Team members see TSP's fee, not the rate card** (files list + hub forecast); F1 only covered owners/see-all.
- [ ] **SP-5 — Percent/tiered invoice bills £0 for a no-price sale** (and defeats the F4 price-lock).
- [ ] **SP-6 — Migrated sales are on the invoice but missing from the owner's fee dashboards** (C2a follow-on inconsistency).
- [ ] **SP-7 — Chain cascade / celebration / decline emails hardcode "Sales Progressor"** (sender + body) — only chain-email family that never white-labels.
- [ ] **SP-8 — Chain invite/update/overview email footers print "TSP · Sales Progressor"** (sender is fine; body footer isn't).
- [ ] **SP-9 — W1 invite email "From" display name is still "Sales Progressor"** (body white-labelled, inbox sender line not).
- [ ] **SP-10 — "Revenue at risk" founder signal counts external-business money as TSP revenue.**
- [ ] **SP-11 — Outsource-intro email ignores the business's own verified sender.**
- [ ] (SP-7-search whole-book fix already shipped with SP-B2.)

### Polish — PENDING
- [ ] `/agent/settings` bare index 404s for a team member (should land on Profile).
- [ ] Business invoice PDF metadata author still "Sales Progressor".
- [ ] `removeClientAgencyAction` ignores on-hold sales; `getInvitingProgressor` ignores `removedAt`; V1 flag lookup ignores `removedAt`.
- [ ] Payment-block check runs against the client agency on clientCreate (wrong party).
- [ ] Client-chase-digest footer + portal mailto fall back to `support@`/`updates@` on a business file.
- [ ] Dead `listTransactionsByScope` (no callers).

### Verified clean (sign-off)
Per-file fees, billing ring-fence, business VAT math, retention suppression, analytics "our fees", all per-file client emails, add-sale gate, relist handling, W3, V1 routing, B2 member settings, member removal, scoping on hub/work-queue/to-do/completions/analytics/notifications.

---

## 🔴 Blockers — do first (first-pass)

- [x] **B1 — Stop our own marketing emails reaching a business's clients.** *(built, pending prod deploy)*
  Our re-engagement/win-back emails go to agencies we haven't heard from and pitch our own service ("your first file's on us", "someone made you a better offer"). They don't know some agencies now belong to an external progression business, so we'd be emailing that business's clients and poaching them under our name.
  *Fix shipped:* the retention sweep now builds the list of agencies owned by an external (non-TSP) progression business and skips every one, across all six email bands (one shared recipient query). No copy change.

- [x] **B2 — Give invited team members their own account area.** *(built, pending prod deploy)*
  An owner can invite a teammate who can log in and work on sales, but they have no settings page at all — can't change their password, set notifications, connect their email, or edit their profile.
  *Fix shipped:* team members are admitted to the settings area with the four self-service tabs (Profile, Connections, Notifications, Security); owner-only tabs (Business, Emails, Team, Billing) are hidden from the nav and still 404 if typed. Their account menu now opens their settings (captioned "Team member"), not the blank agency account.

---

## 🟠 Should-fix — fee accuracy (same class as the £0 bug just fixed)

- [x] **F1 — The sales list shows the business the wrong fee.** *(built, pending prod deploy)*
  On the transactions list (stat strip / forecast / pipeline / map) an external owner is shown *our* fee calculation, not their own rate card. Wrong number on their own files.
  *Fix shipped:* the list now computes an external business's fee from their per-client rate card (loaded once, keyed by the file's agency), matching the hub and file views.

- [x] **F2 — Two more places still show £0 for an unset fee.** *(built, pending prod deploy)*
  The hub weekly forecast and the add-a-sale cost line both silently show £0 when a client has no fee set, instead of prompting to set it.
  *Fix shipped:* the add-a-sale card shows "Fee not set" (and holds the net) rather than "Free"; the hub forecast leaves unset-fee files out entirely (count + total) instead of counting them as £0.

- [x] **F3 — The "fee must be set" rule isn't enforced on the server.** *(built, pending prod deploy)*
  Adding a sale is only blocked in the browser. If the fee is cleared between opening the page and submitting, a £0 file can still be created.
  *Fix shipped:* the create action re-checks the client has a fee set and refuses with "Set your fee for this client before adding a sale." if not.

- [x] **F4 — Tiered/percent invoices can change after they're issued.** *(built, pending prod deploy)*
  The price a tiered or percentage fee is based on is never locked at exchange for external files, so editing the price later silently changes an already-issued invoice. (Flat fees are unaffected.)
  *Fix shipped:* exchange now stamps the sale price for external-business files too (ring-fenced — it's not a billing trigger), so the invoice snapshot is fixed at exchange.

## 🟠 Should-fix — white-label & onboarding

- [x] **W1 — The client-invite email still looks like it's from us, not the business.** *(built, pending prod deploy)*
  The first email a new client agency receives said "Sales Progressor", with our footer and reply address — not the business's identity.
  *Fix shipped:* the invite is now white-labelled to the business — its name as the wordmark (no Sales Progressor hero/logo), subject "You've been set up with {business}", replies to the business's own address (neutral fallback), and a light "powered by Sales Progressor" footer. Our visual style, their identity. The email catalogue specimen renders the same builder, so it shows the new version.

- [x] **W3 — An invited client-agency colleague can see files in lists but can't open them.** *(built, pending prod deploy)*
  *Fix shipped:* the file-open check now honours the "can see all the agency's files" flag (and firm scope) the list already uses, so a file visible in the list is openable.

- [ ] **W2 — A client agency that already has an account can't be added.** *(DEFERRED — do last)*
  Decision (founder, 2026-10-04): leave as-is for launch. Pilot clients are net-new to the platform, so the block is fine. Onboarding an agency that already exists (a merge/claim path) is a later growth feature, scheduled last on this list.

- [ ] **D1 — Billing point: charge the agent at exchange or at completion.** *(DEFERRED — post-launch, external progressors)*
  Raised by C2a (founder, 2026-10-04). Today the business's client invoice bills a sale when it **exchanges**. Some businesses will want to bill at **completion** instead. Add a per-business setting (Settings → Business or Billing) to choose the fee's lock/charge point — exchange (current) or completion — and drive the invoice's included-sales window off it. Not needed for the pilot.

- [ ] **D2 — White-label the agent-facing app per business.** *(DEFERRED — decision pending, ties to critique #178)*
  Was P4. Today the app the agents log into is Sales-Progressor-branded (loading mark, "install Sales Progressor" copy, app name) — the client-facing side (emails, portal) is what's white-labelled. Whether the agent-facing shell should also be per-business branded is an undecided product call the founder is holding, tied in with critique #178. Scope as its own project if taken on.

## 🟠 Should-fix — billing (not blocking a free pilot)

- [ ] **C1 — Payment collection isn't wired up.** *(DEFERRED — do last)* The bill is shown honestly ("not taking payment yet") but there's no card entry and the Stripe side has no triggers. Decision (founder): we wire it up and make a test payment ourselves as the final step before charging businesses. Intended off for a free pilot.
- [x] **C2a — Migrated files on the client invoice.** *(no change — confirmed correct)* Decision (founder, 2026-10-04): a migrated sale IS billable — the business charges its agent whenever a sale exchanges, whether or not it started on the platform. So migrated sales correctly stay on the invoice (only demo files are excluded). No code change. See the new deferred item below for the exchange-vs-completion billing-point setting this raised.
- [x] **C2b — VAT on the client invoice.** *(built, pending prod deploy)* A VAT-registered business can now add VAT to the invoices it sends its clients. Set it at **Settings → Business → VAT** (toggle "VAT registered", VAT number, rate — default 20%). When on, the invoice adds VAT on top of the rate-card fees and prints the VAT number; when off, nothing changes. Adds `vatRegisteredAt` / `vatRateBps` / `vatNumber` to the business (migration `20261004120000_progression_business_vat`, applied to staging; lands on prod on deploy).

## 🟡 Verify — quick checks

- [ ] **V1 — Do general (non-file) messages from a client reach the business inbox?** **CONFIRMED BROKEN (2026-10-04).** A "Send a note to {progressor}" message with no sale attached is created as a task with no transaction, but the progressor inbox only lists tasks that have a transaction assigned to them — so general notes reach nobody (not the inbox, not a notifications page). Affects TSP-outsourced agencies too, not just external businesses. Fix proposed; awaiting go.
- [x] **V2 — Does the agency analytics "our fees" figure wrongly include externally-progressed files?** *(confirmed + guarded, pending prod deploy)* It *would* over-count (no exclusion), but `getAnalytics` has no consumer anywhere in the repo — it's unused, so nothing shows a wrong number today. Added a defensive guard that excludes external-business files, so it's correct if ever wired up.

## ⚪ Polish — last

- [x] **P1 — "New sale" button dead-ends for a team member with no clients yet.** *(built, pending prod deploy)* Hidden for a team member until the business has a client to attach a sale to (owners are unaffected — they route via the Clients screen).
- [x] **P2 — One hub list path doesn't exclude demo files.** *(built, pending prod deploy)* Added the same no-demo filter every other query uses.
- [x] **P3 — No per-file email silencing for a business.** *(built, pending prod deploy)* Added the "silenced files" picker to the business notifications page, business-scoped (owner/see-all → whole book, see-own → own files), reusing the existing pause/resume actions. A business can now mute the automated client emails on a specific sale.
- [x] **P5 — A malformed tiered fee band silently becomes £0.** *(built, pending prod deploy)* A malformed tiered rate card is now treated as "fee not set" (shows "Set fee"), never a silent £0.
- **P4 → moved to the deferred list (D2).**

## 🔧 Pre-launch ops — gate the flag flip (not code)

- [ ] **O1 — Apply the two new database changes to production** (staging-only right now) and confirm the deploy is green.
- [ ] **O2 — Confirm our own "TSP" progression-business record exists in production** (the platform errors everywhere without it).
- [ ] **O3 — Confirm the domain-check job is running** (it's what marks a business's sending address as verified).

---

## Confirmed sound (no action — recorded for the release sign-off)

- Tenant isolation across businesses, agencies, and us — no cross-tenant data leak.
- External businesses can't reach Command Centre, admin, or the internal dashboard.
- Our own fee income / platform pricing is hidden from external owners.
- Our per-sale billing and the "first file free" giveaway never fire on an external file.
- Client-facing emails carry the agency's/business's identity, never ours.
- The add-a-sale happy path is fully wired and server-validated.
