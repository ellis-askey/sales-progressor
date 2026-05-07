# Milestones Tab

The Milestones tab is the core of each property file. It shows all 20 vendor milestones (VM1–VM20) and up to 27 purchaser milestones (PM1–PM27), grouped by side, and lets you mark them complete as events happen.

## Layout

Milestones are shown in two columns: **Vendor** on the left and **Purchaser** on the right. Within each column, milestones appear in order — VM1 at the top through VM20 at the bottom, and PM1 through PM27.

Each milestone shows:
- The milestone code and name
- Its current state: Locked, Available, Complete, or Not Required
- A completion date (if marked complete)
- A note or date field if relevant (e.g. survey date for PM10)

## Milestone states

| State | Meaning |
|---|---|
| **Locked** | Cannot be acted on yet — a predecessor milestone must be completed first |
| **Available** | Ready to be marked complete. This is the active state. |
| **Complete** | Done. The date it was marked complete is shown. |
| **Not Required** | Does not apply to this transaction (e.g. leasehold milestones on a freehold sale) |

See [How milestones work](../03-milestones/how-milestones-work.md) for a full explanation of predecessor rules and state transitions.

## Marking a milestone complete

Click a milestone in the **Available** state. A confirmation panel slides open. Review the details and click **Mark complete**. The milestone is stamped with today's date and any predecessor-locked milestones that depended on it become Available.

Some milestones prompt for an additional date (e.g. the survey date for PM10 or the mortgage offer date for PM11). Enter the date if prompted — it is used by the reminder engine.

## Marking a milestone Not Required

Only certain milestones can be marked Not Required manually:

- **PM9 (Survey booked)** — if the buyer has decided not to commission a survey. This also cascades PM10 (Survey report received) to Not Required automatically.

All other Not Required assignments happen automatically:
- Freehold property: VM8, VM9, PM12 → Not Required at file creation
- Cash buyer: PM5, PM6, PM11 → Not Required at file creation

See [Not-required milestones](../03-milestones/not-required.md) for more detail.

## Undoing a completion

If a milestone was marked complete in error, click it to open the panel and select **Unmark**. This reverts the milestone to Available and re-locks any downstream milestones that depended on it.

## Progress percentage

The progress percentage in the file header is calculated from the milestones. Each milestone has a weight; the percentage is the sum of complete milestone weights divided by the sum of all applicable (non-Not-Required) milestone weights. A file with no milestones complete shows 0%; a file with all milestones complete shows 100%.

## Related articles

- [How milestones work](../03-milestones/how-milestones-work.md)
- [Vendor milestones — VM1 to VM20](../03-milestones/vendor-milestones.md)
- [Purchaser milestones — PM1 to PM27](../03-milestones/purchaser-milestones.md)
- [Exchange gates — VM18 and PM25](../03-milestones/exchange-gates.md)
- [Not-required milestones](../03-milestones/not-required.md)
