/**
 * StoryOpeningCinematicScreen — Per-storyteller opening cinematic for Story Mode.
 *
 * Mirrors OpeningCinematicScreen structure exactly: canvas background, timed
 * text lines, fade in/out, tap-to-skip. Each of the 6 storytellers has a
 * unique 5-8 line STORY_TEXT array voiced in their personality.
 *
 * Flow:
 *   CharacterBuilderScreen accept → this → (onComplete) → StoryMapScreen
 *
 * No "back" route — once cinematic starts, the Story save already exists.
 * noGameMenuEsc = true prevents Esc from popping to title.
 */

import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';

// ---------------------------------------------------------------------------
// Per-storyteller text lines
// ---------------------------------------------------------------------------

const STORYTELLER_TEXT = {
  chronicler: [
    { delay: 0.5,  text: 'Every great journey begins in the margins of someone else\'s history.', font: 'whisper' },
    { delay: 4.0,  text: 'I have read a thousand accounts of the Emberveil. None of them end well.', font: 'narration' },
    { delay: 9.5,  text: 'But patterns emerge from the ruins — names, places, choices that bent the arc of fate.', font: 'narration' },
    { delay: 16.0, text: 'Your name is not yet in any of my records.', font: 'epic' },
    { delay: 20.5, text: 'That is either a grave omission — or an opportunity.', font: 'whisper' },
    { delay: 25.0, text: 'Let us find out which.', font: 'epic' },
  ],

  ash_prophet: [
    { delay: 0.5,  text: 'I have seen this day in the embers. Again. And again.', font: 'warning' },
    { delay: 4.5,  text: 'The Emberveil does not merely corrupt — it completes something that was always already broken.', font: 'narration' },
    { delay: 11.0, text: 'Three omens have already passed you unnoticed.', font: 'epic' },
    { delay: 15.0, text: 'The fourth will not be so polite.', font: 'warning' },
    { delay: 19.0, text: 'I cannot change what is written in ash. But perhaps you can smudge it.', font: 'narration' },
    { delay: 26.0, text: 'Walk carefully. The ground here remembers everything.', font: 'whisper' },
  ],

  warbringer: [
    { delay: 0.5,  text: 'The Emberveil wants war. Fine.', font: 'epic' },
    { delay: 4.0,  text: 'Three armies broke against it in the first year. They held back.', font: 'narration' },
    { delay: 9.0,  text: 'You will not hold back.', font: 'epic' },
    { delay: 12.5, text: 'Every corrupted creature, every champion the Veil throws at you — they are tests.', font: 'narration' },
    { delay: 19.0, text: 'The Sovereign grows stronger each time something weaker than it falls.', font: 'warning' },
    { delay: 24.0, text: 'Do not be weaker than it.', font: 'epic' },
    { delay: 28.0, text: 'Now move. The enemy is already moving.', font: 'warning' },
  ],

  trickster: [
    { delay: 0.5,  text: 'Oh good. Another hero. Exactly what the prophecy ordered.', font: 'whisper' },
    { delay: 5.0,  text: 'I won\'t spoil anything. That would ruin the fun.', font: 'narration' },
    { delay: 9.5,  text: 'What I will tell you: the obvious path is never the right one. The obvious ally is never fully trustworthy.', font: 'narration' },
    { delay: 17.0, text: 'And the thing calling itself the Sovereign?', font: 'epic' },
    { delay: 21.0, text: 'It is exactly as clever as it thinks it is. Which is your advantage.', font: 'whisper' },
    { delay: 27.0, text: 'Pay attention to the wrong things. That\'s where I hide the good stuff.', font: 'narration' },
  ],

  pilgrim: [
    { delay: 0.5,  text: 'No one survives the Emberveil alone. I want you to understand that from the start.', font: 'narration' },
    { delay: 7.0,  text: 'The people you meet — the ones you choose to stand beside — they are the story.', font: 'epic' },
    { delay: 13.0, text: 'Factions rise and fall. Ancient powers stir. But what endures is what we build between people.', font: 'narration' },
    { delay: 20.5, text: 'Be careful with your promises. They carry further than you think.', font: 'whisper' },
    { delay: 25.5, text: 'Your companions will remember.', font: 'warning' },
    { delay: 29.5, text: 'So will I.', font: 'whisper' },
  ],

  iron_judge: [
    { delay: 0.5,  text: 'There is a ledger. There has always been a ledger.', font: 'epic' },
    { delay: 4.5,  text: 'Every choice you make in this land will be recorded — not by me, but by consequence itself.', font: 'narration' },
    { delay: 11.5, text: 'You will be tempted to believe that small betrayals go unnoticed. They do not.', font: 'warning' },
    { delay: 18.0, text: 'The factions remember. The survivors remember. The Emberveil remembers most of all.', font: 'narration' },
    { delay: 25.0, text: 'I will hold you to the standard you set in the first hour.', font: 'epic' },
    { delay: 30.0, text: 'Choose it carefully.', font: 'whisper' },
  ],
};

