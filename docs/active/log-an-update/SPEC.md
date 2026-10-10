# Log an update — build spec

Status: **approved, in build** (2026-10-10)
Prototype (approved UI): the "Log an update" artifact (coral/cream/glass, modal on desktop,
up-sliding drawer on tablet/mobile).

One **"Log an update"** button on the file replaces today's "Draft for everyone / Note / More"
toolbar, opening a single modal/drawer that does everything the composer does now, plus a
voice-note → review → apply flow.

---

## UI / animation (locked from the approved prototype — do not lose)

- Desktop: centred glass modal, scale + fade in. Tablet/mobile: bottom drawer, slide up.
- Mobile "Log" menu opens → the drawer animates taller so the menu isn't lost.
- Screens cross-fade; back arrow + Esc + backdrop close.
- Solid coral gradient primary (`#FF6F4E → #F04E2C`); **Record** = navy avatar-style icon badge (`#294A73 → #163152`).
- "Log something" grid: 4 across on top, bottom 3 full-width (33% each); icons only, no tile backer.
- Recipient pills: colour-coded avatar + full name; hover = coral border; select = slight raise + coral check; clean white bg (no faded fill).
- Hovers/focus rings on every interactive element; reduced-motion respected.
- App tokens: coral `#FF6B4A`, cream `#FFF5EC`, ink `#2D1810`, glass cards, Geist.

---

## Modes (screens)

### Reuse (just wiring into the modal)
- **Type → Draft for everyone** → `/api/ai/draft-update` → per-side drafts; send → `sendDraftClientUpdateAction` → `sendProgressorPortalReply` (stores `PortalMessage`, one alert: push else email). Reuse `DraftForEveryonePanel`.
- **Log a comm** (email/call/text/voicemail/post) → `logCommAction`. WhatsApp → reuse `PasteWhatsAppPanel`.
- **Add a note** → `saveDraftNoteAction` (internal only).

### New machine: Record → Understand → Review → Apply
- **Record & transcribe:** browser **Web Speech API** (`SpeechRecognition`). Free, on-device, **no new API key, no new DPA**. Claude can't transcribe audio; no OpenAI key in the stack. Whisper only if the free route disappoints (would need key + DPA). Recording screen = timer + waveform + live transcript (as prototyped).
- **Understand:** transcript → Claude (same infra as draft-update), new prompt returns structured JSON: milestones mentioned, to-dos, per-side client drafts, enquiry hand-over.
- **Review:** every proposal editable / removable / add-missed; graceful "nothing definite caught, here's the transcript" fallback.
- **Apply (on Approve):** each row calls its real function (table below).

| Review row | Function | Status |
|---|---|---|
| Mark a step done | `completeMilestone` | reuse |
| Set a to-do | `createManualTaskAction` (ManualTask: title, dueDate, transactionId, assignedToId) | reuse |
| Move enquiries side | `logEnquiryMovementAction({ flipsCourtTo, kind })` → `EnquiryTracker.currentlyWith` | reuse (+ tiny UI) |
| Seller / Buyer update | `sendDraftClientUpdateAction` | reuse |
| File note | `saveDraftNoteAction` | reuse |

---

## Mark-a-milestone, done properly

- A detected step is **expanded into its prerequisite chain** via `DIRECT_PREREQUISITES`
  (`lib/milestone-prerequisites.ts`). "Offer accepted" (PM11) also offers PM5 + PM6 — but **only
  the ones not already complete** (they must be true for PM11 to be true). Pre-ticked, in order;
  completed in dependency order on approve.
- **Only available / about-to-be-available steps are offered** — never an unrelated future step,
  never an already-complete one.
- **Steps that need info show the same fields as the Steps tab:** valuation (PM6) gets its date +
  "desktop, no visit" option; survey (PM9) gets level/surveyor. Dates editable inline.

## To-do (was "reminder")
`createManualTaskAction` — titled to-do, attached to the property, with a due date, **assigned to
the current user**. Due date editable via a calendar icon → the existing date picker (no new
component; styled popover is a later nicety).

## Enquiries side-switch
`logEnquiryMovementAction({ flipsCourtTo: "seller_solicitor"|"buyer_solicitor", kind })`. AI
proposes the direction pre-selected; review shows a small left/right control to confirm/correct.

---

## Cross-cutting (agreed)
- Edit / add / remove every extracted action; "nothing caught" fallback.
- No double-apply (already-done step shows done, skipped).
- Save the transcript as a file note (record + feeds the draft voice-profile).
- Assignee = the current user.
- Sends inherit unsubscribe/pause/one-alert rules (same function).
- Undo = a toast with an Undo action after a batch apply.
- Mobile mic permission + "listening / permission denied" states.
- Per-user AI rate-limit (same guard as draft-update): a note = one transcription + one extraction.

