#!/usr/bin/env node
// Force corner-sampled chroma-key bg removal on specific files, even if they
// already contain transparency. For partial-transparency portraits flagged in
// Image Review.
'use strict';
const fs = require('fs');
const path = require('path');
const SHARP_PATH = '/tmp/img_opt/node_modules/sharp';
const sharp = require(SHARP_PATH);

async function removeBg(file) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const idx = (x, y) => (y * width + x) * channels;
  const samplePts = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
  ];
  // Only sample points whose alpha is already 255 — skip already-transparent
  // pixels so we don't "lock in" random colors left from prior bg-removal.
  const samples = [];
  for (const [x, y] of samplePts) {
    const i = idx(x, y);
    if (data[i + 3] !== 255) continue;
    const s = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (!samples.some(t => Math.abs(t.r - s.r) < 6 && Math.abs(t.g - s.g) < 6 && Math.abs(t.b - s.b) < 6)) samples.push(s);
  }
  if (!samples.length) return 0;
  const tol = 44, tol2 = tol * tol;
  let cleared = 0;
  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    for (const s of samples) {
      const dr = r - s.r, dg = g - s.g, db = b - s.b;
      const d2 = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d2 <= tol2) { data[i + 3] = 0; cleared++; break; }
    }
  }
  await sharp(data, { raw: { width, height, channels } }).png().toFile(file);
  return cleared;
}

(async () => {
  const files = process.argv.slice(2);
  for (const rel of files) {
    const f = path.resolve(rel);
    if (!fs.existsSync(f)) { console.error('missing', f); continue; }
    const n = await removeBg(f);
    console.log(`cleared ${n} px  ${rel}`);
  }
})();
