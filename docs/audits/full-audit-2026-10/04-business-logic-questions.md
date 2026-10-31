# Business Logic Clarification Register

Batch 1 — raised 2026-10-20 at the end of Phase 1. Ordered by impact. Decisions recorded here become confirmed business rules.

---

## BL-001 — What should happen to queued client emails when an exchange is undone?

**What TSP currently does:** When contracts exchange, congratulation and notification emails to the seller, buyer and chain are queued to send a little later (to avoid odd hours). If the exchange is undone before they send, they still go out. (Finding MILE-002.)

**What is unclear:** Cancelling the queued emails is clearly needed. The open business question is whether cancelling is *enough*.

**Real-world example:** A progressor fat-fingers "contracts exchanged" on 12 Oak Lane at 7pm and undoes it two minutes later. The queued emails are still waiting for the morning send window.

**My question:** When an exchange (or completion) is undone, should TSP (A) just cancel anything queued and not yet sent, or (B) also send a correction ("that update was sent in error") to anyone who already received the exchange email before the undo?

**What each answer means:** A is simple and silent — but anyone emailed in the gap believes they've legally exchanged. B protects clients from acting on wrong information but means admitting the mistake automatically.

**Who this affects:** Sellers, buyers, chain contacts, solicitors.

**My decision (2026-10-31):** A — cancel anything not yet sent, no correction email. Rationale from founder: an exchange has never been cancelled in practice, so the correction path isn't worth building. CONFIRMED RULE: undo cancels queued exchange emails (already live); no "sent in error" correction is sent to anyone who already received one.

**What needs testing afterwards:** undo-before-drain cancels queued rows.

---

## BL-002 — If a sale's service type is switched after exchange, which fee applies?

**What TSP currently does:** A sale that has exchanged but not completed can still be switched between self-managed and outsourced. The month's draft invoice then recalculates from the *current* type — so switching outsourced→self-managed after exchange removes the £250–£350 fee; the reverse adds one. (Finding BILL-001.)

**My question:** Should the fee be locked to whatever the service type was *at the moment of exchange*, regardless of later switches?

**Possible answers:** (A) Yes — snapshot the service type at exchange, like the price already is. (B) No — the latest type before the invoice is issued wins. (C) Block service-type switches entirely once exchanged.

**What each answer means:** A matches how price is already handled and prevents accidental fee wipes. B lets a genuine "we mislabelled this file" correction fix the bill, but also lets a switch silently remove a legitimate fee. C is the bluntest and safest but removes a correction tool.

**Who this affects:** TSP revenue; agencies' invoices.

**My decision:** _(blank)_

---

## BL-003 — If the "first outsourced sale free" exchange is undone, does the agency get the freebie back?

**What TSP currently does:** The free flag is granted at exchange. If that exchange is reversed, the billing stamps are cleared but the free flag isn't cleaned up; what happens when the same or a different sale later exchanges first is untested. (Finding BILL-002.)

**Real-world example:** Agency's first outsourced sale exchanges (free), then falls through a week later. Their next outsourced sale exchanges a month on.

**My question:** Should the free offer be "returned" so the next sale to actually exchange gets it?

**Possible answers:** (A) Yes — free follows the first exchange that *sticks*. (B) No — the offer is consumed by the first exchange event even if it falls through.

**Who this affects:** TSP revenue; agency goodwill.

**My decision:** _(blank)_

---

## BL-004 — Who is allowed to undo a "not required" marking?

**What TSP currently does:** The written spec says only Directors and Progressors may undo a not-required marking; the server actually accepts it from anyone with access to the file (negotiators included). The button may be hidden in the UI, but the rule isn't enforced underneath. (Finding MILE-005.)

**My question:** Is the spec rule (Directors/Progressors only) still what you want?

**Possible answers:** (A) Yes — enforce it on the server. (B) No — any team member on the file may undo NR; update the spec.

**My decision:** _(blank)_

---

## BL-005 — Which steps may be marked "not required": the spec's list or the code's list?

**What TSP currently does:** Code allows marking not-required: survey (PM9) and deposit (PM24) always, searches (PM8) for cash buyers only. The spec and the database seed disagree about PM8 and PM24, and the code carries a comment saying the conflict was parked. (Finding MILE-006.)

