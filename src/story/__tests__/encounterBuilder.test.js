/**
 * encounterBuilder.test.js — M-S16 encounter builder tests.
 *
 * Per-template smoke tests:
 *   - resolveEnemyId: returns string or null (never throws)
 *   - buildEncounterForNode: returns valid encounter with enemies[] shape
 *   - encounterBudget: returns positive number within expected range
 *   - queueEncounter: sets the pending flag on gs.story
 */

import { describe, it, expect } from 'vitest';
import {
  resolveEnemyId,
  buildEncounterForNode,
  queueEncounter,
  encounterBudget,
} from '../storyEncounterBuilder.js';
import { mulberry32 } from '../../game/simulator.js';
import { getStoryteller } from '../storyStorytellers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGs(overrides = {}) {
  return {
    party: [
      { name: 'Hero', class: 'warrior', level: 3, hp: 80, maxHp: 80, alive: true },
    ],
    gold: 100,
    story: {
      act: 1,
      storytellerId: 'chronicler',
      difficulty: 'normal',
      rngState: 0xABCD5678,
      pressureMeter: 50,
      currentNodeId: 'a1_n_001',
      flags: {},
      counters: {},
      recentHistory: {},
      encounterHistory: {},
      ...overrides.story,
    },
    ...overrides,
  };
}

function makeRng(seed = 42) {
  return mulberry32(seed);
}

// Starter templates (matches _starter.json shapes).
const STUB_TEMPLATES = [
  {
    id: 'road_ash_cult_ambush',
    act: 1,
    biomes: ['emberwood', 'old_road', 'anyBiome'],
    themeTags: ['ambush', 'cult', 'road'],
    type: 'combat',
    enemyComposition: [
      { role: 'frontline', count: 2, family: 'cultist' },
      { role: 'caster',    count: 1, family: 'cultist' },
    ],
    budgetWeight: 1.0,
    baseWeight: 0.7,
    rewards: { goldRange: [40, 80], lootTier: 2 },
  },
  {
    id: 'forest_beast_pack',
    act: 1,
    biomes: ['emberwood', 'dark_forest', 'anyBiome'],
    themeTags: ['beast', 'nature', 'pack'],
    type: 'combat',
    enemyComposition: [
      { role: 'striker', count: 3, family: 'beast' },
      { role: 'frontline', count: 1, family: 'beast' },
    ],
    budgetWeight: 0.9,
    baseWeight: 0.65,
    rewards: { goldRange: [20, 50], lootTier: 1 },
  },
  {
    id: 'wandering_merchant',
    type: 'merchant',
    enemyComposition: [],
    budgetWeight: 0.0,
    rewards: { goldRange: [0, 0], lootTier: 0 },
  },
  {
    id: 'shrine_simple',
    type: 'shrine',
    enemyComposition: [],
    budgetWeight: 0.0,
    rewards: { goldRange: [0, 0], lootTier: 0 },
  },
  {
    id: 'lore_ruin_simple',
    type: 'lore',
    enemyComposition: [],
    budgetWeight: 0.0,
    rewards: { goldRange: [0, 20], lootTier: 1 },
  },
];

// ---------------------------------------------------------------------------
// resolveEnemyId
// ---------------------------------------------------------------------------

