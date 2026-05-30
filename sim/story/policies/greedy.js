/**
 * greedy.js — Prefer combat nodes; break ties alphabetically.
 * Priority: boss > elite > combat > others.
 *
 * M-S09: used in the 100-run stress test.
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';

const COMBAT_PRIORITY = { boss: 4, elite: 3, combat: 2 };

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  if (map.indexes && map.indexes.outgoing) return map.indexes.outgoing[nodeId] || [];
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

export const greedyPolicy = {
  name: 'greedy',

  chooseNode(map, currentNodeId, _history) {
    const edges = getOutgoingEdges(map, currentNodeId);
    if (!edges.length) return null;

    const targets = edges
      .map(e => e.to)
      .filter(id => map.nodes[id])
      .sort((a, b) => {
        const pa = COMBAT_PRIORITY[map.nodes[a]?.type] ?? 0;
        const pb = COMBAT_PRIORITY[map.nodes[b]?.type] ?? 0;
        if (pb !== pa) return pb - pa;
        return a.localeCompare(b);
      });

    return targets[0] || null;
  },

  chooseDialog(choices, _context) {
    if (!Array.isArray(choices) || !choices.length) return null;
    return [...choices].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))[0]?.id ?? null;
  },

  chooseSkillCheckApproach(approaches, _party) {
    if (!Array.isArray(approaches) || !approaches.length) return null;
    return approaches[0]?.id ?? null;
  },

  decideRetreat() { return false; },

  decideCompanionSwap() { return null; },
};
