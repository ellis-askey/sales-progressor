# Agent Page List

**Scan date:** 2026-05-10  
**Last updated:** 2026-05-11 (Transaction detail Stage 4 complete — 1 of 6 deferred Stage 4 triggers done)  
**Method:** `app/**/page.tsx` glob + middleware analysis. Not from memory.  
**Committed total:** 27 production pages  

Complexity ratings (Small / Medium / Large / X-Large) are honest estimates from a quick read. They may change when Stage 1 reads the full component tree.

> **Deferred Stage 4 note:** Position 1 (new-v2) completes Stages 1, 2, and 3 in sequence, then enters a holding state. Stage 4 is deferred until positions 2–7 (transaction detail, hub, work queue, transaction list, dashboard, analytics) have all reached Stage 3 approved. Full process documented in `WORKFLOW.md` under "Deferred Stage 4."

---

## Priority 1 — Source of truth, tackled first

### 1. New sale (new-v2) — Stage 4 deferred
| Field | Value |
|---|---|
| Route | `/agent/transactions/new-v2` |
| File | `app/agent/transactions/new-v2/page.tsx` |
| Position justification | Every downstream page reads what this form creates. Designing it first means downstream pages are built knowing the final data shape. It is also the hardest page in the queue (X-Large, only non-standard Stage 4) — better to tackle it before 9 pages of locked-in decisions accumulate. |
| Complexity | **X-Large** |
| Audience | Director, Negotiator |
| Mobile complexity | **Most complex in the queue.** Two-column desktop layout collapses to single-column. MOS drop zone, chain section expansion, and solicitor picker each need a mobile treatment. Multi-party contact entry (up to 2 vendors, 2 purchasers) must remain usable at 375px. |
| **Stage 4 note** | **Stage 4 is deferred and non-standard.** Stages 1–3 run normally and complete before other pages begin. Stage 4 (production cutover from `/agent/transactions/new` to this route) is held until transaction detail, hub, work queue, transaction list, dashboard, and analytics have all reached Stage 3 approved. Stage 4 then includes: revalidation check, UI swap, navigation link updates, old route redirect, `tsc` verification, spot-check on real transaction creation, and 24h monitoring. Full checklist in `WORKFLOW.md`. |
| Uncertainty | Uses `components/transactions-v2/NewSaleFlow` — a component tree not yet deeply read. Stage 1 will reveal full scope. Uses `prisma as any` cast in places — note as code smell in Stage 1 inventory, file in `docs/TODO.md`, do not fix in the polish pass. |

---

## Priority 2 — Core workflow, highest traffic

These six pages are also the deferred Stage 4 trigger for position 1. All six must reach Stage 3 approved before new-v2 Stage 4 is allowed.

### 2. Transaction detail ✓ Stage 4 complete 2026-05-11
| Field | Value |
|---|---|
| Route | `/agent/transactions/[id]` |
| File | `app/agent/transactions/[id]/page.tsx` |
| Position justification | Most time spent here per agent session. Sets the visual bar for the whole pass after new-v2. |
| Complexity | **Large** |
| Audience | Director, Negotiator |
| Mobile complexity | **More complex than desktop.** Sidebar panel (Price & Fees, exchange forecast) must reorder below main content. Milestone tabs may need a different treatment at 375px. Chase drawer opens full-screen on mobile. All documented in Stage 1 before any design decisions. |
| Uncertainty | None — well understood from prior sessions. |

### 3. Hub
| Field | Value |
|---|---|
| Route | `/agent/hub` |
| File | `app/agent/hub/page.tsx` |
| Position justification | First screen on login. If this is wrong, every session starts wrong. |
| Complexity | **Large** |
| Audience | Director, Negotiator |
| Mobile complexity | **More complex.** Pipeline health cards stack vertically. Attention items may reorder. Service split donut chart needs mobile-safe sizing. |
| Uncertainty | Voice offenders already catalogued in `VOICE_GUIDELINES.md` — they inform Stage 3 but do not change Stage 1 complexity. |

### 4. Work queue
| Field | Value |
|---|---|
| Route | `/agent/work-queue` |
| File | `app/agent/work-queue/page.tsx` |
| Position justification | Daily driver for reminder management. High session frequency. Empty state voice offender already identified. |
| Complexity | **Medium-Large** |
| Audience | Director, Negotiator |
| Mobile complexity | **Similar to desktop.** Reminder cards are already designed for narrow widths. Filter strip may need a mobile treatment. |
| Uncertainty | None significant. |

