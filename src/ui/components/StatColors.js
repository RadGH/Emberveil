// src/ui/components/StatColors.js
//
// M85 — Stats UX helper. Shared by every screen that renders character stats
// (CharacterBuilder, Inventory, SkillTree "Attributes" tab, Party, etc.).
//
// Responsibilities:
//   1. BETTER_WHEN map — declares whether a stat improves when it goes UP
//      (default) or when it goes DOWN (e.g. cooldowns, health drain).
//   2. statColor(value, base, key) — returns a CSS color string:
//        - '' (empty) when value == base  → use default text color
//        - '#6db3ff' blue when value is BETTER than base
//        - '#e07070' red  when value is WORSE  than base
//      The "better" direction is resolved via BETTER_WHEN[key].
//   3. Stat-label tooltip definitions used by the delegated hover/tap handler
//      installed via `attachStatTooltips(rootEl)`.
//
// Tooltip UX:
//   - Desktop: hover a `.stat-label` → tooltip. Hold ALT → sticky (`.sticky`).
//   - Mobile: first tap on a `.stat-label` shows the tooltip; second tap on
//     the same label emits `rsg-stat-jump` on the root with
//     `{ detail: { stat } }` so the Codex (built by a parallel agent) can
//     pick it up once wired.
//   - Tap-outside dismisses.
//
// Combat-log mitigation spans use the same tooltip framework via
// `attachMitTooltips(rootEl)` — hover/tap on `.log-mit` spans explains
// deflected / resisted / blocked and emits `rsg-stat-jump` with
// `{ detail: { topic: 'armor'|'resist'|'block' } }` on second tap.
//
// Events emitted (document them wherever consumed):
//   - 'rsg-stat-jump' (bubbles) — detail: { stat? , topic? }
//
// localStorage key for BASE toggle: `game13_stats_base_mode` ('1' | '0').

export const BETTER_WHEN = {
  hp: 'higher', mp: 'higher',
  str: 'higher', dex: 'higher', int: 'higher', con: 'higher',
  dmg: 'higher', attackPower: 'higher', spellPower: 'higher',
  armor: 'higher', magicResist: 'higher',
  hit: 'higher', dodge: 'higher', initiative: 'higher',
  blockChance: 'higher', blockPower: 'higher',
  goldFind: 'higher', xpFind: 'higher', tradePrices: 'higher',
  healthDrain: 'lower', cooldown: 'lower',
  // M116: crit affixes — higher is better.
  critchance: 'higher', critdamage: 'higher',
  critChance: 'higher', critDamage: 'higher',
};

export const COLOR_BETTER = '#6db3ff';
export const COLOR_WORSE = '#e07070';

/**
 * Return a hex color string (or '' for plain text) for a displayed stat.
 * @param {number} value  - the value being shown (may include bonuses)
 * @param {number} base   - the raw/base value for comparison
 * @param {string} key    - stat key used to look up BETTER_WHEN
 */
export function statColor(value, base, key) {
  const v = Number(value), b = Number(base);
  if (!Number.isFinite(v) || !Number.isFinite(b) || v === b) return '';
  const dir = BETTER_WHEN[(key || '').toLowerCase()] || 'higher';
  const better = dir === 'higher' ? v > b : v < b;
  return better ? COLOR_BETTER : COLOR_WORSE;
}

