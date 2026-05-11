# Inventory: Transaction Detail

**Route:** `/agent/transactions/[id]`
**Stage 1 status:** Complete
**Stage 2 status:** Complete (19/19 gate items passing — 2026-05-11)
**Stage 3 status:** Approved 2026-05-11
**Stage 4 status:** Ready to proceed
**Amendments:** See bottom of file

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/transactions/[id]` |
| File | `app/agent/transactions/[id]/page.tsx` |
| Component type | Server component (page); child components are client components |
| Who sees it | Director (all files), Negotiator (own files only — `agentUserId === session.user.id`) |
| How they reach it | Hub card click / Transaction list row / Search result / Email link / Redirect after new-file creation (`?mosConfirmed=1` or `?newFile=1`) |
| Reachable without a transaction? | No — `notFound()` if transaction missing or access denied |

---

## 2. Components rendered

| Component | File | Notes |
|---|---|---|
| `AgentShell` | `components/layout/AgentShell.tsx` | Wraps the page; sidebar, topbar, toaster |
| `PropertyHero` | `components/transaction/PropertyHero.tsx` | Warm variant for agent surface. Address, status, progress bar, back link |
| `PropertyFileTabs` | `components/transaction/PropertyFileTabs.tsx` | Tab bar: Overview / Milestones / Reminders / To-Do / Activity |
| `StatusControl` | `components/transaction/StatusControl.tsx` | Status badge + dropdown; director only. Uses `useOptimistic` |
| `TransactionSidebar` | `components/transaction/TransactionSidebar.tsx` | Right column: Progress ring, Exchange Forecast, Agent card, Price & Fees. Opens `EditSaleDetailsDrawer` |
| `EditSaleDetailsDrawer` | `components/transaction/EditSaleDetailsDrawer.tsx` | Portal right-hand drawer: edit property/price/fees/dates. Multi-step `PropSaveStage` state machine. Opens from sidebar "Edit details" |
| `NextMilestoneWidget` | `components/transaction/NextMilestoneWidget.tsx` | Overview tab widget: next milestone per side, quick Confirm/tab-link button |
| `RemindersWidget` | `components/transaction/RemindersWidget.tsx` | Overview tab widget: upcoming/overdue reminder summary with "View all →" |
| `RecentActivityWidget` | `components/transaction/RecentActivityWidget.tsx` | Overview tab widget: last 3 comms entries with "View all →" |
| `RiskScoreWidget` | `components/transaction/RiskScoreWidget.tsx` | Overview tab widget: risk score indicator, factor list. Display only |
| `FileHealthBanner` | `components/transaction/FileHealthBanner.tsx` | Overview tab: amber/red warning banner when reminders are overdue or file is behind. Returns null when no issues |
| `MosConfirmedNotice` | `components/transaction/MosConfirmedNotice.tsx` | Returns null. Fires toast on `?mosConfirmed=1`. No UI rendered |
| `RemindersReadyNotice` | `components/transaction/RemindersReadyNotice.tsx` | Returns null. Polls reminder count and fires toast on `?newFile=1`. No UI rendered |
| `ChainClaimedNotice` | `components/transaction/ChainClaimedNotice.tsx` | Returns null. Fires toast on `?claimed=1`. No UI rendered |
| `TransactionNotes` | `components/transaction/TransactionNotes.tsx` | Overview tab: note list + add-note textarea. Uses `useOptimistic` |
| `BrokerSection` | `components/transaction/BrokerSection.tsx` | Overview tab: broker referral fee + toggle. Returns null when `!brokerFirmId` |
| `ContactsSection` | `components/contacts/ContactsSection.tsx` | Overview tab: vendor/purchaser contacts; inline add/edit/delete; portal invite/link actions |
| `SolicitorSection` | `components/solicitors/SolicitorSection.tsx` | Overview tab: solicitor picker per side, referral fee, intel badge |
| `PropertyIntelCard` | `components/property/PropertyIntelCard.tsx` | Overview tab: Land Registry price history + EPC data. Three states: loading / error / data |
| `MilestonePanel` | `components/milestones/MilestonePanel.tsx` | Milestones tab: side tabs, section accordions, progress bar/card. Contains 5 bespoke keyframes |
| `MilestoneRow` | `components/milestones/MilestoneRow.tsx` | Single milestone row; Confirm / Undo / N/R actions. Uses `useOptimistic` |
| `NotRequiredRow` | `components/milestones/NotRequiredRow.tsx` | N/R section row; Reinstate action. Opens `MortgageModal` for PM9 |
| `SurveyNrConfirmModal` | `components/milestones/SurveyNrConfirmModal.tsx` | PM9 N/R confirmation; portal modal |
| `UndoMilestoneModal` | `components/milestones/UndoMilestoneModal.tsx` | Two-option undo picker (target only vs cascade); portal modal |
| `MortgageModal` | `components/milestones/MortgageModal.tsx` | PM9 reinstate: asks if buyer now has mortgage; portal modal |
| `ReconciliationDrawer` | `components/milestones/ReconciliationDrawer.tsx` | Exchange/completion reconciliation; portal drawer |
| `ExchangeCelebration` | `components/milestones/ExchangeCelebration.tsx` | Exchange confirmed overlay; confetti canvas + modal card. Bespoke `exchange-in` keyframe |
| `RemindersSection` | `components/reminders/RemindersSection.tsx` | Reminders tab: urgency groups (escalated/overdue/due_today/upcoming/snoozed/completed), per-row snooze, Chase CTA columns. Opens `ChaseDrawer` |
| `ChaseDrawer` | `components/chase/ChaseDrawer.tsx` | Portal right-hand drawer: channel selector, tone picker, AI generate, send. Opened by RemindersSection and ViewChainButton's ChainDrawer context |
| `ManualTaskList` | `components/todos/ManualTaskList.tsx` | To-Do tab: my tasks + agent requests sections. Optimistic add. Opens `AddManualTaskForm` and `ManualTaskCard` |
| `ActivityTimeline` | `components/activity/ActivityTimeline.tsx` | Activity tab: filterable/searchable timeline of milestones and comms. Delete comms. Show more/less |
| `CommsEntry` | `components/activity/CommsEntry.tsx` | Activity tab: 4-step wizard to log a communication or internal note |
| `EmailParseWidget` | `components/activity/EmailParseWidget.tsx` | Activity tab: "coming soon" smart email reader banner. Dismissible |
| `ComposeEmail` | `components/verified-emails/ComposeEmail.tsx` | Activity tab: compose and send email via verified sender. Three states: no-sender / compose / sent |
| `ViewChainButton` | `components/chain/ViewChainButton.tsx` | Overview tab: "View Chain" button; opens `ChainDrawer` (chain view) and `AddNodeDrawer` |
| `ChainDrawer` | `components/chain/ChainDrawer.tsx` | Portal right-hand drawer: loads chain via API; states: loading / no chain / empty / populated. Opens `AddNodeDrawer` |
| `AddNodeDrawer` | `components/chain/AddNodeDrawer.tsx` | Portal drawer for adding/editing chain link stubs |
| `TransactionViewTracker` | `components/agent/TransactionViewTracker.tsx` | Returns null. Fires PostHog analytics + `trackView` on mount. No UI rendered |

**Sub-components (children of above, not separately listed):**
- `ManualTaskCard`, `AddManualTaskForm` — children of `ManualTaskList`
- `SolicitorPicker` — child of `SolicitorSection`
- `SolicitorIntelBadge` — child of `SolicitorSection`
- `AgentRequestRow` — internal sub-component of `ManualTaskList`
- `ColumnSection`, `EmptyColumn`, `RowSnoozeMenu`, `SideSnoozeMenu` — internal to `RemindersSection`
- `CommPill` — internal to `ActivityTimeline`
- `TypeBadge`, `MethodBadge` — internal to `CommsEntry`
- `MilestoneSideRow` — internal to `NextMilestoneWidget`
- `UnsavedChangesModal`, `DeltaList` — internal to `EditSaleDetailsDrawer`
- `ProgressRing` — internal to `TransactionSidebar`
- `LinkCard`, `ChainConnector` — children of `ChainDrawer`
- `NotificationFeedback` — internal to `MilestoneRow`
- `PriceInput` — UI primitive (not specific to this page)

**Exclusions (valid — returns null, no UI):**
- `TransactionViewTracker` — pure analytics side-effect, `return null`
- `MosConfirmedNotice` — fires `toast.success` only, `return null`. Toast copy in section 7
- `RemindersReadyNotice` — polls + fires `toast.success`, `return null`. Toast copy in section 7
- `ChainClaimedNotice` — fires `toast.success` only, `return null`. Toast copy in section 7

---

## 3. Data dependencies

| Data | Source | Notes |
|---|---|---|
| `transaction` | `getTransaction(id, agencyId)` | Null → `notFound()`. Includes contacts, solicitor firms, chain, documents |
| `milestoneData` | `getMilestonesForTransaction(id, agencyId)` | Null (`.catch`) if error. Null → milestone panel hidden |
| `reminderLogs` | `getReminderLogsForTransaction(id, agencyId)` | Empty array on error. Used by RemindersSection and badge count |
| `activityEntries` | `getActivityTimeline(id, agencyId)` | Empty array on error. Used by ActivityTimeline |
| `lastUpdate` | `getLastUpdate(id)` | Null on error. Used in overview summary |
| `manualTasks` | `listManualTasksForTransaction(id, agencyId)` | Empty array on error. Used by ManualTaskList and badge count |
| `mosDoc` | `prisma.transactionDocument.findFirst({ where: { transactionId, source: "mos" } })` | Null if no MOS uploaded. Generates signed URL if present (86400s TTL) |
| `assignedUser` | `prisma.user.findUnique({ where: { id: transaction.assignedUserId } })` | Null if no progressor assigned. Provides `clientType` and `legacyFee` for fee calc |
| `agentUser` | `prisma.user.findUnique({ where: { id: transaction.agentUserId } })` | Null if agentUserId not set. Displayed in sidebar Agent card |
| `recommendedFirms` | `prisma.agencyRecommendedSolicitor.findMany(...)` | Directors only. Empty array for negotiators. Used in SolicitorSection referral checkbox |
| `brokerRow` | `prisma.brokerReferral.findFirst(...)` | Null if no broker referral. Passed to BrokerSection; null → BrokerSection returns null |
| `progress` | `calculateProgress(transaction, milestoneData)` | Computed server-side from milestone weights/dates |
| `session.user` | `requireSession()` | `{ id, agencyId, role, name }`. Redirect to login if missing |
| `exchangeConfirmed` | Derived: VM19 or PM26 `isComplete` in milestone data | Boolean. Affects completion date display and ExchangeCelebration trigger |
| `initialTab` | `searchParams.tab` | Drives initial active tab. Values: `"overview"` / `"milestones"` / `"reminders"` / `"todos"` / `"activity"` |
| Chain data (ChainDrawer) | `GET /api/chains?transactionId=` | Fetched client-side when ChainDrawer opens. Null → empty state |
| Solicitor intel (SolicitorIntelBadge) | `GET /api/solicitor-intel?firmId=` | Fetched client-side per firm. Returns null if no records |
| Property intel (PropertyIntelCard) | `GET /api/property-intel` | Fetched client-side. States: loading / error / data |
| Verified emails (ComposeEmail) | `GET /api/agent/verified-emails` | Fetched client-side on mount. Empty → no-sender state |

**Null / missing data handling:**
- `transaction` null → `notFound()` (404 page)
- Negotiator access control: if `transaction.agentUserId !== session.user.id` → `notFound()`
- `milestoneData` null → milestone panel not rendered; milestone badge shows 0
- `assignedUser` null → sidebar uses `serviceType` fallback for progressor fee label
- `mosDocUrl` null → MOS link not shown in ActivityTimeline milestone cards
- `recommendedFirms` empty → "Referred by us" checkbox not shown in SolicitorSection
- `brokerRow` null → BrokerSection returns null (not rendered)
- Chain fetch network error → ChainDrawer shows empty state

---

## 4. States

### Standard states

| State | Trigger | What the user sees |
|---|---|---|
| **Loading** | Next.js streaming / server fetch in progress | `loading.tsx`: topbar at 56px, hero shimmer at 96px, then 3 skeleton blocks (160/200/140px height). Uses `agent-skeleton` class |
| **Error** | Server error / Prisma failure | No `error.tsx` found — no custom error boundary. Falls through to Next.js default error page |
| **Populated** | All data present, `transaction.status === "active"` | Full 5-tab layout with hero, sidebar, tab content |
| **Not found** | Transaction missing or access denied | Next.js 404 page |

### Page-specific states

| State | Trigger | What the user sees |
|---|---|---|
| **MOS confirmed notice** | `?mosConfirmed=1` search param | `MosConfirmedNotice` fires toast: "MOS confirmed for both sides" |
| **New file notice** | `?newFile=1` search param | `RemindersReadyNotice` polls, then fires toast: "Chase reminders are active" |
| **Chain claimed notice** | `?claimed=1` search param | `ChainClaimedNotice` fires toast: "You've claimed your position in this chain." |
| **Exchange confirmed** | VM19 or PM26 complete | Completion date section shows in sidebar; completion milestone unlocked |
| **Exchange celebration** | VM19 or PM26 just confirmed (real-time) | `ExchangeCelebration` overlay: confetti canvas + modal card |
| **No milestones** | `milestoneData === null` | Milestone tab shows no panel; overview `NextMilestoneWidget` shows fallback |
| **Withdrawn** | `transaction.status === "withdrawn"` | Red status badge; edit affordances removed |
| **On hold** | `transaction.status === "on_hold"` | Amber status badge in hero |
| **Completed** | `transaction.status === "completed"` | Green status badge |
| **Director vs negotiator** | `session.user.role === "director"` | Director sees StatusControl dropdown, recommendedFirms; negotiator sees read-only badge |
| **No solicitors set** | `vendorSolicitorFirmId === null` | SolicitorSection shows "+ Add" CTA; no intel badge |
| **Escalated reminders** | Chase task `priority === "escalated"` | RemindersSection top group shows red "Escalated" header with count |
| **All reminders snoozed** | All active `chaseTasks` snoozed | Snoozed group shown in purple; active groups empty |
| **No broker referral** | `brokerRow === null` | BrokerSection returns null — not rendered |
| **File health warning** | `overdueCount > 0 \|\| isBehind` | FileHealthBanner renders amber (behind) or red (overdue) banner with "View reminders →" |
| **PropertyIntelCard loading** | Client-side fetch in progress | "Fetching property data…" with shimmer-style layout |
| **PropertyIntelCard error** | Fetch or parse failure | "Could not load property data." message |
| **PropertyIntelCard populated** | Fetch succeeds | Price Paid History + EPC section with Rightmove/Zoopla/Land Reg links |
| **EditSaleDetailsDrawer — idle** | Drawer open, no edits | All three sections (Property, Price & Fees, Timeline) show current values |
| **EditSaleDetailsDrawer — unsaved** | Any field edited | Sticky amber chips appear (section name + "· unsaved"); drawer close shows UnsavedChangesModal |
| **EditSaleDetailsDrawer — address consequence** | Address or tenure changed, save triggered | Nested modal: "Change address?" / delta preview before confirming |
| **EditSaleDetailsDrawer — tenure preview** | Tenure or purchaseType changed | DeltaList shows milestones becoming NR or re-activated |
| **CommsEntry — collapsed** | Default state | Dashed-border prompt: "+ Add a note or log a communication…" |
| **CommsEntry — step 1** | Prompt clicked | Type selection: Internal note / Outbound / Inbound |
| **CommsEntry — step 2** | Outbound or Inbound selected | Method selection: Email / Phone / SMS / Voicemail / WhatsApp / Post |
| **CommsEntry — step 3** | Method selected | Contact picker with Skip/Continue |
| **CommsEntry — step 4** | Contacts confirmed (or Internal note selected) | Textarea + Save/Cancel + Share with client toggle |
| **EmailParseWidget — visible** | Default (not dismissed) | Dimmed "coming soon" card with dismiss × |
| **EmailParseWidget — dismissed** | × clicked | Returns null (not rendered) |
| **ComposeEmail — no sender** | `verifiedEmails.length === 0` | Amber warning: "No verified sending address" with settings link + dismiss |
| **ComposeEmail — compose** | Verified emails exist and not yet sent | Compose form: From / To / Subject / Message |
| **ComposeEmail — sent** | Send succeeded | Green "✓ Email sent" confirmation |
| **ChainDrawer — loading** | Fetch in progress after open | Skeleton: 3 animated placeholder cards |
| **ChainDrawer — no chain** | `chain === null` | Empty state: "No chain linked to this sale" + "Create chain" button |
| **ChainDrawer — chain empty** | `chain && links.length === 0` | Empty state: "Chain created — add the first link" + Add above/below buttons |
| **ChainDrawer — populated** | `links.length > 0` | LinkCard stack with connectors; add above/below dashed buttons where permitted |
| **ChainDrawer — delete confirm** | Delete stub clicked on LinkCard | Inline confirmation row replaces LinkCard: "Delete this node?" + Confirm/Cancel |
| **NextMilestoneWidget — allComplete** | Both sides complete | Returns null (not rendered) |
| **NextMilestoneWidget — gatePending** | Exchange or post-exchange gate pending | Amber dot + "Awaiting exchange-readiness" or "Awaiting exchange confirmation" |
| **NextMilestoneWidget — completionPending** | Completion date set | Blue dot + "Completion due [date]" |
| **NextMilestoneWidget — hasNext (eventDateRequired)** | Next milestone needs a date | Shows milestone name + "Complete →" tab link |
| **NextMilestoneWidget — hasNext (no date needed)** | Standard next milestone | Shows milestone name + "Complete" button |

---

## 5. Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| Back link | PropertyHero (top left) | Navigates to `/agent/dashboard` | Never | — |
| Status badge/dropdown trigger | PropertyHero + StatusControl | Opens status dropdown | `role !== "director"` | Only badge rendered; no interactive element for negotiators |
| Status options (Active / On hold / Completed / Withdrawn) | StatusControl dropdown | Calls status update server action | Cannot mark Complete if exchange not confirmed | Shown with muted styling; cannot be selected |
| "Confirm withdrawal" button | StatusControl withdrawal modal | Submits withdrawal reason | `isPending` | Opacity 0.5, cursor not-allowed |
| Tab buttons (×5) | PropertyFileTabs | Switches active tab | Never | — |
| Mobile sidebar toggle | PropertyFileTabs (mobile only) | Opens/closes sidebar on mobile | Never | — |
| "Edit details" button | TransactionSidebar | Opens `EditSaleDetailsDrawer` | Never | — |
| Section save buttons (Property / Price & Fees / Timeline) | EditSaleDetailsDrawer | Saves changed section | Saving in progress | `disabled` attr; shows "Saving…" |
| Dirty chip buttons ("[section] · unsaved") | EditSaleDetailsDrawer (sticky top) | Scrolls to unsaved section | Never | — |
| "Save all" | EditSaleDetailsDrawer UnsavedChangesModal | Saves all pending sections | Never | — |
| "Discard changes" | UnsavedChangesModal | Discards all edits, closes drawer | Never | — |
| "Keep editing" | UnsavedChangesModal | Dismisses modal, stays in drawer | Never | — |
| Address consequence modal "Confirm changes" | EditSaleDetailsDrawer | Proceeds with address save | Saving in progress | Shows "Saving…" |
| "Back" button | Address consequence modal | Returns to editing | Never | — |
| Tenure/purchase type pills | EditSaleDetailsDrawer | Selects tenure or purchase type | PropSaveStage not idle | Not rendered during save flow |
| "Preview & save" / "Confirm changes" | EditSaleDetailsDrawer tenure/purchase type | Previews delta, then saves | `PropSaveStage === "tenure_checking"` | Shows "Checking…" |
| "Set override" / "Clear override" | EditSaleDetailsDrawer (exchange date) | Sets or clears manual date override | Never | — |
| Close (×) | EditSaleDetailsDrawer | Closes drawer (shows UnsavedChangesModal if dirty) | Never | — |
| Fee toggle (fixed / percentage) | EditSaleDetailsDrawer | Switches fee type | Never | — |
| VAT mode toggle (+ VAT / Inc VAT) | EditSaleDetailsDrawer | Switches VAT inclusivity | Never | — |
| "— no referral —" / firm referral dropdown | EditSaleDetailsDrawer | Sets or clears referral | Never | — |
| Confirm button (milestone row) | MilestonePanel > MilestoneRow | Calls `confirmMilestoneAction`. May show event date input first, or reconciliation drawer | `loading \|\| isPending` | `disabled` prop: opacity 0.4 |
| "N/R" button | MilestoneRow (PM9 only) | Opens SurveyNrConfirmModal (PM9), or shows inline reason input (others) | `loading \|\| isPending` | `disabled` prop: opacity 0.4 |
| "Undo" button | MilestoneRow (completed only) | Fetches undo impact, opens UndoMilestoneModal | `loading \|\| isPending` | Shows "…" loading text |
| Event date input + Confirm | MilestoneRow inline | Sets event date, then calls `doComplete()` | Date empty (unless desktop valuation) | Confirm button: opacity 0.4 |
| "Desktop valuation" checkbox | MilestoneRow (PM6 only) | Allows confirm without date | Never | — |
| Cancel (event date) | MilestoneRow inline | Hides event date form | Never | — |
| "Yes, mark as not required" | SurveyNrConfirmModal | Calls `markNotRequiredAction` for PM9 | Never | — |
| Undo mode radio buttons | UndoMilestoneModal | Selects target_only vs cascade mode | `isPending` | Not interactive during transition |
| "Undo milestone" / "Undo milestone and N dependents" | UndoMilestoneModal | Calls `executeUndoMilestoneAction` | `isPending` | Opacity 0.5, cursor not-allowed |
| "Show N more" / "Show fewer" | UndoMilestoneModal (cascade list) | Expands/collapses cascade list | Never | — |
| "Yes — mortgage buyer" | MortgageModal | Calls `reverseMilestoneAction` with `newPurchaseType: "mortgage"` | Never | — |
| "Reinstate without changing" | MortgageModal | Calls `reverseMilestoneAction` without type change | Never | — |
| "Reinstate" | NotRequiredRow | Opens MortgageModal (PM9) or calls `reverseMilestoneAction` directly | `loading` | Shows "…" |
| Exchange date input | ReconciliationDrawer | Sets exchange/completion date | Never | — |
| Outstanding milestone checkboxes | ReconciliationDrawer | Includes/excludes from reconciliation | Never | — |
| "Confirm exchange" / "Confirm completion" | ReconciliationDrawer | Calls `confirmExchangeReconciliationAction` | Never | — |
| "Show fewer" / "Show [N] more" | ReconciliationDrawer (outstanding milestones) | Expands/collapses list | Never | — |
| "Continue" | ExchangeCelebration | Dismisses celebration overlay | Never | — |
| Section accordion buttons | MilestonePanel | Toggles section collapsed/expanded | Never | — |
| Vendor/Purchaser side tabs | MilestonePanel | Switches between vendor and purchaser milestones | Never | — |
| "Not required" group toggle | MilestonePanel | Expands/collapses N/R milestone list | Never | — |
| Urgency group Show/Hide toggles | RemindersSection | Collapses/expands escalated/overdue/due_today/upcoming/snoozed/completed groups | Never | — |
| RowSnoozeMenu trigger (🕐) | RemindersSection per row | Opens per-row snooze dropdown | Never | — |
| Snooze options (24 h / 48 h / 72 h / 7 days) | RowSnoozeMenu / SideSnoozeMenu | Calls `snoozeTaskAction` | Never | — |
| "🕐 Snooze all" | RemindersSection column footer | Opens per-column snooze dropdown | `loading !== null` | `disabled` attr |
| "✓ Done" button | RemindersSection per row | Calls `completeTaskAction` | `loading === task.id` | `disabled` attr |
| "Chase" / "Chase all ([N])" CTA | RemindersSection column footer | Opens `ChaseDrawer` | Never | — |
| "Wake up" button | RemindersSection snoozed row | Calls `wakeupReminderAction` | `loading === log.id` | `disabled` attr |
| "↻ Run engine" | RemindersSection header | Calls `runReminderEngineAction` | `loading === "engine"` | Shows "Running…" |
| Channel tabs (Email / WhatsApp) | ChaseDrawer | Switches send channel; 120ms crossfade | Never | — |
| CC solicitor toggle | ChaseDrawer (email only) | Toggles solicitor CC | Not applicable | Not rendered for WhatsApp |
| WA contact picker | ChaseDrawer (WA, multiple contacts) | Selects WhatsApp recipient | Never | — |
| Tone dropdown trigger | ChaseDrawer | Opens tone picker | Never | — |
| Tone options | ChaseDrawer dropdown | Sets tone for generation | Never | — |
| "Generate message" | ChaseDrawer | Calls `/api/ai/generate-chase` | `isGenerating` | Opacity 0.40, cursor not-allowed |
| Message textarea | ChaseDrawer | Edits message content | Never | — |
| "Send chase" / "Send via WhatsApp" | ChaseDrawer | Posts to `/api/comms`, sends email or opens WA | `!message.trim() \|\| isSending \|\| needsWaPick` | Opacity 0.35, cursor not-allowed |
| Close (×) | ChaseDrawer / AddNodeDrawer / ReconciliationDrawer / EditSaleDetailsDrawer / ChainDrawer / modals | Dismisses overlay | Never | — |
| + Add a note or log… (collapsed CommsEntry) | Activity tab | Expands CommsEntry step wizard | Never | — |
| Type buttons (Internal note / Outbound / Inbound) | CommsEntry step 1 | Advances to step 2 (or step 4 for Internal note) | Never | — |
| Method buttons (Email / Phone / SMS / Voicemail / WhatsApp / Post) | CommsEntry step 2 | Advances to step 3 | Never | — |
| Contact toggle buttons | CommsEntry step 3 | Selects/deselects contacts | Never | — |
| "Skip" / "Continue" | CommsEntry step 3 | Advances to step 4 | Never | — |
| "Start over" | CommsEntry (expanded, any step) | Resets wizard to step 1, collapses | Never | — |
| "Saving…" / "Save" | CommsEntry step 4 | Calls `logCommAction` | `!content.trim() \|\| loading \|\| isPending` | `disabled` attr, opacity 0.5 |
| "Cancel" | CommsEntry step 4 | Calls reset() | Never | — |
| Share with client toggle | CommsEntry step 4 (non-note only) | Toggles `visibleToClient` | Not applicable | Not rendered for Internal note |
| × dismiss | EmailParseWidget | Sets `dismissed = true`, returns null | Never | — |
| From select | ComposeEmail (multiple senders) | Selects sending address | Never | — |
| To input | ComposeEmail | Sets recipient | Never | — |
| Subject input | ComposeEmail | Sets subject | Never | — |
| Message textarea | ComposeEmail | Sets body | Never | — |
| "Send" | ComposeEmail | Calls `POST /api/agent/send-email` | `sending \|\| !to \|\| !subject \|\| !body` | `disabled` attr, opacity 0.4 |
| "Cancel" | ComposeEmail | Calls `onCancel?.()` | Never | — |
| × dismiss (no-sender banner) | ComposeEmail | Sets `noEmailDismissed = true` | Never | — |
| "View Chain" | ViewChainButton | Opens `ChainDrawer` | Never | — |
| "+ Create chain" | ChainDrawer (no chain state) | `POST /api/chains` | Never | — |
| "+ Add sale above" / "+ Add sale below" | ChainDrawer (empty chain + populated) | Opens `AddNodeDrawer` | Only shown when `canAddAbove`/`canAddBelow` permissions hold | Not rendered when not permitted |
| Confirm delete node | ChainDrawer (inline confirmation) | `DELETE /api/chains/{id}/links/{linkId}` | Never | — |
| Cancel delete node | ChainDrawer (inline confirmation) | Clears `confirmingDeleteId` | Never | — |
| Resend invite (LinkCard) | ChainDrawer | `POST /api/chains/{id}/links/{linkId}/invite` | `sendingInvites !== null` | Not rendered (controlled by LinkCard) |
| "Send invites" | ChainDrawer footer | Sends all pending invites | `sendingInvites !== null` | Shows "Sending…", `disabled` attr |
| "+ Add contact" | ContactsSection header | Shows add contact form | Never | — |
| "Send invite" | ContactsSection (vendor/purchaser with email) | `POST /api/portal/invite` | `inviting === contact.id` | Shows "Sending…", opacity 0.5 |
| "Portal link" | ContactsSection (vendor/purchaser with token) | Copies portal URL to clipboard | Never | — |
| "Set up portal" | ContactsSection (vendor/purchaser without token) | Calls `generatePortalTokenAction` | `generatingToken === contact.id` | Shows "Setting up…", opacity 0.4 |
| "Edit" | ContactsSection per contact | Opens inline edit form | Never | — |
| "Remove" | ContactsSection per contact | Calls `deleteContactAction` | `deleting === contact.id` | Shows "…", opacity 0.4 |
| Edit form "Save" | ContactsSection | Calls `updateContactAction` | `editSaving \|\| !editForm.name.trim()` | `disabled` attr; shows "Saving…" |
| Edit form "Cancel" | ContactsSection | Closes inline edit form | Never | — |
| Add form "Add contact" | ContactsSection | Calls `createContactAction` | `loading \|\| isPending` | `disabled` attr; shows "Adding…" |
| Add form "Cancel" | ContactsSection | Hides add form | Never | — |
| "Edit" / "+ Add" per solicitor card | SolicitorSection | Opens inline SolicitorPicker | Never | — |
| Solicitor card "Save" | SolicitorSection | Calls `saveSolicitorsAction` | Never | — |
| Solicitor card "Cancel" | SolicitorSection | Reverts to display state | Never | — |
| Referral fee input | SolicitorSection (recommended firm selected) | Sets referral fee pence | Not applicable | Not rendered if firm not recommended |
| Broker referral fee input | BrokerSection | `PriceInput` for referral fee; saves on change | Never | — |
| "Fee received" toggle | BrokerSection | Toggles `feeReceived` boolean | Never | — |
| BrokerSection "Save" | BrokerSection | Saves fee + received state | `saving` | Shows "Saving…" |
| "Add note" | TransactionNotes | Calls `addNoteAction`. Uses `useOptimistic` | `isPending \|\| !draft.trim()` | `disabled` attr, opacity 0.4 |
| Delete note | TransactionNotes | Calls `deleteCommAction` | `deleting === note.id \|\| isPending` | Hidden on non-hover; shows "…" while deleting |
| "Show [N] more note[s]" | TransactionNotes | Expands note list beyond first 5 | Never | — |
| "Complete" button | NextMilestoneWidget (hasNext, no date) | Calls `confirmMilestoneAction` | `loading` | `disabled` attr, opacity 0.4 |
| "Complete →" link | NextMilestoneWidget (eventDateRequired) | Calls `setActiveTab("milestones")` | Never | — |
| "View all →" | RemindersWidget | Navigates to Reminders tab | Never | — |
| "View all →" | RecentActivityWidget | Navigates to Activity tab | Never | — |
| "View reminders →" | FileHealthBanner | Navigates to Reminders tab | Never | — |
| Filter buttons (All / Milestones / Comms / Automated / Notes) | ActivityTimeline | Filters entries by kind | Never | — |
| "Portal visits" toggle | ActivityTimeline (when portal visits exist) | Shows/hides portal visit entries | Never | — |
| Search input | ActivityTimeline | Filters by content or contact name | Never | — |
| "Delete" | ActivityTimeline (comm entry, group-hover) | Calls `deleteCommAction` | `deletingId === entry.id \|\| isPending` | Shows "…" while deleting |
| "Show less" / "Show [N] earlier updates…" | ActivityTimeline | Toggles full/truncated entry list | Never | — |
| Add/edit stub | AddNodeDrawer | Saves stub (in-memory or via API) | `!requiredFilled \|\| saving` | Opacity 0.4 |
| Show N done / Hide done | ManualTaskList | Toggles filter between open/all | Never | — |
| Show N resolved / Hide resolved | ManualTaskList | Shows/hides completed agent requests | Never | — |
| ManualTaskCard toggle | ManualTaskList | Marks task open/done | Never | — |
| ManualTaskCard delete | ManualTaskList | Deletes task | Never | — |

---

## 6. Conditional renders

```
{session.user.role === "director" && <StatusControl />}
// Shows: status dropdown (with modal on withdrawal)
// Hides: negotiators see read-only badge only

