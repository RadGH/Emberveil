-- 0001_saves_table.sql
-- Phase 2 of auth/saves/stripe plan.
-- Creates the cloud save-slot table with RLS so each user can only
-- read/write their own saves, and an updated_at trigger for client use.

create table if not exists public.saves (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  slot_name   text        not null,
  state       jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, slot_name)
);

create index if not exists saves_user_id_updated_at_idx
  on public.saves (user_id, updated_at desc);

-- updated_at auto-bump
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_set_updated_at on public.saves;
create trigger saves_set_updated_at
before update on public.saves
for each row execute function public.set_updated_at();

-- Row-level security
alter table public.saves enable row level security;

drop policy if exists "saves_select_own"  on public.saves;
drop policy if exists "saves_insert_own"  on public.saves;
drop policy if exists "saves_update_own"  on public.saves;
drop policy if exists "saves_delete_own"  on public.saves;

create policy "saves_select_own" on public.saves
  for select using (auth.uid() = user_id);

create policy "saves_insert_own" on public.saves
  for insert with check (auth.uid() = user_id);

create policy "saves_update_own" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saves_delete_own" on public.saves
  for delete using (auth.uid() = user_id);

-- No policy for anon role = anon has zero access. service_role bypasses RLS
-- by default, so the (future) webhook can manage saves administratively if needed.
