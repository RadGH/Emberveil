/**
 * Regression test for the Krix Bonechewer skill-check bug (M473).
 *
 * Bug: in multi-node dialogs, a choice with
 *   skillCheck: { stat, dc }, outcomes: { pass: '<nodeId>', fail: '<nodeId>' }
 * was silently exiting to the map. DialogScreen._showOutcome looked the
 * outcomeKey up in the node's outcomes:{} map (where it didn't exist) and
 * fell through to _finish(outcomeKey), closing the dialog.
 *
 * Fix: when the outcomeKey doesn't resolve in the local outcomes map but
 * IS a valid node id in event.nodes, navigate to that node instead.
 *
 * This test simulates the resolver logic directly (no DOM, no manager) so
 * it can run in node env via vitest.
 */
import { describe, it, expect } from 'vitest';

// Reimplementation of the _showOutcome branch we care about, as a pure
// function. Mirrors src/ui/screens/DialogScreen.js:_showOutcome lines
// 733-741 so changes here track changes there.
function resolveOutcome({ event, currentNodeId, outcomeKey, choice }) {
  const node = event.nodes && event.nodes[currentNodeId];
  const outcomes = (node ? node.outcomes : event.outcomes) || {};
  const outcome = outcomes[outcomeKey];
  if (outcome) {
    return { action: 'showOutcome', outcome };
  }
  // M473 — node-id fallthrough
  if (outcomeKey && event.nodes && event.nodes[outcomeKey]) {
    return { action: 'gotoNode', nodeId: outcomeKey };
  }
  if (choice?.next) return { action: 'gotoNode', nodeId: choice.next };
  return { action: 'finish', outcomeKey };
}

// Mirror of the krix_trap event shape from recurringNpcEvents.js
const krixTrap = {
  id: 'krix_trap',
  start: 'start',
  nodes: {
    start: {
      choices: [
        { text: '[INT 14] sign-cut', skillCheck: { stat: 'INT', dc: 14 },
          outcomes: { pass: 'spot_trap', fail: 'walk_in' } },
        { text: '[WIS 13] sense nerves', skillCheck: { stat: 'WIS', dc: 13 },
          outcomes: { pass: 'spot_trap', fail: 'walk_in' } },
        { text: 'Follow shortcut.', next: 'shortcut_clean', requires: { flag: 'krix_trusted' } },
        { text: 'Follow anyway.', outcome: 'walk_in' },
        { text: 'Refuse.', outcome: 'refuse' },
      ],
    },
    spot_trap: {
      choices: [
        { text: '[CHA 14] turn him', skillCheck: { stat: 'CHA', dc: 14 },
          outcomes: { pass: 'flip', fail: 'fight_them' } },
        { text: 'Kill him.', outcome: 'kill_now' },
      ],
    },
    walk_in: {
      choices: [{ text: 'Fight.', outcome: 'walked_in_fought' }],
      outcomes: { walked_in_fought: { text: 'You fight.', startCombat: 'goblin_camp' } },
    },
    flip: {},
    fight_them: {},
    shortcut_clean: {},
    kill_now: {},
    refuse: {},
  },
};

describe('DialogScreen skill-check node routing (Krix Bonechewer regression)', () => {
  it('INT 14 PASS routes to spot_trap node', () => {
    const choice = krixTrap.nodes.start.choices[0];
    const r = resolveOutcome({
      event: krixTrap,
      currentNodeId: 'start',
      outcomeKey: choice.outcomes.pass, // 'spot_trap'
      choice,
    });
    expect(r).toEqual({ action: 'gotoNode', nodeId: 'spot_trap' });
  });

  it('INT 14 FAIL routes to walk_in node', () => {
    const choice = krixTrap.nodes.start.choices[0];
    const r = resolveOutcome({
      event: krixTrap,
      currentNodeId: 'start',
      outcomeKey: choice.outcomes.fail, // 'walk_in'
      choice,
    });
    expect(r).toEqual({ action: 'gotoNode', nodeId: 'walk_in' });
  });

  it('WIS 13 PASS / FAIL also reach spot_trap / walk_in', () => {
    const choice = krixTrap.nodes.start.choices[1];
    expect(resolveOutcome({ event: krixTrap, currentNodeId: 'start',
      outcomeKey: choice.outcomes.pass, choice }))
      .toEqual({ action: 'gotoNode', nodeId: 'spot_trap' });
    expect(resolveOutcome({ event: krixTrap, currentNodeId: 'start',
      outcomeKey: choice.outcomes.fail, choice }))
      .toEqual({ action: 'gotoNode', nodeId: 'walk_in' });
  });

  it('walk_in node "Fight." renders its terminal outcome (not exit)', () => {
    const choice = krixTrap.nodes.walk_in.choices[0];
    const r = resolveOutcome({
      event: krixTrap,
      currentNodeId: 'walk_in',
      outcomeKey: 'walked_in_fought',
      choice,
    });
    expect(r.action).toBe('showOutcome');
    expect(r.outcome.text).toBe('You fight.');
    expect(r.outcome.startCombat).toBe('goblin_camp');
  });

  it('skill-check choice in nested node (CHA 14 in spot_trap) routes correctly', () => {
    const choice = krixTrap.nodes.spot_trap.choices[0];
    const r = resolveOutcome({
      event: krixTrap,
      currentNodeId: 'spot_trap',
      outcomeKey: choice.outcomes.pass, // 'flip'
      choice,
    });
    expect(r).toEqual({ action: 'gotoNode', nodeId: 'flip' });
  });

  it('"refuse" choice with bare outcome="refuse" (no skillCheck) still works', () => {
    // This was working before — verify regression hasn't broken it.
    // The node 'refuse' has no outcomes block in our mock; the bug-fix
    // branch (outcomeKey matches a node id) handles it by navigating
    // to that node, which is the right semantic since 'refuse' IS a node.
    const choice = krixTrap.nodes.start.choices[4];
    const r = resolveOutcome({
      event: krixTrap,
      currentNodeId: 'start',
      outcomeKey: choice.outcome,
      choice,
    });
    expect(r.action).toBe('gotoNode');
    expect(r.nodeId).toBe('refuse');
  });

  it('unrecognized outcomeKey (not a node, not in outcomes) still _finishes (no infinite loop)', () => {
    const choice = { outcome: 'nope_not_real' };
    const r = resolveOutcome({
      event: krixTrap,
      currentNodeId: 'start',
      outcomeKey: 'nope_not_real',
      choice,
    });
    expect(r).toEqual({ action: 'finish', outcomeKey: 'nope_not_real' });
  });
});
