# Chase generation — PROMPT SPEC

Source of truth for the AI chase-message prompt built in
`app/api/ai/generate-chase/route.ts`. The route's prompt strings are kept in step
with this file. **Edit this spec first, then the route.**

Companion docs:
- `docs/active/chase-action-derivation/00-design.md` — the deterministic ask model.
- `MILESTONE_GLOSSARY.md` — per-milestone naming + background (this folder).
- `lib/chase/action-holders.ts` / `lib/chase/derive-chase-ask.ts` — the derivation.

Model: `claude-haiku-4-5`. `max_tokens` 600 (single) / 800 (multi). No few-shot at
runtime. Output is post-processed only to strip em/en dashes.

---

## §4 The core principle (read first)

**The app decides what we are chasing and of whom. The AI only writes it up.**

Before any generation the app derives five values (`deriveChaseAsk`) and injects
them. The AI must treat `recipientAction` as authoritative: it may not infer,
expand, or replace the ask, and may not substitute a different task to make the
message feel actionable. The subject is always the selected milestone, never a
prerequisite, neighbour or follow-on.

The five injected values:

| Field | Meaning |
|---|---|
| `milestoneBeingChased` | The selected milestone, named per the glossary "How to name it" line for this recipient. |
| `actionHolderRole` | Who physically owns the step: seller / buyer / seller's solicitor / buyer's solicitor / broker / agent. |
| `recipientRole` | Who we're writing to. |
| `recipientIsActionHolder` | Whether the recipient is the party who completes the step. |
| `recipientAction` | The exact, app-decided ask for this recipient about this milestone. |

The recipient × action-holder → `recipientAction` matrix and all shapes
(ASK_DIRECT, VIA_OWN_SOLICITOR, VIA_BROKER, NOT_CHASED) live in the design doc §3.
Excluded milestones (exchange/completion notifications, the enquiries tracker) are
not AI-chased.

---

## §5 System prompt (structure)

Assembled in the route as a template. Sections, in order:

1. **Role line** — "You are writing a chase message on behalf of {senderFirstName},
   a sales progressor at {firmName}…".
2. **Framing** — the recipient is on your team, not in your way; surface the shared
   stake, never blame.
3. **The ask is decided for you (authoritative, do not override)** — the rules
   above (§4): build strictly around the ASK line; never infer/expand/replace it;
   if the ASK is to nudge their own solicitor, ask exactly that and never ask a
   client to do the legal step; keep the subject on this milestone; phrase
   naturally, never templated.
4. **Who you're writing to** — recipient-aware (`recipientGuidance`): clients get
   warm plain English with a light "why" where it helps; solicitors get concise,
   professional, no process-explaining.
5. **Voice** — warm, human, British. **Opening uses the supplied `{greeting}` word
   verbatim** (do not infer the time of day) + first name + "Hope you're well".
   Distinctive vocabulary ("just", soft modals, volunteer help, "let me know").
6. **Things you must never write** — no em/en dashes; no blame; no ultimatums; no
   corporate openers; no passive-aggressive callbacks.
7. **Confidentiality boundaries** — use context as grounding, only share what the
   recipient could appropriately be told.
8. **Channel** — email vs WhatsApp guidance (length, opener, sign-off). The
   "Good morning" example is rewritten to the supplied greeting.
9. **Tone** — the selected tone band (Friendly → Final Reminder).
10. **The progressor's own style** — learned voice profile, when present.
11. **Output format** — message body only, plain text.

---

## §6 User message (structure)

Assembled per generation, PII-minimised:

1. `# Transaction` — property reference (street line only), tenure, purchase type,
   expected exchange date (only when both exchange gates are confirmed).
2. `# Milestone(s) being chased` — name, side, days outstanding, blocks-exchange.
3. `# Milestone context` — background from the glossary: what the step is, what
   "outstanding" means, **how to name it with this recipient**, also-called,
   pitfalls. **Background only — the authoritative ask is §below.**
4. `# The ask (authoritative — build the message around exactly this)` — writing-to,
   who owns the step, whether the recipient owns it, and the `recipientAction`
   directive. For multi-milestone, one ASK line per milestone.
5. `# Legal representatives` — firm names for natural reference to the other side.
6. `# Chase history` — previous chase count, days since last contact (timing only).
7. `# Recipient` — first name, role, optional CC note.
8. `# Other parties` — role + count only (no names).

### PII deliberately NOT sent
Full address (street line only), sale price, non-recipient names, CC'd solicitor's
name, verbatim previous-message text, emails/phones/internal notes. Keep in step
with Terms §5 and the Privacy data-inventory.

---

## Diagnosability

Every generation logs its derivation (`[generate-chase] derivation`): milestone
code, recipient role, greeting, and per-milestone action-holder + shape +
recipientIsActionHolder + chaseable. Any future wrong-chase is traceable to the
derived ask, not the model.
