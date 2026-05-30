export function buildEnemyInstance(baseEnemy, modifier = {}) {
  const inst = clone(baseEnemy || {});
  if (modifier.nameOverride) inst.name = modifier.nameOverride;
  if (modifier.statMultipliers && typeof modifier.statMultipliers === 'object') {
    for (const [key, mult] of Object.entries(modifier.statMultipliers)) {
      if (inst[key] != null) inst[key] = Math.max(1, Math.round(Number(inst[key]) * Number(mult)));
    }
  }
  if (Array.isArray(modifier.addSkills)) {
    inst.spellList = [...(inst.spellList || []), ...modifier.addSkills];
  }
  if (Array.isArray(modifier.addTags)) {
    inst.tags = [...(inst.tags || []), ...modifier.addTags];
  }
  if (modifier.statusOnStart) inst.statusOnStart = clone(modifier.statusOnStart);
  if (modifier.championTier != null) inst.championTier = modifier.championTier;
  if (Array.isArray(modifier.affixes)) inst.affixes = [...modifier.affixes];
  return inst;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
