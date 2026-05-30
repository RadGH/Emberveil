import { describe, expect, it } from 'vitest';
import { createDefaultStoryLedger } from '../storyLedger.js';
import { tickQuestConditions } from '../storyQuestEngine.js';
import { chooseDialogChoice, createDialogSession, currentDialogNode, resolveRef } from '../storyDialogConductor.js';
import { adjustApproval, dismissCompanion, recruitCompanion, swapActiveCompanion, maybeStartPersonalQuests, assembleCombatParty } from '../storyCompanions.js';

function makeGs() {
  return {
    gold: 0,
    inventory: [],
    party: [{ id: 'hero', name: 'Hero', class: 'warrior', level: 3 }],
    story: createDefaultStoryLedger({ campaignSeed: 'quest-dialog' }),
  };
}

describe('story quest, dialog, and companion core', () => {
  it('starts and advances the primary quest from flags and dialog choices', () => {
    const gs = makeGs();
    gs.story.flags.act1_started = true;
    expect(tickQuestConditions(gs)).toContain('primary_act1_emberwood');
    expect(gs.story.quests.primary_act1_emberwood.phase).toBe('find_the_road');

    const session = createDialogSession(gs, 'pool:arrival#arrival_emberwood_001');
    const first = currentDialogNode(session, gs);
    expect(first.choices.map(c => c.id)).toContain('ask_scout');
    chooseDialogChoice(session, 'ask_scout', gs);
    expect(gs.story.companions.find(c => c.id === 'lyra_ashwalker').recruited).toBe(true);
    expect(gs.story.quests.primary_act1_emberwood.phase).toBe('choose_first_ally');
    chooseDialogChoice(session, 'lyra_reads_tracks', gs);
    expect(gs.story.flags.gloomridge_found).toBe(true);
    tickQuestConditions(gs);
    expect(gs.story.quests.primary_act1_emberwood.phase).toBe('reach_gloomridge');
  });

  it('resolves cross-pool dialog refs and filters unavailable choices', () => {
    const gs = makeGs();
    const ref = resolveRef('pool:arrival#arrival_emberwood_002');
    expect(ref).toEqual({ poolId: 'arrival', nodeId: 'arrival_emberwood_002' });
    const session = createDialogSession(gs, 'pool:arrival#arrival_emberwood_002');
    const node = currentDialogNode(session, gs);
    expect(node.choices.map(c => c.id)).not.toContain('lyra_reads_tracks');
  });

  it('handles companion lifecycle, personal quest start, and combat assembly', () => {
    const gs = makeGs();
    recruitCompanion(gs, 'lyra_ashwalker');
    expect(gs.story.activeCompanionId).toBe('lyra_ashwalker');
    expect(adjustApproval(gs, 'lyra_ashwalker', 12)).toBe(10);
    expect(maybeStartPersonalQuests(gs)).toEqual(['companion_lyra_personal']);
    recruitCompanion(gs, 'orren_gravetide');
    expect(swapActiveCompanion(gs, 'lyra_ashwalker')).toBe(true);
    expect(assembleCombatParty(gs)).toHaveLength(2);
    dismissCompanion(gs, 'lyra_ashwalker');
    expect(gs.story.activeCompanionId).toBe(null);
  });
});
