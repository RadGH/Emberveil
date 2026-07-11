# Statistics & DPS Meter — M285-M289 Brainstorm

User ask: "Continue improving statistic menu in game and main menu. Both should
have consistent layout and features but main menu can also display cross game
stats. Add filters that update various stats and graphs and chart.js elements
live. Add several views with different useful information. Continue expanding
the statistics system to incorporate more gameplay data — items, magic find,
character power, etc."

## Idea bank

### View ideas (charts to build)
1. **Damage timeline** — line chart, dmg per minute over the current run, multiple series for each party member.
2. **Damage breakdown by skill** — horizontal bar chart per character, top 10 skills by total damage.
3. **Damage type distribution** — donut: physical / fire / cold / arcane / holy / shadow / poison / bleed.
4. **Damage taken by source** — donut: enemies vs status (burn/bleed/poison) vs traps.
5. **DPS meter overlay** (live in combat) — small floating widget bottom-right showing rolling 10s DPS per active hero.
6. **Loot rarity distribution** — donut: normal / magic / rare / legendary drops collected this run.
7. **Item drops by zone** — bar: items per zone-act crossover.
8. **Magic find effectiveness** — line: rolling MF % vs rare+ drops over time.
9. **Gold flow** — area chart: cumulative earned vs spent over run time.
10. **Character power growth** — line per hero, power score over time.
11. **Skill usage frequency** — bar per character: how often each skill was cast.
12. **Critical hit rate** — gauge per character.
13. **Win/loss & flee rate** — donut.
14. **Encounter difficulty curve** — scatter: party avg level vs enemy total HP per fight.
15. **Time-per-zone** — bar: minutes spent in each zone.
16. **Death log timeline** — markers on the run timeline showing each death.
17. **Achievement progress** — radial: achievements unlocked / total.
18. **Cross-run progression** (main-menu-only) — line: best damage per run, win rate per run.
19. **Lifetime hardcore deaths timeline** — bar by date.
20. **Class playtime** (cross-run) — donut: hours played per class.
21. **Companion stats** — bar: which companions joined, kills/heals each.
22. **Tap weapon usage** — bar: tap weapon use count by type.
23. **Boss times** — bar: time-to-kill per boss across runs.
24. **Run summary card** — compact "Run Report" view: 6 mini-charts in a single screen for share / screenshot.

### Filters (apply across charts)
- Time range: Current Fight / Last 5 Min / Current Zone / Current Run / Lifetime
- Member: All Party / Per-Hero (selectable)
- Fight type: All / Regular / Boss / Mini-boss / Dungeon
- Difficulty: All / Easy / Normal / Hard

### Data we need to start tracking (currently not in stats.js)
- **Damage by skill id** (per character) — for breakdown chart
- **Damage by element/type** — needs element tag in skill defs (most have type:'fire'/'frost'/etc)
- **Damage taken by source** (enemyId or statusType)
- **Items collected** (per drop: { rarity, category, zoneId, ts })
- **Magic find at time of drop**
- **Gold transactions** (already have totals; need per-event log)
- **Time per zone** (timestamp on zone change)
- **Boss kill times** (delta from fight start to boss death)
- **Power score snapshots** (sample every level-up + every fight end)
- **Skill cast counts** (already partially via crits — extend)
- **Tap weapon usage**

## Milestone breakdown

### M285 — Foundation: chart.js + filter bar + unified screen
- Install chart.js (named library, ~58KB gz; user explicitly approved)
- Replace the M279 hand-rolled SVG charts with chart.js variants (richer
  tooltips, animation, legend, hover) where it improves UX; keep SVG for
  cheap pure-data widgets.
- Single source of truth: `StatsScreen` component with mode prop
  (`'in_game' | 'main_menu'`). GameMenu pushes `'in_game'`, TitleScreen
  pushes `'main_menu'`. The two share tabs/charts/filters; main_menu mode
  appends a "Cross-Run" tab and disables tabs that need a live run.
- Filter bar at top: time range + member + fight type. Filters apply
  globally to every chart on the screen and re-render via chart.update().
- Tabs: Overview · Per-Character · Damage Breakdown · Combat Log · Lifetime
  (· Cross-Run for main-menu mode)

### M286 — Cross-game / cross-run analytics
- Run history persistence already in stats.js (`runHistory`). Use it.
- New "Cross-Run" tab on main-menu mode:
  - Best Run (most damage, longest streak, fastest boss)
  - Run-vs-run line: damage per run, win rate per run
  - Hardcore deaths timeline
  - Class playtime donut (derive from per-run perChar data)
- Auto-archive on run completion / RIP (already partially wired; verify).

### M287 — Item & magic find tracking
- New stats event `recordDrop({ item, zoneId, magicFind, ts })`.
- Stats.run.drops = []  (capped to ~500 entries).
- Hook into combat-loot drop pipeline + treasure node + dungeon chest.
- New views:
  - Loot rarity donut
  - Drops by zone bar
  - MF rolling line
  - Top 10 items found list

### M288 — Character power tracking
- New `computePowerScore(char)` in `src/game/powerScore.js`.
  - sum(attrs) + gear-score (computeItemScores total of equipped) + skills*10 + level*20.
- New `recordPowerSnapshot(char)` triggered on level-up + fight end.
- Stats.run.powerSeries = { charId -> [{ t, power }] }.
- New views:
  - Power growth line per hero
  - Final-power bar
  - Role-mix donut (tank=def-heavy, dps=offense-heavy, support=heal+util-heavy)

### M289 — Live DPS meter + per-skill breakdown
- Track `damageBySkill` and `damageByElement` and `damageByEnemy` and `damageTakenBySource` (small Maps in stats).
- DPS meter overlay during combat:
  - Floating bottom-right widget, 4 rows (one per active hero), each row showing
    `Name · 1.2K dmg · 18.5 DPS · last hit graph`.
  - Toggleable from settings AND combat HUD.
- Per-skill breakdown view (uses M287 data + damageBySkill).
- Damage taken by source donut.

## Out of scope / wishlist
- Server-side leaderboards (would need backend; flagged in wishlist).
- Replay system (recording/playback of fights — significant effort).
- Heatmap of node visits (would need x/y per visit; minor data shape change).
