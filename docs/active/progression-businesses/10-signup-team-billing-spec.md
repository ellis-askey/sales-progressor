# Progression businesses — self-serve signup, team, and billing

**Status:** Spec agreed 2026-09-30. Follows Phases 1–8 (see [00-spec.md](00-spec.md), all shipped/committed). Everything here ships DARK behind `PROGRESSION_BUSINESSES_ENABLED` (same flag), except the billing ring-fence (Arc B1), which is a safety fix and is always on.

This document is the single source of truth for turning the progression-business capability from an operator-onboarded pilot into a finished self-serve product a customer can sign up for and be billed for. Read before any code change in this arc. If code and this doc disagree, surface it — do not silently pick one.

---

## 1. Goal

Today a progression business (Sarah) is created by hand (`scripts/seed-progression-pilot.ts`) and billed by hand. This arc delivers:

1. **Self-serve signup** — a person can create their own progression business from `/register`, no operator involvement.
2. **Team members** — the business owner can add colleagues who can be assigned files and see the business book.
3. **Billing** — the progression business is a billed subject (£59 base + £39 per extra member + £5 per sale), AND client agencies are ring-fenced so they are never charged for a progression business's files.

The whole thing reuses the existing agent signup, invite, and billing machinery. **The rule for this arc is reuse, not duplication (Law 4).** A progression business is an agent-shaped account with a different entrance, the Clients page, and its own billing subject.

---

## 2. The core reframe

The agent signup is a clean two-step flow we fork, not a second signup we build:

`app/register/page.tsx` (Step 1 details → Step 2 "set up your agency") → `POST /api/register` → `createDirectorWithAgency()` → `signIn` → `/agent/hub`.

A progressor is the **same flow** with three seams changed. Everything else (Step 1, password strength, terms, card chrome/animation, attribution capture, rate limiting, the redirect to `/agent/hub`, the empty-hub state) is reused verbatim.

---

## 3. Arc S — self-serve signup

### S1. Account-type toggle (`app/register/page.tsx`)

A segmented control at the top of the card: **Estate agent · Independent sales progressor**. Defaults to *Estate agent*.

- **Flag-gated:** renders only when `PROGRESSION_BUSINESSES_ENABLED` is on. Flag off → the register page is exactly as it is today (agent-only). The page is a client component, so the flag value is passed from a server wrapper (or a small `/api/flags` read) — **decision D1 below**.
- Selecting *Independent sales progressor* changes Step 2 (S2) and the submit payload (S3).

### S2. Step 2 variant

When account type is `progressor`:

- Sub-heading "Step 2 of 2: Set up your agency" → **"Step 2 of 2: Set up your business"**.
- "Agency name" label → **"Business name"**, placeholder → `e.g. Sarah's Progression Co`.
- The director/negotiator **role picker is removed** — a progressor signing up is always the business **owner**.
- Footer "Already part of an existing agency? Ask your administrator to invite you." → for progressor, **"Joining a colleague's business? Ask them to invite you."** (team invites, T-arc).

### S3. Backend fork (`app/api/register/route.ts`)

Request body gains `accountType: "agency" | "progressor"` (default `"agency"`).

- `accountType === "progressor"`:
  - Skip the join-request check (`resolveSignupDestination`) and `createDirectorWithAgency`.
  - Validate **business name** (not agency name) is present → error copy "Business name is required".
  - Call new `createProgressionBusinessWithOwner()` (S4).
  - Fire the **progressor** welcome email variant (S5).
  - Redirect unchanged → `/agent/hub`.
- `accountType === "agency"` (or absent): unchanged. Zero behaviour change for existing signups.

### S4. `lib/auth/create-progression-business-with-owner.ts` (new)

Mirrors `createDirectorWithAgency` exactly in shape (`$transaction`, post-commit Command-Centre event), different tables:

```
$transaction:
  business = ProgressionBusiness.create({ name, isTsp: false })          // + attribution later if wanted
  user = User.create / update({
    name, email, password?,
    role: "sales_progressor",
    agencyId: null,
    progressionBusinessId: business.id,
    progressionBusinessRole: "owner",
  })
post-commit: recordEvent({ type: "progression_business_created", ... })
```

Supports both the password path and the OAuth path (`userId` provided → update), same as the agency helper.

### S5. OAuth signup (`app/signup/complete/*`, `app/actions/complete-oauth-signup.ts`)

