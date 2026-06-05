# Voice Guidelines

**Version:** 1.0 — agent pass  
**Living document:** Add to the translation table as new terms are found. Rules change only with explicit sign-off.  
**Baseline reference:** Transaction-detail Stage 3 copy, signed off 2026-05-12 — the voice baseline for every subsequent agent page. When a Stage 3 review produces a new before/after, add the pair to the relevant rule's translation table with the source file and line. The table grows; the rules do not change without Ellis's sign-off.

---

## Purpose

Estate agents are professionals managing other people's most stressful life events — moves, deaths, divorces, first homes. The app is a tool they use between viewings, usually on a phone. The voice must sound like a competent colleague, not a system reporting on its own activity. Every string that sounds like it was written by a developer looking at a schema is a string that erodes trust.

The same three rules govern the buyer/seller portal pass. See the **Portal audience note** in each rule section for where the application shifts.

---

## Rule 1: No system self-references

**Statement:** The UI never describes what it is doing internally. It states facts and outcomes in terms of what the user sees or needs to do — not in terms of system operations.

**Why it matters:** "We'll surface chases and follow-ups" implies the system is performing an act of generosity — surfacing things it has computed. The user doesn't care how it works. They want to know what they'll see. Algorithmic language creates distance.

**Before / after examples from the codebase:**

| Before | File | After |
|---|---|---|
| "Once you create a sale, we'll surface chases and follow-ups as files progress." | `app/agent/work-queue/page.tsx:82` | "Chases and follow-ups appear here as your files move forward." |
| "How your active files are being progressed" | `app/agent/hub/page.tsx:656` | "How each active file is being handled" |
| "being progressed by our team" | `app/agent/hub/page.tsx:716` | "our team is handling" |
| "Exchange must be confirmed on both sides before completion can be recorded." | `components/milestones/MilestonePanel.tsx:82` | "Both sides need to confirm exchange before you can mark completion." |

**The test:** Read the sentence and ask: "Is this describing the system's behaviour or the user's situation?" If it's the system, rewrite it as the user's situation.

**Portal audience note:** This rule applies unchanged. Portal users (buyers/sellers) are even less interested in system internals than agents. "Your purchase is being processed" → "We're on it — [specific next step]."

---

## Rule 2: No process jargon as user-facing nouns

**Statement:** Schema terms, database field names, and internal role names do not appear in the UI as nouns the user is expected to understand. They are translated.

**Why it matters:** "Outstanding milestones" means something to a developer. To an estate agent, "milestone" is a Gantt-chart concept borrowed from tech. They manage *steps*, *checks*, and *things to do*. Using schema language as UI language forces users to translate in their heads before they can act.

**Before / after examples from the codebase:**

| Before | File | After |
|---|---|---|
| "Outstanding milestones" | `components/milestones/ReconciliationDrawer.tsx:154` | "Steps not yet confirmed" |
| "they'll be marked as reconciled at exchange" | `components/milestones/ReconciliationDrawer.tsx:156` | "they'll be checked off at exchange" |
| "Milestone reversed" (toast) | `components/milestones/MilestoneRow.tsx:236` | "Step undone" |
| "+2 downstream milestones also undone" (toast description) | `components/milestones/MilestoneRow.tsx:237` | "+2 linked steps also undone" |
| "Marked not required" (toast) | `components/milestones/MilestoneRow.tsx:273` | "Skipped" |
| "Service split" | `app/agent/hub/page.tsx:654` | "Who's managing each file" |

**Translation table (living — add as new terms are found):**

