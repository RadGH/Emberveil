/**
 * Item system — base types, affixes, procedural generation
 * M6 foundation: all weapon/armor bases, rarity/quality system
 */

import { getBalance as _getBalance } from './balance-loader.js';
import { formatStat, formatPct } from '../utils/numberFormat.js';
import { CLASSES } from './classes.js';
// M429 — direct import for hero-aware weapon scoring. formulas.js does not
// import items.js, so this stays acyclic.
import { computeHeroDamage as _computeHeroDamage } from './formulas.js';
import { getEquipmentAffixBonuses as _itemGetEqAffixes } from './equipBonuses.js';
// canonical-data migration: the 12 pure data consts (RARITIES, QUALITIES,
// RARITY_COLORS, WEAPON_BASES, ARMOR_BASES, AFFIXES_ACT1, SHIELD_AFFIXES,
// ITEM_SETS, ITEM_SCORE_WEIGHTS, MATERIALS, SALVAGE_YIELD, POTIONS) were
// extracted to public/data/items.json (schema public/schemas/v1/items.json)
// and are now loaded via the centralized dataLoader. ALL item LOGIC
// (generateItem, computeItemScores, salvage/craft helpers, tooltips) stays
// here — only the data moved. Derived consts (QUALITY_MULT,
// RARITY_AFFIX_COUNT, ACCESSORY_AFFIX_BONUS from balance-loader;
// CRAFT_RECIPES via flatMap; POTION_STOCK via spread) are computed below and
// were NOT migrated. Byte-parity proven by scripts/verify-items-parity.mjs.
import {
  ITEMS_RARITIES_CANONICAL,
  ITEMS_QUALITIES_CANONICAL,
  ITEMS_RARITY_COLORS_CANONICAL,
  ITEMS_WEAPON_BASES_CANONICAL,
  ITEMS_ARMOR_BASES_CANONICAL,
  ITEMS_AFFIXES_ACT1_CANONICAL,
  ITEMS_SHIELD_AFFIXES_CANONICAL,
  ITEMS_ITEM_SETS_CANONICAL,
  ITEMS_ITEM_SCORE_WEIGHTS_CANONICAL,
  ITEMS_MATERIALS_CANONICAL,
  ITEMS_SALVAGE_YIELD_CANONICAL,
  ITEMS_POTIONS_CANONICAL,
} from './dataLoader.js';

export const RARITIES = ITEMS_RARITIES_CANONICAL;
export const QUALITIES = ITEMS_QUALITIES_CANONICAL;

// Back-compat exports. Runtime consumers should prefer reading via
// _getBalance().loot.* so config swaps take effect immediately.
export const QUALITY_MULT = _getBalance().loot.qualityMult;
// items.js legacy used `0` (scalar) for normal — preserve via a getter-like
// Proxy that returns 0 when `normal` is read as a scalar. To minimize diff,
// derive a back-compat shape: normal→0, others→tuple.
export const RARITY_AFFIX_COUNT = (() => {
  const raw = _getBalance().loot.rarityAffixCount;
  return {
    normal: Array.isArray(raw.normal) ? (raw.normal[0] === 0 ? 0 : raw.normal) : raw.normal,
    magic: raw.magic,
    rare: raw.rare,
    legendary: raw.legendary,
  };
})();
export const ACCESSORY_AFFIX_BONUS = _getBalance().loot.accessoryAffixBonus;

// M296: static fallback map (used only if CSS vars aren't resolved yet).
// Actual colors come from CSS custom properties set by colorPalettes.js.
export const RARITY_COLORS = ITEMS_RARITY_COLORS_CANONICAL;

/**
 * Returns the live rarity color, reading the CSS custom property so
 * colorblind palettes applied to :root propagate without rebuilding HTML.
 * Falls back to the static RARITY_COLORS map if getPropertyValue fails.
 */
export function getRarityColor(rarity) {
  const key = `--rarity-${rarity}`;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
    if (v) return v;
  } catch (_) {}
  return RARITY_COLORS[rarity] || '#c8c8c8';
}

// Weapon base types
// M95: weaponCategory — 'heavy' (STR), 'light' (DEX), 'magic' (INT).
// Magic weapons additionally contribute a spell-power affix to basic attacks
// (see CombatScreen basic-attack path and FormulaCodex).
export const WEAPON_BASES = ITEMS_WEAPON_BASES_CANONICAL;

/**
 * M95: Determine the weapon category for a character's equipped weapon.
 * Falls back to 'heavy' (STR) if nothing equipped — preserves pre-M95 default.
 * Also covers generated items that lack weaponCategory (older saves) by
 * mapping from subtype.
 */
export function getEquippedWeaponCategory(equipment) {
  const w = equipment?.weapon;
  if (!w) return 'heavy';
  if (w.weaponCategory) return w.weaponCategory;
  const base = WEAPON_BASES[w.baseKey];
  if (base?.weaponCategory) return base.weaponCategory;
  // Legacy fallback by subtype
  const sub = w.subtype || base?.subtype || '';
  if (['wand','staff','orb','tome','scepter'].includes(sub)) return 'magic';
  if (['dagger','bow','crossbow','javelin','spear'].includes(sub)) return 'light';
  return 'heavy';
}

// Armor base types
export const ARMOR_BASES = ITEMS_ARMOR_BASES_CANONICAL;

// Affix pool — Act 1
export const AFFIXES_ACT1 = ITEMS_AFFIXES_ACT1_CANONICAL;

// M84/M276: Shield-only and shield/chest/legs-restricted affixes. Previously
// these were auto-applied at 100% to every shield (even white). M276 reworked:
// Bulwark and Bracing are now regular rollable affixes restricted to shields,
// magic-tier+. Spellguard rolls on shields, chest (medium/heavy), or legs
// (medium/heavy), never on weapons. They are merged into the rollable pool by
// generateItem() with the same item-type restriction filter as other affixes.
export const SHIELD_AFFIXES = ITEMS_SHIELD_AFFIXES_CANONICAL;

/**
 * Item Sets — named sets that grant bonuses when multiple pieces are equipped.
 * setId matches on items generated with that set tag.
 */
export const ITEM_SETS = ITEMS_ITEM_SETS_CANONICAL;

/**
 * Check which set bonuses are active for a character's equipment.
 * Returns array of { setId, piecesEquipped, bonuses }
 */
export function getActiveSetBonuses(equipment) {
  const results = [];
  const equippedKeys = Object.values(equipment || {}).map(i => i?.setId).filter(Boolean);
  for (const [setId, setDef] of Object.entries(ITEM_SETS)) {
    const equipped = setDef.pieces.filter(p => equippedKeys.includes(p)).length;
    if (equipped >= 2) {
      const activeBonuses = [];
      for (const [threshold, bonus] of Object.entries(setDef.bonuses)) {
        if (equipped >= parseInt(threshold)) activeBonuses.push(bonus);
      }
      results.push({ setId, name: setDef.name, piecesEquipped: equipped, total: setDef.pieces.length, activeBonuses });
    }
  }
  return results;
}

