// DEPRECATED M294 — replaced by PartyPanelScreen (Inventory tab). Kept in repo for reference.
/**
 * InventoryScreen — full inventory management with drag-equip
 * Shows equipped items per character, item grid, tooltips with full stat breakdown
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { preserveScroll } from '../components/ScrollPreserve.js';
import { GameState } from '../../game/gameState.js';
import { getItemTooltip, getItemCompareTooltip, computeItemScores, RARITY_COLORS, generateItem } from '../../game/items.js';
import { CLASSES } from '../../game/classes.js';
import { statColor, attachStatTooltips, getBaseMode, setBaseMode } from '../components/StatColors.js';
import { getEquippedWeaponCategory } from '../../game/items.js';
import { computeHeroDamage, computeHeroEquipDmgBonus, computeHeroArmor, getEquipmentAffixBonuses, getCharacterBlockStats, computeDamageReduction } from '../../game/formulas.js';
import { recalcPassiveStats, computeMaxHp, computeMaxMp, getPassiveBonuses } from '../../game/passives.js';
import { portraitImg, classIconSvg } from '../../game/spriteUtils.js';
import { formatStat, formatPct } from '../../utils/numberFormat.js';
import { isHardDifficulty } from '../../game/autoBuild.js';
import { showConfirmModal } from '../components/ConfirmModal.js';

const EQUIP_SLOTS = ['weapon','offhand','head','chest','legs','hands','feet','ring1','ring2','necklace'];
const SLOT_LABELS = {
  weapon:'Weapon', offhand:'Off-hand', head:'Head', chest:'Chest',
  legs:'Legs', hands:'Hands', feet:'Feet', ring1:'Ring', ring2:'Ring', necklace:'Necklace',
};

/**
 * M312 #36 — sweep all inventory items for the given character and auto-equip
 * strict upgrades. Mirrors GameState.tryAutoEquip but runs for every item.
 * Called when the player enables autoEquip in the inventory UI.
 */
function _sweepAutoEquip(char, gs, audio) {
  const items = [...(gs.inventory || [])];
  let equipped = 0;
  for (const item of items) {
    if (gs.isManuallyUnequipped?.(item.id)) continue;
    // Temporarily set only this char's autoEquip; tryAutoEquip filters by flag.
    const wasOn = char.autoEquip;
    char.autoEquip = true;
    try {
      const res = gs.tryAutoEquip(item);
      if (res && res.member && res.member.id === char.id) equipped++;
    } catch (_) {}
    char.autoEquip = wasOn;
  }
  if (equipped > 0 && audio) {
    audio.playSfx('purchase');
  }
}

