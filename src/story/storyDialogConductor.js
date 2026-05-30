/**
 * storyDialogConductor.js — Story Mode dialog pool loader + routing (§5).
 *
 * Responsibilities:
 *   loadNode(poolId, nodeId)      - lazy load pool, return the node object.
 *   filterChoices(node, ctx)      - apply predicate to requires + companionCondition.
 *   resolveNext(nextValue, poolId) - handle null / #localId / pool:X#nodeY.
 *   applyChoice(gs, choice, ctx) - run effects, record, return { nextRef, effectFeedback }.
 *   adaptLegacyChoice(choice)     - back-compat: old-shape -> new effects[] array.
 *
 * Cross-pool routing: 'pool:poolId#nodeId' prefix.
 * Legacy content (src/maps/dialogEvents.js etc.) is NEVER modified per §5.3.
 */

import { evalPredicate }   from './storyPredicate.js';
import { runEffects, recordDialogChoice } from './storyEffects.js';
import { loadDialoguePool } from './storyContent.js';
import { resolveSkillCheck } from './storySkillCheck.js';

// ---------------------------------------------------------------------------
// Internal pool cache (separate from storyContent._dialogCache so the
// conductor can hold parsed nodes by id for fast lookup)
// ---------------------------------------------------------------------------
const _loadedPools = {}; // poolId -> { [nodeId]: node }

// ---------------------------------------------------------------------------
// Pool loading
// ---------------------------------------------------------------------------

/**
 * Load a dialogue pool and index it by node id.
 * Returns the pool index object synchronously if already cached;
 * returns a Promise<index> on first load (browser fetch path).
 * In Node (tests), storyContent._readNode is synchronous so this also resolves
 * synchronously.
 */
function _ensurePool(poolId) {
  if (_loadedPools[poolId]) return _loadedPools[poolId];

  const result = loadDialoguePool(poolId);
  if (result && typeof result.then === 'function') {
    return result.then(pool => {
      _loadedPools[poolId] = _indexPool(pool);
      return _loadedPools[poolId];
    });
  }
  _loadedPools[poolId] = _indexPool(result);
  return _loadedPools[poolId];
}

