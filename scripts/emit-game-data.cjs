#!/usr/bin/env node
/**
 * emit-game-data.cjs (M299 → canonical pass-through, Phase 3 step 10)
 *
 * Writes flat JSON files to public/assets/data/ for the devtool catalog
 * pages. Wired into `prebuild` in package.json so data is always fresh on
 * every release.
 *
 * ── Phase 3 rewrite ─────────────────────────────────────────────────────────
 * The four entity/combat domains (enemies, bosses, companions, appearances)
 * are now PASS-THROUGH projections of the canonical JSON in public/data/.
 * The old regex scrapers (tableRe / extractEnemies / extractCompanions /
 * extractAppearances) are DELETED — they only matched `export const ENEMIES*`
 * blocks and were structurally blind to inline ENCOUNTERS enemies
 * (giant_spider, the void/dragon roster, hidden bosses vault_guardian /
 * void_scholar / echo_sovereign / the_first_ember / the_unraveler), and
 * Phase 1–2 deleted the JS literals they scraped anyway (they emit 0 rows).
 *
 * Canonical → emitted shape mapping (explicit, documented; NO re-scrape):
 *
 *   public/data/entities/enemies.json  {entities:{id:{...}}}
 *     → enemies.json  Array<{id,name,act,hp,maxHp,dmg,armor,hit,dodge,
 *                              xpValue,magicResist,gold,loot,statusOnHit,
 *                              spellChance,spellList,blockChance,isBoss:false}>
 *   public/data/entities/bosses.json   {entities:{id:{...}}}
 *     → bosses.json   same shape, isBoss:true
 *       (enemies.json carries ONLY non-boss enemies so the two sets are
 *        disjoint, matching the legacy contract build-images-manifest.cjs +
 *        data-source.getBosses() expect.)
 *   public/data/combat/encounters.json {encounters:{key:{name,enemies:[{ref}]}}}
 *     → encounter-refs.json  { <entityId>: [<encounterDisplayName>, ...] }
 *       (drives enemy-catalog.html "appears in" column without scraping JS.)
 *   public/data/entities/companions.json {classPets,companionPower,
 *                                         companions:[],hires:[]}
 *     → companions.json  Array<{id,name,kind,class,ownerClass,className,role,
 *                                level,cost,personality,attrs,description,
 *                                encounterZone}>
 *       classPets       → kind:'pet'      role:'Pet'
 *       companions[]    → kind:'wild' if .wild else 'companion'
 *       hires[]         → kind:'hireable' role:className||class
 *   public/data/entities/heroes.json + npcs.json {entities:[{...}]}
 *     → appearances.json Array<{id,name,sprite,gender,classDefault,tags,
 *                                playable,npc,deprecated,pendingReview}>
 *       (heroes ∪ npcs, presentation order = dataLoader._APPEARANCE_ORDER so
 *        the picker / gallery iterate in the legacy sequence.)
 *
 * All other domains (classes, dungeons, status-effects, achievements, skills,
 * affixes, items, builds) have NO canonical JSON yet — they are NOT part of
 * the canonical-data migration's bug class and their source `export const`
 * literals still exist, so they keep their existing extractors unchanged.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public/assets/data');
const CANON   = path.join(ROOT, 'public/data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function writeJSON(name, data) {
  const outPath = path.join(OUT_DIR, name + '.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`  [emit-game-data] ${name}.json — ${count} entries`);
}

function readCanon(rel) {
  const p = path.join(CANON, rel);
  if (!fs.existsSync(p)) {
    console.error(`[emit-game-data] FATAL: canonical file missing: ${path.relative(ROOT, p)}`);
    console.error('  Run `node scripts/extract-canonical-data.mjs` first (Phase 0/1).');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** {version,entities:{...}} or {entities:[...]} or bare → the inner value. */
function entitiesOf(doc) {
  if (doc && typeof doc === 'object' && 'entities' in doc) return doc.entities;
  return doc;
}

