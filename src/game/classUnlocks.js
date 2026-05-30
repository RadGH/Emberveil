/**
 * classUnlocks.js — persistent global class unlock system
 *
 * New players start with only 5 classes (warrior, fighter, ranger, rogue, mage).
 * All others unlock via achievements, completing acts, levels, or in-game milestones.
 * Unlocks persist across new games via localStorage (key: 'emberveil_unlocks').
 */
import { CLASSES } from './classes.js';

const STORAGE_KEY = 'emberveil_unlocks';

/** The 5 classes always available from the start. No healers — harder first experience. */
export const STARTING_CLASS_IDS = ['warrior', 'fighter', 'ranger', 'rogue', 'mage'];

/**
 * Unlock requirements for every non-starting class.
 * Matches the `unlockRequirement` field on each CLASSES entry.
 * type: 'achievement' | 'act' | 'level' | 'boss' | 'win' | 'gold' | 'rareItems'
 */
export const UNLOCK_REQUIREMENTS = {
  paladin:      { type: 'act', value: 1, label: 'Complete Act 1' },
  cleric:       { type: 'act', value: 1, label: 'Complete Act 1' },
  // M455: lowered from 500 → 50. Players were reaching level 20 + completing
  // the game without ever crossing 500 kills (most fights end the act in
  // 60-100 enemies; even three full runs left players short).
  pyromancer:   { type: 'achievement', value: 'kill_50', label: 'Slay 50 enemies' },
  necromancer:  { type: 'act', value: 2, label: 'Complete Act 2' },
  warlock:      { type: 'achievement', value: 'low_hp_boss', label: 'Kill a boss below 20% HP' },
  bard:         { type: 'act', value: 2, label: 'Complete Act 2' },
  druid:        { type: 'act', value: 2, label: 'Complete Act 2' },
  stormcaller:  { type: 'level', value: 20, label: 'Reach hero level 20' },
  dragon_knight:{ type: 'boss', value: 'dragon', label: 'Defeat the Dragon boss' },
  demon_hunter: { type: 'act', value: 3, label: 'Complete Act 3' },
  chronomancer: { type: 'act', value: 4, label: 'Complete Act 4' },
  oracle:       { type: 'win', value: true, label: 'Complete the game' },
  tactician:    { type: 'act', value: 3, label: 'Complete Act 3' },
  swashbuckler: { type: 'gold', value: 1000, label: 'Accumulate 1,000 gold' },
  scavenger:    { type: 'rareItems', value: 10, label: 'Find 10 rare items' },
  // M151 — phantom classes
  monk:         { type: 'level', value: 10, label: 'Reach hero level 10' },
  shaman:       { type: 'act', value: 1, label: 'Complete Act 1' },
  witch_hunter: { type: 'act', value: 2, label: 'Complete Act 2' },
  knight:       { type: 'act', value: 1, label: 'Complete Act 1' },
  sorcerer:     { type: 'level', value: 15, label: 'Reach hero level 15' },
  runesmith:    { type: 'rareItems', value: 5, label: 'Find 5 rare items' },
  shadow_dancer:{ type: 'act', value: 2, label: 'Complete Act 2' },
  // M269: Tinker — unlocks after Act 1, thematically fits the "workshop town" vibe of Ashfort.
  tinker:       { type: 'act', value: 1, label: 'Complete Act 1' },
  // M398: Enchanter — mind-magic specialist with Sleep / Charm. Gates behind
  // Act 2 since the Sleep effect punches above its weight on small enemy
  // packs and we want it to land in the rebalance band, not Act 1 fluff.
  enchanter:    { type: 'act', value: 2, label: 'Complete Act 2' },
  // M399: Priest — dusk-vigil holy/shadow caster. Unlocks alongside Cleric
  // (Act 1 completion) since both fill the primary healer slot and we want
  // players to choose between them as soon as the role exists.
  priest:       { type: 'act', value: 1, label: 'Complete Act 1' },
};

function _read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { classes: [] };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.classes)) data.classes = [];
    return data;
  } catch {
    return { classes: [] };
  }
}

function _write(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  // M272: push class unlocks to Supabase when signed in. Fire-and-forget;
  // failure never blocks the local write. Previously only save-prefixed
  // keys (emberveil_save_*) synced to cloud, so unlocks silently stayed
  // local — a player signing in on a new device lost all class unlocks.
  try {
    if (typeof window !== 'undefined' && window.__cloudSaves?.isAvailable) {
      window.__cloudSaves.pushSave(STORAGE_KEY, data);
    }
  } catch (_) {}
}

/** Returns the set of all class ids unlocked for the player (starting 5 + persistent unlocks).
 *  If the cheat "unlock all classes" flag is active, returns every known class id. */
export function getUnlockedClassIds() {
  if (window.__cheatUnlockAllClasses) {
    // M242 fix: CLASSES is an ARRAY of {id,...} objects, so
    // Object.keys(CLASSES) was returning array indices ('0','1',...)
    // instead of class ids — which made the cheat read as "no classes
    // unlocked" when queried against id strings downstream.
    return new Set(CLASSES.map(c => c.id));
  }
  const data = _read();
  return new Set([...STARTING_CLASS_IDS, ...data.classes]);
}

export function isClassUnlocked(classId) {
  if (window.__cheatUnlockAllClasses) return true;
  if (STARTING_CLASS_IDS.includes(classId)) return true;
  return _read().classes.includes(classId);
}

/** Unlock a class by id. Returns true if newly unlocked. */
export function unlockClass(classId) {
  if (STARTING_CLASS_IDS.includes(classId)) return false;
  const data = _read();
  if (data.classes.includes(classId)) return false;
  data.classes.push(classId);
  _write(data);
  // M330 — analytics milestone event.
  try {
    if (typeof window !== 'undefined' && typeof window.__rsgPushEvent === 'function') {
      window.__rsgPushEvent('class_unlocked', { class_id: classId });
    }
  } catch (_) {}
  return true;
}

