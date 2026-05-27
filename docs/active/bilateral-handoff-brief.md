# Bilateral hand-off — design brief (v2, reframed)

> Status: design phase, no code yet. Supersedes the earlier "cross-side suppression" brief. The concept changed materially in review with Ellis (2026-05-27) — it is no longer "suppress emails," it is "hand the baton to the other side." Read §1 carefully; the reframe changes the whole shape.

---

## 1. What this actually is (the reframe — read this first)

The earlier brief framed this as *suppression*: when one side confirms a milestone, stop sending the automated chase email to the other side. That framing was wrong, and the word "suppress" should not be used going forward — it misleads.

The real feature is a **hand-off**. Many milestones are the same real-world event seen from two sides (seller's solicitor *issues* the draft contract pack; buyer's solicitor *receives* it). Today, when one side confirms, the system keeps firing **automated nag emails** at the other side ("you still haven't confirmed X — chase your solicitor"). From the recipient's inbox this reads as nagging about something they didn't know was their turn yet.

What Ellis wants instead: when side A confirms, the comms **hand the baton to side B** —

1. **Replace the nag with a nudge.** Side B's *automated chase* email stops. In its place, side B gets a *good* email: "[the other side] has confirmed X — here's your next step," nudging them to their portal.
2. **A pulsing confirm button waits for them.** On side B's portal — both the dashboard/overview and the progress page — the relevant confirm button **gently pulses** to draw the eye to it. Pressing it confirms side B's milestone and unlocks the next step, the same way confirms already cascade.
3. **Side B still confirms independently** — the data is real, both sides genuinely happen. No auto-confirm. (This is the opposite of the existing `BILATERAL_PAIRS` auto-confirm — see §7, critical.)
4. **The comms read like a story.** Each email is phrased *true to who confirmed and who's reading it* — never a generic blast. This is the trust mechanism of the product; the copy matrix in §4 is the heart of the feature, not a detail.

Net result: clients get one well-phrased message per real-world event, the other side is *guided* to their next action rather than nagged about it, momentum reads as a coherent narrative, and agents still track both sides.

**Terminology:** call this "hand-off," never "suppression." The only thing that stops is the *automated nag*; everything else is additive.

---

## 2. Scope — this is a two-surface feature, deliberately big

This spans BOTH the agent app and the buyer/seller portal. Ellis has explicitly accepted the size ("as big as it needs to be"). Do not try to keep it small.

- **Agent app:** the confirm action no longer fires the automated chase to the other side; fires the hand-off email instead.
- **Portal:** the opposite side's confirm button pulses (overview + progress page), pressing it confirms and unlocks the next milestone.
- **Comms:** a phrased email matrix (§4) covering every confirmer × reader combination.

---

## 2.5 Deliverable order — hard gate (added 2026-05-27)

Ellis has set a strict workflow for this feature. The next session **must produce these three artifacts in order, with explicit sign-off between each**. Each is a distinct deliverable; do not bundle them. Do not skip ahead.

### Artifact 1 — Per-pair hand-off directions

A short document listing each of the five IN pairs (§3) with the proposed natural first-actor and therefore the hand-off direction (e.g. "VM12 → PM15: seller's sol issues, buyer's sol reads. Direction: vendor → purchaser"). One paragraph of rationale per pair, drawn from the actual milestone copy in `prisma/seed.ts`. **No copy, no implementation, no schema.** Present the five pairs for Ellis to approve one by one.

→ **HARD GATE: wait for Ellis sign-off on directions before starting Artifact 2.**

### Artifact 2 — Standalone email copy document

A single document containing the **verbatim text of every email this feature sends** as it will land in the inbox. Not summarised, not "something like," not paraphrased. For each of the five pairs, every cell in the matrix:

- **Six confirmer paths** (per §4):
  1. Agent self-progressing, seller-side confirm
  2. Agent self-progressing, buyer-side confirm
  3. Sales Progressor / admin (outsourced), seller-side confirm
  4. Sales Progressor / admin (outsourced), buyer-side confirm
  5. Buyer via portal
  6. Seller via portal
- **Every reader** for each confirm: the side that acted, the opposite side being handed the baton, plus any FYI recipients (agent, progressor, vendor-agent-portal etc.) per the existing per-recipient matrix in `docs/milestone-email-matrix/`.
- **Before/after** for every cell that replaces an existing automated chase — show the chase text that goes away and the hand-off text that takes its place, side by side, so the comms swap is auditable.
- **Subject line + body verbatim** for each email; address-token interpolation indicated with `{address}` etc., but everything else fully written out.
- **Voice per `VOICE_GUIDELINES.md`**, portal-calibration for client-facing copy (calmer, plainer, more reassuring than agent copy).

