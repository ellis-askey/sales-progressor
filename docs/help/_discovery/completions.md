# Completions Page — Discovery Report

**Route:** `app/agent/completions/page.tsx`  
**User-facing route:** `/agent/completions`  
**Date:** 2026-05-08

---

## 1. What this page actually is

Completions is a **forward-looking view of files that have already exchanged contracts and are now counting down to legal completion**. It is not a historical log of completed files. The page only shows files in `active` status where the exchange milestone (VM19/PM26) is confirmed complete and the completion milestone (VM20/PM27) is not yet confirmed.

**Page H1 (verbatim):** `Completions` (`page.tsx:129`)  
**Page subtitle (verbatim):** `Files that have exchanged and are heading to completion.` (`page.tsx:130`)

The page answers the question: which files have exchanged, and when are they completing? It is the post-exchange pipeline, not a post-completion archive.

---

## 2. Page structure — top to bottom

Route component: `app/agent/completions/page.tsx` — async Server Component (185 lines).

### A. Page header (glassmorphism, sticky visually)

Source: `page.tsx:117–146`. Same glassmorphism treatment as All Files and the Hub.

Elements in order:
1. **H1:** "Completions" — hard-coded string, no role variation
2. **Subtitle:** "Files that have exchanged and are heading to completion." — hard-coded
3. **Stat segments** (conditional — only when `statSegments.length > 0`, i.e. at least one file exists):
   - Rendered as inline anchor links with `·` dot separators
   - Each segment: `[count] [label]` (e.g. "3 overdue · 2 this week")
   - Labels: "overdue" / "this week" / "next week" / "later" / "no date"
   - Colours: red (overdue), amber (this_week), blue (next_week), muted (later/no_date)
   - Each anchor links to `#section-[key]` — scrolls to the matching group in the body
   - Only segments with count > 0 are rendered

### B. Body container (`px-4 md:px-8 py-5 md:py-7`)

Three mutually exclusive body states:

**State 1 — zero files (`files.length === 0`):**  
`glass-card` empty state. See §8.

**State 2 — files exist:**

1. **Pipeline summary line** (`page.tsx:166–176`): plain text sentence showing total count, total fees (if any fee is set), total purchase value (if any price is set). Bold numbers, muted descriptors.
2. **`CompletionsGroupList`** (`page.tsx:180`) — the main collapsible group list. Client component at `components/completions/CompletionsGroupList.tsx`.

---

## 3. The data behind the page

**Service function:** `getAgentCompletions(vis)` at `lib/services/agent.ts:128–187`.

### Query shape

**Step 1** — fetch milestone definition IDs for VM19, PM26 (exchange) and VM20, PM27 (completion) (`agent.ts:129–135`).

**Step 2** — query `PropertyTransaction` with:
- `WHERE`: `txWhere(vis)` (agency/user scoping) + `status: "active"` + `milestoneCompletions.some: { state: "complete", milestoneDefinitionId: { in: exchangeDefIds } }` — i.e. VM19 OR PM26 is confirmed
- `SELECT`: id, propertyAddress, completionDate, purchasePrice, agentFeeAmount, assignedUser.name, contacts (all, with roleType), vendorSolicitorFirm.name, purchaserSolicitorFirm.name, milestoneCompletions (only VM19/PM26/VM20/PM27 ones, state=complete)

**Step 3** — in-memory filter: removes any transaction where VM20 or PM27 is already complete (`agent.ts:164–165`):
```ts
.filter((tx) => !tx.milestoneCompletions.some((c) => completionDefIds.includes(c.milestoneDefinitionId)))
```
This is the key filter. Only files that have exchanged but have NOT yet legally completed appear here.

**Sort:** completionDate ASC, nulls last (`agent.ts:182–186`):
```ts
.sort((a, b) => {
  if (!a.completionDate) return 1;  // nulls to bottom
  if (!b.completionDate) return -1;
  return new Date(a.completionDate).getTime() - new Date(b.completionDate).getTime();
});
```

**No pagination.** All matching records returned in one query.

### Visibility scoping (`agent.ts:27–36`)

Local `txWhere(vis)` helper (not the same as `buildTxWhere` from `lib/security/access-scope.ts`):

