// DEPRECATED M294 — replaced by PartyPanelScreen (Spells / Passives / Attributes tabs). Kept in repo for reference.
/**
 * SkillTreeScreen — view and upgrade skills per character
 * Skills auto-unlock at levels 1/5/10/15. Talents purchasable per skill.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { getBalance } from '../../game/balance-loader.js';
import { getClassSkills, getUnlockedSkills, SKILLS, mergeSkillForCast } from '../../game/skills.js';
import { CLASS_PETS } from '../../game/companions.js';
import { CLASSES } from '../../game/classes.js';
import { getPassiveTree, recalcPassiveStats, computeMaxHp, computeMaxMp } from '../../game/passives.js';
import { getEquipmentAffixBonuses } from '../../game/formulas.js';
import { attachStatTooltips, setBaseMode } from '../components/StatColors.js';
import { portraitImg, classIconSvg } from '../../game/spriteUtils.js';
import { attachTooltip, injectTooltipStyles } from '../components/Tooltip.js';
import { showConfirmModal } from '../components/ConfirmModal.js';
import { renderCharacterStatsPanel } from '../components/CharacterStatsPanel.js';
import { isHardDifficulty } from '../../game/autoBuild.js';

// M-followup — defensive check: returns true if `char.autoBuild` is the same
// object reference as any OTHER party member's autoBuild. Such aliasing can
// happen if a template was shallow-cloned and autoBuild was carried along.
// Toggling Auto on one would then mutate the other. When detected, the caller
// re-assigns a fresh per-character object before mutating.
function _isSharedAutoBuild(party, char) {
  if (!char || !char.autoBuild) return false;
  for (const other of party || []) {
    if (other && other !== char && other.autoBuild === char.autoBuild) return true;
  }
  return false;
}

// Map from the active SkillTreeScreen tab name to the autoBuild flag stored
// on each member. Set/cleared by the per-tab Auto toggle. The flag is read by
// the level-up auto-spend code (LevelUpScreen / batch spend); this screen
// only needs to render the badge + flip the flag.
const TAB_AUTO_FLAG = {
  active:  'auto_active',
  passive: 'auto_passive',
  attrs:   'auto_attrs',
};

// Pending-points field for each tab — used to short-circuit the warning modal
// when the user toggles Auto on with nothing to auto-spend.
const TAB_PENDING_FIELD = {
  active:  'pendingSkillPoints',
  passive: 'pendingPassivePoints',
  attrs:   'pendingAttrPoints',
};

const TAB_AUTO_LABEL = {
  active:  'Auto-spend talent points',
  passive: 'Auto-spend passive points',
  attrs:   'Auto-spend attribute points',
};

const TAB_AUTO_WARNING = {
  active:  'Talent points will be auto-spent on each level-up using the class default order. You will not get a chance to pick talents yourself until you turn this off.',
  passive: 'Passive points will be auto-spent on each level-up using the class default order. You will not get to choose which passives to learn until you turn this off.',
  attrs:   'Attribute points will be auto-spent on each level-up using the class default priority. You will not get to choose which attributes to raise until you turn this off.',
};

/**
 * M293 — Format a talent `effect` object into human-readable preview lines.
 * Common field names are mapped to friendly descriptions; unknowns fall back
 * to a "key: value" representation so nothing is silently lost.
 */
function formatTalentEffect(effect) {
  if (!effect || typeof effect !== 'object') return [];
  const lines = [];
  const pct = (v) => `${Math.round(v * 100)}%`;
  const rounds = (n) => `${n} round${n === 1 ? '' : 's'}`;

  const MAP = {
    targets:        (v) => `Hits ${v} targets`,
    damageMult:     (v) => `Damage: ${v}x multiplier`,
    damage_mult:    (v) => `Damage: ${v}x multiplier`,
    dmgBuff:        (v) => `+${pct(v)} party damage`,
    dmgReduct:      (v) => `-${pct(v)} damage taken`,
    reflect:        (v) => `Reflects ${pct(v)} damage back`,
    duration:       (v) => `Lasts ${rounds(v)}`,
    aoe:            (v) => `Area: ${v}`,
    tempHp:         (v) => `+${v} temporary HP per member`,
    healMult:       (v) => `Heals ${v}x multiplier`,
    attackSpeed:    (v) => `+${pct(v)} attack speed`,
    mpCost:         (v) => v < 0 ? `Mana cost -${Math.abs(v)}` : `Mana cost +${v}`,
    bleed:          (v) => `Applies Bleed (${rounds(v?.duration ?? v)})`,
    statusEffects:  (v) => Array.isArray(v)
      ? v.map(s => `${Math.round((s.chance||1)*100)}% chance: ${s.type} (${rounds(s.duration)})`).join(', ')
      : String(v),
    status_apply:   (v) => `Applies ${v}`,
    immuneStun:     (v) => v ? 'Immune to Stun' : '',
    immuneBleed:    (v) => v ? 'Immune to Bleed' : '',
    unlocksCompanion: (v) => `Unlocks companion: ${v}`,
  };

  for (const [k, v] of Object.entries(effect)) {
    if (v === null || v === undefined || v === false) continue;
    const fn = MAP[k];
    if (fn) {
      const str = fn(v);
      if (str) lines.push(str);
    } else {
      // Generic fallback for unmapped keys.
      const label = k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
      const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
      lines.push(`${label}: ${valStr}`);
    }
  }
  return lines;
}

