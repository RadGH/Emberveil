#!/usr/bin/env node
/**
 * remove-bg.cjs — CLI background-color removal for sprite PNGs
 *
 * Replicates the weighted-Euclidean distance algorithm from public/assets/bg-remove.html.
 * For each pixel, tests whether its color falls within `tolerance` of ANY listed sample color
 * using: sqrt(2*dr^2 + 4*dg^2 + 3*db^2) <= tolerance
 * Matching pixels are set to alpha=0 (fully transparent).
 *
 * Usage:
 *   node scripts/remove-bg.cjs --input <path> --output <path> \
 *     [--samples "r,g,b [r,g,b ...]"] [--tolerance <number>] [--feather] [--auto-corners]
 *
 * Options:
 *   --input        Input PNG file path (required)
 *   --output       Output PNG file path (required; may equal input for in-place)
 *   --samples      Space-separated list of "r,g,b" color triples to remove
 *                  Example: --samples "72,108,85 72,108,170"
 *   --tolerance    Distance threshold (default: 40). Range 1–120.
 *   --feather      Apply a 1-px soft-alpha pass at removal boundaries
 *   --auto-corners Auto-sample the 4 corners (plus top/left midpoints) to derive
 *                  background colors; appended to any --samples provided.
 *
 * Requires sharp at /tmp/img_opt/node_modules/sharp
 * Install: cd /tmp/img_opt && npm install sharp
 *
 * Example (warlock_east_spell — in-place):
 *   node scripts/remove-bg.cjs \
 *     --input  public/images/spritecook/warlock_east_spell.png \
 *     --output public/images/spritecook/warlock_east_spell.png \
 *     --auto-corners --tolerance 40
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// ── Load sharp from fixed location ───────────────────────────────────────────
const SHARP_PATH = '/tmp/img_opt/node_modules/sharp';
let sharp;
try {
  sharp = require(SHARP_PATH);
} catch (e) {
  console.error('[remove-bg] sharp not found at', SHARP_PATH);
  console.error('  Install: cd /tmp/img_opt && npm install sharp');
  process.exit(1);
}

// ── Argument parsing ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

function getArg(flag, defaultVal = null) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return defaultVal;
  return argv[idx + 1] ?? null;
}

function hasFlag(flag) {
  return argv.includes(flag);
}

const inputPath     = getArg('--input');
const outputPath    = getArg('--output');
const samplesArg    = getArg('--samples', '');
const toleranceArg  = getArg('--tolerance', '40');
const feather       = hasFlag('--feather');
const autoCorners   = hasFlag('--auto-corners');

if (!inputPath || !outputPath) {
  console.error('[remove-bg] --input and --output are required.');
  console.error('  Usage: node scripts/remove-bg.cjs --input <path> --output <path> [--samples "r,g,b ..."] [--tolerance N] [--feather] [--auto-corners]');
  process.exit(1);
}

const tolerance = Math.max(1, Math.min(120, Number(toleranceArg)));

// Parse explicit samples: "72,108,85 72,108,170" → [{r,g,b},…]
/** @param {string} str @returns {{r:number,g:number,b:number}[]} */
function parseSamples(str) {
  if (!str || !str.trim()) return [];
  return str.trim().split(/\s+/).map(triple => {
    const parts = triple.split(',').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      console.error(`[remove-bg] Invalid sample "${triple}" — expected "r,g,b" integers.`);
      process.exit(1);
    }
    return { r: parts[0], g: parts[1], b: parts[2] };
  });
}

// ── Core algorithm ────────────────────────────────────────────────────────────

/**
 * Weighted Euclidean color distance matching bg-remove.html exactly.
 * @param {number} r1 @param {number} g1 @param {number} b1
 * @param {number} r2 @param {number} g2 @param {number} b2
 * @returns {number}
 */
function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/**
 * Deduplicate samples: drop any sample whose color is within `tol` of an earlier one.
 * @param {{r:number,g:number,b:number}[]} samples
 * @param {number} tol
 * @returns {{r:number,g:number,b:number}[]}
 */
function deduplicateSamples(samples, tol) {
  const out = [];
  for (const s of samples) {
    const dup = out.some(o => colorDist(o.r, o.g, o.b, s.r, s.g, s.b) < tol);
    if (!dup) out.push(s);
  }
  return out;
}