### 5. Transaction list
| Field | Value |
|---|---|
| Route | `/agent/transactions` |
| File | `app/agent/transactions/page.tsx` |
| Position justification | Main navigation surface between hub and detail. Agents pass through it on every file they open. |
| Complexity | **Medium** |
| Audience | Director, Negotiator |
| Mobile complexity | **More complex.** Row cards stack differently. Filter/search bar behaviour on mobile needs documenting in Stage 1. Exchange gate badges must remain visible. |
| Uncertainty | None significant. |

### 6. All Files / My Files dashboard
| Field | Value |
|---|---|
| Route | `/agent/dashboard` |
| File | `app/agent/dashboard/page.tsx` |
| Position justification | Placed here because it is a transaction list variant — shares data shape and row components with position 5. Designing these two in sequence keeps the list aesthetic consistent. Also a deferred Stage 4 trigger for position 1. |
| Complexity | **Medium** |
| Audience | **Director** sees all agency files ("All Files" view). **Negotiator** sees own assigned files only ("My Files" view). Both views must be inventoried in Stage 1 and rendered in the Stage 2 test page. |
| Mobile complexity | **More complex.** Role filter, status tabs, and row cards all need mobile treatment. |
| Uncertainty | Appears to be a parallel transaction list using `TransactionListWithSearch`, `ForecastStrip`, `AgentRequestsPanel`. Stage 1 will clarify whether it duplicates or meaningfully extends the transaction list. If substantially the same, flag to Ellis before proceeding. |

### 7. Activity feed / comms
| Field | Value |
|---|---|
| Route | `/agent/comms` |
| File | `app/agent/comms/page.tsx` |
| Position justification | Milestone activity log grouped by day. Not a deferred Stage 4 trigger for new-v2, but closely follows the core workflow block. |
| Complexity | **Medium** |
| Audience | Director, Negotiator |
| Mobile complexity | **Similar to desktop.** Day-grouped cards are vertical. Filter toggle (all / portal-only) needs mobile placement. |
| Uncertainty | Need a deeper read in Stage 1 to understand all entry types in `CommsActivityFeed`. Appears straightforward from quick scan. |

### 8. Completions
| Field | Value |
|---|---|
| Route | `/agent/completions` |
| File | `app/agent/completions/page.tsx` |
| Complexity | **Medium** |
| Audience | Director, Negotiator |
| Mobile complexity | **Similar to desktop.** Grouped list with stat pills stacks cleanly. |
| Uncertainty | None significant. |

### 9. To-do
| Field | Value |
|---|---|
| Route | `/agent/to-do` |
| File | `app/agent/to-do/page.tsx` |
| Complexity | **Small-Medium** |
| Audience | Director, Negotiator |
| Mobile complexity | **Same as desktop.** Single-column list. |
| Uncertainty | Confirm in Stage 1 whether "with progressor" section has a distinct empty state from own-tasks section. |

### 10. Analytics
| Field | Value |
|---|---|
| Route | `/agent/analytics` |
| File | `app/agent/analytics/page.tsx` |
| Position justification | Reads fee and referral data produced by new-v2 — placed here to inform the data shape before new-v2 Stage 4. Also the last deferred Stage 4 trigger for position 1: once this reaches Stage 3, the cutover is unlocked. |
| Complexity | **Medium** (may rise to Large — charts not yet read) |
| Audience | Director (primarily), Negotiator (possibly read-only) |
| Mobile complexity | **More complex.** Charts may not be responsive. Read the page file in Stage 1 and confirm which charting library is used before assuming. |
| Uncertainty | Haven't read this file in depth. |

---

## Priority 3 — Supporting features

### 11. Solicitors
| Field | Value |
|---|---|
| Route | `/agent/solicitors` |
| File | `app/agent/solicitors/page.tsx` |
| Complexity | **Medium** |
| Audience | Director, Negotiator |
| Mobile complexity | **More complex.** Table/list view needs mobile treatment. Firm detail modal documented in Stage 1. |
| Uncertainty | None significant. |

