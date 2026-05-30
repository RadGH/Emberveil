/**
 * storyMapGen.js — Procedural act-map generator for Story Mode (M-S05).
 *
 * Public API:
 *   generateAct({ seed, act, salt }) -> { mapGraph, attempts, fallbackUsed }
 *
 * Algorithm per §6.1 of 3-refined-plan.md:
 *   1. Pick 5 sub-region biomes from canonical-biomes.json weighted by act tags.
 *   2. For each sub-region, lay out a 3-lane FTL strip of 9-12 nodes.
 *   3. Generate intra-region cross-lane edges with p=0.6.
 *   4. Connect adjacent sub-regions via 1-3 stitching edges.
 *   5. Tag 8-15% of edges as hidden with authored lockIds.
 *   6. Tag 2-4 nodes per region as waypoints (1 guaranteed per region).
 *   7. Annotate each node with nodeType sampled from per-biome distribution.
 *   8. Run validators; retry with incremented salt up to 10 times.
 *      On attempt 11, return the hand-authored safety-net template.
 *
 * Uses mulberry32 from simulator.js (same PRNG everywhere — deterministic).
 * gs.story.* is a Set-free zone: no Sets, no Maps in persisted data.
 */

import { mulberry32 } from '../game/simulator.js';
import { buildIndexes, serializeMapSave } from './storyMapGraph.js';
import {
  validateGraphConnectivity,
  validateBossReachability,
  validateSubRegionStitch,
  validateWaypointCoverage,
  validateQuestCriticalReachability,
  validateHiddenPathSatisfiability,
} from './storyMapValidator.js';
import biomesRaw from '../../data/story/canonical-biomes.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Per-act quest-critical node tag → preferred node type mapping
// ---------------------------------------------------------------------------
const QUEST_NODE_REQUIREMENTS = {
  1: [
    // { phaseId, tag, preferredType } — we look for an existing node of preferredType
    // and pin it with the tag; if none found, mutateNode converts one.
    { phaseId: 'reach_brightfall',     tag: 'quest_brightfall',     preferredType: 'dialog' },
    { phaseId: 'investigate_burned_road', tag: 'quest_burned_road', preferredType: 'lore'   },
    { phaseId: 'discover_veil_fracture',  tag: 'quest_veil_fracture', preferredType: 'shrine' },
    { phaseId: 'enter_old_watchtower',    tag: 'quest_watchtower',   preferredType: 'event'  },
    { phaseId: 'defeat_or_bargain_guardian', tag: 'confront_guardian', preferredType: 'boss' },
  ],
  2: [
    { phaseId: 'enter_veilscar',          tag: 'quest_veilscar_entry', preferredType: 'dialog' },
    { phaseId: 'identify_herald_network', tag: 'quest_herald_network', preferredType: 'lore'   },
    { phaseId: 'confront_herald',         tag: 'confront_herald',      preferredType: 'boss'   },
  ],
  3: [
    { phaseId: 'navigate_architects_verge', tag: 'quest_architects_verge', preferredType: 'lore' },
    { phaseId: 'reach_sovereign_chamber',   tag: 'quest_sovereign_chamber', preferredType: 'event' },
    { phaseId: 'final_confrontation',       tag: 'confront_sovereign',       preferredType: 'boss'  },
  ],
};

// ---------------------------------------------------------------------------
// Act definitions — biome rosters per §6.2
// ---------------------------------------------------------------------------
const ACT_BIOME_ROSTER = {
  1: ['emberwood', 'stoneward', 'fen', 'old_road', 'gloomridge'],
  2: ['veilscar', 'plague_fen', 'ash_plains', 'library_ruins', 'crossroads'],
  3: ['riftgate', 'architects_verge', 'ember_hollow', 'sovereigns_approach'],
};

