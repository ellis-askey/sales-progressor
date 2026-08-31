# Account area redesign — plan

**Status:** plan, not building. Founder mocked every Account page (except Connections). Rule: no regression / no lost functionality; additions ("extras") are confirmed **before** each page is built. Strings taken from the mocks. Animation is in-scope from the start, not a later toothcomb.

Pages: Profile, Team, Notifications, Billing, Emails. (Connections: out of scope, and the only page not fully wired.)

---

## A. Shared visual language (from the mocks)

Applies to every page:
- **Warm gradient background** (soft peach/cream), not the current flat `#fafafa`.
- Each section is a **white rounded card** (~16px radius) with a soft shadow + generous padding — replaces the current hairline-divided single column.
- **Card header pattern:** a coral-tinted rounded **icon chip** + title + one-line subtitle.
- Segmented pill controls (Buyer/Seller, Freehold/Leasehold, Morning note/Authority nudge) as on the Emails mock.
- Coral primary buttons; coral text links with a trailing arrow.
- Some pages use a **2-column grid** for shorter sections (Profile: colour + branding, sending + account; etc.).

**Open (A1):** content max-width — current is 880px; mocks read wider (~980–1040). Confirm target.
**Open (A2):** card entrance animation — match the app's existing subtle fade-up (respecting `prefers-reduced-motion`)? Assumed yes unless told otherwise.

---

## B. Chrome & sidebar (shared — build first)

The mocks restructure the shell to mirror the agent shell:
- **Sidebar** (fixed, ~260px, white, hairline right border): **SP logo + wordmark at the top**, nav tabs in the middle, **user profile (avatar + name + role) at the bottom**.
- The current full-width sticky `AccountChromeHeader` (logo left + Back right) is **removed**; its two jobs move — logo to sidebar top, "Back to Sales Progressor" to a **per-page content header** (top-right).
- **Per-page content header:** page title + subtitle on the left, "Back to Sales Progressor" on the right.

### Nav interaction (the requested behaviour)
- Keep `AccountLeftNav` as the component, but drive its rows through the **same interaction as the agent nav** (`AgentNavRail`): a single **sliding coral "spotlight" pill** that glides to the active tab (`transform`/`height` 320ms `cubic-bezier(.22,1,.36,1)`), **hover turns the label coral and slides a chevron in from the right**, active = filled icon + coral text. The `agent-rail-*` CSS is already imported by the Account layout, so this is reuse, not reinvention. No badges (Account tabs carry no counts).

### "Back to Sales Progressor" (the requested animation)
- Hover → **background fully transparent** (remove the current 5% grey), and the **arrow slides left** (`translateX(-3px)`) on hover, easing back on leave (~200ms). Keyboard focus mirrors hover.

**Open (B1):** the bottom **user profile** — display-only, or a dropdown (the mock shows a chevron)? In the agent shell it opens account/logout. Here we're already in Account; suggest a small menu with **Sign out** (+ maybe theme). Confirm.

---

## C. Page-by-page

For each page: **Preserve** (wired functionality that must survive), **Layout** (from mock), **Extras to confirm** (additions), **Animation**.

### C1. Profile  `/agent/account/profile`
**Preserve (all wired):** photo upload (`/api/agent/upload-avatar`); Save profile (`updateProfileAction`, fires `sp_onboarding_step{hasPhone}`); brand colour (`updateBrandColor`); email branding logo upload/replace/remove + tile/scale/align (`/api/agent/agency-logo` POST/PATCH/DELETE); sending addresses full state machine (`/api/agent/verified-emails/*`, fires `hasVerifiedEmail`); download data (`exportMyData`); delete account (`deleteMyAccount` → signOut). Director-only: email branding + agency logo.
**Layout:** Personal details (full-width card) → Your app colour + Email branding (2-col) → Sending addresses + Account & data (2-col). Email-branding card keeps the "Email settings →" link to `/agent/account/emails`.
**Extras to confirm:** `SendingAddressesSection` currently uses legacy `glass-card` styling — restyle to the card/"Plain" register so it matches (visual only, no wiring change).
**Animation:** card fade-up; colour-swatch hover; segmented (size/align) transitions already exist.

### C2. Team  `/agent/account/team`
**Preserve (all wired):** agency name save (`updateAgencyNameAction`); add negotiator (`inviteNegotiator`) + resend/cancel pending (`resendNegotiatorInvitation`/`cancelNegotiatorInvitation`); per-member file access (`PATCH /api/agent/team/{id}{canViewAllFiles}`); remove member (`DELETE /api/agent/team/{id}`); negotiator branch "Invite your director" (`inviteDirector`/`resendInvitation`).
**Layout:** Agency details card (name + Save) → Your team card (roster rows + Add) → file-access legend.
**Extras to confirm:**
- Mock shows file access as a **dropdown/select** ("All files" / "Own files"); today it's a toggle button. Convert to a dropdown (same underlying PATCH). ✔ low-risk.
- Mock shows a **"…" overflow menu** per row; today actions are inline icons and **there is no overflow menu**. Confirm what the "…" contains (Remove member? for pending: Resend / Cancel?).
**Animation:** dropdown open, row hover, optimistic add/remove transitions.

