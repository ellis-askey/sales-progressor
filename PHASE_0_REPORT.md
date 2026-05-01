# Phase 0 — Pipeline Health Additions Discovery Report

Generated: 2026-05-01

---

## 1. Hub page location

`app/agent/hub/page.tsx`

No separate component file for the Pipeline Health card — it is rendered inline in the page at line 512 ("Pipeline health + Momentum" section). The card lives inside a CSS grid div with the Momentum card (`gridTemplateColumns: "2fr 1fr"`).

---

## 2. Service function for Pipeline Health

**File:** `lib/services/hub.ts`
**Function:** `getHubPipelineStats(vis: AgentVisibility)`
**Return shape:**
```ts
{
  activeFiles: number;          // count of active transactions
  exchangingSoon: number;       // active txns where expectedExchangeDate OR overridePredictedDate in next 30 days
  pipelineValuePence: number;   // sum of purchasePrice for active txns (in pence)
  newThisMonth: number;         // txns created since start of current calendar month
}
```

What feeds each hero number:
- **Active files** → `pipelineStats.activeFiles`
- **Exchanging soon** → `pipelineStats.exchangingSoon`
- **Need attention** → `attentionFileCount` (derived from `getHubAttentionItems`, distinct transaction count)
- **Pipeline value** → `pipelineStats.pipelineValuePence` formatted by `fmtCurrency()`

---

## 3. CRITICAL: Definition of "Exchanging soon"

"Exchanging soon" counts active transactions where `expectedExchangeDate` OR `overridePredictedDate` falls **within the next 30 days** (not 7 days). It does NOT check milestone readiness.

**Conclusion:** The new `exchangingThisWeek` metric (7-day window, VM19/PM26 not yet complete) is **NOT a duplicate**. Different window (7 vs 30 days) and different filter (milestone gate). Keep `exchangingThisWeek` as specified — no rename needed.

---

## 4. AgentVisibility pattern

All hub service functions accept `AgentVisibility` from `lib/services/agent.ts`. Scoping helpers in hub.ts:
- `buildTxWhere(vis)` — top-level `PropertyTransaction.where` (includes `agencyId`)
- `buildTxNested(vis)` — nested relation filter (no `agencyId` — already on parent)

New queries must use `buildTxWhere(vis)` for agency/agent scoping.

---

## 5. Pipeline Health card location and layout

Card at lines 516–608 in `app/agent/hub/page.tsx`. It is a `div.agent-glass` with `padding: "20px 24px"`. The four hero numbers are in a `hubStats-grid` (CSS grid `repeat(4, 1fr)`). Below the stats grid there is no additional content — that is the empty space to fill.

---

## 6. Existing stalled/dormant logic

Found in `lib/services/analytics.ts`, function `getFilesAtRisk()` (line 537).

Analytics stalled definition: active transactions with `milestoneCompletions: { none: { state: "complete", completedAt: { gte: fourteenDaysAgo } } }` AND NOT having VM19/PM26 complete.

**Difference from spec:** Analytics version does NOT filter `reconciledAtExchange`. The hub spec requires `reconciledAtExchange = false OR null`. The hub version adds this filter. Analytics query is a structural template only.

---

## 7. "Needs your attention" definition

Sourced from `getHubAttentionItems()`. Finds active `ReminderLog` records where `status = "active"`, not snoozed, and `nextDueDate <= today`. These are overdue chase reminders — entirely distinct from stalled (milestone inactivity). No overlap.

---

## 8–10. Schema fields confirmed

- `PropertyTransaction.expectedExchangeDate DateTime?` ✓ (schema line 112)
- `PropertyTransaction.completionDate DateTime?` ✓ (schema line 119)
- `MilestoneCompletion.reconciledAtExchange Boolean @default(false)` ✓ (schema line 336)
- `MilestoneCompletion.completedAt DateTime?` ✓ (schema line 330)
- Index on `[transactionId, completedAt]` exists ✓ (schema line 346)

---

## Build / Lint status (pre-change)

