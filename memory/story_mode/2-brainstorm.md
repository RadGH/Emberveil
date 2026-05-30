# Brainstorm: Emberveil Story Mode — Design Options Pass

**Phase:** 2 of 3 (Brainstorm). Phase 3 will write the final implementation plan.
**Author:** senior game-developer pass against 1-roast.md + the original plan + live codebase.
**Date:** 2026-05-20

This document generates concrete options for every gap the roast identified and adds net-new ideas from reading the source. It does NOT write code and does NOT constitute the final plan. Recommendations are made decisively where the choice is clear; where trade-offs are genuine, options are ranked.

---

## 1. Roast Triage Table

Every roast finding numbered by section, with a proposed disposition. This table is the contract for sections 2–15.

| ID | Roast Finding | Disposition | Notes |
|---|---|---|---|
| 1.1 | Combat engine reusable but instance-modifier layer is new code | **Solve** | §8 (enemy configurability) extends `championModifiers` pattern |
| 1.2 | Skill-check axis: 18 D&D skills not mapped to 4-stat reality | **Solve** | §3 picks the 4-stat-with-skill-labels approach |
| 1.3 | `quests.js` is 122 lines; not a quest engine | **Solve** | §6 designs the minimum real engine |
| 1.4 | `companions.js` is stat-block only; no relationship system | **Solve** | §7 designs the full companion system per user constraint |
| 1.5 | Dialog DSL missing: no conditions, no effects, no pool routing | **Solve** | §4 (predicate DSL) + §6 (quest engine) provide this |
| 1.6 | Map/node-graph is a different rendering + data model from FTL strips | **Solve** | §2 Option A chosen; sub-region pagination |
| 1.7 | Campaign simulator does not exist; `simulator.js` is combat-only | **Solve** | §9 designs `runCampaign()` from scratch |
| 1.8 | Save schema underspecified; field collisions with Classic | **Solve** | §5 resolves every row in the roast's collision table |
| 1.9 | Telemetry ≠ director memory; conflated in plan | **Solve** | Rename to `encounterHistory`; director owns its own ringbuffer |
| 1.10 | Achievements not addressed | **Solve** | §12 adds Story Mode achievement candidates |
| 1.11 | Audio not addressed | **Solve** | §12 adds per-biome music + storyteller tinting |
| 1.12 | Debug/tool pages not addressed | **Solve** | §13 designs three new tool pages |
| 2.x | Map UI cannot exist at 393 px wide as drawn | **Solve** | §2 specifies full mobile-first layout with pixel numbers |
| 2.1 | Three-panel layout needs >1100 px | **Solve** | Single-column with drawer; see §2 |
| 2.3 | Tap target / touch thresholds not spec'd | **Solve** | §2 carries forward roast §7.2/7.6 numbers |
| 2.4 | iOS safe areas not accounted for | **Solve** | §2 budget includes Dynamic Island + home indicator |
| 2.6 | Pan-vs-tap conflict not addressed | **Solve** | 8-px movement threshold before pan; spec in §2 |
| 3.1/3.2 | 2000–5000 dialog target is 20× current, no pipeline spec | **Solve** | §10 designs the generation pipeline; v1 target is 200 nodes |
| 3.4 | Defensible v1 content target never stated | **Solve** | v1 = 200 dialog nodes, 50 encounter templates, 20 side-quests |
| 4.1 | Additive penalties can drive scores negative | **Solve** | §8 proposes multiplicative normalized scoring |
| 4.2 | `includes()` collapses time in history | **Solve** | §8 adds exponential decay |
| 4.3 | `skillCheckVariety=0` zeros penalty entirely | **Solve** | §8 clamps to floor multiplier 0.2 |
| 4.4 | No escape valve when all candidates negative | **Solve** | §8 adds guaranteed fallback candidate |
| 4.5 | Intent vs. candidate layers conflated | **Solve** | §8 separates hard-filter from soft-score layers |
| 4.6 | Missing guardrails: anti-softlock, seed determinism, "brutal" definition | **Solve** | §8 / §9 spec these |
| 4.7 | Six storytellers overlap; Chronicler ≈ Pilgrim | **Reframe** | Differentiate each with a *unique mechanic*, not just dials; see §8 |
| 5.1 | 22 module names bleed into existing parallel concerns | **Reframe** | Propose clean naming convention that makes wrapping vs. forking explicit |
| 5.2 | No story-specific screen classes named | **Solve** | §5 / §14 name StoryMapScreen, StoryJournalScreen, StoryNewGameScreen |
| 5.3 | `load()` will balloon without upfront serializer spec | **Solve** | §5 specifies (de)serializer contract |
| 5.4 | RNG state not checkpointed across reload | **Solve** | §5 adds `story.rngState` field |
| 5.5 | Content migration is harder than Classic migration | **Solve** | §5 mandates per-namespace schema versioning |
| 5.6 | Mode-split lazy load not specified | **Reframe** | Accept that `gameState.js` carries a `story.*` stub; actual logic lazy-loaded |
| 5.7 | New build manifest builders not mentioned | **Solve** | §14 includes build script additions |
| 5.8 | Debug tooling completely absent | **Solve** | §13 |
| 5.9 | Mod system exposure not documented | **Accept loss (v1)** | Storyteller profiles + dialog pools are moddable; Director/MapGen code is not. Document this. |
| 6.1 | 18 D&D skills vs. 4 stats | **Solve** | §3 |
| 6.2 | "Permissive Scaling" undefined | **Solve** | Define: party members above the recommended node level receive no XP/gold bonus; enemies do not scale up |
| 6.3 | "Guaranteed reveal" contradiction | **Solve** | Define: a reveal trigger is "guaranteed" when every decision tree path includes it within 3 nodes |
| 6.4 | Salt-bumping on validation failure makes seed unstable | **Solve** | Display full seed+salt string; cap at 10 attempts then use safety-net template |
| 6.5 | Faction rep range never defined | **Solve** | §5 / §7: -10 to +10, thresholds at ≤-5 (hostile), -4..+4 (neutral), ≥+5 (friendly) |
| 6.6 | Companion dialog conditions with no companion model | **Solve** | §7 |
| 6.7 | "World corruption level" undefined | **Solve** | 0–100 integer, per-act cap; stored in `story.worldCorruption` |
| 6.8 | Boss story-flag reading not wired to bossPhases.js | **Solve** | Pre-combat mutation pass reads story flags, builds instance before CombatScreen |
| 6.9 | Memory events are load-bearing core, not "creative additions" | **Solve** | Elevate to first-class system in §14 milestone ordering |
| 6.10 | Rumor / regional control / scouting / soft-failure / pressure meter underestimated | **Solve** | §15 rates each on cost/payoff; Phase assignments in §14 |
| 6.11 | Biome id cross-reference never linted | **Solve** | §10 content validator checks all biome ids against canonical set |
| 6.12 | XP curve not addressed for 185-node campaign | **Solve** | Story Mode uses a separate flatter XP table; acts 1-3 not acts 1-6 |
| 6.13 | Hardcore / NG+ / fame not addressed | **Defer with justification** | v1 Story Mode: no permadeath (Hardcore off), no NG+, fame increments normally. Document these. |
| 6.14 | Achievement integration | **Solve** | §12 |
| 6.15 | `next:` pointer orphan lint | **Solve** | §10 content pipeline runs orphan check in CI |
| 6.16 | `dialogManager.js` vs `DialogScreen.js` naming collision | **Solve** | Name the new module `storyDialogConductor.js` |
| 6.17 | Skill-check field labeled "skill" but is just a stat alias | **Solve** | The `skill` field is a display label only; resolver reads `stat:` for math |
| 6.18 | No content/balance feedback loop | **Solve** | §9 campaign sim is the feedback mechanism |
| 6.19 | Recurring NPC arcs (`recurringNpcEvents.js`) collision | **Reframe** | Classic Mode keeps them unchanged; Story Mode's NPCs are separate roster |
| 6.20 | Director needs real-time tracking, not telemetry emitter | **Solve** | Director owns `encounterHistory` ringbuffer in `story.*` state |

---

## 2. Mobile Map UX — Three Options, One Recommendation

### Context numbers (locking in from roast §7)

- Viewport: 393×852 CSS px, portrait-locked.
- Top bar (act + menu): 48 px.
- Storyteller chip (collapsible): 28 px (hidden by default, shown on tap).
- Safe area top (Dynamic Island region): 47 px.
- Map canvas budget: **520 px tall**.
- Node detail drawer peek: 96 px.
- Bottom action bar: 64 px.
- Safe area bottom: 34 px.
- **Total: 837 of 852. Slack: 15 px.**
- Node visual radius 16 px (32 px dia); hit area 24 px (48 px dia); min spacing 56 px center-to-center.
- Max visible without scroll at 393×520: **floor((393-32)/56)+1 = 7 columns × 3 lanes = ~21 nodes**.

---

### Option A — Sub-Region Pagination (recommended)

**Description:** The act map is divided into 3–6 named sub-regions (biome zones). Each sub-region is a horizontal strip ~1.1×–1.8× viewport width. The player swipes left/right to move between sub-regions. Within a sub-region, nodes are laid out in the existing FTL 3-lane grid. Transitioning between sub-regions is a horizontal "page flip" with a biome label transition.

