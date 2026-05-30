/**
 * questEngine.test.js — Unit tests for storyQuestEngine.js
 *
 * Uses _test_quest.json via registerQuestLine (no filesystem access).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureQuestStarted,
  advanceQuestPhase,
  completeQuest,
  failQuest,
  getActiveQuests,
  getQuestPhase,
  checkQuestOutcomes,
  tickQuestConditions,
  getQuestLog,
} from '../storyQuestEngine.js';
import { registerQuestLine, buildContentRegistry, clearContentCaches } from '../storyContent.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_QUEST = {
  id: '_test_quest',
  category: 'side',
  act: 1,
  title: 'The Test Quest',
  startCondition: { flag: 'test_quest_unlocked' },
  phases: [
    {
      id: 'phase_one',
      label: 'Complete Phase One',
      completeCondition: { flag: 'phase_one_done' },
      onComplete: [
        { type: 'set_flag', flag: 'phase_one_reward' },
        { type: 'quest_log', text: 'Phase one complete.' },
      ],
      nextPhase: 'phase_two',
    },
    {
      id: 'phase_two',
      label: 'Complete Phase Two',
      completeCondition: { flag: 'phase_two_done' },
      onComplete: [
        { type: 'quest_log', text: 'Phase two complete.' },
      ],
      nextPhase: null,
    },
  ],
  outcomes: [
    {
      id: 'success',
      condition: { all: [{ flag: 'phase_one_reward' }, { flag: 'phase_two_done' }] },
      effects: [
        { type: 'set_flag', flag: 'test_quest_completed' },
        { type: 'gold', amount: 100 },
      ],
    },
    {
      id: 'failed_by_flag',
      condition: { flag: 'test_quest_fail' },
      effects: [],
    },
  ],
};

function _makeGs(flagOverrides = {}) {
  const gs = {
    gold: 0,
    party: [],
    story: {
      flags: { ...flagOverrides },
      counters: {},
      factions: {},
      quests: {},
      companions: [],
      maps: {},
      loreDiscovered: [],
      worldMutations: [],
      worldCorruption: 0,
      pressureMeter: 50,
      pendingTolls: [],
      lastBanterNode: null,
      dialogHistory: {},
      currentNodeId: 'a1_n_000',
      currentMapId: 'act1_emberwood',
    },
    __storyContent: null,
  };
  gs.__storyContent = buildContentRegistry({ [TEST_QUEST.id]: TEST_QUEST });
  return gs;
}

beforeEach(() => {
  clearContentCaches();
  registerQuestLine(TEST_QUEST);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ensureQuestStarted', () => {
  it('does nothing when startCondition not met', () => {
    const gs = _makeGs(); // no test_quest_unlocked flag
    ensureQuestStarted(gs, '_test_quest');
    expect(gs.story.quests['_test_quest']).toBeUndefined();
  });

  it('starts quest when startCondition is met', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    const q = gs.story.quests['_test_quest'];
    expect(q).toBeDefined();
    expect(q.status).toBe('active');
    expect(q.phase).toBe('phase_one');
    expect(q.log[0]).toContain('Quest started');
  });

  it('is idempotent when quest already exists', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    ensureQuestStarted(gs, '_test_quest');
    expect(gs.story.quests['_test_quest'].log.length).toBe(1);
  });

  it('does nothing for unknown quest id', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, 'does_not_exist');
    expect(Object.keys(gs.story.quests).length).toBe(0);
  });
});

describe('advanceQuestPhase', () => {
  it('advances phase and logs it', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    advanceQuestPhase(gs, '_test_quest', 'phase_two');
    const q = gs.story.quests['_test_quest'];
    expect(q.phase).toBe('phase_two');
    expect(q.log).toContain('Phase -> phase_two');
  });

  it('does nothing when quest not found', () => {
    const gs = _makeGs();
    expect(() => advanceQuestPhase(gs, 'none', 'p1')).not.toThrow();
  });
});

describe('failQuest', () => {
  it('sets status to failed', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    failQuest(gs, '_test_quest');
    expect(gs.story.quests['_test_quest'].status).toBe('failed');
    expect(gs.story.quests['_test_quest'].log).toContain('Quest failed.');
  });
});

describe('completeQuest', () => {
  it('marks quest completed with outcome', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    completeQuest(gs, '_test_quest', 'success');
    const q = gs.story.quests['_test_quest'];
    expect(q.status).toBe('completed');
    expect(q.outcomes).toContain('success');
  });
});

describe('getActiveQuests', () => {
  it('returns only active quests', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    const active = getActiveQuests(gs);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('_test_quest');
  });

  it('excludes completed quests', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    completeQuest(gs, '_test_quest', 'success');
    expect(getActiveQuests(gs).length).toBe(0);
  });
});

describe('getQuestPhase', () => {
  it('returns current phase', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    expect(getQuestPhase(gs, '_test_quest')).toBe('phase_one');
  });

  it('returns null for unknown quest', () => {
    const gs = _makeGs();
    expect(getQuestPhase(gs, 'none')).toBeNull();
  });
});

describe('checkQuestOutcomes', () => {
  it('fires outcome when condition is met', () => {
    const gs = _makeGs({
      test_quest_unlocked: true,
      phase_one_reward: true,
      phase_two_done: true,
    });
    ensureQuestStarted(gs, '_test_quest');
    checkQuestOutcomes(gs, '_test_quest');
    expect(gs.story.quests['_test_quest'].status).toBe('completed');
    expect(gs.story.flags['test_quest_completed']).toBe(true);
    expect(gs.gold).toBe(100);
  });

  it('does not fire already-applied outcome', () => {
    const gs = _makeGs({
      test_quest_unlocked: true,
      phase_one_reward: true,
      phase_two_done: true,
    });
    ensureQuestStarted(gs, '_test_quest');
    checkQuestOutcomes(gs, '_test_quest');
    gs.story.quests['_test_quest'].status = 'active'; // manually reset for test
    gs.gold = 0;
    checkQuestOutcomes(gs, '_test_quest');
    // Already applied — gold should NOT be added again (outcome id in outcomes[])
    // Quest was completed so the second call returns early due to status check.
    expect(gs.gold).toBe(0);
  });
});

describe('tickQuestConditions', () => {
  it('advances phase when completeCondition is met', () => {
    const gs = _makeGs({ test_quest_unlocked: true, phase_one_done: true });
    ensureQuestStarted(gs, '_test_quest');
    tickQuestConditions(gs);
    const q = gs.story.quests['_test_quest'];
    expect(q.phase).toBe('phase_two');
    expect(gs.story.flags['phase_one_reward']).toBe(true);
  });

  it('fires outcome after final phase completes', () => {
    const gs = _makeGs({
      test_quest_unlocked: true,
      phase_one_done: true,
      phase_one_reward: true,
      phase_two_done: true,
    });
    ensureQuestStarted(gs, '_test_quest');
    // Start at phase_two to avoid the phase_one advance masking the outcome
    gs.story.quests['_test_quest'].phase = 'phase_two';
    tickQuestConditions(gs);
    expect(gs.story.quests['_test_quest'].status).toBe('completed');
  });

  it('does not crash on quest with no __storyContent def', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    // Corrupt the content registry
    gs.__storyContent.quests['_test_quest'] = undefined;
    expect(() => tickQuestConditions(gs)).not.toThrow();
  });
});

describe('getQuestLog', () => {
  it('returns log array', () => {
    const gs = _makeGs({ test_quest_unlocked: true });
    ensureQuestStarted(gs, '_test_quest');
    advanceQuestPhase(gs, '_test_quest', 'phase_two');
    const log = getQuestLog(gs, '_test_quest');
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for unknown quest', () => {
    const gs = _makeGs();
    expect(getQuestLog(gs, 'none')).toEqual([]);
  });
});

describe('fail condition via outcome', () => {
  it('fires fail_by_flag outcome', () => {
    const gs = _makeGs({ test_quest_unlocked: true, test_quest_fail: true });
    ensureQuestStarted(gs, '_test_quest');
    checkQuestOutcomes(gs, '_test_quest');
    expect(gs.story.quests['_test_quest'].status).toBe('completed');
    expect(gs.story.quests['_test_quest'].outcomes).toContain('failed_by_flag');
  });
});
