# Emberveil Site Overview — what every part does and where to maintain it

This document is the cold-start manual for the entire `/home/radgh/claude/game13/` site. Whenever a new request lands, find the affected area below first; THIS document is the source of truth for "how the site works."

Update this doc whenever a piece of the site is added, refactored, or relocated. **If a system isn't documented here, it isn't trusted to be complete.**

---

## 1. The game itself (`src/`)

- **Engine entry**: `src/main.js` → mounts `ScreenManager`, loads CSS, registers screens.
- **Game state** (`src/game/gameState.js`): single store + load/save. `GameState.load` runs `recalcPassiveStats` on every member so persisted HP gets clamped to live `maxHp` (fixes companion 365/180 readouts).
- **Combat** (`src/ui/screens/CombatScreen.js` ≈ 8000 lines): canvas + DOM overlay. Layout in `src/ui/combatLayout.js` (extracted pure module, unit-tested). Status icons rendered as a DOM overlay anchored to canvas coords via `_refreshCanvasStatusOverlay`. No SVG grid — that path was killed in M434.
- **Map** (`src/ui/screens/MapScreen.js`): horizontal-scroll canvas + DOM popups. Map data in `src/maps/mapData.js`; FTL hex layout via `_layoutZoneToFTLGrid`. Cross-zone popups use `cssCanvasW` (the full content box), not `wrap.clientWidth` (the viewport), so they sit next to the anchor node regardless of scroll.
- **Skills / classes / items / build presets / passives / formulas**: each has its own JSON registry in `public/assets/data/` and an authored module in `src/game/`. The `emit-game-data.cjs` build step (`scripts/emit-game-data.cjs`) exports the registries to `public/assets/data/` so tool pages can read them client-side.
- **Class unlocks** (`src/game/classUnlocks.js`): persistent per-device unlock state in `localStorage.emberveil_unlocks`. Triggers wired in `recomputeClassUnlocks(gs)`. Counters: `gs.enemyKillCount`, `gs.lifetimeRareCount`, `gs.bossKillsLowHp`, `gs.completedBosses`.

## 2. Tool pages (`public/assets/*.html`)

Tool pages are **static HTML + JS** served alongside the game build. Each loads `_header.js` and `_footer.js` (shared nav) and reads JSON data files in `public/assets/data/`. Most are appearance-driven; **no hardcoded image lists**.

| Page | Purpose | Data source |
|---|---|---|
| `images.html` | Master image gallery | `appearances-manifest.json` + `images-manifest.json` |
| `image-review-v2.html` | **Review newly generated sprites** before they go live | `image-review-v2.json` (built by `build-image-review-v2.cjs`) + open batch JSON in `image_review_batches/` + `appearances-manifest.json` |
| `dialog-inspector.html` | Inspect/edit every dialog and encounter | `dialog-inspector.json` |
| `damage-report.html` | Per-class DPS snapshots | `data/damage-report/M*.json` |
| `balance-report.html` | Combat sim baseline comparison | snapshot folder |
| `wishlist.html` | The active work plan | `wishlist.html` (hand-edited; checkbox state normalized via `sync-wishlist-checkboxes.cjs`) |
| `brainstorm.html` | Mirror of the brainstorm section | structured-changelog JSON |
| `todo.html` | Cross-page "what to work on" view | wishlist + brainstorm |
| `class-catalog.html` etc. | Read-only catalog views | the matching JSON file |
| `docs.html` | Markdown docs renderer | `public/docs/*.md` |
| `changelog.html` | Per-milestone changelog | `changelog-structured.json` |
| `news.html` | **Paginated news archive** (12/page) | `public/news/news.json` |

Header + footer nav is rendered by `shared/nav-header.js` + `shared/footer.js`. Both files are copied into `<game13>/public/assets/_header.js` / `_footer.js` by `release.sh` on every build. The footer reads `window.RSG_SITE_MENUS` (set by the header) so changes to nav lists propagate automatically.

**Inline-CSS-forbidden policy**: every tool page must use class names. Inline `style="..."` is reserved for JS-calculated values only (e.g. `style.left = computedX + 'px'`).

## 3. Image pipelines

Three independent sprite-generation pipelines feed `public/images/`:

### A. SpriteCook MCP (default for established characters)
Walks the SpriteCook MCP plugin to render per-pose pixel art with consistent palette. Prompts live in `assets/references/emberveil/art_direction/<id>.json`. Output: `public/images/spritecook/<id>_<pose>.png`. Approve workflow: enqueue in the open review batch → approve via `scripts/approve-image-review-v2.cjs <ids…>`.