| Schema / dev term | UI equivalent | Notes |
|---|---|---|
| Milestone | Step | "Steps" in labels; "step" in body copy |
| MilestoneCompletion | (step) confirmation | Not a noun agents need to see |
| Transaction | Sale / File | "Sale" for the event; "file" for the document/record |
| PropertyTransaction | Sale | Same |
| ServiceType | How it's being handled | Used in summary contexts only |
| self_managed | You're managing / Managed by you | |
| outsourced | Our team is handling | |
| progressedBy | — | Not a UI-facing concept |
| ReminderLog | Reminder | Direct |
| ChaseTask | Chase | Direct |
| ChainLink | Chain link / Linked sale | |
| SolicitorFirm | Solicitor firm | Fine as-is — industry standard |
| SolicitorContact | Solicitor contact | Fine as-is |
| agentFeeAmount | Agent fee | Fine as-is |
| purchaseType | Purchase type | Fine in label; body copy: "cash purchase", "mortgage purchase" |
| tenure | Tenure | Fine in label; body copy: "freehold", "leasehold" |
| assignedUserId / assignedTo | Assigned to | Fine in UI |
| sales_progressor (role) | Progressor / Our team | Context-dependent |
| director / negotiator (role) | (not shown to users) | Roles not surfaced in the UI |
| portal_token | — | Never surfaces |
| not_required | Skipped / Not applicable | Context-dependent |
| isVatInclusive | + VAT / inc. VAT | Already correct in the app |

**Portal audience note:** The same translations apply, with one addition: "solicitor" may need brief context on the portal ("your solicitor — the lawyer handling your purchase"). Estate agents know what a solicitor is; buyers sometimes don't. Flag these during portal pass Stage 3.

---

## Rule 3: Active, present, specific

**Statement:** Sentences describe what the user should do, or what is true right now. Not what the system has done, will do, or determined.

**Why it matters:** Passive constructions bury the action and the actor. "A reminder has been generated" answers none of the user's questions: Who generated it? What do I do with it? When? "Chase [name] — enquiries are 8 days overdue" answers all three.

**Before / after examples from the codebase:**

| Before | File | After |
|---|---|---|
| "These haven't been confirmed yet. Tick those that are done — they'll be marked as reconciled at exchange. Untick or leave a date blank to exclude." | `components/milestones/ReconciliationDrawer.tsx:156` | "Tick the steps below that are done. We'll check them off at exchange. Leave a step unticked to exclude it." |
| "Marked not required" | `components/milestones/MilestoneRow.tsx:273` | "Skipped" |
| "Milestone reversed" | `components/milestones/MilestoneRow.tsx:236` | "Step undone" |
| "Exchange must be confirmed on both sides before completion can be recorded." | `components/milestones/MilestonePanel.tsx:82` | "Both sides need to confirm exchange before you can mark completion." |

**The test:** Find the subject and verb. If the subject is the system, a process, or a record — rewrite so the subject is the user or a person.

**Portal audience note:** Active voice is even more important for buyers and sellers, who are anxious and unfamiliar with the process. "Your solicitor has been instructed" → "Your solicitor is instructed — they'll make contact shortly."

---

## What stays technical

Some terms are estate agency industry-standard. Softening them would be condescending or confusing. Do not translate these:

- Freehold / Leasehold
- Exchange / Completion
- Solicitor / Conveyancer
- Memorandum of Sale (MOS)
- EPC (Energy Performance Certificate)
- Land Registry
- Postcode
- Enquiries (as in "enquiries raised" in conveyancing)
- Stamp Duty
- Searches (as in property searches)
- Survey / Surveyor

If a term appears on this list and sounds wrong in context, flag it in Stage 3 rather than auto-translating.

---

## Tone calibration

**Audience:** Estate agency directors and negotiators. Senior, time-poor, reading on a phone between viewings. Not developers, not accountants, not first-time app users.

**Register:** Brisk and respectful. The same register as a well-run estate agency — professional, efficient, no unnecessary words.

**Specific prohibitions:**

- No exclamation marks anywhere in the UI. Not "Great!", not "Done!", not "Congratulations!"
- No "Oops!" for errors. State what happened and what to do.
- No "Hmm" or filler phrases.
- No "we're working on it" without a specific next step.
- No apologetic language for normal UI states ("We're sorry, no results were found" → "No results").

**Sentence length:** Body copy: one or two sentences maximum. Labels: as few words as possible without losing meaning. If a label needs three words, question whether it needs two.

