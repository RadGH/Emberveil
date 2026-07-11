# Phase 15 — Map Redesign Plan
**M385 planning deliverable — no source files modified**
**Date:** 2026-04-29
**Author:** UI Designer agent (M385 Task C)

---

## Scope and Ground Rules

This document covers the 9 capturable zones across Acts 1–5 (zone-thornwood screenshot was absent from the capture set; thornwood analysis is based on mapData.js node data alone). Prologue is excluded per spec.

**Reading key for screenshots:** Green solid lines = active path (player-traversed). Dashed white lines = available but unvisited exits. Node color by type: Red = Combat, Orange-red = Ambush, Yellow = Town, Purple = Challenge, Teal = Encounter/Town variant, Gold star = Boss.

**No (x, y) coordinates are specified in this document.** All spatial language is relative ("upper-left", "bottom rail", "mid-spine"). Exact coordinates are M386's task.

---

## 1. Per-Zone Diagnosis

---

### Zone: border_roads (Act 1)

![zone-border_roads](../assets/maps/zone-border_roads.png)

**Current node inventory (from mapData.js):**

| ID | Type | Connections out |
|----|------|-----------------|
| start (Emberglen) | town | road_ambush |
| road_ambush (Shady Wanderer) | dialog | crossroads_a, crossroads_b |
| crossroads_a (Goblin Scout Pack) | combat | ruined_watch |
| crossroads_b (Roadside Shrine) | shrine | ruined_watch, border_skill |
| border_skill (Collapsed Passage) | skillCheck | ruined_watch |
| ruined_watch (Ruined Watchtower) | combat | border_boss |
| border_boss (Warlord's Vanguard) | boss | (terminal) |

**Identified problems:**

1. **Near-dead-end after the branch collapses.** Both `crossroads_a` (upper rail) and `crossroads_b` (lower rail) plus `border_skill` all converge directly to `ruined_watch`. The map branches into three and immediately collapses — the divergence has no payoff. It reads as a diamond with no optional depth.

2. **`border_skill` hangs below the lower rail.** The Collapsed Passage node sits at y=0.85, well below `crossroads_b` (y=0.70). The connection from `crossroads_b` angling down to `border_skill` and then back up to `ruined_watch` (y=0.50) creates a path that sags visually under the lower rail before rejoining the spine — exactly the "paths crossing under nodes" problem.

3. **The path segment from `road_ambush` to `crossroads_a` (upper-left) visually angles upward through the zone's vertical midpoint while the label "Recovered Merchant" floats above with its own separate connector.** The Recovered Merchant discovery node has a long diagonal connector angling down to the midpoint, crossing the road_ambush → crossroads_a path at an acute angle. This is a path-crossing-under-node violation.

4. **Only 2 combat nodes total (crossroads_a and ruined_watch)** with a long dead-end chain that offers no real consequence routing. Task D calls for 5 combat-type nodes. The current branch structure cannot accommodate 3 more without looking cluttered unless the overall shape is reorganized.

5. **Near-linear topology reads as three dead-ends.** The lower two branches (`crossroads_b`, `border_skill`) both dead-end into the same merge point. There is no true alternate route — only a timing question of which path you take before arriving at `ruined_watch`. This makes the map feel flat for an opening zone.

**After adding Task D nodes (+2 combat, +1 challenge):** The insertion points proposed in Phase 14 (`road_patrol` between road_ambush and crossroads_a, `watchtower_approach` between crossroads_a and ruined_watch, and `road_challenge` as a bottom-rail challenge) all land correctly within the existing spine but will worsen the overcrowding in the central cluster unless the zone is pulled wider.

---

### Zone: thornwood (Act 1, no screenshot — data only)

*Screenshot capture failed for this zone. Analysis based on mapData.js node layout.*

**Current node inventory:**

| ID | Type | Exits |
|----|------|-------|
| forest_enter | dialog | spider_hollow, hidden_path |
| spider_hollow | combat | goblin_camp |
| hidden_path | dialog | goblin_camp, wood_test |
| wood_test | skillCheck | goblin_camp |
| goblin_camp | combat | seer_hut, treasure_grove, spider_queen |
| seer_hut | dialog | thornwood_boss |
| treasure_grove | treasure | thornwood_boss |
| spider_queen | challenge | silk_cache |
| silk_cache | treasure | thornwood_boss |
| thornwood_boss | boss | (terminal) |

**Identified problems:**

1. **Triple merge into `thornwood_boss`.** Three separate paths — `seer_hut`, `treasure_grove`, and `silk_cache` — all terminate at the boss. This creates a fan-in with no structure at the tail end. The boss has three incoming connectors overlapping in the rightmost column.

2. **`goblin_camp` is the fulcrum of the entire map.** Every path routes through goblin_camp. If the player skips the diamond from `forest_enter` (spider_hollow vs hidden_path) they still arrive at goblin_camp with no strategic difference. The diamond serves only as an XP/lore option, not a routing option.

3. **`wood_test` is a dead-side-branch off `hidden_path`.** It exits exclusively to `goblin_camp`, making it a pass-through with no meaningful routing consequence. It also sits at y=0.88 — deep in the bottom rail below `hidden_path` — and its connection back up to `goblin_camp` crosses under `hidden_path`.

4. **Challenge chain `spider_queen` → `silk_cache` → `thornwood_boss` is a valid bottom-rail design but the path from `goblin_camp` (y=0.50) to `spider_queen` (y=0.85) creates a steep descent and the return `silk_cache` → `thornwood_boss` crosses back up through the mid-zone.** This produces the "path crossing multiple rows" problem on the optional route.

5. **Only 2 combat nodes** (spider_hollow, goblin_camp) and 1 challenge (spider_queen) = 3 combat-type. Task D target is 5. Adding `web_tunnel`, `goblin_archers`, and `warlord_camp` requires restructuring the wide central fan.

---

### Zone: dust_roads (Act 2)

![zone-dust_roads](../assets/maps/zone-dust_roads.png)

**Current node inventory (visible from screenshot):**

Upper rail: Trailhead → Ashen Gate → (Ruined Outpost off mid) → Dust Patrol → Obsidian Garrison → Black Spire → Ember Path → Lava Titan Boss  
Mid-rail: Ash Patrol (challenge-area node), Salt Wastes, Salt Tunnels  
Lower rail: Moss Grave, Old Bone Garrison, buried Cache, Veil Cut Camp, Buried Cache, Buried Depths  
Far right: The Lava Titan (boss)

**Identified problems:**

1. **Severe vertical sprawl — the map spans 6+ visible rows.** The upper discovery nodes (Desperate Mission, Gluttermold area at approximately y=0.15) sit extremely far from the bottom rail nodes (Buried Depths at y=0.88). Connectors between these upper and lower extremes cross through every layer of mid-map nodes.

2. **Back-merge from lower-rail challenge into the upper-path spine.** The connection from the lower challenge area back into the Obsidian Garrison / Black Spire portion of the main rail is a long diagonal cutting through 3–4 rows. Visible in the screenshot as a connector that crosses under the mid-spine labels.

3. **`Moss Grave` (lower-left area) is a near-dead-end.** It sits at approximately x=0.10, y=0.72, connected only to Ash Catacombs (dungeon entry) below it and the Ashen Gate above. It has no forward exits and no branch consequence — it is a pure detour with a single path back to the spine.

4. **`Salt Wastes` and `Salt Tunnels` form a sub-chain that visually overlaps with the main spine.** Their connectors cross the Ash Patrol → Obsidian Garrison diagonal, creating an X-crossing that is difficult to read. The path labels stack on top of each other in the mid-zone.

5. **The "Travel back to Thornwood Forest" tooltip obscures the left side of the zone** — UI issue that is a rendering consequence of the map being full-width with a back-travel UI element overlapping the opening nodes.

**Task D insertions** (`road_ambush_2`, `cult_outpost`, `ashen_field` between salt_wastes and salt_tunnels) all land in the already-congested mid-zone and will compound the crossing problem unless the vertical distribution is tightened.

---

### Zone: ember_plateau (Act 2)

![zone-ember_plateau](../assets/maps/zone-ember_plateau.png)

**Current node inventory (visible from screenshot):**

Upper rail: Kawa Forge Meld → Ancient Shrine → Veil Stronghold → The Rift Access → Superheated Passage  
Mid-spine: Trailhead → Plateau Ascent → Lava Fields → Obsidian Vein → Emborwatch → Veil High Priest (boss)  
Lower rail: Cinder Gorge → Memories of Mira → Magma Vault → Veil Monolith → Skill Check

**Identified problems:**

1. **The upper rail (Kawa Forge Meld → Superheated Passage) and the lower challenge chain (Cinder Gorge → Magma Vault → Veil Monolith) both converge into Veil High Priest boss.** This creates a three-way fan-in at the boss with multiple crossing connectors in the rightmost column. Connectors from upper-right (Superheated Passage, y≈0.08) and lower-right (Veil Monolith, y≈0.62) to the boss (y≈0.5) overlap visually.

2. **`Obsidian Vein` at the top (y≈0.10) connects down to `Veil Stronghold` (y≈0.22), which then connects right toward `The Rift Access`.** The Obsidian Vein → Veil Stronghold connector runs near-vertically in a zone that otherwise moves left-to-right. This vertical segment interrupts the horizontal flow bias and makes the upper-left section read as disconnected from the forward trajectory.

3. **`Cinder Gorge` (challenge, lower-left, y≈0.70) exits to `Plateau Ascent` and creates a back-merge.** The connection line from Cinder Gorge back toward the mid-spine crosses over the Lava Fields label area and visually appears to travel backward (right-to-left) against the zone's forward direction.

4. **`Memories of Mira` is an isolated lore node** at the bottom center with connectors running to both `Magma Vault` and `Cinder Gorge`. These two connectors create a triangle in the bottom rail that sits below the primary visual plane and adds 2 crossing diagonals.

5. **Emborwatch (town) is placed at approximately y=0.50 but x≈0.72**, late in the zone, near the boss. The town is surrounded by combat nodes above and below with connections running through it. The node feels buried rather than being a clear rest point on the path.

**Task D insertions** (`lava_approach`, `stronghold_break`, `magma_vault` → named challenge conversion) are well-positioned on the main rail but the bottom rail restructuring should happen in conjunction.

---

### Zone: hell_breach (Act 3)

![zone-hell_breach](../assets/maps/zone-hell_breach.png)

**Current node inventory (visible from screenshot):**

Upper rail: Daemon Reliquary → Brimstone Shrine → Summoner's Communion → Inferno Keep → Void Altar → Boss  
Mid-spine: Trailhead → The Veil Breach → Demon Patrol → Brimstone Shrine (second label area) → Inferno Keep → Dreadfortress → Archfiend Malgrath (boss)  
Lower rail: Fell Ruins → Charred Imp area → Black Market → Ashen Hollow → Bone Pit → Soul Prison → Boss

**Identified problems:**

1. **Severe crossing problem in the upper-left quadrant.** The connection from the Daemon Reliquary (upper-left, y≈0.15) runs a long diagonal toward Inferno Keep in the mid-right, crossing through the Fell Ruins node and its connectors in the mid-left. This single long diagonal produces multiple visual crossings.

2. **`Fell Ruins` and `Charred Imp` area form a mid-left cluster** with connectors branching upward to Brimstone Shrine and forward to Inferno Keep. The fork at `The Veil Breach` fans out into 3 directions (upper, mid, lower), creating a triangle of connectors that immediately crowds the left side.

3. **`Black Market Forno` (lower-center, labeled "Black Market Forno" in the screenshot) is connected from `Bone Pit` below and exits forward — but the connector from Bone Pit up to Black Market and then forward creates a "kink" path** that reverses direction: down to Bone Pit, then back up through Black Market, then forward. This is a partial back-merge.

4. **`Ashen Hollow` (challenge) connects from Soul Prison below and the path from Soul Prison to the boss (Archfiend Malgrath) then travels back up through the mid-zone.** The lower-right corner has two nodes (Soul Prison, Ashen Hollow vicinity) with connections that converge at the boss from two angles simultaneously, creating an overlapping connector cluster in the final column.

5. **The map spans effectively 5 visible rows but the node distribution is uneven:** the upper two rows (Daemon Reliquary, Summoner's Communion) are thin (1–2 nodes each) while rows 3–4 are dense (5–6 nodes). The map does not use its vertical space evenly.

**Task D insertions** (`hellgate_skirmish`, `brimstone_corridor`, `keep_courtyard`, `ashen_hollow` → named challenge) add to the already congested mid-section. The redesign should expand the zone's horizontal distribution rather than adding more vertical rows.

---

### Zone: shattered_core (Act 3)

![zone-shattered_core](../assets/maps/zone-shattered_core.png)

**Current node inventory (visible from screenshot):**

Upper rail: Flicker Apparition → Memory Crypt → Pallor Fiend  
Mid-spine: Trailhead → Core Entrance → Void Nexus → Shard Entrance (combat/challenge) → The Wound → Emberveil Sovereign (boss)  
Sub-rail: Rift Demons, Memory Crypt, Glimmer Spit  
Lower rail: Shattered Path → Rift Warden → Goresaw Constellation → Ancient Seal → Grand Vault

**Identified problems:**

1. **`Flicker Apparition` (upper-left, y≈0.15) is a near-isolated dead-end.** It connects to Core Entrance below it and appears to connect to Memory Crypt, but it has no forward exits that differ from the mid-spine path. It functions as a detour that rejoins the same node (Core Entrance or Void Nexus), providing no routing consequence.

2. **The central cluster around `Void Nexus` and `Shard Entrance` is heavily connected.** Multiple paths — from the upper-left (Flicker Apparition via Memory Crypt), the mid-left (Rift Demons off Core Entrance), and the lower-left (Shattered Path) — all converge on Void Nexus and Shard Entrance within a small horizontal band (x≈0.30–0.55). The resulting connector web has 3+ crossing lines in this region.

3. **`Shattered Path` (lower-left, y≈0.72) connects to `Rift Warden` and creates a backward-traveling path.** The Shattered Path node is left of center but exits to Rift Warden which appears to be below and left of Shard Entrance — meaning the path from Core Entrance (x≈0.12) goes down to Shattered Path (x≈0.15, y≈0.72) and then travels through Rift Warden before rejoining the spine. This bottom rail adds visual noise for minimal player benefit.

4. **`Grand Vault` (lower-right) exits to the boss but its connector crosses the `Ancient Seal` → boss connector**, creating an X in the final column — exactly the same fan-in-at-boss problem as in border_roads and ember_plateau.

5. **`Pallor Fiend` (upper-right, y≈0.22)** appears to be a near-terminal discovery node with only a single exit toward the boss. It sits in isolation in the upper-right quadrant with a single long connector — another dead-end node with one connection.

**Task D insertions** (`rift_vanguard`, `soul_furnace`, `rift_cache` → named challenge) add to the Void Nexus cluster and must be separated horizontally to avoid making the mid-zone worse.

---

### Zone: cosmic_rift (Act 4)

![zone-cosmic_rift](../assets/maps/zone-cosmic_rift.png)

**Current node inventory (visible from screenshot):**

Upper rail: The Abyss (far upper) → Sentinel Silo → Titan's Pit  
Mid-spine: Trailhead → Edge of Reality → (Cosmic Station) → Void Prophet's Sanctum → The Void Herald (boss)  
Sub-rail: The Broken Stars, Stars of Stars, Collection Silo, Silo Analyst  
Lower rail: Void Entropy, Star Gate, Nebula Drift → Event Horizon → Void Vault → (merges right)

**Identified problems:**

1. **Extreme long-range diagonal from `The Abyss` (upper-left area, y≈0.08) to the mid-right cluster.** This single connector spans nearly the full horizontal width at a steep angle, crossing over multiple mid-zone nodes. It is the most severe crossing violation in the zone.

2. **The upper rail (The Abyss → Sentinel Silo → Titan's Pit) runs in close parallel to the mid-spine but is connected to it by nodes whose connector lines cross the spine at angles.** The result is a "ladder" pattern where diagonal rungs cross the two horizontal rails at acute angles — each rung is a crossing violation.

3. **`Nebula Drift` (lower-left, y≈0.72) and `Event Horizon` (lower-center) form a bottom rail that converges with the mid-spine at the right side.** The connector from Event Horizon to the mid-right area travels diagonally upward from y≈0.65 to y≈0.50, crossing the lower-mid connection from Stars of Stars.

4. **`Void Vault` (lower-right, y≈0.85) connects directly to `Titan's Pit` (upper-right, y≈0.22)** based on the visible connector in the screenshot. This single connector crosses 3+ rows vertically — the most extreme row-crossing instance in Act 4.

5. **Node density imbalance:** the upper-left quadrant has 2 nodes while the center-right has 7+ nodes in a tight cluster. The zone front-loads sparsely and back-loads densely, inverting the desired left-to-right pacing ramp.

**Task D insertions** (+2 combat, +1 challenge for Acts 4–6) should target the sparse upper-left quadrant rather than the dense center-right.

---

### Zone: eternal_void (Act 4)

![zone-eternal_void](../assets/maps/zone-eternal_void.png)

**Current node inventory (visible from screenshot):**

Upper rail: Memory Rubicon → Dying Star Remnant  
Mid-spine: Trailhead → Gates of the Void → The Void Library → (Forgotten Map) → (NP Solus) → The Last Shrine → The Unraveler (boss)  
Lower rail: Star Abyss Wastes → Oblivion Warden → Trial of the Void → Oblivion Cache → Void Entity (near-terminal)  
Far right: The Echo Chamber (second boss/post-boss node)

**Identified problems:**

1. **Two boss nodes at the far right** — `The Unraveler` and `The Echo Chamber` — appear stacked vertically with connectors suggesting one exits to the other. This double-boss configuration means the "final boss is at zone end" rule is ambiguous. One is treated as terminal but both draw connectors from multiple paths, creating a 4-way merge at the rightmost column.

2. **`Memory Rubicon` (upper-left, y≈0.15) connects to `The Void Library` (mid, x≈0.35, y≈0.50).** This long diagonal from upper-left to mid-center is a 2-row crossing that passes through the empty upper-mid region. The connection visually unanchors the upper rail from the rest of the zone.

3. **`Void Entity` (lower-center-right, y≈0.62)** appears to exit only to the Oblivion Cache chain and then to Trial of the Void. The bottom rail has a linear chain of 4 nodes (Star Abyss Wastes → Oblivion Warden → Trial of the Void → Void Entity/Cache) that all exit into the Unraveler boss — a long bottom rail that merges only at the very end, creating another fan-in at the boss.

4. **The `Former Revenent` node (lower-center, y≈0.72)** connects upward to the `Oblivion Warden` and to `Void Entity` — forming a small triangle in the lower rail that creates two crossing connectors within the lower band.

5. **Zone reads right-to-left in the upper rail.** `Memory Rubicon` is at x≈0.28 and its connector to `Dying Star Remnant` (x≈0.34, y≈0.08) moves slightly right. But both then connect forward to the mid-spine at x≈0.45–0.55. The upper-rail nodes are close to the start in x-position but visually detached — they look like back-of-zone nodes rather than early-zone exploration.

**Task D insertions** (+2 combat, +1 challenge) should fill the empty upper-mid region rather than adding to the already-dense lower rail.

---

### Zone: abyssal_depths (Act 5)

![zone-abyssal_depths](../assets/maps/zone-abyssal_depths.png)

**Current node inventory (visible from screenshot):**

Upper rail: The Unmade Echo → (upper-center lore node) → Abyssal Membrane → Genesis Worm Den  
Mid-spine: Trailhead → The Abyss Gate → (Drowned Hall) → (Ambush Nexus) → (Abyssal) → Abyssal Fortress → Primordial Ki... (boss)  
Lower rail: Intrusive Architecture → Pressure Core → Deep Trench → (Nexus Core) → Sunken Vault

**Identified problems:**

1. **Extreme connector chaos in the center band.** The node cluster between x≈0.35 and x≈0.60 has 7+ nodes in close proximity with multiple overlapping connectors. Three separate paths (upper, mid, lower) all try to route through this band simultaneously, and the connectors form a web of diagonals that makes route-tracing nearly impossible at a glance.

2. **`Deep Trench` (lower, y≈0.72) is a combat/ambush node that exits to `Nexus Core` and also receives a connection from `Pressure Core` above it.** The Pressure Core → Deep Trench → Nexus Core chain creates a zigzag: the player goes down (Pressure Core to Deep Trench) then back up (Deep Trench to Nexus Core at y≈0.50). This is a path that reverses vertical direction mid-route.

3. **`The Unmade Echo` (upper-left, y≈0.15) connects to a node that also connects to the mid-spine.** The upper-left connection crosses over the Abyss Gate → mid-spine connector area at an oblique angle.

4. **`Sunken Vault` (lower-right, y≈0.72)** connects to the boss (Primordial Ki...) at approximately y=0.50. This produces a connector that rises steeply from lower-right to upper-right — crossing the Genesis Worm Den → boss connector from the upper rail.

5. **Node count per row is imbalanced:** the mid-spine has 5+ nodes in a horizontal line but the vertical spread (upper + lower rails) creates false complexity. The total node count is appropriate but the layout makes the zone feel harder to read than its content deserves.

**Task D insertions** (+3 combat, +1 challenge) will intensify the center-band congestion unless the redesign widens horizontal spacing.

---

### Zone: primordial_nexus (Act 5)

![zone-primordial_nexus](../assets/maps/zone-primordial_nexus.png)

**Current node inventory (visible from screenshot):**

Upper rail: Abyssal Resonance → The Forgotten Mausoleum  
Mid-spine: Trailhead → Gates of Creation → (Arc's Chamber) → (Hollow) → Gallery of the Unbound → Prime Veil → The Apex (boss)  
Sub-rail: Reality Shard Storm, Primordial Reclaim  
Lower rail: Creation Loom (ambush) → Shattered Spire → The Lost Heaven → Final Reckoning

**Identified problems:**

1. **`Creation Loom` (lower-left, y≈0.72) is the only visually prominent red combat node on the left half of the zone, but it is well below the mid-spine.** Its exit connector to `Shattered Spire` travels horizontally right at the bottom rail, then `Shattered Spire` connects upward to `The Lost Heaven` which connects back up to the boss. This bottom-rail chain rises steeply in the final third, producing a right-side ascending zigzag.

2. **The upper rail (`Abyssal Resonance` → `The Forgotten Mausoleum`) is extremely sparse** — only 2 nodes at the top with a single connector between them, and both connect downward to the mid-spine. The upper rail adds visual height to the zone without providing meaningful routing depth.

3. **`Gallery of the Unbound` (mid-right, y≈0.50) has connections coming from above (`The Forgotten Mausoleum`), from the left (mid-spine forward), and from below (`Primordial Reclaim`).** Three incoming connectors plus its own forward exits create a 5-connection hub. At this density, connectors overlap and the node becomes a visual collision point.

4. **`Reality Shard Storm` (sub-rail, y≈0.62)** connects from `Gates of Creation` early in the zone all the way to `Gallery of the Unbound` near the end. This single long connector skips several mid-zone nodes and travels at a shallow diagonal across most of the zone's horizontal span — a 5+ column crossing.

5. **`Final Reckoning` (lower-right, y≈0.72) exits to the boss.** Combined with `Prime Veil` (y≈0.50 → boss) and `The Forgotten Mausoleum` (y≈0.08 → boss), the boss node receives 3 incoming connectors from 3 different vertical positions — another fan-in-at-boss instance.

---

## 2. Redesign Principles

These rules apply to all zones post-redesign.

### P1 — Zero Edge Crossings Target

**Goal: 0 crossing connectors per zone.** In practice, the target for the first redesign pass is ≤1 crossing per zone, achieved by eliminating all long-range diagonals and all back-merge connections. Crossings are permitted only where they are inherent to a deliberate routing fork (not crossings caused by node misplacement).

### P2 — Horizontal Direction Bias (Left → Right)

All zones flow left-to-right. An "early" node is one with a lower x-value; a "late" node has a higher x-value. Connections must never travel rightward more than 2 columns backward (i.e., an exit to a node more than 20% of canvas width to the left of its source is prohibited). The only permitted backward-traveling connections are to dungeon entry nodes, which are off-shoot branches that feed only into the dungeon system and never re-enter the main graph.

### P3 — Minimum 1 Branch Per Dead-End (No Naked Terminals)

Every non-boss, non-terminal node must have at least 1 forward exit. Nodes with exactly 1 exit are permitted only when they are members of a deliberate linear sub-chain (e.g., the spine itself). Side-branch nodes must have ≥1 exit back to the main spine within 2 hops.

### P4 — Maximum 4 Visible Row Bands

The canvas uses y=0.00 (top) to y=1.00 (bottom). The redesign constrains meaningful node placement to 4 bands:

| Band | y range | Purpose |
|------|---------|---------|
| Upper exploration | 0.08 – 0.22 | Optional branches, lore, treasures |
| Main spine | 0.38 – 0.52 | Primary combat + encounter nodes |
| Challenge rail | 0.62 – 0.72 | Challenge + optional combat |
| Dungeon off-shoot | 0.88 – 0.95 | Dungeon entry only — not traversed in main graph |

Nodes outside these bands are permitted only for the Trailhead (y=0.50, pinned) and the boss (y=0.50, pinned to right side at x≥0.90).

### P5 — Boss Has Exactly 2 Incoming Connections

The boss node receives connections from exactly 2 paths: the main spine (y≈0.50) and one optional path (upper or challenge rail). All other paths must merge into these 2 before the boss column. This eliminates the 3-way and 4-way fan-in anti-pattern observed in all current zones.

### P6 — Challenge Rail Is Forward-Only

Challenge-rail nodes exit only rightward or diagonally upward-right to rejoin the main spine. They never exit backward or downward. Dungeon off-shoots are the only nodes below y=0.80 and they have no main-graph exits.

### P7 — Grid Column Alignment

Nodes should occupy one of 8 horizontal columns (x ≈ 0.06, 0.18, 0.30, 0.42, 0.54, 0.66, 0.78, 0.92). Trailhead pins to column 1 (x=0.06) and boss pins to column 8 (x=0.92). Interior nodes occupy columns 2–7. This grid alignment prevents the floating-label problem and ensures connectors travel along predictable angles.

### P8 — New Combat Nodes Inserted on Spine, Not Off-Rail

Task D's new combat nodes are inserted on the main spine (y≈0.50) as additional spine columns. Challenge rail additions (the +1 challenge per zone) go onto the challenge rail (y≈0.65). This prevents node additions from worsening the upper-rail sparseness problem.

---

## 3. Per-Zone Redesign Sketch

---

### border_roads Redesign

**New node count strategy:** 7 nodes total (up from 7 existing, restructured). Target: 5 combat-type nodes per Task D.

**Grid layout (8 columns):**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | start (Emberglen) | spine | town |
| 2 | road_ambush (Shady Wanderer) | spine | dialog — becomes a 2-exit fork |
| 3 | `road_patrol` NEW | spine | combat |
| 3 | crossroads_b (Roadside Shrine) | challenge | shrine — moved to challenge rail |
| 4 | `watchtower_approach` NEW | spine | combat |
| 4 | `road_challenge` NEW | challenge | challenge — replaces border_skill |
| 5 | crossroads_a (Goblin Scout Pack) | spine | combat — moved from col 3 |
| 6 | ruined_watch (Ruined Watchtower) | spine | combat |
| 7 | (spine pre-boss) | spine | lore or encounter |
| 8 | border_boss | spine | boss |

**Connections to remove:** `border_skill` → `ruined_watch` (the back-merge via y=0.85). `crossroads_b` → `border_skill` (the path that dips below then returns). `road_ambush` → `crossroads_b` (currently routes to shrine too early).

**Connections to add:** `road_ambush` → `road_patrol` (spine forward), `road_patrol` → `crossroads_b-new-shrine-position` (challenge rail split), `road_patrol` → `watchtower_approach` (spine forward), `watchtower_approach` → `road_challenge` (challenge rail node), `road_challenge` → `ruined_watch` (challenge rail rejoins spine), `watchtower_approach` → `crossroads_a` (spine continues), `crossroads_a` → `ruined_watch`.

**After description:** The player enters Emberglen, meets the Shady Wanderer, and faces a clean two-rail choice: the main spine (road_patrol → watchtower_approach → Goblin Scout Pack → Ruined Watchtower → boss) or an optional challenge detour (Roadside Shrine → road_challenge → rejoins Ruined Watchtower). All paths read strictly left-to-right. No connector crosses any other.

---

### thornwood Redesign

**New node count strategy:** 10 nodes (up from 9). Target: 5 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | forest_enter | spine | dialog |
| 2 | spider_hollow | spine | combat |
| 2 | hidden_path (Ancient Runestone) | upper | dialog |
| 3 | `web_tunnel` NEW | spine | combat |
| 3 | goblin_camp | challenge | combat — moved off spine to become the "hard left turn" challenge |
| 4 | `goblin_archers` NEW | spine | combat |
| 4 | seer_hut | upper | dialog |
| 5 | treasure_grove | spine | treasure — single mid-spine rest |
| 5 | spider_queen | challenge | challenge — stays challenge rail |
| 5 | `warlord_camp` NEW | challenge | challenge — direct exit off goblin_camp |
| 6 | silk_cache | challenge | treasure |
| 7 | thornwood_boss | spine | boss (receives exactly 2 incoming: spine + challenge rail) |

**Connections to remove:** Triple fan-in to thornwood_boss. `wood_test` → `goblin_camp` path-that-returns-from-below. `hidden_path` → `goblin_camp` (redirect via web_tunnel instead).

**Connections to add:** `spider_hollow` → `web_tunnel` (spine), `web_tunnel` → `goblin_archers` (spine), `goblin_archers` → `treasure_grove` (spine), `hidden_path` → `seer_hut` (upper rail shortcut to late zone), `goblin_camp` → `warlord_camp` → `silk_cache` → `thornwood_boss` (challenge chain), `treasure_grove` → `thornwood_boss` (spine).

**After description:** A compact two-rail forest zone. The main spine charges through three combat encounters (spider_hollow → web_tunnel → goblin_archers → treasure rest → boss). The optional challenge rail offers the goblin_camp encounter, the warlord_camp named challenge, and a silk_cache treasure before rejoining the boss. The seer_hut lore sits on the upper rail as a peaceful detour off the second encounter.

---

### dust_roads Redesign

**New node count strategy:** 11 nodes (up from current ~14 with rail sprawl, but trimmed and reorganized). Target: 8 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | start (Ashen Gate) | spine | dialog/town |
| 2 | dust_patrol | spine | combat |
| 2 | ash_lore (Ruined Outpost) | upper | dialog |
| 3 | `road_ambush_2` NEW | spine | combat |
| 3 | Moss Grave | challenge | lore (trimmed to challenge rail) |
| 4 | ash_patrol | spine | combat (converted from ambush) |
| 4 | salt_wastes | upper | dialog |
| 5 | salt_tunnels | spine | challenge (named) |
| 5 | `ashen_field` NEW | challenge | combat |
| 6 | obsidian_fort | spine | combat |
| 6 | buried_cache | challenge | treasure |
| 7 | `cult_outpost` NEW | spine | combat |
| 7 | veil_camp (Veil Cut Camp) | challenge | combat |
| 8 | dust_boss (The Lava Titan) | spine | boss |

**Connections to remove:** The long upper-rail diagonals from Desperate Mission and Gluttermold to the mid-spine (these are folded into the upper-rail nodes above). The back-merge from the lower challenge area back into the Obsidian Garrison area. `salt_wastes` → `salt_tunnels` if it currently creates a crossing.

**Connections to add:** `road_ambush_2` → `salt_wastes` (upper rail access from spine column 3), `ashen_field` → `obsidian_fort` (challenge rail rejoins spine at column 6), `cult_outpost` → `dust_boss` (spine continues to boss), `veil_camp` → `dust_boss` (challenge rail terminal merge).

**After description:** The Dust Roads now read as two clean horizontal rails converging in the final column. The main spine marches through 4 combat encounters before the boss. The challenge rail offers the named challenge in the salt tunnels plus a treasure pull-off and the Veil Camp combat. Both rails arrive at The Lava Titan from exactly 2 directions (spine top, challenge below).

---

### ember_plateau Redesign

**New node count strategy:** 12 nodes. Target: 8 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | plateau_enter | spine | dialog |
| 2 | ancient_shrine | upper | shrine (moved up, off spine) |
| 2 | lava_fields | spine | combat |
| 2 | cinder_gorge | challenge | combat |
| 3 | `lava_approach` NEW | spine | combat |
| 3 | obsidian_vein | upper | dialog |
| 4 | veil_stronghold | spine | combat |
| 4 | memories_of_mira | challenge | lore |
| 5 | `stronghold_break` NEW | spine | combat |
| 5 | magma_vault | challenge | challenge (named) |
| 6 | rift_access | upper | dialog |
| 6 | emborwatch | spine | town |
| 6 | ember_hoard | challenge | treasure |
| 7 | lore_monolith (Veil Monolith) | challenge | dialog |
| 8 | plateau_boss (Veil High Priest) | spine | boss |

**Connections to remove:** `cinder_gorge` back-merge to plateau_ascent (remove the backward arc). `memories_of_mira` triangle in the lower rail. The Kawa Forge Meld → Superheated Passage upper rail which crosses too many columns (fold into obsidian_vein → rift_access as a simpler 2-node upper rail).

**Connections to add:** `cinder_gorge` → `memories_of_mira` → `magma_vault` (challenge rail chain, forward only), `ember_hoard` → `lore_monolith` → `plateau_boss` (challenge terminal), `rift_access` → `plateau_boss` (upper rail terminal, 1 connection only).

**After description:** A steady left-to-right plateau climb. The main spine delivers 4 combat encounters before the boss town and final push. The challenge rail runs underneath with a named magma challenge and an ember hoard reward. The upper rail provides a lore shortcut (obsidian_vein → rift_access) that merges at the boss — contributing the second of exactly 2 boss incoming connections.

---

### hell_breach Redesign

**New node count strategy:** 13 nodes. Target: 8 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | breach_gate | spine | dialog |
| 2 | fell_ruins | upper | dialog |
| 2 | demon_patrol | spine | combat |
| 2 | bone_pit | challenge | combat |
| 3 | `hellgate_skirmish` NEW | spine | combat |
| 3 | brimstone_shrine | upper | shrine |
| 4 | `brimstone_corridor` NEW | spine | combat |
| 4 | ashen_hollow | challenge | challenge (named) |
| 5 | inferno_keep | spine | combat |
| 5 | demon_reliquary | challenge | treasure |
| 6 | `keep_courtyard` NEW | spine | combat |
| 6 | void_altar | upper | dialog |
| 7 | dreadfortress (Dreadfortress) | spine | dialog/encounter |
| 7 | soul_prison | challenge | treasure |
| 8 | archfiend_malgrath | spine | boss |

**Connections to remove:** Long diagonal from Daemon Reliquary (upper-left) to Inferno Keep (cut — fold into brimstone_shrine path instead). The Black Market Forno backward arc. `bone_pit` connection that creates the kink up through Black Market.

**Connections to add:** `fell_ruins` → `brimstone_shrine` (upper rail access from start), `brimstone_shrine` → `void_altar` → `archfiend_malgrath` (upper rail to boss), `ashen_hollow` → `demon_reliquary` → `soul_prison` → `archfiend_malgrath` (challenge rail), `bone_pit` → `ashen_hollow` (challenge rail, forward-only).

**After description:** Hell Breach becomes a disciplined 3-rail zone: the main spine drives through 4 new combat encounters to the boss, the upper rail offers the shrine and void altar lore path, and the challenge rail chains from bone_pit through the named ashen_hollow encounter and a treasure stop to the boss. All connectors are forward-going. The Black Market is moved to be an off-shoot treasure node rather than a path waypoint.

---

### shattered_core Redesign

**New node count strategy:** 11 nodes. Target: 8 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | core_enter | spine | dialog |
| 2 | void_nexus | upper | combat |
| 2 | rift_demons | spine | combat |
| 2 | shattered_path | challenge | dialog |
| 3 | `rift_vanguard` NEW | spine | combat |
| 3 | memory_crypt | upper | dialog |
| 4 | shard_entrance (Shard Fortress) | spine | combat |
| 4 | rift_cache | challenge | challenge (named) |
| 5 | `soul_furnace` NEW | spine | combat |
| 5 | shard_vault | challenge | treasure |
| 6 | the_wound | upper | dialog |
| 6 | ancient_seal | spine | dialog |
| 7 | grand_vault | challenge | treasure |
| 8 | core_boss (Emberveil Sovereign) | spine | boss |

**Connections to remove:** `flicker_apparition` dead-end (replace with void_nexus on upper rail with a proper forward exit). Triple fan-in at boss (remove `grand_vault` direct → boss; redirect through ancient_seal instead). Long diagonal from shattered_path that crosses mid-zone.

**Connections to add:** `void_nexus` → `memory_crypt` → `the_wound` (upper rail chain), `shattered_path` → `rift_cache` → `shard_vault` → `grand_vault` (challenge rail chain), `grand_vault` → `ancient_seal` (challenge rail rejoins spine before boss), `ancient_seal` → `core_boss` (single spine terminal).

**After description:** Shattered Core flows as a tight 3-column-wide web with a clean 3-rail structure. The spine presses through 4 combat encounters with no crossings. The upper rail provides a lore bypass that arrives at the boss from the upper-right via `the_wound`. The challenge rail offers a named encounter and two treasures before merging at ancient_seal — so the boss has exactly 2 incoming: spine and upper-right.

---

### cosmic_rift Redesign

**New node count strategy:** 12 nodes. Target: 9 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | rift_entry | spine | dialog |
| 2 | star_fields | spine | combat |
| 2 | star_tomb | upper | dialog |
| 2 | nebula_drift | challenge | combat (ambush) |
| 3 | NEW combat node | spine | combat |
| 3 | void_expanse | upper | combat |
| 4 | cosmic_bastion | spine | combat |
| 4 | event_horizon | challenge | encounter |
| 5 | NEW combat node | spine | combat |
| 5 | sentinel_silo | upper | dialog |
| 6 | prophet_sanctum | spine | dialog |
| 6 | void_vault | challenge | treasure |
| 7 | titan_pit | upper | challenge (named) |
| 8 | rift_boss (Void Herald) | spine | boss |

**Connections to remove:** The Void Vault → Titan's Pit multi-row crossing (redirect Void Vault to rejoin spine at column 6 instead). The long diagonal from The Abyss (upper-far-left) — fold its content into star_tomb at column 2. The "ladder-rung" crossing diagonals between the upper rail and spine.

**Connections to add:** `star_tomb` → `void_expanse` → `sentinel_silo` → `titan_pit` (clean upper rail, forward-only), `nebula_drift` → `event_horizon` → `void_vault` → `prophet_sanctum` (challenge rail merges before boss), `titan_pit` → `rift_boss` (upper rail terminal).

**After description:** Cosmic Rift gains structure from a clear 3-rail layout. The main spine charges through 4 combat nodes. The upper rail provides star-lore discoveries and the named titan_pit challenge. The challenge rail offers the nebula drift ambush, event horizon encounter, and void vault treasure — merging at prophet_sanctum just before the boss. Zero crossings.

---

### eternal_void Redesign

**New node count strategy:** 12 nodes. Target: 9 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | void_gates | spine | dialog |
| 2 | NEW combat node | spine | combat |
| 2 | memory_rubicon | upper | dialog |
| 2 | echo_wastes | challenge | combat (ambush) |
| 3 | void_library | spine | dialog |
| 3 | dying_star | upper | dialog |
| 3 | oblivion_warden | challenge | combat |
| 4 | NEW combat node | spine | combat |
| 4 | forgotten_map | upper | lore |
| 4 | trial_of_void | challenge | combat |
| 5 | np_solus | spine | dialog |
| 5 | former_revenent | challenge | combat |
| 6 | last_shrine | upper | shrine |
| 6 | oblivion_cache | challenge | treasure |
| 7 | void_entity | challenge | challenge (named) |
| 8 | the_unraveler | spine | boss (sole terminal — Echo Chamber removed as separate node, merged into boss identity) |

**Connections to remove:** The dual-boss configuration — fold Echo Chamber into the Unraveler's encounter definition rather than as a separate graph node. `memory_rubicon` long diagonal to void_library (anchor memory_rubicon in column 2 and connect to dying_star in column 3 instead). The Former Revenent triangle in the lower rail.

**Connections to add:** `last_shrine` → `the_unraveler` (upper rail terminal, 1 connection), `void_entity` → `the_unraveler` (challenge rail terminal, 1 connection — boss receives exactly 2 incoming).

**After description:** Eternal Void is the longest zone of Act 4. The redesign gives it a strict 3-rail treatment with a full combat spine, an upper lore/shrine rail culminating in a shrine before the boss, and a challenge rail that chains 3 combat encounters before a named challenge and treasure stop. The boss receives exactly 2 incoming connections. The Echo Chamber is folded into the Unraveler boss encounter script rather than existing as a map node.

---

### abyssal_depths Redesign

**New node count strategy:** 13 nodes. Target: 9 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | abyss_gate | spine | dialog |
| 2 | NEW combat node | spine | combat |
| 2 | unmade_echo | upper | lore |
| 2 | pressure_core | challenge | combat |
| 3 | drowned_hall | spine | combat |
| 3 | abyssal_membrane | upper | dialog |
| 3 | deep_trench | challenge | combat (ambush) |
| 4 | NEW combat node | spine | combat |
| 4 | genesis_worm_den | upper | combat |
| 4 | nexus_core | challenge | combat |
| 5 | NEW combat node | spine | combat |
| 5 | origin_shrine | upper | shrine |
| 5 | sunken_vault | challenge | treasure |
| 6 | abyssal_fortress | spine | dialog |
| 6 | NEW challenge node | challenge | challenge (named) |
| 8 | primordial_boss | spine | boss |

**Connections to remove:** `deep_trench` → `nexus_core` zigzag (make deep_trench exit to nexus_core forward-only at same y-level instead of ascending). `sunken_vault` → `primordial_boss` steep upward arc (redirect through abyssal_fortress first). The center-band web of 7+ nodes — resolved by spreading them across columns 2–5.

**Connections to add:** `unmade_echo` → `abyssal_membrane` → `origin_shrine` (upper rail chain), `origin_shrine` → `primordial_boss` (upper terminal), `pressure_core` → `deep_trench` → `nexus_core` → `sunken_vault` → NEW challenge → `primordial_boss` (challenge rail).

**After description:** Abyssal Depths is restructured from a center-cluster mess into a 3-rail zone with the heaviest combat density of any Act 5 zone (5 combat nodes on spine + 3 challenge rail combats). The upper rail provides two lore nodes and a shrine. The challenge rail is the longest in the game — 4 nodes — but all forward-facing and arriving at the boss from below.

---

### primordial_nexus Redesign

**New node count strategy:** 12 nodes. Target: 9 combat-type nodes.

**Grid layout:**

| Column | Node | Band | Type |
|--------|------|------|------|
| 1 | gates_of_creation | spine | dialog |
| 2 | NEW combat node | spine | combat |
| 2 | abyssal_resonance | upper | lore |
| 2 | creation_loom | challenge | combat (ambush) |
| 3 | arc_chamber | spine | combat |
| 3 | forgotten_mausoleum | upper | dialog |
| 3 | shattered_spire | challenge | encounter |
| 4 | NEW combat node | spine | combat |
| 4 | reality_shard | upper | dialog (moved from long-range diagonal to column 4) |
| 4 | lost_heaven | challenge | combat |
| 5 | gallery_unbound | spine | combat |
| 5 | prime_veil | upper | shrine |
| 5 | final_reckoning | challenge | challenge (named) |
| 6 | NEW combat node | spine | combat |
| 8 | the_apex | spine | boss |

**Connections to remove:** `reality_shard_storm` long-diagonal skip from column 1 to column 6 (anchor it at column 4 with proper connections to adjacent nodes). Triple fan-in at boss (remove `final_reckoning` direct → boss; route through gallery_unbound or a pre-boss merge node). `Creation Loom` isolated bottom-rail chain that ascends steeply (straighten to horizontal).

**Connections to add:** `abyssal_resonance` → `forgotten_mausoleum` → `prime_veil` (upper rail chain), `prime_veil` → `the_apex` (upper terminal), `creation_loom` → `shattered_spire` → `lost_heaven` → `final_reckoning` (challenge rail, all forward), `final_reckoning` → `gallery_unbound` (challenge rail rejoins spine at column 5 before boss push).

**After description:** Primordial Nexus is the game's final zone before the Act 5 boss. The redesign channels maximum pressure through a dense spine (5 combat nodes), a lore-and-shrine upper rail, and a 4-node challenge rail that culminates in a named final_reckoning encounter before merging back to the spine. The Apex boss receives exactly 2 incoming connections. No connector crosses any other.

---

## 4. Risks and Open Questions

### Risk 1: Save-Game Compatibility (HIGH)

Existing saves reference node IDs via `completedNodes`, `sneakedNodes`, and visited-state flags. If a node ID is **renamed**, the save cannot match it and the player's progress at that node is lost — the node resets to unvisited. If a node ID is **removed entirely**, any save that completed it will not corrupt but the removed node's visited-state is orphaned (harmless, but untidy).

**Mitigation:**
- Preserve all existing node IDs unchanged. New nodes get new IDs only. The redesign moves nodes spatially (changing `x`/`y`) but does not rename them.
- Nodes that are folded into other nodes (e.g., Echo Chamber in eternal_void) should remain as data entries with `hidden: true` or `removed: true` rather than being deleted — so existing save references do not produce JS errors.
- Flag each zone's new nodes with a comment `// M386-NEW` so they can be audited for save-load impact in QA.

### Risk 2: Story-Flag and Dialog-Event Impact (MEDIUM)

Several nodes carry `dialogEventId` fields that trigger story flags (e.g., `prologue_warning`, `border_boss` encounter). Moving these nodes spatially is safe — the event fires on node entry, not on position. However, if connection changes cause a story-flag node to become unreachable on a given path, the flag may never fire.

**Mitigation:**
- Identify all nodes with `dialogEventId`, `storyFlag`, or `flagsRequired` fields before implementation. Ensure every such node remains reachable from at least one viable path through the zone.
- Specific concern: `dust_roads` has `ash_lore` (Ruined Outpost) which likely fires a lore event. The redesign keeps it on the upper rail but must ensure it is reachable from the starting node.

### Risk 3: Boss Node Incoming-Connection Count (MEDIUM)

The "boss receives exactly 2 incoming" rule is new. Current bosses have 3–4 incoming in some zones. The game renderer may visually handle any number of connections — but the player experience of arriving at the boss from 4 different paths simultaneously feels unstructured. Constraining to 2 is a design choice, not a hard engine limit.

**Open question:** Does the MapScreen renderer handle boss-node incoming connections in a visually special way (e.g., converging line effect, or no special handling)? If there is no special handling, the 2-incoming rule is a visual optimization only and could be relaxed to 3 where the zone benefits from a third option.

### Risk 4: Dungeon Entry Node Placement (LOW)

Dungeon off-shoot nodes are injected at runtime by `_injectDungeonEntryNodes`. They use `anchorNodeId` and fixed `(x, y)` coordinates from the `DUNGEONS` definition. If the anchor node moves to a new column in the redesign, the dungeon entry node's `(x, y)` also needs updating — but since the DUNGEONS definitions use absolute percentages, they will render at the old position even if the anchor is at a new x.

**Mitigation:** In M386, update DUNGEON `x`/`y` coordinates for any dungeon whose `anchorNodeId` node changes x position significantly (>10% delta).

### Risk 5: BIG_FIGHT_NODE_OVERRIDES Reference Validity (LOW)

The `BIG_FIGHT_NODE_OVERRIDES` map references specific node IDs (e.g., `ruined_watch: 'big_goblin_warband'`). If node IDs are preserved (see Risk 1 mitigation), this is not a risk. If any node ID must change, the overrides must be updated in parallel.

---

## 5. Implementation Phasing

**Recommended order: Oldest acts first, highest-complexity zones last.**

Rationale: Act 1 zones are played by every user on every run. Bugs in border_roads or thornwood surface immediately. Acts 4–5 are played by a subset of users and have higher tolerance for iteration. Fixing the simpler zones first builds confidence in the tooling before tackling the 3-rail restructuring of abyssal_depths and primordial_nexus.

| Phase | Zone | Rationale | Risk Level |
|-------|------|-----------|------------|
| 1 | border_roads | Lowest complexity, played most often, fewest nodes | Low |
| 2 | thornwood | Similar simplicity to border_roads, no screenshot gap | Low |
| 3 | dust_roads | First multi-rail zone, tests the 3-rail pattern | Medium |
| 4 | ember_plateau | 2nd Act 2 zone, validates the approach on a busier map | Medium |
| 5 | hell_breach | Most connector crossings of any zone — most visible improvement | Medium-High |
| 6 | shattered_core | Validates the 3-rail pattern in Act 3 before moving to Act 4 | Medium |
| 7 | cosmic_rift | First Act 4 zone — introduces the named challenge rail pattern for high acts | Medium |
| 8 | eternal_void | Double-boss removal is the highest story-flag risk — do second-to-last | High |
| 9 | abyssal_depths | Highest node density restructure | High |
| 10 | primordial_nexus | Final zone — validate full system before shipping | High |

**Per-phase commit strategy (from Phase 14):** Each zone is committed as its own discrete batch. If a zone fails QA, it reverts independently without pulling down other zones' changes.

---

## Handoff to Implementation (M386)

The following facts are load-bearing for the implementer:

**Structural rules:**
- Node `x`/`y` are percentage values (0.0–1.0) relative to the map canvas. Trailhead anchors at x≈0.06; boss anchors at x≈0.92.
- Connections are defined as `exits: ['nodeId', ...]` on the source node. The renderer draws connectors from every node to all its exits.
- New nodes require a unique `id`, `type`, `name`, `x`, `y`, `exits`, and (for combat/challenge) `encounter` field.
- Dungeon nodes are injected at runtime from `DUNGEONS` — do not manually add dungeon entry nodes to zone `nodes` arrays.

**Save-compatibility rules:**
- Preserve all existing node IDs. Spatial changes (x, y) are safe. ID changes break saves.
- Removed nodes: mark `hidden: true` rather than deleting, or confirm with user that old saves may lose visited state for that node.

**Boss rule:**
- Boss node should receive exactly 2 incoming connections: one from the main spine, one from the upper or challenge rail.
- Boss node `exits` must remain `[]` (terminal).

**Task D node ID reservation:**
The following new node IDs are proposed in Phase 14 and must be used verbatim:
`road_patrol`, `watchtower_approach`, `road_challenge` (border_roads)
`web_tunnel`, `goblin_archers`, `warlord_camp` (thornwood)
`road_ambush_2`, `ashen_field`, `cult_outpost` (dust_roads)
`lava_approach`, `stronghold_break` (ember_plateau)
`hellgate_skirmish`, `brimstone_corridor`, `keep_courtyard` (hell_breach)
`rift_vanguard`, `soul_furnace` (shattered_core)
Acts 4–5 new node IDs to be finalized in M386 per Phase 14 note.

**Zone scroll / render bounds:**
Nodes outside y=0.08–0.92 may clip on small viewports. Keep all main-graph nodes within this range. Dungeon nodes at y=0.95 are intentional off-shoots.

**Graph connectivity audit:**
Phase 14 mandates a walk-all-exits connectivity check before release. The audit must confirm: every non-boss node can reach the boss node via forward exits, no node has 0 exits except the boss, and no node has an exit that references a non-existent node ID.

**Challenge-node namedPool field:**
New challenge nodes should include a `namedPool` array per Phase 14 §4. If the named roster does not yet have entries for that act/tier, leave `namedPool: []` and the system falls back to the dynamic title-prefix path.
