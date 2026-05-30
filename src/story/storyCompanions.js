import { clampInt, COMPANION_ROSTER, QUEST_STATUS, requireStory } from './storyLedger.js';

export function getCompanion(gs, id) {
  const story = requireStory(gs);
  let companion = story.companions.find(c => c.id === id);
  if (!companion) {
    const def = COMPANION_ROSTER.find(c => c.id === id) || { id, name: id, classId: 'warrior', personalQuestId: `companion_${id}_personal` };
    companion = {
      id: def.id,
      name: def.name,
      classId: def.classId,
      personalQuestId: def.personalQuestId,
      recruited: false,
      active: false,
      alive: true,
      benchedAt: null,
      approval: 0,
      personalQuestStatus: QUEST_STATUS.INACTIVE,
    };
    story.companions.push(companion);
  }
  return companion;
}

export function recruitCompanion(gs, id) {
  const story = requireStory(gs);
  const companion = getCompanion(gs, id);
  for (const c of story.companions) c.active = false;
  companion.recruited = true;
  companion.active = true;
  companion.alive = companion.alive !== false;
  companion.benchedAt = null;
  story.activeCompanionId = companion.id;
  syncCombatCompanion(gs);
  return companion;
}

export function dismissCompanion(gs, id) {
  const story = requireStory(gs);
  const companion = getCompanion(gs, id);
  companion.active = false;
  companion.benchedAt = story.currentNodeId || null;
  if (story.activeCompanionId === id) story.activeCompanionId = null;
  syncCombatCompanion(gs);
  return companion;
}

export function adjustApproval(gs, id, amount, opts = {}) {
  const companion = getCompanion(gs, id);
  const effective = opts.inactiveHalf && !companion.active ? Number(amount || 0) / 2 : Number(amount || 0);
  companion.approval = clampInt((companion.approval || 0) + effective, -10, 10);
  return companion.approval;
}

export function swapActiveCompanion(gs, id) {
  const story = requireStory(gs);
  const next = getCompanion(gs, id);
  if (!next.recruited || next.alive === false) return false;
  for (const c of story.companions) c.active = false;
  next.active = true;
  next.benchedAt = null;
  story.activeCompanionId = next.id;
  syncCombatCompanion(gs);
  return true;
}

export function recruitedCompanions(gs) {
  return requireStory(gs).companions.filter(c => c.recruited && c.alive !== false);
}

export function maybeStartPersonalQuests(gs) {
  const story = requireStory(gs);
  const started = [];
  for (const companion of story.companions) {
    if (!companion.recruited || companion.personalQuestStarted || companion.approval < 3) continue;
    companion.personalQuestStarted = true;
    companion.personalQuestStatus = QUEST_STATUS.ACTIVE;
    story.quests[companion.personalQuestId] = story.quests[companion.personalQuestId] || {
      status: QUEST_STATUS.ACTIVE,
      phase: 'opened',
      log: [`${companion.name || companion.id} is ready to speak about unfinished business.`],
      outcomes: [],
    };
    started.push(companion.personalQuestId);
  }
  return started;
}

export function storyCompanionAsHeroMember(gs, id = requireStory(gs).activeCompanionId) {
  const companion = id ? getCompanion(gs, id) : null;
  if (!companion || !companion.recruited || companion.alive === false) return null;
  return {
    id: companion.id,
    name: companion.name,
    class: companion.classId,
    className: companion.classId,
    level: Math.max(1, Math.round(avg((gs.party || []).map(m => m.level || 1)))),
    attrs: { STR: 9, DEX: 9, INT: 9, CON: 9 },
    skills: [],
    isCompanion: true,
    _storyCompanion: true,
  };
}

export function assembleCombatParty(gs) {
  const active = storyCompanionAsHeroMember(gs);
  return active ? [...(gs.party || []), active] : [...(gs.party || [])];
}

export function syncCombatCompanion(gs) {
  const active = storyCompanionAsHeroMember(gs);
  gs.companions = active ? [active] : [];
  return gs.companions;
}

function avg(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1;
}
