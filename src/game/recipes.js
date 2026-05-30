/**
 * recipes.js — M307
 *
 * Unique-item crafting recipes + common gear recipes.
 *
 * Schema per unique recipe:
 * {
 *   uniqueId    {string}   — must match a key in UNIQUES
 *   name        {string}   — display name
 *   tier        {string}   — 'unique' (always for unique items)
 *   materials   {object}   — { matId: count }
 *   goldCost    {number}   — gold spent on craft
 *   unlockBy    {object}   — { type: 'boss_kill'|'lore_node'|'always', id?: string }
 * }
 *
 * Common gear recipe schema:
 * {
 *   id          {string}
 *   name        {string}
 *   tier        {string}   — 'white'|'magic'|'rare'
 *   slot        {string}   — equipment slot label
 *   craftSlot   {string}   — used by blacksmith craft handler
 *   base        {string}   — base item key
 *   rarity      {string}   — 'normal'|'magic'|'rare'
 *   quality     {string}   — 'low'|'medium'|'high'
 *   materials   {object}
 *   goldCost    {number}
 *   unlockBy    {object}
 * }
 *
 * Unlock tier rules (Task 2):
 *   white   — unlocked by first town visit (auto)
 *   magic   — unlocked at player level 5
 *   rare    — unlocked at level 10 OR act 2+
 *   unique  — unlocked by boss_kill or lore_node per recipe definition
 */

// ─── Unique-item recipes (~25) ────────────────────────────────────────────────
// Materials: ember_shard, void_essence, wyvern_fang, titan_stone, shadow_silk,
//   dragon_scale, ancient_rune + existing materials from items.js

