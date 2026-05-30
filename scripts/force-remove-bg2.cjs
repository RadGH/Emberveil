#!/usr/bin/env node
// Like force-remove-bg.cjs but also samples RGB of fully-transparent corner
// pixels (the "ghost" bg color left behind by prior chroma-keying). Useful
// when the first pass already zeroed alpha at the corners but fringe pixels
// still carry the old background.
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('/tmp/img_opt/node_modules/sharp');

async function removeBg(file) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const idx = (x, y) => (y * width + x) * channels;
  const pts = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
  ];
  const samples = [];
  for (const [x, y] of pts) {
    const i = idx(x, y);
    // Sample regardless of alpha — ghost bg is still there under alpha=0.
    const s = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (!samples.some(t => Math.abs(t.r - s.r) < 8 && Math.abs(t.g - s.g) < 8 && Math.abs(t.b - s.b) < 8)) samples.push(s);
  }
  const tol = 48, tol2 = tol * tol;
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
  for (const rel of process.argv.slice(2)) {
    const f = path.resolve(rel);
    if (!fs.existsSync(f)) { console.error('missing', f); continue; }
    const n = await removeBg(f);
    console.log(`cleared ${n} px  ${rel}`);
  }
})();
