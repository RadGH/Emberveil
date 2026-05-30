/**
 * motion.js — M296 Accessibility
 * Single source of truth for reduce-motion state.
 *
 * Three modes (persisted in localStorage as 'emberveil_reduce_motion'):
 *   'auto'  — follow OS prefers-reduced-motion (default)
 *   'on'    — always reduce motion
 *   'off'   — never reduce motion
 *
 * Consumers call isReducedMotion() before playing parallax, transitions, etc.
 */

const _KEY = 'emberveil_reduce_motion';

/** Returns the current reduce-motion mode: 'auto' | 'on' | 'off'. */
export function getReduceMotionMode() {
  const raw = localStorage.getItem(_KEY);
  if (raw === 'on' || raw === 'off') return raw;
  return 'auto';
}

/** Persists the reduce-motion mode. */
export function setReduceMotionMode(mode) {
  if (mode === 'on' || mode === 'off' || mode === 'auto') {
    localStorage.setItem(_KEY, mode);
  }
}

/** Returns true when animations should be suppressed. */
export function isReducedMotion() {
  const mode = getReduceMotionMode();
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  // 'auto' — follow OS
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
