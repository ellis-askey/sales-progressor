# Technical TODOs

## reminders/run — scaling ceiling

`/api/reminders/run` processes all active transactions in a single serverless function invocation,
batched 8 at a time via `Promise.allSettled`. This works well up to ~100–150 active transactions
before the 120s `maxDuration` becomes a hard ceiling.

**When this matters:** once active transaction volume exceeds ~150 concurrently.

**Options when the time comes:**
- Split into paginated cron runs (e.g. two cron schedules, each processing half by ID range)
- Move reminder evaluation to a queue (Vercel Queue, or a dedicated worker with a persistent loop)
- Shard by agency so each invocation handles one agency's transactions

Tracked here so it doesn't get lost. No action needed until volume warrants it.
