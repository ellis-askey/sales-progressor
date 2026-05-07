# Discovery: Your First Day
_Research notes for the "Your first day" help article. Not a help article — raw findings only._

---

## 1. Sign-in paths — every way a user reaches the app

All sign-in flows begin at `app/login/page.tsx`. The page checks for an existing session and redirects before rendering: `director` and `negotiator` go to `/agent/hub`; `superadmin` to `/command/overview`; all others to `/dashboard` (`app/login/page.tsx:29–31`).

### Email + password — existing user

- Form component: `components/login/WarmLoginForm.tsx`
- Calls `signIn("credentials", { email, password, redirect: false })` (`WarmLoginForm.tsx:22`)
- On success, calls `router.push("/")` — root `app/page.tsx` then dispatches by role to `/agent/hub` for director/negotiator (`app/page.tsx:17`)
- Rate limited by IP before the credential check (`lib/auth.ts:66`)
- Failed attempt: generic "Incorrect email or password." message — no distinction between unknown user and wrong password (`WarmLoginForm.tsx:25`)
- No intermediate step; user lands directly on `/agent/hub`
- No welcome email sent on sign-in

### Google OAuth — existing user

- Button in `WarmLoginForm.tsx:100`: calls `signIn("google", { callbackUrl: "/" })`
- `allowDangerousEmailAccountLinking: true` — if the email already exists in the DB as a password account, Google silently links to it (`lib/auth.ts:110`)
- JWT callback fetches role/agencyId from DB; if user has an agencyId the session resolves normally (`lib/auth.ts:150–158`)
- Lands at `/` → redirected to `/agent/hub`
- No intermediate step for an already-registered existing user

### Microsoft (Azure AD) OAuth — existing user

- Button in `WarmLoginForm.tsx:114`: calls `signIn("azure-ad", { callbackUrl: "/" })`
- `allowDangerousEmailAccountLinking: true` — same linking behaviour as Google (`lib/auth.ts:117`)
- Identical flow to Google after that

### Email + password — first-time login (after invitation acceptance)

- Negotiator invitation path: user receives a link to `/invite-negotiator/[token]` and sets a password via `app/invite-negotiator/[token]/page.tsx` + `NegotiatorPasswordForm`
- After password is set and credentials sign-in succeeds, lands at `/agent/hub`
- Director invitation path via password: user goes to `/invite/[token]/password` (`app/invite/[token]/password/page.tsx`), fills in name + password via `InvitedPasswordSignupForm`, then the form signs them in and the accept route (`/invite/[token]/accept`) attaches them to the agency before redirecting to `/` → `/agent/hub`

### OAuth — first-time login (net-new user)

- User clicks Google or Microsoft on the login page
- NextAuth creates a `User` row (role: `viewer`, no agencyId) via `PrismaAdapter`
- JWT callback detects `role === "viewer"` with no agencyId and sets `needsSignupCompletion: true` (`lib/auth.ts:158`)
- Root page `app/page.tsx:9` and `lib/session.ts:16` both redirect to `/signup/complete`
- User sees `CompleteSignupForm` (`app/signup/complete/CompleteSignupForm.tsx`)
- Fields: name (pre-filled from OAuth), role (director/negotiator radio), agency name (optional, labelled as such)
- On submit calls `completeOAuthSignup` server action, then `window.location.href = "/"` for a hard navigation to force JWT refresh (`CompleteSignupForm.tsx:82`)
- Root page now resolves `needsSignupCompletion: false` and dispatches to `/agent/hub`

### Self-registration (Director and Negotiator path)

- URL: `/register` (`app/register/page.tsx`)
- Two-step form. **Step 1**: full name (required), work email (required), password min 8 chars (required), terms + privacy checkbox (required). **Step 2**: agency name (optional), role radio (Director / Negotiator — both available).
- Note: if no agency name is supplied, the API falls back to the user's full name as the agency name (`app/api/register/route.ts:39`: `firmName?.trim() ? toTitleCase(firmName) : toTitleCase(name)`)
- After submitting, calls `POST /api/register` which calls `createDirectorWithAgency` atomically creating an Agency record alongside the User (`lib/auth/create-director-with-agency.ts`)
- On success, immediately calls `signIn("credentials", ...)` and pushes to `/agent/hub` directly (`app/register/page.tsx:133`)
- No welcome email sent (no email call in the register route)
- No intermediate step — user lands directly on `/agent/hub`

