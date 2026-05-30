# Dialog & Encounter Inspector — Design Plan

**Tool name:** `dialog-inspector.html`
**Location:** `public/assets/dialog-inspector.html`
**Data file:** `public/assets/data/dialog-inspector.json`
**Build script:** `scripts/build-dialog-inspector.cjs`

---

## 1. Purpose

A static developer tool that lets the Emberveil maintainer:
- Browse every dialog event (flat `RANDOM_EVENTS`, branching `DIALOG_EVENTS`, injected `M304_DIALOG_NODES`, `BOSS_DEATH_DIALOG`), every encounter (`ENCOUNTERS`, `PROLOGUE_ZONES`, hidden-boss encounters, dungeon stages), and every world-map node (by zone and node type) in one pane.
- Edit text, choices, outcomes, rewards, and encounter stats inline in the browser without a server.
- Track only the fields that were actually changed (the "diff").
- Generate a ready-to-paste Claude Code prompt that pinpoints exactly which file, which export, which object key, and which field changed.

---

## 2. Page Layout

The tool is a two-column desktop layout (desktop-only; tool pages in this project explicitly tolerate non-mobile use). Portrait-phone layout folds to single-column tabs for cases where someone needs it on-device, but it is not optimised.

```
+--------------------------------------------------------------+
|  [NAV HEADER — _header.js]                                  |
+--------------------------------------------------------------+
|  FILTER BAR (sticky)                                         |
|  [type: all / dialog / encounter / node]  [search…]         |
|  [zone: all / prologue / border_roads / …]                   |
+---------------------------+----------------------------------+
|  LEFT TREE (scrollable)   |  RIGHT DETAIL EDITOR            |
|                           |                                  |
|  Grouped, collapsible:    |  - Identity block (id, name,     |
|    DIALOG EVENTS          |    type badge, source file,      |
|      + shady_wanderer     |    line hint)                    |
|      + forest_enter       |  - Content editors (see §6)      |
|      + …                  |  - Diff highlight bar            |
|    RANDOM EVENTS          |  - [Reset this entry] button     |
|      + merchant_tinker    |                                  |
|      + …                  |                                  |
|    BOSS DEATH DIALOG      |                                  |
|      + grax_veil_touched  |                                  |
|      + …                  |                                  |
|    ENCOUNTERS             |                                  |
|      + goblin_patrol      |                                  |
|      + …                  |                                  |
|    MAP NODES              |                                  |
|      border_roads         |                                  |
|        + start (town)     |                                  |
|        + road_ambush      |                                  |
|          (dialog)         |                                  |
|        + …                |                                  |
|      thornwood            |                                  |
|        + …                |                                  |
+---------------------------+----------------------------------+
|  BOTTOM PROMPT BAR (sticky, above footer)                   |
|  [N edits pending]  [Preview Prompt]  [Copy Prompt]         |
+--------------------------------------------------------------+
```

### Left tree widths
- Left panel: `300px` fixed, non-resizable. Collapsed on mobile (toggle via header button).
- Right panel: fills remaining width, max useful at `700px`, capped at `100%`.

### Visual language
Follows `_tool-styles.css` tokens: `--bg #0a0608`, `--card #1a1218`, `--gold #e8a020`, `--border rgba(232,160,32,0.2)`. Cinzel headings, Inter body. No emoji in content (Font Awesome SVG icons for tree expand/collapse and status badges).

---

## 3. Data Model — `dialog-inspector.json`

The JSON file is a single object with five top-level arrays:

```json
{
  "generatedAt": "2026-05-08T00:00:00Z",
  "dialogEvents": [ ... ],
  "randomEvents":  [ ... ],
  "bossDeathDialogs": [ ... ],
  "encounters":    [ ... ],
  "mapNodes":      [ ... ]
}
```

### 3.1 `dialogEvents[]`

One entry per key in `DIALOG_EVENTS` (plus entries derived from `M304_DIALOG_NODES` that have matching `DIALOG_EVENTS` keys).

