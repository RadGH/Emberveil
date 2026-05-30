I have enough context. I've now thoroughly explored the codebase. Let me deliver the implementation plan as my final assistant message, with the note that the parent agent should save it to `3-refined-plan.md`.

---

# Story Mode — 3-Refined Implementation Plan (Emberveil)

> **NOTE TO ORCHESTRATOR:** I am in read-only mode and cannot create files. Please save the content below to `/home/radgh/claude/game13/memory/story_mode/3-refined-plan.md`. The 250-word executive summary follows at the very end.

---

## 1. Architecture overview

### 1.1 `src/story/` module tree (final names)

```
src/story/
  storyMode.js                  -- entry; gameMode router; new-game + load orchestration
  storyLedger.js                -- (de)serializer for gs.story; default shape; per-namespace migrations
  storyPredicate.js             -- evalPredicate(pred, ctx); 30-line parser
  storyEffects.js               -- runEffects(effects, ctx); 22 effect types (see §5/§4)
  storyQuestEngine.js           -- 10-fn quest API; tickQuestConditions
  storyDialogConductor.js       -- pool loader + cross-pool router + condition checks
                                  (intentionally NOT named dialogManager to avoid DialogScreen confusion)
  storyMapGen.js                -- seeded act-map generator; biome assignment; sub-region partition
  storyMapGraph.js              -- runtime graph indexes (byNode, byBiome, hiddenEdges)
  storyMapValidator.js          -- 6 connectivity validators (see §6)
  storyMapMutations.js          -- reveal_path / block_path / mutate_node / waypoint state machine
  storyTraversal.js             -- pan/scroll arithmetic shared with StoryMapScreen
  storyDirector.js              -- two-layer (hard filter + soft score); pressure meter tick
  storyStorytellers.js          -- 6 profile JSONs + 6 unique-mechanic hooks
  storyEncounterBuilder.js      -- intent -> template -> encounter-instance flattener
                                  composes championModifiers + affixes (extends; not parallel)
  storyEnemyInstance.js         -- stat-multiplier / addSkills / addAffixes layer over base enemy
  storyBossVariants.js          -- variant config that extends bossPhases (extends; not parallel)
  storyCompanions.js            -- 6 named companions; approval; banter scheduler
  storyFactions.js              -- rep -10..+10; threshold helpers; region-control resolver
  storyRumors.js                -- rumor-pool selection per town visit
  storySkillCheck.js            -- 4-stat + skill-label resolver (Brainstorm §3 Option 1)
  storyContent.js               -- runtime content registry; lazy-loaded JSON dictionaries
  storyAssertions.js            -- in-game assert helpers (used by validators)
  __tests__/                    -- vitest specs for every module above
```

Rule: every module in `src/story/` is lazy-imported via `import('./story/...')` from `storyMode.js`. Classic Mode never pays the bundle cost (Vite tree-shakes; the dynamic import is the boundary).

### 1.2 `data/story/` JSON registry (authored)

```
data/story/
  lore-primer.md                       -- 3000-5000 token primer for LLM gen
  canonical-flags.json                 -- { id, description }[]  (~200 ids)
  canonical-factions.json              -- { id, name, description, color }[]
  canonical-biomes.json                -- { id, name, palette, soundscape }[]
  canonical-skills.json                -- the 18 skill labels (Brainstorm §3)
  canonical-stats.json                 -- ["STR","DEX","INT","CON"]
  skill-affinities.json                -- 10 classes x 18 skills -> {0,2}
  storytellers/                        -- six profile JSONs
    chronicler.json
    ash_prophet.json
    warbringer.json
    trickster.json
    pilgrim.json
    iron_judge.json
  difficulty-presets.json              -- relaxed/normal/hard/nightmare numbers
  npcs.json                            -- the 20 named NPCs
  enemies-story.json                   -- the 20 enemy/boss IDs and base refs
  quest-lines/
    primary_act1_emberwood.json
    primary_act2_veilscar.json
    primary_act3_riftgate.json
    secondary_*.json                   -- 6 files
    companion_lyra_personal.json       -- 6 files (one per companion)
  dialogue-pools/
    arrival.json
    ambush.json
    shrine.json
    merchant.json
    lore.json
    faction.json
    side-quest.json
    companion-<id>.json                -- 6 files
  banter-pools/
    <companionA>_<companionB>.json     -- up to 15 pairs (C(6,2))
  encounter-templates/
    act1_*.json                        -- per-biome combat templates
    act2_*.json
    act3_*.json
  side-quest-templates.json
  rumor-pool.json
  faction-control-map.json             -- region -> faction owner per act
  world-mutations.json
  achievements-story.json              -- 12 story achievements
  audio-mapping.json                   -- biome -> music; storyteller -> filter chain
  dialogue-review-state.json           -- approval state per node id
  _rejected/                           -- LLM rejections moved here (kept for salvage)
  _generated/                          -- raw OpenAI outputs before review
```

### 1.3 `public/assets/data/story/` build outputs

```
public/assets/data/story/
  content-manifest.json                -- built by build-story-content-manifest.cjs
  coverage.json                        -- built by build-story-coverage.cjs
  balance/M###.json                    -- per-milestone storyteller-balance results
  balance/index.json
  quest-graph.json                     -- pre-rendered quest DAG for quest-graph.html
  story-inspector-context.json         -- canonical flag/faction/skill list for inspector
```

### 1.4 New screens (`src/ui/screens/`)

| Class | Path | Gates | Notes |
|---|---|---|---|
| `StoryNewGameScreen` | `src/ui/screens/StoryNewGameScreen.js` | `gameMode === undefined` | Mode + storyteller + 5 sliders. |
| `StoryMapScreen` | `src/ui/screens/StoryMapScreen.js` | `gs.gameMode === 'story'` | Sub-region pagination. |
| `StoryDialogScreen` | `src/ui/screens/StoryDialogScreen.js` | story dialog effects present | Subclass of `DialogScreen` that registers extra effect renderers. |
| `StoryJournalScreen` | `src/ui/screens/StoryJournalScreen.js` | always (in story) | Tabs: Quests / Factions / Companions / Lore / Ledger. |
| `StorySettingsScreen` | `src/ui/screens/StorySettingsScreen.js` | always (in story) | Story-specific settings overlay (banter freq, autosave cadence). |
| `StoryDirectorDebugScreen` | `src/ui/screens/StoryDirectorDebugScreen.js` | `localStorage.emberveil_debug==='1'` | In-game step-the-director. |

### 1.5 New tool pages (`public/assets/`)

```
public/assets/story-inspector.html
public/assets/quest-graph.html
public/assets/storyteller-balance.html
public/assets/story-dialog-review.html
public/assets/story-campaign-sim.html
```

All use `_header.js`/`_footer.js`; no inline CSS for static values; each has its own `<style>` block.

### 1.6 New scripts (`scripts/`)

```
scripts/build-story-content-manifest.cjs     -- validate + emit manifest
scripts/build-story-coverage.cjs             -- reachability/orphan report
scripts/build-storyteller-balance.cjs        -- run 2400 sims; emit balance/M*.json
scripts/generate-story-dialogue.cjs          -- OpenAI batch dialog gen
scripts/generate-story-npc-sprites.cjs       -- wraps openai-spritesheet-gen.py for the 20 NPCs
scripts/generate-story-enemy-sprites.cjs     -- wraps openai-spritesheet-gen.py for the 20 enemies
scripts/extract-story-canonical.mjs          -- emit canonical-flags/factions/skills/biomes from authored data
```

`release.sh` integration (after step 3, before `vite build`):
1. `node scripts/extract-story-canonical.mjs`
2. `node scripts/build-story-content-manifest.cjs` -- **fails build on any predicate/flag/next orphan**
3. `node scripts/build-story-coverage.cjs`

### 1.7 Mode-routing entry point

Exactly **one** branch:

- `src/ui/screens/TitleScreen.js` -- new "New Game" button opens **`StoryNewGameScreen`** which has a mode picker at the top (`Classic | Story`). Picking Classic mounts the existing `CharacterBuilderScreen` path; picking Story mounts the storyteller/slider panel and proceeds to `storyMode.newGame(opts)` -> push `StoryMapScreen`.
- `src/main.js`: no change. The branch is in `LoadGameScreen.js` (one new conditional) that reads `saved.gameMode` and pushes either `MapScreen` (classic) or `StoryMapScreen` (story).

---

## 2. Save schema (definitive)

### 2.1 Root layout

Slot keys: `emberveil_save_N` for Classic (unchanged), **`emberveil_save_story_N`** for Story (N = 0..2). Slots are fully separate per user constraint. `cloudSaves.js` mirrors the same keying.

```js
// Classic save root (UNCHANGED) -- gameMode is the only added field.
{
  version: <int>,            // existing global save version
  gameMode: 'classic',       // NEW: default 'classic' for any pre-existing save
  ...all existing classic fields untouched...
}

// Story save root (NEW).
{
  version: <int>,            // same global counter
  gameMode: 'story',
  storyVersion: 1,           // story-content schema version
  story: { ... },            // see 2.2
  // Classic-shape fields reused: party, companions (tavern hires), gold, fame, achievements
  // are persisted at root because they share the same combat engine and UI.
  // NEVER persist Classic-only fields (zoneId, nodeId, completedBosses, visitedNodes) -- those live in story.*
}
```

### 2.2 `story.*` sub-tree (typed, definitive)

```js
gs.story = {
  // --- identity / config ---
  campaignSeed:        'a3f9c2e1',      // 8-char hex (string)
  saltOffset:          0,               // int; bumped by map regen
  storytellerId:       'chronicler',    // 'chronicler'|'ash_prophet'|'warbringer'|'trickster'|'pilgrim'|'iron_judge'
  difficulty:          'normal',        // 'relaxed'|'normal'|'hard'|'nightmare'
  thematicConsistency: 'balanced',      // 'loose'|'balanced'|'strict'
  sideEventFrequency:  'normal',        // 'low'|'normal'|'high'|'wild'
  combatDensity:       'normal',        // 'low'|'normal'|'high'
  storyPressure:       'normal',        // 'low'|'normal'|'high'

  // --- versioning per namespace (see 2.5) ---
  versions: { dialog: 1, quest: 1, content: 1, map: 1, director: 1 },

  // --- runtime ---
  act:                 1,               // 1..3
  currentMapId:        'act1_emberwood',
  currentNodeId:       'a1_n_000',
  rngState:            2853194710,      // uint32, Mulberry32 state checkpoint

  // --- ledger ---
  flags:               {},              // { [string]: boolean }
  counters:            {},              // { [string]: number }
  factions:            {},              // { [string]: int in [-10,10] }
  quests:              {},              // see 4.1
  dialogHistory:       {},              // { [nodeId]: { choiceId: string, ts: int } }
  loreDiscovered:      [],              // string[]
  worldMutations:      [],              // string[] (ids)
  worldCorruption:     0,               // 0..100, per-act-cap enforced by mutate_node
  bossHistory:         {},              // { [bossId]: { outcome: 'killed'|'spared'|'redeemed', variant: string } }

  // --- world maps ---
  maps: {                               // { [mapId]: MapSave } -- only generated maps persist
    act1_emberwood: {
      subRegions: ['emberwood','stoneward','fen','oldroad','gloomridge'],
      nodes:    { 'a1_n_000': { state, visibility, waypointState, assignedEncounterId } },
      edges:    [ { from, to, kind: 'open'|'locked'|'hidden_revealed', lockId?: string } ],
      revealedPaths: ['old_mill_hidden_path'],
      regionWeather: { emberwood: 'clear' /* idea-5 weather */ },
    }
  },

  // --- per-node encounter snapshot (anti-rerot/anti-scum) ---
  encounterHistory: {},                 // { [nodeId]: EncounterInstance (full enemies + modifiers) }

  // --- director memory (NOT telemetry) ---
  recentHistory: {
    nodeTypes:     [],                  // last 10, newest first
    enemyFamilies: [],
    skillLabels:   [],
    rewardTypes:   [],
    biomes:        [],
    tones:         [],
    sameTypeStreak: 0,
    lastType:      null,
  },
  pressureMeter:       50,              // 0..100

  // --- companions (the 6 named story companions) ---
  companions: [
    { id: 'lyra_ashwalker', recruited: false, active: false,
      approval: 0, alive: true,
      personalQuestId: 'companion_lyra_personal',
      personalQuestStarted: false,
      lastBanterNode: null,
      benchedAt: null  /* nodeId */ }
    /* ...6 entries (pre-populated as inactive on new game) */
  ],
  activeCompanionId:   null,            // string|null (5th party slot occupant)

  // --- rumor / pressure / pending tolls ---
  rumorPool:           [],              // string[] active rumor ids
  pendingTolls:        [],              // [{ type, value, source }]
  lastUndoableChoice:  null,            // see idea-2 (Memory Shrine)

  // --- bookkeeping ---
  campaignStartDate:   1716160000000,
  lastSaveDate:        1716170000000,
};
```

### 2.3 `Set` vs array convention

Classic continues to use `Set` instances for `visitedNodes / usedShrines / sneakedNodes / manuallyUnequipped / loreUnlocked / craftingRecipesUnlocked / skillChecksAttempted` and serializes via the existing `Array.from()` pattern in `gameState.load`.