**Why it fits:** This is the exact motion model the current `MapScreen.js` already implements. Each zone is already a horizontal strip with 6–12 nodes. We're adding the concept of act-level stitching. The existing pan-threshold logic, the cross-zone popup pattern, and `cssCanvasW` arithmetic all carry forward. Total delta is a new "act graph" layer that indexes which sub-region the player is in, and a biome-tab indicator strip (like browser tabs, 36 px tall) that shows sub-regions as swipeable segments.

**ASCII wireframe at 393×852:**

```
┌────────────────────────────── 393 ──────────────────────────────┐
│  ◀  Act 1: Emberwood        ·   ☰                        [48px] │
├──────────────────────────────────────────────────────────────────┤
│  [Emberwood] [Stoneward] [Fen] [Old Road] [Gloomridge]   [36px] │  ← sub-region tabs
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   MAP CANVAS  393 × 484px  (pans horizontally within region)    │
│                                                                  │
│   ○──○──●──○──○  ← lane 1 (y=0.2)                              │
│      ╲  ╱  │                                                    │
│   ○───○────○──○  ← lane 2 (y=0.5)   ● = current position       │
│         ╲     │                                                  │
│   ○──○───○──○  ← lane 3 (y=0.8)                                 │
│                                                                  │
│   [swipe left for Stoneward Hills →]                            │
├──────────────────────────────────────────────────────────────────┤
│  ▬▬ Node drawer peek (96px)                                      │
│  Ruined Mill · Combat · Danger ▮▮▮▯▯   [ Travel ]  [ Quest ]    │
├──────────────────────────────────────────────────────────────────┤
│  [ Party ]  [ Inventory ]  [ Quests ]  [ Rest ]         [64px]  │
│                                            [home inset: 34px]   │
└──────────────────────────────────────────────────────────────────┘
```

**Strengths:**
- Zero new gesture model (existing horizontal scroll + tap).
- Cross-region connections drawn as dashed overflow arrows at the right/left edge of a strip, matching current cross-zone arrow pattern.
- Sub-region tabs give the player an act-level mental map without rendering all 55 nodes at once.
- 5–12 nodes per sub-region fits the 21-node visible max comfortably.
- Sub-regions can be named after biomes; tab color can be the biome palette.

**Weaknesses:**
- Non-linear branch structures (multiple paths back to same prior node) are harder to express in strips.
- Can feel linear even when the graph has multiple routes — player may not realize they can go back.

**Mitigation:** Allow backward swipe to prior sub-region. Mark "return paths" with a distinctive dashed left-arrow on the first node of the destination strip. Hidden paths that cross sub-regions show as locked edge at the destination strip's entry.

---

### Option B — Pinch-Pan Single Canvas

**Description:** The entire act map is one large canvas (e.g., 1200×900 logical px). The player pinches to zoom (0.7×–1.5×) and pans freely. A minimap overlay (80×60 px, top-right corner) shows position within the full map.

**Verdict: feasible but wrong for v1.** Reasons:

- Requires a gesture recognizer handling multi-touch pinch, which conflicts with the existing single-finger scroll in `MapScreen.js`. Rewrite cost: 2–3 milestones of UI work alone.
- At 0.7× zoom, node hit areas become 48×0.7 = 33 px — below the 44-pt iOS minimum. You'd have to scale hit areas separately from visual areas.
- Safari on iOS has system-level pinch-to-zoom on the page; suppressing it requires viewport meta overrides and `touch-action: none` on the canvas — workable but fiddly.
- Minimap at 80×60 is 1200/80=15× scale; 32-px nodes become 2-px dots — illegible.
- Right call for a PC RPG. Wrong call for a portrait iPhone game in v1.

**Reserve for v3+.** If map scope grows past 120 nodes per act, revisit.

---

### Option C — Vertical Slay-the-Spire Column

**Description:** The map scrolls vertically. Each "floor" is a horizontal row of 1–4 nodes. The player moves upward through the act, choosing which node to visit at each floor. Branching happens at each floor; paths converge.

**Verdict: strong second choice.** The Slay-the-Spire model works well on portrait mobile. Pros:
- Every node is always reachable by scrolling; no sub-region concept needed.
- Forced forward momentum creates tension.
- Backtracking is limited, which simplifies the graph (no loops, no "go back two floors").

**Why Option A wins anyway:**
- Emberveil's design explicitly wants backtracking (revisit Act 1 nodes in Act 2, unlock paths after quests). StS columns don't support loops.
- The existing FTL horizontal-strip model is so close to Option A that implementing Option C would discard more existing code.
- Sub-region tabs give a more interesting world-map feeling than a numbered-floors grid.

**Recommendation: Option A.** Implement with the existing horizontal-scroll canvas, wrap each biome as a sub-region, use swipeable biome tabs (36 px strip) to navigate. Hide the tab bar if there is only one sub-region (Act 1 tutorial zones). Cross-region connections draw as edge arrows on the rightmost / leftmost column of each sub-region canvas, matching the existing cross-zone arrow pattern.

---

## 3. Skill-Check Axis Decision

### The problem

The existing four stats are: STR, DEX, INT, CON. The existing dialog system uses `{ stat: 'DEX', dc: 14 }`. The plan introduces 18 D&D-style skill categories but never resolves how they map to stats.

### Option 1 — 4-Stat-with-Skill-Labels (recommended)

Every skill check has:
- `skill`: a display label (e.g., "Intimidation", "Arcana", "Survival") — shown in the dialog choice text and in the Director's variety tracker.
- `stat`: one of `STR | DEX | INT | CON` — this is what the resolver actually reads for math.
- `dc`: difficulty class, integer 8–24.
- `scaling`: `none | act_level | party_avg_level` — shifts DC by +2/+3 per act when set.

The resolver is:
```
checkPower = statValue
           + floor(character.level / 3)
           + floor(gearScore.utility / 15)
           + classBonusForSkill(class, skillLabel)
           + flagBonus(gs.storyFlags, skillLabel)
           + randomRoll(1..8)
```

`classBonusForSkill` returns +2 for the class's strongest affinity (e.g., Rogue → Stealth/Deception/Mechanisms), +0 otherwise. It's a flat lookup table of ~10 classes × 18 skill labels → {0, 2}.

`flagBonus` returns +1 or +2 if a story flag marks that the party has established expertise (e.g., `flag: 'ember_scholar'` gives +2 to Arcana checks).

**Worked examples:**

_Example 1: Intimidate the gate guard_
- Choice text: "[Intimidation — STR] Force the guards to stand aside."
- Resolver: STR=14 → statValue=14; level=4 → +1; utility gear /15 →+0; Warrior class bonus +2; randomRoll=5. Total=22. DC=12. Pass.

_Example 2: Arcana seal on a rift_
- Choice text: "[Arcana — INT] Unweave the ward."
- Resolver: INT=9 → statValue=9; level=4 → +1; Mage class bonus +2; randomRoll=3. Total=15. DC=16. Fail — partial: rift closes but leaves residual corruption (soft-failure model).

_Example 3: Survival — cross a burned road_
- Choice text: "[Survival — CON] Endure the ash and push through."
- Resolver: CON=11 → statValue=11; Ranger class bonus +2; flagBonus(ash_road_crossed)=+1; randomRoll=6. Total=20. DC=14. Pass.

**Why this wins:**
- Zero changes to the stat sheet. Classic Mode is unaffected.
- The Director can track `recentSkillLabels[]` for variety without caring about the underlying stat.
- Adding 18 skill labels to the Director is cheap (just a string set).
- Player sees "Intimidation" not "STR check" — feels more narrative.
- The `classBonusForSkill` table is 10 rows × 18 cols = 180 cells, authored once in `data/story/skill-affinities.json`.

### Option 2 — Add a 6-Skill Expansion to the Character Sheet

Add 6 aggregate skills: Might (=STR), Finesse (=DEX), Lore (=INT), Endurance (=CON), Presence (roleplay stat, new), Awareness (perception stat, new). Players allocate skill points on level-up. Classic Mode is changed.

**Why this loses:** Changes the character sheet (Classic-Mode visible), requires balance pass on every class, bloats the `load()` migration, and the delta from Option 1 is unclear to players ("Finesse" vs. "DEX"). Save it for a post-launch expansion if players demand it.

**Recommendation: Option 1.** It is additive, backwards-compatible, and narratively satisfying.

---

## 4. Predicate DSL

### The problem

Dialog choices need conditions (`requires`), dialog pools need prerequisites, and locked map paths need reveal predicates. Without a formal language this becomes scattered hardcoded logic. The plan used strings like `revealedBy: ['quest.X.choice.search_cellar']` which is barely parseable.

### Option A — Declarative JSON Predicate (recommended)

```json
{
  "all": [
    { "flag": "shrine_purified" },
    { "faction": "emberguard", "gte": 2 },
    { "not": { "flag": "village_abandoned" } }
  ]
}
```

Operators: `all`, `any`, `not`, `flag`, `faction`, `quest`, `counter`, `item`, `class`, `companion`, `stat`.

