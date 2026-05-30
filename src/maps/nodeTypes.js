/**
 * Node-type constants (extracted from mapData.js — refactor #2).
 * Pure structural extraction; values are byte-identical to the original.
 */
export const NODE_TYPES = {
  COMBAT: 'combat',
  DIALOG: 'dialog',
  TOWN: 'town',
  TREASURE: 'treasure',
  AMBUSH: 'ambush',
  BOSS: 'boss',
  LORE: 'lore',
  SHRINE: 'shrine',   // restore HP/MP or grant buff
  CHALLENGE: 'challenge', // optional hard fight with bonus loot
  DUNGEON: 'dungeon', // M279: side-branch dungeon — internal mini-graph,
                       // mini-boss at end, treasure chest reward, locked once
                       // cleared. Always an off-shoot, never a main-path link.
  SKILL_CHECK: 'skillCheck', // M302: single-attribute roll — success = reward, fail = penalty
};
