# Role-Coverage Inventory: /agent/to-do

**Date:** 2026-05-18  
**Status:** Stage 1 — Pending Ellis review  
**File:** `app/agent/to-do/page.tsx` + `components/agent/AgentTodoList.tsx`

---

## Section 1: Current state per role

### Director and Negotiator (identical — no role distinction today)

Page works as designed. Tasks fetched via:
```
listAllTasksForAgent(userId, agencyId)
→ where: { agencyId, createdById: userId }
```
Returns tasks the user created, split into:
- `!isAgentRequest` → "My to-dos" section
- `isAgentRequest` → "With your progressor" section (requests sent to their SP)

Copy is entirely agent-facing:
- Subtitle: *"Your notes, plus anything you've flagged to your progressor."*
- Empty state: *"Jot down your next steps, or send a request to your progressor."*
- Stat pill: *"N with progressor"*
- Section header: *"With your progressor"*
- Own-tasks note field labelled: *"Your progressor · date"*
- Reassurance label on progressor tasks: *"Our team is on it"*

### sales_progressor — current state (broken)

Data layer:
```
listAllTasksForAgent(userId, agencyId)
→ where: { agencyId: null, createdById: userId }
```
`agencyId = null` for all internal staff. This query finds only tasks created by the progressor with `agencyId = null`. Agent-to-progressor requests have the agent's `agencyId`, so they are **completely invisible** on this page — the query misses them entirely.

What the progressor sees today:
- Their own tasks (if any, with null agencyId) in "My to-dos"
- "With your progressor" section **never renders** (no `isAgentRequest` tasks with null agencyId exist)
- All copy is verbatim negotiator UI: "flagged to your progressor", "send a request to your progressor", etc.
- The ownership toggle "Mine / Your progressor" renders in AddManualTaskForm — meaningless: there is no "your progressor" for a progressor

### admin — current state (broken)

Identical data path to `sales_progressor` (`agencyId = null`). Admin's own tasks (null agencyId) show. No agent requests visible. Same copy issues. Admin has no special ability to view tasks across agencies.

---

## Section 2: Target state per role

### sales_progressor — target

This page should be the progressor's **incoming request inbox** plus their own management notes.

**Two sections (mirroring the agent view, but inverted):**

| Section | What it shows |
|---|---|
| **My notes** | Tasks the progressor created for themselves (`createdById = progressorId`, not marked as request) — their own personal management to-dos |
| **From agents** | Tasks agents sent to this progressor (`isAgentRequest = true` AND linked to a transaction where `assignedUserId = progressorId`) |

**Copy changes:**
- Title: "To-Do" — keep
- Subtitle: *"Your management notes, plus requests from agents."*
- Stat pill: *"N from agents"* (instead of "N with progressor")
- Section header: *"My notes"* (instead of "My to-dos")
- Section header: *"From agents"* (instead of "With your progressor")
- Empty state (whole page): *"Nothing here yet. Add a personal note, or wait for agent requests to come in."*
- Own-tasks section empty: *"All clear."*
- Agent-requests section empty: *"No pending requests from agents."*
- progressorNote block label: *"Your note · date"* (instead of "Your progressor · date") — the progressor is the one writing the note, not receiving it
- "Our team is on it" reassurance: **hide entirely** — this was meant to reassure agents, not relevant to the progressor

**AddManualTaskForm:**
- Ownership toggle ("Mine / Your progressor") **hidden** — there is no "your progressor" for a progressor. Progressor tasks are always their own.

**Data change required (Category C):**
`listAllTasksForAgent` does not serve `sales_progressor`. A new query is needed (see Section 4).

### admin — target

Admin does not directly "receive" agent requests. Their to-do page should be personal management notes only.

**One section:**
- "My notes" — tasks admin created for themselves (null agencyId, createdById = adminId)
- No "From agents" section (admin is not assigned to outsourced files the way a progressor is)

**Copy changes:**
- Subtitle: *"Your personal management notes."*
- Stat pill: drop "N with progressor" pill entirely
- No "With your progressor" / "From agents" section
- Own-tasks section: keep "My notes" header
- "Our team is on it" reassurance: **hide** — not relevant
- Ownership toggle: **hide** — same reason as progressor

