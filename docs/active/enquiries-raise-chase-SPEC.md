# Enquiries rework — the "get enquiries raised" chase

**Status:** designed + founder-approved 2026-08-14. **Not yet built.** Slots in as its own stage after the downstream-audit fixes.
**Why it exists:** Phase 1 switched off the old per-step reminder for "raise enquiries" (the tracker owns enquiries now), but the tracker only opens *after* enquiries are raised/received. So nothing chased to *get* them raised. This closes that gap.

## Scope
A dedicated chaser that runs **before** the enquiries tracker exists, to get the buyer's solicitor to raise enquiries. Separate from the tracker (which chases the reply loop, solicitors only). This one nudges the **buyer first, then their solicitor**, because solicitors often ignore our auto-comms but tell their own client.

## Trigger & timeline (working days from **searches ordered**, PM8 confirmed)
| WD | Action |
|---|---|
| 0 | Searches ordered — clock starts |
| 7 | Nudge the **buyer** (client): "Has your solicitor raised the enquiries yet? If so, let us know." |
| 10 | Chase the **buyer's solicitor** directly (3 WD after the buyer) |
| 13 | **Escalate** to the file owner — task + amber flag — 3 WD after the solicitor's first email, so the owner can call. Only if nobody has confirmed raised. |
| every 6 WD | Repeat, **alternating** buyer nudge / solicitor chase, until raised. |

Numbers are founder-approved: grace **7**, solicitor **+3**, repeat **6**, escalate **+3 after solicitor (= WD 13)**.

## Stop / hold conditions
- **Stops entirely** the moment "enquiries raised" (PM14) is confirmed — by the buyer, the seller, the solicitor, or the team. From there the existing tracker takes over (chases the seller's solicitor for replies, 9 WD cadence).
- **Expected date:** if the buyer or solicitor gives a date they expect to raise by, store it as `MilestoneCompletion.expectedDate` on the "enquiries raised" step (same field the solicitor "give an expected date" button already writes). The chaser **holds off until that date** before nudging again — mirrors the tracker's snooze.
- Respects file status (active only) and the solicitor-email pause flags, same as the tracker chase.

## Confirmation rights (settled 2026-08-14)
- **Raised / received:** client-confirmable. Buyer can confirm "my solicitor raised enquiries"; seller can confirm "my solicitor received them." (Solicitors ignore our comms but tell their client.)
- **Satisfied:** staff/solicitor only — never client-confirmable (it opens the exchange gate). Enforced by adding PM20 + VM21 to `PORTAL_AGENT_ONLY_CODES` (audit fix #7).

## Build notes
- Build as its own small chaser (buyer channel = client auto-email; solicitor channel = solicitor auto-email; escalation = team task + amber flag), NOT bolted onto the tracker.
- Gated by the same `SolicitorChaseSettings` master switch as the other chases (so nothing fires until the founder switches chasing on).
- Alternating repeat = re-nudge buyer, then re-chase solicitor, 6 WD apart.
