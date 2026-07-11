/**
 * StorySettingsScreen — Story-mode specific settings.
 *
 * Controls: banter frequency slider, autosave cadence dropdown,
 * disable pressure notifications toggle. Persists to gs.story.settings.
 * Mobile target: 393×852, tap targets >= 44×44, text >= 14px.
 * No inline CSS for static values (CLAUDE.md rule).
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { SaveManager } from '../../engine/SaveManager.js';

// ---------------------------------------------------------------------------
// Styles (injected once)
// ---------------------------------------------------------------------------
const STYLE_ID = 'story-settings-screen-styles';
const STYLES = `
.sss-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0a0608;
  color: #f0e8d8;
  font-family: Inter, sans-serif;
  overflow: hidden;
}

/* Top bar */
.sss-topbar {
  display: flex;
  align-items: center;
  height: 48px;
  flex-shrink: 0;
  background: rgba(10,6,8,0.96);
  border-bottom: 1px solid rgba(232,160,32,0.2);
  padding: 0 4px;
}
.sss-topbar-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  background: transparent;
  border: none;
  color: #c8a060;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.12s;
}
.sss-topbar-btn:hover,
.sss-topbar-btn:active { background: rgba(232,160,32,0.12); }
.sss-topbar-title {
  flex: 1;
  text-align: center;
  font-family: Cinzel, serif;
  font-size: 16px;
  font-weight: 700;
  color: #e8c070;
  letter-spacing: 0.08em;
}

/* Content area */
.sss-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  -webkit-overflow-scrolling: touch;
}

/* Section header */
.sss-section {
  font-family: Cinzel, serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5a4a3a;
  margin: 1rem 0 0.5rem;
}

/* Setting row */
.sss-row {
  display: flex;
  align-items: center;
  min-height: 56px;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.sss-row-body {
  flex: 1;
  min-width: 0;
}
.sss-row-label {
  font-size: 14px;
  font-weight: 600;
  color: #e0d0b0;
}
.sss-row-desc {
  font-size: 12px;
  color: #7a6850;
  margin-top: 2px;
}

/* Range slider */
.sss-slider {
  width: 100%;
  accent-color: #e8a020;
  height: 4px;
  margin-top: 8px;
  cursor: pointer;
}

/* Select dropdown */
.sss-select {
  background: rgba(20,12,28,0.9);
  border: 1px solid rgba(232,160,32,0.3);
  border-radius: 6px;
  color: #e0d0b0;
  font-size: 14px;
  padding: 0.4rem 0.6rem;
  min-height: 44px;
  cursor: pointer;
  width: 100%;
  margin-top: 6px;
}
.sss-select:focus { outline: 2px solid rgba(232,160,32,0.5); }

/* Toggle */
.sss-toggle-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 60px;
  justify-content: flex-end;
}
.sss-toggle {
  position: relative;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
}
.sss-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.sss-toggle-track {
  position: absolute;
  inset: 0;
  background: rgba(60,40,20,0.5);
  border-radius: 14px;
  border: 1px solid rgba(232,160,32,0.2);
  transition: background 0.18s;
  cursor: pointer;
}
.sss-toggle input:checked + .sss-toggle-track {
  background: rgba(232,160,32,0.35);
  border-color: rgba(232,160,32,0.6);
}
.sss-toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #8a7060;
  border-radius: 50%;
  transition: transform 0.18s, background 0.18s;
  pointer-events: none;
}
.sss-toggle input:checked ~ .sss-toggle-thumb {
  transform: translateX(20px);
  background: #e8a020;
}

/* Value label */
.sss-value-label {
  font-size: 13px;
  color: #e8a020;
  min-width: 2ch;
  text-align: right;
}