Ellis reviews the document for voice and correctness **in full** before any code is written. The copy is the trust mechanism of the product — it is not a sub-section of the implementation plan, it is its own artifact and its own sign-off.

→ **HARD GATE: wait for Ellis sign-off on the email copy document before starting Artifact 3.**

### Artifact 3 — Implementation plan

The full implementation plan per the original §10 handoff prompt: pair-map constant file, schema migration, server touchpoints (confirm action, reminder eval, undo), portal pulse touchpoints, staging verification list, out-of-scope list. The copy is referenced (and any string IDs / template keys named) but not duplicated here — Artifact 2 is the source of truth for copy.

→ Plan goes through `ExitPlanMode` for approval as normal. Only then does code begin.

**Why the gates exist:** Ellis's review bandwidth on email copy is the rate-limiting step for this feature, and the copy choices ripple through schema (e.g. how many template variants we need a `kind` column to distinguish) and UI (e.g. what state the pulse renders against). Reviewing copy in isolation, with a clean mind, is materially different from reviewing it buried inside a 600-line plan. Respect the gate.

---

## 3. The pairs (DECIDED)

Five high-confidence pairs are IN. VM9/PM12 is explicitly OUT. The two existing exchange/completion pairs are untouched (different mechanism — §7).

| Vendor code | Purchaser code | Real-world event | In v1? |
|---|---|---|---|
| **VM7** Seller's sol issued draft contract pack | **PM7** Buyer's sol received draft contract pack | The contract pack moves seller's sol → buyer's sol | **IN** |
| **VM10** Seller's sol received initial enquiries | **PM14** Buyer's sol raised initial enquiries | Initial enquiries in flight | **IN** |
| **VM12** Seller's sol issued initial replies | **PM15** Buyer's sol received initial replies | Initial replies in flight | **IN** |
| **VM13** Seller's sol received further enquiries | **PM17** Buyer's sol raised further enquiries | Further enquiries in flight | **IN** |
| **VM15** Seller's sol issued further replies | **PM18** Buyer's sol received further replies | Further replies in flight | **IN** |
| **VM9** Seller's sol received mgmt pack | **PM12** Buyer's sol received mgmt pack | **TWO SEPARATE DELIVERIES** | **OUT** |
| VM19 / PM26 (exchange), VM20 / PM27 (completion) | | | **untouched — existing auto-confirm, do not change** |

**Why VM9/PM12 is OUT (Ellis decision, recorded):** these are NOT the same event. VM9 is the seller's solicitor receiving the management pack *from the managing company*. PM12 is the buyer's solicitor receiving it *from the seller's solicitor*. Two distinct deliveries. Critically, the buyer-side delivery (PM12) is exactly the kind of step that quietly stalls and gets missed in real transactions — so keeping its **chase live** (not handing it off) is a *feature*: it keeps attention on a thing that needs watching. Do not include it. Its existing chase rule stays as-is.

### Per-pair hand-off DIRECTION — next session proposes, Ellis signs off

The hand-off has a direction: which side typically acts first, so the other side is the one nudged. This is NOT assumed symmetric. The natural actor differs per pair — e.g. for the enquiries pairs the **buyer's** side often *raises* first (PM14) and the seller's side *receives* (VM10), so the hand-off would run buyer→seller there; for the pack/replies pairs the seller's side *issues* first.

**Task for the next session:** for each of the five IN pairs, read the actual milestone copy in `prisma/seed.ts`, propose the natural first-actor and therefore the hand-off direction, and present the five with proposed directions for Ellis to approve one by one. Also handle the genuine edge case where the "wrong" side confirms first (data model should cope, but the common direction drives the default copy).

---

## 4. The comms matrix — the heart of the feature

This is where "get it right" lives. The email must read true to **who confirmed** and **who's reading**. Ellis wants it to read like a beautiful story of momentum, never a generic blast.

### Who can confirm (CORRECTED — the earlier brief had this wrong)

Four confirm paths, plus the two portal paths:
1. **Agent self-progressing** — confirms on the seller's side
2. **Agent self-progressing** — confirms on the buyer's side
3. **Sales Progressor / admin** — confirms on an outsourced file, seller's side
4. **Sales Progressor / admin** — confirms on an outsourced file, buyer's side
5. **Buyer confirms** their own milestone via their portal
6. **Seller confirms** their own milestone via their portal

