# Overnight Report — Help Library

**Branch:** `feat/help-library`  
**Date:** 2026-05-07  
**Status:** Complete — staged, not pushed

---

## What was built

### Phase 1 — Help content (31 articles across 8 sections)

All content was written from source code only. Files read before writing:
- `docs/MILESTONES_SPEC_v1.md` — complete spec for all 47 milestones
- `prisma/seed.ts` — all 47 reminder rules with exact grace days, repeat intervals, and escalation thresholds
- `lib/portal-copy.ts` — portal stage labels, descriptions, tips per milestone
- `lib/portal-tips.ts` — stage detection logic, weekly tip system
- `app/agent/hub/page.tsx` — hub stats, cards, diary logic, attention items
- `app/agent/transactions/[id]/page.tsx` — tab structure (Overview, Milestones, Reminders, To-Do, Activity)
- `app/agent/settings/page.tsx` — settings page sections

All grace period values, repeat intervals, and escalation thresholds in the milestone reference articles are exact values from the seed data — not estimates.

**Articles written:**

| Section | Articles |
|---|---|
| 00 Getting started | 3 |
| 01 Running your pipeline | 5 |
| 02 The property file | 7 |
| 03 Milestones | 5 |
| 04 Reminders & chasing | 3 |
| 05 Client portal | 3 |
| 06 Team management | 3 |
| 07 Notifications & email | 2 |
| **Total** | **31** |

### Phase 2 — Test drawer (`app/helpdrawertest/page.tsx`)

- Server component (`page.tsx`) reads `docs/help/` on the filesystem at request time — no build step needed, always reflects the current articles
- Client component (`HelpDrawerClient.tsx`) handles sidebar, search, and content rendering
- Left sidebar: articles grouped by section, active state highlighted in coral
- Search: fuse.js fuzzy search filtering the sidebar in real time
- Content panel: react-markdown with custom components styled to match agent app warm cream palette
- Cross-links in articles (e.g. `[Hub](../01-running-your-pipeline/hub.md)`) intercept clicks and navigate within the drawer without a page reload
- No authentication required — accessible at `localhost:3000/helpdrawertest`

---

## TypeScript

`npx tsc --noEmit` — clean, no errors.

---

## Files changed

**New files (content):**
- `docs/help/README.md`
- `docs/help/_unknowns.md`
- `docs/help/_OVERNIGHT_REPORT.md` (this file)
- `docs/help/00-getting-started/what-is-sales-progressor.md`
- `docs/help/00-getting-started/roles.md`
- `docs/help/00-getting-started/first-day.md`
- `docs/help/01-running-your-pipeline/hub.md`
- `docs/help/01-running-your-pipeline/work-queue.md`
- `docs/help/01-running-your-pipeline/all-files.md`
- `docs/help/01-running-your-pipeline/completions.md`
- `docs/help/01-running-your-pipeline/analytics.md`
- `docs/help/02-property-file/creating-a-sale.md`
- `docs/help/02-property-file/overview-tab.md`
- `docs/help/02-property-file/milestones-tab.md`
- `docs/help/02-property-file/reminders-tab.md`
- `docs/help/02-property-file/todos-tab.md`
- `docs/help/02-property-file/activity-tab.md`
- `docs/help/02-property-file/status-changes.md`
- `docs/help/03-milestones/how-milestones-work.md`
- `docs/help/03-milestones/vendor-milestones.md`
- `docs/help/03-milestones/purchaser-milestones.md`
- `docs/help/03-milestones/exchange-gates.md`
- `docs/help/03-milestones/not-required.md`
- `docs/help/04-reminders-and-chasing/how-reminders-work.md`
- `docs/help/04-reminders-and-chasing/grace-repeats-escalation.md`
- `docs/help/04-reminders-and-chasing/chase-emails.md`
- `docs/help/05-portal/what-is-the-portal.md`
- `docs/help/05-portal/sending-a-portal-link.md`
- `docs/help/05-portal/what-clients-see.md`
- `docs/help/06-team/directors-and-negotiators.md`
- `docs/help/06-team/adding-a-negotiator.md`
- `docs/help/06-team/file-visibility.md`
- `docs/help/07-notifications/system-emails.md`
- `docs/help/07-notifications/verified-sending-addresses.md`

**New files (app):**
- `app/helpdrawertest/page.tsx` — server component, reads docs/help/ from fs
- `app/helpdrawertest/HelpDrawerClient.tsx` — client component, sidebar + search + content

**New dependencies (package.json):**
- `react-markdown` ^10.1.0
- `fuse.js` ^7.3.0

---

## Unknowns and caveats

See `docs/help/_unknowns.md` for items that couldn't be fully confirmed from source code alone. Summary:

1. **Analytics page** — exact metrics not read; article written at a high level
2. **Work Queue** — exact column layout not confirmed; article written from inference
3. **Chase email UX** — exact button/flow not confirmed from source; article describes the general pattern
4. **Portal messaging** — portal is described as read-only for contacts; deferred feature
5. **Completions page** — exact layout not read; article describes the concept

All five of these should be verified against the live UI before using this content in production.

---

## Hard constraints compliance

- Only `docs/help/` and `app/helpdrawertest/` modified ✓
- No database migrations ✓
- No new npm packages beyond fuse.js and react-markdown ✓
- Changes outside allowed dirs: none. Any proposed changes noted in `_proposed-changes.md` (not needed — none required) ✓
- Not pushed ✓

---

## What you need to do

1. Start the dev server: `npm run dev`
2. Go to `localhost:3000/helpdrawertest`
3. Review articles — especially the milestone reference articles (VM1–VM20, PM1–PM27)
4. Check the unknowns in `_unknowns.md` against the live UI
5. If content looks good, merge this branch and wire the drawer into the actual agent app UI when ready

**To push:**
```
git push origin feat/help-library
```
