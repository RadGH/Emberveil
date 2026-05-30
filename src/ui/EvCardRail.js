/**
 * EvCardRail — M389
 * Bottom-HUD per-character card row (skeleton: portrait + name + HP/MP bars +
 * status icons). No spell rail yet — that lands in M390.
 *
 * Gated behind gs.uiOverhaul. When mounted, hides the legacy `.hud-members`
 * row but leaves `.hud-right` controls (round indicator + speed + pause)
 * untouched so combat is fully usable.
 *
 * Lifecycle:
 *   const rail = new EvCardRail({ rootEl, hudEl, heroes, companions });
 *   rail.mount();
 *   rail.refresh();          // re-read hp/mp/statuses; cheap, idempotent.
 *   rail.setActiveActor(id); // gold pulse + data-state="active"
 *   rail.destroy();
 */

import { ensureEvSymbols, appendEvCorners } from './evSymbols.js';
import { isShowCompanionFramesEnabled } from './screens/SettingsScreen.js';
import { GameState } from '../game/gameState.js';
import { STATUS_META } from '../game/statusEffects.js';
import { createStatusParticleEl, hasStatusParticle } from './statusParticles.js';
import { getSpritePath } from '../game/spriteUtils.js';

const PORTRAIT_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

/**
 * M391 — party-UI portrait. Returns the south-facing portrait variant per the
 * user's request ("display character's portraits instead of east/south frame
 * — battle grid stays east-facing"). Falls back through key → appearance →
 * class → south then east; the <img> onerror handler in _buildCard chains a
 * second fallback to fallback_portrait.svg if the file is missing.
 */
function resolveCardPortrait(c) {
  // M463 — manifest-driven; falls back to legacy spritecook URL if the
  // manifest hasn't loaded or the entry is missing.
  // M482b — c.enemyId before c.id (enemy combatants get synthetic ids).
  const key = c?._spriteKey || c?.spriteKey || c?.appearance || c?.class || c?.templateId || c?.enemyId || c?.id;
  if (key) return getSpritePath(key, 'portrait');
  return `${PORTRAIT_BASE}images/sprites/fallback_portrait.svg`;
}
function resolveCardPortraitFallbacks(c) {
  const keys = [c?._spriteKey, c?.spriteKey, c?.appearance, c?.class, c?.templateId, c?.enemyId, c?.id]
    .filter(Boolean);
  // M463 — manifest-driven; getSpritePath() routes per-pose to openai_v2 or
  // spritecook based on the appearances-manifest. Fallback chain still
  // includes south/east when no portrait is registered.
  const out = [];
  for (const k of keys) out.push(getSpritePath(k, 'portrait'));
  for (const k of keys) out.push(getSpritePath(k, 'south'));
  for (const k of keys) out.push(getSpritePath(k, 'east'));
  out.push(`${PORTRAIT_BASE}images/sprites/fallback_portrait.svg`);
  return out;
}

