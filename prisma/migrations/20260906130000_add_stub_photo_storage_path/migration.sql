-- Internal-only property thumbnail for an unclaimed chain link, uploaded from the
-- chain drawer. Object path in the private transaction-documents bucket, signed on
-- read like PropertyTransaction.photoStoragePath. Cleared when the link is claimed.
ALTER TABLE "ChainLink" ADD COLUMN "stubPhotoStoragePath" TEXT;
