#!/usr/bin/env node
/**
 * build-appearances-manifest.cjs — Phase 3 step 10 (glob-only).
 *
 * Builds public/assets/appearances-manifest.json — the authoritative,
 * fully data-driven image manifest for images.html / image-review-v2.html.
 *
 * ── Phase 3 rewrite: GLOB-ONLY, CANONICAL-SOURCED ──────────────────────────
 * The manifest's entity set is now derived DIRECTLY from the canonical JSON
 * in public/data/ — never from emit-game-data's intermediate
 * public/assets/data/*.json, never from any JS-source scrape, never via a
 * best-effort multi-source merge. For every canonical id we attach a
 * `sprites{}` map purely by globbing public/images/{openai_v2,spritecook,
 * sprites}/<sprite>_<pose>.png.
 *
 * WHY THIS GUARANTEES THE giant_spider BUG CLASS IS CLOSED:
 * The manifest's enemy/boss/companion/appearance id set is, *by
 * construction*, exactly the canonical entity set:
 *
 *   enemies     = keys(entities/enemies.json#/entities)        (33)
 *   bosses      = keys(entities/bosses.json#/entities)          (12)
 *   companions  = keys(classPets) ∪ companions[].id ∪ hires[].id (35)
 *   appearances = entities/heroes.json#/entities
 *               ∪ entities/npcs.json#/entities                  (84)
 *
 * verify-entity-coverage.mjs set-matches manifest ⟷ the SAME canonical
 * files. Two sets built from one source cannot drift: an inline ENCOUNTERS
 * enemy (giant_spider, the void/dragon roster, hidden bosses) that the old
 * regex scraper could not see is now simply a key in enemies.json/bosses.json
 * and therefore present in the manifest unconditionally.
 *
 * Canonical inputs (the ONLY data sources — no src/ scanning):
 *   public/data/entities/enemies.json   {entities:{id:{name,act?,...}}}
 *   public/data/entities/bosses.json    {entities:{id:{name,act?,...}}}
 *   public/data/entities/companions.json {classPets,companions[],hires[]}
 *   public/data/entities/heroes.json    {entities:[{id,name,sprite,...}]}
 *   public/data/entities/npcs.json      {entities:[{id,name,sprite,npc,...}]}
 *
 * Output schema is unchanged from the previous builder (images.html /
 * image-review-v2.html consume it field-for-field):
 *   { generated, spriteDirs, poses,
 *     appearances:[{id,name,kind,gender,classDefault,sprite,tags,playable,
 *                   npc,deprecated,pendingReview,sprites,spriteCount,
 *                   missingPoses,sourceDir}],
 *     companions:[{id,name,kind,class,ownerClass,sprite,sprites,spriteCount,
 *                  missingPoses,sourceDir}],
 *     enemies:[{id,name,act,sprites,spriteCount,missingPoses,sourceDir}],
 *     bosses:[{id,name,act,sprites,spriteCount,missingPoses,sourceDir}],
 *     orphans:[{file,dir,name}], missing:[{id,name,kind,poses,tried}],
 *     totals:{appearances,companions,enemies,bosses,orphans,missing} }
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const PUB     = path.join(ROOT, 'public');
const CANON   = path.join(PUB, 'data');
const IMGROOT = path.join(PUB, 'images');
const OUT     = path.join(PUB, 'assets/appearances-manifest.json');

// Sprite search dirs, priority order. openai_v2 first (M463) so OpenAI
// regenerations supersede older SpriteCook copies of the same file.
const SPRITE_DIRS = ['openai_v2', 'spritecook', 'sprites'];

// Canonical 7-pose set every appearance should have.
const CANONICAL_POSES = ['portrait', 'south', 'east', 'east_attack', 'east_spell', 'east_block', 'east_ko'];

// Dirs scanned for orphan detection only (not used for lookups).
const SCAN_DIRS = ['openai_v2', 'spritecook', 'sprites', 'pixellab', 'bosses'];

const SKIP_DIRS = new Set([
  '_bg-removal-backup',
  '_thumbs',
  '_pre_openai',
  '_pre_spritecook',
  'character_redesign_snapshots',
  'sprites_pixellab_archive',
  'sprites_pixellab_test',
  'sprites_pixelengine',
  'spritecook_war_dog_preview',
]);

const IMG_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readCanon(rel) {
  const p = path.join(CANON, rel);
  if (!fs.existsSync(p)) {
    console.error(`[appearances-manifest] FATAL: canonical file missing: ${path.relative(ROOT, p)}`);
    console.error('  Phase 1/2 must have emitted public/data/. Run scripts/extract-canonical-data.mjs.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** {entities:{...}} | {entities:[...]} | bare → inner value. */
function entitiesOf(doc) {
  if (doc && typeof doc === 'object' && 'entities' in doc) return doc.entities;
  return doc;
}

function exists(absPath) {
  try { fs.accessSync(absPath); return true; } catch { return false; }
}

