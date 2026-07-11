/**
 * storyMapMutations.js — Path + node mutation API for Story Mode (M-S07).
 *
 * All mutations operate on gs.story.maps[gs.story.currentMapId] (MapSave)
 * and persist immediately — callers must invoke SaveManager.saveCurrentGame()
 * after a batch of mutations if they want the change durable.
 *
 * Exact API per §6.7 of 3-refined-plan.md:
 *   revealPath(gs, fromId, toId)          -> boolean
 *   blockPath(gs, fromId, toId)           -> boolean
 *   revealNodesByTag(gs, tag, count)      -> string[]
 *   mutateNode(gs, nodeId, overlay)       -> void
 *   unlockTransition(gs, targetMapId)     -> void
 *   setWaypointState(gs, nodeId, state)   -> void
 *   applyWorldMutation(gs, mutationId)    -> void
 *
 * Waypoint state machine per §6.6:
 *   unexplored -> discovered -> activated -> corrupted -> disabled
 *   corrupted  -> activated   (purify_waypoint)
 *   *          -> disabled    (world-mutation only)
 *
 * gs.story.* is a Set-free zone (no Set/Map — plain arrays + objects only).
 */

import { setUniquePush } from './storyLedger.js';

// ---------------------------------------------------------------------------
// Legal waypoint state transitions
// ---------------------------------------------------------------------------
const WAYPOINT_TRANSITIONS = {
  unexplored: ['discovered'],
  discovered: ['activated'],
  activated:  ['corrupted', 'disabled'],
  corrupted:  ['activated', 'disabled'],
  disabled:   [], // terminal
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Get the live MapSave for the current map from gs.story. */
function _currentSave(gs) {
  const mapId = gs.story?.currentMapId;
  if (!mapId) return null;
  return gs.story.maps?.[mapId] || null;
}

/** Find an edge in the MapSave edge list matching from/to. */
function _findEdge(save, fromId, toId) {
  return (save.edges || []).find(e => e.from === fromId && e.to === toId) || null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Flip a hidden edge to 'open' (revealed).
 * Also records the lockId in save.revealedPaths for UI display.
 *
 * @returns {boolean} true if the edge was found and mutated.
 */
export function revealPath(gs, fromId, toId) {
  const save = _currentSave(gs);
  if (!save) {
    console.warn('[storyMapMutations] revealPath: no current map save');
    return false;
  }
  const edge = _findEdge(save, fromId, toId);
  if (!edge) {
    console.warn(`[storyMapMutations] revealPath: edge ${fromId}->${toId} not found`);
    return false;
  }
  if (edge.kind === 'hidden' || edge.kind === 'locked') {
    if (edge.lockId) setUniquePush(save.revealedPaths, edge.lockId);
    edge.kind = 'open';
    return true;
  }
  return false; // Already open or blocked — no mutation.
}

/**
 * Flip an open edge to 'blocked'.
 *
 * @returns {boolean} true if mutated.
 */
export function blockPath(gs, fromId, toId) {
  const save = _currentSave(gs);
  if (!save) {
    console.warn('[storyMapMutations] blockPath: no current map save');
    return false;
  }
  const edge = _findEdge(save, fromId, toId);
  if (!edge) {
    console.warn(`[storyMapMutations] blockPath: edge ${fromId}->${toId} not found`);
    return false;
  }
  if (edge.kind === 'open') {
    edge.kind = 'blocked';
    return true;
  }
  return false;
}

/**
 * Make up to `count` hidden nodes with the given tag visible.
 * Nodes go from visibility='hidden' to 'revealed'.
 *
 * @returns {string[]} node IDs that were revealed.
 */
export function revealNodesByTag(gs, tag, count = 1) {
  const save = _currentSave(gs);
  if (!save) {
    console.warn('[storyMapMutations] revealNodesByTag: no current map save');
    return [];
  }

  // We need the static graph to find nodes by tag. The save doesn't hold tags
  // (tags are static from generation); look them up in gs.story._graphCache if
  // available, else fall back to scanning all nodes in the save.
  // For M-S07, we use a workaround: tag info is embedded in the save nodes via
  // a separate 'tags' field that storyMapGen writes into the node states.
  // If not present, we can only operate on ids.
  const revealed = [];
  let remaining = Math.max(0, Math.floor(count));

  for (const [nodeId, nodeState] of Object.entries(save.nodes || {})) {
    if (remaining <= 0) break;
    if (nodeState.visibility !== 'hidden') continue;
    // Check tag — stored as nodeState.tags[] (written by hydrateMapSave).
    const tags = nodeState.tags || [];
    if (!tags.includes(tag)) continue;
    nodeState.visibility = 'revealed';
    revealed.push(nodeId);
    remaining--;
  }

  return revealed;
}

/**
 * Apply an overlay to a node (e.g. 'corrupted', 'cleansed', 'blessed').
 * The overlay is stored in save.nodeOverlays[nodeId] and in save.nodes[nodeId].overlay.
 * Corruption side-effect: 'corrupted' overlay adds +5 worldCorruption;
 *   'cleansed' subtracts 3 (clamped 0..100).
 */
export function mutateNode(gs, nodeId, overlay) {
  const save = _currentSave(gs);
  if (!save) {
    console.warn('[storyMapMutations] mutateNode: no current map save');
    return;
  }
  if (!save.nodeOverlays) save.nodeOverlays = {};
  save.nodeOverlays[nodeId] = overlay;

  if (save.nodes?.[nodeId]) {
    save.nodes[nodeId].overlay = overlay;
  }

  // Side-effects on worldCorruption.
  if (overlay === 'corrupted') {
    gs.story.worldCorruption = Math.min(100, (gs.story.worldCorruption || 0) + 5);
  } else if (overlay === 'cleansed') {
    gs.story.worldCorruption = Math.max(0, (gs.story.worldCorruption || 0) - 3);
  }
}

/**
 * Unlock a transition to a new map (e.g. entering Act 2).
 * Sets gs.story.flags['transition_' + targetMapId] = true.
 */
export function unlockTransition(gs, targetMapId) {
  if (!gs.story?.flags) {
    console.warn('[storyMapMutations] unlockTransition: no story flags');
    return;
  }
  gs.story.flags[`transition_${targetMapId}`] = true;
}

/**
 * Advance a waypoint node's state machine.
 *
 * Legal transitions per §6.6:
 *   unexplored -> discovered -> activated -> corrupted -> disabled
 *   corrupted  -> activated   (purify)
 *   *          -> disabled    (world-mutation only — use applyWorldMutation)
 *
 * Illegal transitions produce console.warn and no mutation (never throw).
 */
export function setWaypointState(gs, nodeId, targetState) {
  const save = _currentSave(gs);
  if (!save) {
    console.warn('[storyMapMutations] setWaypointState: no current map save');
    return;
  }
  const nodeState = save.nodes?.[nodeId];
  if (!nodeState) {
    console.warn(`[storyMapMutations] setWaypointState: node '${nodeId}' not in save`);
    return;
  }
  const currentState = nodeState.waypointState || 'unexplored';
  const legal = WAYPOINT_TRANSITIONS[currentState] || [];
  if (!legal.includes(targetState)) {
    console.warn(
      `[storyMapMutations] setWaypointState: illegal transition ${currentState} -> ${targetState} for node '${nodeId}'`
    );
    return;
  }
  nodeState.waypointState = targetState;
}

/**
 * Apply a world mutation by id.
 *
 * v1 implementation: records the mutationId in gs.story.worldMutations[].
 * Full effect resolution (disabling waypoints, altering enemy pools, etc.)
 * requires world-mutations.json (Phase 13 content). The array is checked
 * by the Director and encounter builder in later milestones.
 *
 * Special case: if mutationId starts with 'disable_waypoint:', extracts the
 * nodeId suffix and forces waypointState -> 'disabled' (bypassing the legal
 * transition check, since disabled is the one world-mutation-only terminal).
 */
export function applyWorldMutation(gs, mutationId) {
  if (!gs.story) {
    console.warn('[storyMapMutations] applyWorldMutation: no story');
    return;
  }
  setUniquePush(gs.story.worldMutations, mutationId);

  // Handle disable_waypoint:<nodeId> special form.
  if (mutationId.startsWith('disable_waypoint:')) {
    const nodeId = mutationId.slice('disable_waypoint:'.length);
    const save = _currentSave(gs);
    if (save?.nodes?.[nodeId]) {
      save.nodes[nodeId].waypointState = 'disabled';
    }
  }
}
