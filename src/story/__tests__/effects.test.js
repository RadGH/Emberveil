/**
 * effects.test.js — Unit tests for runEffects (22 effect types + 3 clamp tests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runEffects, recordDialogChoice, registerItemsModule } from '../storyEffects.js';

// ---------------------------------------------------------------------------
// Test gs factory
// ---------------------------------------------------------------------------
function makeGs(overrides = {}) {
  return {
    gold: 100,
    party: [],
    story: {
      flags:          {},
      counters:       {},
      factions:       {},
      quests:         { q1: { status: 'active', phase: 'p1', log: [], outcomes: [] } },
      companions:     [
        { id: 'lyra', recruited: false, active: false, approval: 0, alive: true },
        { id: 'orren', recruited: true, active: true, approval: 5, alive: true },
      ],
      activeCompanionId: null,
      loreDiscovered:   [],
      worldMutations:   [],
      worldCorruption:  0,
      pressureMeter:    50,
      pendingTolls:     [],
      lastUndoableChoice: null,
    },
    ...overrides,
  };
}

function ctx(gs, extra = {}) {
  return {
    gs,
    flags:      gs.story.flags,
    factions:   gs.story.factions,
    counters:   gs.story.counters,
    quests:     gs.story.quests,
    party:      gs.party,
    companions: gs.story.companions,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('runEffects', () => {
  let gs;
  beforeEach(() => { gs = makeGs(); });

  // 1. set_flag
  it('set_flag sets the flag', () => {
    runEffects([{ type: 'set_flag', flag: 'shrine_purified' }], ctx(gs));
    expect(gs.story.flags.shrine_purified).toBe(true);
  });

  // 2. clear_flag
  it('clear_flag removes the flag', () => {
    gs.story.flags.shrine_purified = true;
    runEffects([{ type: 'clear_flag', flag: 'shrine_purified' }], ctx(gs));
    expect(gs.story.flags.shrine_purified).toBeUndefined();
  });

  // 3. set_counter
  it('set_counter sets to value', () => {
    runEffects([{ type: 'set_counter', counter: 'kills', value: 10 }], ctx(gs));
    expect(gs.story.counters.kills).toBe(10);
  });

  // 4. inc_counter
  it('inc_counter increments', () => {
    gs.story.counters.kills = 3;
    runEffects([{ type: 'inc_counter', counter: 'kills', amount: 2 }], ctx(gs));
    expect(gs.story.counters.kills).toBe(5);
  });

  // 5. faction_delta
  it('faction_delta adjusts faction', () => {
    runEffects([{ type: 'faction_delta', faction: 'emberguard', amount: 3 }], ctx(gs));
    expect(gs.story.factions.emberguard).toBe(3);
  });

  // 6. faction_delta clamp at +10
  it('faction_delta clamps at 10', () => {
    gs.story.factions.emberguard = 8;
    runEffects([{ type: 'faction_delta', faction: 'emberguard', amount: 5 }], ctx(gs));
    expect(gs.story.factions.emberguard).toBe(10);
  });

  // 7. faction_delta clamp at -10
  it('faction_delta clamps at -10', () => {
    gs.story.factions.ashen_veil = -8;
    runEffects([{ type: 'faction_delta', faction: 'ashen_veil', amount: -5 }], ctx(gs));
    expect(gs.story.factions.ashen_veil).toBe(-10);
  });

  // 8. companion_approval
  it('companion_approval adjusts orren', () => {
    runEffects([{ type: 'companion_approval', companion: 'orren', amount: 2 }], ctx(gs));
    expect(gs.story.companions.find(c => c.id === 'orren').approval).toBe(7);
  });

  // 9. companion_approval clamp
  it('companion_approval clamps at 10', () => {
    gs.story.companions.find(c => c.id === 'orren').approval = 9;
    runEffects([{ type: 'companion_approval', companion: 'orren', amount: 5 }], ctx(gs));
    expect(gs.story.companions.find(c => c.id === 'orren').approval).toBe(10);
  });

  // 10. recruit_companion
  it('recruit_companion marks recruited', () => {
    runEffects([{ type: 'recruit_companion', companion: 'lyra' }], ctx(gs));
    expect(gs.story.companions.find(c => c.id === 'lyra').recruited).toBe(true);
  });

  // 11. dismiss_companion
  it('dismiss_companion deactivates', () => {
    gs.story.activeCompanionId = 'orren';
    runEffects([{ type: 'dismiss_companion', companion: 'orren' }], ctx(gs));
    expect(gs.story.companions.find(c => c.id === 'orren').active).toBe(false);
    expect(gs.story.activeCompanionId).toBeNull();
  });

  // 12. quest_advance
  it('quest_advance changes phase', () => {
    runEffects([{ type: 'quest_advance', questId: 'q1', phase: 'p2' }], ctx(gs));
    expect(gs.story.quests.q1.phase).toBe('p2');
  });

  // 13. quest_complete
  it('quest_complete marks completed', () => {
    runEffects([{ type: 'quest_complete', questId: 'q1', outcomeId: 'good_ending' }], ctx(gs));
    expect(gs.story.quests.q1.status).toBe('completed');
    expect(gs.story.quests.q1.outcomes).toContain('good_ending');
  });

  // 14. quest_fail
  it('quest_fail marks failed', () => {
    runEffects([{ type: 'quest_fail', questId: 'q1' }], ctx(gs));
    expect(gs.story.quests.q1.status).toBe('failed');
  });

  // 15. quest_log with extra.currentQuestId
  it('quest_log appends to quest log', () => {
    runEffects([{ type: 'quest_log', text: 'Found the clue.' }], ctx(gs), { currentQuestId: 'q1' });
    expect(gs.story.quests.q1.log).toContain('Found the clue.');
  });

  // 16. lore_unlock
  it('lore_unlock adds lore id', () => {
    runEffects([{ type: 'lore_unlock', loreId: 'ash_origin' }], ctx(gs));
    expect(gs.story.loreDiscovered).toContain('ash_origin');
  });

  // 17. lore_unlock deduplicated
  it('lore_unlock deduplicates', () => {
    runEffects([{ type: 'lore_unlock', loreId: 'ash_origin' }], ctx(gs));
    runEffects([{ type: 'lore_unlock', loreId: 'ash_origin' }], ctx(gs));
    expect(gs.story.loreDiscovered.filter(x => x === 'ash_origin').length).toBe(1);
  });

  // 18. gold
  it('gold adds gold', () => {
    runEffects([{ type: 'gold', amount: 50 }], ctx(gs));
    expect(gs.gold).toBe(150);
  });

  // 19. gold clamp at 0 (negative)
  it('gold does not go below 0', () => {
    runEffects([{ type: 'gold', amount: -200 }], ctx(gs));
    expect(gs.gold).toBe(0);
  });

  // 20. world_mutation
  it('world_mutation adds id', () => {
    runEffects([{ type: 'world_mutation', id: 'crossroads_burned' }], ctx(gs));
    expect(gs.story.worldMutations).toContain('crossroads_burned');
  });

  // 21. corruption
  it('corruption increases worldCorruption', () => {
    runEffects([{ type: 'corruption', amount: 20 }], ctx(gs));
    expect(gs.story.worldCorruption).toBe(20);
  });

  // 22. corruption clamp at 100
  it('corruption clamps at 100', () => {
    gs.story.worldCorruption = 95;
    runEffects([{ type: 'corruption', amount: 20 }], ctx(gs));
    expect(gs.story.worldCorruption).toBe(100);
  });

  // 23. pressure
  it('pressure increases pressureMeter', () => {
    runEffects([{ type: 'pressure', amount: 10 }], ctx(gs));
    expect(gs.story.pressureMeter).toBe(60);
  });

  // 24. pressure clamp at 0
  it('pressure clamps at 0', () => {
    gs.story.pressureMeter = 5;
    runEffects([{ type: 'pressure', amount: -20 }], ctx(gs));
    expect(gs.story.pressureMeter).toBe(0);
  });

  // 25. add_toll
  it('add_toll pushes toll', () => {
    runEffects([{ type: 'add_toll', tollType: 'gold', value: 50, source: 'bridge_keeper' }], ctx(gs));
    expect(gs.story.pendingTolls.length).toBe(1);
    expect(gs.story.pendingTolls[0].type).toBe('gold');
  });

  // 26. undoable_mark
  it('undoable_mark sets lastUndoableChoice', () => {
    runEffects([{ type: 'undoable_mark' }], ctx(gs));
    expect(gs.story.lastUndoableChoice).not.toBeNull();
    expect(typeof gs.story.lastUndoableChoice.ts).toBe('number');
  });

  // 27. reveal_path with stub ctx helper
  it('reveal_path calls ctx.revealPath', () => {
    const revealPath = vi.fn();
    runEffects([{ type: 'reveal_path', from: 'n1', to: 'n2' }], { ...ctx(gs), revealPath });
    expect(revealPath).toHaveBeenCalledWith('n1', 'n2');
  });

  // 28. unknown effect type -> console.warn + skip (no throw)
  it('unknown type warns and skips', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => runEffects([{ type: 'does_not_exist', x: 1 }], ctx(gs))).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // 29. empty effects array is a no-op
  it('empty effects array is a no-op', () => {
    expect(() => runEffects([], ctx(gs))).not.toThrow();
    expect(gs.gold).toBe(100);
  });

  // 30. null effects array is a no-op
  it('null effects array is a no-op', () => {
    expect(() => runEffects(null, ctx(gs))).not.toThrow();
  });

  // 31. reward_item — no inventory → push to _pendingRewards, no crash
  it('reward_item with no inventory queues to _pendingRewards', () => {
    runEffects([{ type: 'reward_item', generate: { kind: 'sword', tier: 'normal' } }], ctx(gs));
    expect(Array.isArray(gs._pendingRewards)).toBe(true);
    expect(gs._pendingRewards.length).toBe(1);
    expect(gs._pendingRewards[0].generate.kind).toBe('sword');
  });

  // 32. reward_item — inventory present + items module registered → item pushed to inventory
  it('reward_item with inventory and registered items module generates item', () => {
    const fakeItem = { id: 'fake-uuid', name: 'Iron Sword', baseKey: 'iron_sword' };
    registerItemsModule({ generateItem: () => fakeItem });

    gs.inventory = [];
    runEffects([{ type: 'reward_item', generate: { kind: 'iron_sword', tier: 'normal' } }], ctx(gs));
    expect(gs.inventory).toHaveLength(1);
    expect(gs.inventory[0].name).toBe('Iron Sword');

    registerItemsModule(null);
  });

  // 33. reward_item — items module returns null (unknown key) → queues to _pendingRewards
  it('reward_item queues to _pendingRewards when generator returns null', () => {
    registerItemsModule({ generateItem: () => null });

    gs.inventory = [];
    runEffects([{ type: 'reward_item', itemId: 'unknown_base' }], ctx(gs));
    expect(gs._pendingRewards.length).toBe(1);

    registerItemsModule(null);
  });
});

// ---------------------------------------------------------------------------
// recordDialogChoice
// ---------------------------------------------------------------------------
describe('recordDialogChoice', () => {
  it('records a choice in dialogHistory', () => {
    const gs = makeGs();
    gs.story.dialogHistory = {};
    recordDialogChoice(gs, 'node_1', 'choice_a');
    expect(gs.story.dialogHistory.node_1.choiceId).toBe('choice_a');
    expect(typeof gs.story.dialogHistory.node_1.ts).toBe('number');
  });

  it('overwrites prior choice for same node', () => {
    const gs = makeGs();
    gs.story.dialogHistory = { node_1: { choiceId: 'old', ts: 0 } };
    recordDialogChoice(gs, 'node_1', 'new_choice');
    expect(gs.story.dialogHistory.node_1.choiceId).toBe('new_choice');
  });
});
