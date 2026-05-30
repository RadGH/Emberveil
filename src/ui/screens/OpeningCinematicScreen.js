/**
 * OpeningCinematicScreen — shown once per new game
 * Scrolling text + canvas background, fades into town
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';

const STORY_TEXT = [
  { delay: 0.5,  text: 'The world did not end all at once.', font: 'epic' },
  { delay: 2.5,  text: 'It unraveled.', font: 'whisper' },
  { delay: 5.0,  text: 'Three years ago, something tore through the fabric between realms — a wound that festered and spread, corrupting everything it touched.', font: 'narration' },
  { delay: 10.0, text: 'They called it the Emberveil.', font: 'title' },
  { delay: 13.5, text: 'The border settlements fell first. Goblins, wolves, even the ancient stones of the road — all changed, driven by a single will from beyond.', font: 'narration' },
  { delay: 20.0, text: 'You arrived in Emberglen with little more than your skills and a rumor: someone is controlling the corruption. Someone — or something — with a purpose.', font: 'narration' },
  { delay: 28.0, text: 'If the Emberveil spreads to the capital, there will be nothing left to save.', font: 'warning' },
  { delay: 34.0, text: 'Your journey begins here.', font: 'epic' },
];

export class OpeningCinematicScreen {
  constructor(manager, audio, onComplete) {
    this.manager = manager;
    this.audio = audio;
    this.onComplete = onComplete;
    this.noGameMenuEsc = true;
    this._el = null;
    this._t = 0;
    this._phase = 'FADE_IN'; // FADE_IN | TEXT | FADE_OUT
    this._skipPressed = false;
  }

  onEnter() {
    this._build();
    try { this.audio?.playIntroMusic?.(); } catch(_) {}
  }

  _build() {
    injectStyles('cinematic-styles', CINEMATIC_STYLES);
    this._el = createEl('div', 'cinematic-screen');
    this._el.innerHTML = `
      <div class="cin-bg"></div>
      <div class="cin-cloud cin-cloud-1"></div>
      <div class="cin-cloud cin-cloud-2"></div>
      <div class="cin-cloud cin-cloud-3"></div>
      <div class="cin-vignette"></div>
      <canvas class="cin-canvas" id="cin-canvas"></canvas>
      <div class="cin-overlay" id="cin-overlay">
        <div class="cin-content" id="cin-content"></div>
        <div class="cin-skip" id="cin-skip">Tap to skip</div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);

    const canvas = this._el.querySelector('#cin-canvas');
    canvas.width = this.manager.width;
    canvas.height = this.manager.height;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');

    this._el.querySelector('#cin-skip').addEventListener('click', () => {
      this._skipPressed = true;
      this._finish();
    });

    this._totalDuration = STORY_TEXT[STORY_TEXT.length - 1].delay + 4.0;
  }

  update(dt) {
    this._t += dt;
    this._drawBackground();

    if (this._skipPressed) return;

    const overlay = this._el?.querySelector('#cin-overlay');
    if (!overlay) return;

    // Global fade in/out
    if (this._t < 1.0) {
      overlay.style.opacity = this._t;
    } else if (this._t > this._totalDuration - 1.5) {
      overlay.style.opacity = Math.max(0, 1 - (this._t - (this._totalDuration - 1.5)) / 1.5);
    } else {
      overlay.style.opacity = 1;
    }

    // Update visible text lines
    const content = this._el?.querySelector('#cin-content');
    if (!content) return;

    let html = '';
    for (const line of STORY_TEXT) {
      if (this._t >= line.delay) {
        const age = this._t - line.delay;
        const fadeIn = Math.min(1, age / 0.8);
        const fadeOut = line.delay < STORY_TEXT[STORY_TEXT.length - 1].delay
          ? Math.max(0, 1 - (age - 5.0) / 1.5)
          : 1;
        const alpha = Math.min(fadeIn, fadeOut);
        if (alpha > 0) {
          html += `<p class="cin-line cin-${line.font || 'narration'}" style="opacity:${alpha.toFixed(3)}">${line.text}</p>`;
        }
      }
    }
    content.innerHTML = html;

    if (this._t >= this._totalDuration) {
      this._finish();
    }
  }

  _drawBackground() {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    // Clear — background image + cloud parallax are DOM layers underneath
    ctx.clearRect(0, 0, w, h);

    // Stars (drawn above the image for atmosphere)
    ctx.save();
    const starCount = 80;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    // Use deterministic positions based on index
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 137.508) % 1) * w;
      const sy = ((i * 97.3) % 1) * h * 0.65;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(this._t * 0.8 + i));
      ctx.globalAlpha = twinkle * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Ember particles drifting up from horizon
    const emberCount = 12;
    for (let i = 0; i < emberCount; i++) {
      const ex = ((i * 71.3 + this._t * 8) % 1) * w;
      const baseY = h * 0.85;
      const ey = baseY - ((this._t * 25 + i * 40) % (h * 0.5));
      if (ey < 0) continue;
      const alpha = Math.max(0, 1 - ey / (h * 0.5));
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = `hsl(${20 + (i * 13) % 30}, 90%, 60%)`;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _finish() {
    if (this._finished) return;
    this._finished = true;
    GameState.setFlag('opening_seen', true);
    if (this.onComplete) this.onComplete();
    else this.manager.pop();
  }

  draw() {} // Canvas drawn in update()
  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { removeEl(this._el); this._el = null; }
}

const CINEMATIC_STYLES = `
.cinematic-screen {
  position: absolute; inset: 0;
  font-family: 'Inter', sans-serif;
}
.cin-canvas {
  position: absolute; inset: 0; width: 100%; height: 100%;
  z-index: 4;
}
.cin-bg {
  position: absolute; inset: 0;
  background-image: url('images/map_bg/shattered_core.jpg');
  background-size: cover; background-position: center;
  filter: brightness(0.55) saturate(0.85);
  z-index: 0;
}
.cin-vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%),
              linear-gradient(180deg, rgba(3,2,8,0.55) 0%, rgba(9,5,18,0.35) 50%, rgba(3,2,8,0.75) 100%);
  z-index: 3; pointer-events: none;
}
.cin-cloud {
  position: absolute; left: -20%; right: -20%; height: 100%;
  background-repeat: repeat-x;
  background-size: auto 100%;
  opacity: 0.35; pointer-events: none;
  mix-blend-mode: screen;
}
.cin-cloud-1 {
  background-image: url('images/menu_bg/clouds_01.jpg');
  z-index: 1; opacity: 0.22;
  animation: cin-drift-1 90s linear infinite;
}
.cin-cloud-2 {
  background-image: url('images/menu_bg/clouds_02.jpg');
  z-index: 2; opacity: 0.28;
  animation: cin-drift-2 60s linear infinite;
}
.cin-cloud-3 {
  background-image: url('images/menu_bg/clouds_03.jpg');
  z-index: 2; opacity: 0.18;
  animation: cin-drift-3 120s linear infinite;
}
@keyframes cin-drift-1 { from { transform: translateX(0); } to { transform: translateX(-25%); } }
@keyframes cin-drift-2 { from { transform: translateX(-10%); } to { transform: translateX(15%); } }
@keyframes cin-drift-3 { from { transform: translateX(10%); } to { transform: translateX(-20%); } }
.cin-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 3rem 2rem;
  transition: opacity 0.3s;
  z-index: 5;
}
.cin-content {
  max-width: 520px; text-align: center;
  display: flex; flex-direction: column; gap: 1.2rem;
}
.cin-line {
  font-size: clamp(0.9rem, 2.5vw, 1.15rem); line-height: 1.75;
  color: #e0d8c8; text-shadow: 0 0 20px rgba(200,80,20,0.4);
  transition: opacity 0.8s;
  font-style: italic;
}
/* Intentionally no :first-child override — as earlier lines fade out and
   the first DOM child changes, a :first-child rule would retroactively
   restyle the next line and look like the font was changing mid-scroll. */
