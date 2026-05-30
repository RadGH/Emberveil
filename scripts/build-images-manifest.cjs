#!/usr/bin/env node
/**
 * build-images-manifest.cjs (M376)
 *
 * Walks public/images/ and emits public/assets/images-manifest.json — the
 * single source of truth for the Asset Gallery (assets/images.html).
 *
 * Goals:
 *   - List EVERY image on disk (no manual catalog drift).
 *   - Recognize class sprites (incl. male/female variants) for all classes
 *     listed in public/assets/data/classes.json.
 *   - Recognize boss / enemy / companion sprites by registry crossref.
 *   - Categorize backgrounds (combat_bg, map_bg, dialog_bg, menu_bg, news_hero),
 *     UI, particles, spell icons, portraits.
 *   - Dedupe: a sprite that maps to a class never falls into "other".
 *
 * Output schema:
 *   {
 *     generated: ISO timestamp,
 *     totals: { all, byCategory },
 *     classes: [ { id, name, gender:"male|female|unisex", poses:[...], files:[...] } ],
 *     bosses, enemies, companions: [{ id, files:[...] }],
 *     backgrounds: { combat:[], map:[], dialog:[], menu:[], news:[] },
 *     ui: [...], particles: [...], spell_icons: [...],
 *     other: [...]   // genuinely unclassified
 *   }
 *
 * Re-run any time. Idempotent.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const IMG = path.join(PUB, 'images');
const OUT = path.join(PUB, 'assets/images-manifest.json');

const SKIP_DIRS = new Set([
  '_bg-removal-backup',
  '_thumbs',
  'character_redesign_snapshots',
  'sprites_pixellab_archive',
  'sprites_pixellab_test',
  'sprites_pixelengine',
  'spritecook_war_dog_preview',
]);

const IMG_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;

function readJSON(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; }
}

function walk(dir, rel = '') {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...walk(full, r));
    } else if (IMG_EXT.test(e.name)) {
      const st = fs.statSync(full);
      out.push({ rel: r, abs: full, size: st.size });
    }
  }
  return out;
}

function loadClassIds() {
  const classes = readJSON(path.join(PUB, 'assets/data/classes.json'), []);
  return classes.map(c => ({ id: c.id, name: c.name }));
}

function loadEnemiesBosses() {
  const e = readJSON(path.join(PUB, 'assets/data/enemies.json'), []);
  const b = readJSON(path.join(PUB, 'assets/data/bosses.json'), []);
  return {
    enemies: (Array.isArray(e) ? e : []).map(x => x.id).filter(Boolean),
    bosses:  (Array.isArray(b) ? b : []).map(x => x.id).filter(Boolean),
  };
}

function loadCompanions() {
  const c = readJSON(path.join(PUB, 'assets/data/companions.json'), []);
  return (Array.isArray(c) ? c : []).map(x => x.id).filter(Boolean);
}

const POSE_TOKENS = ['south','east','west','north','portrait','attack','block','ko','spell','idle','run','hurt','death','flipped','preview','reference'];

function parseFilename(name) {
  // strip extension
  const base = name.replace(/\.(png|jpe?g|webp|svg|gif)$/i, '');
  // detect gender token
  // No "unisex" — every sprite is either male or female.
  // Suffix rule: _female → female, _male → male.
  // If neither suffix, the file uses a base id with no gender suffix.
  // We mark it 'inferred' so the caller can cross-reference against the
  // appearances registry to resolve to the correct gender. The legacy
  // 'unisex' label is removed per user requirement.
  let gender = 'inferred'; // resolved from appearances.json; never 'unisex'
  let work = base;
  if (/_female(_|$)/.test(work)) { gender = 'female'; work = work.replace(/_female/, ''); }
  else if (/_male(_|$)/.test(work))   { gender = 'male'; work = work.replace(/_male/, ''); }
  // detect pose tokens (one or more trailing)
  const poses = [];
  let id = work;
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of POSE_TOKENS) {
      const rx = new RegExp('_' + t + '$');
      if (rx.test(id)) { poses.unshift(t); id = id.replace(rx, ''); changed = true; break; }
    }
  }
  return { id, gender, poses };
}

function main() {
  console.log('[manifest] walking', IMG);
  const all = walk(IMG);
  console.log('[manifest] found', all.length, 'image files');

  const classList = loadClassIds();
  const classIdSet = new Set(classList.map(c => c.id));
  const { enemies, bosses } = loadEnemiesBosses();
  const enemySet = new Set(enemies);
  const bossSet = new Set(bosses);
  const compSet = new Set(loadCompanions());

  const byClass = new Map();   // key: id|gender → entry
  const byBoss = new Map();
  const byEnemy = new Map();
  const byCompanion = new Map();
  const byUnknown = new Map();
  const backgrounds = { combat:[], map:[], dialog:[], menu:[], news:[] };
  const ui = [], particles = [], spell_icons = [], portraits_misc = [], other = [];

  function pushClass(id, gender, file) {
    const cls = classList.find(c => c.id === id);
    const key = id + '|' + gender;
    let e = byClass.get(key);
    if (!e) {
      e = { id, name: cls ? cls.name : id, gender, files: [] };
      byClass.set(key, e);
    }
    e.files.push(file);
  }
  function pushTo(map, id, file) {
    let e = map.get(id);
    if (!e) { e = { id, files: [] }; map.set(id, e); }
    e.files.push(file);
  }

  for (const f of all) {
    const file = f.rel; // relative to public/images
    const top = file.split('/')[0];
    const name = path.basename(file);

    // Top-level dir routing first.
    if (top === 'combat_bg')  { backgrounds.combat.push({ file, name }); continue; }
    if (top === 'map_bg')     { backgrounds.map.push({ file, name }); continue; }
    if (top === 'dialog_bg')  { backgrounds.dialog.push({ file, name }); continue; }
    if (top === 'menu_bg')    { backgrounds.menu.push({ file, name }); continue; }
    if (top === 'news_hero')  { backgrounds.news.push({ file, name }); continue; }
    if (top === 'ui')         { ui.push({ file, name }); continue; }
    if (top === 'particles' || top === 'tap_fx') { particles.push({ file, name }); continue; }
    if (top === 'spell-icons') { spell_icons.push({ file, name }); continue; }
    if (top === 'portraits')   { portraits_misc.push({ file, name }); continue; }
    if (top === 'dragon_expansion') { backgrounds.news.push({ file, name }); continue; }

    // Sprite dirs: openai_v2 (M463), spritecook, sprites, pixellab, bosses, sprites_pixelengine (skipped)
    if (top === 'openai_v2' || top === 'spritecook' || top === 'sprites' || top === 'pixellab' || top === 'bosses') {
      const parsed = parseFilename(name);
      const entry = { file, name, pose: parsed.poses.join('+'), gender: parsed.gender };

      if (classIdSet.has(parsed.id)) { pushClass(parsed.id, parsed.gender, entry); continue; }
      if (bossSet.has(parsed.id))    { pushTo(byBoss,   parsed.id, entry); continue; }
      if (enemySet.has(parsed.id))   { pushTo(byEnemy,  parsed.id, entry); continue; }
      if (compSet.has(parsed.id))    { pushTo(byCompanion, parsed.id, entry); continue; }

      // Heuristic boss detection: id ends in _boss
      if (/_boss$/.test(parsed.id) || /^.+_boss_.+$/.test(parsed.id)) {
        pushTo(byBoss, parsed.id.replace(/_boss$/, '_boss'), entry);
        continue;
      }
      // Companion heuristic: top dir == spritecook + id has companion-like pattern,
      // or contains common pet tokens.
      if (/(_pet|_familiar|_companion)$/.test(parsed.id)) {
        pushTo(byCompanion, parsed.id, entry); continue;
      }

      // Heuristic: anything ending in _portrait that we don't know goes to portraits_misc
      if (parsed.poses.includes('portrait')) { portraits_misc.push(entry); continue; }

      // Bucket remaining by parsed.id so the page can group "unknown character X
      // poses" together rather than 10 entries scattered across "other".
      pushTo(byUnknown, parsed.id, entry);
      continue;
    }

    // Anything else is genuine other.
    other.push({ file, name });
  }

  // Sort + emit.
  function sortFiles(arr) { arr.sort((a,b) => a.file.localeCompare(b.file)); return arr; }
  for (const k of ['combat','map','dialog','menu','news']) sortFiles(backgrounds[k]);
  sortFiles(ui); sortFiles(particles); sortFiles(spell_icons); sortFiles(portraits_misc); sortFiles(other);

  const classesOut = [];
  // Render every class from registry: only male and female (no 'unisex').
  // Sprites with 'inferred' gender (no _male/_female suffix) are treated as
  // the opposite gender from the explicitly-suffixed variant for that class.
  // e.g. if bard_female_*.png exists but bard_*.png has no suffix,
  // bard_*.png is implicitly male.
  for (const c of classList) {
    for (const gender of ['male', 'female']) {
      const key = c.id + '|' + gender;
      const e = byClass.get(key);
      if (!e) continue;
      sortFiles(e.files);
      classesOut.push(e);
    }
    // Check 'inferred' bucket: if a class has inferred-gender sprites,
    // assign them to the gender the class does NOT already have.
    const inferredKey = c.id + '|inferred';
    const inferred = byClass.get(inferredKey);
    if (inferred) {
      const haveMale   = byClass.has(c.id + '|male');
      const haveFemale = byClass.has(c.id + '|female');
      // If only female is explicitly labeled, inferred = male (and vice-versa).
      const assignGender = haveFemale ? 'male' : (haveMale ? 'female' : 'male');
      inferred.gender = assignGender;
      sortFiles(inferred.files);
      classesOut.push(inferred);
    }
    // Surface missing variants as placeholders.
    const haveMale   = byClass.has(c.id + '|male')   || (byClass.has(c.id + '|inferred') && !byClass.has(c.id + '|female'));
    const haveFemale = byClass.has(c.id + '|female') || (byClass.has(c.id + '|inferred') && !byClass.has(c.id + '|male'));
    if (!haveMale)   classesOut.push({ id: c.id, name: c.name, gender: 'male',   files: [], missing: true });
    if (!haveFemale) classesOut.push({ id: c.id, name: c.name, gender: 'female', files: [], missing: true });
  }

  function mapToArr(m) { return Array.from(m.values()).map(e => { sortFiles(e.files); return e; }).sort((a,b)=>a.id.localeCompare(b.id)); }

  const out = {
    generated: new Date().toISOString(),
    totals: {
      all: all.length,
      classes: classesOut.reduce((s,c)=>s+c.files.length,0),
      bosses:  Array.from(byBoss.values()).reduce((s,e)=>s+e.files.length,0),
      enemies: Array.from(byEnemy.values()).reduce((s,e)=>s+e.files.length,0),
      companions: Array.from(byCompanion.values()).reduce((s,e)=>s+e.files.length,0),
      backgrounds: Object.values(backgrounds).reduce((s,a)=>s+a.length,0),
      ui: ui.length, particles: particles.length, spell_icons: spell_icons.length,
      portraits_misc: portraits_misc.length, other: other.length,
      unknown_characters: Array.from(byUnknown.values()).reduce((s,e)=>s+e.files.length,0),
    },
    classes: classesOut,
    bosses: mapToArr(byBoss),
    enemies: mapToArr(byEnemy),
    companions: mapToArr(byCompanion),
    unknown_characters: mapToArr(byUnknown),
    backgrounds,
    ui, particles, spell_icons, portraits_misc, other,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('[manifest] wrote', OUT);
  console.log('[manifest] totals:', out.totals);
}

main();
