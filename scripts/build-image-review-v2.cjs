#!/usr/bin/env node
/**
 * build-image-review-v2.cjs
 *
 * Builds the unified data file consumed by image-review-v2.html:
 *   public/assets/data/image-review-v2.json
 *
 * Buckets:
 *   - characters   (heroes, companions, bosses, enemies — from existing image-review-manifest.json)
 *   - backgrounds  (combat_bg, menu_bg, map_bg — globbed from disk)
 *   - tap_weapons  (from existing manifest tap-weapons category)
 *   - other        (clouds, icons, ui — globbed)
 *
 * Also reads:
 *   public/assets/data/image_review_batches/index.json   (batch index)
 *   public/assets/data/image_review_batches/m###.json    (per-batch entries)
 *
 * Re-run any time sprites/backgrounds change. Idempotent.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const IMG = path.join(PUBLIC, 'images');
const OUT = path.join(PUBLIC, 'assets', 'data', 'image-review-v2.json');
const MAN = path.join(PUBLIC, 'assets', 'image-review-manifest.json');
// M451 — sidecar manifest written by scripts/openai-spritesheet-gen.py.
// Persists across rebuilds; merged into characters[] each time.
const OPENAI_SIDECAR = path.join(PUBLIC, 'assets', 'data', 'image-review-v2-openai-sidecar.json');
const BATCH_DIR = path.join(PUBLIC, 'assets', 'data', 'image_review_batches');
const BATCH_INDEX = path.join(BATCH_DIR, 'index.json');

function listPngsJpgs(dir, prefix='') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith('_'))
    .map(f => ({
      file: prefix + f,
      name: f.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
    }));
}

function buildCharacters() {
  const out = [];
  if (fs.existsSync(MAN)) {
    const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
    const wanted = new Set(['hero','companion','boss','enemy']);
    for (const e of (m.entries || [])) {
      if (!wanted.has(e.category) || e.status === 'pending') continue;
      out.push({
        id: e.id,
        category: e.category,
        group: e.group,
        pose: e.pose,
        file: '../images/' + (e.file.replace(/^\.\.\//, '').replace(/^images\//,'')),
        prompt: e.prompt || null,
      });
    }
  } else {
    console.warn('No image-review-manifest.json — characters bucket will be small.');
  }
  // M451 — merge the OpenAI 9-pose sidecar so newly generated sprites are
  // visible on the Image Review V2 page next to the existing SpriteCook/
  // PixelLab versions. The script (openai-spritesheet-gen.py) writes
  // entries here on every run; this merge replays them after the rebuild.
  if (fs.existsSync(OPENAI_SIDECAR)) {
    try {
      const sc = JSON.parse(fs.readFileSync(OPENAI_SIDECAR, 'utf8'));
      let merged = 0;
      for (const e of (sc.entries || [])) {
        out.push({
          id: e.id,
          category: e.category || 'companion',
          group: e.group,
          pose: e.pose,
          file: e.file,
          prompt: e.prompt || null,
          source: e.source || 'openai-9pose',
        });
        merged++;
      }
      if (merged) console.log(`merged ${merged} openai sidecar entries`);
    } catch (err) {
      console.warn('failed to read openai sidecar:', err.message);
    }
  }
  return out;
}

function buildBackgrounds() {
  const out = [];
  for (const [type, dir] of [['combat','combat_bg'], ['menu','menu_bg'], ['map','map_bg']]) {
    const full = path.join(IMG, dir);
    for (const item of listPngsJpgs(full)) {
      out.push({
        id: `${type}_${item.file.replace(/\.[^.]+$/,'')}`,
        category: 'background',
        type,
        file: `../images/${dir}/${item.file}`,
        name: item.name,
      });
    }
  }
  return out;
}

function buildTapWeapons() {
  if (!fs.existsSync(MAN)) return [];
  const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  return (m.entries || [])
    .filter(e => e.category === 'tap-weapons' && e.status !== 'pending')
    .map(e => ({
      id: e.id,
      category: 'tap_weapon',
      file: '../images/' + (e.file.replace(/^\.\.\//,'').replace(/^images\//,'')),
      name: e.id.replace(/_/g, ' '),
    }));
}

function buildOther() {
  const out = [];
  // clouds (under menu_bg already covered) — fold in icons + ui if directories exist
  for (const dir of ['icons', 'ui']) {
    const full = path.join(IMG, dir);
    for (const item of listPngsJpgs(full)) {
      out.push({
        id: `${dir}_${item.file.replace(/\.[^.]+$/,'')}`,
        category: 'other',
        subtype: dir,
        file: `../images/${dir}/${item.file}`,
        name: item.name,
      });
    }
  }
  return out;
}

function buildBatches() {
  if (!fs.existsSync(BATCH_INDEX)) return { open: null, history: [] };
  const idx = JSON.parse(fs.readFileSync(BATCH_INDEX, 'utf8'));
  const expand = (b) => {
    const p = path.join(BATCH_DIR, `${b.id}.json`);
    if (!fs.existsSync(p)) return { ...b, entries: [] };
    return { ...b, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  };
  return {
    open: idx.open ? expand(idx.open) : null,
    history: (idx.history || []).map(expand),
  };
}

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  if (!fs.existsSync(BATCH_INDEX)) {
    fs.writeFileSync(BATCH_INDEX, JSON.stringify({ open: null, history: [] }, null, 2) + '\n');
  }
  const data = {
    _meta: { generated: new Date().toISOString() },
    characters: buildCharacters(),
    backgrounds: buildBackgrounds(),
    tap_weapons: buildTapWeapons(),
    other: buildOther(),
    batches: buildBatches(),
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`  characters:   ${data.characters.length}`);
  console.log(`  backgrounds:  ${data.backgrounds.length}`);
  console.log(`  tap_weapons:  ${data.tap_weapons.length}`);
  console.log(`  other:        ${data.other.length}`);
  console.log(`  open batch:   ${data.batches.open ? data.batches.open.id : '—'}`);
  console.log(`  history:      ${data.batches.history.length}`);
}

main();
