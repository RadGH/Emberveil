# Emberveil (game13)

A portrait-first, portrait-locked RPG with deep combat simulation, 19 classes, passive trees, a world map, random events, and an evolving companion/gear system.

- **Play the latest milestone:** https://radgh.github.io/RSG-Demos/game13/
- **Asset gallery:** https://radgh.github.io/RSG-Demos/game13/assets/
- **Design doc:** [`game.md`](./game.md)
- **Working instructions for Claude Code:** [`CLAUDE.md`](./CLAUDE.md)

## Database (Supabase) migrations

Cloud persistence (saves, run stats, telemetry, combat history) is backed by Supabase. Schema changes live as numbered, additive, idempotent SQL files under [`supabase/migrations/`](./supabase/migrations/):

- `0001_saves_table.sql` — main `saves` table for cloud save slots.
- `0002_run_stats.sql` — `run_stats` table + RLS policies for per-user run history.
- `0003_telemetry_events.sql` — `telemetry_events` table for opt-in gameplay telemetry.
- `0004_run_stats_combat_history.sql` — adds the `combat_history` JSONB column + trim trigger so the Statistics screen can show last-50 fights across devices.

**To apply a migration:** open the Supabase dashboard for the project → **SQL Editor → New query** → paste the file's contents → **Run**. There is no `supabase` CLI step for this project — the migrations are hand-applied via the dashboard.

Migrations are written to be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`), so re-running a file is safe. They are also additive — no migration drops or renames an existing column, so older clients keep working after a newer migration is applied.

**Graceful degradation:** code paths that depend on a not-yet-applied migration no-op rather than crash. For example, `runStatsClient.listCombatHistory()` returns an empty list if the `combat_history` column doesn't exist yet, and the Statistics screen falls back to local-only data. This means you can ship client code that references a new column before the SQL is applied, and the game still runs.

## Documentation

Human-readable architecture notes live under [`docs/`](./docs/). They are regenerated whenever the underlying systems change so future contributors (and future LLM sessions) don't have to re-audit the codebase from scratch.

- [**Mod System & Schema Guide**](./docs/mod-system/README.md) — combat cycle, data shapes, proposed mod-safe JSON schema, and 50 functionally-distinct spell ideas.

## Tech

JS + Vite. Portrait-only (393×852 target). See `CLAUDE.md` for dev commands and milestone workflow.
