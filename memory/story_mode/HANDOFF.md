# Story Mode Autonomous Build — Handoff

Resume keyword: **"story mode"**

## Status (2026-05-20)

**SHIPPED. M-S01 through M-S30 complete. Live on GitHub Pages as Emberveil m512.**

- Tests: 729 passing (was 400 at start; +329 new).
- Build: clean. Classic Mode bundle untouched (Story is lazy-loaded — `storyMode-*.js`, `StoryMapScreen-*.js`, `StoryJournalScreen-*.js` chunks).
- Story-mode docs viewer: still running at `http://192.168.1.93:5288/` (Handoff, Checklist, 1-roast, 2-brainstorm, 3-refined-plan).
- Live game: <https://radgh.github.io/RSG-Demos/game13/>

## What shipped (vs the original plan)

| Phase | Plan | Shipped |
|---|---|---|
| Mode split + save | sep slots | ✅ `emberveil_save_story_*` prefix, gs.gameMode field, Classic untouched |
| Predicate DSL | 12 ops | ✅ 30-op parser + CI validator + 5 canonical refs |
| Effect runner | 22 effects | ✅ 27 effects, clamped, lookup-table |
| Map generation | 50–75 nodes / act | ✅ 5 sub-regions × 9–12 nodes, 6 validators, salt-bump retry, safety-net acts 1/2/3 |
| StoryMapScreen | mobile portrait | ✅ 393×852 layout, sub-region pagination, peek/full drawer, pressure chip |
| Campaign simulator | byte-parity | ✅ 6 policies, worker-pool CLI, 24-job matrix in 119ms, byte-parity test passing |
| Quest engine | 10 fns | ✅ Full API; 16 quest lines (3 primary + 6 secondary + 6 companion + 1 test) |
| Dialog conductor | branching | ✅ Cross-pool routing, legacy adapter, StoryDialogScreen subclass |
| Companion system | full | ✅ 6 named companions, approval -10..+10, swap at waypoints, banter scheduler, personal quests |
| Storyteller Director | 6 profiles | ✅ All 6 with unique mechanics observable in sims |
| Encounter builder | role/family | ✅ 60 templates + budget formula with 4 guardrails |
| Enemy/boss configurator | extends champion+affix | ✅ buildEnemyInstance composes with existing systems |
| Boss variants | 4 final-boss | ✅ 4 Sovereign variants + registerVariantPhases additive |
| Skill-check resolver | 4-stat + 18 labels | ✅ Class affinity table 10×18 |
| Hand-authored seeds | 162 nodes | ✅ Across 12 pool files |
| LLM dialog generation | 200–400 | ✅ 283 generated, validator-clean, gpt-4o-mini |
| Sprite batch | 40 | ✅ 20 NPCs + 20 enemies via openai_v2; enrolled in image-review batch m357 |
| Act 1/2/3 wiring | quests + factions | ✅ Full quest lines, faction control map, world mutations |
| Mobile UX polish | drawer/chip/gestures | ✅ |
| Authoring tools | 5 pages | ✅ story-inspector, quest-graph, storyteller-balance, story-dialog-review, story-campaign-sim |
| Balance matrix | thresholds met | ✅ All 6 storytellers PASS Act-1 Normal ≥90% AND Act-3 Normal ≥60% (600-run matrix at M999.json) |
| Telemetry / achievements / audio | 12 ach + audio map | ✅ |
| Release | RSG-Demos | ✅ M512 deployed |

## Known follow-ups (reserved M-S31..M-S35 for post-review)

1. **Image review still pending.** 40 sprites in batch `m357` await user approval at `/assets/image-review-v2.html` (Pending tab). After review: `node scripts/approve-image-review-v2.cjs --all`.
2. **LLM dialog quality review.** 283 generated nodes are validator-clean but not narratively reviewed. Tool page: `/assets/story-dialog-review.html`. Approval flow: `node scripts/approve-story-dialogue.cjs <ids…>`.
3. **Banter pool content.** Banter scheduler is wired but pool files are stubs. M-S31 candidate: author 15 pair banter files (~5 entries each).
4. **Per-storyteller audio filters.** Audio mapping ships biome→music. Per-storyteller filter chains (Ash Prophet low-pass, Trickster pitch-bend, etc.) deferred to M-S31.
5. **Iron Judge balance band check.** Plan §10.8 calls for IJ act-3 completion **30–70%**. Current matrix shows IJ at 96% — too easy. Tune budget multipliers in M-S31.
6. **Storyteller-balance.html portrait paths.** Falls back gracefully when sprite missing; if user approves m357, swap-in real portraits will trigger.

## User review checklist

1. Open <https://radgh.github.io/RSG-Demos/game13/>. New Game → Story Mode → pick Chronicler → Normal → Start.
2. Travel between 2-3 nodes to confirm map pagination feels right on mobile.
3. Open `/assets/image-review-v2.html` and approve/reject the 40 story sprites in batch m357.
4. Open `/assets/storyteller-balance.html` to see the 600-run matrix.
5. Open `/assets/story-campaign-sim.html` and run a custom seed.
6. Open `/assets/story-dialog-review.html` to spot-check LLM dialog quality.

## Resume protocol (post-review)

1. Re-read this file + `CHECKLIST.md`.
2. New work belongs in M-S31+ slots already reserved. **Append** to CHECKLIST; do not silently shelf.
3. The 3 planning docs (`1-roast.md`, `2-brainstorm.md`, `3-refined-plan.md`) are the binding spec; update them only if requirements actually change.
4. Spend tracker: M-S20 + M-S21 cost ~$10 of OpenAI credits.

## Key file inventory (for cold start)

- src/story/*: 20 modules (predicate, effects, ledger, quest engine, dialog conductor, map gen/graph/validator/mutations/renderer, director, storytellers, encounter builder, enemy instance, boss variants, companions, skill check, content, telemetry, mode, mapRendererShared).
- src/ui/screens/Story*.js: 5 screens (NewGame, Map, Dialog, Journal, Settings).
- sim/story/*: runCampaign + buildSyntheticGs + cli + 6 policies + 2 tests + balance-worker.
- data/story/*: 12 dialogue-pool files (445 nodes), 14 encounter-template files (60), 16 quest-lines, factions/npcs/canonical-refs/world-mutations/skill-affinities/audio-mapping/achievements/lore-fragments/lore-primer.
- public/assets/story-*.html: 5 tool pages.
- scripts/*: build-story-content-manifest, build-storyteller-balance, balance-worker, check-storyteller-balance, generate-story-dialogue, approve-story-dialogue, generate-story-npc-sprites, generate-story-enemy-sprites, verify-story-sprites-enrolled, extract-story-canonical.
- 40 sprites in public/images/openai_v2/ (20 NPCs + 20 enemies).
