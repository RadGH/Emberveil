// M369-HARD-BUFF-APPLIED 2026-04-29T08:57:25.323Z
/**
 * Map data — public facade (refactor #2: god-file split).
 *
 * The data/structure that used to live inline here was split into cohesive
 * modules under src/maps/. This file re-exports the IDENTICAL surface so every
 * importer is untouched, and it still orchestrates the in-place zone-build
 * pipeline (towns / arrival / dungeon / hidden-boss / dialog-branch injection +
 * FTL grid layout) in EXACTLY the original order on the imported zone arrays.
 *
 *   src/maps/nodeTypes.js     — NODE_TYPES
 *   src/maps/zoneTables.js    — ZONE_* tables + BOSS_TAP_DROPS (from dataLoader)
 *   src/maps/dungeons.js      — DUNGEONS + DUNGEON_SKILL_CHECKS
 *   src/maps/zones.js         — PROLOGUE/ACT1..6 zone arrays + ZONE_ENCOUNTER_POOLS
 *   src/maps/dialogEvents.js  — DIALOG_EVENTS base + discovery + recurring merge
 *   (this file)               — HIDDEN_BOSS_*, BIG_FIGHT_*, ENEMIES/ENCOUNTERS
 *                               re-exports (from dataLoader) + the build pipeline
 *
 * Behaviour is byte-identical — guarded by scripts/verify-mapdata-exports-parity.mjs.
 */
import { GameState } from '../game/gameState.js';

// ── Canonical data loader (Phase 1 migration — step 5 complete) ─────────────
// ENEMIES / ENEMIES_ACT4/5/6 / ENCOUNTERS / HIDDEN_BOSS_ENCOUNTERS are now
// loaded exclusively from the canonical JSON in public/data/ via dataLoader.js.
// Legacy inline literals have been deleted (step 5). Rollback: git tag
// pre-canonical-migration (restores literals + step-4 flag path).
// Phase 2 step 6: BOSS_TAP_DROPS inline literal removed — now resolved from
// public/data/combat/drop-tables.json via dataLoader.js (centralized JSON
// loading). Re-exported below so existing import sites work unchanged.
// Parity gate: scripts/verify-drop-tables-parity.mjs.
import {
  ENEMIES_CANONICAL,
  ENEMIES_ACT4_CANONICAL,
  ENEMIES_ACT5_CANONICAL,
  ENEMIES_ACT6_CANONICAL,
  ENCOUNTERS_CANONICAL,
  HIDDEN_BOSS_ENCOUNTERS_CANONICAL,
} from '../game/dataLoader.js';

// ── Split modules — re-exported so the public surface is unchanged ──────────
import { NODE_TYPES } from './nodeTypes.js';
import {
  ZONE_DROP_CHANCE,
  ZONE_FAME_MULT,
  ZONE_UNLOCK_MAP,
  ZONE_NAMES,
  ACT_BOSS_ZONES,
  BOSS_TAP_DROPS,
} from './zoneTables.js';
import { DUNGEON_SKILL_CHECKS, DUNGEONS } from './dungeons.js';
import {
  PROLOGUE_ZONES,
  ACT1_ZONES,
  ACT2_ZONES,
  ACT3_ZONES,
  ACT4_ZONES,
  ACT5_ZONES,
  ACT6_ZONES,
  ZONE_ENCOUNTER_POOLS,
} from './zones.js';
import { DIALOG_EVENTS } from './dialogEvents.js';

export { NODE_TYPES };
export {
  ZONE_DROP_CHANCE,
  ZONE_FAME_MULT,
  ZONE_UNLOCK_MAP,
  ZONE_NAMES,
  ACT_BOSS_ZONES,
  BOSS_TAP_DROPS,
};
export { DUNGEON_SKILL_CHECKS, DUNGEONS };
export {
  PROLOGUE_ZONES,
  ACT1_ZONES,
  ACT2_ZONES,
  ACT3_ZONES,
  ACT4_ZONES,
  ACT5_ZONES,
  ACT6_ZONES,
  ZONE_ENCOUNTER_POOLS,
};
export { DIALOG_EVENTS };


// ─── Enemy Definitions ────────────────────────────────────────────────────────

// M315: Act 1-2 global damage multiplier raised to 1.8 (balance-loader.js).
// Base HP and dmg boosted ~1.3x here to also increase the challenge.
// Step 5 (M496+): inline literals deleted; data comes from canonical JSON.
export const ENEMIES = ENEMIES_CANONICAL;
export const ENEMIES_ACT5 = ENEMIES_ACT5_CANONICAL;

// ─── Encounter Tables ────────────────────────────────────────────────────────

export const ENCOUNTERS = ENCOUNTERS_CANONICAL;

// M279: nodes that escalate to a big-fight encounter when the party averages
// level 5+. Sparse 30%-ish overlay — only triggers if party qualifies.
export const BIG_FIGHT_NODE_OVERRIDES = {
  ruined_watch:    'big_goblin_warband',
  obsidian_fort:   'big_ash_swarm',
  veil_camp:       'big_ash_swarm',
  inferno_keep:    'big_demon_horde',
  shard_fortress:  'big_demon_horde',
  cosmic_bastion:  'big_void_tide',
  unraveler_ante:  'big_void_tide',
  nexus_core:      'big_abyssal_tide',
  architect_bridge:'big_abyssal_tide',
  dragon_skyroad:  'big_dragon_skyfall',
  storm_rookery:   'big_dragon_skyfall',
};
const _BIG_FIGHT_LEVEL = 5;
export function resolveBigFightEncounter(nodeId, partyAvgLevel) {
  if ((partyAvgLevel | 0) < _BIG_FIGHT_LEVEL) return null;
  return BIG_FIGHT_NODE_OVERRIDES[nodeId] || null;
}

// ─── M304: Hidden Boss Encounters ────────────────────────────────────────────
// Hidden boss nodes are injected into their parent zone's node list at startup.
// Each is invisible on the map until the player meets its precondition.
// Preconditions are evaluated by isHiddenNodeUnlocked() which MapScreen calls
// before deciding whether to render or allow interaction with the node.
//
// Precondition schema (all fields optional; evaluated with AND logic):
//   requireItem       — item.baseKey present anywhere in inventory
//   requireFlag       — story flag key that must be truthy
//   requireStat       — { stat: 'INT', min: 25 } — any party member meets it
//   requireBossesAll  — array of boss node IDs, all must be in completedBosses
//   requireNoDeath    — if true, player must NOT have the 'hero_died_in_act' flag
//
// The unlockedKey is stored in gs.hiddenBossesUnlocked (a Set-like array on gs).