**`story.*` is a `Set`-free zone** by contract. The serializer fast-path is `JSON.stringify(gs.story)` round-trips with zero conversion. If you need set semantics inside the ledger (e.g. `loreDiscovered`), it is stored as an array and de-duplicated on write via a small helper `setUniquePush(arr, id)` in `storyLedger.js`.

### 2.4 RNG checkpointing

- `gs.story.rngState` is a `uint32` -- the **current** Mulberry32 internal `a` value (the simulator's existing PRNG, exported as `mulberry32`).
- After every committed Director decision and after every dialog choice resolution, `storyMode.commitRng(nextState)` is called which writes `gs.story.rngState = nextState` then calls `GameState.save()`.
- On load, Director reseeds: `rng = mulberry32(gs.story.rngState)`.
- **Per-node ephemeral RNG** (skill check dice + encounter rolls): seeded from `gs.story.rngState ^ hash(nodeId)`. These do NOT advance `rngState` -- the dice are deterministic per node, defeating save-scum.

### 2.5 Per-namespace versioning + migration registry

```js
// src/story/storyLedger.js
export const MIGRATIONS = {
  dialog:   { /* from -> to -> fn */ 1: { 2: (save) => { /* rename flag X */ return save; } } },
  quest:    { 1: {} },
  content:  { 1: {} },
  map:      { 1: {} },
  director: { 1: {} },
};

export function migrateStorySave(save) {
  for (const ns of Object.keys(MIGRATIONS)) {
    let v = save.story.versions[ns] || 1;
    const chain = MIGRATIONS[ns];
    while (chain[v] && chain[v][v + 1]) { save = chain[v][v + 1](save); v++; }
    save.story.versions[ns] = v;
  }
  return save;
}
```

`gameState.load` calls `migrateStorySave(saved)` only when `saved.gameMode === 'story'`. The branch otherwise never runs; Classic saves never enter the story migration path.

### 2.6 Classic saves -- explicit untouched contract

- `gameMode` field default: if `saved.gameMode === undefined`, treat as `'classic'`. Persist `'classic'` on next save so future loads are unambiguous.
- Classic saves never have `story` on disk. `gameState.load` does not add it.
- A Story save **cannot** be migrated back to Classic. `LoadGameScreen` shows the two slot sets separately and forbids cross-loading.

---

## 3. Predicate DSL spec

### 3.1 JSON shape (operators)

```
{ all: [pred,...] }            -- boolean AND
{ any: [pred,...] }            -- boolean OR
{ not: pred }                  -- boolean NOT
{ flag: 'name' }               -- truthy flag
{ faction: 'id', gte|lte|eq: int }
{ quest: 'id', phase?: 'p', status?: 'active'|'completed'|'failed' }
{ counter: 'name', gte|lte: int }
{ item: 'id' }                 -- any party member carries
{ companion: 'id', approval?: { gte|lte: int }, active?: bool }
{ class: 'id' }                -- any party member is this class
{ stat: 'STR'|'DEX'|'INT'|'CON', gte|lte: int } -- leader-only
{ skillCheck: 'label', gte: int }  -- expected check power threshold (Director use)
```

### 3.2 Parser (actual JS, drop-in)

```js
// src/story/storyPredicate.js
export function evalPredicate(pred, ctx) {
  if (!pred) return true;
  const { flags, factions, quests, counters, party, companions } = ctx;
  if ('all' in pred) return pred.all.every(p => evalPredicate(p, ctx));
  if ('any' in pred) return pred.any.some(p => evalPredicate(p, ctx));
  if ('not' in pred) return !evalPredicate(pred.not, ctx);
  if ('flag' in pred) return !!flags[pred.flag];
  if ('faction' in pred) {
    const v = factions[pred.faction] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    if ('lte' in pred) return v <= pred.lte;
    if ('eq'  in pred) return v === pred.eq;
    return v !== 0;
  }
  if ('quest' in pred) {
    const q = quests[pred.quest]; if (!q) return false;
    if ('phase'  in pred) return q.phase === pred.phase;
    if ('status' in pred) return q.status === pred.status;
    return true;
  }
  if ('counter' in pred) {
    const v = counters[pred.counter] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    if ('lte' in pred) return v <= pred.lte;
    return v > 0;
  }
  if ('item' in pred) return party.some(m => (m.equipment ? Object.values(m.equipment).some(it => it?.id === pred.item) : false));
  if ('class' in pred) return party.some(m => (m.cls || m.class) === pred.class);
  if ('stat' in pred) {
    const v = (party[0]?.attrs || {})[pred.stat] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    if ('lte' in pred) return v <= pred.lte;
    return v > 0;
  }
  if ('companion' in pred) {
    const c = companions.find(c => c.id === pred.companion);
    if (!c || !c.recruited) return false;
    if (pred.active && !c.active) return false;
    if (pred.approval?.gte != null && c.approval < pred.approval.gte) return false;
    if (pred.approval?.lte != null && c.approval > pred.approval.lte) return false;
    return true;
  }
  if ('skillCheck' in pred) return true; // director-only; ignore at runtime
  console.warn('[evalPredicate] unknown op', pred);
  return false;
}
```

### 3.3 CI linter rules (in `build-story-content-manifest.cjs`)

For every `requires`/`condition`/`completeCondition`/`revealedBy` in any data/story JSON:
- Recursively walk the predicate tree.
- Every leaf op must be in the known op set above.
- `flag` strings must appear in `canonical-flags.json`.
- `faction` ids must appear in `canonical-factions.json`.
- `quest` ids must appear in the union of all `quest-lines/*.json`.
- `class` ids must be in `classes.json`.
- `companion` ids must appear in the 6-companion roster.
- `item` ids must appear in `items.js` exports.
- `stat` must be one of STR/DEX/INT/CON; `skillCheck` must be in `canonical-skills.json`.
- Any unknown leaf op -> exit 1.

### 3.4 Worked examples

```json
// E1 -- friendly Emberguard required + shrine pure
{ "all": [{ "faction": "emberguard", "gte": 5 }, { "flag": "shrine_purified" }] }

// E2 -- Hostile to Ashen Veil OR has the Veil-Lens item
{ "any": [{ "faction": "ashen_veil", "lte": -5 }, { "item": "veil_lens" }] }

// E3 -- Orren in party at approval >= 5
{ "companion": "orren_gravetide", "active": true, "approval": { "gte": 5 } }

// E4 -- Primary quest is in 'investigate_burned_road' phase
{ "quest": "primary_act1_emberwood", "phase": "investigate_burned_road" }

// E5 -- Not yet failed companion quest AND has scholar flag
{ "all": [
    { "not": { "quest": "companion_bram_personal", "status": "failed" } },
    { "flag": "ember_scholar" }
] }
```

---

## 4. Quest engine spec

### 4.1 Runtime state (`gs.story.quests[questId]`)

```js
{ status: 'inactive'|'active'|'completed'|'failed',
  phase:  'phase_id',
  log:    [ 'log line', ... ],
  outcomes: [ 'outcome_id', ... ] }
```

### 4.2 JSON definition (one full example)

```json
{
  "id": "primary_act1_emberwood",
  "category": "primary",
  "act": 1,
  "title": "The Emberwood Holds",
  "startCondition": { "flag": "act1_started" },
  "phases": [
    { "id": "reach_brightfall",
      "label": "Reach Brightfall",
      "completeCondition": { "flag": "arrived_brightfall" },
      "onComplete": [
        { "type": "set_flag", "flag": "brightfall_gates_open" },
        { "type": "faction_delta", "faction": "emberguard", "amount": 1 },
        { "type": "reveal_nodes_tag", "tag": "burned_road_clue", "count": 2 }
      ],
      "nextPhase": "investigate_burned_road" },
    { "id": "investigate_burned_road",
      "label": "Investigate the burned road",
      "completeCondition": { "any": [{ "flag": "road_cultist_found" }, { "flag": "road_evidence_burned" }] },
      "onComplete": [
        { "type": "quest_log", "text": "The cult moves supplies through the old road." },
        { "type": "reveal_path", "from": "a1_n_018", "to": "a1_n_026" }
      ],
      "nextPhase": "confront_guardian" }
  ],
  "outcomes": [
    { "id": "guardian_defeated", "condition": { "flag": "guardian_killed" },
      "effects": [{ "type": "unlock_map_transition", "targetMap": "act2_veilscar" },
                  { "type": "faction_delta", "faction": "emberguard", "amount": 2 }] },
    { "id": "guardian_redeemed",
      "condition": { "all": [{ "flag": "guardian_spared" }, { "flag": "shrine_purified" }] },
      "effects": [{ "type": "set_flag", "flag": "guardian_ally" },
                  { "type": "unlock_map_transition", "targetMap": "act2_veilscar" },
                  { "type": "faction_delta", "faction": "ancient_pact", "amount": 3 }] }
  ]
}
```

### 4.3 The 10 functions (full code, each <=30 lines)

```js
// src/story/storyQuestEngine.js
import { evalPredicate } from './storyPredicate.js';
import { runEffects } from './storyEffects.js';

export function ensureQuestStarted(gs, questId) {
  if (gs.story.quests[questId]) return;
  const def = gs.__storyContent.quests[questId];
  if (!def) return;
  if (def.startCondition && !evalPredicate(def.startCondition, _ctx(gs))) return;
  gs.story.quests[questId] = { status: 'active', phase: def.phases[0].id, log: [`Quest started: ${def.title}`], outcomes: [] };
}

export function advanceQuestPhase(gs, questId, phaseId) {
  const q = gs.story.quests[questId]; if (!q) return;
  q.phase = phaseId; q.log.push(`Phase -> ${phaseId}`);
}

export function completeQuest(gs, questId, outcomeId) {
  const q = gs.story.quests[questId]; if (!q) return;
  q.status = 'completed'; q.outcomes.push(outcomeId);
  q.log.push(`Completed via outcome: ${outcomeId}`);
}

export function failQuest(gs, questId) {
  const q = gs.story.quests[questId]; if (q) { q.status = 'failed'; q.log.push('Quest failed.'); }
}

export function getActiveQuests(gs) {
  return Object.entries(gs.story.quests).filter(([, q]) => q.status === 'active').map(([id, q]) => ({ id, ...q }));
}

export function getQuestPhase(gs, questId) {
  return gs.story.quests[questId]?.phase || null;
}

export function checkQuestOutcomes(gs, questId) {
  const def = gs.__storyContent.quests[questId];
  const q = gs.story.quests[questId];
  if (!def || !q || q.status !== 'active') return;
  for (const outcome of def.outcomes || []) {
    if (q.outcomes.includes(outcome.id)) continue;
    if (evalPredicate(outcome.condition, _ctx(gs))) {
      runEffects(outcome.effects, _ctx(gs), { currentQuestId: questId });
      completeQuest(gs, questId, outcome.id);
    }
  }
}

export function tickQuestConditions(gs) {
  for (const id of Object.keys(gs.story.quests)) {
    const q = gs.story.quests[id]; if (q.status !== 'active') continue;
    const def = gs.__storyContent.quests[id]; if (!def) continue;
    const phaseDef = def.phases.find(p => p.id === q.phase);
    if (phaseDef && evalPredicate(phaseDef.completeCondition, _ctx(gs))) {
      runEffects(phaseDef.onComplete || [], _ctx(gs), { currentQuestId: id });
      if (phaseDef.nextPhase) advanceQuestPhase(gs, id, phaseDef.nextPhase);
      else checkQuestOutcomes(gs, id);
    } else {
      checkQuestOutcomes(gs, id);
    }
  }
}

export function runQuestEffects(effects, gs, extra = {}) { runEffects(effects, _ctx(gs), extra); }

export function getQuestLog(gs, questId) { return gs.story.quests[questId]?.log || []; }

function _ctx(gs) {
  return { flags: gs.story.flags, factions: gs.story.factions, quests: gs.story.quests,
           counters: gs.story.counters, party: gs.party, companions: gs.story.companions,
           revealPath: (f, t) => import('./storyMapMutations.js').then(m => m.revealPath(gs, f, t)),
           revealNodesByTag: (tag, n) => import('./storyMapMutations.js').then(m => m.revealNodesByTag(gs, tag, n)),
           unlockTransition: (id) => import('./storyMapMutations.js').then(m => m.unlockTransition(gs, id)),
           setWaypointState: (n, s) => import('./storyMapMutations.js').then(m => m.setWaypointState(gs, n, s)),
           queueEncounter: (t) => import('./storyEncounterBuilder.js').then(m => m.queueEncounter(gs, t)),
           gs };
}
```

### 4.4 Dialog-to-quest bridge

Dialog effect `{ type: 'quest_advance', questId, phase }` calls `advanceQuestPhase(gs, questId, phase)` then `tickQuestConditions(gs)` once. Effect `{ type: 'quest_fail', questId }` calls `failQuest`. `tickQuestConditions` is also called by `storyMode.afterNodeResolved(nodeId)` after every node exit.

---

## 5. Dialog engine spec

### 5.1 Effect language (22 types, payload shapes)

```js
{ type: 'set_flag',          flag: 'name' }
{ type: 'clear_flag',        flag: 'name' }
{ type: 'set_counter',       counter: 'name', value: int }
{ type: 'inc_counter',       counter: 'name', amount: int }
{ type: 'faction_delta',     faction: 'id', amount: int }           // clamped -10..10
{ type: 'companion_approval',companion: 'id', amount: int }         // clamped -10..10
{ type: 'recruit_companion', companion: 'id' }
{ type: 'dismiss_companion', companion: 'id' }
{ type: 'quest_advance',     questId: 'id', phase: 'p' }
{ type: 'quest_complete',    questId: 'id', outcomeId: 'o' }
{ type: 'quest_fail',        questId: 'id' }
{ type: 'quest_log',         text: 'string' }                       // ctx.currentQuestId from runner
{ type: 'reveal_path',       from: 'nodeId', to: 'nodeId' }
{ type: 'reveal_nodes_tag',  tag: 'string', count: int }
{ type: 'block_path',        from: 'nodeId', to: 'nodeId' }
{ type: 'mutate_node',       nodeId: 'id', overlay: 'corrupted'|'cleansed'|'destroyed' }
{ type: 'unlock_waypoint',   nodeId: 'id' }
{ type: 'unlock_map_transition', targetMap: 'mapId' }
{ type: 'start_encounter',   template: 'templateId' }               // queues for next node
{ type: 'lore_unlock',       loreId: 'id' }
{ type: 'gold',              amount: int }
{ type: 'reward_item',       itemId?: 'id', generate?: { kind, tier } }
{ type: 'world_mutation',    id: 'string' }
{ type: 'corruption',        amount: int }                          // clamped 0..100
{ type: 'pressure',          amount: int }                          // clamped 0..100
{ type: 'add_toll',          tollType: 'gold'|'combat'|'flag', value: any, source: 'string' }
{ type: 'undoable_mark' }                                           // remembers current choice for Memory Shrine
```

`runEffects(effects, ctx, extra?)` dispatches via a lookup table; unknown -> `console.warn` and skip (never throw -- bad authored content must never brick a run).

### 5.2 Condition checker

Every `choice.requires`, `choice.companionCondition`, `node.condition` is a predicate per §3 evaluated against `ctx`. Choices failing `requires` are **hidden**; choices with a satisfied `companionCondition` get a `[Companion]` label prefix.

### 5.3 Existing 5500-line dialog content migration plan

**Decision: Story Mode uses the new DSL; Classic Mode keeps the old shape forever.** Rationale:

- Classic content in `src/maps/dialogEvents.js / recurringNpcEvents.js / randomEvents.js` is hand-tuned around Classic Mode's zone progression. Migrating it risks regressions and serves no Story-Mode purpose (storytellers won't use those events).
- The old DSL is a strict subset; the new conductor includes a **back-compat adapter** at `storyDialogConductor.adaptLegacyChoice(choice)` that maps old-shape choices (`effect: { gold: -10 }`, `setFlag: 'name'`, `outcome: 'fight'`) into the new effect-array shape. This is only used if a Story-Mode dialog explicitly references a legacy event id (escape hatch for shared NPCs); zero existing files are rewritten.
- Net: no migration touches existing 5500 lines.

