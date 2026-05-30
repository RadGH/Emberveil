// src/ui/components/CharacterStatsPanel.js
//
// Shared character-stats renderer. The same panel layout is used in two
// places:
//   - Inventory > Character Stats (read-only)
//   - Skill Tree > Attributes (with +1 spend buttons next to STR/DEX/INT/CON)
//
// To keep the two surfaces consistent, both screens render this HTML and
// the same group ordering (Derived Stats, Attributes, Other Effects), the
// same field names ("HP" not "Max HP"), and the same Base toggle behavior.
//
// NOTE for Wave 3: InventoryScreen still has its own inline _renderCharStats
// for now — this module is the destination. Once InventoryScreen is migrated
// it should call renderCharacterStatsPanel(char, { withSpendButtons: false }).

import { statColor, getBaseMode } from './StatColors.js';
import {
  computeHeroDamage, computeHeroEquipDmgBonus, getEquipmentAffixBonuses,
  getCharacterBlockStats, computeDamageReduction,
} from '../../game/formulas.js';
import { computeMaxHp, computeMaxMp, getPassiveBonuses } from '../../game/passives.js';
import { getEquippedWeaponCategory } from '../../game/items.js';

/**
 * Pick the single damage row label for the equipped weapon category.
 * Mirrors Inventory > Character Stats:
 *   - heavy → "Heavy Damage" (STR weapons; default if no weapon)
 *   - light → "Light Damage" (DEX weapons)
 *   - magic → "Magic Damage" (INT weapons)
 */
export function damageLabelForWeapon(weaponCat) {
  if (weaponCat === 'magic') return 'Magic Damage';
  if (weaponCat === 'light') return 'Light Damage';
  return 'Heavy Damage';
}

/**
 * Render the shared character-stats HTML. Returns a string of HTML.
 *
 * @param {object} char  Hero/companion record
 * @param {object} [opts]
 * @param {boolean} [opts.withSpendButtons=false]  If true, STR/DEX/INT/CON
 *        rows render a +1 button next to the value (Skill Tree > Attributes).
 *        The button is rendered with `data-attr="STR|DEX|INT|CON"` and is
 *        disabled when there are no points to spend; the caller wires it.
 * @param {number} [opts.pendingAttrPoints=0]  Used to enable/disable the +1
 *        buttons when withSpendButtons is true.
 * @param {boolean} [opts.includeHeader=false]  If true, includes the panel-label
 *        "Character Stats" / "Attributes" header above the BASE checkbox.
 * @param {string} [opts.headerLabel]  Override for the included header.
 * @param {string} [opts.baseToggleId='stats-base-chk']  id for the BASE input
 *        so the caller can wire `change` to re-render with setBaseMode().
 * @returns {string} HTML
 */