```ts
function txWhere(vis: AgentVisibility) {
  if (vis.seeAll) {
    if (vis.firmName) return { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } };
    return { agencyId: vis.agencyId };
  }
  return { agentUserId: vis.userId };
}
```

When `seeAll = false` (standard negotiator): WHERE clause is `{ agentUserId: vis.userId }` — no `agencyId` constraint. See §10 item 1.

`resolveAgentVisibility` at `agent.ts:14–25`:
- Director → `seeAll = true`
- `canViewAllFiles = true` → `seeAll = true`  
- Otherwise → `seeAll = false`

### Fields returned per file

`agent.ts:168–180`:
- `id`, `propertyAddress`, `completionDate`, `purchasePrice`, `agentFeeAmount`
- `assignedUserName` (from `assignedUser.name` — the internal Sales Progressor staff assignee, if any)
- `purchasers` — array of names from contacts where `roleType = "purchaser"`
- `vendors` — array of names (passed through but NOT used by the page component; see §10 item 2)
- `exchangedAt` — completedAt from the VM19/PM26 milestone completion record
- `vendorSolicitorName`, `purchaserSolicitorName`

### Server-side computation (page.tsx)

The server component pre-computes group buckets, `daysRel`, `daysLabel`, `daysColor`, fee and value aggregates, and passes fully serialised data to `CompletionsGroupList`. No data fetching happens client-side.

---

## 4. The main content — grouped collapsible list

### Groups

Five fixed urgency buckets, computed from `completionDate` vs today (`page.tsx:50–57`):

| Group key | Label | Condition | Colour |
|---|---|---|---|
| `overdue` | Overdue | completionDate < today | Red |
| `this_week` | Completing this week | completionDate within 7 days | Amber |
| `next_week` | Completing next week | completionDate 7–14 days from now | Blue |
| `later` | Later | completionDate 14+ days from now | Slate |
| `no_date` | No completion date set | completionDate is null | Muted |

Groups with zero files are omitted (`page.tsx:72–112`: `flatMap` returns `[]` for empty groups). Groups are always rendered in this fixed order; user cannot reorder.

### Collapse behaviour

`CompletionsGroupList.tsx:61–63`: all groups start **collapsed**:
```ts
const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
  Object.fromEntries(groups.map((g) => [g.key, true]))
);
```
Clicking a group header toggles it. Each group expands and collapses independently.

### Sort within groups

Within each group, files are sorted by `completionDate ASC` (from the service-layer sort). No in-group sort override exists.

### No search, no filters

There are no search controls, text filters, chip filters, or date range pickers on this page.

### Group header contents

`CompletionsGroupList.tsx:79–98`:
- Coloured dot (2.5 × 2.5, rounded-full)
- Label + count: `[Label] ([N])` in uppercase tracking-wide font
- Fee total if any: `{fmt(groupFeeTotal / 100)} fees` — only shown if group has any fee set
- If no fee but value exists: `{fmt(groupValue / 100)}` (purchase price sum)
- CaretDown / CaretUp icon (toggle indicator)

When group is expanded and `groupFeeTotal > 0` and some files have no fee set: `({N} file(s) with no fee set)` appears in muted text below the header (`CompletionsGroupList.tsx:99–103`).

---

## 5. Anatomy of a single file card

Each file renders as a `<Link href="/agent/transactions/{id}">` glass-card (`CompletionsGroupList.tsx:120–174`). Clicking anywhere on the card opens the property file.

### Desktop layout (hidden below md)