const FALLBACK_TEXT = [
  { delay: 0.5,  text: 'The Emberveil stretches across the broken lands.', font: 'narration' },
  { delay: 5.0,  text: 'Your journey begins here.', font: 'epic' },
];

// ---------------------------------------------------------------------------
// Screen class
// ---------------------------------------------------------------------------

export class StoryOpeningCinematicScreen {
  constructor(manager, audio, storytellerId, onComplete) {
    this.manager        = manager;
    this.audio          = audio;
    this._storytellerId = storytellerId || 'chronicler';
    this.onComplete     = onComplete;
    this.noGameMenuEsc  = true;
    this._el            = null;
    this._canvas        = null;
    this._ctx           = null;
    this._t             = 0;
    this._skipPressed   = false;
    this._finished      = false;
  }

  onEnter() {
    this._storyText = STORYTELLER_TEXT[this._storytellerId] || FALLBACK_TEXT;
    this._totalDuration = this._storyText[this._storyText.length - 1].delay + 4.0;
    this._build();
    try { this.audio?.playIntroMusic?.(); } catch (_) {}
  }

  _build() {
    injectStyles('story-cinematic-styles', STORY_CINEMATIC_STYLES);
    this._el = createEl('div', 'scin-screen');
    this._el.innerHTML = `
      <div class="scin-bg"></div>
      <div class="scin-cloud scin-cloud-1"></div>
      <div class="scin-cloud scin-cloud-2"></div>
      <div class="scin-vignette"></div>
      <canvas class="scin-canvas" id="scin-canvas"></canvas>
      <div class="scin-overlay" id="scin-overlay">
        <div class="scin-storyteller-label" id="scin-st-label"></div>
        <div class="scin-content" id="scin-content"></div>
        <div class="scin-skip" id="scin-skip">Tap to skip</div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);

    const canvas = this._el.querySelector('#scin-canvas');
    canvas.width  = this.manager.width  || 393;
    canvas.height = this.manager.height || 852;
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');

    // Storyteller name label
    const label = this._el.querySelector('#scin-st-label');
    if (label) {
      const names = {
        chronicler: 'The Chronicler',
        ash_prophet: 'The Ash Prophet',
        warbringer: 'The Warbringer',
        trickster: 'The Trickster',
        pilgrim: 'The Pilgrim',
        iron_judge: 'The Iron Judge',
      };
      label.textContent = names[this._storytellerId] || 'Narrator';
    }

    this._el.querySelector('#scin-skip').addEventListener('click', () => {
      this._skipPressed = true;
      this._finish();
    });
  }

  update(dt) {
    this._t += dt;
    this._drawBackground();

    if (this._skipPressed) return;

    const overlay = this._el?.querySelector('#scin-overlay');
    if (!overlay) return;

    // Global fade in/out
    if (this._t < 1.0) {
      overlay.style.opacity = this._t;
    } else if (this._t > this._totalDuration - 1.5) {
      overlay.style.opacity = Math.max(0, 1 - (this._t - (this._totalDuration - 1.5)) / 1.5);
    } else {
      overlay.style.opacity = 1;
    }

    const content = this._el?.querySelector('#scin-content');
    if (!content) return;

    let html = '';
    const lastLine = this._storyText[this._storyText.length - 1];
    for (const line of this._storyText) {
      if (this._t >= line.delay) {
        const age    = this._t - line.delay;
        const fadeIn = Math.min(1, age / 0.8);
        const isLast = line === lastLine;
        const fadeOut = !isLast
          ? Math.max(0, 1 - (age - 5.5) / 1.5)
          : 1;
        const alpha = Math.min(fadeIn, fadeOut);
        if (alpha > 0) {
          html += `<p class="scin-line scin-${line.font || 'narration'}" style="opacity:${alpha.toFixed(3)}">${line.text}</p>`;
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
    if (!ctx) return;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Stars
    ctx.save();
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.508) % 1) * w;
      const sy = ((i * 97.3) % 1) * h * 0.65;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(this._t * 0.8 + i));
      ctx.globalAlpha = twinkle * 0.55;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(sx, sy, 0.7 + (i % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Embers drifting up
    for (let i = 0; i < 10; i++) {
      const ex   = ((i * 71.3 + this._t * 8) % 1) * w;
      const baseY = h * 0.85;
      const ey   = baseY - ((this._t * 22 + i * 40) % (h * 0.5));
      if (ey < 0) continue;
      const alpha = Math.max(0, 1 - ey / (h * 0.5));
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = `hsl(${20 + (i * 13) % 30}, 90%, 60%)`;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _finish() {
    if (this._finished) return;
    this._finished = true;
    if (this.onComplete) {
      this.onComplete();
    } else {
      this.manager.pop();
    }
  }

  draw()     {}
  onPause()  { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  onExit()   { removeEl(this._el); this._el = null; this._canvas = null; this._ctx = null; }
  destroy()  { this.onExit(); }
}

// ---------------------------------------------------------------------------
// Styles — mirroring OpeningCinematicScreen exactly, prefixed scin-
// No inline style="..." for static values (CLAUDE.md)
// ---------------------------------------------------------------------------
const STORY_CINEMATIC_STYLES = `
.scin-screen {
  position: absolute; inset: 0;
  font-family: 'Inter', sans-serif;
}
.scin-canvas {
  position: absolute; inset: 0; width: 100%; height: 100%;
  z-index: 4;
}
.scin-bg {
  position: absolute; inset: 0;
  background-image: url('images/map_bg/shattered_core.jpg');
  background-size: cover; background-position: center;
  filter: brightness(0.45) saturate(0.7);
  z-index: 0;
}
.scin-vignette {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.88) 100%),
    linear-gradient(180deg, rgba(3,2,8,0.6) 0%, rgba(9,5,18,0.3) 50%, rgba(3,2,8,0.8) 100%);
  z-index: 3; pointer-events: none;
}
.scin-cloud {
  position: absolute; left: -20%; right: -20%; height: 100%;
  background-repeat: repeat-x; background-size: auto 100%;
  opacity: 0.25; pointer-events: none; mix-blend-mode: screen;
}
.scin-cloud-1 {
  background-image: url('images/menu_bg/clouds_01.jpg');
  z-index: 1;
  animation: scin-drift-1 90s linear infinite;
}
.scin-cloud-2 {
  background-image: url('images/menu_bg/clouds_02.jpg');
  z-index: 2; opacity: 0.2;
  animation: scin-drift-2 60s linear infinite;
}
@keyframes scin-drift-1 { from { transform: translateX(0); } to { transform: translateX(-25%); } }
@keyframes scin-drift-2 { from { transform: translateX(-10%); } to { transform: translateX(15%); } }
.scin-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 3rem 2rem;
  transition: opacity 0.3s; z-index: 5;
}
.scin-storyteller-label {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(200,160,80,0.55);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  position: absolute;
  top: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
.scin-content {
  max-width: 500px; text-align: center;
  display: flex; flex-direction: column; gap: 1.2rem;
}
.scin-line {
  font-size: clamp(0.88rem, 2.4vw, 1.1rem);
  line-height: 1.75; color: #e0d8c8;
  text-shadow: 0 0 20px rgba(200,80,20,0.35);
  font-style: italic;
}
.scin-epic    { font-family: 'Cinzel', serif; font-weight: 900; font-style: normal;
  font-size: clamp(1.05rem, 3.1vw, 1.45rem); color: #f4ead0; letter-spacing: 0.04em;
  text-shadow: 0 0 30px rgba(232,160,32,0.5); }
.scin-whisper { font-family: 'Cinzel', serif; font-weight: 400; font-style: italic;
  color: #b8a890; letter-spacing: 0.08em; text-shadow: 0 0 18px rgba(80,40,20,0.5); }
.scin-title   { font-family: 'Cinzel', serif; font-weight: 900; font-style: normal;
  font-size: clamp(1.2rem, 3.5vw, 1.65rem); color: #ffd078; letter-spacing: 0.06em;
  text-shadow: 0 0 36px rgba(232,80,20,0.65); }
.scin-warning { font-family: 'Inter', sans-serif; font-weight: 600; font-style: normal;
  color: #f0a878; text-shadow: 0 0 22px rgba(192,64,32,0.6); }
.scin-narration { /* default */ }
.scin-skip {
  position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%);
  font-size: 0.68rem; color: rgba(240,232,216,0.28); letter-spacing: 0.12em;
  cursor: pointer; padding: 0.5rem 1rem; min-height: 44px;
  display: flex; align-items: center;
}
.scin-skip:hover { color: rgba(240,232,216,0.58); }
`;
