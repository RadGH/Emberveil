/**
 * colorPalettes.js — M296 Accessibility
 * Defines rarity and combat-state color palettes for 4 modes:
 *   default, deuteranopia, protanopia, tritanopia
 *
 * Each palette is a map of semantic color tokens to hex values.
 * These are applied as CSS custom properties on :root.
 *
 * Research basis:
 *   - Deuteranopia/Protanopia (red-green): use blue/yellow/teal/orange-yellow
 *   - Tritanopia (blue-yellow): use red/green/black/white/orange
 */

export const COLOR_PALETTES = {
  default: {
    '--rarity-normal':    '#c8c8c8',
    '--rarity-magic':     '#6080ff',
    '--rarity-rare':      '#e8d020',
    '--rarity-legendary': '#ff8020',
    '--rarity-set':       '#4fc870',
    '--status-poison':    '#48c840',
    '--status-burn':      '#ff6020',
    '--status-bleed':     '#e03030',
    '--status-freeze':    '#60c8ff',
    '--status-stun':      '#ffd060',
  },
  deuteranopia: {
    // Red-green deficiency: replace red and green with blue/yellow/white/teal
    '--rarity-normal':    '#c8c8c8',
    '--rarity-magic':     '#2090ff',  // bright blue (safe)
    '--rarity-rare':      '#ffd700',  // strong yellow (safe)
    '--rarity-legendary': '#ff9900',  // orange-amber (distinguishable from blue/yellow)
    '--rarity-set':       '#00d4d4',  // teal (safe vs blue)
    '--status-poison':    '#00b4b4',  // teal instead of green
    '--status-burn':      '#ff9900',  // amber instead of red-orange
    '--status-bleed':     '#ff6699',  // pink/magenta instead of red
    '--status-freeze':    '#60c8ff',  // safe light blue
    '--status-stun':      '#ffd700',  // safe yellow
  },
  protanopia: {
    // Similar to deuteranopia but red is even harder — shift to blue/cyan/yellow
    '--rarity-normal':    '#c8c8c8',
    '--rarity-magic':     '#0066ff',  // deep blue
    '--rarity-rare':      '#ffd700',  // strong yellow
    '--rarity-legendary': '#ff9500',  // orange
    '--rarity-set':       '#00cccc',  // cyan
    '--status-poison':    '#00cccc',  // cyan instead of green
    '--status-burn':      '#ffaa00',  // amber instead of orange-red
    '--status-bleed':     '#cc44cc',  // violet-magenta instead of red
    '--status-freeze':    '#66d4ff',  // light blue
    '--status-stun':      '#ffd700',  // yellow
  },
  tritanopia: {
    // Blue-yellow deficiency: use red/green/black/white/orange
    '--rarity-normal':    '#d0d0d0',
    '--rarity-magic':     '#cc0099',  // magenta (safe: no blue)
    '--rarity-rare':      '#ff6600',  // orange (safe: no yellow)
    '--rarity-legendary': '#ff3300',  // red-orange
    '--rarity-set':       '#00cc44',  // green (safe: no blue)
    '--status-poison':    '#00aa33',  // dark green
    '--status-burn':      '#ff3300',  // red
    '--status-bleed':     '#cc0000',  // dark red
    '--status-freeze':    '#cc44cc',  // magenta (no blue)
    '--status-stun':      '#ff8800',  // orange
  },
};

export const PALETTE_LABELS = {
  default:      'Default',
  deuteranopia: 'Deuteranopia (red-green)',
  protanopia:   'Protanopia (red-green)',
  tritanopia:   'Tritanopia (blue-yellow)',
};

export const PALETTE_KEYS = Object.keys(COLOR_PALETTES);

const _STORAGE_KEY = 'emberveil_color_palette';

/** Returns the active palette key from localStorage, defaulting to 'default'. */
export function getActivePaletteKey() {
  const raw = localStorage.getItem(_STORAGE_KEY);
  return COLOR_PALETTES[raw] ? raw : 'default';
}

/** Saves the palette key and applies CSS custom properties to :root. */
export function setActivePalette(key) {
  const palette = COLOR_PALETTES[key] || COLOR_PALETTES.default;
  const k = COLOR_PALETTES[key] ? key : 'default';
  localStorage.setItem(_STORAGE_KEY, k);
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(palette)) {
    root.style.setProperty(prop, value);
  }
}

/** Apply the persisted palette on module load (called from main.js). */
export function applyPersistedPalette() {
  setActivePalette(getActivePaletteKey());
}