### Director invitation acceptance

- Director is invited by a negotiator via `InviteDirector` component in settings
- Email contains link to `/invite/[token]`
- Landing page `app/invite/[token]/page.tsx` validates the token (7-day expiry enforced via `validateInvitationToken`)
- User presented with Google, Microsoft, or email+password options
- Google/Microsoft path: `signIn` with `callbackUrl: /invite/[token]/accept`
- Accept page `app/invite/[token]/accept/page.tsx` checks email match, then atomically updates user role to `director` and links to agency, marks invitation accepted, calls `notifyNegotiatorOfAcceptance`, redirects to `/` → `/agent/hub`
- Email+password path: user goes to `/invite/[token]/password`, sets a password, then goes through same accept logic
- If user is already signed in when they hit the invite link, they are shown a sign-out prompt (`InvitationLandingClient.tsx:119–143`)
- If signed in with wrong email: redirected back to `/invite/[token]?mismatch=1` and shown an error (`app/invite/[token]/accept/page.tsx:42–43`)

### Negotiator invitation acceptance

- Director invites a negotiator via TeamManagement; negotiator receives email with link to `/invite-negotiator/[token]`
- `app/invite-negotiator/[token]/page.tsx` looks up `NegotiatorInvitation` record directly (no helper function — raw Prisma query)
- Shows agency name and inviting director's name; invitee sets their password via `NegotiatorPasswordForm`
- Expiry check is explicit in the page (`invitation.expiresAt < new Date()`)
- **Unclear:** The negotiator invite page uses a different visual style (plain white card, not the SunriseBackground glass-card pattern used in the director invite flow — `app/invite-negotiator/[token]/page.tsx:20–32`). This appears to be a legacy design that was not updated.

### Forgot password flow

- `/forgot-password` (`app/forgot-password/page.tsx`) — collects email, calls `POST /api/auth/forgot-password`
- On any result (including unknown email) returns the same confirmation screen: "If an account exists for X, a reset link has been sent. It expires in 1 hour." — deliberately silent on whether the account exists
- Rate limited (returns 429 with a message)
- After user clicks reset link, they land on `/reset-password` route
- After reset, user must sign in separately — no auto-sign-in

---

## 2. The first thing a user sees on landing

### Empty state (no active files, no attention items)

Condition: `isEmpty = pipelineStats.activeFiles === 0 && attentionItems.length === 0` (`app/agent/hub/page.tsx:140`)

The page renders a distinct empty state layout (`app/agent/hub/page.tsx:143–319`) containing:

1. **Header**: personalised greeting by time-of-day ("Good morning/afternoon/evening, [first name]"), tagline "Here's what matters today.", a "New sale" button (links to `/agent/transactions/new`), and a "Send note to progressor" button (`AgentFlagButton`)
2. **Welcome CTA card**: "Your pipeline starts here. / Add your first sale and we'll track it from offer to completion." with an "Add a sale" button linking to `/agent/transactions/new` (`hub/page.tsx:209–235`)
3. **Ghost UI cards**: greyed-out, non-interactive placeholder cards for Pipeline health + Momentum, Needs attention section, Exchange forecast, and Service split — shown at 30% opacity with `pointerEvents: "none"` to give a sense of what the populated dashboard looks like (`hub/page.tsx:237–315`)

There is no "Today's diary" section or "Recent activity" ribbon in the empty state — those require data.

### WelcomeModal — when it shows

- Controlled by `hasSeenAgentWelcome` field on the User model (`prisma/schema.prisma:65`)
- `app/agent/layout.tsx:20–23` fetches this field and passes `showWelcome = !userRecord?.hasSeenAgentWelcome` to `AgentShell`
- `AgentShell` passes `showWelcome` to `WelcomeModal` (`components/layout/AgentShell.tsx:38`)
- The modal renders into a portal on `document.body` (`components/agent/WelcomeModal.tsx:37`)
- On mount it calls `markWelcomeSeenAction()` which sets `hasSeenAgentWelcome: true` in the DB (`app/actions/profile.ts:11`) — so it shows exactly once per user
- Cannot be re-shown (no UI to reset the flag)
- Modal content: "Good to have you, [first name]. Let's get your first file set up — it takes less than a minute." with two CTAs: "Add my first sale" (pushes to `/agent/transactions/new`) and "Explore a quick tour" (shows `TourSlides`)
- Closing by clicking backdrop or X sets `visible: false` — the DB flag has already been written, so it won't return
- `TourSlides` has 4 slides: "Your pipeline, at a glance", "A file that runs itself", "Clients stay in the loop", "Nothing slips through". Final slide's "Finish" button navigates to `/agent/transactions/new` (`components/agent/TourSlides.tsx:6–27`)

