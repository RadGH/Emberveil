/**
 * EvTurnStrip — M388
 * Top-of-screen turn-order strip per Phase 06 §9.
 * Gated behind gs.uiOverhaul. Sibling of EvBattlefield inside the combat root.
 *
 * Lifecycle:
 *   const strip = new EvTurnStrip({ rootEl, allies, enemies });
 *   strip.mount();
 *   strip.setTurnOrder(turnOrder, turnIdx, round);
 *   strip.setActiveActor(actorId);
 *   strip.refreshHp();        // cheap re-fill of HP bars from live combatant refs
 *   strip.destroy();
 */

import { ensureEvSymbols, appendEvCorners } from './evSymbols.js';
import { getSpritePath } from '../game/spriteUtils.js';

const PORTRAIT_BASE = (typeof import.meta !== 'undefined' && __APP_BASE__) || '/';

function resolveChipPortraitFallbacks(c) {
  // M482b — include c.enemyId BEFORE c.id. Enemy combatants get a synthetic
  // c.id like "goblin_warrior_2_1" (group/slot suffix); the canonical key
  // is c.enemyId="goblin_warrior". Without this, every enemy chip 404'd
  // its portrait and fell through the entire fallback chain.
  const keys = [c?._spriteKey, c?.spriteKey, c?.appearance, c?.class, c?.templateId, c?.enemyId, c?.id]
    .filter(Boolean);
  // M463 — manifest-driven: getSpritePath() routes to openai_v2 or spritecook
  // per the appearances-manifest. Legacy spritecook URLs are still emitted as
  // a final fallback so onerror chain works even before the manifest loads.
  const out = [];
  for (const k of keys) out.push(getSpritePath(k, 'portrait'));
  for (const k of keys) out.push(getSpritePath(k, 'south'));
  for (const k of keys) out.push(getSpritePath(k, 'east'));
  out.push(`${PORTRAIT_BASE}images/sprites/fallback_portrait.svg`);
  return out;
}

function sideOf(c, allies) {
  if (!c) return 'enemy';
  if (c.isCompanion || c.class === 'companion') return 'companion';
  if (allies && allies.includes(c)) return 'hero';
  if (c.isHero) return 'hero';
  return 'enemy';
}

