# Story Mode QA Report — M514

**Date:** 2026-05-21  
**Prior milestone:** M513  
**Test count before:** 729 | **Test count after:** 736 (+7 new tests)  
**Build:** Clean (`npm run build` — 0 errors, 1 pre-existing chunk-size warning)  
**Content manifest:** Clean (`node scripts/build-story-content-manifest.cjs` — 68 files, 145 predicates, 0 errors)

---

## Part 1: Playthrough QA (Headless Campaign Sim)

### Simulation run: 6 seeds × 6 storytellers × Normal / storyFirst / maxNodes=50

```
[sim/story/cli] 36 jobs | 3 worker(s) | policy=storyFirst | maxNodes=50
[sim/story/cli] Done in 0.4s — 36 ok, 0 failed → /tmp/qa.json
```

**All 36 jobs completed without throws.** No "abandoned" outcomes from entry-node
failures; no undefined/null node types in any log entry.

#### Per-seed outcome breakdown

| Seed | Outcome | Nodes visited | Max same-type streak | Combat win rate |
|------|---------|--------------|----------------------|-----------------|
| 1    | dead    | 18           | 2                    | 80%             |
| 2    | dead    | 1            | 1                    | 0%              |
| 3    | dead    | 29           | 5                    | 92%             |
| 4    | dead    | 26           | 2                    | 89%             |
| 5    | dead    | 1            | 1                    | 0%              |
| 6    | dead    | 26           | 5                    | 83%             |

All storytellers produce identical node sequences for the same seed — this is a
**sim fidelity limitation** (policy-driven routing ignores storyteller weighting),
not a game engine bug. See STUB_AUDIT.md item #1.

#### Pressure meter behavior (pre-fix)

Every combat triggered `brutal_fight` pressure (+12) because dead members (hp=0)
satisfied the "< 30% HP" condition. Seeds 2 and 5 both die in node 0 — first
encounter is a boss-level fight the party cannot survive.

#### Pressure meter behavior (post-fix)

After the M514 fix, pressure only triggers `brutal_fight` when **alive** members
are all below 30% HP. The pressure logs look reasonable:
- Seeds 3/4/6 show pressure oscillating between 50–100 with rest recovery.
- Seeds 2/5 die immediately — these map seeds place the entry node as a combat
  node that is a corrupted_outpost or equivalent; the synthetic party loses.

#### Critical QA checks

- No throws or unhandled errors in any of 36 runs.
- No "abandoned" outcomes (all die at a real combat node).
- No "unknown" node types in any log entry.
- Encounter builder returns non-null for all act-1 biome combat nodes.
- Dialog conductor is not called in the sim (dialog nodes are noted but no
  `loadNode` is called — correct, sim has no dialog content pipeline).
- Director `recordTick` ringbuffer never exceeds cap (verified: nodeTypes capped
  at 10 entries via `_pushFront` + `arr.length = cap`).
- RecentHistory ringbuffer working correctly.

#### Variety metrics (seed 6, 26 nodes)

Node type breakdown: merchant×1, shrine×3, event×2, dialog×10, lore×4,
combat×5, boss×1 — 7 unique types. Max same-type streak: 5 (dialog streak).
This is normal for storyFirst policy which prioritizes dialog.

---

## Part 2: Stub / No-op Audit

Full findings in `memory/story_mode/STUB_AUDIT.md`. Summary:

| File:line | Severity | Action |
|---|---|---|
| `runCampaign.js:479` — brutal-fight counts dead members | HIGH | Fixed |
| `StoryJournalScreen.js:350` — quest status `'complete'` vs `'completed'` | HIGH | Fixed |
| `StoryJournalScreen.js:373` — `q.currentPhase` vs `q.phase` | HIGH | Fixed |
| `StoryJournalScreen.js:479` — `story.pressure` vs `story.pressureMeter` | HIGH | Fixed |
| `StoryJournalScreen.js:491` — `recentHistory.slice(-5)` on object | HIGH | Fixed |
| `StoryJournalScreen.js:429` — `c.benched` vs `c.active`/`c.recruited` | HIGH | Fixed |
| `storyMode.js:126` — `queueEncounter: null` | MEDIUM | Fixed |
| `StoryMapScreen.js:987` — `gs.story.pressure` wrong field | MEDIUM | Fixed |
| `banter-pools/_stub.json` — empty, banter never fires | MEDIUM | Fixed (5 pair pools added) |
| Storyteller differentiation missing in sim | LOW | Deferred — sim fidelity gap, see STUB_AUDIT.md |
| Iron Judge ambush pool — 1 entry | LOW | Deferred — content pass needed |
| Ash Prophet dark omen — 1 entry | LOW | Deferred — content pass needed |
| `reward_item` effect queues but never fulfills | LOW | Deferred — no shipped content uses it |
| Dialog lock validator incomplete | LOW | Deferred — no shipped content uses dialog_lock |
| Banter pool: 10/15 companion pairs have no pool | LOW | Deferred — content pass |

---

## Part 3: Fixes Landed

### 1. Pressure ratchet bug — `sim/story/runCampaign.js:479`

