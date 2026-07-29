# Verification checklist — Phase 4 sign-off

**Owner:** Ellis (manual tick, with me observing)
**Purpose:** the one thing between preview and prod. If a row here fails, Phase 2 gets a fix and we walk the whole list again.

**Derived from:** [01-audit.md](01-audit.md) — every row here corresponds to at least one conditional/control/state in the audit. If a row is added here, it should trace to an audit entry.

## How to use

For each row:
1. Set up the state (choose the fixture / login as the right role / trigger the flow)
2. Load `/agent/hub-preview`
3. Verify the row's expected behaviour
4. Tick, or if fail: file the row + fix + re-walk from the top of that section
5. Take a screenshot naming it `after--{row-id}.png` and drop in `docs/active/hub-migration/after-preview/`

Sign-off = every row ticked + Playwright green + no unexplained diff vs baseline.

---

## Section 1 — Empty state (director, 0 files)

- [ ] E1: Header greeting reads "Good {morning|afternoon|evening}, Emily 👋"
- [ ] E1: Subtitle reads "…your pipeline today."
- [ ] E1: "New sale" button visible (canCreateSale=true)
- [ ] E1: "Send a note" button visible (!isInternalStaff)
- [ ] E2: Welcome CTA reads "Add your first sale…"
- [ ] E2: "Add a sale" button visible + links to `/agent/transactions/new-v2`
- [ ] E3–E7: Ghost cards visible with opacity ~0.35 and no pointer events
- [ ] PaymentBlockBanner NOT visible
- [ ] PaymentMethodNudge NOT visible
- [ ] No Today's diary / ExpiredHolds / UnassignedFiles / NewBuyers / ChainSetup / PipelineAtAGlance / Activity ribbon / Pro tip

## Section 2 — Empty state (sales_progressor, 0 assigned files)

- [ ] Subtitle reads "…your assigned files today."
- [ ] "New sale" NOT visible (canCreateSale=false)
- [ ] "Send a note" NOT visible (isInternalStaff)
- [ ] Welcome copy reads "No assigned files yet."
- [ ] "Add a sale" button NOT visible

## Section 3 — Populated hub (director)

- [ ] F1: Header greeting + subtitle "Here's what matters today."
- [ ] F1: New sale button visible
- [ ] F1: Send-a-note button visible
- [ ] F2: PaymentBlockBanner renders IF fixture has payment issue
- [ ] F3: PaymentMethodNudge renders IF fixture has no card + past trial+7d
- [ ] F4: Today's diary renders IF diaryItems.length > 0
  - [ ] Row link goes to `/agent/transactions/{id}`
  - [ ] Completion rows have green border, exchange rows have coral border
  - [ ] Pill reads "N events today" (or "1 event today")
- [ ] F5a: ExpiredHoldsCard renders IF expired holds exist
  - [ ] Address link works
  - [ ] "Take off hold" opens modal with 2 options + Cancel/× / backdrop close
  - [ ] "Resume automation" → reactivates file
  - [ ] "Reactivate, keep emails paused" → reactivates + pauses emails
  - [ ] "Extend" opens inline date input
  - [ ] Date input min = tomorrow 9am
  - [ ] Past date → toast error + Save disabled
  - [ ] "Set date" → extendHoldAction fires
  - [ ] "Indefinitely" → extendHoldAction with null
  - [ ] "Cancel" closes extender
- [ ] F5b: AttentionListView always renders
  - [ ] "All reminders" link visible IF items > 0
  - [ ] Row → `/agent/transactions/{id}?tab=reminders`
  - [ ] First 3 items visible
  - [ ] Empty state: green dot + "All clear" copy IF items === 0
  - [ ] Escalated pill has hover tooltip with reason
- [ ] F5c: UnassignedFilesView returns null for director (correct — not admin_all)
- [ ] F5d: NewBuyersToAcknowledgeView returns null for director
- [ ] F5e: ChainSetupPendingView renders IF data present
  - [ ] Address link works
  - [ ] "Mark as done" fires clearChainSetupPendingAction
- [ ] F6: PipelineAtAGlance always renders
  - [ ] All 5 stage circles visible (New, Legals, Ready, Exchanged, Completed)
  - [ ] Empty copy inside card IF totalActive === 0 && completed === 0
  - [ ] Hover any circle → popover bubble
  - [ ] Bubble Esc/outside click/blur closes
  - [ ] Bubble tone: quietFiles/overdue/SLA colour flips
- [ ] F7a: Pipeline health card renders
  - [ ] Subtitle: "Where your business stands today."
  - [ ] "Active files" tile → `/agent/transactions`, shows +N delta IF newThisMonth > 0
  - [ ] "Exchanging soon" tile — links only IF exchangingSoon > 0
  - [ ] "Need attention" tile — colour flips: red if escalated, warning if attention, primary otherwise
  - [ ] "Need attention" delta: "N escalated" / "All clear" / null
  - [ ] "Pipeline value" tile — non-clickable
