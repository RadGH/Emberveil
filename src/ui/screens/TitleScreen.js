/**
 * TitleScreen — Emberveil title with intro cinematic
 * Phase: clouds → logo drops from sky → main menu fades in
 */
import { CharacterBuilderScreen } from './CharacterBuilderScreen.js';
import { LoadGameScreen } from './LoadGameScreen.js';
import { SettingsScreen } from './SettingsScreen.js';
import { CombatSimulatorScreen } from './CombatSimulatorScreen.js';
import { FormulaCodexScreen } from './FormulaCodexScreen.js';
import { AchievementsScreen } from './AchievementsScreen.js';
import { createEl, removeEl } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { getNextFameThreshold } from '../../game/fame.js';
import { debug } from '../../utils/debug.js';
import { MILESTONE } from '../../version.js';
import { authManager, LOGIN_UI_DISABLED } from '../../auth/authManager.js';
import { isReducedMotion } from '../../utils/motion.js';

const PHASES = { CLOUDS: 0, LOGO_DROP: 1, MENU: 2 };

export class TitleScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this.phase = PHASES.CLOUDS;
    this.t = 0;
    this._el = null;
    this._particles = [];
    this._clouds = this._makeClouds();
    this._logoY = -200;
    this._logoAlpha = 0;
    this._menuAlpha = 0;
    this._menuVisible = false;
    this._bgImg = null;
    this._cloudsImg = null;   // retired (was clouds_06)
    this._cloudsImg2 = null;  // M236 mid parallax layer (clouds_08b)
    this._cloudsImg3 = null;  // M236 back parallax layer (clouds_08b, smaller scale)
    if (typeof window !== 'undefined' && !window.__gfxDisableBg) {
      const img = new Image();
      img.src = 'images/menu_bg/menu_wide.jpg';
      img.onload = () => { this._bgImg = img; };
      // M236: dual-layer parallax of clouds_08b.png — same image, different
      // scales/speeds, same drift direction, 0.65 alpha on both.
      const cimg2 = new Image();
      cimg2.src = 'images/menu_bg/clouds_08b.png';
      cimg2.onload = () => { this._cloudsImg2 = cimg2; };
      const cimg3 = new Image();
      cimg3.src = 'images/menu_bg/clouds_08b.png';
      cimg3.onload = () => { this._cloudsImg3 = cimg3; };
    }
  }

  _makeClouds() {
    const clouds = [];
    const h = (typeof window !== 'undefined' ? window.innerHeight : 800);
    const w = (typeof window !== 'undefined' ? window.innerWidth : 1200);
    // M213: 4 cloud instances (down from 12) for a single visible layer.
    for (let i = 0; i < 4; i++) {
      const y = Math.random() * h * 0.5;
      clouds.push({
        x: Math.random() * (w + 400) - 200,
        y,
        swayBase: y,
        swayPhase: Math.random() * Math.PI * 2,
        w: Math.random() * 300 + 250,
        h: Math.random() * 80 + 40,
        speed: Math.random() * 0.2 + 0.08,
        alpha: Math.random() * 0.25 + 0.25,
      });
    }
    return clouds;
  }

  _makeParticles(w, h) {
    const arr = [];
    for (let i = 0; i < 60; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.6 + 0.1),
        size: Math.random() * 2 + 0.5,
        alpha: Math.random(),
        life: Math.random(),
        maxLife: Math.random() * 0.5 + 0.3,
        color: ['#e8a020','#c04030','#f0c060','#ff6040'][Math.floor(Math.random()*4)],
      });
    }
    return arr;
  }

  onEnter() {
    // M400 — allow iOS Chrome pull-to-refresh on the title screen so the
    // user can hard-refresh after a deploy. Class is removed on exit so the
    // game viewport stays scroll-locked once they enter actual gameplay.
    document.documentElement.classList.add('allow-overscroll-refresh');
    this.audio.playTitleMusic();
    this._buildMenu();
    this._skipHandler = () => this._skipToMenu();
    this._keySkipHandler = () => this._skipToMenu();
    document.addEventListener('click', this._skipHandler);
    document.addEventListener('keydown', this._keySkipHandler);
    import('../../game/telemetry.js').then(mod => {
      if (!mod.hasAnsweredOptIn()) this._showTelemetryOptIn(mod);
    });
    // M298: Schedule What's New splash check for after menu phase completes.
    // We defer so the animation plays first.
    this._whatsNewPending = true;
  }

  _showTelemetryOptIn(mod) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="max-width:420px;background:#140a18;border:1px solid #e8a020;border-radius:6px;padding:1.25rem;color:#f0e8d8;font-family:Inter,sans-serif;font-size:0.82rem;line-height:1.45">
        <div style="font-family:'Cinzel',serif;color:#e8a020;font-size:1rem;margin-bottom:0.7rem">Help Balance Emberveil</div>
        <p style="margin:0 0 0.6rem 0">Share anonymous gameplay data so we can tune difficulty, buff weak classes, and fix overpowered spells.</p>
        <p style="margin:0 0 0.9rem 0;color:#c8b89c;font-size:0.75rem">No names, no email, no personal info. A random session ID and combat stats only. Change anytime in Settings. <a href="./assets/privacy.html" target="_blank" style="color:#e8a020">Full policy</a></p>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end">
          <button id="tel-no" style="background:transparent;border:1px solid rgba(232,160,32,0.4);color:#c8b89c;padding:0.5rem 0.9rem;border-radius:4px;cursor:pointer;font:inherit;font-size:0.75rem">No thanks</button>
          <button id="tel-yes" style="background:rgba(232,160,32,0.25);border:1px solid #e8a020;color:#e8a020;padding:0.5rem 0.9rem;border-radius:4px;cursor:pointer;font:inherit;font-size:0.75rem">Share anonymously</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (optIn) => { mod.setOptIn(optIn); window.__telemetryOptIn = optIn; overlay.remove(); };
    overlay.querySelector('#tel-yes').addEventListener('click', () => close(true));
    overlay.querySelector('#tel-no').addEventListener('click', () => close(false));
  }

  _skipToMenu() {
    if (this.phase === PHASES.MENU) return;
    this.phase = PHASES.MENU;
    this.t = 10; // ensure menu is fully visible
    this._logoY = this.manager.height * 0.35;
    this._logoAlpha = 1;
    this._menuAlpha = 1;
    if (this._el) {
      this._el.style.opacity = '1';
      this._el.style.pointerEvents = 'auto';
    }
    // Remove skip listeners after use
    document.removeEventListener('click', this._skipHandler);
    document.removeEventListener('keydown', this._keySkipHandler);
  }

  onPause()  { if (this._el) this._el.style.visibility = 'hidden'; this._paused = true; }
  onResume() {
    if (this._el) this._el.style.visibility = '';
    this._paused = false;
    // Rebuild menu so Settings changes (e.g. Combat Simulator toggle) reflect immediately.
    debug.reload();
    if (this._el && this.phase === PHASES.MENU) {
      const wasOpacity = this._el.style.opacity;
      const wasPE = this._el.style.pointerEvents;
      if (this._authUnsub) { try { this._authUnsub(); } catch (_) {} this._authUnsub = null; }
      removeEl(this._el);
      this._el = null;
      this._buildMenu();
      this._el.style.opacity = wasOpacity || '1';
      this._el.style.pointerEvents = wasPE || 'auto';
    }
  }

  _getNgPlusLabel() {
    try {
      const saves = SaveManager.listSaves();
      const maxNg = Math.max(0, ...saves.map(s => s.ngPlus || 0));
      if (maxNg > 0) return ` <span class="tm-ng-badge">✦ NG+${maxNg}</span>`;
    } catch (e) { /* no saves */ }
    return '';
  }

  /**
   * M308: Fame chip shown below the title — e.g. "Fame: 1,250 | Next: 2,000"
   * Reads from the highest-fame save. Returns '' when no saves exist.
   */
  _getFameBadge() {
    // M330 — fame is global since M327, so read from localStorage
    // (emberveil_fame_global_v1) instead of scanning saves. Hide entirely
    // when fame is 0; drop the misleading "Next: 2,000" copy because the
    // unlock model is per-appearance now, not threshold-tiered.
    try {
      let fame = 0;
      try {
        const raw = localStorage.getItem('emberveil_fame_global_v1');
        fame = raw == null ? 0 : Number(raw) || 0;
      } catch (_) {}
      if (fame <= 0) return '';
      return `<div class="tm-fame-chip">Fame: ${fame.toLocaleString('en-US')}</div>`;
    } catch (_) { return ''; }
  }

  _buildMenu() {
    const overlay = this.manager.uiOverlay;
    this._el = createEl('div', 'title-menu');
    this._el.innerHTML = `
      <div class="tm-user-card" id="tm-user-card"></div>
      <div class="title-menu-inner" id="tm-inner">
        <div class="tm-logo">EMBERVEIL</div>
        <div class="tm-subtitle">A Dark-Fantasy Party RPG</div>
        ${this._getFameBadge()}
        <nav class="tm-nav">
          <button type="button" class="tm-btn" id="btn-new-game">New Game</button>
          <button type="button" class="tm-btn" id="btn-load-game">Load Game</button>
          <button type="button" class="tm-btn tm-btn-secondary" id="btn-settings">Settings</button>
        </nav>
        <div class="tm-footer">© 2026 Radley Sustaire · M${MILESTONE}</div>
        <div class="tm-corner-links">
          <button type="button" class="tm-link" id="btn-codex">Codex</button>
          <button type="button" class="tm-link" id="btn-stats">Stats</button>
          <button type="button" class="tm-link" id="btn-achievements">Achievements</button>
          ${debug.flags.simulator ? `<button type="button" class="tm-link" id="btn-combat-sim">Combat Simulator</button>` : ''}
          <button type="button" class="tm-link" id="btn-feedback">Send Feedback</button>
          <button type="button" class="tm-link" id="btn-privacy">Privacy</button>
          <button type="button" class="tm-link" id="btn-website">Visit Website</button>
        </div>
      </div>
    `;
    this._el.style.opacity = '0';
    this._el.style.pointerEvents = 'none';
    overlay.appendChild(this._el);

    // M298: inject monument if fallen heroes exist
    this._buildMonument();

    this._el.querySelector('#btn-new-game').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new CharacterBuilderScreen(this.manager, this.audio));
    });
    this._el.querySelector('#btn-load-game').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new LoadGameScreen(this.manager, this.audio));
    });
    this._el.querySelector('#btn-codex').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new FormulaCodexScreen(this.manager, this.audio));
    });
    this._el.querySelector('#btn-stats')?.addEventListener('click', async () => {
      this.audio.playSfx('click');
      // M279: route the main-menu Stats link to the new chart-rich dashboard
      // (damage history + lifetime totals + per-character charts). Falls back
      // to the legacy StatsScreen if the dashboard is unavailable.
      try {
        const { StatsDashboardScreen } = await import('./StatsDashboardScreen.js');
        // M285: pass mode='main_menu' so the dashboard knows to show
        // cross-run analytics + hide tabs that need a live party.
        this.manager.push(new StatsDashboardScreen(this.manager, this.audio, { mode: 'main_menu' }));
      } catch (_) {
        const { StatsScreen } = await import('./StatsScreen.js');
        this.manager.push(new StatsScreen(this.manager, this.audio, { lifetimeOnly: true, tab: 'lifetime' }));
      }
    });
    this._el.querySelector('#btn-achievements')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new AchievementsScreen(this.manager, this.audio));
    });
    this._el.querySelector('#btn-settings').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new SettingsScreen(this.manager, this.audio));
    });
    this._el.querySelector('#btn-combat-sim')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.push(new CombatSimulatorScreen(this.manager, this.audio));
    });
    this._el.querySelector('#btn-feedback').addEventListener('click', () => {
      this.audio.playSfx('click');
      window.open('https://docs.google.com/forms/d/e/1FAIpQLScWHFEQ8Kbxvsxg5nKerJOPqkYntAkRLCihqQchypNdqayvmA/viewform?usp=publish-editor', '_blank', 'noopener');
    });
    this._el.querySelector('#btn-website').addEventListener('click', () => {
      this.audio.playSfx('click');
      const baseUrl = import.meta.env.BASE_URL || '/';
      window.location.href = baseUrl;
    });
    // M330 — Privacy policy link (lives at <BASE_URL>/privacy.html).
    this._el.querySelector('#btn-privacy').addEventListener('click', () => {
      this.audio.playSfx('click');
      const baseUrl = import.meta.env.BASE_URL || '/';
      window.open(`${baseUrl.replace(/\/$/, '')}/privacy.html`, '_blank', 'noopener');
    });

    this._injectStyles();
    this._wireUserCard();

    // M297: mount keyboard navigation on the title menu.
    // Escape on the title screen does nothing (noGameMenuEsc = true).
    kbMount(this._el, { layout: 'vertical', onEscape: null });
  }

  _wireUserCard() {
    const card = this._el && this._el.querySelector('#tm-user-card');
    if (!card) return;
    // M383 — vibe.jam kill switch. Hide the entire user card so no login
    // surface appears on the title menu. Auth remains wired up internally.
    if (LOGIN_UI_DISABLED) {
      card.innerHTML = '';
      card.style.display = 'none';
      return;
    }
    const render = () => {
      const u = authManager.user;
      if (!authManager.configured) {
        card.innerHTML = '';
        card.style.display = 'none';
        return;
      }
      card.style.display = '';
      if (u) {
        const email = u.email || u.user_metadata?.email || 'Signed in';
        // M242: stack email and Sign-out vertically so the long email doesn't
        // crowd the button on narrow viewports.
        card.innerHTML = `
          <div class="tm-user-stack" style="display:flex;flex-direction:column;gap:0.35rem;align-items:stretch">
            <span class="tm-user-email" title="${email}" style="font-size:0.72rem;color:#c0b090;word-break:break-all;line-height:1.2">${email}</span>
            <button type="button" class="tm-user-btn" id="tm-signout">Sign out</button>
          </div>`;
        card.querySelector('#tm-signout').addEventListener('click', async () => {
          this.audio.playSfx('click');
          await authManager.signOut();
        });
      } else {
        // M330 — collapse the three buttons into one. The unified modal
        // handles Sign In + Create Account + Continue with Google.
        card.innerHTML = `
          <div class="tm-user-title">Save your progress online</div>
          <div style="display:flex;flex-direction:column;gap:0.35rem">
            <button type="button" class="tm-user-btn" id="tm-signin-open">Sign In</button>
          </div>`;
        card.querySelector('#tm-signin-open').addEventListener('click', () => {
          this.audio.playSfx('click');
          this._openAuthModal('signin');
        });
      }
    };
    render();
    this._authUnsub = authManager.onChange(() => render());
  }

  /**
   * M330 — Unified Sign-In modal.
   * Single entry point that swaps between Sign In / Create Account modes via
   * a tab toggle, and offers Continue-with-Google as a button at the top.
   * Replaces the prior three-button title-card layout.
   */
  _openAuthModal(initialMode = 'signin') {
    let mode = initialMode === 'signup' ? 'signup' : 'signin';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
    const inputCss = 'padding:0.6rem 0.7rem;background:rgba(0,0,0,0.4);border:1px solid rgba(232,160,32,0.4);border-radius:4px;color:#f0e8d8;font:inherit;font-size:0.9rem;min-height:44px';
    const tabCss = (active) => `flex:1;padding:0.55rem;background:${active?'rgba(232,160,32,0.18)':'transparent'};border:1px solid ${active?'#e8a020':'rgba(232,160,32,0.25)'};color:${active?'#f8d880':'#c8b89c'};border-radius:4px;cursor:pointer;font:inherit;font-size:0.78rem;letter-spacing:0.04em;font-weight:${active?'700':'500'};min-height:44px`;
    const render = () => {
      const isSignup = mode === 'signup';
      overlay.innerHTML = `
        <div role="dialog" aria-modal="true" style="max-width:380px;width:100%;background:#140a18;border:1px solid #e8a020;border-radius:8px;padding:1.25rem;color:#f0e8d8;font-family:Inter,sans-serif">
          <div style="font-family:'Cinzel',serif;color:#e8a020;font-size:1.05rem;margin-bottom:0.85rem;text-align:center">Sign in to Emberveil</div>
          <button type="button" id="auth-google" style="width:100%;display:flex;align-items:center;justify-content:center;gap:0.5rem;background:#fff;color:#1a0a04;border:none;border-radius:4px;padding:0.6rem 0.9rem;cursor:pointer;font:inherit;font-weight:600;font-size:0.85rem;min-height:44px">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.97v2.33A8.99 8.99 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.97A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.97 4.05l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .97 4.95l3 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
            Continue with Google
          </button>
          <div style="display:flex;align-items:center;gap:0.6rem;margin:0.85rem 0;color:rgba(200,180,140,0.4);font-size:0.7rem">
            <div style="flex:1;height:1px;background:rgba(232,160,32,0.2)"></div>
            <span>or</span>
            <div style="flex:1;height:1px;background:rgba(232,160,32,0.2)"></div>
          </div>
          <div style="display:flex;gap:0.4rem;margin-bottom:0.75rem">
            <button type="button" id="auth-tab-signin" style="${tabCss(!isSignup)}">Sign In</button>
            <button type="button" id="auth-tab-signup" style="${tabCss(isSignup)}">Create Account</button>
          </div>
          <form id="auth-form" autocomplete="on" style="display:flex;flex-direction:column;gap:0.55rem">
            <input type="email" id="auth-email" placeholder="Email" autocomplete="email" required style="${inputCss}">
            <input type="password" id="auth-pass" placeholder="Password" autocomplete="${isSignup?'new-password':'current-password'}" required minlength="6" style="${inputCss}">
            ${isSignup ? `<input type="password" id="auth-pass2" placeholder="Confirm password" autocomplete="new-password" required minlength="6" style="${inputCss}">` : ''}
            <div id="auth-msg" style="font-size:0.75rem;color:rgba(255,180,140,0.9);min-height:1rem"></div>
            <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.3rem">
              <button type="button" id="auth-cancel" style="background:transparent;border:1px solid rgba(232,160,32,0.4);color:#c8b89c;padding:0.55rem 0.9rem;border-radius:4px;cursor:pointer;font:inherit;font-size:0.8rem;min-height:44px">Cancel</button>
              <button type="submit" id="auth-submit" style="background:rgba(232,160,32,0.4);border:1px solid #e8a020;color:#f8d880;padding:0.55rem 1rem;border-radius:4px;cursor:pointer;font:inherit;font-size:0.8rem;font-weight:600;min-height:44px">${isSignup?'Create Account':'Sign In'}</button>
            </div>
          </form>
        </div>`;
      // Wire fresh handlers each render (innerHTML wipes them).
      overlay.querySelector('#auth-cancel').addEventListener('click', close);
      overlay.querySelector('#auth-tab-signin').addEventListener('click', () => { mode = 'signin'; render(); });
      overlay.querySelector('#auth-tab-signup').addEventListener('click', () => { mode = 'signup'; render(); });
      overlay.querySelector('#auth-google').addEventListener('click', async () => {
        this.audio.playSfx('click');
        const { error } = await authManager.signInWithGoogle();
        if (error) {
          const msg = overlay.querySelector('#auth-msg');
          if (msg) msg.textContent = error.message || 'Google sign-in failed';
        }
      });
      const msg = overlay.querySelector('#auth-msg');
      overlay.querySelector('#auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        this.audio.playSfx('click');
        const email = overlay.querySelector('#auth-email').value.trim();
        const pass = overlay.querySelector('#auth-pass').value;
        const isSignupNow = mode === 'signup';
        if (isSignupNow) {
          const pass2 = overlay.querySelector('#auth-pass2').value;
          if (pass !== pass2) { msg.textContent = 'Passwords do not match.'; return; }
          msg.textContent = 'Creating account…';
          const { data, error } = await authManager.signUp(email, pass);
          if (error) { msg.textContent = error.message || 'Sign up failed'; return; }
          msg.textContent = data?.session ? 'Account created.' : `Check your inbox (${email}) for confirmation.`;
          if (data?.session) setTimeout(close, 500);
        } else {
          msg.textContent = 'Signing in…';
          const { error } = await authManager.signIn(email, pass);
          if (error) { msg.textContent = error.message || 'Sign in failed'; return; }
          close();
        }
      });
      setTimeout(() => overlay.querySelector('#auth-email')?.focus(), 50);
    };
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    render();
  }

  // M298 — Hardcore monument: shown on title screen when fallen heroes exist.
  _buildMonument() {
    let fallen = [];
    try {
      fallen = JSON.parse(localStorage.getItem('emberveil.fallenHeroes') || '[]');
    } catch (_) {}
    if (!fallen.length) return; // Manual #13: only render if at least one fallen hero

    // Inject monument styles once
    if (!document.getElementById('tm-monument-styles')) {
      const s = document.createElement('style');
      s.id = 'tm-monument-styles';
      s.textContent = `
        .tm-monument {
          position: fixed; left: 0.75rem; top: 50%;
          transform: translateY(-50%);
          max-width: 160px; min-width: 110px;
          background: rgba(8,4,14,0.72);
          border: 1px solid rgba(192,64,48,0.3);
          border-radius: 8px;
          padding: 0.7rem 0.75rem;
          font-family: 'Cinzel', Georgia, serif;
          color: rgba(240,232,216,0.7);
          z-index: 12;
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          max-height: 60vh; overflow: hidden;
          display: flex; flex-direction: column; gap: 0.35rem;
        }
        .tm-monument-title {
          font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(192,64,48,0.8); margin-bottom: 0.25rem; text-align: center;
          border-bottom: 1px solid rgba(192,64,48,0.2); padding-bottom: 0.3rem;
        }
        .tm-monument-scroll {
          overflow-y: auto; display: flex; flex-direction: column; gap: 0.25rem;
          -webkit-overflow-scrolling: touch; max-height: calc(60vh - 3rem);
        }
        .tm-monument-entry {
          font-size: 0.6rem; line-height: 1.35; color: rgba(240,232,216,0.55);
          cursor: pointer; padding: 0.2rem 0.25rem; border-radius: 4px;
          transition: background 0.12s;
        }
        .tm-monument-entry:hover { background: rgba(192,64,48,0.1); color: rgba(240,232,216,0.85); }
        .tm-monument-name { color: rgba(240,232,216,0.8); font-size: 0.62rem; }
        .tm-monument-footer {
          font-size: 0.55rem; text-align: center; color: rgba(240,232,216,0.3);
          border-top: 1px solid rgba(192,64,48,0.15); padding-top: 0.3rem; margin-top: 0.15rem;
        }
        /* Monument detail modal */
        .tm-monument-modal {
          position: fixed; inset: 0; background: rgba(0,0,0,0.78);
          z-index: 9300; display: flex; align-items: center; justify-content: center;
          padding: 1rem;
        }
        .tm-monument-box {
          max-width: 340px; width: 92%;
          background: #160a10; border: 1px solid rgba(192,64,48,0.5);
          border-radius: 10px; padding: 1.25rem 1.1rem 1rem;
          color: #f0e8d8; font-family: 'Cinzel', Georgia, serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        }
        .tm-monument-box-title { font-size: 1rem; color: rgba(192,64,48,0.9); margin-bottom: 0.5rem; }
        .tm-monument-box-row { font-family: 'Inter', sans-serif; font-size: 0.78rem; color: #c8b8a8; margin-bottom: 0.25rem; }
        .tm-monument-box-row span { color: #f0e8d8; }
        .tm-monument-box-actions { display: flex; gap: 0.5rem; margin-top: 1rem; justify-content: flex-end; }
        .tm-monument-btn {
          padding: 0.45rem 0.9rem; border-radius: 5px; font-family: 'Cinzel', Georgia, serif;
          font-size: 0.72rem; cursor: pointer; border: 1px solid;
        }
        .tm-monument-btn-close {
          background: rgba(240,232,216,0.06); border-color: rgba(240,232,216,0.2); color: #f0e8d8;
        }
        .tm-monument-btn-delete {
          background: rgba(192,64,48,0.12); border-color: rgba(192,64,48,0.4); color: #c04030;
        }
      `;
      document.head.appendChild(s);
    }

    const monEl = document.createElement('div');
    monEl.className = 'tm-monument';

    const ACT_NAMES = { 1: 'Act I', 2: 'Act II', 3: 'Act III', 4: 'Act IV', 5: 'Act V', 6: 'Act VI' };

    const listHtml = fallen.slice(-10).reverse().map((f, i) => `
      <div class="tm-monument-entry" data-fi="${i}" tabindex="0" role="button" aria-label="View ${f.heroName}">
        <div class="tm-monument-name">${f.heroName}</div>
        <div>${f.className || 'Hero'} Lv${f.level || '?'} &middot; ${ACT_NAMES[f.act] || 'Act ?'}</div>
      </div>
    `).join('');

    monEl.innerHTML = `
      <div class="tm-monument-title">Fallen Heroes</div>
      <div class="tm-monument-scroll">${listHtml}</div>
      <div class="tm-monument-footer">${fallen.length} fallen</div>
    `;

    this._el.appendChild(monEl);

    // Tap to show detail modal
    const reversedFallen = fallen.slice(-10).reverse();
    monEl.querySelectorAll('.tm-monument-entry').forEach((el, idx) => {
      const showDetail = () => {
        const f = reversedFallen[idx];
        if (!f) return;
        const modal = document.createElement('div');
        modal.className = 'tm-monument-modal';
        const dateStr = f.deathDate ? new Date(f.deathDate).toLocaleDateString() : 'Unknown date';
        modal.innerHTML = `
          <div class="tm-monument-box">
            <div class="tm-monument-box-title">${f.heroName}</div>
            <div class="tm-monument-box-row">Class: <span>${f.className || 'Hero'}</span></div>
            <div class="tm-monument-box-row">Level: <span>${f.level || '?'}</span></div>
            <div class="tm-monument-box-row">Fell in: <span>${ACT_NAMES[f.act] || 'Unknown'}</span></div>
            <div class="tm-monument-box-row">Gold at death: <span>${f.finalStats?.gold ?? '?'}</span></div>
            <div class="tm-monument-box-row">Party size: <span>${f.finalStats?.party ?? '?'}</span></div>
            <div class="tm-monument-box-row">Date: <span>${dateStr}</span></div>
            <div class="tm-monument-box-actions">
              <button type="button" class="tm-monument-btn tm-monument-btn-delete" id="mon-del">Delete Record</button>
              <button type="button" class="tm-monument-btn tm-monument-btn-close" id="mon-close">Close</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#mon-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        modal.querySelector('#mon-del').addEventListener('click', () => {
          try {
            const all = JSON.parse(localStorage.getItem('emberveil.fallenHeroes') || '[]');
            // Remove by matching name+deathDate
            const filtered = all.filter(h => !(h.heroName === f.heroName && h.deathDate === f.deathDate));
            localStorage.setItem('emberveil.fallenHeroes', JSON.stringify(filtered));
          } catch (_) {}
          modal.remove();
          // Rebuild monument
          const existing = this._el.querySelector('.tm-monument');
          if (existing) existing.remove();
          this._buildMonument();
        });
      };
      el.addEventListener('click', showDetail);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(); } });
    });
  }

  // M298 — What's New auto-splash on first boot after an update.
  // Conditions to show: lastSeenMilestone exists (not first install) AND is < current.
  // OR: no lastSeenMilestone but there IS save data (returning player who predates the feature).
  // Skip entirely if no save data + no lastSeenMilestone (fresh install).
  _maybeShowWhatsNewSplash() {
    try {
      const LS_KEY = 'emberveil.lastSeenMilestone';
      const current = typeof MILESTONE === 'number' ? MILESTONE : parseInt(MILESTONE, 10);
      const lastSeen = localStorage.getItem(LS_KEY);
      const lastSeenNum = lastSeen ? parseInt(lastSeen, 10) : null;

      // Determine if this is a returning player (has save data)
      let hasSaves = false;
      try {
        const saves = SaveManager.listSaves();
        hasSaves = saves && saves.length > 0;
      } catch (_) {}

      // First install with no saves and no lastSeen — skip
      if (lastSeenNum === null && !hasSaves) return;

      // Already seen this milestone — skip
      if (lastSeenNum !== null && lastSeenNum >= current) return;

      // Show the splash
      this._showWhatsNewSplash(current, lastSeenNum === null);
    } catch (_) {}
  }

  _showWhatsNewSplash(milestoneNum, isFirstTimeFeature) {
    if (this._whatsNewSplashEl) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9200;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cinzel,Georgia,serif';
    wrap.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="wns-title" style="max-width:400px;width:92%;background:#1a1218;border:1px solid rgba(232,160,32,0.6);border-radius:12px;padding:1.5rem 1.25rem 1.25rem;color:#f0e8d8;box-shadow:0 10px 40px rgba(0,0,0,0.6);max-height:80vh;overflow-y:auto">
        <div id="wns-title" style="font-size:1rem;color:#e8a020;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 0.25rem;text-align:center">Welcome Back to Emberveil</div>
        <div id="wns-meta" style="font-family:Inter,sans-serif;font-size:0.72rem;color:#8a7a6a;text-align:center;margin:0 0 0.9rem">M${milestoneNum} shipped</div>
        <div id="wns-body" style="font-family:Inter,sans-serif;font-size:0.84rem;line-height:1.55;color:#c8b8a8;margin:0 0 1.25rem;white-space:pre-wrap;word-break:break-word">Loading...</div>
        <a href="./assets/changelog.html" target="_blank" rel="noopener" style="display:block;text-align:center;color:#e8a020;font-size:0.76rem;text-decoration:underline;margin-bottom:1rem;font-family:Inter,sans-serif">Full changelog</a>
        <div style="display:flex;justify-content:center">
          <button type="button" id="wns-continue" style="padding:0.75rem 2rem;background:rgba(232,160,32,0.22);border:1px solid rgba(232,160,32,0.75);color:#f8d880;font-family:Cinzel,Georgia,serif;font-size:0.9rem;font-weight:600;letter-spacing:0.08em;border-radius:6px;cursor:pointer;min-height:44px">Continue</button>
        </div>
      </div>
    `;
    this._whatsNewSplashEl = wrap;
    document.body.appendChild(wrap);

    const dismiss = () => {
      try {
        localStorage.setItem('emberveil.lastSeenMilestone', String(milestoneNum));
      } catch (_) {}
      if (this._whatsNewSplashEl) {
        try { this._whatsNewSplashEl.remove(); } catch (_) {}
        this._whatsNewSplashEl = null;
      }
    };

    wrap.querySelector('#wns-continue').addEventListener('click', () => {
      this.audio.playSfx('click');
      dismiss();
    });
    wrap.addEventListener('click', e => { if (e.target === wrap) { this.audio.playSfx('click'); dismiss(); } });

    // Fetch release summary (includes breakingChanges since M313)
    fetch('./assets/release-summary.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!this._whatsNewSplashEl) return;
        const metaEl = this._whatsNewSplashEl.querySelector('#wns-meta');
        const bodyEl = this._whatsNewSplashEl.querySelector('#wns-body');
        if (data && data.summary) {
          if (metaEl) metaEl.textContent = `M${data.milestone || milestoneNum}${data.date ? '  ·  ' + data.date : ''}`;
          if (bodyEl) {
            bodyEl.textContent = data.summary;
            // Render migration notes section if breakingChanges present
            const bc = Array.isArray(data.breakingChanges) ? data.breakingChanges.filter(Boolean) : [];
            if (bc.length && bodyEl) {
              const migDiv = document.createElement('div');
              migDiv.style.cssText = 'margin-top:1rem;padding:0.6rem 0.75rem;background:rgba(192,64,48,0.1);border:1px solid rgba(192,64,48,0.35);border-radius:6px;';
              const migTitle = document.createElement('div');
              migTitle.style.cssText = 'font-family:Cinzel,Georgia,serif;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:#e07060;margin-bottom:0.4rem;';
              migTitle.textContent = 'Migration Notes';
              migDiv.appendChild(migTitle);
              const migList = document.createElement('ul');
              migList.style.cssText = 'margin:0;padding:0 0 0 1rem;list-style:disc;';
              for (const note of bc) {
                const li = document.createElement('li');
                li.style.cssText = 'font-family:Inter,sans-serif;font-size:0.78rem;color:#c8b8a8;line-height:1.5;margin-bottom:0.2rem;';
                li.textContent = note;
                migList.appendChild(li);
              }
              migDiv.appendChild(migList);
              bodyEl.parentNode.insertBefore(migDiv, bodyEl.nextSibling);
            }
          }
        } else {
          if (bodyEl) bodyEl.textContent = 'See changelog for full release notes.';
        }
      })
      .catch(() => {
        if (!this._whatsNewSplashEl) return;
        const bodyEl = this._whatsNewSplashEl.querySelector('#wns-body');
        if (bodyEl) bodyEl.textContent = 'See changelog for full release notes.';
      });

    setTimeout(() => { try { wrap.querySelector('#wns-continue').focus(); } catch (_) {} }, 50);
  }

  _injectStyles() {
    if (document.getElementById('title-screen-styles')) return;
    const s = document.createElement('style');
    s.id = 'title-screen-styles';
    const bgImg = '';
    const bgImgSquare = '';
    s.textContent = `
      .title-menu {
        position: absolute;
        top: 0; left: 0; right: 0;
        width: 100%;
        height: 100%;
        min-height: 100%;
        max-width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem 1rem;
        box-sizing: border-box;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        transition: opacity 0.5s ease;
        pointer-events: none;
        ${bgImg}
      }
      @media (max-aspect-ratio: 1/1) {
        .title-menu { ${bgImgSquare} }
      }
      .title-menu::before {
        content: '';
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        opacity: 0.35;
        mix-blend-mode: screen;
        pointer-events: none;
      }
      .title-menu-inner { pointer-events: auto; }
      .title-menu-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        margin-block: auto;
      }
      .tm-logo {
        font-family: 'Cinzel', Georgia, serif;
        font-weight: 900;
        font-size: clamp(2.2rem, 11vw, 5rem);
        letter-spacing: 0.08em;
        background: linear-gradient(180deg, #f8d880 0%, #e8a020 40%, #c04030 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.85)) drop-shadow(0 1px 2px rgba(0,0,0,0.95));
        margin-bottom: 0.75rem;
        line-height: 1;
      }
      .tm-subtitle {
        font-size: 0.85rem;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: rgba(240,232,216,0.92);
        margin-bottom: 1.25rem;
        font-family: 'Cinzel', Georgia, serif;
        text-shadow: 0 3px 8px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95);
      }
      .tm-ng-badge {
        display: inline-block;
        margin-left: 0.6em;
        color: #ffd700;
        font-size: 0.75rem;
        letter-spacing: 0.1em;
        vertical-align: middle;
      }
      .tm-fame-chip {
        display: inline-block;
        margin-top: -0.6rem;
        margin-bottom: 0.9rem;
        padding: 0.22rem 0.7rem;
        background: rgba(232,120,16,0.15);
        border: 1px solid rgba(232,120,16,0.3);
        border-radius: 20px;
        font-family: 'Cinzel', Georgia, serif;
        font-size: 0.78rem;
        font-weight: 700;
        /* M337 — same color as the .tm-subtitle copy ("A Dark-Fantasy Party
           RPG") so it reads cleanly against the menu_bg art. The previous
           muted #c09050 vanished into the dusk palette. */
        color: rgba(240,232,216,0.85);
        letter-spacing: 0.06em;
        text-shadow: 0 3px 8px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95);
      }
      .tm-fame-next {
        opacity: 0.65;
        font-weight: 400;
      }
      .tm-nav {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        align-items: center;
        width: 220px;
      }
      .tm-btn {
        width: 100%;
        padding: 0.85rem 2rem;
        background: rgba(232,160,32,0.33);
        border: 1px solid rgba(232,160,32,0.6);
        border-radius: 6px;
        color: #f0e8d8;
        font-family: 'Cinzel', Georgia, serif;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s, transform 0.15s;
        min-height: 48px;
      }
      .tm-btn:hover {
        background: rgba(232,160,32,0.45);
        border-color: rgba(232,160,32,0.9);
        transform: translateY(-1px);
      }
      .tm-btn:active { transform: translateY(0); }
      .tm-btn:focus-visible { outline: 2px solid #f8d880; outline-offset: 3px; }
      .tm-btn-secondary {
        background: rgba(255,255,255,0.18);
        border-color: rgba(255,255,255,0.35);
        color: rgba(240,232,216,0.9);
        font-size: 0.8rem;
      }
      .tm-btn-secondary:hover {
        background: rgba(255,255,255,0.3);
        border-color: rgba(255,255,255,0.55);
        color: #f0e8d8;
      }
      .tm-footer {
        margin-top: 2.5rem;
        font-size: 0.65rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(240,232,216,0.85);
        text-shadow: 0 3px 8px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95);
      }
      .tm-corner-links {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.4rem;
        z-index: 10;
      }
      /* M329 — On mobile the right-aligned column was spaced way out and felt
         scattered. Lay the links out as a centered horizontal row along the
         bottom of the screen instead, with safe-area padding for iPhone. */
      @media (max-width: 600px) {
        .tm-corner-links {
          left: 0; right: 0; bottom: 0;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.15rem 0.85rem;
          padding: 0.45rem 0.6rem calc(0.45rem + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%);
        }
        .tm-link { font-size: 0.72rem; padding: 0.35rem 0.5rem; min-height: 32px; }
      }
      .tm-link {
        background: none;
        border: none;
        color: rgba(240,232,216,0.45);
        font-family: 'Cinzel', Georgia, serif;
        font-size: 0.7rem;
        letter-spacing: 0.06em;
        cursor: pointer;
        padding: 0.2rem 0.4rem;
        transition: color 0.2s;
        text-shadow: 0 2px 6px rgba(0,0,0,0.8);
      }
      .tm-link:hover {
        color: rgba(232,160,32,0.9);
        text-decoration: underline;
      }
      .tm-user-card {
        position: fixed;
        top: 0.75rem;
        right: 0.75rem;
        max-width: 240px;
        padding: 0.55rem 0.7rem;
        background: rgba(10,6,16,0.25);
        border: 1px solid rgba(232,160,32,0.18);
        border-radius: 8px;
        color: rgba(240,232,216,0.9);
        font-family: 'Cinzel', Georgia, serif;
        font-size: 0.72rem;
        letter-spacing: 0.04em;
        z-index: 11;
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        text-shadow: 0 2px 6px rgba(0,0,0,0.8);
      }
      .tm-user-card button:focus-visible { outline: 2px solid #f8d880; outline-offset: 2px; }
      .tm-user-title {
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(240,232,216,0.8);
        margin-bottom: 0.4rem;
      }
      .tm-user-form { display: flex; flex-direction: column; gap: 0.35rem; }
      .tm-user-input {
        width: 100%;
        padding: 0.4rem 0.5rem;
        background: rgba(0,0,0,0.35);
        border: 1px solid rgba(232,160,32,0.3);
        border-radius: 4px;
        color: #f0e8d8;
        font-size: 0.8rem;
        box-sizing: border-box;
      }
      .tm-user-input:focus { outline: none; border-color: rgba(232,160,32,0.8); }
      .tm-user-row { display: flex; gap: 0.4rem; align-items: center; justify-content: space-between; }
      .tm-user-email {
        font-size: 0.75rem;
        color: rgba(240,232,216,0.9);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 160px;
      }
      .tm-user-btn {
        padding: 0.35rem 0.6rem;
        background: rgba(232,160,32,0.18);
        border: 1px solid rgba(232,160,32,0.55);
        border-radius: 4px;
        color: #f0e8d8;
        font-family: inherit;
        font-size: 0.7rem;
        letter-spacing: 0.06em;
        cursor: pointer;
        min-height: 28px;
      }
      .tm-user-btn:hover { background: rgba(232,160,32,0.3); }
      .tm-user-btn-alt {
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.25);
      }
      .tm-user-btn-alt:hover { background: rgba(255,255,255,0.12); }
      .tm-user-msg {
        font-size: 0.7rem;
        color: rgba(255,180,140,0.9);
        min-height: 0.9rem;
      }
    `;
    document.head.appendChild(s);
  }

  update(dt) {
    this.t += dt;
    const w = this.manager.width;
    const h = this.manager.height;

    // Update clouds always
    for (const c of this._clouds) {
      c.x -= c.speed;
      if (c.x + c.w < -100) c.x = w + 100;
    }

    // Update particles
    if (!this._particles.length) this._particles = this._makeParticles(w, h);
    for (const p of this._particles) {
      p.life -= dt * 0.5;
      if (p.life <= 0) {
        p.x = Math.random() * w;
        p.y = h + 10;
        p.life = p.maxLife;
      }
      p.x += p.vx;
      p.y += p.vy;
    }

    // M312 #17: skip CLOUDS and LOGO_DROP phases — go straight to MENU with a
    // short opacity fade-in. No slide-down intro, no delays.
    if (this.phase === PHASES.CLOUDS || this.phase === PHASES.LOGO_DROP) {
      this.phase = PHASES.MENU;
      this.t = 0;
    }

    if (this.phase === PHASES.MENU) {
      // Brief 0.35s opacity fade instead of the old 0.5s slide sequence
      this._menuAlpha = Math.min(this.t / 0.35, 1);
      if (this._el) {
        this._el.style.opacity = this._menuAlpha;
        this._el.style.pointerEvents = this._menuAlpha >= 1 ? 'auto' : 'none';
      }
      // M298: show What's New splash once menu is fully visible
      if (this._whatsNewPending && this._menuAlpha >= 1) {
        this._whatsNewPending = false;
        this._maybeShowWhatsNewSplash();
      }
    }
  }

  draw(ctx) {
    if (this._paused) return;
    const w = this.manager.width;
    const h = this.manager.height;

    // Sky gradient — dark to lighter at horizon
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#050208');
    sky.addColorStop(0.4, '#0d0810');
    sky.addColorStop(0.7, '#1a1025');
    sky.addColorStop(1, '#2a1830');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Menu background image — visible from frame 0, behind everything
    if (this._bgImg && !window.__gfxDisableBg) {
      ctx.save();
      const img = this._bgImg;
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.restore();
    }

    // Stars — M46: use per-session RNG so scatter changes on every title load
    if (!this._starPositions) {
      this._starPositions = Array.from({ length: 80 }, () => ({
        fx: Math.random(),
        fy: Math.random() * 0.65,
        fa: Math.random() * 0.8 + 0.2,
      }));
    }
    ctx.save();
    const starAlpha = this.phase === PHASES.CLOUDS ? Math.max(0, 1 - this.t / 1.5) : (this.phase === PHASES.LOGO_DROP ? Math.max(0, 1 - this.t) : 0.3);
    for (let i = 0; i < 80; i++) {
      const p = this._starPositions[i];
      const sx = p.fx * w;
      const sy = p.fy * h;
      const sa = p.fa;
      ctx.globalAlpha = sa * starAlpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // M236: dual-layer parallax of clouds_08b — same direction, different
    // scale + speed, 0.65α on both. Back layer (img3) is smaller + higher +
    // slower; mid layer (img2) is larger + mid + faster.
    // M296: skip parallax if reduce-motion is active
    if (!window.__gfxDisableBg && !isReducedMotion()) {
      const tMs = this.t * 1000;
      const drawStripLayer = (img, speed, yBand, heightFrac, alpha) => {
        if (!img) return;
        ctx.save();
        const iw = img.width;
        const ih = img.height;
        const targetH = h * heightFrac;
        const scale = targetH / ih;
        const dw = iw * scale;
        const dh = ih * scale;
        // M242 fix: in-game seam was visible because we only drew 2 tiles,
        // so if the scaled cloud strip was narrower than the viewport the
        // right edge of the second tile exposed. Tile across the full width
        // (+1 extra for the wrap) and offset by modulo.
        const x = -((tMs * speed) % dw);
        const tileCount = Math.ceil(w / dw) + 2;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < tileCount; i++) {
          ctx.drawImage(img, Math.floor(x + i * dw), Math.floor(yBand), Math.ceil(dw) + 1, dh);
        }
        ctx.restore();
      };
      // Back layer: smaller, higher, slower.
      drawStripLayer(this._cloudsImg3, 0.010, Math.floor(h * 0.04), 0.24, 0.65);
      // Mid layer: larger, lower, faster (same direction).
      // M312 #18: reduce heightFrac from 0.38 → 0.32 so the bottom edge of
      // the cloud strip doesn't creep past the menu boundary by 1px.
      drawStripLayer(this._cloudsImg2, 0.022, Math.floor(h * 0.18), 0.32, 0.65);
    }

    // Particles (embers)
    ctx.save();
    for (const p of this._particles) {
      const a = (p.life / p.maxLife) * 0.7;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // LOGO — "EMBERVEIL" (canvas-drawn during CLOUDS/LOGO_DROP only; DOM takes over at MENU)
    if (this.phase === PHASES.LOGO_DROP) {
      ctx.save();
      ctx.globalAlpha = this._logoAlpha;

      const fontSize = Math.min(w * 0.13, 80);
      ctx.font = `900 ${fontSize}px Cinzel, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      const halfH = fontSize * 0.6;
      const grad = ctx.createLinearGradient(0, this._logoY - halfH, 0, this._logoY + halfH);
      grad.addColorStop(0,   '#f8d880');
      grad.addColorStop(0.4, '#e8a020');
      grad.addColorStop(1,   '#c04030');
      ctx.fillStyle = grad;
      ctx.fillText('EMBERVEIL', w/2, this._logoY);

      ctx.fillStyle = '#f8d880';
      ctx.globalAlpha = this._logoAlpha * 0.3;
      ctx.fillText('EMBERVEIL', w/2, this._logoY - 1);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.restore();
    }
  }

  onExit() {
    // M400 — re-lock the viewport now that the player is leaving the title.
    document.documentElement.classList.remove('allow-overscroll-refresh');
    document.removeEventListener('click', this._skipHandler);
    document.removeEventListener('keydown', this._keySkipHandler);
    if (this._authUnsub) { try { this._authUnsub(); } catch (_) {} this._authUnsub = null; }
    if (this._el) kbUnmount(this._el);
    removeEl(this._el);
    this._el = null;
    // M298: clean up what's new splash if still visible
    if (this._whatsNewSplashEl) { try { this._whatsNewSplashEl.remove(); } catch (_) {} this._whatsNewSplashEl = null; }
  }

  destroy() {
    document.documentElement.classList.remove('allow-overscroll-refresh');
    document.removeEventListener('click', this._skipHandler);
    document.removeEventListener('keydown', this._keySkipHandler);
    if (this._authUnsub) { try { this._authUnsub(); } catch (_) {} this._authUnsub = null; }
    if (this._el) kbUnmount(this._el);
    removeEl(this._el);
    this._el = null;
    if (this._whatsNewSplashEl) { try { this._whatsNewSplashEl.remove(); } catch (_) {} this._whatsNewSplashEl = null; }
  }
}
