/**
 * FormulaCodexScreen (M85) — player-facing wiki / knowledge base.
 *
 * Pulls every formula from src/game/formulas.js and renders both the
 * symbolic form and a live worked example using the current party.
 * Sections are rendered as tabs; per-stat detail pages are auto-derived
 * from each formula's `.inputs` metadata — new formulas show up
 * automatically, never hand-maintained.
 *
 * Styling matches CombatSimulatorScreen's dark-gold tone.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import {
  getAllFormulas, getFormulasUsingStat,
  computeHeroArmor, computeHeroEquipDmgBonus, computeHeroDamage,
  computeHeroHit, computeHeroDodge, computeHeroInitiative,
  rollToHit, applyMitigation, applyBlock, getCharacterBlockStats,
  computeMaxHp, computeMaxMp, computeGoldReward, computeXpReward,
  enemyScalingForNgPlus, computeDamageReduction,
  computeSpellDamage, computeCritChance, computeCritDamage,
} from '../../game/formulas.js';
import { getEquipmentAffixBonuses as _getEquipmentAffixBonuses } from '../../game/equipBonuses.js';
import { FAME_THRESHOLDS } from '../../game/fame.js';
import { BOSS_PHASES } from '../../game/bossPhases.js';
import { CHAMPION_MODIFIERS } from '../../game/championModifiers.js';

const STATS = ['STR', 'DEX', 'INT', 'CON'];

// ---------------------------------------------------------------------------
// Party context — grabs the first hero, or a synthetic fallback.
// ---------------------------------------------------------------------------
export function getCurrentPartyContext() {
  try {
    const party = (GameState.getParty && GameState.getParty()) || [];
    if (party.length) {
      const hero = party[0];
      return {
        name: hero.name || 'Hero',
        cls: hero.cls || hero.className || '',
        level: hero.level || 1,
        stats: {
          STR: (hero.attrs && hero.attrs.STR) || 10,
          DEX: (hero.attrs && hero.attrs.DEX) || 10,
          INT: (hero.attrs && hero.attrs.INT) || 10,
          CON: (hero.attrs && hero.attrs.CON) || 10,
        },
        equipment: hero.equipment || {},
        passives: hero.passives || {},
        isCompanion: false,
      };
    }
  } catch (_) { /* fall through */ }
  return {
    name: 'Training Dummy',
    cls: 'warrior',
    level: 1,
    stats: { STR: 10, DEX: 10, INT: 10, CON: 10 },
    equipment: {},
    passives: {},
    isCompanion: false,
  };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
const SECTIONS = [
  { id: 'combat',    label: 'Combat Math' },
  { id: 'dmgtypes',  label: 'Damage Types' },
  { id: 'armor',     label: 'Armor & Resist' },
  { id: 'block',     label: 'Block (Shields)' },
  { id: 'healing',   label: 'Healing & Spell Power' },
  { id: 'skills',    label: 'Skill Checks' },
  { id: 'rewards',   label: 'Rewards' },
  { id: 'scaling',   label: 'Enemy Scaling' },
  { id: 'status',    label: 'Status Effects' },
  { id: 'advanced',  label: 'Advanced Systems' },
  { id: 'stats',     label: 'Stats (STR/DEX/INT/CON)' },
];

