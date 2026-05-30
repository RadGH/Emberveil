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
- Classic routes were cleaned so New Game opens the Classic character builder and
  Load Game ignores old `gameMode: "story"` saves instead of importing missing Story
  screens.

## Verification

- `npm test`: passed, 26 files / 308 tests.
- `npm run build`: passed.
- Build warnings still present: missing `source/game13_releases/game_meta.json` for
  release metadata scripts, non-module static site scripts, and large Vite chunks.
  These are baseline repo warnings, not Story Mode regressions.
- Direct Playwright browser smoke on `http://localhost:5213/play.html`: passed.
  iPhone 14 Pro viewport reached the title screen, dismissed telemetry opt-in,
  clicked New Game, and landed on the Classic character builder with no page errors.
- `npm run lint`: passed with 143 baseline warnings and 0 errors.
- Existing Playwright specs `e2e/gameplay.spec.js` and one `e2e/new-ui-smoke.spec.js`
  assertion are stale/unrelated: `gameplay.spec.js` still opens `/` instead of
  `/play.html`, and the New UI combat assertion fails on a pre-existing UI-overhaul
  expectation. These are not treated as Story redo baseline blockers.

## Not Done Yet

- R01 foundation work has not started yet.
- Full manual Classic combat smoke is still not done; the browser smoke verified
  title-to-character-builder only.
- Staging push still needs to run for the clean baseline commit.
