# UX Polish Pass — Implementation Report

Completed: 2026-05-01

---

## Phase 0: Discovery

**Output:** `PHASE_0_REPORT.md`

Audited the agent transaction page end-to-end. Found six issues: inconsistent name display (honorific "Miss" bug), ad-hoc emoji icons in the activity timeline, no centralised avatar component, no post-confirm notification UI, inline system-email rendering, and scattered `.charAt(0)` / `.split(" ")[0]` patterns across 8+ files.

---

## Phase 1: Name display helpers

**File created:** `lib/contacts/displayName.ts`

Single-name-field Contact model (`name: string`) is parsed internally to detect and skip honorific prefixes (Mr, Mrs, Ms, Miss, Mx, Dr, Prof, Sir, Dame, Lord, Lady, Rev).

Exports:
- `getDisplayName(contact)` — full trimmed name
- `getShortName(contact)` — skips pure-honorific prefixes; keeps professional titles (Dr, Prof, Rev) attached to surname
- `getInitials(contact)` — up to two initials, skipping prefix words
- `extractFirstName(name: string)` — first non-prefix word; `"Miss Smith"` → `"Smith"`, `"Dr Adebayo"` → `"Dr Adebayo"`

Also fixed the "Miss" bug in `lib/services/summary.ts` (line 24 `resolveTemplateTokens` was doing `c.name.split(" ")[0]` → now uses `extractFirstName`).

---

## Phase 2: Activity timeline icons

**File created:** `components/ui/TimelineIcon.tsx`

Unified icon system with 13 entry types, each with a distinct gradient circle + lucide-react icon:

| Type | Icon | Gradient |
|------|------|----------|
| system_email | MailCheck | Indigo |
| outbound_email | Mail | Indigo |
| inbound_email | MailOpen | Indigo |
| outbound_phone | Phone | Blue |
| inbound_phone | PhoneIncoming | Blue |
| outbound_sms | MessageSquare | Sky |
| inbound_sms | MessageSquareText | Sky |
| voicemail | Voicemail | Violet |
| whatsapp | MessageCircle | Green |
| post_letter | Mailbox | Teal |
| internal_note | StickyNote | Amber |
| milestone_confirmed | CheckCircle2 | Emerald |
| milestone_not_required | MinusCircle | Slate |

`resolveEntryType(entry)` converts the union `ActivityEntry` shape to the appropriate type. `TimelineIcon` renders a 40px (configurable) gradient circle.

**Modified:** `components/activity/ActivityTimeline.tsx` — emoji icons and inline SVG removed; timeline now uses `TimelineIcon`; contact chips use `ContactAvatar` + `extractFirstName`; `CommPill` sub-component consolidates all badge variants in consistent style.

---

## Phase 3: Avatar system

**File created:** `components/ui/Avatar.tsx`

Two components sharing a central `SIDE_STYLES` gradient map:

- `ContactAvatar({ contact: { name, roleType? }, size, className })` — gradient by role: vendor=blue, purchaser=green, broker=green, else=slate. Initials from `getInitials`.
- `UserAvatar({ user: { name }, size, className })` — always amber (internal/agent). Initials from `getInitials`.

**Modified:**
- `components/layout/AgentShell.tsx` — sidebar avatar → `UserAvatar`
- `components/layout/AppShell.tsx` — sidebar avatar → `UserAvatar`
- `components/agent/TeamManagement.tsx` — team member avatar → `UserAvatar`
- `components/activity/CommsEntry.tsx` — contact picker chips → `ContactAvatar`
- `components/contacts/ContactsSection.tsx` — contact list cards → `ContactAvatar`

---

## Phase 4: Milestone confirmation notification panel

**Modified:** `app/actions/milestones.ts`

`confirmMilestoneAction` now returns `notifications: NotificationStatus[]` alongside the existing return values. Each entry carries `role`, `contactId`, `contactDisplayName`, and `status` (`"queued" | "skipped_no_email" | "skipped_no_contact"`). Status is intent-based — it records whether an email was dispatched, not whether delivery succeeded.