{milestoneData && <MilestonePanel />}
// Shows: when tenure + purchaseType set and milestones initialised
// Hides: when milestoneData === null (fetch error, or milestones not yet init)

{searchParams.mosConfirmed === "1" && <MosConfirmedNotice />}
// Fires toast only — no UI. Returns null.

{searchParams.newFile === "1" && <RemindersReadyNotice />}
// Polls + fires toast — no UI. Returns null.

{chainClaimedAtRecentLoad && <ChainClaimedNotice />}
// Fires toast only — no UI. Returns null.

{overdueCount > 0 || isBehind
  ? <FileHealthBanner overdueCount={overdueCount} isBehind={isBehind} />
  : null}
// Shows: amber banner (isBehind only) or red banner (overdueCount > 0)
// Hides: all reminders on time and file on track

{!brokerFirmId && return null}  // inside BrokerSection
// Shows: full BrokerSection when broker referral exists
// Hides: returns null when no broker referral on transaction

{exchangeConfirmed && completionDateSection}
// Shows: when VM19 or PM26 complete — enables completion date display
// Hides: before exchange confirmed

{agentUser && <AgentCard />}  // in TransactionSidebar
// Shows: when agentUserId is set on the transaction

{showOurFee && <ProgressorFeeRow />}  // in TransactionSidebar
// Shows: when assignedUser present (outsourced) or serviceType="self_managed"

