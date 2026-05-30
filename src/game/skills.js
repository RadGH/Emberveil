/**
 * Skills — all 14×4 skills with effects engine
 * Each skill is a config object; the engine executes it without code per-skill.
 *
 * canonical-data migration (M497): the SKILLS data const was extracted to
 * public/data/combat/skills.json (schema public/schemas/v1/skills.json) and
 * is now loaded via the centralized dataLoader. All per-skill LOGIC
 * (mergeSkillForCast, _mergeInto, SKILL_TOPLEVEL_KEYS, lookups) stays here —
 * only the data moved. Byte-parity proven by scripts/verify-skills-parity.mjs.
 */
import { SKILLS_CANONICAL } from './dataLoader.js';

export const SKILLS = SKILLS_CANONICAL;


/**
 * M89: Merge a skill with the member's selected talents and purchased
 * upgrade tiers so the caller can treat the returned object as a normal
 * skill. Fixes the "288 orphaned talent + upgrade payloads" issue from
 * the skill-audit.
 *
 * Talent storage: `member.talentsPurchased` is a flat `{ talentId: true }`
 * map (see SkillTreeScreen.js:317-319). We walk `skill.talents[]` and
 * apply any whose `id` is true in that map.
 *
 * Upgrade storage: upgrades are gated purely by `member.level >= upgrade.level`
 * (see SkillTreeScreen.js skill listing). We apply every upgrade tier the
 * member has reached, in ascending order.
 *
 * Merge rules (deep for `effect` / `bonus`):
 *   - numeric keys: ADD (so +0.2 dmgBuff + talent +0.1 = +0.3)
 *   - boolean keys: OR (true once any source says true)
 *   - string / other: LAST WINS (later source overwrites)
 *   - arrays (statusEffects etc.): CONCAT
 *   - plain objects: recursive merge under same rules
 *
 * Top-level skill keys (aoe, damageMult, damageStat, mpCost, statusEffects)
 * from an upgrade's `bonus` are also applied to the returned skill so
 * the AoE/target-picker branch and damage branch see them. Talent `effect`
 * keys only merge into the `effect` object (talents are meant as buff
 * modifiers, not skill reshapers — except where they explicitly set
 * `aoe` / `statusEffects` keys; those top-level keys get promoted too).
 */
const SKILL_TOPLEVEL_KEYS = ['aoe','damageMult','damageStat','mpCost','statusEffects','healMult','healStat','cooldown','target','type'];

// M266: `additive` is true by default for backwards-compat with talents
// (which are written as "+X% bonus" and expect to stack). Upgrades pass
// `additive: false` so their damageMult/healMult/etc. REPLACE the previous
// value rather than stack on top — matching tooltip wording like "damage
// increases to 200% Damage" which designers always meant as a replacement.
// Before this, e.g. knight Shield Bash at L19 stacked base 1.1 + ksb_pow 0.3
// + Crushing Bash 1.5 + Bulwark Strike 2.0 = 4.9× Damage, roughly 2.5× the
// tooltip number. Audit in memory/skill-stacking-audit.md showed 43/63
// damage skills ≥ 2× overrun.
function _mergeInto(dst, src, { additive = true } = {}) {
  if (!src || typeof src !== 'object') return dst;
  for (const [k, v] of Object.entries(src)) {
    const cur = dst[k];
    if (Array.isArray(v)) {
      dst[k] = Array.isArray(cur) ? cur.concat(v) : v.slice();
    } else if (v && typeof v === 'object') {
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) _mergeInto(cur, v, { additive });
      else dst[k] = _mergeInto({}, v, { additive });
    } else if (typeof v === 'number') {
      if (additive) dst[k] = (typeof cur === 'number' ? cur : 0) + v;
      else dst[k] = v;
    } else if (typeof v === 'boolean') {
      dst[k] = !!cur || v;
    } else {
      dst[k] = v;
    }
  }
  return dst;
}

export function mergeSkillForCast(skill, member) {
  if (!skill) return skill;
  // deep-clone effect + relevant top-level bits so callers can mutate safely
  const merged = { ...skill };
  // M273: structuredClone is ~3× faster than JSON.parse(JSON.stringify(...))
  // and is already used in balance-loader.js. Equivalent semantics for plain
  // data effect objects.
  merged.effect = skill.effect ? structuredClone(skill.effect) : {};
  if (Array.isArray(skill.statusEffects)) merged.statusEffects = skill.statusEffects.slice();
  const purchased = member?.talentsPurchased || {};
  const level = member?.level || 1;

  // 1) Apply talents (effect merge; also promote top-level keys like aoe/statusEffects).
  for (const t of (skill.talents || [])) {
    if (!purchased[t.id]) continue;
    const eff = t.effect || {};
    const topBleed = {};
    // Split top-level from effect-level keys.
    const effectOnly = {};
    for (const [k, v] of Object.entries(eff)) {
      if (SKILL_TOPLEVEL_KEYS.includes(k)) topBleed[k] = v;
      else effectOnly[k] = v;
    }
    _mergeInto(merged.effect, effectOnly);
    _mergeInto(merged, topBleed);
  }

  // 2) Apply upgrades (all tiers the member has reached).
  // M266: upgrades use REPLACE semantics for number values (not additive) so
  // the tooltip wording "damage increases to 200% Damage" actually resolves to
  // 2.0× not (base + 1.5 + 2.0). Arrays still concat and booleans still OR.
  const upgrades = (skill.upgrades || []).filter(u => (u.level || 0) <= level)
    .sort((a, b) => (a.level || 0) - (b.level || 0));
  for (const u of upgrades) {
    const bonus = u.bonus || {};
    const topBleed = {};
    const effectOnly = {};
    for (const [k, v] of Object.entries(bonus)) {
      if (SKILL_TOPLEVEL_KEYS.includes(k)) topBleed[k] = v;
      else effectOnly[k] = v;
    }
    _mergeInto(merged.effect, effectOnly, { additive: false });
    _mergeInto(merged, topBleed, { additive: false });
  }
  return merged;
}

/**
 * Get all skills for a class (by unlock level)
 */
// M283 — stamp every skill's key as `.id` so downstream filters that compare
// against `s.id` (e.g. AI pickedSet, party.skills filter) actually match.
// Without this, partyMember.skills filtering was a silent no-op (skill values
// have no inherent id field; only the SKILLS map keys hold ids).
for (const _id of Object.keys(SKILLS)) {
  if (SKILLS[_id] && !SKILLS[_id].id) SKILLS[_id].id = _id;
}

export function getClassSkills(classId) {
  const vanilla = Object.values(SKILLS).filter(s => s.class === classId);
  let modSkills = [];
  try {
    const store = typeof window !== 'undefined' && window.__emberveilMods && window.__emberveilMods.getAll;
    if (store) {
      modSkills = store('skills').filter(s => {
        if (s._pack === 'vanilla_skills_bootstrap') return false;
        return s.classOrigin === classId || s.class === classId;
      });
    }
  } catch (_) {}
  return [...vanilla, ...modSkills].sort((a, b) => (a.unlockLevel || 1) - (b.unlockLevel || 1));
}

/**
 * Get skills available at a given level
 */
export function getUnlockedSkills(classId, level) {
  return getClassSkills(classId).filter(s => s.unlockLevel <= level);
}
