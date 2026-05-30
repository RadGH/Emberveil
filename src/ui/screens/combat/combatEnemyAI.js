/**
 * combatEnemyAI.js — extracted from CombatScreen (structural refactor).
 *
 * Enemy-turn AI: healer heal, wind-up continuation, spell casting, basic attack
 * targeting. All functions take `screen` (the CombatScreen instance) as the
 * first argument so they can delegate back to core combat methods without
 * circular imports. Zero behavior change — pure structural extraction.
 *
 * Extracted methods: _enemyAI, _executeEnemySpell, _enemySpellFizzle
 */
import { isSilenced } from '../../../mods/statusModel.js';
import { ENEMY_SPELLS, resolveSpells } from '../../../game/enemySpells.js';
import { playSpellFx } from '../../components/spellFx.js';

/**
 * Run enemy AI for one turn. Equivalent to CombatScreen._enemyAI(actor).
 */
export function enemyAI(screen, actor) {
  const allAlive = screen._allies.filter(h => h.alive);
  if (!allAlive.length) return;
  // M398 — enemies also skip sleeping heroes when an awake target is
  // available; symmetrical with the hero-AI rule so the player can lean
  // on Sleep as a defensive tool too.
  const awake = allAlive.filter(h => !(h.statuses || []).some(s => s.type === 'sleep'));
  const alive = awake.length ? awake : allAlive;

  // M46: Healer enemies heal their wounded allies first.
  // M171: silenced enemies cannot cast (healer heal is a spell).
  if (actor.role === 'healer' && !isSilenced(actor)) {
    const woundedAlly = screen._allEnemies.filter(e => e.alive && e.hp / e.maxHp < 0.6)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (woundedAlly) {
      const heal = Math.max(8, Math.round(actor.dmg[1] * 0.8));
      woundedAlly.hp = Math.min(woundedAlly.maxHp, woundedAlly.hp + heal);
      screen._spawnDmgNumber(woundedAlly.x, woundedAlly.y - 50, `+${heal}`, '#60e880');
      screen._log_(`${actor.name} heals ${woundedAlly.name} for ${heal}`, 'enemy');
      actor.stance = 'spell';
      screen._setTimeout(() => { actor.stance = 'ready'; }, 300);
      return;
    }
  }

  // M303: Wind-up continuation — if this enemy is winding up a boss spell,
  // decrement the counter. On reaching 0, execute the spell.
  if (actor._windUp) {
    actor._windUp.roundsLeft--;
    if (actor._windUp.roundsLeft > 0) {
      screen._log_(`${actor.name} is channeling ${actor._windUp.spellName}... (${actor._windUp.roundsLeft} round${actor._windUp.roundsLeft !== 1 ? 's' : ''} remaining)`, 'enemy');
      actor.stance = 'spell';
      screen._setTimeout(() => { actor.stance = 'ready'; }, 300);
      return;
    }
    // Wind-up complete — check for interrupt
    const spell = ENEMY_SPELLS[actor._windUp.spellId];
    const threshold = spell?.windUp?.interruptThreshold || 0;
    if (actor._windUp.dmgTaken >= threshold) {
      screen._log_(`${actor.name}'s ${actor._windUp.spellName} was interrupted!`, 'hero');
      actor._windUp = null;
      actor.stance = 'ready';
      // fizzle visual
      enemySpellFizzle(screen, actor);
      return;
    }
    // Execute wind-up spell
    const wu = actor._windUp;
    actor._windUp = null;
    if (spell) executeEnemySpell(screen, actor, spell, alive);
    return;
  }

  // M303: Spell cast decision
  if (actor.spellList && actor.spellList.length > 0 && !isSilenced(actor)) {
    const availableSpells = resolveSpells(actor.spellList).filter(spell => {
      const cd = (actor.skillCooldowns || {})[spell.id] || 0;
      return cd <= 0;
    });
    // M469: diagnostic logging gated on window.__combatDebug to stay silent in production.
    if (window.__combatDebug) {
      console.log('[CombatDebug] EnemyAI spell check:', actor.name,
        '| spellList:', actor.spellList,
        '| available:', availableSpells.map(s => s.id),
        '| spellChance:', actor.spellChance,
        '| silenced:', isSilenced(actor));
    }
    if (availableSpells.length > 0 && Math.random() < (actor.spellChance || 0)) {
      const spell = availableSpells[Math.floor(Math.random() * availableSpells.length)];
      // Set cooldown
      if (!actor.skillCooldowns) actor.skillCooldowns = {};
      actor.skillCooldowns[spell.id] = spell.cooldown || 2;
      // M469: diagnostic log for spell cast.
      if (window.__combatDebug) {
        console.log('[CombatDebug] EnemyAI CASTING:', actor.name, '->', spell.id, spell.name);
      }
      // Boss wind-up spells
      if (spell.windUp && spell.windUp.rounds > 0) {
        actor._windUp = {
          spellId: spell.id,
          spellName: spell.name,
          roundsLeft: spell.windUp.rounds,
          dmgTaken: 0,
        };
        screen._log_(`${actor.name} begins casting ${spell.name}! (${spell.windUp.rounds} round${spell.windUp.rounds !== 1 ? 's' : ''})`, 'enemy');
        actor.stance = 'spell';
        screen._setTimeout(() => { actor.stance = 'ready'; }, 400);
        // Visual telegraph — red glow rendered in _drawUnit via _windUp flag
        return;
      }
      // Instant spell
      executeEnemySpell(screen, actor, spell, alive);
      return;
    }
  }

  // M95: Swashbuckler Taunt — if this enemy was tauntedBy a specific ally,
  // target that ally exclusively while the taunt is active.
  if (actor.tauntedBy) {
    const caster = alive.find(a => a.id === actor.tauntedBy);
    if (caster) { screen._basicAttack(actor, [caster], false, true); return; }
  }
  // M46 Formation targeting: companions first, then party in LIST order.
  // Auto-taunt: any ally with taunt buff is prioritized over list order.
  const taunted = alive.filter(a => a.taunting);
  let ordered;
  if (taunted.length) {
    ordered = taunted;
  } else {
    const companionIds = new Set(screen._companions.map(c => c.id));
    const comps = alive.filter(a => companionIds.has(a.id));
    const heroes = alive.filter(a => !companionIds.has(a.id));
    // Preserve party order (heroes array already in order)
    const compsByOrder = screen._companions.filter(c => comps.includes(c));
    // eslint-disable-next-line no-unused-vars
    const heroesByOrder = screen._heroes.filter(h => heroes.includes(h));
    ordered = [...compsByOrder, ...heroesByOrder];
  }
  screen._basicAttack(actor, ordered, false, true);
}

