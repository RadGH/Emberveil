# Telemetry — Anonymous Gameplay Data

Status: **M211 scaffold shipped. Transport endpoint is null — events queue locally but do not send. To turn on, wire a Supabase edge function per the steps below.**

## What ships today (M211)

- `src/game/telemetry.js` — client-side queue, opt-in check, sanitization, localStorage persistence, `sendBeacon` flush on pagehide.
- Settings toggle: "Share Anonymous Data" (off by default).
- First-launch modal on TitleScreen asks once and records the answer.
- `/assets/privacy.html` — user-facing privacy policy.
- Random session UUID stored in `localStorage.rsg_sessionId`.
- `recordEvent(eventType, payload)` is a no-op when opted out.

## What is NOT wired yet (do this to activate)

1. **Create the Supabase table.** Recommended schema:
   ```sql
   create table telemetry_events (
     id bigserial primary key,
     session_id uuid not null,
     game text not null,
     version text not null,
     event_type text not null,
     payload jsonb not null,
     created_at timestamptz not null default now()
   );
   create index telemetry_events_session_idx on telemetry_events (session_id);
   create index telemetry_events_event_idx on telemetry_events (event_type, created_at desc);
   create index telemetry_events_version_idx on telemetry_events (version);
   -- RLS: deny all reads/updates from anon. Only service role (edge function) can insert.
   alter table telemetry_events enable row level security;
   ```

2. **Write a Supabase edge function** that accepts `POST { events: [...] }`, validates the envelope shape (`game`, `version`, `sessionId`, `eventType`, `payload`, `createdAt`), and bulk-inserts into `telemetry_events` using the service role key. Return 204.

   Rate-limit at the edge (e.g. 60 req/min per session_id) to prevent abuse.

3. **Call `setTelemetryEndpoint(url)` on boot.** In `src/main.js` after Supabase init:
   ```js
   import { setTelemetryEndpoint } from './game/telemetry.js';
   setTelemetryEndpoint('https://<project>.functions.supabase.co/telemetry-ingest');
   ```

4. **Wire the event emitters.** Call `recordEvent(...)` from:
   - `MapScreen` / run start → `run_started`
   - `CombatScreen` end-of-combat → `encounter_result`, `combat_damage`
   - `LevelUpScreen` apply → `level_up`
   - `CombatScreen._applyTapEffect` → accumulate, emit `tap_damage` per-combat summary
   - run-over flow (defeat or final boss win) → `run_ended`

   Keep payloads small and anonymous. See schemas in `src/game/telemetry.js` header.

## Event schemas (stable — bump version on change)

```
run_started      { act, partySize, classes: string[] }
encounter_result { act, encounterId, outcome: 'win'|'loss'|'flee', rounds, partySize }
level_up         { class, level, attrs: {STR,DEX,INT,CON} }
combat_damage    { class, weaponCat, avgDmg, maxDmg, rounds }
tap_damage       { weapon, avgDmg, hits }
run_ended        { actReached, encountersCleared, outcome: 'cleared'|'dead'|'abandoned' }
```

Every event auto-gets `{ game: 'emberveil', version, sessionId, createdAt }`.

## Sanitization

`_sanitize()` strips `name`, `characterName`, `heroName`, `email`, `ip`, `userAgent` keys from any payload before queueing. If you add a new PII-adjacent key, add it to the `BLOCK` set in `telemetry.js`.

## Analysis queries (once data flows)

```sql
-- Win rate per class per act
select payload->>'class' as class, payload->>'act' as act,
       count(*) filter (where payload->>'outcome' = 'win')::float / count(*) as win_rate
from telemetry_events
where event_type = 'encounter_result' and version = 'M212'
group by 1, 2 order by 2, 1;

-- Avg damage by weapon category
select payload->>'weaponCat' as cat,
       avg((payload->>'avgDmg')::numeric) as avg_dmg,
       max((payload->>'maxDmg')::numeric) as max_dmg
from telemetry_events
where event_type = 'combat_damage' and version = 'M212'
group by 1;
```

## Versioning rule

Every balance patch bumps the milestone number (`version.js`). Telemetry events carry the version they were emitted under. **Never aggregate across versions when doing balance analysis** — a patch can shift numbers dramatically.
