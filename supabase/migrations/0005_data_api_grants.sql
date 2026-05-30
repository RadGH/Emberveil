-- 0005_data_api_grants.sql
-- M514 — Explicit Data API GRANTs ahead of the 2026-10-30 Supabase deadline.
--
-- Starting 2026-10-30, Supabase enforces that tables in public are NOT
-- exposed to PostgREST / supabase-js / GraphQL unless an explicit GRANT is
-- present. Existing tables keep their implicit grants until that date.
--
-- This migration codifies the grants we depend on so:
--   1. The October enforcement is a no-op for us (we already have GRANTs).
--   2. Any future schema spin-up (fresh Supabase project, dev clone, branch)
--      replays the grants exactly. No "works on prod, broken on staging".
--   3. New tables added after May 30 2026 must include their grants in the
--      same migration. See the policy block at the bottom for the template.
--
-- All statements are idempotent. Safe to re-apply.

-- ---------------------------------------------------------------------------
-- public.saves (0001) -- per-user cloud save mirror.
--   anon: no access (saves are user-scoped).
--   authenticated: full CRUD (RLS narrows to auth.uid()).
--   service_role: bypasses RLS (existing behavior).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.saves to authenticated;
grant select, insert, update, delete on public.saves to service_role;

-- ---------------------------------------------------------------------------
-- public.run_stats (0002 + 0004) -- per-run summary + combat history JSONB.
--   Same scoping as saves.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.run_stats to authenticated;
grant select, insert, update, delete on public.run_stats to service_role;

-- ---------------------------------------------------------------------------
-- public.telemetry_events (0003) -- anonymous + signed-in event mirror.
--   anon: INSERT only (matching the RLS policy). NO select.
--   authenticated: INSERT + SELECT-own (RLS narrows).
--   service_role: full access for aggregates.
-- ---------------------------------------------------------------------------
grant insert on public.telemetry_events to anon;
grant select, insert on public.telemetry_events to authenticated;
grant select, insert, update, delete on public.telemetry_events to service_role;

-- Sequence access required for INSERT on tables with bigserial PKs.
grant usage, select on sequence public.telemetry_events_id_seq to anon;
grant usage, select on sequence public.telemetry_events_id_seq to authenticated;

-- ---------------------------------------------------------------------------
-- Policy for FUTURE tables (do NOT delete this comment).
--
-- Every new migration that creates a table in public MUST include:
--
--   grant <minimal-needed-ops> on public.<table> to anon;        -- only if anonymous access required
--   grant select, insert, update, delete on public.<table> to authenticated;
--   grant select, insert, update, delete on public.<table> to service_role;
--
--   alter table public.<table> enable row level security;
--   create policy ... on public.<table> ...
--
-- If a table is service-role-only (admin tooling), grant to service_role only
-- and explicitly omit the others.
-- ---------------------------------------------------------------------------
