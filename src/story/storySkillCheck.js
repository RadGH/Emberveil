import { CLASSES } from '../game/classes.js';

export const STORY_SKILLS = Object.freeze([
  'athletics',
  'intimidation',
  'diplomacy',
  'insight',
  'survival',
  'stealth',
  'arcana',
  'lore',
  'medicine',
  'crafting',
  'tracking',
  'perception',
  'focus',
  'resolve',
  'leadership',
  'endurance',
  'tactics',
  'faith',
]);

export const SKILL_AFFINITIES = Object.freeze({
  warrior:      { athletics: 2, intimidation: 2, endurance: 1, tactics: 1 },
  fighter:      { athletics: 2, intimidation: 1, tactics: 1 },
  paladin:      { faith: 2, diplomacy: 1, leadership: 1, resolve: 1 },
  ranger:       { survival: 2, tracking: 2, perception: 1, stealth: 1 },
  rogue:        { stealth: 2, perception: 1, tactics: 1 },
  cleric:       { faith: 2, medicine: 2, diplomacy: 1 },
  bard:         { diplomacy: 2, insight: 1, lore: 1 },
  mage:         { arcana: 3, lore: 1, focus: 1 },
  necromancer:  { arcana: 2, lore: 2, resolve: 1 },
  warlock:      { arcana: 2, intimidation: 1, focus: 1 },
  demon_hunter: { athletics: 1, tracking: 2, perception: 2 },
  scavenger:    { survival: 1, crafting: 2, perception: 1, resolve: 1 },
  swashbuckler: { athletics: 1, stealth: 1, diplomacy: 1, perception: 1 },
  dragon_knight:{ athletics: 2, endurance: 2, leadership: 1 },
  pyromancer:   { arcana: 2, focus: 1 },
  stormcaller:  { arcana: 2, perception: 1, focus: 1 },
  druid:        { survival: 2, medicine: 1, lore: 1 },
  oracle:       { insight: 2, lore: 2, faith: 1 },
  tactician:    { tactics: 3, leadership: 2, focus: 1 },
  chronomancer: { arcana: 2, focus: 2, lore: 1 },
  monk:         { athletics: 2, endurance: 2, resolve: 1 },
  shaman:       { faith: 1, survival: 1, lore: 1, insight: 1 },
  witch_hunter: { perception: 2, intimidation: 1, tactics: 1 },
  knight:       { athletics: 1, endurance: 2, leadership: 1 },
  sorcerer:     { arcana: 2, focus: 2 },
  runesmith:    { crafting: 2, lore: 2, focus: 1 },
  shadow_dancer:{ stealth: 3, perception: 1 },
  tinker:       { crafting: 3, tactics: 1 },
  priest:       { faith: 2, medicine: 1, insight: 1 },
  enchanter:    { arcana: 2, diplomacy: 1, insight: 1 },
});

export function resolveStorySkillCheck(gs, check = {}) {
  const party = Array.isArray(gs?.party) ? gs.party : [];
  const skillLabel = normalizeSkill(check.skillLabel || check.skill || check.label);
  const dc = Math.trunc(Number(check.dc ?? check.difficulty ?? 10) || 10);
  let best = { total: -Infinity, member: null, affinity: 0 };
  for (const member of party) {
    const classId = (member.class || member.cls || member.classId || '').toLowerCase();
    const affinity = SKILL_AFFINITIES[classId]?.[skillLabel] || 0;
    const statBonus = statBonusForSkill(member, skillLabel);
    const total = (member.level || 1) + affinity + statBonus;
    if (total > best.total) best = { total, member, affinity };
  }
  const outcome = best.total >= dc ? 'pass' : best.total >= Math.max(1, dc - 3) ? 'partial' : 'fail';
  return {
    skillLabel,
    dc,
    outcome,
    total: best.total === -Infinity ? 0 : best.total,
    affinity: best.affinity,
    memberId: best.member?.id || null,
  };
}

export function skillAffinityForClass(classId, skillLabel) {
  return SKILL_AFFINITIES[(classId || '').toLowerCase()]?.[normalizeSkill(skillLabel)] || 0;
}

export function affinityClassesForSkill(skillLabel) {
  const key = normalizeSkill(skillLabel);
  return CLASSES.filter(cls => (SKILL_AFFINITIES[cls.id] || {})[key]).map(cls => cls.id);
}

function statBonusForSkill(member, skillLabel) {
  const stats = member?.attrs || member?.stats || {};
  const mapping = {
    athletics: ['STR', 8],
    intimidation: ['STR', 7],
    diplomacy: ['INT', 7],
    insight: ['INT', 7],
    survival: ['CON', 7],
    stealth: ['DEX', 7],
    arcana: ['INT', 7],
    lore: ['INT', 7],
    medicine: ['INT', 7],
    crafting: ['DEX', 7],
    tracking: ['DEX', 7],
    perception: ['DEX', 7],
    focus: ['INT', 7],
    resolve: ['CON', 7],
    leadership: ['INT', 7],
    endurance: ['CON', 7],
    tactics: ['INT', 7],
    faith: ['INT', 7],
  };
  const [stat, threshold] = mapping[normalizeSkill(skillLabel)] || ['INT', 7];
  const value = Number(stats[stat] || 0);
  return Math.max(0, Math.floor((value - threshold) / 2));
}

function normalizeSkill(skillLabel) {
  return String(skillLabel || '').trim().toLowerCase();
}
