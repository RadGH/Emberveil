# Roast: Emberveil 2 "Story Mode" Implementation Plan

**Reviewer:** senior code review pass
**Plan reviewed:** `/home/radgh/.claude/uploads/.../b5843e84-emberveil_story_mode_claude_plan.md`
**Codebase:** `/home/radgh/claude/game13/` (Emberveil), commit on `main` 2026-05-20
**Target platform per `CLAUDE.md`:** iPhone 14 Pro, **393×852 CSS px, portrait-locked, touch-only.**

This is not a hatchet job for sport. The plan is structurally OK as a wish list. It is dangerous as an *implementation* plan because it (a) repeatedly assumes systems exist in Emberveil that don't, (b) ships an LLM-generated content target two orders of magnitude larger than what's currently in-repo, (c) was clearly drafted against a desktop landscape mock-up that physically cannot render on the actual target device, and (d) makes math handwaves that fall over the first time you simulate them. Below is the receipts pass.

---

## 0. TL;DR — the five things that will sink this if you don't fix them up front

1. **"Reuse existing dialog/quest/companion/telemetry systems."** The plan treats four nonexistent systems as if they were turnkey. `quests.js` is 122 lines and is a 5-beat boss-kill state machine, not a quest engine. `companions.js` is 65 lines and is a stat-scaling adapter — there is no companion logic system to "reuse" for companion banter, faction reactions, or roster management. `telemetry.js` exists but is a 239-line opt-in event emitter, not a "story event variety tracker." Dialog is *technically* branching at the node level but every event is hand-authored as a flat `nodes:{}` map with hardcoded `next:` ids — there is no condition language, no flag-precondition gate on choices, no quest-phase linkage, no skill+class+faction+item combinator. **Plan-stated "branching dialog" is a misread of the source.**
2. **2000–5000 dialog-node target is a fantasy budget.** The entire shipping content library today is `dialogEvents.js` (1913 lines) + `randomEvents.js` (3608 lines) + `recurringNpcEvents.js` (1465 lines) ≈ ~7000 lines of JS-as-data for **roughly 100–200 nodes** total. The plan asks for 10–25× more content with an "AI batch generate" hand-wave and zero word on the validation, lore-consistency, voice, dedup, or review cost. There is no schema or test suite proposed for that content — it will rot the moment a name or flag id changes.
3. **The map UI mock cannot exist on the device.** The user's prompt described the reference image as a wide horizontal world map with a left legend, a right party-status panel, a bottom recent-history dock, three inset thumbnails, and a centered node graph. The actual target is **393 CSS px wide, portrait.** That mock is ~1400 px wide minimum. The current `MapScreen.js` is already a horizontal-scroll canvas of fixed-y zone strips (`x: 0.06–0.92, y: 0.5±0.4`); the plan implicitly requires a free-positioned 50–75-node graph and **never explains how that fits.** It cannot, as drawn.
4. **The Director scoring example is naïve enough to break itself.** Penalty constants (−8, −10, −12, −20) are larger than any plausible `baseWeight` mentioned anywhere, so the first two same-type-in-a-row picks drive every candidate of that type to negative and the third pick is whatever candidate accidentally had the highest base. With six storytellers × four difficulty presets × five tuning sliders the candidate-space combinatorics aren't accounted for at all, and there's no soft-temperature/no-stochasticity term — once you go negative you stay negative until the recent window expires. This will *feel* mechanical, not "directed."
5. **"Simulator" is overloaded.** The plan says "validate 100 full campaigns in sim." Emberveil's `src/game/simulator.js` is a **combat-only** Mulberry32-seeded turn loop (1389 lines, focused on DPS/TTK/EHP/Monte-Carlo). `sim/runloop.js` is a 60-line wrapper that fires ACT 1→6 boss-sequence encounters back-to-back with full HP between fights. **There is no campaign simulator.** Saying "we'll just simulate it" elides the entire scope: map gen → director decisions → dialog choices → flags → encounter selection → economy → progression curve. Building *that* simulator is bigger than building the Director.

If you fix only one thing before writing code: fix #3, because the UX is the contract with the user and everything else can be re-architected behind it. Fix #1 second because it's the difference between "Story Mode is a delta on Classic" (achievable) and "Story Mode is a parallel rewrite" (24-milestone slog).

---

## 1. Source-vs-plan: every "reuse existing X" claim, checked

The plan's preamble says verbatim:

> "Story Mode should reuse the existing combat engine, classes, skills, items, status effects, gear score concepts, character levels, damage logs, enemy spell data, and existing content registries wherever possible."

and later:

> "Use the existing Emberveil systems for combat resolution, skills, items, loot, classes, enemy base data, saves, and telemetry wherever possible."

Let's grade each claim by actually reading the modules.

### 1.1 Combat engine — TRUE-ish

- `src/ui/screens/CombatScreen.js` (≈ huge — 8000+ lines per `SITE_OVERVIEW.md`) is the live combat path.
- `src/game/simulator.js` (1389 lines) is the headless mirror, well-factored and seeded.
- Combat *can* be invoked with an arbitrary encounter; that's what `runSimulation({ heroes, encounter, act, seed })` does and what `runloop.js` already exercises.
- **Caveat:** combat takes `encounter` (with `enemies: [{ id, count, ... }]`) and `act` for NG+ scaling. The plan's "enemy instance modifier" object (`statMultipliers`, `addSkills`, `replaceSkills`, `addTags`, `statusOnStart`, `affixes`) is **NOT** the encounter shape. You'll need a translation layer that flattens the modifier into the existing `encounter.enemies` entries before either path will accept it. Plan: not mentioned. Effort: real.
- `championModifiers.js` (185 lines) and `affixes.js` (78 lines) already do *some* of this — there is a champion modifier system layered on enemies. The plan never references them; whoever implements this needs to either extend that system or explain why they're parallel-tracking it.

**Verdict:** combat is genuinely reusable. The instance-modifier layer is **new code, not reuse.**

### 1.2 Classes / skills / items / status effects — TRUE

- `src/game/classes.js` (59 lines — small because the data lives in `public/data/entities/heroes.json` and is loaded through `dataLoader.js`).
- `src/game/skills.js` (154 lines — registry + `getUnlockedSkills`, `mergeSkillForCast`).
- `src/game/items.js` (1064 lines — drives gear, scoring, generation).
- `src/game/statusEffects.js` is 20 lines (a constants file); `statusModel.js` and `statusTick.js` do the work elsewhere.
- `src/game/formulas.js` is 744 lines and is the actual mathematical truth.
- All of these are healthy, modular, JSON-fed, and stable. **The "use existing data registries" line is the most-true thing in the plan.**

**One concrete trap:** the plan's skill-check resolver:

```js
const checkPower =
  statValue
  + character.level
  + Math.floor( gearScore.utility / 10 )
  + classRelevanceBonus
  + storyFlagBonus
  + randomRoll;
```

is not how Emberveil's stat system shapes up. Current dialog skill checks (see `forest_enter`, `seer_hut`, `wood_test` in `zones.js`) are pure `stat: 'STR' | 'DEX' | 'INT' | 'CON', dc: <int>` rolls — there is no "skill" axis (no "stealth", "intimidation", "arcana" stat). The plan introduces 18 D&D-style skill categories *and* re-maps them to classes *and* asks the Director to track per-skill usage, but the underlying attribute system is four stats. **You're proposing a parallel skill taxonomy without engaging with the four-stat reality.** Either (a) commit to mapping skill-category → stat (intimidation→STR, stealth→DEX, etc.) and own the loss of fidelity, or (b) actually add a 18-axis skill system to the character sheet and accept that it's a Classic-Mode visible change.

Don't pretend (c) — "use existing skills" — works. It doesn't, because "skills" in Emberveil means combat abilities (`Power Strike`, `Heal`), not D&D skill-checks.

### 1.3 Quests — **FALSE.** This is the single biggest misread.

`src/game/quests.js` in full is **122 lines.** It defines:

