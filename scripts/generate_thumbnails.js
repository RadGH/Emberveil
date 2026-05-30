#!/usr/bin/env node
/**
 * generate_thumbnails.js — game13
 *
 * Walks public/images/ for PNG/JPG source art and produces 256x256
 * nearest-neighbor downscales at public/images/_thumbs/<same relative path>.png.
 *
 * Used by the /assets/ gallery to avoid shipping 1024x1024 originals into
 * a 116x116 grid cell. Nearest-neighbor preserves the pixel-art look.
 *
 * - Skips files already 256px or smaller on both axes.
 * - Skips a thumb if it exists and is newer than the source (idempotent).
 * - Uses ffmpeg (required). sharp is not installed in this workspace.
 * - Safe to re-run. Intended to be called from release.sh before
 *   optimize_assets_v2.js.
 *
 * Usage:  node scripts/generate_thumbnails.js
 */

import { execSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const THUMBS_DIR = path.join(IMAGES_DIR, '_thumbs');
const THUMB_SIZE = 256;

const VALID_EXT = new Set(['.png', '.jpg', '.jpeg']);

function have(cmd) {
  const r = spawnSync('which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

if (!have('ffmpeg')) {
  console.error('[thumbs] ffmpeg not found on PATH — cannot generate thumbnails.');
  process.exit(0); // soft-fail so release.sh keeps going
}

async function walk(dir, out = []) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip the thumbs dir itself so we don't recurse into our own output.
      if (full === THUMBS_DIR) continue;
      await walk(full, out);
    } else if (e.isFile() && VALID_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function probeSize(file) {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${file}"`,
      { encoding: 'utf8' }
    ).trim();
    const [w, h] = out.split('x').map(n => parseInt(n, 10));
    if (!w || !h) return null;
    return { w, h };
  } catch {
    return null;
  }
}

async function needsRebuild(src, dst) {
  try {
    const [s, d] = await Promise.all([fs.stat(src), fs.stat(dst)]);
    return s.mtimeMs > d.mtimeMs;
  } catch {
    return true;
  }
}

async function main() {
  const sources = await walk(IMAGES_DIR);
  let built = 0, skipped = 0, tooSmall = 0, failed = 0;

  for (const src of sources) {
    const rel = path.relative(IMAGES_DIR, src);
    // Always write PNG thumbs regardless of source format (lossless pixel art).
    const dstRel = rel.replace(/\.[^.]+$/, '.png');
    const dst = path.join(THUMBS_DIR, dstRel);

    const size = probeSize(src);
    if (!size) { failed++; continue; }
    // M242: if the source is already ≤ thumb size, copy it through verbatim
    // so the gallery's _thumbs/<rel> path resolves. Previously we skipped
    // these and the gallery showed 404 placeholders (e.g. pyromancer_portrait
    // which ships at 190×190).
    if (size.w <= THUMB_SIZE && size.h <= THUMB_SIZE) {
      if (await needsRebuild(src, dst)) {
        await fs.mkdir(path.dirname(dst), { recursive: true });
        await fs.copyFile(src, dst);
        built++;
      } else {
        tooSmall++;
      }
      continue;
    }

    if (!(await needsRebuild(src, dst))) { skipped++; continue; }

    await fs.mkdir(path.dirname(dst), { recursive: true });

    // scale to fit inside 256x256, nearest-neighbor. force_original_aspect_ratio=decrease
    // so non-square art (e.g. backgrounds) stays proportional.
    // Force rgba in the filter chain so ffmpeg preserves alpha through scaling;
    // otherwise some source pix_fmts collapse to rgb and flatten transparency to a
    // muddy blue/purple bg (~#4848aa) in the output PNG.
    const vf = `format=rgba,scale='min(${THUMB_SIZE},iw)':'min(${THUMB_SIZE},ih)':force_original_aspect_ratio=decrease:flags=neighbor`;
    const r = spawnSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', src,
      '-vf', vf,
      '-pix_fmt', 'rgba',
      dst,
    ], { stdio: 'inherit' });
    if (r.status === 0) built++;
    else failed++;
  }

  console.log(`[thumbs] built=${built} skipped=${skipped} too_small=${tooSmall} failed=${failed} total_src=${sources.length}`);
}

main().catch(e => { console.error('[thumbs] error', e); process.exit(0); });