export class FormulaCodexScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this._el = null;
    this._section = 'combat';
    this._selectedStat = 'STR';
    this._tooltip = null;
    this._tooltipSticky = false;
  }

  onEnter() {
    this._ctx = getCurrentPartyContext();
    this._build();
    this._altHandler = (e) => { if (e.code === 'AltLeft' || e.code === 'AltRight') this._tooltipSticky = true; };
    this._altUpHandler = (e) => { if (e.code === 'AltLeft' || e.code === 'AltRight') this._tooltipSticky = false; };
    window.addEventListener('keydown', this._altHandler);
    window.addEventListener('keyup', this._altUpHandler);
  }
  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = 'flex'; }
  onExit() {
    window.removeEventListener('keydown', this._altHandler);
    window.removeEventListener('keyup', this._altUpHandler);
    this._hideTooltip();
    removeEl(this._el);
    this._el = null;
  }
  destroy() { this.onExit(); }
  update() {}
  draw() {}

  _build() {
    injectStyles('formula-codex-styles', `
      .fcod-screen {
        position: absolute; inset: 0;
        background: rgba(5,2,8,0.97);
        color: #e8d8b8;
        display: flex; flex-direction: column;
        font-family: 'Inter', system-ui, sans-serif;
        overflow: hidden;
      }
      .fcod-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.8rem 1rem 0.5rem;
        border-bottom: 1px solid rgba(232,160,32,0.3);
        flex-shrink: 0;
      }
      .fcod-title {
        font-family: 'Cinzel', Georgia, serif;
        font-size: 1.15rem; color: #e8a020;
        letter-spacing: 0.12em;
      }
      .fcod-ctx {
        font-size: 0.65rem; color: #a89888; letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .fcod-close {
        background: rgba(232,160,32,0.12); border: 1px solid rgba(232,160,32,0.5);
        color: #e8a020; padding: 0.5rem 0.8rem; border-radius: 4px;
        font-size: 0.75rem; letter-spacing: 0.1em; cursor: pointer;
        font-family: inherit; min-height: 40px; min-width: 44px;
      }
      .fcod-tabs {
        display: flex; gap: 0; overflow-x: auto;
        border-bottom: 1px solid rgba(232,160,32,0.2);
        flex-shrink: 0; -webkit-overflow-scrolling: touch;
      }
      .fcod-tab-select {
        display: none;
        width: 100%; background: rgba(20,14,8,0.95);
        border: none; border-bottom: 2px solid rgba(232,160,32,0.4);
        color: #e8a020; padding: 0.75rem 1rem;
        font-family: 'Cinzel', Georgia, serif; font-size: 0.78rem;
        letter-spacing: 0.08em; cursor: pointer;
        flex-shrink: 0; -webkit-appearance: none; appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23e8a020' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 0.75rem center;
        padding-right: 2.5rem; min-height: 44px;
      }
      @media (max-width: 700px) {
        .fcod-tabs { display: none; }
        .fcod-tab-select { display: block; }
      }
      .fcod-tab {
        padding: 0.65rem 0.85rem;
        background: none; border: none; border-bottom: 2px solid transparent;
        font-family: 'Cinzel', Georgia, serif;
        font-size: 0.7rem; color: rgba(200,180,140,0.65);
        letter-spacing: 0.1em; text-transform: uppercase;
        cursor: pointer; white-space: nowrap;
        min-height: 44px;
      }
      .fcod-tab.active { color: #e8a020; border-bottom-color: #e8a020; }
      .fcod-body {
        flex: 1; overflow-y: auto; padding: 1rem;
        -webkit-overflow-scrolling: touch;
      }
      .fcod-section h3 {
        font-family: 'Cinzel', Georgia, serif;
        color: #e8a020; margin: 0.2rem 0 0.4rem;
        font-size: 1rem; letter-spacing: 0.08em;
      }
      .fcod-section p { font-size: 0.85rem; line-height: 1.55; color: rgba(230,220,200,0.9); margin: 0.4rem 0 0.8rem; }
      .fcod-section ul {
        padding-left: 1.2em;
        margin-block-start: 0.4rem;
        margin-block-end: 0.8rem;
        font-size: 0.85rem; line-height: 1.55;
        color: rgba(230,220,200,0.9);
      }
      .fcod-section ul > li {
        margin-bottom: 0.35rem;
      }
      .fcod-section ul > li button,
      .fcod-section ul > li .fcod-stat-ref {
        margin: 0;
      }
      .fcod-formula {
        background: rgba(20,10,15,0.85);
        border: 1px solid rgba(232,160,32,0.3);
        border-radius: 5px;
        padding: 0.65rem 0.8rem;
        margin-bottom: 0.7rem;
      }
      .fcod-formula .fname {
        font-family: 'Cinzel', Georgia, serif;
        font-size: 0.8rem; color: #e8a020;
        letter-spacing: 0.06em;
      }
      .fcod-formula .fexpr {
        display: block; font-family: 'Courier New', monospace;
        font-size: 0.72rem; color: #cbb48c; margin-top: 0.3rem;
        word-break: break-word;
      }
      .fcod-formula .flive {
        display: block; font-size: 0.72rem; color: #80c080;
        margin-top: 0.3rem;
      }
      .fcod-formula .finputs {
        display: block; font-size: 0.65rem; color: #7a6a5a; margin-top: 0.25rem;
      }
      .fcod-pill {
        display: inline-block; padding: 0.1rem 0.4rem; border-radius: 10px;
        font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase;
        margin-left: 0.4rem;
      }
      .fcod-pill.wired { background: rgba(80,180,80,0.2); color: #90d890; border: 1px solid rgba(80,180,80,0.5); }
      .fcod-pill.stub  { background: rgba(200,100,60,0.2); color: #f0a070; border: 1px solid rgba(200,100,60,0.5); }
      .fcod-pill.soon  { background: rgba(120,120,180,0.2); color: #b0b0e8; border: 1px solid rgba(120,120,180,0.5); }
      .fcod-stat-links { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
      .fcod-stat-link {
        background: rgba(232,160,32,0.12); border: 1px solid rgba(232,160,32,0.5);
        color: #e8a020; padding: 0.45rem 0.9rem; border-radius: 4px;
        font-family: inherit; font-size: 0.75rem; letter-spacing: 0.1em;
        cursor: pointer; min-height: 40px;
      }
      .fcod-stat-link.active { background: rgba(232,160,32,0.32); }
      .fcod-stat-ref {
        text-decoration: underline dotted; cursor: pointer; color: #e8c060;
      }
      .fcod-tooltip {
        position: absolute; background: rgba(10,6,12,0.97);
        border: 1px solid rgba(232,160,32,0.6); border-radius: 6px;
        padding: 0.7rem 0.9rem 0.6rem; max-width: 280px; z-index: 2000;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.75rem; color: #e8d8b8;
      }
      .fcod-tooltip .tt-x {
        position: absolute; top: 2px; right: 4px;
        background: none; border: none; color: #a89888;
        font-size: 1rem; cursor: pointer; line-height: 1;
        padding: 4px 8px;
      }
      .fcod-tooltip h4 {
        margin: 0 0 0.3rem; color: #e8a020;
        font-family: 'Cinzel', Georgia, serif; font-size: 0.85rem;
      }
      .fcod-tooltip a { color: #80c080; cursor: pointer; text-decoration: underline; }
    `);

    this._el = createEl('div', 'fcod-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();

    // Global dismiss (except ALT-sticky).
    this._dismissHandler = (e) => {
      if (!this._tooltip) return;
      if (this._tooltipSticky) return;
      if (e.target.closest('.fcod-tooltip')) return;
      if (e.target.closest('.fcod-stat-ref')) return;
      this._hideTooltip();
    };
    document.addEventListener('click', this._dismissHandler, true);
  }

  _render() {
    const ctx = this._ctx;
    this._el.innerHTML = `
      <div class="fcod-header">
        <div>
          <div class="fcod-title">✦ Codex</div>
          <div class="fcod-ctx">Live: ${ctx.name} · ${ctx.cls || 'hero'} · lvl ${ctx.level} · STR ${ctx.stats.STR} DEX ${ctx.stats.DEX} INT ${ctx.stats.INT} CON ${ctx.stats.CON}</div>
        </div>
        <button type="button" class="fcod-close" id="fcod-close">✕</button>
      </div>
      <select class="fcod-tab-select" id="fcod-tab-select" aria-label="Select section">
        ${SECTIONS.map(s => `<option value="${s.id}"${this._section === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}
      </select>
      <div class="fcod-tabs">
        ${SECTIONS.map(s => `<button type="button" class="fcod-tab${this._section === s.id ? ' active' : ''}" data-sec="${s.id}">${s.label}</button>`).join('')}
      </div>
      <div class="fcod-body" id="fcod-body"></div>
    `;
    this._renderSection();

    this._el.querySelector('#fcod-close').addEventListener('click', () => {
      this.audio && this.audio.playSfx && this.audio.playSfx('click');
      this.manager.pop();
    });
    this._el.querySelector('#fcod-tab-select')?.addEventListener('change', (e) => {
      this._section = e.target.value;
      this._render();
    });
    this._el.querySelectorAll('.fcod-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._section = btn.dataset.sec;
        this._render();
      });
    });
    this._wireStatRefs();
  }

  _wireStatRefs() {
    const refs = this._el.querySelectorAll('.fcod-stat-ref');
    refs.forEach(r => {
      r.addEventListener('click', (e) => {
        e.stopPropagation();
        const stat = r.dataset.stat;
        // First tap/click: show tooltip. If already showing same stat, jump to detail page.
        if (this._tooltip && this._tooltip._stat === stat) {
          this._hideTooltip();
          this._section = 'stats';
          this._selectedStat = stat;
          this._render();
          return;
        }
        this._showStatTooltip(stat, r);
      });
    });
  }

  _showStatTooltip(stat, anchor) {
    this._hideTooltip();
    const defs = {
      STR: 'Strength — drives physical damage, melee scaling, and carry capacity.',
      DEX: 'Dexterity — drives hit chance, dodge, and initiative (turn order).',
      INT: 'Intelligence — drives magic damage, spell power, and mana pool.',
      CON: 'Constitution — drives max HP and resistance to physical wear.',
    };
    const tip = createEl('div', 'fcod-tooltip');
    tip._stat = stat;
    tip.innerHTML = `
      <button class="tt-x" type="button">✕</button>
      <h4>${stat}</h4>
      <div>${defs[stat] || stat}</div>
      <div style="margin-top:0.5rem"><a data-nav="${stat}">Tap again to view all formulas using ${stat} →</a></div>
      <div style="margin-top:0.3rem;font-size:0.65rem;color:#7a6a5a">Hold ALT to keep open</div>
    `;
    document.body.appendChild(tip);
    const rect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
    if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 6;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top  = Math.max(8, top)  + 'px';
    this._tooltip = tip;
    tip.querySelector('.tt-x').addEventListener('click', (e) => {
      e.stopPropagation();
      this._hideTooltip();
    });
    tip.querySelector('[data-nav]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._hideTooltip();
      this._section = 'stats';
      this._selectedStat = stat;
      this._render();
    });
  }

  _hideTooltip() {
    if (this._tooltip) {
      try { this._tooltip.remove(); } catch (_) {}
      this._tooltip = null;
    }
  }

  // Builds a stat-ref span so users can hover/tap to navigate.
  _statRef(stat) {
    return `<span class="fcod-stat-ref" data-stat="${stat}">${stat}</span>`;
  }

  _renderSection() {
    const body = this._el.querySelector('#fcod-body');
    const ctx = this._ctx;
    const S = this._section;
    let html = '';

    if (S === 'combat') {
      const heroHit = computeHeroHit(ctx.stats);
      const heroDodge = computeHeroDodge(ctx.stats, false);
      const equipBonus = computeHeroEquipDmgBonus(ctx.equipment);
      // M95: show all three weapon-category damage ranges so the player sees
      // what their STR/DEX/INT would produce with a heavy, light, or magic weapon.
      const dmgHeavy = computeHeroDamage(ctx.stats, equipBonus, 'heavy');
      const dmgLight = computeHeroDamage(ctx.stats, equipBonus, 'light');
      const dmgMagic = computeHeroDamage(ctx.stats, equipBonus, 'magic');
      const sampleTarget = { hit: 60, dodge: 10, armor: 3 };
      const hc = rollToHit({ hit: heroHit, dodge: heroDodge }, sampleTarget);
      html += `<div class="fcod-section">
        <h3>Combat Math</h3>
        <p>Every attack resolves in this order: <b>hit roll → block (shields) → mitigation → HP</b>. Your ${this._statRef('DEX')} drives hit and dodge. Basic-attack damage depends on the <b>weapon category</b>:</p>
        <ul>
          <li><b>Damage Heavy</b> (swords, axes, hammers, greatswords) — weapon damage roll, heavy category.</li>
          <li><b>Damage Light</b> (daggers, rapiers, bows, spears, javelins, crossbows) — weapon damage roll, light category.</li>
          <li><b>Magic</b> (wands, staves, orbs, tomes) — weapon damage roll, magic category, with a spell-power bonus on top. ${this._statRef('INT')} raises spell power but is no longer the base scalar.</li>
        </ul>
        ${this._fBox('computeHeroHit', computeHeroHit, `min(95, 70 + round(${ctx.stats.DEX}*1.2)) = ${heroHit}`)}
        ${this._fBox('computeHeroDodge', computeHeroDodge, `min(40, 5 + round(${ctx.stats.DEX}*0.8)) = ${heroDodge}`)}
        ${this._fBox('computeHeroDamage', computeHeroDamage, `heavy=[${dmgHeavy[0]},${dmgHeavy[1]}] &nbsp; light=[${dmgLight[0]},${dmgLight[1]}] &nbsp; magic=[${dmgMagic[0]},${dmgMagic[1]}] &nbsp; (equipBonus=${equipBonus})`)}
        ${this._fBox('computeHeroInitiative', computeHeroInitiative, `${ctx.stats.DEX} + ${ctx.level} = ${computeHeroInitiative(ctx.stats, ctx.level)}`)}
        ${this._fBox('rollToHit', rollToHit, `For ${ctx.name} (hit ${heroHit}) vs sample goblin (dodge 10) = <b>${hc}%</b> to hit.`)}
        <h3 style="margin-top:1rem">Critical Hits</h3>
        <p>Crit chance and crit damage come only from <b>item affixes</b> and <b>passive skill nodes</b> — never from base attributes (${this._statRef('STR')}, ${this._statRef('DEX')}, ${this._statRef('INT')}, ${this._statRef('CON')}). On a successful hit, roll against the attacker's crit chance; if it passes, multiply final damage by <code>(1.5 + critDamage)</code>.</p>
        <p>Default enemy crit chance: <b>5%</b> at the base <b>1.5×</b> multiplier. Heroes start at 0% crit chance and earn it through <code>critChance</code> / <code>critDamage</code> affix rolls on gear and through tree passives such as Exposed Vitals, Weakpoint Seer, and Decisive Blow.</p>
        ${this._fBox('rollCrit', null, 'rand() < attacker.critChance → boolean')}
        ${this._fBox('applyCritMultiplier', null, 'dmg * (1.5 + attacker.critDamage) — applied after block + mitigation')}
        <p style="font-size:0.7rem;color:#7a6a5a">Implementation note: <code>rollCrit(attacker)</code> and <code>applyCritMultiplier(dmg, attacker)</code> will be registered in <code>src/game/formulas.js</code> once the crit-affix pass lands, at which point they appear in the Stats tab automatically. Until then this page documents the intended contract.</p>
      </div>`;
    }
    else if (S === 'dmgtypes') {
      html += `<div class="fcod-section">
        <h3>Damage Types</h3>
        <p><b>Physical</b> — mitigated by armor. Driven by weapon damage roll (heavy or light category).</p>
        <p><b>Magic</b> — mitigated by magic resist. Driven by weapon damage roll (magic category) plus spell-power bonus scaled from ${this._statRef('INT')}.</p>
        <p><b>True</b> — bypasses all mitigation. Rare/special.</p>
        ${this._fBox('applyMitigation', applyMitigation,
          `phys 30 vs armor 10 = ${applyMitigation(30, { armor: 10, magicResist: 5 }, { type: 'physical' })}; ` +
          `magic 30 vs MR 5 = ${applyMitigation(30, { armor: 10, magicResist: 5 }, { type: 'magic' })}; ` +
          `true 30 = ${applyMitigation(30, { armor: 10, magicResist: 5 }, { type: 'true' })}`)}
      </div>`;
    }
    else if (S === 'armor') {
      const sample = applyMitigation(30, { armor: 10 }, { type: 'physical' });
      const drSample = computeDamageReduction(20, 0);
      html += `<div class="fcod-section">
        <h3>Armor &amp; Magic Resist</h3>
        <p>Physical damage is reduced by the curve-DR formula (active since M207): <code>armorDr = min(cap, armor / (armor + k))</code> where <strong>k = 100</strong> and <strong>cap = 95%</strong>. This means armor has strong diminishing returns — stacking armor beyond ~200 yields very small gains. Magic damage uses flat magic-resist subtraction.</p>
        <p>Armor Penetration (armorPen affix) subtracts flat from the target's effective armor before the curve is applied.</p>
        ${this._fBox('computeDamageReduction', computeDamageReduction, `armor 20 → armorDr = min(0.95, 20/120) = ${(drSample.armorDr*100).toFixed(1)}%; totalDr = ${(drSample.totalDr*100).toFixed(1)}%`)}
        ${this._fBox('applyMitigation', applyMitigation, `raw 30 vs armor 10 (phys, curve-dr) → ${sample}; vs MR 5 (magic, flat) → ${applyMitigation(30, { magicResist: 5 }, { type: 'magic' })}`)}
        <p><b>Penetration:</b> <code>eff = armor * (1 - armorPenPct) - armorPen</code>, clamped to 0, then curve applied. The <code>armorPenPct</code> path is reserved for legendary/unique affixes.</p>
        <p>Fully absorbed hits (final dmg 0): physical → logs <em>deflected</em>; magic → logs <em>resisted</em>.</p>
      </div>`;
    }
    else if (S === 'block') {
      const sampleBlock = applyBlock(30, { blockPower: 20 });
      html += `<div class="fcod-section">
        <h3>Block (Shields)</h3>
        <p>Shields roll <b>block_chance</b> and <b>block_power</b> affixes (100% roll on shields). Pipeline: dodge → block → armor/resist → HP.</p>
        ${this._fBox('rollBlock', null, 'rand() < target.blockChance')}
        ${this._fBox('applyBlock', applyBlock, `raw 30 − blockPower 20 = ${sampleBlock}`)}
        ${this._fBox('getCharacterBlockStats', getCharacterBlockStats, 'scans equipped shields for block affixes')}
      </div>`;
    }
    else if (S === 'healing') {
      const maxHp = computeMaxHp({ attrs: ctx.stats, passives: ctx.passives });
      const maxMp = computeMaxMp({ attrs: ctx.stats, passives: ctx.passives });
      const sp = +((ctx.stats.INT * 0.025).toFixed(2));
      html += `<div class="fcod-section">
        <h3>Healing & Spell Power</h3>
        <p>${this._statRef('INT')} drives spell power and mana pool. ${this._statRef('CON')} drives max HP.</p>
        ${this._fBox('computeMaxHp', computeMaxHp, `50 + ${ctx.stats.CON}*10 + passives = <b>${maxHp}</b>`)}
        ${this._fBox('computeMaxMp', computeMaxMp, `30 + ${ctx.stats.INT}*8 + passives = <b>${maxMp}</b>`)}
        <p><b>Spell Power multiplier (M116):</b> <code>spellPower = INT * 0.025</code>. Current: INT ${ctx.stats.INT} &rarr; <b>+${sp}</b>. Applied to every spell damage skill and heal: <code>dmg = round((baseRoll*mult + stat*0.2) * (1 + spellPower + potency))</code>. The <b>Potency</b> affix on magic weapons &amp; amulets adds +5%..+15% spell damage (stored as fraction, M181).</p>
        <p><b>Multi-target falloff (M116):</b> AoE skills scale damage per target: 1&rarr;100%, 2&rarr;80%, 3&rarr;60%, 4+&rarr;50%. Applies to both physical and magical AoE.</p>
        <p><b>Crit (M116):</b> base 5% chance &times; 1.5 multiplier. <b>Deadly</b> (critChance) and <b>Savage</b> (critDamage) roll on weapons / gloves / amulets. <code>critPct = min(75, 5 + passiveCrit + critChance*100)</code>, <code>critMult = 1.5 + critDamage</code>. The <b>Sharp</b> affix is <i>physical-only</i> — magic weapons ignore it.</p>
        <p>Heal spells: <code>scaledHeal = round(healMult * INT * (1 + spellPower))</code>.</p>
      </div>`;
    }
    else if (S === 'skills') {
      html += `<div class="fcod-section">
        <h3>Skill Checks</h3>
        <p><b>Emberveil skill checks are minimum stat requirements.</b> They are deterministic — no randomness, no chance-based outcome. If a dialog option reads <code>[12 STR] Break the chains</code>, it succeeds if and only if at least one party hero has ${this._statRef('STR')} &ge; 12.</p>
        <p><b>How it works:</b></p>
        <p>• The check reads the highest current stat among your heroes (after equipment and passives).<br>
           • If <code>maxHeroStat &ge; threshold</code>, the option is <b>enabled and guaranteed to succeed</b>.<br>
           • Otherwise the option is <b>greyed out and cannot be attempted</b>.<br>
           • Companions do <b>not</b> count toward skill checks — heroes only.<br>
           • Thresholds scale with the zone's expected level, not by NG+.</p>
        <p><b>Design intent:</b> skill checks reward party building and stat investment. Outcomes are fully determined by your party's stats at the moment of the check — there is no hidden variance to retry against.</p>
        <p>Checks currently use ${this._statRef('STR')}, ${this._statRef('DEX')}, ${this._statRef('INT')}, and ${this._statRef('CON')}. See <code>src/game/skillChecks.js</code> and <code>memory/m83_rebalance_plan.md</code> for the full list.</p>
      </div>`;
    }
    else if (S === 'rewards') {
      // Pull the live party so we can show the player's current gold / xp +
      // their current goldFind / xpFind bonus from equipped gear.
      let partyGold = 0, partyXp = 0, heroName = ctx.name, heroXpToNext = 0;
      let party = [];
      try {
        party = (GameState.getParty && GameState.getParty()) || [];
        const state = GameState.get && GameState.get();
        if (state) {
          partyGold = state.gold || 0;
        }
        if (party.length) {
          const hero = party.find(m => !m.isCompanion) || party[0];
          heroName = hero.name || heroName;
          partyXp = hero.xp || 0;
          heroXpToNext = hero.xpToNext || hero.nextLevelXp || 0;
        }
      } catch (_) { /* no active run */ }
      const heroes = party.filter(m => !m.isCompanion);
      let goldFindSum = 0, xpFindSum = 0;
      try {
        for (const h of heroes) {
          const a = _getEquipmentAffixBonuses(h) || {};
          goldFindSum += a.goldFind || 0;
          xpFindSum += a.xpFind || 0;
        }
      } catch (_) { /* ignore */ }
      const gold = computeGoldReward({ gold: [5, 15] }, heroes.length ? heroes : [], () => 0.5);
      const sampleXp = computeXpReward({ xpValue: 25 }, heroes.length ? heroes : []);
      const pct = (n) => `${Math.round(n * 100)}%`;
      html += `<div class="fcod-section">
        <h3>Rewards</h3>
        <p><b>Current party:</b> ${partyGold} gold · ${heroName} ${partyXp}${heroXpToNext ? ` / ${heroXpToNext}` : ''} xp · goldFind +${pct(goldFindSum)} · xpFind +${pct(xpFindSum)}</p>
        ${this._fBox('computeGoldReward', computeGoldReward,
          `enemy.gold[5..15] mid-roll × (1 + ${pct(goldFindSum)}) → ${gold}`,
          `<span class="fcod-pill wired">goldFind wired</span>`)}
        ${this._fBox('computeXpReward', computeXpReward,
          `enemy.xpValue 25 × (1 + ${pct(xpFindSum)}) → ${sampleXp}`,
          `<span class="fcod-pill wired">xpFind wired</span>`)}
        <p><b>goldFind / xpFind</b> — summed across hero equipment (companions excluded). Both are applied inside <code>formulas.js</code> so rewards everywhere honor them automatically.</p>
        <p><b>Drop rates</b> — per-item rarity rolls in <code>items.js</code>; no single formula yet.</p>
      </div>`;
    }
    else if (S === 'scaling') {
      const sample = enemyScalingForNgPlus({ hp: 40, dmg: [4, 9], armor: 3, hit: 60, dodge: 10, xpValue: 25, isBoss: false }, 1);
      const sampleBoss = enemyScalingForNgPlus({ hp: 800, dmg: [40, 70], armor: 12, hit: 80, dodge: 8, xpValue: 600, isBoss: true }, 1);
      html += `<div class="fcod-section">
        <h3>Enemy Scaling — Role &amp; Tier × NG+</h3>
        <p><b>Tier curve.</b> Enemies are grouped by tier — <b>trash</b>, <b>elite</b>, <b>miniboss</b>, <b>boss</b> — with per-act baselines defined in <code>mapData.js</code>. Boss-tier enemies receive a separate scaling track on NG+ (see <code>balance.json</code> → <code>enemies.ngPlus.hpBossMult</code> and <code>dmgBossMult</code>).</p>
        <p><b>Role curve.</b> Each enemy's <code>role</code> (tank / dps / caster / support) shifts the <i>shape</i> of its scaling: tanks scale HP harder than damage, casters scale damage and magic resist, etc. The role channel is encoded directly in the per-enemy stats in <code>mapData.js</code> (HP / armor / damage tuned by hand to fit the role) and reinforced by skill rosters (<code>spellList</code>, <code>statusOnHit</code>).</p>
        ${this._fBox('enemyScalingForNgPlus', enemyScalingForNgPlus,
          `regular goblin @ NG+1 → hp ${sample.hp}, dmg [${sample.dmg[0]}, ${sample.dmg[1]}], armor ${sample.armor}, hit ${sample.hit}, dodge ${sample.dodge}, xp ${sample.xpValue}<br>` +
          `boss @ NG+1 → hp ${sampleBoss.hp}, dmg [${sampleBoss.dmg[0]}, ${sampleBoss.dmg[1]}], armor ${sampleBoss.armor}, hit ${sampleBoss.hit}, dodge ${sampleBoss.dodge}, xp ${sampleBoss.xpValue}`)}
        <p><b>Global multiplier.</b> A single <code>enemies.globalMultipliers</code> bundle in <code>balance.json</code> scales HP / damage / armor / hit / dodge across <i>every</i> enemy. Current values: HP ×2.0, DMG ×1.3, ARM ×1.0, HIT ×1.0, DDG ×1.0 (M315 rebalance).</p>
      </div>`;
    }
    else if (S === 'status') {
      html += `<div class="fcod-section">
        <h3>Status Effects</h3>
        <p><b>Bleed</b> — ticks each round for a duration set per skill (e.g. Gashing Edge: 2 rounds; Whirlwind Serrated Blade: 3 rounds).</p>
        <p><b>Burn</b> — magic-damage tick from fire spells. INT scales tick power.</p>
        <p><b>Poison</b> — stacking tick over duration (rogue/ranger skill trees).</p>
        <p><b>Stun</b> — skip-turn, single-round default; some ultimates extend. <b>Stun immunity (M134):</b> after a stun expires, the target is immune for <code>2 + priorStunCount</code> rounds. Each additional stun applied to the same target extends immunity further, so chain-stun has steep diminishing returns.</p>
        <p>Exact duration + power are defined per-skill in <code>src/game/skills.js</code>. No global tick formula yet — a planned refactor will move these into formulas.js so they appear here automatically.</p>
      </div>`;
    }
    else if (S === 'advanced') {
      // Fame thresholds
      const fameTiers = FAME_THRESHOLDS.map(t =>
        `${t.fame} fame → +${t.extra} extra appearance/weapon-variety slot${t.extra > 1 ? 's' : ''} per class`
      ).join('; ');

      // Boss phase thresholds — enumerate all registered bosses
      const bossEntries = Object.entries(BOSS_PHASES).map(([bossId, def]) => {
        const phases = (def.phases || []).map((p, i) =>
          `Phase ${i + 1} at &lt;${Math.round(p.hpThreshold * 100)}% HP`
          + (p.name ? ` (${p.name})` : '')
          + (p.onEnter ? `: "${p.onEnter.substring(0, 60)}${p.onEnter.length > 60 ? '…' : ''}"` : '')
        ).join('; ');
        return `<li><b>${bossId}</b>: ${phases || 'no phases'}</li>`;
      }).join('');

      // Champion modifier stat bumps
      const champMods = Object.values(CHAMPION_MODIFIERS).map(m => {
        const mods = m.statMods ? Object.entries(m.statMods).map(([k, v]) =>
          `${k} ×${v}`).join(', ') : 'no stat mods (special ability)';
        return `<li><b>${m.name}</b>: ${mods} — ${m.desc}</li>`;
      }).join('');

      html += `<div class="fcod-section">
        <h3>Critical Chance &amp; Damage</h3>
        ${this._fBox('computeCritChance', computeCritChance,
          `min(75, 5 + passive.critBonus + affix.critChance*100) [%]`)}
        ${this._fBox('computeCritDamage', computeCritDamage,
          `1.5 + affix.critDamage [multiplier applied to post-block/mitigation damage]`)}
        <p>Base crit chance: <b>5%</b>, cap: <b>75%</b>. Crit damage base: <b>1.5x</b>. Both scale only through item affixes (<code>critChance</code>, <code>critDamage</code>) and passive talents. Applied after armor/block mitigation, not before.</p>

        <h3>Dodge Calculation</h3>
        ${this._fBox('computeHeroDodge', computeHeroDodge,
          `min(40, 5 + round(DEX * 0.8)) — cap 40%`)}
        <p>Enemy base dodge is defined per-enemy in mapData. Champion "fast" modifier grants +50% initiative, not raw dodge. Dodge roll: <code>rand() &gt; hitChance * (1 - dodgeChance)</code>.</p>

        <h3>Attack &amp; Spell Damage</h3>
        ${this._fBox('computeHeroDamage', computeHeroDamage,
          `heavy: [STR*0.8, STR*1.2]; light: [DEX*0.7, DEX*1.1]; magic: [INT*0.6, INT+round(INT*0.5)] (wands add spell-power bonus)`)}
        ${this._fBox('computeSpellDamage', computeSpellDamage,
          `round((baseRoll * damageMult + stat * 0.2) * (1 + spellPower + potency)) — per-target before AoE falloff`)}
        <p>AoE falloff: 1 target = 100%, 2 = 80%, 3 = 60%, 4+ = 50%. Applied after the damage roll, before armor.</p>

        <h3>Status Effect Duration Scaling</h3>
        <p>Status durations are defined per-skill in <code>src/game/skills.js</code> (e.g. Bleed: 2 rounds; Whirlwind Serrated Blade: 3 rounds). They are fixed values — no stat scales them. <b>Stun immunity:</b> after a stun expires, the target is immune for <code>2 + priorStunCount</code> rounds — chain stun yields steep diminishing returns. Fury/burn/poison stacks: each application adds duration or stacks power (see <code>src/game/statusEffects.js</code>).</p>

        <h3>XP Catch-Up Mechanic (M314)</h3>
        <p>When a party member's level is below the party-average level, they receive bonus XP from every combat. The multiplier is:</p>
        <p><code>mult = min(3, 1 + 0.5 * (partyAvgLevel - memberLevel))</code></p>
        <p>Examples: 1 level behind = <b>1.5x XP</b>; 2 behind = <b>2x</b>; 4+ behind = <b>3x</b> (cap). Members at or above average receive no bonus (1x). Party average includes all heroes currently in the party. The multiplier is shown next to level-up messages on the victory screen when it applies.</p>

        <h3>Combat Balance Targets (M315)</h3>
        <p>Design targets for a <b>well-geared, full party</b> in each act — measured as party HP lost per fight (percentage of total party max HP):</p>
        <ul>
          <li><b>Act 1</b> (regular fights): party wins &ge;85% of fights, loses 10–25% HP per fight. Boss: 20–40% HP lost.</li>
          <li><b>Act 2</b> (regular fights): 80–90% win rate, 15–30% HP per fight. Boss: 30–50% HP lost.</li>
          <li><b>Act 3</b> (regular fights): 75–90% win rate, 20–35% HP per fight. Boss: 35–55% HP lost.</li>
          <li><b>Act 4</b> (regular fights): 70–85% win rate, 25–40% HP per fight. Boss: 40–60% HP lost.</li>
          <li><b>Act 5</b> (regular fights): 60–80% win rate, 30–55% HP per fight. Boss: 45–65% HP lost.</li>
        </ul>
        <p>Benchmark metric: <b>damage dealt vs damage received</b> — not rounds-to-kill. Enemies must deal meaningful HP damage to create resource pressure and meaningful decisions around healing/positioning. A fight where the party takes 0% HP is a failed tuning case regardless of how many rounds it lasts.</p>
        <p>M315 levers adjusted: enemy global damage mult 1.0&rarr;1.3 (balance-loader.js); Act 5 base enemy HP &times;2, damage &times;1.6; Act 4 HP &times;1.5, damage &times;1.4; Act 3 HP &times;1.5, damage &times;1.4; Act 1–2 HP &times;1.3. Reality Shard stun chance 20%&rarr;10%. Backstab Assassinate damageMult 3.20&rarr;2.50.</p>

        <h3>Fame Thresholds (M308)</h3>
        <p>Fame unlocks extra appearance and starting-weapon variety slots per class. Threshold map:</p>
        <ul>${FAME_THRESHOLDS.map(t => `<li><b>${t.fame} fame</b>: +${t.extra} extra slot${t.extra > 1 ? 's' : ''}</li>`).join('')}</ul>
        <p>Base slots (no fame required): 5 appearances + 3 weapon varieties per class. Max extra = 5.</p>

        <h3>Legendary Effect Activation (M305)</h3>
        <p>Legendary effects on <b>item sets</b> activate when <code>piecesEquipped &gt;= legendaryEffect.activationPieces</code> (defaults to <code>set.pieces</code> if not specified — full completion). On <b>unique items</b> a legendary effect is always active while equipped — no threshold needed. Effects are event-driven (on-kill, on-hit, on-cast, etc.) and are listed on the item tooltip under the "Legendary" header.</p>

        <h3>Set Bonuses (M305)</h3>
        <p>Item sets grant cumulative bonuses as more pieces are equipped. Schema: <code>partialBonuses['N']</code> where N is the count threshold (e.g. <code>'2'</code>, <code>'3'</code>). Each key provides a stat object additive with character stats. Low-tier sets require 2 pieces; mid-tier require 3; endgame sets require 4–5. A set's legendary effect is governed by <code>activationPieces</code> (see above).</p>

        <h3>Boss Phase Thresholds (M304)</h3>
        <p>Bosses can declare a <code>phases</code> array with <code>hpThreshold</code> values (0–1 fraction of max HP). When the boss's current HP drops <b>below</b> a threshold for the first time, the phase transition fires: emits a log message, optionally swaps or appends spells, and applies transition statuses (e.g. fury). Thresholds must be listed in descending order.</p>
        <ul>${bossEntries}</ul>

        <h3>Champion Modifier Stat Bumps (M303)</h3>
        <p>Champions (5% spawn chance) gain <b>+50% HP</b> and <b>+30% base damage</b> on top of their class stats, plus 1–2 modifiers from the pool below. Stat mods are applied multiplicatively at spawn.</p>
        <ul>${champMods}</ul>
      </div>`;
    }
    else if (S === 'stats') {
      html += `<div class="fcod-section">
        <h3>Stats</h3>
        <p>Tap a stat to see every formula that references it. This list is auto-derived from <code>formulas.js</code> — when new formulas are added, they appear here without any code change.</p>
        <div class="fcod-stat-links">
          ${STATS.map(s => `<button type="button" class="fcod-stat-link${this._selectedStat === s ? ' active' : ''}" data-stat="${s}">${s}: ${ctx.stats[s]}</button>`).join('')}
        </div>
        <h3>Formulas using ${this._selectedStat}</h3>
        ${this._renderStatDetail(this._selectedStat)}
      </div>`;
    }

    body.innerHTML = html;

    if (S === 'stats') {
      body.querySelectorAll('.fcod-stat-link').forEach(b => {
        b.addEventListener('click', () => {
          this._selectedStat = b.dataset.stat;
          this._renderSection();
          this._wireStatRefs();
        });
      });
    }
    this._wireStatRefs();
  }

  _renderStatDetail(stat) {
    const hits = getFormulasUsingStat(stat);
    if (!hits.length) return `<p>(no formulas reference ${stat} yet)</p>`;
    const ctx = this._ctx;
    return hits.map(h => {
      let live = '';
      try {
        // Best-effort: call the formula with ctx.stats / MEMBER where sensible.
        if (h.name === 'computeHeroDamage') {
          const eb = computeHeroEquipDmgBonus(ctx.equipment);
          // M95: show all three weapon-category ranges.
          const rH = computeHeroDamage(ctx.stats, eb, 'heavy');
          const rL = computeHeroDamage(ctx.stats, eb, 'light');
          const rM = computeHeroDamage(ctx.stats, eb, 'magic');
          live = `→ heavy[${rH[0]},${rH[1]}] light[${rL[0]},${rL[1]}] magic[${rM[0]},${rM[1]}]`;
        } else if (h.name === 'computeHeroHit') live = `→ ${computeHeroHit(ctx.stats)}`;
        else if (h.name === 'computeHeroDodge') live = `→ ${computeHeroDodge(ctx.stats, false)}`;
        else if (h.name === 'computeHeroInitiative') live = `→ ${computeHeroInitiative(ctx.stats, ctx.level)}`;
        else if (h.name === 'computeMaxHp') live = `→ ${computeMaxHp({ attrs: ctx.stats, passives: ctx.passives })}`;
        else if (h.name === 'computeMaxMp') live = `→ ${computeMaxMp({ attrs: ctx.stats, passives: ctx.passives })}`;
      } catch (_) { /* ignore */ }
      return `<div class="fcod-formula">
        <div class="fname">${h.name}</div>
        <code class="fexpr">${escapeHtml(h.formula || '')}</code>
        ${live ? `<span class="flive">${live}</span>` : ''}
        <span class="finputs">inputs: ${(h.inputs || []).join(', ')}</span>
      </div>`;
    }).join('');
  }

  _fBox(name, fn, live, extraPill) {
    const formula = fn && fn.formula ? fn.formula : (typeof live === 'string' && !fn ? '' : '');
    const inputs = fn && fn.inputs ? fn.inputs : [];
    return `<div class="fcod-formula">
      <div class="fname">${name}${extraPill || ''}</div>
      ${formula ? `<code class="fexpr">${escapeHtml(formula)}</code>` : ''}
      ${live ? `<span class="flive">${live}</span>` : ''}
      ${inputs.length ? `<span class="finputs">inputs: ${inputs.join(', ')}</span>` : ''}
    </div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
