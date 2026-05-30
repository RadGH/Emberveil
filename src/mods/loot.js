/**
 * Loot specifier runtime. Supports two forms:
 *   - Deterministic: { items: ["potion","potion","scroll"] } — returns as-is.
 *   - Rolled:        { roll: { types, bases, quality, rarity, count, seed } }
 *     Each roll picks a type, a base, then rolls quality/rarity within their
 *     weighted ranges, producing an item descriptor the engine can hydrate.
 */
import { makeRng, pickWeighted } from './seededRng.js';

function rollRange(rng, spec) {
  if (!spec) return 1;
  const { min = 1, max = 1 } = spec;
  return Math.floor(min + rng() * (max - min + 1));
}

export function resolveLoot(table, { seed = null } = {}) {
  if (!table) return [];
  if (Array.isArray(table.items)) return table.items.map(id => ({ itemId: id }));
  if (table.roll) {
    const r = table.roll;
    const rng = makeRng(seed ?? r.seed ?? Date.now());
    const count = r.count || 1;
    const results = [];
    for (let i = 0; i < count; i++) {
      const type = r.types ? pickWeighted(rng, r.types.map(v => ({ value: v, weight: 1 }))) : 'item';
      const base = r.bases ? pickWeighted(rng, r.bases.map(v => ({ value: v, weight: 1 }))) : null;
      results.push({ type, base, quality: rollRange(rng, r.quality), rarity: rollRange(rng, r.rarity) });
    }
    return results;
  }
  return [];
}