// Act-level lock pools — authored lockIds drawn for hidden edges.
const ACT_LOCK_POOLS = {
  1: ['lock_shrine_key', 'lock_merchant_bribe', 'lock_faction_favor', 'lock_quest_start', 'lock_companion_trust'],
  2: ['lock_plague_cure', 'lock_library_access', 'lock_veil_ward', 'lock_crossroads_toll', 'lock_ash_passage'],
  3: ['lock_rift_seal', 'lock_architect_glyph', 'lock_ember_brand', 'lock_sovereign_oath', 'lock_final_veil'],
};

// Node-count ranges per act per §6.2
const ACT_NODE_RANGE = {
  1: { min: 9, max: 12 },
  2: { min: 10, max: 13 },
  3: { min: 12, max: 15 },
};

// Hidden-edge count ranges per act per §6.2
const ACT_HIDDEN_RANGE = {
  1: { min: 5, max: 8 },
  2: { min: 6, max: 10 },
  3: { min: 4, max: 7 },
};

// Waypoint count ranges per act per §6.2
const ACT_WAYPOINT_RANGE = {
  1: { min: 2, max: 4 },
  2: { min: 2, max: 4 },
  3: { min: 2, max: 4 },
};

// Build biome lookup from JSON
const BIOME_MAP = {};
for (const b of biomesRaw) BIOME_MAP[b.id] = b;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Integer in [lo, hi] inclusive using the rng. */
function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Pick from array using rng. */
function randPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Weighted sample: distribution is { type: weight, ... }, weights sum to ~1. */
function weightedSample(rng, dist) {
  const entries = Object.entries(dist);
  let total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r <= 0) return type;
  }
  return entries[entries.length - 1][0];
}

/** Deterministic string hash -> uint32, used to seed from a string seed. */
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

/**
 * assignQuestNodes — pin quest-critical nodes by tag onto the generated graph.
 *
 * For each required (tag, preferredType) pair for the given act:
 *   1. Find an untagged node matching preferredType in the graph.
 *   2. If found, push the tag onto that node's tags array.
 *   3. If not found, mutate the first untagged non-boss node to the preferredType
 *      and push the tag (defensive fallback per plan §6.7).
 *
 * Operates in-place on graph.nodes. Returns the modified graph.
 *
 * @param {object} graph - the in-memory mapGraph from _buildGraph
 * @param {number} act - 1 | 2 | 3
 * @param {object} rng - mulberry32 RNG for deterministic candidate selection
 * @returns {object} graph (mutated in-place)
 */
export function assignQuestNodes(graph, act, rng) {
  const reqs = QUEST_NODE_REQUIREMENTS[act] || [];
  const nodeEntries = Object.entries(graph.nodes);

  for (const req of reqs) {
    const { tag, preferredType } = req;

    // Already tagged? Skip.
    const alreadyTagged = nodeEntries.some(([, n]) => n.tags.includes(tag));
    if (alreadyTagged) continue;

    // Find candidates: not already quest-tagged, matching preferredType.
    const candidates = nodeEntries.filter(([, n]) =>
      n.type === preferredType && !n.tags.includes('quest_critical')
    );

    if (candidates.length > 0) {
      // Pick deterministically from candidates.
      const [, chosen] = candidates[Math.floor(rng() * candidates.length)];
      chosen.tags.push(tag);
      chosen.tags.push('quest_critical');
    } else {
      // Fallback: mutate any non-boss, non-tagged node and assign.
      const fallbackCandidates = nodeEntries.filter(([, n]) =>
        n.type !== 'boss' && !n.tags.includes('quest_critical')
      );
      if (fallbackCandidates.length > 0) {
        const [, fallback] = fallbackCandidates[Math.floor(rng() * fallbackCandidates.length)];
        // Mutate type to match quest expectation (per plan §6.7 mutateNode API)
        fallback.type = preferredType;
        fallback.tags.push(tag);
        fallback.tags.push('quest_critical');
      }
    }
  }

  return graph;
}

/**
 * generateAct — main entry point.
 *
 * @param {{ seed: string|number, act: 1|2|3, salt?: number }} opts
 * @returns {{ mapGraph: object, attempts: number, fallbackUsed: boolean }}
 */
