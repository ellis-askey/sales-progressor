# Agency Setup Completeness — spec (Phase 4)

Status: building (2026-09-14). Decisions locked (see below), founder said proceed.
Owner: Command Centre + agent onboarding.
Builds on: `SPEC.md` (Phase 1/2 email readiness, shipped) and `PHASE3-inbound.md`.

## Why

Phase 1 gave the founder a per-agency view of **email** readiness (sender +
DNS + inbound) on `/command/agencies`. But there's a whole set of "best
experience" setup items buried in agency settings that we currently can't see
at a glance and have to check one agency at a time:

- Has the agency set an **email signature** (ideally a photo signature)?
- Has each person uploaded a **profile picture**?
- Has the agency uploaded a **logo**?
- Has the agency **customised its client-email branding** (theme)?
- Has the agency **brought its team on** (invited / added colleagues)?

All of these already have backing fields in the database (see table below) but
none are surfaced as a completeness signal anywhere in the Command Centre. This
phase broadens the existing readiness surface into a single **"Setup readiness"**
board that shows, per agency, exactly what has and hasn't been done, so the
founder can see the gaps and chase (or set them on the agency's behalf, which
the drill-down already supports).

## Scope

- **Extends** the existing `/command/agencies` readiness section. This is not a
  new page.
- **Folds the current "Email readiness" table into a unified "Setup readiness"
  table** — one board, grouped columns. We do not add a second table beside it
  (that would duplicate the email signals on the same screen).
- Read-only against existing data. **No schema change** — every signal below is
  already stored.

Explicitly **out of scope**:
- Any change to how the underlying settings are edited (the agent-app editors
  and the CC drill-down editors already exist and stay as they are).
