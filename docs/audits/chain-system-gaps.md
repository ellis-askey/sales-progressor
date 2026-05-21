# Chain System — Gap Analysis & Recommendations

**Stage:** 2 of chain arc  
**Companion doc:** `docs/audits/chain-system-inventory.md`  
**Date:** 2026-05-19  
**Scope:** Every gap from inventory §6 + completeness matrix. Strategy only — no implementation plans.

---

## Clarification 1 — Decline Flow (Resolved)

The decline flow at `app/claim/decline/route.ts` is **complete and working**:

1. Invited agent clicks decline URL in email (`/claim/decline?token=...`)
2. Route validates token (not null, not already claimed, not already declined)
3. Sets `inviteStatus = DECLINED` and `inviteDeclinedAt = new Date()` on ChainLink
4. Returns inline HTML confirmation page: "Thanks — we've let them know"
5. `app/claim/page.tsx` guards the claim path: if already declined, shows error state

**One gap:** The confirmation copy says the originator "will see this", but no email is actually sent to them. The originator sees the declined state passively in ChainDrawer (LinkCard shows "Agent declined · X ago") only if they open it. No active notification fires.

**Classification:** See Gap 5 below.

---

## Gap Analysis

### Gap 1 — Silent chain creation failure

**Location:** `lib/services/transactions.ts` lines 224–227  
**What exists:** Chain creation runs after transaction creation. If `createChainV2()` throws, the error is caught, a flag is set (`chainFailed = true`), and execution continues. The flag is returned but the UI takes no action on it.

| | |
|---|---|
| **Severity** | **Blocker** (must fix before external invites) |
| **Risk** | Agent creates a transaction, believes they're in a chain, but the chain was never attached. They may invite an external agent expecting a linked chain — the external agent's claim lands on an unconnected transaction. Undetectable to the user until they try to open ChainDrawer and see nothing. |
| **Proposed approach** | Option (b): keep chain creation non-fatal (transaction loss would be worse collateral than the chain failure). Surface the failure as a recoverable error toast immediately after transaction creation, with a "Retry chain setup" button on the transaction detail page. The flag (`chainFailed`) is already returned from the action — it just needs to be acted on in the UI. Option (a) — rollback both on chain failure — is rejected: a chain hiccup killing an entire form submission is worse than the problem being fixed. |
| **Scope** | Small |
| **Dependencies** | None |

---

### Gap 2 — Withdrawal cascade not implemented

**Location:** `prisma/schema.prisma` (fields defined); no service or trigger exists  
**What exists:** Schema fields `ChainLink.withdrawalStatus` (WITHDRAWN / REMARKETING / WAITING) and `ChainLink.withdrawalRespondedAt` are defined but never written. When a transaction is marked `withdrawn`, nothing in the chain system fires.

| | |
|---|---|
| **Severity** | **Blocker** |
| **Risk** | External agent is working their file in good faith. Their chain-mate withdraws. They have no idea. They continue chasing, may lock in survey/legal costs, miss the window to remarket their own buyer. This is the worst possible first experience for an externally invited agent — it damages trust and reputation immediately. |
| **Proposed approach** | Needs its own Stage 1 / Stage 2 / Stage 3 arc. See §Withdrawal Cascade below for open questions. **Sequencing decision for Stage 3:** Option (a) — full cascade built before any external invites; or Option (b) — design ships in Phase 1, plus a manual stopgap: when a chain-linked transaction is withdrawn, auto-email all chain-mate agents with a bare notification ("your chain mate at [address] has withdrawn — please contact them directly"), no UI options, no orchestration. Full cascade with options ships in Phase 2. Stage 3 of the withdrawal cascade arc should recommend which path to take. |
| **Scope** | Large arc (separate investigation) |
| **Dependencies** | Gap 6 notification infrastructure — both arcs will use the same email mechanism; design in parallel. |

---

### Gap 3 — Token expiry missing

**Location:** `lib/chain/invite.ts` line 38  
**What exists:** Token generated with `crypto.randomBytes(32).toString("hex")` — strong entropy, but no TTL. Tokens live indefinitely. There is no `inviteExpiresAt` field, no expiry check on claim or decline routes.

