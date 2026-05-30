#!/usr/bin/env node
/**
 * build-image-review-manifest.cjs
 *
 * Builds public/assets/image-review-manifest.json by deriving entity lists
 * directly from the canonical game data source files, then cross-referencing
 * the filesystem for status (ready / pending / orphaned).
 *
 * Canonical sources (Phase 3 step 11 — CANONICAL JSON, no JS-source scrape;
 * the appearances.js/companions.js/mapData.js literals these used to regex
 * were deleted in Phase 1–2 and the scrapers emitted 0 rows):
 *   1. public/data/entities/heroes.json + npcs.json → hero/appearance IDs
 *   2. public/data/entities/companions.json classPets → pet companion IDs
 *   3. public/data/entities/companions.json companions[] → wild/tavern
 *      encounter companion IDs
 *   4. public/data/entities/enemies.json → enemy IDs
 *      public/data/entities/bosses.json  → boss IDs
 *   5. public/images/**         — filesystem scan      → background + orphan files
 *
 * Status values:
 *   ready        file exists on disk
 *   in_progress  referenced in memory/pixel_engine_jobs/ (future hook)
 *   pending      expected per registry but missing on disk
 *   orphaned     file on disk but not referenced in any registry or src/
 *
 * Re-run any time. Output is deterministic — no manual edits needed.
 *
 * Usage:
 *   node scripts/build-image-review-manifest.cjs
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUB  = path.join(ROOT, 'public');
const IMG  = path.join(PUB, 'images');
const SRC  = path.join(ROOT, 'src');

const ASSETS_JSON = path.join(PUB, 'assets/assets.json');
const SC_JSON     = path.join(IMG, 'spritecook/spritecook-assets.json');
const OUT         = path.join(PUB, 'assets/image-review-manifest.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

function listDir(p) {
  try { return fs.readdirSync(p).filter(f => !f.startsWith('.')); }
  catch { return []; }
}

function walk(p) {
  const out = [];
  (function rec(dir) {
    for (const f of listDir(dir)) {
      const full = path.join(dir, f);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) rec(full);
      else out.push(full);
    }
  })(p);
  return out;
}

function readSrc(relPath) {
  try { return fs.readFileSync(path.join(SRC, relPath), 'utf8'); } catch { return ''; }
}

// Phase 3 step 11: entity lists come from the canonical JSON in public/data/.
const CANON = path.join(PUB, 'data');
function readCanon(rel) {
  const p = path.join(CANON, rel);
  if (!fs.existsSync(p)) {
    console.error(`[manifest] FATAL: canonical file missing: ${path.relative(ROOT, p)}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function entitiesOf(doc) {
  if (doc && typeof doc === 'object' && 'entities' in doc) return doc.entities;
  return doc;
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

/**
 * Hero/appearance sprites from canonical heroes.json ∪ npcs.json.
 * Returns objects: { id, sprite }. Deprecated appearances are skipped
 * (they won't show in image-review), matching the old behaviour.
 */
function parseAppearances() {
  const heroes = entitiesOf(readCanon('entities/heroes.json'));
  const npcs   = entitiesOf(readCanon('entities/npcs.json'));
  const out = [];
  const seen = new Set();
  for (const doc of [heroes, npcs]) {
    const list = Array.isArray(doc) ? doc : Object.values(doc || {});
    for (const a of list) {
      if (!a || !a.id) continue;
      if (a.deprecated === true) continue;
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push({ id: a.id, sprite: a.sprite || a.id });
    }
  }
  return out;
}

/** Pet companion IDs = keys of canonical companions.json classPets. */
function parseClassPets() {
  const doc = readCanon('entities/companions.json');
  return Object.keys(doc.classPets || {}).filter((id) => id.startsWith('pet_'));
}

/**
 * Encounter / wild / tavern companion IDs = canonical companions.json
 * companions[] (the seeded-roll roster previously reached via
 * randomEvents.js reward.companion). hires[] are tavern hireables and were
 * never in this bucket — keep parity by excluding them.
 */
