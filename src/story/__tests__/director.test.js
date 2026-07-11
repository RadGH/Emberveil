/**
 * director.test.js — M-S14 Director engine tests.
 *
 * Test coverage:
 *   1. 1000-random-state fuzz: getDirectorIntent never throws.
 *   2. Pressure band hard-override: Crisis forces crisis-tagged candidate within 3 ticks.
 *   3. Ringbuffer caps: arrays never exceed their caps.
 *   4. sameTypeStreak math: correct increment and reset.
 *   5. FALLBACK_CANDIDATE: fires when all candidates fail filter.
 *   6. forceIntent / inspectCandidates: debug API does not throw.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordTick,
  applyPressure,
  pressureBand,
  getDirectorIntent,
  stepDirector,
  inspectCandidates,
  forceIntent,
  FALLBACK_CANDIDATE,
} from '../storyDirector.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeGs(overrides = {}) {
  return {
    party: [{ name: 'Hero', class: 'warrior', level: 3, hp: 80, maxHp: 80, str: 14, dex: 10, int: 8, con: 12, alive: true }],
    gold: 100,
    story: {
      act: 1,
      storytellerId: 'chronicler',
      difficulty: 'normal',
      rngState: 0x1234ABCD,
      pressureMeter: 50,
      currentBiome: 'emberwood',
      currentNodeId: 'a1_n_001',
      flags: {},
      counters: {},
      factions: {},
      recentHistory: {
        nodeTypes: [], enemyFamilies: [], skillLabels: [],
        rewardTypes: [], biomes: [], tones: [],
        sameTypeStreak: 0, lastType: null,
      },
      ...overrides.story,
    },
    ...overrides,
  };
}

const STUB_CANDIDATES = [
  { id: 'combat_01', type: 'combat', biomes: ['anyBiome'], act: [1,2,3], themeTags: ['ambush'], baseWeight: 0.7, enemyFamily: 'cultist', budgetWeight: 1.0 },
  { id: 'dialog_01', type: 'dialog', biomes: ['anyBiome'], act: [1,2,3], themeTags: ['lore','investigation'], baseWeight: 0.6, budgetWeight: 0.0 },
  { id: 'lore_01',   type: 'lore',   biomes: ['anyBiome'], act: [1,2,3], themeTags: ['lore'], baseWeight: 0.55, budgetWeight: 0.0 },
  { id: 'shrine_01', type: 'shrine', biomes: ['anyBiome'], act: [1,2,3], themeTags: ['ancient'], baseWeight: 0.4, budgetWeight: 0.0 },
  { id: 'rest_01',   type: 'rest',   biomes: ['anyBiome'], act: [1,2,3], themeTags: [], baseWeight: 0.3, budgetWeight: 0.0 },
];

// Crisis candidate — has 'crisis' in themeTags.
const CRISIS_CANDIDATE = {
  id: 'crisis_event_01', type: 'event', biomes: ['anyBiome'], act: [1,2,3],
  themeTags: ['crisis', 'faction'], baseWeight: 0.5, budgetWeight: 0.0,
};

// ---------------------------------------------------------------------------
// 1. 1000-random-state fuzz
// ---------------------------------------------------------------------------

describe('Director — fuzz: never throws', () => {
  it('handles 1000 random rng states without throwing', () => {
    const errors = [];
    for (let i = 1; i <= 1000; i++) {
      const gs = makeGs({ story: { rngState: (i * 0x6D2B79F5) >>> 0 || 1 } });
      try {
        const result = getDirectorIntent(gs, { candidateOverride: STUB_CANDIDATES });
        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();
        expect(typeof result.rngStateBefore).toBe('number');
        expect(typeof result.rngStateAfter).toBe('number');
      } catch (err) {
        errors.push({ seed: i, err: String(err) });
      }
    }
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Pressure band: Crisis forces crisis-tagged candidate
// ---------------------------------------------------------------------------

describe('Director — crisis pressure band', () => {
  it('emits a crisis-tagged candidate within 3 ticks when pressure >= 80', () => {
    const gs = makeGs({ story: { pressureMeter: 85 } });
    const candidatesWithCrisis = [...STUB_CANDIDATES, CRISIS_CANDIDATE];

    let crisisCount = 0;
    for (let tick = 0; tick < 3; tick++) {
      const result = getDirectorIntent(gs, { candidateOverride: candidatesWithCrisis });
      if (result.intent.themeTags?.includes('crisis')) crisisCount++;
      // Simulate recording and stepping.
      recordTick(gs, { type: result.intent.type || 'event' });
    }

    // The crisis candidate should be strongly preferred at pressure 85.
    // At ×10 weight multiplier it should dominate within 3 ticks.
    expect(crisisCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Ringbuffer caps
// ---------------------------------------------------------------------------

describe('Director — ringbuffer caps', () => {
  it('nodeTypes never exceeds 10 entries', () => {
    const gs = makeGs();
    for (let i = 0; i < 20; i++) {
      recordTick(gs, { type: 'combat', enemyFamily: 'beast', biome: 'forest' });
    }
    expect(gs.story.recentHistory.nodeTypes.length).toBeLessThanOrEqual(10);
  });

  it('biomes never exceeds 5 entries', () => {
    const gs = makeGs();
    for (let i = 0; i < 15; i++) {
      recordTick(gs, { type: 'dialog', biome: `biome_${i}` });
    }
    expect(gs.story.recentHistory.biomes.length).toBeLessThanOrEqual(5);
  });

  it('tones never exceeds 8 entries', () => {
    const gs = makeGs();
    for (let i = 0; i < 15; i++) {
      recordTick(gs, { type: 'lore', tone: `tone_${i % 3}` });
    }
    expect(gs.story.recentHistory.tones.length).toBeLessThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// 4. sameTypeStreak math
// ---------------------------------------------------------------------------

describe('Director — sameTypeStreak', () => {
  it('increments streak on same type', () => {
    const gs = makeGs();
    recordTick(gs, { type: 'combat' });
    expect(gs.story.recentHistory.sameTypeStreak).toBe(1);
    recordTick(gs, { type: 'combat' });
    expect(gs.story.recentHistory.sameTypeStreak).toBe(2);
    recordTick(gs, { type: 'combat' });
    expect(gs.story.recentHistory.sameTypeStreak).toBe(3);
  });

  it('resets streak on type change', () => {
    const gs = makeGs();
    recordTick(gs, { type: 'combat' });
    recordTick(gs, { type: 'combat' });
    expect(gs.story.recentHistory.sameTypeStreak).toBe(2);
    recordTick(gs, { type: 'dialog' });
    expect(gs.story.recentHistory.sameTypeStreak).toBe(1);
    expect(gs.story.recentHistory.lastType).toBe('dialog');
  });

  it('lastType tracks correctly', () => {
    const gs = makeGs();
    recordTick(gs, { type: 'shrine' });
    expect(gs.story.recentHistory.lastType).toBe('shrine');
    recordTick(gs, { type: 'rest' });
    expect(gs.story.recentHistory.lastType).toBe('rest');
  });

  it('sameTypeStreak blocks same type after maxSameTypeStreak', () => {
    const gs = makeGs(); // chronicler: maxSameTypeStreak = 2
    const candidates = [
      { id: 'c1', type: 'combat', biomes: ['anyBiome'], act: [1], themeTags: [], baseWeight: 0.9 },
      { id: 'c2', type: 'dialog', biomes: ['anyBiome'], act: [1], themeTags: [], baseWeight: 0.1 },
    ];

    // Simulate 2 combat streaks.
    recordTick(gs, { type: 'combat' });
    recordTick(gs, { type: 'combat' });

    // Now at streak 2 (= maxSameTypeStreak), combat should be blocked from filter.
    const result = getDirectorIntent(gs, { candidateOverride: candidates });
    // chronicler maxSameTypeStreak = 2, streak IS 2 → combat filtered out.
    expect(result.intent.type).not.toBe('combat');
  });
});

// ---------------------------------------------------------------------------
// 5. FALLBACK_CANDIDATE fires when everything else is filtered
// ---------------------------------------------------------------------------

describe('Director — FALLBACK_CANDIDATE', () => {
  it('returns fallback when all candidates fail act filter', () => {
    const gs = makeGs({ story: { act: 3 } });
    const act1Only = [
      { id: 'act1_only', type: 'combat', biomes: ['anyBiome'], act: [1], themeTags: [], baseWeight: 0.9 },
    ];
    const result = getDirectorIntent(gs, { candidateOverride: act1Only });
    // All act:[1] candidates fail act-3 filter. Chronicler allows fallback.
    expect(result.intent.id).toBe('_fallback_travel_beat');
  });

  it('FALLBACK_CANDIDATE has expected shape', () => {
    expect(FALLBACK_CANDIDATE.id).toBe('_fallback_travel_beat');
    expect(FALLBACK_CANDIDATE.baseWeight).toBeLessThan(0.1);
    expect(FALLBACK_CANDIDATE._isFallback).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Pressure meter API
// ---------------------------------------------------------------------------

describe('Director — pressure meter', () => {
  it('applyPressure clamps to 0..100', () => {
    const gs = makeGs({ story: { pressureMeter: 90 } });
    applyPressure(gs, 20); // would be 110
    expect(gs.story.pressureMeter).toBe(100);
    applyPressure(gs, -200); // would be -100
    expect(gs.story.pressureMeter).toBe(0);
  });

  it('pressureBand returns correct band', () => {
    const gs = makeGs({ story: { pressureMeter: 10 } });
    expect(pressureBand(gs)).toBe('calm');
    gs.story.pressureMeter = 45;
    expect(pressureBand(gs)).toBe('tense');
    gs.story.pressureMeter = 65;
    expect(pressureBand(gs)).toBe('urgent');
    gs.story.pressureMeter = 85;
    expect(pressureBand(gs)).toBe('crisis');
  });
});

// ---------------------------------------------------------------------------
// 7. Debug API: inspectCandidates and forceIntent
// ---------------------------------------------------------------------------

describe('Director — debug API', () => {
  it('inspectCandidates does not throw', () => {
    const gs = makeGs();
    // Sync candidates may be empty; should still not throw.
    expect(() => inspectCandidates(gs)).not.toThrow();
  });

  it('forceIntent sets _forcedIntent and advances rngState', () => {
    const gs = makeGs({ story: { rngState: 42 } });
    const before = gs.story.rngState;
    forceIntent(gs, { id: 'test_intent', type: 'event' });
    expect(gs.story._forcedIntent.id).toBe('test_intent');
    expect(gs.story.rngState).not.toBe(before);
  });

  it('stepDirector returns an intent and updates rngState', () => {
    const gs = makeGs({ story: { rngState: 99 } });
    const before = gs.story.rngState;
    const intent = stepDirector(gs, { candidateOverride: STUB_CANDIDATES });
    expect(intent).toBeDefined();
    expect(gs.story.rngState).not.toBe(before);
  });
});

// ---------------------------------------------------------------------------
// 8. rngState determinism
// ---------------------------------------------------------------------------

describe('Director — determinism', () => {
  it('same rngState + same candidates yields same intent id', () => {
    const gs1 = makeGs({ story: { rngState: 0xDEADBEEF } });
    const gs2 = makeGs({ story: { rngState: 0xDEADBEEF } });

    const r1 = getDirectorIntent(gs1, { candidateOverride: STUB_CANDIDATES });
    const r2 = getDirectorIntent(gs2, { candidateOverride: STUB_CANDIDATES });

    expect(r1.intent.id).toBe(r2.intent.id);
    expect(r1.rngStateAfter).toBe(r2.rngStateAfter);
  });

  it('different rngState can yield different intent', () => {
    const results = new Set();
    for (let i = 1; i <= 20; i++) {
      const gs = makeGs({ story: { rngState: i * 0x1A2B3C4D } });
      const r = getDirectorIntent(gs, { candidateOverride: STUB_CANDIDATES });
      results.add(r.intent.id);
    }
    // With 5 candidates and 20 different seeds, expect > 1 unique result.
    expect(results.size).toBeGreaterThan(1);
  });
});
