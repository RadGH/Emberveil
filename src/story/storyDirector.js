import { currentMap } from './storyMapMutations.js';
import { getOpenOutgoing } from './storyMapGraph.js';
import { clampInt, commitRng, nextRngState, recordTick, rngFromState } from './storyLedger.js';
import { getStorytellerProfile, pressureBandName, clampPressure } from './storyStorytellers.js';

const TYPE_WEIGHTS = Object.freeze({
  boss: 1.6,
  combat: 1.15,
  dialog: 1.05,
  lore: 1.0,
  shrine: 0.9,
  merchant: 0.85,
  rest: 0.82,
  event: 0.88,
  crisis_event: 1.8,
  hidden: 1.12,
});

export function getDirectorIntent(gs, opts = {}) {
  const story = requireStory(gs);
  const profile = getStorytellerProfile(opts.storytellerId || story.storytellerId);
  const { graph, mapSave } = currentMap(gs);
  const currentNode = graph.nodes[story.currentNodeId] || graph.nodes[graph.entryNodeId];
  const rngStateBefore = story.rngState >>> 0;
  const tick = clampInt(story.counters.directorTick || 0, 0, 1e9);
  const rngStateAfter = nextRngState(rngStateBefore, `director:${tick}:${currentNode?.id || 'start'}`);
  const rng = rngFromState(rngStateAfter);

  const candidates = buildCandidates(gs, graph, mapSave, currentNode, opts);
  const intent = selectIntent({
    gs,
    story,
    graph,
    currentNode,
    profile,
    candidates,
    rng,
    tick,
    mutate: !!opts.mutateDirectorState,
  });

  return {
    intent,
    candidates,
    rngStateBefore,
    rngStateAfter,
    pressureBand: pressureBandName(story.pressureMeter || 0),
  };
}

export function inspectCandidates(gs, opts = {}) {
  return getDirectorIntent(gs, opts).candidates;
}

export function stepDirector(gs, opts = {}) {
  const story = requireStory(gs);
  const nextTick = clampInt((story.counters.directorTick || 0) + 1, 0, 1e9);
  story.counters.directorTick = nextTick;
  const result = getDirectorIntent(gs, { ...opts, mutateDirectorState: true });
  recordTick(gs, {
    nodeId: story.currentNodeId,
    nodeType: result.intent?.type,
    enemyFamily: result.intent?.enemyFamily || null,
    skillLabel: result.intent?.skillLabel || null,
    rewardType: result.intent?.rewardType || null,
    biome: result.intent?.biome || null,
    tonalTag: result.intent?.tonalTag || null,
    storytellerEvent: result.intent?.storytellerEvent || null,
  });
  commitRng(gs, `director:${nextTick}:${result.intent?.id || 'none'}`);
  story.forcedDirectorIntent = null;
  return result.intent;
}

export function recordDirectorTick(gs, outcome = {}) {
  return recordTick(gs, outcome);
}

export function forceIntent(gs, intentObj) {
  const story = requireStory(gs);
  story.forcedDirectorIntent = intentObj ? { ...intentObj } : null;
}

