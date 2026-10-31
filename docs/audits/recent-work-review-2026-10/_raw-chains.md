# Raw findings — Chains overhaul (agent a4dcb60)

## CH-1 Two tabs show same sale's "ready to exchange" state, can silently disagree — MISSED CONNECTION — Medium — Confirmed
Check-ins tab CheckInsList.tsx:635,653-654 reads per-side step marks (row.steps.length===9) vs Push-to-exchange/file Overview exchange-push.ts:146 reads exchangeReadyConfirmedAt flag. Write paths chain-intel.ts:313-321 + chains.ts:101-107. Ticking all 9 sets flag, but unticking a pill does NOT clear it (chain-intel.ts:316 "Set once; never cleared from here"). Exchange-tab toggle sets/clears flag without touching step marks. Tick all 9 → green everywhere; untick one → Check-ins says "8 of 9 not ready" but Push-to-exchange still green "Ready" + counts toward all-ready. Most consequential status in feature. Fix: single source of truth — derive check-in bar from flag, or untick clears flag when below 9 (mirror chains-intel.ts:421-426).

## CH-2 After logging update, avatar+name next to it shows wrong person until refresh — UNFINISHED UI — Medium — Confirmed
CheckInsList.tsx:322-330 logUpdate, 283-291 toggleStep, 224 confirmReady; rendered :577. Optimistic updates lastUpdateBody/At/history but never the 3 author fields (lastUpdateAuthorName/Image/Role). No revalidatePath in server action. Stale author persists until nav. Buyer confirmed via portal (client avatar), agent logs update → agent's words next to client's avatar; or no prior note → generic "Your team". Defeats side-tinted-avatar work (60bba895) for the most common action. Fix: pass viewer name/image/role, set in 3 optimistic updates (server already returns authorName from addChainEntryAction).

## CH-3 Joining two chains is instant, silent, irreversible — no confirm, no undo — PROBABLY NOT CONSIDERED — Significant(unjoin)/Small(confirm) — Confirmed
chains.ts:1723-1754 merge hard-deletes incoming PropertyChain; UI AddNodeDrawer.tsx:690-696,749-753,886-888. Picking already-chained sale in "One of my sales" folds its whole chain in + propertyChain.delete. Only safeguard inline sentence; primary button commits. No confirm, no split-back. Incoming chain name silently discarded. Mis-click own 5-property chain → two chains permanently merged, other gone, no undo. Most destructive action, single click, no gate. Fix: confirm step for merge case (knows others>0) naming how many properties move; ideally un-join/split path.

## CH-4 Portal/agent step-undo leaves node flagged "ready to exchange" — LOGIC — Small — Confirmed
onward.ts:1007-1029 bridgeUndoFromCheckIn vs 996-1001 confirm sets flag. Confirming final beat (all 9) stamps exchangeReadyConfirmedAt (:999). Undo removes step mark + logged line but never clears flag. Client-driven. Seller confirms final beat on onward tracker → ready; undoes in portal → dot clears, note gone, but Push-to-exchange keeps "Ready". Client self-correct leaves false green on agent exchange board, silent. Fix: in bridgeUndoFromCheckIn recount + clear flag if no longer all-9 (mirror chains-intel.ts:421-426). Decide with CH-1 so all 3 confirm paths behave identically.

## CH-5 "Set up chain instead" on No-chain tab has no in-flight/disabled state — DEAD END — Small — Confirmed
ChainsWorkspace.tsx:648-660 No-chain tab renders NoChainSetupCard WITHOUT pending prop vs 601-611 Needs-setup passes pending={pendingNoChainId===...}. pendingNoChainId set in state but card not told. Click "Set up chain instead" → nothing changes → click again (double-fire on state-changing action). Fix: pass pending={pendingNoChainId===s.transactionId} (one line).

## CH-6 On-hold relist of chain file leaves stale neighbour link in place — LOGIC — Medium — Confirmed (documented deferred)
Acknowledged commit 03908ba9 "DEFERRED/NOTED"; flag surfaces NoChainSetupCard.tsx:111-113 "Onward not confirmed" pill. On_hold relist to new buyer doesn't run withdraw-time chain cascade: old downstream link not detached, new onward agent not auto-invited. Safeguard sets chainSetupPending → resurfaces in Needs-setup. But chain still contains previous buyer's stale link; nothing points agent at WHAT is stale. Agent opens chain, sees old buyer's onward node wired in, no "remove this?" prompt. Fix: deep-link card/pill to chain drawer with stale link highlighted + one-tap remove.

## Checked, NOT problems
- Meta-row duplication fix (a7162349, CSS-owned toggle) clean.
- No-chain confirm/resurface loop complete + reversible.
- Bridge authorRole/checkInStepKey have migration 20261028140000.
- Empty states exist for every chains tab.
- check-in exchangedAt exclusion stops completed sale anchoring a group.
- "Book the exchange →" (ExchangeChecklist.tsx:217) navigates to file page; subtext frames as guidance, not a dead end.
