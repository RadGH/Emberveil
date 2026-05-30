-- 0002_run_stats.sql
-- M325 — Cloud-synced per-run statistics for signed-in users.
--
-- Each row is one game run (one started → ended cycle, or in-progress).
-- The client trims to the latest 100 rows per user via an after-insert trigger
-- so storage stays bounded; older rows roll off automatically.
--
-- Local-only stats (browsers without an account or in private mode) keep
-- using localStorage in src/game/stats.js — this table is the OPTIONAL
-- account-bound mirror.

create table if not exists public.run_stats (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  run_id          text          not null,                              -- client-generated UUID
  started_at      timestamptz   not null default now(),
  ended_at        timestamptz   null,                                  -- null = run still active
  hero_name       text          null,
  hero_class      text          null,
  hero_appearance text          null,
  difficulty      text          null,                                  -- easy|normal|hard
  hardcore        boolean       not null default false,
  outcome         text          null,                                  -- 'win' | 'died' | 'abandoned'
  max_level       int           not null default 1,
  zones_cleared   int           not null default 0,
  totals          jsonb         not null default '{}'::jsonb,          -- damage/kills/etc.
  per_char        jsonb         not null default '{}'::jsonb,          -- per-character breakdown
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  unique (user_id, run_id)
);

create index if not exists run_stats_user_started_idx
  on public.run_stats (user_id, started_at desc);

-- Reuse the updated_at bump trigger from 0001 if it exists; otherwise create it.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists run_stats_set_updated_at on public.run_stats;
create trigger run_stats_set_updated_at
before update on public.run_stats
for each row execute function public.set_updated_at();

-- Trim to the last 100 rows per user after each insert.
create or replace function public.trim_run_stats()
returns trigger language plpgsql as $$
begin
  delete from public.run_stats
   where id in (
     select id from public.run_stats
      where user_id = new.user_id
      order by started_at desc
      offset 100
   );
  return new;
end;
$$;

drop trigger if exists run_stats_trim on public.run_stats;
create trigger run_stats_trim
after insert on public.run_stats
for each row execute function public.trim_run_stats();

-- Row-level security
alter table public.run_stats enable row level security;

drop policy if exists "run_stats_select_own" on public.run_stats;
drop policy if exists "run_stats_insert_own" on public.run_stats;
drop policy if exists "run_stats_update_own" on public.run_stats;
drop policy if exists "run_stats_delete_own" on public.run_stats;

create policy "run_stats_select_own" on public.run_stats
  for select using (auth.uid() = user_id);
create policy "run_stats_insert_own" on public.run_stats
  for insert with check (auth.uid() = user_id);
create policy "run_stats_update_own" on public.run_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "run_stats_delete_own" on public.run_stats
  for delete using (auth.uid() = user_id);
