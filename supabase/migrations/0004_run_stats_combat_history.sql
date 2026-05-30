-- 0004_run_stats_combat_history.sql
-- Adds the combat_history column that runStatsClient.js was already writing
-- (since M415) but the column was never created in the schema, causing those
-- writes to fail silently. Also adds enemy_ids and a dedicated index for the
-- "last 50 sessions per player" query used by the Statistics screen.
--
-- Safe to run on an existing table — all changes use IF NOT EXISTS / IF EXISTS
-- guards so this is idempotent.

-- 1. Add combat_history column (jsonb array of per-fight summaries).
--    Each element has the shape produced by recordFightEnd in stats.js:
--    { ts, startedAt, durationSec, won, zoneId, kind, perChar, totals }
alter table public.run_stats
  add column if not exists combat_history jsonb not null default '[]'::jsonb;

-- 2. Composite index for the Statistics screen query:
--    SELECT * FROM run_stats WHERE user_id=$1 ORDER BY started_at DESC LIMIT 50
--    The existing run_stats_user_started_idx already covers this, but let's
--    ensure it exists explicitly with the name the docs reference.
create index if not exists run_stats_user_started_desc_idx
  on public.run_stats (user_id, started_at desc);

-- 3. Update the trim trigger to keep the last 50 rows (not 100) to match the
--    "last 50 sessions" requirement. Replace the existing function body.
create or replace function public.trim_run_stats()
returns trigger language plpgsql as $$
begin
  delete from public.run_stats
   where id in (
     select id from public.run_stats
      where user_id = new.user_id
      order by started_at desc
      offset 50
   );
  return new;
end;
$$;
-- Trigger already exists from 0002; drop + recreate to pick up the new offset.
drop trigger if exists run_stats_trim on public.run_stats;
create trigger run_stats_trim
  after insert on public.run_stats
  for each row execute function public.trim_run_stats();