### 5.4 Cross-pool `next:` routing

A `next:` value in a dialog node is one of:
- `null` -- end node; conductor calls `onComplete(outcomes)`.
- `'#localNodeId'` -- intra-event jump (existing behavior preserved).
- `'pool:arrival#arrival_brightfall_002'` -- explicit cross-pool jump. Conductor parses the prefix, lazy-loads the target pool from the registry, validates the target id exists, jumps.

Linter enforces: every `next:` either is `null`, has `#` and resolves locally, or has `pool:` prefix and resolves in the named pool.

### 5.5 dialogManager -> DialogScreen integration

`StoryDialogScreen` extends `DialogScreen` and overrides:

- `_renderEffectFeedback(effects)` -- renders a one-line caption per applied effect (e.g. "+1 Emberguard reputation", "Lyra approves").
- `_applyChoiceEffects(choice)` -- replaces the old flat-shape handler. Calls `runEffects(choice.effects, ctx)`.
- `_filterChoices(choices)` -- runs predicate check on `requires` + `companionCondition`.

Existing `DialogScreen.js` (992 lines) is untouched; the subclass adds ~120 lines. Conductor (`storyDialogConductor.js`) handles pool/routing and hands the screen a single node-at-a-time.

### 5.6 Companion banter trigger

`storyCompanions.maybeFireBanter(gs, nodeId, triggerCause)` runs after each map node resolution. Selection:
1. Active companion + any other recruited companion forms a pair.
2. Banter pool for that pair: `data/story/banter-pools/<a>_<b>.json`.
3. Filter by trigger (`onNodeType`, `onFlag`, `onActStart`).
4. Filter by cooldown -- `entry.cooldown` >= `nodesSince(entry.lastFired)`.
5. Max once per 3 nodes globally (governs `story.lastBanterNode`).
6. If none match: no banter (silence is fine).
Delivery: non-blocking overlay (slide-in top panel, 3s, tap-to-dismiss-early). No screen push.

---

## 6. Map engine spec

### 6.1 worldGenerator algorithm (single paragraph)

Given `(seed, act, salt)`, `storyMapGen.generateAct(opts)` runs Mulberry32 to: (1) pick the act's 5 sub-region biomes from `canonical-biomes.json` weighted by act tags; (2) for each sub-region, lay out a 3-lane FTL-style strip of 9-12 nodes using the same `_layoutZoneToFTLGrid` algorithm currently in `MapScreen.js` (proven on mobile, deterministic); (3) for each strip, generate 1-3 cross-lane edges per column with `p=0.6` so paths converge and split; (4) connect each sub-region to its right neighbor via 1-3 edges between rightmost-column-nodes -> leftmost-column-nodes of next region; (5) tag 8-15% of edges as `hidden` with an authored `lockId` drawn from a per-act pool; (6) tag 2-4 nodes per region as `waypoint` (one per sub-region guaranteed); (7) annotate each node with `nodeType` placeholder (combat/dialog/shrine/lore/merchant/rest/boss/event) by sampling from per-biome distributions; (8) run validators (§6.4) -- if any fails, increment `salt` and retry, capped at 10 attempts; on attempt 11 use the hand-authored "safety-net" template at `data/story/safety-net-acts/act<N>.json`.

### 6.2 Node-count / biome-count / route distribution table

| Act | Sub-regions | Nodes/region | Total nodes | Hidden edges | Waypoints | Boss nodes |
|---|---|---|---|---|---|---|
| 1  | 5 (Emberwood, Stoneward, Fen, Old Road, Gloomridge) | 9-12 | 50-60 | 5-8 | 5 | 1 |
| 2  | 5 (Veilscar, Plague Fen, Ash Plains, Library Ruins, Crossroads) | 10-13 | 55-65 | 6-10 | 5 | 1 |
| 3  | 4 (Riftgate, Architect's Verge, Ember Hollow, Sovereign's Approach) | 12-15 | 50-58 | 4-7 | 4 | 1 (final boss) |

Per-biome node-type distribution (Act 1 Emberwood example):

```
{ combat: 0.40, dialog: 0.22, shrine: 0.08, lore: 0.10, merchant: 0.06, rest: 0.08, event: 0.06 }
```

Stored in `canonical-biomes.json`, normalized per region during gen.

### 6.3 Data shapes

```js
// In-memory only (NOT persisted):
mapGraph = {
  mapId: 'act1_emberwood',
  subRegions: [{ id: 'emberwood', name: 'Emberwood', biome: 'emberwood', nodeIds: [...], xOffset: 0 }, ...],
  nodes:   { [id]: { id, biome, regionId, lane: 0|1|2, col: int, type, tags: [], baseWeight: 1.0, ... } },
  edges:   [{ id, from, to, kind: 'open'|'hidden'|'locked', lockId?: 'string' }],
  indexes: { byBiome: Map, byTag: Map, byType: Map, outgoing: Map<from,Edge[]>, incoming: Map<to,Edge[]> },
};

// Persisted in gs.story.maps[mapId]:
MapSave = {
  subRegions: ['emberwood',...],   // ids in order
  nodes: { [id]: { state, visibility, waypointState, assignedEncounterId } },
  edges: [{ from, to, kind, lockId? }],     // serialized; mutated by reveal/block
  revealedPaths: ['lock_id_1', ...],
  regionWeather: { regionId: 'fog'|'clear'|... },
};
```

### 6.4 Connectivity validators

| Function | Returns | Checks |
|---|---|---|
| `validateGraphConnectivity(graph)` | `{ ok, reason? }` | Every node reachable from `entry` via DFS ignoring locked/hidden edges. |
| `validateQuestCriticalReachability(graph, quests)` | `{ ok, unreachableIds }` | Every node tagged `quest_critical` is reachable from `entry`. |
| `validateBossReachability(graph, bossNodeId)` | `{ ok }` | Boss node reachable. |
| `validateSubRegionStitch(graph)` | `{ ok }` | Each sub-region has >=1 incoming and >=1 outgoing edge to neighbor (except first/last). |
| `validateWaypointCoverage(graph)` | `{ ok, missingRegions }` | Every sub-region has >=1 waypoint node. |
| `validateHiddenPathSatisfiability(graph, quests, dialogPools)` | `{ ok, brokenLocks }` | Every `lockId` has at least one predicate path in any reachable dialog/quest that can satisfy it (i.e. >0 chance of reveal given some choice sequence). This is the "guaranteed reveal" check from roast §6.3. |

### 6.5 Sub-region pagination (mobile)

- Each sub-region is a horizontal strip up to 1.8 viewport wide (~707 px).
- `StoryMapScreen` swipes between strips with the existing horizontal-pan recognizer; at the right edge of a strip, a further-right swipe (delta > 60 px on canvas pan exhaustion) **paginates** to the next sub-region with a 200 ms slide transition + biome label fade.
- Cross-region transitions: drawn using the SAME `_drawCrossZoneLinks` pattern that `MapScreen.js` already implements for cross-zone arrows (DECIDED -- reuse, do not invent new). Style: dashed 2px arrow off the right edge of the source node toward the destination region's left margin; tap on the arrow triggers the page-flip.

### 6.6 Waypoint state machine

States: `unexplored -> discovered -> activated -> corrupted -> disabled`

Transitions:
- `unexplored -> discovered`: player visits the node OR a rumor reveals it.
- `discovered -> activated`: dialog effect `unlock_waypoint`. Enables fast-travel.
- `activated -> corrupted`: world-mutation effect or boss flag (e.g. `den_mother_alive`).
- `corrupted -> activated`: dialog effect `purify_waypoint` (a `mutate_node` overlay swap).
- `*: -> disabled`: only via world-mutation `disable_waypoint`. Permanent.

Stored in `MapSave.nodes[id].waypointState`. Persisted with the save.

### 6.7 Path mutation API (exact signatures)

```js
// src/story/storyMapMutations.js
export function revealPath(gs, fromId, toId)              -> boolean   // flips edge.kind hidden->open
export function blockPath(gs, fromId, toId)               -> boolean   // open->blocked
export function revealNodesByTag(gs, tag, count)          -> string[]  // returns revealed ids
export function mutateNode(gs, nodeId, overlay)           -> void      // sets nodeOverlays[nodeId]
export function unlockTransition(gs, targetMapId)         -> void      // sets story.flags['transition_'+id]
export function setWaypointState(gs, nodeId, state)       -> void
export function applyWorldMutation(gs, mutationId)        -> void      // reads world-mutations.json
```

---

## 7. Director spec

### 7.1 Storyteller profile JSON shape (final)

```json
{
  "id": "chronicler",
  "displayName": "The Chronicler",
  "bio": "Weaves consistent narrative threads...",
  "preferredThemes": ["lore","investigation","faction","memory"],
  "combatFrequency": 0.45,
  "skillCheckVariety": 0.6,
  "thematicConsistency": 0.85,
  "pressureBias": 0.0,
  "rules": {
    "maxSameTypeStreak": 2,
    "minNodesBetweenBosses": 25,
    "forceRestAfterBrutalFight": true,
    "fallbackAllowed": true
  },
  "uniqueMechanic": "narrative_coherence_bonus"
}
```

The 6 full profiles ship as `data/story/storytellers/*.json`:

| id | combatFreq | skillVar | thematicCons | pressureBias | uniqueMechanic |
|---|---|---|---|---|---|
| `chronicler`  | 0.45 | 0.6 | 0.85 | 0    | `narrative_coherence_bonus` |
| `ash_prophet` | 0.55 | 0.5 | 0.7  | +0.2 | `dark_omen_interrupt` |
| `warbringer`  | 0.7  | 0.4 | 0.6  | +0.15| `momentum_escalation` |
| `trickster`   | 0.5  | 0.85| 0.4  | 0    | `every_6th_random` |
| `pilgrim`     | 0.35 | 0.7 | 0.7  | -0.1 | `discovery_pool_3x` |
| `iron_judge`  | 0.6  | 0.5 | 0.75 | +0.25| `no_fallback_ambush_instead` |

### 7.2 Intent generation: 2-layer

**Layer 1 -- Hard filter** (boolean):
- `candidate.act` includes `gs.story.act`.
- `candidate.biome` matches current region biome (unless tagged `anyBiome`).
- `candidate.requires` predicate satisfied.
- `candidate.factionRequirement` passes (if any).
- `streakCheck`: if `recentHistory.sameTypeStreak >= storyteller.rules.maxSameTypeStreak`, exclude candidates with same `candidate.type`.

