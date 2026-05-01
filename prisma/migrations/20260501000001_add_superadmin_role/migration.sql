-- Migration: add_superadmin_role
-- Adds 'superadmin' as the highest UserRole enum value.
-- Safe to re-run (IF NOT EXISTS).

-- ALTER TYPE ... ADD VALUE cannot run inside a PL/pgSQL block.
-- Run this statement directly against the database.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'superadmin' BEFORE 'admin';

-- ─── Founder account ──────────────────────────────────────────────────────────
-- After applying this migration, create the founder superadmin account:
--
-- INSERT INTO "User" (id, name, email, role, "createdAt", "updatedAt")
-- VALUES (
--   gen_random_uuid()::text,
--   'Ellis Askey',
--   'ellisaskey+superadmin@googlemail.com',
--   'superadmin',
--   now(),
--   now()
-- )
-- ON CONFLICT (email) DO UPDATE SET role = 'superadmin';
--
-- Then set the password via the app's reset-password flow, or set it directly:
-- UPDATE "User"
-- SET password = '<bcrypt_hash_of_generated_password>'
-- WHERE email = 'ellisaskey+superadmin@googlemail.com';
--
-- Password is generated and printed in the Phase 2 checkpoint.
