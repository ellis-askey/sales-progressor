# Enquiries Rework — Full System Audit

**Date:** 2026-08-14
**Method:** 6 parallel deep audits across the entire milestone surface (emails/copy, reminders/chase, progress/weights/gating, UI/display, analytics/metrics, hardcoded references). Every finding verified against actual code with file:line.

## Verdict

**The engine is sound; the wiring around it isn't finished.** The core weight/gate/availability maths, the prerequisite graph, the two canonical milestone reads, and the migrations are all correct and internally consistent (both sides sum to exactly 100; the % dip is expected and bounded to ~−4% overall at worst, closing to parity when enquiries are satisfied). But the rework was only half-wired: **VM21 (the new seller "satisfied" step) was added to the engine but never given its client-facing half or its auto-complete**, several downstream consumers still carry hardcoded lists that weren't updated, the exchange-date forecast still walks the deleted steps, and one of my own fixes (the reminder cleanup) was too broad and killed a live rule.

## Provably correct (verified across audits)
- Weight maths, prereq graph (PM20→PM14, VM21→VM10, no retired keys), exchange-gate blocker query, availability cascade, NR cascade, `initializeMilestoneCompletions`, the two service reads (`getMilestonesForTransaction`, `getPortalMilestones`) filter retired + include VM21.
- The 6-stage strip, hub momentum/wins/forecast/pipeline, daily/weekly metrics, exchange/completion reporting, chain weighted-progress, phase detection, the tracker panel, next-step logic — all clean.
- The % dip is the ONLY expected progress change (bounded, closes on satisfied).
- Deactivating reminder rules genuinely stops generation; no reminder regenerates for retired steps; no double-chase; solicitor-confirm flow survives.

---

## Findings by workstream

### A. Finish VM21 (the keystone — causes ~8 findings)
| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| A1 | BLOCKER | `lib/services/milestones.ts` syncEnquiryTracker | No PM20→VM21 auto-complete. On a NEW file, VM21 never completes → silently keeps the seller's exchange gate locked AND under-credits 12% of progress. Never chased either. | Complete VM21 when PM20 is confirmed. |
| A2 | BLOCKER | `lib/portal-copy.ts` (no VM21 key) | `getMilestoneCopy("VM21")` falls back to `{label:"VM21"}` → raw code "VM21" leaks in the client email AND the portal landing next-action card. | Add full VM21 entry (mirror PM20 from seller frame). |
| A3 | BLOCKER | `lib/email/milestone-digest.ts` DIGEST_LINES | No VM21 line; `getMilestoneDigestLine` throws on unknown code. Latent now, but adding A2's copy makes VM21 flow to the digest → throw kills the digest send. | Add VM21 to DIGEST_LINES in the same change as A2. |
| A4 | BLOCKER | `lib/milestone-sections.ts` VENDOR_SECTIONS | VM21 not in any section → MilestonePanel silently drops it → VM21 invisible + unconfirmable on the Steps tab (agent + internal). | Add "VM21" to vendor Conveyancing (after VM10). |
| A5 | BLOCKER | `components/portal/portal-ui.tsx` VENDOR_GROUPS | VM21 not in the vendor Enquiries group → invisible on the seller portal; header counts it → step-count mismatch. | Add "VM21" to vendor Enquiries group. |
| A6 | SHOULD-FIX | `prisma/seed.ts:154` | VM21 seeded `blocksExchange:false`; migration flips it true → fresh-seed (dev/reset) diverges from prod. | Set `blocksExchange:true` in seed. |
| A7 | SHOULD-FIX | `lib/services/fees.ts` medians + remaining-days | VM21 absent from duration model; retired steps still summed → forecast inflated ~25 days every file. | Rebuild enquiry track to VM10→VM21 / PM14→PM20; add VM21 median; drop retired. |
| A8 | NIT | `lib/updates-copy.ts` CORES | No VM21 phrase → clunky bell/comms sentence. | Add VM21 clause (mirror PM20). |
| A9 | NIT | chase glossary + `lib/chase/__tests__/milestone-glossary.test.ts` | Chase AI corpus has no VM21. | Add VM21 to MILESTONE_GLOSSARY.md + test. |