export class InventoryScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._selectedCharIdx = 0;
    // M293: per-character scroll position memory. Map<charIdx, scrollTop>.
    this._charScrollPos = new Map();
    this._tt = null;
    // U8 — Compare mode state. When non-null, the tooltip is rendered via
    // getItemCompareTooltip against the item the user is currently hovering.
    this._compareMode = false;
    this._compareSecondary = false; // alt+shift / "Compare 2nd" toggle for ring2/offhand
    this._currentTooltipItem = null;
    this._isTouch = (typeof window !== 'undefined') && (
      ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
    );
  }

  onEnter() { this._build(); }

  _build() {
    injectStyles('inv-styles', INV_STYLES);
    this._el = createEl('div', 'inv-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    preserveScroll(this._el, () => this._renderImpl());
  }

  _renderImpl() {
    const gs = GameState.get();
    const ctx = gs.inventoryContext || 'default';
    const showInactive = ctx === 'party-inactive';
    const inactive = (gs.bench || []);
    const chars = showInactive
      ? [...gs.party, ...gs.companions, ...inactive]
      : [...gs.party, ...gs.companions];
    if (gs.inventoryFocusId) {
      const idx = chars.findIndex(c => c.id === gs.inventoryFocusId);
      if (idx >= 0) this._selectedCharIdx = idx;
      gs.inventoryFocusId = null;
    }
    const char = chars[this._selectedCharIdx] || chars[0];
    if (this._selectedCharIdx >= chars.length) this._selectedCharIdx = 0;

    this._el.innerHTML = `
      <div class="inv-header">
        <div class="inv-char-tabs" id="char-tabs">
          ${chars.map((c, i) => {
            const isInactive = inactive.includes(c);
            return `
            <button type="button" class="char-tab${i === this._selectedCharIdx ? ' active' : ''}" data-idx="${i}" style="${isInactive ? 'opacity:0.55;border-style:dashed' : ''}">
              ${c.name}${isInactive ? ' <small>(inactive)</small>' : ''}<br><small>${c.className || c.class}</small>
            </button>`;
          }).join('')}
        </div>
        <button type="button" class="inv-close" id="inv-close">✕ Close</button>
      </div>
      <div class="inv-layout">
        <!-- Equipment slots (left) -->
        <div class="equip-panel">
          <div class="panel-label panel-label-row">
            <span>Inventory</span>
            ${char && !(char.isCompanion && char.class === 'companion') ? (() => {
              // M402 — manual combat hides the Auto toggle entirely (display:none
              // not enough — keep it out of the DOM so it doesn't tab-stop).
              if (GameState.get()?.manualCombat) return '';
              const hardLocked = isHardDifficulty();
              if (hardLocked) {
                // Manual Characters mode: hide the Auto button entirely.
                return '';
              }
              return `<button type="button" class="auto-toggle${char.autoEquip ? ' on' : ''}" id="inv-autoequip" aria-pressed="${char.autoEquip ? 'true' : 'false'}" title="When new items appear in your bag and they're an upgrade for this character, auto-equip them. Items you manually unequip are remembered and never auto-equipped.">
                ${char.autoEquip ? '<span class="auto-check" aria-hidden="true">✓</span>' : '<span class="auto-check auto-off" aria-hidden="true">○</span>'}Auto
              </button>`;
            })() : ''}
          </div>
          <div class="inv-char-header">
            ${char ? `<div class="inv-portrait-wrap">${portraitImg(char, 70, 'inv-portrait')}</div>` : ''}
            <div class="inv-char-identity">
              <div class="inv-char-name">${char?.name || 'No Character'} ${char ? classIconSvg(char, 14, 'inv-class-icon') : ''}</div>
            </div>
          </div>
          <div class="panel-label" style="margin-top:0.5rem">Equipped</div>
          <div class="equip-slots" id="equip-slots">
            ${(() => {
              const isNonEquippableCompanion = char?.isCompanion && char?.class === 'companion';
              const is2HEquipped = char?.equipment?.weapon?.twoHanded;
              return EQUIP_SLOTS.map(slot => {
                const item = char?.equipment?.[slot];
                const isDisabled = (slot === 'offhand' && is2HEquipped) || isNonEquippableCompanion;
                return `
                  <div class="equip-slot${item ? ' has-item' : ''}${isDisabled ? ' slot-disabled' : ''}${isNonEquippableCompanion ? ' slot-companion' : ''}" data-slot="${slot}">
                    <div class="es-label">${SLOT_LABELS[slot]}${isNonEquippableCompanion ? '<span class="es-companion-tag">[Companion]</span>' : ''}</div>
                    ${item ? (() => {
                      // M305: set items purple, unique items orange, else rarity color.
                      const eqColor = item.isUnique ? '#ff8020' : item.setId ? '#b060ff' : `var(--rarity-${item.rarity})`;
                      return `
                      <div class="es-item" data-itemid="${item.id}" data-slot="${slot}">
                        <div class="esi-name" style="color:${eqColor}">${item.name}</div>
                        <div class="esi-stat">${item.dmg ? `${item.dmg[0]}-${item.dmg[1]}` : item.armor ? `+${item.armor} arm` : ''}</div>
                      </div>`;
                    })() : `<div class="es-empty">— empty —</div>`}
                  </div>
                `;
              }).join('');
            })()}
          </div>
          <div class="char-stats-panel">
            <div class="panel-label">Character Stats</div>
            ${this._renderCharStats(char)}
          </div>
        </div>
        <!-- Inventory grid (right) -->
        <div class="inv-items-panel">
          <div class="panel-label">Inventory (${gs.inventory.length} items)</div>
          <div class="inv-grid" id="inv-grid">
            ${gs.inventory.length === 0
              ? '<div class="inv-empty">Your pack is empty. Visit the merchant or defeat enemies to find equipment.</div>'
              : gs.inventory.map(item => {
                const tier = this._upgradeTier(char, item);
                const slots = this._slotsForItem(char, item).join(' ');
                const tierAttr = tier ? ` data-upgrade-tier="${tier}"` : '';
                const tierClass = tier ? ` upgrade-${tier}` : '';
                // M305: set items use purple-gold, uniques use orange override.
                const itemColor = item.isUnique
                  ? '#ff8020'
                  : item.setId
                    ? '#b060ff'
                    : `var(--rarity-${item.rarity})`;
                const setTag = item.setId ? `<div class="iic-set-tag">Set</div>` : '';
                const uniqueTag = item.isUnique ? `<div class="iic-unique-tag">Unique</div>` : '';
                return `
                <div class="inv-item-card${tierClass}${item.isUnique ? ' iic-unique' : ''}${item.setId ? ' iic-set' : ''}" data-id="${item.id}" data-slots="${slots}"${tierAttr}>
                  <div class="iic-rarity-bar" style="background:${itemColor}"></div>
                  <div class="iic-name" style="color:${itemColor}">${item.name}</div>
                  ${setTag}${uniqueTag}
                  <div class="iic-type">${item.subtype || item.type}</div>
                  <div class="iic-stat">${item.dmg ? `Dmg ${item.dmg[0]}-${item.dmg[1]}` : item.armor ? `Arm +${item.armor}` : ''}</div>
                  <div class="iic-quality">${item.quality}</div>
                  <button type="button" class="iic-equip-btn" data-equip="${item.id}">Equip</button>
                </div>
              `; }).join('')
            }
          </div>
        </div>
      </div>
      <div id="inv-tt" class="inv-tooltip" style="display:none"><button class="inv-tt-close" aria-label="Close" type="button">×</button><div class="inv-tt-body"></div></div>
    `;

    this._wireEvents();
    attachStatTooltips(this._el);
    const baseBtn = this._el.querySelector('#stats-base-chk');
    if (baseBtn) baseBtn.addEventListener('click', () => {
      // Preserve the equip-panel scroll position across the re-render so the
      // toggle doesn't yank the user back to the top of the stats list.
      const panel = this._el?.querySelector('.equip-panel');
      const prevScroll = panel ? panel.scrollTop : 0;
      // M322: button-style toggle. Read current state from the class list
      // since this is no longer a checkbox.
      const next = !baseBtn.classList.contains('on');
      setBaseMode(next);
      this.audio.playSfx('click');
      this._render();
      const newPanel = this._el?.querySelector('.equip-panel');
      if (newPanel) newPanel.scrollTop = prevScroll;
    });
  }

  /**
   * U8 — return the equipment slot keys an item could go into for the given
   * character. Mirrors the equip logic in _wireEvents() but is data-only so
   * we can light up the corresponding slot rows on hover.
   */
  _slotsForItem(char, item) {
    if (!item || !char) return [];
    const slots = [];
    const isWeapon = item.type === 'weapon';
    if (isWeapon) {
      slots.push('weapon');
      const canOffhand = item.offHandOk || (!item.twoHanded);
      if (canOffhand && !item.twoHanded) slots.push('offhand');
      return slots;
    }
    if (item.subtype === 'ring' || item.slot === 'ring') return ['ring1', 'ring2'];
    if (item.slot) return [item.slot];
    if (item.subtype) return [item.subtype];
    return [];
  }

  /**
   * U8 — for the given inventory item against the selected character,
   * return an upgrade-tier string used to pick a CSS class:
   *   'empty'    — slot is empty, direct upgrade
   *   'minor'    — Δ ≤ 5%
   *   'medium'   — Δ ≤ 20%
   *   'major'    — Δ ≤ 50%
   *   'huge'     — Δ > 50% (rainbow shimmer)
   *   null       — not an upgrade / no candidate slot
   */
  _upgradeTier(char, item) {
    if (!char || !item) return null;
    if (char.isCompanion && char.class === 'companion') return null;
    const slots = this._slotsForItem(char, item);
    if (!slots.length) return null;
    const eqp = char.equipment || {};
    // Empty-slot direct upgrade has highest priority.
    for (const s of slots) {
      if (!eqp[s]) {
        // For weapons, "empty offhand" while a 2H is equipped is not really an
        // empty slot — disqualify.
        if (s === 'offhand' && eqp.weapon?.twoHanded) continue;
        return 'empty';
      }
    }
    // All target slots occupied — score-delta against the BEST candidate
    // (max delta across the slots; a ring goes ring1 OR ring2 and we want
    // the easier replacement).
    // M279: pass char so weapon offense weights against primary attribute.
    const itemScore = computeItemScores(item, char).total;
    let bestRel = -Infinity;
    for (const s of slots) {
      const cur = eqp[s];
      if (!cur) continue;
      const curScore = computeItemScores(cur, char).total;
      if (curScore <= 0) continue;
      const rel = (itemScore - curScore) / curScore;
      if (rel > bestRel) bestRel = rel;
    }
    if (bestRel <= 0 || bestRel === -Infinity) return null;
    if (bestRel <= 0.05) return 'minor';
    if (bestRel <= 0.20) return 'medium';
    if (bestRel <= 0.50) return 'major';
    return 'huge';
  }

  /**
   * U8 — find the equipped item we should compare against for a given
   * inventory item. Honors the compareSecondary flag to flip ring1↔ring2 and
   * weapon↔offhand for dual-wield daggers/wands.
   */
  _vsItemForCompare(char, item) {
    if (!char || !item) return null;
    const eqp = char.equipment || {};
    const slots = this._slotsForItem(char, item);
    if (!slots.length) return null;
    let primary = slots[0];
    let secondary = slots[1];
    // For rings prefer ring1 primary, ring2 secondary.
    if (slots.includes('ring1') && slots.includes('ring2')) {
      primary = 'ring1'; secondary = 'ring2';
    }
    const want = this._compareSecondary && secondary ? secondary : primary;
    return { vs: eqp[want] || null, slot: want, hasSecondary: !!secondary && secondary !== primary };
  }

  /**
   * Mobile compare modal — shown on viewports <=700px instead of the
   * side-by-side tooltip that doesn't fit. Displays candidate (top) and
   * equipped item (bottom) with stat-diff highlights from getItemCompareTooltip.
   */
  _openCompareModal(candidateItem, vsItem, opts = {}) {
    if (!candidateItem) return;
    const { hero = null, slotLabel = null, hasSecondary = false, inInv = false, onEquip } = opts;

    // Inject modal styles once.
    injectStyles('inv-cmp-modal-styles', `
      .inv-cmp-modal-backdrop {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.78);
        display: flex; align-items: center; justify-content: center;
        padding: 0;
      }
      .inv-cmp-modal {
        position: relative;
        width: 85vw; max-width: 420px;
        max-height: 88vh;
        background: #110a08;
        border: 2px solid rgba(232,160,32,0.55);
        border-radius: 10px;
        box-shadow: 0 8px 48px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(232,160,32,0.08);
        display: flex; flex-direction: column;
        overflow: hidden;
      }
      .inv-cmp-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.65rem 0.9rem 0.55rem;
        border-bottom: 1px solid rgba(232,160,32,0.18);
        flex-shrink: 0;
      }
      .inv-cmp-modal-title {
        font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em;
        color: #e8a020; text-transform: uppercase;
      }
      .inv-cmp-modal-close {
        width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
        background: none; border: none; cursor: pointer; color: #c0a080; font-size: 1.3rem;
        border-radius: 6px; margin: -0.4rem -0.5rem -0.4rem 0;
      }
      .inv-cmp-modal-close:hover { background: rgba(232,160,32,0.12); color: #e8c060; }
      .inv-cmp-modal-body {
        overflow-y: auto; flex: 1; padding: 0.7rem 0.9rem;
        -webkit-overflow-scrolling: touch;
      }
      .inv-cmp-section-label {
        font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
        text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.35rem;
        padding: 0.2rem 0.45rem; background: rgba(232,160,32,0.07);
        border-radius: 4px; border-left: 3px solid rgba(232,160,32,0.4);
      }
      .inv-cmp-section-label.candidate { border-left-color: #60d080; color: #90c8a0; }
      .inv-cmp-section-label.equipped  { border-left-color: #6898d8; color: #90b0d8; }
      .inv-cmp-divider {
        margin: 0.7rem 0; border: none; border-top: 1px solid rgba(232,160,32,0.15);
      }
      .inv-cmp-modal-footer {
        display: flex; gap: 0.5rem; padding: 0.55rem 0.9rem 0.7rem;
        border-top: 1px solid rgba(232,160,32,0.18); flex-shrink: 0;
      }
      .inv-cmp-footer-btn {
        flex: 1; min-height: 48px; padding: 0.5rem 0.7rem;
        background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.35);
        border-radius: 7px; color: #e8a020; font-size: 0.88rem; font-weight: 700;
        cursor: pointer; letter-spacing: 0.03em;
      }
      .inv-cmp-footer-btn:hover { background: rgba(232,160,32,0.22); }
      .inv-cmp-footer-btn.equip {
        background: rgba(96,208,128,0.12); border-color: rgba(96,208,128,0.45); color: #b0e8c0;
      }
      .inv-cmp-footer-btn.equip:hover { background: rgba(96,208,128,0.24); }
      .inv-cmp-footer-btn.secondary {
        background: rgba(104,152,216,0.1); border-color: rgba(104,152,216,0.4); color: #90b0d8;
      }
    `);

    // Build candidate tooltip (full item detail).
    const candidateHtml = getItemTooltip(candidateItem, hero);

    // Build equipped item section (or empty-slot message).
    let equippedHtml;
    if (vsItem) {
      equippedHtml = getItemTooltip(vsItem, hero);
    } else {
      equippedHtml = `<span style="color:#60d080;font-style:italic">Slot ${slotLabel || ''} is empty — direct upgrade.</span>`;
    }

    // Footer buttons.
    let footerHtml = `<button class="inv-cmp-footer-btn" data-modal-action="close">Close</button>`;
    if (hasSecondary) {
      footerHtml += `<button class="inv-cmp-footer-btn secondary" data-modal-action="secondary">Compare 2nd</button>`;
    }
    if (inInv) {
      footerHtml += `<button class="inv-cmp-footer-btn equip" data-modal-action="equip">Equip</button>`;
    }

    const backdrop = createEl('div', 'inv-cmp-modal-backdrop');
    backdrop.innerHTML = `
      <div class="inv-cmp-modal" role="dialog" aria-modal="true" aria-label="Item Compare">
        <div class="inv-cmp-modal-header">
          <span class="inv-cmp-modal-title">Compare Items</span>
          <button class="inv-cmp-modal-close" data-modal-action="close" aria-label="Close">&#x2715;</button>
        </div>
        <div class="inv-cmp-modal-body">
          <div class="inv-cmp-section-label candidate">Considered</div>
          <div class="inv-cmp-candidate-body">${candidateHtml}</div>
          <hr class="inv-cmp-divider">
          <div class="inv-cmp-section-label equipped">Equipped (${slotLabel || 'slot'})</div>
          <div class="inv-cmp-equipped-body">${equippedHtml}</div>
        </div>
        <div class="inv-cmp-modal-footer">${footerHtml}</div>
      </div>
    `;

    const close = () => { backdrop.remove(); this._activeCmpModal = null; };

    // Tap-outside to close.
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    // Esc key to close.
    const onEsc = (e) => { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', onEsc); } };
    window.addEventListener('keydown', onEsc);

    // Button actions.
    backdrop.querySelectorAll('[data-modal-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.modalAction;
        if (act === 'close') { close(); window.removeEventListener('keydown', onEsc); }
        else if (act === 'equip') {
          close(); window.removeEventListener('keydown', onEsc);
          if (onEquip) onEquip(candidateItem);
        }
        else if (act === 'secondary') {
          // Flip to the secondary equipped slot.
          this._compareSecondary = !this._compareSecondary;
          const gs2 = GameState.get();
          const chars2 = gs2.party || [];
          const char2 = chars2[this._selectedCharIdx] || chars2[0];
          const cmp2 = this._vsItemForCompare(char2, candidateItem);
          const equippedDiv = backdrop.querySelector('.inv-cmp-equipped-body');
          const labelDiv = backdrop.querySelector('.inv-cmp-section-label.equipped');
          if (cmp2?.vs && equippedDiv) {
            equippedDiv.innerHTML = getItemTooltip(cmp2.vs, hero);
          } else if (equippedDiv) {
            equippedDiv.innerHTML = `<span style="color:#60d080;font-style:italic">Slot ${cmp2?.slot || ''} is empty.</span>`;
          }
          if (labelDiv) labelDiv.textContent = `Equipped (${cmp2?.slot || 'slot'})`;
        }
      });
    });

    document.body.appendChild(backdrop);
    this._activeCmpModal = backdrop;

    // Trap focus on the modal close button initially.
    const closeBtn = backdrop.querySelector('.inv-cmp-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  _renderCharStats(char) {
    if (!char) return '<div class="stat-row"><span>No character selected</span></div>';
    const baseAttrs = char.baseAttrs || char.attrs; // fallback: treat attrs as base if no separate base stored
    const s = char.attrs;
    const baseMode = getBaseMode();
    const view = baseMode ? baseAttrs : s;
    const eqp = char.equipment || {};
    let totalArmor = 0;
    for (const item of Object.values(eqp)) {
      if (item?.armor) totalArmor += item.armor;
    }
    const baseArmor = 0;
    const ab = getEquipmentAffixBonuses(char);
    totalArmor += (ab.armor || 0);
    const weaponCat = getEquippedWeaponCategory(eqp);
    const effView = baseMode ? baseAttrs : {
      STR: s.STR + (ab.str || 0),
      DEX: s.DEX + (ab.dex || 0),
      INT: s.INT + (ab.int || 0),
      CON: s.CON + (ab.con || 0),
    };
    const eqpDmgBonus = computeHeroEquipDmgBonus(eqp) + (ab.dmg || 0);
    const dmgRange = computeHeroDamage(effView, baseMode ? 0 : eqpDmgBonus, weaponCat);
    const baseDmgRange = computeHeroDamage(baseAttrs, 0, weaponCat);
    const dmgLabel = weaponCat === 'magic' ? 'Magic Damage' : weaponCat === 'light' ? 'Light Damage' : 'Heavy Damage';
    const totalMagicResist = baseMode ? 0 : (ab.magicResist || 0);
    const calc = (a, includeAffixes) => ({
      hp: includeAffixes ? computeMaxHp(char) : 50 + a.CON * 10,
      mp: includeAffixes ? computeMaxMp(char) : 30 + a.INT * 8,
      hit: Math.min(95, 70 + Math.round(a.DEX * 1.2) + (includeAffixes ? (ab.hit || 0) : 0)),
      dodge: Math.min(40, 5 + Math.round(a.DEX * 0.8) + (includeAffixes ? (ab.dodge || 0) : 0)),
      // M116: spell-power = INT * 0.025 + Potency affix (5% per pt). Must
      // match CombatScreen, simulator, CharacterBuilder, FormulaCodex.
      spl: (a.INT * 0.025) + (includeAffixes ? (ab.spellPower || 0) : 0),
    });
    const cur = calc(baseMode ? baseAttrs : effView, !baseMode);
    const bas = calc(baseAttrs, false);
    const curArmor = baseMode ? baseArmor : totalArmor;
    const miscPct = baseMode ? 0 : (getPassiveBonuses(char).resistAll || 0);
    const drCur = computeDamageReduction(curArmor, miscPct);
    const drBase = computeDamageReduction(baseArmor, 0);
    const sc = (k, v, b) => {
      const c = statColor(v, b, k);
      return c ? ` style="color:${c}"` : '';
    };

    // ── Attributes group (STR/DEX/INT/CON as rows) ─────────────────────────
    const attrsHtml = ['STR','DEX','INT','CON'].map(k => {
      const lk = k.toLowerCase();
      const shown = effView[k];
      return `<div class="stat-row"><span class="sr-label stat-label" data-stat="${k}">${k}</span><span class="sr-val"${sc(lk, shown, baseAttrs[k])}>${Math.floor(shown)}</span></div>`;
    }).join('');

    // ── Other Effects group (dynamic: iterate non-zero equip affix keys) ────
    // Skip keys already shown in Character Stats. Iterate the actual bonus
    // bundle so new affix keys added by Agent A (critChance/critDamage/
    // spellPower/Potency) surface automatically with no per-key branches.
    const SHOWN_IN_CORE = new Set(['str','dex','int','con','hp','mp','dmg','armor','hit','dodge','magicresist','magicResist','spellpower','spellPower']);
    const OTHER_LABELS = {
      goldFind: 'Gold Find',
      xpFind: 'XP Find',
      manaRegen: 'Mana Regen',
      lifeSteal: 'Life Steal',
      manaSteal: 'Mana Steal',
      initiative: 'Initiative',
      critChance: 'Crit Chance',
      critDamage: 'Crit Damage',
      spellPower: 'Spell Power',
      tradePrices: 'Trade Prices',
    };
    const otherRows = [];
    if (!baseMode) {
      // M135: surface Block Chance / Block Power from equipped shields (they
      // live in a separate bundle from getEquipmentAffixBonuses).
      try {
        const bs = getCharacterBlockStats(char);
        if (bs?.blockChance > 0) {
          const pct = `+${formatPct(bs.blockChance)}`;
          otherRows.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Chance">Block Chance</span><span class="sr-val" style="color:#6db3ff">${pct}</span></div>`);
        }
        if (bs?.blockPower > 0) {
          otherRows.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Power">Block Power</span><span class="sr-val" style="color:#6db3ff">+${Math.round(bs.blockPower)}</span></div>`);
        }
      } catch (_) { /* ignore */ }
      for (const key of Object.keys(ab)) {
        if (SHOWN_IN_CORE.has(key) || SHOWN_IN_CORE.has(key.toLowerCase())) continue;
        const v = ab[key];
        if (!v) continue;
        const label = OTHER_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
        // Percent-style for known fractional effects. Crit chance/damage and
        // percentage-find stats are stored as 0..1 fractions.
        // Fractional (0..1) percent stats need *100 for display.
        const isFracPct = (key === 'goldFind' || key === 'xpFind' || key === 'critChance' || key === 'critDamage' || key === 'tradePrices') && Math.abs(v) <= 3;
        // Integer-percent stats: stored as e.g. 3 = 3% (combat divides by 100). Display as-is with % sign.
        const isIntPct = (key === 'lifeSteal' || key === 'manaSteal');
        const disp = isFracPct
          ? `+${formatPct(v)}`
          : isIntPct
            ? `+${formatStat(v, 'pct')}`
            : `+${formatStat(v, 'auto')}`;
        otherRows.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="${label}">${label}</span><span class="sr-val" style="color:#6db3ff">${disp}</span></div>`);
      }
    }
    const otherHtml = otherRows.length
      ? otherRows.join('')
      : `<div class="stat-row"><span class="sr-label" style="color:#5a4a42;font-style:italic">None</span><span class="sr-val" style="color:#5a4a42">—</span></div>`;

    return `
      <button type="button" class="auto-toggle stats-base-toggle${baseMode ? ' on' : ''}" id="stats-base-chk" aria-pressed="${baseMode ? 'true' : 'false'}" title="Show base attributes (without item bonuses)">${baseMode ? '<span class="auto-check" aria-hidden="true">✓</span>' : '<span class="auto-check auto-off" aria-hidden="true">○</span>'}Show Base Attributes</button>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="HP">HP</span><span class="sr-val"${sc('hp', cur.hp, bas.hp)}>${Math.floor(cur.hp)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Mana">Mana</span><span class="sr-val"${sc('mp', cur.mp, bas.mp)}>${Math.floor(cur.mp)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Armor">Armor</span><span class="sr-val"${sc('armor', curArmor, baseArmor)}>${Math.floor(curArmor)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Damage Reduction">Damage Reduction</span><span class="sr-val"${sc('dmgReduction', drCur.totalDr, drBase.totalDr)}>${formatPct(drCur.totalDr)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Magic Resist">Magic Resist</span><span class="sr-val"${sc('magicResist', totalMagicResist, 0)}>${Math.floor(totalMagicResist)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Hit">Hit</span><span class="sr-val"${sc('hit', cur.hit, bas.hit)}>${Math.floor(cur.hit)}%</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Dodge">Dodge</span><span class="sr-val"${sc('dodge', cur.dodge, bas.dodge)}>${Math.floor(cur.dodge)}%</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="${dmgLabel}">${dmgLabel}</span><span class="sr-val"${sc('dmg', dmgRange[1], baseDmgRange[1])}>${Math.floor(dmgRange[0])}-${Math.floor(dmgRange[1])}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Spell Power">Spell Power</span><span class="sr-val"${sc('spellPower', cur.spl, bas.spl)}>+${Math.round(cur.spl * 100)}%</span></div>
      <div class="panel-label" style="margin-top:0.75rem">Attributes</div>
      ${attrsHtml}
      <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
      ${otherHtml}
    `;
  }

  _doEquip(char, item, slot, gs) {
    if (!char.equipment) char.equipment = {};

    // If equipping 2H, unequip offhand
    if (item.twoHanded && item.type === 'weapon') {
      if (char.equipment.offhand) {
        // U10: swap-back goes raw — the user-driven equip is the intent;
        // don't bounce the displaced item right back via auto-equip.
        GameState.addToInventoryRaw(char.equipment.offhand);
        delete char.equipment.offhand;
      }
    }

    // Unequip existing in target slot
    if (char.equipment[slot]) {
      GameState.addToInventoryRaw(char.equipment[slot]);
    }

    char.equipment[slot] = item;
    GameState.removeFromInventory(item.id);
    // M276 U10: clear the manual-unequip block now that the user has explicitly
    // re-equipped this item. Future drops of new items won't be affected, but
    // this item itself can re-enter auto-equip cycles.
    GameState.unmarkManuallyUnequipped(item.id);
    // Recalc max HP/MP so CON/INT from equipment affixes take effect immediately.
    recalcPassiveStats(char);
  }

  _showSlotPicker(char, item, gs) {
    const existing = createEl('div', 'slot-picker-overlay');
    const weaponItem = char.equipment?.weapon;
    const offhandItem = char.equipment?.offhand;
    const is2HEquipped = weaponItem?.twoHanded;
    existing.innerHTML = `
      <div class="spo-box">
        <div class="spo-title">Equip to which slot?</div>
        <div class="spo-item-name" style="color:${`var(--rarity-${item.rarity})`}">${item.name}</div>
        <div class="spo-actions">
          <button type="button" class="spo-btn" id="spo-weapon">
            Main Hand${weaponItem ? `<br><small style="color:#8a7a6a">Replaces: ${weaponItem.name}</small>` : ''}
          </button>
          <button type="button" class="spo-btn" id="spo-offhand" ${is2HEquipped ? 'disabled title="Unequip 2H weapon first"' : ''}>
            Off Hand${offhandItem ? `<br><small style="color:#8a7a6a">Replaces: ${offhandItem.name}</small>` : ''}${is2HEquipped ? '<br><small style="color:#c04030">2H equipped</small>' : ''}
          </button>
        </div>
        <button type="button" class="spo-cancel" id="spo-cancel">Cancel</button>
      </div>
    `;
    existing.querySelector('#spo-weapon').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._doEquip(char, item, 'weapon', gs);
      removeEl(existing);
      this._render();
    });
    existing.querySelector('#spo-offhand').addEventListener('click', () => {
      if (is2HEquipped) return;
      this.audio.playSfx('click');
      this._doEquip(char, item, 'offhand', gs);
      removeEl(existing);
      this._render();
    });
    existing.querySelector('#spo-cancel').addEventListener('click', () => removeEl(existing));
    this._el.appendChild(existing);
  }

  _showRingPicker(char, item, gs) {
    const overlay = createEl('div', 'slot-picker-overlay');
    const ring1Item = char.equipment?.ring1;
    const ring2Item = char.equipment?.ring2;
    overlay.innerHTML = `
      <div class="spo-box">
        <div class="spo-title">Equip to which ring slot?</div>
        <div class="spo-item-name" style="color:${`var(--rarity-${item.rarity})`}">${item.name}</div>
        <div class="spo-actions">
          <button type="button" class="spo-btn" id="spo-ring1">
            Ring Slot 1${ring1Item ? `<br><small style="color:#8a7a6a">Replaces: ${ring1Item.name}</small>` : ''}
          </button>
          <button type="button" class="spo-btn" id="spo-ring2">
            Ring Slot 2${ring2Item ? `<br><small style="color:#8a7a6a">Replaces: ${ring2Item.name}</small>` : ''}
          </button>
        </div>
        <button type="button" class="spo-cancel" id="spo-cancel">Cancel</button>
      </div>
    `;
    overlay.querySelector('#spo-ring1').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._doEquip(char, item, 'ring1', gs);
      removeEl(overlay);
      this._render();
    });
    overlay.querySelector('#spo-ring2').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._doEquip(char, item, 'ring2', gs);
      removeEl(overlay);
      this._render();
    });
    overlay.querySelector('#spo-cancel').addEventListener('click', () => removeEl(overlay));
    this._el.appendChild(overlay);
  }

  _showInfoModal(message) {
    const overlay = createEl('div', 'slot-picker-overlay');
    overlay.innerHTML = `
      <div class="spo-box">
        <div class="spo-title">Notice</div>
        <div class="spo-item-name" style="color:#c0b090;font-style:normal">${message}</div>
        <button type="button" class="spo-cancel" id="info-ok">OK</button>
      </div>
    `;
    overlay.querySelector('#info-ok').addEventListener('click', () => removeEl(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeEl(overlay); });
    this._el.appendChild(overlay);
  }

  _equipItemFlow(item) {
    const gs = GameState.get();
    const chars = [...gs.party, ...gs.companions];
    const char = chars[this._selectedCharIdx];
    if (!char || !item) return;
    if (char.isCompanion && char.class === 'companion') {
      this._showInfoModal('Companions cannot equip items.');
      return;
    }
    const isWeapon = item.type === 'weapon';
    const isTwoHanded = item.twoHanded;
    const canOffhand = item.offHandOk || (!isTwoHanded && isWeapon);
    if (isWeapon && !isTwoHanded && canOffhand) {
      const hasMain = !!char.equipment?.weapon;
      const hasOff = !!char.equipment?.offhand;
      const mainIs2H = char.equipment?.weapon?.twoHanded;
      if (!hasMain) { this._doEquip(char, item, 'weapon', gs); this._render(); return; }
      if (!hasOff && !mainIs2H) { this._doEquip(char, item, 'offhand', gs); this._render(); return; }
      this._showSlotPicker(char, item, gs);
      return;
    }
    if (item.subtype === 'ring') {
      const hasR1 = !!char.equipment?.ring1;
      const hasR2 = !!char.equipment?.ring2;
      if (!hasR1) { this._doEquip(char, item, 'ring1', gs); this._render(); return; }
      if (!hasR2) { this._doEquip(char, item, 'ring2', gs); this._render(); return; }
      this._showRingPicker(char, item, gs);
      return;
    }
    let slot = item.slot;
    if (!slot) { if (isWeapon) slot = 'weapon'; else slot = item.subtype; }
    this._doEquip(char, item, slot, gs);
    this._render();
  }

  _wireEvents() {
    this._el.querySelector('#inv-close')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });

    // M276 U10 — per-character auto-equip toggle. M322: button-style toggle
    // matching the Skills/Passives/Attributes "Auto" button.
    const autoBtn = this._el.querySelector('#inv-autoequip');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        // M385: auto-equip locked on Hard difficulty.
        if (isHardDifficulty()) return;
        this.audio.playSfx('click');
        const gs = GameState.get();
        const chars = [...gs.party, ...gs.companions, ...(gs.bench || [])];
        const ch = chars[this._selectedCharIdx];
        if (!ch) return;
        const next = !ch.autoEquip;
        if (!next) {
          // Turning OFF: silent, no confirmation needed.
          ch.autoEquip = false;
          this._render();
          return;
        }
        // M406 — single save-level autoModeAccepted flag.
        const enable = () => {
          ch.autoEquip = true;
          // M322 fix: always sweep existing inventory when turned on, even
          // for items that were sitting in the bag before Auto was ever
          // enabled.
          _sweepAutoEquip(ch, gs, this.audio);
          this._render();
        };
        if (gs.autoModeAccepted) {
          enable();
          return;
        }
        showConfirmModal({
          title: 'Enable Auto-Equip?',
          message: 'Auto-equip will automatically equip upgrades for this character as they appear. Items you manually unequip are remembered and skipped. You can turn this off at any time.',
          confirmText: 'Enable Auto',
          cancelText: 'Cancel',
          onConfirm: () => {
            gs.autoModeAccepted = true;
            enable();
          },
        });
      });
    }

    this._el.querySelectorAll('.char-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.audio.playSfx('click');
        // M293: save scroll position for current character before switching.
        const scrollEl = this._el.querySelector('.inv-items-panel') || this._el.querySelector('.equip-panel');
        if (scrollEl) {
          this._charScrollPos.set(this._selectedCharIdx, scrollEl.scrollTop);
        }
        this._selectedCharIdx = parseInt(tab.dataset.idx);
        this._render();
        // M293: restore scroll position for the newly selected character.
        requestAnimationFrame(() => {
          const el = this._el?.querySelector('.inv-items-panel') || this._el?.querySelector('.equip-panel');
          if (el) el.scrollTop = this._charScrollPos.get(this._selectedCharIdx) || 0;
        });
      });
    });

    // Equip buttons
    this._el.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        const itemId = btn.dataset.equip;
        const gs = GameState.get();
        const chars = [...gs.party, ...gs.companions];
        const char = chars[this._selectedCharIdx];
        const item = gs.inventory.find(i => i.id === itemId);
        if (!char || !item) return;

        // Non-equippable companions cannot equip anything
        if (char.isCompanion && char.class === 'companion') {
          this._showInfoModal('Companions cannot equip items.');
          return;
        }

        const isWeapon = item.type === 'weapon';
        const isTwoHanded = item.twoHanded;
        const canOffhand = item.offHandOk || (!isTwoHanded && isWeapon);

        if (isWeapon && !isTwoHanded && canOffhand) {
          // Auto-equip into the first empty hand slot if one exists
          const hasMain = !!char.equipment?.weapon;
          const hasOff = !!char.equipment?.offhand;
          const mainIs2H = char.equipment?.weapon?.twoHanded;
          if (!hasMain) { this._doEquip(char, item, 'weapon', gs); this._render(); return; }
          if (!hasOff && !mainIs2H) { this._doEquip(char, item, 'offhand', gs); this._render(); return; }
          this._showSlotPicker(char, item, gs);
          return;
        }

        if (item.subtype === 'ring') {
          const hasR1 = !!char.equipment?.ring1;
          const hasR2 = !!char.equipment?.ring2;
          if (!hasR1) { this._doEquip(char, item, 'ring1', gs); this._render(); return; }
          if (!hasR2) { this._doEquip(char, item, 'ring2', gs); this._render(); return; }
          this._showRingPicker(char, item, gs);
          return;
        }

        let slot = item.slot;
        if (!slot) {
          if (isWeapon) slot = 'weapon';
          else slot = item.subtype;
        }

        this._doEquip(char, item, slot, gs);
        this._render();
      });
    });

    // Unequip slot
    this._el.querySelectorAll('[data-slot]').forEach(el => {
      if (!el.dataset.itemid) return;
      el.addEventListener('click', () => {
        const gs = GameState.get();
        const chars = [...gs.party, ...gs.companions];
        const char = chars[this._selectedCharIdx];
        const slot = el.dataset.slot;
        if (!char?.equipment?.[slot]) return;
        this.audio.playSfx('click');
        // M276 U10: manual unequip — mark the item so auto-equip skips it.
        const removed = char.equipment[slot];
        GameState.markManuallyUnequipped(removed.id);
        GameState.addToInventoryRaw(removed);
        delete char.equipment[slot];
        recalcPassiveStats(char);
        this._render();
      });
    });

    // Tooltips — item cards and equipped slots.
    // Lifecycle mirrors a simple singleton: pointerenter shows, pointerleave
    // hides on desktop; tap shows with a close button on touch.
    const tt = this._el.querySelector('#inv-tt');
    const ttBody = tt?.querySelector('.inv-tt-body');
    const ttClose = tt?.querySelector('.inv-tt-close');
    const allItemsForChar = () => {
      const gs = GameState.get();
      const chars = [...gs.party, ...gs.companions, ...(gs.bench || [])];
      return { gs, char: chars[this._selectedCharIdx] };
    };
    const resolveItem = (itemId) => {
      const { gs, char } = allItemsForChar();
      return gs.inventory.find(i => i.id === itemId)
        || Object.values(char?.equipment || {}).find(i => i?.id === itemId);
    };
    const renderTooltipBody = (item) => {
      if (!ttBody || !item) return;
      const { gs, char } = allItemsForChar();
      // U8: only inventory items (not equipped) compare-meaningfully — but
      // we keep compare mode working for any item the user is hovering.
      if (this._compareMode) {
        const cmp = this._vsItemForCompare(char, item);
        const vs = cmp?.vs || null;
        const slotLabel = cmp?.slot || null;
        let hint = null;
        if (cmp?.hasSecondary) {
          hint = this._isTouch
            ? 'Tap "Compare 2nd" below to compare against the other slot.'
            : 'Hold Alt+Shift to compare against the other slot.';
        }
        let html = '';
        if (this._isTouch) {
          html += `<div class="tt-breadcrumb">Inventory <span class="bc-sep">›</span> ${item.name} <span class="bc-sep">›</span> <strong>Compare</strong></div>`;
        }
        html += getItemCompareTooltip(item, vs, { hero: char, slotLabel, secondaryHint: hint });
        if (this._isTouch) {
          const inInv = !!gs?.inventory?.find(i => i.id === item.id);
          html += `<div class="tt-cmp-actions">
            <button type="button" class="tt-cmp-btn" data-cmp-action="exit">Back</button>
            ${cmp?.hasSecondary ? `<button type="button" class="tt-cmp-btn" data-cmp-action="secondary">Compare 2nd</button>` : ''}
            ${inInv ? `<button type="button" class="tt-cmp-btn primary" data-cmp-action="equip">Equip</button>` : ''}
          </div>`;
        }
        ttBody.innerHTML = html;
      } else {
        let html = '';
        if (this._isTouch) {
          html += `<div class="tt-breadcrumb">Inventory <span class="bc-sep">›</span> <strong>${item.name}</strong></div>`;
        }
        html += getItemTooltip(item, char);
        if (this._isTouch) {
          const slots = this._slotsForItem(char, item);
          const gs = GameState.get();
          const inInv = !!gs.inventory.find(i => i.id === item.id);
          if (slots.length) {
            html += `<div class="tt-cmp-actions">
              ${slots.length ? `<button type="button" class="tt-cmp-btn" data-cmp-action="enter">Compare</button>` : ''}
              ${inInv ? `<button type="button" class="tt-cmp-btn primary" data-cmp-action="equip">Equip</button>` : ''}
            </div>`;
          }
        }
        ttBody.innerHTML = html;
      }
      // Wire compare-mode buttons (touch).
      ttBody.querySelectorAll('[data-cmp-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.cmpAction;
          if (action === 'enter') {
            // On narrow mobile viewports, side-by-side compare won't fit in the
            // floating tooltip — open a dedicated full-viewport modal instead.
            if (window.matchMedia('(max-width: 700px)').matches) {
              const candidateItem = this._currentTooltipItem;
              const { gs, char } = allItemsForChar();
              const cmp = this._vsItemForCompare(char, candidateItem);
              const vs = cmp?.vs || null;
              const slotLabel = cmp?.slot || null;
              const hasSecondary = !!cmp?.hasSecondary;
              const inInv = !!gs?.inventory?.find(i => i.id === candidateItem?.id);
              hideItemTooltip();
              this._openCompareModal(candidateItem, vs, {
                hero: char, slotLabel, hasSecondary, inInv,
                onEquip: (item) => { this._equipItemFlow(item); },
              });
              return;
            }
            this._compareMode = true; this._compareSecondary = false;
          }
          else if (action === 'exit') { this._compareMode = false; this._compareSecondary = false; }
          else if (action === 'secondary') { this._compareSecondary = !this._compareSecondary; }
          else if (action === 'equip') {
            this.audio.playSfx('click');
            const item = this._currentTooltipItem;
            hideItemTooltip();
            this._equipItemFlow(item);
            return;
          }
          if (this._currentTooltipItem) renderTooltipBody(this._currentTooltipItem);
        });
      });
    };
    const showItemTooltip = (item, clientX, clientY, touch) => {
      if (!tt || !item) return;
      this._currentTooltipItem = item;
      renderTooltipBody(item);
      tt.style.display = 'block';
      tt.classList.toggle('touch-open', !!touch);
      // Two-pass clamp using viewport rect.
      const pad = 8;
      const vw = window.innerWidth, vh = window.innerHeight;
      tt.style.left = Math.max(pad, clientX + 12) + 'px';
      tt.style.top  = Math.max(pad, clientY + 12) + 'px';
      const r = tt.getBoundingClientRect();
      let left = r.left, top = r.top;
      if (r.right > vw - pad) left = Math.max(pad, vw - r.width - pad);
      if (r.bottom > vh - pad) top = Math.max(pad, vh - r.height - pad);
      tt.style.left = left + 'px';
      tt.style.top = top + 'px';
    };
    const hideItemTooltip = () => {
      if (!tt) return;
      tt.style.display = 'none';
      tt.classList.remove('touch-open');
      this._currentTooltipItem = null;
      // Reset desktop compare state when tooltip closes (alt may still be held;
      // re-opening will pick up the live alt state via keydown listener).
      if (!this._isTouch) {
        this._compareMode = false;
        this._compareSecondary = false;
      }
    };
    ttClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideItemTooltip();
    });

    // U8 — slot-hover highlighting helpers
    const setSlotHover = (slotKeys, on) => {
      for (const key of slotKeys) {
        const cell = this._el.querySelector(`.equip-slot[data-slot="${key}"]`);
        if (cell) cell.classList.toggle('slot-hover', on);
      }
    };

    this._el.querySelectorAll('.inv-item-card, .es-item').forEach(card => {
      card.addEventListener('pointerenter', e => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') return;
        const itemId = card.dataset.id || card.dataset.itemid;
        const item = resolveItem(itemId);
        if (!item) return;
        // Slot hover highlighting — only for inventory cards (not equipped).
        if (card.classList.contains('inv-item-card')) {
          const { char } = allItemsForChar();
          const slots = this._slotsForItem(char, item);
          setSlotHover(slots, true);
          card._hoverSlots = slots;
        }
        // U8 — desktop Alt-down-on-enter: pick up live alt state.
        if (!this._isTouch) {
          this._compareMode = !!e.altKey;
          this._compareSecondary = !!(e.altKey && e.shiftKey);
        }
        showItemTooltip(item, e.clientX, e.clientY, false);
      });
      card.addEventListener('pointerleave', e => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') return;
        if (card._hoverSlots) { setSlotHover(card._hoverSlots, false); card._hoverSlots = null; }
        hideItemTooltip();
      });
      card.addEventListener('click', (e) => {
        // Treat as touch if pointerType says so OR the device reports as touch.
        const touch = e.pointerType === 'touch' || e.pointerType === 'pen' || this._isTouch;
        if (!touch) return; // desktop click-through (equip button handles itself)
        // Don't intercept clicks on the inline equip button (still works on small
        // tablets where iic-equip-btn isn't hidden by media query).
        if (e.target.closest && e.target.closest('.iic-equip-btn')) return;
        const itemId = card.dataset.id || card.dataset.itemid;
        const item = resolveItem(itemId);
        if (!item) return;
        const r = card.getBoundingClientRect();
        showItemTooltip(item, r.left, r.bottom, true);
      });
    });

    // U8 — desktop: Alt key toggles compare-mode while tooltip is visible.
    if (!this._isTouch && tt && !tt._altBound) {
      tt._altBound = true;
      const onKey = (e) => {
        if (tt.style.display === 'none' || !this._currentTooltipItem) return;
        if (e.key !== 'Alt' && e.key !== 'Shift') return;
        const wantCompare = !!e.altKey || (e.type === 'keydown' && e.key === 'Alt');
        const wantSecondary = wantCompare && (!!e.shiftKey || (e.type === 'keydown' && e.key === 'Shift'));
        // For keyup, derive from the event's modifier state directly.
        const finalCompare = e.type === 'keyup'
          ? (e.key === 'Alt' ? false : !!e.altKey)
          : wantCompare;
        const finalSecondary = e.type === 'keyup'
          ? (e.key === 'Shift' ? false : (!!e.altKey && !!e.shiftKey))
          : wantSecondary;
        if (this._compareMode === finalCompare && this._compareSecondary === finalSecondary) return;
        this._compareMode = finalCompare;
        this._compareSecondary = finalSecondary;
        renderTooltipBody(this._currentTooltipItem);
      };
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      tt._altKeyHandler = onKey;
    }
    // Tap-outside dismiss for the sticky/touch item tooltip.
    if (tt && !tt._outsideBound) {
      tt._outsideBound = true;
      document.addEventListener('click', (e) => {
        if (tt.style.display === 'none') return;
        if (!tt.classList.contains('touch-open')) return;
        if (tt.contains(e.target)) return;
        if (e.target.closest?.('.inv-item-card, .es-item')) return;
        hideItemTooltip();
      }, true);
    }
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  update() {}
  draw() {}
  onExit() { const gs = GameState.get(); gs.inventoryContext = null; removeEl(this._el); this._el = null; }
  destroy() { removeEl(this._el); this._el = null; }
}

const INV_STYLES = `
/* M322: button-style auto-toggle, mirrors the SkillTreeScreen .auto-toggle.
   Defined here so the inventory screen renders consistently even before the
   SkillTreeScreen is mounted in a session. */
.auto-toggle {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.65rem; min-height: 36px; border-radius: 6px;
  background: rgba(20,12,28,0.7); border: 1px solid rgba(232,160,32,0.2);
  color: #8a7a6a; font-size: 0.7rem; font-weight: 600; cursor: pointer;
  letter-spacing: 0.05em; font-family: inherit;
}
.auto-toggle:hover { border-color: rgba(232,160,32,0.45); color: #e8a020; }
.auto-toggle.on { border-color: rgba(72,176,96,0.6); color: #6dd180; background: rgba(72,176,96,0.1); }
.auto-toggle .auto-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: #48b060; color: #06200d; font-size: 10px; font-weight: 800;
  line-height: 1;
}
/* M384 — unchecked state: gold outline circle, no background. */
.auto-toggle .auto-check.auto-off {
  background: transparent;
  border: 1px solid rgba(232,160,32,0.7);
  color: transparent;
  font-weight: 400;
}
/* M406 — inline: panel label immediately followed by Auto toggle (not far-right). */
.panel-label-row {
  display: flex; align-items: center; justify-content: flex-start;
  gap: 0.5rem; flex-wrap: wrap;
}
.panel-label-row .auto-toggle { margin: 0; }
.inv-screen {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: linear-gradient(180deg,#0a0608,#120a10); color: #f0e8d8;
  font-family: 'Inter', sans-serif;
}
.inv-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 1rem; border-bottom: 1px solid rgba(232,160,32,0.15);
  background: rgba(0,0,0,0.3); flex-shrink: 0; gap: 0.5rem;
}
.inv-char-tabs { display: flex; gap: 0.4rem; overflow-x: auto; }
.char-tab {
  padding: 0.4rem 0.85rem; background: rgba(26,18,24,0.6);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 6px;
  color: #8a7a6a; font-size: 0.75rem; cursor: pointer; min-height: 44px; text-align: center;
  transition: all 0.2s;
}
.char-tab.active { border-color: rgba(232,160,32,0.5); color: #e8a020; background: rgba(232,160,32,0.08); }
.char-tab small { font-size: 0.6rem; }
.inv-close { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 0.85rem; padding: 0.4rem 0.6rem; min-height: 36px; }
.inv-close:hover { color: #f0e8d8; }
.inv-layout { flex: 1; display: grid; grid-template-columns: 260px 1fr; overflow: hidden; }
@media (max-width: 600px) { .inv-layout { grid-template-columns: 1fr; } .equip-panel { display: none; } }
.panel-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.6rem; }
.inv-char-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.inv-portrait-wrap { width: 80px; height: 80px; padding: 5px; box-sizing: border-box; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.inv-portrait { border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(232,160,32,0.25); width: 100% !important; height: 100% !important; }
.inv-class-icon { margin-left: 4px; vertical-align: middle; display: inline-flex; }
.inv-char-identity { flex: 1; }
/* M312 #37: 0.6rem bottom margin to match .panel-label spacing */
.inv-char-class { font-size: 0.72rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.6rem; }
.inv-char-name { font-family: 'Cinzel', Georgia, serif; font-size: 0.95rem; color: #f0e8d8; letter-spacing: 0.04em; display: flex; align-items: center; gap: 0.4rem; }
.equip-panel {
  padding: 1rem; border-right: 1px solid rgba(232,160,32,0.1);
  overflow-y: auto; display: flex; flex-direction: column; gap: 1rem;
}
.equip-slots { display: flex; flex-direction: column; gap: 0.35rem; }
.equip-slot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.45rem 0.65rem; background: rgba(26,18,24,0.5);
  border: 1px solid rgba(255,255,255,0.05); border-radius: 5px; min-height: 40px;
}
.equip-slot.has-item { border-color: rgba(232,160,32,0.15); cursor: pointer; }
.equip-slot.has-item:hover { border-color: rgba(232,160,32,0.4); }
.es-label { font-size: 0.65rem; color: #8a7a6a; min-width: 55px; }
.es-item { flex: 1; text-align: right; }
.esi-name { font-size: 0.72rem; font-weight: 600; }
.esi-stat { font-size: 0.62rem; color: #8a7a6a; }
.es-empty { font-size: 0.65rem; color: #3a2a22; }
.char-stats-panel { margin-top: 0.5rem; }
.stat-row { display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.75rem; }
.sr-label { color: #8a7a6a; }
.sr-val { font-family: 'Cinzel', serif; font-weight: 700; color: #e8a020; }
.inv-items-panel { padding: 1rem; overflow-y: auto; }
.inv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.6rem; }
.inv-item-card {
  position: relative; padding: 0.75rem; background: rgba(26,18,24,0.7);
  border: 1px solid rgba(232,160,32,0.08); border-radius: 8px;
  transition: border-color 0.15s; overflow: hidden;
}
.inv-item-card:hover { border-color: rgba(232,160,32,0.3); }
.iic-rarity-bar { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
.iic-name { font-size: 0.78rem; font-weight: 600; margin-bottom: 0.15rem; }
.iic-type { font-size: 0.62rem; color: #8a7a6a; text-transform: capitalize; }
.iic-stat { font-size: 0.68rem; color: #c0b090; margin-top: 0.2rem; }
.iic-quality { font-size: 0.6rem; color: #6a5a52; text-transform: capitalize; }
/* M305: set and unique item card markers */
.iic-set-tag { font-size: 0.58rem; font-weight: 700; color: #b060ff; letter-spacing: 0.06em; text-transform: uppercase; }
.iic-unique-tag { font-size: 0.58rem; font-weight: 700; color: #ff8020; letter-spacing: 0.06em; text-transform: uppercase; }
.inv-item-card.iic-set { border-color: rgba(176,96,255,0.25); }
.inv-item-card.iic-set:hover { border-color: rgba(176,96,255,0.5); }
.inv-item-card.iic-unique { border-color: rgba(255,128,32,0.25); }
.inv-item-card.iic-unique:hover { border-color: rgba(255,128,32,0.5); }
.iic-equip-btn {
  margin-top: 0.5rem; width: 100%; padding: 0.3rem; background: rgba(232,160,32,0.1);
  border: 1px solid rgba(232,160,32,0.25); border-radius: 4px;
  color: #e8a020; font-size: 0.7rem; font-weight: 600; cursor: pointer; min-height: 28px;
}
.iic-equip-btn:hover { background: rgba(232,160,32,0.22); }
.inv-empty { grid-column: 1/-1; text-align: center; padding: 3rem 2rem; font-size: 0.85rem; color: #4a3a32; }
.inv-tooltip {
  position: fixed; z-index: 1000; pointer-events: none;
  background: rgba(10,6,8,0.95); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.8rem;
  line-height: 1.7;
  max-width: min(420px, calc(100vw - 16px));
  /* M374: bound tooltip height + scroll. On iPhone, an item with many
     affixes + the Equip/Compare buttons could extend below the viewport
     and the buttons became unreachable. Now the tooltip itself scrolls. */
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  color: #f0e8d8;
  box-sizing: border-box;
}
.inv-tooltip.touch-open { pointer-events: auto; padding-right: 2rem; }
/* M348 — close button enlarged to 36px (was 24px which was below the
   44-target threshold AND visually disappeared on iPhone because it
   sat under the safe-area inset). Padding shifted so it stays visible
   even when the tooltip scrolls. */
.inv-tooltip .inv-tt-close {
  position: sticky; top: 0; float: right;
  width: 40px; height: 40px;
  border: 1px solid rgba(232,160,32,0.45);
  background: rgba(232,160,32,0.22); color: #f8d880;
  border-radius: 6px; font-size: 1.2rem; line-height: 1; cursor: pointer;
  display: none; align-items: center; justify-content: center; padding: 0;
  margin: -0.4rem -0.5rem 0.3rem 0.4rem;
  z-index: 2;
}
.inv-tooltip.touch-open .inv-tt-close { display: inline-flex; }
.inv-tooltip .inv-tt-close:hover { background: rgba(232,160,32,0.35); color: #fff; }
.inv-tooltip .tt-affix { white-space: nowrap; }
.slot-picker-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.72); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.spo-box {
  background: #12090f; border: 1px solid rgba(232,160,32,0.3); border-radius: 12px;
  padding: 1.75rem; text-align: center; max-width: 300px; width: 90%;
}
.spo-title { font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #f0e8d8; margin-bottom: 0.4rem; }
.spo-item-name { font-size: 0.85rem; font-weight: 600; margin-bottom: 1.25rem; }
.spo-actions { display: flex; gap: 0.7rem; margin-bottom: 0.8rem; }
.spo-btn {
  flex: 1; padding: 0.75rem 0.5rem; background: rgba(232,160,32,0.1);
  border: 1px solid rgba(232,160,32,0.35); border-radius: 8px;
  color: #e8a020; font-family: 'Cinzel', serif; font-size: 0.82rem; font-weight: 700;
  cursor: pointer; min-height: 64px; line-height: 1.4; transition: background 0.15s;
}
.spo-btn:hover:not(:disabled) { background: rgba(232,160,32,0.22); }
.spo-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.spo-cancel { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 0.78rem; min-height: 36px; }
.spo-cancel:hover { color: #f0e8d8; }
.equip-slot.slot-disabled { opacity: 0.35; pointer-events: none; }
.equip-slot.slot-disabled .es-label::after { content: ' [2H]'; color: #c04030; font-size: 0.58rem; }
.equip-slot.slot-companion.slot-disabled .es-label::after { content: ''; }
.es-companion-tag { color: #6a5a52; font-size: 0.58rem; margin-left: 0.25rem; }

/* U8 — slot-hover highlight when user is hovering a fitting inventory item */
.equip-slot.slot-hover {
  border-color: rgba(96,208,128,0.7) !important;
  background: rgba(96,208,128,0.08);
  box-shadow: 0 0 8px rgba(96,208,128,0.35);
}

/* U8 — upgrade glow tiers on inventory cards */
.inv-item-card.upgrade-empty {
  border: 2px solid #60d080;
  box-shadow: 0 0 12px rgba(96,208,128,0.45);
}
.inv-item-card.upgrade-minor {
  border: 1px solid rgba(96,208,128,0.25);
}
.inv-item-card.upgrade-medium {
  border: 1px solid rgba(96,208,128,0.55);
  box-shadow: 0 0 8px rgba(96,208,128,0.30);
}
.inv-item-card.upgrade-major {
  border: 2px solid rgba(96,208,128,0.85);
  box-shadow: 0 0 14px rgba(96,208,128,0.55);
}
.inv-item-card.upgrade-huge {
  border: 2px solid #fff;
  animation: invShimmer 1s linear infinite;
}
@keyframes invShimmer {
  0%   { border-color: #60d080; box-shadow: 0 0 14px rgba(96,208,128,0.7); }
  33%  { border-color: #60a8e8; box-shadow: 0 0 14px rgba(96,168,232,0.7); }
  66%  { border-color: #e8c860; box-shadow: 0 0 14px rgba(232,200,96,0.7); }
  100% { border-color: #60d080; box-shadow: 0 0 14px rgba(96,208,128,0.7); }
}

/* U8 — compare-mode tooltip groups + touch action buttons */
.inv-tooltip .tt-cmp-vs { font-style: italic; }
.inv-tooltip .tt-cmp-hdr { display: inline-block; margin-top: 0.35rem; font-weight: 600; letter-spacing: 0.04em; }
.inv-tooltip .tt-cmp-actions {
  display: flex; gap: 0.4rem; margin-top: 0.6rem;
  /* M374: stick action buttons to the bottom of the scrollable tooltip so
     Equip / Compare are always reachable without scrolling. */
  position: sticky; bottom: -0.5rem;
  background: rgba(10,6,8,0.95);
  padding: 0.4rem 0;
  margin-bottom: -0.5rem;
}
/* M348 — Equip / Compare buttons bumped to 44px tap target. Below the
   threshold iOS sometimes suppresses the synthesized click that follows
   touchend, which the user reported as "buttons do nothing on iPhone." */
.inv-tooltip .tt-cmp-btn {
  flex: 1; padding: 0.6rem 0.7rem; background: rgba(232,160,32,0.12);
  border: 1px solid rgba(232,160,32,0.35); border-radius: 6px;
  color: #e8a020; font-size: 0.85rem; font-weight: 600; cursor: pointer;
  min-height: 44px;
}
.inv-tooltip .tt-cmp-btn:hover { background: rgba(232,160,32,0.24); }
.inv-tooltip .tt-cmp-btn.primary { background: rgba(96,208,128,0.14); border-color: rgba(96,208,128,0.5); color: #b0e8c0; }
.inv-tooltip .tt-cmp-btn.primary:hover { background: rgba(96,208,128,0.26); }
.inv-tooltip .tt-breadcrumb {
  font-size: 0.7rem; color: #8a7a6a; letter-spacing: 0.02em; margin-bottom: 0.5rem;
  padding-bottom: 0.4rem; border-bottom: 1px solid rgba(232,160,32,0.12);
}
.inv-tooltip .tt-breadcrumb strong { color: #e8a020; font-weight: 600; }
.inv-tooltip .tt-breadcrumb .bc-sep { color: #4a3a32; margin: 0 0.3rem; }
@media (max-width: 720px) {
  .iic-equip-btn { display: none !important; }
  .inv-item-card { cursor: pointer; }
}
`;
