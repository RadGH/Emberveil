import { SaveManager } from '../engine/SaveManager.js';
import { GameState } from '../game/gameState.js';
import { CLASSES } from '../game/classes.js';
import { buildStartingEquipment } from '../game/items.js';
import { createDefaultStoryLedger, normalizeStoryteller } from './storyLedger.js';

export function newGame(opts = {}) {
  const cls = CLASSES.find(c => c.id === (opts.classId || 'warrior')) || CLASSES[0];
  const hero = {
    id: makeId(),
    name: opts.heroName || 'Story Wanderer',
    class: cls.id,
    className: cls.name,
    appearance: cls.id,
    level: 1,
    xp: 0,
    attrs: { STR: 10, DEX: 9, INT: 8, CON: 11 },
    skills: cls.skills?.[0] ? [cls.skills[0]] : [],
    build: null,
    equipment: buildStartingEquipment(cls.startingEquipment || []),
    gold: 50,
    pendingAttrPoints: 0,
    pendingSkillPoints: 0,
    pendingPassivePoints: 0,
    autoBuild: { auto_attrs: false, auto_passive: false, auto_active: false },
    autoEquip: false,
  };
  GameState.init(hero);
  const gs = GameState.get();
  gs.gameMode = 'story';
  gs.storyVersion = 1;
  gs.story = createDefaultStoryLedger({
    ...opts,
    storytellerId: normalizeStoryteller(opts.storytellerId),
  });
  gs.act = gs.story.act;
  gs.zoneId = gs.story.currentMapId;
  gs.nodeId = gs.story.currentNodeId;
  gs.mapSeed = gs.story.campaignSeed;
  gs.fogOfWar = true;
  SaveManager.startNewSave(hero.name, 'story');
  return gs;
}

function makeId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return `story_hero_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
