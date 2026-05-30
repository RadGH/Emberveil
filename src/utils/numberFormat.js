/**
 * numberFormat.js — M308 centralized number formatting helper.
 *
 * formatStat(value, kind) where kind is one of:
 *   'int'    — Math.floor, plain integer (HP, MP, STR, DEX, armor, gold-floor, damage, etc.)
 *   'pct'    — 1–2 decimal places + "%" (crit chance, dodge %, resistances)
 *   'mult'   — 1–2 decimal places + "x" suffix (damage multiplier)
 *   'damage' — integer (same as 'int' but semantically labeled for damage values)
 *   'time'   — integer seconds, or "Mm Ss" if >= 60s
 *   'gold'   — integer with comma separators (10,250)
 *   'auto'   — integer if whole number, else 2 decimal places
 *
 * All variants guard against NaN / Infinity and return "0" (or "0%", etc.) safely.
 */

/**
 * Trim trailing zeros from a fixed-decimal string.
 * e.g. "1.50" → "1.5", "2.00" → "2", "0.10" → "0.1"
 * Preserves at least one decimal place when non-zero decimals remain.
 * @param {string} s
 * @returns {string}
 */
function _trimTrailing(s) {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

/**
 * Format a numeric stat for display.
 *
 * @param {number} value  — The raw numeric value to format.
 * @param {'int'|'pct'|'mult'|'damage'|'time'|'gold'|'auto'} [kind='auto']
 * @returns {string}
 */
export function formatStat(value, kind = 'auto') {
  const v = Number(value);
  if (!isFinite(v)) return kind === 'pct' ? '0%' : kind === 'mult' ? '0x' : '0';

  switch (kind) {
    case 'int':
    case 'damage':
      return String(Math.floor(v));

    case 'pct': {
      // Show up to 2 decimal places; strip trailing zeros.
      const s = _trimTrailing(v.toFixed(2));
      return s + '%';
    }

    case 'mult': {
      const s = _trimTrailing(v.toFixed(2));
      return s + 'x';
    }

    case 'time': {
      const secs = Math.floor(Math.abs(v));
      if (secs < 60) return String(secs) + 's';
      const m = Math.floor(secs / 60);
      const s2 = secs % 60;
      return `${m}m ${String(s2).padStart(2, '0')}s`;
    }

    case 'gold':
      return Math.floor(v).toLocaleString('en-US');

    case 'auto':
    default: {
      // Integer if whole, else 2 decimal places trimmed.
      if (Number.isInteger(v)) return String(v);
      return _trimTrailing(v.toFixed(2));
    }
  }
}

/**
 * Convenience: format a percentage stat that is stored as a 0–1 fraction.
 * Multiplies by 100 before calling formatStat('pct').
 * e.g. formatPct(0.1315) → "13.15%"
 *
 * @param {number} fraction  — value in [0,1] range
 * @returns {string}
 */
export function formatPct(fraction) {
  return formatStat(Number(fraction) * 100, 'pct');
}

/**
 * Format gold (alias for formatStat(value, 'gold')).
 * @param {number} value
 * @returns {string}
 */
export function formatGold(value) {
  return formatStat(value, 'gold');
}

/**
 * Format an integer stat — HP, MP, armor, raw damage, attributes.
 * @param {number} value
 * @returns {string}
 */
export function formatInt(value) {
  return formatStat(value, 'int');
}
