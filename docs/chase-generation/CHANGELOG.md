# Chase Generation — Changelog

Track meaningful changes to the chase prompt, voice corpus, or related route logic here. The goal is that any future engineer (or model) reading the spec can also see *why* it looks the way it does today.

Format: most recent changes at the top. Each entry: date, author, summary, link to the relevant PR or commit.

---

## [2026-05-08]

### Added
- **Milestone glossary** at `docs/chase-generation/MILESTONE_GLOSSARY.md`. One entry per milestone (VM1–VM20, PM1–PM27). Each entry covers what the milestone tracks, what "outstanding" actually means in runtime terms, aliases the milestone is called by, and common model misframings to avoid. Motivated by PM9 ("Buyer has booked a Level 2 or Level 3 survey") being read by the model as a statement of fact — survey already booked — instead of the goal state being chased.
- **Glossary loader** at `lib/chase/milestone-glossary.ts`. Parses the glossary at module load via `fs.readFileSync`. Exports `getMilestoneContext(code)` returning four prompt-injectable fields: `tracks`, `outstanding`, `alsoCalled`, `misframings`. Returns `null` for unknown codes — callers skip the block rather than failing the request.
- **`# Milestone context` block** in the §6 user message template. Sits between `# Milestone(s) being chased` and `# Chase history`. For each milestone being chased, injects the four glossary fields so the model knows that "Buyer has booked a Level 2 or Level 3 survey" describes the *completed state*, not the current state.
- **Unit tests** at `lib/chase/__tests__/milestone-glossary.test.ts`. 24 tests covering milestone count (all 47 entries parsed), unknown-code null returns, and field-level assertions for VM7, PM6, PM9, PM11, VM18.
- **§7.3 acceptance test** — PM9 survey-booking scenario (James, WhatsApp, Friendly). Regression test for the original milestone-name misread bug.

### Changed
- **§7.1 criterion 9** updated: sign-off criterion now reads "Sign off appropriately for the channel — WhatsApp messages do not require a formal sign-off; email messages should sign off with the sender's first name per §5.1." Previous wording ("Sign off with 'Rachel'") contradicted the WhatsApp channel guidance which specifies no formal sign-off.
- **PROMPT_SPEC.md §3.3** updated with a note explaining the glossary context and referencing `lib/chase/milestone-glossary.ts` as the implementation.
- **PROMPT_SPEC.md §6** updated with the `# Milestone context` block template.
- **PROMPT_SPEC.md §6.1** updated with variable rows for `milestoneCode`, `tracks`, `outstanding`, `alsoCalled`, `misframings`.

### Acceptance tests — 2026-05-08 run results
All three scenarios tested against `claude-haiku-4-5-20251001`:
- **§7.1 Deborah (WhatsApp, Urgent, VM2 — MOS receipt):** 70 words, no emoji, 22 July surfaced, on-voice. All substantive criteria pass.
- **§7.2 Marcus (email, Polite Yet Firm, two milestones):** 142 words, both milestones covered, "On a lighter note" bridging phrase, "Kind regards, Rachel" sign-off, on-voice. Word count within the 120–160 target.
- **§7.3 James (WhatsApp, Friendly, PM9 survey booking):** 60 words, asks James "have you had a chance to book a Level 2 or Level 3 homebuyer's report yet?" — correctly treats the booking as not yet done. No confusion with lender valuation. PM9 regression confirmed fixed.

### Two tone-calibration issues filed for follow-up (not blocking this PR)
- **CP1 — Urgent tone reads as Polite-Yet-Firm.** Deborah message passes all hard criteria but uses only softeners. The Urgent modifier needs sharpening: require a factual days-outstanding statement, a direct ask on the key action, and explicit ordering (deadline first). Reference Email 12 in VOICE_CORPUS.md. Filed in `docs/active/TODO.md` as CP1.
- **CP2 — Multi-item connective phrases need register filtering.** Marcus message bridges two equal-weight milestones with "On a lighter note," which shifts register inappropriately. §4.7 connective phrase list needs neutral-only examples and an explicit exclusion of tone-shifting connectives. Filed in `docs/active/TODO.md` as CP2.

### Context
- The glossary was needed because the model was reading completed-state milestone names as present-tense facts. The fix is to inject "what outstanding means" and "common misframings to avoid" into every chase prompt, per milestone.
- Recipient-relative party naming (e.g. "your solicitor" vs "the buyer's solicitor") is documented in the glossary's default party-naming table and per-milestone notes. This is available to Ellis for future prompt integration if naming errors recur.

---

## [Unreleased]

### Added
- Initial canonical spec at `app/api/ai/generate-chase/PROMPT_SPEC.md`. Covers the system prompt, six tone modifiers, channel guidance, data boundaries, and required structural changes to the route (system-role promotion, tone-mirror guard on previous-message context, expanded context fields).
- Voice corpus at `docs/chase-generation/VOICE_CORPUS.md`. 30 anonymised real messages curated from a one-month sample of 246 outbound communications, grouped by channel and tone band.

### Context
- Spec written in response to a generated WhatsApp message that came across as accusatory ("we're completely stuck waiting on your side"). The diagnosis: previous prompt described *how to sound* but never anchored *whose side the progressor is on*. Fix is a shared "we're on their team" frame applied to all six tones, with firmness modulated per tone band.
- Acceptance test ("Deborah scenario") documented in spec §7.

---

## How to add an entry

When making any change to:

- The system prompt strings in `route.ts`
- Any tone modifier text
- The user-message template
- The data fields injected into the prompt
- The voice corpus
- The acceptance test scenarios

…add an entry under a new `## [YYYY-MM-DD]` heading with the date, what changed, and the reasoning. Real-world failure examples that motivated the change are valuable — paste them in. The corpus and spec are tools for human judgement; the changelog is how that judgement compounds over time.
