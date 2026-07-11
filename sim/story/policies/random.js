/**
 * random.js — Uniform random over valid choices, seeded from a passed rng function.
 *
 * Usage: create the policy with a seeded rng so runs are reproducible.
 *   import { mulberry32 } from '../../../src/game/simulator.js';
 *   const policy = makeRandomPolicy(mulberry32(seed));
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  if (map.indexes && map.indexes.outgoing) {
    return map.indexes.outgoing[nodeId] || [];
  }
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

/**
 * Create a random policy backed by the provided rng function.
 *
 * @param {function} rng - seeded random number generator () => float in [0,1)
 * @returns {object} policy
 */
export function makeRandomPolicy(rng) {
  const pick = (arr) => arr.length ? arr[Math.floor(rng() * arr.length)] : null;

  return {
    name: 'random',

    chooseNode(map, currentNodeId, _history) {
      const edges = getOutgoingEdges(map, currentNodeId);
      if (!edges.length) return null;
      const targets = edges.map(e => e.to).filter(id => map.nodes[id]);
      return pick(targets) || null;
    },

    chooseDialog(choices, _context) {
      if (!Array.isArray(choices) || !choices.length) return null;
      return pick(choices)?.id ?? null;
    },

    chooseSkillCheckApproach(approaches, _party) {
      if (!Array.isArray(approaches) || !approaches.length) return null;
      return pick(approaches)?.id ?? null;
    },

    decideRetreat(_combatPreview, _party) {
      return rng() < 0.1; // 10% retreat chance
    },

    decideCompanionSwap(_currentActive, recruited, _atWaypoint) {
      if (!Array.isArray(recruited) || !recruited.length) return null;
      return rng() < 0.3 ? pick(recruited)?.id ?? null : null;
    },
  };
}