// ---------------------------------------------------------------------------
// PASS-THROUGH: enemies + bosses (canonical entities → catalog array shape)
// ---------------------------------------------------------------------------
// The catalog/manifest consumers expect a flat array per id with the full
// combat stat block. We copy canonical fields verbatim — no derivation, no
// recompute — and only add `act` (presentation grouping) + `isBoss` (the
// enemies/bosses split flag the legacy pipeline carried).
function projectCombatant(rec, { isBoss }) {
  return {
    id:          rec.id,
    name:        rec.name || rec.id,
    act:         rec.act ?? null,
    hp:          rec.hp ?? 0,
    maxHp:       rec.maxHp ?? rec.hp ?? 0,
    dmg:         Array.isArray(rec.dmg) ? rec.dmg : null,
    armor:       rec.armor ?? 0,
    hit:         rec.hit ?? 0,
    dodge:       rec.dodge ?? 0,
    xpValue:     rec.xpValue ?? 0,
    magicResist: rec.magicResist ?? 0,
    gold:        Array.isArray(rec.gold) ? rec.gold : null,
    loot:        Array.isArray(rec.loot) ? rec.loot : (rec.loot ?? null),
    statusOnHit: rec.statusOnHit ?? null,
    spellChance: rec.spellChance ?? null,
    spellList:   Array.isArray(rec.spellList) ? rec.spellList : null,
    blockChance: rec.blockChance ?? null,
    isBoss:      !!isBoss,
  };
}

function emitEnemiesAndBosses() {
  const enemiesById = entitiesOf(readCanon('entities/enemies.json'));
  const bossesById  = entitiesOf(readCanon('entities/bosses.json'));

  const enemies = Object.keys(enemiesById)
    .sort()
    .map((id) => projectCombatant(enemiesById[id], { isBoss: false }));
  const bosses = Object.keys(bossesById)
    .sort()
    .map((id) => projectCombatant(bossesById[id], { isBoss: true }));

  writeJSON('enemies', enemies);
  writeJSON('bosses', bosses);
}

// ---------------------------------------------------------------------------
// PASS-THROUGH: encounter → entity reference index (for enemy-catalog.html)
// ---------------------------------------------------------------------------
function emitEncounterRefs() {
  const encDoc = readCanon('combat/encounters.json');
  const encMap = encDoc.encounters || encDoc;
  const refs = {};
  for (const [key, enc] of Object.entries(encMap)) {
    const display = enc.name || key;
    for (const g of (enc.enemies || [])) {
      if (!g || !g.ref) continue;
      (refs[g.ref] = refs[g.ref] || []);
      if (!refs[g.ref].includes(display)) refs[g.ref].push(display);
    }
  }
  // Stable key order for deterministic output.
  const sorted = {};
  for (const k of Object.keys(refs).sort()) sorted[k] = refs[k];
  writeJSON('encounter-refs', sorted);
}

// ---------------------------------------------------------------------------
// PASS-THROUGH: companions (classPets + companions[] + hires[])
// ---------------------------------------------------------------------------
function emitCompanions() {
  const doc = readCanon('entities/companions.json');
  const out = [];

  // CLASS_PETS — owner-bound pets.
  for (const id of Object.keys(doc.classPets || {})) {
    const p = doc.classPets[id];
    out.push({
      id,
      name:          p.name || id,
      kind:          'pet',
      class:         p.class || 'companion',
      ownerClass:    p.ownerClass || null,
      className:     p.className || 'Companion',
      role:          'Pet',
      level:         p.level ?? 1,
      cost:          p.cost ?? null,
      personality:   p.personality || null,
      attrs:         p.attrs || null,
      description:   p.description || null,
      encounterZone: null,
    });
  }

  // COMPANIONS_ACT1 — tavern / wild companions ({wild:true} → 'wild').
  for (const c of (doc.companions || [])) {
    out.push({
      id:            c.id,
      name:          c.name || c.id,
      kind:          c.wild ? 'wild' : 'companion',
      class:         c.class || 'companion',
      ownerClass:    c.ownerClass || null,
      className:     c.className || 'Companion',
      role:          'Companion',
      level:         c.level ?? 1,
      cost:          c.cost ?? null,
      personality:   c.personality || null,
      attrs:         c.attrs || null,
      description:   c.description || null,
      encounterZone: null,
    });
  }

  // HIREABLES_ACT1 — paid tavern hires.
  for (const h of (doc.hires || [])) {
    out.push({
      id:            h.id,
      name:          h.name || h.id,
      kind:          'hireable',
      class:         h.class || null,
      ownerClass:    null,
      className:     h.className || null,
      role:          h.className || h.class || null,
      level:         h.level ?? 1,
      cost:          h.cost ?? null,
      personality:   h.personality || null,
      attrs:         h.attrs || null,
      description:   h.description || null,
      encounterZone: null,
    });
  }

  writeJSON('companions', out);
}

