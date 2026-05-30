/**
 * spellFx.js — Reusable element-keyed spell visual effects (M303)
 *
 * Each effect is a CSS-animated overlay div attached to the target element.
 * No images required — pure CSS / DOM geometry.
 *
 * API:
 *   playSpellFx(targetEl, kind, opts?)
 *     targetEl — DOM element to overlay (or a combat screen root)
 *     kind     — 'fire' | 'ice' | 'shadow' | 'holy' | 'nature'
 *     opts     — optional { spellTint, position: {x, y} }
 *
 * Reduce-motion: when <html> has .reduce-motion class, the full animation
 * is skipped and a 200 ms color tint is applied instead.
 */

const SPELL_STYLES = `
@keyframes spellFx-fire-pulse {
  0%   { transform: scale(0.7) translateY(10px); opacity: 0; }
  30%  { transform: scale(1.1) translateY(-6px); opacity: 1; }
  70%  { transform: scale(1.0) translateY(0);    opacity: 0.8; }
  100% { transform: scale(1.3) translateY(-12px); opacity: 0; }
}
@keyframes spellFx-ice-sweep {
  0%   { transform: scaleX(0) skewX(-12deg); opacity: 0; }
  25%  { transform: scaleX(1.1) skewX(-4deg); opacity: 1; }
  75%  { transform: scaleX(0.95) skewX(2deg); opacity: 0.7; }
  100% { transform: scaleX(1.4) skewX(8deg);  opacity: 0; }
}
@keyframes spellFx-shadow-smoke {
  0%   { transform: scale(0.8) translateY(8px);  opacity: 0; border-radius: 30%; }
  35%  { transform: scale(1.05) translateY(-4px); opacity: 0.9; border-radius: 48%; }
  80%  { transform: scale(1.2) translateY(-10px); opacity: 0.6; border-radius: 55%; }
  100% { transform: scale(1.5) translateY(-18px); opacity: 0; border-radius: 60%; }
}
@keyframes spellFx-holy-burst {
  0%   { transform: scale(0.5); opacity: 0; }
  20%  { transform: scale(1.15); opacity: 1; }
  55%  { transform: scale(0.95); opacity: 0.85; }
  100% { transform: scale(1.6);  opacity: 0; }
}
@keyframes spellFx-nature-spiral {
  0%   { transform: rotate(0deg) scale(0.7);  opacity: 0; }
  25%  { transform: rotate(72deg) scale(1.0); opacity: 1; }
  65%  { transform: rotate(200deg) scale(1.1); opacity: 0.8; }
  100% { transform: rotate(360deg) scale(1.4); opacity: 0; }
}
@keyframes spellFx-particle-rise {
  0%   { transform: translateY(0)   scale(1);   opacity: 1; }
  100% { transform: translateY(-28px) scale(0); opacity: 0; }
}
@keyframes spellFx-tint-flash {
  0%   { opacity: 0; }
  25%  { opacity: 0.55; }
  100% { opacity: 0; }
}
.spell-fx-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 800;
  border-radius: inherit;
  overflow: visible;
}
.spell-fx-particle {
  position: absolute;
  border-radius: 50%;
  animation: spellFx-particle-rise 0.55s ease-out forwards;
}
`;

let _stylesInjected = false;
function _ensureStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = SPELL_STYLES;
  document.head.appendChild(el);
}

