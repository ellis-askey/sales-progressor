# Open Questions

---

## OQ-1 — Contact model has no prefix/firstName/lastName fields [IRREVERSIBLE]

**Question:** The Phase 1 spec defines helpers with signature `{ prefix?: string | null; firstName?: string | null; lastName?: string | null }`, but `Contact.name` is a single `String` field in the Prisma schema. There are no separate `prefix`, `firstName`, or `lastName` columns.

**Options considered:**
1. Add `prefix`, `firstName`, `lastName` columns to the schema (schema migration required)
2. Write helpers that accept `{ name: string }` and parse internally
3. Write helpers that accept `{ name: string }` and also accept the 3-field shape (union) for future compatibility

**Choice made:** Option 2 — helpers accept `{ name: string }` and parse internally. The helper `parseName(name: string)` splits on spaces and detects TITLE_PREFIXES to extract semantic parts. This avoids a schema migration, is invisible to callers, and correctly solves the "Miss" bug.

**Why IRREVERSIBLE:** If prefix/firstName/lastName columns are added to the schema later, call sites using `{ name: string }` would need updating. However, since we own all call sites, this is straightforward to migrate if needed.

**Impact on later phases:** None. Phases 2–6 only receive the output of these helpers (strings), not the input shape.

---

## OQ-2 — @phosphor-icons/react is also installed [REVERSIBLE]

**Question:** `@phosphor-icons/react` ^2.1.10 is in `package.json`. The spec says to use only lucide-react and not add a second icon library. Since phosphor is already present (not added by this run), should it be removed?

**Options considered:**
1. Remove phosphor from package.json (risky — may break other code)
2. Leave it in, use only lucide for new icons in this PR

**Choice made:** Option 2 — leave phosphor in place. It was not added by this run and removing it could break existing code that imports from it. All new Phase 2 icons use lucide-react only.

**Impact:** None — phosphor is not used in any new code from this run.

---

## OQ-3 — Entry types with no current DB records [REVERSIBLE]

**Question:** The Phase 2 icon map includes `milestone_reverted`, `details_changed`, `contact_updated`, `transaction_created`. None of these exist as timeline entries in the current database schema. ActivityTimeline only shows `milestone` and `comm` kinds.

**Options considered:**
1. Add these kinds to the ActivityEntry type and timeline rendering now (premature)
2. Skip them in Phase 2 — map them to gray/fallback if they ever appear, document here

**Choice made:** Option 2 — skip. The `<TimelineIcon>` component accepts a `type` string and falls back to a gray `Circle` icon for any unknown type, so future kinds will degrade gracefully without errors.

---

## OQ-4 — Solicitor roleType has no side context for avatar [REVERSIBLE]

**Question:** `ContactRole` enum includes `solicitor` but doesn't distinguish vendor-solicitor vs buyer-solicitor. Phase 3 avatar side mapping requires knowing which side a contact is on.

**Options considered:**
1. Add a `side` field to Contact model (schema change)
2. Map `solicitor` to the fallback gray gradient
3. Infer from transaction context at the call site (complex, not worth it for visual display)

**Choice made:** Option 2 — `solicitor` and `other` map to the fallback gray gradient. Broker maps to purchaser side (buyers typically have brokers for mortgage). This gives correct visual results for the vast majority of timeline entries (vendor/purchaser contacts dominate).

---

## OQ-5 — Phase 4 notification pills: "popup" interpretation [REVERSIBLE]

**Question:** The spec says "Post-confirm popup displays a row of pills showing who was notified." MilestoneRow has no existing popup/modal for standard confirmation — just `toast.success()`. There's a reconciliation modal for exchange milestones.

**Options considered:**
1. Add a post-confirm modal (full modal, dismissed explicitly)
2. Extend the toast to include notification pills
3. Show a brief inline overlay on the confirmed MilestoneRow that auto-dismisses after 4 seconds

**Choice made:** Option 3 — inline post-confirm overlay. The MilestoneRow shows a small dismissible panel immediately below the confirmed row with the notification pills. Auto-dismisses after 5 seconds. This keeps context (the pill is adjacent to the confirmed milestone) and avoids a full modal for what is informational feedback.

---

