import { evalPredicate } from './storyPredicate.js';
import { buildEffectContext, runEffects } from './storyEffects.js';
import { tickQuestConditions } from './storyQuestEngine.js';
import { STORY_CONTENT } from './storySeedContent.js';

export function createDialogSession(gs, ref, content = getContent(gs)) {
  const target = resolveRef(ref, null, content);
  const node = getNode(content, target.poolId, target.nodeId);
  if (!node) throw new Error(`Dialog node not found: ${ref}`);
  return { poolId: target.poolId, nodeId: target.nodeId, completed: false, outcomes: [] };
}

export function currentDialogNode(session, gs, content = getContent(gs)) {
  const node = getNode(content, session.poolId, session.nodeId);
  if (!node) return null;
  return {
    ...node,
    choices: filterChoices(node.choices || [], gs),
  };
}

export function chooseDialogChoice(session, choiceId, gs, content = getContent(gs)) {
  const node = currentDialogNode(session, gs, content);
  const choice = node?.choices?.find(c => c.id === choiceId);
  if (!choice) return { ok: false, reason: 'choice_unavailable', session };
  const effects = choice.effects || adaptLegacyChoice(choice).effects || [];
  const result = runEffects(effects, buildEffectContext(gs), { dialogNodeId: node.id, choiceId });
  gs.story.dialogHistory[node.id] = {
    choiceId,
    at: new Date().toISOString(),
    effects: result.applied,
  };
  tickQuestConditions(gs, content);
  if (!choice.next) {
    session.completed = true;
    session.outcomes.push(choice.id);
    return { ok: true, completed: true, effects: result, session };
  }
  const next = resolveRef(choice.next, session.poolId, content);
  session.poolId = next.poolId;
  session.nodeId = next.nodeId;
  return { ok: true, completed: false, effects: result, node: currentDialogNode(session, gs, content), session };
}

export function filterChoices(choices, gs) {
  const context = buildEffectContext(gs);
  return choices
    .filter(choice => !choice.requires || evalPredicate(choice.requires, context))
    .map(choice => ({
      ...choice,
      label: choice.companionCondition && evalPredicate(choice.companionCondition, context)
        ? `[Companion] ${choice.label}`
        : choice.label,
    }));
}

export function resolveRef(ref, currentPoolId, content = STORY_CONTENT) {
  if (typeof ref !== 'string') throw new Error('Dialog ref must be a string.');
  if (ref.startsWith('pool:')) {
    const [, rest] = ref.split('pool:');
    const [poolId, rawNodeId] = rest.split('#');
    const nodeId = rawNodeId || null;
    if (!getNode(content, poolId, nodeId)) throw new Error(`Dialog ref does not resolve: ${ref}`);
    return { poolId, nodeId };
  }
  if (ref.startsWith('#')) {
    const nodeId = ref.slice(1);
    if (!currentPoolId || !getNode(content, currentPoolId, nodeId)) throw new Error(`Dialog ref does not resolve: ${ref}`);
    return { poolId: currentPoolId, nodeId };
  }
  const [poolId, nodeId] = ref.includes('#') ? ref.split('#') : [currentPoolId, ref];
  if (!poolId || !getNode(content, poolId, nodeId)) throw new Error(`Dialog ref does not resolve: ${ref}`);
  return { poolId, nodeId };
}

export function adaptLegacyChoice(choice) {
  const effects = [];
  if (choice.setFlag) effects.push({ type: 'set_flag', flag: choice.setFlag });
  if (choice.effect?.gold) effects.push({ type: 'gold', amount: choice.effect.gold });
  if (choice.outcome === 'fight') effects.push({ type: 'start_encounter', template: choice.encounter || 'legacy_fight' });
  return { ...choice, effects: [...effects, ...(choice.effects || [])] };
}

function getNode(content, poolId, nodeId) {
  return content.dialogPools?.[poolId]?.nodes?.[nodeId] || null;
}

function getContent(gs) {
  return gs.__storyContent || STORY_CONTENT;
}
