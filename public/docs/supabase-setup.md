# Supabase Setup — Cloud saves + run statistics

This page is the single source of truth for the Supabase backend that powers
account-bound cloud saves and per-run statistics. Apply these migrations in
order. Each one is idempotent (`create table if not exists` etc.) so re-running
is safe.

---

## Migration order

| # | File | What it adds |
|---|------|--------------|
| 0001 | `supabase/migrations/0001_saves_table.sql`        | `saves` table + RLS for cloud save slots. |
| 0002 | `supabase/migrations/0002_run_stats.sql`          | `run_stats` table + RLS + 100-row-per-user trim trigger. |
| 0003 | `supabase/migrations/0003_telemetry_events.sql`   | **Optional.** `telemetry_events` table + RLS + per-user/anon trim triggers for first-party milestone events (mirrors what goes to GA4). |

The migration files live under `game13/supabase/migrations/` in the repo.

---

## Applying a migration

You have three equivalent options. Pick whichever you already use.

### Option A — Supabase Studio SQL editor (easiest)

1. Open your project on https://app.supabase.com.
2. Sidebar → **SQL Editor** → **+ New query**.
3. Paste the contents of the migration file.
4. **Run**. Expect "Success. No rows returned."

### Option B — psql

```bash
psql "$SUPABASE_DB_URL" < game13/supabase/migrations/0002_run_stats.sql
```

`SUPABASE_DB_URL` lives in your project's **Settings → Database → Connection
string (URI)**. Use the **direct connection** (not the pooled one) for DDL.

### Option C — Supabase CLI

```bash
cd game13
supabase db push                 # applies any new migrations under supabase/migrations/
```

---

## What each migration does

### 0001 — `saves` (existing)

- Cloud save slot per user, JSONB blob.
- RLS so each `auth.users.id` can only read/write their own rows.
- `updated_at` trigger keeps last-modified fresh.

### 0003 — `telemetry_events` (M330, **optional**)

- Mirrors the GA4 milestone events into Supabase: `run_started`,
  `run_completed_win`, `run_completed_death`, `level_up`, `boss_killed`,
  `class_unlocked`, `fame_threshold_reached`.
- Each row carries `user_id` (null for anonymous), `session_id`, `event_name`,
  `props` JSONB, `app_version`, `created_at`.
- **Per-user trim** to the most recent 1000 rows; **anonymous** rows trimmed
  to a global 50000-row cap.
- RLS: signed-in users read their own rows; anonymous + signed-in inserts
  allowed but `user_id` must match `auth.uid()` (or be null) and
  `session_id` must be 8–64 chars.
- Skip this migration entirely if you only want analytics in GA4. The game
  client treats the table as optional — when missing, the Supabase write is
  a silent no-op and GA still works.

### 0002 — `run_stats` (M325, **new**)

- One row per game run (`run_id` is a client-generated UUID).
- Tracks hero name/class/appearance, difficulty, hardcore flag, outcome
  (`win` / `died` / `abandoned`), max level, zones cleared, totals JSONB,
  per-character JSONB.
- **After-insert trigger** trims to the latest 100 rows per user
  automatically — storage stays bounded; older runs roll off without
  client-side bookkeeping.
- RLS identical to `saves`: only the row owner can read/write.

---

## Verifying it worked

After applying 0002, run this in the SQL editor:

```sql
select to_regclass('public.run_stats') as table_exists,
       (select count(*) from pg_policies where tablename = 'run_stats') as policies,
       (select count(*) from pg_trigger
          where tgrelid = 'public.run_stats'::regclass and not tgisinternal) as triggers;
```

Expected: `table_exists = run_stats`, `policies >= 4`, `triggers >= 2`.

---

## Game-side wiring

`src/auth/runStatsClient.js` is the only consumer. It silently no-ops when
either:

- Supabase isn't configured (no `VITE_SUPABASE_URL`), or
- the user isn't signed in.

That means **applying the migration is the entire deploy step**. Local play
keeps working with localStorage-backed lifetime stats whether or not the
table exists; cloud sync just lights up automatically once it does.

---

## Rolling back

```sql
drop table if exists public.run_stats cascade;   -- wipes all row-stats
```

Cloud-side only. Local stats in `localStorage` are untouched.
