/**
 * combatHeavy.js — Prefer elite > combat > boss.
 *
 * Intentionally prefers regular combat over boss nodes so the campaign
 * explores more fights before the final boss.
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';

const PRIORITY = { elite: 3, combat: 2, boss: 1 };

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  if (map.indexes && map.indexes.outgoing) return map.indexes.outgoing[nodeId] || [];
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

export const combatHeavyPolicy = {
  name: 'combatHeavy',

  chooseNode(map, currentNodeId, _history) {
    const edges = getOutgoingEdges(map, currentNodeId);
    if (!edges.length) return null;

    const targets = edges
      .map(e => e.to)
      .filter(id => map.nodes[id])
      .sort((a, b) => {
        const pa = PRIORITY[map.nodes[a]?.type] ?? 0;
        const pb = PRIORITY[map.nodes[b]?.type] ?? 0;
        if (pb !== pa) return pb - pa;
        return a.localeCompare(b);
      });

    return targets[0] || null;
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