If filtered list is empty: append `FALLBACK_CANDIDATE` unless `storyteller.rules.fallbackAllowed === false` (Iron Judge), in which case synthesize an ambush template from the act's ambush pool.

**Layer 2 -- Soft score** (multiplicative; exact code in §8 of brainstorm; restated):

```js
function softScore(c, h, st) {
  let s = c.baseWeight; // authored in [0.1, 1.0]
  for (let i=0;i<h.nodeTypes.length;i++) if (h.nodeTypes[i]===c.type) s *= Math.pow(0.5, i+1);
  if (h.sameTypeStreak >= 2 && c.type === h.lastType) s *= 0.05;
  if (c.enemyFamily) for (let i=0;i<h.enemyFamilies.length;i++) if (h.enemyFamilies[i]===c.enemyFamily) s *= Math.pow(0.6, i+1);
  if (c.primarySkill) for (let i=0;i<h.skillLabels.length;i++) if (h.skillLabels[i]===c.primarySkill) s *= Math.pow(Math.max(0.2, st.skillCheckVariety), i+1);
  const themeMatch = c.themeTags?.some(t => st.preferredThemes.includes(t));
  if (!themeMatch) s *= (1 - 0.5 * Math.max(0.2, st.thematicConsistency));
  return Math.max(0.001, s);
}
```

Normalize: `weight_i / sum`, sample with Mulberry32 from `rngState`.

**Worked example with numbers** (Chronicler, after combat-combat, recentHistory.nodeTypes=['combat','combat','lore']):

- Candidate A `{type:'combat', baseWeight:0.8, enemyFamily:'cultist', themeTags:['ambush']}`:
  s = 0.8 * 0.5 * 0.25 = 0.10  // two combat hits in recent
  streak: 0.10 * 0.05 = 0.005
  no theme match: 0.005 * (1 - 0.5*0.85) = 0.005 * 0.575 = 0.00287
  -> 0.00287
- Candidate B `{type:'dialog', baseWeight:0.6, themeTags:['lore','investigation']}`:
  s = 0.6, no nodeType hit (only combat/lore in history, dialog absent), theme match -> 0.6
  -> 0.6
- Candidate C `{type:'lore', baseWeight:0.7, themeTags:['lore']}`:
  s = 0.7 * 0.5 = 0.35  // one lore in recent
  theme match -> 0.35
  -> 0.35
- Fallback (travel beat): 0.01

Sum = 0.96187. Probabilities: A 0.3%, B 62%, C 36%, Fallback 1%. Director almost certainly picks dialog -- correct given two combats just happened.

### 7.3 Recent-history ringbuffer

```js
gs.story.recentHistory = {
  nodeTypes: [],      // max length 10, push to front
  enemyFamilies: [],  // max length 10
  skillLabels: [],    // max length 10
  rewardTypes: [],    // max length 10
  biomes: [],         // max length 5
  tones: [],          // max length 8
  sameTypeStreak: 0,
  lastType: null,
};
```

API (`storyDirector.recordTick(gs, nodeOutcome)`):
- Push `nodeOutcome.type` to front of `nodeTypes`; trim to 10.
- If `nodeOutcome.type === lastType`: `sameTypeStreak++`, else `sameTypeStreak = 1; lastType = nodeOutcome.type`.
- Push enemyFamily/skillLabel/reward/biome/tone analogously.

### 7.4 Pressure meter

`gs.story.pressureMeter` 0..100. Defaults 50.

Increase triggers (clamped):
- Brutal fight (brutalScore >= 1): +12
- Major faction loss (rep drop >= 3): +8
- Hidden path locked permanently: +5
- Companion at approval <= -5: +6
- Quest failed: +10
- World-mutation 'darkening': +8

Decrease triggers:
- Rest node visit: -10
- Shrine purified: -8
- Quest phase completed: -4
- Companion at approval >= +7: -3 (one-shot per companion per act)

Bands:
- 0-29 "Calm": Director +30% weight on dialog/lore/merchant candidates.
- 30-59 "Tense": no adjustment.
- 60-79 "Urgent": +25% weight on combat; -25% weight on shrines/rest.
- 80-100 "Crisis": forces a `crisis_event` candidate within 3 nodes (boss adds, faction ambush, named NPC death event).

### 7.5 Storyteller unique mechanics (spec each)

| id | Mechanic | Spec |
|---|---|---|
| chronicler  | `narrative_coherence_bonus` | After 3 consecutive nodes sharing >=1 `themeTag`, next candidate gets `+50%` to its softScore if it shares the theme. |
| ash_prophet | `dark_omen_interrupt`       | Every 8-12 director ticks (uniform random), forces a candidate from `data/story/dark-omen-pool.json` regardless of soft score; that candidate sets a negative flag, increments pressure by +10. |
| warbringer  | `momentum_escalation`       | Counter `story.counters.winStreak`. After each combat win, += encounter `budgetBonus` of `min(0.5, 0.1 * streak)`. Reset on rest or loss. |
| trickster   | `every_6th_random`          | Tick counter; every 6th decision skips soft scoring and picks uniformly from the unfiltered eligible set. |
| pilgrim     | `discovery_pool_3x`         | `lore` and `hidden` candidates have `baseWeight *= 3` after filtering; rest events grant +10% extra HP heal. |
| iron_judge  | `no_fallback_ambush_instead`| `rules.fallbackAllowed=false`; if filter empty, synthesize ambush; brutal-fight does NOT force rest. |

### 7.6 Director debug API

```js
// src/story/storyDirector.js
export function getDirectorIntent(gs, opts = {})    -> { intent, candidates, rngStateBefore, rngStateAfter }
export function stepDirector(gs)                    -> Intent     // calls recordTick, returns next intent, persists rngState
export function inspectCandidates(gs)               -> Array<{ id, baseWeight, scoreBeforeNorm, scoreAfterNorm, prob }>
export function forceIntent(gs, intentObj)          -> void        // debug; bypasses scoring
```

`story-inspector.html` calls these via a tiny IIFE that imports the module fresh per click.

---

## 8. Encounter / enemy / boss configurator

### 8.1 Encounter template JSON shape

```json
{
  "id": "road_ash_cult_ambush",
  "act": 1,
  "biomes": ["emberwood","old_road"],
  "themeTags": ["ambush","cult","road"],
  "type": "combat",
  "primaryRole": "frontline",
  "enemyComposition": [
    { "role": "frontline", "count": 2, "family": "cultist" },
    { "role": "caster",    "count": 1, "family": "cultist" }
  ],
  "budgetWeight": 1.0,
  "baseWeight": 0.7,
  "rewards": { "goldRange": [40,80], "lootTier": 2 },
  "preDialog": "pool:ambush#ambush_road_cult_001",
  "weatherCompatible": ["all"]
}
```

### 8.2 Role-to-family resolver (full code)

```js
// src/story/storyEncounterBuilder.js
import { ENCOUNTERS, ENEMIES } from '../maps/mapData.js';

const ROLE_FAMILY_INDEX = (() => {
  const idx = new Map();
  for (const eid of Object.keys(ENEMIES)) {
    const e = ENEMIES[eid];
    const role = e.role || _inferRole(e);
    const fam  = e.family || 'generic';
    const key  = `${role}::${fam}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(eid);
  }
  return idx;
})();

function _inferRole(e) {
  if ((e.armor || 0) > 8) return 'frontline';
  if ((e.spells || []).length) return 'caster';
  if ((e.dmg && e.dmg[1] > 20)) return 'striker';
  return 'frontline';
}

export function resolveEnemyId(role, family, act, rng) {
  const key = `${role}::${family}`;
  const pool = ROLE_FAMILY_INDEX.get(key) || ROLE_FAMILY_INDEX.get(`${role}::generic`) || [];
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}
```

### 8.3 Enemy instance modifier composition

**Decision: extend, do not parallel-track.** The instance modifier layer routes through `championModifiers.js` + `affixes.js`:

```js
// src/story/storyEnemyInstance.js
import { applyChampionModifier } from '../game/championModifiers.js';
import { applyAffix } from '../game/affixes.js';

