# Hub migration — /agent/hub → Elevra light

Status: **Phase 1 in progress** (2026-07-28).

## What this folder is

The paper trail for migrating `app/agent/hub/legacy-hub.tsx` to the Elevra light visual language **without regression**. Two prior kinetic-hub attempts died because niche controls were missed at build time. This folder is the discipline layer that prevents that.

## Ground rule

**Nothing in `app/agent/hub/*` gets touched until Ellis signs off on the preview.**

The preview lives at a separate route (`/agent/hub-preview`, TBD confirmed) with the same auth + same server data — only the render layer differs.

## Documents

| File | Purpose | Status |
|---|---|---|
| [01-audit.md](01-audit.md) | Full inventory: layout / conditionals / controls / role variants / empty-loading-error states | Auto-generated from legacy-hub.tsx via scoping agent |
| [02-baseline-screenshots.md](02-baseline-screenshots.md) | Screenshot checklist — YOU capture these on staging before any code | Awaiting capture |
| [03-fixtures.md](03-fixtures.md) | Fixture inventory + any gaps to seed | Complete |
| [04-playwright.md](04-playwright.md) | Existing E2E coverage + gap list | Complete |
| [05-verification-checklist.md](05-verification-checklist.md) | The row-by-row checklist Ellis walks to sign off | Generated from 01-audit.md |
| [06-migration-plan.md](06-migration-plan.md) | Phase 2 (build) + Phase 3 (verify) + Phase 4 (sign-off) + Phase 5 (rollout) | Complete |

## Phase 1 exit criteria

- [x] Audit doc exists and lists every conditional, control, role variant
- [ ] Baseline screenshots captured (Ellis manual)
- [x] Fixture gaps identified — none blocking
- [x] Existing Playwright coverage reviewed + gaps noted
- [x] Verification checklist derived from audit
- [x] Migration plan approved

## Phase 2 entry criteria

Only when Phase 1 exit criteria are all green — Ellis says "start building".

## Phase 4 exit criteria (sign-off)

- Playwright happy-path passes against `/agent/hub-preview`
- Every row of `05-verification-checklist.md` is ticked and evidenced (screenshot)
- No unexplained visual diff vs the baseline screenshots

Until that ↑ is true, `app/agent/hub/page.tsx` is not touched.