/**
 * Generate a procedural item
 * @param {string} baseKey - key from WEAPON_BASES or ARMOR_BASES
 * @param {string} rarity - 'normal'|'magic'|'rare'|'legendary'
 * @param {string} quality - 'low'|'medium'|'high'|'elite'|'exotic'
 * @param {object} affixPool - which act's affixes to pull from
 */
// M399 — NG+ rarity bump. One scalar in the loot generator: each NG+ tier
// upgrades the rolled item one rarity step (normal → magic → rare → legendary
// → unique → unique). gameState.js publishes its ngPlus into _ngPlusForLoot
// via setLootNgPlus() to avoid the circular import (items↔gameState).
const _RARITY_LADDER = ['normal', 'magic', 'rare', 'legendary', 'unique'];
let _ngPlusForLoot = 0;
export function setLootNgPlus(ng) { _ngPlusForLoot = Math.max(0, ng | 0); }
function _bumpRarityForNgPlus(rarity) {
  if (!_ngPlusForLoot) return rarity;
  const idx = _RARITY_LADDER.indexOf(rarity);
  if (idx < 0) return rarity;
  return _RARITY_LADDER[Math.min(_RARITY_LADDER.length - 1, idx + _ngPlusForLoot)];
}

export function generateItem(baseKey, rarity = 'normal', quality = 'medium', affixPool = AFFIXES_ACT1) {
  // M399 — apply NG+ rarity bump before the base lookup so the resulting
  // affix budget + name suffix all flow from the upgraded tier.
  rarity = _bumpRarityForNgPlus(rarity);
  const base = WEAPON_BASES[baseKey] || ARMOR_BASES[baseKey];
  if (!base) return null;

  const qMult = QUALITY_MULT[quality];
  const item = {
    id: crypto.randomUUID(),
    baseKey,
    name: base.name,
    type: base.type,
    subtype: base.subtype || base.slot,
    slot: base.slot || 'weapon',
    weaponCategory: base.weaponCategory || null,
    twoHanded: !!base.twoHanded,
    offHandOk: !!base.offHandOk,
    isShield: !!base.isShield,
    isMagicShield: !!base.isMagicShield,
    rarity,
    quality,
    affixes: [],
  };

  // Scale base stats
  if (base.dmg) {
    item.dmg = [Math.round(base.dmg[0] * qMult), Math.round(base.dmg[1] * qMult)];
  }
  if (base.armor !== undefined) {
    item.armor = Math.round(base.armor * qMult);
  }

  // Roll affixes
  const rarityCount = RARITY_AFFIX_COUNT[rarity];
  const isAccessory = base.type === 'accessory';
  if (rarityCount || isAccessory) {
    const raw = rarityCount ?? 0;
    let [min, max] = Array.isArray(raw) ? raw : [raw, raw];
    if (isAccessory) { min += ACCESSORY_AFFIX_BONUS; max += ACCESSORY_AFFIX_BONUS; }
    const count = min + Math.floor(Math.random() * (max - min + 1));
    // M116: filter affix pool by weapon/slot rules — Sharp/Crit roll on
    // physical weapons + gloves + amulets; Potency rolls on magic weapons +
    // amulets. Armor pieces ignore magicOnly/physicalOnly restrictions.
    const isWeapon = base.type === 'weapon';
    const isMagicWpn = isWeapon && base.weaponCategory === 'magic';
    const isPhysWpn = isWeapon && base.weaponCategory !== 'magic';
    const isNecklace = base.type === 'accessory' && (base.slot === 'necklace' || base.subtype === 'amulet');
    const isGloves = base.slot === 'hands' || base.subtype === 'gloves';
    const isShield = !!base.isShield;
    const isMagicShield = !!base.isMagicShield;
    // M276: rarity is magic / rare / legendary (anything above 'normal').
    const isMagicPlus = rarity !== 'normal';
    const filt = (a) => {
      if (a.magicOnly && !(isMagicWpn || isNecklace)) return false;
      if (a.physicalOnly && !(isPhysWpn)) return false;
      // M276 shield/armor restriction filters.
      if (a.shieldOnly && !isShield) return false;
      if (a.magicShieldOnly && !isMagicShield) return false;
      if (a.magicPlus && !isMagicPlus) return false;
      if (a.slots && !a.slots.includes(base.slot)) return false;
      if (a.armorTiers && !a.armorTiers.includes(base.tier)) return false;
      // Crit affixes: allow on weapons, gloves, amulets only.
      if ((a.id === 'crit_chance' || a.id === 'crit_damage') && !(isWeapon || isNecklace || isGloves)) return false;
      return true;
    };
    // M276: SHIELD_AFFIXES (Bulwark/Bracing/Spellguard) join the rollable pool
    // for any item that satisfies their slot/tier/rarity restrictions. They
    // are no longer auto-applied to white shields.
    const pool = [
      ...affixPool.prefixes.filter(filt),
      ...affixPool.suffixes.filter(filt),
      ...SHIELD_AFFIXES.filter(filt),
    ];
    const picked = [];
    for (let i = 0; i < count && pool.length > picked.length; i++) {
      let affix;
      let attempts = 0;
      do {
        affix = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
      } while (picked.find(a => a.id === affix.id) && attempts < 20);
      if (!picked.find(a => a.id === affix.id)) {
        const value = +(affix.min + Math.random() * (affix.max - affix.min)).toFixed(2);
        picked.push({ ...affix, value });
      }
    }
    item.affixes = picked;

    // Build display name from affixes
    const prefix = picked.find(a => affixPool.prefixes.find(p => p.id === a.id));
    const suffix = picked.find(a => affixPool.suffixes.find(s => s.id === a.id));
    if (prefix) item.name = `${prefix.name} ${item.name}`;
    if (suffix) item.name = `${item.name} ${suffix.name}`;
  }

  // M276: shield bases supply baseline blockChance / blockPower as INTRINSIC
  // white stats. They live in item.affixes with baseIntrinsic:true so the
  // existing getCharacterBlockStats() formula keeps working unchanged, but
  // item display (getItemTooltip + InventoryScreen) renders them as white
  // base stats under "Armor" instead of in the green affix list.
  // Bulwark / Bracing / Spellguard are no longer auto-applied here — they
  // are regular rollable affixes (see SHIELD_AFFIXES + filt() above).
  if (base.isShield) {
    if (base.blockChance && base.blockChance > 0) {
      item.affixes.push({ id:'base_block_chance', name:'Base Block', stat:'block_chance', value: +(base.blockChance).toFixed(2), baseIntrinsic: true });
    }
    if (base.blockPower && base.blockPower > 0) {
      item.affixes.push({ id:'base_block_power', name:'Base Block Power', stat:'block_power', value: Math.round(base.blockPower * qMult), baseIntrinsic: true });
    }
  }

  // M340 — magic shields supply native Barrier and Barrier Regen as
  // intrinsic white stats so every base, even normal-rarity drops, gives
  // the player something. Bulwark/Bracing roll on top via the magic-shield-
  // only affixes (Wardstone / Conduit).
  if (base.isMagicShield) {
    if (base.barrier && base.barrier > 0) {
      item.affixes.push({ id:'base_barrier', name:'Barrier', stat:'barrier', value: Math.round(base.barrier * qMult), baseIntrinsic: true });
    }
    if (base.barrierRegen && base.barrierRegen > 0) {
      item.affixes.push({ id:'base_barrier_regen', name:'Barrier Regen', stat:'barrierRegen', value: Math.round(base.barrierRegen * qMult), baseIntrinsic: true });
    }
  }

  // M132: caster off-hands (orb, tome) and amulet/necklace accessories grant
  // a baked-in spellPower affix, mirroring how shields guarantee block.
  // Value stored as 0..1 fraction (combat multiplies int scaling).
  const isCasterOffhand = base.type === 'weapon' && (base.subtype === 'orb' || base.subtype === 'tome');
  const isCasterAccessory = base.type === 'accessory' && (base.slot === 'necklace' || base.subtype === 'amulet');
  if (isCasterOffhand || isCasterAccessory) {
    const base01 = isCasterOffhand ? 0.15 : 0.08;
    const value = +(base01 * qMult).toFixed(2);
    item.affixes.push({ id:'base_spell_power', name:'Base Spell Power', stat:'spellPower', value, baseIntrinsic: true });
  }

  return item;
}

