import { describe, it, expect } from 'vitest';
import { addStatus, isSilenced } from '../../mods/statusModel.js';

describe('M171 — Targeted silence', () => {
  it('isSilenced returns true when silenced status is present', () => {
    const a = { statuses: [] };
    expect(isSilenced(a)).toBe(false);
    addStatus(a, { type: 'silenced', duration: 2 });
    expect(isSilenced(a)).toBe(true);
  });

  it('isSilenced handles missing statuses array', () => {
    expect(isSilenced({})).toBe(false);
    expect(isSilenced(null)).toBe(false);
  });

  it('AI filter intent — silenced skips magic/heal/mp-costing skills', () => {
    const actor = { mp: 50, skillCooldowns: {}, statuses: [{ type: 'silenced', duration: 2 }] };
    const skills = [
      { id: 'strike', type: 'melee', mpCost: 0 },
      { id: 'fireball', type: 'magic', mpCost: 10 },
      { id: 'heal_light', type: 'heal', mpCost: 8 },
      { id: 'shield_bash', type: 'melee', mpCost: 4 },
    ];
    const silenced = isSilenced(actor);
    const usable = skills.filter(s =>
      !actor.skillCooldowns[s.id] &&
      (s.mpCost || 0) <= actor.mp &&
      !(silenced && (s.type === 'magic' || s.type === 'heal' || (s.mpCost || 0) > 0))
    );
    expect(usable.map(s => s.id)).toEqual(['strike']);
  });
});
