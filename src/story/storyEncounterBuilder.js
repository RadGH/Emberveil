import { ENCOUNTERS, ENEMIES } from '../maps/mapData.js';
import { currentMap } from './storyMapMutations.js';
import { hashString, rngFromState, uniquePush } from './storyLedger.js';
import { getStorytellerProfile } from './storyStorytellers.js';

const ENCOUNTER_LIST = Object.entries(ENCOUNTERS).map(([id, entry]) => ({ id, entry }));
const ROLE_FAMILY_INDEX = buildRoleFamilyIndex();

export function resolveEnemyId(role, family, act, rng) {
  const pool = ROLE_FAMILY_INDEX.get(`${role}::${family}`) || ROLE_FAMILY_INDEX.get(`${role}::generic`) || [];
  if (!pool.length) return null;
  const offset = Math.max(0, Math.trunc(Number(act) || 1) - 1);
  return pool[(Math.floor(rng() * pool.length) + offset) % pool.length];
}

export function buildEncounterForNode(gs, nodeId, opts = {}) {
  const story = requireStory(gs);
  const { graph } = currentMap(gs);
  const node = graph.nodes[nodeId] || graph.nodes[story.currentNodeId] || graph.nodes[graph.entryNodeId];
  const profile = getStorytellerProfile(opts.storytellerId || story.storytellerId);
  const rng = rngFromState(hashString(`${story.campaignSeed}:${node.id}:${story.rngState}:${profile.id}`));

  const queued = Array.isArray(story.pendingEncounters) && story.pendingEncounters.length
    ? story.pendingEncounters.shift()
    : null;

  let template = queued?.template ? ENCOUNTERS[queued.template] || null : null;
  if (!template) template = pickEncounterTemplate(node, story, profile, rng);
  if (!template) template = synthesizeFallbackEncounter(node, rng);

  const encounter = cloneEncounter(template);
  encounter.id = template.id || queued?.template || `story_${node.id}_encounter`;
  encounter.name = encounter.name || template.name || `Story Encounter: ${node.biome}`;
  encounter.type = encounter.type || node.type || 'combat';
  encounter.act = encounter.act || node.act || story.act || 1;
  encounter.biomes = encounter.biomes || [node.biome];
  encounter.themeTags = encounter.themeTags || [node.type, node.biome].filter(Boolean);
  encounter.primaryRole = encounter.primaryRole || guessPrimaryRole(encounter);
  encounter.sourceNodeId = node.id;
  encounter.storytellerId = profile.id;
  encounter.rewards = encounter.rewards || { goldRange: [0, 0], lootTier: 1 };
  encounter.weatherCompatible = encounter.weatherCompatible || ['all'];
  if (!Array.isArray(encounter.enemies) || !encounter.enemies.length) {
    encounter.enemies = buildEnemyGroups(node, rng);
  }
  if (!Array.isArray(story.encounterHistory)) story.encounterHistory = [];
  uniquePush(story.encounterHistory, {
    nodeId: node.id,
    encounterId: encounter.id,
    act: encounter.act,
    nodeType: node.type,
    storytellerId: profile.id,
    at: new Date().toISOString(),
  });
  return encounter;
}

function pickEncounterTemplate(node, story, profile, rng) {
  const scored = ENCOUNTER_LIST.map(({ id, entry }) => {
    let score = entry.baseWeight ?? 1;
    if (entry.act && Number(entry.act) === Number(node.act || story.act || 1)) score *= 1.5;
    if (Array.isArray(entry.biomes) && entry.biomes.includes(node.biome)) score *= 1.45;
    if (Array.isArray(entry.themeTags) && entry.themeTags.includes(node.type)) score *= 1.2;
    if (node.tags?.includes('boss') && /boss|final|sovereign|guardian|priest/i.test(`${id} ${entry.name || ''}`)) score *= 2.5;
    if (node.type === 'dialog' && (entry.type === 'dialog' || /dialog/i.test(entry.name || id))) score *= 2;
    if (node.type === 'combat' && (entry.type === 'combat' || entry.enemies)) score *= 1.3;
    if (profile.uniqueMechanic === 'discovery_pool_3x' && ['lore', 'hidden'].includes(node.type)) score *= 1.2;
    if (profile.uniqueMechanic === 'dark_omen_interrupt' && /omen|crisis|prophet/i.test(`${id} ${entry.name || ''}`)) score *= 1.5;
    if (profile.uniqueMechanic === 'no_fallback_ambush_instead' && /ambush|attack|raid/i.test(`${id} ${entry.name || ''}`)) score *= 1.5;
    return { id, entry, score: Math.max(0.001, score) };
  }).filter(item => item.score > 0);
  if (!scored.length) return null;
  const sum = scored.reduce((acc, item) => acc + item.score, 0);
  let cursor = rng() * sum;
  for (const item of scored) {
    cursor -= item.score;
    if (cursor <= 0) return { ...cloneEncounter(item.entry), id: item.id };
  }
  const last = scored[scored.length - 1];
  return { ...cloneEncounter(last.entry), id: last.id };
}

