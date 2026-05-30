/**
 * bossPhases.js — M304 multi-phase boss system
 *
 * Each boss can declare a `phases` array. When the boss HP crosses a
 * threshold the system transitions to the next phase: logs a message,
 * optionally swaps/adds spells, and applies transition statuses.
 *
 * Phase object schema:
 *   hpThreshold  {number}  0..1 — transition fires when hp/maxHp drops BELOW this
 *   name         {string}  Label shown in the combat log header
 *   addSpells    {string[]} Spell ids appended to the enemy's spellList
 *   swapSpells   {string[]} Replaces the entire spellList (takes priority over addSpells)
 *   onEnter      {string}  Free-text message emitted in the combat log
 *   addStatuses  {object[]} Status objects applied to the boss on phase entry
 *                           e.g. { type: 'fury', duration: 99, power: 20 }
 *
 * Save migration note: _currentPhase defaults to 0 at combat init. An
 * in-progress save that continues a boss fight without phase data simply
 * stays at phase 0 — no retroactive transitions fire.
 */

/**
 * BOSS_PHASES — keyed by enemy id.
 * Thresholds must be in DESCENDING order (first threshold is highest HP drop).
 *
 * Phase 2 step 7 (canonical-data migration): the inline literal has been
 * deleted. The value now comes from the single canonical source
 * `public/data/combat/boss-phases.json` via the centralized static-JSON
 * loader in dataLoader.js (`getBossPhases()`). The resolved object is
 * value-identical to the former literal; the phases[] array order
 * (descending hpThreshold — load-bearing) is preserved verbatim.
 */
import { getBossPhases } from './dataLoader.js';

export const BOSS_PHASES = getBossPhases();

/**
 * M304 — initBossPhases
 * Call once at combat start for each enemy combatant.
 * Attaches _currentPhase = 0 and _phases ref (or null for non-phased enemies).
 * Safe to call on every enemy — non-boss enemies get _phases = null.
 */
export function initBossPhases(enemy) {
  const cfg = BOSS_PHASES[enemy.id || enemy.enemyId];
  enemy._phases = cfg ? cfg.phases : null;
  enemy._currentPhase = 0;
}

/**
 * M304 — checkBossPhaseTransition
 * Call after each damage event that reduces a boss's HP.
 * Returns a phase object if a transition just triggered, or null.
 *
 * @param {object} enemy      — live combat enemy combatant
 * @param {Function} logFn    — CombatScreen._log_ bound to the instance
 * @returns {object|null}     — the phase that was entered, or null
 */
export function checkBossPhaseTransition(enemy, logFn) {
  if (!enemy._phases || !enemy._phases.length) return null;
  if (!enemy.alive) return null;

  const hpPct = enemy.hp / enemy.maxHp;
  let triggered = null;

  for (let i = enemy._currentPhase; i < enemy._phases.length; i++) {
    const phase = enemy._phases[i];
    if (hpPct < phase.hpThreshold) {
      enemy._currentPhase = i + 1;
      triggered = phase;

      // Announce
      if (logFn) {
        logFn(`-- Phase transition: ${phase.name} --`, 'round');
        if (phase.onEnter) logFn(phase.onEnter, 'hero');
      }

      // Swap or add spells
      if (Array.isArray(phase.swapSpells)) {
        enemy.spellList = [...phase.swapSpells];
      } else if (Array.isArray(phase.addSpells)) {
        enemy.spellList = [...(enemy.spellList || []), ...phase.addSpells];
      }

      // Apply transition statuses
      if (Array.isArray(phase.addStatuses)) {
        if (!Array.isArray(enemy.statuses)) enemy.statuses = [];
        for (const s of phase.addStatuses) {
          enemy.statuses.push({ ...s });
        }
      }

      break; // only one phase transition per HP check
    }
  }

  return triggered;
}

/**
 * M304 — getPhaseThresholds
 * Returns sorted array of hpThreshold values for a given enemy id.
 * Used by the canvas HP bar renderer to draw phase tick marks.
 */
export function getPhaseThresholds(enemyId) {
  const cfg = BOSS_PHASES[enemyId];
  if (!cfg) return [];
  return cfg.phases.map(p => p.hpThreshold);
}

/**
 * M-S17 — registerVariantPhases
 *
 * Merge story-mode variant phases on top of the base boss phase list.
 * Called by storyBossVariants.applyVariant before combat starts.
 * Classic-mode behavior is unchanged when no variant has been registered.
 *
 * Variant phases are merged by hpThreshold: if the variant declares a phase
 * at the same threshold as a base phase, the variant's phase is used instead.
 * New thresholds from the variant are inserted in descending order.
 *
 * Additive only — this function never removes base phases.
 *
 * @param {string}   bossId — enemy id to patch
 * @param {object[]} variantPhases — array of phase objects (same schema as base phases)
 */
export function registerVariantPhases(bossId, variantPhases) {
  if (!bossId || !Array.isArray(variantPhases) || !variantPhases.length) return;

  // Ensure the boss entry exists.
  if (!BOSS_PHASES[bossId]) {
    BOSS_PHASES[bossId] = { phases: [] };
  }

  const existing = BOSS_PHASES[bossId].phases;

  for (const vPhase of variantPhases) {
    const thresh = vPhase.hpThreshold ?? vPhase.threshold;
    if (thresh == null) continue;

    // Normalise: use hpThreshold as the canonical key.
    const normalized = { ...vPhase, hpThreshold: thresh };
    delete normalized.threshold;

    // Check if base has a phase at this threshold.
    const existingIdx = existing.findIndex(p => p.hpThreshold === thresh);
    if (existingIdx >= 0) {
      // Replace (variant overrides base at same threshold).
      existing[existingIdx] = normalized;
    } else {
      // Insert in descending order.
      existing.push(normalized);
    }
  }

  // Re-sort descending (highest threshold first — load-bearing for checkBossPhaseTransition).
  BOSS_PHASES[bossId].phases.sort((a, b) => b.hpThreshold - a.hpThreshold);
}
