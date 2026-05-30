// src/game/statusTick.js
//
// M378 — shared per-round status tick formulas. Both CombatScreen and the
// headless simulator import this so DoT damage / regen ticks stay in lock
// step. The function returns the numeric effect for a single tick; the
// caller is responsible for actually mutating HP, logging, and decrementing
// duration.
//
// Reference: CombatScreen._processStatusEffects (see ~line 4329) — the
// formulas here mirror that path one-for-one. We deliberately keep this
// module dependency-free so the simulator can run server-side.

/**
 * Compute a single round's tick for a status. Pure — does not mutate.
 *
 * @param {{type:string, power?:number, duration?:number}} status
 * @returns {{ kind: 'dot'|'heal'|'none', amount: number, type: string, color: string|null }}
 */
export function computeStatusTick(status) {
  const t = status && status.type;
  if (t === 'burn' || t === 'poison' || t === 'bleed') {
    const amt = Math.max(1, status.power || 3);
    const color = t === 'burn' ? '#ff6020' : t === 'poison' ? '#60c020' : '#c02020';
    return { kind: 'dot', amount: amt, type: t, color };
  }
  if (t === 'regen') {
    const amt = Math.max(1, status.power || 3);
    return { kind: 'heal', amount: amt, type: t, color: '#60e880' };
  }
  return { kind: 'none', amount: 0, type: t || 'unknown', color: null };
}

/**
 * Returns true when this status type ticks DoT damage every round.
 */
export function isDotStatus(type) {
  return type === 'burn' || type === 'poison' || type === 'bleed';
}
