-- AuditLog Row Level Security (RLS) — run once after initial migration
-- Enforces append-only constraint at the database level.
-- Prisma ORM cannot express these policies; apply manually after `prisma migrate deploy`.
--
-- Usage:
--   psql $DATABASE_URL -f prisma/rls-audit-log.sql

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Block all UPDATE attempts unconditionally
DROP POLICY IF EXISTS no_update ON "audit_logs";
CREATE POLICY no_update ON "audit_logs"
  FOR UPDATE USING (false);

-- Block all DELETE attempts unconditionally
DROP POLICY IF EXISTS no_delete ON "audit_logs";
CREATE POLICY no_delete ON "audit_logs"
  FOR DELETE USING (false);

-- Allow the application role to INSERT (append) new records
-- Replace 'app_user' with your actual DB role if different
DROP POLICY IF EXISTS allow_insert ON "audit_logs";
CREATE POLICY allow_insert ON "audit_logs"
  FOR INSERT WITH CHECK (true);

-- Allow reads (SELECT) for all authenticated roles
DROP POLICY IF EXISTS allow_select ON "audit_logs";
CREATE POLICY allow_select ON "audit_logs"
  FOR SELECT USING (true);
