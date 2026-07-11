/**
 * storySkillCheck.js — Skill check resolver (M-S18).
 *
 * Implements the 4-stat-with-skill-labels approach (Brainstorm §3 Option 1).
 *
 * resolveSkillCheck(gs, check, nodeId?)
 *   check = {
 *     skill: 'intimidation',   — display label; must match a key in skill-affinities.json
 *     stat:  'STR',            — one of STR|DEX|INT|CON
 *     dc:    12,               — difficulty class (integer 8–24)
 *     scaling?: 'act_level',   — optional scaling modifier
 *   }
 *
 * Returns:
 *   {
 *     pass:     boolean,
 *     partial:  boolean,   — pass within 3 points of dc (partial success)
 *     power:    number,    — final check score
 *     dc:       number,
 *     breakdown: {
 *       statValue, levelBonus, classAffinityBonus,
 *       storyFlagBonus, gearUtility, randomRoll, scalingBonus,
 *     }
 *   }
 */

import { mulberry32 } from '../game/simulator.js';

// ---------------------------------------------------------------------------
// Stat key mapping — canonical skill-check stat values
// ---------------------------------------------------------------------------
const STAT_KEYS = {
  STR: ['str', 'strength'],
  DEX: ['dex', 'dexterity', 'agility'],
  INT: ['int', 'intelligence', 'magic', 'spell'],
  CON: ['con', 'constitution', 'endurance'],
};

/**
 * Read the given stat from a party member.
 *
 * @param {object} member — party member object
 * @param {string} stat   — 'STR'|'DEX'|'INT'|'CON'
 * @returns {number}
 */
function _readStat(member, stat) {
  if (!member) return 8; // fallback floor
  const aliases = STAT_KEYS[stat] || [];
  for (const key of aliases) {
    if (typeof member[key] === 'number') return member[key];
  }
  // Also try the stat name directly (lowercase).
  const direct = member[stat.toLowerCase()];
  if (typeof direct === 'number') return direct;
  // Try stats sub-object.
  if (member.stats) {
    for (const key of aliases) {
      if (typeof member.stats[key] === 'number') return member.stats[key];
    }
  }
  return 8; // fallback
}

// ---------------------------------------------------------------------------
// Class affinity table — loaded lazily
// ---------------------------------------------------------------------------

let _affinityTable = null;

function _loadAffinityTable() {
  if (_affinityTable) return _affinityTable;

  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // Use globalThis.require to avoid ESLint no-undef on 'require' in ESM.
      const nodeFs   = globalThis.require?.('fs');
      const nodePath = globalThis.require?.('path');
      if (nodeFs && nodePath) {
        const filePath = nodePath.resolve(process.cwd(), 'data/story/skill-affinities.json');
        _affinityTable = JSON.parse(nodeFs.readFileSync(filePath, 'utf8'));
      }
    }
  } catch {
    // Fallback inline table (partial — just for safety).
    _affinityTable = _FALLBACK_AFFINITIES;
  }

  return _affinityTable || _FALLBACK_AFFINITIES;
}

/**
 * Inject an affinity table (used in tests).
 *
 * @param {object} table
 */
export function setAffinityTable(table) {
  _affinityTable = table;
}

/**
 * Look up class affinity bonus for a skill label.
 *
 * @param {string} className  — e.g. 'warrior'
 * @param {string} skillLabel — e.g. 'intimidation'
 * @returns {number}          — 0 or 2
 */
export function getClassAffinityBonus(className, skillLabel) {
  const table = _loadAffinityTable();
  const classRow = table[className?.toLowerCase()];
  if (!classRow) return 0;
  return classRow[skillLabel?.toLowerCase()] || 0;
}

// ---------------------------------------------------------------------------
// Gear utility score helper
// ---------------------------------------------------------------------------

/**
 * Compute a gear utility contribution from the party's equipped items.
 * Returns floor(total utility score / 10).
 * If no utility scoring is available, returns 0.
 *
 * @param {object[]} party
 * @returns {number}
 */
