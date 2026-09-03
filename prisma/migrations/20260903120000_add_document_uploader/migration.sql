-- Track which agent/internal user uploaded a file-level document (memo of
-- sale, admin uploads). Nullable: client/portal uploads carry a contact
-- instead, and historical rows stay null (feed falls back to a generic label).
ALTER TABLE "TransactionDocument" ADD COLUMN "uploadedById" TEXT;

ALTER TABLE "TransactionDocument"
  ADD CONSTRAINT "TransactionDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