Google/Microsoft signup collects the org name **after** the OAuth round-trip in `CompleteSignupForm`. That form gets the same account-type toggle + business-name variant, and `completeOAuthSignup` branches to `createProgressionBusinessWithOwner({ userId, ... })` for the progressor path. The account-type choice is carried across the OAuth round-trip via the existing attribution-cookie mechanism (a short-lived first-party cookie), so it survives the redirect.

### S6. Welcome email variant (`lib/emails/send-welcome.ts` + `lib/emails/retention.ts`)

The agent welcome (`buildActivationDay1`) points the CTA at `/agent/transactions/new` ("add your first sale"). A progressor's first action is **add your first client**, so add `buildProgressionWelcome({ firstName, ctaUrl })` with CTA → `/agent/clients` and business-appropriate copy. `sendWelcomeEmailIfNotSent` picks the variant from the user's `progressionBusinessRole`/business membership. Voice-passed (Law 21).

### S7. First-run wiring

A progressor's sale must belong to a client, so "New sale" with no client is meaningless:

- For a progressor with **no clients**, the nav "New sale" button routes to `/agent/clients` (add a client first) rather than the blank new-sale form.
- Empty-hub nudge copy for a progressor: point at "Add your first client" (the Clients screen already provides add-client + add-sale-per-client from Phase 4/5).
- Once clients exist, the existing per-client "Add sale" path (Phase 5) is unchanged.

---

## 4. Arc T — team members

The owner can add colleagues. A team member is a `User` with `role: sales_progressor`, `progressionBusinessId = business`, `progressionBusinessRole: progressor` (not `owner`).

### T1. Team screen

A "Team" area (a tab on a new **Business settings** screen, X-arc, or a section on the Clients screen — **decision D2**). Lists members; "Add team member" (name + email) creates a pending member and sends the **setup email** (reuse the exact invite pattern in `lib/emails/client-agent-invite.ts` / `send-outsource-intro.ts`: `verificationToken` + `/reset-password`). New `AgentEmailKind "team_member_setup"` (redacted like `client_agent_setup`).

### T2. Capabilities (already supported)

Members already work end to end from Phases 7 + 2: business scope (`{kind:"business"}`) gives every member the whole business book; `assignedUserId` powers "my files"; the owner can assign files to members (`assignUserAction` is business-isolation-guarded). **No access-control work needed** — this arc is only the invite UI + the billing seat count.

### T3. Owner vs member privilege

V1: only the **owner** sees the Clients page, adds clients, adds team members, and sees billing (`resolveBusinessOwner` already gates this). Members progress files but do not manage clients/team/billing. (A richer per-member permission tier is explicitly deferred.)

---

## 5. Arc B — billing

**New billed subject: the progression business** (distinct from Agency billing). The business owner is the bill payer.

Pricing (locked 2026-09-30):

| Item | Price | Notes |
|---|---|---|
| Base (owner/director seat) | **£59 / month** | one per business |
| Additional team member | **£39 / month** each | count of active non-owner members |
| Per sale | **£5 / sale** | timing = **decision D3** |

### B1. Ring-fence (SAFETY — do this first, always on, not flag-gated)

`lib/services/billing-trigger.ts → maybeStampExchange` currently bills the **owning agency** £250+ at exchange for any `outsourced` file (`billing-trigger.ts:89`). A progression-business file has `agencyId = client's agency` and `serviceType = outsourced`, so today it would **wrongly accrue the TSP outsourced fee against the client agency** (Donna), and would charge her if auto-issue is ever switched on.

Fix: in `maybeStampExchange`, after the demo/self_managed/trial guards, if the file belongs to an **external** progression business (`progressionBusinessId` set and not the TSP row — use `isTspBusiness`), **skip agency billing entirely** (return without stamping an agency bill). The client agency is never billed for a progression business's work. Instead the file is recorded toward the progression business's per-sale charge (B3). TSP files (`progressionBusinessId = null`) and normal agency files are completely unchanged.

This is ring-fence-first because any external file reaching exchange before it lands is a mis-bill. It is independent of the subscription build and ships regardless of the flag.

### B2. Subscription (base + seats)

The progression business gets a Stripe customer + subscription: base £59 + £39 × active-member-count (quantity-based seat billing). Adding/removing a team member updates the seat quantity. Owner-visible billing screen shows the current subscription, seats, and per-sale charges to date.

### B3. Per-sale charge

