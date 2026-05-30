/**
 * mapMutations.test.js — Tests for storyMapMutations.js (M-S07).
 *
 * Coverage:
 *  - revealPath: hidden -> open, lockId recorded in revealedPaths
 *  - blockPath: open -> blocked
 *  - revealNodesByTag: reveals correct nodes up to count
 *  - mutateNode: overlay stored, worldCorruption side-effect
 *  - unlockTransition: sets story.flags['transition_<id>']
 *  - setWaypointState: legal transitions pass, illegal rejected (console.warn)
 *  - applyWorldMutation: records in worldMutations, disable_waypoint special form
 *  - gs.story.maps survives JSON.parse(JSON.stringify(gs)) round-trip
 */

import { describe, it, expect, vi } from 'vitest';
import {
  revealPath,
  blockPath,
  revealNodesByTag,
  mutateNode,
  unlockTransition,
  setWaypointState,
  applyWorldMutation,
} from '../storyMapMutations.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGs(overrides = {}) {
  const story = {
    currentMapId: 'test_map',
    flags: {},
    worldMutations: [],
    worldCorruption: 0,
    maps: {
      test_map: {
        mapId: 'test_map',
        nodes: {
          n0: { state: 'discovered', visibility: 'visible', waypointState: 'unexplored', tags: ['waypoint'] },
          n1: { state: 'unexplored', visibility: 'hidden',  waypointState: null,         tags: ['lore'] },
          n2: { state: 'unexplored', visibility: 'hidden',  waypointState: null,         tags: ['lore'] },
          n3: { state: 'unexplored', visibility: 'hidden',  waypointState: 'discovered', tags: [] },
          boss: { state: 'unexplored', visibility: 'hidden', waypointState: null,        tags: [] },
        },
        edges: [
          { from: 'n0', to: 'n1', kind: 'open' },
          { from: 'n0', to: 'n2', kind: 'hidden', lockId: 'lock_shrine_key' },
          { from: 'n1', to: 'n3', kind: 'open' },
          { from: 'n2', to: 'boss', kind: 'open' },
        ],
        revealedPaths: [],
        regionWeather: {},
        nodeOverlays: {},
      },
    },
    ...overrides.story,
  };
  return { story, ...overrides };
}

// ---------------------------------------------------------------------------
// revealPath
// ---------------------------------------------------------------------------