/* Save indicator */
.sss-saved-indicator {
  font-size: 12px;
  color: #60c080;
  text-align: center;
  padding: 0.5rem;
  opacity: 0;
  transition: opacity 0.3s;
}
.sss-saved-indicator.visible { opacity: 1; }
`;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const STORY_SETTINGS_DEFAULTS = {
  banterFrequency:              'normal',  // 'off'|'low'|'normal'|'high'
  autosaveCadence:              'node',    // 'node'|'act'|'manual'
  disablePressureNotifications: false,
  showEffectChips:              true,
  showCompanionApproval:        true,
};

export class StorySettingsScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio   = audio;
    this._el     = null;
  }

  onEnter()  { injectStyles(STYLE_ID, STYLES); this._build(); }
  onResume() {}
  onPause()  {}
  update()   {}
  draw()     {}

  onExit()  { removeEl(this._el); this._el = null; }
  destroy() { this.onExit(); }

  _getSettings() {
    const gs = GameState.get();
    const existing = gs.story?.settings || {};
    return { ...STORY_SETTINGS_DEFAULTS, ...existing };
  }

  _saveSettings(partial) {
    const gs = GameState.get();
    if (gs.story) {
      gs.story.settings = { ...this._getSettings(), ...partial };
      // Add to ledger for Inspector visibility.
      gs.story.counters = gs.story.counters || {};
      gs.story.counters['_settingsVersion'] = (gs.story.counters['_settingsVersion'] || 0) + 1;
      try { SaveManager.saveCurrentGame(gs.currentSaveKey); } catch (_) {}
    }
    // Flash saved indicator.
    const ind = this._el?.querySelector('#sss-saved-ind');
    if (ind) {
      ind.classList.add('visible');
      setTimeout(() => ind.classList.remove('visible'), 1500);
    }
  }

  _build() {
    this._el = createEl('div', 'sss-screen');
    const settings = this._getSettings();

    // Top bar
    const topBar = createEl('div', 'sss-topbar');
    topBar.innerHTML = `
      <button type="button" class="sss-topbar-btn" id="sss-back" aria-label="Back">&#8592;</button>
      <span class="sss-topbar-title">Story Settings</span>
      <div style="width:44px"></div>
    `;
    this._el.appendChild(topBar);

    // Content
    const content = createEl('div', 'sss-content');

    // Banter frequency
    content.appendChild(this._sectionHeader('Companions'));
    content.appendChild(this._banterRow(settings));

    // Autosave
    content.appendChild(this._sectionHeader('Save'));
    content.appendChild(this._autosaveRow(settings));

    // Notifications
    content.appendChild(this._sectionHeader('UI'));
    content.appendChild(this._toggleRow(
      'Disable Pressure Notifications',
      'Hides the pressure-chip toast when the Director escalates.',
      'disablePressureNotifications',
      settings.disablePressureNotifications
    ));
    content.appendChild(this._toggleRow(
      'Show Effect Chips',
      'Displays sliding effect-preview chips above dialog choices.',
      'showEffectChips',
      settings.showEffectChips
    ));
    content.appendChild(this._toggleRow(
      'Show Companion Approval',
      'Shows approval delta badges when choices affect companions.',
      'showCompanionApproval',
      settings.showCompanionApproval
    ));

    // Saved indicator
    const savedInd = createEl('div', 'sss-saved-indicator');
    savedInd.id = 'sss-saved-ind';
    savedInd.textContent = 'Settings saved';
    content.appendChild(savedInd);

    this._el.appendChild(content);
    this.manager.uiOverlay.appendChild(this._el);

    topBar.querySelector('#sss-back').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      this.manager.pop();
    });
  }

  _sectionHeader(text) {
    const el = createEl('div', 'sss-section');
    el.textContent = text;
    return el;
  }

  _banterRow(settings) {
    const row = createEl('div', 'sss-row');
    row.innerHTML = `
      <div class="sss-row-body">
        <div class="sss-row-label">Banter Frequency</div>
        <div class="sss-row-desc">How often companions offer remarks after node resolution.</div>
        <select class="sss-select" id="sss-banter-select" aria-label="Banter frequency">
          <option value="off"    ${settings.banterFrequency === 'off'    ? 'selected' : ''}>Off</option>
          <option value="low"    ${settings.banterFrequency === 'low'    ? 'selected' : ''}>Low</option>
          <option value="normal" ${settings.banterFrequency === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="high"   ${settings.banterFrequency === 'high'   ? 'selected' : ''}>High</option>
        </select>
      </div>
    `;
    row.querySelector('#sss-banter-select').addEventListener('change', e => {
      this._saveSettings({ banterFrequency: e.target.value });
    });
    return row;
  }

  _autosaveRow(settings) {
    const row = createEl('div', 'sss-row');
    row.innerHTML = `
      <div class="sss-row-body">
        <div class="sss-row-label">Autosave Cadence</div>
        <div class="sss-row-desc">When the game automatically saves your progress.</div>
        <select class="sss-select" id="sss-autosave-select" aria-label="Autosave cadence">
          <option value="node"   ${settings.autosaveCadence === 'node'   ? 'selected' : ''}>After every node</option>
          <option value="act"    ${settings.autosaveCadence === 'act'    ? 'selected' : ''}>After each act</option>
          <option value="manual" ${settings.autosaveCadence === 'manual' ? 'selected' : ''}>Manual only</option>
        </select>
      </div>
    `;
    row.querySelector('#sss-autosave-select').addEventListener('change', e => {
      this._saveSettings({ autosaveCadence: e.target.value });
    });
    return row;
  }

  _toggleRow(label, desc, key, currentValue) {
    const row = createEl('div', 'sss-row');
    const uid = `sss-toggle-${key}`;
    row.innerHTML = `
      <div class="sss-row-body">
        <div class="sss-row-label">${label}</div>
        <div class="sss-row-desc">${desc}</div>
      </div>
      <div class="sss-toggle-wrap">
        <label class="sss-toggle" aria-label="${label}">
          <input type="checkbox" id="${uid}" ${currentValue ? 'checked' : ''}>
          <div class="sss-toggle-track"></div>
          <div class="sss-toggle-thumb"></div>
        </label>
      </div>
    `;
    row.querySelector(`#${uid}`).addEventListener('change', e => {
      this._saveSettings({ [key]: e.target.checked });
    });
    return row;
  }
}