### B. OpenAI 9-pose (for experimental / non-humanoid characters) — M463 layout
Single API call generates a 3×3 sprite sheet, then post-process (chroma-key #00FF00 tolerance 64 + despill r10 + slice + center-pad to 256). **Full spec at `memory/openai-sprite-sheet-workflow.md`.**

Script: `scripts/openai-spritesheet-gen.py`. Reference template (current, M463): `public/assets/openai_v2/reference.png` (canonical) + `reference_YYYY-MM-DD.png` (dated archive).

**Output bucket (M463)**: `public/images/openai_v2/` — **NOT** `spritecook/`. The appearances-manifest builder (`build-appearances-manifest.cjs`) scans `openai_v2` first so frames here override same-name spritecook files. This unlocks per-frame mixing: a single character can have its portrait from openai_v2 and an attack frame from spritecook without code edits.

**Chroma fallback (M463)**: `chroma_despill()` does the green key, then a top-left-pixel fallback for cases where OpenAI ignores the prompt and ships a non-green backdrop (ash_wraith, bandit M458).

**Raw archive (M463)**: `public/assets/openai_v2/raw/<id>/<YYYY-MM-DD>_raw.png` keeps the unsliced 1024×1024 OpenAI output, lossless-PNG. Lets us re-process with new chroma/despill params without spending another API call.

**Per-character override rules** are baked into the script: humanoid vs beast vs elemental vs construct equipment hard-rules, plus per-archetype spell colours (cleric=yellow heal, warlock=purple shadow, rogue=green poison, frost=mouth-breath, etc.). Override individual descriptors via `--attack/--spell/--block` flags.

**Every regen MUST enrol in the open review batch** (M462). The script writes:
- `public/images/openai_v2/<id>_<pose>.png` (live, with backup of previous file in `openai_v2/_pre_openai/`)
- `public/assets/openai_v2/raw/<id>/<date>_raw.png` (raw OpenAI output)
- `public/assets/data/image-review-v2-openai-sidecar.json` (merged into `characters[]` on next `build-image-review-v2.cjs`)
- An entry per pose in the open batch JSON (`image_review_batches/<openId>.json`) → drives the Pending tab on `image-review-v2.html`

Approval flow: user reviews on `/assets/image-review-v2.html`, copies IDs, runs `node scripts/approve-image-review-v2.cjs <ids…>` (or `--all`). Approved entries move out of Pending; the open batch rolls forward to the next milestone once fully approved.

### C. PixelLab (legacy)
Older sprites in `public/images/sprites/` and `public/images/pixellab/`. Mostly orphaned now — kept on disk for history. Surfaced under the **Orphaned** category on `images.html`.

## 4. Build pipeline (`release.sh game13`)

`release.sh` runs:
1. Sync shared header/footer/site-theme/site-layout files into `public/assets/`.
2. Tests + linter.
3. Regenerate manifests:
   - `build-images-manifest.cjs` → `public/assets/images-manifest.json`
   - `build-appearances-manifest.cjs` → `public/assets/appearances-manifest.json` (glob-only, canonical-sourced — Phase 3)
   - `build-image-review-manifest.cjs` → `public/assets/image-review-manifest.json` (entity lists from `public/data/entities/*.json` — Phase 3; no JS-source scrape)
   - `build-image-review-v2.cjs` → `public/assets/data/image-review-v2.json` (merges the openai sidecar)
   - `build-tools-list.cjs`, `build-dialog-inspector.cjs`, `build-live-data.cjs`, etc.
4. `vite build`.
5. `rsync` `dist/` into `../game13_releases/dist/`.
6. Update `game_meta.json` (milestone + summary).

`deploy_pages.sh` runs after release to publish to the GitHub Pages mirror.

## 5. Data files (`public/assets/data/`)

- `appearances.json` — character appearance registry. **Canonical pass-through** (Phase 3): `emit-game-data.cjs` projects `public/data/entities/heroes.json ∪ npcs.json` into the legacy array shape (presentation order = `dataLoader._APPEARANCE_ORDER`). No more `src/game/appearances.js` scrape.
- `appearances-manifest.json` — built manifest mapping appearance → 7 canonical sprite paths. **Glob-only** (Phase 3): `build-appearances-manifest.cjs` reads the canonical entity JSON in `public/data/` directly for the id/kind/sprite set, then globs `public/images/{openai_v2,spritecook,sprites}/`. Its entity set equals the canonical set *by construction* — this is what permanently closes the giant_spider / game-vs-images drift (`verify-entity-coverage.mjs` set-matches manifest ⟷ the same canonical files).
- `classes.json`, `companions.json`, `enemies.json`, `bosses.json` — per-entity registries. `enemies.json`/`bosses.json`/`companions.json` are now **canonical pass-throughs** of `public/data/entities/*.json` (no JS-source regex). `classes.json` still extracted from `src/game/classes.js` (not yet migrated). `encounter-refs.json` (new) maps entity id → encounter display names from `public/data/combat/encounters.json` for `enemy-catalog.html`.
- `skills.json`, `items.json`, `passives.json`, `status-effects.json` — gameplay data
- `image-review-v2.json` — composed by `build-image-review-v2.cjs`; what `image-review-v2.html` reads
- `image-review-v2-openai-sidecar.json` — openai-9pose entries persisted across rebuilds
- `image_review_batches/index.json` — `{ open: {...}, history: [...] }`
- `image_review_batches/m###.json` — per-batch `{ id, milestone, openedAt, entries: [...] }`
- `damage-report/M###.json` — per-milestone DPS snapshots; index at `damage-report/index.json`
- `dialog-inspector.json` — built by `build-dialog-inspector.cjs`
- `live.json` — front-page counts (classes, zones, skills…), built by `build-live-data.cjs`

## 6. Memory (auto-loaded into Claude context)

Source of truth for behavior policies. Pointers indexed at `/home/radgh/.claude/projects/-home-radgh-claude/memory/MEMORY.md`. Project-specific docs at `game13/memory/*.md`.

The OpenAI sprite workflow doc and this site overview are both indexed.

## 7. Where to maintain each thing

| Concern | Edit here |
|---|---|
| Class unlock requirements | `src/game/classUnlocks.js: UNLOCK_REQUIREMENTS` + add trigger in `recomputeClassUnlocks` |
| Skills | `src/game/skills.js: SKILLS` |
| Items / weapons / armor | `src/game/items.js: WEAPON_BASES / ARMOR_BASES` |
| Build presets | `src/game/buildPresets.js: BUILDS` |
| Encounters / map | `src/maps/mapData.js: ENCOUNTERS / ENEMIES* / *_ZONES` |
| Combat layout | `src/ui/combatLayout.js` (pure module, unit-tested) |
| Combat draw / status overlay | `src/ui/screens/CombatScreen.js` |
| Map cross-zone popups | `src/ui/screens/MapScreen.js: _updateCrossZone*Popup` |
| Header / footer nav lists | `shared/nav-header.js: *_BY_GAME` |
| News articles | `public/news/news.json` + `public/news/<slug>.html` |
| OpenAI sprite prompts | `scripts/openai-spritesheet-gen.py: KIND_PROFILES, default_attack/spell/block` |
| Image-review batch flow | `scripts/build-image-review-v2.cjs` + `scripts/approve-image-review-v2.cjs` + per-batch JSON |

## 8a. Manifest-driven sprite loader (M463)

`src/game/spriteUtils.js` exposes `getSpritePath(spriteId, pose)` plus
`ensureSpriteManifest()`. On boot, the module fetches
`public/assets/appearances-manifest.json` once and caches an indexed
lookup. Every in-game sprite reference now goes through `getSpritePath()`,
which returns the per-frame URL stored in the manifest (e.g.
`images/openai_v2/bandit_portrait.png` or
`images/spritecook/warrior_east.png`). If the manifest entry is missing
the function falls back to the legacy `images/spritecook/${id}_${pose}.png`
convention so we never 404 mid-migration.

Migrated callers: `getPortraitPaths`, `EvTurnStrip` portrait fallbacks,
`EvCardRail` portrait fallbacks, `CombatScreen._loadSprite`,
`DialogScreen` (npc portrait + conv tiles), `CharacterBuilderScreen`
appearance tiles, `HireBuilderScreen` appearance tiles. NPC portraits in
`mapData.js` and `quests.js` stay as hardcoded paths because they target
specific files unaffected by the openai_v2 split.

## 8b. Image-review-v2 tooling (M463)

`/assets/image-review-v2.html` gained:

- **Background toggle** (`body[data-sprite-bg]`): segment in topbar with
  Checker / None / White / Black / Green. Persisted to localStorage.
  Same CSS class names + key are reused on `images.html` so the toggle
  works there too.
- **Per-character bulk-select checkbox**: top-left of every grouped card
  header. Selects/deselects every pose in that character's group.
- **Flag system**: per-image priority + optional text (error/warning/info).
  Persisted to localStorage as `evImgReview_flagsLocal`. Set/clear from
  the lightbox. Subtle dot in the corner of each tile, hover tooltip on
  desktop, full text in the lightbox.
- **Generator badges**: each tile shows `openai_v2` / `spritecook` /
  `sprites` based on its file path bucket (subtle bottom-right corner).
- **Pipeline overview cards** at the top of the page: collapsible
  SpriteCook + OpenAI v2 cards with description + the OpenAI v2
  reference image inline.

## 9. Combat Session Persistence (added M469)

Damage statistics from the last 50 combat sessions per player are stored in Supabase
and loaded on Statistics screen mount so they survive page refresh and new devices.

### Write path

`src/game/stats.js: recordFightEnd()` → appends to `gs.stats.combatHistory[]` (capped at 200 local).
`recordRunCompleted()` / `recordHardcoreDeath()` → calls `runStatsClient.finish(runId, { combatHistory: ...slice(-50) })`.
`runStatsClient.update()` is also called periodically (`flushRunStatsToCloud` every 30s).

### Column

`public.run_stats.combat_history JSONB` — added by migration `0004_run_stats_combat_history.sql`.
Each entry shape: `{ ts, startedAt, durationSec, won, zoneId, kind, perChar, totals }`.
If the column is missing (migration not yet run), `runStatsClient.listCombatHistory()` catches
Supabase error code `42703` and returns `[]` gracefully — game never crashes.

### Read path

`StatsDashboardScreen.onEnter()` → `_fetchCloudCombatHistory()` → `runStatsClient.listCombatHistory({ limit: 50 })`.
Returns flattened array across up to 50 run rows, newest-first. Cached on `this._cloudCombatHistory`.
`_mergedCombatHistory()` deduplicates local run data (current session) with cloud data (prior sessions) by `ts`.
Combat tab re-renders automatically when the fetch completes.

### Setup instructions

See `public/assets/todo.html#supabase-combat-history-setup` for the exact SQL DDL to paste into the
Supabase SQL editor. Also at `supabase/migrations/0004_run_stats_combat_history.sql`.

### Smoke test

`node game13/scripts/smoke-test-combat-sessions.mjs` — mocked, no live credentials needed. 3 assertions:
flatting, dedup, and graceful column-missing handling.

### Maintenance

If the `combat_history` shape changes (new fields added to `recordFightEnd`), the Supabase column is JSONB
so no schema change is required — new fields just appear in the object. Only destructive changes
(removing `ts`, `perChar`) would break the read path.

## 10. Story Mode (`src/story/`, `sim/story/`, `data/story/`, `public/assets/story-*.html`)

Story Mode is a separate game mode toggled by `gs.gameMode === 'story'`. All story code is lazy-loaded so Classic Mode pays zero bundle cost.

### Entry point
`src/story/storyMode.js` — `storyMode.newGame(opts)` creates the ledger, generates Act 1 map, saves the state, and pushes `StoryMapScreen`.

### Core modules (src/story/)
| Module | Role |
|---|---|
| `storyLedger.js` | Creates + commits the `gs.story` ledger object |
| `storyMapGen.js` | Procedural act-map generation (seeded, biome-aware) |
| `storyMapGraph.js` | BFS/indexes, `buildIndexes()`, `serializeMapSave()` |
| `storyMapMutations.js` | `revealPath`, `blockPath`, `applyWorldMutation`, etc. |
| `storyQuestEngine.js` | `tickQuestConditions`, `ensureQuestStarted`, phase/outcome logic |
| `storyDirector.js` | Pressure system, storyteller modulation, world events |
| `storyCompanions.js` | Companion roster, approval, banter scheduler |
| `storyContent.js` | Loads `data/story/` JSON files and caches them in `gs.__storyContent` |
| `storyPredicate.js` | Predicate DSL evaluator |
| `storyEffects.js` | Effect runner (flags, counters, factions, map mutations) |
| `storyDialogConductor.js` | Dialog node execution, skill-check resolution |
| `storyEncounterBuilder.js` | Encounter templates → combat encounter objects |
| `storySkillCheck.js` | Skill-check DC resolution |
| `storyStorytellers.js` | Storyteller registry (6 storytellers, rules, bias tables) |
| `storyBossVariants.js` | Boss variant overlays per storyteller/difficulty |
| `storyEnemyInstance.js` | Hydrates story enemies from `enemies-story.json` |
| `storyMapRendererShared.js` | Canvas DAG rendering logic shared between UI + tools |
| `storyMapValidator.js` | Invariant checks for generated maps |
| **`storyTelemetry.js`** (M-S29) | Structured story event tagging + achievement counter updates |

### Screens (src/ui/screens/)
| Screen | Role |
|---|---|
| `StoryNewGameScreen.js` | Storyteller carousel, difficulty, custom seed, party preview |
| `StoryMapScreen.js` | Main story map (canvas DAG + action bar); calls `_playBiomeMusic()` |
| `StoryJournalScreen.js` | 5-tab journal: Quests / Factions / Companions / Lore / Ledger |
| `StorySettingsScreen.js` | Banter, autosave, notification toggles; persists to `gs.story.settings` |

### Sim & CI (`sim/story/`)
| File | Role |
|---|---|
| `runCampaign.js` | Headless campaign simulator; options: `seed, storyteller, difficulty, policy, maxNodes, immortalParty` |
| `buildSyntheticGs.js` | Fake `gs` for CI runs (level-10 party, no real save needed) |
| `policies/storyFirst.js` | Default traversal policy (prefer dialog > shrine > lore; avoids dead-ends) |

### CI gate
`npm run check:story-balance` → `scripts/check-storyteller-balance.mjs`
- Runs 1 seed (advisory) by default; `--seeds 25` for binding thresholds.
- Binding: act-1 Normal ≥90%, act-3 Normal ≥60%.
- `immortalParty: true` so the check measures routing, not combat tuning.

### Data (`data/story/`)
| File/Dir | Role |
|---|---|
| `storytellers/*.json` | Storyteller rule defs (6 files) |
| `quest-lines/*.json` | Primary + companion quest definitions |
| `side-quest-templates.json` | 20 side-quest templates |
| `difficulty-presets.json` | Difficulty scalar tables |
| `enemies-story.json` | Story-specific enemy definitions |
| `dialogue-pools/*.json` | 445 dialog nodes (162 hand-authored + 283 generated) |
| `encounter-templates/*.json` | 60 encounter templates across 14 biomes |
| `canonical-*.json` | Flag / faction / biome / skill / stat canonical registries |
| **`achievements-story.json`** (M-S29) | 12 story achievement definitions |
| **`audio-mapping.json`** (M-S29) | Biome/act → music track mapping |

### Tool pages (public/assets/)
| Page | Purpose |
|---|---|
| `story-inspector.html` | Load story save, inspect ledger, step Director, edit flags |
| `quest-graph.html` | SVG DAG of all quest phase graphs; reads `data/story/quest-graph.json` |
| `storyteller-balance.html` | 6×4 act-completion grid; can run inline sim |
| `story-dialog-review.html` | Browse + edit dialog pools |
| `story-campaign-sim.html` | Single headless campaign runner with live log |

### Build scripts (scripts/)
| Script | Command | Output |
|---|---|---|
| `build-story-quest-graph.cjs` | `npm run build:story-quest-graph` | `public/assets/data/story/quest-graph.json` |
| `build-storyteller-balance.cjs` | (manual) | `public/assets/data/story/balance/M<N>.json` + `latest.json` |
| `check-storyteller-balance.mjs` | `npm run check:story-balance` | CI gate (exit 0/1) |

### Achievement integration (M-S29)
Story achievements live in `src/game/achievements.js` alongside Classic achievements. The `check(life, run, gs)` signature was extended with a third `gs` parameter — story checks read `gs.story.*` directly. `storyMode.afterNodeResolved` and `storyMode.transitionToAct` both call `checkAchievements()` lazily to avoid bundling Classic Mode.

## 11. The recurring "Pending review" failure mode

In M458, I generated 4 enemy sprites via the OpenAI workflow but did NOT enroll them in the open review batch — only wrote to the sidecar. The user could not find them on `image-review-v2.html` under Pending. **Why**: the script populated the Current/All bucket but not the batch driving Pending. M462 fixed this:
- `scripts/openai-spritesheet-gen.py` now auto-enrolls in the open batch.
- `scripts/flag-openai-regens-for-review.py` is the one-shot that retroactively flagged the 5 already-regenerated characters (frost_wyrmling + the 4 from M458) so they appear in Pending today.

**Going forward: any new image generation pipeline MUST end with `register_open_batch_entries()` or equivalent.** Without that step, the user never gets a review prompt.
