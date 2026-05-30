export function makeRng(seed) {
  let s = (seed | 0) || 1;
  return function rng() {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

export function pickWeighted(rng, entries) {
  const total = entries.reduce((n, e) => n + (e.weight || 1), 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= (e.weight || 1);
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}
