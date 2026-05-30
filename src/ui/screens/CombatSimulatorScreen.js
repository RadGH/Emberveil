/**
 * CombatSimulatorScreen — debug-only combat simulator UI (M83+).
 *
 * Gated behind localStorage `game13_debug_mode === 'true'`. Loads the live
 * party from GameState, lets you tweak heroes/encounters/act, then calls the
 * pure simulator in src/game/simulator.js. All math goes through formulas.js
 * so this screen is a read-only view of the real combat model.
 *
 * Chart.js is loaded via CDN on mount (no npm dep).
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { ENCOUNTERS, ENEMIES, ENEMIES_ACT4, ENEMIES_ACT5, ENEMIES_ACT6 } from '../../maps/mapData.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { WEAPON_BASES, ARMOR_BASES, generateItem } from '../../game/items.js';
import { runSimulation, runMonteCarlo, runMonteCarloAsync, rewardsPerMinute, autoAssignAttrs, autoGenerateEquipment } from '../../game/simulator.js';
import { CLASSES } from '../../game/classes.js';
import { HIREABLES_ACT1 } from './TownScreen.js';
import { TitleScreen } from './TitleScreen.js'; // AGENT-E: main menu button

const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
const PRESETS_KEY = 'game13_sim_presets';

export class CombatSimulatorScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this._el = null;
    this._heroes = [];    // editable snapshot of party
    this._enemies = [];   // editable snapshot of encounter enemies
    this._act = 1;
    this._selectedEncounterKey = Object.keys(ENCOUNTERS)[0] || null;
    this._charts = [];
    this._lastResult = null;
    // Diff-vs-previous: ring buffer of last 2 MC summaries
    this._mcHistory = [];  // max 2 entries: { label, winRate, avgRounds, dmgMean }
    this._benchmarkMode = false;
  }

  onEnter() {
    this._loadLivePartySnapshot();
    if (this._selectedEncounterKey) this._loadEncounter(this._selectedEncounterKey);
    this._build();
    this._ensureChartJs();
  }

  _loadLivePartySnapshot() {
    const party = GameState.getParty ? GameState.getParty() : [];
    const comps = GameState.getCompanions ? GameState.getCompanions() : [];
    // Deep-copy minimal fields the sim needs so we can edit without mutating save
    const clone = (m, isComp) => ({
      id: m.id || m.name,
      name: m.name || (isComp ? 'Companion' : 'Hero'),
      cls: m.cls || m.className || '',
      level: m.level || 1,
      attrs: {
        STR: (m.attrs && m.attrs.STR) || 10,
        DEX: (m.attrs && m.attrs.DEX) || 10,
        INT: (m.attrs && m.attrs.INT) || 10,
        CON: (m.attrs && m.attrs.CON) || 10,
      },
      equipment: structuredClone(m.equipment || {}),
      passives: m.passives || {},
      skills: m.skills || [],
      isCompanion: !!isComp,
    });
    this._heroes = [
      ...party.map(p => clone(p, false)),
      ...comps.map(c => clone(c, true)),
    ];
    if (!this._heroes.length) {
      // Fallback dummy party so the sim always has something
      this._heroes.push({
        id: 'dummy', name: 'Dummy Warrior', cls: 'warrior', level: 5,
        attrs: { STR: 14, DEX: 12, INT: 8, CON: 12 },
        equipment: {}, passives: {}, skills: [], isCompanion: false,
      });
    }
  }

  _loadEncounter(key) {
    const enc = ENCOUNTERS[key];
    if (!enc) return;
    this._selectedEncounterKey = key;
    const enemies = [];
    let idx = 0;
    for (const group of enc.enemies) {
      const count = group.count || 1;
      for (let i = 0; i < count; i++) {
        enemies.push({
          uid: `e${idx++}`,
          id: group.id, name: group.name || group.id,
          level: group.level || 1,
          hp: group.hp, maxHp: group.maxHp || group.hp,
          dmg: [...(group.dmg || [1, 2])],
          armor: group.armor || 0,
          hit: group.hit || 60, dodge: group.dodge || 5,
          xpValue: group.xpValue || 0, gold: [...(group.gold || [0, 0])],
        });
      }
    }
    this._enemies = enemies;
  }

  _ensureChartJs() {
    if (window.Chart) return;
    if (document.getElementById('chartjs-cdn')) return;
    const s = document.createElement('script');
    s.id = 'chartjs-cdn';
    s.src = CHART_CDN;
    s.defer = true;
    document.head.appendChild(s);
  }

  _build() {
    injectStyles('combat-sim-styles', `
      .csim-screen {
        position: absolute; inset: 0;
        background: rgba(5,2,8,0.96);
        color: #e8d8b8;
        overflow-y: auto; -webkit-overflow-scrolling: touch;
        padding: 1rem 1rem 3rem;
        font-family: 'Cinzel', Georgia, serif;
      }
      .csim-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; }
      .csim-return {
        flex-shrink: 0; background: rgba(232,160,32,0.18);
        border: 1px solid rgba(232,160,32,0.6); color: #e8a020;
        font-family: inherit; font-size: 0.7rem; cursor: pointer;
        padding: 0.5rem 0.8rem; border-radius: 4px;
        letter-spacing: 0.1em; text-transform: uppercase; min-height: 40px;
      }
      .csim-return:hover { background: rgba(232,160,32,0.32); color: #f8c040; }
      .csim-header-text { flex: 1; }
      .csim-title { font-size: 1.3rem; color: #e8a020; letter-spacing: 0.12em; margin: 0.2rem 0 0.2rem; }
      .csim-sub { font-size: 0.65rem; color: #8a7a6a; letter-spacing: 0.15em; text-transform: uppercase; }
      .csim-screen select, .csim-screen .csim-row select {
        -webkit-appearance: none; -moz-appearance: none; appearance: none;
        background-color: #1a1218;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%23e8a020' d='M0 0 L6 8 L12 0 Z'/></svg>");
        background-repeat: no-repeat;
        background-position: right 0.5rem center;
        background-size: 10px 6px;
        border: 1px solid #e8a020;
        color: #e8d8b8;
        padding: 0.25rem 1.4rem 0.25rem 0.4rem;
        border-radius: 3px;
        font-family: inherit; font-size: 0.8rem;
      }
      .csim-screen select:focus { outline: none; border-color: #f8c040; box-shadow: 0 0 0 2px rgba(232,160,32,0.25); }
      .csim-screen select option { background: #1a1218; color: #e8d8b8; }
      .csim-charts canvas { max-height: 200px !important; }
      .csim-grid { display: flex; flex-direction: column; gap: 1rem; }
      @media (min-width: 720px) { .csim-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; } }
      .csim-panel {
        background: rgba(20,10,15,0.85);
        border: 1px solid rgba(232,160,32,0.35);
        border-radius: 6px;
        padding: 0.75rem;
      }
      .csim-panel h3 { margin: 0 0 0.6rem; font-size: 0.95rem; color: #e8a020; }
      .csim-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 4px;
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.8rem;
      }
      .csim-card label { display: inline-block; min-width: 40px; font-size: 0.65rem; color: #8a7a6a; text-transform: uppercase; }
      .csim-card input, .csim-card select {
        width: 60px; margin: 0 0.4rem 0.2rem 0;
        background: rgba(20,10,15,0.85); border: 1px solid rgba(232,160,32,0.4);
        color: #e8d8b8; padding: 0.15rem 0.3rem; border-radius: 3px;
        font-family: inherit; font-size: 0.8rem;
      }
      .csim-card select:focus, .csim-card input:focus {
        outline: none; border-color: rgba(232,160,32,0.8);
        box-shadow: 0 0 0 2px rgba(232,160,32,0.2);
      }
      .csim-card select option {
        background: rgba(20,10,15,0.95); color: #e8d8b8;
        border: none; padding: 0.2rem 0.3rem;
      }
      .csim-card .equip-slot { display: block; font-size: 0.7rem; color: #a89888; margin-top: 0.2rem; }
      .csim-card select.wide { width: 100%; }
      .csim-row { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
      .csim-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.8rem 0; }
      .csim-btn {
        background: rgba(232,160,32,0.18); border: 1px solid rgba(232,160,32,0.6);
        color: #e8a020; padding: 0.6rem 0.9rem; border-radius: 4px;
        font-family: inherit; font-size: 0.7rem; letter-spacing: 0.1em;
        text-transform: uppercase; cursor: pointer; min-height: 44px;
      }
      .csim-btn:hover { background: rgba(232,160,32,0.32); }
      .csim-btn-small {
        background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.4);
        color: #e8a020; padding: 0.3rem 0.6rem; border-radius: 3px;
        font-family: inherit; font-size: 0.65rem; cursor: pointer;
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .csim-btn-small:hover { background: rgba(232,160,32,0.25); }
      .csim-party-controls {
        display: flex; gap: 0.5rem; margin-bottom: 0.8rem; flex-wrap: wrap;
      }
      .csim-remove-btn {
        background: rgba(192,64,48,0.15); border: 1px solid rgba(192,64,48,0.4);
        color: #c04030; width: 24px; height: 24px; border-radius: 3px;
        font-family: inherit; font-size: 0.8rem; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .csim-remove-btn:hover { background: rgba(192,64,48,0.25); }
      .csim-output {
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(232,160,32,0.25);
        border-radius: 4px;
        padding: 0.6rem; font-family: 'Courier New', monospace;
        font-size: 0.7rem; max-height: 220px; overflow-y: auto;
        white-space: pre-wrap;
      }
      .csim-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; font-size: 0.75rem; margin-top: 0.5rem; }
      .csim-stats .k { color: #8a7a6a; text-transform: uppercase; font-size: 0.65rem; }
      .csim-stats .v { color: #e8d8b8; font-weight: 700; }
      .csim-charts { margin-top: 1rem; display: grid; gap: 1rem; }
      .csim-charts canvas { background: rgba(0,0,0,0.4); border-radius: 4px; max-width: 100%; }
      .csim-back {
        margin-top: 1rem; background: none; border: none; color: #8a7a6a;
        font-size: 0.85rem; cursor: pointer; text-decoration: underline;
      }
      .csim-modal {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 1000;
        font-family: 'Cinzel', Georgia, serif;
      }
      .csim-modal-content {
        position: relative;
        background: #1a1218;
        border: 1px solid #e8a020;
        border-radius: 12px;
        padding: 24px;
        max-width: 90vw;
        width: 520px;
        max-height: 85vh;
        overflow-y: auto;
        color: #f0e8d8;
      }
      .csim-modal-close {
        position: absolute;
        top: 12px; right: 12px;
        background: none; border: none;
        color: #e8a020; font-size: 22px;
        cursor: pointer; line-height: 1;
      }
      .csim-modal-close:hover { color: #f8c040; }
      .csim-char-option {
        display: flex; gap: 0.75rem; padding: 0.75rem; margin: 0.5rem 0;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px; cursor: pointer; transition: all 0.2s;
      }
      .csim-char-option:hover { background: rgba(232,160,32,0.1); border-color: rgba(232,160,32,0.3); }
      .option-icon { width: 28px; height: 28px; flex-shrink: 0; color: #e8a020; margin-top: 0.1rem; }
      .option-icon svg { width: 100%; height: 100%; }
      .option-title { font-weight: 600; color: #e8d8b8; font-size: 0.9rem; margin-bottom: 0.2rem; }
      .option-desc { font-size: 0.75rem; color: #8a7a6a; font-family: system-ui, sans-serif; }
      .csim-class-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
      @media (max-width: 600px) { .csim-class-grid { grid-template-columns: 1fr; } }
      .csim-modal-buttons { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); }
      .csim-save-option { padding: 0.75rem; margin: 0.5rem 0; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; cursor: pointer; transition: all 0.2s; }
      .csim-save-option:hover { background: rgba(232,160,32,0.1); border-color: rgba(232,160,32,0.3); }
      .save-title { font-weight: 600; color: #e8d8b8; font-size: 0.9rem; margin-bottom: 0.3rem; }
      .save-details { font-size: 0.75rem; color: #c0a8e8; margin-bottom: 0.2rem; }
      .save-timestamp { font-size: 0.65rem; color: #8a7a6a; font-style: italic; }
      .csim-modal-group-title {
        color: #c0a8e8; font-size: 0.7rem; margin: 0.8rem 0 0.4rem;
        text-transform: uppercase; letter-spacing: 0.1em;
      }
      .csim-diff-panel {
        background: rgba(20,10,15,0.85);
        border: 1px solid rgba(130,90,200,0.45);
        border-radius: 6px; padding: 0.65rem 0.75rem; margin-top: 0.8rem;
      }
      .csim-diff-panel h4 { margin: 0 0 0.45rem; font-size: 0.8rem; color: #c0a8e8; }
      .csim-diff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
      .csim-diff-cell { text-align: center; }
      .csim-diff-cell .dk { font-size: 0.6rem; color: #8a7a6a; text-transform: uppercase; display: block; }
      .csim-diff-cell .dv { font-size: 0.85rem; font-weight: 700; color: #e8d8b8; display: block; }
      .csim-diff-cell .dd { font-size: 0.75rem; font-weight: 700; display: block; }
      .csim-diff-pos { color: #7ec67e; }
      .csim-diff-neg { color: #e85c5c; }
      .csim-diff-neu { color: #8a7a6a; }
      .csim-bench-panel {
        background: rgba(20,10,15,0.85);
        border: 1px solid rgba(232,160,32,0.3);
        border-radius: 6px; padding: 0.65rem 0.75rem; margin-top: 0.8rem;
      }
      .csim-bench-panel h4 { margin: 0 0 0.5rem; font-size: 0.8rem; color: #e8a020; }
      .csim-bench-bars { display: flex; flex-direction: column; gap: 0.4rem; }
      .csim-bench-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; }
      .csim-bench-lbl { flex: 0 0 50px; color: #8a7a6a; text-align: right; }
      .csim-bench-track { flex: 1; height: 16px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
      .csim-bench-fill { height: 100%; border-radius: 3px; background: #e8a020; transition: width 0.3s; }
      .csim-bench-pct { flex: 0 0 42px; color: #e8d8b8; font-weight: 700; }
      .csim-btn-active { background: rgba(232,160,32,0.38) !important; border-color: #f8c040 !important; color: #f8c040 !important; }
    `);

    this._el = createEl('div', 'csim-screen');
    this._el.innerHTML = `
      <div class="csim-header">
        <!-- AGENT-E: main menu button -->
        <button type="button" class="csim-return" id="csim-return">Main Menu</button>
        <div class="csim-header-text">
          <div class="csim-title">Combat Simulator</div>
          <div class="csim-sub">Debug · Live party loaded · formulas.js parity${window.__simDataOverrides ? ' · <span style="color:#60c060">Custom Data Active</span>' : ''}</div>
        </div>
      </div>

      <div class="csim-grid">
        <div class="csim-panel" id="csim-heroes-panel">
          <h3>Party</h3>
          <div class="csim-party-controls">
            <button type="button" class="csim-btn-small" id="csim-add-char">+ Add Character</button>
            <button type="button" class="csim-btn-small" id="csim-load-save">Load from Save</button>
            <!-- AGENT-E: load from file -->
            <button type="button" class="csim-btn-small" id="csim-load-file">Load from File</button>
            <input type="file" id="csim-load-file-input" accept="application/json,.json" style="display:none">
          </div>
          <div id="csim-heroes"></div>
        </div>

        <div class="csim-panel" id="csim-enemy-panel">
          <h3>Encounter</h3>
          <div class="csim-party-controls">
            <button type="button" class="csim-btn-small" id="csim-encounter-btn">+ Add Encounter</button>
            <button type="button" class="csim-btn-small" id="csim-add-enemy">+ Add Enemy</button>
          </div>
          <div class="csim-row" style="margin-top:0.4rem">
            <label class="k">Act</label>
            <select id="csim-act-sel">
              ${[1,2,3,4,5].map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
          </div>
          <div id="csim-enemies" style="margin-top:0.6rem"></div>
        </div>
      </div>

      <div class="csim-actions">
        <button type="button" class="csim-btn" id="csim-run">Run Simulation</button>
        <button type="button" class="csim-btn" id="csim-run-1000">Run 1000×</button>
        <button type="button" class="csim-btn" id="csim-benchmark">Benchmark</button>
        <button type="button" class="csim-btn" id="csim-save-preset">Save Preset</button>
        <button type="button" class="csim-btn" id="csim-load-preset">Load Preset</button>
        <button type="button" class="csim-btn" id="csim-export-enc">Export Encounter</button>
        <button type="button" class="csim-btn" id="csim-import-enc">Import Encounter</button>
        <input type="file" id="csim-import-enc-file" accept=".json" hidden>
      </div>

      <div class="csim-panel">
        <h3>Output</h3>
        <div class="csim-output" id="csim-log">No simulation run yet.</div>
        <div class="csim-stats" id="csim-stats"></div>
        <div class="csim-diff-panel" id="csim-diff-panel" style="display:none">
          <h4>Diff vs previous run</h4>
          <div class="csim-diff-grid" id="csim-diff-grid"></div>
        </div>
        <div class="csim-bench-panel" id="csim-bench-panel" style="display:none">
          <h4>Benchmark — win rate by level</h4>
          <div class="csim-bench-bars" id="csim-bench-bars"></div>
        </div>
      </div>

      <div class="csim-charts">
        <canvas id="csim-chart-hp" height="220"></canvas>
        <canvas id="csim-chart-dmg" height="220"></canvas>
      </div>

      <button type="button" class="csim-back" id="csim-back">← Back</button>
    `;
    this.manager.uiOverlay.appendChild(this._el);

    // Encounter button → opens modal picker
    const encBtn = this._el.querySelector('#csim-encounter-btn');
    const updateEncBtnLabel = () => {
      encBtn.textContent = '+ Add Encounter';
    };
    updateEncBtnLabel();
    encBtn.addEventListener('click', () => {
      this._openEncounterPickerModal(() => {
        updateEncBtnLabel();
        this._renderEnemies();
      });
    });

    this._el.querySelector('#csim-act-sel').addEventListener('change', (e) => {
      this._act = parseInt(e.target.value, 10) || 1;
    });

    this._renderHeroes();
    this._renderEnemies();

    this._el.querySelector('#csim-run').addEventListener('click', () => this._runOnce());
    this._el.querySelector('#csim-run-1000').addEventListener('click', () => this._runMonteCarlo());
    this._el.querySelector('#csim-benchmark').addEventListener('click', () => this._toggleBenchmark());
    this._el.querySelector('#csim-save-preset').addEventListener('click', () => this._savePreset());
    this._el.querySelector('#csim-load-preset').addEventListener('click', () => this._openLoadPresetModal());
    this._el.querySelector('#csim-export-enc').addEventListener('click', () => this._exportEncounter());
    const impEncBtn = this._el.querySelector('#csim-import-enc');
    const impEncFile = this._el.querySelector('#csim-import-enc-file');
    impEncBtn.addEventListener('click', () => impEncFile.click());
    impEncFile.addEventListener('change', (e) => this._importEncounter(e));
    this._el.querySelector('#csim-return').addEventListener('click', () => {
      // AGENT-E: main menu button — route to TitleScreen instead of pop-to-game.
      this.audio && this.audio.playSfx && this.audio.playSfx('click');
      while (this.manager._stack.length) this.manager.pop();
      this.manager.push(new TitleScreen(this.manager, this.audio));
    });
    this._el.querySelector('#csim-back').addEventListener('click', () => {
      this.audio && this.audio.playSfx && this.audio.playSfx('click');
      this.manager.pop();
    });

    this._el.querySelector('#csim-add-char').addEventListener('click', () => this._addCharacterDialog());
    this._el.querySelector('#csim-load-save').addEventListener('click', () => this._loadSaveDialog());

    // AGENT-E: load from file — accepts single-save JSON exported from Settings.
    const loadFileInput = this._el.querySelector('#csim-load-file-input');
    this._el.querySelector('#csim-load-file').addEventListener('click', () => {
      this.audio && this.audio.playSfx && this.audio.playSfx('click');
      loadFileInput.click();
    });
    loadFileInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const parsed = JSON.parse(text);
        let record = null;
        if (parsed && parsed.emberveilSingle === 1 && typeof parsed.data === 'string') {
          record = JSON.parse(parsed.data);
        } else if (parsed && Array.isArray(parsed.party)) {
          // Accept a raw save record too.
          record = parsed;
        } else {
          throw new Error('Not a valid single-save file.');
        }
        const saveData = {
          key: record.key || 'file',
          name: record.heroName || 'Hero',
          timestamp: record.timestamp || '',
          act: record.act || 1,
          party: record.party || [],
          companions: record.companions || [],
        };
        this._loadPartyFromSave(saveData);
      } catch (err) {
        alert('Load failed: ' + err.message);
      }
      loadFileInput.value = '';
    });

    // Add Enemy button → opens modal picker grouped by act.
    this._el.querySelector('#csim-add-enemy').addEventListener('click', () => {
      this._openEnemyPickerModal();
    });
  }

  // Shared modal helpers ------------------------------------------------------
  _closeOpenModal() {
    if (this._openModal) {
      try { this._openModal.remove(); } catch (_) {}
      this._openModal = null;
    }
  }

  _createModal(innerHtml) {
    this._closeOpenModal();
    const modal = createEl('div', 'csim-modal');
    modal.innerHTML = `
      <div class="csim-modal-content">
        <button type="button" class="csim-modal-close" aria-label="Close">×</button>
        ${innerHtml}
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this._closeOpenModal();
    });
    modal.querySelector('.csim-modal-close').addEventListener('click', () => this._closeOpenModal());
    document.body.appendChild(modal);
    this._openModal = modal;
    return modal;
  }

  _openEncounterPickerModal(onPick) {
    const keys = Object.keys(ENCOUNTERS);
    const items = keys.map(key => {
      const enc = ENCOUNTERS[key];
      const diff = this._calculateEncounterDifficulty(enc);
      return `
        <div class="csim-save-option" data-enc-key="${key}">
          <div class="save-title">${key} — ${enc.name || ''}</div>
          <div class="save-details">Lv.${diff.enemyLevel} · ${diff.count} enemies · ${diff.threat}</div>
        </div>`;
    }).join('');
    const modal = this._createModal(`
      <h3 style="margin-top:0;color:#e8a020;">Select Encounter</h3>
      <div>${items}</div>
    `);
    modal.querySelectorAll('[data-enc-key]').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.encKey;
        this._loadEncounter(key);
        this._closeOpenModal();
        if (onPick) onPick();
      });
    });
  }

  _openEnemyPickerModal() {
    // Group enemies by act source
    const groups = [
      { label: 'Acts 1–3', src: ENEMIES },
      { label: 'Act 4', src: ENEMIES_ACT4 || {} },
      { label: 'Act 5', src: ENEMIES_ACT5 || {} },
      { label: 'Act 6', src: ENEMIES_ACT6 || {} },
    ];
    const sections = groups.map((g, gi) => {
      const entries = Object.entries(g.src)
        .filter(([, e]) => e && typeof e === 'object')
        .sort(([, a], [, b]) => (a.level || 0) - (b.level || 0));
      if (!entries.length) return '';
      const rows = entries.map(([key, e]) => `
        <div class="csim-save-option" data-enemy-group="${gi}" data-enemy-key="${key}">
          <div class="save-title">${e.name || key} <span style="color:#8a7a6a;font-size:0.7rem">lv ${e.level || 1}</span></div>
          <div class="save-details">HP ${e.hp || e.maxHp || '?'} · DMG ${Array.isArray(e.dmg) ? e.dmg.join('-') : (e.dmg || '?')} · ARM ${e.armor || 0}</div>
        </div>
      `).join('');
      return `<div class="csim-modal-group-title">${g.label}</div>${rows}`;
    }).join('');
    const modal = this._createModal(`
      <h3 style="margin-top:0;color:#e8a020;">Add Enemy</h3>
      <div>${sections}</div>
    `);
    modal.querySelectorAll('[data-enemy-key]').forEach(el => {
      el.addEventListener('click', () => {
        const gi = parseInt(el.dataset.enemyGroup, 10);
        const key = el.dataset.enemyKey;
        const src = groups[gi].src;
        const e = src[key];
        if (!e) return;
        const tpl = {
          id: key,
          name: e.name || key,
          level: e.level || 1,
          hp: e.hp || e.maxHp || 20,
          dmg: Array.isArray(e.dmg) ? [...e.dmg] : [1, 2],
          armor: e.armor || 0,
          hit: e.hit || 60,
          dodge: e.dodge || 5,
        };
        this._addPredefinedEnemy(tpl);
        this._closeOpenModal();
      });
    });
  }

  _allItemKeys() {
    const weaponBases = this._getDataSource('WEAPON_BASES') || WEAPON_BASES;
    const armorBases = this._getDataSource('ARMOR_BASES') || ARMOR_BASES;
    return [
      ...Object.keys(weaponBases || {}).map(k => ({ key: k, kind: 'weapon' })),
      ...Object.keys(armorBases || {}).map(k => ({ key: k, kind: 'armor' })),
    ];
  }

  _getDataSource(key) {
    // Check for imported data overrides first
    return window.__simDataOverrides?.[key];
  }

  _calculateEncounterDifficulty(encounter) {
    if (!encounter.enemies || encounter.enemies.length === 0) {
      return { enemyLevel: 1, count: 0, threat: 'Unknown' };
    }

    let totalHP = 0;
    let totalDamage = 0;
    let totalEnemies = 0;

    encounter.enemies.forEach(enemy => {
      const count = enemy.count || 1;
      totalEnemies += count;
      totalHP += (enemy.hp || enemy.maxHp || 20) * count;
      const avgDmg = Array.isArray(enemy.dmg)
        ? (enemy.dmg[0] + enemy.dmg[1]) / 2
        : (enemy.dmg || 5);
      totalDamage += avgDmg * count;
    });

    // Rough level calculation based on HP and damage
    const avgHP = totalHP / totalEnemies;
    const avgDamage = totalDamage / totalEnemies;

    // Simple heuristic: level = (HP + damage*3) / 15
    const estimatedLevel = Math.max(1, Math.round((avgHP + avgDamage * 3) / 15));

    // Threat assessment
    let threat = 'Easy';
    if (totalEnemies >= 4 || estimatedLevel >= 8) threat = 'Hard';
    else if (totalEnemies >= 3 || estimatedLevel >= 5) threat = 'Medium';

    return {
      enemyLevel: estimatedLevel,
      count: totalEnemies,
      threat: threat
    };
  }

  _renderHeroes() {
    const root = this._el.querySelector('#csim-heroes');
    root.innerHTML = '';
    const itemOpts = this._allItemKeys();
    this._heroes.forEach((h, i) => {
      const card = createEl('div', 'csim-card');
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;">
          <input type="text" data-h="${i}" data-k="name" value="${(h.name || '').replace(/"/g,'&quot;')}" style="flex:1;width:auto;font-weight:700;color:#e8a020;">
          <span style="color:#8a7a6a;font-size:0.65rem">${h.cls || ''}${h.isCompanion?' (comp)':''}</span>
          <button type="button" class="csim-remove-btn" data-remove-hero="${i}">×</button>
        </div>
        <div class="csim-row">
          <label>LVL</label><input type="number" data-h="${i}" data-k="level" value="${h.level}" min="1" max="30">
          <label>STR</label><input type="number" data-h="${i}" data-k="STR" value="${h.attrs.STR}">
          <label>DEX</label><input type="number" data-h="${i}" data-k="DEX" value="${h.attrs.DEX}">
          <label>INT</label><input type="number" data-h="${i}" data-k="INT" value="${h.attrs.INT}">
          <label>CON</label><input type="number" data-h="${i}" data-k="CON" value="${h.attrs.CON}">
        </div>
        <div class="equip-slot">Equipment slots: ${Object.keys(h.equipment || {}).join(', ') || '(none)'}</div>
        <div class="csim-row" style="margin-top:0.3rem">
          <select data-h="${i}" data-k="addItem" class="wide">
            <option value="">+ Swap/add item…</option>
            ${itemOpts.map(o => `<option value="${o.kind}:${o.key}">${o.kind}: ${o.key}</option>`).join('')}
          </select>
        </div>
      `;
      root.appendChild(card);
    });
    root.querySelectorAll('input[data-h]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.h, 10);
        const k = e.target.dataset.k;
        if (k === 'name') { this._heroes[i].name = e.target.value; return; }
        const v = parseInt(e.target.value, 10) || 0;
        if (k === 'level') this._heroes[i].level = v;
        else this._heroes[i].attrs[k] = v;
      });
    });
    root.querySelectorAll('select[data-k="addItem"]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.h, 10);
        const val = e.target.value;
        if (!val) return;
        const [kind, key] = val.split(':');
        try {
          const item = generateItem(key, 'normal', 'medium');
          this._heroes[i].equipment = this._heroes[i].equipment || {};
          this._heroes[i].equipment[kind] = item;
        } catch (_) { /* base pool may not support this key */ }
        this._renderHeroes();
      });
    });

    // Add event listeners for remove buttons
    this._el.querySelectorAll('[data-remove-hero]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.removeHero, 10);
        if (confirm(`Remove ${this._heroes[i]?.name || 'character'}?`)) {
          this._heroes.splice(i, 1);
          this._renderHeroes();
        }
      });
    });
  }

  _renderEnemies() {
    const root = this._el.querySelector('#csim-enemies');
    root.innerHTML = '';
    this._enemies.forEach((e, i) => {
      const card = createEl('div', 'csim-card');
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:700;color:#e8a020">${e.name} <span style="color:#8a7a6a;font-size:0.65rem">lvl ${e.level}</span></div>
          <button type="button" class="csim-remove-btn" data-remove-enemy="${i}">×</button>
        </div>
        <div class="csim-row">
          <label>HP</label><input type="number" data-e="${i}" data-k="hp" value="${e.hp}">
          <label>DMG-</label><input type="number" data-e="${i}" data-k="dmgMin" value="${e.dmg[0]}">
          <label>DMG+</label><input type="number" data-e="${i}" data-k="dmgMax" value="${e.dmg[1]}">
          <label>ARM</label><input type="number" data-e="${i}" data-k="armor" value="${e.armor}">
          <label>HIT</label><input type="number" data-e="${i}" data-k="hit" value="${e.hit}">
          <label>DODGE</label><input type="number" data-e="${i}" data-k="dodge" value="${e.dodge}">
          <label>LVL</label><input type="number" data-e="${i}" data-k="level" value="${e.level}">
        </div>
      `;
      root.appendChild(card);
    });
    root.querySelectorAll('input[data-e]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.e, 10);
        const k = e.target.dataset.k;
        const v = parseInt(e.target.value, 10) || 0;
        const en = this._enemies[i];
        if (k === 'dmgMin') en.dmg[0] = v;
        else if (k === 'dmgMax') en.dmg[1] = v;
        else en[k] = v;
        if (k === 'hp') en.maxHp = v;
      });
    });

    // Add event listeners for remove buttons
    this._el.querySelectorAll('[data-remove-enemy]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.removeEnemy, 10);
        if (confirm(`Remove ${this._enemies[i]?.name || 'enemy'}?`)) {
          this._enemies.splice(i, 1);
          this._renderEnemies();
        }
      });
    });
  }

  _buildEncounterForSim() {
    return {
      name: 'Custom',
      enemies: this._enemies.map(e => ({ ...e, count: 1 })),
    };
  }

  _runOnce() {
    const encounter = this._buildEncounterForSim();
    const seed = (Math.random() * 2 ** 31) | 0;
    const result = runSimulation({
      heroes: this._heroes,
      encounter,
      act: this._act,
      seed,
    });
    result.seed = seed;
    this._lastResult = result;
    this._renderResult(result);
    this._drawHpChart(result);
  }

  async _runMonteCarlo() {
    if (this._mcRunning) return;
    this._mcRunning = true;
    const encounter = this._buildEncounterForSim();
    const btn = this._el.querySelector('#csim-run-1000');
    const logEl = this._el.querySelector('#csim-log');
    const prevLabel = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Running… 0%'; }
    try {
      const mc = await runMonteCarloAsync({
        heroes: this._heroes,
        encounter,
        act: this._act,
        runs: 200, // M398: lowered from 1000; async batches yield to UI thread
        baseSeed: 1,
        batchSize: 25,
        onProgress: (done, total) => {
          if (btn) btn.textContent = `Running… ${Math.round((done/total)*100)}%`;
          if (logEl) logEl.textContent = `Monte Carlo — ${done}/${total} runs…`;
        },
      });
      logEl.textContent =
        `Monte Carlo — ${mc.runs} runs\n` +
        `Win rate: ${(mc.winRate * 100).toFixed(1)}%\n` +
        `Avg rounds: ${mc.avgRounds.toFixed(2)}\n` +
        `Dmg mean: ${mc.dmgMean.toFixed(1)}\n` +
        `Dmg stddev: ${Math.sqrt(mc.dmgVariance).toFixed(1)}\n`;
      this._drawDmgHistogram(mc.dmgSamples);
      const summary = {
        label: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        winRate: mc.winRate,
        avgRounds: mc.avgRounds,
        dmgMean: mc.dmgMean,
      };
      this._mcHistory.push(summary);
      if (this._mcHistory.length > 2) this._mcHistory.shift();
      this._renderDiffPanel();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prevLabel || 'Run Sim'; }
      this._mcRunning = false;
    }
  }

  _renderResult(result) {
    const logEl = this._el.querySelector('#csim-log');
    const lines = [];
    lines.push(`Winner: ${result.winner}   Rounds: ${result.rounds}`);
    for (const ev of result.log) {
      if (ev.type === 'miss') {
        lines.push(`R${ev.round} ${ev.actor} → ${ev.target}: MISS`);
      } else if (ev.type === 'heal') {
        lines.push(`R${ev.round} ${ev.actor} [${ev.skill}] heals ${ev.target} for ${ev.heal}`);
      } else if (ev.type === 'revive') {
        lines.push(`R${ev.round} ${ev.actor} [${ev.skill}] revives ${ev.target}`);
      } else if (ev.type === 'buff') {
        lines.push(`R${ev.round} ${ev.actor} [${ev.skill}] buffs ${ev.targets} target(s)`);
      } else if (ev.type === 'skill_other') {
        lines.push(`R${ev.round} ${ev.actor} uses ${ev.skill} (${ev.skillType})`);
      } else if (ev.skill) {
        lines.push(`R${ev.round} ${ev.actor} [${ev.skill}] → ${ev.target}: ${ev.raw} raw → ${ev.dmg} dmg (hp:${ev.targetHpAfter})`);
      } else {
        lines.push(`R${ev.round} ${ev.actor} → ${ev.target}: ${ev.raw} raw → ${ev.dmg} dmg (hp:${ev.targetHpAfter})`);
      }
    }
    logEl.textContent = lines.join('\n');

    const rpm = rewardsPerMinute(result, 2);
    const stats = this._el.querySelector('#csim-stats');
    const dps = result.stats.dpsPerHero;
    const ehp = result.stats.ehpPerHero;
    const statBits = [];
    statBits.push(`<span class="k">Total Party DPS</span><span class="v">${result.stats.totalPartyDps.toFixed(1)}</span>`);
    statBits.push(`<span class="k">TTK (enemies)</span><span class="v">${result.stats.ttk.partyKillsEnemies ?? '—'}</span>`);
    statBits.push(`<span class="k">XP/min</span><span class="v">${rpm.xpPerMin}</span>`);
    statBits.push(`<span class="k">Gold/min</span><span class="v">${rpm.goldPerMin}</span>`);
    for (const id of Object.keys(dps)) {
      statBits.push(`<span class="k">DPS ${id}</span><span class="v">${dps[id].toFixed(1)}</span>`);
      statBits.push(`<span class="k">EHP ${id}</span><span class="v">${ehp[id]}</span>`);
    }

    // M150: diff vs. vanilla — when any hero in this run uses a mod skill,
    // re-run the sim with mod skills filtered out and show delta DPS.
    const diff = this._computeVanillaDiff(result);
    if (diff) {
      statBits.push(`<span class="k">Mod vs Vanilla ΔDPS</span><span class="v" style="color:${diff.deltaDps >= 0 ? '#7ec67e' : '#e85c5c'}">${diff.deltaDps >= 0 ? '+' : ''}${diff.deltaDps.toFixed(1)}</span>`);
      statBits.push(`<span class="k">Vanilla Party DPS</span><span class="v">${diff.vanillaDps.toFixed(1)}</span>`);
      statBits.push(`<span class="k">Mod skills used</span><span class="v">${diff.modSkillIds.join(', ') || '—'}</span>`);
    }

    stats.innerHTML = statBits.join('');
  }

  /**
   * M150: diff view vs. nearest vanilla.
   * Detects mod skills (any skill with a `_pack` tag other than vanilla bootstrap)
   * on any hero, then runs a parallel sim with those skills filtered out.
   * Returns { deltaDps, vanillaDps, modSkillIds } or null when no mod skills present.
   */
  _computeVanillaDiff(modResult) {
    try {
      // Detect mod skills by probing the live getUnlockedSkills list for each hero's class+level.
      let hasMods = false;
      const modSkillIds = new Set();
      // Lazy-import via the registry: mod skills have _pack !== 'vanilla_skills_bootstrap'.
      const store = typeof window !== 'undefined' && window.__emberveilMods?.getAll;
      if (store) {
        const all = store('skills') || [];
        for (const h of this._heroes) {
          const classId = h.cls || h.className || h.class;
          for (const s of all) {
            if (!s || !s._pack || s._pack === 'vanilla_skills_bootstrap') continue;
            if ((s.classOrigin || s.class) === classId && (s.unlockLevel || 1) <= (h.level || 1)) {
              hasMods = true;
              modSkillIds.add(s.id);
            }
          }
        }
      }
      if (!hasMods) return null;
      const vanResult = runSimulation({
        heroes: this._heroes,
        encounter: this._buildEncounterForSim(),
        act: this._act,
        seed: (Math.random() * 2 ** 31) | 0,
        vanillaOnly: true,
      });
      const modDps = modResult.stats.totalPartyDps || 0;
      const vanDps = vanResult.stats.totalPartyDps || 0;
      return {
        deltaDps: modDps - vanDps,
        vanillaDps: vanDps,
        modSkillIds: [...modSkillIds],
      };
    } catch (err) {
      console.warn('[csim] vanilla diff failed:', err);
      return null;
    }
  }

  _destroyCharts() {
    for (const c of this._charts) { try { c.destroy(); } catch (_) {} }
    this._charts = [];
  }

  _drawHpChart(result) {
    if (!window.Chart) return;
    this._destroyCharts();
    const canvas = this._el.querySelector('#csim-chart-hp');
    const labels = [];
    const firstHero = Object.values(result.stats.hpHistoryByHero)[0] || [];
    for (let i = 0; i < firstHero.length; i++) labels.push('R' + i);
    const datasets = Object.entries(result.stats.hpHistoryByHero).map(([id, arr], i) => ({
      label: id,
      data: arr,
      borderColor: ['#e8a020','#40a0e8','#40e080','#e04080'][i % 4],
      backgroundColor: 'transparent',
      tension: 0.2,
    }));
    const chart = new window.Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: { responsive: true, plugins: { legend: { labels: { color: '#e8d8b8' } } }, scales: { x: { ticks: { color: '#8a7a6a' } }, y: { ticks: { color: '#8a7a6a' } } } },
    });
    this._charts.push(chart);
  }

  _drawDmgHistogram(samples) {
    if (!window.Chart || !samples || !samples.length) return;
    this._destroyCharts();
    const canvas = this._el.querySelector('#csim-chart-dmg');
    const bins = 20;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const width = Math.max(1, (max - min) / bins);
    const buckets = new Array(bins).fill(0);
    for (const s of samples) {
      const b = Math.min(bins - 1, Math.floor((s - min) / width));
      buckets[b]++;
    }
    const labels = buckets.map((_, i) => Math.round(min + i * width).toString());
    const chart = new window.Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Dmg distribution', data: buckets, backgroundColor: '#e8a020' }] },
      options: { responsive: true, plugins: { legend: { labels: { color: '#e8d8b8' } } }, scales: { x: { ticks: { color: '#8a7a6a' } }, y: { ticks: { color: '#8a7a6a' } } } },
    });
    this._charts.push(chart);
  }

  _savePreset() {
    const name = prompt('Preset name?');
    if (!name) return;
    const presets = this._readPresets();
    presets[name] = {
      heroes: this._heroes,
      enemies: this._enemies,
      act: this._act,
      encounterKey: this._selectedEncounterKey,
      ts: Date.now(),
    };
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch (_) {}
    // Also download as JSON
    const blob = new Blob([JSON.stringify(presets[name], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sim-preset-${name}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  _openLoadPresetModal() {
    const presets = this._readPresets();
    const names = Object.keys(presets);
    if (!names.length) { alert('No presets saved yet.'); return; }
    const items = names.map(name => {
      const p = presets[name];
      const heroCount = Array.isArray(p.heroes) ? p.heroes.length : 0;
      const enemyCount = Array.isArray(p.enemies) ? p.enemies.length : 0;
      const ts = p.ts ? new Date(p.ts).toLocaleString() : '';
      return `
        <div class="csim-save-option" data-preset-name="${name.replace(/"/g, '&quot;')}">
          <div class="save-title">${name}</div>
          <div class="save-details">${heroCount} heroes · ${enemyCount} enemies · Act ${p.act || 1}</div>
          ${ts ? `<div class="save-timestamp">${ts}</div>` : ''}
        </div>
      `;
    }).join('');
    const modal = this._createModal(`
      <h3 style="margin-top:0;color:#e8a020;">Load Preset</h3>
      <div>${items}</div>
    `);
    modal.querySelectorAll('[data-preset-name]').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.presetName;
        this._applyPreset(name, presets[name]);
        this._closeOpenModal();
      });
    });
  }

  _applyPreset(name, p) {
    if (!p) return;
    this._heroes = p.heroes || this._heroes;
    this._enemies = p.enemies || this._enemies;
    this._act = p.act || 1;
    this._selectedEncounterKey = p.encounterKey || this._selectedEncounterKey;
    this._el.querySelector('#csim-act-sel').value = this._act;
    this._renderHeroes();
    this._renderEnemies();
  }

  _readPresets() {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}'); } catch (_) { return {}; }
  }

  /**
   * Export full encounter bundle — party, gear, enemy config, seed, act, and
   * (if available) last sim result. Reimporting reproduces the setup exactly.
   */
  _exportEncounter() {
    const seed = (this._lastResult && this._lastResult.seed) ?? null;
    const bundle = {
      kind: 'emberveil-encounter',
      version: 1,
      exportedAt: new Date().toISOString(),
      act: this._act,
      encounterKey: this._selectedEncounterKey,
      heroes: this._heroes,
      enemies: this._enemies,
      seed,
      lastResult: this._lastResult
        ? {
            winner: this._lastResult.winner,
            rounds: this._lastResult.rounds,
            stats: this._lastResult.stats,
          }
        : null,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `encounter-${ts}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async _importEncounter(ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const bundle = JSON.parse(text);
      if (!bundle || bundle.kind !== 'emberveil-encounter') {
        alert('Not a valid encounter export file.');
        return;
      }
      this._heroes = bundle.heroes || this._heroes;
      this._enemies = bundle.enemies || this._enemies;
      this._act = bundle.act || this._act;
      this._selectedEncounterKey = bundle.encounterKey || this._selectedEncounterKey;
      const actSel = this._el.querySelector('#csim-act-sel');
      if (actSel) actSel.value = String(this._act);
      this._renderHeroes();
      this._renderEnemies();
      // Re-run with the stored seed when present so the import is
      // deterministically reproducible.
      const seed = (bundle.seed != null) ? bundle.seed : (Math.random() * 2 ** 31) | 0;
      const result = runSimulation({
        heroes: this._heroes,
        encounter: this._buildEncounterForSim(),
        act: this._act,
        seed,
      });
      result.seed = seed;
      this._lastResult = result;
      this._renderResult(result);
      this._drawHpChart(result);
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      ev.target.value = '';
    }
  }

  _addCharacterDialog() {
    const modal = this._createModal(`
      <h3 style="margin-top: 0; color: #e8a020;">Add Character</h3>
      <h4 class="csim-modal-group-title">Custom Characters</h4>
      <div class="csim-class-grid">
        ${CLASSES.map(cls => `
          <div class="csim-char-option csim-class-option" data-class="${cls.id}">
            <div class="option-icon">${cls.svgIcon || ''}</div>
            <div class="option-content">
              <div class="option-title">${cls.name}</div>
              <div class="option-desc">${cls.role || ''}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <h4 class="csim-modal-group-title">Hireable NPCs</h4>
      <div class="csim-class-grid">
        ${HIREABLES_ACT1.map(npc => {
          const cls = CLASSES.find(c => c.id === npc.class) || {};
          return `
          <div class="csim-char-option csim-hire-option" data-hire="${npc.id}">
            <div class="option-icon">${cls.svgIcon || ''}</div>
            <div class="option-content">
              <div class="option-title">${npc.name}</div>
              <div class="option-desc">${npc.className} · Lv.${npc.level}</div>
            </div>
          </div>
        `;}).join('')}
      </div>
    `);

    modal.querySelectorAll('[data-class]').forEach(option => {
      option.addEventListener('click', () => {
        const classId = option.dataset.class;
        const selectedClass = CLASSES.find(cls => cls.id === classId);
        this._closeOpenModal();
        if (selectedClass) this._addPremadeCharacter(selectedClass);
      });
    });

    modal.querySelectorAll('[data-hire]').forEach(option => {
      option.addEventListener('click', () => {
        const hireId = option.dataset.hire;
        const npc = HIREABLES_ACT1.find(h => h.id === hireId);
        this._closeOpenModal();
        if (npc) {
          this._heroes.push({
            id: `${npc.id}_${Date.now()}`,
            name: npc.name,
            cls: npc.className,
            level: npc.level || 1,
            attrs: { ...npc.attrs },
            equipment: {},
            skills: [],
            passives: {},
            isHireable: true,
          });
          this._renderHeroes();
        }
      });
    });
  }

  _getCommonEnemyTypes() {
    // Real enemy catalog pulled from src/maps/mapData.js so the dropdown
    // always matches what the game actually spawns.
    const pools = [
      { src: ENEMIES, suffix: '' },
      { src: ENEMIES_ACT4 || {}, suffix: ' (A4)' },
      { src: ENEMIES_ACT5 || {}, suffix: ' (A5)' },
      { src: ENEMIES_ACT6 || {}, suffix: ' (A6)' },
    ];
    const out = [];
    for (const { src, suffix } of pools) {
      for (const [key, e] of Object.entries(src)) {
        if (!e || typeof e !== 'object') continue;
        out.push({
          id: key,
          name: (e.name || key) + suffix,
          level: e.level || 1,
          hp: e.hp || e.maxHp || 20,
          dmg: Array.isArray(e.dmg) ? [...e.dmg] : [1, 2],
          armor: e.armor || 0,
          hit: e.hit || 60,
          dodge: e.dodge || 5,
        });
      }
    }
    out.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
    return out;
  }

  _addPredefinedEnemy(template) {
    const newEnemy = {
      uid: `${template.id}_${Date.now()}`,
      id: template.id,
      name: template.name,
      level: template.level,
      hp: template.hp,
      maxHp: template.hp,
      dmg: [...template.dmg],
      armor: template.armor,
      hit: template.hit,
      dodge: template.dodge,
      xpValue: template.level * 10,
      gold: [template.level * 2, template.level * 5]
    };

    this._enemies.push(newEnemy);
    this._renderEnemies();
  }

  _addPremadeCharacter(classData) {
    // M116 parity: auto-scaled attrs + rarity-scaled equipment via simulator helpers.
    const name = classData.name;
    const level = 5;
    const clamped = Math.max(1, Math.min(30, level));

    const newHero = {
      id: `${classData.id}_${Date.now()}`,
      name: name,
      cls: classData.id,
      level: clamped,
      attrs: autoAssignAttrs(classData.id, clamped),
      equipment: autoGenerateEquipment(classData.id, clamped),
      skills: classData.skills || [],
      passives: {},
      passiveRanks: {},
      talentsPurchased: {},
      isPremade: true,
    };

    this._heroes.push(newHero);
    this._renderHeroes();
  }

  _getClassStartingAttrs(classData) {
    // Kept for backward-compat; routes to the simulator helper.
    return autoAssignAttrs(classData.id, 5);
  }

  _generateStartingEquipment(classData) {
    // Kept for backward-compat; routes to the simulator helper.
    return autoGenerateEquipment(classData.id, 5);
  }

  _loadSaveDialog() {
    const saves = this._getAvailableSaves();

    if (saves.length === 0) {
      alert('No save games found. Create a save game in the main game first.');
      return;
    }

    const modal = this._createModal(`
      <h3 style="margin-top: 0; color: #e8a020;">Load Party from Save</h3>
      <div>
        ${saves.map(save => `
          <div class="csim-save-option" data-save-key="${save.key}">
            <div class="save-title">${save.name}</div>
            <div class="save-details">
              Act ${save.act} • ${save.party?.length || 0} party members • ${save.companions?.length || 0} companions
            </div>
            <div class="save-timestamp">${save.timestamp}</div>
          </div>
        `).join('')}
      </div>
    `);

    modal.querySelectorAll('.csim-save-option').forEach(option => {
      option.addEventListener('click', () => {
        const saveKey = option.dataset.saveKey;
        const save = saves.find(s => s.key === saveKey);
        this._closeOpenModal();
        if (save) this._loadPartyFromSave(save);
      });
    });
  }

  _getAvailableSaves() {
    // Use the same code path as LoadGameScreen so saves always match.
    const raw = SaveManager.listSaves() || [];
    return raw
      .filter(s => s && Array.isArray(s.party) && s.party.length > 0)
      .map(s => ({
        key: s.key,
        name: s.heroName || s.class || 'Hero',
        timestamp: s.timestamp || '',
        act: s.act || 1,
        party: s.party,
        companions: s.companions || [],
      }));
  }

  _loadPartyFromSave(saveData) {
    if (!saveData.party) {
      alert('Invalid save data - no party found.');
      return;
    }

    // Clear current heroes and load from save
    this._heroes = [];

    // Add party members with full data
    saveData.party.forEach(member => {
      if (member) {
        const hero = {
          id: member.id || member.name,
          name: member.name || 'Hero',
          cls: member.cls || member.class || (member.className || '').toLowerCase(),
          level: member.level || 1,
          attrs: member.attrs || { STR: 10, DEX: 10, INT: 10, CON: 10 },
          equipment: member.equipment || {},
          skills: member.skills || [],
          passives: member.passives || {},
          // M116: simulator AI needs passiveRanks + talentsPurchased to mergeSkillForCast.
          passiveRanks: member.passiveRanks || {},
          talentsPurchased: member.talentsPurchased || {},
          talents: member.talents || [],
          baseAttributes: member.baseAttributes || member.attrs || { STR: 10, DEX: 10, INT: 10, CON: 10 },
          isFromSave: true,
          saveData: member // Keep original for reference
        };
        this._heroes.push(hero);
      }
    });

    // Add companions if any (limit to 4 as per game rules)
    if (saveData.companions && saveData.companions.length > 0) {
      const companionsToAdd = saveData.companions.slice(0, 4); // Limit to 4 companions
      companionsToAdd.forEach(companion => {
        if (companion) {
          const comp = {
            id: companion.id || companion.name,
            name: companion.name || 'Companion',
            cls: companion.cls || companion.class || companion.type || companion.species || (companion.className || '').toLowerCase(),
            level: companion.level || 1,
            attrs: companion.attrs || { STR: 8, DEX: 8, INT: 8, CON: 8 },
            equipment: companion.equipment || {},
            skills: companion.skills || [],
            passives: companion.passives || {},
            passiveRanks: companion.passiveRanks || {},
            talentsPurchased: companion.talentsPurchased || {},
            isCompanion: true,
            isFromSave: true,
            saveData: companion
          };
          this._heroes.push(comp);
        }
      });
    }

    this._renderHeroes();

    const partyCount = saveData.party.length;
    const companionCount = Math.min(saveData.companions?.length || 0, 4);
    alert(`Loaded ${partyCount} party member${partyCount !== 1 ? 's' : ''} and ${companionCount} companion${companionCount !== 1 ? 's' : ''} from ${saveData.name}`);
  }

  // ---------------------------------------------------------------------------
  // Diff vs previous run
  // ---------------------------------------------------------------------------

  _renderDiffPanel() {
    const panel = this._el.querySelector('#csim-diff-panel');
    const grid = this._el.querySelector('#csim-diff-grid');
    if (!panel || !grid) return;
    if (this._mcHistory.length < 2) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    const [prev, curr] = this._mcHistory;

    const delta = (cur, pre, fmt, isLowerBetter) => {
      const d = cur - pre;
      const cls = d === 0 ? 'csim-diff-neu' : (d > 0) === !isLowerBetter ? 'csim-diff-pos' : 'csim-diff-neg';
      const sign = d >= 0 ? '+' : '';
      return `<span class="dd ${cls}">${sign}${fmt(d)}</span>`;
    };

    grid.innerHTML = `
      <div class="csim-diff-cell">
        <span class="dk">Win Rate</span>
        <span class="dv">${(curr.winRate * 100).toFixed(1)}%</span>
        ${delta(curr.winRate, prev.winRate, v => (v * 100).toFixed(1) + '%', false)}
      </div>
      <div class="csim-diff-cell">
        <span class="dk">Avg Rounds</span>
        <span class="dv">${curr.avgRounds.toFixed(1)}</span>
        ${delta(curr.avgRounds, prev.avgRounds, v => v.toFixed(1), true)}
      </div>
      <div class="csim-diff-cell">
        <span class="dk">Dmg Mean</span>
        <span class="dv">${curr.dmgMean.toFixed(0)}</span>
        ${delta(curr.dmgMean, prev.dmgMean, v => v.toFixed(0), true)}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Benchmark mode: sweep party levels, show inline SVG bars
  // ---------------------------------------------------------------------------

  _toggleBenchmark() {
    this._benchmarkMode = !this._benchmarkMode;
    const btn = this._el.querySelector('#csim-benchmark');
    if (btn) btn.classList.toggle('csim-btn-active', this._benchmarkMode);
    const panel = this._el.querySelector('#csim-bench-panel');
    if (!panel) return;
    if (this._benchmarkMode) {
      this._runBenchmark();
    } else {
      panel.style.display = 'none';
    }
  }

  _runBenchmark() {
    const LEVELS = [1, 3, 5, 7, 10];
    const RUNS = 100;
    const BASE_SEED = 7;
    const encounter = this._buildEncounterForSim();
    const results = LEVELS.map(level => {
      const scaledHeroes = this._heroes.map(h => ({ ...h, level }));
      const mc = runMonteCarlo({
        heroes: scaledHeroes,
        encounter,
        act: this._act,
        runs: RUNS,
        baseSeed: BASE_SEED,
      });
      return { level, winRate: mc.winRate };
    });

    const panel = this._el.querySelector('#csim-bench-panel');
    const bars = this._el.querySelector('#csim-bench-bars');
    if (!panel || !bars) return;
    panel.style.display = '';
    bars.innerHTML = results.map(({ level, winRate }) => {
      const pct = (winRate * 100).toFixed(1);
      const fillW = Math.round(winRate * 100);
      const barColor = winRate >= 0.8 ? '#7ec67e' : winRate >= 0.5 ? '#e8a020' : '#e85c5c';
      return `
        <div class="csim-bench-row">
          <span class="csim-bench-lbl">Lv ${level}</span>
          <div class="csim-bench-track">
            <div class="csim-bench-fill" style="width:${fillW}%;background:${barColor}"></div>
          </div>
          <span class="csim-bench-pct">${pct}%</span>
        </div>
      `;
    }).join('');
  }

  onExit() { this._closeOpenModal(); this._destroyCharts(); removeEl(this._el); this._el = null; }
  destroy() { this._closeOpenModal(); this._destroyCharts(); removeEl(this._el); this._el = null; }
  update() {}
  draw() {}
}
