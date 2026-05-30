/**
 * sets.js — M305
 *
 * 24 item sets:
 *   12 low-tier  (2-piece) — Sigon's-style: powerful low-level modifiers
 *    8 mid-tier  (3-piece) — theme-driven
 *    4 endgame   (4-5-piece) — build-defining
 *
 * Schema per set:
 * {
 *   id         {string}    — unique key
 *   name       {string}    — display name
 *   tier       {string}    — 'low' | 'mid' | 'endgame'
 *   pieces     {number}    — total pieces (2 | 3 | 4 | 5)
 *   items      {object[]}  — [{ slot, baseItemId, fixedAffixes, randomAffixes }]
 *   legendaryEffect { id, desc, activationPieces }
 *   partialBonuses  { '2': {...}, '3': {...}, ... }
 * }
 *
 * partialBonuses stats are additive with character stats. Keys follow
 * the equipBonuses STAT_TO_KEY convention plus set-extension keys that
 * are processed by the set-bonus system.
 *
 * legendaryEffect.activationPieces — number of pieces before the legendary
 * effect becomes active (default: same as set.pieces).
 */

// ─── LOW-TIER SETS (2-piece) ──────────────────────────────────────────────────

export const SETS = {

  // 1. Iron Brigade — warrior starter (helm + plate chest).
  //    Sigon-style: raw stats not available on magic-tier gear this early.
  iron_brigade: {
    id: 'iron_brigade',
    name: "Iron Brigade",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'head',
        baseItemId: 'heavy_helm',
        fixedAffixes: [{ stat: 'str', value: 5 }, { stat: 'armor', value: 4 }],
        randomAffixes: [{ stat: 'con', min: 2, max: 5 }],
      },
      {
        slot: 'chest',
        baseItemId: 'heavy_chest',
        fixedAffixes: [{ stat: 'str', value: 5 }, { stat: 'armor', value: 8 }],
        randomAffixes: [{ stat: 'hp', min: 15, max: 30 }],
      },
    ],
    legendaryEffect: { id: 'kill_party_heal', desc: 'Killing blows heal the party for 10% of the target\'s max HP.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 5, armor: 6, desc: '+5 STR, +6 Armor, Killing Blow Party Heal' },
    },
  },

  // 2. Apprentice's Initiation — caster starter (wand + cloth chest).
  apprentice_initiation: {
    id: 'apprentice_initiation',
    name: "Apprentice's Initiation",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'wand',
        fixedAffixes: [{ stat: 'spellPower', value: 0.10 }, { stat: 'int', value: 4 }],
        randomAffixes: [{ stat: 'mp', min: 10, max: 20 }],
      },
      {
        slot: 'chest',
        baseItemId: 'cloth_chest',
        fixedAffixes: [{ stat: 'int', value: 4 }, { stat: 'mp', value: 15 }],
        randomAffixes: [{ stat: 'manaRegen', min: 1, max: 3 }],
      },
    ],
    legendaryEffect: { id: 'mage_missile_aoe', desc: 'Magic Missile and bolt spells fire a bonus projectile at a second target for 60% damage.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 6, mp: 20, spellPower: 0.08, desc: '+6 INT, +20 MP, +8% Spell Power, Bonus Projectile' },
    },
  },

  // 3. Shadow Adept — rogue starter (dagger + cloak/light_chest).
  shadow_adept: {
    id: 'shadow_adept',
    name: "Shadow Adept",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'dagger',
        fixedAffixes: [{ stat: 'dex', value: 5 }, { stat: 'critChance', value: 0.06 }],
        randomAffixes: [{ stat: 'dmg', min: 2, max: 5 }],
      },
      {
        slot: 'chest',
        baseItemId: 'light_chest',
        fixedAffixes: [{ stat: 'dex', value: 5 }, { stat: 'dodge', value: 5 }],
        randomAffixes: [{ stat: 'initiative', min: 1, max: 3 }],
      },
    ],
    legendaryEffect: { id: 'crit_bleed_5', desc: 'Critical hits inflict Bleed for 3 rounds.', activationPieces: 2 },
    partialBonuses: {
      '2': { dex: 6, dodge: 5, critChance: 0.05, desc: '+6 DEX, +5 Dodge, +5% Crit, Crit Bleed' },
    },
  },

  // 4. Verdant Warden — ranger starter (shortbow + light_legs).
  verdant_warden: {
    id: 'verdant_warden',
    name: "Verdant Warden",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'shortbow',
        fixedAffixes: [{ stat: 'dex', value: 6 }, { stat: 'hit', value: 4 }],
        randomAffixes: [{ stat: 'critDamage', min: 0.10, max: 0.25 }],
      },
      {
        slot: 'legs',
        baseItemId: 'light_legs',
        fixedAffixes: [{ stat: 'dex', value: 4 }, { stat: 'dodge', value: 4 }],
        randomAffixes: [{ stat: 'hp', min: 10, max: 20 }],
      },
    ],
    legendaryEffect: { id: 'speed_combat_init', desc: 'On combat start, gain +8 initiative for the first round.', activationPieces: 2 },
    partialBonuses: {
      '2': { dex: 5, hit: 4, dodge: 4, desc: '+5 DEX, +4 Hit, +4 Dodge, Combat-Start Speed' },
    },
  },

  // 5. Cleric's Vigil — healer starter (scepter + cloth_chest).
  clerics_vigil: {
    id: 'clerics_vigil',
    name: "Cleric's Vigil",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'scepter',
        fixedAffixes: [{ stat: 'int', value: 4 }, { stat: 'mp', value: 12 }],
        randomAffixes: [{ stat: 'spellPower', min: 0.06, max: 0.12 }],
      },
      {
        slot: 'head',
        baseItemId: 'cloth_helm',
        fixedAffixes: [{ stat: 'con', value: 4 }, { stat: 'hp', value: 20 }],
        randomAffixes: [{ stat: 'manaRegen', min: 1, max: 2 }],
      },
    ],
    legendaryEffect: { id: 'kill_party_heal', desc: 'Killing blows heal the party for 10% of the target\'s max HP.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 4, con: 4, hp: 15, mp: 12, desc: '+4 INT/CON, +15 HP, +12 MP, Party Heal on Kill' },
    },
  },

  // 6. Paladin's Oath — tankadin starter (shield + heavy_chest).
  paladins_oath: {
    id: 'paladins_oath',
    name: "Paladin's Oath",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'offhand',
        baseItemId: 'shield',
        fixedAffixes: [{ stat: 'str', value: 4 }, { stat: 'block_power', value: 10 }],
        randomAffixes: [{ stat: 'armor', min: 3, max: 8 }],
      },
      {
        slot: 'chest',
        baseItemId: 'heavy_chest',
        fixedAffixes: [{ stat: 'str', value: 4 }, { stat: 'armor', value: 6 }],
        randomAffixes: [{ stat: 'hp', min: 20, max: 40 }],
      },
    ],
    legendaryEffect: { id: 'cheat_death_once', desc: 'Once per combat, survive a killing blow with 1 HP.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 5, armor: 8, block_power: 12, desc: '+5 STR, +8 Armor, +12 Block Power, Cheat Death' },
    },
  },

  // 7. Savage Berserker — two-handed warrior starter (axe2h + heavy_legs).
  savage_berserker: {
    id: 'savage_berserker',
    name: "Savage Berserker",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'axe2h',
        fixedAffixes: [{ stat: 'str', value: 6 }, { stat: 'critChance', value: 0.04 }],
        randomAffixes: [{ stat: 'dmg', min: 3, max: 7 }],
      },
      {
        slot: 'legs',
        baseItemId: 'heavy_legs',
        fixedAffixes: [{ stat: 'str', value: 4 }, { stat: 'hp', value: 25 }],
        randomAffixes: [{ stat: 'armor', min: 3, max: 6 }],
      },
    ],
    legendaryEffect: { id: 'crit_bleed_5', desc: 'Critical hits inflict Bleed for 3 rounds.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 8, hp: 20, critChance: 0.04, desc: '+8 STR, +20 HP, +4% Crit, Crit Bleed' },
    },
  },

  // 8. Witch Doctor's Bargain — necro/warlock starter (staff + cloth_legs).
  witch_doctor_bargain: {
    id: 'witch_doctor_bargain',
    name: "Witch Doctor's Bargain",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'staff',
        fixedAffixes: [{ stat: 'int', value: 5 }, { stat: 'spellPower', value: 0.08 }],
        randomAffixes: [{ stat: 'lifeSteal', min: 3, max: 8 }],
      },
      {
        slot: 'legs',
        baseItemId: 'cloth_legs',
        fixedAffixes: [{ stat: 'int', value: 3 }, { stat: 'mp', value: 18 }],
        randomAffixes: [{ stat: 'manaSteal', min: 3, max: 7 }],
      },
    ],
    legendaryEffect: { id: 'low_mana_shockwave', desc: 'When below 25% mana, casting triggers an AoE shockwave.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 6, mp: 15, spellPower: 0.07, desc: '+6 INT, +15 MP, +7% Spell Power, Low-Mana Shockwave' },
    },
  },

  // 9. Skirmisher's Edge — mobile fighter starter (rapier + light_boots).
  skirmishers_edge: {
    id: 'skirmishers_edge',
    name: "Skirmisher's Edge",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'rapier',
        fixedAffixes: [{ stat: 'dex', value: 5 }, { stat: 'initiative', value: 2 }],
        randomAffixes: [{ stat: 'critChance', min: 0.04, max: 0.08 }],
      },
      {
        slot: 'feet',
        baseItemId: 'light_boots',
        fixedAffixes: [{ stat: 'dex', value: 4 }, { stat: 'dodge', value: 5 }],
        randomAffixes: [{ stat: 'initiative', min: 1, max: 2 }],
      },
    ],
    legendaryEffect: { id: 'speed_combat_init', desc: 'On combat start, gain +8 initiative for the first round.', activationPieces: 2 },
    partialBonuses: {
      '2': { dex: 6, dodge: 5, initiative: 3, desc: '+6 DEX, +5 Dodge, +3 Initiative, Combat-Start Haste' },
    },
  },

  // 10. Hammerer's Conviction — stunning hammer fighter (warhammer + heavy_gauntlets).
  hammerers_conviction: {
    id: 'hammerers_conviction',
    name: "Hammerer's Conviction",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'warhammer',
        fixedAffixes: [{ stat: 'str', value: 5 }, { stat: 'dmg', value: 3 }],
        randomAffixes: [{ stat: 'hit', min: 3, max: 6 }],
      },
      {
        slot: 'hands',
        baseItemId: 'heavy_gauntlets',
        fixedAffixes: [{ stat: 'str', value: 4 }, { stat: 'armor', value: 4 }],
        randomAffixes: [{ stat: 'critChance', min: 0.03, max: 0.07 }],
      },
    ],
    legendaryEffect: { id: 'critical_armorpen', desc: 'Critical hits reduce target armor by 30% for 1 round.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 6, dmg: 4, armor: 4, desc: '+6 STR, +4 Damage, +4 Armor, Crit Armor Shred' },
    },
  },

  // 11. Frostbinder's Pact — ice mage starter (orb + cloth_helm).
  frostbinders_pact: {
    id: 'frostbinders_pact',
    name: "Frostbinder's Pact",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'orb',
        fixedAffixes: [{ stat: 'int', value: 5 }, { stat: 'spellPower', value: 0.10 }],
        randomAffixes: [{ stat: 'mp', min: 10, max: 20 }],
      },
      {
        slot: 'head',
        baseItemId: 'cloth_helm',
        fixedAffixes: [{ stat: 'int', value: 4 }, { stat: 'magicResist', value: 6 }],
        randomAffixes: [{ stat: 'manaRegen', min: 1, max: 2 }],
      },
    ],
    legendaryEffect: { id: 'mana_on_attack', desc: 'Basic attacks restore 3 mana.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 6, mp: 15, magicResist: 6, desc: '+6 INT, +15 MP, +6 Magic Resist, Mana on Attack' },
    },
  },

  // 12. Pilgrim's Resolve — generalist starter (longsword + medium_chest).
  pilgrims_resolve: {
    id: 'pilgrims_resolve',
    name: "Pilgrim's Resolve",
    tier: 'low',
    pieces: 2,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'longsword',
        fixedAffixes: [{ stat: 'str', value: 3 }, { stat: 'dex', value: 3 }],
        randomAffixes: [{ stat: 'hit', min: 2, max: 5 }],
      },
      {
        slot: 'chest',
        baseItemId: 'medium_chest',
        fixedAffixes: [{ stat: 'con', value: 4 }, { stat: 'hp', value: 20 }],
        randomAffixes: [{ stat: 'armor', min: 2, max: 6 }],
      },
    ],
    legendaryEffect: { id: 'rally_on_kill', desc: 'Killing an enemy rallies the entire party for 1 round.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 3, dex: 3, con: 4, hp: 18, desc: '+3 STR/DEX, +4 CON, +18 HP, Party Rally on Kill' },
    },
  },

  // ─── MID-TIER SETS (3-piece) ─────────────────────────────────────────────────

  // 13. Order of the Eclipse — paladin mid-set (helm + chest + offhand).
  order_of_eclipse: {
    id: 'order_of_eclipse',
    name: "Order of the Eclipse",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'head',
        baseItemId: 'plate_helm',
        fixedAffixes: [{ stat: 'str', value: 6 }, { stat: 'con', value: 4 }],
        randomAffixes: [{ stat: 'armor', min: 4, max: 10 }],
      },
      {
        slot: 'chest',
        baseItemId: 'heavy_chest',
        fixedAffixes: [{ stat: 'str', value: 6 }, { stat: 'armor', value: 10 }],
        randomAffixes: [{ stat: 'hp', min: 30, max: 60 }],
      },
      {
        slot: 'offhand',
        baseItemId: 'kite_shield',
        fixedAffixes: [{ stat: 'con', value: 5 }, { stat: 'block_power', value: 15 }],
        randomAffixes: [{ stat: 'magicResist', min: 5, max: 12 }],
      },
    ],
    legendaryEffect: { id: 'cheat_death_once', desc: 'Once per combat, survive a killing blow with 1 HP.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 5, armor: 8, desc: '+5 STR, +8 Armor' },
      '3': { str: 8, con: 6, armor: 14, block_power: 18, desc: '+8 STR, +6 CON, +14 Armor, +18 Block Power, Cheat Death' },
    },
  },

  // 14. Fang of the Frost Wyrm — ranger/hunter mid-set (bow + legs + boots).
  fang_frost_wyrm: {
    id: 'fang_frost_wyrm',
    name: "Fang of the Frost Wyrm",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'bow',
        fixedAffixes: [{ stat: 'dex', value: 7 }, { stat: 'critChance', value: 0.07 }],
        randomAffixes: [{ stat: 'dmg', min: 4, max: 9 }],
      },
      {
        slot: 'legs',
        baseItemId: 'light_legs',
        fixedAffixes: [{ stat: 'dex', value: 5 }, { stat: 'dodge', value: 6 }],
        randomAffixes: [{ stat: 'initiative', min: 1, max: 3 }],
      },
      {
        slot: 'feet',
        baseItemId: 'light_boots',
        fixedAffixes: [{ stat: 'dex', value: 5 }, { stat: 'initiative', value: 2 }],
        randomAffixes: [{ stat: 'hit', min: 3, max: 6 }],
      },
    ],
    legendaryEffect: { id: 'critical_armorpen', desc: 'Critical hits reduce target armor by 30% for 1 round.', activationPieces: 2 },
    partialBonuses: {
      '2': { dex: 6, critChance: 0.05, desc: '+6 DEX, +5% Crit' },
      '3': { dex: 10, dodge: 6, critChance: 0.08, initiative: 3, desc: '+10 DEX, +6 Dodge, +8% Crit, +3 Initiative, Crit Armor Shred' },
    },
  },

  // 15. Arcanist's Vestments — wizard mid-set (staff + helm + legs).
  arcanist_vestments: {
    id: 'arcanist_vestments',
    name: "Arcanist's Vestments",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'staff',
        fixedAffixes: [{ stat: 'int', value: 8 }, { stat: 'spellPower', value: 0.12 }],
        randomAffixes: [{ stat: 'mp', min: 15, max: 30 }],
      },
      {
        slot: 'head',
        baseItemId: 'cloth_helm',
        fixedAffixes: [{ stat: 'int', value: 6 }, { stat: 'mp', value: 20 }],
        randomAffixes: [{ stat: 'manaRegen', min: 2, max: 4 }],
      },
      {
        slot: 'legs',
        baseItemId: 'cloth_legs',
        fixedAffixes: [{ stat: 'int', value: 5 }, { stat: 'magicResist', value: 8 }],
        randomAffixes: [{ stat: 'spellPower', min: 0.05, max: 0.10 }],
      },
    ],
    legendaryEffect: { id: 'mana_on_attack', desc: 'Basic attacks restore 3 mana.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 7, spellPower: 0.08, desc: '+7 INT, +8% Spell Power' },
      '3': { int: 12, mp: 25, spellPower: 0.15, magicResist: 8, desc: '+12 INT, +25 MP, +15% Spell Power, +8 Magic Resist, Mana on Attack' },
    },
  },

  // 16. Crimson Brotherhood — assassin mid-set (dagger + light_chest + hands).
  crimson_brotherhood: {
    id: 'crimson_brotherhood',
    name: "Crimson Brotherhood",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'dagger',
        fixedAffixes: [{ stat: 'dex', value: 7 }, { stat: 'lifeSteal', value: 6 }],
        randomAffixes: [{ stat: 'critChance', min: 0.05, max: 0.10 }],
      },
      {
        slot: 'chest',
        baseItemId: 'light_chest',
        fixedAffixes: [{ stat: 'dex', value: 6 }, { stat: 'dodge', value: 7 }],
        randomAffixes: [{ stat: 'hp', min: 20, max: 40 }],
      },
      {
        slot: 'hands',
        baseItemId: 'light_gauntlets',
        fixedAffixes: [{ stat: 'dex', value: 5 }, { stat: 'critDamage', value: 0.20 }],
        randomAffixes: [{ stat: 'initiative', min: 1, max: 3 }],
      },
    ],
    legendaryEffect: { id: 'crit_bleed_5', desc: 'Critical hits inflict Bleed for 3 rounds.', activationPieces: 2 },
    partialBonuses: {
      '2': { dex: 6, dodge: 5, desc: '+6 DEX, +5 Dodge' },
      '3': { dex: 10, dodge: 8, critChance: 0.07, critDamage: 0.20, lifeSteal: 6, desc: '+10 DEX, +8 Dodge, +7% Crit, +20% Crit Dmg, Crit Bleed' },
    },
  },

  // 17. Ember Warden — fire-theme mid-set (scepter + cloth_chest + ring).
  ember_warden: {
    id: 'ember_warden',
    name: "Ember Warden",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'scepter',
        fixedAffixes: [{ stat: 'int', value: 7 }, { stat: 'spellPower', value: 0.10 }],
        randomAffixes: [{ stat: 'mp', min: 10, max: 25 }],
      },
      {
        slot: 'chest',
        baseItemId: 'cloth_chest',
        fixedAffixes: [{ stat: 'int', value: 5 }, { stat: 'mp', value: 20 }],
        randomAffixes: [{ stat: 'magicResist', min: 5, max: 10 }],
      },
      {
        slot: 'ring1',
        baseItemId: 'ring',
        fixedAffixes: [{ stat: 'int', value: 4 }, { stat: 'spellPower', value: 0.08 }],
        randomAffixes: [{ stat: 'critChance', min: 0.04, max: 0.09 }],
      },
    ],
    legendaryEffect: { id: 'burn_extend', desc: 'Burn effects you apply last 2 extra rounds.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 6, spellPower: 0.07, desc: '+6 INT, +7% Spell Power' },
      '3': { int: 10, mp: 22, spellPower: 0.14, desc: '+10 INT, +22 MP, +14% Spell Power, Extended Burns' },
    },
  },

  // 18. Ironveil Covenant — tank/spellcaster hybrid mid-set (shield + chest + helm).
  ironveil_covenant: {
    id: 'ironveil_covenant',
    name: "Ironveil Covenant",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'offhand',
        baseItemId: 'tower_shield',
        fixedAffixes: [{ stat: 'str', value: 5 }, { stat: 'block_power', value: 20 }],
        randomAffixes: [{ stat: 'armor', min: 5, max: 12 }],
      },
      {
        slot: 'chest',
        baseItemId: 'medium_chest',
        fixedAffixes: [{ stat: 'con', value: 6 }, { stat: 'armor', value: 8 }],
        randomAffixes: [{ stat: 'hp', min: 25, max: 50 }],
      },
      {
        slot: 'head',
        baseItemId: 'medium_helm',
        fixedAffixes: [{ stat: 'con', value: 5 }, { stat: 'magicResist', value: 8 }],
        randomAffixes: [{ stat: 'dodge', min: 3, max: 7 }],
      },
    ],
    legendaryEffect: { id: 'cheat_death_once', desc: 'Once per combat, survive a killing blow at 1 HP.', activationPieces: 2 },
    partialBonuses: {
      '2': { con: 5, armor: 8, desc: '+5 CON, +8 Armor' },
      '3': { str: 5, con: 8, armor: 14, block_power: 22, magicResist: 8, desc: '+5 STR, +8 CON, +14 Armor, +22 Block Power, Cheat Death' },
    },
  },

  // 19. Druidic Resurgence — nature druid mid-set (quarterstaff + legs + necklace).
  druidic_resurgence: {
    id: 'druidic_resurgence',
    name: "Druidic Resurgence",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'quarterstaff',
        fixedAffixes: [{ stat: 'int', value: 5 }, { stat: 'str', value: 4 }],
        randomAffixes: [{ stat: 'spellPower', min: 0.07, max: 0.14 }],
      },
      {
        slot: 'legs',
        baseItemId: 'medium_legs',
        fixedAffixes: [{ stat: 'con', value: 5 }, { stat: 'hp', value: 25 }],
        randomAffixes: [{ stat: 'armor', min: 3, max: 8 }],
      },
      {
        slot: 'necklace',
        baseItemId: 'necklace',
        fixedAffixes: [{ stat: 'int', value: 4 }, { stat: 'manaRegen', value: 2 }],
        randomAffixes: [{ stat: 'mp', min: 15, max: 30 }],
      },
    ],
    legendaryEffect: { id: 'mage_missile_aoe', desc: 'Nature skills fire a bonus echo at 60% power.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 4, con: 4, hp: 15, desc: '+4 INT/CON, +15 HP' },
      '3': { int: 7, con: 6, hp: 22, mp: 20, manaRegen: 2, desc: '+7 INT, +6 CON, +22 HP, +20 MP, Skill Echo' },
    },
  },

  // 20. Warlord's Dominion — two-handed warrior mid-set (sword2h + chest + helm).
  warlords_dominion: {
    id: 'warlords_dominion',
    name: "Warlord's Dominion",
    tier: 'mid',
    pieces: 3,
    items: [
      {
        slot: 'weapon',
        baseItemId: 'sword2h',
        fixedAffixes: [{ stat: 'str', value: 8 }, { stat: 'dmg', value: 6 }],
        randomAffixes: [{ stat: 'critChance', min: 0.04, max: 0.10 }],
      },
      {
        slot: 'chest',
        baseItemId: 'heavy_chest',
        fixedAffixes: [{ stat: 'str', value: 7 }, { stat: 'armor', value: 8 }],
        randomAffixes: [{ stat: 'hp', min: 30, max: 60 }],
      },
      {
        slot: 'head',
        baseItemId: 'heavy_helm',
        fixedAffixes: [{ stat: 'str', value: 6 }, { stat: 'con', value: 4 }],
        randomAffixes: [{ stat: 'armor', min: 4, max: 10 }],
      },
    ],
    legendaryEffect: { id: 'rally_on_kill', desc: 'Killing an enemy rallies the party for 1 round.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 7, dmg: 5, desc: '+7 STR, +5 Damage' },
      '3': { str: 12, dmg: 8, armor: 10, con: 4, desc: '+12 STR, +8 Damage, +10 Armor, +4 CON, Party Rally on Kill' },
    },
  },

  // ─── ENDGAME SETS (4-5 pieces) ───────────────────────────────────────────────

  // 21. Architect's Vestments — 5-piece endgame mage set.
  architects_vestments: {
    id: 'architects_vestments',
    name: "Architect's Vestments",
    tier: 'endgame',
    pieces: 5,
    items: [
      { slot: 'weapon',   baseItemId: 'dragonbone_staff',  fixedAffixes: [{ stat: 'int', value: 12 }, { stat: 'spellPower', value: 0.20 }], randomAffixes: [{ stat: 'mp', min: 30, max: 60 }] },
      { slot: 'head',     baseItemId: 'cloth_helm',         fixedAffixes: [{ stat: 'int', value: 10 }, { stat: 'mp', value: 40 }], randomAffixes: [{ stat: 'manaRegen', min: 3, max: 6 }] },
      { slot: 'chest',    baseItemId: 'dragonscale_cloth',  fixedAffixes: [{ stat: 'int', value: 10 }, { stat: 'spellPower', value: 0.12 }], randomAffixes: [{ stat: 'magicResist', min: 8, max: 18 }] },
      { slot: 'legs',     baseItemId: 'cloth_legs',         fixedAffixes: [{ stat: 'int', value: 8 }, { stat: 'mp', value: 30 }], randomAffixes: [{ stat: 'spellPower', min: 0.08, max: 0.15 }] },
      { slot: 'necklace', baseItemId: 'necklace',           fixedAffixes: [{ stat: 'int', value: 8 }, { stat: 'critChance', value: 0.10 }], randomAffixes: [{ stat: 'critDamage', min: 0.20, max: 0.40 }] },
    ],
    legendaryEffect: { id: 'mage_missile_aoe', desc: 'All cast spells fire a bonus projectile at a second target for 60% damage.', activationPieces: 2 },
    partialBonuses: {
      '2': { int: 8, spellPower: 0.08, desc: '+8 INT, +8% Spell Power' },
      '3': { int: 12, spellPower: 0.14, mp: 30, desc: '+12 INT, +14% Spell Power, +30 MP' },
      '4': { int: 16, spellPower: 0.20, mp: 50, magicResist: 10, desc: '+16 INT, +20% Spell Power, +50 MP, +10 Magic Resist' },
      '5': { int: 22, spellPower: 0.30, mp: 75, magicResist: 15, critChance: 0.08, desc: '+22 INT, +30% Spell Power, +75 MP, +15 Resist, +8% Crit, Dual Projectile' },
    },
  },

  // 22. Sovereign's Regalia — 4-piece endgame paladin/warrior set.
  sovereigns_regalia: {
    id: 'sovereigns_regalia',
    name: "Sovereign's Regalia",
    tier: 'endgame',
    pieces: 4,
    items: [
      { slot: 'head',    baseItemId: 'wyrmscale_helm',      fixedAffixes: [{ stat: 'str', value: 10 }, { stat: 'con', value: 8 }], randomAffixes: [{ stat: 'armor', min: 8, max: 18 }] },
      { slot: 'chest',   baseItemId: 'wyrmscale_chest',     fixedAffixes: [{ stat: 'str', value: 10 }, { stat: 'armor', value: 15 }], randomAffixes: [{ stat: 'hp', min: 50, max: 100 }] },
      { slot: 'legs',    baseItemId: 'heavy_legs',          fixedAffixes: [{ stat: 'con', value: 8 }, { stat: 'armor', value: 10 }], randomAffixes: [{ stat: 'hp', min: 40, max: 80 }] },
      { slot: 'offhand', baseItemId: 'aegis_shield',        fixedAffixes: [{ stat: 'str', value: 8 }, { stat: 'block_power', value: 30 }], randomAffixes: [{ stat: 'magicResist', min: 10, max: 20 }] },
    ],
    legendaryEffect: { id: 'cheat_death_once', desc: 'Once per combat, survive a killing blow with 1 HP. Killing blows also heal the party.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 8, armor: 12, desc: '+8 STR, +12 Armor' },
      '3': { str: 12, con: 8, armor: 18, desc: '+12 STR, +8 CON, +18 Armor' },
      '4': { str: 18, con: 14, armor: 28, block_power: 35, hp: 60, desc: '+18 STR, +14 CON, +28 Armor, +35 Block Power, +60 HP, Cheat Death' },
    },
  },

  // 23. Unraveler's Mantle — 4-piece endgame shadow/void set.
  unravelers_mantle: {
    id: 'unravelers_mantle',
    name: "Unraveler's Mantle",
    tier: 'endgame',
    pieces: 4,
    items: [
      { slot: 'weapon',  baseItemId: 'dragonfang_dagger',  fixedAffixes: [{ stat: 'dex', value: 10 }, { stat: 'lifeSteal', value: 10 }], randomAffixes: [{ stat: 'critChance', min: 0.08, max: 0.15 }] },
      { slot: 'head',    baseItemId: 'light_helm',         fixedAffixes: [{ stat: 'dex', value: 8 }, { stat: 'dodge', value: 10 }], randomAffixes: [{ stat: 'initiative', min: 2, max: 5 }] },
      { slot: 'chest',   baseItemId: 'dragonscale_cloth',  fixedAffixes: [{ stat: 'dex', value: 8 }, { stat: 'armor', value: 6 }], randomAffixes: [{ stat: 'hp', min: 40, max: 80 }] },
      { slot: 'necklace',baseItemId: 'necklace',           fixedAffixes: [{ stat: 'dex', value: 6 }, { stat: 'manaSteal', value: 8 }], randomAffixes: [{ stat: 'critDamage', min: 0.25, max: 0.50 }] },
    ],
    legendaryEffect: { id: 'echo_cast', desc: '25% chance for any skill to echo at 50% power.', activationPieces: 2 },
    partialBonuses: {
      '2': { dex: 8, critChance: 0.06, desc: '+8 DEX, +6% Crit' },
      '3': { dex: 12, dodge: 8, critChance: 0.09, lifeSteal: 6, desc: '+12 DEX, +8 Dodge, +9% Crit, +6% Lifesteal' },
      '4': { dex: 18, dodge: 12, critChance: 0.12, critDamage: 0.30, lifeSteal: 12, manaSteal: 8, desc: '+18 DEX, +12 Dodge, +12% Crit, +30% Crit Dmg, Skill Echo' },
    },
  },

  // 24. Dragon-Lord's Aspect — 4-piece endgame dragon warrior set.
  dragon_lords_aspect: {
    id: 'dragon_lords_aspect',
    name: "Dragon-Lord's Aspect",
    tier: 'endgame',
    pieces: 4,
    items: [
      { slot: 'weapon',  baseItemId: 'dragonfang_greatsword', fixedAffixes: [{ stat: 'str', value: 12 }, { stat: 'dmg', value: 10 }], randomAffixes: [{ stat: 'critChance', min: 0.06, max: 0.12 }] },
      { slot: 'head',    baseItemId: 'wyrmscale_helm',        fixedAffixes: [{ stat: 'str', value: 10 }, { stat: 'con', value: 6 }], randomAffixes: [{ stat: 'armor', min: 8, max: 20 }] },
      { slot: 'chest',   baseItemId: 'dragonsteel_chest',     fixedAffixes: [{ stat: 'str', value: 10 }, { stat: 'armor', value: 18 }], randomAffixes: [{ stat: 'hp', min: 60, max: 100 }] },
      { slot: 'necklace',baseItemId: 'dragontooth_amulet',    fixedAffixes: [{ stat: 'str', value: 8 }, { stat: 'critDamage', value: 0.30 }], randomAffixes: [{ stat: 'lifeSteal', min: 6, max: 12 }] },
    ],
    legendaryEffect: { id: 'dragon_fury_breath', desc: 'Killing an enemy triggers Dragon Breath hitting all remaining enemies for 20+STR fire damage and Burn.', activationPieces: 2 },
    partialBonuses: {
      '2': { str: 10, dmg: 8, desc: '+10 STR, +8 Damage' },
      '3': { str: 14, dmg: 12, armor: 14, desc: '+14 STR, +12 Damage, +14 Armor' },
      '4': { str: 22, dmg: 18, armor: 22, con: 8, critDamage: 0.30, desc: '+22 STR, +18 Damage, +22 Armor, +8 CON, +30% Crit Dmg, Dragon Breath' },
    },
  },
};

