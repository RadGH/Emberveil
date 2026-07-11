/**
 * storyEffects.js — Effect runner for the Story Mode DSL (§5.1).
 *
 * runEffects(effects, ctx, extra?) dispatches all 22+ effect types via a
 * lookup table. Unknown types -> console.warn + skip (never throw, so bad
 * authored content cannot brick a run).
 *
 * ctx shape (same as predicate ctx, plus helpers):
 *   { gs, flags, factions, counters, quests, party, companions,
 *     revealPath, revealNodesByTag, unlockTransition, setWaypointState,
 *     queueEncounter }
 *
 * extra: { currentQuestId? } — populated when run from quest engine.
 */

import { setUniquePush } from './storyLedger.js';
import { recruitCompanion as _recruitCompanion, dismissCompanion as _dismissCompanion, applyApproval as _applyApproval } from './storyCompanions.js';
import { advanceQuestPhase as _advanceQuestPhase, failQuest as _failQuest, completeQuest as _completeQuest, tickQuestConditions as _tickQuestConditions } from './storyQuestEngine.js';

// ---------------------------------------------------------------------------
// Clamp helpers
// ---------------------------------------------------------------------------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Lazy item-module accessor (breaks circular dependency at evaluation time)
// ---------------------------------------------------------------------------

// Cache reference so the dynamic import only resolves once after the module
// graph settles. In tests that need reward_item to generate real items, call
// _registerItemsModule(import('./src/game/items.js')) once in test setup.
let _itemsModuleCache = null;

/**
 * Register the items module for reward_item fulfillment.
 * Called automatically by the game bootstrap; can also be called in tests.
 * @param {object} mod — module object with a `generateItem` export
 */
export function registerItemsModule(mod) {
  _itemsModuleCache = mod;
}