- `QUEST_NPCS` (Silas / Kaela / Marek — three recurring narrative characters).
- `QUEST_STATUS` constants.
- `MAIN_QUESTS` — five act-tagged objects, each with **one** `autoCompleteOnBossKill` boss id. That's literally the whole engine: kill an act boss → flip a status enum on `gs.quests[id]`.
- `SIDE_QUESTS` — ten bounty entries shaped `{ id, act, title, target, reward: { gold } }`. There are no objectives, branches, phases, or even a `start` function. Side quests are passive bounties unlocked by killing a specific encounter.
- Two functions: `advanceOnBossKill(gs, bossId)` and `ensureMainQuestStarted(gs)`.

The plan describes a quest system with **phases**, **conditions/effects**, **dialogue pools**, **reveal-node effects**, **faction deltas**, **3-5 quest lines × 8-18 nodes each per act**, **multi-outcome quests**, and the equivalent of CRPG quest tracking (active/completed/failed/expired, per-phase dialog, branch-pointer history).

The gap from current → planned is **not a refactor.** It's a new subsystem of at least the size of the dialog manager itself. The plan estimates this at "Phase 4: Quest Placement" with bullet points like "Create primary quest structure / Place mandatory quest nodes / Validate quest reachability." That's wrong by a factor of 5–10× in scope.

**Required call-out:** Phase 4 is the long pole of the entire project. It is *not* "wire some quest nodes into the map," it is "build the quest engine, then wire some quest nodes into the map." Re-baseline accordingly.

### 1.4 Companions — **FALSE in spirit, technically TRUE in stats**

`src/game/companions.js`:

- 65 lines.
- Exports `CLASS_PETS = CLASS_PETS_CANONICAL` (re-export of `public/data/entities/companions.json`).
- `COMPANION_POWER`, `getCompanionPower(member)`, `companionPowerMult(power)`.
- That's the entire module.

In other words: companions exist as a **data registry of stat-blocks** and a **power-tier multiplier.** There is no AI personality, no dialog hook, no banter trigger, no inter-companion approval system, no "rescue this companion in Act 2 changes their dialogue in Act 4" infrastructure.

The plan, however, repeatedly invokes companions:

- "Companion option" as a dialog choice type
- "Companion/class-reactive dialog: 300–800 short dialog variants"
- "Companion event" as an intent type
- "If a companion is in your party, they may interject" (implied by `companionPowerMult` use)
- "Faction ally sends reinforcements" (implies durable named-NPC relationships)

**None of this infrastructure exists.** Adding it is fine; pretending it's already there is a planning bug. Treat companion-reactive dialog as **a new system to be designed in Phase 5**, not as "we just hook into the companion system."

### 1.5 Dialog system — TRUE that it's branching at node level, FALSE that it's the engine the plan wants

`src/maps/dialogEvents.js` (1913 lines) + `recurringNpcEvents.js` (1465 lines) + `randomEvents.js` (3608 lines):

- Each event is a JS object literal.
- Linear events have a `lines: []` array, a `choices: []` array, and an `outcomes: {}` map.
- Branching events use a `nodes: { id1: { lines, choices, outcomes }, ... }` map with `start: '<id>'` and per-choice `next: '<id>'`.
- Choice effects today are a flat shape: `effect: { gold: -10 }`, `skillCheck: { stat: 'DEX', dc: 14, outcomes: { pass, fail } }`, `outcome: 'fight'`, `reward: { xp, gold, item, itemName, itemDesc }`, `setFlag: 'name'`, `requires: { gold: 20 }`.
- The dialog engine itself (`src/ui/screens/DialogScreen.js`, 992 lines) walks one event at a time; it does not chain to other events. When a choice ends, `onComplete(outcome)` fires and the *caller* (MapScreen) decides what happens (start combat, return to map, advance node).

The plan asks for a dialog engine with:

- Conditions (flag, item, resource, faction-rep, class-tag, companion-present, prior-choice).
- Effects (`set_flag`, `quest_advance`, `start_encounter`, `faction_delta`, `reveal_path`, `unlock_waypoint`, `alter_boss`, `delay_consequence`, `start_combat`, `moral_choice`).
- Dialog "pools" indexed by `pool` field, selected by Director.
- Cross-event chaining via `next: 'dlg_<id>'` that crosses **pool boundaries.**
- Per-choice scaling: `difficulty: 12, scaling: 'act_level'`.
- Success/failure forks with separate `effects` per branch.
- Dialog history recorded into the ledger.

**The gap:** the current data shape is a working *subset* of the planned shape, but the engine has none of the condition/effect interpreters, no pool indexer, no cross-event router, no scaling resolver. Adding those is fine — but the existing 5500+ lines of authored content uses the OLD shape and **none of it will speak the new language without a migration pass**. The plan never mentions migrating extant content. If we ship Story Mode with a new dialog DSL, every existing event we want to reuse needs converting. That's a job.

### 1.6 Map / node-graph — **MISMATCH the plan glosses over**

Current `MapScreen.js` (2837 lines) renders an **FTL-style hex-laid horizontal-strip canvas**, one strip per zone. Nodes have `x` and `y` as fractions of zone width/height (`x: 0.06–0.92, y: 0.1–0.9`). Connections are unidirectional `exits: []` arrays. The whole thing scrolls horizontally; cross-zone transitions are special "step off the edge" connectors layered by `_drawCrossZoneLinks`.

The plan wants a **node graph**: 50–75 nodes per act, "weighted routes," "alternate routes," "3–8 hidden or unlockable paths" per act, "biome regions" (3–6 per map), "danger preview," "likely-rewards/likely-skill-check overlays," and "storyteller current pressure" all displayed on the same canvas.

That's a different rendering model AND a different data model:

- **Data:** zones today are linear-ish dags (you walk left-to-right through a small zone, then transition). Story Mode wants a chunky multi-branch graph per act with locked edges, hidden edges, and graph mutation effects (`reveal_path`, `block_path`, `corrupt_node`).
- **Rendering:** 60 nodes won't fit in 393 CSS px without either pan/zoom controls (which the existing map kinda has — horizontal scroll — but only on one axis) or a 2D pinch-zoom map. Either is non-trivial on touch.
- **Validation:** the plan correctly identifies that you need a connectivity validator (`validateGraphConnectivity`, `validateQuestCriticalReachability`, etc.) — this part is sensible. But it's *new* code; not a tweak.

**Sub-issue: locked connections.** The plan defines `lockedConnections` on nodes:

```js
lockedConnections: [{ to: 'node_022', lockId: 'old_mill_hidden_path', revealedBy: ['quest.X.choice.search_cellar'] }]
```

This is fine schema-wise but means **every node in 60-node graphs may carry a non-trivial unlock predicate.** The plan does not propose a predicate language, just a string identifier. Without a predicate DSL you end up with hardcoded checks scattered across the engine — exactly what `public/docs/schema-reference.md` says to avoid (see CLAUDE.md "mod authoring" + the mod-system-shelving rule). Either commit to a real DSL (`flag.X === true && faction.emberguard >= 2`) or accept that every reveal trigger is an authored function — but **don't punt** by saying `revealedBy: [...]`.

### 1.7 Simulator — wrong tool, named the same

Already covered in TL;DR. To say it concretely:

- `src/game/simulator.js` resolves *one combat* with optional Monte-Carlo wrapping.
- `sim/runloop.js` chains hardcoded act sequences (`ACT_SEQUENCE[1].regular = ['goblin_patrol', ...]`) end-to-end.
- The plan's "Run 100 full campaigns" implies a **simulator that runs the whole game loop**: map gen → director chooses node type → encounter built from intent → optional dialog skill-check pre-roll → combat → reward → flags written → director state updated → next node. None of those steps exist in headless form. Even `awardXp` ↔ leveling exists but isn't wired into the playthrough sim cleanly (look at `runloop.js`'s `rebuildForLevel(party, level)` — it's a stub-y rebuild, not a full level-up replay).
- **The Director cannot be validated by `runSimulation`.** You need a new simulator. Plan should say so.

