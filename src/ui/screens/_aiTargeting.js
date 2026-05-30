// M274: pure hero-AI skill picker extracted from CombatScreen._heroAI.
// Returns { kind: 'skill', skill } when a skill should be cast, or
// { kind: 'attack' } when the hero should fall through to a basic attack.
//
// Why pure: the AI policy is the highest sim-vs-playtest divergence surface
// (M261/M264 fixes). Pulling the policy into a pure function lets us pin it
// in tests so the next refactor can't silently regress.
//
// Caller is responsible for consuming `picked.mpCost` and applying cooldowns
// before executing the skill. This module only DECIDES.
import { isSilenced } from '../../mods/statusModel.js';
import { getUnlockedSkills, mergeSkillForCast } from '../../game/skills.js';

const HEALER_CLASSES = ['cleric','druid','priest','oracle','paladin','bard'];
const SUPPORT_KEYWORD_RE = /heal|shield|barrier|ward|bless|foresight|rejuven|consec|sanctuary|fate|aegis/i;

/**
 * Pick a hero AI action. All inputs are pure data — no `this`.
 *
 * @param {Object} actor          combatant (must have .mp, .skillCooldowns)
 * @param {Object} partyMember    GameState party-member ref (for talents/level/skills/personality)
 * @param {Object[]} allies       alive allies
 * @param {Object[]} enemies      alive enemies
 * @param {Object[]} fallenAllies array of dead allies (for revive priority)
 * @returns {{kind:'skill', skill:Object} | {kind:'attack'}}
 */
