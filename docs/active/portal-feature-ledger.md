# Client Portal — Feature Ledger

**Standing record of what we're building, deferring, and deliberately not doing on the buyer/seller portal.**

Read this before proposing any portal feature. If an idea is already on the "Declined" list, don't raise it again. If it's "Deferred", note the trigger before suggesting we start. Add new decisions here as they're made — one line of rationale each, dated.

Last updated: 2026-08-16 (SDLT + completion countdown shipped to prod).

Legend: ✅ Shipped · 🔜 Approved / queued · ⏸ Deferred (wanted, not now) · ❌ Declined (do not re-raise)

---

## ✅ Shipped

| Idea | Notes | Date |
|---|---|---|
| **Completion countdown** | Lives in the post-exchange banner: property photo runs to the top, one heavy-frost card holds the big live day count, an exchange → moving-day progress bar, and Add to calendar. Staging + prod. | 2026-08-16 |
| **SDLT / stamp-duty calculator** | Buyer Overview card showing a standard-rate estimate; tap opens a sheet to edit the price and toggle first-time-buyer / additional-property, with a band breakdown capped at the purchase price. England & NI ([`lib/sdlt.ts`](lib/sdlt.ts)). Staging + prod. | 2026-08-16 |

## 🔜 Approved / queued to build

| Idea | Decision & notes | Date |
|---|---|---|
| **Post-completion review request** | On the completion page ([`complete/page.tsx`](app/portal/[token]/complete/page.tsx)) — highest-intent moment. Ask for a Google/Trustpilot review. | 2026-08-16 |
| **Refer a friend** | Also post-completion. Green-lit alongside the review request. | 2026-08-16 |
| **Documents as a tab in the client menu** | Wanted, but **needs full planning first** (own spec before any build). Direction: add tabs to the client menu, documents is one tab. A central place to view/download the contract pack, searches, EPC, memorandum, completion statement, etc. Today documents only appear inline in the Updates timeline; clients can upload (searches) but not browse. | 2026-08-16 |
| **First-visit welcome / orientation** | Required. One-time bottom sheet on a client's first portal open (localStorage-gated like the install/push toasts): a warm 3-point intro (what this is, what you can do, where your team is). | 2026-08-17 |
| **"Your costs" overview card (buyers)** | The honest cost-*overview* version (not a precise balance — see Deferred): price, estimated deposit, the SDLT estimate folded in, and "your solicitor confirms the exact balance". Likely replaces the standalone SDLT card, shown until completion. | 2026-08-17 |

**Covered already (not a new build):** a persistent "what we need from you" panel — the Overview "Your next step" + confirm already surfaces the client's next required action. Only gap: multiple concurrent asks / non-milestone document requests.

## ⏸ Deferred (wanted eventually — trigger noted)

| Idea | Why deferred / trigger | Date |
|---|---|---|
| **Typical-duration on waiting steps** | `typicalDuration` copy exists and is even loaded onto milestones, but not enough real data yet to show honest averages. Related to the "expected days per stage" project (part 2 waits on data). Revisit when we have enough completed files. | 2026-08-16 |
| **Chain view** | An earlier version had it; Ellis found it unnecessary in practice. Will revisit "at some point." | 2026-08-16 |
| **Plain-English glossary** | Complements Explain-my-email. "Certainly will go in at some point." Corpus already exists in `docs/chase-generation`. | 2026-08-16 |
| **Referral quote lines beyond surveys** | Removals, mortgage broker, conveyancing — and expanding to **tradespeople** too. Known roadmap, modelled on the working survey-quote flow ([`/quote/[token]`](app/quote/[token]/QuoteFlow.tsx)). "Not right this second." | 2026-08-16 |
| **Weekly progress digest email** | Opt-in summary. Deferred. | 2026-08-16 |
| **Share read-only with a partner** | Multi-viewer on one token (both buyers want access). Deferred. | 2026-08-16 |
| **"On track" / progress-health signal** | On track vs running-behind against the 12-week target. Technically needs no per-step data, but Ellis places it in the same "wait for data confidence" bucket as typical-duration. | 2026-08-17 |
| **"Your costs" precise balance (buyers)** | A *precise* money-to-complete figure needs the mortgage advance, solicitor fees and actual deposit — none stored today. The honest cost-*overview* version (price + est. deposit + SDLT + "solicitor confirms exact") is being built instead; the precise figure waits until we capture those inputs. | 2026-08-17 |

## ❌ Declined (do not re-raise)

| Idea | Why not | Date |
|---|---|---|
| **In-house / two-way client messaging** | We use **WhatsApp groups** for client comms. The "Your team" card already gives the two real channels: WhatsApp (opens our WhatsApp) and email (opens their mail client). Two-way in-portal messaging is **not required** (not parked — declined). NB: [`PortalMessageCompose.tsx`](components/portal/PortalMessageCompose.tsx) + `portalSendMessageAction` are built but rendered nowhere; leave unwired, candidate for removal. **Claude has raised this 2+ times — stop suggesting it.** | 2026-08-16 |

---

## How to use this

- **Before proposing a portal feature:** check all four lists. Declined = drop it. Deferred = only raise if its trigger has fired. Shipped = done, don't re-pitch.
- **When Ellis makes a call:** add a row immediately with a one-line rationale and the date.
- **When a queued item ships:** move it to Shipped so the list stays an accurate decision record.
