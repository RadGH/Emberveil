# Story Mode Build Checklist

Source of truth for "where am I" across disconnects. Flip `[ ]` → `[x]` as items ship.

## Phase 0 — Setup
- [x] HANDOFF.md written
- [x] CHECKLIST.md written
- [x] Harness tasks created (17 phases)

## Phase 1 — Roast (1-roast.md)
- [ ] code-reviewer agent dispatched
- [ ] 1-roast.md written
- [ ] Mobile/padding audit included
- [ ] Source-code mismatches called out

## Phase 2 — Brainstorm (2-brainstorm.md)
- [ ] Remediation ideas per roast finding
- [ ] Mobile map approach decided
- [ ] Companion system shape decided

## Phase 3 — Refined plan (3-refined-plan.md)
- [ ] Module list + paths
- [ ] Data shapes
- [ ] Milestone numbering chosen
- [ ] Acceptance criteria per milestone

## Phase 4 — Markdown viewer
- [ ] viewer.js written
- [ ] Server started (background)
- [ ] Link printed to user

## Phase 5 — Mode split + saves (M-S01..M-S04 shipped)
- [x] gameMode field added
- [x] Separate story save slots (emberveil_save_story_ prefix)
- [x] Ledger skeleton (flags/counters/factions/quests/nodes/paths/waypoints/history)
- [x] Classic save path untouched
- [x] StoryNewGameScreen (mode picker, 6 storytellers, 5 option groups)
- [x] StoryMapScreen placeholder
- [x] TitleScreen → StoryNewGameScreen routing
- [x] LoadGameScreen Classic/Story tab split
- [x] storyLedger.js (DEFAULT_STORY_LEDGER, createStoryLedger, migrateStorySave, setUniquePush, commitRng)
- [x] storyPredicate.js (evalPredicate, formatPredicate — 30 ops tested)
- [x] storyEffects.js (runEffects — 22+ effect types, all clamped)
- [x] storyMode.js (newGame, buildCtx, commitRng)
- [x] build-story-content-manifest.cjs (CI validator + manifest emitter)
- [x] canonical-flags.json (45 flags)
- [x] canonical-factions.json (6 factions)
- [x] canonical-skills.json (18 skills)
- [x] canonical-biomes.json (14 biomes)
- [x] canonical-stats.json (STR/DEX/INT/CON)
- [x] release.sh: story manifest step added before vite build
- [x] Tests: 92 new tests (predicate×36, effects×32, saveSchema×14, rngCheckpoint×10)

## Phase 6 — Map graph + validator
- [x] worldGenerator.js → src/story/storyMapGen.js (generateAct, M-S05)
- [x] worldGraph.js → src/story/storyMapGraph.js (buildIndexes, serializeMapSave, hydrateMapSave)
- [x] storyValidation.js → src/story/storyMapValidator.js (6 validators)
- [x] Seed → salt regen on validation fail (10 attempts → safety-net fallback)

## Phase 7 — Story Map screen
- [x] StoryMapScreen.js (portrait layout per §13.1, 393×852)
- [x] Pan + tap nav (pointer events, 8px threshold, rubber-band pagination)
- [x] Node icons (full type legend: combat/dialog/shrine/lore/merchant/rest/event/boss)
- [x] Waypoint states (ring color per state in storyMapRendererShared.js)
- [x] Sub-region tabs + page dots (collapsible pressure chip collapsed by default)
- [x] Peek drawer (96pt collapsed, 360pt expanded, swipe handle)
- [x] storyMapRendererShared.js (nodeXYFromLane, drawNode, drawEdge, hitTestNode)
- [x] storyMapMutations.js (full API: revealPath, blockPath, revealNodesByTag, mutateNode, unlockTransition, setWaypointState, applyWorldMutation)
- [x] Waypoint state machine enforced (legal transitions only, console.warn on illegal)
- [x] storyEffects.js wired to real mutation functions (block_path, mutate_node, world_mutation)
- [x] storyMode.buildCtx wired to real mutation helpers
- [x] Tests: 63 new (mapGen×34, mapMutations×29)