function selectIntent({ story, profile, candidates, rng, tick, mutate }) {
  if (story.forcedDirectorIntent) return { ...story.forcedDirectorIntent, forced: true };
  if (!candidates.length) return synthesizeFallbackIntent(profile, story);

  if (profile.uniqueMechanic === 'dark_omen_interrupt') {
    const omenAt = story.counters.ashProphetOmenAt || 0;
    const nextAt = omenAt || (tick + randInt(rng, 8, 12));
    if (mutate) story.counters.ashProphetOmenAt = nextAt;
    if (tick + 1 >= nextAt) {
      if (mutate) story.counters.ashProphetOmenAt = tick + 1 + randInt(rng, 8, 12);
      return {
        id: 'crisis_event',
        nodeId: 'crisis_event',
        type: 'crisis_event',
        baseWeight: 1,
        scoreBeforeNorm: 1,
        scoreAfterNorm: 1,
        storytellerEvent: 'dark_omen_interrupt',
        biome: currentBiome(candidates) || 'any',
      };
    }
  }

  if (profile.uniqueMechanic === 'every_6th_random' && (tick + 1) % 6 === 0) {
    const pick = candidates[Math.floor(rng() * candidates.length)];
    return {
      ...pick,
      storytellerEvent: 'every_6th_random',
      randomPick: true,
    };
  }

  if (profile.uniqueMechanic === 'no_fallback_ambush_instead' && !candidates.length) {
    return synthesizeAmbushIntent(story, candidates[0]);
  }

  const scored = candidates.map(candidate => {
    const scoreBeforeNorm = scoreCandidate(candidate, story, profile);
    return { ...candidate, scoreBeforeNorm };
  });
  const sum = scored.reduce((acc, candidate) => acc + candidate.scoreBeforeNorm, 0) || 1;
  let cursor = rng() * sum;
  for (const candidate of scored) {
    cursor -= candidate.scoreBeforeNorm;
    if (cursor <= 0) {
      return {
        ...candidate,
        scoreAfterNorm: candidate.scoreBeforeNorm / sum,
        prob: candidate.scoreBeforeNorm / sum,
      };
    }
  }
  const last = scored[scored.length - 1];
  return {
    ...last,
    scoreAfterNorm: last.scoreBeforeNorm / sum,
    prob: last.scoreBeforeNorm / sum,
  };
}

function buildCandidates(gs, graph, mapSave, currentNode, opts) {
  const story = requireStory(gs);
  const profile = getStorytellerProfile(opts.storytellerId || story.storytellerId);
  const outgoing = getOpenOutgoing(graph, mapSave, currentNode?.id || graph.entryNodeId)
    .map(edge => graph.nodes[edge.to])
    .filter(Boolean);
  const region = graph.subRegions[currentNode?.regionIndex ?? 0];
  const regionNodes = (region?.nodeIds || [])
    .map(id => graph.nodes[id])
    .filter(Boolean)
    .filter(node => mapSave.nodes[node.id]?.visibility === 'visible');

  const nodePool = uniqueNodes([...outgoing, ...regionNodes].filter(Boolean), currentNode?.id);
  const candidates = nodePool.length ? nodePool.map(node => buildCandidate(node, mapSave)) : [];
  if (!candidates.length && profile.rules.fallbackAllowed) {
    candidates.push({
      id: 'fallback',
      nodeId: currentNode?.id || graph.entryNodeId,
      type: 'event',
      biome: currentNode?.biome || 'any',
      themeTags: ['fallback'],
      baseWeight: 0.01,
      scoreBeforeNorm: 0.01,
    });
  }

  if (!opts.allowHidden && currentNode?.tags?.includes('boss') && story.recentHistory.sameTypeStreak >= 1) {
    return candidates;
  }
  return candidates;
}

function buildCandidate(node, mapSave) {
  const save = mapSave.nodes[node.id] || {};
  const type = node.type || 'event';
  const biome = node.biome || 'any';
  return {
    id: node.id,
    nodeId: node.id,
    type,
    biome,
    regionId: node.regionId,
    regionIndex: node.regionIndex,
    baseWeight: node.baseWeight ?? TYPE_WEIGHTS[type] ?? 1,
    themeTags: [
      type,
      biome,
      ...(node.tags || []),
      ...(save.waypointState ? ['waypoint'] : []),
    ],
    enemyFamily: node.story?.enemyFamily || (type === 'combat' ? biome : null),
    skillLabel: node.story?.skillLabel || null,
    rewardType: node.story?.rewardType || (type === 'merchant' ? 'gold' : null),
    tonalTag: node.story?.tonalTag || (type === 'boss' ? 'ominous' : type),
    requires: node.requires || node.story?.requires || null,
    lockId: node.lockId || null,
  };
}

function uniqueNodes(nodes, excludeId = null) {
  const seen = new Set();
  const out = [];
  for (const node of nodes) {
    if (!node || node.id === excludeId || seen.has(node.id)) continue;
    seen.add(node.id);
    out.push(node);
  }
  return out;
}

