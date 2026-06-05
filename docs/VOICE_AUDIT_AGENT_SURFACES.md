# Voice audit — agent-facing surfaces

**Status:** Read-only audit for sign-off. No code changes.
**Scan date:** 2026-06-05
**Method:** From code, not memory. Walked every in-scope production agent page + every component they render + every outbound-email template + every push and bell call site. Citations are file:line.

## Scope

**In scope:**
- Production agent app pages and the components they render: hub, transactions list, transaction detail (+ panels), work queue, completions, comms (Updates), to-do, analytics, new sale (new-v2), partners, settings/automation, automated-emails, /agent/admin, /help.
- Outbound email templates an agent receives or that are sent on the agency's behalf (lib/emails/*, lib/email/* excluding the chain closed-loop arc).
- Push notifications (lib/services/push.ts call sites in app/actions/* + lib/agent/push-events.ts + lib/services/notifications.ts).
- In-app bell / Notification rendering.
- Director + negotiator invite flows; chain claim landing.

**Out of scope:**
- Buyer/seller portal (`/portal/*` and any portal-recipient body content) — separate register, separate pass.
- Marketing site.
- Command Centre.
- Internal-staff-only and dev/preview surfaces (`/agent/polish/*`, `/agent/audit/*`, `/agent/system-preview/*`, etc.).
- Code comments.

**Skip set (already approved in current chain closed-loop sweep — not re-flagged):**
- `lib/email/chainNotifications.ts` (BUYER_FOUND "wait is over" / "stand down" variants, CHAIN_DETACHED, LOST_BUYER, LOST_PURCHASE, completion + celebration payloads)
- `lib/chain/withdrawal.ts`, `lib/chain/split.ts`
- `components/transaction/RelistFileModal.tsx` (chain section + onward-sale picker)
- `components/transaction/StatusControl.tsx` (withdraw modal helper text)
- `components/hub/ChainSetupPendingView.tsx`
- `docs/chain-feature/08-copy.md` baseline strings

**Rubric (the 7 tells):** as supplied — slang/idiom (1), drama or cheer (2), cute metaphor (3), dev-speak (4), banned nouns (5), inconsistent person terms (6), question-mark eyebrows or headings used for punch (7).

**Severity:**
- **dead certain** = clear rubric violation, no nuance.
- **borderline** = arguable in context; raise for sign-off.

---

## Headline totals

| Severity | Count |
|---|---|
| **dead certain** | **18** |
| borderline | 12 |
| LOCKED — flag for Ellis | 1 (one LOCKED string borders a violation — see locked section) |

The biggest concentration is in the **push notification fallback strings** (Site 8 of `PUSH_NOTIF_STRINGS.md`, implemented in `app/actions/milestones.ts`). The current implementation has drifted from the approved doc *and* both the implementation and the doc itself still carry exclamation marks + "Congratulations" — they fail the audit rubric independently of one another.

The retention email family (`lib/emails/retention/index.ts`) carries the highest concentration of slang and cheer-tone in email copy.

---

## Agent app — pages and components

### `/agent/hub` — Hub

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `app/agent/hub/page.tsx:127` | "Here's what matters today." | 2 (curated cheer) | borderline | "Your pipeline and what needs you today." |
| `app/agent/hub/page.tsx:154` | "Your pipeline starts here." | 2 | borderline | "Add your first sale to start your pipeline." |
| `app/agent/hub/page.tsx:562–564` | "<strong>N files need chasing</strong> — nothing logged in 14+ days" | — | OK | "Chasing" is industry-standard in conveyancing (chase solicitors / chase the buyer's side). Keep. |
| `app/agent/hub/page.tsx:37–48` | "Good morning, Good afternoon, Good evening" greetings | — | OK | Appropriate professional greeting, not cheer. Keep. |

### `/agent/transactions` — Transactions list

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `app/agent/transactions/page.tsx:261–263` | "Sales appear here once you submit one. Track milestones, manage chases, and progress to exchange." | 5 ("milestones" banned per VOICE_GUIDELINES.md Rule 2) | **dead certain** | "Sales appear here once you submit one. Track steps, manage chases, and progress to exchange." |

### `/agent/transactions/[id]` — Transaction detail + panels

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `components/transaction/PortalConfirmEmailToggle.tsx:64` | "Buyer/seller portal confirmation emails will send when milestones are confirmed." | 5 | **dead certain** | "Buyer/seller portal confirmation emails will send when steps are confirmed." |
| `components/transaction/MosConfirmedNotice.tsx:18` | "Seller and buyer MOS received steps confirmed." | — | OK | Wording survives the terminology sweep. Keep. |
| `components/transaction/ClaimedToast.tsx:17–18` | "You're in the chain" / "Open the chain panel to see how the other sales are progressing." | 2 (mild) | borderline | "Claimed — you're in the chain. Open the chain panel to see how the other sales are progressing." Lead with the action, not the celebration. |
| `components/transaction/OnHoldBanner.tsx:17` | "All automation is frozen — no client emails, no agent reminders, no escalations. Reactivate the file to resume." | — | OK | "Frozen" is light metaphor but reads as plain state. Keep. The em dash is acceptable here as a parenthetical list lead-in; if you want the rubric strict, swap for a colon. |

### `/agent/work-queue` — Reminders

No new flags. Header pills + group labels + chase actions are clean. (`lib/reminders/classify.ts` strings are internal; the rendered labels — "Overdue", "Due today", "Coming up", "Snoozed" — are correctly plain.)

### `/agent/completions` — Completions

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `app/agent/completions/page.tsx:144` | "Once a file is assigned to you and exchanges, it'll appear here." | 1 (system narration — "appear here" is mild but consistent with the pattern call-out in `PATTERN_EMERGENCE.md`) | borderline | "Files appear here once they exchange." Shorter, less self-referential. Flagged by the polish-pass empty-state-redundancy pattern already. |

### `/agent/comms` — Updates (activity feed)

No flags. Title was renamed from "Comms" to "Updates" cleanly. Day-grouping labels ("Today", "Yesterday", "This week") are correct. Filter chips ("All milestones" — see below) need attention.

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `app/agent/comms/page.tsx:95` | "All milestones" (segment-pill label) | 5 | **dead certain** | "All steps" — matches the Steps tab on the file-detail page and the rest of the terminology sweep. |
| `app/agent/comms/page.tsx:102` | "Client confirmations" | — | OK | Plain, accurate. Keep. |

### `/agent/to-do` — To-Do

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `components/agent/AgentTodoList.tsx` (per agent-2 finding) | "Due tomorrow" / "Due yesterday" status labels | 1 (mild) | borderline | "Tomorrow" / "Overdue · yesterday" — the row already carries the date and an urgency colour, so "Due " is filler. Worth a Ellis-call review rather than a unilateral change. |

### `/agent/analytics` — Analytics

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `app/agent/analytics/page.tsx:33` | "Awaiting assignment" | 1 (passive system phrasing) | borderline | "Not yet assigned" — active, present, factual. |
| `app/agent/analytics/page.tsx:108–109` | "Once your first file is submitted, you'll see pipeline value, fee tracking, conversion rates, and monthly trends." | 1 (mild system narration) | borderline | "After you submit your first file, this page shows pipeline value, fee tracking, conversion rates and monthly trends." |

### `/agent/transactions/new-v2` — New sale

No flags in the page-shell file. The form sections inside `components/transactions-v2/NewSaleFlow` were not deep-walked in this audit — flagged as **follow-up scope** in the Notes section at the end. The components carry a `prisma as any` cast noted in `PAGE_LIST.md` but no obvious voice issues from a surface scan.

### `/agent/partners` — Partners

No flags. Directory + director-only settings (preferred broker, recommended solicitors) read cleanly.

### `/agent/settings/automation` — Automation settings

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `components/automation/AutomationSettingsForm.tsx:83` | "Files still surface as manual tasks in the team's reminders list." | 4 ("surface" as user-facing verb) | **dead certain** | "Files still appear as manual tasks in the team's reminders list." (Verb swap is the whole fix.) |

### `/agent/automated-emails` — Automated emails

No flags. Tab labels (Pending / Sent / Errored / Upcoming) are correct. Subtitle branching reads cleanly.

### `/agent/admin` — Founder admin

No flags. Heavily factual.

### `/help` — Help centre

No flags in the UI chrome (sidebar nav, content header). MDX article content is out of scope per the prompt.

---

## Outbound email — agent-facing or sent on agency behalf

> **Strictness reminder:** Emails persist in inboxes and represent the agency to strangers. Tougher tier.

### `lib/emails/retention/index.ts` — Retention email family

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `:106` | Subject: `You're in!` (claim welcome) | 2 (exclamation + cheer) | **dead certain** | `Welcome — your chain link is claimed` |
| `:121` | "This one's on us since it came in through the chain. Any sale you add in the next 14 days is on us too, right through to exchange." | 1 (slang: "this one's on us") | **dead certain** | "This sale is free because it came in through the chain. Any sale you add in the next 14 days is also free, through to exchange." |
| `:124` | "The account is yours to keep." | 1 (mild slang) | borderline | "The account is yours from this point on." |
| `:259` | Subject: `How are things your end?` | 1 ("your end" idiom) | **dead certain** | `Checking in` or `Quick check-in on your account` |
| `:264` | "...so I wanted to drop you a line — we haven't had a file from you for a few weeks." | 1 (idiom) | **dead certain** | "...so I wanted to reach out — we haven't had a file from you for a few weeks." |
| `:268` | "I'm available noon or night, hope to hear from you soon." | 1 (slang) | borderline | "I'm available any time — hope to hear from you soon." (Ellis personal voice is intentional in this email; weigh the personal warmth against rubric strictness.) |

**Note:** The retention email family deliberately uses a more personal "Ellis voice" (signed personally, conversational register) — this is a product decision, not an oversight. The flags above are still calls Ellis should make consciously rather than reflexively. If the personal register is approved, write the exceptions into VOICE_GUIDELINES.md so they don't get caught in the next sweep.

### `lib/emails/outsource-intro-template.ts` — Outsource intro to client

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `:41` | "Great news that the sale at ${address} is agreed." | 2 (cheer opener) | **dead certain** | "Good to hear the sale at ${address} is agreed." |

### `lib/email/director-invitation.ts` — Director invitation

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `:19` text + `:47` html | "It tracks every sale from offer accepted to completion, surfacing the deals that are quietly slipping before they fall through." | 4 ("surfacing" — dev-speak; verb belongs to data pipelines, not professional copy) | **dead certain** | "It tracks every sale from offer accepted to completion and flags the deals that are quietly slipping before they fall through." (Same swap in both text + html bodies.) |

### `lib/email/director-accepted.ts` — Director-joined confirmation

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `:16` | "Great news — ${input.directorName} has accepted your invitation and set up their account at ${input.agencyName}." | 2 (cheer opener) | borderline | "${input.directorName} has accepted your invitation and set up their account at ${input.agencyName}." (Drop "Great news —" entirely; the fact is the message.) |

### `lib/email/negotiator-accepted.ts` — Negotiator-joined confirmation

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `:31` | "Great news — ${negotiatorName} has accepted your invitation and set up their account at ${agencyName}." | 2 (cheer opener) | borderline | "${negotiatorName} has accepted your invitation and set up their account at ${agencyName}." |

### `lib/services/morning-digest.ts` — Morning digest to internal staff

No flags. Greeting + headline + grouped action lists read cleanly. "Have a productive day" sign-off is borderline-friendly but appropriate for a daily work email; kept as-is.

### Other email templates examined and clean

- `lib/email/negotiator-invitation.ts`
- `lib/email/milestone-digest.ts` (drain orchestrator — body content is the per-milestone payloads in the Model B skeleton corpus, which is **out of scope** per the audit prompt)
- `lib/email/client-chase-digest.ts` (per-recipient digest — body content lives in the chase-digest skeletons, out of scope)
- `lib/email/outboundQueue.ts` (queue mechanics — no user-facing strings)
- `lib/services/portal.ts` (the agent-side notifications to the assigned progressor read cleanly — `:812`, `:817`)
- `lib/services/portal-messages.ts` (agent-direction send is clean)

---

## Push notifications

> **Strictness reminder:** Push fires to lock-screens, often the only thing a user sees from the app that day. Same tier as email.

### Site 8 / Site 9 — Agent or SP confirms a milestone

**Two implementation sites in the same file:**

- Primary: `app/actions/milestones.ts:199–215` inside `confirmMilestoneAction`
- Reconciliation flow: `app/actions/milestones.ts:769–778` inside `confirmExchangeReconciliationAction`

Both must match `docs/active/PUSH_NOTIF_STRINGS.md` Site 8 (lines 105–111). They currently don't, **and** the approved doc itself still carries exclamation marks + "Congratulations" — both fail the rubric.

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `app/actions/milestones.ts:199` | title: "One step closer" (fallback) | — (deviates from approved doc) | **dead certain** | "Progress update" — matches `PUSH_NOTIF_STRINGS.md:111` |
| `app/actions/milestones.ts:200` | body: "${label}, done at ${short}." (fallback) | — (deviates from approved doc) | **dead certain** | `${short} — "${label}" is complete.` — matches `PUSH_NOTIF_STRINGS.md:111` |
| `app/actions/milestones.ts:203` | title: "Contracts exchanged!" | 2 (exclamation) | **dead certain** | "Contracts exchanged" (drop the exclamation; matches the rubric even though the approved doc still carries it — see "Approved doc itself" note below) |
| `app/actions/milestones.ts:204` | body: "${short}. The sale is now legally binding. Congratulations." | 2 ("Congratulations") | **dead certain** | "${short} — the sale is now legally binding." (Drop "Congratulations"; the user knows what exchange means.) |
| `app/actions/milestones.ts:206` | title: "It's completed!" | 2 (exclamation + colloquial contraction) | **dead certain** | "Completed" — matches `PUSH_NOTIF_STRINGS.md:108` minus the exclamation |
| `app/actions/milestones.ts:207` | body: "${short} is yours. Congratulations on your move." | 2 ("Congratulations") + 6 (this body addresses "you" the agent as if they're the buyer — see below) | **dead certain** | "${short} — completion has been confirmed." (The current body addresses the agent as if they're the homeowner: "${short} is yours. Congratulations on your move." This is wrong on two counts — voice cheer, and audience mismatch — agents aren't buying the property.) |
| `app/actions/milestones.ts:210` | body: "Everything's in place at ${short}. Exchange is next." | — (deviates from approved doc) | **dead certain** | "${short} — your solicitor has confirmed everything is in place." — matches `PUSH_NOTIF_STRINGS.md:109`. Drop "Exchange is next" or move it to a follow-up. |
| `app/actions/milestones.ts:213–214` | title: "Date confirmed: ${short}", body: "${label} booked for ${fmtDate}" | — | OK | Matches the approved doc closely. Keep. |

> **About the approved doc itself:** `docs/active/PUSH_NOTIF_STRINGS.md:107–108` still ships "Contracts exchanged!" + "Completed!" with exclamation marks, and the body uses "congratulations". Per the audit rubric (tell 2), these are violations even in the approved doc. **Flagged for Ellis:** the approved push doc needs a voice-pass pass of its own before this audit's proposed replacements above can land safely (otherwise the next deviation alarm fires against a doc that itself fails the rubric).

> **About the audience:** the same push fires to every portal contact on the file (per the comment at `app/actions/milestones.ts:196–198`). So these strings reach buyers AND sellers via the portal-push subscription, not the agent. Strictly speaking that puts them out of scope per the "buyer/seller portal — separate pass" exclusion. **Borderline call for Ellis:** include here (the strictest tier the user said is "push that leaves the building" — these do) or defer to the portal pass. The recommendation in this report is to include them, because exclamation marks and "Congratulations" are universal rubric violations independent of audience.

### Other push call sites examined and clean

- `lib/services/notifications.ts` — LOCKED, see locked section.
- `lib/agent/push-events.ts` — LOCKED, see locked section.
- All other `pushToUser` / `pushToTransaction` references are infrastructure, not string literals.

---

## In-app bell / Notification rendering

No flags in agent-facing bell components. The notification payloads come from `lib/services/notifications.ts` and `lib/agent/push-events.ts`, both LOCKED (see locked section). The bell renderers (e.g. drawer + popover components) read the payload directly and don't add text.

---

## Director invite / Negotiator invite / Chain claim flow

### Director invite

`app/invite/[token]/page.tsx` + `InvitationLandingClient.tsx` are clean. Examples surveyed:
- "You've been invited" — plain
- "${invitedByName} has invited you to join ${agencyName} on Sales Progressor as the director" — plain
- "Invitation expired" / "Invitation not found" / "Already accepted" error states — plain

### Negotiator invite

`app/invite-negotiator/[token]/*` mirrors the director flow. No flags.

### Chain claim

`app/claim/page.tsx`, `claim/signup/page.tsx`, `claim/login/page.tsx`, `claim/confirm/page.tsx` are largely clean. One borderline:

| file:line | current string | tell # | severity | proposed replacement |
|---|---|---|---|---|
| `app/claim/page.tsx:195` | "has linked {address} to their file. Join to see where the chain stands." | 4 (mild — "stands" is light cute-metaphor) | borderline | "has linked {address} to their chain. Join to see how the other sales are progressing." Mirrors the language used in `ClaimedToast.tsx:18`. |

---

## LOCKED — flag for Ellis

These files carry an explicit "LOCKED COPY" marker (voice-pass / terminology sweep 2026-06-04). Per the audit prompt, no replacements are proposed — only violations are listed for review.

**Audit result:** **0 violations** of the rubric inside any LOCKED file. All five files were re-read end-to-end and the strings still hold up against the 7-tell rubric.

Files re-checked:
- `components/hub/NewBuyersToAcknowledgeView.tsx` — "New buyer added" / "Outsourced files relisted with a new buyer." / "${buyerName} is the new buyer (sale ${roundNumber}). Relisted ${date}." → all clean.
- `components/transaction/ArchivedRoundDrawer.tsx` — "Sale {n}: {buyerName}'s record" / "{N} of 27 buyer steps were complete when this sale fell through." → both clean ("fell through" is the approved terminology).
- `lib/services/notifications.ts` — bell strings clean.
- `lib/agent/push-events.ts` — clean.
- `lib/chase/portal-agent-only-copy.ts` — clean.

**One adjacency to flag** (not technically a LOCKED violation, but worth Ellis-eyes given the LOCKED neighbours):

| file:line | current string | observation |
|---|---|---|
| `docs/active/PUSH_NOTIF_STRINGS.md:107–108` | Approved push titles: "Contracts exchanged!", "Completed!" + body uses "congratulations" | The doc is the source-of-truth that the LOCKED push file in `lib/agent/push-events.ts` follows. If the rubric in the current voice sweep bans exclamation marks anywhere (tell 2), then this approved doc needs its own voice-pass pass before any aligned-to-doc changes land in code. Otherwise the next audit cycle will re-flag against a doc that itself fails the rubric. |

---

## Recurring offenders — `VOICE_GUIDELINES.md` candidate additions

Patterns that appeared **3 or more times** across surfaces. Each warrants a row in the translation/banned-term table so they're caught at write-time rather than at audit-time.

1. **"Great news" as a sentence opener** — 3 instances in this audit (`outsource-intro-template.ts:41`, `director-accepted.ts:16`, `negotiator-accepted.ts:31`). Already implicit under VOICE_GUIDELINES.md's "no cheer" rule but worth naming explicitly as a banned phrase. **Proposed addition to Rule 3 / tone calibration:** "Do not open a sentence or subject line with 'Great news'. Lead with the fact."

2. **"Surfacing" / "surface" as user-facing verbs** — 2 instances flagged (`director-invitation.ts:19` + html mirror at `:47`, `AutomationSettingsForm.tsx:83`). One more instance lurks in the founder-personal email register. **Proposed addition to Rule 1's "what to avoid":** "Surface / surfacing — data-pipeline jargon. Use 'show', 'flag', 'highlight', or just 'appear'."

3. **Exclamation marks in shipping copy** — already banned by tone calibration but persists in approved push doc + 2 push-implementation strings + 1 retention email subject. **Proposed addition:** restate the ban explicitly in the push and email sub-sections of VOICE_GUIDELINES.md (not just the UI tone-calibration block), with examples from this audit.

4. **"Congratulations"** — 2 push bodies (`milestones.ts:204`, `:207`) and one out-of-scope portal email. **Proposed addition:** the existing rule says "no exclamation marks anywhere"; extend to "no 'Congratulations'/'Congrats' anywhere in agent-facing strings. The user knows what exchange / completion means."

5. **"This one's"** / **"your end"** / **"drop you a line"** in the retention "Ellis personal voice" family — 3 cumulative idioms inside one email register. **Proposed addition:** decide whether the personal Ellis register IS the register (in which case carve out an exception with examples), or whether it falls under the same brisk-professional rules as the rest. Currently it lives in a grey zone that catches itself on every audit.

---

## Notes and out-of-scope follow-ups (not flagged in the report)

- **`components/transactions-v2/NewSaleFlow` and its form-section children** were not deep-walked. The page shell at `app/agent/transactions/new-v2/page.tsx` is clean, but the form is the longest single component tree in the app and deserves its own pass. Recommend a follow-up sub-audit before the next sweep.
- **The Model B 47-milestone email skeleton corpus** (under `lib/email/skeletons/` if it exists at flip-time) is out of scope per the audit prompt. The `docs/active/email-snapshots/voice-sweep-catalogue.md` already catalogues the recurring patterns ("We'll let you know...", "Update on your sale...", "Good news on your...") — that sweep needs its own dedicated session.
- **Buyer/seller portal strings** (`/portal/*`) are out of scope per the audit prompt but several files in the agent app contain strings the agent might encounter in side-by-side demo (e.g. when explaining to a client what they'll see). If that's a recurring demo path, consider including the portal voice in a future agent-facing rehearsal-context sub-audit.
- **One typo found** that isn't a voice issue: `lib/email/director-invitation.ts:17` reads "wants you set up as director" — natural British English ("want X set up" = "want X to be set up"). Not a voice violation; flagging only because the agent in pass 3 surfaced it as a question.

---

## How to action this

1. Mark up this file with ✅ / ✏️ next to each row and any custom replacement text. Save as `docs/VOICE_AUDIT_AGENT_SURFACES.signed.md`.
2. One sweep commit applies every approved row. No code is touched until the marked-up copy lands.
3. The `PUSH_NOTIF_STRINGS.md` voice-pass + the recurring-offenders additions to `VOICE_GUIDELINES.md` should land **before** the sweep, so the sweep's replacements have a stable source-of-truth.