function parseEncounterCompanions() {
  const doc = readCanon('entities/companions.json');
  const seen = new Set();
  for (const c of (doc.companions || [])) { if (c && c.id) seen.add(c.id); }
  return [...seen];
}

/**
 * Enemy / boss IDs straight from the canonical entity JSON. enemies.json
 * and bosses.json are disjoint by construction (Phase 1/2), so no
 * encounter-table boss-resolution heuristic is needed — that whole
 * regex-walk existed only to recover inline ENCOUNTERS bosses the old
 * scraper couldn't see, which is exactly the bug this migration closes.
 */
function parseEnemiesAndBosses() {
  const enemies = entitiesOf(readCanon('entities/enemies.json'));
  const bosses  = entitiesOf(readCanon('entities/bosses.json'));
  return {
    enemyIds: Object.keys(enemies),
    bossIds:  Object.keys(bosses),
  };
}

// ─── Load data sources ────────────────────────────────────────────────────────

const assets   = readJSON(ASSETS_JSON, { images: [] });
const scAssets = readJSON(SC_JSON, {});

// Build a set of referenced files from assets.json
const referencedFiles = new Set();
for (const img of assets.images || []) {
  if (img.file) {
    const f = img.file.replace(/^\.\.\//, '');
    referencedFiles.add(path.posix.normalize(f));
  }
}
// SpriteCook manifest references
for (const [char, poses] of Object.entries(scAssets)) {
  if (char === '_meta' || typeof poses !== 'object') continue;
  for (const [, info] of Object.entries(poses)) {
    if (info && info.file) referencedFiles.add('images/spritecook/' + info.file);
  }
}

// Scan src/ for bare filename references (fallback for orphan detection)
function scanSrcForBasenames() {
  const basenames = new Set();
  const files = walk(SRC).filter(f => /\.(js|jsx|ts|tsx|json|html|css)$/.test(f));
  const rx = /([\w\-/]+\.(?:png|jpg|jpeg|webp|gif|svg))/gi;
  for (const f of files) {
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    let m;
    while ((m = rx.exec(txt))) basenames.add(path.basename(m[1]));
  }
  return basenames;
}
const srcBasenames = scanSrcForBasenames();

// ─── Derive entity lists from canonical sources ────────────────────────────────

console.log('[manifest] Parsing canonical game data sources...');

const APPEARANCES = parseAppearances();
console.log(`  Appearances (heroes): ${APPEARANCES.length} sprites`);

const PET_COMPANIONS     = parseClassPets();
console.log(`  CLASS_PETS companions: ${PET_COMPANIONS.length}`);

const ENCOUNTER_COMPANIONS = parseEncounterCompanions();
console.log(`  Encounter companions: ${ENCOUNTER_COMPANIONS.length}`);

// Merge: companions = pets + encounter companions (deduped, pets take priority)
const ALL_COMPANIONS = [...new Set([...PET_COMPANIONS, ...ENCOUNTER_COMPANIONS])];
console.log(`  Total unique companions: ${ALL_COMPANIONS.length}`);

const { enemyIds: ENEMY_IDS, bossIds: BOSS_IDS } = parseEnemiesAndBosses();
console.log(`  Enemies: ${ENEMY_IDS.length}`);
console.log(`  Bosses (from map nodes): ${BOSS_IDS.length}`);
console.log(`  Boss IDs: ${BOSS_IDS.join(', ')}`);

// ─── Pose sets ────────────────────────────────────────────────────────────────

// Heroes/appearances: full 7-pose set
const HERO_POSES = ['portrait','south','east','east_attack','east_spell','east_block','east_ko'];
// Companions: 5-pose set (no spell/block — see companions.js header)
const COMPANION_POSES = ['portrait','south','east','east_attack','east_ko'];
// Bosses: full 7-pose set
const BOSS_POSES = ['portrait','south','east','east_attack','east_spell','east_block','east_ko'];
// Enemies: 5-pose set (portrait + combat poses, mirrors companions)
const ENEMY_POSES = ['portrait','south','east','east_attack','east_ko'];

// ─── Filesystem scan ──────────────────────────────────────────────────────────

function fsFiles(relDir) {
  const abs = path.join(PUB, relDir);
  return listDir(abs).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
}

const portraitFiles = new Set(fsFiles('images/portraits'));
const openaiV2Files = new Set(fsFiles('images/openai_v2'));     // M463
const scFiles       = new Set(fsFiles('images/spritecook'));
const combatBgFiles = new Set(fsFiles('images/combat_bg'));
const mapBgFiles    = new Set(fsFiles('images/map_bg'));
const menuBgFiles   = new Set(fsFiles('images/menu_bg'));

/**
 * Resolve which sprite directory holds <id>_<pose>.png.
 * openai_v2 wins over spritecook (newer regenerations).
 * Returns { rel, dir } or null.
 */
function resolveSpritePath(filename) {
  if (openaiV2Files.has(filename)) return { rel: `images/openai_v2/${filename}`, dir: 'openai_v2' };
  if (scFiles.has(filename))       return { rel: `images/spritecook/${filename}`, dir: 'spritecook' };
  return null;
}

// Prompt lookup from assets.json by file basename
const promptByBasename = new Map();
for (const img of assets.images || []) {
  if (img.file && img.prompt) {
    promptByBasename.set(path.basename(img.file), img.prompt);
  }
}

// Art-direction overrides: /public/data/art_direction/<id>.json carries the
// authoritative per-frame prompt once the PixelLab pipeline has generated or
// approved a pose. These take precedence over assets.json.
const referenceSheets = [];  // appended as extra manifest entries below
try {
  const adDir = path.join(PUB, 'data', 'art_direction');
  if (fs.existsSync(adDir)) {
    for (const f of fs.readdirSync(adDir).filter(n => n.endsWith('.json'))) {
      const ad = JSON.parse(fs.readFileSync(path.join(adDir, f), 'utf8'));
      // M396 — fall back to the referenceSheet.prompt when an individual
      // frame doesn't carry its own prompt yet. This means freshly-generated
      // sprite sets show their identity/outfit/weapon notes on the review
      // page even before per-frame prompts get backfilled.
      const fallbackPrompt = ad.referenceSheet?.prompt
        || [ad.identity, ad.outfit, ad.weapons].filter(Boolean).join('\n\n')
        || null;
      if (ad.frames) {
        for (const [pose, frame] of Object.entries(ad.frames)) {
          if (!frame?.path) continue;
          const explicit = frame.prompt;
          const poseHint = ad[`${pose}Style`] || (pose === 'portrait' ? ad.portraitStyle : null);
          const composed = explicit
            || (fallbackPrompt && poseHint ? `${fallbackPrompt}\n\nPOSE (${pose}): ${poseHint}` : fallbackPrompt);
          if (composed) promptByBasename.set(path.basename(frame.path), composed);
        }
      }
      if (ad.referenceSheet?.path) {
        referenceSheets.push({
          spriteId: ad.spriteId,
          displayName: ad.displayName || ad.spriteId,
          file: '../' + ad.referenceSheet.path,
          prompt: ad.referenceSheet.prompt || fallbackPrompt,
          approvedAt: ad.referenceSheet.approvedAt || null,
        });
      }
    }
  }
} catch (e) {
  console.warn('[manifest] art_direction read failed:', e.message);
}

// ─── Build manifest entries ────────────────────────────────────────────────────

const entries = [];
const seenFiles = new Set(); // relative to public/

function makeEntry({ id, category, group, pose, fileRel, status }) {
  const prompt = promptByBasename.get(path.basename(fileRel)) || null;
  return {
    id, category, group, pose,
    file: '../' + fileRel,
    prompt,
    status,
  };
}

// HEROES — derive from APPEARANCES (canonical sprite source)
// Each appearance has a `sprite` prefix; expected poses = HERO_POSES.
for (const app of APPEARANCES) {
  const sprite = app.sprite;
  for (const pose of HERO_POSES) {
    const fname  = `${sprite}_${pose}.png`;
    const resolved = resolveSpritePath(fname);
    const rel = resolved ? resolved.rel : `images/spritecook/${fname}`;
    const exists = !!resolved;
    if (exists) seenFiles.add(rel);
    entries.push(makeEntry({
      id:       `hero_${sprite}_${pose}`,
      category: 'hero',
      group:    sprite,
      pose,
      fileRel:  rel,
      status:   exists ? 'ready' : 'pending',
    }));
  }
}

// COMPANIONS — all unique companion IDs (pets + encounter companions)
for (const comp of ALL_COMPANIONS) {
  for (const pose of COMPANION_POSES) {
    // Prefer openai_v2 → spritecook; fall back to portraits/ for portrait pose
    const scFname       = `${comp}_${pose}.png`;
    const portraitFname = `${comp}.png`;
    const resolved      = resolveSpritePath(scFname);
    let rel, exists;
    if (resolved) {
      rel = resolved.rel; exists = true;
    } else if (pose === 'portrait' && portraitFiles.has(portraitFname)) {
      rel = `images/portraits/${portraitFname}`; exists = true;
    } else {
      rel = `images/spritecook/${scFname}`; exists = false;
    }
    if (exists) seenFiles.add(rel);
    entries.push(makeEntry({
      id:       `companion_${comp}_${pose}`,
      category: 'companion',
      group:    comp,
      pose,
      fileRel:  rel,
      status:   exists ? 'ready' : 'pending',
    }));
  }
}

// BOSSES — from map node encounter IDs (type: 'boss')
for (const boss of BOSS_IDS) {
  for (const pose of BOSS_POSES) {
    const scFname       = `${boss}_${pose}.png`;
    const portraitFname = `${boss}.png`;
    const resolved      = resolveSpritePath(scFname);
    let rel, exists;
    if (resolved) {
      rel = resolved.rel; exists = true;
    } else if (pose === 'portrait' && portraitFiles.has(portraitFname)) {
      rel = `images/portraits/${portraitFname}`; exists = true;
    } else {
      rel = `images/spritecook/${scFname}`; exists = false;
    }
    if (exists) seenFiles.add(rel);
    entries.push(makeEntry({
      id:       `boss_${boss}_${pose}`,
      category: 'boss',
      group:    boss,
      pose,
      fileRel:  rel,
      status:   exists ? 'ready' : 'pending',
    }));
  }
}

// ENEMIES — all enemy IDs (non-boss) from ENEMIES + ENEMIES_ACT5
for (const en of ENEMY_IDS) {
  for (const pose of ENEMY_POSES) {
    const scFname       = `${en}_${pose}.png`;
    const portraitFname = `${en}.png`;
    const resolved      = resolveSpritePath(scFname);
    let rel, exists;
    if (resolved) {
      rel = resolved.rel; exists = true;
    } else if (pose === 'portrait' && portraitFiles.has(portraitFname)) {
      rel = `images/portraits/${portraitFname}`; exists = true;
    } else {
      rel = `images/spritecook/${scFname}`; exists = false;
    }
    if (exists) seenFiles.add(rel);
    entries.push(makeEntry({
      id:       `enemy_${en}_${pose}`,
      category: 'enemy',
      group:    en,
      pose,
      fileRel:  rel,
      status:   exists ? 'ready' : 'pending',
    }));
  }
}

// BACKGROUNDS
function addBgs(dirRel, set, category = 'background', groupLabel) {
  for (const f of [...set].sort()) {
    const rel = `${dirRel}/${f}`;
    seenFiles.add(rel);
    entries.push(makeEntry({
      id:       `bg_${groupLabel}_${f.replace(/\.[a-z]+$/i, '')}`,
      category,
      group:    groupLabel,
      pose:     null,
      fileRel:  rel,
      status:   'ready',
    }));
  }
}
addBgs('images/combat_bg', combatBgFiles, 'background', 'combat');
addBgs('images/map_bg',    mapBgFiles,    'background', 'map');
addBgs('images/menu_bg',   menuBgFiles,   'background', 'menu');

// TAP-WEAPONS — icons + effect/projectile art
const TAP_DIRS = ['images/tap_fx', 'images/tap_weapons', 'images/tap_effects'];
for (const tapRel of TAP_DIRS) {
  const files = fsFiles(tapRel);
  for (const f of [...files].sort()) {
    const rel = `${tapRel}/${f}`;
    seenFiles.add(rel);
    const base     = f.replace(/\.[a-z]+$/i, '');
    const dirLabel = tapRel.split('/').pop();
    entries.push(makeEntry({
      id:       `tap_${dirLabel}_${base}`,
      category: 'tap-weapons',
      group:    dirLabel,
      pose:     null,
      fileRel:  rel,
      status:   'ready',
    }));
  }
}

// ORPHANED — files on disk not in seenFiles and not referenced in src/ or assets.json
function addOrphans(relDir, set) {
  for (const f of [...set].sort()) {
    const rel = `${relDir}/${f}`;
    if (seenFiles.has(rel)) continue;
    if (referencedFiles.has(rel)) continue;
    if (srcBasenames.has(f)) continue;
    entries.push({
      id:       `orphan_${relDir.replace(/\//g, '_')}_${f.replace(/\.[a-z]+$/i, '')}`,
      category: 'orphan',
      group:    relDir,
      pose:     null,
      file:     '../' + rel,
      prompt:   null,
      status:   'orphaned',
    });
  }
}
addOrphans('images/portraits', portraitFiles);
addOrphans('images/spritecook', scFiles);
addOrphans('images/openai_v2', openaiV2Files);

// ─── Reference sheets (PixelLab redesign; not rendered in game) ──────────────
for (const r of referenceSheets) {
  entries.push({
    id:       `ref_sheet_${r.spriteId}`,
    category: 'reference-sheet',
    group:    r.spriteId,
    pose:     'reference_sheet',
    file:     r.file,
    prompt:   r.prompt,
    status:   r.approvedAt ? 'approved' : 'candidate',
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const byStatus   = entries.reduce((a, e) => { a[e.status] = (a[e.status] || 0) + 1; return a; }, {});
const byCategory = entries.reduce((a, e) => { a[e.category] = (a[e.category] || 0) + 1; return a; }, {});

const manifest = {
  _meta: {
    generated:    new Date().toISOString(),
    derivedFrom: {
      appearances:          `public/data/entities/heroes.json + npcs.json (${APPEARANCES.length} entries)`,
      classPets:            `public/data/entities/companions.json classPets (${PET_COMPANIONS.length} entries)`,
      encounterCompanions:  `public/data/entities/companions.json companions[] (${ENCOUNTER_COMPANIONS.length} unique)`,
      enemyIds:             `public/data/entities/enemies.json (${ENEMY_IDS.length} enemies)`,
      bossIds:              `public/data/entities/bosses.json (${BOSS_IDS.length} bosses)`,
    },
    counts: { total: entries.length, by_status: byStatus, by_category: byCategory },
    source: 'scripts/build-image-review-manifest.cjs',
    note:   'Manifest is computed from game data. Do not edit manually — re-run this script.',
  },
  entries,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${OUT}`);
console.log('Counts:', JSON.stringify(manifest._meta.counts, null, 2));
console.log('\nDerived from:');
for (const [k, v] of Object.entries(manifest._meta.derivedFrom)) {
  console.log(`  ${k}: ${v}`);
}
