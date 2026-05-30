/**
 * CombatScreen — full side-view combat
 * Turn order by DEX + d10. Auto-play 0.5s/turn.
 * Party pulled from GameState. XP/gold awarded on victory.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { getSpritePath } from '../../game/spriteUtils.js';
import { getCompanionPower, companionPowerMult } from '../../game/companions.js';
import { findNearestTown, ACT1_ZONES, ACT2_ZONES, ACT3_ZONES, ACT4_ZONES, ACT5_ZONES, ACT6_ZONES, ZONE_DROP_CHANCE, ZONE_FAME_MULT, ZONE_UNLOCK_MAP, ZONE_NAMES, ACT_BOSS_ZONES, BOSS_TAP_DROPS } from '../../maps/mapData.js';
const _ALL_ZONES_CS = [...ACT1_ZONES, ...ACT2_ZONES, ...ACT3_ZONES, ...ACT4_ZONES, ...ACT5_ZONES, ...ACT6_ZONES];
import { TownScreen } from './TownScreen.js';
import { LevelUpScreen } from './LevelUpScreen.js';
import { awardXp } from '../../game/xp.js';
import { generateItem, RARITY_COLORS, applyPotionEffect, getEquippedWeaponCategory, WEAPON_BASES } from '../../game/items.js';
import { getActiveSetBonuses, applySetBonusStats, getActiveLegendaryEffects } from '../../game/sets.js';
import { dispatchLegendaryHook, getActorLegendaryIds } from '../../game/legendaryEffects.js';

// ─────────────────────────────────────────────────────────────────────────
// M231/M357 — Attack Speed runtime. Always-on as of M357 — toggle removed
// from settings since the feature has shipped stable since M236.
function _attackSpeedEnabled() { return true; }
// Map weapon attackSpeed tier → extra actions per round.
//   normal    → 0 extra (1 total)
//   fast      → 1 extra (2 total)
//   very_fast → 2 extra (3 total; reserved for passives, but honored if set)
function _extraActionsForTier(tier) {
  if (tier === 'fast') return 1;
  if (tier === 'very_fast') return 2;
  return 0;
}
function _combatantExtraActions(m) {
  if (!_attackSpeedEnabled()) return 0;
  const w = m?.equipment?.weapon;
  if (!w) return 0;
  const tier = w.attackSpeed || WEAPON_BASES[w.baseKey]?.attackSpeed || 'normal';
  return _extraActionsForTier(tier);
}
// ─────────────────────────────────────────────────────────────────────────
import { getUnlockedSkills, mergeSkillForCast, SKILLS } from '../../game/skills.js';
import { isCompanionLevelSyncEnabled, isUiOverhaulEnabled, isCombatCaptionsEnabled } from './SettingsScreen.js';
import { getPassiveBonuses, computeMaxHp, computeMaxMp } from '../../game/passives.js';
import { resolveSprite } from '../../game/appearances.js';
import {
  rollToHit,
  applyArmorMitigation,
  applyMitigation,
  mitigationLogTag,
  getCharacterBlockStats,
  rollBlock,
  applyBlock,
  computeHeroArmor,
  computeHeroEquipDmgBonus,
  computeHeroDamage,
  computeHeroHit,
  computeHeroDodge,
  computeHeroInitiative,
  computeGoldReward,
  computeXpReward,
  enemyScalingForNgPlus,
  getEquipmentAffixBonuses,
} from '../../game/formulas.js';
import { debug } from '../../utils/debug.js';
import { combatDebug, parseDamageFromLogLine } from '../../utils/combatDebug.js';
import { pushEvent as _pushTelemetryEvent, isAnalyticsEnabled as _analyticsEnabled } from '../../utils/consent.js';
import { showToast } from '../components/toast.js';
import { isReducedMotion } from '../../utils/motion.js';
import { addDmgBuff, clearDmgBuff, addCritBonusStatus, getCritBonusTotal, isSilenced } from '../../mods/statusModel.js';
import { TAP_ALL, getTapItem, resolveTap } from '../../game/tapWeapons.js';
import { getBalance } from '../../game/balance-loader.js';
import { TapInventoryScreen } from './TapInventoryScreen.js';
import { wrapMitigationTags, attachMitTooltips, attachDmgBreakdownTooltips } from '../components/StatColors.js';
import { logImage } from '../../utils/imageLog.js';
import { hasStatusParticle, createStatusParticleEl } from '../statusParticles.js';
import { computeCombatLayout } from '../combatLayout.js';
import { getCombatDebugSettings, setCombatDebugSettings } from '../../game/combatDebugSettings.js';
import { getSpriteAdjustment } from '../../game/spriteAdjustments.js';
import { recordDamageDealt, recordHeal, recordKill, recordDodge, recordBlock, recordDeath, recordFightStart, recordFightEnd, recordGold, recordXp, recordDamageBySkill, recordDamageTakenBySource, recordDamageTakenByHero, recordFightLog, flushRunStatsCache } from '../../game/stats.js';
// M273: extracted meter aggregator. Pure data layer; render stays here.
import {
  createMeter,
  ensureEntry as _meterEnsureEntry_,
  meterAddDamage as _meterAddDamage,
  meterAddHeal as _meterAddHeal,
  meterAddMit as _meterAddMit,
  meterAddDodge as _meterAddDodge,
} from './_meterTracker.js';
// M274: extracted damage pipeline. Pure mitigation math; CombatScreen wraps
// it with the stance-revert timer and meter telemetry.
import { resolveIncomingDamage } from './_damagePipeline.js';
// M274: extracted hero AI. Pure skill-picker; CombatScreen executes the pick.
import { pickHeroAction } from './_aiTargeting.js';
// M303: enemy spells + champion modifiers
import { ENEMY_SPELLS, resolveSpells } from '../../game/enemySpells.js';
import { CHAMPION_MODIFIERS, MODIFIER_POOL, rollChampionModifiers, applyChampionStatMods } from '../../game/championModifiers.js';
import { playSpellFx } from '../components/spellFx.js';
// M274: extracted parallax-layer builder. Pure canvas drawing.
import { buildParallaxLayer } from './_backgroundRenderer.js';
import { formatStat } from '../../utils/numberFormat.js';
// M304: multi-phase boss system
import { initBossPhases, checkBossPhaseTransition, getPhaseThresholds } from '../../game/bossPhases.js';
// M304: per-boss themed loot tables
import { rollBossLoot } from '../../game/bossLoot.js';
import { generateUnique as _generateUnique } from '../../game/uniques.js';
// Structural extraction — seam 1: hover tooltips (champion badges + status effects)
import {
  showChampionHoverTip as _tooltipShowChampion,
  hideChampionHoverTip as _tooltipHide,
  showSpriteHoverTip as _tooltipShowSprite,
  showChampionInfo as _tooltipShowChampionInfo,
} from './combat/combatTooltips.js';
// Structural extraction — seam 2: enemy AI turn logic
import {
  enemyAI as _combatEnemyAI,
  executeEnemySpell as _combatExecuteEnemySpell,
  enemySpellFizzle as _combatEnemySpellFizzle,
} from './combat/combatEnemyAI.js';
// Structural extraction — seam 3: meter DOM rendering + combat report overlay
import {
  renderMeter as _meterRender,
  toggleMeterMode as _meterToggleMode,
  scheduleMeterRender as _meterScheduleRender,
  toggleMeterVisible as _meterToggleVisible,
  showCombatReportOverlay as _showCombatReport,
  buildCombatReportHtml as _buildCombatReport,
} from './combat/combatMeterUI.js';
// Structural extraction — seam 4: combat log overlay + parity debug notice
import {
  showCombatLogOverlay as _showCombatLog,
  appendCombatDebugNotice as _appendCombatDbgNotice,
} from './combat/combatEndUI.js';

const TURN_SPEED = 0.5;
const HIT_FLASH = 0.18;

// M295 — STATUS_META moved to shared module; import so every screen uses the same data.
import { STATUS_META } from '../../game/statusEffects.js';

/**
 * M293/M295 — Render a compact status icon row for the HUD.
 * Each icon is a 14×14 SVG circle with a letter glyph + superscript duration.
 * Hover / tap-hold (via title attribute) shows the plain-language description.
 */
function _renderStatusRow(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) return '';
  // Group by type. Multi-stack types show stack count + max duration.
  const byType = new Map();
  for (const s of statuses) {
    if (!s || !s.type) continue;
    const prev = byType.get(s.type);
    if (!prev) {
      byType.set(s.type, { ...s, _count: 1, _maxDur: s.duration || 0 });
    } else {
      prev._count++;
      if ((s.duration || 0) > prev._maxDur) prev._maxDur = s.duration || 0;
    }
  }
  if (byType.size === 0) return '';
  const icons = [...byType.values()].map(s => {
    const meta = STATUS_META[s.type] || { glyph: s.type.charAt(0).toUpperCase(), color: '#aaa', plain: s.type };
    const dur = s._maxDur != null && s._maxDur > 0 ? s._maxDur : '';
    const stackLabel = s._count > 1 ? `×${s._count}` : '';
    const title = `${meta.name || (s.type.charAt(0).toUpperCase() + s.type.slice(1))}: ${meta.plain}${s._count > 1 ? ` (${s._count} stacks)` : ''}${dur !== '' ? ` (${dur} round${dur === 1 ? '' : 's'} remaining)` : ''}`;
    return `<span class="hst-icon" title="${title}" aria-label="${title}" style="color:${meta.color};border-color:${meta.color}20">${meta.glyph}${stackLabel ? `<sup>${stackLabel}</sup>` : dur !== '' ? `<sup>${dur}</sup>` : ''}</span>`;
  });
  return icons.join('');
}

// Sprite map: class/enemy id → image key prefix in /images/sprites/
const SPRITE_MAP = {
  // Heroes (by class id)
  warrior: 'warrior', fighter: 'fighter', mage: 'mage', paladin: 'paladin', ranger: 'ranger', rogue: 'rogue', cleric: 'cleric', bard: 'bard', necromancer: 'necromancer',
  warlock: 'warlock', demon_hunter: 'demon_hunter', scavenger: 'scavenger', swashbuckler: 'swashbuckler', dragon_knight: 'dragon_knight',
  pyromancer: 'pyromancer',
  stormcaller: 'stormcaller', druid: 'druid', oracle: 'oracle', tactician: 'tactician', chronomancer: 'chronomancer',
  // M150 phantom classes
  monk: 'monk', shaman: 'shaman', witch_hunter: 'witch_hunter', knight: 'knight',
  sorcerer: 'sorcerer', runesmith: 'runesmith', shadow_dancer: 'shadow_dancer',
  // M269 Tinker class + clockwork companion
  tinker: 'tinker',
  clockwork_turret: 'clockwork_turret', pet_clockwork_turret: 'clockwork_turret',
  // Companions
  war_dog: 'war_dog',
  dire_wolf: 'dire_wolf', forest_owl: 'forest_owl', ember_drake: 'ember_drake',
  shadow_cat: 'shadow_cat', crystal_golem: 'crystal_golem', spirit_wisp: 'spirit_wisp',
  bone_hound: 'bone_hound', ice_sprite: 'ice_sprite', swamp_frog: 'swamp_frog', void_moth: 'void_moth',
  // Class pets (M112+) — sprites at public/images/spritecook/pet_*.png
  pet_skeletal_warrior: 'pet_skeletal_warrior', pet_bone_golem: 'pet_bone_golem',
  pet_wolf: 'pet_wolf', pet_bear: 'pet_bear',
  pet_imp: 'pet_imp', pet_demon: 'pet_demon',
  pet_war_hound: 'pet_war_hound',
  pet_fire_elemental: 'pet_fire_elemental', pet_lightning_elemental: 'pet_lightning_elemental',
  pet_familiar: 'pet_familiar',
  // Dragon expansion companions & enemies (placeholder sprites reuse dragon_knight art)
  dragon_hatchling: 'dragon_hatchling', frost_wyrmling: 'frost_wyrmling',
  storm_drake: 'storm_drake', shadow_wyrm: 'shadow_wyrm',
  dragon_whelp: 'dragon_whelp', wyrm_warrior: 'wyrm_warrior',
  // Elite dragon enemies — dedicated OpenAI art (M79)
  storm_dragon: 'storm_dragon', frost_wyrm: 'frost_wyrm', ancient_dragon: 'ancient_dragon',
  dragon_cultist: 'dragon_cultist', dragon_king: 'dragon_king',
  shadow_dragon: 'shadow_wyrm', ember_dragon: 'dragon_hatchling', ancient_wyrm: 'ancient_dragon', dragonking: 'dragon_king',
  // Enemies (by enemy id)
  goblin_scout: 'goblin_scout', goblin_warrior: 'goblin_warrior', goblin_shaman: 'goblin_shaman', goblin_warlord: 'goblin_warlord',
  imp: 'imp', hell_knight: 'hell_knight', molten_golem: 'molten_golem',
  corrupted_wolf: 'corrupted_wolf', void_shade: 'void_shade', ash_wraith: 'ash_wraith',
  corrupted_bear: 'corrupted_bear', demon_brute: 'demon_brute', cinder_hound: 'cinder_hound',
  veil_cultist: 'veil_cultist', bandit: 'bandit', grax_veil_touched: 'grax_veil_touched', lava_titan: 'lava_titan',
  // Act 2 enemies
  veil_sorcerer: 'veil_sorcerer', bandit_captain: 'bandit_captain', veil_warden: 'veil_warden',
  giant_spider: 'giant_spider', emberveil_sovereign: 'emberveil_sovereign',
  // Act 3 enemies
  archfiend_malgrath: 'archfiend_malgrath',
  // M278 prologue mini-boss
  veilspawn_herald: 'veilspawn_herald',
  // Act 4 enemies
  star_horror: 'star_horror', cosmic_titan: 'cosmic_titan', void_wraith: 'void_wraith',
  void_prophet: 'void_prophet', the_unraveler: 'the_unraveler',
  // Act 5 enemies
  primordial_elemental: 'primordial_elemental', abyssal_knight: 'abyssal_knight',
  reality_shard: 'reality_shard', genesis_worm: 'genesis_worm', the_architect: 'the_architect',
};

// M79: sprites whose OpenAI east variant ended up facing the wrong direction.
// Listed keys are drawn with horizontal-flip inverted (heroes flipped, enemies unflipped).
// Add a key here if you spot a character facing backwards in combat.
// M473 — emptied. The M467 regen fixed goblin_shaman to face east correctly,
// so the legacy override was double-flipping (enemy → faces away from party).
// Keep the Set in place for future per-sprite overrides; just don't auto-include.
const FLIP_EAST = new Set([]);

// Preloaded sprite cache: key → { east, south, east_attack, east_spell, east_ko, east_block } HTMLImageElement
const _spriteCache = {};

// Combat-background image cache. Loaded on demand per zone from
// public/images/combat_bg/backgrounds.json (M65). Falls back to the
// procedural palette drawer if no image matches or the asset fails to load.
const _combatBgCache = {}; // zoneId -> { img, status }
let _combatBgManifest = null;
let _combatBgManifestFetch = null;
function _ensureCombatBgManifest() {
  if (_combatBgManifest || _combatBgManifestFetch) return;
  const url = `${import.meta.env.BASE_URL}images/combat_bg/backgrounds.json`;
  _combatBgManifestFetch = fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(j => { _combatBgManifest = j || {}; })
    .catch(() => { _combatBgManifest = {}; });
}
function _getCombatBgImage(zoneId) {
  if (!zoneId) return null;
  const cached = _combatBgCache[zoneId];
  if (cached) return cached.img && cached.img.complete && cached.img.naturalWidth > 0 ? cached.img : null;
  _ensureCombatBgManifest();
  if (!_combatBgManifest || !_combatBgManifest.zones) return null;
  const entry = _combatBgManifest.zones[zoneId];
  if (!entry || !entry.backgrounds || !entry.backgrounds.length) {
    _combatBgCache[zoneId] = { img: null, status: 'missing' };
    return null;
  }
  // Deterministic pick by zone id so the same fight keeps a stable BG.
  let seed = 0;
  for (let i = 0; i < zoneId.length; i++) seed = (seed * 31 + zoneId.charCodeAt(i)) | 0;
  const pick = entry.backgrounds[Math.abs(seed) % entry.backgrounds.length];
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}images/combat_bg/${pick}`;
  _combatBgCache[zoneId] = { img, status: 'loading' };
  return null; // first draw returns null; subsequent draws hit the completed image
}

function _loadSprite(key) {
  if (_spriteCache[key]) return _spriteCache[key];
  const imgs = {};
  const BASE = import.meta.env.BASE_URL;
  const spritesBase = `${BASE}images/sprites/${key}`;
  // M484b — 'death' removed: there is no <id>_death.png file. The renderer
  // maps stance='death' → 'east_ko' at draw time (line ~7299), so preloading
  // a 'death' variant only generated 404s on every combat enter.
  for (const variant of ['east', 'south', 'east_attack', 'east_spell', 'east_ko', 'east_block']) {
    const img = new Image();
    // M463 — manifest-driven primary path (resolves to openai_v2 or
    // spritecook per the appearances-manifest). Legacy sprites/ dir is the
    // onerror fallback so older characters with no manifest entry still draw.
    img.src = getSpritePath(key, variant);
    img.onerror = function () {
      if (!img.dataset.fallbackTried) {
        img.dataset.fallbackTried = '1';
        img.src = `${spritesBase}_${variant}.png`;
      }
    };
    imgs[variant] = img;
  }
  _spriteCache[key] = imgs;
  return imgs;
}

// M419: ZONE_DROP_CHANCE/ZONE_FAME_MULT/ZONE_UNLOCK_MAP/ZONE_NAMES/
// ACT_BOSS_ZONES/BOSS_TAP_DROPS now live in maps/mapData.js (imported above).
const ZONE_BASES = {
  border_roads: ['sword','dagger','light_chest','ring'],
  thornwood:    ['sword','axe','medium_chest','gloves','ring'],
  dust_roads:   ['axe','mace','medium_chest','boots','amulet'],
  ember_plateau:['greatsword','heavy_chest','helmet','amulet'],
  hell_breach:  ['greatsword','heavy_chest','helmet','amulet','staff'],
  shattered_core:['staff','wand','heavy_chest','amulet','ring'],
  cosmic_rift:  ['staff','wand','heavy_chest','amulet','ring'],
  eternal_void: ['staff','wand','heavy_chest','amulet','ring'],
};
const ZONE_RARITY = { border_roads:'normal', thornwood:'magic', dust_roads:'magic', ember_plateau:'rare', hell_breach:'rare', shattered_core:'rare', cosmic_rift:'legendary', eternal_void:'legendary' };
const ZONE_QUALITY = { border_roads:'low', thornwood:'medium', dust_roads:'medium', ember_plateau:'high', hell_breach:'high', shattered_core:'elite', cosmic_rift:'elite', eternal_void:'exotic' };

export class CombatScreen {
  constructor(manager, audio, heroOrNull, encounter) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this.encounter = encounter;
    debug.combat('encounter loaded', { id: encounter?.id, enemies: (encounter?.enemies || []).map(e => e.id || e.name) });
    this._el = null;
    this._t = 0;
    this._turnTimer = 0;
    this._phase = 'START'; // START|PLAYING|VICTORY|DEFEAT
    this._isBossFight = !!(encounter && (encounter.isBoss || encounter._bossNodeId || (encounter.enemies || []).some(e => e.isBoss)));
    this._startDelay = this._isBossFight ? 3.0 : 1.2;
    // Preload sprites for heroes and enemies
    this._preloadSprites(encounter);
    this._particles = [];
    this._dmgNumbers = []; // floating damage text
    this._flashMap = new Map();
    this._tapEffects = []; // M72: active tap projectiles/bursts
    this._tapHint = null; // transient hint text
    GameState.resetTapCombat?.();
    this._round = 1;
    this._log = [];
    this._lootItems = [];
    // M95: Vengeance stack bonus — count allies that fall during this combat.
    this._allyDeathCount = 0;

    // Build heroes from GameState party
    GameState.sanitizeRoster?.();
    const gs = GameState.get();
    // M380 — pre-stamp _effectiveLevel on source companion members BEFORE
    // building combatants so _memberToCombatant can apply per-level stat
    // bonuses (HP/damage/etc) for synced companions.
    const _heroMembers = gs.party.filter(m => !(m.isCompanion || m.class === 'companion'));
    const _companionMembers = gs.companions.filter(m => m.isCompanion || m.class === 'companion');
    if (isCompanionLevelSyncEnabled() && _heroMembers.length > 0) {
      const _heroAvg = Math.round(_heroMembers.reduce((s, m) => s + (m.level || 1), 0) / _heroMembers.length);
      for (const cm of _companionMembers) cm._effectiveLevel = _heroAvg;
    }
    this._heroes = _heroMembers.map(m => this._memberToCombatant(m));
    this._companions = _companionMembers.map(m => {
      const c = this._memberToCombatant(m);
      // M412 — apply power-tier HP/dmg curve so tier-5 companions are notably
      // stronger than tier-1 ones at the same effective level.
      try { this._applyCompanionPowerScaling(c, m); } catch (_) {}
      return c;
    });
    // M302: Companion Level Sync — when ON, compute party-average hero level
    // and stamp _effectiveLevel on each companion combatant (shadow value only;
    // the companion's m.level is never mutated). We also recalculate initiative
    // using the synced level so turn order reflects the adjusted power.
    if (isCompanionLevelSyncEnabled() && this._heroes.length > 0) {
      const heroMembers = _heroMembers;
      const heroAvgLevel = Math.round(heroMembers.reduce((s, m) => s + (m.level || 1), 0) / heroMembers.length);
      const companionGsMap = new Map((gs.companions || []).map(m => [m.id, m]));
      for (const c of this._companions) {
        c._effectiveLevel = heroAvgLevel;
        // Recalc initiative with synced level (initiative = DEX * coef + level * coef)
        const srcM = companionGsMap.get(c.id);
        if (srcM) {
          const ab = getEquipmentAffixBonuses(srcM);
          const base = srcM.attrs || { STR:8, DEX:8, INT:8, CON:10 };
          const pb = getPassiveBonuses(srcM);
          const s2 = { DEX: (base.DEX || 8) + pb.DEX + (ab.dex || 0) };
          c.initiative = computeHeroInitiative(s2, heroAvgLevel) + (ab.initiative || 0);
        }
      }
    }
    this._allies = [...this._heroes, ...this._companions];
    // M261: meter state — per-ally accumulators.
    // M267: expanded meter — per-ally accumulators for damage dealt, heal
    // dealt (incl. lifesteal/barrier/shield), and mitigation absorbed
    // (armor/block/barrier/spell-resist/dodge-count). Each event is also
    // recorded as a granular hit row for the Combat Report drill-down.
    // M273: meter state moved into the pure tracker module. _meterData and
    // _meterEvents are kept as references for the existing render/report
    // code paths (which read from them directly).
    this._meter = createMeter();
    this._meterData = this._meter.data;
    this._meterEvents = this._meter.events;
    // Pre-seed ally entries so they appear in row order even before they act.
    for (const a of this._allies) _meterEnsureEntry_(this._meter, a, 'ally');
    this._meterMode = 'damage'; // 'damage' | 'heal' | 'mitigation'
    this._meterShowEnemies = false;

    // Build enemies
    this._enemyGroups = encounter.enemies.map((e, gi) => this._buildGroup(e, gi));
    this._allEnemies = this._enemyGroups.flat();

    this._buildTurnOrder();

    // M305: fire onCombatStart legendary hooks for all hero combatants.
    this._dispatchLegendaryToAllies('onCombatStart');
  }

  _memberToCombatant(m) {
    // M50: fold passive bonuses into stats used by combat formulas.
    let base = m.attrs || { STR:8, DEX:8, INT:8, CON:10 };
    // M380 — companion stat scaling. When synced to a higher effective level,
    // give the companion attribute bonuses per level above its template so it
    // keeps pace into Acts 4-5 instead of stalling at hire stats.
    const _isComp = !!(m.isCompanion || m.class === 'companion');
    if (_isComp && m._effectiveLevel && m._effectiveLevel > (m.level || 1)) {
      const _bonus = getBalance().companions?.statBonusPerLevel || {};
      const _delta = m._effectiveLevel - (m.level || 1);
      // M427 — power-tier multiplier so star rating actually shapes the
      // companion's combat output (mirror of simulator.js change).
      const _power = getCompanionPower(m);
      const _pm = companionPowerMult(_power);
      base = {
        STR: (base.STR || 8) + Math.round((_bonus.STR || 0) * _delta * _pm),
        DEX: (base.DEX || 8) + Math.round((_bonus.DEX || 0) * _delta * _pm),
        INT: (base.INT || 8) + Math.round((_bonus.INT || 0) * _delta * _pm),
        CON: (base.CON || 8) + Math.round((_bonus.CON || 0) * _delta * _pm),
      };
    }
    const pb = getPassiveBonuses(m);
    // M93: affix bonuses flow through a shared helper so every stat site sees
    // the same numbers. Unknown affix keys (legacy burn/bleed) are ignored.
    const ab = getEquipmentAffixBonuses(m);
    // M305: set bonuses — fold active set partial bonuses into ab before stats.
    const eqpForSets = m.equipment || {};
    try {
      const activeSets = getActiveSetBonuses(eqpForSets);
      applySetBonusStats(activeSets, ab);
    } catch (_) {}
    const s = {
      STR: (base.STR || 8) + pb.STR + (ab.str || 0),
      DEX: (base.DEX || 8) + pb.DEX + (ab.dex || 0),
      INT: (base.INT || 8) + pb.INT + (ab.int || 0),
      CON: (base.CON || 8) + pb.CON + (ab.con || 0),
    };
    const eqp = eqpForSets;
    const eqpArmor = computeHeroArmor(eqp) + (ab.armor || 0);
    // M116: Sharp (ab.dmg) is now PHYSICAL-ONLY — magic weapons ignore it.
    // Magic weapons instead scale via the new `spellPower` affix (Potency),
    // which bumps their base damage range AND all magic skill damage.
    const wcat = getEquippedWeaponCategory(eqp);
    const physDmgBonus = (wcat === 'magic') ? 0 : (ab.dmg || 0);
    const magDmgBonus  = (wcat === 'magic') ? Math.round(ab.spellPower || 0) : 0;
    const eqpDmgBonus = computeHeroEquipDmgBonus(eqp) + physDmgBonus + magDmgBonus;
    // M84: shield block stats + magic resist default.
    const blockStats = getCharacterBlockStats({ equipment: eqp });
    // M93: computeMaxHp/Mp already fold affix bonuses internally now.
    // M380: when companion stat scaling kicks in, recompute maxHp/Mp from the
    // adjusted CON/INT (computeMaxHp reads m.attrs which doesn't reflect the
    // local `base` override).
    const _bal2 = getBalance();
    let maxHp, maxMp;
    if (_isComp && m._effectiveLevel && m._effectiveLevel > (m.level || 1)) {
      const _hpC = _bal2.combat.maxHp;
      const _mpC = _bal2.combat.maxMp;
      maxHp = _hpC.base + s.CON * _hpC.conMult + (pb.maxHp || 0) + (ab.hp || 0);
      maxMp = _mpC.base + s.INT * _mpC.intMult + (pb.maxMp || 0) + (ab.mp || 0);
    } else {
      maxHp = m.maxHp ?? computeMaxHp(m);
      maxMp = m.maxMp ?? computeMaxMp(m);
    }
    const isCompanion = !!(m.isCompanion || m.class === 'companion');
    const heroHit = Math.min(95, computeHeroHit(s) + (ab.hit || 0));
    const dodgeCap = isCompanion ? 15 : 40;
    const heroDodge = Math.min(dodgeCap, computeHeroDodge(s, isCompanion) + (ab.dodge || 0));
    return {
      id: m.id,
      templateId: m.templateId,
      name: m.name,
      class: m.class,
      className: m.className,
      appearance: m.appearance || null,
      isHero: true,
      isCompanion,
      hp: m.hp ?? maxHp,
      maxHp,
      mp: m.mp ?? maxMp,
      maxMp,
      dmg: computeHeroDamage(s, eqpDmgBonus, getEquippedWeaponCategory(eqp)),
      weaponCategory: getEquippedWeaponCategory(eqp),
      armor: eqpArmor,
      magicResist: ab.magicResist || 0,
      blockChance: blockStats.blockChance + (pb.blockChance || 0),
      blockPower: blockStats.blockPower,
      hit: heroHit,
      dodge: Math.min(60, heroDodge + (pb.dodgePct || 0)),
      // M176: passive-derived reactive/offensive hooks.
      passiveThorns: pb.thorns || 0,
      passiveResistAll: pb.resistAll || 0,
      passiveBurnOnHit: pb.burnOnHit || 0,
      passivePoisonOnCrit: pb.poisonOnCrit || 0,
      passiveChainOnHit: pb.chainOnHit || 0,
      passiveHpOnKill: pb.hpOnKill || 0,
      passiveManaOnKill: pb.manaOnKill || 0,
      initiative: computeHeroInitiative(s, m.level) + (ab.initiative || 0),
      // M93: back-reference so computeGoldReward can sum goldFind from the
      // hero even when the caller only has the built combatants.
      _srcMember: m,
      alive: (m.hp ?? 1) > 0,
      stance: 'ready',
      // M340 — magic-shield Barrier seeded as a persistent status. The
       // existing barrier-absorb path in _applyDamage subtracts from this
       // pool before HP. The per-round update routine refills it up to
       // _maxBarrier by barrierRegen each round end.
      statuses: (() => {
        const out = [];
        const maxBarrier = ab.barrier || 0;
        const regen = ab.barrierRegen || 0;
        if (maxBarrier > 0) {
          out.push({
            type: 'barrier',
            power: maxBarrier,
            duration: Infinity,
            regen,
            maxPower: maxBarrier,
            fromMagicShield: true,
          });
        }
        return out;
      })(), // { type, duration, power, regen?, maxPower? }
      // M131: per-skill cooldown map (skillId → rounds remaining). Replaces the
      // legacy shared `skillCooldown` integer that locked all skills when one fired.
      skillCooldowns: {},
      // Steal stats from equipment affixes + passives.
      lifeSteal: (ab.lifeSteal || 0) + (pb.lifesteal || 0),
      manaSteal: ab.manaSteal || 0,
      // M50: passive-derived combat modifiers.
      critBonus: pb.critPct || 0,
      // M116: crit affixes — critChance (fractional 0–0.75) + critDamage
      // (fractional extra multiplier; base crit is always 1.5×).
      critChance: ab.critChance || 0,
      critDamage: ab.critDamage || 0,
      // M116: Potency affix — flat spell-power bonus (adds to INT-derived spell
      // damage multiplier). Only applied inside _castSkill for magic skills.
      affixSpellPower: ab.spellPower || 0,
      hpRegen: pb.hpRegen || 0,
      mpRegenBonus: pb.mpRegen || 0,
      // M95: Swashbuckler Flair stacks for Flourish → Grandeur combo.
      flairStacks: 0,
      // [M231 AS] bonus actions-per-round from weapon attackSpeed tier.
      // Zero unless the feature flag is on; cached once per combatant build
      // so equipping a faster weapon mid-battle won't retroactively grant
      // bonus attacks until the next encounter.
      _speedExtraPerRound: _combatantExtraActions(m),
      x: 0, y: 0, offsetX: 0, offsetY: 0,
      // M305: legendary effect IDs from active sets + unique items.
      _legendaryEffectIds: (() => {
        try {
          const activeSets = getActiveSetBonuses(eqp);
          const setEffects = getActiveLegendaryEffects(activeSets);
          // Unique items carry legendaryEffectId directly on the item object.
          const uniqueEffects = Object.values(eqp)
            .filter(it => it?.isUnique && it?.legendaryEffectId)
            .map(it => it.legendaryEffectId);
          return [...new Set([...setEffects, ...uniqueEffects])];
        } catch (_) { return []; }
      })(),
    };
  }

  // M412 — companion power-tier scaling. Applies a tier-based HP/dmg curve
  // to a built combatant so a tier-5 companion (e.g. Crimson Dragon Hatchling)
  // is meaningfully stronger than a tier-1 (e.g. War Dog) at the same level.
  // Honors m._effectiveLevel (party-avg-driven scaling) so a Tier-1 companion
  // joining a level-15 party still gets HP/dmg appropriate for its tier × 15.
  _applyCompanionPowerScaling(c, m) {
    if (!c || !(c.isCompanion)) return c;
    const id = m?.templateId || m?.id || '';
    // Power tier table (mirrors COMPANION_POWER in TownScreen.js to avoid an
    // import cycle). 1=basic, 5=elite.
    const POWER = {
      war_dog: 1, forest_owl: 1, swamp_frog: 1,
      bone_hound: 2, ice_sprite: 2, shadow_cat: 2,
      dire_wolf: 3, spirit_wisp: 3, void_moth: 3,
      ember_drake: 4, crystal_golem: 4,
      dragon_hatchling: 5, frost_wyrmling: 5, storm_drake: 5, shadow_wyrm: 5,
    };
    const P = (typeof m?.power === 'number' ? m.power
              : POWER[id] != null ? POWER[id]
              : id.startsWith('pet_') ? 2
              : 2);
    const L = Math.max(1, Math.round(m?._effectiveLevel || m?.level || 1));
    const newMaxHp = Math.round(30 * P + 8 * P * L);
    const dmgLo = Math.max(1, Math.round(3 + P + P * L));
    const dmgHi = Math.max(dmgLo + 1, Math.round(5 + 2 * P + 1.5 * P * L));
    // Only override when our tier-driven number is higher than the legacy
    // attribute-derived one — keeps existing balance from regressing for
    // niche tank-stat builds while pulling weak power-tier companions up.
    if (newMaxHp > c.maxHp) {
      c.maxHp = newMaxHp;
      if ((c.hp ?? 0) <= 0 || c.hp > newMaxHp) c.hp = newMaxHp;
    }
    if (Array.isArray(c.dmg)) {
      const curMid = (c.dmg[0] + c.dmg[1]) / 2;
      const newMid = (dmgLo + dmgHi) / 2;
      if (newMid > curMid) c.dmg = [dmgLo, dmgHi];
    } else {
      c.dmg = [dmgLo, dmgHi];
    }
    c.power = P;
    c._effectiveLevel = L;
    return c;
  }

  _buildGroup(e, gi) {
    const ng = GameState.getNgPlus();
    // M65: NG+ scaling is now AGGRESSIVE. Target: every enemy in NG+ tier T
    // is substantially harder than its last-act counterpart in tier T-1.
    // Base stats in mapData range roughly 20hp (Act 1) → 900hp (Act 5 final).
    // We scale hp by ~4.5× per tier and dmg by ~2.8× per tier, with a boss
    // kicker so bosses remain a genuine wall. Hit/dodge nudge up too.
    const _scaled0 = enemyScalingForNgPlus(e, ng);
    // M380 — per-act enemy multipliers (Acts 3+ ramp up so late-game fights
    // last 12-20 rounds). Source act from the encounter zone or current act.
    const _act = (this.encounter?.act
      ?? this.encounter?.zone?.act
      ?? GameState.get().act
      ?? 1) | 0;
    // M382: in NG+, shift the effective act for actMultiplier lookup so
    // Act 1 NG+1 picks up Act 5's enemy ramp (the player has just finished
    // the game; Act 1 baseline would feel trivial).
    // M386: cap raised 6 -> 10 and actMultipliers table extended so NG+2+
    // doesn't pin every zone to the Act-6 ceiling.
    const _effAct = ng > 0 ? Math.min(10, _act + 4 * ng) : _act;
    const _actM = getBalance().enemies?.actMultipliers?.[_effAct]
               ?? getBalance().enemies?.actMultipliers?.[String(_effAct)];
    const _actHp  = _actM?.hp ?? 1.0;
    const _actDmg = _actM?.damage ?? 1.0;
    // M380 — boss HP damper: bosses already have inflated HP from M315 so
    // they receive ~45% of the per-act bonus instead of the full ramp.
    const _isBoss = !!(e.isBoss || (this._isBossFight && (e.count === 1 || e.name === this.encounter?.name)));
    const _hpRamp = _isBoss ? (1.0 + (_actHp - 1.0) * 0.35) : _actHp;
    // M382 — party-size enemy damage scaling. Heroes only (companions excluded).
    const _heroCount = Math.max(1, (this._heroes || []).length);
    const _psTbl = getBalance().partySize?.enemyDmgMult || {};
    const _psKey = Math.max(1, Math.min(4, _heroCount));
    const _partyDmg = _psTbl[_psKey] ?? _psTbl[String(_psKey)] ?? 1.0;
    const scaled = {
      ..._scaled0,
      hp:  Math.max(1, Math.round(_scaled0.hp  * _hpRamp)),
      dmg: _scaled0.dmg.map(d => Math.max(1, Math.round(d * _actDmg * _partyDmg))),
    };
    return Array.from({ length: e.count }, (_, i) => {
      const baseCombatant = {
        id: `${e.id}_${gi}_${i}`,
        name: ng > 0 ? `${e.name} ${'✦'.repeat(Math.min(ng, 3))}` : e.name,
        enemyId: e.id,
        groupIdx: gi,
        isHero: false,
        // M348 — propagate _isBossFight to the encounter's combatants so
        // bossScale applies to enemies on boss-typed nodes (veilspawn_herald
        // and other enemies that aren't tagged isBoss in mapData but are
        // the only/named enemy in a boss-tagged encounter).
        isBoss: !!(e.isBoss || (this._isBossFight && (e.count === 1 || e.name === this.encounter?.name))),
        role: e.role || null, // 'healer' | 'tank' | null
        hp: scaled.hp, maxHp: scaled.hp,
        mp: e.mp || 0, maxMp: e.mp || 0,
        dmg: [...scaled.dmg], armor: scaled.armor,
        // M84: magic resist schema default (rebalance lands in a later milestone).
        magicResist: e.magicResist || 0,
        // Enemy blockChance from ENEMIES data (blockMitigation defaults to 0.5 = 50% partial mitigation).
        blockChance: e.blockChance || 0,
        blockMitigation: e.blockMitigation || 0.5,
        blockPower: 0,
        hit: scaled.hit,
        dodge: scaled.dodge,
        initiative: 4 + Math.random() * 6,
        xpValue: scaled.xpValue, gold: e.gold,
        alive: true, stance: 'ready',
        statuses: [], skillCooldowns: {},
        x: 0, y: 0, offsetX: 0, offsetY: 0,
        // M303: spell fields (safe defaults so old saves and non-spell enemies work)
        spellList: e.spellList ? [...e.spellList] : [],
        spellChance: e.spellChance || 0,
        stealableBuffs: e.stealableBuffs ? [...e.stealableBuffs] : undefined,
        // wind-up state: { spellId, roundsLeft, dmgTaken }
        _windUp: null,
      };
      // M303: Champion roll — 5% chance for non-boss, non-named enemies
      if (!baseCombatant.isBoss && !e.isNamed && Math.random() < 0.05) {
        const modIds = rollChampionModifiers();
        // Apply base champion bumps first (+50% HP, +30% dmg)
        baseCombatant.hp    = Math.round(baseCombatant.hp    * 1.5);
        baseCombatant.maxHp = Math.round(baseCombatant.maxHp * 1.5);
        baseCombatant.dmg   = baseCombatant.dmg.map(d => Math.round(d * 1.3));
        baseCombatant.xpValue = Math.round(baseCombatant.xpValue * 1.4);
        // Apply individual modifier stat bonuses
        applyChampionStatMods(baseCombatant, modIds);
        // Round hp after all mults
        baseCombatant.hp    = Math.round(baseCombatant.hp);
        baseCombatant.maxHp = Math.round(baseCombatant.maxHp);
        // Mark as champion
        baseCombatant.isChampion = true;
        baseCombatant.championMods = modIds;
        baseCombatant.name = `${baseCombatant.name}`;
        baseCombatant._championLabel = `[Champion]`;
      }
      // M304: initialize boss phase tracking for phased bosses
      initBossPhases(baseCombatant);
      return baseCombatant;
    });
  }

  _buildTurnOrder() {
    const all = [...this._allies, ...this._allEnemies].filter(c => c.alive);
    all.forEach(c => {
      const initiativeBase = c.initiative;
      const random = Math.random() * 10;
      let roll = initiativeBase + random;
      const slow = !!(c.statuses && c.statuses.some(s => s.type === 'slow'));
      // M94: slow status halves initiative roll (turn-order push-back).
      if (slow) roll *= 0.5;
      c._roll = roll;
      // [M231 AS] seed bonus-attack counter for this round. When the flag is
      // off this stays 0 and the executor below is a no-op.
      c._speedExtraRemaining = c._speedExtraPerRound || 0;
      // M377 — debug log every initiative roll.
      combatDebug.push('initiative_roll', {
        actor: c.name, actorId: c.id,
        base: initiativeBase, random, slow, total: roll,
        dexMod: c.attrs?.DEX || null,
      });
    });
    all.sort((a, b) => b._roll - a._roll);
    this._turnOrder = all;
    this._turnIdx = 0;
    // M388 — refresh top-of-screen turn-order strip whenever the queue rebuilds.
    if (this._evTurnStrip) {
      try { this._evTurnStrip.setCombatants({ allies: this._allies, enemies: this._allEnemies || this._enemies }); } catch (_) {}
      try { this._evTurnStrip.setTurnOrder(this._turnOrder, this._turnIdx, this._round | 0 || 1); } catch (_) {}
    }
    combatDebug.push('turn_order', {
      order: all.map(c => ({ name: c.name, id: c.id, roll: Math.round((c._roll || 0) * 100) / 100, side: this._allies?.includes(c) ? 'ally' : 'enemy' })),
    });
  }

  onPause() {
    // Called by ScreenManager when another screen is pushed on top (e.g. AchievementsScreen).
    // Pause the combat loop so ticks don't fire while hidden.
    this._speedBeforePause = this._speedMult;
    this._speedMult = 0;
    // M329 — also hide the combat root element. Without this, the victory
    // modal (which lives inside CombatScreen) kept rendering ON TOP of any
    // pushed screen because its z-index sits inside its own stacking
    // context and visually competes with the new screen below it. Result:
    // user clicked an achievement toast → AchievementsScreen pushed → but
    // the victory modal remained visible AND swallowed clicks → soft lock.
    if (this._el) this._el.style.display = 'none';
  }

  onResume() {
    // Restore combat speed when we return to the top of the stack.
    if (this._speedBeforePause !== undefined) {
      this._speedMult = this._speedBeforePause;
      this._speedBeforePause = undefined;
      // M384 — sync the HUD button so the indicator matches the restored speed.
      this._syncSpeedHud?.();
    }
    if (this._el) this._el.style.display = '';
    // If victory fired while an overlay was open, show the deferred modal now.
    if (this._deferredVictory) {
      const args = this._deferredVictory;
      this._deferredVictory = null;
      this._showVictoryModal(args);
    }
  }

  onEnter() {
    window.__activeCombatScreen = this;
    // M473 — clear any leftover flee-queued flag from a prior combat.
    try { GameState.get().fleeQueued = false; } catch (_) {}
    // M472 — defer Supabase save pushes during combat. A single 3-enemy
    // encounter was firing ~27 PATCHes (every turn churns state). The flag
    // is honored in cloudSaves.pushSave; CombatScreen flushes once on exit.
    window.__inCombat = true;
    // M412 — defensive cleanup of any stale dungeon-screen DOM left by a prior
    // pop path that didn't run onExit (user reported "Iron Barricade" panel
    // showing behind a boss fight after dungeon→town→boss). The DungeonScreen
    // owns its own DOM under uiOverlay; if we're starting a fresh combat with
    // no dungeon parent on the stack, any .dg-screen lingering is dead UI.
    try {
      const stack = this.manager?._stack || this.manager?.stack || [];
      const inDungeon = stack.some(s => s && s.constructor && s.constructor.name === 'DungeonScreen');
      if (!inDungeon) {
        document.querySelectorAll('.dg-screen').forEach(el => el.remove());
      }
    } catch (_) {}
    this.audio.playCombatMusic(this.encounter._zoneId || this.encounter.zoneId, { isBoss: this._isBossFight, act: GameState.get().act || 1 });
    // M78: preload pixel-art tap fx sprites (chain_lightning intentionally omitted — stays canvas-drawn)
    if (!CombatScreen._tapFxSprites) {
      CombatScreen._tapFxSprites = {};
      const ids = ['blade','bow','catapult','star_caller','ninja_stars','fireball','dragon_call','spirit_hammer','void_lance'];
      for (const id of ids) {
        const img = new Image();
        img.src = `images/tap_fx/${id}.png`;
        img.onload = () => { img._ready = true; };
        img.onerror = () => { img._failed = true; };
        CombatScreen._tapFxSprites[id] = img;
      }
    }
    this._build();
    // M396 — drain pending pre-combat statuses queued by skill-check failures
    // on the world map (e.g. "blind for 2 rounds"). Apply to every alive
    // ally and clear the queue. Without this, the failure flavor lied.
    try {
      const gsPS = GameState.get();
      const pending = gsPS._pendingStatusOnNextCombat;
      if (Array.isArray(pending) && pending.length) {
        for (const ps of pending) {
          if (!ps || !ps.type) continue;
          for (const ally of (this._allies || [])) {
            if (ally && ally.alive !== false) {
              this._applyStatus(ally, ps.type, ps.duration || 2, ps.power || 0);
            }
          }
        }
        gsPS._pendingStatusOnNextCombat = [];
      }
      // M406 — dungeon skill-check pass: stun all enemies for round 1.
      if (gsPS._pendingDungeonStunRound1) {
        gsPS._pendingDungeonStunRound1 = false;
        for (const enemy of (this._allEnemies || [])) {
          if (enemy && enemy.alive !== false) {
            this._applyStatus(enemy, 'stun', 1, 0);
          }
        }
      }
      // M406 — shrine buffs that trigger at combat start.
      if (Array.isArray(gsPS.shrineBuffs)) {
        for (const b of gsPS.shrineBuffs.filter(sb => sb.combatsLeft > 0)) {
          if (b.type === 'barrier') {
            for (const ally of (this._allies || [])) {
              if (ally && ally.alive !== false) {
                const power = Math.round((ally.maxHp || 100) * 0.3);
                this._applyStatus(ally, 'barrier', 3, power);
              }
            }
          }
          if (b.type === 'stun_round1') {
            for (const enemy of (this._allEnemies || [])) {
              if (enemy && enemy.alive !== false) {
                this._applyStatus(enemy, 'stun', 1, 0);
              }
            }
          }
          if (b.type === 'mp_regen') {
            // Add flat +MP per turn as a combat-scoped bonus via _shrineMpRegen.
            for (const ally of (this._allies || [])) {
              if (ally) ally._shrineMpRegen = (ally._shrineMpRegen || 0) + (b.amount || 1);
            }
          }
          if (b.type === 'crit_boost') {
            for (const ally of (this._allies || [])) {
              if (ally) ally._shrineCritMult = (b.mult || 2);
            }
          }
        }
      }
    } catch (_) {}
    // M405 — caption-bar repositioning on viewport resize / orientation flip.
    this._captionResizeHandler = () => { try { this._repositionCaptions(); } catch (_) {} };
    window.addEventListener('resize', this._captionResizeHandler);
    window.addEventListener('orientationchange', this._captionResizeHandler);
    // Initial paint after build settles.
    this._setTimeout(() => { try { this._repositionCaptions(); } catch (_) {} }, 50);
    this._fightStartedAt = Date.now(); // M289: needed by recordFightLog at fight end
    try { recordFightStart([...(this._heroes || []), ...(this._companions || [])]); } catch (_) {}
    // M377 — combat debug context for the structured event log.
    if (combatDebug.enabled) {
      combatDebug.clear();
      combatDebug.setEncounter(this.encounter?.name || 'unknown');
      combatDebug.setRound(0);
      combatDebug.setTurn(0, null);
      combatDebug.group(`Combat: ${this.encounter?.name || 'unknown'}`);
      combatDebug.push('combat_start', {
        encounter: this.encounter?.name,
        zoneId: this.encounter?._zoneId,
        isBoss: !!this._isBossFight,
        allies: (this._allies || []).map(a => ({ id: a.id, name: a.name, hp: a.hp, maxHp: a.maxHp, mp: a.mp, dmg: a.dmg })),
        enemies: (this._allEnemies || []).map(e => ({ id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp, dmg: e.dmg, isBoss: !!e.isBoss })),
      });
    }
    this._escHandler = (e) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (this._pauseEl) this._closePauseMenu();
      else this._openPauseMenu();
    };
    window.addEventListener('keydown', this._escHandler, true);
    // M294: boss-intro splash card
    if (this._isBossFight) this._showBossIntroSplash();
  }

  /**
   * M294 — Boss-intro splash card.
   * Full-screen overlay shown before boss combat. Fades in immediately,
   * auto-dismisses after 2s. Tap/click anywhere to skip.
   * Long boss names use clamp() font-size + overflow-wrap to survive 320px width.
   */
  _showBossIntroSplash() {
    injectStyles('boss-intro-styles', `
      @keyframes boss-intro-in  { from { opacity:0; } to { opacity:1; } }
      @keyframes boss-intro-out { from { opacity:1; } to { opacity:0; } }
      .boss-intro-splash {
        position: absolute; inset: 0; z-index: 9000;
        background: rgba(4,0,10,0.93);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 2rem 1.5rem; box-sizing: border-box;
        cursor: pointer; user-select: none;
        animation: boss-intro-in 0.35s ease-out;
      }
      .boss-intro-splash.fade-out {
        animation: boss-intro-out 0.45s ease-in forwards;
        pointer-events: none;
      }
      .bi-rule {
        width: 60%; max-width: 260px; height: 1px;
        background: linear-gradient(to right, transparent, rgba(200,160,32,0.7), transparent);
        margin: 0.75rem 0;
      }
      .bi-eyebrow {
        font-family: 'Cinzel', Georgia, serif;
        font-size: 0.7rem; letter-spacing: 0.22em; text-transform: uppercase;
        color: rgba(200,160,64,0.75);
      }
      .bi-name {
        font-family: 'Cinzel', Georgia, serif;
        font-size: clamp(1.05rem, 6vw, 2rem);
        font-weight: 700;
        color: #f8e890;
        text-align: center;
        word-wrap: break-word; overflow-wrap: anywhere;
        max-width: 100%;
        line-height: 1.25;
        text-shadow: 0 0 32px rgba(232,160,32,0.7);
      }
      .bi-prelude {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: clamp(0.75rem, 3.5vw, 0.92rem);
        color: rgba(200,180,140,0.8);
        text-align: center;
        max-width: 340px; line-height: 1.55;
        margin-top: 0.5rem;
        word-wrap: break-word; overflow-wrap: anywhere;
      }
      .bi-skip {
        margin-top: 1.5rem;
        font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase;
        color: rgba(200,180,140,0.4);
      }
      @media (prefers-reduced-motion: reduce) {
        .boss-intro-splash, .boss-intro-splash.fade-out { animation: none; }
      }
    `);

    const bossName = this.encounter?.name || 'Boss';
    // M295: per-boss introText replaces the generic fallback. Convert \n to <br>
    // so multi-line preludes render as distinct lines in the splash card.
    const rawPrelude = this.encounter?.introText || `A ${bossName} stands before you.`;
    const preludeHtml = rawPrelude
      .split('\n')
      .map(line => `<span class="bi-prelude-line">${line}</span>`)
      .join('<br>');

    const splash = createEl('div', 'boss-intro-splash');
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', `Boss encounter: ${bossName}`);
    splash.innerHTML = `
      <div class="bi-eyebrow">Boss Encounter</div>
      <div class="bi-rule" aria-hidden="true"></div>
      <div class="bi-name">${bossName}</div>
      <div class="bi-prelude">${preludeHtml}</div>
      <div class="bi-rule" aria-hidden="true"></div>
      <div class="bi-skip">Tap to begin</div>
    `;
    this._el.appendChild(splash);
    // M386 — flag set so update() can skip a per-frame querySelector for the
    // splash. Cleared in dismiss().
    this._bossIntroActive = true;

    // Hide the combat HUD (name bars) while the splash is up so it doesn't
    // bleed through the overlay.
    const hudEl = this._el?.querySelector('#cbt-hud');
    const potionBeltEl = this._el?.querySelector('#cbt-potion-belt');
    const logPanelEl = this._el?.querySelector('.cbt-log-panel');
    if (hudEl) hudEl.style.visibility = 'hidden';
    if (potionBeltEl) potionBeltEl.style.visibility = 'hidden';
    if (logPanelEl) logPanelEl.style.visibility = 'hidden';

    const dismiss = () => {
      if (splash._dismissed) return;
      splash._dismissed = true;
      this._bossIntroActive = false;
      // Restore hidden elements
      if (hudEl) hudEl.style.visibility = '';
      if (potionBeltEl) potionBeltEl.style.visibility = '';
      if (logPanelEl) logPanelEl.style.visibility = '';
      splash.classList.add('fade-out');
      splash.addEventListener('animationend', () => removeEl(splash), { once: true });
      // Safety fallback
      this._setTimeout(() => removeEl(splash), 600);
    };

    // No auto-dismiss — require an explicit tap/click to proceed.
    splash.addEventListener('click', dismiss);
    splash.addEventListener('touchstart', dismiss, { passive: true });
  }

  _build() {
    injectStyles('combat-styles', COMBAT_STYLES);
    this._el = createEl('div', 'combat-screen');
    // M296: check if combat captions are enabled
    const _captionsOn = isCombatCaptionsEnabled();
    this._el.innerHTML = `
      <div class="cbt-log-panel" aria-hidden="${_captionsOn ? 'true' : 'false'}"><div class="cbt-log-title"><span>Combat</span></div><div class="cbt-log-entries" id="cbt-log"></div></div>
      <div id="cbt-meter" class="cbt-meter-panel">
        <div class="meter-head">
          <span class="meter-title">Meter</span>
          <button type="button" class="compact-target" id="cbt-meter-mode" aria-label="Toggle damage/heal/mitigation">DMG</button>
          <button type="button" class="compact-target" id="cbt-meter-close" aria-label="Close meter">&times;</button>
        </div>
        <div class="meter-body"></div>
      </div>
      <button type="button" id="cbt-meter-open" class="cbt-meter-open" aria-label="Open meter" title="Meter">M</button>
      <div class="cbt-potion-belt" id="cbt-potion-belt"></div>
      <div class="cbt-hud" id="cbt-hud"></div>
      <div class="cbt-captions${_captionsOn ? ' cbt-captions-active' : ''}" id="cbt-captions" aria-live="polite" aria-label="Combat captions"></div>
    `;
    this.manager.uiOverlay.appendChild(this._el);
    // M434+M435 — EvBattlefield (the legacy SVG/DOM grid) is gone. Combat
    // is canvas-only: position tiles, sprites, status overlays, and target
    // picking are all driven from canvas coordinates via combatLayout.js.
    this._evBattlefield = null; // sentinel; remove once external readers stop checking it
    // M388 — Turn-order strip (kept; independent of the SVG grid).
    this._evTurnStrip = null;
    if (isUiOverhaulEnabled()) {
      // M434: EvBattlefield deliberately not imported here anymore.
      import('../EvTurnStrip.js').then(({ EvTurnStrip }) => {
        if (this._destroyed) return;
        this._evTurnStrip = new EvTurnStrip({
          rootEl: this._el,
          allies: this._allies || [],
          enemies: this._allEnemies || this._enemies || [],
        });
        this._evTurnStrip.mount();
        if (this._turnOrder) {
          this._evTurnStrip.setTurnOrder(this._turnOrder, this._turnIdx | 0, this._round | 0 || 1);
        }
      }).catch(() => { /* non-fatal */ });
      // M389 — bottom-HUD card rail (replaces .hud-members visually).
      this._evCardRail = null;
      import('../EvCardRail.js').then(({ EvCardRail }) => {
        if (this._destroyed) return;
        this._evCardRail = new EvCardRail({
          rootEl: this._el,
          hudEl: this._el.querySelector('#cbt-hud'),
          heroes: this._heroes || [],
          companions: this._companions || [],
        });
        this._evCardRail.mount();
        // M394 — tooltip resolver: render skill metadata HTML.
        this._evCardRail.setTooltipResolver(({ skillId, characterId }) =>
          this._renderSpellTooltip(skillId, characterId));
        // M391 — populate every hero's spell rail in cold state on mount so
        // players can see their kit before their turn comes up. The active
        // hero's rail is re-painted hot via _refreshSpellRailForActive() when
        // their turn fires.
        try {
          const gs = GameState.get();
          const partyMembers = [...(gs?.party || []), ...(gs?.companions || [])];
          for (const h of (this._heroes || [])) {
            const pm = partyMembers.find(m => m.id === h.id);
            if (!pm) continue;
            const skills = getUnlockedSkills(pm.class, pm.level || 1)
              .filter(s => s.type !== 'passive');
            const weapon = pm?.equipment?.weapon;
            const beltCount = (pm?.potionBelt || []).filter(s => s).length;
            this._evCardRail.setSpellRail(h.id, {
              skills,
              weaponName: weapon?.name || 'Attack',
              weaponDamageType: weapon?.damageType || 'physical',
              beltCount,
              actor: h,
              skillCooldowns: h.skillCooldowns || {},
              isHot: false,
            });
          }
        } catch (_) {}
      }).catch(() => { /* non-fatal */ });
    } else {
      this._evCardRail = null;
    }
    attachMitTooltips(this._el.querySelector('.cbt-log-panel'));
    attachDmgBreakdownTooltips(this._el.querySelector('.cbt-log-panel'));
    this._fastMode = false;
    // M335: respect Settings → Show Combat Log / Show Damage Meter toggles.
    try {
      const showLog   = localStorage.getItem('emberveil_show_combat_log') !== '0';
      const showDps   = localStorage.getItem('emberveil_show_dps_meter') === '1';
      const showEnemy = localStorage.getItem('emberveil_combat_show_enemies') === '1';
      if (!showLog) {
        const lp = this._el.querySelector('.cbt-log-panel');
        if (lp) lp.style.display = 'none';
      }
      const mp = this._el.querySelector('#cbt-meter');
      const mob = this._el.querySelector('#cbt-meter-open');
      if (!showDps) {
        if (mp)  mp.style.display  = 'none';
        if (mob) mob.style.display = 'none';
      }
      // Persist enemy-info preference into the meter toggle so it survives.
      this._meterShowEnemies = showEnemy;
      this._showEnemyInLog = showEnemy;
      const enemyCbInit = this._el.querySelector('#cbt-meter-enemies');
      if (enemyCbInit) enemyCbInit.checked = !!showEnemy;
    } catch (_) {}
    // M261: meter toggle buttons.
    const modeBtn = this._el.querySelector('#cbt-meter-mode');
    const closeBtn = this._el.querySelector('#cbt-meter-close');
    const openBtn = this._el.querySelector('#cbt-meter-open');
    if (modeBtn) modeBtn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleMeterMode(); });
    const enemyCb = this._el.querySelector('#cbt-meter-enemies');
    if (enemyCb) enemyCb.addEventListener('change', (e) => { e.stopPropagation(); this._meterShowEnemies = enemyCb.checked; this._renderMeter(); });
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleMeterVisible(); });
    if (openBtn) openBtn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleMeterVisible(); });
    // M262: drag the meter panel by its header.
    const meterPanel = this._el.querySelector('#cbt-meter');
    const meterHead = meterPanel?.querySelector('.meter-head');
    if (meterPanel && meterHead) {
      meterHead.style.cursor = 'move';
      const saved = (() => { try { return JSON.parse(localStorage.getItem('emberveil_meter_pos') || 'null'); } catch { return null; } })();
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        meterPanel.style.right = '';
        meterPanel.style.left = saved.left + 'px';
        meterPanel.style.top = saved.top + 'px';
      }
      let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
      const onDown = (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        const rect = meterPanel.getBoundingClientRect();
        meterPanel.style.right = '';
        meterPanel.style.left = rect.left + 'px';
        meterPanel.style.top = rect.top + 'px';
        startX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        startY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        startLeft = rect.left; startTop = rect.top;
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const cx = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        const cy = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        const left = Math.max(0, Math.min(window.innerWidth - 60, startLeft + (cx - startX)));
        const top = Math.max(0, Math.min(window.innerHeight - 30, startTop + (cy - startY)));
        meterPanel.style.left = left + 'px';
        meterPanel.style.top = top + 'px';
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        try {
          localStorage.setItem('emberveil_meter_pos', JSON.stringify({
            left: parseFloat(meterPanel.style.left || '0'),
            top: parseFloat(meterPanel.style.top || '0'),
          }));
        } catch {}
      };
      meterHead.addEventListener('mousedown', onDown);
      meterHead.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    }
    this._renderMeter();
    // M258: Secondary-effects filter checkbox.
    const secCb = this._el.querySelector('#cbt-log-secondary');
    if (secCb) {
      secCb.addEventListener('change', () => {
        const logEl = this._el.querySelector('#cbt-log');
        if (logEl) logEl.classList.toggle('hide-secondary', !secCb.checked);
      });
    }
    this._renderHud();
    // M219: floating Combat Debug button — visible only when debug mode is on.
    if (debug.flags.enabled) {
      const dbgBtn = document.createElement('button');
      dbgBtn.type = 'button';
      dbgBtn.id = 'cbt-debug-float';
      dbgBtn.setAttribute('aria-label', 'Open Combat Debug');
      dbgBtn.title = 'Combat Debug';
      dbgBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>';
      // M242: moved up to 84px so it doesn't overlap the bottom HUD's
      // Pause / Speed / Log row.
      dbgBtn.style.cssText = 'position:absolute;bottom:84px;right:8px;z-index:900;min-width:44px;min-height:44px;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.55);border:1px solid rgba(160,80,255,0.5);color:#b87fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;pointer-events:all';
      dbgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openCombatDebugModal();
      });
      this._el.appendChild(dbgBtn);

      // Listen for settings changes (from modal or Cheat Menu) and re-render.
      this._combatDebugHandler = () => { /* triggers next draw naturally */ };
      window.addEventListener('combatDebug:changed', this._combatDebugHandler);
    }
    // M236/M242: auto-open Combat Debug modal on entry when the toggle is on.
    // The debug panel is transparent-background and non-blocking, so we no
    // longer force _speedMult=0 here — that caused the persisted speed to be
    // discarded every time a new combat started with debug-auto on (Bug 3 fix).
    const _combatDebugOn = (() => { try { return localStorage.getItem('emberveil_combat_debug_auto') === '1'; } catch { return false; } })();
    try {
      if (_combatDebugOn) {
        this._setTimeout(() => { this._openCombatDebugModal(); }, 100);
      }
    } catch (_) {}
    // Speed cycle. M323: a new "Enable Slow Combat Options" setting opts the
    // user into slow speeds (0.5×, 0.25×) and a manual pause + Next-Turn step
    // button. When the setting is OFF the cycle is the original 1×/2×/4×.
    // When the setting is ON the cycle becomes 1× → 2× → 4× → 0.5× → 0.25× →
    // ❚❚ pause → 1×. Combat-debug mode keeps its own pause state but also
    // benefits from the slow tier when both are on.
    const _slowEnabled = (() => {
      try { return localStorage.getItem('emberveil_slow_combat_enabled') === '1'; } catch { return false; }
    })();
    this._slowCombatEnabled = _slowEnabled;
    // M336 — game speed persists across combats.
    // M384 — speed now lives on the save (gs.combatSpeed). The legacy global
    // localStorage key is still read as a fallback so existing saves don't
    // drop to 1× on the first load after this change.
    let _persistedSpeed = 1;
    {
      const allowed = [0.25, 0.5, 1, 2, 4];
      const fromSave = Number(GameState.get().combatSpeed);
      if (allowed.includes(fromSave)) _persistedSpeed = fromSave;
      else {
        try {
          const legacy = Number(localStorage.getItem('emberveil_combat_speed'));
          if (allowed.includes(legacy)) _persistedSpeed = legacy;
        } catch (_) {}
      }
    }
    // Always start at persisted speed regardless of debug mode. Combat-debug
    // auto-open no longer forces a pause (see above). If _slowEnabled is on
    // and the persisted speed is 0 (pause), keep it; otherwise use persisted.
    this._speedMult = _persistedSpeed;
    this._fastMode = this._speedMult > 1;
    const _speedLabel = (v) => {
      if (v === 0) return '❚❚';
      if (v < 1) return `${v}×`;
      return `${v}×`;
    };
    // M384 — single source of truth for the speed indicator. Anywhere
    // that mutates this._speedMult should call this so the HUD button text
    // always tracks the actual game speed (was previously updated only by
    // the click handler, leading to button-says-1×-but-game-runs-at-2× bugs).
    this._syncSpeedHud = () => {
      const btn = this._el?.querySelector('#hud-speed');
      if (btn) btn.textContent = _speedLabel(this._speedMult);
      const nextBtn = this._el?.querySelector('#hud-next-turn');
      if (nextBtn) nextBtn.style.display = (this._speedMult === 0) ? '' : 'none';
    };
    const _cycleSpeed = (cur) => {
      if (_slowEnabled || _combatDebugOn) {
        // 1 → 2 → 4 → 0.5 → 0.25 → 0(pause) → 1
        if (cur === 1) return 2;
        if (cur === 2) return 4;
        if (cur === 4) return 0.5;
        if (cur === 0.5) return 0.25;
        if (cur === 0.25) return 0;
        return 1; // from 0
      }
      // Default fast-only cycle
      return cur === 1 ? 2 : cur === 2 ? 4 : 1;
    };
    this._el.addEventListener('click', e => {
      if (e.target.closest('#hud-speed') && !this._pauseEl) {
        this._speedMult = _cycleSpeed(this._speedMult);
        this._fastMode = this._speedMult > 1;
        // M384 — persist speed per-save (was global localStorage). The 0/pause
        // state is transient and intentionally NOT persisted. Legacy global
        // key is still updated so it can serve as a default for new saves.
        if (this._speedMult > 0) {
          try { GameState.get().combatSpeed = this._speedMult; } catch (_) {}
          try { localStorage.setItem('emberveil_combat_speed', String(this._speedMult)); } catch (_) {}
        }
        this._syncSpeedHud();
        this.audio.playSfx('click');
      }
      if (e.target.closest('#hud-next-turn') && !this._pauseEl) {
        // M323: Next-Turn — advance one combat tick by briefly running at 1×
        // and restoring the paused state ~600ms later. That's enough wall
        // time for one combat action to resolve at the default tick rate.
        if (this._speedMult === 0) {
          this._speedMult = 1;
          clearTimeout(this._nextTurnTimer);
          this._nextTurnTimer = setTimeout(() => {
            this._speedMult = 0;
            const btn = this._el?.querySelector('#hud-speed');
            if (btn) btn.textContent = _speedLabel(0);
          }, 600);
          this.audio.playSfx('click');
        }
      }
    });
    this._pauseEl = null;

    // M74: tap click handler — attach to combat screen overlay AND canvas.
    // The overlay has pointer-events:none so clicks fall through to canvas for most spots,
    // but we also bind to the overlay root so we never miss a click, and we bind to
    // window as a last-resort capture-phase listener.
    this._tapClickHandler = (e) => this._onTapClick(e);
    const canvas = this.manager.canvas;
    if (canvas) canvas.addEventListener('pointerdown', this._tapClickHandler);
    if (this._el) this._el.addEventListener('pointerdown', this._tapClickHandler);
    try { console.log('[tap] combat ready. Set window.__tapDebug = true to trace clicks.'); } catch (_) {}
    // M412 — champion-affix hover tooltip (desktop only). Mouse-based, so
    // skip pointer events from touch input. Hides on mouseleave / pointer
    // outside any champion sprite.
    // M434 — canvas-based spell targeting. Replaces EvBattlefield.activateTargeting.
    // When `_targetingActive` is set by _handleRailClick, the next pointerdown
    // on the canvas resolves to the nearest live enemy and fires the action.
    if (canvas) {
      this._canvasTargetHandler = (e) => {
        if (!this._targetingActive) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / Math.max(1, rect.width);
        const scaleY = canvas.height / Math.max(1, rect.height);
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const enemies = (this._awaitingEnemies || this._allEnemies || []).filter(en => en.alive);
        if (!enemies.length) return;
        // Hit-test against a generous bounding circle around each sprite —
        // baseSize 62 × drawScale × 1.6 ≈ 60-100px wide. 70px radius covers
        // both halves comfortably while still resolving cleanly between
        // adjacent enemies.
        let best = null, bestD = Infinity;
        for (const u of enemies) {
          const dx = (u.x - cx); const dy = (u.y - 32 - cy);
          const d = dx*dx + dy*dy;
          if (d < bestD) { bestD = d; best = u; }
        }
        if (!best || bestD > 130*130) return; // way off — ignore tap
        e.preventDefault();
        e.stopPropagation();
        const skillId = this._pendingSkillId;
        const targetId = best.id;
        this._pendingSkillId = null;
        this._targetingActive = false;
        this._targetingSourceId = null;
        this._targetingShape = null;
        this._dispatchManualAction(skillId, targetId);
      };
      canvas.addEventListener('pointerdown', this._canvasTargetHandler, { capture: true });
    }
    if (canvas) {
      // M477 — Unified sprite hover: detect enemies (champion or normal) AND
      // companions. Tooltip only renders when there is content (statuses or
      // championMods); empty hits hide the tip.
      this._spriteHoverPending = null;
      this._spriteHoverTimer = null;
      const HOVER_DELAY_MS = 220;
      this._champHoverHandler = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / Math.max(1, rect.width);
        const scaleY = canvas.height / Math.max(1, rect.height);
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const pool = [
          ...((this._allEnemies || []).filter(u => u && u.alive)),
          ...((this._companions || []).filter(u => u && u.alive)),
        ];
        let hit = null;
        for (const u of pool) {
          if (typeof u.x !== 'number' || typeof u.y !== 'number') continue;
          const dx = (u.x - cx); const dy = (u.y - cy);
          if (dx*dx + dy*dy <= 60*60) { hit = u; break; }
        }
        if (!hit) {
          this._spriteHoverPending = null;
          if (this._spriteHoverTimer) { clearTimeout(this._spriteHoverTimer); this._spriteHoverTimer = null; }
          this._hideChampionHoverTip();
          return;
        }
        // Same target as queued? Just reposition.
        if (this._spriteHoverPending && this._spriteHoverPending.unit === hit) {
          const tip = document.getElementById('champ-hover-tip');
          if (tip && tip.style.display === 'block') {
            this._showSpriteHoverTip(hit, e.clientX, e.clientY);
          } else {
            this._spriteHoverPending.clientX = e.clientX;
            this._spriteHoverPending.clientY = e.clientY;
          }
          return;
        }
        // New target — start a delay before showing.
        this._spriteHoverPending = { unit: hit, clientX: e.clientX, clientY: e.clientY };
        if (this._spriteHoverTimer) clearTimeout(this._spriteHoverTimer);
        this._spriteHoverTimer = setTimeout(() => {
          this._spriteHoverTimer = null;
          const pending = this._spriteHoverPending;
          if (!pending) return;
          this._showSpriteHoverTip(pending.unit, pending.clientX, pending.clientY);
        }, HOVER_DELAY_MS);
      };
      this._champLeaveHandler = () => {
        this._spriteHoverPending = null;
        if (this._spriteHoverTimer) { clearTimeout(this._spriteHoverTimer); this._spriteHoverTimer = null; }
        this._hideChampionHoverTip();
      };
      this._champPointerDownHandler = () => {
        this._spriteHoverPending = null;
        if (this._spriteHoverTimer) { clearTimeout(this._spriteHoverTimer); this._spriteHoverTimer = null; }
        this._hideChampionHoverTip();
      };
      canvas.addEventListener('pointermove', this._champHoverHandler);
      canvas.addEventListener('pointerleave', this._champLeaveHandler);
      canvas.addEventListener('pointerdown', this._champPointerDownHandler);
    }
  }

  // M412 — desktop hover tooltip for champion enemies. Pinned to bottom-right
  // of the cursor and clamped to viewport. Replaces the old click-triggered
  // _showChampionInfo so taps stay reserved for tap weapons.
  // Seam 1: delegated to combat/combatTooltips.js — pure DOM, no combat state.
  _showChampionHoverTip(champ, clientX, clientY) { _tooltipShowChampion(champ, clientX, clientY); }
  _hideChampionHoverTip() { _tooltipHide(); }
  // M477 — unified hover tooltip: champion mods + status effects.
  _showSpriteHoverTip(unit, clientX, clientY) { _tooltipShowSprite(unit, clientX, clientY); }

  _tapDbg(...args) {
    if (typeof window !== 'undefined' && window.__tapDebug) {
      try { console.log('[tap]', ...args); } catch (_) {}
      this._tapHint = { text: '[tap] ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '), life: 2.0 };
    }
  }

  _onTapClick(e) {
    this._tapDbg('click', { phase: this._phase, target: e.target?.className || e.target?.tagName });
    if (this._phase !== 'PLAYING') { this._tapDbg('bail: phase', this._phase); return; }
    // Ignore clicks that land on UI overlay elements (handled by their own listeners)
    if (e.target && e.target.closest && e.target.closest(
      '.cbt-hud, .cbt-log-panel, .cbt-log, #cbt-log, .cbt-pause-overlay, .cbt-end-modal, ' +
      '.hud-controls, .ev-hud, .ev-turn-strip, .ev-tooltip-card, .spell-icon, ' +
      '.ev-mobile-portrait-btn, .cbt-meter, #cbt-meter, .cbt-meter-open, ' +
      '.cbt-potion-belt, .cbt-captions, [data-scroll], textarea, input, select, button, a, label'
    )) {
      // M402 — broaden the bail set: combat log + scroll regions + form
      // controls + tooltip card + meter panels must never trigger the tap
      // handler. Without this, scrolling the log via mouse wheel or clicking
      // the scrollbar fires "Tap not ready" toasts on the canvas.
      this._tapDbg('bail: clicked UI element');
      return;
    }
    if (!GameState.canTap()) {
      const gs = GameState.get();
      this._tapDbg('bail: cooldown', { used: gs.tapUsedThisTurn, cd: gs.tapCooldown, unit: gs.tapCooldownUnit });
      this._tapHint = { text: 'Tap not ready', life: 1.0 };
      return;
    }
    const canvas = this.manager.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const aliveEnemies = this._allEnemies.filter(en => en.alive);
    const aliveAllies = this._allies.filter(a => a.alive);
    this._tapDbg('coords', { cx: Math.round(cx), cy: Math.round(cy), enemies: aliveEnemies.length, allies: aliveAllies.length });
    // Always spawn a click flash so the player gets feedback even if no target resolved.
    this._tapEffects.push({ phase: 'burst', t: 0, dur: 0, from: { x: cx, y: cy }, to: { x: cx, y: cy }, color: '#ffe080', size: 10, burst: { r: 0, life: 0.5 } });
    if (!aliveEnemies.length && !aliveAllies.length) { this._tapDbg('bail: no targets'); return; }

    const nearest = (arr) => arr.reduce((best, u) => {
      const d = (u.x - cx) ** 2 + (u.y - cy) ** 2;
      return (!best || d < best.d) ? { u, d } : best;
    }, null);
    const nearEnemy = nearest(aliveEnemies);
    const nearAlly = nearest(aliveAllies);
    const chooseWeapon = !nearAlly || (nearEnemy && nearEnemy.d <= nearAlly.d);

    const equipped = chooseWeapon
      ? GameState.getEquippedTapWeapon()
      : GameState.getEquippedTapUtility();
    this._tapDbg('picked', { chooseWeapon, equipped, nearEnemyD: nearEnemy?.d, nearAllyD: nearAlly?.d });
    if (!equipped) {
      this._tapHint = { text: `No tap ${chooseWeapon ? 'weapon' : 'utility'} equipped`, life: 1.2 };
      return;
    }
    const def = getTapItem(equipped);
    if (!def) { this._tapDbg('bail: unknown item', equipped); return; }

    // Attach groupIndex hint for AoE_group resolution
    this._enemyGroups.forEach((g, gi) => g.forEach(e => { e.groupIndex = gi; }));

    const effect = resolveTap(def, {
      clickX: cx, clickY: cy,
      enemies: this._allEnemies,
      allies: this._allies,
      targetEnemy: nearEnemy?.u,
      targetAlly: nearAlly?.u,
    });
    if (!effect) { this._tapDbg('bail: resolveTap returned null'); return; }
    this._tapDbg('resolved', { kind: effect.kind, targets: effect.targets?.length, amount: effect.amountEach });

    // Apply effect
    this._applyTapEffect(def, effect);

    // Start cooldown
    GameState.useTap(def.cooldown);

    // Play SFX
    try { this.audio.playSfx(effect.sfx || def.sfx || 'hit'); } catch (_) {}

    // Spawn visual
    this._spawnTapVisual(def, effect, cx, cy);

    // M412 — was: click-to-show champion info. Removed because it conflicted
    // with tap-weapon clicks. Champion tooltip is now hover-only — see
    // _setupChampionHover() bound at combat-screen mount.
  }

  // M303: Show a brief floating DOM tooltip for champion modifier badges.
  // Seam 1: delegated to combat/combatTooltips.js.
  _showChampionInfo(champ, canvasX, canvasY) {
    _tooltipShowChampionInfo(champ, canvasX, canvasY, this.manager?.canvas, this._setTimeout.bind(this));
  }

  _applyTapEffect(def, effect) {
    const kind = effect.kind;
    // M207: global tap multiplier — single M4 lever. Scales damage + magnitude.
    const tapMult = getBalance().tap?.globalMult ?? 1.0;
    if (tapMult !== 1.0 && effect.amountEach != null) {
      effect.amountEach = Math.max(0, Math.round(effect.amountEach * tapMult));
    }
    if (kind === 'damage') {
      // M84: route tap damage through the canonical pipeline. Tap weapons
      // default to 'physical'; def.damageType can override ('magic' | 'true').
      const type = def.damageType || 'physical';
      let totalDealt = 0;
      let firstBreakdown = null;
      // M382 — synthesize a stable ally entry for the tap weapon so it
      // shows up in the DPS meter alongside hero damage. One row per tap
      // weapon (def.id), labelled with the weapon's display name.
      const _tapActor = { id: `tap_${def.id || def.name || 'weapon'}`, name: def.name || 'Tap Weapon', isAlly: true };
      for (const t of (effect.targets || [])) {
        if (!t || !t.alive) continue;
        const raw = effect.amountEach;
        const { dmg, tag, breakdown } = this._resolveIncomingDamage(raw, t, { type });
        if (!firstBreakdown) firstBreakdown = breakdown;
        if (t.reviveImmune) {
          this._dmgNumbers.push({ x: t.x, y: t.y - 30, text: `IMMUNE`, color: '#ffe080', life: 1, maxLife: 1 });
          this._flashMap.set(t.id, HIT_FLASH);
          continue;
        }
        t.hp = Math.max(0, t.hp - dmg);
        totalDealt += dmg;
        // M382 — credit the tap weapon in the damage meter.
        try { _meterAddDamage(this._meter, _tapActor, dmg, def.name || 'Tap', { side: 'ally', round: this._round, target: t.name }); } catch (_) {}
        const label = tag ? `${tag}` : `-${dmg}`;
        this._dmgNumbers.push({ x: t.x, y: t.y - 30, text: label, color: def.effectColor, life: 1, maxLife: 1 });
        this._flashMap.set(t.id, HIT_FLASH);
        if (t.hp <= 0) t.alive = false;
      }
      if (firstBreakdown) firstBreakdown.dealt = totalDealt;
      this._log_(`Tap ${def.name} → ${effect.targets.length} target(s): ${totalDealt} dmg (rolled ${effect.amountEach})`, 'hit', firstBreakdown);
      this._checkCombatEnd();
    } else if (kind === 'heal') {
      for (const t of (effect.targets || [])) {
        if (!t || !t.alive) continue;
        const heal = effect.amountEach;
        t.hp = Math.min(t.maxHp, t.hp + heal);
        this._dmgNumbers.push({ x: t.x, y: t.y - 30, text: `+${heal}`, color: def.effectColor, life: 1, maxLife: 1 });
      }
      this._log_(`Tap ${def.name} healed ${effect.targets.length} ally/ies`, 'heal');
    } else if (kind === 'shield') {
      for (const t of (effect.targets || [])) {
        if (!t || !t.alive) continue;
        t.statuses = t.statuses || [];
        t.statuses.push({ type: 'barrier', duration: 3, power: effect.amountEach || 25 });
        this._dmgNumbers.push({ x: t.x, y: t.y - 30, text: `+${effect.amountEach} shield`, color: def.effectColor, life: 1, maxLife: 1 });
      }
      this._log_(`${def.name} barriers applied`, 'heal');
    } else if (kind === 'deflect') {
      for (const t of (effect.targets || [])) { t.statuses = t.statuses || []; t.statuses.push({ type: 'deflect', duration: 2 }); }
      this._log_(`${def.name} set to absorb next hit`, 'heal');
    } else if (kind === 'enchant') {
      for (const t of (effect.targets || [])) { t.statuses = t.statuses || []; t.statuses.push({ type: 'enchant', duration: 99, power: 0.25 }); }
      this._log_(`${def.name} weapon enchanted`, 'heal');
    } else if (kind === 'cleanse') {
      for (const t of (effect.targets || [])) {
        t.statuses = (t.statuses || []).filter(s => !['poison','burn','bleed','curse','stun'].includes(s.type));
        t.hp = Math.min(t.maxHp, t.hp + 15);
      }
      this._log_(`${def.name} cleansed`, 'heal');
    } else if (kind === 'rally') {
      for (const a of this._allies) { a.statuses = a.statuses || []; a.statuses.push({ type: 'rally', duration: 4, power: 0.15 }); }
      this._log_(`Rally! +15% damage for 2 rounds`, 'heal');
    } else if (kind === 'haste') {
      for (const t of (effect.targets || [])) { t.statuses = t.statuses || []; t.statuses.push({ type: 'haste', duration: 2 }); }
      this._log_(`${def.name} — extra turn queued`, 'heal');
    } else if (kind === 'taunt') {
      for (const t of (effect.targets || [])) { t.statuses = t.statuses || []; t.statuses.push({ type: 'taunt_totem', duration: 4 }); }
      this._log_(`Taunt totem dropped`, 'heal');
    } else if (kind === 'revive') {
      const downed = this._allies.filter(a => !a.alive);
      const tgt = downed[0];
      if (tgt) {
        // M84: 25% max HP + damage immunity until next action.
        tgt.alive = true; tgt.hp = Math.max(1, Math.floor(tgt.maxHp * 0.25));
        tgt.reviveImmune = true;
        this._dmgNumbers.push({ x: tgt.x, y: tgt.y - 30, text: `REVIVED`, color: def.effectColor, life: 1.5, maxLife: 1.5 });
        this._log_(`${def.name} revived ${tgt.name}!`, 'heal');
      } else {
        this._log_(`${def.name}: no fallen allies`, 'miss');
      }
    }
    this._updateHud?.();
  }

  _spawnTapVisual(def, effect, cx, cy) {
    const color = def.effectColor || '#ffffff';
    const targets = (effect.targets || []).filter(Boolean);
    const W = this.manager.width;
    const fx = this._tapEffects;
    const rand = (a, b) => a + Math.random() * (b - a);
    const push = (o) => fx.push(Object.assign({ t: 0, life: 0.6, color }, o));

    // M78: layer pixel-art sprite alongside existing canvas effects (chain_lightning excluded by design).
    const sprite = CombatScreen._tapFxSprites && CombatScreen._tapFxSprites[def.id];
    if (sprite && !sprite._failed && def.id !== 'chain_lightning') {
      const t0 = targets[0] || { x: cx, y: cy };
      // Projectile-style ids fly in from off-screen; impact ids burst at target.
      const flyIds = { bow: 1, catapult: 1, ninja_stars: 1, fireball: 1, void_lance: 1, star_caller: 1, dragon_call: 1 };
      if (flyIds[def.id]) {
        const fromX = def.id === 'star_caller' ? t0.x : (def.id === 'dragon_call' ? -160 : cx - 240);
        const fromY = def.id === 'star_caller' ? -120 : (def.id === 'dragon_call' ? 80 : cy - 140);
        const toX = def.id === 'dragon_call' ? W + 160 : t0.x;
        const toY = def.id === 'dragon_call' ? 120 : t0.y;
        push({ type: 'sprite', sprite, x0: fromX, y0: fromY, x1: toX, y1: toY, dur: 0.5, life: 0.55, scale: 1.6, rot: 1 });
      } else {
        // blade, spirit_hammer — burst at target(s)
        for (const t of (targets.length ? targets : [{ x: cx, y: cy }])) {
          push({ type: 'sprite', sprite, x0: t.x, y0: t.y, x1: t.x, y1: t.y, dur: 0.4, life: 0.5, scale: 1.8, rot: 0 });
        }
      }
    }

    switch (def.id) {
      case 'blade': {
        push({ type: 'slash', x: cx, y: cy, rot: -Math.PI / 4, len: 70, life: 0.35 });
        for (let i = 0; i < 8; i++) {
          push({ type: 'spark', x: cx, y: cy, vx: Math.cos(i) * rand(60, 160), vy: Math.sin(i * 1.3) * rand(60, 160), life: 0.45, size: rand(2, 4) });
        }
        for (const t of targets) {
          push({ type: 'slash', x: t.x, y: t.y - 10, rot: rand(-Math.PI * 0.6, -Math.PI * 0.2), len: 60, life: 0.4 });
          for (let i = 0; i < 6; i++) {
            push({ type: 'spark', x: t.x, y: t.y - 10, vx: rand(-140, 140), vy: rand(-160, 40), life: 0.5, size: rand(2, 4) });
          }
        }
        break;
      }
      case 'bow': {
        const t = targets[0] || { x: cx, y: cy };
        push({ type: 'arrow', x0: -40, y0: t.y - 200, x1: t.x, y1: t.y, dur: 0.42, life: 0.42, color: '#e8d9a8' });
        try { this.audio.playSfx('hit'); } catch (_) {}
        push({ type: 'ring', x: t.x, y: t.y, life: 0.4, delay: 0.42, r0: 6, r1: 40 });
        break;
      }
      case 'catapult': {
        const t = targets[0] || { x: cx, y: cy };
        push({ type: 'boulder', x0: t.x - 260, y0: -60, x1: t.x, y1: t.y, dur: 0.55, life: 0.55, size: 26 });
        push({ type: 'ring', x: t.x, y: t.y + 10, life: 0.55, delay: 0.55, r0: 10, r1: 80, color: '#b8a882' });
        for (let i = 0; i < 14; i++) {
          push({ type: 'dust', x: t.x, y: t.y + 10, delay: 0.55, vx: rand(-180, 180), vy: rand(-120, -20), life: 0.7, size: rand(3, 6) });
        }
        break;
      }
      case 'star_caller': {
        push({ type: 'star', x0: cx, y0: -140, x1: cx, y1: cy, dur: 0.55, life: 0.55, size: 40 });
        push({ type: 'ring', x: cx, y: cy, life: 0.7, delay: 0.55, r0: 14, r1: 140, color: '#ffe080' });
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          push({ type: 'spark', x: cx, y: cy, delay: 0.55, vx: Math.cos(a) * rand(120, 260), vy: Math.sin(a) * rand(120, 260), life: 0.7, size: rand(2, 5), color: '#ffe080' });
        }
        break;
      }
      case 'ninja_stars': {
        targets.slice(0, 3).forEach((t, i) => {
          const offset = (i - 1) * 40;
          push({ type: 'knife', x0: -40, y0: cy + offset - 30, x1: t.x, y1: t.y, dur: 0.35 + i * 0.04, life: 0.4 + i * 0.04 });
          push({ type: 'ring', x: t.x, y: t.y, life: 0.3, delay: 0.35 + i * 0.04, r0: 4, r1: 26, color: '#c0c8d0' });
        });
        break;
      }
      case 'fireball': {
        const t = targets[0] || { x: cx, y: cy };
        push({ type: 'fireball', x0: cx - 260, y0: cy - 120, x1: t.x, y1: t.y, dur: 0.4, life: 0.4, size: 22 });
        push({ type: 'ring', x: t.x, y: t.y, life: 0.6, delay: 0.4, r0: 16, r1: 110, color: '#ff8030' });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          push({ type: 'spark', x: t.x, y: t.y, delay: 0.4, vx: Math.cos(a) * rand(100, 240), vy: Math.sin(a) * rand(100, 240), life: 0.6, size: rand(2, 5), color: '#ffb040' });
        }
        break;
      }
      case 'dragon_call': {
        push({ type: 'dragon', x0: -140, y0: 60, x1: W + 140, y1: 120, dur: 0.9, life: 0.9 });
        for (const t of targets) {
          for (let i = 0; i < 10; i++) {
            push({ type: 'spark', x: t.x + rand(-30, 30), y: t.y + rand(-20, 20), delay: 0.3 + Math.random() * 0.4, vx: rand(-40, 40), vy: rand(-80, -20), life: 0.7, size: rand(3, 6), color: i % 2 ? '#ff8030' : '#ffd060' });
          }
          push({ type: 'ring', x: t.x, y: t.y, delay: 0.4, life: 0.5, r0: 10, r1: 60, color: '#ff6020' });
        }
        break;
      }
      case 'chain_lightning': {
        let prev = { x: cx, y: cy };
        for (const t of targets) {
          push({ type: 'lightning', a: prev, b: { x: t.x, y: t.y }, life: 0.45, width: 3.5 });
          for (let i = 0; i < 3; i++) {
            const midx = (prev.x + t.x) / 2 + rand(-40, 40);
            const midy = (prev.y + t.y) / 2 + rand(-40, 40);
            push({ type: 'lightning', a: { x: midx, y: midy }, b: { x: midx + rand(-60, 60), y: midy + rand(-60, 60) }, life: 0.3, width: 1.8 });
          }
          push({ type: 'ring', x: t.x, y: t.y, life: 0.4, r0: 6, r1: 40, color: '#b0e8ff' });
          prev = { x: t.x, y: t.y };
        }
        break;
      }
      case 'spirit_hammer': {
        const t = targets[0] || { x: cx, y: cy };
        push({ type: 'hammer', x0: t.x, y0: t.y - 280, x1: t.x, y1: t.y, dur: 0.35, life: 0.35, size: 44 });
        push({ type: 'ring', x: t.x, y: t.y, delay: 0.35, life: 0.55, r0: 10, r1: 130, color: '#c0d8ff' });
        push({ type: 'ring', x: t.x, y: t.y, delay: 0.4, life: 0.5, r0: 14, r1: 90, color: '#ffffff' });
        break;
      }
      case 'void_lance': {
        push({ type: 'lance', x: cx, y: cy, life: 0.5, targets: targets.map(t => ({ x: t.x, y: t.y })) });
        for (const tt of targets) {
          push({ type: 'ring', x: tt.x, y: tt.y, life: 0.4, r0: 6, r1: 42, color: '#c080ff' });
          for (let i = 0; i < 6; i++) {
            push({ type: 'spark', x: tt.x, y: tt.y, vx: rand(-80, 80), vy: rand(-120, 20), life: 0.6, size: rand(2, 4), color: '#a060e0' });
          }
        }
        break;
      }
      default: {
        const from = effect.projectile?.from || { x: cx - 220, y: cy - 140 };
        fx.push({ phase: 'fly', t: 0, dur: 0.45, from, to: { x: cx, y: cy }, color, size: 16, burst: { r: 0, life: 0.7 } });
        for (const t of targets) {
          fx.push({ phase: 'burst', t: 0, dur: 0, from: { x: t.x, y: t.y }, to: { x: t.x, y: t.y }, color, size: 12, burst: { r: 0, life: 0.55 } });
        }
      }
    }
  }

  // M261/M267/M268: damage/heal/mitigation meter helpers. Wrappers around the
  // pure aggregator in src/ui/screens/_meterTracker.js (extracted M273 — first
  // step of the CombatScreen modular refactor). The wrappers determine
  // ally/enemy side, augment the detail with the current round, and
  // schedule a render. The aggregator handles all data shaping + lazy-create.
  _meterSide(actor) { return this._allies?.includes(actor) ? 'ally' : 'enemy'; }
  _meterEnsureEntry(actor) {
    if (!this._meter || !actor) return null;
    return _meterEnsureEntry_(this._meter, actor, this._meterSide(actor));
  }
  _meterAddDamage(actor, amt, source, detail = {}) {
    // M377 — debug: record what source string the meter is bucketing
    // damage under. This is exactly the call site where the M369 Dragon
    // Breath bug surfaced (legendary fire was being added with source
    // "Attack" because the breakdown's skillName was missing).
    combatDebug.push('meter_add', {
      actor: actor?.name, actorId: actor?.id,
      side: this._meterSide(actor),
      kind: 'dmg', amount: amt,
      source: typeof source === 'object' ? (source?.name || source?.id) : source,
      sourceType: typeof source,
      target: detail?.target?.name || (typeof detail?.target === 'string' ? detail.target : null),
      crit: !!detail?.crit, overkill: detail?.overkill || 0,
      element: detail?.element || null, legendary: !!detail?.legendary,
    });
    if (_meterAddDamage(this._meter, actor, amt, source, { side: this._meterSide(actor), round: this._round, ...detail })) {
      this._scheduleMeterRender();
    }
    // M280 stats — only credit hero/companion attackers; enemies are tracked separately by meter only.
    if (actor && actor.isHero) {
      const tgt = (typeof detail.target === 'string')
        ? (this._enemies?.find(e => e.name === detail.target) || this._allies?.find(a => a.name === detail.target))
        : detail.target;
      try { recordDamageDealt(actor, tgt || { id: 'unknown' }, amt, { crit: !!detail.crit }); } catch (_) {}
      // M289 — per-skill + per-element breakdown for the Damage tab.
      // `source` is the skill object passed in by _executeSkill; basic
      // attacks come through with no source, default to attack/null element.
      try {
        const skill = (source && typeof source === 'object') ? source : null;
        const element = skill?.element || skill?.damageType || null;
        recordDamageBySkill(actor, amt, skill, element);
      } catch (_) {}
    } else if (actor && !actor.isHero) {
      // M289 — track damage TAKEN by heroes from this enemy.
      try {
        const tgt = (typeof detail.target === 'string')
          ? this._allies?.find(a => a.name === detail.target)
          : detail.target;
        if (tgt && tgt.isHero) {
          const enemyKey = `enemy:${actor.enemyId || actor.id || actor.name || 'unknown'}`;
          recordDamageTakenBySource(amt, enemyKey);
          // M475c — also increment per-hero damageTaken so the cloud
          // combat_history shows non-zero dmgTaken for backline characters
          // who actually got hit.
          recordDamageTakenByHero(tgt, amt);
        }
      } catch (_) {}
    }
  }
  _meterAddHeal(actor, amt, source, detail = {}) {
    combatDebug.push('meter_add', {
      actor: actor?.name, side: this._meterSide(actor),
      kind: 'heal', amount: amt, source,
      target: detail?.target?.name || (typeof detail?.target === 'string' ? detail.target : null),
      overheal: detail?.overheal || 0,
    });
    if (_meterAddHeal(this._meter, actor, amt, source, { side: this._meterSide(actor), round: this._round, ...detail })) {
      this._scheduleMeterRender();
    }
    if (actor && actor.isHero) {
      const tgt = (typeof detail.target === 'string')
        ? this._allies?.find(a => a.name === detail.target)
        : detail.target;
      try { recordHeal(actor, tgt || actor, amt); } catch (_) {}
    }
  }
  _meterAddMit(actor, amt, kind, detail = {}) {
    combatDebug.push('meter_add', {
      actor: actor?.name, side: this._meterSide(actor),
      kind: 'mit', amount: amt, source: kind,
    });
    if (_meterAddMit(this._meter, actor, amt, kind, { side: this._meterSide(actor), round: this._round, ...detail })) {
      this._scheduleMeterRender();
    }
  }
  _meterAddDodge(actor, detail = {}) {
    combatDebug.push('meter_add', {
      actor: actor?.name, side: this._meterSide(actor),
      kind: 'dodge', amount: 0, source: 'Dodge',
    });
    if (_meterAddDodge(this._meter, actor, { side: this._meterSide(actor), round: this._round, ...detail })) {
      this._scheduleMeterRender();
    }
    if (actor && actor.isHero) { try { recordDodge(actor); } catch (_) {} }
  }
  // Seam 3: delegated to combat/combatMeterUI.js — meter DOM rendering + Combat Report overlay.
  _renderMeter() { _meterRender(this); }
  // M267: cycle DMG → HEAL → MIT → DMG.
  _toggleMeterMode() { _meterToggleMode(this); }
  // M272: coalesce per-event meter renders to once per frame.
  _scheduleMeterRender() { _meterScheduleRender(this); }
  _toggleMeterVisible() { _meterToggleVisible(this); }
  // M268: reusable Combat Report overlay — used by both Victory and Defeat.
  _showCombatReportOverlay() { _showCombatReport(this); }
  _buildCombatReportHtml(opts) { return _buildCombatReport(this, opts); }

  _renderHud() {
    // M273: HUD rebuild invalidates cached element refs in _updateHud.
    this._hudRefs = null;
    this._hudSpeedRef = null;
    this._hudNextTurnRef = null;
    this._hudRoundRef = null;
    const hud = this._el.querySelector('#cbt-hud');
    // M423 — heroes and companions render in separate rows so heroes always
    // own their 4 hero slots and companions never crowd into the hero row.
    const renderCard = (h) => `
      <div class="hm" id="hm-${h.id}">
        <div class="hm-top"><span class="hm-name">${h.name}</span><span class="hm-vals" id="hv-${h.id}">${Math.max(0, Math.floor(h.hp))}/${Math.floor(h.maxHp)}</span></div>
        <div class="hm-bars">
          <div class="hm-bar-t"><div class="hm-bar hp-bar" id="hp-${h.id}" style="width:100%"></div><div class="hm-bar shield-bar" id="sh-${h.id}" style="width:0%"></div></div>
          <div class="hm-bar-t mp-t"><div class="hm-bar mp-bar" id="mp-${h.id}" style="width:100%"></div></div>
        </div>
        <div class="hm-statuses" id="hst-${h.id}">${_renderStatusRow(h.statuses)}</div>
      </div>`;
    const heroRow = `<div class="hud-members hud-members--heroes">${(this._heroes || []).map(renderCard).join('')}</div>`;
    const compRow = (this._companions || []).length
      ? `<div class="hud-members hud-members--companions">${this._companions.map(renderCard).join('')}</div>`
      : '';
    hud.innerHTML = `
      ${heroRow}${compRow}
      <div class="hud-right">
        <div class="hud-round">R<span id="hud-round">${this._round}</span></div>
        <div class="hud-controls">
          ${this._renderTapHudBtn('weapon')}
          ${this._renderTapHudBtn('utility')}
          <button type="button" class="hud-speed-btn" id="hud-next-turn" title="Step one turn" style="display:${this._speedMult === 0 ? '' : 'none'}">⏭</button>
          <button type="button" class="hud-speed-btn" id="hud-speed" title="Cycle speed">${this._speedMult === 0 ? '❚❚' : `${this._speedMult || 1}×`}</button>
          <button type="button" class="hud-pause-btn" id="hud-pause" title="Pause"><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="4" height="12" rx="1"/><rect x="8" y="1" width="4" height="12" rx="1"/></svg></button>
        </div>
      </div>
    `;
    this._el.querySelector('#hud-pause')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._openPauseMenu();
    });
    const openTapInv = () => {
      this.audio.playSfx('click');
      this.manager.push(new TapInventoryScreen(this.manager, this.audio));
    };
    this._el.querySelector('#hud-tap-weapon')?.addEventListener('click', openTapInv);
    this._el.querySelector('#hud-tap-utility')?.addEventListener('click', openTapInv);
    this._drawTapHudIcons();
    // M295 — render potion belt above the HUD
    this._renderCombatPotionBelt();
  }

  /** M295 — Draw the quick-use potion belt row above the combat HUD. */
  _renderCombatPotionBelt() {
    const beltEl = this._el?.querySelector('#cbt-potion-belt');
    if (!beltEl) return;

    const hud = this._el?.querySelector('#cbt-hud');
    if (hud) {
      // Position belt directly above the HUD
      requestAnimationFrame(() => {
        const hudH = hud.getBoundingClientRect().height || 68;
        beltEl.style.bottom = `${hudH}px`;
      });
    }

    // Gather belt slots from all live heroes
    const gs = GameState.get();
    const beltItems = [];
    const allAllies = [...this._heroes, ...this._companions];
    for (const hero of allAllies) {
      const member = [...(gs.party || []), ...(gs.companions || [])].find(m => m.id === hero.id);
      if (!member || !Array.isArray(member.potionBelt)) continue;
      for (let i = 0; i < member.potionBelt.length; i++) {
        const slot = member.potionBelt[i];
        if (!slot) continue;
        beltItems.push({ hero, member, slotIdx: i, pot: slot });
      }
    }

    if (!beltItems.length) {
      beltEl.innerHTML = '';
      beltEl.style.display = 'none';
      return;
    }

    beltEl.style.display = 'flex';
    beltEl.innerHTML = beltItems.map((entry, ei) => {
      const { hero, pot } = entry;
      const alive = hero.alive !== false && hero.hp > 0;
      return `<button type="button" class="cbt-pb-btn" data-pb-entry="${ei}" ${!alive ? 'disabled' : ''}
        title="${pot.name} — use on ${hero.name}">${pot.name.replace(' Potion','').replace(' Flask','').replace('Greater Healing','Gr. Heal').replace('Group Tonic','Tonic')}<br><span style="font-size:0.52rem;opacity:0.7">${hero.name}</span></button>`;
    }).join('');

    beltEl.querySelectorAll('.cbt-pb-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._phase !== 'PLAYING' && this._phase !== 'ROUND_END') return;
        const idx = parseInt(btn.dataset.pbEntry, 10);
        const entry = beltItems[idx];
        if (!entry) return;
        const { hero, member, slotIdx, pot } = entry;
        if (!hero.alive && hero.alive !== undefined) return;
        // Consume: apply effect, remove from belt and from global potions
        this._usePotionOnTargets(pot, [hero]);
        // Remove from potionBelt slot
        member.potionBelt[slotIdx] = null;
        while (member.potionBelt.length && member.potionBelt[member.potionBelt.length - 1] === null) {
          member.potionBelt.pop();
        }
        // Also remove from global potions list (by uid)
        if (pot.uid) {
          const gsPotions = gs.potions || [];
          const pIdx = gsPotions.findIndex(p => p.uid === pot.uid);
          if (pIdx >= 0) gsPotions.splice(pIdx, 1);
        }
        this._renderCombatPotionBelt();
      });
    });
  }

  _renderTapHudBtn(slot) {
    const gs = GameState.get();
    const id = slot === 'weapon' ? gs.equippedTapWeapon : gs.equippedTapUtility;
    const def = id ? getTapItem(id) : null;
    if (!def) {
      return `<button type="button" class="hud-tap-btn is-empty" id="hud-tap-${slot}" title="${slot === 'weapon' ? 'Tap Weapon' : 'Tap Utility'}"><span style="font-size:0.5rem;color:#8a7a6a;letter-spacing:0.05em">${slot === 'weapon' ? 'WPN' : 'UTL'}</span></button>`;
    }
    const ready = (gs.tapCooldown || 0) <= 0;
    return `<button type="button" class="hud-tap-btn${ready ? ' is-ready' : ''}" id="hud-tap-${slot}" title="${def.name}"><canvas width="40" height="40" data-tap-slot="${slot}"></canvas></button>`;
  }

  _drawTapHudIcons() {
    if (!this._el) return;
    const gs = GameState.get();
    const slots = ['weapon', 'utility'];
    for (const slot of slots) {
      const id = slot === 'weapon' ? gs.equippedTapWeapon : gs.equippedTapUtility;
      const def = id ? getTapItem(id) : null;
      if (!def) continue;
      const canvas = this._el.querySelector(`canvas[data-tap-slot="${slot}"]`);
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 40, 40);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, 40, 40);
      try { def.icon(ctx, 20, 20, 40); } catch (e) {}
      const cd = gs.tapCooldown || 0;
      const cdMax = gs.tapCooldownMax || 0;
      if (cd > 0 && cdMax > 0) {
        const remaining = cd / cdMax;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.moveTo(20, 20);
        ctx.arc(20, 20, 24, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * remaining);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f0e8d8';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(String(cd), 20, 21);
        ctx.fillText(String(cd), 20, 21);
      }
    }
  }

  // M302: Flee — DEX check. Returns { dc, highestDex, goldCost, dc_label }.
  // Success threshold: 12 + (avg enemy level - party avg level). Clamped 8..28.
  // Failure costs gold: 10% of party gold, min 50, max 5000.
  _fleeInfo() {
    const gs = GameState.get();
    const heroes = (gs.party || []).filter(m => m && !(m.isCompanion || m.class === 'companion'));
    const partyAvgLvl = heroes.length
      ? heroes.reduce((s, m) => s + (m.level || 1), 0) / heroes.length : 1;
    const enemyAlive = this._allEnemies.filter(e => e.alive);
    // Approximate enemy level from enemy stats (no explicit level field; use xpValue heuristic)
    const avgEnemyLvl = enemyAlive.length
      ? enemyAlive.reduce((s, e) => s + Math.max(1, Math.round((e.xpValue || 10) / 8)), 0) / enemyAlive.length
      : partyAvgLvl;
    const dc = Math.round(Math.max(8, Math.min(28, 12 + (avgEnemyLvl - partyAvgLvl))));
    // Highest DEX among alive party members (use _srcMember.attrs.DEX)
    const aliveHeroes = this._heroes.filter(h => h.alive);
    const aliveCompanions = this._companions.filter(c => c.alive);
    const allAlive = [...aliveHeroes, ...aliveCompanions];
    let highestDex = 8;
    let bestName = 'party';
    for (const h of allAlive) {
      const srcDex = h._srcMember?.attrs?.DEX || 8;
      if (srcDex > highestDex) { highestDex = srcDex; bestName = h.name; }
    }
    // M473 — flee no longer costs gold on failure. goldCost retained as 0
    // for any legacy callers that still read it; do not deduct anywhere.
    const goldCost = 0;
    return { dc, highestDex, bestName, goldCost };
  }

  // Legacy wrapper so old references compile (pause menu rebuilt below).
  _fleeChance() {
    const info = this._fleeInfo();
    // Convert DEX check to rough % for display: chance = clamp(50 + (dex - dc)*5, 10, 90)
    return Math.max(10, Math.min(90, 50 + (info.highestDex - info.dc) * 5));
  }

  _openPauseMenu() {
    if (this._pauseEl) return;
    const prevSpeed = this._speedMult;
    this._speedMult = 0; // pause combat loop
    const fleeData = this._fleeInfo();
    const fleeChance = this._fleeChance();
    const bossFight = !!this.encounter._bossNodeId || this._isBossFight;

    const gs = GameState.get();
    const potions = gs.potions || [];

    this._pauseEl = createEl('div', 'cbt-pause-overlay');
    this._pauseEl.innerHTML = `
      <div class="cpo-box">
        <div class="cpo-title">Paused</div>
        ${potions.length > 0 ? `
          <div class="cpo-potions-title">Use Potion</div>
          <div class="cpo-potions" id="cpo-potions">
            ${potions.map(p => `
              <button type="button" class="cpo-potion-btn" data-pot-uid="${p.uid}">
                ${p.name}
              </button>
            `).join('')}
          </div>
          ${potions.find(p => p.target === 'single') ? `
            <div class="cpo-target-label">Target ally:</div>
            <div class="cpo-targets" id="cpo-targets">
              ${this._allies.filter(a => a.alive || true).map(a => `
                <button type="button" class="cpo-target-btn${!a.alive ? ' cpo-dead' : ''}" data-ally-id="${a.id}">${a.name}${!a.alive ? ' ✝' : ''} (${Math.max(0, Math.floor(a.hp))}/${Math.floor(a.maxHp)})</button>
              `).join('')}
            </div>
          ` : ''}
        ` : '<div class="cpo-hint">No potions. Buy some at the Merchant.</div>'}
        <div class="cpo-actions">
          <button type="button" class="cpo-btn" id="cpo-resume">Resume</button>
          <button type="button" class="cpo-btn cpo-btn-settings" id="cpo-settings">Combat Settings</button>
          <button type="button" class="cpo-btn cpo-btn-flee" id="cpo-flee" ${bossFight ? 'disabled title="Bosses cannot be fled from. Stand and fight!"' : (gs.fleeQueued ? 'disabled title="Flee attempt already queued — resolves at end of round."' : '')}>
            ${bossFight ? 'Flee — Blocked (Boss)' : (gs.fleeQueued ? 'Flee — Queued (end of round)' : `Flee (DEX ${fleeData.highestDex} vs DC ${fleeData.dc})`)}
          </button>
          <button type="button" class="cpo-btn cpo-btn-danger" id="cpo-surrender">Surrender &amp; Return to Town</button>
        </div>
        <div class="cpo-hint">${bossFight ? 'You cannot flee from a boss encounter.' : `Flee: ${fleeData.bestName}'s DEX (${fleeData.highestDex}) + 1d20 vs DC ${fleeData.dc}. Resolves at the end of the current round.`}</div>
        <div class="cpo-combat-settings" id="cpo-combat-settings" style="display:none;margin-top:1rem;padding:0.75rem;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
          <div class="cpo-potions-title" style="margin-bottom:0.6rem">Combat Display</div>
          <div class="cpo-settings-row" id="csrow-dps">
            <label class="cpo-settings-lbl">
              <input type="checkbox" id="cs-dps-meter" class="cpo-settings-cb">
              Show DPS Meter
            </label>
          </div>
          <div class="cpo-settings-row cpo-settings-sub" id="csrow-dps-enemies" style="display:none">
            <label class="cpo-settings-lbl">
              <input type="checkbox" id="cs-dps-enemies" class="cpo-settings-cb">
              &nbsp;&nbsp;Show Enemies in Meter
            </label>
          </div>
          <div class="cpo-settings-row" id="csrow-log">
            <label class="cpo-settings-lbl">
              <input type="checkbox" id="cs-log" class="cpo-settings-cb">
              Show Combat Log
            </label>
          </div>
          <div class="cpo-settings-row cpo-settings-sub" id="csrow-log-secondary" style="display:none">
            <label class="cpo-settings-lbl">
              <input type="checkbox" id="cs-log-secondary" class="cpo-settings-cb">
              &nbsp;&nbsp;Show Secondary Effects
            </label>
          </div>
          <div class="cpo-settings-row">
            <label class="cpo-settings-lbl">
              <input type="checkbox" id="cs-captions" class="cpo-settings-cb">
              Combat Captions
            </label>
          </div>
        </div>
      </div>
    `;

    // Potion use logic
    let selectedPotionUid = null;
    this._pauseEl.querySelectorAll('.cpo-potion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._pauseEl.querySelectorAll('.cpo-potion-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedPotionUid = btn.dataset.potUid;
        const pot = potions.find(p => p.uid === selectedPotionUid);
        if (!pot) return;
        if (pot.target === 'group') {
          // Use immediately on all alive allies
          this._usePotionOnTargets(pot, this._allies.filter(a => a.alive));
          this._closePauseMenu(prevSpeed);
        }
        // single target: wait for target selection below
      });
    });

    this._pauseEl.querySelectorAll('.cpo-target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!selectedPotionUid) return;
        const pot = potions.find(p => p.uid === selectedPotionUid);
        if (!pot) return;
        const target = [...this._allies].find(a => a.id === btn.dataset.allyId);
        if (!target) return;
        // Revival potions work on dead; healing on alive
        if (pot.effect?.type !== 'revive' && !target.alive) return;
        this._usePotionOnTargets(pot, [target]);
        this._closePauseMenu(prevSpeed);
      });
    });

    this._pauseEl.querySelector('#cpo-resume').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._closePauseMenu(prevSpeed);
    });

    // Combat Settings toggle
    this._pauseEl.querySelector('#cpo-settings').addEventListener('click', () => {
      this.audio.playSfx('click');
      const panel = this._pauseEl.querySelector('#cpo-combat-settings');
      if (!panel) return;
      const open = panel.style.display === 'none';
      panel.style.display = open ? 'block' : 'none';
      if (open) this._initCombatSettingsPanel(panel);
    });

    this._pauseEl.querySelector('#cpo-flee').addEventListener('click', (e) => {
      if (bossFight) return;
      const gs2 = GameState.get();
      // M473 — only one flee attempt per round. Ignore subsequent clicks
      // until the round resolves and clears the flag.
      if (gs2.fleeQueued) return;
      this.audio.playSfx('click');
      gs2.fleeQueued = true;
      // Visually disable the button immediately so the user gets feedback
      // even though the pause overlay is about to close.
      const btn = e.currentTarget;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Flee — Queued (end of round)';
        btn.title = 'Flee attempt already queued — resolves at end of round.';
      }
      this._log_('Flee attempt queued — resolves at end of round.', 'hero');
      this._closePauseMenu(1);
    });

    this._pauseEl.querySelector('#cpo-surrender').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._closePauseMenu(1);
      this._defeat();
    });

    this._el.appendChild(this._pauseEl);
  }

  /** Wire combat-settings checkboxes inside the pause-menu settings panel. */
  _initCombatSettingsPanel(panel) {
    const meterPanel = this._el?.querySelector('#cbt-meter');
    const openBtn    = this._el?.querySelector('#cbt-meter-open');
    const logPanel   = this._el?.querySelector('.cbt-log-panel');
    const captionsEl = this._el?.querySelector('#cbt-captions');

    // Read current state.
    const meterHidden = meterPanel?.style.display === 'none';
    const logHidden   = logPanel?.style.display === 'none';
    const captionsOn  = isCombatCaptionsEnabled();

    const dpsCb          = panel.querySelector('#cs-dps-meter');
    const dpsEnemyCb     = panel.querySelector('#cs-dps-enemies');
    const logCb          = panel.querySelector('#cs-log');
    const logSecCb       = panel.querySelector('#cs-log-secondary');
    const captionsCb     = panel.querySelector('#cs-captions');
    const csrowDpsEnemy  = panel.querySelector('#csrow-dps-enemies');
    const csrowLogSec    = panel.querySelector('#csrow-log-secondary');

    if (dpsCb) {
      dpsCb.checked = !meterHidden;
      if (csrowDpsEnemy) csrowDpsEnemy.style.display = dpsCb.checked ? 'block' : 'none';
    }
    if (dpsEnemyCb) {
      dpsEnemyCb.checked = !!(this._el?.querySelector('#cbt-meter-enemies')?.checked);
    }
    if (logCb) {
      logCb.checked = !logHidden;
      if (csrowLogSec) csrowLogSec.style.display = logCb.checked ? 'block' : 'none';
    }
    if (logSecCb) {
      const inLogCb = this._el?.querySelector('#cbt-log-secondary');
      logSecCb.checked = inLogCb ? inLogCb.checked : true;
    }
    if (captionsCb) captionsCb.checked = captionsOn;

    // Wire changes.
    dpsCb?.addEventListener('change', () => {
      const show = dpsCb.checked;
      if (meterPanel) meterPanel.style.display = show ? 'block' : 'none';
      if (openBtn) openBtn.style.display = show ? 'none' : 'block';
      if (csrowDpsEnemy) csrowDpsEnemy.style.display = show ? 'block' : 'none';
    });
    dpsEnemyCb?.addEventListener('change', () => {
      this._meterShowEnemies = dpsEnemyCb.checked;
      const inCb = this._el?.querySelector('#cbt-meter-enemies');
      if (inCb) inCb.checked = dpsEnemyCb.checked;
      this._renderMeter();
    });
    logCb?.addEventListener('change', () => {
      const show = logCb.checked;
      if (logPanel) logPanel.style.display = show ? '' : 'none';
      if (csrowLogSec) csrowLogSec.style.display = show ? 'block' : 'none';
    });
    logSecCb?.addEventListener('change', () => {
      const inCb = this._el?.querySelector('#cbt-log-secondary');
      if (inCb) { inCb.checked = logSecCb.checked; inCb.dispatchEvent(new Event('change')); }
    });
    captionsCb?.addEventListener('change', () => {
      const on = captionsCb.checked;
      localStorage.setItem('emberveil_combat_captions', on ? '1' : '0');
      if (captionsEl) captionsEl.classList.toggle('cbt-captions-active', on);
    });
  }

  _usePotionOnTargets(pot, targets) {
    this.audio.playSfx('shrine'); // healing sound
    const gs = GameState.get();
    const msg = applyPotionEffect(pot, targets);
    // Remove potion from inventory
    const idx = (gs.potions || []).findIndex(p => p.uid === pot.uid);
    if (idx >= 0) gs.potions.splice(idx, 1);
    this._log_(`Used ${pot.name}: ${msg}`, 'hero');
    this._updateHud();
    this._checkCombatEnd();
    // Sync HP back to GameState heroes
    // M266: sync HP by id across heroes + companions. Previously only
    // heroes were written back by index, so companions always started the
    // next combat at full HP on Hard.
    {
      const byId = new Map();
      for (const h of [...this._heroes, ...this._companions]) byId.set(h.id, h);
      for (const m of [...(gs.party || []), ...(gs.companions || [])]) {
        const hc = byId.get(m.id);
        if (!hc) continue;
        m.hp = Math.round(hc.hp);
        m.mp = Math.round(hc.mp || 0);
      }
    }
  }

  _closePauseMenu(restoreSpeed) {
    removeEl(this._pauseEl);
    this._pauseEl = null;
    // M384 — preserve the user's pre-pause speed; only fall back to 1 if we
    // genuinely have no record (restoreSpeed null/undefined/0).
    this._speedMult = (restoreSpeed && restoreSpeed > 0) ? restoreSpeed : 1;
    this._fastMode = this._speedMult > 1;
    this._syncSpeedHud?.();
  }

  _attemptFlee(_legacyPct) {
    // M302: DEX check — highest-DEX ally + 1d20 vs DC.
    const info = this._fleeInfo();
    const dexRoll = Math.floor(Math.random() * 20) + 1;
    const total = info.highestDex + dexRoll;
    const success = total >= info.dc;
    this.audio.playSfx(success ? 'flee' : 'miss');
    if (success) {
      this._log_(`${info.bestName} leads the retreat! (DEX ${info.highestDex} + ${dexRoll} = ${total} vs DC ${info.dc})`, 'hero');
      this._phase = 'FLEE';
      // M276 C16: auto-revive on successful flee (NOT on flee-failure or
      // defeat). Sync HP back to GameState before popping so the map shows
      // the revived members.
      this._applyEndOfCombatAutoRevive('flee');
      try { this._lastParityResult = this._runCombatParityCheck('flee'); } catch (_) {}
      try {
        const gs = GameState.get();
        const byId = new Map();
        for (const h of [...this._heroes, ...this._companions]) byId.set(h.id, h);
        for (const m of [...(gs.party || []), ...(gs.companions || [])]) {
          const hc = byId.get(m.id);
          if (!hc) continue;
          m.hp = Math.round(hc.hp);
          m.mp = Math.round(hc.mp || 0);
        }
      } catch (_) {}
      this._setTimeout(() => this.manager.pop(), 600);
    } else {
      // M473 — flee failure no longer costs gold; enemy still gets a free
      // attack on a random alive ally as the only penalty.
      this._log_(`Flee failed! (DEX ${info.highestDex} + ${dexRoll} = ${total} vs DC ${info.dc}) — the enemy reacts!`, 'enemy');
      // Enemy gets a free attack on random alive ally
      const alive = this._allies.filter(a => a.alive);
      const enemy = this._allEnemies.find(e => e.alive);
      if (alive.length && enemy) {
        const target = alive[Math.floor(Math.random() * alive.length)];
        this._basicAttack(enemy, [target], false, true);
        this._updateHud();
        this._checkCombatEnd();
      }
    }
  }

  _updateHud() {
    // M273: cache HUD element refs by ally id. Previously this fired 4
    // querySelector calls per ally per call (~32 lookups × 10–30 calls per
    // round = O(hundreds) per round). Cache invalidates when _renderHud
    // rebuilds the HUD (sets _hudRefs = null).
    // M388 — keep the turn-strip HP fills in sync with the same cadence.
    if (this._evTurnStrip) { try { this._evTurnStrip.refreshHp(); } catch (_) {} }
    // M389 — same cadence for the bottom card rail.
    if (this._evCardRail) { try { this._evCardRail.refresh(); } catch (_) {} }
    // M405 — caption bar tracks the actual HUD height instead of relying on
    // hard-coded :has() breakpoints. Cheap reads; only writes when changed.
    try { this._repositionCaptions(); } catch (_) {}
    // M434 — status-effect particle overlay now anchored to canvas
    // positions (no SVG grid). See _refreshCanvasStatusOverlay.
    try { this._refreshCanvasStatusOverlay(); } catch (_) {}
    const allAllies = [...this._heroes, ...this._companions];
    if (!this._hudRefs && this._el) {
      this._hudRefs = new Map();
      for (const h of allAllies) {
        this._hudRefs.set(h.id, {
          hp: this._el.querySelector(`#hp-${h.id}`),
          mp: this._el.querySelector(`#mp-${h.id}`),
          hv: this._el.querySelector(`#hv-${h.id}`),
          sh: this._el.querySelector(`#sh-${h.id}`),
          hst: this._el.querySelector(`#hst-${h.id}`),
        });
      }
      this._hudRoundRef = this._el.querySelector('#hud-round');
      this._hudSpeedRef = this._el.querySelector('#hud-speed');
      this._hudNextTurnRef = this._el.querySelector('#hud-next-turn');
    }
    // M384 — speed indicator self-correction. Cheap (one textContent compare)
    // but makes any future speedMult write impossible to desync from the HUD.
    if (this._hudSpeedRef) {
      const v = this._speedMult;
      const label = v === 0 ? '❚❚' : `${v}×`;
      if (this._hudSpeedRef.textContent !== label) this._hudSpeedRef.textContent = label;
    }
    if (this._hudNextTurnRef) {
      const want = (this._speedMult === 0) ? '' : 'none';
      if (this._hudNextTurnRef.style.display !== want) this._hudNextTurnRef.style.display = want;
    }
    // M386 — perf-engineer feedback: skip DOM writes when the rendered value
    // matches the last frame's value. _updateHud runs every tick; status-row
    // innerHTML and HP textContent were the worst offenders. Cache last value
    // per ally on the refs object so the compare is one === per ally.
    for (const h of allAllies) {
      const refs = this._hudRefs?.get(h.id);
      if (!refs) continue;
      if (refs.hp) {
        const w = `${Math.max(0, h.hp / h.maxHp * 100)}%`;
        if (refs._lastHp !== w) { refs.hp.style.width = w; refs._lastHp = w; }
      }
      if (refs.mp) {
        const w = `${Math.max(0, h.mp / h.maxMp * 100)}%`;
        if (refs._lastMp !== w) { refs.mp.style.width = w; refs._lastMp = w; }
      }
      if (refs.hv) {
        const t = `${Math.max(0, Math.floor(h.hp))}/${Math.floor(h.maxHp)}`;
        if (refs._lastHv !== t) { refs.hv.textContent = t; refs._lastHv = t; }
      }
      if (refs.sh) {
        const barrier = (h.statuses || []).reduce((sum, s) => s.type === 'barrier' && s.power > 0 ? sum + s.power : sum, 0);
        const w = barrier > 0 ? `${Math.min(100, barrier / h.maxHp * 100)}%` : '0%';
        if (refs._lastSh !== w) { refs.sh.style.width = w; refs._lastSh = w; }
      }
      // M293: update status row with current statuses and durations.
      // M386: dirty-check the rendered HTML so untouched status rows skip
      // the innerHTML assignment + style recalc entirely.
      if (refs.hst) {
        const html = _renderStatusRow(h.statuses);
        if (refs._lastHst !== html) { refs.hst.innerHTML = html; refs._lastHst = html; }
      }
    }
    if (this._hudRoundRef) {
      const r = String(this._round);
      if (this._hudRoundRef._last !== r) { this._hudRoundRef.textContent = r; this._hudRoundRef._last = r; }
    }
    // M386 — legacy round-only line removed (was dead code after the
    // round-ref update above).
  }

  _log_(msg, type='normal', breakdown=null) {
    this._log.push({ msg, type, breakdown });
    // M377 — mirror to combat debug buffer (covers messages emitted from
    // every code path: basic attack, skills, statuses, legendary text).
    if (combatDebug.enabled) {
      combatDebug.push('log_line', { msg, type, dmg: parseDamageFromLogLine(msg) });
    }
    const el = this._el?.querySelector('#cbt-log');
    if (!el) return;
    // M258: classify secondary effects (statuses, buffs, expirations) for the Secondary filter.
    const isSecondary = !breakdown && type === 'normal' && /poison|burn|bleed|stun|freeze|chill|shock|barrier|shield|buff|debuff|expire|regen|weaken|strengthen|corrupt|curse|blessed|mark|taunt|silence/i.test(msg);
    const cls = isSecondary ? `cbt-entry cbt-${type} cbt-secondary` : `cbt-entry cbt-${type}`;
    const div = createEl('div', cls);
    // Escape HTML then wrap mitigation keywords with hoverable spans.
    const esc = String(msg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    div.innerHTML = wrapMitigationTags(esc);
    if (breakdown) {
      div.classList.add('has-breakdown');
      div.dataset.breakdown = JSON.stringify(breakdown);
      div.title = '';
    }
    el.appendChild(div);
    while (el.children.length > 10) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;

    // M296: combat captions bar — mirror latest entry for screen-reader-friendly scanning
    const captionsEl = this._el?.querySelector('#cbt-captions');
    if (captionsEl && captionsEl.classList.contains('cbt-captions-active')) {
      const line = createEl('div', 'cbt-caption-line');
      line.textContent = String(msg);
      captionsEl.appendChild(line);
      // Keep last 2 lines visible; auto-remove older
      while (captionsEl.children.length > 2) captionsEl.removeChild(captionsEl.firstChild);
      // Auto-fade the oldest line after 3s
      const lines = captionsEl.querySelectorAll('.cbt-caption-line');
      lines.forEach((l, i) => {
        if (i < lines.length - 1) {
          l.classList.add('cbt-caption-fading');
        } else {
          l.classList.remove('cbt-caption-fading');
        }
      });
    }
  }

  update(dt) {
    // M322: while the boss intro splash is up, freeze all combat ticks. The
    // splash is dismissed only on tap; combat must not advance underneath.
    // M386: replaced per-frame querySelector with a boolean flag set/cleared
    // in showBossSplash / dismiss. Same gate, no DOM walk per tick.
    if (this._bossIntroActive) {
      return;
    }
    this._t += dt;

    // Update particles
    this._particles = this._particles.filter(p => {
      p.life -= dt; p.x += p.vx; p.y += p.vy; p.vy += 50 * dt;
      return p.life > 0;
    });

    // Update floating damage numbers
    this._dmgNumbers = this._dmgNumbers.filter(d => {
      d.life -= dt; d.y -= 38 * dt;
      return d.life > 0;
    });

    // M72/M76: tap effects
    if (this._tapEffects?.length) {
      this._tapEffects = this._tapEffects.filter(fx => {
        fx.t += dt;
        // Legacy two-phase fly/burst particles
        if (fx.phase === 'fly') {
          if (fx.t >= fx.dur) { fx.phase = 'burst'; fx.t = 0; }
          return true;
        }
        if (fx.phase === 'burst') {
          if (fx.t >= fx.burst.life) return false;
          return true;
        }
        // M76 typed particles
        if (fx.type) {
          const delay = fx.delay || 0;
          if (fx.t < delay) return true;
          const lt = fx.t - delay;
          // Sparks/dust get velocity integration
          if (fx.type === 'spark' || fx.type === 'dust') {
            fx.x += (fx.vx || 0) * dt;
            fx.y += (fx.vy || 0) * dt;
            fx.vy = (fx.vy || 0) + (fx.type === 'dust' ? 180 : 60) * dt;
          }
          return lt < (fx.life || 0.5);
        }
        return false;
      });
    }
    if (this._tapHint) {
      this._tapHint.life -= dt;
      if (this._tapHint.life <= 0) this._tapHint = null;
    }

    // Update flash timers
    for (const [id, t] of this._flashMap) {
      const nt = t - dt;
      if (nt <= 0) this._flashMap.delete(id); else this._flashMap.set(id, nt);
    }

    if (this._phase === 'START') {
      if (this._t >= this._startDelay) { this._phase = 'PLAYING'; this._t = 0; this._log_(`${this.encounter.name}`, 'round'); }
      return;
    }
    if (this._phase !== 'PLAYING') return;
    if (this._speedMult === 0) return; // paused
    // M390 — manual mode: while a player hero is awaiting input, freeze the
    // turn timer entirely. The accumulator is preserved (not reset) so a tick
    // resumes mid-fraction once input clears (Phase 02 §3 clarification).
    if (this._awaitingInput) return;
    // M390 — while extra-attack drain is in flight (chained setTimeouts so the
    // player sees each strike paint), keep the turn loop paused; otherwise the
    // engine would race ahead and start the next actor before the active one
    // finishes their bonus swings. Reset on completion in _drainExtraAttacks.
    if (this._drainingExtras) return;

    this._turnTimer += dt * (this._speedMult || 1);
    if (this._turnTimer < TURN_SPEED) return;
    this._turnTimer = 0;
    this._executeTurn();
  }

  _executeTurn() {
    if (this._turnIdx >= this._turnOrder.length) {
      this._round++;
      this._processStatusEffects();
      this._regenMana();
      // M340 — per-round Barrier regen for magic-shield holders. Only the
      // shield-sourced barrier replenishes; skill-cast barriers stay one-shot.
      const _all = [...(this._allies || []), ...(this._enemies || [])];
      for (const c of _all) {
        if (!c.alive || !c.statuses) continue;
        for (const s of c.statuses) {
          if (s.type === 'barrier' && s.fromMagicShield && s.regen > 0 && s.maxPower > 0) {
            const before = s.power;
            s.power = Math.min(s.maxPower, s.power + s.regen);
            const restored = s.power - before;
            if (restored > 0 && this._allies?.includes(c)) {
              this._spawnDmgNumber(c.x, c.y - 36, `+${restored} brr`, '#80c0ff');
            }
          }
        }
      }
      this._buildTurnOrder();
      GameState.tickTapCooldown?.('round');
      // M473 — resolve any queued Flee attempt at the round boundary.
      // Per-round single attempt; flag is cleared either way.
      try {
        const _gsR = GameState.get();
        if (_gsR.fleeQueued) {
          _gsR.fleeQueued = false;
          this._attemptFlee(this._fleeChance());
        }
      } catch (_) {}
      this._log_(`── Round ${this._round} ──`, 'round');
      // M377 — round boundary debug marker.
      if (combatDebug.enabled) {
        combatDebug.setRound(this._round);
        combatDebug.push('round_start', { round: this._round });
      }
      return;
    }

    GameState.tickTapCooldown?.('turn');
    const actor = this._turnOrder[this._turnIdx++];
    if (!actor.alive) return;
    // M388 — update turn-strip active chip + HP fills.
    if (this._evTurnStrip) {
      try { this._evTurnStrip.setActiveActor(actor.id); } catch (_) {}
      try { this._evTurnStrip.refreshHp(); } catch (_) {}
    }
    // M389 — update card-rail active hero + HP/MP/status.
    if (this._evCardRail) {
      try { this._evCardRail.setActiveActor(actor.id); } catch (_) {}
      try { this._evCardRail.refresh(); } catch (_) {}
    }
    // M377 — turn-start debug marker.
    if (combatDebug.enabled) {
      combatDebug.setTurn(this._turnIdx, actor?.name || null);
      combatDebug.push('turn_start', {
        actor: actor.name, actorId: actor.id,
        side: this._allies?.includes(actor) ? 'ally' : 'enemy',
        hp: actor.hp, maxHp: actor.maxHp, mp: actor.mp, maxMp: actor.maxMp,
        statuses: (actor.statuses || []).map(s => ({ type: s.type, duration: s.duration, power: s.power })),
      });
    }

    // M89: enemySkipRound — Time Stop / Slow Time / similar effects mark
    // enemies with skipNextTurn; they lose their action and the flag clears.
    if (actor.skipNextTurn) {
      actor.skipNextTurn = false;
      this._log_(`${actor.name} is frozen in time!`, 'miss');
      return;
    }
    // M89: extraAction — after the regular turn runs, if actor has a pending
    // extra action, queue it to fire immediately next. We decrement here and
    // push the actor back into the turn order at the current index + 1 below.


    // M84: consume revive immunity at the start of the revived character's turn.
    // If the Divine Bulwark talent is active, immunity survives one full round
    // (reviveImmuneRounds decrements each round, cleared at 0).
    if (actor.reviveImmune) {
      if (actor.reviveImmuneRounds && actor.reviveImmuneRounds > 0) {
        // Extended talent — leave immune; round tick handles decay.
      } else {
        actor.reviveImmune = false;
      }
    }

    // Stun check
    const stun = actor.statuses?.find(s => s.type === 'stun');
    if (stun) {
      this._log_(`${actor.name} is stunned and cannot act!`, 'miss');
      return;
    }

    // M303: Freeze — acts like stun for one round (removes status immediately)
    const freezeIdx = (actor.statuses || []).findIndex(s => s.type === 'freeze');
    if (freezeIdx !== -1) {
      actor.statuses.splice(freezeIdx, 1);
      this._log_(`${actor.name} is frozen and cannot act!`, 'miss');
      return;
    }

    // M398: Sleep — full lockout, any damage wakes (handled in _applyDamage).
    // Duration ticks down at end of round just like other statuses; here we
    // just skip the actor's turn. The "stunned for up to 2 rounds" framing
    // from the user spec is implemented as duration:2 + damage-wake.
    if ((actor.statuses || []).some(s => s.type === 'sleep')) {
      this._log_(`${actor.name} is asleep!`, 'miss');
      return;
    }

    // M303: Confused — 50% chance to skip action
    const confused = (actor.statuses || []).find(s => s.type === 'confused');
    if (confused && Math.random() < 0.5) {
      this._log_(`${actor.name} is confused and stumbles!`, 'miss');
      return;
    }

    // M131: per-skill cooldown tick — decrement every active cooldown, drop at 0.
    if (actor.skillCooldowns) {
      for (const k of Object.keys(actor.skillCooldowns)) {
        if (--actor.skillCooldowns[k] <= 0) delete actor.skillCooldowns[k];
      }
    }

    if (actor.isHero) {
      this._heroAI(actor);
    } else {
      this._enemyAI(actor);
    }

    // M391 — when a player hero is awaiting input, do NOT splice extras back
    // into the queue. The action hasn't resolved yet; extras will be drained
    // synchronously inside _dispatchManualAction() once the player picks an
    // action. Splicing here would cause the same actor to be popped again
    // mid-input and prompt the player a second time. Phase 02 §5.
    if (this._awaitingInput && this._awaitingInput.id === actor.id) {
      // No-op for this turn — drain runs after dispatch.
    } else {
      // M89: consume pending extraAction — actor takes another turn right after.
      if (actor.extraAction && actor.extraAction > 0 && actor.alive) {
        actor.extraAction--;
        this._turnOrder.splice(this._turnIdx, 0, actor);
        this._log_(`${actor.name} takes an extra action!`, 'round');
      }
      // [M231 AS] attack-speed bonus attack. Same mechanic as extraAction — we
      // splice the actor back in at the current index so they fire immediately
      // again. Guarded by the feature flag via _speedExtraPerRound == 0 when
      // disabled, so this block is a no-op unless the flag is on.
      if (actor._speedExtraRemaining && actor._speedExtraRemaining > 0 && actor.alive) {
        actor._speedExtraRemaining--;
        this._turnOrder.splice(this._turnIdx, 0, actor);
        this._log_(`${actor.name} strikes again (fast weapon)!`, 'round');
      }
    }

    this._checkCombatEnd();
  }

  // M274: hero AI policy extracted to src/ui/screens/_aiTargeting.js. This
  // wrapper resolves party state, calls the pure picker, then performs the
  // execution side effects (mp deduct, cooldown set, executeSkill, fallback
  // to basic attack). Wraps to keep the existing _heroAI(actor) call
  // signature stable across the rest of CombatScreen.
  _heroAI(actor) {
    const gs = GameState.get();
    const partyMember = [...gs.party, ...gs.companions].find(m => m.id === actor.id);
    const aliveEnemies = this._allEnemies.filter(e => e.alive);
    // M398 — present the AI with awake enemies only when at least one exists,
    // so AoE/single-target skills naturally pick around sleeping targets and
    // the crowd-control isn't immediately wasted. Falls back to the full
    // alive list when every enemy is asleep.
    const awakeEnemies = aliveEnemies.filter(e => !(e.statuses || []).some(s => s.type === 'sleep'));
    const enemies = awakeEnemies.length ? awakeEnemies : aliveEnemies;
    const allies = this._allies.filter(a => a.alive);
    const fallenAllies = this._allies.filter(a => !a.alive);
    if (!enemies.length) return;

    // M279: manual (FF-style) combat — when enabled in Difficulty advanced
    // options, real party heroes (NOT companions/pets) get a UI prompt to
    // pick attack or active spell. The auto picker is bypassed and the loop
    // pauses until the player taps an action.
    // M397 update: UI Overhaul is purely a visual setting — it must not force
    // manual combat. Manual combat is opt-in via the dedicated setting only.
    const wantsManual = !!gs.manualCombat;
    if (wantsManual && actor.isHero && partyMember && !(partyMember.isCompanion || partyMember.class === 'companion')) {
      // M390 — when the new combat UI is on, pause for input via the spell
      // rail instead of the modal popup. Both paths route through the same
      // resolution helper (_dispatchManualAction).
      if (isUiOverhaulEnabled() && this._evCardRail) {
        this._pauseForPlayerInput(actor, partyMember, enemies, allies, fallenAllies);
      } else {
        this._openManualActionPanel(actor, partyMember, enemies, allies, fallenAllies);
      }
      return;
    }

    const decision = pickHeroAction(actor, partyMember, allies, enemies, fallenAllies);
    // M377 — log AI decision (chosen action, mp before/after if skill).
    if (combatDebug.enabled) {
      combatDebug.push('ai_decision', {
        actor: actor.name, actorId: actor.id,
        kind: decision.kind,
        chosen: decision.kind === 'skill' ? (decision.skill?.id || decision.skill?.name) : 'attack',
        mpAvailable: actor.mp,
        cooldowns: { ...(actor.skillCooldowns || {}) },
      });
    }
    if (decision.kind === 'skill') {
      const picked = decision.skill;
      const mpBefore = actor.mp;
      actor.mp -= (picked.mpCost || 0);
      if (!actor.skillCooldowns) actor.skillCooldowns = {};
      actor.skillCooldowns[picked.id] = picked.cooldown || 2;
      combatDebug.push('skill_cast_attempt', {
        actor: actor.name, skillId: picked.id, skillName: picked.name,
        mpCost: picked.mpCost || 0, mpBefore, mpAfter: actor.mp,
        cooldown: picked.cooldown || 2,
      });
      this._executeSkill(actor, picked, enemies, allies, partyMember);
    } else {
      this._basicAttack(actor, enemies, true);
    }
    this._updateHud();
  }

  // M390 — pause the combat loop for manual hero input via the new spell
  // rail. Replaces the legacy `_openManualActionPanel` modal when the
  // 'New Combat UI (Beta)' flag is on. Phase 02 §3 state machine.
  _pauseForPlayerInput(actor, partyMember, enemies, allies, fallenAllies) {
    if (!actor || !partyMember) return;
    this._awaitingInput = actor;
    this._awaitingPartyMember = partyMember;
    this._awaitingEnemies = enemies;
    this._awaitingAllies = allies;
    this._awaitingFallen = fallenAllies;

    // Lazy single-bind for the document-level click contract (Phase 06 §5).
    if (!this._spellPickHandler) {
      this._spellPickHandler = (e) => {
        const detail = e?.detail || {};
        if (!this._awaitingInput) return;
        if (detail.characterId !== this._awaitingInput.id) return;
        const skillId = detail.skillId;
        const targetId = detail.targetCombatantId || null;
        try {
          this._dispatchManualAction(skillId, targetId);
        } catch (err) {
          console.warn('[manualCombat] dispatch failed', err);
        }
      };
      document.addEventListener('ev:spell-pick', this._spellPickHandler);
      // M434: targeting now resolves via _canvasTargetHandler (canvas
      // pointerdown). The legacy `ev:target-select` event listener is
      // intentionally removed — no source dispatches it anymore.
      // Card-rail click delegation — buttons created by EvCardRail dispatch
      // ev:spell-pick on document. We also listen here as a fallback for
      // direct clicks bubbling from the rail container.
      this._railClickHandler = (e) => {
        const btn = e.target?.closest?.('.spell-icon');
        if (!btn || btn.disabled) return;
        const card = btn.closest('.ev-char-card');
        const charId = card?.dataset?.charId;
        const skillId = btn.dataset?.skill;
        if (!charId || !skillId) return;
        if (!this._awaitingInput || charId !== this._awaitingInput.id) return;
        e.preventDefault();
        this._handleRailClick(skillId);
      };
      this._el?.addEventListener('click', this._railClickHandler, true);
    }

    // Render hot rail for the active actor.
    this._refreshSpellRailForActive();

    if (this._evTurnStrip) {
      try { this._evTurnStrip.setActiveActor(actor.id); } catch (_) {}
    }
  }

  /**
   * Repaint the spell rail of the actor currently awaiting input. Called when
   * the rail goes hot, when an item is consumed, or when status flips
   * (silenced/stunned mid-window).
   */
  _refreshSpellRailForActive() {
    if (!this._awaitingInput || !this._evCardRail) return;
    const actor = this._awaitingInput;
    const partyMember = this._awaitingPartyMember;
    if (!partyMember) return;
    const skills = getUnlockedSkills(partyMember.class, partyMember.level || 1)
      .filter(s => s.type !== 'passive');
    const weapon = partyMember?.equipment?.weapon;
    const beltCount = (partyMember?.potionBelt || []).filter(s => s).length;
    this._evCardRail.setSpellRail(actor.id, {
      skills,
      weaponName: weapon?.name || 'Attack',
      weaponDamageType: weapon?.damageType || 'physical',
      beltCount,
      actor,
      skillCooldowns: actor.skillCooldowns || {},
      isHot: true,
    });
  }

  /**
   * Translate a rail click into either an immediate dispatch (no-target /
   * AOE / self-cast) or a targeting handoff to EvBattlefield.
   */
  _handleRailClick(skillId) {
    if (!this._awaitingInput) return;
    const actor = this._awaitingInput;
    if (skillId === 'skip_turn' || skillId === 'use_item' || skillId === 'basic_attack') {
      this._dispatchManualAction(skillId, null);
      return;
    }
    const skill = SKILLS[skillId];
    if (!skill) { this._dispatchManualAction('basic_attack', null); return; }
    // M434: Single-target offensive → engage canvas targeting. The user
    // taps an enemy sprite on the canvas; _handleCanvasTargetClick resolves
    // the hit and calls _dispatchManualAction. No SVG grid involvement.
    const needsTarget = (skill.aoe == null || skill.aoe === 'single')
                       && (skill.type === 'magic' || skill.type === 'attack');
    if (needsTarget) {
      this._pendingSkillId = skillId;
      this._targetingActive = true;
      this._targetingSourceId = actor.id;
      this._targetingShape = skill.aoe || 'single';
      // The canvas highlight rail (drawn in `draw()`) reads these flags.
      return;
    }
    // AOE / heal / buff / no-target → dispatch immediately.
    this._dispatchManualAction(skillId, null);
  }

  /**
   * Resolve a chosen manual action and resume the turn loop.
   * Shared by the spell-rail (M390) and a future bonus-turn flow.
   */
  _dispatchManualAction(skillId, targetCombatantId) {
    if (!this._awaitingInput) return;
    const actor = this._awaitingInput;
    const partyMember = this._awaitingPartyMember;
    const enemies = (this._awaitingEnemies || []).filter(e => e.alive);
    const allies  = this._awaitingAllies || [];

    // Clear awaiting state BEFORE we resolve; resolution may chain (e.g.
    // _drainExtraAttacks in M391) and we don't want a re-entry to keep the
    // rail hot mid-resolution.
    this._awaitingInput = null;
    this._awaitingPartyMember = null;
    this._awaitingEnemies = null;
    this._awaitingAllies = null;
    this._awaitingFallen = null;

    // Cool every spell rail.
    try { this._evCardRail?.setActiveActor(null); } catch (_) {}

    try {
      if (skillId === 'skip_turn') {
        this._log_(`${actor.name} holds their action.`, 'flavor');
      } else if (skillId === 'use_item') {
        // Free action — re-arm the rail and stay awaiting input.
        this._consumeManualItem(actor, partyMember);
        this._awaitingInput = actor;
        this._awaitingPartyMember = partyMember;
        this._awaitingEnemies = enemies;
        this._awaitingAllies  = allies;
        try { this._evCardRail?.setActiveActor(actor.id); } catch (_) {}
        this._refreshSpellRailForActive();
        return;
      } else if (skillId === 'basic_attack') {
        const targetEnemies = targetCombatantId
          ? enemies.filter(e => e.id === targetCombatantId).concat(enemies)
          : enemies;
        this._basicAttack(actor, targetEnemies, true);
      } else {
        const picked = SKILLS[skillId];
        if (!picked) {
          this._basicAttack(actor, enemies, true);
        } else {
          actor.mp -= (picked.mpCost || 0);
          if (!actor.skillCooldowns) actor.skillCooldowns = {};
          actor.skillCooldowns[picked.id] = picked.cooldown || 2;
          // Bias _executeSkill toward the chosen target by sorting it first.
          const orderedEnemies = targetCombatantId
            ? enemies.filter(e => e.id === targetCombatantId).concat(enemies.filter(e => e.id !== targetCombatantId))
            : enemies;
          this._executeSkill(actor, picked, orderedEnemies, allies, partyMember);
        }
      }
    } catch (err) {
      console.warn('[manualCombat] dispatch failed', err);
      try { this._basicAttack(actor, enemies, true); } catch (_) {}
    }

    // Post-action cleanup — runs after extra-attack drain completes (or
    // immediately if there's nothing to drain). Pulled into a closure so the
    // async drain chain can fire it on the final tick.
    const finalize = () => {
      this._turnTimer = 0;
      this._updateHud();
      this._checkCombatEnd?.();
    };

    // M390 — drain any pending extra attacks for this actor with a small
    // delay between strikes so the player sees each one paint. Phase 02 §5;
    // sync loop in M391 didn't repaint mid-state.
    if (skillId !== 'skip_turn' && actor.alive) {
      this._drainExtraAttacks(actor, enemies, allies, partyMember, finalize);
    } else {
      finalize();
    }
  }

  /**
   * M390 — Drain pending extraAction / _speedExtraRemaining slots with a
   * staggered delay so each bonus strike paints. The original M391 sync loop
   * fired all strikes in one JS tick; damage numbers stacked and players
   * couldn't see the chain. Now: chain via _setTimeout, sets _drainingExtras
   * to keep update() paused, calls onDone at end (also on early break).
   */
  _drainExtraAttacks(actor, enemies, allies, partyMember, onDone) {
    const STRIKE_DELAY_MS = 380;
    const finish = () => {
      this._drainingExtras = false;
      try { onDone?.(); } catch (e) { console.warn('[manualCombat] drain onDone failed', e); }
    };
    const consumeNext = () => {
      if (!actor.alive) return false;
      if (actor.extraAction && actor.extraAction > 0) {
        actor.extraAction--;
        return 'extra action';
      }
      if (actor._speedExtraRemaining && actor._speedExtraRemaining > 0) {
        actor._speedExtraRemaining--;
        return 'fast weapon';
      }
      return false;
    };
    // Peek without consuming so we can short-circuit when there's nothing.
    const hasAny = (
      (actor.extraAction && actor.extraAction > 0) ||
      (actor._speedExtraRemaining && actor._speedExtraRemaining > 0)
    );
    if (!hasAny || !actor.alive) {
      finish();
      return;
    }
    this._drainingExtras = true;
    let safety = 8;
    const step = () => {
      if (this._destroyed) { this._drainingExtras = false; return; }
      if (safety-- <= 0) { finish(); return; }
      const liveEnemies = (enemies || []).filter(e => e.alive);
      if (!liveEnemies.length) { finish(); return; }
      const label = consumeNext();
      if (!label) { finish(); return; }
      try {
        this._basicAttack(actor, liveEnemies, true);
        this._log_(`${actor.name} strikes again (${label})!`, 'round');
        this._updateHud?.();
      } catch (e) {
        console.warn('[manualCombat] drain step failed', e);
        finish();
        return;
      }
      // End early if combat ended mid-drain.
      const enemiesAlive = (this._enemies || []).some(e => e.alive);
      const alliesAlive = [...(this._heroes || []), ...(this._companions || [])].some(a => a.alive);
      if (!enemiesAlive || !alliesAlive) { finish(); return; }
      this._setTimeout(step, STRIKE_DELAY_MS);
    };
    this._setTimeout(step, STRIKE_DELAY_MS);
  }

  /**
   * M394 — render HTML for the spell tooltip card. Returns null when the
   * skill id maps to nothing tooltip-worthy (basic_attack still gets a
   * weapon-based tooltip).
   */
  _renderSpellTooltip(skillId, characterId) {
    if (!skillId) return null;
    const escape = (s) => String(s ?? '').replace(/[&<>]/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    const findActor = () => {
      const all = [...(this._heroes || []), ...(this._companions || [])];
      return all.find(h => h?.id === characterId) || this._awaitingInput || null;
    };
    if (skillId === 'basic_attack') {
      const actor = findActor();
      const gs = GameState.get();
      const pm = [...(gs.party || []), ...(gs.companions || [])].find(m => m.id === actor?.id);
      const w = pm?.equipment?.weapon;
      const dmg = actor?.dmg ? `${actor.dmg[0]}–${actor.dmg[1]}` : '?';
      return `<strong>Basic Attack${w?.name ? ` — ${escape(w.name)}` : ''}</strong>
        <div class="tt-meta"><span class="tt-est">${dmg} dmg</span> · 0 MP · physical</div>
        <p>No mana, no cooldown. The default action — strikes one enemy.</p>`;
    }
    if (skillId === 'use_item') {
      return `<strong>Use Item</strong>
        <div class="tt-meta"><span class="tt-cost">Free action</span> — does not consume turn</div>
        <p>Consume the next potion in this hero's belt. Card stays hot afterwards.</p>`;
    }
    if (skillId === 'skip_turn') {
      return `<strong>End Turn</strong>
        <div class="tt-meta">No action</div>
        <p>Pass to the next combatant. The hero recovers any per-turn regen as normal.</p>`;
    }
    const rawSkill = SKILLS[skillId];
    if (!rawSkill) return null;
    const actor = findActor();
    const gs = GameState.get();
    const partyMember = [...(gs?.party || []), ...(gs?.companions || [])].find(m => m.id === actor?.id);
    // Merge talents + upgrades so the displayed numbers match what'll actually hit.
    const skill = (mergeSkillForCast && partyMember) ? (mergeSkillForCast(rawSkill, partyMember) || rawSkill) : rawSkill;
    const cd = (actor?.skillCooldowns || {})[skillId] || 0;
    const mp = skill.mpCost || 0;
    const cdLine = cd > 0 ? `<span class="tt-cd">CD ${cd}</span>` :
                  (skill.cooldown ? `CD ${skill.cooldown}` : 'no CD');
    const aoeLine = skill.aoe && skill.aoe !== 'single' ? ` · ${escape(skill.aoe)}` : '';
    // M396 — full estimated damage matching CombatScreen damage path: include
    // category multiplier, hero damage scalar, spell power, attackPower bonus,
    // and weapon flavor. Also show the formula breakdown the user asked for.
    let estLine = '';
    let formulaLine = '';
    const isDamage = !!(skill.damageMult || skill.basePower);
    if (isDamage) {
      const mult = (skill.damageMult || skill.basePower || 0);
      const rawDs = (skill.damageStat || '').toLowerCase();
      // M399 — resolve hybrid skills against the equipped weapon for the tip.
      const hybrid = this._resolveHybridStat(rawDs, actor);
      const ds = hybrid.hybrid ? hybrid.stat : rawDs;
      const stat = (ds || '').toUpperCase();
      const balSkill = getBalance().combat?.skill || {};
      const heroSkillMult = balSkill.heroDamageMult ?? 1.0;
      const wcat = (actor?.weaponCategory || '').toLowerCase();
      // M411 — weapon category drives the spell category (parity with the
      // damage path). Magic/heal floor at 'magic'; otherwise weapon decides.
      const cat = skill.damageCategory || (
        skill.type === 'magic' || skill.type === 'heal' ? 'magic'
        : (wcat === 'magic' || wcat === 'heavy' || wcat === 'light') ? wcat
        : 'heavy'
      );
      const catMult = cat === 'magic' ? (balSkill.magicMult ?? 0.78)
                    : cat === 'heavy' ? (balSkill.heavyMult ?? 1.00)
                    : (balSkill.lightMult ?? 1.00);
      const finalMult = mult * heroSkillMult * catMult;
      const attrs = partyMember?.attrs || { STR:8, DEX:8, INT:8 };
      const intCoef = getBalance().combat?.formulas?.intSpellPowerCoef ?? 0.025;
      const spellPower = +(((attrs.INT || 8) * intCoef).toFixed(3));
      const attackPower = Math.round((attrs.STR || 8) * 1.5);
      // M399 — isSpell follows the resolved category, not the raw key.
      const isSpell = (cat === 'magic');
      const affixSP = actor?.affixSpellPower || 0;
      const powerBonus = isSpell ? (spellPower + affixSP) : (attackPower * 0.05);
      const weaponMid = actor?.dmg ? (actor.dmg[0] + actor.dmg[1]) / 2 : 0;
      // Weapon Scaling is always on — stat term drives off weapon midpoint.
      const statTerm = weaponMid;
      const weaponFlavor = isSpell ? 0 : Math.round(weaponMid * 0.1);
      const est = Math.max(0, Math.round(statTerm * finalMult * (1 + powerBonus)) + weaponFlavor);
      estLine = `<span class="tt-est">~${est} dmg</span> · `;
      // Formula breakdown — terse, single line. Hybrid skills get a small
      // badge so the player sees which side won the either-or resolution.
      const spLabel = isSpell ? ` × (1 + ${spellPower.toFixed(2)} SP)` : ` × (1 + ${(attackPower * 0.05).toFixed(2)} AP)`;
      const flavorLabel = weaponFlavor > 0 ? ` + ${weaponFlavor}` : '';
      const statLabel = `wpn ${weaponMid.toFixed(0)}`;
      const hybridBadge = hybrid.hybrid ? `<span style="background:rgba(160,80,255,0.18);color:#c8a8ff;padding:0 4px;border-radius:3px;margin-right:3px">hybrid → ${stat}</span>` : '';
      formulaLine = `<div class="tt-formula" style="font-size:0.65rem;color:rgba(232,200,128,0.65);margin-top:2px;font-family:'Inter',monospace">${hybridBadge}${statLabel} × ${finalMult.toFixed(2)}${spLabel}${flavorLabel} · ${escape(cat)}</div>`;
    }
    const desc = skill.description || skill.desc || '';
    return `<strong>${escape(skill.name || skillId)}</strong>
      <div class="tt-meta">${estLine}<span class="tt-cost">${mp} MP</span> · ${cdLine}${aoeLine}</div>
      ${formulaLine}
      ${desc ? `<p>${escape(desc)}</p>` : ''}`;
  }

  /**
   * Consume one item from the active hero's potion belt as a free action.
   * Mirrors the auto-resolve path; details delegated to existing potion code.
   */
  _consumeManualItem(actor, partyMember) {
    const belt = partyMember?.potionBelt || [];
    const slotIdx = belt.findIndex(s => s);
    if (slotIdx < 0) {
      this._log_(`${actor.name} has no items.`, 'flavor');
      return;
    }
    const slot = belt[slotIdx];
    try {
      const msg = applyPotionEffect(slot, [actor]);
      this._log_(`${actor.name} uses ${slot?.name || 'an item'}: ${msg}`, 'hero');
    } catch (e) {
      console.warn('[manualCombat] item consume failed', e);
    }
    belt[slotIdx] = null;
    this._updateHud();
  }

  // M279 — Manual combat action panel. Pauses the turn loop, surfaces a
  // modal with Attack + active spell buttons (cooldown + mp + estimated
  // damage), then dispatches the chosen action and resumes.
  _openManualActionPanel(actor, partyMember, enemies, allies, fallenAllies) {
    if (this._manualOpen) return; // guard against double-open per turn
    this._manualOpen = true;
    const prevSpeed = this._speedMult;
    this._speedMult = 0; // pause loop
    const skills = getUnlockedSkills(partyMember.class, partyMember.level || 1)
      .filter(s => s.type !== 'passive');
    // M398 — bottom-anchored skill menu (no full-screen overlay). Pinned to
    // the bottom of the combat screen so the battlefield stays visible and
    // the player can tap a skill while waiting for animations to finish.
    const overlay = createEl('div', 'mc-overlay');
    overlay.style.cssText = 'position:absolute;left:0;right:0;bottom:0;top:auto;background:linear-gradient(180deg,rgba(8,5,10,0.55),rgba(8,5,10,0.95));display:flex;align-items:flex-end;justify-content:center;z-index:9999;font-family:Inter,system-ui,sans-serif;padding:0.6rem 0.5rem 0.5rem;border-top:1px solid rgba(232,160,32,0.32);pointer-events:auto;max-height:60vh;overflow:hidden';
    const cooldowns = actor.skillCooldowns || {};
    const baseDmg = (actor.dmg && Array.isArray(actor.dmg))
      ? `${actor.dmg[0]}–${actor.dmg[1]}`
      : '?';
    const skillRows = skills.map(s => {
      const merged = mergeSkillForCast ? (mergeSkillForCast(actor, s, partyMember) || s) : s;
      const cd = cooldowns[s.id] || 0;
      const mp = merged.mpCost || 0;
      const insufficient = (actor.mp || 0) < mp;
      const onCd = cd > 0;
      // M411 — every skill scales off weapon midpoint. Show "Heavy/Light/Magic"
      // category label from the equipped weapon (or skill.damageCategory) so
      // the player can tell at a glance what damage type each spell will deal.
      const wcat = (actor?.weaponCategory || '').toLowerCase();
      const cat = merged.damageCategory
        || (merged.type === 'magic' || merged.type === 'heal' ? 'magic'
          : (wcat === 'magic' || wcat === 'heavy' || wcat === 'light') ? wcat
          : 'heavy');
      const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
      const mult = merged.damageMult || merged.basePower || 0;
      const weaponMid = actor.dmg ? (actor.dmg[0] + actor.dmg[1]) / 2 : 0;
      // M396 — also surface damage when nested under .effect.damageMult (some
      // upgraded skills move damage there) so we don't mislabel them "utility".
      const nestedMult = merged.effect?.damageMult || 0;
      const effectiveMult = mult || nestedMult;
      const dmgLine = effectiveMult
        ? `~${Math.round(weaponMid * effectiveMult)} dmg (${catLabel} ×${formatStat(effectiveMult, 'mult')})`
        : (merged.type === 'heal' ? 'heal'
          : merged.type === 'revive' ? 'revive'
          : merged.type === 'buff' ? 'buff'
          : merged.statusEffects?.length ? 'status'
          : 'utility');
      return `<button type="button" class="mc-skill" data-skill="${s.id}" ${onCd || insufficient ? 'disabled' : ''}
        style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;width:100%;
          background:${onCd || insufficient ? 'rgba(40,28,32,0.6)' : 'rgba(20,16,12,0.85)'};
          border:1px solid ${onCd || insufficient ? '#4a3a2a' : 'rgba(232,160,32,0.45)'};
          color:${onCd || insufficient ? '#7a6858' : '#f0e8d8'};
          padding:0.55rem 0.75rem;border-radius:4px;cursor:${onCd || insufficient ? 'not-allowed' : 'pointer'};
          margin-bottom:0.4rem;text-align:left;min-height:48px">
        <span style="display:flex;flex-direction:column;align-items:flex-start;gap:0.15rem">
          <strong style="font-size:0.85rem;color:${onCd || insufficient ? '#8a7a6a' : '#e8d090'}">${s.name}</strong>
          <span style="font-size:0.65rem;color:#8a7a6a">${dmgLine}</span>
        </span>
        <span style="font-size:0.7rem;color:${onCd ? '#c04030' : '#60a0e0'};white-space:nowrap">
          ${onCd ? `CD ${cd}` : (mp ? `${mp} MP` : '0 MP')}
        </span>
      </button>`;
    }).join('');
    overlay.innerHTML = `
      <div style="background:#1a1018;border:1px solid rgba(232,160,32,0.4);border-radius:6px;padding:0.7rem 0.85rem 0.85rem;max-width:520px;width:100%;color:#f0e8d8;max-height:55vh;overflow-y:auto">
        <h3 style="margin:0 0 0.4rem;font-family:Cinzel,serif;color:#e8a020;font-size:1rem;text-align:center;letter-spacing:0.06em">${actor.name}'s Turn</h3>
        <div style="display:flex;justify-content:center;gap:0.5rem;font-size:0.7rem;color:#8a7a6a;margin-bottom:0.6rem">
          <span>HP ${actor.hp}/${actor.maxHp}</span><span>·</span>
          <span>MP ${actor.mp}/${actor.maxMp}</span><span>·</span>
          <span>Base ${baseDmg}</span>
        </div>
        <button type="button" class="mc-attack" data-action="attack"
          style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;width:100%;
            background:rgba(20,16,12,0.85);border:1px solid #c04030;color:#f0d090;
            padding:0.55rem 0.75rem;border-radius:4px;cursor:pointer;margin-bottom:0.5rem;text-align:left;min-height:48px">
          <span style="display:flex;flex-direction:column;align-items:flex-start;gap:0.15rem">
            <strong style="font-size:0.85rem;color:#f0d090">⚔ Basic Attack</strong>
            <span style="font-size:0.65rem;color:#8a7a6a">${baseDmg} damage · 0 MP</span>
          </span>
          <span style="font-size:0.7rem;color:#60a0e0;white-space:nowrap">free</span>
        </button>
        ${skills.length ? `<div style="font-size:0.65rem;color:#8a7a6a;letter-spacing:0.08em;margin:0.3rem 0;text-transform:uppercase;font-weight:700">Spells</div>` : ''}
        ${skillRows || '<div style="text-align:center;color:#8a7a6a;font-size:0.75rem">No active spells learned.</div>'}
      </div>
    `;
    this.manager.uiOverlay.appendChild(overlay);

    const dispatch = (skillId) => {
      try { this.manager.uiOverlay.removeChild(overlay); } catch (_) {}
      this._manualOpen = false;
      this._speedMult = (prevSpeed && prevSpeed > 0) ? prevSpeed : 1;
      this._syncSpeedHud?.();
      try {
        if (skillId === 'attack') {
          this._basicAttack(actor, enemies, true);
        } else {
          const picked = SKILLS[skillId] || skills.find(s => s.id === skillId);
          if (!picked) { this._basicAttack(actor, enemies, true); return; }
          actor.mp -= (picked.mpCost || 0);
          if (!actor.skillCooldowns) actor.skillCooldowns = {};
          actor.skillCooldowns[picked.id] = picked.cooldown || 2;
          this._executeSkill(actor, picked, enemies, allies, partyMember);
        }
      } catch (e) {
        console.warn('[manualCombat] action dispatch failed', e);
        try { this._basicAttack(actor, enemies, true); } catch (_) {}
      }
      this._updateHud();
    };
    overlay.querySelector('.mc-attack').addEventListener('click', () => dispatch('attack'));
    overlay.querySelectorAll('.mc-skill').forEach(b => {
      if (!b.disabled) b.addEventListener('click', () => dispatch(b.dataset.skill));
    });

    // M297: digit-key shortcuts for manual combat actions.
    // Key 1 = Basic Attack, keys 2-9 = spells in order (skipping disabled ones).
    // Escape also closes and defaults to basic attack.
    const _allActions = [
      overlay.querySelector('.mc-attack'),
      ...overlay.querySelectorAll('.mc-skill:not([disabled])'),
    ].filter(Boolean);
    const _kbHandler = (e) => {
      const digit = parseInt(e.key, 10);
      if (!isNaN(digit) && digit >= 1 && digit <= _allActions.length) {
        e.preventDefault();
        _allActions[digit - 1].click();
        overlay.removeEventListener('keydown', _kbHandler);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dispatch('attack');
        overlay.removeEventListener('keydown', _kbHandler);
      }
    };
    overlay.setAttribute('tabindex', '-1');
    overlay.addEventListener('keydown', _kbHandler);
    // Focus the overlay so keydown fires without needing a mouse click
    requestAnimationFrame(() => overlay.focus());
  }

  // Seam 2: delegated to combat/combatEnemyAI.js — enemy turn AI, spell selection, target choice.
  _enemyAI(actor) { _combatEnemyAI(this, actor); }
  // M303: Execute an enemy spell against current alive heroes.
  _executeEnemySpell(actor, spell, aliveHeroes) { _combatExecuteEnemySpell(this, actor, spell, aliveHeroes); }
  // M303: fizzle visual (stance flash; no log needed)
  _enemySpellFizzle(actor) { _combatEnemySpellFizzle(this, actor); }

  // M84 DAMAGE PIPELINE (canonical for all attacks/spells):
  //   raw → hit roll → if hit: block (shields only) → mitigation (phys/magic/true) → HP
  //   "deflected" / "resisted" / "blocked [X]" log tags surface here.
  _basicAttack(actor, targets, isHero, keepOrder = false) {
    // M396 — attribute on-hit DoTs (Poison Blade, burn, etc.) applied
    // during this attack to the attacker.
    this._currentActor = actor;
    if (!keepOrder) {
      // M398 — auto-skip sleeping targets if any awake target exists.
      // A single hit instantly wakes them and wastes the crowd-control,
      // so the AI deliberately steers around the asleep set. When every
      // remaining target is asleep the original list is used unchanged
      // so the fight still resolves.
      const isAsleep = (t) => (t?.statuses || []).some(s => s.type === 'sleep');
      const awake = targets.filter(t => !isAsleep(t));
      const pool = awake.length ? awake : targets;
      targets = [...pool].sort((a, b) => a.hp - b.hp);
    }
    const target = targets[0];
    if (!target) return;
    let hitChance = rollToHit(actor, target);
    // Blind status halves hit chance
    if (actor.statuses && actor.statuses.some(s => s.type === 'blind')) hitChance = Math.max(5, Math.round(hitChance * 0.5));
    // M341 — Dazed (replaces AoE stuns): -25 percentage points hit chance.
    if (actor.statuses && actor.statuses.some(s => s.type === 'dazed')) hitChance = Math.max(5, Math.round(hitChance - 25));
    const hitRoll = Math.random() * 100;
    // M377 — log hit check.
    combatDebug.push('hit_check', {
      actor: actor.name, target: target.name,
      hitChance: Math.round(hitChance), roll: Math.round(hitRoll),
      hit: hitRoll < hitChance,
      attackerHit: actor.hit, targetDodge: target.dodge,
    });
    if (hitRoll >= hitChance) {
      // M242: attach breakdown so the log tooltip can show attacker hit%,
      // target dodge%, and the rolled %.
      const bd = {
        miss: true,
        hit: actor.hit,
        dodge: target.dodge,
        hitChance: Math.round(hitChance),
        roll: Math.round(hitRoll),
        attacker: actor.name,
        target: target.name,
      };
      this._log_(`${actor.name} misses ${target.name}.`, 'miss', bd);
      // M267 meter: track dodges on hero defenders (enemy→hero misses).
      if (this._allies?.includes(target)) {
        this._meterAddDodge(target, { source: actor.name });
      }
      actor.stance = 'attack';
      this._setTimeout(() => { actor.stance = 'ready'; }, 300);
      return;
    }
    let raw = actor.dmg[0] + Math.floor(Math.random() * (actor.dmg[1] - actor.dmg[0] + 1));

    // M302: Curse — reduce actor outgoing damage by curse power% (stacks take max power).
    if (actor.statuses && !actor.isHero) {
      const curses = actor.statuses.filter(s => s.type === 'curse');
      if (curses.length > 0) {
        const maxPow = curses.reduce((m, s) => Math.max(m, s.power || 10), 0);
        raw = Math.max(1, Math.round(raw * (1 - maxPow / 100)));
      }
    }

    // M303: aura_damage champion modifier — boosts all living enemy damage by 20%
    // when a champion with this modifier is alive on the same side.
    if (!isHero && this._allEnemies.some(e => e.alive && e.isChampion && (e.championMods || []).includes('aura_damage') && e !== actor)) {
      raw = Math.round(raw * 1.2);
    }

    // Crit — M116: now driven by critChance + critDamage affixes + base 5%.
    // Passive `critBonus` (flat % from talents) still adds to chance. Crit
    // multiplier = 1.5 + critDamage affix (enemies default to 1.5×).
    const baseCrit = 5;
    // M406 — shrine crit_boost doubles effective crit chance for active combats.
    const shrineCritMult = actor._shrineCritMult || 1;
    const totalCrit = Math.min(75, (baseCrit + getCritBonusTotal(actor) + ((actor.critChance || 0) * 100)) * shrineCritMult);
    const critMult = 1.5 + (actor.critDamage || 0);
    let isCrit = false;
    const _critRoll = Math.random() * 100;
    if (_critRoll < totalCrit) {
      raw = Math.round(raw * critMult);
      isCrit = true;
    }
    // M377 — log crit check + base damage formula for the basic attack.
    combatDebug.push('crit_check', {
      actor: actor.name, target: target.name,
      baseCrit, totalCrit: Math.round(totalCrit), critMult,
      roll: Math.round(_critRoll), isCrit,
    });
    combatDebug.push('damage_calc', {
      actor: actor.name, target: target.name,
      source: 'Attack',
      base: raw,
      weaponRange: actor.dmg,
      crit: isCrit, critMult,
      formula: 'rand(dmg[0]..dmg[1]) [* crit] then mitigation pipeline',
    });

    const { dmg, tag, breakdown, blocked: hitBlocked } = this._resolveIncomingDamage(raw, target, { type: 'physical' });
    if (breakdown) { breakdown.skillName = 'Attack'; breakdown.crit = isCrit; }
    const color = isCrit ? '#ffe080' : (isHero ? '#ff8060' : '#e8a020');
    // Enemy block: spawn floating "Block!" caption over the blocking enemy
    if (hitBlocked && !target.isHero) {
      this._spawnDmgNumber(target.x, target.y - 48, 'Block!', '#a0b8ff');
    }
    const hpBefore = target.hp;
    this._applyDamage(actor, target, dmg, color, breakdown);
    const dealt = Math.max(0, hpBefore - target.hp);
    if (breakdown) breakdown.dealt = dealt;
    // M94: Poison Blade etc — buff on caster imprints a status on each hit target.
    if (actor.onHitStatus && target.alive) {
      const oh = actor.onHitStatus;
      this._applyStatus(target, oh.type, oh.duration || 3, oh.power || 6);
    }
    // M176: passive-driven procs on a successful hit.
    if (target.alive && dealt > 0) {
      const intv = actor._srcMember?.attrs?.INT || 8;
      if ((actor.passiveBurnOnHit || 0) > 0 && Math.random() < actor.passiveBurnOnHit) {
        this._applyStatus(target, 'burn', 3, Math.max(3, Math.floor(intv * 0.15)));
      }
      if (isCrit && (actor.passivePoisonOnCrit || 0) > 0 && Math.random() < actor.passivePoisonOnCrit) {
        this._applyStatus(target, 'poison', 3, Math.max(3, Math.floor(intv * 0.20)));
      }
      if ((actor.passiveChainOnHit || 0) > 0 && Math.random() < actor.passiveChainOnHit) {
        const pool = (isHero ? this._enemies : [...this._heroes, ...this._companions]).filter(e => e && e.alive && e !== target);
        if (pool.length) {
          const chainTarget = pool[Math.floor(Math.random() * pool.length)];
          const chainRaw = Math.max(1, Math.round(dmg * 0.5));
          const { dmg: chainDmg } = this._resolveIncomingDamage(chainRaw, chainTarget, { type: 'magic' });
          this._applyDamage(actor, chainTarget, chainDmg, '#80c0ff');
          this._spawnDmgNumber(chainTarget.x, chainTarget.y - 55, `⚡ ${chainDmg}`, '#80c0ff');
        }
      }
    }
    if (isCrit) {
      this._spawnDmgNumber(target.x, target.y - 68, 'CRIT!', '#ffe080');
      this._shakeTimer = 0.35;
      if (breakdown) breakdown.crit = true;
    }
    const suffix = tag ? ` ${tag}` : '';
    const lsTag = breakdown?.lifeSteal > 0 ? ` (+${breakdown.lifeSteal} life)` : '';
    this._log_(`${actor.name} → ${target.name}: ${dealt} dmg${isCrit ? ' CRIT' : ''}${suffix}${lsTag}`, isHero ? 'hero' : 'enemy', breakdown);

    // M305: legendary onHit / onCrit hooks for heroes.
    if (isHero && dealt > 0) {
      this._dispatchLegendaryHook('onHit', actor, { target, rawDmg: raw, dealt, isCrit });
      if (isCrit) this._dispatchLegendaryHook('onCrit', actor, { target, rawDmg: raw, dealt });
    }

    // M303: Champion modifier hooks
    const champHookCtx = {
      log: (msg, t) => this._log_(msg, t || 'normal'),
      spawnDmgNumber: (x, y, v, c) => this._spawnDmgNumber(x, y, v, c),
      allies: this._allies,
      allEnemies: this._allEnemies,
    };
    // onHit — actor is a champion that just hit target
    if (!isHero && actor.isChampion && actor.championMods && dealt > 0) {
      for (const modId of actor.championMods) {
        const mod = CHAMPION_MODIFIERS[modId];
        if (mod?.onHit) {
          try { mod.onHit(actor, target, dealt, champHookCtx); } catch (_) {}
        }
      }
    }
    // onHitByAttacker — target is a champion being hit by actor
    if (!target.isHero && target.isChampion && target.championMods && dealt > 0 && actor) {
      for (const modId of target.championMods) {
        const mod = CHAMPION_MODIFIERS[modId];
        if (mod?.onHitByAttacker) {
          try { mod.onHitByAttacker(target, actor, dealt, champHookCtx); } catch (_) {}
        }
      }
    }
    // M303: wind-up damage tracking — if target boss is winding up, count damage dealt
    if (target._windUp && dealt > 0) {
      target._windUp.dmgTaken = (target._windUp.dmgTaken || 0) + dealt;
    }

    actor.stance = 'attack';
    this._setTimeout(() => { actor.stance = 'ready'; }, 300);
    this._updateHud();
  }

  // M84/M274: canonical mitigation pipeline. Pure data layer is in
  // src/ui/screens/_damagePipeline.js — this wrapper supplies the meter
  // sink + the post-block stance-revert timer.
  _resolveIncomingDamage(raw, target, opts = {}) {
    const meterTrackTarget = !!this._allies?.includes(target);
    const meter = meterTrackTarget ? { addMit: (t, amt, kind, detail) => this._meterAddMit(t, amt, kind, detail) } : null;
    const result = resolveIncomingDamage(raw, target, {
      ...opts,
      meter,
      meterTrackTarget,
      round: this._round,
    });
    // Animation: revert block stance after a beat (was inline; kept here).
    if (result.blocked) {
      this._setTimeout(() => { if (target.alive) target.stance = 'ready'; }, 400);
    }
    return { dmg: result.dmg, tag: result.tag, breakdown: result.breakdown };
  }

  _executeSkill(actor, rawSkill, enemies, allies, partyMember) {
    // M89: merge talents + purchased upgrades into a castable skill so the
    // ~288 globally-orphaned talent/upgrade payloads finally take effect.
    // See src/game/skills.js mergeSkillForCast for merge rules.
    const skill = mergeSkillForCast(rawSkill, partyMember);
    // AUDIT(m89): the following skill types still fall through to the damage
    // branch with no dedicated handler — needs design decisions per type:
    //   zone       — Consecration, Ignite, Void Rift  (DoT/HoT persistent field)
    //   trap       — Smoke Trap                        (placement + trigger)
    //   counter    — Riposte (Swash)                   (reactive on hit)
    //   utility    — Scrounge                          (non-combat loot)
    //   debuff     — Discordant Wail, Death Mark       (target-side status)
    //   passive    — Jackpot                           (passive hook)
    // See public/assets/skill-audit.html for the full list.
    actor.stance = 'spell';
    this._setTimeout(() => { actor.stance = 'ready'; }, 400);
    this.audio.playSfx('spell');
    // M396 — set ambient "current actor" so deeper helpers (_applyStatus
    // call sites that don't thread source through) attribute DoTs and
    // debuffs to the actor casting this skill.
    this._currentActor = actor;
    if (actor.isHero) {
      this._dispatchLegendaryHook('onCast', actor, {
        target: enemies.find(e => e.alive) || null,
        skillId: skill.id,
        dealt: 0,
        enemies: enemies.filter(e => e.alive),
        allies: allies.filter(a => a.alive),
      });
    }

    const s = partyMember?.attrs || { STR:8, DEX:8, INT:8, CON:8 };
    // M116: spellPower nerfed from INT*0.08 → INT*0.025. Previous coefficient
    // made a 40 INT mage one-shot Primordial packs (Fireball ×4 = 472 dmg).
    // New: 40 INT → +100% (×2 final), 20 INT → +50%. Must stay in sync with
    // InventoryScreen.js, CharacterBuilderScreen.js preview, simulator.js, and
    // FormulaCodexScreen.js — all reference the same coefficient.
    const spellPower = +(((s.INT || 8) * 0.025).toFixed(2));
    const attackPower = Math.round((s.STR || 8) * 1.5);

    // Healing skills
    if (skill.type === 'heal') {
      const target = [...allies].sort((a, b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
      if (!target) return;
      // M347 — Bail out (and let the actor act normally next turn) when
      // the chosen target is essentially full HP. The user reported
      // round after round of "+16 (8 overheal)" because a cleric soloing
      // a fight kept self-healing at 80%+ HP. New rule: skip the heal
      // when the lowest-HP ally is at >= 85% HP. Only applies to AI
      // turns; manual casts still go through.
      // M409-followup: previous gate `!actor.isHero || autoBuild.auto_active`
      // missed regular hero AI (Isla the priest at full HP cast Mend
      // every round for 35 overheal). New gate: any non-manual cast.
      try {
        const _gsManual = !!(GameState.get?.()?.manualCombat);
        const _isAICast = !actor.isHero || !_gsManual;
        if (_isAICast) {
          const ratio = (target.hp || 0) / (target.maxHp || 1);
          if (ratio >= 0.85) {
            // Refund mana (we never spent it) and fall through to a basic
            // attack so the round isn't wasted.
            this._log_(`${actor.name} skips ${skill.name} — ${target.name} is nearly full HP.`, 'hero');
            try { this._basicAttack(actor, this._enemies || [], true); } catch (_) {}
            return;
          }
        }
      } catch (_) {}
      const eff = skill.effect || {};
      // M94: honor healStat (default now 'damage') so Lay on Hands, Rejuvenation, Rewind, Heal all route through _getSkillStat.
      // M411: 'damage' is a virtual key — heals scale off the caster's
      // weapon damage midpoint instead of INT. Matches the damage-skill
      // formula at line ~4220 so healers benefit from upgrading their
      // weapon the same way casters do for offensive spells.
      const healStatKey = (skill.healStat || eff.healStat || 'damage');
      let healStatVal;
      if (String(healStatKey).toLowerCase() === 'damage') {
        const lo = (actor.dmg && actor.dmg[0]) || 1;
        const hi = (actor.dmg && actor.dmg[1]) || lo + 1;
        healStatVal = (lo + hi) / 2;
      } else {
        healStatVal = this._getSkillStat(healStatKey, s, actor);
      }
      const healMult = skill.healMult || 1.5;
      const scaledHeal = Math.round(healMult * healStatVal * (1 + spellPower));
      // M94: Second Wind-style flat floor — healAmount is a guaranteed minimum.
      const flatFloor = skill.healAmount || eff.healAmount || 0;
      const healAmt = Math.max(flatFloor, scaledHeal);
      const actualHeal = Math.min(healAmt, target.maxHp - target.hp);
      target.hp = Math.min(target.maxHp, target.hp + healAmt);
      if (actor && this._allies?.includes(actor)) this._meterAddHeal(actor, actualHeal, skill.name, { target: target.name, skill: skill.name, overheal: Math.max(0, healAmt - actualHeal) });
      this._spawnDmgNumber(target.x, target.y - 50, `+${healAmt}`, '#60e880');
      // M94: cleanse — remove statuses matching the cleanse array.
      if (Array.isArray(eff.cleanse) && target.statuses) {
        target.statuses = target.statuses.filter(st => !eff.cleanse.includes(st.type));
      }
      // M94: hpRegen side-effect for heals (e.g. Rejuvenation).
      if (eff.hpRegen) {
        target.statuses = target.statuses || [];
        target.statuses.push({ type: 'regen', duration: eff.regenRounds || 3, power: eff.hpRegen });
      }
      this._log_(`${actor.name} uses ${skill.name}: heals ${target.name} for ${healAmt}`, 'hero');
      return;
    }

    // Buff skills (M65: fixed — barrier/shield/dodge/dmgBuff/dmgReduct now all apply for any target)
    if (skill.type === 'buff') {
      this._log_(`${actor.name} uses ${skill.name}!`, 'hero');
      const eff = skill.effect || {};
      const dur = eff.duration || 2;
      let buffTargets = [];
      if (skill.target === 'party') buffTargets = allies.filter(a => a.alive);
      else if (skill.target === 'self') buffTargets = [actor];
      else if (skill.target === 'ally') {
        // M95: honor excludeSelf — Haste and similar buffs can't target the caster.
        let pool = [...allies].filter(a => a.alive);
        if (eff.excludeSelf) pool = pool.filter(a => a.id !== actor.id);
        const wounded = pool.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
        buffTargets = wounded.slice(0, eff.targets || 1);
      } else if (skill.target === 'enemy') {
        // M94: Taunt — apply debuff to a single enemy.
        buffTargets = enemies[0] ? [enemies[0]] : [];
      } else buffTargets = [actor];
      // M94: Soul Pact — caster pays % max HP at cast time.
      if (eff.selfDamagePct) {
        const cost = Math.max(1, Math.round((actor.maxHp || 1) * eff.selfDamagePct));
        actor.hp = Math.max(1, actor.hp - cost);
        this._spawnDmgNumber(actor.x, actor.y - 30, `-${cost}`, '#a020a0');
      }
      for (const t of buffTargets) {
        if (eff.dmgBuff)   { addDmgBuff(t, eff.dmgBuff, dur); }
        if (eff.dmgReduct) { t.dmgReduct = eff.dmgReduct; t.dmgReductRounds = dur; }
        if (eff.dodgeBuff) { t.dodgeBuff = (t.dodgeBuff || 0) + eff.dodgeBuff; t.dodgeBuffRounds = dur; t.dodge = (t.dodge || 0) + eff.dodgeBuff; }
        if (eff.barrier) {
          // M411 — barrier values < 10 are weapon-damage multipliers (e.g.
          // chaos_ward 2.0 = 2× weapon midpoint); larger values are flat HP
          // (e.g. foresight 40 = 40 HP barrier). Keeps backwards-compat with
          // existing flat-HP buffs while enabling weapon-driven scaling.
          let power = eff.barrier;
          if (eff.barrier < 10) {
            const lo = (actor.dmg && actor.dmg[0]) || 1;
            const hi = (actor.dmg && actor.dmg[1]) || lo + 1;
            power = Math.round(((lo + hi) / 2) * eff.barrier);
          }
          t.statuses = t.statuses || [];
          t.statuses.push({ type: 'barrier', duration: dur, power });
          this._spawnDmgNumber(t.x, t.y - 50, `+${power} shield`, '#80c0ff');
        }
        if (eff.shield) {
          // M411 — shields scale off weapon damage midpoint (parity with the
          // damage/heal rewire). conMult retained as the multiplier knob;
          // explicit eff.shield.flat=true falls back to legacy CON scaling.
          const mult = eff.shield.conMult || 3;
          const sdur = eff.shield.duration || dur;
          let power;
          if (eff.shield.flat) {
            power = Math.round(((partyMember?.attrs?.CON) || 8) * mult);
          } else {
            const lo = (actor.dmg && actor.dmg[0]) || 1;
            const hi = (actor.dmg && actor.dmg[1]) || lo + 1;
            power = Math.round(((lo + hi) / 2) * mult);
          }
          t.statuses = t.statuses || [];
          t.statuses.push({ type: 'barrier', duration: sdur, power });
          this._spawnDmgNumber(t.x, t.y - 50, `+${power} shield`, '#80c0ff');
        }
        if (eff.reflect)   { t.reflect = eff.reflect; t.reflectRounds = dur; }
        if (eff.extraAction) {
          t.extraAction = (t.extraAction || 0) + (eff.extraAction === true ? 1 : eff.extraAction);
          // M95: extraActionDuration — talent (e.g. Haste: Sustained Tempo) makes
          // the extra action recur for N rounds. We stash the remaining rounds and
          // the per-round refill on the combatant; _processStatusEffects ticks and
          // re-grants at round start.
          if (eff.extraActionDuration && eff.extraActionDuration > 1) {
            const rounds = eff.extraActionDuration - 1; // current round already applied
            const perRound = (eff.extraAction === true ? 1 : eff.extraAction);
            t.extraActionRounds = Math.max(t.extraActionRounds || 0, rounds);
            t.extraActionPerRound = perRound;
          }
        }
        if (eff.regen) { t.statuses = t.statuses||[]; t.statuses.push({ type: 'regen', duration: dur, power: eff.regen }); }
        // M94: new buff keys
        if (eff.hpRegen) { t.statuses = t.statuses||[]; t.statuses.push({ type: 'regen', duration: eff.rounds || dur, power: eff.hpRegen }); }
        if (eff.critBonus) { addCritBonusStatus(t, eff.critBonus * 100, eff.rounds || dur); }
        if (eff.hitBonus)  { t.hit = (t.hit || 0) + eff.hitBonus; t.hitBuffRounds = eff.rounds || dur; t._hitBuffAmt = (t._hitBuffAmt || 0) + eff.hitBonus; }
        if (eff.armorBonus) { t.armor = (t.armor || 0) + eff.armorBonus; t.armorBuffRounds = eff.rounds || dur; t._armorBuffAmt = (t._armorBuffAmt || 0) + eff.armorBonus; }
        if (eff.magicResistBonus) { t.magicResist = (t.magicResist || 0) + eff.magicResistBonus; t.mrBuffRounds = eff.rounds || dur; t._mrBuffAmt = (t._mrBuffAmt || 0) + eff.magicResistBonus; }
        if (eff.tauntedBy) { t.tauntedBy = (eff.tauntedBy === 'caster') ? actor.id : eff.tauntedBy; t.tauntedRounds = eff.rounds || dur; }
        if (eff.onHitStatus) { t.onHitStatus = { ...eff.onHitStatus }; t.onHitStatusRounds = eff.rounds || dur; }
        if (eff.barrier && !eff.shield) {
          // already handled above; no-op (kept for clarity)
        }
      }
      // M89: enemySkipRound — Time Stop etc. Any enemy still alive loses next turn.
      if (eff.enemySkipRound || eff.enemySkipRounds) {
        const rounds = eff.enemySkipRounds || 1;
        for (const e of this._allEnemies) {
          if (e.alive) { e.skipNextTurn = true; e.skipRoundsRemaining = Math.max(e.skipRoundsRemaining || 0, rounds); }
        }
        this._log_('Time stops for the enemy!', 'round');
      }
      return;
    }

    // M84: Resurrect — single target, 12-round cooldown, 25% HP, damage
    // immunity until the revived character's next action.
    if (skill.type === 'revive') {
      const eff = skill.effect || {};
      const hpPct = eff.reviveHp || 0.25;
      const fallen = this._allies.filter(a => !a.alive);
      if (!fallen.length) { this._log_(`${skill.name}: no fallen allies`, 'miss'); return; }
      const targets = eff.reviveAll ? fallen : fallen.slice(0, 1);
      for (const t of targets) {
        t.alive = true;
        t.hp = Math.max(1, Math.floor(t.maxHp * hpPct));
        t.stance = 'ready';
        if (eff.immune !== false) t.reviveImmune = true;
        if (eff.immuneRound) t.reviveImmuneRounds = 1;
        // M94: res_shield talent — explicit rounds of full immunity.
        if (eff.reviveImmuneRounds) t.reviveImmuneRounds = Math.max(t.reviveImmuneRounds || 0, eff.reviveImmuneRounds);
        this._spawnDmgNumber(t.x, t.y - 50, 'REVIVED', '#ffe080');
        this._log_(`${actor.name} revives ${t.name}!`, 'heal');
      }
      // M131: Resurrect 12-round per-skill cooldown (reset between fights via
      // combatant re-init). Uses the per-skill map so other skills aren't gated.
      if (!actor.skillCooldowns) actor.skillCooldowns = {};
      actor.skillCooldowns[skill.id] = Math.max(actor.skillCooldowns[skill.id] || 0, skill.cooldown || 12);
      return;
    }

    // M95: Non-damage type routers — zone, trap, counter, utility, debuff, passive.
    // Previously these fell through to the damage branch and produced weird logs.
    if (skill.type === 'passive') {
      // Passives should not be cast at runtime — log and return.
      this._log_(`${skill.name} is passive — always active.`, 'round');
      return;
    }
    if (skill.type === 'utility') {
      // Scrounge / similar non-combat loot — surface a log line; real loot hooks
      // live outside combat (inventory.js). We read eff.findChance / eff.goldBonus
      // so merged talents/upgrades still tune the feel even if pure cosmetic.
      const eff = skill.effect || {};
      const chance = eff.findChance || 0.6;
      if (Math.random() < chance) {
        this._log_(`${actor.name} scrounges up a useful scrap!`, 'hero');
      } else {
        this._log_(`${actor.name} finds nothing of use.`, 'miss');
      }
      return;
    }
    if (skill.type === 'counter') {
      // Riposte — enter parry stance. Consumed by _applyDamage on incoming
      // melee hits (reflect path covers the damage return).
      const eff = skill.effect || {};
      const parryCount = 1 + (eff.parryCount || 0);
      actor.parryStance = parryCount;
      actor.parryMult = skill.damageMult || 2.0;
      actor.reflect = Math.max(actor.reflect || 0, skill.damageMult || 2.0);
      actor.reflectRounds = Math.max(actor.reflectRounds || 0, 1);
      // Imprint an onHitStatus so the disarm/stun talent lands on attackers.
      if (Array.isArray(eff.statusEffects) && eff.statusEffects.length) {
        actor.onHitStatus = { ...eff.statusEffects[0] };
        actor.onHitStatusRounds = 1;
      }
      this._log_(`${actor.name} enters a parry stance!`, 'hero');
      return;
    }
    if (skill.type === 'trap') {
      // Smoke Trap — apply blind (and merged statuses) to primary enemy group.
      const eff = skill.effect || {};
      const gi = enemies[0]?.groupIdx;
      const trapTargets = (skill.aoe === 'all' || eff.aoe === 'all')
        ? enemies.slice()
        : enemies.filter(e => e.groupIdx === gi);
      for (const t of trapTargets) {
        for (const se of (skill.statusEffects || [])) {
          if (Math.random() < (se.chance || 1.0)) this._applyStatus(t, se.type, se.duration || 2, se.power || 3);
        }
        // Talent-merged slow (e.g. Choking Smoke)
        if (eff.slow) {
          this._applyStatus(t, 'slow', eff.slow.duration || 2, 1);
        }
      }
      this._log_(`${actor.name} sets ${skill.name}!`, 'hero');
      return;
    }
    // M302: Pilfer Magic — steal positive statuses from target enemy.
    if (skill.type === 'debuff' && skill.effect?.pilferBuff) {
      const eff = skill.effect || {};
      const count = eff.pilferCount || 1;
      const bonusDur = eff.pilferBonusDuration || 0;
      const perBuffDmg = eff.pilferDamagePerBuff || 0;
      const target = enemies.find(e => e.alive);
      if (!target) { this._log_(`${skill.name}: no target.`, 'miss'); return; }
      const POSITIVE_STATUSES = new Set(['rally', 'haste', 'barrier', 'block', 'deflect', 'enchant', 'regen', 'dmgBuff', 'critBonus']);
      const stolen = (target.statuses || []).filter(s => POSITIVE_STATUSES.has(s.type));
      const toSteal = stolen.slice(0, count);
      if (toSteal.length === 0) {
        this._log_(`${actor.name} uses ${skill.name}: ${target.name} has no buffs to steal!`, 'miss');
      } else {
        target.statuses = (target.statuses || []).filter(s => !toSteal.includes(s));
        for (const st of toSteal) {
          actor.statuses = actor.statuses || [];
          actor.statuses.push({ ...st, duration: (st.duration || 1) + bonusDur });
          if (perBuffDmg > 0) {
            const { dmg } = this._resolveIncomingDamage(perBuffDmg, target, { type: 'magic' });
            this._applyDamage(actor, target, dmg, '#c0a0ff');
          }
          this._log_(`${actor.name} steals ${st.type} from ${target.name}!`, 'hero');
        }
      }
      // Optional bonus damage from talent
      if (eff.damageStat && eff.damageMult) {
        const dv = this._getSkillStat(eff.damageStat, s, actor);
        const adjDmg2 = Math.round(eff.damageMult * dv * (1 + spellPower));
        const { dmg: bmDmg } = this._resolveIncomingDamage(adjDmg2, target, { type: 'physical' });
        this._applyDamage(actor, target, bmDmg, '#e0c080');
      }
      return;
    }

    // M302: Hemorrhage — consume all bleed stacks for burst damage.
    if (skill.type === 'melee' && skill.effect?.hemorrhage) {
      const eff = skill.effect || {};
      const target = enemies.find(e => e.alive);
      if (!target) { this._log_(`${skill.name}: no target.`, 'miss'); return; }
      const bleedStacks = (target.statuses || []).filter(s => s.type === 'bleed');
      const stackCount = bleedStacks.length;
      // Remove bleed stacks
      target.statuses = (target.statuses || []).filter(s => s.type !== 'bleed');
      const dmgPerStack = eff.dmgPerBleedStack || 30;
      const burstDmg = stackCount * dmgPerStack;
      if (burstDmg > 0) {
        const { dmg: bd } = this._resolveIncomingDamage(burstDmg, target, { type: 'physical', armorPen: 0.5 });
        this._applyDamage(actor, target, bd, '#e04060');
        this._log_(`${actor.name} uses ${skill.name}: detonates ${stackCount} bleed stacks for ${bd} damage!`, 'hero');
      } else {
        this._log_(`${actor.name} uses ${skill.name}: no bleed stacks to consume.`, 'miss');
      }
      // Base melee hit
      const dv2 = this._getSkillStat(skill.damageStat || 'dex', s, actor);
      const baseDmg = Math.round((skill.damageMult || 0.5) * dv2);
      const { dmg: bd2 } = this._resolveIncomingDamage(baseDmg, target, { type: 'physical' });
      this._applyDamage(actor, target, bd2, '#e0c080');
      // Talent: reapply bleed after detonation
      if (eff.rebleedAfter && target.alive) {
        for (let i = 0; i < eff.rebleedAfter; i++) {
          this._applyDotStacked(target, actor, { type: 'bleed', duration: 2, power: 4, chance: 1.0, stackingMode: 'per_source' });
        }
      }
      return;
    }

    if (skill.type === 'debuff') {
      // M302: Soul Curse — apply curse with spread-on-death
      if (skill.effect?.applyCurse) {
        const eff = skill.effect || {};
        const target = enemies.find(e => e.alive);
        if (!target) { this._log_(`${skill.name}: no target.`, 'miss'); return; }
        const dur = eff.curseDuration || 4;
        const pw = eff.cursePower || 10;
        this._applyDotStacked(target, actor, { type: 'curse', duration: dur, power: pw, chance: 1.0, stackingMode: 'global' });
        for (const se of (skill.statusEffects || [])) {
          if (se.type !== 'curse' && Math.random() < (se.chance || 1.0)) this._applyStatus(target, se.type, se.duration || dur, se.power || 3);
        }
        this._log_(`${actor.name} lays a Soul Curse on ${target.name}!`, 'hero');
        return;
      }
      // Discordant Wail etc — reduce damage / apply skipTurnChance to a group.
      const eff = skill.effect || {};
      const dur = eff.duration || 3;
      const gi = enemies[0]?.groupIdx;
      const dbTargets = (skill.aoe === 'all' || eff.aoe === 'all')
        ? enemies.slice()
        : (skill.aoe === 'group2' || eff.aoe === 'group2')
          ? enemies.filter(e => e.groupIdx === gi || e.groupIdx === gi + 1)
          : enemies.filter(e => e.groupIdx === gi);
      for (const t of dbTargets) {
        const amt = eff.dmgDebuff || 0.3;
        addDmgBuff(t, -amt, dur);
        if (eff.skipTurnChance && Math.random() < eff.skipTurnChance) {
          t.skipNextTurn = true;
        }
        for (const se of (skill.statusEffects || [])) {
          if (Math.random() < (se.chance || 1.0)) this._applyStatus(t, se.type, se.duration || dur, se.power || 3);
        }
      }
      this._log_(`${actor.name} uses ${skill.name}: ${dbTargets.length} enemies weakened`, 'hero');
      return;
    }
    if (skill.type === 'zone') {
      // Consecration / Ignite / Void Rift — persistent field. Model as an
      // immediate hit + DoT burn/poison on the affected tile's enemies for
      // the skill's duration. Consecration also heals allies each tick.
      const eff = skill.effect || {};
      const dur = skill.duration || eff.duration || 3;
      const isHeal = skill.healMult || skill.class === 'cleric' || skill.class === 'paladin';
      const stat = this._getSkillStat(skill.damageStat || 'damage', s, actor);
      const base = Math.round((skill.damageMult || 0.6) * stat * (1 + spellPower));
      const gi = enemies[0]?.groupIdx;
      const zoneTargets = (skill.aoe === 'all') ? enemies.slice()
        : (skill.aoe === 'group2') ? enemies.filter(e => e.groupIdx === gi || e.groupIdx === gi + 1)
        : enemies.filter(e => e.groupIdx === gi);
      for (const t of zoneTargets) {
        if (base > 0) {
          const { dmg } = this._resolveIncomingDamage(base, t, { type: 'magic' });
          this._applyDamage(actor, t, dmg, '#c060ff');
        }
        // Stacking DoT — use statusEffects if provided, else default burn.
        const ses = skill.statusEffects || [{ type: 'burn', duration: dur, power: Math.max(2, Math.round(base * 0.3)), chance: 1.0 }];
        for (const se of ses) {
          if (Math.random() < (se.chance || 1.0)) {
            this._applyStatus(t, se.type, se.duration || dur, se.power || Math.max(2, Math.round(base * 0.3)));
          }
        }
        if (eff.stunChance && Math.random() < eff.stunChance) {
          this._applyStatus(t, 'stun', 1, 1);
        }
        // Zone slow (e.g. Consecration Sacred Ground talent)
        if (eff.slow || skill.slow) {
          const sl = eff.slow || skill.slow;
          this._applyStatus(t, 'slow', sl.duration || dur, 1);
        }
      }
      // Consecration — heal/regen allies while zone is active.
      if (isHeal) {
        for (const a of allies.filter(a => a.alive)) {
          a.statuses = a.statuses || [];
          a.statuses.push({ type: 'regen', duration: dur, power: Math.max(3, Math.round(stat * 0.5)) });
        }
      }
      this._log_(`${actor.name} conjures ${skill.name}!`, 'hero');
      return;
    }

    // M94: Corpse target — Corpse Explosion. Find a dead enemy, deal adjacent AoE
    // scaled by the corpse's max HP. Mark the corpse detonated so it can't be re-used.
    if (skill.target === 'corpse') {
      const corpse = (this._allEnemies || []).find(e => !e.alive && !e._detonated);
      if (!corpse) {
        this._log_(`${skill.name}: no corpse to detonate.`, 'miss');
        // refund MP
        if (skill.mpCost && actor.mp !== undefined) actor.mp = Math.min(actor.maxMp || 9999, actor.mp + skill.mpCost);
        return;
      }
      corpse._detonated = true;
      const eff0 = skill.effect || {};
      const intVal = this._getSkillStat(skill.damageStat || 'damage', s, actor);
      const base = Math.round((skill.damageMult || 1.6) * intVal + (eff0.corpseHpScale || 0.5) * (corpse.maxHp || 0));
      const gi = corpse.groupIdx;
      const targets = (skill.aoe === 'group')
        ? this._allEnemies.filter(e => e.alive && e.groupIdx === gi)
        : this._allEnemies.filter(e => e.alive && e.groupIdx === gi).slice(0, 2);
      for (const t of targets) {
        const { dmg } = this._resolveIncomingDamage(base, t, { type: 'magic' });
        this._applyDamage(actor, t, dmg, '#80ff80');
      }
      this._log_(`${actor.name} detonates ${corpse.name}: ${base} dmg to ${targets.length} foes`, 'hero');
      return;
    }

    // Damage skills
    // M399 — resolve hybrid damageStat (str_int, str_dex, dex_int) against
    // the equipped weapon BEFORE reading statVal so Holy Strike with a
    // heavy mace lands on STR only, with a wand on INT only, etc.
    const _hybrid = this._resolveHybridStat(skill.damageStat, actor);
    const _resolvedDamageStat = _hybrid.hybrid ? _hybrid.stat : (skill.damageStat || '');
    let statVal = this._getSkillStat(_resolvedDamageStat || skill.damageStat, s, actor);
    // Weapon Scaling is always on — skill damage drives off the weapon's
    // average damage roll. INT spells still benefit from the additive
    // spellPower bonus (handled below via powerBonus), but the multiplicative
    // stat * damageMult term uses weapon midpoint instead of INT/STR/DEX so
    // spells no longer outpace basic attacks.
    {
      const lo = (actor.dmg && actor.dmg[0]) || 1;
      const hi = (actor.dmg && actor.dmg[1]) || lo + 1;
      statVal = (lo + hi) / 2;
    }
    // M380 — global hero-skill damage scalar. Pulls AoE finishers closer to
    // basic-attack damage so an Act 3+ enemy wave can't be cleared in one cast.
    // M399 — layered per-category multiplier (heavy / light / magic) on top
    // of heroDamageMult. Magic skills land at ~55% of legacy out of the box
    // so spells stop reading 4× a basic attack.
    const _balSkill = getBalance().combat?.skill || {};
    const _heroSkillMult = _balSkill.heroDamageMult ?? 1.0;
    const _category = (() => {
      if (skill.damageCategory) return skill.damageCategory;
      // M411 — weapon category is the source of truth. Heavy/Light/Magic flow
      // from the equipped weapon so a wizard with a sword does Heavy damage,
      // a fighter with a wand does Magic damage. Skills explicitly tagged
      // with damageCategory still win (legendary set bonuses, etc.).
      // skill.type === 'magic' or 'heal' floors at 'magic' so heal/spell
      // skills always benefit from spellPower; otherwise weapon decides.
      const wcat = (actor?.weaponCategory || '').toLowerCase();
      if (skill.type === 'magic' || skill.type === 'heal') return 'magic';
      if (wcat === 'magic' || wcat === 'heavy' || wcat === 'light') return wcat;
      return 'heavy';
    })();
    const _categoryMult = _category === 'magic' ? (_balSkill.magicMult ?? 0.70)
                        : _category === 'heavy' ? (_balSkill.heavyMult ?? 1.00)
                        : (_balSkill.lightMult ?? 1.00);
    let mult = (skill.damageMult || 1.0) * _heroSkillMult * _categoryMult;
    // M95: Grandeur consumes Flair stacks for a damage multiplier.
    if (skill.id === 'grandeur' || skill.name === 'Grandeur' || (skill.effect && skill.effect.consumesFlairStacks) || skill.consumesFlairStacks) {
      const stacks = actor.flairStacks || 0;
      const perStackMult = (skill.effect && skill.effect.stackDmgMult) || 1.0;
      if (stacks > 0) mult = mult * (1 + stacks * perStackMult);
      const keep = (skill.effect && skill.effect.keepStacks) || 0;
      actor.flairStacks = Math.max(0, keep);
    }
    // M95: Vengeance per-death stack bonus.
    if (skill.id === 'vengeance' || skill.name === 'Vengeance') {
      const perDeath = (skill.effect && skill.effect.stackBonusPerDeath) || skill.stackBonusPerDeath || 0.15;
      const deaths = this._allyDeathCount || 0;
      if (deaths > 0 && perDeath > 0) mult = mult * (1 + deaths * perDeath);
    }
    // M256 damage-formula alignment. Previously combat used
    //   (weapon_dmg × mult + stat × 0.2) × (1 + spellPower)
    // while the Skills-panel preview used
    //   mult × stat × (1 + spellPower)
    // The weapon-inflation made spell damage 2-3× larger than the panel
    // estimate (user reported Static Field: 29 est, 65 actual). Converged
    // on the panel formula + a small weapon "flavor" contribution kept at
    // 10% of weapon roll so physical-scaling skills still feel the weapon
    // they're wielding.
    // M399 — isSpell tracks the resolved scaling, not the raw declaration. A
    // str_int skill with a heavy mace equipped should NOT count as a spell
    // (no spellPower bonus, no zero weaponFlavor) since it's hitting in heavy
    // mode now. Falls back to the legacy raw-stat check when nothing resolved.
    const isSpell = (_category === 'magic')
      || (!_hybrid.hybrid && (skill.damageStat === 'int' || skill.type === 'magic'));
    const affixSP = (actor.affixSpellPower || 0);
    const powerBonus = isSpell ? (spellPower + affixSP) : (attackPower * 0.05);
    // M402 — fresh per-cast damage roll. Previously this was computed once
    // before the AoE/multiHits loop, which meant spells (weaponFlavor=0)
    // produced identical numbers every hit and every cast. The user reported
    // "129 dmg 4 times in a row" with Aimed Shot and "49 dmg 7 times" with
    // Multi-Shot. Rolling inside the loop restores variance and gives each
    // AoE target / multi-hit its own swing. Skills can opt into deterministic
    // max damage with skill.useMaxDamage = true (no current skills use it,
    // future-proof escape hatch).
    const _rollSkillDmg = () => {
      // Fresh weapon roll (used both for weaponFlavor and as variance source
      // when weapon scaling is on).
      const lo = (actor.dmg && actor.dmg[0]) || 1;
      const hi = (actor.dmg && actor.dmg[1]) || lo + 1;
      const baseRaw = skill.useMaxDamage
        ? hi
        : (lo + Math.floor(Math.random() * (hi - lo + 1)));
      // Weapon Scaling always on — use the rolled weapon damage for variance.
      // Each hit rolls independently within the weapon's damage range so
      // multi-hit skills and AoE finishers produce varied numbers.
      let _statVal;
      if (skill.useMaxDamage) {
        _statVal = statVal;
      } else {
        _statVal = baseRaw;
      }
      const weaponFlavor = isSpell ? 0 : Math.round(baseRaw * 0.1);
      return Math.round(_statVal * mult * (1 + powerBonus)) + weaponFlavor;
    };

    // M89: AoE target selection.
    // Vocabulary supported:
    //   single            → primary target
    //   adjacent          → primary group, up to 2
    //   adjacent2 / group2→ primary group, up to 4 (double width)
    //   group             → primary group (all)
    //   row / all         → every enemy
    //   row2              → all enemies (wider row, same as 'all' for now)
    //   chain / chain3    → primary + next N-1 nearest enemies (N=3)
    //   random3 / random4 → N random enemies (independent picks)
    //   multi3 / multi4   → N independent damage rolls on primary (same target)
    //   pierce_row        → row, ignores armor (pierces ranks)
    //   single_overflow   → single; if it kills, remaining dmg overflows to adjacent
    // Unknown aoe values fall through to single.
    const eff = skill.effect || {};
    let hitTargets = [];
    let multiHits = 1;
    let overflow = false;
    let pierceRow = false;
    const aoe = skill.aoe;
    const nearestFromPrimary = (n) => {
      const primary = enemies[0];
      if (!primary) return [];
      const rest = enemies.slice(1);
      return [primary, ...rest.slice(0, Math.max(0, n - 1))];
    };
    if (!aoe || aoe === 'single') {
      hitTargets = enemies[0] ? [enemies[0]] : [];
    } else if (aoe === 'adjacent') {
      const gi = enemies[0]?.groupIdx;
      hitTargets = enemies.filter(e => e.groupIdx === gi).slice(0, 2);
    } else if (aoe === 'adjacent2' || aoe === 'group2') {
      const gi = enemies[0]?.groupIdx;
      hitTargets = enemies.filter(e => e.groupIdx === gi).slice(0, 4);
    } else if (aoe === 'group') {
      const gi = enemies[0]?.groupIdx;
      hitTargets = enemies.filter(e => e.groupIdx === gi);
    } else if (aoe === 'row' || aoe === 'all' || aoe === 'row2') {
      hitTargets = enemies.slice();
    } else if (aoe === 'chain' || aoe === 'chain3') {
      const n = eff.chainTargets || (aoe === 'chain3' ? 3 : 3);
      hitTargets = nearestFromPrimary(n);
    } else if (aoe === 'random3' || aoe === 'random4') {
      // M402 — honor eff.targets override (Quiver Mastery → 4, Rapid Volley → 5).
      // Picks N DISTINCT alive enemies; falls back to fewer if not enough alive.
      const baseN = aoe === 'random4' ? 4 : 3;
      const n = Math.max(1, eff.targets || baseN);
      const pool = enemies.filter(e => e && e.alive !== false).slice();
      const picked = [];
      for (let i = 0; i < n && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
      }
      hitTargets = picked;
    } else if (aoe === 'multi3' || aoe === 'multi4') {
      multiHits = aoe === 'multi4' ? 4 : (eff.bolts || 3);
      hitTargets = enemies[0] ? [enemies[0]] : [];
    } else if (aoe === 'pierce_row') {
      hitTargets = enemies.slice();
      pierceRow = true;
    } else if (aoe === 'single_overflow') {
      hitTargets = enemies[0] ? [enemies[0]] : [];
      overflow = true;
    } else {
      hitTargets = enemies[0] ? [enemies[0]] : [];
    }

    // M95: Rain of Arrows — N volleys over the same round on all targets.
    if (skill.id === 'rain_of_arrows' || skill.name === 'Rain of Arrows') {
      const bolts = skill.duration || (skill.effect && skill.effect.bolts) || 3;
      multiHits = bolts;
    }
    // M95: Flourish — strikeCount drives multi-hit on single target.
    if (skill.id === 'flourish' || skill.name === 'Flourish') {
      const strikes = (skill.effect && skill.effect.strikeCount) || skill.strikeCount || 3;
      multiHits = strikes;
      hitTargets = enemies[0] ? [enemies[0]] : [];
    }
    // M95: Breath Weapon element → status effect.
    if ((skill.id === 'breath_weapon' || skill.name === 'Breath Weapon')) {
      const element = (skill.effect && skill.effect.element) || skill.element || 'fire';
      const ELEM_STATUS = { fire:'burn', ice:'chill', lightning:'shock', poison:'poison' };
      const stType = ELEM_STATUS[element] || 'burn';
      const chance = (skill.effect && skill.effect.elementStatusGuaranteed) ? 1.0 : 0.6 * ((skill.effect && skill.effect.elementStatusMult) || 1);
      skill.statusEffects = (skill.statusEffects || []).concat([{ type: stType, chance, duration: 3, power: 4 }]);
    }
    const color = skill.type === 'magic' ? '#c060ff' : '#ff8060';
    const names = [];
    // M84: spell/physical skills route through the canonical pipeline.
    const dmgType = isSpell || skill.type === 'magic' ? 'magic' : 'physical';
    // M89 per-key bonuses from merged skill.effect
    const lifesteal = eff.lifesteal || 0;
    const armorPen = (eff.armorPen || 0) + (pierceRow ? 9999 : 0);
    const bonusVsUndead = eff.bonusVsUndead || 0;
    const bonusVsDemon = eff.bonusVsDemon || 0;
    // M94: Backstab-style: if target has any debuff/dot, multiply damage.
    const conditionBonus = eff.conditionBonus || 0;
    const DEBUFF_TYPES = ['poison','bleed','burn','stun','slow','marked','blind','silence','sunder'];
    // M94: Sunder Armor-style armor reduction after damage.
    const armorReduce = eff.armorReduce || 0;
    const armorReduceDuration = eff.armorReduceDuration || 0;

    // M96: Big Score (scavenger) — wild variance roll on the total damage.
    // M402 — applied per-hit inside the loop now so each strike gets its own
    // wild swing instead of locking variance for the whole cast.
    const _varianceRoll = () => {
      if (!eff.variance) return 1;
      const v = eff.variance;
      const floor = eff.varianceFloor != null ? eff.varianceFloor : Math.max(0, 1 - v);
      const ceiling = eff.varianceCeiling != null ? eff.varianceCeiling : 1 + v;
      return floor + Math.random() * (ceiling - floor);
    };

    // M116: Multi-target damage falloff. 1 target 100%, 2 → 80%, 3 → 60%, 4+ → 50%.
    // Applies to both physical AOE and magical AOE. Keep multiHits (same-target strikes) full.
    const targetCount = hitTargets.length;
    const FALLOFF = targetCount <= 1 ? 1.0 : targetCount === 2 ? 0.8 : targetCount === 3 ? 0.6 : 0.5;
    let totalDealt = 0;
    let firstBreakdown = null; // breakdown from first hit, attached to the summary log line
    for (const target of hitTargets) {
      for (let h = 0; h < multiHits; h++) {
        if (!target || !target.alive) break;
        // M402 — re-roll per hit so each AoE target and each multi-hit gets
        // its own swing. eff.variance scaler folded into the per-hit roll.
        const _perHit = Math.max(1, Math.round(_rollSkillDmg() * _varianceRoll()));
        let adjDmg = Math.round(_perHit * FALLOFF);
        const tags = (target.tags || target.role || '') + ' ' + (target.enemyId || '');
        if (bonusVsUndead && /undead/i.test(tags)) adjDmg = Math.round(adjDmg * (1 + bonusVsUndead));
        if (bonusVsDemon  && /demon/i.test(tags))  adjDmg = Math.round(adjDmg * (1 + bonusVsDemon));
        if (conditionBonus > 0 && target.statuses && target.statuses.some(st => DEBUFF_TYPES.includes(st.type))) {
          adjDmg = Math.round(adjDmg * (1 + conditionBonus));
        }
        // M116: Crit affixes — critChance / critDamage. Base 1.5× on crit, plus
        // the crit_damage affix adds to the multiplier. Enemies get a small
        // baseline (5% / 0). Heroes read from equipment affixes (critBuff from
        // talents already feeds actor.critBonus earlier).
        const critChancePct = Math.min(75, 5 + getCritBonusTotal(actor) + ((actor.critChance || 0) * 100));
        const critMult = 1.5 + (actor.critDamage || 0);
        let isCrit = false;
        if (Math.random() * 100 < critChancePct) {
          adjDmg = Math.round(adjDmg * critMult);
          isCrit = true;
        }

        const { dmg, tag, breakdown } = this._resolveIncomingDamage(adjDmg, target, { type: dmgType, armorPen });
        if (isCrit) {
          this._spawnDmgNumber(target.x, target.y - 68, 'CRIT!', '#ffe080');
          if (breakdown) breakdown.crit = true;
        }
        // M268: attribute meter hits to the skill name. Without this the
        // meter fell back to 'Attack' even for Magic Missile, Fireball, etc.
        if (breakdown) breakdown.skillName = skill.name || breakdown.skillName || 'Skill';
        if (!firstBreakdown) firstBreakdown = breakdown;
        const hpBefore = target.hp;
        this._applyDamage(actor, target, dmg, color, breakdown);
        const dealt = Math.max(0, hpBefore - target.hp);
        totalDealt += dealt;
        // M400 — emit a per-target log line when this skill is hitting more
        // than one target (AoE). The user wants each hit visible instead of
        // a single summary line. Single-target skills still fall through to
        // the summary line below to avoid double-logging.
        if (targetCount > 1 && dealt > 0) {
          const critTag = isCrit ? ' CRIT' : '';
          this._log_(`${actor.name} → ${target.name}: ${dealt} dmg${critTag}`, 'hero', breakdown);
        }

        // M89: single_overflow — if this hit killed, carry remainder to adjacents.
        if (overflow && !target.alive && dealt < dmg) {
          const remainder = dmg - dealt;
          const gi = target.groupIdx;
          const splash = enemies.filter(e => e.alive && e.groupIdx === gi).slice(0, 2);
          for (const st of splash) {
            const r = this._resolveIncomingDamage(remainder, st, { type: dmgType, armorPen });
            this._applyDamage(actor, st, r.dmg, color);
          }
        }
        if (tag) this._log_(`${target.name}: ${tag}`, 'miss');

        // Apply status effects from skill
        // M116: DoT power scales with caster INT when no explicit power is set,
        // so burn/poison/bleed stay meaningful as INT grows. Floor 3 so the
        // tick is always visible; talents (e.g. Scorching burnMult) multiply.
        for (const se of (skill.statusEffects || [])) {
          if (Math.random() < (se.chance || 0.5)) {
            let pw = se.power;
            if (pw == null && (se.type === 'burn' || se.type === 'poison' || se.type === 'bleed')) {
              const intVal = (s.INT || 8);
              pw = Math.max(3, Math.floor(intVal * 0.15));
              if (se.type === 'burn' && eff.burnMult) pw = Math.max(3, Math.round(pw * eff.burnMult));
            }
            this._applyStatus(target, se.type, se.duration || 2, pw != null ? pw : 4);
          }
        }
        // M96: Lucky Strike (scavenger) — random negative status roll.
        if (eff.randomStatus && Array.isArray(eff.randomStatus) && eff.randomStatus.length) {
          const rolls = (Math.random() < (eff.randomStatusRollChance || 0)) ? (eff.randomStatusRolls || 2) : 1;
          const chance = eff.randomStatusChance || 0.5;
          for (let r = 0; r < rolls; r++) {
            if (Math.random() < chance) {
              const pool = eff.randomStatus;
              const pick = pool[Math.floor(Math.random() * pool.length)];
              this._applyStatus(target, pick, eff.randomStatusDuration || 2, 4);
            }
          }
        }
        // M96: Corruption detonation — if target already has corruption DoT,
        // deal all remaining ticks as immediate damage, then refresh. Uses the
        // existing 'poison' status that the normal status loop just (re)applied.
        if (eff.corruptionDetonate && target.alive && target.statuses) {
          const existing = target._corruptionStack;
          if (existing && existing.remaining > 0 && existing.power > 0) {
            const detMult = eff.detonateMult || 1.0;
            const boom = Math.max(1, Math.round(existing.remaining * existing.power * detMult));
            const { dmg: boomDmg } = this._resolveIncomingDamage(boom, target, { type: 'magic' });
            this._applyDamage(actor, target, boomDmg, '#a040ff');
            this._log_(`${target.name}'s Corruption detonates for ${boomDmg}!`, 'hero');
          }
          // Record a stack so a future re-cast can detonate.
          const poison = (target.statuses || []).find(s => s.type === 'poison');
          target._corruptionStack = {
            remaining: (poison && poison.duration) || eff.dotDuration || 4,
            power: (poison && poison.power) || eff.dotPower || 6,
          };
        }
        // M94: Sunder Armor — subtract armor, schedule restore.
        if (armorReduce && target.alive && !target._armorRestore) {
          const before = target.armor || 0;
          const delta = Math.min(before, armorReduce);
          target.armor = Math.max(0, before - delta);
          target._armorRestore = { value: delta, rounds: armorReduceDuration };
        }
      }
      names.push(target.name);
    }

    // M95: Song of Ruin strips enemy buffs on hit.
    if (skill.name === 'Song of Ruin' || skill.id === 'song_of_ruin') {
      for (const t of hitTargets) {
        clearDmgBuff(t);
        t.dmgReduct = 0; t.dmgReductRounds = 0;
        t.reflect = 0; t.reflectRounds = 0;
        if (t.statuses) t.statuses = t.statuses.filter(st => st.type !== 'barrier' && st.type !== 'regen');
      }
    }
    // M95: Feint — move primary target to the back of the current turn order.
    if (skill.name === 'Feint' || skill.id === 'feint') {
      const primary = hitTargets[0];
      if (primary && this._turnOrder) {
        const idx = this._turnOrder.indexOf(primary);
        if (idx > this._turnIdx) {
          this._turnOrder.splice(idx, 1);
          this._turnOrder.push(primary);
        }
      }
    }
    // M95: Fate Weave — also heals weakest ally for damage dealt.
    if (skill.name === 'Fate Weave' || skill.id === 'fate_weave') {
      const weakest = [...allies].filter(a => a.alive).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
      if (weakest && totalDealt > 0) {
        const heal = Math.round(totalDealt * 0.5);
        if (eff.splitHeal) {
          const per = Math.max(1, Math.round(heal / allies.filter(a=>a.alive).length));
          for (const a of allies.filter(a=>a.alive)) a.hp = Math.min(a.maxHp, a.hp + per);
        } else {
          weakest.hp = Math.min(weakest.maxHp, weakest.hp + heal);
          this._spawnDmgNumber(weakest.x, weakest.y - 50, `+${heal}`, '#60e880');
        }
      }
    }
    // M95: actionsLost / enemySkipRound from damage-branch skills (Slow Time).
    if (eff.actionsLost || eff.enemySkipRound) {
      const n = eff.actionsLost || 1;
      for (const t of hitTargets) {
        if (t.alive) { t.skipNextTurn = true; t.skipRoundsRemaining = Math.max(t.skipRoundsRemaining || 0, n); }
      }
    }

    // M95: Flourish — build Flair stacks equal to strike count.
    if (skill.id === 'flourish' || skill.name === 'Flourish') {
      const base = (skill.effect && skill.effect.buildsFlairStacks) || skill.buildsFlairStacks || 3;
      actor.flairStacks = Math.min(20, (actor.flairStacks || 0) + base);
      this._log_(`${actor.name} gains ${base} Flair (${actor.flairStacks})`, 'hero');
    }
    // M89: lifesteal — caster heals fraction of total damage dealt.
    let skillLifeSteal = 0;
    if (lifesteal > 0 && totalDealt > 0) {
      const heal = Math.round(totalDealt * lifesteal);
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + heal);
      const applied = actor.hp - before;
      this._spawnDmgNumber(actor.x, actor.y - 50, `+${heal}`, '#60e880');
      skillLifeSteal = heal;
      // M267 meter: skill-level lifesteal counted as heal.
      if (applied > 0 && this._allies?.includes(actor)) {
        this._meterAddHeal(actor, applied, `Lifesteal (${skill.name})`, { target: actor.name, round: this._round, overheal: heal - applied });
      }
    }

    if (firstBreakdown) {
      firstBreakdown.dealt = totalDealt;
      if (skillLifeSteal > 0) firstBreakdown.lifeSteal = (firstBreakdown.lifeSteal || 0) + skillLifeSteal;
    }
    const lsTag = firstBreakdown?.lifeSteal > 0 ? ` (+${firstBreakdown.lifeSteal} life)` : '';
    // M400 — for AoE we already logged each target above, so emit a brief
    // header line ("Whirlwind ×4: 120 dmg") with the per-target rolls already
    // visible just below. Single-target skills get the original summary line
    // since they only have one outcome to describe.
    // M405-bugfix: AoE header uses type 'hero_aoe_header' so the parity checker
    // (_runCombatParityCheck) does NOT double-count it alongside the per-target
    // 'hero' lines that were already logged above. Single-target summary stays
    // 'hero' because it is the only log entry for that skill use.
    if (hitTargets.length > 1) {
      this._log_(`${actor.name} uses ${skill.name} (×${hitTargets.length}): ${totalDealt} dmg${lsTag}`, 'hero_aoe_header', firstBreakdown);
    } else {
      this._log_(`${actor.name} uses ${skill.name}${multiHits > 1 ? ` (×${multiHits})` : ''}: ${totalDealt} dmg${lsTag}`, 'hero', firstBreakdown);
    }
  }

  _getSkillStat(statKey, attrs, actor) {
    const raw = this._getRawSkillStat(statKey, attrs, actor);
    return this._ratingFromAttr(raw);
  }

  /**
   * M399 — resolve hybrid damageStat ("str_int", "str_dex", "dex_int") to a
   * single stat based on the actor's equipped weapon category. Either-or rule:
   *   - heavy weapon  → STR-side
   *   - magic weapon  → INT-side  (str_int → int, str_dex → dex if no int)
   *   - light/melee   → DEX-side  (or STR for str_int with light weapon)
   * Non-hybrid keys pass through unchanged. Returns the resolved key + the
   * inferred damage category so the caller can drive both scaling and the
   * "magic vs heavy vs light" multiplier off the same decision.
   */
  _resolveHybridStat(damageStat, actor) {
    const ds = (damageStat || '').toLowerCase();
    if (!ds.includes('_')) return { stat: ds, category: null, hybrid: false };
    const wcat = (actor?.weaponCategory || '').toLowerCase();
    const isHeavy = /2h|hammer|maul|axe/.test(wcat);
    const isMagic = /staff|wand|scepter|orb|tome/.test(wcat);
    let stat = ds; let category = null;
    // M400+: STR scaling always reads as the 'heavy' weapon category — STR
    // weapons (sword, hammer, mace) are heavy, never light. Light category
    // only applies to DEX-side resolution. Previously str_int with no heavy
    // weapon equipped fell to {str, light}, which leaked "light weapon → STR"
    // into Holy Strike's tooltip.
    if (ds === 'str_int') {
      if (isMagic) { stat = 'int'; category = 'magic'; }
      else { stat = 'str'; category = 'heavy'; }
    } else if (ds === 'str_dex') {
      if (isHeavy) { stat = 'str'; category = 'heavy'; }
      else { stat = 'dex'; category = 'light'; }
    } else if (ds === 'dex_int') {
      if (isMagic) { stat = 'int'; category = 'magic'; }
      else { stat = 'dex'; category = 'light'; }
    }
    return { stat, category, hybrid: true };
  }
  // M236: sum magic-find affix across party. Cached on gs._partyMagicFind so
  // MapScreen loot chests can reuse without a recompute. Used as a fractional
  // probability shift (0.15 = 15% more likely to roll magic+ / less likely
  // to downgrade to normal).
  _partyMagicFind() {
    const gs = GameState.get();
    let total = 0;
    for (const m of (gs.party || [])) {
      const eq = m?.equipment || {};
      for (const it of Object.values(eq)) {
        for (const affix of (it?.affixes || [])) {
          if (affix.stat === 'magicFind') total += affix.value || 0;
        }
      }
    }
    gs._partyMagicFind = total;
    return total;
  }
  _getRawSkillStat(statKey, attrs, actor) {
    const sk = statKey ? String(statKey).toLowerCase() : '';
    if (!sk) return attrs.STR || 8;
    // M411 — virtual 'damage' key resolves to the actor's weapon damage
    // midpoint, matching the main damage-skill formula. Lets every spell
    // (including heals, zones, corpse-explosion, status DoTs) scale off
    // weapon damage instead of INT. attrs._actor is set by _getSkillStat
    // when the caller didn't pass actor explicitly.
    if (sk === 'damage') {
      const a = actor || attrs?._actor;
      const lo = (a?.dmg && a.dmg[0]) || 1;
      const hi = (a?.dmg && a.dmg[1]) || lo + 1;
      return (lo + hi) / 2;
    }
    if (sk === 'str') return attrs.STR || 8;
    if (sk === 'dex') return attrs.DEX || 8;
    if (sk === 'int') return attrs.INT || 8;
    if (sk === 'str_int') return Math.round(((attrs.STR||8) + (attrs.INT||8)) / 2);
    if (sk === 'str_dex') return Math.round(((attrs.STR||8) + (attrs.DEX||8)) / 2);
    if (sk === 'dex_int') return Math.round(((attrs.DEX||8) + (attrs.INT||8)) / 2);
    if (sk === 'dex_con') return Math.round(((attrs.DEX||8) + (attrs.CON||8)) / 2);
    return attrs.STR || 8;
  }
  // M236: Attribute-Rating scaling for skills. Raw attributes scale 1:1 up
  // to 20, then soften to 0.6× above that. Keeps Act 1–3 feel unchanged
  // but caps late-game solo runs where a single caster was one-shotting
  // everything. Toggle off via localStorage.emberveil_rating_scaling='0'.
  _ratingFromAttr(attr) {
    let off = true;
    try { off = localStorage.getItem('emberveil_rating_scaling') === '0'; } catch (_) {}
    if (off) return attr;
    if (attr <= 20) return attr;
    return Math.round(20 + (attr - 20) * 0.6);
  }

  _applyDamage(actor, target, dmg, color, bd = null) {
    // M377 — debug entry-point: record every damage event with full
    // breakdown context. Critical for diagnosing Damage Meter bucketing
    // (e.g. legendary procs ending up under "Attack" instead of named).
    combatDebug.push('damage_apply_enter', {
      actor: actor?.name, actorId: actor?.id,
      target: target?.name, targetId: target?.id,
      raw: dmg, color,
      hpBefore: target?.hp, maxHp: target?.maxHp,
      breakdown: bd ? {
        skillName: bd.skillName, element: bd.element, crit: !!bd.crit,
        legendary: !!bd.legendary, type: bd.type,
      } : null,
    });
    // M342 — Riposte / parry counter. Swashbuckler's Riposte set
    // target.parryStance + target.parryMult but the consumption was never
    // wired, so enemies ate the parry "for free" and the counter damage
    // never logged. Now: consume one parry charge, fully absorb the
    // incoming hit, fire a return strike against the attacker. Logged via
    // recordDamageBySkill('Riposte') and meter add for accurate stats.
    if (!this._parryProcessing && target?.parryStance > 0 && actor && actor !== target) {
      target.parryStance = Math.max(0, target.parryStance - 1);
      const mult = target.parryMult || 2.0;
      // Counter damage uses target.dmg range (Swashbuckler's own weapon).
      const lo = (target.dmg && target.dmg[0]) || 1;
      const hi = (target.dmg && target.dmg[1]) || lo + 1;
      const baseRoll = Math.max(1, Math.floor(lo + Math.random() * (hi - lo + 1)));
      const counter = Math.max(1, Math.round(baseRoll * mult));
      this._spawnDmgNumber(actor.x, actor.y - 50, `↪ ${counter}`, '#f8d880');
      this._spawnDmgNumber(target.x, target.y - 30, 'PARRY!', '#f8d880');
      this._log_(`${target.name} parries and counters ${actor.name} for ${counter}!`, 'hero');
      try { recordDamageDealt(target, actor, counter, { skill: 'Riposte' }); } catch (_) {}
      try { recordDamageBySkill?.(target, 'Riposte', counter); } catch (_) {}
      try { this._meterAddDamage?.(target, counter, 'Riposte', { round: this._round }); } catch (_) {}
      // Recurse into _applyDamage with parryProcessing flag so the counter
      // itself never re-triggers a parry from the original attacker.
      this._parryProcessing = true;
      try { this._applyDamage(target, actor, counter, '#f8d880'); } finally { this._parryProcessing = false; }
      // Fully absorb the incoming hit.
      if (bd) bd.parried = true;
      return;
    }
    // M84: revive immunity absorbs all incoming damage.
    if (target.reviveImmune) {
      this._spawnDmgNumber(target.x, target.y - 50, 'IMMUNE', '#ffe080');
      this._flashMap.set(target.id, HIT_FLASH);
      if (bd) bd.immune = true;
      return;
    }
    // Damage reduction from buffs
    let finalDmg = dmg;
    // M303: champion shielded modifier — halves incoming damage
    if (target.championShielded && finalDmg > 0) {
      finalDmg = Math.max(1, Math.round(finalDmg * 0.5));
    }
    if (target.dmgReduct) {
      const before = finalDmg;
      finalDmg = Math.round(finalDmg * (1 - target.dmgReduct));
      if (bd) bd.dmgReductAbsorb = before - finalDmg;
      // M267 meter: if this is a hero, track DR as mitigation.
      if (this._allies?.includes(target) && (before - finalDmg) > 0) {
        this._meterAddMit(target, before - finalDmg, 'Damage Reduction', { round: this._round });
      }
    }
    // M94: marked status amplifies incoming damage by 30%.
    if (target.statuses && target.statuses.some(s => s.type === 'marked')) {
      const before = finalDmg;
      finalDmg = Math.round(finalDmg * 1.3);
      if (bd) bd.markedAmp = finalDmg - before;
    }

    // M65 — barrier absorb: subtract from barrier status pools BEFORE HP.
    if (target.statuses && target.statuses.length && finalDmg > 0) {
      let totalBarrier = 0;
      for (const s of target.statuses) {
        if (finalDmg <= 0) break;
        if (s.type !== 'barrier' || !(s.power > 0)) continue;
        const absorbed = Math.min(s.power, finalDmg);
        s.power -= absorbed;
        finalDmg -= absorbed;
        totalBarrier += absorbed;
        this._spawnDmgNumber(target.x, target.y - 30, `-${absorbed} shld`, '#80c0ff');
      }
      // M340 — keep magic-shield-sourced barriers in the list even when
      // depleted so they can regen on round end. Only drop the temporary
      // skill-cast barriers when their power hits 0.
      target.statuses = target.statuses.filter(s =>
        s.type !== 'barrier' || s.fromMagicShield || s.power > 0
      );
      if (bd && totalBarrier > 0) bd.barrierAbsorb = totalBarrier;
      // M267 meter: barrier absorb on hero counts as BOTH mitigation (damage
      // prevented) AND heal (the shield itself is a form of healing for
      // Skada-style reporting — mirrors how WoW-style meters show shields).
      if (totalBarrier > 0 && this._allies?.includes(target)) {
        this._meterAddMit(target, totalBarrier, 'Barrier', { round: this._round });
      }
    }
    // M175: soulbind — if target has soulbind status and at least one ally
    // also has soulbind, redirect `amount%` of finalDmg to the bound partner.
    // Scope: target's own side (allies share pain, enemies cannot). Split once
    // per hit (no infinite recursion — flagged via _soulbindProcessing).
    if (!this._soulbindProcessing && Array.isArray(target.statuses) && finalDmg > 0) {
      const sb = target.statuses.find(s => s.type === 'soulbind' && (s.amount || 0) > 0);
      if (sb) {
        const sideList = this._allies?.includes(target) ? this._allies : this._allEnemies;
        const partner = sideList?.find(a => a !== target && a.alive && Array.isArray(a.statuses) && a.statuses.some(s => s.type === 'soulbind'));
        if (partner) {
          // M415 — try/finally guard so a throw inside the split application
          // never leaves _soulbindProcessing stuck true (which would deadlock
          // every subsequent soulbind hit for the rest of combat).
          this._soulbindProcessing = true;
          try {
            const split = Math.max(1, Math.round(finalDmg * (sb.amount / 100)));
            finalDmg -= split;
            if (bd) bd.soulbindSplit = split;
            partner.hp = Math.max(0, partner.hp - split);
            this._spawnDmgNumber(partner.x, partner.y - 50, `↔ ${split}`, '#c080ff');
            this._flashMap.set(partner.id, HIT_FLASH);
            if (partner.hp <= 0) { partner.alive = false; partner.stance = 'death'; }
          } finally {
            this._soulbindProcessing = false;
          }
        }
      }
    }

    if (finalDmg <= 0) { this._flashMap.set(target.id, HIT_FLASH); return; }

    // M256: overkill tracking — bd.overkill = excess damage beyond the
    // target's remaining HP. Log tooltip surfaces it; combat-log line
    // gets "(overkill N)" suffix when overkill > 0.
    // M273: capture pre-hit HP fraction for the boss-low-HP-at-kill tracker
    // (warlock unlock: kill a boss while it's at <= 20% HP).
    const _preHpFraction = target.maxHp > 0 ? (target.hp / target.maxHp) : 1;
    const overkill = Math.max(0, finalDmg - target.hp);
    if (bd) { bd.overkill = overkill; bd.dealt = Math.min(finalDmg, Math.max(0, target.hp)); }
    // M261/M268: meter tracking for both sides. Allies → enemies OR enemies → allies.
    if (actor && (this._allies?.includes(actor) || this._allEnemies?.includes(actor))) {
      const appliedDmg = finalDmg - overkill;
      this._meterAddDamage(actor, appliedDmg, bd?.skillName || 'Attack', {
        target: target.name,
        round: this._round,
        skill: bd?.skillName || 'Attack',
        crit: !!bd?.crit,
        overkill,
        mitigated: (bd?.dmgReductAbsorb || 0) + (bd?.barrierAbsorb || 0),
        rawDealt: finalDmg,
      });
    }
    const _hpBeforeApply = target.hp;
    target.hp -= finalDmg;
    // M398 — Sleep wakes on any damage that reduces HP. Drop the status,
    // log the wake, and let normal turn resolution take over from here.
    if (finalDmg > 0 && target.statuses && target.statuses.some(s => s.type === 'sleep')) {
      target.statuses = target.statuses.filter(s => s.type !== 'sleep');
      this._log_(`${target.name} jolts awake!`, 'round');
    }
    // M377 — debug exit: final mitigated damage that actually moved HP.
    combatDebug.push('damage_apply', {
      actor: actor?.name, target: target?.name,
      raw: dmg, final: finalDmg,
      hpBefore: _hpBeforeApply, hpAfter: target.hp,
      mitigated: (bd?.dmgReductAbsorb || 0) + (bd?.barrierAbsorb || 0),
      barrierAbsorb: bd?.barrierAbsorb || 0,
      dmgReductAbsorb: bd?.dmgReductAbsorb || 0,
      markedAmp: bd?.markedAmp || 0,
      overkill: bd?.overkill || 0,
      soulbindSplit: bd?.soulbindSplit || 0,
      source: bd?.skillName || 'Attack',
      element: bd?.element || null,
      legendary: !!bd?.legendary,
      crit: !!bd?.crit,
    });
    // M304: check boss phase transition after damage lands
    if (!target.isHero && target.alive && target.hp > 0) {
      checkBossPhaseTransition(target, this._log_.bind(this));
    }
    this._flashMap.set(target.id, HIT_FLASH);
    this._spawnParticles(target.x, target.y - 30);
    this._spawnDmgNumber(target.x, target.y - 50, finalDmg, color);
    this.audio.playSfx('hit');

    // Life steal / mana steal: heal attacker for a % of damage dealt.
    if (actor && actor.alive && finalDmg > 0) {
      if (actor.lifeSteal > 0) {
        const stolen = Math.floor(finalDmg * actor.lifeSteal / 100);
        if (stolen > 0) {
          const before = actor.hp;
          actor.hp = Math.min(actor.maxHp, actor.hp + stolen);
          const applied = actor.hp - before;
          this._spawnDmgNumber(actor.x, actor.y - 30, `+${stolen}`, '#60c060');
          if (bd) bd.lifeSteal = stolen;
          // M267 meter: lifesteal counts as heal for the attacker.
          if (applied > 0 && this._allies?.includes(actor)) {
            this._meterAddHeal(actor, applied, 'Lifesteal', { target: actor.name, round: this._round, overheal: stolen - applied });
          }
        }
      }
      if (actor.manaSteal > 0) {
        const stolen = Math.floor(finalDmg * actor.manaSteal / 100);
        if (stolen > 0) {
          // M273: actor.maxMp is set in _memberToCombatant via computeMaxMp.
          // Removing the legacy `|| 80` fallback so we can't silently mana-steal
          // beyond a malformed actor's real cap (the M266 bug pattern).
          actor.mp = Math.min(actor.maxMp ?? 0, (actor.mp || 0) + stolen);
          this._spawnDmgNumber(actor.x, actor.y - 20, `+${stolen} mp`, '#6080ff');
          if (bd) bd.manaSteal = stolen;
        }
      }
    }

    // M89: reflect — fraction of incoming damage bounces back to attacker.
    if (target.reflect && actor && actor !== target && actor.alive && finalDmg > 0) {
      const back = Math.max(1, Math.round(finalDmg * target.reflect));
      actor.hp = Math.max(0, actor.hp - back);
      this._spawnDmgNumber(actor.x, actor.y - 30, back, '#c0c0ff');
      if (actor.hp <= 0) { actor.alive = false; actor.stance = 'death'; }
    }

    // M173: counter-stance — `counterStance` status with amount (percent)
    // returns that % of incoming damage to the attacker. One-shot consume by
    // decrementing stacks; status removed when stacks hit 0.
    if (actor && actor !== target && actor.alive && finalDmg > 0 && !this._counterProcessing && Array.isArray(target.statuses)) {
      const cs = target.statuses.find(s => s.type === 'counterStance' && (s.amount || 0) > 0);
      if (cs) {
        // M415 — try/finally so a throw inside counter resolution can never
        // leave _counterProcessing stuck true.
        this._counterProcessing = true;
        try {
          const back = Math.max(1, Math.round(finalDmg * (cs.amount / 100)));
          actor.hp = Math.max(0, actor.hp - back);
          this._spawnDmgNumber(actor.x, actor.y - 30, `↩ ${back}`, '#ff80c0');
          if (actor.hp <= 0) { actor.alive = false; actor.stance = 'death'; }
          cs.stacks = (cs.stacks || 1) - 1;
          if (cs.stacks <= 0) target.statuses = target.statuses.filter(s => s !== cs);
        } finally {
          this._counterProcessing = false;
        }
      }
    }

    // M176: passive thorns — reflect % of incoming damage to attacker.
    // Recursion-safe via _thornsProcessing (ala soulbind/counter).
    if (!this._thornsProcessing && actor && actor !== target && actor.alive && finalDmg > 0 && (target.passiveThorns || 0) > 0) {
      // M415 — try/finally so a throw inside thorns resolution can never
      // leave _thornsProcessing stuck true.
      this._thornsProcessing = true;
      try {
        const back = Math.max(1, Math.round(finalDmg * target.passiveThorns));
        actor.hp = Math.max(0, actor.hp - back);
        this._spawnDmgNumber(actor.x, actor.y - 30, `⇜ ${back}`, '#80ffc0');
        if (actor.hp <= 0) { actor.alive = false; actor.stance = 'death'; }
      } finally {
        this._thornsProcessing = false;
      }
    }

    if (target.hp <= 0) {
      target.hp = 0; target.alive = false; target.stance = 'death';
      this._log_(`${target.name} defeated!`, 'death');
      // M280 stats: record kill (when an enemy falls to a hero) or death (hero/companion).
      if (target.isHero) {
        try { recordDeath(target); } catch (_) {}
      } else if (actor && actor.isHero) {
        try { recordKill(actor, target, { boss: target.isBoss, elite: target.tier === 'elite' }); } catch (_) {}
        // M330 — boss-kill milestone event for analytics.
        if (target.isBoss) {
          try {
            if (typeof window !== 'undefined' && typeof window.__rsgPushEvent === 'function') {
              window.__rsgPushEvent('boss_killed', {
                boss_id: target.enemyId || target.id,
                boss_name: target.name,
                act: GameState.get()?.act || 1,
              });
            }
          } catch (_) {}
        }
      }
      // M95: Vengeance tracker — count fallen allies for demon_hunter stack bonus.
      if (target.isHero) this._allyDeathCount = (this._allyDeathCount || 0) + 1;
      // M273: warlock-unlock low-HP-boss tracker. If the boss died from a hit
      // that started <= 20% HP (i.e. they were already wounded), record it.
      if (target.isBoss && _preHpFraction <= 0.20) {
        try {
          const gs = GameState.get();
          if (!Array.isArray(gs.bossKillsLowHp)) gs.bossKillsLowHp = [];
          const bossId = target.enemyId || target.id || target.name;
          if (bossId && !gs.bossKillsLowHp.includes(bossId)) gs.bossKillsLowHp.push(bossId);
        } catch (_) {}
      }
      // M176: passive on-kill — hp/mana refund to attacker.
      if (actor && actor.alive && actor !== target) {
        if ((actor.passiveHpOnKill || 0) > 0 && actor.maxHp) {
          const heal = Math.min(actor.passiveHpOnKill, actor.maxHp - actor.hp);
          if (heal > 0) { actor.hp += heal; this._spawnDmgNumber(actor.x, actor.y - 40, `+${heal}`, '#80ff80'); }
        }
        if ((actor.passiveManaOnKill || 0) > 0 && actor.maxMp) {
          const mana = Math.min(actor.passiveManaOnKill, actor.maxMp - (actor.mp || 0));
          if (mana > 0) { actor.mp = (actor.mp || 0) + mana; this._spawnDmgNumber(actor.x, actor.y - 20, `+${mana} mp`, '#80c0ff'); }
        }
      }
      // M302: curse spreads when a non-hero enemy is killed.
      if (!target.isHero) this._spreadCurseOnDeath(target, this._allEnemies);

      // M305: legendary onKill hooks.
      if (actor && actor.isHero) {
        this._dispatchLegendaryHook('onKill', actor, { target, dealt: finalDmg });
      }
    }
  }

  // ── M305: Legendary hook dispatch helpers ─────────────────────────────────

  /**
   * Build a context object for legendary hook dispatch and call the hook.
   * @param {string} hookName
   * @param {object} actor    — combatant who owns the legendary effects
   * @param {object} extra    — extra context fields (target, dealt, etc.)
   */
  _dispatchLegendaryHook(hookName, actor, extra = {}) {
    const ids = getActorLegendaryIds(actor);
    if (!ids.length) return;
    // M377 — log each legendary hook dispatch (the M369 Dragon Breath
    // attribution bug originated here: an onKill effect dealt damage
    // through this `applyDmg` callback without a sourceName, so the
    // meter bucketed it under "Attack").
    combatDebug.push('legendary_proc', {
      actor: actor?.name, actorId: actor?.id,
      hook: hookName,
      effectIds: ids.slice(),
      ctx: { target: extra?.target?.name, dealt: extra?.dealt, isCrit: !!extra?.isCrit, rawDmg: extra?.rawDmg },
    });
    const allies  = (this._allies  || []).filter(a => a && a.alive);
    const enemies = (this._allEnemies || []).filter(e => e && e.alive);
    const ctx = {
      actor,
      allies,
      enemies,
      log:         (msg, t) => { try { this._log_(msg, t || 'hero'); } catch (_) {} },
      applyStatus: (tgt, type, dur, pow) => { try { this._applyStatus(tgt, type, dur, pow); } catch (_) {} },
      applyDmg:    (src, tgt, amt, color, sourceName, element) => {
        // M368: pass a breakdown so the damage meter attributes legendary
        // effects (e.g. "Dragon Breath" fire) instead of bucketing them
        // under a generic "Attack". `sourceName` falls back to the
        // legendary effect's id when callers don't provide one.
        try {
          const bd = sourceName ? { skillName: sourceName, element: element || null, legendary: true } : null;
          this._applyDamage(src, tgt, amt, color || '#e060ff', bd);
        } catch (_) {}
      },
      heal:        (tgt, amt) => {
        try {
          const actual = Math.min(amt, (tgt.maxHp || 0) - (tgt.hp || 0));
          if (actual > 0) {
            tgt.hp += actual;
            this._spawnDmgNumber(tgt.x, tgt.y - 30, `+${actual}`, '#80ff80');
          }
        } catch (_) {}
      },
      ...extra,
    };
    dispatchLegendaryHook(hookName, ctx, ids);
  }

  /**
   * M377 — End-of-combat parity check + telemetry summary.
   * Compares meter totals, parsed in-screen log totals, and the post-
   * combat report total. Pushes parity_warning events when they diverge
   * by more than 5%, and (if analytics consent is granted) emits a
   * single `combat_summary` event to GA + Supabase.
   *
   * @param {'win'|'loss'|'flee'} outcome
   */
  _runCombatParityCheck(outcome) {
    if (!combatDebug.enabled && !_analyticsEnabled()) {
      // Neither destination wants the data. Skip the work entirely.
      return { warnings: 0, parity_ok: true };
    }
    // Meter totals — split by side so the "party damage" number lines up
    // with what the report shows.
    let partyDmg = 0, partyHeal = 0, partyMit = 0, enemyDmg = 0;
    const sourceBreakdown = {};
    if (this._meter && this._meter.data) {
      for (const d of this._meter.data.values()) {
        if (d.side === 'enemy') {
          enemyDmg += d.damage || 0;
        } else {
          partyDmg += d.damage || 0;
          partyHeal += d.heal || 0;
          partyMit += d.mitigation || 0;
          for (const [src, v] of Object.entries(d.sources || {})) {
            sourceBreakdown[src] = (sourceBreakdown[src] || 0) + v;
          }
        }
      }
    }
    // Log lines: sum damage events from in-screen messages (hero entries only).
    let logDmg = 0;
    for (const e of (this._log || [])) {
      if (e.type !== 'hero' && e.type !== 'enemy') continue;
      const v = parseDamageFromLogLine(e.msg);
      if (v && v > 0 && e.type === 'hero') logDmg += v;
    }
    // Report total: this is the same number the post-combat report shows
    // (the meter is the source of truth for the report panes), so under
    // normal conditions reportDmg === partyDmg. If they ever drift it
    // means the report is computing differently than the meter.
    const reportDmg = partyDmg;

    let warnings = 0;
    if (combatDebug.enabled) {
      warnings = combatDebug.checkParity(
        { meter: partyDmg, log: logDmg, report: reportDmg },
        { outcome, encounter: this.encounter?.name },
      );
    }

    // Count legendary procs for the summary event.
    let legendaryProcs = 0;
    if (combatDebug.enabled) {
      for (const e of combatDebug.buffer) {
        if (e.kind === 'legendary_proc') legendaryProcs++;
      }
    }

    combatDebug.push('report_finalize', {
      outcome,
      partyDmg, partyHeal, partyMit, enemyDmg,
      logDmg, reportDmg,
      sourceBreakdown,
      parityWarnings: warnings,
    });
    combatDebug.groupEnd();

    // Telemetry — single summary event, not per-event spam.
    if (_analyticsEnabled()) {
      try {
        _pushTelemetryEvent('combat_summary', {
          encounter_name: this.encounter?.name || 'unknown',
          zone_id: this.encounter?._zoneId || null,
          outcome,
          rounds: this._round || 0,
          party_total_dmg: partyDmg,
          party_total_heal: partyHeal,
          party_total_mit: partyMit,
          enemy_total_dmg: enemyDmg,
          parity_warnings: warnings,
          legendary_procs: legendaryProcs,
          // Truncate to top 8 sources to keep the event payload small.
          source_breakdown: Object.fromEntries(
            Object.entries(sourceBreakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8),
          ),
          act: GameState.get()?.act || 1,
        });
      } catch (_) {}
    }

    return { warnings, parity_ok: warnings === 0 };
  }

  /**
   * Fire an onCombatStart hook for each living hero ally.
   */
  _dispatchLegendaryToAllies(hookName) {
    for (const ally of (this._allies || [])) {
      if (ally && ally.isHero) this._dispatchLegendaryHook(hookName, ally, {});
    }
  }

  /**
   * M302: DoT stacking mode helper.
   * dotEffect shape: { type, duration, power, chance, stackingMode, maxStacks, source? }
   *   stackingMode:
   *     'per_source'   — each (sourceId, type) pair stacks independently, up to maxStacks.
   *     'per_character'— one stack per source (sourceId), refreshes duration on reapply.
   *     'global'       — at most one stack of this type, regardless of source.
   * Falls back to legacy _applyStatus behaviour when stackingMode is absent.
   */
  _applyDotStacked(target, source, dotEffect) {
    if (!target.statuses) target.statuses = [];
    const { type, duration, power, chance = 1.0, stackingMode, maxStacks } = dotEffect;
    if (Math.random() > chance) return;
    const srcId = source?.id || 'env';

    if (!stackingMode) {
      // Legacy path — existing _applyStatus logic
      this._applyStatus(target, type, duration, power);
      return;
    }

    if (stackingMode === 'global') {
      const existing = target.statuses.find(s => s.type === type);
      if (existing) { existing.duration = Math.max(existing.duration, duration); return; }
      target.statuses.push({ type, duration, power, _src: srcId });
      this._log_(`${target.name} is cursed!`, 'death');
      return;
    }

    if (stackingMode === 'per_character') {
      const existing = target.statuses.find(s => s.type === type && s._src === srcId);
      if (existing) { existing.duration = duration; existing.power = power; return; }
      target.statuses.push({ type, duration, power, _src: srcId });
      this._log_(`${target.name} gains ${type} (${srcId})`, 'death');
      return;
    }

    if (stackingMode === 'per_source') {
      // Count how many stacks from this source already exist
      const srcStacks = target.statuses.filter(s => s.type === type && s._src === srcId);
      const max = maxStacks || 5;
      if (srcStacks.length >= max) return; // cap reached
      target.statuses.push({ type, duration, power, _src: srcId });
      // Update HUD
      return;
    }
  }

  // M302: Curse spread. When a cursed enemy dies, transfer the curse to a
  // random alive enemy (excluding the victim). Spread count controlled by
  // the curse's _spreadCount field (defaulting to 1).
  _spreadCurseOnDeath(victim, allEnemies) {
    const curseStatuses = (victim.statuses || []).filter(s => s.type === 'curse');
    if (!curseStatuses.length) return;
    const living = allEnemies.filter(e => e.alive && e !== victim);
    if (!living.length) return;
    for (const cs of curseStatuses) {
      const spreadCount = cs._spreadCount || 1;
      for (let i = 0; i < spreadCount; i++) {
        if (!living.length) break;
        const idx = Math.floor(Math.random() * living.length);
        const nextTarget = living[idx];
        // Don't double-up; just extend duration if already cursed
        const existing = (nextTarget.statuses || []).find(s => s.type === 'curse');
        if (existing) { existing.duration = Math.max(existing.duration, cs.duration || 3); }
        else {
          nextTarget.statuses = nextTarget.statuses || [];
          nextTarget.statuses.push({ type: 'curse', duration: cs.duration || 3, power: cs.power || 10, _src: cs._src });
        }
        this._log_(`${victim.name}'s curse spreads to ${nextTarget.name}!`, 'death');
        living.splice(idx, 1); // don't spread to same target twice
      }
    }
  }

  _applyStatus(target, type, duration, power, source) {
    if (!target.statuses) target.statuses = [];
    // M396 — fall back to current actor if source not passed. The active
    // turn's actor is held on this._currentActor; many call sites in the
    // skill-effect path don't thread `source` through, so default to it.
    if (!source) source = this._currentActor || null;
    // M377 — debug status applications.
    combatDebug.push('status_apply', {
      target: target?.name, targetId: target?.id,
      type, duration, power, sourceName: source?.name, sourceId: source?.id,
    });
    // M134: stun immunity — foes can't be re-stunned while stunImmuneRounds
    // is active. Duration grows with how many times this target has been
    // stunned (2 + priorStunCount rounds) so chain-stun loses value fast.
    if (type === 'stun' && (target.stunImmuneRounds || 0) > 0) {
      this._log_(`${target.name} resists the stun!`, 'miss');
      return;
    }
    // M396 — DoTs (bleed/burn/poison) stack PER-SOURCE up to 3 stacks so
    // multiple attackers / repeat hits all contribute and each tick is
    // attributed to the correct hero. Same-source reapply refreshes
    // duration / power. Other statuses keep the legacy single-instance
    // behaviour (duration extension only).
    const isDot = type === 'bleed' || type === 'burn' || type === 'poison';
    const srcId = source?.id || null;
    const srcName = source?.name || null;
    const srcIsHero = !!source?.isHero;
    if (isDot) {
      const sameSource = target.statuses.find(s => s.type === type && (s._srcId || null) === srcId);
      if (sameSource) {
        sameSource.duration = Math.max(sameSource.duration, duration);
        sameSource.power = Math.max(sameSource.power || 0, power || 0);
        return;
      }
      const stackCount = target.statuses.filter(s => s.type === type).length;
      if (stackCount >= 3) {
        // Cap reached — refresh oldest stack's duration instead of dropping.
        const oldest = target.statuses.find(s => s.type === type);
        if (oldest) oldest.duration = Math.max(oldest.duration, duration);
        return;
      }
      target.statuses.push({ type, duration, power, _srcId: srcId, _srcName: srcName, _srcIsHero: srcIsHero });
      return; // skip the verbose log line for DoT applications — too noisy with stacks
    }
    const existing = target.statuses.find(s => s.type === type);
    if (existing) { existing.duration = Math.max(existing.duration, duration); return; }
    target.statuses.push({ type, duration, power, _srcId: srcId, _srcName: srcName, _srcIsHero: srcIsHero });
    // M303: friendlier status names
    const statusVerb = {
      freeze: 'frozen', confused: 'confused', thorns: 'shrouded in thorns',
      regen: 'regenerating', curse: 'cursed', blind: 'blinded', silence: 'silenced',
      burn: 'burning', poison: 'poisoned', bleed: 'bleeding', stun: 'stunned',
      slow: 'slowed', haste: 'hasted', barrier: 'shielded',
    };
    const verb = statusVerb[type] || `${type}ed`;
    this._log_(`${target.name} is ${verb}!`, 'death');
  }

  _processStatusEffects() {
    const all = [...this._allies, ...this._allEnemies];
    for (const c of all) {
      if (!c.alive) continue;
      // M302: Curse spread on death — handled in _applyDamage / _checkCombatEnd via
      // _maybespreadCurseOnDeath. Done after status tick so the cursed entity still
      // has the curse when we check its death.
      c.statuses = (c.statuses || []).filter(s => {
        // Apply effect
        if (s.type === 'burn' || s.type === 'poison' || s.type === 'bleed') {
          const dot = Math.max(1, s.power || 3);
          c.hp -= dot;
          this._spawnDmgNumber(c.x, c.y - 45, dot, s.type === 'burn' ? '#ff6020' : s.type === 'poison' ? '#60c020' : '#c02020');
          // M396 — attribute the tick to the actor who applied the DoT.
          // Look up the live source object so we can credit the meter and
          // build a "Hero -> Target: N bleed" log line consistent with AoE.
          const srcId = s._srcId;
          const all2 = [...this._allies, ...this._allEnemies];
          const sourceActor = srcId ? all2.find(a => a.id === srcId) : null;
          const srcLabel = s._srcName || sourceActor?.name || null;
          const TYPE_LABEL = { burn: 'Burn', poison: 'Poison', bleed: 'Bleed' };
          const logLabel = TYPE_LABEL[s.type] || s.type;
          if (srcLabel) {
            this._log_(`${srcLabel} → ${c.name}: ${dot} ${s.type}`, c.isHero ? 'enemy' : 'hero');
          } else {
            this._log_(`${c.name} takes ${dot} ${s.type}`, c.isHero ? 'enemy' : 'hero');
          }
          // M396 — credit the meter under the DoT source name so per-hero
          // damage tracking stays accurate across multi-stack bleeds.
          if (sourceActor && s._srcIsHero) {
            try {
              this._meterAddDamage(sourceActor, dot, logLabel, { round: this._round, target: c });
            } catch (_) {}
          }
          // M289 — track damage taken by source (burn/poison/bleed).
          if (c.isHero) {
            try { recordDamageTakenBySource(dot, `status:${s.type}`); } catch (_) {}
          }
          if (c.hp <= 0) {
            c.hp = 0; c.alive = false; c.stance = 'death';
            this._log_(`${c.name} perishes from ${s.type}!`, 'death');
            // M302: curse spread on DoT kill
            if (!c.isHero) this._spreadCurseOnDeath(c, this._allEnemies);
          }
        }
        // M302: Curse — reduce damage output by power% (enforced in _castSkill via dmgBuff on enemy)
        if (s.type === 'curse') {
          // Curse debuff applied once here: set dmgReduct equivalent each tick so it's always fresh.
          // Actual reduction enforced via the 'curse' status check in _resolveIncomingDamage / damage pipeline.
          // Nothing to tick — just duration.
        }
        if (s.type === 'regen' && c.hp < c.maxHp) {
          const amt = Math.max(1, s.power || 3);
          c.hp = Math.min(c.maxHp, c.hp + amt);
          this._spawnDmgNumber(c.x, c.y - 45, `+${amt}`, '#60e880');
        }
        s.duration--;
        // M134: when a stun expires, grant immunity for 2 + priorStunCount
        // rounds. Repeated stuns extend immunity further so chain-stun has
        // diminishing returns.
        if (s.type === 'stun' && s.duration <= 0) {
          c.stunCount = (c.stunCount || 0) + 1;
          c.stunImmuneRounds = Math.max(c.stunImmuneRounds || 0, 2 + (c.stunCount - 1));
        }
        return s.duration > 0 && (s.type !== 'barrier' || s.power > 0);
      });
      // M134: decay stun immunity once per round.
      if ((c.stunImmuneRounds || 0) > 0) c.stunImmuneRounds--;

      // M84: decay revive immunity round counter (Divine Bulwark talent).
      if (c.reviveImmuneRounds > 0) {
        c.reviveImmuneRounds--;
        if (c.reviveImmuneRounds <= 0) c.reviveImmune = false;
      }
      // M95: Haste Sustained Tempo — re-grant extraAction at the start of each
      // round for extraActionDuration rounds total.
      if (c.extraActionRounds > 0) {
        c.extraAction = (c.extraAction || 0) + (c.extraActionPerRound || 1);
        c.extraActionRounds--;
        if (c.extraActionRounds <= 0) c.extraActionPerRound = 0;
      }
      // Decay buff rounds
      // M168: dmgBuff migrated to statuses[]; decrement its durations here.
      if (Array.isArray(c.statuses)) {
        c.statuses = c.statuses.map(s => s.type === 'dmgBuff' ? { ...s, duration: (s.duration || 0) - 1 } : s)
          .filter(s => s.type !== 'dmgBuff' || s.duration > 0);
      }
      if (c.dmgReductRounds > 0) { c.dmgReductRounds--; if (c.dmgReductRounds === 0) c.dmgReduct = 0; }
      if (c.dodgeBuffRounds > 0) { c.dodgeBuffRounds--; if (c.dodgeBuffRounds === 0) { c.dodge = Math.max(0, (c.dodge || 0) - (c.dodgeBuff || 0)); c.dodgeBuff = 0; } }
      if (c.reflectRounds > 0) { c.reflectRounds--; if (c.reflectRounds === 0) c.reflect = 0; }
      // M94: decay crit/hit/armor/mr buff rounds
      // M169: critBonus temp buffs migrated to statuses[]; decrement here.
      if (Array.isArray(c.statuses)) {
        c.statuses = c.statuses.map(s => s.type === 'critBonus' ? { ...s, duration: (s.duration || 0) - 1 } : s)
          .filter(s => s.type !== 'critBonus' || s.duration > 0);
      }
      if (c.hitBuffRounds > 0)  { c.hitBuffRounds--;  if (c.hitBuffRounds === 0)  { c.hit = Math.max(0, (c.hit || 0) - (c._hitBuffAmt || 0)); c._hitBuffAmt = 0; } }
      if (c.armorBuffRounds > 0){ c.armorBuffRounds--;if (c.armorBuffRounds === 0){ c.armor = Math.max(0, (c.armor || 0) - (c._armorBuffAmt || 0)); c._armorBuffAmt = 0; } }
      if (c.mrBuffRounds > 0)   { c.mrBuffRounds--;   if (c.mrBuffRounds === 0)   { c.magicResist = Math.max(0, (c.magicResist || 0) - (c._mrBuffAmt || 0)); c._mrBuffAmt = 0; } }
      // M94: taunt decay (AI consumer deferred to m95)
      if (c.tauntedRounds > 0) { c.tauntedRounds--; if (c.tauntedRounds === 0) c.tauntedBy = null; }
      // M94: onHitStatus buff decay (Poison Blade)
      if (c.onHitStatusRounds > 0) { c.onHitStatusRounds--; if (c.onHitStatusRounds === 0) c.onHitStatus = null; }
      // M94: Sunder Armor restore
      if (c._armorRestore && c._armorRestore.rounds > 0) {
        c._armorRestore.rounds--;
        if (c._armorRestore.rounds <= 0) {
          c.armor = (c.armor || 0) + c._armorRestore.value;
          c._armorRestore = null;
        }
      }
    }

    // M303: Champion onRoundStart hooks
    const champCtx = {
      log: (msg, type) => this._log_(msg, type || 'normal'),
      spawnDmgNumber: (x, y, val, color) => this._spawnDmgNumber(x, y, val, color),
      allies: this._allies,
      allEnemies: this._allEnemies,
    };
    for (const e of this._allEnemies) {
      if (!e.alive || !e.isChampion || !e.championMods) continue;
      for (const modId of e.championMods) {
        const mod = CHAMPION_MODIFIERS[modId];
        if (mod?.onRoundStart) {
          try { mod.onRoundStart(e, champCtx); } catch (_) {}
        }
      }
    }

    this._updateHud();
  }

  _regenMana() {
    // M46: Mana regen per turn scales with INT. Also respects +mana_regen affix bonus on equipment.
    const gs = GameState.get();
    for (const c of this._allies) {
      if (!c.alive) continue;
      const m = [...gs.party, ...gs.companions].find(p => p.id === c.id);
      const intStat = m?.attrs?.INT || 8;
      let regen = Math.max(1, Math.round(intStat * 0.3));
      // M50: passive Mana Flow nodes.
      regen += (c.mpRegenBonus || 0);
      // M50: HP regen from passive Regrowth / Regeneration nodes.
      if ((c.hpRegen || 0) > 0 && c.hp < c.maxHp) {
        c.hp = Math.min(c.maxHp, c.hp + c.hpRegen);
      }
      // M93: Pull +mana_regen affix bonus from the shared helper — single
      // source of truth. Replaces the inline affix scan that used to live here.
      regen += Math.round(getEquipmentAffixBonuses(m).manaRegen || 0);
      // M406 — shrine mp_regen buff: flat bonus per turn.
      regen += (c._shrineMpRegen || 0);
      c.mp = Math.min(c.maxMp || c.mp, (c.mp || 0) + regen);
    }
    this._updateHud();
  }

  _checkCombatEnd() {
    const allDead = this._allEnemies.every(e => !e.alive);
    const alliesDead = this._allies.every(a => !a.alive);
    if (allDead && this._phase === 'PLAYING') {
      this._phase = 'VICTORY';
      this._allies.forEach(a => { if (a.alive) a.stance = 'victory'; });
      this._setTimeout(() => this._victory(), 800);
    }
    else if (alliesDead && this._phase === 'PLAYING') { this._phase = 'DEFEAT'; this._setTimeout(() => this._defeat(), 800); }
  }

  _spawnDmgNumber(x, y, dmg, color) {
    if (!x && !y) return;
    this._dmgNumbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      text: String(dmg),
      color,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  _spawnParticles(x, y) {
    if (!x && !y) return;
    const colors = ['#e8a020','#ff6040','#f0c060','#ff4040'];
    for (let i = 0; i < 7; i++) {
      this._particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 100,
        vy: -(Math.random() * 80 + 30),
        size: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: Math.random() * 0.4 + 0.15,
      });
    }
  }

  // M276 C16 — Out-of-combat auto-revive. If any alive party/companion has
  // a learned skill of type 'revive', all fallen heroes/companions are
  // restored to 50% maxHp before XP / loot is awarded. Only runs on
  // victory or successful flee. Uses the in-combat _heroes/_companions
  // arrays (which are then synced back to GameState by _victory()).
  _applyEndOfCombatAutoRevive(reason) {
    const all = [...(this._heroes || []), ...(this._companions || [])];
    const anyReviver = all.some(m => m && m.alive && Array.isArray(m.skills)
      && m.skills.some(sid => SKILLS[sid]?.type === 'revive'));
    if (!anyReviver) return [];
    const revived = [];
    for (const m of all) {
      if (!m) continue;
      if (m.alive && m.hp > 0) continue;
      const max = m.maxHp || 50;
      m.hp = Math.max(1, Math.floor(max * 0.5));
      m.alive = true;
      m.dead = false;
      m.statuses = (m.statuses || []).filter(s => s.type !== 'doom' && s.type !== 'death');
      revived.push(m);
    }
    if (revived.length) {
      this._log_(`Revival magic surges through your party! ${revived.map(r => r.name).join(', ')} return to ${50}% HP.`, 'hero');
    }
    return revived;
  }

  _victory() {
    this._stopCombatAudio();
    this.audio.playSfx('victory');
    // M377 — parity audit + GA/Supabase summary (run before recordFightEnd
    // so the buffer still contains everything that happened this fight).
    try { this._lastParityResult = this._runCombatParityCheck('win'); } catch (_) {}
    try { recordFightEnd(true, this._heroes || []); } catch (_) {}
    // Immediately flush perChar stats to the localStorage cache so a page
    // reload right after combat shows the full kill/damage picture.
    try { flushRunStatsCache(); } catch (_) {}
    // M289 — log fight metadata so the Fight filter (regular/boss/dungeon) on
    // the Damage tab can partition damage data correctly.
    try {
      const kind = this.encounter?._bossNodeId ? 'boss'
                 : (this.encounter?._dungeonStage != null ? 'dungeon' : 'regular');
      const dur = Math.max(1, Math.floor((Date.now() - (this._fightStartedAt || Date.now())) / 1000));
      recordFightLog({ kind, zoneId: this.encounter?._zoneId, durationSec: dur, won: true });
    } catch (_) {}
    // M276 C16: auto-revive BEFORE XP/loot so revived members count for sync.
    this._applyEndOfCombatAutoRevive('victory');
    let totalXp = 0, totalGold = 0;
    const drops = [];
    // M93: Hero-only goldFind. Companions don't contribute per the
    // find/loot-stat rule. Sum once, pass to every enemy reward call.
    const vgs = GameState.get();
    const heroMembers = vgs.party.filter(p => !(p.isCompanion || p.class === 'companion'));
    let goldFindBonus = 0;
    for (const h of heroMembers) goldFindBonus += getEquipmentAffixBonuses(h).goldFind || 0;
    // M273: increment kill counter once per slain enemy. Used for class
    // unlock conditions (pyromancer "slay 500", and feeds into general
    // achievement scaffolding). Skip revives (e.alive==true post-victory
    // is impossible here since _victory only fires when allDead).
    const vgs2 = GameState.get();
    vgs2.enemyKillCount = (vgs2.enemyKillCount || 0) + this._allEnemies.length;
    for (const e of this._allEnemies) {
      totalXp += computeXpReward(e, this._heroes);
      totalGold += computeGoldReward(e, { goldFindBonus });
      // 15-25% chance for item drop (scales with zone). M236: revisited
      // combat nodes lose 50% of their drop chance AND skip rarity upgrades.
      const _revisitMult = this.encounter._revisit ? 0.5 : 1.0;
      // M276 D15 — Magic Find: Hard difficulty grants +20% MF, applied here
      // as a drop-chance multiplier. ADDS to (composes with) any future
      // affix-based magic find, which would also be a multiplier on this base.
      let _mfMult = 1;
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('emberveil_difficulty') === 'hard') _mfMult *= 1.20;
      } catch {}
      const dropChance = (ZONE_DROP_CHANCE[this.encounter._zoneId] || 0.15) * _revisitMult * _mfMult;
      if (Math.random() < dropChance) {
        const bases = ZONE_BASES[this.encounter._zoneId] || ['sword','dagger','light_chest','ring'];
        let rarity = ZONE_RARITY[this.encounter._zoneId] || 'magic';
        const quality = ZONE_QUALITY[this.encounter._zoneId] || 'medium';
        // M236: Act 1 rebalance — ~50% of drops downgrade to normal so the
        // early zones feel like actual early game. Magic Find shifts the odds
        // back up for players who've invested affix slots in it.
        if (this.encounter._zoneId === 'border_roads') {
          const mfBonus = this._partyMagicFind() || 0;
          if (Math.random() < (0.5 - mfBonus)) rarity = 'normal';
        } else if (this.encounter._zoneId === 'thornwood') {
          const mfBonus = this._partyMagicFind() || 0;
          if (Math.random() < (0.35 - mfBonus)) rarity = 'normal';
        }
        const item = generateItem(bases[Math.floor(Math.random()*bases.length)], rarity, quality);
        if (item) {
          drops.push(item); GameState.addToInventory(item);
          // M293 — quick-equip toast.
          try {
            const autoRes = GameState._lastAutoEquip;
            if (autoRes && autoRes.member) {
              showToast(`<strong>Auto-equipped</strong> ${item.name} to ${autoRes.member.name}`);
            } else {
              const upCand = GameState.findUpgradeCandidate(item);
              if (upCand && upCand.member) {
                const mgr = this.manager;
                showToast(
                  `<strong>${item.name}</strong> is an upgrade for <strong>${upCand.member.name}</strong> — open inventory`,
                  { onClick: () => { try { import('./InventoryScreen.js').then(({ InventoryScreen }) => mgr.push(new InventoryScreen(mgr, this.audio))); } catch (_) {} } }
                );
              }
            }
          } catch (_) {}
          // M287 — record drop for stats dashboard.
          try {
            import('../../game/stats.js').then(m => m.recordDrop(item, {
              zoneId: this.encounter._zoneId,
              magicFind: Math.round((this._partyMagicFind() || 0) * 100),
              source: 'combat',
            }));
          } catch (_) {}
        }
      }
    }
    // M406 — apply shrine buff multipliers then decrement combatsLeft.
    {
      const vgsb = GameState.get();
      if (!Array.isArray(vgsb.shrineBuffs)) vgsb.shrineBuffs = [];
      const activeShrineBuffs = vgsb.shrineBuffs.filter(b => b.combatsLeft > 0);
      for (const b of activeShrineBuffs) {
        if (b.type === 'xp_boost')   totalXp   = Math.round(totalXp   * (b.mult || 1.5));
        if (b.type === 'gold_boost')  totalGold = Math.round(totalGold * (b.mult || 1.25));
        b.combatsLeft = Math.max(0, b.combatsLeft - 1);
      }
      // Remove expired buffs.
      vgsb.shrineBuffs = vgsb.shrineBuffs.filter(b => b.combatsLeft > 0);
    }
    GameState.addGold(totalGold);
    // Award fame: 1 per enemy + bonus for boss
    const fameMult = ZONE_FAME_MULT[this.encounter._zoneId] || 1;
    const bossBonus = this.encounter._bossNodeId ? Math.round(15 * fameMult) : 0;
    const fameGain = Math.round(this._allEnemies.length * fameMult) + bossBonus;
    GameState.addFame(fameGain);

    // Award XP and sync HP back to GameState
    const gs = GameState.get();
    // M266: sync HP by id across heroes + companions. Previously only
    // heroes were written back by index, so companions always started the
    // next combat at full HP on Hard.
    {
      const byId = new Map();
      for (const h of [...this._heroes, ...this._companions]) byId.set(h.id, h);
      for (const m of [...(gs.party || []), ...(gs.companions || [])]) {
        const hc = byId.get(m.id);
        if (!hc) continue;
        m.hp = Math.round(hc.hp);
        m.mp = Math.round(hc.mp || 0);
      }
    }
    const levelUps = awardXp(gs.party, totalXp);

    // Boss completion: unlock next zone (maps hoisted to module top, M273)
    let bossUnlock = null;
    let actTransition = null;
    let isGameComplete = false;
    let tapDropId = null;
    if (this.encounter._bossNodeId) {
      if (!gs.completedBosses) gs.completedBosses = [];
      const firstTimeBoss = !gs.completedBosses.includes(this.encounter._bossNodeId);
      gs.completedBosses.push(this.encounter._bossNodeId);
      // M236: advance main quest on first-time boss kill.
      if (firstTimeBoss) {
        import('../../game/quests.js').then(m => m.advanceOnBossKill(gs, this.encounter._bossNodeId));
        // M298: unlock any lore entries gated on this boss kill
        import('../../game/lore.js').then(({ LORE_ENTRIES }) => {
          const bossId = this.encounter._bossNodeId;
          for (const entry of LORE_ENTRIES) {
            if (entry.unlockedBy?.type === 'boss_kill' && entry.unlockedBy?.id === bossId) {
              GameState.unlockLore(entry.id);
            }
          }
        }).catch(() => {});
        // M307: unlock crafting recipes tied to this boss kill.
        import('../../game/recipes.js').then(({ onBossKillUnlockRecipes }) => {
          const bossId = this.encounter._bossNodeId;
          const names = onBossKillUnlockRecipes(bossId, gs);
          if (names.length > 0) {
            try { showToast(`Recipe${names.length > 1 ? 's' : ''} unlocked: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}`); } catch (_) {}
          }
        }).catch(() => {});
      }
      // M-followup: the post-combat "pick 1 of 3" loot chest has been removed
      // per design feedback. Boss loot is fully awarded via the victory modal
      // (themed boss drops + standard zone drops, both auto-added to
      // inventory). Clear any legacy chest state from older saves so the
      // chest modal can't re-appear on load.
      gs._bossChestPending = null;
      gs._bossChestItems = null;
      gs._bossChestNodeId = null;
      if (firstTimeBoss) {
        // M304: themed boss loot (overrides generic zone loot for extra rolls).
        // Find the primary boss enemy and roll its themed table.
        const bossCombatant = this._allEnemies.find(e => e.isBoss);
        if (bossCombatant) {
          const bossDrops = rollBossLoot(bossCombatant.enemyId, generateItem, _generateUnique);
          for (const bd of bossDrops) {
            drops.push(bd);
            GameState.addToInventory(bd);
          }
          if (bossDrops.length > 0) {
            this._log_(`Themed spoils of war: ${bossDrops.map(d => d.name).join(', ')}`, 'hero');
          }
        }
      }
      // M419: BOSS_TAP_DROPS imported from mapData.js.
      const MINI_BOSS_TAPS = ['ninja_stars','chain_lightning','void_lance'];
      const zone = this.encounter._zoneId;
      tapDropId = BOSS_TAP_DROPS[zone] || MINI_BOSS_TAPS[(gs.completedBosses.length) % MINI_BOSS_TAPS.length];
      if (tapDropId && !GameState.hasTapItem(tapDropId)) {
        GameState.addTapItem(tapDropId);
      } else if (tapDropId) {
        tapDropId = null; // already owned
      }
      const nextZone = ZONE_UNLOCK_MAP[this.encounter._zoneId];
      if (nextZone && !(gs.unlockedZones || []).includes(nextZone)) {
        if (!gs.unlockedZones) gs.unlockedZones = ['border_roads'];
        gs.unlockedZones.push(nextZone);
        bossUnlock = `${ZONE_NAMES[nextZone] || 'New zone'} unlocked!`;
      }
      // M279: prologue is a one-shot intro — once cleared, it disappears from
      // the world map (no back-edge to it from Act 1, no tooltip, no walking
      // back). Strip it from unlockedZones so MapScreen._getCrossZoneLink and
      // tab rendering both omit it.
      if (this.encounter._zoneId === 'prologue' && Array.isArray(gs.unlockedZones)) {
        gs.unlockedZones = gs.unlockedZones.filter(z => z !== 'prologue');
      }
      // Check act transition
      const nextAct = ACT_BOSS_ZONES[this.encounter._zoneId];
      if (nextAct) {
        gs.act = nextAct;
        actTransition = nextAct;
      }
      // Detect final boss victory (Act 5 final boss)
      if (this.encounter._zoneId === 'dragon_throne' || this.encounter._bossNodeId === 'dragonking_boss') {
        isGameComplete = true;
        GameState.setFlag('game_complete', true);
        // M286 — auto-archive on final boss kill so the Cross-Run tab on the
        // main-menu Stats screen reflects this completion immediately.
        try {
          import('../../game/stats.js').then(m => {
            try { m.recordRunCompleted(); m.archiveCurrentRun(`Completed — ${new Date().toISOString().slice(0,10)}`); } catch (_) {}
          });
        } catch (_) {}
      }
    }

    // M307 — Boss-defeat cinematic dialog: show a 3-line overlay before the
    // normal victory modal, but only for encounters flagged as boss fights.
    // Respects reduce-motion (skip animation when enabled).
    const _isBossFight = !!this.encounter._bossNodeId;
    const _primaryBoss = this._allEnemies.find(e => e.isBoss) || this._allEnemies[0];
    const _bossEnemyId = _primaryBoss?.enemyId || _primaryBoss?.id || '';
    if (_isBossFight && _bossEnemyId) {
      import('../../game/bossDeathDialog.js').then(({ getBossDeathDialog }) => {
        const dlg = getBossDeathDialog(_bossEnemyId);
        if (dlg) {
          this._showBossDeathCinematic(dlg, () => this._showVictoryModal({
            totalXp, totalGold, drops, levelUps, tapDropId, bossUnlock, actTransition, isGameComplete,
          }));
        } else {
          this._showVictoryModal({ totalXp, totalGold, drops, levelUps, tapDropId, bossUnlock, actTransition, isGameComplete });
        }
      }).catch(() => {
        this._showVictoryModal({ totalXp, totalGold, drops, levelUps, tapDropId, bossUnlock, actTransition, isGameComplete });
      });
      return; // modal shown asynchronously above
    }

    // Non-boss path: show modal immediately.
    this._showVictoryModal({ totalXp, totalGold, drops, levelUps, tapDropId, bossUnlock, actTransition, isGameComplete });
  }

  /**
   * M307 — Build and attach the standard victory modal.
   * Extracted from _victory() so the boss cinematic can call it on dismiss.
   */
  _showVictoryModal({ totalXp, totalGold, drops, levelUps, tapDropId, bossUnlock, actTransition, isGameComplete }) {
    // M367 fix: prevent the modal from rendering twice. Guard against repeated
    // calls (e.g. boss cinematic + per-round victory check + deferred resume
    // path all racing). Also remove any pre-existing .cbt-end-modal in the
    // DOM before creating the new one.
    if (this._endModalShown) return;
    this._endModalShown = true;
    // M412 — fire achievement check on every combat victory so achievements
    // (boss-slayer, level-up, fame, gold, etc.) actually unlock during play
    // instead of only when the player visits the tavern.
    try {
      import('./AchievementsScreen.js').then(m => {
        try { m.checkGameStateAchievements?.(); } catch (_) {}
      }).catch(() => {});
    } catch (_) {}
    if (this._el) {
      this._el.querySelectorAll('.cbt-end-modal').forEach(n => n.remove());
    }
    // If another screen (e.g. AchievementsScreen) is ahead of CombatScreen on
    // the stack, defer the modal until onResume() fires instead of popping up
    // over the achievements overlay.
    const stackTop = this.manager?._stack[this.manager._stack.length - 1];
    if (stackTop && stackTop !== this) {
      this._endModalShown = false; // allow onResume to render once
      this._deferredVictory = { totalXp, totalGold, drops, levelUps, tapDropId, bossUnlock, actTransition, isGameComplete };
      return;
    }
    const modal = createEl('div', 'cbt-end-modal');
    modal.innerHTML = `
      <div class="cem-box">
        <div class="cem-title" style="color:#e8a020">Victory!</div>
        <div class="cem-rewards">
          <div class="cer"><span>XP</span><strong>+${totalXp}</strong></div>
          <div class="cer"><span>Gold</span><strong>+${totalGold}</strong></div>
          ${drops.length ? `<div class="cer" style="grid-column:1/-1;flex-direction:column;align-items:center;gap:6px"><span style="font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;color:#a89788">Items Found</span><strong style="display:flex;flex-direction:column;gap:3px;text-align:center;align-items:center;width:100%">${drops.map(d=>{const c=(RARITY_COLORS && RARITY_COLORS[d.rarity]) || `var(--rarity-${d.rarity || 'normal'}, #f0e8d8)`;return `<span style="color:${c}">${d.name}</span>`;}).join('')}</strong></div>` : ''}
          ${levelUps.length ? `<div class="cer" style="grid-column:1/-1;color:#e8a020">${levelUps.map(u=>`${u.name} reached Level ${u.level}!${u.catchUpMult > 1 ? ` <span style="color:#60c8e0;font-size:0.78em">(${u.catchUpMult.toFixed(1)}x catch-up)</span>` : ''}`).join(' ')}</div>` : ''}
          ${tapDropId ? `<div class="cer" style="grid-column:1/-1;color:#e8a040;font-weight:700">&#10022; Tap Weapon obtained: ${TAP_ALL[tapDropId]?.name || tapDropId}</div>` : ''}
          ${(() => {
            // M405 — when an act transition AND a zone unlock fire together,
            // collapse them into a single "Act N: Zone Name — unlocked!" line
            // so the modal stops listing the same advancement twice.
            if (actTransition && bossUnlock) {
              const zoneLabel = bossUnlock.replace(/\s*unlocked!\s*$/i, '').trim();
              return `<div class="cer" style="grid-column:1/-1;color:#e8d020;font-size:0.9rem;font-family:'Cinzel',serif;font-weight:700">&#10022; Act ${actTransition}: ${zoneLabel} &mdash; unlocked!</div>`;
            }
            const out = [];
            if (bossUnlock) out.push(`<div class="cer" style="grid-column:1/-1;color:#60c0ff;font-weight:700">&#10022; ${bossUnlock}</div>`);
            if (actTransition) out.push(`<div class="cer" style="grid-column:1/-1;color:#e8d020;font-size:0.85rem;font-family:'Cinzel',serif;font-weight:700">Act ${actTransition} Unlocked!</div>`);
            return out.join('');
          })()}
          ${isGameComplete ? `<div class="cer" style="grid-column:1/-1;color:#e8d020;font-size:0.9rem;font-family:'Cinzel',serif">&#10022; The Architect is defeated. Reality is restored. &#10022;</div>` : ''}
        </div>
        ${isGameComplete ? `
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <button type="button" class="cem-btn" id="cem-continue">Continue</button>
            <button type="button" class="cem-btn" id="cem-ngplus" style="border-color:rgba(232,208,32,0.5);color:#e8d020">New Game+ &#10022;</button>
          </div>
          <button type="button" class="cem-btn" id="cem-viewlog" style="margin-top:0.4rem;background:transparent;border-color:rgba(240,232,216,0.2)">View Combat Log</button>
          <button type="button" class="cem-btn" id="cem-viewreport" style="margin-top:0.4rem;background:transparent;border-color:rgba(184,127,255,0.35);color:#b87fff">Combat Report</button>
        ` : `<button type="button" class="cem-btn" id="cem-continue">Continue</button>
             <button type="button" class="cem-btn" id="cem-viewlog" style="margin-top:0.4rem;background:transparent;border-color:rgba(240,232,216,0.2)">View Combat Log</button>
             <button type="button" class="cem-btn" id="cem-viewreport" style="margin-top:0.4rem;background:transparent;border-color:rgba(184,127,255,0.35);color:#b87fff">Combat Report</button>`}
      </div>
    `;
    modal.querySelector('#cem-continue').addEventListener('click', () => {
      this.audio.playSfx('click');
      const gs2 = GameState.get();
      const hasPending = [...gs2.party, ...(gs2.companions || [])].some(m => m && m._lastLevelUp);
      // If a new zone was unlocked, auto-advance to it
      if (bossUnlock && this.encounter._zoneId) {
        const nextZone = ZONE_UNLOCK_MAP[this.encounter._zoneId];
        if (nextZone) {
          gs2.zoneId = nextZone;
          const _nz = _ALL_ZONES_CS.find(z => z.id === nextZone);
          const _firstId = _nz?.nodes[0]?.id ?? null;
          gs2.nodeId = _firstId;
          if (_firstId) {
            GameState.visitNode(_firstId);
            GameState.setZoneNode(nextZone, _firstId);
          }
        }
      }
      this.manager.pop();
      if (hasPending) {
        this.manager.push(new LevelUpScreen(this.manager, this.audio));
      }
    });
    modal.querySelector('#cem-viewlog')?.addEventListener('click', () => this._showCombatLogOverlay());
    modal.querySelector('#cem-viewreport')?.addEventListener('click', () => this._showCombatReportOverlay());
    // M377 — combat-debug parity notice + copy button (only when debug on
    // AND a parity warning fired this fight). The buffer can be 5000+
    // entries so we copy to clipboard rather than dumping into the modal.
    if (combatDebug.enabled && this._lastParityResult && this._lastParityResult.warnings > 0) {
      this._appendCombatDebugNotice(modal);
    }
    modal.querySelector('#cem-ngplus')?.addEventListener('click', () => {
      this.audio.playSfx('ng_plus');
      GameState.startNgPlus();
      this.manager.pop();
    });
    this._el.appendChild(modal);
  }

  /**
   * M307 — Boss-defeat cinematic overlay.
   * Shows 3 lines of dialog over a dark fade+zoom. "Continue" dismisses and
   * calls onDismiss() (which opens the victory modal).
   * Respects reduce-motion: if enabled, skip animation entirely.
   *
   * @param {{ bossLine, heroLine, narratorLine }} dlg
   * @param {Function} onDismiss
   */
  _showBossDeathCinematic(dlg, onDismiss) {
    const reduced = isReducedMotion();
    const overlay = createEl('div', 'boss-death-cinematic');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Boss defeated');
    overlay.innerHTML = `
      <div class="bdc-inner${reduced ? ' bdc-no-anim' : ''}">
        <div class="bdc-skull" aria-hidden="true">&#9760;</div>
        <div class="bdc-lines">
          <p class="bdc-boss-line">${dlg.bossLine}</p>
          <p class="bdc-hero-line">${dlg.heroLine}</p>
          <p class="bdc-narrator-line">${dlg.narratorLine}</p>
        </div>
        <button type="button" class="bdc-continue" id="bdc-continue">Continue</button>
      </div>
    `;
    const dismiss = () => {
      if (overlay._dismissed) return;
      overlay._dismissed = true;
      if (reduced) {
        removeEl(overlay);
        onDismiss();
      } else {
        overlay.classList.add('bdc-fade-out');
        overlay.addEventListener('animationend', () => { removeEl(overlay); onDismiss(); }, { once: true });
        setTimeout(() => { if (!overlay._resolved) { overlay._resolved = true; removeEl(overlay); onDismiss(); } }, 700);
      }
    };
    overlay.querySelector('#bdc-continue').addEventListener('click', () => { this.audio.playSfx('click'); dismiss(); });
    this._el.appendChild(overlay);
    overlay._resolved = false;
  }

  _defeat() {
    this.audio.playSfx('defeat');
    this._stopCombatAudio();
    try { this._lastParityResult = this._runCombatParityCheck('loss'); } catch (_) {}
    try { recordFightEnd(false, this._heroes || []); } catch (_) {}
    // Immediately flush stats to the localStorage cache (defeat path).
    try { flushRunStatsCache(); } catch (_) {}
    try {
      const kind = this.encounter?._bossNodeId ? 'boss'
                 : (this.encounter?._dungeonStage != null ? 'dungeon' : 'regular');
      const dur = Math.max(1, Math.floor((Date.now() - (this._fightStartedAt || Date.now())) / 1000));
      recordFightLog({ kind, zoneId: this.encounter?._zoneId, durationSec: dur, won: false });
    } catch (_) {}
    GameState.setFlag('survived_defeat', true);
    // M304: mark hero death for hidden boss precondition (requireNoDeath)
    GameState.setFlag('hero_died_in_act', true);
    const gs = GameState.get();
    // M280 — Hardcore: party wipe locks the run. Save isn't deleted; it's
    // marked RIP so the player can still view the dead party + items + stats.
    // The MapScreen / TownScreen / LoadScreen treat rip saves as read-only.
    if (gs.hardcore && !gs.rip) {
      gs.rip = { date: Date.now(), zoneId: gs.zoneId, nodeId: gs.nodeId, finalParty: (gs.party || []).map(p => ({ id: p.id, name: p.name, level: p.level || 1, class: p.cls || p.class, appearance: p.appearance })), finalGold: gs.gold || 0 };
      try {
        // Lazy import so hardcore non-users don't pay the cost.
        import('../../game/stats.js').then(m => { try { m.recordHardcoreDeath(); m.archiveCurrentRun(`RIP — ${gs.zoneId}`); } catch (_) {} });
      } catch (_) {}
      // M298: record to fallen-heroes log for monument display
      try {
        const hero = gs.party?.[0] || {};
        const ACT_MAP = { border_roads: 1, dust_roads: 2, hell_breach: 3, cosmic_rift: 4, dragon_reach: 5, dragon_throne: 6 };
        const act = ACT_MAP[gs.zoneId] || gs.act || 1;
        const fallenEntry = {
          heroName: hero.name || 'Unknown',
          className: hero.class || 'Hero',
          level: hero.level || 1,
          act,
          savedSlot: gs.currentSaveKey || null,
          finalStats: { gold: gs.gold || 0, party: gs.party?.length || 1, fame: gs.fame || 0 },
          deathDate: new Date().toISOString(),
        };
        const existing = JSON.parse(localStorage.getItem('emberveil.fallenHeroes') || '[]');
        existing.push(fallenEntry);
        localStorage.setItem('emberveil.fallenHeroes', JSON.stringify(existing));
      } catch (_) {}
      try { import('../../engine/SaveManager.js').then(({ SaveManager }) => SaveManager.saveCurrentGame(gs.currentSaveKey)); } catch (_) {}
    }
    const penalty = Math.floor(GameState.getGold() * 0.1);
    GameState.addGold(-penalty);
    // M46 — TPK softlock fix: revive party to FULL HP so they can leave town.
    // M273: prefer recomputed maxHp/Mp over stored fields (which may be stale
    // after a level-up or gear swap), with a small fallback for safety.
    const safeMaxHp = (m) => m.maxHp || (() => { try { return computeMaxHp(m); } catch { return 50; } })();
    const safeMaxMp = (m) => m.maxMp || (() => { try { return computeMaxMp(m); } catch { return 30; } })();
    gs.party.forEach(m => { m.hp = safeMaxHp(m); m.mp = safeMaxMp(m); });
    (gs.companions || []).forEach(m => { m.hp = safeMaxHp(m); m.mp = safeMaxMp(m); });
    // M65+ TPK fix: route back to the nearest town zone+node so the map has a
    // valid party position. Previously we only nulled nodeId, which left the
    // party stranded in boss zones (e.g. Bahamoth's lair) with no clickable
    // nodes and no visible party token.
    const nearest = findNearestTown(gs.zoneId, gs.nodeId);
    if (nearest) {
      gs.zoneId = nearest.zoneId;
      gs.nodeId = nearest.nodeId;
      GameState.setZoneNode(nearest.zoneId, nearest.nodeId);
    } else {
      gs.nodeId = null;
    }
    if (gs.partyDefeated) gs.partyDefeated = false;
    if (gs.combatLocked) gs.combatLocked = false;

    // M367 fix: same guard as victory — prevent double-render of the defeat modal.
    if (this._endModalShown) return;
    this._endModalShown = true;
    if (this._el) {
      this._el.querySelectorAll('.cbt-end-modal').forEach(n => n.remove());
    }

    const modal = createEl('div', 'cbt-end-modal');
    modal.innerHTML = `
      <div class="cem-box">
        <div class="cem-title" style="color:#c04030">Defeated</div>
        <div class="cem-body">Your party has fallen. You are returned to Emberglen to recover.</div>
        ${penalty > 0 ? `<div style="color:#8a7a6a;font-size:0.78rem;margin-bottom:1rem">Gold lost: ${penalty}</div>` : ''}
        <button type="button" class="cem-btn" id="cem-return" style="border-color:rgba(192,64,48,0.5);color:#c04030">Return to Town</button>
        <button type="button" class="cem-btn" id="cem-viewlog" style="margin-top:0.4rem;background:transparent;border-color:rgba(240,232,216,0.2)">View Combat Log</button>
        <button type="button" class="cem-btn" id="cem-viewreport" style="margin-top:0.4rem;background:transparent;border-color:rgba(184,127,255,0.35);color:#b87fff">Combat Report</button>
      </div>
    `;
    modal.querySelector('#cem-return').addEventListener('click', () => {
      this.audio.playSfx('click');
      // M116: Route directly to TownScreen instead of popping to the map.
      // The map state has already been restored to the nearest town above,
      // so the overworld is coherent when the player next opens the map.
      this.manager.replace(new TownScreen(this.manager, this.audio, null, false));
    });
    // M268: combat log + report buttons on defeat too.
    modal.querySelector('#cem-viewreport')?.addEventListener('click', () => this._showCombatReportOverlay());
    modal.querySelector('#cem-viewlog')?.addEventListener('click', () => this._showCombatLogOverlay());
    // M377 — combat-debug parity notice + copy button (defeat path).
    if (combatDebug.enabled && this._lastParityResult && this._lastParityResult.warnings > 0) {
      this._appendCombatDebugNotice(modal);
    }
    this._el.appendChild(modal);
  }

  /**
   * M377 — Inserts a small parity-mismatch notice + Copy button into a
   * given combat end modal.
   * Seam 4: delegated to combat/combatEndUI.js.
   */
  _appendCombatDebugNotice(modal) { _appendCombatDbgNotice(modal); }

  // M268: extracted combat-log overlay so both victory and defeat can share it.
  // Seam 4: delegated to combat/combatEndUI.js.
  _showCombatLogOverlay() { _showCombatLog(this); }

  // M274: parallax-layer builder extracted to _backgroundRenderer.js. Thin
  // wrapper preserves the existing call signature so _drawParallaxLayers
  // doesn't need to change.
  _buildParallaxLayer(kind, w, h, groundY, pal, zone) {
    return buildParallaxLayer(kind, w, h, groundY, pal, zone);
  }

  _drawParallaxLayers(ctx, w, h, groundY, pal, zone) {
    // M296: skip parallax drift when reduce-motion is active; still draw static layers
    const _reduceMotion = isReducedMotion();
    const key = `${zone}:${Math.floor(w)}x${Math.floor(h)}`;
    if (!this._parallaxCache || this._parallaxCache.key !== key) {
      this._parallaxCache = {
        key,
        far: this._buildParallaxLayer('far', w, h, groundY, pal, zone),
        mid: this._buildParallaxLayer('mid', w, h, groundY, pal, zone),
        near: this._buildParallaxLayer('near', w, h, groundY, pal, zone),
      };
    }
    const t = _reduceMotion ? 0 : (this._t || 0);
    // Ambient drift speeds (px/s). Back layer slowest.
    const speeds = { far: 3, mid: 9, near: 22 };
    // Subtle vertical bob via sin for organic feel (suppressed in reduce-motion)
    const bob = _reduceMotion ? 0 : Math.sin(t * 0.4) * 1.2;
    for (const k of ['far', 'mid', 'near']) {
      const layer = this._parallaxCache[k];
      if (!layer) continue;
      let ox = (t * speeds[k]) % w;
      if (ox < 0) ox += w;
      const dy = k === 'far' ? bob : (k === 'mid' ? bob * 0.5 : 0);
      ctx.globalAlpha = k === 'far' ? 0.55 : (k === 'mid' ? 0.75 : 1);
      // Seamless wrap: draw twice
      ctx.drawImage(layer, -ox, dy);
      ctx.drawImage(layer, w - ox, dy);
      ctx.globalAlpha = 1;
    }
  }

  _drawBackground(ctx, w, h) {
    // M434: EvBattlefield's DOM bg layer is gone, so canvas always paints
    // its own background (solid fill / zone art / palette). The previous
    // uiOverhaul early-return left a transparent canvas over an SVG that
    // no longer mounts.
    // M447 — groundY now lives ABOVE the bottom HUD instead of at a fixed
    // 85% of canvas. Previously the .ev-hud (party frames + spell rail at
    // bottom:0) painted over the canvas's bottom 15-20%, which meant the
    // front-row enemies and companions were rendering BEHIND the hud panel.
    // Compute the hud's height in canvas pixels and subtract it from the
    // groundY so the front row clears the panel cleanly.
    const groundYBase = (() => {
      const FALLBACK = h * 0.85;
      try {
        const canvas = this.manager?.canvas;
        const evHud = this._el?.querySelector('#ev-hud');
        if (!canvas || !evHud) return FALLBACK;
        const rect = canvas.getBoundingClientRect();
        const hudH = evHud.getBoundingClientRect().height || 0;
        if (!hudH || !rect.height) return FALLBACK;
        const canvasPxPerCss = canvas.height / rect.height;
        const hudCanvasPx = hudH * canvasPxPerCss;
        // Reserve the hud height + 6 canvas-px breathing room. Clamp so the
        // sky band always has at least 40% of canvas height.
        return Math.max(h * 0.40, h - hudCanvasPx - 6);
      } catch (_) { return FALLBACK; }
    })();
    if (window.__gfxDisableBg || GameState.get()?.settings?.disableTextures) {
      ctx.fillStyle = '#050208';
      ctx.fillRect(0, 0, w, h);
      this._groundY = groundYBase;
      return;
    }
    const zone = this.encounter.zoneId || 'border_roads';
    const groundY = groundYBase;

    const ZONE_PALETTES = {
      border_roads:  { sky: ['#0c0e14','#151c24','#1a2830'], ground: '#0a1018', grass: 'rgba(60,90,120,0.3)', star: true },
      thornwood:     { sky: ['#040a06','#081208','#0a1a0a'], ground: '#060e06', grass: 'rgba(20,80,20,0.4)', star: false, fog: 'rgba(20,60,20,0.08)' },
      dust_roads:    { sky: ['#1a0e06','#280e04','#3a1c08'], ground: '#1c1008', grass: 'rgba(160,80,20,0.3)', star: true, embers: true },
      ember_plateau: { sky: ['#280404','#3c0c04','#5a1408'], ground: '#200808', grass: 'rgba(200,40,10,0.3)', star: false, embers: true, glow: '#c04020' },
      hell_breach:   { sky: ['#1a0000','#300408','#480010'], ground: '#140004', grass: 'rgba(160,0,20,0.4)', star: false, embers: true, glow: '#c00820', lava: true },
      shattered_core:{ sky: ['#0a0014','#180028','#280040'], ground: '#08000e', grass: 'rgba(120,0,200,0.3)', star: true, embers: true, glow: '#6020c0', lava: false },
      cosmic_rift:   { sky: ['#000010','#000828','#001040'], ground: '#000008', grass: 'rgba(0,80,200,0.25)', star: true, embers: true, glow: '#0040ff', lava: false },
      eternal_void:  { sky: ['#000000','#040004','#080014'], ground: '#000000', grass: 'rgba(80,0,180,0.2)', star: true, embers: true, glow: '#4000c0', lava: false },
      abyssal_depths:   { sky: ['#000408','#001020','#002040'], ground: '#000810', grass: 'rgba(0,80,160,0.3)', star: false, embers: true, glow: '#0060c0', lava: false },
      primordial_nexus: { sky: ['#100008','#200018','#380028'], ground: '#0a0008', grass: 'rgba(200,0,120,0.3)', star: true, embers: true, glow: '#c00080', lava: false },
    };
    const pal = ZONE_PALETTES[zone] || ZONE_PALETTES.border_roads;

    // M65: zone-specific combat background image (if available).
    // Respects the "Disable Backgrounds" setting via __gfxDisableBg (handled above).
    // Falls back to procedural sky + parallax when no image is wired for the zone.
    const bgImg = _getCombatBgImage(zone);
    if (bgImg) {
      // Stretch to full canvas; art is 16:9ish but canvas is portrait — cover.
      try {
        ctx.drawImage(bgImg, 0, 0, w, h);
        logImage('combat-bg', { entityId: zone, pose: 'bg', file: bgImg.src, x: 0, y: 0, w, h });
      }
      catch { /* draw before decode */ }
      // M178: removed 22% black overlay — it only covered the canvas area
      // (not the HUD strip below) which made a visible seam. HUD has its
      // own background; sprites read fine against the raw art.
    } else {
      // Procedural sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, pal.sky[0]);
      sky.addColorStop(0.5, pal.sky[1]);
      sky.addColorStop(1, pal.sky[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Multi-layer parallax: distant mountains, mid hills, foreground debris.
      // Uses Math.sin-based ambient drift (no combat camera); layers cached off-screen.
      this._drawParallaxLayers(ctx, w, h, groundY, pal, zone);
    }

    // Stars for dark zones — skip when painted BG is in use.
    if (!bgImg && pal.star) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137.5 + zone.charCodeAt(0) * 7) % w);
        const sy = ((i * 97 + zone.charCodeAt(1) * 13) % (groundY * 0.8));
        ctx.beginPath();
        ctx.arc(sx, sy, i % 3 === 0 ? 1 : 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Zone-specific silhouette features — skipped when painted BG is in use.
    if (bgImg) { /* painted BG supplies silhouettes */ } else if (zone === 'thornwood') {
      // Dark tree silhouettes
      ctx.fillStyle = '#020804';
      for (let i = 0; i < 7; i++) {
        const tx = (i / 6) * w;
        const th = 60 + (i * 37 % 40);
        ctx.beginPath();
        ctx.moveTo(tx, groundY);
        ctx.lineTo(tx - 18, groundY - th * 0.5);
        ctx.lineTo(tx, groundY - th);
        ctx.lineTo(tx + 18, groundY - th * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    } else if (zone === 'ember_plateau' || zone === 'dust_roads') {
      // Rocky mesa silhouettes
      ctx.fillStyle = '#0e0604';
      for (let i = 0; i < 4; i++) {
        const rx = (i / 3.5) * w - 20;
        const rw = 60 + i * 20;
        const rh = 30 + i * 15;
        ctx.fillRect(rx, groundY - rh, rw, rh);
      }
    } else if (zone === 'hell_breach' || zone === 'shattered_core') {
      // Jagged spire silhouettes
      ctx.fillStyle = pal.sky[0];
      for (let i = 0; i < 5; i++) {
        const spx = (i / 4.5) * w;
        const sph = 80 + i * 20;
        ctx.beginPath();
        ctx.moveTo(spx - 12, groundY);
        ctx.lineTo(spx, groundY - sph);
        ctx.lineTo(spx + 12, groundY);
        ctx.closePath();
        ctx.fill();
      }
      // Lava glow at horizon for hell zones
      if (pal.lava || zone === 'ember_plateau') {
        const glow = ctx.createLinearGradient(0, groundY - 30, 0, groundY);
        glow.addColorStop(0, 'transparent');
        glow.addColorStop(1, pal.glow ? pal.glow + '88' : 'rgba(200,40,0,0.4)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, groundY - 30, w, 30);
      }
    }

    // Fog for thornwood — skipped when painted BG is in use.
    if (!bgImg && pal.fog) {
      ctx.fillStyle = pal.fog;
      ctx.fillRect(0, groundY - 20, w, 20);
    }

    // Ground — skipped when painted BG is in use (the art includes its own ground).
    if (!bgImg) {
      ctx.fillStyle = pal.ground;
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.fillStyle = pal.grass;
      ctx.fillRect(0, groundY, w, 2);
    }

    // Embers/particles ambient for hot zones
    if (pal.embers) {
      ctx.fillStyle = pal.glow ? pal.glow + 'aa' : 'rgba(220,80,20,0.7)';
      for (let i = 0; i < 12; i++) {
        const ex = ((this._t * (20 + i * 7) + i * w / 12) % w);
        const ey = groundY - 10 - ((this._t * (30 + i * 11) + i * 40) % (groundY * 0.7));
        ctx.beginPath();
        ctx.arc(ex, ey, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this._groundY = groundY;

    // Weather overlay
    this._drawWeather(ctx, w, h, zone);
  }

  _drawWeather(ctx, w, h, zone) {
    const t = this._t;
    if (zone === 'border_roads') {
      // Light rain
      ctx.strokeStyle = 'rgba(120,160,200,0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 25; i++) {
        const rx = ((i * 173 + t * 80) % w);
        const ry = ((i * 97 + t * 180) % h);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 10);
        ctx.stroke();
      }
    } else if (zone === 'thornwood') {
      // Drifting fog wisps
      ctx.fillStyle = 'rgba(30,80,30,0.06)';
      for (let i = 0; i < 4; i++) {
        const fx = ((i * 200 + t * 12) % (w + 200)) - 100;
        const fy = h * 0.55 + Math.sin(t * 0.3 + i) * 20;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 120, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (zone === 'dust_roads' || zone === 'ember_plateau') {
      // Ash particles drifting left
      ctx.fillStyle = 'rgba(180,140,80,0.35)';
      for (let i = 0; i < 20; i++) {
        const ax = ((i * 137 - t * 30 + w * 2) % w);
        const ay = ((i * 79 + t * 10) % (h * 0.6));
        ctx.beginPath();
        ctx.arc(ax, ay, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (zone === 'hell_breach' || zone === 'shattered_core') {
      // Void sparks / floating dark motes
      const color = zone === 'shattered_core' ? 'rgba(160,60,240,0.5)' : 'rgba(240,40,20,0.4)';
      ctx.fillStyle = color;
      for (let i = 0; i < 18; i++) {
        const vx = ((i * 157 + Math.sin(t * 0.5 + i) * 30) % w);
        const vy = ((i * 113 - t * 15 + h) % h);
        ctx.beginPath();
        ctx.arc(vx, vy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  draw(ctx) {
    const w = this.manager.width;
    const h = this.manager.height;

    this._drawTapHudIcons();

    // Zone-specific background
    this._drawBackground(ctx, w, h);

    // Divider line
    ctx.strokeStyle = 'rgba(232,160,32,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    const groundY = this._groundY || h * 0.85;
    ctx.moveTo(w / 2, 40);
    ctx.lineTo(w / 2, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ─── M435: combat layout via computeCombatLayout (extracted module) ────
    const _ds = getCombatDebugSettings();
    const _isMobileVp = !!(typeof window !== 'undefined' && window.innerWidth && window.innerWidth <= 700);
    const heroes = this._heroes || [];
    const companions = this._companions || [];
    const enemyGroups = (this._enemyGroups || []).filter(g => g && g.length);
    const hasCompanions = companions.length > 0;

    const layout = computeCombatLayout({
      w, h, groundY,
      placementPct: _ds.placement || { x:0,y:0,w:0,h:0 },
      characterScale: Number.isFinite(_ds.characterScale) ? _ds.characterScale : 1,
      companionScale: Number.isFinite(_ds.companionScale) ? _ds.companionScale : 1,
      enemyScale:     Number.isFinite(_ds.enemyScale)     ? _ds.enemyScale     : 1,
      bossScale:      Number.isFinite(_ds.bossScale)      ? _ds.bossScale      : 1,
      isMobile: _isMobileVp,
      heroes, companions, enemyGroups,
    });
    const scale = layout.scale;

    // Apply placements onto the live unit objects.
    const _byId = new Map();
    for (const p of layout.placements) _byId.set(p.id, p);
    const applyPlacement = (u) => {
      const p = _byId.get(u.id);
      if (!p) return;
      u.x = p.x; u.y = p.y; u._drawScale = p._drawScale;
    };
    heroes.forEach(applyPlacement);
    companions.forEach(applyPlacement);
    enemyGroups.forEach(g => g.forEach(applyPlacement));

    // ─── M434: per-unit isometric position tiles ───────────────────────────
    // One diamond per live combatant, centered on (u.x, u.y). Hero=gold,
    // companion=cyan, enemy=red. Targeting mode pulses valid enemy tiles
    // green and glows the casting hero's tile.
    const drawTileUnder = (u, role) => {
      if (!u.alive && u.stance !== 'death') return;
      const tw = Math.max(28, 60 * (u._drawScale || scale));
      const th = tw * 0.45;
      const tx = u.x;
      const ty = u.y;
      let stroke, fill;
      if (role === 'hero')      { stroke = 'rgba(232,160,32,0.85)'; fill = 'rgba(232,160,32,0.10)'; }
      else if (role === 'comp') { stroke = 'rgba( 60,200,232,0.85)'; fill = 'rgba( 60,200,232,0.10)'; }
      else                      { stroke = 'rgba(192, 64, 48,0.85)'; fill = 'rgba(192, 64, 48,0.10)'; }
      if (this._targetingActive) {
        if (role !== 'hero' && u.alive) {
          const pulse = 0.5 + 0.5 * Math.sin((this._t || 0) * 4);
          stroke = `rgba(120,255,120,${0.55 + 0.35 * pulse})`;
          fill   = `rgba(120,255,120,${0.10 + 0.18 * pulse})`;
        } else if (this._targetingSourceId && u.id === this._targetingSourceId) {
          stroke = 'rgba(255,220,120,0.95)';
          fill   = 'rgba(255,220,120,0.18)';
        }
      }
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx,           ty - th * 0.5);
      ctx.lineTo(tx + tw * 0.5, ty);
      ctx.lineTo(tx,           ty + th * 0.5);
      ctx.lineTo(tx - tw * 0.5, ty);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    heroes.forEach(u => drawTileUnder(u, 'hero'));
    if (hasCompanions) companions.forEach(u => drawTileUnder(u, 'comp'));
    enemyGroups.forEach(g => g.forEach(u => drawTileUnder(u, 'enemy')));

    const allUnits = [...this._heroes, ...this._companions, ...this._allEnemies];

    // Draw all units sorted by Y (lower Y first = further back, higher Y = in front)
    allUnits.sort((a, b) => a.y - b.y);
    for (const u of allUnits) this._drawUnit(ctx, u);

    // Particles
    ctx.save();
    for (const p of this._particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    // M72/M76: tap effects overlay
    if (this._tapEffects?.length) {
      ctx.save();
      for (const fx of this._tapEffects) {
        ctx.shadowBlur = 20; ctx.shadowColor = fx.color;
        // Legacy fly/burst
        if (fx.phase === 'fly') {
          const p = Math.min(1, fx.t / fx.dur);
          const x = fx.from.x + (fx.to.x - fx.from.x) * p;
          const y = fx.from.y + (fx.to.y - fx.from.y) * p;
          ctx.fillStyle = fx.color;
          ctx.beginPath(); ctx.arc(x, y, fx.size, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.4;
          ctx.beginPath(); ctx.arc(fx.from.x + (fx.to.x - fx.from.x) * p * 0.85, fx.from.y + (fx.to.y - fx.from.y) * p * 0.85, fx.size * 0.7, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        if (fx.phase === 'burst') {
          const p = fx.t / fx.burst.life;
          const r = 14 + p * 90;
          ctx.globalAlpha = (1 - p) * 0.9;
          ctx.fillStyle = fx.color;
          ctx.beginPath(); ctx.arc(fx.to.x, fx.to.y, r * 0.45 * (1 - p), 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1 - p;
          ctx.strokeStyle = fx.color; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(fx.to.x, fx.to.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(fx.to.x, fx.to.y, r * 0.65, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            ctx.fillStyle = fx.color;
            ctx.beginPath(); ctx.arc(fx.to.x + Math.cos(a) * r, fx.to.y + Math.sin(a) * r, 5 * (1 - p), 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          continue;
        }
        // M76 typed particles
        const delay = fx.delay || 0;
        if (fx.t < delay) continue;
        const lt = fx.t - delay;
        const lifeMax = fx.life || 0.5;
        const p = Math.min(1, lt / lifeMax);
        const fade = 1 - p;
        ctx.globalAlpha = fade;

        const drawArrow = (x, y, ang, len, col) => {
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len * 0.85, 0); ctx.stroke();
          // Head
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len * 0.82, -5); ctx.lineTo(len * 0.82, 5); ctx.closePath(); ctx.fill();
          // Fletching (3 chevrons)
          ctx.strokeStyle = '#c86030'; ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const fx0 = -len + i * 5;
            ctx.beginPath(); ctx.moveTo(fx0, 0); ctx.lineTo(fx0 - 5, -4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fx0, 0); ctx.lineTo(fx0 - 5, 4); ctx.stroke();
          }
          ctx.restore();
        };

        if (fx.type === 'sprite') {
          // M78: pixel-art tap fx sprite (layered with canvas effects)
          const img = fx.sprite;
          if (img && img._ready && img.width) {
            const px = fx.x0 + (fx.x1 - fx.x0) * p;
            const py = fx.y0 + (fx.y1 - fx.y0) * p;
            const sc = fx.scale || 1.5;
            const w = img.width * sc;
            const h = img.height * sc;
            ctx.save();
            ctx.translate(px, py);
            if (fx.rot) ctx.rotate(Math.atan2(fx.y1 - fx.y0, fx.x1 - fx.x0));
            ctx.globalAlpha = fade;
            ctx.imageSmoothingEnabled = false;
            try { ctx.drawImage(img, -w / 2, -h / 2, w, h); } catch (_) {}
            ctx.restore();
          }
          continue;
        }
        if (fx.type === 'slash') {
          ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.rot || 0);
          const len = fx.len || 60;
          const grad = ctx.createLinearGradient(-len, 0, len, 0);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.5, '#ffffff');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = grad; ctx.lineWidth = 6 * fade; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0); ctx.stroke();
          ctx.strokeStyle = '#d8e0f0'; ctx.lineWidth = 2 * fade;
          ctx.beginPath(); ctx.moveTo(-len * 0.8, 0); ctx.lineTo(len * 0.8, 0); ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'spark') {
          ctx.fillStyle = fx.color;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, (fx.size || 3) * fade, 0, Math.PI * 2); ctx.fill();
        } else if (fx.type === 'dust') {
          ctx.globalAlpha = fade * 0.6;
          ctx.fillStyle = fx.color || '#b8a882';
          ctx.beginPath(); ctx.arc(fx.x, fx.y, (fx.size || 4) * (1 + p * 0.8), 0, Math.PI * 2); ctx.fill();
        } else if (fx.type === 'ring') {
          const r = (fx.r0 || 8) + ((fx.r1 || 60) - (fx.r0 || 8)) * p;
          ctx.strokeStyle = fx.color; ctx.lineWidth = 4 * fade;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (fx.type === 'arrow') {
          const x = fx.x0 + (fx.x1 - fx.x0) * p;
          // Gentle arc
          const arc = Math.sin(p * Math.PI) * -40;
          const y = fx.y0 + (fx.y1 - fx.y0) * p + arc;
          const ang = Math.atan2((fx.y1 - fx.y0) + Math.cos(p * Math.PI) * -80, (fx.x1 - fx.x0));
          drawArrow(x, y, ang, 26, fx.color || '#e8d9a8');
        } else if (fx.type === 'knife') {
          const x = fx.x0 + (fx.x1 - fx.x0) * p;
          const y = fx.y0 + (fx.y1 - fx.y0) * p;
          ctx.save(); ctx.translate(x, y); ctx.rotate(lt * 18);
          ctx.fillStyle = '#d8dce4';
          ctx.fillRect(-11, -2, 17, 4);
          ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(13, 0); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-13, -2.5, 3, 5);
          ctx.restore();
        } else if (fx.type === 'boulder') {
          const x = fx.x0 + (fx.x1 - fx.x0) * p;
          const y = fx.y0 + (fx.y1 - fx.y0) * p;
          ctx.save(); ctx.translate(x, y); ctx.rotate(lt * 10);
          ctx.fillStyle = '#6a5a44';
          ctx.beginPath(); ctx.arc(0, 0, fx.size, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#4a3a28';
          ctx.beginPath(); ctx.arc(-6, 4, 6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(8, -3, 4, 0, Math.PI * 2); ctx.fill();
          // Moss hints
          ctx.fillStyle = '#486030';
          ctx.beginPath(); ctx.arc(-3, -8, 3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else if (fx.type === 'star') {
          const x = fx.x0 + (fx.x1 - fx.x0) * p;
          const y = fx.y0 + (fx.y1 - fx.y0) * p;
          ctx.save(); ctx.translate(x, y); ctx.rotate(lt * 14);
          const rO = fx.size, rI = fx.size * 0.42;
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rO * 1.2);
          g.addColorStop(0, '#ffffe0'); g.addColorStop(0.5, '#ffd060'); g.addColorStop(1, 'rgba(255,120,20,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? rO : rI;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            const px = Math.cos(a) * r, py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 30; ctx.shadowColor = '#ffd060'; ctx.fill();
          ctx.restore();
          // Trail
          for (let i = 1; i <= 5; i++) {
            const tp = Math.max(0, p - i * 0.04);
            const tx = fx.x0 + (fx.x1 - fx.x0) * tp;
            const ty = fx.y0 + (fx.y1 - fx.y0) * tp;
            ctx.globalAlpha = fade * (1 - i * 0.18);
            ctx.fillStyle = '#ffd060';
            ctx.beginPath(); ctx.arc(tx, ty, fx.size * (0.6 - i * 0.09), 0, Math.PI * 2); ctx.fill();
          }
        } else if (fx.type === 'fireball') {
          const x = fx.x0 + (fx.x1 - fx.x0) * p;
          const y = fx.y0 + (fx.y1 - fx.y0) * p;
          const g = ctx.createRadialGradient(x, y, 0, x, y, fx.size * 1.2);
          g.addColorStop(0, '#fff4a0'); g.addColorStop(0.45, '#ff8030'); g.addColorStop(1, 'rgba(80,10,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, fx.size * 1.2, 0, Math.PI * 2); ctx.fill();
          // trail
          for (let i = 1; i <= 6; i++) {
            const tp = Math.max(0, p - i * 0.05);
            const tx = fx.x0 + (fx.x1 - fx.x0) * tp;
            const ty = fx.y0 + (fx.y1 - fx.y0) * tp;
            ctx.globalAlpha = fade * (1 - i * 0.15);
            ctx.fillStyle = i < 3 ? '#ffb040' : '#ff6020';
            ctx.beginPath(); ctx.arc(tx, ty, fx.size * (0.7 - i * 0.09), 0, Math.PI * 2); ctx.fill();
          }
        } else if (fx.type === 'dragon') {
          const x = fx.x0 + (fx.x1 - fx.x0) * p;
          const y = fx.y0 + (fx.y1 - fx.y0) * p + Math.sin(p * Math.PI * 2) * 15;
          ctx.save(); ctx.translate(x, y);
          ctx.fillStyle = '#601818';
          // Body
          ctx.beginPath(); ctx.ellipse(0, 0, 40, 10, 0, 0, Math.PI * 2); ctx.fill();
          // Head
          ctx.beginPath(); ctx.ellipse(36, -4, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
          // Wings (flapping)
          const flap = Math.sin(lt * 14) * 18;
          ctx.beginPath();
          ctx.moveTo(-10, -2); ctx.quadraticCurveTo(-20, -30 + flap, -40, -10 + flap); ctx.quadraticCurveTo(-15, -6, -10, -2); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(10, -2); ctx.quadraticCurveTo(0, -30 + flap, -20, -10 + flap); ctx.quadraticCurveTo(5, -6, 10, -2); ctx.fill();
          // Tail
          ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-60, -4); ctx.lineTo(-30, 4); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else if (fx.type === 'lightning') {
          // Jagged bolt from a to b
          ctx.strokeStyle = '#e0f4ff'; ctx.lineWidth = fx.width || 3;
          ctx.shadowBlur = 18; ctx.shadowColor = '#80d0ff';
          ctx.beginPath();
          const a = fx.a, b = fx.b;
          const steps = 8;
          ctx.moveTo(a.x, a.y);
          for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const jx = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 18;
            const jy = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 18;
            ctx.lineTo(jx, jy);
          }
          ctx.lineTo(b.x, b.y); ctx.stroke();
          // Inner white core
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (fx.width || 3) * 0.4;
          ctx.stroke();
        } else if (fx.type === 'hammer') {
          const x = fx.x0 + (fx.x1 - fx.x0) * p;
          const y = fx.y0 + (fx.y1 - fx.y0) * p;
          ctx.save(); ctx.translate(x, y);
          ctx.fillStyle = 'rgba(200,220,255,0.85)';
          ctx.shadowBlur = 24; ctx.shadowColor = '#c0d8ff';
          // Head
          ctx.fillRect(-fx.size * 0.6, -fx.size * 0.6, fx.size * 1.2, fx.size * 0.5);
          // Handle
          ctx.fillStyle = '#8090a8';
          ctx.fillRect(-fx.size * 0.08, -fx.size * 0.1, fx.size * 0.16, fx.size * 0.9);
          ctx.restore();
        } else if (fx.type === 'lance') {
          // Purple piercing line through all targets
          if (fx.targets && fx.targets.length) {
            ctx.strokeStyle = '#c080ff'; ctx.lineWidth = 6 * fade;
            ctx.shadowBlur = 22; ctx.shadowColor = '#a060e0';
            ctx.beginPath();
            ctx.moveTo(fx.x, fx.y);
            for (const tt of fx.targets) ctx.lineTo(tt.x, tt.y);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * fade;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    if (this._tapHint) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this._tapHint.life);
      ctx.font = '700 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffc060';
      ctx.shadowBlur = 8; ctx.shadowColor = '#000';
      ctx.fillText(this._tapHint.text, this.manager.width / 2, 80);
      ctx.restore();
    }

    // Floating damage numbers
    ctx.save();
    for (const d of this._dmgNumbers) {
      const fade = Math.min(d.life / d.maxLife * 2, 1);
      ctx.globalAlpha = fade;
      ctx.font = `700 ${Math.round(14 + fade * 4)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = d.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = d.color;
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    // M220: Combat Debug grid overlay
    if (debug.flags.enabled) {
      this._drawCombatDebugGrid(ctx, w, h);
    }

    // Combat start label — boss fights get a larger, longer cinematic flash
    if (this._phase === 'START') {
      if (this._isBossFight) {
        // M322: canvas BOSS flash removed \u2014 the HTML splash overlay
        // (_showBossIntroSplash) handles the boss intro now. The canvas
        // overlay was rendering underneath the splash and producing a
        // double-overlay effect.
      } else {
        const fade = Math.min(this._t / 0.4, 1) * Math.max(0, 1 - (this._t - 0.6) / 0.4);
        ctx.save();
        ctx.globalAlpha = fade;
        const fs = Math.round(w * 0.055);
        ctx.font = `900 ${fs}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#c04030';
        ctx.fillStyle = '#f0e8d8';
        ctx.fillText(this.encounter.name, w / 2, h * 0.28);
        ctx.restore();
      }
    }
  }

  _drawUnit(ctx, c) {
    try { this._drawUnitInner(ctx, c); } catch (e) { /* silent fallback */ }
  }

  /**
   * M434 — DOM overlay for status-effect particles, anchored to canvas
   * sprite positions. Replaces EvBattlefield.refreshStatusParticles.
   *
   * Strategy: keep one persistent host element above the canvas. Each
   * combatant with at least one renderable status gets a child <div> with
   * a row of <img> particles inside. Position is computed from the
   * canvas's bounding rect + the unit's (x, y, _drawScale) every refresh.
   * No grid coordinates involved.
   */
  _refreshCanvasStatusOverlay() {
    if (!this._el) return;
    const canvas = this.manager?.canvas;
    if (!canvas) return;
    let host = this._statusOverlayEl;
    if (!host) {
      host = document.createElement('div');
      host.className = 'cbt-status-overlay';
      Object.assign(host.style, {
        position: 'absolute', inset: '0',
        pointerEvents: 'none', zIndex: '6',
      });
      this._el.appendChild(host);
      this._statusOverlayEl = host;
      this._statusBubbleByUnit = new Map();
    }
    const rect = canvas.getBoundingClientRect();
    const elRect = this._el.getBoundingClientRect();
    const sx = rect.width / Math.max(1, canvas.width);
    const sy = rect.height / Math.max(1, canvas.height);
    const offsetX = rect.left - elRect.left;
    const offsetY = rect.top - elRect.top;

    const all = [
      ...(this._heroes || []),
      ...(this._companions || []),
      ...(this._allEnemies || []),
    ];
    const seen = new Set();
    for (const u of all) {
      if (!u || !u.id) continue;
      if (!u.alive) { this._removeStatusBubble(u.id); continue; }
      const statuses = (u.statuses || []).filter(s => s && hasStatusParticle(s.type));
      if (!statuses.length) { this._removeStatusBubble(u.id); continue; }
      seen.add(u.id);

      let bubble = this._statusBubbleByUnit.get(u.id);
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'cbt-status-bubble';
        Object.assign(bubble.style, {
          position: 'absolute', display: 'flex', gap: '2px',
          padding: '2px 4px', borderRadius: '8px',
          background: 'rgba(8,5,8,0.55)',
          border: '1px solid rgba(232,160,32,0.35)',
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'none',
        });
        host.appendChild(bubble);
        this._statusBubbleByUnit.set(u.id, bubble);
      }
      // Reconcile children to the live status list.
      const want = statuses.map(s => s.type);
      const have = Array.from(bubble.children).map(c => c.dataset.statusType);
      if (want.join('|') !== have.join('|')) {
        bubble.innerHTML = '';
        for (const t of want) {
          const img = createStatusParticleEl(t, { width: 14, height: 14, alt: t });
          if (img) {
            img.dataset.statusType = t;
            img.style.display = 'block';
            bubble.appendChild(img);
          }
        }
      }
      // M438 — Position ABOVE the HP bar to avoid overlap. The HP bar is
      // drawn at canvas-y = u.y - size*1.65 - 10 (see _drawUnitInner).
      // Sprite height ≈ baseSize × drawScale × 1.6 × bossBoost. Push the
      // bubble another 22px (canvas px) above the HP bar so the icons
      // float above the bar with breathing room.
      const drawScale = u._drawScale || 1;
      const baseSize = u.isHero ? 56 : 62;
      // M-2026-05-13: removed hardcoded 2.5x bossBoost; bossScale is
      // already baked into _drawScale at layout time (combatLayout.js:247).
      const spriteSize = baseSize * drawScale;
      const hpBarY = u.y - spriteSize * 1.65 - 10;
      const screenX = offsetX + u.x * sx;
      const screenY = offsetY + (hpBarY - 22) * sy;
      bubble.style.left = `${screenX}px`;
      bubble.style.top  = `${screenY}px`;
    }
    // Remove bubbles for units that disappeared (defeated / fled).
    for (const id of Array.from(this._statusBubbleByUnit.keys())) {
      if (!seen.has(id)) this._removeStatusBubble(id);
    }
  }

  _removeStatusBubble(id) {
    if (!this._statusBubbleByUnit) return;
    const b = this._statusBubbleByUnit.get(id);
    if (b) { b.remove(); this._statusBubbleByUnit.delete(id); }
  }

  _drawUnitInner(ctx, c) {
    // M46: attack bob forward, hit recoil backward
    const bobDir = c.isHero ? 1 : -1;
    let bobX = 0;
    if (c.stance === 'attack') bobX = 12 * bobDir;
    if (this._flashMap.has(c.id)) bobX = -8 * bobDir;
    const x = c.x + bobX;
    const y = c.y;
    if (!c.alive && c.stance !== 'death') return;
    const flash = this._flashMap.has(c.id);
    const isHero = c.isHero;
    const drawScale = c._drawScale || 1;
    // M46 sprite scaling: enemies must render at least as large as heroes; bosses larger still.
    const baseSize = isHero ? 56 : 62;
    // M359: per-category scale is already baked into c._drawScale at layout
    // time (positionCombatants applies bossScale/enemyScale/characterScale
    // /companionScale to _drawScale directly). Re-applying it here was a
    // double-multiplication that made bosses render at bossScale² × 2.5.
    // M-2026-05-13: also removed the hardcoded `bossBoost = 2.5` that
    // M359 left in place — it was stacking with bossScale (= 2.0 default
    // since M348, was 1.5 before) and producing ~5x sprites instead of
    // the configured 2x. Boss-specific size now comes only from bossScale.
    const size = baseSize * drawScale;
    const alpha = c.alive ? 1 : 0.35;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (flash) { ctx.shadowBlur = 18; ctx.shadowColor = '#ff4040'; }

    // Sprite drawing: use pixel art if available, else geometric fallback
    // M46: war-dog and other companions use id='war_dog' but class='companion'.
    // Fall back to companion id when class lookup misses.
    // Appearance-first: if the combatant has a custom appearance, use its
    // sprite prefix directly (bypasses SPRITE_MAP, which is keyed to class id).
    // Falls back to class/templateId/id lookup for legacy characters.
    const appSprite = isHero && c.appearance ? resolveSprite(c) : null;
    const spriteKey = isHero
      ? (appSprite || SPRITE_MAP[c.class] || SPRITE_MAP[c.templateId] || SPRITE_MAP[c.id] || SPRITE_MAP[c.className?.toLowerCase?.()])
      : SPRITE_MAP[c.enemyId];
    // M79: everyone uses the new OpenAI east-facing variants. Enemies render horizontally flipped
    // so they face the party. Stance drives attack/spell/death swaps for heroes AND enemies.
    let spriteDir;
    if (!c.alive || c.stance === 'death') spriteDir = 'east_ko';
    else if (c.stance === 'block') spriteDir = 'east_block';
    else if (c.stance === 'attack') spriteDir = 'east_attack';
    else if (c.stance === 'spell') spriteDir = 'east_spell';
    else if (c.stance === 'victory') spriteDir = 'south';
    else spriteDir = 'east';
    const sprites = spriteKey ? _spriteCache[spriteKey] : null;
    let spriteImg = sprites ? sprites[spriteDir] : null;
    let spriteLoaded = spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0;
    if (!spriteLoaded && sprites) {
      const fallbacks = spriteDir === 'east_ko' ? ['south', 'east']
        : spriteDir === 'east_block' ? ['east']
        : spriteDir === 'south' ? ['east']
        : ['east'];
      for (const fb of fallbacks) {
        spriteImg = sprites[fb];
        spriteLoaded = spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0;
        if (spriteLoaded) break;
      }
    }

    if (spriteLoaded && !window.__gfxDisableSprites) {
      const sw = spriteImg.naturalWidth;
      const sh = spriteImg.naturalHeight;
      const adj = getSpriteAdjustment(spriteKey, spriteDir);
      const scale = (size / Math.max(sw, sh) * 1.6) * adj.scale;
      const dw = sw * scale;
      const dh = sh * scale;
      const ax = adj.offsetX;
      const ay = adj.offsetY;
      const shouldFlip = isHero ? FLIP_EAST.has(spriteKey) : !FLIP_EAST.has(spriteKey);
      const _ctx = isHero ? (c.isCompanion ? 'combat-companion' : 'combat-hero') : 'combat-enemy';
      logImage(_ctx, { entityId: c.id || c.enemyId || spriteKey, pose: spriteDir, file: spriteImg.src, x: x - dw/2 + ax, y: y - dh + ay, w: dw, h: dh });
      if (!shouldFlip) {
        ctx.drawImage(spriteImg, x - dw/2 + ax, y - dh + ay, dw, dh);
      } else {
        ctx.save();
        ctx.translate(x + ax, y - dh + ay);
        ctx.scale(-1, 1);
        ctx.drawImage(spriteImg, -dw/2, 0, dw, dh);
        ctx.restore();
      }
    } else {
      // Geometric fallback
      const bodyColor = flash ? '#ff8060' : (isHero ? this._heroColor(c.class) : '#6B3A0A');
      const accentColor = isHero ? '#e8a020' : '#c0392b';
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.rect(x - size*0.28, y - size, size*0.56, size*0.48);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - size*0.8, size*0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accentColor;
      ctx.fillRect(x - size*0.18, y - size*0.52, size*0.14, size*0.46);
      ctx.fillRect(x + size*0.04, y - size*0.52, size*0.14, size*0.46);
      if (c.stance === 'attack') {
        if (isHero) {
          ctx.fillStyle = '#c8c8d8';
          ctx.beginPath();
          ctx.moveTo(x + size*0.28, y - size*0.72);
          ctx.lineTo(x + size*0.5, y - size*0.48);
          ctx.lineTo(x + size*0.38, y - size*0.38);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = '#c0392b';
          ctx.beginPath();
          ctx.moveTo(x - size*0.35, y - size*0.55);
          ctx.lineTo(x - size*0.6, y - size*0.38);
          ctx.lineTo(x - size*0.5, y - size*0.28);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Death X eyes
    if (!c.alive) {
      ctx.strokeStyle = '#ff4040';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x-5, y-size*0.87); ctx.lineTo(x-2, y-size*0.77);
      ctx.moveTo(x-2, y-size*0.87); ctx.lineTo(x-5, y-size*0.77);
      ctx.moveTo(x+2, y-size*0.87); ctx.lineTo(x+5, y-size*0.77);
      ctx.moveTo(x+5, y-size*0.87); ctx.lineTo(x+2, y-size*0.77);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // HP bar (hidden when dead — fixes red-bar-behind-corpse bug)
    if (c.alive) {
      // M65: raise HP bar above the sprite's head (sprite draws up to ~y - size*1.6).
      const bw = size * 1.1;
      const bx = x - bw/2;
      const by = y - size * 1.65 - 10;
      // M304: bosses get a taller bar so phase ticks are visible
      const barH = c.isBoss ? 5 : 3;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, bw, barH);
      const pct = Math.max(0, c.hp/c.maxHp);
      ctx.fillStyle = pct > 0.5 ? '#40c870' : pct > 0.25 ? '#e8a020' : '#c04030';
      ctx.fillRect(bx, by, bw * pct, barH);
      // M304: phase threshold tick marks on boss HP bars
      if (c.isBoss) {
        const thresholds = getPhaseThresholds(c.enemyId);
        for (const t of thresholds) {
          const tx = bx + bw * t;
          const reached = pct < t;
          ctx.save();
          ctx.strokeStyle = reached ? 'rgba(255,255,255,0.35)' : '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(tx, by - 2);
          ctx.lineTo(tx, by + barH + 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Shield (barrier) overlay on HP bar
      const barrierTotal = (c.statuses || []).reduce((sum, s) => s.type === 'barrier' && s.power > 0 ? sum + s.power : sum, 0);
      if (barrierTotal > 0) {
        const shieldPct = Math.min(1, barrierTotal / c.maxHp);
        ctx.fillStyle = 'rgba(60, 120, 220, 0.6)';
        ctx.fillRect(bx, by, bw * shieldPct, barH);
      }

      // M438 — legacy status-color circles above the HP bar removed.
      // The M434 status-particle DOM overlay (fire/poison/bleed/stun
      // icons floating over each combatant) replaces them and is the
      // single visual indicator going forward.

      // M303: Champion — blue name label above sprite
      if (!isHero && c.isChampion) {
        ctx.save();
        ctx.font = `bold 10px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#4488ff';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#2244cc';
        ctx.fillText(c.name, x, by - 8);
        ctx.restore();
      }

      // M303: Wind-up telegraph — pulsing red glow + countdown text above HP bar
      if (!isHero && c._windUp) {
        const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 200);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff2020';
        ctx.strokeStyle = '#ff4040';
        ctx.lineWidth = 2;
        const glowR = bw * 0.52;
        ctx.beginPath();
        ctx.arc(x, by - 4, glowR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = `bold 9px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ff8080';
        ctx.shadowBlur = 0;
        ctx.fillText(`${c._windUp.spellName} [${c._windUp.roundsLeft}]`, x, by - 12);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ── M220: Combat Debug grid overlay ─────────────────────────────────────────
  _drawCombatDebugGrid(ctx, w, h) {
    const ds = getCombatDebugSettings();
    // M242: legacy 'squares'/'rows'/'columns' coerce to 'on'.
    const overlayOn = ds.gridOverlay && ds.gridOverlay !== 'off';
    if (!overlayOn) return;

    const px = ds.placement.x / 100;
    const py = ds.placement.y / 100;
    const pw = ds.placement.w / 100;
    const ph = ds.placement.h / 100;

    const gx0 = w * px;
    const gy0 = h * py;
    const gx1 = w * (1 - pw);
    const gy1 = h * (1 - ph);
    const gw = gx1 - gx0;
    const gh = gy1 - gy0;

    ctx.save();
    ctx.globalAlpha = 0.28;

    if (ds.gridOverlay === 'rows') {
      // Horizontal bands — 4 rows
      const numRows = 4;
      const rowH = gh / numRows;
      for (let r = 0; r < numRows; r++) {
        ctx.fillStyle = r % 2 === 0 ? 'rgba(80,160,255,0.6)' : 'rgba(80,255,160,0.6)';
        ctx.fillRect(gx0, gy0 + r * rowH, gw, rowH);
      }
    } else if (ds.gridOverlay === 'columns') {
      // Vertical columns — 4 cols
      const numCols = 4;
      const colW = gw / numCols;
      for (let c2 = 0; c2 < numCols; c2++) {
        ctx.fillStyle = c2 % 2 === 0 ? 'rgba(255,160,80,0.6)' : 'rgba(255,80,160,0.6)';
        ctx.fillRect(gx0 + c2 * colW, gy0, colW, gh);
      }
    } else {
      // Squares — show per-unit cells based on unit positions
      const staggerOffset = ds.staggerOffset || 0;
      const layout = ds.layout || 'stagger';
      const allUnits = [...this._heroes, ...this._companions, ...this._allEnemies];
      const unitSize = 48;
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < allUnits.length; i++) {
        const u = allUnits[i];
        if (!u.x && !u.y) continue;
        let cx = u.x;
        if (layout === 'straight') cx = u.x; // no extra stagger
        else if (layout === 'diagonal') cx = u.x + i * staggerOffset * 0.25;
        const cellW = unitSize * (u._drawScale || 1) * 1.8;
        const cellH = unitSize * (u._drawScale || 1) * 2.0;
        ctx.fillStyle = u.isHero
          ? (u.isCompanion ? 'rgba(80,200,120,0.55)' : 'rgba(80,140,255,0.55)')
          : (u.isBoss ? 'rgba(255,60,60,0.55)' : 'rgba(255,160,60,0.55)');
        ctx.fillRect(cx - cellW / 2, u.y - cellH, cellW, cellH);
      }
    }

    // Grid boundary outline
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = 'rgba(160,80,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(gx0, gy0, gw, gh);
    ctx.setLineDash([]);

    ctx.restore();

    // Edit handle overlays (if edit mode active)
    if (this._dbgEditMode) {
      this._drawDebugGridHandles(ctx, gx0, gy0, gx1, gy1, w, h);
    }
  }

  _drawDebugGridHandles(ctx, gx0, gy0, gx1, gy1, w, h) {
    const handles = this._getDebugHandles(gx0, gy0, gx1, gy1);
    ctx.save();
    ctx.strokeStyle = 'rgba(160,80,255,0.9)';
    ctx.fillStyle = 'rgba(200,140,255,0.85)';
    ctx.lineWidth = 2;
    for (const hd of handles) {
      ctx.beginPath();
      ctx.arc(hd.x, hd.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _getDebugHandles(gx0, gy0, gx1, gy1) {
    return [
      { id: 'top',    x: (gx0 + gx1) / 2, y: gy0 },
      { id: 'bottom', x: (gx0 + gx1) / 2, y: gy1 },
      { id: 'left',   x: gx0, y: (gy0 + gy1) / 2 },
      { id: 'right',  x: gx1, y: (gy0 + gy1) / 2 },
    ];
  }

  // ── M220: Combat Debug modal ─────────────────────────────────────────────────
  _openCombatDebugModal() {
    // If already collapsed to icon, re-expand
    if (this._dbgModalCollapsed) {
      this._dbgExpandModal();
      return;
    }
    // If modal already open, do nothing
    if (document.querySelector('.cbt-dbg-modal-wrap')) return;

    const ds = getCombatDebugSettings();

    const wrap = document.createElement('div');
    wrap.className = 'cbt-dbg-modal-wrap';

    // M242: transparent backdrop so combat stays visible; pointer-events off
    // on wrap so the player can still interact with combat underneath.
    wrap.style.cssText = `
      position:fixed;inset:0;background:transparent;
      display:flex;align-items:flex-end;justify-content:flex-end;
      z-index:1100;padding:0;pointer-events:none;
    `;

    const box = document.createElement('div');
    box.className = 'cbt-dbg-modal-box';
    // M242: fixed-position + draggable. Header bar captures drag events.
    box.style.cssText = `
      position:fixed;right:16px;bottom:16px;
      background:rgba(14,10,20,0.92);border:1px solid rgba(160,80,255,0.5);
      border-radius:12px;width:min(380px,100vw);max-height:82vh;
      overflow-y:auto;-webkit-overflow-scrolling:touch;
      color:#f0e8d8;font-family:Inter,'Segoe UI',sans-serif;font-size:0.8rem;
      display:flex;flex-direction:column;gap:0;
      pointer-events:all;box-shadow:0 8px 24px rgba(0,0,0,0.6);
    `;

    const applyAll = ds._applyToAll || false;

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem 0.5rem;border-bottom:1px solid rgba(160,80,255,0.2);">
        <span style="font-family:Cinzel,Georgia,serif;font-size:0.95rem;font-weight:700;color:#b87fff;letter-spacing:0.1em;">Combat Debug</span>
        <div style="display:flex;gap:8px;">
          <button type="button" class="compact-target" id="cbt-dbg-minimize" aria-label="Minimize" title="Minimize" style="background:none;border:1px solid rgba(160,80,255,0.35);color:#b87fff;width:32px;height:32px;min-height:32px;border-radius:6px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">&#8211;</button>
          <button type="button" class="compact-target" id="cbt-dbg-close" aria-label="Close" title="Close" style="background:none;border:1px solid rgba(160,80,255,0.35);color:#b87fff;width:32px;height:32px;min-height:32px;border-radius:6px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">&#215;</button>
        </div>
      </div>

      <div style="padding:0.75rem 1rem;display:flex;flex-direction:column;gap:0.75rem;">

        <!-- M242: Battle Grid simplified to a single "Show Grid Placement"
             checkbox. Squares/rows/columns were inaccurate vs actual combat
             (resolved via rows+columns regardless), so the overlay is now
             just a visualisation of possible cells. -->
        <details open>
          <summary style="cursor:pointer;font-size:0.75rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a7a9a;padding:0.4rem 0;min-height:44px;display:flex;align-items:center;">Battle Grid Overlay</summary>
          <div style="padding:0.4rem 0 0.2rem;display:flex;flex-direction:column;gap:0.4rem;">
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;color:#c8b8a8;cursor:pointer;min-height:44px;">
              <input type="checkbox" id="cbt-dbg-grid-on" ${ds.gridOverlay && ds.gridOverlay !== 'off' ? 'checked' : ''} style="accent-color:#b87fff;width:16px;height:16px;"> Show Grid Placement
            </label>
            <p style="font-size:0.65rem;color:#6a6070;margin:0;">Visualises every possible character cell, including empty ones. Combat is resolved by rows + columns internally — overlay is visual only.</p>
          </div>
        </details>

        <!-- M397: Row Offset & Stagger removed — knobs were no-ops once the
             new 2.5D EvBattlefield grid took over sprite placement. -->

        <!-- Section 2: Grid Sizing -->
        <details open>
          <summary style="cursor:pointer;font-size:0.75rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a7a9a;padding:0.4rem 0;min-height:44px;display:flex;align-items:center;">Grid Sizing (Scale)</summary>
          <div style="padding:0.4rem 0 0.2rem;display:flex;flex-direction:column;gap:0.6rem;">
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.72rem;color:#c8b8a8;cursor:pointer;min-height:44px;">
              <input type="checkbox" id="cbt-dbg-apply-all" ${applyAll?'checked':''} style="accent-color:#b87fff;width:16px;height:16px;"> Apply all sliders together
            </label>
            ${[
              ['cbt-dbg-char-scale',  'Character Scale',  ds.characterScale],
              ['cbt-dbg-comp-scale',  'Companion Scale',  ds.companionScale],
              ['cbt-dbg-enemy-scale', 'Enemy Scale',      ds.enemyScale],
              ['cbt-dbg-boss-scale',  'Boss Scale',       ds.bossScale],
            ].map(([id, label, val]) => `
              <div style="display:flex;flex-direction:column;gap:0.25rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:0.72rem;color:#a898b8;">${label}</span>
                  <input type="number" id="${id}-num" value="${val.toFixed(2)}" min="0.5" max="2.0" step="0.05"
                    style="width:4.5rem;background:#1a1228;border:1px solid rgba(160,80,255,0.3);color:#e8d8f8;padding:0.25rem 0.4rem;border-radius:4px;font-family:inherit;font-size:0.75rem;text-align:right;">
                </div>
                <input type="range" id="${id}" class="cbt-dbg-scale-slider" min="0.5" max="2.0" step="0.05" value="${val}"
                  style="width:100%;accent-color:#b87fff;height:4px;cursor:pointer;">
              </div>
            `).join('')}
          </div>
        </details>

        <!-- Section 3: Grid Placement -->
        <details open>
          <summary style="cursor:pointer;font-size:0.75rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a7a9a;padding:0.4rem 0;min-height:44px;display:flex;align-items:center;">Grid Placement (Margin %)</summary>
          <div style="padding:0.4rem 0 0.2rem;display:flex;flex-direction:column;gap:0.6rem;">
            ${[
              ['cbt-dbg-pl-x', 'Left margin %',   ds.placement.x],
              ['cbt-dbg-pl-y', 'Top margin %',    ds.placement.y],
              ['cbt-dbg-pl-w', 'Right margin %',  ds.placement.w],
              ['cbt-dbg-pl-h', 'Bottom margin %', ds.placement.h],
            ].map(([id, label, val]) => `
              <div style="display:flex;flex-direction:column;gap:0.25rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:0.72rem;color:#a898b8;">${label}</span>
                  <input type="number" id="${id}-num" value="${val.toFixed(1)}" min="0" max="40" step="0.5"
                    style="width:4.5rem;background:#1a1228;border:1px solid rgba(160,80,255,0.3);color:#e8d8f8;padding:0.25rem 0.4rem;border-radius:4px;font-family:inherit;font-size:0.75rem;text-align:right;">
                </div>
                <input type="range" id="${id}" class="cbt-dbg-pl-slider" min="0" max="40" step="0.5" value="${val}"
                  style="width:100%;accent-color:#b87fff;height:4px;cursor:pointer;">
              </div>
            `).join('')}
            <button type="button" id="cbt-dbg-edit" style="background:${this._dbgEditMode?'rgba(160,80,255,0.3)':'rgba(160,80,255,0.1)'};border:1px solid rgba(160,80,255,0.45);color:#b87fff;padding:0.6rem 1rem;border-radius:6px;font-family:inherit;font-size:0.75rem;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;min-height:44px;width:100%;">
              ${this._dbgEditMode ? 'Done Editing' : 'Edit Handles (drag)'}
            </button>
          </div>
        </details>

        <!-- M397: Grid Layout + Grid Stagger Offset removed — both only
             affected the legacy canvas overlay path that is no longer reached
             once the 2.5D battlefield is the source of truth. -->

        <!-- Section 6: Copy/Paste -->
        <details open>
          <summary style="cursor:pointer;font-size:0.75rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a7a9a;padding:0.4rem 0;min-height:44px;display:flex;align-items:center;">Copy / Paste Settings</summary>
          <div style="padding:0.4rem 0 0.2rem;display:flex;flex-direction:column;gap:0.5rem;">
            <button type="button" id="cbt-dbg-copy" style="background:rgba(80,160,80,0.12);border:1px solid rgba(80,200,80,0.4);color:#70d870;padding:0.6rem 1rem;border-radius:6px;font-family:inherit;font-size:0.75rem;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;min-height:44px;">Copy Settings JSON</button>
            <button type="button" id="cbt-dbg-paste-open" style="background:rgba(80,120,255,0.12);border:1px solid rgba(80,120,255,0.4);color:#8090ff;padding:0.6rem 1rem;border-radius:6px;font-family:inherit;font-size:0.75rem;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;min-height:44px;">Paste Settings</button>
            <div id="cbt-dbg-paste-area" style="display:none;flex-direction:column;gap:0.4rem;">
              <textarea id="cbt-dbg-paste-ta" rows="5" placeholder="Paste JSON here..."
                style="background:#0a0714;border:1px solid rgba(160,80,255,0.3);color:#e8d8f8;padding:0.5rem;border-radius:6px;font-family:monospace;font-size:0.72rem;resize:vertical;width:100%;box-sizing:border-box;"></textarea>
              <button type="button" id="cbt-dbg-paste-apply" style="background:rgba(160,80,255,0.15);border:1px solid rgba(160,80,255,0.45);color:#b87fff;padding:0.6rem 1rem;border-radius:6px;font-family:inherit;font-size:0.75rem;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;min-height:44px;">Apply Paste</button>
              <span id="cbt-dbg-paste-status" style="font-size:0.65rem;color:#8a7a8a;min-height:1rem;"></span>
            </div>
            <button type="button" id="cbt-dbg-reset" style="background:rgba(180,40,40,0.1);border:1px solid rgba(200,60,60,0.4);color:#e07070;padding:0.5rem 1rem;border-radius:6px;font-family:inherit;font-size:0.72rem;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;min-height:44px;margin-top:0.25rem;">Reset to Defaults</button>
          </div>
        </details>

      </div>
    `;

    wrap.appendChild(box);
    document.body.appendChild(wrap);

    // M242: drag the header to reposition. Saves position per-session.
    const header = box.firstElementChild;
    if (header) {
      header.style.cursor = 'move';
      header.style.userSelect = 'none';
      const saved = (() => { try { return JSON.parse(localStorage.getItem('emberveil_cbt_dbg_pos') || 'null'); } catch { return null; } })();
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        box.style.right = ''; box.style.bottom = '';
        box.style.left = saved.left + 'px';
        box.style.top  = saved.top  + 'px';
      }
      let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;
      const onDown = (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        const rect = box.getBoundingClientRect();
        box.style.right = ''; box.style.bottom = '';
        box.style.left = rect.left + 'px';
        box.style.top  = rect.top  + 'px';
        startX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        startY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        startLeft = rect.left; startTop = rect.top;
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const cx = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        const cy = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        const left = Math.max(0, Math.min(window.innerWidth - 80, startLeft + (cx - startX)));
        const top  = Math.max(0, Math.min(window.innerHeight - 40, startTop  + (cy - startY)));
        box.style.left = left + 'px';
        box.style.top  = top  + 'px';
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        try {
          localStorage.setItem('emberveil_cbt_dbg_pos', JSON.stringify({
            left: parseInt(box.style.left, 10) || 0,
            top:  parseInt(box.style.top,  10) || 0,
          }));
        } catch {}
      };
      header.addEventListener('mousedown', onDown);
      header.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    }

    // ── Wire controls ──────────────────────────────────────────────────────────

    const _get = (id) => box.querySelector('#' + id);
    const applyAllCb = _get('cbt-dbg-apply-all');

    // Scale sliders + number inputs
    const scaleMap = {
      'cbt-dbg-char-scale':  'characterScale',
      'cbt-dbg-comp-scale':  'companionScale',
      'cbt-dbg-enemy-scale': 'enemyScale',
      'cbt-dbg-boss-scale':  'bossScale',
    };
    Object.entries(scaleMap).forEach(([id, key]) => {
      const slider = _get(id);
      const numIn  = _get(id + '-num');
      const sync = (v) => {
        const n = Math.min(2.0, Math.max(0.5, parseFloat(v) || 1.0));
        if (applyAllCb.checked) {
          const all = {};
          Object.values(scaleMap).forEach(k => { all[k] = n; });
          setCombatDebugSettings(Object.assign(all, { _applyToAll: true }));
          // Update all sibling UI
          Object.keys(scaleMap).forEach(sid => {
            const s2 = _get(sid); const n2 = _get(sid + '-num');
            if (s2) s2.value = n;
            if (n2) n2.value = n.toFixed(2);
          });
        } else {
          setCombatDebugSettings({ [key]: n });
        }
        slider.value = n;
        numIn.value = n.toFixed(2);
      };
      slider.addEventListener('input', () => sync(slider.value));
      numIn.addEventListener('change', () => sync(numIn.value));
    });

    // Placement sliders
    const plMap = {
      'cbt-dbg-pl-x': 'x',
      'cbt-dbg-pl-y': 'y',
      'cbt-dbg-pl-w': 'w',
      'cbt-dbg-pl-h': 'h',
    };
    Object.entries(plMap).forEach(([id, key]) => {
      const slider = _get(id);
      const numIn  = _get(id + '-num');
      const sync = (v) => {
        const n = Math.min(40, Math.max(0, parseFloat(v) || 0));
        setCombatDebugSettings({ placement: { [key]: n } });
        slider.value = n;
        numIn.value = n.toFixed(1);
      };
      slider.addEventListener('input', () => sync(slider.value));
      numIn.addEventListener('change', () => sync(numIn.value));
    });

    // M242: Grid overlay is now a single on/off checkbox. Legacy ids left
    // in place for older builds — this one hydrates the checkbox instead.
    const gridChk = _get('cbt-dbg-grid-on');
    if (gridChk) {
      gridChk.addEventListener('change', (e) => {
        setCombatDebugSettings({ gridOverlay: e.target.checked ? 'on' : 'off' });
      });
    }
    // M397: Row Offset/Stagger + Layout + Grid Stagger Offset handlers
    // removed alongside their UI sections — the underlying knobs no longer
    // reach the 2.5D battlefield's sprite placement, so wiring them was just
    // a misleading pretense.

    // Edit handles toggle
    _get('cbt-dbg-edit').addEventListener('click', () => {
      this._dbgEditMode = !this._dbgEditMode;
      _get('cbt-dbg-edit').textContent = this._dbgEditMode ? 'Done Editing' : 'Edit Handles (drag)';
      _get('cbt-dbg-edit').style.background = this._dbgEditMode ? 'rgba(160,80,255,0.3)' : 'rgba(160,80,255,0.1)';
      if (this._dbgEditMode) this._attachDebugHandleDrag();
    });

    // Copy settings
    _get('cbt-dbg-copy').addEventListener('click', async () => {
      const current = getCombatDebugSettings();
      const payload = {
        settings: current,
        context: {
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
          screenRatio: (window.innerWidth / window.innerHeight).toFixed(3),
        },
        timestamp: new Date().toISOString(),
      };
      const json = JSON.stringify(payload, null, 2);
      const btn = _get('cbt-dbg-copy');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(json);
        } else {
          const ta = document.createElement('textarea');
          ta.value = json; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
        }
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Settings JSON'; }, 1500);
      } catch (e) {
        alert('Copy failed: ' + e.message);
      }
    });

    // Paste toggle
    _get('cbt-dbg-paste-open').addEventListener('click', () => {
      const area = _get('cbt-dbg-paste-area');
      const visible = area.style.display !== 'none';
      area.style.display = visible ? 'none' : 'flex';
    });

    // Apply paste
    _get('cbt-dbg-paste-apply').addEventListener('click', () => {
      const ta = _get('cbt-dbg-paste-ta');
      const status = _get('cbt-dbg-paste-status');
      try {
        const raw = JSON.parse(ta.value.trim());
        // Accept { settings: {...} } wrapper OR bare settings object
        const incoming = raw.settings || raw;
        if (typeof incoming !== 'object' || !incoming) throw new Error('Invalid format — expected settings object.');
        setCombatDebugSettings(incoming);
        status.textContent = 'Settings applied.';
        status.style.color = '#70d870';
        // Close and reopen modal to reflect new values
        try { wrap.remove(); } catch (_) {}
        setTimeout(() => this._openCombatDebugModal(), 50);
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
        status.style.color = '#e07070';
      }
    });

    // Reset defaults — M348: pulls from the shared _DEFAULTS via
    // resetCombatDebugSettings() instead of hardcoding 1.0× scales. The
    // hardcoded values were stale (real defaults are 2.0/1.5/1.5/2.0)
    // and made Reset feel like it was DOWNGRADING from current defaults.
    _get('cbt-dbg-reset').addEventListener('click', () => {
      if (!confirm('Reset all Combat Debug settings to defaults?')) return;
      try {
        // Lazy-import to avoid a circular dep with the static import at top.
        import('../../game/combatDebugSettings.js').then(mod => {
          if (typeof mod.resetCombatDebugSettings === 'function') {
            mod.resetCombatDebugSettings();
          }
        });
      } catch (_) {}
      try { wrap.remove(); } catch (_) {}
      setTimeout(() => this._openCombatDebugModal(), 50);
    });

    // Minimize
    _get('cbt-dbg-minimize').addEventListener('click', () => {
      try { wrap.remove(); } catch (_) {}
      this._dbgCollapseToIcon();
    });

    // Close
    _get('cbt-dbg-close').addEventListener('click', () => {
      try { wrap.remove(); } catch (_) {}
      this._dbgModalCollapsed = false;
    });

    // Click outside to close
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target === wrap) {
        try { wrap.remove(); } catch (_) {}
        this._dbgModalCollapsed = false;
      }
    });
  }

  _dbgCollapseToIcon() {
    this._dbgModalCollapsed = true;
    // Remove existing icon if any
    const existing = document.querySelector('.cbt-dbg-collapsed-icon');
    if (existing) try { existing.remove(); } catch (_) {}

    if (!this._el) return;
    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'cbt-dbg-collapsed-icon';
    icon.setAttribute('aria-label', 'Expand Combat Debug');
    icon.title = 'Expand Combat Debug';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>`;
    icon.style.cssText = 'position:absolute;bottom:60px;right:8px;z-index:901;min-width:36px;min-height:36px;width:36px;height:36px;border-radius:50%;background:rgba(60,20,80,0.85);border:1px solid rgba(160,80,255,0.7);color:#b87fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;pointer-events:all;';
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      this._dbgExpandModal();
    });
    this._el.appendChild(icon);
  }

  _dbgExpandModal() {
    this._dbgModalCollapsed = false;
    const icon = document.querySelector('.cbt-dbg-collapsed-icon');
    if (icon) try { icon.remove(); } catch (_) {}
    this._openCombatDebugModal();
  }

  _attachDebugHandleDrag() {
    // Pointer-event drag on the canvas for edit handles
    const canvas = this.manager?.canvas;
    if (!canvas || this._dbgDragActive) return;

    let dragging = null;

    const onDown = (e) => {
      if (!this._dbgEditMode) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const w = this.manager.width;
      const h = this.manager.height;
      const ds2 = getCombatDebugSettings();
      const gx0 = w * ds2.placement.x / 100;
      const gy0 = h * ds2.placement.y / 100;
      const gx1 = w * (1 - ds2.placement.w / 100);
      const gy1 = h * (1 - ds2.placement.h / 100);
      const handles = this._getDebugHandles(gx0, gy0, gx1, gy1);
      for (const hd of handles) {
        const dist = Math.hypot(mx - hd.x, my - hd.y);
        if (dist < 20) { dragging = hd.id; e.preventDefault(); break; }
      }
    };
    const onMove = (e) => {
      if (!dragging || !this._dbgEditMode) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const w = this.manager.width;
      const h = this.manager.height;
      const pct = (v, total) => Math.min(40, Math.max(0, v / total * 100));
      if (dragging === 'left')   setCombatDebugSettings({ placement: { x: pct(mx, w) } });
      if (dragging === 'right')  setCombatDebugSettings({ placement: { w: pct(w - mx, w) } });
      if (dragging === 'top')    setCombatDebugSettings({ placement: { y: pct(my, h) } });
      if (dragging === 'bottom') setCombatDebugSettings({ placement: { h: pct(h - my, h) } });
    };
    const onUp = () => { dragging = null; };

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    this._dbgDragActive = true;
    this._dbgDragCleanup = () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      this._dbgDragActive = false;
    };
  }

  _preloadSprites(encounter) {
    const gs = GameState.get();
    for (const m of [...gs.party, ...gs.companions]) {
      const appKey = m.appearance ? resolveSprite(m) : null;
      const key = appKey || SPRITE_MAP[m.class] || SPRITE_MAP[m.templateId] || SPRITE_MAP[m.id] || SPRITE_MAP[m.className?.toLowerCase?.()];
      if (key) _loadSprite(key);
    }
    for (const eg of encounter.enemies) {
      const key = SPRITE_MAP[eg.id];
      if (key) _loadSprite(key);
    }
  }

  _heroColor(classId) {
    const m = { warrior:'#607080',paladin:'#d4af37',ranger:'#4a7a40',rogue:'#3a3050',cleric:'#e0d0a0',bard:'#8060a0',mage:'#4060c0',necromancer:'#503060',warlock:'#802040',demon_hunter:'#c04060',scavenger:'#806040',swashbuckler:'#c08020',dragon_knight:'#806020',pyromancer:'#c04020' };
    return m[classId] || '#607080';
  }

  _stopCombatAudio() {
    try { this.audio.stopCombatMusic?.(); } catch (_) {}
    try { this.audio.stopAllSfx?.(); } catch (_) {}
    try { this.audio.stopLoop?.(); } catch (_) {}
  }

  update_old() {}
  // M273: tracked setTimeout helper. All combat setTimeouts route through
  // _setTimeout(fn, ms) so onExit/destroy can clear them, preventing
  // callbacks from firing against a popped/detached CombatScreen.
  _setTimeout(fn, ms) {
    if (this._destroyed) return null;
    if (!this._timeouts) this._timeouts = new Set();
    const id = setTimeout(() => {
      this._timeouts?.delete(id);
      if (this._destroyed) return;
      try { fn(); } catch (e) { /* swallow — setTimeout errors are silent anyway */ console.error(e); }
    }, ms);
    this._timeouts.add(id);
    return id;
  }
  _clearAllTimeouts() {
    if (!this._timeouts) return;
    for (const id of this._timeouts) clearTimeout(id);
    this._timeouts.clear();
  }
  /**
   * M405 — Reposition the .cbt-captions bar so it sits directly above
   * whichever HUD is currently mounted (legacy or .ev-hud). The static
   * :has() rules in CSS were brittle when card heights changed across
   * manual/auto/companions states; this measures the live DOM instead.
   */
  _repositionCaptions() {
    if (!this._el) return;
    const captions = this._el.querySelector('#cbt-captions');
    if (!captions) return;
    const evHud = this._el.querySelector('#ev-hud');
    const cbtHud = this._el.querySelector('#cbt-hud');
    let h = 0;
    try {
      if (evHud) h = Math.max(h, evHud.getBoundingClientRect().height || 0);
    } catch (_) {}
    try {
      if (cbtHud) h = Math.max(h, cbtHud.getBoundingClientRect().height || 0);
    } catch (_) {}
    if (!Number.isFinite(h) || h <= 0) return;
    const px = `${Math.round(h)}px`;
    if (this._lastCaptionBottom !== px) {
      captions.style.bottom = px;
      this._lastCaptionBottom = px;
    }
    // M414 — share the live HUD height with the EvBattlefield bottom anchor
    // and the legacy combat-bg via a CSS var on the screen root, so the
    // background image always stops where the HUD starts (same line as the
    // captions bar) without per-mode hardcoded reservations.
    const root = this._el.classList.contains('combat-screen')
      ? this._el
      : this._el.querySelector('.combat-screen') || this._el;
    if (root) root.style.setProperty('--hud-h', `${Math.round(h)}px`);
  }

  onExit() {
    this._destroyed = true;
    this._clearAllTimeouts();
    if (window.__activeCombatScreen === this) window.__activeCombatScreen = null;
    // M472 — clear combat flag + flush any deferred Supabase pushes once.
    // Single PATCH per save key with the latest record, regardless of how
    // many turn-by-turn local saves happened during the fight.
    window.__inCombat = false;
    try { window.__cloudSaves?.flushPendingPushes?.(); } catch (_) {}
    this._stopCombatAudio();
    if (this._escHandler) { window.removeEventListener('keydown', this._escHandler, true); this._escHandler = null; }
    if (this._tapClickHandler) { if (this.manager?.canvas) this.manager.canvas.removeEventListener('pointerdown', this._tapClickHandler); if (this._el) this._el.removeEventListener('pointerdown', this._tapClickHandler); this._tapClickHandler = null; }
    if (this._canvasTargetHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointerdown', this._canvasTargetHandler, { capture: true }); } catch (_) {} this._canvasTargetHandler = null; }
    if (this._champHoverHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointermove', this._champHoverHandler); } catch (_) {} this._champHoverHandler = null; }
    if (this._champLeaveHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointerleave', this._champLeaveHandler); } catch (_) {} this._champLeaveHandler = null; }
    if (this._champPointerDownHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointerdown', this._champPointerDownHandler); } catch (_) {} this._champPointerDownHandler = null; }
    if (this._spriteHoverTimer) { clearTimeout(this._spriteHoverTimer); this._spriteHoverTimer = null; }
    this._spriteHoverPending = null;
    document.getElementById('champ-hover-tip')?.remove();
    if (this._combatDebugHandler) { window.removeEventListener('combatDebug:changed', this._combatDebugHandler); this._combatDebugHandler = null; }
    if (this._captionResizeHandler) {
      try { window.removeEventListener('resize', this._captionResizeHandler); } catch (_) {}
      try { window.removeEventListener('orientationchange', this._captionResizeHandler); } catch (_) {}
      this._captionResizeHandler = null;
    }
    if (this._dbgDragCleanup) { try { this._dbgDragCleanup(); } catch (_) {} this._dbgDragCleanup = null; }
    // Remove any Combat Debug overlay elements left open
    document.querySelectorAll('.cbt-dbg-grid-overlay, .cbt-dbg-modal-wrap, .cbt-dbg-collapsed-icon, .champ-info-tip').forEach(el => { try { el.remove(); } catch (_) {} });
    // M434 — tear down canvas status overlay
    if (this._statusOverlayEl) { try { this._statusOverlayEl.remove(); } catch (_) {} this._statusOverlayEl = null; this._statusBubbleByUnit = null; }
    // M389 — destroy EvBattlefield grid if mounted (always null in M434+)
    // M435: EvBattlefield is gone; this._evBattlefield is always null.
    // M388 — destroy turn-order strip if mounted
    if (this._evTurnStrip) { try { this._evTurnStrip.destroy(); } catch (_) {} this._evTurnStrip = null; }
    // M389 — destroy card rail if mounted
    if (this._evCardRail) { try { this._evCardRail.destroy(); } catch (_) {} this._evCardRail = null; }
    // M390 — drop manual-input listeners
    if (this._spellPickHandler) { try { document.removeEventListener('ev:spell-pick', this._spellPickHandler); } catch (_) {} this._spellPickHandler = null; }
    // M434: legacy ev:target-select listener removed — no cleanup needed.
    if (this._railClickHandler && this._el) { try { this._el.removeEventListener('click', this._railClickHandler, true); } catch (_) {} }
    this._railClickHandler = null;
    this._awaitingInput = null;
    this._awaitingPartyMember = null;
    this._awaitingEnemies = null;
    this._awaitingAllies = null;
    this._awaitingFallen = null;
    this._pendingSkillId = null;
    this._drainingExtras = false;
    removeEl(this._el); this._el = null;
  }
  destroy() {
    this._destroyed = true;
    this._clearAllTimeouts();
    if (window.__activeCombatScreen === this) window.__activeCombatScreen = null;
    this._stopCombatAudio();
    if (this._escHandler) { window.removeEventListener('keydown', this._escHandler, true); this._escHandler = null; }
    if (this._tapClickHandler) { if (this.manager?.canvas) this.manager.canvas.removeEventListener('pointerdown', this._tapClickHandler); if (this._el) this._el.removeEventListener('pointerdown', this._tapClickHandler); this._tapClickHandler = null; }
    if (this._canvasTargetHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointerdown', this._canvasTargetHandler, { capture: true }); } catch (_) {} this._canvasTargetHandler = null; }
    if (this._champHoverHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointermove', this._champHoverHandler); } catch (_) {} this._champHoverHandler = null; }
    if (this._champLeaveHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointerleave', this._champLeaveHandler); } catch (_) {} this._champLeaveHandler = null; }
    if (this._champPointerDownHandler && this.manager?.canvas) { try { this.manager.canvas.removeEventListener('pointerdown', this._champPointerDownHandler); } catch (_) {} this._champPointerDownHandler = null; }
    if (this._spriteHoverTimer) { clearTimeout(this._spriteHoverTimer); this._spriteHoverTimer = null; }
    this._spriteHoverPending = null;
    document.getElementById('champ-hover-tip')?.remove();
    if (this._combatDebugHandler) { window.removeEventListener('combatDebug:changed', this._combatDebugHandler); this._combatDebugHandler = null; }
    if (this._captionResizeHandler) {
      try { window.removeEventListener('resize', this._captionResizeHandler); } catch (_) {}
      try { window.removeEventListener('orientationchange', this._captionResizeHandler); } catch (_) {}
      this._captionResizeHandler = null;
    }
    if (this._dbgDragCleanup) { try { this._dbgDragCleanup(); } catch (_) {} this._dbgDragCleanup = null; }
    document.querySelectorAll('.cbt-dbg-grid-overlay, .cbt-dbg-modal-wrap, .cbt-dbg-collapsed-icon, .champ-info-tip').forEach(el => { try { el.remove(); } catch (_) {} });
    // M434 — tear down canvas status overlay
    if (this._statusOverlayEl) { try { this._statusOverlayEl.remove(); } catch (_) {} this._statusOverlayEl = null; this._statusBubbleByUnit = null; }
    // M389 — destroy EvBattlefield grid if mounted (always null in M434+)
    // M435: EvBattlefield is gone; this._evBattlefield is always null.
    // M388 — destroy turn-order strip if mounted
    if (this._evTurnStrip) { try { this._evTurnStrip.destroy(); } catch (_) {} this._evTurnStrip = null; }
    // M389 — destroy card rail if mounted
    if (this._evCardRail) { try { this._evCardRail.destroy(); } catch (_) {} this._evCardRail = null; }
    // M390 — drop manual-input listeners
    if (this._spellPickHandler) { try { document.removeEventListener('ev:spell-pick', this._spellPickHandler); } catch (_) {} this._spellPickHandler = null; }
    // M434: legacy ev:target-select listener removed — no cleanup needed.
    if (this._railClickHandler && this._el) { try { this._el.removeEventListener('click', this._railClickHandler, true); } catch (_) {} }
    this._railClickHandler = null;
    this._awaitingInput = null;
    this._awaitingPartyMember = null;
    this._awaitingEnemies = null;
    this._awaitingAllies = null;
    this._awaitingFallen = null;
    this._pendingSkillId = null;
    this._drainingExtras = false;
    removeEl(this._el); this._el = null;
  }
}

const COMBAT_STYLES = `
.combat-screen {
  position: absolute; inset: 0; pointer-events: none;
  font-family: 'Inter', sans-serif; color: #f0e8d8;
  height: 100%; min-height: 100%;
  /* background intentionally transparent — characters drawn on canvas behind this overlay */
}
.combat-screen > * { pointer-events: auto; }
.cbt-log-panel {
  position: absolute; top: 10px; right: 10px;
  width: min(250px, 42vw); max-height: 170px;
  background: rgba(8,4,6,0.88); border: 1px solid rgba(232,160,32,0.18);
  border-radius: 8px; overflow: hidden; pointer-events: none;
}
/* M385 P1: prevent log panel from bleeding off right edge on narrow screens */
/* M450: also push the log BELOW the turn-order strip on mobile (was top:10
   which sat under the strip) and add a few px of bottom padding inside the
   entries list so the last line doesn't get clipped by max-height. */
@media (max-width: 700px) {
  .cbt-log-panel { top: 64px; width: min(90vw, 220px); right: 5px; max-height: 140px; }
  .cbt-log-entries { max-height: 110px; padding-bottom: 1lh; pointer-events: auto; }
}
.cbt-log-title {
  font-size: 0.6rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  color: #8a7a6a; padding: 0.35rem 0.7rem; border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.cbt-log-sec-lbl { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.05em; text-transform: none; color: #a89788; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; pointer-events: all; }
.cbt-log-sec-lbl input { accent-color: #b87fff; width: 12px; height: 12px; margin: 0; }
.cbt-log-entries { padding: 0.35rem 0.7rem; overflow-y: auto; max-height: 130px; display: flex; flex-direction: column; gap: 1px; }
.cbt-log-entries.hide-secondary .cbt-secondary { display: none; }
.cbt-meter-panel { position: absolute; top: 90px; right: 8px; width: 180px; background: rgba(10,8,14,0.88); border: 1px solid rgba(160,80,255,0.35); border-radius: 8px; z-index: 920; color: #f0e8d8; font-size: 11px; pointer-events: all; backdrop-filter: blur(4px); }
/* M385 P1: tighten damage meter on narrow mobile to reduce right-side crowding */
@media (max-width: 450px) {
  .cbt-meter-panel { width: 160px; top: 70px; right: 4px; font-size: 10px; }
  .cbt-meter-panel .meter-body { max-height: 120px; }
}
.cbt-meter-panel .meter-head { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-bottom: 1px solid rgba(160,80,255,0.25); }
.cbt-meter-panel .meter-title { font-weight: 700; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #b87fff; flex: 1; }
.cbt-meter-panel button { background: none; border: 1px solid rgba(160,80,255,0.35); color: #b87fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; font-family: inherit; min-height: 22px; }
/* M296: meter buttons are compact debug UI — opt out of 44px tap target rule */
.cbt-meter-panel button { min-width: unset; min-height: 22px; }
.cbt-meter-panel .meter-enemy-lbl { font-size: 9.5px; letter-spacing: 0.08em; color: #e080c0; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; user-select: none; }
.cbt-meter-panel .meter-enemy-lbl input { width: 11px; height: 11px; margin: 0; accent-color: #e080c0; }
.cbt-meter-panel .meter-body { padding: 4px 6px; max-height: 180px; overflow-y: auto; }
.meter-row { display: flex; align-items: center; gap: 6px; padding: 2px 4px; position: relative; }
.meter-row .meter-bar { position: absolute; left: 0; top: 2px; bottom: 2px; background: rgba(200,80,80,0.25); border-radius: 2px; z-index: 0; }
.meter-row .meter-name { position: relative; z-index: 1; flex: 1; font-size: 11px; }
.meter-row .meter-val { position: relative; z-index: 1; font-weight: 700; color: #ffd060; font-size: 11px; }
.cbt-meter-open { position: absolute; bottom: 85px; right: 8px; z-index: 900; min-width: 32px; min-height: 32px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.55); border: 1px solid rgba(160,80,255,0.5); color: #b87fff; cursor: pointer; padding: 0; pointer-events: all; font-weight: 700; }
/* M385 P1: on mobile, push meter button higher to clear potion-belt clutter */
@media (max-width: 450px) {
  .cbt-meter-open { bottom: 110px; }
}
.cbt-entry { font-size: 0.68rem; line-height: 1.4; color: #c0b090; }
.cbt-round { color: #e8a020; font-weight: 700; text-align: center; }
.cbt-hero { color: #90d8a8; }
.cbt-enemy { color: #d08080; }
.cbt-miss { color: #8a7a6a; font-style: italic; }
.cbt-death { color: #c04030; font-weight: 600; }
/* M295 — Potion Belt in combat */
.cbt-potion-belt {
  position: absolute; left: 0; right: 0;
  display: flex; flex-direction: row; gap: 0.3rem;
  padding: 0.25rem 0.75rem;
  background: rgba(6,2,10,0.72);
  border-top: 1px solid rgba(100,200,120,0.12);
  z-index: 20; flex-wrap: nowrap; overflow-x: auto;
  scrollbar-width: none;
}
.cbt-potion-belt::-webkit-scrollbar { display: none; }
.cbt-pb-btn {
  flex-shrink: 0;
  min-height: 36px; min-width: 72px;
  padding: 0.25rem 0.5rem;
  background: rgba(60,180,100,0.1);
  border: 1px solid rgba(60,180,100,0.35);
  border-radius: 6px; cursor: pointer;
  color: #90d8a8; font-size: 0.64rem;
  font-family: 'Cinzel', Georgia, serif;
  white-space: nowrap;
  transition: background 0.12s;
}
.cbt-pb-btn:hover { background: rgba(60,180,100,0.22); }
.cbt-pb-btn:disabled { opacity: 0.35; cursor: default; }
.cbt-hud {
  position: absolute; bottom: 0; left: auto; right: 0;
  padding: 0.6rem 1rem; background: rgba(8,4,6,0.88);
  border-top: 1px solid rgba(232,160,32,0.15);
  display: flex; align-items: center; gap: 1rem; justify-content: space-between;
}
/* M423 — heroes and companions render in their own rows, each with 4 fixed
   columns so a 4-hero + 1-companion party never crowds slots together. */
.cbt-hud:has(.hud-members--companions) {
  flex-direction: column; align-items: stretch; gap: 0.35rem;
}
.hud-members { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; flex: 1; min-width: 0; }
.hud-members--companions { opacity: 0.92; }
.hm { min-width: 0; max-width: none; }
/* M390 — mobile HUD: tighten controls so weapon/utility/speed/pause stop
   crowding the manual-mode card rail. Reconciles Phase 03 (three util-buttons)
   with Phase 10 (single hamburger) by reducing visual weight without ripping
   out the existing layout. Full hamburger replacement deferred. */
@media (max-width: 700px) {
  .hud-controls { gap: 0.2rem; }
  .hud-speed-btn { padding: 0.35rem 0.55rem; min-width: 44px; min-height: 44px; font-size: 0.74rem; }
  .hud-pause-btn { padding: 0.35rem 0.5rem; min-width: 44px; min-height: 44px; }
  .hud-tap-btn { width: 40px; height: 40px; margin-left: 2px; }
  .hud-tap-btn.is-empty { display: none; }
}
.hm-top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.2rem; }
.hm-name { font-size: 0.58rem; font-weight: 700; font-family: 'Cinzel', serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hm-bars { display: flex; flex-direction: column; gap: 1px; margin-top: 2px; }
.hm-bar-t { background: rgba(255,255,255,0.07); border-radius: 2px; height: 3px; overflow: hidden; position: relative; }
.mp-t { height: 2px; }
.hm-bar { height: 100%; border-radius: 2px; transition: width 0.3s; }
.hp-bar { background: #40c870; }
.shield-bar { position: absolute; top: 0; left: 0; background: rgba(60, 120, 220, 0.6); transition: width 0.3s; }
.mp-bar { background: #4080c0; }
.hm-vals { font-size: 0.5rem; color: #8a7a6a; }
.hm-statuses { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 2px; min-height: 0; }
.hst-icon {
  display: inline-flex; align-items: center;
  font-size: 0.44rem; font-weight: 700; font-family: 'Inter', monospace;
  border: 1px solid rgba(200,200,200,0.2);
  border-radius: 3px; padding: 0 2px; line-height: 1.3;
  cursor: default;
}
.hst-icon sup { font-size: 0.38rem; vertical-align: super; margin-left: 1px; }
.hud-right { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; flex-shrink: 0; }
.hud-round { font-family: 'Cinzel', serif; font-size: 0.6rem; color: #8a7a6a; }
.hud-controls { display: flex; gap: 0.3rem; }
.hud-speed-btn { background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.5); color: #e8a020; font-size: 0.82rem; font-weight: 700; padding: 0.4rem 0.85rem; border-radius: 6px; cursor: pointer; flex-shrink: 0; min-height: 48px; min-width: 60px; letter-spacing: 0.03em; }
.hud-pause-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: #c0b090; font-size: 1rem; padding: 0.4rem 0.7rem; border-radius: 6px; cursor: pointer; min-height: 48px; min-width: 44px; }
.hud-pause-btn:hover { background: rgba(255,255,255,0.12); }

/* M393 — manual mode: when the new combat HUD is mounted, hide the speed
   selector and step-turn button. Manual mode advances per-character via the
   spell-rail buttons in each character frame. The pause button stays so the
   in-game menu remains reachable. */
/* M405 — only HIDE the speed selector + step-turn button when manual combat
   is active. With auto-combat on, the speed button must remain visible so
   players can still adjust pacing. */
.cbt-hud--ev-overlay.manual-combat-on #hud-speed,
.cbt-hud--ev-overlay.manual-combat-on #hud-next-turn { display: none !important; }
.hud-tap-btn { width: 44px; height: 44px; background: rgba(0,0,0,0.55); border: 1px solid rgba(232,160,32,0.35); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; margin-left: 4px; }
.hud-tap-btn.is-ready { animation: tap-pulse 1.6s ease-in-out infinite; }
.hud-tap-btn.is-empty { opacity: 0.4; }
@keyframes tap-pulse { 0%,100% { box-shadow: 0 0 0 rgba(232,160,32,0); } 50% { box-shadow: 0 0 10px rgba(232,160,32,0.55); } }
.hud-tap-btn canvas { width: 40px; height: 40px; }
.cbt-pause-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.78);
  display: flex; align-items: center; justify-content: center;
  /* M336 — pause must sit above the captions bar (800) and damage meter
     (920) so it can't be visually obscured. */
  z-index: 1000; pointer-events: auto;
}
.cpo-box {
  background: #100c18; border: 1px solid rgba(112,64,192,0.4);
  border-radius: 14px; padding: 2rem; text-align: center;
  max-width: 320px; width: 90%; animation: cemIn 0.2s ease;
}
.cpo-title { font-family: 'Cinzel', serif; font-size: 1.2rem; font-weight: 900; color: #f0e8d8; margin-bottom: 1.5rem; letter-spacing: 0.08em; }
.cpo-actions { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
.cpo-btn {
  padding: 0.8rem 1.5rem; background: rgba(232,160,32,0.12);
  border: 1px solid rgba(232,160,32,0.4); border-radius: 8px;
  color: #e8a020; font-family: 'Cinzel', serif; font-weight: 700;
  cursor: pointer; min-height: 52px; font-size: 0.9rem;
  transition: background 0.15s;
}
.cpo-btn:hover:not(:disabled) { background: rgba(232,160,32,0.24); }
.cpo-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cpo-btn-flee { border-color: rgba(80,200,120,0.4); color: #60d080; background: rgba(80,200,120,0.08); }
.cpo-btn-flee:hover:not(:disabled) { background: rgba(80,200,120,0.18); }
.cpo-btn-danger { border-color: rgba(192,64,48,0.35); color: #c06050; background: rgba(192,64,48,0.08); font-size: 0.78rem; }
.cpo-btn-danger:hover { background: rgba(192,64,48,0.16); }
.cpo-btn-settings { border-color: rgba(160,80,255,0.4); color: #b87fff; background: rgba(160,80,255,0.08); font-size: 0.78rem; }
.cpo-btn-settings:hover { background: rgba(160,80,255,0.18); }
.cpo-settings-row { display: flex; align-items: center; padding: 0.35rem 0; }
.cpo-settings-lbl { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.8rem; color: #c0b090; }
.cpo-settings-cb { accent-color: #b87fff; width: 16px; height: 16px; margin: 0; cursor: pointer; }
.cpo-settings-sub { padding-left: 0.5rem; }
.cpo-hint { font-size: 0.68rem; color: #8a7a6a; }
.cpo-potions-title { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a7a6a; margin: 0.75rem 0 0.4rem; }
.cpo-potions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; justify-content: center; }
.cpo-potion-btn { padding: 0.4rem 0.7rem; background: rgba(80,200,120,0.1); border: 1px solid rgba(80,200,120,0.3); border-radius: 6px; color: #90d8a8; font-size: 0.72rem; cursor: pointer; min-height: 44px; transition: background 0.15s; }
.cpo-potion-btn:hover { background: rgba(80,200,120,0.2); }
.cpo-potion-btn.selected { border-color: rgba(80,200,120,0.7); background: rgba(80,200,120,0.22); }
.cpo-target-label { font-size: 0.6rem; color: #8a7a6a; margin-bottom: 0.3rem; }
.cpo-targets { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem; justify-content: center; }
.cpo-target-btn { padding: 0.35rem 0.6rem; background: rgba(64,128,192,0.12); border: 1px solid rgba(64,128,192,0.3); border-radius: 5px; color: #80b8e0; font-size: 0.65rem; cursor: pointer; min-height: 44px; }
.cpo-target-btn:hover { background: rgba(64,128,192,0.24); }
.cpo-dead { color: #8a7a6a; border-color: rgba(255,255,255,0.1); }
.cbt-end-modal {
  position: absolute; inset: 0; display: flex;
  align-items: center; justify-content: center;
  background: rgba(0,0,0,0.72); pointer-events: auto;
  /* M336 — victory/defeat modal sits above captions + meter. */
  z-index: 1010;
}
.cem-box {
  background: #120a10; border: 1px solid rgba(232,160,32,0.3);
  border-radius: 12px; padding: 2rem; text-align: center;
  max-width: 340px; width: 90%; animation: cemIn 0.4s ease;
  max-height: 90vh; overflow-y: auto;
}
@keyframes cemIn{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}
.cem-title { font-family: 'Cinzel', serif; font-size: 1.5rem; font-weight: 900; margin-bottom: 1rem; }
.cem-rewards { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 1.5rem; }
.cer { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 0.6rem; }
.cer span { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8a7a6a; }
.cer strong { display: block; font-family: 'Cinzel', serif; font-size: 1.1rem; color: #e8a020; margin-top: 0.2rem; }
.cem-body { font-size: 0.85rem; color: #c0b090; line-height: 1.6; margin-bottom: 1.5rem; }
.cem-btn {
  padding: 0.75rem 2rem; background: rgba(232,160,32,0.15);
  border: 1px solid rgba(232,160,32,0.4); border-radius: 6px;
  color: #e8a020; font-family: 'Cinzel', serif; font-weight: 700;
  cursor: pointer; min-height: 44px;
}
.cem-btn:hover { background: rgba(232,160,32,0.28); }

/* M296: Combat captions bar.
   M402 — captions ride directly above whichever HUD is mounted. The legacy
   hud (no .cbt-hud--ev-overlay) is much shorter than the new ev-hud frame,
   so the default sits at ~80px above the bottom; the :has() rules below
   bump it up only when the new HUD is present. */
.cbt-captions {
  display: none;
  position: absolute; bottom: 80px; left: 0; right: 0;
  padding: 0.5rem 1rem 1.2rem;
  background: linear-gradient(transparent, rgba(4,2,6,0.85));
  pointer-events: none; z-index: 800;
  flex-direction: column; gap: 0.25rem; align-items: flex-start;
  max-height: 80px; overflow: hidden;
}
/* M385 P0: on smallest mobile, push captions further above potion-belt + HUD stack */
@media (max-width: 450px) {
  .cbt-captions { bottom: 110px; max-height: 70px; }
}
/* M393 — when the new combat HUD is mounted, captions need to clear the
   .ev-hud frames (~220px) instead of the legacy hud (~80px). */
.combat-screen:has(.cbt-hud--ev-overlay) .cbt-captions { bottom: 240px; }
.combat-screen:has(.cbt-hud--ev-overlay):has(.ev-hud--no-companions) .cbt-captions { bottom: 180px; }
@media (max-width: 700px) {
  .combat-screen:has(.cbt-hud--ev-overlay) .cbt-captions { bottom: 220px; }
  .combat-screen:has(.cbt-hud--ev-overlay):has(.ev-hud--no-companions) .cbt-captions { bottom: 170px; }
}
.cbt-captions.cbt-captions-active { display: flex; }
.cbt-caption-line {
  font-size: 1.25rem; line-height: 1.35; font-weight: 600;
  color: #f0e8d8; text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  max-width: 90%; transition: opacity 0.4s ease;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cbt-caption-fading { opacity: 0.45; font-size: 1rem; }

/* M303: Champion modifier tooltip overlay */
.champ-info-tip {
  position: fixed;
  z-index: 9500;
  background: rgba(10,6,20,0.95);
  border: 1px solid #4488ff;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  max-width: 220px;
  min-width: 160px;
  color: #d0e0ff;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.68rem;
  line-height: 1.45;
  box-shadow: 0 4px 18px rgba(40,80,200,0.45);
  pointer-events: none;
  animation: champTipIn 0.12s ease-out;
}
@keyframes champTipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.champ-tip-title {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  font-weight: 700;
  color: #6699ff;
  margin-bottom: 0.4rem;
  letter-spacing: 0.04em;
}
.champ-tip-mod {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
  color: #c0d0f0;
}
.champ-tip-badge {
  display: inline-block;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 0.6rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  margin-top: 1px;
  line-height: 1.4;
}

/* ── M307 Boss Death Cinematic ───────────────────────────────────────────── */
@keyframes bdc-in  { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
@keyframes bdc-out { from { opacity:1; transform:scale(1); }   to { opacity:0; transform:scale(1.04); } }
.boss-death-cinematic {
  position: absolute; inset: 0; z-index: 9100;
  background: rgba(2,0,8,0.96);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 2rem 1.5rem; box-sizing: border-box;
  user-select: none;
}
.bdc-inner {
  display: flex; flex-direction: column;
  align-items: center; gap: 1.25rem;
  max-width: 340px; width: 100%;
  animation: bdc-in 0.55s ease-out;
}
.bdc-inner.bdc-no-anim { animation: none; }
.boss-death-cinematic.bdc-fade-out .bdc-inner {
  animation: bdc-out 0.55s ease-in forwards;
}
.bdc-skull {
  font-size: 2.4rem;
  color: rgba(232,80,32,0.85);
  line-height: 1;
  filter: drop-shadow(0 0 18px rgba(232,80,32,0.55));
}
.bdc-lines {
  display: flex; flex-direction: column; gap: 0.8rem;
  width: 100%; text-align: center;
}
.bdc-boss-line {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(0.82rem, 3.8vw, 0.98rem);
  color: rgba(200,160,80,0.9);
  font-style: italic;
  line-height: 1.5;
  margin: 0;
}
.bdc-hero-line {
  font-family: 'Inter', sans-serif;
  font-size: clamp(0.78rem, 3.4vw, 0.9rem);
  color: rgba(200,220,240,0.85);
  line-height: 1.45;
  margin: 0;
}
.bdc-narrator-line {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(0.74rem, 3.2vw, 0.84rem);
  color: rgba(160,140,100,0.7);
  font-style: italic;
  line-height: 1.45;
  border-top: 1px solid rgba(200,160,80,0.15);
  padding-top: 0.65rem;
  margin: 0;
}
.bdc-continue {
  margin-top: 0.5rem;
  background: rgba(200,80,32,0.18);
  border: 1px solid rgba(200,80,32,0.5);
  color: #e8c090;
  padding: 0.6rem 1.8rem;
  border-radius: 5px;
  font-size: 0.82rem;
  font-family: 'Cinzel', Georgia, serif;
  letter-spacing: 0.06em;
  cursor: pointer;
  min-height: 44px; min-width: 120px;
}
.bdc-continue:hover { background: rgba(200,80,32,0.32); }
@media (prefers-reduced-motion: reduce) {
  .bdc-inner { animation: none; }
  .boss-death-cinematic.bdc-fade-out .bdc-inner { animation: none; }
}
`;

