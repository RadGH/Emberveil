const PRIORITY = ['merchant', 'combat', 'boss', 'event', 'lore', 'dialog', 'shrine', 'rest'];

export const greedyPolicy = {
  name: 'greedy',
  chooseNode({ candidates, intent }) {
    const ordered = [...candidates].sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
    return ordered[0]?.nodeId || intent?.nodeId || null;
  },
  chooseDialog({ choices }) {
    return choices?.[0]?.id || null;
  },
  chooseSkillCheckApproach() {
    return 'profit';
  },
  decideRetreat() {
    return false;
  },
  decideCompanionSwap() {
    return null;
  },
};