export const UNIQUE_RECIPES = [

  // ─── Act 1 ────────────────────────────────────────────────────────────────

  {
    uniqueId: 'emberheart_pendant',
    name: 'Emberheart Pendant',
    tier: 'unique',
    materials: { ember_shard: 4, rare_dust: 2, legend_core: 1 },
    goldCost: 800,
    unlockBy: { type: 'boss_kill', id: 'grax_veil_touched' },
  },
  {
    uniqueId: 'thornblade',
    name: 'Thornblade',
    tier: 'unique',
    materials: { ember_shard: 3, magic_essence: 4, rare_dust: 1 },
    goldCost: 600,
    unlockBy: { type: 'lore_node', id: 'thornwood_lore_1' },
  },
  {
    uniqueId: 'sentinels_gaze',
    name: "Sentinel's Gaze",
    tier: 'unique',
    materials: { iron_scrap: 6, ember_shard: 2, rare_dust: 2 },
    goldCost: 650,
    unlockBy: { type: 'lore_node', id: 'border_roads_lore_1' },
  },
  {
    uniqueId: 'truthseeker',
    name: 'Truthseeker',
    tier: 'unique',
    materials: { ember_shard: 3, magic_essence: 5, rare_dust: 1 },
    goldCost: 700,
    unlockBy: { type: 'boss_kill', id: 'grax_veil_touched' },
  },

  // ─── Act 2 ────────────────────────────────────────────────────────────────

  {
    uniqueId: 'lava_titans_mantle',
    name: "Lava Titan's Mantle",
    tier: 'unique',
    materials: { titan_stone: 4, ember_shard: 4, legend_core: 1 },
    goldCost: 1200,
    unlockBy: { type: 'boss_kill', id: 'lava_titan' },
  },
  {
    uniqueId: 'magma_scepter',
    name: 'Magma Scepter',
    tier: 'unique',
    materials: { titan_stone: 3, ember_shard: 5, rare_dust: 2 },
    goldCost: 1000,
    unlockBy: { type: 'boss_kill', id: 'lava_titan' },
  },
  {
    uniqueId: 'ashen_kite_shield',
    name: 'Ashen Kite Shield',
    tier: 'unique',
    materials: { iron_scrap: 8, titan_stone: 3, rare_dust: 3 },
    goldCost: 900,
    unlockBy: { type: 'lore_node', id: 'ember_plateau_lore_1' },
  },
  {
    uniqueId: 'dune_runners_shortbow',
    name: "Dune Runner's Shortbow",
    tier: 'unique',
    materials: { ember_shard: 4, magic_essence: 5, rare_dust: 2 },
    goldCost: 950,
    unlockBy: { type: 'lore_node', id: 'dust_roads_lore_1' },
  },

  // ─── Act 3 ────────────────────────────────────────────────────────────────

  {
    uniqueId: 'malgraths_soulbrand',
    name: "Malgrath's Soulbrand",
    tier: 'unique',
    materials: { void_essence: 5, wyvern_fang: 3, legend_core: 2 },
    goldCost: 1800,
    unlockBy: { type: 'boss_kill', id: 'archfiend_malgrath' },
  },
  {
    uniqueId: 'warlords_insignia',
    name: "Warlord's Insignia",
    tier: 'unique',
    materials: { void_essence: 3, rare_dust: 4, legend_core: 1 },
    goldCost: 1400,
    unlockBy: { type: 'lore_node', id: 'hell_breach_lore_1' },
  },
  {
    uniqueId: 'deadwalkers_greaves',
    name: "Deadwalker's Greaves",
    tier: 'unique',
    materials: { void_essence: 4, wyvern_fang: 2, rare_dust: 3 },
    goldCost: 1500,
    unlockBy: { type: 'boss_kill', id: 'archfiend_malgrath' },
  },
  {
    uniqueId: 'shadowweave_cloak',
    name: 'Shadowweave Cloak',
    tier: 'unique',
    materials: { shadow_silk: 5, void_essence: 3, rare_dust: 2 },
    goldCost: 1400,
    unlockBy: { type: 'lore_node', id: 'hell_breach_lore_2' },
  },

  // ─── Act 4 ────────────────────────────────────────────────────────────────

  {
    uniqueId: 'sovereigns_eye',
    name: "Sovereign's Eye",
    tier: 'unique',
    materials: { void_essence: 6, ancient_rune: 3, legend_core: 2 },
    goldCost: 2200,
    unlockBy: { type: 'boss_kill', id: 'emberveil_sovereign' },
  },
  {
    uniqueId: 'voidbinder',
    name: 'Voidbinder',
    tier: 'unique',
    materials: { void_essence: 5, ancient_rune: 4, legend_core: 2 },
    goldCost: 2400,
    unlockBy: { type: 'boss_kill', id: 'the_unraveler' },
  },
  {
    uniqueId: 'unravelers_sigil',
    name: "Unraveler's Sigil",
    tier: 'unique',
    materials: { void_essence: 7, ancient_rune: 4, legend_core: 3 },
    goldCost: 2800,
    unlockBy: { type: 'boss_kill', id: 'the_unraveler' },
  },
  {
    uniqueId: 'gauntlets_of_void',
    name: 'Gauntlets of the Void',
    tier: 'unique',
    materials: { void_essence: 4, ancient_rune: 2, rare_dust: 4 },
    goldCost: 1800,
    unlockBy: { type: 'lore_node', id: 'cosmic_rift_lore_1' },
  },

  // ─── Act 5 ────────────────────────────────────────────────────────────────

  {
    uniqueId: 'architects_blueprint',
    name: "The Architect's Blueprint",
    tier: 'unique',
    materials: { dragon_scale: 3, ancient_rune: 6, legend_core: 3 },
    goldCost: 3500,
    unlockBy: { type: 'boss_kill', id: 'the_architect' },
  },
  {
    uniqueId: 'staff_of_primordial',
    name: 'Staff of the Primordial',
    tier: 'unique',
    materials: { dragon_scale: 4, ancient_rune: 5, legend_core: 4 },
    goldCost: 4000,
    unlockBy: { type: 'boss_kill', id: 'the_architect' },
  },
  {
    uniqueId: 'plate_of_creation',
    name: 'Plate of Creation',
    tier: 'unique',
    materials: { dragon_scale: 5, ancient_rune: 4, legend_core: 3 },
    goldCost: 3800,
    unlockBy: { type: 'boss_kill', id: 'the_architect' },
  },
  {
    uniqueId: 'voidreaver_bow',
    name: 'Voidreaver Bow',
    tier: 'unique',
    materials: { dragon_scale: 3, void_essence: 5, legend_core: 2 },
    goldCost: 3000,
    unlockBy: { type: 'lore_node', id: 'dragon_reach_lore_1' },
  },
  {
    uniqueId: 'greatsword_last_king',
    name: 'Greatsword of the Last King',
    tier: 'unique',
    materials: { dragon_scale: 4, wyvern_fang: 5, legend_core: 3 },
    goldCost: 3200,
    unlockBy: { type: 'lore_node', id: 'dragon_reach_lore_2' },
  },
  {
    uniqueId: 'necklace_final_seal',
    name: 'Necklace of the Final Seal',
    tier: 'unique',
    materials: { dragon_scale: 3, ancient_rune: 5, legend_core: 3 },
    goldCost: 3400,
    unlockBy: { type: 'boss_kill', id: 'the_architect' },
  },
  {
    uniqueId: 'dragon_kings_headguard',
    name: "Dragon-King's Headguard",
    tier: 'unique',
    materials: { dragon_scale: 6, wyvern_fang: 4, legend_core: 4 },
    goldCost: 4200,
    unlockBy: { type: 'boss_kill', id: 'dragon_king' },
  },
  {
    uniqueId: 'ancient_dragon_scale',
    name: 'Ancient Dragon Scale',
    tier: 'unique',
    materials: { dragon_scale: 8, ancient_rune: 4, legend_core: 5 },
    goldCost: 5000,
    unlockBy: { type: 'boss_kill', id: 'dragon_king' },
  },
];

