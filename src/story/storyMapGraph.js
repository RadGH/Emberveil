export function buildIndexes(graph) {
  const byBiome = new Map();
  const byTag = new Map();
  const byType = new Map();
  const outgoing = new Map();
  const incoming = new Map();
  for (const node of Object.values(graph.nodes || {})) {
    addTo(byBiome, node.biome, node.id);
    addTo(byType, node.type, node.id);
    for (const tag of node.tags || []) addTo(byTag, tag, node.id);
  }
  for (const edge of graph.edges || []) {
    addTo(outgoing, edge.from, edge);
    addTo(incoming, edge.to, edge);
  }
  graph.indexes = { byBiome, byTag, byType, outgoing, incoming };
  return graph;
}

export function getOpenOutgoing(graph, mapSave, nodeId) {
  const savedEdges = mapSave?.edges || graph.edges || [];
  return savedEdges.filter(edge => edge.from === nodeId && edge.kind === 'open');
}

export function getVisibleRegionIndex(graph, mapSave, regionIndex) {
  const region = graph.subRegions[regionIndex];
  if (!region) return { visible: false, unlocked: false };
  if (regionIndex === 0) return { visible: true, unlocked: true };
  const prev = graph.subRegions[regionIndex - 1];
  const prevCleared = prev.nodeIds.some(id => ['visited', 'cleared'].includes(mapSave.nodes[id]?.state));
  return { visible: prevCleared, unlocked: prevCleared };
}

export function createMapSave(graph) {
  const nodes = {};
  for (const node of Object.values(graph.nodes)) {
    nodes[node.id] = {
      state: node.tags?.includes('entry') ? 'available' : 'unvisited',
      visibility: node.regionIndex === 0 ? 'visible' : 'fogged',
      waypointState: node.tags?.includes('waypoint') ? 'discovered' : null,
      assignedEncounterId: null,
      overlay: null,
    };
  }
  return {
    mapId: graph.mapId,
    act: graph.act,
    salt: graph.salt,
    entryNodeId: graph.entryNodeId,
    bossNodeId: graph.bossNodeId,
    subRegions: graph.subRegions.map(r => r.id),
    nodes,
    edges: graph.edges.map(edge => ({ ...edge })),
    revealedPaths: [],
    regionWeather: Object.fromEntries(graph.subRegions.map(r => [r.id, 'clear'])),
  };
}

export function syncRegionVisibility(graph, mapSave) {
  graph.subRegions.forEach((region, index) => {
    const status = getVisibleRegionIndex(graph, mapSave, index);
    for (const nodeId of region.nodeIds) {
      mapSave.nodes[nodeId].visibility = status.visible ? 'visible' : 'fogged';
    }
  });
  return mapSave;
}

export function reachableNodeIds(graph, mapSave, startId = graph.entryNodeId) {
  const seen = new Set();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const edge of getOpenOutgoing(graph, mapSave, id)) stack.push(edge.to);
  }
  return seen;
}

function addTo(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