{hasTotal && <NetIncomeRow />}  // in TransactionSidebar
// Shows: when agentFeeCalcPence is not null

{isDirectorRole && recommendedFirms?.length > 0 && <ReferralSection />}
// Shows: directors only, when recommended firms configured for agency

{vendorSide.state === "allComplete" && purchaserSide.state === "allComplete" && return null}
// NextMilestoneWidget: returns null when all milestones complete on both sides

{intel && intel.totalFiles > 0 && <SolicitorIntelBadge />}
// Shows: when solicitor has files on record in agency
// Hides: new solicitor or no records

{intel.warning && <WarningBox />}  // inside SolicitorIntelBadge
// Shows: amber warning box when solicitor has known issues

{info.firm ? <FirmDisplay /> : <p>None added</p>}  // SolicitorCard
// Shows: firm/contact display when solicitor set
// Shows: "None added" italic text when no solicitor

{referredFirmId && referralFee != null && <ReferralFeeRow />}  // SolicitorSection
// Shows: referral fee summary row when firm + fee both set

{contact.portalToken
  ? <>{contact.email && <SendInviteButton />}<PortalLinkButton /></>
  : <SetUpPortalButton />}  // ContactsSection
// Shows: Send invite + Portal link when token exists and email present
// Shows: Set up portal when no token yet