export function generateAct({ seed, act = 1, salt = 0 }) {
  const MAX_ATTEMPTS = 10;
  const lockPool = ACT_LOCK_POOLS[act] || ACT_LOCK_POOLS[1];

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    const actualSalt = salt + attempt;
    const seedNum = typeof seed === 'number'
      ? ((seed ^ actualSalt) >>> 0)
      : (hashSeed(String(seed) + ':' + actualSalt) >>> 0);

    try {
      const graph = _buildGraph(seedNum, act, lockPool);
      const bossNodeId = _findBossNode(graph);

      // Run all 6 validators.
      const v1 = validateGraphConnectivity(graph);
      const v2 = validateQuestCriticalReachability(graph, []);
      const v3 = validateBossReachability(graph, bossNodeId);
      const v4 = validateSubRegionStitch(graph);
      const v5 = validateWaypointCoverage(graph);
      const v6 = validateHiddenPathSatisfiability(graph, [], lockPool);

      if (v1.ok && v2.ok && v3.ok && v4.ok && v5.ok && v6.ok) {
        // Assign quest-critical node tags after validation succeeds.
        // Pass a derived RNG so assignment is deterministic but doesn't consume
        // from the main graph-build RNG (which is already consumed by this point).
        const questRng = mulberry32((seedNum ^ 0xC0DE1337) >>> 0);
        assignQuestNodes(graph, act, questRng);
        return { mapGraph: graph, attempts: attempt + 1, fallbackUsed: false };
      }
    } catch (_err) {
      // Generation threw — treat as validation failure and retry.
    }
  }

  // All 10 attempts failed — use safety-net template.
  const fallback = _loadFallback(act);
  return { mapGraph: fallback, attempts: MAX_ATTEMPTS + 1, fallbackUsed: true };
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