// ─── Common gear recipes (white / magic / rare) ───────────────────────────────
// Task 2: ~30 recipes, tiered by rarity.
// white  — unlocks at first town visit
// magic  — unlocks at level 5
// rare   — unlocks at level 10 or act 2+

export const COMMON_RECIPES = [

  // ── WHITE (basic, normal rarity) ────────────────────────────────────────────
  {
    id: 'recipe_white_sword',
    name: 'Iron Sword',
    tier: 'white',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'sword',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 4 },
    goldCost: 30,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_dagger',
    name: 'Iron Dagger',
    tier: 'white',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'dagger',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 3 },
    goldCost: 25,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_helm',
    name: 'Iron Helm',
    tier: 'white',
    slot: 'Helm',
    craftSlot: 'helm',
    base: 'heavy_helm',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 5 },
    goldCost: 35,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_chest',
    name: 'Iron Breastplate',
    tier: 'white',
    slot: 'Chest',
    craftSlot: 'chest',
    base: 'heavy_chest',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 8 },
    goldCost: 50,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_ring',
    name: 'Copper Ring',
    tier: 'white',
    slot: 'Ring',
    craftSlot: 'ring',
    base: 'ring',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 2 },
    goldCost: 20,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_necklace',
    name: 'Rough Amulet',
    tier: 'white',
    slot: 'Necklace',
    craftSlot: 'necklace',
    base: 'necklace',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 2, magic_essence: 1 },
    goldCost: 25,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_shield',
    name: 'Wooden Shield',
    tier: 'white',
    slot: 'Off-hand (Shield)',
    craftSlot: 'offhand_shield',
    base: 'shield',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 4 },
    goldCost: 30,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_boots',
    name: 'Leather Boots',
    tier: 'white',
    slot: 'Feet',
    craftSlot: 'feet',
    base: 'heavy_boots',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 3 },
    goldCost: 25,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_gloves',
    name: 'Padded Gloves',
    tier: 'white',
    slot: 'Hands',
    craftSlot: 'hands',
    base: 'heavy_gauntlets',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 3 },
    goldCost: 25,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_white_wand',
    name: 'Hazel Wand',
    tier: 'white',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'wand',
    rarity: 'normal',
    quality: 'low',
    materials: { iron_scrap: 2, magic_essence: 2 },
    goldCost: 30,
    unlockBy: { type: 'always' },
  },

  // ── MAGIC (blue rarity) ─────────────────────────────────────────────────────
  {
    id: 'recipe_magic_sword',
    name: 'Tempered Blade',
    tier: 'magic',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'sword',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 4, magic_essence: 2 },
    goldCost: 120,
    unlockBy: { type: 'always' }, // level-gated at unlock time
  },
  {
    id: 'recipe_magic_dagger',
    name: 'Silvered Dagger',
    tier: 'magic',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'dagger',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 3, magic_essence: 2 },
    goldCost: 100,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_helm',
    name: 'Enchanted Helm',
    tier: 'magic',
    slot: 'Helm',
    craftSlot: 'helm',
    base: 'heavy_helm',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 4, magic_essence: 3 },
    goldCost: 130,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_chest',
    name: 'Reinforced Chestplate',
    tier: 'magic',
    slot: 'Chest',
    craftSlot: 'chest',
    base: 'heavy_chest',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 6, magic_essence: 4 },
    goldCost: 180,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_ring',
    name: 'Gemmed Ring',
    tier: 'magic',
    slot: 'Ring',
    craftSlot: 'ring',
    base: 'ring',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 2, magic_essence: 3 },
    goldCost: 90,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_staff',
    name: 'Charged Staff',
    tier: 'magic',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'staff',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 3, magic_essence: 4 },
    goldCost: 140,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_bow',
    name: 'Taut Shortbow',
    tier: 'magic',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'shortbow',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 3, magic_essence: 3 },
    goldCost: 120,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_necklace',
    name: 'Warded Amulet',
    tier: 'magic',
    slot: 'Necklace',
    craftSlot: 'necklace',
    base: 'necklace',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 2, magic_essence: 4 },
    goldCost: 110,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_boots',
    name: 'Swift Boots',
    tier: 'magic',
    slot: 'Feet',
    craftSlot: 'feet',
    base: 'heavy_boots',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 3, magic_essence: 3 },
    goldCost: 110,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_magic_shield',
    name: 'Tower Shield',
    tier: 'magic',
    slot: 'Off-hand (Shield)',
    craftSlot: 'offhand_shield',
    base: 'shield',
    rarity: 'magic',
    quality: 'medium',
    materials: { iron_scrap: 5, magic_essence: 3 },
    goldCost: 130,
    unlockBy: { type: 'always' },
  },

  // ── RARE (yellow rarity) ────────────────────────────────────────────────────
  {
    id: 'recipe_rare_sword',
    name: 'Hero-forged Longsword',
    tier: 'rare',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'sword',
    rarity: 'rare',
    quality: 'high',
    materials: { magic_essence: 4, rare_dust: 2 },
    goldCost: 350,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_staff',
    name: "Arcanist's Staff",
    tier: 'rare',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'staff',
    rarity: 'rare',
    quality: 'high',
    materials: { magic_essence: 5, rare_dust: 2 },
    goldCost: 380,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_helm',
    name: 'Warlord Helm',
    tier: 'rare',
    slot: 'Helm',
    craftSlot: 'helm',
    base: 'heavy_helm',
    rarity: 'rare',
    quality: 'high',
    materials: { iron_scrap: 5, magic_essence: 4, rare_dust: 2 },
    goldCost: 420,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_chest',
    name: 'Plate Cuirass',
    tier: 'rare',
    slot: 'Chest',
    craftSlot: 'chest',
    base: 'heavy_chest',
    rarity: 'rare',
    quality: 'high',
    materials: { iron_scrap: 6, magic_essence: 5, rare_dust: 3 },
    goldCost: 500,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_ring',
    name: 'Signet Ring',
    tier: 'rare',
    slot: 'Ring',
    craftSlot: 'ring',
    base: 'ring',
    rarity: 'rare',
    quality: 'high',
    materials: { magic_essence: 3, rare_dust: 3 },
    goldCost: 280,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_bow',
    name: 'Hunter Longbow',
    tier: 'rare',
    slot: 'Weapon',
    craftSlot: 'weapon',
    base: 'shortbow',
    rarity: 'rare',
    quality: 'high',
    materials: { magic_essence: 4, rare_dust: 3 },
    goldCost: 360,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_gloves',
    name: 'Warrior Gauntlets',
    tier: 'rare',
    slot: 'Hands',
    craftSlot: 'hands',
    base: 'heavy_gauntlets',
    rarity: 'rare',
    quality: 'high',
    materials: { iron_scrap: 4, magic_essence: 3, rare_dust: 2 },
    goldCost: 320,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_necklace',
    name: 'Pendant of Power',
    tier: 'rare',
    slot: 'Necklace',
    craftSlot: 'necklace',
    base: 'necklace',
    rarity: 'rare',
    quality: 'high',
    materials: { magic_essence: 4, rare_dust: 3 },
    goldCost: 340,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_boots',
    name: 'Strider Greaves',
    tier: 'rare',
    slot: 'Feet',
    craftSlot: 'feet',
    base: 'heavy_boots',
    rarity: 'rare',
    quality: 'high',
    materials: { iron_scrap: 4, magic_essence: 3, rare_dust: 2 },
    goldCost: 310,
    unlockBy: { type: 'always' },
  },
  {
    id: 'recipe_rare_shield',
    name: 'Bulwark Shield',
    tier: 'rare',
    slot: 'Off-hand (Shield)',
    craftSlot: 'offhand_shield',
    base: 'kite_shield',
    rarity: 'rare',
    quality: 'high',
    materials: { iron_scrap: 6, magic_essence: 4, rare_dust: 2 },
    goldCost: 380,
    unlockBy: { type: 'always' },
  },
];