{contacts.length === 0 && !showForm && <EmptyState />}  // ContactsSection
// Shows: "No contacts yet" empty state when no contacts and form hidden

{!isDone && !showEventDate && !showNotRequired && !showCounterpartNotice && effectivelyAvailable && <ConfirmButton />}
// MilestoneRow: Confirm button shown only when available and no inline form open

{isDone && <UndoButton />}
// MilestoneRow: Undo shown only for completed milestones

{canBeNR && effectivelyAvailable && <NRButton />}
// MilestoneRow: N/R only for PM9 currently

{showEventDate && <EventDateInput />}
// MilestoneRow: shows when eventDateRequired and user clicked Confirm

{showCounterpartNotice && counterpartNotice && <CounterpartNoticeBox />}
// MilestoneRow: shows when exchange milestone clicked but counterpart not ready

{celebrating && <ExchangeCelebration />}
// MilestoneRow: fires when VM19/PM26 confirmed and server returns triggeredCelebration=true

{showReconciliationModal && <ReconciliationDrawer />}
// MilestoneRow: fires for RECONCILIATION_CODES (VM19, PM26, VM20, PM27)

{showUndoModal && undoData && <UndoMilestoneModal />}
// MilestoneRow: fires after getUndoImpactAction resolves

{isPM9 && showSurveyNrConfirm && <SurveyNrConfirmModal />}
// MilestoneRow: PM9 N/R uses modal instead of inline form

{isPM9 && showMortgageModal && <MortgageModal />}
// NotRequiredRow: PM9 reinstate uses mortgage modal

{nrMilestones.length > 0 && !nrCollapsed && <NotRequiredSection />}
// MilestonePanel: NR section only shown if there are NR milestones

{exchangeReady && <ExchangeReadyBanner />}
// MilestonePanel: swap between exchange-ready banner and progress card

{gateReady && <GateReadyNotice />}
// MilestonePanel: shows below milestones when current side is gate-ready

{displayShowCcToggle && <CcSolicitorToggle />}  // ChaseDrawer
// Shows: email channel + solicitor has email on file

{displayChannel === "whatsapp" && whatsappCandidates.length > 1 && <WaContactPicker />}
// ChaseDrawer: WA picker only when multiple WA-capable contacts

{generatedContext?.primaryContact && <DraftedForNote />}
// ChaseDrawer: shows who message was drafted for after AI generation

{generatedText && message !== generatedText && message.length > 0 && <EditedNote />}
// ChaseDrawer: "✏️ Message edited from generated version"

{!loading && !chain && <EmptyState title="No chain linked" />}
// ChainDrawer: no-chain state

{!loading && chain && links.length === 0 && <EmptyState title="Chain created — add the first link" />}
// ChainDrawer: chain exists but no links yet

{!loading && chain && links.length > 0 && <PopulatedChain />}
// ChainDrawer: shows LinkCard stack

{showAddAbove && <AddAboveButton />}
{showAddBelow && <AddBelowButton />}
// ChainDrawer: add direction buttons shown based on canAddAbove/canAddBelow permissions

{confirmingDeleteId === link.id ? <DeleteConfirmRow /> : <LinkCard />}
// ChainDrawer: inline delete confirmation replaces LinkCard

{invitablePending.length > 0 && <BulkInviteFooter />}
// ChainDrawer: sticky footer with Send invites when pending uninvited stubs exist

{!dismissed && <EmailParseWidget />}
// EmailParseWidget internal: returns null after dismiss

{verifiedEmails.length === 0 && !noEmailDismissed && <NoSenderBanner />}
// ComposeEmail: no-verified-sender state

{sent && <SentConfirmation />}
// ComposeEmail: ✓ Email sent state

{agentTasks.length > 0 && <AgentRequestsSection />}
// ManualTaskList: "With Sales Progressor" section only when agent requests exist

{portalViewCount > 0 && <PortalVisitsToggle />}
// ActivityTimeline: toggle button only when portal visits are present in entries
```

---

## 7. Copy inventory

**Verbatim rule:** Every string exactly as it renders. State variants, loading variants, error variants — each on its own line. Toast messages are listed under the component that fires them.

```
# PropertyHero (warm)
"← Back"                                          [back link]
[property address]                                [dynamic — transaction.propertyAddress]
"Active"                                          [status badge]
"On hold"                                         [status badge variant]
"Withdrawn"                                       [status badge variant]
"Completed"                                       [status badge variant]
"Outsourced to us"                                [badge when serviceType=outsourced]

# FileHealthBanner
"[N] reminder[s] overdue"                         [red banner — singular/plural]
"File may be behind schedule"                     [amber banner — isBehind only]
"View reminders →"                                ← FLAG voice pass

# NextMilestoneWidget
"Next steps"                                      [card header]
"Vendor"                                          [side label]
"Purchaser"                                       [side label]
"All milestones complete"                         [allComplete row]
"Awaiting exchange-readiness"                     [gatePending — exchange_gate]
"Awaiting exchange confirmation"                  [gatePending — post_exchange]
"Completion due [date]"                           [completionPending row]
"Complete →"                                      [hasNext — eventDateRequired — tab link]  ← FLAG voice pass
"Complete"                                        [hasNext — quick confirm button]
"…"                                               [loading state — confirm in flight]
"[milestone name]"                                [toast — confirm success]  ← FLAG voice pass
"Couldn't complete milestone"                     [toast title — error]
"[message]"                                       [toast description — error]

# RemindersWidget
"Reminders"                                       [section heading]
"[N]"                                             [active count pill]
"View all →"                                      [link to Reminders tab]  ← FLAG voice pass
"[N] day[s] overdue"                              [urgency label]
"Due today"                                       [urgency label]
"Active from [date]"                              [upcoming label]
"[N] chase[s]"                                    [chase count pill on reminder row]
"No reminders due"                                [empty state]

# RecentActivityWidget
"Recent activity"                                 [section heading]
"View all →"                                      [link to Activity tab]  ← FLAG voice pass
"Note"                                            [comm type label — internal_note]
"Outbound"                                        [comm type label]
"Inbound"                                         [comm type label]
"N/A — [milestoneName]"                           [milestone entry — not required]
"[relative date]"                                 [entry timestamp]
"No activity yet"                                 [empty state]

# RiskScoreWidget
"Fall-through risk"                               [card heading]
"Based on live file data, not a guess"            [card subheading]
"[level label]"                                   [risk level — Low / Medium-Low / Medium / High / etc.]
"Risk score"                                      [label]
"[N] / 100"                                       [score display]
"Low"                                             [score bar left label]
"High"                                            [score bar right label]
"Active risk factors"                             [section heading — when factors present]
"Not flagged"                                     [empty factors state]
"[factor label]"                                  [dynamic — per risk factor]
"[factor detail]"                                 [dynamic — factor description]
"Risk factors will appear as the file progresses."  [empty factors message]

# TransactionSidebar
"Progress"                                        [section label]
"On track"                                        [status badge]
"At risk"                                         [status badge]
"Off track"                                       [status badge]
"No data yet"                                     [status badge]  ← FLAG voice pass
"[N] week[s] elapsed"                             [progress subtext]
"Exchange Forecast"                               [section label]
"12-week target"                                  [date label]
"Predicted exchange"                              [date label]
"(overridden)"                                    [suffix on manual override]
"Completion date"                                 [date label]
"Not set"                                         [empty completion date — after exchange]
"Set once exchange is confirmed"                  [completion date — before exchange]  ← FLAG voice pass
"Weeks to exchange"                               [date label]
"~[N] weeks"                                      [weeks to exchange]
"[N] weeks overdue"                               [overdue variant]
"Key Dates"                                       [subsection label]
"(past)"                                          [suffix on past key dates]
"Agent"                                           [section label]
"Price & Fees"                                    [section label]
"Edit details"                                    [edit button]
"Purchase price"                                  [field label]
"[tenure]"                                        [badge — freehold / leasehold]
"[purchaseType]"                                  [badge — mortgage / cash buyer / cash from proceeds]
"Agent fee"                                       [field label]
"inc VAT"                                         [VAT mode badge]
"+ VAT"                                           [VAT mode badge]
"[N]%"                                            [percent fee]
"= [£amount]"                                     [calculated fee append — percent mode]
"Not set"                                         [empty fee]
"Solicitor referral"                              [field label]
"No fee set"                                      [empty referral fee]
"Broker referral"                                 [field label]
"No fee set"                                      [empty broker fee]
"Progressor fee"                                  [field label]
"Self-progressed (inc VAT)"                       [progressor fee label — self-managed]
"No progressor assigned"                          [progressor fee label — outsourced, no assignee]
"Net income"                                      [total row label]
"Agent fee excludes VAT"                          [VAT note on total — when not inclusive]