export const STAT_DEFS = {
  STR: 'Strength — drives melee/physical damage and physical armor.',
  DEX: 'Dexterity — raises hit chance, dodge, and initiative.',
  INT: 'Intelligence — drives spell power, max mana, and magic resist.',
  CON: 'Constitution — raises max HP and resistance to status effects.',
  HP:  'Hit Points — current / maximum health. Higher CON raises max HP.',
  MP:  'Mana Points — resource pool for spells. Raised by INT.',
  Hit: 'Hit chance (%) — base 70 + DEX × 1.2, capped at 95.',
  Dodge: 'Dodge (%) — base 5 + DEX × 0.8, capped at 40 for heroes.',
  Armor: 'Armor — curve-based damage reduction against physical hits. DR = armor / (armor + 100), capped at 95%. Armor penetration subtracts before the curve.',
  'Damage Reduction': 'Damage Reduction — percent of incoming physical damage absorbed before HP is touched. Combines Armor (curve DR) with misc % reduction from passives (e.g. Resistance). Formula: 1 − (1 − armorDR) × (1 − miscDR).',
  Mana: 'Mana Points — resource pool for spells. Raised by INT.',
  'Attack Power': 'Bonus damage added to STR-based melee skills.',
  'Heavy Damage': 'Physical damage range from STR-based (heavy) weapons.',
  'Light Damage': 'Physical damage range from DEX-based (light) weapons.',
  'Magic Damage': 'Magic damage range from INT-based weapons.',
  'Magic Resist': 'Magic Resist -- flat reduction against incoming magic damage.',
  'Spell Power': 'Spell damage/heal multiplier. Formula: base × (1 + 0.025×INT + 0.05×Potency_affix). Shown as a +% bonus — at 12 INT that is +30% to spell damage and heals.',
  Melee: 'Base melee damage from STR.',
  'Damage Heavy': 'Heavy damage — weapon scaling. Applies to swords, axes, hammers, greatswords, polearms.',
  'Damage Light': 'Light damage — weapon scaling. Applies to daggers, rapiers, bows, spears, javelins, crossbows.',
  Spell: 'Spell-power multiplier from INT.',
  'STR/DEX/INT/CON': 'Primary attributes — hover any individually for details.',
  // M134 — normalize tooltips for affix-driven stats.
  'Life Steal':   'Life Steal — heal for N% of physical damage you deal on each hit. Formula: heal = floor(damage × lifeSteal% / 100). Stacks additively across items.',
  'Mana Steal':   'Mana Steal — restore N% of physical damage as mana on each hit. Formula: mana = floor(damage × manaSteal% / 100).',
  'Crit Chance':  'Crit Chance — chance (%) any attack crits. Base 5% + affixes. Crits deal +Crit Damage%.',
  'Crit Damage':  'Crit Damage — bonus (%) added to crit hits. Formula: critHit = damage × (1 + critDamage/100). Base +50%.',
  'Gold Find':    'Gold Find — multiplier on gold picked up. +10% means 110% of base. Stacks additively.',
  'XP Find':      'XP Find — multiplier on XP earned from fights and rewards. Stacks additively across gear.',
  'Mana Regen':   'Mana Regen — bonus mana restored each round of combat, in addition to passive regen from INT.',
  Initiative:     'Initiative — modifies turn order. Higher Initiative acts earlier. Ties broken by DEX.',
  'Trade Prices': 'Trade Prices — improves your buy/sell ratio at vendors. +10% means 10% better prices (cheaper buys, better sells).',
  'Block Chance': 'Block Chance — chance your shield absorbs incoming physical damage up to Block Power. Only with shield equipped.',
  'Block Power':  'Block Power — max damage absorbed by a successful block. Paired with Block Chance.',
  // M228: tooltips for Other-Effects rows that previously had none.
  'HP Bonus':     'HP Bonus — flat max HP granted by equipment / passives, added on top of CON-derived base HP.',
  'Mana Bonus':   'Mana Bonus — flat max mana granted by equipment / passives, added on top of INT-derived base mana.',
  'Dodge Bonus':  'Dodge Bonus — flat dodge chance (%) granted by equipment / passives, added to the DEX-derived base dodge.',
  'Hit Bonus':    'Hit Bonus — flat hit chance (%) granted by equipment / passives, added to the DEX-derived base hit.',
  'Armor Bonus':  'Armor Bonus — flat armor granted by equipment affixes / passives, added to worn-armor total.',
  'Initiative Bonus': 'Initiative Bonus — flat initiative granted by equipment / passives. Higher Initiative acts earlier.',
  'Flat Damage':  'Flat Damage — flat damage added on top of weapon damage, before crit multipliers.',
};

const MIT_DEFS = {
  armor:  'Armor deflected a percentage of incoming physical damage via the DR curve (armor/(armor+100), capped 95%). Reduce a foe\'s armor with penetration.',
  resist: 'Magic Resist absorbed incoming magic damage. Spell penetration ignores resist.',
  block:  'Your shield absorbed up to its Block Power. Higher Block Chance triggers this more often.',
};

// ---------------------------------------------------------------------------
// Tooltip DOM (shared singleton per document)
// ---------------------------------------------------------------------------

let _tooltipEl = null;
let _stickyAlt = false;
let _armedTarget = null; // mobile "first-tap" tracker

