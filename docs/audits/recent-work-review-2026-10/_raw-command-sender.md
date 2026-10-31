# Raw findings — Command Centre rebuild + sender ladder (agent a4290376)

## CS-1 Business's own domain still faces clients — portal contact + CC "Sends as" diverge from ladder — LOGIC (strongest) — Medium — Confirmed(divergence)
New ladder resolveOutsourcedClientSender passes business:null into resolveOutsourcedWhiteLabelSender (sender.ts:140-146) so business domain never a client From/Reply-To (header: "must never face buyers/sellers/solicitors/brokers"). But two client-facing surfaces still call resolveOutsourcedWhiteLabelSender WITH real business arg → resolve tier 3 = business own domain:
- resolveManagingEmail (portal.ts:633-639) = portal client-facing contact email. Doc promises "portal contact and Reply-To always match" — now false for external-business file reaching tier 3: portal shows jo@keytocompletion.co.uk while real emails go from minted jo@progression.{agencydomain}/updates@thesalesprogressor.co.uk with Reply-To capture alias.
- CC "Sending identity per agency" panel (source:business → "Company default address", page.tsx:271-276) tells founder clients sent as business own domain, which ladder never does. No representation of 3a/3b minted addresses.
Example: Key to Completion, agency with DNS-auth domain: clients get jo@progression.agency.co.uk but portal contact + CC panel show jo@keytocompletion.co.uk. Re-opens exact leak the ladder closed + CC misreports to founder. Fix: route resolveManagingEmail + getBusinessSendingIdentity through resolveOutsourcedClientSender, or scope as agent-facing + relabel. Reconcile "contact and Reply-To always match" comment.

## CS-2 Sent-email viewer never shows bounced/failed — bounced reads as "Sent" — UNFINISHED UI — Small — Confirmed
sent-chase-email.ts:31,108; SentEmailModal.tsx:23-26,54,77-87. delivery only "sent|delivered|opened" from openedAt?…:deliveredAt?…:"sent". No bounced/failed branch; STEPS=[Sent,Delivered,Opened] no failure state. Bounced send renders stepper frozen at "Sent". Agency File log correctly shows "Bounced" (agency-file.ts:322-333) but viewer shows "Sent" no warning. Data (status:bounced, failedAt, failureReason) already selectable. Fix: add bounced/failed delivery value, select the fields, red terminal step (reuse EMAIL_STATE_META).

## CS-3 Today "Transactions created" tile: scoped number drills into unscoped list — MISSED CONNECTION — Medium/Small — Confirmed
overview/page.tsx:345 href "/command/files?created=7d" no scopeQs; files/page.tsx:104 accepts created/tx/att/status/managed/q NOT mode/agency. Only tile of 5 whose destination omits scopeQs (signups/milestones/chases/exchanges all carry scope). SP mode tile "4", click lands on files list showing every agency's new files (11). Undercuts PR3 "every number has a destination". Fix: teach /command/files to read mode/agency + pass scopeQs, or drop drill-through under non-combined scope.

## CS-4 Controls tab silently ignores sidebar scope — MISSED CONNECTION — Small — Confirmed(behaviour)
agencies/page.tsx:272-281 controlsRows=feeAgencies.map(...) no .filter(inScope) vs roster :227 + agents :205 which filter; :309 showUsageChrome=tab!=="controls" hides "Following sidebar scope filter" note on Controls. Header says honours sidebar scope; Controls matrix fed full non-internal agency set. weeklyEligibleThisWeek also global. Scope to one agency, Controls shows every agency's rows, column master (all on/off) could affect far more than intended. Fix: apply inScope to controlsRows + keep scoped note, or banner "Controls act across all agencies".

## CS-5 "Metric moved" signals on Today link back to the page you're on — DEAD END — Small — Confirmed
signal-display.ts:62 metric_delta → href ()=>"/command/overview", consumed overview/page.tsx:804-806. On Today page, metric_delta row in Unacknowledged signals links to /command/overview = reloads same page. Credibility ding on "every number goes somewhere" surface. Fix: point at /command/insights?sev=… or make row non-clickable when href = current page.

## CS-6 Agency File "Branding & sender" read-only on the page billed as the one place to edit — EASY WIN — Small — Confirmed
agency/[agencyId]/page.tsx:205-215 Toggle/Row display-only; header :20-23 "the ONE place per-agency settings are edited". Automation + Fee editable with save+refresh, but Branding & sender group (incl "Sender verified: Not sendable") static text, no action/link. Founder seeing unverified sender can't action it from edit page. Fix: link sender row to domain/sender setup or check-domains re-run, or label "agency-set, read-only".

## Checked out
- Tier 3a inbound subdomain fully wired (clients/[agencyId]/sender/domain/route.ts:61-67, MX-validated check-domains/route.ts:93-102).
- Self-managed + TSP branches of resolveAgencySenderForTransaction never send from unverified address; canReply suppresses "just reply" line; TSP reply-to fix (9b413f61) matches verified single sender.
- Fee editor: dirty-tracking, validation, save/Saved✓; automation toggles roll back on error.
