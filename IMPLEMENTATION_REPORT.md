# Pipeline Health Additions — Implementation Report

Completed: 2026-05-01

---

## Files Changed

| File | Change |
|---|---|
| `lib/services/hub.ts` | Extended `getHubPipelineStats` with `comingUp` and `stalled` metrics |
| `app/agent/hub/page.tsx` | Added `fmtCompact` helper, Lucide imports, "Coming up" strip, "Stalled files" row |
| `app/agent/styles/agent-system.css` | Added `.coming-up-link` and `.stalled-row-link` hover CSS rules |
| `PHASE_0_REPORT.md` | Updated with discovery findings for this task |
| `OPEN_QUESTIONS.md` | Added OQ-7 for "Exchanging soon" conflict decision |

## Files Added

None. All changes were extensions to existing files.

---

## New Service Return Shape

`getHubPipelineStats(vis)` now returns:

```ts
{
  // Existing (unchanged)
  activeFiles: number;
  exchangingSoon: number;
  pipelineValuePence: number;
  newThisMonth: number;

  // New
  comingUp: {
    exchangingThisWeek: number;      // active txns: expectedExchangeDate in next 7d, VM19/PM26 not complete
    completingThisWeek: number;      // active txns: completionDate in next 7d, VM20/PM27 not complete
    closingThisMonth: {
      total: number;                 // sum purchasePrice (pence) for active txns with expectedExchangeDate in current month, VM19/PM26 not complete
    };
  };
  stalled: {
    count: number;                   // active, not exchanged, no genuine MilestoneCompletion.reconciledAtExchange=false in last 14d
    transactionIds: string[];        // capped at 50
  };
}
```

All queries run in a single `Promise.all` — no serial round-trips. Milestone definition codes are resolved via nested `milestoneDefinition: { code: { in: [...] } }` Prisma filters (same pattern as `getHubWeeklyForecast`).

---

## "Exchanging soon" vs "exchange-ready" Decision

**Path taken:** kept `exchangingThisWeek` as specified (no rename).

**Reason:** Phase 0 confirmed "Exchanging soon" uses a **30-day** window on `expectedExchangeDate OR overridePredictedDate`, with no milestone gate. The new `exchangingThisWeek` uses a **7-day** window on `expectedExchangeDate` only, gated by VM19/PM26 not yet complete. These are different in window length, date field used, and milestone filter — no duplication.

See `OPEN_QUESTIONS.md` OQ-7 for full reasoning (tagged REVERSIBLE).

---

## Coming up strip — visual spec compliance

- Thin `border-top: 1px solid var(--agent-border-subtle)` separator above ✓
- Single line, 13px text ✓
- "Coming up:" label in `font-weight: 600`, `var(--agent-text-secondary)` colour ✓
- Each metric has explicit time anchor ("this week", "this month") ✓
- Separated by ` · ` middle dot ✓
- Zero values rendered greyed out (`var(--agent-text-muted)`) — not hidden ✓
- Currency uses `fmtCompact`: £Xk for ≥1000, £X.XM for ≥1,000,000 ✓
- Each metric is a hover-underline link via `.coming-up-link` CSS class ✓
- Link destinations: `?filter=exchanging-this-week`, `?filter=completing-this-week`, `?filter=closing-this-month` ✓
- TODO comments adjacent to each link ✓

---

## Stalled files row — visual spec compliance

- Thin `border-top: 1px solid var(--agent-border-subtle)` separator above ✓
- Whole row is clickable → `?filter=stalled` ✓
- Hover: `rgba(201,125,26,0.06)` amber tint via `.stalled-row-link:hover` CSS ✓
- Left: `AlertCircle` (Lucide, 14px, `var(--agent-warning)`) ✓
- Bold count + ` files stalled` + ` — ` + plain description ✓
- Right: `ChevronRight` (Lucide, 14px, `var(--agent-text-muted)`) ✓
- count === 0: muted grey, no icon, no chevron, no click target, "All files have recent activity" ✓
- TODO comment near the link ✓

---

## TODOs left for follow-up (destination filter routes)

1. `GET /agent/transactions?filter=exchanging-this-week` — filter active txns by expectedExchangeDate in next 7 days, not yet exchanged
2. `GET /agent/transactions?filter=completing-this-week` — filter active txns by completionDate in next 7 days, not yet completed
3. `GET /agent/transactions?filter=closing-this-month` — filter active txns by expectedExchangeDate in current calendar month, not yet exchanged
4. `GET /agent/transactions?filter=stalled` — filter active txns with no genuine milestone activity in 14+ days, not yet exchanged

These are marked with `{/* TODO: implement filter on /agent/transactions */}` and `{/* TODO: implement stalled filter on /agent/transactions */}` comments in `app/agent/hub/page.tsx`.

---

## Reference

See `OPEN_QUESTIONS.md` OQ-7 for the "Exchanging soon" naming decision.

---

## Previous Implementation Report content (from earlier task)

(Preserved below — relates to UX Polish pass, not this task)



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