const _TOOLTIP_CSS = `
.rsg-stat-tooltip{position:fixed;z-index:3000;max-width:min(420px,calc(100vw - 16px));padding:0.55rem 0.75rem;background:#140a18;border:1px solid #e8a020;border-radius:6px;color:#f0e8d8;font-family:'Inter',sans-serif;font-size:0.78rem;line-height:1.35;box-shadow:0 6px 18px rgba(0,0,0,0.6),0 0 0 1px rgba(232,160,32,0.25);pointer-events:none;box-sizing:border-box;}
.rsg-stat-tooltip.sticky{pointer-events:auto;border-color:#ffd060;box-shadow:0 6px 18px rgba(0,0,0,0.75),0 0 0 1px rgba(255,208,96,0.5);}
.rsg-stat-tooltip.touch-open{pointer-events:auto;padding-right:1.75rem;}
.rsg-stat-tooltip .rsg-tt-close{position:absolute;top:2px;right:4px;width:22px;height:22px;border:none;background:rgba(232,160,32,0.15);color:#f0e8d8;border-radius:4px;font-size:0.9rem;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;}
.rsg-stat-tooltip.touch-open .rsg-tt-close{display:inline-flex;}
.rsg-stat-tooltip .rsg-tt-close:hover{background:rgba(232,160,32,0.35);color:#fff;}
.stat-label{cursor:help;border-bottom:1px dotted rgba(232,160,32,0.45);}
.stat-label:hover{color:#ffd060;}
.log-mit{cursor:help;color:#ffd060;border-bottom:1px dotted rgba(255,208,96,0.45);}
.log-mit:hover{color:#fff0b0;}
.cbt-entry.has-breakdown{cursor:help;border-bottom:1px dotted rgba(240,232,216,0.3);}
.cbt-entry.has-breakdown:hover{border-bottom-color:rgba(240,232,216,0.7);}
.dmg-tt-row{display:flex;justify-content:space-between;gap:1.5rem;line-height:1.5;}
.dmg-tt-row.dmg-tt-final{border-top:1px solid rgba(240,232,216,0.25);margin-top:0.2rem;padding-top:0.2rem;font-weight:600;}
.stats-base-toggle{display:inline-flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:#c0b090;cursor:pointer;user-select:none;margin:0 0 0.35rem 0;}
.stats-base-toggle input{accent-color:#e8a020;margin:0;}
`;

function _injectCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('rsg-stat-tooltips-css')) return;
  const style = document.createElement('style');
  style.id = 'rsg-stat-tooltips-css';
  style.textContent = _TOOLTIP_CSS;
  document.head.appendChild(style);
}

function _ensureTooltip() {
  _injectCss();
  if (_tooltipEl && _tooltipEl.isConnected) return _tooltipEl;
  _tooltipEl = document.createElement('div');
  _tooltipEl.className = 'rsg-stat-tooltip';
  _tooltipEl.style.display = 'none';
  _tooltipEl.innerHTML = '<button type="button" class="rsg-tt-close" aria-label="Close">×</button><div class="rsg-tt-body"></div>';
  document.body.appendChild(_tooltipEl);
  _tooltipEl.querySelector('.rsg-tt-close').addEventListener('click', (e) => {
    e.stopPropagation();
    _hideTooltip();
  });
  // Global listeners installed once.
  if (!document._rsgStatTooltipBound) {
    document._rsgStatTooltipBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Alt' || e.altKey) {
        _stickyAlt = true;
        if (_tooltipEl) _tooltipEl.classList.add('sticky');
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') {
        _stickyAlt = false;
        if (_tooltipEl) _tooltipEl.classList.remove('sticky');
      }
    });
    document.addEventListener('click', (e) => {
      if (!_tooltipEl || _tooltipEl.style.display === 'none') return;
      const t = e.target;
      if (t && (t.closest?.('.stat-label') || t.closest?.('.log-mit') || t === _tooltipEl || _tooltipEl.contains(t))) return;
      _hideTooltip();
    }, true);
  }
  return _tooltipEl;
}

