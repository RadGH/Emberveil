import { describe, expect, it } from 'vitest';
import { createDefaultStoryLedger } from '../storyLedger.js';
import { generateAct } from '../storyMapGen.js';
import { getDirectorIntent, stepDirector } from '../storyDirector.js';
import { buildEncounterForNode } from '../storyEncounterBuilder.js';
import { STORY_SKILLS, affinityClassesForSkill, resolveStorySkillCheck } from '../storySkillCheck.js';

function makeGs(storytellerId = 'chronicler') {
  const story = createDefaultStoryLedger({ campaignSeed: 'director-test', storytellerId });
  const { graph, mapSave } = generateAct({ seed: story.campaignSeed, act: 1 });
  story.currentMapId = graph.mapId;
  story.currentNodeId = graph.entryNodeId;
  story.maps[graph.mapId] = mapSave;
  return {
    party: [{ id: 'hero', name: 'Hero', class: 'warrior', level: 4, attrs: { STR: 14, DEX: 10, INT: 10, CON: 12 } }],
    companions: [],
    gold: 0,
    inventory: [],
    story,
  };
}

describe('story director, encounter builder, and skill checks', () => {
  it('produces a scoring intent and advances the director clock', () => {
    const gs = makeGs('warbringer');
    const preview = getDirectorIntent(gs);
    expect(preview.candidates.length).toBeGreaterThan(0);
    expect(preview.intent).toBeTruthy();
    const intent = stepDirector(gs);
    expect(intent).toBeTruthy();
    expect(gs.story.counters.directorTick).toBe(1);
  });

  it('builds a non-null encounter for a travel node and a combat node', () => {
    const gs = makeGs('pilgrim');
    const { graph } = generateAct({ seed: gs.story.campaignSeed, act: 1 });
    const travelNode = Object.values(graph.nodes).find(node => node.type === 'dialog' && !node.tags?.includes('boss'));
    const combatNode = Object.values(graph.nodes).find(node => node.type === 'combat' || node.type === 'boss');
    expect(buildEncounterForNode(gs, travelNode.id).enemies.length).toBeGreaterThan(0);
    expect(buildEncounterForNode(gs, combatNode.id).enemies.length).toBeGreaterThan(0);
  });

  it('exposes the skill affinity table and resolves a pass/fail check', () => {
    expect(STORY_SKILLS).toHaveLength(18);
    expect(affinityClassesForSkill('arcana')).toContain('mage');
    const result = resolveStorySkillCheck(makeGs(), { skill: 'athletics', dc: 8 });
    expect(['pass', 'partial', 'fail']).toContain(result.outcome);
  });

  it('biases combat candidates differently for distinct storytellers', () => {
    const chronicler = makeGs('chronicler');
    const warbringer = makeGs('warbringer');

    const combatNode = Object.values(generateAct({ seed: chronicler.story.campaignSeed, act: 1 }).graph.nodes)
      .find(node => node.type === 'combat' || node.type === 'boss');
    chronicler.story.currentNodeId = combatNode.id;
    warbringer.story.currentNodeId = combatNode.id;
    chronicler.story.recentHistory.nodeTypes = ['combat', 'combat'];
    chronicler.story.recentHistory.winStreak = 2;
    chronicler.story.pressureMeter = 65;
    warbringer.story.recentHistory.nodeTypes = ['combat', 'combat'];
    warbringer.story.recentHistory.winStreak = 2;
    warbringer.story.pressureMeter = 65;

    const chroniclerIntent = getDirectorIntent(chronicler);
    const warbringerIntent = getDirectorIntent(warbringer);
    expect(warbringerIntent.intent.scoreBeforeNorm).toBeLessThan(chroniclerIntent.intent.scoreBeforeNorm);
  });
});
