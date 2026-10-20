-- WhatsApp promise scan: "possible promise" flag on ManualTask. Additive.
ALTER TABLE "ManualTask" ADD COLUMN "isPossible" BOOLEAN NOT NULL DEFAULT false;
