# Toast Registry

**Canonical source of truth for every toast in the agent app.**

When adding or editing any toast, check this doc first. Strings must conform to [VOICE_GUIDELINES.md](VOICE_GUIDELINES.md) and the six rules below. Add the new row to the relevant surface table. If a string violates a rule, mark it `✗` with a one-line reason so the inconsistency is visible.

The registry includes existing production toasts, dev-only preview toasts, and any new toasts added in the most recent PR — together so the wording reads coherently as a set, not scattered across files.

---

## Voice rules (applied to every string)

1. **"Milestone" → "Step"** wherever the word appears literally. Agent-specific step names (e.g. "Memo of Sale received") are fine.
2. **Drop redundant preamble.** Toast confirms the new state, not the act. `"Status changed to On hold"` → `"File on hold"`.
3. **Keep the half that conveys what the user can't see.** The cascade fired, X people emailed, count of side-effects. Briefly, calmly.
4. **No exclamation marks. No "Done!" / "Great!" / "Oops". No filler.** Flat, present-tense statements of the new fact.
5. **Add vs update distinction** where the action could be either.
6. **Error toasts:** plain language, what failed + what to do where possible. No raw error codes.

Toast types & default durations (from [components/agent/AgentToaster.tsx](../../components/agent/AgentToaster.tsx)):
- `success` — 4s
- `info` — 4s
- `warning` — 6s
- `error` — 8s

### Vocabulary conventions (recorded so nobody "fixes" them later)

- **"Invite" everywhere, not "Invitation"** — shorter and matches the brisk register. Applies to toast strings; longer-form body copy on landing pages can still say "Invitation" where the formal register is appropriate.
- **"Deleted" for notes, "removed" for to-dos** — this is *intentional*, not drift. `Delete` reads as "gone for good" (correct for a note); `Remove` reads as "taken off this list" (correct for a to-do, where the underlying task may still exist). Do not unify.
- **"Step" not "milestone"** in any user-facing string. The agent-specific step names (e.g. "Memo of Sale received") are fine — they're not the word "milestone."

---