**Tense:** Present for states ("This file is on hold"). Imperative for actions ("Confirm exchange"). Future for outcomes that follow an action ("We'll notify both parties").

### Banned openers (added 2026-06-05, agent voice sweep)

- **"Great news"** as a sentence or subject opener in agent-facing copy. Lead with the fact. Source: 3 instances caught in 2026-06-05 audit (outsource-intro, director-accepted, negotiator-accepted). If a confirmation is genuinely worth marking, name it: "Confirmed.", "Your account is ready.", "First exchange — your invoice is on its way." Not "Great news — ...".

### Banned verbs (added 2026-06-05, agent voice sweep)

- **"Surface" / "surfacing"** as user-facing verbs. They're data-pipeline jargon — "the system surfaces things it has computed". Use **show**, **flag**, **highlight**, or **appear** depending on what fits. Source: 2 instances caught in 2026-06-05 audit (director-invitation body, AutomationSettingsForm).

### Banned in agent-facing strings (added 2026-06-05, agent voice sweep)

- **No "Congratulations" / "Congrats" anywhere.** The user knows what exchange / completion means.
- **No exclamation marks anywhere.** Already listed under tone calibration; restated here so the email + push sub-sections inherit it explicitly.
- These bans apply to **agent-facing** strings (every surface listed in `docs/VOICE_AUDIT_AGENT_SURFACES.md`). The **portal-facing register** (push notifications to buyers/sellers, portal emails, portal UI) may use a deliberately warmer tone — that register is owned by the portal pass, not this doc. If you're writing copy that fires to the portal audience, follow the portal voice doc, not this one.

### Exception block — founder-signed retention emails (added 2026-06-05, agent voice sweep)

The retention email family (`lib/emails/retention/index.ts`) is signed personally by a founder ("Ellis", "Rachel") and uses a personal register: first person, contractions, warmth. That register is sanctioned. **However**, the bans on exclamation marks, slang idioms ("drop you a line", "your end", "this one's on us") and "Congratulations" still apply — personal does not mean colloquial. Calibration examples from the 2026-06-05 sweep, all under `lib/emails/retention/index.ts`:

| Before | After | Why |
|---|---|---|
| Subject: "You're in!" | Subject: "Your account is ready" | Exclamation mark + colloquial contraction. Lead with the fact. |
| "This one's on us since it came in through the chain. Any sale you add in the next 14 days is on us too..." | "This sale is free because it came in through the chain. Any sale you add in the next 14 days is also free..." | "This one's on us" reads as a mate. State the offer plainly. |
| Subject: "How are things your end?" | Subject: "How are things going?" | "Your end" is an idiom. Same warmth, plainer English. |
| "...so I wanted to drop you a line — we haven't had a file from you..." | "...so I wanted to get in touch. We haven't had a file from you..." | "Drop you a line" is idiomatic. Also removes the em dash; a full stop carries the same beat. |
| "I'm available noon or night, hope to hear from you soon." | "I'm available any time, and I hope to hear from you soon." | "Noon or night" is colloquial; rephrased without losing the personal tone. |

**Portal audience note:** The portal voice shifts from "brisk" to "calm and plain." Buyers and sellers are in a life event. They don't need cheerfulness, but they need more reassurance than agents do. Sentences can be slightly longer. Use "you" and "your" more. Avoid industry timing references that assume knowledge ("exchange in 8 days" → "exchange in 8 days — that's when both sides are legally committed"). Flag these adjustments during portal pass Stage 3; do not pre-write the portal version here.

---

## Application

These rules apply to:
- All visible text: headings, labels, button text, placeholder text, tooltip text, helper text
- All dynamic text: toast messages, error messages, empty state copy, confirmation dialog copy
- All copy in emails and notifications (separate pass from the UI redesign, but same rules)

They do not apply to:
- Code comments
- Dev tool labels (e.g. labels in the `agent-system-preview` page)
- Database field names and API responses (which are never shown to users as-is)
- `console.log` statements
