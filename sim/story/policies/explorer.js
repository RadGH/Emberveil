const PRIORITY = ['hidden', 'lore', 'dialog', 'waypoint', 'merchant', 'rest', 'combat', 'boss'];

export const explorerPolicy = {
  name: 'explorer',
  chooseNode({ candidates, intent }) {
    const ordered = [...candidates].sort((a, b) => score(b) - score(a));
    return ordered[0]?.nodeId || intent?.nodeId || null;
  },
  chooseDialog({ choices }) {
    return choices?.[0]?.id || null;
  },
  chooseSkillCheckApproach() {
    return 'scout';
  },
  decideRetreat() {
    return false;
  },
  decideCompanionSwap() {
    return null;
  },
};

function score(candidate) {
  let total = 0;
  for (const tag of candidate.themeTags || []) {
    const idx = PRIORITY.indexOf(tag);
    if (idx >= 0) total += PRIORITY.length - idx;
  }
  if (candidate.type === 'waypoint') total += 5;
  if (candidate.type === 'lore') total += 4;
  return total;
}