function _showTooltip(html, x, y, opts = {}) {
  const tt = _ensureTooltip();
  const body = tt.querySelector('.rsg-tt-body');
  if (body) body.innerHTML = html;
  tt.style.display = 'block';
  if (opts.touch) tt.classList.add('touch-open');
  else tt.classList.remove('touch-open');
  // Two-pass clamp to viewport using measured rect.
  const pad = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  // Initial provisional placement (below+right of cursor/anchor).
  tt.style.left = Math.max(pad, x + 12) + 'px';
  tt.style.top  = Math.max(pad, y + 12) + 'px';
  const r = tt.getBoundingClientRect();
  let left = r.left;
  let top = r.top;
  if (r.right > vw - pad) left = Math.max(pad, vw - r.width - pad);
  if (r.bottom > vh - pad) top = Math.max(pad, vh - r.height - pad);
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  tt.style.left = left + 'px';
  tt.style.top = top + 'px';
}

function _hideTooltip() {
  if (_tooltipEl) {
    _tooltipEl.style.display = 'none';
    _tooltipEl.classList.remove('touch-open');
  }
  _armedTarget = null;
}

// Heuristic: is the most recent interaction a touch/pen event?
let _lastPointerType = 'mouse';
if (typeof document !== 'undefined' && !document._rsgPointerTypeBound) {
  document._rsgPointerTypeBound = true;
  document.addEventListener('pointerdown', (e) => {
    _lastPointerType = e.pointerType || 'mouse';
  }, true);
}
function _isTouchEvent(e) {
  const pt = e?.pointerType || _lastPointerType;
  return pt === 'touch' || pt === 'pen';
}

/**
 * Install a delegated tooltip handler on `rootEl` for `.stat-label` elements.
 * Each stat label should carry `data-stat="STR"` (or similar). Second tap on
 * an already-armed label emits `rsg-stat-jump` with `{detail:{stat}}`.
 */
export function attachStatTooltips(rootEl) {
  if (!rootEl || rootEl._rsgStatTipBound) return;
  rootEl._rsgStatTipBound = true;
  _ensureTooltip();

  const getDef = (key) => STAT_DEFS[key] || STAT_DEFS[key?.toUpperCase?.()] || `${key}: no description yet.`;

  // Per-element pointer enter/leave to mimic item-tooltip singleton lifecycle.
  // Using pointerenter/pointerleave ensures the handlers fire exactly once per
  // .stat-label entry/exit — no cross-fire races between mouseover and mouseout
  // when the user hovers between adjacent stat labels.
  rootEl.addEventListener('pointerover', (e) => {
    const label = e.target?.closest?.('.stat-label');
    if (!label || !rootEl.contains(label)) return;
    if (_isTouchEvent(e)) return; // touch handled via click path
    const key = label.dataset.stat || label.textContent.trim();
    _showTooltip(getDef(key), e.clientX, e.clientY, { touch: false });
  });
  rootEl.addEventListener('pointerout', (e) => {
    const label = e.target?.closest?.('.stat-label');
    if (!label) return;
    if (_isTouchEvent(e)) return;
    // If moving into another stat-label inside rootEl, don't hide — pointerover
    // for the new label will overwrite contents.
    const related = e.relatedTarget?.closest?.('.stat-label');
    if (related && rootEl.contains(related)) return;
    if (!_stickyAlt) _hideTooltip();
  });
  rootEl.addEventListener('click', (e) => {
    const label = e.target?.closest?.('.stat-label');
    if (!label) return;
    const key = label.dataset.stat || label.textContent.trim();
    const touch = _isTouchEvent(e);
    if (_armedTarget === label) {
      // Second tap → jump.
      rootEl.dispatchEvent(new CustomEvent('rsg-stat-jump', { bubbles: true, detail: { stat: key } }));
      _hideTooltip();
      return;
    }
    _armedTarget = label;
    const r = label.getBoundingClientRect();
    _showTooltip(getDef(key), r.left, r.bottom, { touch });
    e.stopPropagation();
  });
}

/**
 * Install delegated tooltip handler for combat-log mitigation spans.
 * Spans look like `<span class="log-mit" data-mit="armor|resist|block">...</span>`.
 */
