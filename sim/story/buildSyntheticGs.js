/**
 * buildSyntheticGs.js — Synthesizes a gs-shaped object suitable for storyMode
 * functions WITHOUT touching localStorage or any browser API.
 *
 * DETERMINISM GUARANTEE: All outputs are byte-identical for the same inputs.
 * Equipment is built from base stats only (no random affixes — normal rarity).
 * IDs are deterministic strings, not UUIDs.
 *
 * Node-only. Safe to call from worker threads.
 *
 * @param {object} opts
 * @param {number|string} opts.seed         - numeric or hex string seed
 * @param {string}        opts.storytellerId
 * @param {string}        opts.difficulty
 * @param {object[]}      [opts.partyTemplate] - array of {cls, level} (up to 4)
 *
 * @returns {object} gs-shaped plain object; __synthetic: true marker is set.
 */

import { autoAssignAttrs } from '../../src/game/simulator.js';
import { createStoryLedger } from '../../src/story/storyLedger.js';
import { CLASSES } from '../../src/game/classes.js';
import { generateItem } from '../../src/game/items.js';

// ---------------------------------------------------------------------------
// Default party template
// M-S28 fix: bumped to level 10 so threshold checks are satisfiable.
// Synthetic parties have no real equipment bonuses so they need high base
// HP to survive the encounters designed for geared characters.
// Level-1 heroes die to every act-1 encounter making balance metrics useless.
// ---------------------------------------------------------------------------
const DEFAULT_PARTY_TEMPLATE = [
  { cls: 'warrior', level: 10 },
  { cls: 'mage',    level: 10 },
  { cls: 'ranger',  level: 10 },
  { cls: 'cleric',  level: 10 },
];

/**
 * Convert a numeric or hex-string seed to a uint32 integer.
 */
function normalizeSeed(seed) {
  if (typeof seed === 'number') return (seed | 0) >>> 0 || 1;
  const n = parseInt(String(seed), 16);
  if (!Number.isNaN(n) && isFinite(n)) return n >>> 0 || 1;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  return h || 1;
}

/**
 * Build a DETERMINISTIC equipment bundle for a class at a given level.
 *
 * Uses generateItem with 'normal' rarity (no random affixes) and replaces
 * the UUID id with a stable deterministic string. Higher levels get 'magic'
 * or 'rare' rarity with the SAME affix count each time, selected by seeded
 * picks rather than Math.random.
 *
 * For byte-parity, we use 'normal' rarity only — no affixes = no variance.
 * The attrribute block (autoAssignAttrs) is already deterministic.
 * M-S16+ can introduce benchmark-pack gear once the encounter builder
 * provides encounter-level scaling.
 */
function buildDeterministicEquipment(cls, level, memberIdx) {
  const classDef = CLASSES.find(c => c.id === cls);
  const keys = classDef?.startingEquipment || [];
  const equipment = {};
  let sawWeapon = false;
  let sawRing = false;

  for (let i = 0; i < keys.length; i++) {
    let item;
    try {
      // Always use 'normal' rarity for zero-affix deterministic output.
      item = generateItem(keys[i], 'normal', 'medium');
    } catch (_) {
      continue;
    }
    if (!item) continue;

    // Replace the random UUID with a stable deterministic id.
    item = { ...item, id: `sim_${cls}_${i}_l${level}_m${memberIdx}` };
    // Remove any affixes that may have leaked in (shouldn't happen at normal rarity).
    item.affixes = [];

    let slot = item.type || 'body';
    if (slot === 'weapon') {
      if (sawWeapon) slot = 'offhand'; else sawWeapon = true;
    } else if (slot === 'ring') {
      if (sawRing) slot = 'ring2'; else sawRing = true;
    }
    equipment[slot] = item;
  }

  return equipment;
}

/**
 * Build one hero member from a template entry.
 */
function buildHeroMember(tmpl, idx) {
  const cls = String(tmpl.cls || 'warrior').toLowerCase();
  const level = Math.max(1, (tmpl.level || 1) | 0);

  const attrs = tmpl.attrs || autoAssignAttrs(cls, level);
  const equipment = tmpl.equipment || buildDeterministicEquipment(cls, level, idx);

  const classDef = CLASSES.find(c => c.id === cls);
  const className = classDef ? classDef.name : cls.charAt(0).toUpperCase() + cls.slice(1);

  // Scale HP/MP with level. The synthetic party has no real equipment bonuses,
  // so multiply by 3x to emulate a geared character. At level 10 this gives
  // 100+9*20 = 280 * 3 = 840 HP — enough to survive act-1 encounter chains.
  // M-S28: balanced so act-1 completion on Normal >= 90%.
  const rawHp = 100 + (level - 1) * 20;
  const baseHp = rawHp * 3;
  const rawMp = 50 + (level - 1) * 10;
  const baseMp = rawMp * 2;

  return {
    id: `hero_${idx}_${cls}`,
    name: `${className} ${idx + 1}`,
    class: cls,
    cls,
    level,
    xp: 0,
    attrs,
    equipment,
    skills: [],
    passives: [],
    pendingAttrPoints: 0,
    pendingSkillPoints: 0,
    pendingPassivePoints: 0,
    hp:    baseHp,
    maxHp: baseHp,
    mp:    baseMp,
    maxMp: baseMp,
    alive: true,
    isCompanion: false,
    statuses: [],
  };
}

/**
 * Build a synthetic gs object.
 */
export function buildSyntheticGs({ seed, storytellerId = 'chronicler', difficulty = 'normal', partyTemplate } = {}) {
  const seedNum = normalizeSeed(seed != null ? seed : 1);

  // Resolve party template
  const tmplArray = Array.isArray(partyTemplate) && partyTemplate.length
    ? partyTemplate.slice(0, 4)
    : DEFAULT_PARTY_TEMPLATE.slice();

  const party = [];
  for (let i = 0; i < 4; i++) {
    const tmpl = tmplArray[i] || tmplArray[i % tmplArray.length];
    party.push(buildHeroMember(tmpl, i));
  }

  const campaignSeedHex = seedNum.toString(16).padStart(8, '0');

  const story = createStoryLedger({
    seed: campaignSeedHex,
    storytellerId,
    difficulty,
  });

  return {
    __synthetic: true,
    gameMode: 'story',
    version: 1,
    storyVersion: 1,
    party,
    gold: 0,
    inventory: [],
    fame: 0,
    story,
    act: story.act || 1,
    currentZone: null,
    storyFlags: story.flags,
    quests: story.quests,
    achievements: {},
    companions: [],
    activeCompanionId: null,
    settings: {
      disableBackgrounds: false,
      disableSprites: false,
      musicVolume: 0,
      sfxVolume: 0,
    },
    currentSaveKey: `synthetic_${campaignSeedHex}`,
  };
}
