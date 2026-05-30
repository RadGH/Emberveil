/**
 * Emberveil — Main Entry Point
 * High fantasy party RPG with turn-based combat
 */

import './style.css';
import './ui/ev-panel.css';
// M435: ev-battlefield.css removed (SVG grid retired).
import './ui/ev-turn-strip.css';
import './ui/ev-card-rail.css';
// M297 — keyboard navigation focus ring (injected before any screen renders)
import { injectFocusStyles } from './utils/keyboardNav.js';
injectFocusStyles();

// M330 — GDPR consent + Google Analytics. Banner on first paint; GA loads
// only after Accept; Reject blocks future loads. Decision persists in
// localStorage rsg_consent_v1 (same origin → carries over to the
// RSG-Demos hub).
import { showConsentBannerIfNeeded, pushEvent as _pushAnalyticsEvent } from './utils/consent.js';
// GA measurement id resolved by hostname so the standalone Emberveil deploy
// (emberveil.radgh.com) reports separately from the dev / GitHub-Pages
// build (radgh.github.io/RSG-Demos). Override path: a boot snippet in
// index.html can set window.__RSG_GA_ID, or a Vite env var VITE_GA_ID can
// pin a specific id at build time.
function _resolveGaId() {
  if (typeof window !== 'undefined' && window.__RSG_GA_ID) return window.__RSG_GA_ID;
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GA_ID) return import.meta.env.VITE_GA_ID;
  if (typeof location === 'undefined') return null;
  const host = (location.hostname || '').toLowerCase();
  if (host === 'emberveil.radgh.com') return 'G-5H26ZXKBCL';
  // GitHub Pages dev/demo property — also covers localhost previews.
  return 'G-XP7B7KVNY8';
}
const RSG_GA_ID = _resolveGaId();
showConsentBannerIfNeeded({ gaId: RSG_GA_ID, privacyHref: 'privacy.html' });
// Expose for the rest of the codebase (telemetry.js / level-up / boss-kill
// hooks) without forcing each module to import the helper.
if (typeof window !== 'undefined') window.__rsgPushEvent = _pushAnalyticsEvent;

// Restore persisted graphics-disable flags early so renderers see them
try {
  window.__gfxDisableBg = localStorage.getItem('emberveil_gfx_disable_bg') === '1';
  window.__gfxDisableSprites = localStorage.getItem('emberveil_gfx_disable_sprites') === '1';
} catch (_) {}

// M296: apply persisted color palette, font scale, and reduce-motion class early
import { applyPersistedPalette } from './game/colorPalettes.js';
import { applyPersistedFontScale } from './utils/fontScale.js';
import { isReducedMotion } from './utils/motion.js';
try { applyPersistedPalette(); } catch (_) {}
try { applyPersistedFontScale(); } catch (_) {}
try {
  // Apply reduce-motion class; also update when OS setting changes (for 'auto' mode)
  const _applyRmClass = () => document.documentElement.classList.toggle('reduce-motion', isReducedMotion());
  _applyRmClass();
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', _applyRmClass);
} catch (_) {}