export function buildEnemyInstance(baseEnemyId, modifier, act, rng) {
  let inst = { id: baseEnemyId, count: 1, ...JSON.parse(JSON.stringify(ENEMIES[baseEnemyId])) };
  if (modifier.affixes) for (const a of modifier.affixes) inst = applyAffix(inst, a);
  if (modifier.championTier) inst = applyChampionModifier(inst, modifier.championTier);
  if (modifier.statMultipliers) {
    for (const k of Object.keys(modifier.statMultipliers)) {
      if (inst[k] != null) inst[k] = Math.round((Array.isArray(inst[k]) ? inst[k][0] : inst[k]) * modifier.statMultipliers[k]);
    }
  }
  if (modifier.addSkills) inst.spells = [...(inst.spells || []), ...modifier.addSkills];
  if (modifier.addTags) inst.tags = [...(inst.tags || []), ...modifier.addTags];
  if (modifier.statusOnStart) inst.statusOnStart = modifier.statusOnStart;
  if (modifier.nameOverride) inst.name = modifier.nameOverride;
  return inst;
}
```

The result is fed directly into `runSimulation({ encounter: { enemies: [inst, ...] } })`. **Byte parity**: the flat enemy object has the same shape `runSimulation` reads today via `encounterToCombatants`.

### 8.4 Boss variant system (extends `bossPhases.js`)

**Decision: extend, do not parallel-track.** A boss variant is a JSON entry that **patches** the base boss's `bossPhases` entry at runtime:

```json
{
  "bossId": "corrupted_guardian",
  "variants": [
    { "id": "redeemed",
      "condition": { "all": [{ "flag": "shrine_purified" }, { "companion": "yasha_stonewill", "active": true }] },
      "phases": [ { "threshold": 0.5, "addStatusOnAlly": { "type": "blessed", "duration": 3 } } ],
      "nameOverride": "Awakened Guardian",
      "statMultipliers": { "armor": 0.7 }
    }
  ]
}
```

`storyBossVariants.resolveVariant(gs, bossId)` returns the matched variant or `null`. Resolution runs **before** combat:
1. `storyEncounterBuilder.buildBossEncounter(gs, bossId)` builds the base encounter.
2. If a variant matches, `buildEnemyInstance` applies `statMultipliers`, `nameOverride`.
3. `bossPhases.js` is patched at module load via `registerVariantPhases(bossId, variant.phases)` -- one function added to `bossPhases.js` that merges variant phases on top by threshold. No fork.

### 8.5 Budget formula (4 scaling guardrails)

```js
function encounterBudget(gs, candidate, storyteller) {
  const partyAvgLevel = avg(gs.party.map(m => m.level));
  let base = candidate.budgetWeight * (10 * partyAvgLevel + 5 * gs.story.act);

  // Guardrail 1: post-brutal-fight de-escalation
  if (gs.story.recentPerformance?.brutalScore >= 1) base *= 0.8;

  // Guardrail 2: pressure meter
  if (gs.story.pressureMeter >= 80) base *= 1.2;
  else if (gs.story.pressureMeter <= 30) base *= 0.9;

  // Guardrail 3: storyteller momentum (Warbringer's mechanic)
  if (storyteller.uniqueMechanic === 'momentum_escalation') {
    base *= 1 + Math.min(0.5, 0.1 * (gs.story.counters.winStreak || 0));
  }

  // Guardrail 4: difficulty preset
  base *= DIFFICULTY_PRESETS[gs.story.difficulty].budgetMult;

  return Math.round(base);
}
```

`DIFFICULTY_PRESETS = { relaxed: { budgetMult: 0.75 }, normal: { budgetMult: 1.0 }, hard: { budgetMult: 1.25 }, nightmare: { budgetMult: 1.5 } }`

---

## 9. Companion system (full)

### 9.1 Roster (6 named companions)

Per Brainstorm §7 table. Verbatim list:

| id | Name | Class | Recruit act | Personality | Mechanic | Personal-quest id |
|---|---|---|---|---|---|---|
| `lyra_ashwalker`   | Lyra Ashwalker  | Ranger  | 1 | Pragmatic | Hidden-node scout reveal | `companion_lyra_personal` |
| `orren_gravetide`  | Orren Gravetide | Warrior | 1 | Honor     | +2 STR-check (intimidation) | `companion_orren_personal` |
| `tessaly_veil`     | Tessaly Veil    | Rogue   | 2 | Chaotic   | Unlocks stealth dialog ch.  | `companion_tessaly_personal` |
| `bram_coldfire`    | Bram Coldfire   | Mage    | 2 | Curious   | +2 INT-check (arcana)       | `companion_bram_personal` |
| `yasha_stonewill`  | Yasha Stonewill | Monk    | 2 | Stoic     | +2 CON-check (survival)     | `companion_yasha_personal` |
| `captain_maer`     | Captain Maer    | Warrior | 1 | Duty      | Faction gateway / Emberguard| `companion_maer_personal` |

### 9.2 Approval meter

`story.companions[i].approval` int in -10..+10, start 0. Thresholds: `<=-5` hostile (some choices vanish; confrontation triggers if `<=-7`), `-4..+4` neutral, `>=+5` friendly (personal quest unlocks), `+10` devoted (one passive combat ability active).

Approval deltas come from the dialog effect `{ type: 'companion_approval', companion, amount }`. Active companion: full delta. Recruited but inactive (benched): half delta.

### 9.3 Personal quest hooks

Each companion has exactly one reserved personal-quest id (table above). The quest's `startCondition` is `{ companion: <id>, approval: { gte: 3 } }`. Stored in `data/story/quest-lines/companion_<id>_personal.json`.

### 9.4 Relationship-gated dialog (predicate)

Authored shape:
```json
{ "requires": { "companion": "orren_gravetide", "active": true, "approval": { "gte": 5 } } }
```
Predicate is evaluated by `evalPredicate` (§3) -- already handled by the `companion` op.

### 9.5 Banter scheduler

Per §5.6. Pair pool: any pair `(a, b)` where `a` is `activeCompanionId` and `b` is recruited (active or benched). Globally cooldown: `story.lastBanterNode` -- next banter requires >= 3 nodes elapsed. Per-banter cooldown: each banter entry tracks `lastFired` in `gs.story.counters['banter_'+entryId]`.

### 9.6 Recruit / dismiss / death state

```js
gs.story.companions = [
  { id, recruited: bool, active: bool, approval: int, alive: bool,
    benchedAt: nodeId|null, personalQuestStarted: bool, lastBanterNode: nodeId|null }
];
gs.story.activeCompanionId = string|null;
```

- **Recruit**: effect `recruit_companion` sets `recruited=true`, `active=true`, swaps as active.
- **Dismiss**: effect `dismiss_companion` sets `active=false`, `benchedAt=currentNodeId`. Re-recruit at the same node costs `companion_approval: -2`.
- **Death (v1)**: not enabled (Hardcore forced off for Story v1). Approval `<=-7` triggers a confrontation event with one persuasion choice; failure -> `recruited=false`, permanent.

### 9.7 Party slot integration

**Decision: 5th slot, swappable at waypoints (chosen).**

- The existing `gs.party[]` holds the 4 player-built heroes.
- The active story companion is the **5th** combatant. `simulator.runSimulation` already accepts an array of heroes; passing 5 is supported (per `_heroCount` derivation that filters companions via `isCompanion` flag).
- `storyMode.assembleCombatParty(gs)` returns `[...gs.party, ...storyCompanionAsHeroMember(gs)]` where the story companion is marked `isCompanion: true, _storyCompanion: true`.
- Swap UI: at any `waypoint=activated` node, the bottom-drawer shows a "Companions" tab where the player picks among recruited companions to become active. Free action.
- Tavern-hired `gs.companions[]` is unchanged -- those continue to exist for Classic Mode. In Story Mode, the tavern is disabled; companions are story-recruited only.

---

## 10. Campaign simulator (first-class, byte-parity)

### 10.1 `runCampaign` API

```js
// sim/story/runCampaign.js
export async function runCampaign({
  seed, storyteller, difficulty,
  policy,
  partyTemplate,        // { class, level, equipment, attrs } x 4
  maxNodes = 250,
  recordCombatLogs = false,
}) -> CampaignResult
```

**Byte-parity guarantee**: every combat node calls the **exact** `runSimulation` from `src/game/simulator.js` (re-exported, not reimplemented). The encounter object passed is byte-identical to what the live game would build via `storyEncounterBuilder.buildEncounterForNode`. Hero combatants are built via `heroToCombatant` (the live function). No combat approximation.

### 10.2 Policy interface

```js
const policy = {
  chooseNode(map, currentNodeId, history) -> nodeId,
  chooseDialog(choices, context) -> choiceId,
  chooseSkillCheckApproach(check, party) -> approachId,
  decideRetreat(combatPreview, party) -> bool,
  decideCompanionSwap(currentActive, recruited, atWaypoint) -> companionId|null,
};
```

Provided policies:
- `sim/story/policies/greedy.js` -- maximize gold/items
- `sim/story/policies/explorer.js` -- maximize hidden-path reveals
- `sim/story/policies/combatHeavy.js` -- prefer combat nodes
- `sim/story/policies/storyFirst.js` -- prefer dialog/quest progression
- `sim/story/policies/random.js` -- uniform random valid choice

### 10.3 Byte-parity contract

Determinism rules:
1. Top-level `mulberry32(seed)` generates the campaign-level RNG.
2. Map generation gets a child RNG: `mulberry32(seed ^ 0xDEADBEEF)` -- same as live.
3. Each combat gets a per-node child seed: `nodeId_hash ^ rngState` -- same as live.
4. Encounter object construction calls the same `storyEncounterBuilder.buildEncounterForNode(gs, nodeId)` the live game calls.
5. Hero combatant construction calls the same `heroToCombatant` the live game calls.
6. `runSimulation` is the same imported function -- no shadow copy.

CI test: `sim/story/__tests__/byteParity.test.js`:
```js
test('runCampaign combat output byte-equals live encounter', () => {
  const gsLive = synthesizeLiveGs(seed=42);
  const liveResult = runSimulation({ heroes: liveHeroes, encounter: liveEnc, act: 1, seed: 999 });
  const campResult = runCampaign({ seed: 42, storyteller: 'chronicler', difficulty: 'normal', policy: deterministicPolicy, maxNodes: 1 });
  expect(campResult.log[0].combatResult).toEqual(liveResult); // deep equal
});
```

### 10.4 Campaign log entry shape

```js
{
  nodeIdx: 0,
  nodeId: 'a1_n_007',
  nodeType: 'combat',
  biome: 'emberwood',
  regionId: 'emberwood',
  directorIntent: { type: 'combat', primaryRole: 'frontline', themeTags: [...] },
  candidates: [{ id, baseWeight, scoreAfterNorm, prob }, ...],
  encounterTemplate: 'road_ash_cult_ambush',
  encounterInstance: { enemies: [...] },
  combatResult: <runSimulation return object | null>,
  dialogNodeId: 'arrival_brightfall_002' | null,
  dialogChoiceId: 'choice_diplomatic' | null,
  skillLabel: 'Intimidation' | null,
  skillDC: 12 | null,
  skillResult: 'pass'|'fail'|'partial' | null,
  effects: [{ type, ... }],
  flagsSet: ['cultist_road_cleared'],
  flagsCleared: [],
  questsAdvanced: [{ questId, fromPhase, toPhase }],
  questsCompleted: [{ questId, outcomeId }],
  companionApprovalDeltas: { lyra_ashwalker: 1 },
  goldDelta: +45, xpAwarded: 120,
  hpBefore: { p0: 145, ... }, hpAfter: { p0: 110, ... },
  deathsThisFight: 0,
  rngStateBefore: 1234567, rngStateAfter: 7654321,
  pressureBefore: 50, pressureAfter: 48,
  wallMs: 14,
}
```

### 10.5 Summary report

```js
{
  seed, saltOffset, storytellerId, difficulty, policy: <name>,
  outcome: 'act3_complete'|'dead'|'abandoned'|'timeout',
  actsCompleted: 3,
  nodesVisited: 87,
  nodeTypeBreakdown: { combat: 32, dialog: 18, ... },
  combatWinRate: 0.94,
  totalDeaths: 2,
  goldFinal: 2340,
  gearScoreFinal: 48,
  questsCompleted: { primary: 3, secondary: 4, side: 7 },
  flagsSet: [...],
  factionsFinal: { emberguard: 4, ashen_veil: -6, ancient_pact: 2 },
  companionApprovalFinal: { lyra_ashwalker: 6, ... },
  varietyMetrics: {
    uniqueNodeTypes: 7, uniqueBiomes: 5, uniqueEnemyFamilies: 9, uniqueSkillLabels: 12,
    avgSameTypeStreak: 1.4, maxSameTypeStreak: 3,
  },
  durationMs: 4280,
  log: [ ...entries ]   // omitted when recordCombatLogs=false (still records non-combat entries)
}
```

### 10.6 Harness file layout

```
sim/story/
  runCampaign.js           -- the main loop
  buildSyntheticGs.js      -- synthesizes a gs from partyTemplate (no localStorage)
  policies/
    greedy.js
    explorer.js
    combatHeavy.js
    storyFirst.js
    random.js
    deterministic.js       -- always pick first option (for byte-parity tests)
  cli.js                   -- node CLI: `node sim/story/cli.js --seeds 100 --storyteller chronicler --difficulty normal --policy greedy --out reports/M###.json`
  __tests__/
    byteParity.test.js
    determinism.test.js
    varietyMetrics.test.js
```

### 10.7 `sim/runloop.js` evolution

**Decision: keep `sim/runloop.js` for Classic-mode regression; the new file is `sim/story/runCampaign.js`.** Rationale: `runloop.js` is 84 lines, runs Classic act 1-6 boss sequences for combat-balance regression -- different domain. They live side-by-side.

Renaming `runloop.js` would mean changing every place that consumes its outputs (e.g. `balance-report.html`, `damage-report.html`, `scripts/balance-report.mjs`). Not worth it.

### 10.8 Test asserts (2400 sim runs in CI)

100 seeds × 6 storytellers × 4 difficulties = 2400 runs. CI job:

```
M-S29 ships scripts/build-storyteller-balance.cjs which runs the matrix via sim/story/cli.js
       and writes public/assets/data/story/balance/M<N>.json.
```

Threshold checks (`scripts/check-storyteller-balance.mjs` -- runs in `release.sh` test step):

| Metric | Threshold |
|---|---|
| Act-1 completion rate, Relaxed | >=98% across all storytellers |
| Act-1 completion rate, Normal  | >=90% |
| Act-3 completion rate, Normal  | >=60% |
| Total deaths/run, Relaxed      | mean == 0 |
| `uniqueNodeTypes` per run      | >=6 mean |
| `maxSameTypeStreak`            | <=4 mean across runs |
| Iron Judge act-3 completion    | 30-70% (intentional brutality band) |
| No infinite loop               | every run terminates within `maxNodes` |
| No throw                       | 0 sims throw |

### 10.9 Performance target

`<=5s per campaign sim` measured on dev laptop (Node 20, single thread). Means 2400 runs in `2400 * 5 / N_workers` -- with `N_workers=8` (worker_threads), `~25 minutes`. Acceptable for nightly CI; **NOT** acceptable for per-commit CI. Per-commit CI runs a smoke matrix (1 seed × 6 storytellers × 1 difficulty = 6 runs, ~30s).

`build-storyteller-balance.cjs` invokes worker pool via `worker_threads`. Each worker imports `runCampaign` and consumes a job queue of `{ seed, storyteller, difficulty, policy }` tuples.

---

## 11. Content pipeline

### 11.1 Seed-template files (per category, hand-authored)

| File | Count | Shape |
|---|---|---|
| `data/story/dialogue-pools/arrival.json`   | 12 | `{ nodes: [...] }` |
| `data/story/dialogue-pools/ambush.json`    | 15 | "" |
| `data/story/dialogue-pools/shrine.json`    | 10 | "" |
| `data/story/dialogue-pools/merchant.json`  | 10 | "" |
| `data/story/dialogue-pools/lore.json`      | 20 | "" |
| `data/story/dialogue-pools/faction.json`   | 15 | "" |
| `data/story/dialogue-pools/companion-<id>.json` | 10×6 | "" |
| `data/story/dialogue-pools/side-quest.json`| 20 | "" |

Node shape:
```json
{ "id": "arrival_brightfall_001",
  "pool": "arrival",
  "act": 1, "biome": "emberwood", "tone": "urgent",
  "speaker": "captain_maer",
  "lines": ["The gate is shut, traveler.", "State your business."],
  "choices": [
    { "id": "diplomatic",
      "text": "[Persuasion - INT] Reason with him.",
      "requires": { "stat": "INT", "gte": 11 },
      "skillCheck": { "skill": "Persuasion", "stat": "INT", "dc": 12, "scaling": "act_level" },
      "onPass": { "next": "#after_pass", "effects": [{ "type": "set_flag", "flag": "gate_opened_peacefully" }] },
      "onFail": { "next": "#after_fail", "effects": [{ "type": "faction_delta", "faction": "emberguard", "amount": -1 }] }
    },
    { "id": "intimidate",
      "text": "[Intimidation - STR] Step forward.",
      "skillCheck": { "skill": "Intimidation", "stat": "STR", "dc": 13 },
      "onPass": { "effects": [{ "type": "set_flag", "flag": "gate_intimidated" }] },
      "onFail": { "next": "pool:ambush#ambush_brightfall_guard_001" }
    },
    { "id": "leave", "text": "Leave.", "next": null, "effects": [] }
  ],
  "nodes": { "after_pass": { ... }, "after_fail": { ... } }
}
```

### 11.2 `generate-story-dialogue.cjs` structure

```js
// scripts/generate-story-dialogue.cjs (outline)
const FS = require('fs'), PATH = require('path');
const { OpenAI } = require('openai');

