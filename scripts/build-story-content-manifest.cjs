#!/usr/bin/env node
/**
 * build-story-content-manifest.cjs
 *
 * Walks data/story/**\/*.json, finds every predicate field
 * (requires / condition / completeCondition / revealedBy / startCondition),
 * validates all leaf ops against the known op set and canonical reference
 * files, then emits public/assets/data/story/content-manifest.json.
 *
 * Exit 0 if clean (or data/story/ is empty).
 * Exit 1 if any predicate error is found.
 *
 * Run: node scripts/build-story-content-manifest.cjs
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT        = path.resolve(__dirname, '..');
const DATA_DIR    = path.join(ROOT, 'data', 'story');
const OUT_DIR     = path.join(ROOT, 'public', 'assets', 'data', 'story');
const OUT_FILE    = path.join(OUT_DIR, 'content-manifest.json');

// Canonical reference files
const CANONICAL = {
  flags:    loadJsonOrEmpty(path.join(DATA_DIR, 'canonical-flags.json')),
  factions: loadJsonOrEmpty(path.join(DATA_DIR, 'canonical-factions.json')),
  skills:   loadJsonOrEmpty(path.join(DATA_DIR, 'canonical-skills.json')),
  biomes:   loadJsonOrEmpty(path.join(DATA_DIR, 'canonical-biomes.json')),
  stats:    loadJsonOrEmpty(path.join(DATA_DIR, 'canonical-stats.json')),
};

// Derive lookup sets from canonical data
const KNOWN_FLAGS    = new Set((CANONICAL.flags || []).map(f => f.id));
const KNOWN_FACTIONS = new Set((CANONICAL.factions || []).map(f => f.id));
const KNOWN_SKILLS   = new Set(Array.isArray(CANONICAL.skills) ? CANONICAL.skills : []);
const KNOWN_STATS    = new Set(Array.isArray(CANONICAL.stats)  ? CANONICAL.stats  : []);

// Known predicate operators (leaf op names)
const KNOWN_OPS = new Set([
  'all', 'any', 'not',
  'flag', 'faction', 'quest', 'counter',
  'item', 'companion', 'class',
  'stat', 'skillCheck',
]);

// Predicate field names to scan for
const PRED_FIELDS = new Set([
  'requires', 'condition', 'completeCondition',
  'revealedBy', 'startCondition',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJsonOrEmpty(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip _generated and _rejected directories
      if (entry.name.startsWith('_')) continue;
      walkDir(full, results);
    } else if (entry.name.endsWith('.json') && !entry.name.startsWith('canonical-') && !entry.name.startsWith('_')) {
      // Files starting with '_' are test fixtures — skip predicate validation.
      results.push(full);
    }
  }
  return results;
}

/**
 * Recursively validate a predicate object.
 * Returns array of error strings (empty = ok).
 */
function validatePredicate(pred, filePath, fieldPath) {
  if (!pred || typeof pred !== 'object') return [];
  const errors = [];

  const keys = Object.keys(pred);

  // Determine the operator
  const opKey = keys.find(k => KNOWN_OPS.has(k));

  if (!opKey) {
    errors.push(`${filePath} [${fieldPath}]: unknown operator in ${JSON.stringify(pred)}`);
    return errors;
  }

  // Validate composites recursively
  if (opKey === 'all' || opKey === 'any') {
    if (!Array.isArray(pred[opKey])) {
      errors.push(`${filePath} [${fieldPath}]: "${opKey}" must be an array`);
    } else {
      for (let i = 0; i < pred[opKey].length; i++) {
        errors.push(...validatePredicate(pred[opKey][i], filePath, `${fieldPath}.${opKey}[${i}]`));
      }
    }
    return errors;
  }

  if (opKey === 'not') {
    errors.push(...validatePredicate(pred.not, filePath, `${fieldPath}.not`));
    return errors;
  }

  // Leaf ops: validate ref values
  if (opKey === 'flag') {
    const id = pred.flag;
    if (KNOWN_FLAGS.size > 0 && !KNOWN_FLAGS.has(id)) {
      errors.push(`${filePath} [${fieldPath}]: unknown flag "${id}" (not in canonical-flags.json)`);
    }
    return errors;
  }

  if (opKey === 'faction') {
    const id = pred.faction;
    if (KNOWN_FACTIONS.size > 0 && !KNOWN_FACTIONS.has(id)) {
      errors.push(`${filePath} [${fieldPath}]: unknown faction "${id}" (not in canonical-factions.json)`);
    }
    return errors;
  }

  if (opKey === 'stat') {
    const statId = pred.stat;
    if (KNOWN_STATS.size > 0 && !KNOWN_STATS.has(statId)) {
      errors.push(`${filePath} [${fieldPath}]: unknown stat "${statId}" (not in canonical-stats.json, expected STR/DEX/INT/CON)`);
    }
    return errors;
  }

  if (opKey === 'skillCheck') {
    const skill = pred.skillCheck;
    if (KNOWN_SKILLS.size > 0 && !KNOWN_SKILLS.has(skill)) {
      errors.push(`${filePath} [${fieldPath}]: unknown skill "${skill}" (not in canonical-skills.json)`);
    }
    return errors;
  }

  // quest, counter, item, companion, class — no canonical set yet (will grow)
  // Just validate structure.
  if (opKey === 'quest') {
    if (typeof pred.quest !== 'string') {
      errors.push(`${filePath} [${fieldPath}]: "quest" must be a string id`);
    }
    return errors;
  }

  return errors;
}