| | |
|---|---|
| **Severity** | **Important** (security baseline) |
| **Risk** | A forwarded or leaked invite email can be used to claim a chain link months or years later. If an invitee's inbox is compromised, an attacker can silently claim a link and receive transaction communications. The risk is low in small-scale use; it becomes meaningful as invite volume grows. |
| **Proposed approach** | Add `inviteExpiresAt` to ChainLink (90-day TTL from `inviteSentAt` — 30 days is too short; agents are time-poor and may revisit weeks later; the marginal security difference between 30 and 90 days is negligible). Check expiry on both `/claim` and `/claim/decline`. On resend, generate a new token and reset expiry. Expired tokens return "This invite has expired — contact the inviting agent for a fresh invite." |
| **Scope** | Small–medium (schema migration + three route changes + resend logic update) |
| **Dependencies** | None. Should ship before first external invites go out. |

---

### Gap 4 — Delete chain UI missing + orphan bug

**Location:** `app/api/chains/[chainId]/route.ts` (DELETE endpoint exists); `ChainDrawer.tsx` (no delete button)  
**What exists:** The DELETE API route exists and cascades deletion of ChainLink rows via Prisma. No UI button triggers it. Additionally, the delete does not null out `PropertyTransaction.chainLinkId` on affected transactions — those rows are orphaned (foreign key is nullable, so no constraint fires).

| | |
|---|---|
| **Severity** | **Important** |
| **Risk** | No way to clean up chains created in error (test chains, mislinked files). Agents are stuck with them. If deletion were triggered (via direct API call), orphaned `chainLinkId` references would cause the chain disclaimer to display incorrectly in the sidebar ("Chain not factored") on transactions that no longer belong to any chain. |
| **Proposed approach** | Two-part fix: (1) In the DELETE route, add `updateMany` to null out `chainLinkId` on all affected transactions before or as part of the cascade. (2) Add a "Delete chain" button in ChainDrawer — creator-only, with confirmation modal. |
| **Scope** | Small |
| **Dependencies** | The orphan fix should ship first (or atomically with the UI), so the API is safe before the button is exposed. |

---

### Gap 5 — Decline notification not sent to originator

**Location:** `app/claim/decline/route.ts` line 66–71  
**What exists:** When an invitee declines, the route updates the DB and returns a confirmation page that says the originator "will see this." No email is sent. The originator sees the decline passively when they next open ChainDrawer (LinkCard shows "Agent declined · X ago").

| | |
|---|---|
| **Severity** | **Important** |
| **Risk** | Originator doesn't know the invite was declined. They assume it's pending. They don't follow up, don't reach out to the declining agent, don't update the stub email or re-invite. Chain sits indefinitely in a limbo state they didn't know about. This is especially problematic for external agents who decline and the originator assumes silence = pending. |
| **Proposed approach** | Mirror the existing bounce notification pattern from `handleBouncedInvite()`: after the DB update in the decline route, send an email to the originator — "The agent at [address] declined your chain invite. You can update their details and send a fresh invite from your chain view." |
| **Scope** | Small |
| **Dependencies** | None |

---

### Gap 6 — No broadcast to chain-mates on progress updates

**Location:** Milestone completion handlers, status change actions  
**What exists:** When an agent completes milestones or changes status, their own transaction updates. Other agents in the same chain have no mechanism to receive updates — no email, no in-app notification, no polling. They see current state only when they manually open ChainDrawer.

| | |
|---|---|
| **Severity** | **Important** (core chain value proposition) |
| **Risk** | The stated value of the chain system is visibility. Without any notification, external agents who accepted an invite have no reason to re-open ChainDrawer — it becomes a one-time view rather than a live feed. They disengage. The platform fails to differentiate itself from a phone call or email. |
| **Proposed approach** | Digest approach rather than per-milestone noise. Draft significance threshold (to be confirmed in Stage 3): **Always notify** — status changes (exchange confirmed, withdrawn, completed), both-sides-ready-to-exchange milestone confirmed, file stuck on same milestone for >X days. **Weekly digest** — aggregate of routine milestone completions for the week. Never notify on individual routine milestones. Stage 3 must define the "stuck" threshold and confirm the event list before building. |
| **Scope** | Medium arc |
| **Dependencies** | Withdrawal cascade (Gap 2) must be defined first — its notification mechanism overlaps. Build both on the same notification infrastructure. |