£5 per sale added to the business's invoice. **Timing D3:** proposed **at exchange** (matches the platform's "charged on exchange" precedent and avoids charging for collapsed sales); recorded when `maybeStampExchange` ring-fences the file (B1), so the same event that skips the agency bill records the £5 to the progression business.

### B4. Collection mechanism

Mirror the existing deferred model: **accrue/record** charges on the progression business now and render them on a billing screen; actual Stripe collection follows the same switch the agency billing uses (`BILLING_AUTO_ISSUE_ENABLED`, currently off). Full model is built; flip-on is deliberate.

---

## 6. Arc X — business settings

A settings surface for the business (identity + billing + team). Most of it mirrors the agent account settings; we audit what does/doesn't apply:

- **Identity** (feeds `clientFacingIdentity`, Phase 3): business name, sender email/domain, WhatsApp. Created blank at signup → neutral platform fallback until set (decision D-settings: fallback-now confirmed). This screen is where they set them.
- **Billing** (Arc B): subscription, seats, per-sale charges, invoices.
- **Team** (Arc T): members + invites.
- Not applicable to a progression business: agency-only settings (client-portal display toggles, agency email-branding that targets agency clients, etc.) — audited and hidden per item during build.

---

## 7. Phrasing audit (Law 21 voice-pass every string)

Concrete agency-worded strings on the progressor path to change/branch:

- `app/register/page.tsx` — step-2 heading, "Agency name" label + placeholder, footer invite line, (role picker removed).
- `app/api/register/route.ts` — "Agency name is required" → business-worded on the progressor branch.
- `app/signup/complete/CompleteSignupForm.tsx` — same agency→business swaps for the OAuth path.
- `lib/emails/retention.ts` / `send-welcome.ts` — progressor welcome variant (CTA → add first client).
- Empty-hub nudge / "New sale" affordance for a clientless progressor (S7).
- No em-dashes, no "the system/platform/automatically", "remove" not "delete", no titles in names.

---

## 8. Build order (all reversible, flag-gated unless noted)

1. **B1 — billing ring-fence** (safety, always on). Small, isolated, high-value. Ships first.
2. **S4 — `createProgressionBusinessWithOwner`** (backend helper + unit test).
3. **S1–S3 — register fork** (toggle + step-2 variant + API branch). Visual — proof on local.
4. **S6 + S7 — welcome variant + first-run wiring**.
5. **S5 — OAuth progressor signup**.
6. **T1 — team invite UI** (+ `team_member_setup` email).
7. **X — business settings** (identity + team surfaces).
8. **B2–B4 — subscription + per-sale + billing screen**.

Each step: `tsc` clean, tests where behaviour changes, `git commit --only` scoped paths, no auto-push, one concern per PR (Law 5). Visual steps get a local proof before moving on.

---

## 9. Decisions

**Locked:**
- Label is **"Business name"**.
- Progressor signs up as **owner**; can add team members later.
- Pricing: **£59 base + £39/member + £5/sale**.
- OAuth included (full product).
- Settings default to **neutral platform-fallback identity** at signup; configured later on the settings screen.
- Signup track first, billing track second (ring-fence B1 excepted — it goes first as a safety fix).

**Open (need a tick before the relevant step):**
- **D1** — how the client `register` page reads the flag: server wrapper passing a prop (preferred) vs a tiny `/api/flags` fetch.
- **D2** — where the Team + Business-settings surfaces live (dedicated settings route vs sections on existing screens).
- **D3** — per-sale £5 timing: **at exchange** (proposed) vs at sale creation.

---

## 10. Acceptance walkthrough (the journey to verify at the end)

1. `/register` → toggle **Independent sales progressor** → Step 1 details → Step 2 **Business name** → Create account.
2. Land on `/agent/hub` (empty), **Clients** nav present; progressor **welcome email** received (CTA = add first client).
3. **Clients → Add your first client** (Donna) → Donna receives her setup email; appears in the list.
4. **Add a sale** for Donna → file created (`agencyId=Donna`, `agentUserId=Donna`, `progressionBusinessId=Sarah`, `assignedUserId=Sarah`, outsourced) → shows in Sarah's hub.
5. **Team** → add a member → member receives setup email → seat count (and £39) reflected.
6. At exchange: **£5** recorded to Sarah's business, **£0** to Donna's agency (ring-fenced). Subscription shows £59 + £39.
7. Isolation still holds (Phase 8 spec): Donna sees only her files; other businesses/TSP cannot see Sarah's; buyer/seller see Sarah.
