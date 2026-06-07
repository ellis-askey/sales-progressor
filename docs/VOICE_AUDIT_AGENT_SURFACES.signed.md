# Voice audit — agent-facing surfaces — SIGNED

**Status:** Signed off 2026-06-05. Applied in one sweep commit (see git log for SHA).
**Method note:** From code, not memory. Walked every in-scope production agent page + every component they render + every outbound-email template + every push and bell call site. Citations are file:line. This file is the record of decisions; the unmarked original audit lives at [docs/VOICE_AUDIT_AGENT_SURFACES.md](docs/VOICE_AUDIT_AGENT_SURFACES.md).

> Marked decisions: ✅ applied · ✏️ applied with revised replacement · ❌ rejected (with reason) · 🔒 locked, no action.

---

## Decisions

### Terminology / dev-speak

| # | file:line | current | severity | decision | landed text |
|---|---|---|---|---|---|
| T1 | `app/agent/transactions/page.tsx:261` | "Track milestones, manage chases" | dead certain | ✅ | "Track steps, manage chases" (rest of sentence unchanged) |
| T2 | `components/transaction/PortalConfirmEmailToggle.tsx:64` | "when milestones are confirmed" | dead certain | ✅ | "when steps are confirmed" |
| T3 | `app/agent/comms/page.tsx:95` | "All milestones" (segment-pill label) | dead certain | ✅ | "All steps" |
| T4 | `components/automation/AutomationSettingsForm.tsx:83` | "Files still surface as manual tasks…" | dead certain | ✅ | "Files still appear as manual tasks in the team's reminders list." |
| T5 | `lib/email/director-invitation.ts:19` + html mirror at `:47` | "…surfacing the deals that are quietly slipping before they fall through" | dead certain | ✅ | "…and flags the deals that are quietly slipping before they fall through" (both text + html) |

### Email cheer / slang

| # | file:line | current | severity | decision | landed text |
|---|---|---|---|---|---|
| E1 | `lib/emails/outsource-intro-template.ts:41` | "Great news that the sale at ${address} is agreed." | dead certain | ✅ | "Good to hear the sale at ${address} is agreed." |
| E2 | `lib/email/director-accepted.ts:16` (text) + html mirror | "Great news — ${directorName} has accepted…" | borderline | ✅ | Drop the "Great news — " opener: "${input.directorName} has accepted your invitation and set up their account at ${input.agencyName}." |
| E3 | `lib/email/negotiator-accepted.ts:31` (text) + html mirror | "Great news — ${negotiatorName} has accepted…" | borderline | ✅ | Same fix as E2 for negotiator. |
| E4 | `lib/emails/retention/index.ts:106` | subject "You're in!" | dead certain | ✅ | subject "Your account is ready" |
| E5 | `lib/emails/retention/index.ts:121` | "This one's on us since it came in through the chain. Any sale you add in the next 14 days is on us too, right through to exchange." | dead certain | ✅ | "This sale is free because it came in through the chain. Any sale you add in the next 14 days is also free, through to exchange." |
| E6 | `lib/emails/retention/index.ts:259` | subject "How are things your end?" | dead certain | ✅ | subject "How are things going?" |
| E7 | `lib/emails/retention/index.ts:264` | "…so I wanted to drop you a line — we haven't had a file from you for a few weeks." | dead certain | ✏️ | "…so I wanted to get in touch. We haven't had a file from you for a few weeks." (Replaces both the "drop you a line" idiom AND the em dash, swapping it for a full stop. Surrounding paragraph intact.) |
| E8 | `lib/emails/retention/index.ts:268` | "I'm available noon or night, hope to hear from you soon." | borderline | ✅ | "I'm available any time, and I hope to hear from you soon." |
| E9 | `lib/emails/retention/index.ts:124` | "The account is yours to keep." | borderline | ❌ | Rejected — stays as-is. |

### Small UI

