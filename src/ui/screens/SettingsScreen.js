/**
 * SettingsScreen — master/music/sfx volume + reduce-motion toggle + M296 accessibility
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { debug } from '../../utils/debug.js';
import { combatDebug, isCombatDebugLogging, setCombatDebugLogging } from '../../utils/combatDebug.js';
import { authManager, LOGIN_UI_DISABLED } from '../../auth/authManager.js';
import { cloudSaves } from '../../auth/cloudSaves.js';
import { CLASSES } from '../../game/classes.js';
import { COLOR_PALETTES, PALETTE_LABELS, PALETTE_KEYS, getActivePaletteKey, setActivePalette } from '../../game/colorPalettes.js';
import { FONT_SCALE_OPTIONS, getFontScale, setFontScale } from '../../utils/fontScale.js';
import { getReduceMotionMode, setReduceMotionMode, isReducedMotion } from '../../utils/motion.js';
import { getMapDebugSettings, setMapDebugSettings } from '../../game/mapDebugSettings.js';

// M296: apply/remove .reduce-motion class on <html> based on current effective setting.
// Internal helper — called on settings change.
function _applyReduceMotionClass() {
  document.documentElement.classList.toggle('reduce-motion', isReducedMotion());
}

// ── Debug/Cheat runtime state (not saved on GameState to avoid polluting saves) ──
// Persisted via localStorage; loaded once at module init.
const _CHEAT_KEY = 'emberveil_debug_cheats';
function _readCheats() {
  try {
    const raw = localStorage.getItem(_CHEAT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
function _writeCheats(data) {
  try { localStorage.setItem(_CHEAT_KEY, JSON.stringify(data)); } catch {}
}

/** Live cheat flags shared across the runtime. Consumers OR against these. */
export const cheats = _readCheats();

/** Returns true if the cheat "unlock all classes" is active. */
export function isUnlockAllClassesActive() {
  return !!cheats.unlockAllClasses;
}

/** XP multiplier (default 1.0). Applied at XP award sites. */
export function getXpMultiplier() {
  return typeof cheats.xpMultiplier === 'number' ? cheats.xpMultiplier : 1.0;
}

// Register XP multiplier getter on window so xp.js can call it without circular imports.
window.__settingsCheatGetXpMultiplier = getXpMultiplier;

/**
 * M377: re-export so other modules can `import { isCombatDebugLogging }
 * from './SettingsScreen.js'` without needing to know about the utils
 * path. Keeps the public API for combat debugging in one place.
 */
export { isCombatDebugLogging };

/** M302: returns true when companion level sync is enabled in settings. */
export function isCompanionLevelSyncEnabled() {
  // M357: Companion Level Sync is always on. Setting removed from UI.
  return true;
}

/**
 * M436: kept for backward-compatibility import in CombatScreen.js but the
 * underlying gate is gone — combat is canvas-only and EvCardRail/EvTurnStrip
 * mount unconditionally. Always returns true so any remaining call sites
 * fall through to the modern path. Will be deleted entirely once external
 * callers are pruned.
 */
export function isUiOverhaulEnabled() { return true; }

/**
 * M393 — show companion frames row in the new combat HUD.
 * M488 — default flipped to OFF (was ON). Companion HP is still visible
 * on their canvas sprites; the row mostly took screen real estate.
 * Users who explicitly toggled it ON before are preserved.
 */
export function isShowCompanionFramesEnabled() {
  try {
    const v = localStorage.getItem('emberveil_show_companion_frames');
    return v === '1';
  } catch { return false; }
}

/**
 * M488 — combat captions default ON. Subtitles narrate the last few
 * combat-log lines under the battlefield; great for first-time players.
 */
export function isCombatCaptionsEnabled() {
  try {
    const v = localStorage.getItem('emberveil_combat_captions');
    return v === null ? true : v === '1';
  } catch { return true; }
}

// M436: UI_OVERHAUL_LABEL deleted (toggle removed).

// Restore cheat globals on load so class unlock checks work immediately.
window.__cheatUnlockAllClasses = !!cheats.unlockAllClasses;

