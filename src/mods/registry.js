/**
 * Mod pack registry. Loads JSON packs, performs light structural validation,
 * merges content into runtime stores. Full JSON-Schema validation is optional
 * and happens client-side via the custom-content.html upload tool.
 *
 * A pack file can be:
 *   - { id, version, skills: [...], classes: [...], ... }   (canonical)
 *   - [ {...}, {...} ]                                      (bare array, kind inferred)
 *   - { id: 'x', ... }                                      (single entity)
 */
import { shimTelemetry } from './telemetry.js';
import { PROTECTED_IDS } from './coreMechanics.js';

const KINDS = ['skills', 'classes', 'items', 'events', 'appearances', 'characters', 'loot'];

const STAT_ALIASES = {
  strength: 'str', str: 'str',
  dexterity: 'dex', dex: 'dex',
  intelligence: 'int', int: 'int',
  constitution: 'con', con: 'con',
  wisdom: 'wis', wis: 'wis',
  charisma: 'cha', cha: 'cha'
};

function normalizeStatsDeep(node, path = '') {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => normalizeStatsDeep(v, `${path}[${i}]`));
    return;
  }
  if (typeof node !== 'object') return;
  if (typeof node.stat === 'string') {
    const canon = STAT_ALIASES[node.stat.toLowerCase()];
    if (canon && canon !== node.stat) {
      shimTelemetry.hit(`registry.statNorm:${node.stat}->${canon}`);
      node.stat = canon;
    }
  }
  if (node.startingStats && typeof node.startingStats === 'object') {
    const norm = {};
    for (const [k, v] of Object.entries(node.startingStats)) {
      const canon = STAT_ALIASES[k.toLowerCase()] || k;
      if (canon !== k) shimTelemetry.hit(`registry.statNorm:startingStats:${k}->${canon}`);
      norm[canon] = v;
    }
    node.startingStats = norm;
  }
  if (typeof node.primaryAttr === 'string') {
    const canon = STAT_ALIASES[node.primaryAttr.toLowerCase()];
    if (canon && canon !== node.primaryAttr) {
      shimTelemetry.hit(`registry.statNorm:primaryAttr:${node.primaryAttr}->${canon}`);
      node.primaryAttr = canon;
    }
  }
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object') normalizeStatsDeep(v, `${path}.${k}`);
  }
}

const store = {
  skills: {},
  classes: {},
  items: {},
  events: {},
  appearances: {},
  characters: {},
  loot: {},
  packs: {}
};

function inferKind(entity) {
  // Skills — effects DSL present.
  if (entity.mpCost != null || entity.targeting || Array.isArray(entity.effects)) return 'skills';
  // Classes — class definition (must come before items which could also list startingEquipment).
  if (entity.primaryAttr || entity.startingStats) return 'classes';
  // Items — weapons/armor/trinkets.
  if (entity.dmg || entity.armor || entity.weaponCategory) return 'items';
  // Event chains — explicit event shape.
  if (Array.isArray(entity.nodes) && entity.actRange) return 'events';
  // Sprites / appearances — sprite key + classDefault. Also accepts the
  // 7-frame portrait/east/east_attack/east_ko/south form so "custom sprite"
  // uploads work without a classDefault hint.
  if (entity.sprite && entity.classDefault !== undefined) return 'appearances';
  if (entity.portrait || entity.south || entity.east_attack || entity.east_ko) return 'appearances';
  // Enemies/characters — any actor with a classId or hp + tier fall here.
  if (entity.classId || (entity.hp != null && entity.tier != null)) return 'characters';
  // Loot tables.
  if (entity.roll || entity.items) return 'loot';
  return null;
}

export function registerPack(raw) {
  let pack = raw;
  if (Array.isArray(raw)) {
    const kind = raw[0] ? inferKind(raw[0]) : null;
    if (!kind) throw new Error('Cannot infer pack kind from bare array');
    pack = { id: `anon_${Date.now()}`, version: '0.0.1', [kind]: raw };
  } else if (!Array.isArray(raw) && typeof raw === 'object' && !KINDS.some(k => raw[k])) {
    const kind = inferKind(raw);
    if (!kind) throw new Error('Cannot infer pack kind from single entity');
    pack = { id: raw.id || `anon_${Date.now()}`, version: '0.0.1', [kind]: [raw] };
  }
  if (!pack.id || !pack.version) throw new Error('Pack missing id/version');
  normalizeStatsDeep(pack);
  store.packs[pack.id] = { id: pack.id, version: pack.version, name: pack.name || pack.id };

  for (const kind of KINDS) {
    const arr = pack[kind];
    if (!Array.isArray(arr)) continue;
    for (const ent of arr) {
      if (!ent.id) { shimTelemetry.hit(`registry.missingId:${kind}`); continue; }
      if (PROTECTED_IDS[kind] && PROTECTED_IDS[kind].has(ent.id)) {
        shimTelemetry.hit(`registry.protected:${kind}:${ent.id}`);
        console.warn(`[mods] Skipping override of protected ${kind} id "${ent.id}" (pack=${pack.id}).`);
        continue;
      }
      if (store[kind][ent.id]) shimTelemetry.hit(`registry.override:${kind}:${ent.id}`);
      store[kind][ent.id] = { ...ent, _pack: pack.id };
    }
  }
  return pack.id;
}

export { normalizeStatsDeep };

export async function loadPackUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Load failed ${res.status} for ${url}`);
  return registerPack(await res.json());
}

export function getAll(kind) {
  return Object.values(store[kind] || {});
}

export function getById(kind, id) {
  return store[kind]?.[id];
}

export function clear() {
  for (const k of KINDS) store[k] = {};
  store.packs = {};
}

export function listPacks() {
  return Object.values(store.packs);
}

if (typeof window !== 'undefined') {
  window.__emberveilMods = { registerPack, loadPackUrl, getAll, getById, listPacks, clear };
}