export const HIDDEN_BOSS_ENCOUNTERS = HIDDEN_BOSS_ENCOUNTERS_CANONICAL;

// Hidden boss node definitions — injected by _injectHiddenBossNodes at startup.
// Each object becomes a new node on its parentZone, hanging off anchorNodeId.
// The `hidden: true` flag tells MapScreen to gate render on isHiddenNodeUnlocked.
export const HIDDEN_BOSS_NODES = [
  {
    id: 'hidden_vault_guardian',
    type: 'boss',
    name: 'Sealed Vault',
    hidden: true,
    encounterId: 'thornwood_vault_guardian',
    parentZone: 'thornwood',
    anchorNodeId: 'forest_enter',
    x: 0.48, y: 0.15,
    precondition: { requireItem: 'ember_etched_key' },
    prelud: 'A keyhole glows in the bark of the oldest tree.',
  },
  {
    // M412 — was type:'boss' which made it Hell Breach's SECOND boss alongside
    // Archfiend Malgrath at the act-end. Demoted to a challenge node so it's a
    // tough optional fight, not a duplicate boss for the act.
    id: 'hidden_void_scholar',
    type: 'challenge',
    name: 'Scholar\'s Sanctum',
    hidden: true,
    encounterId: 'void_scholar',
    encounter: 'void_scholar',
    parentZone: 'hell_breach',
    anchorNodeId: 'fell_ruins',
    x: 0.48, y: 0.15,
    precondition: { requireStat: { stat: 'INT', min: 25 } },
    prelud: 'A figure in an impossible library regards you with quiet interest.',
  },
  {
    id: 'hidden_echo_sovereign',
    type: 'boss',
    name: 'The Echo Chamber',
    hidden: true,
    encounterId: 'echo_sovereign',
    parentZone: 'eternal_void',
    anchorNodeId: 'void_boss',
    x: 0.94, y: 0.18,
    precondition: { requireBossesAll: ['void_boss', 'rift_boss'], requireNoDeath: true },
    prelud: 'The air remembers the Sovereign. The memory is angry.',
  },
  {
    id: 'hidden_first_ember',
    type: 'boss',
    name: 'The First Hearth',
    hidden: true,
    encounterId: 'the_first_ember',
    parentZone: 'primordial_nexus',
    anchorNodeId: 'architect_boss',
    x: 0.94, y: 0.18,
    precondition: { requireItem: 'ember_etched_key', requireBossesAll: ['abyss_boss', 'architect_boss'], requireNoDeath: true },
    prelud: 'A door of pure fire. It has been here since before the world named anything.',
  },
];

/**
 * M304 — isHiddenNodeUnlocked
 * Evaluates whether a hidden boss node's precondition is met given current gs.
 * Returns true if the node is visible/interactable.
 *
 * @param {object} node       — a node object with a `precondition` field
 * @param {object} gs         — GameState.get()
 * @returns {boolean}
 */
export function isHiddenNodeUnlocked(node, gs) {
  if (!node.hidden) return true;
  const pre = node.precondition;
  if (!pre) return true;

  // requireItem — any item in inventory whose baseKey matches
  if (pre.requireItem) {
    const inv = gs.inventory || [];
    const has = inv.some(i => (i.baseKey || i.type) === pre.requireItem);
    if (!has) return false;
  }

  // requireFlag — story flag must be set
  if (pre.requireFlag) {
    if (!gs.storyFlags?.[pre.requireFlag]) return false;
  }

  // requireStat — at least one party/companion member meets the threshold
  if (pre.requireStat) {
    const { stat, min } = pre.requireStat;
    const all = [...(gs.party || []), ...(gs.companions || [])];
    const meets = all.some(m => (m?.attrs?.[stat] || 0) >= min);
    if (!meets) return false;
  }

  // requireBossesAll — all listed boss node IDs must be in completedBosses
  if (Array.isArray(pre.requireBossesAll)) {
    const completed = gs.completedBosses || [];
    if (!pre.requireBossesAll.every(id => completed.includes(id))) return false;
  }

  // requireNoDeath — gs must NOT have 'hero_died_in_act' flag set
  if (pre.requireNoDeath) {
    if (gs.storyFlags?.hero_died_in_act) return false;
  }

  return true;
}

/**
 * M304 — getHiddenBossEncounter
 * Returns an encounter-compatible object for a hidden boss node or null.
 */
export function getHiddenBossEncounter(nodeDef) {
  if (!nodeDef || !nodeDef.encounterId) return null;
  return HIDDEN_BOSS_ENCOUNTERS[nodeDef.encounterId] || null;
}

// ─── Act 4 enemy re-export (kept with the facade — canonical source) ────────
// M315 rebalance: Act 4 enemy stats increased ~1.5x HP, ~1.4x damage vs prior.
export const ENEMIES_ACT4 = ENEMIES_ACT4_CANONICAL;

// ─── Act 6 enemy re-export (kept with the facade — canonical source) ────────
export const ENEMIES_ACT6 = ENEMIES_ACT6_CANONICAL;

// ─── Zone-build pipeline ────────────────────────────────────────────────────
// Runs at module-init, mutating the imported zone arrays IN PLACE, in the
// exact order it always ran inside this file. Order is load-bearing:
// towns/splice -> arrival wrap -> dungeon -> hidden boss -> dialog branch ->
// FTL grid layout (which must see the final post-injection node set).

// ─── M72: Reduced Town System ────────────────────────────────────────────────
// User feedback (post-M71): fewer towns, not one per zone. Keep exactly one
// town per act, at the first zone of that act. Emberglen already exists as a
// real node on border_roads/start; the other five are spliced in as the
// "start" town of their act's opening zone. Backtracking is trivial because
// the town is attached directly to the zone's entry node.