export function attachMitTooltips(rootEl) {
  if (!rootEl || rootEl._rsgMitTipBound) return;
  rootEl._rsgMitTipBound = true;
  _ensureTooltip();

  const getDef = (k) => MIT_DEFS[k] || '';

  rootEl.addEventListener('pointerover', (e) => {
    const span = e.target?.closest?.('.log-mit');
    if (!span || !rootEl.contains(span)) return;
    if (_isTouchEvent(e)) return;
    _showTooltip(getDef(span.dataset.mit), e.clientX, e.clientY, { touch: false });
  });
  rootEl.addEventListener('pointerout', (e) => {
    const span = e.target?.closest?.('.log-mit');
    if (!span) return;
    if (_isTouchEvent(e)) return;
    const related = e.relatedTarget?.closest?.('.log-mit');
    if (related && rootEl.contains(related)) return;
    if (!_stickyAlt) _hideTooltip();
  });
  rootEl.addEventListener('click', (e) => {
    const span = e.target?.closest?.('.log-mit');
    if (!span) return;
    const topic = span.dataset.mit;
    const touch = _isTouchEvent(e);
    if (_armedTarget === span) {
      rootEl.dispatchEvent(new CustomEvent('rsg-stat-jump', { bubbles: true, detail: { topic } }));
      _hideTooltip();
      return;
    }
    _armedTarget = span;
    const r = span.getBoundingClientRect();
    _showTooltip(getDef(topic), r.left, r.bottom, { touch });
    e.stopPropagation();
  });
}

/**
 * Wrap mitigation keywords (deflected / resisted / blocked / blocked N) inside
 * a combat-log string with `<span class="log-mit">` tags.
 * Safe on already-plain text; idempotent when called once per entry.
 */
export function wrapMitigationTags(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\bblocked(\s+\d+)?\b/g, (m) => `<span class="log-mit" data-mit="block">${m}</span>`)
    .replace(/\bdeflected\b/g, '<span class="log-mit" data-mit="armor">deflected</span>')
    .replace(/\bresisted\b/g, '<span class="log-mit" data-mit="resist">resisted</span>');
}

/**
 * Build tooltip HTML from a dmgBreakdown object.
 * Fields: { raw, afterBlock, blocked, armorReduction, resistReduction, resistType, final, type }
 */
export function buildDmgBreakdownHtml(bd) {
  if (!bd) return '';
  // M242: miss breakdown — attacker hit%, target dodge%, rolled %.
  if (bd.miss) {
    const rows = [];
    if (bd.hit != null)      rows.push(`<div class="dmg-tt-row"><span>Attacker Hit</span><span>${bd.hit}%</span></div>`);
    if (bd.dodge != null)    rows.push(`<div class="dmg-tt-row"><span>Target Dodge</span><span>${bd.dodge}%</span></div>`);
    if (bd.hitChance != null)rows.push(`<div class="dmg-tt-row"><span>Effective Hit%</span><span>${bd.hitChance}%</span></div>`);
    if (bd.roll != null)     rows.push(`<div class="dmg-tt-row"><span>Rolled</span><span style="color:#e07070">${bd.roll}</span></div>`);
    rows.push('<div class="dmg-tt-row dmg-tt-final"><span>Result</span><span style="color:#e07070">Miss</span></div>');
    return rows.join('');
  }
  const rows = [];
  rows.push(`<div class="dmg-tt-row"><span>Rolled</span><span>${bd.raw}</span></div>`);
  if (bd.blocked != null && bd.blocked > 0) {
    rows.push(`<div class="dmg-tt-row"><span>Blocked</span><span style="color:#80c0ff">-${bd.blocked}</span></div>`);
  }
  if (bd.armorReduction != null && bd.armorReduction > 0) {
    rows.push(`<div class="dmg-tt-row"><span>Armor</span><span style="color:#a0c8f0">-${bd.armorReduction}</span></div>`);
  }
  if (bd.resistReduction != null && bd.resistReduction > 0) {
    const label = bd.resistType ? `Resist (${bd.resistType})` : 'Resist';
    rows.push(`<div class="dmg-tt-row"><span>${label}</span><span style="color:#c080f0">-${bd.resistReduction}</span></div>`);
  }
  const actual = (bd.dealt != null) ? bd.dealt : bd.final;
  const finalColor = actual === 0 ? '#e07070' : '#f0e8d8';
  // Show "After Armor/Resist" subtotal if there's further reduction to explain.
  if (bd.dealt != null && bd.final != null && bd.dealt !== bd.final) {
    rows.push(`<div class="dmg-tt-row" style="opacity:0.75"><span>After Armor/Resist</span><span>${bd.final}</span></div>`);
  }
  if (bd.markedAmp != null && bd.markedAmp > 0) {
    rows.push(`<div class="dmg-tt-row"><span>Marked</span><span style="color:#f06080">+${bd.markedAmp}</span></div>`);
  }
  if (bd.dmgReductAbsorb != null && bd.dmgReductAbsorb > 0) {
    rows.push(`<div class="dmg-tt-row"><span>Damage Buff</span><span style="color:#a0c8f0">-${bd.dmgReductAbsorb}</span></div>`);
  }
  if (bd.barrierAbsorb != null && bd.barrierAbsorb > 0) {
    rows.push(`<div class="dmg-tt-row"><span>Barrier</span><span style="color:#80c0ff">-${bd.barrierAbsorb}</span></div>`);
  }
  if (bd.soulbindSplit != null && bd.soulbindSplit > 0) {
    rows.push(`<div class="dmg-tt-row"><span>Soulbind</span><span style="color:#c080f0">-${bd.soulbindSplit}</span></div>`);
  }
  rows.push(`<div class="dmg-tt-row dmg-tt-final"><span>Dealt</span><span style="color:${finalColor}">${actual}</span></div>`);
  // M256: overkill — excess damage beyond remaining HP. Shown as a row
  // after the Dealt total so reader sees the gap.
  if (bd.overkill != null && bd.overkill > 0) {
    rows.push(`<div class="dmg-tt-row"><span>Overkill</span><span style="color:#ff8060">+${bd.overkill}</span></div>`);
  }
  if (bd.lifeSteal != null && bd.lifeSteal > 0) {
    rows.push(`<div class="dmg-tt-row" style="opacity:0.8"><span>Life Steal</span><span style="color:#60c060">+${bd.lifeSteal}</span></div>`);
  }
  if (bd.manaSteal != null && bd.manaSteal > 0) {
    rows.push(`<div class="dmg-tt-row" style="opacity:0.8"><span>Mana Steal</span><span style="color:#6080ff">+${bd.manaSteal}</span></div>`);
  }
  return rows.join('');
}