/**
 * Get a tooltip description for an item.
 *
 * If `hero` is provided and the item is a weapon, the tooltip renders:
 *   - Type: STR / DEX / INT (from weaponCategory)
 *   - Base Damage: the raw item.dmg range
 *   - Total Damage: display-only calc matching computeHeroDamage() with the
 *     hero's current stats + equip affix bonuses. If Base == Total, collapse
 *     to a single "Damage" line.
 *
 * Caller (InventoryScreen) passes the selected character; other callers may
 * omit `hero` — the tooltip degrades gracefully to the plain "Damage: X-Y"
 * line as before.
 */
export function getItemTooltip(item, hero = null) {
  if (!item) return '';
  const qLabel = quality => quality.charAt(0).toUpperCase() + quality.slice(1);
  const rLabel = rarity => rarity.charAt(0).toUpperCase() + rarity.slice(1);
  let lines = [
    `<strong>${item.name}</strong>`,
    `<span class="tt-rarity" style="color:${getRarityColor(item.rarity)}">${rLabel(item.rarity)} · ${qLabel(item.quality)}</span>`,
  ];
  if (item.dmg) {
    const cat = item.weaponCategory || null;
    const typeLabel = cat === 'light' ? 'DEX' : cat === 'magic' ? 'INT' : cat === 'heavy' ? 'STR' : null;
    if (typeLabel) lines.push(`Type: ${typeLabel}`);
    // Attempt a display-only Total Damage preview when a hero is provided.
    // Lazy-require to avoid a circular import at module load.
    let total = null;
    if (hero && cat) {
      try {
        // eslint-disable-next-line global-require
        const mod = _formulasForTooltip();
        if (mod && mod.computeHeroDamage && mod.getEquipmentAffixBonuses) {
          const ab = mod.getEquipmentAffixBonuses(hero);
          const eqp = hero.equipment || {};
          // If this item is currently equipped as the main weapon use live calc;
          // otherwise preview as if this item were the weapon.
          const weaponEquipped = eqp.weapon && eqp.weapon.id === item.id;
          // Equip-dmg bonus comes from item.dmg * 0.3 for weapons in eqp.
          // Preview case: swap weapon in a shallow copy to compute hypothetical.
          const prevEqp = weaponEquipped ? eqp : { ...eqp, weapon: item };
          let eqpDmgBonus = 0;
          for (const it of Object.values(prevEqp)) {
            if (it?.dmg) eqpDmgBonus += Math.floor((it.dmg[0] + it.dmg[1]) / 2 * 0.3);
          }
          eqpDmgBonus += (ab.dmg || 0);
          const stats = {
            STR: (hero.attrs?.STR || 8) + (ab.str || 0),
            DEX: (hero.attrs?.DEX || 8) + (ab.dex || 0),
            INT: (hero.attrs?.INT || 8) + (ab.int || 0),
            CON: (hero.attrs?.CON || 8) + (ab.con || 0),
          };
          total = mod.computeHeroDamage(stats, eqpDmgBonus, cat);
        }
      } catch (_) { /* ignore — fall back to single Damage line */ }
    }
    if (total && (total[0] !== item.dmg[0] || total[1] !== item.dmg[1])) {
      lines.push(`<span class="tt-affix">Base Damage: ${item.dmg[0]}–${item.dmg[1]}</span>`);
      lines.push(`<span class="tt-affix" style="color:#d0c080">Total Damage: ${total[0]}–${total[1]}</span>`);
    } else {
      lines.push(`<span class="tt-affix">Damage: ${item.dmg[0]}–${item.dmg[1]}</span>`);
    }
    // M422 — surface attack-speed tier as strikes per round so weapons like
    // the Rapier (fast = 2 strikes) read clearly on the tooltip.
    const asTier = item.attackSpeed || (item.baseKey && WEAPON_BASES[item.baseKey]?.attackSpeed) || 'normal';
    if (asTier === 'fast' || asTier === 'very_fast') {
      const strikes = asTier === 'very_fast' ? 3 : 2;
      const label = asTier === 'very_fast' ? 'Very Fast' : 'Fast';
      lines.push(`<span class="tt-affix" style="color:#80c0ff">Attack Speed: ${label} · ${strikes} strikes/round</span>`);
    }
  }
  if (item.armor) lines.push(`<span class="tt-affix">Armor: +${item.armor}</span>`);
  // M276: render shield base block stats (baseIntrinsic) as WHITE lines under
  // Armor — they're intrinsic to the shield base, not affixes.
  const baseBlockChance = (item.affixes || []).find(a => a.baseIntrinsic && a.stat === 'block_chance');
  const baseBlockPower  = (item.affixes || []).find(a => a.baseIntrinsic && a.stat === 'block_power');
  if (baseBlockChance) {
    lines.push(`<span class="tt-affix">Block: ${formatPct(baseBlockChance.value)}</span>`);
  }
  if (baseBlockPower) {
    lines.push(`<span class="tt-affix">Block Power: +${formatStat(baseBlockPower.value, 'int')}</span>`);
  }
  for (const affix of item.affixes || []) {
    // M276: skip baseIntrinsic entries — they're already rendered above as
    // white base stats. Includes shield base block_chance/block_power and
    // caster off-hand base spell power (kept in green list per existing UX).
    if (affix.baseIntrinsic && (affix.stat === 'block_chance' || affix.stat === 'block_power')) continue;
    // M305: legendary_effect affix — render in a special "Legendary" section below.
    if (affix.stat === 'cond_legendaryEffect') continue;
    const val = typeof affix.value === 'number' && affix.value < 1
      ? formatPct(affix.value)
      : `+${formatStat(affix.value, 'auto')}`;
    // M116: prefer affix.descriptor (e.g. "MELEE", "SPELL", "CRIT") so the
    // tooltip reads "of Potency: +2.1 SPELL" instead of "SPELLPOWER".
    const tag = affix.descriptor || affix.stat.toUpperCase();
    lines.push(`<span class="tt-affix" style="color:#90d8a8">${affix.name}: ${val} ${tag}</span>`);
  }

  // M305: Set membership line — shown when item has a setId.
  if (item.setId) {
    try {
      const setInfo = globalThis.__rsgSetInfo?.(item.setId, hero?.equipment);
      if (setInfo) {
        const { name, piecesEquipped, total, activeBonuses } = setInfo;
        const isActive = piecesEquipped >= 2;
        const setColor = isActive ? '#b060ff' : '#7a4a8a';
        lines.push(`<hr style="border-color:rgba(176,96,255,0.3);margin:3px 0">`);
        lines.push(`<span style="color:${setColor};font-weight:700">${name} (${piecesEquipped}/${total} equipped)</span>`);
        for (const bonus of activeBonuses || []) {
          lines.push(`<span style="color:${setColor};font-size:0.9em">+ ${bonus.desc || ''}</span>`);
        }
      } else if (item.setId) {
        lines.push(`<hr style="border-color:rgba(176,96,255,0.3);margin:3px 0">`);
        lines.push(`<span style="color:#7a4a8a">Set Item</span>`);
      }
    } catch (_) {}
  }

  // M305: Unique item — show legendary effect text.
  if (item.isUnique) {
    const legendaryAffix = (item.affixes || []).find(a => a.stat === 'cond_legendaryEffect');
    const desc = legendaryAffix?.descriptor || item.legendaryDesc || '';
    lines.push(`<hr style="border-color:rgba(255,160,32,0.3);margin:3px 0">`);
    lines.push(`<span style="color:#ff8020;font-weight:700">Legendary</span>`);
    if (desc) lines.push(`<span style="color:#e0a060;font-size:0.88em">${desc}</span>`);
    if (item.lore) lines.push(`<span style="color:#8a7060;font-style:italic;font-size:0.82em">"${item.lore}"</span>`);
  }

  // M429 — Surface the underlying Offense / Defense rating that drives
  // recommended-weapon / auto-equip decisions. The user couldn't see why
  // a wand was being picked over a hammer; this exposes the math.
  // Equippable types only (weapon/armor/accessory). Hero-aware when supplied
  // so the rating reflects the wielder.
  if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
    try {
      const sc = computeItemScores(item, hero);
      const parts = [];
      if (sc.offense > 0) parts.push(`<span style="color:#e88060">Offense ${sc.offense}</span>`);
      if (sc.defense > 0) parts.push(`<span style="color:#80c0e0">Defense ${sc.defense}</span>`);
      if (sc.utility > 0) parts.push(`<span style="color:#a0c890">Utility ${sc.utility}</span>`);
      if (parts.length) {
        lines.push(`<hr style="border-color:rgba(180,180,200,0.18);margin:3px 0">`);
        lines.push(`<span class="tt-rating" style="font-size:0.88em">${parts.join(' · ')} <span style="color:#a0a0a0">(Total ${sc.total})</span></span>`);
      }
    } catch (_) {}
  }

  return lines.join('<br>');
}