### The phrasing rule

Two axes drive the wording:

**(a) To the side that just acted** — phrasing depends on whether *they themselves* confirmed it or it was confirmed *for them*:
- If the **client themselves** confirmed via portal (paths 5/6): "Thanks — you've confirmed [X]." (first-person, they did it)
- If the **agent or Sales Progressor** confirmed on their behalf (paths 1–4): "We've recorded that your solicitor has [X]." (NOT "you confirmed" — they didn't click it; that would read false)

**(b) To the opposite side** — the nudge, largely stable regardless of who confirmed on the acting side: "[The other side] has confirmed [X] — here's your next step," + portal nudge, + the pulsing button waiting. To the opposite side, *who clicked* on the acting side barely matters; *what happened and what's now theirs* is what matters.

**Deliverable for the next session:** the full copy set is **Artifact 2** in §2.5 — a STANDALONE document, NOT a sub-section of the implementation plan. See §2.5 for the spec (every confirmer-path × every reader, verbatim text, before/after for chase replacements). It exists to be reviewed in isolation with a clean mind. Cross-check against the existing per-recipient matrix in `docs/milestone-email-matrix/`. Voice per `VOICE_GUIDELINES.md` (portal calibration: calmer, plainer, more reassuring than agent copy).

**Also confirm the other milestones still read correctly** under these confirm paths — Ellis flagged that the phrasing logic shouldn't break the non-bilateral milestones' existing emails. Verify the new phrasing logic is scoped to the bilateral pairs and doesn't regress everything else. (Note this verification in the Artifact 3 plan, but the proof lives in the Artifact 2 doc — by showing that non-bilateral milestones' existing copy is untouched.)

---

## 5. The pulsing confirm button (portal — new behaviour)

When side B has been handed the baton, its confirm button pulses to draw the user to it.

- **Portal dashboard / overview:** the confirm button pulses **only if it's the milestone currently surfaced on the overview**. If a *different* milestone is showing on overview, that one behaves normally (no pulse). I.e. the pulse is reserved for the handed-off bilateral milestone when it's the one on show.
- **Portal progress page:** the bilateral milestone's confirm button gently pulses to bring the user to it. Pressing it confirms and unlocks the next milestone (same cascade as any confirm).
- **Reduced-motion fallback (required):** a pulsing button is motion. Under `prefers-reduced-motion: reduce`, replace the pulse with a non-motion emphasis (a static highlight ring / accent) so it still draws the eye without animating. Honour the existing reduced-motion contract — do not ship a pulse with no fallback.
- The pulse is "gentle" — a calm draw-the-eye, not an alarm. This is an anxious client mid-house-move, not a power user; the motion should reassure, not nag.

---

## 6. What stays true / what the agent sees

- Agents still track both sides. The handed-off side does NOT vanish from the agent's view — it just stops *client-nagging*. Decide (next session) how the handed-off-but-unconfirmed side surfaces to the agent: a calm "awaiting other side — baton handed" state. **Open concern carried from review:** a handed-off side that *never* re-escalates could be forgotten if the client never presses the pulsing button. Consider whether, after a long delay (e.g. 10+ days unconfirmed), it re-surfaces to the *agent* internally (not a client nag) so a genuinely stalled side isn't lost. Propose a recommendation.
- The existing exchange/completion auto-confirm pairs (VM19/PM26, VM20/PM27) are a DIFFERENT contract and are untouched.

---

## 7. CRITICAL — do not collide with existing `BILATERAL_PAIRS`

There is already a constant `BILATERAL_PAIRS` in `app/actions/milestones.ts` doing the **opposite** thing: it **auto-confirms** the matching side (confirm VM19, PM26 completes automatically). This new hand-off feature must **never auto-confirm** — both sides confirm independently; it only changes *comms* and adds the *pulsing nudge*.

Same word, opposite behaviour. If these share a name or file, someone will later wire auto-confirm where hand-off was intended and a buyer-side milestone will silently self-complete. **Use a distinct, clearly-named constant/file** (e.g. `lib/milestone-handoff-pairs.ts`) and leave a comment in both places explaining the two concepts are different. This is the single highest-risk part of the build.

---

## 8. Open questions for the next session to resolve (with Ellis where flagged)

