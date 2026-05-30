import { regenerateFromSave } from './storyMapGen.js';
import { syncRegionVisibility } from './storyMapGraph.js';
import { uniquePush } from './storyLedger.js';

export function revealPath(gs, fromId, toId) {
  const { mapSave, graph } = currentMap(gs);
  const edge = mapSave.edges.find(e => e.from === fromId && e.to === toId);
  if (!edge || edge.kind !== 'hidden') return false;
  edge.kind = 'open';
  if (edge.lockId) uniquePush(mapSave.revealedPaths, edge.lockId);
  syncRegionVisibility(graph, mapSave);
  return true;
}

export function blockPath(gs, fromId, toId) {
  const { mapSave } = currentMap(gs);
  const edge = mapSave.edges.find(e => e.from === fromId && e.to === toId);
  if (!edge || edge.kind !== 'open') return false;
  edge.kind = 'locked';
  return true;
}

export function revealNodesByTag(gs, tag, count = 1) {
  const { graph, mapSave } = currentMap(gs);
  const revealed = [];
  for (const node of Object.values(graph.nodes)) {
    if (revealed.length >= count) break;
    if (!node.tags?.includes(tag)) continue;
    const saveNode = mapSave.nodes[node.id];
    if (saveNode && saveNode.visibility !== 'visible') {
      saveNode.visibility = 'visible';
      revealed.push(node.id);
    }
  }
  return revealed;
}

export function mutateNode(gs, nodeId, overlay) {
  const { mapSave } = currentMap(gs);
  if (!mapSave.nodes[nodeId]) return;
  mapSave.nodes[nodeId].overlay = overlay;
}

export function unlockTransition(gs, targetMapId) {
  gs.story.flags[`transition_${targetMapId}`] = true;
}

export function setWaypointState(gs, nodeId, state) {
  const { mapSave } = currentMap(gs);
  if (!mapSave.nodes[nodeId]) return;
  mapSave.nodes[nodeId].waypointState = state;
}

export function applyWorldMutation(gs, mutationId) {
  uniquePush(gs.story.worldMutations, mutationId);
  if (mutationId === 'darkening') gs.story.pressureMeter = Math.min(100, (gs.story.pressureMeter || 0) + 8);
}

export function visitNode(gs, nodeId) {
  const { graph, mapSave } = currentMap(gs);
  if (!mapSave.nodes[nodeId]) return false;
  mapSave.nodes[nodeId].state = graph.nodes[nodeId]?.type === 'boss' ? 'cleared' : 'visited';
  mapSave.nodes[nodeId].visibility = 'visible';
  gs.story.currentNodeId = nodeId;
  gs.nodeId = nodeId;
  syncRegionVisibility(graph, mapSave);
  return true;
}

export function currentMap(gs) {
  if (!gs?.story) throw new Error('Story map requires story state.');
  const mapId = gs.story.currentMapId;
  if (!gs.story.maps?.[mapId]) {
    const generated = regenerateFromSave(gs.story, mapId);
    gs.story.maps = { ...(gs.story.maps || {}), [generated.graph.mapId]: generated.mapSave };
    gs.story.currentMapId = generated.graph.mapId;
  }
  const generated = regenerateFromSave(gs.story, gs.story.currentMapId);
  gs.story.maps[gs.story.currentMapId] = generated.mapSave;
  return { ...generated, mapSave: generated.mapSave };
}