// Lazy formulas import to avoid a circular dependency (formulas.js imports
// from equipBonuses.js; items.js stays decoupled from formulas for tree-shake).
let _cachedFormulas = null;
function _formulasForTooltip() {
  if (_cachedFormulas !== null) return _cachedFormulas;
  try {
    // dynamic import fallback — synchronous require is unavailable in ESM,
    // so we rely on the module being already loaded by the app entry point.
    // Use a global hook set by formulas.js on first import.
    if (typeof globalThis !== 'undefined' && globalThis.__rsgFormulas) {
      _cachedFormulas = globalThis.__rsgFormulas;
    } else {
      _cachedFormulas = false;
    }
  } catch (_) { _cachedFormulas = false; }
  return _cachedFormulas || null;
}

// ─── Item Scoring (Diablo-3 style) — U7 ────────────────────────────────────
// Each affix/intrinsic contributes to one of three buckets: offense, defense,
// utility. Weights are tuned so that a single "high-quality" affix
// contributes roughly 20–60 points, and a fully-decked rare/legendary item
// totals in the few-hundreds. Pinned by item_scores.test.js — touching
// these weights is an explicit decision, not an accident.
//
// Storage conventions:
//   - critChance, critDamage, blockChance, goldFind, xpFind, tradePrices,
//     spellPower → 0..1 fractions. Multiply by 100 to get "percentage points".
//   - lifeSteal, manaSteal → already stored as integer percent (e.g. 5 = 5%).
//   - dmg, armor, hp, mp, str/dex/int/con, hit, dodge, initiative, blockPower,
//     thorns, hpRegen, manaRegen, armorPen → flat point values.
export const ITEM_SCORE_WEIGHTS = ITEMS_ITEM_SCORE_WEIGHTS_CANONICAL;

/**
 * Map an affix's `stat` field to a canonical score key. Returns null if
 * the affix has no scoring contribution. Case-insensitive on common names.
 */
function _affixScoreKey(stat) {
  if (!stat) return null;
  const k = String(stat);
  // Direct hits first (most common)
  if (ITEM_SCORE_WEIGHTS[k]) return k;
  // Aliases / case-insensitive normalizations
  const map = {
    block_chance: 'blockChance',
    block_power:  'blockPower',
    mana_regen:   'manaRegen',
    hp_regen:     'hpRegen',
    life_steal:   'lifeSteal',
    mana_steal:   'manaSteal',
    armor_pen:    'armorPen',
    armor_penetration: 'armorPen',
    magic_resist: 'magicResist',
    magic_find:   'magicFind',
    gold_find:    'goldFind',
    xp_find:      'xpFind',
    crit_chance:  'critChance',
    crit_damage:  'critDamage',
    spell_power:  'spellPower',
    attack_power: 'attackPower',
    cooldown_reduction: 'cooldownReduction',
    damage_reduction:   'damageReduction',
    STR: 'str', DEX: 'dex', INT: 'int', CON: 'con',
    HP: 'hp', MP: 'mp',
  };
  if (map[k]) return map[k];
  // Lowercase fallback
  const lk = k.toLowerCase();
  if (ITEM_SCORE_WEIGHTS[lk]) return lk;
  return null;
}

