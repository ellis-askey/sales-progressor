# CC Prompt — Docs cleanup audit follow-up

This prompt instructs CC to action the findings from the docs audit
(committed earlier today). It's docs-only — no code changes.

═══════════════════════════════════════════════════════════════════════════════
COPY EVERYTHING BELOW INTO CLAUDE CODE
═══════════════════════════════════════════════════════════════════════════════

Audit accepted. Six small actions, all docs-only, no code changes.

1. Delete docs/~$py of Jono's Claude.md File.md (Word temp file)

2. Re-save VISUAL_DIRECTION.md and PRODUCT_STRATEGY_NOTES.md
   as UTF-8 (currently UTF-16, garbled in most editors)

3. Verify test-accounts.md against current state. Grep the seed
   file or check the production User table for hartwellpartners.co.uk
   accounts. Update or note which are real.

4. Resolve the @hartwell.com vs @hartwellpartners.co.uk contradiction
   between PRE_LAUNCH_CHECKLIST.md and test-accounts.md. Whichever
   reflects current state stays; the other gets a SUPERSEDED header.

5. Create docs/_archive/. Move these in with a SUPERSEDED header
   noting date and reason:
     - Copy of Jono's Claude.md File.md (template, never integrated)
     - Style/claude-code-prompt.md (rollout complete)
     - PRE_LAUNCH_CHECKLIST.md (after step 4 confirms it's stale)

   Add header at top of each archived file:
     <!-- ARCHIVED 2026-05-03
          Reason: [one line]
          Superseded by: [current doc, or N/A if just historical] -->

6. Add header notes (NOT archive) to:
     - MASTER_BLUEPRINT.txt: "<!-- HISTORICAL — describes the
       pre-rebuild thinking. See MILESTONES_SPEC_v1 and admin/
       for current state. -->"
     - PRODUCT_STRATEGY_NOTES.md: "<!-- HISTORICAL — pre-build
       strategy thinking. Pricing and feature plans have evolved. -->"
     - Style/glass-tokens.css: "<!-- REFERENCE COPY — canonical
       source is app/globals.css. -->"

Single commit: "docs: cleanup audit — archive stale, fix encoding,
add provenance headers"

This is independent of Package A1 and Package D. Slot it in as a
small standalone task before either build starts. Tell me when done.
