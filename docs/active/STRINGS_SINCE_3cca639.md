# All strings shipped since `3cca639` — for voice review

Every user-facing string added or changed in the 14 feature commits between `3cca639` (this morning) and `f34ae72` (latest). **Push notification strings are not in here** — they're already in `PUSH_NOTIF_STRINGS_FINAL.md`. Migration commit messages, icon-only changes (sweep, size tweaks), and middleware fixes have no strings.

Format: source file → exact strings → voice flag if any.

---

## 1. Elapsed-time label (`7bf9401`)

**Where it renders:** Progress card on the transaction sidebar (full + compact variants).
**Source:** [lib/utils.ts](lib/utils.ts) `formatElapsedDays(days, opts?)`

| Days | Full label | Compact label |
|---|---|---|
| 0 | `Just started` | `Just started` |
| 1 | `1 day elapsed` | `1 d` |
| N (2–6) | `N days elapsed` | `N d` |
| 7 | `1 week elapsed` | `1 wk` |
| N×7 | `N weeks elapsed` | `N wks` |
| 8 | `1 week 1 day elapsed` | `1 wk 1 d` |
| mixed | `N weeks M days elapsed` | `N wks M d` |

**Voice flag:** `Just started` for day 0 is fine. The compact `1 wk 1 d` reads OK but `1 d` alone (1-day-old file) is cryptic — would a human read "1d"? Probably yes given the constrained space. Keep.

---

## 2. Per-contact automated-email counter pill (`1332c9b`)

