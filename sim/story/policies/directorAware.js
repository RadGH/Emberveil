/**
 * directorAware.js — Follow the Storyteller Director's current intent.
 *
 * The policy receives the director intent from runCampaign and uses it to bias
 * route choice. This gives balance runs an observable route difference per
 * storyteller instead of exercising the map with a storyteller-blind policy.
 */

import { buildIndexes } from '../../../src/story/storyMapGraph.js';

const TYPE_PRIORITY = {
  boss: 9,
  elite: 8,
  combat: 7,
  event: 6,
  dialog: 5,
  shrine: 4,
  lore: 3,
  merchant: 2,
  rest: 1,
};

function getOutgoingEdges(map, nodeId) {
  if (!map) return [];
  if (map.indexes && map.indexes.outgoing) return map.indexes.outgoing[nodeId] || [];
  buildIndexes(map);
  return (map.indexes && map.indexes.outgoing[nodeId]) || [];
}

function tagsFor(node) {
  const tags = [];
  if (node?.type) tags.push(node.type);
  if (node?.biome) tags.push(node.biome);
  if (Array.isArray(node?.tags)) tags.push(...node.tags);
  if (Array.isArray(node?.themeTags)) tags.push(...node.themeTags);
  return tags;
}

function scoreNode(node, id, visitedSet, intent) {
  let score = 0;
  const intentType = intent?.type;
  const nodeType = node?.type || 'unknown';

  if (!visitedSet.has(id)) score += 30;
  if (intentType && nodeType === intentType) score += 60;

  const wantedTags = new Set([
    ...(Array.isArray(intent?.themeTags) ? intent.themeTags : []),
    ...(Array.isArray(intent?.biomes) ? intent.biomes : []),
    intent?.primaryRole,
  ].filter(Boolean));

  const nodeTags = tagsFor(node);
  for (const tag of nodeTags) {
    if (wantedTags.has(tag)) score += 8;
  }

  score += TYPE_PRIORITY[nodeType] || 0;
  if (intent?._isFallback && nodeType === 'combat') score += 6;
  if (intent?._ironJudgeAmbush && (nodeType === 'combat' || nodeType === 'elite')) score += 50;
  if (intent?._tricksterChaos) score += Math.abs(hashStr(id)) % 11;

  return score;
}

function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const directorAwarePolicy = {
  name: 'directorAware',

  chooseNode(map, currentNodeId, history, context = {}) {
    const edges = getOutgoingEdges(map, currentNodeId);
    if (!edges.length) return null;

    const visitedSet = new Set((history || []).map(h => h.nodeId));
    const intent = context.directorIntent || context.gs?.story?._lastDirectorIntent || null;

    const ranked = edges
      .map(e => e.to)
      .filter(id => map.nodes[id])
      .map(id => ({ id, score: scoreNode(map.nodes[id], id, visitedSet, intent) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.id.localeCompare(b.id);
      });

    return ranked[0]?.id || null;
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
