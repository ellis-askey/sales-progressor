-- Human-readable reason for the ClientChaseState's current status. Pre-fix,
-- when a row moved out of "active" (to escalated / cancelled / completed),
-- callers had to reconstruct WHY by looking at surrounding rows (was the
-- milestone completed? reversed? relisted? did the client hit chase-count
-- cap?). Storing the reason on the row itself lets the chase-history panel
-- and the daily brief explain each transition without guesswork.
--
-- Nullable + no backfill. Existing non-active rows keep null and render as
-- "no reason recorded" until the row is re-flipped by a future transition.

ALTER TABLE "ClientChaseState"
  ADD COLUMN "statusReason" TEXT;
