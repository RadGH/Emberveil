/**
 * explorer.js — Prefer hidden-edge reveals; prefer unvisited subregions.
 *
 * Chooses targets that are reached by hidden edges first (to unlock new paths),
 * then prefers nodes in subregions not yet visited.
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  if (map.indexes && map.indexes.outgoing) return map.indexes.outgoing[nodeId] || [];
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

export const explorerPolicy = {
  name: 'explorer',

  chooseNode(map, currentNodeId, history) {
    const edges = getOutgoingEdges(map, currentNodeId);
    if (!edges.length) return null;

    const visitedRegions = new Set(history.map(h => map.nodes[h.nodeId]?.regionId).filter(Boolean));

    // Score each target
    const scored = edges
      .filter(e => map.nodes[e.to])
      .map(e => {
        const node = map.nodes[e.to];
        let score = 0;
        // Hidden edge bonus
        if (e.kind === 'hidden' || e.hidden) score += 10;
        // Unvisited region bonus
        if (node.regionId && !visitedRegions.has(node.regionId)) score += 5;
        // Alphabetical tiebreak handled by sort stability
        return { id: e.to, score };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    return scored[0]?.id ?? null;
  },

  chooseDialog(choices, _context) {
    if (!Array.isArray(choices) || !choices.length) return null;
    return choices[0]?.id ?? null;
  },

  chooseSkillCheckApproach(approaches, _party) {
    if (!Array.isArray(approaches) || !approaches.length) return null;
    return approaches[0]?.id ?? null;
  },

  decideRetreat() { return false; },

  decideCompanionSwap() { return null; },
};
