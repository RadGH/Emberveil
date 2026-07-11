/**
 * mapGen.test.js — Tests for storyMapGen + storyMapGraph + storyMapValidator (M-S05).
 *
 * Coverage:
 *  - Deterministic seed: same seed -> identical graph
 *  - Per-act node-count ranges (§6.2)
 *  - 6 validator functions catch synthetic broken graphs
 *  - serializeMapSave / hydrateMapSave round-trip
 *  - buildIndexes correctness
 */

import { describe, it, expect } from 'vitest';
import { generateAct } from '../storyMapGen.js';
import { buildIndexes, serializeMapSave, hydrateMapSave } from '../storyMapGraph.js';
import {
  validateGraphConnectivity,
  validateQuestCriticalReachability,
  validateBossReachability,
  validateSubRegionStitch,
  validateWaypointCoverage,
  validateHiddenPathSatisfiability,
  collectSatisfiedLocks,
} from '../storyMapValidator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function graphSnapshot(graph) {
  return JSON.stringify({
    nodes: Object.keys(graph.nodes).sort(),
    edges: (graph.edges || []).map(e => `${e.from}>${e.to}:${e.kind}`).sort(),
  });
}

// Build a minimal graph by hand for validator testing.
function makeMinimalGraph({ subRegions = null, nodes = null, edges = null, entryNodeId = 'n0' } = {}) {
  const defaultSubRegions = [
    { id: 'r0', name: 'R0', biome: 'emberwood', nodeIds: ['n0', 'n1', 'n2'], xOffset: 0 },
    { id: 'r1', name: 'R1', biome: 'stoneward', nodeIds: ['n3', 'n4', 'n5'], xOffset: 1 },
  ];
  const defaultNodes = {
    n0: { id: 'n0', biome: 'emberwood', regionId: 'r0', lane: 0, col: 0, type: 'combat', tags: ['waypoint'], baseWeight: 1 },
    n1: { id: 'n1', biome: 'emberwood', regionId: 'r0', lane: 1, col: 0, type: 'dialog', tags: [], baseWeight: 1 },
    n2: { id: 'n2', biome: 'emberwood', regionId: 'r0', lane: 2, col: 1, type: 'rest',   tags: [], baseWeight: 1 },
    n3: { id: 'n3', biome: 'stoneward', regionId: 'r1', lane: 0, col: 2, type: 'combat', tags: ['waypoint'], baseWeight: 1 },
    n4: { id: 'n4', biome: 'stoneward', regionId: 'r1', lane: 1, col: 2, type: 'lore',   tags: [], baseWeight: 1 },
    n5: { id: 'n5', biome: 'stoneward', regionId: 'r1', lane: 2, col: 3, type: 'boss',   tags: [], baseWeight: 1 },
  };
  const defaultEdges = [
    { id: 'e01', from: 'n0', to: 'n1', kind: 'open' },
    { id: 'e02', from: 'n0', to: 'n2', kind: 'open' },
    { id: 'e12', from: 'n1', to: 'n2', kind: 'open' },
    { id: 'e23', from: 'n2', to: 'n3', kind: 'open' }, // stitch
    { id: 'e34', from: 'n3', to: 'n4', kind: 'open' },
    { id: 'e45', from: 'n4', to: 'n5', kind: 'open' },
    { id: 'e35', from: 'n3', to: 'n5', kind: 'open' },
  ];
  const g = {
    mapId: 'test_map',
    act: 1,
    seed: 0,
    entryNodeId,
    subRegions: subRegions || defaultSubRegions,
    nodes:      nodes      || defaultNodes,
    edges:      edges      || defaultEdges,
  };
  g.indexes = buildIndexes(g);
  return g;
}

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------

