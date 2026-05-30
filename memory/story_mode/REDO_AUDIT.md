# Story Mode Redo Audit

Date: 2026-05-30
Workspace: `/home/radgh/codex/emberveil/source/repo`

## Correction

An initial recovery attempt brought the old M501-M521 Story Mode source into the
Emberveil repo. That was the wrong direction for this redo. The user clarified that
the project must start over from the M500-era baseline because the prior Story Mode
implementation had dozens of major issues.

## What Was Preserved

- The old recovered implementation is preserved only as branch
  `recovered-story-mode-reference`.
- Story planning and postmortem documents are kept under `memory/story_mode/` for
  design reference and accountability.
- Secrets and local reference folders are not part of the repo.

## Clean Baseline Status

- Local cleanup work started from `40730a2`, the nearest available no-Story staging
  baseline in this repo. For remote push efficiency, the final staging commit may be
  published as a child of the already-uploaded recovered reference commit, but its
  checked-out tree is the clean redo baseline described here.
- The exact requested git object `594940819` is unavailable in the local Emberveil
  repo and nearby checked-out workspaces.
- Buildable Story Mode implementation paths have been removed from the source tree:
  `src/story`, `data/story`, `sim/story`, Story UI screens, Story tool pages, and
  Story generation/balance scripts.
- R00 pushed `staging` at `7143236136732cde5f8aca09a44fb75b199d1c20`.

## R01 Foundation Status

- Added fresh Story foundation code under `src/story/`:
  - `storyLedger.js`: v1 story save subtree, deterministic RNG checkpoint helpers,
    object-shaped `recentHistory`, migration registry, storyteller IDs, and quest
    status constants.
  - `storyPredicate.js`: canonical predicate DSL operations from the plan.
  - `storyEffects.js`: real dispatch for the authored effect language. Effects
    mutate the story ledger, root game state, inventory, quest log, companion
    records, pending encounters, pending tolls, and pending map mutation queues.
  - `storyMode.js`: starts a new Story save using the clean ledger contract.
- Added `StoryNewGameScreen` as the title-menu mode split. Classic Mode still routes
  to the existing character builder; Story Mode lets the player choose storyteller
  and difficulty, then enters the foundation map surface.
- Added `StoryMapScreen` only as a visible R01 foundation handoff. It explicitly
  states the systems not done yet: generated map traversal, authored quests, dialog,
  encounters, companions, director balance, and act content.
- Updated `SaveManager` to mint Story saves under `emberveil_save_story_*` while
  preserving Classic save keys.
- Updated `GameState` so Classic saves omit `story` and Story saves migrate/preserve
  the Story subtree.
- Updated Load Game with Classic/Story tabs and Story save routing.
- Fixed `play.html` so `npm run dev` loads `/src/main.js` instead of a stale hashed
  build artifact.

## R02 Map Status

- Added deterministic Story map generation:
  - `storyMapGen.js`: seed/act/salt driven act maps with 5 Act-1 sub-regions,
    3-lane strip layout, open/hidden edges, waypoint guarantees, boss node, and
    salt-bump retry with safety fallback.
  - `storyMapGraph.js`: map save projection, open-edge traversal, region visibility,
    indexes, and reachability helpers.
  - `storyMapValidator.js`: connectivity, quest-critical reachability, boss
    reachability, sub-region stitch, waypoint coverage, and hidden-lock satisfiability.
  - `storyMapMutations.js`: `revealPath`, `blockPath`, `revealNodesByTag`,
    `mutateNode`, `unlockTransition`, `setWaypointState`, `applyWorldMutation`,
    and `visitNode`.
  - `storyMapRendererShared.js`: shared node/road view helpers.
- `storyMode.newGame()` now generates and persists the initial Act-1 map.
- `StoryMapScreen` now renders the generated map, curved roads, hidden/locked roads,
  biome bands, region paging, cross-region arrow affordances, fogged locked regions,
  pressure chip, node drawer, 44 px nodes, and visit-state travel.
- Story effects now call the live map mutation API where a map exists, falling back
  to pending mutation queues only when authored effects target unavailable map ids.

## R03a Quest/Dialog/Companion Core Status

