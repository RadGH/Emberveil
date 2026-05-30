# Emberveil Milestone Checklist

## M508 — Story Mode M-S22 + M-S23 + M-S24 (2026-05-20)

### M-S22: Act 1 Wiring
- [x] `data/story/quest-lines/primary_act1_emberwood.json` — 7-phase primary quest (reach_brightfall → open_route_act2), 3 outcomes (guardian_defeated / guardian_redeemed / guardian_spared)
- [x] `data/story/quest-lines/secondary_act1_lost_caravan.json` — 3-phase (survivor → track → confront), 3 outcomes
- [x] `data/story/quest-lines/secondary_act1_purify_shrine.json` — 3-phase (find → offerings → ritual), 3 outcomes (purified / corrupted / preserved)
- [x] `data/story/quest-lines/companion_lyra_personal.json` — 4-phase (approval≥3 hook), tracking/cache/confrontation/resolution
- [x] `data/story/quest-lines/companion_orren_personal.json` — 4-phase (approval≥3 hook), patrol/markers/truth/resolution
- [x] `data/story/quest-lines/companion_maer_personal.json` — 4-phase (approval≥3 hook), letter/village/warning/resolution
- [x] `data/story/faction-control-map.json` — region→faction owner for all 3 acts
- [x] `data/story/world-mutations.json` — 5 entries (veil_spread_ash, quarantine_plague_fen, ember_hollow_destabilized, oathless_mobilize, sovereign_reaches_forward)
- [x] `src/story/storyMapGen.js` — `assignQuestNodes(graph, act, rng)` helper + wired into generateAct after validators pass
- [x] `src/story/storyMode.js` — `newGame()` sets act1_started, generates Act 1 map, calls `ensureQuestStarted('primary_act1_emberwood')`; new `transitionToAct(gs, nextAct)` method for act boundaries

### M-S23: Act 2 Wiring
- [x] `data/story/quest-lines/primary_act2_veilscar.json` — 7-phase primary (enter → network → faction → disrupt → sovereign → confront → route), 3 outcomes
- [x] `data/story/quest-lines/secondary_act2_library_archive.json` — 3-phase (access → decode → fate), 3 outcomes (openly / selectively / suppressed)
- [x] `data/story/quest-lines/secondary_act2_plague_cure.json` — 3-phase (find mira → ingredients → distribute), 3 outcomes
- [x] `data/story/quest-lines/companion_tessaly_personal.json` — 5-phase (approval≥3, employer exposure, remediation, forward)
- [x] `data/story/quest-lines/companion_bram_personal.json` — 5-phase (approval≥3, evidence chain, counter-assessment filing)
- [x] `data/story/quest-lines/companion_yasha_personal.json` — 5-phase (approval≥3, pact-stone recovery, reconsecration)
- [x] World corruption mechanic wired: act-boundary transitions bump `worldCorruption` (+10 act1→2, +15 act2→3); `corruption` effect handler fires from quest effects
- [x] `sim/story/runCampaign.js` — quest content registry loaded from disk; `tickQuestConditions` called post-combat; act-boundary flags set before quest ticking; world corruption tracked

### M-S24: Act 3 Wiring + Final Boss Variants
- [x] `data/story/quest-lines/primary_act3_riftgate.json` — 6-phase primary (breach → architects verge → ember hollow → chamber → confrontation → seal/leave), 4 outcome branches (slain+sealed / slain+collapsed / parleyed+sealed / ascended+open)
- [x] `data/story/boss-variants/emberveil_sovereign_story.json` — 4 variants: pact_bound (shrine_purified + pact_stone_recovered → stat 0.80x, parley unlocked), unchecked (shrine_smashed or ashen_veil majority → 1.35x), redeemed_arc (guardian_ally + pact_stone + herald_turned → 0.70x, ascension unlocked), standard (fallback, 1.0x)
- [x] `data/story/quest-lines/secondary_act3_architect_glyph.json` — 3-phase (43 glyphs, translation, use in confrontation)
- [x] `data/story/quest-lines/secondary_act3_oathless_stand.json` — 3-phase (find position, coordinate defense, resolution)

### Canonical Flags Added
- [x] 62 new flags added to `canonical-flags.json`: veil_fracture_located, watchtower_entered, act1_route_open, act1_completed_* (3 variants), path_* (3 variants), caravan_*, bandit_*, shrine_preserved_neutral, lyra_cache_found, lyra_target_*, orren_brother_markers_found, orren_truth_known_*, orren_quest_completed, maer_quest_*, village_fenwold_assessed, fenwold_* (3 variants), act2_completed, act2_primary_complete, veilscar_faction_path_chosen, library_archive_decoded, archive_* (3 variants), plague_cure_found, cure_* (3 variants), act2_route_open, herald_*, tessaly_quest_*, bram_quest_*, yasha_quest_*, pact_stone_recovered, act3_completed, riftgate_sealing_begun, sovereign_chamber_reached, sovereign_* (3 variants), rift_* (3 variants), final_faction_majority_* (3 variants), herald_network_mapped, act2_*_approach (4 variants), herald_ops_disrupted, cure_ingredients_acquired

