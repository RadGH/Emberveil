export function evalPredicate(predicate, ctx = {}) {
  if (predicate == null) return true;
  if (predicate === true || predicate === false) return predicate;
  if (Array.isArray(predicate)) return predicate.every(p => evalPredicate(p, ctx));
  if (typeof predicate !== 'object') return false;

  const op = predicate.op || predicate.type;
  switch (op) {
    case 'all': return (predicate.terms || predicate.predicates || []).every(p => evalPredicate(p, ctx));
    case 'any': return (predicate.terms || predicate.predicates || []).some(p => evalPredicate(p, ctx));
    case 'not': return !evalPredicate(predicate.term || predicate.predicate, ctx);
    case 'flag': return compareValue(readFlag(ctx, predicate.flag), predicate);
    case 'faction': return compareValue(readPath(ctx.factions, predicate.faction), predicate);
    case 'quest': return compareQuest(ctx, predicate);
    case 'counter': return compareValue(readPath(ctx.counters, predicate.counter), predicate);
    case 'item': return hasItem(ctx, predicate.itemId || predicate.item);
    case 'companion': return compareCompanion(ctx, predicate);
    case 'class': return hasClass(ctx, predicate.classId || predicate.class);
    case 'stat': return compareBestStat(ctx, predicate);
    case 'skillCheck': return resolveSkillCheck(ctx, predicate);
    default: return false;
  }
}

export function validatePredicate(predicate, issues = [], path = 'predicate') {
  if (predicate == null || typeof predicate === 'boolean') return issues;
  if (Array.isArray(predicate)) {
    predicate.forEach((p, i) => validatePredicate(p, issues, `${path}[${i}]`));
    return issues;
  }
  if (typeof predicate !== 'object') {
    issues.push(`${path}: predicate must be an object`);
    return issues;
  }
  const op = predicate.op || predicate.type;
  const known = ['all', 'any', 'not', 'flag', 'faction', 'quest', 'counter', 'item', 'companion', 'class', 'stat', 'skillCheck'];
  if (!known.includes(op)) issues.push(`${path}: unknown predicate op "${op}"`);
  for (const [key, value] of Object.entries(predicate)) {
    if (key === 'terms' || key === 'predicates') (value || []).forEach((p, i) => validatePredicate(p, issues, `${path}.${key}[${i}]`));
    if (key === 'term' || key === 'predicate') validatePredicate(value, issues, `${path}.${key}`);
  }
  return issues;
}

function compareQuest(ctx, p) {
  const quest = readPath(ctx.quests, p.questId || p.quest);
  if (!quest) return false;
  if (p.status && quest.status !== p.status) return false;
  if (p.phase && quest.phase !== p.phase) return false;
  if (p.outcomeId && !(quest.outcomes || []).includes(p.outcomeId)) return false;
  return true;
}

function compareCompanion(ctx, p) {
  const id = p.companion || p.companionId;
  const c = (ctx.companions || ctx.story?.companions || []).find(x => x?.id === id);
  if (!c) return false;
  if (p.recruited != null && !!c.recruited !== !!p.recruited) return false;
  if (p.active != null && !!c.active !== !!p.active) return false;
  if (p.approval != null || p.min != null || p.max != null || p.value != null) return compareValue(c.approval || 0, p);
  return true;
}

function hasItem(ctx, itemId) {
  return (ctx.inventory || ctx.gs?.inventory || []).some(item => item?.id === itemId || item?.itemId === itemId);
}

function hasClass(ctx, classId) {
  return (ctx.party || ctx.gs?.party || []).some(member => member?.class === classId || member?.classId === classId);
}

function compareBestStat(ctx, p) {
  const stat = p.stat;
  const best = Math.max(0, ...(ctx.party || ctx.gs?.party || []).map(m => Number(m?.attrs?.[stat] || m?.[stat] || 0)));
  return compareValue(best, p);
}

function resolveSkillCheck(ctx, p) {
  if (typeof ctx.skillCheck === 'function') return !!ctx.skillCheck(p);
  const statOk = p.stat ? compareBestStat(ctx, { ...p, stat: p.stat, min: p.dc || p.min }) : true;
  return statOk;
}

function compareValue(actual, p) {
  const value = actual == null ? 0 : actual;
  if (p.equals !== undefined) return value === p.equals;
  if (p.value !== undefined && !p.cmp && !p.min && !p.max) return value === p.value;
  if (p.min !== undefined && Number(value) < Number(p.min)) return false;
  if (p.max !== undefined && Number(value) > Number(p.max)) return false;
  if (p.cmp) {
    const target = Number(p.value);
    const n = Number(value);
    if (p.cmp === '>=') return n >= target;
    if (p.cmp === '>') return n > target;
    if (p.cmp === '<=') return n <= target;
    if (p.cmp === '<') return n < target;
    if (p.cmp === '!=') return value !== p.value;
    if (p.cmp === '==') return value === p.value;
  }
  return !!value;
}

function readFlag(ctx, flag) {
  return readPath(ctx.flags, flag) ?? readPath(ctx.story?.flags, flag) ?? readPath(ctx.gs?.story?.flags, flag);
}

function readPath(obj, key) {
  if (!obj || !key) return undefined;
  return obj[key];
}