---

### Gap 7 — Edit stub email after invite sent

**Location:** `ChainDrawer.tsx`, `components/chain/LinkCard.tsx`  
**What exists:** Stub fields can be edited before an invite is sent. Once status is SENT, there is no UI to correct a typo in the email. The only recovery path is a bounce + re-invite, which requires waiting for the bounce to register.

| | |
|---|---|
| **Severity** | **Nice-to-have** |
| **Risk** | Low friction issue. Agents occasionally mistype email addresses. Currently they must wait for the bounce webhook to fire, which can take minutes to hours. Adds unnecessary delay. |
| **Proposed approach** | Allow editing `stubAgentEmail` on SENT-status links (not CLAIMED or DECLINED). On edit + resend: invalidate old token (clear it), generate new token, update email, send fresh invite. If token expiry is implemented (Gap 3), the old token would expire naturally — this becomes a cleaner UI on top. |
| **Scope** | Small–medium |
| **Dependencies** | Benefits from but does not require Gap 3 (token expiry). |

---

### Gap 8 — No metrics or reporting

**Location:** No analytics calls in chain code  
**What exists:** No tracking of invite acceptance rates, chain sizes, withdrawal rates, time-to-claim, etc. Chain events don't fire any analytics calls.

| | |
|---|---|
| **Severity** | **Nice-to-have** |
| **Risk** | Can't improve what can't be measured. As volume grows, blind to whether invites are being accepted, which chain positions decline most, whether withdrawal cascades are damaging engagement. |
| **Proposed approach** | PostHog events on key chain actions (invite sent, invite claimed, invite declined, chain created, link removed). Command Centre analytics dashboard for aggregate view. |
| **Scope** | Medium (separate analytics arc) |
| **Dependencies** | PostHog must be live first (currently pending DPA + key per CLAUDE.md). Defer until PostHog is configured. |

---

## Withdrawal Cascade — Open Questions for Stage 1 of Its Own Arc

The withdrawal cascade is a substantial design problem. The fields exist (`withdrawalStatus`, `withdrawalRespondedAt`), the enum exists (WITHDRAWN / REMARKETING / WAITING), but no behavior is implemented.

Before any design can begin, these questions must be answered:

1. **Who gets notified and when?** When transaction A in a chain is withdrawn — do all chain-mates get notified, or only adjacent links (above/below)? Does the whole chain get a status flag?

2. **What options are offered to chain-mates?** The schema has REMARKETING and WAITING — what do these mean in practice? "I'm finding a new buyer" vs "I'll wait for the chain to reform"? Do these options trigger different communications back to the withdrawing agent?

3. **What does the withdrawing agent see?** Do they get confirmation that X chain-mates were notified? Do they see responses (REMARKETING / WAITING) from each?

4. **Does the chain status change?** Should `PropertyChain.status` change from ACTIVE to something else when a link withdraws? Or only when the whole chain collapses?

5. **Does a withdrawal trigger anything on the withdrawing agent's own file?** Or is it purely an outbound notification to others?

6. **What's the re-entry path?** If a chain-mate finds a new buyer and wants to re-link their new buyer into the chain — is that possible? What does "REMARKETING" mean mechanically?

7. **Timing and urgency?** Withdrawal notifications are time-sensitive — a chain-mate who doesn't know for 48 hours may have wasted solicitor time. Should there be a delivery confirmation mechanism?

These questions need a design session with Ellis before any code is written. This is Stage 1 of the withdrawal cascade arc.

---

## Recommended Arc Sequencing

The threshold question: **is it safe to invite external agents today?**

No. Two gaps are hard blockers:

1. **Silent chain creation failure (Gap 1)** — an external agent could receive an invite for a chain that doesn't exist. Unforgivable first impression.
2. **Withdrawal cascade undefined (Gap 2)** — an external agent could be working a file for weeks with no idea their chain has broken. Reputation-damaging at scale.

Everything else is important but doesn't prevent the first invite going out if these two are fixed.

### Phase 1 — Pre-invite (must ship before any external agent is invited)