/**
 * M279 — when a hero is supplied, weapon offense is multiplied by a stat-
 * alignment factor so a Wizard isn't recommended a higher-base-damage sword
 * over a lower-base-damage staff that scales with their INT. Returns 1.0 for
 * non-weapons, missing hero, or unknown scaling.
 */
function _weaponScalingMultiplier(item, hero) {
  if (!hero || !item || item.type !== 'weapon') return 1.0;
  const scaling = (item.statScaling || '').toLowerCase();
  if (!scaling) return 1.0;
  // Class primaryAttr lookup (CHA never primary; classes file uses STR/DEX/INT/CON).
  let primary = (hero.primaryAttr || hero.primaryStat || '').toUpperCase();
  if (!primary) {
    const clsId = hero.class || hero.classDefault || hero.classId;
    if (clsId) {
      const def = CLASSES.find(c => c.id === clsId);
      if (def && def.primaryAttr) primary = def.primaryAttr.toUpperCase();
    }
  }
  if (!primary) return 1.0;
  const tokens = scaling.split('_'); // 'str_dex' → ['str','dex']
  const matchExact = tokens.length === 1 && tokens[0] === primary.toLowerCase();
  const matchAny   = tokens.includes(primary.toLowerCase());
  // Also weight by the per-stat multipliers if present (intMult/strMult/dexMult).
  const multBoost = (
    (primary === 'INT' && (item.intMult || 0)) ||
    (primary === 'STR' && (item.strMult || 0)) ||
    (primary === 'DEX' && (item.dexMult || 0)) ||
    0
  );
  if (matchExact)  return 1.50 + multBoost * 0.20; // dedicated weapon for our stat
  if (matchAny)    return 1.15 + multBoost * 0.10; // hybrid scaling that includes us
  return 0.55; // misaligned: caster picking up a sword scores low
}

/**
 * M429 — Compute the total weapon damage range a hero would deal with this
 * weapon equipped, mirroring computeHeroDamage(). Returns null when formulas
 * aren't available (early-load) so the legacy midpoint-based path takes over.
 *
 * Lazy-loads via the `globalThis.__rsgFormulas` hook installed by
 * formulas.js — same pattern as the tooltip preview path. Avoids a hard
 * import to keep items.js's dependency graph linear.
 */
function _heroTotalDamageRange(item, hero) {
  if (!item || !hero) return null;
  if (typeof _computeHeroDamage !== 'function') return null;
  let ab;
  try { ab = _itemGetEqAffixes(hero) || {}; }
  catch (_) { ab = { dmg: 0, str: 0, dex: 0, int: 0, con: 0 }; }
  // Equipment damage bonus: this weapon (always counted) + remaining slots
  // (so a Runesmith wearing +STR gloves sees that boost when previewing
  // a hammer). Weapon midpoint × 0.3 mirrors computeHeroEquipDmgBonus().
  let eqpDmgBonus = Math.floor(((item.dmg?.[0] || 0) + (item.dmg?.[1] || 0)) / 2 * 0.3);
  const eqp = hero.equipment || {};
  for (const [slot, it] of Object.entries(eqp)) {
    if (slot === 'weapon') continue; // replaced by `item`
    if (it?.dmg) eqpDmgBonus += Math.floor((it.dmg[0] + it.dmg[1]) / 2 * 0.3);
  }
  eqpDmgBonus += (ab.dmg || 0);
  const stats = {
    STR: (hero.attrs?.STR || 8) + (ab.str || 0),
    DEX: (hero.attrs?.DEX || 8) + (ab.dex || 0),
    INT: (hero.attrs?.INT || 8) + (ab.int || 0),
    CON: (hero.attrs?.CON || 8) + (ab.con || 0),
  };
  return _computeHeroDamage(stats, eqpDmgBonus, item.weaponCategory);
}

/**
 * Compute Offense / Defense / Utility scores for an item.
 * Includes intrinsic base stats (weapon damage midpoint, base armor, base
 * block) and every affix that has a known scoring weight.
 *
 * @param {object} item — item produced by generateItem()
 * @param {object} [hero] — optional hero/member; when supplied, weapon
 *                          damage is weighted by stat alignment so casters
 *                          aren't recommended swords over their staves (M279).
 * @returns {{offense:number, defense:number, utility:number, total:number}}
 */
export function computeItemScores(item, hero = null) {
  if (!item) return { offense: 0, defense: 0, utility: 0, total: 0 };
  let offense = 0, defense = 0, utility = 0;

  // M429 — When a hero is supplied for a weapon, score offense from the
  // *total* damage range the wielder would output (computeHeroDamage), not
  // the raw weapon midpoint with a stat-alignment kludge. This fixes the
  // failure mode where a Runesmith (STR=37) was recommended a wand because
  // a wand's spellPower affixes inflated its score even though the wielder
  // can't drive INT-scaled damage. The no-hero path keeps the legacy
  // midpoint × 5 contract that item_scores tests pin.
  let usedHeroDamage = false;
  if (hero && item.type === 'weapon' && item.weaponCategory && Array.isArray(item.dmg)) {
    const total = _heroTotalDamageRange(item, hero);
    if (total) {
      const mid = (total[0] + total[1]) / 2;
      offense += mid * ITEM_SCORE_WEIGHTS.dmg.weight;
      usedHeroDamage = true;
    }
  }

  if (!usedHeroDamage) {
    const wpnMult = _weaponScalingMultiplier(item, hero);
    // Intrinsic: weapon damage midpoint × dmg-weight (5) × stat-alignment
    if (Array.isArray(item.dmg) && item.dmg.length === 2) {
      const mid = (item.dmg[0] + item.dmg[1]) / 2;
      offense += mid * ITEM_SCORE_WEIGHTS.dmg.weight * wpnMult;
    }
  }
  // Intrinsic: base armor × armor-weight (1)
  if (typeof item.armor === 'number' && item.armor > 0) {
    defense += item.armor * ITEM_SCORE_WEIGHTS.armor.weight;
  }
  // Note: base shield blockChance/blockPower are appended to item.affixes
  // as synthetic baseIntrinsic affixes by generateItem(), so they flow
  // through the affix loop below — no separate handling needed.

  // M429 — when the wielder's primary attribute is misaligned with the
  // weapon's scaling, dampen the weapon's *offense* affixes too. A wand's
  // +spellPower is worthless to a STR melee character; the affix would
  // otherwise inflate the score and override the intrinsic-damage gap.
  // Defense / utility affixes (HP, dodge, +STR) still apply at full weight
  // because they help any wielder.
  const offenseAffixMult = (hero && item.type === 'weapon')
    ? _weaponScalingMultiplier(item, hero)
    : 1.0;

  for (const affix of item.affixes || []) {
    const key = _affixScoreKey(affix.stat);
    if (!key) continue;
    const def = ITEM_SCORE_WEIGHTS[key];
    if (!def) continue;
    // Convert fractional (0..1) percent stats to "percentage points" before
    // applying the weight. Integer-percent stats (lifeSteal etc.) keep raw.
    const v = typeof affix.value === 'number' ? affix.value : 0;
    const scaled = def.asPct ? v * 100 : v;
    let contribution = scaled * def.weight;
    if (def.axis === 'offense') offense += contribution * offenseAffixMult;
    else if (def.axis === 'defense') defense += contribution;
    else utility += contribution;
  }

  offense = Math.round(offense);
  defense = Math.round(defense);
  utility = Math.round(utility);
  return { offense, defense, utility, total: offense + defense + utility };
}

