-- Per-agency WhatsApp controls (Phase 3 part 3): a Command Centre kill switch for
-- capture (on by default) and an opt-in for auto to-dos (off by default).
ALTER TABLE "Agency" ADD COLUMN "whatsAppCaptureEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Agency" ADD COLUMN "whatsAppTasksEnabled" BOOLEAN NOT NULL DEFAULT false;
