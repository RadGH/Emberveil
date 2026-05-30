/**
 * fontScale.js — M296 Accessibility
 * Persists and applies UI font scale as a CSS custom property.
 * Applied to body via: body { font-size: calc(var(--ui-font-scale) * 1rem); }
 *
 * Supported values: 0.8, 1.0, 1.2, 1.5
 */

const _KEY = 'emberveil_font_scale';

export const FONT_SCALE_OPTIONS = [
  { value: '0.8',  label: '80%' },
  { value: '1.0',  label: '100% (default)' },
  { value: '1.2',  label: '120%' },
  { value: '1.5',  label: '150%' },
];

const VALID = new Set(['0.8', '1.0', '1.2', '1.5']);

export function getFontScale() {
  const raw = localStorage.getItem(_KEY);
  return VALID.has(raw) ? raw : '1.0';
}

export function setFontScale(value) {
  const v = VALID.has(String(value)) ? String(value) : '1.0';
  localStorage.setItem(_KEY, v);
  document.documentElement.style.setProperty('--ui-font-scale', v);
}

export function applyPersistedFontScale() {
  setFontScale(getFontScale());
}