| # | file:line | current | severity | decision | landed text |
|---|---|---|---|---|---|
| U1 | `app/agent/hub/page.tsx:154` | "Your pipeline starts here." | borderline | ✅ | "Add your first sale to start your pipeline." |
| U2 | `app/agent/completions/page.tsx:144` | "Once a file is assigned to you and exchanges, it'll appear here." | borderline | ✅ | "Files appear here once they exchange." |
| U3 | `app/agent/analytics/page.tsx:33` | "Awaiting assignment" | borderline | ✅ | "Not yet assigned" |
| U4 | `app/agent/analytics/page.tsx:108–109` | "Once your first file is submitted, you'll see pipeline value, fee tracking, conversion rates, and monthly trends." | borderline | ✅ | "After you submit your first file, this page shows pipeline value, fee tracking, conversion rates and monthly trends." |
| U5 | `components/transaction/ClaimedToast.tsx:17` | title "You're in the chain" | borderline | ✅ | title "Chain claimed" (body at `:18` unchanged) |
| U6 | `app/claim/page.tsx:195` | "has linked {address} to their file. Join to see where the chain stands." | borderline | ✅ | "has linked {address} to their chain. Join to see how the other sales are progressing." |
| U7 | `components/transaction/OnHoldBanner.tsx:17` | "All automation is frozen — no client emails, no agent reminders, no escalations. Reactivate the file to resume." | borderline | ✅ | em dash → colon: "All automation is frozen: no client emails, no agent reminders, no escalations. Reactivate the file to resume." |
| U8 | `app/agent/hub/page.tsx:127` | "Here's what matters today." | borderline | ❌ | Rejected — stays as-is. |
| U9 | `components/agent/AgentTodoList.tsx` "Due tomorrow" / "Due yesterday" | borderline | ❌ | Rejected — stays as-is. |

### Push notifications — rejected as a group

| # | scope | decision |
|---|---|---|
| P1 | `app/actions/milestones.ts:199–215` and `:769–778` (all branches: fallback, VM19/PM26, VM20/PM27, VM18/PM25 push titles + bodies) | ❌ Rejected |
| P2 | `docs/active/PUSH_NOTIF_STRINGS.md:107–108` (exclamation marks + "Congratulations" in approved strings) | ❌ Rejected |

**Decision recorded for future audits:** these push strings reach buyers and sellers (the push fires to every portal contact on the file, per the comment at `app/actions/milestones.ts:196–198`). They are **intentionally lighthearted for that audience** and belong to the portal register, not the agent one. Future agent-surface audits should **not re-flag them** — the rubric in this audit (no exclamation marks, no "Congratulations") applies to the agent register; the portal register has its own (warmer) calibration and is owned by the portal pass. Recorded here so the next pass doesn't loop on the same flags.

### LOCKED files — re-checked

Re-checked end-to-end against the 7-tell rubric. **Zero violations.** The 2026-06-04 locks hold:
- `components/hub/NewBuyersToAcknowledgeView.tsx` 🔒
- `components/transaction/ArchivedRoundDrawer.tsx` 🔒
- `lib/services/notifications.ts` 🔒
- `lib/agent/push-events.ts` 🔒
- `lib/chase/portal-agent-only-copy.ts` 🔒

---

## `VOICE_GUIDELINES.md` additions (landed in the same sweep)

Four additions appended to `docs/polish-pass/VOICE_GUIDELINES.md`:

1. **Ban "Great news" as a sentence or subject opener** in agent-facing copy. Lead with the fact. (Source: 3 instances in this audit — outsource-intro, director-accepted, negotiator-accepted.)
2. **Ban "surface" / "surfacing" as user-facing verbs**. Use **show**, **flag**, **highlight**, or **appear**. (Source: director-invitation email body + AutomationSettingsForm.)
3. **Ban "Congratulations" / "Congrats" and exclamation marks in AGENT-facing strings**, restated explicitly in the email sub-section. The portal-facing register (push, portal emails) may use a deliberately warmer tone; that register is owned by the portal pass, not this doc. (Source: cross-cutting rubric tightening.)
4. **New exception block — founder-signed retention emails** may use a personal register (first person, contractions, warmth) but the bans on exclamation marks, slang idioms and "Congratulations" still apply. Calibration examples cite the E5/E6/E7 rewrites above.

