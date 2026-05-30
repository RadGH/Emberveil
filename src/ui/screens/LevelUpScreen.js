/**
 * LevelUpScreen — Post-combat summary of characters who leveled up.
 * Shows one row per character with what they earned this combat
 * (+1 Attribute / +1 Talent Point / +1 Passive Point — omitted if 0).
 * Unspent points are assigned later from the Skills menu → Attributes tab.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { getClassSkills, getUnlockedSkills, SKILLS } from '../../game/skills.js';
import { SkillTreeScreen } from './SkillTreeScreen.js';
import { PartyPanelScreen } from './PartyPanelScreen.js';
import { CLASSES } from '../../game/classes.js';
import { getPassiveTree, recalcPassiveStats, computeMaxHp, computeMaxMp } from '../../game/passives.js';

export class LevelUpScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
  }

  onEnter() { this._build(); }

  _getLeveled() {
    const gs = GameState.get();
    const all = [...gs.party, ...(gs.companions || [])];
    return all.filter(m => m && m._lastLevelUp);
  }

  // M256: apply any auto-build allocations for a character on level-up
  // and return a detail record of what was spent so the dialog can show
  // "+1 STR, +1 CON" instead of just "+2 Attributes".
  _autoApply(m) {
    const auto = m.autoBuild || {};
    const detail = { attrs: {}, passives: {}, talents: [] };
    // ATTRS
    if (auto.auto_attrs && (m.pendingAttrPoints || 0) > 0) {
      const klass = CLASSES.find(c => c.id === m.class);
      const prim = klass?.primaryAttr || 'STR';
      let guard = 0;
      while ((m.pendingAttrPoints || 0) > 0 && guard++ < 50) {
        const base = m.baseAttrs || { STR: 8, DEX: 8, INT: 8, CON: 8 };
        const cur = m.attrs || {};
        const spentPrim = (cur[prim] || 0) - (base[prim] || 0);
        const spentCon = (cur.CON || 0) - (base.CON || 0);
        const total = spentPrim + spentCon;
        const pick = (total > 0 && spentCon / total < 0.2) ? 'CON' : prim;
        m.attrs[pick] = (m.attrs[pick] || 8) + 1;
        m.pendingAttrPoints -= 1;
        detail.attrs[pick] = (detail.attrs[pick] || 0) + 1;
      }
      try { m.maxHp = computeMaxHp(m); m.maxMp = computeMaxMp(m); } catch (_) {}
    }
    // PASSIVES
    if (auto.auto_passive && (m.pendingPassivePoints || 0) > 0) {
      const tree = getPassiveTree(m.class);
      const EXOTIC = /lifesteal|life_steal|mana_regen|mana_steal|regen|lifebind|soulbind|exotic|leech|siphon/i;
      let guard = 0;
      while ((m.pendingPassivePoints || 0) > 0 && guard++ < 50) {
        if (!m.passiveRanks) m.passiveRanks = {};
        const exotic = tree.find(n => EXOTIC.test(n.id + ' ' + (n.name||'') + ' ' + (n.desc||'')) && (m.passiveRanks[n.id]||0) < n.maxRank);
        const node = exotic || tree.find(n => (m.passiveRanks[n.id]||0) < n.maxRank);
        if (!node) break;
        m.passiveRanks[node.id] = (m.passiveRanks[node.id]||0) + 1;
        m.pendingPassivePoints -= 1;
        detail.passives[node.id] = (detail.passives[node.id] || { name: node.name, count: 0 });
        detail.passives[node.id].count += 1;
      }
      try { recalcPassiveStats(m); } catch (_) {}
    }
    // TALENTS
    if (auto.auto_active && (m.pendingSkillPoints || 0) > 0) {
      const skills = getClassSkills(m.class);
      const unlocked = getUnlockedSkills(m.class, m.level || 1);
      const owned = m.talentsPurchased || (m.talentsPurchased = {});
      const sorted = [...unlocked].sort((a, b) => (a.unlockLevel||0) - (b.unlockLevel||0));
      let guard = 0;
      while ((m.pendingSkillPoints || 0) > 0 && guard++ < 50) {
        let picked = null;
        outer: for (const skill of sorted) {
          const full = skills.find(s => s.name === skill.name) || skill;
          for (const t of (full.talents || [])) {
            if (!owned[t.id]) { picked = { skill: full, talent: t }; break outer; }
          }
        }
        if (!picked) break;
        owned[picked.talent.id] = true;
        m.pendingSkillPoints -= 1;
        detail.talents.push({ skillName: picked.skill.name, talentName: picked.talent.name || picked.talent.id });
      }
    }
    return detail;
  }

  _build() {
    injectStyles('levelup-styles', LEVELUP_STYLES);
    this._el = createEl('div', 'levelup-screen');
    this.manager.uiOverlay.appendChild(this._el);

    const leveled = this._getLeveled();
    if (!leveled.length) { this.manager.pop(); return; }

    // M256: run auto-build at level-up time (instead of lazily on next
    // Skill Tree visit) so the dialog can show what was auto-applied.
    this._autoDetails = new Map();
    for (const m of leveled) this._autoDetails.set(m, this._autoApply(m));

    const rowsHtml = leveled.map(m => this._row(m)).join('');

    this._el.innerHTML = `
      <div class="lu-backdrop"></div>
      <div class="lu-panel">
        <div class="lu-header">
          <div class="lu-badge">LEVEL UP</div>
          <div class="lu-name">${leveled.length === 1 ? leveled[0].name : `${leveled.length} Heroes Advanced`}</div>
          <div class="lu-level">Your party grows stronger</div>
        </div>

        <div class="lu-rows">${rowsHtml}</div>

        ${(() => {
          // M261 follow-up: hide "Spend Now" when no leveled hero has any
          // unspent points (all allocations were handled by auto-build).
          const anyUnspent = leveled.some(m =>
            (m.pendingAttrPoints || 0) > 0 ||
            (m.pendingPassivePoints || 0) > 0 ||
            (m.pendingSkillPoints || 0) > 0
          );
          return anyUnspent
            ? `<div class="lu-bonus-note">Spend points from the Skills menu — Skills, Passive, and Attributes tabs.</div>
               <button type="button" class="lu-confirm" id="lu-spend">Spend Now</button>
               <button type="button" class="lu-confirm" id="lu-confirm">Continue</button>`
            : `<button type="button" class="lu-confirm" id="lu-confirm">Continue</button>`;
        })()}
      </div>
    `;

    this._el.querySelector('#lu-spend')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      // M357: route to Party > Spells/Passives/Attributes (whichever has
      // pending points first, in that priority order). Replaces the legacy
      // hop into the SkillTreeScreen.
      const aggSkill = leveled.reduce((s, m) => s + (m.pendingSkillPoints || 0), 0);
      const aggPassive = leveled.reduce((s, m) => s + (m.pendingPassivePoints || 0), 0);
      const aggAttr = leveled.reduce((s, m) => s + (m.pendingAttrPoints || 0), 0);
      let tab = 'spells';
      if (aggSkill === 0 && aggPassive > 0) tab = 'passives';
      else if (aggSkill === 0 && aggPassive === 0 && aggAttr > 0) tab = 'attributes';
      for (const m of leveled) { delete m._lastLevelUp; }
      try { SaveManager.saveCurrentGame(); } catch (_) {}
      this.manager.pop();
      this.manager.push(new PartyPanelScreen(this.manager, this.audio, { tab }));
    });

    this._el.querySelector('#lu-confirm')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      // Clear the one-shot markers so we don't re-show them next combat.
      for (const m of leveled) { delete m._lastLevelUp; }
      try { SaveManager.saveCurrentGame(); } catch (_) {}
      this.manager.pop();
    });

    // M297: keyboard navigation — focus the primary confirm button.
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: true,
      onEscape: () => {
        // Treat Escape as Continue
        for (const m of leveled) { delete m._lastLevelUp; }
        try { SaveManager.saveCurrentGame(); } catch (_) {}
        this.manager.pop();
      },
    });
  }

  _row(m) {
    const d = m._lastLevelUp || { from: m.level, to: m.level, attr: 0, skill: 0, passive: 0 };
    const auto = this._autoDetails?.get(m) || { attrs: {}, passives: {}, talents: [] };

    // M256: if auto was on for a category, show the specific allocations
    // in that category's color; otherwise show the summary badge.
    const awards = [];
    const attrKeys = Object.keys(auto.attrs);
    if (attrKeys.length) {
      const parts = attrKeys.map(k => `+${auto.attrs[k]} ${k}`).join(', ');
      awards.push(`<span class="lu-award lu-a-attr">Auto: ${parts}</span>`);
    } else if (d.attr > 0) {
      awards.push(`<span class="lu-award lu-a-attr">+${d.attr} Attributes</span>`);
    }
    if (auto.talents.length) {
      const parts = auto.talents.map(t => `${t.skillName}: ${t.talentName}`).join(' · ');
      awards.push(`<span class="lu-award lu-a-talent">Auto talent: ${parts}</span>`);
    } else if (d.skill > 0) {
      awards.push(`<span class="lu-award lu-a-talent">+${d.skill} Talent Point${d.skill>1?'s':''}</span>`);
    }
    const passiveIds = Object.keys(auto.passives);
    if (passiveIds.length) {
      const parts = passiveIds.map(id => {
        const c = auto.passives[id].count;
        return `+${c} ${auto.passives[id].name}`;
      }).join(', ');
      awards.push(`<span class="lu-award lu-a-passive">Auto passive: ${parts}</span>`);
    } else if (d.passive > 0) {
      awards.push(`<span class="lu-award lu-a-passive">+${d.passive} Passive Point${d.passive>1?'s':''}</span>`);
    }

    // Newly unlocked skills — spell-out wording "New Skill:" per user.
    let newSkillsHtml = '';
    try {
      const classId = m.class || m.classId;
      if (classId) {
        const all = getClassSkills(classId) || [];
        const newSkills = all.filter(s => s.unlockLevel > d.from && s.unlockLevel <= d.to);
        if (newSkills.length) {
          newSkillsHtml = `<div class="lu-row-unlocks">${newSkills.map(s => `<strong>New Skill:</strong> ✦ ${s.name}`).join(' · ')}</div>`;
        }
      }
    } catch (_) {}

    return `
      <div class="lu-row">
        <div class="lu-row-main">
          <div class="lu-row-name">${m.name}</div>
          <div class="lu-row-level">Lv ${d.from} → ${d.to}</div>
        </div>
        <div class="lu-row-awards">${awards.join('')}</div>
        ${newSkillsHtml}
      </div>
    `;
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  update() {}
  draw() {}
  onExit() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
}

const LEVELUP_STYLES = `
.levelup-screen {
  /* M412 — pinned at z-index 100 + opaque base so it fully obscures any
     underlying screen DOM (dungeon, town). Was leaking dg-screen behind it. */
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: 'Inter', sans-serif; color: #f0e8d8;
  z-index: 100;
  background: #050208;
  pointer-events: auto;
}
.lu-backdrop {
  position: absolute; inset: 0;
  /* Solid base + radial highlight on top so partial transparencies in the
     gradient never reveal the screen below. */
  background:
    radial-gradient(ellipse at center, rgba(232,160,32,0.10) 0%, rgba(5,2,8,0.0) 70%),
    #050208;
}
.lu-panel {
  position: relative; z-index: 2; width: 100%; max-width: 420px;
  padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1rem;
}
.lu-header { text-align: center; }
.lu-badge {
  display: inline-block; padding: 0.2rem 0.8rem; border-radius: 4px;
  background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.4);
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.18em; color: #e8a020;
  margin-bottom: 0.5rem;
}
.lu-name { font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #f0e8d8; }
.lu-level { font-size: 0.72rem; color: #8a7a6a; margin-top: 0.2rem; font-style: italic; }
.lu-rows { display: flex; flex-direction: column; gap: 0.5rem; }
.lu-row {
  background: rgba(20,14,18,0.85); border: 1px solid rgba(232,160,32,0.22);
  border-radius: 8px; padding: 0.7rem 0.85rem;
  display: flex; flex-direction: column; gap: 0.35rem;
}
.lu-row-main { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.lu-row-name { font-family: 'Cinzel', serif; font-size: 0.95rem; font-weight: 700; color: #f0e8d8; }
.lu-row-level { font-size: 0.72rem; color: #e8a020; font-weight: 600; letter-spacing: 0.05em; }
.lu-row-awards { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.lu-award {
  font-size: 0.7rem; font-weight: 600;
  padding: 0.15rem 0.5rem; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
}
.lu-a-attr    { color: #e8a020; background: rgba(232,160,32,0.10); border-color: rgba(232,160,32,0.35); }
.lu-a-talent  { color: #78c8ff; background: rgba(64,128,224,0.10); border-color: rgba(120,200,255,0.35); }
.lu-a-passive { color: #c090ff; background: rgba(112,64,192,0.10); border-color: rgba(192,144,255,0.35); }
.lu-row-unlocks { font-size: 0.68rem; color: #ffd078; font-style: italic; }
.lu-bonus-note { font-size: 0.68rem; color: #6a5a52; font-style: italic; text-align: center; }
.lu-confirm {
  padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(232,160,32,0.4);
  background: rgba(232,160,32,0.12); color: #e8a020; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; font-family: 'Cinzel', serif; letter-spacing: 0.05em;
  transition: background 0.15s;
}
.lu-confirm:hover:not(:disabled) { background: rgba(232,160,32,0.22); }
`;