### 12. Partners
| Field | Value |
|---|---|
| Route | `/agent/partners` |
| File | `app/agent/partners/page.tsx` |
| Complexity | **Medium** |
| Audience | Director (write access to settings), Negotiator (read-only directory) |
| Mobile complexity | **Similar to desktop** for directory. Settings sections stack cleanly. |
| Uncertainty | Uses `prisma as any` cast — flag in Stage 1 inventory, file in `docs/TODO.md`, do not fix in the polish pass. |

---

## Priority 4 — Configuration and reference

### 13. Settings
| Field | Value |
|---|---|
| Route | `/agent/settings` |
| File | `app/agent/settings/page.tsx` |
| Complexity | **Medium** (section count unknown until Stage 1) |
| Audience | Director, Negotiator |
| Mobile complexity | **Same as desktop.** Settings panels stack cleanly. |
| Uncertainty | Haven't read this file in depth. |

### 14. Help
| Field | Value |
|---|---|
| Route | `/help` |
| File | `app/help/page.tsx` |
| Complexity | **Medium** |
| Audience | Director, Negotiator |
| Mobile complexity | **Similar to desktop.** Sidebar navigation may become a select or accordion on mobile — check in Stage 1. |
| Uncertainty | None significant. |

---

## Priority 5 — Auth and onboarding

Every agent sees these pages once or rarely. Low traffic per agent, so they queue last among functional pages.

### 15. Login
| Field | Value |
|---|---|
| Route | `/login` |
| File | `app/login/page.tsx` |
| Complexity | **Small** |
| Audience | All agents (pre-authentication) |
| Mobile complexity | **Same.** |

### 16. Register (new agency signup)
| Field | Value |
|---|---|
| Route | `/register` |
| File | `app/register/page.tsx` |
| Complexity | **Medium** (may be multi-step — confirm at Stage 1) |
| Audience | New agency directors |
| Mobile complexity | **More complex** if multi-step; same if single form. |

### 17. Signup complete
| Field | Value |
|---|---|
| Route | `/signup/complete` |
| File | `app/signup/complete/page.tsx` |
| Complexity | **Small** |
| Audience | New agency directors |
| Mobile complexity | **Same.** |

### 18. Forgot password
| Field | Value |
|---|---|
| Route | `/forgot-password` |
| File | `app/forgot-password/page.tsx` |
| Complexity | **Small** |
| Audience | All agents |
| Mobile complexity | **Same.** |

### 19. Reset password
| Field | Value |
|---|---|
| Route | `/reset-password` |
| File | `app/reset-password/page.tsx` |
| Complexity | **Small** |
| Audience | All agents |
| Mobile complexity | **Same.** |

### 20–22. Director invite flow
| # | Route | File | Complexity |
|---|---|---|---|
| 20 | `/invite/[token]` | `app/invite/[token]/page.tsx` | Small |
| 21 | `/invite/[token]/password` | `app/invite/[token]/password/page.tsx` | Small |
| 22 | `/invite/[token]/accept` | `app/invite/[token]/accept/page.tsx` | Small |

Audience: New directors clicking an email invite link. Mobile complexity: Same — single-column forms.

### 23–25. Negotiator invite flow
| # | Route | File | Complexity |
|---|---|---|---|
| 23 | `/invite-negotiator/[token]` | `app/invite-negotiator/[token]/page.tsx` | Small |
| 24 | `/invite-negotiator/[token]/password` | `app/invite-negotiator/[token]/password/page.tsx` | Small |
| 25 | `/invite-negotiator/[token]/accept` | `app/invite-negotiator/[token]/accept/page.tsx` | Small |

Audience: New negotiators clicking an email invite link. Mobile complexity: Same.

---

## Priority 6 — Error and utility

### 26. 404 page
| Field | Value |
|---|---|
| Route | Any unmatched route |
| File | `app/not-found.tsx` |
| Complexity | **Small** |
| Audience | All agents |
| Mobile complexity | **Same.** |
| Uncertainty | Haven't read this file. May be a placeholder. |

### 27. Error page
| Field | Value |
|---|---|
| Route | Any route that throws an unhandled error |
| File | `app/error.tsx` |
| Complexity | **Small** |
| Audience | All agents |
| Mobile complexity | **Same.** |