---

## Em-dash census (tell-8 — Ellis decides app-wide policy)

This census was missing from the original audit and added at sign-off. Read-only, no rewrites. The 18 rewrites above already remove em dashes where they coincided with other flags (E2, E3, E7, U7) — those rows in the census are now historical. The remaining em-dash count below is **before** this sweep landed.

### Total (in-scope, user-facing strings only)

| Bucket | Count |
|---|---|
| `app/agent/*` (pages) | 3 |
| `app/{claim,invite,invite-negotiator,login,register,forgot-password,reset-password,signup}/*` | 3 |
| `components/agent/*` | 11 |
| `components/hub/*` | 6 |
| `components/transaction/*` | 1 (OnHoldBanner — removed by U7) |
| `components/milestones/*` | 8 |
| `components/transactions-v2/*` (new-sale form tree) | 14 |
| `components/transactions/*` (list) | 3 |
| `components/reminders/*` | 13 |
| `components/billing/*` | 6 |
| `components/account/v2/*` | 4 |
| `lib/emails/retention/index.ts` (text + html bodies) | 17 |
| `lib/email/director-accepted.ts` + `negotiator-accepted.ts` | 5 (3 removed by E2 + E3) |
| `lib/email/medians-ready.ts` (internal-staff email, borderline scope) | 14 |
| **Total (before sweep)** | **~108** |
| **Total (after sweep removes E2/E3/E7/U7 instances)** | **~99** |

> The original audit agent reported a total of 71; on re-tally the per-file enumerations sum higher. Treating the per-file lists as the source of truth gives ~108 instances before the sweep; the agent's roll-up appears to have under-counted multi-instance lines and a few clusters. Ellis: use the per-file lists below to pick a policy.

### By file (file:line + string fragment, no rewrites)

#### Auth + onboarding pages

- `app/forgot-password/page.tsx:58` `"Too many attempts — please wait a few minutes before trying again."`
- `app/register/page.tsx:192` `"Step 1 of 2 — your details"` / `"Step 2 of 2 — your workspace"`
- `app/signup/complete/CompleteSignupForm.tsx:165` `"Signed in via Google or Microsoft — can't be changed here"`

#### Agent settings / account components

- `components/agent/ThemePicker.tsx:227` `"Your personal theme — visible only to you, not your whole branch. Applies instantly."`
- `components/agent/ThemePicker.tsx:249` `"...Separate from your desktop theme — pick whatever feels easier on a small screen."`
- `components/agent/TeamListView.tsx:88` `title="Can see all agency files — click to restrict"`
- `components/agent/TeamListView.tsx:89` `title="Can only see own files — click to allow all"`
- `components/agent/AnalyticsClientShell.tsx:263` `"Files submitted — last 7 days"`
- `components/agent/AnalyticsClientShell.tsx:264` `"Files submitted — last 6 months"`
- `components/agent/AnalyticsClientShell.tsx:265` `"Files submitted — last 12 months"`
- `components/agent/AnalyticsClientShell.tsx:416` `"Conversion funnel — {periodLabel.toLowerCase()}"`
- `components/agent/AnalyticsClientShell.tsx:519` `"{N} file{...} predicted — "` (rendered forecast label)
- `components/agent/AnalyticsClientShell.tsx:551` `"Monthly activity — last 12 months"`
- `components/agent/AnalyticsClientShell.tsx:659` `"Referral income — {periodLabel.toLowerCase()}"`
- `components/agent/AnalyticsClientShell.tsx:668` `"Exchanged — due"`
- `components/agent/AccountDangerZone.tsx:42` `"Export failed — try again"`
- `components/agent/RecommendedSolicitorsSettings.tsx:165` `"Adding {pendingFirm.name} — enter case handler details"`
- `components/agent/AgentInstallPrompt.tsx:336` `"We'll alert you when buyers, sellers, or solicitors act — no need to keep checking."`

#### Hub