- [ ] F7b: WinsCard renders (correct tier based on data)
- [ ] F7c: Coming-up strip: 3 links, colour dims when count = 0
- [ ] F7d: Stalled row: empty copy IF count === 0, else chase link
- [ ] F8a: Exchange forecast card renders
  - [ ] Subtitle: "When your files are due to exchange."
  - [ ] Empty copy IF next30Days === 0
  - [ ] Chart + week labels IF has data
  - [ ] Current week label = coral
  - [ ] "This week" count = coral IF > 0
  - [ ] Ready-check nudge IF next7Days > 0 (singular vs plural copy)
- [ ] F8b: Service split card renders (director gets it — !isProgressor)
  - [ ] Title = "Who's managing"
  - [ ] Legend: "Managed by you" / "Our team"
  - [ ] Info-pill IF outsourced > 0, else muted "All files self-managed" line
  - [ ] Info-pill copy: "Our team is handling N files, saving you ~X hours"
  - [ ] Saved-hours mention IF savedHours > 0
- [ ] F9: Activity ribbon IF recentActivity truthy
  - [ ] Icon glyph correct per kind (milestone → check, email/whatsapp/call/sms icons)
  - [ ] "View file" link works
- [ ] F10: Pro tip fires correct tier
  - [ ] Stalled tier → work-queue link
  - [ ] Escalated tier → work-queue link
  - [ ] Exchanging soon tier → filter link
  - [ ] Attention count tier → work-queue link
  - [ ] Healthy tier (director) → /new-v2 link IF canCreateSale, else non-clickable
  - [ ] Healthy tier (admin) → /agent/analytics
  - [ ] Healthy tier (progressor) → /agent/transactions

## Section 4 — Populated hub (sales_progressor, pure)

- [ ] Subtitle: "Your assigned files at a glance."
- [ ] "New sale" NOT visible
- [ ] "Send a note" NOT visible
- [ ] UnassignedFilesView returns null (not admin_all)
- [ ] NewBuyers renders IF has data (assigned scope)
- [ ] Service split card HIDDEN (isProgressor && !isAdmin)
- [ ] Grid drops to 1fr layout
- [ ] Pro tip healthy-tier copy: "All your assigned files are healthy." → /agent/transactions

## Section 5 — Populated hub (admin)

- [ ] Subtitle: "Platform-wide pipeline at a glance."
- [ ] "New sale" visible (admin has canCreateSale)
- [ ] "Send a note" NOT visible (isInternalStaff)
- [ ] UnassignedFilesView renders IF unassigned files exist
  - [ ] "Assign" toggles dropdown
  - [ ] Dropdown fetches `/api/agency/users` on first open
  - [ ] Save fires assignUserAction
  - [ ] Cancel closes
- [ ] NewBuyers renders IF has data
  - [ ] "Acknowledge" fires acknowledgeRelistAction
- [ ] Service split card visible
  - [ ] Title = "Service split"
  - [ ] Legend: "Self-managed" / "Outsourced to us"
  - [ ] Info-pill copy: "We're progressing N files across all client agencies"
- [ ] Pro tip healthy tier: "Platform is ticking along nicely." → /agent/analytics
- [ ] Cross-agency data visible (Ellis view)

## Section 6 — Hybrid SP-admin (Ellis)

- [ ] Subtitle uses admin-flavoured "Platform-wide" text
- [ ] "New sale" NOT visible (canCreateSale checks raw role)
- [ ] "Send a note" NOT visible (isInternalStaff true)
- [ ] Service split card visible with ADMIN labels (Service split / Self-managed / Outsourced to us)
- [ ] Pro tip healthy tier: admin variant → /agent/analytics

## Section 7 — Viewer

- [ ] Assigned scope
- [ ] No admin copy, no create-sale button, no send-note button
- [ ] Subtitle uses non-progressor/non-admin variants

## Section 8 — Multi-tenant safety (Law 7)

- [ ] Director @ Hartwell sees only Hartwell files
- [ ] Director @ another agency sees only that agency's files
- [ ] Sales progressor sees only files where assignedUserId = their id
- [ ] Admin sees files across agencies (outsourced only)

## Section 9 — Visual regression vs baseline

- [ ] Every screenshot in `docs/active/hub-migration/baseline/` has a matching `after-preview/` screenshot
- [ ] No unexplained visual diff — anything different documented with reason

## Section 10 — Playwright happy path

- [ ] `e2e/surface-agent-hub.spec.ts` passes against `/agent/hub-preview`
- [ ] New `e2e/surface-agent-hub-migration.spec.ts` passes against both `/agent/hub` and `/agent/hub-preview`

---

## Sign-off signature

When every row above is ticked, and the two Playwright checks are green:

**Ellis: "This is fine to go live."** — recorded date + time here, in text.

Only after that line is written do we plan Phase 5 (route swap under flag) in a separate conversation. `app/agent/hub/page.tsx` remains untouched until then.
