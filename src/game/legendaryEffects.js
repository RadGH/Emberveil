/**
 * legendaryEffects.js — M305
 *
 * Defines mechanical hooks for legendary effects on set items and unique items.
 *
 * Each entry in LEGENDARY_HOOKS is keyed by effectId and maps to an object with
 * optional hook functions. Hooks receive a context object and may mutate it.
 *
 * Hook signatures:
 *   onCombatStart(ctx)       — called once at the start of each combat
 *   onTurnStart(ctx)         — called at the start of each actor's turn
 *   onHit(ctx)               — called after a successful physical attack lands
 *   onCrit(ctx)              — called on a critical hit (in addition to onHit)
 *   onKill(ctx)              — called when the actor kills a target
 *   onCast(ctx)              — called when the actor uses a skill/spell
 *   onTakeDamage(ctx)        — called when the actor receives damage
 *   onLowMana(ctx)           — called at the start of a turn when MP < 25% max
 *   onLowHp(ctx)             — called at the start of a turn when HP < 30% max
 *   onRoundEnd(ctx)          — called at the end of each combat round
 *
 * Context shape (not all fields available in every hook — check before using):
 *   actor        — the combatant performing the action
 *   target       — the combatant receiving the action (null for AoE/self)
 *   rawDmg       — pre-resolution damage value (may mutate to amplify)
 *   dealt        — final damage dealt after mitigation
 *   isCrit       — boolean
 *   combat       — reference to the CombatScreen instance (use with care)
 *   allies       — array of living ally combatants
 *   enemies      — array of living enemy combatants
 *   log          — function(text, type) — log to combat feed
 *   applyStatus  — function(target, type, duration, power)
 *   applyDmg     — function(actor, target, amount, color)
 *   heal         — function(target, amount)
 *
 * Hooks must not throw — wrap any risky code in try/catch internally.
 * Hooks run synchronously; no async allowed.
 */