- `components/hub/ExpiredHoldsCard.tsx:84` `"Off hold — emails stay paused"` / `"Off hold — automation resumed"`
- `components/hub/ExpiredHoldsCard.tsx:87` `"Couldn't reactivate — try again"`
- `components/hub/ExpiredHoldsCard.tsx:101` `"Couldn't extend — try again"`
- `components/hub/ExpiredHoldsCard.tsx:223` `title="Hold indefinitely — won't auto-surface again"` (note: "auto-surface" is itself dev-speak — borderline, separate flag)
- `components/hub/ExpiredHoldsCard.tsx:272` `"— pick one. You can always change later."`
- `components/hub/ExpiredHoldsCard.tsx:283` `description="...Manual chasing only — flip back on from the Automation card any time."`
- `app/agent/hub/page.tsx:566` `{" — "}` (separator in the stalled-files row between strong + dim text)
- `app/agent/hub/page.tsx:690` `"1 exchange this week — check files are ready."` / `"N exchanges this week — check all files are ready."`
- `app/agent/hub/page.tsx:769` `<> — saving you around{" "}</>` (rendered in the service-split copy)

#### Transaction surfaces

- `components/transaction/OnHoldBanner.tsx:17` — **removed by U7 in this sweep.**
- `components/milestones/UndoMilestoneModal.tsx:88` `"{milestoneName} — what next?"`
- `components/milestones/UndoMilestoneModal.tsx:107` `"This step is undone — steps that follow stay as they are."`
- `components/milestones/UndoMilestoneModal.tsx:142` same text as :107
- `components/milestones/UndoMilestoneModal.tsx:148` `"{N} linked step{s} stayed complete — you may want to re-check them later."`
- `components/milestones/ReconciliationDrawer.tsx:136` `"Filled with today's date — change if it was different"`
- `components/milestones/ReconciliationDrawer.tsx:190` `"{getEventDateLabel(item.code)} — leave blank to exclude"`
- `components/milestones/ReconcileMilestonePicker.tsx:353` `"(auto-set — change to override)"`
- `components/milestones/MortgageModal.tsx:69` `"Yes — mortgage buyer"`

#### Transactions list

- `components/transactions/PostExchangeStrip.tsx:27` `"Exchanged — Awaiting Completion"`
- `components/transactions/TransactionRowView.tsx:408` `{tx.agency?.name ?? "—"}` (em-dash used as null placeholder)
- `components/transactions/ForecastStrip.tsx:110` `<span aria-hidden>—</span>` (visual placeholder for empty month)

#### New-sale form tree (transactions-v2)

- `components/transactions-v2/ResearchPanel.tsx:119` `placeholder="Enter postcode — e.g. BS6 7TH"`
- `components/transactions-v2/ResearchPanel.tsx:147` `"Look up any property to see sale history, EPC rating, and more — before filling in the form."`
- `components/transactions-v2/PropertyDossier.tsx:162` `"Postcode-level data — no specific property matched yet"`
- `components/transactions-v2/NewSaleFlow.tsx:708` `"Couldn't save draft — try again"`
- `components/transactions-v2/NewSaleFlow.tsx:735` `"Couldn't remove draft — try again"`
- `components/transactions-v2/HeroCard.tsx:130` `"File is too large — maximum 10 MB."`
- `components/transactions-v2/hero/MemoStatusBar.tsx:303` `"This is taking a while — "`
- `components/transactions-v2/hero/MemoStatusBar.tsx:322` `"Couldn't read the memo — fill in the form below"`
- `components/transactions-v2/form/Stage2Sections.tsx:129` `"Fill in what you have — you can add the rest after creating the file."`
- `components/transactions-v2/form/Stage1Fields.tsx:231` `"Address, tenure and purchase type are set — add contacts and details"`
- `components/transactions-v2/form/SolicitorSection.tsx:208` `"{vendorHint} is in the memo — search above to add"`
- `components/transactions-v2/form/SolicitorSection.tsx:251` `"{purchaserHint} is in the memo — search above to add"`
- `components/transactions-v2/form/PriceFeesSection.tsx:129` `"Over £50 million — double-check the figure."`
- `components/transactions-v2/form/PriceFeesSection.tsx:136` `"Under £10,000 — double-check the figure."`
- `components/transactions-v2/form/PriceFeesSection.tsx:276` `"Not on memos — still needed"`
- `components/transactions-v2/form/PriceFeesSection.tsx:294` `"— Add a sale price to calculate"`
- `components/transactions-v2/form/PriceFeesSection.tsx:296` `"— Add an agent fee to calculate"`
- `components/transactions-v2/form/FieldIndicator.tsx:44` `"Couldn't read this — add it manually."`
- `components/transactions-v2/form/FieldIndicator.tsx:45` `"Not on memos — please complete"`
- `components/transactions-v2/form/ContactsSection.tsx:290` + `ContactCarousel.tsx:236, :275` `"Couldn't read this — add contact details manually."`