function clampPct(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export class EvTurnStrip {
  /**
   * @param {{ rootEl: HTMLElement, allies?: object[], enemies?: object[] }} opts
   */
  constructor({ rootEl, allies = [], enemies = [] }) {
    this._rootEl = rootEl;
    this._allies = allies;
    this._enemies = enemies;

    this._wrapEl = null;
    this._roundLabelEl = null;
    this._chipsEl = null;
    this._chipEls = new Map(); // combatantId -> { wrap, hpFill }
    this._activeId = null;
    this._turnOrder = [];
    this._round = 1;
    this._destroyed = false;
  }

  mount() {
    if (this._wrapEl) return;
    ensureEvSymbols();
    const wrap = document.createElement('nav');
    wrap.className = 'ev-turn-strip ev-panel ev-panel--mini';
    wrap.setAttribute('aria-label', 'Turn order');

    const roundLabel = document.createElement('span');
    roundLabel.className = 'ev-round-label';
    roundLabel.id = 'ev-round-label';
    roundLabel.textContent = 'Round 1';

    const chips = document.createElement('div');
    chips.className = 'ev-turn-strip__chips';
    chips.setAttribute('role', 'list');
    chips.setAttribute('aria-label', 'Initiative order');

    wrap.appendChild(roundLabel);
    wrap.appendChild(chips);

    // M392 — simple corner ornaments at strip scale.
    appendEvCorners(wrap, 'simple');

    // Mount as first child so it sits above ev-battlefield in source order;
    // its absolute positioning + z-index keeps it visually on top.
    this._rootEl.insertBefore(wrap, this._rootEl.firstChild);

    this._wrapEl = wrap;
    this._roundLabelEl = roundLabel;
    this._chipsEl = chips;
  }

  /**
   * Update both the underlying combatant arrays (so refreshHp can read live
   * stats) and rebuild the strip from a turn-order array.
   */
  setCombatants({ allies, enemies }) {
    if (allies !== undefined) this._allies = allies;
    if (enemies !== undefined) this._enemies = enemies;
  }

  /**
   * Rebuild chip DOM from the live turn-order array.
   * @param {object[]} turnOrder  combatant refs (same as CombatScreen._turnOrder)
   * @param {number} turnIdx      index of NEXT actor to act (CombatScreen advances after pop)
   * @param {number} round
   */
  setTurnOrder(turnOrder, turnIdx, round) {
    if (!this._chipsEl) return;
    this._turnOrder = Array.isArray(turnOrder) ? turnOrder.slice() : [];
    this._round = round || 1;
    if (this._roundLabelEl) this._roundLabelEl.textContent = `Round ${this._round}`;

    this._chipsEl.innerHTML = '';
    this._chipEls.clear();

    for (const c of this._turnOrder) {
      if (!c || !c.id) continue;
      const chip = this._buildChip(c);
      this._chipsEl.appendChild(chip.wrap);
      this._chipEls.set(c.id, chip);
    }

    // Default-active = next-to-act if nothing else specified.
    const nextActor = this._turnOrder[turnIdx] ?? this._turnOrder[Math.max(0, turnIdx - 1)];
    if (nextActor) this.setActiveActor(nextActor.id);
  }

  /**
   * Mark one chip as the active actor (gold pulse). Pass null to clear.
   */
  setActiveActor(id) {
    this._activeId = id || null;
    for (const [chipId, chip] of this._chipEls.entries()) {
      const isActive = chipId === this._activeId;
      const isDead = !this._isAlive(chipId);
      chip.wrap.dataset.state = isDead ? 'dead' : (isActive ? 'active' : 'inactive');
    }
  }

  /**
   * Re-read hp/alive from live combatant refs and update fills + dead state.
   * Cheap; safe to call on every _applyDamage.
   */
  refreshHp() {
    for (const [id, chip] of this._chipEls.entries()) {
      const c = this._findCombatant(id);
      if (!c) continue;
      const pct = clampPct((c.hp / Math.max(1, c.maxHp)) * 100);
      if (chip.hpFill) {
        const cur = parseFloat(chip.hpFill.style.width);
        if (!Number.isFinite(cur) || Math.abs(cur - pct) > 0.5) {
          chip.hpFill.style.width = `${pct}%`;
        }
      }
      const isDead = !c.alive || c.hp <= 0;
      const isActive = id === this._activeId;
      const want = isDead ? 'dead' : (isActive ? 'active' : 'inactive');
      if (chip.wrap.dataset.state !== want) chip.wrap.dataset.state = want;
      chip.wrap.setAttribute('aria-label',
        `${c.name || 'unknown'}, ${Math.max(0, c.hp | 0)} of ${Math.max(0, c.maxHp | 0)} HP`);
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._wrapEl && this._wrapEl.parentNode) {
      this._wrapEl.parentNode.removeChild(this._wrapEl);
    }
    this._wrapEl = null;
    this._roundLabelEl = null;
    this._chipsEl = null;
    this._chipEls.clear();
    this._turnOrder = [];
    this._allies = [];
    this._enemies = [];
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _isAlive(id) {
    const c = this._findCombatant(id);
    return !!(c && c.alive && c.hp > 0);
  }

  _findCombatant(id) {
    return this._turnOrder.find(c => c?.id === id)
      || this._allies.find(c => c?.id === id)
      || this._enemies.find(c => c?.id === id)
      || null;
  }

  _buildChip(c) {
    const wrap = document.createElement('div');
    wrap.className = 'ev-turn-chip';
    wrap.id = `ev-chip-${c.id}`;
    wrap.dataset.side = sideOf(c, this._allies);
    wrap.dataset.state = (!c.alive || c.hp <= 0) ? 'dead' : 'inactive';
    wrap.setAttribute('role', 'listitem');
    wrap.setAttribute('aria-label',
      `${c.name || 'unknown'}, ${Math.max(0, c.hp | 0)} of ${Math.max(0, c.maxHp | 0)} HP`);

    const portrait = document.createElement('img');
    portrait.className = 'ev-turn-chip__portrait';
    portrait.alt = '';
    portrait.setAttribute('aria-hidden', 'true');
    portrait.width = 32;
    portrait.height = 32;
    const portraitFallbacks = resolveChipPortraitFallbacks(c);
    let portraitFbIdx = 0;
    portrait.src = portraitFallbacks[0];
    portrait.addEventListener('error', () => {
      portraitFbIdx++;
      const next = portraitFallbacks[portraitFbIdx];
      if (next) portrait.src = next;
    });

    const hpBar = document.createElement('div');
    hpBar.className = 'ev-turn-chip__hp-bar';
    const hpFill = document.createElement('div');
    hpFill.className = 'ev-turn-chip__hp-fill';
    hpFill.style.width = `${clampPct((c.hp / Math.max(1, c.maxHp)) * 100)}%`;
    hpBar.appendChild(hpFill);

    wrap.appendChild(portrait);
    wrap.appendChild(hpBar);

    return { wrap, hpFill };
  }
}