### 1.8 Save format — UNDERSPECIFIED, possibly correct, but the plan glosses

Current save shape (`gameState.js: DEFAULT_STATE`):

- ~50 top-level fields. Several are `Set` instances serialized as arrays (`sneakedNodes`, `visitedNodes`, `usedShrines`, `manuallyUnequipped`).
- `load(saved)` is the migration entry point (line 309). It hand-walks every field with defaults, runs `recalcPassiveStats` on members, merges achievements with global storage, migrates fame to localStorage, etc.
- There's a working migration discipline: `version: 1`, then per-milestone in-place migrations (see M295 potionBelt, M307 Set serialization comment, M314 achievements, M327 fame, M427 power tier).
- Fields like `storyFlags`, `quests`, `seenEvents` are already free-form objects/arrays.

Plan says:

```js
{ saveVersion: 2, gameMode: 'story', storyVersion: 1, story: { ... } }
```

That's *reasonable*. But: there's already a `version: 1` field at root; the plan calls it `saveVersion`. **Use the existing name** or write the rename migration. There's already a `storyFlags: {}` field; the plan re-implements it under `story.flags`. That's a duplication trap. There's already `quests: []` (`gs.quests` is an array of {id→status} entries, populated by `advanceOnBossKill`); the plan wants `story.quests: { questId: phase }`. Decide whether story-mode quests overlay or replace, and write *that down*.

**Concrete spec needed before any code lands:**

| Existing field | Plan field | Disposition |
|---|---|---|
| `version` (root) | `saveVersion` | Rename existing, add migration. |
| `storyFlags` (root) | `story.flags` | Either move all flags under `story.` for both modes, OR keep `storyFlags` global and use `story.flags` only for story-specific. Document which. |
| `quests` (array) | `story.quests` (object) | Different shape! Classic stays array-of-id; story uses keyed object. Adapter required. |
| `seenEvents` (array) | `story.dialogHistory` (object) | Similar collision. |
| `act`, `zoneId`, `nodeId` | `story.act`, `story.currentMapId`, `story.currentNodeId` | Duplicated. Decide canonical owner. |
| `unlockedZones` | implicit in `story.paths`/`story.nodes` | The graph mutation model conflicts with the act-unlock model. |
| `completedBosses` | `story.bossHistory` | Same data, different name. Pick one. |

**Risk:** if Story Mode silently shadows Classic fields, a single buggy load() call (e.g. resuming a Classic save with `gameMode: undefined` after a partial migration) could clobber player progress. Lock this down in writing before phase 2.

### 1.9 Telemetry — partial truth

`src/game/telemetry.js` (239 lines): opt-in event emitter behind `localStorage.rsg_telemetryOptIn`. It emits a fixed list of events (combat win/loss, encounter start, etc.). It is **not** a "story event variety tracker" that the Director can read. The Director needs a `recentHistory` ringbuffer in *state*, not in telemetry. Plan conflates the two — it says "Use existing telemetry" while describing what is functionally a new in-memory analytics store.

**Action:** rename "telemetry" in the plan to "director memory" or "encounter history buffer" and stop implying it ships free.

### 1.10 Achievements — not addressed at all

`src/game/achievements.js` (166 lines) is a working unlock-toast pipeline with global+per-save persistence. Story Mode introduces 20+ obvious new achievement candidates ("complete a run on Iron Judge," "reveal all hidden paths," "spare every faction"). The plan **says nothing about achievements**. Either add a Phase 11 for it, or explicitly defer per the No-Silent-Shelving rule.

### 1.11 Audio cues — not addressed at all

There's a working `audio` system with overworld music per act (`MapScreen.onEnter` plays `playOverworldMusic(act, zoneId)`). The plan creates new biomes (Ashwood, Plague Fen, etc.) and never mentions music. Storytellers should arguably tint the audio mix. Either embrace the work or note it shelved.

### 1.12 Debug / tool pages — not addressed at all

`/assets/*.html` (image-review-v2, dialog-inspector, damage-report, etc.) reads JSON manifests produced by `build-*.cjs` scripts during `release.sh`. The Story Mode generated content (storyteller profiles, quest plans, dialog pools, encounter templates, map seeds) would all benefit from a dedicated tool page — *especially* a "Story Inspector" that lets you load a save, dump the ledger, and step the director by one decision. The plan doesn't propose any. **Add: Phase X — Authoring Tools.**

---

## 2. Mobile / UI brutal critique

This is the section that the plan most obviously wasn't written against. The user prompt described the reference image as a landscape map with:

- Wide central node graph
- Left-side legend (node-type colors, danger preview)
- Right-side party-status panel
- Bottom recent-history dock
- Three inset thumbnails (presumably node previews or storyteller portraits)
- "Storyteller current pressure" gauge somewhere

That's a 1280–1600 px wide layout minimum. We have **393 px.** The viewport is portrait-locked per `CLAUDE.md`. Anything wider than 393 either scrolls horizontally, gets crushed to unreadable, or sits behind a drawer.

### 2.1 Things in the plan that physically cannot render at 393 px wide

| Plan element | Why it breaks at 393×852 |
|---|---|
| Side-by-side legend + map + party panel | Three columns need ~300 px each minimum; we have one column. |
| 50–75 node graph with visible labels | Each node needs ~44×44 px tap target + label text. 50 nodes won't fit on a 393×~700 px map area without pan/zoom. Max visible at one time: **8–12 nodes** for thumb-reachable scroll. |
| Danger preview + likely reward + likely skill check on every node hover | There is no "hover" on touch. This must collapse into a tap-opens-details panel. Plan implies hover. |
| Bottom dock with last-10 history items | Eats the safe-area gesture zone (iPhone home indicator is 34 px). |
| Storyteller pressure gauge "always visible" | Adds to the top chrome; you've already got act bar, zone name, gold, fame, party HP-bars. |
| Three inset thumbnails | 393 px / 3 = 131 px each; below the 256-px source size; useless thumbnails. |

### 2.2 The actual existing map screen at 393 px today

`MapScreen.js` works on a 393-px portrait viewport by:

- Horizontal scroll on the map canvas (cssCanvasW > viewport — see comment around line 14 of `SITE_OVERVIEW.md`).
- Zone strip y-axis is `0.1–0.9` of canvas height — single horizontal band of nodes.
- Cross-zone popups (the popups that say "← back to previous zone") position themselves via cssCanvasW so they survive scroll.
- A single zone has ~6–12 nodes laid out left-to-right with vertical splay.
- Tap = travel; node detail is a popup overlay anchored to the node.
- Travel indicator and party-position dot only render on the active zone.

**Story Mode's 50–75-node graph fundamentally does not fit this paradigm.** You either:

1. Split each "act map" into 4–6 sub-regions/screens that the player swipes between (effectively replicating the current zone strip pattern at higher fidelity), OR
2. Build a pinch-zoom 2D pan canvas with a minimap overlay, OR
3. Cap the visible-at-once-graph at ~10 nodes and represent the rest as "exits to other regions" off-screen.

Option 1 is the only one that fits the existing engine + mobile constraints without a 3-milestone UI rewrite. **The plan should pick this and say so.** Option 2 is feasible but expensive and exotic for a turn-based RPG. Option 3 is a degenerate version of 1.

### 2.3 Tap target / touch / safe-area concretes

`CLAUDE.md` mandates ≥44×44 CSS px tap targets. The plan's mock has nodes implied at 24–32 px diameter (typical Slay-the-Spire screenshot density). Won't pass. Realistic mobile spec:

