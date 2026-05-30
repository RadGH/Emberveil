/**
 * CharacterBuilderScreen — full character creation
 * Name, Class (14 options), STR/DEX/INT/CON distribution (8 base + 10 free)
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { CB_STYLES } from './characterBuilderStyles.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { CLASSES } from '../../game/classes.js';
import { getSpritePath } from '../../game/spriteUtils.js';
import { getBuilds, getDefaultBuild } from '../../game/buildPresets.js';
import { getUnlockedClassIds, getTotalClassCount, syncFromGameState } from '../../game/classUnlocks.js';
import { buildStartingEquipment, getStartingEquipmentNames } from '../../game/items.js';
import { TownScreen } from './TownScreen.js';
import { OpeningCinematicScreen } from './OpeningCinematicScreen.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { GameState } from '../../game/gameState.js';
import { statColor, attachStatTooltips, getBaseMode, setBaseMode } from '../components/StatColors.js';
import { computeHeroDamage } from '../../game/formulas.js';
import { getSpriteAdjustment } from '../../game/spriteAdjustments.js';
import { classIconSvg } from '../../game/spriteUtils.js';
import { getAllAppearances, getDefaultAppearance, resolveGender } from '../../game/appearances.js';
import { getUnlockedAppearances, fameSummaryText } from '../../game/fame.js';
import { rollRandomHeroName as _rollRandomHeroName } from '../../game/nameGen.js';

const ATTRS = ['STR', 'DEX', 'INT', 'CON'];
const FREE_POINTS = 8;
const BASE_VALUE = 8;

export class CharacterBuilderScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this._el = null;
    this._name = 'Hero';
    this._class = null;
    this._appearance = null;
    this._attrs = { STR: BASE_VALUE, DEX: BASE_VALUE, INT: BASE_VALUE, CON: BASE_VALUE };
    this._pointsSpent = 0;
    this._autoAttrs = false;
    this._autoAttrsSavedAttrs = null; // remember manual state for unchecking
    // M412 — separate persistent auto flags so creation choices carry into runtime
    this._autoEquip = false;
    this._autoPassive = false;
    this._autoActive = false;
    // M276 D12 — Difficulty card screen now appears on EVERY New Game. We no
    // longer skip it when emberveil_difficulty is already set in localStorage;
    // the prior selection is shown pre-highlighted but the player still
    // confirms (or changes) it before continuing.
    this._step = 'difficulty'; // 'difficulty' | 'class' | 'build' | 'stats'
    this._buildChoice = null; // M402 — chosen build preset (renamed from _build to avoid colliding with the _build() method)
    this._saveSlot = 0;
    // Pre-fill from prior persisted choice, but always re-show the picker.
    this._difficulty = (() => {
      try { return localStorage.getItem('emberveil_difficulty') || 'normal'; } catch { return 'normal'; }
    })();
    this._advancedOpen = false;
    this._mapSeed = '';
    this._fogOfWar = true; // M311: fog-of-war on by default for new games
    this._hardcore = false;
    this._manualCombat = false;
    this._manualCharacters = false; // M### — disables auto inventory/skill/passive/attr management
    // Gender filter for appearance picker: 'all' | 'male' | 'female'
    this._genderFilter = (() => {
      try { return sessionStorage.getItem('cb_gender_filter') || 'all'; } catch { return 'all'; }
    })();
  }

  get _pointsLeft() { return FREE_POINTS - this._pointsSpent; }

  onEnter() { this._build(); }

  _build() {
    injectStyles('cb-styles', CB_STYLES);
    this._el = createEl('div', 'cb-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    this._el.innerHTML = '';
    // M399 — wrap each step render in try/catch so a single broken step
    // doesn't black-screen the whole flow. On error we fall through to
    // the next reasonable step (build → stats; class → difficulty).
    const safeRender = (fn, fallbackStep) => {
      try { fn.call(this); }
      catch (err) {
        console.error('[CharacterBuilder] step render failed:', this._step, err);
        if (fallbackStep && this._step !== fallbackStep) {
          this._step = fallbackStep;
          this._render();
        }
      }
    };
    if (this._step === 'difficulty') safeRender(this._renderDifficultyStep);
    else if (this._step === 'class') safeRender(this._renderClassStep, 'difficulty');
    else if (this._step === 'build') safeRender(this._renderBuildStep, 'stats');
    else safeRender(this._renderStatsStep, 'class');
    // M297: re-mount keyboard nav after each re-render; layout varies per step.
    kbUnmount(this._el);
    kbMount(this._el, {
      layout: this._step === 'class' ? 'grid' : 'vertical',
      focusFirst: false,
      onEscape: () => {
        this.audio.playSfx('click');
        if (this._step === 'difficulty') this.manager.pop();
        else if (this._step === 'class') { this._step = 'difficulty'; this._render(); }
        else if (this._step === 'build') { this._step = 'class'; this._render(); }
        else { this._step = this._manualCombat ? 'class' : 'build'; this._render(); }
      },
    });
  }

  _renderDifficultyStep() {
    const el = this._el;
    const d = this._difficulty;
    el.innerHTML = `
      <div class="cb-header">
        <div class="cb-title">Choose Difficulty</div>
        <div class="cb-subtitle">Pick the experience that fits your taste</div>
      </div>
      <!-- M339 — compact button row + dynamic description below; matches
           the Change Difficulty dialog. Description updates as the user
           changes selection; bonuses (MF/XP) chip-shown when Hard. -->
      <div class="cb-diff-grid" id="diff-grid">
        <button type="button" class="cb-diff-card${d === 'easy' ? ' selected' : ''}" data-diff="easy" aria-pressed="${d === 'easy'}">
          <div class="cb-diff-icon">${ICON_HEART_SHIELD}</div>
          <div class="cb-diff-name">Easy</div>
        </button>
        <button type="button" class="cb-diff-card${d === 'normal' ? ' selected' : ''}" data-diff="normal" aria-pressed="${d === 'normal'}">
          <div class="cb-diff-icon">${ICON_SHIELD}</div>
          <div class="cb-diff-name">Normal</div>
        </button>
        <button type="button" class="cb-diff-card${d === 'hard' ? ' selected' : ''}" data-diff="hard" aria-pressed="${d === 'hard'}">
          <div class="cb-diff-icon">${ICON_SKULL}</div>
          <div class="cb-diff-name">Hard</div>
        </button>
      </div>
      <div class="cb-diff-desc" id="cb-diff-desc"></div>
      <div class="cb-advanced">
        <button type="button" class="cb-advanced-toggle" id="adv-toggle" aria-expanded="${this._advancedOpen}">
          <span class="cb-adv-caret">${this._advancedOpen ? '▼' : '▶'}</span>
          <span>Advanced options</span>
        </button>
        <div class="cb-advanced-panel" id="adv-panel" style="display:${this._advancedOpen ? 'block' : 'none'}">
          <div class="cb-adv-row cb-adv-check">
            <label class="cb-adv-checkline">
              <input type="checkbox" id="adv-fog" ${this._fogOfWar ? 'checked' : ''}>
              <span class="cb-adv-label-inline">Fog of War</span>
              <div class="cb-adv-help">Hide map nodes until you scout them.</div>
            </label>
          </div>
          <div class="cb-adv-row cb-adv-check">
            <label class="cb-adv-checkline">
              <input type="checkbox" id="adv-hardcore" ${this._hardcore ? 'checked' : ''}>
              <span class="cb-adv-label-inline">Hardcore</span>
              <div class="cb-adv-help">Permadeath mode with no town revives.</div>
            </label>
          </div>
          <div class="cb-adv-row cb-adv-check">
            <label class="cb-adv-checkline">
              <input type="checkbox" id="adv-manual-chars" ${this._manualCharacters ? 'checked' : ''}>
              <span class="cb-adv-label-inline">Manual Characters</span>
              <div class="cb-adv-help">Disable automatic inventory, skills, passives, and attribute management.</div>
            </label>
          </div>
          <div class="cb-adv-row cb-adv-check">
            <label class="cb-adv-checkline">
              <input type="checkbox" id="adv-manual" ${this._manualCombat ? 'checked' : ''}>
              <span class="cb-adv-label-inline">Manual Combat</span>
              <div class="cb-adv-help">Disable auto-combat and take each turn manually.</div>
            </label>
          </div>
          <!-- M337: Map Seed moved to the end of advanced options, matching
               Change Difficulty layout. -->
          <div class="cb-adv-row">
            <label class="cb-adv-label" for="adv-seed">Map Seed</label>
            <input class="cb-adv-input" id="adv-seed" type="text" maxlength="48" placeholder="(empty = random)" value="${this._escape(this._mapSeed)}">
            <div class="cb-adv-help">A custom string the world is built from. Same seed, same maps. Leave blank for a fresh roll.</div>
          </div>
        </div>
      </div>
      <div class="cb-footer">
        <button type="button" class="cb-btn cb-btn-ghost" id="cb-back">← Back</button>
        <button type="button" class="cb-btn cb-btn-primary" id="cb-next">Next →</button>
      </div>
    `;
    const DIFF_DESC = {
      easy:   'Auto-managed loadout. Attribute, passive, and active picks handled for you. Town entry restores HP/MP. Recommended if you want to focus on combat and exploration over min-maxing.',
      normal: 'Balanced pacing. Auto-heal on town entry, free cleric services, forgiving rules. The intended Emberveil experience.',
      hard:   'Tougher fights, leaner economy. Town no longer auto-heals. Combat rewards are richer to compensate.',
    };
    const DIFF_BONUS = {
      hard: { mf: 20, xp: 10 },
    };
    const renderDiffDesc = () => {
      const id = this._difficulty;
      const d = DIFF_DESC[id] || '';
      const b = DIFF_BONUS[id];
      const bonuses = b
        ? `<div class="cb-diff-bonuses">
             <span class="cb-diff-bonus">+${b.mf}% Magic Find</span>
             <span class="cb-diff-bonus">+${b.xp}% XP</span>
           </div>`
        : '';
      const target = el.querySelector('#cb-diff-desc');
      if (target) target.innerHTML = `<strong>${id.charAt(0).toUpperCase()+id.slice(1)}.</strong> ${d}${bonuses}`;
    };
    renderDiffDesc();
    el.querySelectorAll('.cb-diff-card').forEach(card => {
      card.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._difficulty = card.dataset.diff;
        el.querySelectorAll('.cb-diff-card').forEach(c => {
          const on = c.dataset.diff === this._difficulty;
          c.classList.toggle('selected', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderDiffDesc();
      });
    });
    const advToggle = el.querySelector('#adv-toggle');
    advToggle.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._advancedOpen = !this._advancedOpen;
      const panel = el.querySelector('#adv-panel');
      const caret = advToggle.querySelector('.cb-adv-caret');
      panel.style.display = this._advancedOpen ? 'block' : 'none';
      if (caret) caret.textContent = this._advancedOpen ? '▼' : '▶';
      advToggle.setAttribute('aria-expanded', this._advancedOpen);
    });
    el.querySelector('#adv-seed').addEventListener('input', e => { this._mapSeed = e.target.value || ''; });
    el.querySelector('#adv-fog').addEventListener('change', e => { this._fogOfWar = !!e.target.checked; });
    el.querySelector('#adv-hardcore').addEventListener('change', e => { this._hardcore = !!e.target.checked; });
    el.querySelector('#adv-manual')?.addEventListener('change', e => { this._manualCombat = !!e.target.checked; });
    el.querySelector('#adv-manual-chars')?.addEventListener('change', e => { this._manualCharacters = !!e.target.checked; });
    el.querySelector('#cb-back').addEventListener('click', () => { this.audio.playSfx('click'); this.manager.pop(); });
    el.querySelector('#cb-next').addEventListener('click', () => {
      this.audio.playSfx('click');
      // Persist difficulty choice; gameState fields are written at _confirm.
      try { localStorage.setItem('emberveil_difficulty', this._difficulty); } catch {}
      this._step = 'class';
      this._render();
    });
  }

  _escape(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  _renderClassStep() {
    const el = this._el;
    // Poll GameState (if a run is active) to apply any pending class unlocks
    // before rendering the grid.
    try { syncFromGameState(GameState.get?.()); } catch {}
    const unlockedIds = getUnlockedClassIds();
    const totalClasses = getTotalClassCount();
    el.innerHTML = `
      <div class="cb-header">
        <div class="cb-title">Create Your Hero</div>
        <div class="cb-subtitle">Choose your class</div>
        <div class="cb-unlock-counter">${unlockedIds.size} / ${totalClasses} classes unlocked</div>
      </div>
      <div class="cb-class-grid" id="class-grid"></div>
      <div class="cb-footer">
        <button type="button" class="cb-btn cb-btn-ghost" id="cb-back">← Back</button>
        <button type="button" class="cb-btn cb-btn-primary" id="cb-next" disabled>Next →</button>
      </div>
    `;
    const grid = el.querySelector('#class-grid');
    // Sort: starter 5 first (fixed order), then other unlocked, then locked.
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
    for (const cls of sortedClasses) {
      const locked = !unlockedIds.has(cls.id);
      const card = createEl('div', `cb-class-card${this._class?.id === cls.id ? ' selected' : ''}${locked ? ' locked' : ''}`);
      card.dataset.id = cls.id;
      const lockLabel = cls.unlockRequirement?.label || 'Locked';
      if (locked) {
        card.innerHTML = `
          <div class="cb-class-icon">${cls.svgIcon}</div>
          <div class="cb-class-name">${cls.name} <span class="cb-lock">🔒</span></div>
          <div class="cb-class-role">${cls.role}</div>
          <div class="cb-class-hook">${cls.hook}</div>
          <div class="cb-class-unlock">Unlock: ${lockLabel}</div>
        `;
        card.title = `Locked — ${lockLabel}`;
      } else {
        card.innerHTML = `
          <div class="cb-class-icon">${cls.svgIcon}</div>
          <div class="cb-class-name">${cls.name}</div>
          <div class="cb-class-role">${cls.role}</div>
          <div class="cb-class-hook">${cls.hook}</div>
          <div class="cb-class-armor">Starts with: ${getStartingEquipmentNames(cls.startingEquipment || []).join(', ') || cls.armorType}</div>
        `;
      }
      card.addEventListener('click', () => {
        if (locked) { this.audio.playSfx('click'); return; }
        this.audio.playSfx('click');
        this._class = cls;
        // Default appearance follows the class, but the player can swap on
        // the next step. This is the Class/Appearance decoupling: a Cleric
        // can adopt a Mage look without changing skills.
        this._appearance = getDefaultAppearance(cls.id);
        el.querySelectorAll('.cb-class-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        el.querySelector('#cb-next').disabled = false;
      });
      grid.appendChild(card);
    }
    el.querySelector('#cb-back').addEventListener('click', () => { this.audio.playSfx('click'); this._step = 'difficulty'; this._render(); });
    el.querySelector('#cb-next').addEventListener('click', () => {
      if (!this._class) return;
      this.audio.playSfx('click');
      // M399 — route through the build picker unless manual combat is on.
      // Manual mode players allocate attributes themselves so the build
      // preset (which exists to drive the auto-allocator) is irrelevant.
      this._step = this._manualCombat ? 'stats' : 'build';
      this._render();
    });
  }

  // M399 — Build picker step. Player picks one of the class's build presets,
  // which then drives the auto-attribute allocator + starter-equipment roll.
  _renderBuildStep() {
    const el = this._el;
    const classId = this._class?.id;
    const builds = getBuilds(classId);
    el.innerHTML = `
      <div class="cb-header">
        <div class="cb-title">Pick a Build</div>
        <div class="cb-subtitle">${this._class?.name || ''} — auto-allocator follows the chosen build's attribute targets and skill priorities.</div>
      </div>
      <div class="cb-build-grid" id="cb-build-grid">
        ${builds.map((b, i) => `
          <button type="button" class="cb-build-card${i === 0 ? ' selected' : ''}" data-build="${b.id}">
            <div class="cb-build-name">${b.name}</div>
            <div class="cb-build-tags">${(b.tags || []).map(t => `<span class="cb-build-tag">${t}</span>`).join('')}</div>
            <div class="cb-build-attrs">
              <span class="cb-build-attr cb-build-attr-str">STR ${b.targetAttrs.STR}%</span>
              <span class="cb-build-attr cb-build-attr-dex">DEX ${b.targetAttrs.DEX}%</span>
              <span class="cb-build-attr cb-build-attr-int">INT ${b.targetAttrs.INT}%</span>
              <span class="cb-build-attr cb-build-attr-con">CON ${b.targetAttrs.CON}%</span>
            </div>
            <div class="cb-build-desc">${b.description}</div>
            <div class="cb-build-skills"><strong>Preferred skills:</strong> ${(b.preferredSkills || []).slice(0, 4).join(', ')}</div>
            <div class="cb-build-weapons"><strong>Weapons:</strong> ${(b.weapons || []).join(' / ')} · <strong>Shield:</strong> ${b.shieldPref}</div>
          </button>
        `).join('') || '<div class="cb-build-empty">No build presets defined for this class yet — auto-allocator will use the legacy primary-attribute dump.</div>'}
      </div>
      <div class="cb-footer">
        <button type="button" class="cb-btn cb-btn-ghost" id="cb-prev">← Class</button>
        <button type="button" class="cb-btn cb-btn-primary" id="cb-next">Next →</button>
      </div>
    `;
    // Default-select the first build.
    if (builds.length) this._buildChoice = builds[0];
    el.querySelectorAll('[data-build]').forEach(card => {
      card.addEventListener('click', () => {
        this.audio.playSfx('click');
        const id = card.dataset.build;
        this._buildChoice = builds.find(b => b.id === id) || null;
        el.querySelectorAll('.cb-build-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
    el.querySelector('#cb-prev').addEventListener('click', () => { this.audio.playSfx('click'); this._step = 'class'; this._render(); });
    el.querySelector('#cb-next').addEventListener('click', () => { this.audio.playSfx('click'); this._step = 'stats'; this._render(); });
  }

  _renderStatsStep() {
    const el = this._el;
    el.innerHTML = `
      <div class="cb-header">
        <div class="cb-title">${this._class.name} ${classIconSvg(this._class.id, 18, 'cb-title-class-icon')}</div>
        <div class="cb-subtitle">Assign attributes</div>
      </div>
      <div class="cb-stats-area">
        <div class="cb-name-row">
          <label class="cb-label">Hero Name</label>
          <div style="display:flex;gap:0.4rem;align-items:stretch">
            <input class="cb-name-input" id="hero-name" type="text" maxlength="24" placeholder="Enter a name..." value="${this._name}" style="flex:1">
            <button type="button" id="cb-name-roll" class="cb-dice-btn" title="Random name" aria-label="Roll random name"
              style="min-width:44px;min-height:44px;padding:0 0.5rem;background:rgba(232,160,32,0.12);border:1px solid rgba(232,160,32,0.45);border-radius:6px;color:#e8a020;cursor:pointer;display:flex;align-items:center;justify-content:center">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8" cy="8" r="1.2" fill="currentColor"></circle><circle cx="16" cy="8" r="1.2" fill="currentColor"></circle><circle cx="12" cy="12" r="1.2" fill="currentColor"></circle><circle cx="8" cy="16" r="1.2" fill="currentColor"></circle><circle cx="16" cy="16" r="1.2" fill="currentColor"></circle></svg>
            </button>
          </div>
        </div>
        <div class="cb-appearance-row">
          <label class="cb-label">Appearance <span class="cb-sub-label">(cosmetic — does not change skills)</span></label>
          <div class="cb-fame-banner" id="cb-fame-banner"></div>
          <div class="cb-appearance-grid" id="appearance-grid"></div>
        </div>
        <div class="cb-points-banner">
          <span id="pts-left">${this._pointsLeft}</span> points remaining
          <label class="cb-auto-attrs" style="margin-left:0.75rem;font-size:0.75rem;cursor:pointer;color:#e8a020;display:inline-flex;align-items:center;gap:0.3rem">
            <input type="checkbox" id="cb-auto-attrs" ${this._autoAttrs ? 'checked' : ''}>
            Auto
          </label>
        </div>
        <div class="cb-attrs" id="attr-panel"></div>
        <div class="cb-preview-panel">
          <div class="cb-preview-title">Estimated Stats at Level 1</div>
          <div class="cb-preview-grid" id="preview-grid"></div>
        </div>
        ${this._manualCharacters ? '' : `
        <div class="cb-auto-options" style="margin-top:0.6rem;padding:0.55rem 0.7rem;background:rgba(232,160,32,0.07);border:1px solid rgba(232,160,32,0.25);border-radius:6px;display:flex;flex-direction:column;gap:0.35rem;font-size:0.78rem;color:#d8c8a0">
          <div style="font-weight:600;color:#e8a020">Auto-management (toggleable later)</div>
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer"><input type="checkbox" id="cb-auto-equip" ${this._autoEquip ? 'checked' : ''}> Auto Inventory <span style="opacity:0.65;font-size:0.72rem">— equip upgrades automatically</span></label>
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer"><input type="checkbox" id="cb-auto-passive" ${this._autoPassive ? 'checked' : ''}> Auto Passives <span style="opacity:0.65;font-size:0.72rem">— spend passive points</span></label>
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer"><input type="checkbox" id="cb-auto-active" ${this._autoActive ? 'checked' : ''}> Auto Spell Talents <span style="opacity:0.65;font-size:0.72rem">— spend talent points</span></label>
        </div>
        `}
      </div>
      <div class="cb-footer">
        <button type="button" class="cb-btn cb-btn-ghost" id="cb-prev">← Back</button>
        <button type="button" class="cb-btn cb-btn-gold" id="cb-confirm">Begin Adventure →</button>
      </div>
    `;
    this._renderAttrs();
    this._renderFameBanner();
    this._renderAppearancePicker();
    this._updatePreview();

    el.querySelector('#hero-name').addEventListener('input', e => { this._name = e.target.value || 'Hero'; });
    el.querySelector('#cb-name-roll')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      const input = el.querySelector('#hero-name');
      const name = _rollRandomHeroName(this._appearance);
      if (input) input.value = name;
      this._name = name;
    });
    el.querySelector('#cb-auto-attrs')?.addEventListener('change', e => {
      this._autoAttrs = !!e.target.checked;
      this.audio.playSfx('click');
      if (this._autoAttrs) {
        // Save current state, then auto-spend remaining points using build distribution.
        this._autoAttrsSavedAttrs = { ...this._attrs };
        this._autoAttrsSavedSpent = this._pointsSpent;
        this._applyAutoAttrs();
      } else {
        // Refund: restore prior manual state.
        if (this._autoAttrsSavedAttrs) {
          this._attrs = { ...this._autoAttrsSavedAttrs };
          this._pointsSpent = this._autoAttrsSavedSpent || 0;
          this._autoAttrsSavedAttrs = null;
        }
      }
      this._renderAttrs();
      this._refreshAttrLockState();
      this._updatePreview();
      const ptsEl = this._el.querySelector('#pts-left');
      if (ptsEl) ptsEl.textContent = this._pointsLeft;
    });
    el.querySelector('#cb-auto-equip')?.addEventListener('change', e => { this._autoEquip = !!e.target.checked; this.audio.playSfx('click'); });
    el.querySelector('#cb-auto-passive')?.addEventListener('change', e => { this._autoPassive = !!e.target.checked; this.audio.playSfx('click'); });
    el.querySelector('#cb-auto-active')?.addEventListener('change', e => { this._autoActive = !!e.target.checked; this.audio.playSfx('click'); });
    this._refreshAttrLockState();
    el.querySelector('#cb-prev').addEventListener('click', () => { this.audio.playSfx('click'); this._step = 'class'; this._render(); });
    el.querySelector('#cb-confirm').addEventListener('click', () => { this.audio.playSfx('click'); this._confirm(); });
  }

  _renderAttrs() {
    const panel = this._el.querySelector('#attr-panel');
    if (!panel) return;
    panel.innerHTML = '';
    for (const attr of ATTRS) {
      const row = createEl('div', 'cb-attr-row');
      const desc = ATTR_DESC[attr];
      row.innerHTML = `
        <div class="cb-attr-info">
          <div class="cb-attr-name">${attr}</div>
          <div class="cb-attr-desc">${desc}</div>
        </div>
        <div class="cb-attr-controls">
          <button type="button" class="cb-attr-btn" data-attr="${attr}" data-dir="-1">−</button>
          <span class="cb-attr-val" id="val-${attr}">${this._attrs[attr]}</span>
          <button type="button" class="cb-attr-btn" data-attr="${attr}" data-dir="1">+</button>
        </div>
      `;
      panel.appendChild(row);
    }
    panel.querySelectorAll('.cb-attr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.attr;
        const dir = parseInt(btn.dataset.dir);
        this._adjustAttr(attr, dir);
      });
    });
  }

  _renderFameBanner() {
    const banner = this._el.querySelector('#cb-fame-banner');
    if (!banner) return;
    // Reads fame from any active save; falls back to 0 if no save is active.
    let fame = 0;
    try {
      const gs = GameState.get();
      fame = gs.fame || 0;
    } catch (_) {}

    banner.innerHTML = `<span class="cb-fame-text">${fameSummaryText(fame)}</span>`;
  }

  _renderAppearancePicker() {
    const container = this._el.querySelector('#appearance-grid');
    if (!container) return;
    container.innerHTML = '';

    // --- filter bar ---
    const filterBar = createEl('div', 'cb-gender-filter-bar');
    const FILTERS = [
      { key: 'all',    label: 'All',    icon: ICON_USERS },
      { key: 'male',   label: 'Male',   icon: ICON_MARS },
      { key: 'female', label: 'Female', icon: ICON_VENUS },
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

    // --- build and filter the full list with fame gating ---
    let fame = 0;
    try { fame = GameState.get().fame || 0; } catch (_) {}

    // M322 — same-class appearances always unlocked; pass class id so own-class
    // tiles render free regardless of fame.
    const withLock = getUnlockedAppearances(this._class?.id || null, fame, this._genderFilter);

    if (withLock.length === 0) {
      const empty = createEl('div', 'cb-appearance-empty');
      empty.textContent = 'No appearances match this filter.';
      container.appendChild(empty);
      return;
    }

    // --- render flat grid ---
    const grid = createEl('div', 'cb-appearance-flat-grid');
    for (const entry of withLock) {
      const app = entry.appearance;
      const isLocked = entry.locked;
      const unlockFame = entry.unlockFame;

      const tile = createEl('div', `cb-appearance-tile${this._appearance?.id === app.id && !isLocked ? ' selected' : ''}${isLocked ? ' fame-locked' : ''}`);
      tile.dataset.id = app.id;

      const genderIcon = app.gender === 'female' ? ICON_VENUS_SMALL : ICON_MARS_SMALL;
      const adj = getSpriteAdjustment(app.sprite, 'portrait');
      const k = 72 / 256;
      const tStyle = (adj.scale === 1 && adj.offsetX === 0 && adj.offsetY === 0)
        ? ''
        : ` style="transform:translate(${(adj.offsetX*k).toFixed(2)}px,${(adj.offsetY*k).toFixed(2)}px) scale(${adj.scale});transform-origin:center center;"`;

      if (isLocked) {
        tile.setAttribute('title', unlockFame
          ? `Unlocks at ${unlockFame.toLocaleString('en-US')} fame`
          : 'Locked — gain more fame to unlock');
        tile.setAttribute('aria-label', `${app.name} — locked (requires ${unlockFame ? unlockFame.toLocaleString('en-US') : '?'} fame)`);
        tile.innerHTML = `
          <img src="${getSpritePath(app.sprite, 'portrait')}"
               onerror="this.onerror=null;this.src='images/portraits/${app.sprite}.png';this.onerror=function(){this.style.opacity=0.15}"
               alt="${app.name}" loading="lazy"${tStyle}>
          <div class="cb-appearance-gender-badge">${genderIcon}</div>
          <div class="cb-appearance-name">${app.name}</div>
          <div class="cb-fame-lock-badge">${ICON_LOCK}${unlockFame ? `<span>${unlockFame.toLocaleString('en-US')}</span>` : ''}</div>
        `;
        // Locked — clicking shows a toast-style reminder but does not select.
        tile.addEventListener('click', () => {
          this.audio.playSfx('click');
          // Visual shake feedback
          tile.classList.add('fame-shake');
          setTimeout(() => tile.classList.remove('fame-shake'), 400);
        });
      } else {
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
      }
      grid.appendChild(tile);
    }
    container.appendChild(grid);
  }

  _applyAutoAttrs() {
    // Spend ALL remaining points using the chosen build's targetAttrs distribution.
    // Falls back to class primary attribute when no build is selected.
    const build = this._buildChoice || null;
    const target = build?.targetAttrs;
    if (target) {
      let remaining = this._pointsLeft;
      const sum = (target.STR||0)+(target.DEX||0)+(target.INT||0)+(target.CON||0) || 100;
      // Greedy ratio-based assignment so totals match exactly.
      while (remaining > 0) {
        // Pick the attr whose current spend is furthest below its target ratio.
        let best = null; let bestDiff = -Infinity;
        for (const k of ['STR','DEX','INT','CON']) {
          const w = (target[k] || 0) / sum;
          const spentK = this._attrs[k] - BASE_VALUE;
          // ideal spend = w * (already-spent total + remaining)
          const total = this._pointsSpent + remaining;
          const ideal = w * total;
          const diff = ideal - spentK;
          if (diff > bestDiff) { bestDiff = diff; best = k; }
        }
        if (!best) break;
        this._attrs[best]++;
        this._pointsSpent++;
        remaining--;
      }
    } else {
      // No build: dump into class primary, with light CON sprinkle.
      const prim = this._class?.primaryAttr || 'STR';
      let remaining = this._pointsLeft;
      while (remaining > 0) {
        const total = this._pointsSpent;
        // 80/20 primary/CON
        const spentCon = this._attrs.CON - BASE_VALUE;
        const pick = (total > 0 && spentCon / Math.max(1,total) < 0.2) ? 'CON' : prim;
        this._attrs[pick]++;
        this._pointsSpent++;
        remaining--;
      }
    }
  }

  _refreshAttrLockState() {
    if (!this._el) return;
    const lock = !!this._autoAttrs;
    this._el.querySelectorAll('.cb-attr-btn').forEach(b => {
      b.disabled = lock;
      b.style.opacity = lock ? '0.4' : '';
      b.style.pointerEvents = lock ? 'none' : '';
    });
  }

  _adjustAttr(attr, dir) {
    if (this._autoAttrs) return;
    if (dir > 0 && this._pointsLeft <= 0) return;
    if (dir < 0 && this._attrs[attr] <= BASE_VALUE) return;
    this._attrs[attr] += dir;
    this._pointsSpent += dir;
    const valEl = this._el.querySelector(`#val-${attr}`);
    if (valEl) valEl.textContent = this._attrs[attr];
    const ptsEl = this._el.querySelector('#pts-left');
    if (ptsEl) ptsEl.textContent = this._pointsLeft;
    this._updatePreview();
    this.audio.playSfx('click');
  }

  _updatePreview() {
    const grid = this._el?.querySelector('#preview-grid');
    if (!grid) return;
    const baseMode = getBaseMode();
    const BASE = { STR: BASE_VALUE, DEX: BASE_VALUE, INT: BASE_VALUE, CON: BASE_VALUE };
    const s = baseMode ? BASE : this._attrs;
    const calc = (a) => {
      const dmgH = computeHeroDamage(a, 0, 'heavy');
      const dmgL = computeHeroDamage(a, 0, 'light');
      const dmgM = computeHeroDamage(a, 0, 'magic');
      return {
        STR: a.STR, DEX: a.DEX, INT: a.INT, CON: a.CON,
        hp: 50 + a.CON * 10,
        mp: 30 + a.INT * 8,
        hit: Math.min(95, Math.round(70 + a.DEX * 1.2)),
        dodge: Math.min(40, Math.round(5 + a.DEX * 0.8)),
        init: a.DEX + 1,
        heavy: dmgH, light: dmgL, magic: dmgM,
        // M116: spell-power multiplier — unified number across every screen
        // (CombatScreen, Inventory, FormulaCodex, simulator).
        spl: a.INT * 0.025,
      };
    };
    const cur = calc(s);
    const bas = calc(BASE);
    const sc = (k, v, b) => {
      const c = statColor(v, b, k);
      return c ? ` style="color:${c}"` : '';
    };
    // computeHeroDamage returns [min, max]; show as "min - max" (or "+n" if flat).
    const rng = (a) => {
      const lo = Math.floor(a[0]);
      const hi = Math.floor(a[1]);
      return (lo === hi) ? `+${lo}` : `${lo} - ${hi}`;
    };
    grid.innerHTML = `
      <div class="preview-stat"><span class="ps-label stat-label" data-stat="HP">HP</span><span class="ps-val"${sc('hp', cur.hp, bas.hp)}>${Math.floor(cur.hp)}</span></div>
      <div class="preview-stat"><span class="ps-label stat-label" data-stat="Mana">Mana</span><span class="ps-val"${sc('mp', cur.mp, bas.mp)}>${Math.floor(cur.mp)}</span></div>
      <div class="preview-stat"><span class="ps-label stat-label" data-stat="Hit">Hit</span><span class="ps-val"${sc('hit', cur.hit, bas.hit)}>${Math.round(cur.hit)}%</span></div>
      <div class="preview-stat"><span class="ps-label stat-label" data-stat="Dodge">Dodge</span><span class="ps-val"${sc('dodge', cur.dodge, bas.dodge)}>${Math.round(cur.dodge)}%</span></div>
      <div class="preview-stat"><span class="ps-label stat-label" data-stat="Initiative">Init</span><span class="ps-val"${sc('initiative', cur.init, bas.init)}>${Math.round(cur.init)}</span></div>
      <div class="preview-stat preview-stat-wide"><span class="ps-label stat-label" data-stat="Damage Heavy">Damage (Heavy)</span><span class="ps-val"${sc('attackPower', cur.heavy[1], bas.heavy[1])}>${rng(cur.heavy)}</span></div>
      <div class="preview-stat preview-stat-wide"><span class="ps-label stat-label" data-stat="Damage Light">Damage (Light)</span><span class="ps-val"${sc('attackPower', cur.light[1], bas.light[1])}>${rng(cur.light)}</span></div>
      <div class="preview-stat preview-stat-wide"><span class="ps-label stat-label" data-stat="Magic Damage">Magic Damage</span><span class="ps-val"${sc('dmg', cur.magic[1], bas.magic[1])}>${rng(cur.magic)}</span></div>
      <div class="preview-stat preview-stat-wide"><span class="ps-label stat-label" data-stat="Spell Power">Spell Power</span><span class="ps-val"${sc('spellPower', cur.spl, bas.spl)}>+${Math.round(cur.spl * 100)}%</span></div>
    `;
    attachStatTooltips(this._el);
  }

  async _confirm() {
    const isEasy = this._difficulty === 'easy';
    const hero = {
      id: crypto.randomUUID(),
      name: this._name || 'Hero',
      class: this._class.id,
      className: this._class.name,
      appearance: (this._appearance?.id) || this._class.id,
      level: 1,
      xp: 0,
      attrs: { ...this._attrs },
      skills: [this._class.skills[0]],
      // M399 — persist build preset so the auto-allocator + Trainer can read
      // it later. Manual mode players still get a build stamped (the default)
      // so respec via Trainer works for them too.
      build: this._buildChoice?.id || (getDefaultBuild(this._class.id)?.id || null),
      equipment: buildStartingEquipment(this._class.startingEquipment || []),
      gold: 50,
      // Carry unspent creation points forward so the Skills → Attributes tab can spend them.
      pendingAttrPoints: Math.max(0, this._pointsLeft),
      pendingSkillPoints: 0,
      pendingPassivePoints: 0,
      // M412 — persist creation-time auto choices regardless of difficulty.
      // Easy still defaults all three on; non-Easy honours the player's
      // checkbox state. Manual-Characters difficulty option overrides everything.
      autoBuild: {
        auto_attrs:   !this._manualCharacters && (isEasy || this._autoAttrs),
        auto_passive: !this._manualCharacters && (isEasy || this._autoPassive),
        auto_active:  !this._manualCharacters && (isEasy || this._autoActive),
      },
      autoEquip: !this._manualCharacters && (isEasy || this._autoEquip),
    };
    // Init GameState with the new hero. Do NOT auto-save here — writing a
    // level-1 snapshot at character creation produced ghost duplicates in the
    // load menu when players later picked "New save" (which mints a new key).
    // The first real save happens when the player manually saves in town.
    GameState.init(hero);
    // Clear any stale run-stats cache from the previous run so the new run
    // cannot inherit old perChar data via the RUN_STATS_KEY merge path.
    try { (await import('../../game/stats.js')).clearRunStatsCache(); } catch (_) {}
    // M280 — record new run for lifetime stats.
    try { (await import('../../game/stats.js')).recordRunStarted(); } catch (_) {}
    // M276 D14 — Persist the advanced-options choices on the fresh state.
    // Consumers (deterministic map gen, fog-of-war reveal, hardcore lockout)
    // arrive in subsequent batches.
    {
      const gs = GameState.get();
      gs.mapSeed  = this._mapSeed || '';
      gs.fogOfWar = !!this._fogOfWar;
      gs.manualCombat = !!this._manualCombat;
      gs.manualCharacters = !!this._manualCharacters;
      gs.hardcore = !!this._hardcore;
    }
    // M278: prologue is the spawn point for fresh chars (set in GameState.init).
    // Skip the town screen entirely on the prologue path so the player isn't
    // dumped into Emberglen before they've completed the prologue mini-boss.
    // Show cinematic, then push MapScreen which renders the prologue zone.
    const gs2 = GameState.get();
    const isPrologue = gs2.zoneId === 'prologue';
    const cinematic = new OpeningCinematicScreen(this.manager, this.audio, () => {
      if (isPrologue) {
        // MapScreen import done lazily here so we don't load all map deps
        // for character creation. Falls back to TownScreen if import fails.
        import('./MapScreen.js').then(m => {
          this.manager.replace(new m.MapScreen(this.manager, this.audio));
        }).catch(() => {
          this.manager.replace(new TownScreen(this.manager, this.audio, hero, true));
        });
      } else {
        this.manager.replace(new TownScreen(this.manager, this.audio, hero, true));
      }
    });
    this.manager.replace(cinematic);
  }

  onExit() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  update() {}
  draw() {}
}

// --- Lock icon for fame-gated appearances ---
const ICON_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" focusable="false" style="width:10px;height:10px;fill:currentColor;flex-shrink:0"><path d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z"/></svg>`;

// --- Inline SVG icons for the gender filter bar ---
const ICON_MARS  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path d="M289.8 46.8c3.7-9 12.5-14.8 22.2-14.8l112 0c13.3 0 24 10.7 24 24l0 112c0 9.7-5.8 18.5-14.8 22.2s-19.3 1.7-26.2-5.2l-33.4-33.4L321 204.2c19.5 28.4 31 62.7 31 99.8c0 97.2-78.8 176-176 176S0 401.2 0 304s78.8-176 176-176c37 0 71.4 11.4 99.8 31l52.6-52.6L295 73c-6.9-6.9-8.9-17.2-5.2-26.2zM176 416a112 112 0 1 0 0-224 112 112 0 1 0 0 224z"/></svg>`;
const ICON_VENUS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" aria-hidden="true" focusable="false"><path d="M80 176a112 112 0 1 1 224 0A112 112 0 1 1 80 176zM224 349.1c81.9-15 144-86.8 144-173.1C368 78.8 289.2 0 192 0S16 78.8 16 176c0 86.3 62.1 158.1 144 173.1l0 34.9-32 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l32 0 0 32c0 17.7 14.3 32 32 32s32-14.3 32-32l0-32 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-32 0 0-34.9z"/></svg>`;
const ICON_USERS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true" focusable="false"><path d="M144 0a80 80 0 1 1 0 160A80 80 0 1 1 144 0zM512 0a80 80 0 1 1 0 160A80 80 0 1 1 512 0zM0 298.7C0 239.8 47.8 192 106.7 192l42.7 0c15.9 0 31 3.5 44.6 9.7c-1.3 7.2-1.9 14.7-1.9 22.3c0 38.2 16.8 72.5 43.3 96c-.2 0-.4 0-.7 0L21.3 320C9.6 320 0 310.4 0 298.7zM405.3 320c-.2 0-.4 0-.7 0c26.6-23.5 43.3-57.8 43.3-96c0-7.6-.7-15-1.9-22.3c13.6-6.3 28.7-9.7 44.6-9.7l42.7 0C592.2 192 640 239.8 640 298.7c0 11.8-9.6 21.3-21.3 21.3l-213.3 0zM224 224a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zM128 485.3C128 411.7 187.7 352 261.3 352l117.3 0C452.3 352 512 411.7 512 485.3c0 14.7-11.9 26.7-26.7 26.7l-330.7 0c-14.7 0-26.7-11.9-26.7-26.7z"/></svg>`;
// Small variants for per-tile gender badge (same SVG, CSS handles sizing)
const ICON_MARS_SMALL  = ICON_MARS;
const ICON_VENUS_SMALL = ICON_VENUS;

// --- Difficulty card icons (FontAwesome 6 Free, solid) ---
// fa-heart-circle-check (Easy) — auto-managed, friendly
const ICON_HEART_SHIELD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true" focusable="false"><path d="M257.5 27.6c-.8-5.4-4.9-9.8-10.3-10.6c-22.1-3.1-44.6 .9-64.4 11.4l-74 39.5C76.8 87.1 64 108.6 64 132v8 64 16c0 102.5 62.4 165.1 116.2 200.7c10.7 7.1 21.3 13 31.1 17.8c-12.4-31-18.1-65.7-15.7-101.4c5.5-81.6 70.6-148.6 151.8-156.5c1.7-.2 3.4-.3 5.1-.4c-2.6-26.5-15.4-50.7-35.7-67.5L257.5 27.6zM464 480a112 112 0 1 0 0-224 112 112 0 1 0 0 224zm59.3-141.6L495.7 366c-4.8 4.8-12.6 4.7-17.4-.2l-30.5-30.7c-4.8-4.8-4.7-12.6 .2-17.4s12.6-4.7 17.4 .2l21.9 22.1 18.9-18.9c4.8-4.8 12.6-4.8 17.4 0s4.8 12.6-.2 17.3z"/></svg>`;
// fa-shield (Normal)
const ICON_SHIELD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="M256 0c4.6 0 9.2 1 13.4 2.9L457.7 82.8c22 9.3 38.4 31 38.3 57.2c-.5 99.2-41.3 280.7-213.6 363.2c-16.7 8-36.1 8-52.8 0C57.3 420.7 16.5 239.2 16 140c-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.8 1 251.4 0 256 0z"/></svg>`;
// fa-skull (Hard)
const ICON_SKULL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="M416 398.9c58.5-41.1 96-104.1 96-174.9C512 100.3 397.4 0 256 0S0 100.3 0 224c0 70.7 37.5 133.8 96 174.9c0 .4 0 .7 0 1.1l0 64c0 26.5 21.5 48 48 48l24 0 0-48c0-8.8 7.2-16 16-16s16 7.2 16 16l0 48 64 0 0-48c0-8.8 7.2-16 16-16s16 7.2 16 16l0 48 64 0 0-48c0-8.8 7.2-16 16-16s16 7.2 16 16l0 48 24 0c26.5 0 48-21.5 48-48l0-64c0-.4 0-.7 0-1.1zM160 192a64 64 0 1 1 0 128 64 64 0 1 1 0-128zm192 0a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>`;

const ATTR_DESC = {
  STR: 'Melee damage · Physical armor',
  DEX: 'Hit chance · Dodge · Ranged damage · Initiative',
  INT: 'Spell power · Mana pool · Magic resistance',
  CON: 'Max HP · Resist status effects · Endurance',
};


// CB_STYLES moved to ./characterBuilderStyles.js (M494) to break a circular
// import: HireBuilderScreen needs the .cb-* theme but importing it from
// here would pull TownScreen -> HireBuilderScreen. Re-exported for any
// existing importers of CB_STYLES from this module.
export { CB_STYLES };