export class SettingsScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this._el = null;
  }

  onEnter() {
    // Restore persisted graphics flags
    window.__gfxDisableBg = localStorage.getItem('emberveil_gfx_disable_bg') === '1';
    window.__gfxDisableSprites = localStorage.getItem('emberveil_gfx_disable_sprites') === '1';
    window.__telemetryOptIn = localStorage.getItem('rsg_telemetryOptIn') === 'true';
    // M406 — sync window.__mapDebug from the persistent mapDebugSettings on load.
    window.__mapDebug = !!getMapDebugSettings().debugNodes;
    this._build();
  }

  _build() {
    injectStyles('settings-styles', `
      .settings-screen {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start;
        background: rgba(5,2,8,0.92); padding: 2rem 2rem 3rem;
        overflow-y: auto; -webkit-overflow-scrolling: touch;
      }
      .settings-title { margin-top: 1rem; }
      .settings-title {
        font-family: 'Cinzel', Georgia, serif;
        font-size: 1.4rem; font-weight: 700;
        color: #e8a020; letter-spacing: 0.1em; margin-bottom: 2.5rem;
      }
      .settings-group { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 1.5rem; }
      .setting-row { display: flex; flex-direction: column; gap: 0.5rem; }
      .setting-label { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a7a6a; }
      .setting-slider { width: 100%; accent-color: #e8a020; height: 4px; cursor: pointer; }
      /* M242: grid so the text column always occupies the remaining width
         without wrapping under the toggle switch. min-content on the track
         keeps the switch exactly switch-width without hard-coding 44px. */
      .setting-toggle { display: grid; grid-template-columns: min-content 1fr; gap: 0.9rem; align-items: center; }
      .setting-toggle-text { display: flex; flex-direction: column; gap: 0.12rem; min-width: 0; }
      .setting-toggle-text .setting-label { margin: 0; }
      .setting-hint { font-size: 0.65rem; color: #6a5a52; line-height: 1.4; }
      .toggle-switch {
        width: 44px; height: 24px; background: rgba(255,255,255,0.1);
        border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);
        cursor: pointer; position: relative; transition: background 0.2s;
      }
      .toggle-switch.on { background: rgba(232,160,32,0.4); border-color: rgba(232,160,32,0.6); }
      .toggle-switch:focus-visible { outline: 2px solid #e8a020; outline-offset: 3px; }
      .settings-screen button:focus-visible, .settings-screen input:focus-visible, .settings-screen a:focus-visible { outline: 2px solid #e8a020; outline-offset: 2px; }
      .toggle-switch::after {
        content: ''; position: absolute;
        top: 2px; left: 2px; width: 18px; height: 18px;
        background: #8a7a6a; border-radius: 50%; transition: transform 0.2s, background 0.2s;
      }
      .toggle-switch.on::after { transform: translateX(20px); background: #e8a020; }
      .settings-back {
        margin-top: 2.5rem; background: none; border: none; color: #8a7a6a;
        font-size: 0.85rem; cursor: pointer; text-decoration: underline;
      }
      .settings-back:hover { color: #f0e8d8; }
      .debug-sub { margin-left: 2.5rem; flex-direction: column; gap: 0.5rem; display: none; }
      .debug-sub.enabled { display: flex; }
      .debug-sub .setting-toggle .toggle-switch { width: 36px; height: 20px; }
      .debug-sub .setting-toggle .toggle-switch::after { width: 14px; height: 14px; }
      .debug-sub .setting-toggle .toggle-switch.on::after { transform: translateX(16px); }
      .vol-row-inner { display: flex; align-items: center; gap: 0.6rem; }
      .vol-mute { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; user-select: none; font-size: 0.7rem; color: #8a7a6a; }
      .vol-mute input { accent-color: #e8a020; }
      .setting-slider.muted { opacity: 0.4; }
      .sim-data-block { display: none; }
      .sim-data-block.enabled { display: flex; flex-direction: column; gap: 0.5rem; }
      /* Debug/Cheat submodal overlay */
      .dbg-modal-wrap {
        position: fixed; inset: 0; background: rgba(0,0,0,0.82);
        display: flex; align-items: center; justify-content: center;
        z-index: 1200; padding: 16px;
      }
      .dbg-modal-box {
        background: #130f1a; border: 1px solid rgba(160,80,255,0.45);
        border-radius: 12px; padding: 1.25rem 1.25rem 1.5rem;
        max-width: 400px; width: 100%; max-height: 82vh; overflow-y: auto;
        -webkit-overflow-scrolling: touch; color: #f0e8d8;
        font-family: Inter, 'Segoe UI', sans-serif;
        display: flex; flex-direction: column; gap: 1rem;
      }
      .dbg-modal-title {
        font-family: 'Cinzel', Georgia, serif;
        font-size: 1.05rem; font-weight: 700; color: #b87fff;
        letter-spacing: 0.1em; text-align: center; margin-bottom: 0.25rem;
      }
      .dbg-modal-back {
        background: none; border: none; color: #8a7a6a;
        font-size: 0.85rem; cursor: pointer; text-decoration: underline;
        padding: 0.5rem 0; align-self: flex-start; min-height: 44px;
        display: flex; align-items: center;
      }
      .dbg-modal-back:hover { color: #f0e8d8; }
      .dbg-modal-btn {
        display: block; width: 100%;
        background: rgba(160,80,255,0.12); border: 1px solid rgba(160,80,255,0.45);
        color: #b87fff; padding: 0.65rem 0.8rem; border-radius: 6px;
        font-family: inherit; font-size: 0.8rem; letter-spacing: 0.08em;
        text-transform: uppercase; cursor: pointer; min-height: 44px;
      }
      .dbg-modal-btn:hover { background: rgba(160,80,255,0.22); }
      .dbg-modal-btn.cheat { border-color: rgba(255,160,32,0.5); color: #ffb030; background: rgba(255,160,32,0.1); }
      .dbg-modal-btn.cheat:hover { background: rgba(255,160,32,0.18); }
      .dbg-modal-btn.placeholder { border-color: rgba(120,120,120,0.4); color: #8a8a8a; background: rgba(120,120,120,0.07); cursor: default; }
      .dbg-settings-open {
        display: none; margin-left: 2.5rem; margin-top: 0.5rem;
        background: rgba(160,80,255,0.12); border: 1px solid rgba(160,80,255,0.45);
        color: #b87fff; padding: 0.6rem 0.8rem; border-radius: 6px;
        font-family: inherit; font-size: 0.78rem; letter-spacing: 0.08em;
        text-transform: uppercase; cursor: pointer; min-height: 44px; width: calc(100% - 2.5rem);
      }
      .dbg-settings-open.visible { display: block; }
      .dbg-settings-open:hover { background: rgba(160,80,255,0.22); }
      /* cheat-specific row styles */
      .cheat-row { display: flex; flex-direction: column; gap: 0.4rem; }
      .cheat-slider-row { display: flex; align-items: center; gap: 0.7rem; }
      .cheat-slider { flex: 1; accent-color: #ffb030; height: 4px; cursor: pointer; }
      .cheat-slider-val { min-width: 2.8rem; text-align: right; font-size: 0.8rem; color: #e8a020; font-variant-numeric: tabular-nums; }
    `);

    // M390 — _build() can be called more than once per mount (the New UI
    // toggle re-renders so the "New UI Active" indicator reflects new state).
    // Without tearing the prior DOM down first we leak settings panels into
    // the overlay; on pop, only the latest is removed and the older one shows
    // through under the next screen.
    if (this._el) {
      try { kbUnmount(this._el); } catch (_) {}
      removeEl(this._el);
      this._el = null;
    }

    this._el = createEl('div', 'settings-screen');
    this._el.innerHTML = `
      <div class="settings-title">Settings</div>
      <div class="settings-group">
        <div class="setting-row">
          <label class="setting-label">Master Volume</label>
          <input type="range" class="setting-slider" id="master-vol" min="0" max="1" step="0.05" value="${this.audio.masterVolume}">
        </div>
        <div class="setting-row">
          <label class="setting-label">Music Volume</label>
          <div class="vol-row-inner">
            <input type="range" class="setting-slider${this.audio.isMusicMuted()?' muted':''}" id="music-vol" min="0" max="1" step="0.05" value="${this.audio.musicVolume}" ${this.audio.isMusicMuted()?'disabled':''}>
            <label class="vol-mute"><input type="checkbox" id="music-enabled" ${!this.audio.isMusicMuted()?'checked':''}>On</label>
          </div>
          <span style="font-size:0.65rem;color:#6a5a52">Uncheck to mute music entirely (lets you play your own music).</span>
        </div>
        <div class="setting-row">
          <label class="setting-label">SFX Volume</label>
          <div class="vol-row-inner">
            <input type="range" class="setting-slider${this.audio.isSfxMuted()?' muted':''}" id="sfx-vol" min="0" max="1" step="0.05" value="${this.audio.sfxVolume}" ${this.audio.isSfxMuted()?'disabled':''}>
            <label class="vol-mute"><input type="checkbox" id="sfx-enabled" ${!this.audio.isSfxMuted()?'checked':''}>On</label>
          </div>
          <span style="font-size:0.65rem;color:#6a5a52">Uncheck to mute all sound effects.</span>
        </div>
        <div class="setting-row">
          <label class="setting-label" for="reduce-motion-select">Reduce Motion</label>
          <select id="reduce-motion-select" style="padding:0.4rem 0.6rem;background:#1a0e14;border:1px solid rgba(232,160,32,0.3);border-radius:4px;color:#f0e8d8;font-family:inherit;font-size:0.85rem;min-height:44px;">
            <option value="auto"${getReduceMotionMode()==='auto'?' selected':''}>Auto (follow OS)</option>
            <option value="on"${getReduceMotionMode()==='on'?' selected':''}>On (always reduce)</option>
            <option value="off"${getReduceMotionMode()==='off'?' selected':''}>Off (always animate)</option>
          </select>
          <span style="font-size:0.65rem;color:#6a5a52">Override the OS reduce-motion setting. "Auto" respects your device preference.</span>
        </div>
        <div class="setting-row">
          <label class="setting-label" for="color-palette-select">Color Palette</label>
          <select id="color-palette-select" style="padding:0.4rem 0.6rem;background:#1a0e14;border:1px solid rgba(232,160,32,0.3);border-radius:4px;color:#f0e8d8;font-family:inherit;font-size:0.85rem;min-height:44px;">
            ${PALETTE_KEYS.map(k => `<option value="${k}"${getActivePaletteKey()===k?' selected':''}>${PALETTE_LABELS[k]}</option>`).join('')}
          </select>
          <span style="font-size:0.65rem;color:#6a5a52">Colorblind-friendly palettes change rarity and status indicator colors.</span>
        </div>
        <div class="setting-row">
          <label class="setting-label" for="font-scale-select">Text Size</label>
          <select id="font-scale-select" style="padding:0.4rem 0.6rem;background:#1a0e14;border:1px solid rgba(232,160,32,0.3);border-radius:4px;color:#f0e8d8;font-family:inherit;font-size:0.85rem;min-height:44px;">
            ${FONT_SCALE_OPTIONS.map(o => `<option value="${o.value}"${getFontScale()===o.value?' selected':''}>${o.label}</option>`).join('')}
          </select>
          <span style="font-size:0.65rem;color:#6a5a52">Scales body text only — large headers stay large.</span>
        </div>
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${isCombatCaptionsEnabled()?' on':''}" id="combat-captions-toggle" aria-checked="${isCombatCaptionsEnabled()?'true':'false'}" aria-label="Combat Captions"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Combat Captions</span>
              <span class="setting-hint">Shows a large subtitle bar during combat with the latest log entry for easier reading. Also available in-combat via Pause &rarr; Combat Settings.</span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${localStorage.getItem('emberveil_slow_combat_enabled')==='1'?' on':''}" id="slow-combat-toggle" aria-checked="${localStorage.getItem('emberveil_slow_combat_enabled')==='1'?'true':'false'}" aria-label="Enable Slow Combat Options"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Enable Slow Combat Options</span>
              <span class="setting-hint">Adds 0.5× and 0.25× speeds plus a manual pause + Next-Turn step button to the combat speed cycle. Default cycle is 1×/2×/4× only.</span>
            </div>
          </div>
        </div>
        <!-- M335: in-combat HUD visibility toggles -->
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${localStorage.getItem('emberveil_show_combat_log')!=='0'?' on':''}" id="show-combat-log-toggle" aria-checked="${localStorage.getItem('emberveil_show_combat_log')!=='0'?'true':'false'}" aria-label="Show Combat Log"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Show Combat Log</span>
              <span class="setting-hint">Shows the rolling combat log panel during fights. Default on.</span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${localStorage.getItem('emberveil_show_dps_meter')==='1'?' on':''}" id="show-dps-meter-toggle" aria-checked="${localStorage.getItem('emberveil_show_dps_meter')==='1'?'true':'false'}" aria-label="Show Damage Meter"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Show Damage Meter</span>
              <span class="setting-hint">Shows the per-fight damage / heal / mitigation meter overlay. Default off.</span>
            </div>
          </div>
        </div>
        <div class="setting-row" id="combat-show-enemies-row" style="display:${(localStorage.getItem('emberveil_show_combat_log')!=='0' || localStorage.getItem('emberveil_show_dps_meter')==='1')?'':'none'}">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${localStorage.getItem('emberveil_combat_show_enemies')==='1'?' on':''}" id="combat-show-enemies-toggle" aria-checked="${localStorage.getItem('emberveil_combat_show_enemies')==='1'?'true':'false'}" aria-label="Show Enemy Damage and Info"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Show Enemy Damage &amp; Info</span>
              <span class="setting-hint">When the combat log or damage meter is enabled, also include enemy attacks/info in those views. Off by default to keep the log lean.</span>
            </div>
          </div>
        </div>
        <!-- M357: Companion Level Sync is now always-on; setting removed. -->
        <!-- M312 #16: difficulty removed from Settings — now under pause menu (DifficultyDialog) -->
        ${(() => { try { return localStorage.getItem('emberveil_difficulty') === 'hard'; } catch { return false; } })()
          ? `<div class="setting-row" style="background:rgba(160,40,40,0.12);border:1px solid rgba(200,60,60,0.35);border-radius:6px;padding:0.55rem 0.75rem;">
               <span style="font-size:0.75rem;color:#e09090;line-height:1.5"><strong style="font-family:'Cinzel',serif;color:#e08080">Hard difficulty:</strong> auto-skill and auto-equip are locked off. Auto-combat (Manual Mode toggle) is still available.</span>
             </div>`
          : ''}
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${localStorage.getItem('autoAdvance')!=='0'?' on':''}" id="auto-advance-toggle" aria-label="Auto-Advance Dialog"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Auto-Advance Dialog</span>
              <span class="setting-hint">When on, dialog lines auto-progress after a short delay. Off lets you read at your own pace.</span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${window.__telemetryOptIn?' on':''}" id="telemetry-toggle" aria-checked="${window.__telemetryOptIn?'true':'false'}" aria-label="Share Anonymous Data"></div>
            <div style="display:flex;flex-direction:column;gap:0.15rem">
              <span class="setting-label" style="margin:0">Share Anonymous Data</span>
              <span style="font-size:0.65rem;color:#6a5a52">Balance telemetry only — no names, no PII. <a href="./assets/privacy.html" target="_blank" style="color:#e8a020">privacy</a></span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.enabled?' on':''}" id="dbg-enabled" aria-checked="${debug.flags.enabled?'true':'false'}" aria-label="Debug Mode"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Debug Mode</span>
              <span class="setting-hint">Enables hidden developer tools — combat replay, save inspector, debug overlays. Won't change game balance or saves.</span>
            </div>
          </div>
          <button type="button" class="dbg-settings-open${debug.flags.enabled?' visible':''}" id="dbg-settings-open-btn">Debug Settings</button>
        </div>
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${isCombatDebugLogging()?' on':''}" id="cbt-debug-toggle" aria-checked="${isCombatDebugLogging()?'true':'false'}" aria-label="Combat Debugging"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Combat Debugging</span>
              <span class="setting-hint">Logs every combat detail to console (initiative rolls, turn order, AI decisions, hit/crit chances, damage formulas, status applications, legendary effect procs). Use to debug discrepancies between the in-screen log, the post-combat report, and the damage meter. Off by default; no performance cost when off.</span>
            </div>
          </div>
        </div>
        <!-- M406 — Debug Map Nodes toggle (replaces window.__mapDebug console flag) -->
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${getMapDebugSettings().debugNodes?' on':''}" id="map-debug-nodes-toggle" aria-checked="${getMapDebugSettings().debugNodes?'true':'false'}" aria-label="Debug Map Nodes"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Debug Map Nodes</span>
              <span class="setting-hint">On every node travel, logs the current node ID/name and all adjacent nodes with their discovered state to the console. Also dumps the full zone graph on map load (previously window.__mapDebug).</span>
            </div>
          </div>
        </div>
        <!-- M436: "New Combat UI (Beta)" toggle removed. The 2.5D SVG grid
             that toggle used to gate was retired in M434/M435; combat is
             now a single canvas-only path with no alternate render mode. -->
        <div class="setting-row">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${isShowCompanionFramesEnabled()?' on':''}" id="show-companion-frames-toggle" aria-checked="${isShowCompanionFramesEnabled()?'true':'false'}" aria-label="Show Companion Frames"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Show Companion Frames</span>
              <span class="setting-hint">Render the companion frame row in the new combat HUD. Off keeps the canvas sprites + HP bars and gives heroes more vertical room. (New Combat UI only.)</span>
            </div>
          </div>
        </div>
        <div class="setting-row" id="cloud-saves-row" style="${LOGIN_UI_DISABLED ? 'display:none' : ''}">
          <label class="setting-label">Cloud Account</label>
          <div id="cloud-signed-out" style="display:flex;flex-direction:column;gap:0.5rem">
            <input type="email" id="cloud-email" placeholder="email" autocomplete="email" style="background:rgba(0,0,0,0.4);border:1px solid rgba(232,160,32,0.3);color:#e8d8c8;padding:0.5rem 0.7rem;border-radius:3px;font:inherit;font-size:0.8rem" />
            <input type="password" id="cloud-password" placeholder="password" autocomplete="current-password" style="background:rgba(0,0,0,0.4);border:1px solid rgba(232,160,32,0.3);color:#e8d8c8;padding:0.5rem 0.7rem;border-radius:3px;font:inherit;font-size:0.8rem" />
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <button type="button" id="cloud-signin-btn" style="flex:1;min-width:90px;background:rgba(232,160,32,0.25);border:1px solid rgba(232,160,32,0.6);color:#e8a020;padding:0.55rem 0.6rem;border-radius:3px;font-family:inherit;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Sign In</button>
              <button type="button" id="cloud-signup-btn" style="flex:1;min-width:90px;background:rgba(232,160,32,0.15);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.55rem 0.6rem;border-radius:3px;font-family:inherit;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Sign Up</button>
            </div>
            <button type="button" id="cloud-google-btn" style="background:#fff;color:#222;border:0;padding:0.55rem 0.6rem;border-radius:3px;font-family:inherit;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;font-weight:600">Sign in with Google</button>
            <span id="cloud-signin-status" style="font-size:0.65rem;color:#6a5a52;min-height:0.9rem"></span>
          </div>
          <div id="cloud-signed-in" style="display:none;flex-direction:column;gap:0.5rem">
            <div id="cloud-user-info" style="font-size:0.75rem;color:#c8b89c;word-break:break-all"></div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <button type="button" id="cloud-sync-btn" style="flex:1;min-width:110px;background:rgba(232,160,32,0.15);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.55rem 0.6rem;border-radius:3px;font-family:inherit;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Sync Now</button>
              <button type="button" id="cloud-signout-btn" style="flex:1;min-width:110px;background:rgba(120,40,40,0.25);border:1px solid rgba(200,80,80,0.6);color:#e88080;padding:0.55rem 0.6rem;border-radius:3px;font-family:inherit;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Sign Out</button>
            </div>
            <span id="cloud-sync-status" style="font-size:0.65rem;color:#6a5a52;min-height:0.9rem"></span>
          </div>
          <span style="font-size:0.65rem;color:#6a5a52">Sign in to keep your saves synced across devices.</span>
        </div>
        <div class="setting-row">
          <label class="setting-label">Save Backup</label>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button type="button" id="export-save-btn" style="flex:1;min-width:120px;background:rgba(232,160,32,0.15);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Export Save</button>
            <button type="button" id="import-save-btn" style="flex:1;min-width:120px;background:rgba(232,160,32,0.15);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Import Save</button>
          </div>
          <span style="font-size:0.65rem;color:#6a5a52">Download or restore a single save file (choose a party).</span>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <button type="button" id="export-saves-btn" style="flex:1;min-width:120px;background:rgba(232,160,32,0.15);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Export Game Data</button>
            <button type="button" id="import-saves-btn" style="flex:1;min-width:120px;background:rgba(232,160,32,0.15);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Import Game Data</button>
          </div>
          <span style="font-size:0.65rem;color:#6a5a52">Download or restore all browser save data, including save games.</span>
          <input type="file" id="import-saves-file" accept="application/json,.json" style="display:none">
          <input type="file" id="import-single-save-file" accept="application/json,.json" style="display:none">
        </div>
        <div class="setting-row">
          <label class="setting-label">Achievements</label>
          <button type="button" id="reset-achievements-btn" style="background:rgba(192,64,48,0.15);border:1px solid rgba(192,64,48,0.5);color:#e08070;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;min-height:44px;width:100%">Reset All Achievements</button>
          <span style="font-size:0.65rem;color:#6a5a52">Clears all account-wide achievement progress. Use for testing only.</span>
        </div>
        <div class="setting-row">
          <label class="setting-label">Progression</label>
          <button type="button" id="reset-progression-btn" style="background:rgba(192,64,48,0.15);border:1px solid rgba(192,64,48,0.5);color:#e08070;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;min-height:44px;width:100%">Reset All Progression</button>
          <span style="font-size:0.65rem;color:#6a5a52">Wipes class unlocks, fame, achievements, and What's New flags. Save files are kept untouched.</span>
        </div>
        <div class="setting-row sim-data-block${(debug.flags.enabled && debug.flags.simulator)?' enabled':''}" id="sim-data-block">
          <label class="setting-label">Combat Simulator Data</label>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button type="button" id="import-enemies-btn" style="flex:1;min-width:120px;background:rgba(96,192,96,0.15);border:1px solid rgba(96,192,96,0.5);color:#60c060;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Import Enemies</button>
            <button type="button" id="import-items-btn" style="flex:1;min-width:120px;background:rgba(96,192,96,0.15);border:1px solid rgba(96,192,96,0.5);color:#60c060;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Import Items</button>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem">
            <button type="button" id="import-affixes-btn" style="flex:1;min-width:120px;background:rgba(96,192,96,0.15);border:1px solid rgba(96,192,96,0.5);color:#60c060;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Import Affixes</button>
            <button type="button" id="reset-sim-data-btn" style="flex:1;min-width:120px;background:rgba(192,64,48,0.15);border:1px solid rgba(192,64,48,0.5);color:#c04030;padding:0.6rem 0.8rem;border-radius:4px;font-family:inherit;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Reset All</button>
          </div>
          <span style="font-size:0.65rem;color:#6a5a52">Import JSON data from tools page to temporarily override combat simulator defaults. Data resets on page refresh.</span>
          <input type="file" id="import-data-file" accept="application/json,.json" style="display:none">
        </div>
      </div>
      <button type="button" class="settings-back" id="settings-back">← Back</button>
    `;
    this.manager.uiOverlay.appendChild(this._el);

    // M297: mount keyboard navigation. Sliders/selects keep their native behaviour;
    // arrow keys only move between focusable elements when a non-input is focused.
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: false,
      onEscape: () => { this.audio.playSfx('click'); this.manager.pop(); },
    });

    // Keyboard activation for all toggle switches (Space/Enter) + aria sync.
    this._el.querySelectorAll('.toggle-switch').forEach(sw => {
      sw.setAttribute('aria-checked', sw.classList.contains('on') ? 'true' : 'false');
      sw.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sw.click(); }
      });
      sw.addEventListener('click', () => {
        sw.setAttribute('aria-checked', sw.classList.contains('on') ? 'true' : 'false');
      });
    });

    this._el.querySelector('#master-vol').addEventListener('input', e => this.audio.setMasterVolume(+e.target.value));
    const musicVolEl = this._el.querySelector('#music-vol');
    const sfxVolEl = this._el.querySelector('#sfx-vol');
    musicVolEl.addEventListener('input', e => this.audio.setMusicVolume(+e.target.value));
    sfxVolEl.addEventListener('input', e => this.audio.setSfxVolume(+e.target.value));

    const musicEnabled = this._el.querySelector('#music-enabled');
    musicEnabled.addEventListener('change', () => {
      const muted = !musicEnabled.checked;
      this.audio.setMusicMuted(muted);
      musicVolEl.disabled = muted;
      musicVolEl.classList.toggle('muted', muted);
    });
    const sfxEnabled = this._el.querySelector('#sfx-enabled');
    sfxEnabled.addEventListener('change', () => {
      const muted = !sfxEnabled.checked;
      this.audio.setSfxMuted(muted);
      sfxVolEl.disabled = muted;
      sfxVolEl.classList.toggle('muted', muted);
      if (!muted) this.audio.playSfx('click');
    });

    // M296: reduce-motion select (3-way: auto / on / off)
    const rmSel = this._el.querySelector('#reduce-motion-select');
    if (rmSel) {
      rmSel.addEventListener('change', () => {
        setReduceMotionMode(rmSel.value);
        _applyReduceMotionClass();
      });
    }

    // M296: color palette select
    const palSel = this._el.querySelector('#color-palette-select');
    if (palSel) {
      palSel.addEventListener('change', () => {
        setActivePalette(palSel.value);
      });
    }

    // M296: font scale select
    const fsSel = this._el.querySelector('#font-scale-select');
    if (fsSel) {
      fsSel.addEventListener('change', () => {
        setFontScale(fsSel.value);
      });
    }

    // M296: combat captions toggle
    const ccToggle = this._el.querySelector('#combat-captions-toggle');
    if (ccToggle) {
      ccToggle.addEventListener('click', () => {
        const on = ccToggle.classList.toggle('on');
        ccToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        localStorage.setItem('emberveil_combat_captions', on ? '1' : '0');
      });
    }

    // M323: Slow Combat Options toggle — adds 0.5×/0.25× + pause/Next Turn.
    const scToggle = this._el.querySelector('#slow-combat-toggle');
    if (scToggle) {
      scToggle.addEventListener('click', () => {
        const on = scToggle.classList.toggle('on');
        scToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        localStorage.setItem('emberveil_slow_combat_enabled', on ? '1' : '0');
      });
    }
    // M335: combat log / DPS meter toggles + paired enemy-info toggle.
    const refreshEnemyRow = () => {
      const row = this._el.querySelector('#combat-show-enemies-row');
      if (!row) return;
      const showLog  = localStorage.getItem('emberveil_show_combat_log') !== '0';
      const showDps  = localStorage.getItem('emberveil_show_dps_meter') === '1';
      row.style.display = (showLog || showDps) ? '' : 'none';
    };
    const logToggle = this._el.querySelector('#show-combat-log-toggle');
    if (logToggle) {
      logToggle.addEventListener('click', () => {
        const on = logToggle.classList.toggle('on');
        logToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        localStorage.setItem('emberveil_show_combat_log', on ? '1' : '0');
        refreshEnemyRow();
      });
    }
    const dpsToggle = this._el.querySelector('#show-dps-meter-toggle');
    if (dpsToggle) {
      dpsToggle.addEventListener('click', () => {
        const on = dpsToggle.classList.toggle('on');
        dpsToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        localStorage.setItem('emberveil_show_dps_meter', on ? '1' : '0');
        refreshEnemyRow();
      });
    }
    const enemyToggle = this._el.querySelector('#combat-show-enemies-toggle');
    if (enemyToggle) {
      enemyToggle.addEventListener('click', () => {
        const on = enemyToggle.classList.toggle('on');
        enemyToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        localStorage.setItem('emberveil_combat_show_enemies', on ? '1' : '0');
      });
    }

    // M302: companion level sync toggle
    const clsToggle = this._el.querySelector('#companion-level-sync-toggle');
    if (clsToggle) {
      clsToggle.addEventListener('click', () => {
        const on = clsToggle.classList.toggle('on');
        clsToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        localStorage.setItem('emberveil_companion_level_sync', on ? '1' : '0');
      });
    }

    // M312 #16: difficulty removed from Settings — handled by DifficultyDialog in pause menu.

    const aaToggle = this._el.querySelector('#auto-advance-toggle');
    aaToggle.addEventListener('click', () => {
      const on = aaToggle.classList.toggle('on');
      localStorage.setItem('autoAdvance', on ? '1' : '0');
    });

    // bg/sprite toggles are now inside the Debug Settings submodal (_openDebugSettingsModal).
    const telToggle = this._el.querySelector('#telemetry-toggle');
    if (telToggle) {
      import('../../game/telemetry.js').then(mod => {
        telToggle.classList.toggle('on', mod.isOptedIn());
        telToggle.addEventListener('click', () => {
          const on = telToggle.classList.toggle('on');
          mod.setOptIn(on);
          window.__telemetryOptIn = on;
        });
      });
    }

    const dbgEnabled = this._el.querySelector('#dbg-enabled');
    const dbgSettingsBtn = this._el.querySelector('#dbg-settings-open-btn');
    const simBlock = this._el.querySelector('#sim-data-block');
    const refreshSimBlock = () => {
      const show = !!(debug.flags.enabled && debug.flags.simulator);
      simBlock?.classList.toggle('enabled', show);
    };
    dbgEnabled.addEventListener('click', () => {
      const on = dbgEnabled.classList.toggle('on');
      debug.set({ enabled: on });
      debug.reload();
      dbgSettingsBtn.classList.toggle('visible', on);
      refreshSimBlock();
    });
    dbgSettingsBtn.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._openDebugSettingsModal();
    });

    // M377 — Combat Debugging toggle
    const cbtDbg = this._el.querySelector('#cbt-debug-toggle');
    if (cbtDbg) {
      cbtDbg.addEventListener('click', () => {
        const on = cbtDbg.classList.toggle('on');
        cbtDbg.setAttribute('aria-checked', on ? 'true' : 'false');
        setCombatDebugLogging(on);
      });
    }

    // M406 — Debug Map Nodes toggle
    const mapDbgToggle = this._el.querySelector('#map-debug-nodes-toggle');
    if (mapDbgToggle) {
      mapDbgToggle.addEventListener('click', () => {
        const on = mapDbgToggle.classList.toggle('on');
        mapDbgToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        setMapDebugSettings({ debugNodes: on });
        // Keep window.__mapDebug in sync for legacy consumers.
        window.__mapDebug = on;
      });
    }

    // M436: UI-overhaul toggle removed (no alternate combat render mode).

    // M393 — Show Companion Frames toggle
    const showCompFramesToggle = this._el.querySelector('#show-companion-frames-toggle');
    if (showCompFramesToggle) {
      const flip = () => {
        const on = showCompFramesToggle.classList.toggle('on');
        showCompFramesToggle.setAttribute('aria-checked', on ? 'true' : 'false');
        try { localStorage.setItem('emberveil_show_companion_frames', on ? '1' : '0'); } catch (_) {}
      };
      showCompFramesToggle.addEventListener('click', flip);
      showCompFramesToggle.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      });
    }

    // ── Cloud account (sign-in / sign-up / Google / sign-out / sync) ────
    const signedOutEl = this._el.querySelector('#cloud-signed-out');
    const signedInEl  = this._el.querySelector('#cloud-signed-in');
    const userInfoEl  = this._el.querySelector('#cloud-user-info');
    const signinStatus = this._el.querySelector('#cloud-signin-status');
    const syncStatus   = this._el.querySelector('#cloud-sync-status');
    const setSigninStatus = (m) => { if (signinStatus) signinStatus.textContent = m || ''; };
    const setSyncStatus   = (m) => { if (syncStatus) syncStatus.textContent = m || ''; };

    const renderAuth = () => {
      if (!authManager.configured) {
        signedOutEl.style.display = 'none';
        signedInEl.style.display  = 'none';
        setSigninStatus('Auth not configured for this build.');
        return;
      }
      const u = authManager.user;
      if (u) {
        signedOutEl.style.display = 'none';
        signedInEl.style.display  = 'flex';
        userInfoEl.textContent = `${u.email || u.id} (${u.app_metadata?.provider || 'email'})`;
      } else {
        signedOutEl.style.display = 'flex';
        signedInEl.style.display  = 'none';
      }
    };

    renderAuth();
    const unsub = authManager.onChange(() => renderAuth());
    this._authUnsub = unsub;
    if (!authManager.configured) {
      // Try once — might not have initialized yet if this screen opens before main.js resolve.
      authManager.init().then(renderAuth).catch(() => {});
    }

    this._el.querySelector('#cloud-signin-btn').addEventListener('click', async () => {
      this.audio.playSfx('click');
      const email = this._el.querySelector('#cloud-email').value.trim();
      const pass  = this._el.querySelector('#cloud-password').value;
      if (!email || !pass) { setSigninStatus('Enter email and password.'); return; }
      setSigninStatus('Signing in…');
      const { error } = await authManager.signIn(email, pass);
      setSigninStatus(error ? `Error: ${error.message}` : 'Signed in.');
    });
    this._el.querySelector('#cloud-signup-btn').addEventListener('click', async () => {
      this.audio.playSfx('click');
      const email = this._el.querySelector('#cloud-email').value.trim();
      const pass  = this._el.querySelector('#cloud-password').value;
      if (!email || !pass) { setSigninStatus('Enter email and password.'); return; }
      setSigninStatus('Signing up…');
      const { data, error } = await authManager.signUp(email, pass);
      if (error) { setSigninStatus(`Error: ${error.message}`); return; }
      setSigninStatus(data?.session ? 'Signed up and signed in.' : `Check your inbox (${email}) — confirmation email sent.`);
    });
    this._el.querySelector('#cloud-google-btn').addEventListener('click', async () => {
      this.audio.playSfx('click');
      setSigninStatus('Redirecting to Google…');
      const { error } = await authManager.signInWithGoogle();
      if (error) setSigninStatus(`Error: ${error.message}`);
    });
    this._el.querySelector('#cloud-signout-btn').addEventListener('click', async () => {
      this.audio.playSfx('click');
      if (!confirm('Sign out of the cloud account? Local saves are unaffected.')) return;
      setSyncStatus('Signing out…');
      const { error } = await authManager.signOut();
      setSyncStatus(error ? `Error: ${error.message}` : '');
    });
    this._el.querySelector('#cloud-sync-btn').addEventListener('click', async () => {
      this.audio.playSfx('click');
      setSyncStatus('Syncing…');
      const up = await cloudSaves.uploadAllMissing();
      const down = await cloudSaves.downloadAllMissing();
      setSyncStatus(`Uploaded ${up.ok}, downloaded ${down.ok}${(up.fail+down.fail)?` (${up.fail+down.fail} failed)`:''}.`);
    });

    this._el.querySelector('#export-saves-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      try {
        const blob = SaveManager.exportAllSaves();
        const json = JSON.stringify(blob, null, 2);
        const file = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(file);
        const d = new Date();
        const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const a = document.createElement('a');
        a.href = url; a.download = `emberveil-saves-${ymd}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        alert('Export failed: ' + e.message);
      }
    });

    const fileInput = this._el.querySelector('#import-saves-file');
    this._el.querySelector('#import-saves-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      fileInput.click();
    });
    fileInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        // Pre-validate before confirm so we don't prompt on garbage
        const parsed = JSON.parse(text);
        if (!parsed || parsed.emberveil !== 1 || !parsed.saves) {
          throw new Error('Not a valid Emberveil save backup.');
        }
        if (!confirm('Replace all saves? Existing saves will be overwritten.')) {
          fileInput.value = '';
          return;
        }
        const count = SaveManager.importAllSaves(parsed);
        alert(`Imported ${count} save${count===1?'':'s'}. Reloading…`);
        location.reload();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
      fileInput.value = '';
    });

    // ── Single-save Export / Import ──────────────────────────────────────
    this._el.querySelector('#export-save-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._openSinglePickerModal();
    });
    const singleInput = this._el.querySelector('#import-single-save-file');
    this._el.querySelector('#import-save-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      singleInput.click();
    });
    singleInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const parsed = JSON.parse(text);
        if (!parsed || parsed.emberveilSingle !== 1 || typeof parsed.key !== 'string' || typeof parsed.data !== 'string') {
          throw new Error('Not a valid single-save file.');
        }
        // If a save with the same stored key already exists, ask:
        const existing = localStorage.getItem(parsed.key);
        let targetKey = parsed.key;
        if (existing) {
          const choice = prompt('A save with this ID already exists. Type "overwrite", "new", or leave blank to cancel.');
          if (!choice) { singleInput.value = ''; return; }
          const c = String(choice).trim().toLowerCase();
          if (c === 'cancel' || c === '') { singleInput.value = ''; return; }
          if (c === 'new' || c.startsWith('n') || c === 'add') {
            // Generate a unique new key rather than overwriting.
            targetKey = parsed.key + '_' + Date.now().toString(36);
          } else if (c === 'overwrite' || c.startsWith('o')) {
            targetKey = parsed.key;
          } else {
            singleInput.value = ''; return;
          }
        }
        localStorage.setItem(targetKey, parsed.data);
        alert('Save imported.');
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
      singleInput.value = '';
    });

    // Combat simulator data import functionality
    const dataFileInput = this._el.querySelector('#import-data-file');
    this._currentImportType = null;

    this._el.querySelector('#import-enemies-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._currentImportType = 'enemies';
      dataFileInput.click();
    });

    this._el.querySelector('#import-items-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._currentImportType = 'items';
      dataFileInput.click();
    });

    this._el.querySelector('#import-affixes-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._currentImportType = 'affixes';
      dataFileInput.click();
    });

    this._el.querySelector('#reset-sim-data-btn').addEventListener('click', () => {
      this.audio.playSfx('click');
      if (confirm('Reset all imported combat simulator data? This will restore defaults until page refresh.')) {
        this._resetSimData();
      }
    });

    dataFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0 && this._currentImportType) {
        this._importSimDataFile(e.target.files[0], this._currentImportType);
      }
      e.target.value = '';
      this._currentImportType = null;
    });

    // M314 — Reset Achievements button
    const resetAchBtn = this._el.querySelector('#reset-achievements-btn');
    if (resetAchBtn) {
      resetAchBtn.addEventListener('click', () => {
        this.audio.playSfx('click');
        import('../components/ConfirmModal.js').then(({ showConfirmModal }) => {
          showConfirmModal({
            title: 'Reset Achievements',
            message: 'This will permanently clear all account-wide achievement progress. Achievements in your current run will also be reset. This cannot be undone.',
            confirmText: 'Reset',
            cancelText: 'Cancel',
            onConfirm: () => {
              import('../../game/achievements.js').then(({ resetGlobalAchievements }) => {
                resetGlobalAchievements();
                // Also clear the current run's mirror so the screen reflects the reset.
                const gs = GameState.get();
                if (gs) gs.achievements = {};
                this.audio.playSfx('click');
              }).catch(() => {});
            },
          });
        }).catch(() => {});
      });
    }

    // M322 — Reset Progression: wipe unlocks/achievements/fame/etc., keep saves.
    const resetProgBtn = this._el.querySelector('#reset-progression-btn');
    if (resetProgBtn) {
      resetProgBtn.addEventListener('click', () => {
        this.audio.playSfx('click');
        import('../components/ConfirmModal.js').then(({ showConfirmModal }) => {
          showConfirmModal({
            title: 'Reset All Progression',
            message: 'This wipes account-wide unlocks (classes, fame, achievements, What\'s New flags). Save files are NOT deleted. This cannot be undone.',
            confirmText: 'Reset Progression',
            cancelText: 'Cancel',
            onConfirm: () => {
              try {
                // Keys to wipe — keep emberveil_save_* untouched.
                const KEEP_PREFIXES = ['emberveil_save_', 'emberveil_settings', 'emberveil_audio'];
                const toRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (!k) continue;
                  if (!k.startsWith('emberveil_') && !k.startsWith('rsg_')) continue;
                  if (KEEP_PREFIXES.some(p => k.startsWith(p))) continue;
                  toRemove.push(k);
                }
                for (const k of toRemove) localStorage.removeItem(k);
                // Also clear any in-memory mirror on the active GameState.
                const gs = GameState.get();
                if (gs) {
                  gs.achievements = {};
                  gs.fame = 0;
                }
                this.audio.playSfx('click');
                import('../components/toast.js').then(({ showToast }) => {
                  showToast('Progression reset — saves kept.');
                }).catch(() => {});
              } catch (err) {
                console.warn('[reset-progression] failed:', err);
              }
            },
          });
        }).catch(() => {});
      });
    }

    this._el.querySelector('#settings-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
  }

  _importSimDataFile(file, dataType) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this._applySimData(data, dataType);
        alert(`${dataType.charAt(0).toUpperCase() + dataType.slice(1)} data imported successfully! Changes will persist until page refresh.`);
      } catch (err) {
        console.error('Import failed:', err);
        alert('Import failed: Invalid JSON file or format error.');
      }
    };
    reader.readAsText(file);
  }

  _applySimData(data, dataType) {
    // Store imported data in global window object for combat simulator to access
    if (!window.__simDataOverrides) window.__simDataOverrides = {};

    switch (dataType) {
      case 'enemies':
        if (data.ENEMIES || data.enemies) {
          window.__simDataOverrides.ENEMIES = data.ENEMIES || data.enemies;
          console.log('Imported enemies:', Object.keys(window.__simDataOverrides.ENEMIES).length);
        } else if (Array.isArray(data)) {
          // Handle array format - convert to object
          const enemiesObj = {};
          data.forEach(enemy => {
            if (enemy.id) enemiesObj[enemy.id] = enemy;
          });
          window.__simDataOverrides.ENEMIES = enemiesObj;
        } else {
          throw new Error('Invalid enemies format. Expected ENEMIES object or array.');
        }
        break;

      case 'items':
        if (data.WEAPON_BASES || data.ARMOR_BASES || data.weapons || data.armor) {
          window.__simDataOverrides.WEAPON_BASES = data.WEAPON_BASES || data.weapons;
          window.__simDataOverrides.ARMOR_BASES = data.ARMOR_BASES || data.armor;
          console.log('Imported items - Weapons:', Object.keys(window.__simDataOverrides.WEAPON_BASES || {}).length);
          console.log('Imported items - Armor:', Object.keys(window.__simDataOverrides.ARMOR_BASES || {}).length);
        } else {
          throw new Error('Invalid items format. Expected WEAPON_BASES/ARMOR_BASES or weapons/armor objects.');
        }
        break;

      case 'affixes':
        if (data.AFFIXES || data.affixes) {
          window.__simDataOverrides.AFFIXES = data.AFFIXES || data.affixes;
          console.log('Imported affixes:', Object.keys(window.__simDataOverrides.AFFIXES).length);
        } else if (Array.isArray(data)) {
          // Handle array format
          window.__simDataOverrides.AFFIXES = {};
          data.forEach(affix => {
            if (affix.id) window.__simDataOverrides.AFFIXES[affix.id] = affix;
          });
        } else {
          throw new Error('Invalid affixes format. Expected AFFIXES object or array.');
        }
        break;

      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }

  _openSinglePickerModal() {
    const saves = SaveManager.listSaves() || [];
    if (!saves.length) {
      alert('No saves to export.');
      return;
    }
    // Simple styled modal
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;z-index:1100;padding:16px;font-family:Cinzel,Georgia,serif';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1218;border:1px solid rgba(232,160,32,0.6);border-radius:12px;padding:1rem;max-width:420px;width:92%;max-height:80vh;overflow-y:auto;color:#f0e8d8';
    box.innerHTML = `
      <div style="font-size:1rem;color:#e8a020;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 0.75rem;text-align:center">Export a Save</div>
      <div style="font-family:Inter,Segoe UI,sans-serif;font-size:0.8rem;color:#c8b8a8;margin:0 0 0.75rem;text-align:center">Pick a save to download.</div>
      <div id="exp-save-list"></div>
      <div style="text-align:center;margin-top:0.75rem">
        <button type="button" id="exp-save-cancel" style="background:none;border:none;color:#8a7a6a;text-decoration:underline;cursor:pointer;font-size:0.85rem">Cancel</button>
      </div>
    `;
    wrap.appendChild(box);
    const list = box.querySelector('#exp-save-list');
    saves.forEach(s => {
      const btn = document.createElement('div');
      btn.style.cssText = 'padding:0.6rem 0.75rem;margin:0.35rem 0;background:rgba(255,255,255,0.04);border:1px solid rgba(232,160,32,0.35);border-radius:6px;cursor:pointer;font-family:Inter,Segoe UI,sans-serif';
      btn.innerHTML = `
        <div style="color:#e8d8b8;font-weight:600;font-size:0.85rem">${(s.heroName || 'Hero')} <span style="color:#8a7a6a;font-weight:400;font-size:0.75rem">Lv ${s.level || 1} · Act ${s.act || 1}</span></div>
        <div style="color:#8a7a6a;font-size:0.7rem;margin-top:0.15rem">${s.timestamp || ''}</div>
      `;
      btn.addEventListener('click', () => {
        this._exportSingleSave(s);
        try { wrap.remove(); } catch (_) {}
      });
      list.appendChild(btn);
    });
    box.querySelector('#exp-save-cancel').addEventListener('click', () => { try { wrap.remove(); } catch (_) {} });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { try { wrap.remove(); } catch (_) {} } });
    document.body.appendChild(wrap);
  }

  _exportSingleSave(save) {
    try {
      const raw = localStorage.getItem(save.key);
      if (!raw) { alert('Save data missing.'); return; }
      const blob = {
        emberveilSingle: 1,
        exportedAt: new Date().toISOString(),
        saveVersion: (save.version || 0),
        key: save.key,
        heroName: save.heroName || 'Hero',
        data: raw,
      };
      const text = JSON.stringify(blob, null, 2);
      const file = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(file);
      const d = new Date();
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const safeName = (save.heroName || 'hero').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'hero';
      const a = document.createElement('a');
      a.href = url; a.download = `emberveil-save-${safeName}-${ymd}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  _resetSimData() {
    // Clear all imported data overrides
    if (window.__simDataOverrides) {
      delete window.__simDataOverrides;
      alert('Combat simulator data reset to defaults.');
    } else {
      alert('No imported data to reset.');
    }
  }

  // ── Debug Settings submodal ────────────────────────────────────────────────
  _openDebugSettingsModal() {
    const wrap = document.createElement('div');
    wrap.className = 'dbg-modal-wrap';

    const logImages = localStorage.getItem('emberveil_dbg_log_images') === '1';

    wrap.innerHTML = `
      <div class="dbg-modal-box">
        <button type="button" class="dbg-modal-back" id="dbg-settings-back">&#8592; Back to Settings</button>
        <div class="dbg-modal-title">Debug Settings</div>

        <div style="display:flex;flex-direction:column;gap:0.6rem">
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.combat?' on':''}" id="ds-combat" aria-label="Log Combat"></div>
            <span class="setting-label" style="margin:0">Log Combat</span>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.map?' on':''}" id="ds-map" aria-label="Log Map"></div>
            <span class="setting-label" style="margin:0">Log Map</span>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.audio?' on':''}" id="ds-audio" aria-label="Log Audio"></div>
            <span class="setting-label" style="margin:0">Log Audio</span>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.state?' on':''}" id="ds-state" aria-label="Log State"></div>
            <span class="setting-label" style="margin:0">Log State</span>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.auth?' on':''}" id="ds-auth" aria-label="Log Auth"></div>
            <span class="setting-label" style="margin:0">Log Auth</span>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.saves?' on':''}" id="ds-saves" aria-label="Log Cloud Saves"></div>
            <span class="setting-label" style="margin:0">Log Cloud Saves</span>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${debug.flags.simulator?' on':''}" id="ds-simulator" aria-label="Combat Simulator"></div>
            <span class="setting-label" style="margin:0">Combat Simulator</span>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${window.__gfxDisableBg?' on':''}" id="ds-disable-bg" aria-label="Disable Backgrounds"></div>
            <div style="display:flex;flex-direction:column;gap:0.12rem">
              <span class="setting-label" style="margin:0">Disable Backgrounds</span>
              <span style="font-size:0.65rem;color:#6a5a52">Skip background art for performance</span>
            </div>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${window.__gfxDisableSprites?' on':''}" id="ds-disable-sprites" aria-label="Disable Sprites"></div>
            <div style="display:flex;flex-direction:column;gap:0.12rem">
              <span class="setting-label" style="margin:0">Disable Sprites</span>
              <span style="font-size:0.65rem;color:#6a5a52">Show class icons instead of portraits/sprites</span>
            </div>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${logImages?' on':''}" id="ds-log-images" aria-label="Log Images"></div>
            <div style="display:flex;flex-direction:column;gap:0.12rem">
              <span class="setting-label" style="margin:0">Log Images</span>
              <span style="font-size:0.65rem;color:#6a5a52">Log sprite filenames + positions on render (M219)</span>
            </div>
          </div>
          <!-- M357: Attack Speed always-on; toggle removed (was redundant with the runtime). -->
          <!-- M242: combat/map debug toggles moved out of Cheat menu — they are
               visual-only debug, not cheats. -->
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${localStorage.getItem('emberveil_combat_debug_auto')==='1'?' on':''}" id="ds-combat-debug" aria-label="Combat Debug Auto-Open"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Combat Debug</span>
              <span class="setting-hint">Auto-open the Combat Debug panel + pause on combat entry so you can tune layout.</span>
            </div>
          </div>
          <div class="setting-toggle">
            <div tabindex="0" role="switch" class="toggle-switch${localStorage.getItem('emberveil_map_debug_auto')==='1'?' on':''}" id="ds-map-debug" aria-label="Map Debug Auto-Open"></div>
            <div class="setting-toggle-text">
              <span class="setting-label">Map Debug</span>
              <span class="setting-hint">Auto-open the Map Debug panel when viewing a map.</span>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.3rem">
          <button type="button" id="ds-copy-diag" class="dbg-modal-btn">Copy Diagnostic Log</button>
          <span style="font-size:0.65rem;color:#6a5a52">Copies auth + saves event buffer + session info.</span>
        </div>

        <hr style="border:none;border-top:1px solid rgba(160,80,255,0.2);margin:0.25rem 0">

        <button type="button" id="ds-cheat-menu" class="dbg-modal-btn cheat">Cheat Menu</button>
      </div>
    `;

    document.body.appendChild(wrap);

    // toggle-switch keyboard + aria
    wrap.querySelectorAll('.toggle-switch').forEach(sw => {
      sw.setAttribute('aria-checked', sw.classList.contains('on') ? 'true' : 'false');
      sw.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sw.click(); } });
      sw.addEventListener('click', () => { sw.setAttribute('aria-checked', sw.classList.contains('on') ? 'true' : 'false'); });
    });

    const wireDs = (id, key) => {
      const t = wrap.querySelector(id);
      if (!t) return;
      t.addEventListener('click', () => {
        const on = t.classList.toggle('on');
        debug.set({ [key]: on });
        debug.reload();
        if (key === 'simulator') {
          const simBlock = this._el?.querySelector('#sim-data-block');
          simBlock?.classList.toggle('enabled', !!(debug.flags.enabled && debug.flags.simulator));
        }
      });
    };
    wireDs('#ds-combat', 'combat');
    wireDs('#ds-map', 'map');
    wireDs('#ds-audio', 'audio');
    wireDs('#ds-state', 'state');
    wireDs('#ds-auth', 'auth');
    wireDs('#ds-saves', 'saves');
    wireDs('#ds-simulator', 'simulator');

    const bgT = wrap.querySelector('#ds-disable-bg');
    bgT?.addEventListener('click', () => {
      const on = bgT.classList.toggle('on');
      window.__gfxDisableBg = on;
      localStorage.setItem('emberveil_gfx_disable_bg', on ? '1' : '0');
      const gs = GameState.get();
      if (gs) { if (!gs.settings) gs.settings = {}; gs.settings.disableTextures = on || window.__gfxDisableSprites; }
    });
    const spT = wrap.querySelector('#ds-disable-sprites');
    spT?.addEventListener('click', () => {
      const on = spT.classList.toggle('on');
      window.__gfxDisableSprites = on;
      localStorage.setItem('emberveil_gfx_disable_sprites', on ? '1' : '0');
      const gs = GameState.get();
      if (gs) { if (!gs.settings) gs.settings = {}; gs.settings.disableTextures = on || window.__gfxDisableBg; }
    });

    // Log Images — persist only; M219 wires the runtime side
    const logImgT = wrap.querySelector('#ds-log-images');
    logImgT?.addEventListener('click', () => {
      const on = logImgT.classList.toggle('on');
      localStorage.setItem('emberveil_dbg_log_images', on ? '1' : '0');
    });

    // M231: Attack Speed feature flag. Toggle off to revert runtime.
    const asT = wrap.querySelector('#ds-attack-speed');
    asT?.addEventListener('click', () => {
      const on = asT.classList.toggle('on');
      localStorage.setItem('emberveil_attack_speed_enabled', on ? '1' : '0');
    });
    // M242: Combat/Map debug auto-open toggles relocated from Cheat menu.
    const cdT = wrap.querySelector('#ds-combat-debug');
    cdT?.addEventListener('click', () => {
      const on = cdT.classList.toggle('on');
      localStorage.setItem('emberveil_combat_debug_auto', on ? '1' : '0');
    });
    const mdT = wrap.querySelector('#ds-map-debug');
    mdT?.addEventListener('click', () => {
      const on = mdT.classList.toggle('on');
      localStorage.setItem('emberveil_map_debug_auto', on ? '1' : '0');
    });

    const copyDiagBtn = wrap.querySelector('#ds-copy-diag');
    copyDiagBtn?.addEventListener('click', async () => {
      this.audio.playSfx('click');
      try {
        const log = await debug.getDiagnosticLog();
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(log);
          copyDiagBtn.textContent = 'Copied!';
        } else {
          const ta = document.createElement('textarea');
          ta.value = log; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
          copyDiagBtn.textContent = 'Copied!';
        }
        setTimeout(() => { copyDiagBtn.textContent = 'Copy Diagnostic Log'; }, 1500);
      } catch (e) { alert('Copy failed: ' + e.message); }
    });

    wrap.querySelector('#ds-cheat-menu').addEventListener('click', () => {
      this.audio.playSfx('click');
      try { wrap.remove(); } catch (_) {}
      this._openCheatMenuModal();
    });

    wrap.querySelector('#dbg-settings-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      try { wrap.remove(); } catch (_) {}
    });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) { try { wrap.remove(); } catch (_) {} }
    });
  }

  // ── Cheat Menu submodal ────────────────────────────────────────────────────
  _openCheatMenuModal() {
    const wrap = document.createElement('div');
    wrap.className = 'dbg-modal-wrap';

    const xpMult = typeof cheats.xpMultiplier === 'number' ? cheats.xpMultiplier : 1.0;

    wrap.innerHTML = `
      <div class="dbg-modal-box">
        <button type="button" class="dbg-modal-back" id="cheat-back">&#8592; Back to Debug Settings</button>
        <div class="dbg-modal-title">Cheat Menu</div>

        <div style="display:flex;flex-direction:column;gap:1rem">

          <div class="cheat-row">
            <div class="setting-toggle">
              <div tabindex="0" role="switch" class="toggle-switch${cheats.unlockAllClasses?' on':''}" id="cheat-unlock-classes" aria-label="Unlock All Classes"></div>
              <div style="display:flex;flex-direction:column;gap:0.12rem">
                <span class="setting-label" style="margin:0">Unlock All Classes</span>
                <span style="font-size:0.65rem;color:#6a5a52">Temporarily unlocks every class. Does not modify saved progress.</span>
              </div>
            </div>
          </div>

          <div class="cheat-row">
            <span class="setting-label">XP Gain Multiplier</span>
            <div class="cheat-slider-row">
              <input type="range" class="cheat-slider" id="cheat-xp-slider" min="0.1" max="10" step="0.1" value="${xpMult}">
              <span class="cheat-slider-val" id="cheat-xp-val">${xpMult.toFixed(1)}x</span>
            </div>
            <span style="font-size:0.65rem;color:#6a5a52">Multiplied on every XP award post-combat.</span>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    // toggle-switch keyboard + aria
    wrap.querySelectorAll('.toggle-switch').forEach(sw => {
      sw.setAttribute('aria-checked', sw.classList.contains('on') ? 'true' : 'false');
      sw.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sw.click(); } });
      sw.addEventListener('click', () => { sw.setAttribute('aria-checked', sw.classList.contains('on') ? 'true' : 'false'); });
    });

    // Unlock All Classes
    const unlockT = wrap.querySelector('#cheat-unlock-classes');
    unlockT.addEventListener('click', () => {
      const on = unlockT.classList.toggle('on');
      cheats.unlockAllClasses = on;
      window.__cheatUnlockAllClasses = on;
      _writeCheats(cheats);
    });

    // XP Multiplier
    const xpSlider = wrap.querySelector('#cheat-xp-slider');
    const xpVal    = wrap.querySelector('#cheat-xp-val');
    xpSlider.addEventListener('input', () => {
      const v = parseFloat(xpSlider.value);
      xpVal.textContent = v.toFixed(1) + 'x';
      cheats.xpMultiplier = v;
      _writeCheats(cheats);
    });

    // M242: Combat/Map debug moved to Debug Settings. Kept as noop stubs
    // in case any legacy markup still references these ids.
    const combatDbgT = wrap.querySelector('#cheat-combat-debug-toggle');
    combatDbgT?.addEventListener('click', () => {
      const on = combatDbgT.classList.toggle('on');
      localStorage.setItem('emberveil_combat_debug_auto', on ? '1' : '0');
    });
    const mapDbgT = wrap.querySelector('#cheat-map-debug-toggle');
    mapDbgT?.addEventListener('click', () => {
      const on = mapDbgT.classList.toggle('on');
      localStorage.setItem('emberveil_map_debug_auto', on ? '1' : '0');
    });

    wrap.querySelector('#cheat-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      try { wrap.remove(); } catch (_) {}
      this._openDebugSettingsModal();
    });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) { try { wrap.remove(); } catch (_) {} }
    });
  }

  _openPlaceholderModal(title, message) {
    const wrap = document.createElement('div');
    wrap.className = 'dbg-modal-wrap';
    wrap.innerHTML = `
      <div class="dbg-modal-box" style="max-width:320px;text-align:center">
        <div class="dbg-modal-title">${title}</div>
        <p style="font-size:0.85rem;color:#c8b8a8;margin:0.5rem 0 1.25rem">${message}</p>
        <button type="button" id="ph-close" class="dbg-modal-btn">Close</button>
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.querySelector('#ph-close').addEventListener('click', () => { try { wrap.remove(); } catch (_) {} });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { try { wrap.remove(); } catch (_) {} } });
  }

  onExit() { if (this._authUnsub) { try { this._authUnsub(); } catch (_) {} this._authUnsub = null; } if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { if (this._authUnsub) { try { this._authUnsub(); } catch (_) {} this._authUnsub = null; } if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  update() {}
  draw() {}
}
