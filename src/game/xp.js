/**
 * XP and leveling system
 */
import { computeMaxHp, computeMaxMp } from './passives.js';
import { getBalance } from './balance-loader.js';

// Back-compat export. Callers should prefer getBalance().progression.xpTable
// so runtime config swaps take effect; this constant reflects the CURRENT
// active balance at module-evaluation time.
export const XP_TABLE = getBalance().progression.xpTable.slice();

export function expectedTalentPoints(level) {
  const levels = getBalance().progression.talentPointLevels;
  return levels.filter(l => l <= (level || 1)).length;
}

export function xpForLevel(level) {
  const tbl = getBalance().progression.xpTable;
  return tbl[Math.min(level - 1, tbl.length - 1)] || 0;
}

export function xpForNextLevel(level) {
  const tbl = getBalance().progression.xpTable;
  const max = getBalance().progression.maxLevel;
  if (level >= max) return null;
  return tbl[level] || null;
}

export function getLevelFromXp(xp) {
  const tbl = getBalance().progression.xpTable;
  for (let lvl = tbl.length; lvl >= 1; lvl--) {
    if (xp >= tbl[lvl - 1]) return lvl;
  }
  return 1;
}

/**
 * Check if a character should level up and apply it
 * Returns true if leveled up
 */
export function checkLevelUp(char) {
  const newLevel = getLevelFromXp(char.xp || 0);
  const prog = getBalance().progression;
  if (newLevel > (char.level || 1) && newLevel <= prog.maxLevel) {
    const oldLevel = char.level || 1;
    char.level = newLevel;
    const talentLevels = prog.talentPointLevels;
    const passiveStep = prog.passivePointEveryNLevels;
    let attrGain = 0, skillGain = 0, passiveGain = 0;
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      attrGain += prog.statPointsPerLevel;
      if (talentLevels.includes(lvl)) skillGain += 1;
      if (lvl % passiveStep === 0) passiveGain += 1;
    }
    if (attrGain > 0) char.pendingAttrPoints = (char.pendingAttrPoints || 0) + attrGain;
    if (skillGain > 0) char.pendingSkillPoints = (char.pendingSkillPoints || 0) + skillGain;
    if (passiveGain > 0) char.pendingPassivePoints = (char.pendingPassivePoints || 0) + passiveGain;
    // Remember award delta for the LevelUpScreen summary panel.
    char._lastLevelUp = {
      from: oldLevel, to: newLevel,
      attr: attrGain, skill: skillGain, passive: passiveGain,
    };
    // M412 — fire global achievement check on level-up so the "Seasoned
    // Veteran" (level 10) etc. unlock immediately rather than waiting for
    // the player to visit the tavern.
    try {
      import('../ui/screens/AchievementsScreen.js').then(m => {
        try { m.checkGameStateAchievements?.(); } catch (_) {}
      }).catch(() => {});
    } catch (_) {}
    // Recalculate max HP/MP (includes passive bonuses).
    char.maxHp = computeMaxHp(char);
    char.maxMp = computeMaxMp(char);
    // Heal to full on level up
    char.hp = char.maxHp;
    char.mp = char.maxMp;
    // M330 — analytics milestone event.
    try {
      if (typeof window !== 'undefined' && typeof window.__rsgPushEvent === 'function') {
        window.__rsgPushEvent('level_up', {
          hero_class: char.class,
          new_level: newLevel,
        });
      }
    } catch (_) {}
    return true;
  }
  return false;
}

/**
 * Compute catch-up XP multiplier for a member vs. party average level.
 * 1 level below = 1.5x, 2 below = 2x, capped at 3x (4+ levels behind).
 * Returns the multiplier (1.0 if member.level >= partyAvgLevel).
 */
export function catchUpMultiplier(memberLevel, partyAvgLevel) {
  const gap = partyAvgLevel - memberLevel;
  if (gap <= 0) return 1;
  return Math.min(3, 1 + 0.5 * gap);
}

/**
 * Award XP to all party members and check level ups.
 * Returns array of { name, level, xpGained, catchUpMult } for members who leveled up
 * plus a xpLog array ({ name, xpGained, catchUpMult }) for toast display.
 */
export function awardXp(party, xpAmount) {
  // M276 D15 — Hard difficulty grants +10% XP. Composes multiplicatively
  // with any future GLOBAL_XP_MULT and cheat multiplier; a no-op on Easy/Normal.
  let mult = 1;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('emberveil_difficulty') === 'hard') {
      mult *= 1.10;
    }
  } catch {}
  // M314 — XP catch-up: compute party average level across all members receiving XP.
  const partyAvgLevel = party.length > 0
    ? party.reduce((sum, m) => sum + (m.level || 1), 0) / party.length
    : 1;

  const levelUps = [];
  for (const member of party) {
    const catchMult = catchUpMultiplier(member.level || 1, partyAvgLevel);
    const baseXp = Math.round(xpAmount * mult);
    const memberXp = Math.round(baseXp * catchMult);
    // M412 — removed M342/M347 per-encounter XP cap that limited a single
    // fight to ≤1.25 levels. The cap was a hacky workaround that conflicted
    // with the catch-up multiplier (members 4+ levels behind got 3× XP, then
    // had it clamped back to 1.25 levels — net zero benefit). Catch-up does
    // the rate-limiting now; the cap is gone.
    member.xp = (member.xp || 0) + memberXp;
    const didLevelUp = checkLevelUp(member);
    if (didLevelUp) {
      levelUps.push({ name: member.name, level: member.level, xpGained: memberXp, catchUpMult: catchMult });
      // M288 — sample power on level-up so the Power growth chart spikes
      // visibly when a hero gains a level.
      try {
        Promise.all([
          import('./stats.js'),
          import('./powerScore.js'),
        ]).then(([stats, ps]) => {
          stats.recordPowerSnapshot(member.id, ps.computePowerScore(member));
        });
      } catch (_) {}
    }
  }
  return levelUps;
}
