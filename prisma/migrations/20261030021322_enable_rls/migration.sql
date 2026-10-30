-- Enable Row Level Security on every table in the public schema.
--
-- The app reaches the database only through Prisma, connecting as the
-- `postgres` role (the table owner, which has BYPASSRLS), so its queries are
-- unaffected. With RLS on and no policies, Supabase's `anon` and
-- `authenticated` roles (used by the PostgREST Data API) can no longer read
-- or write these tables. RLS is not FORCEd, so the owner still bypasses it.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
  END LOOP;
END
$$;