/**
 * Compare-mode tooltip — renders the item's affixes split into Same / Gained /
 * Lost groups against `vsItem`. If `vsItem` is null, falls back to the
 * regular tooltip with a "Compare: nothing equipped" hint.
 *
 * @param {object} item     — the inventory item being inspected
 * @param {object} vsItem   — the equipped item we're comparing against
 * @param {object} options  — { hero, slotLabel, secondaryHint }
 */
export function getItemCompareTooltip(item, vsItem, options = {}) {
  if (!item) return '';
  const { hero = null, slotLabel = null, secondaryHint = null } = options;
  const qLabel = q => q.charAt(0).toUpperCase() + q.slice(1);
  const rLabel = r => r.charAt(0).toUpperCase() + r.slice(1);

  if (!vsItem) {
    // Nothing equipped in the target slot → just show the regular tooltip
    // with a header noting that this is an upgrade-into-empty.
    const head = `<strong>${item.name}</strong><br>` +
      `<span class="tt-rarity" style="color:${getRarityColor(item.rarity)}">${rLabel(item.rarity)} · ${qLabel(item.quality)}</span><br>` +
      `<span class="tt-affix" style="color:#60d080">Slot ${slotLabel || ''} is empty — direct upgrade.</span>`;
    return head + '<br>' + getItemTooltip(item, hero);
  }

  // Build affix dictionaries by canonical score key. Affixes that lack a
  // score key fall back to using `affix.id || affix.stat` as a key so they
  // still flow through compare (e.g. unique flags).
  const keyOf = (a) => _affixScoreKey(a.stat) || a.id || a.stat || a.name;
  const byKey = (arr) => {
    const m = new Map();
    for (const a of arr || []) m.set(keyOf(a), a);
    return m;
  };
  const A = byKey(item.affixes);
  const B = byKey(vsItem.affixes);

  const renderAffix = (a, suffix = '') => {
    const v = typeof a.value === 'number' && a.value < 1 && a.value > -1
      ? formatPct(a.value)
      : `+${formatStat(a.value, 'auto')}`;
    const tag = a.descriptor || (a.stat || '').toUpperCase();
    return `<span class="tt-affix">${a.name}: ${v} ${tag}${suffix}</span>`;
  };

  const same = [], gained = [], lost = [];
  const allKeys = new Set([...A.keys(), ...B.keys()]);
  for (const k of allKeys) {
    const a = A.get(k);
    const b = B.get(k);
    if (a && b) {
      if (a.value === b.value) {
        same.push(`<span class="tt-affix" style="color:#a0a0a0">= ${a.name}: ${typeof a.value === 'number' && a.value < 1 ? `${Math.round(a.value*100)}%` : `+${a.value}`}</span>`);
      } else if ((a.value || 0) > (b.value || 0)) {
        gained.push(`<span class="tt-affix" style="color:#60d080">+ ${a.name}: ${typeof a.value === 'number' && a.value < 1 ? `${Math.round(a.value*100)}%` : `+${a.value}`} <small style="color:#8a7a6a">(was ${typeof b.value === 'number' && b.value < 1 ? `${Math.round(b.value*100)}%` : `+${b.value}`})</small></span>`);
      } else {
        lost.push(`<span class="tt-affix" style="color:#d06060">− ${a.name}: ${typeof a.value === 'number' && a.value < 1 ? `${Math.round(a.value*100)}%` : `+${a.value}`} <small style="color:#8a7a6a">(was ${typeof b.value === 'number' && b.value < 1 ? `${Math.round(b.value*100)}%` : `+${b.value}`})</small></span>`);
      }
    } else if (a && !b) {
      gained.push(`<span class="tt-affix" style="color:#60d080">+ ${renderAffix(a)}</span>`);
    } else if (!a && b) {
      lost.push(`<span class="tt-affix" style="color:#d06060">− ${renderAffix(b)}</span>`);
    }
  }

  // Compare base intrinsics (damage midpoint, armor) as synthetic rows when
  // they differ. This makes weapon-vs-weapon / armor-vs-armor compares useful
  // even without affixes.
  if (Array.isArray(item.dmg) || Array.isArray(vsItem.dmg)) {
    const am = Array.isArray(item.dmg) ? (item.dmg[0] + item.dmg[1]) / 2 : 0;
    const bm = Array.isArray(vsItem.dmg) ? (vsItem.dmg[0] + vsItem.dmg[1]) / 2 : 0;
    if (am !== bm) {
      const cls = am > bm ? '#60d080' : '#d06060';
      const sign = am > bm ? '+' : '−';
      (am > bm ? gained : lost).push(`<span class="tt-affix" style="color:${cls}">${sign} Base Damage: ${item.dmg ? `${item.dmg[0]}–${item.dmg[1]}` : '—'} <small style="color:#8a7a6a">(was ${vsItem.dmg ? `${vsItem.dmg[0]}–${vsItem.dmg[1]}` : '—'})</small></span>`);
    } else if (am > 0) {
      same.push(`<span class="tt-affix" style="color:#a0a0a0">= Base Damage: ${item.dmg[0]}–${item.dmg[1]}</span>`);
    }
  }
  // M422 — compare attack-speed tiers so swapping weapons surfaces a strike
  // count change.
  const tierMap = { normal: 1, fast: 2, very_fast: 3 };
  const tierLabel = { normal: 'Normal', fast: 'Fast', very_fast: 'Very Fast' };
  const aTier = item.attackSpeed || (item.baseKey && WEAPON_BASES[item.baseKey]?.attackSpeed) || (item.dmg ? 'normal' : null);
  const bTier = vsItem.attackSpeed || (vsItem.baseKey && WEAPON_BASES[vsItem.baseKey]?.attackSpeed) || (vsItem.dmg ? 'normal' : null);
  if (aTier && bTier) {
    const aS = tierMap[aTier] || 1, bS = tierMap[bTier] || 1;
    if (aS !== bS) {
      const cls = aS > bS ? '#60d080' : '#d06060';
      const sign = aS > bS ? '+' : '−';
      (aS > bS ? gained : lost).push(`<span class="tt-affix" style="color:${cls}">${sign} Attack Speed: ${tierLabel[aTier]} · ${aS} strikes <small style="color:#8a7a6a">(was ${tierLabel[bTier]} · ${bS})</small></span>`);
    } else if (aS > 1) {
      same.push(`<span class="tt-affix" style="color:#a0a0a0">= Attack Speed: ${tierLabel[aTier]} · ${aS} strikes</span>`);
    }
  }
  const aArm = item.armor || 0, bArm = vsItem.armor || 0;
  if (aArm !== bArm) {
    const cls = aArm > bArm ? '#60d080' : '#d06060';
    const sign = aArm > bArm ? '+' : '−';
    (aArm > bArm ? gained : lost).push(`<span class="tt-affix" style="color:${cls}">${sign} Armor: +${aArm} <small style="color:#8a7a6a">(was +${bArm})</small></span>`);
  } else if (aArm > 0) {
    same.push(`<span class="tt-affix" style="color:#a0a0a0">= Armor: +${aArm}</span>`);
  }

  // Score deltas
  const sa = computeItemScores(item);
  const sb = computeItemScores(vsItem);
  const deltaTotal = sa.total - sb.total;
  const deltaOff = sa.offense - sb.offense;
  const deltaDef = sa.defense - sb.defense;
  const deltaUtl = sa.utility - sb.utility;
  const dColor = (d) => d > 0 ? '#60d080' : d < 0 ? '#d06060' : '#a0a0a0';
  const dStr = (d) => (d > 0 ? '+' : '') + d;

  const lines = [
    `<strong>${item.name}</strong>`,
    `<span class="tt-rarity" style="color:${getRarityColor(item.rarity)}">${rLabel(item.rarity)} · ${qLabel(item.quality)}</span>`,
    `<span class="tt-cmp-vs" style="color:#c0b090">Comparing vs. ${vsItem.name}</span>`,
    `<span class="tt-affix" style="color:${dColor(deltaTotal)}">Δ Total: ${dStr(deltaTotal)} <small style="color:#8a7a6a">(O ${dStr(deltaOff)} / D ${dStr(deltaDef)} / U ${dStr(deltaUtl)})</small></span>`,
  ];
  if (same.length)   lines.push(`<span class="tt-cmp-hdr" style="color:#8a7a6a">— Same —</span>`, ...same);
  if (gained.length) lines.push(`<span class="tt-cmp-hdr" style="color:#60d080">+ Gained +</span>`, ...gained);
  if (lost.length)   lines.push(`<span class="tt-cmp-hdr" style="color:#d06060">− Lost −</span>`, ...lost);
  if (secondaryHint) lines.push(`<span class="tt-cmp-hint" style="color:#6a5a52;font-size:0.9em">${secondaryHint}</span>`);
  return lines.join('<br>');
}