1. **Per-pair hand-off direction** — propose for each of the 5, Ellis signs off one by one (§3).
2. **Full comms matrix** — write the (confirmer-path × reader) copy for each pair (§4); the heart of the work.
3. **Pulsing button** — implement overview-conditional pulse + progress-page pulse + reduced-motion fallback (§5).
4. **Agent visibility of a handed-off side** — calm "awaiting other side" state; recommend whether it re-surfaces to the agent after a long delay so a stalled side isn't lost (§6).
5. **Where the pair map + direction live** — a distinct constant file, NOT the existing `BILATERAL_PAIRS` (§7).
6. **Confirm-time mechanics** — where in `confirmMilestoneAction` the hand-off email replaces the chase; what other side-effects (push, retention, chain notifications) should change vs stay.
7. **Reminder-engine mechanics** — where in `evaluateTransactionReminders` the chase is replaced by the hand-off state; confirm `autoCompleteRemindersForMilestone` handles it cleanly.
8. **Schema** — likely a flag on the completion/log to record "handed off" for audit + to drive the portal pulse + the agent state. Propose.
9. **Undo** — if side A is reversed after handing the baton, the hand-off (and the other side's pulse) must lift. `reverseMilestoneAction` needs to handle un-hand-off.
10. **Don't regress non-bilateral milestones** — confirm the new phrasing logic is scoped to the pairs only.

---

## 9. Out of scope (v1)

- VM9/PM12 (decided OUT — keeps its own chase, §3).
- Touching the exchange/completion auto-confirm contract (§7).
- Re-litigating the 47 milestone codes (settled).
- Per-agency overrides of which pairs hand off (overkill at current scale).

---

## 10. Handoff prompt for the next session

> You are picking up a feature design for the Sales Progressor estate-agency app (Next.js / Prisma / Supabase). Repo root: `c:\Users\ellis\Downloads\Sales Prog App\full`.
>
> The feature is **"Bilateral hand-off"** — the full v2 brief is at `docs/active/bilateral-handoff-brief.md`. Read it in full first. Note it REPLACES an earlier "suppression" brief; the concept changed — it is "hand the baton to the other side," not "suppress emails."
>
> **Critical: the workflow is gated.** §2.5 of the brief sets three artifacts in strict order, each with explicit Ellis sign-off before the next begins:
>
> 1. **Artifact 1 — Per-pair hand-off directions.** For each of the 5 IN pairs (§3), read the milestone copy in `prisma/seed.ts`, propose the natural first-actor and hand-off direction, with one paragraph of rationale per pair. **NO copy, NO implementation, NO schema in this artifact.** Present the five pairs for Ellis to approve one by one. VM9/PM12 is OUT — do not include it. → **STOP and wait for Ellis sign-off.**
>
> 2. **Artifact 2 — Standalone email copy document.** A single document with the verbatim text of every email this feature sends, for every (confirmer-path × reader) cell, with before/after for every cell that replaces a chase. Six confirmer paths × per-pair readers. Subject + body fully written out (not summarised, not paraphrased). Voice per `VOICE_GUIDELINES.md`, portal calibration. This is the trust mechanism of the product — it is its own artifact and its own sign-off, NOT a sub-section of the implementation plan. Cross-check against `docs/milestone-email-matrix/` to confirm non-bilateral milestones aren't regressed. → **STOP and wait for Ellis sign-off.**
>
> 3. **Artifact 3 — Implementation plan.** Only after copy is signed off. Pair-map constant file (DISTINCT from existing `BILATERAL_PAIRS` — see §7), schema migration, server touchpoints (`confirmMilestoneAction`, `evaluateTransactionReminders`, `reverseMilestoneAction`), portal pulse spec (overview-conditional + progress-page + reduced-motion fallback, §5), agent visibility of handed-off-but-unconfirmed side (§6), open questions from §8 resolved with concrete recommendations, staging verification list, out-of-scope list. Reference copy by template ID; don't duplicate it (Artifact 2 is the source of truth). Goes through `ExitPlanMode`.
>
> Do NOT write code at any stage. Deliverable for each artifact is the artifact itself; nothing more. Do NOT skip ahead — even if Artifact 2 feels close to done while writing Artifact 1, finish 1 and gate first.
>
> Constraints: staging→prod migration discipline; single source of truth for the pair map; never conflate with `BILATERAL_PAIRS` (§7 — same word, opposite behaviour, highest-risk part of the build); pre-launch (~5 test users) so liberal with schema, conservative with backwards-compat plumbing; honour the reduced-motion contract on the pulse.
>
> First action: read the brief end to end, then ask any genuine clarifying question before starting Artifact 1.
