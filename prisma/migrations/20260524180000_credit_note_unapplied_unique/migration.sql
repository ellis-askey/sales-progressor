-- Partial unique index on CreditNote: at most one UNAPPLIED CreditNote per
-- transaction. Closes the concurrency gap flagged in PR 4: two simultaneous
-- executeUndoMilestone calls on the same transaction could previously both
-- pass the application-level existing-credit lookup and both write a
-- CreditNote (a double-credit = invisible money out the door). This puts the
-- "at most one unapplied credit per transaction" rule in the DB layer,
-- mirroring the @@unique([agencyId, monthStart]) trick used for Invoice.
--
-- Applied credits (appliedAt IS NOT NULL) are unconstrained: a transaction
-- can legitimately accumulate multiple applied credits over its lifetime if
-- it's exchanged → reversed → re-exchanged → reversed in different months.
--
-- Prisma's @@unique() doesn't express partial indexes (no `where:` clause),
-- so this constraint lives in raw SQL only. The schema.prisma file doesn't
-- represent it; migrate deploy doesn't validate against schema, so no drift
-- warning in production. (migrate dev would warn, but we don't use that
-- against staging — see scripts/migrate-prod.mjs for the rationale.)
--
-- The application-level existing-credit lookup in handleExchangeReversal
-- stays in place as belt-and-suspenders: it short-circuits cleanly in the
-- common (bilateral) case so the second call doesn't even attempt an
-- INSERT, avoiding the unique-violation error path in production logs.

CREATE UNIQUE INDEX "CreditNote_unapplied_per_transaction_unique"
  ON "CreditNote" ("transactionId")
  WHERE "appliedAt" IS NULL AND "transactionId" IS NOT NULL;