### DirectorJoinedBanner

- For negotiators who were active before their director accepted an invitation: a `DirectorJoinedBanner` appears on the hub if `directorJoinedNotificationName` is set on the User record (`hub/page.tsx:121–128`). This is a one-time notification to the negotiator that their director has joined.

---

## 3. The new-sale flow

### Where is the form

`/agent/transactions/new` — a full page at `app/agent/transactions/new/page.tsx`, not a modal. Renders `NewTransactionForm` from `components/transactions/NewTransactionForm.tsx`.

### Fields — required vs optional

**Required** (form cannot submit without these — `canSubmit` check at `NewTransactionForm.tsx:920–922`):
- Street address
- Tenure (Freehold / Leasehold)
- Purchase type (Mortgage / Cash / Cash from Proceeds)

When "Who will progress this file?" is set to "With progressor" (outsourced), at least one named vendor contact AND one named purchaser contact become required, and each named contact must have at least a phone or email (`NewTransactionForm.tsx:915–919`).

**Optional**:
- City/Town
- Postcode (validated on blur for UK format; shows a warning but does not block submission)
- Purchase price (shows "This seems low for a property" warning below £1,000,000 on blur; shows "Price over £50m" warning above £50m)
- Agent fee (fixed amount or percentage; with VAT inclusive/exclusive toggle — live £ figure shown when percentage mode)
- Vendor contact(s): name, phone, email — up to 2 vendors
- Purchaser contact(s): name, phone, email — up to 2 purchasers
- Vendor solicitor (via `SolicitorPicker`)
- Purchaser solicitor (via `SolicitorPicker`)
- Referral designation for solicitor firms (only appears if firm is in agency's recommended list)
- Notes (free text)
- Chain section (collapsible — adds linked sales above/below in the chain)
- Who progresses (self-manage vs send to progressor)

### Memo of Sale upload

An "Upload Memo of Sale" dropzone appears at the top of the form (`NewTransactionForm.tsx:1067–1073`). Accepts PDF, JPG, JPEG, PNG, WEBP. Calls `POST /api/agent/memo-parse`. On success:
- Auto-fills street address, city, postcode, price, tenure, vendor names/contacts, purchaser names/contacts
- Auto-fills solicitor firms (searches DB, creates if not found, creates handler if needed)
- Fields that were auto-filled get an "auto-filled" star badge
- If a MOS is uploaded and form is submitted, the system auto-completes milestones VM2 and PM2 ("Memorandum of sale received") on both sides (`app/actions/transactions.ts:124–140`)

### Draft auto-save

If the user has entered any data and navigates away, an intercepting click handler shows a modal asking to save as a draft (`NewTransactionForm.tsx:954–972`). Drafts are stored as `PropertyTransaction` records with `status: "draft"`. Existing drafts appear in a floating panel in the bottom-left corner when returning to the form.

### Duplicate address detection

On submit, the server action normalises the address and checks for matching active/on_hold transactions within the agency. If a duplicate is found and `forceCreate` is false, an error is thrown and the form shows a modal asking the user to view the existing file or create anyway (`app/actions/transactions.ts:63–80`).

### After creation — where does the user land

User is redirected to `/agent/transactions/[id]?newFile=1` (or `?mosConfirmed=1` if a MOS was uploaded and auto-confirmed) (`app/actions/transactions.ts:897–899`, `NewTransactionForm.tsx:897–899`).

### Milestone generation timing

Milestones are initialised synchronously as part of the transaction creation server action, inside the same request:
- `initializeMilestoneCompletions(tx.id, input.tenure, input.purchaseType, session.user.id)` — creates all milestone completion records with correct available/locked/not_required states based on tenure and purchase type (`app/actions/transactions.ts:119`)
- Initial reminders are created inline: `createInitialRemindersInline(...)` (`app/actions/transactions.ts:158`)
- Full reminder engine run is async and non-blocking: `void evaluateTransactionReminders(tx.id)` (`app/actions/transactions.ts:160`)

### Contacts — portal tokens

If contacts are supplied at creation time, each contact record is created with a `portalToken = randomUUID()` already set (`app/actions/transactions.ts:113`). Portal links are ready immediately.

---

## 4. Settings — brand-new user

Settings page: `app/agent/settings/page.tsx`

### My profile

Pre-populated with: name (from session), email (from session), phone (from DB `user.phone` — blank for new users). All three fields are editable. Role is displayed as a non-editable badge; negotiators see "Role changes are managed by your director." (`components/agent/ProfileForm.tsx:75–77`). Email change takes effect only after sign-out and sign back in (confirmed via toast message).

### Sending addresses

Available to both director and negotiator roles — the section is always shown.

Verification flow (`components/verified-emails/SendingAddressesSection.tsx`):
1. User enters a work email address
2. System calls `POST /api/agent/verified-emails/domain` — checks/creates a domain authentication record (DKIM/SPF/CNAME DNS records via SendGrid domain auth)
3. If domain is already authenticated: goes straight to inbox verify step
4. If domain is new: shows a "Domain authentication" screen with DNS records the user must add. The user must then confirm those DNS records are in place before proceeding
5. After domain auth: `POST /api/agent/verified-emails/inbox` sends a verification code to the email address
6. User enters the code → on success fires `sp_onboarding_step` with `{ hasVerifiedEmail: true }` — marks that checklist step done
7. A success screen shows with the verified address

For a brand-new user with no verified addresses, the list is empty with no placeholder text — just the "Add" UI.

### Branch theme

Visible to both roles. Six themes: Sunset (default), Coastal, Heritage, Slate, Emerald, Claret (`components/agent/ThemePicker.tsx:12–19`). Changes apply instantly via `useAgentTheme()` hook. The onboarding checklist marks `hasThemeSet` as complete only after the user explicitly picks a theme; after 14 days the grace period removes this requirement regardless (`app/api/agent/onboarding-progress/route.ts:40–48`).

### Team (director only)

Only rendered when `isDirector` is true (`app/agent/settings/page.tsx:124`). Shows existing director row (styled with crown icon) and negotiator rows. Empty negotiator state: "No negotiators yet. / Add a negotiator below to invite them to the portal." (`components/agent/TeamManagement.tsx:117–119`). Director can:
- Invite a negotiator (name + email → sends invitation email)
- Toggle "All files" vs "Own files" visibility for each negotiator
- Remove a negotiator (confirm dialog via `window.confirm`)
- Resend a pending invitation

### Invite your director (negotiator only, no director yet)

`InviteDirector` component is shown when: `session.user.role === "negotiator"` AND `!directorStatus.hasDirector` (`app/agent/settings/page.tsx:33–34`). Allows the negotiator to enter a director's name and email to send an invitation. Shows status of the most recent invitation (pending, expired, accepted).

### Account / Danger zone

`AccountDangerZone` component (`components/agent/AccountDangerZone.tsx`). Shown to all roles. Two actions:
- "Download my data" — exports a JSON file of the user's data
- "Delete my account" — modal requiring user to type their email address to confirm; on confirmation deletes account and signs out

---

## 5. Sending portal links — first active progression step

### Where the CTA lives

The portal invite is in the `ContactsSection` component (`components/contacts/ContactsSection.tsx`), which appears on the transaction detail page (Overview/Contacts tab). There is no separate page for this.

### The contact must have a portal token

If the contact was added at transaction creation time, a `portalToken` UUID is already set (`app/actions/transactions.ts:113`). If the contact was added post-creation via the inline form, `generatePortalTokenAction` must be called first — there is a "Set up portal" button for contacts without a token (`ContactsSection.tsx:321–328`).

### What the user does

For a vendor or purchaser contact that has a `portalToken` and an email address, two buttons appear:
- **"Send invite"** (`ContactsSection.tsx:304–310`) — calls `POST /api/portal/invite` which sends a branded email
- **"Portal link"** — copies the portal URL to clipboard (`ContactsSection.tsx:96–101`)

The "Send invite" button is only shown if the contact has an email address. The "Portal link" / copy button is always shown for contacts with a token. The `sendInvite` function fires the `sp_onboarding_step` event with `{ hasContactEmail: true }` on success — marking that checklist item done.

### What the contact receives

Email sent from `updates@thesalesprogressor.co.uk` (SendGrid) via `lib/email.ts`. Subject: `Your [sale/purchase] portal — [address]`. The email contains (`app/api/portal/invite/route.ts`):
- Agency name
- Property address
- A personalised greeting (vendor gets "sale", purchaser gets "purchase")
- A large "Open my portal" button linking to `[NEXTAUTH_URL]/portal/[token]`
- A note: "This link is personal to you — please don't share it with others."

### What the agent sees after sending

A success toast: "Invite sent to [contact name] / They'll receive an email shortly". The button briefly shows "✓ Sent" (reverts after 3 seconds).

---

## 6. The "Getting started" onboarding checklist

Component: `components/agent/OnboardingChecklist.tsx`

### Steps (exact order as coded)

1. "Add your first sale" → `/agent/transactions/new` — complete when `hasSale: true`
2. "Add client contact details" → `/agent/transactions/[firstTxId]` (or `/agent/dashboard` if no transaction yet) — complete when any contact on an agent's transactions has a phone or email
3. "Share the portal with a client" → `/agent/comms` — complete when any contact on an agent's transactions has an email
4. "Add your phone number" → `/agent/settings` — complete when `user.phone` is non-blank
5. "Choose your branch theme" → `/agent/settings` — complete per theme grace logic (see section 4)
6. "Verify your email address" → `/agent/settings` — complete when user has at least one `userVerifiedEmail` with `status: "verified"` (or account > 14 days old)

### How each step is detected

Steps 1–3 are detected from DB queries scoped to `agentUserId = userId, agencyId` (own files only, not agency-wide). Steps 4, 5, 6 are user-level. Source: `app/api/agent/onboarding-progress/route.ts`.

Progress is fetched on mount and then polled every 15 seconds. Optimistic instant updates fire when other components dispatch the `sp_onboarding_step` custom event (`OnboardingChecklist.tsx:65–78`).

### When the widget hides

- If all 6 steps are complete, `localStorage.setItem(dismissedKey(userId), "1")` is called silently and the widget disappears without animation
- User can manually dismiss via the X button — also writes to localStorage
- The dismissed state is stored in `localStorage` using the key `sp_onboarding_dismissed_[userId]`. This is client-side only; it does not persist across devices

### Role-specific behaviour

The component receives a `userId` prop but no role prop. It is rendered inside `AgentShell` for both director and negotiator. The steps are the same for both roles.

### Re-opening after dismissal

Once dismissed via the X button, the widget does not reappear. There is no UI in the app to reset the dismissed state. Clearing `localStorage` would bring it back.

### Collapsed vs expanded state

On desktop (viewport ≥ 768px), the widget auto-opens expanded on first load. On mobile it starts collapsed. Users can toggle by clicking the header or the collapse/expand caret.

---

## 7. The welcome modal / tour

### WelcomeModal

Component: `components/agent/WelcomeModal.tsx`

**What it says** (verbatim from code):
- Header: "WELCOME" (uppercase badge)
- Headline: "Good to have you, [first name]."
- Subtext: "Let's get your first file set up — it takes less than a minute."
- Primary CTA button: "Add my first sale" (Lightning icon)
- Secondary button: "Explore a quick tour"
- Footer note: "You can always add files any time from the dashboard."

**Conditions for showing**: `hasSeenAgentWelcome` is `false` in the DB. This is set to `true` on the `useEffect` mount of `WelcomeModal` via `markWelcomeSeenAction()` — before the user has done anything (`WelcomeModal.tsx:21`). So it shows once on the very first page load after account creation.

**Can it be re-shown**: No. The DB flag is set immediately on mount; there is no reset in the UI.

**TourSlides** (accessed from "Explore a quick tour"):
4 slides — "Your pipeline, at a glance", "A file that runs itself", "Clients stay in the loop", "Nothing slips through". Each slide has a short description and a graphical visual component. Final slide shows a "Start adding files" button that closes the modal and navigates to `/agent/transactions/new`.

---

## 8. Where things can go subtly wrong on day one

### Agency has no name set

If the user registered without entering an agency name, the system uses their full name as the agency name (`app/api/register/route.ts:39`): `agencyName = firmName?.trim() ? toTitleCase(firmName) : toTitleCase(name)`. A user named "Sarah Jones" who skips the agency name field will have an agency called "Sarah Jones". This appears in the sidebar under the "Sales Progressor" branding and in the header eyebrow on transaction pages. It also appears in portal emails sent to clients.

### Role is `viewer`

The `viewer` role is in the codebase (`lib/session.ts:40–43`, `app/page.tsx:21`) but is not used in production (confirmed in CLAUDE.md). If a user somehow has `role: "viewer"`:
- Root page dispatches them to `/dashboard` — the internal dashboard used by admin/sales_progressor (`app/page.tsx:21`)
- `app/agent/layout.tsx:14` redirects non-director/non-negotiator users to `/dashboard`
- API mutations check `forbidViewer()` which returns a 403
- In practice a viewer landing on `/dashboard` would see an empty transaction list (same known gap as internal staff)

### `needsSignupCompletion` flag is true

Handled explicitly: `lib/session.ts:16` redirects to `/signup/complete`. The JWT callback re-checks the DB on every request while `needsSignupCompletion` is true, so once the user completes the form and the DB is updated, the next page load resolves correctly without a fresh sign-in (`lib/auth.ts:166–177`). However: if the user tries to navigate directly to `/agent/hub` before completing signup, they will be immediately redirected back to `/signup/complete`.

### Email isn't verified (sending addresses)

"Email verification" in this product refers to verifying a sending address for use when emailing clients from the dashboard — it is not an account-access prerequisite. There is no block on accessing the agent app because an email is unverified. The only consequence is that the onboarding checklist step "Verify your email address" remains incomplete, and the user cannot send emails to contacts from the dashboard using a personal sending address (emails would fall back to the system sender).

### Milestone generation fails partway through file creation

`initializeMilestoneCompletions` is called synchronously in `createTransactionAction`. If this fails, the error is not caught separately — the whole `createTransactionAction` would throw and the frontend would show "Failed to create transaction — please try again" (`NewTransactionForm.tsx:905`). The overlay would close and the user would remain on the form. The transaction may or may not have been written, depending on where the failure occurred (the transaction creation itself is not inside the milestone call's error boundary).

`createInitialRemindersInline` is caught with `.catch(console.error)` — failure is silently logged, not surfaced to the user. `evaluateTransactionReminders` is `void`-prefixed — failure is fully silent.

### Brand-new director tries to invite negotiator before setting up sending addresses

The director invitation (via `InviteDirector` component or `TeamManagement`) sends an email to the negotiator. This email goes via SendGrid using the system sender `updates@thesalesprogressor.co.uk` — not the director's personal sending address. No sending address verification is needed to invite team members.

However, when the director or negotiator later wants to send a portal invite to a client, the invite email also goes via the system sender. The sending addresses section is only needed if the user wants client-facing emails to appear from their personal address. A new user can send portal links to clients immediately without any email verification.

---

## 9. The Hub at first glance — empty state

When `pipelineStats.activeFiles === 0 && attentionItems.length === 0`:

**Stat cards**: The four pipeline health stat cards (Active files, Exchanging soon, Need attention, Pipeline value) are rendered as ghost skeleton placeholders inside a card at 30% opacity. No actual values are shown — placeholders only. The "Coming up" strip and "Stalled files" row from the full hub are not present in the empty state layout.

**Momentum ring**: Shown as a ghost skeleton circle at 30% opacity.

**Attention section**: Shown as a ghost skeleton with 3 placeholder rows at 30% opacity.

**Exchange forecast**: Shown as a ghost bar chart at 30% opacity.

**Service split donut**: Shown as a ghost circle at 30% opacity.

**Prominent CTA**: The welcome CTA card is shown at full opacity and interactivity with text "Your pipeline starts here. / Add your first sale and we'll track it from offer to completion." and an "Add a sale" button. This is the only fully interactive element in the content area below the header.

**Additional CTA in header**: A "New sale" button is always in the page header (both empty and populated state).

**Stalled/attention sections**: Not hidden, but rendered as non-interactive ghost UI. They do not show "0 results" — they show skeleton placeholders that look like real content.

**Activity ribbon**: Not shown in the empty state (only rendered when `recentActivity` data exists, which requires transactions).

---

## 10. Worth flagging

1. **Agency name defaults to user's full name if skipped**: The registration form labels "Agency name" as optional (`(optional)` label, `app/register/page.tsx:301–304`). If the field is left blank, the user's full name is used as the agency name. This name appears in the portal emails sent to clients. A user who registers as "Sarah Jones" without entering their agency name will have clients receive emails from "Sarah Jones" (not their actual firm name). The same applies to the OAuth signup completion form (`app/signup/complete/CompleteSignupForm.tsx:208`).

2. **Purchase price is optional but the onboarding checklist doesn't cover it**: Pipeline value on the hub shows £0 for files without a price. The "This seems low" warning fires below £1,000,000 — in parts of the UK (e.g. certain London boroughs) this is realistic, but for most UK residential property the threshold is reasonable. Note the form stores prices in pence internally.

3. **The negotiator invitation landing page has a different visual design**: `/invite-negotiator/[token]` uses a plain white card on a cream gradient (`app/invite-negotiator/[token]/page.tsx:16–32`), while `/invite/[token]` (director invitation) uses the SunriseBackground frosted glass card. These are inconsistent and look like different products.

4. **`hasThemeSet` checklist step auto-clears after 14 days regardless of actual theme choice**: The `THEME_GRACE_MS` check in `app/api/agent/onboarding-progress/route.ts:40–48` means that after 14 days, the checklist marks this step as done even if the user never picked a theme. The "Sunset" theme is shown as default without explicit selection. A user could complete all 6 checklist steps without ever visiting settings.

5. **The onboarding checklist dismissal is localStorage-only**: Dismissing the checklist stores the dismissed state in `localStorage` keyed by `sp_onboarding_dismissed_[userId]`. Clearing browser storage, switching devices, or using a private browser window will show the checklist again — potentially with steps already complete (it will auto-dismiss silently if all steps are done, but it will flash briefly).

6. **The "Share the portal with a client" checklist step links to `/agent/comms`**: This is the Updates/Comms section of the nav, not the transaction's Contacts section where the actual "Send invite" button lives (`OnboardingChecklist.tsx:40`). A new user following the checklist step will land on the Updates page, which is not where portal invites are sent.

7. **The `progressedBy` toggle at file creation is labelled "Self-progress" vs "With progressor"**: Selecting "With progressor" (outsourced mode) requires both a vendor and purchaser contact with at least a phone or email. However, the system does not actually route the file to an internal progressor on creation — the `assignedUserId` is not set for agency-created transactions (`app/actions/transactions.ts:86`: `assignedUserId: isAgent ? undefined : session.user.id`). The `progressedBy` field is set but the assignment mechanism for outsourced files is the known gap documented in CLAUDE.md.

8. **Welcome modal fires `markWelcomeSeenAction()` on mount before the user does anything**: If the modal renders and is immediately dismissed (or if the component unmounts before the user sees it), the flag is already set to `true`. The modal will not appear again. There is no "show me this again" mechanism.

9. **Duplicate address detection is case-insensitive and normalises spaces but is address-string-only**: It does not check postcode, UPRN, or any structured field. "14 Elmwood Avenue" and "14 Elmwood Ave" would not be detected as duplicates. The user can bypass the duplicate warning via "Create anyway".

10. **The `viewer` role is routed to `/dashboard` (internal staff view) not `/agent/hub`**: If a negotiator invitation is mishandled and a user ends up with `role: "viewer"`, they will see the internal dashboard (dark backdrop, glass sidebar) rather than the agent app. This is confusing but the role is not in production use.

11. **No welcome email is sent at any point in the sign-in or registration flow**: Not on registration, not on first login, not on OAuth signup completion. The first email a new user receives from the system is either a portal invite (if they trigger one) or a password reset. Team invitation emails are sent to the invitee (negotiator or director) but these are from the system, not the registering user.

12. **Password is shown as `••••••••` placeholder but there is no password strength indicator beyond the 8-character minimum**: The only validation is `password.length >= 8`. No complexity requirement, no strength meter.