/**
 * Sample colors from image corners and midpoints of edges.
 * @param {Buffer} data RGBA raw buffer
 * @param {number} w
 * @param {number} h
 * @returns {{r:number,g:number,b:number}[]}
 */
function sampleCorners(data, w, h) {
  const points = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0],
    [0, Math.floor(h / 2)],
    [w - 1, Math.floor(h / 2)],
    [Math.floor(w / 2), h - 1],
  ];
  return points.map(([x, y]) => {
    const i = (y * w + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const resolvedInput  = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`[remove-bg] Input file not found: ${resolvedInput}`);
    process.exit(1);
  }

  console.log(`[remove-bg] Loading: ${resolvedInput}`);

  const { data, info } = await sharp(resolvedInput)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const totalPixels = w * h;

  console.log(`[remove-bg] Dimensions: ${w}×${h} (${totalPixels.toLocaleString()} pixels)`);

  // Collect samples
  let samples = parseSamples(samplesArg);

  if (autoCorners) {
    const cornerSamples = sampleCorners(data, w, h);
    samples = samples.concat(cornerSamples);
    console.log(`[remove-bg] Auto-corners added ${cornerSamples.length} samples.`);
  }

  if (samples.length === 0) {
    console.error('[remove-bg] No samples provided. Use --samples "r,g,b ..." or --auto-corners.');
    process.exit(1);
  }

  // Deduplicate
  samples = deduplicateSamples(samples, tolerance);
  console.log(`[remove-bg] Samples after dedup (${samples.length}):`, samples.map(s => `rgb(${s.r},${s.g},${s.b})`).join(' '));
  console.log(`[remove-bg] Tolerance: ${tolerance}${feather ? ', feather: on' : ''}`);

  // Count alpha distribution before
  let beforeOpaque = 0, beforeTransparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 255) beforeOpaque++;
    else if (data[i] === 0) beforeTransparent++;
  }
  console.log(`[remove-bg] Before — opaque: ${beforeOpaque.toLocaleString()}, transparent: ${beforeTransparent.toLocaleString()}, other: ${(totalPixels - beforeOpaque - beforeTransparent).toLocaleString()}`);

  // Build output buffer: copy input then zero-alpha matching pixels
  const out = Buffer.from(data);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue; // already transparent
    const r = data[i], g = data[i + 1], b = data[i + 2];
    for (const s of samples) {
      if (colorDist(r, g, b, s.r, s.g, s.b) <= tolerance) {
        out[i + 3] = 0;
        break;
      }
    }
  }

  // Optional feather pass: for each opaque pixel that has a transparent neighbour,
  // blend its alpha to 50% (matches bg-remove.html behaviour exactly).
  if (feather) {
    const mask = new Uint8Array(totalPixels);
    for (let i = 0; i < data.length; i += 4) {
      mask[i >> 2] = out[i + 3] === 0 ? 1 : 0;
    }
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const pi = y * w + x;
        if (mask[pi]) continue; // already transparent
        const hasTransN = mask[pi - w] || mask[pi + w] || mask[pi - 1] || mask[pi + 1];
        if (hasTransN) {
          const di = pi * 4;
          out[di + 3] = Math.round(out[di + 3] * 0.5);
        }
      }
    }
  }

  // Count alpha distribution after
  let afterOpaque = 0, afterTransparent = 0, afterPartial = 0;
  for (let i = 3; i < out.length; i += 4) {
    const a = out[i];
    if (a === 255) afterOpaque++;
    else if (a === 0) afterTransparent++;
    else afterPartial++;
  }
  const removed = afterTransparent - beforeTransparent;
  const removedPct = ((removed / totalPixels) * 100).toFixed(1);
  console.log(`[remove-bg] After  — opaque: ${afterOpaque.toLocaleString()}, transparent: ${afterTransparent.toLocaleString()}, partial: ${afterPartial.toLocaleString()}`);
  console.log(`[remove-bg] Removed ${removed.toLocaleString()} pixels (${removedPct}%) using ${samples.length} sample(s)`);

  if (removed === 0) {
    console.warn('[remove-bg] WARNING: 0 pixels removed. Check sample colors and tolerance.');
  }

  // Ensure output directory exists
  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Write PNG with alpha
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(resolvedOutput);

  console.log(`[remove-bg] Saved: ${resolvedOutput}`);
})();
