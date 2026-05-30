/**
 * buildPresets.js — M399
 *
 * Per-class build presets that drive the auto-attribute allocator and the
 * starting-equipment roll on hero creation. Player picks a build after
 * choosing a class; the build defines:
 *
 *   - target attribute distribution at level cap (sums to 100)
 *   - plateau caps (e.g. DEX stops growing past 95% hit chance)
 *   - preferred weapon families (drives the starter equipment roll)
 *   - preferred skills (the auto-skill picker biases toward these)
 *
 * The allocator (see autoAssignAttrs in simulator.js + the per-level helper
 * in xp.js) treats the target distribution as the "shape" the character grows
 * into. Stats with weight 0 stay at the base 8 — a Warrior with the
 * Berserker build will never invest in INT, for instance.
 *
 * Player-facing copy lives on the build object as `name` + `description`;
 * the Class Catalog page renders both for review.
 *
 * Build preset shape:
 *   id            — string, unique within class
 *   name          — display name
 *   description   — single-paragraph plain-English summary
 *   targetAttrs   — { STR, DEX, INT, CON } weights, sum to 100
 *                    (interpreted as % of total post-base attribute budget)
 *   plateaus      — optional caps. Examples:
 *                    { DEX: { until: 'hit95' } } — fill DEX until 95% hit, then redirect
 *                    { CON: { atLeast: 0.50 } } — never let CON drop below 50% of budget
 *   weapons       — preferred weapon ids in priority order (used by starter roll)
 *   shieldPref    — 'always' | 'sometimes' | 'never'
 *   preferredSkills — ordered list of skill ids the auto-skill picker prefers
 *   tags          — flavor tags ('tank', 'dps', 'caster', 'hybrid')
 *
 * Canonical data now lives in public/data/build-presets.json (the `builds`
 * map = the former BUILDS literal), loaded via dataLoader.js. This file owns
 * the lookup helpers only; the BUILDS export is byte-identical to the
 * pre-migration inline literal (proven by
 * scripts/verify-builds-classes-parity.mjs).
 */
import { BUILDS_CANONICAL } from './dataLoader.js';

export const BUILDS = BUILDS_CANONICAL;

/**
 * Returns the preset list for a class id, or empty array if class has none.
 */
export function getBuilds(classId) {
  return BUILDS[classId] || [];
}

/**
 * Returns the default (first) build for a class — used when the player skips
 * the picker or for legacy heroes that have no build set.
 */
export function getDefaultBuild(classId) {
  const list = getBuilds(classId);
  return list[0] || null;
}

/**
 * Find a specific build by id. Falls back to the class's default if not found.
 */
export function getBuild(classId, buildId) {
  const list = getBuilds(classId);
  if (!buildId) return list[0] || null;
  return list.find(b => b.id === buildId) || list[0] || null;
}