# EditSaleDetailsDrawer
"Edit sale details"                               [drawer title]
"Changes save per section"                        [drawer subtitle]
"[N] unsaved section[s]"                          [dirty chip — sticky top]
"[section] · unsaved"                             [dirty chip label per section]
"Property"                                        [section label]
"Address"                                         [field label]
"Tenure"                                          [field label]
"Purchase type"                                   [field label]
"Tap Back to change"                              [instruction during tenure preview step]
"Milestones that will be marked not required"     [DeltaList heading]
"Milestones that will be re-activated"            [DeltaList heading]
"was complete"                                    [badge on previously-completed delta item]
"Seller"                                          [side badge in DeltaList]
"Buyer"                                           [side badge in DeltaList]
"Current"                                         [progress comparison label]
"After"                                           [progress comparison label]
"Show fewer"                                      [DeltaList expand toggle]
"Show [N] more"                                   [DeltaList expand toggle]
"Price & Fees"                                    [section label]
"Purchase price"                                  [field label]
"Agent fee"                                       [field label]
"Fixed £"                                         [fee type toggle]
"Percentage %"                                    [fee type toggle]
"+ VAT"                                           [VAT mode option]
"Inc VAT"                                         [VAT mode option]
"Referral fee"                                    [field label]
"— no referral —"                                 [referral dropdown empty option]
"Broker referral"                                 [field label — if applicable]
"Progressor fee"                                  [field label — if applicable]
"Timeline"                                        [section label]
"Predicted exchange date"                         [field label]
"Algorithm predicts: [date]"                      [algorithm date display]
"Set override"                                    [date override CTA]  ← FLAG voice pass
"Clear override"                                  [remove override CTA]  ← FLAG voice pass
"(algorithm: [date])"                             [algorithm date shown alongside override]
"Completion date"                                 [field label]
"Set once exchange is confirmed"                  [placeholder — before exchange]
"Checking…"                                       [PropSaveStage tenure_checking]  ← FLAG voice pass
"Preview & save"                                  [tenure/address section save button]
"Saving…"                                         [section save in progress]  ← FLAG voice pass
"Save"                                            [section save button — idle]
"Confirm changes"                                 [address consequence modal — confirm]
"Back"                                            [address consequence modal — go back]
"Change address?"                                 [address consequence modal — heading]
"Unsaved changes"                                 [UnsavedChangesModal — heading]
"Save all"                                        [UnsavedChangesModal — primary]
"Discard changes"                                 [UnsavedChangesModal — secondary]  ← FLAG voice pass
"Keep editing"                                    [UnsavedChangesModal — tertiary]
"Cancel"                                          [section cancel — secondary action]
"Close"                                           [× button aria-label / tooltip]

# MilestonePanel
"Exchange progress"                               [progress card section label]
"[N%]"                                            [progress percentage — dynamic]
"[N] of [N] milestones complete"                  [progress card subtext]
"Ready to exchange"                               [exchange-ready banner headline]
"All blocking milestones are complete on both sides"  [banner subtext]
"Vendor"                                          [side tab label]
"Purchaser"                                       [side tab label]
"[N]/[N]"                                         [progress count pill in side tab]
"Onboarding"                                      [section label]
"Finances"                                        [section label]
"Surveys"                                         [section label]
"Conveyancing"                                    [section label]
"Exchange & Completion"                           [section label]
"All done"                                        [section progress pill — when all complete]
"[N]/[N]"                                         [section progress pill — partial]
"No milestones found"                             [empty state]
"Not required"                                    [NR section label]
"[N]"                                             [NR count pill]
"✓ Vendor side ready — exchange gate milestone is now available"    ← FLAG voice pass
"✓ Purchaser side ready — exchange gate milestone is now available" ← FLAG voice pass
"All milestones in this section are not required" [section empty — all NR]

# MilestoneRow
[milestone name]                                  [dynamic]
"Exchange gate"                                   [badge on VM18/PM25]
"Completed [date]"                                [completion meta]
"· Event: [date]"                                 [event date appended to completion meta]
"Client confirmed"                                [portal-confirmed badge]
"Previous milestones must be completed first"     [locked state subtext]
[error message]                                   [dynamic server error]
"Confirm"                                         [available milestone action button]
"Confirming…"                                     [loading state — with spinner]  ← FLAG voice pass
"N/R"                                             [NR button label]
"Undo"                                            [completed milestone action]
"…"                                               [undo loading state]  ← FLAG voice pass
[event date label]                                [dynamic via getEventDateLabel(code)]
"Desktop valuation — no date"                     [PM6 checkbox label]
"Confirm"                                         [event date submit]
"Cancel"                                          [event date cancel]
"Reason"                                          [N/R reason label]
"Confirm"                                         [N/R reason submit]
"Cancel"                                          [N/R reason cancel]
"OK"                                              [counterpart notice dismiss]  ← FLAG voice pass

# NotificationFeedback (in MilestoneRow)
"Notifications"                                   [section header]
"Dismiss"                                         [dismiss button]
"[Role] — [contact name]"                         [sent notification pill]
"[Role] — [contact name] · no email on file"      [skipped notification pill]

# CounterpartNotice (in MilestoneRow)
"Both sides must be ready to exchange before exchange can be confirmed. The purchaser side is still at "[milestone name]"."
"Both sides must be ready to exchange before exchange can be confirmed. The vendor side is still at "[milestone name]"."
"Exchange must be confirmed on both sides before completion can be recorded."

# NotRequiredRow
[milestone name]                                  [dynamic]
[notRequiredReason]                               [italic — if set]
[date set]                                        [completion date — if set]
"Reinstate"                                       [action button]
"…"                                               [loading state]

# SurveyNrConfirmModal
"No private survey required?"                     [modal title]
"Please confirm the buyer does not require a private Level 2 or Level 3 survey. The survey report milestone will also be marked as not required."
"Yes, mark as not required"                       [primary action]
"Cancel"                                          [tertiary action]

# UndoMilestoneModal
"Undo milestone"                                  [modal title]
"[milestone name] — what would you like to do?"  [subtitle — with cascade options]
"Are you sure you want to undo "[milestone name]"?"  [subtitle — no cascade]
"Reverse this milestone. Use this if you ticked the wrong one or it hasn't happened yet."  [no-cascade body]
"Current"                                         [progress comparison label]
"After"                                           [progress comparison label]
"Undo this milestone only"                        [option 1 heading]
"Reverse this milestone but keep downstream work as-is. Use this if you ticked the wrong one or it hasn't happened yet."
"Progress: [N]% → [N]%"                           [progress delta for each option]
"Note: [N] downstream milestone[s are] complete. [They/It] will stay complete and may need re-checking later if this milestone is permanently undone."
"Undo this and downstream milestones"             [option 2 heading]
"Reverse this milestone and all completed dependents. Use this if the chain of work genuinely didn't happen."
"reconciled"                                      [badge on reconciled cascade items]
"Note: [N] milestone[s] marked complete during exchange reconciliation will also be reversed."
"Show fewer"                                      [cascade expand toggle]
"Show [N] more"                                   [cascade expand toggle]
"Undo milestone"                                  [primary action — no cascade]
"Undo milestone and [N] dependent[s]"             [primary action — cascade]  ← FLAG voice pass
"Undoing…"                                        [pending state]  ← FLAG voice pass
"Cancel"                                          [secondary action]

# MortgageModal
"Is this buyer now using a mortgage?"             [modal title]
"Reinstating this will re-open the mortgage milestones. We'll update the purchase method to match."
"Yes — mortgage buyer"                            [primary action]  ← FLAG voice pass
"Reinstate without changing purchase method"      [secondary action]  ← FLAG voice pass
"Cancel"                                          [tertiary action]

# ReconciliationDrawer
"Confirm exchange"                                [drawer title — exchange flow]
"Confirm completion"                              [drawer title — completion flow]
"Date contracts exchanged"                        [date input label — exchange]
"Date sale completed"                             [date input label — completion]
"Pre-filled with today — change if it was different"  [date helper text]
"Expected completion date"                        [completion date input label]
"(optional)"                                      [appended to completion date label]
"Outstanding milestones"                          [section label]
"These haven't been confirmed yet. Tick those that are done — they'll be marked as reconciled at exchange. Untick or leave a date blank to exclude."
"Vendor"                                          [milestone side label]
"Purchaser"                                       [milestone side label]
"(blank = exclude)"                               [date input helper]  ← FLAG voice pass
"Show fewer"                                      [expand toggle]
"Show [N] more"                                   [expand toggle]
"Cancel"                                          [footer action]
"Confirm exchange"                                [footer action — exchange]
"Confirm completion"                              [footer action — completion]

# ExchangeCelebration
"Exchange confirmed"                              [modal headline]
[property address]                                [dynamic]
"Contracts are now legally exchanged. Your fee is crystallised — congratulations."  ← FLAG voice pass
"Continue"                                        [dismiss button]

# Toast messages — MilestoneRow actions
"[milestone name]"                                [confirm success]  ← FLAG voice pass
"[milestone name]" + "+[N] milestone[s] reconciled"  [reconciliation success]  ← FLAG voice pass
"Milestone reversed"                              [undo success]  ← FLAG voice pass
"+[N] downstream milestone[s] also undone"        [cascade undo description]  ← FLAG voice pass
"Marked not required"                             [NR action]  ← FLAG voice pass
"Couldn't update status — please try again"       [status update error]  ← FLAG voice pass

# Toast messages — notice banners (null-render components)
"MOS confirmed for both sides"                    [MosConfirmedNotice toast title]
"Seller and buyer MOS received milestones auto-confirmed from the uploaded memo."  [toast description]
"Chase reminders are active"                      [RemindersReadyNotice toast title]
"Check the Reminders tab to see what needs following up."  [toast description]
"You've claimed your position in this chain."     [ChainClaimedNotice toast title]
"Open the chain panel to see other agents."       [toast description]

# RemindersSection
"Reminders & Tasks"                               [section heading]
"[N] escalated"                                   [escalated count badge]
"↻ Run engine"                                    [developer utility button]  ← FLAG voice pass
"Running…"                                        [run engine in progress]  ← FLAG voice pass
"Escalated"                                       [urgency group label]
"Overdue"                                         [urgency group label]
"Due today"                                       [urgency group label]
"Coming up"                                       [urgency group label]
"Seller"                                          [column header]
"Buyer"                                           [column header]
"[N] item[s]"                                     [column item count]
"[N]d overdue"                                    [row urgency label — overdue]
"Due today"                                       [row urgency label]
"Escalated"                                       [row urgency label — escalated]
"From [date]"                                     [row — upcoming, no open task]
"✓ Done"                                          [per-row complete button]
"🕐"                                              [per-row snooze trigger icon]
"24 h"                                            [snooze option]
"48 h"                                            [snooze option]
"72 h"                                            [snooze option]
"7 days"                                          [snooze option]
"🕐 Snooze all"                                   [column footer snooze button]
"Chase"                                           [column footer CTA — single item]
"Chase all ([N])"                                 [column footer CTA — multiple]  ← FLAG voice pass
"Seller is all up to date"                        [empty seller column]
"Buyer is all up to date"                         [empty buyer column]
"Show"                                            [group collapse toggle — collapsed]
"Hide"                                            [group collapse toggle — expanded]
"Snoozed"                                         [snoozed group label]
"Wakes [date]"                                    [snoozed row sublabel]
"Wake up"                                         [snoozed row action]
"Completed"                                       [completed group label]
"[status]"                                        [completed log status — capitalised]
"[status] · [statusReason]"                       [completed log with reason]
"No active reminders"                             [empty state heading]
"Tasks appear here once their grace period has passed."  [empty state subtext]

