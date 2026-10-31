# Raw findings — Automated-emails overhaul (agent a5e9dc0)

## AE-1 Drawer hardcodes "Chase N of 2", ignores configurable cadence cap — LOGIC — Small — Confirmed
EmailDetailDrawer.tsx:358 renders `Chase {n} of 2` literal 2. Cockpit uses chaseMax (BySaleView.tsx:153); forecast carries per-lane chaseMax (automated-emails-upcoming.ts:39). Cadence rebuild made escalate count editable. Agency sets 3 chases → cockpit "chase 3 of 3", drawer "Chase 3 of 2". Contradicts truth-pass. Fix: carry chaseMax through EmailRow/PreviewData, render `of {chaseMax}`.

## AE-2 Moving/skipping predicted chase shows no change for up to 60s — MISSED CONNECTION — Small — Confirmed
EmailDetailDrawer.tsx:158-177; forecast from 60s TTL memo (automated-emails-upcoming.ts:133 / ttl-memo.ts). forecastMemo.clear() never called anywhere. Move/Send/Cancel only do router.refresh()/revalidatePath() — refresh Next cache not this memo. Predicted chases in Outbox + cockpit come entirely from memo. Move to Friday → toast "Chase moved", drawer closes, chase still on old day until 60s lapses/2-min auto-refresh. Breaks "act where you look". Fix: expose forecastMemo.clear() + call from movePendingEmail/rescheduleChaseThreadAction/cancelPendingEmail/sendPendingEmailNow before revalidating.

## AE-3 Errored email in drawer has no Resend — only Resend lives in different panel — DEAD END — Small — Confirmed
EmailDetailDrawer.tsx:373-375 shows error vs footer 498-531; automation.ts:1114-1118 canEdit false when errorAt!=null. Errored row: isPending false (status errored) so no Send/Cancel; canMove false; canEdit false. Drawer shows red error line, offers only "View file". Resend only inline in NeedsAttentionPanel.tsx:138. Agent reads failure in drawer, nothing to do, must close + scroll up + refind email. Fix: add Resend to drawer footer when row.status==="errored" && row.source==="queue" calling resendQueuedEmailAction.

## AE-4 Resend failure silent — button flips to "Try again", no reason — UNFINISHED UI — Small — Confirmed
NeedsAttentionPanel.tsx:138-160 ResendButton discards error: setState(res.ok?"done":"error"), "Try again" no toast. Siblings surface via toast.error(res.error) (SendingTodayPanel.tsx:86-94, drawer). Action returns real error string (resend-queued-email.ts:35) thrown away. Fail → "Try again" loop with no idea why. Fix: useAgentToast in ResendButton, toast.error(res.error) on fail.

## AE-5 OutboxView carries dead "Automation exhausted" code + misleading top comment — EASY WIN — Small — Confirmed
OutboxView.tsx header comment 8-10, unused Pill import 14, unused ExhaustedItem import 19, unused ExhaustedCard 218-237, timeAgo 239-244. Commit 409943bd dropped exhausted strip but functions/imports remain; lead comment still documents strip as live. Fix: delete ExhaustedCard/timeAgo/imports, rewrite lead comment.

## AE-6 Cockpit "chased out" need-kind is dead, can never render — PROBABLY NOT CONSIDERED — Medium — Confirmed
automated-emails-cockpit.ts:195 hardcodes exhausted:[] into assembler (deliberate per comment). chased_out branch in assembleCockpit (Chased out pill, Log a call action, PhoneCall icon BySaleView.tsx:81-85) unreachable in prod. getUpcomingForecast still computes exhausted (upcoming.ts:235+) consumed by nothing. Trap for future "roll cockpit to agencies". Fix: remove chased_out kind + UI branches + unused exhausted computation, or add code note it's intentionally never emitted.

## AE-7 Forecast dueTodayCount documented as feeding "Still to send today" but tile no longer uses it — LOGIC — Small — Confirmed
automated-emails-upcoming.ts:62-66 doc + 235-242 computed vs page.tsx:212 tile fed overview.banner.stillToGoToday. Fix 577eb2ac moved tile onto real queued count. dueTodayCount remains with comment saying it feeds the tile — opposite of shipped wiring. No consumer. Exactly the "two numbers claiming same thing" truth-pass killed. Fix: remove dueTodayCount + computation, or correct comment to "currently unused".

## Journeys OK (no finding)
- Count consistency banner/Needs-attention pill/Problems number all resolve to needs.total (page.tsx:206,236, AutomationBanner:99).
- edit→live-preview→save→refetch loop complete (EmailDetailDrawer.tsx:275-304).
- Weekend/overdue clamping coherent (OutboxView.tsx:92-102 via nextChaseSendDay).
- Send-now/Skip share race-safe actions + refresh.
- Legacy ?tab= deep-links mapped not 404 (page.tsx:41-49).

## Light note
By-sale Paused/All-set groups (BySaleView.tsx:167-223) navigate-only — paused file on TSP default landing tab has no resume affordance there, must open file. Consistent with "act on the file" but worth conscious decision given it's default tab.