- Replaced temporary companion IDs with the six named roster IDs from the spec:
  Lyra Ashwalker, Orren Gravetide, Tessaly Veil, Bram Coldfire, Yasha Stonewill,
  and Captain Maer.
- Added `storyQuestEngine.js` with quest start, phase advance, completion/failure,
  outcome checks, logs, and per-node ticking.
- Added `storyDialogConductor.js` with cross-pool `next:` resolution, choice
  filtering via predicates, companion choice labels, effect application, dialog
  history, and the legacy choice adapter.
- Added `StoryDialogScreen`, wired from Story map dialog nodes.
- Added `storyCompanions.js` with recruit, dismiss, active swap, approval clamp,
  personal quest start, and 5th combatant assembly.
- Added `storySeedContent.js` with a small real Act-1 primary quest and opening
  dialog that can recruit Lyra or Orren. This is not placeholder data: it exercises
  quest phase progression, companion recruitment, approval, lore unlock, and
  companion-gated choice filtering.
- Map generation now guarantees a reachable opening dialog node so the dialog path
  is smoke-testable from a fresh Story start.

## Verification

- R00 `npm test`: passed, 26 files / 308 tests.
- R01 `npm test`: passed, 30 files / 320 tests.
- R02 `npm test`: passed, 31 files / 325 tests.
- R03a `npm test`: passed, 32 files / 328 tests.
- R01 `npm run build`: passed.
- R02 `npm run build`: passed.
- R03a `npm run build`: passed.
- Build warnings still present: missing `source/game13_releases/game_meta.json` for
  release metadata scripts, non-module static site scripts, and large Vite chunks.
  These are baseline repo warnings, not Story Mode regressions.
- R00 direct Playwright browser smoke on `http://localhost:5213/play.html`: passed.
  iPhone 14 Pro viewport reached the title screen, dismissed telemetry opt-in,
  clicked New Game, and landed on the Classic character builder with no page errors.
- R01 direct Playwright browser smoke on `http://127.0.0.1:5213/play.html`: passed.
  iPhone 14 Pro viewport reached Title -> New Game -> Story Mode, selected
  Warbringer/Relaxed, entered the Story foundation map, and had no page errors or
  horizontal overflow.
- R02 direct Playwright browser smoke on `http://127.0.0.1:5213/play.html`: passed.
  iPhone 14 Pro viewport reached Title -> New Game -> Story Mode, selected a
  storyteller, tapped a node, used Travel, paged to the next sub-region, and had no
  page errors or horizontal overflow.
- R03a direct Playwright browser smoke on `http://127.0.0.1:5213/play.html`: passed.
  iPhone 14 Pro viewport reached Title -> New Game -> Story Mode, traveled to the
  guaranteed opening dialog, recruited Lyra, selected a companion-gated choice, and
  returned to the map with no page errors or horizontal overflow.
- R03a `npm run lint`: passed with 143 baseline warnings and 0 errors.
- Existing Playwright specs `e2e/gameplay.spec.js` and one `e2e/new-ui-smoke.spec.js`
  assertion are stale/unrelated: `gameplay.spec.js` still opens `/` instead of
  `/play.html`, and the New UI combat assertion fails on a pre-existing UI-overhaul
  expectation. These are not treated as Story redo baseline blockers.

## Not Done Yet

- Banter, encounter builder, storyteller Director, sim policy, full authored content,
  generated assets, balance matrix, audio, tools, and full acts are not done yet.
- Full companion content is not done yet: Tessaly/Bram/Yasha Act-2 intros,
  all personal quest lines, all 15 banter pair files, companion swap UI at
  activated waypoints, and banter delivery overlay are still pending.
- Full quest/dialog content is not done yet: only the opening Act-1 seed is present.
  The target counts from the plan are still pending.
- Node-specific outcomes are still placeholders: visiting a node updates map state
  but does not yet launch dialog, combat, rewards, quests, or skill checks. That work
  is scheduled for R03/R04.
- Region visuals are color biome bands, not final painted biome backgrounds yet.
- Full manual Classic combat smoke is still not done; the browser smoke verified
  title-to-character-builder only in R00. R01 smoke covered the new Story route.
