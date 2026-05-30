#!/usr/bin/env node
/**
 * scripts/save-load-test.mjs — M301 Task 7
 *
 * Reads all save files from assets/references/emberveil/saves/, loads each
 * through the same code path the game uses (GameState.load()), verifies no
 * exceptions occur and all expected fields are present, and reports stats.
 *
 * Writes public/assets/data/save-load-test.json.
 *
 * Usage:
 *   node scripts/save-load-test.mjs
 *   node scripts/save-load-test.mjs --saves-dir=/custom/path
 *
 * Called by release.sh after build to also generate regression demo saves.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '../');

// Browser shims
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    documentElement: { style: {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => ({ forEach: () => {} }),
    createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
  };
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}
if (typeof globalThis.localStorage === 'undefined') {
  const _store = new Map();
  globalThis.localStorage = {
    getItem: k => _store.get(k) ?? null,
    setItem: (k, v) => _store.set(k, String(v)),
    removeItem: k => _store.delete(k),
    clear: () => _store.clear(),
  };
}
if (typeof globalThis.getComputedStyle === 'undefined') {
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
}

const { GameState } = await import(path.join(GAME_ROOT, 'src/game/gameState.js'));

// ── id-presence sets (Phase 1 canonical-data migration gate) ──────────────
// Every companion templateId and hero appearance id embedded in a save must
// resolve in the canonical JSON so that renaming/dropping an id in Phase 2
// will be caught here before it can orphan a saved party.
function buildIdPresenceSets() {
  const sets = { appearanceIds: new Set(), companionTemplateIds: new Set() };
  try {
    const heroesDoc = JSON.parse(fs.readFileSync(
      path.join(GAME_ROOT, 'public/data/entities/heroes.json'), 'utf8'));
    const npcsDoc = JSON.parse(fs.readFileSync(
      path.join(GAME_ROOT, 'public/data/entities/npcs.json'), 'utf8'));
    const appearances = [
      ...(Array.isArray(heroesDoc.entities) ? heroesDoc.entities : Object.values(heroesDoc.entities || {})),
      ...(Array.isArray(npcsDoc.entities)   ? npcsDoc.entities   : Object.values(npcsDoc.entities   || {})),
    ];
    for (const a of appearances) { if (a.id) sets.appearanceIds.add(a.id); }
  } catch { /* skip if files absent — pre-Phase-0 compat */ }
  try {
    const compDoc = JSON.parse(fs.readFileSync(
      path.join(GAME_ROOT, 'public/data/entities/companions.json'), 'utf8'));
    // classPets is a dict keyed by pet ID (the key IS the id)
    for (const petId of Object.keys(compDoc.classPets || {})) {
      sets.companionTemplateIds.add(petId);
    }
    // companions and hires are arrays of objects with id fields
    const companions = [
      ...(compDoc.companions || []),
      ...(compDoc.hires || []),
    ];
    for (const c of companions) {
      if (c.id)         sets.companionTemplateIds.add(c.id);
      if (c.templateId) sets.companionTemplateIds.add(c.templateId);
    }
  } catch { /* skip if absent */ }
  return sets;
}
const idSets = buildIdPresenceSets();

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const eq = a.indexOf('=');
      return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), true];
    })
);

const SAVES_DIR = args['saves-dir'] || '/home/radgh/claude/assets/references/emberveil/saves';
const OUT_PATH  = path.join(GAME_ROOT, 'public/assets/data/save-load-test.json');

// Required top-level fields after a valid load
const REQUIRED_FIELDS = ['party', 'gold', 'act'];

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

function loadSaveFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // Save format: { data: "<json-string>", heroName, saveVersion, ... }
  const dataStr = typeof raw.data === 'string' ? raw.data : JSON.stringify(raw.data || raw);
  const data    = JSON.parse(dataStr);
  return { raw, data };
}

const results = [];
let passCount = 0;
let failCount = 0;