// M205 rebalance: load active balance config as early as possible so
// module-eval-time reads in items.js / xp.js pick up the right values.
// Loader's embedded DEFAULTS match baseline-2026-04-21, so if fetch fails
// (offline, file missing) the game still boots with pre-rebalance numbers.
import { loadBalanceFromUrl } from './game/balance-loader.js';
try {
  // Fire-and-forget. Most game code re-reads balance on every call, so later
  // arrival is fine; the few module-eval captures (XP_TABLE, QUALITY_MULT)
  // already hold baseline values identical to what the fetch would supply.
  loadBalanceFromUrl(new URL('./data/balance/balance.active.json', document.baseURI).href);
} catch (_) {}
import { ScreenManager } from './engine/ScreenManager.js';
import { InputManager } from './engine/InputManager.js';
// M295 — Achievement unlock toast hook. achievements.js now fires showToast
// directly. This hook registers the "open achievements screen" callback so
// the toast tap routes the player to the right screen.
// (The old ev-ach-toast DOM-based system is retired; achievements.js handles
// all toast rendering via the shared toast helper.)
// Auth: initialize Supabase session early so OAuth hash fragments on '/' are
// parsed, sessions persist across reloads, and cloud saves work.
import { authManager } from './auth/authManager.js';
import { cloudSaves } from './auth/cloudSaves.js';
import { debug as _authDbg } from './utils/debug.js';
authManager.init().then(() => {
  let promptedForSession = null;
  // M336 — dedupe sync toast across refreshes. localStorage stores a digest
  // of the last surfaced sync result per user; if the next refresh produces
  // the same digest we suppress the toast (otherwise the user sees the same
  // "pulled 2, 2 conflicts" line on every page load).
  const SYNC_DIGEST_KEY = 'rsg_lastSyncDigest_v1';
  const _readDigest = () => { try { return JSON.parse(localStorage.getItem(SYNC_DIGEST_KEY) || '{}'); } catch (_) { return {}; } };
  const _writeDigest = (d) => { try { localStorage.setItem(SYNC_DIGEST_KEY, JSON.stringify(d)); } catch (_) {} };
  authManager.onChange(async (session, user) => {
    if (!user) { promptedForSession = null; return; }
    if (promptedForSession === user.id) return;
    promptedForSession = user.id;
    try {
      // M400 — pull lifetime stats from supabase before merging save slots,
      // so the in-game Stats panel shows the player's actual character/run
      // history right after sign-in (and after a hard refresh once the
      // session restores).
      try {
        const { pullLifeFromCloud } = await import('./game/stats.js');
        await pullLifeFromCloud();
      } catch (_) {}
      const r = await cloudSaves.mergeWithCloud();
      _authDbg.saves('sign-in merge', r);
      const parts = [];
      if (r.downloaded) parts.push(`pulled ${r.downloaded}`);
      if (r.uploaded) parts.push(`pushed ${r.uploaded}`);
      if (r.conflicts) parts.push(`${r.conflicts} conflict${r.conflicts===1?'':'s'} (kept newest)`);
      if (!parts.length) return;
      // Suppress when the SAME numbers landed for the same user recently —
      // typically: page refresh re-runs the merge, the cloud copies are
      // already local, but mergeWithCloud still reports them as "pulled
      // 2, 2 conflicts" because that's the last reconciliation result.
      const digest = _readDigest();
      const sig = `${r.downloaded || 0}:${r.uploaded || 0}:${r.conflicts || 0}`;
      const last = digest[user.id];
      const SUPPRESS_MS = 24 * 60 * 60 * 1000;            // 1 day
      if (last && last.sig === sig && (Date.now() - last.t) < SUPPRESS_MS) {
        return;
      }
      digest[user.id] = { sig, t: Date.now() };
      _writeDigest(digest);
      const msg = `Saves synced: ${parts.join(', ')}.`;
      try {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);background:#140a18;color:#f8d880;border:1px solid #e8a020;border-radius:6px;padding:0.7rem 1rem;font:0.8rem Inter,sans-serif;z-index:9800;box-shadow:0 4px 16px rgba(0,0,0,0.6)';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      } catch (_) { alert(msg); }
    } catch (e) { _authDbg.saves('sign-in merge error', { error: e.message }); }
  });
}).catch(e => console.warn('[auth] init failed:', e));
import { AudioManager } from './audio/AudioManager.js';
import { TitleScreen } from './ui/screens/TitleScreen.js';
// M65 — dev harness: expose window.__verifySkills() when debug flag on.
try {
  if (import.meta.env?.DEV || localStorage.getItem('emberveil_debug') === '1') {
    import('./game/skillVerify.js');
  }
} catch (_) {}
import { GameMenuScreen } from './ui/screens/GameMenuScreen.js';

// M128 — mod registry: optional-by-default. Exposes window.__emberveilMods for
// authors to load packs from the console. No packs auto-load yet.
import './mods/registry.js';
// M143 — bootstrap vanilla items/classes into the registry for schema inspection.
import { bootstrapVanilla } from './mods/vanillaBootstrap.js';
try { bootstrapVanilla(); } catch (e) { console.warn('[mods] vanilla bootstrap failed:', e); }

