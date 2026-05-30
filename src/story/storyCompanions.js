/**
 * storyCompanions.js — Story Mode companion system (§9 of refined plan).
 *
 * The 6 named companions are inlined here for v1. data/story/npcs.json lands
 * in M-S21 when the full NPC registry ships.
 *
 * gs.story.companions[] is pre-populated by createStoryLedger (storyLedger.js)
 * with all 6 entries in recruited:false, active:false, approval:0, alive:true
 * state. This module mutates those entries.
 *
 * No Sets anywhere — all array semantics use plain loops.
 */

import { loadBanterPool } from './storyContent.js';

// ---------------------------------------------------------------------------
// Inline companion definitions (v1 — replaced by data/story/npcs.json in M-S21)
// ---------------------------------------------------------------------------
const COMPANION_DEFS = {
  lyra_ashwalker: {
    id:              'lyra_ashwalker',
    name:            'Lyra Ashwalker',
    class:           'ranger',
    recruitAct:      1,
    personality:     'pragmatic',
    mechanic:        'hidden_node_scout_reveal',
    personalQuestId: 'companion_lyra_personal',
    description:     'A pragmatic ranger who reads the land better than any map.',
    attrs:           { STR: 9, DEX: 15, INT: 10, CON: 11 },
  },
  orren_gravetide: {
    id:              'orren_gravetide',
    name:            'Orren Gravetide',
    class:           'warrior',
    recruitAct:      1,
    personality:     'honor',
    mechanic:        'str_check_bonus_2',
    personalQuestId: 'companion_orren_personal',
    description:     'A warrior who holds honor above survival.',
    attrs:           { STR: 16, DEX: 8, INT: 8, CON: 14 },
  },
  tessaly_veil: {
    id:              'tessaly_veil',
    name:            'Tessaly Veil',
    class:           'rogue',
    recruitAct:      2,
    personality:     'chaotic',
    mechanic:        'unlocks_stealth_dialog_choices',
    personalQuestId: 'companion_tessaly_personal',
    description:     'A rogue who plays by rules she invents on the spot.',
    attrs:           { STR: 8, DEX: 16, INT: 12, CON: 9 },
  },
  bram_coldfire: {
    id:              'bram_coldfire',
    name:            'Bram Coldfire',
    class:           'mage',
    recruitAct:      2,
    personality:     'curious',
    mechanic:        'int_check_bonus_2',
    personalQuestId: 'companion_bram_personal',
    description:     'A mage driven by questions no one else thinks to ask.',
    attrs:           { STR: 7, DEX: 10, INT: 17, CON: 9 },
  },
  yasha_stonewill: {
    id:              'yasha_stonewill',
    name:            'Yasha Stonewill',
    class:           'monk',
    recruitAct:      2,
    personality:     'stoic',
    mechanic:        'con_check_bonus_2',
    personalQuestId: 'companion_yasha_personal',
    description:     'A monk of few words and immovable conviction.',
    attrs:           { STR: 12, DEX: 12, INT: 10, CON: 16 },
  },
  captain_maer: {
    id:              'captain_maer',
    name:            'Captain Maer',
    class:           'warrior',
    recruitAct:      1,
    personality:     'duty',
    mechanic:        'faction_gateway_emberguard',
    personalQuestId: 'companion_maer_personal',
    description:     'A captain whose loyalty to the Emberguard runs bone-deep.',
    attrs:           { STR: 14, DEX: 10, INT: 11, CON: 13 },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function _find(gs, id) {
  return gs.story.companions.find(c => c.id === id) || null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the static companion definition for an id.
 * Checks the inline registry first; in M-S21+ this falls through to
 * data/story/npcs.json if not found.
 */
export function getCompanionDef(id) {
  return COMPANION_DEFS[id] || null;
}

/**
 * Recruit a companion. Idempotent on already-recruited.
 * Sets recruited=true, active=true, swaps as the active companion.
 * Any previously active companion becomes benched at the current node.
 */
export function recruitCompanion(gs, id) {
  const entry = _find(gs, id);
  if (!entry) {
    console.warn('[storyCompanions] recruitCompanion: unknown id', id);
    return;
  }
  // Bench current active companion first
  if (gs.story.activeCompanionId && gs.story.activeCompanionId !== id) {
    const prev = _find(gs, gs.story.activeCompanionId);
    if (prev) {
      prev.active   = false;
      prev.benchedAt = gs.story.currentNodeId || null;
    }
  }
  entry.recruited = true;
  entry.active    = true;
  entry.benchedAt = null;
  gs.story.activeCompanionId = id;
}

/**
 * Dismiss a companion. Sets active=false, benchedAt=currentNodeId.
 * Clears activeCompanionId if it matched.
 */
export function dismissCompanion(gs, id) {
  const entry = _find(gs, id);
  if (!entry) return;
  entry.active   = false;
  entry.benchedAt = gs.story.currentNodeId || null;
  if (gs.story.activeCompanionId === id) {
    gs.story.activeCompanionId = null;
  }
}

/**
 * Return the active companion's ledger entry, or null.
 */
export function getActiveCompanion(gs) {
  const id = gs.story.activeCompanionId;
  if (!id) return null;
  return _find(gs, id);
}

/**
 * Return all recruited companions' ledger entries.
 */
export function getRecruitedCompanions(gs) {
  return gs.story.companions.filter(c => c.recruited);
}

/**
 * Apply an approval delta to a companion.
 * Active companion: full delta. Recruited-but-benched: half delta (rounded).
 * Clamps result to [-10, 10].
 */
export function applyApproval(gs, id, delta) {
  const entry = _find(gs, id);
  if (!entry || !entry.recruited) return;
  const effective = entry.active ? delta : Math.round(delta / 2);
  entry.approval = clamp(entry.approval + effective, -10, 10);
}

/**
 * Swap the active companion to newId.
 * Only valid at nodes whose waypointState === 'activated'.
 * Returns { ok: true } on success, { ok: false, reason: string } on failure.
 */
export function swapActive(gs, newId) {
  const entry = _find(gs, newId);
  if (!entry) return { ok: false, reason: `Unknown companion: ${newId}` };
  if (!entry.recruited) return { ok: false, reason: `${newId} is not recruited` };

  // Check current node is an activated waypoint
  const nodeId   = gs.story.currentNodeId;
  const mapId    = gs.story.currentMapId;
  const mapSave  = gs.story.maps?.[mapId];
  const nodeSave = mapSave?.nodes?.[nodeId];
  if (!nodeSave || nodeSave.waypointState !== 'activated') {
    return { ok: false, reason: 'Companion swaps are only available at activated waypoints' };
  }

  // Bench current active
  if (gs.story.activeCompanionId && gs.story.activeCompanionId !== newId) {
    const prev = _find(gs, gs.story.activeCompanionId);
    if (prev) {
      prev.active   = false;
      prev.benchedAt = nodeId;
    }
  }

  entry.active    = true;
  entry.benchedAt = null;
  gs.story.activeCompanionId = newId;
  return { ok: true };
}

/**
 * Assemble the combat party: gs.party + the active companion (if any).
 * Companion is appended as a 5th member with isCompanion: true,
 * _storyCompanion: true. Returns a new array; gs.party is not mutated.
 */
export function assembleCombatParty(gs) {
  const base   = [...(gs.party || [])];
  const active = getActiveCompanion(gs);
  if (!active) return base;

  const def = getCompanionDef(active.id);
  if (!def) return base;

  // Build a combatant-shaped member from the companion definition.
  const attrs   = def.attrs || { STR: 10, DEX: 10, INT: 10, CON: 10 };
  const partyAvgLevel = base.length
    ? Math.round(base.reduce((s, m) => s + (m.level || 1), 0) / base.length)
    : 1;

  const companionMember = {
    id:             active.id + '_story',
    name:           def.name,
    class:          def.class,
    cls:            def.class,
    level:          partyAvgLevel,
    attrs,
    hp:             50 + attrs.CON * 10,
    maxHp:          50 + attrs.CON * 10,
    mp:             30 + attrs.INT * 8,
    maxMp:          30 + attrs.INT * 8,
    xp:             0,
    equipment:      {},
    skills:         [],
    isCompanion:    true,
    _storyCompanion: true,
    _companionId:   active.id,
    approval:       active.approval,
  };

  return [...base, companionMember];
}

/**
 * Attempt to fire companion banter after a node resolution.
 *
 * Selection algorithm (§9.5):
 * 1. Active companion + any other recruited companion form candidate pairs.
 * 2. Load the banter pool for each pair.
 * 3. Filter by trigger cause and per-entry cooldown.
 * 4. Global cooldown: next banter requires >= 3 nodes since lastBanterNode.
 * 5. Return the first matching entry, or null if none.
 *
 * Banter pools exist for all 15 companion pairs as of M515. Pools live in
 * data/story/banter-pools/<idA>_<idB>.json (alphabetical by companion id).
 * Delivery (slide-in overlay) is handled by the UI layer, not here.
 */
export function maybeFireBanter(gs, nodeId, cause) {
  if (!gs?.story) return null;

  const active = getActiveCompanion(gs);
  if (!active) return null;

  // Global cooldown check — only applies if banter has previously fired.
  const lastBanter = gs.story.lastBanterNode;
  if (lastBanter) {
    const banterCounter = gs.story.counters['_banter_node_count'] || 0;
    const lastCounter   = gs.story.counters['_banter_last_counter'] || 0;
    if (banterCounter - lastCounter < 3) return null;
  }

  // Increment the per-node banter counter
  gs.story.counters['_banter_node_count'] = (gs.story.counters['_banter_node_count'] || 0) + 1;

  const recruited = getRecruitedCompanions(gs).filter(c => c.id !== active.id);
  if (!recruited.length) return null;

  // Try each pair through pre-authored banter pools.
  for (const other of recruited) {
    let pool;
    try {
      pool = loadBanterPool(active.id, other.id);
    } catch (_) { continue; }

    // If pool is a Promise (browser fetch), skip synchronously for now.
    if (!pool || typeof pool.then === 'function' || !Array.isArray(pool)) continue;
    if (!pool.length) continue;

    for (const entry of pool) {
      // Trigger filter
      if (entry.trigger && entry.trigger !== cause) continue;
      // Per-entry cooldown
      const counterKey = `_banter_${entry.id}`;
      const lastFired  = gs.story.counters[counterKey] || 0;
      const now        = gs.story.counters['_banter_node_count'] || 0;
      if (entry.cooldown && now - lastFired < entry.cooldown) continue;

      // Match found — record and return
      gs.story.counters[counterKey]         = now;
      gs.story.counters['_banter_last_counter'] = now;
      gs.story.lastBanterNode               = nodeId;
      return {
        companionA: active.id,
        companionB: other.id,
        entry,
      };
    }
  }
  return null;
}
