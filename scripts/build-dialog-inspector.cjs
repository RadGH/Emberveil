#!/usr/bin/env node
/**
 * build-dialog-inspector.cjs (M442)
 *
 * Scans dialog/encounter/map sources and emits a single JSON dump used by
 * /assets/dialog-inspector.html. The page renders the dump as a tree of
 * editable entries; the script must stay idempotent and tolerant of partial
 * source-eval failures (we degrade per-section rather than fail the build).
 *
 * Sources scanned:
 *   src/maps/mapData.js   — DIALOG_EVENTS, ENCOUNTERS, HIDDEN_BOSS_*,
 *                           BIG_FIGHT_NODE_OVERRIDES, NODE_TYPES, ENEMIES*,
 *                           PROLOGUE_ZONES + ACT1..ACT6_ZONES,
 *                           M304_DIALOG_NODES (private const, regex-extracted)
 *   src/maps/randomEvents.js  — RANDOM_EVENTS
 *   src/game/bossDeathDialog.js — BOSS_DEATH_DIALOG
 *
 * Output: public/assets/data/dialog-inspector.json
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const OUT_DIR  = path.join(ROOT, 'public/assets/data');
const OUT_FILE = path.join(OUT_DIR, 'dialog-inspector.json');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const MAP_FILE  = path.join(ROOT, 'src/maps/mapData.js');
const RAND_FILE = path.join(ROOT, 'src/maps/randomEvents.js');
const BOSS_FILE = path.join(ROOT, 'src/game/bossDeathDialog.js');

const mapSrc  = fs.readFileSync(MAP_FILE,  'utf8');
const randSrc = fs.readFileSync(RAND_FILE, 'utf8');
const bossSrc = fs.readFileSync(BOSS_FILE, 'utf8');

// ---------------------------------------------------------------------------
// Eval helpers
// ---------------------------------------------------------------------------

/**
 * Extract the right-hand expression of `export const NAME = <expr>;` (or
 * `const NAME = <expr>;` for private consts). The expression may contain
 * nested braces / brackets, so we balance-match instead of regex-non-greedy.
 *
 * Returns { expr, lineHint } or null.
 */
function extractExpr(src, name, opts = {}) {
  const exported = opts.exported !== false;
  const re = exported
    ? new RegExp(`export\\s+const\\s+${name}\\s*=\\s*`, 'm')
    : new RegExp(`(?:^|\\n)const\\s+${name}\\s*=\\s*`, 'm');
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  let i = start;
  // Find the literal start char ({ or [) to balance against.
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) {
    // primitive literal — just take to next semicolon/newline
    const semi = src.indexOf(';', i);
    return { expr: src.slice(i, semi).trim(), lineHint: src.slice(0, m.index).split('\n').length };
  }
  let depth = 0;
  let inStr = null;
  let inLine = false, inBlock = false;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; continue; }
    if (c === '/' && n === '*') { inBlock = true; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open)  depth++;
    else if (c === close) { depth--; if (depth === 0) { i++; break; } }
  }
  return { expr: src.slice(start, i).trim().replace(/;$/, ''), lineHint: src.slice(0, m.index).split('\n').length };
}

function safeEval(expr, scope = {}) {
  // eslint-disable-next-line no-new-func
  const keys = Object.keys(scope);
  const vals = keys.map((k) => scope[k]);
  try {
    return (new Function(...keys, 'return (' + expr + ');'))(...vals);
  } catch (e) {
    console.warn(`  [dialog-inspector] eval failed: ${e.message}`);
    return null;
  }
}

