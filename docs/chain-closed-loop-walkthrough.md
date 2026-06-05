# Chain closed-loop arc — walkthrough on staging

Five fixtures seeded for emily@hartwellpartners.co.uk on the staging database. Each one exercises a different branch of the closed-loop arc shipped 2026-06-05.

Run again any time:

```
npx tsx scripts/seed-chain-closed-loop-fixtures.ts
```

Idempotent — re-running resets each fixture cleanly.

## Setup

1. Sign in to staging as **Emily Chen** — `emily@hartwellpartners.co.uk` at https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app/
2. Open the My Files list. The five fixtures all start with **[Chain arc F1] … [Chain arc F5]** in the address so they're easy to find.

## Fixture catalogue

| ID | Address | Starting state | What it tests |
|---|---|---|---|
| **F1** | 1 Acacia Lane | Active, no chain | Withdraw / relist with no chain side-effects. Free-form sandbox. |
| **F2** | 2 Birch Way | Active, in a 4-link chain. Emily mid-chain. Tom claimed above, Jane claimed below. | Direction-aware cascade + orphan split + CHAIN_DETACHED to Jane. |
| **F3** | 3 Cedar Court | Withdrawn 2 days ago. Tom above responded **WAITING**. | BUYER_FOUND on relist uses the **"wait is over"** variant copy. |
| **F4** | 4 Dahlia Drive | Withdrawn 2 days ago. Tom above responded **REMARKETING**. | BUYER_FOUND on relist uses the **"stand down"** variant copy. |
| **F5** | 5 Elm Place | Withdrawn 2 days ago. Tom above hasn't responded. | "Don't know yet" path on the onward-sale step → chainSetupPending → hub card. |

## Walkthrough

### Step 1 — Standalone withdraw (F1)

1. Open **F1** (1 Acacia Lane).
2. Click the status pill (top of file) → **Withdrawn**.
3. The withdraw modal now has a structured "**Who pulled out?**" picker.
4. Pick any reason. Notice:
   - No "this will notify [agent]" preview (the file isn't in a chain).
   - The free-text Detail box is optional.
5. Confirm. Toast: "Withdrawn" (not "Withdrawn — chain notified" — there's no chain).
6. The Relist banner appears. Click **Relist sale**.
7. The relist modal now ends with **"Buyer's onward sale"** — but only if the file is in a chain. Since F1 isn't, that section is hidden. Submit as before. Done.

### Step 2 — Mid-chain withdraw with direction-aware cascade + split (F2)

1. Open **F2** (2 Birch Way).
2. Click the status pill → **Withdrawn**.
3. Pick **"Our buyer pulled out"**. Notice the helper banner:
   > The agent above you in the chain will be notified that you've lost your buyer. The chain below you will be split off into its own chain.
4. Try each radio in turn — the helper updates per choice. Settle back on **"Our buyer pulled out"**.
5. Optionally add a Detail (e.g. "Mortgage application declined").
6. Confirm. Toast: "Withdrawn — chain notified".
7. **Verify in the database** (or via the file's archived-round drawer next time it's relisted):
   - Tom (position 4) received a **LOST_BUYER** notification (UPWARD).
   - Jane (position 2) received a **CHAIN_DETACHED** notification (DOWNWARD).
   - Jane's chain link now points at a different `chainId` from F2's — the orphan segment split into its own chain.
   - The original Birch Way chain has only Emily's link (WITHDRAWN) and Tom's link (intact) left.

### Step 3 — Relist with BUYER_FOUND variants (F3 + F4)

#### F3 — "wait is over" variant

1. Open **F3** (3 Cedar Court). File is withdrawn.
2. The drawer's "Sale 1" history pill now includes a **"Chain at withdrawal"** section showing Tom's response = WAITING.
3. Click the Relist banner → **Relist sale**.
4. Fill in new buyer details. The **"Buyer's onward sale"** section appears at the bottom.
5. Pick any onward path — let's go with **"No — first-time buyer or cash buyer"**.
6. Submit.
7. Behind the scenes:
   - Emily's link's `withdrawalStatus` clears.
   - A new BUYER_FOUND row is queued targeting Tom's link.
   - Email drain fires the "wait is over" variant copy:
     > The wait is over — a new buyer has been secured for the property below you in the chain. The onward chain has reformed.
8. Check Tom's notification: the BUYER_FOUND row has variant copy referencing his prior WAITING response.

#### F4 — "stand down" variant

1. Same as F3 but on **F4** (4 Dahlia Drive). Tom previously responded REMARKETING.
2. Relist. BUYER_FOUND fires with the "stand down" variant:
   > A new buyer has been secured for the property below you in the chain. You'd told us you were remarketing in the meantime — you can stand that down. The chain has tied up again.

### Step 4 — "Don't know yet" → chainSetupPending hub card (F5)

1. Open **F5** (5 Elm Place). File is withdrawn.
2. Click Relist. Fill in new buyer details.
3. On the **"Buyer's onward sale"** step, pick **"Don't know yet — set up later"**. Notice the helper text:
   > File flagged. The hub will prompt until cleared.
4. Submit.
5. Navigate to **/agent/hub**.
6. A new card titled **"Complete chain setup"** appears under Attention. It lists F5 with a "Mark sorted" button.
7. The card shows:
   - Address (clickable — opens the file).
   - "[new buyer]'s onward sale is unconfirmed. Flagged [date]."
8. Click **Mark sorted** to clear the flag. Card disappears.

### Step 5 — The withdraw modal helpers per reason

For each reason, the modal preview spells out the chain consequence:

| Reason | Helper text |
|---|---|
| BUYER_WITHDREW | Agent above notified. Downstream detaches. |
| SELLER_WITHDREW | Agent below notified. Upstream detaches. |
| CHAIN_COLLAPSE_ABOVE | No new notification — upstream is already cascading. Downstream detaches. |
| OTHER | Both sides notified. Nothing detaches. |

These previews use the `inChain` prop — they're hidden when the file isn't in a chain.

### Step 6 — Drawer "Chain at withdrawal" section

For F3 / F4 (both already withdrawn), open the file → click the **Sale 1** chip in the header pill row → drawer opens.

Scroll past "Why this sale fell through" and you'll see a new **"Chain at withdrawal"** section showing:

- The reason picked (e.g. "Our buyer pulled out").
- When it was captured.
- A position-ordered list of every claimed link in the chain at that moment.
- Per-link: agency name, agent name, withdrawal status (if any), and any notifications that fired between Emily's link and theirs (with responses inline).
- If a split fired, an amber **"Chain split"** banner.

## What to look out for

- **Animations and chrome** — everything reuses the existing `agent-modal-in` / `agent-acc` / `agent-reveal-in` patterns. Submit cards should slide in identically to existing ones.
- **Email copy** — open Sentry / your SendGrid sink to see the BUYER_FOUND / CHAIN_DETACHED emails. Subject lines and bodies are voice-locked per the spec.
- **Hub card cohabitation** — when chainSetupPending fires alongside the existing "New buyer added" card for outsourced relists, they should sit side by side with consistent chrome.

## Manual reset between tests

If you want to start a fixture from scratch mid-walkthrough:

```
npx tsx scripts/seed-chain-closed-loop-fixtures.ts
```

This nukes and rebuilds all five fixtures. Other Emily files are untouched.
