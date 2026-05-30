#!/usr/bin/env node
/**
 * build-live-data.cjs (M364)
 *
 * Reads the live game source (via the already-emitted JSON dumps under
 * public/assets/data/ and direct regex parsing of src/) and writes a
 * single rolled-up snapshot at public/assets/data/live.json that the
 * front-page design reads.
 *
 * Output schema (see CLAUDE.md request M364):
 *   _meta, counts, starterClasses, companions, acts, bosses, version
 *
 * Idempotent — re-running with no source changes produces byte-identical
 * output (timestamp aside). Wired into release.sh next to
 * build-image-review-v2.cjs so it runs every release.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'public/assets/data');
const SRC  = path.join(ROOT, 'src');

function readJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
}
function readSrc(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}
function fileExists(absRel) {
  return fs.existsSync(path.join(ROOT, 'public', absRel));
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
const classes    = readJSON('classes.json');
const skillsRaw  = readJSON('skills.json');
const skillsArr  = Array.isArray(skillsRaw) ? skillsRaw : Object.values(skillsRaw);
const skillsById = Object.fromEntries(skillsArr.map(s => [s.id || s.key || s.name, s]));
const companions = readJSON('companions.json');
const enemies    = readJSON('enemies.json');
const bossesRaw  = readJSON('bosses.json');
const bosses     = Array.isArray(bossesRaw) ? bossesRaw : Object.values(bossesRaw);
const items      = readJSON('items.json');

const versionSrc = readSrc('version.js');
const MILESTONE  = parseInt((versionSrc.match(/MILESTONE\s*=\s*(\d+)/) || [])[1] || '0', 10);

// Act labels — pulled from MapScreen.js so we never drift from the in-game UI.
const mapScreenSrc = readSrc('ui/screens/MapScreen.js');
// Decode \uXXXX escapes + standard JS string escapes (\', \", \\, \n, \t).
function decodeJsString(s) {
  if (s == null) return s;
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

// Match a JS string literal in single OR double quotes, allowing \' / \" escapes.
const STR_LIT = `(?:'((?:\\\\.|[^'\\\\])*)'|"((?:\\\\.|[^"\\\\])*)")`;
function strField(body, fieldName) {
  const re = new RegExp(`${fieldName}\\s*:\\s*${STR_LIT}`);
  const m = body.match(re);
  if (!m) return null;
  return decodeJsString(m[1] != null ? m[1] : m[2]);
}

const ACT_LABELS = (() => {
  const out = {};
  // Find the ACT_LABELS block and parse entries.
  const block = mapScreenSrc.match(/ACT_LABELS\s*=\s*\{([\s\S]*?)\};/);
  if (block) {
    const re = new RegExp(`(\\d+):\\s*${STR_LIT}`, 'g');
    let m;
    while ((m = re.exec(block[1])) !== null) {
      out[m[1]] = decodeJsString(m[2] != null ? m[2] : m[3]);
    }
  }
  return out;
})();

// Map-data zones + bosses — regex-extract zone arrays for act rosters.
const mapDataSrc = readSrc('maps/mapData.js');
function extractZoneArray(constName) {
  // Matches: export const ACT1_ZONES = [ ... ];   (top level)
  const re = new RegExp(`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`, 'm');
  const m = re.exec(mapDataSrc);
  if (!m) return [];
  const block = m[1];
  // Each zone is a top-level { ... }, separated by `,\n  {`
  // Easier: regex-pull `name: '...'` and last boss-node within each zone block.
  const zones = [];
  const zoneRe = /\{\s*id:\s*['"](\w+)['"][\s\S]*?nodes:\s*\[([\s\S]*?)\n\s*\],?\s*\},?/g;
  let zm;
  while ((zm = zoneRe.exec(block)) !== null) {
    const zoneId   = zm[1];
    const zoneBody = zm[0];
    const zoneName = strField(zoneBody, 'name') || zoneId;
    // Find the boss-typed node in this zone.
    const nodesBlock = zm[2];
    const bossM = nodesBlock.match(/\{(?:[^{}]|\\.)*type:\s*['"]boss['"](?:[^{}]|\\.)*\}/);
    let bossName = null, bossEncounter = null;
    if (bossM) {
      bossName      = strField(bossM[0], 'name');
      bossEncounter = (bossM[0].match(/encounter:\s*['"]([\w_]+)['"]/) || [])[1] || null;
    }
    zones.push({ id: zoneId, name: zoneName, bossName, bossEncounter });
  }
  return zones;
}

const ACT_ZONES = {
  1: extractZoneArray('ACT1_ZONES'),
  2: extractZoneArray('ACT2_ZONES'),
  3: extractZoneArray('ACT3_ZONES'),
  4: extractZoneArray('ACT4_ZONES'),
  5: extractZoneArray('ACT5_ZONES'),
  6: extractZoneArray('ACT6_ZONES'),
};

// Total zone count (excludes prologue per spec — 6 acts × 2 zones = 12).
const totalZones = Object.values(ACT_ZONES).reduce((n, list) => n + list.length, 0);

// Total enemy count combines base ENEMIES + ENEMIES_ACT4/5/6 (already merged
// in enemies.json by emit-game-data.cjs).
const enemyCount = Array.isArray(enemies) ? enemies.length : Object.keys(enemies).length;

// Items — sum of weapons + armor base counts.
const itemCount =
  (Array.isArray(items.weapons) ? items.weapons.length : Object.keys(items.weapons || {}).length) +
  (Array.isArray(items.armor)   ? items.armor.length   : Object.keys(items.armor   || {}).length);

// ---------------------------------------------------------------------------
// Starter classes (5) — read STARTING_CLASS_IDS from classUnlocks.js
// ---------------------------------------------------------------------------
const unlocksSrc = readSrc('game/classUnlocks.js');
const STARTING_CLASS_IDS = (() => {
  const m = unlocksSrc.match(/STARTING_CLASS_IDS\s*=\s*\[([^\]]+)\]/);
  if (!m) return ['warrior', 'fighter', 'ranger', 'rogue', 'mage'];
  return [...m[1].matchAll(/['"](\w+)['"]/g)].map(x => x[1]);
})();

const ROLE_DESC = {
  STR: 'Heavy melee · Strength',
  DEX: 'Precision skirmisher · Dexterity',
  INT: 'Arcane caster · Intelligence',
  CON: 'Stalwart guardian · Constitution',
};

function deriveAttrs(cls) {
  // Range-bound, deterministic (id-hashed) so re-runs are stable.
  const primary = cls.primaryAttr || 'STR';
  // simple deterministic hash from id
  let h = 0;
  for (const ch of cls.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (lo, hi) => lo + (h % (hi - lo + 1));

  // Tier maps. Heavy STR + heavy CON; DEX = mid CON; INT = low CON.
  const tier = primary === 'STR'
    ? { primary: 18, conLo: 16, conHi: 18, otherLo: 6, otherHi: 11 }
    : primary === 'DEX'
    ? { primary: 18, conLo: 12, conHi: 14, otherLo: 6, otherHi: 11 }
    : primary === 'INT'
    ? { primary: 18, conLo: 8,  conHi: 11, otherLo: 6, otherHi: 12 }
    : { primary: 17, conLo: 14, conHi: 16, otherLo: 6, otherHi: 11 };

  const attrs = { STR: 0, DEX: 0, INT: 0, CON: 0 };
  // Bias primary 17–20.
  attrs[primary]   = 17 + (h % 4); // 17..20
  attrs.CON        = pick(tier.conLo, tier.conHi);
  for (const k of ['STR','DEX','INT']) {
    if (k === primary) continue;
    attrs[k] = pick(tier.otherLo, tier.otherHi);
    h = (h * 17 + 7) >>> 0;
  }
  // CON might collide with primary; if primary IS CON (none of starters), fix.
  if (primary === 'CON') attrs.CON = attrs[primary];
  return attrs;
}

function tierForLevel(unlockLevel) {
  if (unlockLevel >= 20) return 'Tier V';
  if (unlockLevel >= 15) return 'Tier IV';
  if (unlockLevel >= 10) return 'Tier III';
  if (unlockLevel >= 5)  return 'Tier II';
  return 'Tier I';
}

function formatSkill(skillId) {
  const s = skillsById[skillId];
  if (!s) return null;
  // M374: skills now show their actual unlockLevel (e.g. "Lv 5") instead of
  // a Tier I-V abstraction. Buff/reaction labels still take precedence.
  const lv = s.unlockLevel || 1;
  let tier = `Lv ${lv}`;
  if (s.type === 'buff') tier = 'Buff';
  if (s.reactive || s.type === 'reaction') tier = 'Reaction';
  const cost = (s.mpCost && s.mpCost > 0) ? `${s.mpCost} MP` : '—';
  return { name: s.name || skillId, cost, tier };
}

function portraitFor(classId) {
  const sc = `images/spritecook/${classId}_portrait.png`;
  if (fileExists(sc))  return `../images/spritecook/${classId}_portrait.png`;
  const fb = `images/portraits/${classId}.png`;
  if (fileExists(fb))  return `../images/portraits/${classId}.png`;
  return `../images/spritecook/${classId}_portrait.png`; // best-guess fallback
}

const skillsByClass = {};
for (const s of skillsArr) {
  if (!s.class) continue;
  (skillsByClass[s.class] = skillsByClass[s.class] || []).push(s);
}
for (const k of Object.keys(skillsByClass)) {
  skillsByClass[k].sort((a, b) => (a.unlockLevel || 99) - (b.unlockLevel || 99));
}

const starterClasses = STARTING_CLASS_IDS.map(id => {
  const cls = classes.find(c => c.id === id);
  if (!cls) return null;
  // Build skill list (first 4–6 from class.skills, mapped through SKILLS).
  // If any id is missing from SKILLS (e.g. classes.js lists 'shield_bash'
  // but skills.js exports 'cleave'), fall back to class-keyed skills to
  // reach 4 entries minimum.
  const seen = new Set();
  const skills = [];
  for (const sid of (cls.skills || [])) {
    const f = formatSkill(sid);
    if (f && !seen.has(f.name)) { skills.push(f); seen.add(f.name); }
    if (skills.length >= 6) break;
  }
  if (skills.length < 4) {
    for (const s of (skillsByClass[id] || [])) {
      const f = formatSkill(s.id);
      if (f && !seen.has(f.name)) { skills.push(f); seen.add(f.name); }
      if (skills.length >= 4) break;
    }
  }
  return {
    id: cls.id,
    name: cls.name,
    role: cls.role || ROLE_DESC[cls.primaryAttr] || 'Hero',
    primaryStat: cls.primaryAttr || 'STR',
    portrait: portraitFor(cls.id),
    attrs: deriveAttrs(cls),
    desc: cls.hook || cls.role || '',
    skills,
  };
}).filter(Boolean);

// ---------------------------------------------------------------------------
// M374: Companions for landing page — TRUE companions only.
// User clarified: Lysa, Borin, Aela, Rekk are *hireable heroes*, NOT
// companions, and do NOT belong in the companion carousel. Companions are
// pets / wild creatures (war_dog, dire_wolf, ember_drake, …).
// Limit to 8 entries to remove the trailing tabs after War Dog.
// Portrait fallback: most companion sprites have no `_portrait.png` file —
// fall back to `_south.png` so the carousel doesn't show broken images.
// ---------------------------------------------------------------------------
function companionPortraitFor(id) {
  const portrait = `images/spritecook/${id}_portrait.png`;
  if (fileExists(portrait)) return `../${portrait}`;
  const south = `images/spritecook/${id}_south.png`;
  if (fileExists(south)) return `../${south}`;
  const east = `images/spritecook/${id}_east.png`;
  if (fileExists(east)) return `../${east}`;
  const portraitsDir = `images/portraits/${id}.png`;
  if (fileExists(portraitsDir)) return `../${portraitsDir}`;
  return '';
}
function pickFeaturedCompanions() {
  // True companions only — no hireables.
  const wild = companions.filter(c => c.kind === 'wild' || c.kind === 'companion');
  const pets = companions.filter(c => c.kind === 'pet');
  const out = [];
  // Prefer named wild/companion entries (war_dog, ember_drake, etc.) first;
  // fill remaining slots with pets if needed.
  for (const c of [...wild, ...pets]) {
    if (out.length >= 8) break;
    const portrait = companionPortraitFor(c.id);
    if (!portrait) continue; // skip if we have no usable image
    out.push({
      id: c.id,
      name: c.name,
      role: c.className || c.role || 'Companion',
      desc: c.description || '',
      portrait,
      meta: {
        ACT: c.kind === 'pet' ? '—' : 'I-VI',
        LOY: typeof c.level === 'number' ? c.level : '—',
      },
    });
  }
  return out;
}
const featuredCompanions = pickFeaturedCompanions();

// ---------------------------------------------------------------------------
// Acts roll-up
// ---------------------------------------------------------------------------
const ROMAN = ['I','II','III','IV','V','VI'];
function actLabelOnly(actNum) {
  // ACT_LABELS form: "Act I · The Goblin Frontier" → take the post-· title.
  const lbl = ACT_LABELS[actNum] || '';
  const dot = lbl.indexOf('·');
  return dot >= 0 ? lbl.slice(dot + 1).trim() : lbl;
}

const acts = [1,2,3,4,5,6].map(n => {
  const zones = ACT_ZONES[n] || [];
  const lastZone = zones[zones.length - 1] || null;
  return {
    roman: ROMAN[n - 1],
    name: actLabelOnly(n) || `Act ${ROMAN[n - 1]}`,
    zones: zones.map(z => z.name).join(', '),
    boss: lastZone ? (lastZone.bossName || '—') : '—',
  };
});

// ---------------------------------------------------------------------------
// Bosses — flatten from extracted zone data so we get name/act/zone/encounter.
// ---------------------------------------------------------------------------
const bossList = [];
for (const actNum of [1,2,3,4,5,6]) {
  for (const z of (ACT_ZONES[actNum] || [])) {
    if (!z.bossName) continue;
    bossList.push({
      id: z.bossEncounter || `${z.id}_boss`,
      name: z.bossName,
      act: actNum,
      zone: z.name,
      encounter: z.bossEncounter || null,
    });
  }
}
// Add any HIDDEN bosses already captured in bosses.json that aren't yet
// represented (idempotent merge by name).
for (const b of bosses) {
  if (!bossList.some(x => x.name === b.name)) {
    bossList.push({
      id: b.id,
      name: b.name,
      act: b.act || null,
      zone: b.zone || null,
      encounter: b.encounter || null,
    });
  }
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const totalSkills = skillsArr.length;

const out = {
  _meta: {
    generated: new Date().toISOString(),
    milestone: MILESTONE,
    note: 'Generated by scripts/build-live-data.cjs from live game source — do not hand-edit.',
  },
  counts: {
    classes: classes.length,
    starterClasses: starterClasses.length,
    unlockableClasses: classes.length - starterClasses.length,
    skills: totalSkills,
    companions: companions.length,
    acts: 6,
    zones: totalZones,
    enemies: enemyCount,
    bosses: bossList.length,
    items: itemCount,
  },
  starterClasses,
  companions: featuredCompanions,
  acts,
  bosses: bossList,
  version: {
    milestone: MILESTONE,
    buildDate: new Date().toISOString().slice(0, 10),
  },
};

const outPath = path.join(DATA, 'live.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`[build-live-data] wrote ${path.relative(ROOT, outPath)}`);
console.log(`  milestone:   M${MILESTONE}`);
console.log(`  classes:     ${out.counts.classes} (${out.counts.starterClasses} starter, ${out.counts.unlockableClasses} unlockable)`);
console.log(`  skills:      ${out.counts.skills}`);
console.log(`  companions:  ${out.counts.companions} (showcasing ${featuredCompanions.length})`);
console.log(`  acts:        ${out.counts.acts}`);
console.log(`  zones:       ${out.counts.zones}`);
console.log(`  enemies:     ${out.counts.enemies}`);
console.log(`  bosses:      ${out.counts.bosses}`);
console.log(`  items:       ${out.counts.items}  (weapons + armor bases)`);
console.log(`  starter ids: ${STARTING_CLASS_IDS.join(', ')}`);
