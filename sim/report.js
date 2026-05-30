// Aggregate report for a policy run.
export function aggregate(results) {
  const n = results.length;
  const deaths = results.filter(r => r.outcome === 'dead').length;
  const cleared = n - deaths;
  const actSum = results.reduce((s, r) => s + r.actReached, 0);
  const goldSum = results.reduce((s, r) => s + (r.goldAtDeath || 0), 0);
  const encSum = results.reduce((s, r) => s + (r.encountersCleared || 0), 0);
  const deathsByAct = {};
  const firstLoss = {};
  for (const r of results) {
    if (r.outcome === 'dead') {
      deathsByAct[r.actReached] = (deathsByAct[r.actReached] || 0) + 1;
      if (r.encounterLost) firstLoss[r.encounterLost] = (firstLoss[r.encounterLost] || 0) + 1;
    }
  }
  return {
    iterations: n,
    deaths,
    deathRate: deaths / n,
    cleared,
    clearRate: cleared / n,
    avgActReached: +(actSum / n).toFixed(2),
    avgEncountersCleared: +(encSum / n).toFixed(1),
    avgGold: Math.round(goldSum / n),
    deathsByAct,
    topDeathEncounters: Object.entries(firstLoss).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

export function formatSummary(policyName, agg) {
  const pct = (agg.deathRate * 100).toFixed(1);
  const byAct = Object.keys(agg.deathsByAct).sort().map(a => `A${a}:${agg.deathsByAct[a]}`).join(' ');
  const top = agg.topDeathEncounters.length ? `   first-loss: ${agg.topDeathEncounters.map(([k, v]) => `${k}×${v}`).join(' ')}` : '';
  return `${policyName.padEnd(14)} deaths ${agg.deaths}/${agg.iterations} (${pct}%)   act avg ${agg.avgActReached}   enc avg ${agg.avgEncountersCleared}   gold avg ${agg.avgGold}   ${byAct}${top}`;
}
