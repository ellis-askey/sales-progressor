-- ============================================================================
-- PR 51: Row-Level Security — agency isolation
-- Staging deploy only. Production activation is a separate step after
-- staging walk-through passes. See docs/MANUAL_TASKS.md for activation.
-- ============================================================================
--
-- TABLES COVERED
--   PropertyTransaction   agencyId String (required)
--   User                  agencyId String? (nullable for superadmin)
--   Contact               agencyId indirectly via PropertyTransaction
--   ManualTask            agencyId String (required)
--   SolicitorFirm         agencyId String (required)
--
-- CURRENT STATE (staging safety net)
--   RLS is ENABLED on all five tables.
--   A PERMISSIVE bypass policy (USING (true)) lets the app DB user see all
--   rows — identical to no RLS. This keeps staging functional while the
--   infrastructure is in place.
--
-- FUTURE STATE (production activation — see MANUAL_TASKS.md)
--   DROP the bypass policies below.
--   CREATE the strict policies (commented section at the bottom).
--   Every data-access call that should be scoped must first run:
--     SELECT set_config('app.current_agency_id', '<agencyId>', TRUE)
--   inside the same transaction. The withAgencyRls() helper in
--   lib/prisma-rls.ts does this automatically.
-- ============================================================================

-- ── PropertyTransaction ───────────────────────────────────────────────────────

ALTER TABLE "PropertyTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyTransaction" FORCE ROW LEVEL SECURITY;

-- Staging bypass — remove when activating strict mode
CREATE POLICY rls_pt_staging_bypass ON "PropertyTransaction"
  AS PERMISSIVE
  FOR ALL
  USING (true);

-- ── User ─────────────────────────────────────────────────────────────────────

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

-- Staging bypass — remove when activating strict mode
CREATE POLICY rls_user_staging_bypass ON "User"
  AS PERMISSIVE
  FOR ALL
  USING (true);

-- ── Contact ───────────────────────────────────────────────────────────────────
-- Contact has no direct agencyId; it is isolated via propertyTransactionId.
-- With RLS on PropertyTransaction the join is automatically filtered when
-- strict mode is active. We still enable RLS here to block direct SELECT.

ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_contact_staging_bypass ON "Contact"
  AS PERMISSIVE
  FOR ALL
  USING (true);

-- ── ManualTask ────────────────────────────────────────────────────────────────

ALTER TABLE "ManualTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ManualTask" FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_mt_staging_bypass ON "ManualTask"
  AS PERMISSIVE
  FOR ALL
  USING (true);

-- ── SolicitorFirm ─────────────────────────────────────────────────────────────

ALTER TABLE "SolicitorFirm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SolicitorFirm" FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_sf_staging_bypass ON "SolicitorFirm"
  AS PERMISSIVE
  FOR ALL
  USING (true);


-- ============================================================================
-- STRICT ACTIVATION POLICIES (run AFTER staging walk-through passes)
-- These replace the bypass policies above. Run as a separate migration.
-- ============================================================================

/*

-- PropertyTransaction
DROP POLICY rls_pt_staging_bypass ON "PropertyTransaction";
CREATE POLICY rls_pt_agency ON "PropertyTransaction"
  AS RESTRICTIVE
  FOR ALL
  USING (
    "agencyId" = current_setting('app.current_agency_id', true)
  );

-- User
-- Superadmin users have agencyId IS NULL — they must still be accessible
-- for NextAuth session resolution. The policy allows superadmin rows through.
DROP POLICY rls_user_staging_bypass ON "User";
CREATE POLICY rls_user_agency ON "User"
  AS RESTRICTIVE
  FOR ALL
  USING (
    "agencyId" = current_setting('app.current_agency_id', true)
    OR "agencyId" IS NULL
  );

-- Contact (isolated via transaction join; allow when context matches the transaction's agency)
DROP POLICY rls_contact_staging_bypass ON "Contact";
CREATE POLICY rls_contact_agency ON "Contact"
  AS RESTRICTIVE
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "PropertyTransaction" pt
      WHERE pt.id = "Contact"."propertyTransactionId"
        AND pt."agencyId" = current_setting('app.current_agency_id', true)
    )
  );

-- ManualTask
DROP POLICY rls_mt_staging_bypass ON "ManualTask";
CREATE POLICY rls_mt_agency ON "ManualTask"
  AS RESTRICTIVE
  FOR ALL
  USING (
    "agencyId" = current_setting('app.current_agency_id', true)
  );

-- SolicitorFirm
DROP POLICY rls_sf_staging_bypass ON "SolicitorFirm";
CREATE POLICY rls_sf_agency ON "SolicitorFirm"
  AS RESTRICTIVE
  FOR ALL
  USING (
    "agencyId" = current_setting('app.current_agency_id', true)
  );

*/
