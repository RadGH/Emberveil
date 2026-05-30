// M274: pure damage-resolution pipeline extracted from CombatScreen.
// `resolveIncomingDamage` is the canonical mitigation pipeline:
//
//   raw → block? → armor/resist → passiveResistAll → final
//
// Returns { dmg, tag, breakdown } where:
//   dmg       — final damage to subtract from target.hp
//   tag       — log/UI tag ('blocked'|'blocked N'|'deflected'|'resisted'|null)
//   breakdown — fields for the breakdown tooltip (raw, final, type, blocked,
//               armorReduction/resistReduction, resistType)
//
// **Side effects, intentionally:** sets `target.stance = 'block'` when block
// fires (so the renderer animates a block pose). The previous `setTimeout`
// to revert to 'ready' is the caller's responsibility — we just set the flag.
// This keeps the pipeline pure-data + a single observable mutation, which
// the existing test surface (formulas + assertions) can verify.
//
// **Mitigation telemetry:** the caller passes a `meter` object with optional
// `addMit(target, amt, kind, detail)` callback. If provided, block + armor +
// resist absorption are reported back through it. If absent, no telemetry —
// matches the current CombatScreen behaviour (only hero defenders meter).
import {
  rollBlock,
  applyBlock,
  applyMitigation,
  mitigationLogTag,
} from '../../game/formulas.js';

/**
 * @typedef {Object} ResolveOpts
 * @property {'physical'|'magic'|'true'} [type='physical']
 * @property {number} [armorPen=0]
 * @property {number} [resistPen=0]
 * @property {string} [resistType]
 * @property {Object} [meter]                  Optional meter sink with addMit(target, amt, kind, detail)
 * @property {number} [round]                  Current round, attached to meter.addMit details
 * @property {boolean} [meterTrackTarget=true] If false, skip mitigation telemetry (e.g. enemy defender)
 */

/**
 * Resolve raw incoming damage through the canonical mitigation pipeline.
 * Pure-data return + a single side effect (target.stance = 'block') for animation.
 */
export function resolveIncomingDamage(raw, target, opts = {}) {
  const type = opts.type || 'physical';
  let dmg = Math.max(0, Math.round(raw));
  let tag = null;
  let blocked = 0;
  const rawRounded = dmg;

  // Stage 1: block roll (physical only, never on 'true' damage).
  // Heroes use flat blockPower (from shield affixes).
  // Enemies use blockMitigation (percentage, default 0.5) when blockChance > 0.
  let blockedThisHit = false;
  if (type !== 'true' && type === 'physical' && (target.blockChance || 0) > 0 && rollBlock(target)) {
    let afterBlock;
    if (!target.isHero && (target.blockMitigation || 0) > 0) {
      // Enemy block: percentage-based mitigation (e.g. 0.5 = 50% reduction)
      afterBlock = Math.max(0, Math.round(dmg * (1 - target.blockMitigation)));
    } else {
      // Hero/shield block: flat blockPower subtraction
      afterBlock = applyBlock(dmg, target);
    }
    blocked = dmg - afterBlock;
    if (afterBlock <= 0) { tag = 'blocked'; dmg = 0; }
    else { tag = `blocked ${blocked}`; dmg = afterBlock; }
    target.stance = 'block';
    blockedThisHit = true;
    if (opts.meter && opts.meterTrackTarget !== false && blocked > 0) {
      opts.meter.addMit?.(target, blocked, 'Block', { round: opts.round });
    }
    // M469: diagnostic logging gated on window.__combatDebug.
    if (typeof window !== 'undefined' && window.__combatDebug) {
      console.log('[CombatDebug] Block fired:', target.name,
        '| blockChance:', target.blockChance,
        '| blockMitigation:', target.blockMitigation,
        '| raw:', rawRounded, '-> after block:', dmg);
    }
  }

  const afterBlock = dmg;

  // Stage 2: armor (physical) or magic resist (magic). 'true' damage bypasses.
  let final = applyMitigation(dmg, target, { type, armorPen: opts.armorPen, resistPen: opts.resistPen });
  if (opts.meter && opts.meterTrackTarget !== false) {
    const absorbed = Math.max(0, afterBlock - final);
    if (absorbed > 0) {
      opts.meter.addMit?.(target, absorbed, type === 'magic' ? 'Spell Resist' : 'Armor', { round: opts.round });
    }
  }

  // Stage 3: passive resistAll (final % reduction).
  if ((target.passiveResistAll || 0) > 0 && final > 0) {
    final = Math.max(0, Math.round(final * (1 - target.passiveResistAll / 100)));
  }

  const mitTag = mitigationLogTag(dmg, final, type);
  if (mitTag) tag = mitTag;

  // Build breakdown for the log tooltip.
  const breakdown = { raw: rawRounded, final, type };
  if (blocked > 0) breakdown.blocked = blocked;
  if (type === 'physical') {
    const armorReduction = Math.max(0, afterBlock - final);
    if (armorReduction > 0) breakdown.armorReduction = armorReduction;
  } else if (type === 'magic') {
    const resistReduction = Math.max(0, afterBlock - final);
    if (resistReduction > 0) {
      breakdown.resistReduction = resistReduction;
      if (opts.resistType) breakdown.resistType = opts.resistType;
    }
  }

  return { dmg: final, tag, breakdown, blocked: blockedThisHit };
}