**Parser sketch (~30 lines):**
```js
export function evalPredicate(pred, context) {
  if (!pred) return true;
  const { flags, factions, quests, counters, party } = context;

  if ('all'   in pred) return pred.all.every(p => evalPredicate(p, context));
  if ('any'   in pred) return pred.any.some(p  => evalPredicate(p, context));
  if ('not'   in pred) return !evalPredicate(pred.not, context);
  if ('flag'  in pred) return !!flags[pred.flag];
  if ('faction' in pred) {
    const val = factions[pred.faction] ?? 0;
    if ('gte' in pred) return val >= pred.gte;
    if ('lte' in pred) return val <= pred.lte;
    if ('eq'  in pred) return val === pred.eq;
    return val !== 0;
  }
  if ('quest' in pred) {
    const q = quests[pred.quest];
    if ('phase' in pred) return q?.phase === pred.phase;
    if ('status' in pred) return q?.status === pred.status;
    return !!q;
  }
  if ('counter' in pred) {
    const v = counters[pred.counter] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    if ('lte' in pred) return v <= pred.lte;
    return v > 0;
  }
  if ('class' in pred) return party.some(m => m.class === pred.class);
  if ('companion' in pred) return party.some(m => m.companionId === pred.companion);
  if ('stat' in pred) {
    const leader = party[0];
    const v = leader?.attrs?.[pred.stat] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    return v > 0;
  }
  if ('item' in pred) return party.some(m => (m.equipment || []).some(it => it?.id === pred.item));
  console.warn('[evalPredicate] Unknown predicate key:', pred);
  return false;
}
```

Context object passed to `evalPredicate`:
```js
{
  flags:    gs.story.flags,          // { flagName: true/false }
  factions: gs.story.factions,       // { factionId: -10..+10 }
  quests:   gs.story.quests,         // { questId: { status, phase } }
  counters: gs.story.counters,       // { counterName: number }
  party:    gs.party,                // array of member objects
}
```

### Option B — Named-Function Dispatch

Store predicates as string keys: `"revealedBy": "shrine_purified_and_emberguard_2"`. A central registry maps keys to functions: `PREDICATES['shrine_purified_and_emberguard_2'] = (ctx) => ...`.

**Why this loses:** String keys are opaque to linters, cannot be composed at data authoring time, require a code change for every new condition. Predicate composition (all, any, not) needs a different convention. The JSON DSL approach is self-describing and trivially serializable into the content validator.

**Recommendation: Option A (declarative JSON).** The 30-line parser is the entire engine cost. Content validator checks that every predicate op is a known key. This is also the pattern `public/docs/schema-reference.md` already anticipates for the mod DSL.

---

## 5. Save Schema Spec

### Existing fields, Story Mode dispositions (resolves roast §1.8 table)

| Existing field | Story Mode disposition |
|---|---|
| `version` (root int) | Keep as `version`. Story Mode saves increment the same global version counter. No rename. |
| `gameMode` (new field) | Add: `'classic' | 'story'`. Default: `'classic'` for all pre-existing saves. |
| `storyFlags: {}` | Classic Mode keeps this. Story Mode moves its flags to `story.flags`. The two are separate namespaces — no collision. |
| `quests: {}` (boss-kill map) | Classic Mode keeps this object untouched. Story Mode uses `story.quests` (different shape). |
| `seenEvents: []` | Classic Mode keeps this array. Story Mode uses `story.dialogHistory: {}` (keyed by node id). |
| `act`, `zoneId`, `nodeId` | Classic Mode owns these. Story Mode uses `story.act`, `story.currentMapId`, `story.currentNodeId`. Classic fields are not written by Story Mode. |
| `unlockedZones: []` | Classic Mode owns this. Story Mode uses `story.paths` graph model. |
| `completedBosses: []` | Classic Mode keeps this. Story Mode uses `story.bossHistory: {}`. |
| `fame` | Shared: Story Mode runs increment global fame normally. |
| `hardcore` | v1: forced false for Story Mode saves. |
| `ngPlus` | v1: not applicable to Story Mode. |

### Story save root shape

```
localStorage key:  emberveil_save_story_N   (N = slot 0..2)
Classic key stays: emberveil_save_N         (no change)
```

Story save root:
```js
{
  version: <int>,          // global save version, incremented by migrations
  gameMode: 'story',
  storyVersion: 1,         // story-content schema version (for content migrations)
  story: { ... }           // full story ledger (see below)
  // ALL Classic fields (party, companions, gold, etc.) included at root as usual.
  // The story sub-tree is additive, not a replacement.
}
```

Story ledger (`story: { ... }`):

| Field | Type | Description |
|---|---|---|
| `campaignSeed` | string | 8-char hex. Determines map gen + initial pool selection. |
| `saltOffset` | int | Incremented if map gen validation requires retries. Displayed in seed UI as `seed-salt`. |
| `rngState` | uint32 | Last committed Mulberry32 state. Persisted after every Director decision. |
| `storytellerId` | string | One of the 6 storyteller ids. |
| `difficulty` | string | `relaxed | normal | hard | nightmare` |
| `thematicConsistency` | string | `loose | balanced | strict` |
| `sideEventFrequency` | string | `low | normal | high | wild` |
| `combatDensity` | string | `low | normal | high` |
| `storyPressure` | string | `low | normal | high` |
| `act` | int | Current act (1–3). |
| `currentMapId` | string | e.g. `act1_emberwood` |
| `currentNodeId` | string | Node the player is currently at. |
| `flags` | `{ [flagId: string]: boolean }` | Story-specific boolean flags. |
| `counters` | `{ [counterId: string]: int }` | Named integer counters. |
| `factions` | `{ [factionId: string]: int }` | Faction rep, range -10..+10. |
| `quests` | `{ [questId: string]: { status: string, phase: string, log: string[] } }` | Quest engine state. |
| `dialogHistory` | `{ [nodeId: string]: { choiceId: string, timestamp: int } }` | Which choice was taken at each dialog node. |
| `maps` | `{ [mapId: string]: MapSave }` | Persisted map graphs. |
| `worldMutations` | `string[]` | Applied world-mutation ids. |
| `worldCorruption` | int | 0–100. |
| `bossHistory` | `{ [bossId: string]: { outcome: string, variant: string } }` | Boss results. |
| `encounterHistory` | `{ [nodeId: string]: EncounterInstance }` | Generated encounter per node; prevents reroll on re-entry. |
| `recentHistory` | `RecentHistory` | Director's ringbuffers (see below). |
| `loreDiscovered` | `string[]` | Lore fragment ids the player has seen. |
| `companions` | `CompanionState[]` | Named story companions; approval, quest status, alive flag. |
| `rumorPool` | `string[]` | Active rumor ids in the current region. |
| `pressureMeter` | int | Current act pressure 0–100. Controlled by Director. |
| `campaignStartDate` | int | Unix timestamp ms. |
| `lastSaveDate` | int | Unix timestamp ms. |

`MapSave` shape:
```js
{ nodes: { [nodeId]: NodeSave }, connections: ConnectionsSave[], revealedPaths: string[] }
```

`NodeSave` shape:
```js
{ state: 'unvisited|visited|completed', visibility: 'hidden|visible|revealed', waypointState: string, assignedEncounterId: string | null }
```

`RecentHistory` shape:
```js
{
  nodeTypes:    string[],   // last 10, newest first
  enemyFamilies: string[],
  skillLabels:  string[],
  rewardTypes:  string[],
  biomes:       string[],
  tones:        string[],
}
```

### RNG checkpointing approach

- Director uses Mulberry32 seeded from `campaignSeed` at new-game start.
- After every **committed** Director decision (intent selected, encounter confirmed, dialog node entered), save `rngState` to the story ledger.
- On resume, Director re-seeds from `rngState`. The sequence continues seamlessly.
- Mid-event rolls (skill check dice) use a separate ephemeral RNG seeded from `rngState + eventId hash`. This prevents save-scumming: the dice are already decided when you enter the node, not when you scroll to the choice.

### Serialization contract

- All `Set` instances (visitedNodes, usedShrines, etc.) continue to serialize as arrays in Classic Mode, unchanged.
- Story Mode ledger contains only primitives, arrays, and plain objects — no `Set` or `Map` instances. This is the contract; implementor must not use them inside `story.*`.
- `GameState.load()` adds a branch: `if (saved.gameMode === 'story') _loadStoryLedger(saved.story)` where `_loadStoryLedger` applies defaults for any missing story field. Classic save? The branch never runs; `story` field is never written to Classic saves.

---

## 6. Quest Engine Sketch

### What the 122-line `quests.js` is:
Boss-kill autocompletion + 10 gold bounties. Not an engine. The "real" engine is new.

### Minimum quest definition

```js
// data/story/quest-lines/primary_act1.json (simplified)
{
  "id": "primary_act1_emberwood",
  "category": "primary",       // primary | secondary | faction | side
  "act": 1,
  "title": "The Emberwood Holds",
  "phases": [
    {
      "id": "reach_brightfall",
      "label": "Reach Brightfall",
      "completeCondition": { "flag": "arrived_brightfall" },
      "onComplete": [
        { "type": "set_flag",          "flag": "brightfall_gates_open" },
        { "type": "reveal_nodes_tag",  "tag": "burned_road_clue", "count": 2 },
        { "type": "faction_delta",     "faction": "emberguard", "amount": 1 }
      ],
      "nextPhase": "investigate_burned_road"
    },
    {
      "id": "investigate_burned_road",
      "label": "Investigate the burned road",
      "completeCondition": { "any": [{ "flag": "road_cultist_found" }, { "flag": "road_evidence_burned" }] },
      "onComplete": [
        { "type": "quest_log",   "text": "The cult is moving supplies through the old road." },
        { "type": "reveal_path", "from": "act1_node_018", "to": "act1_node_026" }
      ],
      "nextPhase": "confront_guardian"
    }
  ],
  "outcomes": [
    {
      "id": "guardian_defeated",
      "condition": { "flag": "guardian_killed" },
      "effects": [
        { "type": "unlock_map_transition", "targetMap": "act2_veilscar" },
        { "type": "faction_delta",         "faction": "emberguard", "amount": 2 }
      ]
    },
    {
      "id": "guardian_redeemed",
      "condition": { "all": [{ "flag": "guardian_spared" }, { "flag": "shrine_purified" }] },
      "effects": [
        { "type": "set_flag",             "flag": "guardian_ally" },
        { "type": "unlock_map_transition","targetMap": "act2_veilscar" },
        { "type": "faction_delta",        "faction": "ancient_pact", "amount": 3 }
      ]
    }
  ]
}
```