describe('revealPath', () => {
  it('flips a hidden edge to open', () => {
    const gs = makeGs();
    const result = revealPath(gs, 'n0', 'n2');
    expect(result).toBe(true);
    const edge = gs.story.maps.test_map.edges.find(e => e.from === 'n0' && e.to === 'n2');
    expect(edge.kind).toBe('open');
  });

  it('records the lockId in revealedPaths', () => {
    const gs = makeGs();
    revealPath(gs, 'n0', 'n2');
    expect(gs.story.maps.test_map.revealedPaths).toContain('lock_shrine_key');
  });

  it('returns false for an already-open edge', () => {
    const gs = makeGs();
    const result = revealPath(gs, 'n0', 'n1');
    expect(result).toBe(false);
  });

  it('returns false and warns when edge not found', () => {
    const gs = makeGs();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = revealPath(gs, 'n0', 'nonexistent');
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns false and warns when no current map', () => {
    const gs = makeGs({ story: { currentMapId: null } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = revealPath(gs, 'n0', 'n1');
    expect(result).toBe(false);
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// blockPath
// ---------------------------------------------------------------------------

describe('blockPath', () => {
  it('flips an open edge to blocked', () => {
    const gs = makeGs();
    const result = blockPath(gs, 'n0', 'n1');
    expect(result).toBe(true);
    const edge = gs.story.maps.test_map.edges.find(e => e.from === 'n0' && e.to === 'n1');
    expect(edge.kind).toBe('blocked');
  });

  it('returns false for a hidden edge (can only block open)', () => {
    const gs = makeGs();
    const result = blockPath(gs, 'n0', 'n2'); // hidden
    expect(result).toBe(false);
  });

  it('returns false and warns when edge not found', () => {
    const gs = makeGs();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = blockPath(gs, 'boss', 'missing');
    expect(result).toBe(false);
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// revealNodesByTag
// ---------------------------------------------------------------------------

describe('revealNodesByTag', () => {
  it('reveals up to count nodes with matching tag', () => {
    const gs = makeGs();
    const revealed = revealNodesByTag(gs, 'lore', 1);
    expect(revealed.length).toBe(1);
    // The revealed node should be visible now.
    const nodeState = gs.story.maps.test_map.nodes[revealed[0]];
    expect(nodeState.visibility).toBe('revealed');
  });

  it('reveals at most count nodes', () => {
    const gs = makeGs();
    const revealed = revealNodesByTag(gs, 'lore', 1);
    // Only 1 lore node revealed even if 2 exist.
    expect(revealed.length).toBe(1);
  });

  it('skips already-visible nodes', () => {
    const gs = makeGs();
    gs.story.maps.test_map.nodes.n1.visibility = 'visible';
    const revealed = revealNodesByTag(gs, 'lore', 2);
    // n1 was already visible; only n2 is hidden + lore.
    expect(revealed).not.toContain('n1');
  });

  it('returns empty array when no matching tag', () => {
    const gs = makeGs();
    const revealed = revealNodesByTag(gs, 'no_such_tag', 10);
    expect(revealed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mutateNode
// ---------------------------------------------------------------------------

describe('mutateNode', () => {
  it('stores overlay in nodeOverlays and nodes[id].overlay', () => {
    const gs = makeGs();
    mutateNode(gs, 'n0', 'blessed');
    expect(gs.story.maps.test_map.nodeOverlays['n0']).toBe('blessed');
    expect(gs.story.maps.test_map.nodes['n0'].overlay).toBe('blessed');
  });

  it('corrupted overlay adds +5 worldCorruption', () => {
    const gs = makeGs();
    gs.story.worldCorruption = 10;
    mutateNode(gs, 'n1', 'corrupted');
    expect(gs.story.worldCorruption).toBe(15);
  });

  it('cleansed overlay subtracts 3 worldCorruption (clamp 0)', () => {
    const gs = makeGs();
    gs.story.worldCorruption = 2;
    mutateNode(gs, 'n1', 'cleansed');
    expect(gs.story.worldCorruption).toBe(0); // clamped at 0
  });

  it('corruption clamped at 100', () => {
    const gs = makeGs();
    gs.story.worldCorruption = 98;
    mutateNode(gs, 'n1', 'corrupted');
    expect(gs.story.worldCorruption).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// unlockTransition
// ---------------------------------------------------------------------------

describe('unlockTransition', () => {
  it('sets the transition flag', () => {
    const gs = makeGs();
    unlockTransition(gs, 'act2_map');
    expect(gs.story.flags['transition_act2_map']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setWaypointState — legal transitions
// ---------------------------------------------------------------------------

describe('setWaypointState — legal transitions', () => {
  it('unexplored -> discovered', () => {
    const gs = makeGs();
    setWaypointState(gs, 'n0', 'discovered');
    expect(gs.story.maps.test_map.nodes['n0'].waypointState).toBe('discovered');
  });

  it('discovered -> activated', () => {
    const gs = makeGs();
    gs.story.maps.test_map.nodes['n0'].waypointState = 'discovered';
    setWaypointState(gs, 'n0', 'activated');
    expect(gs.story.maps.test_map.nodes['n0'].waypointState).toBe('activated');
  });

  it('activated -> corrupted', () => {
    const gs = makeGs();
    gs.story.maps.test_map.nodes['n0'].waypointState = 'activated';
    setWaypointState(gs, 'n0', 'corrupted');
    expect(gs.story.maps.test_map.nodes['n0'].waypointState).toBe('corrupted');
  });

  it('corrupted -> activated (purify)', () => {
    const gs = makeGs();
    gs.story.maps.test_map.nodes['n0'].waypointState = 'corrupted';
    setWaypointState(gs, 'n0', 'activated');
    expect(gs.story.maps.test_map.nodes['n0'].waypointState).toBe('activated');
  });

  it('n3 discovered -> activated (direct)', () => {
    const gs = makeGs();
    // n3 has waypointState: 'discovered' by default in makeGs.
    setWaypointState(gs, 'n3', 'activated');
    expect(gs.story.maps.test_map.nodes['n3'].waypointState).toBe('activated');
  });
});

// ---------------------------------------------------------------------------
// setWaypointState — illegal transitions (console.warn, no mutation)
// ---------------------------------------------------------------------------

describe('setWaypointState — illegal transitions', () => {
  it('rejects unexplored -> activated (must go through discovered)', () => {
    const gs = makeGs();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setWaypointState(gs, 'n0', 'activated');
    expect(gs.story.maps.test_map.nodes['n0'].waypointState).toBe('unexplored');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects disabled -> anything', () => {
    const gs = makeGs();
    gs.story.maps.test_map.nodes['n0'].waypointState = 'disabled';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setWaypointState(gs, 'n0', 'discovered');
    expect(gs.story.maps.test_map.nodes['n0'].waypointState).toBe('disabled');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns when node not in save', () => {
    const gs = makeGs();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setWaypointState(gs, 'ghost_node', 'discovered');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// applyWorldMutation
// ---------------------------------------------------------------------------

describe('applyWorldMutation', () => {
  it('records mutation in worldMutations', () => {
    const gs = makeGs();
    applyWorldMutation(gs, 'den_mother_alive');
    expect(gs.story.worldMutations).toContain('den_mother_alive');
  });

  it('is idempotent (setUniquePush — no duplicates)', () => {
    const gs = makeGs();
    applyWorldMutation(gs, 'den_mother_alive');
    applyWorldMutation(gs, 'den_mother_alive');
    const count = gs.story.worldMutations.filter(m => m === 'den_mother_alive').length;
    expect(count).toBe(1);
  });

  it('disable_waypoint:<nodeId> forces waypointState to disabled', () => {
    const gs = makeGs();
    gs.story.maps.test_map.nodes['n0'].waypointState = 'activated';
    applyWorldMutation(gs, 'disable_waypoint:n0');
    expect(gs.story.maps.test_map.nodes['n0'].waypointState).toBe('disabled');
  });
});

// ---------------------------------------------------------------------------
// JSON round-trip — gs.story.maps survives serialization (Set-free contract)
// ---------------------------------------------------------------------------

describe('gs.story.maps — JSON round-trip', () => {
  it('mutations survive JSON.parse(JSON.stringify(gs))', () => {
    const gs = makeGs();
    revealPath(gs, 'n0', 'n2');
    blockPath(gs, 'n0', 'n1');
    mutateNode(gs, 'n0', 'corrupted');
    unlockTransition(gs, 'act2_map');
    setWaypointState(gs, 'n0', 'discovered');
    applyWorldMutation(gs, 'den_mother_alive');

    const json     = JSON.stringify(gs);
    const restored = JSON.parse(json);

    // All mutations persisted.
    const save = restored.story.maps.test_map;
    expect(save.edges.find(e => e.from === 'n0' && e.to === 'n2').kind).toBe('open');
    expect(save.edges.find(e => e.from === 'n0' && e.to === 'n1').kind).toBe('blocked');
    expect(save.nodeOverlays['n0']).toBe('corrupted');
    expect(restored.story.flags['transition_act2_map']).toBe(true);
    expect(save.nodes['n0'].waypointState).toBe('discovered');
    expect(restored.story.worldMutations).toContain('den_mother_alive');
  });
});
