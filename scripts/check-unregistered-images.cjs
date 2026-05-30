#!/usr/bin/env node
/**
 * check-unregistered-images.cjs
 *
 * Walks public/images/ and lists any .png/.jpg/.jpeg/.webp that is NOT
 * referenced in either:
 *   - public/assets/assets.json (images[].file)
 *   - public/assets/image-review-manifest.json (entries[].file)
 *   - public/images/spritecook/spritecook-assets.json
 *   - any src/**\/*.{js,jsx,ts,tsx,json,html,css} file
 *
 * Exit code 1 if any unregistered images found — suitable for a pre-commit
 * or CI gate. Policy is documented in public/docs/asset-types.md and
 * public/docs/image-policy.md. Every generated image must land in one of
 * these indexes in the same change.
 *
 * Usage:
 *   node scripts/check-unregistered-images.cjs [--warn]
 *
 *   --warn  exit 0 even if unregistered images exist (useful during a
 *           transitional phase). Default is exit 1 on any findings.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUB  = path.join(ROOT, 'public');
const IMG  = path.join(PUB, 'images');
const SRC  = path.join(ROOT, 'src');

const WARN_ONLY = process.argv.includes('--warn');

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

function walk(dir) {
  const out = [];
  (function rec(d) {
    let items;
    try { items = fs.readdirSync(d); } catch { return; }
    for (const f of items) {
      if (f.startsWith('.')) continue;
      const full = path.join(d, f);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) rec(full);
      else out.push(full);
    }
  })(dir);
  return out;
}

// Collect every image file on disk under public/images/.
const imageFiles = walk(IMG).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));

// Build the set of referenced basenames + full relative paths.
const referenced = new Set();
function addRef(p) {
  if (!p) return;
  referenced.add(path.basename(p));
  // Also track the last-two path segments in case of dir/file collisions.
  const parts = p.split(/[\\\/]/);
  if (parts.length >= 2) referenced.add(parts.slice(-2).join('/'));
}

const assets = readJSON(path.join(PUB, 'assets/assets.json'), { images: [] });
for (const img of assets.images || []) addRef(img.file);

const manifest = readJSON(path.join(PUB, 'assets/image-review-manifest.json'), { entries: [] });
for (const e of manifest.entries || []) addRef(e.file);

const sc = readJSON(path.join(IMG, 'spritecook/spritecook-assets.json'), {});
for (const [char, poses] of Object.entries(sc)) {
  if (char === '_meta' || typeof poses !== 'object') continue;
  for (const info of Object.values(poses)) {
    if (info && info.file) addRef(info.file);
  }
}

// Scan src/ text files for filename mentions.
const srcFiles = walk(SRC).filter(f => /\.(js|jsx|ts|tsx|json|html|css|md)$/i.test(f));
const rx = /([\w\-/]+\.(?:png|jpg|jpeg|webp))/gi;
for (const f of srcFiles) {
  let txt;
  try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  let m;
  while ((m = rx.exec(txt))) addRef(m[1]);
}
// Also scan public HTML/JS (but skip the manifest files themselves).
const pubFiles = walk(PUB).filter(f => /\.(html|js|css|md)$/i.test(f) && !f.includes('image-review-manifest.json'));
for (const f of pubFiles) {
  let txt;
  try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  let m;
  while ((m = rx.exec(txt))) addRef(m[1]);
}

// Compare.
const unregistered = [];
for (const f of imageFiles) {
  const base = path.basename(f);
  const rel2 = f.split(/[\\\/]/).slice(-2).join('/');
  if (referenced.has(base) || referenced.has(rel2)) continue;
  unregistered.push(path.relative(ROOT, f));
}

if (!unregistered.length) {
  console.log('OK: every image under public/images/ is registered.');
  process.exit(0);
}

console.log(`Unregistered images (${unregistered.length}):`);
for (const f of unregistered) console.log('  ' + f);
console.log('');
console.log('Fix: add each file to public/assets/assets.json OR let');
console.log('scripts/build-image-review-manifest.cjs pick it up, then re-run this check.');
console.log('Policy: public/docs/asset-types.md + public/docs/image-policy.md.');

process.exit(WARN_ONLY ? 0 : 1);