async function main() {
  const lorePrimer = FS.readFileSync('data/story/lore-primer.md', 'utf8');
  const flags      = JSON.parse(FS.readFileSync('data/story/canonical-flags.json'));
  const factions   = JSON.parse(FS.readFileSync('data/story/canonical-factions.json'));
  const skills     = JSON.parse(FS.readFileSync('data/story/canonical-skills.json'));
  const npcs       = JSON.parse(FS.readFileSync('data/story/npcs.json'));
  const items      = JSON.parse(FS.readFileSync('public/assets/data/items.json'));
  const seedDir    = 'data/story/dialogue-pools/';
  const outDir     = 'data/story/_generated/';

  for (const pool of ['arrival','ambush','shrine','merchant','lore','faction','side-quest']) {
    const seeds = JSON.parse(FS.readFileSync(seedDir + pool + '.json'));
    const styleGuide = seeds.nodes.slice(0,3); // first 3 hand-authored seeds = few-shot
    const batchRequests = [];
    for (let i = 0; i < 10; i++) {  // 10 batches per pool
      batchRequests.push(makeBatchRequest({ pool, act: pickAct(i), biome: pickBiome(i), tone: pickTone(i),
        lorePrimer, flags, factions, skills, npcs, items, styleGuide, count: 5 }));
    }
    // Submit OpenAI Batch API (async; results poll on 24h window).
    const result = await submitBatch(batchRequests, pool);
    FS.writeFileSync(outDir + pool + '_' + Date.now() + '.json', JSON.stringify(result, null, 2));
  }
}