function _indexPool(poolData) {
  // Pool can be an array of nodes OR an object keyed by nodeId.
  if (Array.isArray(poolData)) {
    const idx = {};
    for (const node of poolData) { if (node?.id) idx[node.id] = node; }
    return idx;
  }
  return poolData || {};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a node from a pool by id. Returns node or Promise<node>.
 */
export function loadNode(poolId, nodeId) {
  const poolOrPromise = _ensurePool(poolId);
  if (poolOrPromise && typeof poolOrPromise.then === 'function') {
    return poolOrPromise.then(pool => pool[nodeId] || null);
  }
  return poolOrPromise[nodeId] || null;
}

/**
 * Filter choices based on predicate `requires` and `companionCondition`.
 * Returns a new array — hidden choices are removed; companion-conditioned
 * choices get a _companionLabel property the screen uses to render the badge.
 *
 * @param {object} node - dialog node with a choices array
 * @param {object} ctx  - predicate context { flags, factions, quests, counters, party, companions }
 * @returns {object[]} filtered and annotated choices
 */
export function filterChoices(node, ctx) {
  const choices = node?.choices || [];
  const out = [];
  for (const choice of choices) {
    // Hard gate via `requires` predicate
    if (choice.requires) {
      if (!evalPredicate(choice.requires, ctx)) continue; // hidden
    }
    // Companion condition — satisfied choices get a badge
    let companionLabel = null;
    if (choice.companionCondition) {
      if (evalPredicate(choice.companionCondition, ctx)) {
        // Resolve companion name for the label
        const companionId = choice.companionCondition.companion;
        const cEntry = (ctx.companions || []).find(c => c.id === companionId);
        const def    = cEntry ? { name: cEntry.id } : null;
        // Try to get the def name from the storyCompanions module (may not be
        // imported here to avoid cycles). Fall back to the raw id.
        companionLabel = companionId || 'Companion';
        // Attempt to pull the human name from companions ledger
        if (cEntry && ctx.gs?.story) {
          // Inline the name lookup (no circular import)
          const names = {
            lyra_ashwalker: 'Lyra', orren_gravetide: 'Orren',
            tessaly_veil: 'Tessaly', bram_coldfire: 'Bram',
            yasha_stonewill: 'Yasha', captain_maer: 'Maer',
          };
          companionLabel = names[companionId] || companionId;
        }
      }
      // companionCondition not satisfied? The choice is still visible but
      // without the badge (it just won't have the special companion flavor).
      // This is intentional: the choice text might still be selectable.
    }
    out.push({ ...choice, _companionLabel: companionLabel });
  }
  return out;
}

/**
 * Resolve a next: value to { poolId, nodeId } or null (end node).
 *
 * Accepted formats:
 *   null             -> end node
 *   '#localNodeId'   -> same pool, given node
 *   'pool:X#Y'       -> pool X, node Y
 *   'localNodeId'    -> same pool (no leading #) — legacy compat
 *
 * @param {string|null} nextValue - raw next value from a node
 * @param {string} currentPoolId  - pool of the current node
 * @returns {{ poolId: string, nodeId: string }|null}
 */
export function resolveNext(nextValue, currentPoolId) {
  if (nextValue === null || nextValue === undefined) return null;
  if (typeof nextValue !== 'string') return null;

  if (nextValue.startsWith('pool:')) {
    // 'pool:poolId#nodeId'
    const rest   = nextValue.slice(5);
    const hashAt = rest.indexOf('#');
    if (hashAt < 0) {
      console.warn('[storyDialogConductor] pool: ref missing #nodeId', nextValue);
      return null;
    }
    return { poolId: rest.slice(0, hashAt), nodeId: rest.slice(hashAt + 1) };
  }

  // '#localId' or plain 'localId'
  const nodeId = nextValue.startsWith('#') ? nextValue.slice(1) : nextValue;
  return { poolId: currentPoolId, nodeId };
}

/**
 * Apply a choice to the game state:
 * 1. Adapt legacy shapes if needed.
 * 2. Run effects.
 * 3. Record the dialog choice.
 * 4. Return { nextRef, effectFeedback[] }.
 *
 * @param {object} gs         - live game state
 * @param {object} choice     - the selected choice object
 * @param {object} ctx        - effect context (from storyMode.buildCtx or _ctx)
 * @param {string} poolId     - current pool id (for resolveNext)
 * @param {string} nodeId     - current node id (for recording)
 * @returns {{ nextRef: {poolId,nodeId}|null, effectFeedback: string[] }}
 */
export function applyChoice(gs, choice, ctx, poolId, nodeId) {
  // Back-compat: lift legacy shape to effects array
  const adapted = adaptLegacyChoice(choice);
  const feedback = [];

  // ── Skill check resolution ────────────────────────────────────────────────
  // If the choice carries a skillCheck object, resolve it before applying effects.
  // The result determines which branch of effects to run and which next to follow.
  let skillCheckResult = null;
  let resolvedChoice = adapted;

  if (choice.skillCheck) {
    skillCheckResult = resolveSkillCheck(gs, choice.skillCheck, nodeId);

    // Build feedback string.
    const sc = choice.skillCheck;
    const outcome = skillCheckResult.pass
      ? 'Pass' : skillCheckResult.partial ? 'Partial' : 'Fail';
    feedback.push(`[${sc.skill || sc.stat} check ${outcome}: ${skillCheckResult.power} vs DC ${skillCheckResult.dc}]`);

    // Merge branch-specific effects based on result.
    let branchEffects = [];
    if (skillCheckResult.pass && choice.onPass?.effects) {
      branchEffects = choice.onPass.effects;
    } else if (!skillCheckResult.pass && skillCheckResult.partial && choice.onPartial?.effects) {
      branchEffects = choice.onPartial.effects;
    } else if (!skillCheckResult.pass && choice.onFail?.effects) {
      branchEffects = choice.onFail.effects;
    }

    // Determine next node from branch.
    let branchNext = adapted.next ?? adapted.nextNode ?? null;
    if (skillCheckResult.pass && choice.onPass?.next !== undefined) {
      branchNext = choice.onPass.next;
    } else if (!skillCheckResult.pass && skillCheckResult.partial && choice.onPartial?.next !== undefined) {
      branchNext = choice.onPartial.next;
    } else if (!skillCheckResult.pass && choice.onFail?.next !== undefined) {
      branchNext = choice.onFail.next;
    }

    resolvedChoice = {
      ...adapted,
      effects: [...(adapted.effects || []), ...branchEffects],
      _resolvedNext: branchNext,
    };
  }

  // Run effects
  if (resolvedChoice.effects?.length) {
    // Capture feedback from effect runner (best-effort — effects don't return strings;
    // we generate human-readable summaries for common types here).
    for (const eff of resolvedChoice.effects) {
      const fb = _effectFeedback(eff);
      if (fb) feedback.push(fb);
    }
    runEffects(resolvedChoice.effects, ctx, { currentNodeId: nodeId });
  }

  // Record
  const choiceId = choice.id || choice.text || String(feedback.length);
  recordDialogChoice(gs, nodeId, choiceId);

  // Resolve next node — skill-check branch overrides if set.
  const nextRaw = resolvedChoice._resolvedNext ?? choice.next ?? choice.nextNode ?? null;
  const nextRef = resolveNext(nextRaw, poolId);

  return { nextRef, effectFeedback: feedback, skillCheckResult };
}

/**
 * Back-compat adapter: map the legacy Classic-Mode choice shape into the
 * new effects[] array. Returns a new choice object — input is not mutated.
 *
 * Legacy shapes handled:
 *   effect: { gold: -10 }            -> [{ type:'gold', amount:-10 }]
 *   setFlag: 'name'                  -> [{ type:'set_flag', flag:'name' }]
 *   outcome: 'fight'                 -> [{ type:'start_encounter', template:'fight' }]
 *   reward: { gold, xp, item, ... }  -> multiple gold/reward_item effects
 *
 * If choice.effects already exists it is preserved as-is.
 */
export function adaptLegacyChoice(choice) {
  if (choice.effects) return choice; // already new shape

  const effects = [];

  // effect: { gold, startCombat }
  if (choice.effect) {
    const e = choice.effect;
    if (typeof e.gold === 'number')        effects.push({ type: 'gold',          amount: e.gold });
    if (typeof e.startCombat === 'string') effects.push({ type: 'start_encounter', template: e.startCombat });
  }

  // reward: { gold, xp, item, itemName, itemDesc, setFlag, ... }
  if (choice.reward) {
    const r = choice.reward;
    if (typeof r.gold === 'number')  effects.push({ type: 'gold', amount: r.gold });
    if (typeof r.xp   === 'number')  effects.push({ type: 'inc_counter', counter: '_reward_xp', amount: r.xp });
    if (r.item)                      effects.push({ type: 'reward_item', itemId: r.item });
    if (typeof r.setFlag === 'string') effects.push({ type: 'set_flag', flag: r.setFlag });
  }

  // setFlag: 'name' (top-level on choice)
  if (typeof choice.setFlag === 'string') {
    effects.push({ type: 'set_flag', flag: choice.setFlag });
  }

  // outcome: 'fight' (top-level) — legacy routing hint; we record it but the
  // screen's outcome routing still handles the transition.
  if (typeof choice.outcome === 'string' && choice.outcome === 'fight') {
    effects.push({ type: 'start_encounter', template: 'fight' });
  }

  return { ...choice, effects };
}

// ---------------------------------------------------------------------------
// Effect feedback strings (human-readable, for the effect-chip panel)
// ---------------------------------------------------------------------------

const _FACTION_NAMES = {
  emberguard: 'Emberguard', ash_cult: 'Ash Cult', ancient_pact: 'Ancient Pact',
  merchant_guild: 'Merchant Guild', veil_wardens: 'Veil Wardens', free_cities: 'Free Cities',
};

function _effectFeedback(eff) {
  switch (eff.type) {
    case 'gold':
      return eff.amount > 0 ? `+${eff.amount} Gold` : `${eff.amount} Gold`;
    case 'faction_delta': {
      const name = _FACTION_NAMES[eff.faction] || eff.faction;
      return eff.amount > 0 ? `+${eff.amount} ${name} reputation` : `${eff.amount} ${name} reputation`;
    }
    case 'companion_approval': {
      const names = {
        lyra_ashwalker: 'Lyra', orren_gravetide: 'Orren', tessaly_veil: 'Tessaly',
        bram_coldfire: 'Bram', yasha_stonewill: 'Yasha', captain_maer: 'Maer',
      };
      const name = names[eff.companion] || eff.companion;
      return eff.amount >= 0 ? `${name} approves` : `${name} disapproves`;
    }
    case 'recruit_companion': return `Recruited a companion`;
    case 'dismiss_companion': return `Companion dismissed`;
    case 'quest_advance':     return `Quest updated`;
    case 'quest_complete':    return `Quest complete`;
    case 'quest_fail':        return `Quest failed`;
    case 'quest_log':         return eff.text || null;
    case 'lore_unlock':       return `Lore discovered`;
    case 'set_flag':          return null; // silent
    case 'clear_flag':        return null;
    case 'reward_item':       return `Item received`;
    default:                  return null;
  }
}

/**
 * Manually register a dialogue pool (used in tests / headless sim).
 * Delegates to storyContent but also pre-indexes into the conductor cache.
 */
export function registerPool(poolId, nodesArrayOrObject) {
  _loadedPools[poolId] = _indexPool(nodesArrayOrObject);
}

/**
 * Clear conductor pool cache (tests).
 */
export function clearConductorCache() {
  for (const k of Object.keys(_loadedPools)) delete _loadedPools[k];
}
