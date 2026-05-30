/**
 * Effect DSL runtime. Walks an effects[] array and executes each op against
 * a context { caster, targets, rng, flags, log, emit }.
 *
 * Ops: damage, heal, applyStatus, buff, setFlag, requireFlag, consumeStatus,
 *      resourceSwap, echo, ritual, modifyTurnOrder, onHit, onCrit, onKill, onEvent,
 *      incrementFlag, consumeFlag, requireFlags (M133 flag ledger),
 *      stealStatus (M172 dispel-and-transfer).
 */
import { addStatus, removeStatus, hasStatus } from './statusModel.js';

function resolveTargets(ctx, target) {
  if (!target || target === 'target' || target === 'enemy') return ctx.targets || [];
  if (target === 'self' || target === 'caster') return [ctx.caster];
  if (target === 'allEnemies') return ctx.enemies || ctx.targets || [];
  if (target === 'allAllies') return ctx.allies || [ctx.caster];
  return ctx.targets || [];
}

function statValue(actor, stat) {
  if (!actor) return 0;
  if (stat === 'flat') return 1;
  return actor.stats?.[stat] ?? actor[stat] ?? 0;
}

const ops = {
  damage(step, ctx) {
    const amt = (step.amount || 0) + statValue(ctx.caster, step.stat) * (step.mult || 0);
    for (const t of resolveTargets(ctx, step.target)) {
      const dealt = Math.max(0, Math.round(amt));
      t.hp = Math.max(0, (t.hp || 0) - dealt);
      ctx.log?.(`${ctx.caster?.name || 'actor'} hits ${t.name || 'target'} for ${dealt}`);
      if (dealt > 0) ctx.emit?.('onHit', { caster: ctx.caster, target: t, amount: dealt });
      if (t.hp === 0) ctx.emit?.('onKill', { caster: ctx.caster, target: t });
    }
  },
  heal(step, ctx) {
    const amt = (step.amount || 0) + statValue(ctx.caster, step.stat) * (step.mult || 0);
    for (const t of resolveTargets(ctx, step.target || 'self')) {
      const max = t.maxHp || t.hpMax || 100;
      const before = t.hp || 0;
      t.hp = Math.min(max, before + amt);
      ctx.log?.(`${t.name || 'target'} healed ${t.hp - before}`);
    }
  },
  applyStatus(step, ctx) {
    const chance = step.chance ?? 1;
    if ((ctx.rng?.() ?? Math.random()) > chance) return;
    for (const t of resolveTargets(ctx, step.target)) {
      // M173: carry forward amount/power so status entries like counterStance
      // (amount=150) / barrier (power=20) can be authored in the DSL directly.
      const s = { type: step.status, duration: step.duration || 1, stacks: step.stacks || 1 };
      if (step.amount !== undefined) s.amount = step.amount;
      if (step.power !== undefined) s.power = step.power;
      addStatus(t, s);
    }
  },
  buff(step, ctx) {
    for (const t of resolveTargets(ctx, step.target || 'self')) {
      addStatus(t, { type: `buff:${step.key}`, amount: step.amount, duration: step.duration || 3 });
    }
  },
  setFlag(step, ctx) {
    if (!ctx.flags) ctx.flags = {};
    ctx.flags[step.flag] = step.value ?? true;
  },
  requireFlag(step, ctx) {
    const ok = (ctx.flags?.[step.flag] ?? null) === (step.value ?? true);
    if (!ok) ctx._skip = true;
  },
  // M133: flag ledger ops — persistent storyFlags via ctx.gameState (optional).
  // When ctx.gameState is present, writes go through the ledger helpers so
  // event chains see the same flags across sessions. Without it, falls back
  // to ctx.flags (in-memory scratch) so unit tests stay pure.
  incrementFlag(step, ctx) {
    const delta = step.by ?? step.amount ?? 1;
    if (ctx.gameState?.incrementFlag) {
      ctx.gameState.incrementFlag(step.flag, delta);
    } else {
      if (!ctx.flags) ctx.flags = {};
      const cur = Number(ctx.flags[step.flag]);
      ctx.flags[step.flag] = (Number.isFinite(cur) ? cur : 0) + delta;
    }
  },
  consumeFlag(step, ctx) {
    let consumed = false;
    if (ctx.gameState?.consumeFlag) {
      consumed = ctx.gameState.consumeFlag(step.flag);
    } else if (ctx.flags && ctx.flags[step.flag]) {
      delete ctx.flags[step.flag];
      consumed = true;
    }
    if (!consumed && step.required) ctx._skip = true;
  },
  requireFlags(step, ctx) {
    const list = step.flags || [];
    let ok;
    if (ctx.gameState?.requireFlags) {
      ok = ctx.gameState.requireFlags(list);
    } else {
      ok = list.every(e => {
        if (typeof e !== 'string') return true;
        const neg = e.startsWith('!');
        const key = neg ? e.slice(1) : e;
        const v = ctx.flags?.[key];
        const truthy = v !== undefined && v !== null && v !== false && v !== 0;
        return neg ? !truthy : truthy;
      });
    }
    if (!ok) ctx._skip = true;
  },
  consumeStatus(step, ctx) {
    for (const t of resolveTargets(ctx, step.target)) {
      if (hasStatus(t, step.status)) removeStatus(t, step.status);
    }
  },
  // M172: move one or more statuses from source → dest. step.status can be a
  // string (single type) or an array of types; step.prefix matches any type
  // starting with that string (e.g. "buff:" to grab all stat buffs). `from`
  // defaults to 'target', `to` defaults to 'self'. Transfers the full status
  // entry (duration, stacks, amount) — dispel-with-benefit.
  stealStatus(step, ctx) {
    const from = resolveTargets(ctx, step.from || 'target')[0];
    const to = resolveTargets(ctx, step.to || 'self')[0];
    if (!from || !to || !Array.isArray(from.statuses)) return;
    const types = Array.isArray(step.status) ? step.status : (step.status ? [step.status] : null);
    const prefix = step.prefix || null;
    const matches = from.statuses.filter(s =>
      (types && types.includes(s.type)) ||
      (prefix && typeof s.type === 'string' && s.type.startsWith(prefix))
    );
    const max = step.max || matches.length;
    const taken = matches.slice(0, max);
    for (const s of taken) {
      addStatus(to, { ...s });
      removeStatus(from, s.type);
    }
    ctx.log?.(`stealStatus: moved ${taken.length} status(es) from ${from.name || 'target'} to ${to.name || 'self'}`);
  },
  resourceSwap(step, ctx) {
    const t = resolveTargets(ctx, step.target || 'self')[0];
    if (!t) return;
    const amt = step.amount || 0;
    if (step.from === 'hp') t.hp = Math.max(0, (t.hp || 0) - amt);
    if (step.from === 'mp') t.mp = Math.max(0, (t.mp || 0) - amt);
    if (step.to === 'hp') t.hp = Math.min(t.maxHp || t.hpMax || 100, (t.hp || 0) + amt);
    if (step.to === 'mp') t.mp = Math.min(t.maxMp || t.mpMax || 100, (t.mp || 0) + amt);
  },
  echo(step, ctx) {
    const skill = ctx.skillsById?.[step.of];
    if (!skill) return;
    const mult = step.mult ?? 0.5;
    runEffects(skill.effects || [], { ...ctx, _echoMult: mult });
  },
  ritual(step, ctx) {
    if (!ctx.caster) return;
    if (!ctx.caster._rituals) ctx.caster._rituals = [];
    ctx.caster._rituals.push({ rounds: step.rounds, thenEffects: step.thenEffects });
  },
  modifyTurnOrder(step, ctx) {
    for (const t of resolveTargets(ctx, step.target || 'self')) {
      t.turnOrderOffset = (t.turnOrderOffset || 0) + (step.delta || 0);
    }
  },
  onHit(step, ctx) { attachTrigger(ctx, 'onHit', step.effects); },
  onCrit(step, ctx) { attachTrigger(ctx, 'onCrit', step.effects); },
  onKill(step, ctx) { attachTrigger(ctx, 'onKill', step.effects); },
  onEvent(step, ctx) { attachTrigger(ctx, step.event, step.effects); }
};

function attachTrigger(ctx, event, effects) {
  if (!ctx.caster) return;
  if (!ctx.caster._triggers) ctx.caster._triggers = {};
  if (!ctx.caster._triggers[event]) ctx.caster._triggers[event] = [];
  ctx.caster._triggers[event].push(effects);
}

export function runEffects(effects, ctx) {
  if (!Array.isArray(effects)) return;
  ctx._skip = false;
  for (const step of effects) {
    if (ctx._skip) break;
    const fn = ops[step.op];
    if (!fn) {
      ctx.log?.(`[dsl] unknown op: ${step.op}`);
      continue;
    }
    try { fn(step, ctx); }
    catch (err) { ctx.log?.(`[dsl] ${step.op} failed: ${err.message}`); }
  }
}

export function availableOps() {
  return Object.keys(ops);
}