function makeBatchRequest(opts) {
  return {
    custom_id: `${opts.pool}_${opts.act}_${opts.biome}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    method: 'POST', url: '/v1/chat/completions',
    body: {
      model: 'gpt-4o-mini',
      response_format: { type: 'json_schema', json_schema: { name: 'dialog_nodes', strict: true, schema: DIALOG_NODE_SCHEMA } },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(opts) },
        { role: 'user',   content: USER_PROMPT(opts) }
      ],
    }
  };
}
```

System prompt skeleton (`SYSTEM_PROMPT(opts)`):
```
You are an Emberveil dialog writer. Voice: clipped, slightly mock-grim, occasionally self-aware...
[full lore primer]
Canonical flags you MUST use (do not invent): [flagsList]
Canonical factions: [factionsList]
Canonical skills: [skillsList]
Canonical NPCs: [npcsList]
Canonical items: [itemsList]
Style examples (write LIKE these): [3 seed nodes]
Output schema: see json_schema. Every choice.next must be null, '#localId', or 'pool:<name>#<id>'.
Every flag in set_flag/clear_flag MUST be from the canonical list.
```

### 11.3 Lore primer (`data/story/lore-primer.md`)

Length target: 3000-5000 tokens. Contents:
- The 3-act structure (1-page summary).
- Faction descriptions (8 factions × 100-200 words each).
- Named NPC descriptions (20 NPCs × 50-100 words each).
- Tone guide (5 do-this examples, 5 do-NOT-this examples).
- World glossary (Emberveil, Ashen Veil, veilfire, veil-touched, etc.; 30-50 terms).
- Canonical flag glossary (~200 ids with 1-line narrative meanings).

### 11.4 Canonical registry build

`scripts/extract-story-canonical.mjs` reads:
- `data/story/quest-lines/*.json` -- extracts every `flag` referenced -> `canonical-flags.json`.
- `data/story/dialogue-pools/*.json` (hand-authored seeds) -- same.
- `data/story/storytellers/*.json` -- extracts faction ids -> `canonical-factions.json`.
- `public/data/entities/npcs.json` + the 20-npc story roster -> `canonical-npcs.json`.

Validator (`build-story-content-manifest.cjs`) then enforces: every reference in any data/story file resolves to a canonical entry.

### 11.5 v1 content counts (explicit)

| Category | Hand-authored seeds | LLM-gen | Total v1 |
|---|---|---|---|
| Dialog nodes | 162 | ~400 | ~562 |
| Encounter templates | 60 | 0 | 60 |
| Side-quest templates | 20 | 0 | 20 |
| Primary quest lines | 3 | 0 | 3 |
| Secondary quest lines | 6 | 0 | 6 |
| Personal companion quests | 6 | 0 | 6 |
| Named NPCs | 20 | 0 | 20 |
| Faction definitions | 8 | 0 | 8 |
| Lore fragments | 50 | 50 | 100 |
| Storyteller profiles | 6 | 0 | 6 |
| Banter entries | 80 (across 15 pairs) | 0 | 80 |

Note: 200 encounters / 20 NPCs / 20 enemy-boss sprites (per user content budget) maps to **60 encounter templates** that **instance** into 200 distinct in-game encounters (templates × instance modifiers via §8.3 give the 200-encounter content footprint). 20 NPCs and 20 enemy/boss sprites are 1:1 with the canonical lists.

### 11.6 Schema validation in CI

`release.sh` test step (`npm test`) runs vitest which includes `src/story/__tests__/contentManifest.test.js`. That test invokes `build-story-content-manifest.cjs --dry-run`. Any failure (orphan next, unknown flag/faction/biome/skill/stat/NPC/item) fails CI -> release blocked.

---

## 12. Sprite pipeline

### 12.1 20 NPCs (final list, archetype)

(Verbatim Brainstorm §11; restated here as the build contract.)

| id | archetype | spell-color | equipment hint |
|---|---|---|---|
| captain_maer | humanoid/warrior | n/a | heavy armor, visor helmet |
| lyra_ashwalker | humanoid/ranger | n/a | fur-lined cloak, scarred |
| orren_gravetide | humanoid/warrior | n/a | cracked pauldrons |
| tessaly_veil | humanoid/rogue | green poison | twin knives, face-wrap |
| bram_coldfire | humanoid/mage | purple shadow | ink-stained robes, spectacles |
| yasha_stonewill | humanoid/monk | yellow heal | stone wraps |
| ash_prophet_npc | humanoid/caster | red ember | ash-dusted robes |
| veil_shrinekeeper | humanoid/priest | yellow heal | partial face veil |
| elderwood_hermit | humanoid/elder | n/a | bark robes, lantern |
| ashen_veil_herald | humanoid/caster | purple shadow | ash mask |
| brightfall_innkeeper | humanoid/civilian | n/a | apron |
| road_scout_npc | humanoid/ranger | n/a | travel-worn |
| bone_reader | humanoid/elder | yellow heal | bone jewelry |
| faction_envoy_thornpact | humanoid/rogue | green poison | leaf cloak |
| veil_convert | humanoid/civilian | n/a | cult brand |
| swamp_guide | humanoid/ranger | n/a | swamp-stained |
| merchant_unusual | humanoid/civilian | n/a | layered coats |
| rift_warden | humanoid/warrior | n/a | veil-branded armor |
| ancient_guardian_npc | elemental/construct | red ember | ember-glow stone |
| marek_greel_story | humanoid/scholar | purple shadow | one veil-lit eye |

### 12.2 20 Enemies/Bosses

| id | family | archetype |
|---|---|---|
| ash_cultist | cultist | humanoid/warrior |
| ash_ritualist | cultist | humanoid/caster |
| veil_sprite | veilspawn | elemental |
| corpse_lantern | undead | construct/undead |
| bog_witch | beast/caster | humanoid/caster |
| stonehide_boar | beast | beast/quadruped |
| storm_harpy | beast | beast/avian |
| ember_drake_small | dragon | beast/reptile |
| veil_shade | veilspawn | elemental |
| ash_golem | construct | construct |
| cultist_captain | cultist/elite | humanoid/warrior |
| drowned_soldier | undead | humanoid/warrior |
| bone_revenant | undead/elite | humanoid/undead |
| veil_hulk | veilspawn/elite | elemental/construct |
| corrupted_guardian | boss/act1 | construct/boss |
| plague_herald | boss/optional | humanoid/boss |
| veil_champion | boss/act2 | humanoid/boss |
| den_mother_ash | beast/boss | beast/boss |
| architect_fragment | boss/optional | construct/boss |
| emberveil_sovereign_story | boss/act3 | construct/elemental/boss |

### 12.3 Batch script invocations

All sprites use `scripts/openai-spritesheet-gen.py` (the existing M463 9-pose 3×3 grid workflow). Wrapper scripts:

```bash
# scripts/generate-story-npc-sprites.cjs
node -e "
['captain_maer','lyra_ashwalker',...20 ids].forEach(id => {
  spawn('python', ['scripts/openai-spritesheet-gen.py', '--id', id, '--profile', 'humanoid', '--enroll-review-batch'])
});
"

# scripts/generate-story-enemy-sprites.cjs -- analogous
```

Each invocation:
1. Generates 9-pose sheet via OpenAI.
2. Chroma-keys + despills + slices to 256px frames.
3. Writes to `public/images/openai_v2/<id>_<pose>.png`.
4. Backs up prior to `_pre_openai/`.
5. Archives raw 1024×1024 to `public/assets/openai_v2/raw/<id>/<date>_raw.png`.
6. **Enrolls in open image-review-v2 batch** (M462 rule -- non-negotiable per `SITE_OVERVIEW.md` §10).

### 12.4 Approval flow

User reviews on `/assets/image-review-v2.html`, copies IDs, runs `node scripts/approve-image-review-v2.cjs <ids...>`. No story sprite goes live without approval. The 40 sprites form one batch (`image_review_batches/m<storyShipMilestone>.json`).

---

## 13. Mobile UX spec

### 13.1 StoryMapScreen pixel layout (393×852)

```
[ iOS Dynamic Island region (safe top) ........... 47 pt ]
[ Top bar (sticky) ................................. 48 pt ]
  - ◀ Back (44×44 hit, 24×24 visual)
  - Title: 'Act 1 - Emberwood' (17px / 600)
  - ☰ Menu (44×44 hit)
[ Pressure chip (collapsible, default collapsed) .. 28 pt ]
  - Storyteller name + Pressure pips
  - 12px / 500, faded chip background
[ Sub-region tab strip ............................ 36 pt ]
  - 5 tabs, swipeable, horizontal-scrolling if overflow
  - active tab: biome color underline + bold
[ Map canvas ..................................... 484 pt ]
  - Horizontal pan within sub-region
  - Edge swipe (>= 60 px past pan limit) paginates to neighbor region
  - Nodes: 32 px visual / 48 px hit / 56 px min spacing
  - 3 lanes (y = 0.2, 0.5, 0.8), max ~21 nodes visible per region
[ Node detail drawer (peek state) ................. 96 pt ]
  - Node name + biome icon (left)
  - Danger pips + 'likely: combat' tag
  - [ Travel ] [ Fast Travel? ] buttons (44 pt tall)
  - Swipe up to expand to 360 pt
[ Bottom action bar (sticky) ...................... 64 pt ]
  - [Party] [Inventory] [Quests] [Rest]
[ iOS home indicator safe area ................... 34 pt ]
                                                  -------
                                                  837 / 852 (15 pt slack)
```

### 13.2 Sub-region pagination gesture

- Horizontal pan recognizer (already in `MapScreen.js`).
- Pan threshold to commit: 8 px movement before tap is suppressed.
- Edge bumper: when pan reaches the end of the current sub-region's content width, an additional 60 px of "rubber-band" pan is allowed. If finger releases while in the rubber-band zone with positive velocity, paginate to next region with a 200 ms slide animation.
- Sub-region tab tap: jumps directly with a 150 ms fade.
- Page indicator dots above the tab strip: 5 dots, current highlighted.

### 13.3 Node geometry (confirmed)

- Visual: 32 px diameter.
- Hit: 48 px diameter (8 px transparent halo).
- Min center-to-center: 56 px horizontal / 48 px vertical.
- Path stroke: 2 px solid (open), 2 px dashed (revealed-hidden), no draw (undiscovered-hidden).
- Selected node ring: +2 px golden glow.

### 13.4 StoryNewGameScreen layout

Stacked vertically (portrait):
```
[ Top bar: 'New Story Mode Game' + ◀ Back ]
[ Mode picker (Classic | Story) -- 48 pt segmented ]
[ Storyteller card carousel -- swipe left/right ]
   - One card per storyteller, 280×360 px
   - Portrait + name + 1-sentence bio
[ Difficulty: Relaxed | Normal | Hard | Nightmare ]   <- 4-button row, 48 pt
[ Thematic consistency: Loose | Balanced | Strict ]   <- 3-button row
[ Side event frequency: Low | Normal | High | Wild ]  <- 4-button row
[ Combat density: Low | Normal | High ]               <- 3-button row
[ Story pressure: Low | Normal | High ]               <- 3-button row
[ Party preview (uses CharacterBuilderScreen behind a button) ]
[ Start Story ] (full-width 56 pt button)
```

### 13.5 StoryDialogScreen reuse

Extends `DialogScreen` (992 lines, unchanged). Subclass overrides 3 methods (§5.5). Renders effect previews as 200 ms slide-in chips above the choice bar.

### 13.6 StoryJournalScreen tabs

```
[ Top bar: 'Journal' + ◀ Back ]
[ Tab strip: Quests | Factions | Companions | Lore | Ledger ]   <- 40 pt
[ Content scroll area: ~700 pt ]
```

Each tab uses the existing list-row pattern from `QuestLogScreen.js` (rows 64 pt tall, scrollable).

### 13.7 Performance budget

- 60 FPS sustained.
- Map repaint <=8 ms/frame on iPhone 14 Pro Safari at DPR=3.
- If frame time >12 ms for >5 consecutive frames, drop waypoint pulse animations (set `gs.story._dropPulses = true`).
- Cold start (Story Mode New Game tap -> map first paint): <=1.5 s.

---

## 14. Authoring tools

### 14.1 `story-inspector.html`

Panels:
- **Save loader**: file picker OR `<select>` of localStorage slots that match `emberveil_save_story_*`.
- **Map view**: renders `gs.story.maps[currentMapId]` using a shared module `src/story/storyMapRendererShared.js` that the in-game `StoryMapScreen` also uses (so the tool's render matches the game's).
- **Ledger dump**: collapsible JSON tree (flags, factions, quests, counters, companions, recentHistory).
- **Director step**: button `Step Director` invokes `getDirectorIntent(gs)` and shows top-10 candidates with `baseWeight, scoreBeforeNorm, scoreAfterNorm, prob`.
- **Flag editor**: text field + Set/Clear; auto-triggers `tickQuestConditions(gs)` after.
- **Export**: `Download save` button serializes modified gs to JSON.

### 14.2 `quest-graph.html`

Renders each quest line from `data/story/quest-lines/*.json` as a DAG:
- Phase nodes (rectangles, gray).
- Phase transitions (arrows, with label = `completeCondition` predicate rendered as a human string by `predicateToHuman()`).
- Outcome nodes (terminal: green=complete, gold=branching, red=fail).
- Click a phase -> side panel shows `onComplete` effects.
- Mobile: horizontal scroll the SVG; tap-to-zoom.

Pre-built JSON: `scripts/build-story-content-manifest.cjs` emits `public/assets/data/story/quest-graph.json` per quest -- the tool reads that, not the raw quest files.

### 14.3 `storyteller-balance.html`

- Reads `public/assets/data/story/balance/M*.json` (built by `build-storyteller-balance.cjs`).
- 6×4 grid table (storytellers × difficulties).
- Each cell shows: median acts completed, win rate, median deaths, variety score, median companion approval, factions reached >=+5.
- Line chart of act completion across the 100 runs in each cell.
- **`Run sim` button**: spawns a Web Worker that imports `sim/story/runCampaign.js` via dynamic ESM and runs 100 client-side; results display live.

### 14.4 `story-dialog-review.html`

- Lists dialog nodes from `data/story/_generated/*.json` paginated 20/page.
- Per node: speaker, lines, choices preview, flag-lint warnings.
- Buttons: `Approve` (moves to `dialogue-pools/<pool>.json`), `Reject` (moves to `_rejected/`), `Needs Edit` (flagged), `Regenerate` (queues a fresh OpenAI call).
- State stored in `data/story/dialogue-review-state.json`.
- Approval flow runs `node scripts/approve-story-dialogue.cjs <ids...>` (analogous to `approve-image-review-v2.cjs`).

### 14.5 `story-campaign-sim.html`

- Form: seed (random/manual), storyteller, difficulty, policy, maxNodes.
- `Run` button -> Web Worker invokes `runCampaign`.
- Live log streams to a `<pre>` with line breaks.
- On finish: summary card + downloadable JSON.

---

## 15. Milestone-by-milestone build sequence (the contract)

Milestones M-S01 through M-S30. Each has exit criteria, tests, scope, blockers.

### M-S01: Mode split + Story save schema skeleton (S)
- **Files added**: `src/story/storyMode.js`, `src/story/storyLedger.js`, `src/ui/screens/StoryNewGameScreen.js`.
- **Files touched**: `src/game/gameState.js` (add `gameMode` default + load branch for `saved.gameMode === 'story'`), `src/ui/screens/TitleScreen.js` (new "New Game" routes to `StoryNewGameScreen`), `src/ui/screens/LoadGameScreen.js` (separate Story/Classic slot lists).
- **Exit criteria**: `npm run dev` -> Title -> New Game -> Story Mode picker visible. Picking Story + any storyteller boots a placeholder `StoryMapScreen` showing "Story Mode -- not yet implemented". **Classic saves load identically** (manual smoke: load a pre-existing classic save -> identical behavior; assert via Playwright that act/zone/nodeId fields are preserved).
- **Tests added**:
  - `src/story/__tests__/saveSchema.test.js` -- assert default story-ledger shape; assert `save -> load -> save` round-trips a story save losslessly; assert Classic saves never write `story.*`.
  - `src/story/__tests__/modeRouter.test.js` -- assert `LoadGameScreen` dispatches by `gameMode`.
- **Scope**: M
- **Blocked-by**: -

### M-S02: Story ledger + RNG checkpoint + recentHistory + encounterHistory (M)
- **Files added**: `src/story/storyLedger.js` (complete), `src/story/__tests__/rngCheckpoint.test.js`.
- **Files touched**: `src/game/gameState.js` (call `migrateStorySave` on load).
- **Exit criteria**: `gs.story` round-trips through localStorage. Manual: call `mulberry32(gs.story.rngState)(); GameState.save(); reload(); mulberry32(gs.story.rngState)()` produces identical next value. `tickQuestConditions` is no-op when no quests exist.
- **Tests added**: rngCheckpoint (10 ticks, save mid-stream, reload, assert next 10 ticks identical).
- **Scope**: S
- **Blocked-by**: M-S01

### M-S03: Predicate DSL + content schema validators + CI integration (M)
- **Files added**: `src/story/storyPredicate.js`, `scripts/build-story-content-manifest.cjs`, `scripts/extract-story-canonical.mjs`, `data/story/canonical-flags.json` (stub), `data/story/canonical-factions.json` (stub), `data/story/canonical-skills.json`, `data/story/canonical-biomes.json` (stub).
- **Files touched**: `release.sh` (add manifest-build step before vite build).
- **Exit criteria**: `npm run lint && node scripts/build-story-content-manifest.cjs` returns clean (no orphan refs in stub files). `evalPredicate` passes 30+ unit tests covering all ops.
- **Tests added**: `src/story/__tests__/predicate.test.js` -- 30 unit tests; one per op + composition.
- **Scope**: M
- **Blocked-by**: M-S01

### M-S04: Effect runner + dialog history skeleton (S)
- **Files added**: `src/story/storyEffects.js` (22 effect types), `src/story/__tests__/effects.test.js`.
- **Exit criteria**: All 22 effects pass unit tests against a mock gs. Effects clamp (faction -10..10, corruption 0..100, pressure 0..100, approval -10..10).
- **Tests added**: 22 unit tests, one per effect.
- **Scope**: S
- **Blocked-by**: M-S03

### M-S05: Map graph generator + 6 connectivity validators (M)
- **Files added**: `src/story/storyMapGen.js`, `src/story/storyMapGraph.js`, `src/story/storyMapValidator.js`, `src/story/__tests__/mapGen.test.js`, `data/story/safety-net-acts/act1.json`.
- **Exit criteria**: `generateAct({ seed: 42, act: 1 })` produces a graph passing all 6 validators 99/100 seeds; on the 1/100 it falls back to safety-net. `npm test src/story/__tests__/mapGen.test.js` passes.
- **Tests added**: deterministic seed test (same seed = same graph), validator coverage (each validator catches at least one synthetic broken graph).
- **Scope**: M
- **Blocked-by**: M-S02

### M-S06: StoryMapScreen scaffold with sub-region pagination (M)
- **Files added**: `src/ui/screens/StoryMapScreen.js`, shared module `src/story/storyMapRendererShared.js`.
- **Exit criteria**: Story new-game generates an act-1 map and `StoryMapScreen` renders it. Player can pan, paginate between sub-regions, tap a node to open the peek drawer. No content yet (every node tapped just shows a placeholder). 60 FPS on iPhone 14 Pro target.
- **Tests added**: `e2e/storyMap.spec.js` (Playwright) -- pan, paginate, tap node, drawer opens.
- **Scope**: L
- **Blocked-by**: M-S05

### M-S07: Story map mutations API + waypoint state machine (S)
- **Files added**: `src/story/storyMapMutations.js`, `src/story/__tests__/mapMutations.test.js`.
- **Exit criteria**: `revealPath / blockPath / mutateNode / setWaypointState / unlockTransition` all work and persist through save/load.
- **Scope**: S
- **Blocked-by**: M-S05, M-S02

### M-S08: Campaign simulator harness -- runCampaign + buildSyntheticGs + deterministic policy (M)
- **Files added**: `sim/story/runCampaign.js`, `sim/story/buildSyntheticGs.js`, `sim/story/policies/deterministic.js`, `sim/story/policies/random.js`, `sim/story/__tests__/runCampaignBasic.test.js`.
- **Exit criteria**: `node sim/story/cli.js --seeds 1 --storyteller chronicler --difficulty normal --policy deterministic --maxNodes 5` returns a CampaignResult with `outcome: 'timeout'` and 5 log entries. No throws.
- **Tests added**: basic-loop test (5 nodes, no crash); determinism test (same seed = same result).
- **Scope**: M
- **Blocked-by**: M-S05, M-S04

### M-S09: Campaign simulator byte-parity test (M)
- **Files added**: `sim/story/policies/greedy.js`, `sim/story/policies/storyFirst.js`, `sim/story/__tests__/byteParity.test.js`.
- **Files touched**: `sim/story/runCampaign.js` -- ensure combat calls `runSimulation` directly with the same `encounter` shape the live game builds.
- **Exit criteria**: byte-parity test passes: a synthesized live encounter and the campaign-sim's combat call return deep-equal `runSimulation` results. Both `greedy` and `storyFirst` policies complete 100 act-1 runs without throwing.
- **Tests added**: byte-parity test (deep equal).
- **Scope**: L
- **Blocked-by**: M-S08

### M-S10: Campaign simulator policy library + CLI worker pool (S)
- **Files added**: `sim/story/policies/explorer.js`, `sim/story/policies/combatHeavy.js`, `sim/story/cli.js` (worker-pool driver).
- **Exit criteria**: CLI can run 24 jobs (6 storytellers × 4 difficulties × 1 seed each) in <=2 minutes on dev laptop. Writes summary JSON.
- **Tests added**: -
- **Scope**: S
- **Blocked-by**: M-S09

### M-S11: Quest engine (M)
- **Files added**: `src/story/storyQuestEngine.js` (10 functions), `src/story/__tests__/questEngine.test.js`, `data/story/quest-lines/_test_quest.json`.
- **Exit criteria**: Test quest goes through phase1 -> phase2 -> outcome_a based on flag manipulation. `tickQuestConditions` correctly advances and fires outcomes.
- **Tests added**: questEngine unit tests (phase advance, outcome firing, fail, log).
- **Scope**: M
- **Blocked-by**: M-S04, M-S03

### M-S12: Dialog effect language + StoryDialogScreen (M)
- **Files added**: `src/story/storyDialogConductor.js`, `src/ui/screens/StoryDialogScreen.js`, `src/story/__tests__/dialogConductor.test.js`.
- **Exit criteria**: Story Mode can render a hand-authored dialog node with all 22 effect types; choices filter by `requires`/`companionCondition`; cross-pool `next:` resolves.
- **Tests added**: dialogConductor (pool loading, choice filtering, effect application).
- **Scope**: M
- **Blocked-by**: M-S04, M-S11

### M-S13: Companion system core (M)
- **Files added**: `src/story/storyCompanions.js`, `src/story/__tests__/companions.test.js`, `data/story/banter-pools/_stub.json`.
- **Files touched**: `src/game/simulator.js` -- no changes (5-member parties already work via `_heroCount` derivation).
- **Exit criteria**: `recruit_companion` adds a companion; `dismiss_companion` benches; approval clamps to [-10, 10]; banter scheduler fires when conditions match; companion swap UI works at activated waypoints.
- **Tests added**: companion lifecycle (recruit/dismiss/approval/swap).
- **Scope**: M
- **Blocked-by**: M-S12

### M-S14: Storyteller Director engine v1 + pressure meter (L)
- **Files added**: `src/story/storyDirector.js`, `src/story/storyStorytellers.js`, `data/story/storytellers/*.json` (6 files, base profiles only), `data/story/difficulty-presets.json`, `src/story/__tests__/director.test.js`.
- **Exit criteria**: `getDirectorIntent(gs)` returns a valid intent for 1000 random ledger states. Pressure meter updates correctly on tracked events.
- **Tests added**: 1000-random-state fuzz (no throw); pressure-band hard-overrides (Crisis forces crisis_event within 3 ticks).
- **Scope**: L
- **Blocked-by**: M-S08

### M-S15: 6 storyteller unique mechanics (M)
- **Files added**: `src/story/storyStorytellers.js` -- 6 mechanic implementations as exported hook functions. `src/story/__tests__/storytellerMechanics.test.js`.
- **Exit criteria**: each mechanic is observable in 100-node sim runs:
  - Chronicler: 4th-consecutive-theme nodes get the bonus.
  - Ash Prophet: dark omens fire every 8-12 ticks.
  - Warbringer: budget escalation after win streak.
  - Trickster: 6th decision skips scoring.
  - Pilgrim: lore/hidden weight 3x.
  - Iron Judge: no fallback; ambush instead.
- **Tests added**: 6 mechanic-specific assertions.
- **Scope**: M
- **Blocked-by**: M-S14

### M-S16: Encounter builder + role-family resolver + queue (M)
- **Files added**: `src/story/storyEncounterBuilder.js`, `src/story/__tests__/encounterBuilder.test.js`.
- **Files touched**: `src/maps/mapData.js` -- no changes; the builder reads ENEMIES/ENCOUNTERS by reference.
- **Exit criteria**: For each act 1 template, builder produces a flat `encounter.enemies` array that `runSimulation` accepts. `encounterHistory` populates per node.
- **Tests added**: per-template smoke test (resolves enemy ids, valid budget).
- **Scope**: M
- **Blocked-by**: M-S14

### M-S17: Enemy instance modifiers (extends championModifiers+affixes) + boss variants (extends bossPhases) (M)
- **Files added**: `src/story/storyEnemyInstance.js`, `src/story/storyBossVariants.js`, `src/story/__tests__/enemyInstance.test.js`, `src/story/__tests__/bossVariants.test.js`.
- **Files touched**: `src/game/bossPhases.js` -- add `registerVariantPhases(bossId, phases)` (~20 lines, additive).
- **Exit criteria**: Applying a story modifier composes with existing champion + affix without conflicts; variant boss matches when conditions met.
- **Tests added**: 8 unit tests across compositional cases.
- **Scope**: M
- **Blocked-by**: M-S16

### M-S18: Skill check resolver + 18-skill affinity table (S)
- **Files added**: `src/story/storySkillCheck.js`, `data/story/skill-affinities.json`, `src/story/__tests__/skillCheck.test.js`.
- **Exit criteria**: All 3 worked examples from Brainstorm §3 produce the documented pass/fail. Affinity bonuses correctly apply per class.
- **Tests added**: 5 skill-check scenarios + per-class lookup.
- **Scope**: S
- **Blocked-by**: M-S04

### M-S19: Content batch v1 -- hand-authored seeds (M)
- **Files added**: 162 dialog seed nodes across 8 pool files; 60 encounter templates across `data/story/encounter-templates/*.json`; 20 side-quest templates in `side-quest-templates.json`; 50 lore fragments.
- **Exit criteria**: All seeds pass `build-story-content-manifest.cjs`. Manual playtest of an act-1 slice (~10 nodes) completes without missing-flag errors.
- **Tests added**: schema validation runs in CI.
- **Scope**: L
- **Blocked-by**: M-S03, M-S04, M-S12

### M-S20: Content batch v1 -- LLM generation pipeline + first 200 generated nodes (M)
- **Files added**: `scripts/generate-story-dialogue.cjs`, `data/story/lore-primer.md`, `data/story/_generated/*` (200+ nodes), `public/assets/story-dialog-review.html`, `scripts/approve-story-dialogue.cjs`.
- **Exit criteria**: 200 generated nodes lint clean against canonical flags/factions/skills/NPCs. Review tool shows them all.
- **Tests added**: -
- **Scope**: M
- **Blocked-by**: M-S19

### M-S21: Sprite batch -- 20 NPCs + 20 enemies/bosses via openai_v2 (M)
- **Files added**: `scripts/generate-story-npc-sprites.cjs`, `scripts/generate-story-enemy-sprites.cjs`. 40 PNG sprites in `public/images/openai_v2/`. Raw archives in `public/assets/openai_v2/raw/`.
- **Files touched**: `data/story/npcs.json`, `data/story/enemies-story.json` (registry entries with appearance ids).
- **Exit criteria**: All 40 sprites enrolled in open image-review-v2 batch (`image_review_batches/m<N>.json`). Visible on `/assets/image-review-v2.html` under Pending.
- **Tests added**: `scripts/verify-story-sprites-enrolled.mjs` -- assert each id is in the open batch JSON.
- **Scope**: M
- **Blocked-by**: M-S19

### M-S22: Act 1 wiring -- primary + 2 secondary + companion intros (L)
- **Files added**: `data/story/quest-lines/primary_act1_emberwood.json` (full content), 2 secondary quest files, companion-intro events in `dialogue-pools/`. `data/story/faction-control-map.json` (act 1).
- **Exit criteria**: Player completes Act 1 from new-game to act-2 transition in <=45 minutes of playtime. All hidden paths reveal correctly. Companion Lyra or Maer recruitable.
- **Tests added**: campaign sim runs 100 act-1 attempts with `storyFirst` policy; >=90% complete.
- **Scope**: L
- **Blocked-by**: M-S15, M-S16, M-S20, M-S21

### M-S23: Act 2 wiring (L)
- **Files added**: `primary_act2_veilscar.json`, 2 secondary, companion Tessaly/Bram/Yasha intros.
- **Exit criteria**: Act 2 completable. World corruption mechanic active.
- **Scope**: L
- **Blocked-by**: M-S22

### M-S24: Act 3 wiring + final boss variants (M)
- **Files added**: `primary_act3_riftgate.json`, final boss variant entries in `storyBossVariants` config.
- **Exit criteria**: Full 3-act run completable in <=3 hours. Final boss has at least 2 variants reachable based on choices.
- **Scope**: L
- **Blocked-by**: M-S23

### M-S25: Mobile UX polish -- StoryNewGameScreen + StoryJournalScreen (M)
- **Files added**: `src/ui/screens/StoryJournalScreen.js` (full impl with 5 tabs).
- **Files touched**: `src/ui/screens/StoryNewGameScreen.js` (storyteller carousel polish, slider styling, character preview button).
- **Exit criteria**: All buttons >=44×44 hit. No horizontal scroll on iPhone 14 Pro. All text >=14 px effective (or 11 px for inline badges only). Pass `CLAUDE.md` QA checklist.
- **Tests added**: Playwright accessibility check.
- **Scope**: M
- **Blocked-by**: M-S22

### M-S26: Mobile UX polish -- drawer + pressure chip + gesture tuning (S)
- **Files touched**: `src/ui/screens/StoryMapScreen.js` -- swipe-up drawer expansion, pressure chip collapse animation, edge-bumper polish.
- **Exit criteria**: All gestures feel correct on real iPhone 14 Pro Safari. 60 FPS sustained.
- **Tests added**: visual regression Playwright shots.
- **Scope**: S
- **Blocked-by**: M-S25

### M-S27: Authoring tools -- 5 tool pages (M)
- **Files added**: `public/assets/story-inspector.html`, `public/assets/quest-graph.html`, `public/assets/storyteller-balance.html`, `public/assets/story-dialog-review.html` (already touched in M-S20; finalize), `public/assets/story-campaign-sim.html`. `src/story/storyMapRendererShared.js`. `scripts/build-story-coverage.cjs`. Build outputs `public/assets/data/story/quest-graph.json` and `coverage.json`.
- **Exit criteria**: All 5 pages load with no JS errors on iPhone 14 Pro + desktop Chrome/Firefox. Use shared `_header.js`/`_footer.js`. No inline CSS for static values.
- **Tests added**: -
- **Scope**: M
- **Blocked-by**: M-S22

### M-S28: Balance pass via sim + storyteller-balance.cjs in CI (M)
- **Files added**: `scripts/build-storyteller-balance.cjs`, `scripts/check-storyteller-balance.mjs`.
- **Files touched**: `release.sh` (nightly run only -- not per-commit).
- **Exit criteria**: 2400-run matrix completes in <=30 min on dev laptop. All threshold checks pass (act-1 normal >=90%, etc. per §10.8). Storyteller-balance.html shows the latest run.
- **Tests added**: smoke-CI (6 runs) per commit; full matrix nightly.
- **Scope**: M
- **Blocked-by**: M-S15, M-S22

### M-S29: Telemetry hooks + achievements + audio (S)
- **Files added**: `data/story/achievements-story.json` (12 entries), `data/story/audio-mapping.json`, story SFX (5 new ogg files), 9 biome music tracks.
- **Files touched**: `src/game/achievements.js` (additive entries), `src/ui/screens/StoryMapScreen.js` (call `playOverworldMusic(act, biomeId)`).
- **Exit criteria**: 5 SFX + 9 music tracks present and play correctly. All 12 achievements trigger from appropriate game events.
- **Tests added**: 1 vitest per achievement trigger.
- **Scope**: S
- **Blocked-by**: M-S22

### M-S30: Final release prep (S)
- **Files touched**: `memory/future_milestones.md`, `public/assets/wishlist.html`, `memory/SITE_OVERVIEW.md` (add Story Mode section).
- **Exit criteria**: Full campaign playthrough on iPhone 14 Pro completes start-to-finish with no crashes. `release.sh game13` succeeds. `deploy_pages.sh` succeeds. Milestone report appended to `public/assets/assets.json`. Story Mode visible on GitHub Pages.
- **Tests added**: end-to-end Playwright run on the deployed site.
- **Scope**: S
- **Blocked-by**: ALL prior milestones

### Reserved milestones M-S31-35 (post-review iteration)
Held empty for user feedback after M-S30: dialog regenerations, balance retunes, additional content batches, idea-1/3 (Rumor, Scarification) integrations (already wired into S-26/S-18 hooks; content land here).

---

## 16. Acceptance: how we know we shipped

Concrete checklist (every item must be checkable by an autonomous agent or playtester):

- [ ] **Fresh boot path**: From a clean localStorage, Title -> New Game -> Story -> chosen storyteller -> `StoryMapScreen` is rendered. (M-S01, M-S06)
- [ ] **Storyteller differentiation visible in single act**: Playing the same seed under Chronicler vs Warbringer produces visibly different node sequences in Act 1. (M-S15, M-S22, verified by sim run-diff in `storyteller-balance.html`)
- [ ] **Act 1 end-to-end**: Player can complete Act 1 through map navigation + at least one dialog + at least one skill check + at least one combat. (M-S22)
- [ ] **Companion approval changes choices**: Picking a "spare the cultist" choice with Orren in party gives `orren_gravetide.approval -= 2` and shows the chip. A subsequent companion-gated choice becomes/remains locked accordingly. (M-S13, M-S22)
- [ ] **Companion personal quest reachable**: After approval >=+3 with Lyra, the Lyra personal quest line starts and is visible in Journal -> Quests. (M-S13, M-S22)
- [ ] **Hidden path reveal**: A specific dialog choice (in the act-1 primary quest "investigate burned road" phase) reveals a hidden edge that was previously not drawn. (M-S07, M-S22)
- [ ] **Save/reload preserves ledger + RNG**: After saving mid-act, hard-refresh, reload, the next Director decision is identical to what it would have been without the reload (verifiable in `story-inspector.html` -> Step Director). (M-S02)
- [ ] **Headless sim variety**: `node sim/story/cli.js --seeds 100 --storyteller chronicler --difficulty normal` completes 100/100 runs, reports `varietyMetrics.uniqueNodeTypes >=6` mean. (M-S10, M-S28)
- [ ] **Classic regression**: Loading any pre-existing classic save behaves identically to pre-M-S01 (same zone, same nodeId, same party, same gold, same fame). (M-S01, manual verification)
- [ ] **Mobile QA passes**: iPhone 14 Pro Safari test of the full campaign passes the `CLAUDE.md` QA checklist (portrait lock, 44×44 targets, no horizontal scroll, 14px text minimum). (M-S25, M-S26)
- [ ] **All 40 story sprites approved** in image-review-v2 before release. (M-S21)
- [ ] **No silent shelves**: A final audit of M-S01..M-S30 against this plan; every item is implemented or explicitly carried into M-S31+ with user confirmation per `CLAUDE.md`. (M-S30)

---

## Executive summary (250 words)

This plan turns the locked story-mode design into a 30-milestone, autonomous-agent-buildable contract for `/home/radgh/claude/game13/`. The architecture splits cleanly: a single `gs.gameMode` branch in `LoadGameScreen` and `TitleScreen` routes between Classic (untouched) and a lazy-imported `src/story/` module tree of 20 files. Classic saves never gain a `story.*` sub-tree; Story saves live in their own slot keyset (`emberveil_save_story_N`) with per-namespace versioning and Mulberry32 `rngState` checkpointed after every Director decision. A 30-line declarative predicate DSL (`all/any/not/flag/faction/quest/counter/item/companion/class/stat`) replaces all hand-coded condition checks; a 22-effect runner powers both quest engine and dialog conductor (the latter intentionally NOT named `dialogManager` to avoid `DialogScreen` collision). The Director is two-layer (hard filter + multiplicative soft score with decay and a guaranteed fallback) and each of the six storytellers ships a distinct mechanic, not just dial shifts. The campaign simulator is a first-class build, NOT an approximation: every combat node calls the live `runSimulation` with byte-identical encounter objects; a CI byte-parity test enforces this. Headless `runCampaign` powers nightly 2400-run balance matrices. Content lands as 162 hand-authored dialog seeds + ~400 LLM-generated nodes against a locked canonical-flag/faction/skill/biome/NPC/item registry, validated by CI on every build. 40 sprites (20 NPCs + 20 enemy/boss) route through the existing `openai-spritesheet-gen.py` workflow and enroll in the open image-review-v2 batch per M462. The mobile UX commits to Option A (sub-region pagination) with precise pixel layout for iPhone 14 Pro portrait. Milestones M-S31-35 are reserved for post-review iteration.

### Critical files for implementation
- /home/radgh/claude/game13/src/game/gameState.js
- /home/radgh/claude/game13/src/game/simulator.js
- /home/radgh/claude/game13/src/ui/screens/MapScreen.js
- /home/radgh/claude/game13/src/ui/screens/DialogScreen.js
- /home/radgh/claude/game13/sim/runloop.js