const FX_CONFIG = {
  fire: {
    color: '#ff5a10',
    glow:  '#ff3000',
    anim:  'spellFx-fire-pulse',
    particles: [
      { color: '#ff6820', size: 7 },
      { color: '#ffb040', size: 5 },
      { color: '#ff3000', size: 6 },
    ],
    tintColor: 'rgba(255,80,10,0.4)',
  },
  ice: {
    color: '#60c8ff',
    glow:  '#40a8e8',
    anim:  'spellFx-ice-sweep',
    particles: [
      { color: '#b0e8ff', size: 6 },
      { color: '#60c8ff', size: 5 },
      { color: '#ffffff', size: 4 },
    ],
    tintColor: 'rgba(60,160,230,0.4)',
  },
  shadow: {
    color: '#8840cc',
    glow:  '#6020aa',
    anim:  'spellFx-shadow-smoke',
    particles: [
      { color: '#a060e0', size: 8 },
      { color: '#6820b0', size: 6 },
      { color: '#301050', size: 7 },
    ],
    tintColor: 'rgba(100,20,160,0.4)',
  },
  holy: {
    color: '#ffe040',
    glow:  '#ffd000',
    anim:  'spellFx-holy-burst',
    particles: [
      { color: '#fff080', size: 6 },
      { color: '#ffe840', size: 5 },
      { color: '#ffffff', size: 4 },
    ],
    tintColor: 'rgba(255,220,40,0.4)',
  },
  nature: {
    color: '#40c840',
    glow:  '#208820',
    anim:  'spellFx-nature-spiral',
    particles: [
      { color: '#60e850', size: 7 },
      { color: '#30b830', size: 5 },
      { color: '#a0ff60', size: 4 },
    ],
    tintColor: 'rgba(40,180,40,0.4)',
  },
};

function _isReducedMotion() {
  return document.documentElement.classList.contains('reduce-motion');
}

/**
 * Play a spell visual effect on a DOM element.
 *
 * @param {HTMLElement} targetEl   — element to overlay (position:relative/absolute parent)
 * @param {'fire'|'ice'|'shadow'|'holy'|'nature'} kind
 * @param {object} [opts]
 * @param {string}  [opts.spellTint]          — override base color (CSS color)
 * @param {{x:number,y:number}} [opts.position] — pixel coords for canvas-relative placement;
 *                                               if omitted the overlay covers the whole element
 * @param {number}  [opts.durationMs]         — override duration (ms, default ~700)
 */
export function playSpellFx(targetEl, kind, opts = {}) {
  if (!targetEl) return;
  _ensureStyles();

  const cfg = FX_CONFIG[kind] || FX_CONFIG.fire;
  const color = opts.spellTint || cfg.color;
  const durationMs = opts.durationMs || 680;

  if (_isReducedMotion()) {
    // Fallback: simple 200ms tint flash
    const tint = document.createElement('div');
    tint.className = 'spell-fx-overlay';
    tint.style.cssText = `background:${cfg.tintColor};animation:spellFx-tint-flash 0.2s ease-out forwards;`;
    targetEl.style.position = targetEl.style.position || 'relative';
    targetEl.appendChild(tint);
    setTimeout(() => tint.remove(), 220);
    return;
  }

  // Compute size for overlay (if position given, shrink to a region)
  const pos = opts.position;
  let overlayStyle;
  if (pos) {
    const r = 44; // px radius
    overlayStyle = `left:${pos.x - r}px;top:${pos.y - r}px;width:${r*2}px;height:${r*2}px;inset:unset;border-radius:50%;`;
  } else {
    overlayStyle = '';
  }

  targetEl.style.position = targetEl.style.position || 'relative';

  const overlay = document.createElement('div');
  overlay.className = 'spell-fx-overlay';
  overlay.style.cssText = overlayStyle;

  // Main glow blob
  const blob = document.createElement('div');
  blob.style.cssText = `
    position:absolute;inset:0;
    background:radial-gradient(circle at 50% 60%, ${color}cc 0%, ${cfg.glow}66 50%, transparent 80%);
    box-shadow:0 0 18px 4px ${color}88;
    animation:${cfg.anim} ${durationMs}ms ease-out forwards;
    border-radius:50%;
  `;
  overlay.appendChild(blob);

  // Particles
  cfg.particles.forEach((p, pi) => {
    const particle = document.createElement('div');
    particle.className = 'spell-fx-particle';
    const xOff = 30 + Math.random() * 40 - 20;
    const yOff = 50 + Math.random() * 30;
    const delay = pi * 80;
    particle.style.cssText = `
      width:${p.size}px;height:${p.size}px;
      background:${opts.spellTint || p.color};
      left:calc(${xOff}% - ${p.size/2}px);
      top:calc(${yOff}% - ${p.size/2}px);
      animation-delay:${delay}ms;
      animation-duration:${durationMs * 0.7}ms;
    `;
    overlay.appendChild(particle);
  });

  targetEl.appendChild(overlay);
  setTimeout(() => overlay.remove(), durationMs + 100);
}