### C3. Notifications  `/agent/account/notifications`
**Preserve (all wired):** 5 email toggles (`updateAgentNotificationPrefAction`; retention via `updateRetentionEmailOptOutAction`); 7 push toggles (`updateAgentPushPrefAction`) — **plus the hidden `saleRelisted` push key that has no UI: keep it persisted, don't drop it**; enable-on-device flow; revoke device (`DELETE /api/agent/push-subscribe` = the mock's "Disable"); send test (`sendTestPushAction`); silenced files pause/resume (`pauseClientEmails`/`resumeClientEmails`).
**Layout:** Email notifications card → Push notifications card (device banner + toggles) → Silenced files card (empty state as mocked).
**Extras to confirm (these do NOT exist today):**
- Section-level **master toggle** + **"All on" / "Custom" preset dropdown** on both Email and Push. Proposed behaviour: the dropdown is a preset (**All on / All off / Custom**); picking All on/off bulk-sets every toggle in that section (one action per changed key, or a new bulk action); "Custom" is the auto-label when toggles are mixed; the master switch = quick All-on/All-off. Confirm this is what you want, and whether a **bulk action** is acceptable (vs firing N single writes).
**Animation:** toggle knob slide (exists), master→children cascade when bulk-setting, silence/resume row transitions.

### C4. Billing  `/agent/account/billing` (director-only)
**Preserve (all wired):** 4 KPI cells (`getCurrentMonthRunningTotal` + `getLifetimeMetrics`); current-invoice hero + **Preview PDF** (`/api/billing/invoice-pdf/preview`); invoice history + per-row PDF (`/api/billing/invoice-pdf/{id}`); payment method + card capture (`/api/billing/setup-intent` → Stripe `confirmSetup`); consent gate (`/api/billing/acknowledge`); plan & terms accordion; payment-block banner.
**Layout:** KPI strip → Current invoice card (line table + totals + Preview + [View exchanges]) → Payment method + Your pricing (2-col) → Invoice history table.
**Extras to confirm:**
- Mock's **"View exchanges"** button on the invoice card — no such control today. Confirm target (a modal/section listing this month's billable exchanges? or just scroll to the line table already shown?).
- Payment method card currently shows a **hardcoded placeholder card** (`····`, 12/2030) — it never reads the real Stripe card. Mock shows "Visa ending 4242 · Expires 04/28". Confirm whether to **fix this to show the real card** (read the default payment method from Stripe — a small functionality add) or keep placeholder.
- Plan pricing text is hardcoded in the component (matches mock) — leave as-is.
**Animation:** KPI count-up (exists), "Building" pulse (exists, decorative), card fade-up, accordion.

### C5. Emails  `/agent/account/emails`
(Rebuild of the page I shipped — same wiring, new presentation.)
**Preserve (all wired):** milestone editor (`/api/agent/milestone-emails/{resolve,save,reset}`) with Recipient/Tenure/Payment/Step; the four Tier-2 editors (`/api/agent/email-templates/{resolve,save,reset}`): completion pack, exchange-day (morning/authority), chase, weekly update; the audit trail; "More about client emails" link.
**Layout (mock):** "Step-by-step updates" card = the axis pills + a **Step dropdown** + a **preview** (Subject + Opening line) + **"Edit email →"**. "Automated emails" card = a **compact list**, one row per template (icon + title + subtitle + variant pills where relevant + **"Edit email →"**). Footer info card "Your version, your clients see".
**Extras to confirm (two, both significant):**
- **"Edit email →" open model.** Today the editor expands inline. The mock is a preview + "Edit email" action. Does that open a **drawer** (right-side Sheet), a **modal**, or a **dedicated sub-page** (`/agent/account/emails/[template]`)? This drives the whole page's interaction. *(My recommendation: a right-side drawer — reuses the app's Sheet, keeps context, works for both milestone + Tier-2 editors.)*
- **Post-completion email** ("A thank you and what to do after completion", Buyer/Seller) — **this email does not exist**. Building it = a new Tier-2 template family (like the others) **plus a send trigger** (when? on the completion milestone VM20/PM27, or N days after completion?). This is a feature, not layout. Confirm: build now (define the trigger) or add the row as "coming soon"/defer to a follow-up so the layout ships without it.
**Animation:** drawer slide-in (if drawer), preview fade on axis change, list row hover.

---

## D0. Decisions locked (2026-08-31)
- **Sidebar user:** menu with **Sign out** (B1).
- **Emails "Edit email":** opens a **right-side drawer** (Sheet) (C5).
- **Post-completion:** show the row, but as a **real editable template** with a "not sending yet — send trigger lands in a follow-up" note (NOT a disabled dashed box — keeps Law 13). Finalise at the Emails page (C5).
- **Content width:** **~1000px** (A1).
- **Card entrance animation:** subtle fade-up, `prefers-reduced-motion` respected (A2, assumed).

## D. Decisions needed before we start (grouped)

**Foundational (block the chrome + set the pattern):**
1. Chrome restructure confirmed? (logo→sidebar top, user→sidebar bottom, Back→per-page top-right, remove full-width header). **(B)**
2. Bottom user-profile: display-only or a menu (Sign out / theme)? **(B1)**
3. Content max-width **(A1)** + card entrance animation **(A2)**.

**Emails (biggest interaction call):**
4. "Edit email" opens a drawer / modal / sub-page? **(C5)**
5. Post-completion email: build now (+ define trigger) or defer the row? **(C5)**

**Per page (can confirm as we reach each):**
6. Notifications master toggle + preset behaviour + bulk action ok? **(C3)**
7. Team file-access dropdown + "…" menu contents. **(C2)**
8. Billing "View exchanges" target + fix real Stripe card display? **(C4)**
9. Restyle the two legacy `glass-card` components (SendingAddresses, MobilePush) to match. **(C1/C3)**

---

## E. Proposed build order

1. **Chrome + sidebar + nav interaction + Back-to-SP animation** (foundational; every page inherits it).
2. **Profile** (mostly layout; validates the card pattern end-to-end).
3. **Team** (small, contained).
4. **Notifications** (adds the master/preset — first real "extra").
5. **Billing** (rich, mostly wired).
6. **Emails** (new interaction model; Post-completion if in scope).

Each page: confirm its extras → build layout against the mock strings → wire nothing new except confirmed extras → verify no lost function → screenshot check.