/** Find the line-number of an `objectKey:` or `id: 'objectKey'` inside a slice. */
function lineForKey(src, sliceStart, key) {
  // Try `key:` first
  const reKey = new RegExp(`(^|\\n)\\s*${key}\\s*:`);
  let m = reKey.exec(src.slice(sliceStart));
  if (m) {
    return src.slice(0, sliceStart + m.index + m[1].length).split('\n').length;
  }
  // Then `id: 'key'`
  const reId = new RegExp(`id\\s*:\\s*['"]${key}['"]`);
  m = reId.exec(src.slice(sliceStart));
  if (m) {
    return src.slice(0, sliceStart + m.index).split('\n').length;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Pull supporting data first (NODE_TYPES, ENEMIES*, etc.) so we can
//    eval the things that spread them.
// ---------------------------------------------------------------------------

const NODE_TYPES_E = extractExpr(mapSrc, 'NODE_TYPES');
const NODE_TYPES   = NODE_TYPES_E ? safeEval(NODE_TYPES_E.expr) : null;

const ENEMIES_E       = extractExpr(mapSrc, 'ENEMIES');
const ENEMIES         = ENEMIES_E ? safeEval(ENEMIES_E.expr) : {};
const ENEMIES_ACT4_E  = extractExpr(mapSrc, 'ENEMIES_ACT4');
const ENEMIES_ACT4    = ENEMIES_ACT4_E ? safeEval(ENEMIES_ACT4_E.expr) : {};
const ENEMIES_ACT5_E  = extractExpr(mapSrc, 'ENEMIES_ACT5');
const ENEMIES_ACT5    = ENEMIES_ACT5_E ? safeEval(ENEMIES_ACT5_E.expr) : {};
const ENEMIES_ACT6_E  = extractExpr(mapSrc, 'ENEMIES_ACT6');
const ENEMIES_ACT6    = ENEMIES_ACT6_E ? safeEval(ENEMIES_ACT6_E.expr) : {};

const MAP_SCOPE = { ENEMIES, ENEMIES_ACT4, ENEMIES_ACT5, ENEMIES_ACT6, NODE_TYPES };

// ---------------------------------------------------------------------------
// 2. DIALOG_EVENTS
// ---------------------------------------------------------------------------

const dialogEvents = [];
const DIALOG_EVENTS_E = extractExpr(mapSrc, 'DIALOG_EVENTS');
if (DIALOG_EVENTS_E) {
  const obj = safeEval(DIALOG_EVENTS_E.expr, MAP_SCOPE);
  if (obj && typeof obj === 'object') {
    // Anchor for line-hint search starts at the export.
    const exportIdx = mapSrc.indexOf('export const DIALOG_EVENTS');
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      const lineHint = lineForKey(mapSrc, exportIdx, key) || DIALOG_EVENTS_E.lineHint;
      const branching = !!(v && v.nodes);
      const meta = collectDialogMeta(v);
      dialogEvents.push({
        _meta: {
          sourceFile: 'src/maps/mapData.js',
          exportName: 'DIALOG_EVENTS',
          objectKey: key,
          lineHint,
          setsFlags: meta.setsFlags,
          requiresFlags: meta.requiresFlags,
          rewardsPresent: meta.rewardsPresent,
          hasSkillChecks: meta.hasSkillChecks,
        },
        id: v.id || key,
        npcName: v.npcName || null,
        npcPortrait: v.npcPortrait || null,
        bg: v.bg || null,
        dialogType: branching ? 'branching' : 'flat',
        start: v.start || null,
        nodes: branching ? v.nodes : null,
        lines: branching ? null : (v.lines || null),
        choices: branching ? null : (v.choices || null),
        outcomes: branching ? null : (v.outcomes || null),
      });
    }
  }
}

function collectDialogMeta(v) {
  const setsFlags = new Set();
  const requiresFlags = new Set();
  let rewardsPresent = false;
  let hasSkillChecks = false;
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    for (const k of Object.keys(n)) {
      const val = n[k];
      if (k === 'setFlag' && typeof val === 'string') setsFlags.add(val);
      else if (k === 'reward') rewardsPresent = true;
      else if (k === 'requires' && val && typeof val === 'object') {
        if (val.flag) requiresFlags.add(val.flag);
      }
      else if (k === 'skillCheck') hasSkillChecks = true;
      else if (val && typeof val === 'object') walk(val);
    }
  }
  walk(v);
  return {
    setsFlags: [...setsFlags],
    requiresFlags: [...requiresFlags],
    rewardsPresent,
    hasSkillChecks,
  };
}

// ---------------------------------------------------------------------------
// 3. RANDOM_EVENTS
// ---------------------------------------------------------------------------

