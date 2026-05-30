import { describe, expect, it } from 'vitest';
import { createDefaultStoryLedger } from '../storyLedger.js';
import { generateAct } from '../storyMapGen.js';
import { blockPath, currentMap, revealPath, setWaypointState, visitNode } from '../storyMapMutations.js';
import { runMapValidators } from '../storyMapValidator.js';
import { getOpenOutgoing } from '../storyMapGraph.js';

describe('story map generation', () => {
  it('is deterministic for seed, act, and salt', () => {
    const a = generateAct({ seed: 'map-seed', act: 1, salt: 0 });
    const b = generateAct({ seed: 'map-seed', act: 1, salt: 0 });
    expect(Object.keys(a.graph.nodes)).toEqual(Object.keys(b.graph.nodes));
    expect(a.graph.edges).toEqual(b.graph.edges);
    expect(a.graph.subRegions.map(r => r.biome)).toEqual(b.graph.subRegions.map(r => r.biome));
  });

  it('passes all connectivity, stitch, waypoint, boss, and hidden-lock validators', () => {
    const { graph } = generateAct({ seed: 'validator-seed', act: 1 });
    const results = runMapValidators(graph);
    expect(results.every(r => r.ok)).toBe(true);
    expect(graph.subRegions).toHaveLength(5);
    expect(Object.values(graph.nodes).some(n => n.tags.includes('boss'))).toBe(true);
  });

  it('creates a persisted map save and supports path/node mutations', () => {
    const story = createDefaultStoryLedger({ campaignSeed: 'mutation-seed' });
    const { graph, mapSave } = generateAct({ seed: story.campaignSeed, act: 1 });
    story.currentMapId = graph.mapId;
    story.currentNodeId = graph.entryNodeId;
    story.maps[graph.mapId] = mapSave;
    const gs = { nodeId: graph.entryNodeId, story };
    const hidden = mapSave.edges.find(edge => edge.kind === 'hidden');
    expect(hidden).toBeTruthy();
    expect(revealPath(gs, hidden.from, hidden.to)).toBe(true);
    expect(story.maps[graph.mapId].edges.find(edge => edge.from === hidden.from && edge.to === hidden.to).kind).toBe('open');
    expect(blockPath(gs, hidden.from, hidden.to)).toBe(true);
    expect(story.maps[graph.mapId].edges.find(edge => edge.from === hidden.from && edge.to === hidden.to).kind).toBe('locked');
    const waypoint = Object.values(graph.nodes).find(node => node.tags.includes('waypoint'));
    setWaypointState(gs, waypoint.id, 'activated');
    expect(story.maps[graph.mapId].nodes[waypoint.id].waypointState).toBe('activated');
  });

  it('visits reachable nodes and unlocks later region fog from visited prior regions', () => {
    const story = createDefaultStoryLedger({ campaignSeed: 'visit-seed' });
    const { graph, mapSave } = generateAct({ seed: story.campaignSeed, act: 1 });
    story.currentMapId = graph.mapId;
    story.currentNodeId = graph.entryNodeId;
    story.maps[graph.mapId] = mapSave;
    const gs = { nodeId: graph.entryNodeId, story };
    const next = getOpenOutgoing(graph, mapSave, graph.entryNodeId)[0].to;
    expect(visitNode(gs, next)).toBe(true);
    expect(story.currentNodeId).toBe(next);
    expect(story.maps[graph.mapId].nodes[next].state).toBe('visited');
    expect(currentMap(gs).mapSave.nodes[next].visibility).toBe('visible');
  });
});