# ChaseDrawer
"Chase all · [N]"                                 [multi-chase badge]
"Chase"                                           [single-chase badge]
"#[N]"                                            [chase number]
[TonePill: tone label]                            [dynamic]
[milestone name]                                  [dynamic]
[property address]                                [dynamic]
[contact name]                                    [dynamic]
[contact role]                                    [dynamic, capitalised]
"Send via"                                        [section label]
"Email"                                           [channel button]
"WhatsApp"                                        [channel button]
"CC [solicitor name] (solicitor)"                 [CC toggle label]
"Send to"                                         [WA contact picker label]
[contact name]                                    [WA candidate]
[contact role · phone]                            [WA candidate subtext]
"Tone"                                            [section label]
"Auto-selected · override if needed"              [tone helper]
"Recommended"                                     [tone option suffix for auto-selected]
"Generate message"                                [generate button]
"Generating…"                                     [generating state]  ← FLAG voice pass
"Drafted for [name] ([role])"                     [post-generation context note]
"Generate a message above, or type your own…"     [textarea placeholder — email]
"Generate a WhatsApp message above, or type your own…"  [textarea placeholder — WA]
"✏️ Message edited from generated version"         [edit indicator]  ← FLAG voice pass
"Send chase"                                      [send button — email]
"Send via WhatsApp"                               [send button — WA]
"Sending…"                                        [send pending state]  ← FLAG voice pass
"To: [email]"                                     [recipient summary — email]
"To: [email] · CC: [email]"                       [recipient summary — with CC]
"No email on file — will be logged only"          [no-email warning]  ← FLAG voice pass
"↑ Select a contact above to send"                [WA no-pick warning]  ← FLAG voice pass
"We'll log this and open WhatsApp"                [WA sent note]  ← FLAG voice pass
"Too many requests — please wait a few minutes and try again."   [rate limit error]
"Too many emails sent — please wait before sending more."        [email rate limit error]
"Logged but email delivery failed: [error]"       [partial send error]  ← FLAG voice pass
"No email address on file — add one to a contact before sending."  [pre-send error]

# AddNodeDrawer
"Edit sale"                                       [drawer title — edit mode]
"Add sale above"                                  [drawer title — above]
"Add sale below"                                  [drawer title — below]
"Tell us what you know about this link"           [drawer subtitle]
"↑ Above"                                         [direction pill]
"↓ Below"                                         [direction pill]
"Property"                                        [section label]
"Property address"                                [field label]
"Agency"                                          [section label]
"Agency name"                                     [field label]
"Agent contact"                                   [section label]
"(optional — add email to send invite)"           [label suffix]
"Agent name"                                      [field label]
"Agent email"                                     [field label]
"Contact number"                                  [field label]
"Notes"                                           [section label]
"(only you see this)"                             [label suffix]
"Property address and agency name are required"   [helper text — incomplete]
"No invite will be sent — you can add an email later"  [helper — no email]
"Enter a valid email address"                     [helper — invalid email]
"Invite will be sent now"                         [helper — existing chain]
"Invite will be sent when you save the chain"     [helper — new transaction]
"Cancel"                                          [footer action]
"Save and add above"                              [save action — above]
"Save and add below"                              [save action — below]
"Save changes"                                    [save action — edit mode]
"Saving…"                                         [pending state]

# ChainDrawer
"Chain progress"                                  [drawer heading]
"Real-time visibility across every link in the chain"  [drawer subheading]
"No chain linked to this sale"                    [empty state — no chain]
"Create a chain to track your sale's position and invite other agents to share progress visibility."  [empty state description]
"+ Create chain"                                  [empty state CTA]  ← FLAG voice pass
"Chain created — add the first link"              [empty state — chain exists, no links]
"Add the sale above or below this one to start tracking the chain together."  [description]
"+ Add sale above"                                [empty chain CTA]
"+ Add sale below"                                [empty chain CTA]
"+ Add sale above"                                [populated chain — dashed button]
"+ Add sale below"                                [populated chain — dashed button]
"Delete this node?"                               [inline delete confirmation]
"Confirm"                                         [delete confirm action]
"Cancel"                                          [delete cancel action]
"[N] node[s] ready to invite"                     [footer bulk invite prompt]
"Sending…"                                        [bulk invite in progress]  ← FLAG voice pass
"Send invites"                                    [footer bulk invite button]
"1 invite sent"                                   [toast — single invite]
"Failed to send invite"                           [toast — single invite error]
"Failed to remove"                                [toast — delete error]
"[N] invite[s] sent"                              [toast — bulk invite]

# ContactsSection
"Contacts"                                        [section heading]
"[N]"                                             [contact count badge]
"+ Add contact"                                   [header CTA]
"No contacts yet"                                 [empty state heading]
"Add vendors, purchasers, solicitors, and other parties."  [empty state description]
"Add first contact"                               [empty state CTA]
"New contact"                                     [add form heading]
"Full name"                                       [edit form placeholder]
"Full name or company"                            [add form placeholder]
"Role"                                            [field label]
"Email"                                           [field label]
"Phone"                                           [field label]
"name@example.com"                                [email placeholder]
"07700 900 000"                                   [phone placeholder]
"Adding…"                                         [add form submit — in progress]  ← FLAG voice pass
"Add contact"                                     [add form submit — idle]
"Cancel"                                          [add form cancel]
"Saving…"                                         [edit form submit — in progress]  ← FLAG voice pass
"Save"                                            [edit form submit — idle]
"Cancel"                                          [edit form cancel]
"✓ Sent"                                          [portal invite sent — button text]
"Sending…"                                        [portal invite in progress]  ← FLAG voice pass
"Send invite"                                     [portal invite button — idle]
"✓ Copied"                                        [portal link copied — button text]
"Portal link"                                     [copy portal link button — idle]
"Setting up…"                                     [generating portal token]  ← FLAG voice pass
"Set up portal"                                   [set up portal button — idle]
"Edit"                                            [contact edit button]
"Remove"                                          [contact delete button]
"…"                                               [contact delete in progress]
"Viewed [time]"                                   [portal last viewed — relative]
"Invite sent to [name]"                           [toast title]
"They'll receive an email shortly"                [toast description]

# SolicitorSection
"Solicitors"                                      [section heading]
"Saving…"                                         [inline after heading while save in progress]  ← FLAG voice pass
"Vendor solicitor"                                [card label]
"Purchaser solicitor"                             [card label]
"Vendor solicitor firm"                           [SolicitorPicker label — editing]
"Purchaser solicitor firm"                        [SolicitorPicker label — editing]
"Referral fee"                                    [referral fee label — editing]
"Save"                                            [card save button]
"Cancel"                                          [card cancel button]
"Edit"                                            [card edit trigger — firm already set]
"+ Add"                                           [card edit trigger — no firm]
"None added"                                      [display when no firm selected]
"[N] file[s] on record"                           [intel badge — file count]
"Avg [N]w to exchange"                            [intel badge — exchange speed]
"Searches: [N]d"                                  [intel badge — search days]
"Fast"                                            [intel badge rating]
"Average"                                         [intel badge rating]
"Slow"                                            [intel badge rating]
"—"                                               [intel badge rating — unknown]
"Referral fee: £[amount]"                         [referral fee display row]
"[warning text]"                                  [intel warning — dynamic]

# BrokerSection
"Mortgage Broker"                                 [section heading]
"Referral fee"                                    [field label]
"Fee received"                                    [toggle label]
"Saving…"                                         [save in progress]  ← FLAG voice pass
"Save"                                            [save button — idle]
"[£amount] broker referral received"              [summary pill — fee received]
"[£amount] broker referral pending"               [summary pill — fee not received]
"Purchaser referred to broker"                    [inline badge]

# TransactionNotes
"Notes"                                           [section heading]
"Add a note…"                                     [textarea placeholder]
"Saving…"                                         [submit button — in progress]  ← FLAG voice pass
"Add note"                                        [submit button — idle]
"Failed to save note — please try again"          [error message below form]
"just now"                                        [optimistic note timestamp]
"Show [N] more note[s]"                           [expand trigger]
"…"                                               [delete note in progress]
"Delete"                                          [note delete button — on group-hover]
"No notes yet"                                    [empty state]
"Note added"                                      [toast — success]

# ManualTaskList
"Nothing to do — nice."                           [empty state — filter=open]
"No tasks yet."                                   [empty state — filter=all]
"Done"                                            [divider label for done tasks]
"Show [N] done"                                   [show filter button]
"Hide done"                                       [hide filter button]
"With Sales Progressor"                           [agent perspective section heading]
"Agent requests"                                  [progressor perspective section heading]
"[N]"                                             [open agent tasks count badge]
"Show [N] resolved"                               [show resolved button]
"Hide resolved"                                   [hide resolved button]
"Resolved"                                        [divider label for resolved tasks]
"Nothing pending with us."                        [agent perspective — no open requests]  ← FLAG voice pass
"All agent requests resolved."                    [progressor perspective — all done]
"Your note · [time]"                              [AgentRequestRow — agent note timestamp]
"Sales Progressor · [time]"                       [AgentRequestRow — progressor response]
"✓ Taken care of"                                 [AgentRequestRow — done with no progressor note]
"To-do added"                                     [toast]
"To-do completed"                                 [toast]
"To-do removed"                                   [toast]

# ActivityTimeline — filter / search bar
"All"                                             [filter button]
"Milestones"                                      [filter button]
"Comms"                                           [filter button]
"Automated"                                       [filter button]
"Notes"                                           [filter button]
"Portal visits ([N] hidden)"                      [portal visits toggle — inactive]
"Portal visits"                                   [portal visits toggle — active]
"Search…"                                         [search input placeholder]
"No activity yet — milestone confirmations and communications will appear here."  [empty state — no entries]
"No entries match."                               [empty state — filter returned nothing]

# ActivityTimeline — milestone cards
"Marked not required"                             [card type heading]
"Confirmed by client"                             [card type heading]
"Milestone confirmed"                             [card type heading]
"View Memo"                                       [MOS link — VM2/PM2 only]
"[name] via portal · [date]"                      [confirmed-by-client meta]
"Client via portal · [date]"                      [confirmed-by-client meta — no confirmerName]
"[name] · [date]"                                 [standard completion meta]
"System"                                          [completedByName fallback]

# ActivityTimeline — comm cards (CommPill labels)
"System email"                                    [automated comm pill]
"Internal"                                        [internal_note pill]
"→ Outbound"                                      [outbound comm pill]
"← Inbound"                                       [inbound comm pill]
"Email"                                           [method label]
"Phone"                                           [method label]
"SMS"                                             [method label]
"Voicemail"                                       [method label]
"WhatsApp"                                        [method label]
"Post"                                            [method label]
"System"                                          [createdByName fallback]
"Delete"                                          [delete button — group-hover]
"…"                                               [delete in progress]

# ActivityTimeline — pagination
"Show less"                                       [collapse to 10]
"Show [N] earlier updates…"                       [expand all]