**Data:** Current query works for admin (returns their null-agencyId own tasks). No data change needed.

---

## Section 3: Adaptation plan

| # | Item | Category | Role(s) |
|---|---|---|---|
| 1 | Page subtitle copy | B — Copy | SP, Admin |
| 2 | Stat pill label "N with progressor" | B — Copy | SP |
| 3 | Stat pill hidden entirely for admin | A — Hide/show | Admin |
| 4 | Section title "My to-dos" → "My notes" | B — Copy | SP, Admin |
| 5 | Section title "With your progressor" → "From agents" | B — Copy | SP |
| 6 | "With your progressor" section hidden entirely for admin | A — Hide/show | Admin |
| 7 | Empty state (whole page) copy | B — Copy | SP, Admin |
| 8 | Own-tasks empty state copy (already "All clear." — may be fine) | B — Copy | SP, Admin (review) |
| 9 | Agent-requests empty state copy | B — Copy | SP |
| 10 | "progressorNote" block label ("Your progressor ·") | B — Copy | SP |
| 11 | "Our team is on it" reassurance hidden | A — Hide/show | SP, Admin |
| 12 | Ownership toggle in AddManualTaskForm hidden | A — Hide/show | SP, Admin |
| 13 | `loading.tsx` subtitle copy | B — Copy | SP, Admin |
| 14 | Data layer: progressor inbox query | C — New functionality | SP |

---

## Section 4: New functionality details

### Item 14 — Progressor inbox query

**What it is:** `sales_progressor` needs to see `isAgentRequest=true` tasks from agents that were sent to them. These are tasks created by agents with `agencyId = agent's agency` and `isAgentRequest = true`, linked to transactions where `assignedUserId = thisProgressorId`.

**Current data path:** `listAllTasksForAgent(userId, agencyId)` — queries `{ agencyId, createdById: userId }`. For SP, `agencyId = null`, so only null-agencyId self-created tasks are returned. Agent requests (which have the agent's agencyId) are invisible.

**New query needed:** A separate `listProgressorInboxTasks(progressorId)` function that queries:
```
prisma.manualTask.findMany({
  where: {
    isAgentRequest: true,
    transaction: { assignedUserId: progressorId },
  },
  include: { transaction, assignedTo, createdBy }
})
```
This finds all agent requests linked to transactions the progressor manages, regardless of agencyId.

**Design question for Ellis:**
Should the "From agents" section include DONE agent requests (so the progressor can see history), or only open ones? The agent view shows both (with a "Show N resolved" toggle). Recommend matching the agent pattern (show both, with the completed-toggle).

**Data change risk:** None for existing agent or director/negotiator paths. Additive new query in the service layer.

---

## Section 5: Implementation order

Within this page, once Ellis approves:

1. **Items 1–13 (A and B):** Page copy + hide/show conditions — one pass, fast. Role ternaries in `page.tsx` (subtitle, stat pills) and `AgentTodoList.tsx` (section headers, empty states, form toggle visibility, progressorNote label, reassurance label). Also `loading.tsx` subtitle.

2. **Item 14 (C):** New `listProgressorInboxTasks` service function + wire into `page.tsx` for SP role + "From agents" section renders in `AgentTodoList.tsx`. This is a meaningful build — needs Ellis approval of the design question above before starting.

**Additive discipline:** Every change is a role-conditional ternary or new block. No existing director/negotiator code path is removed.

---

## Open questions for Ellis

1. **"From agents" section for SP (Item 14):** Include completed tasks (with "Show N resolved" toggle) or open-only? Recommend matching agent pattern.

2. **"My notes" copy for admin:** "Your personal management notes." — does this feel right, or does admin not use this page at all in practice? If admin doesn't use it, might just remove the page from admin nav rather than adapting it.

3. **progressorNote block for SP:** The progressor is the one who *writes* the note. Should they see their own past notes on this page, or is this a detail that only matters on the transaction detail page where they set the note?

4. **AddManualTaskForm for SP:** Should the SP be able to send a task *to* someone? (e.g., "chase the agent on this file")? Or is this page purely self-notes + inbox? Currently no mechanism exists for SP→agent task routing. Recommend: self-notes only for now, inbox read-only.