```json
{
  "_meta": {
    "sourceFile": "src/maps/mapData.js",
    "exportName": "DIALOG_EVENTS",
    "objectKey": "forest_enter",
    "lineHint": 1508
  },
  "id": "forest_enter",
  "npcName": "Forest Warden",
  "npcPortrait": "images/spritecook/druid_male_portrait.png",
  "bg": "forest",
  "dialogType": "branching",
  "start": "start",
  "nodes": {
    "start": {
      "lines": [
        { "speaker": "npc", "text": "The Thornwood has changed..." },
        { "speaker": "npc", "text": "If you enter, watch the tree lines..." }
      ],
      "choices": [
        { "text": "Press on...", "next": "brave", "reward": { "xp": 15 } },
        { "text": "Offer your time...", "next": "ally", "reward": { "xp": 20 } },
        { "text": "Turn back...", "next": "coward", "reward": { "gold": -5 } }
      ]
    },
    "brave": {
      "lines": [ ... ],
      "choices": [ { "text": "Continue...", "outcome": "enter" } ],
      "outcomes": {
        "enter": { "text": "He steps aside...", "setFlag": "thornwood_brave" }
      }
    }
  },
  "_injectedNode": null
}
```

Flat (non-branching) `DIALOG_EVENTS` use `dialogType: "flat"` and have `lines`, `choices`, `outcomes` directly instead of `nodes`.

**Flag indicators** — any `setFlag` anywhere in the tree is surfaced in the `_meta` extension:
```json
"_meta": {
  ...,
  "setsFlags": ["thornwood_brave", "knows_rift_origin"],
  "requiresFlags": [],
  "rewardsPresent": true
}
```

### 3.2 `randomEvents[]`

One entry per element of `RANDOM_EVENTS`. These are always flat (no multi-node branching); skill-check choices are distinct.

```json
{
  "_meta": {
    "sourceFile": "src/maps/randomEvents.js",
    "exportName": "RANDOM_EVENTS",
    "arrayIndex": 0,
    "lineHint": 10
  },
  "id": "merchant_tinker",
  "minLevel": 1,
  "zone": "any",
  "npcName": "Halvir the Tinker",
  "npcPortrait": null,
  "lines": [
    { "speaker": "npc", "text": "Cogs and gears, friend!..." }
  ],
  "choices": [
    { "text": "Browse wares (50 gold)", "effect": { "gold": -50 }, "outcome": "buy" },
    { "text": "No thanks.", "outcome": "leave" }
  ],
  "outcomes": {
    "buy": { "text": "He hands you...", "reward": { "gold": -50, "item": "repair_kit" } },
    "leave": { "text": "He shrugs..." }
  },
  "_meta": {
    ...,
    "hasSkillChecks": false,
    "rewardsPresent": true,
    "setsFlags": []
  }
}
```

Skill-check choices include the full `skillCheck` sub-object: `{ stat, dc, outcomes: { pass, fail } }`.

### 3.3 `bossDeathDialogs[]`

One entry per key in `BOSS_DEATH_DIALOG`.

```json
{
  "_meta": {
    "sourceFile": "src/game/bossDeathDialog.js",
    "exportName": "BOSS_DEATH_DIALOG",
    "objectKey": "lava_titan",
    "lineHint": 22
  },
  "id": "lava_titan",
  "bossLine": "\"You... quench what cannot be quenched...\"",
  "heroLine": "\"Then let the wastes cool.\"",
  "narratorLine": "Magma hardens around the titan's husk. Steam fills the caldera."
}
```

### 3.4 `encounters[]`

One entry per named encounter (keys in `ENCOUNTERS`, prologue encounters, hidden boss encounters, big-fight overrides). Inline enemy stat blocks from the source are preserved.

