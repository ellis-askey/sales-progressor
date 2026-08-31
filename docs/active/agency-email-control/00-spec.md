# Agency email control — spec

**Status:** spec, not building. Founder locked scope 2026-08-31; walk before code.
**Owner:** Ellis + Claude Code session.
**Scope decision (2026-08-31):** *everything that goes out under the agency's brand* becomes agency-editable — client, solicitor, and chain auto-sends, including the AI weekly update. **Share of freehold is NOT a variant axis** (freehold/leasehold only — matches reality; no email copy reads `isShareOfFreehold` today).

---

## Goal

Give each customer agency control over the wording of the automated emails that
go out under their brand, with **Sales Progressor's copy as the default**. An
agency edits its own version; if it never touches a template, ours ships. This
applies to **self-managed files** (on outsourced files our team sends and owns
the copy).

---

## Ground truth (from discovery, 2026-08-31)

### What exists today
- **Milestone email defaults** live in `lib/portal-copy.ts` — 47 codes (VM1–20,
  PM1–27), each with per-recipient `emailCopy` (subject/heroLabel/opening/
  whatHappened/whatNext/action).
- **A global override table** `MilestoneEmailOverride` keyed
  `[code, side, tenure, purchaseType]` — **no `agencyId`**. Superadmin edits it
  via the `/command/milestone-emails` matrix (Side × Tenure × Method × Step).
  Resolver: `lib/services/milestone-copy-overrides.ts`, applied in the send path
  `lib/services/portal.ts` (`applyOverridesToEmailCopy`).
- **Per-agency controls that already exist:** sender identity
  (`Agency.quoteSenderEmail` → `resolveAgencySender`), logo/branding, and per-
  stream **on/off toggles** (`chaseEmailsEnabled`, `weeklyClientUpdatesEnabled`,
  `solicitorChaseEnabled`, `enquiryReplyChaseEnabled`, `enquiryRaiseChaseEnabled`,
  `chainNeighbourUpdatesEnabled`). **No wording control.**
- **The `email-skeletons` system is dormant** (`EMAIL_SKELETON_MODE` off, blocked
  from activation). Not a usable seam. Ignore it.

### The variant matrix is smaller than it looks
- **Tenure = 2** (`freehold`, `leasehold`). `isShareOfFreehold` is a boolean that
  **no email copy reads** — out of scope per founder decision.
- **Funding = 3** (`mortgage`, `cash_buyer`, `cash_from_proceeds`), collapsed to
  **2** (mortgage/cash) by `normalizeMethod` in the existing editor.
- Tenure/funding mostly **suppress whole milestones** (auto-not-required:
  leasehold-only VM8/VM9/PM12; mortgage-only PM5/PM6/PM11; cash_from_proceeds
  also drops PM24) rather than reword. Only **PM6, PM9** vary wording live today.
- Net: ~40 client milestone emails, each editable as a plain default, with
  tenure/method sub-cells surfaced only where they diverge.

### The full auto-send inventory (everything in scope)
Two tiers. Tier 1 runs through the milestone override seam; Tier 2 uses inline or
AI templates with **no override seam today** — each needs one built.

**Tier 1 — milestone emails (seam exists):**
- Milestone update emails → buyer + seller (~40, agency-branded). Source
  `portal-copy.ts`. Event-driven, drained every 5 min (`send-milestone-digests`).

**Tier 2 — inline / AI templates (no seam yet):**
| Key | Send | To | Copy source | Varies t/f? |
|---|---|---|---|---|
| `weekly_client_update` | Weekly client update (Sat) | buyer+seller | **AI narrative** (`client-weekly-update.ts`) | no |
| `client_chase` | Client chase digest | buyer+seller | inline (`client-chase-digest.ts`) | tone only |
| `completion_pack` | "Contracts exchanged: what next" | buyer+seller | inline (`portal.ts:renderCompletionPackBody`) | side only |
| `exchange_day_client` | Exchange-day morning + authority | buyer+seller | inline (`exchange-day/emails.ts`) | side only |
| `solicitor_chase` | Solicitor chase digest | solicitors (+CC) | inline (`solicitor-confirm/chase.ts`) | side only |
| `exchange_day_solicitor` | Exchange-day solicitor (3 slots) | solicitors | inline (`exchange-day/emails.ts`) | side only |
| `enquiries_chase` / `enquiries_raise` | Enquiry chases | solicitor/buyer | inline (`enquiries/*.ts`) | no |
| `chain_neighbour_update` | Onward-step note | **external agents** | inline (`chain-neighbour-updates.ts`) | no |
| `chain_invite_nudge` | Invite nudge | **external agents** | inline (`chain/invite-nudge.ts`) | no |
| `chain_cascade_*` | Lost buyer / wait / celebration etc. | chain-mate agents | inline (`chainNotifications.ts`) | no |

