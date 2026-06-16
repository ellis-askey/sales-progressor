# Voice — Sales Progressor

The house voice for every user-facing string: emails, modals, toasts, banners, push notifications, error messages, microcopy.

**Read this before:** writing any user-facing string. Voice-pass every string against this doc before commit. See [DEFINITION_OF_DONE.md](../DEFINITION_OF_DONE.md).

Voice rules below were observed in shipped code and formalised after the 2026-06-07 em-dash ban (commit `8ad3501`). Every rule cites a real string in a real file.

---

## House voice in one paragraph

Conversational but precise. Speaks from the agent's vantage point about *their* client. Past tense for events ("the buyer has pulled out"). Forward-looking for next actions ("let us know what's next"). Passive constructions for celebratory news ("a new buyer has been secured" — not "we found"). Calm even when the message is bad. Errors apologise without blaming ("Couldn't update status, try again"). No hedging language ("kind of", "perhaps", "we think").

---

## Recurring phrases (locked)

These are the established phrasings. **Use them when the situation matches.** Reach for the established phrase before inventing.

| Phrase | Where it lives | Use for |
|---|---|---|
| **"Open the chain"** | [`chainNotifications.ts:84, 104, 124, 170, 190, 210`](../../lib/email/chainNotifications.ts) | canonical CTA in chain emails |
| **"your client"** / "your client's" | [`chainNotifications.ts:83, 103, 124`](../../lib/email/chainNotifications.ts) | relational framing in agent-to-agent emails |
| **"pulled out"** | [`chainNotifications.ts:81, 83`](../../lib/email/chainNotifications.ts), [`RelistBanner.tsx:32`](../../components/transaction/RelistBanner.tsx) | buyer withdrew |
| **"fell through"** | [`chainNotifications.ts:101`](../../lib/email/chainNotifications.ts), [`StatusControl.tsx:37, 42`](../../components/transaction/StatusControl.tsx) | onward purchase withdrew / file failed |
| **"let us know"** | [`chainNotifications.ts:84, 104, 124`](../../lib/email/chainNotifications.ts) | request a follow-up |
| **"Chain update:"** | [`push-events.ts:157–163`](../../lib/agent/push-events.ts) | push-notification prefix for chain events |
| **"We'll"** | [`RelistFileModal.tsx:448–450`](../../components/transaction/RelistFileModal.tsx), [`StatusControl.tsx:445`](../../components/transaction/StatusControl.tsx) | platform-action verb. **Never** "the system will" or "automatically". |

---

## Banned (do not ship)

| Banned | Why | Lives at |
|---|---|---|
| **Em dashes in prose** | Banned 2026-06-07 (commit `8ad3501`). Replace with comma, colon, or full stop. | enforced in cascade emails; pre-ban comments at [`RelistFileModal.tsx:10`](../../components/transaction/RelistFileModal.tsx), [`ArchivedRoundDrawer.tsx:46`](../../components/transaction/ArchivedRoundDrawer.tsx) |
| **Exclamation marks** | Zero in shipped client-facing copy. Voice is calm — never enthusiastic. | comment at [`chainNotifications.ts:34`](../../lib/email/chainNotifications.ts) |
| **System self-references** ("the system", "the platform", "automatically") | Direct "we'll" instead. The platform is a participant, not a third party. | comment at [`chainNotifications.ts:31–34`](../../lib/email/chainNotifications.ts) |
| **"round"** as user-facing noun | Replaced with "sale" in 2026-06-04 terminology sweep. Internal data shape can still say `round`; UI strings say `sale`. | [`NewBuyersToAcknowledgeView.tsx:94`](../../components/hub/NewBuyersToAcknowledgeView.tsx) |
| **Titles (Mr./Mrs./Miss/Dr.)** | Stripped from rendered names via `TITLE_RE` regex. People are referred to by name. | [`ArchivedRoundDrawer.tsx:150`](../../components/transaction/ArchivedRoundDrawer.tsx) |
| **"delete"** in user-facing strings | Replaced with "remove". Soft. | [`chainNotifications.ts:453`](../../lib/email/chainNotifications.ts) |
| **Technical codes** (status-machine enums, milestone IDs) | Surface plain English; never raw enum values. | observed across every voice-pass |
| **Hedging language** ("kind of", "perhaps", "we think", "should be") | Voice is direct. If we don't know, we apologise and ask. | enforced verbally |

### Em-dash ban scope

The ban is **on prose** (banner copy, modal copy, email body text). Email **subject lines** still use em-dash as a pattern separator ("Update on {address} — the buyer has pulled out"). This is the established subject-line pattern across chain emails — keep it consistent rather than re-deciding per email.

### Known outlier

`Chased — next in {n} days` toast at [`RemindersSection.tsx:731`](../../components/reminders/RemindersSection.tsx) still has an em-dash separator. Survived the prose sweep because it's a toast, not chain copy. Grandfathered — do not refactor as a side effect.

---

## Casing rules

### Email subjects — sentence case

- ✅ `Update on {address} — the buyer has pulled out` ([`chainNotifications.ts:81`](../../lib/email/chainNotifications.ts))
- ✅ `Still waiting on {address}?` ([`chainNotifications.ts:207`](../../lib/email/chainNotifications.ts))