/**
 * Crafting system — materials and recipes
 */
export const MATERIALS = ITEMS_MATERIALS_CANONICAL;

/** Materials yielded by salvaging each rarity */
export const SALVAGE_YIELD = ITEMS_SALVAGE_YIELD_CANONICAL;

/**
 * Crafting recipes: cost in materials → output item.
 * M132: restructured to a Magic/Rare/Legendary × 12-slot grid so the Blacksmith
 * Craft tab can render one column per rarity. Legendary tier replaces the
 * previous void_* recipes (no more void_shard requirement).
 */
const CRAFT_SLOTS = [
  { slot:'weapon_heavy',  label:'Weapon (Heavy)',  base:'sword' },
  { slot:'weapon_light',  label:'Weapon (Light)',  base:'dagger' },
  { slot:'weapon_magic',  label:'Weapon (Magic)',  base:'staff' },
  { slot:'offhand_shield',label:'Off-hand (Shield)',base:'shield' },
  { slot:'offhand_orb',   label:'Off-hand (Orb)',  base:'orb' },
  { slot:'helm',          label:'Helm',            base:'heavy_helm' },
  { slot:'chest',         label:'Chest',           base:'heavy_chest' },
  { slot:'legs',          label:'Legs',            base:'heavy_legs' },
  { slot:'feet',          label:'Feet',            base:'heavy_boots' },
  { slot:'hands',         label:'Hands',           base:'heavy_gauntlets' },
  { slot:'ring',          label:'Ring',            base:'ring' },
  { slot:'necklace',      label:'Necklace',        base:'necklace' },
];
const CRAFT_TIERS = [
  { rarity:'magic',     quality:'medium', materials:{ iron_scrap:4,    magic_essence:2 } },
  { rarity:'rare',      quality:'high',   materials:{ magic_essence:4, rare_dust:2 } },
  { rarity:'legendary', quality:'elite',  materials:{ rare_dust:3,     legend_core:1 } },
];
const _CAPS = { magic:'Magic', rare:'Rare', legendary:'Legendary' };
export const CRAFT_RECIPES = CRAFT_SLOTS.flatMap(s => CRAFT_TIERS.map(t => ({
  id: `craft_${t.rarity}_${s.slot}`,
  name: `${_CAPS[t.rarity]} ${s.label}`,
  materials: t.materials,
  base: s.base,
  rarity: t.rarity,
  quality: t.quality,
  craftSlot: s.slot,
})));

/**
 * Pick a random weapon base key matching the given weaponCategory
 * ('heavy' | 'light' | 'magic'). Dragon/unique bases are excluded so
 * blacksmith crafting can't produce dragon-tier drops.
 */
