<!-- ARCHIVED 2026-05-03
     Reason: Boilerplate template, never integrated into this project
     Superseded by: N/A (historical reference only) -->

## **Project Overview**

\[Describe what your project does in 1-2 sentences. Be specific — Claude works better when it knows the goal.\]

---

## **Connected Integrations**

| Service | What It Does |
| ----- | ----- |
| \[Your database\] | Central data brain — all content, analytics, tracking |
| \[Your comms tool\] | Notifications, reports, team briefs |
| \[Your project tool\] | Task/project management |
| \[Your APIs\] | Data pulls, web research, scraping |

---

## **Development Rules**

**Rule 1: Always read first**

Before taking any action, always read `CLAUDE.md` and `project_specs.md`. If either file doesn't exist, create it before doing anything else.

**Rule 2: Define before you build**

Before writing any code:

1. Create or update `project_specs.md` and define:  
   * What the app does and who uses it  
   * Tech stack  
   * Data models and where data is stored  
   * Third-party services being used  
   * What "done" looks like for this task  
2. Show the file  
3. Wait for approval

No code should be written before this file is approved.

**Rule 3: Look before you create**

Always look at existing files before creating new ones. Don't start building until you understand what's being asked. If anything is unclear, ask before starting.

**Rule 4: Test before you respond**

After making any code changes, run the relevant tests or start the dev server to check for errors before responding. Never say "done" if the code is untested.

**Rule 5: Minimize context**

Always find ways to reduce context window usage. If there's a way to keep things operating the same but use less context, optimize and let me know. Remove ALL files that are redundant or unnecessary.

**Rule 6: Capture what works**

After any content creation session, check if the output revealed new patterns, phrases, or preferences. Update your reference files. This keeps your system a living document that gets better over time.

**Rule 7: Research before testing**

Before proposing any new test, research whether the data is already conclusive. If the answer is already known, make it a production rule — don't waste time confirming what the internet already solved. Only test variables where the answer genuinely depends on YOUR specific audience.

**Rule 8: Challenge the direction**

Think critically about the direction we're heading. If you think this isn't the most optimized path to reach the goal in the shortest time, suggest a better alternative. Don't just execute — push back when there's a faster, smarter, or more effective way.

**Rule 9: Quality gate**

No content gets published until it meets your quality bar. Rate every piece of content honestly — no inflating scores to move things along. If it's not ready, say what's wrong and fix it before proceeding.

**Core Rule**

Do exactly what is asked. Nothing more, nothing less. If something is unclear, ask before starting.

---

## **How to Respond**

Always explain simply — no jargon.

For every response, include:

* **What I just did** — plain English  
* **What you need to do** — step by step  
* **Why** — one sentence explaining what it does or why it matters  
* **Next step** — one clear action  
* **Errors** — if something went wrong, explain it simply and say exactly how to fix it

---

## **Tech Stack**

* **Language:** \[Your language\]  
* **AI:** Claude API via `anthropic` SDK  
* **Data:** \[Your database\]  
* **Integrations:** \[Your tools\]

---

## **File Structure**

* `/skills` — Skill definitions (one SKILL.md per skill)  
* `/src` — All scripts  
* `/references` — Reference docs that Claude reads for context  
* `/files` — Data files, handoffs, briefs  
* `.env` — API keys and secrets (never share or commit)  
* `project_specs.md` — What this project does and what needs to be built

---

## **How to Write Code**

* Write simple, readable code — clarity matters more than cleverness  
* Make one change at a time  
* Don't change code that isn't related to the current task  
* Don't over-engineer — build exactly what's needed, nothing more

---

## **Secrets & Safety**

* Never put API keys or passwords directly in the code  
* Never commit `.env` to GitHub  
* Ask before deleting or renaming any important files

---

## **Testing**

Before marking any task as done:

* Run the relevant script and confirm it exits successfully  
* Check for errors, warnings, or unexpected output  
* Verify that existing behaviour wasn't broken by the change  
* Test the happy path AND the error path  
* Confirm data is passed correctly between steps

Never say "done" if the code is untested.