**Where it renders:** Each contact row in `ContactsSection` (transaction detail page).
**Source:** [components/contacts/ContactsSection.tsx:291-296](components/contacts/ContactsSection.tsx#L291-L296)

**Pill label (always shown when count > 0):**

| Count | Label |
|---|---|
| 1 | `1 auto email` |
| 2+ | `N auto emails` |

**Tooltip (varies by count tier):**

| Tier | Tooltip text |
|---|---|
| 1–4 (muted) | `N auto emails` (same as label) |
| 5–9 (amber) | `N auto emails — review chase cadence` |
| 10+ (red) | `N auto emails — likely over-chasing; consider pausing client emails` |

**Voice flag:** `auto email` reads a bit terse. Could be `automated email` — but pill width matters more. Keep. Tooltip strings are agent-internal so the directness ("likely over-chasing") is right.

---

## 3. PM24 NR reason + reversal comms (`50248da`)

**Where it renders:** NR reason persisted on `MilestoneCompletion.notRequiredReason` (visible in the milestone-detail drawer); reversal comms entry in the file's Updates feed when an edit flips a milestone in/out of NR.

**Source:** [app/actions/transactions.ts:1093-1094, 1123](app/actions/transactions.ts#L1093)

**NR reasons (one of three, set at the moment of auto-NR):**
- `Freehold property` — applied to VM8 / VM9 / PM12 when tenure = freehold
- `Cash buyer` — applied to PM5 / PM6 / PM11 when purchase type = cash_buyer
- `Cash from proceeds` — applied to PM5 / PM6 / PM11 / **PM24** when purchase type = cash_from_proceeds

**Reversal comms (when an edit reverses a previously-complete milestone):**

```
Milestone reversed: "{milestone name}" no longer applies — {change description}.
```

Where `{change description}` is one of:
- `purchase type changed from {old} to {new}` (with values: Mortgage / Cash buyer / Cash from Proceeds)
- `tenure changed from {old} to {new}` (with values: Freehold / Leasehold)

**Voice flag:**
- `Cash from Proceeds` (capital P) appears inconsistently — line 1110 uses capital P, line 1094 / 1195 use lowercase "Cash from proceeds". Same string, two casings. Pick one — lowercase "proceeds" matches everywhere else in the app's purchase-type dropdown. **Fix recommended.**
- The em-dash in the reversal-comms template (`no longer applies — {change}`) is fine here — internal note in the activity feed, not lock-screen-constrained.

---

## 4. Email-notifications settings card (`8ff7968`)

**Where it renders:** `/agent/settings` → "Email notifications" card (below Branch theme).
**Source:** [components/agent/settings/EmailNotificationsSection.tsx:33-57, 90-92](components/agent/settings/EmailNotificationsSection.tsx#L33)

**Card heading + description:**
- Heading: `Email notifications`
- Description: `Tune which automated emails reach your inbox. The in-app bell keeps showing everything — these toggles only suppress the email duplicates.`

**Five toggle rows (label + description):**

| Label | Description |
|---|---|
| `Morning digest` | `Daily summary of files needing attention (08:00 weekdays).` |
| `Weekly brief` | `Monday-morning rollup of last week + escalations.` |
| `Client confirmations` | `Email me when a buyer or seller confirms a milestone. The bell will still notify you.` |
| `Chain updates` | `Email me when a chain link is lost, paused, or asking us to wait.` |
| `Retention emails` | `Post-exchange follow-ups we use to learn how the file went.` |

**Voice flags:**
- `Tune which automated emails reach your inbox` reads slightly engineery — "Choose which" or "Decide which" would be plainer. The "Tune" verb is unusual in agent copy.
- The em-dash in the heading description and in "Monday-morning rollup" is fine here (web UI, not push).
- `rollup` is jargon — "Monday-morning summary of last week + escalations" is clearer. Or just "Weekly summary of last week's escalations + activity."
- Three of the five descriptions start with `Email me when…` (clean parallel structure); two break the pattern. Worth aligning if you care about parallelism.

---

## 5. Silenced-files settings card (`8ff7968`)

**Source:** [components/agent/settings/SilencedFilesSection.tsx:82-90, 102-129, 138, 151](components/agent/settings/SilencedFilesSection.tsx#L82)

**Heading + description:**
- Heading: `Silenced files`
- Description: `Files where automated client emails are paused. You can still pause or resume from the file itself — this is a faster way to see everything at once.`

**Empty state (no files silenced):**
- `No files are currently silenced. Use the picker below to silence one.`

**Per-row label format:**
- `Paused {relative time} by {user name}` — e.g. `Paused 2 weeks ago by Sarah`
- Or just `Paused {relative time}` if no user name

**Picker / actions:**
- Button (closed picker, files available): `+ Silence another file`
- Button (closed picker, no files left): `All your active files are already silenced`
- Picker placeholder: `— Choose a file —`
- Confirm button in open picker: `Silence`
- Cancel button: `Cancel`
- Row button (per silenced file): `Resume`

**Voice flag:** `+ Silence another file` is fine. The closed-picker disabled state (`All your active files are already silenced`) is technically correct but slightly cold — "Nothing else to silence" reads warmer. Minor.

---

## 6. Mobile push notifications settings card (`accd704` + `632dedc` + `f34ae72`)

**Source:** [components/agent/settings/MobilePushSection.tsx](components/agent/settings/MobilePushSection.tsx)

**Heading + description:**
- Heading: `Mobile push notifications`
- Description: `Get device pop-ups for the events that matter — even when the tab is closed. The in-app bell still fires for everything; these toggles only control the device push.`

**Sub-section headings:**
- `Devices`
- `Push me when…`

**Device list:**
- Empty state: `No devices subscribed yet — click below to enable on this one.`
- Per-device label (when userAgent set): `Chrome on Mac` / `Safari on iPhone` etc. (via `parseUserAgent`)
- Per-device label (fallback, no userAgent): `Subscribed device`
- Per-device sub-label:
  - If never pushed: `Added {date "5 Mar"}`
  - If pushed in last hour: `Last used just now` OR `Last used 1 hour ago` OR `Last used N hours ago`
  - If pushed yesterday: `Last used yesterday`
  - If 2–6 days: `Last used N days ago`
  - If 7–29 days: `Last used N weeks ago`
  - If 30+: `Last used N months ago`
- "This device" badge: `This device` (uppercase, small)
- Revoke button: `Revoke`

**Enable / test buttons:**
- Idle: `Enable on this device`
- Asking: `Asking permission…`
- Done: `✓ Enabled`
- Test button: `Send test push`
- Test button tooltip (no devices): `Enable on a device first`
- Test button tooltip (has devices): `Sends a test push to confirm setup works. Bypasses the toggles below.`

**Test push status messages:**
- During: `Sending…`
- Success (1 device): `Sent — check your device.`
- Success (N devices): `Sent to N devices.`
- Failure: `Couldn't send — check console`
- No devices: `No devices subscribed yet — enable on this device first.`
- VAPID missing: `Push isn't configured on the server (VAPID env vars missing).`

**Permission-state error strings:**
- Denied: `Permission denied. To enable, click the lock/permissions icon in your browser address bar and allow notifications, then click Enable again.`
- Blocked: `Notifications are blocked for this site in your browser settings. Unblock there, then click Enable again.`
- Browser unsupported: `Your browser doesn't support web push notifications. Try Chrome, Edge, Firefox, or Safari (macOS 13+).`
- Generic error: `Something went wrong: {message}`
- VAPID missing on client: `Push isn't configured for this environment.` (rare — only fires if `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is missing from the client bundle)

**iOS PWA walkthrough (when iOS Safari + not standalone):**
- Heading: `To get push on iPhone, install Sales Progressor first:`
- Step 1: `Tap the Share button at the bottom of Safari`
- Step 2: `Scroll down and tap "Add to Home Screen"`
- Step 3: `Tap Add`
- Step 4: `Open the new Sales Progressor icon from your home screen`
- Step 5: `Come back to this settings page and click Enable`

**Six per-event toggle rows:**

| Label | Description |
|---|---|
| `Client milestone confirmations` | `When a buyer or seller confirms a milestone via their portal. Off by default — turn on if you want the buzz for every client tick.` |
| `Client replies on Respond page` | `When a client leaves a note on a chase request (e.g. "Solicitor's away til Monday").` |
| `Chase escalates` | `When a chase task crosses the threshold to escalated priority — manually or by the engine.` |
| `File assigned to me` | `When an admin assigns a new file to you.` |
| `Exchange ≤ 7 days` | `Daily check; fires once per file when the exchange target is within a week.` |
| `Chain updates` | `Lost buyer / lost purchase / asked to wait / wait nudge / decline on any chain your file is part of.` |

**Voice flags:**
- `Sent — check your device.` is fine. `Sent to N devices.` is fine. The full-stop terminator is inconsistent: most status strings end with `.`, but `Asking permission…` uses ellipsis only and `Couldn't send — check console` has no terminator. Pick a convention.
- `When an admin assigns a new file to you.` — could read as exclusionary if a director ever reassigns (not just admin). Wider phrasing: `When a file is assigned (or reassigned) to you.` Matches the actual code path (`assignUserAction` is admin-only today but the wording locks us into that).
- `for the buzz for every client tick` — the word `tick` is internal/dev (= a checkmark in the milestone UI). To an agent it could read as confusing. `every client confirmation` is plainer.
- `Daily check; fires once per file…` — the semicolon is unusual in our copy; most descriptions use full stops. `Fires once per file when the exchange target is within a week.` (drop the leading "Daily check;") is tighter — the daily-ness is an implementation detail the user doesn't need.
- `Lost buyer / lost purchase / asked to wait / wait nudge / decline` — slash-list of internal event names. To an agent: "wait nudge" and "decline" don't translate. Suggest: `When something happens on a chain your file is part of — pulled buyer, fallen purchase, wait requests, or invite declines.`
- `Exchange ≤ 7 days` — using the math operator on a settings row reads techy. `Exchange in 7 days or less` or `Exchange approaching` (matches the push title) reads more natural.
- The iOS walkthrough is fine — clear, step-by-step. No changes.

---

## 7. `/admin/migrate` page (`7c375e4` + `4ea0749`)

**Source:** [app/admin/migrate/page.tsx:44-47](app/admin/migrate/page.tsx#L44), [app/admin/migrate/MigrateSaleForm.tsx](app/admin/migrate/MigrateSaleForm.tsx)

**Page header:**
- Title: `Migrate historical sale`
- Subtitle: `Admin-only. Hand-enters a sale from an old system, backdates the file age and milestone history so it joins the live engine with the right state — and looks identical to a natively-created file. One at a time — submit, repeat.`

**Section headings:**
1. `1. File age + assignment`
2. `2. Property + sale details`
3. `3. Contacts`
4. `4. Fees (optional)`
5. `5. Milestones already completed`

**Section 1 fields + hints:**
- `Original created date *` — hint: `Backdated to the file's real start date from the old system. Drives weeks-elapsed and the 12-week target.`
- `Agency *`
- `Assigned Sales Progressor *`
- `Original agent (director or negotiator)` — hint: `Who owned this file on the agency side in the old system. Attributed to milestone completions in the activity timeline. Leave blank to render as "Auto-confirmed" (like portal confirmations).` (Extra clause when agency has no agents: ` No directors/negotiators on this agency — leaving blank.`)
- Agent dropdown placeholder: `— None / unattributed —`
- `Progressed by` — radio options: `Progressor (outsourced)` / `Agent (self-managed)` — hint: `Determines serviceType. Outsourced = our team progresses; self-managed = agency progresses themselves.`

**Section 2 fields:**
- `Street address *`
- `City *`
- `Postcode *`
- `Tenure *` — dropdown: `— Select —` / `Freehold` / `Leasehold`
- `Purchase type *` — dropdown: `— Select —` / `Mortgage` / `Cash buyer` / `Cash from proceeds`
- Conditional checkbox (when tenure=leasehold): `Share of freehold`
- `Purchase price (£)` — placeholder: `450000`
- `Notes`

**Section 3 (contacts):**
- `Vendor(s) *` and `Purchaser(s) *` row headers with `+ Add` button
- Row inputs: `Full name` / `Phone` / `Email` (placeholders)

**Section 4 (fees, optional):**
- Hint: `Leave blank if unknown — can be filled in later from the file's Edit Sale Details drawer.`
- `Agent fee — flat (£)` — placeholder: `e.g. 4500`
- `Agent fee — percent (%)` — placeholder: `e.g. 1.25`
- Checkbox: `Agent fee includes VAT`
- `Solicitor referral fee (£)` — placeholder: `e.g. 200`

**Section 5 (milestones):**
- Hint: `Tick every milestone the file has already passed in the old system. Set a real-world date per tick. Untick = still pending — the reminder engine will pick them up.`
- Column headings: `Vendor side` / `Purchaser side`
- Per-side tick count footer: `N ticked`

**Submit + reset bar:**
- Submit button (idle): `Create migrated file`
- Submit button (busy): `Migrating…`
- Reset button: `Reset`
- Helper text: `~40 files to go. Submit, success banner appears, form resets, repeat.`

**Validation error messages (top of form on submit failure):**
- `Select an agency`
- `Select a sales progressor`
- `Address (street + city + postcode) is required`
- `Tenure is required`
- `Purchase type is required`
- `At least one vendor name is required`
- `At least one purchaser name is required`
- `Original created date is required`
- `Invalid created-at date`
- `Created date can't be in the future`
- Generic fallback: `Migration failed`

**Success banner (after successful submit):**
- `Migrated: {address}` (heading)
- `{N} historical milestone backdated. Open file →` (singular) or `{N} historical milestones backdated. Open file →` (plural)

**Voice flags:**
- `~40 files to go. Submit, success banner appears, form resets, repeat.` — this is a *me-to-me* note about the workflow, not customer-facing copy. Fine since admin-only + throwaway, but if anyone other than you ever lands here it reads weird. Could be `Submit, success banner appears, form resets. Migrate the next one.` (drops the count).
- `Drives weeks-elapsed and the 12-week target.` — `weeks-elapsed` is a code-name. To a human reader: `Drives the file's age and the 12-week exchange target.` is clearer.
- `Determines serviceType. Outsourced = our team progresses; self-managed = agency progresses themselves.` — `Determines serviceType` exposes the schema field. Could be: `Outsourced means our team progresses the file; self-managed means the agency does.`
- The "Original agent" hint uses straight-quotes around `"Auto-confirmed"` — fine for an admin page.
- Validation errors are consistent and direct. Good.
- `Migrating…` for the in-flight state is fine.
- Section heading numbering (`1. File age + assignment` etc.) is unusual — most app sections aren't numbered. Could drop the numbers for cleaner look (but they help the admin keep place while scrolling — admin page, low cost).

---

## 8. PR `4ea0749` migrate-attribution backfill notes

These strings only appear if a backfill script ever runs (currently the scripts are deleted). Listing for completeness — not user-facing in the normal app flow.

- Reason on backfilled NR: `Cash from proceeds — deposit comes from concurrent sale equity` (was in the throwaway backfill script — DELETED)
- Reversal note (was): `Milestone reversed: "{name}" no longer applies — Cash from proceeds means deposit is in concurrent-sale equity, not pre-exchange transfer.`

Neither lives in the current source — both were in the deleted `scripts/backfill-pm24-cash-from-proceeds.mjs`.

---

## 9. Spec / migration / planning docs (informational)

`docs/MILESTONES_SPEC_v1.md` PM24 row updated:
- `Can be marked not required` value changed from `No` to: `Auto-only — auto-NR when Purchase type = Cash from proceeds (deposit comes from concurrent-sale equity, so no pre-exchange transfer to track). Manual NR not permitted.`

Auto-NR table row added:
- `PM24 (Buyer has transferred the deposit) | Purchase type = Cash from proceeds (deposit comes from concurrent-sale equity, not pre-exchange transfer)`

`docs/active/ELLIS_MANUAL_TODO.md` entry added:
- `Settings polish pass — consider tabbed layout once card count crosses ~8. The notification-toggles work (shipped) pushes /agent/settings from 5 cards to 7. Polish pass should audit whether a tabbed layout (Profile / Notifications / Branch / Team / Account) becomes warranted; current single-column stack still scans fine. New cards used the existing ThemePicker glass-card pattern so they refit cleanly into tabs without code changes.`

Internal docs only. No voice changes needed.

---

## Voice flags summary — what's worth changing

In rough priority order of "actually noticeable to a user":

| # | Where | Issue | Suggested fix |
|---|---|---|---|
| 1 | PM24 NR change-desc comms | `Cash from Proceeds` (cap P) vs `Cash from proceeds` (lower) used inconsistently | Pick lowercase to match the dropdown |
| 2 | Push toggle: "Client milestone confirmations" description | `for the buzz for every client tick` — `tick` is jargon | `…if you want the buzz for every client confirmation` |
| 3 | Push toggle: "File assigned to me" description | Says `admin` but the action could conceivably reassign too | `When a file is assigned (or reassigned) to you.` |
| 4 | Push toggle: "Chain updates" description | Slash-list of internal event names (`wait nudge`, `decline`) | Plain English: `When something happens on a chain your file is part of — pulled buyer, fallen purchase, wait requests, or invite declines.` |
| 5 | Push toggle: "Exchange ≤ 7 days" label | Math operator in a settings row reads techy | `Exchange in 7 days or less` or `Exchange approaching` (matches push title) |
| 6 | Email-notifications card description | `Tune which automated emails…` — "Tune" is unusual | `Choose which automated emails…` |
| 7 | Email-notifications "Weekly brief" description | `rollup` is jargon | `Weekly summary of last week's escalations + activity.` |
| 8 | Migrate page hint #1 | `weeks-elapsed` is a code-name | `Drives the file's age and the 12-week exchange target.` |
| 9 | Migrate page hint on Progressed by | `Determines serviceType` exposes a schema field name | `Outsourced means our team progresses the file; self-managed means the agency does.` |
| 10 | Push status terminator inconsistency | Some statuses end `.`, others don't | Pick a rule (probably: all status text ends with `.`) |

None of these are critical. (1) is the only one with cross-app inconsistency. The push toggle copy (2)–(5) is the highest-volume agent-facing copy in this batch and is where polish would land most visibly.
