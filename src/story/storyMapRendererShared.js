export function regionViewModel(graph, mapSave, regionIndex) {
  const region = graph.subRegions[regionIndex] || graph.subRegions[0];
  const nodes = region.nodeIds.map(id => ({
    ...graph.nodes[id],
    save: mapSave.nodes[id],
  }));
  const nodeSet = new Set(region.nodeIds);
  const edges = mapSave.edges.filter(edge => nodeSet.has(edge.from) && nodeSet.has(edge.to));
  return { region, nodes, edges };
}

export function roadPath(fromNode, toNode) {
  const a = pointFor(fromNode);
  const b = pointFor(toNode);
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

export function pointFor(node) {
  return {
    x: 42 + node.x * 276,
    y: 64 + node.y * 340 + (node.col % 2) * 18,
  };
}

export function nodeTypeLabel(type) {
  const labels = {
    combat: 'Combat',
    dialog: 'Dialog',
    shrine: 'Shrine',
    lore: 'Lore',
    merchant: 'Merchant',
    rest: 'Rest',
    event: 'Event',
    boss: 'Boss',
  };
  return labels[type] || 'Event';
}
