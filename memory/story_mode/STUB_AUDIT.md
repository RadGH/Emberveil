# Story Mode Stub Audit — M514

Generated: 2026-05-21. This file captures every stub/TODO/no-op found in the
story mode codebase. Each entry shows current behavior, desired behavior, fix
status, and estimated effort for deferred items.

---

## Fixed This Cycle (M514)

| File:line | Current (pre-fix) | Fixed to | Status |
|---|---|---|---|
| `sim/story/runCampaign.js:479` | Brutal-fight pressure trigger counted dead members (hp=0) toward threshold, ratcheting pressure to 100 every campaign | Only count alive members | FIXED |
| `src/ui/screens/StoryJournalScreen.js:350` | Quest status check used `'complete'` but engine sets `'completed'`; all completed quests appeared as active | Accept both spellings | FIXED |
| `src/ui/screens/StoryJournalScreen.js:373` | `_questRow` used `q.currentPhase` but ledger field is `q.phase` | Read `q.phase \|\| q.currentPhase` | FIXED |
| `src/ui/screens/StoryJournalScreen.js:479` | Ledger dump read `story.pressure` (undefined); field is `story.pressureMeter` | Renamed to `pressureMeter` | FIXED |
| `src/ui/screens/StoryJournalScreen.js:491` | Ledger dump did `.slice(-5)` on `story.recentHistory` (an object, not array); always produced undefined | Serialize as object summary | FIXED |
| `src/ui/screens/StoryJournalScreen.js:429` | Companion tab checked `c.benched` (undefined); field is `c.active` | Use `c.active` and filter by `c.recruited` | FIXED |
| `src/story/storyMode.js:126` | `queueEncounter: null` — wiring commented as "M-S10+" even though storyEncounterBuilder exists | Lazy-import and delegate to `storyEncounterBuilder.queueEncounter` | FIXED |
| `src/ui/screens/StoryMapScreen.js:987` | `gs.story.pressure` mutation (wrong field); had no effect on pressureMeter | Fixed to `gs.story.pressureMeter` | FIXED |
| `data/story/banter-pools/_stub.json` | Empty array `[]` — banter never fires | Created 5 banter JSON files for key companion pairs | FIXED |

---

## Fixed This Cycle (M515)

| Item | File | Fix |
|---|---|---|
| #2 Iron Judge ambush pool | `src/story/storyStorytellers.js` | Expanded from 1 to 7 entries covering acts 1/2/3 across 11 biomes; `shouldIronJudgeAmbush` now picks biome+act-matched entry |
| #3 Ash Prophet omen pool | `src/story/storyStorytellers.js` | Expanded from 1 to 7 entries; mix of pressure, corruption, faction_delta, and lore_unlock effects; 6 new canonical flags added |
| #4 `reward_item` fulfillment | `src/story/storyEffects.js` | Added `registerItemsModule` / `_getItemsModule` lazy accessor; handler now pushes to `gs.inventory` when module + item resolve; falls back gracefully to `_pendingRewards` |
| #5 Dialog lock validator | `src/story/storyMapValidator.js` | `validateHiddenPathSatisfiability` now accepts `dialogPools[]` + `questLines[]`; `collectSatisfiedLocks` exported; walks choice.effects + phase.effects + outcome.effects for `reveal_path` lockIds |
| #6 Banter pool coverage | `data/story/banter-pools/` | 10 new JSON files added; 15/15 companion pairs now covered (50 new banter lines) |
| #7 Stale comment | `src/story/storyCompanions.js:264` | Comment updated to reflect 15 complete banter pools |

---

## Deferred Items (documented with reasons, not silently shelved)

### 1. Storyteller differentiation is absent in headless sim

**Location:** `sim/story/runCampaign.js` — the `policy.chooseNode()` call ignores
the director's storyteller-weighted intent. All storytellers produce byte-identical
runs for the same seed.

**Why deferred:** This is a simulation fidelity gap, not a game engine bug. In the
live game, `StoryMapScreen._resolveNodeTravel` uses `storyEncounterBuilder` which
reads the storyteller profile and director intent. The sim uses a stub encounter
picker (`pickEncounterForNode`) and policy-driven routing. Fixing this requires
either: (a) wiring `buildEncounterForNode` into the sim, or (b) implementing a
director-aware policy. This is a medium-size design task; wrong to rush without
careful byte-parity testing.

**Impact:** Low — the director IS influencing encounter difficulty, ash_prophet
omen fires, trickster chaos fires; it just doesn't affect which MAP NODE is chosen.

**Suggested milestone:** M515 — implement `directorAwarePolicy` that queries
`stepDirector` intent and biases node selection toward the storyteller's preferred
node types.

---

Items #2–#7 were all closed in M515. See the "Fixed This Cycle (M515)" table above.

---

## Non-stub findings worth tracking

### A. Storyteller personality has no effect on which MAP NODES are visited (sim only)

Described in item #1 above. Live game is fine.

### B. `storyEnemyInstance.js:96` returns minimal stub for unknown enemy IDs

This is intentional defensive code — prevents crashes on modded content. Not a bug.

### C. All 36 sim runs (6 seeds × 6 storytellers) end in `dead` outcome

Expected: the synthetic party visits boss nodes (maps have them) and loses. The
`immortalParty: true` flag exists for balance routing tests. The normal outcome for
a level-10 synthetic party vs an act-1 boss is death. This is not a bug.
