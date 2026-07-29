# Migration plan — Phase 2 through Phase 5

**Prerequisite:** all Phase 1 exit criteria in [README.md](README.md) green.

## Phase 2 — Build the preview

### Route
`/agent/hub-preview` — inside the same auth as `/agent/hub`, not middleware-exempt.

`app/agent/hub-preview/page.tsx` — server component. Same shell (`AgentShell`, via `app/agent/layout.tsx`).

### Data wiring — identical to legacy
```ts
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import {
  getHubPipelineStats, getHubAttentionItems, getHubWins,
  getHubWeeklyForecast, getHubServiceSplit, getHubRecentActivity, getHubDiary,
  getHubUnassignedFiles, getExpiredHolds, getHubRelistsToAcknowledge,
  getHubChainSetupPending, getHubPipelineStages,
} from "@/lib/services/hub";
```

**No new services. No new prisma queries. No new access-scope logic.** The migration touches nothing under `lib/`.

### Component split — one section per file

Instead of one giant page.tsx (which is what failed the two kinetic attempts), one component per audit-section:

`components/hub-preview/HubHeader.tsx`
`components/hub-preview/EmptyStateBlock.tsx`
`components/hub-preview/HubDiary.tsx`
`components/hub-preview/HubExpiredHolds.tsx` — must include: extend-with-date, indefinitely, take-off-hold modal with 2 options
`components/hub-preview/HubAttentionList.tsx`
`components/hub-preview/HubUnassignedFiles.tsx` — must include: assign dropdown with lazy-fetch
`components/hub-preview/HubNewBuyers.tsx`
`components/hub-preview/HubChainSetup.tsx`
`components/hub-preview/HubPipelineAtAGlance.tsx` — must include: hover popover, 5 stage-empty variants
`components/hub-preview/HubHealthCard.tsx` — 4 tiles + coming-up strip + stalled row
`components/hub-preview/HubWins.tsx`
`components/hub-preview/HubExchangeForecast.tsx`
`components/hub-preview/HubServiceSplit.tsx`
`components/hub-preview/HubActivityRibbon.tsx`
`components/hub-preview/HubProTip.tsx` — full 5-tier cascade

For anything server-heavy (PaymentBlockBanner, PaymentMethodNudge), reuse the existing `components/billing/*` — don't rebuild.

### Visual layer
- Lift the CSS tokens + patterns from `/dev/vibe` (Elevra light) into `components/hub-preview/hub-preview.module.css` — or per-component CSS modules if cleaner.
- Same font family (`Inter Tight` display + `Inter` body), same 4-blob ambient wash on `AgentShell`.
- Same motion tokens (card entry stagger, hover tilt, sticky header shadow).

**Do NOT** import anything from `components/kinetic/hub/*` — dead code from the failed attempts. Delete it after cutover, not before.

### Behavioural contract
Every component receives its data as a prop (server-rendered from page.tsx). Each component preserves the exact conditional from the audit. The prop shapes match `lib/services/hub.ts` return types.

Zero shortcuts. If the audit says "PipelineAtAGlance always renders card; empty copy inside when totalActive === 0", the preview component MUST render the card in that state. Not "we'll show a skeleton" or "we'll hide it" — same behaviour.

### Coding rules
- Server components by default. Only `use client` where the legacy version does.
- Fetch data ONCE in `page.tsx` server component via `Promise.all` (same as legacy line 163).
- Pass results down as props.
- No new server actions. Reuse existing ones (`reactivateFile`, `pauseClientEmails`, `extendHoldAction`, `assignUserAction`, `acknowledgeRelistAction`, `clearChainSetupPendingAction`).

## Phase 3 — Verify

### Automated

Two Playwright specs both green:
1. Existing `e2e/surface-agent-hub.spec.ts` — passes against both `/agent/hub` AND `/agent/hub-preview` (parameterize the URL if practical).
2. New `e2e/surface-agent-hub-migration.spec.ts` — the fuller checklist per [04-playwright.md](04-playwright.md). Passes against both routes.

### Manual walkthrough

Ellis + me sit and walk [05-verification-checklist.md](05-verification-checklist.md) row by row. ~40 minutes. Every row ticked with a screenshot dropped in `after-preview/`.

Any row fails → Phase 2 fix → re-walk the failing section.

## Phase 4 — Sign-off

Recorded in [05-verification-checklist.md](05-verification-checklist.md) as a text line:

> Ellis: "This is fine to go live." — 2026-XX-XX HH:MM

No sign-off = no cutover. Not negotiable.

## Phase 5 — Rollout (in a separate conversation, after sign-off)

### 5a. Feature flag

Add to `lib/features.ts` (or reuse `lib/kinetic/flag.ts` renamed):
```ts
const HUB_PREVIEW_USERS = new Set<string>([]);  // user IDs — starts empty
const HUB_PREVIEW_AGENCIES = new Set<string>([]);  // agency IDs — starts empty

export function shouldSeeHubPreview(session: SessionLike): boolean {
  if (HUB_PREVIEW_USERS.has(session.user.id)) return true;
  if (session.user.agencyId && HUB_PREVIEW_AGENCIES.has(session.user.agencyId)) return true;
  return false;
}
```

### 5b. Router in `app/agent/hub/page.tsx`
```ts
export default async function HubPage() {
  const session = await requireSession();
  if (shouldSeeHubPreview(session)) {
    return <HubPreview />;  // new component, imported from app/agent/hub-preview/page.tsx or a shared component
  }
  return <LegacyHub />;
}
```

The kinetic-hub router already exists in `page.tsx` — we replace `KineticHub` with `HubPreview`, delete `kinetic-hub.tsx` + `components/kinetic/hub/*` in the same commit.

### 5c. Rollout waves

1. **Ellis-only** (1 user in `HUB_PREVIEW_USERS`) → 3–5 days
2. **Internal team** (add Sarah, Alex if they exist) → 3 days
3. **One friendly agency** (Hartwell) → 1 week
4. **All agencies** — clear the flag, delete `LegacyHub` + router in the same commit

### 5d. Rollback

Any wave surfacing a regression → clear the relevant Set → hard-refresh brings everyone back to legacy. ~30-second revert.

### 5e. Monitoring during rollout

- PostHog page-view + error events on `/agent/hub` — watch for spikes
- Sentry — watch for new error signatures matching hub-preview components
- Support inbox — any "hub broken" ticket → investigate before promoting to next wave

### 5f. Deletion criteria

After 2 weeks at 100% with zero P1 tickets:
- Delete `legacy-hub.tsx`
- Delete `kinetic-hub.tsx` + `components/kinetic/hub/*`
- Delete the flag + router; `app/agent/hub/page.tsx` becomes a direct render of the new hub
- Move `docs/active/hub-migration/` → `docs/done/hub-migration/`