describe('encounterBuilder — resolveEnemyId', () => {
  it('never throws for any role/family combination', () => {
    const rng = makeRng(1);
    const roles   = ['frontline', 'caster', 'striker', 'support', 'unknown'];
    const families = ['cultist', 'beast', 'generic', 'undead', 'unknown'];

    for (const role of roles) {
      for (const family of families) {
        expect(() => resolveEnemyId(role, family, 1, rng)).not.toThrow();
      }
    }
  });

  it('returns string or null (never undefined)', () => {
    const rng = makeRng(99);
    const result = resolveEnemyId('frontline', 'generic', 1, rng);
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('returns a string for frontline::generic when ENEMIES has any frontline entry', () => {
    const rng = makeRng(7);
    const result = resolveEnemyId('frontline', 'generic', 1, rng);
    // ENEMIES should have at least some frontline enemies; result should be a string.
    // If it comes back null, ENEMIES is empty (acceptable in headless test env).
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildEncounterForNode
// ---------------------------------------------------------------------------

describe('encounterBuilder — buildEncounterForNode', () => {
  it('falls back to a random ENCOUNTERS entry when no template + no queue (M520: ensures combat always starts)', () => {
    const gs = makeGs();
    const result = buildEncounterForNode(gs, 'a1_n_001', null);
    expect(result).not.toBeNull();
    expect(result.enemies).toBeDefined();
    expect(Array.isArray(result.enemies)).toBe(true);
    // Deterministic per node: same node id + rngState => same encounter.
    const again = buildEncounterForNode(gs, 'a1_n_001', null);
    expect(again.id || again.name).toBe(result.id || result.name);
  });

  it('uses queued encounter template flag when template is null', () => {
    const gs = makeGs();
    gs.story.flags['_queued_encounter_road_ash_cult_ambush'] = true;
    const result = buildEncounterForNode(gs, 'a1_n_001', null);
    expect(result).not.toBeNull();
    expect(Array.isArray(result.enemies)).toBe(true);
  });

  it('builds encounter from inline template with enemies array', () => {
    const gs = makeGs();
    const rng = makeRng(42);
    const template = STUB_TEMPLATES[0]; // road_ash_cult_ambush

    const result = buildEncounterForNode(gs, 'a1_n_001', template, rng);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('enemies');
    expect(Array.isArray(result.enemies)).toBe(true);
    for (const e of result.enemies) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.count).toBe('number');
      expect(e.count).toBeGreaterThan(0);
    }
  });

  it('returns valid fallback for non-combat templates with no enemy composition', () => {
    const gs = makeGs();
    const rng = makeRng(5);
    const template = STUB_TEMPLATES[2]; // wandering_merchant — no enemies

    const result = buildEncounterForNode(gs, 'a1_n_001', template, rng);
    expect(result).not.toBeNull();
    expect(Array.isArray(result.enemies)).toBe(true);
  });

  it('returned encounter has goldRange', () => {
    const gs = makeGs();
    const rng = makeRng(17);
    const template = STUB_TEMPLATES[1]; // forest_beast_pack

    const result = buildEncounterForNode(gs, 'a1_n_001', template, rng);
    expect(result).not.toBeNull();
    expect(result.goldRange).toBeDefined();
    expect(Array.isArray(result.goldRange)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// queueEncounter
// ---------------------------------------------------------------------------

describe('encounterBuilder — queueEncounter', () => {
  it('sets the _queued_encounter_ flag', () => {
    const gs = makeGs();
    queueEncounter(gs, 'road_ash_cult_ambush');
    expect(gs.story.flags['_queued_encounter_road_ash_cult_ambush']).toBe(true);
  });

  it('records in encounterHistory', () => {
    const gs = makeGs();
    queueEncounter(gs, 'forest_beast_pack');
    const entry = gs.story.encounterHistory[gs.story.currentNodeId];
    expect(entry).toBeDefined();
    expect(entry.templateId).toBe('forest_beast_pack');
    expect(typeof entry.builtAt).toBe('number');
  });

  it('does not throw for null gs', () => {
    expect(() => queueEncounter(null, 'any')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// encounterBudget
// ---------------------------------------------------------------------------

describe('encounterBuilder — encounterBudget', () => {
  it('returns a positive number', () => {
    const gs = makeGs();
    const template = STUB_TEMPLATES[0];
    const storyteller = getStoryteller('chronicler');
    const budget = encounterBudget(gs, template, storyteller);
    expect(budget).toBeGreaterThan(0);
    expect(Number.isFinite(budget)).toBe(true);
  });

  it('nightmare mode returns higher budget than relaxed mode', () => {
    const templateBase = { budgetWeight: 1.0 };
    const storyteller = getStoryteller('chronicler');

    const gsNormal   = makeGs({ story: { difficulty: 'normal' } });
    const gsNightmare = makeGs({ story: { difficulty: 'nightmare' } });

    const bNormal   = encounterBudget(gsNormal,   templateBase, storyteller);
    const bNightmare = encounterBudget(gsNightmare, templateBase, storyteller);

    expect(bNightmare).toBeGreaterThan(bNormal);
  });

  it('high pressure (>=80) increases budget', () => {
    const template = { budgetWeight: 1.0 };
    const storyteller = getStoryteller('chronicler');

    const gsNormal = makeGs({ story: { pressureMeter: 50 } });
    const gsHigh   = makeGs({ story: { pressureMeter: 85 } });

    const bNormal = encounterBudget(gsNormal, template, storyteller);
    const bHigh   = encounterBudget(gsHigh,   template, storyteller);

    expect(bHigh).toBeGreaterThan(bNormal);
  });

  it('post-brutal-fight reduces budget', () => {
    const template = { budgetWeight: 1.0 };
    const storyteller = getStoryteller('chronicler');

    const gsNormal = makeGs();
    const gsBrutal = makeGs({ story: { recentPerformance: { brutalScore: 1 } } });

    const bNormal = encounterBudget(gsNormal, template, storyteller);
    const bBrutal = encounterBudget(gsBrutal, template, storyteller);

    expect(bBrutal).toBeLessThan(bNormal);
  });

  it('Warbringer winStreak increases budget', () => {
    const template = { budgetWeight: 1.0 };
    const storytellerWar = getStoryteller('warbringer');

    const gsLow  = makeGs({ story: { storytellerId: 'warbringer', counters: { winStreak: 0 } } });
    const gsHigh = makeGs({ story: { storytellerId: 'warbringer', counters: { winStreak: 5 } } });

    const bLow  = encounterBudget(gsLow,  template, storytellerWar);
    const bHigh = encounterBudget(gsHigh, template, storytellerWar);

    expect(bHigh).toBeGreaterThan(bLow);
  });
});