## Property file — status

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [StatusControl.tsx](../../components/transaction/StatusControl.tsx) `applyStatus` success | Change status → Active | success | `File active` | — | — | ✓ |
| ↑ same | Change status → On hold | success | `File on hold` | — | — | ✓ |
| ↑ same | Change status → Completed | success | `File completed` | — | — | ✓ |
| ↑ same | Change status → Withdrawn (chain-linked file) | success | `Withdrawn — chain notified` | — | suffix only when `inChain === true` | ✓ — keeps the non-obvious half (cascade fired) |
| ↑ same | Change status → Withdrawn (non-chain file) | success | `Withdrawn` | — | — | ✓ |
| [StatusControl.tsx:82](../../components/transaction/StatusControl.tsx#L82) | Status change failed — "Cannot mark as completed" | error | `{server msg}` | — | server msg | ✓ |
| [StatusControl.tsx:84](../../components/transaction/StatusControl.tsx#L84) | Status change failed — other | error | `Couldn't update status — try again` | — | — | ✓ |

## Property file — automation

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [AutomationControls.tsx](../../components/transaction/AutomationControls.tsx) | Pause client emails | success | `Client emails paused` | — | — | ✓ |
| ↑ same | Resume client emails | success | `Client emails resumed` | — | — | ✓ |
| ↑ same | Put file on hold | success | `File on hold` | — | — | ✓ (same string as status → on hold; both routes can reach this state) |
| ↑ same | Reactivate file (from on-hold) | success | `File active` | — | — | ✓ |
| ↑ same | Pause failed | error | `Couldn't pause client emails — try again` | — | — | ✓ |
| ↑ same | Resume failed | error | `Couldn't resume client emails — try again` | — | — | ✓ |
| ↑ same | Put on hold failed | error | `Couldn't put file on hold — try again` | — | — | ✓ |
| ↑ same | Reactivate failed | error | `Couldn't reactivate file — try again` | — | — | ✓ |

## Property file — steps / milestones

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [MilestoneRow.tsx:191](../../components/milestones/MilestoneRow.tsx#L191) | Confirm step | success | `{stepName}` (e.g. `Memo of Sale received`) | optional, server-provided | step name | ✓ |
| [MilestoneRow.tsx:229](../../components/milestones/MilestoneRow.tsx#L229) | Confirm step (with downstream reconciled) | success | `{stepName}` | `+{n} step{s} reconciled` | name + count | ✓ |
| [MilestoneRow.tsx:263](../../components/milestones/MilestoneRow.tsx#L263) | Undo step | info | `Step undone` | (varies) | — | ✓ |
| [MilestoneRow.tsx:300](../../components/milestones/MilestoneRow.tsx#L300) | Mark not required | success | `Skipped` | — | — | ✓ |
| [NextMilestoneWidget.tsx:106,130](../../components/transaction/NextMilestoneWidget.tsx#L106) | Confirm next step (widget) | success | `{stepName}` | — | step name | ✓ |
| [NextMilestoneWidget.tsx:111,134](../../components/transaction/NextMilestoneWidget.tsx#L111) | Step confirm failed | error | `Couldn't confirm step` | `{server msg}` | server msg | ✓ |
| [MosConfirmedNotice.tsx:17](../../components/transaction/MosConfirmedNotice.tsx#L17) | MOS auto-confirm both sides | success | `MOS confirmed for both sides` | `Seller and buyer MOS received steps confirmed.` | — | ✓ |

## Property file — notes / comms / docs

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [TransactionNotes.tsx](../../components/transaction/TransactionNotes.tsx) `handleAdd` | Add note (form submit) | success | `Note added` | — | — | ✓ |
| ↑ same | Add note failed | error | `Couldn't save note — try again` (fallback) OR `{server msg}` if short | — | err msg | ✓ |
| [TransactionNotes.tsx](../../components/transaction/TransactionNotes.tsx) `handleDelete` | Delete note | success | `Note deleted` | — | — | ✓ |
| ↑ same | Delete note failed | error | `Couldn't delete note — try again` (fallback) OR `{server msg}` if short | — | err msg | ✓ |
| [CommsEntry.tsx:124](../../components/activity/CommsEntry.tsx#L124) | Log internal note (Comms entry path) | success | `Note added` | — | — | ✓ |
| [CommsEntry.tsx:124](../../components/activity/CommsEntry.tsx#L124) | Log outbound comm (Comms entry path) | success | `Logged` | — | — | ✓ |
| [ComposeEmail.tsx:54](../../components/verified-emails/ComposeEmail.tsx#L54) | Send verified email | success | `Email sent to {recipient}` | — | recipient | ✓ |
| [PasteWhatsAppPanel.tsx:167](../../components/activity/PasteWhatsAppPanel.tsx#L167) | WhatsApp import (with inserts) | success | `{n} logged, {m} skipped` OR `Nothing new to log ({m} already on file)` | — | counts | ✓ |
| [PasteWhatsAppPanel.tsx:173](../../components/activity/PasteWhatsAppPanel.tsx#L173) | WhatsApp import failed | error | `{error msg}` OR `Import failed` | — | err msg | ✓ |
| [PasteWhatsAppPanel.tsx:183](../../components/activity/PasteWhatsAppPanel.tsx#L183) | Undo WhatsApp import | success | `Undone — {n} removed` | — | count | ✓ |
| [PasteWhatsAppPanel.tsx:186](../../components/activity/PasteWhatsAppPanel.tsx#L186) | Undo failed | error | `{error msg}` OR `Undo failed` | — | err msg | ✓ |

## Property file — chase drawer

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [ChaseDrawer.tsx](../../components/chase/ChaseDrawer.tsx) `handleSend` success | Send chase | success | `Chase sent` | — | — | ✓ — fires BEFORE drawer closes so events compose into one beat |
| ↑ same | Send chase failed (catch) | error | `Couldn't send chase — try again or check the recipient` | — | — | ✓ |

## Property file — contacts / system notices

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [ContactsSection.tsx:126](../../components/contacts/ContactsSection.tsx#L126) | Send portal invite | success | `Invite sent to {contactName}` | `They'll receive an email shortly` | contact name | ✓ |
| [RemindersReadyNotice.tsx:30](../../components/transaction/RemindersReadyNotice.tsx#L30) | Reminders engine auto-setup | success | `Reminders are set up` | `Check the Reminders tab to see what needs following up.` | — | ✓ |
| [NewTransactionToast.tsx:13](../../components/transaction/NewTransactionToast.tsx#L13) | Just-created file (banner) | success | `File created` | `{address}` | address | ✓ |
| [ClaimedToast.tsx:17](../../components/transaction/ClaimedToast.tsx#L17) | After claim flow (5s duration) | success | `You're in the chain` | `Open the chain panel to see how the other sales are progressing.` | — | ✓ |

## Chain drawer

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [ViewChainButton.tsx:38](../../components/chain/ViewChainButton.tsx#L38) | Save chain edit | success | `Sale updated` | — | — | ✓ |
| [ViewChainButton.tsx:40](../../components/chain/ViewChainButton.tsx#L40) | Add sale to chain (invite sent) | success | `Sale added · Invite sent` | — | branched | ✓ |
| [ViewChainButton.tsx:40](../../components/chain/ViewChainButton.tsx#L40) | Add sale to chain (no invite) | success | `Sale added` | — | branched | ✓ |
| [ChainDrawer.tsx:160](../../components/chain/ChainDrawer.tsx#L160) | Send single invite | success | `{n} invite{s} sent` (renders `1 invite sent` here since count is always 1) | — | count (always 1 on this path) | ✓ — uses same template as line 200 for code consistency |
| [ChainDrawer.tsx:163](../../components/chain/ChainDrawer.tsx#L163) | Single invite failed | error | `Couldn't send invite` | — | — | ✓ |
| [ChainDrawer.tsx:179](../../components/chain/ChainDrawer.tsx#L179) | Remove chain link failed | error | `Couldn't remove this sale` | — | — | ✓ |
| [ChainDrawer.tsx:200](../../components/chain/ChainDrawer.tsx#L200) | Bulk-send invites | success | `{n} invite{s} sent` | — | count | ✓ |

## Reminders / tasks / todos

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [ManualTaskList.tsx:142](../../components/todos/ManualTaskList.tsx#L142) | Add to-do | success | `To-do added` | — | — | ✓ |
| [ManualTaskList.tsx:156](../../components/todos/ManualTaskList.tsx#L156) | Mark to-do done | success | `To-do completed` | — | — | ✓ |
| [ManualTaskList.tsx:165](../../components/todos/ManualTaskList.tsx#L165) | Delete to-do | success | `To-do removed` | — | — | ✓ |

## New-sale flow / draft

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [NewSaleFlow.tsx:680](../../components/transactions-v2/NewSaleFlow.tsx#L680) | Save draft | success | `Draft saved` | — | — | ✓ |
| [NewSaleFlow.tsx:682](../../components/transactions-v2/NewSaleFlow.tsx#L682) | Save draft failed | error | `Couldn't save draft — try again` | — | — | ✓ |
| [NewSaleFlow.tsx:709](../../components/transactions-v2/NewSaleFlow.tsx#L709) | Remove draft failed | error | `Couldn't remove draft — try again` | — | — | ✓ |
| [NewSaleFlow.tsx:718](../../components/transactions-v2/NewSaleFlow.tsx#L718) | Submit validation error | error | `{validation msg}` | — | msg | ✓ |
| [NewSaleFlow.tsx:809](../../components/transactions-v2/NewSaleFlow.tsx#L809) | Final submit failed | error | `The file didn't save. Try again or contact support.` | — | — | ✓ |

## Settings / team / profile / account

| File:line | Trigger | Type | Title | Description | Dynamic | Voice |
|---|---|---|---|---|---|---|
| [ProfileForm.tsx:41](../../components/agent/ProfileForm.tsx#L41) | Save profile | success | `Profile updated` | `Sign out and back in for your new email to take effect.` (only when email changed) | conditional | ✓ |
| [TeamManagement.tsx:62](../../components/agent/TeamManagement.tsx#L62) | Remove team member | info | `{memberName} removed from team` | — | name | ✓ |
| [TeamManagement.tsx:83](../../components/agent/TeamManagement.tsx#L83) | Invite team member | success | `Invite sent` | `{name}` | name | ✓ |
| [TeamManagement.tsx:91](../../components/agent/TeamManagement.tsx#L91) | Resend invite | success | `Invite resent` | — | — | ✓ |
| [TeamManagement.tsx:94](../../components/agent/TeamManagement.tsx#L94) | Resend failed | error | `{server msg}` | — | msg | ✓ |
| [TeamManagement.tsx:103](../../components/agent/TeamManagement.tsx#L103) | Cancel invite | info | `Invite for {memberName} cancelled` | — | name | ✓ |
| [TeamManagement.tsx:105](../../components/agent/TeamManagement.tsx#L105) | Cancel failed | error | `{server msg}` | — | msg | ✓ |
| [InviteDirector.tsx:53](../../components/agent/InviteDirector.tsx#L53) | Send director invite | success | `Invite sent to {email}` | — | email | ✓ |
| [InviteDirector.tsx:178](../../components/agent/InviteDirector.tsx#L178) | Resend director invite | success | `Invite resent` | — | — | ✓ |
| [InviteDirector.tsx:180](../../components/agent/InviteDirector.tsx#L180) | Resend failed | error | `{server msg}` OR `Couldn't resend` | — | msg | ✓ |
| [AccountDangerZone.tsx:40](../../components/agent/AccountDangerZone.tsx#L40) | Export account data | success | `Export downloaded` | — | — | ✓ |

## Visual-only feedback (no toast — for the record)

| File:line | Trigger | Mechanism | Why no toast |
|---|---|---|---|
| [AgentShell.tsx](../../components/layout/AgentShell.tsx) refresh button | Click | Icon spins (`agent-spin` keyframe) for 300ms minimum hold | Toast would be noisy for an action users hit often |

## System preview (dev-only — `/agent/system-preview/toasts`)

This page is a reference for designers; strings should mirror production wording.

| File:line | Demo label | Type | String | Description | Voice |
|---|---|---|---|---|---|
| [page.tsx:141](../../app/agent/system-preview/toasts/page.tsx#L141) | Step confirmed | success | `Step confirmed` | `The seller has signed and returned their contract documents` | ✓ |
| [page.tsx:143](../../app/agent/system-preview/toasts/page.tsx#L143) | Step confirmed (implied) | success | `Mortgage offer received` | `+2 implied steps also confirmed` | ✓ |
| [page.tsx:145](../../app/agent/system-preview/toasts/page.tsx#L145) | File created | success | `File created` | `14 Elmwood Avenue, Bristol` | ✓ |
| [page.tsx:147-151](../../app/agent/system-preview/toasts/page.tsx#L147) | To-dos + Note | success | (mirrors production) | — | ✓ |
| [page.tsx:153](../../app/agent/system-preview/toasts/page.tsx#L153) | Invite sent | success | `Invite sent to James Whitmore` | `They'll receive an email shortly` | ✓ |
| [page.tsx:155](../../app/agent/system-preview/toasts/page.tsx#L155) | Email sent | success | `Email sent to James Whitmore` | — | ✓ |
| [page.tsx:157](../../app/agent/system-preview/toasts/page.tsx#L157) | With Undo action | success | `To-do removed` | (action button: Undo) | ✓ |
| [page.tsx:161](../../app/agent/system-preview/toasts/page.tsx#L161) | Step undone | success | `Step undone` | `+2 downstream steps also undone` | ✓ |
| [page.tsx:163](../../app/agent/system-preview/toasts/page.tsx#L163) | Sale withdrawn (with Undo) | success | `Sale withdrawn` | (action button: Undo) | ✓ (demo only — Undo isn't wired in production) |
| [page.tsx:167](../../app/agent/system-preview/toasts/page.tsx#L167) | Profile updated | success | `Profile updated` | — | ✓ |
| [page.tsx:175-181](../../app/agent/system-preview/toasts/page.tsx#L175) | Info samples | info | `Invite resent` / `Draft saved` / `Preferences saved` / `Invite sent to james@agency.co.uk` | — | ✓ |
| [page.tsx:189-193](../../app/agent/system-preview/toasts/page.tsx#L189) | Warning samples | warning | `Mortgage offer expires in 14 days` / `No activity on this file for 9 days` / `Connection unstable` | — | ✓ |
| [page.tsx:201-207](../../app/agent/system-preview/toasts/page.tsx#L201) | Error samples | error | `Couldn't save your changes` / `Couldn't send invite` / `Something went wrong` / `You don't have permission to do that` | — | ✓ |
| [page.tsx:219-221](../../app/agent/system-preview/toasts/page.tsx#L219) | Stack: 3 at once | mixed | `Step confirmed` / `Portal invite sent` / `Mortgage offer expires in 14 days` | — | ✓ |
| [page.tsx:225-229](../../app/agent/system-preview/toasts/page.tsx#L225) | Stack: 5 at once | mixed | `To-do completed` / `Note added` / `Draft saved` / `No activity for 9 days` / `Something went wrong` | — | ✓ |
| [page.tsx:232](../../app/agent/system-preview/toasts/page.tsx#L232) | Persistent | error | `Session expired` | (action button: Sign in, duration: ∞) | ✓ |

### Second preview page — `/agent/system-preview` (inline `StaticToast` samples)

Separate from the `/agent/system-preview/toasts` page above. Same intent: a visual reference, strings should mirror production wording.

| File:line | Surface | Type | String | Description | Voice |
|---|---|---|---|---|---|
| [system-preview/page.tsx:116](../../app/agent/system-preview/page.tsx#L116) | StaticToast | success | `Step confirmed` | `Vendor and purchaser notified` | ✓ |
| [system-preview/page.tsx:117](../../app/agent/system-preview/page.tsx#L117) | StaticToast | info | `Portal invite sent` | `Client will receive an email shortly` | ✓ |
| [system-preview/page.tsx:118](../../app/agent/system-preview/page.tsx#L118) | StaticToast | warning | `Mortgage offer expires in 14 days` | — | ✓ |
| [system-preview/page.tsx:119](../../app/agent/system-preview/page.tsx#L119) | StaticToast | error | `Couldn't save your changes` | `Please try again` | ✓ |
| [system-preview/page.tsx:448-451](../../app/agent/system-preview/page.tsx#L448) | StaticToast palette demo | mixed | `Transaction created` / `Failed to save` / `Exchange in 2 days` / `Portal invite sent` | various | ✓ |

---

## Non-conformant strings (currently shipped)

*No non-conformant production strings as of 2026-05-23.* The four previously flagged here (`Communication logged`, ChainDrawer hardcoded `1 invite sent`, two NewSaleFlow trailing-period strings) were fixed in the same PR that introduced this registry.

When flagging a new one in future: add a row here with the file:line, the rule it breaks, and a suggested fix. When the fix lands, move the row into its surface table marked ✓.

---

## Maintenance

- When adding a new toast: add the row to the relevant table above, in the same commit as the code change.
- When editing an existing string: update the row here, in the same commit.
- When flagging a violation for future cleanup: add it to the non-conformant table above with the rule it breaks.
- When fixing a flagged violation: move the row from the non-conformant table into its surface table with `✓`.