// ─── Crafting materials (new exotic types) ────────────────────────────────────
// These expand the existing MATERIALS from items.js with act-gated drops.
export const CRAFTING_MATERIALS = {
  ember_shard: {
    id: 'ember_shard',
    name: 'Ember Shard',
    icon: '&#9830;',
    desc: 'Crystallized fire from the border wastes. Act 1 drop.',
    dropActs: [1, 2],
  },
  void_essence: {
    id: 'void_essence',
    name: 'Void Essence',
    icon: '&#9670;',
    desc: 'Distilled from void creatures. Act 3-4 drop.',
    dropActs: [3, 4, 5],
  },
  wyvern_fang: {
    id: 'wyvern_fang',
    name: 'Wyvern Fang',
    icon: '&#9651;',
    desc: 'Shed by wyverns of the hell breach. Act 3+ drop.',
    dropActs: [3, 4, 5],
  },
  titan_stone: {
    id: 'titan_stone',
    name: 'Titan Stone',
    icon: '&#9632;',
    desc: 'Ore from the lava titan\'s domain. Act 2 drop.',
    dropActs: [2, 3],
  },
  shadow_silk: {
    id: 'shadow_silk',
    name: 'Shadow Silk',
    icon: '&#9650;',
    desc: 'Woven from shadow-realm creatures. Act 3 drop.',
    dropActs: [3, 4],
  },
  dragon_scale: {
    id: 'dragon_scale',
    name: 'Dragon Scale',
    icon: '&#9671;',
    desc: 'Scale from a dragon. Act 5+ drop.',
    dropActs: [5, 6],
  },
  ancient_rune: {
    id: 'ancient_rune',
    name: 'Ancient Rune',
    icon: '&#9654;',
    desc: 'Carved rune from the void realm. Act 4+ drop.',
    dropActs: [4, 5, 6],
  },
};

