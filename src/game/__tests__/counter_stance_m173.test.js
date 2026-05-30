import { describe, it, expect } from 'vitest';
import { runEffects } from '../../mods/dsl.js';
import { addStatus } from '../../mods/statusModel.js';

describe('M173 — counter-stance status', () => {
  it('applyStatus with amount carries forward to the status entry', () => {
    const caster = { name: 'K', statuses: [] };
    runEffects([
      { op: 'applyStatus', status: 'counterStance', amount: 150, stacks: 2, duration: 3, target: 'self' }
    ], { caster, targets: [] });
    const cs = caster.statuses.find(s => s.type === 'counterStance');
    expect(cs).toBeDefined();
    expect(cs.amount).toBe(150);
    expect(cs.stacks).toBe(2);
    expect(cs.duration).toBe(3);
  });

  it('simulates the CombatScreen counter-stance consume loop', () => {
    const target = { name: 'K', hp: 100, maxHp: 100, statuses: [] };
    const attacker = { name: 'A', hp: 100, maxHp: 100, alive: true };
    addStatus(target, { type: 'counterStance', amount: 150, stacks: 2, duration: 3 });

    // Mirror of CombatScreen._applyDamage counter-stance block.
    function applyIncoming(actor, target, finalDmg) {
      target.hp -= finalDmg;
      if (actor && actor !== target && actor.alive && finalDmg > 0 && Array.isArray(target.statuses)) {
        const cs = target.statuses.find(s => s.type === 'counterStance' && (s.amount || 0) > 0);
        if (cs) {
          const back = Math.max(1, Math.round(finalDmg * (cs.amount / 100)));
          actor.hp = Math.max(0, actor.hp - back);
          cs.stacks = (cs.stacks || 1) - 1;
          if (cs.stacks <= 0) target.statuses = target.statuses.filter(s => s !== cs);
        }
      }
    }

    applyIncoming(attacker, target, 10); // counter returns 15
    expect(target.hp).toBe(90);
    expect(attacker.hp).toBe(85);
    expect(target.statuses.find(s => s.type === 'counterStance').stacks).toBe(1);

    applyIncoming(attacker, target, 20); // counter returns 30 → consumed
    expect(target.hp).toBe(70);
    expect(attacker.hp).toBe(55);
    expect(target.statuses.find(s => s.type === 'counterStance')).toBeUndefined();

    applyIncoming(attacker, target, 10); // no counter
    expect(target.hp).toBe(60);
    expect(attacker.hp).toBe(55);
  });
});
