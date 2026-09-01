# Property-File Resilience Audit

**How well does TSP survive a badly-maintained property file?**

Status: forensic audit only — no code changed. Produced 2026-09-01.
Method: traced the real create path, schema, services, crons and UI (not assumptions). Every load-bearing claim carries a `file:line` citation. Claims were produced by six parallel deep-traces and cross-checked against `prisma/schema.prisma`, `app/actions/transactions.ts`, and `lib/services/milestones.ts` read directly.

> Reading note on confidence: findings are marked **VERIFIED** (I read the branch myself), **TRACED** (a deep-trace read it and quoted the line), or **NEEDS-CONFIRM** (plausible, one open question noted). Nothing here should be implemented before the Section 20 questions are answered.

> **⚠️ SUPERSEDED IN PART.** Founder review completed 2026-09-01. **[Part II](#part-ii--founder-decisions-resolved-confirmations--final-plan-2026-09-01)** (at the end of this document) records the decisions, corrects the exchange-date findings (the 12-week target is intentional — the problem is muddled *naming*, not a fabricated date), resolves both NEEDS-CONFIRM items, adds the outsourced-route audit, and **replaces Sections 17, 18 and 20 and the Top-10.** Read Part II as the source of truth for the plan; Sections 1–16 remain valid as the underlying evidence, with the one correction that F1–F4/F12 are a semantics problem, not "stop fabricating a date".

---

## 1. Executive summary

TSP is **much more resilient to a sparse file than expected on the read side, and much less resilient than it looks on the intelligence and automation side.** The UI degrades gracefully almost everywhere (genuine empty states with contextual "Add" CTAs — Law 13 is clearly being honoured). The danger is not blank screens. It is three systemic patterns:

1. **Fabricated data masquerading as real.** Every file is stamped `expectedExchangeDate = createdAt + 84 days` at creation (`lib/services/transactions.ts:875-880,930`). "We have no idea when this exchanges" is silently rendered as a concrete date that then ages into "overdue exchange", "stuck", and a chain-wide fabricated forecast. **Unknown becomes bad.**

2. **Detectors that gate on data existing.** The stall/risk/problem detectors require `completedCount > 0` or a known prerequisite timestamp before they can fire (`problem-detection.ts:98,178`; `health.ts:26-45`; `risk.ts:87-107`). The emptiest, arguably highest-risk files evade every warning and render the green "on track" dot. **Unknown becomes healthy.** These two patterns point in opposite directions and are both wrong.

3. **Silent automation holes with a fake safety net.** The client-chase "we couldn't email this client, here's why" handback (`no_email_on_contact`, `no_portalToken_on_contact`, `client_opted_out`) is fully built, DB-wired and UI-rendered — **but never invoked in production** (`client-chase-cron.ts:703` only ever passes `client_emails_paused`). The docs claim the net exists (`docs/active/client-chase-arc-complete.md:202-203`). It does not. Separately, the solicitor chase is a **pure silent no-op** for any side missing a solicitor email — no send, no task, no escalation, no trace, forever (`lib/solicitor-confirm/chase.ts:261-267`).

The good news: the create form is a strong guard (it requires street + tenure + purchase type, and for outsourced it requires a reachable buyer and seller), so the worst-case "milestone-less file" is only reachable through non-form paths (admin migration, API, un-promoted draft). The recommended direction is **not** more mandatory fields. It is: stop fabricating dates, represent unknown as unknown, wire the fail-soft net that already exists, and add a lightweight *contextual* "this missing field is blocking X" surface — plus a genuine completeness gate on the **outsourced** tier only.

**Headline severities:** 2× P1 (silent automation), ~6× P2 (misleading intelligence / recovery dead-end / outsourced gap), the rest P3.

---

## 2. Current minimum viable property file

**Data-layer minimum (what actually reaches the DB):** just two fields.

| Field | Proof |
|---|---|
| `propertyAddress` | Written unconditionally: `lib/services/transactions.ts:907`; normalised `actions/transactions.ts:228`. Only always-present column. |
| `agencyId` | Hard throw if absent: `app/actions/transactions.ts:176-178`. Internal staff (agencyId null) cannot create without a migration override. |

Everything else is nullable at the service boundary (`createTransaction`, `lib/services/transactions.ts:776-818` types + `?? null` defaults `:931-952`). Contacts are gated behind `if (input.contacts.length > 0)` (`actions/transactions.ts:259`) — a zero-contact file is valid server-side. **VERIFIED.**

**Auto-stamped at create regardless of input** (so never "missing", but see §7 — several are *fabricated*, not real):
- `expectedExchangeDate` ← `now + 84 days` (`transactions.ts:879-880,930`)
- `twelveWeekTarget` ← `now + 84 days` (`:876-877,953`) — **no edit action exists to change this later**
- `serviceType` derived from `progressedBy`; `outsourcedAt`, `freeReason`, `pricingVersion`, `freeOnExchange`
- Round-1 `BuyerRound` created + linked
- `predictedExchangeDate` is **not** set at create (stays null; the stored `expectedExchangeDate` is the fabricated one)

**Form-layer minimum (what the live `NewSaleFlow` will submit — stricter than the server):**
- Self-progress file: **street address (≥3 chars) + tenure + purchase type**. City/postcode optional (`NewSaleFlow.tsx:396-399,816-826,848-849`).
- Outsourced file: additionally **≥1 vendor with name + (phone OR email)** and **≥1 purchaser with name + (phone OR email)** (`NewSaleFlow.tsx:828-843`).

There are **no zod schemas** in the create path; all validation is imperative boolean checks in the client component. `app/agent/polish/new-sale-v2/page.tsx` is a **static design mockup** (hard-coded literals, no server calls) and is not live. **TRACED.**

---

## 3. Data classification

Tiers: **(1) Hard required** — row cannot exist / immediately breaks. **(2) Functionally required** — a core feature silently no-ops without it. **(3) Quality enhancing** — degrades signal/UX, core still works. **(4) Cosmetic/context.**

| Field | Schema | Tier | Justification |
|---|---|---|---|
| `propertyAddress` | `:306` req | **1** | Only guaranteed column; every list/portal/email renders it. |
| `agencyId` | `:308` req | **1** | Multi-tenancy anchor; create throws without it. |
| `tenure` | `:335` `Tenure?` | **2** | Half the milestone-init gate (`actions:288`). Null ⇒ zero `MilestoneCompletion` rows ⇒ no client chase, no solicitor steps. |
| `purchaseType` | `:336` `PurchaseType?` | **2** | Other half of the same gate. Same consequence. |
| Vendor contact (name + phone/email) | `Contact :765-771` | **2** outsourced / **3** self | Outsourced intro + client chase have no recipient without it. |
| Purchaser contact (name + phone/email) | `Contact :765-771` | **2** outsourced / **3** self | Purchaser chase + portal invite dead without it. |
| `Contact.email` | `:770` `String?` | **2** | Gates client chase (`client-chase-cron.ts:265-285`), confirmations (`portal.ts:2065`), portal invite (`api/portal/invite:46`), weekly update, exchange-day client emails. |
| `Contact.phone` | `:769` `String?` | **3** | Only enables the manual Call/SMS/WhatsApp buttons; no automation depends on it. |
| `Contact.roleType` | `:771` req | **2** | Drives vendor/purchaser scoping + round attribution. Required on any contact that exists. |
| `Contact.portalToken` | `:782` `String?` | **2** | Auto-set `randomUUID()` at insert; portal access key. Not user-supplied. |
| `expectedExchangeDate` | `:319` `DateTime?` | **2** | Forecast + overdue/stuck signals key off it. Auto-fabricated at +84d (see §7 F1). |
| `twelveWeekTarget` | `:343` `DateTime?` | **3** | On-track pace anchor. Auto-set; **no editor**. |
| `progressedBy`/`serviceType` | `:312-313` | **2** | Routes SP vs self; picks billing + chase behaviour. Defaulted, never null. |
| `purchasePrice` | `:320` `Int?` | **3** | Fee/earnings + `priceAtExchange` billing snapshot; portal costs card. Sale progresses without it. |
| Vendor/purchaser solicitor firm + contact | `:371-374` `String?` | **3** (but see §9) | Solicitor confirms + chases silently no-op without them; agent-side progression still works. |
| `SolicitorContact.email` | `:951` `String?` | **2** for solicitor chase | Without it, that side is never chased or escalated (`chase.ts:261-267`). |
| `SolicitorFirm.name` | `:917` req | **3** | Only required if a firm row is created; firms optional overall. |
| Chain stubs / `ChainLink.stubAgentEmail` | `:1833,1858` | **3** | Entirely optional; failure non-fatal (`actions:397-400`). Email needed only to send an invite. |
| Agent fee | `:347-349` | **3** | Commercial reporting/earnings; also drives `revenue_at_risk` (see §12 A9). No progression impact. |
| Referral / broker | `:368-377` | **4** | Fee-tracking metadata + a broker card. |
| `notes` | `:350` `String?` | **4** | Mirrored to a "Setup note" feed row; the column itself is read by no screen. |
| `photoStoragePath` | `:413` `String?` | **4** | Portal hero image; absent = no image, no broken state. |
| `completionDate` | `:346` `DateTime?` | **3** | Post-exchange grouping; required (thrown) only at exchange-day start (`exchange-day.ts:120`). |
| `assignedUserId` (SP) | `:309` `String?` | **3** | Null routes outsourced files to "Needs SP assigning" — intentional. |

**Does form validation reflect real dependency?** Mostly, and it errs on the strict side (it is never looser than the backend). The one place it is *looser than it should be for the tier* is outsourced completeness — see §13. The one place a real dependency is invisible is `Contact.email`, which the form treats as "phone OR email" but which is functionally required for **all** automated client communication (§9).

---

## 4. Field → feature dependency map

Traced from code, not assumed. `→` means "this feature is disabled / degraded when the field is absent".

**`Contact.email`** (purchaser/vendor principal)
→ client-chase digest (contact filtered out at SQL, `client-chase-cron.ts:265-285`)
→ milestone confirmation email to that client (`portal.ts:2065-2066` / `:1562`)
→ portal **invite** send (`api/portal/invite:46` hard 400)
→ weekly "all on track" client update (`client-weekly-update.ts:60,76`)
→ exchange-day client emails — 09:00 info + 11:00 authority request (`exchange-day/client-send.ts:118-123`)
→ outsourced intro email (`send-outsource-intro.ts:150`)
→ **NOT** portal access itself (portal works off `portalToken`, which is always minted) — so a no-email client can still be handed a link manually, but no automation reaches them.

**`Contact.phone`**
→ manual Call / SMS / WhatsApp buttons only (`ContactsSection.tsx:932-951`) — disabled with "No phone number on file". No automation.

**`vendor/purchaserSolicitorContactId` + `SolicitorContact.email`**
→ solicitor confirmation chase (`chase.ts:261-267` — silent skip; file excluded from query if neither side has a contact `:198-209`)
→ solicitor escalation (`SolicitorChaseState` only created on a real send → escalation pass has nothing to act on, `:459-552`)
→ solicitor `/s/` portal link (minted only inside a chase send, `chase.ts:362` — no email ⇒ no link, no manual fallback)
→ enquiries chase (same pattern, `lib/enquiries/chase.ts:161-165`)
→ solicitor-performance analytics attribution (`solicitor-intel.ts:60-89` — a file with no firm linked is invisible to firm medians)
→ portal "Your team" Email button (degrades honestly to an add-email prompt, `PortalTeamCard.tsx:179-182`)

**`tenure` + `purchaseType`** (both, at create)
→ `initializeMilestoneCompletions` (`actions:288`) → **all** `MilestoneCompletion` rows
→ client chase (no target completion row ⇒ every rule `continue`s, `client-chase-cron.ts:394-396`)
→ solicitor chase (anchors resolve null ⇒ no due steps)
→ progress %, current stage, next step, exchange gate
→ (agent-side reminders are the exception — created ungated, `actions:330-332`, see §5 Scenario A)

**`expectedExchangeDate`** (fabricated, §7 F1)
→ forecast strip; hub "exchanging" counts
→ `overdue_exchange` work-queue alert (`work-queue.ts:112-117`)
→ `isExchangeOverdueStuck` hub attention + revise banner (`exchange-prediction.ts:130-154`)
→ calendar export + countdown on portal (guarded, hidden if null — but it's never null)

**`purchasePrice`**
→ fee / earnings math; `priceAtExchange` billing snapshot (`schema:505`)
→ portal "Your costs" card (`portal.ts` / `page.tsx:507` — hidden if null)
→ `revenue_at_risk` is about *fee* not price
→ analytics pipeline value

**Milestone `completedAt` dates**
→ every speed/velocity analytic (`analytics.ts`, `metrics-rollup.ts`, `solicitor-intel.ts`)
→ `onTrack`, risk "progress vs pace", `milestone_stalled`, staleness badges
→ self-healing exchange-date refresh (`refreshExpectedExchangeDate`)

**Status = `withdrawn`** (a maintenance action, not a field)
→ solicitor fall-through rate denominator (`solicitor-intel.ts:130-139` — a dead deal left `active` suppresses the rate)
→ cancellation of open chases (`changeStatusAction`)

---

## 5. Scenario test results

Reasoned from create → exchange for each. "Silent" = agent gets no signal.

### A. Bare minimum (address + tenure + type via form; no contacts, no solicitors, no price)
- Milestones **initialize** (form guarantees tenure+type). Milestone ladder renders. Progress = "Just started"/0% (`PropertyHero.tsx:101`). **Good.**
- Client chase: no emailable contact ⇒ file skipped, `client-chase-cron.ts:378-379`. **Silent.** Agent-side reminder still appears in the work queue (`actions:330`) with no hint the client isn't being emailed.
- Solicitor chase: no solicitor ⇒ file excluded from query (`chase.ts:198-209`). **Silent, forever.**
- `expectedExchangeDate` = +84d fabricated ⇒ at ~12 weeks the file trips `overdue_exchange` (§7 F2) and eventually `isExchangeOverdueStuck` (F3) purely from the clock.
- Health = **green** until a chase task or activity exists (F5); risk = `no_data` then trends *low* (F6). **Looks healthy while receiving zero automation.**

### B. Typical lazy agent (property + buyer/seller names, little else)
- If contacts have **no email**: identical to A on the automation side (silent skip everywhere) but every contact row reads amber **"Invite sent"** (§10 Finding 1) — agent believes clients are on the portal. Confirmation emails at each milestone silently skip them (§9 CF-1) and are **never retried** (§14).
- If contacts have email but no solicitors: client chase works; solicitor side silent no-op forever.

### C. Missing contact information (parties exist, some/all email+phone missing)
- No-email contact: dropped from all automated client comms (§4). Manual buttons disabled with honest tooltips (`ContactsSection.tsx:932-951`). **Mixed** — UI honest, automation silent. Agent-side "Invite sent" is replaced by honest "Portal link ready" only when *email* is null (§10 Finding 1) — so the misleading label is specifically the has-email-but-never-actually-invited case.
- No-phone: only manual call/SMS disabled. Graceful.

### D. Missing / incomplete solicitor (parties exist, solicitor absent or no email)
- Firm picked but **no handler contact**, or contact with **no email**: that side is never chased and never escalates (§9 SC-1). The Solicitors card looks complete (firm name shown); the only hint is a disabled Email button (`SolicitorSection.tsx:361`). **Silent, high-impact.**
- Work-queue *does* honestly flag `missing_vendor_solicitor` / `missing_purchaser_solicitor` when the **firm id** is null (`work-queue.ts:150-151`) — but not when a firm exists with no reachable contact.

### E. Abandoned upkeep (starts complete, agent stops updating after early stages)
- `onTrack` reads un-logged progress as *absent* progress ⇒ drifts to `at_risk`/`off_track` (F7). But `milestone_stalled`/`overdue_milestone` require `completedCount > 0` so they *can* fire here (unlike A) — this scenario is actually the best-detected. `long_silence` fires from last logged comm (F9). Reasonable, though it can't tell off-platform comms from real silence.

### F. Stale / contradictory (dates passed, milestones stale)
- Fabricated + un-refreshed `expectedExchangeDate` lapses ⇒ `overdue_exchange` + `stuck` (F2/F3). If genuinely stale, this is *correct* — but it fires identically on a never-touched file (A), so the agent can't tell "overdue" from "we never had a date". Hub "Stalled" query has **no new-file grace** (`hub.ts:237-283`) so even a today-created file with no confirmed steps counts as stalled — and disagrees with the work-queue, which *does* grace new files (`work-queue.ts:119-146`).

### G. Well-maintained control
- Everything works: milestones drive chase; confirmations email; predictions self-heal on each confirm (`refreshExpectedExchangeDate`); health/risk reflect real signals; analytics count the file. This is the intended path and it is solid.

**Cross-scenario takeaway:** the product cannot currently distinguish scenario **A (unknown)** from scenario **F (genuinely overdue)** on its risk/overdue surfaces, and it *under*-detects **A** on its stall surfaces. That single conflation is the spine of this audit.

---

## 6. Silent failures (highest priority)

Format: what the agent sees / what actually happens.

| # | Trigger | Agent sees | Actually happens | File | Sev |
|---|---|---|---|---|---|
| SF1 | Client contact missing email/token, or unsubscribed | Nothing chase-specific; ordinary reminder still in queue | Client never auto-chased; the built `no_email_on_contact` handback **never fires** — it is dead code | `client-chase-cron.ts:265-285,703`; reasons `reminders.ts:1341-1342` | **P1** |
| SF2 | File where every contact lacks email | File silently absent from chase pass | `if (txContacts.length === 0) continue` | `client-chase-cron.ts:378-379` | P2 |
| SF3 | Solicitor side has no contact, or contact has no email | Solicitors card looks done; disabled Email button only | That side never chased, never escalates, no `/s/` link ever minted | `chase.ts:261-267,352-354,198-209` | **P1** |
| SF4 | Client with no email at a milestone confirm | Milestone shows confirmed | Confirmation email skipped, send is `.catch(()=>{})`, no log, **no retry** | `portal.ts:2065-2066,1606` | P2 |
| SF5 | No milestones (tenure/type null at create) | Milestone ladder still renders (built from defs) | No completion rows ⇒ every client-chase rule `continue`s; solicitor steps never eligible | `client-chase-cron.ts:394-396`; `actions:288` | P2 |
| SF6 | Exchange-day client with no email | — | Neither 09:00 info nor 11:00 **authority** email sent on the most critical day | `exchange-day/client-send.ts:118-123` | P2 |
| SF7 | One bad file in client-chase pass | — | No per-file try/catch ⇒ one throw aborts the whole pass for all remaining files (solicitor cron isolates per group; client cron does not) | `client-chase route:35-42` vs `chase.ts:579-584` | P2 |
| SF8 | Outsourced file with no contact emails | — | "Getting your sale moving" intro never sends, no flag | `send-outsource-intro.ts:150` | P2 |

**Note on SF1's fake net:** the enum values, DB reason strings, activity-note copy and work-queue chips for `no_email_on_contact` / `no_portalToken_on_contact` / `client_opted_out` all exist and render; the only production caller of `createAgentChaseTaskForMilestone` hard-codes `client_emails_paused`. `docs/active/client-chase-arc-complete.md:202-203,413-416` asserts the net works. **The code and the docs disagree.** Either wire it or delete it + correct the docs.

---

## 7. Misleading states

The "unknown → bad" family, all rooted in one fabricated field.

- **F1 — `expectedExchangeDate` fabricated at create** (`transactions.ts:875-880,930`). Every file gets a firm 84-day target it never set. There is no "unknown target" state anywhere. **Root cause.** **VERIFIED** (I read the create path).
- **F2 — `overdue_exchange`** off `overridePredictedDate ?? expectedExchangeDate` (`work-queue.ts:112-117`). Any active file >84d with no override goes red "Exchange date overdue".
- **F3 — `isExchangeOverdueStuck`** (`exchange-prediction.ts:130-154`). A file with no confirmations never self-heals (`refreshExpectedExchangeDate` needs a confirm) and ages into `stuck:true`.
- **F4 — `calculatePhaseAwarePrediction` never returns null** (`fees.ts:254-281`); floors to `createdAt + 84d`. `isEarlyEstimate` softens *some* consumers (`fees.ts:344-345`, `chains.ts:433-435`) but the value written to the stored column carries no caveat (`exchange-prediction.ts:95-99`).
- **F7 — `onTrack` velocity** (`transactions.ts:183-193`): un-logged progress reads as *behind*. `completedCount===0 → "unknown"` (good) but any partial file with real-but-unlogged steps reads `at_risk`/`off_track`.
- **F9 — `long_silence` from file-start** (`problem-detection.ts:79-85`): no comms *logged* ⇒ measured from `createdAt` ⇒ off-platform comms read as silence. Copy ("No communication recorded") is more honest than the pill ("No contact").
- **F10 — Hub "Stalled" has no new-file grace** (`hub.ts:237-283`); a today-file with no confirmed steps counts as stalled and disagrees with the graced work-queue.
- **F12 — Chain-wide fabricated forecast** (`chains.ts:398-438`): a claimed-but-sparse link exposes a concrete `predictedExchangeDate` to **every** agency in the chain (not stripped per-viewer like price/stuck-step are), making the chain look more predictable than the data supports.
- **Finding 1 (portal) — "Invite sent" for every contact** (`ContactsSection.tsx:143-145,180-183`): `portalToken` is always minted, so the `"not_invited"` branch is unreachable; every fresh contact with an email reads amber **"Invite sent"** with a **"Resend invite"** button, even though the only send path is a manual POST that may never have happened. The schema has no `invitedAt` column, so it genuinely cannot tell "minted, never emailed" from "emailed". **MISLEADING STATE, P2.**

---

## 8. UI / empty-state problems

The UI is the strong part. Verdict from the component trace: graceful almost everywhere, with real contextual CTAs. Exceptions:

- **P2 — tenure / purchase-type recovery dead-end** (`HeroSaleFields.tsx:282`): when either is null both cells render `"–"` **read-only** (no pencil) because the inline editor needs a concrete from→to. Price stays editable; type/tenure do not. The `ReconcileLaterBanner` only mounts for **claimed** files and its modal *refuses* ("can't be set up until those are added") without offering an adder (`ReconcileLaterBanner.tsx:253,87`; `ReconcileLaterAsync.tsx:20`). `AgentFileSidebar` declares `canEditSaleDetails?` but never consumes it. So the two fields whose absence most degrades gating/prediction are the hardest to fix from the file. **NEEDS-CONFIRM:** docs reference an SP "edit sale details" drawer that can set tenure/type — not found wired on the current agent page; confirm before building a new adder.
- **P3 — StepsPanel bare error state** (`StepsPanel.tsx:23-25`): `"No milestone data available"` centred grey, no retry. But this is an *error* path only — `getMilestonesForTransaction` always returns populated arrays for a real file (built from definitions, `milestones.ts:614-743`), so a sparse file is not affected; only a swallowed query error hits it. Low priority.
- Everything else — contacts (`ContactsSection.tsx:1045-1051`), solicitors (`SolicitorSection.tsx:258-275`), documents, activity (`ActivityTimeline.tsx:279-288`), chain/onward (`OnwardPurchaseCard.tsx:195-231`), risk widget (`RiskScoreWidget.tsx:56-61`), file-health banner (returns null when nothing's wrong, `FileHealthBanner.tsx:85`) — all have honest empty states with contextual "Add" affordances and do **not** over-pester. This is a genuine strength and should be the model for the fixes below.

---

## 9. Automation / chasing impact

Covered in §6. Summary of the resilience posture per cron:

| Cron | Per-file isolation | Missing-data surfaced to agent? | Kill switch |
|---|---|---|---|
| client-chase | **No** (whole-pass try/catch) | No (fail-soft net is dead code — SF1) | `CLIENT_CHASE_ENABLED` |
| solicitor-chase | Yes (per group) | **No** (no fallback at all — SF3) | global + per-agency `solicitorChaseEnabled` |
| enquiries-chase/raise | route try/catch | No | shares SolicitorChaseSettings |
| exchange-day-emails | Yes (client/solicitor split) | No (SF6) | derived active-state |
| reminder engine | Yes (`allSettled` batches of 8) | Reason written to log, visible on file's reminders tab (good) | n/a |

The agent-side reminder engine is the one bright spot: it writes plain-English deactivation reasons the agent can read ("Waiting on a real date for the earlier step…", "Anchor milestone not yet confirmed" — `reminders.ts:633-679`). That is the *right* pattern; the crons should adopt it. All crons record success/failure to `JobRun`, visible only on the internal System status page — never to agents.

---

## 10. Portal / access impact

- **Client read path is genuinely resilient.** Missing price hides the costs card (`page.tsx:507`); missing dates null the hero/countdown (`:440-447,608`); missing milestones render "Pending"/"TBC" with no crash (`:419-423`); empty timeline hides the updates card (`:879`); photo-sign failure is caught (`portal.ts:297-300`). **GRACEFUL.**
- **Eligibility gates enforced server-side.** `getPortalDataInner` requires `portalEligible:true` in the token lookup (`portal.ts:238`); dead-round purchaser tokens show a friendly notice, not a 404 (`:335-345`). **Correct.**
- **"Your team" card is honest** — builds `solicitorMailto` only when email exists, else an add-email prompt (`PortalTeamCard.tsx:179-182`); deliberately shows nothing rather than leaking `updates@` when `Agency.quoteSenderEmail` is unset. **Correct.**
- **Misleading exception:** the *agent-facing* "Invite sent" state (§7 Finding 1). This is the one portal-layer thing that shows a party as reached when they weren't.
- **Solicitor `/s/` link** only exists as a byproduct of a chase send; no email ⇒ no link and no manual "copy solicitor link" affordance (`chase.ts:362`). Not misleading, but the impossibility is invisible.
- **Invite API is clean** (`api/portal/invite:46` hard 400 on no email) but the client caller has no error branch (`ContactsSection.tsx:565-574`) — a race where email is cleared between render and click fails silently. Minor.

---

## 11. Intelligence / calculation impact

The "unknown → healthy" family (mirror of §7):

- **F5 — `computeHealth` defaults green** (`health.ts:26-45`): `daysSinceLastActivity` is null when `lastActivityAt` is null, making the 14/28-day thresholds *unreachable* for a never-touched file ⇒ **green**. Conflates *missing contact* with *not unresponsive*.
- **F6 — `risk.ts`** (`risk.ts:36-45,87-107`): a distinct `no_data` level exists (good — GRACEFUL), but once *any* one signal appears, the null-valued others read as "fine", so risk trends *low* on sparse files.
- **F8 — stall detectors gate on data** (`problem-detection.ts:98,178`): `milestone_stalled` and `overdue_milestone` require `completedCount > 0` (and a non-null `lastMilestoneAt`). A zero-milestone file — the most data-starved — can never raise either flag. **False-healthy. P2.**
- **F11 — staleness proxy null** (`milestone-staleness.ts:59-70`): milestones with no prerequisites, or whose prereqs aren't in the lookup, get no slowness/staleness badge even if sitting for weeks (accepted in the v1 comment). Slowness half is dark anyway (`MEDIANS_READY=false`).
- **Correctly-unknown for contrast:** `getOnwardTrackerView` (`onward.ts:170-201`) returns a distinct `exists:false`; work-queue missing-solicitor alerts are labelled as *missing data* not *delay* (`work-queue.ts:150-151`); `summary.ts` falls back to "the vendor"/"the solicitor" with no fabrication. These are the model.

Conflation-pair verdict:

| Pair | Current behaviour | Direction |
|---|---|---|
| unknown target date vs behind schedule | F1→F2/F3/F4/F12 | missing → **BAD** |
| missing contact vs unresponsive | F5 green; F9 silence-from-start | mixed |
| no solicitor data vs solicitor delay | labelled "No solicitor" honestly | **UNKNOWN ✓** |
| missing milestone update vs confirmed-incomplete | F7 onTrack | missing → **BAD** |
| missing milestone data vs real stall | F8 gate; F6 risk | missing → **FALSE-HEALTHY** |
| missing chain data vs short/no chain | progress null-safe ✓; forecast F12 fabricated | mixed |

---

## 12. Analytics impact

Two distinct biases, plus a structural root cause:

- **A1 — unknown exchange date → today** (`analytics.ts:137-144`): `(completedAt ? … : new Date())` folds "exchanged with no date" into the mean as `today − createdAt`. **But `getAnalytics` is dead code** (no importer) — real but latent.
- **A2 — live speed metrics DROP poorly-dated files** (`analytics.ts:631-640,423-429`): `if (!completedAt) continue`. No zero-injection, but the average is computed over a self-selected *clean subset*. A busy-but-sloppy operation looks identical to a small-but-tidy one. **Survivorship bias, live.**
- **A3 — no sparse-file exclusion anywhere** (`analytics.ts:72`, `metrics-rollup.ts:133-141`): every aggregate filters `isMigrated:false` (+ `isDemo:false`) and nothing else. `isMigrated` exists precisely to keep low-quality backdated files out of velocity — but no equivalent guard exists for sparse organic files. **Structural root cause.** Grep confirms no `completenessScore`/`dataQuality`/`isSparse` concept exists.
- **A5 — solicitor fall-through understated** (`solicitor-intel.ts:130-139`, live, shown to agents choosing solicitors): a deal that collapsed but was left `active` (poor status hygiene) is excluded from `resolvedFiles`, so a genuinely risky firm shows an artificially *low* fall-through rate. **Moderate-High — poor hygiene makes bad solicitors look safe.**
- **A7 — platform rollups undercount** (`metrics-rollup.ts:184-214`): real exchanges with null `completedAt` never satisfy `gte`, so they vanish from the founder's daily brief / weekly review numbers. Safe from zero-injection but under-reports.
- **A8 — problem-detection can't separate neglected from poorly-logged** (`problem-detection.ts`): un-logged comms/progress read as risk, and these flags feed the founder AI briefs (`command/insights/context.ts:125-134`), laundering data-hygiene noise into "situations that need attention today".
- **A9 — `revenue_at_risk` fires CRITICAL on an unentered fee** (`signals/detectors/revenue-at-risk.ts:23-54`): an exchanged file where the fee was simply never typed produces a confidence-1.0 CRITICAL signal indistinguishable from a real revenue leak. Arguably intended (can't invoice without it), but the two are the same event to the founder.

---

## 13. Outsourced progression impact

This is the sharpest product gap, because on outsourced files **TSP's own staff** work the file, so completeness is TSP's problem, not the agency's.

- **O1 — no completeness threshold, and none stricter for outsourced** (`transactions.ts:865-944`): outsourced vs self differs only by three derived fields (`serviceType`, `outsourcedAt`, `progressedBy`). An agency can hand the SP team a file containing nothing but an address. **P2 (product gap).**
- **O2 — the assigning admin sees no completeness signal** (`hub.ts:1946-1949`, `UnassignedFilesView.tsx:130-148`): the unassigned-files widget shows only address + agency name + Assign. No "missing price/contacts/solicitor" triage, no way to bounce a thin file back to the agency. The progressor discovers gaps only after opening the file.
- **O3 — outsourced intro email silent no-op** (`send-outsource-intro.ts:150`): the "Getting your sale moving" client onboarding — the moment TSP proves value — silently fails on files with no contact emails, exactly the worst-maintained ones.
- **O4 — at-risk flags keyed to the customer agency, not the assigned progressor** (`detect-problems route:13-21`, `problem-detection.ts:227`, vs `access-scope.ts:37-42`): `detectAndStoreFlags(agencyId)` stores flags on the customer agency; the SP progressor's visibility is `assigned`-scoped with `agencyId:""` (`agent.ts:49`). **NEEDS-CONFIRM:** the surfacing path onto the SP's own hub wasn't established in the trace — confirm whether the progressor actually sees the at-risk intelligence for files they own.
- **O5 — internal/outsourced analytics inherit A2/A3** (`analytics.ts:29`): TSP's own view of how well it progresses outsourced files is measured on the clean subset only.

---

## 14. Recovery behaviour

The critical question: *if a chase was skipped yesterday because no email existed, and the email is added today, what happens?*

- **Client chase — recovers.** The cron re-evaluates from current state each run; once the email is added the contact re-enters `rawContacts` and the due chase (anchored on the milestone date) fires on the next run. No permanent loss of the *ongoing* chase. **Good.**
- **Solicitor chase — recovers similarly** once the contact + email are added, but nothing retroactively fires for the weeks it was silent.
- **Milestone confirmation email — PERMANENTLY LOST.** It is a one-shot fired at confirm time (`portal.ts:2065`). If a milestone was confirmed while the client had no email, adding the email later does **not** resend it. The client simply never learns that step happened. **This is the one true "permanently missed even after the info is added" case.**
- **Milestones on a tenure/type-null file — NOT recoverable via the app.** `savePurchaseTypeAction` writes only the column (`actions:1234-1253`); `confirmSaleDetailsAction` mutates existing rows and computes an empty delta against zero rows (`:1863`); the only late-init is draft promotion (`:1710`). There is no `saveTenureAction` and no editor re-runs `initializeMilestoneCompletions`. Combined with the §8 hero lock, a milestone-less file cannot be repaired from the file view.
- **`twelveWeekTarget` — never editable** after create.
- **Skipped-cron work is not queued for retry**; there is no dead-letter / "we couldn't do X, do it now" list.

---

## 15. Recommended completeness model

**Do not build a generic "File 72% complete" percentage.** The architecture already models unknown well in the best places (risk `no_data`, onward `exists:false`, honest empty states). A percentage would flatten meaningful differences and pester about harmless gaps.

**Recommended: a contextual, consequence-driven three-state model, computed per file, surfaced only where it bites.**

Define `FileCompleteness` as a small derived helper (mirrors `getAccessScope`'s shape — one function, one call site pattern):

- **Operationally complete** — TSP has what it needs to run every enabled automation for this file's current stage. No surface shown.
- **Missing useful information** — some features reduced, core progression fine. Surfaced *contextually and quietly*: an "Add buyer email to start client updates" affordance **at the contact**, not a file-level banner.
- **Action needed (blocking)** — a missing field is actively preventing a useful function *now*: e.g. a milestone that needs the solicitor was reached but the solicitor has no email; or the file is outsourced and has no contact emails. Surfaced as a real, dismissible item on the file and — for outsourced — to the assigning admin.

Crucially, keep **FILE COMPLETENESS** (do we have the data to operate?) strictly separate from **SALE HEALTH** (is the sale progressing?). Today they are conflated (F5/F8: a data-incomplete file reads as healthy; F2/F3: an incomplete file reads as overdue). The model's job is to split them: a sparse file should read **"we can't assess this yet — add X"**, never green and never red.

The building blocks already exist — `problem-detection` produces flags, the reminder engine writes plain-English reasons, work-queue already labels missing solicitors honestly. The work is (a) a completeness resolver, (b) making the intelligence layer defer to "unknown" instead of guessing, (c) contextual CTAs modelled on the existing empty states.

---

## 16. Progressive data collection strategy

Principle: **CREATE NOW → ENRICH NATURALLY → WARN ONLY WHEN BLOCKING.** Keep create cheap; ask for each field at the moment it first pays off.

| Field | First useful | Becomes necessary | Unlocks | Prompt when? |
|---|---|---|---|---|
| tenure + purchase type | at create (drives milestones) | at create (form already requires) | milestone engine, chase, gate | **immediately** (keep the form guard; add a late-init recovery path for non-form files) |
| buyer/seller email | at create | when the first client-facing milestone is confirmed | client chase, confirmations, portal invite, weekly update | **contextually** at the contact + a blocking prompt the first time a confirmation would have emailed them |
| solicitor firm + contact + email | when the first solicitor-dependent milestone approaches (~MOS/searches) | when a solicitor chase would fire | solicitor chase, escalation, `/s/` link, confirms | **contextually** when the anchor milestone completes; blocking only past that point |
| purchase price | at create (nice) | at exchange (billing snapshot) | fees, portal costs, pipeline value | quiet CTA; blocking only at exchange |
| expected exchange date | when there's enough signal to forecast | never mandatory | honest forecast | **never fabricate**; show "not enough to forecast yet" until real signal, then offer to set/confirm |
| completion date | at exchange | at exchange-day start (already throws) | exchange-day, completion | already correctly demanded at the point of use |
| chain | when a chain exists | never | cross-agency visibility | optional, as today |

The product should **reward** enrichment ("Add buyer email → we'll start updating them") rather than punish non-completion with a wall of required fields or a nagging percentage.

---

## 17. Prioritised fixes

**P1**
1. **Wire the client-chase fail-soft net (SF1)** — invoke the existing `no_email_on_contact` / `no_portalToken_on_contact` / `client_opted_out` handbacks in `runClientChaseCron`, or delete the dead code and correct `docs/active/client-chase-arc-complete.md`. (One or the other — the current state is a documented-but-absent safety net.)
2. **Solicitor missing-data handback (SF3)** — when a file passes a milestone that needs the solicitor but the side has no reachable contact, raise an agent ChaseTask/flag instead of silently excluding the file. Mirror the honest work-queue "No solicitor" pattern.

**P2**
3. **Stop fabricating `expectedExchangeDate` (F1)** — or, less invasively, mark the auto value as an estimate everywhere it's read (carry `isEarlyEstimate` onto the stored column and honour it in work-queue/hub/chain), and add a true "no target yet" state so F2/F3/F4/F12 stop reading unknown as overdue.
4. **Split completeness from health (F5/F8)** — give `computeHealth` and the stall detectors an explicit "insufficient data" outcome so a data-starved file reads "can't assess" rather than green, and so zero-milestone files are visible to stall surfaces.
5. **Recover milestone-less + tenure/type-null files (§8/§14)** — add a `saveTenureAction` (or make the hero cell editable-from-empty) and re-run `initializeMilestoneCompletions` when both fields land post-create.
6. **Honest invite state (Finding 1)** — add `Contact.invitedAt`, set it only on an actual send, and drive the contact chip off it so "Invite sent" means an invite was sent.
7. **Retry lost confirmation emails (§14)** — when a client email is added, offer/auto-send the confirmations for milestones already confirmed while they had no email.
8. **Per-file isolation in the client-chase cron (SF7)**; log skipped/failed confirmations to the activity feed (SF4).
9. **Outsourced completeness gate + assigning-admin signal (O1/O2)** — a handover checklist (price, both contacts with email, both solicitors) surfaced on the unassigned-files widget, with a "request from agency" action.
10. **Analytics: exclude or label sparse files (A3/A5)** — either a completeness filter parallel to `isMigrated`, or count-with-caveat; and base solicitor fall-through on a "known outcome" set that doesn't reward leaving dead deals `active`.

**P3** — StepsPanel error copy; hub "Stalled" new-file grace to match work-queue; `long_silence` distinguishing logged-silence from no-logging; chain forecast per-viewer stripping.

---

## 18. Exact implementation plan

Sequenced to respect the Laws (one concern per PR, staging-first migrations, no bulk rewrites). Each is a single-concern PR.

1. **PR A (P1, no migration): client-chase fail-soft.** In `runClientChaseCron`, at the point a contact is filtered for missing email/token/unsubscribe, route to `createAgentChaseTaskForMilestone` with the correct `fallbackKind`. Add a test asserting a missing-email contact produces a handback task. If instead we retire it: delete the enum branch + chips + reason strings and fix the doc.
2. **PR B (P1, no migration): solicitor missing-data handback.** In `findDueSolicitorChases`/the escalation pass, when an anchor completes but the side has no reachable contact, write a flag/task. Test with a firm-but-no-email fixture.
3. **PR C (P2, migration): `Contact.invitedAt`.** Add column (staging first), stamp in `api/portal/invite` on success, drive `ContactsSection` status off it. Backfill: leave null (honest "not invited"). Visual regression on the contact chip states.
4. **PR D (P2, no migration): unknown-target state.** Introduce an `exchangeTargetKind: "set" | "estimate" | "unknown"` derivation; make work-queue `overdue_exchange`, `isExchangeOverdueStuck`, and chain forecast honour it; suppress the red/overdue treatment when kind ≠ "set". Decide (Q1) whether to stop writing the +84d value entirely.
5. **PR E (P2, no migration): completeness ≠ health.** Add an "insufficient data" branch to `computeHealth` and to `milestone_stalled`/`overdue_milestone` (a zero-milestone file becomes a distinct "not set up" signal, not green and not stalled).
6. **PR F (P2, migration-light): tenure/type recovery.** `saveTenureAction` + editable-from-empty hero cell + re-run `initializeMilestoneCompletions` when both land. Idempotent init already handles re-entry (`milestones.ts:359-364`).
7. **PR G (P2, no migration): confirmation replay.** On client-email add, enqueue confirmations for already-confirmed milestones that skipped them.
8. **PR H (P2): outsourced handover checklist** on `UnassignedFilesView` + a completeness resolver `lib/services/file-completeness.ts` (single source, `getAccessScope`-style).
9. **PR I (P2): analytics completeness handling** — a shared `isDataComplete(tx)` predicate; apply to speed metrics and solicitor fall-through; caveat counts in the UI.
10. **PR J (P3 bundle): the smaller UI/copy items.**

Migrations (PRs C, F) go to staging first per Law 3.

---

## 19. Tests required

- **Chase fail-soft (PR A/B):** unit — a file with (i) no-email contact, (ii) no-token contact, (iii) unsubscribed contact each produce a handback task with the right `fallbackKind`; solicitor side with firm-but-no-email produces a flag. E2E — the work-queue renders the chip.
- **Unknown-target (PR D):** a fresh file with no override does **not** show `overdue_exchange` or `stuck`; a file with a real user-set date past due **does**.
- **Health/stall split (PR E):** a zero-milestone active file reads "insufficient data", not green and not stalled; a genuinely stalled file still flags.
- **Invite honesty (PR C):** a freshly created contact reads "not invited"; after a successful invite POST it reads "invite sent"; a no-email contact reads "portal link ready".
- **Recovery (PR F/G):** setting tenure+type post-create initializes milestones; adding a client email replays the missed confirmation.
- **Outsourced gate (PR H):** the unassigned widget shows the missing-data summary for a thin file.
- **Analytics (PR I):** a sparse/undated file is excluded from (or caveated in) speed + fall-through aggregates; well-maintained files unaffected.
- **Regression:** the existing well-maintained control file (Scenario G) is unchanged across all PRs (Law 17/18 baseline).

---

## 20. Decisions / questions for you

1. **Fabricated exchange date:** stop writing the +84d value entirely (cleanest, but every consumer must handle null), or keep writing it but tag it as an estimate and add an "unknown" state (less invasive)? This is the single highest-leverage decision.
2. **Client-chase fail-soft net:** wire the existing `no_email_on_contact` handbacks (net becomes real), or delete them and accept "agent-side reminder is the only signal"? The docs currently claim the former.
3. **Outsourced completeness:** do you want a genuine gate (block/flag handover until a minimum set exists), or only a *signal* to the assigning admin with a "request from agency" nudge, leaving files acceptable but marked?
4. **Milestone confirmation replay:** when a client email is added late, auto-send the confirmations they missed, or only offer a one-click "catch them up"? (Auto could surprise a client with a burst of historical emails.)
5. **Sparse-file analytics:** exclude sparse organic files from aggregates (survivorship is honest but hides volume), or include-with-caveat (shows volume but needs UI treatment)? Ties to whether we introduce a `isDataComplete` flag parallel to `isMigrated`.
6. **NEEDS-CONFIRM before building:** (a) is there an existing SP "edit sale details" drawer that already sets tenure/type on the agent file page (§8)? (b) Does the SP progressor actually see the customer-agency `TransactionFlag` at-risk intelligence for files they own (§13 O4)? Both change the scope of PR F and any O4 fix.

---

## Summary table

| Issue | Missing/stale data | Current behaviour | User sees | Real consequence | Severity | Proposed fix |
|---|---|---|---|---|---|---|
| SF1 client-chase net dead | contact email/token | contact filtered out at SQL; handback never fires | ordinary reminder only | client silently never auto-chased; documented net absent | **P1** | wire handback or delete + fix docs |
| SF3 solicitor silent no-op | solicitor contact/email | side excluded from chase; no escalation | Solicitors card looks done | solicitor never chased, forever | **P1** | missing-data handback/flag |
| F1 fabricated exchange date | none entered | stamped +84d at create | firm exchange target | unknown reads as overdue/stuck everywhere | P2 | stop/tag as estimate + unknown state |
| F2/F3 overdue/stuck | no override, no confirms | red "overdue"/"stuck" off fabricated date | file at risk | can't tell unknown from genuinely late | P2 | honour target-kind |
| F5/F8 unknown→healthy | no activity/milestones | health green; stall detectors gated on completedCount>0 | "on track" dot | emptiest files evade all warnings | P2 | insufficient-data state |
| Finding 1 invite | never actually invited | token always minted → "Invite sent" | client believed on portal | agent thinks clients contacted; can't tell | P2 | `Contact.invitedAt` |
| SF4/§14 confirm lost | client email absent at confirm | one-shot email skipped, no retry | milestone confirmed | client never told; permanent even after email added | P2 | replay on email add + log skips |
| SF5/§14 no milestones | tenure/type null at create | zero completion rows; unrepairable in app | milestone ladder still renders | no chase/gate; can't be fixed from file | P2 | saveTenureAction + re-init |
| SF6 exchange-day | client email absent | 09:00 + 11:00 authority email skipped | — | client misses exchange-day authority ask | P2 | fallback + log |
| SF7 cron abort | one malformed file | no per-file try/catch | — | whole client-chase pass aborts | P2 | per-file isolation |
| O1/O2 outsourced | any missing data | no threshold; admin sees address only | thin file assignable | SP works a file they can't progress | P2 | handover checklist + signal |
| A5 fall-through | dead deal left active | excluded from denominator | low fall-through | bad solicitors look safe | P2 | known-outcome set |
| A3 sparse analytics | undated/sparse files | counted (or dropped) as real | clean-subset averages | metrics mislead on hygiene | P2 | completeness predicate |
| §8 hero lock | tenure/type null | cells read-only "–" | no way to add | linchpin fields hardest to fix | P2 | editable-from-empty |
| F12 chain forecast | sparse claimed link | fabricated date shown chain-wide | confident forecast | chain looks more predictable than real | P3 | per-viewer strip / estimate tag |
| F10 hub stalled | new file | counted stalled, no grace | "stalled" | fresh files falsely stalled; disagrees w/ work-queue | P3 | new-file grace |
| F9 long_silence | comms off-platform | measured from createdAt | "no contact" | off-platform comms read as silence | P3 | distinguish no-log from silence |
| StepsPanel | query error | bare grey message | "No milestone data" | actionless error state | P3 | retry/explain |

---

## Top 10 recommended changes (priority order)

1. **Wire (or retire) the client-chase fail-soft net** — SF1. The one place code and docs disagree about a safety net.
2. **Solicitor missing-data handback** — SF3. The deepest invisible hole: a file whose solicitor email was never entered is never chased, forever, with no warning.
3. **Stop treating a fabricated exchange date as real** — F1 → F2/F3/F4/F12. Introduce a true "unknown target" state so unknown stops reading as overdue across hub, work-queue and chain.
4. **Split file-completeness from sale-health** — F5/F8. A data-starved file must read "can't assess yet", never green and never red.
5. **Honest invite state** — Finding 1. `Contact.invitedAt`, so "Invite sent" means an invite was sent.
6. **Recover milestone-less / tenure-type-null files** — §8/§14. `saveTenureAction` + editable-from-empty hero + re-init.
7. **Replay lost confirmation emails** on late email-add, and log skipped confirmations — SF4/§14. The only permanent data-loss case.
8. **Outsourced handover checklist + assigning-admin signal** — O1/O2. A different completeness bar for the tier where TSP does the work.
9. **Per-file isolation in the client-chase cron** — SF7. One bad file must not silence the pass.
10. **Analytics: exclude-or-caveat sparse files, and fix solicitor fall-through** — A3/A5. Stop poor hygiene from making bad solicitors look safe.

*(End of Part I. No code has been changed.)*

---
---

# Part II — Founder decisions, resolved confirmations & final plan (2026-09-01)

This part records the founder's review decisions, a second round of forensic tracing that resolved both NEEDS-CONFIRM items and answered five follow-up questions, and the final PR sequence. **It supersedes Part I Sections 17, 18, 20 and the Top-10.** No code has been changed.

## II.0 Decision log

1. **12-week target is intentional — keep it.** Every sale targets 12 weeks from submission. The problem is not a fabricated date; it is that the *live prediction* is muddled with the *target* in naming and in one client-facing label. Reframed in II.1.
2. **Client-chase fail-soft — wire it**, but confirm exactly where it surfaces and prevent noise. Confirmed in II.5.
3. **Solicitor missing-data — surface it, but consequence-driven, not nagging.** Design in II.5.
4. **Outsourced — confirm current gating and close the loophole with ONE standard at the point TSP accepts the file.** Audit in II.4.
5. **Historical client emails — do NOT replay.** Resume from now on. Remove old PR G. Applied in II.8.
6. **Analytics — include with honest per-metric eligibility/coverage disclosure**, not silent exclusion. Model in II.7.
7. **Completeness ≠ sale health.** No generic % score, no banner sea. Preserve good empty states.
8. **Portal invite state — prioritise; "Invite sent" must mean sent.** Truthful states in II.6.
9. **Tenure/purchase-type recovery — resolve NEEDS-CONFIRM first, then smallest correct fix.** Resolved in II.2.
10. **Client-chase cron isolation — keep, and keep failures observable internally.**
11. **Resolve SP at-risk flag visibility from code.** Resolved in II.3.
12. **Do not redesign the good read-side empty states.** Only change UI where it lies, blocks an action, has no recovery route, or genuinely needs operational-readiness surfacing.

## II.1 Corrected exchange-date architecture (supersedes Part I §7 F1–F4/F12 framing)

The 12-week target is a deliberate product rule and stays. The real defect is **muddled semantics across four columns**, one of which is dead and one of which is client-facing-mislabelled. Traced across every read/write site.

| Field | What it means TODAY (proof) | What it SHOULD mean |
|---|---|---|
| `expectedExchangeDate` (`schema:319`) | **Muddled.** Born as `createdAt+84d` = the target (`transactions.ts:875-880,930`), then **overwritten on every milestone confirm** by `refreshExpectedExchangeDate` with the live phase-aware prediction, floored at the target (`exchange-prediction.ts:95-100`, `fees.ts:280`). So it is really **the persisted, self-healing prediction** wearing the word "expected". Reset to `relist+84d` on relist. | **(B) the persisted live prediction.** Its name should say so. |
| `twelveWeekTarget` (`schema:343`) | Pure immutable target `createdAt+84d` (`:876-877,953`). **No editor. Not reset on relist** (goes stale after a relist). Barely read — `calculateProgress` recomputes the target fresh instead of reading the column (`fees.ts:322-324`); only real consumers are the SLA hit-rate (`hub.ts:1327-1329`) and a diary guard. | **(A) the 12-week target/SLA benchmark.** Correct concept; reset it on relist; surface it wherever client/agent copy says "target". |
| `predictedExchangeDate` (`schema:344`) | **Dead column — never written to the DB anywhere.** The name "predicted" is also used for an in-memory computed value (`fees.ts:334`) which is a different thing. A dead fallback term survives at `command/files.ts:173` (`override ?? predicted ?? expected`, middle term always null). | Either **drop it**, or adopt it as the honest home of the prediction (see migration note). |
| `overridePredictedDate` (`schema:345`) | Manual agent override; wins via `override ?? expected` everywhere. Correct. | **(C) manual override of the prediction.** Correct. |
| `completionDate` (`schema:346`) | Actual agreed completion date; cleared on relist. Correct. | **(D) actual agreed completion date.** Correct. |

**Where the wrong field is used**

- **Client-facing bug (highest priority in this cluster):** the portal hero renders `override ?? expectedExchangeDate ?? computed-prediction` **under a label that literally reads "12-week target"** (`portal/[token]/page.tsx:440-447`, `PortalOverviewHero.tsx:699`). The value shown is the drifting prediction; the label promises a fixed target. This is exactly the target-vs-prediction conflation to fix. The true `twelveWeekTarget` is never shown to the client.
- **`overdue_exchange` alert** (`work-queue.ts:112-117`) and **`isExchangeOverdueStuck`** (`exchange-prediction.ts:130-154`) both compare against `override ?? expectedExchangeDate` — i.e. the **prediction**, not the target. That is defensible ("past what we now expect, and gone quiet") but it is not "past the 12-week target", and the two are currently indistinguishable.
- **The one correct model to copy:** `OverviewPanel.tsx:268-272` "running late" banner compares the computed **prediction vs computed target** (>14d slip), both from `calculateProgress`, not the muddled columns. The SLA hit-rate (`hub.ts:1327-1329`) correctly uses `completionDate <= twelveWeekTarget`.

**What each concept should compare against**

- **"Behind target"** → `twelveWeekTarget` (the SLA benchmark; a soft, expected-sometimes signal).
- **"Prediction"** → the self-healing predicted date (today stored in `expectedExchangeDate`).
- **"Overdue / stuck"** → `override ?? prediction` **with no recent milestone movement** (past even our realistic expectation *and* quiet). Keep this comparing against the prediction, not the target.
- **"Agreed"** → `completionDate` (and, at exchange, the real exchange event).

**Redundancy & migration verdict**

- `predictedExchangeDate` is a **dead column** and its dead fallback term (`command/files.ts:173`) should be removed regardless.
- `expectedExchangeDate` and `twelveWeekTarget` are duplicative *at create* but then hold two genuinely different concepts — not redundant, but treated as interchangeable in the one client-facing place that matters.
- **No schema migration is strictly required for correctness.** The concepts are already separable. The correctness fixes are consumer-side: (a) the portal keeps its existing "12-week target" label but points it at the true `twelveWeekTarget` (framed as a goal/window), and the live prediction is shown as its own clearly-labelled **Estimate** line — see II.11 Q-B for the full card design; (b) drop the dead `predictedExchangeDate` fallback; (c) reset `twelveWeekTarget` on relist. The optional clarity rename is **dropped from scope** per Q-A.

## II.2 Resolved NEEDS-CONFIRM #1 — tenure/purchase-type recovery

**Confirmed: no safe in-app recovery path exists** for an already-active file with zero `MilestoneCompletion` rows.
- `savePurchaseTypeAction` (`transactions.ts:1234-1253`) writes the column only; never sets tenure; never initialises rows.
- `confirmSaleDetailsAction` (`:1863-2110`) sets both columns (`:1941-1944`) but every milestone mutation is find-then-**update** with no create — a no-op against zero rows. The hero UI also can't reach it (`HeroSaleFields.tsx:282,305` hard-return when either field is null).
- The only initialiser (`promoteDraftAction`) is draft-gated.
- `initializeMilestoneCompletions` **is idempotent** (`milestones.ts:378-407`: per-def find-then-skip + P2002 swallow), so re-running it on a file that has some rows is safe.

**No existing SP "edit sale details" drawer sets tenure unconditionally** — the docs reference was stale; the drawer reuses the same both-must-be-set gate.

**Minimal fix (unchanged from Part I PR F, now confirmed):** a dedicated `recoverSaleSetupAction` (scope-guarded via `scopeOwnershipWhere`) that sets the missing field(s) then calls `initializeMilestoneCompletions(...)`; plus make the hero cell editable-from-empty, routing the *first* set through this action (the delta/confirm path is only meaningful for from→to changes). Do **not** add creates to `confirmSaleDetailsAction`.

## II.3 Resolved NEEDS-CONFIRM #2 — SP at-risk flag visibility

**Determinable statically — no runtime check needed.** An assigned Sales Progressor's exposure to stored `TransactionFlag` intelligence for files they own is **partial**:

- **YES — the "gone quiet" family** (`long_silence`, `portal_gone_quiet`, `no_portal_activity`) reaches the SP's hub via `getGoneQuietFiles` (`hub.ts:523-592`), which is **transaction-scoped** (`assignedUserId`) and deliberately drops the agencyId for internal staff (`:538-541`, the FU-05 fix).
- **NO — the other five kinds** (`milestone_stalled`, `chase_unanswered`, `exchange_approaching_gaps`, `on_hold_extended`, `overdue_milestone`). Their only consumers are `getActiveFlags`→weekly brief (directors/negotiators only; SP excluded, `agent-weekly-brief.ts:82-96`) and `getHubFlags` (**unused**, and agency-keyed so empty for an SP whose `vis.agencyId=""`).
- **Separately**, the file page an SP opens (`app/agent/transactions/[id]/page.tsx`) shows a **live** at-risk banner (`FileHealthBanner` via `OverviewPanel.tsx:393`) computed from the loaded transaction's milestones + reminders — this works for an SP but is a *different, live-computed* system, not the stored `TransactionFlag` data.

**Root asymmetry:** `getGoneQuietFiles` branches on `vis.internalMode` to drop the agencyId; `getHubFlags`/`getActiveFlags` do not. **Fix (O4):** give the SP hub a transaction-scoped read of the remaining flag kinds by extending the same `internalMode` agencyId-drop pattern (either wire `getHubFlags` for internal staff with `buildTxNested`, or add the missing kinds to the gone-quiet-style query). Low-risk; reuses an established, already-fixed pattern.

## II.4 Outsourced handover route audit + the loophole

**The loophole is real, and there are four ways to land an under-specified outsourced file.** `serviceType` is a pure derivative of `progressedBy` and is validated server-side in **zero** of its writers; the NewSaleFlow outsourced gate is **client-side only**.

| Route | file:line | Validation server-side? | Loophole |
|---|---|---|---|
| Create via NewSaleFlow | `NewSaleFlow.tsx:828-843` (client) → `createTransactionAction:108` | **No** (client-only; server checks only `contacts.length>0` at `:259`) | **Yes** (any non-NewSaleFlow caller) |
| Convert self→outsourced | `switchServiceTypeAction:1135-1196` | **No** (only role + active-status guards) | **Yes — the suspected one** |
| Migrate Sale (admin) | `createTransactionAction` via `MigrateSaleForm` | **No** | Yes |
| Promote draft | `promoteDraftAction:1595-1722` | **No** | Yes |
| Assign SP / assign progressor | `assignUserAction:1080`, `assignProgressorAction` | n/a (doesn't set serviceType) | No |
| Outsource lead form | `app/outsource/actions.ts` | Sends email only; no tx created | No |

**The single gate.** The founder wants ONE standard at the point TSP accepts the file. That point is the transition into `serviceType:"outsourced"` on a **live** (`active`) file. Recommendation: a server-side `assertOutsourcedHandoverReady(transactionId)` that reads **persisted** data (not caller input, since `switchServiceTypeAction` only receives an id) and is invoked from `createTransaction` (when `progressedBy !== "agent"`), `switchServiceTypeAction`, and `promoteDraftAction`. Drafts (`saveDraftAction`) stay exempt so WIP can be parked.

**Minimum handover standard** (classified by what SP automation actually consumes):

| Field | Class | Why |
|---|---|---|
| Vendor name; Purchaser name | **REQUIRED** | Every email/portal token + milestone addressing needs a named person. |
| Vendor phone-or-email (≥1); Purchaser phone-or-email (≥1) | **REQUIRED** | Client chase cannot start without a channel (email preferred). |
| Tenure; Purchase type | **REQUIRED** | The whole milestone engine + auto-NR + exchange gate depend on both. |
| Vendor / purchaser solicitor firm + contact + email | **CAN FOLLOW LATER** | Solicitor chase is downstream; often unknown at handover. Gate the *chase*, not the *handover* (see II.5). |
| Purchase price | **CAN FOLLOW LATER** | Load-bearing only at exchange (billing); `savePriceAction` captures it later. |
| Share-of-freehold | **OPTIONAL** | Only meaningful when leasehold; defaulted false. |

If a file fails the standard, **hold the handover with a concise checklist** rather than accept it and have progressors chase the agency afterwards.

## II.5 Where the client-chase handback surfaces (+ the required auto-clear + the solicitor home)

**Client handback (`createAgentChaseTaskForMilestone`, `reminders.ts:1392-1494`):** writes/updates one `ReminderLog` + one `ChaseTask` (`fallbackKind`) + one activity note, **idempotent, keyed per (transaction, milestone-rule)** — not per contact. It therefore **decorates the file's existing reminder row with an amber pill**; it does **not** create a second row. It surfaces in two places with identical mapping:
- `/agent/work-queue` (`AgentRemindersList.tsx:478-496`)
- the file's **Reminders tab** (`RemindersSection.tsx:467-485`)

**Duplicates: safe** (idempotent + per-milestone in-run dedupe `client-chase-cron.ts:697-702`). **Auto-clear: NOT safe as-is** — `fallbackKind` is never reset anywhere (`grep fallbackKind: null` → 0 hits); after the agent adds the email the chip lingers until the milestone completes. **So wiring requires an auto-clear step first:** on the cron pass, when a contact that previously triggered a data-gap fallback now passes the query, cancel the matching pending fallback `ChaseTask` (or clear `fallbackKind` and let normal flow resume).

**Copy:** current chip reads "No email (manual)". Change to the founder's consequence-framing, e.g. **"Add buyer email to enable client updates"** / **"Add seller email to enable client updates"**, so it reads as an action, not an error.

**Solicitor handback — use a different, self-clearing home.** There is no ChaseTask path for solicitors. The right surface is the **derived `FileAlertsStrip`** (`work-queue.ts:149-151` → `FileAlertsStrip.tsx`), which recomputes from live null-checks on every load and **auto-clears** the instant the data is added — sidestepping the client-side lingering problem. But the existing `missing_*_solicitor` alert fires on *any* active file from day one, which would nag. **Make it consequence-driven:** add a new stage-aware alert that fires **only once the file reaches the milestone at which TSP would actually chase that solicitor** and the solicitor email is missing — i.e. the anchor milestone for that side's solicitor chase is complete but there is no reachable solicitor contact. That is "your missing info is now preventing something", not "you haven't filled this in".

## II.6 Truthful portal invite states (no new column required)

**Confirmed: a manual invite (`/api/portal/invite`) records nothing durable** — it uses bare `sendEmail` (no `AgentEmailLog`, no `OutboundMessage`, no Contact field write; only a PostHog ping). So today "Invite sent" is derived from `portalToken != null` (always true) and is untruthful.

**But the truth is already largely derivable from existing data:**
- **Automated milestone emails always carry the client's portal link** and log a durable per-contact `OutboundMessage` (`portal.ts` `logAutomatedEmail`, `:157-208`) — defensible proof the client has been sent their link.
- `Contact.lastVisitedPortalAt` (+ `PortalVisit`) is a reliable "they've opened it" signal.

**Recommended truthful states, minimal DB (Option 1 — no migration):**

| State | Source |
|---|---|
| NOT INVITED | no client-facing email `OutboundMessage` referencing the contact, and no manual invite recorded |
| PORTAL LINK READY | token exists but no email carrying the link has gone out (e.g. no email address, or none sent yet) |
| INVITE SENT | any client-facing email `OutboundMessage` whose `contactIds` includes this contact (unifies automated milestone emails **and** the manual invite) |
| PORTAL ACTIVE | `lastVisitedPortalAt != null` (reliable) |

**The one code change to make it fully truthful:** make `/api/portal/invite` write an `OutboundMessage` on send (the helper + model exist — **no migration**). Then drive the contact chip off `OutboundMessage` + `lastVisitedPortalAt` instead of token existence. A new `Contact.invitedAt` column is **not** needed.

## II.7 Analytics eligibility model (include with honest coverage)

Every live metric already carries a `count`, so "78 days, based on 55 of 100" is cheap. Live vs dead confirmed: `getAnalytics` and `getAvgDaysToExchange` are **dead**; the live speed figure is computed client-side (`AnalyticsClientShell.tsx:225-239`); solicitor metrics (`solicitor-intel.ts`) and platform rollups (`metrics-rollup.ts`) are live.

| Metric | file:line | Eligibility rule + disclosure |
|---|---|---|
| Speed to exchange (live) | `AnalyticsClientShell.tsx:225-239` | Keep including; disclose "avg X days, based on N of M exchanged files with a recorded date". Show the base (survivors ÷ total) so survivorship is visible. |
| Solicitor exchange stats (live) | `analytics.ts:381-446` | Show exchanges **as a share of files handled** (add the firm's total-file denominator next to the survivor count). |
| Solicitor median weeks (live) | `solicitor-intel.ts:99-152` | Keep the ≥2 floor; add total-files context so "2 of 40" isn't read as representative. |
| **Solicitor fall-through (live) ⚠️** | `solicitor-intel.ts:130-139` | **The founder's key concern.** A dead deal left `status=active` is excluded from numerator AND denominator, so a bad solicitor whose deals silently rot looks *safe*. Keep the ≥5 floor, but **flag long-stalled unresolved `active` files** as "unresolved — rate may understate risk" and surface the coverage denominator, so poor hygiene can't launder a bad firm into a clean record. |
| Platform rollups (live) | `metrics-rollup.ts:171-214` | These are event counts, not averages; null dates simply aren't counted. No eligibility rule needed. |

Two shared changes make disclosure honest not cosmetic: (1) show the **base rate** (survivors ÷ total files) next to every average; (2) fix fall-through so silent death isn't neutral.

## II.8 Removed from the plan

**Historical confirmation-email replay (old PR G / Part I recommendation #7) is REMOVED** per Decision 5. When a client email is added late, normal comms simply resume from that point; no retrospective burst. We may keep an **internal-only** log line noting earlier comms were skipped (audit/debug), but no client-facing catch-up. No other part of the plan implies retrospective client communication (the client-chase fail-soft creates an agent *task*, not a backdated send; the auto-clear cancels a task, it does not send anything).

## II.9 Revised Top 10

1. **Client-chase cron per-file isolation** (+ keep failures observable in `JobRun`). *Pulled earlier than the founder's list because it de-risks everything else that touches the same cron.*
2. **Client-chase missing-data fail-soft** — wire the existing handbacks **with the new auto-clear step** and consequence-framed copy (II.5).
3. **Solicitor missing-data, consequence-driven** — stage-aware `FileAlertsStrip` alert that fires only when TSP has reached the point it should chase (II.5).
4. **Correct target-vs-prediction semantics** — fix the portal "12-week target" label, drop the dead `predictedExchangeDate` fallback, reset `twelveWeekTarget` on relist (II.1).
5. **Completeness ≠ sale health** — add an explicit "insufficient data" outcome to `computeHealth` and the stall/overdue detectors so a data-starved file reads "can't assess yet", never green and never overdue.
6. **Truthful portal invite status** — invite route writes `OutboundMessage`; chip driven off comms + `lastVisitedPortalAt` (II.6).
7. **Tenure/purchase-type recovery** — `recoverSaleSetupAction` + editable-from-empty hero + idempotent re-init (II.2).
8. **Outsourced handover gate** — `assertOutsourcedHandoverReady` at the single accept-the-file point (II.4).
9. **SP at-risk flag visibility** — extend the `internalMode` agencyId-drop so an SP sees the remaining flag kinds for files they own (II.3).
10. **Analytics eligibility/coverage** — base-rate disclosure + solicitor fall-through hygiene guard (II.7).

## II.10 Final PR sequence

Each is a single-concern PR (Law 5); migrations staging-first (Law 3); no bulk rewrites (Law 16). Ordered for dependency safety.

| PR | Concern | Migration? | Depends on |
|---|---|---|---|
| **PR 1** | Client-chase cron per-file isolation + observable failure counts | No | — |
| **PR 2** | Auto-clear for resolved fallback tasks (cancel pending fallback `ChaseTask` when the blocker clears) | No | PR 1 |
| **PR 3** | Wire client-chase fail-soft handbacks (`no_email_on_contact` / `no_portalToken_on_contact` / `client_opted_out`) + consequence-framed chip copy | No | PR 2 (auto-clear must exist first) |
| **PR 4** | Solicitor consequence-driven missing-data alert (stage-aware `FileAlertsStrip`) | No | — |
| **PR 5** | Exchange-date semantics: point the portal "12-week target" label at the true target + add a separate soft **Estimate** line (per Q-B card states), drop dead `predictedExchangeDate` fallback, reset `twelveWeekTarget` on relist | No | — |
| **PR 6** | Completeness ≠ health: "insufficient data" outcome in `computeHealth` + stall/overdue detectors | No | — |
| **PR 7** | Truthful portal invite: `/api/portal/invite` writes `OutboundMessage`; contact chip states from comms + `lastVisitedPortalAt` | No | — |
| **PR 8** | Tenure/type recovery: `recoverSaleSetupAction` + editable-from-empty hero + idempotent re-init | No | — |
| **PR 9** | Outsourced handover gate: `assertOutsourcedHandoverReady` wired into create/switch/promote; concise checklist UI | No | — |
| **PR 10** | SP at-risk flag visibility: extend `internalMode` agencyId-drop to remaining flag kinds | No | — |
| **PR 11** | Analytics eligibility: base-rate disclosure + solicitor fall-through hygiene guard | No | — |

Notable: **no migration is required for any PR in this plan.** (The optional `expectedExchangeDate` rename was dropped from scope per Q-A.)

## II.11 Founder decisions — RESOLVED (2026-09-01)

- **Q-A — Exchange-date rename? → RESOLVED: fix consumers now, no rename.** Keep the columns as-is; PR 5 fixes usage only. The optional clarity rename (PR 12) is **dropped from scope** unless it later proves worthwhile. No migration in this project.
- **Q-B — Portal date card? → RESOLVED: show BOTH, keep the existing "12-week" label.** The portal already has a "12-week target" label — the ONLY bug is that the number under it is currently the moving prediction, not the target. Fix: the "12-week" label shows the true `twelveWeekTarget` (framed as a goal/window, "within 12 weeks", NOT a hard gospel date), and the live prediction appears as its own clearly-labelled soft **Estimate** line (month-level early, tightening later). When an agent sets a firm agreed date (`overridePredictedDate`), that becomes the headline. On exchange day, use the existing exchange-day "exchanging today" state. The change-notification email fires **only** when the estimate moves (the target never moves, so never emails) — no double-notifying.
  - Concrete card states:
    - Early/mid: `12-week target: within 12 weeks (by [date])` + `Estimated exchange: around [month]`
    - Firm date agreed: `Exchange date: [exact date]` (target shown secondary)
    - Exchange day: `Exchanging today` (existing state)
    - Post-exchange: `Exchanged [date] · Completion [date]`
- **Q-C — Outsourced gate on existing thin files? → RESOLVED: gate new files only.** There are no existing thin outsourced files to worry about (pre-launch). No Command Centre backfill list. The gate applies going forward only.
- **Q-D — Solicitor alert threshold? → OPEN (implementation detail, not a blocker).** Founder chose consequence-driven (Option A): only warn once the sale reaches the stage TSP would actually chase the solicitor. Before building PR 4, I will confirm from the solicitor-chase rules the exact anchor milestone per side at which chasing begins, and show the specific milestone codes to the founder for a yes/no. This is the only remaining sign-off, and it is scoped inside PR 4.

*(End of Part II decisions. All four founder decisions resolved; only the PR 4 solicitor-trigger milestone codes await confirmation, to be surfaced at build time.)*

---

## II.12 Implementation status (updated 2026-09-02)

Work is on the `staging` branch, **committed but NOT pushed** (nothing is live or on the shared staging deploy). Commits are interleaved with a second contributor working concurrently in the same repo (modals + solicitor/email files).

**Shipped (committed to `staging`, tsc-clean, hooks passed):**
| PR | Commit | What |
|---|---|---|
| PR 1 | `f2c55886` | Client-chase cron per-file isolation + `failures` count |
| PR 2 | `ff965f14` | Auto-clear manual-handoff markers (`clearFallbackForMilestone`) when a milestone is chaseable again |
| PR 3 | `3022020d` | Wire client-chase fail-soft handbacks for unreachable clients + consequence-framed chip copy |
| PR 5a | `7e2ff387` | Date hygiene: drop dead `predictedExchangeDate` fallback + reset `twelveWeekTarget` on relist |
| PR 9 | `40711744` | Single server-side outsourced handover readiness gate (create/switch/promote) + 9-case unit test |

**Deferred (with reason) — need founder input or review before building:**
- **PR 4 — solicitor missing-data alert.** Needs sign-off on the exact anchor milestone per side that means "we should now be chasing the solicitor" (Q-D). Also the concurrent contributor is actively editing `lib/solicitor-confirm/chase.ts` / `lib/email.ts`, so building here now would collide.
- **PR 5b — portal date card (target + estimate).** Client-facing, the most sensitive surface; wants a mockup review before shipping. Card design agreed in II.11 Q-B; needs an eyeball on presentation.
- **PR 6 — completeness ≠ health.** Finding: `lib/services/health.ts` (`computeHealth`/`HEALTH_CONFIG`) is **dead code** — nothing imports it, and `risk.ts` already has a correct `no_data` state. The real live gap is the stall/overdue detectors in `problem-detection.ts` gating on `completedCount > 0`, which changes signals feeding the operational hub + founder AI briefs — review before altering.
- **PR 7 — truthful portal invite status.** Agent-facing UI (`ContactsSection`). Plan (II.6): write an `OutboundMessage` on manual invite send, derive chip from comms + `lastVisitedPortalAt` (no new column). Straightforward; left for a reviewed morning build.
- **PR 8 — tenure/type recovery.** New `recoverSaleSetupAction` + editable-from-empty hero. Additive; touches `HeroSaleFields.tsx` (concurrent contributor territory) so held to avoid collision.
- **PR 10 — SP at-risk flag visibility.** Extends the `internalMode` agencyId-drop; changes what SPs see on the hub — review first.
- **PR 11 — analytics coverage + fall-through hygiene.** Changes reported numbers (base-rate disclosure, fall-through hygiene guard) — review first.

**Net:** the two P1 silent-failure holes (client-chase fail-soft + isolation) and the outsourced loophole are closed and tested. The remaining items are either client-facing, live-signal-changing, or awaiting the PR 4 trigger sign-off.

*(No code pushed. Local `staging` commits only.)*