- Automations / fee-tier / first-sale rows (unchanged from Phase 1's exclusion).
- A chase-email cron to agencies. Nudging stays in-app for now (see Phase 2).

## The signals

Grouped into three categories. Every "done" definition and its data source:

### Group A — Email (already shipped in Phase 1, folded in unchanged)

| Signal | Level | Source | "Done" when |
|---|---|---|---|
| Sender address | agency | `Agency.quoteSenderEmail` | non-null |
| Domain auth (DNS) | agency | `VerifiedDomain.status` | a row is `verified` |
| Inbound | agency | `OutlookConnection` for agency users + recent inbound `OutboundMessage` | connected (level `ready`/`connected_quiet`) |

### Group B — Experience (new)

| Signal | Level | Source | "Done" when |
|---|---|---|---|
| Email signature | per-user | `User.emailSignatureMode` / `emailSignatureImagePath` / `emailSignatureHtml` | see **Decision 2** |
| Profile picture | per-user | `User.image` | non-null |
| Agency logo | agency | `Agency.logoPath` | non-null |
| Client-email branding | agency | `Agency.emailTheme` (Json) | non-null (a theme has been saved) |

### Group C — Team (new)

| Signal | Level | Source | "Done" when |
|---|---|---|---|
| Team brought on | agency | `User` count (role in director/negotiator) + `DirectorInvitation` / `NegotiatorInvitation` | see **Decision 3** |

## Locked decisions

Per-user signals (signature, picture) don't have one value per agency, so the
top-line "is this agency set up" pill needs a rule. All three settled:

### Decision 1 — per-user roll-up: **director-anchored**

The agency-level tick for signature/picture is done when the agency's
**director(s)** have it (anchor = directors if any exist, else all
director/negotiator members). The expanded drill-down lists every team member
and who's missing what, with the count ("3 of 4 people have a photo").
Rationale: matches the existing `directorOnly` onboarding pattern; the director
is the account owner and the one we chase; a dormant negotiator doesn't drag the
agency's score down.

### Decision 2 — signature "done" = **personalised**

Done when `emailSignatureMode` is `IMAGE` or `CUSTOM`, **or** an image /
html is stored. The default `BASIC` reads as "not yet personalised". Surfaced
with the honest label "Signature" (a BASIC user isn't broken, just not
personalised) — the drill-down copy makes the distinction.

### Decision 3 — "team brought on" = **more than one person, or an invite sent**

Done when the agency has more than one director/negotiator user, **or** at least
one non-cancelled `DirectorInvitation` / `NegotiatorInvitation` exists. Kept as
a visible tick, **but scored as informational only** — it does not count toward
the "fully set up" pill (see rollup below), because we can't tell a deliberate
one-person agency from one that hasn't invited yet, and a solo agency showing a
blank here is not a gap to chase.

### Rollup — what the pill and the "fully set up" count mean

- **Scored signals (6):** sender, DNS, signature, photo, logo, branding theme.
- **Informational ticks (2, shown but not scored):** inbound, team. (Inbound was
  already shown-but-not-scored in the Phase 1 pill; team joins it, per Decision
  3.)
- **Pill:** `broken` if the domain's latest check failed (hard fail, overrides);
  else `ready` when all 6 scored signals are done; `not_started` when none are;
  `setting_up` otherwise.
- Header shows `{ready}/{total} fully set up`; each row shows its `doneCount/6`.

## Build plan

### 1. Extend the service — `lib/command/agency-readiness.ts`

Rename the exported entry point to `getAgencySetupReadiness()` (keep
`getAgencyEmailReadiness` as a thin alias for one release so nothing breaks, or
update the single caller — Law 4, one caller, cheap). Extend the per-agency row
type with the new signals:

```ts
export type AgencySetupReadiness = {
  id: string;
  name: string;
  // Group A (existing)
  senderEmail: string | null; senderSet: boolean;
  domain: ReadinessDomain | null;
  inbound: AgencyInboundReadiness;
  // Group B (new)
  signature: { done: boolean; total: number; withSignature: number };
  photo: { done: boolean; total: number; withPhoto: number };
  logoSet: boolean;
  emailThemeSet: boolean;
  // Group C (new)
  team: { done: boolean; userCount: number; invitationCount: number };
  // rollup
  level: ReadinessLevel;                 // existing 4-level, now spans all signals
  doneCount: number; totalSignals: number; // e.g. "5/8 done"
};
```

New reads, all via `commandDb`, batched like the existing inbound count:
- Per-agency users: `commandDb.user.findMany({ where: { agencyId: { in }, role: { in: [director, negotiator] } }, select: { id, role, image, emailSignatureMode, emailSignatureImagePath, emailSignatureHtml } })` — derive signature/photo counts + director-anchored done.
- `Agency.logoPath` and `Agency.emailTheme` added to the existing agency select.
- Invitation counts: `directorInvitation` + `negotiatorInvitation` counts where `cancelledAt: null`, grouped by agency.

`level` (the top pill) keeps the existing 4 states but now reflects the whole
set. Recommended: `ready` = all agency-level + director-anchored signals done;
`broken` = a domain in `failed` (unchanged, hard fail); `not_started` = nothing
done; `setting_up` = anything in between. Confirm with Decision 1.

### 2. Extend the component — `components/command/agencies/AgencyEmailReadiness.tsx`

Rename to `AgencySetupReadiness.tsx` (Law 16: single manual rename, reviewed).
Keep the existing structure — `Tick`, `ReadinessPill`, the gaps filter, the
expand-on-click row. Changes:

- **Setup cell:** replace the 3 ticks with grouped ticks. Suggested compact
  layout: `Email: Sender · DNS · Inbound  |  Experience: Signature · Photo ·
  Logo · Branding  |  Team: Invited`. On narrow widths this wraps; each tick is
  the same `✓ / ○` `Tick` primitive already in the file.
- **Header rollup:** keep `{readyCount}/{total} ready` and the "show gaps"
  toggle; optionally add a second line `{doneCount} of {totalSignals} setup
  steps done across all agencies`.
- **Expanded row:** keep the existing three email items (sender / domain via
  `AgencyDomainAuth` / inbound) and add:
  - **Experience** block: signature, photo (with the per-user "3 of 4 people"
    breakdown from Decision 1), logo, branding — each with done/not-done and a
    one-line "who's blocked / what's missing".
  - **Team** block: user count + pending invitations.
  - Each unfinished item deep-links to where it's fixed. Note two of these are
    fixable from the CC drill-down itself (`/command/agencies/[userId]` already
    hosts `AgentPhotoManager` and `EmailBrandingStudio`), so the drill-down link
    is a real action, not just information.

### 3. Page wiring — `app/command/(protected)/agencies/page.tsx`

- Swap the `getAgencyEmailReadiness()` call + `<AgencyEmailReadiness>` render
  for the renamed service/component. Rename the section heading from "Email
  readiness" to "Setup readiness". No other page changes.

### 4. (Optional, Phase 2 follow-on) agent-side nudges

The Phase 1/2 nudges already cover the email signals via
`OnboardingChecklist` + `EmailSetupPrompt`. If we want the new signals nudged
too, extend `/api/agent/onboarding-progress` with `hasSignature`, `hasPhoto`,
`hasLogo` progress keys and add checklist steps in the "Finish setup" group,
reusing the existing `progressKey` pattern. Recommend deferring this until the
CC view has told us which gaps are actually common.

## Definition of done

- `/command/agencies` shows one "Setup readiness" board covering all signals in
  Groups A–C, reading real state via `commandDb`.
- Existing email readiness behaviour (sender / DNS via `AgencyDomainAuth` /
  inbound) is preserved exactly — no regression to the shipped Phase 1 view.
- Per-user signals roll up per Decision 1 and expose the per-user breakdown on
  expand.
- `tsc` clean; no em-dashes in strings; CC visual system respected (Law 9);
  all reads through `commandDb` (Law 7/8). No schema change, no migration.

## Data model reference (all fields confirmed to exist, no migration)

- `Agency.quoteSenderEmail`, `Agency.logoPath`, `Agency.emailTheme` — `prisma/schema.prisma`
- `User.image`, `User.emailSignatureMode` (default `BASIC`), `User.emailSignatureImagePath`, `User.emailSignatureHtml`, `User.role`, `User.agencyId`
- `VerifiedDomain` (status/dkimValid/spfValid), `OutlookConnection` — email readiness (existing)
- `DirectorInvitation`, `NegotiatorInvitation` (both have `cancelledAt`, `acceptedAt`)