**Modified:** `components/milestones/MilestoneRow.tsx`

After a successful confirm, a `NotificationFeedback` panel slides into view below the milestone row (no layout disruption). It shows:
- **Sent pills** — solid pastel background, green check icon, `"<Name> — <role>"` label
- **Skipped pills** — outline style, info icon, `"<Name> — no email on file"` label

Auto-dismisses after 5 seconds; also dismisses if the milestone row unmounts.

---

## Phase 5: System email chrome in timeline

System emails (automated milestone notifications) previously rendered identically to manual outbound comms. Now:
- `CommPill` in `ActivityTimeline.tsx` renders `isAutomated` comms with an indigo `"System email"` badge (distinct from `"→ Outbound"` blue)
- `TimelineIcon` maps `system_email` → `MailCheck` (indigo gradient), distinct from `outbound_email` → `Mail`
- The method label (Email/Phone/SMS etc.) is suppressed for automated entries to reduce noise

---

## Phase 6: Verification + orphan audit

Final `npx tsc --noEmit` — clean.

All component-level name-split orphans resolved:

| File | Was | Fixed |
|------|-----|-------|
| `components/activity/ActivityTimeline.tsx` | `.split(" ")[0]` × 2 | `extractFirstName` |
| `components/activity/CommsEntry.tsx` | `.split(" ")[0]` | `extractFirstName` |
| `components/contacts/ContactsSection.tsx` | `.split(" ")[0]` | `extractFirstName` |
| `components/layout/AgentShell.tsx` | `.charAt(0)` | `UserAvatar` |
| `components/layout/AppShell.tsx` | `.charAt(0)` | `UserAvatar` |
| `components/agent/TeamManagement.tsx` | `.charAt(0)` | `UserAvatar` |
| `components/portal/PortalShell.tsx` | `.split(" ")[0]` | `extractFirstName` |
| `components/transaction/PortalMessagesWidget.tsx` | `.split(" ")[0]` × 2 | `extractFirstName` |
| `components/transactions/TransactionListWithSearch.tsx` | `.split(" ")[0]` | `extractFirstName` |
| `lib/services/summary.ts` | `.split(" ")[0]` | `extractFirstName` |

**Not fixed (out of scope — email service layer):**
Server-side email template files (`lib/services/portal.ts`, `portal-messages.ts`, `comms.ts`, `client-weekly-update.ts`, `agent-weekly-brief.ts`, `survey.ts`) still use `.split(" ")[0]` in email body copy. These are covered separately by the email copy update task (Task A / `portal-copy.ts` rekeying). The "Miss" bug in email greetings will be resolved when that task applies the revised `milestone-email-bodies.md` copy.

---

## Files changed (full list)

**Created:**
- `lib/contacts/displayName.ts`
- `components/ui/TimelineIcon.tsx`
- `components/ui/Avatar.tsx`
- `PHASE_0_REPORT.md`
- `OPEN_QUESTIONS.md`
- `IMPLEMENTATION_REPORT.md`

**Modified:**
- `lib/services/summary.ts`
- `app/actions/milestones.ts`
- `components/activity/ActivityTimeline.tsx`
- `components/activity/CommsEntry.tsx`
- `components/contacts/ContactsSection.tsx`
- `components/layout/AgentShell.tsx`
- `components/layout/AppShell.tsx`
- `components/agent/TeamManagement.tsx`
- `components/milestones/MilestoneRow.tsx`
- `components/portal/PortalShell.tsx`
- `components/transaction/PortalMessagesWidget.tsx`
- `components/transactions/TransactionListWithSearch.tsx`

---

## Open questions

See `OPEN_QUESTIONS.md` for the 6 questions documented during implementation (OQ-1 through OQ-6). The two IRREVERSIBLE questions (OQ-1 Contact model shape, OQ-3 Notification intent vs delivery) are design decisions already baked in; the rest are reversible style choices.
