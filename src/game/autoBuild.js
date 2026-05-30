// Shared auto-build logic for spending pending attr/passive/skill points
// according to a member's autoBuild preferences. Used by:
//   - LevelUpScreen (on level-up for existing party)
//   - TownScreen (on tavern hire, to spend the catch-up points)
// Keeping the logic in one place prevents allocation drift.

import { GameState } from './gameState.js';

/**
 * Returns true when the player has the "Manual Characters" advanced option ON.
 * That gates auto-skill / auto-equip / auto-passive / auto-attribute UI.
 * Auto-combat (manualCombat toggle) is independent.
 *
 * (Previously this checked Hard difficulty. Hard no longer locks anything;
 * Manual Characters is now an explicit advanced option, default false.
 * The export name is kept for caller compatibility.)
 */
export function isHardDifficulty() {
  try { return !!GameState.get?.().manualCharacters; } catch { return false; }
}

import { CLASSES } from './classes.js';
import { getClassSkills, getUnlockedSkills } from './skills.js';
import { getPassiveTree, recalcPassiveStats, computeMaxHp, computeMaxMp } from './passives.js';
import { getBalance } from './balance-loader.js';
import { CLASS_PETS } from './companions.js';

/**
 * M396 — When an auto-purchased talent unlocks a companion (e.g. mage's
 * Arcane Familiar), spawn the pet and add it to the player's roster. Mirrors
 * SkillTreeScreen's manual-purchase path so auto-mode players actually
 * receive the companion the talent description promises.
 */
function _maybeUnlockCompanionFromTalent(member, talent) {
  const petId = talent?.effect?.unlocksCompanion;
  if (!petId) return;
  const template = CLASS_PETS[petId];
  if (!template) return;
  const pet = {
    ...template,
    id: petId + '_' + member.id,
    templateId: petId,
    ownerId: member.id,
    ownerName: member.name,
    level: member.level || 1,
    attrs: { ...template.attrs },
  };
  const lvlBonus = Math.floor(((member.level || 1) - 1) * 0.5);
  pet.attrs.STR += lvlBonus;
  pet.attrs.DEX += lvlBonus;
  pet.attrs.INT += lvlBonus;
  pet.attrs.CON += lvlBonus;
  pet.maxHp = 50 + pet.attrs.CON * 10;
  pet.hp = pet.maxHp;
  pet.maxMp = 10 + pet.attrs.INT * 3;
  pet.mp = pet.maxMp;
  const added = GameState.addToCompanions(pet);
  if (!added) { GameState.addToBench(pet); }
}

/**
 * Spend pending points according to m.autoBuild flags.
 * Mutates `m`. Returns a detail record of what was spent.
 */
export function autoApplyMember(m) {
  // M385 — auto-choices are disabled on Hard difficulty.
  if (isHardDifficulty()) return { attrs: {}, passives: {}, talents: [] };
  const auto = m.autoBuild || {};
  const detail = { attrs: {}, passives: {}, talents: [] };

  if (auto.auto_attrs && (m.pendingAttrPoints || 0) > 0) {
    const klass = CLASSES.find(c => c.id === m.class);
    const prim = klass?.primaryAttr || 'STR';
    let guard = 0;
    while ((m.pendingAttrPoints || 0) > 0 && guard++ < 200) {
      const base = m.baseAttrs || { STR: 8, DEX: 8, INT: 8, CON: 8 };
      const cur = m.attrs || (m.attrs = { ...base });
      const spentPrim = (cur[prim] || 0) - (base[prim] || 0);
      const spentCon = (cur.CON || 0) - (base.CON || 0);
      const total = spentPrim + spentCon;
      const pick = (total > 0 && spentCon / total < 0.2) ? 'CON' : prim;
      m.attrs[pick] = (m.attrs[pick] || 8) + 1;
      m.pendingAttrPoints -= 1;
      detail.attrs[pick] = (detail.attrs[pick] || 0) + 1;
    }
    try { m.maxHp = computeMaxHp(m); m.maxMp = computeMaxMp(m); } catch (_) {}
  }

  if (auto.auto_passive && (m.pendingPassivePoints || 0) > 0) {
    const tree = getPassiveTree(m.class);
    const EXOTIC = /lifesteal|life_steal|mana_regen|mana_steal|regen|lifebind|soulbind|exotic|leech|siphon/i;
    let guard = 0;
    while ((m.pendingPassivePoints || 0) > 0 && guard++ < 200) {
      if (!m.passiveRanks) m.passiveRanks = {};
      const exotic = tree.find(n => EXOTIC.test(n.id + ' ' + (n.name || '') + ' ' + (n.desc || '')) && (m.passiveRanks[n.id] || 0) < n.maxRank);
      const node = exotic || tree.find(n => (m.passiveRanks[n.id] || 0) < n.maxRank);
      if (!node) break;
      m.passiveRanks[node.id] = (m.passiveRanks[node.id] || 0) + 1;
      m.pendingPassivePoints -= 1;
      detail.passives[node.id] = (detail.passives[node.id] || { name: node.name, count: 0 });
      detail.passives[node.id].count += 1;
    }
    try { recalcPassiveStats(m); } catch (_) {}
  }

  if (auto.auto_active && (m.pendingSkillPoints || 0) > 0) {
    const skills = getClassSkills(m.class);
    const unlocked = getUnlockedSkills(m.class, m.level || 1);
    const owned = m.talentsPurchased || (m.talentsPurchased = {});
    const sorted = [...unlocked].sort((a, b) => (a.unlockLevel || 0) - (b.unlockLevel || 0));
    let guard = 0;
    while ((m.pendingSkillPoints || 0) > 0 && guard++ < 200) {
      let picked = null;
      outer: for (const skill of sorted) {
        const full = skills.find(s => s.name === skill.name) || skill;
        for (const t of (full.talents || [])) {
          if (!owned[t.id]) { picked = { skill: full, talent: t }; break outer; }
        }
      }
      if (!picked) break;
      owned[picked.talent.id] = true;
      // M396 — unlock companion if this talent has unlocksCompanion.
      try { _maybeUnlockCompanionFromTalent(m, picked.talent); } catch (_) {}
      // M283: ensure the parent skill is in m.skills so the combat AI picker
      // (which respects player-selected skills via partyMember.skills) can
      // actually use the talent's parent ability. Without this, auto-mode
      // characters had unlocked + talented skills but the AI filtered them
      // all out for basic attacks.
      if (!Array.isArray(m.skills)) m.skills = [];
      const skillId = picked.skill.id;
      if (skillId && !m.skills.includes(skillId)) m.skills.push(skillId);
      m.pendingSkillPoints -= 1;
      detail.talents.push({ skillName: picked.skill.name, talentName: picked.talent.name || picked.talent.id });
    }
  }

  return detail;
}

/**
 * Compute the pending-point catch-up for a character who is being created
 * at level N > 1 (tavern hire, generated companion, cheat menu, etc.) so
 * they receive the attr/skill/passive points they would have earned by
 * levelling 1 → N under the current balance progression.
 */
export function pendingPointsForLevel(level) {
  const prog = getBalance().progression;
  const talentLevels = prog.talentPointLevels || [3, 8, 13, 18, 23, 28];
  const passiveStep = prog.passivePointEveryNLevels || 2;
  let attr = 0, skill = 0, passive = 0;
  for (let l = 2; l <= level; l++) {
    attr += prog.statPointsPerLevel || 2;
    if (talentLevels.includes(l)) skill += 1;
    if (l % passiveStep === 0) passive += 1;
  }
  return { attr, skill, passive };
}