### B. Retired codes leaking into consumers that don't filter
| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| B1 | BLOCKER | `ReconcileMilestonePicker.tsx` + 4 callers (claim signup/login/confirm, ReconcileLaterAsync) | Doesn't filter RETIRED; retired steps have no prereqs so show as *unlocked* checkboxes → agent can create completion rows for dead steps. | Filter RETIRED_ENQUIRY_CODES at the fetch sites. |
| B2 | SHOULD-FIX | `app/admin/migrate/*` | Migrate form shows retired steps as tickable + drops VM21. | Filter RETIRED at fetch; VM21 fixed via A4. |
| B3 | SHOULD-FIX | `lib/milestone-sections.ts`, `components/portal/portal-ui.tsx` | Stale retired codes in the section/group maps (root cause of A4/A5). | Remove VM11-15 / PM15-19 from the maps. |

### C. My over-broad reminder cleanup (self-inflicted)
| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| C1 | BLOCKER | migration `20260815250000` + `prisma/seed.ts:387` | The cleanup matched on rule *anchor* too, so it deactivated the live **PM20 chase rule** (anchored on retired PM19). PM20 now never chased. | New migration: re-anchor PM20 rule to PM14 + reactivate. Fix seed anchor PM19→PM14. |
| C2 | SHOULD-FIX | `prisma/seed.ts:358-387` | Fresh seed re-creates retired-code chase rules active + PM20 anchored on PM19 → double-chase risk vs the tracker chase. | Remove retired chase rules from seed; re-anchor PM20. |

### D. Analytics correctness
| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| D1 | SHOULD-FIX | `lib/services/transactions.ts:21,338` | Health `onTrack` divides completed by `milestoneDefinition.count()` (=48 incl. retired) but a file maxes ~38 → every file reads ~21% low → health pills skew "at risk / off track". | Count with `notIn: RETIRED_ENQUIRY_CODES`. |
| D2 | SHOULD-FIX | `lib/services/problem-detection.ts` + `hub.ts` stalled | Stall/overdue fire at 14–21 days no-completion = the enquiries dwell window; files actively progressing enquiries get wrongly flagged. | Treat recent open-tracker movement as activity; suppress. |
| D3 | SHOULD-FIX | `lib/services/solicitor-intel.ts:85` | "avg weeks to exchange" keyed on retired VM12/PM16 → always undefined → metric dead for post-rework files. | Key on VM19/PM26. |
| D4 | NIT | `problem-detection.ts` /38 literals | Hardcoded milestone-count thresholds will drift. | Derive from a shared helper. |

### E. Product decisions needed (not bugs — design calls)
| # | Where | Question |
|---|---|---|
| E1 | PM14 + VM10 emailCopy | On a MATCHED file both fire near-identical emails to each side for one event (raised + received). Make PM14 purchaser-only and VM10 vendor-only so each side hears it once? |
| E2 | enquiries chase "Provide an update" button | It lands on the solicitor page that no longer has an enquiry step → empty/contradictory. Drop the button (rely on reply, the design intent) or build an enquiries-specific update page (Phase 2)? |
| E3 | portal enquiries tile | Marks "Completed" at PM14 (enquiries *raised*), diverging from the reworked model (stage exits at PM20). Fix to exit at satisfied? |

### F. Nits / dead-but-harmless (match the "leave inert" decision)
Retired copy/skeletons/labels, `KEY_MILESTONE_CODES`, relist-reset set, cross-side pairs, dev/mock data, "47 milestones" comments, tests referencing retired codes. All confirmed inert and unreachable. Leave per the documented decision; prune when the retired rows are eventually hard-deleted.

---

## Fix order (proposed)
1. **A1 (VM21 auto-complete)** — the keystone; unblocks the gate + fixes the 12pt under-credit.
2. **A2+A3+A4+A5+A6+A8 + B3** — finish VM21's client half (copy, digest, sections, portal group, seed flag, updates-copy) in one coherent change.
3. **C1 (+C2)** — undo the over-broad reminder migration; restore the PM20 chase.
4. **B1+B2** — filter retired at the reconcile + migrate pickers.
5. **A7 + D1 + D2 + D3** — analytics: forecast, health denominator, stall detection, solicitor-intel.
6. **A9 + D4 + F** — nits / glossary / cleanup.
7. **E1/E2/E3** — apply once the founder decides.
8. Re-run the full suite + a targeted staging retest of the VM21 confirm flow.