---

## What's new vs reuse
- **New:** browser speech capture; the extraction prompt/route; the review's enquiry side-control;
  the "mark-done expands prerequisites" grouping; the LogUpdateModal shell (ports the prototype).
- **Reuse:** `completeMilestone`, `createManualTaskAction`, `logEnquiryMovementAction`,
  `sendDraftClientUpdateAction`, `saveDraftNoteAction`, `/api/ai/draft-update`,
  `DIRECT_PREREQUISITES`, `DraftForEveryonePanel`, `PasteWhatsAppPanel`, `logCommAction`,
  `DateField`, toasts, push/email alerting.

## Build order
1. **LogUpdateModal shell + the three existing modes wired**, replacing the composer trigger on the file.
2. **Mark-done (+ prerequisite expansion + step-tab fields) + to-do create + enquiry side-control** — reusing actions.
3. **Record (browser speech) + extraction prompt + review-apply** — built last on proven actions.

Phases 1–3 shipped to prod 2026-10-10.

---

## Feedback round 1 — phased plan (quickest → longest)

### Phase 1 — bug + micro-fixes (minutes)
- **Fix:** the "Log an update" trigger renders unstyled until the modal opens — its CSS lives in a `<style>` only mounted with the modal. Render the styles always (outside the open-gated portal).
- "· needed for the above" → **"Requires previous step"**, on its own line, capitalised.
- Nicer **hover on the X close** (coral-tint + slight rotate/scale).

### Phase 2 — control styling (small)
- **Toggles**: on-state = solid coral gradient track, knob slides across (replace white-on-white). Modal toggles first; optionally align the reused Draft/WhatsApp panel toggles.
- **Ready/Listening indicator**: drop the pill background, keep dot + text, **gloss the dot**.
- **Start-recording button**: add a speaking/mic icon that animates on hover; slim border lights **coral** on hover.

### Phase 3 — exit animation (small–medium)
- On close (incl. click-off / Esc), play the **reverse of the entry** (desktop scale+fade out, mobile slide down) via a `closing` state + `onAnimationEnd` → unmount.

### Phase 4 — recipient layout (medium)
- "Who" picker + review recipient rows: **seller(s) left, buyer(s) right** (solicitors split vendor-left / purchaser-right). Under ~800px, stack with a small labelled sub-header per side + hairline divider (no ambiguous gap).

### Phase 5 — live decibel waveform (medium–large)
- Alongside speech recognition, open a mic stream + Web Audio `AnalyserNode`; drive the waveform bar heights from real-time volume (rAF loop). Graceful fallback to the current animation if audio analysis is unavailable.

### Phase 6 — "share with client" who-sees-this (largest; needs a decision)

**Premise corrected after tracing the real code (2026-10-10).** It is NOT "all-or-nothing to
every client." A shared comm (`OutboundMessage.visibleToClient = true` — there is no `CommsEntry`
model) is scoped on read in `getPortalTimeline` (`lib/services/portal.ts:3101-3118`) by the
viewer's side AND by the `contactIds` the agent ticked:
- **Purchaser** sees it only if their own contactId is in `contactIds` (+ active buyer round).
- **Vendor** sees it if `contactIds` is empty (broadcast) OR addressed to any vendor contact.
- **Asymmetry / footgun:** a true broadcast (empty `contactIds`) reaches vendors but **NOT** any
  purchaser (the purchaser arm requires `contactIds.has(theirId)`).

So the real gap is that **audience is coupled to the participant list** (who the comm was *with* ==
who can *see* it), and the broadcast case is asymmetric. What a client actually sees: attributed to
**"Your team"** (no individual agent), method pill only (no inbound/outbound), `Mon, 5 Oct · 14:30`.

- **6a (artifact):** DONE — `docs/active/log-an-update/share-visibility.html`. Shows the true
  behaviour (side + contactIds scoping), the broadcast asymmetry, the exact portal copy, and the
  proposed explicit "Who sees this" control decoupled from participants.
- **6b (decision — PENDING Ellis):** add explicit per-side "Who sees this" + fix broadcast
  asymmetry (recommended), vs. only fix the asymmetry, vs. leave as-is.
- **6c (build):** only after 6b. Wire the chosen "who sees this" model into log-a-comm + the voice
  review sends.

Each phase is its own commit (one concern per PR). Phases 1–5 are code; Phase 6 starts with the artifact + your decision before any wiring.
