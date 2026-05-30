/**
 * fame.js — M308 Fame unlock system.
 *
 * Fame is a global score on GameState. This module provides:
 *  - FAME_THRESHOLDS: ordered list of unlock milestones
 *  - FAME_UNLOCK_COUNTS: how many extra slots each milestone grants
 *  - getExtraUnlocks(fame): number of additional slots unlocked (0–5)
 *  - getUnlockedAppearances(classId, fame): array of appearance ids
 *  - getUnlockedWeaponVarieties(classId, fame): array of startingEquipment keys
 *  - getNextFameThreshold(fame): next target or null if maxed
 *  - fameSummaryText(fame): player-facing string ("Fame: 1,250 — unlocks 4 extra appearances per class")
 *
 * Threshold map:
 *   100 fame → +1 extra
 *   250 fame → +2 extra
 *   500 fame → +3 extra
 *   1000 fame → +4 extra
 *   2000 fame → +5 extra
 *
 * Base slots (always available, no fame required):
 *   Appearances: first 5 per class (by classDefault)
 *   Weapon varieties: first 3 per class (by startingEquipment)
 */

import { APPEARANCES } from './appearances.js';
import { CLASSES } from './classes.js';
import { STARTING_CLASS_IDS } from './classUnlocks.js';

/** Ordered fame thresholds → cumulative extra slots unlocked. */
export const FAME_THRESHOLDS = [
  { fame: 100,  extra: 1 },
  { fame: 250,  extra: 2 },
  { fame: 500,  extra: 3 },
  { fame: 1000, extra: 4 },
  { fame: 2000, extra: 5 },
];

/** Max extra slots. */
export const MAX_EXTRA_UNLOCKS = 5;

/** How many base appearance slots are always available per class. */
export const BASE_APPEARANCES = 5;

/** How many base weapon-variety keys are always available per class. */
export const BASE_WEAPON_VARIETIES = 3;

/**
 * Returns the number of extra slots unlocked at a given fame total.
 * 0 at fame < 100, up to 5 at fame >= 2000.
 * @param {number} fame
 * @returns {number} 0–5
 */
export function getExtraUnlocks(fame) {
  const f = Number(fame) || 0;
  let extra = 0;
  for (const tier of FAME_THRESHOLDS) {
    if (f >= tier.fame) extra = tier.extra;
  }
  return extra;
}

/**
 * Total appearance slots available = BASE_APPEARANCES + getExtraUnlocks(fame).
 * @param {number} fame
 * @returns {number}
 */
export function getTotalAppearanceSlots(fame) {
  return BASE_APPEARANCES + getExtraUnlocks(fame);
}

/**
 * Total weapon variety slots = BASE_WEAPON_VARIETIES + getExtraUnlocks(fame).
 * @param {number} fame
 * @returns {number}
 */
export function getTotalWeaponVarietySlots(fame) {
  return BASE_WEAPON_VARIETIES + getExtraUnlocks(fame);
}

/**
 * Returns the next fame threshold the player has not yet reached, or null if maxed.
 * @param {number} fame
 * @returns {{ fame: number, extra: number }|null}
 */
export function getNextFameThreshold(fame) {
  const f = Number(fame) || 0;
  return FAME_THRESHOLDS.find(t => f < t.fame) || null;
}

/**
 * Human-readable fame summary for the character builder header.
 * e.g. "Fame: 1,250 — unlocks 4 extra appearances per class"
 * @param {number} fame
 * @returns {string}
 */
export function fameSummaryText(fame) {
  const f = Number(fame) || 0;
  const fmtFame = f.toLocaleString('en-US');
  // M322 — copy reflects the new per-appearance unlock model: own-class
  // appearances are always free; cross-class appearances unlock individually
  // as fame grows.
  return `Fame: ${fmtFame} — own-class appearances are always free; more cross-class options unlock as you earn fame.`;
}

/**
 * M322 — appearance unlock rework.
 *
 * Rules:
 *  - Same-class appearances (classDefault === classId) are ALWAYS available
 *    regardless of fame. This guarantees character-class consistency: pick a
 *    Mage and you can always use any Mage appearance, even at 0 fame.
 *  - Cross-class appearances unlock individually at varying fame thresholds
 *    (not the old "2000 fame = everything" all-or-nothing slot system).
 *  - The unlock cost per appearance scales with its position in the sorted
 *    cross-class list: slot 0 → 50 fame, slot 1 → 100, doubling roughly
 *    every few slots up to ~5000 fame for the very last entries.
 *
 * @param {string} classId  — the player's selected class id (own-class
 *                            appearances become free). Pass `null` to fall
 *                            back to the legacy fame-only behaviour.
 * @param {number} fame
 * @param {string} [genderFilter]  — 'all' | 'male' | 'female'
 * @returns {Array<{appearance: object, locked: boolean, unlockFame: number|null}>}
 */
