import { clampInt, QUEST_STATUS, requireStory, uniquePush } from './storyLedger.js';

export const EFFECT_TYPES = Object.freeze([
  'set_flag', 'clear_flag', 'set_counter', 'inc_counter', 'faction_delta',
  'companion_approval', 'recruit_companion', 'dismiss_companion', 'quest_advance',
  'quest_complete', 'quest_fail', 'quest_log', 'reveal_path', 'reveal_nodes_tag',
  'block_path', 'mutate_node', 'unlock_waypoint', 'unlock_map_transition',
  'start_encounter', 'lore_unlock', 'gold', 'reward_item', 'world_mutation',
  'corruption', 'pressure', 'add_toll', 'undoable_mark',
]);

export function runEffects(effects, ctx = {}, extra = {}) {
  const list = Array.isArray(effects) ? effects : [effects].filter(Boolean);
  const applied = [];
  const skipped = [];
  for (const effect of list) {
    if (!effect || typeof effect !== 'object') continue;
    const fn = DISPATCH[effect.type];
    if (!fn) {
      skipped.push({ type: effect.type || 'unknown', reason: 'unknown_effect' });
      continue;
    }
    fn(effect, ctx, extra);
    applied.push(effect.type);
  }
  return { applied, skipped };
}

const DISPATCH = {
  set_flag(e, ctx) { story(ctx).flags[e.flag] = true; },
  clear_flag(e, ctx) { delete story(ctx).flags[e.flag]; },
  set_counter(e, ctx) { story(ctx).counters[e.counter] = Math.trunc(Number(e.value) || 0); },
  inc_counter(e, ctx) { story(ctx).counters[e.counter] = Math.trunc(Number(story(ctx).counters[e.counter]) || 0) + Math.trunc(Number(e.amount ?? 1) || 0); },
  faction_delta(e, ctx) { story(ctx).factions[e.faction] = clampInt((story(ctx).factions[e.faction] || 0) + Number(e.amount || 0), -10, 10); },
  companion_approval(e, ctx) { companion(ctx, e.companion).approval = clampInt((companion(ctx, e.companion).approval || 0) + Number(e.amount || 0), -10, 10); },
  recruit_companion(e, ctx) {
    const c = companion(ctx, e.companion);
    c.recruited = true;
    if (!story(ctx).activeCompanionId) {
      c.active = true;
      story(ctx).activeCompanionId = c.id;
    }
  },
  dismiss_companion(e, ctx) {
    const c = companion(ctx, e.companion);
    c.active = false;
    c.recruited = false;
    if (story(ctx).activeCompanionId === c.id) story(ctx).activeCompanionId = null;
  },
  quest_advance(e, ctx) {
    const q = ensureQuest(ctx, e.questId);
    q.status = QUEST_STATUS.ACTIVE;
    q.phase = e.phase;
    pushQuestLog(q, `Advanced to ${e.phase}.`);
  },
  quest_complete(e, ctx) {
    const q = ensureQuest(ctx, e.questId);
    q.status = QUEST_STATUS.COMPLETE;
    if (e.outcomeId) uniquePush(q.outcomes, e.outcomeId);
    pushQuestLog(q, e.outcomeId ? `Completed: ${e.outcomeId}.` : 'Completed.');
  },
  quest_fail(e, ctx) {
    const q = ensureQuest(ctx, e.questId);
    q.status = QUEST_STATUS.FAILED;
    pushQuestLog(q, 'Failed.');
  },
  quest_log(e, ctx, extra) {
    const questId = e.questId || extra.currentQuestId;
    if (!questId) {
      story(ctx).dialogHistory._unscopedQuestLog = [...(story(ctx).dialogHistory._unscopedQuestLog || []), e.text];
      return;
    }
    pushQuestLog(ensureQuest(ctx, questId), e.text);
  },
  reveal_path(e, ctx) { mapMutation(ctx, { type: 'reveal_path', from: e.from, to: e.to }); },
  reveal_nodes_tag(e, ctx) { mapMutation(ctx, { type: 'reveal_nodes_tag', tag: e.tag, count: e.count || 1 }); },
  block_path(e, ctx) { mapMutation(ctx, { type: 'block_path', from: e.from, to: e.to }); },
  mutate_node(e, ctx) { mapMutation(ctx, { type: 'mutate_node', nodeId: e.nodeId, overlay: e.overlay }); },
  unlock_waypoint(e, ctx) { mapMutation(ctx, { type: 'unlock_waypoint', nodeId: e.nodeId }); },
  unlock_map_transition(e, ctx) { mapMutation(ctx, { type: 'unlock_map_transition', targetMap: e.targetMap }); },
  start_encounter(e, ctx) { story(ctx).pendingEncounters.push({ template: e.template, queuedAt: new Date().toISOString() }); },
  lore_unlock(e, ctx) { uniquePush(story(ctx).loreDiscovered, e.loreId); },
  gold(e, ctx) { ctx.gs.gold = Math.max(0, Math.trunc(Number(ctx.gs.gold || 0) + Number(e.amount || 0))); },
  reward_item(e, ctx) {
    ctx.gs.inventory = Array.isArray(ctx.gs.inventory) ? ctx.gs.inventory : [];
    ctx.gs.inventory.push(e.itemId ? { id: e.itemId, source: 'story_reward' } : generatedItem(e.generate));
  },
  world_mutation(e, ctx) { uniquePush(story(ctx).worldMutations, e.id); },
  corruption(e, ctx) { story(ctx).worldCorruption = clampInt((story(ctx).worldCorruption || 0) + Number(e.amount || 0), 0, 100); },
  pressure(e, ctx) { story(ctx).pressureMeter = clampInt((story(ctx).pressureMeter || 0) + Number(e.amount || 0), 0, 100); },
  add_toll(e, ctx) { story(ctx).pendingTolls.push({ tollType: e.tollType, value: e.value, source: e.source || 'story' }); },
  undoable_mark(e, ctx, extra) {
    story(ctx).lastUndoableChoice = {
      nodeId: extra.nodeId || story(ctx).currentNodeId,
      choiceId: extra.choiceId || null,
      markedAt: new Date().toISOString(),
    };
  },
};

