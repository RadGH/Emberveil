import { CLASSES } from '../../src/game/classes.js';
import { buildStartingEquipment } from '../../src/game/items.js';
import { createDefaultStoryLedger } from '../../src/story/storyLedger.js';
import { generateAct } from '../../src/story/storyMapGen.js';
import { tickQuestConditions } from '../../src/story/storyQuestEngine.js';

export function buildSyntheticGs({
  seed = 1,
  storyteller = 'chronicler',
  difficulty = 'normal',
  partyTemplate = null,
  act = 1,
} = {}) {
  const story = createDefaultStoryLedger({
    campaignSeed: String(seed),
    storytellerId: storyteller,
    difficulty,
  });
  const generated = generateAct({ seed: story.campaignSeed, act, salt: story.saltOffset || 0 });
  story.currentMapId = generated.graph.mapId;
  story.currentNodeId = generated.graph.entryNodeId;
  story.maps[generated.graph.mapId] = generated.mapSave;
  story.flags.act1_started = true;

  const party = Array.isArray(partyTemplate) && partyTemplate.length
    ? partyTemplate.map((member, idx) => makeMember(member, idx))
    : defaultParty();

  const gs = {
    gameMode: 'story',
    act,
    zoneId: generated.graph.mapId,
    nodeId: generated.graph.entryNodeId,
    mapSeed: String(seed),
    gold: 0,
    inventory: [],
    party,
    companions: [],
    story,
  };
  tickQuestConditions(gs);
  return gs;
}

function defaultParty() {
  const ids = ['warrior', 'ranger', 'cleric', 'mage'];
  return ids.map((id, index) => makeMember({ class: id, level: 1, name: `${capitalize(id)} ${index + 1}` }, index));
}

function makeMember(template, index) {
  const cls = CLASSES.find(c => c.id === (template.class || template.cls || template.classId)) || CLASSES[index % CLASSES.length];
  return {
    id: template.id || `story_member_${index + 1}`,
    name: template.name || cls.name,
    class: cls.id,
    cls: cls.id,
    className: cls.name,
    level: template.level || 1,
    xp: template.xp || 0,
    attrs: template.attrs || { STR: 10, DEX: 10, INT: 10, CON: 10 },
    equipment: template.equipment || buildStartingEquipment(cls.startingEquipment || []),
    skills: template.skills || [],
    gold: template.gold || 0,
    isCompanion: !!template.isCompanion,
  };
}

function capitalize(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Hero';
}