function _buildGraph(seedNum, act, lockPool) {
  const rng = mulberry32(seedNum);
  const biomeRoster = ACT_BIOME_ROSTER[act] || ACT_BIOME_ROSTER[1];
  const nodeRange = ACT_NODE_RANGE[act] || ACT_NODE_RANGE[1];
  const hiddenRange = ACT_HIDDEN_RANGE[act] || ACT_HIDDEN_RANGE[1];
  const waypointRange = ACT_WAYPOINT_RANGE[act] || ACT_WAYPOINT_RANGE[1];

  const mapId = `act${act}_map_${seedNum}`;

  const subRegions = [];
  const nodes = {};
  const edges = [];

  // Step 1: build each sub-region as a 3-lane FTL strip.
  for (let ri = 0; ri < biomeRoster.length; ri++) {
    const biomeId = biomeRoster[ri];
    const biome = BIOME_MAP[biomeId] || { id: biomeId, name: biomeId, nodeDistribution: {} };
    const dist = biome.nodeDistribution || {};
    const regionId = biomeId;

    const nodeCount = randInt(rng, nodeRange.min, nodeRange.max);
    // Organize into columns; FTL-style 3 lanes.
    const LANES = 3;
    const cols = Math.ceil(nodeCount / LANES);
    const nodeIds = [];

    // Assign each node to a lane and column.
    for (let i = 0; i < nodeCount; i++) {
      const col = Math.floor(i / LANES);
      const lane = i % LANES;
      const nodeId = `a${act}_r${ri}_c${col}_l${lane}`;
      const isLastRegion = ri === biomeRoster.length - 1;
      const isLastCol = col === cols - 1;
      const isBoss = isLastRegion && isLastCol && lane === 1; // Boss at last region, last col, middle lane.
      const type = isBoss ? 'boss' : weightedSample(rng, dist);

      nodes[nodeId] = {
        id: nodeId,
        biome: biomeId,
        regionId,
        lane,
        col,
        type,
        tags: [],
        baseWeight: 1.0,
      };
      nodeIds.push(nodeId);
    }

    subRegions.push({
      id: regionId,
      name: biome.name || biomeId,
      biome: biomeId,
      nodeIds,
      xOffset: ri,
    });

    // Step 2a: connect entry column (col 0) — all 3 lanes must be reachable.
    // We do this by connecting the first-column nodes to each other so the
    // DFS from entry can reach all lanes before the first forward column.
    if (cols > 0) {
      const col0Nodes = nodeIds.filter(id => nodes[id].col === 0);
      // Fan-out from lane 0 -> lane 1, lane 1 -> lane 2.
      for (let lane = 0; lane < LANES - 1; lane++) {
        const fromId = col0Nodes.find(id => nodes[id].lane === lane);
        const toId   = col0Nodes.find(id => nodes[id].lane === lane + 1);
        if (fromId && toId) {
          const key = `e_${fromId}_${toId}`;
          if (!edges.find(e => e.id === key)) {
            edges.push({ id: key, from: fromId, to: toId, kind: 'open' });
          }
        }
      }
    }

    // Step 2b: intra-region edges — same-lane forward + cross-lane with p=0.6.
    for (let col = 0; col < cols - 1; col++) {
      const colNodes     = nodeIds.filter(id => nodes[id].col === col);
      const nextColNodes = nodeIds.filter(id => nodes[id].col === col + 1);

      // Ensure next col is also internally connected (fan-out within next col).
      for (let lane = 0; lane < LANES - 1; lane++) {
        const fromId = nextColNodes.find(id => nodes[id].lane === lane);
        const toId   = nextColNodes.find(id => nodes[id].lane === lane + 1);
        if (fromId && toId) {
          const key = `e_${fromId}_${toId}`;
          if (!edges.find(e => e.id === key)) {
            edges.push({ id: key, from: fromId, to: toId, kind: 'open' });
          }
        }
      }

      // Main lane progression: each lane continues to the same lane next col.
      for (let lane = 0; lane < LANES; lane++) {
        const fromId = colNodes.find(id => nodes[id].lane === lane);
        const toId   = nextColNodes.find(id => nodes[id].lane === lane);
        if (fromId && toId) {
          const key = `e_${fromId}_${toId}`;
          if (!edges.find(e => e.id === key)) {
            edges.push({ id: key, from: fromId, to: toId, kind: 'open' });
          }
        }
      }

      // Cross-lane edges with p=0.6.
      for (let lane = 0; lane < LANES; lane++) {
        const targetLane = (lane + 1) % LANES;
        const fromId = colNodes.find(id => nodes[id].lane === lane);
        const toId   = nextColNodes.find(id => nodes[id].lane === targetLane);
        if (fromId && toId && rng() < 0.6) {
          const key = `e_${fromId}_${toId}`;
          if (!edges.find(e => e.id === key)) {
            edges.push({ id: key, from: fromId, to: toId, kind: 'open' });
          }
        }
      }
    }
  }

  // Step 3: region-to-region stitching edges (1-3 per boundary).
  for (let ri = 0; ri < subRegions.length - 1; ri++) {
    const regionA = subRegions[ri];
    const regionB = subRegions[ri + 1];

    // Rightmost col of A -> leftmost col of B.
    const maxColA = Math.max(...regionA.nodeIds.map(id => nodes[id].col));
    const minColB = Math.min(...regionB.nodeIds.map(id => nodes[id].col));
    const rightNodes = regionA.nodeIds.filter(id => nodes[id].col === maxColA);
    const leftNodes  = regionB.nodeIds.filter(id => nodes[id].col === minColB);

    const stitchCount = randInt(rng, 1, 3);
    let stitched = 0;
    for (let si = 0; si < rightNodes.length && stitched < stitchCount; si++) {
      const fromId = rightNodes[si];
      const toId = leftNodes[si % leftNodes.length];
      const key = `e_stitch_${fromId}_${toId}`;
      edges.push({ id: key, from: fromId, to: toId, kind: 'open' });
      stitched++;
    }
  }

  // Step 4: tag 8-15% of edges as hidden with lock IDs.
  const targetHidden = randInt(rng, hiddenRange.min, hiddenRange.max);
  let hiddenTagged = 0;
  const shuffleable = edges.filter(e => e.kind === 'open' && !e.id.startsWith('e_stitch'));
  for (let i = shuffleable.length - 1; i > 0 && hiddenTagged < targetHidden; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffleable[i], shuffleable[j]] = [shuffleable[j], shuffleable[i]];
    const edge = edges.find(e => e.id === shuffleable[i].id);
    if (edge && hiddenTagged < targetHidden) {
      edge.kind = 'hidden';
      edge.lockId = lockPool[hiddenTagged % lockPool.length];
      hiddenTagged++;
    }
  }

  // Step 5: Guarantee a town node in the first sub-region (fix #6).
  // Convert a non-boss, non-entry node in the first region to 'town'.
  const firstRegionTown = subRegions[0];
  if (firstRegionTown) {
    const townCandidates = firstRegionTown.nodeIds.filter(id =>
      nodes[id]?.type !== 'boss' && nodes[id]?.type !== 'trailhead'
    );
    // Pick mid-way through the region for the town.
    const townIdx = Math.max(0, Math.floor(townCandidates.length / 2));
    const townId = townCandidates[townIdx];
    if (townId && nodes[townId]) {
      nodes[townId].type = 'town';
      nodes[townId].tags.push('waypoint', 'town');
    }
  }

  // Also ensure subsequent regions (≥2) have at least one town on higher acts.
  if (act >= 2) {
    for (let ri = 1; ri < subRegions.length - 1; ri++) {
      const region = subRegions[ri];
      const hasTown = region.nodeIds.some(id => nodes[id]?.type === 'town');
      if (!hasTown) {
        const mid = Math.floor(region.nodeIds.length / 2);
        const candidate = region.nodeIds[mid];
        if (candidate && nodes[candidate] && nodes[candidate].type !== 'boss') {
          nodes[candidate].type = 'town';
          nodes[candidate].tags.push('waypoint', 'town');
        }
      }
    }
  }

  // Step 5b: tag waypoints (2-4 per region, 1 guaranteed).
  for (const region of subRegions) {
    const waypointCount = randInt(rng, waypointRange.min, waypointRange.max);
    const candidates = [...region.nodeIds].filter(id => nodes[id].type !== 'boss' && nodes[id].type !== 'trailhead');
    // Guaranteed first waypoint.
    if (candidates.length) {
      const firstIdx = Math.floor(rng() * candidates.length);
      if (!nodes[candidates[firstIdx]].tags.includes('waypoint')) {
        nodes[candidates[firstIdx]].tags.push('waypoint');
      }
    }
    // Additional waypoints.
    let added = 1;
    for (let i = 0; i < candidates.length && added < waypointCount; i++) {
      const id = candidates[Math.floor(rng() * candidates.length)];
      if (!nodes[id].tags.includes('waypoint')) {
        nodes[id].tags.push('waypoint');
        added++;
      }
    }
  }

  // Inject a trailhead node at the very start of the first sub-region (fix #5).
  // The trailhead is a no-op waypoint: tapping it shows the map name + Continue.
  const trailheadId = `a${act}_trailhead`;
  const firstRegion = subRegions[0];
  const entryNodeId = firstRegion?.nodeIds[0] || Object.keys(nodes)[0];
  nodes[trailheadId] = {
    id:           trailheadId,
    biome:        firstRegion?.biome || 'emberwood',
    regionId:     firstRegion?.id || 'emberwood',
    lane:         1,          // middle lane — centered
    col:          -1,         // left of col 0
    type:         'trailhead',
    tags:         ['waypoint'],
    baseWeight:   1.0,
    waypoint:     true,
    waypointState: 'activated', // pre-activated on map enter
  };
  // Inject edge: trailhead -> original entry node.
  edges.unshift({ id: `e_trailhead_${entryNodeId}`, from: trailheadId, to: entryNodeId, kind: 'open' });
  // Prepend trailhead to first sub-region's nodeIds.
  firstRegion?.nodeIds.unshift(trailheadId);

  const graph = {
    mapId,
    act,
    seed: seedNum,
    entryNodeId: trailheadId, // start at trailhead
    subRegions,
    nodes,
    edges,
    indexes: null, // populated by buildIndexes()
  };

  graph.indexes = buildIndexes(graph);
  return graph;
}