function walkDir(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  function recurse(d, rel) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      const r    = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        recurse(full, r);
      } else if (IMG_EXT.test(entry.name)) {
        files.push(r);
      }
    }
  }
  recurse(dir, '');
  return files;
}

function normaliseGender(gender, id) {
  if (gender === 'male' || gender === 'female') return gender;
  if (id && id.endsWith('_female')) return 'female';
  if (id && id.endsWith('_male'))   return 'male';
  return gender || null;
}

/** First matching dir/file for sprite+pose across SPRITE_DIRS, or null. */
function findSprite(sprite, pose) {
  const filename = `${sprite}_${pose}.png`;
  for (const dir of SPRITE_DIRS) {
    if (exists(path.join(IMGROOT, dir, filename))) return `${dir}/${filename}`;
  }
  return null;
}

function buildSpritesForPrefix(sprite, poses) {
  const sprites = {};
  const missing = [];
  for (const pose of poses) {
    const found = findSprite(sprite, pose);
    sprites[pose] = found;
    if (!found) missing.push(pose);
  }
  const spriteCount = poses.length - missing.length;
  const dirCounts = {};
  for (const v of Object.values(sprites)) {
    if (!v) continue;
    const dir = v.split('/')[0];
    dirCounts[dir] = (dirCounts[dir] || 0) + 1;
  }
  const sourceDir = Object.entries(dirCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { sprites, spriteCount, missingPoses: missing, sourceDir };
}

// ---------------------------------------------------------------------------
// Canonical id extraction (the set-match guarantee lives here)
// ---------------------------------------------------------------------------

/** heroes.json ∪ npcs.json → ordered appearance list (entity records). */
function canonicalAppearances() {
  const heroes = entitiesOf(readCanon('entities/heroes.json'));
  const npcs   = entitiesOf(readCanon('entities/npcs.json'));
  const list = [];
  for (const e of (Array.isArray(heroes) ? heroes : Object.values(heroes))) list.push({ ...e, _npc: false });
  for (const e of (Array.isArray(npcs)   ? npcs   : Object.values(npcs)))   list.push({ ...e, _npc: true });
  return list;
}

/** classPets ∪ companions[] ∪ hires[] → flat companion list. */
function canonicalCompanions() {
  const doc = readCanon('entities/companions.json');
  const out = [];
  for (const id of Object.keys(doc.classPets || {})) {
    const p = doc.classPets[id];
    out.push({ id, name: p.name || id, kind: 'pet', class: p.class || 'companion', ownerClass: p.ownerClass || null });
  }
  for (const c of (doc.companions || [])) {
    out.push({ id: c.id, name: c.name || c.id, kind: c.wild ? 'wild' : 'companion', class: c.class || 'companion', ownerClass: c.ownerClass || null });
  }
  for (const h of (doc.hires || [])) {
    out.push({ id: h.id, name: h.name || h.id, kind: 'hireable', class: h.class || 'companion', ownerClass: null });
  }
  return out;
}

function canonicalEnemies() {
  const m = entitiesOf(readCanon('entities/enemies.json'));
  return Object.keys(m).sort().map((id) => ({ id, name: m[id].name || id, act: m[id].act ?? null }));
}

function canonicalBosses() {
  const m = entitiesOf(readCanon('entities/bosses.json'));
  return Object.keys(m).sort().map((id) => ({ id, name: m[id].name || id, act: m[id].act ?? null }));
}

// ---------------------------------------------------------------------------
// Orphan detection
// ---------------------------------------------------------------------------
function collectAllReferencedFiles(appearances, companions, enemies, bosses, poses) {
  const referenced = new Set();
  function addSprites(sprite) {
    for (const dir of SPRITE_DIRS) {
      for (const pose of poses) {
        referenced.add(path.join(dir, `${sprite}_${pose}.png`));
      }
    }
  }
  for (const a of appearances) addSprites(a.sprite || a.id);
  for (const c of companions)  addSprites(c.sprite || c.id);
  for (const e of enemies)     addSprites(e.id);
  for (const b of bosses)      addSprites(b.id);
  return referenced;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('[appearances-manifest] Building (glob-only, canonical-sourced)...');

  const canonApp  = canonicalAppearances();
  const canonComp = canonicalCompanions();
  const canonEn   = canonicalEnemies();
  const canonBo   = canonicalBosses();

  if (!canonApp.length) {
    console.error('[appearances-manifest] ERROR: canonical heroes/npcs empty — aborting.');
    process.exit(1);
  }

  // The set of "class appearance" ids (every hero's classDefault) — used only
  // for the cosmetic `kind` badge. Canonical-derived; no emit dependency.
  const classDefaults = new Set(
    canonApp.filter((a) => !a._npc && a.classDefault).map((a) => a.classDefault),
  );

  // ---- appearances ----
  const processedAppearances = canonApp.map((a) => {
    const sprite = a.sprite || a.id;
    const gender = normaliseGender(a.gender, a.id);
    const { sprites, spriteCount, missingPoses, sourceDir } = buildSpritesForPrefix(sprite, CANONICAL_POSES);
    const npc = a._npc === true || a.npc === true;
    let kind;
    if (npc)                                   kind = 'npc';
    else if (a.deprecated === true)            kind = 'deprecated';
    else if (classDefaults.has(a.classDefault)) kind = 'class';
    else                                       kind = 'appearance';
    return {
      id:            a.id,
      name:          a.name,
      kind,
      gender,
      classDefault:  a.classDefault || null,
      sprite,
      tags:          Array.isArray(a.tags) ? a.tags : [],
      playable:      a.playable !== false,
      npc,
      deprecated:    a.deprecated === true,
      pendingReview: a.pendingReview === true,
      sprites,
      spriteCount,
      missingPoses,
      sourceDir,
    };
  });

  // ---- companions ----
  const processedCompanions = canonComp.map((c) => {
    const sprite = c.id;
    const { sprites, spriteCount, missingPoses, sourceDir } = buildSpritesForPrefix(sprite, CANONICAL_POSES);
    return {
      id:         c.id,
      name:       c.name,
      kind:       c.kind || 'companion',
      class:      c.class || 'companion',
      ownerClass: c.ownerClass || null,
      sprite,
      sprites,
      spriteCount,
      missingPoses,
      sourceDir,
    };
  });

  // ---- enemies (non-boss; disjoint from bosses by canonical construction) ----
  const processedEnemies = canonEn.map((e) => {
    const { sprites, spriteCount, missingPoses, sourceDir } = buildSpritesForPrefix(e.id, CANONICAL_POSES);
    return { id: e.id, name: e.name, act: e.act, sprites, spriteCount, missingPoses, sourceDir };
  });

  // ---- bosses ----
  const processedBosses = canonBo.map((b) => {
    const { sprites, spriteCount, missingPoses, sourceDir } = buildSpritesForPrefix(b.id, CANONICAL_POSES);
    return { id: b.id, name: b.name, act: b.act, sprites, spriteCount, missingPoses, sourceDir };
  });

  // ---- orphan detection ----
  const referencedRelPaths = collectAllReferencedFiles(
    processedAppearances, processedCompanions, processedEnemies, processedBosses,
    CANONICAL_POSES,
  );
  const activeFiles = new Set();
  function addActiveSprites(sprites) {
    for (const v of Object.values(sprites || {})) if (v) activeFiles.add(v);
  }
  for (const a of processedAppearances) addActiveSprites(a.sprites);
  for (const c of processedCompanions)  addActiveSprites(c.sprites);
  for (const e of processedEnemies)     addActiveSprites(e.sprites);
  for (const b of processedBosses)      addActiveSprites(b.sprites);

  const orphans = [];
  for (const scanDir of SCAN_DIRS) {
    const abs = path.join(IMGROOT, scanDir);
    const files = walkDir(abs);
    for (const relFile of files) {
      const key = scanDir + '/' + relFile;
      if (!referencedRelPaths.has(key) && !activeFiles.has(key)) {
        orphans.push({
          file: `images/${scanDir}/${relFile}`,
          dir:  scanDir,
          name: path.basename(relFile).replace(/\.[^.]+$/, ''),
        });
      }
    }
  }
  orphans.sort((a, b) => a.file.localeCompare(b.file));

  // ---- missing poses summary ----
  const missing = [];
  function collectMissing(items) {
    for (const item of items) {
      if (!item.missingPoses.length) continue;
      missing.push({
        id:    item.id,
        name:  item.name,
        kind:  item.kind || 'entity',
        poses: item.missingPoses,
        tried: item.missingPoses.map((p) => SPRITE_DIRS.map((d) => `${d}/${item.sprite || item.id}_${p}.png`)).flat(),
      });
    }
  }
  collectMissing(processedAppearances);
  collectMissing(processedCompanions);
  collectMissing(processedEnemies);
  collectMissing(processedBosses);

  // ---- emit ----
  const out = {
    generated:   new Date().toISOString(),
    spriteDirs:  SPRITE_DIRS,
    poses:       CANONICAL_POSES,
    appearances: processedAppearances,
    companions:  processedCompanions,
    enemies:     processedEnemies,
    bosses:      processedBosses,
    orphans,
    missing,
    totals: {
      appearances: processedAppearances.length,
      companions:  processedCompanions.length,
      enemies:     processedEnemies.length,
      bosses:      processedBosses.length,
      orphans:     orphans.length,
      missing:     missing.length,
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('[appearances-manifest] Wrote', path.relative(ROOT, OUT));
  console.log('[appearances-manifest] Totals:', out.totals);

  if (orphans.length) {
    console.warn(`[appearances-manifest] WARNING: ${orphans.length} orphan files (not referenced by any canonical entity).`);
  }
  if (missing.length) {
    console.warn(`[appearances-manifest] WARNING: ${missing.length} entries have missing poses.`);
  }
}

main();
