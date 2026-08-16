# Client Portal — Feature Ledger

**Standing record of what we're building, deferring, and deliberately not doing on the buyer/seller portal.**

Read this before proposing any portal feature. If an idea is already on the "Not doing" list, don't raise it again. If it's "Deferred", note the trigger before suggesting we start. Add new decisions here as they're made — one line of rationale each, dated.

Last updated: 2026-08-16 (created from the portal feature audit).

Legend: ✅ Approved / queued · ⏸ Deferred (wanted, not now) · ❌ Not doing (declined)

---

## ✅ Approved / queued to build

| Idea | Decision & notes | Date |
|---|---|---|
| **Post-completion review request** | On the completion page ([`complete/page.tsx`](app/portal/[token]/complete/page.tsx)) — highest-intent moment. Ask for a Google/Trustpilot review. | 2026-08-16 |
| **Refer a friend** | Also post-completion. Green-lit alongside the review request. | 2026-08-16 |
| **Completion countdown** | Once exchanged, count down to the fixed completion day (the exchange banner already has the date). Ellis: "100% love that." | 2026-08-16 |
| **SDLT / stamp-duty calculator** | For buyers. Ellis: "GREAT idea." | 2026-08-16 |
| **Documents as a tab in the client menu** | Wanted, but **needs full planning first** (own spec before any build). Direction: add tabs to the client menu, documents is one tab. A central place to view/download the contract pack, searches, EPC, memorandum, completion statement, etc. Today documents only appear inline in the Updates timeline; clients can upload (searches) but not browse. | 2026-08-16 |

## ⏸ Deferred (wanted eventually — trigger noted)

| Idea | Why deferred / trigger | Date |
|---|---|---|
| **Typical-duration on waiting steps** | `typicalDuration` copy exists and is even loaded onto milestones, but not enough real data yet to show honest averages. Related to the "expected days per stage" project (part 2 waits on data). Revisit when we have enough completed files. | 2026-08-16 |
| **Chain view** | An earlier version had it; Ellis found it unnecessary in practice. Will revisit "at some point." | 2026-08-16 |
| **Plain-English glossary** | Complements Explain-my-email. "Certainly will go in at some point." Corpus already exists in `docs/chase-generation`. | 2026-08-16 |
| **Referral quote lines beyond surveys** | Removals, mortgage broker, conveyancing — and expanding to **tradespeople** too. Known roadmap, modelled on the working survey-quote flow ([`/quote/[token]`](app/quote/[token]/QuoteFlow.tsx)). "Not right this second." | 2026-08-16 |
| **Weekly progress digest email** | Opt-in summary. Deferred. | 2026-08-16 |
| **Share read-only with a partner** | Multi-viewer on one token (both buyers want access). Deferred. | 2026-08-16 |

## ❌ Not doing (declined — do not re-raise)

| Idea | Why not | Date |
|---|---|---|
| **In-house / two-way client messaging** | We use **WhatsApp groups** for client comms. The "Your team" card already gives the two real channels: WhatsApp (opens our WhatsApp) and email (opens their mail client). Two-way in-portal messaging is **not required** (not parked — declined). NB: [`PortalMessageCompose.tsx`](components/portal/PortalMessageCompose.tsx) + `portalSendMessageAction` are built but rendered nowhere; leave unwired, candidate for removal. **Claude has raised this 2+ times — stop suggesting it.** | 2026-08-16 |

---

## How to use this

- **Before proposing a portal feature:** check all three lists. Declined = drop it. Deferred = only raise if its trigger has fired.
- **When Ellis makes a call:** add a row immediately with a one-line rationale and the date.
- **When a queued item ships:** move it out (or mark shipped) so the list stays a decision record, not a changelog.
