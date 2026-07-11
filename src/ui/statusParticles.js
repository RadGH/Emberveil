/**
 * statusParticles — M398
 *
 * Resolves a fallback chain of icon URLs for a given status-effect type.
 * Order: SpriteCook PNG (when available) → SVG fallback → null.
 *
 * The PNG and SVG live under public/images/particles/. Three "review-flagged"
 * SpriteCook PNGs are shipped today (burning, frozen, sleeping); every other
 * status uses an SVG-only fallback until a SpriteCook generation lands.
 *
 * Generation status is recorded by presence of the PNG file — the resolver
 * just queues both URLs and the consumer's <img onerror> walks the chain.
 *
 * Consumers:
 *   - EvBattlefield FX layer (per-combatant overlays)
 *   - EvCardRail status row (small inline icons inside character cards)
 *
 * Public API:
 *   getStatusParticleSources(type)    → string[]   (URLs to try in order)
 *   createStatusParticleEl(type, opts)→ HTMLElement | null
 */

const BASE = (typeof import.meta !== 'undefined' && __APP_BASE__) || '/';

// Map of status-type → preferred filename stems. Aliases are listed so that
// internal status names (`burn`, `freeze`, `sleep`) resolve to the same file
// as their human-friendly art labels (`burning`, `frozen`, `sleeping`).
const PARTICLE_FILENAMES = {
  burn:     ['burning'],
  burning:  ['burning'],
  freeze:   ['frozen'],
  frozen:   ['frozen'],
  sleep:    ['sleeping'],
  sleeping: ['sleeping'],
  poison:   ['poison'],
  bleed:    ['bleed'],
  stun:     ['stun'],
  slow:     ['slow'],
  regen:    ['regen'],
  curse:    ['curse'],
  silence:  ['silence'],
  blind:    ['blind'],
  marked:   ['marked'],
};

// Status types that ship a SpriteCook PNG today (review-flagged). Anything
// not in this list uses the SVG fallback only.
const HAS_PNG = new Set(['burn', 'burning', 'freeze', 'frozen', 'sleep', 'sleeping']);

/**
 * Returns an ordered list of URLs to try for the given status type.
 *  - If the status has a SpriteCook PNG, it is tried first.
 *  - The SVG fallback is always included as the final candidate.
 *  - Unknown status types return an empty array (caller can render a glyph).
 */
export function getStatusParticleSources(type) {
  const stems = PARTICLE_FILENAMES[type];
  if (!stems || !stems.length) return [];
  const out = [];
  for (const stem of stems) {
    if (HAS_PNG.has(type)) out.push(`${BASE}images/particles/${stem}.png`);
    out.push(`${BASE}images/particles/${stem}.svg`);
  }
  return out;
}

/**
 * Build an <img> element wired to walk the fallback chain. Returns null when
 * no source is registered for the type so the caller can decide whether to
 * render a text glyph instead.
 *
 * @param {string} type   status type id (`burn`, `sleep`, …)
 * @param {object} [opts] { width=24, height=24, alt='', className='' }
 */
export function createStatusParticleEl(type, opts = {}) {
  const sources = getStatusParticleSources(type);
  if (!sources.length) return null;
  const img = document.createElement('img');
  img.alt = opts.alt || '';
  img.width  = opts.width  || 24;
  img.height = opts.height || 24;
  img.className = `status-particle ${opts.className || ''}`.trim();
  img.setAttribute('aria-hidden', 'true');
  img.dataset.statusType = type;
  let idx = 0;
  img.src = sources[idx];
  img.addEventListener('error', () => {
    idx++;
    if (idx < sources.length) img.src = sources[idx];
  });
  return img;
}

/** True iff the status type has any PNG/SVG source registered. */
export function hasStatusParticle(type) {
  return getStatusParticleSources(type).length > 0;
}
