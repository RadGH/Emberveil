/**
 * storyMapGraph.js — Pure graph index helpers + save serialization (M-S05).
 *
 * No mutation. All functions are pure transforms.
 *
 * Exports:
 *   buildIndexes(graph)           -> graph.indexes (byBiome/byTag/byType/outgoing/incoming)
 *   serializeMapSave(graph)       -> MapSave (JSON-safe, for gs.story.maps[mapId])
 *   hydrateMapSave(graph, save)   -> graph with node states merged from save
 *
 * Data shapes per §6.3 of 3-refined-plan.md.
 *
 * IMPORTANT: gs.story.* is a Set-free zone. Indexes here use plain objects
 * (Record<key, array>) instead of Maps so callers can safely JSON.stringify.
 * The `indexes` field on the in-memory graph object uses plain objects as well.
 */

// ---------------------------------------------------------------------------
// buildIndexes — produces lookup tables for fast querying in the draw loop.
// Plain objects (not Map) to keep everything JSON-round-trippable.
// ---------------------------------------------------------------------------

/**
 * @param {object} graph - mapGraph with nodes[] and edges[].
 * @returns {object} indexes: { byBiome, byTag, byType, outgoing, incoming }
 *   Each is a plain Record<string, string[]|Edge[]>.
 */
export function buildIndexes(graph) {
  const byBiome   = {};  // biomeId -> nodeId[]
  const byTag     = {};  // tag     -> nodeId[]
  const byType    = {};  // type    -> nodeId[]
  const outgoing  = {};  // fromId  -> edge[]
  const incoming  = {};  // toId    -> edge[]

  for (const [id, node] of Object.entries(graph.nodes || {})) {
    // byBiome
    if (!byBiome[node.biome]) byBiome[node.biome] = [];
    byBiome[node.biome].push(id);

    // byType
    const t = node.type || 'unknown';
    if (!byType[t]) byType[t] = [];
    byType[t].push(id);

    // byTag
    for (const tag of (node.tags || [])) {
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push(id);
    }

    // Init adjacency lists.
    if (!outgoing[id]) outgoing[id] = [];
    if (!incoming[id]) incoming[id] = [];
  }

  for (const edge of (graph.edges || [])) {
    if (!outgoing[edge.from]) outgoing[edge.from] = [];
    outgoing[edge.from].push(edge);

    if (!incoming[edge.to]) incoming[edge.to] = [];
    incoming[edge.to].push(edge);
  }

  return { byBiome, byTag, byType, outgoing, incoming };
}

// ---------------------------------------------------------------------------
// serializeMapSave — distill the in-memory graph into the persisted shape.
// The persisted MapSave is intentionally minimal: only what can change at
// runtime is stored. Static structure (node biome, col, lane, type) is
// re-derived from generation on load.
// ---------------------------------------------------------------------------

/**
 * @param {object} graph - fully-built mapGraph (with indexes).
 * @returns {object} MapSave — JSON-safe, stored in gs.story.maps[mapId].
 */
export function serializeMapSave(graph) {
  // Node states: default all to 'unexplored' (discovered/activated by mutations).
  const nodeStates = {};
  for (const id of Object.keys(graph.nodes || {})) {
    const node = graph.nodes[id];
    nodeStates[id] = {
      state:              'unexplored',   // 'unexplored'|'visited'|'cleared'
      visibility:         'hidden',       // 'hidden'|'visible'|'revealed'
      waypointState:      node.tags?.includes('waypoint') ? 'unexplored' : null,
      assignedEncounterId: null,
    };
  }

  // Edge list: minimal subset needed for mutation tracking.
  const edgeList = (graph.edges || []).map(e => ({
    from: e.from,
    to:   e.to,
    kind: e.kind,
    ...(e.lockId ? { lockId: e.lockId } : {}),
  }));

  // Entry node starts as visible.
  if (graph.entryNodeId && nodeStates[graph.entryNodeId]) {
    nodeStates[graph.entryNodeId].visibility = 'visible';
    nodeStates[graph.entryNodeId].state = 'discovered';
  }

  return {
    mapId:          graph.mapId,
    act:            graph.act,
    seed:           graph.seed,
    subRegions:     (graph.subRegions || []).map(r => r.id),
    nodes:          nodeStates,
    edges:          edgeList,
    revealedPaths:  [],
    regionWeather:  {},
    nodeOverlays:   {},
  };
}

// ---------------------------------------------------------------------------
// hydrateMapSave — merge a MapSave back into a freshly-generated graph.
// The generator re-runs (deterministic), then we overlay the saved state.
// This is needed because the in-memory graph holds non-persisted fields like
// col, lane, biome, type, baseWeight — these are always re-derived.
// ---------------------------------------------------------------------------

