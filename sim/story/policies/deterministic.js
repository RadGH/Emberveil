export const deterministicPolicy = {
  name: 'deterministic',
  chooseNode({ candidates, intent }) {
    return candidates[0]?.nodeId || intent?.nodeId || null;
  },
  chooseDialog({ choices }) {
    return choices?.[0]?.id || null;
  },
  chooseSkillCheckApproach() {
    return 'default';
  },
  decideRetreat() {
    return false;
  },
  decideCompanionSwap() {
    return null;
  },
};