/**
 * Install delegated tooltip handler for combat-log damage entries.
 * Entries that carry a breakdown have class `.has-breakdown` and
 * `data-breakdown` (JSON-encoded dmgBreakdown).
 */
export function attachDmgBreakdownTooltips(rootEl) {
  if (!rootEl || rootEl._rsgDmgBdBound) return;
  rootEl._rsgDmgBdBound = true;
  _ensureTooltip();

  rootEl.addEventListener('pointerover', (e) => {
    const el = e.target?.closest?.('.has-breakdown');
    if (!el || !rootEl.contains(el)) return;
    if (_isTouchEvent(e)) return;
    try {
      const bd = JSON.parse(el.dataset.breakdown);
      _showTooltip(buildDmgBreakdownHtml(bd), e.clientX, e.clientY, { touch: false });
    } catch { /* ignore bad JSON */ }
  });
  rootEl.addEventListener('pointerout', (e) => {
    const el = e.target?.closest?.('.has-breakdown');
    if (!el) return;
    if (_isTouchEvent(e)) return;
    const related = e.relatedTarget?.closest?.('.has-breakdown');
    if (related && rootEl.contains(related)) return;
    if (!_stickyAlt) _hideTooltip();
  });
  rootEl.addEventListener('click', (e) => {
    const el = e.target?.closest?.('.has-breakdown');
    if (!el) return;
    if (_armedTarget === el) { _hideTooltip(); return; }
    _armedTarget = el;
    const touch = _isTouchEvent(e);
    try {
      const bd = JSON.parse(el.dataset.breakdown);
      const r = el.getBoundingClientRect();
      _showTooltip(buildDmgBreakdownHtml(bd), r.left, r.bottom, { touch });
    } catch { /* ignore bad JSON */ }
    e.stopPropagation();
  });
}

// BASE-mode toggle — session-only. Reverts to "calculated" (off) on every page
// load so stale "Base" state can't confuse users who return later.
export const BASE_MODE_KEY = 'game13_stats_base_mode';
export function getBaseMode() {
  try { return sessionStorage.getItem(BASE_MODE_KEY) === '1'; } catch { return false; }
}
export function setBaseMode(on) {
  try { sessionStorage.setItem(BASE_MODE_KEY, on ? '1' : '0'); } catch {}
}