**Known gaps to fix along the way:**
- Agent/progressor milestone notifications use plain `sendEmail`, bypassing
  `AgentEmailLog` (no audit trail). Fold into the log.
- Solicitor/exchange-day/enquiries emails are gated by a *global*
  `SolicitorChaseSettings` switch, not per-agency. Per-agency control needed for
  a true "your emails" story.

---

## Architecture — unified per-agency copy override

One resolution rule everywhere: **agency-specific row → SP default row → hard-coded
default**. Two storage seams because the two tiers differ in shape.

### Tier 1 (milestones): extend the existing table
- Add `agencyId String?` to `MilestoneEmailOverride` (null = SP default = today's
  rows, untouched). Widen the unique key to
  `[code, side, tenure, purchaseType, agencyId]`.
- Thread `agencyId` through `getOverridesForCode` / `applyOverridesToEmailCopy`
  in `lib/services/portal.ts`. Resolver prefers the agency row, falls back to the
  null-agency row, then code default. Zero behaviour change until agency rows exist.

### Tier 2 (inline/AI): new `AgencyEmailTemplate` table
- Keyed `[agencyId, templateKey]` where `templateKey` is a stable enum
  (`weekly_client_update`, `completion_pack:vendor`, `client_chase`, …).
- Each inline builder is refactored to `resolveTemplate(templateKey, agencyId,
  defaults)` — returns the agency override or the code default. Defaults stay in
  code (single source; the DB only holds *deltas*).
- **AI weekly update is special:** agencies don't edit fixed copy — they edit a
  **tone/guidance string + optional custom intro & sign-off** that feed the
  prompt and the fallback. Store those as fields on the same table row.

### Editor UI
- New **director-only "Emails" tab in the Account left-nav** (`AccountLeftNav.tsx`
  is built for drop-in tabs + role gating). It is the agency's control centre:
  every stream grouped (to clients / to solicitors / to other agents), each row
  showing what it is, when it fires, its on/off state, and **Edit wording**.
- Milestone editor = a director-scoped reuse of the `MilestoneEmailsMatrix`
  component, writing agency rows.
- Tier-2 editors = a simpler per-template form (subject + body fields, or
  tone/intro/sign-off for the AI update), each with **live preview** and a
  **"Reset to Sales Progressor default"** button.

### Discoverability (the "it's tucked away" problem)
Point three existing surfaces at it:
1. The director-only **`EmailSetupPrompt`** hub banner gains a line: "…and
   personalise what your buyers and sellers receive."
2. An **OnboardingChecklist** item ("Make your client emails yours").
3. A link on **Account → Profile → Sending Addresses** (where they set the sender).

---

## Phasing (each phase ends at a verifiable boundary; migrations staging-first)

- **Phase 0 — Tier-1 foundation.** Add `agencyId` to `MilestoneEmailOverride`
  (migration, staging first), update the resolver. No UI. Behaviour identical
  (all rows agencyId=null). Verify sends unchanged.
- **Phase 1 — Agency milestone editor.** Account "Emails" tab + director-scoped
  matrix + the three discoverability hooks. Agencies can now edit milestone copy.
- **Phase 2 — Tier-2 template registry.** New `AgencyEmailTemplate` table +
  `resolveTemplate` helper. Refactor inline builders one family per PR (Law 5):
  completion pack → client chase → exchange-day client → solicitor chase →
  exchange-day solicitor → enquiries → chain neighbour → chain cascade → invite
  nudge. Each adds its editor row to the Emails tab.
- **Phase 3 — AI weekly update control.** Tone/intro/sign-off fields + preview.
- **Phase 4 — Gaps.** Fold agent/progressor milestone sends into `AgentEmailLog`;
  move the global solicitor/enquiries switch to per-agency where it makes sense.

---

## Open questions / decisions still needed before Phase 2+

1. **Per-agency vs per-file editing granularity** — assume per-agency (one set of
   templates for the whole agency), not per-file. Confirm.
2. **Negotiator access** — director-only edit, or negotiators too? (Billing +
   automation settings are director-only today; suggest matching that.)
3. **Solicitor/chain templates** — these go to third parties and external agents.
   Confirm agencies *should* be able to reword solicitor-facing and
   chain-neighbour emails (compliance/tone risk), or lock those to us.
4. **Reset semantics** — a "reset to default" removes the agency row so future
   SP-default changes flow through. Confirm that's the wanted behaviour (vs a
   frozen copy at edit time).

---

## What this deliberately does NOT include
- Share-of-freehold as a variant axis (founder decision 2026-08-31).
- Reactivating the `email-skeletons` system.
- Per-recipient (individual buyer/seller) copy — agency-level only.
- New email *streams* — this is control over existing sends, not new ones.