```json
{
  "_meta": {
    "sourceFile": "src/maps/mapData.js",
    "exportName": "ENCOUNTERS",
    "objectKey": "goblin_camp",
    "lineHint": 560
  },
  "id": "goblin_camp",
  "name": "Goblin Camp",
  "introText": null,
  "encounterGroup": "act1",
  "isBoss": false,
  "enemies": [
    { "id": "goblin_scout",   "name": "Goblin Scout",   "count": 2, "hp": 120, "dmg": [44,64], "armor": 2, "hit": 80, "dodge": 15, "xpValue": 8 },
    { "id": "goblin_shaman",  "name": "Goblin Shaman",  "count": 1, "hp": 144, "dmg": [52,76], "armor": 1, "hit": 80, "dodge": 10, "xpValue": 18 },
    { "id": "goblin_warrior", "name": "Goblin Warrior",  "count": 2, "hp": 200, "dmg": [56,80], "armor": 5, "hit": 80, "dodge": 8,  "xpValue": 15 }
  ],
  "bossLoot": null
}
```

Hidden-boss encounters include their `bossLoot` object and `precondition` passthrough from `HIDDEN_BOSS_NODES`.

### 3.5 `mapNodes[]`

One entry per node across all zones (PROLOGUE_ZONES, ACT1–ACT6_ZONES). `M304_DIALOG_NODES` injected nodes are marked.

```json
{
  "_meta": {
    "sourceFile": "src/maps/mapData.js",
    "exportName": "ACT1_ZONES",
    "zoneId": "border_roads",
    "nodeId": "road_ambush",
    "lineHint": 1111,
    "injectedVia": null
  },
  "id": "road_ambush",
  "zoneId": "border_roads",
  "zoneName": "The Border Roads",
  "act": 1,
  "type": "dialog",
  "name": "Shady Wanderer",
  "x": 0.28,
  "y": 0.4,
  "exits": ["crossroads_a", "crossroads_b"],
  "encounter": null,
  "dialogEventId": null,
  "shrineType": null,
  "skillCheck": null,
  "hidden": false,
  "precondition": null
}
```

For injected `M304_DIALOG_NODES`, `injectedVia` is `"M304_DIALOG_NODES"` and `dialogEventId` is the matching `DIALOG_EVENTS` key.

---

## 4. Build Script — `scripts/build-dialog-inspector.cjs`

### Strategy

The script uses the same `new Function('return ' + rawBlock)()` eval pattern already established in `emit-game-data.cjs` and `generate-data-catalogs.cjs`. It also uses targeted regex to capture line numbers (for the `lineHint` field) without needing a full AST parser.

### Files scanned

| Source file | Exports extracted |
|---|---|
| `src/maps/mapData.js` | `DIALOG_EVENTS`, `ENCOUNTERS`, `M304_DIALOG_NODES` (regex-scanned as it is a private const), `ACT1_ZONES`…`ACT6_ZONES`, `PROLOGUE_ZONES`, `HIDDEN_BOSS_ENCOUNTERS`, `HIDDEN_BOSS_NODES` |
| `src/maps/randomEvents.js` | `RANDOM_EVENTS` |
| `src/game/bossDeathDialog.js` | `BOSS_DEATH_DIALOG` |

### Line-number extraction

For each export, the script records the 1-based line number of the first `objectKey:` or array element match in the raw source string using `src.slice(0, matchIndex).split('\n').length`. This produces approximate line hints (accurate to ±3 lines), sufficient for Claude to locate the correct block.

### Script outline

```
build-dialog-inspector.cjs
  1. Read src/maps/mapData.js (raw string)
  2. evalBlock(src, 'DIALOG_EVENTS') → object
     - Iterate keys; record lineHint per key
     - Classify each entry: branching (has .nodes), flat (has .lines + .choices + .outcomes directly)
     - Walk all nodes recursively; collect setsFlags / requiresFlags / rewardsPresent
     → dialogEvents[]
  3. evalBlock(src, 'ENCOUNTERS') → object
     - Iterate keys; for each, flatten spread refs to inline stats if present,
       otherwise record ref name as enemyRef string
     - Detect isBoss via introText presence or explicit isBoss flag
     → encounters[] (base)
  4. evalBlock(src, 'HIDDEN_BOSS_ENCOUNTERS') + HIDDEN_BOSS_NODES → append to encounters[]
  5. Read PROLOGUE_ZONES, ACT1–ACT6_ZONES via eval; flatten to mapNodes[]
     - For each node, add _meta.injectedVia if id appears in M304_DIALOG_NODES scan
  6. Scan M304_DIALOG_NODES via regex (private const, not exported)
     - Pattern: const M304_DIALOG_NODES = [\s\S]*?^];  then eval
     - Used only for injection tagging; not emitted as its own category
  7. Read src/maps/randomEvents.js
     evalBlock(src, 'RANDOM_EVENTS') → array
     - Iterate; record arrayIndex + lineHint
     → randomEvents[]
  8. Read src/game/bossDeathDialog.js
     evalBlock(src, 'BOSS_DEATH_DIALOG') → object
     → bossDeathDialogs[]
  9. Write public/assets/data/dialog-inspector.json
     { generatedAt, dialogEvents, randomEvents, bossDeathDialogs, encounters, mapNodes }
 10. Print counts summary
```