if (!fs.existsSync(SAVES_DIR)) {
  console.warn(`Saves directory not found: ${SAVES_DIR}`);
  const out = {
    generated:  new Date().toISOString(),
    savesDir:   SAVES_DIR,
    totalFiles: 0,
    pass:       0,
    fail:       0,
    results:    [],
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  process.exit(0);
}

const saveFiles = fs.readdirSync(SAVES_DIR)
  .filter(f => f.endsWith('.json') && !f.startsWith('.'))
  // Skip the regression/ sub-directory files (those are outputs, not inputs)
  ;

console.log(`save-load-test: ${saveFiles.length} save file(s) in ${SAVES_DIR}`);

for (const fname of saveFiles) {
  const filePath = path.join(SAVES_DIR, fname);
  const stat     = { file: fname, pass: false, errors: [], warnings: [], fields: {} };

  try {
    const { raw, data } = loadSaveFile(filePath);
    stat.heroName    = raw.heroName || data.party?.[0]?.name || '(unknown)';
    stat.saveVersion = raw.saveVersion || data.saveVersion || null;
    stat.act         = data.act ?? null;
    stat.partySize   = Array.isArray(data.party) ? data.party.length : 0;

    // Attempt GameState.load() — this is the exact code path the game uses
    try {
      GameState.load(data);
    } catch (e) {
      stat.errors.push(`GameState.load threw: ${e.message}`);
    }

    // Verify required fields are present after load
    const gs = GameState.get();
    for (const f of REQUIRED_FIELDS) {
      const val = gs[f];
      stat.fields[f] = val !== undefined && val !== null;
      if (!stat.fields[f]) {
        stat.warnings.push(`Missing field after load: ${f}`);
      }
    }

    // Party sanity
    const party = gs.party || [];
    if (!party.length) {
      stat.warnings.push('Party is empty after load');
    } else {
      for (const m of party) {
        if (!m.name) stat.warnings.push(`Party member missing name`);
        if (!m.level) stat.warnings.push(`Party member ${m.name || '?'} missing level`);
      }
    }

    // ── id-presence assertions (Phase 1 canonical-data migration gate) ──
    // Verify every appearance id and companion templateId in this save
    // resolves in the canonical JSON. Failures here mean a Phase 2 rename
    // would orphan a saved party member.
    if (idSets.appearanceIds.size > 0) {
      const allMembers = [
        ...(gs.party || []),
        ...(gs.companions || []),
        ...(gs.bench || []),
      ];
      for (const m of allMembers) {
        // Hero/party member appearance id
        if (m.appearance && !idSets.appearanceIds.has(m.appearance)) {
          stat.errors.push(
            `id-presence: appearance "${m.appearance}" (member "${m.name || m.id || '?'}") not found in canonical heroes/npcs.json`
          );
        }
        // Companion templateId
        if (m.templateId && idSets.companionTemplateIds.size > 0 &&
            !idSets.companionTemplateIds.has(m.templateId)) {
          stat.warnings.push(
            `id-presence: companion templateId "${m.templateId}" (member "${m.name || '?'}") not found in canonical companions.json`
          );
        }
      }
    }

    stat.pass = stat.errors.length === 0;
    if (stat.pass) passCount++; else failCount++;
  } catch (e) {
    stat.errors.push(`Parse error: ${e.message}`);
    failCount++;
  }

  results.push(stat);
  const icon = stat.pass ? 'OK ' : 'ERR';
  console.log(`  [${icon}] ${fname} — ${stat.errors.length} error(s), ${stat.warnings.length} warning(s)`);
}

const out = {
  generated:  new Date().toISOString(),
  savesDir:   SAVES_DIR,
  totalFiles: saveFiles.length,
  pass:       passCount,
  fail:       failCount,
  results,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log(`\n${passCount}/${saveFiles.length} saves passed. Wrote ${OUT_PATH}`);

// ---------------------------------------------------------------------------
// Regression demo saves — generate 1 seeded demo save per act (Acts 1-5) and
// store under assets/references/emberveil/saves/regression/M{milestone}/.
// The milestone number is read from game_meta.json.
// ---------------------------------------------------------------------------
async function generateRegressionSaves() {
  const metaPath = path.join(GAME_ROOT, '../game13_releases/game_meta.json');
  if (!fs.existsSync(metaPath)) return;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const releases = meta.releases || {};
  const milestone = Math.max(...Object.keys(releases).map(Number).filter(n => !isNaN(n)), 0);
  if (!milestone) return;

  const { autoAssignAttrs, autoGenerateEquipment } = await import(path.join(GAME_ROOT, 'src/game/simulator.js'));

  const regDir = path.join(SAVES_DIR, `regression/M${milestone}`);
  fs.mkdirSync(regDir, { recursive: true });

  for (let act = 1; act <= 5; act++) {
    const seed  = 42 + act;
    const level = act === 1 ? 5 : act === 2 ? 10 : act === 3 ? 15 : act === 4 ? 20 : 25;
    const classes = ['warrior', 'mage', 'cleric'];
    const party = classes.map((cls, i) => ({
      id:        `reg_${cls}_act${act}`,
      name:      cls.charAt(0).toUpperCase() + cls.slice(1),
      class:     cls,
      cls,
      level,
      attrs:     autoAssignAttrs(cls, level),
      equipment: autoGenerateEquipment(cls, level),
      hp:        100,
      mp:        60,
      skills:    [],
    }));

    const demoState = {
      party,
      companions: [],
      bench: [],
      gold: 500 * act,
      act,
      zoneId: 'border_roads',
      nodeId: 'start',
      visitedNodes: ['start'],
      sneakedNodes: [],
      unlockedZones: ['border_roads'],
      completedBosses: [],
      fame: 0,
      ngPlus: 0,
      materials: {},
      settings: {},
      _regressionSeed: seed,
      _regressionMilestone: milestone,
    };

    const saveObj = {
      emberveilSingle: true,
      exportedAt:      new Date().toISOString(),
      saveVersion:     3,
      key:             `regression_act${act}_m${milestone}`,
      heroName:        `RegAct${act}`,
      data:            JSON.stringify(demoState),
    };

    const savePath = path.join(regDir, `act${act}_seed${seed}.json`);
    // Only write if the file doesn't already exist (idempotent)
    if (!fs.existsSync(savePath)) {
      fs.writeFileSync(savePath, JSON.stringify(saveObj, null, 2));
      console.log(`  Generated regression save: ${savePath}`);
    }
  }
}

await generateRegressionSaves();
