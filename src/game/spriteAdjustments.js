/**
 * spriteAdjustments — per-(spriteId, pose) scale + offset overrides.
 *
 * Source of truth: public/data/sprite_adjustments.json
 * Authored via /assets/sprite-adjust.html.
 *
 * Schema: { "<spriteId>": { scale, offsetX, offsetY, perPose: { "<pose>": { scale, offsetX, offsetY } } } }
 *
 * Loaded once on first call to getSpriteAdjustment(); subsequent calls hit the
 * cache. Returns identity (1,0,0) until the fetch resolves so call sites can
 * always treat the result as defined.
 */

import { getSiteBaseHref } from '../utils/siteBase.js';

let _data = null;
let _fetch = null;

function _ensure() {
  if (_data || _fetch) return;
  const base = getSiteBaseHref();
  _fetch = fetch(`${base}data/sprite_adjustments.json`)
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      const out = {};
      if (j && typeof j === 'object') {
        for (const [k, v] of Object.entries(j)) {
          if (k.startsWith('$')) continue;
          if (v && typeof v === 'object') out[k] = v;
        }
      }
      _data = out;
    })
    .catch(() => { _data = {}; });
}

export function getSpriteAdjustment(spriteId, pose) {
  if (!_data) { _ensure(); return { scale: 1, offsetX: 0, offsetY: 0 }; }
  const entry = _data[spriteId];
  if (!entry) return { scale: 1, offsetX: 0, offsetY: 0 };
  const per = entry.perPose && entry.perPose[pose];
  return {
    scale: (per && typeof per.scale === 'number') ? per.scale : (typeof entry.scale === 'number' ? entry.scale : 1),
    offsetX: (per && typeof per.offsetX === 'number') ? per.offsetX : (typeof entry.offsetX === 'number' ? entry.offsetX : 0),
    offsetY: (per && typeof per.offsetY === 'number') ? per.offsetY : (typeof entry.offsetY === 'number' ? entry.offsetY : 0),
  };
}

/**
 * Returns a CSS transform string suitable for inlining on an <img> rendered
 * inside a fixed-size box. Returns empty string when no adjustment applies,
 * so callers can append unconditionally.
 */
export function getSpriteAdjustmentCss(spriteId, pose) {
  const adj = getSpriteAdjustment(spriteId, pose);
  if (adj.scale === 1 && adj.offsetX === 0 && adj.offsetY === 0) return '';
  return `transform:translate(${adj.offsetX}px,${adj.offsetY}px) scale(${adj.scale});transform-origin:center center;`;
}

// Kick the fetch on module load so the first render already has data.
_ensure();
