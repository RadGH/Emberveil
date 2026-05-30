/**
 * championModifiers.js — Diablo-2-style champion prefix modifiers (M303)
 *
 * Champions are non-boss, non-named enemies with a 5% spawn chance that gain:
 *   - Blue name color in the HUD
 *   - "Champion" tag
 *   - +50% HP
 *   - +30% damage
 *   - 1-2 modifiers from this table
 *   - Slightly higher loot / XP
 *
 * Each modifier:
 *   id          — unique key (also used as CSS class suffix)
 *   name        — display name shown on the modifier badge
 *   glyph       — single char or FA-code-point (plain text, no emoji)
 *   color       — CSS color for the badge background
 *   desc        — tooltip description (plain English)
 *   onRoundStart(champion, combatCtx) — optional per-round hook
 *   onHit(champion, target, dmgDealt, combatCtx) — optional on-hit hook
 *   onHitByAttacker(champion, attacker, incomingDmg, combatCtx) — optional when champion is hit
 *   statMods    — optional { hpMult, dmgMult, armor, dodge, hit, initiative }
 *                 applied once at spawn (multiplicative for multipliers)
 */

export const CHAMPION_MODIFIERS = {
  regen: {
    id: 'regen',
    name: 'Regenerating',
    glyph: '+',
    color: '#208840',
    desc: 'Recovers 5% of max HP at the start of each round.',
    onRoundStart(champ, ctx) {
      if (champ.alive && champ.hp < champ.maxHp) {
        const amt = Math.max(1, Math.round(champ.maxHp * 0.05));
        champ.hp = Math.min(champ.maxHp, champ.hp + amt);
        ctx.spawnDmgNumber(champ.x, champ.y - 48, `+${amt}`, '#40e870');
        ctx.log(`${champ.name} regenerates ${amt} HP`, 'normal');
      }
    },
  },
  aura_damage: {
    id: 'aura_damage',
    name: 'Damage Aura',
    glyph: 'A',
    color: '#a84010',
    desc: 'All other enemies deal 20% more damage while this champion lives.',
    // Applied in CombatScreen enemy turn — checked via champ.championMods includes 'aura_damage'
  },
  fast: {
    id: 'fast',
    name: 'Swift',
    glyph: '>',
    color: '#104888',
    desc: 'Acts 50% more often in combat.',
    statMods: { initiative: 1.5 }, // multiplier applied at spawn
  },
  extra_strong: {
    id: 'extra_strong',
    name: 'Extra Strong',
    glyph: '!',
    color: '#882000',
    desc: 'Deals 30% more damage per hit.',
    statMods: { dmgMult: 1.3 },
  },
  tough: {
    id: 'tough',
    name: 'Tough',
    glyph: 'T',
    color: '#404080',
    desc: 'Has 30% more HP than a normal champion.',
    statMods: { hpMult: 1.3 },
  },
  cursed_aura: {
    id: 'cursed_aura',
    name: 'Cursed Aura',
    glyph: 'C',
    color: '#602080',
    desc: 'Afflicts a random hero with Curse at the start of each round.',
    onRoundStart(champ, ctx) {
      if (!champ.alive) return;
      const heroes = ctx.allies.filter(h => h.alive);
      if (!heroes.length) return;
      const target = heroes[Math.floor(Math.random() * heroes.length)];
      const already = (target.statuses || []).some(s => s.type === 'curse');
      if (!already) {
        target.statuses = target.statuses || [];
        target.statuses.push({ type: 'curse', duration: 1, power: 15 });
        ctx.log(`${champ.name}'s cursed aura afflicts ${target.name}!`, 'enemy');
      }
    },
  },
  shielded: {
    id: 'shielded',
    name: 'Shielded',
    glyph: 'S',
    color: '#205888',
    desc: 'Reduces all incoming damage by 50%.',
    // Enforced in CombatScreen _applyDamage via champ.championShielded flag
  },
  lifesteal: {
    id: 'lifesteal',
    name: 'Lifesteal',
    glyph: 'L',
    color: '#801828',
    desc: 'Heals for 30% of damage dealt.',
    onHit(champ, _target, dmgDealt, ctx) {
      if (!champ.alive || dmgDealt <= 0) return;
      const heal = Math.round(dmgDealt * 0.30);
      if (heal <= 0) return;
      champ.hp = Math.min(champ.maxHp, champ.hp + heal);
      ctx.spawnDmgNumber(champ.x, champ.y - 48, `+${heal}`, '#e06080');
    },
  },
  thorns: {
    id: 'thorns',
    name: 'Thorns',
    glyph: 'x',
    color: '#206028',
    desc: 'Returns 10 damage to every attacker that lands a hit.',
    onHitByAttacker(champ, attacker, _dmg, ctx) {
      if (!champ.alive || !attacker.alive) return;
      const reflect = 10;
      attacker.hp = Math.max(0, attacker.hp - reflect);
      ctx.spawnDmgNumber(attacker.x, attacker.y - 48, reflect, '#60c840');
      ctx.log(`${champ.name}'s thorns deal ${reflect} to ${attacker.name}`, 'normal');
      if (attacker.hp <= 0) {
        attacker.hp = 0; attacker.alive = false; attacker.stance = 'death';
        ctx.log(`${attacker.name} perishes from thorns!`, 'death');
      }
    },
  },
  inferno: {
    id: 'inferno',
    name: 'Inferno',
    glyph: 'F',
    color: '#a84000',
    desc: 'Attackers that hit this champion are set ablaze (Burn 3 rounds).',
    onHitByAttacker(champ, attacker, _dmg, ctx) {
      if (!champ.alive || !attacker.alive) return;
      const alreadyBurning = (attacker.statuses || []).some(s => s.type === 'burn');
      if (!alreadyBurning) {
        attacker.statuses = attacker.statuses || [];
        attacker.statuses.push({ type: 'burn', duration: 3, power: 6 });
        ctx.log(`${attacker.name} is ignited by ${champ.name}'s inferno!`, 'normal');
      }
    },
  },
};

export const MODIFIER_POOL = Object.keys(CHAMPION_MODIFIERS);

/**
 * Roll champion modifiers for a newly spawned champion.
 * Returns an array of 1 or 2 modifier ids.
 */
export function rollChampionModifiers() {
  const pool = [...MODIFIER_POOL];
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = Math.random() < 0.5 ? 1 : 2;
  return pool.slice(0, count);
}

/**
 * Apply champion modifier stat boosts to a combatant object in-place.
 * Call once at spawn time after the base champion HP/DMG bump.
 */
export function applyChampionStatMods(combatant, modIds) {
  for (const id of modIds) {
    const mod = CHAMPION_MODIFIERS[id];
    if (!mod || !mod.statMods) continue;
    const sm = mod.statMods;
    if (sm.hpMult)       { combatant.hp    *= sm.hpMult; combatant.maxHp *= sm.hpMult; }
    if (sm.dmgMult)      { combatant.dmg   = combatant.dmg.map(d => Math.round(d * sm.dmgMult)); }
    if (sm.initiative)   { combatant.initiative *= sm.initiative; }
    if (sm.armor)        { combatant.armor  = Math.round(combatant.armor  + sm.armor); }
    if (sm.dodge)        { combatant.dodge  = Math.round(combatant.dodge  + sm.dodge); }
    if (sm.hit)          { combatant.hit    = Math.round(combatant.hit    + sm.hit); }
    // Shielded flag
    if (id === 'shielded') combatant.championShielded = true;
  }
}
