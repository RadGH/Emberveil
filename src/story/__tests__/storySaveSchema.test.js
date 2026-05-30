import { describe, expect, it } from 'vitest';
import { SaveManager } from '../../engine/SaveManager.js';
import { GameState } from '../../game/gameState.js';
import { createDefaultStoryLedger } from '../storyLedger.js';

describe('story save schema boundary', () => {
  it('omits story data from classic saves', () => {
    GameState.load({ gameMode: 'classic', party: [], visitedNodes: ['start'] });
    const data = GameState.toSaveData();
    expect(data.gameMode).toBe('classic');
    expect(data.story).toBeUndefined();
    expect(data.storyVersion).toBeUndefined();
  });

  it('preserves migrated story data only for story saves', () => {
    GameState.load({
      gameMode: 'story',
      storyVersion: 1,
      party: [],
      visitedNodes: ['story_start'],
      story: createDefaultStoryLedger({ campaignSeed: 'schema', storytellerId: 'pilgrim' }),
    });
    const data = GameState.toSaveData();
    expect(data.gameMode).toBe('story');
    expect(data.story.storytellerId).toBe('pilgrim');
    expect(data.story.recentHistory.nodeIds).toEqual([]);
  });

  it('lists same-name Classic and Story saves without cross-mode dedupe deletion', () => {
    const previous = globalThis.localStorage;
    const store = new Map();
    globalThis.localStorage = {
      get length() { return store.size; },
      key(i) { return [...store.keys()][i] || null; },
      getItem(k) { return store.has(k) ? store.get(k) : null; },
      setItem(k, v) { store.set(k, String(v)); },
      removeItem(k) { store.delete(k); },
    };
    try {
      localStorage.setItem('emberveil_save_hero_a', JSON.stringify({
        version: 6,
        key: 'emberveil_save_hero_a',
        gameMode: 'classic',
        heroName: 'Hero',
        createdAt: 2,
        party: [{ name: 'Hero', level: 8 }],
        level: 8,
      }));
      localStorage.setItem('emberveil_save_story_hero_b', JSON.stringify({
        version: 6,
        key: 'emberveil_save_story_hero_b',
        gameMode: 'story',
        storyVersion: 1,
        heroName: 'Hero',
        createdAt: 1,
        party: [{ name: 'Hero', level: 1 }],
        level: 1,
        story: createDefaultStoryLedger({ campaignSeed: 'same-name' }),
      }));
      const saves = SaveManager.listSaves();
      expect(saves.map(s => s.key).sort()).toEqual(['emberveil_save_hero_a', 'emberveil_save_story_hero_b']);
      expect(localStorage.getItem('emberveil_save_story_hero_b')).not.toBeNull();
    } finally {
      globalThis.localStorage = previous;
    }
  });
});