function clampPct(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function escAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export class EvCardRail {
  /**
   * @param {{ rootEl: HTMLElement, hudEl: HTMLElement, heroes?: object[], companions?: object[] }} opts
   */
  constructor({ rootEl, hudEl, heroes = [], companions = [] }) {
    this._rootEl = rootEl;
    this._hudEl = hudEl;
    this._heroes = heroes;
    this._companions = companions;

    this._wrapEl = null;
    this._cardEls = new Map(); // id -> { wrap, hpFill, mpFill, hpLabel, mpLabel, statusRow }
    this._activeId = null;
    this._destroyed = false;
  }

  mount() {
    if (this._wrapEl) return;
    ensureEvSymbols();
    if (this._hudEl) {
      this._hudEl.classList.add('cbt-hud--ev-overlay');
      // M405 — tag the hud overlay with manual/auto so CSS can show/hide the
      // speed selector + step-turn button + spell rails appropriately.
      try {
        const gs = GameState.get();
        const manual = !!gs?.manualCombat;
        this._hudEl.classList.toggle('manual-combat-on', manual);
        this._hudEl.classList.toggle('auto-combat-on', !manual);
      } catch (_) {}
    }

    const wrap = document.createElement('section');
    wrap.className = 'ev-hud';
    wrap.id = 'ev-hud';
    wrap.setAttribute('aria-label', 'Combat HUD');

    const cardRow = document.createElement('div');
    cardRow.className = 'ev-hud__card-row';
    cardRow.id = 'ev-card-row';
    cardRow.setAttribute('role', 'list');

    for (const h of this._heroes) {
      const card = this._buildCard(h, /* isCompanion */ false);
      cardRow.appendChild(card.wrap);
      this._cardEls.set(h.id, card);
    }
    wrap.appendChild(cardRow);

    // M395 — mobile portrait strip (only visible <700px via CSS).
    const portraitStrip = document.createElement('div');
    portraitStrip.className = 'ev-mobile-portrait-strip';
    portraitStrip.setAttribute('role', 'tablist');
    portraitStrip.setAttribute('aria-label', 'Switch character');
    for (const h of this._heroes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ev-mobile-portrait-btn';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.dataset.charId = h.id;
      btn.setAttribute('aria-label', h.name || '');
      const img = document.createElement('img');
      img.className = 'ev-mobile-portrait-thumb';
      img.alt = '';
      img.width = 36;
      img.height = 36;
      img.src = resolveCardPortrait(h);
      img.addEventListener('error', () => {
        img.src = `${PORTRAIT_BASE}images/sprites/fallback_portrait.svg`;
      }, { once: true });
      const hpStrip = document.createElement('div');
      hpStrip.className = 'ev-mobile-hp-strip';
      const hpFillM = document.createElement('div');
      hpFillM.className = 'ev-mobile-hp-fill';
      hpFillM.style.width = `${clampPct((h.hp / Math.max(1, h.maxHp)) * 100)}%`;
      hpStrip.appendChild(hpFillM);
      // M494 — mana bar under the HP bar on the mobile portrait strip.
      // Only rendered for heroes that actually use mana (maxMp > 0) so
      // martial classes don't get an empty rail.
      let mpFillM = null;
      const _maxMp = h.maxMp || h.maxMP || 0;
      if (_maxMp > 0) {
        const mpStrip = document.createElement('div');
        mpStrip.className = 'ev-mobile-mp-strip';
        mpFillM = document.createElement('div');
        mpFillM.className = 'ev-mobile-mp-fill';
        const _mp = h.mp ?? h.MP ?? 0;
        mpFillM.style.width = `${clampPct((_mp / Math.max(1, _maxMp)) * 100)}%`;
        mpStrip.appendChild(mpFillM);
        btn.appendChild(img);
        btn.appendChild(hpStrip);
        btn.appendChild(mpStrip);
      } else {
        btn.appendChild(img);
        btn.appendChild(hpStrip);
      }
      portraitStrip.appendChild(btn);
      const card = this._cardEls.get(h.id);
      if (card) { card.mobileBtn = btn; card.mobileHpFill = hpFillM; card.mobileMpFill = mpFillM; }
    }
    portraitStrip.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.ev-mobile-portrait-btn');
      if (!btn) return;
      const cid = btn.dataset?.charId;
      // Disallow switching off the active actor while awaiting input.
      if (this._lockMobileSelection && cid !== this._mobileSelectedId) return;
      this.setMobileSelected(cid);
    });
    wrap.appendChild(portraitStrip);
    this._mobileStripEl = portraitStrip;
    // Default-select first live hero.
    const firstLive = this._heroes.find(h => h.alive && h.hp > 0) || this._heroes[0];
    this._mobileSelectedId = firstLive?.id || null;
    this._lockMobileSelection = false;
    this._applyMobileSelection();

    // M393 — toggle companion-row hide via .ev-hud--no-companions class.
    if (!isShowCompanionFramesEnabled()) {
      wrap.classList.add('ev-hud--no-companions');
    }
    // M405 — auto-combat hides spell rails; battlefield/captions :has() rules
    // adjust their bottom anchor accordingly.
    try {
      const gs = GameState.get();
      if (!gs?.manualCombat) wrap.classList.add('ev-hud--auto-combat');
      else wrap.classList.add('ev-hud--manual-combat');
    } catch (_) {}
    if (this._companions.length) {
      const compRow = document.createElement('div');
      compRow.className = 'ev-companion-row';
      compRow.id = 'ev-companion-row';
      compRow.setAttribute('role', 'list');
      compRow.setAttribute('aria-label', 'Companions');
      for (const c of this._companions) {
        const card = this._buildCard(c, /* isCompanion */ true);
        compRow.appendChild(card.wrap);
        this._cardEls.set(c.id, card);
      }
      wrap.appendChild(compRow);
    }

    // M394 — spell tooltip card. Hover/focus/touch a .spell-icon to fill it.
    // M477 — portal to document.body so the tooltip escapes the .ev-hud
    // stacking context (.ev-hud is position:absolute z-index:4 which traps
    // child z-index even at 1200, leaving the tip behind .cbt-captions).
    const tip = document.createElement('aside');
    tip.className = 'ev-tooltip-card ev-panel ev-panel--tooltip';
    tip.id = 'ev-tooltip-card';
    tip.setAttribute('aria-live', 'polite');
    tip.setAttribute('aria-atomic', 'true');
    tip.hidden = true;
    appendEvCorners(tip, 'flourish');
    const tipBody = document.createElement('div');
    tipBody.className = 'ev-tooltip-card__body';
    tip.appendChild(tipBody);
    document.body.appendChild(tip);

    this._rootEl.appendChild(wrap);
    this._wrapEl = wrap;
    this._tooltipEl = tip;
    this._tooltipBody = tipBody;

    this._wireTooltip();

    // M477 — close tooltip on viewport changes so it never floats stale.
    this._tooltipViewportHandler = () => { this.hideTooltip(); };
    try {
      window.addEventListener('scroll', this._tooltipViewportHandler, true);
      window.addEventListener('resize', this._tooltipViewportHandler);
      window.addEventListener('orientationchange', this._tooltipViewportHandler);
    } catch (_) { /* SSR/test guard */ }

    this.refresh();
  }

  /**
   * M394 — wire hover/focus/touch handlers for the spell tooltip.
   * Lookup is delegated to the host (CombatScreen) via setTooltipResolver.
   */
  _wireTooltip() {
    if (!this._wrapEl) return;
    const showFor = (btn) => {
      if (!btn || !this._tooltipEl) return;
      const skillId = btn.dataset?.skill;
      if (!skillId) return;
      const charCard = btn.closest('.ev-char-card, .ev-companion-card');
      const charId = charCard?.dataset?.charId;
      const lookup = this._tooltipResolver;
      // M402 — even disabled icons get a tooltip; the resolver appends
      // disabled-reason lines based on the spell-icon state classes.
      const disabledReasons = [];
      if (btn.classList.contains('spell-icon--on-cooldown')) disabledReasons.push(`On cooldown${btn.dataset?.cd ? ` (${btn.dataset.cd} turn${btn.dataset.cd === '1' ? '' : 's'})` : ''}`);
      if (btn.classList.contains('spell-icon--no-mana')) disabledReasons.push('Not enough mana');
      if (btn.classList.contains('spell-icon--silenced')) disabledReasons.push('Silenced');
      if (btn.classList.contains('spell-icon--not-my-turn')) disabledReasons.push('Not this hero\'s turn');
      // use_item with belt empty → spell-icon--disabled
      if (btn.classList.contains('spell-icon--disabled') && skillId === 'use_item') disabledReasons.push('No items in belt');
      else if (btn.classList.contains('spell-icon--disabled')) disabledReasons.push('Unavailable');
      let html = lookup ? lookup({ skillId, characterId: charId }) : null;
      if (!html) { this.hideTooltip(); return; }
      if (disabledReasons.length) {
        html += `<div class="tt-disabled" style="margin-top:4px;color:#e08070;font-size:0.7rem;line-height:1.4">${disabledReasons.map(r => `<div>${r.replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))}</div>`).join('')}</div>`;
      }
      this._tooltipBody.innerHTML = html;
      this._tooltipEl.hidden = false;
      this._positionTooltip(btn);
      // M402 — paint a red mana-cost indicator on the actor's MP bar.
      this._showManaIndicator(btn, charId);
    };
    const hide = () => { this.hideTooltip(); this._hideManaIndicator(); };
    const showStatusFor = (el) => {
      if (!el || !this._tooltipEl) return;
      const t = el.dataset?.status || '';
      const dur = el.dataset?.dur || '';
      const meta = STATUS_META[t];
      const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
      const name = meta?.name || t || 'Status';
      const plain = meta?.plain || 'Active status effect.';
      const durLine = dur ? `<div class="tt-dur" style="margin-top:2px;color:#bfb398;font-size:0.7rem">Lasts ${esc(dur)} more turn${dur === '1' ? '' : 's'}</div>` : '';
      this._tooltipBody.innerHTML = `<div class="tt-title" style="font-weight:600;margin-bottom:2px">${esc(name)}</div><div class="tt-body" style="font-size:0.78rem;line-height:1.35">${esc(plain)}</div>${durLine}`;
      this._tooltipEl.hidden = false;
      this._positionTooltip(el);
    };
    this._wrapEl.addEventListener('mouseover', (e) => {
      const btn = e.target?.closest?.('.spell-icon');
      if (btn) { showFor(btn); return; }
      const stat = e.target?.closest?.('.ev-status-icon');
      if (stat) showStatusFor(stat);
    });
    this._wrapEl.addEventListener('mouseout', (e) => {
      if (e.target?.closest?.('.spell-icon') || e.target?.closest?.('.ev-status-icon')) hide();
    });
    this._wrapEl.addEventListener('focusin', (e) => {
      const btn = e.target?.closest?.('.spell-icon');
      if (btn) { showFor(btn); return; }
      const stat = e.target?.closest?.('.ev-status-icon');
      if (stat) showStatusFor(stat);
    });
    this._wrapEl.addEventListener('focusout', hide);
    this._wrapEl.addEventListener('touchstart', (e) => {
      const btn = e.target?.closest?.('.spell-icon');
      if (btn) { showFor(btn); return; }
      const stat = e.target?.closest?.('.ev-status-icon');
      if (stat) showStatusFor(stat);
    }, { passive: true });
  }

  /**
   * M402 — anchor the tooltip card directly above the hovered spell-icon
   * using viewport-fixed coords. Falls back to the icon's left edge if the
   * computed center would push the tooltip off-screen.
   */
  _positionTooltip(btn) {
    if (!this._tooltipEl || !btn) return;
    const r = btn.getBoundingClientRect();
    // Default: center horizontally over the icon, anchor above it.
    let cx = r.left + r.width / 2;
    let topY = r.top - 6;
    // Measure tooltip after it's visible.
    const tipR = this._tooltipEl.getBoundingClientRect();
    const halfW = tipR.width / 2;
    const margin = 6;
    if (cx - halfW < margin) cx = margin + halfW;
    if (cx + halfW > window.innerWidth - margin) cx = window.innerWidth - margin - halfW;
    // If too close to top of viewport, flip below.
    if (topY - tipR.height < margin) {
      topY = r.bottom + tipR.height + 6;
    }
    this._tooltipEl.style.left = `${Math.round(cx)}px`;
    this._tooltipEl.style.top = `${Math.round(topY)}px`;
  }

  /**
   * M402 — overlay a red segment on the active hero's MP bar showing the
   * portion of mana the hovered spell would consume. Cleaned up by
   * _hideManaIndicator on mouseout.
   */
  _showManaIndicator(btn, charId) {
    this._hideManaIndicator();
    if (!btn || !charId) return;
    const skillId = btn.dataset?.skill;
    // Only spells consume MP; skip basic_attack, use_item, skip_turn.
    if (!skillId || skillId === 'basic_attack' || skillId === 'use_item' || skillId === 'skip_turn') return;
    const card = this._cardEls.get(charId);
    if (!card?.mpFill) return;
    const actor = this._findCombatant(charId);
    if (!actor || !actor.maxMp) return;
    // Pull mp cost from the lookup function via a side-channel: read it
    // from the button's aria-label which is rendered as `${name} — N MP...`.
    const label = btn.getAttribute('aria-label') || '';
    const mpMatch = label.match(/(\d+)\s*MP/);
    const mpCost = mpMatch ? parseInt(mpMatch[1], 10) : 0;
    if (!mpCost) return;
    const track = card.mpFill.parentElement;
    if (!track) return;
    const curMp = actor.mp || 0;
    const maxMp = actor.maxMp;
    const startPct = Math.max(0, ((curMp - mpCost) / maxMp) * 100);
    const widthPct = Math.min(100 - startPct, (mpCost / maxMp) * 100);
    if (widthPct <= 0) return;
    const ind = document.createElement('div');
    ind.className = 'ev-mp-cost-indicator';
    ind.style.cssText = `position:absolute;top:0;bottom:0;left:${startPct}%;width:${widthPct}%;background:rgba(220,60,40,0.75);border-left:1px solid #ff6040;border-right:1px solid #ff6040;pointer-events:none;z-index:2;`;
    track.appendChild(ind);
    this._mpIndicatorEl = ind;
  }

  _hideManaIndicator() {
    if (this._mpIndicatorEl?.parentNode) this._mpIndicatorEl.parentNode.removeChild(this._mpIndicatorEl);
    this._mpIndicatorEl = null;
  }

  /**
   * Caller (CombatScreen) supplies a function that returns rendered HTML for
   * a given { skillId, characterId } or null to hide the card.
   */
  setTooltipResolver(fn) { this._tooltipResolver = fn; }

  hideTooltip() {
    if (this._tooltipEl) this._tooltipEl.hidden = true;
    this._hideManaIndicator?.();
  }

  setCombatants({ heroes, companions }) {
    if (heroes !== undefined) this._heroes = heroes;
    if (companions !== undefined) this._companions = companions;
  }

  /**
   * M395 — set the visible card on mobile and the active aria-selected state
   * on the portrait strip. Caller may force lock during AWAITING-INPUT.
   */
  setMobileSelected(id) {
    if (!id || !this._cardEls.has(id)) return;
    this._mobileSelectedId = id;
    this._applyMobileSelection();
  }

  _applyMobileSelection() {
    for (const [cid, card] of this._cardEls.entries()) {
      const sel = cid === this._mobileSelectedId;
      card.wrap.classList.toggle('ev-char-card--mobile-selected', sel);
      if (card.mobileBtn) {
        card.mobileBtn.setAttribute('aria-selected', sel ? 'true' : 'false');
        card.mobileBtn.classList.toggle('is-selected', sel);
      }
    }
  }

  setActiveActor(id) {
    this._activeId = id || null;
    // M395 — on mobile, force the selected card to the active actor and lock
    // strip-switching while awaiting input.
    if (id && this._cardEls.has(id)) {
      this._mobileSelectedId = id;
      this._lockMobileSelection = true;
      this._applyMobileSelection();
    } else {
      this._lockMobileSelection = false;
    }
    for (const [cid, card] of this._cardEls.entries()) {
      const live = this._findCombatant(cid);
      const isDead = !live || !live.alive || live.hp <= 0;
      const isActive = cid === this._activeId;
      const want = isDead ? 'dead' : (isActive ? 'active' : 'inactive');
      if (card.wrap.dataset.state !== want) card.wrap.dataset.state = want;
    }
    // Cool the spell rail on every non-active card; the active card gets its
    // hot state via setSpellRail when CombatScreen pauses for input.
    for (const [cid, card] of this._cardEls.entries()) {
      if (cid !== this._activeId) this._coolSpellRail(card);
    }
  }

  /**
   * Populate the spell rail for one hero. Called by CombatScreen when manual
   * mode pauses for that hero's input.
   *
   * @param {string} actorId
   * @param {{
   *   skills: Array<{id, name, mpCost, cooldown, type, aoe, damageType}>,
   *   weaponName?: string,
   *   weaponDamageType?: string,
   *   beltCount?: number,
   *   actor: object,
   *   skillCooldowns?: Record<string, number>,
   *   isHot: boolean,
   * }} opts
   */
  setSpellRail(actorId, opts = {}) {
    const card = this._cardEls.get(actorId);
    if (!card || !card.spellRail) return;
    const rail = card.spellRail;
    rail.innerHTML = '';

    const { skills = [], weaponName = 'Attack', weaponDamageType = 'physical',
            beltCount = 0, actor = null, skillCooldowns = {}, isHot = false } = opts;

    const stateFor = (button) => {
      if (!isHot) return 'not-my-turn';
      if (button.disabled) return 'disabled';
      return 'ready';
    };

    // Slot 0 — basic attack
    const attackBtn = this._mkSpellBtn({
      slotKey: '0',
      skillId: 'basic_attack',
      label: `Basic Attack (${weaponName})`,
      title: weaponName,
      glyph: '⚔',
      classMods: [`spell-icon--type-${weaponDamageType}`],
      disabled: !isHot,
    });
    rail.appendChild(attackBtn);
    attackBtn.classList.add(`spell-icon--${stateFor(attackBtn)}`);

    // Slots 1..N — skills
    skills.forEach((s, i) => {
      const cd = skillCooldowns?.[s.id] || 0;
      const mp = s.mpCost || 0;
      const insufficient = (actor?.mp || 0) < mp;
      const onCd = cd > 0;
      const btn = this._mkSpellBtn({
        slotKey: String(i + 1),
        skillId: s.id,
        label: `${s.name} — ${mp} MP${onCd ? ` (CD ${cd})` : ''}`,
        title: s.name,
        glyph: this._glyphForSkill(s),
        classMods: [`spell-icon--type-${s.type || 'magic'}`],
        disabled: !isHot || onCd || insufficient,
      });
      rail.appendChild(btn);
      let state = stateFor(btn);
      if (onCd)         state = 'on-cooldown';
      else if (insufficient) state = 'no-mana';
      btn.classList.add(`spell-icon--${state}`);
      if (onCd) btn.dataset.cd = String(cd);
    });

    // Slot N+1 — Use Item (free action)
    const itemBtn = this._mkSpellBtn({
      slotKey: 'item',
      skillId: 'use_item',
      label: `Use Item (${beltCount} remaining)`,
      title: 'Use Item (free action)',
      glyph: '⚱',
      classMods: ['ev-spell-icon--item'],
      disabled: !isHot || beltCount <= 0,
      countBadge: beltCount,
    });
    rail.appendChild(itemBtn);
    itemBtn.classList.add(`spell-icon--${beltCount <= 0 ? 'disabled' : (isHot ? 'enabled' : 'not-my-turn')}`);

    // Skip turn (always rightmost on desktop)
    const skipBtn = this._mkSpellBtn({
      slotKey: 'skip',
      skillId: 'skip_turn',
      label: 'End Turn',
      title: 'End Turn',
      glyph: '⏭',
      classMods: ['ev-skip-btn'],
      disabled: !isHot,
    });
    rail.appendChild(skipBtn);
    skipBtn.classList.add(`spell-icon--${isHot ? 'enabled' : 'not-my-turn'}`);
  }

  _coolSpellRail(card) {
    if (!card?.spellRail) return;
    for (const btn of card.spellRail.querySelectorAll('.spell-icon')) {
      btn.classList.remove('spell-icon--ready', 'spell-icon--enabled');
      btn.classList.add('spell-icon--not-my-turn');
      btn.disabled = true;
    }
  }

  _mkSpellBtn({ slotKey, skillId, label, title, glyph, classMods = [], disabled = false, countBadge = null }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = ['spell-icon', ...classMods].join(' ');
    btn.dataset.skill = skillId;
    btn.dataset.slot = slotKey;
    btn.setAttribute('aria-label', label);
    btn.title = title || label;
    btn.disabled = !!disabled;
    const glyphEl = document.createElement('span');
    glyphEl.className = 'spell-icon__glyph';
    glyphEl.textContent = glyph;
    glyphEl.setAttribute('aria-hidden', 'true');
    btn.appendChild(glyphEl);
    if (countBadge != null && countBadge > 0) {
      const badge = document.createElement('span');
      badge.className = 'ev-item-count';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = String(countBadge);
      btn.appendChild(badge);
    }
    return btn;
  }

  _glyphForSkill(s) {
    if (!s) return '✦';
    if (s.type === 'heal') return '✚';
    if (s.aoe === 'all' || s.aoe === 'row') return '✺';
    if (s.damageType === 'fire')      return '🜂';
    if (s.damageType === 'ice')       return '❄';
    if (s.damageType === 'lightning') return '⚡';
    if (s.damageType === 'holy')      return '☼';
    if (s.damageType === 'shadow')    return '☾';
    return '✦';
  }

  /**
   * Re-read live combatant state and patch HP/MP fills, labels, statuses.
   * Cheap; safe to call frequently.
   */
  refresh() {
    for (const [id, card] of this._cardEls.entries()) {
      const c = this._findCombatant(id);
      if (!c) continue;

      const hpPct = clampPct((c.hp / Math.max(1, c.maxHp)) * 100);
      if (card.hpFill) {
        const cur = parseFloat(card.hpFill.style.width);
        if (!Number.isFinite(cur) || Math.abs(cur - hpPct) > 0.5) {
          card.hpFill.style.width = `${hpPct}%`;
        }
        card.hpFill.classList.toggle('ev-bar--hp-low', hpPct < 30);
      }
      if (card.hpLabel) {
        const txt = `${Math.max(0, Math.floor(c.hp))}/${Math.floor(c.maxHp || 0)}`;
        if (card.hpLabel.textContent !== txt) card.hpLabel.textContent = txt;
      }

      if (card.mpFill && Number.isFinite(c.maxMp) && c.maxMp > 0) {
        const mpPct = clampPct((c.mp / c.maxMp) * 100);
        const cur = parseFloat(card.mpFill.style.width);
        if (!Number.isFinite(cur) || Math.abs(cur - mpPct) > 0.5) {
          card.mpFill.style.width = `${mpPct}%`;
        }
      }
      if (card.mpLabel) {
        const txt = `${Math.max(0, Math.floor(c.mp || 0))}/${Math.floor(c.maxMp || 0)}`;
        if (card.mpLabel.textContent !== txt) card.mpLabel.textContent = txt;
      }

      // Barrier overlay (phase 06 §2 — second blue fill on the HP track)
      if (card.shieldFill) {
        const bAmount = (c.statuses || []).reduce((sum, s) =>
          (s?.type === 'barrier' && s.power > 0) ? sum + s.power : sum, 0);
        const sPct = clampPct((bAmount / Math.max(1, c.maxHp)) * 100);
        const cur = parseFloat(card.shieldFill.style.width);
        if (!Number.isFinite(cur) || Math.abs(cur - sPct) > 0.5) {
          card.shieldFill.style.width = `${sPct}%`;
        }
      }

      // Card state
      const isDead = !c.alive || c.hp <= 0;
      const isActive = id === this._activeId;
      const want = isDead ? 'dead' : (isActive ? 'active' : 'inactive');
      if (card.wrap.dataset.state !== want) card.wrap.dataset.state = want;

      // Mobile HP indicator + dead-state on portrait button.
      if (card.mobileHpFill) {
        const cur = parseFloat(card.mobileHpFill.style.width);
        if (!Number.isFinite(cur) || Math.abs(cur - hpPct) > 0.5) {
          card.mobileHpFill.style.width = `${hpPct}%`;
        }
      }
      // M494 — live mana update on the mobile portrait strip.
      if (card.mobileMpFill && c.maxMp > 0) {
        const mpPctM = clampPct((c.mp / Math.max(1, c.maxMp)) * 100);
        const curMp = parseFloat(card.mobileMpFill.style.width);
        if (!Number.isFinite(curMp) || Math.abs(curMp - mpPctM) > 0.5) {
          card.mobileMpFill.style.width = `${mpPctM}%`;
        }
      }
      if (card.mobileBtn) {
        card.mobileBtn.classList.toggle('is-dead', isDead);
      }

      // Status row — cheap full-replace by joined key.
      if (card.statusRow) {
        const summary = (c.statuses || []).map(s =>
          `${s?.type || ''}:${s?.duration ?? ''}:${s?.power ?? ''}`).join(',');
        if (card.statusRow.dataset.summary !== summary) {
          card.statusRow.dataset.summary = summary;
          // M473 — before tearing down the status icons, hide any orphan
          // tooltip whose anchored icon lives in this row. Without this the
          // tooltip stays visible after a status expires because the icon
          // is removed from the DOM and never fires mouseleave.
          try {
            if (this._tooltipEl && !this._tooltipEl.hidden) {
              if (card.statusRow.querySelector('.ev-status-icon')) {
                this.hideTooltip();
              }
            }
          } catch (_) { /* defensive */ }
          // M405 — replace letter-circle badges with the same particle PNG/SVG
          // used by the floating battlefield aura. Falls back to a 2-letter
          // glyph when the type has no registered particle source.
          card.statusRow.innerHTML = '';
          for (const s of (c.statuses || [])) {
            const type = s?.type || '?';
            const dur = Number.isFinite(s?.duration) ? s.duration : '';
            const meta = STATUS_META[type] || null;
            const title = meta ? `${meta.name}${dur ? ` (${dur})` : ''}` : `${type}${dur ? ` (${dur})` : ''}`;
            let badge;
            if (hasStatusParticle(type)) {
              badge = document.createElement('span');
              badge.className = `ev-status-icon ev-status-icon--${type} ev-status-icon--img`;
              badge.dataset.status = type;
              badge.dataset.dur = String(dur);
              badge.tabIndex = 0;
              badge.title = title;
              badge.setAttribute('aria-label', title);
              const img = createStatusParticleEl(type, { width: 16, height: 16, alt: '' });
              if (img) badge.appendChild(img);
              if (dur !== '' && dur > 0) {
                const durEl = document.createElement('span');
                durEl.className = 'ev-status-icon__dur';
                durEl.textContent = String(dur);
                badge.appendChild(durEl);
              }
            } else {
              badge = document.createElement('span');
              badge.className = `ev-status-icon ev-status-icon--${type}`;
              badge.dataset.status = type;
              badge.dataset.dur = String(dur);
              badge.tabIndex = 0;
              badge.title = title;
              badge.setAttribute('aria-label', title);
              badge.textContent = String(type).slice(0, 2);
            }
            card.statusRow.appendChild(badge);
          }
        }
      }
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._hudEl) this._hudEl.classList.remove('cbt-hud--ev-overlay');
    if (this._wrapEl && this._wrapEl.parentNode) {
      this._wrapEl.parentNode.removeChild(this._wrapEl);
    }
    // M477 — tooltip lives on document.body now; tear it down explicitly.
    if (this._tooltipEl && this._tooltipEl.parentNode) {
      try { this._tooltipEl.parentNode.removeChild(this._tooltipEl); } catch (_) {}
    }
    if (this._tooltipViewportHandler) {
      try {
        window.removeEventListener('scroll', this._tooltipViewportHandler, true);
        window.removeEventListener('resize', this._tooltipViewportHandler);
        window.removeEventListener('orientationchange', this._tooltipViewportHandler);
      } catch (_) {}
      this._tooltipViewportHandler = null;
    }
    this._tooltipEl = null;
    this._tooltipBody = null;
    this._wrapEl = null;
    this._cardEls.clear();
    this._heroes = [];
    this._companions = [];
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _findCombatant(id) {
    return this._heroes.find(h => h?.id === id)
      || this._companions.find(c => c?.id === id)
      || null;
  }

  _buildCard(c, isCompanion) {
    const wrap = document.createElement('article');
    wrap.className = isCompanion ? 'ev-companion-card ev-panel ev-panel--companion'
                                 : 'ev-char-card ev-panel ev-panel--card';
    wrap.id = `ev-card-${c.id}`;
    wrap.dataset.charId = c.id;
    wrap.dataset.state = (!c.alive || c.hp <= 0) ? 'dead' : 'inactive';
    wrap.setAttribute('role', 'listitem');
    wrap.setAttribute('aria-label', c.name || '');

    const portrait = document.createElement('img');
    portrait.className = isCompanion ? 'ev-companion-card__portrait' : 'ev-card__portrait-img';
    portrait.alt = `${c.name || ''} portrait`;
    portrait.width = isCompanion ? 36 : 48;
    portrait.height = isCompanion ? 36 : 48;
    // M391 — chain through fallback portrait paths on 404 instead of jumping
    // straight to the SVG fallback. The chain prefers _south.png for party
    // cards (per spec: party UI shows portrait, not battle east-frame), then
    // _east.png, then the SVG.
    const portraitFallbacks = resolveCardPortraitFallbacks(c);
    let portraitFbIdx = 0;
    portrait.src = portraitFallbacks[0] || resolveCardPortrait(c);
    portrait.addEventListener('error', () => {
      portraitFbIdx++;
      const next = portraitFallbacks[portraitFbIdx];
      if (next) portrait.src = next;
    });

    const identity = document.createElement('div');
    identity.className = 'ev-card__identity';
    const nameEl = document.createElement('span');
    nameEl.className = 'ev-card__name';
    nameEl.textContent = c.name || '';
    identity.appendChild(nameEl);
    if (c.className) {
      const cls = document.createElement('span');
      cls.className = 'ev-card__class-label';
      // M412 — append the character's level after the class so the rail shows
      // "Warrior L7" instead of just "Warrior". Falls back to no level when
      // none is available (companions).
      const lvl = (c.level || c._effectiveLevel || 0);
      cls.textContent = lvl > 0 ? `${c.className} L${lvl}` : c.className;
      identity.appendChild(cls);
    }
    /* M393 — AI badge removed per user spec; companions are always AI in
       manual mode and the badge added clutter without conveying new info. */

    const header = document.createElement('header');
    header.className = isCompanion ? 'ev-companion-card__header' : 'ev-card__header';
    header.appendChild(portrait);
    header.appendChild(identity);

    // HP track + barrier overlay
    const hpTrack = document.createElement('div');
    hpTrack.className = 'ev-bar-track';
    hpTrack.setAttribute('role', 'progressbar');
    hpTrack.setAttribute('aria-valuenow', String(c.hp | 0));
    hpTrack.setAttribute('aria-valuemax', String(c.maxHp | 0));
    hpTrack.setAttribute('aria-label', 'HP');
    const hpFill = document.createElement('div');
    hpFill.className = 'ev-bar ev-bar--hp';
    hpFill.style.width = `${clampPct((c.hp / Math.max(1, c.maxHp)) * 100)}%`;
    const shieldFill = document.createElement('div');
    shieldFill.className = 'ev-bar ev-bar--shield';
    shieldFill.style.width = '0%';
    hpTrack.appendChild(hpFill);
    hpTrack.appendChild(shieldFill);

    const hpLabel = document.createElement('span');
    hpLabel.className = 'ev-bar-label ev-bar-label--hp';
    hpLabel.setAttribute('aria-hidden', 'true');
    hpLabel.textContent = `${Math.max(0, Math.floor(c.hp))}/${Math.floor(c.maxHp || 0)}`;

    const hpGroup = document.createElement('div');
    hpGroup.className = 'ev-bar-group ev-bar-group--hp';
    hpGroup.appendChild(hpTrack);
    hpGroup.appendChild(hpLabel);

    const bars = document.createElement('div');
    bars.className = 'ev-card__bars';
    bars.setAttribute('aria-label', 'Health and mana');
    bars.appendChild(hpGroup);

    let mpFill = null;
    let mpLabel = null;
    if (!isCompanion && Number.isFinite(c.maxMp) && c.maxMp > 0) {
      const mpTrack = document.createElement('div');
      mpTrack.className = 'ev-bar-track ev-bar-track--mp';
      mpTrack.setAttribute('role', 'progressbar');
      mpTrack.setAttribute('aria-valuenow', String(c.mp | 0));
      mpTrack.setAttribute('aria-valuemax', String(c.maxMp | 0));
      mpTrack.setAttribute('aria-label', 'MP');
      mpFill = document.createElement('div');
      mpFill.className = 'ev-bar ev-bar--mp';
      mpFill.style.width = `${clampPct((c.mp / c.maxMp) * 100)}%`;
      mpTrack.appendChild(mpFill);

      mpLabel = document.createElement('span');
      mpLabel.className = 'ev-bar-label ev-bar-label--mp';
      mpLabel.setAttribute('aria-hidden', 'true');
      mpLabel.textContent = `${Math.max(0, Math.floor(c.mp || 0))}/${Math.floor(c.maxMp || 0)}`;

      const mpGroup = document.createElement('div');
      mpGroup.className = 'ev-bar-group ev-bar-group--mp';
      mpGroup.appendChild(mpTrack);
      mpGroup.appendChild(mpLabel);
      bars.appendChild(mpGroup);
    }

    const statusRow = document.createElement('div');
    statusRow.className = 'ev-card__statuses';
    statusRow.setAttribute('aria-label', 'Status effects');

    // Spell rail placeholder — populated in M390.
    const spellRail = document.createElement('div');
    spellRail.className = 'ev-card__spell-rail';
    spellRail.id = `ev-rail-${c.id}`;
    spellRail.setAttribute('role', 'toolbar');
    spellRail.setAttribute('aria-label', `${c.name || ''} actions`);

    const body = document.createElement('div');
    body.className = 'ev-panel__body';
    body.appendChild(header);
    // M405 — statuses sit ABOVE HP/MP bars per user spec; keeps the icon row
    // visually associated with the character rather than buried below numbers.
    body.appendChild(statusRow);
    body.appendChild(bars);
    if (!isCompanion) body.appendChild(spellRail);

    wrap.appendChild(body);
    // M392 — corner ornaments. Cards use lozenge; companions use simple.
    appendEvCorners(wrap, isCompanion ? 'simple' : 'lozenge');

    return { wrap, hpFill, shieldFill, hpLabel, mpFill, mpLabel, statusRow, spellRail };
  }
}
