/**
 * Unified status model. burn/poison/bleed/stun/barrier migrated in M165.
 * dmgBuff migrated in M168 via addDmgBuff / getDmgBuffMult / clearDmgBuff.
 * critBonus temp buffs migrated in M169 via addCritBonusStatus /
 * getCritBonusTotal (the static talent/gear baseline stays as actor.critBonus).
 */
import { shimTelemetry } from './telemetry.js';

export function addStatus(actor, status) {
  if (!actor) return;
  if (!Array.isArray(actor.statuses)) actor.statuses = [];
  const existing = actor.statuses.find(s => s.type === status.type);
  if (existing) {
    if (status.duration && (!existing.duration || status.duration > existing.duration)) existing.duration = status.duration;
    if (status.stacks) existing.stacks = (existing.stacks || 1) + status.stacks;
  } else {
    actor.statuses.push({ stacks: 1, ...status });
  }
}

export function removeStatus(actor, type) {
  if (!actor || !Array.isArray(actor.statuses)) return;
  actor.statuses = actor.statuses.filter(s => s.type !== type);
}

export function isSilenced(actor) {
  return !!(actor && Array.isArray(actor.statuses) && actor.statuses.some(s => s.type === 'silenced' && (s.duration || 0) !== 0));
}

export function hasStatus(actor, type) {
  if (!actor) return false;
  if (Array.isArray(actor.statuses) && actor.statuses.some(s => s.type === type)) return true;
  if (type === 'regen' && actor.regen) {
    shimTelemetry.hit('statusModel.hasStatus.legacy:regen');
    return true;
  }
  return false;
}

export function tickStatuses(actor) {
  if (!actor || !Array.isArray(actor.statuses)) return;
  actor.statuses = actor.statuses
    .map(s => ({ ...s, duration: (s.duration || 0) - 1 }))
    .filter(s => s.duration > 0 || s.duration === -1);
}

/**
 * Damage-buff helpers (M168). Stored as { type:'dmgBuff', amount, duration }
 * in actor.statuses[]. Multiple casts stack additively. Negative amount = debuff.
 */
export function addDmgBuff(actor, amount, duration) {
  if (!actor || !amount) return;
  if (!Array.isArray(actor.statuses)) actor.statuses = [];
  actor.statuses.push({ type: 'dmgBuff', amount, duration: duration || 3 });
}

export function getDmgBuffMult(actor) {
  if (!actor || !Array.isArray(actor.statuses)) return 0;
  let total = 0;
  for (const s of actor.statuses) if (s.type === 'dmgBuff') total += s.amount || 0;
  return total;
}

export function clearDmgBuff(actor) {
  if (!actor || !Array.isArray(actor.statuses)) return;
  actor.statuses = actor.statuses.filter(s => s.type !== 'dmgBuff');
}

/**
 * Crit-bonus helpers (M169). Adds a TEMPORARY crit% buff on top of the
 * static actor.critBonus baseline from talents/gear. Stored as
 * { type:'critBonus', amount, duration } (percentage points). Multiple
 * casts stack additively.
 */
export function addCritBonusStatus(actor, amountPct, duration) {
  if (!actor || !amountPct) return;
  if (!Array.isArray(actor.statuses)) actor.statuses = [];
  actor.statuses.push({ type: 'critBonus', amount: amountPct, duration: duration || 3 });
}

export function getCritBonusTotal(actor) {
  if (!actor) return 0;
  let total = actor.critBonus || 0;
  if (Array.isArray(actor.statuses)) {
    for (const s of actor.statuses) if (s.type === 'critBonus') total += s.amount || 0;
  }
  return total;
}

export function overhealToBarrier(actor, incomingHeal) {
  if (!actor || !incomingHeal) return 0;
  const max = actor.maxHp || actor.hpMax || 100;
  const cur = actor.hp || 0;
  const overflow = Math.max(0, (cur + incomingHeal) - max);
  if (overflow > 0) {
    addStatus(actor, { type: 'barrier', amount: overflow, duration: 3 });
  }
  return overflow;
}
