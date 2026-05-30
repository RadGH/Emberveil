#!/usr/bin/env node
/**
 * batch-remove-bg.cjs — walk sprite directories, detect PNGs with no
 * transparency, and run corner-sampled background removal on them.
 *
 * Policy: a PNG is "opaque" if min(alpha) === 255 across all pixels. Those
 * are assumed to have a solid-colored background that was never stripped by
 * the generator. Any PNG with even a single transparent pixel is skipped —
 * it's already been processed or was authored with transparency.
 *
 * Usage: node scripts/batch-remove-bg.cjs [--dry-run] [<dir> ...]
 * Default dirs: public/images/sprites, public/images/spritecook,
 *               public/images/sprites_pixellab_archive
 *
 * Requires sharp at /tmp/img_opt/node_modules/sharp (same as remove-bg.cjs).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SHARP_PATH = '/tmp/img_opt/node_modules/sharp';
let sharp;
try { sharp = require(SHARP_PATH); }
catch (_) { console.error('[batch-remove-bg] sharp not found at', SHARP_PATH); process.exit(1); }

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const dirs = argv.filter(a => !a.startsWith('--'));
const defaults = [
  'public/images/sprites',
  'public/images/spritecook',
  'public/images/sprites_pixellab_archive',
];
const roots = (dirs.length ? dirs : defaults).map(d => path.resolve(d));

function walkPngs(root, out = []) {
  if (!fs.existsSync(root)) return out;
  const st = fs.statSync(root);
  if (st.isFile()) { if (root.toLowerCase().endsWith('.png')) out.push(root); return out; }
  for (const e of fs.readdirSync(root)) {
    const p = path.join(root, e);
    const s = fs.statSync(p);
    if (s.isDirectory()) walkPngs(p, out);
    else if (p.toLowerCase().endsWith('.png')) out.push(p);
  }
  return out;
}

async function isFullyOpaque(file) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels < 4) return true;
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] !== 255) return false;
  }
  return width > 0 && height > 0;
}

// Corner-sampled chroma removal: sample the 4 corners + 4 mid-edges, dedupe,
// then zero-alpha any pixel within weighted-Euclidean distance <= 40.
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
  const samples = [];
  for (const [x, y] of samplePts) {
    const i = idx(x, y);
    const s = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (!samples.some(t => Math.abs(t.r - s.r) < 6 && Math.abs(t.g - s.g) < 6 && Math.abs(t.b - s.b) < 6)) samples.push(s);
  }
  const tol = 40;
  const tol2 = tol * tol;
  let cleared = 0;
  for (let i = 0; i < data.length; i += channels) {
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
  let scanned = 0, processed = 0, skipped = 0, failed = 0;
  for (const root of roots) {
    const files = walkPngs(root);
    console.log(`[batch-remove-bg] ${root}: ${files.length} PNGs`);
    for (const f of files) {
      scanned++;
      try {
        const opaque = await isFullyOpaque(f);
        if (!opaque) { skipped++; continue; }
        if (dryRun) { console.log(`  would process: ${path.relative(process.cwd(), f)}`); processed++; continue; }
        const n = await removeBg(f);
        processed++;
        if (processed % 25 === 0) console.log(`  processed ${processed}/${scanned} (last: ${path.basename(f)}, cleared ${n} px)`);
      } catch (err) {
        failed++;
        console.error(`  [fail] ${f}: ${err.message}`);
      }
    }
  }
  console.log(`[batch-remove-bg] done — scanned ${scanned}, processed ${processed}, skipped ${skipped}, failed ${failed}`);
})();
