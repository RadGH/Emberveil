#!/usr/bin/env node
/**
 * generate-data-catalogs.cjs (M242)
 *
 * Extracts structured game data from src/ JS files and writes compact JSON
 * catalogs that the /assets/ tool pages render. Five catalogs:
 *   - affixes         src/game/items.js → AFFIXES_ACT1 + SHIELD_AFFIXES
 *   - encounters      CANONICAL public/data/combat/encounters.json
 *                     (+ entities/bosses.json for isBoss) — NOT scraped
 *   - quests          src/game/quests.js → MAIN_QUESTS + SIDE_QUESTS
 *   - passives        src/game/passives.js (all class trees)
 *   - status-effects  src/game/statusEffects.js (if present) or DSL-authored list
 *
 * Writes to public/assets/data/*.json. Idempotent.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public/assets/data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function writeJSON(name, data) {
  fs.writeFileSync(path.join(OUT_DIR, name + '.json'), JSON.stringify(data, null, 2));
  console.log(`  wrote ${name}.json (${Array.isArray(data) ? data.length : Object.keys(data).length} entries)`);
}

function extractAffixes() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/items.js'), 'utf8');
  // Crude but reliable: eval-parse the affix blocks as data
  const blockRe = /export const AFFIXES_ACT1\s*=\s*(\{[\s\S]*?^\});/m;
  const shieldRe = /export const SHIELD_AFFIXES\s*=\s*(\[[\s\S]*?^\]);/m;
  const affixes = { prefixes: [], suffixes: [], shield: [] };
  const b = blockRe.exec(src);
  if (b) {
    try {
      // eslint-disable-next-line no-new-func
      const data = (new Function('return ' + b[1]))();
      affixes.prefixes = data.prefixes || [];
      affixes.suffixes = data.suffixes || [];
    } catch (e) { console.error('affix parse:', e.message); }
  }
  const s = shieldRe.exec(src);
  if (s) {
    try {
      // eslint-disable-next-line no-new-func
      affixes.shield = (new Function('return ' + s[1]))();
    } catch (e) { console.error('shield parse:', e.message); }
  }
  return affixes;
}

// Phase 3 step 11: encounters catalog reads CANONICAL combat data — no
// regex scrape of mapData.js (the `export const ENCOUNTERS` literal is gone;
// it is now `= ENCOUNTERS_CANONICAL` built by dataLoader.js, so the old
// regex matched nothing and emitted 0 rows). Source of truth:
//   public/data/combat/encounters.json  + public/data/entities/bosses.json
// `isBoss` is derived from the canonical model: an encounter is a boss
// fight iff any enemy ref is a canonical boss entity OR it carries a
// bossLootRef. (The pre-migration scraped encounters.json had stale/wrong
// isBoss values — e.g. dragon_king_fight marked false — exactly the drift
// this migration removes.)
function extractEncounters() {
  const encPath  = path.join(ROOT, 'public/data/combat/encounters.json');
  const bossPath = path.join(ROOT, 'public/data/entities/bosses.json');
  if (!fs.existsSync(encPath)) {
    console.warn('[generate-data-catalogs] canonical encounters.json missing — emitting empty encounters catalog');
    return {};
  }
  const encDoc = JSON.parse(fs.readFileSync(encPath, 'utf8'));
  const encMap = encDoc.encounters || encDoc;
  let bossIds = new Set();
  if (fs.existsSync(bossPath)) {
    const bd = JSON.parse(fs.readFileSync(bossPath, 'utf8'));
    bossIds = new Set(Object.keys(bd.entities || bd || {}));
  }
  const out = {};
  for (const [id, enc] of Object.entries(encMap)) {
    const enemies = Array.isArray(enc.enemies) ? enc.enemies : [];
    const isBoss = !!enc.bossLootRef || enemies.some((g) => g && g.ref && bossIds.has(g.ref));
    out[id] = {
      id,
      name: enc.name || id,
      enemyCount: enemies.length,
      isBoss,
    };
  }
  return out;
}

function extractQuests() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/quests.js'), 'utf8');
  const main = [];
  const side = [];
  const mRe = /MAIN_QUESTS\s*=\s*\[([\s\S]*?)^\];/m;
  const sRe = /SIDE_QUESTS\s*=\s*\[([\s\S]*?)^\];/m;
  const grab = (text) => {
    const arr = [];
    const entries = text.split(/\n\s*\{\s*/).slice(1);
    for (const e of entries) {
      const body = e.split(/\n\s*\},?\s*\n/)[0];
      const get = (key) => {
        const m2 = new RegExp(`${key}:\\s*['"](.*?)['"]`).exec(body);
        return m2 ? m2[1] : null;
      };
      const getNum = (key) => {
        const m2 = new RegExp(`${key}:\\s*(\\d+)`).exec(body);
        return m2 ? parseInt(m2[1], 10) : null;
      };
      arr.push({
        id: get('id'),
        title: get('title'),
        act: getNum('act'),
        giver: get('giver'),
        target: get('target'),
        summary: get('summary'),
      });
    }
    return arr.filter(x => x.id);
  };
  const mm = mRe.exec(src); if (mm) main.push(...grab(mm[1]));
  const ss = sRe.exec(src); if (ss) side.push(...grab(ss[1]));
  return { main, side };
}