export function pickHeroAction(actor, partyMember, allies, enemies, fallenAllies) {
  const classId = partyMember?.class || actor.class;
  const level = partyMember?.level || 1;
  const personality = partyMember?.personality || 'neutral';

  if (!enemies.length) return { kind: 'attack' };

  // M261: parity with simulator — merge each skill with talents/upgrades.
  // M264: respect player's selected skills (partyMember.skills).
  let rawSkills = getUnlockedSkills(classId, level).filter(s => s.type !== 'passive');
  // M283: only honor partyMember.skills as a filter when it actually contains
  // valid skill IDs. A list of [null] (left over from tavern hires that never
  // had skills picked) was filtering ALL skills out and silencing the AI.
  const validPicked = Array.isArray(partyMember?.skills)
    ? partyMember.skills.filter(Boolean) : [];
  const pickedSet = validPicked.length ? new Set(validPicked) : null;
  if (pickedSet) {
    const filtered = rawSkills.filter(s => pickedSet.has(s.id));
    // Defensive: if the picked set excludes everything (stale/wrong IDs),
    // fall through to all unlocked rather than locking the hero into basic
    // attacks for the rest of the run.
    if (filtered.length) rawSkills = filtered;
    // M408-followup: heals/revives bypass the picked-skills filter. A
    // paladin with Lay on Hands unlocked but not in his "active" picked
    // list would otherwise let himself die because the AI never saw the
    // heal. These survival skills shouldn't be gated behind manual picks.
    const survivalIds = new Set(rawSkills.map(s => s.id));
    const fullUnlocked = getUnlockedSkills(classId, level).filter(s => s.type !== 'passive');
    const survivalAdd = fullUnlocked.filter(s =>
      (s.type === 'heal' || s.type === 'revive') && !survivalIds.has(s.id)
    );
    if (survivalAdd.length) rawSkills = rawSkills.concat(survivalAdd);
    // M411 — if the picked-skills filter left the hero with NO offensive
    // option (only heals/revives), surface their cheapest damage spell so
    // they don't fall through to basic-attack every turn. The priest user
    // case: picked Mend + Call Back only, never cast Shadow Bolt despite
    // it being unlocked. Adds the lowest-mp magic/melee skill back.
    const hasOffense = rawSkills.some(s => s.type === 'magic' || s.type === 'melee' || s.type === 'attack');
    if (!hasOffense) {
      const offenseAdd = fullUnlocked
        .filter(s => (s.type === 'magic' || s.type === 'melee' || s.type === 'attack')
                  && !rawSkills.some(r => r.id === s.id))
        .sort((a, b) => (a.mpCost || 0) - (b.mpCost || 0));
      if (offenseAdd.length) rawSkills = rawSkills.concat(offenseAdd[0]);
    }
  }
  const skills = rawSkills.map(s => mergeSkillForCast(s, partyMember || {}));
  const silenced = isSilenced(actor);
  const usableSkills = skills.filter(s =>
    !(actor.skillCooldowns && actor.skillCooldowns[s.id]) &&
    (s.mpCost || 0) <= actor.mp &&
    !(silenced && (s.type === 'magic' || s.type === 'heal' || (s.mpCost || 0) > 0))
  );
  if (!usableSkills.length) return { kind: 'attack' };

  // M429 — score damage skills by expected damage instead of mpCost. Previously
  // the picker used mpCost as a proxy for "stronger", which broke when a class
  // had a strong cheap-mp AoE next to a weaker expensive one (e.g. Mage
  // preferred Magic Missile over Fireball against 6 targets because both
  // matched but Magic Missile sorted first). Score = damageMult * hits *
  // expected target count, with a small mp tiebreaker so equal-score skills
  // still favour the heavier spell.
  const _enemyCount = enemies.length;
  const damageScore = (s) => {
    const mult = s.damageMult || 0;
    if (mult <= 0) return 0;
    const hits = s.hits || 1;
    const aoe = s.aoe || 'single';
    let targets;
    if (aoe === 'all')                                       targets = _enemyCount;
    else if (aoe === 'group2' || aoe === 'random4' || aoe === 'random5') targets = Math.min(_enemyCount, 4);
    else if (aoe === 'group' || aoe === 'row' || aoe === 'random3' || aoe === 'chain' || aoe === 'chain3' || aoe === 'multi3') targets = Math.min(_enemyCount, 3);
    else if (aoe === 'row2' || aoe === 'multi4')             targets = Math.min(_enemyCount, 4);
    else if (aoe === 'adjacent' || aoe === 'adjacent2')      targets = Math.min(_enemyCount, 2);
    else                                                     targets = 1;
    return mult * hits * targets + (s.mpCost || 0) * 0.001;
  };

  // Priority 1: revive a fallen ally.
  let picked = null;
  const reviveSkill = usableSkills.find(s => s.type === 'revive');
  if (fallenAllies.length && reviveSkill) picked = reviveSkill;

  // Pre-compute support sets used by remaining branches.
  const healSkills = usableSkills.filter(s => s.type === 'heal');
  const healSkill = healSkills.sort((a, b) => (b.mpCost || 0) - (a.mpCost || 0))[0];
  const woundedAlly = allies.find(a => a.hp / a.maxHp < 0.5);
  const criticalAlly = allies.find(a => a.hp / a.maxHp < 0.25);
  // M347 — was 0.8 which caused massive overheal at 79% HP (heal of 24
  // wasted 16 of it because the target only needed 8). New threshold:
  // 0.65 — combined with the per-target waste check below, the cleric
  // only heals when at least ~35% of max HP is missing AND the heal
  // won't waste more than half of itself.
  const anyHurt = allies.find(a => a.hp / a.maxHp < 0.65);
  const isHealer = personality === 'protective' || HEALER_CLASSES.includes(classId);
  const supportSkills = usableSkills.filter(s => {
    if (s.type === 'heal') return true;
    const eff = s.effect || {};
    if (eff.barrier || eff.shield || eff.dmgReduct || eff.hpRegen || eff.regen) return true;
    if (SUPPORT_KEYWORD_RE.test(s.name || '') || SUPPORT_KEYWORD_RE.test(s.id || '')) return true;
    return false;
  });
  const scoreSupport = (s) => {
    const eff = s.effect || {};
    const heal = (s.healMult || 0) * 20;
    const shield = (eff.barrier || 0) + (eff.shield?.conMult || 0) * 20 + (eff.hpRegen || eff.regen || 0) * 4;
    return heal + shield + (s.mpCost || 0);
  };
  const bigSupport = supportSkills.sort((a, b) => scoreSupport(b) - scoreSupport(a))[0];
  const urgentHurt = allies.find(a => a.hp / a.maxHp <= 0.40);

  if (picked) {
    /* revive picked already */
  } else if (isHealer && urgentHurt && bigSupport) {
    picked = bigSupport;
  } else if (isHealer && healSkill && anyHurt) {
    picked = healSkill;
  } else if (healSkill && criticalAlly) {
    picked = healSkill;
  } else if (personality === 'protective' && healSkill && anyHurt) {
    picked = healSkill;
  } else if (personality === 'aggressive') {
    // M429 — damage-score sort across all damage skill types so the AI picks
    // the actual highest-output option for the current enemy count, not just
    // the heaviest-mp option.
    picked = usableSkills.filter(s => (s.type === 'melee' || s.type === 'magic' || s.type === 'ranged' || s.type === 'zone') && (s.damageMult || 0) > 0)
      .sort((a, b) => damageScore(b) - damageScore(a))[0];
  } else if (personality === 'opportunist') {
    picked = usableSkills.filter(s => (s.type === 'melee' || s.type === 'magic' || s.type === 'ranged' || s.type === 'zone') && (s.damageMult || 0) > 0)
      .sort((a, b) => damageScore(b) - damageScore(a))[0];
  } else {
    if (healSkill && woundedAlly) picked = healSkill;
    if (!picked) {
      picked = usableSkills.filter(s => (s.type === 'melee' || s.type === 'magic' || s.type === 'ranged' || s.type === 'zone') && (s.damageMult || 0) > 0)
        .sort((a, b) => damageScore(b) - damageScore(a))[0];
    }
    // M409-followup: never fall back to a heal skill when nobody needs
    // healing. A priest at level 1 only has Mend unlocked; without this
    // guard she'd cast Mend every round on a fully-healthy party for
    // pure overheal. Better to basic-attack than waste mana.
    if (!picked) {
      // M412 — also exclude 'revive' when no fallen allies. Otherwise the
      // priest's Call Back gets picked as a "non-heal fallback" and wastes
      // a 32-MP turn on "no fallen allies".
      const nonHeal = usableSkills.filter(s =>
        s.type !== 'heal' && s.type !== 'buff'
        && !(s.type === 'revive' && fallenAllies.length === 0));
      if (nonHeal.length) picked = nonHeal[0];
    }
    if (!picked && (woundedAlly || urgentHurt)) picked = usableSkills[0];
  }
  // M412 — final safety: if the picker chose a revive but nobody is dead,
  // fall back to a basic attack instead of wasting the cast.
  if (picked?.type === 'revive' && fallenAllies.length === 0) picked = null;

  return picked ? { kind: 'skill', skill: picked } : { kind: 'attack' };
}