- **Node hit target: 48×48 px minimum** (slightly above the 44 minimum so they don't visually clip each other at small map zooms).
- **Node visual: 32×32 px**, with 8-px transparent halo for hit area.
- **Minimum node-to-node spacing: 56 px center-to-center** (44-min + 12 separation), so a finger can't fat-finger two nodes at once.
- **Map area: max 393×500 px** (leaving ≥250 px for top chrome + bottom drawer + safe areas).
- 393×500 = 196,500 px². Per-node footprint at 56-spacing = ~3,136 px². **Theoretical max ~62 nodes**, realistic max ~30–40 with paths and labels. **A 50-node map needs scroll or zoom. A 75-node map mandates it.**

### 2.4 Safe area + iOS Safari chrome

- Top safe area on iPhone 14 Pro (Dynamic Island): **~59 pt** in portrait.
- Bottom home indicator: **~34 pt**.
- Mobile Safari URL bar (collapsed): **~50 pt** at top.
- Net usable height in Safari, portrait, after status + URL + home indicator + a 56-pt sticky top app bar (zone name, gold, party HP) and a 64-pt sticky bottom action bar (Travel, Rest, Inventory): **roughly 580–620 px for the map content.**

Plan's mock occupies ~95% of a 800 px desktop window. That has to compress to a ~600×393 portrait window. **A 1.4:1 ratio mapped to 0.65:1 ratio. The legend, side panel, dock, and thumbnails — all gone or behind drawers.**

### 2.5 Concrete recommended mobile layout (you asked for numbers)

```
┌─────────────────────────────── 393 ───────────────────────────────┐
│ Top bar (sticky):              48 px tall                          │
│   ◀ Back   |  Act 1: Emberwood  |  ☰ Menu                          │
├────────────────────────────────────────────────────────────────────┤
│ Pressure / Storyteller chip:   28 px tall (collapsed by default)   │
│   Chronicler · Pressure ▮▮▮▯▯                                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ Map canvas: 393 × 520 px                                           │
│   - Horizontal pan ONLY (Y is laid out in 1–2 hex rows)           │
│   - Sub-regions split at biome borders; swipe right at edge        │
│     paginates to next sub-region                                   │
│   - Max visible at once: ~12 nodes                                 │
│   - Node visual 32 px, hit 48 px, spacing 56 px                    │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ Selected node detail drawer (peek): 96 px when collapsed,          │
│   expandable to 360 px on swipe-up                                 │
│     • Node name + biome icon (left)                                │
│     • Danger pips + "likely: combat" tag                           │
│     • [ Travel ] [ Fast Travel ] buttons (44 px tall)              │
├────────────────────────────────────────────────────────────────────┤
│ Bottom action bar (sticky, safe-area inset): 64 + 34 (inset) px    │
│   [ Party ] [ Inventory ] [ Quests ] [ Rest ]                      │
└────────────────────────────────────────────────────────────────────┘
```

Recent-history dock = inside the menu, or a swipe-down "recent events" tray from the top bar. **Not always visible.**
Legend = collapsed into a `?` button in the top bar that opens an info sheet. **Not always visible.**
Three inset thumbnails = dropped entirely. There is no room.
Party status panel = bottom-bar [Party] tap opens a portrait sheet.

**Font sizes:**

- Top bar title: 16px / weight 600.
- Pressure chip: 12px.
- Node labels (always visible): 11–12 px max **at default zoom**. Anything under 11 fails per CLAUDE.md ("≥14 px effective"). To honor 14 px you'd need to drop node-label visibility — show labels only on selected node and on towns/bosses. **This is a real concession the plan needs to make.**
- Drawer body: 14px.
- Button labels: 14–15px / 600.
- Danger / damage warnings: 13px.

**Padding / margins:**

- Outer page padding: 12px L/R (gives content area 369px).
- Node detail drawer internal padding: 16px.
- Tap-button minimum hit: 44×44 (44-pt iOS standard).
- Drawer drag handle: 4×40 px centered, with 24-pt vertical hit padding.

### 2.6 Things the plan never resolves about touch

- **Pan vs. tap conflict.** Pan to move the map, tap to select a node — on touch, this requires a movement-threshold gesture recognizer (typical: 8 px). The current MapScreen handles only single-finger scroll (horizontal). The plan's "click/travel to node" assumption doesn't address pan-vs-tap, multi-touch zoom, or accidental selection while scrolling.
- **Long-press for preview.** Plan implies "hover to see node preview" — on touch the equivalent is long-press (≥500 ms) or always-show-detail-of-currently-selected. The latter is what you actually want. Spell it out.
- **Pinch zoom.** If you allow it, you need a minimum/maximum zoom (0.7×–1.5× is typical) and a snap-back. If you don't, you need pagination/sub-region tabs. The plan picks neither — silent ambiguity.
- **Hidden paths visualization.** A "lockedConnection" needs to draw something — dashed line? Question mark? A faded silhouette? Plan doesn't say. On mobile, it cannot be a hover-only "secret revealed on mouseover."

### 2.7 Plan's "Map UI should show" list, mobile-graded

> Plan: "Map should show: Current act/map, Biome regions, Node icons, Paths, Locked/hidden paths if discovered, Quest markers, Waypoint outlines, Danger preview, Likely rewards, Likely skill checks, Known faction control, Storyteller current pressure"

Grading each on a 393-px portrait canvas:

| Item | Verdict | Recommendation |
|---|---|---|
| Current act/map | ✅ fits in top bar | Keep |
| Biome regions | ⚠️ background tint OK, named labels conflict with node labels | Use color band, label only on first scroll into region |
| Node icons | ✅ | Keep at 32 px |
| Paths | ✅ | 2 px stroke; dashed for hidden |
| Locked/hidden paths if discovered | ✅ once revealed; ❌ before reveal (shouldn't draw) | Don't render undiscovered |
| Quest markers | ✅ | Pin overlay on node corner |
| Waypoint outlines | ✅ | 4 different stroke colors per state |
| Danger preview | ⚠️ on-node pip cluster works, ✋ on-tooltip-hover doesn't | Pips on node, full text in drawer |
| Likely rewards | ❌ no room on-node | Drawer only |
| Likely skill checks | ❌ no room on-node | Drawer only |
| Known faction control | ⚠️ region tint conflict with biome tint | Use a faction-banner icon at region centroid |
| Storyteller current pressure | ✅ but secondary | Collapsible chip, default collapsed |

So **6 of 12 items break on mobile in the plan's "always visible" form.** They need to be re-spec'd as drawer/sheet/sub-screen content. Plan should not list them as map overlays without acknowledging the cost.

### 2.8 Performance: 50–75 nodes on canvas, mobile DPR=3

`CombatScreen.js` already targets a 60 FPS canvas at DPR=3. The map is currently single-strip with maybe ~12 nodes at once and very little redraw cost. Story Mode at 75 nodes with animated waypoint pulses, danger pulses, and faction-control region tints could **double the per-frame fillrate.** That's not catastrophic but it's not free. Profile pass needed in Phase 10.

---

## 3. Content volume reality check

> Plan target: 2000–5000 dialog nodes, 500+ encounter templates, 200+ quest/event templates, 100+ named NPCs, 500+ lore fragments.

Let's check the cost honestly.

### 3.1 What we have now

| Module | Lines | Approx node count |
|---|---|---|
| `dialogEvents.js` | 1913 | ~40 events, mostly single-screen, some branching with 3–7 nodes |
| `recurringNpcEvents.js` | 1465 | ~30 events |
| `randomEvents.js` | 3608 | ~100 events (one-screen each) |

Conservatively: **~170 events / ~250 dialog "nodes"** today, hand-authored over 200+ milestones.

The plan asks for 10–30× more content. At human-authoring speed (≈ one polished event with branches per hour), that's **300–500 hours of writing.** Per `CLAUDE.md` the user is a solo developer with Claude as co-pilot — and Claude can generate, but the *review* cost is the bottleneck. Reviewing 2000 nodes at 30 seconds each is 17 hours of pure click-through.

### 3.2 LLM batch-generation: what actually breaks

The plan says "do not generate prose at runtime; instead, generate a large library of authored or AI-authored JSON content ahead of time." **Fine in principle. Fatally underspecified in practice:**

1. **Voice drift.** Two batches of 500 nodes each, generated days apart, will have different prose voices. Existing `dialogEvents.js` has a *very specific* tonal register — "He raises his blade. 'Should've paid up!'" — slightly clipped, slightly mock-grim, regularly self-aware. An LLM batch without aggressive style-pinning will produce purple fantasy boilerplate. Style-pinning across thousands of nodes requires a style guide + repeated few-shot examples — and even then drifts.
2. **Lore consistency.** "The Architect" is a specific recurring antagonist (Marek Greel; quests.js line 30–34). The lore corpus (`lore.js`, 227 lines) defines specific factions, gods, places. A generated batch will invent contradictory lore unless every prompt is grounded in a lore primer. **The primer itself needs to be ~5K tokens long** to be useful, and you pay that on every generation call.
3. **Quest-flag wiring.** Every authored dialog choice today references concrete flags (`thornwood_brave`, `knows_rift_origin`, `seer_paid`). An LLM batch will hallucinate flag names unless given the canonical list. Even then, novel flags will get coined; deduping post-hoc is hand-work.
4. **Skill-check DCs.** The Director wants `difficulty: 12, scaling: 'act_level'`. LLM-generated DCs will be arbitrary numbers unless rule-pinned. A balance pass is required for every batch.
5. **Speaker name + portrait wiring.** Every dialog event has `npcName` + `npcPortrait`. Where do portraits come from? Existing pipeline: SpriteCook + OpenAI 9-pose + PixelLab (per `SITE_OVERVIEW.md`). 100+ named NPCs = 100+ portrait generations at ~$0.05–$0.20 each. **$50–$200 of OpenAI image spend.** Tractable but worth budgeting.
6. **Reward-table coupling.** Choices grant items (`{ reward: { item: 'veil_lens' } }`). Items are defined in `items.js` (1064 lines). LLM-generated rewards will reference nonexistent item ids unless given a closed item registry.
7. **Reload-loop QA.** No way to QA 2000 nodes by playing — you have to **lint** them. The plan briefly mentions `storyValidation.js` but proposes no real schema. **You need a JSON schema + a CI check + a content-coverage map** (every flag mentioned exists; every `next:` points to a real id; every `requires:` is a valid resource; every `skillCheck.stat` is one of STR/DEX/INT/CON; etc.).

### 3.3 Token cost

Rough math: a polished branching dialog event is ~600–1000 tokens output (5–10 lines, 3–5 choices, 2–3 outcomes). 2000 events = 1.2M–2M output tokens.

- At GPT-4o-mini rates (~$0.60/1M output), that's $0.72–$1.20 total. Cheap.
- At GPT-4o or Claude Sonnet rates (~$15/1M output), $18–$30 per pass.
- **Multiple passes** for revision/voice-correction: 3–5×. So **$50–$150 of LLM spend per major content batch.**

That's affordable. But hidden costs:

- Input tokens for the lore primer, flag list, item registry, NPC roster, style guide: easily 5K–10K tokens **per generation call.** With 2000 calls, that's 10M–20M input tokens, ~$1–$3 input cost — fine, but throttle-bound.
- Rate limits: at ~3 requests/sec on a paid tier, 2000 events is 11 minutes of pure API time. Easy to slip into hours when retries kick in.

**Conclusion:** the API spend is cheap, the *engineering around* the generation is not. Building the generator harness (schema + linter + lore primer + flag bookkeeping + portrait pipeline + voice-style-check) is ~2–3 milestones of work that the plan estimates as "Phase 9: Content Expansion." That's optimistic by 3–5×.

### 3.4 What's a defensible v1 content target

Drop one zero:

- **200 dialog nodes total at v1** (matches today's ceiling, plus ~50 new for the storyteller hooks).
- **50 encounter templates** (uses existing encounters as the spine).
- **20 side-quest templates.**
- **3 act bosses with 2 variants each.**
- **15 named NPCs.**

Ship that. Then iterate the content pipeline. The "2000–5000 nodes" is a 12-month aspiration, not an M-1 target.

---

## 4. Storyteller Director math

The plan's example scoring function:

```js
function scoreCandidate( candidate, history, storyteller ) {
  let score = candidate.baseWeight;
  if ( history.recentNodeTypes.includes( candidate.type ) ) score -= 8;
  if ( history.sameTypeStreak >= 2 && candidate.type === history.lastNodeType ) score -= 20;
  if ( history.recentEnemyFamilies.includes( candidate.enemyFamily ) ) score -= 10;
  if ( history.recentSkillChecks.includes( candidate.primarySkill ) ) score -= 12 * storyteller.skillCheckVariety;
  if ( !candidate.themeTags.some( tag => storyteller.preferredThemes.includes( tag ) ) ) score -= 5 * storyteller.thematicConsistency;
  return score;
}
```

### 4.1 Bug #1 — penalty magnitudes vs. weight magnitudes

`candidate.baseWeight` is never defined in scale. If templates ship `baseWeight: 10`, then a single -20 streak penalty makes the candidate impossible. If they ship `baseWeight: 100`, the penalties are noise. **The plan has no calibration, no spec for `baseWeight` ranges.** Default human authoring will scatter all over.

**Fix:** define `baseWeight` as in [0, 1] (probability mass) and convert penalties to multiplicative factors:

```js
score *= history.sameTypeStreak >= 2 && candidate.type === history.lastNodeType ? 0.05 : 1;
score *= history.recentEnemyFamilies.includes(candidate.enemyFamily) ? 0.6 : 1;
```

Then normalize over all candidates and sample. **Cleaner, debuggable, no negative-score weirdness.**

### 4.2 Bug #2 — `recentNodeTypes.includes()` collapses time

A flat `includes()` on the last-10 buffer means a combat 1 turn ago and a combat 10 turns ago contribute identical penalty. **Use a decay:**

```js
const recencyPenalty = (idx) => Math.pow(0.7, idx); // 1.0, 0.7, 0.49, 0.34, ...
```

### 4.3 Bug #3 — `storyteller.skillCheckVariety` and `storyteller.thematicConsistency` are multipliers on penalties, but if `0` they zero out the penalty entirely. That means a storyteller with low thematic consistency *also* turns off the off-theme penalty — which is the right direction, but if `skillCheckVariety = 0` then *all* skill checks are equally allowed including the same one back-to-back. Probably not intended. **Spec the valid range and behavior at 0.**

### 4.4 Bug #4 — No floor / no escape

If every candidate scores negative, the function returns negatives and the consumer just picks "max" — which is the *least bad* option but might still be repetitive. **Add an escape valve:** if all candidates score below a threshold, force an interrupt (rest node, lore beat, mercy event). The plan's rule list mentions interrupts but does not wire them into the scoring loop.

### 4.5 Bug #5 — Director "intent" vs. candidate `type` mismatch

The Director outputs an `intent` like `{ category: 'combat', preferredEnemyRoles: ['frontline', 'caster'] }`. Then the encounter builder picks a template. **But the scoring function above is operating on `candidate.type` and `candidate.primarySkill` — those are template-level fields, not intent-level.** The plan conflates the two layers: it proposes both that the Director picks intents AND that the Director scores candidates. Which is it? Two-layer is fine but each layer needs its own filter/score logic. Plan doesn't separate.

### 4.6 Missing guardrails

The plan's "minimum rules":

- "Do not allow more than 3 combat nodes in a row unless Warbringer/Iron Judge allows it."
- "After 4 nodes without a meaningful choice, force a dialog or skill-check choice."
- "Before a boss, give at least 1 opportunity for recovery."

These are **hard rules**, not scoring rules. The plan never spec'es the interaction: do hard rules pre-filter candidates, then score? Or do they patch the score? Or do they bypass scoring entirely? Three different implementations, three different behaviors. Spec.

Also missing:

- **Anti-softlock guarantee.** If the Director is asked for a node and no candidate passes all filters, what happens? Crash? Fallback? The plan must specify a fallback candidate (e.g., a "generic travel beat" node that's always valid) or the game hard-crashes mid-run.
- **Seed determinism.** Plan says "deterministic from seed where possible." Director state mutates *during* play (recentHistory grows, flags get set). A deterministic seed gives you map gen + initial pool, but the actual sequence depends on player choices. Spec that determinism applies to **generation**, not to **play**.
- **Difficulty regression.** "After a brutal fight, increase chance of rest, merchant, lore." How is "brutal" detected? `recentPerformance.tooHard` is referenced in the encounter budget but never defined. Spec.

### 4.7 Storyteller profiles overlap

Six storytellers × seven multipliers and a `rules` object. Cosine-similarity-wise, "Chronicler" and "Pilgrim" are 90% the same except `combatFrequency`. The plan doesn't acknowledge this — the user will notice. Either differentiate harder (give each storyteller a *unique mechanic*, not just dials) or admit they're presets and ship 3 with clearer differentiation: "Balanced / Combat-heavy / Exploration."

---

## 5. Architecture concerns

### 5.1 22 new modules dumped into `src/story/`

```
storyMode, storyState, storyLedger, storytellers, storytellerDirector,
storyDifficulty, worldGenerator, worldGraph, mapTraversal, waypoints,
nodeGenerator, encounterDirector, encounterBuilder, enemyConfigurator,
bossConfigurator, questManager, dialogManager, dialogConditions,
storyRewards, storyTelemetry, storyValidation
```

Problems:

- **Naming bleed:** half of these (`enemyConfigurator`, `bossConfigurator`, `encounterBuilder`, `dialogManager`) overlap with the *existing* parallel concerns (`championModifiers.js`, `affixes.js`, `bossPhases.js`, `enemySpells.js`, `DialogScreen.js`). Unclear whether story versions wrap, replace, or fork.
- **Dependency graph:** `worldGenerator` → `worldGraph` → `mapTraversal` → `waypoints` → `nodeGenerator` → `encounterDirector` → `encounterBuilder` → `enemyConfigurator`. That's a deep stack. Without explicit interface contracts, this becomes a god-package.
- **Cross-cutting state:** `storyState` and `storyLedger` are nominally distinct but the plan never says where one ends and the other begins. `storyState` is in-memory? `storyLedger` is persistent? Both? Pick one.
- **Where does runtime UI live?** The plan defines 22 logic modules and **zero UI modules.** But Story Mode adds:
  - New Game screen options (mode + storyteller + 5 sliders).
  - Map UI (the graph view).
  - Node detail drawer.
  - Storyteller pressure HUD.
  - Quest journal expansion.
  - Faction reputation screens.
  - Fast-travel waypoint picker.
  - Director debug panel (for dev).
  
  That's 8+ new screens/overlays in `src/ui/screens/`. The plan's UI section is one page; the engine section is fifteen. Skewed.

### 5.2 ScreenManager / mounting

`src/main.js` mounts `ScreenManager` which manages a stack of screens. Pushing/popping is the lifecycle. Story Mode-specific screens need:

- `StoryMapScreen` (replacing or extending `MapScreen`)
- `StoryDialogScreen` (extending `DialogScreen` for the new effect language)
- `StoryNewGameScreen` (mode picker)
- `StoryJournalScreen` (quest log, faction rep, ledger summary)

Plan does not name a single screen class. Without these, the engine work is unused.

### 5.3 GameState load() will balloon

Currently `load(saved)` is ~80 lines of careful per-field migration. Adding the story sub-tree adds:

- A nested object with ~15 fields.
- Several of those are Maps/Sets (path-visibility, recent-history ringbuffers).
- Serialization of `RecentHistory` (last-10-of-X) — pick whether it's `{nodes: [], enemies: [], skills: []}` or a flat structured log.

Spec the (de)serializer up front. Otherwise this gets reimplemented three times.

### 5.4 Determinism across reload

Plan: "Story Mode must be deterministic from seed where possible."

In practice: after a reload, the map state is reloaded from the save (good), but the Director's RNG state is **gone** unless explicitly persisted. The mulberry32 RNG in `simulator.js` is great for sim-time determinism — but for live play, you have to checkpoint the RNG state after every committed choice. **Plan doesn't say.** Suggest:

- `story.rngState: <number>` saved every time the Director makes a decision.
- Director reads it on resume, continues the stream.
- Mid-event RNG decisions (skill check rolls, encounter rolls) commit *after* resolution, not before.

### 5.5 Migration / branching saves

If the player starts a Story Mode save, plays 4 hours, and then the team ships M-Story-5 with a renamed flag (`shrine_purified` → `shrine_purification.complete`), all in-flight saves break. The plan's migration section is one short paragraph. Migrating live in-flight Story Mode saves is **much harder than migrating Classic** because:

- Quest phase ids appear in every dialog node's `effects: [{ type: 'quest_advance', phase: 'X' }]`.
- Renaming a phase id requires either a save migration or pinning of the old name forever.
- The ledger is the source of truth for what the player has experienced — accidentally erasing it via a migration bug ruins the run.

**Mandate up front:** schema versioning per content namespace (`dialogVersion`, `questVersion`, `storyContentVersion`), and a `migrate(fromVersion, toVersion, saveData)` function in each. The plan does not have this.

### 5.6 Mode-split runtime cost

> Plan: "Classic Mode should not load Story Mode systems unless needed."

In a Vite build, lazy-loading is `import()` calls. The plan implies all `src/story/*.js` files are tree-shakeable. They mostly are — but the gameState shape change (adding `story.*` fields) bleeds into the gameState module, which is loaded on every screen. So "Classic doesn't pay the cost" needs an explicit definition: do Classic saves carry empty `story.*` fields? (Plan says no, line ~1820.) Then what's the default when a Classic save migrates to a version that knows about Story Mode? The plan says "Never assume old saves have story data" — fine, but ScreenManager has to be told whether to mount StoryMapScreen or MapScreen based on `gs.gameMode`. That branch should live exactly once, in main.js's entry router. Plan doesn't show it.

### 5.7 Build / release pipeline

Per `SITE_OVERVIEW.md`, `release.sh` runs ~6 manifest builders. Story Mode introduces:

- `build-story-content-manifest.cjs` — validate every JSON file in `data/story/*`, cross-link, lint.
- `build-story-coverage.cjs` — report which content is reachable, which orphans exist.
- `build-storyteller-balance.cjs` — Monte-Carlo each storyteller × difficulty against the campaign simulator and emit `public/assets/data/story-balance/M*.json`.

All net-new. Plan doesn't mention any of them. Add to Phase 9–10 honestly.

### 5.8 Debug tooling

A Story Mode without a debug panel is going to be unshipable. You need:

- `/assets/story-inspector.html` — load a save, dump ledger, view current map, step Director, force flags.
- `/assets/storyteller-balance.html` — view Monte-Carlo results across storyteller × difficulty.
- `/assets/quest-graph.html` — visualize each quest line's branch tree from the JSON.

Plan: silent.

### 5.9 The mod system

`public/docs/mod-authoring.md` exists. Per CLAUDE.md memory, the mod system is "v1 JSON schema/DSL; anything that can't be expressed gets shelved with a reason." Story Mode introduces:

- Storyteller profiles (data) ✅ moddable
- Dialog pools (data) ✅ moddable
- Encounter templates (data) ✅ moddable
- Director scoring function (code) ❌ not moddable in v1
- Map gen algorithm (code) ❌ not moddable in v1
- Skill-check resolver (code) ❌ not moddable

That's three things to add to the "shelved features" list per the existing policy. Plan: silent.

---

## 6. Specific call-outs

### 6.1 The plan invents 18 D&D skills without engaging with the actual stat system

Already covered in §1.2. Worth repeating: this is the single biggest design-vs-engine collision. Either map skill → stat (lossy, fine) or add the skill system (large, expensive, Classic-Mode visible). **Pick.**

### 6.2 "Permissive Scaling: On/Off" — what does this do?

Mentioned once, never defined. Cut or specify.

### 6.3 "Hidden paths cannot be the only way to complete primary progression unless the reveal is guaranteed"

A "guaranteed reveal" is a contradiction with "hidden." Either the reveal predicate is satisfiable on every legal run (in which case it's not really hidden) or it's not (in which case it can lock out completion). The plan needs a precise definition of "guaranteed" — e.g., "the reveal trigger has a >0 probability path regardless of choices."

### 6.4 "Validation must guarantee... If validation fails, regenerate the map with the same seed plus an incremented salt"

Two issues:

1. Salt-bumping after validation failure means the seed → map mapping is **not** stable. The user who says "seed XYZ123" gets *different* maps depending on validation luck. Make this explicit and visible (display the actual salt at gen time) or sidestep it.
2. Validation can fail forever (degenerate template + bad biome assignment). Cap attempts and **specify the fallback** (e.g., use a known-good "safety net" template). Plan doesn't.

### 6.5 "Faction reputation" — never defined as a numeric range or thresholds

The plan uses `faction_delta: { faction: 'emberguard', amount: -1 }` and later `Faction reputation` as a Director input. But no range (-10 to +10? 0 to 100?), no thresholds (hostile/neutral/friendly bands), no decay model. Spec.

### 6.6 "Companion presence" as a dialog condition with no Companion model

Repeated. See §1.4.

### 6.7 "World corruption level" — never defined

Mentioned 4 times across the plan ("corruption increase," "world corruption," "corrupted zones"). Is it a 0–100 meter? Per-region tag? Boolean? Spec or cut.

### 6.8 "Boss should react to story... if shrine purified, boss gains dialog option to redeem"

This conflates *content* (a new dialog branch) with *mechanic* (a stat change). The current `bossPhases.js` (108 lines) is a phase-threshold table; it does **not** read story flags. Wiring it requires either (a) story-flag-aware phase config or (b) pre-combat encounter-mutation pass. Plan calls for (a) implicitly; the engine is (b). Pick.

### 6.9 "Memory events" — echoes from prior choices

Plan: "A spared bandit opens a shortcut." Lovely. Engine cost: high. You need every memorable choice to leave a memo in the ledger that a later event-selection pass can lookup. **This is the entire engine you've built — just write that down.** Plan presents memory events as a "creative addition" tacked on at the end; they're actually a load-bearing core feature.

### 6.10 "Rumor system" / "regional control" / "scouting" / "soft failure" / "world pressure meter"

All listed under "Creative Additions Worth Including." All five are systems, not features. Each is ~1–2 weeks of engineering. Either accept them as Phase 11+ or cut. Don't ship them as a 4-bullet "additions" list.

### 6.11 The `validBiomes: ['emberwood', 'old_road', 'ashwood']` problem

Encounter templates carry `validBiomes: [...]`. Biomes are defined in some other file (`biomes.json`, not yet existing). The cross-reference is never tied off — there's no "this set of biome ids is canonical, every template must reference one of these." A linter for this is mandatory. Plan: not specified.

### 6.12 The XP-curve / progression / leveling story

Story Mode says "1 act = 55 nodes default" and "Total campaign: 185 visible/hidden nodes." Currently the game's leveling curve is tuned for ~50–80 encounters per playthrough. Tripling it (to 185 nodes, of which 40–70 are combat) **fundamentally changes the leveling curve.** The plan doesn't address whether Story Mode uses Classic's XP curve, a flatter one, or its own.

### 6.13 Hardcore / NG+ / fame interactions

Existing systems: `hardcore: false` (permadeath), `ngPlus: 0`, `fame` (global counter), `bossKillsLowHp`, `enemyKillCount`. Does Story Mode contribute to fame? Does Hardcore work in Story Mode? Does Story Mode have its own NG+? **Plan: silent on all three.**

### 6.14 Achievements interaction with Story Mode

See §1.10. Plan: silent.

### 6.15 The dialog `next:` pointer crosses pool boundaries

Plan: `next: 'dlg_brightfall_gate_002'`. That's a global id reference across pools. Once you have 2000 nodes, accidentally pointing into a removed/renamed node is the most common error. Lint for orphan `next:`. Plan does not specify a lint.

### 6.16 The "Dialog Manager" vs. "DialogScreen" naming collision

Plan introduces `dialogManager.js`. Engine has `src/ui/screens/DialogScreen.js`. These will be confused on every code review. Name them `storyDialogConductor.js` or similar to disambiguate.

### 6.17 "Skill checks should not be just stat rolls"

The plan's own example skill check (Brightfall gate) is literally a stat roll: `check: { skill: 'intimidation', stat: 'str', difficulty: 12, scaling: 'act_level' }`. The "skill" field is a label, not a mechanic. Internally inconsistent.

### 6.18 No content/balance feedback loop

Plan has a "Phase 10: Polish and Balance" but the deliverables are bullet points ("Tune storyteller profiles. Tune encounter budgets. Tune reward pacing."). With 6 storytellers × 4 difficulties × ~50 encounter templates = 1200 cells. Manual tuning of 1200 cells is not feasible. The Monte-Carlo sim is what makes this tractable — but, see §1.7, that sim doesn't exist. **Build the sim first.**

### 6.19 Existing recurring NPC arcs collision

`recurringNpcEvents.js` (1465 lines) already implements a recurring-NPC system (Iris, Garrick, Tomek, Krix, Veya, Dorn, Kessa…). It's hand-authored per-zone. Story Mode's "100+ named NPCs" is an order of magnitude bigger and structurally different (faction-bound vs zone-bound). The plan never mentions the existing arcs. **Either deprecate them, fold them into the Story Mode faction system, or document that they continue parallel.**

### 6.20 The "telemetry for variety" gap

The Director needs *real-time* variety tracking. Existing telemetry is opt-in event emit. They're different things. Already covered in §1.9 but bears repeating: rename.

---

## 7. Concrete numbers (padding / safe area / fonts / counts)

You asked for exact numbers. Here:

### 7.1 Mobile map viewport allocation (393×852, portrait, iPhone 14 Pro)

| Element | Height (px) |
|---|---|
| iOS status bar / safe area top | 47 (Dynamic Island region) |
| In-app top bar (sticky, act + menu) | 48 |
| Optional storyteller chip (collapsible) | 28 |
| Map canvas content | 520 |
| Node detail drawer (peek state) | 96 |
| In-app bottom action bar | 64 |
| iOS home indicator safe area bottom | 34 |
| **Total** | **837** of 852 |

Slack: 15 px for borders/dividers.

### 7.2 Map content geometry

- Pannable content width: at least **1×viewport (393)** for small maps; up to **3×viewport (~1180 px)** for full acts.
- Pannable content height: **1 row of nodes** (fixed) — y-position assigned to lane (0.2 / 0.5 / 0.8) — same as current FTL grid.
- Node visual radius: **16 px** (32 px diameter).
- Node hit area radius: **24 px** (48 px diameter).
- Minimum node center-to-center spacing: **56 px** horizontal, **48 px** vertical.
- Path stroke width: **2 px** solid; **2 px dashed** for hidden-but-revealed paths.
- Edge label / "DC 14" badge font: **11 px**, only on selected node.

### 7.3 Max nodes visible at once

At 393 px width × 520 px map height, with 56-px minimum spacing:
- Horizontal slots: floor((393 - 32) / 56) + 1 = **~7 columns**
- Vertical slots (3 lanes): **3 rows**
- **Max ~21 nodes visible without scrolling.**

For a 55-node Act 1, that's **~3 horizontal screens** of pannable content. Doable. For 75 nodes, ~4 screens. Borderline.

### 7.4 Font scale

| Element | px | Weight |
|---|---|---|
| Top bar title | 17 | 600 |
| Top bar subtitle (zone name) | 13 | 400 |
| Storyteller chip | 12 | 500 |
| Node label (when shown) | 12 | 600 |
| Selected node label | 14 | 600 |
| Drawer heading | 17 | 700 |
| Drawer body | 14 | 400 |
| Drawer DC / danger tags | 12 | 600 |
| Button (primary action) | 15 | 600 |
| Button (secondary) | 14 | 500 |
| Tooltip / hint | 11 | 400 |

Note: 11 px is below the CLAUDE.md ≥14 minimum for body text. **Reserve 11 px for inline badges and tooltips only**, not for any text the player needs to read at length.

### 7.5 Panel breakpoints

- **393 px (target):** drawer + sticky bars; map is single canvas with horizontal pan + sub-region pagination.
- **480 px (small tablet portrait, secondary support):** same layout; map gets slightly wider.
- **768 px (iPad portrait):** allow side-by-side: 50% map / 50% drawer.
- **1024 px+ (desktop):** allow the full "plan mock" layout with sidebars. But this is **not a target.** Don't optimize for it.

### 7.6 Touch / interaction thresholds

- Pan threshold: **8 px** movement before pan starts (tap is committed if released within 8 px).
- Long-press threshold: **500 ms** (for "preview node without traveling" — but prefer "tap-selects + drawer-shows-details" instead).
- Double-tap: **disabled** on the map (conflicts with double-tap-to-zoom in Safari, which we don't want).
- Pinch zoom: **disable for v1.** Pagination handles scale.
- Swipe-up on drawer: **expand from 96 → 360 px**, with snap points.

### 7.7 Performance targets

- 60 FPS sustained on iPhone 14 Pro Safari.
- Map repaint: ≤ 8 ms per frame.
- 75-node graph cap: if frame time exceeds 12 ms, drop pulse animations on non-selected waypoints.
- Cold start (Story Mode new game button → map first paint): ≤ 1.5 s.

### 7.8 Storage

- Story content JSON: target **<400 KB gzipped** for the full content library (v1 with 200 dialog nodes, 50 encounter templates, etc.).
- Per-save story ledger: target **<50 KB**.
- Hard cap: if a save grows past 200 KB the cloud-save throttling in `cloudSaves.js` starts misbehaving — check before shipping.

---

## 8. Re-baselined phase plan (what the plan should have looked like)

The plan's 10 phases are roughly correct in order but wildly wrong in size. Rough re-estimate, in milestone units:

| Plan phase | Plan estimate | Real estimate | Notes |
|---|---|---|---|
| 1. Safe mode split | "1 milestone-ish" | 1 M | Fine |
| 2. Story ledger | "1 M" | 2 M | Needs full save migration + RNG checkpoint |
| 3. Map generator | "1 M" | 3 M | New screen + new data shape + connectivity validator + sub-region pagination UX |
| 4. Quest placement | "1 M" | 4 M | This is the build-quest-engine phase, not a placement phase |
| 5. Dialog system | "1 M" | 3 M | New condition/effect DSL + migrate or fork from existing 5500 lines |
| 6. Storyteller director | "1 M" | 3 M | Engine + scoring + interrupts + RNG + UI chip |
| 7. Encounter builder | "1 M" | 2 M | Templates + budget + role-to-family resolution |
| 8. Enemy/boss configurability | "1 M" | 2 M | Instance modifiers + flag-aware variants |
| 9. Content expansion | "1 M" | 4–8 M | Pipeline + linter + initial 200 nodes; further M's per content pass |
| 10. Polish/balance | "1 M" | ongoing | Needs the campaign-sim from phase 0.5 to be useful |
| **(Missing) 0.5. Campaign sim harness** | not in plan | 2 M | Must precede phases 6, 7, 10 |
| **(Missing) 11. Authoring tools** | not in plan | 2 M | Story inspector / quest graph viewer / balance dashboard |
| **(Missing) 12. Mobile map UX** | not in plan | 3 M | The thing that actually ships to the user |

**Total: ~30 milestones of work**, not the implied 10. The user runs roughly one M per ~12–24 hours of co-dev time, so this is a calendar-quarter project at minimum.

Surface this. The user can decide to do it; they cannot decide to do it under false pretenses.

---

## 9. The things that ARE right about the plan

(So the roast is honest.)

1. **Separating Director-intent from encounter-construction is the right architecture.** A two-layer pipeline (intent → template selection → instance generation) is correct and matches how RimWorld and FTL actually work.
2. **Persisting generated encounters per node so re-entry doesn't reroll is correct.** Solves an obvious save-scum exploit.
3. **Author content + procedural placement is the right principle.** Don't generate prose at runtime. Plan got this right and emphasizes it.
4. **Connectivity validation + regen-on-fail is the right map-gen pattern.** Slay-the-Spire does exactly this.
5. **Soft failure as a design principle** ("Failed choices should usually change the story rather than simply punish the player") is correct and underused even in pro RPGs.
6. **Don't mutate base enemy templates, build instances.** Correct and matches the existing `affixes`/`championModifiers` pattern.
7. **Six storytellers is a defensible UX surface.** Cuts hard if user-testing shows overlap, but starting there is fine.
8. **Save versioning + Classic compat as a non-negotiable** is the right framing. The execution will need work but the principle is sound.
9. **"Avoid single-required-class bottlenecks" in skill checks** is the right anti-pattern call.
10. **Memory events / world pressure / regional control** are *good ideas*, even if they're underestimated as "creative additions." Don't drop them — re-categorize them as core systems with their own phases.

---

## 10. Final mandate before any code lands

The plan as written is not implementable. Before any line of `src/story/*.js` is touched, the following must be resolved on paper:

1. **Decide the skill-check axis** — 4 stats (current), 18 D&D skills (plan's implicit ask), or a hybrid (skill→stat map). Write down the resolver function with one example per axis.
2. **Decide the map UX** — single canvas pan/zoom OR sub-region pagination. Pick one. Wireframe at 393×852.
3. **Spec the predicate language** — `flag.X && faction.Y >= N && !item.Z` or named-function dispatch. Pick one. Provide a parser sketch.
4. **Spec the save schema diff vs. Classic** — every renamed/duplicated field gets a row in §1.8's table with a chosen disposition.
5. **Spec the content schema** — JSON schema for dialog nodes, quest phases, encounter templates, storyteller profiles. With validation in CI.
6. **Spec the campaign simulator** — what does `runCampaign({ seed, storyteller, difficulty })` return? Build that *before* tuning Phase 10.
7. **Spec the content budget v1** — pick a real number. 200 dialog nodes, not 2000. Pick a number you can hand-write or LLM-generate-then-review in one milestone.
8. **Spec the Director scoring math** — multiplicative not additive, normalized, with decay, with floor/escape. Worked example with numbers.
9. **Spec the Phase 0.5 sim harness** and the Phase 11 tool pages.
10. **Audit no-silent-shelving items** — for everything in §6 marked "Plan: silent," either implement it or write down "Story Mode v1 will not include X because Y" and confirm with the user.

Until these are pinned, every implementation milestone will rediscover the same gaps and "decide" them ad hoc, which is exactly the pattern CLAUDE.md's M46–M53 retrospective forbids.

---

## 11. One paragraph for the cover letter

The "Emberveil 2 Story Mode" plan is a thorough product brief masquerading as an implementation plan. As a product brief it's directionally fine: mode split, procedural map with authored content, storyteller-as-director, branching dialog with skill checks, faction/quest persistence — these are the right targets. As an implementation plan it is dangerous because it repeatedly cites Emberveil systems that don't exist (the 65-line companions module, the 122-line quest stub, the absent campaign simulator, the absent skill-check resolver, the absent condition/effect DSL), it sets a 2000-5000-dialog-node content target ~20× the current ceiling with no generation/validation pipeline, it sketches a desktop landscape map UI that physically cannot fit a 393×852 portrait-locked iPhone target, and its Director scoring math is naïve enough to fail on its first stress test. Re-baselined honestly the project is ~30 milestones, not 10, and the first three milestones should be **Mobile UX wireframes**, **Save-schema spec and migrations**, and **Campaign simulator harness** — *before* writing any Director, Quest, or Generator code. Re-scope content to ~200 dialog nodes for v1, spec the predicate/effect DSL on paper before coding, pick exactly one skill-axis model (4 stats vs 18 skills), and decide once-and-for-all which save fields are shared with Classic vs. namespaced under `story.*`. With those guardrails in place the plan is buildable. Without them, it ships a half-built Director on top of a content library too thin to feel different from Classic, on a UI that doesn't fit the device.