### Wiring

Add `build-dialog-inspector.cjs` to `scripts/emit-game-data.cjs`'s companion set OR add a standalone `prebuild` step in `package.json`, or call it from `release.sh` alongside other data generators. Either is valid; the simplest path is a `node scripts/build-dialog-inspector.cjs` call at the end of the `prebuild` script block, matching how `emit-game-data.cjs` is called.

---

## 5. Left Tree — Groups and Items

```
GROUP: Dialog Events  (N)
  badge: "branching" or "flat"
  each entry: [icon] id — npcName

GROUP: Random Events  (N)
  filter: zone selector
  each entry: [icon] id — npcName  [zone badge]

GROUP: Boss Death Dialog  (N)
  each entry: [icon] id

GROUP: Encounters  (N)
  sub-groups by act:  Prologue / Act 1 / Act 2 / Act 3 / Act 4 / Act 5 / Act 6 / Hidden Bosses / Big Fights
  each entry: [icon] id — name  [boss badge]

GROUP: Map Nodes  (N)
  sub-groups by zone (border_roads, thornwood, etc.)
  each entry: [node-type icon] id — name  [type badge]
```

Tree items are `<button>` elements — keyboard-navigable. Active item is highlighted with `--border-hi`. Groups are collapsible via `<details>/<summary>`. Search filters all groups simultaneously; non-matching items get `display:none`.

**Type badges** (colored pills):
- `combat` — red
- `dialog` — gold
- `boss` — ember red
- `shrine` — teal
- `treasure` — yellow
- `challenge` — orange
- `dungeon` — purple
- `skillCheck` — cyan
- `ambush` — dark red
- `lore` — muted teal
- `town` — green

**Special markers:**
- Dialog events with `setsFlags` get a small flag icon (Font Awesome `flag` SVG).
- Dialog events with `rewardsPresent` get a coin icon.
- Encounters with `isBoss: true` get a skull icon.
- Hidden boss nodes get a lock icon.
- `M304_DIALOG_NODES` injected nodes get a branch icon.

---

## 6. Right Detail Editor

### Identity block (read-only)
- Type badge + id
- Source file path + line hint: `src/maps/mapData.js:1508`
- Export + key: `DIALOG_EVENTS["forest_enter"]`
- For map nodes: zone + act + x/y position + exits list

### Content editors by entry type

#### 6a. DIALOG EVENT (branching)
Rendered as a **node graph summary** list — not a visual SVG graph, but an ordered list of nodes with expand/collapse:

```
[start]  (root)
  Lines: [speaker: npc] [text: editable textarea...]
          [speaker: npc] [text: editable textarea...]
  Choices:
    [+] "Press on — show no fear."  → next: brave  reward: xp+15
         [Edit text] [Edit reward] [Delete]
    [+] "Offer your time..."         → next: ally   reward: xp+20
    [+] "Turn back..."               → next: coward reward: gold-5
    [Add choice]

[brave]
  Lines: [speaker: npc] [text: editable...]
  Choices:
    [+] "Continue into the Thornwood."  → outcome: enter
  Outcomes:
    enter: [text: editable...] setFlag: thornwood_brave  [+reward]

[ally]
  ...

[Add node]
```