export const LEGENDARY_HOOKS = {

  // ── MAGE_MISSILE_AOE ───────────────────────────────────────────────────────
  // Set: Iron Weave Initiation (2/2). Magic Missile fires a bonus AoE
  // projectile that hits a second random target for 60% of the original damage.
  mage_missile_aoe: {
    desc: 'Magic Missile fires a bonus projectile that hits a second target for 60% damage.',
    onCast(ctx) {
      if (!ctx.target || !ctx.target.alive) return;
      if (ctx.skillId !== 'magic_missile' && ctx.skillId !== 'fire_bolt' && ctx.skillId !== 'chaos_bolt') return;
      const pool = (ctx.enemies || []).filter(e => e && e.alive && e !== ctx.target);
      if (!pool.length) return;
      const t2 = pool[Math.floor(Math.random() * pool.length)];
      const bounce = Math.max(1, Math.round((ctx.dealt || ctx.rawDmg || 0) * 0.6));
      try { ctx.applyDmg(ctx.actor, t2, bounce, '#c060ff', 'Arcane Bounce', 'arcane'); } catch (_) {}
      try { ctx.log(`${ctx.actor.name} Arcane Bounce -> ${t2.name}: ${bounce}`, 'hero'); } catch (_) {}
    },
  },

  // ── CRIT_BLEED_5 ──────────────────────────────────────────────────────────
  // Set: Shadow Adept (2/2). Critical hits inflict Bleed for 5 stacks.
  crit_bleed_5: {
    desc: 'Critical hits apply Bleed for 3 rounds.',
    onCrit(ctx) {
      if (!ctx.target || !ctx.target.alive) return;
      try { ctx.applyStatus(ctx.target, 'bleed', 3, 8); } catch (_) {}
    },
  },

  // ── LOW_MANA_SHOCKWAVE ────────────────────────────────────────────────────
  // Mana Scourge (endgame set). Mana spent while below 25% MP triggers a
  // shockwave that hits all enemies for 15 + 0.5×INT magic damage.
  low_mana_shockwave: {
    desc: 'When mana is below 25%, casting a skill triggers an AoE shockwave.',
    onCast(ctx) {
      if (!ctx.actor || !ctx.actor.mp || !ctx.actor.maxMp) return;
      if (ctx.actor.mp > ctx.actor.maxMp * 0.25) return;
      const intv = ctx.actor.INT || ctx.actor.attrs?.INT || 8;
      const dmg = Math.round(15 + intv * 0.5);
      const enemies = (ctx.enemies || []).filter(e => e && e.alive);
      for (const e of enemies) {
        try { ctx.applyDmg(ctx.actor, e, dmg, '#a040ff', 'Mana Shockwave', 'arcane'); } catch (_) {}
      }
      try { ctx.log(`${ctx.actor.name} Low-Mana Shockwave: ${dmg} to all enemies`, 'hero'); } catch (_) {}
    },
  },

  // ── KILL_PARTY_HEAL ───────────────────────────────────────────────────────
  // Iron Brigade (low-tier). Killing blows heal the party for 10% of the
  // killed target's max HP.
  kill_party_heal: {
    desc: 'Killing blows heal all party members for 10% of the target max HP.',
    onKill(ctx) {
      const healAmt = Math.round((ctx.target?.maxHp || 0) * 0.10);
      if (healAmt <= 0) return;
      const allies = (ctx.allies || []).filter(a => a && a.alive);
      for (const a of allies) {
        try { ctx.heal(a, healAmt); } catch (_) {}
      }
      if (allies.length) {
        try { ctx.log(`Iron Brigade: party healed ${healAmt} HP`, 'hero'); } catch (_) {}
      }
    },
  },

  // ── SPEED_COMBAT_INIT ─────────────────────────────────────────────────────
  // Shadow Pact (mid-tier). At combat start, gain +8 initiative this turn.
  speed_combat_init: {
    desc: 'On combat start, gain +8 initiative for the first round.',
    onCombatStart(ctx) {
      if (!ctx.actor) return;
      ctx.actor._legendaryInitBonus = (ctx.actor._legendaryInitBonus || 0) + 8;
    },
  },

  // ── CHEAT_DEATH_ONCE ──────────────────────────────────────────────────────
  // Sovereign's Regalia (endgame). Once per combat, survive a fatal hit at 1 HP.
  cheat_death_once: {
    desc: 'Once per combat, survive a killing blow with 1 HP remaining.',
    onTakeDamage(ctx) {
      if (!ctx.actor || !ctx.actor.alive) return;
      if (ctx.actor._cheatDeathUsed) return;
      if ((ctx.actor.hp || 0) - (ctx.dealt || 0) > 0) return; // not fatal
      ctx.actor.hp = 1;
      ctx.actor._cheatDeathUsed = true;
      try { ctx.log(`${ctx.actor.name} survives by Sovereign's Grace!`, 'hero'); } catch (_) {}
    },
  },

  // ── BURN_EXTEND ───────────────────────────────────────────────────────────
  // Ember Warden (mid-tier). Burn effects applied by the wearer last 2 extra rounds.
  burn_extend: {
    desc: 'Burn effects applied by this character last 2 extra rounds.',
    // Applied at status-application time — checked in CombatScreen._applyStatus
    // by looking for actor.legendaryBurnExtend.
    onCombatStart(ctx) {
      if (ctx.actor) ctx.actor.legendaryBurnExtend = 2;
    },
  },

  // ── MANA_ON_ATTACK ────────────────────────────────────────────────────────
  // Arcanist's Vestments (mid-tier). Basic attacks restore 3 mana.
  mana_on_attack: {
    desc: 'Basic attacks restore 3 mana.',
    onHit(ctx) {
      if (!ctx.actor || !ctx.actor.maxMp) return;
      const gain = 3;
      ctx.actor.mp = Math.min(ctx.actor.maxMp, (ctx.actor.mp || 0) + gain);
    },
  },

  // ── CRITICAL_ARMORPEN ─────────────────────────────────────────────────────
  // Fang of the Frost Wyrm (mid-tier). Crits apply a 1-round armor-pen debuff.
  critical_armorpen: {
    desc: 'Critical hits cause the target to lose 30% armor for 1 round.',
    onCrit(ctx) {
      if (!ctx.target || !ctx.target.alive) return;
      ctx.target._tempArmorPen = (ctx.target._tempArmorPen || 0) + 0.30;
      ctx.target._tempArmorPenRounds = 1;
    },
  },

  // ── RALLY_ON_KILL ─────────────────────────────────────────────────────────
  // Warlord's Insignia (unique). Killing a non-trivial enemy grants the party
  // the 'rally' status for 1 round.
  rally_on_kill: {
    desc: 'Killing an enemy rallies the entire party for 1 round.',
    onKill(ctx) {
      const allies = (ctx.allies || []).filter(a => a && a.alive);
      for (const a of allies) {
        try { ctx.applyStatus(a, 'rally', 1, 0); } catch (_) {}
      }
    },
  },

  // ── ECHO_CAST ──────────────────────────────────────────────────────────────
  // Unraveler's Mantle (endgame). 25% chance for a cast to echo (repeat at 50% power).
  echo_cast: {
    desc: '25% chance any skill echoes at 50% power against the same target.',
    onCast(ctx) {
      if (!ctx.target || !ctx.target.alive) return;
      if (Math.random() > 0.25) return;
      const echo = Math.max(1, Math.round((ctx.dealt || 0) * 0.5));
      if (!echo) return;
      try { ctx.applyDmg(ctx.actor, ctx.target, echo, '#e080c0', 'Echo Cast', 'arcane'); } catch (_) {}
      try { ctx.log(`${ctx.actor.name} Echo: ${echo} to ${ctx.target.name}`, 'hero'); } catch (_) {}
    },
  },

  // ── DRAGON_FURY_BREATH ────────────────────────────────────────────────────
  // Dragon-Lord's Aspect (endgame). On kill, exhale a fire breath hitting all
  // enemies for 20 + 1×STR fire damage.
  dragon_fury_breath: {
    desc: 'Killing an enemy triggers a breath attack hitting all enemies for 20 + STR fire damage.',
    onKill(ctx) {
      const strv = ctx.actor?.attrs?.STR || ctx.actor?.STR || 10;
      const dmg = Math.round(20 + strv);
      const enemies = (ctx.enemies || []).filter(e => e && e.alive && e !== ctx.target);
      for (const e of enemies) {
        // M368: attribute fire damage to "Dragon Breath" (with element=fire)
        // so the Combat Report meter shows it as its own row instead of folding
        // it into the actor's basic Attack bar.
        try { ctx.applyDmg(ctx.actor, e, dmg, '#ff6020', 'Dragon Breath', 'fire'); } catch (_) {}
        try { ctx.applyStatus(e, 'burn', 2, 6); } catch (_) {}
      }
      if (enemies.length) {
        try { ctx.log(`${ctx.actor.name} Dragon Breath: ${dmg} fire to all enemies`, 'hero'); } catch (_) {}
      }
    },
  },
};

/**
 * Dispatch a legendary hook call for all active legendary effects on an actor.
 *
 * @param {string}   hookName  — e.g. 'onCrit', 'onKill'
 * @param {object}   ctx       — context object (see above)
 * @param {string[]} effectIds — list of effectId strings active on the actor
 */
export function dispatchLegendaryHook(hookName, ctx, effectIds) {
  if (!effectIds || !effectIds.length) return;
  for (const effectId of effectIds) {
    const hook = LEGENDARY_HOOKS[effectId];
    if (!hook) continue;
    const fn = hook[hookName];
    if (typeof fn !== 'function') continue;
    try { fn(ctx); } catch (e) {
      // Never crash combat on legendary hook errors.
      if (typeof console !== 'undefined') console.warn(`[legendary] ${effectId}.${hookName} threw:`, e);
    }
  }
}

/**
 * Get all active legendary effect IDs for a combatant.
 * Reads from actor._legendaryEffectIds which is set during _memberToCombatant
 * in CombatScreen (after applying set/unique legendary effects).
 *
 * @param {object} actor
 * @returns {string[]}
 */
export function getActorLegendaryIds(actor) {
  return actor?._legendaryEffectIds || [];
}
