/**
 * storyFirst.js — Prefer dialog > shrine > lore > merchant > others.
 *
 * M-S09: used in the 100-run stress test.
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';

const STORY_PRIORITY = { dialog: 5, shrine: 4, lore: 3, merchant: 2, rest: 1 };

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  if (map.indexes && map.indexes.outgoing) return map.indexes.outgoing[nodeId] || [];
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

export const storyFirstPolicy = {
  name: 'storyFirst',

  chooseNode(map, currentNodeId, history) {
    const edges = getOutgoingEdges(map, currentNodeId);
    if (!edges.length) return null;

    const visitedSet = new Set((history || []).map(h => h.nodeId));
    const allOut = map.indexes?.outgoing || {};

    const targets = edges
      .map(e => e.to)
      .filter(id => map.nodes[id])
      .sort((a, b) => {
        const pa = STORY_PRIORITY[map.nodes[a]?.type] ?? 0;
        const pb = STORY_PRIORITY[map.nodes[b]?.type] ?? 0;

        // Prefer nodes that have unvisited outgoing edges (avoid dead-ends).
        const aHasForward = (allOut[a] || []).some(e => !visitedSet.has(e.to) && e.to !== currentNodeId);
        const bHasForward = (allOut[b] || []).some(e => !visitedSet.has(e.to) && e.to !== currentNodeId);
        if (aHasForward !== bHasForward) return aHasForward ? -1 : 1;

        if (pb !== pa) return pb - pa;
        return a.localeCompare(b);
      });

    // Try unvisited first, fall back to visited if stuck.
    const unvisited = targets.filter(id => !visitedSet.has(id));
    return (unvisited[0] || targets[0]) ?? null;
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