export function getUnlockedAppearances(classId, fame, genderFilter = 'all') {
  const all = APPEARANCES.filter(
    a => !a.deprecated && a.gender !== 'companion' && a.classDefault !== 'companion' && a.playable !== false
  );

  // STABLE sort across the full set — does NOT depend on the gender filter.
  // The gender filter is applied at the very end as a display-only filter so
  // the unlock state for any individual appearance is identical regardless
  // of what filter the user picks. (Pre-M327 the sort+slot-count happened
  // INSIDE the filtered list, so toggling the gender filter changed which
  // cross-class slots were "default unlocked" — that's the bug where Bard /
  // Chronomancer / Cleric appeared at 0 fame and toggling Male added Demon
  // Hunter / Dragon Knight. Now the unlock decision is gender-agnostic.)
  const sorted = [...all].sort((a, b) => {
    const cmp = a.classDefault.localeCompare(b.classDefault);
    if (cmp !== 0) return cmp;
    const gA = a.gender === 'male' ? 0 : 1;
    const gB = b.gender === 'male' ? 0 : 1;
    return gA - gB;
  });

  const f = Number(fame) || 0;
  const STARTERS = new Set(STARTING_CLASS_IDS);

  // M336 — fame curve caps at 2,000 fame. Earlier slots unlock cheaply
  // so brand-new accounts feel the unlock cadence; the long tail compresses
  // into the same 2,000 ceiling so the achievable goalpost is finite.
  const APP_CURVE = [
     25,  50,  75, 100, 150, 200, 250, 300, 400, 500,
    600, 700, 800, 900,1000,1100,1200,1300,1400,1500,
   1600,1700,1800,1900,2000,
  ];
  const fameCostFor = (slotIdx) => {
    if (slotIdx < APP_CURVE.length) return APP_CURVE[slotIdx];
    return 2000;
  };

  // Compute unlock state for the full list FIRST.
  let crossSlot = 0;
  const withUnlock = sorted.map((app) => {
    // Default-unlocked: appearances tied to the 5 starter classes
    // (warrior / fighter / ranger / rogue / mage) — and their gender variants.
    // These are always free regardless of fame, so a brand-new account always
    // sees the right "starter" set in the picker, not the alphabetically-
    // first 5 (which used to be Bard / Chronomancer / Cleric — wrong).
    if (STARTERS.has(app.classDefault)) {
      return { appearance: app, locked: false, unlockFame: 0 };
    }
    // Own-class: when a class is selected, that class's appearances are
    // always free. (e.g. picking Paladin unlocks all Paladin variants.)
    if (classId && app.classDefault === classId) {
      return { appearance: app, locked: false, unlockFame: 0 };
    }
    const cost = fameCostFor(crossSlot);
    crossSlot += 1;
    return {
      appearance: app,
      locked: f < cost,
      unlockFame: cost,
    };
  });

  // M396 — surface unlocked appearances FIRST so the player sees their
  // available portraits before the locked tail. We use a stable sort that
  // preserves the class-grouped order within each band, so within
  // unlocked-or-locked the layout is unchanged.
  const stableBanded = withUnlock
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => {
      const la = a.entry.locked ? 1 : 0;
      const lb = b.entry.locked ? 1 : 0;
      if (la !== lb) return la - lb;
      return a.i - b.i;
    })
    .map(({ entry }) => entry);

  // THEN apply gender filter as a display-only filter — does not change
  // which appearances are unlocked, only which are visible.
  if (genderFilter === 'all') return stableBanded;
  return stableBanded.filter(e => e.appearance.gender === genderFilter);
}

/**
 * Returns weapon variety slots for a class. The class's startingEquipment
 * defines the base pool of weapons. Returns the first N entries as unlocked
 * where N = getTotalWeaponVarietySlots(fame). Additional entries are locked.
 *
 * @param {string} classId
 * @param {number} fame
 * @returns {Array<{key: string, locked: boolean, unlockFame: number|null}>}
 */
export function getUnlockedWeaponVarieties(classId, fame) {
  const cls = CLASSES.find(c => c.id === classId);
  if (!cls) return [];

  const equipment = cls.startingEquipment || [];
  // Weapon keys only (first weapon encountered per unique key)
  const seen = new Set();
  const weaponKeys = [];
  for (const key of equipment) {
    if (!seen.has(key)) {
      seen.add(key);
      weaponKeys.push(key);
    }
  }

  const totalSlots = getTotalWeaponVarietySlots(fame);

  return weaponKeys.map((key, idx) => {
    const extraNeeded = Math.max(0, idx - BASE_WEAPON_VARIETIES + 1);
    let unlockFame = null;
    if (extraNeeded > 0) {
      const tier = FAME_THRESHOLDS.find(t => t.extra >= extraNeeded);
      unlockFame = tier ? tier.fame : FAME_THRESHOLDS[FAME_THRESHOLDS.length - 1].fame;
    }
    return {
      key,
      locked: idx >= totalSlots,
      unlockFame,
    };
  });
}