function extractPassives() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/passives.js'), 'utf8');
  // Pull the N node-map first (each entry has id/name/desc inline).
  const nMap = {};
  const nRe = /const N\s*=\s*\{([\s\S]*?)\n\};/m;
  const nMatch = nRe.exec(src);
  if (nMatch) {
    const body = nMatch[1];
    const entryRe = /^\s*(\w+):\s*\{\s*id:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]\s*,\s*desc:\s*['"]([^'"]*)['"]/gm;
    let e;
    while ((e = entryRe.exec(body)) !== null) {
      const [, varName, id, name, desc] = e;
      nMap[varName] = { id, name, desc };
    }
  }
  // Then parse PASSIVE_TREES: { warrior: [N.toughness, ...], ... }
  const out = {};
  const treesRe = /export const PASSIVE_TREES\s*=\s*\{([\s\S]*?)\n\};/m;
  const tm = treesRe.exec(src);
  if (!tm) return out;
  const body = tm[1];
  const classRe = /(\w+):\s*\[([^\]]+)\]/g;
  let c;
  while ((c = classRe.exec(body)) !== null) {
    const [, classId, refs] = c;
    const nodes = refs.match(/N\.(\w+)/g) || [];
    out[classId] = nodes
      .map(ref => nMap[ref.slice(2)])
      .filter(Boolean);
  }
  return out;
}

function extractStatusEffects() {
  // Scan every src/ JS file for `type: 'foo'` patterns inside status object
  // literals. Much higher recall than the earlier statusModel-only scan.
  const collected = new Map();
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) { if (!full.includes('__tests__')) walk(full); continue; }
      if (!/\.(js|cjs|mjs)$/.test(f)) continue;
      const src = fs.readFileSync(full, 'utf8');
      const re = /type\s*:\s*['"]([a-z][a-z_]{2,32})['"]/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const v = m[1];
        // skip runtime type markers (e.g. damage type = 'magic'/'physical/'true')
        if (['magic','physical','true','heal','ability','physic'].includes(v)) continue;
        collected.set(v, (collected.get(v) || 0) + 1);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  // Label groups: 5 DoT / 5 debuff / 3 buff / etc.
  const FAMILY = {
    burn: 'DoT', poison: 'DoT', bleed: 'DoT',
    stun: 'control', silenced: 'control', blind: 'control', slow: 'control', frozen: 'control', fear: 'control', freeze: 'control', root: 'control',
    barrier: 'defensive', reviveImmune: 'defensive', reflective: 'defensive', counterStance: 'defensive', untargetable: 'defensive', magic_reflect: 'defensive', soulbind: 'defensive',
    marked: 'offensive', channeling: 'offensive', momentum: 'offensive', empowered: 'offensive', dmgBuff: 'offensive', critBonus: 'offensive', spellDmgBuff: 'offensive',
    soul_tether: 'link', redirect_to_caster: 'link',
  };
  return [...collected.entries()]
    .filter(([, n]) => n >= 2) // appear at least twice to filter noise
    .map(([id]) => ({ id, family: FAMILY[id] || 'misc' }))
    .sort((a, b) => (a.family + a.id).localeCompare(b.family + b.id));
}

function main() {
  console.log('Generating /assets/data/*.json catalogs:');
  writeJSON('affixes',        extractAffixes());
  writeJSON('encounters',     extractEncounters());
  writeJSON('quests',         extractQuests());
  writeJSON('passives',       extractPassives());
  writeJSON('status-effects', extractStatusEffects());
}
main();