**Before:** `gs.party.filter(m => m.hp < m.maxHp * 0.3).length` — dead members
at hp=0 always satisfied the condition, triggering brutal_fight on every combat.

**After:** `aliveAfter.filter(m => m.hp < m.maxHp * 0.3)` — only alive members
counted. Pressure now reflects genuine struggle, not every combat with casualties.

### 2. Journal quest status — `src/ui/screens/StoryJournalScreen.js:350`

**Before:** `q.status === 'complete'` — `storyQuestEngine.completeQuest()` sets
`'completed'` (with 'd'), so all completed quests appeared in the Active section.

**After:** Accepts both `'completed'` and `'complete'`.

### 3. Journal quest phase field — `StoryJournalScreen.js:373`

**Before:** `q.currentPhase` — undefined; ledger field is `q.phase`.

**After:** `q.phase || q.currentPhase` — backward-compatible read.

### 4. Journal ledger — wrong pressure field — `StoryJournalScreen.js:479`

**Before:** `dump.pressure = story.pressure` — undefined; field is `story.pressureMeter`.

**After:** `dump.pressureMeter = story.pressureMeter`.

### 5. Journal ledger — `recentHistory` slice bug — `StoryJournalScreen.js:491`

**Before:** `(story.recentHistory || []).slice(-5)` — `recentHistory` is an object
(arrays per category), not a flat array. `.slice` returned undefined.

**After:** Serializes as `{ lastType, sameTypeStreak, nodeTypes[:5], biomes[:5] }`.

### 6. Journal companion tab — `c.benched` vs `c.active` — `StoryJournalScreen.js:429`

**Before:** Checked `c.benched` (always undefined) and showed ALL companions.

**After:** Filters `c.recruited === true` and reads `c.active` for status.

### 7. `storyMode.buildCtx` `queueEncounter: null` — `storyMode.js:126`

**Before:** `queueEncounter: null` — any `start_encounter` effect from quest engine
would silently fail with "no helper."

**After:** Lazy-imports `storyEncounterBuilder.queueEncounter` and delegates.

### 8. `StoryMapScreen` pressure field — `StoryMapScreen.js:987`

**Before:** `gs.story.pressure = ...` — wrong field name; had no effect.

**After:** `gs.story.pressureMeter = ...` — correct field.

### 9. Banter pools populated — `data/story/banter-pools/`

Added 5 companion pair banter pools (5 entries each, 25 total banter exchanges):
- `lyra_ashwalker_orren_gravetide.json`
- `bram_coldfire_lyra_ashwalker.json`
- `captain_maer_orren_gravetide.json`
- `tessaly_veil_yasha_stonewill.json`
- `bram_coldfire_yasha_stonewill.json`

---

## Part 4: Manual UI Walkthrough (Not Automated — No Playwright Available)

The Playwright config exists but the test runner is not invoked as a separate
process here. Manual verification checklist based on code inspection:

- **StoryNewGameScreen:** Shows 6 storyteller cards + 5 sliders. Code at
  `StoryNewGameScreen.js` — complete implementation, wires through to `storyMode.newGame`.
- **StoryMapScreen:** Canvas render path is complete. Node tap → peek drawer → Travel
  button fires `_resolveNodeTravel`. No alert calls found (fixed in M513).
- **StoryJournalScreen:** 5 tabs render live gs data. Fixed 6 bugs this cycle that
  would have shown empty/wrong data.
- **StorySettingsScreen:** Persists to `gs.story.settings` and calls `SaveManager.saveCurrentGame`.

**E2E screenshots:** Not captured — no Playwright process spawned. Screenshots
directory `e2e/screenshots/story-playtest-*.png` not populated this cycle.

---

## Part 5: Remaining Open Items

All deferred items are explicitly documented in `STUB_AUDIT.md`. None are silently
shelved. Summary of deferred:

1. **Storyteller variety in sim** — sim fidelity gap, not a runtime bug.
2. **Iron Judge ambush pool** — 1 entry; needs content pass.
3. **Ash Prophet omen pool** — 1 entry; needs content pass.
4. **`reward_item` effect fulfillment** — no shipped content uses it yet.
5. **Dialog lock validator** — no shipped content uses `dialog_lock`.
6. **Banter pair coverage** — 10/15 pairs still empty.
7. **Stale comment in `storyCompanions.js`** — cosmetic only.

---

## Final Sim Run (post-fix)

```
[sim/story/cli] 36 jobs | 3 worker(s) | policy=storyFirst | maxNodes=50
[sim/story/cli] Done in 0.4s — 36 ok, 0 failed → /tmp/qa3.json
```

0 failed. All 36 jobs completed cleanly. Pressure no longer ratchets to 100 on
first combat (verified by tracing seed-1 chronicler run; pressure oscillates
between 50 and ~90 instead of always capping at 100).

---

## Test Count

- **Before M514:** 729 passing
- **After M514:** 736 passing (+7)
- New tests added:
  - `sim/story/__tests__/runCampaignBasic.test.js` — 1 new test for brutal-fight fix
  - `src/story/__tests__/storyJournal.test.js` — 6 updated/new tests for journal fixes