export class SkillTreeScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._selectedCharIdx = 0;
    this._selectedSkill = null;
    this._mobileDetailView = false; // mobile: true = showing detail panel
    this._tab = 'active'; // M50: 'active' | 'passive'
  }

  onEnter() {
    // M174 UX: if the player arrives with unspent points (e.g. from LevelUpScreen),
    // pre-select the FIRST character with points, then the tab that has points
    // waiting. Priority: skill → passive → attr. Keeps the single-tap flow to
    // "see and spend what I just earned."
    try {
      const gs = GameState.get();
      const chars = gs?.party || [];
      // M223: if the player came from a town sidebar slot, focus that hero first.
      // Otherwise fall back to the first character with unspent points.
      let idx = -1;
      if (gs?.skillFocusId) {
        idx = chars.findIndex(c => c && c.id === gs.skillFocusId);
        gs.skillFocusId = null;
      }
      if (idx < 0) {
        idx = chars.findIndex(c => c && ((c.pendingSkillPoints||0) + (c.pendingPassivePoints||0) + (c.pendingAttrPoints||0)) > 0);
      }
      if (idx >= 0) this._selectedCharIdx = idx;
      const c = chars[this._selectedCharIdx];
      // M384 — when the parent tab system pinned _tab explicitly (via
      // PartyPanelScreen._mountSkillTab), respect it. The auto-route based on
      // pending points is for stand-alone entry from LevelUpScreen.
      if (c && !this._tabPinned) {
        if ((c.pendingSkillPoints || 0) > 0) this._tab = 'active';
        else if ((c.pendingPassivePoints || 0) > 0) this._tab = 'passive';
        else if ((c.pendingAttrPoints || 0) > 0) this._tab = 'attrs';
      }
      // M386 — code-reviewer flag: clear the pin so a re-entered instance
      // (LevelUpScreen path) re-routes normally. Belt + suspenders since
      // PartyPanelScreen builds a fresh SkillTreeScreen per mount today.
      this._tabPinned = false;
      // M227: drain pending points for anyone with Auto flags set. Runs on
      // every open so level-ups that happen between visits still auto-apply.
      // M385: skip auto-drain entirely on Hard difficulty.
      for (const member of chars) {
        if (!member || !member.autoBuild) continue;
        if (isHardDifficulty()) continue;
        const prevTab = this._tab;
        for (const t of ['active','passive','attrs']) {
          if (!member.autoBuild[`auto_${t}`]) continue;
          this._tab = t;
          const prevIdx = this._selectedCharIdx;
          this._selectedCharIdx = chars.indexOf(member);
          let guard = 0;
          while (this._applyOneRecommended(member) && guard++ < 200) { /* drain */ }
          this._selectedCharIdx = prevIdx;
        }
        this._tab = prevTab;
      }
    } catch (_) {}
    this._build();
  }

  _build() {
    injectStyles('skill-styles', SKILL_STYLES);
    this._el = createEl('div', 'skill-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const gs = GameState.get();
    const chars = gs.party;
    const char = chars[this._selectedCharIdx];
    const skills = char ? getClassSkills(char.class) : [];
    const unlocked = char ? getUnlockedSkills(char.class, char.level || 1) : [];
    const charTalents = char?.talentsPurchased || {};

    const _scrollSnap = {};
    for (const sel of ['.skill-list-panel', '.skill-detail-panel', '.passive-panel', '.attrs-panel']) {
      const el = this._el.querySelector(sel);
      if (el) _scrollSnap[sel] = el.scrollTop;
    }
    const _docScroll = window.scrollY || document.documentElement.scrollTop;
    // M151: blur focused button so its removal by innerHTML reassignment
    // doesn't trigger the browser "scroll focused into view" jump to top
    // when the user clicks +1 Attribute / Buy Talent / Passive.
    const _prevActive = document.activeElement;
    if (_prevActive && _prevActive !== document.body && typeof _prevActive.blur === 'function') {
      try { _prevActive.blur(); } catch (_) {}
    }

    this._el.innerHTML = `
      <div class="skill-header">
        <div class="skill-char-tabs" id="skill-char-tabs">
          ${chars.map((c,i) => {
            const totalPts = (c.pendingSkillPoints||0) + (c.pendingPassivePoints||0) + (c.pendingAttrPoints||0);
            const showBadge = totalPts > 0 && i !== this._selectedCharIdx;
            return `
            <button type="button" class="sct-tab${i===this._selectedCharIdx?' active':''}" data-idx="${i}">
              <span class="sct-portrait">${portraitImg(c, 24)}</span>
              ${c.name} ${classIconSvg(c, 12, 'sct-class-icon')}<br><small>${c.className || c.class} Lv${c.level||1}</small>
              ${showBadge ? `<span class="sct-badge">${totalPts > 9 ? '9+' : totalPts}</span>` : ''}
            </button>`;
          }).join('')}
        </div>
        <div class="skill-header-btns">
          ${this._mobileDetailView
            ? `<button type="button" class="skill-back-mobile" id="skill-back-mobile">← Back</button>`
            : ''
          }
          <button type="button" class="skill-close" id="skill-close">✕</button>
        </div>
      </div>
      <div class="skill-mode-tabs">
        <button type="button" class="smt-tab${this._tab==='active'?' active':''}${char?.autoBuild?.auto_active?' auto-on':''}" data-mode="active">
          Spells${char && (char.pendingSkillPoints||0)>0 ? ` <span class="smt-badge" title="Unspent talent points — click an option to spend">+${char.pendingSkillPoints}</span>` : ''}${char?.autoBuild?.auto_active ? ' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>' : ''}
        </button>
        <button type="button" class="smt-tab${this._tab==='passive'?' active':''}${char?.autoBuild?.auto_passive?' auto-on':''}" data-mode="passive">
          Passive${char && (char.pendingPassivePoints||0)>0 ? ` <span class="smt-badge" title="Unspent passive points — click an option to spend">+${char.pendingPassivePoints}</span>` : ''}${char?.autoBuild?.auto_passive ? ' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>' : ''}
        </button>
        <button type="button" class="smt-tab${this._tab==='attrs'?' active':''}${char?.autoBuild?.auto_attrs?' auto-on':''}" data-mode="attrs">
          Attributes${char && (char.pendingAttrPoints||0)>0 ? ` <span class="smt-badge" title="Unspent attribute points — click an option to spend">+${char.pendingAttrPoints}</span>` : ''}${char?.autoBuild?.auto_attrs ? ' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>' : ''}
        </button>
      </div>
      ${this._tab === 'attrs' ? this._renderAttrsPanel(char) : this._tab === 'passive' ? this._renderPassivePanel(char) : `
      <div class="skill-layout${this._mobileDetailView ? ' mobile-detail-open' : ''}">
        <!-- Skill list -->
        <div class="skill-list-panel">
          <div class="skill-panel-head">
            <div class="panel-label">Spells</div>
            ${char ? this._renderAutoToggle(char, 'active') : ''}
          </div>
          ${char ? `<div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent talent points — click an option to spend"><span class="pp-num pp-num-fixed">+${char.pendingSkillPoints||0}</span><span class="pp-tip-pop">Unspent talent points — click an option to spend</span></div>` : ''}
          ${skills.map(skill => {
            const isUnlocked = unlocked.find(s => s.name === skill.name);
            return `
              <div class="skill-row${isUnlocked ? '' : ' locked'}${this._selectedSkill === skill.name ? ' selected' : ''}" data-skill="${skill.name}">
                <div class="sk-level-badge">Lv${skill.unlockLevel}</div>
                <div class="sk-info">
                  <div class="sk-name">${skill.name}</div>
                  <div class="sk-type">${skill.type} · ${skill.aoe || skill.target || 'self'}</div>
                </div>
                <div class="sk-cost">${skill.mpCost > 0 ? `${skill.mpCost} MP` : 'Passive'}</div>
                ${isUnlocked ? '' : '<div class="sk-lock-icon">🔒</div>'}
              </div>
            `;
          }).join('')}
        </div>
        <!-- Skill detail / talents -->
        <div class="skill-detail-panel">
          ${this._selectedSkill ? this._renderSkillDetail(char, charTalents) : `
            <div class="skill-select-prompt">Select a skill to view its description and upgrade talents.</div>
          `}
        </div>
      </div>
      `}
    `;

    this._wireEvents();
    attachStatTooltips(this._el);
    // M408 — base toggle is now a button (matches InventoryScreen). Read
    // current state from the .on class rather than .checked.
    const baseChk = this._el.querySelector('#skill-stats-base');
    if (baseChk) baseChk.addEventListener('click', () => {
      const next = !baseChk.classList.contains('on');
      setBaseMode(next);
      this._render();
    });

    for (const sel of Object.keys(_scrollSnap)) {
      const el = this._el.querySelector(sel);
      if (el) el.scrollTop = _scrollSnap[sel];
    }
    window.scrollTo(0, _docScroll);
  }

  _renderSkillDetail(char, charTalents) {
    const skill = Object.values(SKILLS).find(s => s.name === this._selectedSkill);
    if (!skill) return '';
    const talents = skill.talents || [];
    const tp = char?.pendingSkillPoints || 0;
    // M134 — estimate concrete damage/heal number for the currently selected
    // character. Mirrors CombatScreen._handleSpellAction formula
    // (base = mult × stat × (1 + spellPower)). For dual-stat skills use the
    // higher of the two (what the combat code implicitly does via _getSkillStat).
    let dmgEst = null, healEst = null;
    if (char) {
      const a = char.attrs || {};
      const ab = getEquipmentAffixBonuses(char);
      const eff = {
        STR: (a.STR || 8) + (ab.str || 0),
        DEX: (a.DEX || 8) + (ab.dex || 0),
        INT: (a.INT || 8) + (ab.int || 0),
        CON: (a.CON || 8) + (ab.con || 0),
      };
      const spellPower = (eff.INT * 0.025) + (ab.spellPower || 0);
      // M266: use mergeSkillForCast so tooltip reflects effective damageMult
      // including purchased talents + reached-level upgrades (e.g. knight
      // Shield Bash at L19 with Bulwark Strike → 2.0× not 1.1×).
      var mergedForTip = skill;
      try { mergedForTip = mergeSkillForCast(skill, char); } catch (_) {}
      if (skill.damageStat) {
        const ds = skill.damageStat;
        const pick = (k) => eff[k.toUpperCase()] || 0;
        const isMagic = /int|spell/i.test(ds) || ['fire','ice','lightning','holy','necro','magic'].includes(skill.type);
        const mult = +mergedForTip.damageMult || 0;
        // M396 — match CombatScreen damage path: per-category multiplier,
        // heroDamageMult, weapon-scaling override, attackPower bonus on
        // physicals, and weapon flavor.
        let balSkill = {}; try { balSkill = (typeof getBalance === 'function' ? getBalance().combat?.skill : null) || {}; } catch (_) {}
        const heroSkillMult = balSkill.heroDamageMult ?? 1.0;
        const wcat = (char?.equipment?.weapon?.weaponCategory || char?.equipment?.weapon?.subtype || '').toLowerCase();
        const cat = mergedForTip.damageCategory || (
          isMagic ? 'magic' : (/2h|hammer|maul/.test(wcat) ? 'heavy' : 'light')
        );
        const catMult = cat === 'magic' ? (balSkill.magicMult ?? 0.78)
                      : cat === 'heavy' ? (balSkill.heavyMult ?? 1.00)
                      : (balSkill.lightMult ?? 1.00);
        const finalMult = mult * heroSkillMult * catMult;
        // Weapon Scaling always on — drive estimate off weapon midpoint.
        const wpn = char?.equipment?.weapon;
        const wDmg = (wpn?.damage || wpn?.dmg || []);
        const weaponMid = wDmg.length === 2 ? (wDmg[0] + wDmg[1]) / 2 : 0;
        const sv = weaponMid;
        const attackPower = Math.round((eff.STR || 8) * 1.5);
        const powerBonus = isMagic ? spellPower : (attackPower * 0.05);
        const weaponFlavor = isMagic ? 0 : Math.round(weaponMid * 0.1);
        const base = sv * finalMult * (1 + powerBonus) + weaponFlavor;
        dmgEst = Math.max(0, Math.round(base));
        // Stash so render block can show the breakdown beside the est.
        skill.__estTip = { sv, finalMult, powerBonus, weaponFlavor, weaponMid, isMagic, cat };
      }
      if (skill.healStat) {
        const hs = skill.healStat;
        const sv = eff[hs.toUpperCase()] || 0;
        healEst = Math.round((+mergedForTip.healMult || 0) * sv * (1 + spellPower));
      }
    }
    // Effective multipliers for the formula display too.
    let effMerged = skill;
    try { if (char) effMerged = mergeSkillForCast(skill, char); } catch (_) {}
    return `
      <div class="skill-detail-inner">
        <button type="button" class="sd-back-inline" id="sd-back-inline" aria-label="Back to spells list">← Back to spells</button>
        <div class="sd-name">${skill.name}</div>
        <div class="sd-type"><span class="sd-badge">${skill.type}</span>${skill.aoe ? `<span class="sd-badge">${skill.aoe}</span>` : ''}</div>
        <div class="sd-desc">${skill.description}</div>
        ${skill.mpCost > 0 ? `<div class="sd-cost">Mana Cost: <strong>${skill.mpCost}</strong></div>` : ''}
        ${skill.damageStat ? `<div class="sd-formula">Damage: ${effMerged.damageMult}× weapon damage${effMerged.damageMult !== skill.damageMult ? ` <span style="color:#6a8aa0">(base ${skill.damageMult}×, upgraded)</span>` : ''}</div>` : ''}
        ${dmgEst !== null ? `<div class="sd-estimate">Est. Damage: <strong>~${dmgEst}</strong> <span style="color:#8a7a6a">per primary target, before armor/resist</span></div>` : ''}
        ${skill.__estTip ? `<div class="sd-formula" style="font-size:0.7rem;color:#a89870;margin-top:0.15rem">
          wpn ${skill.__estTip.weaponMid.toFixed(0)}
          × ${skill.__estTip.finalMult.toFixed(2)}
          × (1 + ${skill.__estTip.powerBonus.toFixed(2)} ${skill.__estTip.isMagic ? 'SP' : 'AP'})
          ${skill.__estTip.weaponFlavor > 0 ? ` + ${skill.__estTip.weaponFlavor}` : ''}
          <span style="color:#6a6070">· ${skill.__estTip.cat}</span>
        </div>` : ''}
        ${skill.healStat ? `<div class="sd-formula">Heal: ${effMerged.healMult}× ${skill.healStat.toUpperCase()}${effMerged.healMult !== skill.healMult ? ` <span style="color:#6a8aa0">(base ${skill.healMult}×)</span>` : ''}</div>` : ''}
        ${healEst !== null ? `<div class="sd-estimate">Est. Heal: <strong>~${healEst}</strong></div>` : ''}
        ${skill.statusEffects?.length ? `
          <div class="sd-effects">
            ${skill.statusEffects.map(e => `<div class="sd-effect"><span class="eff-name">${e.type.toUpperCase()}</span> ${Math.round(e.chance*100)}% chance · ${e.duration} rounds</div>`).join('')}
          </div>
        ` : ''}
        ${talents.length ? `
          <div class="sd-talents-title">Upgrade Talents</div>
          <div class="sd-talents">
            ${talents.map(t => {
              const purchased = charTalents[t.id];
              const canBuy = !purchased && tp > 0;
              return `
                <div class="sd-talent${purchased ? ' purchased' : ''}">
                  <div class="sdt-info">
                    <div class="sdt-name">${t.name}</div>
                    <div class="sdt-desc">${t.desc}</div>
                  </div>
                  <button type="button" class="sdt-btn${purchased ? ' done' : ''}" data-talent="${t.id}" ${purchased || !canBuy ? 'disabled' : ''}>
                    ${purchased ? '✓ Learned' : 'Learn (1 pt)'}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        ` : '<div style="color:#8a7a6a;font-size:0.8rem;margin-top:1rem">No upgrade talents available for this skill.</div>'}
      </div>
    `;
  }

  // M227: Recommend / Auto-apply bar. Shows on all three tabs. Clicking
  // "Recommend" applies one point to the next recommended target and scrolls
  // it into view; toggling "Auto" (with confirmation) spends every pending
  // point on this tab for this character using the class-specific preferred
  // build. "Auto" is per-character-per-tab and persists on the character
  // object so future level-ups can keep dumping points in.
  _renderRecommendBar(char) {
    const tab = this._tab;
    const pending = tab === 'active' ? (char.pendingSkillPoints || 0)
      : tab === 'passive' ? (char.pendingPassivePoints || 0)
      : (char.pendingAttrPoints || 0);
    const autoKey = `auto_${tab}`;
    const autoOn = !!(char.autoBuild && char.autoBuild[autoKey]);
    const hard = isHardDifficulty();
    return `
      <div class="recommend-bar">
        <button type="button" class="recommend-btn${pending > 0 ? '' : ' disabled'}" id="recommend-btn" ${pending > 0 ? '' : 'disabled'}>
          ✦ Recommend
        </button>
        ${hard
          ? ''
          : `<label class="recommend-auto">
              <input type="checkbox" id="recommend-auto" ${autoOn ? 'checked' : ''}>
              Auto
            </label>`
        }
        <span class="recommend-note">${pending > 0 ? `${pending} point${pending===1?'':'s'} pending` : 'No points pending'}</span>
      </div>
    `;
  }

  // Preferred attribute per class — 80% primary / 20% CON.
  _recommendAttr(char) {
    const klass = CLASSES.find(c => c.id === char.class);
    const prim = klass?.primaryAttr || 'STR';
    const base = char.baseAttrs || { STR: 8, DEX: 8, INT: 8, CON: 8 };
    const cur = char.attrs || { ...base };
    const spentPrim = (cur[prim] || 0) - (base[prim] || 0);
    const spentCon = (cur.CON || 0) - (base.CON || 0);
    const totalSpent = spentPrim + spentCon;
    // If CON is under 20% of total spent, pump CON next; otherwise primary.
    if (totalSpent > 0 && spentCon / totalSpent < 0.2) return 'CON';
    return prim;
  }

  // Preferred passive order — prefer exotic nodes (lifesteal / mana regen /
  // lifebind / similar named effects) first, then the first non-maxed node.
  _recommendPassive(char) {
    const tree = getPassiveTree(char.class);
    const ranks = char.passiveRanks || {};
    const EXOTIC = /lifesteal|life_steal|mana_regen|mana_steal|regen|lifebind|soulbind|exotic|leech|siphon/i;
    const openExotic = tree.find(n => EXOTIC.test(n.id + ' ' + (n.name || '') + ' ' + (n.desc || '')) && (ranks[n.id] || 0) < n.maxRank);
    if (openExotic) return openExotic.id;
    return (tree.find(n => (ranks[n.id] || 0) < n.maxRank) || {}).id || null;
  }

  // Preferred talent — first unpurchased talent on the lowest-unlock skill.
  _recommendTalent(char) {
    const skills = getClassSkills(char.class);
    const unlocked = getUnlockedSkills(char.class, char.level || 1);
    const owned = char.talentsPurchased || {};
    const unlockedSorted = [...unlocked].sort((a, b) => (a.unlockLevel || 0) - (b.unlockLevel || 0));
    for (const skill of unlockedSorted) {
      const full = skills.find(s => s.name === skill.name) || skill;
      for (const t of (full.talents || [])) {
        if (!owned[t.id]) return { skillName: skill.name, talentId: t.id };
      }
    }
    return null;
  }

  _applyOneRecommended(char) {
    const tab = this._tab;
    if (tab === 'attrs') {
      if ((char.pendingAttrPoints || 0) <= 0) return false;
      const k = this._recommendAttr(char);
      char.attrs[k] = (char.attrs[k] || 8) + 1;
      char.pendingAttrPoints -= 1;
      try { char.maxHp = computeMaxHp(char); char.maxMp = computeMaxMp(char); } catch(_) {}
      return true;
    }
    if (tab === 'passive') {
      if ((char.pendingPassivePoints || 0) <= 0) return false;
      const nodeId = this._recommendPassive(char);
      if (!nodeId) return false;
      const tree = getPassiveTree(char.class);
      const node = tree.find(n => n.id === nodeId);
      if (!node) return false;
      if (!char.passiveRanks) char.passiveRanks = {};
      const cur = char.passiveRanks[nodeId] || 0;
      if (cur >= node.maxRank) return false;
      char.passiveRanks[nodeId] = cur + 1;
      char.pendingPassivePoints -= 1;
      recalcPassiveStats(char);
      return true;
    }
    // Active skills / talents.
    if ((char.pendingSkillPoints || 0) <= 0) return false;
    const pick = this._recommendTalent(char);
    if (!pick) return false;
    if (!char.talentsPurchased) char.talentsPurchased = {};
    char.talentsPurchased[pick.talentId] = true;
    char.pendingSkillPoints = Math.max(0, (char.pendingSkillPoints || 0) - 1);
    this._selectedSkill = pick.skillName;
    return true;
  }

  _renderPassivePanel(char) {
    if (!char) {
      return `<div class="passive-empty">No character selected.</div>`;
    }
    const tree = getPassiveTree(char.class);
    const ranks = char.passiveRanks || {};
    const pts = char.pendingPassivePoints || 0;
    return `
      <div class="passive-panel">
        <div class="passive-header">
          <div class="panel-label">Passives</div>
          ${this._renderAutoToggle(char, 'passive')}
        </div>
        <div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent passive points — click an option to spend">
          <span class="pp-num pp-num-fixed">+${pts}</span>
          <span class="pp-tip-pop">Unspent passive points — click an option to spend</span>
        </div>
        <div class="passive-nodes">
          ${tree.map((node, i) => {
            const rank = ranks[node.id] || 0;
            const canBuy = pts > 0 && rank < node.maxRank;
            return `
              <div class="passive-node${rank>0?' owned':''}">
                <div class="pn-index">${i+1}</div>
                <div class="pn-info">
                  <div class="pn-name">${node.name}</div>
                  <div class="pn-desc">${node.desc}</div>
                  <div class="pn-rank">Rank <strong>${rank}</strong> / ${node.maxRank}</div>
                </div>
                <button type="button" class="pn-btn${canBuy?'':' disabled'}" data-passive="${node.id}" ${canBuy?'':'disabled'}>
                  ${rank >= node.maxRank ? '✓ Maxed' : 'Learn (1 pt)'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
        <div class="passive-hint">Earn 1 Passive Point every 2 levels. Bonuses are permanent.</div>
      </div>
    `;
  }

  _renderAttrsPanel(char) {
    if (!char) return `<div class="passive-empty">No character selected.</div>`;
    const pts = char.pendingAttrPoints || 0;
    // Layout matches Inventory > Character Stats so players never see two
    // different shapes of the same data. The shared renderer owns
    // grouping (Attributes → Derived → Other Effects), field names ("HP"
    // not "Max HP"), the Damage Reduction / Magic Resist placement (in
    // Derived, NOT Other Effects), the single weapon-driven damage row,
    // and the BASE-mode hide rules for affix-only stats.
    const statsHtml = renderCharacterStatsPanel(char, {
      withSpendButtons: true,
      pendingAttrPoints: pts,
      includeHeader: false,
      baseToggleId: 'skill-stats-base',
    });
    return `
      <div class="passive-panel attrs-panel">
        <div class="passive-header">
          <div class="panel-label">Attributes</div>
          ${this._renderAutoToggle(char, 'attrs')}
        </div>
        <div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent attribute points — click an option to spend">
          <span class="pp-num pp-num-fixed">+${pts}</span>
          <span class="pp-tip-pop">Unspent attribute points — click an option to spend</span>
        </div>
        <div class="char-stats-panel attrs-stats-panel">
          ${statsHtml}
        </div>
        <div class="passive-hint">Spend deferred points from level-ups any time.</div>
      </div>
    `;
  }

  /**
   * Render the per-tab Auto toggle button. Shows ON/OFF state plus a small
   * checkmark when the corresponding member.autoBuild flag is set.
   */
  _renderAutoToggle(char, tab) {
    // M402 — manual combat: drop the per-tab Auto toggle from the DOM rather
    // than show it disabled. Manual mode means every point is hand-picked.
    if (GameState.get()?.manualCombat) return '';
    const flagKey = TAB_AUTO_FLAG[tab];
    const on = !!(char.autoBuild && char.autoBuild[flagKey]);
    const hard = isHardDifficulty();
    if (hard) {
      // Manual Characters mode hides the Auto toggle entirely.
      return '';
    }
    return `
      <button type="button" class="auto-toggle${on ? ' on' : ''}" data-auto-tab="${tab}" aria-pressed="${on ? 'true' : 'false'}" title="${on ? 'Auto: On' : 'Auto: Off'}">
        ${on ? '<span class="auto-check" aria-hidden="true">✓</span>' : '<span class="auto-check auto-off" aria-hidden="true">○</span>'}Auto
      </button>
    `;
  }

  _wireEvents() {
    this._el.querySelector('#skill-close')?.addEventListener('click', () => { this.audio.playSfx('click'); this.manager.pop(); });
    // M491b — inline back button at the top of the spell-detail panel.
    // The header back button (#skill-back-mobile) wasn't visible when the
    // SkillTreeScreen was embedded inside PartyPanelScreen (parent header
    // overlapped). This one lives inside the detail content itself.
    this._el.querySelector('#sd-back-inline')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._mobileDetailView = false;
      this._selectedSkill = null;
      this._render();
    });
    this._el.querySelector('#skill-back-mobile')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._mobileDetailView = false;
      this._selectedSkill = null;
      this._render();
    });

    this._el.querySelectorAll('.sct-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._selectedCharIdx = parseInt(tab.dataset.idx);
        this._selectedSkill = null;
        this._mobileDetailView = false;
        // M174: when switching character, jump to a tab where that character
        // actually has points to spend (if any). Keeps the flow of "deal with
        // the badge on this portrait" one tap instead of two.
        const gs = GameState.get();
        const c = gs?.party?.[this._selectedCharIdx];
        if (c) {
          if ((c.pendingSkillPoints || 0) > 0) this._tab = 'active';
          else if ((c.pendingPassivePoints || 0) > 0) this._tab = 'passive';
          else if ((c.pendingAttrPoints || 0) > 0) this._tab = 'attrs';
        }
        this._render();
      });
    });

    // M174: skill-row tooltip was redundant — clicking the row already opens
    // the full detail panel (and on mobile the long-press tooltip was covering
    // the detail panel on the tap that immediately followed). Tap to view
    // details; that's the single source of truth.
    this._el.querySelectorAll('.skill-row').forEach(row => {
      row.addEventListener('click', () => {
        if (row.classList.contains('locked')) return;
        this.audio.playSfx('click');
        this._selectedSkill = row.dataset.skill;
        this._mobileDetailView = true;
        this._render();
      });
    });

    this._el.querySelectorAll('.smt-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._tab = btn.dataset.mode;
        this._selectedSkill = null;
        this._mobileDetailView = false;
        this._render();
      });
    });

    // M227: Recommend button + Auto toggle.
    this._el.querySelector('#recommend-btn')?.addEventListener('click', () => {
      const gs = GameState.get();
      const char = gs.party[this._selectedCharIdx];
      if (!char) return;
      if (this._applyOneRecommended(char)) {
        this.audio.playSfx('spell');
        this._render();
      }
    });
    this._el.querySelector('#recommend-auto')?.addEventListener('change', (e) => {
      // M385: auto-choices locked on Hard difficulty.
      if (isHardDifficulty()) { e.target.checked = false; return; }
      const gs = GameState.get();
      const char = gs.party[this._selectedCharIdx];
      if (!char) { e.target.checked = false; return; }
      const tab = this._tab;
      const key = `auto_${tab}`;
      if (e.target.checked) {
        // M406 — single save-level autoModeAccepted flag: once accepted for
        // ANY auto toggle in this save, skip the modal for all future ones.
        const enable = () => {
          if (!char.autoBuild) char.autoBuild = {};
          char.autoBuild[key] = true;
          let guard = 0;
          while (this._applyOneRecommended(char) && guard++ < 200) { /* loop */ }
          this.audio.playSfx('spell');
          this._render();
        };
        if (gs.autoModeAccepted) {
          enable();
          return;
        }
        e.target.checked = false; // reset until confirmed
        showConfirmModal({
          title: 'Enable Auto-Recommend?',
          message: 'Auto-apply recommended points on level-up for this tab? You can uncheck this later.',
          confirmText: 'Enable Auto',
          cancelText: 'Cancel',
          onConfirm: () => {
            e.target.checked = true;
            gs.autoModeAccepted = true;
            enable();
          },
        });
      } else {
        if (char.autoBuild) char.autoBuild[key] = false;
      }
    });

    this._el.querySelectorAll('.passive-node').forEach(node => {
      injectTooltipStyles();
      attachTooltip(node, () => {
        const btn = node.querySelector('[data-passive]');
        const id = btn?.dataset.passive;
        const gs = GameState.get();
        const char = gs.party[this._selectedCharIdx];
        if (!char || !id) return '';
        const tree = getPassiveTree(char.class);
        const n = tree.find(x => x.id === id);
        if (!n) return '';
        const rank = (char.passiveRanks || {})[id] || 0;
        return `<div class="tt-title">${n.name}</div><div class="tt-sub">Rank ${rank} / ${n.maxRank}</div><div class="tt-row">${n.desc}</div>`;
      });
    });

    this._el.querySelectorAll('[data-passive]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const gs = GameState.get();
        const char = gs.party[this._selectedCharIdx];
        if (!char) return;
        if ((char.pendingPassivePoints || 0) <= 0) return;
        const nodeId = btn.dataset.passive;
        const tree = getPassiveTree(char.class);
        const node = tree.find(n => n.id === nodeId);
        if (!node) return;
        if (!char.passiveRanks) char.passiveRanks = {};
        const cur = char.passiveRanks[nodeId] || 0;
        if (cur >= node.maxRank) return;
        char.passiveRanks[nodeId] = cur + 1;
        char.pendingPassivePoints -= 1;
        recalcPassiveStats(char);
        this.audio.playSfx('spell');
        this._render();
      });
    });

    this._el.querySelectorAll('[data-attr]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const gs = GameState.get();
        const char = gs.party[this._selectedCharIdx];
        if (!char) return;
        if ((char.pendingAttrPoints || 0) <= 0) return;
        const k = btn.dataset.attr;
        if (!char.attrs) char.attrs = { STR:8, DEX:8, INT:8, CON:8 };
        char.attrs[k] = (char.attrs[k] || 8) + 1;
        char.pendingAttrPoints -= 1;
        try { char.maxHp = computeMaxHp(char); char.maxMp = computeMaxMp(char); } catch(_) {}
        this.audio.playSfx('spell');
        this._render();
      });
    });

    // Auto-toggle (per-tab). Confirm modal only when turning Auto ON AND
    // there are pending points to spend — silent flip otherwise per spec.
    this._el.querySelectorAll('[data-auto-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        // M385: auto-choices locked on Hard difficulty.
        if (isHardDifficulty()) {
          this._showHardLockTip(btn);
          return;
        }
        const gs = GameState.get();
        const char = gs.party[this._selectedCharIdx];
        if (!char) return;
        const tab = btn.dataset.autoTab;
        const flagKey = TAB_AUTO_FLAG[tab];
        const pendField = TAB_PENDING_FIELD[tab];
        if (!flagKey) return;
        // M-followup: defensive — ensure this character owns its own
        // autoBuild object. If autoBuild was ever cloned-by-reference from
        // a template, two heroes could end up sharing the same object and
        // toggling one would toggle the other. Reassign a fresh object
        // populated from the existing flags so future writes are isolated.
        if (!char.autoBuild || _isSharedAutoBuild(gs.party, char)) {
          const prev = char.autoBuild || {};
          char.autoBuild = {
            auto_attrs: !!prev.auto_attrs,
            auto_passive: !!prev.auto_passive,
            auto_active: !!prev.auto_active,
          };
        }
        const currentlyOn = !!char.autoBuild[flagKey];
        const pending = char[pendField] || 0;
        // M335: clicking Auto immediately drains any pending points the
        // engine knows how to spend. Previously the flag flipped on but the
        // actual spend was deferred to the next screen open, so the points
        // sat unspent until the user navigated away and back.
        const drain = () => {
          const prevTab = this._tab;
          this._tab = tab;
          let guard = 0;
          while (this._applyOneRecommended(char) && guard++ < 200) { /* drain */ }
          this._tab = prevTab;
        };
        const flip = (val) => {
          char.autoBuild[flagKey] = val;
          if (val) drain();
          this.audio.playSfx('click');
          this._render();
        };
        // Already on with pending points → just spend them, leave flag on.
        if (currentlyOn && pending > 0) {
          drain();
          this.audio.playSfx('click');
          this._render();
          return;
        }
        // Turning OFF, or turning ON with nothing to spend → silent flip.
        if (currentlyOn || pending <= 0) {
          flip(!currentlyOn);
          return;
        }
        // M406 — single save-level autoModeAccepted flag: once accepted for
        // ANY auto toggle in this save, skip the modal for all future ones.
        const gs2 = GameState.get();
        if (gs2.autoModeAccepted) {
          flip(true);
          return;
        }
        // Turning ON with pending points → in-game warning modal (first time only).
        showConfirmModal({
          title: TAB_AUTO_LABEL[tab] + '?',
          message: TAB_AUTO_WARNING[tab],
          confirmText: 'Enable Auto',
          cancelText: 'Cancel',
          onConfirm: () => {
            gs2.autoModeAccepted = true;
            flip(true);
          },
        });
      });
    });

    // Re-bind Base toggle inside the shared stats panel (Attributes tab uses
    // the shared renderer; the original #skill-stats-base lives there too).
    const baseChk2 = this._el.querySelector('#skill-stats-base');
    if (baseChk2 && !baseChk2._wired) {
      baseChk2._wired = true;
      // M408 — button-style toggle: read state from the .on class.
      baseChk2.addEventListener('click', () => {
        const next = !baseChk2.classList.contains('on');
        setBaseMode(next);
        this._render();
      });
    }

    this._el.querySelectorAll('[data-talent]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const gs = GameState.get();
        const char = gs.party[this._selectedCharIdx];
        if (!char) return;
        if ((char.pendingSkillPoints || 0) <= 0) return;
        if (!char.talentsPurchased) char.talentsPurchased = {};
        if (char.talentsPurchased[btn.dataset.talent]) return;
        char.talentsPurchased[btn.dataset.talent] = true;
        char.pendingSkillPoints = Math.max(0, (char.pendingSkillPoints || 0) - 1);
        // Check if this talent unlocks a class pet
        const talentId = btn.dataset.talent;
        const allSkills = Object.values(SKILLS);
        for (const sk of allSkills) {
          const t = (sk.talents || []).find(t => t.id === talentId);
          if (t?.effect?.unlocksCompanion) {
            const petId = t.effect.unlocksCompanion;
            const template = CLASS_PETS[petId];
            if (template) {
              const pet = {
                ...template,
                id: petId + '_' + char.id,
                templateId: petId,
                ownerId: char.id,
                ownerName: char.name,
                level: char.level || 1,
                attrs: { ...template.attrs },
              };
              const lvlBonus = Math.floor(((char.level || 1) - 1) * 0.5);
              pet.attrs.STR += lvlBonus;
              pet.attrs.DEX += lvlBonus;
              pet.attrs.INT += lvlBonus;
              pet.attrs.CON += lvlBonus;
              pet.maxHp = 50 + pet.attrs.CON * 10;
              pet.hp = pet.maxHp;
              pet.maxMp = 10 + pet.attrs.INT * 3;
              pet.mp = pet.maxMp;
              const added = GameState.addToCompanions(pet);
              if (!added) { GameState.addToBench(pet); }
            }
            break;
          }
        }
        this.audio.playSfx('spell');
        this._render();
      });
    });

    // M293 — talent effect preview tooltips.
    this._el.querySelectorAll('.sd-talent').forEach(row => {
      const btn = row.querySelector('[data-talent]');
      if (!btn) return;
      const talentId = btn.dataset.talent;
      // Find talent effect from SKILLS.
      let talentEffect = null;
      let talentDesc = null;
      for (const sk of Object.values(SKILLS)) {
        const t = (sk.talents || []).find(t => t.id === talentId);
        if (t) { talentEffect = t.effect; talentDesc = t.desc; break; }
      }
      injectTooltipStyles();
      attachTooltip(row, () => {
        const lines = talentEffect ? formatTalentEffect(talentEffect) : [];
        if (!lines.length && !talentDesc) return null;
        const effectHtml = lines.length
          ? lines.map(l => `<div class="tt-row">${l}</div>`).join('')
          : '';
        return `${effectHtml}`;
      });
    });
  }

  /** M385 — brief in-screen tip when player taps Auto on Hard difficulty. */
  _showHardLockTip(anchor) {
    const existing = this._el?.querySelector('.hard-lock-tip');
    if (existing) return;
    const tip = document.createElement('div');
    tip.className = 'hard-lock-tip';
    tip.textContent = 'Auto disabled on Hard difficulty.';
    const rect = anchor ? anchor.getBoundingClientRect() : null;
    const base = this._el?.getBoundingClientRect();
    if (rect && base) {
      tip.style.position = 'absolute';
      tip.style.top = (rect.bottom - base.top + 6) + 'px';
      tip.style.left = (rect.left - base.left) + 'px';
    }
    this._el?.appendChild(tip);
    setTimeout(() => tip.remove(), 2000);
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  update() {}
  draw() {}
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { removeEl(this._el); this._el = null; }
}

