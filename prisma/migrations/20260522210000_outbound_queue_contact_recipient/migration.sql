-- A5 of the client-chase arc (foundation Sub-arc A).
-- Extend OutboundEmailQueue to support Contact recipients alongside User
-- recipients. Existing rows already have recipientUserId set (column was
-- NOT NULL pre-migration) and the new recipientContactId defaults NULL,
-- so the CHECK constraint passes for every existing row by construction.
--
-- Pre-validated against staging via scripts/verify-a5-precheck.ts:
--   * recipientUserId IS NULL count = 0
--   * recipientUserId is currently text NOT NULL
-- Production pre-check delivered via Supabase SQL editor before any
-- prod migration (per hardening protocol).
--
-- Non-destructive: drop NOT NULL is an instant catalog-only change at this
-- row count; adding a nullable column is constant-time; adding a CHECK is
-- O(rows) but reads the constraint condition row-by-row without locking.

-- 1. Make recipientUserId nullable
ALTER TABLE "OutboundEmailQueue" ALTER COLUMN "recipientUserId" DROP NOT NULL;

-- 2. Add the new Contact-recipient column
ALTER TABLE "OutboundEmailQueue" ADD COLUMN "recipientContactId" TEXT;

-- 3. Exactly-one-recipient invariant. Existing rows have userId set and
--    contactId NULL → first disjunct → CHECK passes.
ALTER TABLE "OutboundEmailQueue"
  ADD CONSTRAINT "outbound_email_one_recipient_chk"
  CHECK (
    ("recipientUserId" IS NOT NULL AND "recipientContactId" IS NULL)
    OR
    ("recipientUserId" IS NULL AND "recipientContactId" IS NOT NULL)
  );

-- 4. Foreign-key to Contact with ON DELETE CASCADE (matches the existing
--    behaviour pattern — orphaned queue rows for deleted recipients are
--    dropped rather than left to fail at send time).
ALTER TABLE "OutboundEmailQueue"
  ADD CONSTRAINT "OutboundEmailQueue_recipientContactId_fkey"
  FOREIGN KEY ("recipientContactId")
  REFERENCES "Contact"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 5. Parallel partial-unique on the contact column. Postgres treats NULL
--    as distinct in unique indexes, so this enforces uniqueness only for
--    rows where recipientContactId IS NOT NULL — mirrors the existing
--    @@unique([emailType, sourceId, recipientUserId]).
CREATE UNIQUE INDEX "OutboundEmailQueue_emailType_sourceId_recipientContactId_key"
  ON "OutboundEmailQueue" ("emailType", "sourceId", "recipientContactId");

-- 6. Make the existing FK on recipientUserId also CASCADE-on-delete.
--    Same orphan-prevention rationale as #4; the original schema didn't
--    declare an FK at the database level (the prisma relation handled it
--    in app code). Defensive: skip if the constraint already exists (some
--    historical migrations may have added it).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'OutboundEmailQueue'
      AND constraint_name = 'OutboundEmailQueue_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "OutboundEmailQueue"
      ADD CONSTRAINT "OutboundEmailQueue_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId")
      REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