// Spec: { zoneId, attachNodeId, townId, name, x, y } — one per act.
// M22: town placement reshuffle — towns now sit off the obvious mainline path
// between zone start and zone boss. Each town attaches to a mid-zone node
// (not the start "*_gate"). Positions are deliberately scattered; the user
// will fine-tune visually later.
const _ACT_TOWN_INSERTS = [
  // Act 1 — Emberglen already exists at border_roads/start, do not insert.
  // Act 2 — volcanic. Off-branch via salt_tunnels (south branch, mid-zone).
  { zoneId: 'dust_roads',      attach: 'salt_tunnels',  id: 'town_cinderhold', name: 'Cinderhold',   x: 0.42, y: 0.70 },
  // Act 3 — hell. Off-branch via inferno_keep (mid-zone hub).
  { zoneId: 'hell_breach',     attach: 'inferno_keep',  id: 'town_dreadhearth',name: 'Dreadhearth',  x: 0.62, y: 0.32 },
  // Act 4 — void. Off-branch via cosmic_bastion (mid-zone hub).
  { zoneId: 'cosmic_rift',     attach: 'cosmic_bastion',id: 'town_nullreach',  name: 'Nullreach',    x: 0.46, y: 0.62 },
  // Act 5 — primordial. Off-branch via nexus_core (mid-zone hub).
  { zoneId: 'abyssal_depths',  attach: 'nexus_core',    id: 'town_deepcradle', name: 'Deepcradle',   x: 0.58, y: 0.55 },
  // Act 6 — dragon. Off-branch via wyrm_citadel (mid-zone hub).
  { zoneId: 'dragons_reach',   attach: 'wyrm_citadel',  id: 'town_drakegate',  name: 'Drakegate',    x: 0.50, y: 0.20 },

  // M280 — second town per act (one per remaining map). Names assigned by
  // theme. All attach to a mid-zone hub node so the town isn't a dead-end.
  // Act 1 zone 2 — Thornwood Forest → forest village.
  { zoneId: 'thornwood',         attach: 'goblin_camp',     id: 'town_greenbough',    name: 'Greenbough',      x: 0.42, y: 0.78 },
  // Act 2 zone 2 — Ember Plateau → fire watchtower hub.
  { zoneId: 'ember_plateau',     attach: 'veil_stronghold', id: 'town_emberwatch',    name: 'Emberwatch',      x: 0.58, y: 0.18 },
  // Act 3 zone 2 — Shattered Core → besieged fortress.
  { zoneId: 'shattered_core',    attach: 'shard_fortress',  id: 'town_lastbastion',   name: 'The Last Bastion',x: 0.42, y: 0.74 },
  // Act 4 zone 2 — Eternal Void → harbor between rifts.
  { zoneId: 'eternal_void',      attach: 'unraveler_ante',  id: 'town_voidharbor',    name: 'Void Harbor',     x: 0.40, y: 0.70 },
  // Act 5 zone 2 — Primordial Nexus → respite at the loom.
  { zoneId: 'primordial_nexus',  attach: 'architect_bridge',id: 'town_creationrest',  name: 'Creation Rest',   x: 0.42, y: 0.18 },
  // Act 6 zone 2 — Dragon Throne → outpost amid the dragon spires.
  { zoneId: 'dragon_throne',     attach: 'dragon_fortress', id: 'town_scaleholt',     name: 'Scaleholt',       x: 0.42, y: 0.74 },
];

const _ALL_ZONES_M71 = [...PROLOGUE_ZONES, ...ACT1_ZONES, ...ACT2_ZONES, ...ACT3_ZONES, ...ACT4_ZONES, ...ACT5_ZONES, ...ACT6_ZONES];

export const TOWNS = {};
// Seed pre-existing town nodes (Emberglen).
for (const z of _ALL_ZONES_M71) {
  for (const n of z.nodes) {
    if (n.type === 'town') {
      TOWNS[n.id] = { id: n.id, zoneId: z.id, name: n.name, act: z.act, biome: z.id };
    }
  }
}
// Splice in the per-act towns.
for (const ins of _ACT_TOWN_INSERTS) {
  const zone = _ALL_ZONES_M71.find(z => z.id === ins.zoneId);
  if (!zone) continue;
  if (zone.nodes.find(n => n.id === ins.id)) continue;
  const attach = zone.nodes.find(n => n.id === ins.attach);
  if (!attach) continue;
  if (!attach.exits.includes(ins.id)) attach.exits.push(ins.id);
  zone.nodes.push({ id: ins.id, type: 'town', name: ins.name, x: ins.x, y: ins.y, exits: [ins.attach] });
  TOWNS[ins.id] = { id: ins.id, zoneId: ins.zoneId, name: ins.name, act: zone.act, biome: ins.zoneId };
}

/**
 * Find the nearest town to a node within its zone. Returns town meta or null.
 * Walks BFS over the zone graph from currentNodeId and returns the first town hit.
 */