.cin-epic { font-family: 'Cinzel', serif; font-weight: 900; font-style: normal;
  font-size: clamp(1.1rem, 3.2vw, 1.5rem); color: #f4ead0; letter-spacing: 0.04em;
  text-shadow: 0 0 30px rgba(232,160,32,0.55); }
.cin-whisper { font-family: 'Cinzel', serif; font-weight: 400; font-style: italic;
  color: #b8a890; letter-spacing: 0.08em;
  text-shadow: 0 0 18px rgba(80,40,20,0.55); }
.cin-title { font-family: 'Cinzel', serif; font-weight: 900; font-style: normal;
  font-size: clamp(1.25rem, 3.6vw, 1.7rem); color: #ffd078; letter-spacing: 0.06em;
  text-shadow: 0 0 36px rgba(232,80,20,0.7); }
.cin-warning { font-family: 'Inter', sans-serif; font-weight: 600; font-style: normal;
  color: #f0a878; text-shadow: 0 0 22px rgba(192,64,32,0.65); }
.cin-narration { /* default */ }
.cin-skip {
  position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%);
  font-size: 0.7rem; color: rgba(240,232,216,0.3); letter-spacing: 0.12em;
  cursor: pointer; padding: 0.5rem 1rem;
}
.cin-skip:hover { color: rgba(240,232,216,0.6); }
`;