// ─── GameState helpers ────────────────────────────────────────────────────────

/**
 * Compute the default-unlocked recipe set for a given GameState.
 * Called during save migration (craftingRecipesUnlocked missing from save).
 *
 * @param {object} gs — GameState.get() snapshot
 * @returns {string[]} array of recipe ids that should be unlocked
 */
export function computeDefaultUnlocks(gs) {
  const unlocked = [];
  const level = Math.max(...(gs.party || []).map(p => p.level || 1), 1);
  const act = gs.act || 1;

  // All white common recipes always unlock (first-town visit = always).
  for (const r of COMMON_RECIPES) {
    if (r.tier === 'white') unlocked.push(r.id);
  }
  // Magic recipes at level 5+
  if (level >= 5) {
    for (const r of COMMON_RECIPES) {
      if (r.tier === 'magic') unlocked.push(r.id);
    }
  }
  // Rare recipes at level 10+ or act 2+
  if (level >= 10 || act >= 2) {
    for (const r of COMMON_RECIPES) {
      if (r.tier === 'rare') unlocked.push(r.id);
    }
  }
  // Unique recipes for already-completed bosses
  const completed = gs.completedBosses || [];
  for (const r of UNIQUE_RECIPES) {
    if (r.unlockBy.type === 'boss_kill' && completed.includes(r.unlockBy.id)) {
      unlocked.push(r.uniqueId);
    }
  }
  return unlocked;
}