#### Reminders

- `components/reminders/AutomatedEmailsCard.tsx:119` `"Auto chases paused — system-wide"`
- `components/reminders/AutomatedEmailsCard.tsx:121` `"Auto chases paused — agency-wide{...}"`
- `components/reminders/AutomatedEmailsCard.tsx:122` `"Auto chases paused — this file"`
- `components/reminders/AutomatedEmailsCard.tsx:410` `"Automation paused — file on hold"`
- `components/reminders/AutomatedEmailsCard.tsx:468` `"This file is on hold — no client chases, no escalations, no scheduled emails will fire until it's reactivated. Pending sends are held until the file resumes."`
- `components/reminders/AgentRemindersList.tsx:43–48` 6 chip labels: `"Client opted out — manual"`, `"Chased twice — manual"`, `"14d silent — manual"`, `"No email — manual"`, `"No portal — manual"`, `"Client emails paused — manual"`
- `components/reminders/RemindersSection.tsx:26–31` same 6 chip labels duplicated

#### Billing

- `components/billing/BillingNegotiatorModal.tsx:41` `"Couldn't update your role — try again"`
- `components/billing/BillingNegotiatorModal.tsx:49` `"Couldn't reach the server — check your connection and try again"`
- `components/billing/PaymentBlockBanner.tsx:45` `"New file creation paused — update your card"`
- `components/billing/PaymentBlockBanner.tsx:86` `"A payment failed — please update your card"`
- `components/billing/hub/RedesignedDisclosure.tsx:41` `"Couldn't record acknowledgement — try again"`
- `components/billing/hub/RedesignedDisclosure.tsx:46` `"Couldn't reach the server — check your connection and try again"`
- `components/billing/hub/RedesignedDisclosure.tsx:67` `"Version {termsVersionTag} — please read and confirm."`

#### Account area

- `components/account/v2/TeamListViewPlain.tsx:155–156` 2 title attributes (same as TeamListView)
- `components/account/v2/SilencedFilesSectionPlain.tsx:193` `"— Choose a file —"` (rendered option text)
- `components/account/v2/ProfileFormPlain.tsx:167` `"Changing your email updates your login — you'll need to sign out and back in for it to take effect."`

#### Emails (text + html mirrors)

- `lib/email/director-accepted.ts:16, :20, :40` — line 16 removed by E2 in this sweep; lines :20 and :40's signature `"— The Sales Progressor team"` remains
- `lib/email/negotiator-accepted.ts:31, :37, :58` — line 31 removed by E3; signature remains
- `lib/emails/retention/index.ts:17, :66, :72, :77, :80, :165, :173, :194, :200, :205, :208, :233, :242, :264, :278, :289, :309, :319` — 18 instances. Lines :17 (`"Rachel — Sales Progressor"` sender name) and :289 (`"Ellis — Sales Progressor"`) are the sender-display pattern. Lines :72/:80/:165/:173/:200/:208/:233/:242/:309/:319 are all the `"— The Sales Progressor team"` signature pattern. Lines :66/:77 (`"...one only pay when it exchanges."`), :194/:205 (`"...your first sale through Sales Progressor."`), :264/:278 (removed by E7) are body em dashes.
- `lib/email/medians-ready.ts:37, :38, :39, :43, :63, :74, :77, :88, :103, :148, :153, :159, :160, :193` — 14 instances. This is an internal-staff status email (medians-ready signal). **Borderline scope** for this audit — it's not strictly agent-facing but Ellis receives it. Included for completeness; not flagged in the audit rubric.