/**
 * Get the set definition for a given item (by setId field).
 * @param {string} setId
 * @returns {object|null}
 */
export function getSetDef(setId) {
  return SETS[setId] || null;
}

/**
 * Check which sets are active for a character's equipment.
 * Returns an array of { setId, name, tier, piecesEquipped, total, activeBonuses, legendaryActive }.
 *
 * Respects cond_extraSetPiece affix: adds +1 to counted pieces for any set
 * that has at least 1 real piece equipped.
 *
 * @param {object} equipment — member.equipment map
 * @returns {object[]}
 */
export function getActiveSetBonuses(equipment) {
  if (!equipment) return [];

  // Collect set IDs from all equipped items
  const equippedSetIds = Object.values(equipment)
    .filter(Boolean)
    .flatMap(item => (item.setId ? [item.setId] : []));

  // Check for "extra set piece" affix on any equipped item
  const hasExtraSetPiece = Object.values(equipment).filter(Boolean).some(item =>
    (item.affixes || []).some(a => a.stat === 'cond_extraSetPiece')
  );

  const results = [];

  for (const [setId, def] of Object.entries(SETS)) {
    let count = equippedSetIds.filter(s => s === setId).length;
    if (count === 0) continue; // no pieces, skip entirely

    // Extra set piece affix: bump count by 1 if any piece equipped
    if (hasExtraSetPiece) count = Math.min(def.pieces, count + 1);

    // Collect partial bonuses up to pieces equipped
    const activeBonuses = [];
    for (const [threshold, bonus] of Object.entries(def.partialBonuses || {})) {
      if (count >= parseInt(threshold, 10)) activeBonuses.push(bonus);
    }

    const legendaryActive = count >= (def.legendaryEffect?.activationPieces ?? def.pieces);

    results.push({
      setId,
      name: def.name,
      tier: def.tier,
      piecesEquipped: count,
      total: def.pieces,
      activeBonuses,
      legendaryActive,
      legendaryEffect: def.legendaryEffect || null,
    });
  }

  return results;
}

/**
 * Apply set bonus stats to a flat bonus bundle (same shape as emptyAffixBonuses()).
 * Call this after getActiveSetBonuses, then merge into the affix bonus result.
 *
 * @param {object[]} activeSets — result of getActiveSetBonuses()
 * @param {object}   out        — mutable bonus bundle (mutated in-place)
 * @returns {object} out (same reference)
 */
export function applySetBonusStats(activeSets, out) {
  for (const { activeBonuses } of activeSets) {
    for (const bonus of activeBonuses) {
      for (const [k, v] of Object.entries(bonus)) {
        if (k === 'desc') continue;
        if (typeof v === 'number' && typeof out[k] === 'number') {
          out[k] += v;
        }
      }
    }
  }
  return out;
}

/**
 * Collect all legendary effect IDs that are currently active
 * (i.e., enough pieces equipped for each set).
 *
 * @param {object[]} activeSets — result of getActiveSetBonuses()
 * @returns {string[]} effectId strings
 */
export function getActiveLegendaryEffects(activeSets) {
  return activeSets
    .filter(s => s.legendaryActive && s.legendaryEffect?.id)
    .map(s => s.legendaryEffect.id);
}
