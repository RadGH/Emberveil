/**
 * combatTooltips.js — extracted from CombatScreen (structural refactor).
 *
 * Hover / tap-hold tooltip rendering for champion modifier badges and
 * unit status effects. Pure DOM: no CombatScreen state reads, no `this`.
 *
 * Seam: CombatScreen delegates the three public-facing methods by calling
 * showChampionHoverTip / hideChampionHoverTip / showSpriteHoverTip /
 * showChampionInfo from the corresponding _* wrapper stubs that remain in
 * the class for backward-compatibility (internal callers already use `this._*`).
 */
import { CHAMPION_MODIFIERS } from '../../../game/championModifiers.js';
import { STATUS_META } from '../../../game/statusEffects.js';

const TIP_ID = 'champ-hover-tip';

function _getOrCreateTip(zIndex = '300') {
  let tip = document.getElementById(TIP_ID);
  if (!tip) {
    tip = document.createElement('div');
    tip.id = TIP_ID;
    tip.className = 'champ-info-tip';
    tip.style.position = 'fixed';
    tip.style.zIndex = zIndex;
    tip.style.pointerEvents = 'none';
    document.body.appendChild(tip);
  }
  return tip;
}

function _clampAndPosition(tip, clientX, clientY) {
  let left = clientX + 16;
  let top  = clientY + 16;
  const tipRect = tip.getBoundingClientRect();
  const w = tipRect.width  || 240;
  const h = tipRect.height || 80;
  if (left + w > window.innerWidth  - 8) left = clientX - w - 16;
  if (top  + h > window.innerHeight - 8) top  = clientY - h - 16;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top  = `${Math.max(8, top)}px`;
  tip.style.display = 'block';
}

/** Show a hover tooltip for a champion unit (modifier badges only). */
export function showChampionHoverTip(champ, clientX, clientY) {
  if (!champ?.championMods?.length) return hideChampionHoverTip();
  const tip = _getOrCreateTip('300');
  const modLines = champ.championMods.map(id => {
    const m = CHAMPION_MODIFIERS[id];
    return m
      ? `<div class="champ-tip-mod"><span class="champ-tip-badge" style="background:${m.color}">${m.glyph}</span> <strong>${m.name}</strong> — ${m.desc}</div>`
      : '';
  }).join('');
  tip.innerHTML = `<div class="champ-tip-title">[Champion] ${champ.name}</div>${modLines}`;
  _clampAndPosition(tip, clientX, clientY);
}

/** Hide the shared hover tooltip. */
export function hideChampionHoverTip() {
  const tip = document.getElementById(TIP_ID);
  if (tip) tip.style.display = 'none';
}

/**
 * M477 — Unified hover tooltip: champion modifier badges + status effects.
 * Renders NOTHING if both lists are empty.
 */
export function showSpriteHoverTip(unit, clientX, clientY) {
  if (!unit) return hideChampionHoverTip();
  const statuses = Array.isArray(unit.statuses) ? unit.statuses.filter(s => s && s.type) : [];
  const mods = (unit.isChampion && Array.isArray(unit.championMods)) ? unit.championMods : [];
  if (statuses.length === 0 && mods.length === 0) return hideChampionHoverTip();

  const tip = _getOrCreateTip('1300');
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const titleClass = unit.isChampion ? 'champ-tip-title' : 'champ-tip-title champ-tip-title--plain';
  const titlePrefix = unit.isChampion ? '[Champion] ' : '';
  const modLines = mods.map(id => {
    const m = CHAMPION_MODIFIERS[id];
    return m
      ? `<div class="champ-tip-mod"><span class="champ-tip-badge" style="background:${m.color}">${m.glyph}</span> <strong>${esc(m.name)}</strong> — ${esc(m.desc)}</div>`
      : '';
  }).join('');
  const statusLines = statuses.map(s => {
    const meta = STATUS_META[s.type] || null;
    const name = esc(meta?.name || s.type);
    const dur = Number.isFinite(s.duration) ? s.duration : null;
    const pwr = Number.isFinite(s.power) && s.power > 0 ? s.power : null;
    const durTxt = dur != null ? ` <span class="champ-tip-dur">(${dur}t)</span>` : '';
    const pwrTxt = pwr != null ? ` <span class="champ-tip-pwr">[${pwr}]</span>` : '';
    return `<div class="champ-tip-status"><strong>${name}</strong>${durTxt}${pwrTxt}</div>`;
  }).join('');
  const statusBlock = statusLines ? `<div class="champ-tip-status-block">${statusLines}</div>` : '';
  tip.innerHTML = `<div class="${titleClass}">${titlePrefix}${esc(unit.name || '')}</div>${modLines}${statusBlock}`;
  _clampAndPosition(tip, clientX, clientY);
}

/**
 * M303 — Brief floating DOM tooltip for champion modifier badges.
 * Appended to document.body; auto-removed after 2.5 s.
 * `setTimeout` reference is passed in from the screen so it uses the
 * tracked _setTimeout wrapper (no memory leak on onExit).
 */
export function showChampionInfo(champ, canvasX, canvasY, canvas, setTimeoutFn) {
  if (!champ?.championMods?.length) return;
  const existing = document.querySelector('.champ-info-tip');
  if (existing) try { existing.remove(); } catch (_) {}

  const tip = document.createElement('div');
  tip.className = 'champ-info-tip';
  const modLines = champ.championMods.map(id => {
    const m = CHAMPION_MODIFIERS[id];
    return m
      ? `<div class="champ-tip-mod"><span class="champ-tip-badge" style="background:${m.color}">${m.glyph}</span> <strong>${m.name}</strong> — ${m.desc}</div>`
      : '';
  }).join('');
  tip.innerHTML = `<div class="champ-tip-title">[Champion] ${champ.name}</div>${modLines}`;

  const rect = canvas ? canvas.getBoundingClientRect() : null;
  if (rect) {
    const scaleX = rect.width / (canvas.width || 1);
    const scaleY = rect.height / (canvas.height || 1);
    let left = rect.left + canvasX * scaleX;
    let top  = rect.top  + canvasY * scaleY - 90;
    left = Math.max(8, Math.min(window.innerWidth  - 200, left - 80));
    top  = Math.max(8, Math.min(window.innerHeight - 120, top));
    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;
  } else {
    tip.style.left = '50%';
    tip.style.top  = '40%';
    tip.style.transform = 'translateX(-50%)';
  }
  document.body.appendChild(tip);
  setTimeoutFn(() => tip.remove(), 2500);
}
