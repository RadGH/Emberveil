/**
 * spriteUtils — portrait path resolution with fallback chain
 *
 * M463 — manifest-driven sprite loading. The game now resolves per-frame
 * paths from public/assets/appearances-manifest.json instead of hardcoding
 * `images/spritecook/${id}_${pose}.png`. Each manifest entry stores a
 * `sourceDir` per pose ("openai_v2" or "spritecook"), so individual frames
 * of one character can come from different generators (per-frame mixing).
 *
 * The legacy hardcoded convention is kept as a final fallback so we never
 * 404 mid-migration.
 */
import { CLASSES } from './classes.js';
import { resolveSprite } from './appearances.js';
import { logImage } from '../utils/imageLog.js';
import { getSpriteAdjustmentCss } from './spriteAdjustments.js';

// ---------------------------------------------------------------------------
// Manifest loader (single fetch, cached). Synchronous getSpritePath() reads
// from the cache; until the manifest loads we fall back to the legacy
// convention so the page never blocks on a network round-trip. Bootstrapped
// by main.js on app start; safe to call multiple times.
// ---------------------------------------------------------------------------
let _manifest = null;
let _manifestPromise = null;
const _BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

/** Index appearances/companions/enemies/bosses by id → sprites map. */
function _indexManifest(raw) {
  const idx = {};
  for (const sec of ['appearances', 'companions', 'enemies', 'bosses']) {
    const list = raw?.[sec] || [];
    for (const a of list) {
      if (a?.id && !idx[a.id]) idx[a.id] = a;
      // Also index by sprite key — characters routinely store the sprite
      // prefix (e.g. 'warrior') rather than the appearance id.
      if (a?.sprite && !idx[a.sprite]) idx[a.sprite] = a;
    }
  }
  return idx;
}

/** Kick off the manifest load. Resolves to the indexed map. Idempotent. */
export function ensureSpriteManifest() {
  if (_manifest) return Promise.resolve(_manifest);
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = fetch(`${_BASE}assets/appearances-manifest.json`, { cache: 'force-cache' })
    .then(r => r.ok ? r.json() : null)
    .then(raw => { _manifest = raw ? _indexManifest(raw) : {}; return _manifest; })
    .catch(() => { _manifest = {}; return _manifest; });
  return _manifestPromise;
}

// Auto-bootstrap on module load — non-blocking.
if (typeof window !== 'undefined') ensureSpriteManifest();

/**
 * Return the canonical URL for a (spriteId, pose). Uses the manifest when
 * loaded; falls back to the legacy spritecook convention otherwise. Always
 * returns a string — callers can attach onerror chains for further fallback.
 *
 * @param {string} spriteId  - sprite key or appearance/entity id
 * @param {string} pose      - canonical pose name (portrait, south, east_attack, …)
 * @returns {string} URL relative to the base
 */
export function getSpritePath(spriteId, pose) {
  if (!spriteId || !pose) return `${_BASE}images/spritecook/${spriteId}_${pose}.png`;
  const entry = _manifest && _manifest[spriteId];
  const rel   = entry?.sprites?.[pose];   // e.g. "openai_v2/bandit_portrait.png"
  if (rel) return `${_BASE}images/${rel}`;
  return `${_BASE}images/spritecook/${spriteId}_${pose}.png`;
}

/**
 * Returns an inline SVG HTML string for the class icon next to a hero's name.
 * Falls back to a generic circle if the class is not found.
 * @param {string|object} memberOrClassId - either a class id string or a member object
 * @param {number} size - CSS pixel size (default 14)
 * @param {string} [extraClass]
 * @returns {string} HTML string containing an <svg> element wrapped in a span.
 */
export function classIconSvg(memberOrClassId, size = 14, extraClass = '') {
  const classId = typeof memberOrClassId === 'string'
    ? memberOrClassId
    : (memberOrClassId?.class || memberOrClassId?.cls);
  const cls = CLASSES.find(c => c.id === classId);
  const raw = cls?.svgIcon
    || `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="18" r="12"/></svg>`;
  const clsName = `class-icon${extraClass ? ' ' + extraClass : ''}`;
  // Force inner svg to fill the span via inline sizing attribute.
  const sized = raw.replace(/<svg\b/, `<svg width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:block"`);
  return `<span class="${clsName}" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;color:#e8a020;vertical-align:middle;flex-shrink:0" aria-hidden="true">${sized}</span>`;
}

