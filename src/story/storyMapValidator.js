/**
 * storyMapValidator.js — 6 map-graph validators for Story Mode (M-S05).
 *
 * Each function returns { ok: boolean, reason?: string, ...extraFields }.
 * None of them mutate the graph.
 *
 * Validators per §6.4 of 3-refined-plan.md:
 *  1. validateGraphConnectivity    — every node reachable from entry (open edges only).
 *  2. validateQuestCriticalReachability — quest_critical-tagged nodes all reachable.
 *  3. validateBossReachability     — boss node reachable from entry.
 *  4. validateSubRegionStitch      — each interior sub-region has >=1 in + >=1 out edge.
 *  5. validateWaypointCoverage     — every sub-region has >=1 waypoint node.
 *  6. validateHiddenPathSatisfiability — every lockId on a hidden edge has a
 *     satisfying reveal_path effect somewhere in a dialog pool node, a quest
 *     line onComplete, or a quest line outcome.effects.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** DFS over open (non-hidden, non-blocked) edges from a start node. */
function _dfsOpen(graph, startId) {
  const visited = new Set();
  const stack   = [startId];
  const openKinds = new Set(['open', 'revealed']); // both count as traversable

  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);

    const outEdges = graph.indexes?.outgoing?.[id] || [];
    for (const edge of outEdges) {
      if (openKinds.has(edge.kind) && !visited.has(edge.to)) {
        stack.push(edge.to);
      }
    }
  }
  return visited;
}

/** Return nodeIds reachable from entry (open edges only). */
function _reachableFromEntry(graph) {
  return _dfsOpen(graph, graph.entryNodeId);
}

// ---------------------------------------------------------------------------
// Validator 1 — Graph connectivity
// ---------------------------------------------------------------------------

/**
 * Every node must be reachable from the entry node traversing open edges.
 *
 * @param {object} graph
 * @returns {{ ok: boolean, reason?: string, unreachableIds?: string[] }}
 */
