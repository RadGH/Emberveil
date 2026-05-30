import { stepDirector } from '../../../src/story/storyDirector.js';

export const directorAwarePolicy = {
  name: 'directorAware',
  callsDirector: true,
  stepDirector(gs, state) {
    const intent = stepDirector(gs);
    state.intent = intent;
    return intent;
  },
  chooseNode({ candidates, intent }) {
    const match = candidates.find(candidate => candidate.nodeId === intent?.nodeId);
    if (match) return match.nodeId;
    const byType = candidates.find(candidate => candidate.type === intent?.type);
    return byType?.nodeId || candidates[0]?.nodeId || intent?.nodeId || null;
  },
  chooseDialog({ choices, intent }) {
    if (!choices?.length) return null;
    return choices.find(choice => choice.id === intent?.choiceId)?.id || choices[0].id;
  },
  chooseSkillCheckApproach() {
    return 'director';
  },
  decideRetreat() {
    return false;
  },
  decideCompanionSwap({ recruited }) {
    return recruited?.[0]?.id || null;
  },
};