Flag indicators: `setFlag` values are shown as `[FLAG: thornwood_brave]` in amber. `requires` fields on choices shown as `[REQUIRES: gold >= 15]` in red-amber. Reward fields shown as `[REWARD: xp+20]` in gold.

#### 6b. DIALOG EVENT (flat)
A simpler version of 6a with no node navigation — just lines, choices, outcomes in one scroll.

#### 6c. RANDOM EVENT
Same as flat dialog, plus `minLevel` (number input) and `zone` (text input or multiselect for the known zone list).

#### 6d. BOSS DEATH DIALOG
Three textarea rows: `bossLine`, `heroLine`, `narratorLine`. Character count hint (target ~80 chars each shown as a soft guide bar).

#### 6e. ENCOUNTER
- `name` text input
- `introText` textarea (nullable; if blank, treated as null)
- Enemy list — each enemy is an expandable row:
  ```
  [goblin_scout] x2   hp: [120]  dmg: [44]–[64]  armor: [2]  hit: [80]%  dodge: [15]%  xp: [8]
  ```
  Each stat is an inline number input. Count is also editable.
  Buttons: `[+ Add Enemy]` `[Remove]`
- `bossLoot` block (if present): bases list, rarity, quality, rolls — all editable.

#### 6f. MAP NODE
- `name` text input
- `type` select (from NODE_TYPES enum values)
- `encounter` text input (encounter id reference; shown with a hint if the id exists in encounters)
- `shrineType` select: `heal / empower / fullrestore / null`
- `skillCheck` block:
  - `stat` select (STR / DEX / INT / CON / WIS)
  - `dc` number input
  - `flavor` textarea
  - `success` sub-block: gold, xp, text, loreFlag (all optional)
  - `failure` sub-block: gold, hpLoss, hpLossPct, statusType, statusDur, text
- `hidden` checkbox + `precondition` block:
  - `requireItem` text
  - `requireFlag` text
  - `requireStat` stat + min
  - `requireBossesAll` comma-separated node IDs
  - `requireNoDeath` checkbox
- `exits` — comma-separated node IDs (informational, not editable in MVP since exit lists are managed by the injection system)

---

## 7. NODE_TYPES Variant Reference

Every node type and the fields that must be surfaced in the editor:

| Type | Editor fields |
|---|---|
| `combat` | `name`, `encounter` (required), `exits` |
| `dialog` | `name`, `dialogEventId` (optional; which `DIALOG_EVENTS` key to use), `exits` |
| `town` | `name` (read-only, Emberglen etc.), `exits` |
| `treasure` | `name`, `exits` |
| `ambush` | `name`, `encounter` (required), `exits` |
| `boss` | `name`, `encounter` (required), `exits`, `hidden` flag + `precondition` block |
| `lore` | `name`, `noEvent` (checkbox), `exits` |
| `shrine` | `name`, `shrineType` select (`heal / empower / fullrestore`), `exits` |
| `challenge` | `name`, `encounter` (required), `exits` |
| `dungeon` | `name`, entry-node only (links to `DUNGEONS[id]`; full dungeon editing is out of scope for MVP — note the dungeon id and link to the dungeon record in the Encounters group) |
| `skillCheck` | `name`, full `skillCheck` sub-block (stat, dc, flavor, success, failure), `exits` |

Hidden nodes (from `HIDDEN_BOSS_NODES`) surface the full `precondition` block regardless of type.

---

## 8. Edit Interaction and Diff Serialization

### State management

All edits are captured in a plain JavaScript `Map` keyed by a canonical entry key:

```
"dialogEvents/forest_enter"
"randomEvents/merchant_tinker"
"bossDeathDialog/lava_titan"
"encounters/goblin_camp"
"mapNodes/border_roads/road_ambush"
```

Each map value is an object of `{ field: newValue }` patches against the original JSON. Patches are sparse — only actually-changed fields are included.

