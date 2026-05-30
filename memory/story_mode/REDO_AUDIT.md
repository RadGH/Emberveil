# Story Mode Redo Audit

Date: 2026-05-29
Workspace: `/home/radgh/codex/emberveil/source/repo`

## Recovery Baseline

- Recovered the old `game13_old` source, Story Mode memory, handoff docs, scripts, data, tests, public assets, and built staging output into the Emberveil `staging` checkout.
- Deleted `/home/radgh/codex/emberveil/game13_old` after merge.
- Added repo ignores for secrets, local build caches, generated logs, review scratch files, and old signed SpriteCook URL dumps.
- Removed legacy memory files that contained real signed SpriteCook URLs.
- Updated OpenAI generation scripts to prefer the Codex/Claude secret path contract:
  - `/home/radgh/claude/secrets/openai-api-key.txt`
  - `/home/radgh/codex/secrets/openai-api-key.txt`
  - legacy path only as final fallback.

## Baseline Validation

- `node scripts/build-story-content-manifest.cjs`: pass, 78 files, 145 predicates, 0 errors.
- `node scripts/build-story-quest-graph.cjs`: pass, 35 quests written.
- `npm test`: pass, 761 tests. Vitest still reports the pre-existing jsdom import warning that the project config already suppresses.
- `npm run build`: pass. Prebuild warns that the old `game13_releases/game_meta.json` path is absent in the new repo layout.

## Immediate Findings

- `buildEncounterForNode` still had nullable fallback paths if no queued template or raw encounter could be resolved. This was the M521 failure class.
- The campaign sim had storyteller mechanics in `stepDirector`, but no policy that used director output for node routing. This preserved the prior "storyteller-blind sim" gap.
- `sim/story/runCampaign.js` and `src/story/storyMode.js` still contained stale "stub" comments after the actual systems had landed.
- Remaining warning/noise audit is not complete. There are still intentional test stubs and CLI logging paths that need classification before the final no-stub/no-placeholder pass.

## Fixes Landed

- `src/story/storyEncounterBuilder.js`
  - `buildEncounterForNode` now returns a concrete encounter object on every path.
  - Added deterministic raw-encounter normalization.
  - Added a guaranteed fallback encounter from the enemy registry if no raw encounter or template can resolve.
- `sim/story/policies/directorAware.js`
  - New policy that scores outgoing map nodes against the current Director intent.
  - Biases by node type, biome/theme tags, Iron Judge ambush state, and Trickster chaos.
- `sim/story/runCampaign.js`
  - Stores the real `stepDirector` result on each log entry.
  - Passes `{ gs, currentNode, directorIntent }` into policy `chooseNode`.
- `sim/story/cli.js`
  - Registers `directorAware` as a first-class sim policy.
- Tests
  - Encounter builder tests now assert non-null encounter results for null template, queued template, and no-enemy templates.
  - Campaign sim test asserts `directorAware` records real director intent and produces divergent routes between Chronicler and Iron Judge for the same seed.

## Remaining Visible Work

- Complete a full no-stub/no-placeholder audit over Story Mode source, data, scripts, tools, and tests.
- Replace or document every remaining `console.warn`/`console.log` in production Story Mode code.
- Run a storyteller matrix with `directorAware` and tune Iron Judge if still outside the required Act-3 Normal 30-70% band.
- Run mobile Story Mode smoke in browser after the first recovery push deploys.
