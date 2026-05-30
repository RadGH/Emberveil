import { describe, expect, it } from 'vitest';
import { buildEffectContext, EFFECT_TYPES, runEffects } from '../storyEffects.js';
import { createDefaultStoryLedger } from '../storyLedger.js';

function makeGs() {
  return { gold: 10, inventory: [], party: [], story: createDefaultStoryLedger({ campaignSeed: 'effects' }) };
}

describe('story effect runner', () => {
  it('exposes every authored effect type and applies them without no-op stubs', () => {
    expect(EFFECT_TYPES).toContain('reward_item');
    expect(EFFECT_TYPES).toContain('world_mutation');
    expect(EFFECT_TYPES).toContain('add_toll');
  });

  it('mutates ledger, inventory, quest, companion, and map queues', () => {
    const gs = makeGs();
    const result = runEffects([
      { type: 'set_flag', flag: 'f1' },
      { type: 'inc_counter', counter: 'c1', amount: 2 },
      { type: 'faction_delta', faction: 'faction_a', amount: 20 },
      { type: 'companion_approval', companion: 'maera', amount: 3 },
      { type: 'recruit_companion', companion: 'maera' },
      { type: 'quest_advance', questId: 'q1', phase: 'p1' },
      { type: 'quest_log', questId: 'q1', text: 'Found the clue.' },
      { type: 'quest_complete', questId: 'q1', outcomeId: 'good' },
      { type: 'reveal_path', from: 'a', to: 'b' },
      { type: 'block_path', from: 'b', to: 'c' },
      { type: 'mutate_node', nodeId: 'c', overlay: 'corrupted' },
      { type: 'unlock_waypoint', nodeId: 'w1' },
      { type: 'unlock_map_transition', targetMap: 'act2' },
      { type: 'start_encounter', template: 'ambush_1' },
      { type: 'lore_unlock', loreId: 'lore_1' },
      { type: 'gold', amount: 15 },
      { type: 'reward_item', itemId: 'ember_ring' },
      { type: 'world_mutation', id: 'bridge_burned' },
      { type: 'corruption', amount: 8 },
      { type: 'pressure', amount: 6 },
      { type: 'add_toll', tollType: 'gold', value: 5, source: 'test' },
      { type: 'undoable_mark' },
    ], buildEffectContext(gs), { nodeId: 'n1', choiceId: 'c1' });

    expect(result.skipped).toEqual([]);
    expect(gs.story.flags.f1).toBe(true);
    expect(gs.story.counters.c1).toBe(2);
    expect(gs.story.factions.faction_a).toBe(10);
    expect(gs.story.companions.find(c => c.id === 'maera').recruited).toBe(true);
    expect(gs.story.quests.q1.status).toBe('complete');
    expect(gs.story.pendingMapMutations).toHaveLength(5);
    expect(gs.story.pendingEncounters[0].template).toBe('ambush_1');
    expect(gs.story.loreDiscovered).toEqual(['lore_1']);
    expect(gs.gold).toBe(25);
    expect(gs.inventory[0].id).toBe('ember_ring');
    expect(gs.story.worldMutations).toEqual(['bridge_burned']);
    expect(gs.story.worldCorruption).toBe(8);
    expect(gs.story.pressureMeter).toBe(6);
    expect(gs.story.pendingTolls[0].tollType).toBe('gold');
    expect(gs.story.lastUndoableChoice.choiceId).toBe('c1');
  });

  it('reports unknown effects without throwing', () => {
    const gs = makeGs();
    const result = runEffects([{ type: 'future_effect' }], buildEffectContext(gs));
    expect(result.skipped).toEqual([{ type: 'future_effect', reason: 'unknown_effect' }]);
  });
});