# CommsEntry
"+ Add a note or log a communication…"            [collapsed prompt]
"Start over"                                      [wizard reset]
"What type of entry is this?"                     [step 1 label]
"📝 Internal note"                                 [type button]
"→ Outbound"                                      [type button]
"← Inbound"                                       [type button]
"How was this communication made?"                [step 2 label]
"✉ Email"                                          [method button]
"📞 Phone"                                          [method button]
"💬 SMS"                                           [method button]
"📱 Voicemail"                                      [method button]
"📲 WhatsApp"                                       [method button]
"📮 Post"                                           [method button]
"Who was involved?"                               [step 3 label]
"Skip"                                            [step 3 — no contacts selected]
"Continue"                                        [step 3 — contacts selected]
"Add an internal note…"                           [textarea placeholder — internal note]
"What was discussed or communicated?"             [textarea placeholder — outbound/inbound]
"Saving…"                                         [save in progress]  ← FLAG voice pass
"Save"                                            [save button — idle]
"Cancel"                                          [cancel / reset]
"Share with client"                               [portal visibility toggle — off]
"Visible in client portal"                        [portal visibility toggle — on]
"Note added"                                      [toast — internal note success]
"Communication logged"                            [toast — outbound/inbound success]

# EmailParseWidget
"Smart email reader — coming soon"                [card heading]
"Paste an email and we'll suggest which milestones to update. We're refining this — check back soon."  [card description]

# ComposeEmail
"Compose email"                                   [card heading — compose state]
"From"                                            [field label]
"To"                                              [field label]
"recipient@example.com"                           [To field placeholder]
"Subject"                                         [field label]
"Re: 14 Grosvenor Square"                         [Subject placeholder]
"Message"                                         [field label]
"Write your email here…"                          [textarea placeholder]
"Sending…"                                        [send in progress]  ← FLAG voice pass
"Send"                                            [send button — idle]
"Cancel"                                          [cancel button]
[error message]                                   [dynamic API error below form]
"✓ Email sent"                                    [sent state confirmation]
"Email sent to [address]"                         [toast title]
"No verified sending address"                     [no-sender state heading]
"Go to"                                           [no-sender state — link prefix]
"Settings → Sending addresses"                    [no-sender state — settings link label]
"to verify a work email address before sending."  [no-sender state — link suffix]

# PropertyIntelCard
"Property Intel"                                  [card heading]
"Land Registry · EPC · Search links"              [card subheading — postcode missing]
"[postcode]"                                      [card subheading — when postcode set]
"Rightmove"                                       [external link]
"Zoopla"                                          [external link]
"Land Reg"                                        [external link]
"Fetching property data…"                         [loading state]
"Could not load property data."                   [error state]
"Data sourced from Land Registry and EPC Register. Always verify before use."  [disclaimer]
"Price Paid History"                              [section heading]
"No sales found for this postcode."               [empty price history]
"· New build"                                     [price history tag]
"EPC"                                             [section heading]
"[rating letter]"                                 [EPC rating badge — A / B / C etc.]
"[N] / 100"                                       [EPC score]
"No EPC found."                                   [empty EPC state]
"EPC data is currently unavailable."              [EPC error state]
"Inspected [date]"                                [EPC inspection date]
"View on GOV.UK →"                                [EPC external link]