const randomEvents = [];
const RAND_E = extractExpr(randSrc, 'RANDOM_EVENTS');
if (RAND_E) {
  const arr = safeEval(RAND_E.expr);
  if (Array.isArray(arr)) {
    const exportIdx = randSrc.indexOf('export const RANDOM_EVENTS');
    arr.forEach((v, idx) => {
      const lineHint = v.id ? (lineForKey(randSrc, exportIdx, v.id) || RAND_E.lineHint) : RAND_E.lineHint;
      const meta = collectDialogMeta(v);
      randomEvents.push({
        _meta: {
          sourceFile: 'src/maps/randomEvents.js',
          exportName: 'RANDOM_EVENTS',
          arrayIndex: idx,
          lineHint,
          setsFlags: meta.setsFlags,
          requiresFlags: meta.requiresFlags,
          rewardsPresent: meta.rewardsPresent,
          hasSkillChecks: meta.hasSkillChecks,
        },
        id: v.id || `event_${idx}`,
        minLevel: v.minLevel ?? null,
        zone: v.zone ?? null,
        npcName: v.npcName || null,
        npcPortrait: v.npcPortrait || null,
        lines: v.lines || null,
        choices: v.choices || null,
        outcomes: v.outcomes || null,
      });
    });
  }
}

// ---------------------------------------------------------------------------
// 4. BOSS_DEATH_DIALOG
// ---------------------------------------------------------------------------