// ---------------------------------------------------------------------------
// PASS-THROUGH: appearances (heroes.json ∪ npcs.json, legacy order)
// ---------------------------------------------------------------------------
// dataLoader.js owns the canonical APPEARANCES presentation order via its
// _APPEARANCE_ORDER manifest. We re-derive the same ordered list here from a
// frozen copy so the emitted appearances.json iterates in the legacy
// sequence (picker / asset-gallery are order-sensitive). The list contains
// ONLY ids that must already exist in heroes ∪ npcs — if one is missing the
// emit fails loudly rather than silently dropping it.
const _APPEARANCE_ORDER = [
  'warrior','fighter','paladin','ranger','rogue','mage','cleric','cleric_priestess',
  'bard','druid','necromancer','warlock','demon_hunter','dragon_knight','pyromancer',
  'stormcaller','oracle','oracle_old','swashbuckler','scavenger','tactician',
  'chronomancer','monk','knight','sorcerer','shaman','witch_hunter','runesmith',
  'shadow_dancer','tinker','tinker_female','clockwork_turret','bard_female',
  'chronomancer_female','cleric_male','demon_hunter_female','dragon_knight_male',
  'druid_male','fighter_female','knight_male','mage_female','monk_female',
  'necromancer_female','oracle_male','paladin_female','pyromancer_male','ranger_male',
  'rogue_male','runesmith_female','scavenger_female','shadow_dancer_male','shaman_male',
  'sorcerer_female','stormcaller_female','swashbuckler_female','tactician_female',
  'warlock_male','warrior_female','witch_hunter_female','enchanter_male','priest_female',
  'enchanter_female','priest_male','silas_veilward','kaela_thorne','marek_greel',
  'mira_seer','iris_vael','garrick_ostmere','mother_yssira','tomek_halverin',
  'krix_bonechewer','halden_man_at_arms','sister_veya','bulwark_dorn','kessa_quill',
  'magnus_orre','giant_spider','the_unraveler','dragon_king','vault_guardian',
  'void_scholar','echo_sovereign','the_first_ember',
];

function emitAppearances() {
  const heroes = entitiesOf(readCanon('entities/heroes.json'));
  const npcs   = entitiesOf(readCanon('entities/npcs.json'));
  const byId = new Map();
  for (const e of (Array.isArray(heroes) ? heroes : Object.values(heroes))) byId.set(e.id, e);
  for (const e of (Array.isArray(npcs)   ? npcs   : Object.values(npcs)))   byId.set(e.id, e);

  const project = (a) => ({
    id:            a.id,
    name:          a.name,
    sprite:        a.sprite || a.id,
    gender:        a.gender,
    classDefault:  a.classDefault || null,
    tags:          Array.isArray(a.tags) ? a.tags : [],
    playable:      a.playable !== false,
    npc:           a.npc === true,
    deprecated:    a.deprecated === true,
    pendingReview: a.pendingReview === true,
  });

  const out = [];
  const emitted = new Set();
  for (const id of _APPEARANCE_ORDER) {
    const a = byId.get(id);
    if (!a) {
      console.error(`[emit-game-data] FATAL: appearance order id "${id}" not found in heroes.json ∪ npcs.json`);
      process.exit(1);
    }
    out.push(project(a));
    emitted.add(id);
  }
  // Safety net: any canonical appearance NOT in the frozen order is appended
  // (sorted) so a newly-added entity can never silently vanish from the
  // catalog — surfaces loudly instead.
  const extra = [...byId.keys()].filter((id) => !emitted.has(id)).sort();
  if (extra.length) {
    console.warn(`[emit-game-data] WARNING: ${extra.length} canonical appearance(s) not in _APPEARANCE_ORDER, appended: ${extra.join(', ')}`);
    for (const id of extra) out.push(project(byId.get(id)));
  }

  writeJSON('appearances', out);
}

