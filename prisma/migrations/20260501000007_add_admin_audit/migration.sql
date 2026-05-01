-- Migration: add_admin_audit
-- Adds AdminAuditLog table for command centre superadmin actions.
-- Append-only by design — no UPDATE/DELETE ever issued against this table.
-- Safe to re-run (idempotent).

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"           TEXT        NOT NULL,
  "occurredAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "adminUserId"  TEXT        NOT NULL,
  "ipAddress"    TEXT,
  "userAgent"    TEXT,
  "action"       TEXT        NOT NULL,
  "targetType"   TEXT,
  "targetId"     TEXT,
  "beforeValue"  JSONB,
  "afterValue"   JSONB,
  "reason"       TEXT,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_occurredAt_idx"
  ON "AdminAuditLog"("occurredAt");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminUserId_occurredAt_idx"
  ON "AdminAuditLog"("adminUserId", "occurredAt");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_occurredAt_idx"
  ON "AdminAuditLog"("action", "occurredAt");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx"
  ON "AdminAuditLog"("targetType", "targetId");
