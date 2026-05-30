/**
 * imageLog — debug helper for image/sprite render tracing.
 *
 * When the "Log Images" toggle is on in Debug Settings (persisted as
 * emberveil_dbg_log_images in localStorage), every call to logImage()
 * emits a structured console.debug line:
 *
 *   [img] {context} {entityId} {pose} -> {filepath} @ ({x},{y}) size ({w}x{h})
 *
 * This is a no-op in production (flag off) with zero runtime cost.
 */

/**
 * Returns true when the Log Images debug flag is active.
 * Reads localStorage directly so the flag change takes effect immediately
 * without requiring a page reload.
 * @returns {boolean}
 */
export function isImageLogActive() {
  try {
    return localStorage.getItem('emberveil_dbg_log_images') === '1';
  } catch {
    return false;
  }
}

/**
 * Log a single image render event to the console when the flag is on.
 *
 * @param {string} context   - Where the image renders (e.g. 'combat-hero', 'town-party', 'inventory-grid')
 * @param {object} opts
 * @param {string} [opts.entityId]  - Character id, enemy id, or other identifier
 * @param {string} [opts.pose]      - Sprite variant/pose (e.g. 'east', 'east_attack', 'portrait', 'bg')
 * @param {string} [opts.file]      - Image file path or src
 * @param {number} [opts.x]         - Render X coordinate (canvas px or CSS px)
 * @param {number} [opts.y]         - Render Y coordinate
 * @param {number} [opts.w]         - Rendered width
 * @param {number} [opts.h]         - Rendered height
 */
export function logImage(context, { entityId = '', pose = '', file = '', x, y, w, h } = {}) {
  if (!isImageLogActive()) return;
  const pos  = (x != null && y != null) ? ` @ (${Math.round(x)},${Math.round(y)})` : '';
  const size = (w != null && h != null) ? ` size (${Math.round(w)}x${Math.round(h)})` : '';
  // eslint-disable-next-line no-console
  console.debug(`[img] ${context} ${entityId} ${pose} -> ${file}${pos}${size}`);
}
