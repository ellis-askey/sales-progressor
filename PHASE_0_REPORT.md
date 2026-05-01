# Phase 0 — Discovery Report

Generated: 2026-05-01

---

## 1. Activity Timeline Rendering

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
