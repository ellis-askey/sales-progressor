# "Contracts exchanged" reminder re-tune — PLAN

**Status:** planned 2026-08-19, no changes made. Awaiting founder decision.

The two internal reminders "Contracts exchanged (seller)" (VM19) and "Contracts exchanged (buyer)" (PM26) nag too early and appear as two cards for one event. This plans a re-tune.

## Correction to an earlier claim
I previously said the seller-side reminder can fire while the buyer isn't ready. **Wrong.** `lib/services/reminders.ts:567-576` already suppresses BOTH until BOTH the seller-ready gate (VM18) and buyer-ready gate (PM25) are complete/not-required. The "both sides ready" gate already exists. What's wrong is the *timing after* both are ready, the *duplication*, and the *framing*.

## What these reminders actually are (verified)
- **Internal work-queue cards only. They email no one.** Both automated email pipelines hard-exclude VM18/VM19/PM25/PM26 (`lib/chase/chaseable-milestones.ts:24`, `lib/solicitor-confirm/codes.ts:13`). The only email is one the agent composes by hand via the Chase button.
- Fire 1 day after both-ready (grace 1), repeat every 2 days, escalate to a **web push to the file owner** after 1 chase (`push-events.ts`).
- Two separate rules → two `ReminderLog`s → two cards (one Seller column, one Buyer column) once both ready.

## Where they show
- Reminders/work-queue page (active split Seller/Buyer columns; snoozed shows the "Waiting on Seller/Buyer" pill).
- File detail → Reminders tab.
- Hub "Needs attention" (only when overdue/escalated/due-today).
- Morning digest email to internal staff — but only as an anonymous count per file ("{address}: N overdue"), never named.
- Top counts "overdue / due today / coming up" — yes, these feed them.
- **NOT** the notification bell. **NOT** the "overdue exchange" banner alert (separate, date-based). **NOT** any analytics / Command Centre metric.

## The "Waiting on Seller/Buyer" tag is misleading
It's derived purely from the milestone code prefix (VM→Seller/amber, PM→Buyer/blue) at `ReminderCard.tsx:82-87`, not from who actually owes the next move. Exchange is bilateral and solicitor/chain-driven; neither client can force it. So "Waiting on Seller/Buyer" is wrong on both counts.

## The safety net that already exists
The banner's **"overdue exchange"** count is a *date* signal (`work-queue.ts:108-117`): the file's predicted/expected exchange date has passed and it hasn't exchanged. Independent of these reminders. So a stuck exchange is already surfaced there — where the file has a target date. The reminder covers the case where no target date is set.

## Who can act
The **agent / progressor** (internal). The action is "call the solicitors / check the chain / find out what's holding it up", not "chase the client." The reframe must reflect that.

## The plan
1. **One card, not two.** Keep the seller reminder (VM19) as the single "Awaiting exchange" reminder; turn the buyer reminder (PM26) off (`isActive=false`). VM19 stays in the relist-reset sweep and auto-closes on the bilateral confirm, so no couplings break (unlike inventing a new file-level rule, which per the downwind audit breaks 5 code sites keyed on the literal codes).
2. **Anchor on the LATER gate.** In the bilateral-gate block, once both are ready, base the clock on whichever readiness landed last (max of the two gate dates), so "N days after both ready" is truthful. Today it keys off the seller gate, so a file where the seller was ready weeks ago pops the card the instant the buyer gate lands.
3. **De-tune timing:** grace 1 → ~12 calendar days (about a week and a half after both ready), repeat 2 → 7 (weekly). Raise `escalateAfterChases` 1 → 2 so it doesn't web-push the owner on first appearance.
4. **Reframe the card:** rename the rule to "Awaiting exchange"; for the exchange reminder show a neutral "Awaiting exchange" chip instead of "Waiting on Seller/Buyer" (`ReminderCard.tsx` special-case for these codes).

## Downwind — what changes, what doesn't
- **Emails:** nothing. These never emailed anyone; still won't.
- **Analytics / Command Centre / weekly review / daily brief / solicitor exchange stats:** unaffected — all measure the *actual exchange confirmation date*, not the reminder.
- **"overdue exchange" / "not progressing" banner:** unaffected — date/completion-driven, not reminder-driven.
- **`chase_unanswered` flag** (`problem-detection.ts:106`): would arrive later for the exchange step (the chase task is created ~11 days later). Natural shift, not a break.
- **"Awaiting N days" staleness badge** on the milestone tab (`milestone-staleness.ts`): keyed on the rule's grace, so it would show later on the exchange rows. With PM26's rule off, the buyer-row badge falls to default — minor.
- **Relist:** VM19 is in the relist-reset code set; PM26 off means no buyer exchange chase to strand. Safe.
- **Escalation web push:** delayed and softened (intended).

## Decisions for the founder
- A) Re-tune as above (one card, later anchor, ~12/weekly, reframed) — recommended.
- B) Just de-tune both rules (grace ~12, repeat 7) and reframe the tag, skip the one-card merge — lighter, but still two cards when it does fire.
- C) Turn both off entirely and rely on the "overdue exchange" date banner as the only exchange safety net.
- Exact numbers (grace 10 / 12 / 14; repeat 7) to confirm.
