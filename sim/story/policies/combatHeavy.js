const PRIORITY = ['combat', 'boss', 'event', 'dialog', 'lore', 'merchant', 'shrine', 'rest'];

export const combatHeavyPolicy = {
  name: 'combatHeavy',
  chooseNode({ candidates, intent }) {
    const ordered = [...candidates].sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
    return ordered[0]?.nodeId || intent?.nodeId || null;
  },
  chooseDialog({ choices }) {
    return choices?.[0]?.id || null;
  },
  chooseSkillCheckApproach() {
    return 'force';
  },
  decideRetreat() {
    return false;
  },
  decideCompanionSwap() {
    return null;
  },
};
