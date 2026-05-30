// src/game/equipBonuses.js
//
// M93: Shared affix-bonus helper. Single source of truth for summing
// equipment affix values into a flat bonus bundle consumed by every
// stat-derivation site (CombatScreen._memberToCombatant, computeMaxHp/Mp,
// computeGoldReward, _regenMana, etc).
//
// Pure — no GameState, no DOM, no imports from passives.js/formulas.js so
// both of those files can import from here without creating a cycle.
//
// Schema MUST match the shape historically returned by the
// getEquipmentAffixBonuses stub in formulas.js so existing callers and
// pinned tests keep working.

const STAT_TO_KEY = {
  // attributes
  str: 'str', dex: 'dex', int: 'int', con: 'con',
  // pools
  hp: 'hp', mp: 'mp',
  // combat mods
  hit: 'hit', dodge: 'dodge', initiative: 'initiative',
  dmg: 'dmg', armor: 'armor',
  // economy / regen
  goldFind: 'goldFind', gold_find: 'goldFind',
  manaRegen: 'manaRegen', mana_regen: 'manaRegen',
  // steal
  lifeSteal: 'lifeSteal', manaSteal: 'manaSteal',
  // resist
  magicResist: 'magicResist', magic_resist: 'magicResist',
  // M116: crit affixes + Potency (magic dmg / spell power).
  critChance: 'critChance', crit_chance: 'critChance',
  critDamage: 'critDamage', crit_damage: 'critDamage',
  spellPower: 'spellPower', spell_power: 'spellPower',
  // M236: Magic Find affix ('of Discovery'). Raises chance of magic+ items
  // in combat + chest + guild loot. Shop stock unaffected.
  magicFind: 'magicFind', magic_find: 'magicFind',
  // M340: Magic shield stats — Barrier (flat HP-shield applied at combat
  // start) and Barrier Regen (flat barrier restored each round, capped at
  // max barrier). Native on every magic-shield base; bonus rolls via
  // Wardstone / Conduit affixes.
  barrier: 'barrier',
  barrierRegen: 'barrierRegen', barrier_regen: 'barrierRegen',
};

export function emptyAffixBonuses() {
  return {
    str: 0, dex: 0, int: 0, con: 0,
    hp: 0, mp: 0,
    hit: 0, dodge: 0, initiative: 0,
    dmg: 0, armor: 0,
    goldFind: 0, manaRegen: 0,
    lifeSteal: 0, manaSteal: 0,
    magicResist: 0,
    // M116
    critChance: 0, critDamage: 0, spellPower: 0,
    // M236
    magicFind: 0,
    // M340
    barrier: 0, barrierRegen: 0,
  };
}

/**
 * Sum every equipped item's affixes into a flat bonus bundle.
 * Unknown affix keys (e.g. legacy `burnChance`/`bleedChance` on saves from
 * pre-M93 items) are silently ignored — no logging, no error.
 */
export function getEquipmentAffixBonuses(member) {
  const out = emptyAffixBonuses();
  const eqp = member?.equipment || {};
  for (const item of Object.values(eqp)) {
    if (!item) continue;
    for (const affix of (item.affixes || [])) {
      const key = STAT_TO_KEY[affix.stat];
      if (!key) continue; // unknown / legacy / reserved — ignore
      let v = +affix.value || 0;
      // M181: spellPower unified to a 0..1 fraction. Legacy Potency affixes
      // stored integer points (1..3 meaning 5-15%); convert on accumulation
      // so old saves work and all consumers can add ab.spellPower directly.
      if (key === 'spellPower' && v >= 1) v = v * 0.05;
      out[key] += v;
    }
  }
  return out;
}
getEquipmentAffixBonuses.formula =
  "sum(affix.value for affix in item.affixes for item in equipment), grouped by canonical stat key; unknown keys ignored";
getEquipmentAffixBonuses.inputs = ['member.equipment[*].affixes'];
