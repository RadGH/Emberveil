const PRIORITY = ['dialog', 'lore', 'shrine', 'rest', 'merchant', 'event', 'combat', 'boss'];

export const storyFirstPolicy = {
  name: 'storyFirst',
  chooseNode({ candidates, intent }) {
    const ordered = [...candidates].sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
    return ordered[0]?.nodeId || intent?.nodeId || null;
  },
  chooseDialog({ choices }) {
    return choices?.find(choice => !/fight|attack/i.test(choice.label || ''))?.id || choices?.[0]?.id || null;
  },
  chooseSkillCheckApproach() {
    return 'narrative';
  },
  decideRetreat({ combatPreview }) {
    return !!combatPreview && (combatPreview.enemyCount || 0) > 4;
  },
  decideCompanionSwap({ recruited }) {
    return recruited?.[0]?.id || null;
  },
};