| # | Gap | Scope | Notes |
|---|---|---|---|
| 1 | Silent chain creation failure | Small | Error toast + retry button |
| 2 | Withdrawal cascade — design + stopgap (Stage 1 of its own arc) | Design + small | Stage 3 of that arc decides option (a) vs (b); at minimum the bare-notification stopgap must ship |
| 3 | Token expiry | Small–medium | 90-day TTL; schema migration required |
| 5 | Decline notification to originator | Small | Mirror bounce notification pattern |
| — | Claim pages polish | Small–medium | First screen external agents see; compressed polish pass (no separate Stage 1–4 cycle) |

**Note on withdrawal cascade:** The Phase 1 / Phase 2 split in the previous draft was contradictory — implementation in Phase 2 would leave external agents unprotected on day 1. The resolution: Stage 3 of the withdrawal cascade arc must either (a) commit to full build before invites, or (b) define and ship the bare-notification stopgap as a Phase 1 deliverable, with full cascade in Phase 2. Both the design and the stopgap decision are Phase 1 gates.

### Phase 2 — Shortly after first invites (within 2–4 weeks)

| # | Gap | Scope | Notes |
|---|---|---|---|
| 4 | Delete chain UI + orphan fix | Small | Clean up test chains; orphan fix ships atomically |
| 6 | Broadcast to chain-mates | Medium | Core value prop; significance threshold confirmed in Stage 3 |
| 7 | Edit stub after invite sent | Small–medium | Friction reduction; complements Gap 3 token expiry |
| 2 | Withdrawal cascade — full implementation | Large | If stopgap shipped in Phase 1; full cascade with options ships here |

### Phase 3 — Deferred

| # | Gap | Scope | Gating condition |
|---|---|---|---|
| 8 | Metrics / reporting | Medium | PostHog must be live first |

---

## Polish Pass Cross-Reference (§7 Expansion)

### Pages that affect external agent experience

| Page | Route | Chain relevance | External agent impact | Recommendation |
|---|---|---|---|---|
| New-sale form | `/agent/transactions/new-v2` | **Primary** — ChainSection is the chain creation UI | Low direct impact (internal agents only) | Bundle into chain arc: if ChainSection looks rough, the chain data being created will look rough to external agents in ChainDrawer |
| Transaction detail | `/agent/transactions/[id]` | **High** — ChainDrawer is here | Indirect (originator polish) | Already Stage 4 complete per inventory; low urgency |
| Claim pages | `/claim`, `/claim/signup`, `/claim/login`, `/claim/confirm` | **Critical** — first screen external agents see | **Direct** — this is the external agent's entire first experience | **Bring forward into chain arc** (see below) |
| Transaction list | `/agent/transactions` | Medium — chain badges/indicators | None directly | Leave in original polish queue |
| Hub | `/agent/hub` | Medium — possible chain stats widget | None directly | Leave in original polish queue |

### Claim pages — bring forward into chain arc

Currently the claim pages are deferred to a "chain feature sweep" in PAGE_LIST.md. They should be pulled into this arc for one reason: they are the **first surface an external agent ever sees of the product**. An invite lands in their inbox, they click through, and they land on `/claim`. If that page is unstyled or visually rough, the external agent's first impression is of an unfinished product.

The current claim pages use inline styles with no design system tokens. They work, but they don't look like the agent app. Before external invites go out, these pages need a polish pass aligned with the agent app's visual system (warm cream, coral, glass card, proper typography).

This is a distinct task from the gap fixes above — purely visual/UX — but it gates external agent trust just as much as the functional gaps do.

**Recommendation:** Include claim page polish as a mandatory Phase 1 deliverable. Polish pass methodology applies but compressed — no separate Stage 1–4 cycle needed given the pages are small. Single arc: inventory current state, redesign to agent-app visual system, implement, verify.

### What to bundle into the "chain arc" vs original polish queue

**Bundle into chain arc:**
- New-sale form ChainSection (visual polish)
- Claim pages (visual polish — must precede external invites)
- ChainDrawer (any remaining gaps that surface during Phase 1/2 fixes)

**Leave in original polish queue:**
- Transaction list (chain badges are additive, not blocking)
- Hub (chain stats are additive)
- Work queue (low chain relevance)

---

*End of Stage 2. All gaps are catalogued. No implementation plans included — those belong to per-arc Stage 3 docs.*
