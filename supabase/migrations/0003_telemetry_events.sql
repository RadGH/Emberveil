-- 0003_telemetry_events.sql
-- M330 — Optional first-party telemetry mirror.
--
-- Mirrors the same milestone events that go to Google Analytics 4 (run_started,
-- run_completed_win/death, level_up, boss_killed, class_unlocked,
-- fame_threshold_reached) into Supabase so we can run our own queries without
-- depending on GA.
--
-- This migration is OPTIONAL. The runtime client (src/utils/consent.js +
-- the hooks in stats.js / xp.js / etc.) keeps working with or without this
-- table — when the table doesn't exist, the optional Supabase write is a
-- silent no-op. Apply this if you want first-party event analysis.

create table if not exists public.telemetry_events (
  id           bigserial primary key,
  user_id      uuid          null references auth.users(id) on delete cascade,
  session_id   text          not null,
  event_name   text          not null,
  props        jsonb         not null default '{}'::jsonb,
  app_version  text          null,
  created_at   timestamptz   not null default now()
);

create index if not exists telemetry_events_user_created_idx
  on public.telemetry_events (user_id, created_at desc);

create index if not exists telemetry_events_event_idx
  on public.telemetry_events (event_name, created_at desc);

-- Trim to the most recent 1000 rows per signed-in user. Anonymous (null
-- user_id) writes are kept up to a separate global cap of 50000 rows.
create or replace function public.trim_telemetry_events()
returns trigger language plpgsql as $$
begin
  if new.user_id is not null then
    delete from public.telemetry_events
     where id in (
       select id from public.telemetry_events
        where user_id = new.user_id
        order by created_at desc
        offset 1000
     );
  else
    delete from public.telemetry_events
     where user_id is null
       and id in (
         select id from public.telemetry_events
          where user_id is null
          order by created_at desc
          offset 50000
       );
  end if;
  return new;
end;
$$;

drop trigger if exists telemetry_events_trim on public.telemetry_events;
create trigger telemetry_events_trim
after insert on public.telemetry_events
for each row execute function public.trim_telemetry_events();

-- Row-level security
alter table public.telemetry_events enable row level security;

drop policy if exists "telemetry_select_own" on public.telemetry_events;
drop policy if exists "telemetry_insert_self" on public.telemetry_events;

-- Users can read their own rows, plus their own anonymous-session rows
-- (matching session_id). Service-role bypasses RLS for aggregates.
create policy "telemetry_select_own" on public.telemetry_events
  for select using (auth.uid() = user_id);

-- Anyone (including anon) can insert ONE row at a time, but the user_id must
-- either be null or match the caller. session_id is required.
create policy "telemetry_insert_self" on public.telemetry_events
  for insert with check (
    (user_id is null or auth.uid() = user_id)
    and session_id is not null
    and length(session_id) between 8 and 64
  );