#### SKIP set (not counted in census per the audit prompt)

- `lib/email/chainNotifications.ts` — 17 em dashes across subject lines, email separators, and section dividers. All inside the chain closed-loop arc skip set. Not part of the census Ellis is deciding policy on.

### Pattern clusters observed

1. **Email signatures (`"— The Sales Progressor team"`)** — 10 instances across the retention family. Stylistic choice in email footers, consistent throughout.
2. **Email sender display names (`"Rachel — Sales Progressor"`, `"Ellis — Sales Progressor"`)** — 2 instances. Functional separator between human name and product.
3. **Reminder fallback chip labels** — 12 instances across AgentRemindersList + RemindersSection (6 each, duplicated). Format: `"{reason} — manual"`.
4. **Toast error messages** — 9 instances across `Couldn't X — try again` / `Couldn't X — check Y`. Consistent voice.
5. **Empty-state / null placeholders** — `tx.agency?.name ?? "—"` and `<span aria-hidden>—</span>` use em dash as a visual placeholder for missing data. Functional, not prose.
6. **Form helper text in transactions-v2** — 14 instances. Pattern: `"{primary} — {supplement}"`. Consistent across the new-sale form tree.
7. **Analytics eyebrow labels** — 7 instances in AnalyticsClientShell.tsx. Pattern: `"{Label} — {period}"`. Used as section eyebrows.

### Policy decision needed (Ellis)

Three coherent app-wide policies are on the table:

- **A. Ban em dashes app-wide.** Forces ~99 rewrites in this sweep's wake. Visually cleaner; lower risk of cross-platform rendering (some terminals + older email clients render — as a "?" or square box).
- **B. Allow em dashes only where they functionally separate two complete-thought clauses, ban them where they're being used as bullet-style joiners ("Couldn't X — try again").** Forces ~30 rewrites of the toast/error/chip-label cluster; preserves the email signatures and the few prose uses.
- **C. Status quo.** Document the existing pattern (signature + sender display + null placeholder + bullet-style joiner) as the four sanctioned uses; ban new uses elsewhere. Forces 0 rewrites but adds an entry to `VOICE_GUIDELINES.md`.

The audit's recommendation is **B** — the em dashes that pull weight (signatures, dossier separators) are clearly intentional; the ones that don't (toast chains, chip-label suffixes) read as developer punctuation. Decision rests with Ellis.

---

## Diff summary (per-string, this sweep)

11 UI strings + 9 email strings (with text + html mirrors counted as one decision each) + 1 banner em dash → colon swap = **21 file edits** across 13 files. Plus `VOICE_GUIDELINES.md` additions. Plus this signed report + the original audit report. No logic changes. tsc clean.

Files touched:
1. `app/agent/transactions/page.tsx` (T1)
2. `components/transaction/PortalConfirmEmailToggle.tsx` (T2)
3. `app/agent/comms/page.tsx` (T3)
4. `components/automation/AutomationSettingsForm.tsx` (T4)
5. `lib/email/director-invitation.ts` (T5 — text + html)
6. `lib/emails/outsource-intro-template.ts` (E1 — text + html mirrors as needed)
7. `lib/email/director-accepted.ts` (E2 — text + html mirrors)
8. `lib/email/negotiator-accepted.ts` (E3 — text + html mirrors)
9. `lib/emails/retention/index.ts` (E4–E8 — text + html mirrors)
10. `app/agent/hub/page.tsx` (U1)
11. `app/agent/completions/page.tsx` (U2)
12. `app/agent/analytics/page.tsx` (U3, U4)
13. `components/transaction/ClaimedToast.tsx` (U5)
14. `app/claim/page.tsx` (U6)
15. `components/transaction/OnHoldBanner.tsx` (U7)
16. `docs/polish-pass/VOICE_GUIDELINES.md` (4 additions)
