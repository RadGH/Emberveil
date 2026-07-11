/**
 * deterministic.js — Always picks the alphabetically-first valid option.
 *
 * Stable across runs with the same map. Used by byte-parity tests so
 * any non-determinism in map generation or combat immediately surfaces.
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  // Use prebuilt index if available, else scan.
  if (map.indexes && map.indexes.outgoing) {
    return map.indexes.outgoing[nodeId] || [];
  }
  // Fallback: build and cache indexes
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

export const deterministicPolicy = {
  name: 'deterministic',

  /**
   * Pick the alphabetically-first outgoing edge target from currentNodeId.
   */
  chooseNode(map, currentNodeId, _history) {
    const edges = getOutgoingEdges(map, currentNodeId);
    if (!edges.length) return null;
    // Sort by target node id alphabetically, return first.
    const targets = edges.map(e => e.to).filter(id => map.nodes[id]).sort();
    return targets[0] || null;
  },

  chooseDialog(choices, _context) {
    if (!Array.isArray(choices) || !choices.length) return null;
    const sorted = [...choices].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    return sorted[0]?.id ?? null;
  },

  chooseSkillCheckApproach(approaches, _party) {
    if (!Array.isArray(approaches) || !approaches.length) return null;
    const sorted = [...approaches].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    return sorted[0]?.id ?? null;
  },

  decideRetreat(_combatPreview, _party) {
    return false;
  },

  decideCompanionSwap(_currentActive, _recruited, _atWaypoint) {
    return null;
  },
};
