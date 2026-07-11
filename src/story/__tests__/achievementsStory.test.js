/**
 * achievementsStory.test.js — Story achievement trigger tests.
 *
 * Tests call each achievement's check() function directly from the ACHIEVEMENTS
 * registry without invoking checkAchievements() (which requires GameState +
 * localStorage). This tests the trigger conditions in isolation.
 *
 * check(lifeGlobal, runSnap, gs) — we pass empty life/run snapshots and only
 * vary the gs argument to match each achievement's condition.
 */

import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS } from '../../game/achievements.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyLife = {};
const emptyRun  = { perChar: [], global: {} };

function findAchievement(id) {
  const a = ACHIEVEMENTS.find(a => a.id === id);
  if (!a) throw new Error(`Achievement not found: ${id}`);
  return a;
}

function passes(id, gs) {
  return findAchievement(id).check(emptyLife, emptyRun, gs);
}

function fails(id, gs) {
  return !findAchievement(id).check(emptyLife, emptyRun, gs);
}

// ---------------------------------------------------------------------------
// gs factories
// ---------------------------------------------------------------------------

function makeGs(storyOverrides = {}) {
  return {
    story: {
      act: 1,
      flags: {},
      counters: {},
      factions: {},
      companions: [],
      ...storyOverrides,
    },
  };
}