## Phase 8 — Storyteller Director (M-S14, M-S15 shipped)
- [x] storytellers.json (6 profiles — data/story/storytellers/*.json)
- [x] storyStorytellers.js (inline profiles + 6 mechanic hooks)
- [x] storyDirector.js (recordTick, applyPressure, pressureBand, getDirectorIntent, stepDirector, inspectCandidates, forceIntent)
- [x] difficulty-presets.json (relaxed/normal/hard/nightmare)
- [x] Recent-history tracker (ringbuffer with per-field caps)
- [x] Pacing rules + repetition penalties (hard-filter + soft-score decay)
- [x] Pressure meter (0..100, 4 bands, 6 delta triggers)
- [x] 6 unique mechanic hooks verified (chronicler coherence, ash_prophet omen, warbringer winStreak, trickster chaos, pilgrim 3x, iron_judge ambush)
- [x] director.test.js (fuzz×1000, crisis band, ringbuffer caps, streak math, fallback, debug API, determinism)
- [x] storytellerMechanics.test.js (1 assertion per mechanic per §7.5)

## Phase 9 — Quest + Dialog (M-S11, M-S12, M-S13 shipped)
- [x] storyQuestEngine.js — 10 functions: ensureQuestStarted, advanceQuestPhase, completeQuest, failQuest, getActiveQuests, getQuestPhase, checkQuestOutcomes, tickQuestConditions, runQuestEffects, getQuestLog
- [x] storyContent.js — runtime content registry (lazy load, registerQuestLine/Pool, buildContentRegistry)
- [x] data/story/quest-lines/_test_quest.json — test fixture
- [x] storyQuestEngine tests (13 tests)
- [x] storyDialogConductor.js — loadNode, filterChoices, resolveNext, applyChoice, adaptLegacyChoice, legacy back-compat
- [x] StoryDialogScreen.js — subclass of DialogScreen; effect-chip panel (200ms slide), companion badges, mobile portrait safe
- [x] dialogConductor tests (21 tests)
- [x] storyCompanions.js — 6 inline defs, recruit/dismiss/approval/swap/assembleCombatParty/maybeFireBanter
- [x] data/story/banter-pools/_stub.json
- [x] storyCompanions tests (28 tests)
- [x] storyEffects.js — companion/quest effects delegated to storyCompanions/storyQuestEngine
- [x] storyLedger.js — companions array updated to §9.1 canonical ids (bram_coldfire, tessaly_veil, yasha_stonewill, captain_maer)
- [x] storyMode.js — afterNodeResolved() wired (ticks quests, fires banter)
- [x] storyEncounterBuilder.js — stub so build resolves dynamic import
- [ ] quest-lines.json (act 1-3 primaries) — M-S19+
- [ ] Skill check resolver (multi-approach) — M-S15+

## Phase 10 — Encounter / enemy / boss (M-S16, M-S17, M-S18 shipped)
- [x] storyEncounterBuilder.js (full: resolveEnemyId, buildEncounterForNode, queueEncounter, encounterBudget)
- [x] data/story/encounter-templates/_starter.json (5 Act-1 templates)
- [x] storyEnemyInstance.js (buildEnemyInstance + applyAffix — extends championModifiers + affixes, not parallel)
- [x] storyBossVariants.js (resolveVariant, applyVariant, registerVariantDefs)
- [x] data/story/boss-variants/_test_boss.json
- [x] bossPhases.js: registerVariantPhases added (~40 lines, descending-order merge, Classic untouched)
- [x] storySkillCheck.js (4-stat-with-skill-labels: resolveSkillCheck, getClassAffinityBonus, setAffinityTable)
- [x] data/story/skill-affinities.json (10 classes × 18 skills)
- [x] storyDialogConductor.js: skillCheck resolution wired into applyChoice
- [x] Budget formula matches §8.5 (4 guardrails: brutal/pressure/momentum/difficulty)
- [x] encounterBuilder.test.js (resolveEnemyId smoke, budget guardrails, queueEncounter)
- [x] enemyInstance.test.js (8 cases: clone, affix×2, champion, statMults, addSkills, nameOverride, composition)
- [x] bossVariants.test.js (variant condition match/no-match, applyVariant, phase registration)
- [x] skillCheck.test.js (5 scenarios + per-class affinity × 10 classes)

## Phase 11 — Headless simulator
- [x] sim/story/ harness (M-S08: buildSyntheticGs, runCampaign, 5 policies, cli.js)
- [x] Map gen integration (generateAct wired; mapId stored in gs.story.maps)
- [x] Director integration (M-S14: recordTick, stepDirector, applyPressure wired; Warbringer winStreak tracked)
- [x] Dialog auto-resolve policy (deterministicPolicy.chooseDialog returns first alphabetically)
- [x] Combat sim wired (runSimulation imported directly — no shadow copy)
- [x] Byte-parity test vs in-browser (byteParity.test.js — 5 tests pass; see note below)
- [x] 100 act-1 sims greedy (byteParity.test.js)
- [x] 100 act-1 sims storyFirst (byteParity.test.js)
- [x] CLI worker pool (sim/story/cli.js, --workers N, worker_threads)

**Byte-parity note (M-S09):** Full deep-equal passes for winner, rounds, party hp/alive, enemy hp/alive.
One intentional gap: `log` entries (raw combat event log array) are NOT compared because
`recordCombatLogs=true` keeps the full log object while the summary path uses `_summarizeCombatResult`.
This is by design — the contract is that the same `runSimulation` call produces identical combat math,
which is proven by the winner/rounds/hp assertions. The raw log comparison is deferred to M-S16
when `recordCombatLogs=true` is the default for diagnostic runs.

## Phase 12 — OpenAI content batches
- [ ] Encounter batch script (200 cap)
- [ ] NPC art batch (20, openai_v2)
- [ ] Enemy/boss batch (20, openai_v2)
- [ ] Dialog batch generator
- [ ] All sprites enrolled in image-review-v2

## Phase 13 — Content authoring
- [ ] acts.json
- [ ] biomes.json + region templates
- [ ] node-templates.json
- [ ] map-templates.json
- [ ] factions.json
- [ ] story-arcs.json
- [ ] world-mutations.json
- [ ] waypoint-templates.json
- [ ] lore-fragments.json
- [ ] side-events.json

## Phase 14 — New Game UI
- [ ] Mode select on TitleScreen
- [ ] Storyteller picker
- [ ] Difficulty / thematic / side-event / combat-density / story-pressure controls
- [ ] Mobile-friendly layout

## Phase 15 — Tests + sim runs
- [ ] Graph-gen vitest
- [ ] Reachability vitest
- [ ] Ledger persist vitest
- [ ] Dialog effects vitest
- [ ] Encounter budget vitest
- [ ] Boss variant vitest
- [ ] 100 act-1 sim
- [ ] 100 campaign sim
- [ ] 1000 director decisions sim
- [ ] Variety thresholds asserted

## Phase 16 — Polish + balance + telemetry
- [ ] Storyteller tuning pass
- [ ] Budget tuning pass
- [ ] Reward pacing pass
- [ ] storyTelemetry.js
- [ ] Mobile UX final pass

## Phase 17 — Release + deploy
- [ ] release.sh per milestone group
- [ ] wishlist.html updated
- [ ] SITE_OVERVIEW.md updated
- [ ] Final deploy_pages.sh
- [ ] Post-review feedback doc seeded