export function buildEffectContext(gs, extra = {}) {
  return {
    gs,
    story: gs.story,
    flags: gs.story?.flags || {},
    factions: gs.story?.factions || {},
    quests: gs.story?.quests || {},
    counters: gs.story?.counters || {},
    companions: gs.story?.companions || [],
    party: gs.party || [],
    inventory: gs.inventory || [],
    ...extra,
  };
}

function story(ctx) {
  return requireStory(ctx.gs || ctx);
}

function companion(ctx, id) {
  const s = story(ctx);
  let c = s.companions.find(x => x.id === id);
  if (!c) {
    c = { id, recruited: false, active: false, approval: 0, personalQuestStatus: QUEST_STATUS.INACTIVE };
    s.companions.push(c);
  }
  return c;
}

function ensureQuest(ctx, id) {
  const s = story(ctx);
  if (!s.quests[id]) s.quests[id] = { status: QUEST_STATUS.INACTIVE, phase: null, outcomes: [], log: [] };
  return s.quests[id];
}

function pushQuestLog(q, text) {
  if (!Array.isArray(q.log)) q.log = [];
  if (text) q.log.push(text);
}

function mapMutation(ctx, mutation) {
  story(ctx).pendingMapMutations.push({ ...mutation, createdAt: new Date().toISOString() });
}

function generatedItem(generate = {}) {
  const kind = generate.kind || 'trinket';
  const tier = generate.tier || 1;
  return {
    id: `story_${kind}_tier_${tier}`,
    kind,
    tier,
    name: `Story ${kind}`,
    source: 'story_reward_generated',
  };
}