// ---------------------------------------------------------------------------
// story_first_act_complete — gs.story.act >= 2
// ---------------------------------------------------------------------------
describe('story_first_act_complete', () => {
  const ID = 'story_first_act_complete';

  it('triggers when act >= 2', () => {
    expect(passes(ID, makeGs({ act: 2 }))).toBe(true);
    expect(passes(ID, makeGs({ act: 3 }))).toBe(true);
  });

  it('does NOT trigger when act = 1', () => {
    expect(fails(ID, makeGs({ act: 1 }))).toBe(true);
  });

  it('does NOT trigger when gs.story is missing', () => {
    expect(fails(ID, {})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_pacifist_run — flag story_no_combat_act1 is truthy
// ---------------------------------------------------------------------------
describe('story_pacifist_run', () => {
  const ID = 'story_pacifist_run';

  it('triggers when flag story_no_combat_act1 is set', () => {
    expect(passes(ID, makeGs({ flags: { story_no_combat_act1: true } }))).toBe(true);
  });

  it('does NOT trigger when flag is absent', () => {
    expect(fails(ID, makeGs({ flags: {} }))).toBe(true);
  });

  it('does NOT trigger when flag is falsy', () => {
    expect(fails(ID, makeGs({ flags: { story_no_combat_act1: false } }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_iron_judge_win — flag story_iron_judge_complete
// ---------------------------------------------------------------------------
describe('story_iron_judge_win', () => {
  const ID = 'story_iron_judge_win';

  it('triggers when flag story_iron_judge_complete is set', () => {
    expect(passes(ID, makeGs({ flags: { story_iron_judge_complete: true } }))).toBe(true);
  });

  it('does NOT trigger when flag is absent', () => {
    expect(fails(ID, makeGs({ flags: {} }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_all_companions_recruited — gs.story.companions.length >= 4
// ---------------------------------------------------------------------------
describe('story_all_companions_recruited', () => {
  const ID = 'story_all_companions_recruited';
  const makeComps = (n) => Array.from({ length: n }, (_, i) => ({ id: 'comp_' + i, recruited: true }));

  it('triggers with exactly 4 companions', () => {
    expect(passes(ID, makeGs({ companions: makeComps(4) }))).toBe(true);
  });

  it('triggers with more than 4 companions', () => {
    expect(passes(ID, makeGs({ companions: makeComps(6) }))).toBe(true);
  });

  it('does NOT trigger with fewer than 4', () => {
    expect(fails(ID, makeGs({ companions: makeComps(3) }))).toBe(true);
    expect(fails(ID, makeGs({ companions: [] }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_redeemed_guardian — flag guardian_redeemed
// ---------------------------------------------------------------------------
describe('story_redeemed_guardian', () => {
  const ID = 'story_redeemed_guardian';

  it('triggers when guardian_redeemed flag is set', () => {
    expect(passes(ID, makeGs({ flags: { guardian_redeemed: true } }))).toBe(true);
  });

  it('does NOT trigger when flag is absent', () => {
    expect(fails(ID, makeGs({ flags: {} }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_corruption_max — counters.corruption >= 100
// ---------------------------------------------------------------------------
describe('story_corruption_max', () => {
  const ID = 'story_corruption_max';

  it('triggers at exactly 100 corruption', () => {
    expect(passes(ID, makeGs({ counters: { corruption: 100 } }))).toBe(true);
  });

  it('triggers above 100', () => {
    expect(passes(ID, makeGs({ counters: { corruption: 150 } }))).toBe(true);
  });

  it('does NOT trigger below 100', () => {
    expect(fails(ID, makeGs({ counters: { corruption: 99 } }))).toBe(true);
    expect(fails(ID, makeGs({ counters: {} }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_factions_all_friendly — every faction.standing >= 50
// Note: the check reads f?.standing, so numeric-keyed factions (score int)
// evaluate f?.standing as undefined (falsy). This matches existing behavior.
// ---------------------------------------------------------------------------
describe('story_factions_all_friendly', () => {
  const ID = 'story_factions_all_friendly';

  it('triggers when all factions have standing >= 50', () => {
    const gs = makeGs({ factions: {
      brightfall_council: { standing: 60 },
      ancient_pact:       { standing: 50 },
    }});
    expect(passes(ID, gs)).toBe(true);
  });

  it('does NOT trigger when one faction is below 50', () => {
    const gs = makeGs({ factions: {
      brightfall_council: { standing: 60 },
      ashen_veil:         { standing: 30 },
    }});
    expect(fails(ID, gs)).toBe(true);
  });

  it('does NOT trigger when factions is absent', () => {
    const gs = { story: { act: 1 } };
    expect(fails(ID, gs)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_companion_devoted — any companion.approval >= 100
// ---------------------------------------------------------------------------
describe('story_companion_devoted', () => {
  const ID = 'story_companion_devoted';

  it('triggers when a companion has approval >= 100', () => {
    const gs = makeGs({ companions: [
      { id: 'lyra', approval: 100 },
      { id: 'maer', approval: 30 },
    ]});
    expect(passes(ID, gs)).toBe(true);
  });

  it('does NOT trigger when all companions are below 100', () => {
    const gs = makeGs({ companions: [
      { id: 'lyra', approval: 99 },
    ]});
    expect(fails(ID, gs)).toBe(true);
  });

  it('does NOT trigger with no companions', () => {
    expect(fails(ID, makeGs({ companions: [] }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_trickster_chaos — counters.trickster_events >= 10
// ---------------------------------------------------------------------------
describe('story_trickster_chaos', () => {
  const ID = 'story_trickster_chaos';

  it('triggers at exactly 10 trickster events', () => {
    expect(passes(ID, makeGs({ counters: { trickster_events: 10 } }))).toBe(true);
  });

  it('triggers above 10', () => {
    expect(passes(ID, makeGs({ counters: { trickster_events: 15 } }))).toBe(true);
  });

  it('does NOT trigger below 10', () => {
    expect(fails(ID, makeGs({ counters: { trickster_events: 9 } }))).toBe(true);
    expect(fails(ID, makeGs({ counters: {} }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_secret_ending — flag secret_ending_reached
// ---------------------------------------------------------------------------
describe('story_secret_ending', () => {
  const ID = 'story_secret_ending';

  it('triggers when secret_ending_reached flag is set', () => {
    expect(passes(ID, makeGs({ flags: { secret_ending_reached: true } }))).toBe(true);
  });

  it('does NOT trigger when flag is absent', () => {
    expect(fails(ID, makeGs({ flags: {} }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// story_storyteller_chronicler_win — flag story_chronicler_complete
// ---------------------------------------------------------------------------
describe('story_storyteller_chronicler_win', () => {
  const ID = 'story_storyteller_chronicler_win';

  it('triggers when story_chronicler_complete flag is set', () => {
    expect(passes(ID, makeGs({ flags: { story_chronicler_complete: true } }))).toBe(true);
  });

  it('does NOT trigger when flag is absent', () => {
    expect(fails(ID, makeGs({ flags: {} }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Guard: all 12 story achievements are in the registry
// ---------------------------------------------------------------------------
describe('story achievement registry completeness', () => {
  const STORY_IDS = [
    'story_first_act_complete',
    'story_pacifist_run',
    'story_iron_judge_win',
    'story_all_companions_recruited',
    'story_redeemed_guardian',
    'story_corruption_max',
    'story_factions_all_friendly',
    'story_hidden_paths_50pct',
    'story_companion_devoted',
    'story_secret_ending',
    'story_storyteller_chronicler_win',
    'story_trickster_chaos',
  ];

  it('has all 12 story achievements registered', () => {
    for (const id of STORY_IDS) {
      expect(ACHIEVEMENTS.find(a => a.id === id), `missing achievement: ${id}`).toBeDefined();
    }
  });

  it('each story achievement has a check function', () => {
    for (const id of STORY_IDS) {
      const a = ACHIEVEMENTS.find(a => a.id === id);
      expect(typeof a.check, `${id}.check must be a function`).toBe('function');
    }
  });
});