export function randomWeaponBaseByCategory(category) {
  const pool = Object.entries(WEAPON_BASES)
    .filter(([, b]) => b.weaponCategory === category && !b.dragon)
    .map(([key]) => key);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Salvage an item — returns materials gained, removes item from inventory.
 * Caller should call GameState.removeFromInventory(item.id) separately.
 */
export function salvageItem(item) {
  const yield_ = SALVAGE_YIELD[item.rarity] || SALVAGE_YIELD.normal;
  const result = {};
  for (const [matId, range] of Object.entries(yield_)) {
    const count = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
    if (count > 0) result[matId] = count;
  }
  return result;
}

/**
 * Check if player has enough materials for a recipe.
 */
export function canCraft(recipe, materials) {
  for (const [matId, needed] of Object.entries(recipe.materials)) {
    if ((materials[matId] || 0) < needed) return false;
  }
  return true;
}

/**
 * Deduct materials for a recipe.
 */
export function deductMaterials(recipe, materials) {
  for (const [matId, needed] of Object.entries(recipe.materials)) {
    materials[matId] = (materials[matId] || 0) - needed;
  }
}

/**
 * Consumable potions — single-target or group
 */
export const POTIONS = ITEMS_POTIONS_CANONICAL;

/** Merchant potion stock — array for shop display */
export const POTION_STOCK = [
  { ...POTIONS.healing_potion },
  { ...POTIONS.greater_healing },
  { ...POTIONS.mana_potion },
  { ...POTIONS.revival_flask },
  { ...POTIONS.group_tonic },
  { ...POTIONS.antidote },
  // M399 — Town Portal Scroll removed from shop stock; town portal system
  // is deprecated. Existing stockpiled scrolls keep working via the legacy
  // MapScreen handlers but the listing no longer appears at the merchant.
];

/**
 * Build a starting equipment object for a class.
 * Takes an array of base keys, returns { slot: item } for equipment assignment.
 * Handles slot collisions (e.g. two daggers → weapon + offhand, two rings → ring1/ring2).
 */
export function buildStartingEquipment(baseKeys = []) {
  const equipment = {};
  for (const key of baseKeys) {
    const item = generateItem(key, 'normal', 'medium');
    if (!item) continue;
    const base = WEAPON_BASES[key] || ARMOR_BASES[key];
    let slot;
    if (base.type === 'weapon') {
      if (!equipment.weapon) slot = 'weapon';
      else if (!equipment.offhand && !equipment.weapon?.twoHanded && (base.offHandOk || !base.twoHanded)) slot = 'offhand';
      else slot = 'weapon';
    } else if (base.slot === 'ring') {
      if (!equipment.ring1) slot = 'ring1';
      else if (!equipment.ring2) slot = 'ring2';
      else slot = 'ring1';
    } else {
      slot = base.slot;
    }
    if (slot) equipment[slot] = item;
  }
  return equipment;
}

/** Human-readable names of starting equipment for display on class cards. */
export function getStartingEquipmentNames(baseKeys = []) {
  return baseKeys.map(k => (WEAPON_BASES[k] || ARMOR_BASES[k])?.name).filter(Boolean);
}

/** Apply a potion effect in combat. targets = array of combatant objects.
 *  Returns string describing what happened for the combat log. */
export function applyPotionEffect(potion, targets) {
  const eff = potion.effect;
  const msgs = [];
  for (const t of targets) {
    if (eff.type === 'heal') {
      if (!t.alive && eff.type !== 'revive') continue;
      const healed = Math.min(t.maxHp - t.hp, eff.amount);
      t.hp = Math.min(t.maxHp, t.hp + eff.amount);
      msgs.push(`${t.name} +${healed} HP`);
    } else if (eff.type === 'mana') {
      t.mp = Math.min(t.maxMp || 80, (t.mp || 0) + eff.amount);
      msgs.push(`${t.name} +${eff.amount} MP`);
    } else if (eff.type === 'revive') {
      if (t.alive) continue;
      t.alive = true;
      const pct = eff.pct || 0.25;
      t.hp = Math.max(1, Math.floor((t.maxHp || 1) * pct));
      t.stance = 'ready';
      if (eff.immune) t.reviveImmune = true;
      msgs.push(`${t.name} revived!`);
    } else if (eff.type === 'cleanse') {
      const removed = (t.statuses || []).filter(s => (eff.statuses || []).includes(s.type));
      t.statuses = (t.statuses || []).filter(s => !(eff.statuses || []).includes(s.type));
      if (removed.length) msgs.push(`${t.name} cleansed!`);
    }
  }
  return msgs.join(', ') || 'No effect';
}

/**
 * M305: Generate a named set piece item from a set definition piece entry.
 * The result is a regular item object with item.setId set.
 *
 * @param {string} setId        — key from SETS (sets.js)
 * @param {object} pieceDef     — one entry from set.items[]
 * @param {string} quality      — override quality (default 'high')
 * @param {object} affixPool    — affix pool for any extras (default AFFIXES_ACT1)
 * @returns {object|null}
 */
export function generateSetItem(setId, pieceDef, quality = 'high', affixPool = AFFIXES_ACT1) {
  const base = WEAPON_BASES[pieceDef.baseItemId] || ARMOR_BASES[pieceDef.baseItemId];
  if (!base) return null;

  const qMult = QUALITY_MULT[quality] || 1;
  const item = {
    id: crypto.randomUUID(),
    baseKey: pieceDef.baseItemId,
    name: base.name,
    type: base.type,
    subtype: base.subtype || base.slot,
    slot: pieceDef.slot || base.slot || 'weapon',
    weaponCategory: base.weaponCategory || null,
    twoHanded: !!base.twoHanded,
    offHandOk: !!base.offHandOk,
    isShield: !!base.isShield,
    rarity: 'legendary',
    quality,
    setId,
    affixes: [],
  };

  if (base.dmg) item.dmg = [Math.round(base.dmg[0] * qMult), Math.round(base.dmg[1] * qMult)];
  if (base.armor !== undefined) item.armor = Math.round(base.armor * qMult);

  // Fixed affixes — always present.
  for (const fa of (pieceDef.fixedAffixes || [])) {
    item.affixes.push({
      id: `set_fixed_${fa.stat}`,
      name: fa.stat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      stat: fa.stat,
      value: fa.value,
      setFixed: true,
    });
  }

  // Random affixes — roll once.
  for (const ra of (pieceDef.randomAffixes || [])) {
    const value = +(ra.min + Math.random() * (ra.max - ra.min)).toFixed(2);
    item.affixes.push({
      id: `set_rand_${ra.stat}`,
      name: ra.stat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      stat: ra.stat,
      value,
    });
  }

  // Shield intrinsics (same as generateItem).
  if (base.isShield) {
    if (base.blockChance) item.affixes.push({ id: 'base_block_chance', name: 'Base Block', stat: 'block_chance', value: +(base.blockChance).toFixed(2), baseIntrinsic: true });
    if (base.blockPower)  item.affixes.push({ id: 'base_block_power',  name: 'Base Block Power', stat: 'block_power', value: Math.round(base.blockPower * qMult), baseIntrinsic: true });
  }

  return item;
}

/**
 * M305: Roll a random set item from any set eligible for a given act.
 * Low-tier sets in acts 1-2, mid-tier in acts 3-4, endgame in act 5+.
 * Returns null if no eligible sets. dropChance: 0.03 (3%) per chest roll.
 *
 * @param {number} act       — current act (1-6)
 * @param {number} [chance]  — probability to attempt (default 0.03)
 * @param {object} [affixPool]
 * @returns {object|null}
 */
export function maybeDropSetItem(act, chance = 0.03, affixPool = AFFIXES_ACT1) {
  if (Math.random() > chance) return null;
  try {
    // Lazy import to avoid circular dep at module eval.
    const SETS = globalThis.__rsgSets;
    if (!SETS) return null;
    const eligible = Object.values(SETS).filter(set => {
      if (set.tier === 'low')     return act <= 2;
      if (set.tier === 'mid')     return act >= 2 && act <= 4;
      if (set.tier === 'endgame') return act >= 4;
      return false;
    });
    if (!eligible.length) return null;
    const chosenSet = eligible[Math.floor(Math.random() * eligible.length)];
    const chosenPiece = chosenSet.items[Math.floor(Math.random() * chosenSet.items.length)];
    const quality = act <= 2 ? 'medium' : act <= 4 ? 'high' : 'elite';
    return generateSetItem(chosenSet.id, chosenPiece, quality, affixPool);
  } catch (_) { return null; }
}