### Banner titles — sentence case, terminal period

- ✅ `This sale fell through.` ([`RelistBanner.tsx:32`](../../components/transaction/RelistBanner.tsx))
- ✅ `This file is on hold.` ([`OnHoldBanner.tsx:16`](../../components/transaction/OnHoldBanner.tsx))

### Modal titles — imperative, no period

- ✅ `Mark as withdrawn` ([`StatusControl.tsx:301`](../../components/transaction/StatusControl.tsx))
- ✅ `Put file on hold` ([`StatusControl.tsx:439`](../../components/transaction/StatusControl.tsx))
- ✅ `Relist this sale` ([`RelistFileModal.tsx:282`](../../components/transaction/RelistFileModal.tsx))

### Toast labels — terse, sentence case

- ✅ `File active` · `File on hold` · `Client emails resumed` · `Chase sent` · `Chain claimed` · `File created`

### Eyebrows / section labels — UPPERCASE, letter-spaced

- ✅ `CARRIES OVER` · `STARTS FRESH` ([`RelistFileModal.tsx:714, 732`](../../components/transaction/RelistFileModal.tsx))

### Push titles — colon-split: title-cased prefix + sentence continuation

- ✅ `Chain update: the buyer has pulled out`
- ✅ `Sale relisted` (no-colon variant when prefix isn't needed)
- ✅ `Exchange target: today` / `tomorrow` / `{n} days`

---

## Tone — by surface

### Banner tone (locked rule)

The colder, procedural register on `OnHoldBanner` is **deliberate**. The rule:

| Surface | Tone | Example |
|---|---|---|
| **State-freeze messages** (on-hold, paused, blocked, archived) | factual, procedural, lists what's not happening | *"All automation is frozen: no client emails, no agent reminders, no escalations."* ([`OnHoldBanner.tsx:17`](../../components/transaction/OnHoldBanner.tsx)) |
| **Forward-motion messages** (relist, exchange, complete) | warm, forward-looking, past tense for events, future tense for next steps | *"When you find a new buyer, relist the sale. The new buyer's steps start fresh, and the seller keeps everything that doesn't depend on the buyer."* ([`RelistBanner.tsx:33`](../../components/transaction/RelistBanner.tsx)) |

**Why:** state-freeze = freeze of activity → procedural language matches the state. Forward-motion = action ahead → warmer language invites the action.

### Emails

Conversational subject, warm body, single clear CTA ("Open the chain"). One paragraph for the lead, one for the follow-up, then the CTA button. Past tense for events; "we'll" for what the platform does next.

### Modals — body copy

Calm. State what will happen. If destructive, name what's lost: *"This will end the current sale. The seller's milestones carry over to the new sale, the buyer's start fresh."* No hedging, no warning emoji.

### Toasts

Terse, sentence case, no period (toasts are flash messages, not sentences). One line max.

### Errors

Apologise without blaming. *"Couldn't update status, try again"* ([`StatusControl.tsx:173`](../../components/transaction/StatusControl.tsx)) — not *"You failed to update"* or *"Something went wrong"*.

### Push notifications

Mirror the same string as the in-app notification bell ([`notifications.ts:70`](../../lib/services/notifications.ts), [`push-events.ts:214`](../../lib/agent/push-events.ts)). One source of truth per event.

---

## Locked-copy convention

Strings tagged `// LOCKED` or `// voice-passed verbatim` in code comments must **not** be paraphrased on subsequent edits. If the meaning needs to change, request a new voice pass; do not edit the wording in flight.

Pattern observed in: chain cascade strings (after commit `e009f47`), modal body copy across the buyer-round arc, RelistFileModal copy.

---

## Voice-sweep ritual

When a feature ships with multiple new user-facing strings, the voice pass is a separate commit. The flow:

1. List every new string in one place (file + line) with proposed wording.
2. Get Ellis's review — the response format is **file + line per string**, not the full diff.
3. Apply the swaps in a single commit. Subject: `voice: {arc} sweep` or similar.
4. tsc clean. Commit. PR.

This pattern ran four times in eight days during the chain arc. See [CONVENTIONS.md](../CONVENTIONS.md) for the full recipe.

---

## Inconsistencies surfaced (not yet aligned — flag, don't silently fix)

| Inconsistency | Where | Status |
|---|---|---|
| `Mark as done` vs `Acknowledge` for similar dismissal actions | [`ChainSetupPendingView.tsx:111`](../../components/hub/ChainSetupPendingView.tsx) vs [`NewBuyersToAcknowledgeView.tsx:113`](../../components/hub/NewBuyersToAcknowledgeView.tsx) | Not yet aligned. Phase 2 voice pass. |
| `Mark as withdrawn` / `Put file on hold` / `Take off hold` — three verb shapes in one component | [`StatusControl.tsx:301, 439, 520`](../../components/transaction/StatusControl.tsx) | Shipped. Phase 2 voice pass. |
| `Chased — next in {n} days` toast still has em-dash | [`RemindersSection.tsx:731`](../../components/reminders/RemindersSection.tsx) | Grandfathered (see em-dash ban scope above). |

These are flagged so future voice sweeps can resolve them deliberately, not so the next session "fixes" them mid-commit.
