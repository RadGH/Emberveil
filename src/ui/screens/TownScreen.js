/**
 * TownScreen — Full town with working Merchant, Tavern, Cleric
 * Blacksmith and Enchanter wired in M3+
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { MapScreen } from './MapScreen.js';
import { uuid } from '../../utils/uuid.js';
import { InventoryScreen } from './InventoryScreen.js';
import { TapInventoryScreen } from './TapInventoryScreen.js';
import { SkillTreeScreen } from './SkillTreeScreen.js';
import { QuestLogScreen } from './QuestLogScreen.js';
import { AchievementsScreen } from './AchievementsScreen.js';
import { PartyScreen } from './PartyScreen.js';
import { getBuilds as getClassBuilds } from '../../game/buildPresets.js';
import { CodexScreen } from './CodexScreen.js';
import { ChallengeScreen } from './ChallengeScreen.js';
import { HireBuilderScreen } from './HireBuilderScreen.js';
import { PartyPanelScreen } from './PartyPanelScreen.js';
import { GameMenuScreen } from './GameMenuScreen.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { generateItem, getItemTooltip, RARITY_COLORS, POTION_STOCK, MATERIALS, CRAFT_RECIPES, salvageItem, canCraft, deductMaterials, AFFIXES_ACT1, RARITY_AFFIX_COUNT, ACCESSORY_AFFIX_BONUS, randomWeaponBaseByCategory, ARMOR_BASES, WEAPON_BASES, buildStartingEquipment } from '../../game/items.js';
import { CLASSES as ALL_CLASSES } from '../../game/classes.js';
import { CLASSES } from '../../game/classes.js';
import { APPEARANCES } from '../../game/appearances.js';
import { portraitImg, classIconSvg } from '../../game/spriteUtils.js';
import { TAP_ALL } from '../../game/tapWeapons.js';
import { TOWNS, getTownById } from '../../maps/mapData.js';
import { preserveScroll } from '../components/ScrollPreserve.js';
import { autoApplyMember, pendingPointsForLevel } from '../../game/autoBuild.js';
import { getUnlockedSkills } from '../../game/skills.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { newBadgeIfRecent } from '../../game/featureRegistry.js';
import { ACT5_BOSS_IDS } from '../../game/infiniteDungeon.js';
import {
  UNIQUE_RECIPES, COMMON_RECIPES, CRAFTING_MATERIALS,
  getCraftingRecipesUnlocked, isRecipeUnlocked, unlockRecipes,
  isTierUnlocked, syncTierUnlocks,
} from '../../game/recipes.js';
import { generateUnique } from '../../game/uniques.js';
import { showToast } from '../components/toast.js';
import { checkAchievements } from '../../game/achievements.js';
import { checkGameStateAchievements } from './AchievementsScreen.js';

// M306 — check if any act-5 boss has been killed (unlock condition for Infinite Depths).
function _isInfiniteDepthsUnlocked() {
  try {
    const gs = GameState.get();
    const bosses = gs.completedBosses || [];
    return ACT5_BOSS_IDS.some(id => bosses.some(b => b === id || (typeof b === 'object' && b && b.id === id)));
  } catch (_) {
    return false;
  }
}

// M71: deterministic RNG seeded by town/ng+ so stocks don't reroll on revisit.
function _mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Act-specific town configuration
const TOWN_CONFIG = {
  1: { name: 'Emberglen',       actLabel: 'Act I \u00B7 The Goblin Frontier',  services: ['merchant', 'tavern', 'cleric', 'tapweapons'] },
  2: { name: 'Ashfort',         actLabel: 'Act II \u00B7 The Ashen Wastes',    services: ['merchant', 'tavern', 'cleric', 'blacksmith', 'trainer', 'tapweapons'] },
  3: { name: 'Ironhold Bastion',actLabel: 'Act III \u00B7 The Hell Breach',    services: ['merchant', 'tavern', 'cleric', 'blacksmith', 'trainer', 'enchanter', 'tapweapons'] },
  4: { name: 'Starfall Haven',  actLabel: 'Act IV \u00B7 The Cosmic Void',     services: ['merchant', 'tavern', 'cleric', 'blacksmith', 'trainer', 'enchanter', 'blackmarket', 'tapweapons'] },
  5: { name: 'The Last Bastion',actLabel: 'Act V \u00B7 The Primordial Abyss', services: ['merchant', 'tavern', 'cleric', 'blacksmith', 'trainer', 'enchanter', 'blackmarket', 'tapweapons'] },
  6: { name: 'Drakehold',       actLabel: "Act VI \u00B7 The Dragon's Reach",  services: ['merchant', 'tavern', 'cleric', 'blacksmith', 'trainer', 'enchanter', 'blackmarket', 'tapweapons'] },
};

// Party level required to access the Black Market
const BLACK_MARKET_MIN_LEVEL = 3;

// Black Market stock — rare/restricted goods. Biases toward rare/magic, with
// occasional "forbidden" items (cursed weapons, assassin gear, forbidden tomes).
function getBlackMarketStock() {
  // Pool of eligible base keys for restricted gear.
  const restricted = [
    'dagger',   // assassin gear
    'crossbow', // assassin gear
    'javelin',
    'sword2h',
    'axe2h',
    'staff',    // forbidden tomes stand-in
    'wand',
    'scepter',
    'heavy_chest',
    'medium_chest',
    'cloth_chest',
    'heavy_helm',
    'medium_legs',
    'ring',
    'necklace',
  ];
  const qualities = ['high', 'high', 'elite', 'elite', 'exotic'];
  const rarities  = ['magic', 'magic', 'rare', 'rare', 'rare', 'legendary'];
  const flavors = [
    { prefix: 'Cursed',    tag: 'cursed' },
    { prefix: 'Forbidden', tag: 'forbidden' },
    { prefix: 'Shadow',    tag: 'shadow' },
    { prefix: 'Blackened', tag: 'cursed' },
    { prefix: 'Whispering',tag: 'forbidden' },
    { prefix: 'Assassin\u2019s', tag: 'assassin' },
  ];
  const count = 6 + Math.floor(Math.random() * 5); // 6..10
  const stock = [];
  for (let i = 0; i < count; i++) {
    const baseKey = restricted[Math.floor(Math.random() * restricted.length)];
    const rarity  = rarities[Math.floor(Math.random() * rarities.length)];
    const quality = qualities[Math.floor(Math.random() * qualities.length)];
    const item = generateItem(baseKey, rarity, quality);
    // Mark as restricted and reflavor the name.
    const flavor = flavors[Math.floor(Math.random() * flavors.length)];
    item.id = item.id + '_bm' + i;
    item.baseName = item.name;
    item.name = `${flavor.prefix} ${item.name}`;
    item.blackMarket = true;
    item.blackMarketTag = flavor.tag;
    stock.push(item);
  }
  return stock;
}

function _currentTown() {
  // M71: derive town from current node id; fall back to act default.
  const gs = GameState.get();
  const t = gs.nodeId ? getTownById(gs.nodeId) : null;
  return t;
}

function getTownConfig() {
  const gs = GameState.get();
  const town = _currentTown();
  const act = town ? town.act : (gs.act || 1);
  const baseCfg = TOWN_CONFIG[act] || TOWN_CONFIG[1];
  let services = [...baseCfg.services];
  // M71: Guild Hall unlocks at 500 fame after the encounter.
  if (gs.guildHallUnlocked && GameState.getFame() >= 500 && !services.includes('guildhall')) {
    services.push('guildhall');
  }
  // M224: canonical tab order — merchant → tavern → cleric → blacksmith →
  // enchanter → tapweapons → guildhall → blackmarket. Drop anything not in
  // the base act config (Guild Hall only shows when unlocked).
  const TAB_ORDER = ['merchant','tavern','cleric','blacksmith','trainer','enchanter','tapweapons','guildhall','blackmarket'];
  services = TAB_ORDER.filter(s => services.includes(s));
  return {
    name: town ? town.name : baseCfg.name,
    actLabel: baseCfg.actLabel,
    services,
    townId: town ? town.id : `act${act}_default`,
    act,
  };
}

// Get pending notification count and details
function getNotifications() {
  const gs = GameState.get();
  const notes = [];
  // M135: tag bench characters so the user can tell whether a phantom point
  // count is coming from an inactive hero rather than their active party.
  const pools = [
    { list: gs.party, tag: '' },
    { list: gs.companions, tag: '' },
    { list: gs.bench || [], tag: ' (bench)' },
  ];
  for (const { list, tag } of pools) {
    for (const m of list) {
      // M283: companions can't spend skill/attr/passive points (no skill tree
      // UI for them). If the model ever stamped them with pending points
      // (legacy bug), don't surface those as notifications.
      if (m.isCompanion || m.class === 'companion') continue;
      const name = `${m.name}${tag}`;
      if ((m.pendingAttrPoints || 0) > 0) {
        notes.push({ name, type: 'attr', count: m.pendingAttrPoints });
      }
      if ((m.pendingSkillPoints || 0) > 0) {
        notes.push({ name, type: 'skill', count: m.pendingSkillPoints });
      }
      if ((m.pendingPassivePoints || 0) > 0) {
        notes.push({ name, type: 'passive', count: m.pendingPassivePoints });
      }
    }
  }
  return notes;
}

function getNotificationCount() {
  return getNotifications().reduce((sum, n) => sum + n.count, 0);
}

// Hireable characters in Act 1 towns.
// M412 — costs normalized to 100g × level for ALL hireable heroes (parity
// with the trainer's per-level price + custom-hire price). The cost is
// computed via _hireableCost() on render, so the field below is descriptive
// only and may be omitted.
// M496+ canonical-data migration (Phase 2 step 8): HIREABLES_ACT1 and
// COMPANIONS_ACT1 are no longer inline literals. They are sourced from the
// single canonical JSON `public/data/entities/companions.json` via the
// centralized dataLoader.js (same pattern as ENEMIES / CLASS_PETS / drop
// tables). The resolved arrays are value-identical to the legacy literals
// (id, name, class, level, attrs, personality, description, cost, wild,
// appearance all preserved verbatim — SAVE-COMPAT: a renamed/dropped hire or
// companion id would orphan a saved party/companion). Array order is not
// load-bearing: both lists are searched via `.find(x => x.id === …)` and
// filtered (`.filter(c => c.wild === true)`), never index-addressed.
import { HIREABLES_ACT1_CANONICAL, COMPANIONS_ACT1_CANONICAL } from '../../game/dataLoader.js';
export const HIREABLES_ACT1 = HIREABLES_ACT1_CANONICAL;

// M412 — uniform hire cost rule for hero hires: 100g × level.
export function _hireableCost(h) {
  return Math.max(100, (h?.level || 1) * 100);
}

// M412 — companion power tier (1..5). Drives both base cost and the in-combat
// scaling of HP/damage. Tier 5 is roughly a level-5 boss-quality companion;
// tier 1 is a chump that's only useful early. Cost = power × 100.
// M427 — canonical map relocated to game/companions.js so the simulator and
// CombatScreen can apply the rating to actual stat scaling. Re-export here
// for back-compat with any external callers.
import { COMPANION_POWER as _COMP_POW, getCompanionPower } from '../../game/companions.js';
export const COMPANION_POWER = _COMP_POW;
export function _companionPower(c) { return getCompanionPower(c); }
export function _companionCost(c) { return _companionPower(c) * 100; }
// M412 — runtime stat scaling for companions. Caller passes the partyAvgLevel.
//   maxHp = 30·P + 8·P·L
//   dmg   = [3+P + P·L, 5+2P + 1.5·P·L]
// where P = power tier, L = effective level (party avg, min companion level).
export function _scaleCompanion(c, partyAvgLevel) {
  const P = _companionPower(c);
  const L = Math.max(1, Math.round(partyAvgLevel || c?.level || 1));
  const maxHp = Math.round(30 * P + 8 * P * L);
  const dmgLo = Math.max(1, Math.round(3 + P + P * L));
  const dmgHi = Math.max(dmgLo + 1, Math.round(5 + 2 * P + 1.5 * P * L));
  return { maxHp, dmg: [dmgLo, dmgHi], level: L, power: P };
}

// COMPANIONS_ACT1 — canonical (see HIREABLES_ACT1 note above). The `wild: true`
// flag gates wild companions behind the tavern 30% wild-roll; dragon-kin
// companions are narrative-driven (no wild flag). M270: Clockwork Turret is
// not in this list — it's a CLASS_PET unlocked via the Tinker's "Deploy
// Turret" talent.
const COMPANIONS_ACT1 = COMPANIONS_ACT1_CANONICAL;

// M71: Merchant stock — generated per town, scaled by act + NG+, deterministic.
// Session 2026-04-16: extended with the new weapon / shield / armor variety bases.
const _MERCH_BASES = [
  'sword','dagger','wand','staff','bow','hammer','sword2h','axe2h','crossbow','spear',
  'light_chest','cloth_chest','medium_chest','heavy_chest','light_helm','medium_helm','heavy_helm',
  'light_legs','medium_legs','heavy_legs','ring','necklace','shield','light_boots','heavy_boots',
  // New weapon variety (heavy / light / magic; acts 1–5).
  'iron_mace','obsidian_scimitar','ember_focus','voidsteel_greatsword','starfall_bow','abyssal_rod',
  // New shield variety (acts 1–4+).
  'buckler','kite_shield','tower_shield','aegis_shield',
  // New body-armor variety (chest/legs/hands/feet, acts 2–5).
  'scaled_chest','runed_chest','scaled_legs','runed_legs',
  'medium_gauntlets','runed_gauntlets','medium_boots','runed_boots',
];
const _RAR = ['normal','magic','rare','legendary'];
const _QUAL = ['low','medium','high','elite','exotic'];
function _bumpTier(arr, idx, bonus) {
  return arr[Math.min(arr.length - 1, idx + bonus)];
}
// M72: Tavern roster per town. With one town per act, each roster is a
// hand-curated 3–4 merc set with deterministic dragon-kin escalation.
//   Act 1 Emberglen: base mercs, war dog only.
//   Act 2 Cinderhold: base mercs rotated.
//   Act 3 Dreadhearth: introduces 1 weak Dragon Knight + dragon hatchling.
//   Act 4 Nullreach: mid-tier Dragon Knight + frost wyrmling.
//   Act 5 Deepcradle: stronger Dragon Knight + storm drake.
//   Act 6 Drakegate: strongest Dragon Knight + shadow wyrm.
const _TAVERN_ROSTERS = {
  town_emberglen: { hires: ['borin','aela','rekk'],                companions: ['war_dog'] },
  start:          { hires: ['borin','aela','rekk'],                companions: ['war_dog'] }, // node id for Emberglen
  town_cinderhold:{ hires: ['aela','lysa','rekk','borin'],         companions: ['war_dog'] },
  town_dreadhearth:{hires: ['borin','lysa','kaldrek'],             companions: ['war_dog','dragon_hatchling'] },
  town_nullreach: { hires: ['aela','lysa','syra_wyrmsworn'],       companions: ['war_dog','frost_wyrmling'] },
  town_deepcradle:{ hires: ['borin','rekk','vorin_emberjaw'],      companions: ['war_dog','storm_drake'] },
  town_drakegate: { hires: ['lysa','aela','maelis_drakeblood'],    companions: ['war_dog','shadow_wyrm'] },
};
/**
 * Returns all appearance ids whose classDefault matches the given classId.
 * Falls back to the appearance whose id equals the classId if no matches.
 * @param {string} classId
 * @returns {string[]} appearance ids
 */
function _appearancesForClass(classId) {
  // M256: exclude NPC (playable: false) appearances from tavern-hire rolls.
  const matches = APPEARANCES.filter(a => a.classDefault === classId && a.playable !== false);
  if (matches.length > 0) return matches.map(a => a.id);
  // Fallback: appearance whose id matches the class directly.
  const direct = APPEARANCES.find(a => a.id === classId);
  return direct ? [direct.id] : [classId];
}

// M225: derive a per-game seed so tavern rolls vary by playthrough. Cached on
// state so re-entering the same tavern shows the same hires.
function _getGameSeed() {
  const gs = GameState.get();
  if (gs.gameSeed == null) {
    // M280 — User-supplied mapSeed (advanced difficulty options) takes
    // precedence so two players entering the same seed see matching world
    // generation. Falls back to hero-derived seed when blank.
    const userSeed = (typeof gs.mapSeed === 'string' && gs.mapSeed.trim()) ? gs.mapSeed.trim() : '';
    if (userSeed) {
      gs.gameSeed = _hashStr(`map|${userSeed}|${gs.ngPlus || 0}`);
    } else {
      const hero = gs.party?.[0];
      const src = `${hero?.id || ''}|${hero?.name || ''}|${gs.ngPlus || 0}|${hero?.appearance || ''}`;
      gs.gameSeed = _hashStr(src || String(Date.now()));
    }
  }
  return gs.gameSeed;
}

// M225: build a generic hire template for a given class + appearance + level.
// No named flavor — name is synthesized from the appearance so it feels like
// a walk-in mercenary rather than a scripted NPC.
// M253 hotfix: gendered name pools pulled from the new dep-less nameGen
// module. Previous `import from './CharacterBuilderScreen.js'` triggered a
// circular import that broke play.html at init ("Cannot access 'Vr' before
// initialization"). The dedicated src/game/nameGen.js has no other imports
// besides appearances.js so no cycle is possible.
import { namesForGender } from '../../game/nameGen.js';
const _FEMALE_NAMES = namesForGender('female');
const _MALE_NAMES   = namesForGender('male');
function _rollHireTemplate(classId, appearance, level, seed, takenNames) {
  const klass = CLASSES.find(c => c.id === classId);
  if (!klass) return null;
  const gender = appearance?.gender || 'male';
  const namePool = gender === 'female' ? _FEMALE_NAMES : _MALE_NAMES;
  // M242 dedupe fix: advance the seed until we find a name not already used
  // at this tavern. Previously the same seed-modulo could hand identical
  // names to different classes ("Sten the witch hunter, Sten the runesmith").
  let name = namePool[seed % namePool.length];
  if (takenNames instanceof Set) {
    let guard = 0;
    while (takenNames.has(name) && guard++ < namePool.length) {
      seed = (seed + 0x9E3779B1) >>> 0;
      name = namePool[seed % namePool.length];
    }
    takenNames.add(name);
  }
  // Level-scaled base stats: primary attr bumps with level, others follow.
  const prim = klass.primaryAttr || 'STR';
  const baseAttr = { STR: 8, DEX: 8, INT: 8, CON: 9 };
  baseAttr[prim] = 12 + Math.floor(level * 0.8);
  // Secondary: give DEX to STR classes, INT to DEX classes, DEX to INT classes.
  const secMap = { STR: 'DEX', DEX: 'INT', INT: 'DEX', CON: 'STR' };
  const sec = secMap[prim] || 'CON';
  baseAttr[sec] = 10 + Math.floor(level * 0.4);
  baseAttr.CON = 10 + Math.floor(level * 0.5);
  // Cost: level-scaled with a per-class premium. M225: costs scale with zone.
  const baseCost = 60 + level * 35;
  const cost = Math.round(baseCost * (klass.id === 'dragon_knight' ? 1.6 : 1));
  const personalities = [
    { k: 'aggressive',  note: 'Aggressive — always targets the strongest enemy first.' },
    { k: 'patient',     note: 'Patient — prefers precise strikes over rushing in.' },
    { k: 'protective',  note: 'Protective — prioritizes healing injured allies.' },
    { k: 'opportunist', note: 'Opportunist — strikes weakened enemies to finish them.' },
  ];
  const personality = personalities[seed % personalities.length];
  return {
    id: `hire_${classId}_${appearance?.id || classId}_${level}`,
    templateId: `hire_${classId}`,
    name,
    className: klass.name,
    class: classId,
    appearance: appearance?.id || classId,
    level,
    cost,
    attrs: baseAttr,
    personality: personality.k,
    personalityNote: personality.note,
    description: `A Lv${level} ${klass.name.toLowerCase()} looking for work. ${klass.hook.split('.')[0]}.`,
  };
}

function getTavernRosterForTown(townId, act) {
  const gs = GameState.get();
  const gameSeed = _getGameSeed();
  // M279: fixed 3-hero pool per tavern. Rolling more than 3 then truncating
  // keeps the seed math stable while honoring the new design (deplete on hire,
  // explore other towns to restock). Previously slotCount scaled with act.
  const slotCount = 3;
  // Per-class zone level — rough linear ramp so Act 1 hires are Lv1–2 and
  // Act 6 hires are around the late-game expected party level.
  const zoneLevel = Math.max(1, Math.round(1 + (act - 1) * 4));
  const rng = _mulberry32((gameSeed ^ _hashStr(`tavern|${townId}`)) >>> 0);
  // Build the class pool. Only use classes that have at least one appearance.
  const allClasses = CLASSES.map(c => c.id).filter(id => _appearancesForClass(id).length > 0);
  // M408: the roll is fully deterministic per (gameSeed, townId). It does NOT
  // depend on the player's current party composition — otherwise hiring one
  // hero would re-shuffle the remaining slots (the bug the user reported in
  // M407). The roster is seeded once and only depletes via gs.tavernHired.
  // Heroes whose class duplicates the party are filtered out of the FINAL
  // output below (after the seeded roll), so the roster size shrinks 3→2→1
  // gracefully without changing the seeded picks for the surviving slots.
  const pool = allClasses;
  // Fisher-Yates shuffle with seeded RNG.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosenClasses = shuffled.slice(0, slotCount);
  // For each chosen class pick an appearance, gender-aware and avoiding the
  // main character's appearance when possible. Keep chosen appearances unique
  // at this tavern.
  const heroAppearance = gs.party?.[0]?.appearance;
  const heroGender = (APPEARANCES.find(a => a.id === heroAppearance)?.gender) || null;
  const usedAppearances = new Set();
  const usedNames = new Set();
  const hires = [];
  for (const classId of chosenClasses) {
    const appPool = _appearancesForClass(classId)
      .map(id => APPEARANCES.find(a => a.id === id))
      .filter(Boolean);
    // Prefer the opposite gender of main hero; otherwise keep all.
    let candidates = appPool.filter(a => !usedAppearances.has(a.id) && a.id !== heroAppearance);
    if (heroGender) {
      const opp = candidates.filter(a => a.gender !== heroGender);
      if (opp.length > 0) candidates = opp;
    }
    if (candidates.length === 0) candidates = appPool.filter(a => a.id !== heroAppearance);
    if (candidates.length === 0) candidates = appPool;
    if (candidates.length === 0) continue;
    const pickIdx = Math.floor(rng() * candidates.length);
    const picked = candidates[pickIdx];
    usedAppearances.add(picked.id);
    // Level jitter: base zoneLevel ±1 so the roster isn't all identical.
    const lvl = Math.max(1, zoneLevel + (Math.floor(rng() * 3) - 1));
    const tmpl = _rollHireTemplate(classId, picked, lvl, _hashStr(`${townId}|${classId}|${picked.id}|${lvl}`), usedNames);
    if (tmpl) hires.push(tmpl);
  }

  // Companions stay on the hand-curated per-town list (dragon-kin progression
  // is narrative-driven and should not be randomized away).
  const key = _TAVERN_ROSTERS[townId] ? townId : (_TAVERN_ROSTERS[`town_${townId}`] ? `town_${townId}` : null);
  const spec = key ? _TAVERN_ROSTERS[key] : null;
  const fallbackByAct = {
    1: _TAVERN_ROSTERS.town_emberglen,
    2: _TAVERN_ROSTERS.town_cinderhold,
    3: _TAVERN_ROSTERS.town_dreadhearth,
    4: _TAVERN_ROSTERS.town_nullreach,
    5: _TAVERN_ROSTERS.town_deepcradle,
    6: _TAVERN_ROSTERS.town_drakegate,
  };
  const chosen = spec || fallbackByAct[act] || _TAVERN_ROSTERS.town_emberglen;
  let companions = chosen.companions
    .map(id => COMPANIONS_ACT1.find(c => c.id === id))
    .filter(Boolean);

  // M279: 30% chance per tavern visit (deterministic per seed) to also offer a
  // wild encounter companion the player hasn't yet hired (shadow_cat etc).
  const wildRng = _mulberry32((gameSeed ^ _hashStr(`tavern_wild|${townId}`)) >>> 0);
  if (wildRng() < 0.30) {
    const wildPool = COMPANIONS_ACT1.filter(c => c.wild === true);
    if (wildPool.length) {
      const pick = wildPool[Math.floor(wildRng() * wildPool.length)];
      if (pick && !companions.find(c => c.id === pick.id)) companions.push(pick);
    }
  }

  // M279/M408: filter out hires/companions the player already claimed from
  // this tavern, OR who are already on the player's roster (party / bench /
  // companions). Roster depletes 3→2→1→0; explore other towns to restock.
  const claimed = new Set((gs.tavernHired && gs.tavernHired[townId]) || []);
  const onRoster = new Set([
    ...((gs.party || [])),
    ...((gs.bench || [])),
    ...((gs.companions || [])),
  ].flatMap(m => m ? [m.id, m.templateId].filter(Boolean) : []));
  const isClaimed = (id) => claimed.has(id) || onRoster.has(id);
  const hiresOut = hires.filter(h => !isClaimed(h.id));
  companions = companions.filter(c => !isClaimed(c.id));

  return { hires: hiresOut, companions };
}

