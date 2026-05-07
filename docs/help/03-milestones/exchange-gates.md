# Exchange Gates — VM18 and PM25

Before contracts can be exchanged, both sides of the transaction must confirm they are ready. In Sales Progressor, this is enforced through two exchange-gate milestones:

- **VM18** — Seller's solicitor ready to exchange
- **PM25** — Buyer's solicitor ready to exchange

Both must be marked **Complete** before exchange can happen. If only one side is ready, the file sits in a waiting state — marked ready on one side, pending on the other.

## Why there are two gates

Exchange in a residential sale requires simultaneous confirmation from both solicitors. The seller's side must have: signed contracts, all ID completed, all enquiries answered, and the seller's solicitor confirmed ready. The buyer's side must have: signed contracts, deposit held, all enquiries satisfied, mortgage offer in place (if applicable), and the buyer's solicitor confirmed ready.

The two gates track these two independent confirmations. Either can be achieved first — the order doesn't matter. But both must be Complete before the file moves to exchanged.

## What triggers each gate becoming Available

**VM18 (seller ready)** becomes Available when VM17 (signed contracts returned by seller) is marked Complete.

**PM25 (buyer ready)** becomes Available when PM24 (deposit transferred by buyer) is marked Complete.

Both gates have short grace periods (2 days) and short repeat intervals (every 2 days) — they are the most urgently chased milestones in the system.

## What happens after both gates are complete

Once both VM18 and PM25 are marked Complete, the file is flagged as "Exchanging soon" in the Hub pipeline stats. The next steps are:

1. **VM19** (contracts exchanged — seller) and **PM26** (contracts exchanged — buyer) — mark both once exchange actually happens
2. Set the completion date in the file
3. **VM20** (sale completed) and **PM27** (purchase completed) — mark both on the day of completion
4. Update the file status to Exchanged (after VM19/PM26), then Completed (after VM20/PM27)

## Related articles

- [Vendor milestones — VM1 to VM20](vendor-milestones.md)
- [Purchaser milestones — PM1 to PM27](purchaser-milestones.md)
- [How milestones work](how-milestones-work.md)
- [Completions view](../01-running-your-pipeline/completions.md)
