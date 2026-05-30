/**
 * storyJournal.test.js — Unit tests for StoryJournalScreen logic.
 *
 * We test the rendering helpers via extracted pure functions to avoid the
 * full DOM/screen-manager setup required by StoryJournalScreen itself.
 * DOM rendering tests are described.todo until jsdom/happy-dom is wired.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helpers extracted from StoryJournalScreen for testability.
// These mirror the _humanizeId, faction-classification, and ledger-dump
// logic in StoryJournalScreen.js without requiring the DOM.
// ---------------------------------------------------------------------------

function humanizeId(id) {
  if (!id) return '—';
  return String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function classifyFaction(score) {
  const clamped = Math.max(-10, Math.min(10, score));
  if (clamped >= 3)  return 'positive';
  if (clamped <= -3) return 'negative';
  return 'neutral';
}

function factionLabel(score) {
  const clamped = Math.max(-10, Math.min(10, score));
  if (clamped >= 3)  return 'Friendly';
  if (clamped <= -3) return 'Hostile';
  return 'Neutral';
}

function buildLedgerDump(story) {
  if (!story) return null;
  const rh = story.recentHistory || {};
  return {
    act:             story.act,
    currentNodeId:   story.currentNodeId,
    campaignSeed:    story.campaignSeed,
    storytellerId:   story.storytellerId,
    difficulty:      story.difficulty,
    pressureMeter:   story.pressureMeter,    // correct field name (was `pressure`)
    worldCorruption: story.worldCorruption,
    flags:           story.flags,
    counters:        story.counters,
    factions:        story.factions,
    quests: Object.fromEntries(
      Object.entries(story.quests || {}).map(([k, v]) => [k, { status: v.status, phase: v.phase || v.currentPhase }])
    ),
    companions: (story.companions || []).map(c => ({ id: c.id, approval: c.approval, active: c.active, recruited: c.recruited })),
    loreCount: (story.loreDiscovered || []).length,
    rngState: story.rngState,
    // recentHistory is an object with arrays, not a flat array — summarize correctly.
    recentHistory: {
      lastType:       rh.lastType || null,
      sameTypeStreak: rh.sameTypeStreak || 0,
      nodeTypes:      Array.isArray(rh.nodeTypes) ? rh.nodeTypes.slice(0, 5) : [],
      biomes:         Array.isArray(rh.biomes) ? rh.biomes.slice(0, 5) : [],
    },
  };
}

// ---------------------------------------------------------------------------
// Representative gs fixtures
// ---------------------------------------------------------------------------

const makeStory = (overrides = {}) => ({
  act: 1,
  currentNodeId: 'node_001',
  campaignSeed: 12345,
  storytellerId: 'chronicler',
  difficulty: 'normal',
  pressureMeter: 50,      // correct field name (storyLedger uses pressureMeter)
  worldCorruption: 10,
  flags: { act1_started: true, arrived_brightfall: true },
  counters: { nodes_visited: 3 },
  factions: {
    brightfall_council: 4,
    ashen_veil: -5,
    ancient_pact: 1,
  },
  quests: {
    primary_act1_emberwood: { status: 'active', phase: 'reach_brightfall' },
    // Use 'completed' (with d) — that is what storyQuestEngine.completeQuest() sets
    secondary_act1_purify_shrine: { status: 'completed', phase: null },
  },
  companions: [
    // ledger fields: recruited, active (not benched)
    { id: 'lyra',  approval: 7,  active: true,  recruited: true  },
    { id: 'maer',  approval: -2, active: false, recruited: true  },
  ],
  loreDiscovered: ['lore_ashen_origin', 'lore_brightfall_history'],
  rngState: 0xDEADBEEF,
  // recentHistory is an object, not an array (storyDirector.recordTick shape)
  recentHistory: {
    nodeTypes:      ['combat', 'dialog', 'lore'],
    enemyFamilies:  ['generic'],
    skillLabels:    [],
    rewardTypes:    [],
    biomes:         ['emberwood', 'stoneward'],
    tones:          [],
    sameTypeStreak: 1,
    lastType:       'lore',
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tab 1: humanizeId (used by quest + companion tab rendering)
// ---------------------------------------------------------------------------
describe('humanizeId', () => {
  it('converts snake_case to Title Case', () => {
    expect(humanizeId('primary_act1_emberwood')).toBe('Primary Act1 Emberwood');
  });

  it('returns em-dash for null/undefined/empty', () => {
    expect(humanizeId(null)).toBe('—');
    expect(humanizeId(undefined)).toBe('—');
    expect(humanizeId('')).toBe('—');
  });

  it('handles single-word ids', () => {
    expect(humanizeId('chronicler')).toBe('Chronicler');
  });

  it('handles already-spaced strings', () => {
    expect(humanizeId('reach_brightfall')).toBe('Reach Brightfall');
  });
});

// ---------------------------------------------------------------------------
// Tab 2: quest rendering — quest list builds from gs.story.quests
// ---------------------------------------------------------------------------
describe('quest list from gs.story.quests', () => {
  const story = makeStory();

  it('has active and completed quests', () => {
    const active    = Object.entries(story.quests).filter(([, q]) => q.status === 'active');
    // storyQuestEngine.completeQuest() sets status = 'completed' (with d)
    const completed = Object.entries(story.quests).filter(([, q]) => q.status === 'completed' || q.status === 'complete');
    const failed    = Object.entries(story.quests).filter(([, q]) => q.status === 'failed');

    expect(active.length).toBe(1);
    expect(completed.length).toBe(1);
    expect(failed.length).toBe(0);
  });

  it('active quest has correct phase field', () => {
    const [, q] = Object.entries(story.quests).find(([, q]) => q.status === 'active');
    // storyQuestEngine uses `phase`, not `currentPhase`
    expect(q.phase).toBe('reach_brightfall');
  });

  it('humanizes quest id correctly', () => {
    expect(humanizeId('primary_act1_emberwood')).toBe('Primary Act1 Emberwood');
  });

  it('returns empty array when story.quests is empty', () => {
    const emptyStory = makeStory({ quests: {} });
    expect(Object.keys(emptyStory.quests).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tab 3: faction list from gs.story.factions
// ---------------------------------------------------------------------------
describe('faction list from gs.story.factions', () => {
  const story = makeStory();

  it('has 3 factions', () => {
    expect(Object.keys(story.factions).length).toBe(3);
  });

  it('classifies positive faction correctly', () => {
    expect(classifyFaction(4)).toBe('positive');
    expect(factionLabel(4)).toBe('Friendly');
  });

  it('classifies hostile faction correctly', () => {
    expect(classifyFaction(-5)).toBe('negative');
    expect(factionLabel(-5)).toBe('Hostile');
  });

  it('classifies neutral faction correctly', () => {
    expect(classifyFaction(1)).toBe('neutral');
    expect(factionLabel(1)).toBe('Neutral');
  });

  it('clamps scores outside -10..10', () => {
    expect(classifyFaction(999)).toBe('positive');
    expect(classifyFaction(-999)).toBe('negative');
  });

  it('returns empty when factions object is empty', () => {
    const noFac = makeStory({ factions: {} });
    expect(Object.entries(noFac.factions).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tab 5: ledger dump from representative gs
// ---------------------------------------------------------------------------
describe('ledger dump', () => {
  const story = makeStory();

  it('builds without throwing', () => {
    expect(() => buildLedgerDump(story)).not.toThrow();
  });

  it('returns null for missing story', () => {
    expect(buildLedgerDump(null)).toBeNull();
    expect(buildLedgerDump(undefined)).toBeNull();
  });

  it('includes all required top-level keys', () => {
    const dump = buildLedgerDump(story);
    expect(dump).toHaveProperty('act');
    expect(dump).toHaveProperty('flags');
    expect(dump).toHaveProperty('factions');
    expect(dump).toHaveProperty('quests');
    expect(dump).toHaveProperty('companions');
    expect(dump).toHaveProperty('loreCount');
    expect(dump).toHaveProperty('recentHistory');
    // pressureMeter not pressure
    expect(dump).toHaveProperty('pressureMeter');
    expect(dump).not.toHaveProperty('pressure');
  });

  it('serializes quests as {status, phase} slim objects', () => {
    const dump = buildLedgerDump(story);
    const questEntry = dump.quests['primary_act1_emberwood'];
    expect(questEntry).toEqual({ status: 'active', phase: 'reach_brightfall' });
  });

  it('loreCount matches loreDiscovered array length', () => {
    const dump = buildLedgerDump(story);
    expect(dump.loreCount).toBe(story.loreDiscovered.length);
  });

  it('recentHistory is an object (not array) with nodeTypes and biomes arrays', () => {
    const dump = buildLedgerDump(story);
    expect(typeof dump.recentHistory).toBe('object');
    expect(Array.isArray(dump.recentHistory.nodeTypes)).toBe(true);
    expect(Array.isArray(dump.recentHistory.biomes)).toBe(true);
    expect(dump.recentHistory.nodeTypes.length).toBeLessThanOrEqual(5);
  });

  it('pressureMeter comes from story.pressureMeter not story.pressure', () => {
    const s = makeStory({ pressureMeter: 72 });
    const dump = buildLedgerDump(s);
    expect(dump.pressureMeter).toBe(72);
  });

  it('companion serialization uses active field not benched', () => {
    const dump = buildLedgerDump(story);
    const lyra = dump.companions.find(c => c.id === 'lyra');
    expect(lyra).toBeDefined();
    expect(lyra).toHaveProperty('active');
    expect(lyra).toHaveProperty('recruited');
    // no 'benched' key in serialized form
    expect(lyra).not.toHaveProperty('benched');
  });

  it('produces valid JSON string from dump', () => {
    const dump = buildLedgerDump(story);
    expect(() => JSON.stringify(dump, null, 2)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// DOM rendering tests — require full screen manager; marked todo until
// jsdom/happy-dom is wired for StoryJournalScreen.
// ---------------------------------------------------------------------------
describe.todo('StoryJournalScreen DOM rendering (requires jsdom + screen manager)');