/**
 * Recursively find all predicate fields in a JSON object.
 * yields { fieldPath, pred }
 */
function* findPredicates(obj, parentPath = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      yield* findPredicates(obj[i], `${parentPath}[${i}]`);
    }
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    const fp = parentPath ? `${parentPath}.${k}` : k;
    if (PRED_FIELDS.has(k) && v && typeof v === 'object') {
      yield { fieldPath: fp, pred: v };
    }
    // Recurse regardless
    yield* findPredicates(v, fp);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = walkDir(DATA_DIR);

if (files.length === 0) {
  console.log('[story-manifest] data/story/ is empty — nothing to validate. Clean exit.');
  // Emit an empty manifest so downstream tooling doesn't 404.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    files: 0,
    predicates: 0,
    errors: 0,
    entries: [],
  }, null, 2));
  process.exit(0);
}

let totalErrors  = 0;
let totalPreds   = 0;
const entries    = [];

for (const filePath of files) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[story-manifest] parse error in ${filePath}: ${e.message}`);
    totalErrors++;
    continue;
  }

  const relPath    = path.relative(ROOT, filePath);
  const fileErrors = [];

  for (const { fieldPath, pred } of findPredicates(json)) {
    totalPreds++;
    const errs = validatePredicate(pred, relPath, fieldPath);
    fileErrors.push(...errs);
    totalErrors += errs.length;
    for (const err of errs) console.error('[story-manifest] ERROR:', err);
  }

  entries.push({ file: relPath, predicates: totalPreds, errors: fileErrors.length });
}

// Emit manifest
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({
  generatedAt: new Date().toISOString(),
  files: files.length,
  predicates: totalPreds,
  errors: totalErrors,
  entries,
}, null, 2));

// ---------------------------------------------------------------------------
// Emit quest-graph.json (for quest-graph.html tool)
// Reads data/story/quest-lines/*.json and outputs a structured DAG manifest.
// ---------------------------------------------------------------------------
(function emitQuestGraph() {
  const questLinesDir = path.join(DATA_DIR, 'quest-lines');
  if (!fs.existsSync(questLinesDir)) return;

  const questFiles = fs.readdirSync(questLinesDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'));

  const quests = [];
  for (const f of questFiles) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(questLinesDir, f), 'utf8')); }
    catch (_) { continue; }

    quests.push({
      id:             raw.id,
      title:          raw.title,
      act:            raw.act,
      category:       raw.category,
      summary:        raw.summary,
      startCondition: raw.startCondition,
      phases: (raw.phases || []).map(p => ({
        id:                 p.id,
        label:              p.label,
        completeCondition:  p.completeCondition,
        nextPhase:          p.nextPhase,
        onComplete:         p.onComplete || [],
      })),
      outcomes: (raw.outcomes || []).map(o => ({
        id:        o.id,
        condition: o.condition,
        effects:   o.effects || [],
      })),
    });
  }

  // Sort: primary first, then by act
  quests.sort((a, b) => {
    if (a.category === 'primary' && b.category !== 'primary') return -1;
    if (b.category === 'primary' && a.category !== 'primary') return 1;
    return (a.act || 0) - (b.act || 0);
  });

  const graphFile = path.join(OUT_DIR, 'quest-graph.json');
  fs.writeFileSync(graphFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    questCount:  quests.length,
    quests,
  }, null, 2));
  console.log(`[story-manifest] quest-graph.json — ${quests.length} quests written.`);
})();

if (totalErrors > 0) {
  console.error(`\n[story-manifest] ${totalErrors} predicate error(s) found. Build aborted.`);
  process.exit(1);
} else {
  console.log(`[story-manifest] OK — ${files.length} files, ${totalPreds} predicates, 0 errors.`);
  process.exit(0);
}