// M305 — register set info helper for getItemTooltip lazy lookup.
import { getActiveSetBonuses, SETS as _SETS305 } from './game/sets.js';
try {
  globalThis.__rsgSetInfo = (setId, equipment) => {
    if (!setId || !equipment) return null;
    const active = getActiveSetBonuses(equipment);
    return active.find(s => s.setId === setId) || null;
  };
  // Expose SETS for maybeDropSetItem (items.js lazy access).
  globalThis.__rsgSets = _SETS305;
} catch (_) {}

const canvas = document.getElementById('game-canvas');
const uiOverlay = document.getElementById('ui-overlay');

// Resize canvas to fill screen.
// M242/M250: pinch-zoom on mobile fires a 'resize' with the zoomed visual
// viewport, which re-scales the canvas to the zoomed rect and renders
// sprites pixelated. Fix: keep using window.innerWidth (which is reliable
// at page-load on every mobile browser), but suppress the resize when
// visualViewport.scale > 1 (the user is pinch-zoomed). M250 reverted the
// previous document.documentElement.clientWidth approach which returned
// 0 on some mobile browsers at init and caused a black-screen play.html.
function resize() {
  // If the user is pinch-zoomed, do nothing — keep the canvas at its
  // unzoomed dimensions so sprites don't rescale mid-interaction.
  const vv = window.visualViewport;
  if (vv && vv.scale > 1.01) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return; // extra guard for mobile browsers that briefly
                        // report 0 during orientation change
  canvas.width = w;
  canvas.height = h;
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
// If visualViewport exists, also listen for real layout changes (the
// 'resize' event on visualViewport fires on orientation + address-bar
// hide/show, which is a genuine layout change worth responding to).
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    // Only respond when not actively zoomed — the ordinary 'resize' path
    // already handles unzoomed changes, this is a safety net.
    if (window.visualViewport.scale <= 1.01) resize();
  });
}

// Core systems
const input = new InputManager(canvas, uiOverlay);
const audio = new AudioManager();
const screen = new ScreenManager(canvas, uiOverlay, input, audio);
// M392 — expose the screen manager for E2E smoke tests so they can push
// CombatScreen directly without grinding through the title/class/map flow.
if (typeof window !== 'undefined') window.__screenManager = screen;

// M72: unlock audio on the first user gesture to satisfy Chrome/Safari
// autoplay policy. Any music requested before unlock is queued by
// AudioManager and replayed here.
const _unlockAudio = () => {
  try { audio.unlock(); } catch (_) {}
  window.removeEventListener('pointerdown', _unlockAudio, true);
  window.removeEventListener('touchstart', _unlockAudio, true);
  window.removeEventListener('keydown', _unlockAudio, true);
  window.removeEventListener('mousedown', _unlockAudio, true);
};
window.addEventListener('pointerdown', _unlockAudio, { once: true, capture: true });
window.addEventListener('touchstart', _unlockAudio, { once: true, capture: true });
window.addEventListener('keydown', _unlockAudio, { once: true, capture: true });
window.addEventListener('mousedown', _unlockAudio, { once: true, capture: true });

// M295 — hook for achievement toast tap-to-open
import { AchievementsScreen } from './ui/screens/AchievementsScreen.js';
window._emberveilOpenAchievements = (_achId) => {
  try {
    // Do not open if already on the achievements screen
    const top = screen._stack[screen._stack.length - 1];
    if (top instanceof AchievementsScreen) return;
    screen.push(new AchievementsScreen(screen, audio));
  } catch (_) {}
};

// Boot to title
screen.push(new TitleScreen(screen, audio));

// Global ESC → open GameMenuScreen. Screens set `noGameMenuEsc = true` to opt out.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  const top = screen._stack[screen._stack.length - 1];
  if (!top || top.noGameMenuEsc) return;
  if (top instanceof GameMenuScreen) return; // let its own handler pop
  e.preventDefault();
  audio.playSfx('click');
  screen.push(new GameMenuScreen(screen, audio));
});

// Main loop
let last = 0;
function frame(ts) {
  const dt = Math.min((ts - last) / 1000, 0.1);
  last = ts;
  screen.update(dt);
  screen.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