// M71: Guild Hall stock — 12 slots, gated by fame, rare+ rarity rising by slot.
// M483 — fame/level scaling helpers. Returns a tier bump in [0..2] based on
// the player's current renown so that high-fame heroes see strictly better
// gear in both the guild hall and merchant. ngPlus bump stacks on top.
function _fameTierBonus(fame, heroLvl) {
  // Treat fame and 50*level as parallel "renown" scales — whichever is higher
  // drives the bump. At level 20 with no fame, bonus = 1; at L20 + 3000 fame,
  // bonus = 2 (saturates).
  const renown = Math.max(fame || 0, 50 * (heroLvl || 1));
  if (renown >= 2000) return 2;
  if (renown >= 500)  return 1;
  return 0;
}

function getGuildHallStockForTown(townId, act, ngPlus, fame = 0, heroLvl = 1) {
  // M226: mix in per-game seed.
  const seed = (_hashStr(`${townId}|ng${ngPlus}|guild`) ^ _getGameSeed()) >>> 0;
  const rng = _mulberry32(seed);
  const fameBump = _fameTierBonus(fame, heroLvl);
  const totalBump = (ngPlus > 0 ? 1 : 0) + fameBump;
  const out = [];
  for (let i = 0; i < 12; i++) {
    const base = _MERCH_BASES[Math.floor(rng() * _MERCH_BASES.length)];
    let r, q;
    if (i < 3)      { r = 'rare';      q = 'high'; }
    else if (i < 6) { r = 'rare';      q = 'elite'; }
    else if (i < 9) { r = 'legendary'; q = 'elite'; }
    else            { r = 'legendary'; q = 'exotic'; }
    if (totalBump > 0) {
      r = _bumpTier(_RAR, _RAR.indexOf(r), totalBump);
      q = _bumpTier(_QUAL, _QUAL.indexOf(q), totalBump);
    }
    const item = generateItem(base, r, q);
    if (item) {
      item.id = item.id + `_g${i}`;
      // Fame gate: 500 + 250 * (slot index - 2) for slots 4..12.
      item.guildSlot = i + 1;
      item.fameRequired = i < 3 ? 500 : 500 + 250 * (i - 2);
      out.push(item);
    }
  }
  return out;
}

function getMerchantStockForTown(townId, act, ngPlus, fame = 0, heroLvl = 1) {
  // Roll tables by act — picks a base index then bumps with NG+ and fame.
  // M483: rarity now also scales with fame/hero-level so a L20 character with
  // 3000+ fame stops seeing white items in the merchant stock regardless of
  // which act they're standing in. Target distribution at fame ≥ 2000 / L20+:
  //   ~30% magic, ~15% rare, ~5% legendary, rest common is the BASE table;
  //   the fame bump shifts every roll +2 tiers, so the realised mix becomes
  //   roughly 50% rare, 30% legendary, 20% magic (no commons survive).
  const RAR_BY_ACT = {
    1: [0,0,0,1,1],         // mostly normal, some magic
    2: [0,1,1,1,2],         // magic-heavy, some rare
    3: [1,2,2,2,3],         // rare
    4: [2,2,3,3,3],         // rare/legendary
    5: [2,3,3,3,3],         // legendary
    6: [2,3,3,3,3],
  };
  const QUAL_BY_ACT = {
    1: [0,1,1,2,2],
    2: [1,1,2,2,3],
    3: [1,2,2,3,3],
    4: [2,2,3,3,4],
    5: [2,3,3,4,4],
    6: [2,3,3,4,4],
  };
  // M226: combine game seed so stocks vary across playthroughs, not just NG+.
  const seed = (_hashStr(`${townId}|ng${ngPlus}|merch`) ^ _getGameSeed()) >>> 0;
  const rng = _mulberry32(seed);
  const rarTable = RAR_BY_ACT[act] || RAR_BY_ACT[1];
  const qualTable = QUAL_BY_ACT[act] || QUAL_BY_ACT[1];
  const fameBump = _fameTierBonus(fame, heroLvl);
  const totalBump = (ngPlus > 0 ? 1 : 0) + fameBump;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const rollItem = (baseId, tag) => {
    const r = _bumpTier(_RAR, rarTable[Math.floor(rng() * rarTable.length)], totalBump);
    const q = _bumpTier(_QUAL, qualTable[Math.floor(rng() * qualTable.length)], totalBump);
    const item = generateItem(baseId, r, q);
    if (item) { item.id = `${item.id}_m${tag}`; return item; }
    return null;
  };
  // M226 slot-based merchant stock:
  //   Required (one each): chest, head, feet, hands, legs.
  //   Jewelry: 0–2 rings/necklaces (50% chance per slot).
  //   Other: weapon (70%), offhand/shield (40%), potion slot (always — handled
  //   elsewhere via POTION_STOCK, not rolled here).
  const bySlot = (slot) => Object.keys(ARMOR_BASES).filter(id => {
    const b = ARMOR_BASES[id];
    return b?.slot === slot && _MERCH_BASES.includes(id);
  });
  const weaponPool = Object.keys(WEAPON_BASES).filter(id => _MERCH_BASES.includes(id));
  const out = [];
  const required = ['chest','head','feet','hands','legs'];
  required.forEach((slot, i) => {
    const pool = bySlot(slot);
    if (pool.length === 0) return;
    const item = rollItem(pick(pool), `s${i}`);
    if (item) out.push(item);
  });
  // Jewelry (up to 2): independent 50% rolls for ring + necklace.
  const ringPool = bySlot('ring');
  const neckPool = bySlot('necklace');
  if (ringPool.length > 0 && rng() < 0.5) {
    const item = rollItem(pick(ringPool), 'j0');
    if (item) out.push(item);
  }
  if (neckPool.length > 0 && rng() < 0.5) {
    const item = rollItem(pick(neckPool), 'j1');
    if (item) out.push(item);
  }
  // Weapon (70%).
  if (weaponPool.length > 0 && rng() < 0.7) {
    const item = rollItem(pick(weaponPool), 'w0');
    if (item) out.push(item);
  }
  // Offhand / shield (40%).
  const offhandPool = bySlot('offhand');
  if (offhandPool.length > 0 && rng() < 0.4) {
    const item = rollItem(pick(offhandPool), 'o0');
    if (item) out.push(item);
  }
  // Bonus utility picks to keep stock near ~10 items for the UI.
  while (out.length < 10) {
    const base = pick(_MERCH_BASES);
    const item = rollItem(base, `b${out.length}`);
    if (item) out.push(item);
    else break;
  }
  return out;
}

export class TownScreen {
  constructor(manager, audio, gameStateOrHero, isNewGame = false) {
    this.manager = manager;
    this.audio = audio;
    this.isNewGame = isNewGame;
    this._el = null;
    this._activeService = null;
    this._currentTownId = null;
    this._merchantStock = [];
    this._guildStock = [];
    this._blackMarketStock = getBlackMarketStock();
    // Blacksmith tabs: 'salvage' | 'craft'. (Upgrade moved to Enchanter in M182.)
    this._blacksmithTab = 'salvage';
    this._blacksmithMsg = '';
    // Enchanter tabs: 'affix' (add a property) | 'rarity' (promote rarity). M182.
    this._enchanterTab = 'affix';
    this._enchanterMsg = '';
    // M313 #30 — 3-step enchanter flow state (affix sub-tab only).
    // step: 'item' | 'property' | 'tier'
    this._encStep = 'item';
    this._encSelectedItem = null;  // { item, eqRef, ownerName }
    this._encSelectedAffix = null; // affix id string
    // Legacy aliases still read by older call-sites during this session's
    // in-flight refactor. Point them at the new state.
    this._forgeTab = this._blacksmithTab;
    this._forgeMsg = '';
    this._tooltip = null;

    // Accept either raw hero (from builder) or full game state
    if (gameStateOrHero?.party) {
      // already a game state — no-op, use GameState singleton
    } else if (gameStateOrHero) {
      GameState.init(gameStateOrHero);
    }
  }

  onEnter() {
    // M279: hard guard — first-town-visit was popping the player back to the
    // main menu when an early-game render path threw (e.g. missing
    // merchantStock entry, undefined storyFlag, or a thrown
    // _maybeShowFameEncounter). The thrown error unwound the screen-manager
    // stack all the way out. Wrap each phase so a single broken sub-system
    // doesn't take down the whole town visit.
    try {
      this.audio.playOverworldMusic(GameState.get().act || 1, null);
    } catch (e) { console.warn('[TownScreen.onEnter] music failed', e); }

    try {
      const cfg = getTownConfig();
      if (cfg.townId !== this._currentTownId) {
        this._currentTownId = cfg.townId;
        const ng = GameState.getNgPlus();
        // M483 — pass fame + hero level so high-renown stock skips commons.
        const _gs = GameState.get();
        const _fame = GameState.getFame ? GameState.getFame() : (_gs.fame || 0);
        const _heroLvl = (_gs.party && _gs.party[0] && _gs.party[0].level) || 1;
        this._merchantStock = getMerchantStockForTown(cfg.townId, cfg.act, ng, _fame, _heroLvl) || [];
        this._guildStock    = getGuildHallStockForTown(cfg.townId, cfg.act, ng, _fame, _heroLvl) || [];
      }
    } catch (e) {
      console.warn('[TownScreen.onEnter] stock refresh failed; using empty stock', e);
      this._merchantStock = this._merchantStock || [];
      this._guildStock    = this._guildStock || [];
    }

    try {
      // M234: Normal difficulty auto-heals on town entry; Hard preserves HP/MP.
      const diff = localStorage.getItem('emberveil_difficulty') || 'normal';
      if (diff !== 'hard') {
        const gs = GameState.get();
        [...(gs.party || []), ...(gs.companions || [])].forEach(m => {
          if (!m) return;
          if (m.maxHp) m.hp = m.maxHp;
          if (m.maxMp) m.mp = m.maxMp;
          if (m.dead) m.dead = false;
        });
      }
    } catch (_) {}

    try { this._build(); }
    catch (e) {
      console.error('[TownScreen.onEnter] _build threw — surface in panel instead of unwinding', e);
      // Render an inline error so the player isn't kicked to main menu.
      try {
        if (!this._el) {
          this._el = createEl('div', 'town-screen');
          this.manager.uiOverlay.appendChild(this._el);
        }
        this._el.innerHTML = `<div style="padding:1rem;color:#f0d090;background:#1a1018;border:1px solid #c04030;margin:1rem;border-radius:6px;font-family:monospace;font-size:0.8rem">Town render failed (recoverable). Press ESC for menu, or move out and back. Error: ${String(e && e.message || e)}</div>`;
      } catch (_) {}
    }

    try { this._maybeShowFameEncounter(); }
    catch (e) { console.warn('[TownScreen.onEnter] fame encounter failed', e); }
  }

