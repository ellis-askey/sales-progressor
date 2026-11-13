# Outsourced sunset — verification guide (the December walk-through)

**Purpose:** when you're ready to spot-check everything, flip the switch and walk
this list. Every visible change in the whole arc is here, with exactly where to look,
any condition needed to see it, and the before → after. Grounded in the commits, not
memory. Keep it current as we build.

---

## How to use this

1. **With the switch ON (prod default today) there is nothing to see.** Every change
   is byte-identical to today until the switch is off. If you check prod now and see
   no difference, that's correct.
2. To see the changes, run with the switch **off** — locally or a preview deploy, not
   prod: set env `OUTSOURCED_INTAKE_ENABLED=false` and restart. (Unset / anything but
   the exact string `false` = on.)
3. Then walk the sections below. Each row tells you the page, how to reach it, and what
   now reads/behaves differently.

> The marketing **website** and the `/outsource` cold-outreach page are a SEPARATE
> bucket (your Christmas job) and are not in this guide yet.

---

## 1. Agent app (what agents see)

| Surface | Where / how to reach it | Condition to see it | With the switch OFF | Commit |
|---|---|---|---|---|
| **New-sale "Send to us" toggle** | `/agent/transactions/new` | Agency with **no external progressor** | The "Self-progress / Send to us" toggle is **gone** — the form is self-progress only. (An agency *with* an external progressor still sees "Send to {them}".) | `aea5bc0b` |
| **New-sale default** | `/agent/transactions/new` | A progressor-managed / legacy-named agency | Opens on **self-progress**, not pre-set to "send to us". | `aea5bc0b` |
| **Earnings panel (new sale)** | `/agent/transactions/new`, right column, once you start a file | Self-progress file | The "Self-progress / **Free**" cost row and the "**Your first sale is on us**" line are **hidden**. | `3f48f294` |
| **File-page "Switch to TSP" pill** | Open any active self-managed file → `/agent/transactions/[id]` | Director; agency with no external progressor | The "Switch to TSP / Hand over" pill is **gone**. (Hand-over to an external progressor, if any, stays.) | `aea5bc0b` |
| **Welcome modal + tour** | First-run welcome (use `/dev/welcome-modals` to preview without a fresh signup) | progressor-managed agency | Shows the **self-progress** framing, not "{progressor} will progress your sales for you". | `4a89e07c` |
| **Billing · Plan & terms** | `/agent/account/billing` | Director | "Plan & terms" reads **"£50 per exchange / you only pay when a sale completes. No subscription, no tiers."** instead of "Self-progress Free" + "Outsourced £250/£300/£350 / first sale free". (If the agency has an external progressor, that column stays.) | `3f48f294` |
| **Billing · metrics strip** | `/agent/account/billing` | Director | The stat sub-labels drop the "outsourced / self-progress" split → "{n} exchange(s) this month". | `3f48f294` |

> **Deliberately NOT changed yet:** the billing page's **Payment method** block still
> says "No payment method needed … send a sale to TSP's own progression team." That's
> entangled with a real logic question (does an agent need a card to pay £50?), which
> belongs to the billing-engine/card work, not this copy pass. Flagged, not done.

---

## 2. Emails (what lands in inboxes)

Emails aren't pages — use the test-render routes to see them.

| Email | How to see it | With the switch OFF | Commit |
|---|---|---|---|
| **Welcome (activation day 1)** | Test-render route for the retention emails | Feature strip ① "Simple pricing / £50 per exchange, nothing else." ② "Pay on completion / you only pay when a sale exchanges." Body drops "if you'd like us to take care of a sale for you, your first one is on us." | `7dbc037e` |
| **"Your sale is now connected"** | Test-render route | Same feature-strip swap; body + summary drop the "first outsourced sale is on us" promise. | `7dbc037e` |
| **"Send us another sale" win-back** (`send_to_us_drop_21d`, the "Rachel" email) | Retention cron | **Not sent at all** — the whole dispatch is skipped. | `7dbc037e` |
| **External progression-business welcome** | — | **Unchanged** (deliberately — that's the kept model). | — |

---

## 3. Command Centre (what you see as superadmin)

| Surface | Where / how | Condition | With the switch OFF | Commit |
|---|---|---|---|---|
| **Per-sale "mark free" toggle** | `/command/agency/[agencyId]` → the sales table → "Billing" column | A **flat-fifty** file (created after the flip) | A Free / £50 toggle appears; click to comp that exchange. Pre-flip files show "—". | `17d636b5` |
| **Revenue forecasting** | `/command/revenue` and `/command/revenue/[agencyId]` | A flat-fifty file exists | Flat-fifty files are valued at **£50** (pipeline + banked), not £0. | `61660a16` |

---

## 4. Server behaviour (not visual — verify by doing, not looking)

| Behaviour | How to verify | With the switch OFF |
|---|---|---|
| **New TSP intake blocked** | Try to create a sale with `progressedBy=progressor` to TSP (e.g. a stale form submit) | Server refuses with a clear message. | 
| **Director → TSP hand-over blocked** | Call the switch-service action toward TSP | Refused; external-progressor hand-over and admin switches still work. |
| **£50 per exchange** | Create a self-progress sale (now flat-fifty), take it to exchange, check the invoice/running total | Bills **£50** (not £0, not a band). In-flight pre-flip sales keep their old pricing. |

---

## 5. What must STAY the same (confirm these did NOT change)

- **External progression businesses** (Boardwalk etc.) — their sign-up, billing (£59/£39/£5), client management, and portals are untouched in every state.
- **The existing outsourced book** — internal servicing, the assigned-progressor workflow, and billing of in-flight outsourced files continue.
- **With the switch ON** — the entire app is byte-identical to today.

---

## 6. Still to come (not in this guide yet)

- In-app **marketing copy** beyond the above (none outstanding in the app besides the payment-method block noted in §1).
- **Website + terms** (separate Vercel deploy — Christmas).
- **Marketplace / intro** (Workstream B — dark foundation, no visible change).
- Billing-engine **card requirement** for the £50 (resolves the §1 payment-method note).