---

## Deferred — `/claim/*`

Out of scope for the main agent pass. Will be redesigned as part of a separate chain feature sweep, which will create any additional chain-related pages required. The chain sweep reuses this same methodology and standards.

| Route | File |
|---|---|
| `/claim` | `app/claim/page.tsx` |
| `/claim/signup` | `app/claim/signup/page.tsx` |
| `/claim/login` | `app/claim/login/page.tsx` |
| `/claim/confirm` | `app/claim/confirm/page.tsx` |

---

## Excluded — Dev and preview pages

| Route | File | Reason |
|---|---|---|
| `/agent/anim-preview` | `app/agent/anim-preview/page.tsx` | This IS the design system reference. Not a prod page. |
| `/agent/system-preview` | `app/agent/system-preview/page.tsx` | Dev component preview |
| `/agent/system-preview/toasts` | `app/agent/system-preview/toasts/page.tsx` | Dev toast preview |
| `/agent/analytics-preview` | `app/agent/analytics-preview/page.tsx` | Dev preview |
| `/agent/hub-preview` | `app/agent/hub-preview/page.tsx` | Dev preview |
| `/agent/headertest` | `app/agent/headertest/page.tsx` | Dev test |
| `/agent/quick-add` | `app/agent/quick-add/page.tsx` | Redirect only: `redirect("/agent/transactions/new")` — no UI |
| `/agent/transactions/new` | `app/agent/transactions/new/page.tsx` | Being retired. Stage 4 of position 1 converts this to a 307 redirect to new-v2. No standalone redesign. |
| `/lottietest` | `app/lottietest/page.tsx` | Dev test |
| `/bgtest` | `app/bgtest/page.tsx` | Dev test |
| `/bg-test` | `app/bg-test/page.tsx` | Dev test |
| `/drawertest` | `app/drawertest/page.tsx` | Dev test |
| `/helpdrawertest` | `app/helpdrawertest/page.tsx` | Dev test |
| `/login-preview` | `app/login-preview/page.tsx` | Dev preview |

---

## Excluded — Not agent-facing

| Route | Reason |
|---|---|
| `/dashboard` | Internal staff only (`admin`, `sales_progressor`). Agents redirect to `/agent/hub`. |
| `/admin`, `/admin/audit` | Internal staff only. |
| `/transactions/[id]`, `/transactions/new` | Internal staff versions. Agents redirect to agent-prefixed equivalents. |
| `/analytics`, `/comms`, `/completing`, `/reports`, `/solicitors`, `/tasks`, `/todos`, `/not-our-files` | Internal staff only. |
| All `/command/*` | Superadmin only. Separate visual surface, separate methodology. |
| All `/portal/*` | Buyer/seller portal — separate phase. |
| `/feedback/[token]/survey` | **Portal-only.** Token source is `contact.portalToken` (`lib/services/survey.ts:38`) — issued to buyers and sellers, not agents. The in-app `FeedbackWidget` at `app/agent/layout.tsx` is a separate mechanism already accessible to agents. Survey page deferred with the portal pass. |
| `/` (root) | Marketing site — separate surface. |
| `/terms`, `/privacy`, `/cookie-policy` | Public static pages — no interaction design. |

---

## Summary

| Category | Count |
|---|---|
| Priority 1 — Source of truth (deferred Stage 4) | 1 |
| Priority 2 — Core workflow (also Stage 4 triggers for pos. 1) | 9 |
| Priority 3 — Supporting features | 2 |
| Priority 4 — Config and reference | 2 |
| Priority 5 — Auth and onboarding | 11 |
| Priority 6 — Error and utility | 2 |
| **Total committed** | **27** |
| Deferred (chain sweep) | 4 |
| Dev/preview (excluded) | 14 |
| Not agent-facing (excluded) | 15+ |

**Total agent pages committed to redesign: 27**

**The deferred Stage 4 sequence in plain terms:** Position 1 (new-v2) runs Stages 1–3. Then positions 2–10 run their full workflows, all four stages each. When positions 2, 3, 4, 5, 6, and 10 (transaction detail, hub, work queue, transaction list, dashboard, analytics) have all reached Stage 3 approved, position 1's Stage 4 is triggered. Positions 7–9 and 11–27 continue their normal workflows regardless.
