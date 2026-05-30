/**
 * saveSchema.test.js — Default ledger shape, round-trip, Classic untouched.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_STORY_LEDGER, createStoryLedger, migrateStorySave } from '../storyLedger.js';

describe('DEFAULT_STORY_LEDGER', () => {
  it('has the required top-level keys', () => {
    const d = DEFAULT_STORY_LEDGER;
    expect(d).toHaveProperty('campaignSeed');
    expect(d).toHaveProperty('storytellerId');
    expect(d).toHaveProperty('difficulty');
    expect(d).toHaveProperty('thematicConsistency');
    expect(d).toHaveProperty('sideEventFrequency');
    expect(d).toHaveProperty('combatDensity');
    expect(d).toHaveProperty('storyPressure');
    expect(d).toHaveProperty('versions');
    expect(d).toHaveProperty('act');
    expect(d).toHaveProperty('currentMapId');
    expect(d).toHaveProperty('rngState');
    expect(d).toHaveProperty('flags');
    expect(d).toHaveProperty('counters');
    expect(d).toHaveProperty('factions');
    expect(d).toHaveProperty('quests');
    expect(d).toHaveProperty('dialogHistory');
    expect(d).toHaveProperty('loreDiscovered');
    expect(d).toHaveProperty('worldMutations');
    expect(d).toHaveProperty('worldCorruption');
    expect(d).toHaveProperty('bossHistory');
    expect(d).toHaveProperty('maps');
    expect(d).toHaveProperty('encounterHistory');
    expect(d).toHaveProperty('recentHistory');
    expect(d).toHaveProperty('pressureMeter');
    expect(d).toHaveProperty('companions');
    expect(d).toHaveProperty('activeCompanionId');
    expect(d).toHaveProperty('rumorPool');
    expect(d).toHaveProperty('pendingTolls');
    expect(d).toHaveProperty('lastUndoableChoice');
    expect(d).toHaveProperty('campaignStartDate');
    expect(d).toHaveProperty('lastSaveDate');
  });

  it('has 6 companion records', () => {
    expect(DEFAULT_STORY_LEDGER.companions.length).toBe(6);
  });

  it('all companions are pre-populated inactive', () => {
    for (const c of DEFAULT_STORY_LEDGER.companions) {
      expect(c.recruited).toBe(false);
      expect(c.active).toBe(false);
      expect(typeof c.id).toBe('string');
    }
  });

  it('versions has all 5 namespaces', () => {
    const v = DEFAULT_STORY_LEDGER.versions;
    expect(v).toHaveProperty('dialog');
    expect(v).toHaveProperty('quest');
    expect(v).toHaveProperty('content');
    expect(v).toHaveProperty('map');
    expect(v).toHaveProperty('director');
  });

  it('recentHistory has required arrays', () => {
    const rh = DEFAULT_STORY_LEDGER.recentHistory;
    expect(Array.isArray(rh.nodeTypes)).toBe(true);
    expect(Array.isArray(rh.enemyFamilies)).toBe(true);
    expect(typeof rh.sameTypeStreak).toBe('number');
  });

  // JSON round-trip — the ledger is Set-free so this must work cleanly.
  it('round-trips through JSON.stringify / JSON.parse', () => {
    const ledger = createStoryLedger({ storytellerId: 'trickster', difficulty: 'hard' });
    const json   = JSON.stringify(ledger);
    const parsed = JSON.parse(json);
    expect(parsed.storytellerId).toBe('trickster');
    expect(parsed.difficulty).toBe('hard');
    expect(Array.isArray(parsed.companions)).toBe(true);
    expect(parsed.companions.length).toBe(6);
  });
});

describe('createStoryLedger', () => {
  it('uses opts values', () => {
    const l = createStoryLedger({ storytellerId: 'pilgrim', difficulty: 'nightmare' });
    expect(l.storytellerId).toBe('pilgrim');
    expect(l.difficulty).toBe('nightmare');
  });

  it('generates an 8-char hex seed when none provided', () => {
    const l = createStoryLedger();
    expect(l.campaignSeed).toMatch(/^[0-9a-f]{8}$/);
  });

  it('accepts a custom seed', () => {
    const l = createStoryLedger({ seed: 'deadbeef' });
    expect(l.campaignSeed).toBe('deadbeef');
  });

  it('sets campaignStartDate to a recent timestamp', () => {
    const before = Date.now();
    const l = createStoryLedger();
    const after  = Date.now();
    expect(l.campaignStartDate).toBeGreaterThanOrEqual(before);
    expect(l.campaignStartDate).toBeLessThanOrEqual(after);
  });

  it('deep-clones — companions list is not shared with DEFAULT_STORY_LEDGER', () => {
    const l1 = createStoryLedger();
    const l2 = createStoryLedger();
    l1.companions[0].approval = 9;
    expect(l2.companions[0].approval).toBe(0); // not shared
    expect(DEFAULT_STORY_LEDGER.companions[0].approval).toBe(0);
  });
});

describe('migrateStorySave', () => {
  it('returns save unchanged when no migrations exist', () => {
    const save = {
      gameMode: 'story',
      story: { ...DEFAULT_STORY_LEDGER, versions: { dialog: 1, quest: 1, content: 1, map: 1, director: 1 } },
    };
    const result = migrateStorySave(save);
    expect(result).toBe(save); // same reference (no-op migration returns same object)
  });

  it('handles missing versions gracefully', () => {
    const save = { gameMode: 'story', story: { flags: {} } };
    expect(() => migrateStorySave(save)).not.toThrow();
    expect(save.story.versions).toBeDefined();
  });

  it('does not touch classic saves', () => {
    const save = { gameMode: 'classic', gold: 999 };
    // migrateStorySave should just return unchanged (no story property)
    const result = migrateStorySave(save);
    expect(result).toBe(save);
    expect(result.gold).toBe(999);
  });
});