- `npx next build` — passes cleanly (one harmless workspace root inference warning)
- `npm run lint` — `next lint` command does not exist in this Next.js v16 build; `npx tsc --noEmit` passes with 0 errors
- Pre-existing: `npm run build` fails on `prisma generate` due to Windows EPERM file lock — dev-environment issue only; `npx next build` succeeds independently

---

## Previous Phase 0 report content (from earlier task)

(Preserved below for reference — relates to Activity Timeline / Milestone confirmation work, not this task)

**Component:** `components/activity/ActivityTimeline.tsx`

**Data model:** `ActivityEntry` type from `lib/services/comms.ts`
Two union variants:
- `kind: "milestone"` — from `MilestoneCompletion` records (state = complete | not_required)
- `kind: "comm"` — from `CommunicationRecord` records

**Comm sub-types (derived, not a single DB field):**
| Entry type | kind | type | method | isAutomated |
|---|---|---|---|---|
| system_email | comm | outbound | email | true |
| outbound_email | comm | outbound | email | false |
| inbound_email | comm | inbound | email | false |
| outbound_phone | comm | outbound | phone | false |
| inbound_phone | comm | inbound | phone | false |
| outbound_sms | comm | outbound | sms | false |
| inbound_sms | comm | inbound | sms | false |
| voicemail | comm | outbound/inbound | voicemail | false |
| whatsapp | comm | any | whatsapp | false |
| post_letter | comm | any | post | false |
| internal_note | comm | internal_note | null | false |
| milestone_confirmed | milestone | — | — | isNotRequired=false |
| milestone_not_required | milestone | — | — | isNotRequired=true |

**Entry types not currently in DB:** `milestone_reverted`, `details_changed`, `contact_updated`, `transaction_created` — no timeline entries exist for these.

**Current icon rendering (ActivityTimeline.tsx):**
- milestone complete: SVG check circle (blue/emerald) — inline SVG, no component
- milestone not_required: dash text
- comm automated: inline SVG (envelope with zigzag lines) — distinct from manual
- comm (non-automated): emoji icons — ✉ 📞 💬 📱 📲 📮 📝

**Pill rendering (ActivityTimeline.tsx ~line 252–270):**
- "System email" (indigo, `bg-indigo-100/80 text-indigo-700`) — separate badge with embedded SVG
- "Internal" (amber, `bg-amber-100/80 text-amber-700`)
- "→ Outbound" (blue, `bg-blue-100/80 text-blue-700`)
- "← Inbound" (emerald, `bg-emerald-100/80 text-emerald-700`)

The "System email" pill embeds a duplicate SVG icon. It's defined separately from the Outbound/Inbound pills. Consolidation needed in Phase 5.

---

## 2. Milestone Confirmation Flow

**Component:** `components/milestones/MilestoneRow.tsx`

**Confirm path:**
1. Agent clicks "Confirm" → `handleConfirmClick()` → `doComplete()`
2. If exchange/completion: shows reconciliation modal first
3. Otherwise: `startTransition` → `confirmMilestoneAction({ transactionId, milestoneDefinitionId, eventDate })`
4. On success: `toast.success(def.name)` or `ExchangeCelebration` overlay

**No post-confirm notification feedback currently exists.**

**`confirmMilestoneAction` return shape (current):**
```typescript
{ triggeredCelebration: boolean; propertyAddress?: string }
```

**Email dispatch path:**
- `sendAdminMilestoneNotificationToPortal(transactionId, code, eventDate).catch(() => {})` — fire-and-forget
- No return value surfaced to caller — no wasSent / skippedReason signal

**Whether system knows contacts have email at confirm time:**
Yes — `sendRichMilestoneEmails` checks `c.email` on each contact before sending. The information is available at action time. The action can query contacts and return intent-based status ("queued" if email exists, "skipped_no_email" if not) without blocking on actual delivery.

**Notification recipients per milestone:**
- `vendor` contacts (roleType=vendor) — if `emailCopy.vendor` defined for that code
- `purchaser` contacts (roleType=purchaser) — if `emailCopy.purchaser` defined for that code
- `agentUser` — if `emailCopy.vendorAgent` defined
- `assignedUser` (progressor) — if `emailCopy.progressor` defined

