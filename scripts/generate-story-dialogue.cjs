#!/usr/bin/env node
/**
 * generate-story-dialogue.cjs — M-S20
 *
 * Generates LLM dialog nodes for Emberveil Story Mode via OpenAI chat
 * completions (sync, not Batch API). Uses gpt-4o-mini for cost efficiency.
 *
 * Per pool, generates ~50 new nodes by:
 *   1. Reading lore primer + canonical refs as grounding.
 *   2. Using 3 hand-authored seed nodes per request as few-shot style guide.
 *   3. Generating 5 nodes per request x ~10 batches = ~50 per pool.
 *   4. Validating each node against canonical refs.
 *   5. Writing accepted nodes to data/story/_generated/<pool>.json.
 *   6. Rejected nodes go to data/story/_rejected/<pool>_<id>.json.
 *
 * Usage:
 *   node scripts/generate-story-dialogue.cjs [--pool <name>] [--count <n>]
 *
 * Options:
 *   --pool <name>   Only generate for this pool (default: all 7 pools)
 *   --count <n>     Nodes per pool (default: 50)
 *   --dry-run       Print prompts without calling OpenAI
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'story');
const GEN_DIR  = path.join(DATA_DIR, '_generated');
const REJ_DIR  = path.join(DATA_DIR, '_rejected');

fs.mkdirSync(GEN_DIR, { recursive: true });
fs.mkdirSync(REJ_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function readFirstSecret(paths) {
  for (const p of paths) {
    try {
      const value = fs.readFileSync(p, 'utf8').trim();
      if (value) return value;
    } catch {
      // Try the next configured secret path.
    }
  }
  throw new Error(`OpenAI API key missing. Checked: ${paths.join(', ')}`);
}

const API_KEY = readFirstSecret([
  '/home/radgh/claude/secrets/openai-api-key.txt',
  '/home/radgh/codex/secrets/openai-api-key.txt',
  '/home/radgh/claude/assets/references/openai-api-key.txt',
]);

const MODEL = 'gpt-4o-mini';
const NODES_PER_REQUEST = 5;

// 7 canonical pools (companion-* pools are excluded — those have tight voice
// requirements that benefit from manual curation, not LLM bulk generation)
const ALL_POOLS = ['arrival', 'ambush', 'shrine', 'merchant', 'lore', 'faction', 'side-quest'];

// Act/biome distribution per pool
const POOL_CONFIGS = {
  arrival: [
    { act: 1, biomes: ['emberwood', 'old_road', 'stoneward'], tones: ['tense', 'wary', 'neutral'] },
    { act: 2, biomes: ['veilscar', 'crossroads', 'ash_plains'], tones: ['tense', 'cautious', 'grim'] },
    { act: 3, biomes: ['riftgate', 'ember_hollow', 'sovereigns_approach'], tones: ['dire', 'grim', 'tense'] },
  ],
  ambush: [
    { act: 1, biomes: ['old_road', 'emberwood', 'gloomridge'], tones: ['confrontational', 'fanatical', 'hostile'] },
    { act: 2, biomes: ['veilscar', 'plague_fen', 'ash_plains'], tones: ['fanatical', 'hostile', 'brutal'] },
    { act: 3, biomes: ['riftgate', 'architects_verge'], tones: ['dire', 'fanatical', 'hostile'] },
  ],
  shrine: [
    { act: 1, biomes: ['emberwood', 'stoneward', 'fen'], tones: ['eerie', 'sacred', 'melancholy'] },
    { act: 2, biomes: ['veilscar', 'ash_plains', 'plague_fen'], tones: ['corrupted', 'eerie', 'sacred'] },
    { act: 3, biomes: ['ember_hollow', 'riftgate'], tones: ['dire', 'sacred', 'corrupted'] },
  ],
  merchant: [
    { act: 1, biomes: ['old_road', 'emberwood', 'stoneward'], tones: ['wry', 'neutral', 'wary'] },
    { act: 2, biomes: ['crossroads', 'ash_plains', 'veilscar'], tones: ['cautious', 'wry', 'tense'] },
    { act: 3, biomes: ['crossroads', 'riftgate'], tones: ['grim', 'wry', 'desperate'] },
  ],
  lore: [
    { act: 1, biomes: ['old_road', 'emberwood', 'gloomridge'], tones: ['melancholy', 'eerie', 'informative'] },
    { act: 2, biomes: ['ash_plains', 'library_ruins', 'plague_fen'], tones: ['melancholy', 'revelatory', 'grim'] },
    { act: 3, biomes: ['architects_verge', 'ember_hollow', 'sovereigns_approach'], tones: ['revelatory', 'grim', 'ominous'] },
  ],
  faction: [
    { act: 1, biomes: ['emberwood', 'stoneward', 'old_road'], tones: ['political', 'tense', 'guarded'] },
    { act: 2, biomes: ['crossroads', 'veilscar', 'ash_plains'], tones: ['urgent', 'political', 'conflicted'] },
    { act: 3, biomes: ['riftgate', 'ember_hollow'], tones: ['desperate', 'resolute', 'conflicted'] },
  ],
  'side-quest': [
    { act: 1, biomes: ['emberwood', 'old_road', 'fen', 'gloomridge'], tones: ['wary', 'urgent', 'melancholy'] },
    { act: 2, biomes: ['crossroads', 'ash_plains', 'plague_fen'], tones: ['urgent', 'grim', 'conflicted'] },
    { act: 3, biomes: ['riftgate', 'ember_hollow'], tones: ['desperate', 'grim', 'resolute'] },
  ],
};

// ---------------------------------------------------------------------------
// Load canonical data
// ---------------------------------------------------------------------------
function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

const LORE_PRIMER  = fs.readFileSync(path.join(DATA_DIR, 'lore-primer.md'), 'utf8');
const FLAGS        = loadJson(path.join(DATA_DIR, 'canonical-flags.json')) || [];
const FACTIONS     = loadJson(path.join(DATA_DIR, 'canonical-factions.json')) || [];
const SKILLS       = loadJson(path.join(DATA_DIR, 'canonical-skills.json')) || [];
const BIOMES       = loadJson(path.join(DATA_DIR, 'canonical-biomes.json')) || [];
const STATS        = loadJson(path.join(DATA_DIR, 'canonical-stats.json')) || [];
const NPCS         = loadJson(path.join(DATA_DIR, 'npcs.json')) || [];

const FLAG_IDS    = FLAGS.map(f => f.id);
const FACTION_IDS = Array.isArray(FACTIONS) ? FACTIONS.map(f => f.id || f) : [];
const BIOME_IDS   = BIOMES.map(b => b.id);
const NPC_IDS     = NPCS.map(n => n.id);
const SKILL_LIST  = Array.isArray(SKILLS) ? SKILLS : [];
const STAT_LIST   = Array.isArray(STATS) ? STATS : [];
const KNOWN_FLAGS = new Set(FLAG_IDS);
const KNOWN_FACTIONS = new Set(FACTION_IDS);
const KNOWN_SKILLS   = new Set(SKILL_LIST);
const KNOWN_STATS    = new Set(STAT_LIST);

// ---------------------------------------------------------------------------
// JSON schema for structured output
// ---------------------------------------------------------------------------
// Strict JSON schema for OpenAI structured output.
// Every object must have additionalProperties: false and explicit required
// arrays when using strict: true mode. We allow an "extra" field as a
// catch-all string to handle any keys the model wants to emit that we
// don't enumerate here, avoiding schema rejection while keeping types safe.
const EFFECT_SCHEMA = {
  type: 'object',
  properties: {
    type:        { type: 'string' },
    flag:        { type: 'string' },
    faction:     { type: 'string' },
    amount:      { type: 'number' },
    itemId:      { type: 'string' },
    loreId:      { type: 'string' },
    companionId: { type: 'string' },
    pathId:      { type: 'string' },
    questId:     { type: 'string' },
    enemyGroup:  { type: 'array', items: { type: 'string' } },
    extra:       { type: 'string' },
  },
  required: ['type'],
  additionalProperties: false,
};

const PASS_FAIL_SCHEMA = {
  type: 'object',
  properties: {
    next:    { type: ['string', 'null'] },
    effects: { type: 'array', items: EFFECT_SCHEMA },
  },
  required: ['next', 'effects'],
  additionalProperties: false,
};

const SKILL_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    skill:   { type: 'string' },
    stat:    { type: 'string' },
    dc:      { type: 'integer' },
    scaling: { type: 'string' },
  },
  required: ['skill', 'stat', 'dc'],
  additionalProperties: false,
};

const REQUIRES_SCHEMA = {
  type: 'object',
  properties: {
    flag:    { type: 'string' },
    stat:    { type: 'string' },
    gte:     { type: 'number' },
    lte:     { type: 'number' },
    faction: { type: 'string' },
    item:    { type: 'string' },
  },
  required: [],
  additionalProperties: false,
};

const CHOICE_SCHEMA = {
  type: 'object',
  properties: {
    id:         { type: 'string' },
    text:       { type: 'string' },
    next:       { type: ['string', 'null'] },
    effects:    { type: 'array', items: EFFECT_SCHEMA },
    skillCheck: SKILL_CHECK_SCHEMA,
    requires:   REQUIRES_SCHEMA,
    onPass:     PASS_FAIL_SCHEMA,
    onFail:     PASS_FAIL_SCHEMA,
  },
  required: ['id', 'text', 'effects'],
  additionalProperties: false,
};

const NODE_SCHEMA = {
  type: 'object',
  properties: {
    id:      { type: 'string' },
    pool:    { type: 'string' },
    act:     { type: 'integer' },
    biome:   { type: 'string' },
    tone:    { type: 'string' },
    speaker: { type: ['string', 'null'] },
    lines:   { type: 'array', items: { type: 'string' } },
    choices: { type: 'array', items: CHOICE_SCHEMA },
  },
  required: ['id', 'pool', 'act', 'biome', 'tone', 'speaker', 'lines', 'choices'],
  additionalProperties: false,
};

const DIALOG_NODE_SCHEMA = {
  type: 'object',
  properties: {
    nodes: { type: 'array', items: NODE_SCHEMA },
  },
  required: ['nodes'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------
function buildSystemPrompt(pool, styleExamples) {
  const flagList = FLAG_IDS.slice(0, 60).join(', ');
  const factionList = FACTION_IDS.join(', ');
  const skillList = SKILL_LIST.join(', ');
  const biomeList = BIOME_IDS.join(', ');
  const npcList = NPC_IDS.slice(0, 15).join(', ');
  const examplesJson = JSON.stringify(styleExamples, null, 2);

  return `You are an Emberveil dialog writer generating content for a dark fantasy RPG's story mode. Respond ONLY with valid JSON matching the schema described below — no markdown, no code blocks, just raw JSON.

VOICE: Clipped, slightly mock-grim, occasionally self-aware. Not grimdark wallowing. The world is grim and the stakes are real, but the tone is like a soldier who has seen enough to stop being surprised and not enough to stop caring.

DO: Clipped, functional, slightly dry. "The gate is shut. State your business." not "Halt, intruder, who goes there on this dark night of ill omen!"
DO: Exposition through observation, not statement. "The mill hasn't run in three seasons. Wheel's jammed with something. Something that wriggles." not "This mill has been broken since the cult sabotaged it."
DO: Consequences rather than drama. "He takes your coin with a sneer and steps aside." not "He accepts your bribe, grinning wickedly..."
DO: Quiet reveals over dramatic ones. Keep revelations understated.

DON'T: Purple prose. DON'T: Explained emotion. DON'T: Unnecessary length.
DON'T: Faction characters without texture. DON'T: Stakes-announcement instead of stakes-showing.

LORE PRIMER (use this to ground all content):
${LORE_PRIMER.slice(0, 6000)}

CANONICAL FLAGS — only use these (do not invent new flag names):
${flagList}

CANONICAL FACTIONS — only these faction ids:
${factionList}

CANONICAL SKILLS — only these skill names (lowercase):
${skillList}

CANONICAL BIOMES — only these biome ids:
${biomeList}

CANONICAL NPCs (speaker ids) — you may also use null for environmental/item nodes:
${npcList}

POOL RULES for "${pool}":
${getPoolRules(pool)}

STYLE EXAMPLES — write LIKE these. Match voice, schema, and level of complexity:
${examplesJson}

OUTPUT RULES:
- Each choice.next must be: null, "#localId", or "pool:<poolName>#<nodeId>"
- Every flag in set_flag/clear_flag MUST be from the canonical list above
- Every faction in faction_delta MUST be from the canonical list
- Every skill in skillCheck MUST be from the canonical skills list
- choice.effects is always an array (may be empty [])
- Nodes with skillCheck must use onPass/onFail (not plain "next")
- Speaker must be a canonical NPC id or null
- lines array: 1-3 strings, each 8-25 words, Emberveil voice
- Choices: 2-4 options. Label skill checks as "[SkillName - STAT] action verb."

OUTPUT FORMAT: Return a JSON object with a "nodes" array. Example structure:
{"nodes": [{"id": "...", "pool": "...", "act": 1, "biome": "...", "tone": "...", "speaker": null, "lines": ["..."], "choices": [{"id": "...", "text": "...", "effects": []}]}]}`;
}

function getPoolRules(pool) {
  const rules = {
    arrival: 'First-contact dialog — party arrives at a location or checkpoint. Establishes the local situation. Often involves an NPC gating access. Mix diplomacy, intimidation, and exploration options.',
    ambush: 'Conflict or threat dialog — cultists, bandits, or hostile Emberguard. Options: fight, talk down, pay off, use skill. Combat start_combat effects are appropriate here.',
    shrine: 'Shrine interaction — purification, discovery, or corruption. Often environmental (speaker: null). Mix reverence, skill checks (religion/arcana), and world-building.',
    merchant: 'Merchant and trader encounters. Mix legitimate trade, gray-market info, and rumors. Gold effects, item grants. Tone: wry but transactional.',
    lore: 'Environmental discovery — journals, ruins, graves, inscriptions. Often no speaker. Rich world-building, lore_unlock effects. Moral choices about what to do with the information.',
    faction: 'Faction representative encounters. Advances faction standing, reveals political situation. faction_delta effects. Each node should feel like a real political interaction.',
    'side-quest': 'Side quest hooks — NPCs with problems, requests, or information. Establish quest_start effects or flag-based triggers. Keep urgency appropriate to the act.',
  };
  return rules[pool] || 'Generate engaging dialog for this pool.';
}

function buildUserPrompt(pool, act, biome, tone, count) {
  const idSuffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5);
  return `Generate exactly ${count} dialog nodes for:
  pool: "${pool}"
  act: ${act}
  biome: "${biome}"
  tone: "${tone}"

IDs must follow this pattern: ${pool.replace('-', '_')}_${biome}_${idSuffix}_001 through _00${count}
(use sequential suffixes, keep them short and unique)

Ensure variety: different speakers, different choice types, different outcomes.
Make at least one node in this batch have a skill check.
Remember: effects is always an array, even when empty.`;
}

// ---------------------------------------------------------------------------
// OpenAI API call (sync via https, no SDK needed)
// ---------------------------------------------------------------------------
function callOpenAI(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 4000,
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`OpenAI error ${res.statusCode}: ${data.slice(0, 500)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error(`No content in response: ${data.slice(0, 300)}`));
            return;
          }
          resolve(JSON.parse(content));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}. Data: ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateNode(node, pool) {
  if (!node || typeof node !== 'object') return ['node is null or not an object'];
  const errors = [];

  // Required fields
  if (!node.id || typeof node.id !== 'string') errors.push('missing id');
  if (!node.pool) errors.push('missing pool');
  if (node.pool !== pool) errors.push(`pool mismatch: got "${node.pool}" expected "${pool}"`);
  if (!Number.isInteger(node.act)) errors.push('act must be integer');
  if (!node.biome || !BIOME_IDS.includes(node.biome)) errors.push(`unknown biome: "${node.biome}"`);
  if (!Array.isArray(node.lines) || node.lines.length === 0) errors.push('lines must be non-empty array');
  if (!Array.isArray(node.choices) || node.choices.length < 2) errors.push('choices must have 2+ options');

  // Speaker validation — null is fine, or must be a known NPC id
  if (node.speaker !== null && node.speaker !== undefined) {
    if (!NPC_IDS.includes(node.speaker)) {
      // Soft warning only — don't reject for unknown speaker, many are plausible
      // (generic guards, innkeeper, etc.). Just note it.
    }
  }

  // Validate effects in choices
  for (const choice of (node.choices || [])) {
    if (!choice.id) errors.push('choice missing id');
    if (!choice.text) errors.push('choice missing text');
    if (!Array.isArray(choice.effects)) errors.push(`choice "${choice.id}" effects must be array`);

    const allEffects = [
      ...(choice.effects || []),
      ...(choice.onPass?.effects || []),
      ...(choice.onFail?.effects || []),
    ];

    for (const eff of allEffects) {
      if (eff.type === 'set_flag' || eff.type === 'clear_flag') {
        if (eff.flag && !KNOWN_FLAGS.has(eff.flag)) {
          errors.push(`unknown flag "${eff.flag}" in effect`);
        }
      }
      if (eff.type === 'faction_delta') {
        if (eff.faction && !KNOWN_FACTIONS.has(eff.faction)) {
          errors.push(`unknown faction "${eff.faction}" in effect`);
        }
      }
    }

    // Validate skillCheck
    if (choice.skillCheck) {
      const sk = choice.skillCheck.skill?.toLowerCase();
      if (sk && !KNOWN_SKILLS.has(sk)) {
        errors.push(`unknown skill "${sk}" in skillCheck`);
      }
    }

    // Validate requires flag
    if (choice.requires?.flag && !KNOWN_FLAGS.has(choice.requires.flag)) {
      errors.push(`unknown flag in requires: "${choice.requires.flag}"`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Throttle helper
// ---------------------------------------------------------------------------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Main generation loop
// ---------------------------------------------------------------------------
async function generatePool(pool, targetCount, dryRun) {
  console.log(`\n== Pool: ${pool} (target: ${targetCount} nodes) ==`);

  // Load seed nodes for few-shot examples
  const seedPath = path.join(DATA_DIR, 'dialogue-pools', `${pool}.json`);
  const seedData = loadJson(seedPath) || { nodes: [] };
  const seedNodes = (seedData.nodes || []).slice(0, 3);

  if (seedNodes.length === 0) {
    console.warn(`  WARN: no seed nodes for pool "${pool}" — skipping`);
    return { generated: 0, rejected: 0 };
  }

  const configs = POOL_CONFIGS[pool] || [{ act: 1, biomes: ['emberwood'], tones: ['neutral'] }];

  const acceptedNodes = [];
  let totalRejected = 0;
  let requestCount = 0;

  // Distribute requests across act/biome/tone combos to get ~targetCount nodes
  const requestsNeeded = Math.ceil(targetCount / NODES_PER_REQUEST);

  for (let i = 0; i < requestsNeeded; i++) {
    // Pick config slot (cycle through)
    const configSlot = configs[i % configs.length];
    const act   = configSlot.act;
    const biome = configSlot.biomes[i % configSlot.biomes.length];
    const tone  = configSlot.tones[i % configSlot.tones.length];

    const systemPrompt = buildSystemPrompt(pool, seedNodes);
    const userPrompt   = buildUserPrompt(pool, act, biome, tone, NODES_PER_REQUEST);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ];

    requestCount++;
    console.log(`  Request ${requestCount}/${requestsNeeded}: act=${act} biome=${biome} tone=${tone}`);

    if (dryRun) {
      console.log('  DRY RUN — would call OpenAI');
      console.log('  User prompt:', userPrompt.slice(0, 200));
      continue;
    }

    let result;
    try {
      result = await callOpenAI(messages);
    } catch (e) {
      console.error(`  ERROR on request ${requestCount}: ${e.message}`);
      // Retry once after 3s
      await sleep(3000);
      try {
        result = await callOpenAI(messages);
      } catch (e2) {
        console.error(`  RETRY FAILED: ${e2.message}`);
        console.error(`  Skipping this batch.`);
        continue;
      }
    }

    let nodes = result?.nodes;
    if (!Array.isArray(nodes)) {
      // Model might return nodes nested differently
      nodes = Array.isArray(result) ? result : [];
    }
    // Filter out null/undefined entries
    nodes = nodes.filter(n => n && typeof n === 'object');
    console.log(`  Got ${nodes.length} nodes`);

    for (const node of nodes) {
      const errs = validateNode(node, pool);
      if (errs.length > 0) {
        console.warn(`  REJECTED ${node.id || '?'}: ${errs.join('; ')}`);
        totalRejected++;

        // Save rejected node
        const rejPath = path.join(REJ_DIR, `${pool}_${node.id || Date.now()}.json`);
        fs.writeFileSync(rejPath, JSON.stringify({
          node,
          validationErrors: errs,
          rejectedAt: new Date().toISOString(),
        }, null, 2));

        // Attempt one fix — remove problematic flags/factions
        const fixed = fixNode(node, pool);
        if (fixed) {
          const fixErrs = validateNode(fixed, pool);
          if (fixErrs.length === 0) {
            console.log(`  FIXED ${fixed.id}`);
            acceptedNodes.push(fixed);
          } else {
            console.warn(`  FIX FAILED ${fixed.id}: ${fixErrs.join('; ')}`);
          }
        }
      } else {
        acceptedNodes.push(node);
      }
    }

    // Rate-limit: 1s between batches, extra 2s every 3 requests
    if (i < requestsNeeded - 1) {
      const delay = (requestCount % 3 === 0) ? 3000 : 1000;
      await sleep(delay);
    }
  }

  if (dryRun) return { generated: 0, rejected: 0 };

  // Write accepted nodes to _generated/<pool>.json
  const outPath = path.join(GEN_DIR, `${pool}.json`);
  let existing = [];
  if (fs.existsSync(outPath)) {
    existing = loadJson(outPath) || [];
  }
  const merged = [...existing, ...acceptedNodes];
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));

  console.log(`  Accepted: ${acceptedNodes.length}, Rejected: ${totalRejected}`);
  console.log(`  Written to ${outPath}`);
  return { generated: acceptedNodes.length, rejected: totalRejected };
}

// ---------------------------------------------------------------------------
// Auto-fix: remove unknown flags/factions from effects
// ---------------------------------------------------------------------------
function fixNode(node, pool) {
  try {
    const fixed = JSON.parse(JSON.stringify(node));
    fixed.pool = pool; // ensure pool is correct

    // Fix biome
    if (!BIOME_IDS.includes(fixed.biome)) {
      fixed.biome = 'emberwood'; // fallback
    }

    // Fix choices
    for (const choice of (fixed.choices || [])) {
      choice.effects = (choice.effects || []).filter(eff => {
        if ((eff.type === 'set_flag' || eff.type === 'clear_flag') && eff.flag) {
          return KNOWN_FLAGS.has(eff.flag);
        }
        if (eff.type === 'faction_delta' && eff.faction) {
          return KNOWN_FACTIONS.has(eff.faction);
        }
        return true;
      });

      // Fix onPass/onFail effects
      if (choice.onPass?.effects) {
        choice.onPass.effects = choice.onPass.effects.filter(eff => {
          if ((eff.type === 'set_flag' || eff.type === 'clear_flag') && eff.flag) {
            return KNOWN_FLAGS.has(eff.flag);
          }
          if (eff.type === 'faction_delta' && eff.faction) {
            return KNOWN_FACTIONS.has(eff.faction);
          }
          return true;
        });
      }
      if (choice.onFail?.effects) {
        choice.onFail.effects = choice.onFail.effects.filter(eff => {
          if ((eff.type === 'set_flag' || eff.type === 'clear_flag') && eff.flag) {
            return KNOWN_FLAGS.has(eff.flag);
          }
          if (eff.type === 'faction_delta' && eff.faction) {
            return KNOWN_FACTIONS.has(eff.faction);
          }
          return true;
        });
      }

      // Fix skillCheck
      if (choice.skillCheck) {
        const sk = choice.skillCheck.skill?.toLowerCase();
        if (sk && !KNOWN_SKILLS.has(sk)) {
          delete choice.skillCheck;
          if (choice.onPass) delete choice.onPass;
          if (choice.onFail) delete choice.onFail;
          choice.next = choice.next || null;
        }
      }
    }

    return fixed;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const poolArg = args.includes('--pool') ? args[args.indexOf('--pool') + 1] : null;
  const countArg = args.includes('--count') ? parseInt(args[args.indexOf('--count') + 1], 10) : 50;

  const pools = poolArg ? [poolArg] : ALL_POOLS;

  if (dryRun) {
    console.log('DRY RUN MODE — no OpenAI calls will be made');
  }

  console.log(`Generating dialog for pools: ${pools.join(', ')}`);
  console.log(`Target: ~${countArg} nodes per pool`);
  console.log(`Model: ${MODEL}`);

  let totalGenerated = 0;
  let totalRejected  = 0;

  for (const pool of pools) {
    const { generated, rejected } = await generatePool(pool, countArg, dryRun);
    totalGenerated += generated;
    totalRejected  += rejected;
  }

  console.log(`\n== SUMMARY ==`);
  console.log(`Total generated: ${totalGenerated}`);
  console.log(`Total rejected:  ${totalRejected}`);
  console.log(`Output: ${GEN_DIR}/`);

  if (!dryRun) {
    console.log(`\nNext step: node scripts/approve-story-dialogue.cjs`);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
