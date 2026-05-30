import { createMapSave, reachableNodeIds } from './storyMapGraph.js';

export function runMapValidators(graph, opts = {}) {
  return [
    validateGraphConnectivity(graph),
    validateQuestCriticalReachability(graph, opts.quests || []),
    validateBossReachability(graph, graph.bossNodeId),
    validateSubRegionStitch(graph),
    validateWaypointCoverage(graph),
    validateHiddenPathSatisfiability(graph, opts.quests || [], opts.dialogPools || []),
  ];
}

export function validateGraphConnectivity(graph) {
  const reachable = reachableNodeIds(graph, createMapSave(graph), graph.entryNodeId);
  const missing = Object.keys(graph.nodes).filter(id => !reachable.has(id));
  return missing.length ? { ok: false, reason: 'unreachable_nodes', missing } : { ok: true };
}

export function validateQuestCriticalReachability(graph) {
  const reachable = reachableNodeIds(graph, createMapSave(graph), graph.entryNodeId);
  const unreachableIds = Object.values(graph.nodes)
    .filter(node => node.tags?.includes('quest_critical') && !reachable.has(node.id))
    .map(node => node.id);
  return unreachableIds.length ? { ok: false, unreachableIds } : { ok: true, unreachableIds: [] };
}

export function validateBossReachability(graph, bossNodeId) {
  const reachable = reachableNodeIds(graph, createMapSave(graph), graph.entryNodeId);
  return reachable.has(bossNodeId) ? { ok: true } : { ok: false };
}

export function validateSubRegionStitch(graph) {
  for (let i = 0; i < graph.subRegions.length; i++) {
    const region = graph.subRegions[i];
    if (i > 0) {
      const incoming = graph.edges.some(edge => region.nodeIds.includes(edge.to) && !region.nodeIds.includes(edge.from));
      if (!incoming) return { ok: false, reason: 'missing_incoming', regionId: region.id };
    }
    if (i < graph.subRegions.length - 1) {
      const outgoing = graph.edges.some(edge => region.nodeIds.includes(edge.from) && !region.nodeIds.includes(edge.to));
      if (!outgoing) return { ok: false, reason: 'missing_outgoing', regionId: region.id };
    }
  }
  return { ok: true };
}

export function validateWaypointCoverage(graph) {
  const missingRegions = graph.subRegions
    .filter(region => !region.nodeIds.some(id => graph.nodes[id]?.tags?.includes('waypoint')))
    .map(region => region.id);
  return missingRegions.length ? { ok: false, missingRegions } : { ok: true, missingRegions: [] };
}

export function validateHiddenPathSatisfiability(graph) {
  const hiddenLocks = [...new Set(graph.edges.filter(edge => edge.kind === 'hidden').map(edge => edge.lockId).filter(Boolean))];
  const brokenLocks = hiddenLocks.filter(lockId => !graph.lockSatisfiers?.[lockId]);
  return brokenLocks.length ? { ok: false, brokenLocks } : { ok: true, brokenLocks: [] };
}