/** Returns unlock requirement metadata for a class id (or null if starter/unknown). */
export function getUnlockRequirement(classId) {
  return UNLOCK_REQUIREMENTS[classId] || null;
}

/**
 * checkUnlockTriggers — call when a relevant event happens.
 * Returns an array of newly unlocked class ids (may be empty).
 *
 * Events:
 *   ('achievement', achievementId)
 *   ('act', actNumber)            — player just completed Act N
 *   ('level', newLevel)           — any hero reached newLevel
 *   ('boss', bossId)              — boss defeated
 *   ('win', true)                 — game completed
 *   ('gold', totalGold)           — current gold total
 *   ('rareItems', count)          — total rare items ever found
 */
export function checkUnlockTriggers(event, data) {
  const newly = [];
  for (const [classId, req] of Object.entries(UNLOCK_REQUIREMENTS)) {
    if (isClassUnlocked(classId)) continue;
    let match = false;
    if (req.type === event) {
      if (req.type === 'act' || req.type === 'level' || req.type === 'gold' || req.type === 'rareItems') {
        match = (data >= req.value);
      } else if (req.type === 'achievement' || req.type === 'boss') {
        match = (data === req.value);
      } else if (req.type === 'win') {
        match = !!data;
      }
    }
    if (match && unlockClass(classId)) newly.push(classId);
  }
  return newly;
}

/** Total number of classes in the game (for the "X / N unlocked" counter). */
export function getTotalClassCount() { return CLASSES.length; }

/**
 * syncFromGameState — polls the active GameState and unlocks any classes whose
 * requirements are currently satisfied. Called on entry to Achievements and
 * Character Builder screens, which is where the unlock UI shows up anyway,
 * so the "delay until next open" is imperceptible in practice.
 */
export function syncFromGameState(gs) {
  if (!gs) return [];
  const newly = [];
  const push = (ids) => { for (const id of ids) newly.push(id); };

  // Acts — use unlockedZones as the "completed prior act" proxy, matching
  // AchievementsScreen's own definitions (act 1 done => dust_roads unlocked,
  // act 2 done => hell_breach unlocked, act 3 done => cosmic_rift unlocked).
  const zones = gs.unlockedZones || [];
  if (zones.includes('dust_roads'))  push(checkUnlockTriggers('act', 1));
  if (zones.includes('hell_breach')) push(checkUnlockTriggers('act', 2));
  if (zones.includes('cosmic_rift')) push(checkUnlockTriggers('act', 3));
  if (gs.completedBosses?.includes('void_boss')) push(checkUnlockTriggers('act', 4));

  // Win (Emberveil Sovereign OR Unraveler defeated counts as completion)
  if (gs.completedBosses?.includes('core_boss') || gs.completedBosses?.includes('void_boss')) {
    push(checkUnlockTriggers('win', true));
  }

  // Level — highest level on any party member
  const topLevel = Math.max(1, ...(gs.party || []).map(m => m.level || 1));
  push(checkUnlockTriggers('level', topLevel));

  // Gold
  push(checkUnlockTriggers('gold', gs.gold || 0));

  // M455 — Rare-items unlock for Scavenger now uses a LIFETIME counter
  // (gs.lifetimeRareCount) instead of the current-inventory count. The
  // current-inventory path silently broke for any player who sold or
  // replaced rares as they leveled. The lifetime counter is incremented
  // in GameState.addToInventory whenever a rare/epic/legendary lands.
  // The current-inventory count is kept as a fallback so existing saves
  // (without the lifetime field) still trigger off snapshot data.
  const rareCurrent = (gs.inventory || []).filter(i =>
    i && (i.rarity === 'rare' || i.rarity === 'epic' || i.rarity === 'legendary')
  ).length;
  const rareCount = Math.max(gs.lifetimeRareCount || 0, rareCurrent);
  push(checkUnlockTriggers('rareItems', rareCount));

  // Boss-specific unlocks — dragon_knight wants ANY completed boss that
  // is a dragon. Bosses can be stored as either raw enemyId strings or
  // objects with id/enemyId/zoneId fields, so accept both shapes and
  // match against several known dragon variants (M455).
  const DRAGON_BOSS_PATTERNS = [
    'dragon', 'wyrm', 'drake', 'bahamoth', 'bahamorth', 'frost_wyrm',
    'storm_dragon', 'dragon_king', 'dragonking', 'ancient_dragon',
  ];
  for (const b of (gs.completedBosses || [])) {
    const id = (typeof b === 'string') ? b : (b?.id || b?.enemyId || b?.bossId || '');
    const lower = String(id).toLowerCase();
    if (DRAGON_BOSS_PATTERNS.some(p => lower.includes(p))) {
      push(checkUnlockTriggers('boss', 'dragon'));
      break;
    }
  }

  // M455 — Pyromancer now unlocks at 50 kills (was 500). The trigger
  // string is renamed kill_500 → kill_50 to match the new
  // UNLOCK_REQUIREMENTS entry. Both are checked here so legacy saves
  // that already crossed 500 still resolve.
  const totalKills = gs.enemyKillCount || 0;
  if (totalKills >= 50) push(checkUnlockTriggers('achievement', 'kill_50'));
  if (totalKills >= 500) push(checkUnlockTriggers('achievement', 'kill_500'));
  if ((gs.bossKillsLowHp || []).length > 0) {
    push(checkUnlockTriggers('achievement', 'low_hp_boss'));
  }
  return newly;
}