export function findNearestTown(zoneId, currentNodeId) {
  const zone = _ALL_ZONES_M71.find(z => z.id === zoneId);
  if (!zone) return null;
  const byId = Object.fromEntries(zone.nodes.map(n => [n.id, n]));
  if (!byId[currentNodeId]) return null;
  // Build undirected adjacency for BFS (exits are forward-only in data).
  const adj = {};
  for (const n of zone.nodes) {
    adj[n.id] = adj[n.id] || new Set();
    for (const e of (n.exits || [])) {
      adj[n.id].add(e);
      adj[e] = adj[e] || new Set();
      adj[e].add(n.id);
    }
  }
  const seen = new Set([currentNodeId]);
  const queue = [currentNodeId];
  while (queue.length) {
    const id = queue.shift();
    const node = byId[id];
    if (node && node.type === 'town') return { ...TOWNS[id], nodeId: id };
    for (const next of adj[id] || []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  // Fallback: first town in zone, if any.
  const anyTown = zone.nodes.find(n => n.type === 'town');
  if (anyTown) return { ...TOWNS[anyTown.id], nodeId: anyTown.id };
  return null;
}

/** Look up a town by its node id. */
export function getTownById(townId) { return TOWNS[townId] || null; }

// ─── M279 — No-op "arrival" node prepended to every non-prologue zone ────────
// Fixes the issue where transitioning to a new map skipped the entry node:
// the cross-zone-link / boss-unlock code drops the party on nodes[0]. By
// making nodes[0] a harmless trailhead (type:'lore', noEvent:true), the
// player arrives safely and walks to the original first node to trigger any
// dialog/town/combat. Mutates the zone arrays in place so every consumer
// (MapScreen, CombatScreen, etc.) sees the same shape with no plumbing.
function _wrapZoneWithArrival(z) {
  if (!z?.nodes?.length) return;
  if (z.id === 'prologue') return;        // prologue stays linear/short
  if (z.nodes[0]?.id === 'arrival') return; // already wrapped
  const oldFirst = z.nodes[0];
  // M322: ensure the trailhead has at least ~12% of the map width between it
  // and the first real node so the two don't visually overlap. If oldFirst
  // sits very close to the left edge, shove it right while keeping its y.
  const ARRIVAL_X = 0.03;
  const MIN_GAP = 0.12;
  if ((oldFirst.x || 0) < ARRIVAL_X + MIN_GAP) {
    oldFirst.x = ARRIVAL_X + MIN_GAP;
  }
  const arrival = {
    id: 'arrival',
    type: NODE_TYPES.LORE,
    name: 'Trailhead',
    noEvent: true,                  // MapScreen reads this and skips event trigger
    x: ARRIVAL_X,
    y: oldFirst.y || 0.5,
    exits: [oldFirst.id],
  };
  z.nodes.unshift(arrival);
}
for (const arr of [ACT1_ZONES, ACT2_ZONES, ACT3_ZONES, ACT4_ZONES, ACT5_ZONES, ACT6_ZONES]) {
  for (const z of arr) _wrapZoneWithArrival(z);
}

// ─── M279 — Inject dungeon entry nodes onto their parent zones ──────────────
// Each dungeon becomes a new node hanging off the anchor as an off-shoot
// (the user's rule: "never as an in-between connecting two nodes"). The
// dungeon node is terminal on the parent map — clicking it pushes
// DungeonScreen, and on victory/give-up the player returns to the anchor.
// MUST run AFTER both _wrapZoneWithArrival and the ACT_*_ZONES definitions.
function _injectDungeonEntryNodes() {
  const allActZones = [...ACT1_ZONES, ...ACT2_ZONES, ...ACT3_ZONES, ...ACT4_ZONES, ...ACT5_ZONES, ...ACT6_ZONES];
  for (const dn of Object.values(DUNGEONS)) {
    const zone = allActZones.find(z => z.id === dn.parentZone);
    if (!zone) continue;
    const anchor = zone.nodes.find(n => n.id === dn.anchorNodeId);
    if (!anchor) continue;
    if (zone.nodes.some(n => n.id === `dungeon_${dn.id}`)) continue;
    const dnNode = {
      id: `dungeon_${dn.id}`,
      type: NODE_TYPES.DUNGEON,
      name: dn.name,
      x: dn.x, y: dn.y,
      exits: [],
      dungeonId: dn.id,
    };
    anchor.exits = [...(anchor.exits || []), dnNode.id];
    zone.nodes.push(dnNode);
  }
}
_injectDungeonEntryNodes();

// ─── M304 — Inject hidden boss nodes onto parent zones ───────────────────────
// Works just like dungeon injection: hangs a new node off an anchor as an
// off-shoot. Hidden nodes carry hidden:true so MapScreen gates render on
// isHiddenNodeUnlocked(). MUST run after _wrapZoneWithArrival.
function _injectHiddenBossNodes() {
  const allActZones = [...ACT1_ZONES, ...ACT2_ZONES, ...ACT3_ZONES, ...ACT4_ZONES, ...ACT5_ZONES, ...ACT6_ZONES];
  for (const hn of HIDDEN_BOSS_NODES) {
    const zone = allActZones.find(z => z.id === hn.parentZone);
    if (!zone) continue;
    const anchor = zone.nodes.find(n => n.id === hn.anchorNodeId);
    if (!anchor) continue;
    // Avoid double-injection
    if (zone.nodes.some(n => n.id === hn.id)) continue;
    const newNode = {
      id: hn.id,
      type: hn.type,
      name: hn.name,
      hidden: true,
      encounterId: hn.encounterId,
      precondition: hn.precondition,
      x: hn.x,
      y: hn.y,
      exits: [],
    };
    // Hidden boss nodes are off-shoots; parent gets an exit but the hidden node
    // is not on the critical path (exits: [] keeps it terminal).
    anchor.exits = [...(anchor.exits || []), newNode.id];
    zone.nodes.push(newNode);
  }
}
_injectHiddenBossNodes();

// ─── M324 — FTL-style grid layout pass ──────────────────────────────────────
// Applied AFTER all node-injection (arrival / dungeon / hidden boss / dialog)
// so it sees the final node set. Snaps each node's (x, y) to a cell on a
// 12-column × 12-row grid (6 logical rows × 2 alternating sublanes — even
// rows for thru-nodes, odd rows reserved for one-offs/branches). Preserves
// the graph topology (no edges added or removed); just regularises spacing
// so close-proximity overlaps and similar-angle edge collisions stop
// happening across zones.
//
// Algorithm:
//  1. BFS from the first node (arrival / start) to assign each node a
//     "depth" (column).
//  2. Classify each node as "thru" (≥1 outgoing exit and ≥1 incoming) or
//     "one-off" (terminal branch, or hidden boss, or dungeon entry).
//  3. For each column, place thru-nodes on even rows first, one-offs on the
//     adjacent odd row, distributing vertically by their original y.
//  4. Re-snap (x, y) to the final cell centre.
// ─── M439: FTL-style grid layout (full rebuild) ─────────────────────────────
// Replaces the M324..M348 incremental patches. We no longer try to preserve
// the hand-authored exits — we rebuild both the GRAPH (exits) and the
// POSITIONS so that:
//   * Every non-prologue zone forms a strict staggered grid (FTL pattern).
//   * Edges connect column c → column c+1 only — no backwards travel.
//   * No two edges cross (per-column fan-out is checked for crossings).
//   * No node has more than 4 total connections (in + out ≤ 4).
//   * No "orphan" nodes: every interior node has ≥1 incoming AND ≥1 outgoing.
//     Filler combat nodes are inserted to fill column gaps when needed.
//   * Dungeons + hidden bosses + challenges remain as off-shoot nodes hanging
//     off a parent thru-node (single in-edge, no out-edge; the dungeon screen
//     returns the player to the parent on completion).
//
// Inputs: zone.nodes (preserve id/type/encounter/dialogEventId/etc.).
// Outputs: zone.nodes mutated in place — exits rewritten, x/y rewritten,
//          new filler combat nodes pushed if needed.
// ─── M441: FTL hex/staggered grid — diagonal edges only ────────────────────
// User feedback after M440:
//   * Every other column is shifted down by 50% of a row step so adjacent
//     columns form a honeycomb. This guarantees that every edge between
//     adjacent columns is diagonal — no horizontal/vertical lines.
//   * Each node connects to its TWO diagonal neighbours in the next column
//     (up-right + down-right). 1-node columns reach both diagonals of the
//     next column for "≥2 forward paths".
//   * Boss is forced to be the LAST entry in z.nodes so MapScreen's
//     forward-cross-zone arrow lights up only from the boss node.
//   * Dungeons + hidden bosses sit on an "alternate grid" — between two
//     trunk columns at a half-row y offset — so they read as off-shoots
//     and never sit on a trunk edge.
const ZONE_PROFILES = {
  border_roads:    [5, 3],
  thornwood:       [6, 3],
  dust_roads:      [6, 4],
  ember_plateau:   [7, 4],
  hell_breach:     [7, 4],
  shattered_core:  [8, 4],
  cosmic_rift:     [8, 5],
  eternal_void:    [8, 5],
  abyssal_depths:  [9, 5],
  primordial_nexus:[9, 5],
  dragons_reach:   [9, 5],
  dragon_throne:   [9, 5],
};
function _profileForZone(_, L, H) {
  const out = [];
  for (let c = 0; c < L; c++) out.push(Math.min(H, c + 1, L - c));
  return out;
}
// k rows spread evenly across the H slot range. k=1 → centered; k=H → all
// integer rows; intermediate k → evenly spaced including the band edges.
function _slotPositionsForCol(k, H) {
  if (k <= 0) return [];
  if (k === 1) return [(H - 1) / 2];
  const out = [];
  for (let i = 0; i < k; i++) out.push((i / (k - 1)) * (H - 1));
  return out;
}
function _layoutZoneToFTLGrid(z) {
  if (!z?.nodes?.length) return;
  if (z.id === 'prologue') return;

  const original = z.nodes.slice();
  const idMap = new Map(original.map(n => [n.id, n]));
  const startNode = original[0];
  const bossNode  = original.find(n => n.type === NODE_TYPES.BOSS) || original[original.length - 1];

  const SIDE_TYPES = new Set([NODE_TYPES.DUNGEON]);
  const isSide    = (n) => SIDE_TYPES.has(n.type) || !!n.hidden;

  const trunk = original.filter(n => n !== startNode && n !== bossNode && !isSide(n));
  const sides = original.filter(n => n !== startNode && n !== bossNode && isSide(n));

  let [L, H] = ZONE_PROFILES[z.id] || [6, 3];
  const interiorSum = (LL, HH) => {
    let s = 0;
    for (let c = 1; c <= LL - 2; c++) s += Math.min(HH, c + 1, LL - c);
    return s;
  };
  while (interiorSum(L, H) < trunk.length) L += 1;

  const profile = _profileForZone(z.id, L, H);
  const cells = profile.map(k => Array(k).fill(null));
  cells[0][0] = startNode;
  cells[L - 1][0] = bossNode;

  let cursor = 0;
  for (let c = 1; c <= L - 2; c++) {
    for (let i = 0; i < profile[c]; i++) {
      const n = trunk[cursor++];
      if (n) cells[c][i] = n;
      else {
        const fillerId = `${z.id}_filler_${c}_${i}`;
        const filler = {
          id: fillerId,
          type: NODE_TYPES.COMBAT,
          name: 'Wandering Foes',
          // M450 — pick the first encounter from the zone's own random
          // encounter pool so filler combat scales with the act. Was
          // hardcoded to 'goblin_patrol', which made Act 5 + Act 6
          // filler nodes laughably weak. Falls back to the zone's
          // explicit fillerEncounter or, last-ditch, goblin_patrol.
          encounter: z.fillerEncounter
            || (ZONE_ENCOUNTER_POOLS[z.id] && ZONE_ENCOUNTER_POOLS[z.id][0])
            || 'goblin_patrol',
          exits: [],
        };
        cells[c][i] = filler;
        idMap.set(fillerId, filler);
      }
    }
  }

  // Honeycomb stagger: odd-indexed columns are shifted down by 0.5 of a row.
  // The visual y of (c, slotY) is therefore slotY + (c % 2) * 0.5. Two
  // adjacent columns then have nodes that are NEVER at the same y, so every
  // edge between them is diagonal.
  const COL_STAGGER = 0.5;
  const visualY = (c, slotY) => slotY + (c % 2 === 1 ? COL_STAGGER : 0);

  // Compute placement for each node.
  const placement = new Map();
  for (let c = 0; c < L; c++) {
    const slots = _slotPositionsForCol(profile[c], H);
    for (let i = 0; i < profile[c]; i++) {
      const n = cells[c][i];
      if (n) placement.set(n.id, { col: c, slot: i, slotY: slots[i], vy: visualY(c, slots[i]) });
    }
  }

  for (const n of original) n.exits = [];
  for (const id of placement.keys()) idMap.get(id).exits = [];

  const outDeg = new Map(), inDeg = new Map();
  const inc = (m, id) => m.set(id, (m.get(id) || 0) + 1);

  // Edge build — each from connects to its 2 closest to-nodes by visual-y
  // distance. With the column stagger, the two closest are always diagonals
  // (one up-right, one down-right) because the stagger guarantees no two
  // adjacent-column nodes share visual y. Cap incoming at 3 per to-node.
  for (let c = 0; c < L - 1; c++) {
    const fromCount = profile[c];
    const toCount   = profile[c + 1];
    if (!fromCount || !toCount) continue;
    const fromSlots = _slotPositionsForCol(fromCount, H);
    const toSlots   = _slotPositionsForCol(toCount, H);

    // M445 — User's hard rule: ALWAYS ≥2 forward paths. Dead-ends are
    // forbidden (the M443 dead-end was a 3→2 transition where two from-nodes
    // saturated the in-cap=2 of the 2 to-nodes, leaving the 3rd from-node
    // with 0 outgoing). Dynamic in-cap so we never run out of incoming
    // capacity for the from-side guarantee:
    //   inCap = max(2, ceil(fromCount * 2 / toCount))
    // Examples:
    //   2→3 → ceil(4/3)=2 → cap 2  (4 edges total)
    //   3→3 → ceil(6/3)=2 → cap 2  (6 edges)
    //   3→2 → ceil(6/2)=3 → cap 3  (6 edges, each to has 3 in)  ← was the bug
    //   4→2 → ceil(8/2)=4 → cap 4  (8 edges, each to has 4 in)
    //   4→3 → ceil(8/3)=3 → cap 3
    //   1→2 → ceil(2/2)=2 → cap 2
    // The total-degree-4 cap is tightened where it can be honoured, but the
    // ≥2-forward guarantee wins ties.
    const target = (toCount >= 2) ? 2 : 1;
    const dynInCap = Math.max(2, Math.ceil(fromCount * 2 / toCount));

    for (let fi = 0; fi < fromCount; fi++) {
      const fromN = cells[c][fi];
      const fy = visualY(c, fromSlots[fi]);
      const ranked = [];
      for (let ti = 0; ti < toCount; ti++) {
        const ty = visualY(c + 1, toSlots[ti]);
        ranked.push({ ti, dy: Math.abs(ty - fy), sgn: ty - fy });
      }
      const above = ranked.filter(r => r.sgn < 0).sort((a, b) => a.dy - b.dy);
      const below = ranked.filter(r => r.sgn > 0).sort((a, b) => a.dy - b.dy);
      const pickList = [];
      if (above[0]) pickList.push(above[0]);
      if (below[0]) pickList.push(below[0]);
      if (pickList.length < target) {
        const remaining = ranked
          .filter(r => !pickList.includes(r))
          .sort((a, b) => a.dy - b.dy);
        for (const r of remaining) {
          if (pickList.length >= target) break;
          pickList.push(r);
        }
      }
      for (const r of pickList.slice(0, target)) {
        if ((outDeg.get(fromN.id) || 0) >= 3) break;
        const toN = cells[c + 1][r.ti];
        if ((inDeg.get(toN.id) || 0) >= dynInCap) continue;
        if (fromN.exits.includes(toN.id)) continue;
        fromN.exits.push(toN.id);
        inc(outDeg, fromN.id);
        inc(inDeg, toN.id);
      }
    }

    // Pass 1.5 — guarantee every from-node has ≥1 outgoing. Bypass the
    // in-cap if needed (the user has explicitly said dead-ends are
    // unacceptable). Picks the closest to-node not already in this f's
    // exit list.
    for (let fi = 0; fi < fromCount; fi++) {
      const fromN = cells[c][fi];
      if ((outDeg.get(fromN.id) || 0) > 0) continue;
      const fy = visualY(c, fromSlots[fi]);
      const ranked = [];
      for (let ti = 0; ti < toCount; ti++) {
        const ty = visualY(c + 1, toSlots[ti]);
        ranked.push({ ti, dy: Math.abs(ty - fy) });
      }
      ranked.sort((a, b) => a.dy - b.dy);
      for (const r of ranked) {
        const toN = cells[c + 1][r.ti];
        if (fromN.exits.includes(toN.id)) continue;
        // Hard guarantee: take the slot even if dynInCap is exceeded.
        fromN.exits.push(toN.id);
        inc(outDeg, fromN.id);
        inc(inDeg, toN.id);
        break;
      }
    }

    // Pass 1.6 — also guarantee every from-node has ≥2 outgoing when
    // toCount ≥ 2. This is what the user explicitly demanded ("ALWAYS
    // TWO PATHS"). Same bypass-cap rule.
    if (toCount >= 2) {
      for (let fi = 0; fi < fromCount; fi++) {
        const fromN = cells[c][fi];
        if ((outDeg.get(fromN.id) || 0) >= 2) continue;
        if ((outDeg.get(fromN.id) || 0) >= 3) continue;
        const fy = visualY(c, fromSlots[fi]);
        const ranked = [];
        for (let ti = 0; ti < toCount; ti++) {
          const ty = visualY(c + 1, toSlots[ti]);
          ranked.push({ ti, dy: Math.abs(ty - fy) });
        }
        ranked.sort((a, b) => a.dy - b.dy);
        for (const r of ranked) {
          const toN = cells[c + 1][r.ti];
          if (fromN.exits.includes(toN.id)) continue;
          fromN.exits.push(toN.id);
          inc(outDeg, fromN.id);
          inc(inDeg, toN.id);
          break;
        }
      }
    }

    // Pass 2 — every to-node must have ≥1 incoming.
    for (let ti = 0; ti < toCount; ti++) {
      const toN = cells[c + 1][ti];
      if ((inDeg.get(toN.id) || 0) > 0) continue;
      const ty = visualY(c + 1, toSlots[ti]);
      const ranked = [];
      for (let fi = 0; fi < fromCount; fi++) {
        const fy = visualY(c, fromSlots[fi]);
        ranked.push({ fi, dy: Math.abs(fy - ty) });
      }
      ranked.sort((a, b) => a.dy - b.dy);
      for (const r of ranked) {
        const fromN = cells[c][r.fi];
        if ((outDeg.get(fromN.id) || 0) >= 3) continue;
        if (fromN.exits.includes(toN.id)) continue;
        fromN.exits.push(toN.id);
        inc(outDeg, fromN.id);
        inc(inDeg, toN.id);
        break;
      }
    }

    // M442 — Pass 3: pump incoming up to 2 per to-node where possible.
    // Per user spec, every interior node should typically offer 2 forward
    // AND 2 backward paths (one of which is where you came from). Strict
    // 4-total-degree cap: skip if either endpoint already sits at degree 4.
    // Also require the candidate edge to be diagonal (y-delta > 0.01) so
    // we don't introduce horizontal links.
    for (let ti = 0; ti < toCount; ti++) {
      const toN = cells[c + 1][ti];
      if ((inDeg.get(toN.id) || 0) >= 2) continue;
      const ty = visualY(c + 1, toSlots[ti]);
      const ranked = [];
      for (let fi = 0; fi < fromCount; fi++) {
        const fy = visualY(c, fromSlots[fi]);
        const dy = Math.abs(fy - ty);
        if (dy > 1.05) continue;        // near diagonal only
        if (dy < 0.05) continue;        // skip flat (same-y) edges
        ranked.push({ fi, dy });
      }
      ranked.sort((a, b) => a.dy - b.dy);
      for (const r of ranked) {
        const fromN = cells[c][r.fi];
        if (fromN.exits.includes(toN.id)) continue;
        const fromTotal = (outDeg.get(fromN.id) || 0) + (inDeg.get(fromN.id) || 0);
        const toTotal   = (outDeg.get(toN.id)   || 0) + (inDeg.get(toN.id)   || 0);
        // Reserve 1 slot for a potential side-branch attachment that runs
        // AFTER all edge passes — keep both endpoints at degree ≤ 3 here so
        // total stays ≤ 4 once dungeons / hidden bosses pile on.
        if (fromTotal >= 3) continue;
        if (toTotal   >= 3) continue;
        fromN.exits.push(toN.id);
        inc(outDeg, fromN.id);
        inc(inDeg, toN.id);
        break;
      }
    }
  }

  // Side branches (dungeons / hidden bosses) — placed on the "between" grid
  // (col + 0.5) with a half-step y offset so they sit between two trunk
  // rows of the next column.
  const sideAttachments = [];
  for (const sn of sides) {
    let parent = original.find(n => Array.isArray(n.exits) && n.exits.includes(sn.id));
    if (!parent || !placement.has(parent.id)) {
      const mid = Math.floor(L / 2);
      let best = null, bestD = Infinity;
      for (const [id, p] of placement) {
        if (id === startNode.id || id === bossNode.id) continue;
        const d = Math.abs(p.col - mid);
        if (d < bestD) { bestD = d; best = idMap.get(id); }
      }
      parent = best;
    }
    if (!parent) continue;
    const pp = placement.get(parent.id);
    if (!pp) continue;
    if ((outDeg.get(parent.id) || 0) + (inDeg.get(parent.id) || 0) >= 4) continue;
    parent.exits.push(sn.id);
    inc(outDeg, parent.id);
    inc(inDeg, sn.id);
    sideAttachments.push({ sn, parent, pp });
  }

  // Position pass.
  const Y_MIN = 0.10;
  const Y_MAX = 0.84;
  const X_MIN = 0.06;
  const X_MAX = 0.94;
  // Total visual y span ranges from 0 (slotY=0, even col) to (H-1)+stagger
  // (slotY=H-1, odd col). Normalise into [Y_MIN, Y_MAX].
  const vyMax = (H - 1) + COL_STAGGER;
  const xOfCol = (col) => (L === 1) ? 0.5 : X_MIN + (col / (L - 1)) * (X_MAX - X_MIN);
  const yOfVy  = (vy)  => (vyMax === 0) ? 0.5 : Y_MIN + (vy / vyMax) * (Y_MAX - Y_MIN);
  const writeXY = (n, col, vy, dx = 0, dy = 0) => {
    n.x = xOfCol(col) + dx;
    n.y = yOfVy(vy) + dy;
    n.x = Math.max(0.04, Math.min(0.96, n.x));
    n.y = Math.max(0.06, Math.min(0.86, n.y));
  };
  for (let c = 0; c < L; c++) {
    const slots = _slotPositionsForCol(profile[c], H);
    for (let i = 0; i < profile[c]; i++) {
      const n = cells[c][i];
      if (n) writeXY(n, c, visualY(c, slots[i]));
    }
  }
  // Side branches: sit at (parent.col + 0.5, parent.vy + 0.5) — exactly the
  // staggered "alternate" cell that no trunk node occupies.
  const sideToggle = new Map();
  for (const { sn, parent, pp } of sideAttachments) {
    const cnt = sideToggle.get(parent.id) || 0;
    sideToggle.set(parent.id, cnt + 1);
    const halfRow = (cnt % 2 === 0) ? -0.5 : 0.5;
    const colOffset = (pp.col < L - 1) ? 0.5 : -0.5;
    const sideCol = pp.col + colOffset;
    const sideVy  = Math.max(0, Math.min(vyMax, pp.vy + halfRow));
    sn.x = Math.max(0.04, Math.min(0.96, xOfCol(sideCol)));
    sn.y = Math.max(0.06, Math.min(0.86, yOfVy(sideVy)));
  }

  // Sync z.nodes with the boss as the LAST entry. MapScreen's
  // _getCrossZoneLink uses nodes[length-1] to detect the boss; if anything
  // else trails the boss, the forward cross-zone arrow lights up on the
  // wrong node and points off-canvas past the boss.
  const finalIds = new Set();
  for (let c = 0; c < L; c++) for (let i = 0; i < profile[c]; i++) {
    const n = cells[c][i]; if (n) finalIds.add(n.id);
  }
  for (const sn of sides) finalIds.add(sn.id);
  const next = [];
  next.push(startNode);
  for (let c = 1; c <= L - 2; c++) {
    for (let i = 0; i < profile[c]; i++) {
      const n = cells[c][i];
      if (n && n !== startNode && n !== bossNode) next.push(n);
    }
  }
  for (const sn of sides) if (finalIds.has(sn.id)) next.push(sn);
  next.push(bossNode);
  z.nodes = next;
}
// FTL grid layout deferred — runs AFTER dialog branch injection below so
// dialog nodes also get snapped to the grid (otherwise their hardcoded
// (x, y) overlap with the trunk and produce ~80 edge crossings per session).

// ─── M304 — Inject branching dialog nodes into zone maps ─────────────────────
// Each entry adds a new DIALOG node hanging off an anchor as an off-shoot.
// The node.id matches the DIALOG_EVENTS key so MapScreen._resolveDialogEvent
// picks it up automatically.
const M304_DIALOG_NODES = [
  // Act 1 — border_roads / thornwood
  { zone: 'border_roads', anchor: 'road_ambush',   id: 'act1_dying_soldier',       x: 0.38, y: 0.72, name: 'Wounded Soldier' },
  { zone: 'border_roads', anchor: 'ruined_watch',  id: 'act1_spell_seeker',        x: 0.78, y: 0.22, name: 'Eager Apprentice' },
  { zone: 'thornwood',    anchor: 'forest_enter',  id: 'act1_warden_reward',       x: 0.28, y: 0.78, name: 'Warden\'s Request' },
  { zone: 'thornwood',    anchor: 'seer_hut',      id: 'act1_ghost_pact',          x: 0.60, y: 0.34, name: 'Faded Shade' },
  { zone: 'thornwood',    anchor: 'goblin_camp',   id: 'act1_hedge_mage',          x: 0.46, y: 0.82, name: 'Hedge-Mage' },
  { zone: 'thornwood',    anchor: 'hidden_path',   id: 'act1_charm_cache',         x: 0.38, y: 0.88, name: 'Mossy Cairn' },
  { zone: 'border_roads', anchor: 'crossroads_a',  id: 'act1_merchant_resurfaces', x: 0.54, y: 0.12, name: 'Recovered Merchant' },
  { zone: 'thornwood',    anchor: 'wood_test',     id: 'act1_lieutenant',          x: 0.78, y: 0.64, name: 'Garrison Lieutenant' },
  // Act 2 — dust_roads / ember_plateau
  { zone: 'dust_roads',   anchor: 'ash_gate',      id: 'act2_shrine_desecrated',   x: 0.18, y: 0.28, name: 'Shattered Shrine' },
  { zone: 'dust_roads',   anchor: 'ash_lore',      id: 'act2_sentinel_comrade',    x: 0.30, y: 0.72, name: 'Off-Duty Sentinel' },
  { zone: 'dust_roads',   anchor: 'black_spire',   id: 'act2_bard_crowd',          x: 0.66, y: 0.30, name: 'Desperate Refugee' },
  { zone: 'dust_roads',   anchor: 'obsidian_vein', id: 'act2_thief_encounter',     x: 0.46, y: 0.14, name: 'Caught Thief' },
  { zone: 'ember_plateau', anchor: 'lore_monolith', id: 'act2_veil_lens_activates', x: 0.82, y: 0.78, name: 'Veil Crack' },
  { zone: 'dust_roads',   anchor: 'ash_gate',      id: 'act2_mass_grave',          x: 0.18, y: 0.72, name: 'Mass Grave' },
  { zone: 'ember_plateau', anchor: 'lava_fields',  id: 'act2_mira_vision_paid',    x: 0.48, y: 0.78, name: 'Memory of Mira' },
  { zone: 'ember_plateau', anchor: 'obsidian_vein', id: 'act2_forgemaster',        x: 0.38, y: 0.30, name: 'Ashen Forge-Master' },
  // Act 3 — hell_breach / shattered_core
  { zone: 'hell_breach',  anchor: 'breach_gate',   id: 'act3_shade_warning',       x: 0.18, y: 0.28, name: 'Faded Shade' },
  { zone: 'hell_breach',  anchor: 'fell_ruins',    id: 'act3_demon_recognises',    x: 0.30, y: 0.70, name: 'Chained Imp' },
  { zone: 'hell_breach',  anchor: 'void_altar',    id: 'act3_veil_sight_bleed',    x: 0.82, y: 0.32, name: 'Inner Voice' },
  { zone: 'hell_breach',  anchor: 'bone_pit',      id: 'act3_blackmarket_fence',   x: 0.44, y: 0.82, name: 'Black-Market Fence' },
  { zone: 'hell_breach',  anchor: 'demon_patrol',  id: 'act3_hellhound_track',     x: 0.24, y: 0.18, name: 'Garrison Sergeant' },
  { zone: 'shattered_core', anchor: 'memory_crypt', id: 'act3_apprentice_danger',  x: 0.42, y: 0.14, name: 'Former Apprentice' },
  { zone: 'shattered_core', anchor: 'the_wound',   id: 'act3_malgrath_forge',      x: 0.86, y: 0.32, name: 'Hellfire Forge' },
  { zone: 'shattered_core', anchor: 'shard_fortress', id: 'act3_garrison_reward',  x: 0.50, y: 0.82, name: 'Garrison Commander' },
  // Act 4 — cosmic_rift / eternal_void
  { zone: 'cosmic_rift',  anchor: 'star_tomb',     id: 'act4_void_contact',        x: 0.44, y: 0.14, name: 'The Watcher' },
  { zone: 'cosmic_rift',  anchor: 'void_expanse',  id: 'act4_void_pact',           x: 0.28, y: 0.62, name: 'Void Entity' },
  { zone: 'eternal_void', anchor: 'forgotten_altar', id: 'act4_watcher_memory',   x: 0.44, y: 0.14, name: 'Memory Fragment' },
  { zone: 'cosmic_rift',  anchor: 'collapse_rift', id: 'act4_temporal_rift',       x: 0.68, y: 0.10, name: 'Temporal Rift' },
  { zone: 'eternal_void', anchor: 'oblivion_cache', id: 'act4_pact_price',         x: 0.62, y: 0.82, name: 'Void Entity' },
  { zone: 'eternal_void', anchor: 'rift_spiral',   id: 'act4_star_prophet',        x: 0.68, y: 0.10, name: 'Dying Star-Prophet' },
  { zone: 'cosmic_rift',  anchor: 'titan_pit',     id: 'act4_veil_convergence',    x: 0.82, y: 0.72, name: 'Veil Analyst' },
  { zone: 'eternal_void', anchor: 'oblivion_warden', id: 'act4_grave_gratitude',   x: 0.44, y: 0.84, name: 'Former Revenant' },
  // Act 5 — abyssal_depths / primordial_nexus
  { zone: 'abyssal_depths', anchor: 'memory_pool', id: 'act5_deliver_message',     x: 0.26, y: 0.62, name: 'Abyssal Archivist' },
  { zone: 'abyssal_depths', anchor: 'drowned_halls', id: 'act5_name_leverage',     x: 0.26, y: 0.12, name: 'The Unraveler\'s Echo' },
  { zone: 'abyssal_depths', anchor: 'abyssal_archive', id: 'act5_veil_door',       x: 0.70, y: 0.14, name: 'Ancient Inscription' },
  { zone: 'abyssal_depths', anchor: 'nexus_core',  id: 'act5_oracle_pool',         x: 0.56, y: 0.50, name: 'Pool of Memories (Deep)' },
  { zone: 'primordial_nexus', anchor: 'unmade_gallery', id: 'act5_analysis_weapon', x: 0.42, y: 0.10, name: 'Abyssal Researcher' },
  { zone: 'primordial_nexus', anchor: 'primal_vein', id: 'act5_forge_sings',       x: 0.68, y: 0.06, name: 'The Forged Weapon' },
  { zone: 'primordial_nexus', anchor: 'architect_bridge', id: 'act5_architect_pause', x: 0.56, y: 0.50, name: 'The Architect' },
  { zone: 'primordial_nexus', anchor: 'echo_chamber', id: 'act5_final_convergence', x: 0.26, y: 0.62, name: 'Abyssal Archivist' },
];

function _injectDialogBranchNodes() {
  const allActZones = [...ACT1_ZONES, ...ACT2_ZONES, ...ACT3_ZONES, ...ACT4_ZONES, ...ACT5_ZONES, ...ACT6_ZONES];
  for (const dn of M304_DIALOG_NODES) {
    const zone = allActZones.find(z => z.id === dn.zone);
    if (!zone) continue;
    const anchor = zone.nodes.find(n => n.id === dn.anchor);
    if (!anchor) continue;
    if (zone.nodes.some(n => n.id === dn.id)) continue;
    const newNode = {
      id: dn.id,
      type: NODE_TYPES.DIALOG,
      name: dn.name,
      x: dn.x,
      y: dn.y,
      exits: [],
    };
    anchor.exits = [...(anchor.exits || []), newNode.id];
    zone.nodes.push(newNode);
  }
}
_injectDialogBranchNodes();

// Now run the FTL grid layout — sees dungeons, hidden bosses, AND dialog
// branches, so they all share the same one-off placement rules.
for (const arr of [ACT1_ZONES, ACT2_ZONES, ACT3_ZONES, ACT4_ZONES, ACT5_ZONES, ACT6_ZONES]) {
  for (const z of arr) _layoutZoneToFTLGrid(z);
}

// M440: detangle pass deleted. The M440 layout snaps every node to a
// staggered grid cell whose row indices in adjacent columns differ by
// at most 1, which already guarantees no edge can cross another and no
// node sits on top of an unrelated edge. Running the M406 detangle on
// top of the grid was the only thing that re-broke the layout (the
// nudge moved authored nodes off-grid into stale positions).