const SKILL_STYLES = `
.skill-screen {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: linear-gradient(180deg,#0a0608,#120a10); color: #f0e8d8;
  font-family: 'Inter', sans-serif;
}
.skill-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 1rem; border-bottom: 1px solid rgba(232,160,32,0.3);
  background: rgba(0,0,0,0.35); flex-shrink: 0;
}
.skill-char-tabs { display: flex; gap: 0.4rem; overflow-x: auto; }
.sct-tab {
  position: relative;
  padding: 0.4rem 0.85rem; background: rgba(20,12,28,0.7);
  border: 1px solid rgba(232,160,32,0.15); border-radius: 6px;
  color: #8a7a6a; font-size: 0.75rem; cursor: pointer; min-height: 44px; text-align: center;
  transition: all 0.2s;
}
.sct-badge { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; line-height: 16px; text-align: center; background: #e8a020; color: #1a1a2e; font-size: 10px; font-weight: 700; border-radius: 8px; padding: 0 3px; pointer-events: none; }
.sct-tab.active { border-color: rgba(232,160,32,0.6); color: #e8a020; background: rgba(232,160,32,0.1); }
.sct-tab small { font-size: 0.6rem; }
.sct-portrait { display: inline-block; vertical-align: middle; margin-right: 4px; }
.sct-portrait .char-portrait { border-radius: 3px; background: rgba(255,255,255,0.06); }
.skill-header-btns { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
.skill-close { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 1rem; padding: 0.4rem; min-height: 44px; min-width: 44px; }
.skill-layout { flex: 1; display: grid; grid-template-columns: 260px 1fr; overflow: hidden; }
.skill-back-mobile { display: none; background: none; border: none; color: #e8a020; cursor: pointer; font-size: 0.85rem; padding: 0.4rem 0.6rem; min-height: 44px; }
.sd-back-inline { display: none; background: rgba(232,160,32,0.12); border: 1px solid rgba(232,160,32,0.35); color: #e8a020; cursor: pointer; font-size: 0.85rem; font-weight: 600; padding: 0.5rem 0.8rem; min-height: 44px; border-radius: 4px; margin: 0 0 0.75rem; width: 100%; text-align: left; }
.sd-back-inline:hover { background: rgba(232,160,32,0.2); }
@media (max-width: 600px) {
  .skill-layout { grid-template-columns: 1fr; }
  .skill-list-panel { border-right: none; border-bottom: 1px solid rgba(232,160,32,0.15); }
  .skill-layout.mobile-detail-open .skill-list-panel { display: none; }
  .skill-layout:not(.mobile-detail-open) .skill-detail-panel { display: none; }
  .skill-back-mobile { display: block; }
  .sd-back-inline { display: block; }
}
.panel-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.75rem; }
.skill-list-panel { padding: 1rem; border-right: 1px solid rgba(232,160,32,0.15); overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem; }
.skill-row {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 0.75rem; background: rgba(20,12,28,0.5);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 7px;
  cursor: pointer; transition: all 0.2s; min-height: 52px;
}
.skill-row:hover:not(.locked) { border-color: rgba(232,160,32,0.4); background: rgba(20,12,28,0.8); }
.skill-row.locked { opacity: 0.4; cursor: default; }
.skill-row.selected { border-color: rgba(232,160,32,0.7); background: rgba(232,160,32,0.12); }
.sk-level-badge {
  font-size: 0.6rem; font-weight: 700; padding: 0.2rem 0.4rem;
  background: rgba(232,160,32,0.2); border: 1px solid rgba(232,160,32,0.3);
  border-radius: 4px; color: #e8a020; flex-shrink: 0; white-space: nowrap;
}
.sk-info { flex: 1; }
.sk-name { font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; }
.sk-type { font-size: 0.62rem; color: #8a7a6a; text-transform: capitalize; }
.sk-cost { font-size: 0.65rem; color: #c0a040; flex-shrink: 0; }
.sk-lock-icon { font-size: 0.7rem; }
.skill-detail-panel { padding: 1.5rem; overflow-y: auto; }
.skill-select-prompt { color: #8a7a6a; font-size: 0.85rem; text-align: center; margin-top: 3rem; }
.skill-detail-inner { max-width: 480px; }
.sd-name { font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 900; color: #e8a020; margin-bottom: 0.5rem; }
.sd-type { display: flex; gap: 0.4rem; margin-bottom: 0.75rem; }
.sd-badge { font-size: 0.65rem; font-weight: 600; padding: 0.2rem 0.5rem; background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.3); border-radius: 4px; color: #e8a020; text-transform: capitalize; }
.sd-desc { font-size: 0.88rem; line-height: 1.6; color: #c0b090; margin-bottom: 1rem; }
.sd-cost { font-size: 0.78rem; color: #c0a040; margin-bottom: 0.5rem; }
.sd-formula { font-size: 0.75rem; color: #c0c080; margin-bottom: 0.5rem; }
.sd-estimate { font-size: 0.8rem; color: #e8a020; margin-bottom: 0.5rem; }
.sd-effects { margin-bottom: 0.75rem; }
.sd-effect { font-size: 0.75rem; color: #c0a080; }
.eff-name { font-weight: 700; }
.sd-talents-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a7a6a; margin: 1.25rem 0 0.75rem; }
.sd-talents { display: flex; flex-direction: column; gap: 0.6rem; }
.sd-talent {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.85rem 1rem; background: rgba(20,12,28,0.5);
  border: 1px solid rgba(232,160,32,0.12); border-radius: 8px;
}
.sd-talent.purchased { border-color: rgba(232,160,32,0.4); background: rgba(232,160,32,0.08); }
.sdt-info { flex: 1; }
.sdt-name { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.2rem; }
.sdt-desc { font-size: 0.75rem; color: #8a7a6a; line-height: 1.4; }
.sdt-btn {
  padding: 0.5rem 0.85rem; background: rgba(232,160,32,0.15);
  border: 1px solid rgba(232,160,32,0.4); border-radius: 6px;
  color: #e8a020; font-size: 0.75rem; font-weight: 600; cursor: pointer;
  min-height: 44px; white-space: nowrap; transition: background 0.15s;
}
.sdt-btn:hover:not(:disabled) { background: rgba(232,160,32,0.28); }
.sdt-btn.done { background: rgba(232,160,32,0.06); border-color: rgba(232,160,32,0.2); color: #8a6020; cursor: default; }
.skill-mode-tabs { display: flex; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(232,160,32,0.2); flex-shrink: 0; }
.smt-tab { padding: 0.45rem 1rem; background: rgba(20,12,28,0.6); border: 1px solid rgba(232,160,32,0.15); border-radius: 6px; color: #8a7a6a; font-size: 0.78rem; font-weight: 600; cursor: pointer; min-height: 44px; }
.smt-tab.active { border-color: rgba(232,160,32,0.6); color: #e8a020; background: rgba(232,160,32,0.12); }
.smt-badge { display: inline-block; margin-left: 0.25rem; padding: 0.1rem 0.35rem; background: #c04030; color: #fff; font-size: 0.62rem; border-radius: 8px; min-width: 2.2em; text-align: center; box-sizing: border-box; cursor: help; }
/* M398 — compact +N badge variant of passive-points-banner; fixed width avoids
   layout shift when N drops 2→1→0 mid-spend. */
/* M404: compact banner — width hugs the +N pill, padding tightened to
   match the passives/attributes banner. The hover tooltip uses
   position:absolute + max-width so it does NOT stretch the banner or
   trigger horizontal scrollbars in narrow parents (the spells left
   column is 260px and was scrolling because the long nowrap tooltip
   pushed past its width). */
.pp-banner-compact { position: relative; padding: 0.25rem 0.5rem; cursor: help; align-self: flex-start; width: auto; max-width: max-content; }
.pp-num-fixed { min-width: 2.5em; text-align: center; display: inline-block; font-size: 1.05rem; }
.pp-tip-pop { position: absolute; left: 0; top: calc(100% + 4px); z-index: 50; background: #14101c; border: 1px solid rgba(232,160,32,0.45); padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.7rem; color: #d8c89c; opacity: 0; pointer-events: none; transition: opacity 0.15s ease; max-width: 220px; width: max-content; line-height: 1.3; }
.pp-banner-compact:hover .pp-tip-pop, .pp-banner-compact:focus-within .pp-tip-pop { opacity: 1; }
/* Stop the left-column overflow that the tooltip used to trigger: when
   overflow-y:auto is set without an explicit overflow-x, browsers
   compute X as auto too if any descendant overflows horizontally. */
.skill-list-panel { overflow-x: hidden; }
/* M227: Recommend bar. */
.recommend-bar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.45rem 1rem;
  background: rgba(0,0,0,0.18);
  border-bottom: 1px solid rgba(232,160,32,0.12);
  flex-shrink: 0; flex-wrap: wrap;
}
.recommend-btn {
  padding: 0.45rem 0.9rem;
  background: rgba(64,168,96,0.15); border: 1px solid rgba(109,220,150,0.5);
  border-radius: 6px; color: #a6f0bc;
  font-family: 'Cinzel', serif; font-size: 0.78rem; font-weight: 700;
  cursor: pointer; min-height: 44px;
}
.recommend-btn:hover:not(.disabled) { background: rgba(64,168,96,0.25); color: #d0f0dc; }
.recommend-btn.disabled { opacity: 0.45; cursor: not-allowed; }
.recommend-auto {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.75rem; color: #c0b090; cursor: pointer;
}
.recommend-auto input { accent-color: #6ddc96; }
.recommend-note { font-size: 0.72rem; color: #8a7a6a; margin-left: auto; }
.passive-panel { flex: 1; padding: 1rem 1.25rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
/* M406 — inline layout: label → auto toggle (grouped at start), points badge pushed to end */
.passive-header { display: flex; justify-content: flex-start; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.passive-header .passive-points-banner { margin-left: auto; }
.passive-points-banner { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.75rem; background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.35); border-radius: 6px; }
.pp-num { font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #e8a020; line-height: 1; }
.pp-label { font-size: 0.7rem; color: #8a7a6a; }
.passive-nodes { display: flex; flex-direction: column; gap: 0.55rem; }
.passive-nodes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.55rem; }
.passive-node { display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem 0.85rem; background: rgba(20,12,28,0.6); border: 1px solid rgba(232,160,32,0.15); border-radius: 8px; }
.passive-node.owned { border-color: rgba(232,160,32,0.45); background: rgba(232,160,32,0.1); }
.pn-index { font-family: 'Cinzel', serif; font-size: 0.95rem; font-weight: 700; color: #e8a020; min-width: 22px; text-align: center; }
.pn-info { flex: 1; }
.pn-name { font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; color: #e8e0d0; }
.pn-desc { font-size: 0.72rem; color: #c0b090; margin-top: 0.15rem; line-height: 1.35; }
.pn-rank { font-size: 0.66rem; color: #8a7a6a; margin-top: 0.25rem; letter-spacing: 0.05em; }
.pn-btn { padding: 0.5rem 0.85rem; background: rgba(232,160,32,0.18); border: 1px solid rgba(232,160,32,0.4); border-radius: 6px; color: #e8a020; font-size: 0.72rem; font-weight: 600; cursor: pointer; min-height: 44px; white-space: nowrap; }
.pn-btn:hover:not(:disabled) { background: rgba(232,160,32,0.32); }
.pn-btn.disabled, .pn-btn:disabled { opacity: 0.35; cursor: default; }
.passive-hint { font-size: 0.68rem; color: #6a5a52; text-align: center; font-style: italic; margin-top: 0.5rem; }
.passive-empty { padding: 2rem; color: #8a7a6a; text-align: center; }
.attr-section-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #e8a020; margin: 0.75rem 0 0.25rem; border-bottom: 1px solid rgba(232,160,32,0.2); padding-bottom: 0.25rem; }
.pn-extra { font-size: 0.62rem; color: #8a7a6a; font-style: italic; margin-left: 0.25rem; }

/* M276 — per-tab Auto toggle on Skills/Passive/Attributes */
/* M406 — Auto toggle sits inline next to the panel title (not far-right).
   Use flex-start gap so label + toggle are grouped together. */
.skill-panel-head { display: flex; justify-content: flex-start; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap; }
.skill-panel-head .panel-label { margin-bottom: 0; }
.auto-toggle {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.65rem; min-height: 44px; border-radius: 6px;
  background: rgba(20,12,28,0.7); border: 1px solid rgba(232,160,32,0.2);
  color: #8a7a6a; font-size: 0.7rem; font-weight: 600; cursor: pointer;
  letter-spacing: 0.05em;
}
.auto-toggle:hover { border-color: rgba(232,160,32,0.45); color: #e8a020; }
.auto-toggle.on { border-color: rgba(72,176,96,0.6); color: #6dd180; background: rgba(72,176,96,0.1); }
.auto-toggle .auto-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: #48b060; color: #06200d; font-size: 10px; font-weight: 800;
  line-height: 1;
}
/* M384 — unchecked state: gold outline circle, no background. Matches the
   surrounding button outline so the indicator reads as "available, not yet
   chosen." Becomes the solid green pip when toggled on. */
.auto-toggle .auto-check.auto-off {
  background: transparent;
  border: 1px solid rgba(232,160,32,0.7);
  color: transparent;
  font-weight: 400;
}

/* Tiny checkmark badge on the active/passive/attrs tab when Auto is on */
.smt-auto-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: #48b060; color: #06200d; font-size: 10px; font-weight: 800;
  margin-left: 0.3rem; line-height: 1;
  vertical-align: middle;
}
.smt-tab.auto-on { box-shadow: inset 0 0 0 1px rgba(72,176,96,0.35); }

/* M385 — Hard-difficulty lock state for Auto toggles */
.auto-toggle.hard-locked {
  opacity: 0.45; cursor: not-allowed; border-color: rgba(160,80,80,0.4); color: #8a6a6a;
}
.auto-lock-icon { font-size: 0.75rem; }
.recommend-auto-locked { opacity: 0.45; font-size: 0.75rem; color: #8a6a6a; display: inline-flex; align-items: center; gap: 0.25rem; }
.hard-lock-tip {
  z-index: 9999; background: rgba(20,8,8,0.95); border: 1px solid rgba(180,60,60,0.6);
  color: #e0a0a0; font-size: 0.72rem; padding: 0.35rem 0.65rem; border-radius: 6px;
  pointer-events: none; white-space: nowrap;
  animation: htip-fade 2s ease forwards;
}
@keyframes htip-fade { 0%,70%{opacity:1} 100%{opacity:0} }

/* Attributes tab — shared character-stats panel reuse */
.attrs-panel .char-stats-panel { padding: 0.5rem 0.75rem; background: rgba(20,12,28,0.5); border: 1px solid rgba(232,160,32,0.12); border-radius: 8px; }
.attrs-panel .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.78rem; gap: 0.5rem; }
.attrs-panel .stat-row:last-child { border-bottom: none; }
.attrs-panel .sr-label { color: #c0b090; }
.attrs-panel .sr-val { font-family: 'Cinzel', serif; font-weight: 700; color: #e8a020; }
.attrs-panel .stat-row-attr .sr-val { min-width: 28px; text-align: right; }
.attrs-panel .panel-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7a6a; margin-top: 0.6rem; margin-bottom: 0.3rem; }
.attrs-panel .stats-base-toggle { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.7rem; color: #8a7a6a; cursor: pointer; padding: 0.25rem 0; }
.sr-attr-btn {
  padding: 0.3rem 0.65rem; min-height: 44px;
  background: rgba(232,160,32,0.18); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 5px; color: #e8a020; font-size: 0.7rem; font-weight: 700;
  cursor: pointer; white-space: nowrap;
}
.sr-attr-btn:hover:not(:disabled) { background: rgba(232,160,32,0.32); }
.sr-attr-btn:disabled, .sr-attr-btn.disabled { opacity: 0.35; cursor: default; }
`;
