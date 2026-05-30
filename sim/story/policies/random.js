export const randomPolicy = {
  name: 'random',
  chooseNode({ candidates, intent, rng = Math.random }) {
    if (!candidates.length) return intent?.nodeId || null;
    return candidates[Math.floor(rng() * candidates.length)]?.nodeId || intent?.nodeId || null;
  },
  chooseDialog({ choices, rng = Math.random }) {
    if (!choices?.length) return null;
    return choices[Math.floor(rng() * choices.length)]?.id || null;
  },
  chooseSkillCheckApproach({ approaches = [], rng = Math.random }) {
    if (!approaches.length) return 'default';
    return approaches[Math.floor(rng() * approaches.length)] || 'default';
  },
  decideRetreat({ rng = Math.random } = {}) {
    return rng() < 0.15;
  },
  decideCompanionSwap() {
    return null;
  },
};