function scoreCandidate(candidate, story, profile) {
  let score = candidate.baseWeight || 1;
  const history = story.recentHistory || {};
  const sameTypePenalty = Math.max(0.2, 1 - 0.12 * Math.max(0, history.sameTypeStreak - 1));
  if (history.lastType && history.lastType === candidate.type) score *= sameTypePenalty;
  const recentTypes = (history.nodeTypes || []).slice(-2);
  if (recentTypes.length === 2 && recentTypes.every(t => t === candidate.type)) score *= 0.45;

  const pressure = clampPressure(story.pressureMeter || 0);
  const band = pressureBandName(pressure);
  const combatBias = 0.5 + profile.combatFrequency;
  const narrativeBias = 1.5 - profile.combatFrequency;
  if (['combat', 'boss'].includes(candidate.type)) score *= combatBias;
  if (['dialog', 'lore', 'merchant', 'rest', 'shrine'].includes(candidate.type)) score *= narrativeBias;
  if (band === 'Calm' && ['dialog', 'lore', 'merchant'].includes(candidate.type)) score *= 1.3;
  if (band === 'Urgent' && candidate.type === 'combat') score *= 1.25;
  if (band === 'Urgent' && ['shrine', 'rest'].includes(candidate.type)) score *= 0.75;
  if (band === 'Crisis' && candidate.type !== 'crisis_event') score *= 0.9;

  const themeMatch = candidate.themeTags.some(tag => profile.preferredThemes.includes(tag));
  if (!themeMatch) score *= (1 - 0.5 * Math.max(0.2, profile.thematicConsistency));
  if (themeMatch) score *= 1 + (profile.thematicConsistency - 0.5) * 0.4;

  if (profile.uniqueMechanic === 'narrative_coherence_bonus') {
    const lastThemes = [...(history.biomes || []).slice(-3)];
    const repeatedTheme = lastThemes.length >= 3 && lastThemes.every(t => t === lastThemes[0]);
    if (repeatedTheme && candidate.themeTags.includes(lastThemes[0])) score *= 1.5;
  }
  if (profile.uniqueMechanic === 'momentum_escalation' && ['combat', 'boss'].includes(candidate.type)) {
    const streak = clampInt(history.winStreak || 0, 0, 20);
    score *= 1 + Math.min(0.5, 0.1 * streak);
  }
  if (profile.uniqueMechanic === 'discovery_pool_3x' && ['lore', 'hidden'].includes(candidate.type)) score *= 3;
  if (profile.uniqueMechanic === 'no_fallback_ambush_instead' && candidate.type === 'combat') score *= 1.1;
  if (profile.uniqueMechanic === 'dark_omen_interrupt' && candidate.type === 'crisis_event') score *= 10;
  if (profile.uniqueMechanic === 'every_6th_random') score *= 1;

  return Math.max(0.001, score);
}

function synthesizeFallbackIntent(profile, story) {
  if (profile.rules.fallbackAllowed === false) return synthesizeAmbushIntent(story);
  return {
    id: 'fallback',
    nodeId: story.currentNodeId,
    type: 'event',
    biome: 'any',
    baseWeight: 0.01,
    scoreBeforeNorm: 0.01,
    scoreAfterNorm: 1,
    prob: 1,
    storytellerEvent: 'fallback',
  };
}

function synthesizeAmbushIntent(story, fromCandidate = null) {
  return {
    id: 'synthetic_ambush',
    nodeId: story.currentNodeId,
    type: 'combat',
    biome: fromCandidate?.biome || 'any',
    baseWeight: 1,
    scoreBeforeNorm: 1,
    scoreAfterNorm: 1,
    prob: 1,
    storytellerEvent: 'forced_ambush',
  };
}

function currentBiome(candidates) {
  return candidates[0]?.biome || null;
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function requireStory(gs) {
  if (!gs || !gs.story) throw new Error('Story state is required.');
  return gs.story;
}
