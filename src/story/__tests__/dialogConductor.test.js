/**
 * dialogConductor.test.js — Unit tests for storyDialogConductor.js
 *
 * Tests: pool load, choice filtering (predicate gates), effect application,
 * cross-pool routing, legacy adapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  filterChoices,
  resolveNext,
  applyChoice,
  adaptLegacyChoice,
  registerPool,
  clearConductorCache,
} from '../storyDialogConductor.js';
import { clearContentCaches } from '../storyContent.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function _makeGs(flagOverrides = {}, goldOverride = 50) {
  return {
    gold: goldOverride,
    party: [{ name: 'Hero', level: 1, attrs: { STR: 10, DEX: 10, INT: 10, CON: 10 }, equipment: {} }],
    story: {
      flags: { ...flagOverrides },
      counters: {},
      factions: {},
      quests: {},
      companions: [
        { id: 'lyra_ashwalker', recruited: true,  active: true,  approval: 5, alive: true, benchedAt: null },
        { id: 'orren_gravetide', recruited: false, active: false, approval: 0, alive: true, benchedAt: null },
      ],
      maps: {},
      loreDiscovered: [],
      worldMutations: [],
      worldCorruption: 0,
      pressureMeter: 50,
      pendingTolls: [],
      lastBanterNode: null,
      dialogHistory: {},
      currentNodeId: 'a1_n_000',
      currentMapId:  'act1_emberwood',
      activeCompanionId: 'lyra_ashwalker',
    },
    __storyContent: { quests: {} },
  };
}

function _makeCtx(gs) {
  return {
    gs,
    flags:      gs.story.flags,
    factions:   gs.story.factions,
    counters:   gs.story.counters,
    quests:     gs.story.quests,
    party:      gs.party,
    companions: gs.story.companions,
    revealPath:       () => {},
    blockPath:        () => {},
    revealNodesByTag: () => {},
    mutateNode:       () => {},
    unlockTransition: () => {},
    setWaypointState: () => {},
    applyWorldMutation: () => {},
    queueEncounter:   () => {},
  };
}

const SAMPLE_POOL = [
  {
    id: 'node_a',
    lines: [{ speaker: 'npc', text: 'Hello.' }],
    choices: [
      { text: 'Free choice', next: '#node_b' },
      { text: 'Flag-gated', next: '#node_b', requires: { flag: 'secret_known' } },
      { text: 'Companion choice', next: '#node_b', companionCondition: { companion: 'lyra_ashwalker', active: true } },
      { text: 'Unmet companion', next: '#node_b', companionCondition: { companion: 'orren_gravetide', active: true } },
    ],
    next: '#node_b',
  },
  {
    id: 'node_b',
    lines: [{ speaker: 'npc', text: 'Node B.' }],
    choices: [],
    next: null,
  },
];

beforeEach(() => {
  clearConductorCache();
  clearContentCaches();
  registerPool('sample_pool', SAMPLE_POOL);
});

// ---------------------------------------------------------------------------
// filterChoices
// ---------------------------------------------------------------------------

describe('filterChoices', () => {
  it('returns all choices when no predicates', () => {
    const node = { choices: [{ text: 'A' }, { text: 'B' }] };
    const ctx  = _makeCtx(_makeGs());
    const out  = filterChoices(node, ctx);
    expect(out.length).toBe(2);
  });

  it('hides choices whose requires predicate fails', () => {
    const gs  = _makeGs(); // no 'secret_known' flag
    const ctx = _makeCtx(gs);
    const node = SAMPLE_POOL[0];
    const out  = filterChoices(node, ctx);
    const texts = out.map(c => c.text);
    expect(texts).not.toContain('Flag-gated');
    expect(texts).toContain('Free choice');
  });

  it('shows flag-gated choice when flag is set', () => {
    const gs  = _makeGs({ secret_known: true });
    const ctx = _makeCtx(gs);
    const out  = filterChoices(SAMPLE_POOL[0], ctx);
    expect(out.map(c => c.text)).toContain('Flag-gated');
  });

  it('annotates companion-conditioned choice with _companionLabel', () => {
    const gs  = _makeGs(); // lyra is active
    const ctx = _makeCtx(gs);
    const out  = filterChoices(SAMPLE_POOL[0], ctx);
    const lyraChoice = out.find(c => c.text === 'Companion choice');
    expect(lyraChoice).toBeDefined();
    expect(lyraChoice._companionLabel).toBeTruthy();
  });

  it('includes unmet-companion choice without badge (companion not active)', () => {
    const gs  = _makeGs(); // orren_gravetide is not recruited
    const ctx = _makeCtx(gs);
    const out  = filterChoices(SAMPLE_POOL[0], ctx);
    const orrenChoice = out.find(c => c.text === 'Unmet companion');
    // The choice is still shown (companionCondition doesn't hide, just badges)
    expect(orrenChoice).toBeDefined();
    expect(orrenChoice._companionLabel).toBeFalsy();
  });

  it('returns empty array for node with no choices', () => {
    const out = filterChoices(SAMPLE_POOL[1], _makeCtx(_makeGs()));
    expect(out).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveNext
// ---------------------------------------------------------------------------

describe('resolveNext', () => {
  it('returns null for null input', () => {
    expect(resolveNext(null, 'pool_a')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(resolveNext(undefined, 'pool_a')).toBeNull();
  });

  it('handles #localId within same pool', () => {
    const ref = resolveNext('#node_b', 'pool_a');
    expect(ref).toEqual({ poolId: 'pool_a', nodeId: 'node_b' });
  });

  it('handles plain localId (no # prefix)', () => {
    const ref = resolveNext('node_b', 'pool_a');
    expect(ref).toEqual({ poolId: 'pool_a', nodeId: 'node_b' });
  });

  it('handles pool:X#Y cross-pool reference', () => {
    const ref = resolveNext('pool:arrival#arrival_brightfall_002', 'pool_a');
    expect(ref).toEqual({ poolId: 'arrival', nodeId: 'arrival_brightfall_002' });
  });

  it('warns and returns null for malformed pool: ref', () => {
    const ref = resolveNext('pool:missing_hash', 'pool_a');
    expect(ref).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// adaptLegacyChoice
// ---------------------------------------------------------------------------

describe('adaptLegacyChoice', () => {
  it('passes through choices that already have effects[]', () => {
    const choice = { text: 'A', effects: [{ type: 'gold', amount: 10 }] };
    expect(adaptLegacyChoice(choice)).toBe(choice); // same reference
  });

  it('maps effect.gold to gold effect', () => {
    const choice = { text: 'Pay', effect: { gold: -10 } };
    const out = adaptLegacyChoice(choice);
    expect(out.effects).toContainEqual({ type: 'gold', amount: -10 });
  });

  it('maps effect.startCombat to start_encounter', () => {
    const choice = { text: 'Fight', effect: { startCombat: 'bandit_ambush' } };
    const out = adaptLegacyChoice(choice);
    expect(out.effects).toContainEqual({ type: 'start_encounter', template: 'bandit_ambush' });
  });

  it('maps reward.gold to gold effect', () => {
    const choice = { text: 'Reward', reward: { gold: 25 } };
    const out = adaptLegacyChoice(choice);
    expect(out.effects).toContainEqual({ type: 'gold', amount: 25 });
  });

  it('maps reward.xp to inc_counter', () => {
    const choice = { text: 'XP', reward: { xp: 50 } };
    const out = adaptLegacyChoice(choice);
    const xpEffect = out.effects.find(e => e.type === 'inc_counter' && e.counter === '_reward_xp');
    expect(xpEffect).toBeDefined();
    expect(xpEffect.amount).toBe(50);
  });

  it('maps top-level setFlag to set_flag effect', () => {
    const choice = { text: 'Flag', setFlag: 'thornwood_brave' };
    const out = adaptLegacyChoice(choice);
    expect(out.effects).toContainEqual({ type: 'set_flag', flag: 'thornwood_brave' });
  });

  it('produces empty effects for bare choice', () => {
    const choice = { text: 'Continue' };
    const out = adaptLegacyChoice(choice);
    expect(out.effects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyChoice
// ---------------------------------------------------------------------------

describe('applyChoice', () => {
  it('applies gold effect and records dialog choice', () => {
    const gs     = _makeGs({}, 100);
    const ctx    = _makeCtx(gs);
    const choice = { text: 'Pay', effects: [{ type: 'gold', amount: -25 }], next: null };
    const result = applyChoice(gs, choice, ctx, 'sample_pool', 'node_a');
    expect(gs.gold).toBe(75);
    expect(gs.story.dialogHistory['node_a']).toBeDefined();
    expect(result.nextRef).toBeNull();
    expect(result.effectFeedback.some(f => f.includes('25') || f.includes('Gold'))).toBe(true);
  });

  it('resolves next ref from choice.next', () => {
    const gs     = _makeGs();
    const ctx    = _makeCtx(gs);
    const choice = { text: 'Go', effects: [], next: '#node_b' };
    const result = applyChoice(gs, choice, ctx, 'sample_pool', 'node_a');
    expect(result.nextRef).toEqual({ poolId: 'sample_pool', nodeId: 'node_b' });
  });

  it('returns empty feedback for silent effects', () => {
    const gs     = _makeGs();
    const ctx    = _makeCtx(gs);
    const choice = { text: 'Silent', effects: [{ type: 'set_flag', flag: 'x' }], next: null };
    const result = applyChoice(gs, choice, ctx, 'p', 'n');
    expect(result.effectFeedback).toEqual([]);
    expect(gs.story.flags['x']).toBe(true);
  });

  it('generates feedback for faction_delta', () => {
    const gs     = _makeGs();
    const ctx    = _makeCtx(gs);
    const choice = { text: 'Ally', effects: [{ type: 'faction_delta', faction: 'emberguard', amount: 2 }], next: null };
    const result = applyChoice(gs, choice, ctx, 'p', 'n');
    expect(result.effectFeedback.some(f => f.includes('Emberguard'))).toBe(true);
  });

  it('generates feedback for companion_approval (approve)', () => {
    const gs     = _makeGs();
    const ctx    = _makeCtx(gs);
    const choice = {
      text: 'Kind',
      effects: [{ type: 'companion_approval', companion: 'lyra_ashwalker', amount: 1 }],
      next: null,
    };
    const result = applyChoice(gs, choice, ctx, 'p', 'n');
    expect(result.effectFeedback.some(f => f.includes('Lyra') && f.includes('approves'))).toBe(true);
  });

  it('adapts legacy shape on the fly', () => {
    const gs     = _makeGs({}, 200);
    const ctx    = _makeCtx(gs);
    const choice = { text: 'Legacy pay', effect: { gold: -10 }, outcome: 'pay' };
    const result = applyChoice(gs, choice, ctx, 'p', 'n');
    expect(gs.gold).toBe(190);
  });
});
