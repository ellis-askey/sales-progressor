# External sales-progression — systematic audit tracker

The master checklist for auditing every surface the new **external progression
business** role and the **agents who join through them** touch. We work through it
surface by surface; each gets an audit (findings + decisions), a build, and a tick.
**Final founder sign-off at the bottom when every row is done.**

Companion docs:
- Decisions + deferred items: [EXTERNAL_SP_BACKLOG.md](EXTERNAL_SP_BACKLOG.md)
- Spec: [00-spec.md](00-spec.md), [10-signup-team-billing-spec.md](10-signup-team-billing-spec.md)

The hard rule for every row: **nothing changes for TSP, for the agencies TSP works
with, or for free self-signup agents.** Every change gates on a non-TSP progression
business.

Status key: ⬜ not started · 🔍 audited (awaiting decisions) · 🔨 building ·
✅ shipped (awaiting founder tick) · ☑️ founder-signed-off

---

## Done before this tracker

| Area | Status |
|---|---|
| Entrance flow — reset password, welcome modal, empty states | ✅ |
| Adding a sale + who it goes to (agent side) | ✅ |
| Property file — invited agent's view (audit items 1-8) | ✅ |
| Property file — external progressor's view (items 1, 3, 5, 6, 8, 9) | ✅ |

## The plan

| # | Surface / journey | Who | Status | Notes |
|---|---|---|---|---|
| 1 | Progressor Hub + their file list | Progressor | ✅ | assign + wording + column shipped (2838d91e). Deferred Phase-1 builds now shipped: new-sale flow for progressors (d1569abc + e31fc998), owner sees own fee on hub forecast (6b992827), see-all/see-own per team member (797ca892 + 7e54e90a). P1-d/e/h still deferred — see backlog |
| 2 | Clients CRM + "who emails send as" setup | Progressor | ✅ | SHIPPED (staging, unpushed): PR1 remove/rename client (bc5a1f00); PR2 business settings area (174d6224); PR3a sender verified-gate + migration (9589ead0); PR3c per-client sending domain (2a1ac6e4); PR3b business default sending domain + cron (18421eb9). Both migrations on staging. Remaining: PR4 invite-email branding (part-done, flagged) |
| 3 | Other pages — Completions, Updates, Analytics, Partners, Enquiries, Chains, To-Do, Reminders | Progressor | ✅ | Audited 2026-10-03 (2 parallel sweeps). Enquiries/Chains/Partners already correct. PR A (905650b0): closed To-Do internal-task cross-business LEAK (listInternalSelfAssignedTasks was unscoped). PR B (3a278910): owners/see-all now see whole book on 9 internal surfaces (resolveInternalVisibility under-called with 4 args) + "assigned" wording tidy. Analytics/Partners confirmed relevant (kept), income gated off |
| 4 | Account + settings (own business identity, security, email connect) | Progressor | ✅ | Absorbed into Phase 2 PR2 (business settings area, 174d6224) + PR3b (email connect / sending domain). Owner-only /agent/settings/* |
| 5 | Other pages beyond the file | Invited agent | ⬜ | lighter — mostly a normal agent |
| 6 | Client-facing — buyer/seller portal + client emails | Clients | ⬜ | progression-business branding, not TSP; CRM emails stay TSP |

---

## Final sign-off

- [ ] Every row above is ☑️ founder-signed-off.
- [ ] Founder confirms: TSP access, the TSP↔agent relationship, and free agents are
      all unchanged across the whole programme.

Signed off: _____________  Date: _____________
