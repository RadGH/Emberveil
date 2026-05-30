import { describe, it, expect } from 'vitest';
import { runEffects } from '../../mods/dsl.js';
import { addStatus } from '../../mods/statusModel.js';

describe('M175 — soulbind status', () => {
  it('applyStatus with amount carries forward to both bound actors', () => {
    const caster = { name: 'C', statuses: [] };
    const ally = { name: 'A', statuses: [] };
    runEffects([
      { op: 'applyStatus', status: 'soulbind', amount: 50, duration: 4, stacks: 1, target: 'self' },
      { op: 'applyStatus', status: 'soulbind', amount: 50, duration: 4, stacks: 1, target: 'target' }
    ], { caster, targets: [ally] });
    const sbC = caster.statuses.find(s => s.type === 'soulbind');
    const sbA = ally.statuses.find(s => s.type === 'soulbind');
    expect(sbC?.amount).toBe(50);
    expect(sbA?.amount).toBe(50);
    expect(sbC?.duration).toBe(4);
  });

  it('simulates CombatScreen soulbind damage redirect', () => {
    const hero = { id: 'h', name: 'H', hp: 100, maxHp: 100, alive: true, statuses: [] };
    const ally = { id: 'a', name: 'A', hp: 100, maxHp: 100, alive: true, statuses: [] };
    const allies = [hero, ally];
    addStatus(hero, { type: 'soulbind', amount: 50, duration: 4, stacks: 1 });
    addStatus(ally, { type: 'soulbind', amount: 50, duration: 4, stacks: 1 });

    // Mirror CombatScreen._applyDamage soulbind block
    let processing = false;
    function applyDmg(target, finalDmg) {
      if (!processing && Array.isArray(target.statuses) && finalDmg > 0) {
        const sb = target.statuses.find(s => s.type === 'soulbind' && (s.amount || 0) > 0);
        if (sb) {
          const partner = allies.find(a => a !== target && a.alive && Array.isArray(a.statuses) && a.statuses.some(s => s.type === 'soulbind'));
          if (partner) {
            processing = true;
            const split = Math.max(1, Math.round(finalDmg * (sb.amount / 100)));
            finalDmg -= split;
            partner.hp = Math.max(0, partner.hp - split);
            processing = false;
          }
        }
      }
      target.hp -= finalDmg;
    }

    applyDmg(hero, 20); // 10 to partner, 10 stays
    expect(hero.hp).toBe(90);
    expect(ally.hp).toBe(90);

    applyDmg(ally, 40); // 20 to partner, 20 stays
    expect(ally.hp).toBe(70);
    expect(hero.hp).toBe(70);
  });

  it('no redirect when only one side has soulbind', () => {
    const hero = { id: 'h', hp: 100, maxHp: 100, alive: true, statuses: [] };
    const ally = { id: 'a', hp: 100, maxHp: 100, alive: true, statuses: [] };
    const allies = [hero, ally];
    addStatus(hero, { type: 'soulbind', amount: 50, duration: 4, stacks: 1 });
    // ally has no soulbind

    let processing = false;
    function applyDmg(target, finalDmg) {
      if (!processing && Array.isArray(target.statuses) && finalDmg > 0) {
        const sb = target.statuses.find(s => s.type === 'soulbind' && (s.amount || 0) > 0);
        if (sb) {
          const partner = allies.find(a => a !== target && a.alive && Array.isArray(a.statuses) && a.statuses.some(s => s.type === 'soulbind'));
          if (partner) {
            processing = true;
            const split = Math.max(1, Math.round(finalDmg * (sb.amount / 100)));
            finalDmg -= split;
            partner.hp = Math.max(0, partner.hp - split);
            processing = false;
          }
        }
      }
      target.hp -= finalDmg;
    }

    applyDmg(hero, 20);
    expect(hero.hp).toBe(80);
    expect(ally.hp).toBe(100);
  });
});