function _gearUtility(party) {
  let total = 0;
  for (const member of (party || [])) {
    // Try equipScore or a flat item utility sum.
    if (typeof member.equipScore === 'number') total += member.equipScore;
    else if (member.equipped) {
      // Count equipped items as a proxy.
      const itemCount = Object.values(member.equipped || {}).filter(Boolean).length;
      total += itemCount * 2;
    }
  }
  return Math.floor(total / 10);
}

// ---------------------------------------------------------------------------
// Per-node ephemeral RNG (§2.4 rule: seeded from rngState ^ hash(nodeId))
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash. */
function _hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// resolveSkillCheck — main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a skill check.
 *
 * @param {object} gs              — game state
 * @param {object} check           — { skill, stat, dc, scaling? }
 * @param {string} [nodeId]        — node id for ephemeral RNG (default: gs.story.currentNodeId)
 * @returns {object}               — { pass, partial, power, dc, breakdown }
 */
export function resolveSkillCheck(gs, check, nodeId) {
  const { skill, stat = 'STR', dc = 12, scaling } = check;
  const resolvedNodeId = nodeId || gs.story?.currentNodeId || '_default';

  // Leader = first living party member.
  const leader = (gs.party || []).find(m => m.alive !== false && m.hp > 0) || gs.party?.[0] || {};

  // ── Stat value ────────────────────────────────────────────────────────────
  const statValue = _readStat(leader, stat);

  // ── Level bonus: 1 point per 4 levels (or leader.level directly if small) ─
  const leaderLevel = leader.level || 1;
  const levelBonus = Math.floor(leaderLevel / 4) + 1; // at least 1

  // ── Class affinity bonus ──────────────────────────────────────────────────
  const leaderClass = (leader.class || leader.className || '').toLowerCase();
  const classAffinityBonus = getClassAffinityBonus(leaderClass, skill?.toLowerCase());

  // ── Story flag bonus ──────────────────────────────────────────────────────
  const flags = gs.story?.flags || {};
  const storyFlagBonus = flags[`skillcheck_bonus_${skill?.toLowerCase()}`] ? 2 : 0;

  // ── Gear utility ──────────────────────────────────────────────────────────
  const gearUtility = _gearUtility(gs.party || []);

  // ── Ephemeral RNG — seeded from rngState ^ hash(nodeId) ──────────────────
  const rngState = gs.story?.rngState || 1;
  const ephemeralSeed = (rngState ^ _hashStr(resolvedNodeId)) >>> 0 || 1;
  const rng = mulberry32(ephemeralSeed);
  rng(); // mix
  const randomRoll = 1 + Math.floor(rng() * 20); // d20

  // ── Scaling modifier ──────────────────────────────────────────────────────
  let scalingBonus = 0;
  if (scaling === 'act_level') {
    scalingBonus = (gs.story?.act || 1) * 2;
  }

  // ── Final power ───────────────────────────────────────────────────────────
  const checkPower = statValue + levelBonus + classAffinityBonus + storyFlagBonus + gearUtility + randomRoll + scalingBonus;

  return {
    pass:    checkPower >= dc,
    partial: !( checkPower >= dc ) && checkPower >= dc - 3,
    power:   checkPower,
    dc,
    breakdown: {
      statValue,
      levelBonus,
      classAffinityBonus,
      storyFlagBonus,
      gearUtility,
      randomRoll,
      scalingBonus,
    },
  };
}

// ---------------------------------------------------------------------------
// Fallback affinities (inline copy used when JSON file is unavailable)
// ---------------------------------------------------------------------------
const _FALLBACK_AFFINITIES = {
  warrior:     { strength: 2, intimidation: 2, medicine: 2 },
  rogue:       { stealth: 2, mechanisms: 2, deception: 2 },
  mage:        { arcana: 2, intelligence: 2, occult: 2 },
  ranger:      { nature: 2, survival: 2, perception: 2 },
  priest:      { religion: 2, medicine: 2, wisdom: 2 },
  monk:        { wisdom: 2, dexterity: 2, perception: 2 },
  shaman:      { nature: 2, occult: 2, wisdom: 2 },
  witch_hunter:{ occult: 2, perception: 2, intimidation: 2 },
  runesmith:   { crafting: 2, mechanisms: 2, arcana: 2 },
  tinker:      { mechanisms: 2, crafting: 2, perception: 2 },
};