export function validateGraphConnectivity(graph) {
  const reachable = _reachableFromEntry(graph);
  const all = Object.keys(graph.nodes || {});
  const unreachableIds = all.filter(id => !reachable.has(id));

  if (unreachableIds.length) {
    return {
      ok: false,
      reason: `${unreachableIds.length} node(s) unreachable from entry`,
      unreachableIds,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validator 2 — Quest-critical reachability
// ---------------------------------------------------------------------------

/**
 * Every node tagged 'quest_critical' must be reachable from entry.
 * If no quests are provided (early milestones), passes trivially.
 *
 * @param {object} graph
 * @param {Array}  quests  - array of quest objects; may be empty.
 * @returns {{ ok: boolean, unreachableIds?: string[] }}
 */
export function validateQuestCriticalReachability(graph, quests = []) {
  const criticalNodes = (graph.indexes?.byTag?.['quest_critical'] || []);
  if (!criticalNodes.length) return { ok: true };

  const reachable = _reachableFromEntry(graph);
  const unreachableIds = criticalNodes.filter(id => !reachable.has(id));

  if (unreachableIds.length) {
    return { ok: false, unreachableIds };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validator 3 — Boss reachability
// ---------------------------------------------------------------------------

/**
 * The boss node must be reachable from the entry node.
 *
 * @param {object} graph
 * @param {string} bossNodeId — node id of the boss
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateBossReachability(graph, bossNodeId) {
  if (!bossNodeId) {
    // No boss node specified — check for any node of type 'boss'.
    const bossIds = graph.indexes?.byType?.['boss'] || [];
    if (!bossIds.length) return { ok: true }; // No boss in this act = pass.
    bossNodeId = bossIds[0];
  }

  const reachable = _reachableFromEntry(graph);
  if (!reachable.has(bossNodeId)) {
    return { ok: false, reason: `Boss node '${bossNodeId}' not reachable from entry` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validator 4 — Sub-region stitch
// ---------------------------------------------------------------------------

/**
 * Each interior sub-region (not the first or last) must have at least one
 * incoming edge from its left neighbor and at least one outgoing edge to its
 * right neighbor.
 *
 * @param {object} graph
 * @returns {{ ok: boolean, reason?: string, problematicRegions?: string[] }}
 */
export function validateSubRegionStitch(graph) {
  const regions = graph.subRegions || [];
  if (regions.length < 2) return { ok: true };

  const problematic = [];

  for (let ri = 0; ri < regions.length; ri++) {
    const region = regions[ri];
    const regionNodeSet = new Set(region.nodeIds || []);

    if (ri > 0) {
      // Must have at least one incoming edge from previous region.
      const prevNodeSet = new Set((regions[ri - 1].nodeIds || []));
      const hasIncoming = (graph.edges || []).some(
        e => prevNodeSet.has(e.from) && regionNodeSet.has(e.to)
      );
      if (!hasIncoming) {
        problematic.push(`${region.id}:no-incoming`);
        continue;
      }
    }

    if (ri < regions.length - 1) {
      // Must have at least one outgoing edge to next region.
      const nextNodeSet = new Set((regions[ri + 1].nodeIds || []));
      const hasOutgoing = (graph.edges || []).some(
        e => regionNodeSet.has(e.from) && nextNodeSet.has(e.to)
      );
      if (!hasOutgoing) {
        problematic.push(`${region.id}:no-outgoing`);
      }
    }
  }

  if (problematic.length) {
    return {
      ok: false,
      reason: `Sub-region stitch failure: ${problematic.join(', ')}`,
      problematicRegions: problematic,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validator 5 — Waypoint coverage
// ---------------------------------------------------------------------------

/**
 * Every sub-region must contain at least one node tagged 'waypoint'.
 *
 * @param {object} graph
 * @returns {{ ok: boolean, missingRegions?: string[] }}
 */
export function validateWaypointCoverage(graph) {
  const regions = graph.subRegions || [];
  const byTag   = graph.indexes?.byTag || {};
  const waypointSet = new Set(byTag['waypoint'] || []);

  const missingRegions = [];
  for (const region of regions) {
    const hasWaypoint = (region.nodeIds || []).some(id => waypointSet.has(id));
    if (!hasWaypoint) missingRegions.push(region.id);
  }

  if (missingRegions.length) {
    return { ok: false, missingRegions };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validator 6 — Hidden path satisfiability
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper: collect all lockIds that are satisfied by reveal_path effects in the
// provided content (dialog pools + quest lines).
// ---------------------------------------------------------------------------

/**
 * Walk an array of effects objects and collect every lockId targeted by
 * a `reveal_path` effect. (The `lockId` on a `reveal_path` effect names the
 * lock that the path-reveal "satisfies" — i.e. after this dialog fires the
 * hidden edge becomes reachable.)
 *
 * @param {object[]} effects
 * @param {Set<string>} into
 */
function _collectRevealPathLockIds(effects, into) {
  if (!Array.isArray(effects)) return;
  for (const eff of effects) {
    if (eff?.type === 'reveal_path' && eff.lockId) {
      into.add(eff.lockId);
    }
  }
}

/**
 * Recursively walk a dialog-pool node tree collecting all reveal_path lockIds.
 * Handles choices[].effects and top-level effects arrays.
 *
 * @param {object} node
 * @param {Set<string>} into
 */
function _walkDialogNode(node, into) {
  _collectRevealPathLockIds(node.effects, into);
  for (const choice of (node.choices || [])) {
    _collectRevealPathLockIds(choice.effects, into);
    // Recurse into nested branches (e.g. choice.branches[].nodes[])
    for (const branch of (choice.branches || [])) {
      for (const child of (branch.nodes || [])) {
        _walkDialogNode(child, into);
      }
    }
  }
}

/**
 * Build the set of all lockIds that are satisfied across an array of dialog
 * pools (each pool is an array of dialog nodes) and an array of quest lines.
 *
 * @param {object[][]} dialogPools  - array of parsed dialogue-pool JSON arrays
 * @param {object[]}   questLines   - array of parsed quest-line JSON objects
 * @returns {Set<string>}
 */
export function collectSatisfiedLocks(dialogPools = [], questLines = []) {
  const satisfied = new Set();

  // Dialog pools
  for (const pool of dialogPools) {
    const nodes = Array.isArray(pool) ? pool : (pool.nodes || []);
    for (const node of nodes) {
      _walkDialogNode(node, satisfied);
    }
  }

  // Quest lines: onComplete effects + outcome.effects
  for (const ql of questLines) {
    _collectRevealPathLockIds(ql.onComplete, satisfied);
    for (const phase of Object.values(ql.phases || {})) {
      _collectRevealPathLockIds(phase.effects, satisfied);
      for (const outcome of (phase.outcomes || [])) {
        _collectRevealPathLockIds(outcome.effects, satisfied);
      }
    }
    for (const outcome of (ql.outcomes || [])) {
      _collectRevealPathLockIds(outcome.effects, satisfied);
    }
  }

  return satisfied;
}

/**
 * Every lockId on a hidden edge must be satisfied by a reveal_path effect
 * in at least one dialog pool node, quest line onComplete, or quest outcome.
 *
 * The legacy `lockPool` argument is still accepted for backward compatibility —
 * any lockId in the pool is also treated as satisfied (allows callers that
 * manage their own lock registry to still pass validation).
 *
 * @param {object}     graph
 * @param {Array}      quests       - quest objects; may be empty.
 * @param {string[]}   lockPool     - legacy per-act pool of valid lockIds.
 * @param {object[][]} dialogPools  - parsed dialogue-pool arrays (optional).
 * @param {object[]}   questLines   - parsed quest-line objects (optional).
 * @returns {{ ok: boolean, brokenLocks?: string[] }}
 */
export function validateHiddenPathSatisfiability(
  graph,
  quests = [],
  lockPool = [],
  dialogPools = [],
  questLines = []
) {
  // Build unified satisfied set: legacy pool + content-derived.
  const poolSet    = new Set(lockPool);
  const fromContent = collectSatisfiedLocks(dialogPools, questLines);
  const allSatisfied = new Set([...poolSet, ...fromContent]);

  const brokenLocks = [];

  for (const edge of (graph.edges || [])) {
    if (edge.kind === 'hidden' && edge.lockId && !allSatisfied.has(edge.lockId)) {
      brokenLocks.push(edge.lockId);
    }
  }

  if (brokenLocks.length) {
    return { ok: false, brokenLocks };
  }
  return { ok: true };
}