### Runtime state (stored in `story.quests[questId]`)

```js
{
  status:  'inactive | active | completed | failed',
  phase:   'reach_brightfall',   // current phase id
  log:     ['You arrived at Brightfall.'],
  outcomes: []                   // outcome ids that have fired
}
```

### Effect runner (10 functions, no more)

```js
const EFFECTS = {
  set_flag:             ({ flag }, ctx)         => { ctx.flags[flag] = true; },
  clear_flag:           ({ flag }, ctx)         => { delete ctx.flags[flag]; },
  faction_delta:        ({ faction, amount }, ctx) => { ctx.factions[faction] = clamp((ctx.factions[faction]||0)+amount, -10, 10); },
  quest_advance:        ({ questId, phase }, ctx) => { ctx.quests[questId].phase = phase; },
  quest_complete:       ({ questId }, ctx)      => { ctx.quests[questId].status = 'completed'; },
  quest_log:            ({ text }, ctx)         => { ctx.quests[ctx.currentQuestId].log.push(text); },
  reveal_path:          ({ from, to }, ctx)     => { ctx.revealPath(from, to); },
  reveal_nodes_tag:     ({ tag, count }, ctx)   => { ctx.revealNodesByTag(tag, count); },
  unlock_map_transition:({ targetMap }, ctx)    => { ctx.unlockTransition(targetMap); },
  start_encounter:      ({ template }, ctx)     => { ctx.queueEncounter(template); },
  unlock_waypoint:      ({ nodeId }, ctx)       => { ctx.setWaypointState(nodeId, 'activated'); },
};

export function runEffects(effects, ctx) {
  for (const eff of effects) {
    const fn = EFFECTS[eff.type];
    if (!fn) { console.warn('[runEffects] unknown effect', eff.type); continue; }
    fn(eff, ctx);
  }
}
```

### API surface (~10 functions)

```
ensureQuestStarted(gs, questId)
advanceQuestPhase(gs, questId, phaseId)
completeQuest(gs, questId, outcomeId)
failQuest(gs, questId)
getActiveQuests(gs)
getQuestPhase(gs, questId)
checkQuestOutcomes(gs, questId)     // checks all outcome conditions, fires matching ones
tickQuestConditions(gs)             // called after every node: check phase completion
runQuestEffects(effects, gs, ctx)   // wraps runEffects with full gs context
getQuestLog(gs, questId)
```

Quests are checked for phase advancement after every dialog resolution and after every combat victory. `tickQuestConditions` iterates active quests and calls `checkQuestOutcomes` for each. This is the entire engine. The depth is in the authored JSON, not the runtime.

---

## 7. Companion System (Full)

The user constraint is explicit: full companion system with approval, personal quests, relationship-gated dialog, banter. This section designs it from zero since `companions.js` provides only stat blocks.

### Companion Roster (6 named story companions)

These are separate from the tavern-hire class pets. They are named characters encountered during the campaign.

| ID | Name | Class/Role | Recruited | Personality | Unique mechanic |
|---|---|---|---|---|---|
| `lyra_ashwalker` | Lyra Ashwalker | Ranger / Scout | Act 1 - after shrine event | Pragmatic, dry wit | Scouting: reveals hidden node type before travel |
| `orren_gravetide` | Orren Gravetide | Warrior / former knight | Act 1 - gate confrontation | Honor-bound, slow to trust | Intimidation bonus on STR checks (+2); approval drops on moral failures |
| `tessaly_veil` | Tessaly "Veil" | Rogue / spy | Act 2 - market rescue | Sardonic, chaotic loyal | Stealth unlocks additional dialog choices; triggers banter with Orren |
| `bram_coldfire` | Bram Coldfire | Mage / researcher | Act 2 - library ruins | Curious, sometimes oblivious | Arcana bonus (+2 INT checks); personal quest is lore-heavy |
| `yasha_stonewill` | Yasha Stonewill | Monk / wanderer | Act 2 - crossroads encounter | Stoic, ancient perspective | Wisdom/CON bonus on survival checks; rarely speaks but banter is pointed |
| `captain_maer` | Captain Maer | Warrior / faction NPC | Act 1 - Brightfall gate | Duty-driven, suspicious | Faction gateway: Emberguard rep required; unlocks faction dialog branches |

Party model: the player runs 4 heroes (the built party). Story companions join as a 5th member slot — they participate in combat, travel, and dialog but cannot be re-specced by the player. The existing `party[]` array holds the 4 player heroes. A new `story.companions[]` array (separate from `gs.companions` tavern companions) holds story companions. Combat passes up to 5 members total.

### Approval Meter

Each story companion has `story.companions[i].approval` in range -10..+10.

Starting approval: 0 (neutral).
Thresholds: ≤-5 (hostile: they refuse specific dialog options, may leave), -4..+4 (neutral), ≥+5 (friendly: unlocks personal quest, unique dialog branches), +10 (devoted: one special combat ability active during combat).

Approval deltas are specified in dialog node effects:
```json
{ "type": "companion_approval", "companion": "lyra_ashwalker", "amount": 1 }
```

