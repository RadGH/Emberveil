/**
 * HireBuilderScreen — mini character builder for custom mercenary hiring
 *
 * Cost formula: BASE_COST * level * (1 + SCALING * (level - 1))
 *   L1=100, L2=220, L3=360, L5=700, L10=1900
 *
 * Attribute points: 8 at level 1, +2 per level (matches normal progression).
 * Attributes do NOT affect cost — only level does.
 *
 * Flow: Class → Stats → Skills/Talents/Passives → Confirm Hire
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { CB_STYLES } from './characterBuilderStyles.js';
import { preserveScroll } from '../components/ScrollPreserve.js';
import { CLASSES } from '../../game/classes.js';
import { GameState } from '../../game/gameState.js';
import { expectedTalentPoints } from '../../game/xp.js';
import { getSpriteAdjustment } from '../../game/spriteAdjustments.js';
import { getSpritePath } from '../../game/spriteUtils.js';
import { buildStartingEquipment, getStartingEquipmentNames, generateItem, WEAPON_BASES } from '../../game/items.js';
import { isClassUnlocked, getUnlockedClassIds, getUnlockRequirement, getTotalClassCount, syncFromGameState, STARTING_CLASS_IDS } from '../../game/classUnlocks.js';
import { getClassSkills, getUnlockedSkills, SKILLS } from '../../game/skills.js';
import { getPassiveTree } from '../../game/passives.js';
import { getAllAppearances, getDefaultAppearance, resolveGender } from '../../game/appearances.js';
// M253 hotfix: pull directly from nameGen to avoid chaining through
// CharacterBuilderScreen (which transitively imports TownScreen).
import { rollRandomHeroName as _rollRandomHeroName } from '../../game/nameGen.js';
import { getBalance } from '../../game/balance-loader.js';
import { autoAssignAttrs } from '../../game/simulator.js';
import { getDefaultBuild, getBuilds } from '../../game/buildPresets.js';

const ATTRS = ['STR', 'DEX', 'INT', 'CON'];
const _HB_ATTR_DESC = {
  STR: 'Physical power',
  DEX: 'Agility & accuracy',
  INT: 'Arcane potency',
  CON: 'Vitality',
};
// Read from balance config at module-eval. If config is swapped post-boot the
// page will reload naturally; accessors below re-read for safety.
const BASE_VALUE = getBalance().heroes.creation.baseAttrValue;
// Back-compat local refs (callers within this file read fresh from balance).
const _cfgHeroes = () => getBalance().heroes;

export class HireBuilderScreen {
  /**
   * @param {object} manager
   * @param {object} audio
   * @param {object} [options]
   * @param {object} [options.recruit]  — when set, skip class/gold steps and pre-fill
   *   from a dialog recruitHero outcome. Shape:
   *   { id: string, name: string, classId: string, level: number,
   *     onConfirm: function(hero), onCancel: function }
   */
  constructor(manager, audio, options = {}) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    // ── recruit-from-dialog mode ──────────────────────────────────────────────
    // When present, the class/gold screens are skipped. The builder opens
    // directly at the build step (or stats if no build presets), pre-filled
    // with the NPC's id, name, class, and average-party level. onConfirm
    // receives the fully-built hero object; onCancel fires if the player
    // backs out past the first step.
    this._recruitMode = options.recruit || null;
    // ─────────────────────────────────────────────────────────────────────────
    this._name = '';
    this._class = null;
    this._attrs = { STR: BASE_VALUE, DEX: BASE_VALUE, INT: BASE_VALUE, CON: BASE_VALUE };
    this._pointsSpent = 0;
    this._level = 1;
    this._step = 'class'; // 'class' | 'build' | 'stats' | 'skills'
    this._buildChoice = null; // M412 — build preset chosen on the new build step
    // Skill/talent/passive state for the hire preview
    this._skillTab = 'active'; // 'active' | 'passive'
    this._selectedSkill = null;
    this._talentsPurchased = {};
    this._passiveRanks = {};
    this._skillPointsUsed = 0;
    this._passivePointsUsed = 0;
    this._appearance = null;
    this._autoAttrs = false;
    this._autoAttrsSavedAttrs = null;
    this._autoAttrsSavedSpent = 0;
    // M412 — persistent auto flags for hire (Auto Inventory/Passives/Spell Talents)
    this._autoEquip = false;
    this._autoPassive = false;
    this._autoActive = false;
    // Gender filter for appearance picker: 'all' | 'male' | 'female'
    this._genderFilter = (() => {
      try { return sessionStorage.getItem('cb_gender_filter') || 'all'; } catch { return 'all'; }
    })();

    // Pre-fill recruit fields before the first render
    if (this._recruitMode) {
      const r = this._recruitMode;
      const cls = CLASSES.find(c => c.id === r.classId) || CLASSES[0];
      this._class = cls;
      this._level = Math.max(1, r.level || 1);
      this._name = r.name || cls.name;
      // Appearance: match the NPC sprite id against the appearances registry;
      // fall back to class default. getAllAppearances is synchronously imported.
      const allApps = getAllAppearances();
      this._appearance = allApps.find(a => a.id === r.id || a.sprite === r.id)
        || getDefaultAppearance(cls.id);

      // M494 — optional class-choice step. When the event supplies
      // classChoices, the player picks one up front (only valid ids that
      // exist in CLASSES are offered). There is no "Back" — the dialog
      // already popped; the only exits are forward (pick → build) or the
      // header ✕ which cancels the whole recruit recoverably.
      this._recruitClassChoices = (Array.isArray(r.classChoices) ? r.classChoices : [])
        .filter(id => CLASSES.some(c => c.id === id));
      if (this._recruitClassChoices.length > 1) {
        this._step = 'recruitClass';
        // Default selection = supplied classId if it's in the list, else first.
        const def = this._recruitClassChoices.includes(r.classId)
          ? r.classId : this._recruitClassChoices[0];
        this._class = CLASSES.find(c => c.id === def) || cls;
        this._appearance = allApps.find(a => a.id === r.id || a.sprite === r.id)
          || getDefaultAppearance(this._class.id);
      } else {
        if (this._recruitClassChoices.length === 1) {
          this._class = CLASSES.find(c => c.id === this._recruitClassChoices[0]) || cls;
          this._appearance = allApps.find(a => a.id === r.id || a.sprite === r.id)
            || getDefaultAppearance(this._class.id);
        }
        this._routeRecruitToBuild();
      }
      if (window.__recruitDebug) {
        try { console.log('[recruit] builder ctor', { id: r.id, classId: r.classId, classChoices: this._recruitClassChoices, step: this._step }); } catch {}
      }
    }
  }

  // Route a recruit (no class-choice, or after picking one) to the build
  // step if the class has presets, else straight to stats.
  _routeRecruitToBuild() {
    const builds = getBuilds(this._class?.id) || [];
    if (builds.length) {
      this._buildChoice = getDefaultBuild(this._class.id) || builds[0];
      this._step = 'build';
    } else {
      this._step = 'stats';
    }
  }

  get _totalFreePoints() {
    const c = _cfgHeroes().creation;
    return c.baseAttrPoints + (this._level - 1) * c.attrPointsPerLevel;
  }
  get _pointsLeft() { return this._totalFreePoints - this._pointsSpent; }

  _maxPartyLevel() {
    const gs = GameState.get();
    const all = [...(gs.party || []), ...(gs.bench || [])];
    return Math.max(1, ...all.map(m => m.level || 1));
  }

  _hireCost() {
    const hc = _cfgHeroes().hireCost;
    return Math.round(hc.base * this._level * (1 + hc.scaling * (this._level - 1)));
  }

  _totalTalentPoints() { return expectedTalentPoints(this._level); }
  _talentPointsLeft() { return this._totalTalentPoints() - this._skillPointsUsed; }
  _totalPassivePoints() { return Math.max(0, this._level - 1); }
  _passivePointsLeft() { return this._totalPassivePoints() - this._passivePointsUsed; }

  onEnter() {
    // The stats/skills steps and the recruit class-choice step use the
    // gold/brown .cb-* theme. Those styles are normally injected only when
    // CharacterBuilderScreen mounts (game start / hero creation). When the
    // hire or recruit builder is opened from a loaded save where the
    // creator never mounted this session, the .cb-* markup renders
    // unstyled white. Inject the shared sheet here too (idempotent by id)
    // so the builder is always themed. (M494 bug #2 fix.)
    injectStyles('cb-styles', CB_STYLES);
    injectStyles('hire-builder-styles', HIRE_STYLES);
    this._el = createEl('div', 'hb-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    preserveScroll(this._el, () => {
      this._el.innerHTML = '';
      if (this._step === 'recruitClass') this._renderRecruitClassStep();
      else if (this._step === 'class') this._renderClassStep();
      else if (this._step === 'build') this._renderBuildStep();
      else if (this._step === 'stats') this._renderStatsStep();
      else if (this._step === 'skills') this._renderSkillsStep();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cancel the whole recruit (header ✕ in recruit mode).
  // Pops the builder and fires onCancel so MapScreen leaves the player on the
  // map with the NPC un-recruited and the encounter NOT consumed (the dialog
  // node re-fires on re-walk). Safe even though the dialog already popped.
  // ═══════════════════════════════════════════════════════════════════════════
  _cancelRecruit() {
    const r = this._recruitMode;
    if (window.__recruitDebug) {
      try { console.log('[recruit] builder ✕ cancel', { step: this._step }); } catch {}
    }
    this.manager.pop();
    if (r && typeof r.onCancel === 'function') r.onCancel();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M494 — Recruit class-choice step. Shown only when the event supplied
  // classChoices (≥2 valid ids). Uses the same gold/brown .cb-* theme as the
  // stats step. No "Back" (the dialog is gone — nothing to go back to); the
  // only exits are picking a class (→ build/stats) or the header ✕ (cancel).
  // ═══════════════════════════════════════════════════════════════════════════
  _renderRecruitClassStep() {
    const choices = (this._recruitClassChoices || [])
      .map(id => CLASSES.find(c => c.id === id))
      .filter(Boolean);
    const npcName = this._name || this._recruitMode?.name || 'this recruit';
    this._el.innerHTML = `
      <div class="cb-header">
        <button type="button" class="hb-x-btn" id="hb-recruit-x" aria-label="Cancel recruit" title="Cancel — you can talk to them again later">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
        </button>
        <div class="cb-title">Recruit ${npcName}</div>
        <div class="cb-subtitle">Choose how ${npcName} fights</div>
      </div>
      <div class="cb-class-grid" id="hb-recruit-class-grid">
        ${choices.map(cls => {
          const startNames = getStartingEquipmentNames(cls.startingEquipment || []).join(', ') || cls.armorType || '';
          return `
            <div class="cb-class-card${this._class?.id === cls.id ? ' selected' : ''}" data-rcls="${cls.id}" role="button" tabindex="0">
              <div class="cb-class-icon">${cls.svgIcon || ''}</div>
              <div class="cb-class-name">${cls.name}</div>
              <div class="cb-class-role">${cls.role || ''}</div>
              <div class="cb-class-hook">${cls.hook || ''}</div>
              <div class="cb-class-armor">Starts with: ${startNames}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="cb-footer">
        <button type="button" class="cb-btn cb-btn-ghost" id="hb-recruit-cancel">Not now</button>
        <button type="button" class="cb-btn cb-btn-gold" id="hb-recruit-class-next">Continue →</button>
      </div>
    `;
    const selectCard = (id) => {
      const cls = CLASSES.find(c => c.id === id);
      if (!cls) return;
      this._class = cls;
      // Appearance follows the chosen class unless the NPC has a dedicated one
      const allApps = getAllAppearances();
      const r = this._recruitMode;
      this._appearance = allApps.find(a => a.id === r?.id || a.sprite === r?.id)
        || getDefaultAppearance(cls.id);
      this._el.querySelectorAll('.cb-class-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.rcls === id));
    };
    this._el.querySelectorAll('[data-rcls]').forEach(card => {
      card.addEventListener('click', () => { this.audio.playSfx('click'); selectCard(card.dataset.rcls); });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.audio.playSfx('click'); selectCard(card.dataset.rcls); }
      });
    });
    this._el.querySelector('#hb-recruit-x').addEventListener('click', () => { this.audio.playSfx('click'); this._cancelRecruit(); });
    this._el.querySelector('#hb-recruit-cancel').addEventListener('click', () => { this.audio.playSfx('click'); this._cancelRecruit(); });
    this._el.querySelector('#hb-recruit-class-next').addEventListener('click', () => {
      this.audio.playSfx('click');
      if (!this._class) return;
      if (window.__recruitDebug) {
        try { console.log('[recruit] class chosen', this._class.id); } catch {}
      }
      this._routeRecruitToBuild();
      this._render();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Class selection (with unlock gating)
  // ═══════════════════════════════════════════════════════════════════════════

  _renderClassStep() {
    // Sync unlocks from current game state
    try { syncFromGameState(GameState.get?.()); } catch {}
    const unlockedIds = getUnlockedClassIds();
    const totalClasses = getTotalClassCount();

    // Sort: starter classes first (fixed order), then other unlocked, then locked
    const STARTER_ORDER = ['warrior', 'fighter', 'ranger', 'rogue', 'mage'];
    const sortedClasses = [...CLASSES].sort((a, b) => {
      const aLocked = unlockedIds.has(a.id) ? 0 : 1;
      const bLocked = unlockedIds.has(b.id) ? 0 : 1;
      if (aLocked !== bLocked) return aLocked - bLocked;
      const aStarter = STARTER_ORDER.indexOf(a.id);
      const bStarter = STARTER_ORDER.indexOf(b.id);
      if (aStarter !== -1 || bStarter !== -1) {
        if (aStarter === -1) return 1;
        if (bStarter === -1) return -1;
        return aStarter - bStarter;
      }
      return CLASSES.indexOf(a) - CLASSES.indexOf(b);
    });

    this._el.innerHTML = `
      <div class="hb-header">
        <div class="hb-title">Hire Custom</div>
        <div class="hb-subtitle">Choose class</div>
        <div class="hb-unlock-counter">${unlockedIds.size} / ${totalClasses} classes unlocked</div>
      </div>
      <div class="hb-class-grid" id="hb-class-grid"></div>
      <div class="hb-footer">
        <button type="button" class="hb-btn hb-btn-ghost" id="hb-cancel">Cancel</button>
        <button type="button" class="hb-btn hb-btn-primary" id="hb-next" disabled>Next</button>
      </div>
    `;
    const grid = this._el.querySelector('#hb-class-grid');
    for (const cls of sortedClasses) {
      const locked = !unlockedIds.has(cls.id);
      const req = getUnlockRequirement(cls.id);
      const card = createEl('div', `hb-class-card${this._class?.id === cls.id ? ' selected' : ''}${locked ? ' locked' : ''}`);
      // Match Create Hero (CharacterBuilderScreen) card structure so the two
      // screens look identical. M151.
      if (locked) {
        card.innerHTML = `
          <div class="hb-cls-icon">${cls.svgIcon || ''}</div>
          <div class="hb-cls-name">${cls.name} <span class="hb-cls-lock-ico">🔒</span></div>
          <div class="hb-cls-role">${cls.role}</div>
          <div class="hb-cls-hook">${cls.hook || ''}</div>
          ${req ? `<div class="hb-cls-lock">Unlock: ${req.label}</div>` : ''}
        `;
        card.title = req ? `Locked — ${req.label}` : 'Locked';
      } else {
        const startNames = getStartingEquipmentNames(cls.startingEquipment || []).join(', ') || cls.armorType || '';
        card.innerHTML = `
          <div class="hb-cls-icon">${cls.svgIcon || ''}</div>
          <div class="hb-cls-name">${cls.name}</div>
          <div class="hb-cls-role">${cls.role}</div>
          <div class="hb-cls-hook">${cls.hook || ''}</div>
          <div class="hb-cls-prefs">Starts with: ${startNames}</div>
        `;
      }
      if (!locked) {
        card.addEventListener('click', () => {
          this._class = cls;
          // Default appearance follows the class; player can swap on the Stats step.
          this._appearance = getDefaultAppearance(cls.id);
          this._el.querySelectorAll('.hb-class-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this._el.querySelector('#hb-next').disabled = false;
        });
      }
      grid.appendChild(card);
    }
    this._el.querySelector('#hb-cancel').addEventListener('click', () => { this.audio.playSfx('click'); this.manager.pop(); });
    this._el.querySelector('#hb-next').addEventListener('click', () => {
      if (!this._class) return;
      this.audio.playSfx('click');
      // M412 — route through the new Build step before stats so Auto knows
      // which build preset to follow (matches CharacterBuilderScreen flow).
      const builds = getBuilds(this._class.id) || [];
      if (builds.length) {
        this._buildChoice = getDefaultBuild(this._class.id) || builds[0];
        this._step = 'build';
      } else {
        this._step = 'stats';
      }
      this._render();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1.5 (M412): Build picker — mirrors CharacterBuilderScreen._renderBuildStep
  // ═══════════════════════════════════════════════════════════════════════════
  _renderBuildStep() {
    const el = this._el;
    const classId = this._class?.id;
    const builds = getBuilds(classId) || [];
    if (!builds.length) { this._step = 'stats'; this._render(); return; }
    if (!this._buildChoice) this._buildChoice = builds[0];
    const isRecruit = !!this._recruitMode;
    el.innerHTML = `
      <div class="cb-header">
        ${isRecruit ? `<button type="button" class="hb-x-btn" id="hb-build-x" aria-label="Cancel recruit" title="Cancel — you can talk to them again later">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
        </button>` : ''}
        <div class="cb-title">Pick a Build</div>
        <div class="cb-subtitle">${this._class?.name || ''} — auto-allocator follows the chosen build's attribute targets and skill priorities.</div>
      </div>
      <div class="cb-build-grid" id="hb-build-grid">
        ${builds.map(b => `
          <button type="button" class="cb-build-card${this._buildChoice?.id === b.id ? ' selected' : ''}" data-build="${b.id}">
            <div class="cb-build-name">${b.name}</div>
            <div class="cb-build-tags">${(b.tags || []).map(t => `<span class="cb-build-tag">${t}</span>`).join('')}</div>
            <div class="cb-build-attrs">
              <span class="cb-build-attr cb-build-attr-str">STR ${b.targetAttrs.STR}%</span>
              <span class="cb-build-attr cb-build-attr-dex">DEX ${b.targetAttrs.DEX}%</span>
              <span class="cb-build-attr cb-build-attr-int">INT ${b.targetAttrs.INT}%</span>
              <span class="cb-build-attr cb-build-attr-con">CON ${b.targetAttrs.CON}%</span>
            </div>
            <div class="cb-build-desc">${b.description || ''}</div>
            <div class="cb-build-skills"><strong>Preferred:</strong> ${(b.preferredSkills || []).slice(0, 4).join(', ')}</div>
          </button>
        `).join('')}
      </div>
      <div class="cb-footer">
        ${isRecruit
          ? `<button type="button" class="cb-btn cb-btn-ghost" id="hb-build-back">Not now</button>`
          : `<button type="button" class="cb-btn cb-btn-ghost" id="hb-build-back">← Class</button>`}
        <button type="button" class="cb-btn cb-btn-gold" id="hb-build-next">Next →</button>
      </div>
    `;
    el.querySelectorAll('[data-build]').forEach(card => {
      card.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._buildChoice = builds.find(b => b.id === card.dataset.build) || null;
        this._render();
      });
    });
    el.querySelector('#hb-build-x')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._cancelRecruit();
    });
    el.querySelector('#hb-build-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      if (this._recruitMode) {
        // Recruit mode: there's no class step to go back to (dialog popped).
        // "Not now" cancels the whole recruit — recoverable: the encounter
        // is NOT consumed, so re-walking the node re-fires the dialog.
        this._cancelRecruit();
      } else {
        this._step = 'class';
        this._render();
      }
    });
    el.querySelector('#hb-build-next').addEventListener('click', () => { this.audio.playSfx('click'); this._step = 'stats'; this._render(); });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: Level + Attribute allocation
  // ═══════════════════════════════════════════════════════════════════════════

  _renderStatsStep() {
    const cls = this._class;
    const isRecruit = !!this._recruitMode;
    const cost = isRecruit ? 0 : this._hireCost();
    const gold = GameState.getGold();
    const canAfford = isRecruit || gold >= cost;
    // In recruit mode, level is pre-set to avg party level; still allow fine-tuning
    const maxLvl = this._maxPartyLevel();

    // M242: layout rewritten to match Create Character's stats step.
    // Uses .cb-* classes (gold/brown, 480 max-width, centered, scrollable
    // appearance grid capped at ~3 rows tall). Retains the hb-name-row,
    // level meter, skill-points indicator, and adds an Estimated Stats
    // preview panel like the Create Character screen.
    this._el.innerHTML = `
      <div class="cb-header">
        ${isRecruit ? `<button type="button" class="hb-x-btn" id="hb-stats-x" aria-label="Cancel recruit" title="Cancel — you can talk to them again later">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
        </button>` : ''}
        <div class="cb-title">${isRecruit ? (this._name || cls.name) : cls.name + ' Mercenary'}</div>
        <div class="cb-subtitle">${isRecruit ? `Recruit a ${cls.name} — configure their build` : `Configure and hire — ${cost} gold`}</div>
      </div>
      <div class="cb-stats-area" style="max-width:480px;margin:0 auto;width:100%">
        <div class="cb-name-row">
          <label class="cb-label">Name</label>
          <div style="display:flex;gap:0.4rem;align-items:stretch">
            <input class="cb-name-input" id="hb-name" type="text" maxlength="24" placeholder="Mercenary name..." value="${this._name}" style="flex:1">
            <button type="button" id="hb-name-roll" class="cb-dice-btn" title="Random name" aria-label="Roll random name"
              style="min-width:44px;min-height:44px;padding:0 0.5rem;background:rgba(232,160,32,0.12);border:1px solid rgba(232,160,32,0.45);border-radius:6px;color:#e8a020;cursor:pointer;display:flex;align-items:center;justify-content:center">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8" cy="8" r="1.2" fill="currentColor"></circle><circle cx="16" cy="8" r="1.2" fill="currentColor"></circle><circle cx="12" cy="12" r="1.2" fill="currentColor"></circle><circle cx="8" cy="16" r="1.2" fill="currentColor"></circle><circle cx="16" cy="16" r="1.2" fill="currentColor"></circle></svg>
            </button>
          </div>
        </div>
        <div class="cb-appearance-row">
          <label class="cb-label">Appearance <span class="cb-sub-label">(cosmetic — does not change skills)</span></label>
          <div class="cb-appearance-grid hb-appearance-scroll" id="hb-appearance-grid"></div>
        </div>
        <div class="cb-level-row">
          <label class="cb-label">Level</label>
          <div class="cb-level-controls">
            <button type="button" class="cb-attr-btn hb-lvl-dec" ${this._level <= 1 ? 'disabled' : ''}>−</button>
            <div class="cb-attr-val">${this._level}</div>
            <button type="button" class="cb-attr-btn hb-lvl-inc" ${this._level >= maxLvl ? 'disabled' : ''}>+</button>
            <span class="cb-level-cap">max ${maxLvl}</span>
          </div>
        </div>
        <div class="cb-points-banner">
          <span id="pts-left">${this._pointsLeft}</span> attribute points remaining
          <label class="hb-auto-attrs" style="margin-left:0.75rem;font-size:0.75rem;cursor:pointer;color:#e8a020;display:inline-flex;align-items:center;align-self:center;gap:0.3rem;line-height:1">
            <input type="checkbox" id="hb-auto-attrs" ${this._autoAttrs ? 'checked' : ''} style="margin:0;vertical-align:middle">
            <span style="line-height:1">Auto</span>
          </label>
        </div>
        <div class="cb-attrs" id="attr-panel">
          ${ATTRS.map(attr => `
            <div class="cb-attr-row">
              <div class="cb-attr-info">
                <div class="cb-attr-name">${attr}</div>
                <div class="cb-attr-desc">${_HB_ATTR_DESC[attr] || ''}</div>
              </div>
              <div class="cb-attr-controls">
                <button type="button" class="cb-attr-btn hb-attr-dec" data-attr="${attr}" ${this._attrs[attr] <= BASE_VALUE ? 'disabled' : ''}>−</button>
                <div class="cb-attr-val">${this._attrs[attr]}</div>
                <button type="button" class="cb-attr-btn hb-attr-inc" data-attr="${attr}" ${this._pointsLeft <= 0 ? 'disabled' : ''}>+</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="cb-preview-panel">
          <div class="cb-preview-title">Estimated Stats at Level ${this._level}</div>
          <div class="cb-preview-grid" id="preview-grid"></div>
        </div>
        ${isRecruit ? '' : `<div class="hb-cost-display ${canAfford ? '' : 'hb-cost-warn'}" style="margin-top:1rem;text-align:center;font-family:'Cinzel',serif;font-size:1rem;color:${canAfford ? '#e8a020' : '#c04030'}">Hire Cost: ${cost} gold</div>`}
        ${(GameState.get()?.manualCharacters) ? '' : `
        <div class="hb-auto-options" style="margin-top:0.6rem;padding:0.55rem 0.7rem;background:rgba(232,160,32,0.07);border:1px solid rgba(232,160,32,0.25);border-radius:6px;display:flex;flex-direction:column;gap:0.35rem;font-size:0.78rem;color:#d8c8a0">
          <div style="font-weight:600;color:#e8a020">Auto-management (toggleable later)</div>
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer"><input type="checkbox" id="hb-auto-equip" ${this._autoEquip ? 'checked' : ''}> Auto Inventory</label>
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer"><input type="checkbox" id="hb-auto-passive" ${this._autoPassive ? 'checked' : ''}> Auto Passives</label>
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer"><input type="checkbox" id="hb-auto-active" ${this._autoActive ? 'checked' : ''}> Auto Spell Talents</label>
        </div>
        `}
      </div>
      <div class="cb-footer">
        <button type="button" class="cb-btn cb-btn-ghost" id="hb-back">← Back</button>
        <button type="button" class="cb-btn cb-btn-gold" id="hb-next-skills">${this._skillsStepSkippable() ? (this._recruitMode ? `Recruit ${this._name || ''}`.trim() : 'Confirm Hire') : 'Skills →'}</button>
      </div>
    `;
    this._updateHirePreview();

    this._el.querySelector('#hb-name').addEventListener('input', e => { this._name = e.target.value; });
    this._el.querySelector('#hb-name-roll')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      const input = this._el.querySelector('#hb-name');
      const name = _rollRandomHeroName(this._appearance);
      input.value = name;
      this._name = name;
    });
    this._el.querySelector('#hb-stats-x')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._cancelRecruit();
    });
    this._el.querySelector('#hb-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      // In recruit mode, go back to build step (if presets), else the
      // class-choice step (if one was offered), else cancel recoverably.
      const builds = getBuilds(this._class?.id) || [];
      if (this._recruitMode) {
        if (builds.length) {
          this._step = 'build';
          this._render();
        } else if ((this._recruitClassChoices || []).length > 1) {
          this._step = 'recruitClass';
          this._render();
        } else {
          // No build step, no class choice — back from stats = cancel
          this._cancelRecruit();
        }
      } else {
        // M412 — return to the build step if the class has presets, else class.
        this._step = builds.length ? 'build' : 'class';
        this._render();
      }
    });

    this._renderAppearancePicker();

    this._el.querySelector('.hb-lvl-inc')?.addEventListener('click', () => {
      if (this._level >= this._maxPartyLevel()) return;
      this._level++;
      this.audio.playSfx('click');
      this._render();
    });
    this._el.querySelector('.hb-lvl-dec')?.addEventListener('click', () => {
      if (this._level <= 1) return;
      this._level--;
      // Clamp spent points to new budget
      while (this._pointsSpent > this._totalFreePoints) {
        const over = ATTRS.find(a => this._attrs[a] > BASE_VALUE);
        if (!over) break;
        this._attrs[over]--;
        this._pointsSpent--;
      }
      // Clamp talent/passive points when level drops
      this._clampSkillPoints();
      this.audio.playSfx('click');
      this._render();
    });

    this._el.querySelectorAll('.hb-attr-inc').forEach(btn => {
      if (this._autoAttrs) { btn.disabled = true; btn.style.opacity = '0.4'; }
      btn.addEventListener('click', () => {
        if (this._autoAttrs) return;
        if (this._pointsLeft <= 0) return;
        this._attrs[btn.dataset.attr]++;
        this._pointsSpent++;
        this.audio.playSfx('click');
        this._render();
      });
    });
    this._el.querySelectorAll('.hb-attr-dec').forEach(btn => {
      if (this._autoAttrs) { btn.disabled = true; btn.style.opacity = '0.4'; }
      btn.addEventListener('click', () => {
        if (this._autoAttrs) return;
        const attr = btn.dataset.attr;
        if (this._attrs[attr] <= BASE_VALUE) return;
        this._attrs[attr]--;
        this._pointsSpent--;
        this.audio.playSfx('click');
        this._render();
      });
    });

    this._el.querySelector('#hb-auto-equip')?.addEventListener('change', e => { this._autoEquip = !!e.target.checked; this.audio.playSfx('click'); });
    this._el.querySelector('#hb-auto-passive')?.addEventListener('change', e => { this._autoPassive = !!e.target.checked; this.audio.playSfx('click'); this._render(); });
    this._el.querySelector('#hb-auto-active')?.addEventListener('change', e => { this._autoActive = !!e.target.checked; this.audio.playSfx('click'); this._render(); });
    this._el.querySelector('#hb-auto-attrs')?.addEventListener('change', e => {
      this._autoAttrs = !!e.target.checked;
      this.audio.playSfx('click');
      if (this._autoAttrs) {
        this._autoAttrsSavedAttrs = { ...this._attrs };
        this._autoAttrsSavedSpent = this._pointsSpent;
        // M412 — honor the player-picked build first, then fall back to the
        // class default if the build step was skipped.
        const build = this._buildChoice
          || getDefaultBuild(this._class.id)
          || (getBuilds(this._class.id) || [])[0]
          || null;
        try {
          const auto = autoAssignAttrs(this._class.id, this._level, { build });
          const out = { ...auto };
          let spent = (out.STR - BASE_VALUE) + (out.DEX - BASE_VALUE) + (out.INT - BASE_VALUE) + (out.CON - BASE_VALUE);
          // Trim if over budget.
          while (spent > this._totalFreePoints) {
            const k = ['STR','DEX','INT','CON'].sort((a,b) => out[b] - out[a])[0];
            out[k]--;
            spent--;
          }
          // M412 — top-off any leftover points so Auto always spends ALL points.
          // autoAssignAttrs uses its own per-level budget which can be smaller
          // than _totalFreePoints, leaving the player with unspent points.
          // Distribute leftovers across stats by build weight (or class primary
          // if no build), highest weight first.
          const weights = build?.targetAttrs || (() => {
            const prim = (this._class?.primaryAttr || 'STR').toUpperCase();
            const w = { STR: 5, DEX: 5, INT: 5, CON: 10 };
            w[prim] = 60;
            return w;
          })();
          const ranked = ['STR','DEX','INT','CON'].sort((a, b) => (weights[b] || 0) - (weights[a] || 0));
          let safety = 100;
          while (spent < this._totalFreePoints && safety-- > 0) {
            const k = ranked[(this._totalFreePoints - spent - 1) % ranked.length];
            out[k]++;
            spent++;
          }
          this._attrs = out;
          this._pointsSpent = spent;
        } catch (_) {
          // Fallback: dump into class primary
          const prim = this._class?.primaryAttr || 'STR';
          while (this._pointsLeft > 0) {
            this._attrs[prim]++;
            this._pointsSpent++;
          }
        }
      } else {
        if (this._autoAttrsSavedAttrs) {
          this._attrs = { ...this._autoAttrsSavedAttrs };
          this._pointsSpent = this._autoAttrsSavedSpent || 0;
          this._autoAttrsSavedAttrs = null;
        }
      }
      this._render();
    });
    this._el.querySelector('#hb-next-skills').addEventListener('click', () => {
      this.audio.playSfx('click');
      // M495 — if auto passives + auto spell talents are both on, the
      // Skills step has nothing for the player to do (everything is
      // auto-allocated at hire time). Skip it and confirm directly so
      // the flow returns to the map/encounter instead of dead-ending on
      // an empty Skills screen.
      if (this._skillsStepSkippable()) {
        if (this._recruitMode) this._doRecruit();
        else this._doHire();
        return;
      }
      this._step = 'skills';
      this._render();
    });
  }

  /** True when the Skills/Talents step would be a no-op: not in manual-
   *  characters mode AND both Auto Passives + Auto Spell Talents are on,
   *  so talents/passives auto-allocate and there's nothing to pick. */
  _skillsStepSkippable() {
    try {
      if (GameState.get()?.manualCharacters) return false;
    } catch (_) {}
    return !!(this._autoPassive && this._autoActive);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: Skills / Talents / Passives + Confirm Hire
  // ═══════════════════════════════════════════════════════════════════════════

  // M242: "Estimated Stats at Level X" preview (mirrors Create Character's
  // preview-grid). HP/Mana derived from CON/INT + level.
  // M339 — match CharacterBuilderScreen's .preview-stat markup so the Hire
  // Custom estimated stats panel reads consistently with the New Character
  // workflow. Re-uses computeHeroDamage from formulas.js for accurate
  // melee/magic ranges per the hero's primary attribute.
  _updateHirePreview() {
    const panel = this._el?.querySelector('#preview-grid');
    if (!panel) return;
    const a = this._attrs;
    const lvl = this._level || 1;
    // Mirror CharacterBuilderScreen._updatePreview math (HP/MP scale via
    // computeMaxHp / computeMaxMp; here we use the same coefficients).
    const hp = 50 + (a.CON || 8) * 10;
    const mp = 30 + (a.INT || 8) * 8;
    const hit = Math.min(95, Math.round(70 + (a.DEX || 8) * 1.2));
    const dodge = Math.min(40, Math.round(5 + (a.DEX || 8) * 0.8));
    const init = (a.DEX || 8) + 1;
    const melee = Math.max(1, Math.round((a.STR || 8) * 1.5));
    const meleeHi = Math.max(melee + 1, Math.round((a.STR || 8) * 2.2));
    const magic = Math.max(1, Math.round((a.INT || 8) * 1.4));
    const magicHi = Math.max(magic + 1, Math.round((a.INT || 8) * 2.0));
    const spl = (a.INT || 8) * 0.025;
    panel.innerHTML = `
      <div class="preview-stat"><span class="ps-label">HP</span><span class="ps-val">${Math.floor(hp)}</span></div>
      <div class="preview-stat"><span class="ps-label">Mana</span><span class="ps-val">${Math.floor(mp)}</span></div>
      <div class="preview-stat"><span class="ps-label">Hit</span><span class="ps-val">${hit}%</span></div>
      <div class="preview-stat"><span class="ps-label">Dodge</span><span class="ps-val">${dodge}%</span></div>
      <div class="preview-stat"><span class="ps-label">Init</span><span class="ps-val">${init}</span></div>
      <div class="preview-stat preview-stat-wide"><span class="ps-label">Melee</span><span class="ps-val">${melee} - ${meleeHi}</span></div>
      <div class="preview-stat preview-stat-wide"><span class="ps-label">Magic</span><span class="ps-val">${magic} - ${magicHi}</span></div>
      <div class="preview-stat preview-stat-wide"><span class="ps-label">Spell Power</span><span class="ps-val">+${Math.round(spl * 100)}%</span></div>
      <div class="preview-stat" style="grid-column:1/-1;font-size:0.7rem;color:#8a7a6a">at level ${lvl}</div>
    `;
  }

  _renderAppearancePicker() {
    const container = this._el.querySelector('#hb-appearance-grid');
    if (!container) return;
    container.innerHTML = '';

    // --- filter bar (shared session key with CharacterBuilderScreen) ---
    const filterBar = createEl('div', 'cb-gender-filter-bar');
    const FILTERS = [
      { key: 'all',    label: 'All',    icon: HB_ICON_USERS },
      { key: 'male',   label: 'Male',   icon: HB_ICON_MARS },
      { key: 'female', label: 'Female', icon: HB_ICON_VENUS },
    ];
    for (const f of FILTERS) {
      const btn = createEl('button', `cb-gender-btn${this._genderFilter === f.key ? ' active' : ''}`);
      btn.type = 'button';
      btn.setAttribute('aria-label', `Show ${f.label} appearances`);
      btn.innerHTML = `<span class="cb-gender-icon">${f.icon}</span><span class="cb-gender-label">${f.label}</span>`;
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._genderFilter = f.key;
        try { sessionStorage.setItem('cb_gender_filter', f.key); } catch {}
        this._renderAppearancePicker();
      });
      filterBar.appendChild(btn);
    }
    container.appendChild(filterBar);

    // --- build and filter ---
    // M256: exclude NPC appearances (playable: false).
    const all = getAllAppearances().filter(a => !a.deprecated && a.playable !== false && a.gender !== 'companion' && a.classDefault !== 'companion');
    for (const a of all) {
      if (!a.gender) a.gender = resolveGender(a.id);
    }
    const filtered = this._genderFilter === 'all'
      ? all
      : all.filter(a => a.gender === this._genderFilter);

    if (filtered.length === 0) {
      const empty = createEl('div', 'cb-appearance-empty');
      empty.textContent = 'No appearances match this filter.';
      container.appendChild(empty);
      return;
    }

    // --- flat sort: classDefault ascending, then male before female ---
    const sorted = [...filtered].sort((a, b) => {
      const cmp = a.classDefault.localeCompare(b.classDefault);
      if (cmp !== 0) return cmp;
      const gA = a.gender === 'male' ? 0 : 1;
      const gB = b.gender === 'male' ? 0 : 1;
      return gA - gB;
    });

    // --- render flat grid ---
    const grid = createEl('div', 'cb-appearance-flat-grid');
    for (const app of sorted) {
      const tile = createEl('div', `cb-appearance-tile${this._appearance?.id === app.id ? ' selected' : ''}`);
      tile.dataset.id = app.id;
      const genderIcon = app.gender === 'female' ? HB_ICON_VENUS_SMALL : HB_ICON_MARS_SMALL;
      const adj = getSpriteAdjustment(app.sprite, 'portrait');
      const k = 72 / 256;
      const tStyle = (adj.scale === 1 && adj.offsetX === 0 && adj.offsetY === 0)
        ? ''
        : ` style="transform:translate(${(adj.offsetX*k).toFixed(2)}px,${(adj.offsetY*k).toFixed(2)}px) scale(${adj.scale});transform-origin:center center;"`;
      tile.innerHTML = `
        <img src="${getSpritePath(app.sprite, 'portrait')}"
             onerror="this.onerror=null;this.src='images/portraits/${app.sprite}.png';this.onerror=function(){this.style.opacity=0.25}"
             alt="${app.name}" loading="lazy"${tStyle}>
        <div class="cb-appearance-gender-badge">${genderIcon}</div>
        <div class="cb-appearance-name">${app.name}</div>
      `;
      tile.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._appearance = app;
        grid.querySelectorAll('.cb-appearance-tile').forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
      });
      grid.appendChild(tile);
    }
    container.appendChild(grid);
  }

  _clampSkillPoints() {
    const maxTalent = this._totalTalentPoints();
    if (this._skillPointsUsed > maxTalent) {
      // Remove talents until within budget
      const ids = Object.keys(this._talentsPurchased);
      while (this._skillPointsUsed > maxTalent && ids.length) {
        const id = ids.pop();
        delete this._talentsPurchased[id];
        this._skillPointsUsed--;
      }
    }
    const maxPassive = this._totalPassivePoints();
    if (this._passivePointsUsed > maxPassive) {
      const ids = Object.keys(this._passiveRanks);
      while (this._passivePointsUsed > maxPassive && ids.length) {
        const id = ids.pop();
        const rank = this._passiveRanks[id] || 0;
        this._passivePointsUsed -= rank;
        delete this._passiveRanks[id];
      }
      if (this._passivePointsUsed < 0) this._passivePointsUsed = 0;
    }
  }

  _renderSkillsStep() {
    const cls = this._class;
    const talentPtsLeft = this._talentPointsLeft();
    const passivePtsLeft = this._passivePointsLeft();
    const skills = getClassSkills(cls.id);
    const unlocked = getUnlockedSkills(cls.id, this._level);

    // In recruit mode skip gold check; show "Recruit" instead of "Hire (N G)"
    let footerBtn;
    if (this._recruitMode) {
      footerBtn = `<button type="button" class="hb-btn hb-btn-primary" id="hb-hire">Recruit ${this._name || cls.name}</button>`;
    } else {
      const cost = this._hireCost();
      const gold = GameState.getGold();
      const canAfford = gold >= cost;
      footerBtn = `<button type="button" class="hb-btn hb-btn-primary${canAfford ? '' : ' disabled'}" id="hb-hire" ${canAfford ? '' : 'disabled'}>Hire (${cost} G)</button>`;
    }

    const subtitleExtra = this._recruitMode ? '' : ` · ${this._hireCost()} gold`;
    this._el.innerHTML = `
      <div class="cb-header">
        ${this._recruitMode ? `<button type="button" class="hb-x-btn" id="hb-skills-x" aria-label="Cancel recruit" title="Cancel — you can talk to them again later">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
        </button>` : ''}
        <div class="cb-title">${cls.name} — Skills</div>
        <div class="cb-subtitle">${talentPtsLeft} talent · ${passivePtsLeft} passive pts remaining${subtitleExtra}</div>
      </div>
      <div class="hb-skill-tabs" style="max-width:480px;margin:0 auto">
        <button type="button" class="hb-stab${this._skillTab === 'active' ? ' active' : ''}" data-stab="active">
          Skills${talentPtsLeft > 0 ? ` (${talentPtsLeft})` : ''}
        </button>
        <button type="button" class="hb-stab${this._skillTab === 'passive' ? ' active' : ''}" data-stab="passive">
          Passive${passivePtsLeft > 0 ? ` (${passivePtsLeft})` : ''}
        </button>
      </div>
      <div class="hb-skill-body" id="hb-skill-body">
        ${this._skillTab === 'passive' ? this._renderHirePassivePanel() : this._renderHireSkillPanel(skills, unlocked, talentPtsLeft)}
      </div>
      <div class="hb-footer">
        <button type="button" class="hb-btn hb-btn-ghost" id="hb-back-stats">Back</button>
        ${footerBtn}
      </div>
    `;

    this._wireSkillEvents();
  }

  _renderHireSkillPanel(skills, unlocked, talentPtsLeft) {
    return `
      <div class="hb-skill-list">
        <div class="hb-sp-banner">${talentPtsLeft} Talent Point${talentPtsLeft === 1 ? '' : 's'} Available</div>
        ${skills.map(skill => {
          const isUnlocked = unlocked.find(s => s.name === skill.name);
          return `
            <div class="hb-skill-row${isUnlocked ? '' : ' locked'}${this._selectedSkill === skill.name ? ' selected' : ''}" data-skill="${skill.name}">
              <div class="hb-sk-lvl">Lv${skill.unlockLevel}</div>
              <div class="hb-sk-info">
                <div class="hb-sk-name">${skill.name}</div>
                <div class="hb-sk-type">${skill.type} -- ${skill.aoe || skill.target || 'self'}</div>
              </div>
              <div class="hb-sk-cost">${skill.mpCost > 0 ? `${skill.mpCost} MP` : 'Passive'}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="hb-skill-detail">
        ${this._selectedSkill ? this._renderHireSkillDetail(talentPtsLeft) : '<div class="hb-skill-prompt">Select a skill to view talents.</div>'}
      </div>
    `;
  }

  _renderHireSkillDetail(talentPtsLeft) {
    const skill = Object.values(SKILLS).find(s => s.name === this._selectedSkill);
    if (!skill) return '';
    const talents = skill.talents || [];
    return `
      <div class="hb-sd-inner">
        <div class="hb-sd-name">${skill.name}</div>
        <div class="hb-sd-desc">${skill.description}</div>
        ${skill.mpCost > 0 ? `<div class="hb-sd-mp">Mana Cost: ${skill.mpCost}</div>` : ''}
        ${skill.damageStat ? `<div class="hb-sd-formula">Damage: ${skill.damageMult}x weapon damage</div>` : ''}
        ${skill.healStat ? `<div class="hb-sd-formula">Heal: ${skill.healMult}x weapon damage</div>` : ''}
        ${talents.length ? `
          <div class="hb-sd-talents-title">Upgrade Talents</div>
          ${talents.map(t => {
            const purchased = this._talentsPurchased[t.id];
            const canBuy = !purchased && talentPtsLeft > 0;
            return `
              <div class="hb-sd-talent${purchased ? ' purchased' : ''}">
                <div class="hb-sdt-info">
                  <div class="hb-sdt-name">${t.name}</div>
                  <div class="hb-sdt-desc">${t.desc}</div>
                </div>
                <button type="button" class="hb-sdt-btn${purchased ? ' done' : ''}" data-talent="${t.id}" ${purchased || !canBuy ? 'disabled' : ''}>
                  ${purchased ? 'Learned' : 'Learn (1 pt)'}
                </button>
              </div>
            `;
          }).join('')}
        ` : '<div class="hb-skill-prompt">No upgrade talents for this skill.</div>'}
      </div>
    `;
  }

  _renderHirePassivePanel() {
    const tree = getPassiveTree(this._class.id);
    const ptsLeft = this._passivePointsLeft();
    return `
      <div class="hb-passive-wrap">
        <div class="hb-sp-banner">${ptsLeft} Passive Point${ptsLeft === 1 ? '' : 's'} Available</div>
        ${tree.map((node, i) => {
          const rank = this._passiveRanks[node.id] || 0;
          const canBuy = ptsLeft > 0 && rank < node.maxRank;
          return `
            <div class="hb-passive-node${rank > 0 ? ' owned' : ''}">
              <div class="hb-pn-idx">${i + 1}</div>
              <div class="hb-pn-info">
                <div class="hb-pn-name">${node.name}</div>
                <div class="hb-pn-desc">${node.desc}</div>
                <div class="hb-pn-rank">Rank ${rank} / ${node.maxRank}</div>
              </div>
              <button type="button" class="hb-pn-btn${canBuy ? '' : ' disabled'}" data-passive="${node.id}" ${canBuy ? '' : 'disabled'}>
                ${rank >= node.maxRank ? 'Maxed' : 'Learn (1 pt)'}
              </button>
            </div>
          `;
        }).join('')}
        <div class="hb-passive-hint">Passive bonuses are permanent stat boosts.</div>
      </div>
    `;
  }

  _wireSkillEvents() {
    // Tab switching
    this._el.querySelectorAll('.hb-stab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._skillTab = btn.dataset.stab;
        this._selectedSkill = null;
        this._render();
      });
    });

    // Skill row selection
    this._el.querySelectorAll('.hb-skill-row:not(.locked)').forEach(row => {
      row.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._selectedSkill = row.dataset.skill;
        this._render();
      });
    });

    // Talent purchase
    this._el.querySelectorAll('[data-talent]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (this._talentPointsLeft() <= 0) return;
        if (this._talentsPurchased[btn.dataset.talent]) return;
        this._talentsPurchased[btn.dataset.talent] = true;
        this._skillPointsUsed++;
        this.audio.playSfx('spell');
        this._render();
      });
    });

    // Passive purchase
    this._el.querySelectorAll('[data-passive]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (this._passivePointsLeft() <= 0) return;
        const nodeId = btn.dataset.passive;
        const tree = getPassiveTree(this._class.id);
        const node = tree.find(n => n.id === nodeId);
        if (!node) return;
        const cur = this._passiveRanks[nodeId] || 0;
        if (cur >= node.maxRank) return;
        this._passiveRanks[nodeId] = cur + 1;
        this._passivePointsUsed++;
        this.audio.playSfx('spell');
        this._render();
      });
    });

    // Cancel recruit (✕ in recruit mode)
    this._el.querySelector('#hb-skills-x')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._cancelRecruit();
    });

    // Back to stats
    this._el.querySelector('#hb-back-stats')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._step = 'stats';
      this._render();
    });

    // Hire / Recruit
    this._el.querySelector('#hb-hire')?.addEventListener('click', () => {
      if (this._recruitMode) {
        this._doRecruit();
      } else {
        this._doHire();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Hire finalization
  // ═══════════════════════════════════════════════════════════════════════════

  _doHire() {
    const cls = this._class;
    const cost = this._hireCost();
    const gold = GameState.getGold();
    if (gold < cost) return;
    const name = this._name.trim() || `${cls.name} Merc`;

    this.audio.playSfx('purchase');
    GameState.addGold(-cost);
    const gs = GameState.get();
    const lvl = this._level;
    const lvlBonusHp = (lvl - 1) * 8;
    const lvlBonusMp = (lvl - 1) * 4;
    const newMerc = {
      id: `merc_${Date.now()}`,
      name,
      class: cls.id,
      className: cls.name,
      level: lvl,
      hp: 50 + this._attrs.CON * 10 + lvlBonusHp,
      maxHp: 50 + this._attrs.CON * 10 + lvlBonusHp,
      mp: 30 + this._attrs.INT * 8 + lvlBonusMp,
      maxMp: 30 + this._attrs.INT * 8 + lvlBonusMp,
      attrs: { ...this._attrs },
      equipment: buildStartingEquipment(cls.startingEquipment || []),
      xp: 0,
      xpToNext: 100 * lvl,
      // Remaining unspent points carry over
      pendingAttrPoints: 0,
      pendingSkillPoints: Math.max(0, this._totalTalentPoints() - this._skillPointsUsed),
      pendingPassivePoints: Math.max(0, this._totalPassivePoints() - this._passivePointsUsed),
      talentsPurchased: { ...this._talentsPurchased },
      passiveRanks: { ...this._passiveRanks },
      appearance: (this._appearance?.id) || cls.id,
      // M412 — persist creation-time auto flags onto the merc so they survive
      // out of the builder (Inventory/Skills screens read them).
      autoBuild: {
        auto_attrs:   !gs.manualCharacters && this._autoAttrs,
        auto_passive: !gs.manualCharacters && this._autoPassive,
        auto_active:  !gs.manualCharacters && this._autoActive,
      },
      autoEquip: !gs.manualCharacters && this._autoEquip,
    };

    let sentToReserves = false;
    if (gs.party.length < 4) {
      gs.party.push(newMerc);
    } else {
      gs.bench = gs.bench || [];
      gs.bench.push(newMerc);
      sentToReserves = true;
    }
    this.manager.pop();
    if (sentToReserves) {
      const parentEl = this.manager.uiOverlay;
      if (parentEl) {
        if (!document.getElementById('town-toast-keyframes')) {
          const ks = document.createElement('style');
          ks.id = 'town-toast-keyframes';
          ks.textContent = '@keyframes town-toast-fade{0%{opacity:1}70%{opacity:1}100%{opacity:0}}';
          document.head.appendChild(ks);
        }
        const toast = document.createElement('div');
        toast.style.cssText = 'position:absolute;bottom:5rem;left:50%;transform:translateX(-50%);background:rgba(20,12,28,0.95);border:1px solid rgba(232,200,64,0.4);color:#e8c840;padding:0.5rem 1rem;border-radius:6px;font-size:0.78rem;pointer-events:none;z-index:100;max-width:90%;text-align:center;animation:town-toast-fade 3s ease-out forwards';
        toast.textContent = `Party full -- ${newMerc.name} sent to reserves. Manage your party to swap them in.`;
        parentEl.appendChild(toast);
        setTimeout(() => toast.remove(), 3200);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Recruit finalization (dialog event path — no gold cost)
  // Builds the same hero object as _doHire but skips gold deduction and
  // hands the hero to the recruit mode's onConfirm callback instead of
  // directly pushing to gs.party. Party-size logic and thenCombat are
  // handled by the MapScreen handler that opened this screen.
  // ═══════════════════════════════════════════════════════════════════════════

  _doRecruit() {
    if (!this._recruitMode) return;
    const cls = this._class;
    const r = this._recruitMode;
    const name = this._name.trim() || r.name || cls.name;
    this.audio.playSfx('purchase');
    const gs = GameState.get();
    const lvl = this._level;
    const lvlBonusHp = (lvl - 1) * 8;
    const lvlBonusMp = (lvl - 1) * 4;

    // Starting equipment: class defaults + one scaled bonus weapon
    // level < 8 → magic rarity, level >= 8 → rare rarity
    const bonusRarity = lvl >= 8 ? 'rare' : 'magic';
    const baseEquipment = buildStartingEquipment(cls.startingEquipment || []);
    // Add one bonus weapon in the primary weapon slot (upgrade the starting weapon)
    const weaponBaseKey = (cls.startingEquipment || []).find(k =>
      WEAPON_BASES[k] && WEAPON_BASES[k].type === 'weapon'
    ) || 'longsword';
    const bonusWeapon = generateItem(weaponBaseKey, bonusRarity, 'medium');
    if (bonusWeapon) baseEquipment.weapon = bonusWeapon;

    const newHero = {
      id: `recruit_${r.id || cls.id}_${Date.now()}`,
      name,
      class: cls.id,
      className: cls.name,
      level: lvl,
      hp: 50 + this._attrs.CON * 10 + lvlBonusHp,
      maxHp: 50 + this._attrs.CON * 10 + lvlBonusHp,
      mp: 30 + this._attrs.INT * 8 + lvlBonusMp,
      maxMp: 30 + this._attrs.INT * 8 + lvlBonusMp,
      attrs: { ...this._attrs },
      equipment: baseEquipment,
      xp: 0,
      xpToNext: 100 * lvl,
      pendingAttrPoints: 0,
      pendingSkillPoints: Math.max(0, this._totalTalentPoints() - this._skillPointsUsed),
      pendingPassivePoints: Math.max(0, this._totalPassivePoints() - this._passivePointsUsed),
      talentsPurchased: { ...this._talentsPurchased },
      passiveRanks: { ...this._passiveRanks },
      // Appearance: use the NPC's sprite id (as supplied by recruitHero.id)
      appearance: (this._appearance?.id) || r.id || cls.id,
      autoBuild: {
        auto_attrs:   !gs.manualCharacters && this._autoAttrs,
        auto_passive: !gs.manualCharacters && this._autoPassive,
        auto_active:  !gs.manualCharacters && this._autoActive,
      },
      autoEquip: !gs.manualCharacters && this._autoEquip,
      // Tag so the save system knows this hero originated from a dialog event
      recruitedFrom: r.id || null,
    };

    if (window.__recruitDebug) {
      try { console.log('[recruit] _doRecruit → onConfirm', { id: newHero.id, name: newHero.name, class: newHero.class, level: newHero.level }); } catch {}
    }
    this.manager.pop();
    if (r.onConfirm) r.onConfirm(newHero);
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  update() {}
  draw() {}
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { removeEl(this._el); this._el = null; }
}

// ─── Inline SVG icons for appearance picker gender filter ────────────────────
const HB_ICON_MARS  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path d="M289.8 46.8c3.7-9 12.5-14.8 22.2-14.8l112 0c13.3 0 24 10.7 24 24l0 112c0 9.7-5.8 18.5-14.8 22.2s-19.3 1.7-26.2-5.2l-33.4-33.4L321 204.2c19.5 28.4 31 62.7 31 99.8c0 97.2-78.8 176-176 176S0 401.2 0 304s78.8-176 176-176c37 0 71.4 11.4 99.8 31l52.6-52.6L295 73c-6.9-6.9-8.9-17.2-5.2-26.2zM176 416a112 112 0 1 0 0-224 112 112 0 1 0 0 224z"/></svg>`;
const HB_ICON_VENUS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" aria-hidden="true" focusable="false"><path d="M80 176a112 112 0 1 1 224 0A112 112 0 1 1 80 176zM224 349.1c81.9-15 144-86.8 144-173.1C368 78.8 289.2 0 192 0S16 78.8 16 176c0 86.3 62.1 158.1 144 173.1l0 34.9-32 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l32 0 0 32c0 17.7 14.3 32 32 32s32-14.3 32-32l0-32 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-32 0 0-34.9z"/></svg>`;
const HB_ICON_USERS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" focusable="false"><path d="M144 0a80 80 0 1 1 0 160A80 80 0 1 1 144 0zM512 0a80 80 0 1 1 0 160A80 80 0 1 1 512 0zM0 298.7C0 239.8 47.8 192 106.7 192l42.7 0c15.9 0 31 3.5 44.6 9.7c-1.3 7.2-1.9 14.7-1.9 22.3c0 38.2 16.8 72.5 43.3 96c-.2 0-.4 0-.7 0L21.3 320C9.6 320 0 310.4 0 298.7zM405.3 320c-.2 0-.4 0-.7 0c26.6-23.5 43.3-57.8 43.3-96c0-7.6-.7-15-1.9-22.3c13.6-6.3 28.7-9.7 44.6-9.7l42.7 0C592.2 192 640 239.8 640 298.7c0 11.8-9.6 21.3-21.3 21.3l-213.3 0zM224 224a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zM128 485.3C128 411.7 187.7 352 261.3 352l117.3 0C452.3 352 512 411.7 512 485.3c0 14.7-11.9 26.7-26.7 26.7l-330.7 0c-14.7 0-26.7-11.9-26.7-26.7z"/></svg>`;
const HB_ICON_MARS_SMALL  = HB_ICON_MARS;
const HB_ICON_VENUS_SMALL = HB_ICON_VENUS;

const HIRE_STYLES = `
/* Appearance picker — mirrors CharacterBuilder (cb-appearance-*) so Hire Custom
   shares the same look. Injected here so HireBuilder works standalone. */
.cb-appearance-row { display: flex; flex-direction: column; gap: 0.5rem; margin: 0.5rem 0 0.75rem; }
/* M337 — Level row on a single line: label + - / value / + button / max
   tag all inline. Without this the +/- buttons wrapped to a new row on
   narrow viewports because cb-level-row defaulted to block layout. */
.cb-level-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin: 0.5rem 0 0.75rem; }
.cb-level-controls { display: inline-flex; align-items: center; gap: 0.5rem; }
.cb-level-controls .cb-attr-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(112,64,192,0.15); border: 1px solid rgba(112,64,192,0.45);
  color: #a080e0; font-size: 1rem; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0; line-height: 1;
}
.cb-level-controls .cb-attr-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.cb-level-controls .cb-attr-val {
  font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700;
  min-width: 32px; text-align: center; color: #f0e8d8;
}
.cb-level-cap { font-size: 0.7rem; color: #8a7a6a; letter-spacing: 0.05em; }
.cb-label { font-family: 'Cinzel', serif; font-size: 0.78rem; color: #e8a020; letter-spacing: 0.08em; text-transform: uppercase; }
.cb-sub-label { font-family: 'Inter', sans-serif; font-size: 0.65rem; color: #8a7a6a; text-transform: none; letter-spacing: 0; }
/* #hb-appearance-grid: flex column — filter bar on top, flat grid below */
#hb-appearance-grid {
  display: flex; flex-direction: column; gap: 0;
  background: rgba(18,9,13,0.55); border: 1px solid rgba(232,160,32,0.2); border-radius: 10px;
  overflow: hidden;
}
/* Flat grid — matches cb-appearance-flat-grid in CharacterBuilderScreen */
.cb-appearance-flat-grid {
  overflow-y: auto; padding: 8px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 6px; max-height: 240px;
}
/* Gender filter bar */
.cb-gender-filter-bar {
  display: flex; flex-direction: row; gap: 0;
  border-bottom: 1px solid rgba(232,160,32,0.15); flex-shrink: 0;
}
.cb-gender-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; border: none; border-right: 1px solid rgba(232,160,32,0.12);
  color: #8a7a6a; cursor: pointer; padding: 0.55rem 0.25rem;
  min-height: 44px; transition: background 0.15s, color 0.15s;
  font-family: 'Cinzel', serif; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em;
}
.cb-gender-btn:last-child { border-right: none; }
.cb-gender-btn:hover { background: rgba(232,160,32,0.08); color: #c0b090; }
.cb-gender-btn.active { background: rgba(232,160,32,0.15); color: #e8a020; }
.cb-gender-icon { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; }
.cb-gender-icon svg { width: 14px; height: 14px; fill: currentColor; }
/* Portrait tiles */
.cb-appearance-tile { position: relative; cursor: pointer; border: 2px solid transparent; border-radius: 8px; overflow: hidden; width: 72px; height: 72px; background: #0a0608; transition: border-color 0.15s, transform 0.15s; }
.cb-appearance-tile:hover { border-color: rgba(232,160,32,0.5); transform: translateY(-1px); }
.cb-appearance-tile.selected { border-color: #e8a020; box-shadow: 0 0 8px rgba(232,160,32,0.5); }
.cb-appearance-tile img { width: 100%; height: 100%; object-fit: cover; display: block; image-rendering: pixelated; }
.cb-appearance-name { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.72); color: #f0e8d8; font-size: 9px; text-align: center; padding: 2px 3px; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cb-appearance-gender-badge { position: absolute; top: 3px; right: 3px; width: 12px; height: 12px; opacity: 0.75; pointer-events: none; }
.cb-appearance-gender-badge svg { width: 12px; height: 12px; fill: #e8e0d0; }
.cb-appearance-empty { padding: 1.5rem; text-align: center; font-size: 0.8rem; color: #6a5a4a; font-style: italic; }

.hb-screen {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: linear-gradient(180deg,#0a0608,#120a10); color: #f0e8d8;
  font-family: 'Inter', sans-serif;
}
.hb-header {
  padding: 1rem 1.5rem 0.65rem; border-bottom: 1px solid rgba(232,160,32,0.15);
  background: rgba(0,0,0,0.3); flex-shrink: 0; text-align: center;
}
.hb-title { font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 900; color: #e8a020; }
.hb-subtitle { font-size: 0.72rem; color: #8a7a6a; margin-top: 0.2rem; }
.hb-unlock-counter { font-size: 0.65rem; color: #6a5a52; margin-top: 0.15rem; }
.hb-cost-display { font-size: 0.78rem; color: #60d080; font-weight: 600; margin-top: 0.25rem; }
.hb-cost-warn { color: #c04030; }
/* M312 #13: wider class cards — minmax(160px) so "Chronomancer" text fits
   without wrapping. Full-width usage with no awkward sizing. */
.hb-class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem; padding: 1.25rem; overflow-y: auto; flex: 1;
}
/* M327 — match CharacterBuilderScreen card layout exactly. Previous version
   used white-space:nowrap + ellipsis on the name, which clipped "Paladin"
   et al on mobile so the user only saw the role line ("Holy Warrior"). The
   Create Hero screen renders cleanly on the same width because it lets the
   name wrap. Mirror its rules verbatim. */
.hb-class-card {
  background: rgba(26,18,24,0.8);
  border: 1px solid rgba(232,160,32,0.12);
  border-radius: 10px; padding: 1rem 0.75rem;
  cursor: pointer; transition: all 0.2s;
  display: flex; flex-direction: column; gap: 0.3rem;
  /* M337 — min-height was forcing every card to 140px even when content
     wrapped longer; cards smushed against each other on dense grids. */
}
.hb-class-card:hover:not(.locked) { border-color: rgba(232,160,32,0.5); background: rgba(36,26,32,0.9); transform: translateY(-2px); }
.hb-class-card.selected { border-color: #e8a020; background: rgba(232,160,32,0.12); }
.hb-class-card.locked { opacity: 0.45; cursor: not-allowed; filter: grayscale(0.7); }
.hb-cls-icon { width: 36px; height: 36px; color: #e8a020; margin-bottom: 0.25rem; }
.hb-cls-icon svg { width: 100%; height: 100%; }
.hb-cls-name { font-family: 'Cinzel', serif; font-size: 0.95rem; font-weight: 700; color: #f0e8d8; }
.hb-cls-role { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8a7a6a; }
.hb-cls-hook { font-size: 0.72rem; color: #c0b090; line-height: 1.4; margin-top: 0.25rem; flex: 1; }
.hb-cls-lock { font-size: 0.6rem; color: #c04030; margin-top: 0.3rem; font-style: italic; }
.hb-cls-prefs { font-size: 0.6rem; color: #e8a020; opacity: 0.7; margin-top: 0.25rem; }
.hb-stats-wrap { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; }
/* M339 — preview-stat styles mirrored from CharacterBuilderScreen so the
   Hire Custom estimated-stats block lays out the same way (grid of 3
   cells with full-width rows for Melee / Magic / Spell Power). */
.cb-preview-panel { background: rgba(0,0,0,0.3); border: 1px solid rgba(232,160,32,0.18);
  border-radius: 8px; padding: 0.75rem 0.85rem; margin-top: 1rem; }
.cb-preview-title { font-family: 'Cinzel', serif; font-size: 0.78rem;
  color: #e8a020; letter-spacing: 0.08em; text-transform: uppercase;
  margin-bottom: 0.5rem; text-align: center; }
.cb-preview-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.5rem; }
.preview-stat { text-align: center; padding: 0.2rem 0.4rem;
  background: rgba(232,160,32,0.04); border-radius: 4px; }
.preview-stat .ps-label { display: block; font-size: 0.62rem; color: #8a7a6a;
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.15rem; }
.preview-stat .ps-val { display: block; font-family: 'Cinzel', serif;
  font-size: 0.92rem; font-weight: 700; color: #f0e8d8; }
.preview-stat-wide { grid-column: 1 / -1; display: flex;
  justify-content: space-between; align-items: baseline;
  padding: 0.2rem 0.5rem; border-top: 1px solid rgba(232,160,32,0.1); }
.preview-stat-wide .ps-label { display: inline; margin: 0; }
.preview-stat-wide .ps-val { display: inline; margin: 0; font-size: 0.85rem; }
.hb-name-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
.hb-label { font-size: 0.72rem; color: #8a7a6a; white-space: nowrap; min-width: 40px; }
.hb-name-input {
  flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px; color: #f0e8d8; font-size: 0.9rem; padding: 0.5rem 0.75rem;
  font-family: 'Inter', sans-serif; max-width: 260px;
}
.hb-attrs { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
.hb-attr-row { display: flex; align-items: center; gap: 0.75rem; }
.hb-attr-label { font-family: 'Cinzel', serif; font-size: 0.82rem; font-weight: 700; color: #a080e0; min-width: 40px; }
.hb-attr-btn {
  width: 44px; height: 44px; border-radius: 50%; background: rgba(112,64,192,0.15);
  border: 1px solid rgba(112,64,192,0.4); color: #a080e0; font-size: 1.1rem;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.hb-attr-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.hb-attr-val { font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; min-width: 32px; text-align: center; color: #f0e8d8; }
.hb-cls-desc { font-size: 0.8rem; color: #c0b090; line-height: 1.6; margin-bottom: 0.75rem; }
.hb-class-preview { margin-top: 0.5rem; }
.hb-footer {
  padding: 0.85rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.06);
  display: flex; justify-content: space-between; gap: 1rem; flex-shrink: 0;
  background: rgba(0,0,0,0.3);
}
.hb-btn {
  padding: 0.75rem 1.5rem; border-radius: 8px;
  font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.88rem;
  cursor: pointer; min-height: 48px; transition: background 0.15s;
}
.hb-btn-ghost { background: none; border: 1px solid rgba(255,255,255,0.15); color: #8a7a6a; }
.hb-btn-ghost:hover { color: #f0e8d8; border-color: rgba(255,255,255,0.3); }
.hb-btn-primary { background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.5); color: #e8a020; }
.hb-btn-primary:hover:not(.disabled) { background: rgba(232,160,32,0.28); }
.hb-btn-primary.disabled { opacity: 0.35; cursor: not-allowed; }
/* M494 — themed header close (✕) for recruit mode. Gold, matches the
   builder palette (no white/blue). Absolutely positioned in the .cb-header
   which is position-relative-safe (text-centered header). */
.cb-header { position: relative; }
.hb-x-btn {
  position: absolute; top: 0.85rem; right: 1rem;
  width: 40px; height: 40px; min-width: 40px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 8px; color: #e8a020; cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.hb-x-btn:hover { background: rgba(232,160,32,0.22); border-color: rgba(232,160,32,0.7); }

/* ─── Skills step ──────────────────────────────────────────────────────────── */
.hb-skill-tabs {
  display: flex; gap: 0.5rem; padding: 0.5rem 1rem;
  background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(232,160,32,0.2); flex-shrink: 0;
}
.hb-stab {
  padding: 0.45rem 1rem; background: rgba(20,12,28,0.6);
  border: 1px solid rgba(232,160,32,0.15); border-radius: 6px;
  color: #8a7a6a; font-size: 0.78rem; font-weight: 600; cursor: pointer; min-height: 44px;
}
.hb-stab.active { border-color: rgba(232,160,32,0.6); color: #e8a020; background: rgba(232,160,32,0.12); }
/* M312 #13: ensure skill step body scrolls without cutting off content */
.hb-skill-body { flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; min-height: 0; }
.hb-sp-banner {
  padding: 0.4rem 0.75rem; margin: 0.75rem 1rem 0.5rem;
  background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.35);
  border-radius: 6px; font-size: 0.75rem; color: #e8a020; font-weight: 600; text-align: center;
}
.hb-skill-list { padding: 0 1rem 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; }
.hb-skill-row {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.75rem; background: rgba(20,12,28,0.5);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 7px;
  cursor: pointer; transition: all 0.2s; min-height: 48px;
}
.hb-skill-row:hover:not(.locked) { border-color: rgba(232,160,32,0.4); background: rgba(20,12,28,0.8); }
.hb-skill-row.locked { opacity: 0.4; cursor: default; }
.hb-skill-row.selected { border-color: rgba(232,160,32,0.7); background: rgba(232,160,32,0.12); }
.hb-sk-lvl {
  font-size: 0.6rem; font-weight: 700; padding: 0.2rem 0.4rem;
  background: rgba(232,160,32,0.2); border: 1px solid rgba(232,160,32,0.3);
  border-radius: 4px; color: #e8a020; flex-shrink: 0;
}
.hb-sk-info { flex: 1; }
.hb-sk-name { font-family: 'Cinzel', serif; font-size: 0.82rem; font-weight: 700; }
.hb-sk-type { font-size: 0.6rem; color: #8a7a6a; text-transform: capitalize; }
.hb-sk-cost { font-size: 0.65rem; color: #4080c0; flex-shrink: 0; }
.hb-skill-detail { padding: 0.75rem 1rem; }
.hb-skill-prompt { color: #8a7a6a; font-size: 0.8rem; text-align: center; padding: 2rem 0; }
.hb-sd-inner { max-width: 480px; }
.hb-sd-name { font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 900; color: #e8a020; margin-bottom: 0.4rem; }
.hb-sd-desc { font-size: 0.82rem; line-height: 1.5; color: #c0b090; margin-bottom: 0.75rem; }
.hb-sd-mp { font-size: 0.75rem; color: #4080c0; margin-bottom: 0.35rem; }
.hb-sd-formula { font-size: 0.72rem; color: #c0c080; margin-bottom: 0.35rem; }
.hb-sd-talents-title { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a7a6a; margin: 1rem 0 0.6rem; }
.hb-sd-talent {
  display: flex; align-items: center; gap: 0.85rem;
  padding: 0.75rem 0.85rem; background: rgba(20,12,28,0.5);
  border: 1px solid rgba(232,160,32,0.12); border-radius: 8px;
  margin-bottom: 0.45rem;
}
.hb-sd-talent.purchased { border-color: rgba(232,160,32,0.4); background: rgba(232,160,32,0.08); }
.hb-sdt-info { flex: 1; }
.hb-sdt-name { font-weight: 600; font-size: 0.82rem; margin-bottom: 0.15rem; }
.hb-sdt-desc { font-size: 0.7rem; color: #8a7a6a; line-height: 1.35; }
.hb-sdt-btn {
  padding: 0.5rem 0.85rem; background: rgba(232,160,32,0.15);
  border: 1px solid rgba(232,160,32,0.4); border-radius: 6px;
  color: #e8a020; font-size: 0.72rem; font-weight: 600; cursor: pointer;
  min-height: 44px; white-space: nowrap;
}
.hb-sdt-btn:hover:not(:disabled) { background: rgba(232,160,32,0.28); }
.hb-sdt-btn.done { background: rgba(232,160,32,0.06); border-color: rgba(232,160,32,0.2); color: #8a6020; cursor: default; }

/* ─── Passive panel ────────────────────────────────────────────────────────── */
.hb-passive-wrap { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.hb-passive-node {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 0.85rem; background: rgba(20,12,28,0.6);
  border: 1px solid rgba(232,160,32,0.15); border-radius: 8px;
}
.hb-passive-node.owned { border-color: rgba(232,160,32,0.45); background: rgba(232,160,32,0.1); }
.hb-pn-idx { font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; color: #e8a020; min-width: 22px; text-align: center; }
.hb-pn-info { flex: 1; }
.hb-pn-name { font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; color: #e8e0d0; }
.hb-pn-desc { font-size: 0.68rem; color: #c0b090; margin-top: 0.1rem; line-height: 1.3; }
.hb-pn-rank { font-size: 0.62rem; color: #8a7a6a; margin-top: 0.2rem; }
.hb-pn-btn {
  padding: 0.5rem 0.85rem; background: rgba(232,160,32,0.18);
  border: 1px solid rgba(232,160,32,0.4); border-radius: 6px;
  color: #e8a020; font-size: 0.7rem; font-weight: 600; cursor: pointer; min-height: 44px; white-space: nowrap;
}
.hb-pn-btn:hover:not(:disabled) { background: rgba(232,160,32,0.32); }
.hb-pn-btn.disabled, .hb-pn-btn:disabled { opacity: 0.35; cursor: default; }
.hb-passive-hint { font-size: 0.65rem; color: #6a5a52; text-align: center; font-style: italic; margin-top: 0.4rem; }
`;
