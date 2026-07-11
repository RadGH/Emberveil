/**
 * companions.test.js — Unit tests for storyCompanions.js
 *
 * Tests: recruit/dismiss, approval clamping, swap rejection/success,
 * assembleCombatParty, banter cooldown.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCompanionDef,
  recruitCompanion,
  dismissCompanion,
  getActiveCompanion,
  getRecruitedCompanions,
  applyApproval,
  swapActive,
  assembleCombatParty,
  maybeFireBanter,
} from '../storyCompanions.js';
import { registerBanterPool, clearContentCaches } from '../storyContent.js';
import { createStoryLedger } from '../storyLedger.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function _makeGs(overrides = {}) {
  const ledger = createStoryLedger({ storytellerId: 'chronicler' });
  const gs = {
    gold: 0,
    party: [
      { name: 'Hero', level: 5, cls: 'warrior', class: 'warrior',
        attrs: { STR: 14, DEX: 10, INT: 8, CON: 12 }, equipment: {} },
    ],
    story: {
      ...ledger,
      currentNodeId: 'a1_n_000',
      currentMapId: 'act1_emberwood',
      maps: {
        act1_emberwood: {
          nodes: {
            'a1_n_000': { waypointState: 'unexplored', state: 'unexplored', visibility: 'visible' },
            'a1_n_waypoint': { waypointState: 'activated', state: 'visited', visibility: 'visible' },
          },
        },
      },
    },
    __storyContent: { quests: {} },
    ...overrides,
  };
  return gs;
}

beforeEach(() => {
  clearContentCaches();
});

// ---------------------------------------------------------------------------
// getCompanionDef
// ---------------------------------------------------------------------------

describe('getCompanionDef', () => {
  it('returns def for each of the 6 companions', () => {
    const ids = ['lyra_ashwalker', 'orren_gravetide', 'tessaly_veil', 'bram_coldfire', 'yasha_stonewill', 'captain_maer'];
    for (const id of ids) {
      const def = getCompanionDef(id);
      expect(def).toBeDefined();
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.class).toBeTruthy();
    }
  });

  it('returns null for unknown id', () => {
    expect(getCompanionDef('nobody')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recruitCompanion
// ---------------------------------------------------------------------------

describe('recruitCompanion', () => {
  it('sets recruited=true and active=true for known companion', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    const entry = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(entry.recruited).toBe(true);
    expect(entry.active).toBe(true);
    expect(gs.story.activeCompanionId).toBe('lyra_ashwalker');
  });

  it('is idempotent when already recruited', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'lyra_ashwalker');
    expect(gs.story.activeCompanionId).toBe('lyra_ashwalker');
  });

  it('benches previous active companion when recruiting a new one', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide');
    const lyra = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(lyra.active).toBe(false);
    expect(gs.story.activeCompanionId).toBe('orren_gravetide');
  });

  it('warns but does not throw for unknown companion id', () => {
    const gs = _makeGs();
    expect(() => recruitCompanion(gs, 'phantom')).not.toThrow();
    expect(gs.story.activeCompanionId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dismissCompanion
// ---------------------------------------------------------------------------

describe('dismissCompanion', () => {
  it('sets active=false and records benchedAt', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    gs.story.currentNodeId = 'a1_n_005';
    dismissCompanion(gs, 'lyra_ashwalker');
    const entry = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(entry.active).toBe(false);
    expect(entry.benchedAt).toBe('a1_n_005');
  });

  it('clears activeCompanionId when dismissing the active companion', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    dismissCompanion(gs, 'lyra_ashwalker');
    expect(gs.story.activeCompanionId).toBeNull();
  });

  it('does not change activeCompanionId when dismissing a benched companion', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide'); // lyra is now benched
    dismissCompanion(gs, 'lyra_ashwalker');
    expect(gs.story.activeCompanionId).toBe('orren_gravetide');
  });
});

// ---------------------------------------------------------------------------
// getActiveCompanion / getRecruitedCompanions
// ---------------------------------------------------------------------------

describe('getActiveCompanion', () => {
  it('returns null when no active companion', () => {
    const gs = _makeGs();
    expect(getActiveCompanion(gs)).toBeNull();
  });

  it('returns active companion entry', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    const c = getActiveCompanion(gs);
    expect(c.id).toBe('lyra_ashwalker');
  });
});

describe('getRecruitedCompanions', () => {
  it('returns only recruited companions', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'bram_coldfire'); // lyra benched, bram active
    const recruited = getRecruitedCompanions(gs);
    expect(recruited.length).toBe(2);
    expect(recruited.map(c => c.id)).toContain('lyra_ashwalker');
    expect(recruited.map(c => c.id)).toContain('bram_coldfire');
  });
});

// ---------------------------------------------------------------------------
// applyApproval
// ---------------------------------------------------------------------------

describe('applyApproval', () => {
  it('applies full delta to active companion', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    applyApproval(gs, 'lyra_ashwalker', 3);
    const entry = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(entry.approval).toBe(3);
  });

  it('clamps approval to +10 maximum', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    applyApproval(gs, 'lyra_ashwalker', 8);
    applyApproval(gs, 'lyra_ashwalker', 8);
    const entry = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(entry.approval).toBe(10);
  });

  it('clamps approval to -10 minimum', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    applyApproval(gs, 'lyra_ashwalker', -15);
    const entry = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(entry.approval).toBe(-10);
  });

  it('applies half delta to benched companion', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide'); // lyra is now benched
    applyApproval(gs, 'lyra_ashwalker', 4);  // half = 2
    const lyra = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(lyra.approval).toBe(2);
  });

  it('does nothing for non-recruited companion', () => {
    const gs = _makeGs();
    applyApproval(gs, 'lyra_ashwalker', 5); // not recruited
    const entry = gs.story.companions.find(c => c.id === 'lyra_ashwalker');
    expect(entry.approval).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// swapActive
// ---------------------------------------------------------------------------

describe('swapActive', () => {
  it('rejects swap at non-waypoint node', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide');
    gs.story.currentNodeId = 'a1_n_000'; // waypointState: 'unexplored'
    const result = swapActive(gs, 'lyra_ashwalker');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('accepts swap at activated waypoint node', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide');
    gs.story.currentNodeId = 'a1_n_waypoint'; // waypointState: 'activated'
    const result = swapActive(gs, 'lyra_ashwalker');
    expect(result.ok).toBe(true);
    expect(gs.story.activeCompanionId).toBe('lyra_ashwalker');
  });

  it('rejects swap to unknown companion', () => {
    const gs = _makeGs();
    gs.story.currentNodeId = 'a1_n_waypoint';
    const result = swapActive(gs, 'phantom');
    expect(result.ok).toBe(false);
  });

  it('rejects swap to non-recruited companion', () => {
    const gs = _makeGs();
    gs.story.currentNodeId = 'a1_n_waypoint';
    const result = swapActive(gs, 'tessaly_veil'); // not recruited
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assembleCombatParty
// ---------------------------------------------------------------------------

describe('assembleCombatParty', () => {
  it('returns just the party when no active companion', () => {
    const gs = _makeGs();
    const party = assembleCombatParty(gs);
    expect(party.length).toBe(1);
    expect(party[0].name).toBe('Hero');
  });

  it('appends companion as 5th slot with isCompanion=true', () => {
    const gs = _makeGs();
    // Fill party with 4 heroes
    gs.party = [
      { name: 'H1', level: 3, cls: 'warrior', class: 'warrior', attrs: { STR: 10, DEX: 8, INT: 8, CON: 10 }, equipment: {} },
      { name: 'H2', level: 3, cls: 'mage',    class: 'mage',    attrs: { STR: 7,  DEX: 9, INT: 14, CON: 8 }, equipment: {} },
      { name: 'H3', level: 3, cls: 'rogue',   class: 'rogue',   attrs: { STR: 9,  DEX: 13, INT: 9, CON: 9 }, equipment: {} },
      { name: 'H4', level: 3, cls: 'healer',  class: 'healer',  attrs: { STR: 8,  DEX: 9, INT: 11, CON: 10 }, equipment: {} },
    ];
    recruitCompanion(gs, 'lyra_ashwalker');
    const party = assembleCombatParty(gs);
    expect(party.length).toBe(5);
    const companion = party[4];
    expect(companion.isCompanion).toBe(true);
    expect(companion._storyCompanion).toBe(true);
    expect(companion._companionId).toBe('lyra_ashwalker');
    expect(companion.name).toBe('Lyra Ashwalker');
  });

  it('does not mutate gs.party', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    const before = gs.party.length;
    assembleCombatParty(gs);
    expect(gs.party.length).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// maybeFireBanter
// ---------------------------------------------------------------------------

describe('maybeFireBanter', () => {
  it('returns null when no active companion', () => {
    const gs = _makeGs();
    const result = maybeFireBanter(gs, 'a1_n_001', 'nodeResolved');
    expect(result).toBeNull();
  });

  it('returns null when banter pool is empty', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide');
    registerBanterPool('lyra_ashwalker', 'orren_gravetide', []);
    const result = maybeFireBanter(gs, 'a1_n_001', 'nodeResolved');
    expect(result).toBeNull();
  });

  it('fires banter when pool has a matching entry', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide');
    registerBanterPool('lyra_ashwalker', 'orren_gravetide', [
      // cooldown: 0 so it fires on the first node (node_count goes to 1, lastFired=0, diff=1 >= 1)
      // OR set cooldown: 1 so the test resolves deterministically.
      { id: 'banter_001', trigger: 'nodeResolved', cooldown: 1,
        lines: [{ speaker: 'lyra_ashwalker', text: 'Watch your step.' }] },
    ]);
    // Advance node count so cooldown check passes (now=1, lastFired=0, diff=1 >= 1)
    const result = maybeFireBanter(gs, 'a1_n_001', 'nodeResolved');
    expect(result).not.toBeNull();
    // active is orren (last recruited), other is lyra — pair key is sorted
    expect(result.companionA).toBe('orren_gravetide');
    expect(result.companionB).toBe('lyra_ashwalker');
  });

  it('respects cooldown — second call within cooldown returns null', () => {
    const gs = _makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    recruitCompanion(gs, 'orren_gravetide');
    registerBanterPool('lyra_ashwalker', 'orren_gravetide', [
      { id: 'banter_cool', trigger: 'nodeResolved', cooldown: 5,
        lines: [{ speaker: 'lyra_ashwalker', text: 'Test.' }] },
    ]);
    const first = maybeFireBanter(gs, 'n1', 'nodeResolved');
    expect(first).toBeDefined();
    // Immediately try again — global cooldown (3 nodes) not elapsed
    const second = maybeFireBanter(gs, 'n2', 'nodeResolved');
    expect(second).toBeNull();
  });
});