const bossDeathDialogs = [];
const BOSS_E = extractExpr(bossSrc, 'BOSS_DEATH_DIALOG');
if (BOSS_E) {
  const obj = safeEval(BOSS_E.expr);
  if (obj && typeof obj === 'object') {
    const exportIdx = bossSrc.indexOf('export const BOSS_DEATH_DIALOG');
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      const lineHint = lineForKey(bossSrc, exportIdx, key) || BOSS_E.lineHint;
      bossDeathDialogs.push({
        _meta: {
          sourceFile: 'src/game/bossDeathDialog.js',
          exportName: 'BOSS_DEATH_DIALOG',
          objectKey: key,
          lineHint,
        },
        id: key,
        bossLine: v.bossLine || '',
        heroLine: v.heroLine || '',
        narratorLine: v.narratorLine || '',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 5. ENCOUNTERS (+ HIDDEN_BOSS_ENCOUNTERS)
// ---------------------------------------------------------------------------

const encounters = [];

function pushEncounters(rawObj, exportName, group, srcStr) {
  const exportIdx = srcStr.indexOf(`export const ${exportName}`);
  for (const key of Object.keys(rawObj || {})) {
    const v = rawObj[key];
    if (!v || typeof v !== 'object') continue;
    const lineHint = lineForKey(srcStr, exportIdx, key) || null;
    const enemies = Array.isArray(v.enemies) ? v.enemies.map(normaliseEnemy) : [];
    const isBoss = enemies.some((e) => e && e.isBoss) || /boss|titan|sovereign|architect|king|unraveler|ember|stalker|herald/i.test(key);
    encounters.push({
      _meta: {
        sourceFile: 'src/maps/mapData.js',
        exportName,
        objectKey: key,
        lineHint,
        encounterGroup: group,
      },
      id: key,
      name: v.name || key,
      introText: v.introText || null,
      encounterGroup: group,
      isBoss,
      enemies,
      bossLoot: v.bossLoot || null,
    });
  }
}

function normaliseEnemy(e) {
  if (!e || typeof e !== 'object') return e;
  return {
    id: e.id || null,
    name: e.name || null,
    count: e.count ?? 1,
    hp: e.hp ?? null,
    dmg: e.dmg || null,
    armor: e.armor ?? null,
    hit: e.hit ?? null,
    dodge: e.dodge ?? null,
    xpValue: e.xpValue ?? null,
    isBoss: !!e.isBoss,
    spellList: e.spellList || null,
    spellChance: e.spellChance ?? null,
    statusOnHit: e.statusOnHit || null,
  };
}

const ENCOUNTERS_E = extractExpr(mapSrc, 'ENCOUNTERS');
if (ENCOUNTERS_E) {
  const obj = safeEval(ENCOUNTERS_E.expr, MAP_SCOPE);
  if (obj) pushEncounters(obj, 'ENCOUNTERS', 'main', mapSrc);
}

const HBE = extractExpr(mapSrc, 'HIDDEN_BOSS_ENCOUNTERS');
if (HBE) {
  const obj = safeEval(HBE.expr, MAP_SCOPE);
  if (obj) pushEncounters(obj, 'HIDDEN_BOSS_ENCOUNTERS', 'hidden_boss', mapSrc);
}

// ---------------------------------------------------------------------------
// 6. M304_DIALOG_NODES (private const) — used to tag injected nodes
// ---------------------------------------------------------------------------

const M304_E = extractExpr(mapSrc, 'M304_DIALOG_NODES', { exported: false });
const M304 = M304_E ? (safeEval(M304_E.expr) || []) : [];
const M304_BY_ID = new Map();
for (const dn of M304) M304_BY_ID.set(dn.id, dn);

// ---------------------------------------------------------------------------
// 7. HIDDEN_BOSS_NODES — emitted as map nodes too
// ---------------------------------------------------------------------------

const HBN_E = extractExpr(mapSrc, 'HIDDEN_BOSS_NODES');
const HBN = HBN_E ? (safeEval(HBN_E.expr, MAP_SCOPE) || []) : [];
const HBN_BY_ZONE = new Map();
for (const n of HBN) {
  if (!HBN_BY_ZONE.has(n.parentZone)) HBN_BY_ZONE.set(n.parentZone, []);
  HBN_BY_ZONE.get(n.parentZone).push(n);
}

// ---------------------------------------------------------------------------
// 8. Zones → mapNodes
// ---------------------------------------------------------------------------

const ZONE_EXPORTS = ['PROLOGUE_ZONES', 'ACT1_ZONES', 'ACT2_ZONES', 'ACT3_ZONES', 'ACT4_ZONES', 'ACT5_ZONES', 'ACT6_ZONES'];
const mapNodes = [];

for (const exportName of ZONE_EXPORTS) {
  const E = extractExpr(mapSrc, exportName);
  if (!E) continue;
  const arr = safeEval(E.expr, MAP_SCOPE);
  if (!Array.isArray(arr)) continue;
  const exportIdx = mapSrc.indexOf(`export const ${exportName}`);
  for (const zone of arr) {
    const zoneId = zone.id;
    const zoneName = zone.name || zoneId;
    const act = zone.act ?? null;
    for (const node of (zone.nodes || [])) {
      const lineHint = lineForKey(mapSrc, exportIdx, node.id) || E.lineHint;
      const injected = M304_BY_ID.has(node.id) ? 'M304_DIALOG_NODES' : null;
      mapNodes.push({
        _meta: {
          sourceFile: 'src/maps/mapData.js',
          exportName,
          zoneId,
          nodeId: node.id,
          lineHint,
          injectedVia: injected,
        },
        id: node.id,
        zoneId,
        zoneName,
        act,
        type: node.type || null,
        name: node.name || node.id,
        x: node.x ?? null,
        y: node.y ?? null,
        exits: node.exits || [],
        encounter: node.encounter || null,
        dialogEventId: node.dialogEventId || null,
        shrineType: node.shrineType || null,
        skillCheck: node.skillCheck || null,
        hidden: !!node.hidden,
        precondition: node.precondition || null,
        noEvent: !!node.noEvent,
      });
    }
    // Append hidden boss nodes registered on this zone.
    const hbns = HBN_BY_ZONE.get(zoneId) || [];
    for (const hb of hbns) {
      mapNodes.push({
        _meta: {
          sourceFile: 'src/maps/mapData.js',
          exportName: 'HIDDEN_BOSS_NODES',
          zoneId,
          nodeId: hb.id,
          lineHint: lineForKey(mapSrc, mapSrc.indexOf('export const HIDDEN_BOSS_NODES'), hb.id) || null,
          injectedVia: 'HIDDEN_BOSS_NODES',
        },
        id: hb.id,
        zoneId,
        zoneName,
        act,
        type: hb.type || 'boss',
        name: hb.name || hb.id,
        x: hb.x ?? null,
        y: hb.y ?? null,
        exits: [],
        encounter: hb.encounterId || null,
        dialogEventId: null,
        shrineType: null,
        skillCheck: null,
        hidden: true,
        precondition: hb.precondition || null,
        noEvent: false,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 9. Write
// ---------------------------------------------------------------------------

const out = {
  generatedAt: new Date().toISOString(),
  dialogEvents,
  randomEvents,
  bossDeathDialogs,
  encounters,
  mapNodes,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`  [dialog-inspector] wrote ${path.relative(ROOT, OUT_FILE)}`);
console.log(`    dialogEvents=${dialogEvents.length}  randomEvents=${randomEvents.length}  boss=${bossDeathDialogs.length}  encounters=${encounters.length}  nodes=${mapNodes.length}`);