/**
 * M303: Execute an enemy spell against current alive heroes.
 * Equivalent to CombatScreen._executeEnemySpell(actor, spell, aliveHeroes).
 */
export function executeEnemySpell(screen, actor, spell, aliveHeroes) {
  actor.stance = 'spell';
  screen._setTimeout(() => { actor.stance = 'ready'; }, spell.animationMs || 600);
  // M396 — attribute DoTs / statuses applied by this enemy spell to the
  // casting enemy actor.
  screen._currentActor = actor;

  // Play FX on the combat screen root element
  const screenEl = screen._el;
  if (screenEl) playSpellFx(screenEl, spell.fxKind, { spellTint: actor.spellTint });

  const eff = spell.effect || {};

  // Determine targets
  let targets = [];
  if (spell.target === 'self') {
    targets = [actor];
  } else if (spell.target === 'aoe') {
    targets = [...aliveHeroes];
  } else if (spell.target === 'ally_lowest_hp') {
    // Heals the most wounded alive enemy
    const wounded = screen._allEnemies.filter(e => e.alive && e.hp < e.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    targets = wounded.length ? [wounded[0]] : [];
  } else {
    // single — pick the first priority target (same as basic attack logic)
    const companionIds = new Set(screen._companions.map(c => c.id));
    const taunted = aliveHeroes.filter(a => a.taunting);
    if (taunted.length) {
      targets = [taunted[0]];
    } else {
      const comps = aliveHeroes.filter(a => companionIds.has(a.id));
      const heroes = aliveHeroes.filter(a => !companionIds.has(a.id));
      const ordered = [...comps, ...heroes];
      targets = ordered.length ? [ordered[0]] : [];
    }
  }

  if (!targets.length) return;

  const logParts = [];

  // Heal ally / self
  if (eff.heal && spell.target === 'ally_lowest_hp' && targets.length) {
    const t = targets[0];
    const healAmt = Math.round(eff.heal);
    t.hp = Math.min(t.maxHp, t.hp + healAmt);
    screen._spawnDmgNumber(t.x, t.y - 50, `+${healAmt}`, '#60e880');
    logParts.push(`heals ${t.name} for ${healAmt}`);
  }

  // Self-heal (lifedrain etc)
  if (eff.selfHeal) {
    const healAmt = Math.round(eff.selfHeal);
    actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
    screen._spawnDmgNumber(actor.x, actor.y - 50, `+${healAmt}`, '#e060a0');
  }

  // Damage + statuses on targets
  for (const t of targets) {
    if (eff.damage) {
      const dmg = Math.round(eff.damage);
      // Apply shielded to heroes defensively (no armor vs spells for simplicity — treat as magic dmg)
      const mitigated = Math.max(0, dmg - Math.round(t.magicResist || 0));
      screen._applyDamage(actor, t, mitigated, '#e080ff');
      logParts.push(`${spell.name} deals ${mitigated} to ${t.name}`);
    }
    // Apply single status
    if (eff.status && Math.random() < (eff.status.chance || 1.0)) {
      screen._applyStatus(t, eff.status.type, eff.status.duration || 2, eff.status.power || 3);
    }
    // Apply multiple statuses
    if (Array.isArray(eff.statuses)) {
      for (const s of eff.statuses) {
        if (Math.random() < (s.chance || 1.0)) {
          screen._applyStatus(t, s.type, s.duration || 2, s.power || 3);
        }
      }
    }
  }

  if (!logParts.length) logParts.push(`${actor.name} casts ${spell.name}`);
  else logParts.unshift(`${actor.name} casts ${spell.name}:`);
  screen._log_(logParts.join(' — '), 'enemy');
  screen._updateHud();
}

/**
 * M303: fizzle visual (stance flash only; no log entry needed).
 * Equivalent to CombatScreen._enemySpellFizzle(actor).
 */
export function enemySpellFizzle(screen, actor) {
  actor.stance = 'spell';
  screen._setTimeout(() => { actor.stance = 'ready'; }, 300);
  const screenEl = screen._el;
  if (screenEl) playSpellFx(screenEl, 'shadow', { durationMs: 300 });
}
