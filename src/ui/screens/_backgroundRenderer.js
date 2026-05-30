// M274: pure parallax-layer builder extracted from CombatScreen.
// Builds an OffscreenCanvas (or fallback HTMLCanvasElement) for one of three
// kinds — 'far' (distant mountains), 'mid' (rolling hills), 'near'
// (foreground grass + rocks). Deterministic given (kind, w, h, groundY, pal, zone).
//
// Why extract: 60-line pure-canvas drawing routine that contributed to
// CombatScreen.js's bulk. The orchestrator (_drawBackground) stays in
// CombatScreen because it interacts with the parallax-layer cache and reads
// the runtime zone palette.
//
// **Determinism:** same `zone + kind` seeds the same PRNG, so identical zones
// look the same across reloads.
export function buildParallaxLayer(kind, w, h, groundY, pal, zone) {
  const c = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)))
    : (() => { const el = document.createElement('canvas'); el.width = Math.max(2, Math.floor(w)); el.height = Math.max(2, Math.floor(h)); return el; })();
  const cx = c.getContext('2d');
  // Simple seeded PRNG from zone name + kind.
  const seedStr = (zone || 'x') + ':' + kind;
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 0) % 10000) / 10000; };

  if (kind === 'far') {
    // Distant mountain range silhouette — darkest, lowest contrast
    cx.fillStyle = pal.sky[1];
    const baseY = groundY - 8;
    cx.beginPath();
    cx.moveTo(0, baseY);
    const peaks = 8;
    for (let i = 0; i <= peaks; i++) {
      const x = (i / peaks) * w;
      const ph = 30 + rand() * 40;
      cx.lineTo(x - w / peaks / 2, baseY - ph * 0.6);
      cx.lineTo(x, baseY - ph);
    }
    cx.lineTo(w, baseY); cx.lineTo(w, groundY); cx.lineTo(0, groundY);
    cx.closePath(); cx.fill();
  } else if (kind === 'mid') {
    // Mid hills — slightly lighter, taller detail
    cx.fillStyle = pal.sky[2];
    const baseY = groundY - 2;
    cx.beginPath();
    cx.moveTo(0, baseY);
    const bumps = 6;
    for (let i = 0; i <= bumps; i++) {
      const x = (i / bumps) * w;
      const ph = 18 + rand() * 28;
      cx.quadraticCurveTo(x - w / bumps / 2, baseY - ph, x, baseY - ph * 0.5);
    }
    cx.lineTo(w, groundY); cx.lineTo(0, groundY);
    cx.closePath(); cx.fill();
  } else if (kind === 'near') {
    // Foreground grass/debris tufts along ground line
    cx.fillStyle = pal.grass || 'rgba(60,90,60,0.5)';
    for (let i = 0; i < 30; i++) {
      const x = rand() * w;
      const th = 3 + rand() * 6;
      const tw = 2 + rand() * 4;
      cx.fillRect(x, groundY - th, tw, th);
    }
    // A few larger silhouette rocks
    cx.fillStyle = pal.ground;
    for (let i = 0; i < 5; i++) {
      const x = rand() * w;
      const rw = 10 + rand() * 18;
      const rh = 4 + rand() * 6;
      cx.beginPath();
      cx.ellipse(x, groundY - rh * 0.3, rw, rh, 0, 0, Math.PI * 2);
      cx.fill();
    }
  }
  return c;
}