function _findBossNode(graph) {
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type === 'boss') return id;
  }
  // Fallback: last node overall.
  const ids = Object.keys(graph.nodes);
  return ids[ids.length - 1];
}

// ---------------------------------------------------------------------------
// Safety-net fallback loader
// ---------------------------------------------------------------------------

let _fallbackCache = {};

function _loadFallback(act) {
  if (_fallbackCache[act]) return _fallbackCache[act];

  // Attempt dynamic import — in vitest/node the JSON will be resolved.
  // In browser, Vite resolves the ?url imports; here we use a static fallback
  // since we can't do synchronous dynamic import.
  // The static fallbacks are hand-authored minimal graphs.
  const graph = _buildMinimalFallback(act);
  _fallbackCache[act] = graph;
  return graph;
}

/** Build a minimal valid graph from the safety-net JSON data embedded here.
 *  Full JSON files live at data/story/safety-net-acts/act{N}.json and are
 *  loaded by the test suite; here we construct the same shape programmatically
 *  so the fallback works in the browser without an async fetch. */
function _buildMinimalFallback(act) {
  const roster = ACT_BIOME_ROSTER[act] || ACT_BIOME_ROSTER[1];
  const nodes = {};
  const edges = [];
  const subRegions = [];

  // 6 nodes per region, 2 columns × 3 lanes.
  for (let ri = 0; ri < roster.length; ri++) {
    const biomeId = roster[ri];
    const biome = BIOME_MAP[biomeId] || { id: biomeId, name: biomeId };
    const nodeIds = [];
    for (let col = 0; col < 2; col++) {
      for (let lane = 0; lane < 3; lane++) {
        const id = `fb_a${act}_r${ri}_c${col}_l${lane}`;
        const isBoss = ri === roster.length - 1 && col === 1 && lane === 1;
        nodes[id] = {
          id, biome: biomeId, regionId: biomeId, lane, col,
          type: isBoss ? 'boss' : (col === 0 ? 'combat' : 'rest'),
          tags: (col === 0 && lane === 1) ? ['waypoint'] : [],
          baseWeight: 1.0,
        };
        nodeIds.push(id);
      }
    }
    // Simple edges: col0 -> col1 per lane, plus two cross-lane.
    for (let lane = 0; lane < 3; lane++) {
      const from = `fb_a${act}_r${ri}_c0_l${lane}`;
      const to   = `fb_a${act}_r${ri}_c1_l${lane}`;
      edges.push({ id: `efs_${from}_${to}`, from, to, kind: 'open' });
    }
    // One cross-lane.
    edges.push({ id: `efx_a${act}_r${ri}_x`, from: `fb_a${act}_r${ri}_c0_l0`, to: `fb_a${act}_r${ri}_c1_l1`, kind: 'open' });
    // Stitch to next region.
    if (ri < roster.length - 1) {
      edges.push({ id: `efst_a${act}_r${ri}_r${ri+1}`, from: `fb_a${act}_r${ri}_c1_l1`, to: `fb_a${act}_r${ri+1}_c0_l1`, kind: 'open' });
    }

    subRegions.push({ id: biomeId, name: biome.name || biomeId, biome: biomeId, nodeIds, xOffset: ri });
  }

  const graph = {
    mapId: `act${act}_fallback`,
    act,
    seed: 0,
    entryNodeId: subRegions[0].nodeIds[0],
    subRegions,
    nodes,
    edges,
    indexes: null,
  };
  graph.indexes = buildIndexes(graph);
  return graph;
}