The delta is applied when the player makes that choice. Companions not in the active party also have approval tracked but receive half deltas (they are "aware" of the player's choices through rumor).

### Personal Quests (one per companion, unlocks at approval +3)

| Companion | Personal quest trigger | Quest summary |
|---|---|---|
| Lyra | Scouted a hidden path into cult territory | Track down the cult captain who burned her village |
| Orren | Player spared an enemy Orren wanted executed | Orren's crisis of faith in the Emberguard order |
| Tessaly | Player discovered her working for a rival faction | She was a double agent; player decides whether to expose or protect her |
| Bram | Player unlocked a sealed lore archive | Bram discovers his mentor was the Architect's first follower |
| Yasha | Player purified a sacred shrine | Yasha reveals the shrine network predates recorded history and holds a fragment of old power |
| Maer | Player achieved Emberguard reputation ≥ +6 | Maer's unit is ordered to destroy a town the player has helped; player can intervene |

Personal quests use the same quest engine (§6). They have 2–4 phases and 2 outcomes each.

### Relationship-Gated Dialog

Every dialog event can specify `companionCondition`:
```json
{
  "id": "choice_spare_enemy",
  "text": "Spare the cultist and let her go.",
  "companionCondition": { "companion": "orren_gravetide", "approval": { "lte": 2 } },
  "effects": [
    { "type": "companion_approval", "companion": "orren_gravetide", "amount": -2 },
    { "type": "companion_approval", "companion": "lyra_ashwalker", "amount": 1 }
  ]
}
```

A choice can also be *unlocked* by high approval:
```json
{
  "id": "choice_orren_wisdom",
  "text": "[Orren] Ask him to reason with the guard captain.",
  "requires": { "companion": "orren_gravetide", "approval": { "gte": 5 } },
  "effects": [{ "type": "set_flag", "flag": "gate_opened_peacefully" }]
}
```

These require a companion to be in the active party and at approval threshold.

### Banter Triggers

Banter is a short 2–4 line exchange between two companions triggered by:
- Traveling to a node of a specific type (e.g., arriving at a shrine triggers a Yasha/Bram exchange).
- A specific flag being set (e.g., after sparing an enemy, Orren/Tessaly banter).
- Arriving at the start of an act.

Banter is authored JSON, stored in `data/story/banter-pools/<companion_pair>.json`. Each banter object:
```json
{
  "id": "banter_orren_tessaly_spy_revealed",
  "trigger": { "flag": "tessaly_spy_known" },
  "cooldown": 3,       // min nodes between repeats
  "lines": [
    { "speaker": "orren_gravetide", "text": "I knew there was something off about you from the start." },
    { "speaker": "tessaly_veil",    "text": "And yet here we are. Strange how that works." }
  ]
}
```

Banter is delivered as a brief non-blocking overlay (slide-in panel at top of map screen, 2–3 seconds, tap to dismiss early). No separate screen transition. This is the equivalent of XCOM/Divinity banter lines.

### Recruit / Dismiss / Death

- **Recruit:** a dialog choice `{ "type": "recruit_companion", "companion": "lyra_ashwalker" }` adds them to `story.companions` and the active party slot.
- **Dismiss:** player can dismiss a companion from the journal screen. Dismissed companions return to their last known location node; player can re-recruit later at a cost (approval -2).
- **Death in Hardcore mode (v2):** v1 sets `hardcore: false` for Story Mode so companions cannot permanently die. In v2 add a downed/revival system.
- **Approval ≤ -7:** companion delivers a confrontation dialog and leaves. This is a story event authored per companion; the player gets one dialog choice to persuade them to stay (requires approval ≥ -5 after the delta, otherwise they depart permanently).

---

## 8. Director Scoring Rewrite

### Architecture: two-layer separation

**Layer 1 — Hard Filter:** Pre-filters candidates to an "eligible" set. These are boolean pass/fail:
- Max same-type streak not exceeded.
- Biome tag matches current zone.
- Act tag includes current act.
- Required quest phase active (if any).
- Faction rep satisfies any faction requirements.

If no candidates pass the hard filter, skip to the fallback candidate (always a travel beat or a lore fragment from the universal pool).

**Layer 2 — Soft Score:** Among eligible candidates, compute a normalized probability weight. Multiplicative, not additive.

```js
function softScore(candidate, history, storyteller) {
  let score = candidate.baseWeight;  // authored in [0.1, 1.0]

  // Decay: recent history items penalize proportionally to recency.
  // history.nodeTypes = [newest, ..., oldest] (10 items)
  for (let i = 0; i < history.nodeTypes.length; i++) {
    if (history.nodeTypes[i] === candidate.type) {
      score *= Math.pow(0.5, i + 1);  // 0.5, 0.25, 0.125, ...
    }
  }

  // Same-type streak: near-zero score after 2 in a row.
  if (history.sameTypeStreak >= 2 && candidate.type === history.lastType) {
    score *= 0.05;
  }

  // Enemy family recency (for combat nodes).
  if (candidate.enemyFamily) {
    for (let i = 0; i < history.enemyFamilies.length; i++) {
      if (history.enemyFamilies[i] === candidate.enemyFamily) {
        score *= Math.pow(0.6, i + 1);
      }
    }
  }

  // Skill check variety (for skill-check nodes).
  if (candidate.primarySkill) {
    for (let i = 0; i < history.skillLabels.length; i++) {
      if (history.skillLabels[i] === candidate.primarySkill) {
        const floorMult = Math.max(0.2, storyteller.skillCheckVariety);
        score *= Math.pow(floorMult, i + 1);
      }
    }
  }

  // Thematic alignment bonus.
  const themeMatch = candidate.themeTags.some(t => storyteller.preferredThemes.includes(t));
  const consistencyStr = Math.max(0.2, storyteller.thematicConsistency);
  if (!themeMatch) score *= (1 - 0.5 * consistencyStr);

  return Math.max(0.001, score);  // never fully zero; escape valve
}
```

Normalize all eligible candidates: `weight[i] / sum(weights)`. Sample with Mulberry32.

### Anti-softlock guarantee

A `FALLBACK_CANDIDATE` is always appended to the eligible set (it always passes the hard filter). It is a generic "travel beat" — a brief road description, no encounter, no dialog, no skill check. It has `baseWeight: 0.01` so it almost never fires when real content is available. But it cannot be driven to zero by penalties (it has no history entries to penalize). This prevents a crash when every authored candidate fails the hard filter.

### Seed determinism

Seed determinism applies to **map generation only**. Director decisions during live play are NOT re-deterministic from seed because player choices change the history state. The Director's Mulberry32 stream IS deterministic from `rngState` checkpoint (§5) — meaning after a reload, the next Director decision is identical to what it would have been without the reload. This is the correct contract.

### "Brutal fight" definition

A fight is "brutal" when `recentPerformance.brutalScore >= 1`. The brutal score is:
```
brutalScore = (deathsThisFight / partySize) * 2
            + (finalHpPctAvg < 0.2 ? 1 : 0)
            + (turnsToWin > 20 ? 0.5 : 0)
```

Score ≥ 1.0: brutal. Score ≥ 2.0: near-wipe. Brutal scores increase the soft-score weight of rest/merchant/lore candidates by ×2; near-wipe scores force the next Director intent to be `rest` regardless of soft scoring (hard override).

### Storyteller differentiation (unique mechanics, not just dials)

Each storyteller gets one rule that mechanically changes behavior, not just a dial shift:

| Storyteller | Unique mechanic |
|---|---|
| The Chronicler | Maintains a "narrative coherence" bonus: 3 back-to-back thematically consistent nodes give the 4th a +50% score bonus in the same theme. Rewards staying in a story thread. |
| The Ash Prophet | At a random node every 8–12 nodes, forces a "dark omen" mini-event that sets a negative flag with future consequences. No player choice to avoid it. |
| The Warbringer | Tracks player "momentum": each combat win in a row adds +10% enemy budget to the next fight (up to +50%). Win streaks feel like escalating action. |
| The Trickster | Every 6th Director decision is completely random — ignores soft scoring, picks from the full unfiltered pool weighted uniformly. Can produce surprising sequences. |
| The Pilgrim | The discovery reward pool is 3× larger. Lore and hidden-node events have 2× base weight. Rest events restore an extra 10% HP. |
| The Iron Judge | The fallback candidate is disabled. If no eligible candidate passes the hard filter, the game produces an ambush encounter instead. No mercy rest after a brutal fight unless the player has activated a waypoint. |

---

## 9. Campaign Simulator Design

`runCampaign({ seed, storytellerId, difficulty, policy })` is a new headless function in `sim/runCampaign.js`. It does not call `runSimulation` on individual combats (too slow for 100 campaign iterations) — instead it approximates combat outcomes using gear score / level delta math, then writes flags as if real combat happened.

### Policy object

```js
const policy = {
  nodeChoice: 'main_path',      // 'main_path' | 'greedy_loot' | 'random' | 'exploration'
  dialogChoice: 'first',        // 'first' | 'random' | 'skill_optimal' | 'companion_favor'
  skillCheckApproach: 'highest', // 'highest' | 'class_bonus' | 'spend_item' | 'accept_fail'
  retreatThreshold: 0.1,         // retreat if estimated win chance < 10%
};
```

### Campaign log row

```js
{
  nodeId:        'act1_node_012',
  nodeType:      'combat',
  biome:         'emberwood',
  directorIntent:'combat',
  encounterTemplate: 'road_ash_cult_ambush',
  dialogNodeId:  null,
  choiceId:      null,
  skillLabel:    null,
  skillDC:       null,
  skillResult:   null,     // 'pass' | 'fail' | null
  combatWin:     true,
  deathsThisFight: 0,
  hpPctAfter:    0.72,
  goldDelta:     +45,
  xpAwarded:     120,
  flagsSet:      ['cultist_road_cleared'],
  questsAdvanced:['primary_act1_emberwood:investigate_burned_road'],
  companionApprovalDeltas: { lyra_ashwalker: +1 },
  turn:          14,         // node visit order in the campaign
}
```

### Campaign summary report

```js
{
  seed, saltOffset, storytellerId, difficulty, policy,
  outcome: 'act3_complete' | 'dead' | 'abandoned',
  actsCompleted: 3,
  nodesVisited: 87,
  nodeTypeBreakdown: { combat: 32, dialog: 18, shrine: 5, lore: 9, ... },
  combatWinRate: 0.94,
  totalDeaths: 2,
  goldFinal: 2340,
  gearScoreFinal: 48,
  questsCompleted: { primary: 3, secondary: 4, side: 7 },
  flagsSet: ['shrine_purified', 'guardian_redeemed', ...],
  factionsFinal: { emberguard: 4, ashen_veil: -6, ancient_pact: 2 },
  companionApprovalFinal: { lyra_ashwalker: 6, orren_gravetide: 3 },
  durationMs: 14,   // wall clock ms for the sim run
  log: [ ...rows ]
}
```

### Combat approximation (not full simulation)

For each encounter template, `runCampaign` estimates win probability:
```
partyPower = party.avgLevel * 10 + party.avgGearScore * 0.5
enemyPower = encounterBudget
winChance = sigmoid((partyPower - enemyPower) / 8)
```

Then rolls `rng() < winChance`. If win: `deathsThisFight = 0`, `hpPctAfter = 0.55 + rng()*0.4`. If loss (and policy says don't retreat): party is "wounded" (hp → 30%), one death may occur.

This is fast enough to run 1000 campaign iterations in <5 seconds. Accuracy is sufficient for balance tuning; if a pathological storyteller/difficulty combo produces 40% win rates in Act 1 we need to rebalance, and this sim will surface that.

---

## 10. Content Generation Pipeline

### Stage 1 — Authored seeds (templates per category)

Write 12–20 seed templates per category by hand. These establish voice, flag usage, DC calibration, and lore consistency. Categories for v1:

| Category | Seed count | Pool name |
|---|---|---|
| Arrival (entering a town or region) | 12 | `dialogue-pools/arrival.json` |
| Ambush (road combat with pre-fight dialog) | 15 | `dialogue-pools/ambush.json` |
| Shrine (purify, corrupt, examine) | 10 | `dialogue-pools/shrine.json` |
| Merchant (special item, price haggle) | 10 | `dialogue-pools/merchant.json` |
| Lore (ruin inscription, ancient fragment) | 20 | `dialogue-pools/lore.json` |
| Faction (faction NPC encounter) | 15 | `dialogue-pools/faction.json` |
| Companion (companion-specific dialog) | 10 per companion × 6 | `dialogue-pools/companion-<id>.json` |
| Side quest (narrative mini-arcs) | 20 | `dialogue-pools/side-quest.json` |

Total seed templates: ~162 hand-authored nodes. This is the v1 "curated" content. They go live immediately as Stage 1 content.

### Stage 2 — LLM batch generation

Script: `scripts/generate-story-dialog.mjs`.

Uses OpenAI Batch API (async, cheap). Each request:
- System prompt: lore primer (Emberveil world facts, factions, key NPCs, tone guide, example nodes from Stage 1 seeds). ~4000 tokens.
- User prompt: "Generate 5 dialog nodes for pool `arrival.json`, biome `emberwood`, act 1, tone `urgent`. Use only these stats: STR/DEX/INT/CON. Flags must be from this canonical list: [...]". ~1000 tokens.
- Output schema: strict JSON array of dialog node objects.

Run in batches of 20 requests at a time. Total v1 generation target: ~80 batch calls → ~400 additional nodes → total ~560 nodes in content library.

### Stage 3 — Content validator (runs in CI)

`scripts/validate-story-content.mjs` checks every JSON file in `data/story/`:
- Every `next:` id resolves within the same pool OR is `null`.
- Every `flag` in `set_flag` effects is in `data/story/canonical-flags.json`.
- Every `faction` is in `data/story/canonical-factions.json`.
- Every `stat` in skill checks is one of `STR|DEX|INT|CON`.
- Every `skill` label is in `data/story/canonical-skills.json` (the 18 labels).
- Every `dc` is an integer between 8 and 24.
- Every `speaker` has a matching NPC entry in `data/story/npcs.json` OR is `'hero'`.
- Every `biome` id in encounter templates is in `data/story/canonical-biomes.json`.
- No orphan `next:` references across pools (cross-pool references are forbidden).

CI fails the build if any check fails. This is the single biggest quality lever.

### Stage 4 — Voice / lore primer scaffold

The lore primer is authored once in `data/story/lore-primer.md` (3000–5000 tokens). It contains:
- The three-act structure summary.
- All faction descriptions and relationship map.
- All named NPC descriptions (quest NPCs + story companions).
- Tone guide with 5 "write like this" examples and 5 "do not write like this" anti-examples.
- Emberveil world glossary (Emberveil, Ashen Veil, veilfire, veil-touched, etc.).
- Canonical flag list with brief descriptions of what each flag means in narrative terms.

Every generation request includes this primer as part of the system prompt. It is updated as the game's lore evolves. The primer is checked into git and reviewed like code.

### Stage 5 — Review tool

`/assets/story-dialog-review.html` (new tool page). Shows generated dialog nodes in card format. Reviewer can:
- Mark a node as Approved / Rejected / Needs-Edit.
- Approve flow: same script pattern as `approve-image-review-v2.cjs` — copy IDs, run script.
- Rejected nodes are moved to `data/story/_rejected/` for potential later salvage.
- Needs-Edit nodes are flagged in a pending queue for human editing in the JSON.

The tool reads from `data/story/dialogue-pools/*.json` (after generation) and shows approval status tracked in `data/story/dialogue-review-state.json`.

---

## 11. OpenAI Sprite Plan (20 NPCs + 20 Enemies/Bosses)

All sprites go through `scripts/openai-spritesheet-gen.py` (the existing openai_v2 pipeline). Every regen enrolls in the open review batch (M462 rule).

### 20 NPCs (story + recurring)

| ID | Name | Role | Archetype for gen |
|---|---|---|---|
| `captain_maer` | Captain Maer | Emberguard faction gate NPC | humanoid/warrior, heavy armor, visor helmet |
| `lyra_ashwalker` | Lyra Ashwalker | Story companion - ranger | humanoid/ranger, fur-lined cloak, scarred |
| `orren_gravetide` | Orren Gravetide | Story companion - knight | humanoid/warrior, cracked pauldrons, world-weary |
| `tessaly_veil` | Tessaly "Veil" | Story companion - rogue | humanoid/rogue, face-wrap, twin knives |
| `bram_coldfire` | Bram Coldfire | Story companion - mage | humanoid/mage, ink-stained robes, spectacles |
| `yasha_stonewill` | Yasha Stonewill | Story companion - monk | humanoid/monk, stone-grey wraps, calm expression |
| `ash_prophet_npc` | The Ash Prophet | Storyteller / ambient NPC | humanoid/caster, ash-dusted, hollow eyes |
| `veil_shrinekeeper` | Veil-Touched Shrinekeeper | Shrine NPC | humanoid/priest, partially veiled face |
| `elderwood_hermit` | Elderwood Hermit | Lore NPC, Act 1 | humanoid/elder, bark-covered robe, lantern |
| `ashen_veil_herald` | Ashen Veil Herald | Faction NPC, cult | humanoid/caster, ash mask, robes |
| `brightfall_innkeeper` | Innkeeper Holda | Rest/merchant NPC | humanoid/civilian, stout, apron |
| `road_scout_npc` | Road Scout Eryn | Quest NPC, path reveal | humanoid/ranger, young, travel-worn |
| `bone_reader` | The Bone Reader | Lore divination NPC | humanoid/elder, bone jewelry, trance state |
| `faction_envoy_thornpact` | Thornpact Envoy | Faction NPC, forest | humanoid/rogue, leaf-cloak, wary |
| `veil_convert` | Converted Villager | Ambush/dialog NPC | humanoid/civilian, blank expression, cult brand |
| `swamp_guide` | Swamp Guide Rael | Guide NPC, Act 2 | humanoid/ranger, swamp-stained, tall |
| `merchant_unusual` | Unusual Merchant | Rare merchant NPC | humanoid/civilian, layered coats, mismatched eyes |
| `rift_warden` | Rift Warden | Act 3 faction NPC | humanoid/warrior, veil-branded armor |
| `ancient_guardian_npc` | Ancient Guardian Spirit | Boss dialog NPC | elemental/construct, ember glow, stone-formed |
| `marek_greel_story` | Marek Greel (unhooded) | Act 3 reveal NPC | humanoid/scholar, mid-reveal, one eye veil-lit |

### 20 Enemies/Bosses

| ID | Name | Family | Archetype |
|---|---|---|---|
| `ash_cultist` | Ash Cultist | cultist | humanoid/warrior, ash-smeared, basic robes |
| `ash_ritualist` | Ash Ritualist | cultist | humanoid/caster, ritual markings, staff |
| `veil_sprite` | Veil Sprite | veilspawn | elemental, small, shimmering purple |
| `corpse_lantern` | Corpse Lantern | undead | construct/undead, floating skull lantern |
| `bog_witch` | Bog Witch | beast/caster | humanoid/caster, swamp-witch, dripping |
| `stonehide_boar` | Stonehide Boar | beast | beast/quadruped, stone-plated hide, charging |
| `storm_harpy` | Storm Harpy | beast | beast/avian, lightning-feathered, screaming |
| `ember_drake_small` | Ember Drake (small) | dragon | beast/reptile, ember-colored, wingless juvenile |
| `veil_shade` | Veil Shade | veilspawn | elemental, humanoid silhouette, fully shadowed |
| `ash_golem` | Ash Golem | construct | construct, ash-formed, heavy and slow |
| `cultist_captain` | Cultist Captain | cultist/elite | humanoid/warrior, ornate ash armor, champion |
| `drowned_soldier` | Drowned Soldier | undead | humanoid/warrior, waterlogged, hollow sockets |
| `bone_revenant` | Bone Revenant | undead/elite | humanoid/undead, reassembled bones, glowing sutures |
| `veil_hulk` | Veil Hulk | veilspawn/elite | elemental/construct, massive, pulsing tears in its form |
| `corrupted_guardian` | Corrupted Guardian | boss/act1 | construct/boss, ancient stone figure, ember corruption |
| `plague_herald` | Plague Herald | boss/optional | humanoid/boss, masked, disease-cloud aura |
| `veil_champion` | Veil Champion | boss/act2 | humanoid/boss, fully veil-transformed, mirror weapon |
| `den_mother_ash` | Den Mother (Ash) | beast/boss | beast/boss, large wolf-bear hybrid, ash-branded |
| `architect_fragment` | Architect's Fragment | boss/optional | construct/boss, reality-torn, floating geometric pieces |
| `emberveil_sovereign_story` | Story Mode Sovereign | boss/act3 | construct/elemental/boss — the final act boss variant |

All 40 sprites use `scripts/openai-spritesheet-gen.py` with the M463 3×3-grid workflow (chroma-key #00FF00, tolerance 64, despill r10, slice to 256×256). Every sprite is enrolled in an open review batch before use.

---

## 12. Audio, Achievements, and Telemetry

### Audio

Current: `MapScreen.onEnter` plays `playOverworldMusic(act, zoneId)`. Story Mode adds:

**Per-biome music tracks (3 acts × 3–6 biomes = up to 18 tracks):**
- v1 target: 9 tracks covering the 5 major Act 1/2/3 biomes. Generate via ElevenLabs sound tool (same pipeline as M64).
- Naming convention: `public/music/story_act<N>_<biomeId>.ogg`.
- `StoryMapScreen.onEnter` calls `playOverworldMusic(act, biomeId)` — the existing function signature is extended with a biome override parameter.

**Storyteller tinting:**
- Ash Prophet: +15% reverb on music (WebAudio GainNode chain). Implemented as a CSS `filter: saturate(0.7)` visual tint AND an audio convolver node on the music gain chain.
- Iron Judge: lower music volume (-6dB), louder sfx for combat.
- Trickster: random pitch variation (±5%) on music track start.
- All others: no tinting.

**Story event SFX:**
- New: `sfx/story_waypoint_activate.ogg`, `sfx/story_path_reveal.ogg`, `sfx/story_quest_advance.ogg`, `sfx/story_companion_banter.ogg`, `sfx/story_faction_hostile.ogg`.
- Generate these 5 SFX via ElevenLabs. All ogg per the existing optimize_audio pipeline.

### Achievements

New achievement candidates for Story Mode:

| ID | Title | Trigger |
|---|---|---|
| `story_first_run` | Chronicler's Path | Complete any Story Mode run |
| `story_all_storytellers` | Many Voices | Complete a run with each of the 6 storytellers |
| `story_iron_judge_clear` | No Mercy | Complete a run on Iron Judge difficulty |
| `story_max_companion` | Devoted Company | Reach +10 approval with any companion |
| `story_all_companions` | Full Party | Recruit all 6 story companions in one run |
| `story_personal_quests` | Their Stories Too | Complete 4 personal companion quests in one run |
| `story_purify_all_shrines` | Veil-Cleansed | Purify every shrine in a single run |
| `story_low_corruption` | The Ember Holds | Finish Act 3 with world corruption ≤ 20 |
| `story_faction_max` | True Believer | Reach +10 rep with any faction |
| `story_all_hidden_paths` | Every Shadow Revealed | Reveal all hidden paths in a single act |
| `story_no_deaths` | Immaculate Run | Complete a Normal+ run without any party deaths |
| `story_seed_reuse` | Known Ground | Complete a run with the same seed as a prior completed run |

Achievements use the existing `achievements.js` pipeline. New entries added to the achievements data JSON.

### Director Memory (renamed from "telemetry")

The Director's variety tracker is `story.recentHistory` in the save (§5). This is NOT the existing `telemetry.js` emitter. The telemetry emitter continues to fire campaign-level events (campaign start, campaign end, boss defeated) for opt-in analytics. The two systems do not share state.

---

## 13. Authoring and Debug Tool Pages

### `story-inspector.html`

Purpose: Load a Story Mode save file, inspect the full ledger, force flags, and step the Director by one decision.

Key panels:
- **Save loader:** file picker or localStorage slot selector.
- **Map view:** renders the story graph using the same canvas renderer as the game (shared module). Shows node states, revealed paths, waypoints.
- **Ledger dump:** collapsible JSON tree for flags, quests, factions, companions, recentHistory.
- **Director step:** "Step Director" button runs one `getDirectorIntent()` call with the current ledger and displays the intent + the top 5 candidate scores before normalization. Useful for tuning.
- **Flag editor:** text input to set/clear arbitrary flags. Triggers quest condition re-check.
- **Export:** downloads the modified save as JSON for loading back into the game.

### `quest-graph.html`

Purpose: Visualize every quest line's phase graph as a node diagram.

- Reads all quest JSON files from `data/story/quest-lines/`.
- Renders each quest as a directed acyclic graph: phases are nodes, phase transitions are edges, outcomes are terminal nodes (green = complete, red = fail, gold = branching outcome).
- Clicking a phase node shows its `completeCondition`, `onComplete` effects, and the predicate rendered in human-readable form.
- Side panel shows outcome conditions and effects.
- No game-state awareness — this is a static content visualization tool.

### `storyteller-balance.html`

Purpose: Display Monte-Carlo campaign simulator results across storyteller × difficulty combinations.

- Reads `data/story-balance/M*.json` (output of `build-storyteller-balance.cjs`).
- Table of 6 storytellers × 4 difficulties = 24 cells, each showing: median acts completed, win rate, median combat deaths, median node variety score, median companion approval, median factions reached ≥+5.
- Line chart of act completion over 100 simulation runs per cell.
- "Run Sim" button triggers a background JavaScript worker to run `runCampaign` × 100 client-side (for dev tools iteration without a server). Results display live.

All three pages use the existing `_header.js` / `_footer.js` nav and follow the no-inline-CSS policy.

---

## 14. Milestone Re-Baseline

The roast's §8 estimate: ~30 milestones. Below is the ordered sequence for THIS project. Each milestone is one focused deliverable, sized for a typical 12–24 hour co-dev session.

| M# | Phase | Deliverable | Notes |
|---|---|---|---|
| S-1 | Mobile UX wireframe | Finalize sub-region pagination layout; all pixel numbers locked; tap-threshold spec | Design-only; no code |
| S-2 | Save schema + migration | Add `gameMode`, `story.*` stub to saves; fully separate slot scheme; serializer contract | Required before any story data writes |
| S-3 | Campaign simulator harness | `sim/runCampaign.js`; fast combat approximation; policy object; summary report | Required before Director tuning |
| S-4 | Mode split + shell screens | `gameMode` branch in `main.js`; `StoryNewGameScreen`; `StoryMapScreen` stub; `StoryJournalScreen` stub | No content yet |
| S-5 | Story ledger + RNG | `storyLedger.js`; `rngState` checkpoint; `encounterHistory` per-node; `recentHistory` ringbuffer | |
| S-6 | Predicate DSL + effect runner | `evalPredicate()`; `runEffects()`; 10-function API; unit tests | Required before dialog or quest content |
| S-7 | Quest engine | `questManager.js`; phase/condition/effect system; `tickQuestConditions`; `story.quests` state | Long pole; allocate 2 sessions |
| S-8 | Map generator + validator | `worldGenerator.js`; `worldGraph.js`; biome assignment; connectivity validator; sub-region partitioning | |
| S-9 | Story map rendering | `StoryMapScreen` canvas impl; sub-region tabs; node icons; path drawing; drawer peek panel | Extends existing MapScreen pattern |
| S-10 | Dialog conductor | `storyDialogConductor.js`; pool loader; condition evaluation; effect dispatch; dialog history | Name avoids `DialogScreen` collision |
| S-11 | Director engine v1 | `storytellerDirector.js`; hard filter + soft score; 6 storyteller profiles with unique mechanics; fallback candidate | |
| S-12 | Encounter builder | `encounterBuilder.js`; budget formula; role-to-family resolution; node encounter instance; save to `encounterHistory` | |
| S-13 | Enemy/boss configurability | Instance modifier layer on `championModifiers` pattern; pre-combat mutation pass; boss flag-aware variants | |
| S-14 | Companion system | `storyCompanions.js`; approval meter; banter triggers; recruit/dismiss; party slot integration | |
| S-15 | Content pipeline + validator | `scripts/generate-story-dialog.mjs`; lore primer; `canonical-flags.json`; CI validator; `story-dialog-review.html` | |
| S-16 | Authoring tools | `story-inspector.html`; `quest-graph.html`; `storyteller-balance.html` | |
| S-17 | Content batch v1 | 12–20 seed templates per category hand-authored; 400+ LLM-generated; review pass; deploy | |
| S-18 | Sprite generation batch | 20 NPCs + 20 enemies via openai_v2; review; approve; wire to appearances manifest | |
| S-19 | Quest content v1 | 3 primary quest lines; 6 secondary quest lines; full authored phases and outcomes | |
| S-20 | Companion personal quests | 6 personal quest lines; banter pool per companion pair; approval delta authoring | |
| S-21 | Audio v1 | 9 biome music tracks; 5 story SFX; storyteller audio tinting hooks | |
| S-22 | Achievements | 12 new achievement definitions; wire triggers to story events | |
| S-23 | XP curve + difficulty | Story Mode XP table (flatter, 3-act range); permissive scaling definition; v1 balance pass | |
| S-24 | Simulator tuning pass | Run 100-campaign batch per storyteller × difficulty; read `storyteller-balance.html`; adjust weights | |
| S-25 | Mobile QA pass | iPhone 14 Pro Safari full playthrough; touch target audit; safe-area audit; 60 FPS check | |
| S-26 | World pressure + rumor system | `pressureMeter` mechanic; rumor pool in towns; Director integration | |
| S-27 | Regional control + scouting | Faction region tints; scouting dialog class bonuses; faction fast-travel restrictions | |
| S-28 | Memory events integration | "Echo" callbacks from prior flags; spared-bandit shortcut pattern; consequence flags in dialog pools | |
| S-29 | Content batch v2 | Second generation pass; 200+ additional nodes; focus on side quests and faction dialog | |
| S-30 | v1 release + retrospective | Full campaign playthrough; bug pass; release.sh; deploy; roast-triage audit | |

**Total: 30 milestones.** The user runs ~1–2 milestones per session. Estimated calendar: 15–30 sessions. This is the honest answer.

S-3 (campaign sim) must precede S-24 (tuning) but can run in parallel with S-4 through S-14. S-6 (predicate DSL) must precede S-10 (dialog) and S-7 (quests). No other hard dependencies on ordering within each cluster.

---

## 15. Net-New Ideas (The Brainstorm)

These ideas are NOT in the original plan or the roast. Each is rated on cost (engineering sessions) and payoff (replayability impact). All carry forward the "no silent shelving" constraint: each is proposed as a feature candidate for a specific milestone, not a vague "later" entry.

---

### Idea 1 — Rumor System as Real Mechanic (Cost: 1 session, Payoff: HIGH)

**What:** Towns and rest sites generate 2–3 rumors per visit from a `rumor-pool.json`. Each rumor is a hint string linked to an optional node, hidden path, or rare merchant. Hearing a rumor makes the linked entity visible on the map with a "?"  marker.

**Why it's more than a feature:** It creates a pull model for exploration. Players who want to explore seek out taverns. It's a soft fast-travel substitute (you know where to go next because the innkeeper mentioned it). It also lets the Director seed the map without dumping everything up front.

**Mechanic:** `story.rumorPool[]` tracks active rumors. When a player visits a town, the Director appends 2 rumors from the pool that match the current act/biome. Clicking a "?" node shows the rumor text. Reveals are permanent — once the rumor fires, the node is visible.

**Target milestone:** S-26 (World Pressure + Rumor System).

---

### Idea 2 — Memory Shrine (Spend Gold to Undo a Choice) (Cost: 2 sessions, Payoff: MEDIUM-HIGH)

**What:** Every 8–12 nodes, a "Memory Shrine" node appears (Director-placed). Interacting with it allows the player to undo the last major dialog choice for a gold cost (e.g., 200 gold + a lore fragment as tribute). The shrine only retains one choice back — it forgets after use or after the player travels 3 nodes.

**Why it works:** Reduces panic-saves and reload frustration without removing consequence. The gold cost is meaningful. Players feel agency without the game being consequence-free.

**Implementation:** Save the last major dialog choice in `story.lastUndoableChoice: { nodeId, choiceId, flagsSet, goldDelta, timestamp }`. The shrine's effect runner calls `undoChoice()` which reverses the stored delta and re-routes to that dialog node.

**Target milestone:** S-28 (Memory Events Integration) — natural companion to consequence-echo systems.

---

### Idea 3 — Scarification System (Failed Checks Leave Stat Marks) (Cost: 1 session, Payoff: HIGH)

**What:** When the party fails a skill check by more than 4 points (a bad failure, not a near-miss), they gain a "scar": a permanent story flag that grants +1 to a *different* stat or skill label. The idea is that adversity teaches — failing a Stealth check leaves a mark that makes the next Survival check slightly easier.

**Why it works:** Softens the sting of failure. Creates an interesting character-through-play narrative. "We failed to sneak past the ash cult — but watching how they move taught Orren something about endurance."

**Mechanic:** Scar table is authored JSON: `{ skillLabel: 'stealth', failBy: 4, scarsGiven: [{ skillLabel: 'survival', bonus: 1 }] }`. Scar bonuses accumulate in `story.flags['scar_<label>_<n>']` and are read by `flagBonus()` in the skill check resolver.

**Target milestone:** S-10 (Dialog Conductor) — the resolver already has a `flagBonus()` hook; scarification is just authored entries in the flag bonus lookup.

---

### Idea 4 — Companion Swap Mid-Act (Cost: 0.5 sessions, Payoff: MEDIUM)

**What:** At waypoints and rest sites, the player can swap one active story companion for an inactive one (who remains off-screen "at camp"). The inactive companion's approval still ticks slowly based on major world events (half-deltas from the ledger).

**Why it works:** The roster of 6 companions with only 1 companion slot forces hard choices. Swapping at waypoints makes the roster feel alive and strategically interesting. It also means players who recruit everyone still benefit from all six.

**Implementation:** `story.companions` already tracks all companions. Active slot is `story.activeCompanionId`. Swap is a simple UI action in the waypoint panel. The inactive companion gets `approvalDelta * 0.5` from major events (flag-based).

**Target milestone:** S-14 (Companion System) — native to the companion design.

---

### Idea 5 — Regional Weather Affecting Encounter Pools (Cost: 1 session, Payoff: MEDIUM)

**What:** Each sub-region has a daily weather state (rolled on map generation): Clear, Rain, Ash Fall, Fog, or Storm. Weather modifies encounter pool eligibility and dialog tone tags.

- Fog: ambush encounters +30% weight; stealth checks +1 DC (harder to see).
- Rain: beast encounters +20%; lore ruins can be "washed readable" (bonus lore node chance).
- Ash Fall: corruption encounters +40%; shrine interactions add "ash-tainted" complication.
- Storm: travel hazard encounters enabled; merchant nodes paused (they sheltered).

**Why it works:** Low-code variety. Weather is a roll on map gen, so it's deterministic per seed. Players on second playthroughs will notice "last time this was foggy, this time ash fall — the encounters will be different."

**Implementation:** `worldGenerator.js` rolls weather per sub-region. It's stored in the node's `biomeModifiers: { weather: 'fog' }` field. Director's hard filter checks weather compatibility per encounter template. Existing encounter templates get a `weatherCompatible: ['all'] | ['fog', 'rain']` optional field.

**Target milestone:** S-8 (Map Generator) — weather is a property of the generated graph.

---

### Idea 6 — Echo Combat (Replay a Key Prior Fight with New Context) (Cost: 2 sessions, Payoff: HIGH)

**What:** At certain shrine or dream nodes in Act 3, the player fights an "Echo" of a boss they defeated in Act 1 or 2, but with a twist — the boss is powered by a story choice the player made. If they spared a village and the village was later corrupted, the Echo boss fights *with* the village's ghost soldiers. If they allied with the Emberguard, the Echo boss has Emberguard armor.

**Why it works:** Creates the "feels consequential" moment players remember. Reinforces the narrative without new dialog. It's a mechanical callback to story choices.

**Implementation:** An echo boss node type in the Director's intent pool. `echoConfigurator.js` reads `story.bossHistory` + key story flags and assembles the `statMultipliers`, `addSkills`, and `instanceName` for the echo fight. Uses the existing instance-modifier layer from §13.

**Target milestone:** S-28 or S-29 — requires companion and boss systems to be in place first.

---

### Idea 7 — Faction-Controlled Fast-Travel Restriction (Cost: 0.5 sessions, Payoff: MEDIUM)

**What:** If a faction has regional control AND the player's reputation is ≤ -3 (hostile), fast travel through their zone is blocked. Instead, the player gets a "forced challenge" — a faction patrol encounter at the waypoint, or can pay a bribe (gold × hostility level).

**Why it works:** Makes faction reputation viscerally consequential on the map level. Players feel the difference between "Emberguard rep 4" and "Emberguard rep -6" not just in dialog but in travel cost.

**Implementation:** `mapTraversal.js` checks faction control + rep before confirming fast travel. If blocked, offers: fight the patrol / pay the bribe / abort. The patrol encounter is pulled from the faction's encounter pool. Rep change: fight success gives +1 rep (showed strength), paying gives +0 (they took your gold), aborting gives -0.

**Target milestone:** S-27 (Regional Control) — natural add-on.

---

### Idea 8 — "The Toll" Debt System (Cost: 1 session, Payoff: MEDIUM-HIGH)

**What:** Some dialog choices offer an "accept a later cost" option — the player gets an immediate benefit (bypass combat, skip skill check, get a resource) but a "Toll" is recorded in the ledger. Tolls are collected at the act's climax node by a narrator figure ("You made promises. Now the Architect's herald arrives to collect them."). The collection event is a set of encounters or resource drains proportional to unpaid tolls.

**Why it works:** Creates the D&D "warlock's patron" feel — you can take shortcuts but you can't dodge consequences forever. Gives the story a mechanical villain presence even before the final act. Players who never take tolls have an easier climax; players who leveraged every shortcut have a harder one.

**Implementation:** `story.pendingTolls: [{ type, value, source }]`. Each toll has a type (gold, combat, flag). The climax node runs `collectTolls(gs)` which bundles them into a single confrontation event. Authored in `data/story/toll-collection.json`.

**Target milestone:** S-26 or S-27 — works well alongside the pressure meter mechanic.

---

These 8 ideas are net-new. Ratings summary:

| Idea | Cost (sessions) | Payoff |
|---|---|---|
| 1. Rumor System | 1 | High |
| 2. Memory Shrine | 2 | Medium-High |
| 3. Scarification | 1 | High |
| 4. Companion Swap | 0.5 | Medium |
| 5. Regional Weather | 1 | Medium |
| 6. Echo Combat | 2 | High |
| 7. Faction Fast-Travel Restriction | 0.5 | Medium |
| 8. The Toll Debt System | 1 | Medium-High |

Top three by payoff-per-cost: Scarification (1/High), Rumor System (1/High), Faction Fast-Travel (0.5/Medium). All three are add-ons to milestones already in the schedule — they do not require new milestones.

---

## Summary

This brainstorm resolves every roast finding, produces concrete implementation options for the five "must-decide-before-code" items, and adds 8 net-new ideas. The key decisions made:

1. **Mobile map:** Option A (sub-region pagination), extending the existing FTL horizontal-scroll canvas.
2. **Skill-check axis:** 4-stat-with-skill-labels; no new stat sheet; `classBonusForSkill` lookup table; `flagBonus` for earned expertise.
3. **Predicate DSL:** Declarative JSON (`all`/`any`/`not`/`flag`/`faction`/`quest`/`counter`/`class`/`companion`/`stat`); 30-line parser; lint in CI.
4. **Save schema:** Fully separate Classic/Story slots; `story.*` sub-tree additive; per-namespace schema versioning; RNG state checkpointed after every Director decision.
5. **Quest engine:** 10-function API; phase/condition/effect model; authored JSON; uses the same effect runner as dialog.
6. **Companion system:** 6 named companions; approval -10..+10; personal quests at +3; banter as non-blocking overlay.
7. **Director scoring:** Multiplicative, decay-weighted, two-layer (hard filter + soft score); unique mechanic per storyteller; fallback candidate always valid.
8. **Campaign simulator:** `runCampaign()` with fast combat approximation; policy object; per-node log; used for balance, not correctness.
9. **Content pipeline:** 12–20 hand-authored seeds per category; LLM batch generation to ~560 total v1 nodes; CI validator; review tool.
10. **Milestones:** 30 sessions, honest. S-1 through S-30 in ordered table.
