# Not-Required Milestones

Some milestones don't apply to every transaction. When a milestone is Not Required, it is excluded from the progress calculation, no reminder is generated for it, and it doesn't appear as a blocker in the milestone sequence.

## Automatically set at file creation

The following milestones are set to Not Required automatically based on the answers given when creating the file:

### For freehold properties

| Milestone | Why |
|---|---|
| VM8 — Management pack requested | No managing agent or freeholder for freehold properties |
| VM9 — Management pack received (seller) | Depends on VM8 |
| PM12 — Management pack received (buyer) | No management pack to receive |

### For cash buyers (no mortgage)

| Milestone | Why |
|---|---|
| PM5 — Mortgage application submitted | No mortgage needed |
| PM6 — Lender valuation booked | No lender, no valuation |
| PM11 — Mortgage offer received | No mortgage offer to receive |

If a property is both freehold **and** the buyer is cash, all six of the above milestones are Not Required — a total of six milestones removed from the active checklist.

## Manually set by the agent

Only one milestone can be set to Not Required manually:

### PM9 — Survey booked

If the buyer has decided not to commission a survey (which is their right, though not recommended), you can mark PM9 as Not Required from the Milestones tab.

**Important:** Marking PM9 Not Required automatically sets PM10 (Survey report received) to Not Required too, because there is no survey report if no survey was commissioned.

## What happens to milestones that depended on a Not Required milestone

When a milestone is set to Not Required, any milestones that were locked waiting for it as a predecessor are also set to Not Required — because they're waiting on something that will never happen. This cascade continues through as many levels as needed.

For example: if PM9 is Not Required → PM10 (which depends on PM9) is also Not Required.

## Can you reverse a Not Required assignment?

Yes. If circumstances change (e.g. a buyer changes from cash to mortgage mid-transaction, or a property turns out to be leasehold after all), you can remove the Not Required assignment from the Milestones tab. The milestone reverts to Locked or Available depending on whether its predecessor has been completed.

Contact your manager or Sales Progressor support if you're unsure whether a Not Required assignment should be reversed.

## Related articles

- [How milestones work](how-milestones-work.md)
- [Vendor milestones — VM1 to VM20](vendor-milestones.md)
- [Purchaser milestones — PM1 to PM27](purchaser-milestones.md)
- [Creating a new sale](../02-property-file/creating-a-sale.md)
