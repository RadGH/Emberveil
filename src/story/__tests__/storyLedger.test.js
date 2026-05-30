import { describe, expect, it } from 'vitest';
import { createDefaultStoryLedger, migrateStorySave, nodeRng, recordTick, commitRng } from '../storyLedger.js';

describe('story ledger', () => {
  it('creates a Set-free v1 story subtree with an object recentHistory ledger', () => {
    const story = createDefaultStoryLedger({ campaignSeed: 'alpha', storytellerId: 'warbringer' });
    expect(story.storyVersion).toBe(1);
    expect(story.storytellerId).toBe('warbringer');
    expect(story.pressureMeter).toBe(0);
    expect(Array.isArray(story.recentHistory)).toBe(false);
    expect(JSON.parse(JSON.stringify(story)).campaignSeed).toBe('alpha');
  });

  it('migrates story saves without adding story data to classic saves', () => {
    const classic = { gameMode: 'classic', heroName: 'A' };
    expect(migrateStorySave(classic)).toBe(classic);

    const story = migrateStorySave({ gameMode: 'story', storyVersion: 0, story: { campaignSeed: 'beta', pressureMeter: 140 } });
    expect(story.story.storyVersion).toBe(1);
    expect(story.story.pressureMeter).toBe(100);
    expect(story.story.recentHistory.winStreak).toBe(0);
  });

  it('keeps node RNG deterministic and advances only on commit', () => {
    const gs = { story: createDefaultStoryLedger({ campaignSeed: 'gamma' }) };
    const before = gs.story.rngState;
    const a = nodeRng(gs, 'n1')();
    const b = nodeRng(gs, 'n1')();
    expect(a).toBe(b);
    commitRng(gs, 'n1');
    expect(gs.story.rngState).not.toBe(before);
  });

  it('records combat streaks through the helper instead of exposing array mutation', () => {
    const gs = { story: createDefaultStoryLedger({ campaignSeed: 'delta' }) };
    recordTick(gs, { nodeId: 'a', nodeType: 'combat', combatResult: 'win' });
    recordTick(gs, { nodeId: 'b', nodeType: 'combat', combatResult: 'win' });
    recordTick(gs, { nodeId: 'c', nodeType: 'event', combatResult: 'loss' });
    expect(gs.story.recentHistory.nodeIds).toEqual(['a', 'b', 'c']);
    expect(gs.story.recentHistory.winStreak).toBe(0);
    expect(gs.story.recentHistory.lossStreak).toBe(1);
  });
});