/**
 * Check tier gate: can a recipe be seen/crafted given current gs?
 * Returns true if the recipe's tier is unlocked.
 * The actual per-recipe unlock is checked separately.
 */
export function isTierUnlocked(tier, gs) {
  const level = Math.max(...(gs.party || []).map(p => p.level || 1), 1);
  const act = gs.act || 1;
  if (tier === 'white') return true;
  if (tier === 'magic') return level >= 5;
  if (tier === 'rare') return level >= 10 || act >= 2;
  if (tier === 'unique') return true; // recipe-level gating handles this
  return false;
}

/**
 * Check if a specific recipe is unlocked in gs.craftingRecipesUnlocked.
 * @param {string} recipeId — common recipe id OR unique recipe uniqueId
 * @param {object} gs — GameState.get() snapshot
 */
export function isRecipeUnlocked(recipeId, gs) {
  const set = getCraftingRecipesUnlocked(gs);
  return set.has(recipeId);
}

/**
 * Get or initialize the craftingRecipesUnlocked Set from gs.
 * Side-effect: populates gs.craftingRecipesUnlocked if missing (migration).
 */
export function getCraftingRecipesUnlocked(gs) {
  if (gs.craftingRecipesUnlocked instanceof Set) return gs.craftingRecipesUnlocked;
  // Migration: build from existing game state.
  const ids = computeDefaultUnlocks(gs);
  gs.craftingRecipesUnlocked = new Set(ids);
  return gs.craftingRecipesUnlocked;
}

/**
 * Unlock one or more recipe ids in gs.craftingRecipesUnlocked.
 * @param {string|string[]} ids
 * @param {object} gs
 */
export function unlockRecipes(ids, gs) {
  const set = getCraftingRecipesUnlocked(gs);
  for (const id of (Array.isArray(ids) ? ids : [ids])) {
    set.add(id);
  }
}

/**
 * Called when a boss is killed. Unlock all unique recipes whose unlockBy
 * matches the boss id. Also triggers tier unlocks if applicable.
 * @param {string} bossId — enemy id of the slain boss
 * @param {object} gs — GameState.get() snapshot (mutated in place)
 * @returns {string[]} newly unlocked recipe names (for UI notification)
 */
export function onBossKillUnlockRecipes(bossId, gs) {
  const unlocked = [];
  for (const r of UNIQUE_RECIPES) {
    if (r.unlockBy.type === 'boss_kill' && r.unlockBy.id === bossId) {
      if (!isRecipeUnlocked(r.uniqueId, gs)) {
        unlockRecipes(r.uniqueId, gs);
        unlocked.push(r.name);
      }
    }
  }
  return unlocked;
}

/**
 * Called when a lore node is visited. Unlock any lore-gated recipes.
 * @param {string} loreNodeId
 * @param {object} gs
 * @returns {string[]} newly unlocked recipe names
 */
export function onLoreNodeUnlockRecipes(loreNodeId, gs) {
  const unlocked = [];
  for (const r of UNIQUE_RECIPES) {
    if (r.unlockBy.type === 'lore_node' && r.unlockBy.id === loreNodeId) {
      if (!isRecipeUnlocked(r.uniqueId, gs)) {
        unlockRecipes(r.uniqueId, gs);
        unlocked.push(r.name);
      }
    }
  }
  return unlocked;
}

/**
 * Called when party levels up or act changes — auto-unlock tier-gated
 * common recipes. Returns count of newly unlocked recipes.
 */
export function syncTierUnlocks(gs) {
  let count = 0;
  for (const r of COMMON_RECIPES) {
    if (!isRecipeUnlocked(r.id, gs) && isTierUnlocked(r.tier, gs)) {
      unlockRecipes(r.id, gs);
      count++;
    }
  }
  return count;
}