**My question:** For each of PM8 (searches), PM9 (survey), PM24 (deposit) — who should be able to mark it not required, and under which purchase methods?

**My decision:** _(blank)_

---

## BL-006 — When the contract-pack step is skipped, how should the buyer side recover?

**What TSP currently does:** If "draft contract pack issued/received" (VM7/PM7) is never confirmed, every later buyer step stays locked forever. The nightly self-heal job cannot fix this — it can only unlock steps whose prerequisites are complete, never complete a skipped step. Today the only cure is a human confirming the pack step. (Finding MILE-003.)

**My question:** If a progressor confirms a *later* buyer step's real-world event (say, searches ordered) while the pack step is unconfirmed, what should happen?

**Possible answers:** (A) TSP automatically completes the pack step as "implied" (with a note), unblocking the chain. (B) TSP refuses and tells them to confirm the pack step first (current behaviour, but make the message/UI clearly guide them). (C) Allow out-of-order confirmation without completing the pack step, leaving it visibly outstanding.

**What each answer means:** A keeps files moving but can mark something complete that never happened (and may send the pack-step client emails). B is safest but relies on the human understanding why they're blocked — the current stranding suggests they don't. C keeps the record honest but complicates the dependency model.

**Who this affects:** Progressors, agents, clients (their portal shows the stuck step).

**My decision (2026-10-31):** Leave — no change. Founder states the contract-pack step cannot be skipped in practice; the dependency is correct conveyancing and the steps are fine as built. CLOSED as working-as-intended. Audit to re-verify during Journey B (imported mid-conveyancing file) that import can never land a file past VM7/PM7 with those steps unconfirmed; if it can, reopen.

---

## BL-008 — Should the predicted exchange date move forward on its own?

**What TSP currently does:** Two behaviours exist at once (finding DATA-003). The agent file-page sidebar recomputes the prediction from "today", so every quiet day pushes it one day later. Every other screen (files list, timeline strip, hub, client portal) shows a stored date that only changes when a milestone is confirmed. The same file can show two dates ten days apart.

**My question:** Which behaviour is right? (A) The date should drift: no progress means a later exchange, recomputed daily everywhere. (B) The date should hold steady between milestone events: it only moves when something actually happens. (C) Keep a fixed date but show a separate "slipping" warning when the file has been quiet.

**What each answer means:** A is the most honest but means clients watch their date get later daily with no explanation. B is stable but can silently understate delay. C keeps the date stable and makes the slippage explicit (a slip banner already exists on the overview).

**Who this affects:** Agents, progressors, clients (portal), hub forecasting.

**My decision (2026-10-20):** A — the drift is intended ("predicted exchange shifts with the pace of the sale"); the bug was that only the sidebar showed it. CONFIRMED RULE: all surfaces must show the same self-adjusting prediction. Shipped: nightly refresh of the stored column (`297efa75`), finding DATA-003 closed.

---

## BL-009 — Which progress percentage should a client see?

**What TSP currently does:** The portal's front page shows the whole sale's progress (both sides pooled); the Progress tab shows only the viewer's own side. A seller can read 60% on one tab and 80% on the next (finding DATA-002).

**My question:** Should the client portal show (A) the overall figure everywhere, (B) their own side's figure everywhere, or (C) both, clearly labelled ("your side" / "whole sale")?

**My decision (2026-10-20):** Intentional as built — overall on the Overview, per-side on the Progress tab. CONFIRMED RULE. Finding DATA-002 closed as working-as-intended (no change).

---

## BL-007 — Should TSP block adding the same property twice to one chain?

**What TSP currently does:** Nothing prevents two placeholder entries for the same address in one chain; both can be invited, one claimed while the stale one lingers. Duplicate detection is only a suggestion at claim time. (Finding CHAIN-001.)

**My question:** When someone adds a chain link whose address matches an existing link in the same chain, should TSP (A) block it, (B) warn but allow (addresses are messy; flats, plots), or (C) keep current behaviour?

**My decision:** _(blank)_