// ---------------------------------------------------------------------------
// Classes — canonical (M501): source-of-truth is public/data/classes.json.
// Pre-M496 this regex-scraped src/game/classes.js, which now imports from JSON
// and has zero inline literals — the scrape silently returned [] and broke
// the front-page Class Distribution chart (0 of each across all four
// archetypes). Read the canonical JSON and project the same fields the
// downstream consumer (build-live-data.cjs + assets/_design/site.js) expects.
// ---------------------------------------------------------------------------
function extractClasses() {
  const canonical = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public/data/classes.json'), 'utf8')
  );
  const out = (canonical.classes || []).map((c) => ({
    id: c.id,
    name: c.name || c.id,
    role: c.role || null,
    hook: c.hook || null,
    armorType: c.armorType || null,
    primaryAttr: c.primaryAttr || null,
    armorTier: c.armorTier || null,
    skills: Array.isArray(c.skills) ? c.skills.slice() : [],
  }));
  try {
    const unlockSrc = fs.readFileSync(path.join(ROOT, 'src/game/classUnlocks.js'), 'utf8');
    const startersM = unlockSrc.match(/STARTING_CLASS_IDS\s*=\s*\[([^\]]+)\]/);
    const starters = startersM ? (startersM[1].match(/['"](\w+)['"]/g) || []).map(s => s.replace(/['"]/g, '')) : [];
    const reqs = {};
    const reqBlock = unlockSrc.match(/UNLOCK_REQUIREMENTS\s*=\s*\{([\s\S]*?)^\};/m);
    if (reqBlock) {
      const body = reqBlock[1];
      const lineRe = /(\w+):\s*\{[^}]*type:\s*['"](\w+)['"][^}]*value:\s*(?:['"]([^'"]+)['"]|(\d+|true|false))[^}]*label:\s*['"]([^'"]+)['"]/g;
      let r;
      while ((r = lineRe.exec(body)) !== null) {
        const [, cid, type, strVal, numVal, label] = r;
        const value = strVal !== undefined ? strVal
          : (numVal === 'true' ? true : numVal === 'false' ? false : Number(numVal));
        reqs[cid] = { type, value, label };
      }
    }
    for (const c of out) {
      c.starter = starters.includes(c.id);
      if (reqs[c.id]) c.unlockRequirement = reqs[c.id];
    }
  } catch (e) {
    console.warn('[emit-game-data] could not enrich classes with unlock data:', e.message);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dungeons (non-canonical: source literal still present)
// ---------------------------------------------------------------------------
function extractDungeons() {
  const src = fs.readFileSync(path.join(ROOT, 'src/maps/mapData.js'), 'utf8');
  const out = [];
  const dungeonBlockM = src.match(/export const DUNGEONS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!dungeonBlockM) return out;
  const dungeonBody = dungeonBlockM[1];
  const entryRe = /(\w+):\s*\{([\s\S]*?)(?=\n  \w+:\s*\{|\n\};?$)/g;
  let e;
  while ((e = entryRe.exec(dungeonBody)) !== null) {
    const body = e[2];
    const id         = (body.match(/id:\s*['"](\w+)['"]/)           || [])[1] || e[1];
    const name       = (body.match(/name:\s*['"]([^'"]+)['"]/)      || [])[1];
    const parentZone = (body.match(/parentZone:\s*['"](\w+)['"]/)   || [])[1];
    const minLevel   = +(body.match(/minLevel:\s*(\d+)/)            || [,0])[1];
    const rewardM    = body.match(/reward:\s*\{([^}]+)\}/);
    const gold       = rewardM ? +(rewardM[1].match(/gold:\s*(\d+)/)  || [,0])[1] : 0;
    const xp         = rewardM ? +(rewardM[1].match(/xp:\s*(\d+)/)    || [,0])[1] : 0;
    const rewardItem = rewardM ? (rewardM[1].match(/item:\s*['"](\w+)['"]/) || [])[1] : null;
    const stagesM    = body.match(/stages:\s*\[([\s\S]*?)\]/);
    const stageCount = stagesM ? (stagesM[1].match(/type:/g) || []).length : 0;
    const bossStageM = body.match(/type:\s*'boss'[\s\S]*?name:\s*['"]([^'"]+)['"]/);
    const bossName   = bossStageM ? bossStageM[1] : null;
    const bossEncM   = body.match(/type:\s*'boss'[\s\S]*?encounter:\s*['"](\w+)['"]/);
    const bossEnc    = bossEncM ? bossEncM[1] : null;
    if (!id || id === '0') continue;
    out.push({ id, name: name||id, parentZone: parentZone||null, minLevel, stageCount, bossName, bossEncounter: bossEnc, reward: { gold, xp, item: rewardItem } });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Status Effects (non-canonical)
// ---------------------------------------------------------------------------
function extractStatusEffects() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/statusEffects.js'), 'utf8');
  const out = [];
  const entryRe = /(\w+):\s*\{\s*\n?\s*glyph:\s*['"]([^'"]+)['"],\s*color:\s*['"]([^'"]+)['"],\s*\n?\s*name:\s*['"]([^'"]+)['"],\s*\n?\s*plain:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = entryRe.exec(src)) !== null) {
    out.push({ id: m[1], glyph: m[2], color: m[3], name: m[4], plain: m[5] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Achievements (non-canonical)
// ---------------------------------------------------------------------------
function extractAchievements() {
  const parseAchievementsFromSrc = (src) => {
    const out = [];
    const entryRe = /\{\s*id:\s*['"](\w+)['"]([\s\S]*?)(?=\n  \{|\n\];)/g;
    let m;
    while ((m = entryRe.exec(src)) !== null) {
      const id   = m[1];
      const body = m[0];
      const name = (body.match(/name:\s*['"]([^'"]+)['"]/) || [])[1];
      const desc = (body.match(/desc:\s*['"]([^'"]+)['"]/) || [])[1];
      const tier = (body.match(/tier:\s*['"]([^'"]+)['"]/) || [])[1];
      if (!id) continue;
      out.push({ id, name: name||id, desc: desc||'', tier: tier||'bronze' });
    }
    return out;
  };
  const src1 = fs.readFileSync(path.join(ROOT, 'src/game/achievements.js'), 'utf8');
  const base = parseAchievementsFromSrc(src1);
  const screenPath = path.join(ROOT, 'src/ui/screens/AchievementsScreen.js');
  let screen = [];
  try {
    const src2 = fs.readFileSync(screenPath, 'utf8');
    screen = parseAchievementsFromSrc(src2);
  } catch (_) {}
  const seen = new Set(base.map(a => a.id));
  const merged = [...base];
  for (const a of screen) {
    if (!seen.has(a.id)) { merged.push(a); seen.add(a.id); }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Skills (non-canonical)
// ---------------------------------------------------------------------------
function extractSkills() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/skills.js'), 'utf8');
  const out = [];
  const entryRe = /^\s{2}(\w+):\s*\{([\s\S]*?)(?=\n  \w+:\s*\{|\n\};)/gm;
  let m;
  while ((m = entryRe.exec(src)) !== null) {
    const sid  = m[1];
    if (sid === 'SKILLS') continue;
    const body = m[2];
    const name        = (body.match(/name:\s*['"]([^'"]+)['"]/)         || [])[1];
    const cls         = (body.match(/class:\s*['"]([^'"]+)['"]/)        || [])[1];
    const type        = (body.match(/type:\s*['"]([^'"]+)['"]/)         || [])[1];
    const mpCost      = +(body.match(/mpCost:\s*(\d+)/)                 || [,0])[1];
    const unlockLevel = +(body.match(/unlockLevel:\s*(\d+)/)            || [,1])[1];
    const cooldown    = +(body.match(/cooldown:\s*(\d+)/)               || [,0])[1];
    const desc        = (body.match(/description:\s*['"]([^'"]+)['"]/)  || [])[1];
    const damageStat  = (body.match(/damageStat:\s*['"]([^'"]+)['"]/)   || [])[1];
    const damageMult  = (() => {
      const m2 = body.match(/damageMult:\s*([0-9.]+)/);
      return m2 ? Number(m2[1]) : null;
    })();
    const damageCategory = (body.match(/damageCategory:\s*['"]([^'"]+)['"]/) || [])[1];
    const aoe         = (body.match(/aoe:\s*['"]([^'"]+)['"]/) || [])[1];
    const talentsM    = body.match(/talents:\s*\[([\s\S]*?)\]/);
    const talents     = talentsM
      ? (talentsM[1].match(/id:\s*['"](\w+)['"]/g)||[]).map(s => s.replace(/id:\s*['"]/,'').replace(/['"]/,''))
      : [];
    if (!name) continue;
    out.push({
      id: sid, name, class: cls||null, type: type||null,
      mpCost, cooldown: cooldown||0, unlockLevel: unlockLevel||1,
      damageStat: damageStat || null,
      damageMult: damageMult,
      damageCategory: damageCategory || null,
      aoe: aoe || null,
      description: desc||null,
      talents,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Affixes (non-canonical)
// ---------------------------------------------------------------------------
function extractAffixes() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/items.js'), 'utf8');
  const blockRe = /export const AFFIXES_ACT1\s*=\s*(\{[\s\S]*?^\});/m;
  const shieldRe = /export const SHIELD_AFFIXES\s*=\s*(\[[\s\S]*?^\]);/m;
  const affixes = { prefixes: [], suffixes: [], shield: [] };
  const b = blockRe.exec(src);
  if (b) {
    try { const d = (new Function('return ' + b[1]))(); affixes.prefixes = d.prefixes||[]; affixes.suffixes = d.suffixes||[]; } catch (_) {}
  }
  const s = shieldRe.exec(src);
  if (s) {
    try { affixes.shield = (new Function('return ' + s[1]))(); } catch (_) {}
  }
  return affixes;
}

// ---------------------------------------------------------------------------
// Items (non-canonical)
// ---------------------------------------------------------------------------
function extractItems() {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/items.js'), 'utf8');
  const weaponRe = /export const WEAPON_BASES\s*=\s*\{([\s\S]*?)^};/m;
  const armorRe  = /export const ARMOR_BASES\s*=\s*\{([\s\S]*?)^};/m;
  const weapons = [];
  const armor   = [];
  const wm = weaponRe.exec(src);
  if (wm) {
    const body = wm[1];
    const entryRe = /(\w+):\s*\{([^}]+)\}/g;
    let e;
    while ((e = entryRe.exec(body)) !== null) {
      const id   = e[1];
      const b2   = e[2];
      const name     = (b2.match(/name:\s*['"]([^'"]+)['"]/)         || [])[1];
      const subtype  = (b2.match(/subtype:\s*['"]([^'"]+)['"]/)      || [])[1];
      const cat      = (b2.match(/weaponCategory:\s*['"]([^'"]+)['"]/)|| [])[1];
      const dmgM     = b2.match(/dmg:\s*\[(\d+),(\d+)\]/);
      const twoHanded= /twoHanded:\s*true/.test(b2);
      weapons.push({ id, name:name||id, subtype:subtype||null, weaponCategory:cat||null, dmg:dmgM?[+dmgM[1],+dmgM[2]]:null, twoHanded });
    }
  }
  const am = armorRe.exec(src);
  if (am) {
    const body = am[1];
    const entryRe = /(\w+):\s*\{([^}]+)\}/g;
    let e;
    while ((e = entryRe.exec(body)) !== null) {
      const id   = e[1];
      const b2   = e[2];
      const name    = (b2.match(/name:\s*['"]([^'"]+)['"]/)       || [])[1];
      const slot    = (b2.match(/slot:\s*['"]([^'"]+)['"]/)        || [])[1];
      const tier    = (b2.match(/armorTier:\s*['"]([^'"]+)['"]/)   || [])[1];
      const armor2  = +(b2.match(/armor:\s*(\d+)/)                 || [,0])[1];
      armor.push({ id, name:name||id, slot:slot||null, armorTier:tier||null, armor:armor2 });
    }
  }
  return { weapons, armor };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('[emit-game-data] Building catalog JSON (canonical pass-through + non-canonical extractors)...');

  // ── Canonical pass-through (Phase 3 step 10) ──
  emitEnemiesAndBosses();
  emitEncounterRefs();
  emitCompanions();
  emitAppearances();

  // ── Non-canonical domains (source literals still present) ──
  writeJSON('classes', extractClasses());

  try {
    const buildSrc = fs.readFileSync(path.join(ROOT, 'src/game/buildPresets.js'), 'utf8');
    const match = buildSrc.match(/export const BUILDS = (\{[\s\S]*?\n\});/);
    if (match) {
      // eslint-disable-next-line no-new-func
      const buildsObj = new Function(`return (${match[1]})`)();
      const flat = [];
      for (const [classId, list] of Object.entries(buildsObj)) {
        for (const b of list) flat.push({ classId, ...b });
      }
      writeJSON('builds', flat);
    }
  } catch (e) {
    console.warn('[emit-game-data] could not emit builds:', e.message);
  }

  writeJSON('dungeons', extractDungeons());
  writeJSON('status-effects', extractStatusEffects());
  writeJSON('achievements', extractAchievements());
  writeJSON('skills', extractSkills());
  writeJSON('affixes', extractAffixes());
  writeJSON('items', extractItems());

  console.log('[emit-game-data] Done.');
}
main();