---

## 3. Name Display

**Contact model:** `name: String` — single field. No `prefix`, `firstName`, `lastName`.
**User model:** `name: String` — single field. No separate parts.

**"Miss" bug location:** `lib/services/summary.ts:24`
```typescript
.map((c) => c.name.split(" ")[0]); // First name only
```
If a contact is stored as "Miss Smith", `split(" ")[0]` = "Miss", producing "Miss have received their welcome pack."

**All name-splitting call sites (non-node_modules):**
| File | Line | Pattern | Context |
|---|---|---|---|
| `lib/services/summary.ts` | 24 | `.name.split(" ")[0]` | Template token {vendors}/{purchasers} |
| `lib/services/summary.ts` | 34 | `agentName.split(" ")[0]` | {agent} token |
| `components/activity/ActivityTimeline.tsx` | 245 | `.completedByName?.split(" ")[0]` | Milestone attribution line |
| `components/activity/ActivityTimeline.tsx` | 278 | `name.split(" ")[0]` | Contact name chips |
| `components/activity/ActivityTimeline.tsx` | 294 | `.createdByName?.split(" ")[0]` | Comm attribution line |
| `components/activity/CommsEntry.tsx` | 203 | `.name.charAt(0)` | Initial circle in contact picker |
| `components/activity/CommsEntry.tsx` | 228 | `.name.split(" ")[0]` | Selected contact names |
| `components/contacts/ContactsSection.tsx` | 213 | `.split(" ").map(w => w[0]).slice(0,2)` | Initials computation |
| `app/portal/[token]/page.tsx` | 187 | (initials area — needs check) | — |
| `app/agent/analytics/page.tsx` | 26–30 | `fmtNameShort` (local function) | Analytics name display |
| `app/feedback/[token]/survey/page.tsx` | 45 | `.name.split(" ")[0]` | Survey greeting |
| `app/agent/hub/page.tsx` | 34/36 | `name.split(" ")[0]` | Hub greeting |

**No existing shared `getDisplayName`/`getShortName`/`getInitials` helper** in project source.

---

## 4. Icon Library

`lucide-react` **^1.8.0** — present in `package.json` ✓

All specified icons confirmed available:
MailCheck, Mail, MailOpen, Phone, PhoneIncoming, MessageSquare, MessageSquareText, Voicemail, MessageCircle, Mailbox, StickyNote, Check, MinusCircle, AlertCircle, Pencil, UserPen, Sparkles ✓

**Also present:** `@phosphor-icons/react` ^2.1.10 — not in spec. See OPEN_QUESTIONS.md.

---

## 5. Avatar / Initials Chips

**CSS class:** `.agent-avatar` in `app/agent/styles/agent-system.css` (line 601)
- Coral gradient (`--agent-coral` to `--agent-coral-light`), circular, 4 sizes (xs/sm/md/lg)
- No React component wrapping it — used as raw className strings

**Initials rendered inline at each call site:**
- `components/activity/CommsEntry.tsx:203` — `c.name.charAt(0)`, 20px circle
- `components/agent/TeamManagement.tsx:109` — `m.name.charAt(0)`, 20px circle  
- `components/contacts/ContactsSection.tsx:213` — 2-letter initials, computed inline

**No shared `<Avatar>` React component exists.** All avatar circles are ad-hoc.

---

## Summary

| Area | Status |
|---|---|
| Timeline component location | ✓ Found |
| All entry types mapped | ✓ Done |
| Icon-to-type mapping | ✓ Documented |
| Pill rendering location | ✓ Found |
| Milestone confirm modal | N/A — no modal, direct confirm |
| Notification dispatch path | ✓ Traced |
| wasSent/skipped signal | ✗ Not surfaced — can add intent-based status |
| Name model shape | ✓ Single `name: String` field |
| Miss bug location | ✓ `lib/services/summary.ts:24` |
| getDisplayName helper | ✗ Does not exist |
| lucide-react present | ✓ Yes, all icons available |
| Avatar component | ✗ Does not exist |