## OQ-6 — agentName in summary.ts uses split(" ")[0] [REVERSIBLE]

**Question:** `resolveTemplateTokens` in `lib/services/summary.ts` also does `agentName.split(" ")[0]` for the `{agent}` token (line 34). `agentName` comes from `User.name` which also could start with a title.

**Choice made:** Fix this with the same `extractFirstName()` helper. Low risk — User names are less likely to start with titles, but the fix is trivial and consistent.

---

## OQ-7 — "Exchanging soon" conflict check: rename or keep `exchangingThisWeek` [REVERSIBLE]

**Question:** The spec says: if "Exchanging soon" already counts a 7-day window using `expectedExchangeDate`, rename `exchangingThisWeek` to `exchangeReadyCount` and source it from milestone readiness (VM18/PM25 complete, VM19/PM26 not complete).

**Phase 0 finding:** "Exchanging soon" (hero number) uses a **30-day** window (`expectedExchangeDate OR overridePredictedDate`), with no milestone gate. It is NOT a 7-day window.

**Choice made:** Keep `exchangingThisWeek` as specified. The 7-day window on `expectedExchangeDate` (gated by VM19/PM26 not complete) is not a duplicate:
- Different time window (7 days vs 30 days)  
- Different date field (only `expectedExchangeDate`, vs `expectedExchangeDate OR overridePredictedDate`)
- Different milestone gate (VM19/PM26 not complete, vs no gate)

**Why REVERSIBLE:** If the product decision changes to source `exchangingThisWeek` from milestone readiness instead (VM18/PM25 complete, VM19/PM26 not), the service query changes to a milestone filter rather than a date-window filter. The UI copy and link destination would also change. All three touch points are isolated to `lib/services/hub.ts` and `app/agent/hub/page.tsx`.

---

## OQ-8 — `serviceMode` field does not exist; mapped to `serviceType` [IRREVERSIBLE]

**Question (from retention email Phase 3 spec):** The `send_to_us_drop_21d` trigger condition references `serviceMode === "send_to_us"`. No such field exists on `PropertyTransaction`.

**Finding:** The schema has `serviceType ServiceType @default(self_managed)` with enum `{ self_managed | outsourced }`. The `outsourced` value corresponds to "send to us" (agency has contracted Sales Progressor to progress the file).

**Choice made:** Map `send_to_us_drop_21d` trigger to `serviceType === "outsourced"`. The field exists, the semantic is equivalent, and no schema change is required.

**Why IRREVERSIBLE:** If a future `serviceMode` field is added to the schema with a different name/enum, the trigger query in `lib/services/retention.ts` would need updating. Since we own that code, it is straightforward to migrate.

**Impact:** `send_to_us_drop_21d` email IS implemented — the data is available. No steps skipped.

---

## OQ-9 — `User.lastLoginAt` does not exist [REVERSIBLE]

**Question:** The retention sweep may logically want to use "last login" as a trigger for quiet/lapsed users. `User.lastLoginAt` does not exist.

**Choice made:** Use `PropertyTransaction.createdAt` (most recent transaction created by the user via `agentUserId`) as the proxy for "last meaningful activity." This is the most reliable indicator of user engagement for an estate agent platform — users who add files are active users.

**Why REVERSIBLE:** If `lastLoginAt` is added to the User model later, the trigger conditions can be updated to incorporate it. The current implementation is conservative (only triggers on file activity, not logins).

---

## OQ-10 — `stuck_day_3` uses transaction-level completions, not user-confirmed completions [REVERSIBLE]

**Question:** The spec says "zero MilestoneCompletion rows exist on ANY of the user's transactions." This could mean:
1. Zero completions at all (state = complete), regardless of who confirmed
2. Zero completions confirmed by this user (`completedById = userId`)

**Choice made:** Option 1 — zero `MilestoneCompletion` rows where `state = "complete"` on any of the agent's transactions. This is the simpler and more correct trigger: if the file has any confirmed milestones (even auto-confirmed or confirmed by a progressor), the file is "in use" and the user should not receive the stuck email.

**Why REVERSIBLE:** If the intent is "user hasn't personally confirmed any milestones," switch the query to filter `completedById = userId`. Both options use the existing `completedById` field.