/**
 * @param {object} graph  - fresh graph from generateAct (with static fields).
 * @param {object} save   - MapSave from gs.story.maps[mapId].
 * @returns {object}      - graph with .nodeSave and edge kinds mutated from save.
 */
export function hydrateMapSave(graph, save) {
  if (!save) return graph;

  // Overlay node states from the save.
  graph.nodeSave = save.nodes || {};

  // Apply saved edge kinds (reveal/block mutations persist here).
  if (Array.isArray(save.edges)) {
    for (const savedEdge of save.edges) {
      const live = graph.edges.find(e => e.from === savedEdge.from && e.to === savedEdge.to);
      if (live) live.kind = savedEdge.kind;
    }
  }

  // Carry over node overlays.
  graph.nodeOverlays = save.nodeOverlays || {};

  // Rebuild indexes after edge mutation.
  graph.indexes = buildIndexes(graph);

  return graph;
}

// ---------------------------------------------------------------------------
// computeNodeVisibility — derive per-node visibility from save state.
//
// Rules (§6.3 / Bug 2 spec):
//   visited  - player has been at this node (state='visited'|'cleared')
//   visible  - reachable via open edges from a visited/entry node in same region
//   revealed - reachable only via hidden edges whose lockId is in revealedPaths
//   hidden   - everything else (don't draw)
//
// Returns a Map<nodeId, 'visible'|'hidden'|'revealed'|'visited'>.
// ---------------------------------------------------------------------------

/**
 * @param {object} graph   - hydrated mapGraph (with .nodeSave and .indexes)
 * @param {object} save    - MapSave from gs.story.maps[mapId] (has revealedPaths)
 * @returns {Map<string, 'visible'|'hidden'|'revealed'|'visited'>}
 */
export function computeNodeVisibility(graph, save) {
  const nodeSave      = graph.nodeSave || save?.nodes || {};
  const revealedPaths = new Set(save?.revealedPaths || []);
  const outgoing      = graph.indexes?.outgoing || {};

  const result = new Map();

  // Seed: entry node is always visible.
  const entryId = graph.entryNodeId;

  // BFS queue.
  const queue = [];

  // Initialise all as hidden.
  for (const id of Object.keys(graph.nodes || {})) {
    result.set(id, 'hidden');
  }

  // Seed from nodes that are already visited / the entry node.
  for (const [id, ns] of Object.entries(nodeSave)) {
    const state = ns.state || 'unexplored';
    if (state === 'visited' || state === 'cleared') {
      result.set(id, 'visited');
      queue.push({ id, via: 'open' });
    }
  }
  if (entryId && !queue.find(q => q.id === entryId)) {
    // Entry is at minimum visible if not visited.
    if (result.get(entryId) !== 'visited') result.set(entryId, 'visible');
    queue.push({ id: entryId, via: 'open' });
  }

  // BFS: propagate visibility through edges.
  const seen = new Set(queue.map(q => q.id));
  let head = 0;
  while (head < queue.length) {
    const { id } = queue[head++];
    const edges = outgoing[id] || [];

    for (const edge of edges) {
      const toId = edge.to;
      if (!graph.nodes[toId]) continue;

      const toNs  = nodeSave[toId] || {};
      const toState = toNs.state || 'unexplored';

      if (toState === 'visited' || toState === 'cleared') {
        // Already marked as visited above; propagate further from it.
        if (!seen.has(toId)) {
          seen.add(toId);
          queue.push({ id: toId, via: 'open' });
        }
        continue;
      }

      if (edge.kind === 'open') {
        // Open edge → destination becomes visible (if not already better).
        const cur = result.get(toId);
        if (cur === 'hidden' || cur === 'revealed') {
          result.set(toId, 'visible');
        }
        if (!seen.has(toId)) {
          seen.add(toId);
          queue.push({ id: toId, via: 'open' });
        }
      } else if (edge.kind === 'hidden' || edge.kind === 'blocked') {
        // Hidden/locked edge → destination is 'revealed' if lockId satisfied, else stays hidden.
        const unlocked = !edge.lockId || revealedPaths.has(edge.lockId);
        if (unlocked) {
          const cur = result.get(toId);
          if (cur === 'hidden') {
            result.set(toId, 'revealed');
          }
          // Don't propagate further from a revealed node (only open paths spread visibility).
        }
      }
      // 'blocked' edges that are not unlocked: stay hidden.
    }
  }

  return result;
}