### Build/Test Validation
- [x] `node scripts/build-story-content-manifest.cjs` — PASS (61 files, 145 predicates, 0 errors)
- [x] `npm test` — 677 tests passing, 0 regressions (1 pre-existing jsdom error, unrelated)
- [x] `npm run build` — clean build (5.32s)

### Campaign Sim Results (100 seeds, storyFirst, normal)
- Act 1/2/3 boss completion: 0% — BLOCKED by pre-existing combat balance regression (confirmed present in M507 baseline: 5/5 runs dead before any M-S22 changes). Combat win rate at level 1 is 0% in the headless sim.
- Quest engine verified separately: direct unit test shows all 3 act primary quests complete at 100% when appropriate flags are set (double-tick needed for final phase — correct behavior per quest engine design).
- Mean nodes visited: 3.0 (die on first combat node). Pre-existing.
- Resolution: combat balance regression belongs to the sim/game balance layer, not the quest content authoring or act-transition wiring delivered in M-S22/23/24. Escalate as separate issue.

---

## M507 — Story Mode M-S20 + M-S21 (2026-05-20)

### M-S20: LLM Dialog Generation
- [x] `scripts/generate-story-dialogue.cjs` — sync generator with gpt-4o-mini
- [x] `scripts/approve-story-dialogue.cjs` — merge _generated/ into live pools
- [x] `data/story/_generated/arrival.json` — 36 nodes
- [x] `data/story/_generated/ambush.json` — 32 nodes
- [x] `data/story/_generated/shrine.json` — 33 nodes
- [x] `data/story/_generated/merchant.json` — 52 nodes
- [x] `data/story/_generated/lore.json` — 46 nodes
- [x] `data/story/_generated/faction.json` — 48 nodes
- [x] `data/story/_generated/side-quest.json` — 36 nodes
- [x] Total generated: **283 nodes** (target was 200-400)
- [x] All nodes merged into live `dialogue-pools/` (hand-authored seeds first)
- [x] `node scripts/build-story-content-manifest.cjs` — PASS (43 files, 0 errors)
- [x] `public/assets/story-dialog-review.html` — review tool page

### M-S21: Sprite Batch (40 sprites)
- [x] `scripts/generate-story-npc-sprites.cjs` — 20 NPC wrapper
- [x] `scripts/generate-story-enemy-sprites.cjs` — 20 enemy/boss wrapper
- [x] `data/story/enemies-story.json` — 20 enemy/boss registry
- [x] `scripts/verify-story-sprites-enrolled.mjs` — enrollment verifier
- [x] 20 NPC sprites generated: captain_maer, lyra_ashwalker, orren_gravetide, tessaly_veil, bram_coldfire, yasha_stonewill, ash_prophet_npc, veil_shrinekeeper, elderwood_hermit, ashen_veil_herald, brightfall_innkeeper, road_scout_npc, bone_reader, faction_envoy_thornpact, veil_convert, swamp_guide, merchant_unusual, rift_warden, ancient_guardian_npc, marek_greel_story
- [x] 20 enemy/boss sprites generated: ash_cultist, ash_ritualist, veil_sprite, corpse_lantern, bog_witch, stonehide_boar, storm_harpy, ember_drake_small, veil_shade, ash_golem, cultist_captain, drowned_soldier, bone_revenant, veil_hulk, corrupted_guardian, plague_herald, veil_champion, den_mother_ash, architect_fragment, emberveil_sovereign_story
- [x] All 40 sprites at `public/images/openai_v2/<id>_<pose>.png` (9 poses each)
- [x] All 40 enrolled in open image-review batch `m357`
- [x] `node scripts/verify-story-sprites-enrolled.mjs` — PASS (40/40)

### Build/Test Validation
- [x] `npm test` — 677 tests passing, 0 regressions (1 pre-existing jsdom error, unrelated)
- [x] `npm run build` — clean build
- [x] Released as M507
- [x] Deployed to GitHub Pages

### Notes
- OpenAI cost estimate: ~$3-4 dialog + ~$6-8 sprites = ~$10 total (within approved budget)
- 283 nodes generated; the auto-fix pass recovered ~20% that had minor schema issues (missing effects:[])
- Companion pools excluded from LLM generation intentionally (tight voice requirements)
- User must review 40 sprites on /assets/image-review-v2.html and run approve-image-review-v2.cjs