function _getItemsModule() {
  if (_itemsModuleCache) return _itemsModuleCache;
  // Attempt to reach the module via globalThis (set by game bootstrap when
  // items.js loads, e.g. globalThis.__emberveilItems = itemsModule).
  if (typeof globalThis !== 'undefined' && globalThis.__emberveilItems) {
    _itemsModuleCache = globalThis.__emberveilItems;
    return _itemsModuleCache;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Effect handler lookup table. Each fn receives (effect, ctx, extra).
// ---------------------------------------------------------------------------
const HANDLERS = {

  // --- Flags ---
  set_flag(eff, ctx) {
    ctx.gs.story.flags[eff.flag] = true;
  },
  clear_flag(eff, ctx) {
    delete ctx.gs.story.flags[eff.flag];
  },

  // --- Counters ---
  set_counter(eff, ctx) {
    ctx.gs.story.counters[eff.counter] = Number(eff.value) || 0;
  },
  inc_counter(eff, ctx) {
    const cur = ctx.gs.story.counters[eff.counter] ?? 0;
    ctx.gs.story.counters[eff.counter] = cur + (Number(eff.amount) || 1);
  },

  // --- Factions ---
  faction_delta(eff, ctx) {
    const cur = ctx.gs.story.factions[eff.faction] ?? 0;
    ctx.gs.story.factions[eff.faction] = clamp(cur + (Number(eff.amount) || 0), -10, 10);
  },

  // --- Companions — delegate to storyCompanions.js ---
  companion_approval(eff, ctx) {
    _applyApproval(ctx.gs, eff.companion, Number(eff.amount) || 0);
  },
  recruit_companion(eff, ctx) {
    _recruitCompanion(ctx.gs, eff.companion);
  },
  dismiss_companion(eff, ctx) {
    _dismissCompanion(ctx.gs, eff.companion);
  },

  // --- Quests — delegate to storyQuestEngine.js ---
  quest_advance(eff, ctx, extra) {
    _advanceQuestPhase(ctx.gs, eff.questId, eff.phase);
    // Tick conditions after phase advance so downstream predicates can fire.
    if (ctx.gs.__storyContent) _tickQuestConditions(ctx.gs);
  },
  quest_complete(eff, ctx) {
    _completeQuest(ctx.gs, eff.questId, eff.outcomeId || 'unknown');
  },
  quest_fail(eff, ctx) {
    _failQuest(ctx.gs, eff.questId);
  },
  quest_log(eff, ctx, extra) {
    const questId = extra?.currentQuestId || eff.questId;
    if (!questId) return;
    const q = ctx.gs.story.quests[questId];
    if (q) q.log.push(eff.text || '');
  },

  // --- Map mutations (async-deferred; we call the helper from storyMapMutations
  //     when it's available, else we record the pending mutation on gs.story) ---
  reveal_path(eff, ctx) {
    if (typeof ctx.revealPath === 'function') {
      const result = ctx.revealPath(eff.from, eff.to);
      // If it returns a Promise (dynamic import path), ignore the value — the
      // mutation will apply when the promise settles.
      if (result && typeof result.catch === 'function') result.catch(e => console.warn('[storyEffects] reveal_path async error', e));
    } else {
      // No helper yet (M-S05 not landed) — record as pending
      ctx.gs.story.flags[`_pending_reveal_${eff.from}_${eff.to}`] = true;
    }
  },
  reveal_nodes_tag(eff, ctx) {
    if (typeof ctx.revealNodesByTag === 'function') {
      const result = ctx.revealNodesByTag(eff.tag, eff.count);
      if (result && typeof result.catch === 'function') result.catch(e => console.warn('[storyEffects] reveal_nodes_tag async error', e));
    }
    // If no helper: silent skip (map not yet generated in M-S01..04)
  },
  block_path(eff, ctx) {
    if (typeof ctx.blockPath === 'function') {
      const r = ctx.blockPath(eff.from, eff.to);
      if (r && typeof r.catch === 'function') r.catch(e => console.warn('[storyEffects] block_path async error', e));
    } else {
      // No helper yet — record as pending flag.
      ctx.gs.story.flags[`_pending_block_${eff.from}_${eff.to}`] = true;
    }
  },
  mutate_node(eff, ctx) {
    if (typeof ctx.mutateNode === 'function') {
      ctx.mutateNode(eff.nodeId, eff.overlay);
    } else {
      // Fallback: apply worldCorruption side-effect inline (M-S04 behaviour).
      if (eff.overlay === 'corrupted') {
        ctx.gs.story.worldCorruption = clamp((ctx.gs.story.worldCorruption || 0) + 5, 0, 100);
      } else if (eff.overlay === 'cleansed') {
        ctx.gs.story.worldCorruption = clamp((ctx.gs.story.worldCorruption || 0) - 3, 0, 100);
      }
      ctx.gs.story.flags[`_node_overlay_${eff.nodeId}`] = eff.overlay;
    }
  },
  unlock_waypoint(eff, ctx) {
    if (typeof ctx.setWaypointState === 'function') {
      const r = ctx.setWaypointState(eff.nodeId, 'activated');
      if (r && typeof r.catch === 'function') r.catch(e => console.warn('[storyEffects] unlock_waypoint error', e));
    } else {
      ctx.gs.story.flags[`_waypoint_activated_${eff.nodeId}`] = true;
    }
  },
  unlock_map_transition(eff, ctx) {
    if (typeof ctx.unlockTransition === 'function') {
      const r = ctx.unlockTransition(eff.targetMap);
      if (r && typeof r.catch === 'function') r.catch(e => console.warn('[storyEffects] unlock_map_transition error', e));
    } else {
      ctx.gs.story.flags[`transition_${eff.targetMap}`] = true;
    }
  },

  // --- Encounters ---
  start_encounter(eff, ctx) {
    if (typeof ctx.queueEncounter === 'function') {
      const r = ctx.queueEncounter(eff.template);
      if (r && typeof r.catch === 'function') r.catch(e => console.warn('[storyEffects] start_encounter error', e));
    } else {
      ctx.gs.story.flags[`_queued_encounter_${eff.template}`] = true;
    }
  },

  // --- Lore ---
  lore_unlock(eff, ctx) {
    setUniquePush(ctx.gs.story.loreDiscovered, eff.loreId);
  },

  // --- Gold ---
  gold(eff, ctx) {
    ctx.gs.gold = Math.max(0, (ctx.gs.gold || 0) + (Number(eff.amount) || 0));
  },

  // --- Items ---
  reward_item(eff, ctx) {
    // Gracefully no-op when there is no inventory (synthetic gs in sim / tests).
    if (!ctx.gs.inventory) {
      // Still push to _pendingRewards so callers that process it themselves can pick it up.
      if (!ctx.gs._pendingRewards) ctx.gs._pendingRewards = [];
      ctx.gs._pendingRewards.push({ itemId: eff.itemId, generate: eff.generate });
      return;
    }

    // Attempt immediate fulfillment via the item generator.
    let item = null;

    if (eff.generate?.kind) {
      // Lazy import avoids circular dependency at module evaluation time.
      try {
        // In browser/Vite: generateItem is the synchronous generator from items.js.
        // We use a dynamic require-style approach: if the module is already loaded in
        // the JS module graph, this is effectively synchronous at call time.
        const { generateItem } = _getItemsModule();
        if (generateItem) {
          item = generateItem(eff.generate.kind, eff.generate.tier || 'normal', eff.generate.quality || 'medium');
        }
      } catch (_) {
        // items.js not available (headless sim without full bundle) — fall back to pending queue.
      }
    } else if (eff.itemId) {
      // Look up by itemId if provided (static reward by base key).
      try {
        const { generateItem } = _getItemsModule();
        if (generateItem) {
          item = generateItem(eff.itemId, eff.rarity || 'normal', eff.quality || 'medium');
        }
      } catch (_) {
        // Fall through to pending queue.
      }
    }

    if (item) {
      ctx.gs.inventory.push(item);
    } else {
      // Fulfillment failed (items module unavailable or unknown key) — queue for deferred processing.
      if (!ctx.gs._pendingRewards) ctx.gs._pendingRewards = [];
      ctx.gs._pendingRewards.push({ itemId: eff.itemId, generate: eff.generate });
    }
  },

  // --- World mutations ---
  world_mutation(eff, ctx) {
    if (typeof ctx.applyWorldMutation === 'function') {
      ctx.applyWorldMutation(eff.id);
    } else {
      setUniquePush(ctx.gs.story.worldMutations, eff.id);
    }
  },

  // --- Corruption ---
  corruption(eff, ctx) {
    ctx.gs.story.worldCorruption = clamp(
      (ctx.gs.story.worldCorruption || 0) + (Number(eff.amount) || 0),
      0, 100
    );
  },

  // --- Pressure ---
  pressure(eff, ctx) {
    ctx.gs.story.pressureMeter = clamp(
      (ctx.gs.story.pressureMeter ?? 50) + (Number(eff.amount) || 0),
      0, 100
    );
  },

  // --- Tolls ---
  add_toll(eff, ctx) {
    if (!ctx.gs.story.pendingTolls) ctx.gs.story.pendingTolls = [];
    ctx.gs.story.pendingTolls.push({
      type: eff.tollType,
      value: eff.value,
      source: eff.source || '',
    });
  },

  // --- Memory Shrine undo marker ---
  undoable_mark(eff, ctx) {
    ctx.gs.story.lastUndoableChoice = {
      ts: Date.now(),
      nodeId: ctx.currentNodeId || null,
    };
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run an array of effect objects against ctx.
 * @param {object[]} effects
 * @param {object} ctx - { gs, flags, factions, counters, quests, party, companions, ... }
 * @param {object} [extra] - { currentQuestId?, currentNodeId? }
 */
export function runEffects(effects, ctx, extra = {}) {
  if (!Array.isArray(effects) || !effects.length) return;
  for (const eff of effects) {
    if (!eff || typeof eff.type !== 'string') {
      console.warn('[storyEffects] malformed effect (no type)', eff);
      continue;
    }
    const handler = HANDLERS[eff.type];
    if (!handler) {
      console.warn('[storyEffects] unknown effect type', eff.type, eff);
      continue;
    }
    try {
      handler(eff, ctx, extra);
    } catch (err) {
      console.warn('[storyEffects] handler threw for type', eff.type, err);
    }
  }
}

/**
 * Record a dialog choice in gs.story.dialogHistory.
 * Also exported here so callers don't need a separate import.
 */
export function recordDialogChoice(gs, nodeId, choiceId) {
  if (!gs?.story) return;
  gs.story.dialogHistory[nodeId] = { choiceId, ts: Date.now() };
}