```js
const edits = new Map();
// Example after user edits the introText of an encounter:
edits.set('encounters/goblin_camp', { introText: 'The goblins rally...' });
// Example after user edits two fields on a dialog node choice:
edits.set('dialogEvents/forest_enter', {
  'nodes.brave.choices[0].text': 'Stride in, no fear.',
  'nodes.brave.outcomes.enter.setFlag': 'thornwood_brave_v2'
});
```

Dot-notation paths are used for nested fields, following the same pattern as the prompt output (see §9).

### Persistence

Edits are persisted in `localStorage` under the key `emberveil_dialog_inspector_edits_v1` as a JSON-stringified array of `[entryKey, patchObject]` pairs. On page load, the map is restored and dirty indicators are shown on tree items and editor fields.

A `[Reset this entry]` button in the detail editor removes that entry's key from the map and reverts the displayed values to the original JSON data.

A `[Reset all]` button in the filter bar clears the entire localStorage key.

### Dirty indicators

- Tree item gets a gold dot badge (SVG circle) when any field in that entry has been edited.
- In the detail editor, each changed field gets a left border in `--gold` color.
- The prompt bar shows `N edits pending` count.

---

## 9. "Generate Prompt" Output Format

The Copy Prompt button assembles a prompt for Claude Code. The format produces only the diff — not a full file rewrite.

### Template

```
I've made edits to dialog, encounters, and map nodes in Emberveil (game13) using the Dialog Inspector tool at /assets/dialog-inspector.html. Please apply the following changes to the source files. Each change includes the file path, export name, object key, and the exact field(s) to update. Do not change anything outside what is listed.

---

## CHANGE 1 — Dialog Event

File: src/maps/mapData.js
Export: DIALOG_EVENTS
Key: "forest_enter"
Line hint: ~1508

Fields to change:
  nodes.brave.choices[0].text:
    OLD: "Continue into the Thornwood."
    NEW: "Stride forward without looking back."

  nodes.ally.outcomes.learned.setFlag:
    OLD: "knows_rift_origin"
    NEW: "knows_rift_origin_extended"

Context: DIALOG_EVENTS["forest_enter"] is a branching dialog. The `brave` sub-node choice
index 0 is the single terminal choice leading to outcome "enter". The `ally` sub-node outcome
"learned" sets a story flag used by downstream checks in mapData.js.

---

## CHANGE 2 — Encounter

File: src/maps/mapData.js
Export: ENCOUNTERS
Key: "goblin_camp"
Line hint: ~560

Fields to change:
  introText:
    OLD: null
    NEW: "The war-camp is louder than it should be. Someone is giving orders."

  enemies[0].count:
    OLD: 2
    NEW: 3

Context: ENCOUNTERS["goblin_camp"] is used by thornwood node "goblin_camp" and by several
dungeon stages. Increasing goblin_scout count from 2 to 3 adds one more target for AoE
testing. introText was previously absent (null); adding it triggers the pre-fight cinematic.

---

## CHANGE 3 — Boss Death Dialog

File: src/game/bossDeathDialog.js
Export: BOSS_DEATH_DIALOG
Key: "lava_titan"
Line hint: ~22

Fields to change:
  narratorLine:
    OLD: "Magma hardens around the titan's husk. Steam fills the caldera."
    NEW: "Magma seals the titan into the earth. The caldera holds its breath."

---

## CHANGE 4 — Map Node

File: src/maps/mapData.js
Export: ACT1_ZONES  (zone: border_roads)
Node id: "road_ambush"
Line hint: ~1111

Fields to change:
  name:
    OLD: "Shady Wanderer"
    NEW: "Suspicious Traveler"

  skillCheck.dc:
    OLD: 14
    NEW: 12

Context: This node is type "dialog". The skillCheck on this node is a DEX 14 (now 12) roll
attached to a dialog choice, defined inline on the node, not inside DIALOG_EVENTS. Lowering
dc from 14 to 12 reduces the difficulty of the sneak-past option.

---

After applying all changes, run `node scripts/build-dialog-inspector.cjs` to regenerate
public/assets/data/dialog-inspector.json so the tool reflects the updated source.
```

### Rules for prompt generation