  _build() {
    injectStyles('town-styles', TOWN_STYLES);
    this._el = createEl('div', 'town-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    preserveScroll(this._el, () => this._renderImpl());
  }

  _renderImpl() {
    const gs = GameState.get();
    const hero = gs.party[0];
    const gold = GameState.getGold();

    this._el.innerHTML = `
      <div class="town-bg"></div>
      <div class="town-layout">
        <!-- LEFT: Party panel -->
        <aside class="party-panel">
          <div class="panel-title">Party</div>
          <div class="party-slots" id="party-slots"></div>
          <div class="panel-title" style="margin-top:1rem">Companions</div>
          <div class="party-slots" id="companion-slots"></div>
        </aside>

        <!-- CENTER: Town -->
        <main class="town-main">
          <div class="town-header-row">
            <div>
              <div class="town-region-tag">${getTownConfig().actLabel}</div>
              <div class="town-name">${getTownConfig().name}</div>
            </div>
            <div class="gold-display" style="flex-direction:column;align-items:flex-end;gap:0.2rem">
              <div style="display:flex;align-items:center;gap:0.35rem">
                <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="#e8a020"/><text x="10" y="14" text-anchor="middle" font-size="11" fill="#0a0608" font-weight="900">G</text></svg>
                <span id="gold-amount">${gold.toLocaleString()}</span>
              </div>
              <div style="font-size:0.62rem;color:#8a7a6a">${GameState.getFame()} Fame \u00B7 ${GameState.getFameTitle()}${GameState.getNgPlus() > 0 ? ` \u00B7 <span style="color:#e8d020">NG+${GameState.getNgPlus()}</span>` : ''}</div>
            </div>
          </div>

          ${this.isNewGame ? `<div class="welcome-banner">
            <div class="wb-title">Welcome to ${getTownConfig().name}</div>
            <div class="wb-text">A grey-bearded man called <strong style="color:#e8d090">Silas Veilward</strong> meets you in the square. He confirms the thing you already suspected — something ancient is stirring beneath the border. The goblin raids are a cover. He would like your help investigating. Before setting out, seek allies — the road ahead is not safe alone.</div>
          </div>` : ''}

          <div class="service-tabs">
            ${getTownConfig().services.map(svc => {
              const label = svc === 'blackmarket' ? 'Black Market' : svc === 'guildhall' ? 'Guild Hall' : svc === 'tapweapons' ? 'Tap Weapons' : svc[0].toUpperCase() + svc.slice(1);
              const extra = svc === 'blackmarket' ? ' svc-tab-blackmarket' : svc === 'guildhall' ? ' svc-tab-guildhall' : '';
              // M298: NEW badge for recently-shipped services
              const badgeKey = svc === 'blackmarket' ? 'black_market' : svc === 'blacksmith' ? 'forge' : svc === 'achievements' ? 'achievements' : null;
              const badge = badgeKey ? newBadgeIfRecent(badgeKey) : '';
              return `<button type="button" class="svc-tab${extra}${this._activeService===svc?' active':''}" data-svc="${svc}">${label}${badge}</button>`;
            }).join('')}
          </div>
          <div class="service-panel" id="service-panel">
            ${this._renderServiceContent()}
          </div>
        </main>

        <!-- RIGHT: Actions -->
        <aside class="town-actions-panel">
          <button type="button" class="action-btn action-primary" id="btn-map">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M1 6l7-3 8 4 7-3v14l-7 3-8-4-7 3V6z"/><path d="M8 3v14M16 7v14"/></svg>
            View Map
          </button>
          ${GameState.getPortal() ? '<button type="button" class="action-btn action-portal" id="btn-portal">\u2726 Return to Portal</button>' : ''}
          ${_isInfiniteDepthsUnlocked()
            ? `<button type="button" class="action-btn" id="btn-infinite" style="background:rgba(100,40,180,0.2);border-color:rgba(140,80,220,0.5);color:#d090ff">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M12 2l4 8 8 1-6 6 2 8-8-5-8 5 2-8-6-6 8-1z"/></svg>
                Infinite Depths
              </button>`
            : ''
          }
          <button type="button" class="action-btn" id="btn-inventory">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2M8 7V5a2 2 0 00-4 0v2"/></svg>
            Inventory
          </button>
          <button type="button" class="action-btn" id="btn-skills">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M12 2l3 10h10l-8 6 3 10-8-6-8 6 3-10-8-6h10z"/></svg>
            Skills
            ${getNotificationCount() > 0 ? `<span class="notif-badge">${getNotificationCount()}</span>` : ''}
          </button>
          <button type="button" class="action-btn" id="btn-tapinv">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M5 3l6 18 3-9 9-3L5 3z"/></svg>
            Tap Items
          </button>
          <button type="button" class="action-btn" id="btn-journal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
            Quests${QuestLogScreen.getCompletedCount && QuestLogScreen.getCompletedCount() > 0 ? ` <span class="notif-badge">${QuestLogScreen.getCompletedCount()}</span>` : ''}
          </button>
          <button type="button" class="action-btn" id="btn-menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Menu
          </button>
        </aside>
      </div>
      <div id="tt-el" class="item-tooltip" style="display:none"></div>
    `;

    this._renderPartyPanel();
    this._wireEvents();
  }

  _renderPartyPanel() {
    const gs = GameState.get();
    const partySlots = this._el.querySelector('#party-slots');
    const compSlots = this._el.querySelector('#companion-slots');

    for (let i = 0; i < 4; i++) {
      const member = gs.party[i];
      const slot = createEl('div', `party-slot${member ? ' ps-clickable' : ' empty'}`);
      if (member) {
        slot.dataset.memberId = member.id;
        slot.dataset.memberKind = 'party';
        const hp = member.maxHp || (50 + (member.attrs?.CON || 10) * 10);
        const hpCur = member.hp ?? hp;
        const mpMax = member.maxMp ?? 0;
        const mpCur = member.mp ?? 0;
        slot.innerHTML = `
          <div class="ps-portrait">${portraitImg(member, 56, '', 'town-party')}</div>
          <div class="ps-info">
            <div class="ps-name">${member.name} ${classIconSvg(member, 14, 'ps-class-icon')}</div>
            <div class="ps-class">${member.className || member.class} Lv${member.level}</div>
            <div class="ps-stats">HP ${Math.round(hpCur)}/${Math.round(hp)}${mpMax > 0 ? ` · MP ${Math.round(mpCur)}/${Math.round(mpMax)}` : ''}</div>
            <div class="ps-hp-bar"><div class="ps-hp-fill" style="width:${Math.max(0, Math.min(100, Math.round((hpCur/hp)*100)))}%"></div></div>
          </div>
        `;
      } else {
        slot.innerHTML = `<div class="ps-empty">Empty</div>`;
      }
      partySlots.appendChild(slot);
    }

    for (let i = 0; i < 4; i++) {
      const comp = gs.companions[i];
      const slot = createEl('div', `party-slot${comp ? ' ps-clickable' : ' empty'}`);
      if (comp) {
        slot.dataset.memberId = comp.id;
        slot.dataset.memberKind = 'companion';
        const petLabel = comp.isPet && comp.ownerName ? ` (${comp.ownerName}'s pet)` : '';
        // M223: companions now show HP bar + persisted current HP. maxHp is
        // derived on create and persisted in state; .hp is updated post-combat
        // and carried across save/load like party members.
        const hp = comp.maxHp || (40 + (comp.attrs?.CON || 10) * 8);
        const hpCur = comp.hp ?? hp;
        slot.innerHTML = `
          <div class="ps-portrait">${portraitImg(comp, 56, '', 'town-party')}</div>
          <div class="ps-info">
            <div class="ps-name">${comp.name}${petLabel}</div>
            <div class="ps-class">${comp.className}${comp.level ? ` Lv${comp.level}` : ''}</div>
            <div class="ps-stats">HP ${Math.round(hpCur)}/${Math.round(hp)}</div>
            <div class="ps-hp-bar"><div class="ps-hp-fill" style="width:${Math.max(0, Math.min(100, Math.round((hpCur/hp)*100)))}%"></div></div>
          </div>
        `;
      } else {
        slot.innerHTML = `<div class="ps-empty">Empty</div>`;
      }
      compSlots.appendChild(slot);
    }

    // M223: wire click → dropdown menu (Inventory / Skills / Manage Party).
    this._el.querySelectorAll('.ps-clickable').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showPartySlotMenu(el);
      });
    });
  }

  // M223: lightweight popover for party/companion slot actions.
  _showPartySlotMenu(anchorEl) {
    this._closePartySlotMenu();
    const memberId = anchorEl.dataset.memberId;
    if (!memberId) return;
    this.audio.playSfx('click');

    const menu = createEl('div', 'ps-menu');
    menu.innerHTML = `
      <button type="button" class="ps-menu-item" data-act="inventory">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2M8 7V5a2 2 0 00-4 0v2"/></svg>
        Inventory
      </button>
      <button type="button" class="ps-menu-item" data-act="skills">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M12 2l3 10h10l-8 6 3 10-8-6-8 6 3-10-8-6h10z"/></svg>
        Skills
      </button>
      <button type="button" class="ps-menu-item" data-act="party">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><circle cx="9" cy="8" r="4"/><path d="M3 21v-2a6 6 0 0112 0v2"/><circle cx="17" cy="8" r="3"/><path d="M15 21v-1a5 5 0 015-5"/></svg>
        Manage Party
      </button>
    `;
    // Position near the slot; fall back to fixed in top-right for mobile.
    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${Math.min(window.innerWidth - 180, rect.right + 6)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 160, rect.top)}px`;
    document.body.appendChild(menu);
    this._partySlotMenu = menu;

    // M312 #31: route through PartyPanelScreen with the appropriate tab.
    const goInventory = () => {
      const gs = GameState.get();
      gs.inventoryFocusId = memberId;
      this.manager.push(new PartyPanelScreen(this.manager, this.audio, { tab: 'inventory' }));
    };
    const goSkills = () => {
      const gs = GameState.get();
      gs.skillFocusId = memberId;
      this.manager.push(new PartyPanelScreen(this.manager, this.audio, { tab: 'spells' }));
    };
    const goParty = () => this.manager.push(new PartyPanelScreen(this.manager, this.audio, { tab: 'party' }));

    menu.querySelectorAll('.ps-menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.playSfx('click');
        const act = btn.dataset.act;
        this._closePartySlotMenu();
        if (act === 'inventory') goInventory();
        else if (act === 'skills') goSkills();
        else if (act === 'party') goParty();
      });
    });

    // Dismiss on outside click / escape.
    this._partySlotMenuDismiss = (ev) => {
      if (!menu.contains(ev.target)) this._closePartySlotMenu();
    };
    this._partySlotMenuKey = (ev) => { if (ev.key === 'Escape') this._closePartySlotMenu(); };
    // Defer to avoid catching the same click that opened the menu.
    setTimeout(() => {
      document.addEventListener('mousedown', this._partySlotMenuDismiss, true);
      document.addEventListener('touchstart', this._partySlotMenuDismiss, true);
      document.addEventListener('keydown', this._partySlotMenuKey);
    }, 0);
  }

  _closePartySlotMenu() {
    if (this._partySlotMenu) {
      this._partySlotMenu.remove();
      this._partySlotMenu = null;
    }
    if (this._partySlotMenuDismiss) {
      document.removeEventListener('mousedown', this._partySlotMenuDismiss, true);
      document.removeEventListener('touchstart', this._partySlotMenuDismiss, true);
      this._partySlotMenuDismiss = null;
    }
    if (this._partySlotMenuKey) {
      document.removeEventListener('keydown', this._partySlotMenuKey);
      this._partySlotMenuKey = null;
    }
  }

  _renderServiceContent() {
    switch (this._activeService) {
      case 'merchant':   return this._merchantHTML();
      case 'tavern':     return this._tavernHTML();
      case 'cleric':     return this._clericHTML();
      case 'blacksmith': return this._blacksmithHTML();
      case 'enchanter':  return this._enchanterHTML();
      case 'trainer':    return this._trainerHTML();
      case 'blackmarket':return this._blackMarketHTML();
      case 'guildhall':  return this._guildHallHTML();
      // 'forge' case retired — merged into Blacksmith as sub-tabs (Salvage | Craft | Upgrade).
      case 'tapweapons': return this._tapWeaponsHTML();
      default:           return this._townOverviewHTML();
    }
  }

  _tapWeaponsHTML() {
    const gs = GameState.get();
    const inv = gs.tapInventory || [];
    const stock = [
      { id: 'blade', cost: 0 },
      { id: 'rejuvenate', cost: 200 },
      { id: 'shield', cost: 300 },
      { id: 'enchant', cost: 250 },
    ];
    const gold = GameState.getGold();
    return `
      <div class="tavern-layout">
        <div class="svc-section-title">The Tap Weapons Vendor</div>
        <div class="bm-flavor">A wiry tinkerer with soot on her sleeves arranges tiny tools on a velvet cloth. "Clip one of these to your belt, love — a tap's all it takes."</div>
        <div class="hireable-list">
          ${stock.map(s => {
            const def = TAP_ALL[s.id];
            if (!def) return '';
            const owned = inv.includes(def.id);
            const canAfford = gold >= s.cost;
            const label = owned ? 'Owned' : (s.cost === 0 ? 'Take it' : `${s.cost} G`);
            return `
              <div class="hireable-card${owned ? ' hired' : ''}">
                <div class="hc-portrait"><canvas width="48" height="48" data-tap-icon="${def.id}" style="width:48px;height:48px"></canvas></div>
                <div class="hc-info">
                  <div class="hc-name" style="color:${def.effectColor}">${def.name} <span class="hc-class">${def.type}</span></div>
                  <div class="hc-desc">${def.description}</div>
                  <div class="hc-attrs">${def.cooldown.amount === 0 ? 'No cooldown' : `Cooldown: ${def.cooldown.amount} ${def.cooldown.unit}`}${def.power[1] > 0 ? ` · Power ${def.power[0]}-${def.power[1]}` : ''}</div>
                </div>
                <div class="hc-action">
                  ${owned ? '<span class="hired-badge">Owned</span>' :
                    `<button type="button" class="hire-btn${canAfford ? '' : ' disabled'}" data-buy-tap="${def.id}" data-cost="${s.cost}" ${canAfford ? '' : 'disabled'}>${label}</button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="bm-note">Exotic tap weapons are found only by defeating bosses or passing skill checks in the wild.</div>
      </div>
    `;
  }

  _townOverviewHTML() {
    const svcs = getTownConfig().services;
    const cards = {
      merchant:   { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="14" width="20" height="16" rx="2"/><path d="M12 14v-2a6 6 0 0112 0v2"/><path d="M8 20h20"/></svg>', name: 'Merchant', desc: 'Buy and sell equipment' },
      tavern:     { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 30V16l8-10 8 10v14"/><path d="M14 30v-8h8v8"/></svg>', name: 'Tavern', desc: 'Hire heroes & companions' },
      cleric:     { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6v24M6 18h24"/><circle cx="18" cy="18" r="4"/></svg>', name: 'Cleric', desc: 'Revive fallen members' },
      blacksmith: { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 26l16-16M22 8l6 6-4 4-6-6z"/><path d="M10 26l-4 4"/></svg>', name: 'Blacksmith', desc: 'Salvage, craft, and upgrade equipment' },
      enchanter:  { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 4l3 10h10l-8 6 3 10-8-6-8 6 3-10-8-6h10z"/></svg>', name: 'Enchanter', desc: 'Add magic enchantments' },
      trainer:    { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 18h24"/><path d="M10 12l-4 6 4 6M26 12l4 6-4 6"/><circle cx="18" cy="18" r="3"/></svg>', name: 'Trainer', desc: 'Respec attributes/skills/passives or level-up lower party members' },
      blackmarket:{ icon: '<svg viewBox="0 0 36 36" fill="none" stroke="#8060c0" stroke-width="1.5"><path d="M6 30l12-22 12 22z"/><circle cx="18" cy="22" r="3" fill="#8060c0"/><path d="M18 12v6"/></svg>', name: 'Black Market', desc: 'Shadowy, restricted goods' },
      // forge entry retired — merged into Blacksmith.
      guildhall:  { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="#e8d020" stroke-width="1.5"><path d="M6 30V14l12-8 12 8v16z"/><path d="M14 30v-8h8v8"/></svg>', name: 'Guild Hall', desc: 'Renowned heroes only — fame-gated gear' },
      tapweapons: { icon: '<svg viewBox="0 0 36 36" fill="none" stroke="#e8a040" stroke-width="1.5"><circle cx="18" cy="18" r="8"/><path d="M18 4v6M18 26v6M4 18h6M26 18h6"/></svg>', name: 'Tap Weapons', desc: 'Single-tap combat tools — weapons & utilities' },
    };
    return `
      <div class="overview-grid">
        ${svcs.map(svc => {
          const c = cards[svc];
          return c ? `<div class="overview-card" data-svc="${svc}"><div class="ov-icon">${c.icon}</div><div class="ov-name">${c.name}</div><div class="ov-desc">${c.desc}</div></div>` : '';
        }).join('')}
      </div>
    `;
  }

  _merchantHTML() {
    const gs = GameState.get();
    return `
      <div class="merchant-layout">
        <div class="merchant-stock">
          <div class="svc-section-title">For Sale</div>
          <div class="item-grid" id="merchant-items">
            ${this._merchantStock.map(item => `
              <div class="item-card" data-id="${item.id}" data-section="buy">
                <div class="ic-name" style="color:${`var(--rarity-${item.rarity})`}">${item.name}</div>
                <div class="ic-type">${item.subtype || item.type}</div>
                <div class="ic-stats">${item.dmg ? `${item.dmg[0]}-${item.dmg[1]} dmg` : item.armor ? `+${item.armor} armor` : ''}</div>
                <div class="ic-price">${this._itemPrice(item)} G</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="merchant-potions">
          <div class="svc-section-title">Potions &amp; Consumables</div>
          <div class="potion-grid" id="potion-items">
            ${POTION_STOCK.map(p => `
              <div class="potion-card">
                <div class="pc-icon">${p.icon}</div>
                <div class="pc-info">
                  <div class="pc-name">${p.name}</div>
                  <div class="pc-desc">${p.desc}</div>
                </div>
                <button type="button" class="hire-btn pc-buy${GameState.getGold() >= p.cost ? '' : ' disabled'}" data-buy-potion="${p.id}" data-cost="${p.cost}" ${GameState.getGold() >= p.cost ? '' : 'disabled'}>${p.cost} G</button>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="merchant-inventory">
          <div class="svc-section-title">Your Inventory (${gs.inventory.length} items)</div>
          <div class="item-grid" id="inventory-items">
            ${gs.inventory.length === 0 ? '<div class="empty-state">No items to sell.</div>' :
              gs.inventory.map(item => `
                <div class="item-card" data-id="${item.id}" data-section="sell">
                  <div class="ic-name" style="color:${`var(--rarity-${item.rarity})`}">${item.name}</div>
                  <div class="ic-type">${item.subtype || item.type}</div>
                  <div class="ic-price">Sell: ${Math.floor(this._itemPrice(item) * 0.4)} G</div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  _blackMarketHTML() {
    const gs = GameState.get();
    const partyLevel = gs.party?.[0]?.level || 1;
    if (partyLevel < BLACK_MARKET_MIN_LEVEL) {
      return `
        <div class="blackmarket-layout locked">
          <div class="bm-title">The Black Market</div>
          <div class="bm-locked">
            <div class="bm-locked-icon">\u2620</div>
            <div class="bm-locked-text">
              A hooded figure eyes your party and shakes their head.<br>
              <em>"Come back when you've made a name for yourself, stranger."</em>
            </div>
            <div class="bm-hint">Requires party leader level ${BLACK_MARKET_MIN_LEVEL}+ (you are ${partyLevel}).</div>
          </div>
        </div>
      `;
    }
    return `
      <div class="blackmarket-layout">
        <div class="bm-title">The Black Market</div>
        <div class="bm-flavor">Lanterns gutter in the alley. Goods here are not on any ledger. Prices run steep \u2014 and no refunds.</div>
        <div class="bm-stock">
          <div class="svc-section-title bm-section">Restricted Goods</div>
          <div class="item-grid" id="blackmarket-items">
            ${this._blackMarketStock.map(item => `
              <div class="item-card bm-card" data-id="${item.id}" data-section="bm-buy">
                <div class="ic-name" style="color:${`var(--rarity-${item.rarity})`}">${item.name}</div>
                <div class="ic-type">${item.blackMarketTag || item.subtype || item.type}</div>
                <div class="ic-stats">${item.dmg ? `${item.dmg[0]}-${item.dmg[1]} dmg` : item.armor ? `+${item.armor} armor` : ''}</div>
                <div class="ic-price bm-price">${this._blackMarketPrice(item)} G</div>
              </div>
            `).join('')}
            ${this._blackMarketStock.length === 0 ? '<div class="empty-state">Sold out. Return after resting.</div>' : ''}
          </div>
        </div>
        <div class="bm-note">Stock rotates whenever you rest at the cleric.</div>
      </div>
    `;
  }

  _guildHallHTML() {
    const fame = GameState.getFame();
    return `
      <div class="blackmarket-layout">
        <div class="bm-title" style="color:#e8d020">The Guild Hall</div>
        <div class="bm-flavor">Marble walls, banners of the great heroes who came before you. The quartermaster nods at your reputation and unrolls a private ledger.</div>
        <div class="bm-stock">
          <div class="svc-section-title">Renowned Goods (Fame: ${fame})</div>
          <div class="item-grid" id="guildhall-items">
            ${this._guildStock.map(item => {
              const locked = fame < item.fameRequired;
              const price = this._itemPrice(item) * 2;
              return `
              <div class="item-card${locked ? ' bm-locked' : ''}" data-id="${item.id}" data-section="${locked ? 'gh-locked' : 'gh-buy'}" style="${locked ? 'opacity:0.45;cursor:not-allowed' : ''}">
                <div class="ic-name" style="color:${`var(--rarity-${item.rarity})`}">${locked ? '🔒 ' : ''}Slot ${item.guildSlot}: ${item.name}</div>
                <div class="ic-type">${item.subtype || item.type}</div>
                <div class="ic-stats">${item.dmg ? `${item.dmg[0]}-${item.dmg[1]} dmg` : item.armor ? `+${item.armor} armor` : ''}</div>
                <div class="ic-price">${locked ? `Requires ${item.fameRequired} fame` : `${price} G`}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // M306 — Infinite Depths confirmation modal before entering.
  _showInfiniteDepthsConfirm() {
    const gs = GameState.get();
    const existingRun = gs.infiniteRun;
    const modal = createEl('div', 'fame-encounter-modal');
    modal.innerHTML = `
      <div class="fe-overlay"></div>
      <div class="fe-box" style="max-width:380px">
        <div class="fe-tier" style="color:#c080f0;font-size:0.85rem;letter-spacing:0.1em">POST-GAME MODE</div>
        <div class="fe-title" style="color:#c080f0">Infinite Depths</div>
        <div class="fe-body" style="color:#c0a0e0">
          ${existingRun
            ? `<p>An active run is waiting on Floor <strong style="color:#d090ff">${existingRun.floor}</strong>. Resume it or abandon it for a fresh start.</p>`
            : `<p>Descend into an ever-deepening rift where enemies grow stronger with each floor. There is no story — only the question of how far you can go.</p>`
          }
          <ul style="margin:0.5rem 0;padding-left:1.2rem;color:#a880c0;font-size:0.82rem;line-height:1.7">
            <li>Procedural floors — random enemies, floor effects, anchor bosses every 5 floors</li>
            <li>Loot scales with depth — legendary gear starts dropping past floor 20</li>
            <li>Death ends the run; all collected loot is kept</li>
            <li>Best runs recorded on the local leaderboard</li>
          </ul>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.5rem">
          ${existingRun
            ? `<button type="button" class="cem-btn" id="id-modal-resume" style="border-color:rgba(160,80,240,0.6);color:#d090ff">Resume Run (Floor ${existingRun.floor})</button>
               <button type="button" class="cem-btn" id="id-modal-new" style="border-color:rgba(192,64,32,0.5);color:#e08880;background:rgba(192,48,32,0.15)">Abandon and Start Fresh</button>`
            : `<button type="button" class="cem-btn" id="id-modal-enter" style="border-color:rgba(160,80,240,0.6);color:#d090ff">Enter the Depths</button>`
          }
          <button type="button" class="cem-btn" id="id-modal-cancel" style="background:transparent;border-color:rgba(240,232,216,0.2)">Cancel</button>
        </div>
      </div>
    `;
    this._el.appendChild(modal);

    modal.querySelector('#id-modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#id-modal-enter')?.addEventListener('click', () => {
      modal.remove();
      this.audio.playSfx('click');
      this._enterInfiniteDepths(false);
    });
    modal.querySelector('#id-modal-resume')?.addEventListener('click', () => {
      modal.remove();
      this.audio.playSfx('click');
      this._enterInfiniteDepths(false);
    });
    modal.querySelector('#id-modal-new')?.addEventListener('click', () => {
      modal.remove();
      this.audio.playSfx('click');
      // Clear existing run before entering.
      const gs2 = GameState.get();
      gs2.infiniteRun = null;
      this._enterInfiniteDepths(false);
    });
  }

  _enterInfiniteDepths(fresh) {
    import('./InfiniteDungeonScreen.js').then(({ InfiniteDungeonScreen }) => {
      this.manager.push(new InfiniteDungeonScreen(this.manager, this.audio));
    }).catch(e => {
      console.error('[TownScreen] failed to load InfiniteDungeonScreen', e);
    });
  }

  _maybeShowFameEncounter() {
    const gs = GameState.get();
    const fame = GameState.getFame();
    // M337 — fame is global since M327, so the encounter must also be global
    // (otherwise every new game on a 500+ fame account hands out a free
    // legendary). Track seen tiers in localStorage instead of per-save.
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem('rsg_fameEncountersSeen_v1') || '{}'); } catch (_) {}
    const persist = () => {
      try { localStorage.setItem('rsg_fameEncountersSeen_v1', JSON.stringify(seen)); } catch (_) {}
    };
    // Auto-mark Guild Hall unlock without firing the legacy reward popup —
    // 500 fame just opens the doors; the run can use the service freely.
    if (fame >= 500) gs.guildHallUnlocked = true;
    const tiers = [500, 250, 100];
    for (const t of tiers) {
      if (fame >= t && !seen[t]) {
        seen[t] = true;
        persist();
        this._showFameEncounter(t);
        return;
      }
    }
  }

  _showFameEncounter(tier) {
    const gs = GameState.get();
    let title, body, gift;
    // M337 — fame encounters now fire ONCE per account (gated globally) and
    // no longer hand out free items. Fame is a meta-progression currency
    // since M327, so item rewards on the per-save fame ladder leaked
    // overpowered gear into every new run that started with ≥100 fame.
    if (tier === 100) {
      title = 'A Stranger Approaches';
      body = 'A weathered traveler clasps your hand. "I\'ve heard your name in every tavern from here to the coast. Whatever you\'re after, you\'ll find allies along the road."';
    } else if (tier === 250) {
      title = 'A Noble\'s Gift';
      body = 'A messenger in fine livery presents a sealed letter. "From a noble who would remain unnamed — they wished you to know your deeds are watched, and admired."';
    } else {
      title = 'The Guildmaster Arrives';
      body = 'The Guildmaster of the Hidden Hall steps from the shadows. "Few mortals reach this stature. The Guild Hall opens its doors to you."';
      gs.guildHallUnlocked = true;
    }
    const modal = createEl('div', 'fame-encounter-modal');
    modal.innerHTML = `
      <div class="fe-overlay"></div>
      <div class="fe-box">
        <div class="fe-tier">★ ${tier} Fame ★</div>
        <div class="fe-title">${title}</div>
        <div class="fe-body">${body}</div>
        ${gift ? `<div class="fe-reward">Received: <span style="color:var(--rarity-${gift.rarity})">${gift.name}</span></div>` : ''}
        <button type="button" class="fe-btn">Accept</button>
      </div>
    `;
    if (!document.getElementById('fame-encounter-styles')) {
      const s = document.createElement('style');
      s.id = 'fame-encounter-styles';
      s.textContent = `.fame-encounter-modal{position:absolute;inset:0;z-index:600;display:flex;align-items:center;justify-content:center}.fe-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.8)}.fe-box{position:relative;z-index:1;background:#1a1218;border:2px solid #e8d020;border-radius:12px;padding:1.75rem;max-width:340px;width:90%;text-align:center;box-shadow:0 0 40px rgba(232,208,32,0.3)}.fe-tier{color:#e8d020;font-family:'Cinzel',serif;font-size:0.85rem;letter-spacing:0.2em;margin-bottom:0.5rem}.fe-title{color:#f0e8d8;font-family:'Cinzel',serif;font-size:1.2rem;font-weight:700;margin-bottom:0.75rem}.fe-body{color:#c0b090;font-size:0.85rem;line-height:1.55;margin-bottom:1rem;font-style:italic}.fe-reward{color:#90d8a8;font-size:0.85rem;margin-bottom:1.25rem}.fe-btn{background:#e8d020;color:#1a1218;border:none;padding:0.65rem 2rem;border-radius:6px;font-weight:700;font-family:'Cinzel',serif;cursor:pointer;min-height:44px}.fe-btn:hover{background:#fff060}`;
      document.head.appendChild(s);
    }
    this._fameEncounterModal = modal;
    modal.querySelector('.fe-btn').addEventListener('click', () => {
      this.audio.playSfx('victory');
      this._fameEncounterModal = null;
      removeEl(modal);
      this._refreshAll();
      // M176: if multiple fame tiers were eligible on the same visit, chain them
      // back-to-back so the player doesn't have to leave and return.
      this._maybeShowFameEncounter();
    });
    this.manager.uiOverlay.appendChild(modal);
    this.audio.playSfx('levelup');
  }

  _doForgeSalvage(itemId) {
    const gs = GameState.get();
    const item = (gs.inventory || []).find(i => i.id === itemId);
    if (!item) return;
    const gained = salvageItem(item);
    GameState.removeFromInventory(itemId);
    GameState.addMaterials(gained);
    GameState.setFlag && GameState.setFlag('used_forge', true);
    const parts = Object.entries(gained).map(([id, n]) => `${n}\u00D7 ${MATERIALS[id]?.name || id}`).join(', ');
    this._forgeMsg = `Salvaged ${item.name} \u2192 ${parts}`;
    this.audio.playSfx('click');
    this._refreshServicePanel();
  }

  _doForgeCraft(recipeId) {
    const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    const mats = GameState.getMaterials ? GameState.getMaterials() : (GameState.get().materials || {});
    if (!canCraft(recipe, mats)) return;
    deductMaterials(recipe, mats);
    // Weapon craft slots randomize base within their damage category so
    // "Rare Weapon (Magic)" isn't always a staff.
    const CAT_BY_SLOT = { weapon_heavy: 'heavy', weapon_light: 'light', weapon_magic: 'magic' };
    const cat = CAT_BY_SLOT[recipe.craftSlot];
    const baseKey = cat ? (randomWeaponBaseByCategory(cat) || recipe.base) : recipe.base;
    const item = generateItem(baseKey, recipe.rarity, recipe.quality);
    if (item) {
      GameState.addToInventory(item);
      this._maybeShowAutoEquipToast(GameState._lastAutoEquip);
      this._forgeMsg = `Forged: ${item.name}!`;
      this.audio.playSfx('craft');
    }
    GameState.setFlag && GameState.setFlag('used_forge', true);
    this._refreshServicePanel();
  }

  /**
   * M307 — Craft a unique item from a boss-kill-unlocked recipe.
   */
  _doUniqueRecipeCraft(uniqueId) {
    const recipe = UNIQUE_RECIPES.find(r => r.uniqueId === uniqueId);
    if (!recipe) return;
    const gs = GameState.get();
    const mats = GameState.getMaterials ? GameState.getMaterials() : (gs.materials || {});
    // Verify all materials present
    const matOk = Object.entries(recipe.materials).every(([matId, needed]) => (mats[matId] || 0) >= needed);
    if (!matOk) { this._blacksmithMsg = 'Not enough materials.'; this._refreshServicePanel(); return; }
    if (recipe.goldCost && GameState.getGold() < recipe.goldCost) {
      this._blacksmithMsg = `Not enough gold (need ${recipe.goldCost} G).`;
      this._refreshServicePanel();
      return;
    }
    // Deduct materials
    for (const [matId, needed] of Object.entries(recipe.materials)) {
      mats[matId] = (mats[matId] || 0) - needed;
    }
    if (recipe.goldCost) GameState.addGold(-recipe.goldCost);
    // Generate the unique item
    const item = generateUnique(uniqueId);
    if (item) {
      GameState.addToInventory(item);
      this._maybeShowAutoEquipToast(GameState._lastAutoEquip);
      this._blacksmithMsg = `Forged unique item: ${item.name}!`;
      this.audio.playSfx('craft');
    } else {
      this._blacksmithMsg = 'Could not generate unique item — unknown id.';
    }
    GameState.setFlag && GameState.setFlag('used_forge', true);
    this._refreshServicePanel();
  }

  _blackMarketPrice(item) {
    // 1.5x \u2013 2x normal merchant price.
    const base = this._itemPrice(item);
    const mult = 1.5 + ((item.blackMarketTag === 'forbidden' || item.rarity === 'legendary') ? 0.5 : 0.35);
    return Math.round(base * mult);
  }

  _itemPrice(item) {
    const qualityMults = { low:0.5, medium:1, high:1.5, elite:2.5, exotic:4 };
    const rarityMults  = { normal:1, magic:2, rare:4, legendary:10 };
    return Math.round(15 * (qualityMults[item.quality]||1) * (rarityMults[item.rarity]||1));
  }

  _tavernHTML() {
    const gs = GameState.get();
    const gold = GameState.getGold();
    const cfg = getTownConfig();
    const roster = getTavernRosterForTown(cfg.townId, cfg.act);
    this._lastTavernRoster = roster; // M242: cache so hire-click can find rolled templates
    this._townId = cfg.townId; // M279: needed by hire-click to record depletion in gs.tavernHired
    const hires = roster.hires;
    const comps = roster.companions;
    return `
      <div class="tavern-layout">
        <div class="svc-section-title">Heroes for Hire</div>
        <div class="hireable-list">
          ${hires.length === 0 ? '<div class="empty-state" style="padding:0.75rem;color:#8a7a6a;font-style:italic">No more heroes available here. Travel to another town to find more recruits.</div>' : ''}
          ${hires.map(h => {
            const alreadyInParty = gs.party.find(p => p.id === h.id || p.templateId === h.id);
            const alreadyOnBench = gs.bench.find(p => p.id === h.id || p.templateId === h.id);
            const cost = _hireableCost(h); // M412 — uniform 100g × level
            const canAfford = gold >= cost;
            return `
              <div class="hireable-card${alreadyInParty||alreadyOnBench?' hired':''}">
                <div class="hc-portrait">${portraitImg(h, 40, '', 'town-hire')}</div>
                <div class="hc-info">
                  <div class="hc-name">${h.name} <span class="hc-class">${this._getClassSvg(h.class)} ${h.className} Lv${h.level}</span></div>
                  <div class="hc-desc">${h.description}</div>
                  ${h.personalityNote ? `<div class="hc-personality">🎭 ${h.personalityNote}</div>` : ''}
                  <div class="hc-attrs">STR ${h.attrs.STR} · DEX ${h.attrs.DEX} · INT ${h.attrs.INT} · CON ${h.attrs.CON}</div>
                </div>
                <div class="hc-action">
                  ${alreadyInParty ? '<span class="hired-badge">In Party</span>' :
                    alreadyOnBench  ? '<span class="hired-badge">At Bench</span>' :
                    `<button type="button" class="hire-btn${canAfford?'':' disabled'}" data-hire="${h.id}" data-cost="${cost}" ${h.appearance ? `data-appearance="${h.appearance}"` : ''} ${canAfford?'':'disabled'}>
                      Hire <br><small>${cost} G</small>
                    </button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="svc-section-title" style="margin-top:1.5rem;display:flex;align-items:center;justify-content:space-between">
          <span>Custom Hire</span>
          <button type="button" class="hire-btn" id="btn-custom-hire" style="font-size:0.72rem;padding:0.35rem 0.75rem;min-height:36px" ${gold < 100 ? 'disabled' : ''}>Hire Custom…</button>
        </div>
        <div style="font-size:0.72rem;color:#8a7a6a;margin-bottom:1rem">Design your own hero. Requires 100 G minimum.</div>
        <div class="svc-section-title" style="margin-top:0.5rem">Companions for Purchase</div>
        <div class="hireable-list">
          ${comps.map(c => {
            const alreadyHired = gs.companions.find(p => p.id === c.id || p.templateId === c.id);
            const cost = _companionCost(c); // M412 — power tier × 100
            const power = _companionPower(c);
            const canAfford = gold >= cost;
            const powerStars = '★'.repeat(power) + '☆'.repeat(Math.max(0, 5 - power));
            return `
              <div class="hireable-card${alreadyHired?' hired':''}">
                <div class="hc-portrait">${portraitImg(c, 40, '', 'town-hire')}</div>
                <div class="hc-info">
                  <div class="hc-name">${c.name} <span class="hc-class">${c.className}</span></div>
                  <div class="hc-desc">${c.description}</div>
                  <div class="hc-power" style="font-size:0.72rem;color:#e8a020;margin-top:0.2rem">Power: <span style="letter-spacing:0.1em">${powerStars}</span> <span style="color:#8a7a6a">(scales to party level)</span></div>
                </div>
                <div class="hc-action">
                  ${alreadyHired ? '<span class="hired-badge">Purchased</span>' :
                    `<button type="button" class="hire-btn${canAfford?'':' disabled'}" data-hire="${c.id}" data-cost="${cost}" data-companion="true" ${canAfford?'':'disabled'}>
                      Buy <br><small>${cost} G</small>
                    </button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // M399 — Trainer service. Unlocks at Act 2 (gating handled by the town's
  // services list above). Lets the player:
  //   - Respec attributes / skills / passives — cost = (level × 50) gold
  //     per pool reset.
  //   - Level up a lower-level party member to current max party level —
  //     cost = (max_level − current_level) × 100 gold.
  //   - Swap the chosen build preset (free; rolls auto-allocator off the
  //     new targets next time the player respecs attrs).
  _trainerHTML() {
    const gs = GameState.get();
    // M412 — companions don't level via the trainer; they auto-scale to party
    // average. Show only real party heroes in the target picker.
    const all = (gs.party || []).filter(m => m && !(m.isCompanion || m.class === 'companion'));
    const gold = GameState.getGold();
    const maxLvl = all.reduce((m, x) => Math.max(m, x?.level || 1), 1);
    const targetId = this._trainerTargetId || all[0]?.id;
    const target = all.find(m => m.id === targetId) || all[0];
    if (!target) {
      return '<div class="trainer-empty" style="padding:1rem;color:#a89878">No party members to train.</div>';
    }
    const lvl = target.level || 1;
    const respecCost = lvl * 50;
    const lvlUpCost = Math.max(0, (maxLvl - lvl) * 100);
    const status = this._trainerMsg || '';
    const buildList = getClassBuilds(target.class) || [];
    return `
      <div class="trainer-layout" style="display:flex;flex-direction:column;gap:0.6rem;padding:0.5rem">
        <div style="font-size:0.78rem;color:#c8b8a8;line-height:1.4">
          The trainer can reset your attribute, skill, or passive choices, swap your build preset, or hire intensive lessons that bring a lower-level member up to the rest of the party. All resets cost gold scaled to the member's level.
        </div>

        <div class="trainer-target" style="display:flex;gap:0.4rem;flex-wrap:wrap;padding:0.4rem;background:rgba(20,14,36,0.5);border:1px solid rgba(232,160,32,0.3);border-radius:4px">
          <strong style="font-family:'Cinzel',serif;color:#e8c840;font-size:0.85rem;align-self:center;margin-right:0.4rem">Member:</strong>
          ${all.map(m => `<button type="button" class="trainer-target-btn${m.id === target.id ? ' selected' : ''}" data-trainer-target="${m.id}" style="font-size:0.72rem;padding:0.2rem 0.5rem;background:${m.id === target.id ? 'rgba(232,200,64,0.25)' : 'rgba(0,0,0,0.4)'};border:1px solid ${m.id === target.id ? '#e8c840' : 'rgba(255,255,255,0.18)'};border-radius:3px;color:#f0e8d8;cursor:pointer;font-family:inherit">${m.name} L${m.level || 1}</button>`).join('')}
        </div>

        <div class="trainer-card" style="padding:0.55rem 0.7rem;background:rgba(20,14,36,0.5);border:1px solid rgba(232,160,32,0.3);border-radius:4px;display:flex;flex-direction:column;gap:0.45rem">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-family:'Cinzel',serif;color:#e8c840">Respec</strong><span style="color:#a89878;font-size:0.7rem">L${lvl} × 50 = ${respecCost}G each</span></div>
          <button type="button" class="trainer-btn" data-trainer-action="respec-attrs" ${gold < respecCost ? 'disabled' : ''} style="padding:0.5rem;background:rgba(232,160,32,0.12);border:1px solid rgba(232,160,32,0.45);color:#e8a020;border-radius:4px;cursor:${gold < respecCost ? 'not-allowed' : 'pointer'};font-family:inherit;font-size:0.78rem">Respec Attributes — ${respecCost}G</button>
          <button type="button" class="trainer-btn" data-trainer-action="respec-skills" ${gold < respecCost ? 'disabled' : ''} style="padding:0.5rem;background:rgba(232,160,32,0.12);border:1px solid rgba(232,160,32,0.45);color:#e8a020;border-radius:4px;cursor:${gold < respecCost ? 'not-allowed' : 'pointer'};font-family:inherit;font-size:0.78rem">Respec Skill Picks — ${respecCost}G</button>
          <button type="button" class="trainer-btn" data-trainer-action="respec-passives" ${gold < respecCost ? 'disabled' : ''} style="padding:0.5rem;background:rgba(232,160,32,0.12);border:1px solid rgba(232,160,32,0.45);color:#e8a020;border-radius:4px;cursor:${gold < respecCost ? 'not-allowed' : 'pointer'};font-family:inherit;font-size:0.78rem">Respec Passives — ${respecCost}G</button>
        </div>

        <div class="trainer-card" style="padding:0.55rem 0.7rem;background:rgba(20,14,36,0.5);border:1px solid rgba(232,160,32,0.3);border-radius:4px;display:flex;flex-direction:column;gap:0.4rem">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-family:'Cinzel',serif;color:#e8c840">Level Up</strong><span style="color:#a89878;font-size:0.7rem">${lvl < maxLvl ? `${maxLvl - lvl} level${maxLvl - lvl !== 1 ? 's' : ''} × 100 = ${lvlUpCost}G` : 'already at party max'}</span></div>
          <button type="button" class="trainer-btn" data-trainer-action="level-up-1" ${lvl >= maxLvl || gold < 100 ? 'disabled' : ''} style="padding:0.5rem;background:rgba(120,200,80,0.12);border:1px solid rgba(120,200,80,0.45);color:#90d870;border-radius:4px;cursor:${lvl >= maxLvl || gold < 100 ? 'not-allowed' : 'pointer'};font-family:inherit;font-size:0.78rem">+1 Level — 100G</button>
          <button type="button" class="trainer-btn" data-trainer-action="level-up" ${lvl >= maxLvl || gold < lvlUpCost ? 'disabled' : ''} style="padding:0.5rem;background:rgba(120,200,80,0.12);border:1px solid rgba(120,200,80,0.45);color:#90d870;border-radius:4px;cursor:${lvl >= maxLvl || gold < lvlUpCost ? 'not-allowed' : 'pointer'};font-family:inherit;font-size:0.78rem">Bring to Level ${maxLvl} — ${lvlUpCost}G</button>
        </div>

        ${buildList.length ? `<div class="trainer-card" style="padding:0.55rem 0.7rem;background:rgba(20,14,36,0.5);border:1px solid rgba(160,80,255,0.3);border-radius:4px;display:flex;flex-direction:column;gap:0.4rem">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-family:'Cinzel',serif;color:#c8a8ff">Build Preset</strong><span style="color:#a89878;font-size:0.7rem">free swap (re-attune attrs separately)</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:0.3rem">
            ${buildList.map(b => `<button type="button" class="trainer-btn" data-trainer-build="${b.id}" style="padding:0.35rem 0.6rem;background:${target.build === b.id ? 'rgba(160,80,255,0.30)' : 'rgba(160,80,255,0.10)'};border:1px solid ${target.build === b.id ? '#c8a8ff' : 'rgba(160,80,255,0.45)'};color:#c8a8ff;border-radius:3px;cursor:pointer;font-family:inherit;font-size:0.72rem">${b.name}</button>`).join('')}
          </div>
        </div>` : ''}

        ${status ? `<div class="trainer-msg" style="font-size:0.78rem;color:#90d870;padding:0.4rem;background:rgba(80,160,40,0.1);border:1px solid rgba(80,160,40,0.3);border-radius:3px">${status}</div>` : ''}
      </div>
    `;
  }

  _wireTrainer() {
    const root = this._el;
    if (!root) return;
    root.querySelectorAll('[data-trainer-target]').forEach(b => {
      b.addEventListener('click', () => {
        this.audio?.playSfx?.('click');
        this._trainerTargetId = b.dataset.trainerTarget;
        this._trainerMsg = '';
        this._refreshServicePanel();
      });
    });
    root.querySelectorAll('[data-trainer-action]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        this.audio?.playSfx?.('click');
        const action = b.dataset.trainerAction;
        this._handleTrainerAction(action);
      });
    });
    root.querySelectorAll('[data-trainer-build]').forEach(b => {
      b.addEventListener('click', () => {
        this.audio?.playSfx?.('click');
        this._handleTrainerBuild(b.dataset.trainerBuild);
      });
    });
  }

  _handleTrainerAction(action) {
    const gs = GameState.get();
    const all = [...(gs.party || []), ...(gs.companions || [])];
    const target = all.find(m => m.id === this._trainerTargetId) || all[0];
    if (!target) return;
    const lvl = target.level || 1;
    const cost = lvl * 50;
    if (action === 'respec-attrs') {
      if (GameState.getGold() < cost) { this._trainerMsg = 'Not enough gold.'; this._refreshServicePanel(); return; }
      GameState.addGold(-cost);
      // Reset attrs to base 8 each + return spent points to the pending pool.
      const a = target.attrs || { STR:8, DEX:8, INT:8, CON:8 };
      const spent = (a.STR-8) + (a.DEX-8) + (a.INT-8) + (a.CON-8);
      target.attrs = { STR: 8, DEX: 8, INT: 8, CON: 8 };
      target.pendingAttrPoints = (target.pendingAttrPoints || 0) + Math.max(0, spent);
      this._trainerMsg = `${target.name}: ${spent} attribute points refunded for ${cost}G.`;
    } else if (action === 'respec-skills') {
      if (GameState.getGold() < cost) { this._trainerMsg = 'Not enough gold.'; this._refreshServicePanel(); return; }
      GameState.addGold(-cost);
      const had = (target.skills || []).filter(Boolean).length;
      target.skills = [];
      target.pendingSkillPoints = (target.pendingSkillPoints || 0) + had;
      this._trainerMsg = `${target.name}: ${had} skill picks refunded for ${cost}G.`;
    } else if (action === 'respec-passives') {
      if (GameState.getGold() < cost) { this._trainerMsg = 'Not enough gold.'; this._refreshServicePanel(); return; }
      GameState.addGold(-cost);
      const had = Object.keys(target.talentsPurchased || {}).length;
      target.talentsPurchased = {};
      target.pendingPassivePoints = (target.pendingPassivePoints || 0) + had;
      this._trainerMsg = `${target.name}: ${had} passive picks refunded for ${cost}G.`;
    } else if (action === 'level-up' || action === 'level-up-1') {
      // M412 — companions don't have player-level — they scale to party avg
      // automatically. Block trainer level-up for them.
      if (target.isCompanion || target.class === 'companion') {
        this._trainerMsg = 'Companions auto-scale to party level — no training needed.';
        this._refreshServicePanel();
        return;
      }
      const maxLvl = all.filter(m => !(m?.isCompanion || m?.class === 'companion'))
                        .reduce((m, x) => Math.max(m, x?.level || 1), 1);
      if (lvl >= maxLvl) { this._trainerMsg = 'Already at party max.'; this._refreshServicePanel(); return; }
      const gain = action === 'level-up-1' ? 1 : (maxLvl - lvl);
      const upCost = gain * 100;
      // M412 — was GameState.spendGold (doesn't exist) → addGold(-N).
      if (GameState.getGold() < upCost) { this._trainerMsg = 'Not enough gold.'; this._refreshServicePanel(); return; }
      GameState.addGold(-upCost);
      target.level = lvl + gain;
      target.pendingAttrPoints = (target.pendingAttrPoints || 0) + gain * 5;
      target.pendingSkillPoints = (target.pendingSkillPoints || 0) + gain;
      target.pendingPassivePoints = (target.pendingPassivePoints || 0) + gain;
      // Top up XP to the level threshold (lazy — just zero it; the next fight tops up via leveling code).
      target.xp = 0;
      this._trainerMsg = `${target.name}: trained from L${lvl} to L${target.level} for ${upCost}G.`;
    }
    this._refreshServicePanel();
  }

  _handleTrainerBuild(buildId) {
    const gs = GameState.get();
    const all = [...(gs.party || []), ...(gs.companions || [])];
    const target = all.find(m => m.id === this._trainerTargetId) || all[0];
    if (!target) return;
    target.build = buildId;
    this._trainerMsg = `${target.name}: build set to ${buildId}. Respec attributes to apply the new distribution.`;
    this._refreshServicePanel();
  }

  _clericHTML() {
    const gs = GameState.get();
    const all = [...gs.party, ...gs.companions];
    const fallen = all.filter(m => m.hp <= 0 || m.dead);
    const injured = all.filter(m => m.hp > 0 && m.hp < (m.maxHp || 100));
    const gold = GameState.getGold();
    // M236: Hard-difficulty cleric pricing. On Normal the cleric is free
    // (matches the "hidden HP bar in town" model). On Hard, rest costs a
    // per-party-member fee and revive charges based on the character's
    // hire cost baseline.
    const isHard = (() => { try { return localStorage.getItem('emberveil_difficulty') === 'hard'; } catch (_) { return false; } })();
    // M382 — Hardcore mode: revive is permanently disabled. The Cleric will
    // still rest the living party, but fallen heroes stay dead per the
    // hardcore contract.
    const isHardcore = !!gs.hardcore;
    const restCost = isHard ? all.filter(m => m.hp > 0 && m.hp < (m.maxHp || 100)).length * 25 : 0;
    const reviveBaseCost = 50;
    const reviveCostFor = (m) => {
      if (!isHard) return reviveBaseCost;
      // Hard: scale revive by member level + original cost if available.
      const base = m.cost || (m.level || 1) * 30;
      return Math.max(reviveBaseCost, Math.round(base * 0.5));
    };
    const allFull = injured.length === 0 && fallen.length === 0;
    return `
      <div class="cleric-layout">
        <div class="svc-section-title">Cleric of the Light — Services${isHard ? ' <span style="color:#c04030;font-size:0.7rem">(Hard)</span>' : ''}</div>
        <!-- Rest / Heal -->
        <div class="cleric-service-block">
          <div class="csb-title">Rest &amp; Recover</div>
          <div class="csb-desc">${allFull ? 'Your party is fully healed and rested.' : (isHard ? `Restore all HP and MP. <strong>${restCost} G</strong>.` : 'Restore all HP and MP. <strong>Free.</strong>')}</div>
          ${!allFull ? `<button type="button" class="hire-btn${gold>=restCost?'':' disabled'}" id="btn-rest" ${gold>=restCost?'':'disabled'}>${isHard ? `Rest (${restCost} G)` : 'Rest (Free)'}</button>` : ''}
        </div>
        <!-- Revive -->
        <div class="svc-section-title" style="margin-top:1rem">Revive${isHardcore ? ' — <span style="color:#c04030">DISABLED (Hardcore)</span>' : (isHard ? ' — cost scales with hero level' : ` — ${reviveBaseCost} G per hero`)}</div>
        ${isHardcore ? `<div class="empty-state" style="padding:1rem;text-align:center;color:#c04030">In Hardcore mode, the fallen stay fallen. The Cleric will not raise the dead.</div>` :
          (fallen.length === 0 ? '<div class="empty-state" style="padding:1rem;text-align:center;color:#8a7a6a">All party members are alive.</div>' :
          fallen.map(m => {
            const cost = reviveCostFor(m);
            return `
            <div class="hireable-card">
              <div class="hc-portrait">${portraitImg(m, 40, '', 'town-hire')}</div>
              <div class="hc-info">
                <div class="hc-name">${m.name}</div>
                <div class="hc-desc" style="color:#c04030">Has fallen in battle.</div>
              </div>
              <div class="hc-action">
                <button type="button" class="hire-btn${gold>=cost?'':' disabled'}" data-revive="${m.id}" data-cost="${cost}" ${gold>=cost?'':'disabled'}>
                  Revive<br><small>${cost} G</small>
                </button>
              </div>
            </div>
          `;}).join(''))
        }
        ${isHardcore ? '' : `<div class="cleric-note" style="margin-top:0.5rem">Reviving restores a fallen hero to 25% HP.</div>`}
      </div>
    `;
  }

  _showSaveModal() {
    const modal = createEl('div', 'save-modal');
    modal.innerHTML = `
      <div class="sm-overlay"></div>
      <div class="sm-box">
        <div class="sm-title">Save Game</div>
        <div class="sm-slots">
          <button type="button" class="sm-slot-btn" data-slot="current">
            <span class="smsb-num">Current save</span>
            <span class="smsb-info">Overwrite</span>
          </button>
          <button type="button" class="sm-slot-btn" data-slot="new">
            <span class="smsb-num">New save</span>
            <span class="smsb-info">Create copy</span>
          </button>
        </div>
        <button type="button" class="sm-cancel" id="sm-cancel">Cancel</button>
      </div>
    `;
    modal.querySelector('#sm-cancel').addEventListener('click', () => removeEl(modal));
    modal.querySelector('.sm-overlay').addEventListener('click', () => removeEl(modal));
    modal.querySelectorAll('.sm-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.slot === 'new') {
          // Force a new auto-named save
          const gs = (GameState.get ? GameState.get() : null);
          if (gs) gs.currentSaveKey = null;
          SaveManager.saveCurrentGame();
        } else {
          SaveManager.saveCurrentGame();
        }
        this.audio.playSfx('victory');
        removeEl(modal);
        this._showNotif('Game saved!');
      });
    });
    this.manager.uiOverlay.appendChild(modal);

    if (!document.getElementById('save-modal-styles')) {
      const s = document.createElement('style');
      s.id = 'save-modal-styles';
      s.textContent = `.save-modal{position:absolute;inset:0;z-index:500;display:flex;align-items:center;justify-content:center}.sm-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.75)}.sm-box{position:relative;z-index:1;background:#1a1218;border:1px solid rgba(232,160,32,0.3);border-radius:12px;padding:2rem;min-width:280px;max-width:340px;width:90%}.sm-title{font-family:'Cinzel',serif;font-size:1.2rem;font-weight:700;color:#e8a020;margin-bottom:1.25rem;text-align:center}.sm-slots{display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1.25rem}.sm-slot-btn{display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:rgba(26,18,24,0.9);border:1px solid rgba(232,160,32,0.15);border-radius:6px;color:#f0e8d8;cursor:pointer;min-height:48px;transition:border-color 0.15s}.sm-slot-btn:hover{border-color:rgba(232,160,32,0.5)}.smsb-num{font-size:0.75rem;color:#8a7a6a}.smsb-info{font-size:0.82rem;font-family:'Cinzel',serif;font-weight:600}.sm-cancel{width:100%;padding:0.65rem;background:none;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#8a7a6a;cursor:pointer;font-size:0.82rem}.sm-cancel:hover{color:#f0e8d8}`;
      document.head.appendChild(s);
    }
  }

  _showNotif(msg) {
    const n = createEl('div', 'save-notif');
    n.textContent = msg;
    n.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(232,160,32,0.9);color:#0a0608;padding:0.5rem 1.25rem;border-radius:20px;font-weight:700;font-size:0.85rem;z-index:600;pointer-events:none;animation:notifIn 0.3s ease';
    const s = document.createElement('style');
    s.textContent = '@keyframes notifIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
    this._el.appendChild(n);
    setTimeout(() => removeEl(n), 2000);
  }

  _getEquippedItemsList() {
    const gs = GameState.get();
    const all = [...(gs.party||[]), ...(gs.companions||[])];
    const out = [];
    for (const m of all) {
      const eqp = m.equipment || {};
      for (const [slot, item] of Object.entries(eqp)) {
        if (item) out.push({ item, slot, owner: m });
      }
    }
    return out;
  }

  // M71: roll new affixes for slots unlocked by a quality upgrade.
  // Quality bonus slots: low/medium 0, high +1, elite +1, exotic +2.
  _rollExtraAffixes(item, oldQuality) {
    const QUAL_SLOT_BONUS = { low:0, medium:0, high:1, elite:1, exotic:2 };
    const oldBonus = QUAL_SLOT_BONUS[oldQuality] || 0;
    const newBonus = QUAL_SLOT_BONUS[item.quality] || 0;
    const delta = newBonus - oldBonus;
    if (delta <= 0) return;
    const pool = [...AFFIXES_ACT1.prefixes, ...AFFIXES_ACT1.suffixes];
    if (!item.affixes) item.affixes = [];
    for (let i = 0; i < delta; i++) {
      let pick, attempts = 0;
      do {
        pick = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
      } while (item.affixes.find(a => a.id === pick.id) && attempts < 20);
      if (!item.affixes.find(a => a.id === pick.id)) {
        const value = +(pick.min + Math.random() * (pick.max - pick.min)).toFixed(2);
        item.affixes.push({ ...pick, value });
      }
    }
  }

  /**
   * Blacksmith — three sub-tabs:
   *   salvage : break unequipped gear into crafting materials (migrated from Forge).
   *   craft   : spend materials on recipes → a new item (migrated from Forge).
   *   upgrade : spend 2 same-quality materials to add 1 matching-quality affix.
   * All three share the same materials currency (iron_scrap, magic_essence,
   * rare_dust, legend_core). No gold is used by any blacksmith tab.
   */
  _blacksmithHTML() {
    // Keep _forgeTab in lock-step for the legacy delegated handler below.
    this._forgeTab = this._blacksmithTab === 'craft' ? 'craft' : 'salvage';
    const gs = GameState.get();
    // M307: sync tier-unlocks whenever Blacksmith is opened (level/act may have advanced).
    syncTierUnlocks(gs);
    const mats = GameState.getMaterials ? GameState.getMaterials() : (gs.materials || {});
    // Show both original and exotic crafting materials.
    const allMats = { ...MATERIALS, ...CRAFTING_MATERIALS };
    const matsHTML = Object.values(allMats).map(m => {
      const count = mats[m.id] || 0;
      if (count === 0) return ''; // hide zero-count exotic mats to reduce noise
      return `<div class="forge-mat-chip">${m.icon} ${m.name}: <strong>${count}</strong></div>`;
    }).join('') || Object.values(MATERIALS).map(m => {
      const count = mats[m.id] || 0;
      return `<div class="forge-mat-chip${count === 0 ? ' forge-mat-zero' : ''}">${m.icon} ${m.name}: <strong>${count}</strong></div>`;
    }).join('');

    let body = '';
    if (this._blacksmithTab === 'salvage') body = this._blacksmithSalvageBody();
    else if (this._blacksmithTab === 'unique') body = this._blacksmithUniqueBody(mats, gs);
    else body = this._blacksmithCraftBody(mats, gs);

    return `
      <div class="bs-panel">
        <div class="bs-title">Blacksmith — Forged in Ember</div>
        <div class="bs-subtitle">Salvage unused gear or craft equipment. Unique recipes unlock on boss kill.</div>
        <div class="forge-inline">
          <div class="svc-section-title">Materials</div>
          <div class="forge-mats">${matsHTML}</div>
          <div class="forge-sub-tabs">
            <button type="button" class="forge-sub-tab${this._blacksmithTab === 'salvage' ? ' active' : ''}" data-bs-tab="salvage">Salvage</button>
            <button type="button" class="forge-sub-tab${this._blacksmithTab === 'craft' ? ' active' : ''}" data-bs-tab="craft">Craft</button>
            <button type="button" class="forge-sub-tab${this._blacksmithTab === 'unique' ? ' active' : ''}" data-bs-tab="unique">Unique</button>
          </div>
          <div class="bs-sub-body">${body}</div>
          ${this._blacksmithMsg ? `<div class="forge-msg">${this._blacksmithMsg}</div>` : ''}
        </div>
      </div>
    `;
  }

  _blacksmithSalvageBody() {
    const gs = GameState.get();
    const salvageable = (gs.inventory || []).filter(it => !it.equipped);
    if (salvageable.length === 0) {
      return `<div class="forge-empty">No unequipped items to salvage.</div>`;
    }
    // M256: Salvage All button acts on every unequipped item currently
    // in the list. Shown only when there's at least one item.
    const header = `<div class="forge-salvage-all-row"><button type="button" class="forge-salvage-btn forge-salvage-all" id="forge-salvage-all">Salvage All (${salvageable.length})</button></div>`;
    return header + salvageable.map(item => {
      const rarCol = `var(--rarity-${item.rarity})`;
      const yld = { normal:'2-4 Iron Scrap', magic:'1-2 Scrap + 1-2 Essence', rare:'1-3 Essence + 1-2 Rare Dust', legendary:'1-2 Rare Dust + 1 Legend Core' }[item.rarity] || '';
      return `<div class="forge-inv-item"><div class="forge-inv-name"><div style="color:${rarCol}">${item.name}</div><div class="forge-inv-yield">Yields: ${yld}</div></div><button type="button" class="forge-salvage-btn" data-forge-salvage="${item.id}">Salvage</button></div>`;
    }).join('');
  }

  _blacksmithCraftBody(mats, gs) {
    // M307: show tier-unlocked, player-unlocked common recipes.
    // white=always, magic=level5+, rare=level10+/act2+.
    const _gs = gs || GameState.get();
    const allMats = { ...MATERIALS, ...CRAFTING_MATERIALS };
    const TIER_LABEL = { white:'Basic', magic:'Magic', rare:'Rare' };
    const TIER_COL   = { white:'#d0c8b0', magic:'#6a9fff', rare:'#e8c070' };

    // M416 — surface how many of this recipe the player can make right now.
    // Returns the min ratio of (have / need) across every material requirement
    // and gold, floored. Zero means "not craftable".
    const maxCrafts = (recipe) => {
      let n = Infinity;
      for (const [matId, needed] of Object.entries(recipe.materials || {})) {
        n = Math.min(n, Math.floor((mats[matId] || 0) / needed));
      }
      if (recipe.goldCost) n = Math.min(n, Math.floor(GameState.getGold() / recipe.goldCost));
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    };
    const renderCommon = (recipe) => {
      const n = maxCrafts(recipe);
      const craftable = n > 0;
      const needGold = recipe.goldCost || 0;
      const costParts = Object.entries(recipe.materials).map(([matId, needed]) => {
        const have = mats[matId] || 0;
        const mat = allMats[matId];
        const ok = have >= needed;
        return `<span class="${ok ? 'ok' : 'no'}">${mat?.icon || ''} ${mat?.name || matId}: ${have}/${needed}</span>`;
      });
      if (needGold) {
        const hasGold = GameState.getGold() >= needGold;
        costParts.push(`<span class="${hasGold ? 'ok' : 'no'}" title="Gold cost">⛀ ${needGold}</span>`);
      }
      // M416 — "Craft (N)" badge shows how many are available given current mats+gold.
      const label = craftable ? `⚒ Craft${n > 1 ? ` <span class="forge-craft-count">(${n})</span>` : ''}` : '⚒ Craft';
      return `<div class="forge-recipe"><div class="forge-recipe-name">${recipe.name}</div><div class="forge-recipe-cost">${costParts.join(' · ')}</div><button type="button" class="forge-craft-btn" data-forge-craft="${recipe.id}" data-forge-craft-type="common" ${craftable ? '' : 'disabled'}>${label}</button></div>`;
    };

    const newTiers = ['white', 'magic', 'rare'];
    const newCols = newTiers.map(tier => {
      if (!isTierUnlocked(tier, _gs)) {
        const lockMsg = tier === 'magic' ? 'Unlocks at Level 5' : 'Unlocks at Level 10 or Act II';
        return `<div class="forge-col"><div class="forge-col-head" style="color:${TIER_COL[tier]}">${TIER_LABEL[tier]}</div><div class="forge-empty" style="font-size:0.75rem;opacity:0.6">${lockMsg}</div></div>`;
      }
      const recipes = COMMON_RECIPES.filter(r => r.tier === tier && isRecipeUnlocked(r.id, _gs));
      if (!recipes.length) return '';
      const header = `<div class="forge-col-head" style="color:${TIER_COL[tier]}">${TIER_LABEL[tier]}</div>`;
      return `<div class="forge-col">${header}${recipes.map(renderCommon).join('')}</div>`;
    }).filter(Boolean).join('');

    // Legacy CRAFT_RECIPES (generic slot craft — still usable).
    const TIER_COL2 = { magic:'#6a9fff', rare:'#e8c070', legendary:'#ff8040' };
    const TIER_LABEL2 = { magic:'Magic Gear', rare:'Rare Gear', legendary:'Legendary Gear' };
    const renderLegacy = (recipe) => {
      const canMake = canCraft(recipe, mats);
      // M416 — count is min(material ratios) since legacy recipes have no gold cost.
      let n = Infinity;
      for (const [matId, needed] of Object.entries(recipe.materials || {})) {
        n = Math.min(n, Math.floor((mats[matId] || 0) / needed));
      }
      n = Number.isFinite(n) ? Math.max(0, n) : 0;
      const costParts = Object.entries(recipe.materials).map(([matId, needed]) => {
        const have = mats[matId] || 0;
        const mat = MATERIALS[matId];
        const ok = have >= needed;
        return `<span class="${ok ? 'ok' : 'no'}">${mat?.icon || ''} ${mat?.name || matId}: ${have}/${needed}</span>`;
      });
      const label = canMake ? `⚒ Craft${n > 1 ? ` <span class="forge-craft-count">(${n})</span>` : ''}` : '⚒ Craft';
      return `<div class="forge-recipe"><div class="forge-recipe-name">${recipe.name}</div><div class="forge-recipe-cost">${costParts.join(' · ')}</div><button type="button" class="forge-craft-btn" data-forge-craft="${recipe.id}" ${canMake ? '' : 'disabled'}>${label}</button></div>`;
    };
    const legacyCols = ['magic', 'rare', 'legendary'].map(tier => {
      const recipes = CRAFT_RECIPES.filter(r => r.rarity === tier);
      if (!recipes.length) return '';
      return `<div class="forge-col"><div class="forge-col-head" style="color:${TIER_COL2[tier]}">${TIER_LABEL2[tier]}</div>${recipes.map(renderLegacy).join('')}</div>`;
    }).filter(Boolean).join('');

    return `<div class="forge-cols">${newCols}${legacyCols}</div>`;
  }

  /**
   * M307 — Unique crafting tab body.
   * Shows unique recipes unlocked by boss kills / lore nodes.
   */
  _blacksmithUniqueBody(mats, gs) {
    const _gs = gs || GameState.get();
    const allMats = { ...MATERIALS, ...CRAFTING_MATERIALS };
    const unlocked = getCraftingRecipesUnlocked(_gs);
    const unlockedRecipes = UNIQUE_RECIPES.filter(r => unlocked.has(r.uniqueId));

    if (unlockedRecipes.length === 0) {
      return `<div class="forge-empty">No unique recipes unlocked yet.<br>Defeat major bosses to unlock legendary crafting recipes.</div>`;
    }

    const renderOne = (recipe) => {
      const matOk = Object.entries(recipe.materials).every(([matId, needed]) =>
        (mats[matId] || 0) >= needed
      );
      const hasGold = !recipe.goldCost || GameState.getGold() >= recipe.goldCost;
      const craftable = matOk && hasGold;
      const costParts = Object.entries(recipe.materials).map(([matId, needed]) => {
        const have = mats[matId] || 0;
        const mat = allMats[matId];
        const ok = have >= needed;
        return `<span class="${ok ? 'ok' : 'no'}">${mat?.icon || ''} ${mat?.name || matId}: ${have}/${needed}</span>`;
      });
      if (recipe.goldCost) {
        costParts.push(`<span class="${hasGold ? 'ok' : 'no'}">Gold: ${GameState.getGold()}/${recipe.goldCost}</span>`);
      }
      return `
        <div class="forge-recipe forge-recipe-unique">
          <div class="forge-recipe-name" style="color:#ff8040">${recipe.name}</div>
          <div class="forge-recipe-cost">${costParts.join(' · ')}</div>
          <button type="button" class="forge-craft-btn forge-craft-unique-btn"
            data-forge-craft-unique="${recipe.uniqueId}" ${craftable ? '' : 'disabled'}>⚒ Forge Unique</button>
        </div>`;
    };

    return `<div class="forge-unique-list">${unlockedRecipes.map(renderOne).join('')}</div>`;
  }

  /**
   * Upgrade tab: spend 2 materials of a tier → add 1 affix of that tier.
   * Tier mapping (material → affix tier):
   *   iron_scrap   → normal   (cost 2 iron_scrap)
   *   magic_essence→ magic    (cost 2 magic_essence)
   *   rare_dust    → rare     (cost 2 rare_dust)
   *   legend_core  → legendary(cost 2 legend_core)
   * Each tier scales the base affix value: normal 1.0x / magic 1.5x /
   *   rare 2.0x / legendary 3.0x.
   * Button is disabled if the item is already at its rarity affix cap.
   */
  _blacksmithUpgradeBody(mats) {
    const inv = GameState.get().inventory || [];
    const equipped = this._getEquippedItemsList();

    const tiers = this._affixTierDefs();
    const maxAffixes = item => (
      item.rarity === 'legendary' ? 6 :
      item.rarity === 'rare'      ? 4 :
      item.rarity === 'magic'     ? 2 : 0
    );
    // M184: build a short preview of the affix pool for each tier so players
    // know roughly what they'll roll. Random pick from AFFIXES_ACT1, values
    // scale by tier.mult.
    const poolPreview = (item, tier) => {
      const existing = new Set((item.affixes || []).map(a => a.id));
      const pool = [...AFFIXES_ACT1.prefixes, ...AFFIXES_ACT1.suffixes]
        .filter(a => !existing.has(a.id));
      const sample = pool.slice(0, 8).map(a => {
        const lo = +(a.min * tier.mult).toFixed(2);
        const hi = +(a.max * tier.mult).toFixed(2);
        return `${a.name} (${a.stat} +${lo}\u2013${hi})`;
      });
      const more = pool.length > 8 ? `, +${pool.length - 8} more` : '';
      return sample.length
        ? `Possible affixes: ${sample.join(', ')}${more}`
        : 'No new affixes available — already has every type.';
    };

    const renderUpgradeable = (item, eqRef = null, ownerName = '') => {
      const count = (item.affixes || []).length;
      const cap = maxAffixes(item);
      const atMax = cap > 0 && count >= cap;
      const unsupported = cap === 0;
      const eqAttr = eqRef ? ` data-eq="${eqRef}"` : '';
      const subtitle = unsupported
        ? `<div class="bs-isub">${item.rarity} rarity cannot hold affixes \u2014 upgrade rarity first at the Enchanter.</div>`
        : atMax
          ? `<div class="bs-isub" title="This item already has the maximum ${cap} affixes for its ${item.rarity} rarity.">${item.rarity} \u00B7 ${count}/${cap} affixes (max reached)</div>`
          : `<div class="bs-isub">${item.rarity} \u00B7 ${count}/${cap} affixes</div>`;
      return `
        <div class="bs-item">
          <div class="bs-iname" style="color:${`var(--rarity-${item.rarity})`}">${item.name}${ownerName ? ` <small style="color:#8a7a6a">(${ownerName})</small>` : ''}</div>
          ${subtitle}
          <div class="bs-actions">
            ${tiers.map(t => {
              const have = mats[t.matId] || 0;
              const afford = have >= 2;
              const title = atMax
                ? `title="Item has reached its ${cap}-affix cap. Upgrade its rarity at the Enchanter to add more."`
                : unsupported
                  ? `title="Normal items have no affix slots. Upgrade rarity at the Enchanter first."`
                  : !afford
                    ? `title="Needs 2\u00D7 ${t.matName} (you have ${have}).&#10;${poolPreview(item, t).replace(/"/g, '&quot;')}"`
                    : `title="Spend 2\u00D7 ${t.matName} to add one ${t.label} affix.&#10;${poolPreview(item, t).replace(/"/g, '&quot;')}"`;
              const disabled = atMax || unsupported || !afford;
              return `<button type="button" class="bs-btn" data-bs-upgrade="${t.matId}" data-id="${item.id}"${eqAttr} ${title} ${disabled ? 'disabled' : ''}>+${t.label} Affix <small>(2\u00D7 ${t.matIcon})</small></button>`;
            }).join('')}
          </div>
        </div>`;
    };

    const byOwner = {};
    for (const row of equipped) {
      const k = row.owner.id;
      if (!byOwner[k]) byOwner[k] = { owner: row.owner, rows: [] };
      byOwner[k].rows.push(row);
    }
    const equippedHTML = Object.values(byOwner).map(grp => `
      <div class="svc-section-title">Equipped by ${grp.owner.name}</div>
      <div class="bs-items">${grp.rows.map(({ item, slot, owner }) => renderUpgradeable(item, `${owner.id}|${slot}`, slot)).join('')}</div>
    `).join('');
    const invHTML = inv.length
      ? `<div class="svc-section-title">Inventory</div><div class="bs-items">${inv.map(i => renderUpgradeable(i)).join('')}</div>`
      : '';

    if (!equippedHTML && !invHTML) {
      return `<div class="forge-empty">No items to upgrade. Loot some gear first.</div>`;
    }
    return `${equippedHTML}${invHTML}`;
  }

  /** Tiered affix definitions used by the Upgrade tab. */
  _affixTierDefs() {
    return [
      { matId: 'iron_scrap',    matName: 'Iron Scrap',    matIcon: MATERIALS.iron_scrap.icon,    label: 'Normal',    tier: 'normal',    mult: 1.0 },
      { matId: 'magic_essence', matName: 'Magic Essence', matIcon: MATERIALS.magic_essence.icon, label: 'Magic',     tier: 'magic',     mult: 1.5 },
      { matId: 'rare_dust',     matName: 'Rare Dust',     matIcon: MATERIALS.rare_dust.icon,     label: 'Rare',      tier: 'rare',      mult: 2.0 },
      { matId: 'legend_core',   matName: 'Legendary Core',matIcon: MATERIALS.legend_core.icon,   label: 'Legendary', tier: 'legendary', mult: 3.0 },
    ];
  }

  /** Apply a material-tier upgrade to a single item. */
  _doBlacksmithUpgrade(matId, item) {
    if (!item) return;
    const tier = this._affixTierDefs().find(t => t.matId === matId);
    if (!tier) return;
    const mats = GameState.getMaterials ? GameState.getMaterials() : (GameState.get().materials || {});
    if ((mats[matId] || 0) < 2) return;
    const cap = item.rarity === 'legendary' ? 6 : item.rarity === 'rare' ? 4 : item.rarity === 'magic' ? 2 : 0;
    if (cap === 0 || (item.affixes || []).length >= cap) return;

    // Pick an affix the item doesn't already have.
    const pool = [...AFFIXES_ACT1.prefixes, ...AFFIXES_ACT1.suffixes];
    const existing = new Set((item.affixes || []).map(a => a.id));
    const candidates = pool.filter(a => !existing.has(a.id));
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const rawValue = pick.min + Math.random() * (pick.max - pick.min);
    const value = +(rawValue * tier.mult).toFixed(2);
    item.affixes = item.affixes || [];
    item.affixes.push({ ...pick, value });

    // Burn the materials.
    mats[matId] = (mats[matId] || 0) - 2;

    // Rebuild display name so the new affix surfaces in the title.
    const baseName = item.baseName || item.name
      .replace(/^(Sturdy|Swift|Wise|Hardy|Sharp|Reinforced|Leeching|Siphoning)\s+/, '')
      .replace(/\s+of\s+[A-Z][\w\s]+$/, '');
    item.baseName = baseName;
    const prefixIds = new Set(AFFIXES_ACT1.prefixes.map(p => p.id));
    const suffixIds = new Set(AFFIXES_ACT1.suffixes.map(s => s.id));
    const prefix = item.affixes.find(a => prefixIds.has(a.id));
    const suffix = item.affixes.find(a => suffixIds.has(a.id));
    let displayName = baseName;
    if (prefix) displayName = `${prefix.name} ${displayName}`;
    if (suffix) displayName = `${displayName} ${suffix.name}`;
    item.name = displayName;

    GameState.setFlag && GameState.setFlag('used_forge', true);
    GameState.setFlag && GameState.setFlag('used_blacksmith', true);
    try { checkGameStateAchievements(); } catch (_) {}
    this._blacksmithMsg = `Added ${tier.label} affix \u201C${pick.name}\u201D to ${item.name}.`;
    this.audio.playSfx('craft');
    this._refreshAll();
  }

  /**
   * Enchanter — two sub-tabs (M182):
   *   affix  : spend 2 tier-matching materials → add one affix of that tier.
   *   rarity : spend 3 materials of the target tier → promote item rarity
   *            (normal→magic→rare→legendary). Opens affix slots.
   * Shares the Blacksmith material currency (iron_scrap, magic_essence,
   * rare_dust, legend_core). No gold.
   */
  _enchanterHTML() {
    const mats = GameState.getMaterials ? GameState.getMaterials() : (GameState.get().materials || {});
    const matsHTML = Object.values(MATERIALS).map(m => {
      const count = mats[m.id] || 0;
      return `<div class="forge-mat-chip${count === 0 ? ' forge-mat-zero' : ''}">${m.icon} ${m.name}: <strong>${count}</strong></div>`;
    }).join('');

    let body = '';
    if (this._enchanterTab === 'rarity') body = this._enchanterRarityBody(mats);
    else body = this._enchanterAffixBody(mats);

    return `
      <div class="bs-panel">
        <div class="bs-title">Enchanter — Threads of Power</div>
        <div class="bs-subtitle">Add properties to items, or promote their rarity to unlock new affix slots.</div>
        <div class="forge-inline">
          <div class="svc-section-title">Materials</div>
          <div class="forge-mats">${matsHTML}</div>
          <div class="forge-sub-tabs">
            <button type="button" class="forge-sub-tab${this._enchanterTab === 'affix' ? ' active' : ''}" data-enc-tab="affix">Add Property</button>
            <button type="button" class="forge-sub-tab${this._enchanterTab === 'rarity' ? ' active' : ''}" data-enc-tab="rarity">Upgrade Rarity</button>
          </div>
          <div class="bs-sub-body" id="enc-affix-body">${body}</div>
          ${this._enchanterMsg ? `<div class="forge-msg">${this._enchanterMsg}</div>` : this._blacksmithMsg ? `<div class="forge-msg">${this._blacksmithMsg}</div>` : ''}
          <div id="enc-preview-tooltip" class="enc-preview-tt" style="display:none"></div>
        </div>
      </div>
    `;
  }

  /**
   * M313 #30 — Enchanter "Add Property" tab redesigned as a 3-step wizard:
   *   Step 1: pick item (grid)
   *   Step 2: pick affix property (grid of available affixes)
   *   Step 3: pick tier/material (final confirm)
   *
   * Replaces the old flat list with per-item tier buttons and big "?" buttons.
   * "?" help icons are now small (16px) inline tooltips.
   */
  _enchanterAffixBody(mats) {
    const step = this._encStep || 'item';
    const maxAffixesFor = item => (
      item.rarity === 'legendary' ? 6 :
      item.rarity === 'rare'      ? 4 :
      item.rarity === 'magic'     ? 2 : 0
    );

    // --- Step 1: Item picker grid ---
    if (step === 'item') {
      const inv = GameState.get().inventory || [];
      const equipped = this._getEquippedItemsList();
      const allItems = [
        ...equipped.map(r => ({ item: r.item, eqRef: `${r.owner.id}|${r.slot}`, ownerName: r.slot })),
        ...inv.map(i => ({ item: i, eqRef: null, ownerName: '' })),
      ];
      if (allItems.length === 0) {
        return `<div class="forge-empty">No items to enchant. Loot some gear first.</div>`;
      }
      const cards = allItems.map(({ item, eqRef, ownerName }) => {
        const cap = maxAffixesFor(item);
        const count = (item.affixes || []).length;
        const atMax = cap > 0 && count >= cap;
        const unsupported = cap === 0;
        const dimmed = atMax || unsupported;
        const badge = unsupported ? 'Needs rarity upgrade'
          : atMax ? `Full (${count}/${cap})`
          : `${count}/${cap} affixes`;
        return `<button type="button" class="enc-pick-card${dimmed ? ' enc-pick-dim' : ''}"
            data-enc-pick-item="${encodeURIComponent(JSON.stringify({ id: item.id, eqRef: eqRef || '', ownerName: ownerName || '' }))}"
            ${unsupported || atMax ? 'disabled' : ''}
            title="${item.name}">
          <div class="enc-pick-name" style="color:var(--rarity-${item.rarity})">${item.name}</div>
          <div class="enc-pick-sub">${item.rarity}${ownerName ? ` · ${ownerName}` : ''}</div>
          <div class="enc-pick-badge${atMax || unsupported ? ' enc-pick-badge-warn' : ''}">${badge}</div>
        </button>`;
      }).join('');
      return `<div class="enc-step-label">Step 1 — Choose an item to enchant</div>
        <div class="enc-pick-grid">${cards}</div>`;
    }

    // --- Step 2: Property picker grid ---
    if (step === 'property') {
      const sel = this._encSelectedItem;
      if (!sel) { this._encStep = 'item'; return this._enchanterAffixBody(mats); }
      const { item } = sel;
      const existing = new Set((item.affixes || []).map(a => a.id));
      const pool = [...AFFIXES_ACT1.prefixes, ...AFFIXES_ACT1.suffixes].filter(a => !existing.has(a.id));
      if (!pool.length) {
        return `<div class="enc-step-nav">
          <button type="button" class="bs-btn enc-back-btn" data-enc-back="item">Back</button>
          <span style="color:#8a7a6a;font-size:0.8rem">This item already has every available affix type.</span>
        </div>`;
      }
      const cards = pool.map(a => {
        const lo = +(a.min * 1.0).toFixed(1);
        const hi = +(a.max * 1.0).toFixed(1);
        const val = a.max <= 1 ? `${Math.round(lo*100)}–${Math.round(hi*100)}%` : `+${lo}–${hi}`;
        return `<button type="button" class="enc-pick-card enc-prop-card" data-enc-pick-affix="${a.id}" title="${a.name}: ${val}">
          <div class="enc-pick-name">${a.name}</div>
          <div class="enc-pick-sub">${val} ${(a.stat||'').toUpperCase()}</div>
        </button>`;
      }).join('');
      const currentAffixes = (item.affixes || []).length > 0
        ? item.affixes.map(a => {
            const vStr = typeof a.value === 'number' && a.value < 1 && a.value > -1 ? `${Math.round(a.value*100)}%` : `+${a.value}`;
            return `<span class="enc-cur-chip">${a.name} <strong>${vStr}</strong></span>`;
          }).join('')
        : '<span style="color:#8a7a6a;font-size:0.72rem">No affixes yet.</span>';
      return `<div class="enc-step-nav">
          <button type="button" class="bs-btn enc-back-btn" data-enc-back="item">Back</button>
          <span class="enc-step-label">Step 2 — Choose a property to add</span>
        </div>
        <div class="enc-selected-item">
          <span style="color:var(--rarity-${item.rarity});font-weight:700">${item.name}</span>
          <span class="enc-cur-affixes-row">${currentAffixes}</span>
        </div>
        <div class="enc-pick-grid enc-prop-grid">${cards}</div>`;
    }

    // --- Step 3: Tier/material picker ---
    if (step === 'tier') {
      const sel = this._encSelectedItem;
      const affixId = this._encSelectedAffix;
      if (!sel || !affixId) { this._encStep = 'item'; return this._enchanterAffixBody(mats); }
      const { item, eqRef } = sel;
      const tiers = this._affixTierDefs();
      const affix = [...AFFIXES_ACT1.prefixes, ...AFFIXES_ACT1.suffixes].find(a => a.id === affixId);
      if (!affix) { this._encStep = 'item'; return this._enchanterAffixBody(mats); }
      const eqAttr = eqRef ? ` data-eq="${eqRef}"` : '';
      const tierCards = tiers.map(t => {
        const have = mats[t.matId] || 0;
        const afford = have >= 2;
        const lo = +(affix.min * t.mult).toFixed(1);
        const hi = +(affix.max * t.mult).toFixed(1);
        const val = affix.max <= 1 ? `${Math.round(lo*100)}–${Math.round(hi*100)}%` : `+${lo}–${hi}`;
        return `<button type="button" class="enc-pick-card enc-tier-card${afford ? '' : ' enc-pick-dim'}"
            data-bs-upgrade="${t.matId}" data-id="${item.id}"${eqAttr} data-enc-confirm="1"
            ${afford ? '' : 'disabled'}
            title="${afford ? `Spend 2x ${t.matName}` : `Need 2x ${t.matName} (have ${have})`}">
          <div class="enc-pick-name">${t.label} <small style="opacity:0.7">(2x ${t.matIcon})</small></div>
          <div class="enc-pick-sub">${affix.name}: ${val} ${(affix.stat||'').toUpperCase()}</div>
          <div class="enc-pick-badge${afford ? '' : ' enc-pick-badge-warn'}">${afford ? `Have: ${have}` : `Need 2 (have ${have})`}</div>
        </button>`;
      }).join('');
      return `<div class="enc-step-nav">
          <button type="button" class="bs-btn enc-back-btn" data-enc-back="property">Back</button>
          <span class="enc-step-label">Step 3 — Choose quality tier</span>
        </div>
        <div class="enc-selected-item">
          <span style="color:var(--rarity-${item.rarity});font-weight:700">${item.name}</span>
          <span style="color:#c0b090;margin-left:0.5rem">+ ${affix.name}</span>
        </div>
        <div class="enc-pick-grid">${tierCards}</div>`;
    }

    return `<div class="forge-empty">No items to enchant.</div>`;
  }

  /** Rarity-upgrade definitions — materials required for each promotion. */
  _rarityUpgradeDefs() {
    return {
      normal: { next: 'magic',     matId: 'magic_essence', matName: 'Magic Essence', matIcon: MATERIALS.magic_essence.icon, cost: 3 },
      magic:  { next: 'rare',      matId: 'rare_dust',     matName: 'Rare Dust',     matIcon: MATERIALS.rare_dust.icon,     cost: 3 },
      rare:   { next: 'legendary', matId: 'legend_core',   matName: 'Legendary Core',matIcon: MATERIALS.legend_core.icon,   cost: 3 },
    };
  }

  _enchanterRarityBody(mats) {
    const inv = GameState.get().inventory || [];
    const equipped = this._getEquippedItemsList();
    const defs = this._rarityUpgradeDefs();

    const renderPromotable = (item, eqRef = null, ownerName = '') => {
      const def = defs[item.rarity];
      const atMax = !def;
      const eqAttr = eqRef ? ` data-eq="${eqRef}"` : '';
      const subtitle = atMax
        ? `<div class="bs-isub">${item.rarity} · already at maximum rarity</div>`
        : `<div class="bs-isub">${item.rarity} → ${def.next}</div>`;
      let btn = '';
      if (!atMax) {
        const have = mats[def.matId] || 0;
        const afford = have >= def.cost;
        const title = afford
          ? `title="Spend ${def.cost}× ${def.matName} to promote from ${item.rarity} to ${def.next}."`
          : `title="Needs ${def.cost}× ${def.matName} (you have ${have})."`;
        btn = `<button type="button" class="bs-btn" data-enc-rarity="${item.id}"${eqAttr} ${title} ${afford ? '' : 'disabled'}>Promote to ${def.next} <small>(${def.cost}× ${def.matIcon})</small></button>`;
      }
      return `
        <div class="bs-item">
          <div class="bs-iname" style="color:${`var(--rarity-${item.rarity})`}">${item.name}${ownerName ? ` <small style="color:#8a7a6a">(${ownerName})</small>` : ''}</div>
          ${subtitle}
          <div class="bs-actions">${btn}</div>
        </div>`;
    };

    const byOwner = {};
    for (const row of equipped) {
      const k = row.owner.id;
      if (!byOwner[k]) byOwner[k] = { owner: row.owner, rows: [] };
      byOwner[k].rows.push(row);
    }
    const equippedHTML = Object.values(byOwner).map(grp => `
      <div class="svc-section-title">Equipped by ${grp.owner.name}</div>
      <div class="bs-items">${grp.rows.map(({ item, slot, owner }) => renderPromotable(item, `${owner.id}|${slot}`, slot)).join('')}</div>
    `).join('');
    const invHTML = inv.length
      ? `<div class="svc-section-title">Inventory</div><div class="bs-items">${inv.map(i => renderPromotable(i)).join('')}</div>`
      : '';

    if (!equippedHTML && !invHTML) {
      return `<div class="forge-empty">No items to upgrade. Loot some gear first.</div>`;
    }
    return `${equippedHTML}${invHTML}`;
  }

  /**
   * M295 — Show enchanter before/after preview tooltip.
   * Called on info button click (mobile) or hover (desktop via pointer event).
   * @param {HTMLElement} anchorEl - the info button that triggered the show
   * @param {string} previewKey - "${itemId}||${matId}"
   */
  _showEnchanterPreview(anchorEl, previewKey) {
    const ttEl = this._el?.querySelector('#enc-preview-tooltip');
    if (!ttEl) return;

    const [itemId, matId] = (previewKey || '').split('||');
    if (!itemId || !matId) { ttEl.style.display = 'none'; return; }

    // Find the item
    const gs = GameState.get();
    const allItems = [
      ...(gs.inventory || []),
      ...this._getEquippedItemsList().map(r => r.item),
    ];
    const item = allItems.find(i => i.id === itemId);
    if (!item) { ttEl.style.display = 'none'; return; }

    const tiers = this._affixTierDefs();
    const tier = tiers.find(t => t.matId === matId);
    if (!tier) { ttEl.style.display = 'none'; return; }

    // Current affixes
    const curHTML = (item.affixes || []).length > 0
      ? item.affixes.map(a => {
          const vStr = typeof a.value === 'number' && a.value < 1 && a.value > -1
            ? `${Math.round(a.value * 100)}%` : `+${a.value}`;
          return `<div class="enc-tt-row enc-tt-cur"><span class="enc-tt-stat">${a.name}</span><span class="enc-tt-val" style="color:#80a8ff">${vStr} ${(a.stat||'').toUpperCase()}</span></div>`;
        }).join('')
      : '<div class="enc-tt-row" style="color:#8a7a6a;font-size:0.72em">No affixes yet.</div>';

    // Possible additions
    const existing = new Set((item.affixes || []).map(a => a.id));
    const pool = [...AFFIXES_ACT1.prefixes, ...AFFIXES_ACT1.suffixes].filter(a => !existing.has(a.id));
    const sampleHTML = pool.slice(0, 6).map(a => {
      const lo = +(a.min * tier.mult).toFixed(2);
      const hi = +(a.max * tier.mult).toFixed(2);
      const vStr = a.max <= 1 ? `${Math.round(lo*100)}–${Math.round(hi*100)}%` : `+${lo}–${hi}`;
      return `<div class="enc-tt-row"><span class="enc-tt-stat">${a.name}</span><span class="enc-tt-val">${vStr} ${a.stat?.toUpperCase() || ''}</span></div>`;
    }).join('');
    const moreNote = pool.length > 6 ? `<div class="enc-tt-more">+${pool.length - 6} more in pool</div>` : '';
    const costNote = `<div style="font-size:0.66rem;color:rgba(200,160,80,0.6);margin-top:0.35rem">Cost: 2x ${tier.matIcon} ${tier.matName}</div>`;

    ttEl.innerHTML = `
      <div class="enc-preview-tt-head">${item.name} — ${tier.label} Enchant Preview</div>
      <div class="enc-preview-tt-section">Current Properties</div>
      ${curHTML}
      <div class="enc-preview-tt-section">Possible Additions</div>
      ${sampleHTML}${moreNote}
      ${costNote}
    `;
    ttEl.style.display = 'block';
  }

  _doEnchanterRarityUpgrade(item) {
    if (!item) return;
    const defs = this._rarityUpgradeDefs();
    const def = defs[item.rarity];
    if (!def) return;
    const mats = GameState.getMaterials ? GameState.getMaterials() : (GameState.get().materials || {});
    if ((mats[def.matId] || 0) < def.cost) return;
    mats[def.matId] = (mats[def.matId] || 0) - def.cost;
    item.rarity = def.next;
    GameState.setFlag && GameState.setFlag('used_enchanter', true);
    try { checkGameStateAchievements(); } catch (_) {}
    this._enchanterMsg = `Promoted ${item.name} to ${def.next} rarity.`;
    this.audio.playSfx('spell');
    this._refreshAll();
  }

  _getClassSvg(classId) {
    const cls = CLASSES.find(c => c.id === classId);
    return cls?.svgIcon || `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="18" r="12"/></svg>`;
  }

  _wireEvents() {
    // svc-tab and overview-card clicks are handled by delegated listeners in _wireServiceEvents

    // Map button
    this._el.querySelector('#btn-map')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new MapScreen(this.manager, this.audio));
    });

    // Portal return button
    this._el.querySelector('#btn-portal')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      const portal = GameState.getPortal();
      if (portal) {
        const gs = GameState.get();
        gs.zoneId = portal.zoneId;
        gs.nodeId = portal.nodeId;
        this.manager.push(new MapScreen(this.manager, this.audio));
      }
    });

    // Set Out button removed — use Map button instead

    // Inventory
    // M312 #31: Inventory + Party buttons route to PartyPanelScreen with correct initial tab.
    this._el.querySelector('#btn-inventory')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new PartyPanelScreen(this.manager, this.audio, { tab: 'inventory' })); });
    this._el.querySelector('#btn-tapinv')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new TapInventoryScreen(this.manager, this.audio)); });
    // Skills
    this._el.querySelector('#btn-skills')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new PartyPanelScreen(this.manager, this.audio, { tab: 'spells' })); });
    // Save
    this._el.querySelector('#btn-save')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._showSaveModal();
    });
    this._el.querySelector('#btn-journal')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new QuestLogScreen(this.manager, this.audio)); });
    this._el.querySelector('#btn-menu')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new GameMenuScreen(this.manager, this.audio)); });
    this._el.querySelector('#btn-achievements')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new AchievementsScreen(this.manager, this.audio)); });
    // M312 #31: Party button → PartyPanelScreen party tab
    this._el.querySelector('#btn-party')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new PartyPanelScreen(this.manager, this.audio, { tab: 'party' })); });
    this._el.querySelector('#btn-codex')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new CodexScreen(this.manager, this.audio)); });
    this._el.querySelector('#btn-challenge')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.push(new ChallengeScreen(this.manager, this.audio)); });
    // M306 — Infinite Depths entry
    this._el.querySelector('#btn-infinite')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._showInfiniteDepthsConfirm();
    });
    // Notification summary
    this._el.querySelector('#btn-notifs')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._showNotificationSummary();
    });

    // Wire service-specific events
    this._wireServiceEvents();

    // M297: keyboard navigation — mount/remount on every _wireEvents call.
    // The town layout is complex (tabs + content panels) so we use vertical
    // layout which lets Tab/Shift-Tab traverse all buttons in DOM order, and
    // ArrowUp/Down move between them. Escape fires the global game menu handler.
    kbUnmount(this._el);
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: false,
      onEscape: null, // let global ESC → GameMenuScreen handler take over
    });
  }

  _wireServiceEvents() {
    // M57: delegated handler on the panel — works after every re-render
    // and regardless of which inner HTML is rendered.
    const panel = this._el.querySelector('#service-panel');
    if (panel && !panel._ovDelegated) {
      panel._ovDelegated = true;
      panel.addEventListener('click', (e) => {
        const card = e.target.closest?.('.overview-card');
        if (!card) return;
        this.audio.playSfx('click');
        this._activeService = card.dataset.svc;
        this._refreshServicePanel();
      });
    }
    // M399 — Trainer service handlers. Re-attach on every re-render since
    // the trainer panel is rebuilt after each action.
    if (this._activeService === 'trainer') this._wireTrainer();
    // Delegated svc-tab handler on the .service-tabs container (outside #service-panel)
    const tabBar = this._el.querySelector('.service-tabs');
    if (tabBar && !tabBar._svcTabDelegated) {
      tabBar._svcTabDelegated = true;
      tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest?.('.svc-tab');
        if (!tab) return;
        this.audio.playSfx('click');
        const svc = tab.dataset.svc;
        this._activeService = this._activeService === svc ? null : svc;
        this._refreshServicePanel();
      });
    }
    // Forge / Blacksmith sub-tabs and actions (delegated via panel).
    // Covers both the legacy forge inline panel (data-forge-*) and the new
    // Blacksmith tabs (data-bs-tab, data-bs-upgrade) merged in Session 2026-04-16.
    if (panel && !panel._forgeDelegated) {
      panel._forgeDelegated = true;
      panel.addEventListener('click', (e) => {
        // Legacy forge sub-tabs still emitted by _forgeHTML (deprecated path).
        const forgeTabBtn = e.target.closest?.('[data-forge-tab]');
        if (forgeTabBtn) { this._forgeTab = forgeTabBtn.dataset.forgeTab; this._forgeMsg = ''; this._refreshServicePanel(); return; }
        // New Blacksmith sub-tab switcher.
        const bsTabBtn = e.target.closest?.('[data-bs-tab]');
        if (bsTabBtn) {
          this._blacksmithTab = bsTabBtn.dataset.bsTab;
          this._blacksmithMsg = '';
          this._refreshServicePanel();
          return;
        }
        // Enchanter sub-tab switcher (M182).
        const encTabBtn = e.target.closest?.('[data-enc-tab]');
        if (encTabBtn) {
          this._enchanterTab = encTabBtn.dataset.encTab;
          this._enchanterMsg = '';
          this._blacksmithMsg = '';
          // Reset wizard step when switching tabs
          this._encStep = 'item';
          this._encSelectedItem = null;
          this._encSelectedAffix = null;
          this._refreshServicePanel();

          return;
        }
        // M313 #30 — Enchanter wizard: Back button
        const encBack = e.target.closest?.('[data-enc-back]');
        if (encBack) {
          this._encStep = encBack.dataset.encBack;
          this._enchanterMsg = '';
          this._refreshServicePanel();
          return;
        }
        // M313 #30 — Enchanter wizard: Step 1 item pick
        const encPickItem = e.target.closest?.('[data-enc-pick-item]');
        if (encPickItem && !encPickItem.disabled) {
          try {
            const parsed = JSON.parse(decodeURIComponent(encPickItem.dataset.encPickItem));
            const gs = GameState.get();
            let item;
            if (parsed.eqRef) {
              const [ownerId, slot] = parsed.eqRef.split('|');
              const owner = [...(gs.party || []), ...(gs.companions || []), ...(gs.bench || [])].find(m => m.id === ownerId);
              item = owner?.equipment?.[slot];
            } else {
              item = (gs.inventory || []).find(i => i.id === parsed.id);
            }
            if (item) {
              this._encSelectedItem = { item, eqRef: parsed.eqRef || null, ownerName: parsed.ownerName || '' };
              this._encSelectedAffix = null;
              this._encStep = 'property';
              this._enchanterMsg = '';
              this._refreshServicePanel();
            }
          } catch (_) {}
          return;
        }
        // M313 #30 — Enchanter wizard: Step 2 affix pick
        const encPickAffix = e.target.closest?.('[data-enc-pick-affix]');
        if (encPickAffix) {
          this._encSelectedAffix = encPickAffix.dataset.encPickAffix;
          this._encStep = 'tier';
          this._enchanterMsg = '';
          this._refreshServicePanel();
          return;
        }
        // M295 — Enchanter affix info button: show before/after preview tooltip.
        const infoBtn = e.target.closest?.('[data-enc-preview]');
        if (infoBtn) {
          this._showEnchanterPreview(infoBtn, infoBtn.dataset.encPreview);
          return;
        }
        // Enchanter rarity-promote action (M182).
        const rar = e.target.closest?.('[data-enc-rarity]');
        if (rar && !rar.disabled) {
          const gs = GameState.get();
          let item;
          if (rar.dataset.eq) {
            const [ownerId, slot] = rar.dataset.eq.split('|');
            const owner = [...(gs.party || []), ...(gs.companions || []), ...(gs.bench || [])].find(m => m.id === ownerId);
            item = owner?.equipment?.[slot];
          } else {
            item = (gs.inventory || []).find(i => i.id === rar.dataset.encRarity);
          }
          this._doEnchanterRarityUpgrade(item);
          return;
        }
        const sal = e.target.closest?.('[data-forge-salvage]');
        if (sal) { this._doForgeSalvage(sal.dataset.forgeSalvage); return; }
        // M256: Salvage All — batch salvage every unequipped inventory item.
        const salAll = e.target.closest?.('#forge-salvage-all');
        if (salAll) {
          const gs2 = GameState.get();
          const ids = (gs2.inventory || []).filter(it => !it.equipped).map(it => it.id);
          for (const id of ids) this._doForgeSalvage(id);
          return;
        }
        // M307 — Unique recipe craft button.
        const uniqueCraft = e.target.closest?.('[data-forge-craft-unique]');
        if (uniqueCraft && !uniqueCraft.disabled) { this._doUniqueRecipeCraft(uniqueCraft.dataset.forgeCraftUnique); return; }
        const craft = e.target.closest?.('[data-forge-craft]');
        if (craft && !craft.disabled) { this._doForgeCraft(craft.dataset.forgeCraft); return; }
        // Blacksmith Upgrade / Enchanter tier confirm: 2 materials of tier X -> +1 affix of tier X.
        const upg = e.target.closest?.('[data-bs-upgrade]');
        if (upg && !upg.disabled) {
          const gs = GameState.get();
          let item;
          if (upg.dataset.eq) {
            const [ownerId, slot] = upg.dataset.eq.split('|');
            const owner = [...(gs.party || []), ...(gs.companions || []), ...(gs.bench || [])].find(m => m.id === ownerId);
            item = owner?.equipment?.[slot];
          } else {
            item = (gs.inventory || []).find(i => i.id === upg.dataset.id);
          }
          // M313 #30 — if this is a wizard confirm (step 3 tier card), reset to step 1 after
          if (upg.dataset.encConfirm) {
            this._doBlacksmithUpgrade(upg.dataset.bsUpgrade, item);
            this._encStep = 'item';
            this._encSelectedItem = null;
            this._encSelectedAffix = null;
          } else {
            this._doBlacksmithUpgrade(upg.dataset.bsUpgrade, item);
          }
          return;
        }
      });
    }
    // M295 — Enchanter info button hover (desktop)
    if (panel && !panel._encHoverDelegated) {
      panel._encHoverDelegated = true;
      panel.addEventListener('mouseover', (e) => {
        const btn = e.target.closest?.('[data-enc-preview]');
        if (!btn) return;
        this._showEnchanterPreview(btn, btn.dataset.encPreview);
      });
      panel.addEventListener('mouseout', (e) => {
        const btn = e.target.closest?.('[data-enc-preview]');
        if (!btn) return;
        const tt = this._el?.querySelector('#enc-preview-tooltip');
        if (tt && !tt.matches(':hover')) tt.style.display = 'none';
      });
    }
    // Merchant buy
    this._el.querySelectorAll('[data-section="buy"]').forEach(card => {
      card.addEventListener('click', () => {
        const item = this._merchantStock.find(i => i.id === card.dataset.id);
        if (!item) return;
        const price = this._itemPrice(item);
        if (GameState.getGold() < price) return;
        GameState.addGold(-price);
        GameState.addToInventory(item);
        this._maybeShowAutoEquipToast(GameState._lastAutoEquip);
        this._merchantStock = this._merchantStock.filter(i => i.id !== item.id);
        this.audio.playSfx('click');
        this._refreshAll();
      });
      card.addEventListener('mouseenter', e => this._showTooltip(e, card.dataset.id, 'stock'));
      card.addEventListener('mouseleave', () => this._hideTooltip());
    });

    // Potion purchase
    this._el.querySelectorAll('[data-buy-potion]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const potId = btn.dataset.buyPotion;
        const cost = parseInt(btn.dataset.cost);
        if (GameState.getGold() < cost) return;
        const pot = POTION_STOCK.find(p => p.id === potId);
        if (!pot) return;
        GameState.addGold(-cost);
        const gs = GameState.get();
        if (!gs.potions) gs.potions = [];
        gs.potions.push({ ...pot, uid: uuid() });
        this.audio.playSfx('purchase');
        this._refreshAll();
      });
    });

    // Black Market buy
    this._el.querySelectorAll('[data-section="bm-buy"]').forEach(card => {
      card.addEventListener('click', () => {
        const item = this._blackMarketStock.find(i => i.id === card.dataset.id);
        if (!item) return;
        const price = this._blackMarketPrice(item);
        if (GameState.getGold() < price) return;
        GameState.addGold(-price);
        GameState.addToInventory(item);
        this._maybeShowAutoEquipToast(GameState._lastAutoEquip);
        this._blackMarketStock = this._blackMarketStock.filter(i => i.id !== item.id);
        this.audio.playSfx('purchase');
        this._refreshAll();
      });
      card.addEventListener('mouseenter', e => this._showTooltip(e, card.dataset.id, 'blackmarket'));
      card.addEventListener('mouseleave', () => this._hideTooltip());
    });

    // M72: Tap weapons buy
    this._el.querySelectorAll('[data-buy-tap]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const id = btn.dataset.buyTap;
        const cost = parseInt(btn.dataset.cost) || 0;
        if (GameState.getGold() < cost) return;
        if (cost > 0) GameState.addGold(-cost);
        GameState.addTapItem(id);
        if (!GameState.getEquippedTapWeapon() && TAP_ALL[id]?.type === 'weapon') GameState.equipTapWeapon(id);
        if (!GameState.getEquippedTapUtility() && TAP_ALL[id]?.type === 'utility') GameState.equipTapUtility(id);
        this.audio.playSfx('purchase');
        this._refreshAll();
      });
    });
    // M72: draw tap icon canvases
    this._el.querySelectorAll('canvas[data-tap-icon]').forEach(cv => {
      const def = TAP_ALL[cv.dataset.tapIcon];
      if (!def) return;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      def.icon(ctx, cv.width / 2, cv.height / 2, cv.width);
    });

    // M71: Guild Hall buy
    this._el.querySelectorAll('[data-section="gh-buy"]').forEach(card => {
      card.addEventListener('click', () => {
        const item = this._guildStock.find(i => i.id === card.dataset.id);
        if (!item) return;
        const price = this._itemPrice(item) * 2;
        if (GameState.getGold() < price) return;
        GameState.addGold(-price);
        GameState.addToInventory(item);
        this._maybeShowAutoEquipToast(GameState._lastAutoEquip);
        this._guildStock = this._guildStock.filter(i => i.id !== item.id);
        this.audio.playSfx('purchase');
        this._refreshAll();
      });
    });

    // Merchant sell
    this._el.querySelectorAll('[data-section="sell"]').forEach(card => {
      card.addEventListener('click', () => {
        const gs = GameState.get();
        const item = gs.inventory.find(i => i.id === card.dataset.id);
        if (!item) return;
        GameState.addGold(Math.floor(this._itemPrice(item) * 0.4));
        GameState.removeFromInventory(item.id);
        this.audio.playSfx('click');
        this._refreshAll();
      });
    });

    // Hire
    this._el.querySelectorAll('[data-hire]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const hireId = btn.dataset.hire;
        const cost = parseInt(btn.dataset.cost);
        const isCompanion = btn.dataset.companion === 'true';
        this.audio.playSfx('click');

        // M242 fix: hires can be rolled templates (id like `hire_warrior_...`)
        // from getTavernRosterForTown OR named NPCs from HIREABLES_ACT1. Check
        // the cached tavern roster first, then fall back to the static list.
        const roster = this._lastTavernRoster;
        const fromRoll = roster ? roster.hires.find(h => h.id === hireId) : null;
        const template = isCompanion
          ? COMPANIONS_ACT1.find(c => c.id === hireId)
          : (fromRoll || HIREABLES_ACT1.find(h => h.id === hireId));

        if (!template || GameState.getGold() < cost) return;
        GameState.addGold(-cost);

        // Preserve the appearance variant chosen for this tavern roster slot.
        const tavernAppearance = btn.dataset.appearance || null;

        const member = {
          ...template,
          // M-followup: deep-clone shared object references off the template so
          // multiple hires of the same template don't alias state (attrs,
          // passiveRanks, talentsPurchased). Prevents "leveling up one hero
          // mutates another" / "Auto on one toggles the other" symptoms.
          attrs: { ...(template.attrs || { STR:8, DEX:8, INT:8, CON:8 }) },
          baseAttrs: { ...(template.baseAttrs || template.attrs || { STR:8, DEX:8, INT:8, CON:8 }) },
          passiveRanks: { ...(template.passiveRanks || {}) },
          talentsPurchased: { ...(template.talentsPurchased || {}) },
          id: template.id + '_' + Date.now(),
          templateId: template.id,
          hp: 50 + template.attrs.CON * 10,
          maxHp: 50 + template.attrs.CON * 10,
          mp: 30 + template.attrs.INT * 8,
          maxMp: 30 + template.attrs.INT * 8,
          xp: 0,
          // M412 — tavern hires now arrive with starting gear from their class,
          // matching New Character behaviour. Previously they had `equipment: {}`
          // and showed up barefisted.
          equipment: buildStartingEquipment((ALL_CLASSES.find(c => c.id === template.class)?.startingEquipment) || []),
          // M268: tavern hires get skill + passive pending-point catch-up
          // for every level they're hired at (a level-6 hire has missed
          // the 1→6 talent/passive grants). Attr points are NOT added —
          // template.attrs already reflects the level's stat spread.
          pendingAttrPoints: 0,
          ...(() => {
            const p = pendingPointsForLevel(template.level || 1);
            return { pendingSkillPoints: p.skill, pendingPassivePoints: p.passive };
          })(),
          // All class skills unlocked at their level — hires arrive
          // combat-ready instead of silent. The autoBuild default then
          // spends their talent/passive points sensibly.
          skills: getUnlockedSkills(template.class, template.level || 1)
            .filter(s => s.type !== 'passive').map(s => s.id),
          // Auto-flags for skill + passive default ON so talents/passives
          // get spent on hire. auto_attrs stays off by default; attr
          // allocation is already baked into the template spread.
          autoBuild: { auto_attrs: false, auto_passive: true, auto_active: true },
          ...(tavernAppearance ? { appearance: tavernAppearance } : {}),
        };
        // M268: spend pending points per the default auto-build flags.
        try { autoApplyMember(member); } catch (_) {}

        let sentToReserves = false;
        if (isCompanion) {
          if (!GameState.addToCompanions(member)) { GameState.addToBench(member); sentToReserves = true; }
        } else {
          if (!GameState.addToParty(member)) { GameState.addToBench(member); sentToReserves = true; }
        }
        // M279: deplete the tavern slot — record this hireId as claimed for
        // this town so the next tavern visit shows 3→2→1→0 (no reroll).
        try {
          const _gs = GameState.get();
          if (!_gs.tavernHired) _gs.tavernHired = {};
          const _t = this._townId || _gs.nodeId || 'unknown_town';
          if (!_gs.tavernHired[_t]) _gs.tavernHired[_t] = [];
          if (!_gs.tavernHired[_t].includes(template.id)) _gs.tavernHired[_t].push(template.id);
        } catch (_) { /* non-fatal — depletion just won't persist this hire */ }
        // Check achievements after hire (companions, party size, Trusty Companions, etc.)
        try { checkAchievements(); } catch (_) {}
        try { checkGameStateAchievements(); } catch (_) {}
        this._refreshAll();
        if (sentToReserves) {
          this._showToast(`Party full \u2014 ${member.name} sent to reserves. Manage your party to swap them in.`);
        }
        // M412 \u2014 show auto-options popup unless Manual Characters difficulty
        // option is on. Lets the player flip Auto Inventory / Attrs / Passives
        // / Spell Talents on a freshly hired premade hero (they default off
        // for tavern hires today, except passive+active per the legacy stamp).
        if (!isCompanion && !GameState.get()?.manualCharacters) {
          this._showHireAutoPopup(member);
        }
      });
    });

    // Custom hire
    this._el.querySelector('#btn-custom-hire')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new HireBuilderScreen(this.manager, this.audio));
    });

    const _resolveItem = (btn) => {
      const gs = GameState.get();
      const eq = btn.dataset.eq;
      if (eq) {
        const [ownerId, slot] = eq.split('|');
        const owner = [...(gs.party||[]), ...(gs.companions||[]), ...(gs.bench||[])].find(m => m.id === ownerId);
        return owner?.equipment?.[slot] || null;
      }
      return gs.inventory.find(i => i.id === btn.dataset.id) || null;
    };

    // Blacksmith sub-tabs (data-bs-tab) and Upgrade action (data-bs-upgrade)
    // are wired via the delegated handler on #service-panel in
    // _wireServiceEvents so they survive re-renders.

    // Legacy Blacksmith gold upgrades (data-action="rarity"/"quality") — kept
    // for back-compat in case any older UI still emits those buttons; the
    // new HTML no longer does.
    this._el.querySelectorAll('.bs-btn[data-action="rarity"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = _resolveItem(btn);
        const cost = parseInt(btn.dataset.cost);
        if (!item || GameState.getGold() < cost) return;
        GameState.addGold(-cost);
        item.rarity = btn.dataset.next;
        this.audio.playSfx('click');
        this._refreshAll();
      });
    });
    this._el.querySelectorAll('.bs-btn[data-action="quality"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = _resolveItem(btn);
        const cost = parseInt(btn.dataset.cost);
        if (!item || GameState.getGold() < cost) return;
        GameState.addGold(-cost);
        const oldQuality = item.quality;
        item.quality = btn.dataset.next;
        // M71: blacksmith quality upgrade rolls additional affixes if the new
        // tier unlocks more slots (uses RARITY_AFFIX_COUNT max + accessory bonus).
        this._rollExtraAffixes(item, oldQuality);
        // Scale stats when quality improves
        const { QUALITY_MULT } = { QUALITY_MULT: { low:0.7, medium:1.0, high:1.2, elite:1.4, exotic:1.6 } };
        const QUAL_ORDER = ['low','medium','high','elite','exotic'];
        const oldIdx = QUAL_ORDER.indexOf(item.quality === btn.dataset.next ? QUAL_ORDER[QUAL_ORDER.indexOf(btn.dataset.next) - 1] : item.quality);
        const newIdx = QUAL_ORDER.indexOf(btn.dataset.next);
        const scale = [0.7,1.0,1.2,1.4,1.6][newIdx] / [0.7,1.0,1.2,1.4,1.6][oldIdx];
        if (item.armor) item.armor = Math.round(item.armor * scale);
        if (item.dmg) item.dmg = item.dmg.map(d => Math.round(d * scale));
        this.audio.playSfx('click');
        this._refreshAll();
      });
    });

    // Enchanter — M182: gold-based enchant replaced by material-cost flow
    // routed through data-bs-upgrade / data-enc-rarity in the delegated
    // service-panel listener above.

    // Rest & Recover
    this._el.querySelector('#btn-rest')?.addEventListener('click', () => {
      const gs = GameState.get();
      const all = [...gs.party, ...gs.companions];
      // M236: Hard difficulty charges for rest; Normal stays free.
      const isHard = (() => { try { return localStorage.getItem('emberveil_difficulty') === 'hard'; } catch (_) { return false; } })();
      if (isHard) {
        const injuredCount = all.filter(m => m.hp > 0 && m.hp < (m.maxHp || 100)).length;
        const cost = injuredCount * 25;
        if (GameState.getGold() < cost) return;
        GameState.addGold(-cost);
      }
      all.forEach(m => {
        if (m.hp > 0) {
          m.hp = m.maxHp || (50 + (m.attrs?.CON || 10) * 10);
          m.mp = m.maxMp || (30 + (m.attrs?.INT || 8) * 8);
        }
      });
      this._blackMarketStock = getBlackMarketStock();
      this.audio.playSfx('levelup');
      this._refreshAll();
    });

    // Revive
    this._el.querySelectorAll('[data-revive]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const memberId = btn.dataset.revive;
        const cost = parseInt(btn.dataset.cost, 10) || 50; // M236: per-member cost
        const gs = GameState.get();
        // M382 — hardcore lockout, in case the disabled UI is bypassed.
        if (gs.hardcore) return;
        const member = [...gs.party, ...gs.companions].find(m => m.id === memberId);
        if (!member) return;
        if (GameState.getGold() < cost) return;
        GameState.addGold(-cost);
        member.hp = Math.floor((50 + member.attrs.CON * 10) * 0.5);
        member.dead = false;
        this.audio.playSfx('click');
        this._refreshAll();
      });
    });
  }

  _showTooltip(e, itemId, section) {
    const item = section === 'stock'
      ? this._merchantStock.find(i => i.id === itemId)
      : section === 'blackmarket'
        ? this._blackMarketStock.find(i => i.id === itemId)
        : GameState.get().inventory.find(i => i.id === itemId);
    if (!item) return;
    const tt = this._el.querySelector('#tt-el');
    if (!tt) return;
    tt.innerHTML = getItemTooltip(item);
    tt.style.display = 'block';
    tt.style.left = `${Math.min(e.clientX + 12, window.innerWidth - 220)}px`;
    tt.style.top = `${Math.max(8, e.clientY - 60)}px`;
  }

  _hideTooltip() {
    const tt = this._el?.querySelector('#tt-el');
    if (tt) tt.style.display = 'none';
  }

  _refreshServicePanel() {
    const panel = this._el?.querySelector('#service-panel');
    if (!panel) return;
    // Save scroll position before re-render
    const scrollTop = panel.scrollTop;
    // Update tab active states
    this._el.querySelectorAll('.svc-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.svc === this._activeService);
    });
    panel.innerHTML = this._renderServiceContent();
    this._wireServiceEvents();
    // Restore scroll position
    panel.scrollTop = scrollTop;
  }

  _refreshAll() {
    const goldEl = this._el?.querySelector('#gold-amount');
    if (goldEl) goldEl.textContent = GameState.getGold().toLocaleString();
    this._refreshServicePanel();
    // Re-render party panel
    const partySlots = this._el?.querySelector('#party-slots');
    const compSlots = this._el?.querySelector('#companion-slots');
    if (partySlots) { partySlots.innerHTML = ''; }
    if (compSlots) { compSlots.innerHTML = ''; }
    this._renderPartyPanel();
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() {
    if (!this._el) return;
    this._el.style.display = '';
    // Full re-render to sync gold, party, and service availability after returning from sub-screens
    this._render();
    // M135: fame encounter must fire on every town entry (including resume from
    // combat/world map), not just fresh load — previously the Guildmaster popup
    // only appeared after save/load cycle.
    this._maybeShowFameEncounter();
  }
  /**
   * M313 #28 — After addToInventory, check _lastAutoEquip and fire a shared toast
   * if an item was auto-equipped to a character.
   * @param {object|null} lastAutoEquip  — GameState._lastAutoEquip result or null
   */
  _maybeShowAutoEquipToast(lastAutoEquip) {
    if (!lastAutoEquip || !lastAutoEquip.member || !lastAutoEquip.item) return;
    const { member, item, slot } = lastAutoEquip;
    const slotLabel = slot ? ` (${slot})` : '';
    showToast(`Equipped <strong>${item.name}</strong> to <strong>${member.name}</strong>${slotLabel}`, { duration: 4000 });
  }

  // M412 — popup that lets the player toggle auto flags on a freshly hired
  // premade hero. Skipped entirely when Manual Characters difficulty is on.
  _showHireAutoPopup(member) {
    if (!this.manager?.uiOverlay) return;
    const ab = member.autoBuild || {};
    const cur = {
      attrs: !!ab.auto_attrs,
      passive: !!ab.auto_passive,
      active: !!ab.auto_active,
      equip: !!member.autoEquip,
    };
    const modal = createEl('div', 'hire-auto-modal');
    modal.innerHTML = `
      <div class="ham-overlay"></div>
      <div class="ham-box">
        <div class="ham-title">${member.name} hired</div>
        <div class="ham-sub">Enable auto-management for this hero?</div>
        <div class="ham-list">
          <label><input type="checkbox" id="ham-attrs"  ${cur.attrs   ? 'checked' : ''}> Auto Attributes</label>
          <label><input type="checkbox" id="ham-passive" ${cur.passive ? 'checked' : ''}> Auto Passives</label>
          <label><input type="checkbox" id="ham-active" ${cur.active  ? 'checked' : ''}> Auto Spell Talents</label>
          <label><input type="checkbox" id="ham-equip"  ${cur.equip   ? 'checked' : ''}> Auto Inventory</label>
        </div>
        <div class="ham-foot">
          <button type="button" class="ham-btn ham-confirm">Confirm</button>
        </div>
      </div>
    `;
    if (!document.getElementById('hire-auto-modal-styles')) {
      const s = document.createElement('style');
      s.id = 'hire-auto-modal-styles';
      s.textContent = `.hire-auto-modal{position:absolute;inset:0;z-index:610;display:flex;align-items:center;justify-content:center}.hire-auto-modal .ham-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.78)}.hire-auto-modal .ham-box{position:relative;z-index:1;background:#1a1218;border:1px solid rgba(232,160,32,0.55);border-radius:10px;padding:1.1rem 1.2rem;width:300px;max-width:90%;color:#f0e8d8;box-shadow:0 0 30px rgba(232,160,32,0.25)}.hire-auto-modal .ham-title{font-family:'Cinzel',serif;font-size:1.05rem;color:#e8a020;margin-bottom:0.2rem}.hire-auto-modal .ham-sub{font-size:0.78rem;color:#c0b090;margin-bottom:0.85rem}.hire-auto-modal .ham-list{display:flex;flex-direction:column;gap:0.45rem;font-size:0.85rem;margin-bottom:1rem}.hire-auto-modal .ham-list label{display:flex;align-items:center;gap:0.5rem;cursor:pointer}.hire-auto-modal .ham-foot{display:flex;justify-content:flex-end}.hire-auto-modal .ham-btn{background:#e8a020;color:#1a1218;border:none;padding:0.55rem 1.4rem;border-radius:5px;font-weight:700;font-family:'Cinzel',serif;cursor:pointer;min-height:44px}.hire-auto-modal .ham-btn:hover{background:#ffc040}`;
      document.head.appendChild(s);
    }
    const close = () => {
      member.autoBuild = member.autoBuild || {};
      member.autoBuild.auto_attrs = !!modal.querySelector('#ham-attrs').checked;
      member.autoBuild.auto_passive = !!modal.querySelector('#ham-passive').checked;
      member.autoBuild.auto_active = !!modal.querySelector('#ham-active').checked;
      member.autoEquip = !!modal.querySelector('#ham-equip').checked;
      try { autoApplyMember(member); } catch (_) {}
      this.audio.playSfx('click');
      removeEl(modal);
      this._refreshAll();
    };
    modal.querySelector('.ham-confirm').addEventListener('click', close);
    this.manager.uiOverlay.appendChild(modal);
  }

  _showToast(msg) {
    if (!this._el) return;
    const toast = document.createElement('div');
    // Inject keyframes if not already present
    if (!document.getElementById('town-toast-keyframes')) {
      const ks = document.createElement('style');
      ks.id = 'town-toast-keyframes';
      ks.textContent = '@keyframes town-toast-fade{0%{opacity:1}70%{opacity:1}100%{opacity:0}}';
      document.head.appendChild(ks);
    }
    toast.style.cssText = 'position:absolute;bottom:5rem;left:50%;transform:translateX(-50%);background:rgba(20,12,28,0.95);border:1px solid rgba(232,200,64,0.4);color:#e8c840;padding:0.5rem 1rem;border-radius:6px;font-size:0.78rem;pointer-events:none;z-index:100;white-space:nowrap;max-width:90%;text-align:center;animation:town-toast-fade 3s ease-out forwards';
    toast.textContent = msg;
    this._el.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  _showNotificationSummary() {
    const notes = getNotifications();
    if (!notes.length) return;
    const lines = notes.map(n => {
      if (n.type === 'attr') return `${n.name}: ${n.count} attribute point${n.count > 1 ? 's' : ''}`;
      if (n.type === 'skill') return `${n.name}: ${n.count} talent point${n.count > 1 ? 's' : ''}`;
      return `${n.name}: ${n.count} passive point${n.count > 1 ? 's' : ''}`;
    });
    const overlay = createEl('div', 'notif-overlay');
    overlay.innerHTML = `
      <div class="notif-box">
        <div class="notif-title">Pending Upgrades</div>
        <div class="notif-list">${lines.map(l => `<div class="notif-line">${l}</div>`).join('')}</div>
        <button type="button" class="notif-btn" id="notif-close">Close</button>
      </div>
    `;
    overlay.querySelector('#notif-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    this._el.appendChild(overlay);
  }

  update() {}
  draw() {}
  onExit() {
    if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null;
    // Cancel any pending fame-encounter modal so it doesn't appear over TitleScreen.
    if (this._fameEncounterModal) { try { removeEl(this._fameEncounterModal); } catch (_) {} this._fameEncounterModal = null; }
  }
  destroy() {
    if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null;
    if (this._fameEncounterModal) { try { removeEl(this._fameEncounterModal); } catch (_) {} this._fameEncounterModal = null; }
  }
}

const TOWN_STYLES = `
.town-screen {
  position: absolute; inset: 0; overflow: hidden;
  font-family: 'Inter', sans-serif; color: #f0e8d8;
}
.town-bg {
  position: absolute; inset: 0;
  background: linear-gradient(180deg,#08100a 0%,#0d180e 100%);
}
.town-layout {
  position: relative; z-index: 1;
  display: grid; grid-template-columns: 220px 1fr 140px;
  height: 100%; overflow: hidden;
}
/* M223: widen party sidebar on larger viewports so the new bigger portraits +
   HP bars + tap-to-open dropdown all breathe. */
@media (min-width: 1100px) {
  .town-layout { grid-template-columns: 280px 1fr 160px; }
}
@media (min-width: 1400px) {
  .town-layout { grid-template-columns: 320px 1fr 180px; }
}
/* Mobile: flex column, center scrolls, actions bar pinned at bottom */
@media (max-width: 600px) {
  .town-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .party-panel { display: none; }
  .town-main {
    flex: 1;
    min-height: 0;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
  }
  .service-panel {
    overflow-y: visible !important;
    padding: 0.9rem 1rem 80px !important; /* 80px clearance so last items don't hide under the action bar */
  }
  .town-actions-panel {
    flex-shrink: 0;
    flex-direction: row !important;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0.45rem 0.5rem !important;
    border-left: none !important;
    border-top: 1px solid rgba(232,160,32,0.2) !important;
    gap: 0.35rem !important;
    background: rgba(4,2,8,0.92) !important;
  }
  .action-btn {
    min-height: 54px !important;
    min-width: 54px !important;
    padding: 0.4rem 0.3rem !important;
    font-size: 0.6rem !important;
    flex-shrink: 0;
    gap: 0.15rem !important;
    border-radius: 6px !important;
  }
  .action-btn svg { width: 18px !important; height: 18px !important; }
  .action-separator { display: none !important; }
  .action-leave { margin-top: 0 !important; }
}
.party-panel {
  padding: 1rem 0.75rem; border-right: 1px solid rgba(232,160,32,0.1);
  overflow-y: auto; background: rgba(0,0,0,0.2);
}
.panel-title {
  font-size: 0.65rem; font-weight: 600; letter-spacing: 0.15em;
  text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.5rem;
}
.party-slots { display: flex; flex-direction: column; gap: 0.5rem; }
.party-slot {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem; background: rgba(26,18,24,0.6);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 6px; min-height: 52px;
}
.party-slot.empty { opacity: 0.35; justify-content: center; }
.ps-empty { font-size: 0.7rem; color: #4a3a32; }
.ps-icon { width: 28px; height: 28px; color: #e8a020; flex-shrink: 0; }
.ps-portrait { width: 56px; height: 56px; color: #e8a020; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
/* M322 — companion + party HP bars span the full row width (right of the
   avatar) instead of shrinking to the longest text line. */
.ps-info { flex: 1 1 auto; min-width: 0; }
.ps-info .ps-hp-bar { width: 100%; }
.ps-portrait .char-portrait { border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(232,160,32,0.25); }
/* M223: clickable slots get an affordance cursor + hover glow. */
.party-slot.ps-clickable { cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.party-slot.ps-clickable:hover { border-color: rgba(232,160,32,0.45); background: rgba(40,26,32,0.85); }
.ps-menu {
  position: fixed; z-index: 2000;
  min-width: 170px;
  background: rgba(18,10,18,0.98);
  border: 1px solid rgba(232,160,32,0.4);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  padding: 0.35rem;
  display: flex; flex-direction: column; gap: 0.15rem;
}
.ps-menu-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  background: transparent; border: 1px solid transparent; border-radius: 4px;
  color: #f0e8d8; font-family: 'Cinzel', serif; font-size: 0.78rem;
  text-align: left; cursor: pointer; min-height: 40px;
}
.ps-menu-item:hover { background: rgba(232,160,32,0.12); border-color: rgba(232,160,32,0.3); }
.ps-menu-item svg { flex-shrink: 0; color: #e8a020; }
.ps-class-icon { margin-left: 4px; }
.ps-stats { font-size: 0.62rem; color: #b0a090; margin-top: 2px; }
.ps-name { font-size: 0.8rem; font-weight: 700; font-family: 'Cinzel', serif; display: inline-flex; align-items: center; gap: 2px; }
.ps-class { font-size: 0.65rem; color: #8a7a6a; }
.ps-hp-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 3px; overflow: hidden; }
.ps-hp-fill { height: 100%; background: #40c870; border-radius: 2px; }

.town-main { display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }
.town-header-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.5rem; border-bottom: 1px solid rgba(232,160,32,0.12);
  background: rgba(0,0,0,0.25); flex-shrink: 0;
}
.town-region-tag { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #40a860; }
.town-name { font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 900; color: #e8a020; }
.gold-display { display: flex; align-items: center; gap: 0.4rem; font-family: 'Cinzel', serif; font-weight: 700; font-size: 1.1rem; color: #e8a020; }

.welcome-banner {
  margin: 1rem 1.5rem 0; padding: 1rem 1.25rem;
  background: rgba(64,168,96,0.08); border: 1px solid rgba(64,168,96,0.2); border-radius: 8px;
  flex-shrink: 0;
}
.wb-title { font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; color: #6ddc96; margin-bottom: 0.3rem; }
.wb-text { font-size: 0.78rem; color: #90b890; line-height: 1.5; }

.service-tabs {
  display: flex; gap: 0; border-bottom: 1px solid rgba(232,160,32,0.12);
  flex-shrink: 0; overflow-x: auto;
}
.svc-tab {
  padding: 0.65rem 1rem; background: none; border: none; border-bottom: 2px solid transparent;
  color: #8a7a6a; font-size: 0.78rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; white-space: nowrap; min-height: 44px;
}
.svc-tab:hover { color: #f0e8d8; }
.svc-tab.active { color: #e8a020; border-bottom-color: #e8a020; }
.service-panel { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; min-height: 0; }

/* Overview */
.overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px,1fr)); gap: 0.75rem; }
.overview-card {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  padding: 1.2rem 0.75rem; background: rgba(26,18,24,0.8);
  border: 1px solid rgba(232,160,32,0.12); border-radius: 10px;
  cursor: pointer; text-align: center; transition: all 0.2s;
}
.overview-card:hover { border-color: rgba(232,160,32,0.4); transform: translateY(-2px); }
.ov-icon { width: 36px; height: 36px; color: #e8a020; }
.ov-name { font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; }
.ov-desc { font-size: 0.65rem; color: #8a7a6a; }

/* Merchant */
.merchant-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 700px) { .merchant-layout { grid-template-columns: 1fr; } }
.merchant-potions { margin-bottom: 1.5rem; grid-column: 1 / -1; }
.potion-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.potion-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; background: rgba(20,12,28,0.5); border: 1px solid rgba(80,200,120,0.12); border-radius: 7px; }
.pc-icon { font-size: 1.3rem; flex-shrink: 0; width: 32px; text-align: center; }
.pc-info { flex: 1; }
.pc-name { font-size: 0.78rem; font-weight: 600; color: #90d8a8; }
.pc-desc { font-size: 0.65rem; color: #8a7a6a; margin-top: 0.1rem; }
.pc-buy { font-size: 0.72rem; padding: 0.3rem 0.65rem; min-height: 36px; }
.svc-section-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.75rem; }
.item-grid { display: flex; flex-direction: column; gap: 0.4rem; }
.item-card {
  display: grid; grid-template-columns: 1fr auto; gap: 0.25rem;
  padding: 0.65rem 0.75rem; background: rgba(26,18,24,0.6);
  border: 1px solid rgba(232,160,32,0.08); border-radius: 6px;
  cursor: pointer; transition: border-color 0.15s;
}
.item-card:hover { border-color: rgba(232,160,32,0.35); }
.ic-name { font-size: 0.82rem; font-weight: 600; grid-column: 1; }
.ic-type { font-size: 0.65rem; color: #8a7a6a; grid-column: 1; }
.ic-stats { font-size: 0.68rem; color: #c0b090; grid-column: 1; }
.ic-price { font-family: 'Cinzel', serif; font-size: 0.8rem; color: #e8a020; font-weight: 700; grid-column: 2; grid-row: 1/3; align-self: center; text-align: right; }
.empty-state { font-size: 0.8rem; color: #4a3a32; padding: 1rem 0; }

/* Tavern / Cleric */
.hireable-list { display: flex; flex-direction: column; gap: 0.75rem; }
.hireable-card {
  display: flex; gap: 1rem; align-items: center;
  padding: 0.85rem 1rem; background: rgba(26,18,24,0.6);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 8px;
}
.hireable-card.hired { opacity: 0.6; }
.hc-portrait { width: 80px; height: 80px; color: #e8a020; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 5px; box-sizing: border-box; }
.hc-portrait .char-portrait { border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(232,160,32,0.2); width: 100% !important; height: 100% !important; }
.hc-portrait canvas { width: 100% !important; height: 100% !important; }
.hc-class svg { width: 14px; height: 14px; vertical-align: middle; margin-right: 2px; }
.hc-info { flex: 1; }
.hc-name { font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; }
.hc-class { font-size: 0.7rem; color: #8a7a6a; font-family: 'Inter', sans-serif; font-weight: 400; }
.hc-desc { font-size: 0.75rem; color: #b0a090; margin-top: 0.2rem; line-height: 1.4; }
.hc-attrs { font-size: 0.65rem; color: #8a7a6a; margin-top: 0.3rem; }
.hc-personality { font-size: 0.65rem; color: #8060c0; margin-top: 0.2rem; font-style: italic; }
.hire-btn {
  padding: 0.5rem 0.75rem; background: rgba(64,168,96,0.15);
  border: 1px solid rgba(64,168,96,0.4); border-radius: 6px;
  color: #6ddc96; font-family: 'Cinzel', serif; font-size: 0.75rem; font-weight: 700;
  cursor: pointer; text-align: center; min-width: 60px; min-height: 44px;
  transition: background 0.2s;
}
.hire-btn:hover:not(.disabled) { background: rgba(64,168,96,0.28); }
.hire-btn.disabled { opacity: 0.4; cursor: not-allowed; }
.hired-badge { font-size: 0.7rem; color: #e8a020; font-weight: 600; padding: 0.3rem 0.5rem; background: rgba(232,160,32,0.1); border-radius: 4px; }
.cleric-note { margin-top: 1.5rem; font-size: 0.75rem; color: #8a7a6a; line-height: 1.5; font-style: italic; }
.coming-soon { text-align: center; padding: 3rem 2rem; }
.cs-title { font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #e8a020; margin-bottom: 0.75rem; }
.cs-text { font-size: 0.85rem; color: #8a7a6a; }
.bs-panel { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
.bs-title { font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; color: #e8a020; }
.bs-subtitle { font-size: 0.72rem; color: #8a7a6a; }
.bs-items { display: flex; flex-direction: column; gap: 0.6rem; }
.bs-item { background: rgba(20,14,18,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 0.7rem; }
.bs-iname { font-weight: 600; font-size: 0.82rem; }
.bs-isub { font-size: 0.68rem; color: #8a7a6a; margin-bottom: 0.4rem; }
.bs-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.bs-btn {
  padding: 0.3rem 0.65rem; border-radius: 5px; border: 1px solid rgba(232,160,32,0.25);
  background: rgba(232,160,32,0.08); color: #e8c070; font-size: 0.7rem; cursor: pointer;
  transition: background 0.12s; min-height: 32px;
}
.bs-btn:hover:not(:disabled) { background: rgba(232,160,32,0.18); }
.bs-btn:disabled { opacity: 0.35; cursor: not-allowed; filter: grayscale(0.4); }
.forge-cols { display: grid; grid-template-columns: 1fr; gap: 0.8rem; }
@media (min-width: 720px) { .forge-cols { grid-template-columns: repeat(3, 1fr); } }
.forge-col { display: flex; flex-direction: column; gap: 0.45rem; }
.forge-col-head {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em;
  padding: 0.2rem 0 0.3rem; border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 0.1rem; text-align: center;
}
.bs-maxed { font-size: 0.68rem; color: #5a4a42; padding: 0.3rem 0; }
.enc-affixes { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.enc-btn { border-color: rgba(100,60,200,0.3); background: rgba(100,60,200,0.08); color: #c080ff; }
.enc-btn:hover { background: rgba(100,60,200,0.18); }

/* Actions panel */
.town-actions-panel {
  padding: 1rem 0.75rem; border-left: 1px solid rgba(232,160,32,0.1);
  display: flex; flex-direction: column; gap: 0.5rem;
  background: rgba(0,0,0,0.2);
}
.action-btn {
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  padding: 0.75rem 0.5rem; background: rgba(26,18,24,0.6);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 8px;
  color: #8a7a6a; font-size: 0.72rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; min-height: 60px; text-align: center;
}
.action-btn:hover { border-color: rgba(232,160,32,0.3); color: #f0e8d8; }
.action-primary { border-color: rgba(232,160,32,0.3); color: #e8a020; }
.action-portal { border-color: rgba(232,180,40,0.4); color: #e8b428; background: rgba(232,180,40,0.1); font-family: 'Cinzel', serif; font-weight: 700; }
.action-portal:hover { background: rgba(232,180,40,0.2); }
.action-separator { flex: 1; }
.action-leave {
  background: rgba(192,64,48,0.08); border-color: rgba(192,64,48,0.3);
  color: #c04030; margin-top: auto;
}
.action-leave:hover { background: rgba(192,64,48,0.18); }

/* Tooltip */
.item-tooltip {
  position: fixed; z-index: 1000; pointer-events: none;
  background: rgba(10,6,8,0.95); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.8rem;
  line-height: 1.6; max-width: 200px; color: #f0e8d8;
}
.tavern-layout { display: flex; flex-direction: column; }
.cleric-layout { display: flex; flex-direction: column; gap: 0.75rem; }
.notif-badge { display: inline-block; background: #c04030; color: #fff; font-size: 0.6rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 10px; margin-left: 0.3rem; vertical-align: middle; min-width: 18px; text-align: center; }
.notif-badge-inline { display: inline-block; background: #c04030; color: #fff; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 10px; margin-right: 0.4rem; min-width: 20px; text-align: center; }
.action-notif { border-color: rgba(192,64,48,0.4) !important; color: #e06050 !important; background: rgba(192,64,48,0.08) !important; }
.action-notif:hover { background: rgba(192,64,48,0.16) !important; }
.notif-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
.notif-box { background: #1a1218; border: 1px solid rgba(232,160,32,0.3); border-radius: 12px; padding: 1.5rem; max-width: 320px; width: 90%; }
.notif-title { font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #e8a020; margin-bottom: 1rem; text-align: center; }
.notif-list { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.notif-line { font-size: 0.8rem; color: #e8e0d0; padding: 0.4rem 0.6rem; background: rgba(232,160,32,0.06); border-radius: 6px; border: 1px solid rgba(232,160,32,0.1); }
.notif-btn { width: 100%; padding: 0.6rem; background: rgba(232,160,32,0.12); border: 1px solid rgba(232,160,32,0.4); border-radius: 8px; color: #e8a020; font-family: 'Cinzel', serif; font-weight: 700; cursor: pointer; min-height: 44px; }

/* --- Guild Hall (M384: yellow to match the services overview-grid icon
   stroke #e8d020). Was lime green; user wanted both surfaces consistent. --- */
.svc-tab-guildhall {
  color: #e8d020 !important;
  border-bottom-color: rgba(232,208,32,0.5) !important;
  text-shadow: 0 0 6px rgba(232,208,32,0.35);
}
.svc-tab-guildhall.active {
  background: rgba(28,22,4,0.6) !important;
  color: #f4e070 !important;
  border-bottom-color: #e8d020 !important;
  box-shadow: 0 0 10px rgba(232,208,32,0.35);
}

/* --- Black Market --- */
.svc-tab-blackmarket {
  color: #a080d0 !important;
  border-color: rgba(128,96,192,0.45) !important;
  text-shadow: 0 0 6px rgba(128,96,192,0.45);
}
.svc-tab-blackmarket.active {
  background: rgba(22,10,42,0.85) !important;
  color: #c0a0ff !important;
  border-color: #8060c0 !important;
  box-shadow: 0 0 12px rgba(128,96,192,0.4);
}
.blackmarket-layout {
  background: linear-gradient(180deg, #14092a 0%, #080516 100%);
  border: 1px solid #8060c0;
  border-radius: 10px;
  padding: 1rem;
  color: #d8d0e8;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.6), 0 0 18px rgba(128,96,192,0.25);
}
.blackmarket-layout .bm-title {
  font-family: 'Cinzel', serif;
  font-size: 1.4rem;
  font-weight: 900;
  color: #a080d0;
  text-align: center;
  letter-spacing: 0.18em;
  text-shadow: 0 0 10px rgba(128,96,192,0.7), 0 0 2px #000;
  margin-bottom: 0.35rem;
}
.blackmarket-layout .bm-flavor {
  font-size: 0.72rem;
  font-style: italic;
  color: #9088a8;
  text-align: center;
  margin-bottom: 0.85rem;
}
.blackmarket-layout .svc-section-title.bm-section {
  color: #a080d0;
  border-bottom-color: rgba(128,96,192,0.4);
}
.blackmarket-layout .bm-card {
  background: rgba(16,8,28,0.75);
  border-color: rgba(128,96,192,0.45);
}
.blackmarket-layout .bm-card:hover {
  border-color: #8060c0;
  box-shadow: 0 0 10px rgba(128,96,192,0.45);
}
.blackmarket-layout .bm-price { color: #c0a0ff; }
.blackmarket-layout .bm-note {
  font-size: 0.68rem;
  color: #7868a0;
  text-align: center;
  margin-top: 0.6rem;
  font-style: italic;
}
.blackmarket-layout.locked { text-align: center; }
.blackmarket-layout .bm-locked { padding: 1.2rem 0.5rem; }
.blackmarket-layout .bm-locked-icon { font-size: 2rem; color: #a080d0; margin-bottom: 0.5rem; }
.blackmarket-layout .bm-locked-text { font-size: 0.85rem; color: #c0b0d8; line-height: 1.5; }
.blackmarket-layout .bm-hint { margin-top: 0.75rem; font-size: 0.72rem; color: #7868a0; }

/* --- Forge (inline town service) --- */
.forge-inline { display:flex; flex-direction:column; gap:0.8rem; }
.forge-inline .forge-mats { display:flex; flex-wrap:wrap; gap:0.4rem; background: rgba(255,120,40,0.06); border: 1px solid rgba(255,120,40,0.2); border-radius: 6px; padding: 0.6rem; }
.forge-inline .forge-mat-chip { display:flex; align-items:center; gap:0.3rem; background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:0.2rem 0.5rem; font-size:0.72rem; }
.forge-inline .forge-mat-zero { opacity: 0.35; }
.forge-inline .forge-sub-tabs { display:flex; gap:0.3rem; }
.forge-inline .forge-sub-tab { flex:1; padding:0.5rem; text-align:center; cursor:pointer; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.1em; color:rgba(200,160,100,0.7); background:rgba(255,120,40,0.06); border:1px solid rgba(255,120,40,0.2); border-radius:6px; font-family:inherit; }
.forge-inline .forge-sub-tab.active { color:#e88040; border-color:#e88040; background:rgba(255,120,40,0.14); }
.forge-inline .forge-inv-item { display:flex; align-items:center; gap:0.6rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.45rem 0.7rem; }
.forge-inline .forge-inv-name { flex:1; font-size:0.8rem; }
.forge-inline .forge-inv-yield { font-size:0.68rem; color:rgba(180,150,100,0.6); margin-top:0.1rem; }
.forge-inline .forge-salvage-btn { background:rgba(255,120,40,0.15); border:1px solid rgba(255,120,40,0.5); color:#e88040; padding:0.25rem 0.7rem; border-radius:4px; cursor:pointer; font-size:0.75rem; font-family:inherit; }
/* M313 #29 — Salvage All row bottom margin */
.forge-salvage-all-row { margin-bottom: 0.75rem; }
.forge-inline .forge-recipe { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.55rem 0.75rem; margin-bottom:0.4rem; }
.forge-inline .forge-recipe-name { font-size:0.85rem; color:#f0e0c0; margin-bottom:0.2rem; }
.forge-inline .forge-recipe-cost { font-size:0.72rem; color:rgba(180,150,100,0.7); margin-bottom:0.4rem; }
.forge-inline .forge-recipe-cost span.ok { color:#60c060; }
.forge-inline .forge-recipe-cost span.no { color:#e06040; }
.forge-inline .forge-craft-btn { background:rgba(96,192,64,0.15); border:1px solid rgba(96,192,64,0.4); color:#80e060; padding:0.3rem 0.9rem; border-radius:4px; cursor:pointer; font-size:0.78rem; font-family:inherit; min-height:36px; }
.forge-inline .forge-craft-btn:disabled { opacity:0.35; cursor:not-allowed; }
/* M416 — "Craft (N)" count badge inside the craft button. */
.forge-inline .forge-craft-count { font-weight:700; opacity:0.85; margin-left:2px; }
.forge-inline .forge-empty { font-size:0.8rem; color:rgba(180,150,100,0.5); text-align:center; padding:1.5rem 1rem; font-style:italic; }
.forge-inline .forge-msg { font-size:0.8rem; text-align:center; padding:0.4rem; color:#80e060; font-style:italic; }
/* M307 — Unique recipe cards */
.forge-unique-list { display:flex; flex-direction:column; gap:0.5rem; padding:0.25rem 0; }
.forge-recipe-unique { border-color:rgba(255,128,64,0.3) !important; background:rgba(255,128,64,0.06) !important; }
.forge-craft-unique-btn { background:rgba(255,128,64,0.18) !important; border-color:rgba(255,128,64,0.5) !important; color:#ffa060 !important; }
/* M295 — Enchanter preview tooltip */
.enc-tier-row { display:flex; align-items:center; gap:0.35rem; margin-bottom:0.25rem; }
.enc-info-btn { width:22px; height:22px; border-radius:50%; background:rgba(150,100,220,0.18); border:1px solid rgba(150,100,220,0.45); color:#c090ff; font-size:0.68rem; cursor:pointer; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; }
.enc-info-btn:hover { background:rgba(150,100,220,0.35); }
.enc-cur-affixes { margin:0.2rem 0 0.4rem; padding-left:0.2rem; }
.enc-tier-actions { flex-direction:column; align-items:flex-start; }
.enc-preview-tt {
  margin-top:0.5rem; padding:0.6rem 0.8rem;
  background:rgba(12,6,22,0.96); border:1px solid rgba(180,120,255,0.45);
  border-radius:8px; font-family:'Inter', sans-serif;
  font-size:0.78rem; color:#e8e0d0;
  box-shadow:0 4px 18px rgba(0,0,0,0.55);
}
.enc-preview-tt-head { font-family:'Cinzel', serif; font-size:0.72rem; color:#c090ff; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:0.4rem; }
.enc-preview-tt-section { font-size:0.62rem; text-transform:uppercase; letter-spacing:0.08em; color:rgba(200,180,130,0.55); margin:0.4rem 0 0.2rem; }
.enc-tt-row { display:flex; justify-content:space-between; gap:0.5rem; padding:0.08rem 0; }
.enc-tt-stat { color:#c8b88a; }
.enc-tt-val { color:#80d090; font-weight:600; }
.enc-tt-cur .enc-tt-val { color:#80a8ff; }
.enc-tt-more { font-size:0.68rem; color:rgba(180,160,120,0.5); margin-top:0.25rem; font-style:italic; }
/* M313 #30 — Enchanter 3-step wizard */
.enc-step-label { font-size:0.68rem; text-transform:uppercase; letter-spacing:0.1em; color:rgba(200,160,100,0.65); margin-bottom:0.5rem; display:block; }
.enc-step-nav { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem; flex-wrap:wrap; }
.enc-back-btn { background:rgba(255,255,255,0.06) !important; border-color:rgba(255,255,255,0.2) !important; color:#c0b090 !important; font-size:0.72rem !important; padding:0.3rem 0.7rem !important; min-height:36px !important; }
.enc-selected-item { display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; padding:0.35rem 0.5rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; margin-bottom:0.6rem; font-size:0.8rem; }
.enc-pick-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.5rem; }
.enc-prop-grid { grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); }
.enc-pick-card { background:rgba(100,60,200,0.08); border:1px solid rgba(100,60,200,0.3); border-radius:8px; padding:0.6rem 0.7rem; cursor:pointer; text-align:left; font-family:inherit; transition:background 0.15s,border-color 0.15s; min-height:64px; }
.enc-pick-card:hover:not(:disabled) { background:rgba(100,60,200,0.18); border-color:rgba(100,60,200,0.6); }
.enc-pick-card:disabled,.enc-pick-dim { opacity:0.38; cursor:not-allowed; }
.enc-pick-name { font-size:0.8rem; font-weight:600; color:#d8c8f0; line-height:1.3; }
.enc-pick-sub { font-size:0.68rem; color:#8a7a9a; margin-top:0.2rem; }
.enc-pick-badge { font-size:0.62rem; margin-top:0.25rem; color:#a090b8; }
.enc-pick-badge-warn { color:#c07050; }
.enc-cur-affixes-row { display:flex; flex-wrap:wrap; gap:0.3rem; margin-left:0.3rem; }
.enc-cur-chip { font-size:0.65rem; background:rgba(80,140,255,0.12); border:1px solid rgba(80,140,255,0.3); border-radius:10px; padding:0.1rem 0.4rem; color:#88b8ff; }
.enc-tier-card { background:rgba(100,60,200,0.1) !important; }
.enc-tier-card:hover:not(:disabled) { background:rgba(100,60,200,0.22) !important; }
@media (max-width:480px) { .enc-pick-grid { grid-template-columns:1fr 1fr; } }
`;