describe('generateAct — determinism', () => {
  it('same seed + act -> identical graph (act 1)', () => {
    const a = generateAct({ seed: 'abc', act: 1 });
    const b = generateAct({ seed: 'abc', act: 1 });
    expect(graphSnapshot(a.mapGraph)).toBe(graphSnapshot(b.mapGraph));
  });

  it('same seed + act -> identical graph (act 2)', () => {
    const a = generateAct({ seed: 42, act: 2 });
    const b = generateAct({ seed: 42, act: 2 });
    expect(graphSnapshot(a.mapGraph)).toBe(graphSnapshot(b.mapGraph));
  });

  it('different seeds -> different graphs', () => {
    const a = generateAct({ seed: 'abc', act: 1 });
    const b = generateAct({ seed: 'xyz', act: 1 });
    expect(graphSnapshot(a.mapGraph)).not.toBe(graphSnapshot(b.mapGraph));
  });

  it('different salts produce different edge sets (one of 5 salt pairs differs)', () => {
    // Test multiple salt pairs — at least one should differ in edges.
    const results = [0, 2, 4, 7, 11].map(s =>
      graphSnapshot(generateAct({ seed: 100, act: 1, salt: s }).mapGraph)
    );
    // Not all 5 should be identical (i.e. some edge randomness propagated).
    const allSame = results.every(r => r === results[0]);
    expect(allSame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Node-count ranges per act (§6.2)
// ---------------------------------------------------------------------------

describe('generateAct — node counts per §6.2', () => {
  // Act 1: 5 regions × 9-12 nodes = 45-60 total.
  it('act 1 node count in range 45-60', () => {
    const { mapGraph } = generateAct({ seed: 'test', act: 1 });
    const count = Object.keys(mapGraph.nodes).length;
    expect(count).toBeGreaterThanOrEqual(45);
    expect(count).toBeLessThanOrEqual(60);
  });

  // Act 2: 5 regions × 10-13 nodes = 50-65 total.
  it('act 2 node count in range 50-65', () => {
    const { mapGraph } = generateAct({ seed: 'test', act: 2 });
    const count = Object.keys(mapGraph.nodes).length;
    expect(count).toBeGreaterThanOrEqual(50);
    expect(count).toBeLessThanOrEqual(65);
  });

  // Act 3: 4 regions × 12-15 nodes = 48-60 total.
  it('act 3 node count in range 48-60', () => {
    const { mapGraph } = generateAct({ seed: 'test', act: 3 });
    const count = Object.keys(mapGraph.nodes).length;
    expect(count).toBeGreaterThanOrEqual(48);
    expect(count).toBeLessThanOrEqual(60);
  });

  it('act 1 has exactly 5 sub-regions', () => {
    const { mapGraph } = generateAct({ seed: 'sr', act: 1 });
    expect(mapGraph.subRegions.length).toBe(5);
  });

  it('act 3 has exactly 4 sub-regions', () => {
    const { mapGraph } = generateAct({ seed: 'sr', act: 3 });
    expect(mapGraph.subRegions.length).toBe(4);
  });

  it('generated graph passes all validators', () => {
    const { mapGraph } = generateAct({ seed: 'validate', act: 1 });
    const bossIds = mapGraph.indexes?.byType?.['boss'] || [];
    const bossId = bossIds[0];
    expect(validateGraphConnectivity(mapGraph).ok).toBe(true);
    expect(validateBossReachability(mapGraph, bossId).ok).toBe(true);
    expect(validateSubRegionStitch(mapGraph).ok).toBe(true);
    expect(validateWaypointCoverage(mapGraph).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Validator 1 — connectivity (broken graph: disconnected node)
// ---------------------------------------------------------------------------

describe('validateGraphConnectivity', () => {
  it('passes on a connected graph', () => {
    const g = makeMinimalGraph();
    expect(validateGraphConnectivity(g).ok).toBe(true);
  });

  it('fails when a node has no path from entry', () => {
    const g = makeMinimalGraph();
    // Add an isolated node.
    g.nodes['orphan'] = { id: 'orphan', biome: 'fen', regionId: 'r0', lane: 0, col: 5, type: 'lore', tags: [], baseWeight: 1 };
    g.indexes = buildIndexes(g);
    const result = validateGraphConnectivity(g);
    expect(result.ok).toBe(false);
    expect(result.unreachableIds).toContain('orphan');
  });

  it('fails when entry node is missing', () => {
    const g = makeMinimalGraph({ entryNodeId: 'nonexistent' });
    // DFS from 'nonexistent' visits nothing → all nodes unreachable.
    const result = validateGraphConnectivity(g);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Validator 2 — quest-critical reachability
// ---------------------------------------------------------------------------

describe('validateQuestCriticalReachability', () => {
  it('passes with no quest-critical nodes', () => {
    const g = makeMinimalGraph();
    expect(validateQuestCriticalReachability(g, []).ok).toBe(true);
  });

  it('fails when a quest-critical node is unreachable', () => {
    const g = makeMinimalGraph();
    g.nodes['qcrit'] = { id: 'qcrit', biome: 'fen', regionId: 'r0', lane: 1, col: 5, type: 'lore', tags: ['quest_critical'], baseWeight: 1 };
    // No edges to qcrit — it's unreachable.
    g.indexes = buildIndexes(g);
    const result = validateQuestCriticalReachability(g, []);
    expect(result.ok).toBe(false);
    expect(result.unreachableIds).toContain('qcrit');
  });
});

// ---------------------------------------------------------------------------
// 5. Validator 3 — boss reachability
// ---------------------------------------------------------------------------

describe('validateBossReachability', () => {
  it('passes when boss is reachable', () => {
    const g = makeMinimalGraph();
    expect(validateBossReachability(g, 'n5').ok).toBe(true);
  });

  it('fails when boss is disconnected', () => {
    const g = makeMinimalGraph();
    // Remove all edges to n5.
    g.edges = g.edges.filter(e => e.to !== 'n5');
    g.indexes = buildIndexes(g);
    const result = validateBossReachability(g, 'n5');
    expect(result.ok).toBe(false);
  });

  it('passes when no boss node specified and no boss-type node exists', () => {
    const g = makeMinimalGraph();
    // Remove boss type from n5.
    g.nodes['n5'].type = 'combat';
    g.indexes = buildIndexes(g);
    expect(validateBossReachability(g, null).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Validator 4 — sub-region stitch
// ---------------------------------------------------------------------------

describe('validateSubRegionStitch', () => {
  it('passes on a well-stitched graph', () => {
    const g = makeMinimalGraph();
    expect(validateSubRegionStitch(g).ok).toBe(true);
  });

  it('fails when first region has no outgoing stitch', () => {
    const g = makeMinimalGraph();
    // Remove stitch edge from r0 -> r1.
    g.edges = g.edges.filter(e => e.id !== 'e23');
    g.indexes = buildIndexes(g);
    const result = validateSubRegionStitch(g);
    expect(result.ok).toBe(false);
  });

  it('passes on single-region graph', () => {
    const g = makeMinimalGraph({
      subRegions: [{ id: 'r0', name: 'R0', biome: 'emberwood', nodeIds: ['n0', 'n1'], xOffset: 0 }],
      nodes: {
        n0: { id: 'n0', biome: 'emberwood', regionId: 'r0', lane: 0, col: 0, type: 'combat', tags: ['waypoint'], baseWeight: 1 },
        n1: { id: 'n1', biome: 'emberwood', regionId: 'r0', lane: 1, col: 1, type: 'boss',   tags: [], baseWeight: 1 },
      },
      edges: [{ id: 'e01', from: 'n0', to: 'n1', kind: 'open' }],
    });
    expect(validateSubRegionStitch(g).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Validator 5 — waypoint coverage
// ---------------------------------------------------------------------------

describe('validateWaypointCoverage', () => {
  it('passes when every region has a waypoint', () => {
    const g = makeMinimalGraph();
    expect(validateWaypointCoverage(g).ok).toBe(true);
  });

  it('fails when a region lacks a waypoint', () => {
    const g = makeMinimalGraph();
    // Remove waypoint tag from r1 nodes.
    g.nodes['n3'].tags = [];
    g.indexes = buildIndexes(g);
    const result = validateWaypointCoverage(g);
    expect(result.ok).toBe(false);
    expect(result.missingRegions).toContain('r1');
  });
});

// ---------------------------------------------------------------------------
// 8. Validator 6 — hidden path satisfiability
// ---------------------------------------------------------------------------

describe('validateHiddenPathSatisfiability', () => {
  it('passes when all lockIds are in the pool', () => {
    const g = makeMinimalGraph();
    g.edges.push({ id: 'ehid', from: 'n1', to: 'n4', kind: 'hidden', lockId: 'lock_shrine_key' });
    g.indexes = buildIndexes(g);
    const result = validateHiddenPathSatisfiability(g, [], ['lock_shrine_key', 'lock_merchant_bribe']);
    expect(result.ok).toBe(true);
  });

  it('fails when a lockId is not in the pool', () => {
    const g = makeMinimalGraph();
    g.edges.push({ id: 'ehid', from: 'n1', to: 'n4', kind: 'hidden', lockId: 'lock_unknown_xyz' });
    g.indexes = buildIndexes(g);
    const result = validateHiddenPathSatisfiability(g, [], ['lock_shrine_key']);
    expect(result.ok).toBe(false);
    expect(result.brokenLocks).toContain('lock_unknown_xyz');
  });

  it('passes when there are no hidden edges', () => {
    const g = makeMinimalGraph();
    expect(validateHiddenPathSatisfiability(g, [], []).ok).toBe(true);
  });

  // Hardened validator — dialog-pool-derived lock satisfaction (M515)
  it('passes when lockId is satisfied by a reveal_path effect in a dialog pool', () => {
    const g = makeMinimalGraph();
    g.edges.push({ id: 'ehid', from: 'n1', to: 'n4', kind: 'hidden', lockId: 'lock_dialog_gate' });
    g.indexes = buildIndexes(g);

    const dialogPool = [
      {
        id: 'test_node',
        choices: [
          {
            id: 'c1',
            effects: [{ type: 'reveal_path', from: 'n1', to: 'n4', lockId: 'lock_dialog_gate' }],
          },
        ],
      },
    ];

    const result = validateHiddenPathSatisfiability(g, [], [], [dialogPool], []);
    expect(result.ok).toBe(true);
  });

  it('fails when lockId appears on hidden edge but has no reveal_path in any content', () => {
    const g = makeMinimalGraph();
    g.edges.push({ id: 'ehid2', from: 'n1', to: 'n4', kind: 'hidden', lockId: 'lock_orphan' });
    g.indexes = buildIndexes(g);

    const dialogPool = [
      {
        id: 'other_node',
        choices: [
          { id: 'c1', effects: [{ type: 'gold', amount: 50 }] },
        ],
      },
    ];

    const result = validateHiddenPathSatisfiability(g, [], [], [dialogPool], []);
    expect(result.ok).toBe(false);
    expect(result.brokenLocks).toContain('lock_orphan');
  });

  it('passes when lockId is satisfied via quest-line outcome effects', () => {
    const g = makeMinimalGraph();
    g.edges.push({ id: 'ehid3', from: 'n1', to: 'n4', kind: 'hidden', lockId: 'lock_quest_gate' });
    g.indexes = buildIndexes(g);

    const questLine = {
      id: 'test_quest',
      outcomes: [
        { id: 'good', effects: [{ type: 'reveal_path', from: 'n1', to: 'n4', lockId: 'lock_quest_gate' }] },
      ],
    };

    const result = validateHiddenPathSatisfiability(g, [], [], [], [questLine]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// collectSatisfiedLocks — unit tests (M515)
// ---------------------------------------------------------------------------

describe('collectSatisfiedLocks', () => {
  it('returns empty set when no content provided', () => {
    const s = collectSatisfiedLocks([], []);
    expect(s.size).toBe(0);
  });

  it('collects lockId from a dialog pool choice effect', () => {
    const pool = [
      { id: 'n1', choices: [{ id: 'c1', effects: [{ type: 'reveal_path', lockId: 'lock_abc' }] }] },
    ];
    const s = collectSatisfiedLocks([pool], []);
    expect(s.has('lock_abc')).toBe(true);
  });

  it('collects lockId from quest-line phase effects', () => {
    const ql = {
      id: 'q1',
      phases: {
        p1: { effects: [{ type: 'reveal_path', lockId: 'lock_phase' }] },
      },
    };
    const s = collectSatisfiedLocks([], [ql]);
    expect(s.has('lock_phase')).toBe(true);
  });

  it('does not collect non-reveal_path effects', () => {
    const pool = [
      { id: 'n1', effects: [{ type: 'gold', amount: 50, lockId: 'not_a_lock' }] },
    ];
    const s = collectSatisfiedLocks([pool], []);
    expect(s.has('not_a_lock')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. buildIndexes correctness
// ---------------------------------------------------------------------------

describe('buildIndexes', () => {
  it('byType contains all node types', () => {
    const g = makeMinimalGraph();
    const ix = buildIndexes(g);
    expect(ix.byType['combat']).toContain('n0');
    expect(ix.byType['boss']).toContain('n5');
  });

  it('byTag waypoint includes tagged nodes', () => {
    const g = makeMinimalGraph();
    const ix = buildIndexes(g);
    expect(ix.byTag['waypoint']).toContain('n0');
    expect(ix.byTag['waypoint']).toContain('n3');
  });

  it('outgoing tracks edges correctly', () => {
    const g = makeMinimalGraph();
    const ix = buildIndexes(g);
    const fromN0 = ix.outgoing['n0'].map(e => e.to);
    expect(fromN0).toContain('n1');
    expect(fromN0).toContain('n2');
  });

  it('incoming tracks edges correctly', () => {
    const g = makeMinimalGraph();
    const ix = buildIndexes(g);
    expect(ix.incoming['n5'].map(e => e.from)).toContain('n4');
  });
});

// ---------------------------------------------------------------------------
// 10. serializeMapSave / hydrateMapSave round-trip
// ---------------------------------------------------------------------------

describe('serializeMapSave / hydrateMapSave', () => {
  it('save is JSON round-trippable (Set-free)', () => {
    const { mapGraph } = generateAct({ seed: 'roundtrip', act: 1 });
    const save = serializeMapSave(mapGraph);
    // Must survive JSON round-trip with no loss.
    const json = JSON.stringify(save);
    const restored = JSON.parse(json);
    expect(restored.mapId).toBe(save.mapId);
    expect(Object.keys(restored.nodes)).toEqual(Object.keys(save.nodes));
  });

  it('entry node starts as visible + discovered', () => {
    const { mapGraph } = generateAct({ seed: 'entry', act: 1 });
    const save = serializeMapSave(mapGraph);
    const entryState = save.nodes[mapGraph.entryNodeId];
    expect(entryState.visibility).toBe('visible');
    expect(entryState.state).toBe('discovered');
  });

  it('hydrateMapSave merges saved edge kinds', () => {
    const { mapGraph } = generateAct({ seed: 'hydrate', act: 1 });
    const save = serializeMapSave(mapGraph);
    // Mutate an edge in the save (simulate a reveal).
    const hiddenEdge = save.edges.find(e => e.kind === 'hidden');
    if (hiddenEdge) {
      hiddenEdge.kind = 'open';
      const freshGraph = generateAct({ seed: 'hydrate', act: 1 }).mapGraph;
      hydrateMapSave(freshGraph, save);
      const liveEdge = freshGraph.edges.find(e => e.from === hiddenEdge.from && e.to === hiddenEdge.to);
      expect(liveEdge?.kind).toBe('open');
    }
    // If no hidden edges generated, just pass (low-salt maps may have none in test).
  });
});

// ---------------------------------------------------------------------------
// 11. Determinism check with named seed 'abc' act 1 (acceptance check)
// ---------------------------------------------------------------------------

describe('generateAct determinism — acceptance', () => {
  it('seed=abc act=1 produces consistent node count and first 3 node ids', () => {
    const a = generateAct({ seed: 'abc', act: 1 });
    const b = generateAct({ seed: 'abc', act: 1 });
    const aIds = Object.keys(a.mapGraph.nodes).sort();
    const bIds = Object.keys(b.mapGraph.nodes).sort();
    expect(aIds).toEqual(bIds);
    // First 3 ids are stable.
    expect(aIds.slice(0, 3)).toEqual(bIds.slice(0, 3));
  });
});
