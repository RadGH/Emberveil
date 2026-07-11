/**
 * storyPredicate.js — Predicate DSL evaluator (§3.2 of the refined plan).
 *
 * evalPredicate(pred, ctx) -> boolean
 *
 * ctx shape:
 *   { flags, factions, quests, counters, party, companions }
 *
 * All ops are pure. Unknown ops warn + return false (never throw).
 */

export function evalPredicate(pred, ctx) {
  if (!pred) return true;
  const { flags, factions, quests, counters, party, companions } = ctx;
  if ('all' in pred) return pred.all.every(p => evalPredicate(p, ctx));
  if ('any' in pred) return pred.any.some(p => evalPredicate(p, ctx));
  if ('not' in pred) return !evalPredicate(pred.not, ctx);
  if ('flag' in pred) return !!flags[pred.flag];
  if ('faction' in pred) {
    const v = (factions || {})[pred.faction] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    if ('lte' in pred) return v <= pred.lte;
    if ('eq'  in pred) return v === pred.eq;
    return v !== 0;
  }
  if ('quest' in pred) {
    const q = (quests || {})[pred.quest];
    if (!q) return false;
    if ('phase'  in pred) return q.phase === pred.phase;
    if ('status' in pred) return q.status === pred.status;
    return true;
  }
  if ('counter' in pred) {
    const v = (counters || {})[pred.counter] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    if ('lte' in pred) return v <= pred.lte;
    return v > 0;
  }
  if ('item' in pred) {
    return (party || []).some(m =>
      m.equipment
        ? Object.values(m.equipment).some(it => it?.id === pred.item)
        : false
    );
  }
  if ('class' in pred) {
    return (party || []).some(m => (m.cls || m.class) === pred.class);
  }
  if ('stat' in pred) {
    const v = ((party || [])[0]?.attrs || {})[pred.stat] ?? 0;
    if ('gte' in pred) return v >= pred.gte;
    if ('lte' in pred) return v <= pred.lte;
    return v > 0;
  }
  if ('companion' in pred) {
    const c = (companions || []).find(c => c.id === pred.companion);
    if (!c || !c.recruited) return false;
    if (pred.active && !c.active) return false;
    if (pred.approval?.gte != null && c.approval < pred.approval.gte) return false;
    if (pred.approval?.lte != null && c.approval > pred.approval.lte) return false;
    return true;
  }
  if ('skillCheck' in pred) return true; // Director-use hint only; always passes at runtime
  console.warn('[evalPredicate] unknown op', pred);
  return false;
}

/**
 * Pretty-print a predicate for debugging / linter output.
 */
export function formatPredicate(pred, indent = 0) {
  if (!pred) return 'null';
  const pad = '  '.repeat(indent);
  if ('all' in pred) return `${pad}ALL [\n${pred.all.map(p => formatPredicate(p, indent + 1)).join('\n')}\n${pad}]`;
  if ('any' in pred) return `${pad}ANY [\n${pred.any.map(p => formatPredicate(p, indent + 1)).join('\n')}\n${pad}]`;
  if ('not' in pred) return `${pad}NOT ${formatPredicate(pred.not, indent)}`;
  if ('flag'        in pred) return `${pad}flag(${pred.flag})`;
  if ('faction'     in pred) {
    const op = 'gte' in pred ? `>=${pred.gte}` : 'lte' in pred ? `<=${pred.lte}` : 'eq' in pred ? `==${pred.eq}` : '!= 0';
    return `${pad}faction(${pred.faction}) ${op}`;
  }
  if ('quest'  in pred) {
    const sub = 'phase' in pred ? `phase=${pred.phase}` : 'status' in pred ? `status=${pred.status}` : 'exists';
    return `${pad}quest(${pred.quest}) ${sub}`;
  }
  if ('counter'  in pred) {
    const op = 'gte' in pred ? `>=${pred.gte}` : 'lte' in pred ? `<=${pred.lte}` : '> 0';
    return `${pad}counter(${pred.counter}) ${op}`;
  }
  if ('item'      in pred) return `${pad}item(${pred.item})`;
  if ('class'     in pred) return `${pad}class(${pred.class})`;
  if ('stat'      in pred) {
    const op = 'gte' in pred ? `>=${pred.gte}` : 'lte' in pred ? `<=${pred.lte}` : '> 0';
    return `${pad}stat(${pred.stat}) ${op}`;
  }
  if ('companion' in pred) {
    const extra = [
      pred.active            != null ? `active=${pred.active}` : '',
      pred.approval?.gte != null ? `approval>=${pred.approval.gte}` : '',
      pred.approval?.lte != null ? `approval<=${pred.approval.lte}` : '',
    ].filter(Boolean).join(', ');
    return `${pad}companion(${pred.companion}${extra ? ` [${extra}]` : ''})`;
  }
  if ('skillCheck' in pred) return `${pad}skillCheck(${pred.skillCheck}) >= ${pred.gte ?? '?'}`;
  return `${pad}UNKNOWN(${JSON.stringify(pred)})`;
}