function buildEnemyGroups(node, rng) {
  const roles = node.tags?.includes('boss') ? ['frontline', 'caster'] : node.type === 'combat' ? ['frontline', 'striker'] : ['frontline'];
  return roles.map((role, index) => {
    const family = node.story?.enemyFamily || node.biome || 'generic';
    const enemyId = resolveEnemyId(role, family, node.act || 1, rng) || pickAnyEnemy(role, rng);
    const base = cloneEnemy(enemyId);
    if (!base) return null;
    return {
      ...base,
      id: `${base.id}_${index}`,
      count: 1,
      role,
      family,
    };
  }).filter(Boolean);
}

function synthesizeFallbackEncounter(node, rng) {
  const enemyId = pickAnyEnemy(node.type === 'boss' ? 'frontline' : 'striker', rng) || Object.keys(ENEMIES)[0];
  const base = cloneEnemy(enemyId);
  return {
    id: `story_${node.id}_fallback`,
    name: `${node.biome || 'Story'} Skirmish`,
    act: node.act || 1,
    type: 'combat',
    biomes: [node.biome || 'any'],
    themeTags: [node.type || 'event', node.biome || 'any'],
    primaryRole: 'frontline',
    budgetWeight: 1,
    baseWeight: 1,
    rewards: { goldRange: [10, 25], lootTier: 1 },
    weatherCompatible: ['all'],
    enemies: base ? [{ ...base, count: 1, role: 'frontline', family: node.biome || 'generic' }] : [],
  };
}

function guessPrimaryRole(encounter) {
  if (!Array.isArray(encounter.enemies) || !encounter.enemies.length) return 'frontline';
  const first = encounter.enemies[0];
  return first.role || inferRole(first);
}

function cloneEncounter(entry) {
  return JSON.parse(JSON.stringify(entry || {}));
}

function cloneEnemy(id) {
  if (!id || !ENEMIES[id]) return null;
  return JSON.parse(JSON.stringify(ENEMIES[id]));
}

function pickAnyEnemy(role, rng) {
  const pool = ROLE_FAMILY_INDEX.get(`${role}::generic`) || [];
  if (pool.length) return pool[Math.floor(rng() * pool.length)];
  const keys = Object.keys(ENEMIES);
  return keys.length ? keys[Math.floor(rng() * keys.length)] : null;
}

function inferRole(e) {
  if ((e.armor || 0) > 8) return 'frontline';
  if ((e.spellList || e.spells || []).length) return 'caster';
  if ((Array.isArray(e.dmg) ? e.dmg[1] : e.dmg || 0) > 20) return 'striker';
  return 'frontline';
}

function buildRoleFamilyIndex() {
  const idx = new Map();
  for (const [id, enemy] of Object.entries(ENEMIES)) {
    const role = enemy.role || inferRole(enemy);
    const family = enemy.family || enemy.enemyFamily || 'generic';
    const key = `${role}::${family}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(id);
    const genericKey = `${role}::generic`;
    if (!idx.has(genericKey)) idx.set(genericKey, []);
    idx.get(genericKey).push(id);
  }
  return idx;
}

function requireStory(gs) {
  if (!gs || !gs.story) throw new Error('Story state is required.');
  return gs.story;
}