# loading.tsx
[No visible text — skeleton blocks only]
```

---

## 8. Desktop view

| Field | Value |
|---|---|
| Layout | Two-column: main content (fluid) left + sidebar (320px) right |
| Navigation | `AgentShell` renders full sidebar, visible permanently |
| Page-specific desktop elements | Sidebar panel (Progress / Exchange Forecast / Agent / Price & Fees) permanently visible |
| Chase drawer | Slides in from right at 460px width |
| ChainDrawer | Slides in from right at 480px width |

```
Desktop layout:
┌─ AgentShell sidebar (240px) ─┬─ PropertyHero (full width) ──────────────────────────────────────────┐
│  logo                         │  [address] · [status badge] · back link                              │
│  nav links                    │  [progress bar shimmer]                                              │
│  user strip                   ├──────────────────────────────────┬───────────────────────────────────┤
│                               │  Overview/Milestones/Reminders/  │  Progress card                    │
│                               │  To-Do/Activity (tab bar)        │  Exchange Forecast card           │
│                               │                                  │  Agent card                       │
│                               │  [Tab content]                   │  Price & Fees card                │
│                               │    Overview: widgets, contacts,  │                                   │
│                               │    solicitors, notes             │                                   │
│                               │    Milestones: side tabs, panel  │                                   │
│                               │    Reminders: grouped columns    │                                   │
│                               │    To-Do: task list + form       │                                   │
│                               │    Activity: timeline            │                                   │
└───────────────────────────────┴──────────────────────────────────┴───────────────────────────────────┘
```

---

## 9. Mobile view

| Field | Value |
|---|---|
| Layout | Single column; sidebar panel stacks below tab content |
| Navigation | `AgentShell` sidebar collapses; mobile nav provided by `PropertyFileTabs` mobile toggle button |
| Elements that reorder | Sidebar (Progress / Price & Fees) moves below tab content |
| Sidebar toggle | `PropertyFileTabs` has a mobile sidebar toggle button with Tailwind `hover:bg-white/10` |
| Elements that become drawers | Chase drawer is right-panel on all viewports |
| Modals | All modals render full-screen on mobile (portal to body, max-width capped) |
| Mobile-only elements | Mobile sidebar toggle in `PropertyFileTabs` |

```
Mobile layout (375px):
┌───────────────────────────────┐
│  ← Back  [address]  [status] │  ← PropertyHero (sticky)
│  [progress bar]               │
├───────────────────────────────┤
│  Overview · Milestones · ...  │  ← PropertyFileTabs (scrollable)
│  [sidebar toggle button]      │
├───────────────────────────────┤
│                               │
│  [Active tab content]         │
│                               │
├───────────────────────────────┤
│  [Sidebar panel stacked]      │  ← Progress, Exchange Forecast, Fees
│  (visible below tabs)         │
└───────────────────────────────┘
```

**Open questions:**
- Does the status dropdown become a bottom sheet on mobile? Not confirmed from code — StatusControl portal renders to body with standard positioning.
- At what exact breakpoint does the two-column layout switch to single-column? Requires CSS inspection.

---

## 10. Animations / transitions already in place

| Element | Animation | Keyframe | Notes |
|---|---|---|---|
| Milestone dot (confirm) | `ms-node-pop` | In `<style>` in `MilestonePanel.tsx` | 360ms spring. Local only |
| Milestone row unlock flash | `ms-unlock-enter` | In `<style>` in `MilestonePanel.tsx` | 900ms ease. Local only |
| Milestone dot unlock | `ms-node-unlock` | In `<style>` in `MilestonePanel.tsx` | 340ms spring. Local only |
| Milestone Confirm button appear | `ms-btn-appear` | In `<style>` in `MilestonePanel.tsx` | 220ms ease, 120ms delay. Local only |
| Progress bar shimmer | `ms-shimmer` | In `<style>` in `MilestonePanel.tsx` | 2.4s loop. Local only |
| Progress bar width | `transition: [width] duration-700 ease-out` | Tailwind in `MilestonePanel.tsx` | On milestone completion |
| Progress ring glow | `ring-glow-pulse` | In `<style>` in `TransactionSidebar.tsx` | 3s loop. Local only |
| Progress ring arc | `transition: stroke-dasharray 0.6s ease` | Inline style in SVG | Animates on data change |
| Chase drawer open | `agent-drawer-in` | `agent-system.css` | 280ms spring ✓ |
| ChainDrawer open | `agent-drawer-in` | Inline `animation` on panel div | 280ms spring ✓ (inline, not class) |
| AddNodeDrawer open | `agent-drawer-in` | `agent-system.css` | 280ms spring ✓ |
| ReconciliationDrawer open | `agent-drawer-in` | `agent-system.css` | 280ms spring ✓ |
| EditSaleDetailsDrawer open | `agent-drawer-in` | `agent-system.css` | 280ms spring ✓ |
| SurveyNrConfirmModal open | `agent-modal-in` | `agent-system.css` | 280ms spring ✓ |
| UndoMilestoneModal open | `agent-modal-in` | `agent-system.css` | 280ms spring ✓ |
| MortgageModal open | `agent-modal-in` | `agent-system.css` | 280ms spring ✓ |
| ExchangeCelebration modal | `exchange-in` | In `<style>` in `ExchangeCelebration.tsx` | 200ms ease. Local only |
| Confetti canvas | Custom `requestAnimationFrame` loop | In `ExchangeCelebration.tsx` | 3s, fades at 2.4s |
| All drawers/modals backdrop | `agent-backdrop-overlay` | `agent-system.css` | 200ms ✓ |
| ChaseDrawer channel crossfade | Inline `opacity: contentFading ? 0 : 1, transition: "opacity 120ms"` | ChaseDrawer state | Not canonical |
| Tab content fade | `transition-opacity duration-[150ms] ease-out` | Tailwind in `PropertyFileTabs.tsx` | Not canonical |
| Milestone row background | `transition-colors duration-[150ms]` | Tailwind in `MilestoneRow.tsx` | On state change |
| Toast enter/exit | `agent-toast-in` / `agent-toast-out` | `agent-system.css` | Via `AgentToaster` ✓ |
| ActivityTimeline scroll bar | `transition-all` on score bar | Tailwind in `RiskScoreWidget.tsx` | Display-only |

**Reduced-motion status:**
- MilestonePanel: `@media (prefers-reduced-motion: reduce) { .ms-node-pop, .ms-unlock-enter, .ms-node-unlock, .ms-btn-appear { animation: none; } }` ✓ Correct
- **ExchangeCelebration `exchange-in` keyframe: NO reduced-motion guard. → Stage 2 fix: add `@media (prefers-reduced-motion: reduce) { .exchange-in { animation: none; } }`**
- **ExchangeCelebration confetti canvas: NO reduced-motion guard on `requestAnimationFrame` loop. → Stage 2 fix: check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and skip canvas entirely**
- **ProgressRing `ring-glow-pulse` keyframe: NO reduced-motion guard. → Stage 2 fix: add guard in `<style>` block**
- **ChaseDrawer channel crossfade (120ms inline opacity transition): NO reduced-motion guard. → Stage 2 fix: wrap transition in reduced-motion check**

**Keyframe recommendation — option (c) — Stage 2 applies:**
- `ms-unlock-enter` → **fold into `agent-row-flash`** in `agent-system.css`. Both serve row-level confirmation flash patterns. Same semantic; consolidate to canonical.
- `exchange-in` → **extract to `agent-system.css` as a celebration variant**. Distinct from `agent-modal-in` (different easing — cubic-bezier bounce) — add as `agent-modal-in--celebrate` or similar. Not discarded, but canonicalised so reduced-motion fix is in one place.
- `ms-node-pop`, `ms-shimmer`, `ms-node-unlock`, `ms-btn-appear`, `ring-glow-pulse` → **stay local**. All are milestone-panel-specific or sidebar-specific; extracting would add global overhead for one-page animation.

---

## 10.5. Global animation and interaction inheritance

**Animation classes (§1–5):**

| Class | Applies? | Where it fires | Status |
|---|---|---|---|
| `.agent-acc` / `.agent-acc-in` | Yes — multiple locations | MilestonePanel section accordions; NR section accordion; ManualTaskList done-section expand; RemindersSection urgency group collapse | **Missing** — all use bespoke expand/collapse (`!isCollapsed &&` pattern, no transition). Needs Stage 4 wiring |
| `.agent-reveal-in` / `.agent-reveal-out` | Yes | MilestoneRow: event date form, N/R reason form, counterpart notice reveal; StatusControl withdrawal reason form; CommsEntry step transitions | **Missing** — all use conditional render without animation. Needs Stage 4 wiring |
| `.agent-dropdown-in` | Yes | StatusControl status dropdown; ChaseDrawer tone dropdown; RowSnoozeMenu + SideSnoozeMenu dropdowns | **Missing** — all appear instantly. Needs Stage 4 wiring |
| `.agent-row-flash` | Partial | Milestone confirm: `ms-node-pop` and `ms-unlock-enter` (bespoke); reminder ✓ Done complete | `ms-*` bespoke exist; `ms-unlock-enter` to be folded into canonical in Stage 2. Stage 4: `agent-row-flash` for reminder row on complete |
| `.agent-btn` (press-down + hover) | Yes | Every button on page | **Missing on most** — Confirm/Undo/Cancel/Reinstate/NR/Chase/Done/Save all use bespoke Tailwind or inline styles. Audit in Stage 2 |

**Interactive-state classes (§6–10):**

| Class | Applies? | Where it fires | Status |
|---|---|---|---|
| `.agent-segment-pill` | Yes | MilestonePanel Vendor/Purchaser side tabs; ActivityTimeline filter buttons | **Missing** — MilestonePanel uses `bg-white/60 shadow-sm`; ActivityTimeline uses `bg-slate-900/15`. Needs Stage 4 wiring |
| `.agent-link` / `.agent-link-muted` | Yes | PropertyHero back link; TransactionSidebar "Edit details"; NotRequiredRow "Reinstate"; MilestoneRow "Cancel" / "OK"; TransactionNotes "Show N more"; RecentActivityWidget "View all →"; RemindersWidget "View all →"; FileHealthBanner "View reminders →" | **Missing on all** — all use Tailwind hover or inline styles. Needs Stage 4 wiring |
| `.agent-btn-ghost-bordered` | Yes | StatusControl "Cancel" (withdrawal modal); AddNodeDrawer "Cancel"; ChainDrawer "Cancel" delete node | **Missing** — bespoke bordered neutral styling. Needs Stage 4 wiring |
| `.agent-acc-hdr` | Yes | MilestonePanel section accordions; NR section accordion; RemindersSection group headers | **Missing** — uses `transition-all group` Tailwind (MilestonePanel) and bespoke Tailwind (RemindersSection). Needs Stage 4 wiring |
| `.agent-icon-btn` | Yes | ChaseDrawer close (×); AddNodeDrawer close (×); EditSaleDetailsDrawer close (×); ChainDrawer close (×); SurveyNrConfirmModal close; UndoMilestoneModal close; MortgageModal close; EmailParseWidget dismiss (×) | **Missing on all** — all use inline hover handlers |

**Additional non-canonical patterns found (audit notes for Stage 2):**
- ActivityTimeline search input: `focus:ring-1 focus:ring-blue-300/50` — not `agent-focus`
- AddNodeDrawer agent email field: `focus:ring-2 focus:ring-blue-300/50` — not `agent-focus` (all other AddNodeDrawer inputs use `agent-focus` ✓)
- CommsEntry step indicator: Tailwind `bg-green-500 bg-blue-500 bg-white/30` — not canonical
- ContactsSection Save/Add contact buttons: `bg-blue-500 hover:bg-blue-600` — not `agent-btn-color-primary`
- RemindersSection urgency headers: Tailwind only — not `agent-acc-hdr`
- `agent-hover-link`: Used in ChainDrawer add-above/below dashed buttons. This class is non-canonical (not in the §6–10 list) — investigate in Stage 2 whether it should map to `agent-link` or be removed

**Rule:** All "Missing / Needs Stage 4 wiring" rows must be listed in section 12 as implementation tasks for Stage 4.

---

## 11. Known edge cases

- **`useOptimistic` in MilestoneRow:** Confirm and Undo use `useOptimistic`. Stage 2 must not touch the hook or its state logic — only the visual wrapper (row background, button styling). The optimistic state (`isComplete`, `isNotRequired`) controls which JSX branch renders.
- **`useOptimistic` in TransactionNotes:** Note add uses `useOptimistic`. Same rule — wrapper only.
- **`useOptimistic` in StatusControl:** Status change uses `useOptimistic`. Same rule.
- **ManualTaskList optimistic add:** `handleAdd` writes an optimistic task to local state and rolls back on failure. The `useTabBadge` hook also updates the tab badge count optimistically — do not add transitions that clash with badge re-renders.
- **Cascade undo:** The `UndoMilestoneModal` cascade list can be long. The "Show N more" expand toggle must remain functional.
- **Exchange gate (VM18/PM25 + VM19/PM26):** Both sides must be exchange-ready before VM19/PM26 can be confirmed. The `counterpartNotice` prop gates this. Stage 2 does not touch counterpart logic.
- **Reconciliation flow:** VM19, PM26, VM20, PM27 trigger `ReconciliationDrawer` instead of direct confirm. Any animation on the Confirm button must not break the drawer trigger.
- **MilestonePanel optimistic unlock/relock:** `optimisticallyUnlockedIds` and `optimisticallyRelockedIds` are sets passed as props to `MilestoneRow`. They affect `effectivelyAvailable` which gates button rendering. Stage 2 must not alter this prop flow.
- **ExchangeCelebration + confetti:** The confetti runs on a canvas for 3 seconds. The modal card sits above it. Any z-index changes to the page must be verified against confetti canvas clipping. The reduced-motion fix (Stage 2) must skip the canvas entirely, not just pause it.
- **ChaseDrawer multi-chase mode:** When `milestones` prop contains multiple items, the drawer sends to all `chaseTaskIds` in the loop. The UI shows all milestone names. Distinct layout mode — do not accidentally strip it.
- **ChaseDrawer generation invalidation:** `generationIdRef` pattern ensures in-flight AI generation results are discarded on channel switch. Do not replace with `AbortController` without testing both channels.
- **ReconciliationDrawer — no close on backdrop click:** Intentional — user has entered data. Do not add backdrop dismiss.
- **SurveyNrConfirmModal / UndoMilestoneModal — no close on backdrop click:** Same — destructive confirmation modals.
- **ChainDrawer — fetches on open:** Chain data is fetched client-side each time the drawer opens. If the network is slow, the loading skeleton shows. Any animation added to the skeleton must not conflict with the immediate data render.
- **CommsEntry reset on navigate:** `reset()` is called when the wizard is submitted or cancelled. It sets `expanded = false`, collapsing the form. Any transition on collapse must not re-trigger when the parent re-renders.
- **PropSaveStage state machine:** EditSaleDetailsDrawer uses a 7-state machine (`"idle" | "loading_addr" | "addr_modal" | "addr_saving" | "tenure_checking" | "tenure_preview" | "tenure_saving"`). Stage 2 must not touch this state machine — only the visual wrappers of the states.

---

## 12. Out of scope for redesign

- Milestone confirmation logic (`confirmMilestoneAction`, `markNotRequiredAction`, `reverseMilestoneAction`, `executeUndoMilestoneAction`) — server actions
- Exchange reconciliation logic (`getExchangeReconciliationList`, `confirmExchangeReconciliationAction`) — server actions
- Cascade undo impact calculation (`getUndoImpactAction`) — server action
- Chase message AI generation (`/api/ai/generate-chase`) — API route and AI prompt
- Chase email delivery (`/api/chase/send-email`) — API route
- Comms logging (`logCommAction`, `deleteCommAction`) — server actions
- `useOptimistic` implementation in MilestoneRow, TransactionNotes, StatusControl, ManualTaskList — hook logic
- `PropSaveStage` state machine in EditSaleDetailsDrawer — the machine logic; only the visual wrappers are in scope
- Multi-tenancy access control (`agencyId` checks, negotiator own-file gate) — not touched
- Data fetching: no query changes, no new server-side data requirements
- Confetti canvas animation in ExchangeCelebration — functional celebration UX; only the modal card wrapper is in scope (reduced-motion fix is an exception: Stage 2 adds the guard)
- Solicitor intel fetch (`/api/solicitor-intel`) — API route
- Property intel fetch (`/api/property-intel`) — API route
- Portal token generation (`generatePortalTokenAction`) — server action
- ChainDrawer chain management logic (create chain, invite, delete links) — API calls
- `generationIdRef` pattern in ChaseDrawer — do not touch

**Stage 4 wiring tasks (from section 10.5):**
- Wire `.agent-acc` / `.agent-acc-in` on: MilestonePanel section accordions, NR accordion, ManualTaskList done-section, RemindersSection group collapse
- Wire `.agent-reveal-in` / `.agent-reveal-out` on: MilestoneRow inline forms (event date, N/R reason, counterpart notice), StatusControl withdrawal reason, CommsEntry step transitions
- Wire `.agent-dropdown-in` on: StatusControl dropdown, ChaseDrawer tone dropdown, RowSnoozeMenu, SideSnoozeMenu
- Wire `.agent-row-flash` on: reminder ✓ Done row (post-complete)
- Audit all buttons for `.agent-btn` press-down — add where missing
- Wire `.agent-segment-pill` on: MilestonePanel side tabs, ActivityTimeline filter buttons
- Wire `.agent-link` on: PropertyHero back, TransactionSidebar "Edit details", NotRequiredRow "Reinstate", MilestoneRow "Cancel"/"OK", TransactionNotes "Show N more", widget "View all →" links, FileHealthBanner "View reminders →"
- Wire `.agent-btn-ghost-bordered` on: StatusControl "Cancel", AddNodeDrawer "Cancel", ChainDrawer delete "Cancel"
- Wire `.agent-acc-hdr` on: MilestonePanel accordions, RemindersSection group headers
- Wire `.agent-icon-btn` on: all × close buttons (ChaseDrawer, AddNodeDrawer, EditSaleDetailsDrawer, ChainDrawer, modals, EmailParseWidget)
- Fix ActivityTimeline search input and AddNodeDrawer email field to use `agent-focus`
- Investigate `agent-hover-link` usage in ChainDrawer — canonicalise or remove

---

## Amendments

| Date | Discovery | Added to which section |
|---|---|---|
| 2026-05-11 | Full reads of all 16 assessment-gap components completed; assessment gaps note removed | Sections 2, 4, 5, 6, 7, 10, 10.5, 12 |
| 2026-05-11 | ChainDrawer added to component table (indirectly rendered via ViewChainButton and RemindersSection) | Section 2 |
| 2026-05-11 | Reduced-motion gaps flagged as Stage 2 fixes (ExchangeCelebration, ProgressRing, ChaseDrawer crossfade) | Section 10 |
| 2026-05-11 | Keyframe option (c) documented: ms-unlock-enter→agent-row-flash, exchange-in→agent-system.css, others stay local | Section 10 |
| 2026-05-11 | Stage 4 wiring task list added | Section 12 |
