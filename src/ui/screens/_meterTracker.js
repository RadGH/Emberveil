// M273: pure meter-aggregation helper extracted from CombatScreen.
// This is the data-only layer of the in-combat DPS/Heal/Mitigation meter:
// no DOM, no rendering, no game state. CombatScreen owns one of these and
// wires events into it; the post-combat report queries it for the
// drill-down. Keeping it pure makes the meter testable without a full
// browser environment, and is the proof-of-pattern for the upcoming
// CombatScreen.js modular extraction (see code-review-m271.md §4).
//
// Shape of an entry:
//   {
//     name, side, damage, heal, mitigation,
//     sources: { 'Skill Name': totalDamage, ... },
//     healSources: { 'Lay on Hands': totalHeal, 'Lifesteal': totalHeal, ... },
//     mitSources: { 'Armor': totalAbsorbed, 'Block': total, 'Dodge (count)': dodgeCount, ... },
//     hits: [{ kind, amt, source, ... }, ...]
//   }
//
// `kind` on hits ∈ { 'dmg' | 'heal' | 'mit' | 'dodge' }.

// M386 — perf-engineer flag: cap the events ring so a long fight doesn't
// accumulate thousands of objects. Per-actor `data.hits` arrays are still
// canonical for the post-combat drill-down; `events` is just a flat
// chronological mirror used by report exporters.
const _MAX_EVENTS = 2000;

function _pushEvent(meter, ev) {
  meter.events.push(ev);
  if (meter.events.length > _MAX_EVENTS) {
    // Drop oldest 10% in one splice to amortize the cost.
    meter.events.splice(0, Math.floor(_MAX_EVENTS * 0.1));
  }
}

export function createMeter() {
  return {
    data: new Map(),
    events: [],
  };
}

export function ensureEntry(meter, actor, side) {
  if (!meter || !actor) return null;
  let d = meter.data.get(actor.id);
  if (!d) {
    d = {
      name: actor.name,
      side: side || 'enemy',
      damage: 0, heal: 0, mitigation: 0,
      sources: {},
      healSources: {},
      mitSources: {},
      hits: [],
    };
    meter.data.set(actor.id, d);
  }
  return d;
}

export function meterAddDamage(meter, actor, amt, source, detail = {}) {
  if (!actor || !(amt > 0)) return false;
  const side = detail.side || (detail.actorSide || 'ally');
  const d = ensureEntry(meter, actor, side);
  if (!d) return false;
  d.damage += amt;
  d.sources[source] = (d.sources[source] || 0) + amt;
  d.hits.push({ kind: 'dmg', amt, source, ...detail });
  _pushEvent(meter, { kind: 'dmg', actor: actor.name, actorId: actor.id, amt, source, ...detail });
  return true;
}

export function meterAddHeal(meter, actor, amt, source, detail = {}) {
  if (!actor || !(amt > 0)) return false;
  const side = detail.side || 'ally';
  const d = ensureEntry(meter, actor, side);
  if (!d) return false;
  d.heal += amt;
  d.healSources[source] = (d.healSources[source] || 0) + amt;
  d.hits.push({ kind: 'heal', amt, source, ...detail });
  _pushEvent(meter, { kind: 'heal', actor: actor.name, actorId: actor.id, amt, source, ...detail });
  return true;
}

export function meterAddMit(meter, actor, amt, kind, detail = {}) {
  if (!actor || !(amt > 0)) return false;
  const side = detail.side || 'ally';
  const d = ensureEntry(meter, actor, side);
  if (!d) return false;
  d.mitigation += amt;
  d.mitSources[kind] = (d.mitSources[kind] || 0) + amt;
  d.hits.push({ kind: 'mit', amt, source: kind, ...detail });
  _pushEvent(meter, { kind: 'mit', actor: actor.name, actorId: actor.id, amt, source: kind, ...detail });
  return true;
}

export function meterAddDodge(meter, actor, detail = {}) {
  if (!actor) return false;
  const side = detail.side || 'ally';
  const d = ensureEntry(meter, actor, side);
  if (!d) return false;
  d.mitSources['Dodge (count)'] = (d.mitSources['Dodge (count)'] || 0) + 1;
  d.hits.push({ kind: 'dodge', amt: 0, source: 'Dodge', ...detail });
  _pushEvent(meter, { kind: 'dodge', actor: actor.name, actorId: actor.id, amt: 0, source: 'Dodge', ...detail });
  return true;
}

/** Get rows sorted desc by the chosen mode (damage|heal|mitigation). */
export function meterRows(meter, mode = 'damage', { showEnemies = false } = {}) {
  const valFor = (d) => mode === 'damage' ? d.damage : mode === 'heal' ? d.heal : d.mitigation;
  return [...meter.data.values()]
    .filter(d => showEnemies || d.side !== 'enemy')
    .map(d => ({ name: d.name, val: valFor(d), side: d.side }))
    .filter(r => r.val > 0)
    .sort((a, b) => b.val - a.val);
}

/** Aggregate totals across all entries. */
export function meterTotals(meter) {
  let damage = 0, heal = 0, mitigation = 0;
  for (const d of meter.data.values()) {
    damage += d.damage; heal += d.heal; mitigation += d.mitigation;
  }
  return { damage, heal, mitigation };
}