export function renderCharacterStatsPanel(char, opts = {}) {
  const {
    withSpendButtons = false,
    pendingAttrPoints = 0,
    includeHeader = false,
    headerLabel = withSpendButtons ? 'Attributes' : 'Character Stats',
    baseToggleId = 'stats-base-chk',
  } = opts;

  if (!char) {
    return `<div class="stat-row"><span>No character selected</span></div>`;
  }

  const baseAttrs = char.baseAttrs || char.attrs || { STR:8, DEX:8, INT:8, CON:8 };
  const s = char.attrs || baseAttrs;
  const baseMode = getBaseMode();
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
    STR: (s.STR || 8) + (ab.str || 0),
    DEX: (s.DEX || 8) + (ab.dex || 0),
    INT: (s.INT || 8) + (ab.int || 0),
    CON: (s.CON || 8) + (ab.con || 0),
  };
  const eqpDmgBonus = computeHeroEquipDmgBonus(eqp) + (ab.dmg || 0);
  const dmgRange = computeHeroDamage(effView, baseMode ? 0 : eqpDmgBonus, weaponCat);
  const baseDmgRange = computeHeroDamage(baseAttrs, 0, weaponCat);
  const dmgLabel = damageLabelForWeapon(weaponCat);
  const totalMagicResist = baseMode ? 0 : (ab.magicResist || 0);

  const calc = (a, includeAffixes) => ({
    hp: includeAffixes ? computeMaxHp(char) : 50 + a.CON * 10,
    mp: includeAffixes ? computeMaxMp(char) : 30 + a.INT * 8,
    hit: Math.min(95, 70 + Math.round(a.DEX * 1.2) + (includeAffixes ? (ab.hit || 0) : 0)),
    dodge: Math.min(40, 5 + Math.round(a.DEX * 0.8) + (includeAffixes ? (ab.dodge || 0) : 0)),
    spl: +((a.INT * 0.025) + (includeAffixes ? (ab.spellPower || 0) : 0)).toFixed(2),
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

  // ── Attributes group (STR/DEX/INT/CON) ────────────────────────────────
  // With spend buttons, render with +1 controls; otherwise a simple value cell.
  const attrsHtml = ['STR','DEX','INT','CON'].map(k => {
    const lk = k.toLowerCase();
    const shown = effView[k];
    const colorAttr = sc(lk, shown, baseAttrs[k]);
    if (withSpendButtons) {
      const enabled = pendingAttrPoints > 0;
      return `
        <div class="stat-row stat-row-attr">
          <span class="sr-label stat-label" data-stat="${k}">${k}</span>
          <span class="sr-val"${colorAttr}>${Math.floor(shown)}</span>
          <button type="button" class="sr-attr-btn${enabled ? '' : ' disabled'}" data-attr="${k}" ${enabled ? '' : 'disabled'} aria-label="Increase ${k}">+1</button>
        </div>`;
    }
    return `<div class="stat-row"><span class="sr-label stat-label" data-stat="${k}">${k}</span><span class="sr-val"${colorAttr}>${Math.floor(shown)}</span></div>`;
  }).join('');

  // ── Other Effects group (dynamic affix iteration) ─────────────────────
  // Match Inventory exactly. Block Chance/Power/ManaSteal/CritChance hide
  // entirely in BASE mode (they have no base value), per spec.
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
    try {
      const bs = getCharacterBlockStats(char);
      if (bs?.blockChance > 0) {
        const pct = `+${(bs.blockChance * 100).toFixed(1).replace(/\.0$/,'')}%`;
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
      const isFracPct = (key === 'goldFind' || key === 'xpFind' || key === 'critChance' || key === 'critDamage' || key === 'tradePrices') && Math.abs(v) <= 3;
      const isIntPct = (key === 'lifeSteal' || key === 'manaSteal');
      const disp = isFracPct
        ? `+${(v * 100).toFixed(1).replace(/\.0$/,'')}%`
        : isIntPct
          ? `+${(Math.round(v * 10) / 10)}%`
          : `+${Math.round(v * 100) / 100}`;
      otherRows.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="${label}">${label}</span><span class="sr-val" style="color:#6db3ff">${disp}</span></div>`);
    }
  }
  const otherHtml = otherRows.length
    ? otherRows.join('')
    : `<div class="stat-row"><span class="sr-label" style="color:#5a4a42;font-style:italic">None</span><span class="sr-val" style="color:#5a4a42">—</span></div>`;

  // ── Layout: Attributes (top, with spend buttons in Skills) →
  //              Derived Stats → Other Effects.
  // Inventory's existing layout puts the Derived block first then Attributes;
  // Skill Tree's spec calls for Attributes-with-+1-buttons at the top. To
  // satisfy both with one renderer, when withSpendButtons is true we hoist
  // Attributes to the top; when false (Wave 3 Inventory migration) we leave
  // the existing Derived-then-Attributes order to avoid a visual jump.
  const headerHtml = includeHeader
    ? `<div class="panel-label">${headerLabel}</div>`
    : '';
  // M408 — match the InventoryScreen "Show Base Attributes" button exactly:
  // a small auto-toggle button with a filled green pip when ON and a hollow
  // gold-outline circle when OFF. Replaces the previous large checkbox so
  // the Inventory and Attributes pages feel consistent.
  const baseToggleHtml = `<button type="button" class="auto-toggle stats-base-toggle${baseMode ? ' on' : ''}" id="${baseToggleId}" aria-pressed="${baseMode ? 'true' : 'false'}" title="Show base attributes (without item bonuses)">${baseMode ? '<span class="auto-check" aria-hidden="true">✓</span>' : '<span class="auto-check auto-off" aria-hidden="true">○</span>'}Show Base Attributes</button>`;
  const derivedHtml = `
    <div class="stat-row"><span class="sr-label stat-label" data-stat="HP">HP</span><span class="sr-val"${sc('hp', cur.hp, bas.hp)}>${Math.floor(cur.hp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Mana">Mana</span><span class="sr-val"${sc('mp', cur.mp, bas.mp)}>${Math.floor(cur.mp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Armor">Armor</span><span class="sr-val"${sc('armor', curArmor, baseArmor)}>${Math.floor(curArmor)}</span></div>
    <div class="stat-row" title="Armor ${(drCur.armorDr*100).toFixed(1)}% + Misc ${(drCur.miscDr*100).toFixed(1)}% (multiplicative)"><span class="sr-label stat-label" data-stat="Damage Reduction">Damage Reduction</span><span class="sr-val"${sc('dmgReduction', drCur.totalDr, drBase.totalDr)}>${(drCur.totalDr*100).toFixed(1)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Magic Resist">Magic Resist</span><span class="sr-val"${sc('magicResist', totalMagicResist, 0)}>${Math.floor(totalMagicResist)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Hit">Hit</span><span class="sr-val"${sc('hit', cur.hit, bas.hit)}>${Math.floor(cur.hit)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Dodge">Dodge</span><span class="sr-val"${sc('dodge', cur.dodge, bas.dodge)}>${Math.floor(cur.dodge)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="${dmgLabel}">${dmgLabel}</span><span class="sr-val"${sc('dmg', dmgRange[1], baseDmgRange[1])}>${Math.floor(dmgRange[0])}-${Math.floor(dmgRange[1])}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Spell Power">Spell Power</span><span class="sr-val"${sc('spellPower', cur.spl, bas.spl)}>+${Math.round(cur.spl * 100)}%</span></div>
  `;

  if (withSpendButtons) {
    return `
      ${headerHtml}
      ${baseToggleHtml}
      <div class="cs-stats-grid">
        <div class="cs-section cs-section-attrs">
          <div class="panel-label">Attributes</div>
          ${attrsHtml}
        </div>
        <div class="cs-section cs-section-derived">
          <div class="panel-label">Derived Stats</div>
          ${derivedHtml}
          <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
          ${otherHtml}
        </div>
      </div>
    `;
  }
  // Inventory-compatible (Derived first, Attributes second). Wave 3 may flip.
  return `
    ${headerHtml}
    ${baseToggleHtml}
    <div class="cs-stats-grid">
      <div class="cs-section cs-section-derived">
        ${derivedHtml}
      </div>
      <div class="cs-section cs-section-attrs">
        <div class="panel-label">Attributes</div>
        ${attrsHtml}
        <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
        ${otherHtml}
      </div>
    </div>
  `;
}