/**
 * Returns portrait image paths for a character, ordered by preference.
 * @param {object} member - Character/companion object
 * @returns {{ spritecookPath: string, oldPath: string, spritePath: string }}
 */
export function getPortraitPaths(member) {
  // Appearance-first resolution: `member.appearance` overrides the
  // class-derived sprite key so a Cleric (class) can look like a
  // Mage (appearance). Falls back to class for legacy characters.
  let id = resolveSprite(member);
  if (!id) {
    const classKey = member.cls || member.class;
    id = member.templateId || member.classId
      || (classKey && classKey !== 'companion' ? classKey : null)
      || member.id || member.class;
  }
  // M463 — primary path now comes from the manifest (openai_v2 wins where
  // present; otherwise the legacy spritecook URL). Two extra fallback
  // candidates (legacy portrait + first east frame) keep the onerror chain
  // resilient across the migration.
  return {
    spritecookPath: getSpritePath(id, 'portrait'),
    oldPath: `${_BASE}images/portraits/${id}.png`,
    spritePath: getSpritePath(id, 'east'),
  };
}

/**
 * Returns an <img> HTML string with onerror fallback chain.
 * @param {object} member - Character/companion object
 * @param {number} size - CSS pixel size (width & height)
 * @param {string} [extraClass] - Additional CSS class(es)
 * @returns {string} HTML string
 */
export function portraitImg(member, size = 40, extraClass = '', context = 'portrait') {
  // M76: when sprites are disabled, fall back to the class icon. We ignore
  // the per-member appearance override here on purpose — without sprites
  // there's no way to show appearance variants, so a Cleric-with-Mage-look
  // shows the Cleric icon. (Documented in the settings tooltip.)
  if (typeof window !== 'undefined' && window.__gfxDisableSprites) {
    const cls = `char-portrait${extraClass ? ' ' + extraClass : ''}`;
    const inner = classIconSvg(member, Math.max(16, Math.floor(size * 0.7)));
    return `<span class="${cls}" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:rgba(255,255,255,0.04);border-radius:4px;border:1px solid rgba(232,160,32,0.2);box-sizing:border-box" aria-label="${member.name || ''}">${inner}</span>`;
  }
  const p = getPortraitPaths(member);
  logImage(context, { entityId: member.id || member.class || '', pose: 'portrait', file: p.spritecookPath, w: size, h: size });
  const cls = `char-portrait${extraClass ? ' ' + extraClass : ''}`;
  const spriteId = resolveSprite(member) || member.templateId || member.classId || member.cls || member.class || member.id;
  // Per-(spriteId,pose) scale + offset overrides authored via /assets/sprite-adjust.html.
  // Offsets are pixel values relative to the source sprite scale; for thumbnails we
  // proportionally shrink them so a 256px-authored offset reads sensibly at small sizes.
  const adjCss = getSpriteAdjustmentCss(spriteId, 'portrait');
  let extraStyle = '';
  if (adjCss) {
    const m = adjCss.match(/translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+)\)/);
    if (m) {
      const k = size / 256;
      extraStyle = `transform:translate(${(+m[1] * k).toFixed(2)}px,${(+m[2] * k).toFixed(2)}px) scale(${m[3]});transform-origin:center center;`;
    }
  }
  return `<img src="${p.spritecookPath}"
    onerror="this.onerror=function(){this.onerror=null;this.src='${p.spritePath}';this.onerror=function(){this.style.display='none';}};this.src='${p.oldPath}';"
    class="${cls}"
    width="${size}" height="${size}"
    loading="lazy"
    alt="${member.name || ''}"
    style="width:${size}px;height:${size}px;image-rendering:pixelated;object-fit:contain;${extraStyle}" />`;
}