Left column (flex-1):
1. **Property address** — 15px bold, truncated
2. **Details row** (flex-wrap, gap-x-4): purchase price (if set) · fee (if set, bolder) · "Purchaser: [name]" (if purchasers exist) · "Progressor: [name]" (if assignedUserName set)
3. **timeSinceExchange** — format: "Exchanged today", "Exchanged yesterday", or "Exchanged [dd Mon] · [N] days ago" (`CompletionsGroupList.tsx:12–19`)
4. **Solicitors line**: 
   - Both missing: `No solicitors set` in orange (#b45309)
   - Otherwise: `Vendor sol: [name] · Purchaser sol: [name]` with "not set" italic for absent sides

Right column (flex-shrink-0):
- **DateBlock**: completion date formatted `Wed, 5 February 2025` (weekday + full date) + daysLabel below

### Mobile layout (shown below md)

Same fields in a vertical stack, DateBlock right-aligned at bottom.

### DateBlock — no_date group variant

For files in the `no_date` group (`CompletionsGroupList.tsx:110–117`): instead of a date, shows `Set date →` as a small bordered inline element. This does NOT open an inline date picker — the Link wrapper means clicking anywhere navigates to the property file.

### daysLabel and daysColor (computed server-side, `page.tsx:81–92`)

| Condition | Label | Colour |
|---|---|---|
| `daysRel < 0` | `{N} days overdue` | #dc2626 (red) |
| `daysRel === 0` | `today` | #d97706 (amber) |
| `daysRel === 1` | `tomorrow` | default text |
| `daysRel >= 2` | `in {N} days` | default text |
| `daysRel === null` | "" (empty) | N/A |

---

## 6. Relationship to the Hub's "Exchanging soon"

### Hub stat (post-fix)

The Hub "Exchanging soon" stat **no longer links to Completions**. A fix applied on branch `feature/exchanging-next-30-days-filter` before this article was written changed the destination:

Hub `page.tsx` (post-fix):
- `href`: `/agent/transactions?filter=exchanging-next-30-days` — links to All Files filtered to the matching pre-exchange population
- Link gated: only active when `pipelineStats.exchangingSoon > 0`, matching the "Need attention" pattern

### What Hub "Exchanging soon" counts (`lib/services/hub.ts:63–72`)

```ts
prisma.propertyTransaction.count({
  where: {
    ...txWhere,
    status: "active",
    OR: [
      { expectedExchangeDate: { gte: now, lte: in30Days } },
      { overridePredictedDate: { gte: now, lte: in30Days } },
    ],
  },
})
```

This counts active transactions with an **expected or override exchange date in the next 30 days**. These files have **NOT yet exchanged** — the field is `expectedExchangeDate`, not an actual exchange completion record.

### What the Completions page shows

Active transactions where VM19/PM26 (exchange) is confirmed complete AND VM20/PM27 (completion) is not yet done. These files **have already exchanged** and are waiting for legal completion.

### How Completions is actually reached

Two confirmed entry points:

1. **Sidebar nav** (`components/layout/AgentShell.tsx:25`): persistent link labelled "Completions" with `CalendarCheck` icon, present for all agent roles.
2. **Global search** (`components/layout/AgentGlobalSearch.tsx:18`): listed as a quick-navigation option — "Completions · Files ready to complete".

The Hub diary card links to individual transaction files, not to the Completions page.

### Note on the population mismatch

The Hub stat counts pre-exchange files; Completions shows post-exchange files — completely different populations. This mismatch was identified during this discovery. The fix (see above) ensures the Hub stat now routes to All Files filtered to the pre-exchange set, so the stat's destination matches what the stat counts. The Completions page itself was not changed.

---

## 7. Director vs negotiator differences

`resolveAgentVisibility` determines scope (`agent.ts:14–25`):

| User | seeAll | What they see on Completions |
|---|---|---|
| Director | `true` | All post-exchange active files for the agency |
| Negotiator (canViewAllFiles) | `true` | All post-exchange active files for the agency |
| Negotiator (no canViewAllFiles) | `false` | Only files where `agentUserId = their own userId` |

**UI differences:** None. The page H1 ("Completions") and subtitle are hardcoded — no role-conditional heading like All Files' "All Files" / "My Files" distinction. There is no ownership indicator or scope label to tell a negotiator why their list is shorter than a director's.

No role-specific UI elements exist on this page.

---

## 8. Empty states

**Files.length === 0 (no post-exchange active files) — `page.tsx:152–162`:**

Container: `glass-card`, `padding: "48px 24px"`, `textAlign: "center"`.  
Icon: `ClockCountdown` (Phosphor, `weight="regular"`, 32px, `color: var(--agent-text-muted)`, `opacity: 0.45`).

**Heading (verbatim):**
> No files awaiting completion

Font size 15, weight 600, colour `var(--agent-text-primary)`, margin `"0 0 6px"`.

**Body (verbatim):**
> Once a file exchanges, it'll appear here as it heads toward completion.

Font size 13, colour `var(--agent-text-muted)`, maxWidth 340, lineHeight 1.5.

**No action button.** No link to All Files or elsewhere.

**No group-level empty state.** Groups with zero files are simply omitted. There is no "no files in this group" message — empty groups don't render.

**No search/filter empty state.** There is no search or filter UI, so no filter-induced empty state exists.

---

## 9. Live component extraction assessment

| Element | Score | File | Reason |
|---|---|---|---|
| Full `CompletionsGroupList` | **Hard** | `CompletionsGroupList.tsx` | Client collapse state, multiple groups, CaretDown/Up icons, conditional fee line — extractable but needs realistic multi-group data |
| Single group header | **Medium** | Inline in `CompletionsGroupList.tsx:79–98` | Simple button + conditional label; extractable as a dumb view with props |
| Single file card (`CompletionFileRow`) | **Easy–Medium** | Inline in `CompletionsGroupList.tsx:107–174` | Pure presentational with serialisable data; dual desktop/mobile layout; no external state dependencies |
| Pipeline summary line | **Easy** | Inline in `page.tsx:166–176` | Pure server-rendered text, no interactivity |
| Stat segments (header anchors) | **Easy** | Inline in `page.tsx:133–144` | Simple flex row of anchor links; fully serialisable |
| Empty state | **Easy** | Inline in `page.tsx:152–162` | Pure JSX, no props needed |

**Best candidate for HelpSplit extraction:** The single file card (a `CompletionFileRow` rendered as a glass-card Link). It's self-contained, takes serialisable data, and shows the most information-dense element on the page. The group header is the next-best candidate if a full group view is preferable.

**Practical note:** The file card's Link `href="/agent/transactions/{id}"` will 404 in the help drawer. The adapter should set `showAddressLink={false}` equivalent — which in this component means extracting the card's inner content without the outer Link, or wrapping in a non-navigating container.

---

## 10. Worth flagging

1. **`txWhere` for negotiators has no `agencyId` constraint.** `agent.ts:35`: `return { agentUserId: vis.userId }`. For `seeAll=false`, the WHERE clause is `{ agentUserId: vis.userId }` with no `agencyId` filter. This means if a user's userId appears as `agentUserId` on a transaction from a different agency (edge case, but theoretically possible if a user moves between agencies or if data is corrupted), they could see it. In practice, `agentUserId` is set by agency staff at that agency only, so this is low risk — but it deviates from the standard `agencyId`-first scoping used elsewhere.

2. **`vendors` array is fetched but never used.** `getAgentCompletions` returns a `vendors` field (array of vendor contact names, `agent.ts:176`). The page component at `page.tsx:94–109` does not include a `vendors` field in `CompletionFileRow`. The `CompletionsGroupList` shows `purchasers` but not vendors. Vendor names are fetched from the database but discarded. Minor dead weight.

3. **All groups start collapsed — none of the data is visible on page load.** `CompletionsGroupList.tsx:62`. A user arriving at the page sees only collapsed group headers and must click each header to see the files. For a page that exists to answer "what's happening this week?", defaulting to collapsed is a friction point.

4. **"Set date →" on no-date files navigates to the file, not an inline picker.** `CompletionsGroupList.tsx:110–113`. The `DateBlock` renders "Set date →" as a bordered span, visually suggesting an action, but the outer `<Link>` means clicking it opens the full property file. The text implies an in-place interaction that doesn't exist.

5. **No search or filter controls.** The page has no text search, no address filter, no sort toggle, and no date range picker. For an agency with many files approaching completion, there is no way to narrow the list. Compare All Files which has search + chip filters.

6. **Fee and price totals in the group header are computed from raw pence (`/ 100`).** `fmt` in `CompletionsGroupList.tsx:7` and `fmtCompact` in `page.tsx:11–15` both divide by 100 to convert from pence to pounds. If `agentFeeAmount` or `purchasePrice` were ever stored in pounds instead of pence (e.g. legacy data entry), the group totals would show 100× the correct value. No unit validation exists on these fields.

7. **`missingFeeCount` note only shows when the group is expanded.** `CompletionsGroupList.tsx:99–103`: the "(N files with no fee set)" disclaimer appears only when `groupFeeTotal > 0 && missingFeeCount > 0 && !isCollapsed`. If the group is collapsed, the header shows the fee total without any indication that it's incomplete. A director could read the header fee total as the full picture when it isn't.

8. **`agentFeeAmount` represents the agent's fee, not a progressor fee.** `assignedUserName` in the row is described as "Progressor" — `"Progressor: {assignedUserName}"` (`CompletionsGroupList.tsx:134`). This field comes from `assignedUser` (the Sales Progressor internal staff member), not the negotiator. The label "Progressor" may confuse self-managed agencies whose files have no internal assignee — the field simply won't appear.

9. **No loading skeleton for the groups themselves.** `loading.tsx` shows 3 placeholder group skeletons. The real groups are dynamic — if an agency has 5 groups, the skeleton shows 3 group placeholders before the real content loads. Minor visual jump but worth noting for completeness.

---

## 11. Pre-existing assumptions verified

The table reflects **current state** after the Hub fix landed on `feature/exchanging-next-30-days-filter`. The first two claims describe behaviour that changed between discovery and article writing.

| Claim | Verdict | Source |
|---|---|---|
| Hub "Exchanging soon" stat links to `/agent/completions` | ✗ **No longer true — resolved.** Stat now links to `/agent/transactions?filter=exchanging-next-30-days`. | `hub/page.tsx` (post-fix) |
| Link is gated to "only when count > 0" | ✓ **Now correct.** The fix added this gate, consistent with "Need attention". | `hub/page.tsx` (post-fix) |
| Completions shows files approaching exchange | ✗ **Wrong.** It shows files that have ALREADY exchanged and are pending legal completion. Page unchanged. | `agent.ts:143–165` |
| Hub "Exchanging soon" count and Completions list represent the same files | ✗ **Wrong.** Hub counts pre-exchange files; Completions shows post-exchange files. These surfaces are no longer linked, so the mismatch no longer misleads users. | `hub.ts:63–72` vs `agent.ts:143–165` |

The Hub-link discrepancy (claims 1 and 4 above) was identified during this discovery and resolved before the article was written. The fix redirects the Hub stat to All Files filtered to the matching pre-exchange population.

---

## 12. Page identity check

**Is "Completions" the right name?** Yes — more defensibly so now that the Hub fix has landed. "Completions" previously reached users via a Hub stat labelled "Exchanging soon", creating a name/destination mismatch that amplified any ambiguity in the page title. With the fix in place, users arrive from the sidebar nav where "Completions" appears alongside Hub, Reminders, To-Do, and Updates. In that navigation context the name is unambiguous. The page subtitle — "Files that have exchanged and are heading to completion" — provides explicit disambiguation at point of arrival. The codebase uses the name consistently (`/agent/completions`, `getAgentCompletions`, page H1, `loading.tsx`), so a rename would have wide blast radius for no material benefit.

**Is this page distinct enough from All Files to warrant its own article?** Yes. Its purpose, data filter, grouping logic, and visual structure are all different from All Files. All Files is a searchable, sortable flat list of all transactions. Completions is a milestone-gated, urgency-grouped, collapsible view of a specific pipeline stage. The article should be clear that Completions is not where legally completed files live — the word "Completions" refers to the upcoming event, not a past state.

---

## Reporting

```
Discovery for: Completions
Report file: docs/help/_discovery/completions.md
Word count: ~2,600
Code references: 50+
Worth-flagging items: 10

What this page actually is:
  A forward-looking view of files that have already exchanged contracts (VM19/PM26 confirmed)
  and are counting down to legal completion (VM20/PM27 not yet done). Not a log of completed files.

Specifically covered:
  - Page identity and purpose: ✓ (answered in §1)
  - Page structure: ✓ (§2 — header, stat segments, summary line, group list)
  - Data source: ✓ (§3 — getAgentCompletions, query shape, sort, no pagination)
  - List/main content: ✓ (§4 — groups, collapse behaviour, no search)
  - Item anatomy: ✓ (§5 — all fields, desktop/mobile, DateBlock, daysLabel)
  - Hub relationship: ✓ (§6 — confirmed link, confirmed DIVERGENCE in what's counted vs shown)
  - Director vs negotiator: ✓ (§7 — heading same, data scoped, no role-specific UI)
  - Empty states: ✓ (§8 — verbatim copy, no filter empty state)
  - Component extraction assessment: ✓ (§9)
  - Worth flagging items: ✓ 9 items (item 3 resolved by Hub fix before article writing)
  - Pre-existing claims verified: ✓ (§11 — updated to reflect post-fix state)
  - Page identity check: ✓ (§12)
```
