-- Two optional fields on PropertyTransaction for the WhatsApp-group-helper
-- + property-photo feature landed 2026-07-08.
--
--   whatsappGroupInviteUrl - the invite link the agent pastes after creating
--     the WhatsApp group manually. Powers per-contact "send invite" flow.
--
--   photoStoragePath / photoUploadedAt - optional hero image shown on the
--     client portal. Path is in the transaction-documents bucket. When null,
--     no image is rendered (no dashed placeholder). photoUploadedAt lets
--     the signed-URL layer cache-bust on re-upload.
--
-- All nullable, all default null. Zero behavioural change on existing rows.

ALTER TABLE "PropertyTransaction"
  ADD COLUMN "whatsappGroupInviteUrl" TEXT,
  ADD COLUMN "photoStoragePath"       TEXT,
  ADD COLUMN "photoUploadedAt"        TIMESTAMP(3);