1. Only entries with at least one dirty field are included.
2. Each change block includes: file path, export name, key/index/zone, line hint, OLD and NEW values for every dirty field, and a brief context sentence explaining where the data is used in the game (sourced from `_meta` and known structural facts).
3. Dot-notation paths are used consistently (`nodes.brave.choices[0].text`, `enemies[2].hp`).
4. Prompt is copied to clipboard via `navigator.clipboard.writeText`. If the browser denies it, a fallback textarea with the full text is shown inline so it can be manually selected and copied.

---

## 10. Top Filter Bar

Sticky bar below the shared nav header (`position:sticky; top:72px; z-index:40`).

| Control | Type | Options |
|---|---|---|
| Entry type | Segmented button group | All / Dialog Events / Random Events / Boss Death / Encounters / Map Nodes |
| Zone | Select dropdown | All zones + "any" option; affects Random Events and Map Nodes groups |
| Node type | Select dropdown | All types + each NODE_TYPE value; affects Map Nodes only |
| Has flag effects | Checkbox | Filters to entries that set or require story flags |
| Has rewards | Checkbox | Filters to entries with gold / heal / item rewards |
| Edited only | Checkbox | Shows only dirty entries |
| Search | Text input | Case-insensitive full-text match against id, name, npcName, dialog text |

Filters are ANDed together. The tree re-renders on every filter change (debounced 80ms).

---

## 11. Accessibility

- All interactive elements are keyboard-focusable (`tabindex` naturally; no `tabindex=-1` traps).
- Tree group headers use `<details>/<summary>` which is natively accessible.
- Tree item buttons have `aria-selected` state.
- Form fields in the detail editor have associated `<label>` elements.
- The prompt bar "Copy Prompt" button announces its action via `aria-live` region ("Copied to clipboard").
- Color is never the sole indicator of edit state — dirty fields also have a text label "Edited" in the field's label row.
- Min touch target 44x44 CSS px on all interactive controls (for cases where a developer opens the tool on a tablet).

---

## 12. Mobile Portrait Fit (Fallback)

Tool pages in this project are explicitly desktop-only, but a minimal fallback is provided:

- Below `640px` width: left tree becomes hidden by default with a `[Open Tree]` toggle button in the filter bar.
- Detail editor occupies full width.
- Prompt bar stacks vertically.
- Number inputs and textareas remain usable at portrait width.
- No horizontal scroll.

This is a fallback, not an optimised experience.

---

## 13. File Deliverables Summary

| File | Role |
|---|---|
| `scripts/build-dialog-inspector.cjs` | Build script — generates the JSON from source |
| `public/assets/data/dialog-inspector.json` | Generated data file — checked in after each run |
| `public/assets/dialog-inspector.html` | Single-file static tool — all JS inline |

The tool page does not import any external library beyond what `_tool-styles.css` and `_header.js` already provide. No chart.js, no tree-view library — all rendering is vanilla DOM. The prompt bar textarea fallback uses a plain `<textarea>` element.

---

## 14. Relationship to Existing Tools

| Existing tool | Overlap / relationship |
|---|---|
| `data-catalogs.html` | Shows encounter and enemy data in a read-only table. Dialog Inspector supplements this with edit capability and dialog-specific structure. |
| `brainstorm.html` | Pattern reference for the "Copy Prompt" button and toast notification. |
| `image-review-v2.html` | Pattern reference for filter bar, selection state, and bottom sticky action bar. |
| `custom-content.html` | Pattern reference for tabbed panel layout and monospace output area. |
| `damage-report.html` | Pattern reference for controls bar and data-driven content. |

---

## 15. Build Script Integration Notes

- `build-dialog-inspector.cjs` must be runnable independently: `node scripts/build-dialog-inspector.cjs`
- It should also be added to the `prebuild` lifecycle in `package.json` alongside `emit-game-data.cjs` and `generate-data-catalogs.cjs`.
- The generated JSON is committed to the repo (like all other `data/*.json` files).
- The script is idempotent — re-running it overwrites `dialog-inspector.json` cleanly.
- If a source file cannot be parsed (eval failure), the script logs a warning per-section and writes an empty array for that section rather than failing the build.
