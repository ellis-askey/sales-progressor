# External Sales-Progression Business — Release Audit Checklist

Source: five-part release audit, 2026-10-04 (completeness, leakage, billing/fees, deferred backlog, core flows/access). Work top-down. Tick as shipped.

Legend: `[ ]` to do · `[~]` in progress · `[x]` done (note commit + "pending prod deploy" until pushed).

---

## 🔴 Blockers — do first

- [x] **B1 — Stop our own marketing emails reaching a business's clients.** *(built, pending prod deploy)*
  Our re-engagement/win-back emails go to agencies we haven't heard from and pitch our own service ("your first file's on us", "someone made you a better offer"). They don't know some agencies now belong to an external progression business, so we'd be emailing that business's clients and poaching them under our name.
  *Fix shipped:* the retention sweep now builds the list of agencies owned by an external (non-TSP) progression business and skips every one, across all six email bands (one shared recipient query). No copy change.

- [x] **B2 — Give invited team members their own account area.** *(built, pending prod deploy)*
  An owner can invite a teammate who can log in and work on sales, but they have no settings page at all — can't change their password, set notifications, connect their email, or edit their profile.
  *Fix shipped:* team members are admitted to the settings area with the four self-service tabs (Profile, Connections, Notifications, Security); owner-only tabs (Business, Emails, Team, Billing) are hidden from the nav and still 404 if typed. Their account menu now opens their settings (captioned "Team member"), not the blank agency account.

---

## 🟠 Should-fix — fee accuracy (same class as the £0 bug just fixed)

- [ ] **F1 — The sales list shows the business the wrong fee.**
  On the transactions list (stat strip / forecast / pipeline / map) an external owner is shown *our* fee calculation, not their own rate card. Wrong number on their own files.
  *Fix:* use the client rate card for external businesses on this path, the way the hub already does.

- [ ] **F2 — Two more places still show £0 for an unset fee.**
  The hub weekly forecast and the add-a-sale cost line both silently show £0 when a client has no fee set, instead of prompting to set it.
  *Fix:* apply the same "fee not set" guard used elsewhere.

- [ ] **F3 — The "fee must be set" rule isn't enforced on the server.**
  Adding a sale is only blocked in the browser. If the fee is cleared between opening the page and submitting, a £0 file can still be created.
  *Fix:* re-check the fee is set when the sale is actually created.

- [ ] **F4 — Tiered/percent invoices can change after they're issued.**
  The price a tiered or percentage fee is based on is never locked at exchange for external files, so editing the price later silently changes an already-issued invoice. (Flat fees are unaffected.)
  *Fix:* lock the price at exchange for external files too.

## 🟠 Should-fix — white-label & onboarding

- [ ] **W1 — The client-invite email still looks like it's from us, not the business.**
  The first email a new client agency receives says "Sales Progressor", with our footer and reply address — not the business's identity.
  *Fix:* re-brand that email to the business (name, footer, reply-to). **Needs new strings — confirm copy.**

- [ ] **W2 — A client agency that already has an account can't be added.** *(Decision needed)*
  *Fix/decision:* decide whether pilot clients must be new to the platform (leave as-is) or whether existing agencies can be onboarded (needs work).

- [ ] **W3 — An invited client-agency colleague can see files in lists but can't open them.**
  *Fix:* let the file-open check respect the same "can see all the agency's files" flag the list already uses.

## 🟠 Should-fix — billing (not blocking a free pilot)

- [ ] **C1 — Payment collection isn't wired up.** The bill is shown honestly ("not taking payment yet") but there's no card entry and the Stripe side has no triggers. Must be built + tested before we ever turn collection on. *(Intended off for a free pilot.)*
- [ ] **C2 — The client invoice has no VAT option and can include migrated files.** A VAT-registered business can't bill VAT; an imported file could wrongly appear as a line.

## 🟡 Verify — quick checks

- [ ] **V1 — Do general (non-file) messages from a client reach the business inbox?** A message not attached to a specific sale may never surface. Confirm.
- [ ] **V2 — Does the agency analytics "our fees" figure wrongly include externally-progressed files?** Confirm who sees it and whether it over-counts.

## ⚪ Polish — last

- [ ] **P1 — "New sale" button dead-ends for a team member with no clients yet** (bounces to the hub). Hide it until there's a client.
- [ ] **P2 — One hub list path doesn't exclude demo files** (harmless today, inconsistent).
- [ ] **P3 — No per-file email silencing for a business** (owner can't mute one sale's emails).
- [ ] **P4 — Our name/logo appears on the shared app loader and push-setup copy** (platform chrome; only matters if the agent app is meant to be white-labelled too).
- [ ] **P5 — A malformed tiered fee band silently becomes £0** (data-hygiene edge case).

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
