/**
 * directorAware.js — Route by the Storyteller Director's profile.
 *
 * The director stamps the active storyteller profile (combatFrequency,
 * preferredThemes, thematicConsistency, rules) plus the current pressure band
 * onto its intent (see stepDirector). This policy scores every reachable node
 * with scoreNodeForStoryteller — the SAME function the live game uses — and
 * samples one, so different storytellers visit measurably different node-type
 * mixes on the SAME seed.
 *
 * Determinism: sampling uses a seeded RNG derived from the campaign rngState +
 * the current node id, so a given (seed, storyteller) pair always produces the
 * same route (byte-parity preserved), while different storytellers diverge.
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';
import { scoreNodeForStoryteller, getStoryteller } from '../../../src/story/storyDirector.js';
import { mulberry32 } from '../../../src/game/simulator.js';

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  if (map.indexes && map.indexes.outgoing) return map.indexes.outgoing[nodeId] || [];
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

function hashStr(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Honor rules.maxSameTypeStreak: if the last `maxStreak` visited nodes are all
 * the same type as this candidate, this candidate should be discouraged.
 */
function violatesStreak(nodeType, history, maxStreak) {
  if (!maxStreak || !history || history.length < maxStreak) return false;
  const tail = history.slice(-maxStreak);
  return tail.every(h => h.nodeType === nodeType) && nodeType === tail[tail.length - 1].nodeType;
}

/**
 * Honor rules.minNodesBetweenBosses: don't route into a boss too early.
 */
function bossTooEarly(nodeType, history, minGap) {
  if (nodeType !== 'boss') return false;
  if (!minGap) return false;
  return history.length < minGap;
}

export const directorAwarePolicy = {
  name: 'directorAware',

  chooseNode(map, currentNodeId, history, context = {}) {
    const edges = getOutgoingEdges(map, currentNodeId);
    if (!edges.length) return null;

    const intent = context.directorIntent || context.gs?.story?._lastDirectorIntent || null;
    const gs = context.gs;
    const storyteller =
      intent?._profile ||
      getStoryteller(intent?._storytellerId) ||
      getStoryteller(gs?.story?.storytellerId) ||
      getStoryteller('chronicler');

    const band = intent?._band || null;
    const rules = storyteller?.rules || {};

    const visitedSet = new Set((history || []).map(h => h.nodeId));

    const candidates = edges
      .map(e => e.to)
      .filter(id => map.nodes[id])
      .map(id => {
        const node = map.nodes[id];
        let score = scoreNodeForStoryteller(node, id, visitedSet, storyteller, { intent, band });
        // Honor streak + boss-gap rules by dampening (never fully banning, so a
        // dead-end map still resolves).
        if (violatesStreak(node.type, history, rules.maxSameTypeStreak)) score *= 0.1;
        if (bossTooEarly(node.type, history, rules.minNodesBetweenBosses)) score *= 0.05;
        return { id, score };
      });

    if (!candidates.length) return null;

    // Weighted sample (deterministic per seed+node+storyteller).
    const seed = (
      (gs?.story?.rngState ?? 1) ^
      hashStr(currentNodeId) ^
      hashStr(storyteller?.id || 'x')
    ) >>> 0 || 1;
    const rng = mulberry32(seed);
    rng();

    const total = candidates.reduce((s, c) => s + c.score, 0);
    let roll = rng() * total;
    // Stable order before sampling.
    candidates.sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));
    for (const c of candidates) {
      roll -= c.score;
      if (roll <= 0) return c.id;
    }
    return candidates[0].id;
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
