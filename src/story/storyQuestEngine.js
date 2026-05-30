import { evalPredicate } from './storyPredicate.js';
import { buildEffectContext, runEffects } from './storyEffects.js';
import { QUEST_STATUS } from './storyLedger.js';
import { STORY_CONTENT } from './storySeedContent.js';

export function ensureQuestStarted(gs, questId, content = getContent(gs)) {
  const def = content.quests[questId];
  if (!def || gs.story.quests[questId]) return false;
  if (def.startCondition && !evalPredicate(def.startCondition, ctx(gs))) return false;
  gs.story.quests[questId] = {
    status: QUEST_STATUS.ACTIVE,
    phase: def.phases[0]?.id || null,
    log: [`Quest started: ${def.title}`],
    outcomes: [],
  };
  return true;
}

export function startEligibleQuests(gs, content = getContent(gs)) {
  return Object.keys(content.quests).filter(id => ensureQuestStarted(gs, id, content));
}

export function advanceQuestPhase(gs, questId, phaseId) {
  const q = gs.story.quests[questId];
  if (!q) return false;
  q.phase = phaseId;
  q.log.push(`Phase -> ${phaseId}`);
  return true;
}

export function completeQuest(gs, questId, outcomeId) {
  const q = gs.story.quests[questId];
  if (!q) return false;
  q.status = QUEST_STATUS.COMPLETE;
  if (outcomeId && !q.outcomes.includes(outcomeId)) q.outcomes.push(outcomeId);
  q.log.push(outcomeId ? `Completed via outcome: ${outcomeId}` : 'Completed.');
  return true;
}

export function failQuest(gs, questId) {
  const q = gs.story.quests[questId];
  if (!q) return false;
  q.status = QUEST_STATUS.FAILED;
  q.log.push('Quest failed.');
  return true;
}

export function getActiveQuests(gs) {
  return Object.entries(gs.story.quests)
    .filter(([, q]) => q.status === QUEST_STATUS.ACTIVE)
    .map(([id, q]) => ({ id, ...q }));
}

export function getQuestPhase(gs, questId) {
  return gs.story.quests[questId]?.phase || null;
}

export function checkQuestOutcomes(gs, questId, content = getContent(gs)) {
  const def = content.quests[questId];
  const q = gs.story.quests[questId];
  if (!def || !q || q.status !== QUEST_STATUS.ACTIVE) return [];
  const fired = [];
  for (const outcome of def.outcomes || []) {
    if (q.outcomes.includes(outcome.id)) continue;
    if (!evalPredicate(outcome.condition, ctx(gs))) continue;
    runEffects(outcome.effects || [], buildEffectContext(gs), { currentQuestId: questId });
    completeQuest(gs, questId, outcome.id);
    fired.push(outcome.id);
  }
  return fired;
}

export function tickQuestConditions(gs, content = getContent(gs)) {
  const changed = startEligibleQuests(gs, content);
  for (const questId of Object.keys(gs.story.quests)) {
    const q = gs.story.quests[questId];
    if (q.status !== QUEST_STATUS.ACTIVE) continue;
    const def = content.quests[questId];
    const phase = def?.phases?.find(p => p.id === q.phase);
    if (phase && evalPredicate(phase.completeCondition, ctx(gs))) {
      runEffects(phase.onComplete || [], buildEffectContext(gs), { currentQuestId: questId });
      if (phase.nextPhase) advanceQuestPhase(gs, questId, phase.nextPhase);
      else checkQuestOutcomes(gs, questId, content);
      changed.push(questId);
    } else {
      const outcomes = checkQuestOutcomes(gs, questId, content);
      if (outcomes.length) changed.push(questId);
    }
  }
  return changed;
}

export function runQuestEffects(effects, gs, extra = {}) {
  return runEffects(effects, buildEffectContext(gs), extra);
}

export function getQuestLog(gs, questId) {
  return gs.story.quests[questId]?.log || [];
}

function ctx(gs) {
  return buildEffectContext(gs);
}

function getContent(gs) {
  return gs.__storyContent || STORY_CONTENT;
}
