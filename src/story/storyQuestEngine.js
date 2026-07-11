/**
 * storyQuestEngine.js — Quest phase tracker (§4.3 of refined plan).
 *
 * All functions are synchronous and pure against gs. Side-effects are limited
 * to mutating gs.story.quests[*] fields and calling runEffects.
 *
 * gs.__storyContent.quests[id] must be populated before any function is called.
 * Use storyContent.buildContentRegistry(loadedQuests) + gs.__storyContent to
 * wire this up in tests and the headless sim.
 *
 * Map-mutation helpers (revealPath etc.) are resolved via dynamic import from
 * storyMapMutations.js so the quest engine has no hard circular dep on the map
 * layer. In tests that don't need map mutations, the async calls simply settle
 * silently — no test pollution.
 */

import { evalPredicate } from './storyPredicate.js';
import { runEffects }    from './storyEffects.js';

// ---------------------------------------------------------------------------
// Internal context builder
// ---------------------------------------------------------------------------

/**
 * Build the predicate/effect ctx from a live gs.
 * Map-mutation helpers use dynamic import so they don't create import cycles
 * and are gracefully absent in Node test environments.
 */
function _ctx(gs) {
  return {
    gs,
    flags:      gs.story.flags,
    factions:   gs.story.factions,
    counters:   gs.story.counters,
    quests:     gs.story.quests,
    party:      gs.party || [],
    companions: gs.story.companions || [],

    revealPath: (from, to) =>
      import('./storyMapMutations.js')
        .then(m => m.revealPath(gs, from, to))
        .catch(e => console.warn('[storyQuestEngine] revealPath', e)),

    revealNodesByTag: (tag, count) =>
      import('./storyMapMutations.js')
        .then(m => m.revealNodesByTag(gs, tag, count))
        .catch(e => console.warn('[storyQuestEngine] revealNodesByTag', e)),

    unlockTransition: (id) =>
      import('./storyMapMutations.js')
        .then(m => m.unlockTransition(gs, id))
        .catch(e => console.warn('[storyQuestEngine] unlockTransition', e)),

    setWaypointState: (nodeId, state) =>
      import('./storyMapMutations.js')
        .then(m => m.setWaypointState(gs, nodeId, state))
        .catch(e => console.warn('[storyQuestEngine] setWaypointState', e)),

    queueEncounter: (template) =>
      import('./storyEncounterBuilder.js')
        .then(m => m.queueEncounter ? m.queueEncounter(gs, template) : null)
        .catch(() => {
          // storyEncounterBuilder not yet landed — record as pending flag.
          gs.story.flags[`_queued_encounter_${template}`] = true;
        }),
  };
}

// ---------------------------------------------------------------------------
// Public API — the 10 functions from §4.3
// ---------------------------------------------------------------------------

/**
 * Ensure the quest is started if its startCondition is satisfied.
 * Idempotent — does nothing if the quest is already tracked.
 */
export function ensureQuestStarted(gs, questId) {
  if (gs.story.quests[questId]) return;
  const def = gs.__storyContent?.quests?.[questId];
  if (!def) return;
  if (def.startCondition && !evalPredicate(def.startCondition, _ctx(gs))) return;
  gs.story.quests[questId] = {
    status:   'active',
    phase:    def.phases[0].id,
    log:      [`Quest started: ${def.title}`],
    outcomes: [],
  };
}

/**
 * Manually advance a quest to a specific phase.
 * Used by dialog effects (quest_advance) and direct script calls.
 */
export function advanceQuestPhase(gs, questId, phaseId) {
  const q = gs.story.quests[questId];
  if (!q) return;
  q.phase = phaseId;
  q.log.push(`Phase -> ${phaseId}`);
}

/**
 * Mark a quest as completed with an outcome id.
 */
export function completeQuest(gs, questId, outcomeId) {
  const q = gs.story.quests[questId];
  if (!q) return;
  q.status = 'completed';
  q.outcomes.push(outcomeId);
  q.log.push(`Completed via outcome: ${outcomeId}`);
}

/**
 * Mark a quest as failed.
 */
export function failQuest(gs, questId) {
  const q = gs.story.quests[questId];
  if (!q) return;
  q.status = 'failed';
  q.log.push('Quest failed.');
}

/**
 * Return all active quests as an array of { id, ...questState } objects.
 */
export function getActiveQuests(gs) {
  return Object.entries(gs.story.quests)
    .filter(([, q]) => q.status === 'active')
    .map(([id, q]) => ({ id, ...q }));
}

/**
 * Return the current phase id for a quest, or null if not tracked.
 */
export function getQuestPhase(gs, questId) {
  return gs.story.quests[questId]?.phase || null;
}

/**
 * Check all outcome conditions for a single active quest and fire the first
 * matching outcome that hasn't been applied yet.
 */
export function checkQuestOutcomes(gs, questId) {
  const def = gs.__storyContent?.quests?.[questId];
  const q   = gs.story.quests[questId];
  if (!def || !q || q.status !== 'active') return;

  const ctx = _ctx(gs);
  for (const outcome of def.outcomes || []) {
    if (q.outcomes.includes(outcome.id)) continue;
    if (evalPredicate(outcome.condition, ctx)) {
      runEffects(outcome.effects || [], ctx, { currentQuestId: questId });
      completeQuest(gs, questId, outcome.id);
      return; // one outcome per tick
    }
  }
}

/**
 * Tick all active quests:
 * 1. Check the current phase's completeCondition.
 * 2. If satisfied, run phase onComplete effects and advance.
 * 3. Check outcomes regardless.
 *
 * Call this after every node resolution (see storyMode.afterNodeResolved).
 */
export function tickQuestConditions(gs) {
  for (const id of Object.keys(gs.story.quests)) {
    const q = gs.story.quests[id];
    if (q.status !== 'active') continue;

    const def = gs.__storyContent?.quests?.[id];
    if (!def) continue;

    const ctx      = _ctx(gs);
    const phaseDef = def.phases.find(p => p.id === q.phase);

    if (phaseDef && evalPredicate(phaseDef.completeCondition, ctx)) {
      // Run phase completion effects
      runEffects(phaseDef.onComplete || [], ctx, { currentQuestId: id });

      if (phaseDef.nextPhase) {
        advanceQuestPhase(gs, id, phaseDef.nextPhase);
      } else {
        // Final phase complete — check outcomes immediately
        checkQuestOutcomes(gs, id);
      }
    } else {
      // Phase not yet complete — still check outcomes (some can fire mid-phase)
      checkQuestOutcomes(gs, id);
    }
  }
}

/**
 * Run arbitrary effects array in the quest context.
 * Thin wrapper used by the dialog bridge.
 */
export function runQuestEffects(effects, gs, extra = {}) {
  runEffects(effects, _ctx(gs), extra);
}

/**
 * Return the log array for a quest, or an empty array if not found.
 */
export function getQuestLog(gs, questId) {
  return gs.story.quests[questId]?.log || [];
}
